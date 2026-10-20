import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { loadIndex } from '@/data/api';
import { formatCount } from '@/data/format';
import { searchPlaces } from '@/data/search';
import type { IndexPlace } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const QUICK_PICKS: { label: string; level: IndexPlace['level']; code: string }[] = [
  { label: 'France', level: 'france', code: 'FR' },
  { label: 'Paris', level: 'commune', code: '75056' },
  { label: 'Lyon', level: 'commune', code: '69123' },
  { label: 'Angers', level: 'commune', code: '49007' },
];

export default function SearchScreen() {
  const theme = useTheme();
  const [places, setPlaces] = useState<IndexPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadIndex().then(setPlaces, (e: Error) => setError(e.message));
  }, []);

  const results = useMemo(() => (places ? searchPlaces(places, query) : []), [places, query]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['bottom']} style={styles.content}>
        <Link
          href="/property"
          style={StyleSheet.flatten([styles.propertyCta, { borderColor: theme.accent }])}>
          <ThemedText type="smallBold" themeColor="accent">
            Vous avez un bien en vue ? Analysez-le →
          </ThemedText>
        </Link>
        <Link href="/ranking" style={StyleSheet.flatten([styles.propertyCta, { borderColor: theme.border }])}>
          <ThemedText type="smallBold">Où investir ? Le classement des villes →</ThemedText>
        </Link>
        <ThemedText type="subtitle">Quelle ville ?</ThemedText>
        <ThemedText themeColor="textSecondary">
          Prix de vente (DVF), loyers (ANIL) et contexte INSEE pour chaque commune.
        </ThemedText>
        <TextInput
          accessibilityLabel="Rechercher une commune"
          autoFocus
          placeholder="Ex. Angers, Saint-Étienne, Paris 11e…"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
        {error && <ThemedText themeColor="negative">Données indisponibles : {error}</ThemedText>}
        {!places && !error && <ActivityIndicator />}
        {query.length < 2 && (
          <View style={styles.quickPicks}>
            {QUICK_PICKS.map((pick) => (
              <Link
                key={pick.code}
                href={`/place/${pick.level}/${pick.code}`}
                style={StyleSheet.flatten([styles.quickPick, { borderColor: theme.border }])}>
                <ThemedText type="small">{pick.label}</ThemedText>
              </Link>
            ))}
          </View>
        )}
        <FlatList
          data={results}
          keyExtractor={(place) => `${place.level}-${place.code}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Link
              href={`/place/${item.level}/${item.code}`}
              style={StyleSheet.flatten([styles.result, { borderColor: theme.border }])}>
              <View>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.departement} · {formatCount(item.population)} hab.
                </ThemedText>
              </View>
            </Link>
          )}
          ListEmptyComponent={
            places && query.length >= 2 ? (
              <ThemedText themeColor="textSecondary">
                Aucune commune avec assez de ventes pour « {query} ».
              </ThemedText>
            ) : undefined
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 18 },
  quickPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quickPick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  result: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  propertyCta: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: 10 },
});
