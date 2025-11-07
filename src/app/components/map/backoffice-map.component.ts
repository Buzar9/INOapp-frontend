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
    <div id="map" style="height: 500px; width:900px; position: relative;"></div>
    <!-- dodo popracowac nad stylem -->
    <div *ngIf="showCenterCoordinates" id="coordinates" style="position: absolute; top: 20px; right: 200px; background-color: black; padding: 5px; border-radius: 3px; font-size: 0.8em; z-index: 1000;"></div>
  `,
  styles: [``],
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
  @Input() dodoControlPoints: ControlPoint[] = [];
  @Input() showCenterCoordinates: boolean = false;
  @Input() stationsToShow: Station[] = [];
  @Input() useIndexedDb: boolean = true; // NOWE: przełącznik źródła kafelków (IndexedDB vs assets)

  @Output() pickedCoordinates = new EventEmitter<Coordinates>();

  private controlPointMarkers: L.Circle[] = [];
  private map!: L.Map;
  private currentTileLayer!: L.TileLayer;
  private circleMarker!: L.CircleMarker;
  private coordinatesDisplay!: HTMLElement;
  private mapMoveSubscription!: Subscription;
  private stationPaneName = 'stationPane';
  private accuracyPaneName = 'accuracyPane';
  private stationMarkers: L.Layer[] = [];
  
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
      })
      .catch(err => {
        console.error('BackofficeMapComponent: błąd podczas inicjalizacji mapy', err);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
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
      // Remove our listeners
      this.map.off('move');
      this.map.off('zoomend');
      this.map.off('moveend');
      this.map.remove();
    }
  }

  emitCurrentCenter() {
    const center = this.map.getCenter();
    this.pickedCoordinates.emit({ lat: center.lat, lng: center.lng });
  }

  private async initMap(): Promise<void> {
    this.minZoom = this.minZoom ?? this.defaultMinZoom;
    this.maxZoom = this.maxZoom ?? this.defaultMaxZoom;
    this.northEast = this.northEast ?? this.defaultNorthEast;
    this.southWest = this.southWest ?? this.defaultSouthWest;

    const usedMapId = this.backgroundMapId || this.defaultMapId;

    // Jeśli używamy IndexedDB – spróbuj pobrać metadane (ustawi min/max zoom i bounds)
    if (this.useIndexedDb && usedMapId) {
      this.meta = await this.tileDb.getMapMetadata(usedMapId);
      if (this.meta) {
        this.minZoom = this.meta.minZoom ?? this.minZoom;
        this.maxZoom = this.meta.maxZoom ?? this.maxZoom;
        if (!this.northEast || !this.southWest) {
          if (this.meta.bounds) {
            this.southWest = [this.meta.bounds.south, this.meta.bounds.west];
            this.northEast = [this.meta.bounds.north, this.meta.bounds.east];
          }
        }
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
      zoomControl: true,
    });

    await this.addBaseLayer(usedMapId!);

    this.map.createPane(this.stationPaneName);
    this.map.getPane(this.stationPaneName)!.style.zIndex = '600';

    this.map.createPane(this.accuracyPaneName);
    this.map.getPane(this.accuracyPaneName)!.style.zIndex = '200';

    // compute and apply allowed center bounds after the base layer has been added and the map has a size
    this.updateAllowedCenterBounds();

    // when user zooms or window resizes, recompute allowed center bounds so padding matches viewport
    this.map.on('zoomend', () => this.updateAllowedCenterBounds());
    // moveend can also occur after programmatic pans/zooms; recompute then as well
    this.map.on('moveend', () => this.updateAllowedCenterBounds());
    this.resizeListener = () => this.updateAllowedCenterBounds();
    window.addEventListener('resize', this.resizeListener);
  }

  private async switchBaseMap(mapId: string | undefined | null) {
    mapId = mapId || this.defaultMapId;

    // Jeśli IndexedDB – odczytaj metadane i skoryguj zoom/bounds jeśli brak w Inputach
    if (this.useIndexedDb && mapId) {
      this.meta = await this.tileDb.getMapMetadata(mapId);
      if (this.meta) {
        this.minZoom = this.meta.minZoom ?? this.minZoom ?? this.defaultMinZoom;
        this.maxZoom = this.meta.maxZoom ?? this.maxZoom ?? this.defaultMaxZoom;
        if (!this.northEast || !this.southWest) {
          if (this.meta.bounds) {
            this.southWest = [this.meta.bounds.south, this.meta.bounds.west];
            this.northEast = [this.meta.bounds.north, this.meta.bounds.east];
          } else {
            this.northEast = this.northEast ?? this.defaultNorthEast;
            this.southWest = this.southWest ?? this.defaultSouthWest;
          }
        }
      }
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
      // update original logical bounds and recompute allowed center bounds
      this.originalBounds = bounds;
      this.updateAllowedCenterBounds();
      this.map.panTo(bounds.getCenter());
    }
    if (this.minZoom != null) {
      this.map.setZoom(this.minZoom);
    }
  }

  private async addBaseLayer(mapId: string) {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    if (this.useIndexedDb) {
      this.currentTileLayer = idbTileLayer(this.tileDb, mapId, {
        minZoom: this.minZoom!,
        maxZoom: this.maxZoom!,
        tileSize: 256, // opcjonalnie: this.meta?.tileSize || 256
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

  // ---- Twoje funkcje do warstw i UI ----

  private addStations(stations: Station[]) {
    for (const station of stations) {
      const lat = station.geometry.coordinates[1];
      const lng = station.geometry.coordinates[0];
      const coordinates = L.latLng(lat, lng);

      const circle = L.circle(coordinates, {
        color: 'yellow',
        radius: 1,
        pane: this.stationPaneName
      });

      const popup = `<div style="text-align: center;">
                        <h2>${station.properties['name']}</h2>
                      </div>
                      <span>${station.properties['note']}</span>`;
      circle.bindPopup(popup);
      circle.addTo(this.map);
      this.stationMarkers.push(circle);

      const accuracyCircle = L.circle(coordinates, {
        color: 'yellow',
        weight: 1,
        opacity: 0.2,
        fillColor: 'yellow',
        fillOpacity: 0.1,
        radius: Number(station.properties['accuracy']),
        pane: this.accuracyPaneName
      });

      accuracyCircle.addTo(this.map);
      this.stationMarkers.push(accuracyCircle);
    }
  }

  private addGeoViewDodo(controlPoints: ControlPoint[]) {
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

  private updateCoordinates(lat: number, lng: number): void {
    if (this.coordinatesDisplay) {
      this.coordinatesDisplay.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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

  /**
   * Compute and set the allowed bounds for the map center.
   * We want the center to be able to reach the actual edges of the logical map bounds.
   * To achieve that we extend the logical bounds by half the current viewport size
   * (so placing center on the edge will still show the map area inside the viewport).
   */
  private updateAllowedCenterBounds(): void {
    if (!this.map || !this.originalBounds) return;

    // ensure leaflet knows current size
    try { this.map.invalidateSize(false); } catch (e) { /* ignore */ }

    const viewBounds = this.map.getBounds();
    const latSpan = viewBounds.getNorth() - viewBounds.getSouth();
    const lngSpan = viewBounds.getEast() - viewBounds.getWest();

    const allowed = new L.LatLngBounds(
      [this.originalBounds.getSouth() - latSpan / 2, this.originalBounds.getWest() - lngSpan / 2],
      [this.originalBounds.getNorth() + latSpan / 2, this.originalBounds.getEast() + lngSpan / 2]
    );

    // Apply allowed center bounds and set a soft viscosity so it's not too abrupt
    this.map.setMaxBounds(allowed);
    // adjust viscosity to be flexible but prevent getting totally lost
    // (0 = no resistance, 1 = full elastic stop)
    (this.map as any).options.maxBoundsViscosity = 0.75;
  }

  setStations(stations: Station[]) {
    this.clearStations();
    this.addStations(stations);
  }

  private clearStations() {
    this.stationMarkers.forEach(marker => this.map.removeLayer(marker));
    this.stationMarkers = [];
  }
}