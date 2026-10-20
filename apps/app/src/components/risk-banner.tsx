import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatPercent, formatSignedPercent } from '@/data/format';
import type { Socio } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const riskMessages = (socio: Socio): string[] => {
  const messages: string[] = [];
  if (socio.flag_high_vacancy) {
    messages.push(
      `Vacance élevée : ${formatPercent(socio.vacancy_rate)} des logements sont vides (seuil d'alerte 10 %).`,
    );
  }
  if (socio.flag_population_decline) {
    messages.push(
      `Population en baisse : ${formatSignedPercent(socio.population_growth_yearly)} par an depuis 2017.`,
    );
  }
  return messages;
};

export const RiskBanner = ({ socio }: { socio: Socio | null }) => {
  const theme = useTheme();
  const messages = socio ? riskMessages(socio) : [];
  if (messages.length === 0) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: theme.warningBackground }]}>
      <ThemedText type="smallBold" themeColor="warningText">
        Points de vigilance
      </ThemedText>
      {messages.map((message) => (
        <ThemedText key={message} type="small" themeColor="warningText">
          • {message}
        </ThemedText>
      ))}
      <ThemedText type="small" themeColor="warningText">
        Une rentabilité brute élevée ici reflète souvent un risque, pas une bonne affaire.
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});
