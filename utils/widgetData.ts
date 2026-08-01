// utils/widgetData.ts
// Gathers all metrics shown on the iOS Home Screen / Lock Screen widgets and
// writes them to the shared App Group storage so the native widget extension
// (targets/widget) can render them. iOS only — no-op on other platforms.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getTrainingReadiness, type DayHealth } from './applehealth';

// Loaded lazily/defensively — if the native ExtensionStorage module is missing
// (e.g. widget extension not linked in this build), syncWidgetData() becomes a no-op
// instead of crashing the whole app at JS bundle evaluation time.
let ExtensionStorageClass: (typeof import('@bacons/apple-targets'))['ExtensionStorage'] | null = null;
try {
  ExtensionStorageClass = require('@bacons/apple-targets').ExtensionStorage;
} catch {
  ExtensionStorageClass = null;
}

export const WIDGET_APP_GROUP = 'group.com.fabioflum.performanceapp.widget';

export type WidgetMetricKey =
  | 'battery' | 'readiness' | 'steps' | 'calories' | 'resting_hr' | 'hrv'
  | 'streak' | 'next_workout' | 'sleep' | 'stress' | 'muscle_recovery'
  | 'weight' | 'nutrition' | 'vo2max' | 'last_workout';

export const WIDGET_METRICS: WidgetMetricKey[] = [
  'battery', 'readiness', 'steps', 'calories', 'resting_hr', 'hrv',
  'streak', 'next_workout', 'sleep', 'stress', 'muscle_recovery',
  'weight', 'nutrition', 'vo2max', 'last_workout',
];

export interface WidgetConfig {
  small: WidgetMetricKey[];
  medium: WidgetMetricKey[];
  large: WidgetMetricKey[];
  lock: WidgetMetricKey[];
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  small: ['battery', 'streak'],
  medium: ['battery', 'readiness', 'streak'],
  large: ['battery', 'readiness', 'steps', 'calories', 'sleep', 'streak'],
  lock: ['battery', 'readiness'],
};

export const WIDGET_SLOT_COUNTS: Record<keyof WidgetConfig, number> = {
  small: 2,
  medium: 3,
  large: 6,
  lock: 2,
};

const CONFIG_KEY = 'widgetConfig';

type Lang = 'de' | 'en';

const METRIC_LABELS: Record<WidgetMetricKey, Record<Lang, string>> = {
  battery: { de: 'Body Battery', en: 'Body Battery' },
  readiness: { de: 'Trainingsbereitschaft', en: 'Training Readiness' },
  steps: { de: 'Schritte heute', en: 'Steps Today' },
  calories: { de: 'Kalorien heute', en: 'Calories Today' },
  resting_hr: { de: 'Ruhepuls', en: 'Resting HR' },
  hrv: { de: 'HRV', en: 'HRV' },
  streak: { de: 'Streak', en: 'Streak' },
  next_workout: { de: 'Nächstes Training', en: 'Next Workout' },
  sleep: { de: 'Schlafqualität', en: 'Sleep Quality' },
  stress: { de: 'Stress Score', en: 'Stress Score' },
  muscle_recovery: { de: 'Muskel Recovery', en: 'Muscle Recovery' },
  weight: { de: 'Gewicht', en: 'Weight' },
  nutrition: { de: 'Nutrition Score', en: 'Nutrition Score' },
  vo2max: { de: 'VO2max', en: 'VO2max' },
  last_workout: { de: 'Letztes Workout', en: 'Last Workout' },
};

const GREEN = '#4ADE80';
const YELLOW = '#FBBF24';
const RED = '#F87171';
const NEUTRAL = '#1C1C1E';
const DIM = 'rgba(28,28,30,0.35)';

export interface WidgetMetricValue {
  label: string;
  value: string;
  color: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function levelColor(level: number): string {
  if (level >= 65) return GREEN;
  if (level >= 35) return YELLOW;
  if (level > 0) return RED;
  return DIM;
}

function inverseLevelColor(level: number): string {
  if (level <= 30) return GREEN;
  if (level <= 60) return YELLOW;
  return RED;
}

export async function getWidgetConfig(): Promise<WidgetConfig> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  if (!raw) return DEFAULT_WIDGET_CONFIG;
  try {
    return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIDGET_CONFIG;
  }
}

export async function saveWidgetConfig(config: WidgetConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  await syncWidgetData();
}

async function getLang(): Promise<Lang> {
  const raw = await AsyncStorage.getItem('appLanguage');
  return raw === 'en' ? 'en' : 'de';
}

/** Gathers all widget metrics from AsyncStorage / HealthKit-derived data. */
async function buildWidgetData(lang: Lang): Promise<Record<WidgetMetricKey, WidgetMetricValue>> {
  const today = todayKey();
  const naLabel = lang === 'en' ? '—' : '—';

  const [
    rawBattery, rawHealth, rawSleep, rawMuscles, rawWorkouts,
    rawProfile, rawWeightHistory, rawVo2, rawNutrition, rawNutritionGoal,
  ] = await Promise.all([
    AsyncStorage.getItem('batteryData'),
    AsyncStorage.getItem('stride_health_history'),
    AsyncStorage.getItem('lastSleep'),
    AsyncStorage.getItem('muscleRecovery'),
    AsyncStorage.getItem('workouts'),
    AsyncStorage.getItem('profile'),
    AsyncStorage.getItem('weightHistory'),
    AsyncStorage.getItem('vo2maxData'),
    AsyncStorage.getItem(`nutrition_${today}`),
    AsyncStorage.getItem('nutritionGoal'),
  ]);

  const hist: DayHealth[] = rawHealth ? JSON.parse(rawHealth) : [];
  const todayEntry = hist.find(h => h.date === today);

  // --- Body Battery ---
  let batteryLevel = 0;
  if (rawBattery) {
    const b = JSON.parse(rawBattery);
    if (isToday(b.date)) batteryLevel = b.level ?? 0;
  }

  // --- Training Readiness ---
  const readiness = await getTrainingReadiness(lang);

  // --- Steps ---
  const steps = todayEntry?.steps ?? null;

  // --- Calories (active + basal) ---
  const activeEnergy = todayEntry?.activeEnergy ?? null;
  const basalEnergy = todayEntry?.basalEnergy ?? null;
  const totalCalories = activeEnergy !== null || basalEnergy !== null
    ? Math.round((activeEnergy ?? 0) + (basalEnergy ?? 0))
    : null;

  // --- Resting HR / HRV ---
  const restingHR = todayEntry?.restingHR ?? null;
  const hrv = todayEntry?.hrv ?? null;

  // --- Streak ---
  const workouts: { date: string; type: string; duration?: number; score?: number; exercises?: any[] }[] =
    rawWorkouts ? JSON.parse(rawWorkouts) : [];
  const trainingWorkouts = workouts
    .filter(w => w.type === 'gym' || w.type === 'judo' || w.type === 'run')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let streak = 0;
  {
    let checkD = new Date(); checkD.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const ds = checkD.toISOString().slice(0, 10);
      const prev = new Date(checkD); prev.setDate(prev.getDate() - 1);
      if (trainingWorkouts.some(w => w.date.slice(0, 10) === ds)) { streak++; checkD = prev; }
      else if (i === 0 && trainingWorkouts.some(w => w.date.slice(0, 10) === prev.toISOString().slice(0, 10))) { checkD = prev; }
      else break;
    }
  }

  // --- Next planned training (heuristic from trainingDaysPerWeek + last session) ---
  const profile = rawProfile ? JSON.parse(rawProfile) : null;
  let nextWorkoutValue = naLabel;
  if (trainingWorkouts.length > 0) {
    const daysPerWeek = Math.max(1, parseInt(profile?.trainingDaysPerWeek ?? '3', 10) || 3);
    const intervalDays = Math.max(1, Math.round(7 / daysPerWeek));
    const lastTs = new Date(trainingWorkouts[0].date).getTime();
    const daysSince = Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24));
    const remaining = intervalDays - daysSince;
    if (remaining <= 0) nextWorkoutValue = lang === 'en' ? 'Today' : 'Heute';
    else if (remaining === 1) nextWorkoutValue = lang === 'en' ? 'Tomorrow' : 'Morgen';
    else nextWorkoutValue = lang === 'en' ? `in ${remaining} days` : `in ${remaining} Tagen`;
  } else {
    nextWorkoutValue = lang === 'en' ? 'Today' : 'Heute';
  }

  // --- Sleep quality (last night's score) ---
  let sleepScore: number | null = null;
  if (rawSleep) {
    const s = JSON.parse(rawSleep);
    if (isToday(s.date) && typeof s.sleepScore === 'number') sleepScore = s.sleepScore;
  }

  // --- Stress score ---
  const stressScore = todayEntry?.stressScore ?? null;

  // --- Muscle recovery average ---
  let muscleRecoveryAvg: number | null = null;
  if (rawMuscles) {
    const muscles: Record<string, { level: number }> = JSON.parse(rawMuscles);
    const levels = Object.values(muscles).map(m => m.level ?? 100);
    if (levels.length) muscleRecoveryAvg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
  }

  // --- Weight + trend ---
  let weightValue = naLabel;
  let weightColor = NEUTRAL;
  const currentWeight = profile?.weight ? parseFloat(profile.weight) : null;
  if (currentWeight) {
    let trendArrow = '';
    if (rawWeightHistory) {
      const entries: { date: string; weight: number }[] = JSON.parse(rawWeightHistory);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const past = entries
        .filter(e => new Date(e.date).getTime() <= weekAgo)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (past.length) {
        const diff = currentWeight - past[0].weight;
        if (diff > 0.1) trendArrow = ' ↑';
        else if (diff < -0.1) trendArrow = ' ↓';
        else trendArrow = ' →';
      }
    }
    weightValue = `${currentWeight.toFixed(1)} kg${trendArrow}`;
    weightColor = NEUTRAL;
  }

  // --- Nutrition score (today) ---
  let nutritionScore: number | null = null;
  if (rawNutrition) {
    const log = JSON.parse(rawNutrition);
    const goal = rawNutritionGoal ? JSON.parse(rawNutritionGoal) : { kcal: 2000, protein: 150, carbs: 250, fat: 70 };
    const entries = (log.entries ?? []) as { macros: { kcal: number; protein: number; carbs: number; fat: number }; micros?: Record<string, number> }[];
    if (entries.length) {
      const totals = entries.reduce((s, e) => ({
        kcal: s.kcal + e.macros.kcal, protein: s.protein + e.macros.protein,
        carbs: s.carbs + e.macros.carbs, fat: s.fat + e.macros.fat,
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

      const burned = log.burned || 0;
      const adjustedGoal = goal.kcal + burned;
      const kcalScore = adjustedGoal > 0 ? Math.max(0, Math.round(100 - (Math.abs(totals.kcal - adjustedGoal) / adjustedGoal * 100) * 2)) : 0;
      const prot = Math.min(100, (totals.protein / goal.protein) * 100);
      const carb = Math.min(100, (totals.carbs / goal.carbs) * 100);
      const fat = Math.min(100, (totals.fat / goal.fat) * 100);
      const macroScore = Math.round(prot * 0.5 + carb * 0.25 + fat * 0.25);

      const MICRO_REFS: Record<string, number> = {
        fiber: 30, sugar: 50, salt: 6, saturatedFat: 20, vitaminA: 800,
        vitaminB6: 1.4, vitaminB12: 2.4, vitaminC: 80, vitaminD: 20, vitaminE: 12,
        folate: 200, calcium: 1000, iron: 14, magnesium: 375, zinc: 10,
        potassium: 2000, phosphorus: 700, sodium: 2300,
      };
      const micros: Record<string, number> = {};
      entries.forEach(e => {
        if (!e.micros) return;
        Object.entries(e.micros).forEach(([k, v]) => { if (v !== undefined) micros[k] = (micros[k] || 0) + v; });
      });
      const microScores = Object.keys(MICRO_REFS).map(k => Math.min(100, ((micros[k] || 0) / MICRO_REFS[k]) * 100));
      const microScore = Math.round(microScores.reduce((a, b) => a + b, 0) / microScores.length);

      nutritionScore = Math.round(kcalScore * 0.30 + macroScore * 0.40 + microScore * 0.30);
    } else {
      nutritionScore = 0;
    }
  }

  // --- VO2max ---
  let vo2max: number | null = null;
  if (rawVo2) {
    const v = JSON.parse(rawVo2);
    if (typeof v.value === 'number') vo2max = v.value;
  }

  // --- Last workout stats ---
  let lastWorkoutValue = naLabel;
  if (workouts.length) {
    const sorted = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = sorted[0];
    const duration = last.duration ?? 0;
    let volume = 0;
    if (Array.isArray(last.exercises)) {
      for (const ex of last.exercises) {
        const sets = Array.isArray(ex?.sets) ? ex.sets : [];
        for (const set of sets) {
          const r = parseFloat(set?.reps || '0');
          const w = parseFloat(set?.weight || '0');
          if (r > 0 && w > 0) volume += r * w;
        }
      }
    }
    const parts: string[] = [];
    if (duration) parts.push(`${duration} min`);
    if (volume > 0) parts.push(`${Math.round(volume).toLocaleString(lang === 'en' ? 'en-US' : 'de-DE')} kg`);
    if (typeof last.score === 'number') parts.push(`${last.score} pts`);
    lastWorkoutValue = parts.length ? parts.join(' · ') : naLabel;
  }

  const numberFmt = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');

  const data: Record<WidgetMetricKey, WidgetMetricValue> = {
    battery: {
      label: METRIC_LABELS.battery[lang],
      value: batteryLevel > 0 ? `${batteryLevel}%` : naLabel,
      color: levelColor(batteryLevel),
    },
    readiness: {
      label: METRIC_LABELS.readiness[lang],
      value: `${readiness.score}`,
      color: readiness.color,
    },
    steps: {
      label: METRIC_LABELS.steps[lang],
      value: steps !== null ? numberFmt(steps) : naLabel,
      color: NEUTRAL,
    },
    calories: {
      label: METRIC_LABELS.calories[lang],
      value: totalCalories !== null ? `${numberFmt(totalCalories)} kcal` : naLabel,
      color: '#E8572A',
    },
    resting_hr: {
      label: METRIC_LABELS.resting_hr[lang],
      value: restingHR !== null ? `${restingHR} bpm` : naLabel,
      color: NEUTRAL,
    },
    hrv: {
      label: METRIC_LABELS.hrv[lang],
      value: hrv !== null ? `${hrv} ms` : naLabel,
      color: NEUTRAL,
    },
    streak: {
      label: METRIC_LABELS.streak[lang],
      value: streak > 0 ? `${streak} 🔥` : '0',
      color: streak >= 7 ? '#F97316' : streak > 0 ? YELLOW : DIM,
    },
    next_workout: {
      label: METRIC_LABELS.next_workout[lang],
      value: nextWorkoutValue,
      color: '#4A9EFF',
    },
    sleep: {
      label: METRIC_LABELS.sleep[lang],
      value: sleepScore !== null ? `${sleepScore}` : naLabel,
      color: sleepScore !== null ? levelColor(sleepScore) : DIM,
    },
    stress: {
      label: METRIC_LABELS.stress[lang],
      value: stressScore !== null ? `${stressScore}` : naLabel,
      color: stressScore !== null ? inverseLevelColor(stressScore) : DIM,
    },
    muscle_recovery: {
      label: METRIC_LABELS.muscle_recovery[lang],
      value: muscleRecoveryAvg !== null ? `${muscleRecoveryAvg}%` : naLabel,
      color: muscleRecoveryAvg !== null ? levelColor(muscleRecoveryAvg) : DIM,
    },
    weight: {
      label: METRIC_LABELS.weight[lang],
      value: weightValue,
      color: weightColor,
    },
    nutrition: {
      label: METRIC_LABELS.nutrition[lang],
      value: nutritionScore !== null ? `${nutritionScore}` : naLabel,
      color: nutritionScore !== null ? levelColor(nutritionScore) : DIM,
    },
    vo2max: {
      label: METRIC_LABELS.vo2max[lang],
      value: vo2max !== null ? `${vo2max}` : naLabel,
      color: NEUTRAL,
    },
    last_workout: {
      label: METRIC_LABELS.last_workout[lang],
      value: lastWorkoutValue,
      color: NEUTRAL,
    },
  };

  return data;
}

/** Letzte 7 Tage Recovery Score (0-100) für die Mini-Chart im großen Widget — als Trend-Verlauf für Body Battery/Readiness. */
async function buildRecoveryHistory(): Promise<number[]> {
  const rawHealth = await AsyncStorage.getItem('stride_health_history');
  const hist: DayHealth[] = rawHealth ? JSON.parse(rawHealth) : [];
  return hist
    .filter(h => typeof h.recoveryScore === 'number' && h.recoveryScore > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map(h => h.recoveryScore);
}

/** Writes the latest widget data + config to the shared App Group and reloads all widget timelines. */
export async function syncWidgetData(lang?: Lang): Promise<void> {
  if (Platform.OS !== 'ios' || !ExtensionStorageClass) return;
  try {
    const resolvedLang = lang ?? await getLang();
    const [data, config, history] = await Promise.all([
      buildWidgetData(resolvedLang),
      getWidgetConfig(),
      buildRecoveryHistory(),
    ]);

    const storage = new ExtensionStorageClass(WIDGET_APP_GROUP);
    storage.set('widgetData', JSON.stringify(data));
    storage.set('widgetConfig', JSON.stringify(config));
    storage.set('widgetHistory', JSON.stringify(history));
    storage.set('widgetLang', resolvedLang);
    storage.set('widgetUpdatedAt', new Date().toISOString());
    ExtensionStorageClass.reloadWidget();
  } catch {
    // best effort — widgets are non-critical
  }
}
