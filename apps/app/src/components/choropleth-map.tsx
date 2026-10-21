// Native placeholder: the map uses Leaflet (DOM) on web; a native map comes with the mobile step (009).
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { MapFeature, MapLayer } from '@/data/map';

type ChoroplethMapProps = {
  layer: MapLayer | null;
  /** Property key of the metric in the layer, e.g. price_apartment. */
  metric: string;
  breaks: number[];
  onSelect: (feature: MapFeature) => void;
  height: number;
};

export const ChoroplethMap = ({ height }: ChoroplethMapProps) => (
  <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
    <ThemedText themeColor="textSecondary">La carte est disponible sur la version web pour l&apos;instant.</ThemedText>
  </View>
);
