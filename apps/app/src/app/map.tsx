import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ChoroplethMap } from '@/components/choropleth-map';
import { Chip } from '@/components/segment-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  loadMapLayer,
  type MapFeature,
  type MapLayer,
  type MetricKey,
  METRICS,
  metricValues,
  NO_DATA_COLOR,
  PALETTE,
  quintileBreaks,
} from '@/data/map';
import { useTheme } from '@/hooks/use-theme';

type View_ = { kind: 'france' } | { kind: 'departement'; code: string; nom: string };

const Legend = ({ breaks, metric }: { breaks: number[]; metric: (typeof METRICS)[number] }) => {
  const bounds = ['', ...breaks.map(metric.format)];
  return (
    <View style={styles.legend} accessibilityLabel="Légende de la carte">
      {PALETTE.map((color, i) => (
        <View key={color} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
            {i === 0 ? `≤ ${bounds[1] ?? ''}` : i === PALETTE.length - 1 ? `> ${bounds[i]}` : `${bounds[i]} – ${bounds[i + 1]}`}
          </ThemedText>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: NO_DATA_COLOR }]} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
          Pas assez de données
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
        5 classes de même effectif (quintiles) ; plus foncé = {metric.higherIs}.
      </ThemedText>
    </View>
  );
};

const Details = ({ feature, view }: { feature: MapFeature; view: View_ }) => {
  const theme = useTheme();
  const p = feature.properties;
  const isPlace = view.kind === 'departement';
  return (
    <View style={[styles.details, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">
        {p.nom} {p.rent_control ? '· loyers encadrés' : ''}
      </ThemedText>
      {METRICS.filter((m) => typeof p[m.key] === 'number').map((m) => (
        <View key={m.key} style={styles.detailRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {m.label}
          </ThemedText>
          <ThemedText type="small">{m.format(p[m.key] as number)}</ThemedText>
        </View>
      ))}
      {isPlace && typeof p.sales_all !== 'number' && (
        <ThemedText type="small" themeColor="textSecondary">
          Moins de 10 ventes sur l&apos;année : pas de chiffres de prix publiés pour cette commune.
        </ThemedText>
      )}
      {isPlace && typeof p.sales_all === 'number' && (
        <Link href={`/place/${p.level ?? 'commune'}/${p.code}`}>
          <ThemedText type="smallBold" themeColor="accent">
            Voir la page de {p.nom} →
          </ThemedText>
        </Link>
      )}
    </View>
  );
};

export default function MapScreen() {
  const { height, width } = useWindowDimensions();
  const [view, setView] = useState<View_>({ kind: 'france' });
  const [layer, setLayer] = useState<MapLayer | null>(null);
  const [metricKey, setMetricKey] = useState<MetricKey>('yield_apartment');
  const [selected, setSelected] = useState<MapFeature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const path = view.kind === 'france' ? 'departements.geojson' : (`communes/${view.code}.geojson` as const);
    loadMapLayer(path).then(
      (loaded) => current && setLayer(loaded),
      (e: Error) => current && setError(e.message),
    );
    return () => {
      current = false;
    };
  }, [view]);

  const metrics = METRICS.filter((m) => view.kind === 'departement' || !m.communesOnly);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  // memoised by the React Compiler
  const breaks = layer ? quintileBreaks(metricValues(layer, metric.key)) : [];

  const onSelect = (feature: MapFeature) => {
    if (view.kind === 'france') {
      setSelected(null);
      setLayer(null);
      setView({ kind: 'departement', code: feature.properties.code, nom: feature.properties.nom });
    } else {
      setSelected(feature);
    }
  };

  const wide = width >= 900;
  const mapHeight = Math.max(360, height - (wide ? 140 : 320));

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Carte' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.breadcrumb}>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                setSelected(null);
                setLayer(null);
                setView({ kind: 'france' });
              }}>
              <ThemedText type="smallBold" themeColor={view.kind === 'france' ? 'text' : 'accent'}>
                France
              </ThemedText>
            </Pressable>
            {view.kind === 'departement' && <ThemedText type="smallBold"> › {view.nom}</ThemedText>}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {view.kind === 'france'
              ? 'Cliquez un département pour voir ses communes.'
              : 'Cliquez une commune pour ses chiffres. Paris, Lyon et Marseille par arrondissement.'}
          </ThemedText>
          <View style={styles.chips}>
            {metrics.map((m) => (
              <Chip key={m.key} label={m.label} selected={m.key === metric.key} onPress={() => setMetricKey(m.key)} />
            ))}
          </View>
        </View>
        {error && <ThemedText themeColor="negative">{error}</ThemedText>}
        <View style={[styles.body, wide && styles.bodyWide]}>
          <View style={styles.mapColumn}>
            {!layer && !error && <ActivityIndicator style={styles.loader} />}
            <ChoroplethMap layer={layer} metric={metric.key} breaks={breaks} onSelect={onSelect} height={mapHeight} />
          </View>
          <View style={[styles.side, wide && styles.sideWide]}>
            <Legend breaks={breaks} metric={metric} />
            {selected && <Details feature={selected} view={view} />}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  header: { gap: Spacing.two },
  breadcrumb: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  body: { gap: Spacing.three },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mapColumn: { flex: 1 },
  loader: { position: 'absolute', top: Spacing.four, alignSelf: 'center', zIndex: 1 },
  side: { gap: Spacing.three },
  sideWide: { width: 300 },
  legend: { gap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 18, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, lineHeight: 16 },
  details: { borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
});
