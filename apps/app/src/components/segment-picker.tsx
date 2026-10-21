import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { bucketsFor, type Segment } from '@/data/select';
import type { PropertyType, RoomsBucket } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  // flats and houses mixed: an overview of the market, never compared
  { value: 'all', label: 'Vue d’ensemble (mélange)' },
];

const sizeLabel = (type: PropertyType, bucket: RoomsBucket): string =>
  bucket === 'all' ? 'Toutes tailles' : type === 'house' ? `${bucket} pièces` : `T${bucket}`;

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
          // size buckets differ between flats and houses: a new type starts at all sizes
          onPress={() => onChange({ propertyType: value, rooms: 'all' })}
        />
      ))}
    </View>
    {segment.propertyType !== 'all' && (
      <View style={styles.row}>
        {bucketsFor(segment.propertyType).map((bucket) => (
          <Chip
            key={bucket}
            label={sizeLabel(segment.propertyType, bucket)}
            selected={segment.rooms === bucket}
            onPress={() => onChange({ ...segment, rooms: bucket })}
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
