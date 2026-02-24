import { Injectable } from '@angular/core';
import { Route } from './response/Route';
import { Category } from './response/Category';
import { DictionaryModel } from './response/DictionaryModel';
import { BackgroundMapOption } from './response/BackgroundMapOption';
import { BackgroundMap } from './response/BackgroundMap';
import { RaceResult } from './response/RaceResults';

@Injectable({ providedIn: 'root' })
export class OrganizerDataCacheService {
  routes: Route[] | null = null;
  categories: Category[] | null = null;
  categoryOptions: string[] | null = null;
  units: string[] | null = null;
  statusDictionary: DictionaryModel[] | null = null;
  stationDictionary: DictionaryModel[] | null = null;
  backgroundMapOptions: BackgroundMapOption[] | null = null;
  backgroundMaps: BackgroundMap[] | null = null;
  raceResults: RaceResult[] | null = null;

  clearAll(): void {
    this.routes = null;
    this.categories = null;
    this.categoryOptions = null;
    this.units = null;
    this.statusDictionary = null;
    this.stationDictionary = null;
    this.backgroundMapOptions = null;
    this.backgroundMaps = null;
    this.raceResults = null;
  }
}
