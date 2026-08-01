// utils/historyTiles.ts
// Persists which stat tiles are shown in the History screen's period overview, and in what order.
// Mirrors the pattern used for home card configuration (utils/homeLayout.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryTileId =
  | 'workouts' | 'perfScore' | 'workoutScore' | 'sleepScore' | 'sleepHours' | 'hrv' | 'restingHR' | 'battLevel' | 'recovery';

export const HISTORY_TILES: HistoryTileId[] = [
  'workouts', 'perfScore', 'workoutScore', 'sleepScore', 'sleepHours', 'hrv', 'restingHR', 'battLevel', 'recovery',
];

export interface HistoryTileConfig {
  id: HistoryTileId;
  visible: boolean;
}

const DEFAULT_VISIBLE: HistoryTileId[] = ['workouts', 'perfScore', 'sleepScore', 'hrv'];

export const DEFAULT_HISTORY_TILES: HistoryTileConfig[] = HISTORY_TILES.map(id => ({
  id, visible: DEFAULT_VISIBLE.includes(id),
}));

const KEY = 'historyOverviewLayout';

/** Loads the saved layout, merging in any tile ids added in a later app version (appended, hidden by default). */
export async function getHistoryTilesLayout(): Promise<HistoryTileConfig[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_HISTORY_TILES;
  try {
    const saved: HistoryTileConfig[] = JSON.parse(raw);
    const valid = saved.filter(c => HISTORY_TILES.includes(c.id));
    const savedIds = new Set(valid.map(c => c.id));
    const missing = HISTORY_TILES.filter(id => !savedIds.has(id)).map(id => ({ id, visible: false }));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_HISTORY_TILES;
  }
}

export async function saveHistoryTilesLayout(layout: HistoryTileConfig[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(layout));
}
