import { Component, AfterViewInit, Input, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import L from 'leaflet';
import { Station } from '../../services/response/Station';
import { ParticipantSendService as ParticipantSendService } from '../../services/participant-send-service';
import { TileDbService, MapMetadata } from '../../services/tile-db.service';
import { idbTileLayer } from '../../shared/tile-layer-indexeddb';

@Component({
  selector: 'participant-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participant-map.component.html',
  styleUrls: ['./participant-map.component.css']
})
export class ParticipantMapComponent implements OnInit, OnChanges, OnDestroy {
  defaultMapId: string = '3857_mala_2'
  defaultMinZoom = 15;
  defaultMaxZoom = 15;
  defaultNorthEast: [number, number] = [51.96086, 15.52418];
  defaultSouthWest: [number, number] = [51.94511, 15.49677]

  @Input()
  backgroundMapId: string | undefined | null;

  @Input()
  minZoom: number | undefined;

  @Input()
  maxZoom: number | undefined;

  @Input()
  northEast: [number, number] | undefined;

  @Input()
  southWest: [number, number] | undefined;

  @Input()
  stationsToShow: Station[] = []

  private map!: L.Map;
  private currentTileLayer?: L.TileLayer;
  private openPopups: L.Popup[] = [];
  private documentClickListener?: (event: Event) => void;
  private hidePopupsTimeout?: number;
  private centerMapTimeout?: number;
  private loadMapTimeout?: number;
  private addStationsTimeout?: number;
  private destroyed = false;
  private scaleControl?: L.Control.Scale;
  private gpsTrackPolyline?: L.Polyline;
  private gpsStationaryMarkers: L.CircleMarker[] = [];
  private gpsSegments: Array<{polyline: L.Polyline, originalColor: string}> = [];
  private selectedSegment?: {polyline: L.Polyline, originalColor: string};

  constructor(
    private participantSendService: ParticipantSendService,
    private tileDb: TileDbService
  ) {}

  ngOnInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Sprawdź czy mapa została już zainicjalizowana
    if (!this.map) {
      return;
    }

    if (changes['backgroundMapId']) {
      this.switchBaseMap(this.backgroundMapId);
    }

    if (this.stationsToShow != undefined && changes['stationsToShow']) {
      this.addStations(this.stationsToShow)
    }

    if (changes['northEast'] || changes['southWest'] || changes['minZoom'] || changes['maxZoom']) {
      if (this.centerMapTimeout) {
        clearTimeout(this.centerMapTimeout);
      }
      this.centerMapTimeout = window.setTimeout(() => {
        if (this.destroyed) return;
        this.centerMapProperly();
      }, 100);
    }
  }

  private initMap(): void {
    this.minZoom = this.minZoom || this.defaultMinZoom;
    this.maxZoom = this.maxZoom || this.defaultMaxZoom;
    this.northEast = this.northEast || this.defaultNorthEast;
    this.southWest = this.southWest || this.defaultSouthWest;

    const bounds: L.LatLngBounds = new L.LatLngBounds(this.southWest, this.northEast);

     this.map = L.map('map', {
      center: bounds.getCenter(),
      zoom: this.minZoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      dragging: true,
      zoomControl: false,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 60
    });

    this.setupPopupAutoHide();

    this.map.whenReady(() => {
      if (this.destroyed) return;
      this.centerMapProperly();

      if (this.stationsToShow && this.stationsToShow.length > 0) {
        this.addStations(this.stationsToShow);
      }
    });

    if (this.centerMapTimeout) {
      clearTimeout(this.centerMapTimeout);
    }
    this.centerMapTimeout = window.setTimeout(() => {
      if (this.destroyed) return;
      this.centerMapProperly();
    }, 100);
  }

  private async switchBaseMap(mapId: string | undefined | null) {
      if (this.scaleControl) {
        this.map.removeControl(this.scaleControl);
        this.scaleControl = undefined;
      }

      if (!mapId) {
        if (this.currentTileLayer && this.map.hasLayer(this.currentTileLayer)) {
          this.map.removeLayer(this.currentTileLayer);
        }
        return;
      }

      mapId = mapId || this.defaultMapId;
      this.minZoom = this.minZoom || this.defaultMinZoom;
      this.maxZoom = this.maxZoom || this.defaultMaxZoom;
      this.northEast = this.northEast || this.defaultNorthEast;
      this.southWest = this.southWest || this.defaultSouthWest;

      if (this.currentTileLayer && this.map.hasLayer(this.currentTileLayer)) {
          this.map.removeLayer(this.currentTileLayer);
      }

      this.currentTileLayer = idbTileLayer(this.tileDb, mapId, {
          minZoom: this.minZoom,
          maxZoom: this.maxZoom
      });

      this.currentTileLayer.addTo(this.map);

      this.map.setMinZoom(this.minZoom);
      this.map.setMaxZoom(this.maxZoom);

      this.currentTileLayer.once('load', () => {
        if (this.destroyed) return;
        this.centerMapProperly();
      });

      if (this.loadMapTimeout) {
        clearTimeout(this.loadMapTimeout);
      }
      this.loadMapTimeout = window.setTimeout(() => {
        if (this.destroyed) return;
        this.centerMapProperly();
      }, 500);

      this.scaleControl = L.control.scale({
        position: 'bottomleft',
        maxWidth: 100,
        metric: true,
        imperial: false,
        updateWhenIdle: false
      });
      this.scaleControl.addTo(this.map);
    }

  private addStations(stations: Station[]) {
    if (!this.map || !stations || stations.length === 0) {
      return;
    }

    for (const station of stations) {
        const lat = station.geometry.coordinates[1]
        const lng = station.geometry.coordinates[0]

        const coordinates = L.latLng(lat, lng)

        const circle = L.circle(coordinates, {
          color: '#ff2e00',
          fillColor: '#ff2e00',
          fillOpacity: 1,
          radius: 1,
          interactive: false,
        })

        circle.addTo(this.map)

        const interactiveCircle = L.circle(coordinates, {
          color: 'transparent',
          fillColor: 'transparent',
          radius: 30,
          interactive: true
        })

        const popup = `<div style="text-align: center;">
                    <h2>${station.properties['name']}</h2>
                  </div>
                  <span>${station.properties['note']}</span>`

        const leafletPopup = L.popup().setContent(popup);
        interactiveCircle.bindPopup(leafletPopup);

        interactiveCircle.on('popupopen', (e) => {
          const openedPopup = e.popup;
          if (!this.openPopups.includes(openedPopup)) {
            this.openPopups.push(openedPopup);
          }
        });

        interactiveCircle.on('popupclose', (e) => {
          const closedPopup = e.popup;
          const index = this.openPopups.indexOf(closedPopup);
          if (index > -1) {
            this.openPopups.splice(index, 1);
          }
        });

        interactiveCircle.addTo(this.map)
    }

    if (this.addStationsTimeout) {
      clearTimeout(this.addStationsTimeout);
    }
    this.addStationsTimeout = window.setTimeout(() => {
      if (this.destroyed) return;
      this.centerMapProperly();
    }, 200);
  }

  public resetMapView(): void {
    if (this.destroyed) return;
    this.closeAllPopups();
    this.centerMapProperly();
  }

  public hidePopups(): void {
    this.closeAllPopups();
  }

  private centerMapProperly(): void {
    if (this.destroyed || !this.map || !this.northEast || !this.southWest) {
      return;
    }

    try {
      const bounds = L.latLngBounds(
        L.latLng(this.southWest[0], this.southWest[1]),
        L.latLng(this.northEast[0], this.northEast[1])
      );

      this.map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: this.minZoom || this.defaultMinZoom
      });
    } catch (error) {
      console.error('Błąd podczas centrowania mapy:', error);
    }
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
      this.closePopupsWithDelay(50);
    });

    this.map.on('zoomstart', () => {
      this.closePopupsWithDelay(50);
    });

    this.map.on('touchstart', (e: any) => {
      const target = e.originalEvent?.target as HTMLElement;
      if (!target || !target.closest('.leaflet-popup')) {
        this.closeAllPopups();
      }
    });

    this.map.on('wheel', () => {
      this.closeAllPopups();
    });

    this.documentClickListener = (event: Event) => {
      const mapElement = document.getElementById('map');
      if (mapElement && !mapElement.contains(event.target as Node)) {
        this.closeAllPopups();
      }
    };
    document.addEventListener('click', this.documentClickListener);
  }

  private closeAllPopups(): void {
    this.openPopups.forEach(popup => {
      this.map.closePopup(popup);
    });
    this.openPopups = [];
  }

  private closePopupsWithDelay(delay: number = 100): void {
    if (this.hidePopupsTimeout) {
      clearTimeout(this.hidePopupsTimeout);
    }

    this.hidePopupsTimeout = window.setTimeout(() => {
      this.closeAllPopups();
    }, delay);
  }

  displayGpsTrack(segments: any[], stats: any): void {
    if (!this.map || !segments || segments.length === 0) {
      console.warn('[ParticipantMap] Cannot display GPS track - map not initialized or no segments');
      return;
    }

    console.log('[ParticipantMap] Displaying GPS track with', segments.length, 'segments');

    // Usuń poprzednią trasę jeśli istnieje
    this.clearGpsTrack();

    // Renderuj segmenty z gradientem kolorów
    const allBounds: L.LatLng[] = [];

    // Backend zwraca segmenty z startPoint i endPoint jako GeometryView (GeoJSON)
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // GeometryView ma coordinates w formacie [lng, lat] (GeoJSON standard)
      const startPoint = segment.startPoint;
      const endPoint = segment.endPoint;
      const velocity = segment.velocity;

      // Konwertuj z GeoJSON [lng, lat] na Leaflet [lat, lng]
      const startLat = startPoint.coordinates[1];
      const startLng = startPoint.coordinates[0];
      const endLat = endPoint.coordinates[1];
      const endLng = endPoint.coordinates[0];

      // Pobierz kolor segmentu bazując na prędkości
      const segmentColor = this.getColorForVelocity(velocity);

      // Backend zwraca prędkość jako Velocity object
      const speedKmh = velocity.value;

      // Grubsza linia dla postojów (< 1 km/h)
      const isStationary = speedKmh < 1.0;
      const lineWeight = isStationary ? 8 : 5;

      const polyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color: segmentColor,
        weight: lineWeight,
        opacity: 0.85,
        className: 'gps-segment'
      }).addTo(this.map);

      // Zapisz segment z oryginalnym kolorem
      this.gpsSegments.push({ polyline: polyline, originalColor: segmentColor });

      // Tooltip z prędkością przy najechaniu na segment
      polyline.bindTooltip(`${speedKmh.toFixed(1)} km/h`, {
        permanent: false,
        direction: 'top'
      });

      // Obsługa kliknięcia na segment
      polyline.on('click', () => {
        this.onSegmentClick(polyline, segmentColor);
      });

      // Dodaj punkty do boundów
      allBounds.push(L.latLng(startLat, startLng));
      allBounds.push(L.latLng(endLat, endLng));

      if (!this.gpsTrackPolyline) {
        this.gpsTrackPolyline = polyline;
      }
    }

    // Dopasuj widok mapy do trasy
    if (allBounds.length > 0) {
      const bounds = L.latLngBounds(allBounds);
      this.map.fitBounds(bounds, {
        padding: [50, 50]
      });
    }

    // Wyświetl statystyki jeśli dostępne
    if (stats) {
      this.displayGpsStats(stats);
    }

    console.log('[ParticipantMap] GPS track displayed successfully');
  }

  /**
   * Mapuje obiekt Velocity na kolor gradientowy.
   * Backend zawsze zwraca prędkość w km/h.
   *
   * Paleta zoptymalizowana dla BIEGÓW DŁUGODYSTANSOWYCH (5-11 km/h):
   * Niebieski (5-6 km/h) → Cyan (6-7 km/h) → Zielony (7-9 km/h) → Żółty (9-10 km/h) → Pomarańczowy (10-11 km/h)
   */
  private getColorForVelocity(velocity: any): string {
    // Backend zawsze zwraca km/h
    return this.getSpeedColor(velocity.value);
  }

  /**
   * Gradient kolorów dla wszystkich prędkości w km/h.
   * Optymalizacja dla BIEGÓW DŁUGODYSTANSOWYCH: zakres 5-11 km/h wykorzystuje PEŁNĄ paletę kolorów.
   */
  private getSpeedColor(speedKmh: number): string {
    const thresholds = [
      // Postój i bardzo wolny marsz (0-4 km/h) - ciemnoniebieski
      { speed: 0.0, color: '#0d47a1' },    // Bardzo ciemny niebieski (postój)
      { speed: 2.0, color: '#1565c0' },    // Ciemny niebieski (bardzo wolny marsz)
      { speed: 4.0, color: '#1976d2' },    // Niebieski (wolny marsz)

      // Biegi długodystansowe - wolne tempo (5-7 km/h) - niebieski → cyan → zielony
      { speed: 5.0, color: '#1e88e5' },    // Jasny niebieski (bardzo wolny bieg ~5 km/h)
      { speed: 5.5, color: '#039be5' },    // Jaśniejszy niebieski (~5.5 km/h)
      { speed: 6.0, color: '#00acc1' },    // Cyan (wolny bieg ~6 km/h)
      { speed: 6.5, color: '#00bcd4' },    // Jasny cyan (~6.5 km/h)
      { speed: 7.0, color: '#26a69a' },    // Teal (średnie tempo ultry ~7 km/h)

      // Biegi długodystansowe - średnie tempo (7.5-9 km/h) - zielony → żółtozielony
      { speed: 7.5, color: '#66bb6a' },    // Zielony (~7.5 km/h)
      { speed: 8.0, color: '#9ccc65' },    // Jasnozielony (dobre tempo ~8 km/h)
      { speed: 8.5, color: '#c0ca33' },    // Żółtozielony (~8.5 km/h)
      { speed: 9.0, color: '#d4e157' },    // Limonkowy (szybkie tempo ~9 km/h)

      // Biegi długodystansowe - szybkie tempo (9.5-11 km/h) - żółty → pomarańczowy
      { speed: 9.5, color: '#ffeb3b' },    // Żółty (~9.5 km/h)
      { speed: 10.0, color: '#ffca28' },   // Jasny pomarańczowy (bardzo szybko ~10 km/h)
      { speed: 10.5, color: '#ffa726' },   // Pomarańczowy (~10.5 km/h)
      { speed: 11.0, color: '#ff9800' },   // Ciemny pomarańczowy (~11 km/h)

      // Krótkie dystanse / sprint (11-15 km/h) - pomarańczowy → czerwony
      { speed: 12.0, color: '#ff7043' },   // Pomarańczowo-czerwony (szybki bieg ~12 km/h)
      { speed: 13.0, color: '#f4511e' },   // Czerwono-pomarańczowy (~13 km/h)
      { speed: 14.0, color: '#e53935' },   // Czerwony (~14 km/h)
      { speed: 15.0, color: '#d32f2f' },   // Ciemny czerwony (~15 km/h)

      // Bardzo szybkie bieganie / sprint (15-20 km/h) - ciemnoczerwony
      { speed: 17.0, color: '#c62828' },   // Bardzo ciemny czerwony
      { speed: 20.0, color: '#b71c1c' },   // Najciemniejszy czerwony

      // Rower wolny (20-30 km/h) - bordowy → fiolet
      { speed: 25.0, color: '#880e4f' },   // Bordowy
      { speed: 30.0, color: '#6a1b9a' },   // Fioletowy

      // Rower szybki (30-40 km/h) - fiolet → różowy
      { speed: 35.0, color: '#4a148c' },   // Ciemny fiolet
      { speed: 40.0, color: '#7b1fa2' },   // Różowy

      // Samochód (40-120+ km/h) - ciemne brązy
      { speed: 50, color: '#3e2723' },     // Bardzo ciemny brąz
      { speed: 60, color: '#4e342e' },     // Ciemny brąz
      { speed: 80, color: '#5d4037' },     // Brąz
      { speed: 100, color: '#6d4c41' },    // Jasny brąz
      { speed: 120, color: '#795548' },    // Jaśniejszy brąz
      { speed: 150, color: '#8d6e63' }     // Najjaśniejszy brąz
    ];

    return this.interpolateFromThresholds(speedKmh, thresholds);
  }

  /**
   * Pomocnicza funkcja do interpolacji z tablicy progów.
   */
  private interpolateFromThresholds(value: number, thresholds: Array<{speed: number, color: string}>): string {
    // Znajdź odpowiedni przedział
    for (let i = 0; i < thresholds.length - 1; i++) {
      if (value >= thresholds[i].speed && value < thresholds[i + 1].speed) {
        const t = (value - thresholds[i].speed) / (thresholds[i + 1].speed - thresholds[i].speed);
        return this.interpolateColor(thresholds[i].color, thresholds[i + 1].color, t);
      }
    }

    // Jeśli przekracza maksymalną wartość, zwróć ostatni kolor
    if (value >= thresholds[thresholds.length - 1].speed) {
      return thresholds[thresholds.length - 1].color;
    }

    // W przeciwnym razie zwróć pierwszy kolor
    return thresholds[0].color;
  }

  /**
   * Interpoluje między dwoma kolorami hex.
   */
  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));

    return this.rgbToHex(r, g, b);
  }

  private hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private displayGpsStats(stats: any): void {
    // Konwersja Distance na kilometry
    const totalDistanceKm = stats.totalDistance.unit === 'KILOMETERS'
      ? stats.totalDistance.value
      : stats.totalDistance.value / 1000;

    // Konwersja Duration na milisekundy
    const totalDurationMs = stats.totalDuration.unit === 'MILLISECONDS'
      ? stats.totalDuration.value
      : stats.totalDuration.unit === 'SECONDS'
      ? stats.totalDuration.value * 1000
      : stats.totalDuration.unit === 'MINUTES'
      ? stats.totalDuration.value * 60000
      : stats.totalDuration.value * 3600000;

    // Konwersja Velocity na km/h
    const avgSpeedKmh = stats.averageSpeed.unit === 'KILOMETERS_PER_HOUR'
      ? stats.averageSpeed.value
      : stats.averageSpeed.value * 3.6;

    const statsHtml = `
      <div style="background: rgba(40, 60, 50, 0.95); padding: 10px 12px; border-radius: 8px; border: 2px solid #B87333; color: #E8E8E8; font-family: monospace; min-width: 180px; max-width: 220px; margin-top: 80px;">
        <div style="font-weight: bold; margin-bottom: 6px; color: #B87333; font-size: 13px;"><i class="pi pi-chart-bar"></i> Statystyki</div>
        <div style="margin: 3px 0; font-size: 11px;"><i class="pi pi-map"></i> ${totalDistanceKm.toFixed(2)} km</div>
        <div style="margin: 3px 0; font-size: 11px;"><i class="pi pi-clock"></i> ${this.formatDuration(totalDurationMs)}</div>
        <div style="margin: 3px 0; font-size: 11px;"><i class="pi pi-gauge"></i> ${avgSpeedKmh.toFixed(1)} km/h</div>
      </div>
    `;

    const StatsControl = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div', 'gps-stats-control');
        div.innerHTML = statsHtml;
        // Zapobiegnij propagacji eventów do mapy
        L.DomEvent.disableClickPropagation(div);
        return div;
      }
    });

    new StatsControl({ position: 'topleft' }).addTo(this.map);
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private onSegmentClick(clickedPolyline: L.Polyline, originalColor: string): void {
    // Przywróć kolor poprzednio zaznaczonego segmentu
    if (this.selectedSegment) {
      this.selectedSegment.polyline.setStyle({
        color: this.selectedSegment.originalColor,
        weight: 5,
        opacity: 0.85
      });
    }

    // Jeśli kliknięto ten sam segment, odznacz go
    if (this.selectedSegment && this.selectedSegment.polyline === clickedPolyline) {
      this.selectedSegment = undefined;
      return;
    }

    // Zaznacz nowy segment kolorem białym (wyróżniającym się)
    clickedPolyline.setStyle({
      color: '#FFFFFF',
      weight: 7,
      opacity: 1
    });

    // Zapisz referencję do zaznaczonego segmentu
    this.selectedSegment = { polyline: clickedPolyline, originalColor: originalColor };
  }

  private clearGpsTrack(): void {
    // Wyczyść wszystkie segmenty
    this.gpsSegments.forEach(segment => {
      if (this.map.hasLayer(segment.polyline)) {
        this.map.removeLayer(segment.polyline);
      }
    });
    this.gpsSegments = [];
    this.selectedSegment = undefined;

    if (this.gpsTrackPolyline) {
      this.map.removeLayer(this.gpsTrackPolyline);
      this.gpsTrackPolyline = undefined;
    }

    this.gpsStationaryMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.gpsStationaryMarkers = [];
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.hidePopupsTimeout) {
      clearTimeout(this.hidePopupsTimeout);
    }

    if (this.centerMapTimeout) {
      clearTimeout(this.centerMapTimeout);
    }

    if (this.loadMapTimeout) {
      clearTimeout(this.loadMapTimeout);
    }

    if (this.addStationsTimeout) {
      clearTimeout(this.addStationsTimeout);
    }

    if (this.documentClickListener) {
      document.removeEventListener('click', this.documentClickListener);
    }

    this.closeAllPopups();

    // Wyczyść GPS track
    this.clearGpsTrack();

    if (this.currentTileLayer) {
      this.currentTileLayer.off();
      this.currentTileLayer = undefined;
    }

    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null as any;
    }
  }
}
