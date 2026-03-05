import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import L, { control, icon } from 'leaflet';
import { Subscription } from 'rxjs';
import { Station } from '../../services/response/Station';
import { ControlPoint } from '../../services/response/RaceResults';
import { Coordinates } from '../model/Coordinates';
import { TileDbService, MapMetadata } from '../../services/tile-db.service';
import { idbTileLayer } from '../../shared/tile-layer-indexeddb';

@Component({
  selector: 'backoffice-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div id="map" style="height: 100%; width: 100%; position: relative;"></div>
    <div *ngIf="showCenterCoordinates" id="coordinates" style="position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 6px; font-size: 0.9em; z-index: 1000; pointer-events: none;"></div>
  `,
  styleUrls: ['./backoffice-map.component.css']
})
export class BackofficeMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  defaultMapId: string = '3857_mala_2';
  defaultMinZoom = 15;
  defaultMaxZoom = 15;
  defaultNorthEast: [number, number] = [51.96086, 15.52418];
  defaultSouthWest: [number, number] = [51.94511, 15.49677];

  @Input() backgroundMapId: string | undefined | null = this.defaultMapId;
  @Input() minZoom: number | undefined = this.defaultMinZoom;
  @Input() maxZoom: number | undefined = this.defaultMaxZoom;
  @Input() northEast: [number, number] | undefined;
  @Input() southWest: [number, number] | undefined;
  @Input() dodoControlPoints: (ControlPoint & { participantNickname: string, participantUnit: string, categoryName: string })[] = [];
  @Input() showCenterCoordinates: boolean = false;
  @Input() stationsToShow: Station[] = [];
  @Input() useIndexedDb: boolean = true; // NOWE: przełącznik źródła kafelków (IndexedDB vs assets)
  @Input() forceStationsGreen: boolean = false;

  @Output() pickedCoordinates = new EventEmitter<Coordinates>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() trackClicked = new EventEmitter<string>();

  private controlPointMarkers: L.Circle[] = [];
  private map!: L.Map;
  private currentTileLayer!: L.TileLayer;
  private circleMarker!: L.CircleMarker;
  private coordinatesDisplay!: HTMLElement;
  private mapMoveSubscription!: Subscription;
  private stationPaneName = 'stationPane';
  private accuracyPaneName = 'accuracyPane';
  private trackPaneName = 'trackPane';
  private stationMarkers: L.Layer[] = [];
  private interactivePolygons: L.Polygon[] = [];
  private openPopups: L.Popup[] = [];
  private scaleControl?: L.Control.Scale;
  private accuracyVisible = true;
  private trackVisible = true;
  private trackPolylines: Map<string, L.Polyline[]> = new Map();
  private trackOriginalStyles: Map<string, { color: string, weight: number }[]> = new Map();

  private readonly DEFAULT_INTERACTIVE_RADIUS = 15;
  private readonly MIN_INTERACTIVE_RADIUS = 3;
  private readonly POLYGON_SEGMENTS = 16;

  // Original logical map bounds (from metadata or inputs). We'll base allowed center range on this.
  private originalBounds?: L.LatLngBounds;
  // Window resize listener ref so we can remove it on destroy
  private resizeListener?: () => void;

  private meta?: MapMetadata;

  constructor(private tileDb: TileDbService) {}

  ngAfterViewInit(): void {
    // Zainicjuj mapę i dopiero po zakończeniu inicjalizacji ustaw wskaźnik środka
    this.initMap()
      .then(() => {
        this.coordinatesDisplay = document.getElementById('coordinates')!;
        if (this.showCenterCoordinates) {
          this.readCenterCoordinates();
        }
        // Invalidate size after DOM is ready to ensure proper dimensions
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
            this.updateCenterMarker();
          }
        }, 100);
      })
      .catch(err => {
        console.error('BackofficeMapComponent: błąd podczas inicjalizacji mapy', err);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (this.dodoControlPoints != null) {
      this.clearControlPointMarkers();
      this.addGeoViewDodo(this.dodoControlPoints);
    }

    if (this.dodoControlPoints == null) {
      this.clearControlPointMarkers();
    }

    if (this.stationsToShow != undefined && changes['stationsToShow']) {
      this.setStations(this.stationsToShow);
    }

    if (changes['backgroundMapId'] && this.map) {
      void this.switchBaseMap(this.backgroundMapId);
    }

    if ((changes['minZoom'] || changes['maxZoom']) && this.map) {
      if (this.minZoom != null) this.map.setMinZoom(this.minZoom);
      if (this.maxZoom != null) this.map.setMaxZoom(this.maxZoom);
    }
  }

  ngOnDestroy(): void {
    if (this.mapMoveSubscription) {
      this.mapMoveSubscription.unsubscribe();
    }

    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }

    if (this.map) {
      this.closeAllPopups();
      this.clearStations();
      this.clearAllGpsTracks();
      this.map.off('move');
      this.map.off('zoomend');
      this.map.off('moveend');
      this.map.off('click');
      this.map.off('dragstart');
      this.map.off('zoomstart');
      this.map.remove();
    }
  }

  emitCurrentCenter() {
    const center = this.map.getCenter();
    this.pickedCoordinates.emit({ lat: center.lat, lng: center.lng });
  }

  getCurrentCenter(): Coordinates {
    const center = this.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  }

  panTo(lat: number, lng: number): void {
    if (this.map) {
      this.map.panTo([lat, lng]);
    }
  }

  invalidateSizeAndKeepCenter(): void {
    if (this.map) {
      const currentCenter = this.map.getCenter();
      this.map.invalidateSize();
      this.map.setView(currentCenter, this.map.getZoom(), { animate: false });
      this.updateCenterMarker();
    }
  }

  private async initMap(): Promise<void> {
    const usedMapId = this.backgroundMapId || this.defaultMapId;

    // Najpierw spróbuj pobrać metadane z IndexedDB (jeśli używamy IDB)
    if (this.useIndexedDb && usedMapId) {
      this.meta = await this.tileDb.getMapMetadata(usedMapId);
    }

    // Ustaw zoom levels - PRIORYTET: Input > Metadata z IDB > Defaulty
    this.minZoom = this.minZoom ?? this.meta?.minZoom ?? this.defaultMinZoom;
    this.maxZoom = this.maxZoom ?? this.meta?.maxZoom ?? this.defaultMaxZoom;

    // Ustaw bounds - PRIORYTET: Input > Metadata z IDB > Defaulty
    if (!this.northEast || !this.southWest) {
      if (this.meta?.bounds) {
        this.southWest = [this.meta.bounds.south, this.meta.bounds.west];
        this.northEast = [this.meta.bounds.north, this.meta.bounds.east];
      } else {
        this.northEast = this.northEast ?? this.defaultNorthEast;
        this.southWest = this.southWest ?? this.defaultSouthWest;
      }
    }

    const bounds: L.LatLngBounds = new L.LatLngBounds(this.southWest!, this.northEast!);

    this.map = L.map('map', {
      center: bounds.getCenter(),
      zoom: this.minZoom!,
      minZoom: this.minZoom!,
      maxZoom: this.maxZoom!,
      maxBoundsViscosity: 1.0,
      dragging: true,
      zoomControl: false,
    });

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    await this.addBaseLayer(usedMapId!);

    this.setupPopupAutoHide();

    this.map.createPane(this.stationPaneName);
    this.map.getPane(this.stationPaneName)!.style.zIndex = '600';

    this.map.createPane(this.accuracyPaneName);
    this.map.getPane(this.accuracyPaneName)!.style.zIndex = '200';
    if (!this.accuracyVisible) {
      this.map.getPane(this.accuracyPaneName)!.style.display = 'none';
    }

    this.map.createPane(this.trackPaneName);
    this.map.getPane(this.trackPaneName)!.style.zIndex = '400';
    if (!this.trackVisible) {
      this.map.getPane(this.trackPaneName)!.style.display = 'none';
    }

    this.updateAllowedCenterBounds();

    this.map.on('zoomend', () => {
      this.updateAllowedCenterBounds();
      this.updateCenterMarker();
      this.zoomChange.emit(this.map.getZoom());
    });
    this.map.on('moveend', () => {
      this.updateAllowedCenterBounds();
      this.updateCenterMarker();
    });
    this.resizeListener = () => {
      this.updateAllowedCenterBounds();
      if (this.map) {
        this.map.invalidateSize();
        this.updateCenterMarker();
      }
    };
    window.addEventListener('resize', this.resizeListener);

    this.zoomChange.emit(this.map.getZoom());
  }

  private async switchBaseMap(mapId: string | undefined | null) {
    if (this.scaleControl) {
      this.map.removeControl(this.scaleControl);
      this.scaleControl = undefined;
    }

    if (!mapId) {
      if (this.currentTileLayer) {
        this.map.removeLayer(this.currentTileLayer);
      }
      return;
    }

    mapId = mapId || this.defaultMapId;

    // Spróbuj pobrać metadane z IndexedDB (jeśli używamy IDB)
    if (this.useIndexedDb && mapId) {
      this.meta = await this.tileDb.getMapMetadata(mapId);
    }

    // Ustaw zoom levels - PRIORYTET: Input > Metadata z IDB > Defaulty
    // (NIE nadpisuj jeśli już są ustawione z inputów!)
    if (this.meta) {
      this.minZoom = this.minZoom ?? this.meta.minZoom ?? this.defaultMinZoom;
      this.maxZoom = this.maxZoom ?? this.meta.maxZoom ?? this.defaultMaxZoom;

      if (!this.northEast || !this.southWest) {
        if (this.meta.bounds) {
          this.southWest = [this.meta.bounds.south, this.meta.bounds.west];
          this.northEast = [this.meta.bounds.north, this.meta.bounds.east];
        } else {
          this.northEast = this.northEast ?? this.defaultNorthEast;
          this.southWest = this.southWest ?? this.defaultSouthWest;
        }
      }
    } else {
      // Brak metadanych - użyj defaultów jeśli nie ma inputów
      this.minZoom = this.minZoom ?? this.defaultMinZoom;
      this.maxZoom = this.maxZoom ?? this.defaultMaxZoom;
      this.northEast = this.northEast ?? this.defaultNorthEast;
      this.southWest = this.southWest ?? this.defaultSouthWest;
    }

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    await this.addBaseLayer(mapId);

    const bounds = L.latLngBounds(
      L.latLng(this.southWest?.[0]!, this.southWest?.[1]!),
      L.latLng(this.northEast?.[0]!, this.northEast?.[1]!)
    );

    if (this.minZoom != null) this.map.setMinZoom(this.minZoom);
    if (this.maxZoom != null) this.map.setMaxZoom(this.maxZoom);

    if (this.northEast && this.southWest) {
      this.originalBounds = bounds;
      this.updateAllowedCenterBounds();
      this.map.panTo(bounds.getCenter());
    }
    if (this.minZoom != null) {
      this.map.setZoom(this.minZoom);
    }

    this.scaleControl = L.control.scale({
      position: 'topleft',
      maxWidth: 100,
      metric: true,
      imperial: false,
      updateWhenIdle: false
    });
    this.scaleControl.addTo(this.map);
  }

  private async addBaseLayer(mapId: string) {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    if (this.useIndexedDb) {
      this.currentTileLayer = idbTileLayer(this.tileDb, mapId, {
        minZoom: this.minZoom!,
        maxZoom: this.maxZoom!,
        tileSize: 256,
      });
    } else {
      const url = `assets/maps/${mapId}/{z}/{x}/{y}.png`;
      this.currentTileLayer = L.tileLayer(url, {
        minZoom: this.minZoom!,
        maxZoom: this.maxZoom!,
      });
    }

    this.currentTileLayer.addTo(this.map);
  }

  private addStations(stations: Station[]) {
    if (!this.map || !stations || stations.length === 0) {
      return;
    }

    const stationData = stations.map(station => ({
      station,
      lat: station.geometry.coordinates[1],
      lng: station.geometry.coordinates[0],
      coordinates: L.latLng(station.geometry.coordinates[1], station.geometry.coordinates[0])
    }));

    for (let i = 0; i < stationData.length; i++) {
      const { station, coordinates } = stationData[i];

      const isMounted = station.properties['isMounted'] === 'true';
      const markerColor = this.forceStationsGreen ? '#39FF14' : (isMounted ? '#39FF14' : '#FF073A');

      const circle = L.circle(coordinates, {
        color: markerColor,
        opacity: 1,
        fillColor: markerColor,
        fillOpacity: 1,
        radius: 1,
        pane: this.stationPaneName,
        interactive: false
      });

      circle.addTo(this.map);
      this.stationMarkers.push(circle);

      const accuracyCircle = L.circle(coordinates, {
        color: markerColor,
        weight: 1,
        opacity: 0.2,
        fillColor: markerColor,
        fillOpacity: 0.1,
        radius: Number(station.properties['accuracy']),
        pane: this.accuracyPaneName,
        interactive: false
      });

      accuracyCircle.addTo(this.map);
      this.stationMarkers.push(accuracyCircle);

      const interactivePolygonPoints = this.calculateInteractivePolygon(
        coordinates,
        stationData,
        i
      );

      const interactivePolygon = L.polygon(interactivePolygonPoints, {
        color: 'transparent',
        fillColor: 'transparent',
        fillOpacity: 0,
        interactive: true
      });

      const routeName = station.properties['routeName'];
      const popupHtml = `<div style="text-align: center;">
                        ${routeName ? `<div style="font-size: 0.85em; color: #b87333; margin-bottom: 0.3em;">${routeName}</div>` : ''}
                        <h2>${station.properties['name']}</h2>
                      </div>
                      <span>${station.properties['note']}</span>`;

      const leafletPopup = L.popup().setContent(popupHtml);
      interactivePolygon.bindPopup(leafletPopup);

      interactivePolygon.on('popupopen', (e) => {
        if (!this.openPopups.includes(e.popup)) {
          this.openPopups.push(e.popup);
        }
      });

      interactivePolygon.on('popupclose', (e) => {
        const idx = this.openPopups.indexOf(e.popup);
        if (idx > -1) {
          this.openPopups.splice(idx, 1);
        }
      });

      interactivePolygon.addTo(this.map);
      this.interactivePolygons.push(interactivePolygon);
    }
  }

  private calculateInteractivePolygon(
    center: L.LatLng,
    allStations: Array<{station: Station, lat: number, lng: number, coordinates: L.LatLng}>,
    currentIndex: number
  ): L.LatLng[] {
    const points: L.LatLng[] = [];
    const angleStep = (2 * Math.PI) / this.POLYGON_SEGMENTS;

    for (let seg = 0; seg < this.POLYGON_SEGMENTS; seg++) {
      const angle = seg * angleStep;
      let maxRadius = this.DEFAULT_INTERACTIVE_RADIUS;

      for (let j = 0; j < allStations.length; j++) {
        if (j === currentIndex) continue;

        const neighbor = allStations[j];
        const distance = center.distanceTo(neighbor.coordinates);

        const dx = neighbor.lng - center.lng;
        const dy = neighbor.lat - center.lat;
        const angleToNeighbor = Math.atan2(dy, dx);

        let angleDiff = Math.abs(angle - angleToNeighbor);
        if (angleDiff > Math.PI) {
          angleDiff = 2 * Math.PI - angleDiff;
        }

        const influence = Math.cos(angleDiff);

        if (influence > 0) {
          const limitedRadius = (distance / 2) * influence + this.DEFAULT_INTERACTIVE_RADIUS * (1 - influence);
          maxRadius = Math.min(maxRadius, Math.max(this.MIN_INTERACTIVE_RADIUS, limitedRadius));
        }
      }

      const point = this.destinationPoint(center, maxRadius, angle);
      points.push(point);
    }

    return points;
  }

  private destinationPoint(start: L.LatLng, distanceMeters: number, angleRadians: number): L.LatLng {
    const latOffset = (distanceMeters * Math.sin(angleRadians)) / 111320;
    const lngOffset = (distanceMeters * Math.cos(angleRadians)) / (111320 * Math.cos(start.lat * Math.PI / 180));
    return L.latLng(start.lat + latOffset, start.lng + lngOffset);
  }

  private addGeoViewDodo(controlPoints: (ControlPoint & { participantNickname: string, participantUnit: string, categoryName: string })[]) {
    for (const controlPoint of controlPoints) {
      const location = controlPoint.geoView;
      let lat = location.geometry.coordinates[1];
      let lng = location.geometry.coordinates[0];

      let coordinates: L.LatLng;
      if (lat === 0.0 || lng === 0.0) {
        coordinates = this.map.getBounds().getCenter();
      } else {
        coordinates = L.latLng(lat, lng);
      }

      let color: string;
      if (controlPoint.ruleValidation.some(rule => rule.result === 'FAILED')) {
        color = 'red';
      } else if (controlPoint.ruleValidation.every(ruleValidation => ruleValidation.result === 'PASSED')) {
        color = 'green';
      } else {
        color = 'blue';
      }

      const circle = L.circle(coordinates, {
        color: color,
        radius: 1
      });
      const popup = `<div style="text-align: center;">
                        <h3>${controlPoint.name}</h3>
                        <div>${controlPoint.participantNickname}</div>
                        <div style="font-size: 0.85em; color: #b87333;">${controlPoint.participantUnit}</div>
                        <div style="font-size: 0.85em; color: #b87333;">${controlPoint.categoryName}</div>
                      </div>`;
      circle.bindPopup(popup);
      this.addControlPointMarker(circle);

      const accuracyCircle = L.circle(coordinates, {
        weight: 1,
        opacity: 0.2,
        fillOpacity: 0.1,
        radius: Number(location.properties['accuracy']),
        pane: this.accuracyPaneName,
        interactive: false
      });
      this.addControlPointMarker(accuracyCircle);
    }
  }

  private readCenterCoordinates() {
    const initialCenter = this.map.getCenter();
    this.circleMarker = L.circleMarker(initialCenter, {
      radius: 1,
      color: 'black',
      fillColor: 'black',
      fillOpacity: 1,
      weight: 1,
      interactive: false
    }).addTo(this.map);

    this.updateCoordinates(initialCenter.lat, initialCenter.lng);

    this.map.on('move', () => {
      const newCenter = this.map.getCenter();
      this.circleMarker.setLatLng(newCenter);
      this.updateCoordinates(newCenter.lat, newCenter.lng);
    });
  }

  private updateCenterMarker(): void {
    if (this.circleMarker && this.map) {
      const center = this.map.getCenter();
      this.circleMarker.setLatLng(center);
      this.updateCoordinates(center.lat, center.lng);
    }
  }

  private updateCoordinates(lat: number, lng: number): void {
    if (this.coordinatesDisplay) {
      const zoom = this.map ? this.map.getZoom() : '';
      this.coordinatesDisplay.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} | Zoom: ${zoom}`;
    }
  }

  private addControlPointMarker(marker: L.Circle): void {
    marker.addTo(this.map);
    this.controlPointMarkers.push(marker);
  }

  private clearControlPointMarkers(): void {
    for (const marker of this.controlPointMarkers) {
      this.map.removeLayer(marker);
    }
    this.controlPointMarkers = [];
  }

  private updateAllowedCenterBounds(): void {
    if (!this.map || !this.originalBounds) return;

    try { this.map.invalidateSize(false); } catch (e) { /* ignore */ }

    const viewBounds = this.map.getBounds();
    const latSpan = viewBounds.getNorth() - viewBounds.getSouth();
    const lngSpan = viewBounds.getEast() - viewBounds.getWest();

    const allowed = new L.LatLngBounds(
      [this.originalBounds.getSouth() - latSpan / 2, this.originalBounds.getWest() - lngSpan / 2],
      [this.originalBounds.getNorth() + latSpan / 2, this.originalBounds.getEast() + lngSpan / 2]
    );

    this.map.setMaxBounds(allowed);
    (this.map as any).options.maxBoundsViscosity = 0.75;
  }

  setStations(stations: Station[]) {
    this.clearStations();
    this.addStations(stations);
  }

  private clearStations() {
    this.stationMarkers.forEach(marker => this.map.removeLayer(marker));
    this.stationMarkers = [];

    this.interactivePolygons.forEach(polygon => {
      if (this.map.hasLayer(polygon)) {
        this.map.removeLayer(polygon);
      }
    });
    this.interactivePolygons = [];
    this.openPopups = [];
  }

  private setupPopupAutoHide(): void {
    if (!this.map) return;

    this.map.on('click', (e: any) => {
      const target = e.originalEvent?.target as HTMLElement;
      if (!target || !target.closest('.leaflet-popup')) {
        this.closeAllPopups();
      }
    });

    this.map.on('dragstart', () => {
      this.closeAllPopups();
    });

    this.map.on('zoomstart', () => {
      this.closeAllPopups();
    });
  }

  private closeAllPopups(): void {
    this.openPopups.forEach(popup => {
      this.map.closePopup(popup);
    });
    this.openPopups = [];
  }

  toggleAccuracyCircles(): boolean {
    if (!this.map) return this.accuracyVisible;
    this.accuracyVisible = !this.accuracyVisible;
    const pane = this.map.getPane(this.accuracyPaneName);
    if (pane) {
      pane.style.display = this.accuracyVisible ? '' : 'none';
    }
    return this.accuracyVisible;
  }

  setTrackVisibility(visible: boolean): void {
    if (!this.map) return;
    this.trackVisible = visible;
    const pane = this.map.getPane(this.trackPaneName);
    if (pane) {
      pane.style.display = visible ? '' : 'none';
    }
  }

  displayGpsTrack(runId: string, segments: any[], nickname: string = ''): void {
    if (!this.map || !segments || segments.length === 0) return;

    this.clearGpsTrack(runId);

    const polylines: L.Polyline[] = [];
    const originalStyles: { color: string, weight: number }[] = [];

    for (const segment of segments) {
      const startPoint = segment.startPoint;
      const endPoint = segment.endPoint;
      const velocity = segment.velocity;

      const startLat = startPoint.coordinates[1];
      const startLng = startPoint.coordinates[0];
      const endLat = endPoint.coordinates[1];
      const endLng = endPoint.coordinates[0];

      const speedKmh = velocity.value;
      const segmentColor = this.getSpeedColor(speedKmh);
      const lineWeight = speedKmh < 1.0 ? 8 : 5;

      const polyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color: segmentColor,
        weight: lineWeight,
        opacity: 0.85,
        pane: this.trackPaneName
      }).addTo(this.map);

      const tooltipText = nickname ? `${nickname} | ${speedKmh.toFixed(1)} km/h` : `${speedKmh.toFixed(1)} km/h`;
      polyline.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'top'
      });

      polyline.on('click', () => {
        this.trackClicked.emit(runId);
      });

      polylines.push(polyline);
      originalStyles.push({ color: segmentColor, weight: lineWeight });
    }

    this.trackPolylines.set(runId, polylines);
    this.trackOriginalStyles.set(runId, originalStyles);
  }

  clearGpsTrack(runId: string): void {
    const polylines = this.trackPolylines.get(runId);
    if (polylines) {
      polylines.forEach(p => {
        if (this.map.hasLayer(p)) this.map.removeLayer(p);
      });
      this.trackPolylines.delete(runId);
      this.trackOriginalStyles.delete(runId);
    }
  }

  clearAllGpsTracks(): void {
    this.trackPolylines.forEach((polylines) => {
      polylines.forEach(p => {
        if (this.map.hasLayer(p)) this.map.removeLayer(p);
      });
    });
    this.trackPolylines.clear();
    this.trackOriginalStyles.clear();
  }

  hasTrack(runId: string): boolean {
    return this.trackPolylines.has(runId);
  }

  highlightTrack(runId: string): void {
    const polylines = this.trackPolylines.get(runId);
    if (!polylines) return;
    polylines.forEach(p => {
      p.setStyle({ color: 'white', weight: 8, opacity: 1 });
    });
  }

  unhighlightTrack(runId: string): void {
    const polylines = this.trackPolylines.get(runId);
    const styles = this.trackOriginalStyles.get(runId);
    if (!polylines || !styles) return;
    polylines.forEach((p, i) => {
      p.setStyle({ color: styles[i].color, weight: styles[i].weight, opacity: 0.85 });
    });
  }

  private getSpeedColor(speedKmh: number): string {
    const thresholds = [
      { speed: 0.0, color: '#0d47a1' },
      { speed: 2.0, color: '#1565c0' },
      { speed: 4.0, color: '#1976d2' },
      { speed: 5.0, color: '#1e88e5' },
      { speed: 5.5, color: '#039be5' },
      { speed: 6.0, color: '#00acc1' },
      { speed: 6.5, color: '#00bcd4' },
      { speed: 7.0, color: '#26a69a' },
      { speed: 7.5, color: '#66bb6a' },
      { speed: 8.0, color: '#9ccc65' },
      { speed: 8.5, color: '#c0ca33' },
      { speed: 9.0, color: '#d4e157' },
      { speed: 9.5, color: '#ffeb3b' },
      { speed: 10.0, color: '#ffca28' },
      { speed: 10.5, color: '#ffa726' },
      { speed: 11.0, color: '#ff9800' },
      { speed: 12.0, color: '#ff7043' },
      { speed: 13.0, color: '#f4511e' },
      { speed: 14.0, color: '#e53935' },
      { speed: 15.0, color: '#d32f2f' },
      { speed: 17.0, color: '#c62828' },
      { speed: 20.0, color: '#b71c1c' },
      { speed: 25.0, color: '#880e4f' },
      { speed: 30.0, color: '#6a1b9a' },
      { speed: 35.0, color: '#4a148c' },
      { speed: 40.0, color: '#7b1fa2' },
      { speed: 50, color: '#3e2723' },
      { speed: 60, color: '#4e342e' },
      { speed: 80, color: '#5d4037' },
      { speed: 100, color: '#6d4c41' },
      { speed: 120, color: '#795548' },
      { speed: 150, color: '#8d6e63' }
    ];

    for (let i = 0; i < thresholds.length - 1; i++) {
      if (speedKmh >= thresholds[i].speed && speedKmh < thresholds[i + 1].speed) {
        const t = (speedKmh - thresholds[i].speed) / (thresholds[i + 1].speed - thresholds[i].speed);
        return this.interpolateColor(thresholds[i].color, thresholds[i + 1].color, t);
      }
    }

    if (speedKmh >= thresholds[thresholds.length - 1].speed) {
      return thresholds[thresholds.length - 1].color;
    }
    return thresholds[0].color;
  }

  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
}
