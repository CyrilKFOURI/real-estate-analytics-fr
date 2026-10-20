import { Link, Stack, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { KpiTile } from '@/components/kpi-tile';
import { NumberField, parseNumber } from '@/components/number-field';
import { PriceRangeBar } from '@/components/price-range-bar';
import { Chip } from '@/components/segment-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerdictBadges } from '@/components/verdict-badges';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  assessRisk,
  cashFlowVerdict,
  type EnergyClass,
  type PriceVerdict,
  RENTAL_BAN_YEAR,
  summary,
} from '@/core-kpi/assessment';
import { analyzeDeal } from '@/core-kpi/deal';
import { DEFAULTS, FR_RULES } from '@/core-kpi/rules';
import { loadPlace } from '@/data/api';
import { EFFECT_LABELS, type Estimate, requestEstimate } from '@/data/estimate';
import {
  formatCount,
  formatDecimal,
  formatEuros,
  formatEurosPerM2,
  formatPercent,
  formatPeriod,
  formatRentPerM2,
  formatSignedPercent,
} from '@/data/format';
import { latestFullYear, type Segment, yieldFor } from '@/data/select';
import type { GeoLevel, Place, RoomsBucket } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const ENERGY_CLASSES: EnergyClass[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MAX_EFFECTS = 6;

type Form = {
  address: string;
  propertyType: 'apartment' | 'house';
  surface: string;
  rooms: string;
  land: string;
  dependencies: string;
  askedPrice: string;
  isNewBuild: boolean;
  energyClass: EnergyClass | null;
};

const INITIAL_FORM: Form = {
  address: '',
  propertyType: 'apartment',
  surface: '45',
  rooms: '2',
  land: '0',
  dependencies: '0',
  askedPrice: '150000',
  isNewBuild: false,
  energyClass: null,
};

type Analysis = { estimate: Estimate; place: Place | null; form: Form };

// Paris, Lyon and Marseille: the address resolves to an arrondissement code.
const levelOf = (code: string): GeoLevel => (/^(751|6938|132[01])/.test(code) ? 'arrondissement' : 'commune');

const roomsBucket = (rooms: number): RoomsBucket =>
  rooms >= 5 ? '5+' : rooms >= 1 ? (String(Math.round(rooms)) as RoomsBucket) : 'all';

const Block = ({ title, source, children }: { title: string; source: string; children: React.ReactNode }) => (
  <View style={styles.block}>
    <ThemedText type="subtitle" style={styles.blockTitle}>
      {title}
    </ThemedText>
    {children}
    <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
      {source}
    </ThemedText>
  </View>
);

const PropertyForm = ({ form, onChange }: { form: Form; onChange: (form: Form) => void }) => {
  const theme = useTheme();
  const set = (key: keyof Form) => (value: string) => onChange({ ...form, [key]: value });
  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Adresse du bien
        </ThemedText>
        <TextInput
          accessibilityLabel="Adresse du bien"
          placeholder="Ex. 12 rue Lenepveu, Angers"
          placeholderTextColor={theme.textSecondary}
          value={form.address}
          onChangeText={set('address')}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
      </View>
      <View style={styles.chips}>
        <Chip label="Appartement" selected={form.propertyType === 'apartment'} onPress={() => onChange({ ...form, propertyType: 'apartment' })} />
        <Chip label="Maison" selected={form.propertyType === 'house'} onPress={() => onChange({ ...form, propertyType: 'house' })} />
        <Chip label="Neuf (VEFA)" selected={form.isNewBuild} onPress={() => onChange({ ...form, isNewBuild: !form.isNewBuild })} />
      </View>
      <View style={styles.fields}>
        <NumberField label="Prix demandé" unit="€" value={form.askedPrice} onChange={set('askedPrice')} />
        <NumberField label="Surface habitable" unit="m²" value={form.surface} onChange={set('surface')} />
        <NumberField label="Pièces principales" value={form.rooms} onChange={set('rooms')} />
        {form.propertyType === 'house' && (
          <NumberField label="Terrain" unit="m²" value={form.land} onChange={set('land')} />
        )}
        <NumberField label="Parking / cave" value={form.dependencies} onChange={set('dependencies')} />
      </View>
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Classe énergie (DPE), si connue
        </ThemedText>
        <View style={styles.chips}>
          {ENERGY_CLASSES.map((energy) => (
            <Chip
              key={energy}
              label={energy}
              selected={form.energyClass === energy}
              onPress={() => onChange({ ...form, energyClass: form.energyClass === energy ? null : energy })}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const AnalysisView = ({ analysis }: { analysis: Analysis }) => {
  const theme = useTheme();
  const { estimate, place, form } = analysis;
  const surface = parseNumber(form.surface);
  const rooms = parseNumber(form.rooms);
  const asked = parseNumber(form.askedPrice);
  const segment: Segment = {
    propertyType: form.propertyType,
    rooms: form.propertyType === 'house' ? 'all' : roomsBucket(rooms),
  };
  const year = place ? latestFullYear(place.prices, segment) : undefined;
  const rent = place && year ? yieldFor(place.yields, segment, year.period) : undefined;
  const rentMonthly = rent ? Math.round((rent.rent_m2 * surface) / 10) * 10 : 0;
  const deal = analyzeDeal(
    {
      price: asked,
      surfaceM2: surface,
      isNewBuild: form.isNewBuild,
      agencyFees: 0,
      works: 0,
      furniture: 0,
      rentMonthly,
      vacancyMonths: DEFAULTS.vacancyMonths,
      taxeFonciereYearly: rentMonthly, // ~1 month of rent until REI rates are ingested
      nonRecoverableChargesYearly: 0,
      pnoInsuranceYearly: DEFAULTS.pnoInsuranceYearly,
      managementShare: DEFAULTS.managementShare,
      maintenanceShare: DEFAULTS.maintenanceShare,
      downPayment: Math.round(asked * (1 + FR_RULES.notaryRateOld) * DEFAULTS.downPaymentShare),
      loanRate: DEFAULTS.loanRate,
      loanYears: DEFAULTS.loanYears,
      loanInsuranceRate: DEFAULTS.loanInsuranceRate,
      incomeMonthly: 0,
      existingDebtMonthly: 0,
    },
    year ? { medianPriceM2: year.median_price_m2, p25PriceM2: year.p25_price_m2, p75PriceM2: year.p75_price_m2 } : undefined,
  );
  const priceVerdict: PriceVerdict =
    estimate.data_density === 'sparse' || !estimate.verdict ? 'unknown' : estimate.verdict;
  const risk = assessRisk({
    highVacancy: Boolean(place?.socio?.flag_high_vacancy),
    populationDecline: Boolean(place?.socio?.flag_population_decline),
    dataDensity: estimate.data_density,
    coarseLocation: estimate.location_precision === 'commune',
    energyClass: form.energyClass,
    currentYear: new Date().getFullYear(),
  });
  const cashFlow = cashFlowVerdict(deal.cashFlowMonthly);
  const effects = estimate.explanation.effects.slice(0, MAX_EFFECTS);
  const otherEffects = estimate.explanation.effects.slice(MAX_EFFECTS);
  const otherProduct = otherEffects.reduce((product, e) => product * (1 + e.effect_pct), 1) - 1;

  return (
    <View style={styles.analysis}>
      <View style={styles.block}>
        <ThemedText type="small" themeColor="textSecondary">
          {estimate.location?.label ?? estimate.code_commune}
        </ThemedText>
        <VerdictBadges price={priceVerdict} cashFlow={cashFlow} risk={risk.level} />
        <ThemedText>{summary(priceVerdict, cashFlow, risk.level)}</ThemedText>
      </View>

      <Block
        title="1. Le prix est-il juste ?"
        source={`Modèle ${estimate.model_version} entraîné sur les ventes signées DVF, niveau de marché ${formatPeriod(
          estimate.reference_period,
        )}. Fourchette à ${formatPercent(estimate.interval_coverage)} : ${formatPercent(
          estimate.interval_coverage,
        )} des ventes réelles tombent dedans. Le modèle ne voit ni l'état, ni l'étage, ni la vue.`}>
        <View style={styles.tiles}>
          <KpiTile
            label="Prix estimé"
            value={formatEuros(estimate.price)}
            detail={`${formatEurosPerM2(estimate.price_m2)} · fourchette ${formatEuros(estimate.price_low)} – ${formatEuros(estimate.price_high)}`}
            lowConfidence={estimate.data_density === 'sparse'}
          />
          <KpiTile
            label="Prix demandé vs estimation"
            value={formatSignedPercent(estimate.asked_vs_estimate)}
            detailColor={priceVerdict === 'above' ? 'negative' : priceVerdict === 'below' ? 'positive' : undefined}
            detail={`${formatEurosPerM2(asked / surface)} demandés`}
          />
        </View>
        <PriceRangeBar low={estimate.price_low} estimate={estimate.price} high={estimate.price_high} asked={asked} />

        <ThemedText type="smallBold">Pourquoi ce prix</ThemedText>
        <View style={[styles.table, { borderColor: theme.border }]}>
          <View style={styles.tableRow}>
            <ThemedText type="small" style={styles.tableLabel}>
              Prix de départ (bien moyen en France)
            </ThemedText>
            <ThemedText type="small">{formatEurosPerM2(estimate.explanation.base_price_m2)}</ThemedText>
          </View>
          {effects.map((effect) => (
            <View key={effect.group} style={styles.tableRow}>
              <ThemedText type="small" style={styles.tableLabel}>
                {EFFECT_LABELS[effect.group] ?? effect.group}
              </ThemedText>
              <ThemedText type="small" themeColor={effect.effect_pct >= 0 ? 'positive' : 'negative'}>
                {formatSignedPercent(effect.effect_pct)}
              </ThemedText>
            </View>
          ))}
          {otherEffects.length > 0 && (
            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.tableLabel}>
                Autres facteurs
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatSignedPercent(otherProduct)}
              </ThemedText>
            </View>
          )}
          <View style={styles.tableRow}>
            <ThemedText type="smallBold" style={styles.tableLabel}>
              Estimation pour ce bien
            </ThemedText>
            <ThemedText type="smallBold">{formatEurosPerM2(estimate.price_m2)}</ThemedText>
          </View>
        </View>

        <ThemedText type="smallBold">Ventes comparables récentes</ThemedText>
        {estimate.comparables.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Aucune vente comparable (même type, surface ±25 %) sur les 24 derniers mois.
          </ThemedText>
        ) : (
          <View style={[styles.table, { borderColor: theme.border }]}>
            {estimate.comparables.map((sale, i) => (
              <View key={i} style={styles.tableRow}>
                <ThemedText type="small" style={styles.tableLabel}>
                  {sale.month} · {formatDecimal(sale.surface_m2)} m²{sale.rooms ? ` · T${sale.rooms}` : ''}
                  {sale.same_section ? ' · même quartier' : ' · même commune'}
                </ThemedText>
                <ThemedText type="small">
                  {formatEuros(sale.price)} ({formatEurosPerM2(sale.price_m2)})
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </Block>

      <Block
        title="2. Ça se loue combien ?"
        source="Carte des loyers ANIL : loyers d'annonce charges comprises. Part de locataires : INSEE, recensement.">
        {rent ? (
          <View style={styles.tiles}>
            <KpiTile
              label="Loyer estimé"
              value={`${formatEuros(rentMonthly)} / mois`}
              detail={`${formatRentPerM2(rent.rent_m2)} (${formatRentPerM2(rent.rent_low_m2)} – ${formatRentPerM2(rent.rent_high_m2)})${
                rent.rent_source === 'maille' ? ' · estimé sur les communes voisines' : ''
              }`}
            />
            <KpiTile
              label="Locataires dans la commune"
              value={formatPercent(place?.socio?.renter_share)}
              detail="Plus il y a de locataires, plus la demande locative est profonde"
            />
          </View>
        ) : (
          <ThemedText themeColor="textSecondary">Pas de loyer publié pour ce type de bien ici.</ThemedText>
        )}
      </Block>

      <Block
        title="3. Est-ce que l'argent tourne ?"
        source={`Hypothèses : apport 10 %, crédit ${formatPercent(DEFAULTS.loanRate)} sur ${DEFAULTS.loanYears} ans, 1 mois de vacance, taxe foncière ≈ 1 mois de loyer. Avant impôt.`}>
        <View style={styles.tiles}>
          <KpiTile
            label="Cash-flow avant impôt"
            value={`${formatEuros(deal.cashFlowMonthly)} / mois`}
            detailColor={deal.cashFlowMonthly >= 0 ? 'positive' : 'negative'}
            detail={`Mensualité ${formatEuros(deal.paymentMonthly)}`}
          />
          <KpiTile
            label="Rentabilité brute / nette"
            value={`${formatPercent(deal.grossYield)} / ${formatPercent(deal.netYield)}`}
            detail={`Coût total ${formatEuros(deal.totalCost)}`}
          />
        </View>
        <Link
          href={{
            pathname: '/simulator',
            params: {
              level: levelOf(estimate.code_commune),
              code: estimate.code_commune,
              type: segment.propertyType,
              rooms: segment.rooms,
              price: String(asked),
              surface: String(surface),
              rent: String(rentMonthly),
            },
          }}
          style={StyleSheet.flatten([styles.cta, { borderColor: theme.accent }])}>
          <ThemedText type="smallBold" themeColor="accent">
            Ajuster le financement dans le simulateur →
          </ThemedText>
        </Link>
      </Block>

      <Block title="4. Quels risques ?" source="INSEE (vacance, démographie), loi Climat et résilience (DPE), densité de ventes DVF.">
        {risk.reasons.length === 0 ? (
          <ThemedText>Aucun signal de risque majeur dans les données disponibles.</ThemedText>
        ) : (
          risk.reasons.map((reason) => <ThemedText key={reason}>• {reason}</ThemedText>)
        )}
        {!form.energyClass && (
          <ThemedText type="small" themeColor="textSecondary">
            DPE inconnu : les logements G ne peuvent plus être loués depuis {RENTAL_BAN_YEAR.G}, les F à partir de{' '}
            {RENTAL_BAN_YEAR.F}, les E en {RENTAL_BAN_YEAR.E}.
          </ThemedText>
        )}
      </Block>

      {place && year && (
        <Block title="5. Le quartier" source="DVF, ventes signées.">
          <View style={styles.tiles}>
            <KpiTile
              label={`Prix médian ${formatPeriod(year.period)}`}
              value={formatEurosPerM2(year.median_price_m2)}
              detail={`${formatSignedPercent(year.yoy_change)} sur un an · ${formatCount(year.n_sales)} ventes`}
            />
            <KpiTile
              label="Population"
              value={formatCount(place.socio?.population)}
              detail={`${formatSignedPercent(place.socio?.population_growth_yearly)} par an`}
            />
          </View>
          <Link href={`/place/${place.level}/${place.code}`}>
            <ThemedText type="smallBold" themeColor="accent">
              Voir toute la page {place.name} →
            </ThemedText>
          </Link>
        </Block>
      )}
    </View>
  );
};

type ListingParams = { address?: string; type?: string; surface?: string; rooms?: string; price?: string };

/** Values sent by the browser extension (apps/extension) or a shared link; the user still confirms. */
const formFromParams = (params: ListingParams): Form => ({
  ...INITIAL_FORM,
  ...(params.address && { address: params.address }),
  ...((params.type === 'apartment' || params.type === 'house') && { propertyType: params.type }),
  ...(params.surface && { surface: params.surface }),
  ...(params.rooms && { rooms: params.rooms }),
  ...(params.price && { askedPrice: params.price }),
});

export default function PropertyScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<ListingParams>();
  const [form, setForm] = useState<Form>(() => formFromParams(params));
  const fromListing = Boolean(params.price || params.surface);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const estimate = await requestEstimate({
        address: form.address,
        property_type: form.propertyType,
        surface_m2: parseNumber(form.surface),
        rooms: parseNumber(form.rooms),
        land_m2: form.propertyType === 'house' ? parseNumber(form.land) : 0,
        n_dependencies: parseNumber(form.dependencies),
        is_new_build: form.isNewBuild,
        asked_price: parseNumber(form.askedPrice),
      });
      // the area page may not exist (too few sales): the dashboard still shows the estimate
      const place = await loadPlace(levelOf(estimate.code_commune), estimate.code_commune).catch(() => null);
      setAnalysis({ estimate, place, form });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Analyser un bien' }} />
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText type="subtitle">Analyser un bien</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Prix, loyer, rentabilité et risques d&apos;un bien précis, à partir des ventes signées et des données
            publiques. Une estimation, pas une expertise.
          </ThemedText>
        </View>
        {fromListing && (
          <ThemedText type="small" themeColor="warningText">
            Champs repris de l&apos;annonce : vérifiez-les et complétez l&apos;adresse exacte avant d&apos;analyser.
          </ThemedText>
        )}
        <PropertyForm form={form} onChange={setForm} />
        <Pressable
          accessibilityRole="button"
          disabled={loading || form.address.trim().length < 5}
          onPress={analyze}
          style={[styles.submit, { backgroundColor: theme.accent, opacity: loading || form.address.trim().length < 5 ? 0.5 : 1 }]}>
          {loading ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" themeColor="onAccent">
              Analyser
            </ThemedText>
          )}
        </Pressable>
        {error && <ThemedText themeColor="negative">{error}</ThemedText>}
        {analysis && <AnalysisView analysis={analysis} />}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.four },
  header: { gap: Spacing.one },
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  submit: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Spacing.five, paddingVertical: 12, minWidth: 140, alignItems: 'center' },
  analysis: { gap: Spacing.five },
  block: { gap: Spacing.three },
  blockTitle: { fontSize: 22, lineHeight: 28 },
  source: { fontSize: 12, lineHeight: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: Spacing.three },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.two },
  tableLabel: { flex: 1 },
  cta: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: 10 },
});
