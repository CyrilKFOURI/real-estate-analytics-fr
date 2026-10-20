import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Segment } from '@/data/select';
import type { PropertyType, RoomsBucket } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'all', label: 'Tous biens' },
];
const ROOMS: { value: RoomsBucket; label: string }[] = [
  { value: 'all', label: 'Toutes pièces' },
  { value: '1', label: 'T1' },
  { value: '2', label: 'T2' },
  { value: '3', label: 'T3' },
  { value: '4', label: 'T4' },
  { value: '5+', label: 'T5+' },
];

type ChipProps = { label: string; selected: boolean; onPress: () => void };

export const Chip = ({ label, selected, onPress }: ChipProps) => {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? theme.accent : theme.border },
        selected && { backgroundColor: theme.accent },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'onAccent' : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
};

type SegmentPickerProps = { segment: Segment; onChange: (segment: Segment) => void };

export const SegmentPicker = ({ segment, onChange }: SegmentPickerProps) => (
  <View style={styles.container}>
    <View style={styles.row}>
      {PROPERTY_TYPES.map(({ value, label }) => (
        <Chip
          key={value}
          label={label}
          selected={segment.propertyType === value}
          // the 'all' property type only exists with all rooms
          onPress={() => onChange({ propertyType: value, rooms: value === 'all' ? 'all' : segment.rooms })}
        />
      ))}
    </View>
    {segment.propertyType !== 'all' && (
      <View style={styles.row}>
        {ROOMS.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            selected={segment.rooms === value}
            onPress={() => onChange({ ...segment, rooms: value })}
          />
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
