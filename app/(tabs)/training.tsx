import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, AppStateStatus,
  Dimensions, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { JudoTrackingScreen } from '../judo-tracking';

const SW = Dimensions.get('window').width;

const theme = {
  bg:            '#1A1614',
  card:          '#231F1C',
  cardSecondary: '#2E2825',
  border:        'rgba(255,255,255,0.07)' as string,
  orange:        '#E8572A',
  orangeLight:   'rgba(232,87,42,0.15)' as string,
  orangeBorder:  'rgba(232,87,42,0.25)' as string,
  blue:          '#4A9EFF',
  blueLight:     'rgba(74,158,255,0.12)' as string,
  green:         '#34C759',
  greenLight:    'rgba(52,199,89,0.12)' as string,
  red:           '#FF453A',
  redLight:      'rgba(255,69,58,0.12)' as string,
  pink:          '#FF375F',
  yellow:        '#FFD60A',
  textPrimary:   '#F5F0EE',
  textSecondary: 'rgba(245,240,238,0.45)' as string,
  textTertiary:  'rgba(245,240,238,0.22)' as string,
};

// ─── Types ────────────────────────────────────────────────────
type WorkoutSet = { reps: string; weight: string };
type Exercise = { id: string; name: string; muscleGroup: string; equipment?: string; sets: WorkoutSet[] };
type Workout = {
  id: string; date: string; name: string; exercises: Exercise[];
  duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo';
  score?: number;
};
type RunData = { id: string; distance: number; duration: number; pace: string; calories: number; heartRate: number; date: string; };
type PREntry = { date: string; weight: number; reps: number; estimated1RM: number };
type PRHistory = Record<string, PREntry[]>;
type UserMaxes = Record<string, number>;
type Routine = { id: string; name: string; exercises: { name: string; muscleGroup: string; defaultSets: number; equipment?: string }[]; };
type MuscleState = { level: number; lastTrained: string | null };
type MuscleMap = Record<string, MuscleState>;

// ─── Exercise Database with muscle mappings & equipment ───────
// primary: main muscle (100% fatigue weight)
// secondary: helper muscles (partial fatigue weight)
// equipment variants shown in picker
type ExerciseData = {
  name: string;
  muscleGroup: string; // primary
  secondary: { muscle: string; weight: number }[]; // 0–1 fatigue contribution
  equipment: string[]; // available variants
};

const EXERCISE_DB: ExerciseData[] = [
  // BRUST
  { name: 'Bankdrücken',         muscleGroup: 'Brust',       secondary: [{ muscle: 'Trizeps', weight: 0.45 }, { muscle: 'Schultern', weight: 0.25 }], equipment: ['Langhantel', 'Kurzhantel', 'Maschine', 'Smith'] },
  { name: 'Schrägbankdrücken',   muscleGroup: 'Brust',       secondary: [{ muscle: 'Trizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.30 }], equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug'] },
  { name: 'Fliegende',           muscleGroup: 'Brust',       secondary: [{ muscle: 'Schultern', weight: 0.15 }],                                      equipment: ['Kurzhantel', 'Kabelzug', 'Maschine (Butterfly)'] },
  { name: 'Dips',                muscleGroup: 'Brust',       secondary: [{ muscle: 'Trizeps', weight: 0.55 }, { muscle: 'Schultern', weight: 0.20 }], equipment: ['Körpergewicht', 'Gewichtsgürtel'] },
  // RÜCKEN
  { name: 'Klimmzüge',           muscleGroup: 'Rücken',      secondary: [{ muscle: 'Bizeps', weight: 0.50 }, { muscle: 'Core', weight: 0.15 }],       equipment: ['Körpergewicht', 'Gewichtsgürtel', 'Maschine (Latzug)'] },
  { name: 'Rudern',              muscleGroup: 'Rücken',      secondary: [{ muscle: 'Bizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.15 }],   equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Kreuzheben',          muscleGroup: 'Rücken',      secondary: [{ muscle: 'Hamstrings', weight: 0.55 }, { muscle: 'Gluteus', weight: 0.40 }, { muscle: 'Quadrizeps', weight: 0.25 }, { muscle: 'Core', weight: 0.30 }], equipment: ['Langhantel', 'Sumo'] },
  { name: 'Latzug',              muscleGroup: 'Rücken',      secondary: [{ muscle: 'Bizeps', weight: 0.45 }, { muscle: 'Schultern', weight: 0.10 }],   equipment: ['Kabelzug breit', 'Kabelzug eng', 'Kabelzug neutral'] },
  { name: 'Face Pulls',          muscleGroup: 'Rücken',      secondary: [{ muscle: 'Schultern', weight: 0.40 }],                                      equipment: ['Kabelzug'] },
  { name: 'Deadlift',            muscleGroup: 'Rücken',      secondary: [{ muscle: 'Hamstrings', weight: 0.50 }, { muscle: 'Gluteus', weight: 0.35 }, { muscle: 'Core', weight: 0.35 }], equipment: ['Langhantel', 'Trap Bar'] },
  // SCHULTERN
  { name: 'Schulterdrücken',     muscleGroup: 'Schultern',   secondary: [{ muscle: 'Trizeps', weight: 0.40 }, { muscle: 'Core', weight: 0.10 }],      equipment: ['Langhantel', 'Kurzhantel', 'Maschine', 'Smith'] },
  { name: 'Seitheben',           muscleGroup: 'Schultern',   secondary: [],                                                                            equipment: ['Kurzhantel', 'Kabelzug'] },
  { name: 'Vorseitheben',        muscleGroup: 'Schultern',   secondary: [{ muscle: 'Brust', weight: 0.15 }],                                          equipment: ['Kurzhantel', 'Langhantel', 'Kabelzug'] },
  { name: 'Reverse Flyes',       muscleGroup: 'Schultern',   secondary: [{ muscle: 'Rücken', weight: 0.25 }],                                         equipment: ['Kurzhantel', 'Kabelzug', 'Maschine (Peck Deck)'] },
  // BIZEPS
  { name: 'Curls',               muscleGroup: 'Bizeps',      secondary: [],                                                                            equipment: ['Kurzhantel', 'Langhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Hammer Curls',        muscleGroup: 'Bizeps',      secondary: [],                                                                            equipment: ['Kurzhantel', 'Kabelzug'] },
  { name: 'Konzentrationscurls', muscleGroup: 'Bizeps',      secondary: [],                                                                            equipment: ['Kurzhantel'] },
  { name: 'Scottcurls',          muscleGroup: 'Bizeps',      secondary: [],                                                                            equipment: ['Langhantel', 'Kurzhantel', 'Maschine'] },
  // TRIZEPS
  { name: 'Trizepsdrücken',      muscleGroup: 'Trizeps',     secondary: [],                                                                            equipment: ['Kabelzug', 'Kurzhantel', 'Langhantel'] },
  { name: 'Skull Crushers',      muscleGroup: 'Trizeps',     secondary: [],                                                                            equipment: ['Langhantel', 'Kurzhantel', 'EZ-Stange'] },
  { name: 'Overhead Extension',  muscleGroup: 'Trizeps',     secondary: [],                                                                            equipment: ['Kurzhantel', 'Kabelzug', 'Langhantel'] },
  // QUADRIZEPS
  { name: 'Kniebeugen',          muscleGroup: 'Quadrizeps',  secondary: [{ muscle: 'Hamstrings', weight: 0.30 }, { muscle: 'Gluteus', weight: 0.45 }, { muscle: 'Core', weight: 0.20 }], equipment: ['Langhantel (High Bar)', 'Langhantel (Low Bar)', 'Smith', 'Goblet (Kurzhantel)'] },
  { name: 'Beinpresse',          muscleGroup: 'Quadrizeps',  secondary: [{ muscle: 'Hamstrings', weight: 0.20 }, { muscle: 'Gluteus', weight: 0.30 }], equipment: ['Maschine 45°', 'Maschine horizontal'] },
  { name: 'Beinstrecker',        muscleGroup: 'Quadrizeps',  secondary: [],                                                                            equipment: ['Maschine'] },
  { name: 'Ausfallschritte',     muscleGroup: 'Quadrizeps',  secondary: [{ muscle: 'Hamstrings', weight: 0.25 }, { muscle: 'Gluteus', weight: 0.35 }], equipment: ['Kurzhantel', 'Langhantel', 'Körpergewicht'] },
  // HAMSTRINGS
  { name: 'Romanian Deadlift',   muscleGroup: 'Hamstrings',  secondary: [{ muscle: 'Gluteus', weight: 0.45 }, { muscle: 'Rücken', weight: 0.20 }],    equipment: ['Langhantel', 'Kurzhantel'] },
  { name: 'Beinbeuger',          muscleGroup: 'Hamstrings',  secondary: [],                                                                            equipment: ['Maschine liegend', 'Maschine sitzend'] },
  // GLUTEUS
  { name: 'Hip Thrust',          muscleGroup: 'Gluteus',     secondary: [{ muscle: 'Hamstrings', weight: 0.25 }, { muscle: 'Core', weight: 0.10 }],   equipment: ['Langhantel', 'Maschine', 'Kurzhantel'] },
  { name: 'Abduktoren',          muscleGroup: 'Gluteus',     secondary: [],                                                                            equipment: ['Maschine', 'Kabelzug', 'Widerstandsband'] },
  // WADEN
  { name: 'Wadenheben',          muscleGroup: 'Waden',       secondary: [],                                                                            equipment: ['Maschine stehend', 'Maschine sitzend', 'Langhantel', 'Körpergewicht'] },
  // CORE
  { name: 'Plank',               muscleGroup: 'Core',        secondary: [],                                                                            equipment: ['Körpergewicht', 'Gewichtsweste'] },
  { name: 'Crunches',            muscleGroup: 'Core',        secondary: [],                                                                            equipment: ['Körpergewicht', 'Kabelzug'] },
  { name: 'Beinheben',           muscleGroup: 'Core',        secondary: [],                                                                            equipment: ['Körpergewicht', 'Gewichtsweste'] },
  { name: 'Russian Twist',       muscleGroup: 'Core',        secondary: [],                                                                            equipment: ['Körpergewicht', 'Medizinball', 'Gewichtsscheibe'] },
];

// Build flat list for backward compat
const DEFAULT_EXERCISES = EXERCISE_DB.map(e => ({ name: e.name, muscleGroup: e.muscleGroup }));

const MUSCLE_GROUPS = ['Brust','Rücken','Schultern','Bizeps','Trizeps','Quadrizeps','Hamstrings','Gluteus','Waden','Core'];

const MUSCLE_COLORS: Record<string, string> = {
  Brust: '#EC4899', Rücken: '#7C3AED', Schultern: '#06B6D4',
  Bizeps: '#10B981', Trizeps: '#F59E0B', Quadrizeps: '#FB7185',
  Hamstrings: '#A78BFA', Gluteus: '#F472B6', Waden: '#67E8F9',
  Core: '#FB923C', Ganzkörper: '#E8572A',
};

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  Brust: 48, Rücken: 48, Schultern: 36, Bizeps: 36,
  Trizeps: 36, Quadrizeps: 72, Hamstrings: 72, Gluteus: 48, Waden: 24, Core: 24,
};

const COMMUNITY_ROUTINES: Routine[] = [
  { id: 'c1', name: 'Push Day', exercises: [
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 4, equipment: 'Langhantel' },
    { name: 'Schrägbankdrücken', muscleGroup: 'Brust', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Schulterdrücken', muscleGroup: 'Schultern', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Seitheben', muscleGroup: 'Schultern', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Trizepsdrücken', muscleGroup: 'Trizeps', defaultSets: 3, equipment: 'Kabelzug' },
    { name: 'Skull Crushers', muscleGroup: 'Trizeps', defaultSets: 3, equipment: 'EZ-Stange' },
  ]},
  { id: 'c2', name: 'Pull Day', exercises: [
    { name: 'Klimmzüge', muscleGroup: 'Rücken', defaultSets: 4, equipment: 'Körpergewicht' },
    { name: 'Rudern', muscleGroup: 'Rücken', defaultSets: 4, equipment: 'Langhantel' },
    { name: 'Latzug', muscleGroup: 'Rücken', defaultSets: 3, equipment: 'Kabelzug breit' },
    { name: 'Face Pulls', muscleGroup: 'Rücken', defaultSets: 3, equipment: 'Kabelzug' },
    { name: 'Curls', muscleGroup: 'Bizeps', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Hammer Curls', muscleGroup: 'Bizeps', defaultSets: 3, equipment: 'Kurzhantel' },
  ]},
  { id: 'c3', name: 'Leg Day', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 4, equipment: 'Langhantel (High Bar)' },
    { name: 'Beinpresse', muscleGroup: 'Quadrizeps', defaultSets: 4, equipment: 'Maschine 45°' },
    { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', defaultSets: 3, equipment: 'Langhantel' },
    { name: 'Beinbeuger', muscleGroup: 'Hamstrings', defaultSets: 3, equipment: 'Maschine liegend' },
    { name: 'Hip Thrust', muscleGroup: 'Gluteus', defaultSets: 3, equipment: 'Langhantel' },
    { name: 'Wadenheben', muscleGroup: 'Waden', defaultSets: 4, equipment: 'Maschine stehend' },
  ]},
  { id: 'c4', name: 'Upper Body', exercises: [
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 3, equipment: 'Langhantel' },
    { name: 'Rudern', muscleGroup: 'Rücken', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Schulterdrücken', muscleGroup: 'Schultern', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Klimmzüge', muscleGroup: 'Rücken', defaultSets: 3, equipment: 'Körpergewicht' },
    { name: 'Curls', muscleGroup: 'Bizeps', defaultSets: 2, equipment: 'Kurzhantel' },
    { name: 'Trizepsdrücken', muscleGroup: 'Trizeps', defaultSets: 2, equipment: 'Kabelzug' },
  ]},
  { id: 'c5', name: 'Powerlifting', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 5, equipment: 'Langhantel (Low Bar)' },
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 5, equipment: 'Langhantel' },
    { name: 'Deadlift', muscleGroup: 'Rücken', defaultSets: 5, equipment: 'Langhantel' },
  ]},
];

// ─── Muscle fatigue calculator ────────────────────────────────
function calculateMuscleRecovery(
  workouts: Workout[],
  muscleMap: MuscleMap
): MuscleMap {
  // Build last-trained map with weighted secondary contributions
  const lastHitMap: Record<string, { date: string; fatigue: number }[]> = {};

  workouts.forEach(w => {
    w.exercises?.forEach(ex => {
      const exData = EXERCISE_DB.find(e => e.name === ex.name);
      if (!exData) return;

      // Primary muscle – full hit
      if (!lastHitMap[exData.muscleGroup]) lastHitMap[exData.muscleGroup] = [];
      lastHitMap[exData.muscleGroup].push({ date: w.date, fatigue: 1.0 });

      // Secondary muscles – partial hit
      exData.secondary.forEach(sec => {
        if (!lastHitMap[sec.muscle]) lastHitMap[sec.muscle] = [];
        lastHitMap[sec.muscle].push({ date: w.date, fatigue: sec.weight });
      });
    });
  });

  const result: MuscleMap = {};
  MUSCLE_GROUPS.forEach(m => {
    const hits = lastHitMap[m] ?? [];
    if (hits.length === 0) {
      result[m] = { level: 100, lastTrained: null };
      return;
    }

    // Most recent hit
    const sorted = [...hits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    const hoursElapsed = (Date.now() - new Date(latest.date).getTime()) / 3600000;
    const recoveryHours = MUSCLE_RECOVERY_HOURS[m] ?? 48;

    // Recovery is scaled by fatigue level – secondary hits recover faster
    const effectiveRecoveryHours = recoveryHours * latest.fatigue;
    const rawLevel = Math.min(100, Math.round((hoursElapsed / effectiveRecoveryHours) * 100));

    result[m] = { level: rawLevel, lastTrained: latest.date };
  });

  return result;
}

function getMuscleColor(level: number): string {
  if (level >= 80) return theme.green;
  if (level >= 60) return theme.blue;
  if (level >= 40) return theme.yellow;
  if (level >= 20) return theme.orange;
  return theme.red;
}

// ─── Helpers ──────────────────────────────────────────────────
function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
function getBest1RM(sets: WorkoutSet[]): number {
  return Math.max(0, ...sets.map(s => calc1RM(parseFloat(s.weight || '0'), parseFloat(s.reps || '0'))));
}
function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function formatPace(paceSeconds: number) {
  if (!paceSeconds || !isFinite(paceSeconds) || paceSeconds <= 0) return '--:--';
  const m = Math.floor(paceSeconds / 60), s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
function isToday(dateString: string) {
  const d = new Date(dateString), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function daysSince(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}
function formatDateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(iso)) return `Heute, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function getWeekTrainings(workouts: Workout[]): boolean[] {
  const result = [false,false,false,false,false,false,false];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0,0,0,0);
  for (const w of workouts) {
    const d = new Date(w.date); d.setHours(0,0,0,0);
    const diff = Math.round((d.getTime() - monday.getTime()) / (1000*60*60*24));
    if (diff >= 0 && diff <= 6) result[diff] = true;
  }
  return result;
}

function calcWorkoutScore(workout: Workout, userMaxes: UserMaxes): number {
  if (!workout.exercises || workout.exercises.length === 0) return 0;
  let intensityScore = 0, volumeScore = 0, exerciseCount = 0;
  for (const ex of workout.exercises) {
    const max = userMaxes[ex.name] || 0;
    const best = getBest1RM(ex.sets);
    if (max > 0 && best > 0) { intensityScore += Math.min(1, best / max); exerciseCount++; }
    for (const set of ex.sets) {
      const r = parseFloat(set.reps || '0'), w = parseFloat(set.weight || '0');
      if (r > 0 && w > 0) volumeScore += r * w;
    }
  }
  const avgIntensity = exerciseCount > 0 ? intensityScore / exerciseCount : 0.5;
  const volScore = Math.min(1, volumeScore / 10000);
  const durScore = Math.min(1, (workout.duration || 30) / 90);
  const setsScore = Math.min(1, workout.exercises.reduce((s, ex) => s + ex.sets.length, 0) / 20);
  return Math.round((avgIntensity * 0.4 + volScore * 0.3 + durScore * 0.15 + setsScore * 0.15) * 100);
}

function getNutritionAdvice(score: number, duration: number, bodyWeight: number) {
  const w = bodyWeight || 75;
  const intensity = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  if (intensity === 'high') return {
    immediate: { protein: Math.round(w * 0.4), carbs: Math.round(w * 0.8), timing: 'Sofort (0–30 Min.)' },
    later: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timing: '2–3 Stunden später' },
  };
  if (intensity === 'medium') return {
    immediate: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timing: 'Sofort (0–45 Min.)' },
    later: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timing: '3–4 Stunden später' },
  };
  return {
    immediate: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timing: 'Innerhalb 1 Stunde' },
    later: { protein: Math.round(w * 0.2), carbs: Math.round(w * 0.2), timing: '4–5 Stunden später' },
  };
}

const PLAN_STORE_KEY = 'trainingPlanConfig';
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const FULL_DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getISOWeek(date: Date): string {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return `${d.getFullYear()}-W${String(1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)).padStart(2,'0')}`;
}

type PlanConfig = { exercises: string[]; trainingDays: number[]; goal: string; generatedWeek: string };
type PlanDay = { dayIdx: number; dayLabel: string; name: string; focus: string; exercises: { name: string; sets: number; reps: number; weight: number }[] };

function buildPlan(config: PlanConfig, userMaxes: UserMaxes): PlanDay[] {
  const { exercises, trainingDays, goal } = config;
  const intensity = goal === 'kraft' ? 0.85 : goal === 'ausdauer' ? 0.6 : 0.72;
  const reps = goal === 'kraft' ? 4 : goal === 'ausdauer' ? 15 : 10;
  const setsCount = goal === 'kraft' ? 5 : goal === 'ausdauer' ? 3 : 4;
  function w(name: string) { const max = userMaxes[name] || 0; if (!max) return 0; return Math.round((max * intensity) / 2.5) * 2.5; }
  function getMG(name: string) { return EXERCISE_DB.find(d => d.name === name)?.muscleGroup ?? ''; }
  const PUSH = ['Brust','Schultern','Trizeps'], PULL = ['Rücken','Bizeps'], LEGS = ['Quadrizeps','Hamstrings','Gluteus','Waden'], CORE = ['Core'];
  const pushEx = exercises.filter(e => PUSH.includes(getMG(e)));
  const pullEx = exercises.filter(e => PULL.includes(getMG(e)));
  const legEx  = exercises.filter(e => LEGS.includes(getMG(e)));
  const coreEx = exercises.filter(e => CORE.includes(getMG(e)));
  const otherEx = exercises.filter(e => ![...PUSH,...PULL,...LEGS,...CORE].includes(getMG(e)));
  const numDays = trainingDays.length;
  let splits: { name: string; focus: string; exs: string[] }[] = [];
  if (numDays <= 2) {
    splits = [
      { name: 'Oberkörper', focus: 'Brust · Rücken · Schultern · Arme', exs: [...pushEx,...pullEx,...coreEx] },
      { name: 'Unterkörper', focus: 'Beine · Gluteus · Waden', exs: [...legEx,...otherEx] },
    ];
  } else if (numDays === 3) {
    splits = [
      { name: 'Push', focus: 'Brust · Schultern · Trizeps', exs: pushEx },
      { name: 'Pull', focus: 'Rücken · Bizeps', exs: pullEx },
      { name: 'Beine', focus: 'Quadrizeps · Hamstrings · Gluteus', exs: [...legEx,...coreEx,...otherEx] },
    ];
  } else {
    splits = [
      { name: 'Upper A', focus: 'Brust · Rücken', exs: [...pushEx.slice(0,Math.ceil(pushEx.length/2)),...pullEx.slice(0,Math.ceil(pullEx.length/2))] },
      { name: 'Lower A', focus: 'Quadrizeps · Hamstrings', exs: [...legEx.slice(0,Math.ceil(legEx.length/2)),...otherEx] },
      { name: 'Upper B', focus: 'Schultern · Arme · Core', exs: [...pushEx.slice(Math.ceil(pushEx.length/2)),...pullEx.slice(Math.ceil(pullEx.length/2)),...coreEx] },
      { name: 'Lower B', focus: 'Gluteus · Waden', exs: legEx.slice(Math.ceil(legEx.length/2)) },
    ].slice(0, numDays);
  }
  splits = splits.map(sp => ({ ...sp, exs: sp.exs.length > 0 ? sp.exs : exercises.slice(0,4) }));
  return Array.from({ length: 7 }, (_, i) => {
    const trainingIdx = trainingDays.indexOf(i);
    if (trainingIdx === -1) return { dayIdx: i, dayLabel: DAY_NAMES[i], name: 'Pause', focus: 'Regeneration', exercises: [] };
    const split = splits[trainingIdx % splits.length];
    return { dayIdx: i, dayLabel: DAY_NAMES[i], name: split.name, focus: split.focus, exercises: split.exs.map(ex => ({ name: ex, sets: setsCount, reps, weight: w(ex) })) };
  });
}

// ─── Icons ────────────────────────────────────────────────────
function IconDumbbell({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 28 28" fill="none"><Rect x="2" y="11" width="4" height="6" rx="1.5" fill={color} /><Rect x="22" y="11" width="4" height="6" rx="1.5" fill={color} /><Rect x="5" y="9" width="3" height="10" rx="1.5" fill={color} /><Rect x="20" y="9" width="3" height="10" rx="1.5" fill={color} /><Rect x="8" y="12.5" width="12" height="3" rx="1.5" fill={color} /></Svg>;
}
function IconRun({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={14} cy={4} r={2} stroke={color} strokeWidth={1.8} /><Path d="M6 20L10 13L13 16L16 10L19 13M5 10L10 13L13 8L16 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconWatch({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={1.8} /><Path d="M12 9V12L14 14M9 3H15L16 6H8L9 3ZM8 18L9 21H15L16 18H8Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconHistory({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 3V21M3 17L9 11L13 15L21 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconChevronRight({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9 18L15 12L9 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconChevronLeft({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconClose({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconTrophy({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4C3.45 9 3 8.55 3 8V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V8C21 8.55 20.55 9 20 9H18M6 9C6 13 9 17 12 17C15 17 18 13 18 9M6 9H18M12 17V21M8 21H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconSync({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M21 2V8H15M3 22V16H9M21 13C20.6 17.4 16.8 21 12 21C7.6 21 4 18 3 14M3 11C3.4 6.6 7.2 3 12 3C16.4 3 20 6 21 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconSearch({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.8} /><Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconPlay({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 4L20 12L6 20V4Z" fill={color} /></Svg>;
}
function IconList({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconPencil({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4C3.45 4 3 4.45 3 5V20C3 20.55 3.45 21 4 21H19C19.55 21 20 20.55 20 19V12M18.5 2.5C19.33 1.67 20.67 1.67 21.5 2.5C22.33 3.33 22.33 4.67 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconArrowUp({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 19V5M5 12L12 5L19 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconArrowDown({ color, size = 16 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5V19M5 12L12 19L19 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconCheck({ color, size = 14 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconChevronsRight({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M7 17L12 12L7 7M13 17L18 12L13 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconTrash({ color, size = 18 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconCalendar({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M8 2V5M16 2V5M3 8H21M5 4H19C20.1 4 21 4.9 21 6V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V6C3 4.9 3.9 4 5 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconBody({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={4} r={2} stroke={color} strokeWidth={1.8} /><Path d="M9 12L7 22M15 12L17 22M6 8C6 8 8 10 12 10C16 10 18 8 18 8L17 14H7L6 8Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

// ─── Mini Body SVG for widget ─────────────────────────────────
const SKIN = '#C8956C';
const SKIN_DARK = '#A8754C';

function MiniBodyFront({ muscles }: { muscles: MuscleMap }) {
  const clr = (n: string) => getMuscleColor(muscles[n]?.level ?? 100);
  const op = (n: string) => 0.3 + (muscles[n]?.level ?? 100) / 100 * 0.7;
  return (
    <Svg width={70} height={150} viewBox="0 0 170 380">
      <Defs>
        <LinearGradient id="msk" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} /><Stop offset="0.5" stopColor={SKIN} /><Stop offset="1" stopColor={SKIN_DARK} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#msk)" />
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#msk)" />
      <Path d="M60 62 Q85 58 110 62 L114 136 Q85 144 56 136 Z" fill="url(#msk)" />
      <Path d="M62 64 Q74 60 84 64 Q88 72 86 84 Q84 90 76 92 Q66 90 62 82 Q58 74 62 64Z" fill={clr('Brust')} opacity={op('Brust')} />
      <Path d="M88 64 Q98 60 108 64 Q112 74 108 82 Q104 90 94 92 Q86 90 84 84 Q82 72 88 64Z" fill={clr('Brust')} opacity={op('Brust')} />
      <Path d="M54 56 Q44 58 38 66 Q36 76 40 86 Q46 90 54 86 L60 70Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M116 56 Q126 58 132 66 Q134 76 130 86 Q124 90 116 86 L110 70Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M40 86 Q32 90 30 104 Q30 116 36 122 Q44 124 50 118 Q56 110 54 96Z" fill={clr('Bizeps')} opacity={op('Bizeps')} />
      <Path d="M130 86 Q138 90 140 104 Q140 116 134 122 Q126 124 120 118 Q114 110 116 96Z" fill={clr('Bizeps')} opacity={op('Bizeps')} />
      {[0,1,2].map(row => <G key={row}><Rect x={70} y={96 + row*13} width={12} height={10} rx={3} fill={clr('Core')} opacity={op('Core')} /><Rect x={87} y={96 + row*13} width={12} height={10} rx={3} fill={clr('Core')} opacity={op('Core')} /></G>)}
      <Path d="M58 152 Q66 148 74 152 Q78 168 76 192 Q74 210 68 218 Q60 214 56 196 Q52 174 58 152Z" fill={clr('Quadrizeps')} opacity={op('Quadrizeps')} />
      <Path d="M112 152 Q104 148 96 152 Q92 168 94 192 Q96 210 102 218 Q110 214 114 196 Q118 174 112 152Z" fill={clr('Quadrizeps')} opacity={op('Quadrizeps')} />
      <Path d="M58 230 Q62 228 67 232 Q70 248 68 266 Q66 278 62 282 Q56 278 54 264 Q52 248 58 230Z" fill={clr('Waden')} opacity={op('Waden')} />
      <Path d="M112 230 Q108 228 103 232 Q100 248 102 266 Q104 278 108 282 Q114 278 116 264 Q118 248 112 230Z" fill={clr('Waden')} opacity={op('Waden')} />
    </Svg>
  );
}

function MiniBodyBack({ muscles }: { muscles: MuscleMap }) {
  const clr = (n: string) => getMuscleColor(muscles[n]?.level ?? 100);
  const op = (n: string) => 0.3 + (muscles[n]?.level ?? 100) / 100 * 0.7;
  return (
    <Svg width={70} height={150} viewBox="0 0 170 380">
      <Defs>
        <LinearGradient id="mskb" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} /><Stop offset="0.5" stopColor={SKIN} /><Stop offset="1" stopColor={SKIN_DARK} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#mskb)" />
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#mskb)" />
      <Path d="M60 68 Q85 64 110 68 L112 138 Q85 146 58 138 Z" fill="url(#mskb)" />
      <Path d="M64 50 Q85 44 106 50 Q114 58 112 70 Q98 66 85 68 Q72 66 58 70 Q56 58 64 50Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M60 68 Q50 74 46 90 Q44 106 48 120 Q54 130 62 128 Q66 118 66 104 Q64 88 62 76Z" fill={clr('Rücken')} opacity={op('Rücken')} />
      <Path d="M110 68 Q120 74 124 90 Q126 106 122 120 Q116 130 108 128 Q104 118 104 104 Q106 88 108 76Z" fill={clr('Rücken')} opacity={op('Rücken')} />
      <Path d="M62 70 Q85 66 108 70 Q106 88 85 92 Q64 88 62 70Z" fill={clr('Rücken')} opacity={op('Rücken') * 0.9} />
      <Path d="M40 88 Q32 92 30 106 Q30 118 36 124 Q44 126 50 120 Q56 112 54 98Z" fill={clr('Trizeps')} opacity={op('Trizeps')} />
      <Path d="M130 88 Q138 92 140 106 Q140 118 134 124 Q126 126 120 120 Q114 112 116 98Z" fill={clr('Trizeps')} opacity={op('Trizeps')} />
      <Path d="M58 138 Q70 134 84 138 Q88 148 84 162 Q80 172 70 174 Q60 170 56 158 Q52 148 58 138Z" fill={clr('Gluteus')} opacity={op('Gluteus')} />
      <Path d="M86 138 Q100 134 112 138 Q118 148 114 158 Q110 170 100 174 Q90 172 86 162 Q82 148 86 138Z" fill={clr('Gluteus')} opacity={op('Gluteus')} />
      <Path d="M56 172 Q62 170 70 174 Q74 190 72 214 Q70 228 64 234 Q56 228 52 210 Q48 190 56 172Z" fill={clr('Hamstrings')} opacity={op('Hamstrings')} />
      <Path d="M114 172 Q108 170 100 174 Q96 190 98 214 Q100 228 106 234 Q114 228 118 210 Q122 190 114 172Z" fill={clr('Hamstrings')} opacity={op('Hamstrings')} />
    </Svg>
  );
}

// ─── Body Recovery Widget (compact) ───────────────────────────
function BodyRecoveryWidget({ muscles, onPress }: { muscles: MuscleMap; onPress: () => void }) {
  const warnings = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40);
  const ready = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.textTertiary, marginBottom: 3 }}>Muskel Recovery</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>Körper</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {warnings.length > 0 && (
            <View style={{ backgroundColor: theme.redLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.red + '40' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.red }}>⚠ {warnings.length} schonen</Text>
            </View>
          )}
          {ready.length > 0 && (
            <View style={{ backgroundColor: theme.greenLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.green + '40' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.green }}>✓ {ready.length} bereit</Text>
            </View>
          )}
          <IconChevronRight color={theme.textTertiary} size={16} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* Mini figures */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <MiniBodyFront muscles={muscles} />
          <MiniBodyBack muscles={muscles} />
        </View>

        {/* Recovery bars for top muscles */}
        <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
          {MUSCLE_GROUPS.slice(0, 6).map(m => {
            const level = muscles[m]?.level ?? 100;
            const color = getMuscleColor(level);
            return (
              <View key={m} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 9, color: theme.textSecondary, fontWeight: '500' }}>{m}</Text>
                  <Text style={{ fontSize: 9, color, fontWeight: '700' }}>{level}%</Text>
                </View>
                <View style={{ height: 3, backgroundColor: theme.cardSecondary, borderRadius: 2 }}>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: color, width: `${level}%` as any }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Full Body Screen (modal) ─────────────────────────────────
function BodyScreenModal({ muscles, onClose }: { muscles: MuscleMap; onClose: () => void }) {
  const [view, setView] = useState<'front' | 'back'>('front');

  const warnings = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40);
  const ready = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80);

  // Full body SVG paths - reuse from body.tsx logic inline
  const BodyFull = view === 'front'
    ? <MiniBodyFrontFull muscles={muscles} />
    : <MiniBodyBackFull muscles={muscles} />;

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ backgroundColor: theme.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.orange, marginBottom: 3 }}>Körper</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: theme.textPrimary }}>Muskel Recovery</Text>
          </View>
          <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
            <IconClose color={theme.textPrimary} size={16} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {/* Toggle */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['front','back'] as const).map(v => (
              <TouchableOpacity key={v} onPress={() => setView(v)} activeOpacity={0.8}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: view === v ? theme.blueLight : theme.card, borderWidth: 1.5, borderColor: view === v ? theme.blue : theme.border }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: view === v ? theme.blue : theme.textSecondary }}>
                  {v === 'front' ? '▶ Vorderseite' : '◀ Rückseite'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
            <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 10, borderWidth: 0.5, borderColor: theme.border }}>
              {BodyFull}
            </View>
            {/* Legend */}
            <View style={{ gap: 12, paddingTop: 16, flex: 1 }}>
              <Text style={{ fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Recovery</Text>
              {[{ color: theme.green, label: '80–100%', note: 'Bereit' }, { color: theme.blue, label: '60–79%', note: 'Fast' }, { color: theme.yellow, label: '40–59%', note: 'Mittel' }, { color: theme.orange, label: '20–39%', note: 'Niedrig' }, { color: theme.red, label: '0–19%', note: 'Schonen' }].map(item => (
                <View key={item.note} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                  <View><Text style={{ fontSize: 12, fontWeight: '500', color: theme.textPrimary }}>{item.note}</Text><Text style={{ fontSize: 10, color: theme.textSecondary }}>{item.label}</Text></View>
                </View>
              ))}
            </View>
          </View>

          {warnings.length > 0 && (
            <View style={{ backgroundColor: theme.redLight, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.red + '30' }}>
              <Text style={{ color: theme.red, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>⚠ Noch nicht erholt</Text>
              <Text style={{ color: theme.red, fontSize: 12, opacity: 0.8 }}>{warnings.join(', ')} – heute schonen.</Text>
            </View>
          )}
          {ready.length > 0 && (
            <View style={{ backgroundColor: theme.greenLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.green + '30' }}>
              <Text style={{ color: theme.green, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>✓ Bereit</Text>
              <Text style={{ color: theme.green, fontSize: 12, opacity: 0.8 }}>{ready.join(', ')}</Text>
            </View>
          )}

          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 }}>Alle Muskelgruppen</Text>
          {MUSCLE_GROUPS.map(m => {
            const muscle = muscles[m];
            if (!muscle) return null;
            const color = getMuscleColor(muscle.level);
            const exData = EXERCISE_DB.filter(e => e.muscleGroup === m || e.secondary.some(s => s.muscle === m));
            const hoursLeft = muscle.lastTrained ? Math.max(0, (MUSCLE_RECOVERY_HOURS[m] ?? 48) - (Date.now() - new Date(muscle.lastTrained).getTime()) / 3600000) : 0;
            const isPrimary = EXERCISE_DB.some(e => e.muscleGroup === m && muscle.lastTrained);
            return (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                <View style={{ width: 110 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textPrimary }}>{m}</Text>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                    {muscle.lastTrained ? hoursLeft > 0 ? `noch ${Math.round(hoursLeft)}h` : 'Erholt ✓' : 'Nie trainiert'}
                    {muscle.lastTrained && !isPrimary ? ' (sekundär)' : ''}
                  </Text>
                </View>
                <View style={{ flex: 1, height: 4, backgroundColor: theme.cardSecondary, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: color, width: `${muscle.level}%` as any }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '500', color, width: 36, textAlign: 'right' }}>{muscle.level}%</Text>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Full-size body for modal
function MiniBodyFrontFull({ muscles }: { muscles: MuscleMap }) {
  const clr = (n: string) => getMuscleColor(muscles[n]?.level ?? 100);
  const op = (n: string) => 0.3 + (muscles[n]?.level ?? 100) / 100 * 0.7;
  return (
    <Svg width={160} height={340} viewBox="0 0 170 380">
      <Defs><LinearGradient id="fs" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={SKIN_DARK} /><Stop offset="0.5" stopColor={SKIN} /><Stop offset="1" stopColor={SKIN_DARK} /></LinearGradient></Defs>
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#fs)" />
      <Path d="M65 16 Q85 4 105 16 Q100 6 85 4 Q70 4 65 16Z" fill="#3D2B1F" />
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#fs)" />
      <Path d="M60 62 Q85 58 110 62 L114 136 Q85 144 56 136 Z" fill="url(#fs)" />
      <Path d="M62 64 Q74 60 84 64 Q88 72 86 84 Q84 90 76 92 Q66 90 62 82 Q58 74 62 64Z" fill={clr('Brust')} opacity={op('Brust')} />
      <Path d="M88 64 Q98 60 108 64 Q112 74 108 82 Q104 90 94 92 Q86 90 84 84 Q82 72 88 64Z" fill={clr('Brust')} opacity={op('Brust')} />
      <Path d="M54 56 Q44 58 38 66 Q36 76 40 86 Q46 90 54 86 Q58 80 60 70 Q62 62 54 56Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M116 56 Q126 58 132 66 Q134 76 130 86 Q124 90 116 86 Q112 80 110 70 Q108 62 116 56Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M40 86 Q32 90 30 104 Q30 116 36 122 Q44 124 50 118 Q56 110 54 96 Q52 88 40 86Z" fill={clr('Bizeps')} opacity={op('Bizeps')} />
      <Path d="M130 86 Q138 90 140 104 Q140 116 134 122 Q126 124 120 118 Q114 110 116 96 Q118 88 130 86Z" fill={clr('Bizeps')} opacity={op('Bizeps')} />
      <Path d="M36 122 Q28 128 26 144 Q28 156 34 158 Q42 158 46 150 Q50 140 50 128 Q46 122 36 122Z" fill={SKIN} />
      <Path d="M134 122 Q142 128 144 144 Q142 156 136 158 Q128 158 124 150 Q120 140 120 128 Q124 122 134 122Z" fill={SKIN} />
      <Path d="M66 94 Q85 98 104 94 L106 136 Q85 140 64 136 Z" fill={clr('Core')} opacity={op('Core') * 0.4} />
      {[0,1,2].map(row => <G key={row}><Rect x={70} y={96+row*13} width={12} height={10} rx={3} fill={clr('Core')} opacity={op('Core')} /><Rect x={87} y={96+row*13} width={12} height={10} rx={3} fill={clr('Core')} opacity={op('Core')} /></G>)}
      <Path d="M62 134 Q85 142 108 134 L112 152 Q85 158 58 152 Z" fill={SKIN_DARK} opacity={0.5} />
      <Path d="M58 152 Q66 148 74 152 Q78 168 76 192 Q74 210 68 218 Q60 214 56 196 Q52 174 58 152Z" fill={clr('Quadrizeps')} opacity={op('Quadrizeps')} />
      <Path d="M112 152 Q104 148 96 152 Q92 168 94 192 Q96 210 102 218 Q110 214 114 196 Q118 174 112 152Z" fill={clr('Quadrizeps')} opacity={op('Quadrizeps')} />
      <Ellipse cx={67} cy={222} rx={11} ry={9} fill={SKIN_DARK} opacity={0.6} />
      <Ellipse cx={103} cy={222} rx={11} ry={9} fill={SKIN_DARK} opacity={0.6} />
      <Path d="M58 230 Q62 228 67 232 Q70 248 68 266 Q66 278 62 282 Q56 278 54 264 Q52 248 58 230Z" fill={clr('Waden')} opacity={op('Waden')} />
      <Path d="M112 230 Q108 228 103 232 Q100 248 102 266 Q104 278 108 282 Q114 278 116 264 Q118 248 112 230Z" fill={clr('Waden')} opacity={op('Waden')} />
    </Svg>
  );
}
function MiniBodyBackFull({ muscles }: { muscles: MuscleMap }) {
  const clr = (n: string) => getMuscleColor(muscles[n]?.level ?? 100);
  const op = (n: string) => 0.3 + (muscles[n]?.level ?? 100) / 100 * 0.7;
  return (
    <Svg width={160} height={340} viewBox="0 0 170 380">
      <Defs><LinearGradient id="bs" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={SKIN_DARK} /><Stop offset="0.5" stopColor={SKIN} /><Stop offset="1" stopColor={SKIN_DARK} /></LinearGradient></Defs>
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#bs)" />
      <Path d="M65 16 Q85 4 105 16 Q100 6 85 4 Q70 4 65 16Z" fill="#3D2B1F" />
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#bs)" />
      <Path d="M60 68 Q85 64 110 68 L112 138 Q85 146 58 138 Z" fill="url(#bs)" />
      <Path d="M64 50 Q85 44 106 50 Q114 58 112 70 Q98 66 85 68 Q72 66 58 70 Q56 58 64 50Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M54 58 Q44 60 38 70 Q36 80 40 88 Q46 92 54 88 Q60 82 60 70 Q62 64 54 58Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M116 58 Q126 60 132 70 Q134 80 130 88 Q124 92 116 88 Q110 82 110 70 Q108 64 116 58Z" fill={clr('Schultern')} opacity={op('Schultern')} />
      <Path d="M60 68 Q50 74 46 90 Q44 106 48 120 Q54 130 62 128 Q66 118 66 104 Q64 88 62 76 Q62 72 60 68Z" fill={clr('Rücken')} opacity={op('Rücken')} />
      <Path d="M110 68 Q120 74 124 90 Q126 106 122 120 Q116 130 108 128 Q104 118 104 104 Q106 88 108 76 Q108 72 110 68Z" fill={clr('Rücken')} opacity={op('Rücken')} />
      <Path d="M62 70 Q85 66 108 70 Q106 88 85 92 Q64 88 62 70Z" fill={clr('Rücken')} opacity={op('Rücken') * 0.9} />
      <Path d="M40 88 Q32 92 30 106 Q30 118 36 124 Q44 126 50 120 Q56 112 54 98 Q52 90 40 88Z" fill={clr('Trizeps')} opacity={op('Trizeps')} />
      <Path d="M130 88 Q138 92 140 106 Q140 118 134 124 Q126 126 120 120 Q114 112 116 98 Q118 90 130 88Z" fill={clr('Trizeps')} opacity={op('Trizeps')} />
      <Path d="M36 124 Q28 130 26 146 Q28 158 34 160 Q42 160 46 152 Q50 142 50 130 Q46 124 36 124Z" fill={SKIN} />
      <Path d="M134 124 Q142 130 144 146 Q142 158 136 160 Q128 160 124 152 Q120 142 120 130 Q124 124 134 124Z" fill={SKIN} />
      <Path d="M58 138 Q70 134 84 138 Q88 148 84 162 Q80 172 70 174 Q60 170 56 158 Q52 148 58 138Z" fill={clr('Gluteus')} opacity={op('Gluteus')} />
      <Path d="M86 138 Q100 134 112 138 Q118 148 114 158 Q110 170 100 174 Q90 172 86 162 Q82 148 86 138Z" fill={clr('Gluteus')} opacity={op('Gluteus')} />
      <Path d="M56 172 Q62 170 70 174 Q74 190 72 214 Q70 228 64 234 Q56 228 52 210 Q48 190 56 172Z" fill={clr('Hamstrings')} opacity={op('Hamstrings')} />
      <Path d="M114 172 Q108 170 100 174 Q96 190 98 214 Q100 228 106 234 Q114 228 118 210 Q122 190 114 172Z" fill={clr('Hamstrings')} opacity={op('Hamstrings')} />
      <Path d="M56 242 Q60 240 67 244 Q72 260 70 278 Q68 290 62 294 Q54 290 52 274 Q50 258 56 242Z" fill={clr('Waden')} opacity={op('Waden')} />
      <Path d="M114 242 Q110 240 103 244 Q98 260 100 278 Q102 290 108 294 Q116 290 118 274 Q120 258 114 242Z" fill={clr('Waden')} opacity={op('Waden')} />
    </Svg>
  );
}

// ─── SwipeToStart ─────────────────────────────────────────────
function SwipeToStart({ onStart }: { onStart: () => void }) {
  const THUMB_SIZE = 56;
  const [trackWidth, setTrackWidth] = useState(SW - 64);
  const MAX_DRAG = trackWidth - THUMB_SIZE - 12;
  const translateX = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { completed.current = false; },
    onPanResponderMove: (_, gs) => { translateX.setValue(Math.max(0, Math.min(gs.dx, MAX_DRAG))); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > MAX_DRAG * 0.7 && !completed.current) {
        completed.current = true;
        Animated.timing(translateX, { toValue: MAX_DRAG, duration: 100, useNativeDriver: true }).start(() => {
          onStart();
          setTimeout(() => { translateX.setValue(0); completed.current = false; }, 500);
        });
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    },
  })).current;
  const opacity = translateX.interpolate({ inputRange: [0, MAX_DRAG * 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View onLayout={e => setTrackWidth(e.nativeEvent.layout.width)} style={sw.track}>
      <Animated.Text style={[sw.label, { opacity }]}>schieben zum starten</Animated.Text>
      <Animated.View style={[sw.thumb, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <IconChevronsRight color="#fff" size={22} />
      </Animated.View>
    </View>
  );
}


// ─── Workout Timer Hooks ──────────────────────────────────────
function useWorkoutTimer(timerKey: string) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const startAtRef = useRef<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(timerKey).then(raw => {
      if (!raw) return;
      try { const { startedAt } = JSON.parse(raw); if (startedAt) { startAtRef.current = startedAt; setSeconds(Math.floor((Date.now()-startedAt)/1000)); setIsRunning(true); } } catch {}
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => { if (next==='active' && startAtRef.current) setSeconds(Math.floor((Date.now()-startAtRef.current)/1000)); });
    return () => { sub.remove(); clearInterval(intervalRef.current); };
  }, [timerKey]);
  useEffect(() => {
    if (isRunning && startAtRef.current) { intervalRef.current = setInterval(() => { if (startAtRef.current) setSeconds(Math.floor((Date.now()-startAtRef.current)/1000)); }, 1000); }
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);
  const startNow = useCallback(async () => { const now=Date.now(); startAtRef.current=now; await AsyncStorage.setItem(timerKey, JSON.stringify({startedAt:now})); setIsRunning(true); }, [timerKey]);
  const stop = useCallback(async () => { clearInterval(intervalRef.current); startAtRef.current=null; setIsRunning(false); setSeconds(0); await AsyncStorage.removeItem(timerKey); }, [timerKey]);
  const getDuration = useCallback(() => { if (!startAtRef.current) return 0; return Math.max(1, Math.round((Date.now()-startAtRef.current)/60000)); }, []);
  return { seconds, isRunning, startNow, stop, getDuration };
}

function useRestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState(90);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const STORE_KEY = 'restTimerData';
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then(raw => {
      if (!raw) return;
      try { const { startedAt, target } = JSON.parse(raw); if (startedAt&&target) { const rem=Math.max(0,target-Math.floor((Date.now()-startedAt)/1000)); if(rem>0){startAtRef.current=startedAt;setTargetSeconds(target);setSeconds(rem);setIsRunning(true);}else AsyncStorage.removeItem(STORE_KEY); } } catch {}
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => { if (next==='active'&&startAtRef.current&&isRunning){const rem=Math.max(0,targetSeconds-Math.floor((Date.now()-startAtRef.current)/1000));setSeconds(rem);if(rem===0){setIsRunning(false);AsyncStorage.removeItem(STORE_KEY);}} });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (isRunning&&startAtRef.current) { intervalRef.current=setInterval(()=>{if(!startAtRef.current)return;const rem=Math.max(0,targetSeconds-Math.floor((Date.now()-startAtRef.current)/1000));setSeconds(rem);if(rem===0){setIsRunning(false);startAtRef.current=null;AsyncStorage.removeItem(STORE_KEY);clearInterval(intervalRef.current);}},1000); }
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, targetSeconds]);
  function startFor(secs: number) { const now=Date.now(); startAtRef.current=now; setTargetSeconds(secs); setSeconds(secs); setIsRunning(true); AsyncStorage.setItem(STORE_KEY,JSON.stringify({startedAt:now,target:secs})); }
  function stopRest() { setIsRunning(false); setSeconds(0); startAtRef.current=null; AsyncStorage.removeItem(STORE_KEY); }
  return { seconds, isRunning, startFor, stop: stopRest, pct: targetSeconds>0?Math.max(0,seconds/targetSeconds):0 };
}

// ─── Exercise Picker (with equipment) ────────────────────────
function ExercisePicker({ onSelect, onClose }: {
  onSelect: (name: string, muscleGroup: string, equipment: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedEx, setSelectedEx] = useState<ExerciseData | null>(null);
  const filtered = EXERCISE_DB.filter(e => search === '' || e.name.toLowerCase().includes(search.toLowerCase()));

  if (selectedEx) {
    return (
      <Modal visible transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{selectedEx.name}</Text>
            <Text style={[s.inputLabel, { marginBottom: 12 }]}>Gerät / Variante wählen</Text>
            {selectedEx.equipment.map(eq => (
              <TouchableOpacity key={eq} style={{ backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.border }}
                onPress={() => { onSelect(selectedEx.name, selectedEx.muscleGroup, eq); }}>
                <Text style={{ fontSize: 15, color: theme.textPrimary, fontWeight: '500' }}>{eq}</Text>
                <IconChevronRight color={theme.textTertiary} size={16} />
              </TouchableOpacity>
            ))}
            {/* Secondary muscle info */}
            {selectedEx.secondary.length > 0 && (
              <View style={{ backgroundColor: theme.blueLight, borderRadius: 10, padding: 10, marginTop: 4, borderWidth: 1, borderColor: theme.blue + '30' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.blue, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Auch beansprucht</Text>
                {selectedEx.secondary.map(s => (
                  <Text key={s.muscle} style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 2 }}>
                    {s.muscle} – {Math.round(s.weight * 100)}% Belastung
                  </Text>
                ))}
              </View>
            )}
            <TouchableOpacity style={[s.cancelBtn, { marginTop: 8 }]} onPress={() => setSelectedEx(null)}><Text style={s.cancelBtnText}>← Zurück</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelBtnText}>Abbrechen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalOverlay}>
        <ScrollView>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Übung wählen</Text>
            <TextInput style={[s.input, { marginBottom: 16 }]} placeholder="Suchen..." placeholderTextColor={theme.textTertiary} value={search} onChangeText={setSearch} />
            {MUSCLE_GROUPS.map(mg => {
              const exs = filtered.filter(e => e.muscleGroup === mg);
              if (exs.length === 0) return null;
              return (
                <View key={mg} style={{ marginBottom: 14 }}>
                  <Text style={[s.inputLabel, { color: MUSCLE_COLORS[mg], marginBottom: 8 }]}>{mg}</Text>
                  <View style={{ gap: 6 }}>
                    {exs.map(ex => (
                      <TouchableOpacity key={ex.name} style={{ backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                        onPress={() => ex.equipment.length === 1 ? onSelect(ex.name, ex.muscleGroup, ex.equipment[0]) : setSelectedEx(ex)}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{ex.name}</Text>
                          {ex.secondary.length > 0 && (
                            <Text style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}>
                              + {ex.secondary.map(s => s.muscle).join(', ')}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginRight: 8 }}>{ex.equipment.length > 1 ? `${ex.equipment.length} Varianten` : ex.equipment[0]}</Text>
                        <IconChevronRight color={theme.textTertiary} size={14} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelBtnText}>Abbrechen</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── PREntryScreen ────────────────────────────────────────────
function PREntryScreen({ onClose, onSave }: { onClose: () => void; onSave: (name: string, weight: number, reps: number) => void }) {
  const [step, setStep] = useState<'exercise'|'entry'>('exercise');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedReps, setSelectedReps] = useState(1);
  const [weight, setWeight] = useState('');
  const [search, setSearch] = useState('');
  const filtered = EXERCISE_DB.filter(e => search === '' || e.name.toLowerCase().includes(search.toLowerCase()));
  function handleSave() {
    const w = parseFloat(weight);
    if (!w || w <= 0) { Alert.alert('Bitte Gewicht eingeben'); return; }
    onSave(selectedExercise, w, selectedReps); onClose();
  }
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={prEntry.header}>
          <TouchableOpacity onPress={onClose} style={prEntry.closeBtn}><IconClose color={theme.textPrimary} size={16} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={prEntry.eyebrow}>Personal Record</Text>
            <Text style={prEntry.title}>{step === 'exercise' ? 'Übung wählen' : selectedExercise}</Text>
          </View>
        </View>
        {step === 'exercise' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ padding: 16 }}>
              <View style={prEntry.searchBox}>
                <IconSearch color={theme.textTertiary} size={18} />
                <TextInput style={prEntry.searchInput} placeholder="Übung suchen..." placeholderTextColor={theme.textTertiary} value={search} onChangeText={setSearch} />
              </View>
              {MUSCLE_GROUPS.map(mg => {
                const exs = filtered.filter(e => e.muscleGroup === mg);
                if (exs.length === 0) return null;
                return (
                  <View key={mg} style={{ marginBottom: 16 }}>
                    <Text style={[prEntry.muscleLabel, { color: MUSCLE_COLORS[mg] }]}>{mg}</Text>
                    {exs.map(ex => (
                      <TouchableOpacity key={ex.name} style={prEntry.exRow} onPress={() => { setSelectedExercise(ex.name); setStep('entry'); }} activeOpacity={0.8}>
                        <View style={[prEntry.exDot, { backgroundColor: MUSCLE_COLORS[mg] }]} />
                        <Text style={prEntry.exName}>{ex.name}</Text>
                        <IconChevronRight color={theme.textTertiary} size={16} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              <View style={{ height: 60 }} />
            </View>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ padding: 16 }}>
              <Text style={prEntry.sectionLabel}>Wiederholungen</Text>
              <View style={prEntry.repsRow}>
                {[1,2,3].map(r => (
                  <TouchableOpacity key={r} style={[prEntry.repsBtn, selectedReps===r && prEntry.repsBtnActive]} onPress={() => setSelectedReps(r)} activeOpacity={0.8}>
                    <Text style={[prEntry.repsBtnNum, selectedReps===r && { color:'#fff' }]}>{r}</Text>
                    <Text style={[prEntry.repsBtnLabel, selectedReps===r && { color:'rgba(255,255,255,0.6)' }]}>{r===1?'Rep':'Reps'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[prEntry.sectionLabel, { marginTop: 24 }]}>Gewicht</Text>
              <View style={prEntry.weightRow}>
                <TextInput style={prEntry.weightInput} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} autoFocus />
                <Text style={prEntry.weightUnit}>kg</Text>
              </View>
              {weight!==''&&parseFloat(weight)>0&&(
                <View style={prEntry.previewCard}>
                  <Text style={prEntry.previewLabel}>Est. 1RM</Text>
                  <Text style={prEntry.previewVal}>{calc1RM(parseFloat(weight),selectedReps)} kg</Text>
                </View>
              )}
              <TouchableOpacity style={prEntry.saveBtn} onPress={handleSave} activeOpacity={0.85}><Text style={prEntry.saveBtnText}>PR speichern</Text></TouchableOpacity>
              <TouchableOpacity style={{ padding:14,alignItems:'center' }} onPress={() => setStep('exercise')}><Text style={{ fontSize:14,color:theme.textSecondary }}>Andere Übung</Text></TouchableOpacity>
              <View style={{ height: 60 }} />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── PRScreen ─────────────────────────────────────────────────
function PRScreen({ prHistory, onClose, onAddPR }: { prHistory: PRHistory; onClose: () => void; onAddPR: () => void }) {
  const entries = Object.entries(prHistory).sort((a,b) => (b[1][b[1].length-1]?.estimated1RM??0)-(a[1][a[1].length-1]?.estimated1RM??0));
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={hist.header}>
          <View><Text style={hist.eyebrow}>Bestleistungen</Text><Text style={hist.title}>Personal Records</Text></View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose}><IconClose color={theme.textPrimary} size={16} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={prSt.addBtn} onPress={onAddPR} activeOpacity={0.85}>
          <IconPlus color="#fff" size={18} /><Text style={prSt.addBtnText}>PR eintragen</Text>
        </TouchableOpacity>
        {entries.length===0 ? (
          <View style={{ flex:1,alignItems:'center',justifyContent:'center',gap:14 }}>
            <IconTrophy color={theme.textTertiary} size={40} />
            <Text style={{ fontSize:20,fontWeight:'700',color:theme.textPrimary }}>Noch keine PRs</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16 }}>
            {entries.map(([name,history],i) => {
              const latest=history[history.length-1];
              const prev=history.length>1?history[history.length-2]:null;
              const delta=prev?latest.estimated1RM-prev.estimated1RM:null;
              const rankColors=['#FFD700','#C0C0C0','#CD7F32'];
              const rankColor=i<3?rankColors[i]:theme.border;
              return (
                <View key={name} style={prSt.card}>
                  <View style={{ flexDirection:'row',alignItems:'center',gap:12,marginBottom:14 }}>
                    <View style={[prSt.rankBadge,{backgroundColor:rankColor+'25',borderColor:rankColor}]}>
                      <Text style={[prSt.rankText,{color:i<3?rankColor:theme.textSecondary}]}>#{i+1}</Text>
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={prSt.exerciseName}>{name}</Text>
                      <Text style={prSt.exerciseDate}>{new Date(latest.date).toLocaleDateString('de',{day:'2-digit',month:'2-digit',year:'numeric'})}</Text>
                    </View>
                    <View style={{ alignItems:'flex-end' }}>
                      <Text style={prSt.oneRMVal}>{latest.estimated1RM} kg</Text>
                      <Text style={prSt.oneRMLabel}>Est. 1RM</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection:'row',gap:8,marginBottom:12 }}>
                    <View style={prSt.prStat}><Text style={prSt.prStatVal}>{latest.weight} kg</Text><Text style={prSt.prStatLbl}>Gewicht</Text></View>
                    <View style={prSt.prStat}><Text style={prSt.prStatVal}>{latest.reps} Wdh.</Text><Text style={prSt.prStatLbl}>Wiederholungen</Text></View>
                    {delta!==null&&(<View style={[prSt.deltaChip,{backgroundColor:delta>0?'rgba(52,199,89,0.12)':'rgba(255,69,58,0.12)'}]}>{delta>0?<IconArrowUp color={theme.green} size={12}/>:<IconArrowDown color={theme.red} size={12}/>}<Text style={[prSt.deltaText,{color:delta>0?theme.green:theme.red}]}>{delta>=0?'+':''}{delta} kg</Text></View>)}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── WorkoutDetailScreen ──────────────────────────────────────
function WorkoutDetailScreen({ item, onClose }: { item: any; onClose: () => void }) {
  const isRun = item._kind === 'run';
  const r = isRun ? item.data as RunData : null;
  const w = !isRun ? item.data as Workout : null;
  return (
    <Modal visible animationType="slide">
      <View style={{ flex:1,backgroundColor:theme.bg }}>
        <View style={{ backgroundColor:theme.card,paddingTop:56,paddingHorizontal:16,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:theme.border }}>
          <View style={{ flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14 }}>
            <TouchableOpacity style={{ width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center',marginTop:4 }} onPress={onClose}>
              <IconChevronLeft color={theme.textPrimary} size={20} />
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 }}>{isRun?'Lauf':'Kraft'} · {formatDateLabel(item.data.date)}</Text>
              <Text style={{ fontSize:22,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5 }}>{isRun?'Lauftraining':w?.name}</Text>
            </View>
            {!isRun&&w?.score!==undefined&&(<View style={{ backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:12,fontWeight:'700',color:theme.orange }}>Score {w.score}</Text></View>)}
          </View>
          <View style={{ flexDirection:'row',gap:6 }}>
            {isRun&&r?(<><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.green }}>{r.distance.toFixed(2)}</Text><Text style={detailStatLbl}>km</Text></View><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.blue }}>{formatTime(r.duration)}</Text><Text style={detailStatLbl}>Zeit</Text></View><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.orange }}>{r.pace}</Text><Text style={detailStatLbl}>/km</Text></View></>)
            :w?(<><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.orange }}>{w.exercises?.length??0}</Text><Text style={detailStatLbl}>Übungen</Text></View><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.blue }}>{w.exercises?.reduce((s,ex)=>s+ex.sets.length,0)??0}</Text><Text style={detailStatLbl}>Sets</Text></View><View style={detailStat}><Text style={{ fontSize:16,fontWeight:'700',color:theme.pink }}>{Math.round(w.exercises?.reduce((t,ex)=>t+ex.sets.reduce((s,set)=>s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0),0)??0).toLocaleString()}</Text><Text style={detailStatLbl}>kg Vol.</Text></View></>):null}
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:14 }}>
          {!isRun&&w?.exercises?.map((exercise,i)=>{
            const mc=MUSCLE_COLORS[exercise.muscleGroup]||'#888';
            const best1RM=getBest1RM(exercise.sets);
            const exData=EXERCISE_DB.find(e=>e.name===exercise.name);
            return (
              <View key={i} style={{ backgroundColor:theme.card,borderRadius:16,padding:14,marginBottom:8,borderWidth:0.5,borderColor:theme.border }}>
                <View style={{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:8 }}>
                  <View style={{ backgroundColor:mc+'22',borderRadius:20,paddingHorizontal:10,paddingVertical:3 }}><Text style={{ fontSize:10,fontWeight:'600',color:mc }}>{exercise.muscleGroup}</Text></View>
                  <Text style={{ flex:1,fontSize:14,fontWeight:'700',color:theme.textPrimary }}>{exercise.name}</Text>
                  {exercise.equipment&&<View style={{ backgroundColor:theme.cardSecondary,borderRadius:8,paddingHorizontal:8,paddingVertical:3 }}><Text style={{ fontSize:10,color:theme.textTertiary }}>{exercise.equipment}</Text></View>}
                  {best1RM>0&&<Text style={{ fontSize:11,color:theme.textSecondary }}>1RM: <Text style={{ color:theme.blue,fontWeight:'600' }}>{best1RM} kg</Text></Text>}
                </View>
                {exData&&exData.secondary.length>0&&(
                  <Text style={{ fontSize:10,color:theme.textTertiary,marginBottom:8 }}>
                    + {exData.secondary.map(s=>`${s.muscle} (${Math.round(s.weight*100)}%)`).join(' · ')}
                  </Text>
                )}
                {exercise.sets.map((set,si)=>{
                  const oneRM=calc1RM(parseFloat(set.weight||'0'),parseFloat(set.reps||'0'));
                  const isBest=oneRM===best1RM&&best1RM>0;
                  return (
                    <View key={si} style={{ flexDirection:'row',gap:4,marginBottom:4 }}>
                      <Text style={{ fontSize:12,color:theme.textTertiary,width:20,textAlign:'center' }}>{si+1}</Text>
                      <Text style={{ fontSize:12,fontWeight:'600',color:theme.textPrimary,flex:1,textAlign:'center' }}>{set.reps||'—'}</Text>
                      <Text style={{ fontSize:12,fontWeight:'600',color:theme.textPrimary,flex:1,textAlign:'center' }}>{set.weight||'—'}</Text>
                      <Text style={{ fontSize:12,fontWeight:'600',flex:1,textAlign:'center',color:isBest?theme.green:theme.blue }}>{oneRM>0?oneRM:'—'}{isBest?' ↑':''}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height:60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
const detailStat: any = { flex:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:10,padding:10,alignItems:'center' };
const detailStatLbl: any = { fontSize:8,color:'rgba(245,240,238,0.3)',textTransform:'uppercase',letterSpacing:0.4,marginTop:2 };

// ─── HistoryScreen ────────────────────────────────────────────
function HistoryScreen({ onClose, prHistory, onDelete }: { onClose: () => void; prHistory: PRHistory; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<'alle'|'kraft'|'judo'|'lauf'>('alle');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  useEffect(() => {
    AsyncStorage.getItem('workouts').then(r=>r&&setWorkouts(JSON.parse(r)));
    AsyncStorage.getItem('runs').then(r=>r&&setRuns(JSON.parse(r)));
  }, []);
  const FILTERS = [{ key:'alle',label:'Alle' },{ key:'kraft',label:'Kraft' },{ key:'judo',label:'Judo' },{ key:'lauf',label:'Lauf' }] as const;
  type HItem = { _kind:'workout';data:Workout }|{ _kind:'run';data:RunData };
  const allItems: HItem[] = [...workouts.map(w=>({_kind:'workout' as const,data:w})),...runs.map(r=>({_kind:'run' as const,data:r}))].sort((a,b)=>new Date(b.data.date).getTime()-new Date(a.data.date).getTime());
  const filtered = allItems.filter(item=>{
    if(filter==='alle')return true;
    if(item._kind==='run')return filter==='lauf';
    if(filter==='kraft')return item.data.type==='gym';
    if(filter==='judo')return item.data.type==='judo';
    return true;
  });
  async function handleDelete(item: HItem) {
    Alert.alert('Training löschen','Wirklich löschen?',[{text:'Abbrechen',style:'cancel'},{text:'Löschen',style:'destructive',onPress:async()=>{
      if(item._kind==='workout'){const u=workouts.filter(w=>w.id!==item.data.id);setWorkouts(u);await AsyncStorage.setItem('workouts',JSON.stringify(u));onDelete(item.data.id);}
      else{const u=runs.filter(r=>r.id!==item.data.id);setRuns(u);await AsyncStorage.setItem('runs',JSON.stringify(u));}
    }}]);
  }
  const typeConfig: Record<string,{color:string;label:string}> = { gym:{color:theme.orange,label:'Kraft'},judo:{color:theme.blue,label:'Judo'},manual:{color:theme.textSecondary,label:'Sonstiges'},run:{color:theme.green,label:'Lauf'} };
  if (selectedItem) return <WorkoutDetailScreen item={selectedItem} onClose={()=>setSelectedItem(null)} />;
  return (
    <Modal visible animationType="slide">
      <View style={{ flex:1,backgroundColor:theme.bg }}>
        <View style={{ backgroundColor:theme.card,paddingTop:60,paddingHorizontal:20,paddingBottom:16,borderBottomWidth:0.5,borderBottomColor:theme.border }}>
          <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
            <View><Text style={{ fontSize:10,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase',color:theme.orange,marginBottom:4 }}>Training</Text><Text style={{ fontSize:26,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.6 }}>Verlauf</Text></View>
            <TouchableOpacity style={{ width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' }} onPress={onClose}><IconClose color={theme.textPrimary} size={16} /></TouchableOpacity>
          </View>
          <View style={{ flexDirection:'row',gap:6 }}>
            <View style={{ backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:12,fontWeight:'700',color:theme.orange }}>{workouts.filter(w=>w.type==='gym').length} Kraft</Text></View>
            <View style={{ backgroundColor:theme.greenLight,borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderColor:theme.green+'40' }}><Text style={{ fontSize:12,fontWeight:'700',color:theme.green }}>{runs.length} Läufe</Text></View>
            <View style={{ backgroundColor:theme.cardSecondary,borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderColor:theme.border }}><Text style={{ fontSize:12,fontWeight:'700',color:theme.textSecondary }}>{allItems.length} Total</Text></View>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border,maxHeight:50 }} contentContainerStyle={{ paddingHorizontal:16,paddingVertical:10,gap:6,flexDirection:'row' }}>
          {FILTERS.map(f=>(<TouchableOpacity key={f.key} style={{ borderRadius:20,paddingHorizontal:14,paddingVertical:6,backgroundColor:filter===f.key?theme.orange:theme.cardSecondary }} onPress={()=>setFilter(f.key)}><Text style={{ fontSize:12,fontWeight:'600',color:filter===f.key?'#fff':theme.textSecondary }}>{f.label}</Text></TouchableOpacity>))}
        </ScrollView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:14 }}>
          {filtered.length===0&&(<View style={{ alignItems:'center',paddingVertical:60,gap:12 }}><View style={{ width:72,height:72,borderRadius:36,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' }}><IconHistory color={theme.textTertiary} size={32} /></View><Text style={{ fontSize:17,fontWeight:'700',color:theme.textPrimary }}>Keine Trainings gefunden</Text></View>)}
          {filtered.map((item,i)=>{
            const isRun=item._kind==='run';
            const r=isRun?item.data as RunData:null;
            const w=!isRun?item.data as Workout:null;
            const tc=isRun?typeConfig.run:typeConfig[w?.type??'manual'];
            const totalVolume=w?.exercises?.reduce((t,ex)=>t+ex.sets.reduce((s,set)=>s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0),0)??0;
            const totalSets=w?.exercises?.reduce((s,ex)=>s+ex.sets.length,0)??0;
            return (
              <TouchableOpacity key={i} activeOpacity={0.88} onPress={()=>setSelectedItem(item)} style={{ backgroundColor:theme.card,borderRadius:18,padding:14,marginBottom:8,borderWidth:0.5,borderColor:theme.border }}>
                <View style={{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:10 }}>
                  <View style={{ width:8,height:8,borderRadius:4,backgroundColor:tc.color }} />
                  <Text style={{ fontSize:10,fontWeight:'700',color:tc.color,textTransform:'uppercase',letterSpacing:0.4 }}>{tc.label}</Text>
                  <Text style={{ fontSize:11,color:theme.textSecondary }}>{formatDateLabel(item.data.date)}</Text>
                  {!isRun&&w?.score!==undefined&&w.score>0&&(<View style={{ marginLeft:'auto' as any,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:10,fontWeight:'700',color:theme.orange }}>⚡ {w.score}</Text></View>)}
                  <TouchableOpacity style={{ marginLeft:'auto' as any,width:28,height:28,borderRadius:14,backgroundColor:'rgba(255,69,58,0.1)',alignItems:'center',justifyContent:'center' }} onPress={e=>{e.stopPropagation?.();handleDelete(item);}}><IconTrash color={theme.red} size={14} /></TouchableOpacity>
                </View>
                <Text style={{ fontSize:16,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.3,marginBottom:10 }}>{isRun?'Lauftraining':w?.name}</Text>
                <View style={{ flexDirection:'row',gap:5 }}>
                  {isRun&&r?(<><View style={histStat}><Text style={[histStatVal,{color:theme.green}]}>{r.distance.toFixed(1)}</Text><Text style={histStatLbl}>km</Text></View><View style={histStat}><Text style={[histStatVal,{color:theme.blue}]}>{formatTime(r.duration)}</Text><Text style={histStatLbl}>Zeit</Text></View><View style={histStat}><Text style={[histStatVal,{color:theme.orange}]}>{r.pace}</Text><Text style={histStatLbl}>/km</Text></View></>)
                  :(<><View style={histStat}><Text style={[histStatVal,{color:theme.orange}]}>{w?.duration}</Text><Text style={histStatLbl}>min</Text></View><View style={histStat}><Text style={[histStatVal,{color:theme.blue}]}>{Math.round(totalVolume).toLocaleString()}</Text><Text style={histStatLbl}>kg Vol.</Text></View><View style={histStat}><Text style={[histStatVal,{color:theme.pink}]}>{totalSets}</Text><Text style={histStatLbl}>Sets</Text></View><View style={histStat}><Text style={[histStatVal,{color:theme.green}]}>{w?.exercises?.length??0}</Text><Text style={histStatLbl}>Üb.</Text></View></>)}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
const histStat: any = { flex:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:8,padding:7,alignItems:'center' };
const histStatVal: any = { fontSize:13,fontWeight:'700' };
const histStatLbl: any = { fontSize:8,color:'rgba(245,240,238,0.25)',textTransform:'uppercase',letterSpacing:0.3,marginTop:2 };

// ─── TrainingPlanScreen ───────────────────────────────────────
function TrainingPlanScreen({ onClose, userMaxes }: { onClose: () => void; userMaxes: UserMaxes }) {
  const currentWeek = getISOWeek(new Date());
  const isMonday = new Date().getDay() === 1;
  const [step, setStep] = useState<'loading'|'exercises'|'days'|'plan'>('loading');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [goal, setGoal] = useState('hypertrophie');
  const [plan, setPlan] = useState<PlanDay[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(PLAN_STORE_KEY).then(raw => {
      if (!raw) { setStep('exercises'); return; }
      const saved: PlanConfig = JSON.parse(raw);
      if (isMonday && saved.generatedWeek !== currentWeek) { setSelectedExercises(saved.exercises); setSelectedDays(saved.trainingDays); setGoal(saved.goal); setStep('exercises'); }
      else { setPlan(buildPlan(saved, userMaxes)); setStep('plan'); }
    });
  }, []);
  async function savePlan() {
    const cfg: PlanConfig = { exercises: selectedExercises, trainingDays: selectedDays, goal, generatedWeek: currentWeek };
    await AsyncStorage.setItem(PLAN_STORE_KEY, JSON.stringify(cfg));
    setPlan(buildPlan(cfg, userMaxes)); setStep('plan');
  }
  const goals = [{ key:'hypertrophie',label:'Muskelaufbau',emoji:'💪',desc:'10 Wdh., 72% 1RM' },{ key:'kraft',label:'Stärker werden',emoji:'🏋️',desc:'4 Wdh., 85% 1RM' },{ key:'ausdauer',label:'Ausdauer',emoji:'🏃',desc:'15 Wdh., 60% 1RM' }];
  return (
    <Modal visible animationType="slide">
      <View style={{ flex:1,backgroundColor:theme.bg }}>
        <View style={hist.header}>
          <View><Text style={hist.eyebrow}>{step==='exercises'?'Schritt 1/2':step==='days'?'Schritt 2/2':'Dein Plan'}</Text><Text style={hist.title}>{step==='exercises'?'Übungen':step==='days'?'Trainingstage':'Trainingsplan'}</Text></View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose}><IconClose color={theme.textPrimary} size={16} /></TouchableOpacity>
        </View>
        {step==='exercises'&&(
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16,paddingBottom:120,paddingTop:12 }}>
              <Text style={{ color:theme.textSecondary,fontSize:12,marginBottom:16 }}>Welche Übungen sollen im Plan sein? ({selectedExercises.length} gewählt)</Text>
              {MUSCLE_GROUPS.map(mg=>{
                const exs=EXERCISE_DB.filter(e=>e.muscleGroup===mg);
                return (
                  <View key={mg} style={{ marginBottom:16 }}>
                    <Text style={{ color:MUSCLE_COLORS[mg],fontSize:10,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.8,marginBottom:8 }}>{mg}</Text>
                    <View style={{ flexDirection:'row',flexWrap:'wrap',gap:8 }}>
                      {exs.map(ex=>{
                        const active=selectedExercises.includes(ex.name);
                        return <TouchableOpacity key={ex.name} style={{ paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:active?theme.orangeLight:theme.card,borderWidth:1.5,borderColor:active?theme.orange:theme.border,flexDirection:'row',alignItems:'center',gap:6 }} onPress={()=>setSelectedExercises(prev=>prev.includes(ex.name)?prev.filter(e=>e!==ex.name):[...prev,ex.name])} activeOpacity={0.8}>
                          {active&&<Text style={{ fontSize:10,color:theme.orange }}>✓</Text>}
                          <Text style={{ fontSize:13,color:active?theme.orange:theme.textPrimary,fontWeight:active?'600':'400' }}>{ex.name}</Text>
                          {userMaxes[ex.name]&&<Text style={{ fontSize:9,color:theme.green }}>PR</Text>}
                        </TouchableOpacity>;
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ position:'absolute',bottom:0,left:0,right:0,padding:16,paddingBottom:34,backgroundColor:theme.bg,borderTopWidth:0.5,borderTopColor:theme.border }}>
              <TouchableOpacity style={{ backgroundColor:selectedExercises.length>0?theme.orange:theme.cardSecondary,borderRadius:14,padding:15,alignItems:'center' }} onPress={()=>selectedExercises.length>0&&setStep('days')} activeOpacity={0.85}>
                <Text style={{ fontSize:15,fontWeight:'700',color:selectedExercises.length>0?'#fff':theme.textTertiary }}>Weiter → {selectedExercises.length>0?`${selectedExercises.length} Übungen`:''}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {step==='days'&&(
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16,paddingBottom:120 }}>
            <Text style={{ color:theme.textSecondary,fontSize:12,marginBottom:20 }}>An welchen Tagen kannst du trainieren? ({selectedDays.length} Tage)</Text>
            <View style={{ gap:8,marginBottom:24 }}>
              {DAY_NAMES.map((d,i)=>{
                const active=selectedDays.includes(i);
                return <TouchableOpacity key={i} style={{ backgroundColor:active?theme.orangeLight:theme.card,borderRadius:14,padding:16,borderWidth:1.5,borderColor:active?theme.orange:theme.border,flexDirection:'row',alignItems:'center',gap:14 }} onPress={()=>setSelectedDays(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i].sort())} activeOpacity={0.85}>
                  <View style={{ width:36,height:36,borderRadius:18,backgroundColor:active?theme.orange:theme.cardSecondary,alignItems:'center',justifyContent:'center' }}><Text style={{ fontSize:12,fontWeight:'800',color:active?'#fff':theme.textTertiary }}>{d}</Text></View>
                  <Text style={{ flex:1,fontSize:15,fontWeight:'600',color:active?theme.textPrimary:theme.textSecondary }}>{FULL_DAY_NAMES[i]}</Text>
                  {active&&<IconCheck color={theme.orange} size={18} />}
                </TouchableOpacity>;
              })}
            </View>
            <Text style={{ color:theme.textSecondary,fontSize:11,textTransform:'uppercase',letterSpacing:0.8,marginBottom:12,fontWeight:'600' }}>Ziel</Text>
            <View style={{ gap:8,marginBottom:24 }}>
              {goals.map(g=>(
                <TouchableOpacity key={g.key} style={{ backgroundColor:goal===g.key?theme.orangeLight:theme.card,borderRadius:14,padding:14,borderWidth:1.5,borderColor:goal===g.key?theme.orange:theme.border,flexDirection:'row',alignItems:'center',gap:12 }} onPress={()=>setGoal(g.key)} activeOpacity={0.85}>
                  <Text style={{ fontSize:24 }}>{g.emoji}</Text>
                  <View style={{ flex:1 }}><Text style={{ fontSize:14,fontWeight:'700',color:theme.textPrimary }}>{g.label}</Text><Text style={{ fontSize:11,color:theme.textSecondary }}>{g.desc}</Text></View>
                  {goal===g.key&&<IconCheck color={theme.orange} size={16} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection:'row',gap:10 }}>
              <TouchableOpacity style={{ flex:1,backgroundColor:theme.card,borderRadius:14,padding:15,alignItems:'center',borderWidth:1,borderColor:theme.border }} onPress={()=>setStep('exercises')} activeOpacity={0.85}><Text style={{ fontSize:15,fontWeight:'600',color:theme.textSecondary }}>← Zurück</Text></TouchableOpacity>
              <TouchableOpacity style={{ flex:2,backgroundColor:selectedDays.length>0?theme.orange:theme.cardSecondary,borderRadius:14,padding:15,alignItems:'center' }} onPress={()=>selectedDays.length>0&&savePlan()} activeOpacity={0.85}><Text style={{ fontSize:15,fontWeight:'700',color:selectedDays.length>0?'#fff':theme.textTertiary }}>Plan erstellen ✓</Text></TouchableOpacity>
            </View>
          </ScrollView>
        )}
        {step==='plan'&&(
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16 }}>
            {plan.map((day,i)=>(
              <View key={i} style={{ backgroundColor:theme.card,borderRadius:16,padding:14,marginBottom:10,borderWidth:1.5,borderColor:day.exercises.length>0?theme.orangeBorder:theme.border }}>
                <View style={{ flexDirection:'row',alignItems:'center',gap:10,marginBottom:day.exercises.length>0?12:0 }}>
                  <View style={{ width:36,height:36,borderRadius:18,backgroundColor:day.exercises.length>0?theme.orangeLight:theme.cardSecondary,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:day.exercises.length>0?theme.orangeBorder:theme.border }}><Text style={{ fontSize:11,fontWeight:'800',color:day.exercises.length>0?theme.orange:theme.textTertiary }}>{day.dayLabel}</Text></View>
                  <View style={{ flex:1 }}><Text style={{ fontSize:15,fontWeight:'700',color:theme.textPrimary }}>{day.name}</Text><Text style={{ fontSize:11,color:theme.textSecondary }}>{day.focus}</Text></View>
                  {day.exercises.length>0&&(<View style={{ backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:10,fontWeight:'700',color:theme.orange }}>{day.exercises.length} Üb.</Text></View>)}
                </View>
                {day.exercises.map((ex,ei)=>(
                  <View key={ei} style={{ flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderTopWidth:0.5,borderTopColor:theme.border }}>
                    <View style={{ width:6,height:6,borderRadius:3,backgroundColor:MUSCLE_COLORS[EXERCISE_DB.find(d=>d.name===ex.name)?.muscleGroup??'']??theme.orange }} />
                    <Text style={{ flex:1,fontSize:13,fontWeight:'600',color:theme.textPrimary }}>{ex.name}</Text>
                    <Text style={{ fontSize:12,color:theme.textSecondary }}>{ex.sets}×{ex.reps}</Text>
                    {ex.weight>0&&(<View style={{ backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:11,fontWeight:'700',color:theme.orange }}>{ex.weight} kg</Text></View>)}
                  </View>
                ))}
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor:theme.card,borderRadius:14,padding:14,alignItems:'center',borderWidth:1,borderColor:theme.border,marginTop:8 }} onPress={async()=>{await AsyncStorage.removeItem(PLAN_STORE_KEY);setStep('exercises');}} activeOpacity={0.85}><Text style={{ fontSize:13,fontWeight:'600',color:theme.textSecondary }}>Plan neu erstellen</Text></TouchableOpacity>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Routine Screens ──────────────────────────────────────────
function RoutineScreen({ routines, onSelectRoutine, onCreateRoutine, onUpdateRoutine, onDeleteRoutine, onBack }: {
  routines: Routine[]; onSelectRoutine: (r: Routine) => void; onCreateRoutine: (r: Routine) => void;
  onUpdateRoutine: (r: Routine) => void; onDeleteRoutine: (id: string) => void; onBack: () => void;
}) {
  const [tab, setTab] = useState<'meine'|'suchen'>('meine');
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState<'create'|'edit'>('create');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExercises, setNewExercises] = useState<{ name: string; muscleGroup: string; defaultSets: number; equipment?: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const communityFiltered = COMMUNITY_ROUTINES.filter(r => search===''||r.name.toLowerCase().includes(search.toLowerCase()));
  function openCreate() { setEditMode('create'); setNewName(''); setNewExercises([]); setEditingRoutine(null); setShowForm(true); }
  function openEdit(r: Routine) { setEditMode('edit'); setNewName(r.name); setNewExercises([...r.exercises]); setEditingRoutine(r); setShowForm(true); }
  function saveForm() {
    if (!newName.trim()) { Alert.alert('Bitte Namen eingeben'); return; }
    if (newExercises.length===0) { Alert.alert('Bitte mindestens eine Übung hinzufügen'); return; }
    if (editMode==='create') onCreateRoutine({ id:Date.now().toString(),name:newName.trim(),exercises:newExercises });
    else if (editingRoutine) onUpdateRoutine({ ...editingRoutine,name:newName.trim(),exercises:newExercises });
    setShowForm(false);
  }
  if (showForm) return (
    <>
      {showPicker && <ExercisePicker onSelect={(name,muscleGroup,equipment)=>{setNewExercises(prev=>[...prev,{name,muscleGroup,defaultSets:3,equipment}]);setShowPicker(false);}} onClose={()=>setShowPicker(false)} />}
      <ScrollView style={{ flex:1,backgroundColor:theme.bg }} showsVerticalScrollIndicator={false}>
        <View style={startSt.header}>
          <TouchableOpacity onPress={()=>setShowForm(false)} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
          <View><Text style={startSt.eyebrow}>{editMode==='create'?'Neue Routine':'Routine bearbeiten'}</Text><Text style={startSt.title}>{editMode==='create'?'Erstellen':newName}</Text></View>
        </View>
        <View style={{ paddingHorizontal:16 }}>
          <Text style={s.inputLabel}>Name</Text>
          <TextInput style={[s.input,{marginBottom:20}]} value={newName} onChangeText={setNewName} placeholder="z.B. Push Day" placeholderTextColor={theme.textTertiary} />
          <Text style={s.inputLabel}>Übungen ({newExercises.length})</Text>
          {newExercises.length>0&&(<View style={startSt.exListCard}>{newExercises.map((ex,i)=>(<View key={i} style={[startSt.exRow,i<newExercises.length-1&&startSt.exRowBorder]}><View style={[startSt.exDot,{backgroundColor:MUSCLE_COLORS[ex.muscleGroup]||'#888'}]} /><View style={{ flex:1 }}><Text style={startSt.exName}>{ex.name}</Text>{ex.equipment&&<Text style={{ fontSize:10,color:theme.textTertiary }}>{ex.equipment}</Text>}</View><TouchableOpacity onPress={()=>setNewExercises(prev=>prev.filter((_,idx)=>idx!==i))}><IconClose color={theme.textTertiary} size={14} /></TouchableOpacity></View>))}</View>)}
          <TouchableOpacity style={startSt.addExBtn} onPress={()=>setShowPicker(true)}><IconPlus color={theme.orange} size={16} /><Text style={startSt.addExBtnText}>Übung hinzufügen</Text></TouchableOpacity>
          <TouchableOpacity style={[s.saveBtn,{marginTop:20}]} onPress={saveForm} activeOpacity={0.85}><Text style={s.saveBtnText}>{editMode==='create'?'Routine speichern':'Änderungen speichern'}</Text></TouchableOpacity>
          <View style={{ height:80 }} />
        </View>
      </ScrollView>
    </>
  );
  return (
    <ScrollView style={{ flex:1,backgroundColor:theme.bg }} showsVerticalScrollIndicator={false}>
      <View style={startSt.header}>
        <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
        <View><Text style={startSt.eyebrow}>Krafttraining</Text><Text style={startSt.title}>Routinen</Text></View>
      </View>
      <View style={{ paddingHorizontal:16 }}>
        <View style={routineSt.tabRow}>
          <TouchableOpacity style={[routineSt.tabBtn,tab==='meine'&&routineSt.tabBtnActive]} onPress={()=>setTab('meine')}><Text style={[routineSt.tabBtnText,tab==='meine'&&routineSt.tabBtnTextActive]}>Meine Routinen</Text></TouchableOpacity>
          <TouchableOpacity style={[routineSt.tabBtn,tab==='suchen'&&routineSt.tabBtnActive]} onPress={()=>setTab('suchen')}><Text style={[routineSt.tabBtnText,tab==='suchen'&&routineSt.tabBtnTextActive]}>Entdecken</Text></TouchableOpacity>
        </View>
        {tab==='meine'?(
          <>
            <TouchableOpacity style={routineSt.createBtn} onPress={openCreate} activeOpacity={0.85}>
              <View style={routineSt.createBtnIcon}><IconPlus color={theme.orange} size={20} /></View>
              <View style={{ flex:1 }}><Text style={routineSt.createBtnTitle}>Neue Routine erstellen</Text><Text style={routineSt.createBtnSub}>Übungen selbst zusammenstellen</Text></View>
              <IconChevronRight color={theme.textTertiary} size={18} />
            </TouchableOpacity>
            {routines.length===0?(<View style={startSt.emptyState}><IconDumbbell color={theme.textTertiary} size={36} /><Text style={startSt.emptyStateTitle}>Noch keine Routinen</Text></View>):routines.map(r=>(
              <View key={r.id} style={[startSt.routineCard,{paddingRight:8}]}>
                <TouchableOpacity style={{ flex:1 }} onPress={()=>onSelectRoutine(r)} activeOpacity={0.85}>
                  <Text style={startSt.routineName}>{r.name}</Text>
                  <Text style={startSt.routineMeta}>{r.exercises.map(e=>e.name).slice(0,3).join(' · ')}{r.exercises.length>3?` · +${r.exercises.length-3}`:''}</Text>
                  <View style={startSt.routineChipRow}><View style={startSt.routineChip}><Text style={startSt.routineChipText}>{r.exercises.length} Übungen</Text></View></View>
                </TouchableOpacity>
                <View style={{ gap:6 }}>
                  <TouchableOpacity onPress={()=>openEdit(r)} style={{ width:32,height:32,borderRadius:16,backgroundColor:theme.blueLight,alignItems:'center',justifyContent:'center' }}><IconPencil color={theme.blue} size={14} /></TouchableOpacity>
                  <TouchableOpacity onPress={()=>Alert.alert('Löschen',`"${r.name}" löschen?`,[{text:'Abbrechen',style:'cancel'},{text:'Löschen',style:'destructive',onPress:()=>onDeleteRoutine(r.id)}])} style={{ width:32,height:32,borderRadius:16,backgroundColor:'rgba(255,69,58,0.12)',alignItems:'center',justifyContent:'center' }}><IconTrash color={theme.red} size={14} /></TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ):(
          <>
            <View style={routineSt.searchBox}><IconSearch color={theme.textTertiary} size={18} /><TextInput style={routineSt.searchInput} placeholder="Routine suchen..." placeholderTextColor={theme.textTertiary} value={search} onChangeText={setSearch} /></View>
            {communityFiltered.map(r=>(<TouchableOpacity key={r.id} style={startSt.routineCard} onPress={()=>onSelectRoutine(r)} activeOpacity={0.85}><View style={{ flex:1 }}><View style={{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:4 }}><Text style={startSt.routineName}>{r.name}</Text><View style={routineSt.communityBadge}><Text style={routineSt.communityBadgeText}>Community</Text></View></View><Text style={startSt.routineMeta}>{r.exercises.map(e=>e.name).slice(0,3).join(' · ')}{r.exercises.length>3?` · +${r.exercises.length-3}`:''}</Text><View style={startSt.routineChipRow}><View style={startSt.routineChip}><Text style={startSt.routineChipText}>{r.exercises.length} Übungen</Text></View></View></View><IconChevronRight color={theme.textTertiary} size={18} /></TouchableOpacity>))}
          </>
        )}
        <View style={{ height:100 }} />
      </View>
    </ScrollView>
  );
}

function RoutineDetailScreen({ routine, onStart, onBack }: { routine: Routine; onStart: (r: Routine) => void; onBack: () => void }) {
  const [extraExercises, setExtraExercises] = useState<{ name: string; muscleGroup: string; defaultSets: number; equipment?: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const allEx = [...routine.exercises, ...extraExercises];
  return (
    <>
      {showPicker&&<ExercisePicker onSelect={(name,muscleGroup,equipment)=>{setExtraExercises(prev=>[...prev,{name,muscleGroup,defaultSets:3,equipment}]);setShowPicker(false);}} onClose={()=>setShowPicker(false)} />}
      <ScrollView style={{ flex:1,backgroundColor:theme.bg }} showsVerticalScrollIndicator={false}>
        <View style={startSt.header}>
          <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
          <View><Text style={startSt.eyebrow}>Routine</Text><Text style={startSt.title}>{routine.name}</Text><Text style={{ fontSize:12,color:theme.textTertiary,marginTop:3 }}>{allEx.length} Übungen</Text></View>
        </View>
        <View style={{ paddingHorizontal:16 }}>
          <View style={startSt.exListCard}>
            {allEx.map((ex,i)=>(<View key={i} style={[startSt.exRow,i<allEx.length-1&&startSt.exRowBorder]}><View style={[startSt.exDot,{backgroundColor:MUSCLE_COLORS[ex.muscleGroup]||'#888'}]} /><View style={{ flex:1 }}><Text style={startSt.exName}>{ex.name}</Text>{ex.equipment&&<Text style={{ fontSize:10,color:theme.textTertiary }}>{ex.equipment}</Text>}</View><Text style={{ fontSize:11,color:theme.textTertiary }}>{ex.muscleGroup}</Text></View>))}
          </View>
          <TouchableOpacity style={startSt.addExBtn} onPress={()=>setShowPicker(true)}><IconPlus color={theme.orange} size={16} /><Text style={startSt.addExBtnText}>Übung hinzufügen</Text></TouchableOpacity>
          <View style={{ marginTop:12,marginBottom:40 }}><SwipeToStart onStart={()=>onStart({...routine,exercises:allEx})} /></View>
        </View>
      </ScrollView>
    </>
  );
}

// ─── FreeWorkoutStartScreen ───────────────────────────────────
function FreeWorkoutStartScreen({ onStart, onStartWithRecommendation, lastWorkout, onBack }: {
  onStart: () => void; onStartWithRecommendation: () => void; lastWorkout: Workout | null; onBack: () => void;
}) {
  return (
    <View style={{ flex:1,backgroundColor:theme.bg }}>
      <View style={startSt.header}>
        <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
        <View><Text style={startSt.eyebrow}>Krafttraining</Text><Text style={startSt.title}>Freies Training</Text></View>
      </View>
      <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16 }}>
        {lastWorkout&&(<TouchableOpacity style={startSt.recCard} onPress={onStartWithRecommendation} activeOpacity={0.88}><View style={startSt.recBadgeRow}><View style={startSt.recDot} /><Text style={startSt.recBadgeText}>Empfehlung für heute</Text></View><Text style={startSt.recTitle}>{lastWorkout.name}</Text><Text style={startSt.recSub}>{lastWorkout.exercises.slice(0,3).map(e=>e.name).join(' · ')}{lastWorkout.exercises.length>3?` · +${lastWorkout.exercises.length-3}`:''}</Text><View style={startSt.recBtn}><Text style={startSt.recBtnText}>Mit Empfehlung starten</Text></View></TouchableOpacity>)}
        <View style={startSt.emptyCard}><Text style={startSt.emptyCardTitle}>Leeres Training</Text><Text style={startSt.emptyCardSub}>Selbst Übungen zusammenstellen</Text></View>
        <View style={{ height:40 }} />
      </ScrollView>
      <View style={{ paddingHorizontal:16,paddingBottom:140 }}><SwipeToStart onStart={onStart} /></View>
    </View>
  );
}

// ─── ActiveGymWorkout ─────────────────────────────────────────
function ActiveGymWorkout({ workout, userMaxes, prHistory, lastWorkoutData, onUpdate, onFinish }: {
  workout: Workout; userMaxes: UserMaxes; prHistory: PRHistory;
  lastWorkoutData: Record<string, WorkoutSet[]>; onUpdate: (w: Workout) => void; onFinish: () => void;
}) {
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [dismissedPRWarnings, setDismissedPRWarnings] = useState<globalThis.Set<string>>(new globalThis.Set());
  const workoutTimer = useWorkoutTimer('gymWorkoutTimer');
  const restTimer = useRestTimer();
  useEffect(() => {
    if (!workoutTimer.isRunning) workoutTimer.startNow();
  }, []);

  async function addExercise(name: string, muscleGroup: string, equipment: string) {
    const lastSets = lastWorkoutData[name];
    const sets = lastSets ? lastSets.map(()=>({reps:'',weight:''})) : [{ reps:'',weight:'' }];
    const updated = { ...workout, exercises: [...workout.exercises, { id:Date.now().toString(), name, muscleGroup, equipment, sets }] };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated)); setShowExercisePicker(false);
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps'|'weight', value: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => {
      if (ex.id!==exerciseId) return ex;
      const newSets=[...ex.sets]; newSets[setIndex]={...newSets[setIndex],[field]:value}; return {...ex,sets:newSets};
    })};
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => {
      if (ex.id!==exerciseId) return ex;
      const prev=ex.sets[ex.sets.length-1];
      return {...ex,sets:[...ex.sets,{reps:'',weight:prev?.weight||''}]};
    })};
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    const updated = { ...workout, exercises: workout.exercises.filter(ex=>ex.id!==exerciseId) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  const totalSets = workout.exercises.reduce((s,ex)=>s+ex.sets.length, 0);
  const totalVolume = workout.exercises.reduce((t,ex)=>t+ex.sets.reduce((s,set)=>s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0), 0);

  return (
    <>
      {showExercisePicker&&<ExercisePicker onSelect={addExercise} onClose={()=>setShowExercisePicker(false)} />}
      <ScrollView style={{ flex:1,backgroundColor:theme.bg }} showsVerticalScrollIndicator={false}>
        {/* Clean header with timer */}
        <View style={active.header}>
          <View style={{ flex:1 }}>
            <Text style={active.workoutLabel}>{workout.name} · Aktiv</Text>
            <Text style={active.workoutTitle}>{workout.exercises.length > 0 ? workout.exercises[0].name : 'Training läuft'}</Text>
          </View>
          <View style={active.timerBadge}>
            <Text style={active.timerText}>{formatTime(workoutTimer.seconds)}</Text>
            <Text style={active.timerLabel}>Timer</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={active.statsRow}>
          {[{val:workout.exercises.length,lbl:'Übungen',color:theme.orange},{val:totalSets,lbl:'Sets',color:theme.green},{val:Math.round(totalVolume),lbl:'kg Vol.',color:theme.blue}].map(stat=>(
            <View key={stat.lbl} style={active.statBox}><Text style={[active.statVal,{color:stat.color}]}>{stat.val}</Text><Text style={active.statLbl}>{stat.lbl}</Text></View>
          ))}
        </View>

        <View style={{ paddingHorizontal:16 }}>
          {/* Rest Timer */}
          <View style={[active.pauseCard,{borderLeftColor:restTimer.isRunning?theme.orange:theme.cardSecondary}]}>
            <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'center' }}>
              <View>
                <Text style={[active.pauseLabel,{color:restTimer.isRunning?theme.orange:theme.textTertiary}]}>{restTimer.isRunning?'Pause läuft':'Pause starten'}</Text>
                {restTimer.isRunning&&<Text style={active.pauseTimer}>{formatTime(restTimer.seconds)}</Text>}
              </View>
              <View style={{ flexDirection:'row',gap:6 }}>
                {[60,90,120,180].map(sec=>(
                  <TouchableOpacity key={sec} style={[active.pauseBtn,restTimer.isRunning&&{borderColor:theme.orange}]} onPress={()=>restTimer.isRunning?restTimer.stop():restTimer.startFor(sec)}>
                    <Text style={[active.pauseBtnText,restTimer.isRunning&&{color:theme.orange}]}>{sec<120?`${sec}s`:`${sec/60}m`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {restTimer.isRunning&&(<View style={{ height:3,backgroundColor:theme.cardSecondary,borderRadius:2,marginTop:10 }}><View style={{ height:3,borderRadius:2,backgroundColor:restTimer.pct>0.3?theme.green:restTimer.pct>0.1?theme.orange:theme.red,width:`${restTimer.pct*100}%` as any }} /></View>)}
          </View>

          {workout.exercises.map(exercise=>{
            const hasPR=!!(prHistory[exercise.name]?.length)||!!(userMaxes[exercise.name]);
            const isDismissed=dismissedPRWarnings.has(exercise.id);
            const best1RM=getBest1RM(exercise.sets);
            const userMax=userMaxes[exercise.name];
            const pctOfMax=userMax&&best1RM>0?Math.round((best1RM/userMax)*100):null;
            const lastSets=lastWorkoutData[exercise.name];
            const mc=MUSCLE_COLORS[exercise.muscleGroup]||'#888';
            const recWeight=userMax?Math.round((userMax*0.75)/2.5)*2.5:0;
            const recText=userMax?`Empfehlung: 4 × 8 @ ${recWeight} kg`:null;
            const exData=EXERCISE_DB.find(e=>e.name===exercise.name);

            return (
              <View key={exercise.id} style={active.exerciseCard}>
                <View style={{ flexDirection:'row',alignItems:'center',gap:10,marginBottom:8 }}>
                  <View style={[active.musclePill,{backgroundColor:mc+'22'}]}><Text style={[active.musclePillText,{color:mc}]}>{exercise.muscleGroup}</Text></View>
                  <View style={{ flex:1 }}>
                    <Text style={active.exerciseName}>{exercise.name}</Text>
                    {exercise.equipment&&<Text style={{ fontSize:10,color:theme.textTertiary,marginTop:1 }}>{exercise.equipment}</Text>}
                  </View>
                  <TouchableOpacity onPress={()=>removeExercise(exercise.id)}><IconClose color={theme.textTertiary} size={16} /></TouchableOpacity>
                </View>
                {/* Secondary muscles info */}
                {exData&&exData.secondary.length>0&&(
                  <View style={{ flexDirection:'row',flexWrap:'wrap',gap:4,marginBottom:8 }}>
                    {exData.secondary.map(sec=>(
                      <View key={sec.muscle} style={{ backgroundColor:MUSCLE_COLORS[sec.muscle]+'18',borderRadius:20,paddingHorizontal:8,paddingVertical:2,borderWidth:1,borderColor:MUSCLE_COLORS[sec.muscle]+'40' }}>
                        <Text style={{ fontSize:10,color:MUSCLE_COLORS[sec.muscle],fontWeight:'500' }}>+{sec.muscle} {Math.round(sec.weight*100)}%</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!hasPR&&!isDismissed&&(
                  <View style={active.prWarn}>
                    <Text style={active.prWarnTitle}>Kein PR für {exercise.name}</Text>
                    <View style={{ flexDirection:'row',gap:6,marginTop:8 }}>
                      <TouchableOpacity style={active.prWarnBtn} onPress={()=>setDismissedPRWarnings((prev:globalThis.Set<string>)=>new globalThis.Set(prev).add(exercise.id))}><Text style={active.prWarnBtnText}>Trotzdem machen</Text></TouchableOpacity>
                      <TouchableOpacity style={[active.prWarnBtn,{borderColor:theme.orange}]} onPress={()=>{removeExercise(exercise.id);setShowExercisePicker(true);}}><Text style={[active.prWarnBtnText,{color:theme.orange}]}>Übung wechseln</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {recText&&(<TouchableOpacity style={active.recRow} onPress={async()=>{const newSets=Array.from({length:Math.max(exercise.sets.length,4)},()=>({reps:'8',weight:String(recWeight)}));const updated={...workout,exercises:workout.exercises.map(ex=>ex.id!==exercise.id?ex:{...ex,sets:newSets})};onUpdate(updated);await AsyncStorage.setItem('activeWorkout',JSON.stringify(updated));}} activeOpacity={0.75}><Text style={active.recText}>💡 {recText}</Text><Text style={{ fontSize:10,color:theme.blue,fontWeight:'600',marginTop:3 }}>Tippen zum Übernehmen →</Text></TouchableOpacity>)}
                {lastSets&&(<View style={active.lastRow}><Text style={active.lastLabel}>Letztes Mal: </Text><Text style={active.lastVal}>{lastSets.map(ls=>`${ls.weight}kg×${ls.reps}`).join(' · ')}</Text></View>)}
                {best1RM>0&&(<View style={{ flexDirection:'row',gap:12,marginBottom:10 }}><Text style={active.oneRM}>Est. 1RM: <Text style={{ color:theme.orange,fontWeight:'600' }}>{best1RM} kg</Text></Text>{pctOfMax&&<Text style={active.oneRM}>% Max: <Text style={{ color:pctOfMax>=100?theme.green:pctOfMax>=85?theme.orange:theme.textSecondary,fontWeight:'600' }}>{pctOfMax}%</Text></Text>}</View>)}
                <View style={{ flexDirection:'row',gap:8,marginBottom:8 }}>
                  <Text style={[active.setHeaderText,{width:24}]}>#</Text>
                  <Text style={[active.setHeaderText,{flex:1}]}>Wdh.</Text>
                  <Text style={[active.setHeaderText,{flex:1}]}>kg</Text>
                </View>
                {exercise.sets.map((set,si)=>{
                  const filled=set.reps!==''&&set.weight!=='';
                  return (
                    <View key={si} style={active.setRow}>
                      <Text style={active.setNumber}>{si+1}</Text>
                      <TextInput style={[active.setInput,filled&&{borderColor:'rgba(52,199,89,0.4)',color:theme.green}]} placeholder={lastSets?.[si]?.reps||'0'} placeholderTextColor={theme.textTertiary} value={set.reps} onChangeText={v=>updateSet(exercise.id,si,'reps',v)} keyboardType="numeric" />
                      <TextInput style={[active.setInput,filled&&{borderColor:'rgba(52,199,89,0.4)',color:theme.green}]} placeholder={lastSets?.[si]?.weight||'0'} placeholderTextColor={theme.textTertiary} value={set.weight} onChangeText={v=>updateSet(exercise.id,si,'weight',v)} keyboardType="decimal-pad" />
                    </View>
                  );
                })}
                <TouchableOpacity style={active.addSetBtn} onPress={()=>addSet(exercise.id)}><Text style={active.addSetBtnText}>+ Set hinzufügen</Text></TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={active.addExerciseBtn} onPress={()=>setShowExercisePicker(true)}>
            <IconPlus color={theme.orange} size={18} /><Text style={active.addExerciseBtnText}>Übung hinzufügen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={active.finishBtn} onPress={async()=>{await workoutTimer.stop();onFinish();}} activeOpacity={0.85}>
            <Text style={active.finishBtnText}>Training abschliessen</Text>
          </TouchableOpacity>
          <View style={{ height:120 }} />
        </View>
      </ScrollView>
    </>
  );
}

// ─── RunScreen ────────────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const runTimer = useWorkoutTimer('activeRunTimer');
  const [manualDist, setManualDist] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!runTimer.isRunning) runTimer.startNow();
    const p = Animated.loop(Animated.sequence([Animated.timing(pulseAnim,{toValue:1.03,duration:1000,useNativeDriver:true}),Animated.timing(pulseAnim,{toValue:1,duration:1000,useNativeDriver:true})]));
    p.start(); return ()=>p.stop();
  }, []);
  const dist = parseFloat(manualDist)||0;
  const paceSeconds = dist>0?runTimer.seconds/dist:0;
  const estimatedCalories = parseInt(calories)||Math.round(runTimer.seconds/60*8);
  async function finishRun() {
    const dur=runTimer.getDuration()*60; await runTimer.stop();
    const runData: RunData = { id:Date.now().toString(),distance:dist,duration:dur,pace:formatPace(dist>0?dur/dist:0),calories:estimatedCalories,heartRate:parseInt(heartRate)||0,date:new Date().toISOString() };
    const raw=await AsyncStorage.getItem('runs'); const runs=raw?JSON.parse(raw):[];
    runs.push(runData); await AsyncStorage.setItem('runs',JSON.stringify(runs));
    await AsyncStorage.removeItem('activeWorkout');
    Alert.alert('Lauf abgeschlossen!',`${dist.toFixed(2)} km · ${formatTime(dur)} · ${formatPace(dist>0?dur/dist:0)} /km`,[{text:'OK',onPress:onStop}]);
  }
  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.headerLabel}>Lauf</Text>
      <Animated.View style={[s.runTimerCard,{transform:[{scale:pulseAnim}]}]}>
        <Text style={s.runTimerLabel}>LAUFZEIT</Text>
        <Text style={s.runTimerDisplay}>{formatTime(runTimer.seconds)}</Text>
      </Animated.View>
      <View style={s.runStatsGrid}>
        {[{val:dist.toFixed(2),lbl:'km',color:theme.green},{val:formatPace(paceSeconds),lbl:'/km Pace',color:theme.blue},{val:String(estimatedCalories),lbl:'kcal',color:theme.orange},{val:heartRate||'--',lbl:'bpm',color:theme.pink}].map(stat=>(
          <View key={stat.lbl} style={s.runStatCard}><Text style={[s.runStatVal,{color:stat.color}]}>{stat.val}</Text><Text style={s.runStatLbl}>{stat.lbl}</Text></View>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Daten eingeben</Text>
        <View style={{ flexDirection:'row',gap:10 }}>
          {[{label:'Distanz (km)',value:manualDist,setter:setManualDist,kb:'decimal-pad' as const,ph:'0.00'},{label:'Herzfrequenz',value:heartRate,setter:setHeartRate,kb:'numeric' as const,ph:'bpm'},{label:'Kalorien',value:calories,setter:setCalories,kb:'numeric' as const,ph:'kcal'}].map(f=>(
            <View key={f.label} style={{ flex:1 }}><Text style={s.inputLabel}>{f.label}</Text><TextInput style={s.input} value={f.value} onChangeText={f.setter} keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={theme.textTertiary} /></View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.finishRunBtn} onPress={finishRun} activeOpacity={0.85}><Text style={s.finishRunBtnText}>Lauf beenden</Text></TouchableOpacity>
      <View style={{ height:100 }} />
    </ScrollView>
  );
}

// ─── Main TrainingScreen ──────────────────────────────────────
type Screen = 'home' | 'freeStart' | 'routineScreen' | 'routineDetail';
const DAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'];

export default function TrainingScreen() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPRScreen, setShowPRScreen] = useState(false);
  const [showPREntry, setShowPREntry] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showJudo, setShowJudo] = useState(false);
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [nutritionAdvice, setNutritionAdvice] = useState<ReturnType<typeof getNutritionAdvice> | null>(null);
  const [lastWorkoutScore, setLastWorkoutScore] = useState(0);
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, WorkoutSet[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [muscles, setMuscles] = useState<MuscleMap>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue:1, duration:350, useNativeDriver:true }).start();
  }, []));

  async function loadAll() {
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const ws: Workout[] = JSON.parse(rawW);
      setWorkouts(ws);
      const lastData: Record<string,WorkoutSet[]> = {};
      [...ws].reverse().forEach(w => w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; }));
      setLastWorkoutData(lastData);
      // Calculate muscle recovery with secondary muscles
      const newMuscles = calculateMuscleRecovery(ws, muscles);
      setMuscles(newMuscles);
    } else {
      const def: MuscleMap = {};
      MUSCLE_GROUPS.forEach(m => { def[m] = { level: 100, lastTrained: null }; });
      setMuscles(def);
    }
    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w: Workout = JSON.parse(rawActive);
      if (isToday(w.date)) { if (w.type==='run') setActiveRun(true); else setActiveWorkout(w); }
      else { await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer'); }
    }
    const rawMaxes = await AsyncStorage.getItem('userMaxes');
    if (rawMaxes) setUserMaxes(JSON.parse(rawMaxes));
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));
    const rawRoutines = await AsyncStorage.getItem('routines');
    if (rawRoutines) setRoutines(JSON.parse(rawRoutines));
    const rawDevice = await AsyncStorage.getItem('connectedDevice');
    if (rawDevice) setConnectedDevice(rawDevice);
  }

  async function saveRoutine(r: Routine) { const u=[...routines,r]; setRoutines(u); await AsyncStorage.setItem('routines',JSON.stringify(u)); }
  async function updateRoutine(r: Routine) { const u=routines.map(x=>x.id===r.id?r:x); setRoutines(u); await AsyncStorage.setItem('routines',JSON.stringify(u)); }
  async function deleteRoutine(id: string) { const u=routines.filter(r=>r.id!==id); setRoutines(u); await AsyncStorage.setItem('routines',JSON.stringify(u)); }

  async function savePR(exerciseName: string, weight: number, reps: number) {
    const estimated1RM=calc1RM(weight,reps);
    const newPRH={...prHistory};
    newPRH[exerciseName]=[...(newPRH[exerciseName]||[]),{date:new Date().toISOString(),weight,reps,estimated1RM}];
    setPRHistory(newPRH); await AsyncStorage.setItem('prHistory',JSON.stringify(newPRH));
    const newMaxes={...userMaxes};
    if(estimated1RM>(newMaxes[exerciseName]||0)){newMaxes[exerciseName]=estimated1RM;setUserMaxes(newMaxes);await AsyncStorage.setItem('userMaxes',JSON.stringify(newMaxes));}
  }

  const gymWorkouts = workouts.filter(w=>w.type==='gym');
  const lastGymWorkout = [...gymWorkouts].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0];
  const daysSinceGym = lastGymWorkout ? daysSince(lastGymWorkout.date) : -1;
  const neverTrainedGym = daysSinceGym === -1;
  const weekDays = getWeekTrainings(workouts);
  const todayDayIdx = (() => { const d=new Date().getDay(); return d===0?6:d-1; })();
  const prCount = Object.keys(prHistory).length;

  async function startFreeWorkout() {
    const w: Workout = { id:Date.now().toString(),date:new Date().toISOString(),name:'Freies Training',exercises:[],duration:0,intensity:3,type:'gym' };
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }
  async function startFreeWithRecommendation() {
    if (!lastGymWorkout) return startFreeWorkout();
    const w: Workout = { id:Date.now().toString(),date:new Date().toISOString(),name:lastGymWorkout.name, exercises:lastGymWorkout.exercises.map(ex=>({...ex,id:Date.now().toString()+ex.name,sets:ex.sets.map(()=>({reps:'',weight:''}))})), duration:0,intensity:3,type:'gym' };
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }
  async function startRoutineWorkout(routine: Routine) {
    const w: Workout = { id:Date.now().toString(),date:new Date().toISOString(),name:routine.name, exercises:routine.exercises.map(re=>({id:Date.now().toString()+re.name,name:re.name,muscleGroup:re.muscleGroup,equipment:re.equipment,sets:Array.from({length:re.defaultSets},()=>({reps:'',weight:''}))})), duration:0,intensity:3,type:'gym' };
    await AsyncStorage.setItem('activeWorkout',JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    const rawTimer = await AsyncStorage.getItem('gymWorkoutTimer');
    let duration = 1;
    if (rawTimer) { try { const {startedAt}=JSON.parse(rawTimer); if(startedAt) duration=Math.max(1,Math.round((Date.now()-startedAt)/60000)); } catch {} }
    const score = calcWorkoutScore({...activeWorkout,duration}, userMaxes);
    const finished: Workout = {...activeWorkout,duration,score};
    const newPRH={...prHistory};
    for (const ex of finished.exercises) {
      const best=getBest1RM(ex.sets);
      if(best>0){const cur=newPRH[ex.name]||[];const curMax=cur.length>0?cur[cur.length-1].estimated1RM:0;if(best>curMax){const bestSet=ex.sets.reduce((b,set)=>calc1RM(parseFloat(set.weight||'0'),parseFloat(set.reps||'0'))>calc1RM(parseFloat(b.weight||'0'),parseFloat(b.reps||'0'))?set:b,ex.sets[0]);newPRH[ex.name]=[...(newPRH[ex.name]||[]),{date:new Date().toISOString(),weight:parseFloat(bestSet.weight||'0'),reps:parseFloat(bestSet.reps||'0'),estimated1RM:best}];}}
    }
    await AsyncStorage.setItem('prHistory',JSON.stringify(newPRH));
    const newMaxes={...userMaxes};
    for (const ex of finished.exercises) { const best=getBest1RM(ex.sets); if(best>(newMaxes[ex.name]||0)) newMaxes[ex.name]=best; }
    await AsyncStorage.setItem('userMaxes',JSON.stringify(newMaxes));
    const rawWH=await AsyncStorage.getItem('workouts'); const histArr=rawWH?JSON.parse(rawWH):[];
    histArr.push(finished); await AsyncStorage.setItem('workouts',JSON.stringify(histArr));
    await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer');
    setActiveWorkout(null);
    const rawProfile=await AsyncStorage.getItem('profile');
    const bodyWeight=rawProfile?JSON.parse(rawProfile).weight:75;
    const advice=getNutritionAdvice(score,duration,parseFloat(bodyWeight)||75);
    setNutritionAdvice(advice); setLastWorkoutScore(score); setShowNutritionModal(true);
    await loadAll();
  }

  async function stopSession() {
    setActiveRun(false); setActiveWorkout(null);
    await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer'); await AsyncStorage.removeItem('activeRunTimer');
    await loadAll();
  }

  const greetingHour = new Date().getHours();
  const greeting = greetingHour<12?'Guten Morgen':greetingHour<18?'Guten Tag':'Guten Abend';

  if (activeRun) return <RunScreen onStop={stopSession} />;
  if (activeWorkout) return <ActiveGymWorkout workout={activeWorkout} userMaxes={userMaxes} prHistory={prHistory} lastWorkoutData={lastWorkoutData} onUpdate={setActiveWorkout} onFinish={finishWorkout} />;
  if (screen==='freeStart') return <FreeWorkoutStartScreen onStart={startFreeWorkout} onStartWithRecommendation={startFreeWithRecommendation} lastWorkout={lastGymWorkout??null} onBack={()=>setScreen('home')} />;
  if (screen==='routineScreen') return <RoutineScreen routines={routines} onSelectRoutine={r=>{setSelectedRoutine(r);setScreen('routineDetail');}} onCreateRoutine={saveRoutine} onUpdateRoutine={updateRoutine} onDeleteRoutine={deleteRoutine} onBack={()=>setScreen('home')} />;
  if (screen==='routineDetail'&&selectedRoutine) return <RoutineDetailScreen routine={selectedRoutine} onStart={startRoutineWorkout} onBack={()=>setScreen('routineScreen')} />;

  return (
    <View style={{ flex:1,backgroundColor:theme.bg }}>
      {/* Modals */}
      {showHistory && <HistoryScreen onClose={()=>{setShowHistory(false);loadAll();}} prHistory={prHistory} onDelete={()=>loadAll()} />}
      {showPRScreen && <PRScreen prHistory={prHistory} onClose={()=>setShowPRScreen(false)} onAddPR={()=>{setShowPRScreen(false);setShowPREntry(true);}} />}
      {showPREntry && <PREntryScreen onClose={()=>setShowPREntry(false)} onSave={savePR} />}
      {showPlan && <TrainingPlanScreen onClose={()=>setShowPlan(false)} userMaxes={userMaxes} />}
      {showJudo && <JudoTrackingScreen onClose={()=>setShowJudo(false)} />}
      {showBodyModal && <BodyScreenModal muscles={muscles} onClose={()=>setShowBodyModal(false)} />}

      {/* Nutrition Modal */}
      <Modal visible={showNutritionModal} transparent animationType="slide">
        <View style={{ flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:theme.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24 }}>
            <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
              <View><Text style={{ fontSize:10,fontWeight:'700',textTransform:'uppercase',letterSpacing:1,color:theme.orange,marginBottom:4 }}>Training abgeschlossen</Text><Text style={{ fontSize:22,fontWeight:'800',color:theme.textPrimary }}>Ernährungsplan 🍗</Text></View>
              <View style={{ backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:13,fontWeight:'700',color:theme.orange }}>⚡ {lastWorkoutScore}</Text></View>
            </View>
            {nutritionAdvice&&(<>
              <View style={{ backgroundColor:theme.greenLight,borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.green+'40' }}>
                <Text style={{ color:theme.green,fontSize:10,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.8,marginBottom:8 }}>{nutritionAdvice.immediate.timing}</Text>
                <View style={{ flexDirection:'row',gap:12 }}>
                  <View style={{ flex:1,alignItems:'center' }}><Text style={{ fontSize:28,fontWeight:'800',color:theme.textPrimary }}>{nutritionAdvice.immediate.protein}g</Text><Text style={{ fontSize:11,color:theme.textSecondary,marginTop:2 }}>Protein</Text></View>
                  <View style={{ width:1,backgroundColor:theme.border }} />
                  <View style={{ flex:1,alignItems:'center' }}><Text style={{ fontSize:28,fontWeight:'800',color:theme.textPrimary }}>{nutritionAdvice.immediate.carbs}g</Text><Text style={{ fontSize:11,color:theme.textSecondary,marginTop:2 }}>Kohlenhydrate</Text></View>
                </View>
              </View>
              <View style={{ backgroundColor:theme.blueLight,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.blue+'40' }}>
                <Text style={{ color:theme.blue,fontSize:10,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.8,marginBottom:8 }}>{nutritionAdvice.later.timing}</Text>
                <View style={{ flexDirection:'row',gap:12 }}>
                  <View style={{ flex:1,alignItems:'center' }}><Text style={{ fontSize:28,fontWeight:'800',color:theme.textPrimary }}>{nutritionAdvice.later.protein}g</Text><Text style={{ fontSize:11,color:theme.textSecondary,marginTop:2 }}>Protein</Text></View>
                  <View style={{ width:1,backgroundColor:theme.border }} />
                  <View style={{ flex:1,alignItems:'center' }}><Text style={{ fontSize:28,fontWeight:'800',color:theme.textPrimary }}>{nutritionAdvice.later.carbs}g</Text><Text style={{ fontSize:11,color:theme.textSecondary,marginTop:2 }}>Kohlenhydrate</Text></View>
                </View>
              </View>
            </>)}
            <TouchableOpacity style={{ backgroundColor:theme.orange,borderRadius:14,padding:15,alignItems:'center',marginTop:16 }} onPress={()=>setShowNutritionModal(false)} activeOpacity={0.85}><Text style={{ fontSize:15,fontWeight:'700',color:'#fff' }}>Verstanden ✓</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device Modal */}
      <Modal visible={showDeviceModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Gerät verbinden</Text>
            {['Polar','Garmin','Apple Watch','Suunto'].map(device=>(
              <TouchableOpacity key={device} style={[s.presetChip,{paddingVertical:14,marginBottom:8,borderRadius:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}]}
                onPress={async()=>{await AsyncStorage.setItem('connectedDevice',device);setConnectedDevice(device);setShowDeviceModal(false);Alert.alert('Verbunden',`${device} wurde erfolgreich verbunden.`);}}>
                <Text style={[s.presetChipText,{fontSize:15}]}>{device}</Text>
                <IconChevronRight color={theme.textTertiary} size={18} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={()=>setShowDeviceModal(false)}><Text style={s.cancelBtnText}>Abbrechen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ─── HEADER ─── */}
          <View style={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.orange, marginBottom: 3 }}>Training</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.6 }}>{greeting}</Text>
          </View>

          {/* ─── WEEK STRIP ─── */}
          <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14 }}>
            <Text style={{ fontSize: 9, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Diese Woche · {weekDays.filter(Boolean).length} Trainings</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              {DAY_LABELS.map((lbl, idx) => {
                const done=weekDays[idx], isToday2=idx===todayDayIdx;
                return (
                  <View key={lbl} style={{ alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: done?theme.orange:isToday2?'rgba(232,87,42,0.14)':'rgba(255,255,255,0.04)', borderWidth: isToday2&&!done?2:done?0:1, borderColor: isToday2?theme.orange:'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                      {done?<IconCheck color="#fff" size={13} />:isToday2?<View style={{ width:7,height:7,borderRadius:4,backgroundColor:theme.orange }} />:null}
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: isToday2?'800':'600', color: isToday2?theme.orange:done?'rgba(245,240,238,0.4)':'rgba(245,240,238,0.18)' }}>{lbl}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── HERO CARD ─── */}
          <View style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 22, borderWidth: 1.5, borderColor: theme.orangeBorder, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.orange }} />
              <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.orange }}>
                {neverTrainedGym?'Starte dein erstes Training':daysSinceGym>=2?'Heute empfohlen':'Bereit für mehr?'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.orangeLight, borderWidth: 1, borderColor: theme.orangeBorder, alignItems: 'center', justifyContent: 'center' }}>
                <IconDumbbell color={theme.orange} size={28} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 21, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.4, marginBottom: 3 }}>{neverTrainedGym?'Krafttraining':lastGymWorkout?.name??'Krafttraining'}</Text>
                {!neverTrainedGym&&lastGymWorkout&&(<Text style={{ fontSize: 12, color: theme.textSecondary }}>{lastGymWorkout.exercises.slice(0,3).map(e=>e.name).join(' · ')}{lastGymWorkout.exercises.length>3?` · +${lastGymWorkout.exercises.length-3}`:''}</Text>)}
              </View>
            </View>
            <TouchableOpacity style={{ backgroundColor: theme.orange, borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}
              onPress={()=>lastGymWorkout?startFreeWithRecommendation():setScreen('freeStart')} activeOpacity={0.85}>
              <IconPlay color="#fff" size={15} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Jetzt starten</Text>
            </TouchableOpacity>
          </View>

          {/* ─── QUICK ACTIONS 2x2 GRID ─── */}
          <View style={{ marginHorizontal: 16, marginBottom: 10, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Routinen', icon: <IconList color={theme.orange} size={24} />, bg: theme.orangeLight, border: theme.orangeBorder, onPress: ()=>setScreen('routineScreen') },
                { label: 'Freies Training', icon: <IconPencil color={theme.blue} size={24} />, bg: theme.blueLight, border: theme.blue+'30', onPress: ()=>setScreen('freeStart') },
              ].map(btn=>(
                <TouchableOpacity key={btn.label} style={{ flex:1,backgroundColor:theme.card,borderRadius:18,padding:18,borderWidth:1,borderColor:theme.border,alignItems:'flex-start',gap:10 }} onPress={btn.onPress} activeOpacity={0.85}>
                  <View style={{ width:44,height:44,borderRadius:22,backgroundColor:btn.bg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:btn.border }}>{btn.icon}</View>
                  <Text style={{ fontSize:14,fontWeight:'700',color:theme.textPrimary }}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Trainingsplan', icon: <IconCalendar color={theme.green} size={24} />, bg: theme.greenLight, border: theme.green+'30', onPress: ()=>setShowPlan(true) },
                { label: 'Judo', icon: <Text style={{fontSize:24}}>🥋</Text>, bg: 'rgba(74,158,255,0.12)', border: 'rgba(74,158,255,0.25)', onPress: ()=>setShowJudo(true) },
              ].map(btn=>(
                <TouchableOpacity key={btn.label} style={{ flex:1,backgroundColor:theme.card,borderRadius:18,padding:18,borderWidth:1,borderColor:theme.border,alignItems:'flex-start',gap:10 }} onPress={btn.onPress} activeOpacity={0.85}>
                  <View style={{ width:44,height:44,borderRadius:22,backgroundColor:btn.bg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:btn.border }}>{btn.icon}</View>
                  <Text style={{ fontSize:14,fontWeight:'700',color:theme.textPrimary }}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ─── BODY RECOVERY WIDGET ─── */}
          <BodyRecoveryWidget muscles={muscles} onPress={()=>setShowBodyModal(true)} />

          {/* ─── SECTION: AUFZEICHNUNGEN ─── */}
          <View style={{ marginHorizontal: 16, marginBottom: 4, marginTop: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.textTertiary, marginBottom: 8 }}>Aufzeichnungen</Text>
          </View>

          {/* PRs */}
          <TouchableOpacity style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,borderWidth:1,borderColor:'rgba(255,215,0,0.2)',flexDirection:'row',alignItems:'center',gap:13 }}
            onPress={()=>prCount===0?setShowPREntry(true):setShowPRScreen(true)} activeOpacity={0.85}>
            <View style={{ width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,215,0,0.1)',alignItems:'center',justifyContent:'center' }}>
              <IconTrophy color="#FFD700" size={22} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 }}>Personal Records</Text>
              <Text style={{ fontSize:12,color:theme.textSecondary }}>{prCount===0?'Noch keine PRs – tippe um einzutragen':`${prCount} PRs gespeichert`}</Text>
            </View>
            <IconChevronRight color="rgba(255,215,0,0.4)" size={18} />
          </TouchableOpacity>

          {/* Verlauf */}
          <TouchableOpacity style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,borderWidth:1,borderColor:theme.border,flexDirection:'row',alignItems:'center',gap:13 }}
            onPress={()=>setShowHistory(true)} activeOpacity={0.85}>
            <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.orangeLight,alignItems:'center',justifyContent:'center' }}>
              <IconHistory color={theme.orange} size={22} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 }}>Trainingsverlauf</Text>
              <Text style={{ fontSize:12,color:theme.textSecondary }}>{workouts.length} Einheiten gespeichert</Text>
            </View>
            <IconChevronRight color={theme.textTertiary} size={18} />
          </TouchableOpacity>

          {/* ─── SECTION: GERÄTE ─── */}
          <View style={{ marginHorizontal: 16, marginBottom: 4, marginTop: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.textTertiary, marginBottom: 8 }}>Wearables</Text>
          </View>

          {connectedDevice?(
            <View style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:theme.border }}>
              <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.greenLight,alignItems:'center',justifyContent:'center' }}><IconWatch color={theme.green} size={22} /></View>
              <View style={{ flex:1 }}><Text style={{ fontSize:15,fontWeight:'600',color:theme.textPrimary,marginBottom:2 }}>{connectedDevice}</Text><View style={{ flexDirection:'row',alignItems:'center',gap:5 }}><View style={{ width:6,height:6,borderRadius:3,backgroundColor:theme.green }} /><Text style={{ fontSize:12,color:theme.green }}>Verbunden</Text></View></View>
              <TouchableOpacity style={{ backgroundColor:theme.orange,borderRadius:22,paddingHorizontal:14,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:5 }} onPress={()=>Alert.alert('Synchronisieren','Daten werden synchronisiert...')} activeOpacity={0.8}>
                <IconSync color="#fff" size={14} /><Text style={{ fontSize:13,fontWeight:'600',color:'#fff' }}>Sync</Text>
              </TouchableOpacity>
            </View>
          ):(
            <TouchableOpacity style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:theme.border,borderStyle:'dashed' }}
              onPress={()=>setShowDeviceModal(true)} activeOpacity={0.85}>
              <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' }}><IconWatch color={theme.textTertiary} size={22} /></View>
              <View style={{ flex:1 }}><Text style={{ fontSize:15,fontWeight:'600',color:theme.textPrimary,marginBottom:2 }}>Kein Gerät verbunden</Text><Text style={{ fontSize:12,color:theme.textSecondary }}>Polar, Garmin oder Apple Watch</Text></View>
              <View style={{ backgroundColor:theme.orangeLight,borderRadius:22,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:theme.orangeBorder }}><Text style={{ fontSize:13,fontWeight:'600',color:theme.orange }}>Verbinden</Text></View>
            </TouchableOpacity>
          )}

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const sw = StyleSheet.create({
  track: { backgroundColor:theme.card,borderWidth:1,borderColor:theme.orangeBorder,borderRadius:50,padding:6,height:68,overflow:'hidden',justifyContent:'center' },
  thumb: { width:56,height:56,borderRadius:28,backgroundColor:theme.orange,alignItems:'center',justifyContent:'center',zIndex:2 },
  label: { position:'absolute',left:0,right:0,textAlign:'center',fontSize:13,fontWeight:'600',color:theme.textTertiary },
});
const startSt = StyleSheet.create({
  header: { paddingTop:60,paddingHorizontal:16,paddingBottom:20,flexDirection:'row',alignItems:'flex-start',gap:12 },
  backBtn: { width:36,height:36,borderRadius:18,backgroundColor:theme.card,alignItems:'center',justifyContent:'center',marginTop:4,borderWidth:1,borderColor:theme.border },
  eyebrow: { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  title: { fontSize:26,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.6 },
  recCard: { backgroundColor:theme.card,borderRadius:18,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.orangeBorder },
  recBadgeRow: { flexDirection:'row',alignItems:'center',gap:6,marginBottom:8 },
  recDot: { width:6,height:6,borderRadius:3,backgroundColor:theme.orange },
  recBadgeText: { fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',color:theme.orange },
  recTitle: { fontSize:17,fontWeight:'800',color:theme.textPrimary,marginBottom:4,letterSpacing:-0.3 },
  recSub: { fontSize:12,color:theme.textSecondary,marginBottom:12 },
  recBtn: { backgroundColor:theme.orange,borderRadius:12,padding:12,alignItems:'center' },
  recBtnText: { fontSize:13,fontWeight:'700',color:'#fff' },
  emptyCard: { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:12,borderWidth:1,borderColor:theme.border },
  emptyCardTitle: { fontSize:14,fontWeight:'600',color:theme.textSecondary,marginBottom:3 },
  emptyCardSub: { fontSize:12,color:theme.textTertiary },
  routineCard: { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:theme.border },
  routineName: { fontSize:16,fontWeight:'700',color:theme.textPrimary,marginBottom:4,letterSpacing:-0.3 },
  routineMeta: { fontSize:11,color:theme.textSecondary,marginBottom:8 },
  routineChipRow: { flexDirection:'row',gap:6 },
  routineChip: { backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:theme.orangeBorder },
  routineChipText: { fontSize:11,fontWeight:'600',color:theme.orange },
  exListCard: { backgroundColor:theme.card,borderRadius:16,overflow:'hidden',marginBottom:12,borderWidth:1,borderColor:theme.border },
  exRow: { flexDirection:'row',alignItems:'center',gap:10,padding:12 },
  exRowBorder: { borderBottomWidth:0.5,borderBottomColor:theme.border },
  exDot: { width:8,height:8,borderRadius:4 },
  exName: { flex:1,fontSize:13,fontWeight:'600',color:theme.textPrimary },
  addExBtn: { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:theme.orangeBorder,borderRadius:12,borderStyle:'dashed',padding:12,marginBottom:12 },
  addExBtnText: { fontSize:13,fontWeight:'600',color:theme.orange },
  emptyState: { alignItems:'center',paddingVertical:60,gap:12 },
  emptyStateTitle: { fontSize:17,fontWeight:'700',color:theme.textPrimary },
  emptyStateSub: { fontSize:13,color:theme.textSecondary,textAlign:'center' },
});
const routineSt = StyleSheet.create({
  tabRow: { flexDirection:'row',gap:8,marginBottom:16 },
  tabBtn: { flex:1,paddingVertical:10,borderRadius:12,backgroundColor:theme.card,alignItems:'center',borderWidth:1,borderColor:theme.border },
  tabBtnActive: { backgroundColor:theme.orange,borderColor:theme.orange },
  tabBtnText: { fontSize:13,fontWeight:'600',color:theme.textSecondary },
  tabBtnTextActive: { color:'#fff' },
  createBtn: { backgroundColor:theme.card,borderRadius:16,padding:16,flexDirection:'row',alignItems:'center',gap:14,marginBottom:12,borderWidth:1,borderColor:theme.orangeBorder },
  createBtnIcon: { width:44,height:44,borderRadius:22,backgroundColor:theme.orangeLight,alignItems:'center',justifyContent:'center' },
  createBtnTitle: { fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 },
  createBtnSub: { fontSize:12,color:theme.textSecondary },
  searchBox: { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,paddingHorizontal:14,paddingVertical:12,marginBottom:14,borderWidth:1,borderColor:theme.border },
  searchInput: { flex:1,fontSize:14,color:theme.textPrimary },
  communityBadge: { backgroundColor:theme.blueLight,borderRadius:20,paddingHorizontal:8,paddingVertical:3 },
  communityBadgeText: { fontSize:10,fontWeight:'600',color:theme.blue },
});
const prEntry = StyleSheet.create({
  header: { flexDirection:'row',alignItems:'flex-end',gap:12,paddingTop:60,paddingHorizontal:16,paddingBottom:20,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  closeBtn: { width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' },
  eyebrow: { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  title: { fontSize:24,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5 },
  searchBox: { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,paddingHorizontal:14,paddingVertical:12,marginBottom:20,borderWidth:1,borderColor:theme.border },
  searchInput: { flex:1,fontSize:14,color:theme.textPrimary },
  muscleLabel: { fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8 },
  exRow: { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:theme.border },
  exDot: { width:8,height:8,borderRadius:4 },
  exName: { flex:1,fontSize:14,fontWeight:'600',color:theme.textPrimary },
  sectionLabel: { fontSize:11,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',color:theme.textTertiary,marginBottom:12 },
  repsRow: { flexDirection:'row',gap:10,marginBottom:8 },
  repsBtn: { flex:1,backgroundColor:theme.card,borderRadius:16,padding:16,alignItems:'center',borderWidth:1,borderColor:theme.border },
  repsBtnActive: { backgroundColor:theme.orange,borderColor:theme.orange },
  repsBtnNum: { fontSize:28,fontWeight:'800',color:theme.textPrimary,marginBottom:2 },
  repsBtnLabel: { fontSize:11,color:theme.textSecondary },
  weightRow: { flexDirection:'row',alignItems:'center',gap:12,backgroundColor:theme.card,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border,marginBottom:16 },
  weightInput: { flex:1,fontSize:48,fontWeight:'800',color:theme.textPrimary,letterSpacing:-1 },
  weightUnit: { fontSize:20,fontWeight:'600',color:theme.textTertiary },
  previewCard: { backgroundColor:theme.orangeLight,borderRadius:14,padding:16,marginBottom:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:theme.orangeBorder },
  previewLabel: { fontSize:12,fontWeight:'600',color:theme.orange,textTransform:'uppercase',letterSpacing:0.8 },
  previewVal: { fontSize:28,fontWeight:'800',color:theme.orange },
  saveBtn: { backgroundColor:theme.orange,borderRadius:16,padding:16,alignItems:'center' },
  saveBtnText: { fontSize:15,fontWeight:'700',color:'#fff' },
});
const prSt = StyleSheet.create({
  addBtn: { flexDirection:'row',alignItems:'center',gap:8,backgroundColor:theme.orange,borderRadius:14,padding:14,margin:16,justifyContent:'center' },
  addBtnText: { fontSize:14,fontWeight:'700',color:'#fff' },
  card: { backgroundColor:theme.card,borderRadius:18,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.border },
  rankBadge: { width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:1.5 },
  rankText: { fontSize:12,fontWeight:'800' },
  exerciseName: { fontSize:16,fontWeight:'700',color:theme.textPrimary,letterSpacing:-0.3 },
  exerciseDate: { fontSize:12,color:theme.textTertiary,marginTop:2 },
  oneRMVal: { fontSize:20,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5 },
  oneRMLabel: { fontSize:10,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.5 },
  prStat: { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:10,alignItems:'center' },
  prStatVal: { fontSize:15,fontWeight:'700',color:theme.textPrimary },
  prStatLbl: { fontSize:9,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.4,marginTop:2 },
  deltaChip: { borderRadius:20,paddingHorizontal:10,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:4 },
  deltaText: { fontSize:12,fontWeight:'700' },
});
const active = StyleSheet.create({
  header: { backgroundColor:theme.card,paddingTop:56,paddingHorizontal:16,paddingBottom:14,flexDirection:'row',alignItems:'flex-start',gap:12,borderBottomWidth:0.5,borderBottomColor:theme.border },
  workoutLabel: { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  workoutTitle: { fontSize:20,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.4 },
  timerBadge: { backgroundColor:theme.cardSecondary,borderRadius:12,paddingHorizontal:12,paddingVertical:8,alignItems:'center',borderWidth:1,borderColor:theme.border },
  timerText: { fontSize:18,fontWeight:'700',color:theme.textPrimary,letterSpacing:1 },
  timerLabel: { fontSize:8,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.5,marginTop:1 },
  statsRow: { flexDirection:'row',gap:8,padding:12,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  statBox: { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:10,alignItems:'center' },
  statVal: { fontSize:18,fontWeight:'700' },
  statLbl: { fontSize:8,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.5,marginTop:2 },
  pauseCard: { backgroundColor:theme.card,borderLeftWidth:3,padding:12,marginBottom:12,marginTop:12,borderRadius:0 },
  pauseLabel: { fontSize:9,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:2 },
  pauseTimer: { fontSize:22,fontWeight:'800',color:theme.textPrimary,letterSpacing:1 },
  pauseBtn: { backgroundColor:theme.cardSecondary,borderRadius:8,paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderColor:theme.border },
  pauseBtnText: { fontSize:11,fontWeight:'600',color:theme.textSecondary },
  exerciseCard: { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.border },
  musclePill: { paddingHorizontal:10,paddingVertical:4,borderRadius:20 },
  musclePillText: { fontSize:11,fontWeight:'500' },
  exerciseName: { flex:1,fontSize:15,fontWeight:'700',color:theme.textPrimary },
  prWarn: { backgroundColor:'rgba(232,87,42,0.08)',borderRadius:10,padding:12,borderLeftWidth:3,borderLeftColor:theme.orange,marginBottom:12 },
  prWarnTitle: { fontSize:12,fontWeight:'700',color:theme.textPrimary,marginBottom:2 },
  prWarnBtn: { flex:1,borderRadius:8,padding:8,alignItems:'center',borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSecondary },
  prWarnBtnText: { fontSize:11,fontWeight:'600',color:theme.textSecondary },
  recRow: { backgroundColor:theme.blueLight,borderRadius:8,padding:8,marginBottom:10,borderWidth:1,borderColor:'rgba(74,158,255,0.2)' },
  recText: { fontSize:12,color:theme.blue,fontWeight:'500' },
  lastRow: { flexDirection:'row',backgroundColor:theme.cardSecondary,borderRadius:8,padding:8,marginBottom:8 },
  lastLabel: { fontSize:11,color:theme.textSecondary },
  lastVal: { fontSize:11,color:theme.orange,fontWeight:'500',flex:1 },
  oneRM: { fontSize:11,color:theme.textSecondary,marginBottom:10 },
  setHeaderText: { fontSize:9,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.8,textAlign:'center' },
  setRow: { flexDirection:'row',gap:8,marginBottom:8,alignItems:'center' },
  setNumber: { fontSize:13,color:theme.textSecondary,width:24,textAlign:'center' },
  setInput: { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:11,color:theme.textPrimary,fontSize:15,textAlign:'center',borderWidth:1,borderColor:theme.border },
  addSetBtn: { padding:8,alignItems:'center' },
  addSetBtnText: { fontSize:13,color:theme.orange,fontWeight:'500' },
  addExerciseBtn: { backgroundColor:theme.orangeLight,borderRadius:14,padding:14,alignItems:'center',marginBottom:10,borderWidth:1,borderColor:theme.orangeBorder,flexDirection:'row',justifyContent:'center',gap:8 },
  addExerciseBtnText: { fontSize:15,color:theme.orange,fontWeight:'600' },
  finishBtn: { backgroundColor:theme.orange,borderRadius:16,padding:16,alignItems:'center',marginBottom:20 },
  finishBtnText: { fontSize:15,color:'#fff',fontWeight:'700' },
});
const hist = StyleSheet.create({
  header: { flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:60,paddingHorizontal:22,paddingBottom:14,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  eyebrow: { fontSize:11,fontWeight:'600',color:theme.orange,letterSpacing:0.8,textTransform:'uppercase',marginBottom:4 },
  title: { fontSize:28,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.8 },
  closeBtn: { width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' },
});
const s = StyleSheet.create({
  container: { flex:1,backgroundColor:theme.bg,paddingHorizontal:20 },
  headerLabel: { fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:theme.textSecondary,marginTop:60,marginBottom:12 },
  card: { backgroundColor:theme.card,borderRadius:16,padding:14,marginBottom:10,borderWidth:1,borderColor:theme.border },
  cardTitle: { fontSize:10,textTransform:'uppercase',letterSpacing:1.5,color:theme.textSecondary,marginBottom:10 },
  inputLabel: { fontSize:10,textTransform:'uppercase',letterSpacing:1.2,color:theme.textSecondary,marginBottom:6 },
  input: { backgroundColor:theme.cardSecondary,borderRadius:12,padding:13,color:theme.textPrimary,fontSize:15,marginBottom:12,borderWidth:1,borderColor:theme.border },
  saveBtn: { backgroundColor:theme.orange,borderRadius:14,padding:15,alignItems:'center' },
  saveBtnText: { fontSize:15,fontWeight:'600',color:'#fff' },
  cancelBtn: { padding:14,alignItems:'center' },
  cancelBtnText: { fontSize:14,color:theme.textSecondary },
  presetChip: { paddingHorizontal:12,paddingVertical:7,borderRadius:20,backgroundColor:theme.cardSecondary,borderWidth:1,borderColor:theme.border },
  presetChipText: { fontSize:13,color:theme.textPrimary },
  modalOverlay: { flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end' },
  modalCard: { backgroundColor:theme.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,gap:12 },
  modalTitle: { fontSize:20,fontWeight:'700',color:theme.textPrimary },
  runTimerCard: { backgroundColor:theme.card,borderRadius:24,padding:28,alignItems:'center',gap:10,marginBottom:14,borderLeftWidth:3,borderLeftColor:theme.green,borderWidth:1,borderColor:theme.border },
  runTimerLabel: { fontSize:10,color:theme.textSecondary,textTransform:'uppercase',letterSpacing:2 },
  runTimerDisplay: { fontSize:60,fontWeight:'300',color:theme.textPrimary,letterSpacing:-2 },
  runStatsGrid: { flexDirection:'row',gap:8,marginBottom:14 },
  runStatCard: { flex:1,backgroundColor:theme.card,borderRadius:14,padding:12,alignItems:'center',borderWidth:1,borderColor:theme.border },
  runStatVal: { fontSize:16,fontWeight:'600' },
  runStatLbl: { fontSize:8,color:theme.textSecondary,textTransform:'uppercase',letterSpacing:0.8,marginTop:3,textAlign:'center' },
  finishRunBtn: { backgroundColor:theme.green,borderRadius:16,padding:16,alignItems:'center',marginBottom:40 },
  finishRunBtnText: { fontSize:15,fontWeight:'600',color:'#000' },
});