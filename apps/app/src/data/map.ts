// Choropleth map data (docs/features/005-map/spec.md): GeoJSON layers written by the pipeline's
// mapdata stage, metrics, quintile classes and colours.
import { formatEurosPerM2, formatPercent, formatSignedPercent } from './format.ts';

const DATA_URL = process.env.EXPO_PUBLIC_DATA_URL ?? '/data';

export type MapProperties = {
  code: string;
  nom: string;
  level?: 'commune' | 'arrondissement';
  rent_control?: boolean;
  [metric: string]: string | number | boolean | undefined;
};

/** A place has a page when it has published sales of either type (flats or houses). */
export const hasPlacePage = (properties: MapProperties): boolean =>
  typeof properties.sales_apartment === 'number' || typeof properties.sales_house === 'number';

export type MapFeature = { type: 'Feature'; geometry: unknown; properties: MapProperties };
export type MapLayer = { type: 'FeatureCollection'; features: MapFeature[] };

/** Metrics published per property type get the type as suffix (price_apartment); area metrics do not. */
export type MetricBase =
  | 'price'
  | 'yield'
  | 'net_yield'
  | 'cash_flow'
  | 'trend'
  | 'score'
  | 'share_fg'
  | 'vacancy'
  | 'population_growth'
  | 'tfpb_rate';

export type Metric = {
  base: MetricBase;
  label: string;
  format: (value: number) => string;
  /** Wording of the dark end of the scale, for the legend. */
  higherIs: string;
  /** Same value for flats and houses (area statistics). */
  areaWide?: boolean;
  /** Not computed for départements (score is per commune). */
  communesOnly?: boolean;
};

export const METRICS: Metric[] = [
  { base: 'price', label: 'Prix au m²', format: formatEurosPerM2, higherIs: 'plus cher' },
  { base: 'yield', label: 'Rentabilité brute', format: formatPercent, higherIs: 'plus rentable' },
  { base: 'net_yield', label: 'Rentabilité nette (bien type)', format: formatPercent, higherIs: 'plus rentable' },
  {
    base: 'cash_flow',
    label: 'Cash-flow mensuel (bien type)',
    format: (v) => `${Math.round(v)} €`,
    higherIs: 'meilleur cash-flow',
  },
  { base: 'trend', label: 'Évolution moyenne / an (5 ans)', format: formatSignedPercent, higherIs: 'plus de hausse' },
  {
    base: 'score',
    label: 'Score de marché',
    format: (v) => `${Math.round(v)} / 100`,
    higherIs: 'meilleur',
    communesOnly: true,
  },
  { base: 'share_fg', label: 'Passoires F/G', format: formatPercent, higherIs: 'plus de passoires' },
  { base: 'vacancy', label: 'Logements vacants', format: formatPercent, higherIs: 'plus de vacance', areaWide: true },
  {
    base: 'population_growth',
    label: 'Population / an',
    format: formatSignedPercent,
    higherIs: 'plus de croissance',
    areaWide: true,
  },
  { base: 'tfpb_rate', label: 'Taux de taxe foncière', format: formatPercent, higherIs: 'plus taxé', areaWide: true },
];

export const metricKey = (base: MetricBase, type: 'apartment' | 'house'): string =>
  METRICS.find((m) => m.base === base)?.areaWide ? base : `${base}_${type}`;

/** 5 classes from light to dark (ColorBrewer YlGnBu, colour-blind safe). */
/** Quintile breaks published by the pipeline (map/breaks.json), per layer and metric key. */
export type Breaks = { departements: Record<string, number[]>; communes: Record<string, number[]> };

let breaksPromise: Promise<Breaks> | null = null;

export const loadBreaks = (): Promise<Breaks> => {
  breaksPromise ??= fetch(`${DATA_URL}/map/breaks.json`).then((response) => {
    if (!response.ok) {
      throw new Error(`carte breaks.json : HTTP ${response.status}`);
    }
    return response.json() as Promise<Breaks>;
  });
  return breaksPromise;
};

const fetchLayer = async (path: string): Promise<MapLayer> => {
  const response = await fetch(`${DATA_URL}/map/${path}`);
  if (!response.ok) {
    throw new Error(`carte ${path} : HTTP ${response.status}`);
  }
  return response.json() as Promise<MapLayer>;
};

const cache = new Map<string, Promise<MapLayer>>();

export const loadMapLayer = (path: 'departements.geojson' | `communes/${string}.geojson`): Promise<MapLayer> => {
  if (!cache.has(path)) {
    cache.set(path, fetchLayer(path));
  }
  return cache.get(path)!;
};
