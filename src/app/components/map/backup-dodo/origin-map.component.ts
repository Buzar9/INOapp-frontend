// import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, Input, OnChanges } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import L, { control, icon } from 'leaflet';
// import { min, Subscription } from 'rxjs';
// import { BackofficeSendService } from '../../services/backoffice-send-service';
// import { Station } from '../../services/response/Station';
// import { SendService } from '../../services/send-service';
// import { Route } from '../../services/response/Route';
// import { ControlPoint } from '../../services/response/RaceResults';
// import { GeoView } from '../../services/response/GeoView';

// @Component({
//   selector: 'app-map',
//   standalone: true,
//   imports: [CommonModule],
//   template: `
//     <div id="map" style="height: 500px; position: relative;"></div>
//     <div id="coordinates" style="position: absolute; top: 20px; right: 20px; background-color: white; padding: 5px; border-radius: 3px; font-size: 0.8em; z-index: 1000;"></div>
//   `,
//   styles: [``],
// })
// export class MapComponent implements AfterViewInit, OnDestroy, OnChanges {
//   @Input()
//   dodoControlPoints: ControlPoint[] = [];

//   private controlPointMarkers: L.Circle[] = [];

//   private map!: L.Map;
//   private circleMarker!: L.CircleMarker;
//   private coordinatesDisplay!: HTMLElement;
//   private mapMoveSubscription!: Subscription;
//   private route!: Route;
//   private stationPaneName = 'stationPane'
//   private accuracyPaneName = 'accuracyPane'

//   constructor(private sendService: SendService){}

//   ngAfterViewInit(): void {
//     // z kazdym odswiezeniem probuje to inicjalizowac co wywoluje blad
//     this.initMap();
//     // this.addStations();
//     this.coordinatesDisplay = document.getElementById('coordinates')!;
//     // dodo
//     let request = {
//       routeId:"aa798181-7b5e-450d-b458-d98fe6850a7a"
//     }
//     this.sendService.getRoute(request).subscribe({
//       next: (data) => {
//         this.route = data;
//         this.addBackendStations(data.stations);
//       },
//       error: (err) => {
//         console.error('dodo error get', err);
//       }
//     })

//     // this.readCenterCoordinates();
//   }

//   ngOnChanges(): void {
//     // Sprawdzamy, czy właściwość 'dataObject' uległa zmianie

//     if (this.dodoControlPoints != null) {
//       this.clearControlPointMarkers()
//       this.addGeoViewDodo(this.dodoControlPoints)
//     }
//     if (this.dodoControlPoints == null) {
//       this.clearControlPointMarkers()
//     }
//   }

//   ngOnDestroy(): void {
//     if (this.mapMoveSubscription) {
//       this.mapMoveSubscription.unsubscribe();
//     }
//     if (this.map) {
//       this.map.off('move');
//     }
//   }

//   private initMap(): void {
//     const southWest = L.latLng(51.9218, 15.6059);
//     const northEast = L.latLng(52.0011, 15.7820);
//     const bounds: L.LatLngBounds = new L.LatLngBounds(southWest, northEast);

//     const minZoom = 12;
//     const maxZoom = 16;

//      this.map = L.map('map', {

//       center: bounds.getCenter(),
//       zoom: minZoom,
//       minZoom: minZoom,
//       maxZoom: maxZoom,
//       maxBounds: bounds,
//       maxBoundsViscosity: 1.0,
//             dragging: true,
//       zoomControl: true,
//     });

//     // warstwa kafelków XYZ (domyślnie 256px)
// // dodo obsluga bledu nie wykrywania kafelkow
// // dodo usuwanie plikow z kafelkami po zakonczonym biegu? moze pytac czy usunac mape ? 
//     L.tileLayer('assets/maps/3857_backend/{z}/{x}/{y}.png', {
//       minZoom: minZoom,
//       maxZoom: maxZoom,
//     }).addTo(this.map);

//     this.map.createPane(this.stationPaneName);
//     this.map.getPane(this.stationPaneName)!.style.zIndex = '600'

//     this.map.createPane(this.accuracyPaneName);
//     this.map.getPane(this.accuracyPaneName)!.style.zIndex = '200'
//   }

//   private addBackendStations(stations: Station[]) {
//        for (const station of stations) {
//       const lat = station.geometry.coordinates[1]
//       const lng = station.geometry.coordinates[0]

//       const coordinates = L.latLng(lat, lng)

//       const circle = L.circle(coordinates, {
//         color: 'yellow',
//         radius: 1,
//         pane: this.stationPaneName
//       })

//       const popup = `<div style="text-align: center;">
//                         <h2>${station.properties['name']}</h2>
//                       </div>
//                       <span>${station.properties['note']}</span>`
// // dodo jezeli zle sie bedzie klikalo to mozna dodac niewidzialny okrag z popup
//       circle.bindPopup(popup)
//       circle.addTo(this.map)

//       const accuracyCircle = L.circle(coordinates, {
//         color: 'yellow',
//         weight: 1,
//         opacity: 0.2,
//         fillColor: 'yellow',
//         fillOpacity:0.1,
//         radius: Number(station.properties['accuracy']),
//         pane: this.stationPaneName
//       })

//       accuracyCircle.addTo(this.map)
//     }
//   }

//     private addGeoViewDodo(controlPoints: ControlPoint[]) {
//       for (const controlPoint of controlPoints) {
//         const location = controlPoint.geoView
//         let lat = location.geometry.coordinates[1]
//         let lng = location.geometry.coordinates[0]

//         let coordinates:L.LatLng
        
//         if(lat === 0.0 || lng === 0.0) {
//           // dodo niech z backendu beda wczytywane domyslne wspolrzedne dla tych bez koordynatow
//           coordinates = this.map.getBounds().getCenter()
//         } else {
//           coordinates = L.latLng(lat, lng)
//         }

//         let color: string;

//        if (controlPoint.ruleValidation.some(rule => rule.result === 'FAILED')) {
//             color = 'red';
//         } else if (controlPoint.ruleValidation.every(ruleValidation => ruleValidation.result === 'PASSED')) {
//             color = 'green';
//         } else {
//             color = 'blue';
//         }

//         const circle = L.circle(coordinates, {
//           color: color,
//           radius: 1
//         })

//         // const popup = `<div style="text-align: center;">
//         //                   <h2>${location.properties['name']}</h2>
//         //                 </div>
//         //                 <span>${location.properties['note']}</span>`

//         // circle.bindPopup(popup)
//         this.addControlPointMarker(circle)

//         console.log(Number(location.properties['accuracy']))

//         const accuracyCircle = L.circle(coordinates, {
//           weight: 1,
//           opacity: 0.2,
//           fillOpacity:0.1,
//           radius: Number(location.properties['accuracy']),
//           pane: this.accuracyPaneName
//         })

//         this.addControlPointMarker(accuracyCircle)
//     }
//   }

//   private addStations() {
//     const stations = [{
//       "type": "Feature",
//       "properties": {
//         "id": "StationId1",
//         "name": "1",
//         "type":"checkpoint",
//         "note":"Attack on Titan",
//         "accuracy": 50.0
//       },
//       "geometry": {
//         "coordinates": [
//           15.66373976073669,
//           51.942459819914745
//         ],
//         "type": "Point"
//       }
//     },
//     {
//       "type": "Feature",
//       "properties": {
//         "id": "StationId2",
//         "name": "2",
//         "type":"checkpoint",
//         "note":"Bunkyyyyyr",
//         "accuracy": 30.0
//       },
//       "geometry": {
//         "coordinates": [
//           15.727867666537662,
//           51.97075291414495
//         ],
//         "type": "Point"
//       }
//     }]

//     for (const station of stations) {
//       const lat = station.geometry.coordinates[1]
//       const lng = station.geometry.coordinates[0]

//       const coordinates = L.latLng(lat, lng)

//       const circle = L.circle(coordinates, {
//         color: 'red',
//         radius: 1
//       })

//       const popup = `<div style="text-align: center;">
//                         <h2>${station.properties.name}</h2>
//                       </div>
//                       <span>${station.properties.note}</span>`

//       circle.bindPopup(popup)
//       circle.addTo(this.map)
//     }
//   }

//   private readCenterCoordinates() {
//     const initialCenter = this.map.getCenter();
//     this.circleMarker = L.circleMarker(initialCenter, {
//       radius: 1,
//       color: 'black'
//     }).addTo(this.map)

//     this.updateCoordinates(initialCenter.lat, initialCenter.lng);

//     this.map.on('move', () => {
//       const newCenter = this.map.getCenter();
//       this.circleMarker.setLatLng(newCenter);
//       this.updateCoordinates(newCenter.lat, newCenter.lng);
//     });
//   }

//   private updateCoordinates(lat: number, lng: number): void {
//     if (this.coordinatesDisplay) {
//       this.coordinatesDisplay.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
//     }
//   }

//   private addControlPointMarker(marker: L.Circle): void {
//     marker.addTo(this.map);
//     this.controlPointMarkers.push(marker);
//   }

//   private clearControlPointMarkers(): void {
//     for (const marker of this.controlPointMarkers) {
//       this.map.removeLayer(marker);
//     }
//     this.controlPointMarkers = []
//   }
// }
