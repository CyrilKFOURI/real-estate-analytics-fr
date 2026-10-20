import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Rendement immobilier' }} />
        <Stack.Screen name="place/[level]/[code]" options={{ title: '' }} />
        <Stack.Screen name="simulator" options={{ title: 'Simulateur' }} />
      </Stack>
    </ThemeProvider>
  );
}
