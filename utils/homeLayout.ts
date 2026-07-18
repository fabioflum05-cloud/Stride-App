// utils/homeLayout.ts
// Persists which cards are visible on the Home tab and in what order.
// Mirrors the pattern already used for widget configuration (utils/widgetData.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeCardId =
  | 'performance' | 'sleep' | 'energy' | 'nutrition' | 'readiness' | 'habits' | 'journal' | 'todo';

export const HOME_CARDS: HomeCardId[] = [
  'performance', 'sleep', 'energy', 'nutrition', 'readiness', 'habits', 'journal', 'todo',
];

export interface HomeCardConfig {
  id: HomeCardId;
  visible: boolean;
}

export const DEFAULT_HOME_LAYOUT: HomeCardConfig[] = HOME_CARDS.map(id => ({ id, visible: true }));

const KEY = 'homeCardsLayout';

/** Loads the saved layout, merging in any card ids added in a later app version (appended, visible by default). */
export async function getHomeLayout(): Promise<HomeCardConfig[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_HOME_LAYOUT;
  try {
    const saved: HomeCardConfig[] = JSON.parse(raw);
    const valid = saved.filter(c => HOME_CARDS.includes(c.id));
    const savedIds = new Set(valid.map(c => c.id));
    const missing = HOME_CARDS.filter(id => !savedIds.has(id)).map(id => ({ id, visible: true }));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

export async function saveHomeLayout(layout: HomeCardConfig[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(layout));
}
