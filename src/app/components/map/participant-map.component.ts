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
      setTimeout(() => {
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
      zoomControl: true,
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
      this.centerMapProperly();

      if (this.stationsToShow && this.stationsToShow.length > 0) {
        this.addStations(this.stationsToShow);
      }
    });

    setTimeout(() => {
      this.centerMapProperly();
    }, 100);
  }

  private async switchBaseMap(mapId: string | undefined | null) {
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
        this.centerMapProperly();
      });

      setTimeout(() => {
        this.centerMapProperly();
      }, 500);
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
    
    setTimeout(() => {
      this.centerMapProperly();
    }, 200);
  }

  public resetMapView(): void {
    this.closeAllPopups(); 
    this.centerMapProperly(); 
  }

  public hidePopups(): void {
    this.closeAllPopups();
  }

  private centerMapProperly(): void {
    if (this.map && this.northEast && this.southWest) {
      const bounds = L.latLngBounds(
        L.latLng(this.southWest[0], this.southWest[1]),
        L.latLng(this.northEast[0], this.northEast[1])
      );
      
      this.map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: this.minZoom || this.defaultMinZoom
      });
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

  ngOnDestroy(): void {
    if (this.hidePopupsTimeout) {
      clearTimeout(this.hidePopupsTimeout);
    }
    
    if (this.documentClickListener) {
      document.removeEventListener('click', this.documentClickListener);
    }
    
    this.closeAllPopups();
    
    if (this.map) {
      this.map.remove();
    }
  }
}
