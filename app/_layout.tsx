import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Slot, usePathname } from 'expo-router';
import React, { Component, type ReactNode, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LanguageProvider } from '../constants/LanguageContext';
import { OnboardingContext } from '../constants/OnboardingContext';
import { theme } from '../constants/theme';
import { ThemeProvider } from '../constants/ThemeContext';
import { startHealthAutoSync, syncAllHealthData } from '../utils/applehealth';
import { syncWidgetData } from '../utils/widgetData';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Stride render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Stride konnte nicht geladen werden</Text>
          <Text style={styles.errorSubtitle}>Bitte App neu starten.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      try {
        const done = await AsyncStorage.getItem('onboardingDone');
        setNeedsOnboarding(!done);
      } catch {
        setNeedsOnboarding(false);
      } finally {
        setReady(true);
      }
    })();

    (async () => {
      try {
        await startHealthAutoSync();
      } catch {
        // HealthKit not available/authorized — app must work without it
      }
      try {
        await syncWidgetData();
      } catch {
        // widgets are best-effort, never block the app
      }
    })();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        (async () => {
          try {
            await syncAllHealthData();
          } catch {}
          try {
            await syncWidgetData();
          } catch {}
        })();
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <OnboardingContext.Provider value={{ completeOnboarding: () => setNeedsOnboarding(false) }}>
              {!ready ? (
                <View style={styles.root} />
              ) : needsOnboarding && pathname !== '/onboarding' ? (
                <Redirect href="/onboarding" />
              ) : (
                <Slot />
              )}
            </OnboardingContext.Provider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  errorScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, padding: 24 },
  errorTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  errorSubtitle: { color: theme.textSecondary, fontSize: 14, textAlign: 'center' },
});
