import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatEuros } from '@/data/format';
import { useTheme } from '@/hooks/use-theme';

type PriceRangeBarProps = { low: number; estimate: number; high: number; asked?: number };

/** Model interval as a band, the estimate as a tick, the asked price as a marker. */
export const PriceRangeBar = ({ low, estimate, high, asked }: PriceRangeBarProps) => {
  const theme = useTheme();
  const values = [low, high, ...(asked ? [asked] : [])];
  // 8 % margin on both sides so markers at the edges stay visible
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.08;
  const at = (value: number) => `${((value - min) / (max - min)) * 100}%` as const;
  const askedColor =
    asked == null ? theme.text : asked < low ? theme.positive : asked > high ? theme.negative : theme.accent;

  return (
    <View
      accessible
      accessibilityLabel={`Fourchette ${formatEuros(low)} à ${formatEuros(high)}, estimation ${formatEuros(estimate)}${
        asked ? `, prix demandé ${formatEuros(asked)}` : ''
      }`}
      style={styles.container}>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View
          style={[
            styles.band,
            { left: at(low), width: `${((high - low) / (max - min)) * 100}%`, backgroundColor: theme.backgroundSelected },
          ]}
        />
        <View style={[styles.tick, { left: at(estimate), backgroundColor: theme.text }]} />
        {asked != null && <View style={[styles.marker, { left: at(asked), backgroundColor: askedColor }]} />}
      </View>
      <View style={styles.labels}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatEuros(low)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatEuros(high)}
        </ThemedText>
      </View>
      <View style={styles.legend}>
        <ThemedText type="small" themeColor="textSecondary">
          ▮ estimation {formatEuros(estimate)}
        </ThemedText>
        {asked != null && (
          <ThemedText type="small" style={{ color: askedColor }}>
            ● prix demandé {formatEuros(asked)}
          </ThemedText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  track: { height: 28, borderRadius: 8, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0 },
  tick: { position: 'absolute', top: 2, bottom: 2, width: 3, marginLeft: -1.5, borderRadius: 2 },
  marker: { position: 'absolute', top: 7, width: 14, height: 14, marginLeft: -7, borderRadius: 7 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
