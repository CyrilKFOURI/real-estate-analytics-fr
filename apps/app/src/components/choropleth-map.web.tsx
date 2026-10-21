// Leaflet choropleth (web). Leaflet is the JavaScript library behind Python's folium.
import './leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { colorOf, type MapFeature, type MapLayer } from '@/data/map';

type ChoroplethMapProps = {
  layer: MapLayer | null;
  /** Property key of the metric in the layer, e.g. price_apartment. */
  metric: string;
  breaks: number[];
  onSelect: (feature: MapFeature) => void;
  height: number;
};

const FRANCE_BOUNDS: L.LatLngBoundsExpression = [[41.2, -5.3], [51.2, 9.7]];

export const ChoroplethMap = ({ layer, metric, breaks, onSelect, height }: ChoroplethMapProps) => {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const geo = useRef<L.GeoJSON | null>(null);
  // latest click handler, read by Leaflet's event listeners without re-binding them
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });

  // create the map once
  useEffect(() => {
    if (!container.current || map.current) {
      return;
    }
    map.current = L.map(container.current, { zoomSnap: 0.25 }).fitBounds(FRANCE_BOUNDS);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15,
      attribution: '&copy; OpenStreetMap contributors · contours Etalab · données DVF, ANIL, INSEE, ADEME',
    }).addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // (re)draw the layer when the data changes; restyle only when the metric changes
  useEffect(() => {
    if (!map.current) {
      return;
    }
    geo.current?.remove();
    if (!layer) {
      return;
    }
    geo.current = L.geoJSON(layer as unknown as GeoJSON.FeatureCollection, {
      onEachFeature: (feature, shape) => {
        shape.on('click', () => select.current(feature as unknown as MapFeature));
        shape.bindTooltip(String((feature.properties as { nom?: string }).nom ?? ''), { sticky: true });
      },
    }).addTo(map.current);
    const bounds = geo.current.getBounds();
    if (bounds.isValid()) {
      map.current.fitBounds(bounds, { padding: [12, 12] });
    }
  }, [layer]);

  useEffect(() => {
    geo.current?.setStyle((feature) => ({
      fillColor: colorOf(feature?.properties?.[metric], breaks),
      fillOpacity: 0.75,
      color: '#555555',
      weight: 0.6,
    }));
  }, [layer, metric, breaks]);

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <div ref={container} style={{ width: '100%', height: '100%' }} />
    </View>
  );
};
