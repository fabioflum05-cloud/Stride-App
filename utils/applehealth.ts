// utils/applehealth.ts
// Apple Health (HealthKit) Integration via @kingstinct/react-native-healthkit (Nitro Modules, New Architecture compatible).
// iOS only — requires a custom dev client / EAS build (not available in Expo Go).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  CategoryValueSleepAnalysis,
  enableBackgroundDelivery,
  getMostRecentQuantitySample,
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  subscribeToChanges,
  UpdateFrequency,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';

const HEALTH_KEY = 'stride_health_history';
const SLEEP_KEY = 'lastSleep';
const VO2_KEY = 'vo2maxData';
const LAST_SYNC_KEY = 'appleHealthLastSync';
const WORKOUTS_KEY = 'workouts';
const BATTERY_KEY = 'batteryData';
const MUSCLE_KEY = 'muscleRecovery';
const LANGUAGE_KEY = 'appLanguage';

type Lang = 'de' | 'en';

interface DayHealth {
  date: string;
  hrv: number | null;
  restingHR: number | null;
  sleepHours: number;
  sleepQuality: number;
  recoveryScore: number;
  stressScore?: number | null;
  steps?: number | null;
  activeEnergy?: number | null;
  basalEnergy?: number | null;
  bodyweight: number | null;
  notes: string;
}

interface StoredWorkout {
  id: string;
  date: string;
  name: string;
  exercises: unknown[];
  duration: number;
  intensity: number;
  type: 'gym' | 'run' | 'manual' | 'judo' | 'cardio';
  source?: 'manual' | 'apple_health';
  activityType?: number;
  calories?: number;
  distance?: number;
  score?: number;
}

function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios' && isHealthDataAvailable();
}

export async function initHealthKit(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  return requestAuthorization({
    toRead: [
      'HKQuantityTypeIdentifierRestingHeartRate',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierVO2Max',
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierBasalEnergyBurned',
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKWorkoutTypeIdentifier',
    ],
  });
}

async function fetchLatestRestingHeartRate(): Promise<number | null> {
  const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min');
  return sample ? Math.round(sample.quantity) : null;
}

/**
 * HRV der letzten Nacht (12:00 Vortag bis jetzt).
 * HealthKit kennt nur den Typ HeartRateVariabilitySDNN — eine eigene RMSSD-Kennzahl
 * existiert dort nicht. Garmin berechnet seinen "HRV Status" intern aus RMSSD,
 * schreibt das Ergebnis beim Sync nach Apple Health aber ebenfalls in dieses
 * SDNN-Feld (einziger verfügbarer HRV-Typ). Garmin liefert dafür EINEN Sample,
 * dessen Zeitspanne die gesamte Nacht abdeckt. Die Apple Watch schreibt zusätzlich
 * viele kurze (~5 Min) Tages-Spotchecks mit deutlich niedrigeren Werten — ein
 * einfacher Durchschnitt über die ganze Nacht (wie zuvor via discreteAverage)
 * wird dadurch nach unten verzerrt (z.B. auf ~33 statt dem echten nächtlichen Wert).
 * Daher: den Sample mit der längsten Dauer wählen — das ist der nächtliche
 * Summary-Wert (Garmin/Whoop/Oura-Stil), nicht ein kurzer Tages-Spotcheck.
 */
async function fetchLatestHRV(): Promise<number | null> {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(12, 0, 0, 0);

  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
      filter: { date: { startDate: start, endDate: new Date() } },
      limit: 0,
      ascending: false,
      unit: 'ms',
    });
    if (samples.length > 0) {
      const longest = samples.reduce((a, b) =>
        (b.endDate.getTime() - b.startDate.getTime()) > (a.endDate.getTime() - a.startDate.getTime()) ? b : a
      );
      return Math.round(longest.quantity);
    }
  } catch {
    // fall through to most recent sample
  }

  const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms');
  return sample ? Math.round(sample.quantity) : null;
}

async function fetchLatestVo2Max(): Promise<number | null> {
  const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)');
  return sample ? Math.round(sample.quantity * 10) / 10 : null;
}

interface SleepDetails {
  hours: number;
  startDate: string;
  endDate: string;
  deepMin: number;
  remMin: number;
  lightMin: number;
  awakeMin: number;
  avgHeartRate: number | null;
}

/**
 * Liefert Schlafphasen (Tief/REM/Leicht/Wach in Minuten) sowie den Durchschnittspuls
 * während der letzten Nacht (12:00 Vortag bis jetzt) aus HealthKit.
 */
async function fetchLastNightSleepDetails(): Promise<SleepDetails | null> {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(12, 0, 0, 0);

  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: { date: { startDate: start, endDate: new Date() } },
    limit: 0,
    ascending: false,
  });

  let totalMs = 0, deepMs = 0, remMs = 0, lightMs = 0, awakeMs = 0;
  let windowStart = '';
  let windowEnd = '';

  samples.forEach(s => {
    const startIso = s.startDate.toISOString();
    const endIso = s.endDate.toISOString();
    if (!windowStart || startIso < windowStart) windowStart = startIso;
    if (!windowEnd || endIso > windowEnd) windowEnd = endIso;

    const ms = s.endDate.getTime() - s.startDate.getTime();
    switch (s.value as CategoryValueSleepAnalysis) {
      case CategoryValueSleepAnalysis.asleepDeep:
        deepMs += ms; totalMs += ms; break;
      case CategoryValueSleepAnalysis.asleepREM:
        remMs += ms; totalMs += ms; break;
      case CategoryValueSleepAnalysis.asleepCore:
      case CategoryValueSleepAnalysis.asleepUnspecified:
        lightMs += ms; totalMs += ms; break;
      case CategoryValueSleepAnalysis.awake:
        awakeMs += ms; break;
      default:
        break;
    }
  });

  if (totalMs === 0) return null;

  let avgHeartRate: number | null = null;
  try {
    const hrRes = await queryStatisticsForQuantity('HKQuantityTypeIdentifierHeartRate', ['discreteAverage'], {
      filter: { date: { startDate: new Date(windowStart), endDate: new Date(windowEnd) } },
      unit: 'count/min',
    });
    avgHeartRate = hrRes.averageQuantity ? Math.round(hrRes.averageQuantity.quantity) : null;
  } catch {
    // ignore — avg HR optional
  }

  return {
    hours: Math.round((totalMs / 3600000) * 10) / 10,
    startDate: windowStart,
    endDate: windowEnd,
    deepMin: Math.round(deepMs / 60000),
    remMin: Math.round(remMs / 60000),
    lightMin: Math.round(lightMs / 60000),
    awakeMin: Math.round(awakeMs / 60000),
    avgHeartRate,
  };
}

async function fetchTodaySteps(): Promise<number | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    const res = await queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: new Date() } },
      unit: 'count',
    });
    return res.sumQuantity ? Math.round(res.sumQuantity.quantity) : null;
  } catch {
    return null;
  }
}

async function fetchTodayActiveEnergy(): Promise<number | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    const res = await queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: new Date() } },
      unit: 'kcal',
    });
    return res.sumQuantity ? Math.round(res.sumQuantity.quantity) : null;
  } catch {
    return null;
  }
}

async function fetchTodayBasalEnergy(): Promise<number | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    const res = await queryStatisticsForQuantity('HKQuantityTypeIdentifierBasalEnergyBurned', ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: new Date() } },
      unit: 'kcal',
    });
    return res.sumQuantity ? Math.round(res.sumQuantity.quantity) : null;
  } catch {
    return null;
  }
}

function calcRecovery(d: DayHealth, avgHRV: number | null): number {
  let score = 0; let w = 0;
  if (d.hrv !== null) {
    const base = avgHRV ?? 55;
    score += Math.min(100, Math.max(0, (d.hrv / base) * 80)) * 0.40; w += 0.40;
  }
  if (d.restingHR !== null) {
    score += Math.min(100, Math.max(0, ((80 - d.restingHR) / 30) * 100)) * 0.25; w += 0.25;
  }
  const hp = Math.min(100, (d.sleepHours / 8) * 100);
  const qp = ((d.sleepQuality - 1) / 4) * 100;
  score += (hp * 0.6 + qp * 0.4) * 0.35; w += 0.35;
  return w > 0 ? Math.round(score / w) : 0;
}

function computeBaselines(history: DayHealth[], excludeDate: string): { hrvBaseline: number | null; rhrBaseline: number | null } {
  const past = history
    .filter(h => h.date !== excludeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const hrvVals = past.map(h => h.hrv).filter((v): v is number => v !== null && v !== undefined);
  const rhrVals = past.map(h => h.restingHR).filter((v): v is number => v !== null && v !== undefined);
  return {
    hrvBaseline: hrvVals.length ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length : null,
    rhrBaseline: rhrVals.length ? rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length : null,
  };
}

/**
 * Stress Score 0-100 (0 = kein Stress, 100 = sehr hoher Stress).
 * Basiert auf der Abweichung von HRV (60%) und Ruhepuls (40%) vom 7-Tage-Baseline.
 */
export function calcStressScore(
  hrv: number | null | undefined,
  hrvBaseline: number | null,
  rhr: number | null | undefined,
  rhrBaseline: number | null
): number | null {
  let score = 0;
  let weight = 0;

  if (hrv != null && hrvBaseline !== null && hrvBaseline > 0) {
    const hrvStress = Math.min(100, Math.max(0, (1 - hrv / hrvBaseline) * 200));
    score += hrvStress * 0.6; weight += 0.6;
  }

  if (rhr != null && rhrBaseline !== null && rhrBaseline > 0) {
    const rhrStress = Math.min(100, Math.max(0, ((rhr - rhrBaseline) / rhrBaseline) * 200));
    score += rhrStress * 0.4; weight += 0.4;
  }

  if (weight === 0) return null;
  return Math.round(score / weight);
}

/** Berechnet den Stress Score für jeden Eintrag der Verlaufshistorie anhand der jeweils vorherigen 7 Tage als Baseline. */
export function getStressHistory(history: DayHealth[]): { date: string; stress: number | null }[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((d, i) => {
    const prev = sorted.slice(Math.max(0, i - 7), i);
    const hrvVals = prev.map(p => p.hrv).filter((v): v is number => v !== null && v !== undefined);
    const rhrVals = prev.map(p => p.restingHR).filter((v): v is number => v !== null && v !== undefined);
    const hrvBaseline = hrvVals.length ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length : null;
    const rhrBaseline = rhrVals.length ? rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length : null;
    return { date: d.date, stress: calcStressScore(d.hrv, hrvBaseline, d.restingHR, rhrBaseline) };
  });
}

function sleepComponentScore(sleepHours: number, sleepQuality: number): number {
  const hp = Math.min(100, (sleepHours / 8) * 100);
  const qp = ((sleepQuality - 1) / 4) * 100;
  return Math.round(hp * 0.6 + qp * 0.4);
}

/**
 * Sleep Score 0-100: Tiefschlaf 30% · Dauer 25% · REM 20% · HRV 15% · tiefster Puls 10%.
 * Geteilte Formel zwischen manuellem Sleep Log (app/sleep.tsx) und Apple Health Import.
 */
export function calculateSleepScore(data: {
  schlafMin: number; tiefZeit: number; remZeit: number;
  hrv: number; tiefsterPuls: number; avgPuls: number;
}): number {
  const { schlafMin, tiefZeit, remZeit, hrv, tiefsterPuls } = data;
  const deep = Math.min(tiefZeit / (schlafMin * 0.20), 1) * 30;
  const dur = schlafMin < 300 ? (schlafMin / 360) * 25 :
    schlafMin <= 540 ? 25 :
    schlafMin <= 600 ? (1 - (schlafMin - 540) / 120) * 25 : 0;
  const rem = Math.min(remZeit / (schlafMin * 0.22), 1) * 20;
  const hrvScore = Math.min(hrv / 75, 1) * 15;
  const pulse = Math.max(0, Math.min((65 - tiefsterPuls) / 25, 1)) * 10;
  return Math.round(deep + dur + rem + hrvScore + pulse);
}

export interface TrainingReadiness {
  score: number;
  label: string;
  color: string;
  recommendation: string;
}

/**
 * Trainingsbereitschaft 0-100, analog zum Garmin Readiness Score.
 * Muskel-Erholung 30%, HRV-Status 25%, Schlaf 20%, (100 - Stress) 15%, Tage seit letztem Training 10%.
 */
export function calcTrainingReadiness(params: {
  muscleRecoveryAvg: number;
  hrv: number | null;
  hrvBaseline: number | null;
  sleepScore: number;
  stressScore: number | null;
  daysSinceLastTraining: number;
}, lang: Lang = 'de'): TrainingReadiness {
  const hrvStatus = params.hrv != null && params.hrvBaseline
    ? Math.min(100, Math.max(0, (params.hrv / params.hrvBaseline) * 100))
    : 60;
  const stress = params.stressScore ?? 40;
  const daysBonus = Math.min(100, params.daysSinceLastTraining * 50 + 50);

  const score = Math.round(
    params.muscleRecoveryAvg * 0.30 +
    hrvStatus * 0.25 +
    params.sleepScore * 0.20 +
    (100 - stress) * 0.15 +
    daysBonus * 0.10
  );

  const clamped = Math.max(0, Math.min(100, score));

  let label: string; let color: string; let recommendation: string;
  if (clamped >= 80) {
    color = '#4ADE80';
    label = lang === 'en' ? 'Excellent' : 'Optimal';
    recommendation = lang === 'en' ? 'Train intensely' : 'Intensiv trainieren';
  } else if (clamped >= 60) {
    color = '#60A5FA';
    label = lang === 'en' ? 'Good' : 'Gut';
    recommendation = lang === 'en' ? 'Train normally' : 'Normal trainieren';
  } else if (clamped >= 40) {
    color = '#FBBF24';
    label = lang === 'en' ? 'Moderate' : 'Moderat';
    recommendation = lang === 'en' ? 'Light training' : 'Leichtes Training';
  } else {
    color = '#F87171';
    label = lang === 'en' ? 'Low' : 'Niedrig';
    recommendation = lang === 'en' ? 'Rest day' : 'Ruhetag';
  }

  return { score: clamped, label, color, recommendation };
}

/** Lädt alle benötigten Daten aus AsyncStorage und berechnet die Trainingsbereitschaft. */
export async function getTrainingReadiness(lang: Lang = 'de'): Promise<TrainingReadiness> {
  const [rawHealth, rawSleep, rawMuscles, rawWorkouts] = await Promise.all([
    AsyncStorage.getItem(HEALTH_KEY),
    AsyncStorage.getItem(SLEEP_KEY),
    AsyncStorage.getItem(MUSCLE_KEY),
    AsyncStorage.getItem(WORKOUTS_KEY),
  ]);

  const hist: DayHealth[] = rawHealth ? JSON.parse(rawHealth) : [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntry = hist.find(h => h.date === todayKey);
  const { hrvBaseline, rhrBaseline } = computeBaselines(hist, todayKey);
  const stressScore = calcStressScore(todayEntry?.hrv ?? null, hrvBaseline, todayEntry?.restingHR ?? null, rhrBaseline);

  let sleepScore = 0;
  if (rawSleep) {
    const s = JSON.parse(rawSleep);
    if (isToday(s.date)) {
      if (typeof s.sleepScore === 'number' && s.sleepScore > 0) {
        sleepScore = s.sleepScore;
      } else if (typeof s.schlafStunden === 'number') {
        sleepScore = sleepComponentScore(s.schlafStunden, todayEntry?.sleepQuality ?? 3);
      }
    } else if (todayEntry) {
      sleepScore = sleepComponentScore(todayEntry.sleepHours, todayEntry.sleepQuality);
    }
  } else if (todayEntry) {
    sleepScore = sleepComponentScore(todayEntry.sleepHours, todayEntry.sleepQuality);
  }

  const muscles: Record<string, { level: number; lastTrained: string | null }> = rawMuscles ? JSON.parse(rawMuscles) : {};
  const levels = Object.values(muscles).map(m => m.level ?? 100);
  const muscleRecoveryAvg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 100;

  const workouts: { date: string }[] = rawWorkouts ? JSON.parse(rawWorkouts) : [];
  let daysSinceLastTraining = 7;
  if (workouts.length) {
    const lastTs = workouts.reduce((max, w) => Math.max(max, new Date(w.date).getTime()), 0);
    daysSinceLastTraining = Math.max(0, Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24)));
  }

  return calcTrainingReadiness({
    muscleRecoveryAvg,
    hrv: todayEntry?.hrv ?? null,
    hrvBaseline,
    sleepScore,
    stressScore,
    daysSinceLastTraining,
  }, lang);
}

const RUN_TYPES = new Set<WorkoutActivityType>([
  WorkoutActivityType.running,
  WorkoutActivityType.walking,
  WorkoutActivityType.hiking,
  WorkoutActivityType.trackAndField,
  WorkoutActivityType.wheelchairWalkPace,
  WorkoutActivityType.wheelchairRunPace,
]);

const JUDO_TYPES = new Set<WorkoutActivityType>([
  WorkoutActivityType.martialArts,
  WorkoutActivityType.boxing,
  WorkoutActivityType.kickboxing,
  WorkoutActivityType.wrestling,
  WorkoutActivityType.taiChi,
]);

const GYM_TYPES = new Set<WorkoutActivityType>([
  WorkoutActivityType.functionalStrengthTraining,
  WorkoutActivityType.traditionalStrengthTraining,
  WorkoutActivityType.crossTraining,
  WorkoutActivityType.highIntensityIntervalTraining,
  WorkoutActivityType.coreTraining,
]);

const ACTIVITY_NAMES: Partial<Record<WorkoutActivityType, { de: string; en: string }>> = {
  [WorkoutActivityType.running]: { de: 'Laufen', en: 'Running' },
  [WorkoutActivityType.walking]: { de: 'Gehen', en: 'Walking' },
  [WorkoutActivityType.hiking]: { de: 'Wandern', en: 'Hiking' },
  [WorkoutActivityType.cycling]: { de: 'Radfahren', en: 'Cycling' },
  [WorkoutActivityType.handCycling]: { de: 'Handbike', en: 'Hand Cycling' },
  [WorkoutActivityType.swimming]: { de: 'Schwimmen', en: 'Swimming' },
  [WorkoutActivityType.rowing]: { de: 'Rudern', en: 'Rowing' },
  [WorkoutActivityType.elliptical]: { de: 'Crosstrainer', en: 'Elliptical' },
  [WorkoutActivityType.yoga]: { de: 'Yoga', en: 'Yoga' },
  [WorkoutActivityType.pilates]: { de: 'Pilates', en: 'Pilates' },
  [WorkoutActivityType.coreTraining]: { de: 'Core-Training', en: 'Core Training' },
  [WorkoutActivityType.stairClimbing]: { de: 'Treppensteigen', en: 'Stair Climbing' },
  [WorkoutActivityType.stairs]: { de: 'Treppensteigen', en: 'Stair Climbing' },
  [WorkoutActivityType.jumpRope]: { de: 'Seilspringen', en: 'Jump Rope' },
  [WorkoutActivityType.dance]: { de: 'Tanzen', en: 'Dance' },
  [WorkoutActivityType.cardioDance]: { de: 'Cardio-Tanz', en: 'Cardio Dance' },
  [WorkoutActivityType.basketball]: { de: 'Basketball', en: 'Basketball' },
  [WorkoutActivityType.soccer]: { de: 'Fußball', en: 'Soccer' },
  [WorkoutActivityType.tennis]: { de: 'Tennis', en: 'Tennis' },
  [WorkoutActivityType.golf]: { de: 'Golf', en: 'Golf' },
  [WorkoutActivityType.martialArts]: { de: 'Kampfsport', en: 'Martial Arts' },
  [WorkoutActivityType.boxing]: { de: 'Boxen', en: 'Boxen' },
  [WorkoutActivityType.kickboxing]: { de: 'Kickboxen', en: 'Kickboxing' },
  [WorkoutActivityType.wrestling]: { de: 'Ringen', en: 'Wrestling' },
  [WorkoutActivityType.taiChi]: { de: 'Tai Chi', en: 'Tai Chi' },
  [WorkoutActivityType.functionalStrengthTraining]: { de: 'Krafttraining', en: 'Strength Training' },
  [WorkoutActivityType.traditionalStrengthTraining]: { de: 'Krafttraining', en: 'Strength Training' },
  [WorkoutActivityType.crossTraining]: { de: 'Cross-Training', en: 'Cross Training' },
  [WorkoutActivityType.highIntensityIntervalTraining]: { de: 'HIIT', en: 'HIIT' },
  [WorkoutActivityType.mixedCardio]: { de: 'Cardio', en: 'Cardio' },
  [WorkoutActivityType.mixedMetabolicCardioTraining]: { de: 'Cardio', en: 'Cardio' },
  [WorkoutActivityType.flexibility]: { de: 'Dehnen', en: 'Flexibility' },
  [WorkoutActivityType.climbing]: { de: 'Klettern', en: 'Climbing' },
  [WorkoutActivityType.skatingSports]: { de: 'Skaten', en: 'Skating' },
  [WorkoutActivityType.snowSports]: { de: 'Wintersport', en: 'Snow Sports' },
  [WorkoutActivityType.crossCountrySkiing]: { de: 'Skilanglauf', en: 'Cross-Country Skiing' },
  [WorkoutActivityType.downhillSkiing]: { de: 'Skifahren', en: 'Downhill Skiing' },
  [WorkoutActivityType.snowboarding]: { de: 'Snowboarden', en: 'Snowboarding' },
  [WorkoutActivityType.waterFitness]: { de: 'Wassergymnastik', en: 'Water Fitness' },
  [WorkoutActivityType.waterPolo]: { de: 'Wasserball', en: 'Water Polo' },
  [WorkoutActivityType.gymnastics]: { de: 'Turnen', en: 'Gymnastics' },
  [WorkoutActivityType.mindAndBody]: { de: 'Achtsamkeit', en: 'Mind & Body' },
};

/** Ordnet einen HealthKit Workout-Typ einem App-internen Typ + lokalisiertem Namen zu. */
export function mapWorkoutActivityType(activityType: WorkoutActivityType, lang: Lang = 'de'): { name: string; type: 'gym' | 'run' | 'judo' | 'cardio' } {
  let type: 'gym' | 'run' | 'judo' | 'cardio' = 'cardio';
  if (RUN_TYPES.has(activityType)) type = 'run';
  else if (JUDO_TYPES.has(activityType)) type = 'judo';
  else if (GYM_TYPES.has(activityType)) type = 'gym';

  const names = ACTIVITY_NAMES[activityType];
  const name = names ? names[lang] : (lang === 'en' ? 'Workout' : 'Training');

  return { name, type };
}

function metersToKm(q?: { unit: string; quantity: number } | null): number | undefined {
  if (!q) return undefined;
  // HealthKit liefert totalDistance als Quantity mit unit "meters" (nicht "m") — siehe
  // WorkoutProxy.swift: Quantity(unit: "meters", quantity: ...HKUnit.meter()...).
  const isMeters = q.unit === 'm' || q.unit.toLowerCase().startsWith('meter');
  if (isMeters) return Math.round((q.quantity / 1000) * 100) / 100;
  return Math.round(q.quantity * 100) / 100;
}

/**
 * Zwei Apple-Health-Workouts gelten als dasselbe reale Training, wenn Aktivitätstyp,
 * Startzeit (±5 Min) und Dauer (±5 Min) übereinstimmen. Nötig weil Garmin/Watch bei
 * wiederholtem Sync mitunter mehrere HKWorkout-Objekte mit unterschiedlicher UUID
 * für dasselbe Training in Apple Health anlegen — reines UUID-Dedup reicht dann nicht.
 */
function isSameAppleHealthWorkout(
  a: { activityType?: number; date: string; duration: number },
  b: { activityType?: number; date: string; duration: number }
): boolean {
  return a.activityType === b.activityType &&
    Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) <= 5 * 60000 &&
    Math.abs((a.duration ?? 0) - (b.duration ?? 0)) <= 5;
}

/** Bereinigt bereits gespeicherte Apple-Health-Duplikate (z.B. durch einen früheren Sync-Bug entstanden). */
function dedupeAppleHealthWorkouts(list: StoredWorkout[]): StoredWorkout[] {
  const kept: StoredWorkout[] = [];
  for (const w of list) {
    if (w.source === 'apple_health' && kept.some(k => k.source === 'apple_health' && isSameAppleHealthWorkout(k, w))) {
      continue;
    }
    kept.push(w);
  }
  return kept;
}

/**
 * Repariert bereits gespeicherte Distanzen, die durch den früheren "meters" vs. "m"
 * Einheiten-Bug fälschlich unskaliert (in Metern statt Kilometern) abgespeichert wurden
 * — z.B. 5000 statt 5 für einen 5km-Lauf. Kein realistisches Einzeltraining kommt auf
 * >500km, daher ist das ein sicherer Indikator für den alten Bug.
 */
function repairImplausibleDistances(list: StoredWorkout[]): { list: StoredWorkout[]; changed: boolean } {
  let changed = false;
  const fixed = list.map(w => {
    if (w.source === 'apple_health' && w.distance != null && w.distance > 500) {
      changed = true;
      return { ...w, distance: Math.round((w.distance / 1000) * 100) / 100 };
    }
    return w;
  });
  return { list: fixed, changed };
}

let workoutSyncInProgress = false;

/** Importiert Apple Health Workouts der letzten 30 Tage in den `workouts` AsyncStorage-Eintrag (mit Duplikat-Prüfung). */
export async function syncAppleHealthWorkouts(): Promise<{ added: number }> {
  if (!isHealthKitAvailable()) return { added: 0 };
  // Verhindert überlappende Läufe (z.B. Training-Tab-Focus + Background-Sync gleichzeitig),
  // die andernfalls beide auf demselben veralteten AsyncStorage-Stand rechnen würden.
  if (workoutSyncInProgress) return { added: 0 };
  workoutSyncInProgress = true;
  try {
    return await syncAppleHealthWorkoutsInternal();
  } finally {
    workoutSyncInProgress = false;
  }
}

async function syncAppleHealthWorkoutsInternal(): Promise<{ added: number }> {
  const ok = await initHealthKit();
  if (!ok) return { added: 0 };

  const since = new Date();
  since.setDate(since.getDate() - 30);

  let hkWorkouts: ReadonlyArray<{
    uuid: string;
    startDate: Date;
    workoutActivityType: WorkoutActivityType;
    duration: { unit: string; quantity: number };
    totalEnergyBurned?: { unit: string; quantity: number };
    totalDistance?: { unit: string; quantity: number };
  }>;
  try {
    hkWorkouts = await queryWorkoutSamples({
      filter: { date: { startDate: since, endDate: new Date() } },
      limit: 100,
      ascending: false,
    });
  } catch {
    return { added: 0 };
  }

  const langRaw = await AsyncStorage.getItem(LANGUAGE_KEY);
  const lang: Lang = langRaw === 'en' ? 'en' : 'de';

  const raw = await AsyncStorage.getItem(WORKOUTS_KEY);
  const stored: StoredWorkout[] = raw ? JSON.parse(raw) : [];
  let existing = dedupeAppleHealthWorkouts(stored);
  const repair = repairImplausibleDistances(existing);
  existing = repair.list;
  let refreshed = repair.changed;
  const existingHkIds = new Set(existing.map(w => w.id));

  const newOnes: StoredWorkout[] = [];
  for (const w of hkWorkouts) {
    const id = `hk_${w.uuid}`;
    const durationMin = Math.round((w.duration?.quantity ?? 0) / 60);
    if (durationMin <= 0) continue;

    const freshDistance = metersToKm(w.totalDistance);
    const freshCalories = w.totalEnergyBurned ? Math.round(w.totalEnergyBurned.quantity) : undefined;

    // Bereits importiert: Distanz/Kalorien/Dauer mit den aktuell aus HealthKit gelesenen
    // Werten auffrischen — behebt Altbestände, die durch einen früheren Bug (z.B. die
    // "meters" vs. "m" Einheitenverwechslung) falsch abgespeichert wurden.
    const existingIdx = existing.findIndex(e => e.id === id);
    if (existingIdx !== -1) {
      const e = existing[existingIdx];
      if (e.distance !== freshDistance || e.calories !== freshCalories || e.duration !== durationMin) {
        existing[existingIdx] = { ...e, distance: freshDistance, calories: freshCalories, duration: durationMin };
        refreshed = true;
      }
      continue;
    }

    const startDate = new Date(w.startDate);
    const startDay = startDate.toISOString().slice(0, 10);
    const dupManual = existing.some(e =>
      e.source !== 'apple_health' &&
      e.date.slice(0, 10) === startDay &&
      Math.abs((e.duration ?? 0) - durationMin) <= 10
    );
    if (dupManual) continue;

    const candidate = { activityType: w.workoutActivityType, date: startDate.toISOString(), duration: durationMin };
    const dupAppleHealth = [...existing, ...newOnes].some(e =>
      e.source === 'apple_health' && isSameAppleHealthWorkout(e, candidate)
    );
    if (dupAppleHealth) continue;

    const { name, type } = mapWorkoutActivityType(w.workoutActivityType, lang);

    newOnes.push({
      id,
      date: startDate.toISOString(),
      name,
      exercises: [],
      duration: durationMin,
      intensity: 3,
      type,
      source: 'apple_health',
      activityType: w.workoutActivityType,
      calories: freshCalories,
      distance: freshDistance,
    });
  }

  if (newOnes.length > 0 || refreshed || existing.length !== stored.length) {
    const merged = [...newOnes, ...existing].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(merged));
  }

  return { added: newOnes.length };
}

interface CalorieEntry { id: string; time: string; kcal: number; label: string; }
interface BatteryData { level: number; calorieEntries: CalorieEntry[]; date: string; }

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

/**
 * Body Battery Level 0-100. Einzige Quelle der Wahrheit für die Berechnung —
 * wird sowohl von recalcBodyBattery() (Hintergrund-Sync) als auch von app/battery.tsx (manuelle Einträge) verwendet.
 * Basis = Sleep Score * 0.85 (Aufladung durch Schlaf).
 * Drain = (manuelle kcal + aktive Kalorien + Grundumsatz) / 100 * 1.5  +  Stress-Anteil (Stress Score 0-100 / 20 * 4).
 */
export function calcBatteryLevel(params: {
  sleepScore: number;
  calorieEntries: { kcal: number }[];
  activeEnergy?: number | null;
  basalEnergy?: number | null;
  stressScore?: number | null;
}): number {
  const base = Math.round(params.sleepScore * 0.85);
  const manualKcal = params.calorieEntries.reduce((sum, e) => sum + e.kcal, 0);
  const activeEnergy = params.activeEnergy ?? 0;
  const basalEnergy = params.basalEnergy ?? 0;
  const kcalDrain = Math.round(((manualKcal + activeEnergy + basalEnergy) / 100) * 1.5);
  const stressVal = params.stressScore != null ? params.stressScore / 20 : 3;
  const stressDrain = Math.round(stressVal * 4);
  return Math.max(0, Math.min(100, base - kcalDrain - stressDrain));
}

/** Berechnet Body Battery neu basierend auf Schlaf, Stress Score und heutigem Kalorienverbrauch (manuell + Apple Health, aktiv + Grundumsatz). */
export async function recalcBodyBattery(): Promise<void> {
  const [rawSleep, rawBattery, rawHealth] = await Promise.all([
    AsyncStorage.getItem(SLEEP_KEY),
    AsyncStorage.getItem(BATTERY_KEY),
    AsyncStorage.getItem(HEALTH_KEY),
  ]);

  let sleepScore = 0;
  if (rawSleep) {
    const s = JSON.parse(rawSleep);
    if (isToday(s.date) && typeof s.sleepScore === 'number') sleepScore = s.sleepScore;
  }

  const hist: DayHealth[] = rawHealth ? JSON.parse(rawHealth) : [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntry = hist.find(h => h.date === todayKey);
  const { hrvBaseline, rhrBaseline } = computeBaselines(hist, todayKey);
  const stressScore = calcStressScore(todayEntry?.hrv ?? null, hrvBaseline, todayEntry?.restingHR ?? null, rhrBaseline);

  let battery: BatteryData;
  if (rawBattery) {
    const b: BatteryData = JSON.parse(rawBattery);
    battery = isToday(b.date) ? b : { level: 0, calorieEntries: [], date: new Date().toISOString() };
  } else {
    battery = { level: 0, calorieEntries: [], date: new Date().toISOString() };
  }

  battery.level = calcBatteryLevel({
    sleepScore,
    calorieEntries: battery.calorieEntries,
    activeEnergy: todayEntry?.activeEnergy,
    basalEnergy: todayEntry?.basalEnergy,
    stressScore,
  });

  await AsyncStorage.setItem(BATTERY_KEY, JSON.stringify(battery));
}

export async function fetchAndImportHealthData(): Promise<{ success: boolean; message: string }> {
  if (!isHealthKitAvailable()) {
    return { success: false, message: 'Apple Health ist auf diesem Gerät nicht verfügbar.' };
  }

  const ok = await initHealthKit();
  if (!ok) return { success: false, message: 'Zugriff auf Apple Health wurde nicht gewährt.' };

  const [restingHR, hrv, vo2, sleep, steps, activeEnergy, basalEnergy] = await Promise.all([
    fetchLatestRestingHeartRate(),
    fetchLatestHRV(),
    fetchLatestVo2Max(),
    fetchLastNightSleepDetails(),
    fetchTodaySteps(),
    fetchTodayActiveEnergy(),
    fetchTodayBasalEnergy(),
  ]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const raw = await AsyncStorage.getItem(HEALTH_KEY);
  let hist: DayHealth[] = raw ? JSON.parse(raw) : [];
  const existing = hist.find(h => h.date === todayKey);

  const merged: DayHealth = {
    date: todayKey,
    hrv: hrv ?? existing?.hrv ?? null,
    restingHR: restingHR ?? existing?.restingHR ?? null,
    sleepHours: sleep?.hours ?? existing?.sleepHours ?? 0,
    sleepQuality: existing?.sleepQuality ?? 3,
    recoveryScore: existing?.recoveryScore ?? 0,
    stressScore: existing?.stressScore ?? null,
    steps: steps ?? existing?.steps ?? null,
    activeEnergy: activeEnergy ?? existing?.activeEnergy ?? null,
    basalEnergy: basalEnergy ?? existing?.basalEnergy ?? null,
    bodyweight: existing?.bodyweight ?? null,
    notes: existing?.notes ?? '',
  };

  const hrvVals = hist.filter(h => h.hrv !== null && h.date !== todayKey).map(h => h.hrv as number);
  const avgHRV = hrvVals.length ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length : null;
  merged.recoveryScore = calcRecovery(merged, avgHRV);

  const { hrvBaseline, rhrBaseline } = computeBaselines(hist, todayKey);
  merged.stressScore = calcStressScore(merged.hrv, hrvBaseline, merged.restingHR, rhrBaseline);

  hist = existing ? hist.map(h => h.date === todayKey ? merged : h) : [merged, ...hist];
  await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(hist));

  if (vo2 !== null) {
    await AsyncStorage.setItem(VO2_KEY, JSON.stringify({ value: vo2, source: 'apple_health', updatedAt: new Date().toISOString() }));
  }

  if (sleep) {
    const rawLastSleep = await AsyncStorage.getItem(SLEEP_KEY);
    const existingSleep = rawLastSleep ? JSON.parse(rawLastSleep) : {};

    const schlafMin = Math.round(sleep.hours * 60);
    const hrvVal = hrv ?? existingSleep.hrv ?? 0;
    const tiefsterPuls = restingHR ?? existingSleep.tiefsterPuls ?? 60;
    const avgPuls = sleep.avgHeartRate ?? existingSleep.avgPuls ?? null;

    const sleepScore = calculateSleepScore({
      schlafMin,
      tiefZeit: sleep.deepMin,
      remZeit: sleep.remMin,
      hrv: hrvVal,
      tiefsterPuls,
      avgPuls: avgPuls ?? 0,
    });

    await AsyncStorage.setItem(SLEEP_KEY, JSON.stringify({
      ...existingSleep,
      date: sleep.endDate,
      schlafStunden: sleep.hours,
      schlafMin,
      deep: sleep.deepMin,
      rem: sleep.remMin,
      light: sleep.lightMin,
      awake: sleep.awakeMin,
      deepZeit: sleep.deepMin / 60,
      remZeit: sleep.remMin / 60,
      avgPuls: avgPuls ?? existingSleep.avgPuls,
      tiefsterPuls,
      restingHR: tiefsterPuls,
      hrv: hrvVal,
      sleepScore,
      bedtime: sleep.startDate,
      wakeTime: sleep.endDate,
      source: 'apple_health',
    }));
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return { success: true, message: 'Apple Health Daten synchronisiert.' };
}

export async function getLastHealthSync(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

const BACKGROUND_TYPES = [
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

let activeSubscriptions: { remove: () => boolean }[] = [];
let syncInProgress = false;

/** Führt einen vollständigen Health-Sync durch: Vitalwerte, Body Battery, Apple Health Workouts. */
export async function syncAllHealthData(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    await fetchAndImportHealthData();
    await syncAppleHealthWorkouts();
    await recalcBodyBattery();
  } catch {
    // ignore — best effort background sync
  } finally {
    syncInProgress = false;
  }
}

/**
 * Aktiviert HealthKit Background Delivery für Puls, Schritte, Kalorien, HRV, Schlaf und Workouts
 * und richtet Listener ein, die bei neuen Daten automatisch einen vollständigen Sync auslösen.
 */
export async function startHealthAutoSync(): Promise<void> {
  try {
    if (!isHealthKitAvailable()) return;
    const ok = await initHealthKit();
    if (!ok) return;

    for (const type of BACKGROUND_TYPES) {
      try {
        await enableBackgroundDelivery(type, UpdateFrequency.immediate);
      } catch {
        // ignore unsupported types
      }
    }

    activeSubscriptions.forEach(s => { try { s.remove(); } catch { /* ignore */ } });
    activeSubscriptions = BACKGROUND_TYPES.map(type =>
      subscribeToChanges(type, () => { syncAllHealthData().catch(() => {}); })
    );

    await syncAllHealthData();
  } catch {
    // HealthKit unavailable/unauthorized — app must continue without it
  }
}

export function stopHealthAutoSync(): void {
  activeSubscriptions.forEach(s => { try { s.remove(); } catch { /* ignore */ } });
  activeSubscriptions = [];
}

export { isHealthKitAvailable };
export type { DayHealth };
