import { Link, Stack, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { KpiTile } from '@/components/kpi-tile';
import { EnergyBar, PriceBandBars, ScoreCard } from '@/components/place-sections';
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
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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
  const score = segment.propertyType === 'all' ? undefined : place.score?.[segment.propertyType];
  const bands = place.price_bands?.[segment.propertyType];
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

        {place.rent_control && (
          <ThemedText type="small" themeColor="warningText">
            Loyers encadrés : le loyer d&apos;un nouveau bail ne peut pas dépasser le loyer de référence majoré
            fixé par arrêté préfectoral.
          </ThemedText>
        )}

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
                detail={
                  year.cagr != null && year.cagr_since != null
                    ? `Depuis ${year.cagr_since} : ${formatSignedPercent(year.cagr)} par an`
                    : `Fourchette ${formatEurosPerM2(year.p25_price_m2)} – ${formatEurosPerM2(year.p75_price_m2)}`
                }
              />
              {year.median_surface_m2 != null && (
                <KpiTile
                  label="Surface médiane vendue"
                  value={`${Math.round(year.median_surface_m2)} m²`}
                  detail={`Fourchette ${formatEurosPerM2(year.p25_price_m2)} – ${formatEurosPerM2(year.p75_price_m2)}`}
                />
              )}
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

        {year && (
          <Link
            href={{
              pathname: '/simulator',
              params: { level: place.level, code: place.code, type: segment.propertyType, rooms: segment.rooms },
            }}
            style={StyleSheet.flatten([styles.cta, { backgroundColor: theme.accent }])}>
            <ThemedText type="smallBold" themeColor="onAccent">
              Simuler un achat ici →
            </ThemedText>
          </Link>
        )}

        {half && half.period !== year?.period && (
          <ThemedText type="small" themeColor="textSecondary">
            Dernier semestre ({formatPeriod(half.period)}) : {formatEurosPerM2(half.median_price_m2)},{' '}
            {formatSignedPercent(half.yoy_change)} sur un an · {formatCount(half.n_sales)} ventes
          </ThemedText>
        )}

        {score && (
          <View style={styles.section}>
            <ThemedText type="smallBold">
              Score de marché ({segment.propertyType === 'house' ? 'maisons' : 'appartements'}, {formatPeriod(score.period)})
            </ThemedText>
            <ScoreCard score={score} />
          </View>
        )}

        {bands && (
          <View style={styles.section}>
            <ThemedText type="smallBold">
              Ventes par prix total en {place.price_bands?.year} ({formatCount(bands.n_sales)} ventes)
            </ThemedText>
            <PriceBandBars bands={bands.bands} />
          </View>
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

        {(place.energy || place.local_tax) && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Énergie et fiscalité locale</ThemedText>
            {place.energy && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Étiquettes DPE des {formatCount(place.energy.n_dpe)} diagnostics réalisés depuis 2021 (surtout des
                  logements vendus ou loués). G : location interdite depuis 2025, F à partir de 2028.
                </ThemedText>
                <EnergyBar energy={place.energy} />
              </>
            )}
            <View style={styles.tiles}>
              {place.energy && (
                <KpiTile
                  label="Passoires énergétiques F/G"
                  value={formatPercent(place.energy.share_fg)}
                  detailColor={place.energy.share_fg > 0.15 ? 'negative' : undefined}
                  detail="Part des diagnostics classés F ou G"
                />
              )}
              {place.local_tax && (
                <KpiTile
                  label={`Taux de taxe foncière ${place.local_tax.tax_year}`}
                  value={formatPercent(place.local_tax.tfpb_rate)}
                  detail="Commune + intercommunalité + taxes spéciales, appliqué à la moitié de la valeur locative"
                />
              )}
              {score?.rent_to_income != null && (
                <KpiTile
                  label="Poids du loyer d'un T2 de 45 m²"
                  value={formatPercent(score.rent_to_income)}
                  detailColor={score.rent_to_income > 0.33 ? 'negative' : undefined}
                  detail="Loyer annuel / niveau de vie médian (règle : un tiers au plus)"
                />
              )}
            </View>
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          Sources : DVF (DGFiP), Carte des loyers (ANIL/DHUP), INSEE, DPE (ADEME), REI (DGFiP). Calcul {place.run_id}.
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
  cta: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: 12 },
});
