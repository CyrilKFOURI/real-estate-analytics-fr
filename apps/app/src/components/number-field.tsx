import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  hint?: string;
};

/** Accepts French input ("3,5", "200 000"); the parent parses it with parseNumber. */
export const NumberField = ({ label, value, onChange, unit, hint }: NumberFieldProps) => {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <TextInput
          accessibilityLabel={label}
          inputMode="decimal"
          value={value}
          onChangeText={onChange}
          style={[styles.input, { color: theme.text }]}
        />
        {unit && (
          <ThemedText type="small" themeColor="textSecondary">
            {unit}
          </ThemedText>
        )}
      </View>
      {hint && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      )}
    </View>
  );
};

export const parseNumber = (text: string): number => {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
};

const styles = StyleSheet.create({
  field: { flexGrow: 1, flexBasis: 160, gap: Spacing.one },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, minWidth: 0 },
  hint: { fontSize: 12, lineHeight: 16 },
});
