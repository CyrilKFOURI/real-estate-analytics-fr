import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatEurosPerM2, formatPeriod } from '@/data/format';
import type { PriceRow } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const CHART_HEIGHT = 140;
// Bars start from 80 % of the lowest value so that small moves stay visible without
// pretending prices went from zero.
const BASELINE_RATIO = 0.8;

type TrendBarsProps = { series: PriceRow[] };

export const TrendBars = ({ series }: TrendBarsProps) => {
  const theme = useTheme();
  if (series.length === 0) {
    return null;
  }
  const values = series.map((row) => row.median_price_m2);
  const baseline = Math.min(...values) * BASELINE_RATIO;
  const top = Math.max(...values);
  const last = series.length - 1;

  return (
    <View
      accessible
      accessibilityLabel={`Prix médian au m² par semestre, de ${formatPeriod(series[0].period)} à ${formatPeriod(series[last].period)}`}
      style={styles.chart}>
      {series.map((row, i) => {
        const height = ((row.median_price_m2 - baseline) / (top - baseline || 1)) * CHART_HEIGHT;
        return (
          <View key={row.period} style={styles.column}>
            <ThemedText type="small" themeColor={i === last ? 'text' : 'textSecondary'} style={styles.value}>
              {formatEurosPerM2(row.median_price_m2).replace(' €/m²', '')}
            </ThemedText>
            <View
              style={[
                styles.bar,
                { height: Math.max(height, 4), backgroundColor: i === last ? theme.accent : theme.backgroundSelected },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.period}>
              {formatPeriod(row.period)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  column: { flex: 1, alignItems: 'center', gap: Spacing.one },
  bar: { width: '100%', maxWidth: 48, borderRadius: 6 },
  value: { fontSize: 11, lineHeight: 14 },
  period: { fontSize: 11, lineHeight: 14 },
});
