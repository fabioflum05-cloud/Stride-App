import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const THEMES = [
  { name: 'Kastanienbraun', nameEn: 'Chestnut Brown', accent: '#7B4A2D', bg: '#FAF6F1', card: '#FFFFFF', cardSecondary: '#F5EFE8' },
  { name: 'Dark Gym',      nameEn: 'Dark Gym',    accent: '#39FF14', bg: '#1A1D24', card: '#22262F', cardSecondary: '#2A2F3A' },
  { name: 'Ozean Nacht',   nameEn: 'Ocean Night', accent: '#00D4FF', bg: '#0D1F3C', card: '#122848', cardSecondary: '#0A1628' },
  { name: 'Wald',          nameEn: 'Forest',      accent: '#7ED957', bg: '#1F3B1F', card: '#264526', cardSecondary: '#1A2E1A' },
  { name: 'Arktis',        nameEn: 'Arctic',      accent: '#0077B6', bg: '#F0F8FF', card: '#FFFFFF', cardSecondary: '#E8F4FD' },
  { name: 'Lila Nacht',    nameEn: 'Purple Night', accent: '#E040FB', bg: '#220D3D', card: '#2D1250', cardSecondary: '#1A0A2E' },
  { name: 'Sandstein',     nameEn: 'Sandstone',   accent: '#C9820A', bg: '#F5ECD7', card: '#FFF8EC', cardSecondary: '#EDE0C4' },
  { name: 'Stein',         nameEn: 'Stone',       accent: '#FF6B35', bg: '#383838', card: '#444444', cardSecondary: '#2C2C2C' },
  { name: 'Sakura',        nameEn: 'Sakura',      accent: '#C2185B', bg: '#FFF5F7', card: '#FFFFFF', cardSecondary: '#FDF0F3' },
  { name: 'Mint',          nameEn: 'Mint',        accent: '#00875A', bg: '#F2FCF7', card: '#FFFFFF', cardSecondary: '#E8F8F2' },
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