// Commune page blocks for the market score (M17), energy labels (M14) and price bands.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatPercent } from '@/data/format';
import type { Energy, MarketScore, ScoreCriterion } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

// Same wording as pipeline/config/score_weights.json
export const CRITERION_LABELS: Record<ScoreCriterion, string> = {
  gross_yield: 'rentabilité brute',
  cagr: 'évolution des prix',
  population_growth_yearly: 'croissance de la population',
  jobs_growth_yearly: "croissance de l'emploi",
  vacancy_rate: 'peu de logements vacants',
  share_fg: 'peu de passoires énergétiques',
  n_sales: 'volume de ventes',
};

export const ScoreCard = ({ score }: { score: MarketScore }) => {
  const theme = useTheme();
  const color = score.score >= 66 ? 'positive' : score.score <= 33 ? 'negative' : 'text';
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.scoreRow}>
        <ThemedText style={styles.scoreValue} themeColor={color}>
          {Math.round(score.score)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          / 100
        </ThemedText>
      </View>
      <View
        accessibilityLabel={`Score ${Math.round(score.score)} sur 100`}
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${score.score}%`, backgroundColor: theme[color === 'text' ? 'accent' : color] }]} />
      </View>
      <ThemedText type="small">
        Points forts : {score.strengths.map((c) => CRITERION_LABELS[c]).join(', ')}
      </ThemedText>
      <ThemedText type="small">
        Points faibles : {score.weaknesses.map((c) => CRITERION_LABELS[c]).join(', ')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Comparé aux autres villes ({score.n_criteria} critères pondérés : rentabilité 30 %, prix 15 %, population
        15 %, vacance 15 %, emploi 10 %, passoires 10 %, ventes 5 %). 50 = ville médiane.
      </ThemedText>
    </View>
  );
};

// DPE label colours (official scale, green to red)
const LABEL_COLORS = ['#009036', '#55aa33', '#a3cf2e', '#f6e600', '#f0b40f', '#eb8235', '#d7221f'];
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export const EnergyBar = ({ energy }: { energy: Energy }) => {
  const shares = LABELS.map((label) => energy[`share_${label.toLowerCase()}` as keyof Energy] as number);
  return (
    <View style={styles.block}>
      <View
        style={styles.stack}
        accessibilityLabel={`Étiquettes DPE : ${LABELS.map((l, i) => `${l} ${formatPercent(shares[i])}`).join(', ')}`}>
        {LABELS.map((label, i) =>
          shares[i] > 0 ? (
            <View key={label} style={[styles.segment, { flex: shares[i], backgroundColor: LABEL_COLORS[i] }]}>
              {shares[i] >= 0.06 && <ThemedText style={styles.segmentLabel}>{label}</ThemedText>}
            </View>
          ) : null,
        )}
      </View>
      <View style={styles.legendRow}>
        {LABELS.map((label, i) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.note}>
            {label} {formatPercent(shares[i])}
          </ThemedText>
        ))}
      </View>
    </View>
  );
};

const BAND_LABELS: Record<string, string> = {
  '0-100k': '< 100 k€',
  '100-200k': '100 – 200 k€',
  '200-300k': '200 – 300 k€',
  '300-500k': '300 – 500 k€',
  '500k+': '> 500 k€',
};

export const PriceBandBars = ({ bands }: { bands: [string, number][] }) => {
  const theme = useTheme();
  const top = Math.max(...bands.map(([, share]) => share), 0.01);
  return (
    <View style={styles.block}>
      {bands.map(([band, share]) => (
        <View key={band} style={styles.bandRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bandLabel}>
            {BAND_LABELS[band] ?? band}
          </ThemedText>
          <View style={styles.bandTrack}>
            <View style={[styles.bandFill, { width: `${(share / top) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
          <ThemedText type="small" style={styles.bandValue}>
            {formatPercent(share)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  scoreValue: { fontSize: 40, lineHeight: 44, fontWeight: 700 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8 },
  note: { fontSize: 12, lineHeight: 16 },
  block: { gap: Spacing.two },
  stack: { flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden' },
  segment: { alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 11, lineHeight: 14, fontWeight: 700, color: '#1a1a1a' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bandLabel: { width: 100 },
  bandTrack: { flex: 1, height: 12 },
  bandFill: { height: 12, borderRadius: 3 },
  bandValue: { width: 56, textAlign: 'right' },
});
