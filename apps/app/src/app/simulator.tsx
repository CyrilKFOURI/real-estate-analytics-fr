import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { KpiTile } from '@/components/kpi-tile';
import { NumberField, parseNumber } from '@/components/number-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { analyzeDeal, type DealInput, type MarketReference } from '@/core-kpi/deal';
import { DEFAULTS, FR_RULES } from '@/core-kpi/rules';
import { loadPlace } from '@/data/api';
import { formatDecimal, formatEuros, formatEurosPerM2, formatPercent, formatSignedPercent } from '@/data/format';
import { latestFullYear, type Segment, yieldFor } from '@/data/select';
import type { GeoLevel, PropertyType, RoomsBucket } from '@/data/types';
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

type Prefill = { form: Partial<Form>; market?: MarketReference; label: string; rentNote?: string };

/** Typical property of the segment: median price, surface = median price / median €/m², ANIL rent. */
const prefillFromPlace = async (level: GeoLevel, code: string, segment: Segment): Promise<Prefill | null> => {
  const place = await loadPlace(level, code);
  const year = latestFullYear(place.prices, segment);
  if (!year) {
    return null;
  }
  const surface = year.median_price / year.median_price_m2;
  const rent = yieldFor(place.yields, segment, year.period);
  const price = Math.round(year.median_price / 1000) * 1000;
  const rentMonthly = rent ? rent.rent_m2 * surface : undefined;
  return {
    label: `${place.name ?? code}, prix et surface médians ${year.period}`,
    market: { medianPriceM2: year.median_price_m2, p25PriceM2: year.p25_price_m2, p75PriceM2: year.p75_price_m2 },
    rentNote: rent
      ? `Loyer d'annonce ANIL ${formatDecimal(rent.rent_m2)} €/m² charges comprises : retirez les charges récupérables.`
      : undefined,
    form: {
      price: String(price),
      surfaceM2: String(Math.round(surface)),
      ...(rentMonthly && {
        rentMonthly: round(rentMonthly, 10),
        // rough rule of thumb until taxe foncière rates (REI) are ingested: about one month of rent
        taxeFonciereYearly: round(rentMonthly, 10),
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

const MARKET_LABELS = { below: 'sous la fourchette du marché', within: 'dans la fourchette du marché', above: 'au-dessus de la fourchette du marché' };

export default function SimulatorScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ level?: GeoLevel; code?: string; type?: PropertyType; rooms?: RoomsBucket }>();
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [isNewBuild, setIsNewBuild] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  useEffect(() => {
    if (!params.level || !params.code) {
      return;
    }
    const segment: Segment = { propertyType: params.type ?? 'apartment', rooms: params.rooms ?? 'all' };
    let current = true;
    prefillFromPlace(params.level, params.code, segment).then((result) => {
      if (current && result) {
        setPrefill(result);
        setForm((previous) => ({ ...previous, ...result.form }));
      }
    });
    return () => {
      current = false;
    };
  }, [params.level, params.code, params.type, params.rooms]);

  const result = useMemo(() => analyzeDeal(toInput(form, isNewBuild), prefill?.market), [form, isNewBuild, prefill]);
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
            hint={prefill ? 'Estimation grossière (~1 mois de loyer) : mettez le vrai montant' : undefined}
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
          Avant impôt : la fiscalité (micro-foncier, réel, LMNP) arrive dans une prochaine étape. Règles françaises
          vérifiées le {FR_RULES.checkedOn}. Simulation indicative, pas un conseil d’investissement.
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
});
