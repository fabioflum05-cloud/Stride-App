import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

// isDark ist pro Theme fest hinterlegt (statt aus der bg-Hexfarbe geraten — z.B. per
// colors.bg.startsWith('#0')||... wie zuvor separat in athlete-profile.tsx und
// progress-photos.tsx dupliziert), da das Theme selbst am zuverlässigsten weiß, ob es dunkel ist.
const THEMES = [
  { name: 'Kastanienbraun', nameEn: 'Chestnut Brown', accent: '#7B4A2D', bg: '#FAF6F1', card: '#FFFFFF', cardSecondary: '#F5EFE8', isDark: false },
  { name: 'Dark Gym',      nameEn: 'Dark Gym',    accent: '#39FF14', bg: '#1A1D24', card: '#22262F', cardSecondary: '#2A2F3A', isDark: true },
  { name: 'Ozean Nacht',   nameEn: 'Ocean Night', accent: '#00D4FF', bg: '#0D1F3C', card: '#122848', cardSecondary: '#0A1628', isDark: true },
  { name: 'Wald',          nameEn: 'Forest',      accent: '#7ED957', bg: '#1F3B1F', card: '#264526', cardSecondary: '#1A2E1A', isDark: true },
  { name: 'Arktis',        nameEn: 'Arctic',      accent: '#0077B6', bg: '#F0F8FF', card: '#FFFFFF', cardSecondary: '#E8F4FD', isDark: false },
  { name: 'Lila Nacht',    nameEn: 'Purple Night', accent: '#E040FB', bg: '#220D3D', card: '#2D1250', cardSecondary: '#1A0A2E', isDark: true },
  { name: 'Sandstein',     nameEn: 'Sandstone',   accent: '#C9820A', bg: '#F5ECD7', card: '#FFF8EC', cardSecondary: '#EDE0C4', isDark: false },
  { name: 'Stein',         nameEn: 'Stone',       accent: '#FF6B35', bg: '#383838', card: '#444444', cardSecondary: '#2C2C2C', isDark: true },
  { name: 'Sakura',        nameEn: 'Sakura',      accent: '#C2185B', bg: '#FFF5F7', card: '#FFFFFF', cardSecondary: '#FDF0F3', isDark: false },
  { name: 'Mint',          nameEn: 'Mint',        accent: '#00875A', bg: '#F2FCF7', card: '#FFFFFF', cardSecondary: '#E8F8F2', isDark: false },
];

export { THEMES };

const ThemeContext = createContext<any>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeIndex, setThemeIndex] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('selectedTheme').then(v => {
      if (v !== null) {
        const i = parseInt(v);
        if (i >= 0 && i < THEMES.length) setThemeIndex(i);
      }
    });
  }, []);

  async function setTheme(i: number) {
    setThemeIndex(i);
    await AsyncStorage.setItem('selectedTheme', String(i));
  }

  const colors = THEMES[themeIndex] ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ themeIndex, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { themeIndex: 0, setTheme: () => {}, colors: THEMES[0] };
  return ctx;
}

/**
 * Vollständige Farbpalette im selben Shape wie das alte statische constants/theme.ts, aber live
 * aus dem aktuell gewählten Theme abgeleitet (hell/dunkel-bewusst) — für Screens, die von
 * constants/theme.ts auf useAppTheme() migriert werden, damit sie auf Dark-Mode-Themes reagieren.
 * bg/card/cardSecondary kommen 1:1 vom Theme; blue/blueLight/blueMid sind an den Accent des
 * gewählten Themes gekoppelt (Primär-/Aktionsfarbe, wie athlete-profile.tsx/training.tsx es
 * bereits für ihre Primärbuttons tun) statt fest blau zu bleiben. Grün/Rot/Orange/Pink/Lila/
 * Türkis bleiben feste Semantikfarben (Erfolg/Fehler/Warnung — unabhängig vom gewählten Akzent),
 * im Dark-Modus mit denselben helleren Tönen, die health.tsx/training.tsx dafür bereits nutzen.
 */
export function getFullPalette(theme: { bg: string; card: string; cardSecondary: string; accent: string; isDark: boolean }) {
  const { bg, card, cardSecondary, accent, isDark } = theme;
  return isDark ? {
    bg, card, cardSecondary,
    blue: accent, blueLight: accent + '29', blueMid: accent,
    green: '#4ADE80', greenLight: 'rgba(74,222,128,0.16)',
    orange: '#FBBF24', orangeLight: 'rgba(251,191,36,0.16)',
    red: '#F87171', redLight: 'rgba(248,113,113,0.16)',
    pink: '#F472B6', pinkLight: 'rgba(244,114,182,0.16)',
    purple: '#A78BFA', purpleLight: 'rgba(167,139,250,0.16)',
    teal: '#2DD4BF', tealLight: 'rgba(45,212,191,0.16)',
    textPrimary: '#F2F2F7', textSecondary: '#98989F', textTertiary: '#636366',
    border: 'rgba(255,255,255,0.12)', borderLight: 'rgba(255,255,255,0.06)',
    shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  } : {
    bg, card, cardSecondary,
    blue: accent, blueLight: accent + '1A', blueMid: accent,
    green: '#34C759', greenLight: '#E8F5E9',
    orange: '#FF9500', orangeLight: '#FFF3E0',
    red: '#FF3B30', redLight: '#FFEBEE',
    pink: '#EC4899', pinkLight: '#FCE4EC',
    purple: '#7C3AED', purpleLight: '#F3E8FF',
    teal: '#00BCD4', tealLight: '#E0F7FA',
    textPrimary: '#1C1C1E', textSecondary: '#8E8E93', textTertiary: '#C7C7CC',
    border: 'rgba(0,0,0,0.08)', borderLight: 'rgba(0,0,0,0.04)',
    shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  };
}