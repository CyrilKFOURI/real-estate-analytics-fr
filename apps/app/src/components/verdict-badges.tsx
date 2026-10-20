import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import type { CashFlowVerdict, PriceVerdict, RiskLevel } from '@/core-kpi/assessment';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'good' | 'neutral' | 'bad';

const TONE_COLORS: Record<Tone, ThemeColor> = { good: 'positive', neutral: 'textSecondary', bad: 'negative' };

const PRICE: Record<PriceVerdict, [string, Tone]> = {
  below: ['Sous le marché', 'good'],
  consistent: ['Dans le marché', 'neutral'],
  above: ['Au-dessus du marché', 'bad'],
  unknown: ['Données insuffisantes', 'neutral'],
};
const CASH_FLOW: Record<CashFlowVerdict, [string, Tone]> = {
  positive: ['Positif', 'good'],
  balanced: ['À l’équilibre', 'neutral'],
  negative: ['Négatif', 'bad'],
};
const RISK: Record<RiskLevel, [string, Tone]> = {
  low: ['Faible', 'good'],
  medium: ['Moyen', 'neutral'],
  high: ['Élevé', 'bad'],
};

const Badge = ({ title, label, tone }: { title: string; label: string; tone: Tone }) => {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.backgroundElement, borderColor: theme[TONE_COLORS[tone]] }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={TONE_COLORS[tone]}>
        {label}
      </ThemedText>
    </View>
  );
};

type VerdictBadgesProps = { price: PriceVerdict; cashFlow: CashFlowVerdict; risk: RiskLevel };

export const VerdictBadges = ({ price, cashFlow, risk }: VerdictBadgesProps) => (
  <View style={styles.row}>
    <Badge title="Prix" label={PRICE[price][0]} tone={PRICE[price][1]} />
    <Badge title="Cash-flow" label={CASH_FLOW[cashFlow][0]} tone={CASH_FLOW[cashFlow][1]} />
    <Badge title="Risque" label={RISK[risk][0]} tone={RISK[risk][1]} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { flexGrow: 1, flexBasis: 150, borderRadius: 12, borderLeftWidth: 4, padding: Spacing.three, gap: 2 },
});
