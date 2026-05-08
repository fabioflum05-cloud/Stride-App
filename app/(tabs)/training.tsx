import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, AppStateStatus,
  Dimensions, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
  pink:          '#FF375F',
  textPrimary:   '#F5F0EE',
  textSecondary: 'rgba(245,240,238,0.45)' as string,
  textTertiary:  'rgba(245,240,238,0.22)' as string,
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
};

// ─── Types ────────────────────────────────────────────────────
type WorkoutSet = { reps: string; weight: string };
type Exercise = { id: string; name: string; muscleGroup: string; sets: WorkoutSet[] };
type Workout = {
  id: string; date: string; name: string; exercises: Exercise[];
  duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo';
  score?: number;
};
type RunData = {
  id: string; distance: number; duration: number; pace: string;
  calories: number; heartRate: number; date: string;
};
type PREntry = { date: string; weight: number; reps: number; estimated1RM: number };
type PRHistory = Record<string, PREntry[]>;
type UserMaxes = Record<string, number>;
type Routine = {
  id: string; name: string;
  exercises: { name: string; muscleGroup: string; defaultSets: number }[];
};

// ─── Constants ────────────────────────────────────────────────
const MUSCLE_GROUPS = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps',
  'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core', 'Ganzkörper',
];
const MUSCLE_COLORS: Record<string, string> = {
  Brust: '#EC4899', Rücken: '#7C3AED', Schultern: '#06B6D4',
  Bizeps: '#10B981', Trizeps: '#F59E0B', Quadrizeps: '#FB7185',
  Hamstrings: '#A78BFA', Gluteus: '#F472B6', Waden: '#67E8F9',
  Core: '#FB923C', Ganzkörper: '#E8572A',
};
const DEFAULT_EXERCISES = [
  { name: 'Bankdrücken', muscleGroup: 'Brust' },
  { name: 'Schrägbankdrücken', muscleGroup: 'Brust' },
  { name: 'Butterfly', muscleGroup: 'Brust' },
  { name: 'Klimmzüge', muscleGroup: 'Rücken' },
  { name: 'Rudern', muscleGroup: 'Rücken' },
  { name: 'Kreuzheben', muscleGroup: 'Rücken' },
  { name: 'Latzug', muscleGroup: 'Rücken' },
  { name: 'Face Pulls', muscleGroup: 'Rücken' },
  { name: 'Deadlift', muscleGroup: 'Rücken' },
  { name: 'Schulterdrücken', muscleGroup: 'Schultern' },
  { name: 'Seitheben', muscleGroup: 'Schultern' },
  { name: 'Curls', muscleGroup: 'Bizeps' },
  { name: 'Hammer Curls', muscleGroup: 'Bizeps' },
  { name: 'Trizepsdrücken', muscleGroup: 'Trizeps' },
  { name: 'Dips', muscleGroup: 'Trizeps' },
  { name: 'Kniebeugen', muscleGroup: 'Quadrizeps' },
  { name: 'Beinpresse', muscleGroup: 'Quadrizeps' },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' },
  { name: 'Beinbeuger', muscleGroup: 'Hamstrings' },
  { name: 'Hip Thrust', muscleGroup: 'Gluteus' },
  { name: 'Wadenheben', muscleGroup: 'Waden' },
  { name: 'Plank', muscleGroup: 'Core' },
  { name: 'Crunches', muscleGroup: 'Core' },
];

const COMMUNITY_ROUTINES: Routine[] = [
  { id: 'c1', name: 'Push Day', exercises: [
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 4 },
    { name: 'Schrägbankdrücken', muscleGroup: 'Brust', defaultSets: 3 },
    { name: 'Schulterdrücken', muscleGroup: 'Schultern', defaultSets: 3 },
    { name: 'Seitheben', muscleGroup: 'Schultern', defaultSets: 3 },
    { name: 'Trizepsdrücken', muscleGroup: 'Trizeps', defaultSets: 3 },
    { name: 'Dips', muscleGroup: 'Trizeps', defaultSets: 3 },
  ]},
  { id: 'c2', name: 'Pull Day', exercises: [
    { name: 'Klimmzüge', muscleGroup: 'Rücken', defaultSets: 4 },
    { name: 'Rudern', muscleGroup: 'Rücken', defaultSets: 4 },
    { name: 'Latzug', muscleGroup: 'Rücken', defaultSets: 3 },
    { name: 'Face Pulls', muscleGroup: 'Rücken', defaultSets: 3 },
    { name: 'Curls', muscleGroup: 'Bizeps', defaultSets: 3 },
    { name: 'Hammer Curls', muscleGroup: 'Bizeps', defaultSets: 3 },
  ]},
  { id: 'c3', name: 'Leg Day', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 4 },
    { name: 'Beinpresse', muscleGroup: 'Quadrizeps', defaultSets: 4 },
    { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', defaultSets: 3 },
    { name: 'Beinbeuger', muscleGroup: 'Hamstrings', defaultSets: 3 },
    { name: 'Hip Thrust', muscleGroup: 'Gluteus', defaultSets: 3 },
    { name: 'Wadenheben', muscleGroup: 'Waden', defaultSets: 4 },
  ]},
  { id: 'c4', name: 'Upper Body', exercises: [
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 3 },
    { name: 'Rudern', muscleGroup: 'Rücken', defaultSets: 3 },
    { name: 'Schulterdrücken', muscleGroup: 'Schultern', defaultSets: 3 },
    { name: 'Klimmzüge', muscleGroup: 'Rücken', defaultSets: 3 },
    { name: 'Curls', muscleGroup: 'Bizeps', defaultSets: 2 },
    { name: 'Trizepsdrücken', muscleGroup: 'Trizeps', defaultSets: 2 },
  ]},
  { id: 'c5', name: 'Full Body', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 3 },
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 3 },
    { name: 'Deadlift', muscleGroup: 'Rücken', defaultSets: 3 },
    { name: 'Schulterdrücken', muscleGroup: 'Schultern', defaultSets: 3 },
    { name: 'Klimmzüge', muscleGroup: 'Rücken', defaultSets: 3 },
  ]},
  { id: 'c6', name: 'Powerlifting', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 5 },
    { name: 'Bankdrücken', muscleGroup: 'Brust', defaultSets: 5 },
    { name: 'Deadlift', muscleGroup: 'Rücken', defaultSets: 5 },
  ]},
];

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
function getStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  const sorted = [...workouts].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let streak = 0;
  let checkDate = new Date(); checkDate.setHours(0,0,0,0);
  for (const w of sorted) {
    const d = new Date(w.date); d.setHours(0,0,0,0);
    const diff = Math.round((checkDate.getTime() - d.getTime()) / (1000*60*60*24));
    if (diff === 0 || diff === 1) { streak++; checkDate = d; } else break;
  }
  return streak;
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

// ─── Trainingsscore berechnen ─────────────────────────────────
function calcWorkoutScore(workout: Workout, userMaxes: UserMaxes): number {
  if (!workout.exercises || workout.exercises.length === 0) return 0;
  let intensityScore = 0, volumeScore = 0, exerciseCount = 0;
  for (const ex of workout.exercises) {
    const max = userMaxes[ex.name] || 0;
    const best = getBest1RM(ex.sets);
    if (max > 0 && best > 0) {
      intensityScore += Math.min(1, best / max);
      exerciseCount++;
    }
    for (const set of ex.sets) {
      const r = parseFloat(set.reps || '0'), w = parseFloat(set.weight || '0');
      if (r > 0 && w > 0) volumeScore += r * w;
    }
  }
  const avgIntensity = exerciseCount > 0 ? intensityScore / exerciseCount : 0.5;
  const volScore = Math.min(1, volumeScore / 10000);
  const durScore = Math.min(1, (workout.duration || 30) / 90);
  const setCount = workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const setsScore = Math.min(1, setCount / 20);
  return Math.round((avgIntensity * 0.4 + volScore * 0.3 + durScore * 0.15 + setsScore * 0.15) * 100);
}

// ─── Trainingsplan generieren ─────────────────────────────────
function generateTrainingPlan(goal: string, userMaxes: UserMaxes): { day: string; name: string; focus: string; exercises: { name: string; sets: number; reps: string; weight: number }[] }[] {
  const hasPRs = Object.keys(userMaxes).length > 0;
  const intensity = goal === 'kraft' ? 0.85 : goal === 'ausdauer' ? 0.6 : 0.72;
  const repsRange = goal === 'kraft' ? '3–5' : goal === 'ausdauer' ? '15–20' : '8–12';
  const setsCount = goal === 'kraft' ? 5 : goal === 'ausdauer' ? 3 : 4;

  function w(name: string) {
    const max = userMaxes[name] || 0;
    if (!max) return 0;
    return Math.round((max * intensity) / 2.5) * 2.5;
  }

  return [
    { day: 'Mo', name: 'Push', focus: 'Brust · Schultern · Trizeps', exercises: [
      { name: 'Bankdrücken', sets: setsCount, reps: repsRange, weight: w('Bankdrücken') },
      { name: 'Schulterdrücken', sets: setsCount - 1, reps: repsRange, weight: w('Schulterdrücken') },
      { name: 'Trizepsdrücken', sets: 3, reps: repsRange, weight: w('Trizepsdrücken') },
    ]},
    { day: 'Di', name: 'Pull', focus: 'Rücken · Bizeps', exercises: [
      { name: 'Klimmzüge', sets: setsCount, reps: repsRange, weight: w('Klimmzüge') },
      { name: 'Rudern', sets: setsCount, reps: repsRange, weight: w('Rudern') },
      { name: 'Curls', sets: 3, reps: repsRange, weight: w('Curls') },
    ]},
    { day: 'Mi', name: 'Pause', focus: 'Aktive Erholung', exercises: [] },
    { day: 'Do', name: 'Beine', focus: 'Quadrizeps · Hamstrings · Gluteus', exercises: [
      { name: 'Kniebeugen', sets: setsCount, reps: repsRange, weight: w('Kniebeugen') },
      { name: 'Romanian Deadlift', sets: setsCount - 1, reps: repsRange, weight: w('Romanian Deadlift') },
      { name: 'Hip Thrust', sets: 3, reps: repsRange, weight: w('Hip Thrust') },
    ]},
    { day: 'Fr', name: 'Upper', focus: 'Ganzkörper Kraft', exercises: [
      { name: 'Deadlift', sets: setsCount, reps: repsRange, weight: w('Deadlift') },
      { name: 'Schulterdrücken', sets: 3, reps: repsRange, weight: w('Schulterdrücken') },
      { name: 'Seitheben', sets: 3, reps: repsRange, weight: w('Seitheben') },
    ]},
    { day: 'Sa', name: 'Optional', focus: 'Schwachstellen', exercises: [] },
    { day: 'So', name: 'Ruhe', focus: 'Regeneration', exercises: [] },
  ];
}

// ─── SVG Icons ────────────────────────────────────────────────
function IconDumbbell({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Rect x="2"  y="11"   width="4"  height="6"  rx="1.5" fill={color} />
      <Rect x="22" y="11"   width="4"  height="6"  rx="1.5" fill={color} />
      <Rect x="5"  y="9"    width="3"  height="10" rx="1.5" fill={color} />
      <Rect x="20" y="9"    width="3"  height="10" rx="1.5" fill={color} />
      <Rect x="8"  y="12.5" width="12" height="3"  rx="1.5" fill={color} />
    </Svg>
  );
}
function IconRun({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={14} cy={4} r={2} stroke={color} strokeWidth={1.8} />
      <Path d="M6 20L10 13L13 16L16 10L19 13M5 10L10 13L13 8L16 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconWatch({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={1.8} />
      <Path d="M12 9V12L14 14M9 3H15L16 6H8L9 3ZM8 18L9 21H15L16 18H8Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconHistory({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3V21M3 17L9 11L13 15L21 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconChevronLeft({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconClose({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconTrophy({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9H4C3.45 9 3 8.55 3 8V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V8C21 8.55 20.55 9 20 9H18M6 9C6 13 9 17 12 17C15 17 18 13 18 9M6 9H18M12 17V21M8 21H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconSync({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 2V8H15M3 22V16H9M21 13C20.6 17.4 16.8 21 12 21C7.6 21 4 18 3 14M3 11C3.4 6.6 7.2 3 12 3C16.4 3 20 6 21 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPlus({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconSearch({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.8} />
      <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconPlay({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4L20 12L6 20V4Z" fill={color} />
    </Svg>
  );
}
function IconList({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconPencil({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4C3.45 4 3 4.45 3 5V20C3 20.55 3.45 21 4 21H19C19.55 21 20 20.55 20 19V12M18.5 2.5C19.33 1.67 20.67 1.67 21.5 2.5C22.33 3.33 22.33 4.67 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconArrowUp({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M5 12L12 5L19 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconArrowDown({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19M5 12L12 19L19 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCheck({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronsRight({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17L12 12L7 7M13 17L18 12L13 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconTrash({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2V5M16 2V5M3 8H21M5 4H19C20.1 4 21 4.9 21 6V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V6C3 4.9 3.9 4 5 4Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Swipe To Start ───────────────────────────────────────────
// Uses its own PanResponder that captures horizontal swipes
// and does NOT let them bubble up to the tab swipe handler.
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
    onPanResponderMove: (_, gs) => {
      translateX.setValue(Math.max(0, Math.min(gs.dx, MAX_DRAG)));
    },
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

// ─── Persistent Workout Timer ──────────────────────────────────
// Stores startedAt in AsyncStorage so it survives app restarts.
// Stops automatically when workout ends.
function useWorkoutTimer(timerKey: string) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const startAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem(timerKey).then(raw => {
      if (!raw) return;
      try {
        const { startedAt } = JSON.parse(raw);
        if (startedAt) {
          startAtRef.current = startedAt;
          setSeconds(Math.floor((Date.now() - startedAt) / 1000));
          setIsRunning(true);
        }
      } catch {}
    });

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && startAtRef.current) {
        setSeconds(Math.floor((Date.now() - startAtRef.current) / 1000));
      }
      appStateRef.current = next;
    });
    return () => { sub.remove(); clearInterval(intervalRef.current); };
  }, [timerKey]);

  useEffect(() => {
    if (isRunning && startAtRef.current) {
      intervalRef.current = setInterval(() => {
        if (startAtRef.current)
          setSeconds(Math.floor((Date.now() - startAtRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const startNow = useCallback(async () => {
    const now = Date.now();
    startAtRef.current = now;
    await AsyncStorage.setItem(timerKey, JSON.stringify({ startedAt: now }));
    setIsRunning(true);
  }, [timerKey]);

  const stop = useCallback(async () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    await AsyncStorage.removeItem(timerKey);
  }, [timerKey]);

  const getDuration = useCallback(() => {
    if (!startAtRef.current) return 0;
    return Math.max(1, Math.round((Date.now() - startAtRef.current) / 60000));
  }, []);

  return { seconds, isRunning, startNow, stop, getDuration };
}

// ─── Persistent Rest Timer ─────────────────────────────────────
function useRestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState(90);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const STORE_KEY = 'restTimerData';

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then(raw => {
      if (!raw) return;
      try {
        const { startedAt, target } = JSON.parse(raw);
        if (startedAt && target) {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, target - elapsed);
          if (remaining > 0) {
            startAtRef.current = startedAt;
            setTargetSeconds(target);
            setSeconds(remaining);
            setIsRunning(true);
          } else {
            AsyncStorage.removeItem(STORE_KEY);
          }
        }
      } catch {}
    });

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && startAtRef.current && isRunning) {
        const elapsed = Math.floor((Date.now() - startAtRef.current) / 1000);
        const remaining = Math.max(0, targetSeconds - elapsed);
        setSeconds(remaining);
        if (remaining === 0) { setIsRunning(false); AsyncStorage.removeItem(STORE_KEY); }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isRunning && startAtRef.current) {
      intervalRef.current = setInterval(() => {
        if (!startAtRef.current) return;
        const elapsed = Math.floor((Date.now() - startAtRef.current) / 1000);
        const remaining = Math.max(0, targetSeconds - elapsed);
        setSeconds(remaining);
        if (remaining === 0) { setIsRunning(false); startAtRef.current = null; AsyncStorage.removeItem(STORE_KEY); clearInterval(intervalRef.current); }
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, targetSeconds]);

  function startFor(secs: number) {
    const now = Date.now();
    startAtRef.current = now;
    setTargetSeconds(secs);
    setSeconds(secs);
    setIsRunning(true);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify({ startedAt: now, target: secs }));
  }
  function stopRest() { setIsRunning(false); setSeconds(0); startAtRef.current = null; AsyncStorage.removeItem(STORE_KEY); }
  const pct = targetSeconds > 0 ? Math.max(0, seconds / targetSeconds) : 0;
  return { seconds, isRunning, startFor, stop: stopRest, pct };
}

// ─── Exercise Picker ──────────────────────────────────────────
function ExercisePicker({ allExercises, onSelect, onClose }: {
  allExercises: typeof DEFAULT_EXERCISES;
  onSelect: (name: string, muscleGroup: string) => void;
  onClose: () => void;
}) {
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [search, setSearch] = useState('');
  const filtered = allExercises.filter(e => search === '' || e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalOverlay}>
        <ScrollView>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Übung hinzufügen</Text>
            <TextInput style={[s.input, { marginBottom: 16 }]} placeholder="Suchen..." placeholderTextColor={theme.textTertiary} value={search} onChangeText={setSearch} />
            {MUSCLE_GROUPS.map(mg => {
              const exs = filtered.filter(e => e.muscleGroup === mg);
              if (exs.length === 0) return null;
              return (
                <View key={mg} style={{ marginBottom: 14 }}>
                  <Text style={[s.inputLabel, { color: MUSCLE_COLORS[mg], marginBottom: 8 }]}>{mg}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {exs.map(ex => (
                      <TouchableOpacity key={ex.name} style={s.presetChip} onPress={() => onSelect(ex.name, ex.muscleGroup)}>
                        <Text style={s.presetChipText}>{ex.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            <Text style={[s.inputLabel, { marginBottom: 6, marginTop: 8 }]}>Eigene Übung</Text>
            <TextInput style={s.input} value={customName} onChangeText={setCustomName} placeholder="Name" placeholderTextColor={theme.textTertiary} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {MUSCLE_GROUPS.map(mg => (
                <TouchableOpacity key={mg}
                  style={[s.presetChip, customMuscle === mg && { backgroundColor: theme.orangeLight, borderColor: theme.orange, borderWidth: 1 }]}
                  onPress={() => setCustomMuscle(mg)}>
                  <Text style={[s.presetChipText, customMuscle === mg && { color: theme.orange }]}>{mg}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={() => { if (customName.trim()) onSelect(customName.trim(), customMuscle); }}>
              <Text style={s.saveBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── PR Entry Screen ──────────────────────────────────────────
function PREntryScreen({ onClose, onSave }: {
  onClose: () => void;
  onSave: (exerciseName: string, weight: number, reps: number) => void;
}) {
  const [step, setStep] = useState<'exercise'|'entry'>('exercise');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedReps, setSelectedReps] = useState(1);
  const [weight, setWeight] = useState('');
  const [search, setSearch] = useState('');
  const filtered = DEFAULT_EXERCISES.filter(e => search === '' || e.name.toLowerCase().includes(search.toLowerCase()));

  function handleSave() {
    const w = parseFloat(weight);
    if (!w || w <= 0) { Alert.alert('Bitte Gewicht eingeben'); return; }
    onSave(selectedExercise, w, selectedReps);
    onClose();
  }

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={prEntry.header}>
          <TouchableOpacity onPress={onClose} style={prEntry.closeBtn}>
            <IconClose color={theme.textPrimary} size={16} />
          </TouchableOpacity>
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
                  <TouchableOpacity key={r} style={[prEntry.repsBtn, selectedReps === r && prEntry.repsBtnActive]} onPress={() => setSelectedReps(r)} activeOpacity={0.8}>
                    <Text style={[prEntry.repsBtnNum, selectedReps === r && { color: '#fff' }]}>{r}</Text>
                    <Text style={[prEntry.repsBtnLabel, selectedReps === r && { color: 'rgba(255,255,255,0.6)' }]}>{r === 1 ? 'Rep' : 'Reps'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[prEntry.sectionLabel, { marginTop: 24 }]}>Gewicht</Text>
              <View style={prEntry.weightRow}>
                <TextInput style={prEntry.weightInput} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.textTertiary} autoFocus />
                <Text style={prEntry.weightUnit}>kg</Text>
              </View>
              {weight !== '' && parseFloat(weight) > 0 && (
                <View style={prEntry.previewCard}>
                  <Text style={prEntry.previewLabel}>Est. 1RM</Text>
                  <Text style={prEntry.previewVal}>{calc1RM(parseFloat(weight), selectedReps)} kg</Text>
                </View>
              )}
              <TouchableOpacity style={prEntry.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                <Text style={prEntry.saveBtnText}>PR speichern</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={() => setStep('exercise')}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Andere Übung wählen</Text>
              </TouchableOpacity>
              <View style={{ height: 60 }} />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── PR Screen ────────────────────────────────────────────────
function PRScreen({ prHistory, onClose, onAddPR }: { prHistory: PRHistory; onClose: () => void; onAddPR: () => void }) {
  const entries = Object.entries(prHistory).sort((a,b) => (b[1][b[1].length-1]?.estimated1RM ?? 0) - (a[1][a[1].length-1]?.estimated1RM ?? 0));
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={hist.header}>
          <View><Text style={hist.eyebrow}>Bestleistungen</Text><Text style={hist.title}>Personal Records</Text></View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose}><IconClose color={theme.textPrimary} size={16} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={prSt.addBtn} onPress={onAddPR} activeOpacity={0.85}>
          <IconPlus color="#fff" size={18} />
          <Text style={prSt.addBtnText}>PR eintragen</Text>
        </TouchableOpacity>
        {entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 }}>
            <IconTrophy color={theme.textTertiary} size={40} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' }}>Noch keine PRs</Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21 }}>Trag deinen ersten PR ein.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            {entries.map(([name, history], i) => {
              const latest = history[history.length-1];
              const prev = history.length > 1 ? history[history.length-2] : null;
              const delta = prev ? latest.estimated1RM - prev.estimated1RM : null;
              const rankColors = ['#FFD700','#C0C0C0','#CD7F32'];
              const rankColor = i < 3 ? rankColors[i] : theme.border;
              return (
                <View key={name} style={prSt.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <View style={[prSt.rankBadge, { backgroundColor: rankColor+'25', borderColor: rankColor }]}>
                      <Text style={[prSt.rankText, { color: i < 3 ? rankColor : theme.textSecondary }]}>#{i+1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={prSt.exerciseName}>{name}</Text>
                      <Text style={prSt.exerciseDate}>{new Date(latest.date).toLocaleDateString('de', { day:'2-digit', month:'2-digit', year:'numeric' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={prSt.oneRMVal}>{latest.estimated1RM} kg</Text>
                      <Text style={prSt.oneRMLabel}>Est. 1RM</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={prSt.prStat}><Text style={prSt.prStatVal}>{latest.weight} kg</Text><Text style={prSt.prStatLbl}>Gewicht</Text></View>
                    <View style={prSt.prStat}><Text style={prSt.prStatVal}>{latest.reps} Wdh.</Text><Text style={prSt.prStatLbl}>Wiederholungen</Text></View>
                    {delta !== null && (
                      <View style={[prSt.deltaChip, { backgroundColor: delta > 0 ? 'rgba(52,199,89,0.12)' : 'rgba(255,69,58,0.12)' }]}>
                        {delta > 0 ? <IconArrowUp color={theme.green} size={12} /> : <IconArrowDown color={theme.red} size={12} />}
                        <Text style={[prSt.deltaText, { color: delta > 0 ? theme.green : theme.red }]}>{delta >= 0 ? '+' : ''}{delta} kg</Text>
                      </View>
                    )}
                  </View>
                  {history.length > 1 && (
                    <View style={{ flexDirection: 'row', gap: 4, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: theme.border, alignItems: 'flex-end' }}>
                      {history.slice(-5).map((entry, ei) => {
                        const maxVal = Math.max(...history.map(e => e.estimated1RM));
                        const pct = maxVal > 0 ? entry.estimated1RM / maxVal : 0;
                        const isLast = ei === history.slice(-5).length - 1;
                        return (
                          <View key={ei} style={{ alignItems: 'center', flex: 1, gap: 3 }}>
                            <View style={{ height: 30, justifyContent: 'flex-end' }}>
                              <View style={{ width: 6, borderRadius: 3, height: Math.max(4, pct*30), backgroundColor: isLast ? theme.orange : theme.cardSecondary }} />
                            </View>
                            <Text style={{ fontSize: 8, color: theme.textTertiary }}>{entry.estimated1RM}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
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

// ─── Workout Detail Screen ────────────────────────────────────
function WorkoutDetailScreen({ item, onClose }: { item: any; onClose: () => void }) {
  const isRun = item._kind === 'run';
  const r = isRun ? item.data as RunData : null;
  const w = !isRun ? item.data as Workout : null;
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
        <View style={{ backgroundColor: '#fff', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: '#F2F2F7' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', marginTop: 4 }} onPress={onClose}>
              <IconChevronLeft color="#000" size={20} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#FF6B00', marginBottom: 3 }}>
                {isRun ? 'Lauf' : 'Kraft'} · {formatDateLabel(item.data.date)}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#000', letterSpacing: -0.5 }}>
                {isRun ? 'Lauftraining' : w?.name}
              </Text>
            </View>
            {!isRun && w?.score !== undefined && (
              <View style={{ backgroundColor: '#FFF4EC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FFD4B0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF6B00' }}>Score {w.score}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isRun && r ? (
              <>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#34C759' }}>{r.distance.toFixed(2)}</Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>km</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A73E8' }}>{formatTime(r.duration)}</Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>Zeit</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF9500' }}>{r.pace}</Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>/km</Text>
                </View>
              </>
            ) : w ? (
              <>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF6B00' }}>{w.exercises?.length ?? 0}</Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>Übungen</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A73E8' }}>{w.exercises?.reduce((s,ex) => s+ex.sets.length,0) ?? 0}</Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>Sets</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F9F9F9', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#7C3AED' }}>
                    {Math.round(w.exercises?.reduce((t,ex) => t+ex.sets.reduce((s,set) => s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0),0) ?? 0).toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 8, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.4 }}>kg Vol.</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
          {!isRun && w?.exercises?.map((exercise, i) => {
            const mc = MUSCLE_COLORS[exercise.muscleGroup] || '#888';
            const best1RM = getBest1RM(exercise.sets);
            return (
              <View key={i} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#E5E5EA' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ backgroundColor: mc+'20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: mc }}>{exercise.muscleGroup}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#000' }}>{exercise.name}</Text>
                  {best1RM > 0 && (
                    <Text style={{ fontSize: 11, color: '#8E8E93' }}>1RM: <Text style={{ color: '#1A73E8', fontWeight: '600' }}>{best1RM} kg</Text></Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
                  <Text style={{ fontSize: 9, color: '#C7C7CC', width: 20, textAlign: 'center', textTransform: 'uppercase' }}>#</Text>
                  <Text style={{ fontSize: 9, color: '#C7C7CC', flex: 1, textAlign: 'center', textTransform: 'uppercase' }}>Wdh.</Text>
                  <Text style={{ fontSize: 9, color: '#C7C7CC', flex: 1, textAlign: 'center', textTransform: 'uppercase' }}>kg</Text>
                  <Text style={{ fontSize: 9, color: '#C7C7CC', flex: 1, textAlign: 'center', textTransform: 'uppercase' }}>1RM</Text>
                </View>
                {exercise.sets.map((set, si) => {
                  const oneRM = calc1RM(parseFloat(set.weight||'0'), parseFloat(set.reps||'0'));
                  const isBest = oneRM === best1RM && best1RM > 0;
                  return (
                    <View key={si} style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#C7C7CC', width: 20, textAlign: 'center' }}>{si+1}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', flex: 1, textAlign: 'center' }}>{set.reps||'—'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#000', flex: 1, textAlign: 'center' }}>{set.weight||'—'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'center', color: isBest ? '#34C759' : '#1A73E8' }}>
                        {oneRM > 0 ? oneRM : '—'}{isBest ? ' ↑' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── History Screen ───────────────────────────────────────────
function HistoryScreen({ onClose, prHistory, onDelete }: {
  onClose: () => void; prHistory: PRHistory; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'alle'|'kraft'|'judo'|'lauf'|'sonstiges'>('alle');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allExercises, setAllExercises] = useState(DEFAULT_EXERCISES);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('workouts').then(r => r && setWorkouts(JSON.parse(r)));
    AsyncStorage.getItem('runs').then(r => r && setRuns(JSON.parse(r)));
  }, []);

  const FILTERS = [
    { key: 'alle', label: 'Alle' }, { key: 'kraft', label: 'Kraft' },
    { key: 'judo', label: 'Judo' }, { key: 'lauf', label: 'Lauf' }, { key: 'sonstiges', label: 'Sonstiges' },
  ] as const;

  type HItem = { _kind: 'workout'; data: Workout } | { _kind: 'run'; data: RunData };
  const allItems: HItem[] = [
    ...workouts.map(w => ({ _kind: 'workout' as const, data: w })),
    ...runs.map(r => ({ _kind: 'run' as const, data: r })),
  ].sort((a,b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  const filtered = allItems.filter(item => {
    if (filter === 'alle') return true;
    if (item._kind === 'run') return filter === 'lauf';
    const t = item.data.type;
    if (filter === 'kraft') return t === 'gym';
    if (filter === 'judo') return t === 'judo';
    if (filter === 'sonstiges') return t === 'manual';
    return true;
  });

  async function handleDelete(item: HItem) {
    Alert.alert('Training löschen', 'Dieses Training wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        if (item._kind === 'workout') {
          const updated = workouts.filter(w => w.id !== item.data.id);
          setWorkouts(updated);
          await AsyncStorage.setItem('workouts', JSON.stringify(updated));
          onDelete(item.data.id);
        } else {
          const updated = runs.filter(r => r.id !== item.data.id);
          setRuns(updated);
          await AsyncStorage.setItem('runs', JSON.stringify(updated));
        }
      }},
    ]);
  }

  const typeConfig: Record<string,{ bg:string; color:string; label:string; border:string }> = {
    gym:    { bg:'#FFF4EC', color:'#FF6B00', label:'Kraft',     border:'#FFD4B0' },
    judo:   { bg:'#EDEAFF', color:'#5E5CE6', label:'Judo',      border:'#C8C3FF' },
    manual: { bg:'#F2F2F7', color:'#8E8E93', label:'Sonstiges', border:'#E5E5EA' },
    run:    { bg:'#EDFAF3', color:'#34C759', label:'Lauf',      border:'#B0ECC8' },
  };

  if (selectedItem) return <WorkoutDetailScreen item={selectedItem} onClose={() => setSelectedItem(null)} />;

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
        <View style={{ backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: '#F2F2F7' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#FF6B00', marginBottom: 4 }}>Training</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#000', letterSpacing: -0.6 }}>Verlauf</Text>
            </View>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
              <IconClose color="#000" size={16} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ backgroundColor: '#FFF4EC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FFD4B0' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF6B00' }}>{workouts.filter(w => w.type==='gym').length} Kraft</Text>
            </View>
            <View style={{ backgroundColor: '#EDFAF3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#B0ECC8' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#34C759' }}>{runs.length} Läufe</Text>
            </View>
            <View style={{ backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E5EA' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E8E93' }}>{allItems.length} Total</Text>
            </View>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F2F2F7' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key}
              style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: filter === f.key ? '#000' : '#F2F2F7' }}
              onPress={() => setFilter(f.key)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: filter === f.key ? '#fff' : '#000' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
                <IconHistory color="#C7C7CC" size={32} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#000' }}>Keine Trainings gefunden</Text>
              <Text style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center' }}>Starte dein erstes Training.</Text>
            </View>
          )}
          {filtered.map((item, i) => {
            const isRun = item._kind === 'run';
            const r = isRun ? item.data as RunData : null;
            const w = !isRun ? item.data as Workout : null;
            const tc = isRun ? typeConfig.run : typeConfig[w?.type ?? 'manual'];
            const totalVolume = w?.exercises?.reduce((t,ex) => t+ex.sets.reduce((s,set) => s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0),0) ?? 0;
            const totalSets = w?.exercises?.reduce((s,ex) => s+ex.sets.length,0) ?? 0;
            const hasPR = !isRun && w?.exercises?.some(ex => (prHistory?.[ex.name]?.length ?? 0) > 0);
            return (
              <TouchableOpacity key={i} activeOpacity={0.88} onPress={() => setSelectedItem(item)}
                style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#E5E5EA' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ backgroundColor: tc.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: tc.border }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tc.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tc.label}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#8E8E93' }}>{formatDateLabel(item.data.date)}</Text>
                  {hasPR && (
                    <View style={{ marginLeft: 'auto' as any, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEA', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FFE066' }}>
                      <IconTrophy color="#F59E0B" size={11} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E' }}>PR</Text>
                    </View>
                  )}
                  {/* Score Badge */}
                  {!isRun && w?.score !== undefined && w.score > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF4EC', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FFD4B0' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#FF6B00' }}>⚡ {w.score}</Text>
                    </View>
                  )}
                  {/* Delete Button */}
                  <TouchableOpacity
                    style={{ marginLeft: 'auto' as any, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF2F2', alignItems: 'center', justifyContent: 'center' }}
                    onPress={e => { e.stopPropagation?.(); handleDelete(item); }}>
                    <IconTrash color="#FF453A" size={14} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: -0.3, marginBottom: 10 }}>
                  {isRun ? 'Lauftraining' : w?.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 5, marginBottom: (!isRun && w?.exercises && w.exercises.length > 0) ? 10 : 0 }}>
                  {isRun && r ? (
                    <>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#34C759' }}>{r.distance.toFixed(1)}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>km</Text></View>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#1A73E8' }}>{formatTime(r.duration)}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>Zeit</Text></View>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#FF9500' }}>{r.pace}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>/km</Text></View>
                    </>
                  ) : (
                    <>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#FF6B00' }}>{w?.duration}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>min</Text></View>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#1A73E8' }}>{Math.round(totalVolume).toLocaleString()}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>kg Vol.</Text></View>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#7C3AED' }}>{totalSets}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>Sets</Text></View>
                      <View style={{ flex:1,backgroundColor:'#F9F9F9',borderRadius:8,padding:7,alignItems:'center' }}><Text style={{ fontSize:13,fontWeight:'700',color:'#34C759' }}>{w?.exercises?.length ?? 0}</Text><Text style={{ fontSize:8,color:'#C7C7CC',textTransform:'uppercase',letterSpacing:0.3 }}>Üb.</Text></View>
                    </>
                  )}
                </View>
                {!isRun && w?.exercises && w.exercises.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {w.exercises.slice(0,2).map((ex,ei) => (
                      <View key={ei} style={{ flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#F2F2F7',borderRadius:20,paddingHorizontal:10,paddingVertical:4 }}>
                        <View style={{ width:6,height:6,borderRadius:3,backgroundColor:MUSCLE_COLORS[ex.muscleGroup]||'#888' }} />
                        <Text style={{ fontSize:11,color:'#3C3C43',fontWeight:'500' }}>{ex.name}</Text>
                      </View>
                    ))}
                    {w.exercises.length > 2 && (
                      <View style={{ backgroundColor:'#F2F2F7',borderRadius:20,paddingHorizontal:10,paddingVertical:4 }}>
                        <Text style={{ fontSize:11,color:'#8E8E93',fontWeight:'500' }}>+{w.exercises.length-2} weitere</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Trainingsplan Screen ─────────────────────────────────────
const PLAN_STORE_KEY = 'trainingPlanConfig';
const PLAN_WEEK_KEY = 'trainingPlanWeek'; // ISO week number when plan was last generated

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return `${d.getFullYear()}-W${String(1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const FULL_DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

type PlanConfig = {
  exercises: string[];
  trainingDays: number[]; // 0=Mo ... 6=So
  goal: string;
  generatedWeek: string;
};

type PlanDay = {
  dayIdx: number;
  dayLabel: string;
  name: string;
  focus: string;
  exercises: { name: string; sets: number; reps: string; weight: number }[];
};

function buildPlan(config: PlanConfig, userMaxes: UserMaxes): PlanDay[] {
  const { exercises, trainingDays, goal } = config;
  const intensity = goal === 'kraft' ? 0.85 : goal === 'ausdauer' ? 0.6 : 0.72;
  const repsRange = goal === 'kraft' ? '3–5' : goal === 'ausdauer' ? '15–20' : '8–12';
  const setsCount = goal === 'kraft' ? 5 : goal === 'ausdauer' ? 3 : 4;

  function w(name: string) {
    const max = userMaxes[name] || 0;
    if (!max) return 0;
    return Math.round((max * intensity) / 2.5) * 2.5;
  }

  // Group exercises by muscle group
  const byMuscle: Record<string, string[]> = {};
  for (const ex of exercises) {
    const found = DEFAULT_EXERCISES.find(d => d.name === ex);
    const mg = found?.muscleGroup ?? 'Ganzkörper';
    if (!byMuscle[mg]) byMuscle[mg] = [];
    byMuscle[mg].push(ex);
  }

  const muscleGroups = Object.keys(byMuscle);
  const numDays = trainingDays.length;

  // Split muscle groups across training days
  const splitPerDay: { muscles: string[]; exs: string[] }[] = Array.from({ length: numDays }, () => ({ muscles: [], exs: [] }));
  muscleGroups.forEach((mg, i) => {
    const dayIdx = i % numDays;
    splitPerDay[dayIdx].muscles.push(mg);
    splitPerDay[dayIdx].exs.push(...byMuscle[mg]);
  });

  // Build full week
  const plan: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const trainingIdx = trainingDays.indexOf(i);
    if (trainingIdx === -1) {
      return { dayIdx: i, dayLabel: DAY_NAMES[i], name: 'Pause', focus: 'Regeneration', exercises: [] };
    }
    const { muscles, exs } = splitPerDay[trainingIdx];
    return {
      dayIdx: i,
      dayLabel: DAY_NAMES[i],
      name: muscles.slice(0, 2).join(' & ') || 'Training',
      focus: muscles.join(' · ') || 'Ganzkörper',
      exercises: exs.map(ex => ({
        name: ex,
        sets: setsCount,
        reps: repsRange,
        weight: w(ex),
      })),
    };
  });

  return plan;
}

function TrainingPlanScreen({ onClose, userMaxes, allExercises }: {
  onClose: () => void;
  userMaxes: UserMaxes;
  allExercises: typeof DEFAULT_EXERCISES;
}) {
  const hasPRs = Object.keys(userMaxes).length > 0;
  const currentWeek = getISOWeek(new Date());
  const isMonday = new Date().getDay() === 1;

  // Steps: 'loading' | 'exercises' | 'days' | 'plan'
  const [step, setStep] = useState<'loading' | 'exercises' | 'days' | 'plan'>('loading');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [goal, setGoal] = useState('hypertrophie');
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [config, setConfig] = useState<PlanConfig | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PLAN_STORE_KEY).then(raw => {
      if (!raw) { setStep('exercises'); return; }
      const saved: PlanConfig = JSON.parse(raw);
      // Re-ask every Monday
      if (isMonday && saved.generatedWeek !== currentWeek) {
        setSelectedExercises(saved.exercises);
        setSelectedDays(saved.trainingDays);
        setGoal(saved.goal);
        setStep('exercises');
      } else {
        setConfig(saved);
        setPlan(buildPlan(saved, userMaxes));
        setStep('plan');
      }
    });
  }, []);

  async function savePlan() {
    const cfg: PlanConfig = { exercises: selectedExercises, trainingDays: selectedDays, goal, generatedWeek: currentWeek };
    await AsyncStorage.setItem(PLAN_STORE_KEY, JSON.stringify(cfg));
    setConfig(cfg);
    setPlan(buildPlan(cfg, userMaxes));
    setStep('plan');
  }

  async function resetPlan() {
    await AsyncStorage.removeItem(PLAN_STORE_KEY);
    setSelectedExercises([]); setSelectedDays([]); setGoal('hypertrophie');
    setStep('exercises');
  }

  function toggleExercise(name: string) {
    setSelectedExercises(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]);
  }
  function toggleDay(i: number) {
    setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort());
  }

  const goals = [
    { key: 'hypertrophie', label: 'Muskelaufbau', emoji: '💪', desc: '8–12 Wdh., 72% 1RM' },
    { key: 'kraft', label: 'Stärker werden', emoji: '🏋️', desc: '3–5 Wdh., 85% 1RM' },
    { key: 'ausdauer', label: 'Ausdauer', emoji: '🏃', desc: '15–20 Wdh., 60% 1RM' },
  ];

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>

        {/* Header */}
        <View style={hist.header}>
          <View>
            <Text style={hist.eyebrow}>
              {step === 'exercises' ? 'Schritt 1/3' : step === 'days' ? 'Schritt 2/3' : 'Dein Plan'}
            </Text>
            <Text style={hist.title}>
              {step === 'exercises' ? 'Übungen wählen' : step === 'days' ? 'Trainingstage' : 'Trainingsplan'}
            </Text>
          </View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose}>
            <IconClose color={theme.textPrimary} size={16} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        {step !== 'plan' && step !== 'loading' && (
          <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
            {['exercises', 'days', 'goal'].map((s, i) => (
              <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: ['exercises','days','goal'].indexOf(step) >= i ? theme.orange : theme.cardSecondary }} />
            ))}
          </View>
        )}

        {/* ── Step 1: Übungen ── */}
        {step === 'exercises' && (
          <>
            {!hasPRs && (
              <View style={{ backgroundColor: 'rgba(232,87,42,0.1)', margin: 16, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.orange + '40' }}>
                <Text style={{ color: theme.orange, fontSize: 13, fontWeight: '600', marginBottom: 2 }}>⚠️ Keine PRs vorhanden</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Für Gewichtsempfehlungen trag zuerst PRs ein.</Text>
              </View>
            )}
            <Text style={{ color: theme.textSecondary, fontSize: 12, paddingHorizontal: 16, marginBottom: 8, marginTop: hasPRs ? 12 : 0 }}>
              Welche Übungen sollen im Plan berücksichtigt werden? ({selectedExercises.length} gewählt)
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
              {MUSCLE_GROUPS.map(mg => {
                const exs = allExercises.filter(e => e.muscleGroup === mg);
                if (exs.length === 0) return null;
                return (
                  <View key={mg} style={{ marginBottom: 16 }}>
                    <Text style={{ color: MUSCLE_COLORS[mg], fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{mg}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {exs.map(ex => {
                        const active = selectedExercises.includes(ex.name);
                        return (
                          <TouchableOpacity key={ex.name}
                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? theme.orangeLight : theme.card, borderWidth: 1.5, borderColor: active ? theme.orange : theme.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            onPress={() => toggleExercise(ex.name)} activeOpacity={0.8}>
                            {active && <Text style={{ fontSize: 10, color: theme.orange }}>✓</Text>}
                            <Text style={{ fontSize: 13, color: active ? theme.orange : theme.textPrimary, fontWeight: active ? '600' : '400' }}>{ex.name}</Text>
                            {userMaxes[ex.name] && <Text style={{ fontSize: 9, color: theme.green }}>PR</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 34, backgroundColor: theme.bg, borderTopWidth: 0.5, borderTopColor: theme.border }}>
              <TouchableOpacity
                style={{ backgroundColor: selectedExercises.length > 0 ? theme.orange : theme.cardSecondary, borderRadius: 14, padding: 15, alignItems: 'center' }}
                onPress={() => selectedExercises.length > 0 && setStep('days')}
                activeOpacity={0.85}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: selectedExercises.length > 0 ? '#fff' : theme.textTertiary }}>
                  Weiter → {selectedExercises.length > 0 ? `${selectedExercises.length} Übungen` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step 2: Trainingstage ── */}
        {step === 'days' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 20 }}>
              An welchen Tagen kannst du trainieren? ({selectedDays.length} Tage gewählt)
            </Text>
            <View style={{ gap: 8, marginBottom: 24 }}>
              {DAY_NAMES.map((d, i) => {
                const active = selectedDays.includes(i);
                return (
                  <TouchableOpacity key={i}
                    style={{ backgroundColor: active ? theme.orangeLight : theme.card, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: active ? theme.orange : theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                    onPress={() => toggleDay(i)} activeOpacity={0.85}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: active ? theme.orange : theme.cardSecondary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#fff' : theme.textTertiary }}>{d}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: active ? theme.textPrimary : theme.textSecondary }}>{FULL_DAY_NAMES[i]}</Text>
                    {active && <IconCheck color={theme.orange} size={18} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, fontWeight: '600' }}>Ziel</Text>
            <View style={{ gap: 8, marginBottom: 24 }}>
              {goals.map(g => (
                <TouchableOpacity key={g.key}
                  style={{ backgroundColor: goal === g.key ? theme.orangeLight : theme.card, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: goal === g.key ? theme.orange : theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  onPress={() => setGoal(g.key)} activeOpacity={0.85}>
                  <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>{g.label}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>{g.desc}</Text>
                  </View>
                  {goal === g.key && <IconCheck color={theme.orange} size={16} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border }} onPress={() => setStep('exercises')} activeOpacity={0.85}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>← Zurück</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: selectedDays.length > 0 ? theme.orange : theme.cardSecondary, borderRadius: 14, padding: 15, alignItems: 'center' }}
                onPress={() => selectedDays.length > 0 && savePlan()} activeOpacity={0.85}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: selectedDays.length > 0 ? '#fff' : theme.textTertiary }}>Plan erstellen ✓</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Plan anzeigen ── */}
        {step === 'plan' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            {isMonday && (
              <View style={{ backgroundColor: theme.blueLight, borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.blue + '40', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.blue, fontSize: 13, fontWeight: '600' }}>Neue Woche!</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>Der Plan wurde für diese Woche aktualisiert.</Text>
                </View>
              </View>
            )}

            {plan.map((day, i) => (
              <View key={i} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: day.exercises.length > 0 ? theme.orange + '40' : theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: day.exercises.length > 0 ? 12 : 0 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: day.exercises.length > 0 ? theme.orangeLight : theme.cardSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: day.exercises.length > 0 ? theme.orange + '40' : theme.border }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: day.exercises.length > 0 ? theme.orange : theme.textTertiary }}>{day.dayLabel}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textPrimary }}>{day.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>{day.focus}</Text>
                  </View>
                  {day.exercises.length > 0 && (
                    <View style={{ backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.orange + '40' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.orange }}>{day.exercises.length} Üb.</Text>
                    </View>
                  )}
                </View>
                {day.exercises.map((ex, ei) => (
                  <View key={ei} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: theme.border }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: MUSCLE_COLORS[DEFAULT_EXERCISES.find(d => d.name === ex.name)?.muscleGroup ?? ''] ?? theme.orange }} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{ex.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{ex.sets}×{ex.reps}</Text>
                    {ex.weight > 0 && (
                      <View style={{ backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.orange + '40' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.orange }}>{ex.weight} kg</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border }} onPress={resetPlan} activeOpacity={0.85}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Plan neu erstellen</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 12, marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', lineHeight: 16 }}>
                Empfehlung basierend auf deinen PRs und gewählten Übungen. Jeden Montag wird der Plan aktualisiert.
              </Text>
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Free Workout Start Screen ────────────────────────────────
function FreeWorkoutStartScreen({ onStart, onStartWithRecommendation, lastWorkout, onBack }: {
  onStart: () => void; onStartWithRecommendation: () => void; lastWorkout: Workout | null; onBack: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={startSt.header}>
        <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
        <View><Text style={startSt.eyebrow}>Krafttraining</Text><Text style={startSt.title}>Freies Training</Text></View>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {lastWorkout && (
          <TouchableOpacity style={startSt.recCard} onPress={onStartWithRecommendation} activeOpacity={0.88}>
            <View style={startSt.recBadgeRow}><View style={startSt.recDot} /><Text style={startSt.recBadgeText}>Empfehlung für heute</Text></View>
            <Text style={startSt.recTitle}>{lastWorkout.name}</Text>
            <Text style={startSt.recSub}>{lastWorkout.exercises.slice(0,3).map(e=>e.name).join(' · ')}{lastWorkout.exercises.length > 3 ? ` · +${lastWorkout.exercises.length-3}` : ''}</Text>
            <View style={startSt.recBtn}><Text style={startSt.recBtnText}>Mit Empfehlung starten</Text></View>
          </TouchableOpacity>
        )}
        <View style={startSt.emptyCard}>
          <Text style={startSt.emptyCardTitle}>Leeres Training</Text>
          <Text style={startSt.emptyCardSub}>Selbst Übungen zusammenstellen</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
      {/* SwipeToStart ausserhalb der ScrollView – kein Konflikt */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 140 }}>
        <SwipeToStart onStart={onStart} />
      </View>
    </View>
  );
}

// ─── Routine Screen ───────────────────────────────────────────
function RoutineScreen({ routines, onSelectRoutine, onCreateRoutine, onUpdateRoutine, onDeleteRoutine, onBack }: {
  routines: Routine[];
  onSelectRoutine: (r: Routine) => void;
  onCreateRoutine: (r: Routine) => void;
  onUpdateRoutine: (r: Routine) => void;
  onDeleteRoutine: (id: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'meine'|'suchen'>('meine');
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState<'create'|'edit'>('create');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExercises, setNewExercises] = useState<{ name: string; muscleGroup: string; defaultSets: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const communityFiltered = COMMUNITY_ROUTINES.filter(r => search === '' || r.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() { setEditMode('create'); setNewName(''); setNewExercises([]); setEditingRoutine(null); setShowForm(true); }
  function openEdit(r: Routine) { setEditMode('edit'); setNewName(r.name); setNewExercises([...r.exercises]); setEditingRoutine(r); setShowForm(true); }

  function saveForm() {
    if (!newName.trim()) { Alert.alert('Bitte Namen eingeben'); return; }
    if (newExercises.length === 0) { Alert.alert('Bitte mindestens eine Übung hinzufügen'); return; }
    if (editMode === 'create') {
      onCreateRoutine({ id: Date.now().toString(), name: newName.trim(), exercises: newExercises });
    } else if (editingRoutine) {
      onUpdateRoutine({ ...editingRoutine, name: newName.trim(), exercises: newExercises });
    }
    setShowForm(false);
  }

  if (showForm) {
    return (
      <>
        {showPicker && <ExercisePicker allExercises={DEFAULT_EXERCISES} onSelect={(name,muscleGroup) => { setNewExercises(prev => [...prev,{ name,muscleGroup,defaultSets:3 }]); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
        <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} showsVerticalScrollIndicator={false}>
          <View style={startSt.header}>
            <TouchableOpacity onPress={() => setShowForm(false)} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
            <View>
              <Text style={startSt.eyebrow}>{editMode === 'create' ? 'Neue Routine' : 'Routine bearbeiten'}</Text>
              <Text style={startSt.title}>{editMode === 'create' ? 'Erstellen' : newName}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={s.inputLabel}>Name der Routine</Text>
            <TextInput style={[s.input,{ marginBottom:20 }]} value={newName} onChangeText={setNewName} placeholder="z.B. Push Day" placeholderTextColor={theme.textTertiary} />
            <Text style={s.inputLabel}>Übungen ({newExercises.length})</Text>
            {newExercises.length > 0 && (
              <View style={startSt.exListCard}>
                {newExercises.map((ex,i) => (
                  <View key={i} style={[startSt.exRow, i < newExercises.length-1 && startSt.exRowBorder]}>
                    <View style={[startSt.exDot,{ backgroundColor:MUSCLE_COLORS[ex.muscleGroup]||'#888' }]} />
                    <Text style={startSt.exName}>{ex.name}</Text>
                    <TouchableOpacity onPress={() => setNewExercises(prev => prev.filter((_,idx) => idx !== i))}><IconClose color={theme.textTertiary} size={14} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={startSt.addExBtn} onPress={() => setShowPicker(true)}>
              <IconPlus color={theme.orange} size={16} /><Text style={startSt.addExBtnText}>Übung hinzufügen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn,{ marginTop:20 }]} onPress={saveForm} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>{editMode === 'create' ? 'Routine speichern' : 'Änderungen speichern'}</Text>
            </TouchableOpacity>
            <View style={{ height: 80 }} />
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} showsVerticalScrollIndicator={false}>
      <View style={startSt.header}>
        <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
        <View><Text style={startSt.eyebrow}>Krafttraining</Text><Text style={startSt.title}>Routinen</Text></View>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={routineSt.tabRow}>
          <TouchableOpacity style={[routineSt.tabBtn, tab==='meine' && routineSt.tabBtnActive]} onPress={() => setTab('meine')}>
            <Text style={[routineSt.tabBtnText, tab==='meine' && routineSt.tabBtnTextActive]}>Meine Routinen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[routineSt.tabBtn, tab==='suchen' && routineSt.tabBtnActive]} onPress={() => setTab('suchen')}>
            <Text style={[routineSt.tabBtnText, tab==='suchen' && routineSt.tabBtnTextActive]}>Entdecken</Text>
          </TouchableOpacity>
        </View>
        {tab === 'meine' ? (
          <>
            <TouchableOpacity style={routineSt.createBtn} onPress={openCreate} activeOpacity={0.85}>
              <View style={routineSt.createBtnIcon}><IconPlus color={theme.orange} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={routineSt.createBtnTitle}>Neue Routine erstellen</Text>
                <Text style={routineSt.createBtnSub}>Übungen selbst zusammenstellen</Text>
              </View>
              <IconChevronRight color={theme.textTertiary} size={18} />
            </TouchableOpacity>
            {routines.length === 0 ? (
              <View style={startSt.emptyState}>
                <IconDumbbell color={theme.textTertiary} size={36} />
                <Text style={startSt.emptyStateTitle}>Noch keine Routinen</Text>
                <Text style={startSt.emptyStateSub}>Erstelle deine erste Routine oder entdecke vorhandene.</Text>
              </View>
            ) : routines.map(r => (
              <View key={r.id} style={[startSt.routineCard, { paddingRight: 8 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectRoutine(r)} activeOpacity={0.85}>
                  <Text style={startSt.routineName}>{r.name}</Text>
                  <Text style={startSt.routineMeta}>{r.exercises.map(e=>e.name).slice(0,3).join(' · ')}{r.exercises.length > 3 ? ` · +${r.exercises.length-3}` : ''}</Text>
                  <View style={startSt.routineChipRow}>
                    <View style={startSt.routineChip}><Text style={startSt.routineChipText}>{r.exercises.length} Übungen</Text></View>
                  </View>
                </TouchableOpacity>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity onPress={() => openEdit(r)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.blueLight, alignItems: 'center', justifyContent: 'center' }}>
                    <IconPencil color={theme.blue} size={14} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Alert.alert('Löschen', `"${r.name}" löschen?`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => onDeleteRoutine(r.id) }])}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,69,58,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <IconTrash color={theme.red} size={14} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={routineSt.searchBox}>
              <IconSearch color={theme.textTertiary} size={18} />
              <TextInput style={routineSt.searchInput} placeholder="Routine suchen..." placeholderTextColor={theme.textTertiary} value={search} onChangeText={setSearch} />
            </View>
            {communityFiltered.map(r => (
              <TouchableOpacity key={r.id} style={startSt.routineCard} onPress={() => onSelectRoutine(r)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection:'row',alignItems:'center',gap:8,marginBottom:4 }}>
                    <Text style={startSt.routineName}>{r.name}</Text>
                    <View style={routineSt.communityBadge}><Text style={routineSt.communityBadgeText}>Community</Text></View>
                  </View>
                  <Text style={startSt.routineMeta}>{r.exercises.map(e=>e.name).slice(0,3).join(' · ')}{r.exercises.length > 3 ? ` · +${r.exercises.length-3}` : ''}</Text>
                  <View style={startSt.routineChipRow}>
                    <View style={startSt.routineChip}><Text style={startSt.routineChipText}>{r.exercises.length} Übungen</Text></View>
                  </View>
                </View>
                <IconChevronRight color={theme.textTertiary} size={18} />
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
}

// ─── Routine Detail Screen ────────────────────────────────────
function RoutineDetailScreen({ routine, onStart, onBack }: {
  routine: Routine; onStart: (r: Routine) => void; onBack: () => void;
}) {
  const [extraExercises, setExtraExercises] = useState<{ name: string; muscleGroup: string; defaultSets: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const allEx = [...routine.exercises, ...extraExercises];
  const modifiedRoutine: Routine = { ...routine, exercises: allEx };

  return (
    <>
      {showPicker && <ExercisePicker allExercises={DEFAULT_EXERCISES} onSelect={(name,muscleGroup) => { setExtraExercises(prev => [...prev,{ name,muscleGroup,defaultSets:3 }]); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
      <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} showsVerticalScrollIndicator={false}>
        <View style={startSt.header}>
          <TouchableOpacity onPress={onBack} style={startSt.backBtn}><IconChevronLeft color={theme.textSecondary} size={22} /></TouchableOpacity>
          <View><Text style={startSt.eyebrow}>Routine</Text><Text style={startSt.title}>{routine.name}</Text><Text style={{ fontSize:12,color:theme.textTertiary,marginTop:3 }}>{allEx.length} Übungen</Text></View>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={startSt.exListCard}>
            {allEx.map((ex,i) => (
              <View key={i} style={[startSt.exRow, i < allEx.length-1 && startSt.exRowBorder]}>
                <View style={[startSt.exDot,{ backgroundColor:MUSCLE_COLORS[ex.muscleGroup]||'#888' }]} />
                <Text style={startSt.exName}>{ex.name}</Text>
                <Text style={{ fontSize:11,color:theme.textTertiary }}>{ex.muscleGroup}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={startSt.addExBtn} onPress={() => setShowPicker(true)}>
            <IconPlus color={theme.orange} size={16} /><Text style={startSt.addExBtnText}>Übung hinzufügen</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 12, marginBottom: 40 }}><SwipeToStart onStart={() => onStart(modifiedRoutine)} /></View>
        </View>
      </ScrollView>
    </>
  );
}

// ─── Active Gym Workout ───────────────────────────────────────
function ActiveGymWorkout({ workout, userMaxes, prHistory, lastWorkoutData, onUpdate, onFinish }: {
  workout: Workout; userMaxes: UserMaxes; prHistory: PRHistory;
  lastWorkoutData: Record<string, WorkoutSet[]>; onUpdate: (w: Workout) => void; onFinish: () => void;
}) {
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [dismissedPRWarnings, setDismissedPRWarnings] = useState<globalThis.Set<string>>(new globalThis.Set());
  const workoutTimer = useWorkoutTimer('gymWorkoutTimer');
  const restTimer = useRestTimer();
  const [allExercises, setAllExercises] = useState(DEFAULT_EXERCISES);

  useEffect(() => {
    AsyncStorage.getItem('userExercises').then(r => r && setAllExercises(JSON.parse(r)));
    // Start timer if not already running
    if (!workoutTimer.isRunning) {
      workoutTimer.startNow();
    }
  }, []);

  async function addExercise(name: string, muscleGroup: string) {
    const lastSets = lastWorkoutData[name];
    const sets = lastSets ? lastSets.map(() => ({ reps:'',weight:'' })) : [{ reps:'',weight:'' }];
    const updated = { ...workout, exercises: [...workout.exercises,{ id:Date.now().toString(),name,muscleGroup,sets }] };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
    setShowExercisePicker(false);
    if (!allExercises.find(e => e.name === name)) {
      const newAll = [...allExercises,{ name,muscleGroup }];
      setAllExercises(newAll);
      await AsyncStorage.setItem('userExercises', JSON.stringify(newAll));
    }
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps'|'weight', value: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const newSets = [...ex.sets]; newSets[setIndex] = { ...newSets[setIndex],[field]:value }; return { ...ex,sets:newSets };
    }) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const prev = ex.sets[ex.sets.length-1];
      return { ...ex,sets:[...ex.sets,{ reps:'',weight:prev?.weight||'' }] };
    }) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    const updated = { ...workout, exercises: workout.exercises.filter(ex => ex.id !== exerciseId) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function handleFinish() {
    await workoutTimer.stop();
    onFinish();
  }

  const totalSets = workout.exercises.reduce((s,ex) => s+ex.sets.length, 0);
  const totalVolume = workout.exercises.reduce((t,ex) => t+ex.sets.reduce((s,set) => s+parseFloat(set.reps||'0')*parseFloat(set.weight||'0'),0), 0);

  return (
    <>
      {showExercisePicker && <ExercisePicker allExercises={allExercises} onSelect={addExercise} onClose={() => setShowExercisePicker(false)} />}
      <ScrollView style={{ flex:1,backgroundColor:theme.bg }} showsVerticalScrollIndicator={false}>
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
        <View style={active.statsRow}>
          {[
            { val: workout.exercises.length, lbl: 'Übungen', color: theme.orange },
            { val: totalSets, lbl: 'Sets', color: theme.green },
            { val: Math.round(totalVolume), lbl: 'kg Vol.', color: theme.blue },
          ].map(stat => (
            <View key={stat.lbl} style={active.statBox}>
              <Text style={[active.statVal,{ color:stat.color }]}>{stat.val}</Text>
              <Text style={active.statLbl}>{stat.lbl}</Text>
            </View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          {/* Rest Timer */}
          <View style={[active.pauseCard,{ borderLeftColor:restTimer.isRunning ? theme.orange : theme.cardSecondary }]}>
            <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'center' }}>
              <View>
                <Text style={[active.pauseLabel,{ color:restTimer.isRunning ? theme.orange : theme.textTertiary }]}>
                  {restTimer.isRunning ? 'Pause läuft' : 'Pause starten'}
                </Text>
                {restTimer.isRunning && <Text style={active.pauseTimer}>{formatTime(restTimer.seconds)}</Text>}
              </View>
              <View style={{ flexDirection:'row',gap:6 }}>
                {[60,90,120,180].map(sec => (
                  <TouchableOpacity key={sec} style={[active.pauseBtn, restTimer.isRunning && { borderColor:theme.orange }]}
                    onPress={() => restTimer.isRunning ? restTimer.stop() : restTimer.startFor(sec)}>
                    <Text style={[active.pauseBtnText, restTimer.isRunning && { color:theme.orange }]}>{sec < 120 ? `${sec}s` : `${sec/60}m`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {restTimer.isRunning && (
              <View style={{ height:3,backgroundColor:theme.cardSecondary,borderRadius:2,marginTop:10 }}>
                <View style={{ height:3,borderRadius:2,backgroundColor:restTimer.pct > 0.3 ? theme.green : restTimer.pct > 0.1 ? theme.orange : theme.red, width:`${restTimer.pct*100}%` as any }} />
              </View>
            )}
          </View>

          {workout.exercises.map(exercise => {
            const hasPR = !!(prHistory[exercise.name]?.length) || !!(userMaxes[exercise.name]);
            const isDismissed = dismissedPRWarnings.has(exercise.id);
            const best1RM = getBest1RM(exercise.sets);
            const userMax = userMaxes[exercise.name];
            const pctOfMax = userMax && best1RM > 0 ? Math.round((best1RM/userMax)*100) : null;
            const lastSets = lastWorkoutData[exercise.name];
            const mc = MUSCLE_COLORS[exercise.muscleGroup] || '#888';
            const recText = userMax ? `Empfehlung: 4 × 8 @ ${Math.round((userMax*0.75)/2.5)*2.5} kg` : null;
            return (
              <View key={exercise.id} style={active.exerciseCard}>
                <View style={{ flexDirection:'row',alignItems:'center',gap:10,marginBottom:10 }}>
                  <View style={[active.musclePill,{ backgroundColor:mc+'22' }]}>
                    <Text style={[active.musclePillText,{ color:mc }]}>{exercise.muscleGroup}</Text>
                  </View>
                  <Text style={active.exerciseName}>{exercise.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(exercise.id)}><IconClose color={theme.textTertiary} size={16} /></TouchableOpacity>
                </View>
                {!hasPR && !isDismissed && (
                  <View style={active.prWarn}>
                    <Text style={active.prWarnTitle}>Kein PR für {exercise.name}</Text>
                    <View style={{ flexDirection:'row',gap:6,marginTop:8 }}>
                      <TouchableOpacity style={active.prWarnBtn} onPress={() => setDismissedPRWarnings((prev: globalThis.Set<string>) => new globalThis.Set(prev).add(exercise.id))}>
                        <Text style={active.prWarnBtnText}>Trotzdem machen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[active.prWarnBtn,{ borderColor:theme.orange }]} onPress={() => { removeExercise(exercise.id); setShowExercisePicker(true); }}>
                        <Text style={[active.prWarnBtnText,{ color:theme.orange }]}>Übung wechseln</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {recText && (() => {
  const recWeight = userMax ? String(Math.round((userMax * 0.75) / 2.5) * 2.5) : '';
  const recReps = '8';
  return (
    <TouchableOpacity
      style={active.recRow}
      onPress={async () => {
  const recSets = 4;
  const newSets = Array.from(
    { length: Math.max(exercise.sets.length, recSets) },
    () => ({ reps: recReps, weight: recWeight })
  );
  const updated = {
    ...workout,
    exercises: workout.exercises.map(ex =>
      ex.id !== exercise.id ? ex : { ...ex, sets: newSets }
    ),
  };
  onUpdate(updated);
  await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
}}
      activeOpacity={0.75}
    >
      <Text style={active.recText}>💡 {recText}</Text>
      <Text style={{ fontSize: 10, color: theme.blue, fontWeight: '600', marginTop: 3 }}>
        Tippen zum Übernehmen →
      </Text>
    </TouchableOpacity>
  );
})()}
                {lastSets && (
                  <View style={active.lastRow}>
                    <Text style={active.lastLabel}>Letztes Mal: </Text>
                    <Text style={active.lastVal}>{lastSets.map(ls => `${ls.weight}kg×${ls.reps}`).join(' · ')}</Text>
                  </View>
                )}
                {best1RM > 0 && (
                  <View style={{ flexDirection:'row',gap:12,marginBottom:10 }}>
                    <Text style={active.oneRM}>Est. 1RM: <Text style={{ color:theme.orange,fontWeight:'600' }}>{best1RM} kg</Text></Text>
                    {pctOfMax && <Text style={active.oneRM}>% Max: <Text style={{ color:pctOfMax>=100?theme.green:pctOfMax>=85?theme.orange:theme.textSecondary,fontWeight:'600' }}>{pctOfMax}%</Text></Text>}
                  </View>
                )}
                <View style={{ flexDirection:'row',gap:8,marginBottom:8 }}>
                  <Text style={[active.setHeaderText,{ width:24 }]}>#</Text>
                  <Text style={[active.setHeaderText,{ flex:1 }]}>Wdh.</Text>
                  <Text style={[active.setHeaderText,{ flex:1 }]}>kg</Text>
                </View>
                {exercise.sets.map((set,si) => {
                  const filled = set.reps !== '' && set.weight !== '';
                  return (
                    <View key={si} style={active.setRow}>
                      <Text style={active.setNumber}>{si+1}</Text>
                      <TextInput style={[active.setInput, filled && { borderColor:'rgba(52,199,89,0.4)',color:theme.green }]}
                        placeholder={lastSets?.[si]?.reps||'0'} placeholderTextColor={theme.textTertiary}
                        value={set.reps} onChangeText={v => updateSet(exercise.id,si,'reps',v)} keyboardType="numeric" />
                      <TextInput style={[active.setInput, filled && { borderColor:'rgba(52,199,89,0.4)',color:theme.green }]}
                        placeholder={lastSets?.[si]?.weight||'0'} placeholderTextColor={theme.textTertiary}
                        value={set.weight} onChangeText={v => updateSet(exercise.id,si,'weight',v)} keyboardType="decimal-pad" />
                    </View>
                  );
                })}
                <TouchableOpacity style={active.addSetBtn} onPress={() => addSet(exercise.id)}>
                  <Text style={active.addSetBtnText}>+ Set hinzufügen</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity style={active.addExerciseBtn} onPress={() => setShowExercisePicker(true)}>
            <IconPlus color={theme.orange} size={18} /><Text style={active.addExerciseBtnText}>Übung hinzufügen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={active.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={active.finishBtnText}>Training abschliessen</Text>
          </TouchableOpacity>
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>
    </>
  );
}

// ─── Run Screen ───────────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const runTimer = useWorkoutTimer('activeRunTimer');
  const [manualDist, setManualDist] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!runTimer.isRunning) runTimer.startNow();
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, []);

  const dist = parseFloat(manualDist) || 0;
  const paceSeconds = dist > 0 ? runTimer.seconds / dist : 0;
  const estimatedCalories = parseInt(calories) || Math.round(runTimer.seconds / 60 * 8);

  async function finishRun() {
    await runTimer.stop();
    const dur = runTimer.getDuration() * 60;
    const runData: RunData = {
      id: Date.now().toString(), distance: dist, duration: dur,
      pace: formatPace(dist > 0 ? dur / dist : 0),
      calories: estimatedCalories, heartRate: parseInt(heartRate) || 0,
      date: new Date().toISOString(),
    };
    const raw = await AsyncStorage.getItem('runs');
    const runs = raw ? JSON.parse(raw) : [];
    runs.push(runData);
    await AsyncStorage.setItem('runs', JSON.stringify(runs));
    await AsyncStorage.removeItem('activeWorkout');
    Alert.alert('Lauf abgeschlossen!', `${dist.toFixed(2)} km · ${formatTime(dur)} · ${formatPace(dist > 0 ? dur / dist : 0)} /km`,
      [{ text: 'OK', onPress: onStop }]);
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.headerLabel}>Lauf</Text>
      <Animated.View style={[s.runTimerCard, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={s.runTimerLabel}>LAUFZEIT</Text>
        <Text style={s.runTimerDisplay}>{formatTime(runTimer.seconds)}</Text>
      </Animated.View>
      <View style={s.runStatsGrid}>
        {[
          { val: dist.toFixed(2), lbl: 'km',       color: theme.green },
          { val: formatPace(paceSeconds), lbl: '/km Pace', color: theme.blue },
          { val: String(estimatedCalories), lbl: 'kcal',   color: theme.orange },
          { val: heartRate || '--', lbl: 'bpm',     color: theme.pink },
        ].map(stat => (
          <View key={stat.lbl} style={s.runStatCard}>
            <Text style={[s.runStatVal, { color: stat.color }]}>{stat.val}</Text>
            <Text style={s.runStatLbl}>{stat.lbl}</Text>
          </View>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Daten eingeben</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Distanz (km)', value: manualDist, setter: setManualDist, kb: 'decimal-pad' as const, ph: '0.00' },
            { label: 'Herzfrequenz', value: heartRate, setter: setHeartRate, kb: 'numeric' as const, ph: 'bpm' },
            { label: 'Kalorien', value: calories, setter: setCalories, kb: 'numeric' as const, ph: 'kcal' },
          ].map(f => (
            <View key={f.label} style={{ flex: 1 }}>
              <Text style={s.inputLabel}>{f.label}</Text>
              <TextInput style={s.input} value={f.value} onChangeText={f.setter} keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={theme.textTertiary} />
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.finishRunBtn} onPress={finishRun} activeOpacity={0.85}>
        <Text style={s.finishRunBtnText}>Lauf beenden</Text>
      </TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
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
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string,WorkoutSet[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allExercises, setAllExercises] = useState(DEFAULT_EXERCISES);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue:1,duration:350,useNativeDriver:true }).start();
  }, []));

  async function loadAll() {
    const rawEx = await AsyncStorage.getItem('userExercises');
if (rawEx) setAllExercises(JSON.parse(rawEx));
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const ws: Workout[] = JSON.parse(rawW);
      setWorkouts(ws);
      const lastData: Record<string,WorkoutSet[]> = {};
      [...ws].reverse().forEach(w => w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; }));
      setLastWorkoutData(lastData);
    }
    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w: Workout = JSON.parse(rawActive);
      if (isToday(w.date)) { if (w.type === 'run') setActiveRun(true); else setActiveWorkout(w); }
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

  async function saveRoutine(r: Routine) {
    const updated = [...routines, r];
    setRoutines(updated);
    await AsyncStorage.setItem('routines', JSON.stringify(updated));
  }

  async function updateRoutine(r: Routine) {
    const updated = routines.map(x => x.id === r.id ? r : x);
    setRoutines(updated);
    await AsyncStorage.setItem('routines', JSON.stringify(updated));
  }

  async function deleteRoutine(id: string) {
    const updated = routines.filter(r => r.id !== id);
    setRoutines(updated);
    await AsyncStorage.setItem('routines', JSON.stringify(updated));
  }

  async function savePR(exerciseName: string, weight: number, reps: number) {
    const estimated1RM = calc1RM(weight, reps);
    const newPRHistory = { ...prHistory };
    const current = newPRHistory[exerciseName] || [];
    newPRHistory[exerciseName] = [...current,{ date:new Date().toISOString(),weight,reps,estimated1RM }];
    setPRHistory(newPRHistory);
    await AsyncStorage.setItem('prHistory', JSON.stringify(newPRHistory));
    const newMaxes = { ...userMaxes };
    if (estimated1RM > (newMaxes[exerciseName] || 0)) {
      newMaxes[exerciseName] = estimated1RM;
      setUserMaxes(newMaxes);
      await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
    }
  }

  const gymWorkouts = workouts.filter(w => w.type === 'gym');
  const lastGymWorkout = [...gymWorkouts].sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime())[0];
  const daysSinceGym = lastGymWorkout ? daysSince(lastGymWorkout.date) : -1;
  const kraftRecommended = daysSinceGym >= 2;
  const neverTrainedGym = daysSinceGym === -1;
  const weekDays = getWeekTrainings(workouts);
  const todayDayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const prCount = Object.keys(prHistory).length;

  const lastExerciseDates: Record<string,number> = {};
  [...workouts].reverse().forEach(w => {
    w.exercises?.forEach(ex => {
      if (lastExerciseDates[ex.muscleGroup] === undefined) lastExerciseDates[ex.muscleGroup] = daysSince(w.date);
    });
  });
  const readyMuscles = lastGymWorkout?.exercises
    ?.map(ex => ex.muscleGroup)
    .filter((mg,idx,arr) => arr.indexOf(mg) === idx)
    .filter(mg => (lastExerciseDates[mg] ?? 99) >= 2)
    .slice(0,2) ?? [];

  async function startFreeWorkout() {
    const w: Workout = { id:Date.now().toString(),date:new Date().toISOString(),name:'Freies Training',exercises:[],duration:0,intensity:3,type:'gym' };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    setActiveWorkout(w); setScreen('home');
  }

  async function startFreeWithRecommendation() {
    if (!lastGymWorkout) return startFreeWorkout();
    const w: Workout = {
      id:Date.now().toString(),date:new Date().toISOString(),name:lastGymWorkout.name,
      exercises:lastGymWorkout.exercises.map(ex => ({ ...ex,id:Date.now().toString()+ex.name,sets:ex.sets.map(()=>({ reps:'',weight:'' })) })),
      duration:0,intensity:3,type:'gym',
    };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    setActiveWorkout(w); setScreen('home');
  }

  async function startWithRecommendationFromHome() {
    if (lastGymWorkout) await startFreeWithRecommendation();
    else setScreen('freeStart');
  }

  async function startRoutineWorkout(routine: Routine) {
    const w: Workout = {
      id:Date.now().toString(),date:new Date().toISOString(),name:routine.name,
      exercises:routine.exercises.map(re => ({ id:Date.now().toString()+re.name,name:re.name,muscleGroup:re.muscleGroup,sets:Array.from({ length:re.defaultSets },()=>({ reps:'',weight:'' })) })),
      duration:0,intensity:3,type:'gym',
    };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    setActiveWorkout(w); setScreen('home');
  }

  async function startRun() {
    await AsyncStorage.setItem('activeWorkout', JSON.stringify({ id:Date.now().toString(),date:new Date().toISOString(),name:'Lauf',exercises:[],duration:0,intensity:3,type:'run' }));
    setActiveRun(true);
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    // Get duration from stored start time
    const rawTimer = await AsyncStorage.getItem('gymWorkoutTimer');
    let duration = 1;
    if (rawTimer) {
      try {
        const { startedAt } = JSON.parse(rawTimer);
        if (startedAt) duration = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      } catch {}
    }
    const score = calcWorkoutScore({ ...activeWorkout, duration }, userMaxes);
    const finished: Workout = { ...activeWorkout, duration, score };

    const newPRH = { ...prHistory };
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best > 0) {
        const cur = newPRH[ex.name] || [];
        const curMax = cur.length > 0 ? cur[cur.length-1].estimated1RM : 0;
        if (best > curMax) {
          const bestSet = ex.sets.reduce((b,set) => calc1RM(parseFloat(set.weight||'0'),parseFloat(set.reps||'0')) > calc1RM(parseFloat(b.weight||'0'),parseFloat(b.reps||'0')) ? set : b, ex.sets[0]);
          newPRH[ex.name] = [...(newPRH[ex.name]||[]),{ date:new Date().toISOString(),weight:parseFloat(bestSet.weight||'0'),reps:parseFloat(bestSet.reps||'0'),estimated1RM:best }];
        }
      }
    }
    await AsyncStorage.setItem('prHistory', JSON.stringify(newPRH));
    const newMaxes = { ...userMaxes };
    for (const ex of finished.exercises) { const best = getBest1RM(ex.sets); if (best>(newMaxes[ex.name]||0)) newMaxes[ex.name]=best; }
    await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
    const rawWH = await AsyncStorage.getItem('workouts');
    const histArr = rawWH ? JSON.parse(rawWH) : [];
    histArr.push(finished);
    await AsyncStorage.setItem('workouts', JSON.stringify(histArr));
    await AsyncStorage.removeItem('activeWorkout');
    await AsyncStorage.removeItem('gymWorkoutTimer');
    setActiveWorkout(null);
    await loadAll();
    Alert.alert(
      'Training abgeschlossen! 🎉',
      `${duration} Minuten · ${finished.exercises.length} Übungen\n⚡ Trainingsscore: ${score}/100`
    );
  }

  async function stopSession() {
    setActiveRun(false); setActiveWorkout(null);
    await AsyncStorage.removeItem('activeWorkout');
    await AsyncStorage.removeItem('gymWorkoutTimer');
    await AsyncStorage.removeItem('activeRunTimer');
    await loadAll();
  }

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Guten Morgen' : greetingHour < 18 ? 'Guten Tag' : 'Guten Abend';

  if (activeRun) return <RunScreen onStop={stopSession} />;
  if (activeWorkout) return <ActiveGymWorkout workout={activeWorkout} userMaxes={userMaxes} prHistory={prHistory} lastWorkoutData={lastWorkoutData} onUpdate={setActiveWorkout} onFinish={finishWorkout} />;
  if (screen === 'freeStart') return <FreeWorkoutStartScreen onStart={startFreeWorkout} onStartWithRecommendation={startFreeWithRecommendation} lastWorkout={lastGymWorkout ?? null} onBack={() => setScreen('home')} />;
  if (screen === 'routineScreen') return (
    <RoutineScreen
      routines={routines}
      onSelectRoutine={r => { setSelectedRoutine(r); setScreen('routineDetail'); }}
      onCreateRoutine={saveRoutine}
      onUpdateRoutine={updateRoutine}
      onDeleteRoutine={deleteRoutine}
      onBack={() => setScreen('home')}
    />
  );
  if (screen === 'routineDetail' && selectedRoutine) return <RoutineDetailScreen routine={selectedRoutine} onStart={startRoutineWorkout} onBack={() => setScreen('routineScreen')} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {showHistory && <HistoryScreen onClose={() => { setShowHistory(false); loadAll(); }} prHistory={prHistory} onDelete={() => loadAll()} />}
      {showPRScreen && <PRScreen prHistory={prHistory} onClose={() => setShowPRScreen(false)} onAddPR={() => { setShowPRScreen(false); setShowPREntry(true); }} />}
      {showPREntry && <PREntryScreen onClose={() => setShowPREntry(false)} onSave={savePR} />}
      {showPlan && <TrainingPlanScreen onClose={() => setShowPlan(false)} userMaxes={userMaxes} allExercises={allExercises} />}

      <Modal visible={showDeviceModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Gerät verbinden</Text>
            {['Polar','Garmin','Apple Watch','Suunto'].map(device => (
              <TouchableOpacity key={device}
                style={[s.presetChip,{ paddingVertical:14,marginBottom:8,borderRadius:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center' }]}
                onPress={async () => { await AsyncStorage.setItem('connectedDevice',device); setConnectedDevice(device); setShowDeviceModal(false); Alert.alert('Verbunden',`${device} wurde erfolgreich verbunden.`); }}>
                <Text style={[s.presetChipText,{ fontSize:15 }]}>{device}</Text>
                <IconChevronRight color={theme.textTertiary} size={18} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowDeviceModal(false)}>
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── HEADER ── */}
          <View style={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 0 }}>
            <Text style={{ fontSize:10,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase',color:theme.orange,marginBottom:4 }}>Training</Text>
            <Text style={{ fontSize:26,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.6,marginBottom:16 }}>{greeting}</Text>

            {/* Week Grid */}
            <View style={{ backgroundColor:theme.card,borderRadius:18,borderWidth:1,borderColor:theme.border,padding:14,marginBottom:14 }}>
              <Text style={{ fontSize:9,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.6,marginBottom:10 }}>
                Diese Woche · {weekDays.filter(Boolean).length} Trainings
              </Text>
              <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end' }}>
                {DAY_LABELS.map((lbl, idx) => {
                  const done = weekDays[idx];
                  const isToday2 = idx === todayDayIdx;
                  return (
                    <View key={lbl} style={{ alignItems:'center',gap:4 }}>
                      <View style={{
                        width:27,height:27,borderRadius:14,
                        backgroundColor: done ? theme.orange : isToday2 ? 'rgba(232,87,42,0.14)' : 'rgba(255,255,255,0.04)',
                        borderWidth: isToday2 && !done ? 2 : done ? 0 : 1,
                        borderColor: isToday2 ? theme.orange : 'rgba(255,255,255,0.08)',
                        alignItems:'center',justifyContent:'center',
                      }}>
                        {done ? <IconCheck color="#fff" size={12} /> : isToday2 ? <View style={{ width:7,height:7,borderRadius:4,backgroundColor:theme.orange }} /> : null}
                      </View>
                      <Text style={{ fontSize:9, fontWeight: isToday2 ? '800' : '600', color: isToday2 ? theme.orange : done ? 'rgba(245,240,238,0.4)' : 'rgba(245,240,238,0.18)' }}>{lbl}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── MAIN CARD ── */}
          <View style={{ marginHorizontal:16,marginBottom:12,backgroundColor:theme.card,borderRadius:22,borderWidth:1.5,borderColor:theme.orangeBorder,padding:18 }}>
            <View style={{ flexDirection:'row',alignItems:'center',gap:6,marginBottom:14 }}>
              <View style={{ width:5,height:5,borderRadius:3,backgroundColor:theme.orange }} />
              <Text style={{ fontSize:9,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',color:theme.orange }}>
                {neverTrainedGym ? 'Starte dein erstes Training' : kraftRecommended ? 'Heute empfohlen' : 'Bereit für mehr?'}
              </Text>
            </View>
            <View style={{ flexDirection:'row',alignItems:'center',gap:13,marginBottom:13 }}>
              <View style={{ width:50,height:50,borderRadius:25,backgroundColor:theme.orangeLight,borderWidth:1,borderColor:theme.orangeBorder,alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <IconDumbbell color={theme.orange} size={26} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:20,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.4,marginBottom:3 }}>
                  {neverTrainedGym ? 'Krafttraining' : lastGymWorkout?.name ?? 'Krafttraining'}
                </Text>
                {!neverTrainedGym && lastGymWorkout && (
                  <Text style={{ fontSize:11,color:theme.textSecondary }}>
                    {lastGymWorkout.exercises.slice(0,3).map(e=>e.name).join(' · ')}
                    {lastGymWorkout.exercises.length > 3 ? ` · +${lastGymWorkout.exercises.length-3}` : ''}
                  </Text>
                )}
              </View>
            </View>
            {readyMuscles.length > 0 && (
              <View style={{ flexDirection:'row',gap:6,marginBottom:16,flexWrap:'wrap' }}>
                {readyMuscles.map(mg => (
                  <View key={mg} style={{ backgroundColor:theme.greenLight,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:'rgba(52,199,89,0.2)' }}>
                    <Text style={{ fontSize:10,fontWeight:'600',color:theme.green }}>✓ {mg} bereit</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor:theme.orange,borderRadius:14,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9 }}
              onPress={startWithRecommendationFromHome} activeOpacity={0.85}>
              <IconPlay color="#fff" size={15} />
              <Text style={{ fontSize:14,fontWeight:'800',color:'#fff' }}>Jetzt starten</Text>
            </TouchableOpacity>
          </View>

          {/* ── QUICK ACTIONS ── */}
          <View style={{ flexDirection:'row',gap:8,marginHorizontal:16,marginBottom:10 }}>
            <TouchableOpacity style={{ flex:1,backgroundColor:theme.card,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border,alignItems:'center',gap:7 }}
              onPress={() => setScreen('routineScreen')} activeOpacity={0.85}>
              <IconList color={theme.textSecondary} size={22} />
              <Text style={{ fontSize:12,fontWeight:'600',color:theme.textSecondary }}>Routinen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex:1,backgroundColor:theme.card,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border,alignItems:'center',gap:7 }}
              onPress={() => setScreen('freeStart')} activeOpacity={0.85}>
              <IconPencil color={theme.textSecondary} size={22} />
              <Text style={{ fontSize:12,fontWeight:'600',color:theme.textSecondary }}>Freies Training</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex:1,backgroundColor:theme.card,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border,alignItems:'center',gap:7 }}
              onPress={() => setShowPlan(true)} activeOpacity={0.85}>
              <IconCalendar color={theme.textSecondary} size={22} />
              <Text style={{ fontSize:12,fontWeight:'600',color:theme.textSecondary }}>Plan</Text>
            </TouchableOpacity>
          </View>

          {/* PRs */}
          <TouchableOpacity
            style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,borderWidth:1,borderColor:'rgba(255,215,0,0.2)',flexDirection:'row',alignItems:'center',gap:13 }}
            onPress={() => prCount === 0 ? setShowPREntry(true) : setShowPRScreen(true)} activeOpacity={0.85}>
            <View style={{ width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,215,0,0.1)',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <IconTrophy color="#FFD700" size={22} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 }}>Personal Records</Text>
              <Text style={{ fontSize:12,color:theme.textSecondary }}>
                {prCount === 0 ? 'Noch keine PRs — tippe um einzutragen' : `${prCount} PRs gespeichert`}
              </Text>
            </View>
            <IconChevronRight color="rgba(255,215,0,0.4)" size={18} />
          </TouchableOpacity>

          {/* Verlauf */}
          <TouchableOpacity
            style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,borderWidth:1,borderColor:theme.orangeBorder,flexDirection:'row',alignItems:'center',gap:13 }}
            onPress={() => setShowHistory(true)} activeOpacity={0.85}>
            <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.orangeLight,alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <IconHistory color={theme.orange} size={22} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 }}>Trainingsverlauf</Text>
              <Text style={{ fontSize:12,color:theme.textSecondary }}>{workouts.length} Einheiten gespeichert</Text>
            </View>
            <IconChevronRight color={theme.orange} size={18} />
          </TouchableOpacity>

          {/* Device */}
          {connectedDevice ? (
            <View style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:theme.border }}>
              <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.greenLight,alignItems:'center',justifyContent:'center' }}>
                <IconWatch color={theme.green} size={22} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:15,fontWeight:'600',color:theme.textPrimary,marginBottom:2 }}>{connectedDevice}</Text>
                <Text style={{ fontSize:12,color:theme.green }}>Verbunden</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor:theme.orange,borderRadius:22,paddingHorizontal:14,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:5 }}
                onPress={() => Alert.alert('Synchronisieren','Daten werden synchronisiert...')} activeOpacity={0.8}>
                <IconSync color="#fff" size={14} />
                <Text style={{ fontSize:13,fontWeight:'600',color:'#fff' }}>Sync</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={{ marginHorizontal:16,marginBottom:8,backgroundColor:theme.card,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:theme.border,borderStyle:'dashed' }}
              onPress={() => setShowDeviceModal(true)} activeOpacity={0.85}>
              <View style={{ width:44,height:44,borderRadius:22,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' }}>
                <IconWatch color={theme.textTertiary} size={22} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:15,fontWeight:'600',color:theme.textPrimary,marginBottom:2 }}>Kein Gerät verbunden</Text>
                <Text style={{ fontSize:12,color:theme.textSecondary }}>Polar, Garmin oder Apple Watch</Text>
              </View>
              <View style={{ backgroundColor:theme.orangeLight,borderRadius:22,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:theme.orangeBorder }}>
                <Text style={{ fontSize:13,fontWeight:'600',color:theme.orange }}>Verbinden</Text>
              </View>
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
  header:          { paddingTop:60,paddingHorizontal:16,paddingBottom:20,flexDirection:'row',alignItems:'flex-start',gap:12 },
  backBtn:         { width:36,height:36,borderRadius:18,backgroundColor:theme.card,alignItems:'center',justifyContent:'center',marginTop:4,borderWidth:1,borderColor:theme.border },
  eyebrow:         { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  title:           { fontSize:26,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.6 },
  recCard:         { backgroundColor:theme.card,borderRadius:18,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.orangeBorder },
  recBadgeRow:     { flexDirection:'row',alignItems:'center',gap:6,marginBottom:8 },
  recDot:          { width:6,height:6,borderRadius:3,backgroundColor:theme.orange },
  recBadgeText:    { fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',color:theme.orange },
  recTitle:        { fontSize:17,fontWeight:'800',color:theme.textPrimary,marginBottom:4,letterSpacing:-0.3 },
  recSub:          { fontSize:12,color:theme.textSecondary,marginBottom:12 },
  recBtn:          { backgroundColor:theme.orange,borderRadius:12,padding:12,alignItems:'center' },
  recBtnText:      { fontSize:13,fontWeight:'700',color:'#fff' },
  emptyCard:       { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:12,borderWidth:1,borderColor:theme.border },
  emptyCardTitle:  { fontSize:14,fontWeight:'600',color:theme.textSecondary,marginBottom:3 },
  emptyCardSub:    { fontSize:12,color:theme.textTertiary },
  routineCard:     { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:theme.border },
  routineName:     { fontSize:16,fontWeight:'700',color:theme.textPrimary,marginBottom:4,letterSpacing:-0.3 },
  routineMeta:     { fontSize:11,color:theme.textSecondary,marginBottom:8 },
  routineChipRow:  { flexDirection:'row',gap:6 },
  routineChip:     { backgroundColor:theme.orangeLight,borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:theme.orangeBorder },
  routineChipText: { fontSize:11,fontWeight:'600',color:theme.orange },
  exListCard:      { backgroundColor:theme.card,borderRadius:16,overflow:'hidden',marginBottom:12,borderWidth:1,borderColor:theme.border },
  exRow:           { flexDirection:'row',alignItems:'center',gap:10,padding:12 },
  exRowBorder:     { borderBottomWidth:0.5,borderBottomColor:theme.border },
  exDot:           { width:8,height:8,borderRadius:4 },
  exName:          { flex:1,fontSize:13,fontWeight:'600',color:theme.textPrimary },
  addExBtn:        { flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:theme.orangeBorder,borderRadius:12,borderStyle:'dashed',padding:12,marginBottom:12 },
  addExBtnText:    { fontSize:13,fontWeight:'600',color:theme.orange },
  emptyState:      { alignItems:'center',paddingVertical:60,gap:12 },
  emptyStateTitle: { fontSize:17,fontWeight:'700',color:theme.textPrimary },
  emptyStateSub:   { fontSize:13,color:theme.textSecondary,textAlign:'center' },
});

const routineSt = StyleSheet.create({
  tabRow:             { flexDirection:'row',gap:8,marginBottom:16 },
  tabBtn:             { flex:1,paddingVertical:10,borderRadius:12,backgroundColor:theme.card,alignItems:'center',borderWidth:1,borderColor:theme.border },
  tabBtnActive:       { backgroundColor:theme.orange,borderColor:theme.orange },
  tabBtnText:         { fontSize:13,fontWeight:'600',color:theme.textSecondary },
  tabBtnTextActive:   { color:'#fff' },
  createBtn:          { backgroundColor:theme.card,borderRadius:16,padding:16,flexDirection:'row',alignItems:'center',gap:14,marginBottom:12,borderWidth:1,borderColor:theme.orangeBorder },
  createBtnIcon:      { width:44,height:44,borderRadius:22,backgroundColor:theme.orangeLight,alignItems:'center',justifyContent:'center' },
  createBtnTitle:     { fontSize:15,fontWeight:'700',color:theme.textPrimary,marginBottom:2 },
  createBtnSub:       { fontSize:12,color:theme.textSecondary },
  searchBox:          { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,paddingHorizontal:14,paddingVertical:12,marginBottom:14,borderWidth:1,borderColor:theme.border },
  searchInput:        { flex:1,fontSize:14,color:theme.textPrimary },
  communityBadge:     { backgroundColor:theme.blueLight,borderRadius:20,paddingHorizontal:8,paddingVertical:3 },
  communityBadgeText: { fontSize:10,fontWeight:'600',color:theme.blue },
});

const prEntry = StyleSheet.create({
  header:       { flexDirection:'row',alignItems:'flex-end',gap:12,paddingTop:60,paddingHorizontal:16,paddingBottom:20,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  closeBtn:     { width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' },
  eyebrow:      { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  title:        { fontSize:24,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5 },
  searchBox:    { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,paddingHorizontal:14,paddingVertical:12,marginBottom:20,borderWidth:1,borderColor:theme.border },
  searchInput:  { flex:1,fontSize:14,color:theme.textPrimary },
  muscleLabel:  { fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8 },
  exRow:        { flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.card,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:theme.border },
  exDot:        { width:8,height:8,borderRadius:4 },
  exName:       { flex:1,fontSize:14,fontWeight:'600',color:theme.textPrimary },
  sectionLabel: { fontSize:11,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',color:theme.textTertiary,marginBottom:12 },
  repsRow:      { flexDirection:'row',gap:10,marginBottom:8 },
  repsBtn:      { flex:1,backgroundColor:theme.card,borderRadius:16,padding:16,alignItems:'center',borderWidth:1,borderColor:theme.border },
  repsBtnActive:{ backgroundColor:theme.orange,borderColor:theme.orange },
  repsBtnNum:   { fontSize:28,fontWeight:'800',color:theme.textPrimary,marginBottom:2 },
  repsBtnLabel: { fontSize:11,color:theme.textSecondary },
  weightRow:    { flexDirection:'row',alignItems:'center',gap:12,backgroundColor:theme.card,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border,marginBottom:16 },
  weightInput:  { flex:1,fontSize:48,fontWeight:'800',color:theme.textPrimary,letterSpacing:-1 },
  weightUnit:   { fontSize:20,fontWeight:'600',color:theme.textTertiary },
  previewCard:  { backgroundColor:theme.orangeLight,borderRadius:14,padding:16,marginBottom:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:theme.orangeBorder },
  previewLabel: { fontSize:12,fontWeight:'600',color:theme.orange,textTransform:'uppercase',letterSpacing:0.8 },
  previewVal:   { fontSize:28,fontWeight:'800',color:theme.orange },
  saveBtn:      { backgroundColor:theme.orange,borderRadius:16,padding:16,alignItems:'center' },
  saveBtnText:  { fontSize:15,fontWeight:'700',color:'#fff' },
});

const prSt = StyleSheet.create({
  addBtn:       { flexDirection:'row',alignItems:'center',gap:8,backgroundColor:theme.orange,borderRadius:14,padding:14,margin:16,justifyContent:'center' },
  addBtnText:   { fontSize:14,fontWeight:'700',color:'#fff' },
  card:         { backgroundColor:theme.card,borderRadius:18,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.border },
  rankBadge:    { width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:1.5 },
  rankText:     { fontSize:12,fontWeight:'800' },
  exerciseName: { fontSize:16,fontWeight:'700',color:theme.textPrimary,letterSpacing:-0.3 },
  exerciseDate: { fontSize:12,color:theme.textTertiary,marginTop:2 },
  oneRMVal:     { fontSize:20,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.5 },
  oneRMLabel:   { fontSize:10,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.5 },
  prStat:       { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:10,alignItems:'center' },
  prStatVal:    { fontSize:15,fontWeight:'700',color:theme.textPrimary },
  prStatLbl:    { fontSize:9,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.4,marginTop:2 },
  deltaChip:    { borderRadius:20,paddingHorizontal:10,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:4 },
  deltaText:    { fontSize:12,fontWeight:'700' },
});

const active = StyleSheet.create({
  header:         { backgroundColor:theme.card,paddingTop:56,paddingHorizontal:16,paddingBottom:14,flexDirection:'row',alignItems:'flex-start',gap:12,borderBottomWidth:0.5,borderBottomColor:theme.border },
  workoutLabel:   { fontSize:10,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',color:theme.orange,marginBottom:3 },
  workoutTitle:   { fontSize:20,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.4 },
  timerBadge:     { backgroundColor:theme.orangeLight,borderRadius:12,paddingHorizontal:12,paddingVertical:8,alignItems:'center',borderWidth:1,borderColor:theme.orangeBorder },
  timerText:      { fontSize:18,fontWeight:'800',color:theme.orange,letterSpacing:1 },
  timerLabel:     { fontSize:8,color:theme.orange,textTransform:'uppercase',letterSpacing:0.5,marginTop:1,opacity:0.6 },
  statsRow:       { flexDirection:'row',gap:8,padding:12,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  statBox:        { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:10,alignItems:'center' },
  statVal:        { fontSize:18,fontWeight:'700' },
  statLbl:        { fontSize:8,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.5,marginTop:2 },
  pauseCard:      { backgroundColor:theme.card,borderLeftWidth:3,padding:12,marginBottom:12,marginTop:12,borderRadius:0 },
  pauseLabel:     { fontSize:9,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:2 },
  pauseTimer:     { fontSize:22,fontWeight:'800',color:theme.textPrimary,letterSpacing:1 },
  pauseBtn:       { backgroundColor:theme.cardSecondary,borderRadius:8,paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderColor:theme.border },
  pauseBtnText:   { fontSize:11,fontWeight:'600',color:theme.textSecondary },
  exerciseCard:   { backgroundColor:theme.card,borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:theme.border },
  musclePill:     { paddingHorizontal:10,paddingVertical:4,borderRadius:20 },
  musclePillText: { fontSize:11,fontWeight:'500' },
  exerciseName:   { flex:1,fontSize:15,fontWeight:'700',color:theme.textPrimary },
  prWarn:         { backgroundColor:'rgba(232,87,42,0.08)',borderRadius:10,padding:12,borderLeftWidth:3,borderLeftColor:theme.orange,marginBottom:12 },
  prWarnTitle:    { fontSize:12,fontWeight:'700',color:theme.textPrimary,marginBottom:2 },
  prWarnBtn:      { flex:1,borderRadius:8,padding:8,alignItems:'center',borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSecondary },
  prWarnBtnText:  { fontSize:11,fontWeight:'600',color:theme.textSecondary },
  recRow:         { backgroundColor:theme.blueLight,borderRadius:8,padding:8,marginBottom:10,borderWidth:1,borderColor:'rgba(74,158,255,0.2)' },
  recText:        { fontSize:12,color:theme.blue,fontWeight:'500' },
  lastRow:        { flexDirection:'row',backgroundColor:theme.cardSecondary,borderRadius:8,padding:8,marginBottom:8 },
  lastLabel:      { fontSize:11,color:theme.textSecondary },
  lastVal:        { fontSize:11,color:theme.orange,fontWeight:'500',flex:1 },
  oneRM:          { fontSize:11,color:theme.textSecondary,marginBottom:10 },
  setHeaderText:  { fontSize:9,color:theme.textTertiary,textTransform:'uppercase',letterSpacing:0.8,textAlign:'center' },
  setRow:         { flexDirection:'row',gap:8,marginBottom:8,alignItems:'center' },
  setNumber:      { fontSize:13,color:theme.textSecondary,width:24,textAlign:'center' },
  setInput:       { flex:1,backgroundColor:theme.cardSecondary,borderRadius:10,padding:11,color:theme.textPrimary,fontSize:15,textAlign:'center',borderWidth:1,borderColor:theme.border },
  addSetBtn:      { padding:8,alignItems:'center' },
  addSetBtnText:  { fontSize:13,color:theme.orange,fontWeight:'500' },
  addExerciseBtn: { backgroundColor:theme.orangeLight,borderRadius:14,padding:14,alignItems:'center',marginBottom:10,borderWidth:1,borderColor:theme.orangeBorder,flexDirection:'row',justifyContent:'center',gap:8 },
  addExerciseBtnText: { fontSize:15,color:theme.orange,fontWeight:'600' },
  finishBtn:      { backgroundColor:theme.orange,borderRadius:16,padding:16,alignItems:'center',marginBottom:20 },
  finishBtnText:  { fontSize:15,color:'#fff',fontWeight:'700' },
});

const hist = StyleSheet.create({
  header:   { flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:60,paddingHorizontal:22,paddingBottom:14,backgroundColor:theme.card,borderBottomWidth:0.5,borderBottomColor:theme.border },
  eyebrow:  { fontSize:11,fontWeight:'600',color:theme.orange,letterSpacing:0.8,textTransform:'uppercase',marginBottom:4 },
  title:    { fontSize:28,fontWeight:'800',color:theme.textPrimary,letterSpacing:-0.8 },
  closeBtn: { width:36,height:36,borderRadius:18,backgroundColor:theme.cardSecondary,alignItems:'center',justifyContent:'center' },
});

const s = StyleSheet.create({
  container:         { flex:1,backgroundColor:theme.bg,paddingHorizontal:20 },
  headerLabel:       { fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:theme.textSecondary,marginTop:60,marginBottom:12 },
  card:              { backgroundColor:theme.card,borderRadius:16,padding:14,marginBottom:10,borderWidth:1,borderColor:theme.border },
  cardTitle:         { fontSize:10,textTransform:'uppercase',letterSpacing:1.5,color:theme.textSecondary,marginBottom:10 },
  inputLabel:        { fontSize:10,textTransform:'uppercase',letterSpacing:1.2,color:theme.textSecondary,marginBottom:6 },
  input:             { backgroundColor:theme.cardSecondary,borderRadius:12,padding:13,color:theme.textPrimary,fontSize:15,marginBottom:12,borderWidth:1,borderColor:theme.border },
  saveBtn:           { backgroundColor:theme.orange,borderRadius:14,padding:15,alignItems:'center' },
  saveBtnText:       { fontSize:15,fontWeight:'600',color:'#fff' },
  cancelBtn:         { padding:14,alignItems:'center' },
  cancelBtnText:     { fontSize:14,color:theme.textSecondary },
  presetChip:        { paddingHorizontal:12,paddingVertical:7,borderRadius:20,backgroundColor:theme.cardSecondary,borderWidth:1,borderColor:theme.border },
  presetChipText:    { fontSize:13,color:theme.textPrimary },
  modalOverlay:      { flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end' },
  modalCard:         { backgroundColor:theme.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,gap:12 },
  modalTitle:        { fontSize:20,fontWeight:'700',color:theme.textPrimary },
  runTimerCard:      { backgroundColor:theme.card,borderRadius:24,padding:28,alignItems:'center',gap:10,marginBottom:14,borderLeftWidth:3,borderLeftColor:theme.green,borderWidth:1,borderColor:theme.border },
  runTimerLabel:     { fontSize:10,color:theme.textSecondary,textTransform:'uppercase',letterSpacing:2 },
  runTimerDisplay:   { fontSize:60,fontWeight:'300',color:theme.textPrimary,letterSpacing:-2 },
  runStatsGrid:      { flexDirection:'row',gap:8,marginBottom:14 },
  runStatCard:       { flex:1,backgroundColor:theme.card,borderRadius:14,padding:12,alignItems:'center',borderWidth:1,borderColor:theme.border },
  runStatVal:        { fontSize:16,fontWeight:'600' },
  runStatLbl:        { fontSize:8,color:theme.textSecondary,textTransform:'uppercase',letterSpacing:0.8,marginTop:3,textAlign:'center' },
  finishRunBtn:      { backgroundColor:theme.green,borderRadius:16,padding:16,alignItems:'center',marginBottom:40 },
  finishRunBtnText:  { fontSize:15,fontWeight:'600',color:'#000' },
});