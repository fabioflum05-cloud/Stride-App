// utils/nutritionGoal.ts
// Single source of truth for the daily calorie goal, shared between app/(tabs)/index.tsx
// and app/(tabs)/nutrition.tsx so both screens always show the same number.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayHealth } from './applehealth';

export type CalorieStrategyMode = 'bulk' | 'maintain' | 'cut' | 'manual';

export interface CalorieStrategy {
  mode: CalorieStrategyMode;
  /** +300/+500 for bulk, -300/-500 for cut, 0 for maintain. Ignored in manual mode. */
  offset: number;
}

export const DEFAULT_STRATEGY: CalorieStrategy = { mode: 'manual', offset: 0 };

const STRATEGY_KEY = 'calorieStrategy';
const GOAL_KEY = 'nutritionGoal';
const HEALTH_KEY = 'stride_health_history';

interface BaseGoal { kcal: number; protein: number; carbs: number; fat: number }
const DEFAULT_BASE_GOAL: BaseGoal = { kcal: 2000, protein: 150, carbs: 250, fat: 70 };

export async function getCalorieStrategy(): Promise<CalorieStrategy> {
  const raw = await AsyncStorage.getItem(STRATEGY_KEY);
  if (!raw) return DEFAULT_STRATEGY;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.mode) return { mode: parsed.mode, offset: typeof parsed.offset === 'number' ? parsed.offset : 0 };
  } catch {
    // fall through to default
  }
  return DEFAULT_STRATEGY;
}

export async function saveCalorieStrategy(strategy: CalorieStrategy): Promise<void> {
  await AsyncStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface EffectiveGoal {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Heute (bzw. am angefragten Tag) aus Apple Health verbrannte kcal (aktiv+passiv), oder null falls keine Daten. */
  burned: number | null;
  strategy: CalorieStrategy;
}

/**
 * Einheitliches Kalorienziel für Home- und Nutrition-Screen.
 * bulk/maintain/cut: Tagesziel = heutige verbrannte kcal (aktiv+passiv aus Apple Health) + Strategie-Offset —
 * passt sich automatisch an, sobald neue Burn-Daten aus Apple Health hereinkommen (nichts wird zwischengespeichert).
 * manual: fester Wert aus dem gespeicherten nutritionGoal.
 */
export async function getEffectiveNutritionGoal(dateKey?: string): Promise<EffectiveGoal> {
  const [strategy, rawGoal, rawHealth] = await Promise.all([
    getCalorieStrategy(),
    AsyncStorage.getItem(GOAL_KEY),
    AsyncStorage.getItem(HEALTH_KEY),
  ]);

  const baseGoal: BaseGoal = rawGoal ? { ...DEFAULT_BASE_GOAL, ...JSON.parse(rawGoal) } : DEFAULT_BASE_GOAL;

  const hist: DayHealth[] = rawHealth ? JSON.parse(rawHealth) : [];
  const entry = hist.find(h => h.date === (dateKey ?? todayKey()));
  const burned = entry && (entry.activeEnergy != null || entry.basalEnergy != null)
    ? Math.round((entry.activeEnergy ?? 0) + (entry.basalEnergy ?? 0))
    : null;

  const kcal = strategy.mode !== 'manual' && burned !== null
    ? Math.max(1200, burned + strategy.offset)
    : baseGoal.kcal;

  return { kcal, protein: baseGoal.protein, carbs: baseGoal.carbs, fat: baseGoal.fat, burned, strategy };
}
