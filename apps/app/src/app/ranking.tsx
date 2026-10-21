import { Link, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { NumberField, parseNumber } from '@/components/number-field';
import { Chip } from '@/components/segment-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { loadRanking } from '@/data/api';
import { formatCount, formatEurosPerM2, formatPercent, formatPeriod, formatRentPerM2, formatSignedPercent } from '@/data/format';
import { isRisky, rankPlaces, type RankingFilter, type SortKey } from '@/data/rank';
import { bucketsFor } from '@/data/select';
import type { DwellingType, Ranking, RankingRow, RoomsBucket } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Score de marché' },
  { value: 'yield', label: 'Rentabilité brute' },
  { value: 'cash_flow', label: 'Cash-flow (bien type)' },
  { value: 'price', label: 'Prix le plus bas' },
  { value: 'trend', label: 'Prix en hausse' },
  { value: 'population', label: 'Population en hausse' },
];

const Row = ({ row, rank }: { row: RankingRow; rank: number }) => {
  const theme = useTheme();
  return (
    <Link
      href={`/place/${row.level}/${row.code}`}
      style={StyleSheet.flatten([styles.row, { borderColor: theme.border }])}>
      <View style={styles.rowInner}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
          {rank}
        </ThemedText>
        <View style={styles.rowMain}>
          <ThemedText type="smallBold">
            {row.name} <ThemedText type="small" themeColor="textSecondary">({row.departement})</ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatEurosPerM2(row.median_price_m2)} · loyer {formatRentPerM2(row.rent_m2)} charges comprises ·{' '}
            {formatSignedPercent(row.yoy_change)} sur un an
            {row.cash_flow_monthly != null ? ` · cash-flow bien type ${Math.round(row.cash_flow_monthly)} €/mois` : ''}
            · {formatCount(row.n_sales)} ventes
            {row.score != null ? ` · score ${Math.round(row.score)}/100` : ''}
            {row.share_fg != null ? ` · F/G ${formatPercent(row.share_fg)}` : ''}
            {row.rent_control ? ' · loyers encadrés' : ''}
          </ThemedText>
          {isRisky(row) && (
            <ThemedText type="small" themeColor="warningText">
              {row.flag_high_vacancy ? `Vacance ${formatPercent(row.vacancy_rate)}` : ''}
              {row.flag_high_vacancy && row.flag_population_decline ? ' · ' : ''}
              {row.flag_population_decline ? `Population ${formatSignedPercent(row.population_growth_yearly)} / an` : ''}
            </ThemedText>
          )}
        </View>
        <ThemedText type="smallBold" style={styles.yield}>
          {formatPercent(row.gross_yield)}
        </ThemedText>
      </View>
    </Link>
  );
};

export default function RankingScreen() {
  const [loaded, setLoaded] = useState<{ segment: string; ranking: Ranking } | null>(null);
  // keyed by segment like the rows, so a failed file does not block the other segments
  const [failure, setFailure] = useState<{ segment: string; message: string } | null>(null);
  const [type, setType] = useState<DwellingType>('apartment');
  const [rooms, setRooms] = useState<RoomsBucket>('all');
  const [filter, setFilter] = useState<RankingFilter>({
    excludeRisky: true,
    departement: '',
    maxPriceM2: null,
    sort: 'yield',
  });
  const [budget, setBudget] = useState('');

  useEffect(() => {
    let current = true;
    // one file per segment: flats and houses, and each size, are ranked apart
    loadRanking(type, rooms).then(
      (result) => current && setLoaded({ segment: `${type}_${rooms}`, ranking: result }),
      (e: Error) => current && setFailure({ segment: `${type}_${rooms}`, message: e.message }),
    );
    return () => {
      current = false;
    };
  }, [type, rooms]);

  // the previous segment's rows are not shown while the next file loads
  const ranking = loaded?.segment === `${type}_${rooms}` ? loaded.ranking : null;
  const error = failure?.segment === `${type}_${rooms}` ? failure.message : null;
  const rows = useMemo(
    () => (ranking ? rankPlaces(ranking.rows, { ...filter, maxPriceM2: budget ? parseNumber(budget) : null }) : []),
    [ranking, filter, budget],
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Classement des villes' }} />
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.level}-${row.code}-${row.property_type}`}
        renderItem={({ item, index }) => <Row row={item} rank={index + 1} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle">Où investir ?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Rentabilité brute = 12 × loyer d&apos;annonce (charges comprises, à la surface médiane) / prix médian des ventes signées
              {ranking ? ` en ${formatPeriod(ranking.period)}, communes avec au moins ${ranking.minSales} ventes` : ''}.
              Une rentabilité très élevée signale souvent un marché à risque.
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="Appartements" selected={type === 'apartment'} onPress={() => { setType('apartment'); setRooms('all'); }} />
              <Chip label="Maisons" selected={type === 'house'} onPress={() => { setType('house'); setRooms('all'); }} />
            </View>
            <View style={styles.chips}>
              {bucketsFor(type).map((bucket) => (
                <Chip
                  key={bucket}
                  label={bucket === 'all' ? 'Toutes tailles' : type === 'house' ? `${bucket} pièces` : `T${bucket}`}
                  selected={rooms === bucket}
                  onPress={() => setRooms(bucket)}
                />
              ))}
            </View>
            <View style={styles.chips}>
              <Chip
                label="Écarter les loyers encadrés"
                selected={Boolean(filter.excludeRentControl)}
                onPress={() => setFilter({ ...filter, excludeRentControl: !filter.excludeRentControl })}
              />
              <Chip
                label="Écarter les villes à risque"
                selected={filter.excludeRisky}
                onPress={() => setFilter({ ...filter, excludeRisky: !filter.excludeRisky })}
              />
            </View>
            <View style={styles.chips}>
              {SORTS.map((sort) => (
                <Chip key={sort.value} label={sort.label} selected={filter.sort === sort.value} onPress={() => setFilter({ ...filter, sort: sort.value })} />
              ))}
            </View>
            <View style={styles.fields}>
              <NumberField
                label="Département (code)"
                value={filter.departement}
                onChange={(text) => setFilter({ ...filter, departement: text.trim().toUpperCase() })}
              />
              <NumberField label="Prix maximum" unit="€/m²" value={budget} onChange={setBudget} />
            </View>
            {error && <ThemedText themeColor="negative">Classement indisponible : {error}</ThemedText>}
            {!ranking && !error && <ActivityIndicator />}
          </View>
        }
        ListEmptyComponent={
          ranking ? <ThemedText themeColor="textSecondary">Aucune ville ne correspond à ces filtres.</ThemedText> : undefined
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rank: { width: 24, textAlign: 'right' },
  rowMain: { flex: 1, gap: 2 },
  yield: { fontSize: 18, lineHeight: 24 },
});
