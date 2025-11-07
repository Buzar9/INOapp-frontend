import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import L, { control, icon } from 'leaflet';
import { Subscription } from 'rxjs';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { Station } from '../../services/response/Station';
import { ParticipantSendService } from '../../services/participant-send-service';
import { Route } from '../../services/response/Route';
import { ControlPoint } from '../../services/response/RaceResults';
import { GeoView } from '../../services/response/GeoView';
import { Output, EventEmitter } from '@angular/core';
import { Coordinates } from '../model/Coordinates';

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
  defaultMapId: string = '3857_mala_2'
  defaultMinZoom = 15;
  defaultMaxZoom = 15;
  defaultNorthEast: [number, number] = [51.96086, 15.52418];
  defaultSouthWest: [number, number] = [51.94511, 15.49677]

  
  @Input()
  backgroundMapId: string | undefined | null = this.defaultMapId;

  @Input()
  minZoom: number | undefined = this.defaultMinZoom;

  @Input()
  maxZoom: number | undefined = this.defaultMaxZoom;

  // dodo popracuj nad defaultami
  @Input()
  northEast: [number, number] | undefined;

  @Input()
  southWest: [number, number] | undefined;

  @Input()
  dodoControlPoints: ControlPoint[] = [];

  @Input()
  showCenterCoordinates: boolean = false;

  @Input()
  stationsToShow: Station[] = [];

  @Output()
  pickedCoordinates = new EventEmitter<Coordinates>();

  private controlPointMarkers: L.Circle[] = [];

  private map!: L.Map;
  private currentTileLayer!: L.TileLayer
  private circleMarker!: L.CircleMarker;
  private coordinatesDisplay!: HTMLElement;
  private mapMoveSubscription!: Subscription;
  private stationPaneName = 'stationPane'
  private accuracyPaneName = 'accuracyPane'
  private stationMarkers: L.Layer[] = [];

  constructor(){}

  ngAfterViewInit(): void {
    // z kazdym odswiezeniem probuje to inicjalizowac co wywoluje blad
    this.initMap();

    // this.addStations();
    this.coordinatesDisplay = document.getElementById('coordinates')!;

    if(this.showCenterCoordinates) {
     this.readCenterCoordinates();
    }
  }

  // dodo zrobic z komponentu mapy bardziej uniwersalny komponent
  ngOnChanges(changes: SimpleChanges): void {
    // Sprawdzamy, czy właściwość 'dataObject' uległa zmianie

    if (this.dodoControlPoints != null) {
      this.clearControlPointMarkers()
      this.addGeoViewDodo(this.dodoControlPoints)
    }
    
    if (this.dodoControlPoints == null) {
      this.clearControlPointMarkers()
    }

    if (this.stationsToShow != undefined && changes['stationsToShow']) {
      this.setStations(this.stationsToShow)
    }

    if (changes['backgroundMapId']) {
      this.switchBaseMap(this.backgroundMapId);
    }
  }

  ngOnDestroy(): void {
    if (this.mapMoveSubscription) {
      this.mapMoveSubscription.unsubscribe();
    }

    if (this.map) {
      this.map.off('move');
      this.map.remove();
    }
  }

  emitCurrentCenter() {
    const center = this.map.getCenter();
    this.pickedCoordinates.emit({ lat: center.lat, lng: center.lng });
  }

  private initMap(): void {
    // pobieranie z osobnego pliku w assets
    // dodo 3857_zg_2
    // const southWest = L.latLng(51.9218, 15.6059);
    // const northEast = L.latLng(52.0011, 15.7820);
    // 1724961.995 6792897.793
    
    // dodo 3857_mala_2

    // dodo 19 to jest maksymalny sensowny zoom, i tak nie da sie zrobic wiecej niz 21, bo leaflet sie wywala

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
      // maxBounds: bounds,
      maxBoundsViscosity: 1.0,
            dragging: true,
      zoomControl: true,
    });


    // warstwa kafelków XYZ (domyślnie 256px)
// dodo obsluga bledu nie wykrywania kafelkow
// dodo usuwanie plikow z kafelkami po zakonczonym biegu? moze pytac czy usunac mape ? 
    if(!this.backgroundMapId) {
      this.backgroundMapId = this.defaultMapId
    }

    L.tileLayer(`assets/maps/${this.backgroundMapId}/{z}/{x}/{y}.png`, {
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    }).addTo(this.map);

    this.map.createPane(this.stationPaneName);
    this.map.getPane(this.stationPaneName)!.style.zIndex = '600'

    this.map.createPane(this.accuracyPaneName);
    this.map.getPane(this.accuracyPaneName)!.style.zIndex = '200'
  }

  private switchBaseMap(mapId: string | undefined | null) {
    console.log('dodo switch map', mapId)
    mapId = mapId || this.defaultMapId;
    this.minZoom = this.minZoom || this.defaultMinZoom;
    this.maxZoom = this.maxZoom || this.defaultMaxZoom;
    this.northEast = this.northEast || this.defaultNorthEast;
    this.southWest = this.southWest || this.defaultSouthWest;
    console.log('switch map bounds', this.southWest, this.northEast)

    // dodo to nie usuwa tej warstwy
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    const url = `assets/maps/${mapId}/{z}/{x}/{y}.png`;
    this.currentTileLayer = L.tileLayer(url, {
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    });
    this.currentTileLayer.addTo(this.map);

    let bounds = L.latLngBounds(L.latLng(this.southWest?.[0], this.southWest?.[1]), L.latLng(this.northEast?.[0], this.northEast?.[1]));
    
    this.map.setMinZoom(this.minZoom);
    this.map.setMaxZoom(this.maxZoom);
    this.map.panTo(bounds.getCenter());
    this.map.setZoom(this.minZoom);
  }

  private addStations(stations: Station[]) {
       for (const station of stations) {
      const lat = station.geometry.coordinates[1]
      const lng = station.geometry.coordinates[0]

      const coordinates = L.latLng(lat, lng)

      const circle = L.circle(coordinates, {
        color: 'yellow',
        radius: 1,
        pane: this.stationPaneName
      })

      const popup = `<div style="text-align: center;">
                        <h2>${station.properties['name']}</h2>
                      </div>
                      <span>${station.properties['note']}</span>`
// dodo jezeli zle sie bedzie klikalo to mozna dodac niewidzialny okrag z popup
      circle.bindPopup(popup)
      circle.addTo(this.map)
      this.stationMarkers.push(circle);

      const accuracyCircle = L.circle(coordinates, {
        color: 'yellow',
        weight: 1,
        opacity: 0.2,
        fillColor: 'yellow',
        fillOpacity:0.1,
        radius: Number(station.properties['accuracy']),
        pane: this.accuracyPaneName
      })

      accuracyCircle.addTo(this.map)
      this.stationMarkers.push(accuracyCircle);
    }
  }

    private addGeoViewDodo(controlPoints: ControlPoint[]) {
      for (const controlPoint of controlPoints) {
        const location = controlPoint.geoView
        let lat = location.geometry.coordinates[1]
        let lng = location.geometry.coordinates[0]

        let coordinates:L.LatLng
        
        if(lat === 0.0 || lng === 0.0) {
          // dodo niech z backendu beda wczytywane domyslne wspolrzedne dla tych bez koordynatow
          coordinates = this.map.getBounds().getCenter()
        } else {
          coordinates = L.latLng(lat, lng)
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
        })

        // const popup = `<div style="text-align: center;">
        //                   <h2>${location.properties['name']}</h2>
        //                 </div>
        //                 <span>${location.properties['note']}</span>`

        // circle.bindPopup(popup)
        this.addControlPointMarker(circle)

        const accuracyCircle = L.circle(coordinates, {
          weight: 1,
          opacity: 0.2,
          fillOpacity:0.1,
          radius: Number(location.properties['accuracy']),
          pane: this.accuracyPaneName,
          interactive: false
        })

        this.addControlPointMarker(accuracyCircle)
    }
  }

  private readCenterCoordinates() {
    const initialCenter = this.map.getCenter();
    this.circleMarker = L.circleMarker(initialCenter, {
      radius: 1,
      color: 'black'
    }).addTo(this.map)

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
    this.controlPointMarkers = []
  }

  // ***

  setStations(stations: Station[]) {
    this.clearStations();
    this.addStations(stations);
  }

  private clearStations() {
    this.stationMarkers.forEach(marker => this.map.removeLayer(marker));
    this.stationMarkers = [];
  }
}
