import { Stack, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { KpiTile } from '@/components/kpi-tile';
import { RiskBanner } from '@/components/risk-banner';
import { SegmentPicker } from '@/components/segment-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrendBars } from '@/components/trend-bars';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { loadPlace } from '@/data/api';
import {
  formatCount,
  formatDecimal,
  formatEuros,
  formatEurosPerM2,
  formatPercent,
  formatPeriod,
  formatPoints,
  formatRentPerM2,
  formatSignedPercent,
} from '@/data/format';
import {
  defaultSegment,
  halfYearSeries,
  latestFullYear,
  latestHalf,
  LOW_CONFIDENCE_SALES,
  type Segment,
  yieldFor,
} from '@/data/select';
import type { GeoLevel, Place } from '@/data/types';

const LEVEL_LABELS: Record<GeoLevel, string> = {
  commune: 'Commune',
  arrondissement: 'Arrondissement',
  departement: 'Département',
  region: 'Région',
  france: 'Pays',
};

const signColor = (value: number | null | undefined) =>
  value == null || value === 0 ? undefined : value > 0 ? 'positive' : 'negative';

export default function PlaceScreen() {
  const { level, code } = useLocalSearchParams<{ level: GeoLevel; code: string }>();
  // null until the user picks one: then the place's default segment applies
  const [pickedSegment, setSegment] = useState<Segment | null>(null);
  // Results are stored with the route they belong to: while a new place loads, the previous
  // one is not shown.
  const routeKey = `${level}/${code}`;
  const [loaded, setLoaded] = useState<{ key: string; place?: Place; error?: string } | null>(null);

  useEffect(() => {
    let current = true;
    loadPlace(level, code).then(
      (place) => current && setLoaded({ key: routeKey, place }),
      (e: Error) => current && setLoaded({ key: routeKey, error: e.message }),
    );
    return () => {
      current = false;
    };
  }, [level, code, routeKey]);

  const place = loaded?.key === routeKey ? loaded.place : undefined;
  const error = loaded?.key === routeKey ? loaded.error : undefined;

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="negative">Lieu introuvable ou sans ventes publiées ({error}).</ThemedText>
      </ThemedView>
    );
  }
  if (!place) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const segment = pickedSegment ?? defaultSegment(place.prices);
  const year = latestFullYear(place.prices, segment);
  const half = latestHalf(place.prices, segment);
  const series = halfYearSeries(place.prices, segment);
  const rent = year ? yieldFor(place.yields, segment, year.period) : undefined;
  const socio = place.socio;
  const title = place.name ?? code;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <Head>
        <title>{`${title} : prix, loyers et rentabilité`}</title>
        {/* DVF rules forbid search-engine indexing of sale data; aggregates stay unindexed
            until the legal check in docs/research/state_of_the_art.md is settled. */}
        <meta name="robots" content="noindex" />
      </Head>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary">
            {LEVEL_LABELS[place.level]}
            {place.departement ? ` · ${place.departement}` : ''} · INSEE {place.code}
          </ThemedText>
          <ThemedText type="subtitle">{title}</ThemedText>
        </View>

        <RiskBanner socio={socio} />

        <SegmentPicker segment={segment} onChange={setSegment} />

        {year ? (
          <>
            <ThemedText type="smallBold">Marché en {formatPeriod(year.period)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Les prix sont ceux de ventes déjà signées chez le notaire (DVF), donc le passé : ce que
              des acheteurs ont réellement payé, pas les prix d&apos;annonce actuels, souvent un peu
              plus hauts avant négociation. Les loyers, eux, sont des loyers d&apos;annonce.
            </ThemedText>
            <View style={styles.tiles}>
              <KpiTile
                label="Prix médian"
                value={formatEurosPerM2(year.median_price_m2)}
                detail={`Médiane ${formatEuros(year.median_price)} · ${formatCount(year.n_sales)} ventes`}
                lowConfidence={year.n_sales < LOW_CONFIDENCE_SALES}
              />
              <KpiTile
                label="Évolution sur un an"
                value={formatSignedPercent(year.yoy_change)}
                detailColor={signColor(year.yoy_change)}
                detail={`Fourchette ${formatEurosPerM2(year.p25_price_m2)} – ${formatEurosPerM2(year.p75_price_m2)}`}
              />
              <KpiTile
                label="Loyer d'annonce (charges comprises)"
                value={formatRentPerM2(rent?.rent_m2)}
                detail={
                  rent
                    ? `${formatRentPerM2(rent.rent_low_m2)} – ${formatRentPerM2(rent.rent_high_m2)}${
                        rent.rent_source === 'maille' ? ' · estimé sur les communes voisines' : ''
                      }`
                    : segment.propertyType === 'all'
                      ? 'Choisissez appartement ou maison'
                      : 'Pas de loyer publié'
                }
              />
              <KpiTile
                label="Rentabilité brute"
                value={formatPercent(rent?.gross_yield)}
                detail={rent ? `${formatDecimal(rent.price_to_rent_years)} années de loyer pour le prix` : undefined}
              />
            </View>
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            Pas assez de ventes pour ce type de bien (minimum 10 par période).
          </ThemedText>
        )}

        {half && half.period !== year?.period && (
          <ThemedText type="small" themeColor="textSecondary">
            Dernier semestre ({formatPeriod(half.period)}) : {formatEurosPerM2(half.median_price_m2)},{' '}
            {formatSignedPercent(half.yoy_change)} sur un an · {formatCount(half.n_sales)} ventes
          </ThemedText>
        )}

        {series.length > 1 && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Prix médian au m² par semestre</ThemedText>
            <TrendBars series={series} />
          </View>
        )}

        {socio && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Contexte (INSEE, recensement {socio.census_year})</ThemedText>
            <View style={styles.tiles}>
              <KpiTile
                label="Population"
                value={formatCount(socio.population)}
                detail={`${formatSignedPercent(socio.population_growth_yearly)} par an depuis 2017`}
                detailColor={signColor(socio.population_growth_yearly)}
              />
              <KpiTile
                label="Logements vacants"
                value={formatPercent(socio.vacancy_rate)}
                detail={`${formatPoints(socio.vacancy_change_pts)} depuis 2017`}
              />
              <KpiTile
                label="Emplois"
                value={formatCount(socio.jobs)}
                detail={`${formatSignedPercent(socio.jobs_growth_yearly)} par an depuis 2017`}
                detailColor={signColor(socio.jobs_growth_yearly)}
              />
              <KpiTile
                label="Niveau de vie médian"
                value={formatEuros(socio.median_living_standard)}
                detail={`Pauvreté ${formatPercent(socio.poverty_rate)} · Locataires ${formatPercent(socio.renter_share)}`}
              />
            </View>
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          Sources : DVF (DGFiP), Carte des loyers (ANIL/DHUP), INSEE. Calcul {place.run_id}.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: { gap: Spacing.one },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.two },
});
