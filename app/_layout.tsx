import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LanguageProvider } from '../constants/LanguageContext';
import { ThemeProvider } from '../constants/ThemeContext';
import { startHealthAutoSync, syncAllHealthData } from '../utils/applehealth';

export default function RootLayout() {
  useEffect(() => {
    startHealthAutoSync().catch(() => {});

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncAllHealthData().catch(() => {});
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <LanguageProvider>
          <Slot />
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});