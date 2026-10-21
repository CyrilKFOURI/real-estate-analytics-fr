import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { KpiTile } from '@/components/kpi-tile';
import { NumberField, parseNumber } from '@/components/number-field';
import { Chip } from '@/components/segment-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { analyzeDeal, type DealInput, type MarketReference } from '@/core-kpi/deal';
import { chargesProvisionM2 } from '@/core-kpi/typical-deal';
import { DEFAULTS, FR_RULES, TAX_RULES } from '@/core-kpi/rules';
import { breakEvenOccupancy, brrrr, leverageEffect, projectDeal } from '@/core-kpi/projection';
import { compareTaxRegimes, type TaxRegime } from '@/core-kpi/tax';
import { loadPlace } from '@/data/api';
import { formatDecimal, formatEuros, formatEurosPerM2, formatPercent, formatSignedPercent } from '@/data/format';
import { latestFullYear, type Segment, yieldFor } from '@/data/select';
import type { DwellingType, GeoLevel, PropertyType, RoomsBucket } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

// Form values are kept as text so that "3," can be typed; parsed on every render.
type Form = Record<keyof Omit<DealInput, 'isNewBuild'>, string>;

const round = (value: number, step: number) => String(Math.round(value / step) * step);

const DEFAULT_FORM: Form = {
  price: '200000',
  surfaceM2: '50',
  agencyFees: '0',
  works: '0',
  furniture: '0',
  rentMonthly: '800',
  vacancyMonths: String(DEFAULTS.vacancyMonths),
  taxeFonciereYearly: '800',
  nonRecoverableChargesYearly: '0',
  pnoInsuranceYearly: String(DEFAULTS.pnoInsuranceYearly),
  managementShare: String(DEFAULTS.managementShare * 100),
  maintenanceShare: String(DEFAULTS.maintenanceShare * 100),
  downPayment: '21500',
  loanRate: String(DEFAULTS.loanRate * 100),
  loanYears: String(DEFAULTS.loanYears),
  loanInsuranceRate: String(DEFAULTS.loanInsuranceRate * 100),
  incomeMonthly: '3000',
  existingDebtMonthly: '0',
};

// Fields typed as percentages in the form but stored as shares in DealInput.
const PERCENT_FIELDS = new Set<keyof Form>(['managementShare', 'maintenanceShare', 'loanRate', 'loanInsuranceRate']);

const toInput = (form: Form, isNewBuild: boolean): DealInput => {
  const values = Object.fromEntries(
    Object.entries(form).map(([key, text]) => {
      const value = parseNumber(text);
      return [key, PERCENT_FIELDS.has(key as keyof Form) ? value / 100 : value];
    }),
  ) as Omit<DealInput, 'isNewBuild'>;
  return { ...values, isNewBuild };
};

type Prefill = {
  form: Partial<Form>;
  market?: MarketReference;
  label: string;
  rentNote?: string;
  /** The commune's annualised price trend, used as the default resale assumption. */
  priceTrend?: { cagr: number; since: number };
};

/** Typical property of the segment, precomputed by the pipeline (typical_deal): median price and
 * surface, ANIL rent read at that surface minus the charges provision (D18), taxe foncière estimate. */
const prefillFromPlace = async (level: GeoLevel, code: string, segment: Segment): Promise<Prefill | null> => {
  const place = await loadPlace(level, code);
  const year = latestFullYear(place.prices, segment);
  if (!year) {
    return null;
  }
  const typical =
    segment.propertyType === 'all' ? undefined : place.typical_deal?.[segment.propertyType]?.[segment.rooms];
  const rent = yieldFor(place.yields, segment, year.period);
  const price = Math.round((typical?.price ?? year.median_price) / 1000) * 1000;
  const surface = typical?.surface_m2 ?? year.median_surface_m2 ?? year.median_price / year.median_price_m2;
  return {
    label: `${place.name ?? code}, bien type ${year.period} (prix et surface médians)`,
    market: { medianPriceM2: year.median_price_m2, p25PriceM2: year.p25_price_m2, p75PriceM2: year.p75_price_m2 },
    priceTrend: year.cagr != null && year.cagr_since != null ? { cagr: year.cagr, since: year.cagr_since } : undefined,
    rentNote:
      rent && typical
        ? `Loyer d'annonce ANIL ${formatDecimal(rent.rent_m2)} €/m² charges comprises, moins ${formatDecimal(
            chargesProvisionM2(segment.propertyType as DwellingType),
          )} €/m² de charges récupérables (estimation, modifiable).`
        : undefined,
    form: {
      price: String(price),
      surfaceM2: String(Math.round(surface)),
      ...(typical && {
        rentMonthly: round(typical.rent_monthly, 10),
        taxeFonciereYearly: round(typical.taxe_fonciere_yearly, 10),
      }),
      downPayment: round(price * (1 + FR_RULES.notaryRateOld) * DEFAULTS.downPaymentShare, 500),
    },
  };
};

type SectionProps = { title: string; children: React.ReactNode };
const Section = ({ title, children }: SectionProps) => (
  <View style={styles.section}>
    <ThemedText type="smallBold">{title}</ThemedText>
    <View style={styles.fields}>{children}</View>
  </View>
);

const REGIME_LABELS: Record<TaxRegime, string> = {
  micro_foncier: 'Nu · micro-foncier',
  reel_foncier: 'Nu · réel',
  lmnp_micro: 'Meublé LMNP · micro-BIC',
  lmnp_reel: 'Meublé LMNP · réel',
};

const MARKET_LABELS = { below: 'sous la fourchette du marché', within: 'dans la fourchette du marché', above: 'au-dessus de la fourchette du marché' };

export default function SimulatorScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    level?: GeoLevel;
    code?: string;
    type?: PropertyType;
    rooms?: RoomsBucket;
    // values of a specific property, sent by the property dashboard; they win over the commune prefill
    price?: string;
    surface?: string;
    rent?: string;
  }>();
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [isNewBuild, setIsNewBuild] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [marginalRate, setMarginalRate] = useState(0.3);
  const [horizon, setHorizon] = useState(15);
  const [growth, setGrowth] = useState({ price: '', rent: '1,5', selling: '0', arv: '' });

  useEffect(() => {
    if (!params.level || !params.code) {
      return;
    }
    const segment: Segment = { propertyType: params.type ?? 'apartment', rooms: params.rooms ?? 'all' };
    let current = true;
    const overrides: Partial<Form> = {
      ...(params.price && {
        price: params.price,
        downPayment: round(Number(params.price) * (1 + FR_RULES.notaryRateOld) * DEFAULTS.downPaymentShare, 500),
      }),
      ...(params.surface && { surfaceM2: params.surface }),
      ...(params.rent && { rentMonthly: params.rent }),
    };
    prefillFromPlace(params.level, params.code, segment).then((result) => {
      if (current && result) {
        setPrefill(result);
        setForm((previous) => ({ ...previous, ...result.form, ...overrides }));
      }
    });
    return () => {
      current = false;
    };
  }, [params.level, params.code, params.type, params.rooms, params.price, params.surface, params.rent]);

  const input = useMemo(() => toInput(form, isNewBuild), [form, isNewBuild]);
  const result = useMemo(() => analyzeDeal(input, prefill?.market), [input, prefill]);
  const taxes = useMemo(() => compareTaxRegimes(input, result, marginalRate), [input, result, marginalRate]);
  const bestRegime = taxes
    .filter((tax) => tax.eligible)
    .reduce((best, tax) => (tax.cashFlowAfterTaxMonthly > best.cashFlowAfterTaxMonthly ? tax : best));
  // resale assumption: the commune's own trend when known (capped to ±5 %/yr), else +1 %/yr
  const trend = prefill?.priceTrend ? Math.max(-0.05, Math.min(0.05, prefill.priceTrend.cagr)) : 0.01;
  const priceGrowth = growth.price === '' ? trend : parseNumber(growth.price) / 100;
  const projection = useMemo(
    () =>
      projectDeal(input, result, {
        horizonYears: horizon,
        priceGrowth,
        rentGrowth: parseNumber(growth.rent) / 100,
        sellingCostShare: parseNumber(growth.selling) / 100,
        regime: bestRegime.regime,
        marginalRate,
      }),
    [input, result, horizon, priceGrowth, growth.rent, growth.selling, bestRegime.regime, marginalRate],
  );
  const leverage = leverageEffect(input, result);
  const occupancy = breakEvenOccupancy(input, result);
  const arv = parseNumber(growth.arv);
  const refinancing = arv > 0 ? brrrr(arv, result, input.works) : null;
  const field = (key: keyof Form) => ({ value: form[key], onChange: (text: string) => setForm({ ...form, [key]: text }) });
  const cashFlowColor = result.cashFlowMonthly >= 0 ? 'positive' : 'negative';

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Simulateur' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Simuler un achat</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {prefill
              ? `Pré-rempli : ${prefill.label}. Tous les champs sont modifiables.`
              : 'Valeurs d’exemple : modifiez-les ou ouvrez le simulateur depuis une commune.'}
          </ThemedText>
        </View>

        <View style={styles.tiles}>
          <KpiTile
            label="Cash-flow avant impôt"
            value={`${formatEuros(result.cashFlowMonthly)} / mois`}
            detailColor={cashFlowColor}
            detail={result.cashFlowMonthly >= 0 ? 'Le loyer couvre tout' : 'Effort d’épargne mensuel'}
          />
          <KpiTile
            label="Rentabilité brute / nette"
            value={`${formatPercent(result.grossYield)} / ${formatPercent(result.netYield)}`}
            detail={`Sur le coût total ${formatEuros(result.totalCost)} (frais de notaire ${formatEuros(result.notaryFees)})`}
          />
          <KpiTile
            label="Mensualité du crédit"
            value={formatEuros(result.paymentMonthly)}
            detail={`Emprunt ${formatEuros(result.loanAmount)} · DSCR ${result.dscr == null ? '—' : formatDecimal(result.dscr)}`}
          />
          <KpiTile
            label="Taux d'endettement (HCSF)"
            value={formatPercent(result.hcsfDebtRatio)}
            detailColor={result.hcsfOk ? 'positive' : 'negative'}
            detail={
              result.hcsfOk
                ? `Sous la limite de ${formatPercent(FR_RULES.hcsfMaxDebtRatio)}`
                : `Au-delà de ${formatPercent(FR_RULES.hcsfMaxDebtRatio)} ou plus de ${FR_RULES.hcsfMaxYears} ans : les banques refusent en général`
            }
          />
          <KpiTile
            label="Rendement des fonds propres"
            value={formatPercent(result.cashOnCash)}
            detail={result.cashOnCash == null ? 'Sans apport, ce ratio est infini' : 'Cash-flow annuel / apport'}
          />
          <KpiTile
            label="Test rapide 70 %"
            value={`${formatEuros(result.quickTestMonthly)} / mois`}
            detailColor={result.quickTestMonthly >= 0 ? 'positive' : 'negative'}
            detail="70 % du loyer moins la mensualité (règle de Delagrandanne)"
          />
        </View>

        {result.priceVsMarket != null && result.marketPosition && (
          <ThemedText type="small" themeColor="textSecondary">
            Prix {formatEurosPerM2(result.priceM2)} : {formatSignedPercent(result.priceVsMarket)} par rapport à la
            médiane des ventes signées, {MARKET_LABELS[result.marketPosition]}.
          </ThemedText>
        )}

        <View style={styles.section}>
          <ThemedText type="smallBold">Après impôt, première année</ThemedText>
          <View style={styles.rateRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Votre tranche d&apos;imposition (TMI) :
            </ThemedText>
            {TAX_RULES.marginalRates.map((rate) => (
              <Chip key={rate} label={formatPercent(rate)} selected={marginalRate === rate} onPress={() => setMarginalRate(rate)} />
            ))}
          </View>
          <View style={[styles.table, { borderColor: theme.border }]}>
            {taxes.map((tax) => (
              <View key={tax.regime} style={styles.tableRow}>
                <View style={styles.tableLabel}>
                  <ThemedText type="small">
                    {REGIME_LABELS[tax.regime]}
                    {tax.regime === bestRegime.regime ? ' ★' : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                    {!tax.eligible
                      ? 'Non accessible : loyers au-dessus du plafond'
                      : tax.deficit > 0
                        ? `Déficit ${formatEuros(tax.deficit)} (imputable sur vos revenus jusqu'à ${formatEuros(TAX_RULES.deficitFoncierCap)}, hors intérêts)`
                        : tax.carriedDepreciation > 0
                          ? `Amortissement reporté ${formatEuros(tax.carriedDepreciation)}`
                          : `Impôt ${formatEuros(tax.totalTax)} / an`}
                    {tax.eligible ? ` · rentabilité nette-nette ${formatPercent(tax.netNetYield)}` : ''}
                  </ThemedText>
                </View>
                <ThemedText
                  type="smallBold"
                  themeColor={!tax.eligible ? 'textSecondary' : tax.cashFlowAfterTaxMonthly >= 0 ? 'positive' : 'negative'}>
                  {tax.eligible ? `${formatEuros(tax.cashFlowAfterTaxMonthly)} / mois` : '—'}
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Cash-flow après impôt sur le revenu et prélèvements sociaux ({formatPercent(TAX_RULES.socialRate)}). Même loyer
            nu ou meublé ; en meublé le loyer est souvent plus élevé. LMNP réel : amortissement du bâti sur{' '}
            {TAX_RULES.buildingYears} ans (terrain {formatPercent(TAX_RULES.landShare)} exclu), des meubles sur{' '}
            {TAX_RULES.furnitureYears} ans ; depuis 2025, les amortissements sont réintégrés dans la plus-value à la revente.
            Comptabilité LMNP réel : ~300 à 600 € / an non comptés.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Sur la durée, revente comprise ({REGIME_LABELS[bestRegime.regime]})</ThemedText>
          <View style={styles.rateRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Revente après :
            </ThemedText>
            {[10, 15, 20].map((years) => (
              <Chip key={years} label={`${years} ans`} selected={horizon === years} onPress={() => setHorizon(years)} />
            ))}
          </View>
          <View style={styles.tiles}>
            <KpiTile
              label="Taux de rendement interne (TRI)"
              value={formatPercent(projection.irr)}
              detail={`Apport ${formatEuros(projection.equityInvested)} · multiplié par ${
                projection.equityMultiple == null ? '—' : formatDecimal(projection.equityMultiple)
              }`}
            />
            <KpiTile
              label={`Revente dans ${horizon} ans`}
              value={formatEuros(projection.salePrice)}
              detail={`Net après crédit restant et impôt sur la plus-value (${formatEuros(projection.capitalGainsTax)}) : ${formatEuros(projection.netSaleProceeds)}`}
            />
            <KpiTile
              label="Effet de levier du crédit"
              value={leverage.positive ? 'Positif' : 'Négatif'}
              detailColor={leverage.positive ? 'positive' : 'negative'}
              detail={`Le bien rapporte ${formatPercent(leverage.propertyReturn)} net, le crédit coûte ${formatPercent(leverage.debtCost)}`}
            />
            <KpiTile
              label="Taux d'occupation minimal"
              value={formatPercent(occupancy)}
              detailColor={occupancy != null && occupancy > 0.92 ? 'negative' : undefined}
              detail="En dessous, les loyers ne couvrent plus charges fixes et crédit"
            />
          </View>
          <View style={styles.fields}>
            <NumberField
              label="Évolution du prix"
              unit="% / an"
              value={growth.price}
              onChange={(text) => setGrowth({ ...growth, price: text })}
              hint={
                growth.price === ''
                  ? prefill?.priceTrend
                    ? `Tendance de la commune depuis ${prefill.priceTrend.since} : ${formatSignedPercent(prefill.priceTrend.cagr)} / an`
                    : 'Par défaut +1 % / an'
                  : undefined
              }
            />
            <NumberField
              label="Évolution des loyers et charges"
              unit="% / an"
              value={growth.rent}
              onChange={(text) => setGrowth({ ...growth, rent: text })}
            />
            <NumberField
              label="Frais de vente"
              unit="%"
              value={growth.selling}
              onChange={(text) => setGrowth({ ...growth, selling: text })}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Plus-value : abattements pour durée de détention (impôt nul après 22 ans, prélèvements sociaux après 30),
            forfaits frais d&apos;acquisition 7,5 % et travaux 15 % après 5 ans ; surtaxe au-delà de 50 000 € de
            plus-value non comptée.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Stratégie BRRRR (acheter, rénover, louer, refinancer)</ThemedText>
          <View style={styles.fields}>
            <NumberField
              label="Valeur après travaux"
              unit="€"
              value={growth.arv}
              onChange={(text) => setGrowth({ ...growth, arv: text })}
              hint="Prix d'un bien rénové comparable : fourchette haute de la commune"
            />
          </View>
          {refinancing && (
            <View style={styles.tiles}>
              <KpiTile
                label="Prix d'achat maximum (règle des 70 %)"
                value={formatEuros(refinancing.maxOffer)}
                detailColor={input.price <= refinancing.maxOffer ? 'positive' : 'negative'}
                detail={input.price <= refinancing.maxOffer ? 'Le prix respecte la règle' : 'Prix trop élevé pour la règle'}
              />
              <KpiTile
                label="Refinancement à 75 %"
                value={formatEuros(refinancing.refinance)}
                detail={
                  refinancing.allCashBack
                    ? `Tout l'apport récupéré, ${formatEuros(refinancing.cashOut)} en plus`
                    : `Reste investi : ${formatEuros(refinancing.cashLeft)}`
                }
              />
            </View>
          )}
        </View>

        <Section title="Le bien">
          <NumberField label="Prix d'achat" unit="€" {...field('price')} />
          <NumberField label="Surface" unit="m²" {...field('surfaceM2')} />
          <NumberField label="Frais d'agence" unit="€" {...field('agencyFees')} />
          <NumberField label="Travaux" unit="€" {...field('works')} />
          <NumberField label="Meubles" unit="€" {...field('furniture')} />
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isNewBuild }}
            onPress={() => setIsNewBuild(!isNewBuild)}
            style={[styles.toggle, { borderColor: isNewBuild ? theme.accent : theme.border }]}>
            <ThemedText type="small">
              {isNewBuild ? '✓ Neuf : frais de notaire 2,5 %' : 'Ancien : frais de notaire 7,5 % (toucher pour neuf)'}
            </ThemedText>
          </Pressable>
        </Section>

        <Section title="Loyer et charges">
          <NumberField label="Loyer mensuel hors charges" unit="€" hint={prefill?.rentNote} {...field('rentMonthly')} />
          <NumberField label="Vacance" unit="mois / an" {...field('vacancyMonths')} />
          <NumberField
            label="Taxe foncière"
            unit="€ / an"
            hint={prefill ? 'Estimée avec le taux de taxe foncière de la commune : mettez le vrai montant' : undefined}
            {...field('taxeFonciereYearly')}
          />
          <NumberField label="Charges de copro non récupérables" unit="€ / an" {...field('nonRecoverableChargesYearly')} />
          <NumberField label="Assurance propriétaire (PNO)" unit="€ / an" {...field('pnoInsuranceYearly')} />
          <NumberField label="Gestion locative" unit="% des loyers" {...field('managementShare')} />
          <NumberField label="Provision entretien" unit="% des loyers" {...field('maintenanceShare')} />
        </Section>

        <Section title="Financement">
          <NumberField label="Apport" unit="€" {...field('downPayment')} />
          <NumberField label="Taux du crédit" unit="%" {...field('loanRate')} />
          <NumberField label="Durée" unit="ans" {...field('loanYears')} />
          <NumberField label="Assurance emprunteur" unit="% / an" {...field('loanInsuranceRate')} />
        </Section>

        <Section title="Vous (pour le calcul de la banque)">
          <NumberField label="Revenus nets" unit="€ / mois" {...field('incomeMonthly')} />
          <NumberField label="Crédits en cours" unit="€ / mois" {...field('existingDebtMonthly')} />
        </Section>

        <ThemedText type="small" themeColor="textSecondary">
          Règles françaises vérifiées le {FR_RULES.checkedOn}. Simulation indicative de première année, pas un conseil
          d’investissement ni un conseil fiscal.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.four },
  header: { gap: Spacing.one },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.two },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  toggle: { flexBasis: '100%', borderWidth: 1, borderRadius: 10, padding: Spacing.three },
  rateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: Spacing.three },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  tableLabel: { flex: 1, gap: 2 },
  note: { fontSize: 12, lineHeight: 16 },
});
