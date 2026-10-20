import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type KpiTileProps = {
  label: string;
  value: string;
  detail?: string;
  detailColor?: ThemeColor;
  lowConfidence?: boolean;
};

export const KpiTile = ({ label, value, detail, detailColor, lowConfidence }: KpiTileProps) => {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
      {detail != null && (
        <ThemedText type="small" themeColor={detailColor ?? 'textSecondary'}>
          {detail}
        </ThemedText>
      )}
      {lowConfidence && (
        <ThemedText type="small" themeColor="warningText">
          Peu de ventes : fiabilité faible
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 200,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  value: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
});
