import { Component, AfterViewInit, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
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
  template: `
    <div id="map" style="height: 500px; position: relative;"></div>
  `,
})
export class ParticipantMapComponent implements OnInit, OnChanges {
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
  private useIndexedDb: boolean = true;

  constructor(
    private participantSendService: ParticipantSendService,
    private tileDb: TileDbService
  ) {}

  ngOnInit(): void {
    // z kazdym odswiezeniem probuje to inicjalizowac co wywoluje blad
    console.log('dodo init map', this.backgroundMapId)
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['backgroundMapId']) {
      this.switchBaseMap(this.backgroundMapId);
    }


    if (this.stationsToShow != undefined && changes['stationsToShow']) {
      this.addStations(this.stationsToShow)
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
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      dragging: true,
      zoomControl: false,
    });
  }

  private async switchBaseMap(mapId: string | undefined | null) {
      mapId = mapId || this.defaultMapId;
      this.minZoom = this.minZoom || this.defaultMinZoom;
      this.maxZoom = this.maxZoom || this.defaultMaxZoom;
      this.northEast = this.northEast || this.defaultNorthEast;
      this.southWest = this.southWest || this.defaultSouthWest;

      // Usuń poprzednią warstwę jeśli istnieje
      if (this.currentTileLayer && this.map.hasLayer(this.currentTileLayer)) {
          this.map.removeLayer(this.currentTileLayer);
      }

      if (this.useIndexedDb) {
          // Użyj warstwy z IndexedDB
          this.currentTileLayer = idbTileLayer(this.tileDb, mapId, {
              minZoom: this.minZoom,
              maxZoom: this.maxZoom
          });
      } else {
          // Fallback do assets jako backup
          const url = `assets/maps/${mapId}/{z}/{x}/{y}.png`;
          this.currentTileLayer = L.tileLayer(url, {
              minZoom: this.minZoom,
              maxZoom: this.maxZoom,
          });
      }

      this.currentTileLayer.addTo(this.map);
  
      let bounds = L.latLngBounds(L.latLng(this.southWest?.[0], this.southWest?.[1]), L.latLng(this.northEast?.[0], this.northEast?.[1]));
      
      this.map.setMinZoom(this.minZoom);
      this.map.setMaxZoom(this.maxZoom);
      this.map.setMaxBounds(bounds);
      this.map.panTo(bounds.getCenter());
      this.map.setZoom(this.minZoom);
    }

  private addStations(stations: Station[]) {
       for (const station of stations) {
        const lat = station.geometry.coordinates[1]
        const lng = station.geometry.coordinates[0]

        const coordinates = L.latLng(lat, lng)

        const circle = L.circle(coordinates, {
          color: '#ff2e00',
          radius: 1,
          interactive: false,
        })

        circle.addTo(this.map)

        const interactiveCircle = L.circle(coordinates, {
          color: 'transparent',
          fillColor: 'transparent',
          radius: 50,
          interactive: true
        })

        const popup = `<div style="text-align: center;">
                    <h2>${station.properties['name']}</h2>
                  </div>
                  <span>${station.properties['note']}</span>`

        interactiveCircle.bindPopup(popup)
        interactiveCircle.addTo(this.map)
    }
  }
}
