import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, AppStateStatus, Dimensions, Image, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse,
  Line,
  Path, RadialGradient, Rect, Stop
} from 'react-native-svg';
import { useAppTheme } from '../../constants/ThemeContext';
import { translateMuscle, useLanguage } from '../../constants/LanguageContext';
import { getTrainingReadiness, syncAppleHealthWorkouts, TrainingReadiness } from '../../utils/applehealth';
import { scheduleNutritionReminder } from '../../utils/notifications';

function getT(colors: any) {
  const dark = colors.bg < '#888888';
  const text1 = dark ? '#F0F0F0' : '#2A1F14';
  const text2 = dark ? '#B0B0B0' : '#5A4A3A';
  const text3 = dark ? '#808080' : '#7A6E63';
  const text4 = dark ? '#555555' : '#B0A89E';
  const border = dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,10,0.08)';
  const borderSoft = dark ? 'rgba(255,255,255,0.05)' : 'rgba(60,30,10,0.05)';
  return {
    bg: colors.bg, card: colors.card, cardAlt: colors.cardSecondary,
    border, borderSoft,
    orange: colors.accent, orangeAlpha: colors.accent + '26', orangeBorder: colors.accent + '48',
    blue: '#3A7AC0', blueAlpha: 'rgba(58,122,192,0.08)', blueBorder: 'rgba(58,122,192,0.14)',
    green: '#4A8C5C', greenAlpha: 'rgba(74,140,92,0.08)', greenBorder: 'rgba(74,140,92,0.14)',
    red: '#C0392B', redAlpha: 'rgba(192,57,43,0.07)', redBorder: 'rgba(192,57,43,0.14)',
    gold: '#8B6914', goldAlpha: 'rgba(139,105,20,0.08)', goldBorder: 'rgba(139,105,20,0.18)',
    yellow: '#8B6914', white: '#FFFFFF',
    text1, text2, text3, text4,
  };
}

const SW = Dimensions.get('window').width;

const ALL_EXERCISES = [
  // BRUST
  { id: 'b1', name: 'Bankdrücken (LH)', category: 'Brust' },
  { id: 'b2', name: 'Bankdrücken (KH)', category: 'Brust' },
  { id: 'b3', name: 'Schrägbank oben (LH)', category: 'Brust' },
  { id: 'b4', name: 'Schrägbank oben (KH)', category: 'Brust' },
  { id: 'b5', name: 'Schrägbank unten', category: 'Brust' },
  { id: 'b6', name: 'Dips', category: 'Brust' },
  { id: 'b7', name: 'Kabelflieges oben', category: 'Brust' },
  { id: 'b8', name: 'Kabelflieges mitte', category: 'Brust' },
  { id: 'b9', name: 'Kabelflieges unten', category: 'Brust' },
  { id: 'b10', name: 'Flieges flach (KH)', category: 'Brust' },
  { id: 'b11', name: 'Flieges schräg (KH)', category: 'Brust' },
  { id: 'b12', name: 'Pec Deck', category: 'Brust' },
  { id: 'b13', name: 'Push-ups', category: 'Brust' },
  { id: 'b14', name: 'Push-ups (Gewicht)', category: 'Brust' },
  // SCHULTERN
  { id: 's1', name: 'OHP (LH)', category: 'Schultern' },
  { id: 's2', name: 'Schulterdrücken sitzend (LH)', category: 'Schultern' },
  { id: 's3', name: 'Schulterdrücken sitzend (KH)', category: 'Schultern' },
  { id: 's4', name: 'Schulterdrücken (Maschine)', category: 'Schultern' },
  { id: 's5', name: 'Arnold Press', category: 'Schultern' },
  { id: 's6', name: 'Seitheben (KH)', category: 'Schultern' },
  { id: 's7', name: 'Seitheben (Kabel)', category: 'Schultern' },
  { id: 's8', name: 'Seitheben (Maschine)', category: 'Schultern' },
  { id: 's9', name: 'Frontheben (LH)', category: 'Schultern' },
  { id: 's10', name: 'Frontheben (KH)', category: 'Schultern' },
  { id: 's11', name: 'Frontheben (Kabel)', category: 'Schultern' },
  { id: 's12', name: 'Reverse Flyes (KH)', category: 'Schultern' },
  { id: 's13', name: 'Reverse Flyes (Kabel)', category: 'Schultern' },
  { id: 's14', name: 'Upright Row (LH)', category: 'Schultern' },
  { id: 's15', name: 'Upright Row (Kabel)', category: 'Schultern' },
  { id: 's16', name: 'Face Pulls', category: 'Schultern' },
  { id: 's17', name: 'Band Pull Aparts', category: 'Schultern' },
  // TRIZEPS
  { id: 't1', name: 'Enges Bankdrücken', category: 'Trizeps' },
  { id: 't2', name: 'Skull Crushers (LH)', category: 'Trizeps' },
  { id: 't3', name: 'Skull Crushers (EZ)', category: 'Trizeps' },
  { id: 't4', name: 'Pushdown (Seil)', category: 'Trizeps' },
  { id: 't5', name: 'Pushdown (Stange)', category: 'Trizeps' },
  { id: 't6', name: 'Overhead Extension (KH)', category: 'Trizeps' },
  { id: 't7', name: 'Overhead Extension (Kabel)', category: 'Trizeps' },
  { id: 't8', name: 'Overhead Extension (EZ)', category: 'Trizeps' },
  { id: 't9', name: 'Kickbacks (KH)', category: 'Trizeps' },
  { id: 't10', name: 'Kickbacks (Kabel)', category: 'Trizeps' },
  { id: 't11', name: 'Dips (Trizeps)', category: 'Trizeps' },
  { id: 't12', name: 'Trizeps (Maschine)', category: 'Trizeps' },
  // BIZEPS
  { id: 'bz1', name: 'Curl (LH)', category: 'Bizeps' },
  { id: 'bz2', name: 'Curl (EZ)', category: 'Bizeps' },
  { id: 'bz3', name: 'Curl abwechselnd (KH)', category: 'Bizeps' },
  { id: 'bz4', name: 'Curl gleichzeitig (KH)', category: 'Bizeps' },
  { id: 'bz5', name: 'Hammer Curl (KH)', category: 'Bizeps' },
  { id: 'bz6', name: 'Hammer Curl (Kabel)', category: 'Bizeps' },
  { id: 'bz7', name: 'Konzentrations Curl', category: 'Bizeps' },
  { id: 'bz8', name: 'Preacher Curl (EZ)', category: 'Bizeps' },
  { id: 'bz9', name: 'Preacher Curl (Maschine)', category: 'Bizeps' },
  { id: 'bz10', name: 'Kabel Curl (Stange)', category: 'Bizeps' },
  { id: 'bz11', name: 'Kabel Curl (Seil)', category: 'Bizeps' },
  { id: 'bz12', name: 'Zottman Curl', category: 'Bizeps' },
  { id: 'bz13', name: 'Incline Curl (KH)', category: 'Bizeps' },
  { id: 'bz14', name: 'Spider Curl', category: 'Bizeps' },
  // RÜCKEN BREITE
  { id: 'rb1', name: 'Klimmzüge weit', category: 'Rücken (Breite)' },
  { id: 'rb2', name: 'Klimmzüge eng', category: 'Rücken (Breite)' },
  { id: 'rb3', name: 'Klimmzüge neutral', category: 'Rücken (Breite)' },
  { id: 'rb4', name: 'Latzug weit', category: 'Rücken (Breite)' },
  { id: 'rb5', name: 'Latzug eng', category: 'Rücken (Breite)' },
  { id: 'rb6', name: 'Latzug neutral', category: 'Rücken (Breite)' },
  { id: 'rb7', name: 'Straight Arm Pulldown', category: 'Rücken (Breite)' },
  { id: 'rb8', name: 'Pullover (KH)', category: 'Rücken (Breite)' },
  { id: 'rb9', name: 'Pullover (Maschine)', category: 'Rücken (Breite)' },
  // RÜCKEN DICKE
  { id: 'rd1', name: 'Kreuzheben', category: 'Rücken (Dicke)' },
  { id: 'rd2', name: 'Kreuzheben Sumo', category: 'Rücken (Dicke)' },
  { id: 'rd3', name: 'Kreuzheben Trapbar', category: 'Rücken (Dicke)' },
  { id: 'rd4', name: 'Rudern overhand (LH)', category: 'Rücken (Dicke)' },
  { id: 'rd5', name: 'Rudern underhand (LH)', category: 'Rücken (Dicke)' },
  { id: 'rd6', name: 'Rudern einarmig (KH)', category: 'Rücken (Dicke)' },
  { id: 'rd7', name: 'T-Bar Rudern', category: 'Rücken (Dicke)' },
  { id: 'rd8', name: 'Rudern (Maschine)', category: 'Rücken (Dicke)' },
  { id: 'rd9', name: 'Seilrudern eng', category: 'Rücken (Dicke)' },
  { id: 'rd10', name: 'Seilrudern weit', category: 'Rücken (Dicke)' },
  { id: 'rd11', name: 'Chest Supported Row', category: 'Rücken (Dicke)' },
  { id: 'rd12', name: 'Pendlay Row', category: 'Rücken (Dicke)' },
  { id: 'rd13', name: 'Meadows Row', category: 'Rücken (Dicke)' },
  // RÜCKEN UNTERER
  { id: 'ru1', name: 'Hyperextension', category: 'Rücken (Unterer)' },
  { id: 'ru2', name: 'Good Mornings', category: 'Rücken (Unterer)' },
  { id: 'ru3', name: 'Back Extension (Maschine)', category: 'Rücken (Unterer)' },
  { id: 'ru4', name: 'Superman Hold', category: 'Rücken (Unterer)' },
  // TRAPEZ
  { id: 'tr1', name: 'Shrugs (LH)', category: 'Trapez' },
  { id: 'tr2', name: 'Shrugs (KH)', category: 'Trapez' },
  { id: 'tr3', name: 'Shrugs (Trapbar)', category: 'Trapez' },
  { id: 'tr4', name: 'Shrugs (Kabel)', category: 'Trapez' },
  { id: 'tr5', name: 'Rack Pull', category: 'Trapez' },
  { id: 'tr6', name: "Farmer's Walk", category: 'Trapez' },
  // QUADRIZEPS
  { id: 'q1', name: 'Back Squat', category: 'Quadrizeps' },
  { id: 'q2', name: 'Back Squat (Low Bar)', category: 'Quadrizeps' },
  { id: 'q3', name: 'Front Squat', category: 'Quadrizeps' },
  { id: 'q4', name: 'Goblet Squat', category: 'Quadrizeps' },
  { id: 'q5', name: 'Beinpresse 45°', category: 'Quadrizeps' },
  { id: 'q6', name: 'Beinpresse horizontal', category: 'Quadrizeps' },
  { id: 'q7', name: 'Hack Squat', category: 'Quadrizeps' },
  { id: 'q8', name: 'Lunges', category: 'Quadrizeps' },
  { id: 'q9', name: 'Walking Lunges', category: 'Quadrizeps' },
  { id: 'q10', name: 'Bulgaren Split Squat', category: 'Quadrizeps' },
  { id: 'q11', name: 'Step-ups (KH)', category: 'Quadrizeps' },
  { id: 'q12', name: 'Beinstrecker', category: 'Quadrizeps' },
  { id: 'q13', name: 'Sissy Squat', category: 'Quadrizeps' },
  { id: 'q14', name: 'Spanish Squat', category: 'Quadrizeps' },
  // HAMSTRINGS
  { id: 'h1', name: 'Romanian Deadlift (LH)', category: 'Hamstrings' },
  { id: 'h2', name: 'Romanian Deadlift (KH)', category: 'Hamstrings' },
  { id: 'h3', name: 'Stiff Leg Deadlift', category: 'Hamstrings' },
  { id: 'h4', name: 'Leg Curl liegend', category: 'Hamstrings' },
  { id: 'h5', name: 'Leg Curl sitzend', category: 'Hamstrings' },
  { id: 'h6', name: 'Leg Curl stehend', category: 'Hamstrings' },
  { id: 'h7', name: 'Nordic Curl', category: 'Hamstrings' },
  { id: 'h8', name: 'Glute Ham Raise', category: 'Hamstrings' },
  { id: 'h9', name: 'Good Mornings', category: 'Hamstrings' },
  { id: 'h10', name: 'Cable Pull Through', category: 'Hamstrings' },
  // GESÄß
  { id: 'g1', name: 'Hip Thrust (LH)', category: 'Gesäß' },
  { id: 'g2', name: 'Hip Thrust (Maschine)', category: 'Gesäß' },
  { id: 'g3', name: 'Glute Bridge', category: 'Gesäß' },
  { id: 'g4', name: 'Glute Bridge (LH)', category: 'Gesäß' },
  { id: 'g5', name: 'Cable Kickback', category: 'Gesäß' },
  { id: 'g6', name: 'Donkey Kicks', category: 'Gesäß' },
  { id: 'g7', name: 'Donkey Kicks (Kabel)', category: 'Gesäß' },
  { id: 'g8', name: 'Sumo Deadlift', category: 'Gesäß' },
  { id: 'g9', name: 'Sumo Squat', category: 'Gesäß' },
  { id: 'g10', name: 'Step-ups', category: 'Gesäß' },
  { id: 'g11', name: 'Bulgaren Split Squat', category: 'Gesäß' },
  { id: 'g12', name: 'Abduktoren (Maschine)', category: 'Gesäß' },
  { id: 'g13', name: 'Reverse Hyperextension', category: 'Gesäß' },
  // WADEN
  { id: 'w1', name: 'Calf Raise stehend', category: 'Waden' },
  { id: 'w2', name: 'Calf Raise (LH)', category: 'Waden' },
  { id: 'w3', name: 'Calf Raise sitzend', category: 'Waden' },
  { id: 'w4', name: 'Donkey Calf Raise', category: 'Waden' },
  { id: 'w5', name: 'Calf Raise (Beinpresse)', category: 'Waden' },
  { id: 'w6', name: 'Einbeinige Calf Raise', category: 'Waden' },
  { id: 'w7', name: 'Einbeinige Calf Raise (KH)', category: 'Waden' },
  // BAUCH
  { id: 'ba1', name: 'Crunch', category: 'Bauch' },
  { id: 'ba2', name: 'Crunch (Kabel)', category: 'Bauch' },
  { id: 'ba3', name: 'Sit-up', category: 'Bauch' },
  { id: 'ba4', name: 'Decline Sit-up', category: 'Bauch' },
  { id: 'ba5', name: 'Leg Raises', category: 'Bauch' },
  { id: 'ba6', name: 'Hanging Leg Raises', category: 'Bauch' },
  { id: 'ba7', name: 'Hanging Knee Raises', category: 'Bauch' },
  { id: 'ba8', name: 'Ab Wheel', category: 'Bauch' },
  { id: 'ba9', name: 'Cable Crunch', category: 'Bauch' },
  { id: 'ba10', name: 'Toes to Bar', category: 'Bauch' },
  { id: 'ba11', name: 'V-Ups', category: 'Bauch' },
  // OBLIQUES
  { id: 'o1', name: 'Russian Twists', category: 'Obliques' },
  { id: 'o2', name: 'Side Plank', category: 'Obliques' },
  { id: 'o3', name: 'Woodchopper oben', category: 'Obliques' },
  { id: 'o4', name: 'Woodchopper unten', category: 'Obliques' },
  { id: 'o5', name: 'Bicycle Crunch', category: 'Obliques' },
  { id: 'o6', name: 'Pallof Press', category: 'Obliques' },
  { id: 'o7', name: 'Side Bend (KH)', category: 'Obliques' },
  // CORE
  { id: 'c1', name: 'Plank', category: 'Core' },
  { id: 'c2', name: 'Dead Bug', category: 'Core' },
  { id: 'c3', name: 'Bird Dog', category: 'Core' },
  { id: 'c4', name: 'Hollow Body Hold', category: 'Core' },
  { id: 'c5', name: 'L-Sit', category: 'Core' },
  { id: 'c6', name: 'Suitcase Carry', category: 'Core' },
  { id: 'c7', name: 'Landmine', category: 'Core' },
  // ADDUKTOREN
  { id: 'ad1', name: 'Adduktoren (Maschine)', category: 'Adduktoren' },
  { id: 'ad2', name: 'Sumo Squat', category: 'Adduktoren' },
  { id: 'ad3', name: 'Cable Adduktion', category: 'Adduktoren' },
  { id: 'ad4', name: 'Copenhagen Plank', category: 'Adduktoren' },
  { id: 'ad5', name: 'Side Lying Adduktion', category: 'Adduktoren' },
  // ABDUKTOREN
  { id: 'ab1', name: 'Abduktoren (Maschine)', category: 'Abduktoren' },
  { id: 'ab2', name: 'Cable Abduktion', category: 'Abduktoren' },
  { id: 'ab3', name: 'Band Walk seitlich', category: 'Abduktoren' },
  { id: 'ab4', name: 'Clamshell', category: 'Abduktoren' },
  { id: 'ab5', name: 'Monster Walk', category: 'Abduktoren' },
  // OLYMPIC LIFTS
  { id: 'ol1', name: 'Clean', category: 'Olympic Lifts' },
  { id: 'ol2', name: 'Clean & Jerk', category: 'Olympic Lifts' },
  { id: 'ol3', name: 'Snatch', category: 'Olympic Lifts' },
  { id: 'ol4', name: 'Power Clean', category: 'Olympic Lifts' },
  { id: 'ol5', name: 'Hang Clean', category: 'Olympic Lifts' },
  { id: 'ol6', name: 'Push Jerk', category: 'Olympic Lifts' },
  { id: 'ol7', name: 'Split Jerk', category: 'Olympic Lifts' },
  { id: 'ol8', name: 'Hang Snatch', category: 'Olympic Lifts' },
  { id: 'ol9', name: 'Power Snatch', category: 'Olympic Lifts' },

];
// ─── Theme ────────────────────────────────────────────────────


// ─── Types ────────────────────────────────────────────────────
type WorkoutSet   = { reps: string; weight: string };
type Exercise     = { id: string; name: string; muscleGroup: string; equipment?: string; sets: WorkoutSet[] };
type Workout      = { id: string; date: string; name: string; exercises: Exercise[]; duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo' | 'cardio'; source?: 'manual' | 'apple_health'; activityType?: number; calories?: number; distance?: number; score?: number };
type RunData      = { id: string; distance: number; duration: number; pace: string; calories: number; heartRate: number; date: string };
type PREntry      = { date: string; weight: number; reps: number; estimated1RM: number };
type PRHistory    = Record<string, PREntry[]>;
type UserMaxes    = Record<string, number>;
type Routine      = { id: string; name: string; exercises: { name: string; muscleGroup: string; defaultSets: number; equipment?: string }[] };
type MuscleState  = { level: number; lastTrained: string | null };
type MuscleMap    = Record<string, MuscleState>;

// ─── Exercise Database ────────────────────────────────────────
type ExerciseData = { name: string; muscleGroup: string; secondary: { muscle: string; weight: number }[]; equipment: string[] };

const EXERCISE_DB: ExerciseData[] = [
  { name: 'Bankdrücken',       muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.45 }, { muscle: 'Schultern', weight: 0.25 }], equipment: ['Langhantel', 'Kurzhantel', 'Maschine', 'Smith'] },
  { name: 'Schrägbankdrücken', muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.30 }], equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug'] },
  { name: 'Fliegende',         muscleGroup: 'Brust',      secondary: [{ muscle: 'Schultern', weight: 0.15 }], equipment: ['Kurzhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Dips',              muscleGroup: 'Brust',      secondary: [{ muscle: 'Trizeps', weight: 0.55 }, { muscle: 'Schultern', weight: 0.20 }], equipment: ['Körpergewicht', 'Gewichtsgürtel'] },
  { name: 'Klimmzüge',         muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.50 }], equipment: ['Körpergewicht', 'Gewichtsgürtel'] },
  { name: 'Rudern',            muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.40 }, { muscle: 'Schultern', weight: 0.15 }], equipment: ['Langhantel', 'Kurzhantel', 'Kabelzug', 'Maschine'] },
  { name: 'Kreuzheben',        muscleGroup: 'Rücken',     secondary: [{ muscle: 'Hamstrings', weight: 0.55 }, { muscle: 'Gluteus', weight: 0.40 }, { muscle: 'Core', weight: 0.30 }], equipment: ['Langhantel', 'Sumo'] },
  { name: 'Latzug',            muscleGroup: 'Rücken',     secondary: [{ muscle: 'Bizeps', weight: 0.45 }], equipment: ['Kabelzug breit', 'Kabelzug eng'] },
  { name: 'Schulterdrücken',   muscleGroup: 'Schultern',  secondary: [{ muscle: 'Trizeps', weight: 0.40 }], equipment: ['Langhantel', 'Kurzhantel', 'Maschine'] },
  { name: 'Seitheben',         muscleGroup: 'Schultern',  secondary: [], equipment: ['Kurzhantel', 'Kabelzug'] },
  { name: 'Curls',             muscleGroup: 'Bizeps',     secondary: [], equipment: ['Kurzhantel', 'Langhantel', 'Kabelzug'] },
  { name: 'Hammer Curls',      muscleGroup: 'Bizeps',     secondary: [], equipment: ['Kurzhantel'] },
  { name: 'Trizepsdrücken',    muscleGroup: 'Trizeps',    secondary: [], equipment: ['Kabelzug', 'Kurzhantel'] },
  { name: 'Skull Crushers',    muscleGroup: 'Trizeps',    secondary: [], equipment: ['Langhantel', 'EZ-Stange'] },
  { name: 'Kniebeugen',        muscleGroup: 'Quadrizeps', secondary: [{ muscle: 'Hamstrings', weight: 0.30 }, { muscle: 'Gluteus', weight: 0.45 }, { muscle: 'Core', weight: 0.20 }], equipment: ['Langhantel (High Bar)', 'Langhantel (Low Bar)', 'Smith'] },
  { name: 'Beinpresse',        muscleGroup: 'Quadrizeps', secondary: [{ muscle: 'Gluteus', weight: 0.30 }], equipment: ['Maschine 45°'] },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', secondary: [{ muscle: 'Gluteus', weight: 0.45 }], equipment: ['Langhantel', 'Kurzhantel'] },
  { name: 'Hip Thrust',        muscleGroup: 'Gluteus',    secondary: [{ muscle: 'Hamstrings', weight: 0.25 }], equipment: ['Langhantel', 'Maschine'] },
  { name: 'Wadenheben',        muscleGroup: 'Waden',      secondary: [], equipment: ['Maschine stehend', 'Körpergewicht'] },
  { name: 'Plank',             muscleGroup: 'Core',       secondary: [], equipment: ['Körpergewicht'] },
  { name: 'Crunches',          muscleGroup: 'Core',       secondary: [], equipment: ['Körpergewicht', 'Kabelzug'] },
];

const IconEdit = ({ size = 16, color = '#B0A89E' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);


const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core'];

const MUSCLE_COLORS: Record<string, string> = {
  Brust: '#EC4899', Rücken: '#7C3AED', Schultern: '#06B6D4',
  Bizeps: '#10B981', Trizeps: '#F59E0B', Quadrizeps: '#FB7185',
  Hamstrings: '#A78BFA', Gluteus: '#F472B6', Waden: '#67E8F9', Core: '#FB923C',
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
    { name: 'Curls', muscleGroup: 'Bizeps', defaultSets: 3, equipment: 'Kurzhantel' },
    { name: 'Hammer Curls', muscleGroup: 'Bizeps', defaultSets: 3, equipment: 'Kurzhantel' },
  ]},
  { id: 'c3', name: 'Leg Day', exercises: [
    { name: 'Kniebeugen', muscleGroup: 'Quadrizeps', defaultSets: 4, equipment: 'Langhantel (High Bar)' },
    { name: 'Beinpresse', muscleGroup: 'Quadrizeps', defaultSets: 4, equipment: 'Maschine 45°' },
    { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', defaultSets: 3, equipment: 'Langhantel' },
    { name: 'Hip Thrust', muscleGroup: 'Gluteus', defaultSets: 3, equipment: 'Langhantel' },
    { name: 'Wadenheben', muscleGroup: 'Waden', defaultSets: 4, equipment: 'Maschine stehend' },
  ]},
];

const MAX_SETS_FOR_FULL_FATIGUE = 6;

// Maps ALL_EXERCISES categories (and other muscleGroup labels) to the
// canonical MUSCLE_GROUPS used for recovery tracking.
const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  'Rücken (Breite)': 'Rücken',
  'Rücken (Dicke)': 'Rücken',
  'Rücken (Unterer)': 'Rücken',
  'Trapez': 'Rücken',
  'Gesäß': 'Gluteus',
  'Bauch': 'Core',
  'Obliques': 'Core',
  'Adduktoren': 'Quadrizeps',
  'Abduktoren': 'Gluteus',
  'Olympic Lifts': 'Quadrizeps',
};
function resolveMuscleGroup(mg: string | undefined): string | null {
  if (!mg) return null;
  if (MUSCLE_GROUPS.includes(mg)) return mg;
  return MUSCLE_GROUP_ALIASES[mg] ?? null;
}

// Muskel-Belastung für Workouts ohne Übungsliste (Cardio, Apple Health Imports).
// Gewichtung wird zusätzlich mit der Trainingsdauer skaliert (45 Min = volle Wirkung).
const CARDIO_MUSCLE_IMPACT: Record<string, { muscle: string; weight: number }[]> = {
  run: [
    { muscle: 'Quadrizeps', weight: 0.50 },
    { muscle: 'Hamstrings', weight: 0.45 },
    { muscle: 'Waden', weight: 0.60 },
    { muscle: 'Gluteus', weight: 0.35 },
    { muscle: 'Core', weight: 0.20 },
  ],
  judo: [
    { muscle: 'Core', weight: 0.50 },
    { muscle: 'Schultern', weight: 0.40 },
    { muscle: 'Rücken', weight: 0.35 },
    { muscle: 'Bizeps', weight: 0.25 },
    { muscle: 'Trizeps', weight: 0.25 },
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Hamstrings', weight: 0.25 },
  ],
  gym: [
    { muscle: 'Brust', weight: 0.25 },
    { muscle: 'Rücken', weight: 0.25 },
    { muscle: 'Schultern', weight: 0.20 },
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Hamstrings', weight: 0.25 },
    { muscle: 'Core', weight: 0.30 },
  ],
  cardio: [
    { muscle: 'Quadrizeps', weight: 0.30 },
    { muscle: 'Waden', weight: 0.30 },
    { muscle: 'Core', weight: 0.20 },
    { muscle: 'Schultern', weight: 0.10 },
  ],
  manual: [
    { muscle: 'Quadrizeps', weight: 0.25 },
    { muscle: 'Core', weight: 0.20 },
  ],
};

function calculateMuscleRecovery(workouts: Workout[]): MuscleMap {
  const cutoff = Date.now() - 7 * 24 * 3600000;
  const hitMap: Record<string, { date: string; fatigue: number }[]> = {};

  workouts
    .filter(w => new Date(w.date).getTime() > cutoff)
    .forEach(w => {
      if (!w.exercises || w.exercises.length === 0) {
        const durationFactor = Math.min(1, (w.duration || 0) / 45);
        if (durationFactor <= 0) return;
        const impacts = CARDIO_MUSCLE_IMPACT[w.type] ?? CARDIO_MUSCLE_IMPACT.cardio;
        impacts.forEach(({ muscle, weight }) => {
          if (!hitMap[muscle]) hitMap[muscle] = [];
          hitMap[muscle].push({ date: w.date, fatigue: Math.min(1, weight * durationFactor) });
        });
        return;
      }

      w.exercises.forEach(ex => {
        const setCount = ex.sets.filter(
          s => parseFloat(s.reps || '0') > 0 && parseFloat(s.weight || '0') > 0
        ).length || ex.sets.length;

        const primaryFatigue = Math.min(1.0, setCount / MAX_SETS_FOR_FULL_FATIGUE);

        const exData = EXERCISE_DB.find(e => e.name === ex.name);
        if (exData) {
          if (!hitMap[exData.muscleGroup]) hitMap[exData.muscleGroup] = [];
          hitMap[exData.muscleGroup].push({ date: w.date, fatigue: primaryFatigue });

          exData.secondary.forEach(sec => {
            const secFatigue = Math.min(1.0, (setCount / MAX_SETS_FOR_FULL_FATIGUE) * sec.weight);
            if (!hitMap[sec.muscle]) hitMap[sec.muscle] = [];
            hitMap[sec.muscle].push({ date: w.date, fatigue: secFatigue });
          });
          return;
        }

        // Exercise picked from ALL_EXERCISES (not in EXERCISE_DB) — fall back
        // to the muscleGroup/category stored on the exercise itself.
        const mg = resolveMuscleGroup(ex.muscleGroup);
        if (mg) {
          if (!hitMap[mg]) hitMap[mg] = [];
          hitMap[mg].push({ date: w.date, fatigue: primaryFatigue });
        }
      });
    });

  const result: MuscleMap = {};

  MUSCLE_GROUPS.forEach(m => {
    const hits = hitMap[m] ?? [];
    if (hits.length === 0) {
      result[m] = { level: 100, lastTrained: null };
      return;
    }

    const recoveryHours = MUSCLE_RECOVERY_HOURS[m] ?? 48;
    const now = Date.now();
    let totalRemainingFatigue = 0;

    hits.forEach(hit => {
      const hoursElapsed = (now - new Date(hit.date).getTime()) / 3600000;
      const recoveredFraction = Math.min(1.0, hoursElapsed / recoveryHours);
      totalRemainingFatigue += hit.fatigue * (1 - recoveredFraction);
    });

    totalRemainingFatigue = Math.min(1.0, totalRemainingFatigue);

    const lastTrained = hits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0].date;

    result[m] = {
      level: Math.round((1 - totalRemainingFatigue) * 100),
      lastTrained,
    };
  });

  return result;
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
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function formatPace(paceSeconds: number) {
  if (!paceSeconds || !isFinite(paceSeconds) || paceSeconds <= 0) return '--:--';
  const m = Math.floor(paceSeconds / 60), s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function isToday(dateString: string) {
  const d = new Date(dateString), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function daysSince(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}
function formatDateLabel(iso: string, todayStr = 'Heute') {
  const d = new Date(iso);
  if (isToday(iso)) return `${todayStr}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function getWeekTrainings(workouts: Workout[]): boolean[] {
  const result = [false, false, false, false, false, false, false];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  for (const w of workouts) {
    const d = new Date(w.date); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
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
  if (intensity === 'high') return { immediate: { protein: Math.round(w * 0.4), carbs: Math.round(w * 0.8), timingKey: 'training_timing_now_high' }, later: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timingKey: 'training_timing_later_high' } };
  if (intensity === 'medium') return { immediate: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timingKey: 'training_timing_now_medium' }, later: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timingKey: 'training_timing_later_medium' } };
  return { immediate: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timingKey: 'training_timing_now_low' }, later: { protein: Math.round(w * 0.2), carbs: Math.round(w * 0.2), timingKey: 'training_timing_later_low' } };
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Icons ────────────────────────────────────────────────────
function IconPlay({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 4l15 8-15 8V4z" fill={color} /></Svg>;
}
function IconChevronRight({ color = '#7A6E63', size = 16 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;
}
function IconChevronLeft({ color = '#5A4A3A', size = 20 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;
}
function IconClose({ color = '#5A4A3A', size = 15 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconCheck({ color = '#FFFFFF', size = 13 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconDumbbell({ color = '#7B4A2D', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 28 28" fill="none"><Rect x="2" y="11" width="4" height="6" rx="1.5" fill={color} /><Rect x="22" y="11" width="4" height="6" rx="1.5" fill={color} /><Rect x="5" y="9" width="3" height="10" rx="1.5" fill={color} /><Rect x="20" y="9" width="3" height="10" rx="1.5" fill={color} /><Rect x="8" y="12.5" width="12" height="3" rx="1.5" fill={color} /></Svg>;
}
function IconPencil({ color = '#3A7AC0', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a1 1 0 00-1 1v15a1 1 0 001 1h15a1 1 0 001-1v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconTrophy({ color = '#8B6914', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4a1 1 0 01-1-1V4a1 1 0 011-1h16a1 1 0 011 1v4a1 1 0 01-1 1h-2m-10 0c0 4 3 8 6 8s6-4 6-8m-12 0h12M12 17v4m-4 0h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconHistory({ color = '#7B4A2D', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 3v18M3 17l6-6 4 4 8-8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconPlus({ color = '#7B4A2D', size = 20 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconSearch({ color = '#7A6E63', size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.8} /><Path d="M16.5 16.5L21 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconTrash({ color = '#C0392B', size = 17 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconArrowUp({ color = '#4A8C5C', size = 14 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconArrowDown({ color = '#C0392B', size = 14 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconSync({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M21 2v6h-6M3 22v-6h6M21 13a9 9 0 01-15.66 5.34M3 11a9 9 0 0115.66-5.34" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconList({ color = '#7B4A2D', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconChevronsRight({ color = '#FFFFFF', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M7 17l5-5-5-5M13 17l5-5-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconRun({ color = '#4A8C5C', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={14} cy={4} r={2} stroke={color} strokeWidth={1.8} /><Path d="M6 20l4-7 3 3 3-6 3 3M5 10l5 3 3-5 3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function getMuscleRecoveryColor(level: number): string {
  if (level >= 80) return '#4A8C5C';
  if (level >= 60) return '#3A7AC0';
  if (level >= 40) return '#8B6914';
  if (level >= 20) return '#7B4A2D';
  return '#C0392B';
}
// ─── Body SVG (front & back) ──────────────────────────────────
function BodyFront({ muscles }: { muscles: MuscleMap }) {
  const c = (n: string) => getMuscleRecoveryColor(muscles[n]?.level ?? 100);
  const o = (n: string) => 0.22 + ((muscles[n]?.level ?? 100) / 100) * 0.66;
  return (
    <Svg width={105} height={235} viewBox="0 0 105 235">
      <Defs>
        <RadialGradient id="skF" cx="50%" cy="38%" r="62%">
          <Stop offset="0%" stopColor="#C88050" />
          <Stop offset="100%" stopColor="#8A5228" />
        </RadialGradient>
        <RadialGradient id="bodyF" cx="50%" cy="30%" r="68%">
          <Stop offset="0%" stopColor="#B07038" />
          <Stop offset="100%" stopColor="#7A4220" />
        </RadialGradient>
      </Defs>
      {/* Head */}
      <Ellipse cx={52} cy={17} rx={14} ry={16} fill="url(#skF)" />
      <Path d="M38,13 Q41,2 52,1 Q63,2 66,13 Q60,6 52,6 Q44,6 38,13Z" fill="#140A04" />
      {/* Neck */}
      <Rect x={46} y={31} width={12} height={9} rx={4} fill="#AA6832" />
      {/* Torso */}
      <Path d="M24,42 Q52,36 80,42 L83,115 Q52,124 21,115Z" fill="url(#bodyF)" />
      {/* Chest */}
      <Path d="M26,46 Q37,42 50,45 Q54,51 52,62 Q50,69 43,71 Q34,69 29,62 Q24,55 26,46Z" fill={c('Brust')} opacity={o('Brust')} />
      <Path d="M78,46 Q67,42 54,45 Q50,51 52,62 Q54,69 61,71 Q70,69 75,62 Q80,55 78,46Z" fill={c('Brust')} opacity={o('Brust')} />
      <Line x1={52} y1={45} x2={52} y2={72} stroke="rgba(0,0,0,0.13)" strokeWidth={0.8} />
      {/* Shoulders */}
      <Ellipse cx={18} cy={55} rx={10} ry={13} fill={c('Schultern')} opacity={o('Schultern')} />
      <Ellipse cx={86} cy={55} rx={10} ry={13} fill={c('Schultern')} opacity={o('Schultern')} />
      {/* Biceps */}
      <Path d="M10,67 Q5,75 6,87 Q7,97 14,100 Q21,102 24,93 Q27,84 24,74Z" fill={c('Bizeps')} opacity={o('Bizeps')} />
      <Path d="M94,67 Q99,75 98,87 Q97,97 90,100 Q83,102 80,93 Q77,84 80,74Z" fill={c('Bizeps')} opacity={o('Bizeps')} />
      {/* Forearms */}
      <Rect x={7} y={99} width={13} height={24} rx={6} fill="#9A5E28" opacity={0.55} />
      <Rect x={85} y={99} width={13} height={24} rx={6} fill="#9A5E28" opacity={0.55} />
      <Ellipse cx={10} cy={127} rx={6} ry={8} fill="#864E1E" opacity={0.7} />
      <Ellipse cx={95} cy={127} rx={6} ry={8} fill="#864E1E" opacity={0.7} />
      {/* Abs */}
      <Path d="M38,73 Q52,77 66,73 L68,113 Q52,120 36,113Z" fill={c('Core')} opacity={o('Core') * 0.6} />
      <Rect x={43} y={75} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      <Rect x={53} y={75} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      <Rect x={43} y={84} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      <Rect x={53} y={84} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      <Rect x={43} y={93} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      <Rect x={53} y={93} width={7} height={6} rx={2} fill={c('Core')} opacity={o('Core')} />
      {/* Shorts */}
      <Path d="M24,113 Q52,122 80,113 L82,127 Q52,136 22,127Z" fill="#141414" />
      {/* Quads */}
      <Path d="M28,131 Q21,135 19,151 Q17,165 23,177 Q29,185 36,183 Q43,179 45,163 Q46,147 41,135Z" fill={c('Quadrizeps')} opacity={o('Quadrizeps')} />
      <Path d="M76,131 Q83,135 85,151 Q87,165 81,177 Q75,185 68,183 Q61,179 59,163 Q58,147 63,135Z" fill={c('Quadrizeps')} opacity={o('Quadrizeps')} />
      {/* Knees */}
      <Ellipse cx={32} cy={187} rx={10} ry={7} fill="#8A4E1E" opacity={0.42} />
      <Ellipse cx={72} cy={187} rx={10} ry={7} fill="#8A4E1E" opacity={0.42} />
      {/* Calves */}
      <Path d="M24,193 Q19,201 20,213 Q21,222 28,226 Q34,228 37,219 Q39,208 37,197Z" fill={c('Waden')} opacity={o('Waden')} />
      <Path d="M80,193 Q85,201 84,213 Q83,222 76,226 Q70,228 67,219 Q65,208 67,197Z" fill={c('Waden')} opacity={o('Waden')} />
    </Svg>
  );
}

function BodyBack({ muscles }: { muscles: MuscleMap }) {
  const c = (n: string) => getMuscleRecoveryColor(muscles[n]?.level ?? 100);
  const o = (n: string) => 0.22 + ((muscles[n]?.level ?? 100) / 100) * 0.66;
  return (
    <Svg width={105} height={235} viewBox="0 0 105 235">
      <Defs>
        <RadialGradient id="bodyB" cx="50%" cy="30%" r="68%">
          <Stop offset="0%" stopColor="#AA6832" />
          <Stop offset="100%" stopColor="#7A4220" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={52} cy={17} rx={14} ry={16} fill="#AA6832" />
      <Path d="M38,13 Q41,2 52,1 Q63,2 66,13 Q60,6 52,6 Q44,6 38,13Z" fill="#140A04" />
      <Rect x={46} y={31} width={12} height={9} rx={4} fill="#9A5E28" />
      <Path d="M24,42 Q52,36 80,42 L83,115 Q52,124 21,115Z" fill="url(#bodyB)" />
      {/* Traps */}
      <Path d="M36,42 Q52,36 68,42 Q62,48 52,50 Q42,48 36,42Z" fill={c('Schultern')} opacity={o('Schultern')} />
      {/* Rear delts */}
      <Ellipse cx={17} cy={55} rx={10} ry={13} fill={c('Schultern')} opacity={o('Schultern')} />
      <Ellipse cx={87} cy={55} rx={10} ry={13} fill={c('Schultern')} opacity={o('Schultern')} />
      {/* Lats */}
      <Path d="M26,50 Q18,58 17,76 Q16,94 24,106 Q32,114 40,108 Q45,100 43,80 Q41,62 36,52Z" fill={c('Rücken')} opacity={o('Rücken')} />
      <Path d="M78,50 Q86,58 87,76 Q88,94 80,106 Q72,114 64,108 Q59,100 61,80 Q63,62 68,52Z" fill={c('Rücken')} opacity={o('Rücken')} />
      <Path d="M40,52 Q52,48 64,52 Q64,70 52,74 Q40,70 40,52Z" fill={c('Rücken')} opacity={o('Rücken') * 0.8} />
      <Line x1={52} y1={50} x2={52} y2={114} stroke="rgba(0,0,0,0.14)" strokeWidth={0.8} />
      {/* Triceps */}
      <Path d="M9,66 Q4,76 5,90 Q6,102 13,105 Q20,107 23,98 Q26,88 23,77Z" fill={c('Trizeps')} opacity={o('Trizeps')} />
      <Path d="M95,66 Q100,76 99,90 Q98,102 91,105 Q84,107 81,98 Q78,88 81,77Z" fill={c('Trizeps')} opacity={o('Trizeps')} />
      {/* Forearms */}
      <Rect x={7} y={104} width={13} height={24} rx={6} fill="#9A5E28" opacity={0.5} />
      <Rect x={85} y={104} width={13} height={24} rx={6} fill="#9A5E28" opacity={0.5} />
      <Ellipse cx={10} cy={132} rx={6} ry={8} fill="#864E1E" opacity={0.65} />
      <Ellipse cx={95} cy={132} rx={6} ry={8} fill="#864E1E" opacity={0.65} />
      {/* Shorts */}
      <Path d="M22,115 Q52,125 82,115 L84,130 Q52,140 20,130Z" fill="#141414" />
      {/* Glutes */}
      <Path d="M24,128 Q17,134 17,150 Q17,164 26,171 Q35,176 41,166 Q46,154 44,140Z" fill={c('Gluteus')} opacity={o('Gluteus')} />
      <Path d="M80,128 Q87,134 87,150 Q87,164 78,171 Q69,176 63,166 Q58,154 60,140Z" fill={c('Gluteus')} opacity={o('Gluteus')} />
      {/* Hamstrings */}
      <Path d="M26,173 Q20,182 20,196 Q20,208 28,214 Q35,217 39,208 Q42,196 40,182Z" fill={c('Hamstrings')} opacity={o('Hamstrings')} />
      <Path d="M78,173 Q84,182 84,196 Q84,208 76,214 Q69,217 65,208 Q62,196 64,182Z" fill={c('Hamstrings')} opacity={o('Hamstrings')} />
      {/* Knees */}
      <Ellipse cx={32} cy={216} rx={9} ry={6} fill="#864E1E" opacity={0.38} />
      <Ellipse cx={72} cy={216} rx={9} ry={6} fill="#864E1E" opacity={0.38} />
      {/* Calves */}
      <Path d="M24,221 Q19,229 20,241 Q21,250 28,253 Q34,255 37,246 Q39,235 37,224Z" fill={c('Waden')} opacity={o('Waden')} />
      <Path d="M80,221 Q85,229 84,241 Q83,250 76,253 Q70,255 67,246 Q65,235 67,224Z" fill={c('Waden')} opacity={o('Waden')} />
    </Svg>
  );
}

// ─── Shared UI ────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 28, marginBottom: 14, gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: T.borderSoft }} />
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: T.borderSoft }} />
    </View>
  );
}

// ─── SwipeToStart ─────────────────────────────────────────────
function SwipeToStart({ onStart }: { onStart: () => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t } = useLanguage();
  const sw = { track: { backgroundColor: T.card, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 50, padding: 6, height: 68, overflow: 'hidden' as const, justifyContent: 'center' as const }, thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.orange, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 2 }, label: { position: 'absolute' as const, left: 0, right: 0, textAlign: 'center' as const, fontSize: 13, fontWeight: '600' as const, color: T.text3 } };
  const THUMB = 56;
  const [trackWidth, setTrackWidth] = useState(SW - 64);
  const MAX = trackWidth - THUMB - 12;
  const tx = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { done.current = false; },
    onPanResponderMove: (_, gs) => { tx.setValue(Math.max(0, Math.min(gs.dx, MAX))); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > MAX * 0.7 && !done.current) {
        done.current = true;
        Animated.timing(tx, { toValue: MAX, duration: 100, useNativeDriver: true }).start(() => {
          onStart();
          setTimeout(() => { tx.setValue(0); done.current = false; }, 500);
        });
      } else {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    },
  })).current;
  const labelOpacity = tx.interpolate({ inputRange: [0, MAX * 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View onLayout={e => setTrackWidth(e.nativeEvent.layout.width)} style={sw.track}>
      <Animated.Text style={[sw.label, { opacity: labelOpacity }]}>{t('training_swipe_start')}</Animated.Text>
      <Animated.View style={[sw.thumb, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <IconChevronsRight color="#fff" size={22} />
      </Animated.View>
    </View>
  );
}

// ─── Timers ───────────────────────────────────────────────────
function useWorkoutTimer(key: string) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const interval = useRef<any>(null);
  useEffect(() => {
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      try { const { startedAt } = JSON.parse(raw); if (startedAt) { startRef.current = startedAt; setSeconds(Math.floor((Date.now() - startedAt) / 1000)); setIsRunning(true); } } catch {}
    });
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => { if (s === 'active' && startRef.current) setSeconds(Math.floor((Date.now() - startRef.current) / 1000)); });
    return () => { sub.remove(); clearInterval(interval.current); };
  }, [key]);
  useEffect(() => {
    if (isRunning && startRef.current) { interval.current = setInterval(() => { if (startRef.current) setSeconds(Math.floor((Date.now() - startRef.current) / 1000)); }, 1000); }
    else clearInterval(interval.current);
    return () => clearInterval(interval.current);
  }, [isRunning]);
  const startNow = useCallback(async () => { const now = Date.now(); startRef.current = now; await AsyncStorage.setItem(key, JSON.stringify({ startedAt: now })); setIsRunning(true); }, [key]);
  const stop = useCallback(async () => { clearInterval(interval.current); startRef.current = null; setIsRunning(false); setSeconds(0); await AsyncStorage.removeItem(key); }, [key]);
  const getDuration = useCallback(() => { if (!startRef.current) return 0; return Math.max(1, Math.round((Date.now() - startRef.current) / 60000)); }, []);
  return { seconds, isRunning, startNow, stop, getDuration };
}

function useRestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [target, setTarget] = useState(90);
  const startRef = useRef<number | null>(null);
  const interval = useRef<any>(null);
  const KEY = 'restTimerData';
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (!raw) return;
      try { const { startedAt, t } = JSON.parse(raw); if (startedAt && t) { const rem = Math.max(0, t - Math.floor((Date.now() - startedAt) / 1000)); if (rem > 0) { startRef.current = startedAt; setTarget(t); setSeconds(rem); setIsRunning(true); } else AsyncStorage.removeItem(KEY); } } catch {}
    });
  }, []);
  useEffect(() => {
    if (isRunning && startRef.current) {
      interval.current = setInterval(() => {
        if (!startRef.current) return;
        const rem = Math.max(0, target - Math.floor((Date.now() - startRef.current) / 1000));
        setSeconds(rem);
        if (rem === 0) { setIsRunning(false); startRef.current = null; AsyncStorage.removeItem(KEY); clearInterval(interval.current); }
      }, 1000);
    } else clearInterval(interval.current);
    return () => clearInterval(interval.current);
  }, [isRunning, target]);
  const startFor = (secs: number) => { const now = Date.now(); startRef.current = now; setTarget(secs); setSeconds(secs); setIsRunning(true); AsyncStorage.setItem(KEY, JSON.stringify({ startedAt: now, t: secs })); };
  const stopRest = () => { setIsRunning(false); setSeconds(0); startRef.current = null; AsyncStorage.removeItem(KEY); };
  return { seconds, isRunning, startFor, stop: stopRest, pct: target > 0 ? Math.max(0, seconds / target) : 0 };
}

// ─── Exercise Picker ──────────────────────────────────────────
const PICKER_MUSCLE_GROUPS = [
  { name: 'Brust', categories: ['Brust'], color: '#EC4899', image: require('../../assets/muscles/brust.png') },
  { name: 'Rücken', categories: ['Rücken (Breite)', 'Rücken (Dicke)', 'Rücken (Unterer)', 'Trapez'], color: '#7C3AED', image: require('../../assets/muscles/ruecken.png') },
  { name: 'Schultern', categories: ['Schultern'], color: '#06B6D4', image: require('../../assets/muscles/schultern.png') },
  { name: 'Bizeps', categories: ['Bizeps'], color: '#10B981', image: require('../../assets/muscles/bizeps.png') },
  { name: 'Trizeps', categories: ['Trizeps'], color: '#F59E0B', image: require('../../assets/muscles/trizeps.png') },
  { name: 'Quadrizeps', categories: ['Quadrizeps'], color: '#FB7185', image: require('../../assets/muscles/quadrizeps.png') },
  { name: 'Hamstrings', categories: ['Hamstrings'], color: '#A78BFA', image: require('../../assets/muscles/hamstrings.png') },
  { name: 'Gesäß', categories: ['Gesäß'], color: '#F472B6', image: require('../../assets/muscles/gesaess.png') },
  { name: 'Waden', categories: ['Waden'], color: '#67E8F9', image: require('../../assets/muscles/waden.png') },
  { name: 'Core', categories: ['Core', 'Bauch', 'Obliques'], color: '#FB923C', image: require('../../assets/muscles/core.png') },
  { name: 'Abduktoren', categories: ['Abduktoren', 'Adduktoren'], color: '#D946EF', image: require('../../assets/muscles/abduktoren.png') },
  { name: 'Olympic', categories: ['Olympic Lifts'], color: '#F59E0B', image: require('../../assets/muscles/olympic.png') },
];

function ExercisePicker({ onSelect, onClose }: {
  onSelect: (name: string, muscleGroup: string, equipment: string) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedMG, setSelectedMG] = useState<typeof PICKER_MUSCLE_GROUPS[0] | null>(null);

  const searchResults = search.length > 0
    ? ALL_EXERCISES.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const mgExercises = selectedMG
    ? ALL_EXERCISES.filter(e => selectedMG.categories.includes(e.category))
    : null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>

          {/* Header */}
          <View style={{ padding: 20, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1, letterSpacing: -0.5 }}>
                {selectedMG ? selectedMG.name : t('training_add_exercise')}
              </Text>
              <TouchableOpacity onPress={selectedMG ? () => setSelectedMG(null) : onClose}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                {selectedMG
                  ? <IconChevronLeft size={16} color={T.text2} />
                  : <IconClose size={14} color={T.text2} />
                }
              </TouchableOpacity>
            </View>

            {/* Suche */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: T.border }}>
              <IconSearch size={16} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: T.text1 }}
                placeholder={t('training_search_placeholder')}
                placeholderTextColor={T.text4}
                value={search}
                onChangeText={v => { setSearch(v); if (v.length > 0) setSelectedMG(null); }}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <IconClose size={13} color={T.text4} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>

            {/* Suchergebnisse */}
            {searchResults && (
              <>
                {searchResults.map(ex => (
                  <TouchableOpacity key={ex.id}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardAlt, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }}
                    onPress={() => onSelect(ex.name, ex.category, '')}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: T.text1, fontWeight: '500' }}>{ex.name}</Text>
                      <Text style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{ex.category}</Text>
                    </View>
                    <IconChevronRight />
                  </TouchableOpacity>
                ))}
                {searchResults.length === 0 && (
                  <Text style={{ color: T.text4, textAlign: 'center', padding: 20, fontSize: 13 }}>{t('training_no_exercise_found')}</Text>
                )}
              </>
            )}

            {/* Muskelgruppen Grid */}
{!searchResults && !selectedMG && (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {PICKER_MUSCLE_GROUPS.map(mg => (
      <TouchableOpacity key={mg.name} onPress={() => setSelectedMG(mg)}
        style={{ width: (SW - 48) / 3, backgroundColor: T.cardAlt, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border, gap: 6 }}>
        <Image source={mg.image} style={{ width: 48, height: 48 }} resizeMode="contain" />
        <Text style={{ fontSize: 11, fontWeight: '700', color: T.text1, textAlign: 'center' }}>{mg.name}</Text>
        <Text style={{ fontSize: 9, color: T.text4 }}>{ALL_EXERCISES.filter(e => mg.categories.includes(e.category)).length} {t('training_exercises_abbr')}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}

            {/* Übungen der gewählten Muskelgruppe */}
            {!searchResults && selectedMG && mgExercises && (
              <>
                {mgExercises.map(ex => (
                  <TouchableOpacity key={ex.id}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardAlt, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }}
                    onPress={() => onSelect(ex.name, ex.category, '')}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedMG.color, marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 14, color: T.text1, fontWeight: '500' }}>{ex.name}</Text>
                    <IconChevronRight />
                  </TouchableOpacity>
                ))}
              </>
            )}

          </ScrollView>

          <TouchableOpacity style={{ padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: T.borderSoft }} onPress={onClose}>
            <Text style={{ fontSize: 14, color: T.text3 }}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}


// ─── PR Entry Screen ──────────────────────────────────────────
function PREntryScreen({ onClose, onSave, editExercise, editWeight, editReps }: {
  onClose: () => void;
  onSave: (name: string, weight: number, reps: number) => void;
  editExercise?: string;
  editWeight?: number;
  editReps?: number;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t } = useLanguage();
  const isEdit = !!editExercise;
  const [step, setStep] = useState<'exercise' | 'entry'>(isEdit ? 'entry' : 'exercise');
  const [exercise, setExercise] = useState(editExercise ?? '');
  const [reps, setReps] = useState<1 | 2 | 3>((editReps === 1 || editReps === 2 || editReps === 3) ? editReps : 1);
  const [weight, setWeight] = useState(editWeight ? String(editWeight) : '');
  const [search, setSearch] = useState('');
  const filtered = ALL_EXERCISES.filter(e => search === '' || e.name.toLowerCase().includes(search.toLowerCase()));
  const estimated1RM = weight !== '' && parseFloat(weight) > 0 ? calc1RM(parseFloat(weight), reps) : null;
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: T.borderSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', backgroundColor: T.card }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 5 }}>{isEdit ? t('training_pr_edit') : t('training_pr')}</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }}>{step === 'exercise' ? t('training_choose_exercise') : exercise}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
            <IconClose />
          </TouchableOpacity>
        </View>
        {step === 'exercise' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
              <IconSearch />
              <TextInput style={{ flex: 1, fontSize: 14, color: T.text1 }} placeholder={t('training_search_placeholder')} placeholderTextColor={T.text4} value={search} onChangeText={setSearch} />
            </View>
            {filtered.map(ex => (
              <TouchableOpacity key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardAlt, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }} onPress={() => { setExercise(ex.name); setStep('entry'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: T.text1, fontWeight: '500' }}>{ex.name}</Text>
                  <Text style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{ex.category}</Text>
                </View>
                <IconChevronRight />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, padding: 14, marginBottom: 28, borderWidth: 1, borderColor: T.border }} onPress={() => !isEdit && setStep('exercise')}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.orange }} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.text1 }}>{exercise}</Text>
              {!isEdit && <IconChevronRight color={T.text4} size={14} />}
            </TouchableOpacity>
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text4, marginBottom: 12 }}>{t('training_reps')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
              {([1, 2, 3] as const).map(r => {
                const active = reps === r;
                return (
                  <TouchableOpacity key={r} style={{ flex: 1, backgroundColor: active ? T.orangeAlpha : T.cardAlt, borderRadius: 16, borderWidth: 1, borderColor: active ? T.orange : T.border, paddingVertical: 18, alignItems: 'center' }} onPress={() => setReps(r)} activeOpacity={0.75}>
                    <Text style={{ fontSize: 34, fontWeight: '700', letterSpacing: -0.5, color: active ? T.orange : T.text2, marginBottom: 3 }}>{r}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: active ? T.orange : T.text4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{r === 1 ? 'Rep' : 'Reps'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text4, marginBottom: 12 }}>{t('training_weight')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, backgroundColor: T.cardAlt, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1, borderColor: T.border, marginBottom: 14 }}>
              <TextInput style={{ fontSize: 56, fontWeight: '800', color: T.text1, letterSpacing: -2, flex: 1, padding: 0 }} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={T.text4} autoFocus={!isEdit} returnKeyType="done" />
              <Text style={{ fontSize: 20, color: T.text4, fontWeight: '600' }}>kg</Text>
            </View>
            {estimated1RM !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.orangeAlpha, borderRadius: 12, borderWidth: 1, borderColor: T.orangeBorder, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: T.orange }}>Est. 1RM</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: T.orange }}>{estimated1RM} kg</Text>
              </View>
            )}
            <TouchableOpacity style={{ backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => { const w = parseFloat(weight); if (!w || w <= 0) { Alert.alert(t('training_enter_weight_alert')); return; } onSave(exercise, w, reps); onClose(); }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: T.white }}>{isEdit ? t('training_pr_update') : t('training_pr_save')}</Text>
            </TouchableOpacity>
            {!isEdit && <TouchableOpacity style={{ padding: 14, alignItems: 'center', marginTop: 4 }} onPress={() => setStep('exercise')}><Text style={{ fontSize: 13, color: T.text3 }}>{t('training_other_exercise')}</Text></TouchableOpacity>}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function HistoryScreen({ onClose, onDelete }: { onClose: () => void; onDelete: (id: string) => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t, lang } = useLanguage();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('workouts').then(r => r && setWorkouts(JSON.parse(r)));
    AsyncStorage.getItem('runs').then(r => r && setRuns(JSON.parse(r)));
  }, []);
  type Item = { _kind: 'workout'; data: Workout } | { _kind: 'run'; data: RunData };
  const all: Item[] = [
    ...workouts.map(w => ({ _kind: 'workout' as const, data: w })),
    ...runs.map(r => ({ _kind: 'run' as const, data: r })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  async function handleDelete(item: Item) {
    Alert.alert(t('training_delete_title'), t('training_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        if (item._kind === 'workout') {
          const u = workouts.filter(w => w.id !== item.data.id);
          setWorkouts(u);
          await AsyncStorage.setItem('workouts', JSON.stringify(u));
          onDelete(item.data.id);
        } else {
          const u = runs.filter(r => r.id !== item.data.id);
          setRuns(u);
          await AsyncStorage.setItem('runs', JSON.stringify(u));
        }
      }},
    ]);
  }

  const avgDuration = workouts.length > 0
    ? Math.round(workouts.reduce((s, w) => s + (w.duration || 0), 0) / workouts.length)
    : 0;
  const avgScore = workouts.filter(w => w.score).length > 0
    ? Math.round(workouts.filter(w => w.score).reduce((s, w) => s + (w.score || 0), 0) / workouts.filter(w => w.score).length)
    : 0;

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>

        {/* Header */}
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 4 }}>{t('training_title')}</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }}>{t('training_history_label')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
            <IconClose />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: T.text1 }}>{workouts.length + runs.length}</Text>
            <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{t('training_units')}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: T.text1 }}>{avgDuration}'</Text>
            <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{t('training_avg_duration')}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: T.green }}>{avgScore}</Text>
            <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{t('training_avg_score')}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
          {all.length === 0 && (
            <Text style={{ color: T.text3, textAlign: 'center', marginTop: 60 }}>{t('training_no_sessions')}</Text>
          )}

          {all.map((item, i) => {
            const isRun = item._kind === 'run';
            const w = !isRun ? item.data as Workout : null;
            const r = isRun ? item.data as RunData : null;
            const vol = w?.exercises?.reduce((t, ex) => t + ex.sets.reduce((s, set) =>
              s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0) ?? 0;
            const score = w?.score;
            const isAppleHealth = !isRun && w?.source === 'apple_health';
            const hasDistance = !isRun && w?.distance != null && w.distance > 0;
            const ahPace = hasDistance && w!.duration > 0 ? formatPace((w!.duration * 60) / w!.distance!) : null;
            const isHero = i === 0 && !isRun && !isAppleHealth;

            if (isHero) return (
              <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setDetailItem(item)} style={{ backgroundColor: '#1A1209', borderRadius: 22, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                      {formatDateLabel(item.data.date, t('today'))}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>{w?.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {score != null && (
                      <View style={{ backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#4ADE80' }}>{score}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' }} onPress={() => handleDelete(item)}>
                      <IconTrash size={13} color="#C0392B" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{w?.duration}'</Text>
                    <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{t('training_duration')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{w?.exercises?.length ?? 0}</Text>
                    <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{t('training_exercises')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{(vol / 1000).toFixed(1)}t</Text>
                    <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{t('training_volume')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );

            const subtitle = isRun && r
              ? `${formatDateLabel(item.data.date, t('today'))} · ${r.distance.toFixed(1)} km`
              : hasDistance
                ? `${formatDateLabel(item.data.date, t('today'))} · ${w!.distance!.toFixed(1)} km${w?.calories ? ` · ${w.calories} kcal` : ''}`
                : `${formatDateLabel(item.data.date, t('today'))} · ${w?.duration} Min${w?.calories ? ` · ${w.calories} kcal` : ''}`;

            return (
              <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setDetailItem(item)} style={{ backgroundColor: T.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: isRun || hasDistance ? T.greenAlpha : T.orangeAlpha, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isRun || hasDistance ? <IconRun size={17} color={T.green} /> : <IconDumbbell size={17} color={T.orange} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.text1 }} numberOfLines={1}>
                        {isRun ? t('training_run_session') : w?.name}
                      </Text>
                      {isAppleHealth && (
                        <View style={{ backgroundColor: T.redAlpha, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1.5, borderWidth: 1, borderColor: T.redBorder }}>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: T.red }}>🍎 Apple Health</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 10, color: T.text4, marginTop: 2 }}>{subtitle}</Text>
                  </View>
                  {!isRun && score != null && (
                    <View style={{ backgroundColor: T.greenAlpha, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.greenBorder }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: T.green }}>{score}</Text>
                    </View>
                  )}
                  {isRun && r && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: T.text3 }}>{r.pace} /km</Text>
                  )}
                  {ahPace && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: T.text3 }}>{ahPace} /km</Text>
                  )}
                  <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: T.redAlpha, alignItems: 'center', justifyContent: 'center' }} onPress={() => handleDelete(item)}>
                    <IconTrash size={13} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
      {detailItem && <WorkoutDetailModal item={detailItem} T={T} t={t} lang={lang} onClose={() => setDetailItem(null)} />}
    </Modal>
  );
}

function WorkoutDetailModal({ item, T, t, lang, onClose }: {
  item: { _kind: 'workout'; data: Workout } | { _kind: 'run'; data: RunData };
  T: any; t: (key: any) => string; lang: string; onClose: () => void;
}) {
  const isRun = item._kind === 'run';
  const w = !isRun ? item.data as Workout : null;
  const r = isRun ? item.data as RunData : null;
  const vol = w?.exercises?.reduce((sum, ex) => sum + ex.sets.reduce((s, set) =>
    s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0) ?? 0;
  const isAppleHealth = !isRun && w?.source === 'apple_health';
  const hasDistance = !isRun && w?.distance != null && w.distance > 0;
  const ahPace = hasDistance && w!.duration > 0 ? formatPace((w!.duration * 60) / w!.distance!) : null;

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange }}>
                {formatDateLabel(item.data.date, t('today'))}
              </Text>
              {isAppleHealth && (
                <View style={{ backgroundColor: T.redAlpha, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1.5, borderWidth: 1, borderColor: T.redBorder }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: T.red }}>🍎 Apple Health</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }} numberOfLines={1}>
              {isRun ? t('training_run_session') : w?.name}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border }}>
            <IconClose />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {isRun && r ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { v: `${r.distance.toFixed(2)} km`, l: lang === 'en' ? 'Distance' : 'Distanz' },
                { v: `${r.pace} /km`, l: lang === 'en' ? 'Pace' : 'Tempo' },
                { v: `${r.duration}'`, l: t('training_duration') },
                { v: `${r.calories} kcal`, l: 'Kcal' },
                { v: `${r.heartRate} bpm`, l: lang === 'en' ? 'Heart Rate' : 'Herzfrequenz' },
              ].map((s, i) => (
                <View key={i} style={{ width: '31%', backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.text1 }}>{s.v}</Text>
                  <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, textAlign: 'center' }}>{s.l}</Text>
                </View>
              ))}
            </View>
          ) : hasDistance ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { v: `${w!.distance!.toFixed(2)} km`, l: lang === 'en' ? 'Distance' : 'Distanz' },
                { v: ahPace ? `${ahPace} /km` : '—', l: lang === 'en' ? 'Pace' : 'Tempo' },
                { v: `${w?.duration}'`, l: t('training_duration') },
                { v: w?.calories != null ? `${w.calories} kcal` : '—', l: 'Kcal' },
              ].map((s, i) => (
                <View key={i} style={{ width: '48%', backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: T.text1 }}>{s.v}</Text>
                  <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, textAlign: 'center' }}>{s.l}</Text>
                </View>
              ))}
            </View>
          ) : isAppleHealth ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1 }}>{`${w?.duration}'`}</Text>
                <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{t('training_duration')}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1 }}>{w?.calories != null ? w.calories : '—'}</Text>
                <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>Kcal</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1 }}>{w?.duration}'</Text>
                  <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{t('training_duration')}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1 }}>{w?.exercises?.length ?? 0}</Text>
                  <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{t('training_exercises')}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: T.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: T.text1 }}>{(vol / 1000).toFixed(1)}t</Text>
                  <Text style={{ fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{t('training_volume')}</Text>
                </View>
                {w?.score != null && (
                  <View style={{ flex: 1, backgroundColor: T.greenAlpha, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.greenBorder }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: T.green }}>{w.score}</Text>
                    <Text style={{ fontSize: 8, color: T.green, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{lang === 'en' ? 'Score' : 'Score'}</Text>
                  </View>
                )}
              </View>

              {w?.exercises?.map(ex => (
                <View key={ex.id} style={{ backgroundColor: T.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.text1, flex: 1 }}>{ex.name}</Text>
                    {ex.muscleGroup ? (
                      <View style={{ backgroundColor: (MUSCLE_COLORS[ex.muscleGroup] ?? T.orange) + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: MUSCLE_COLORS[ex.muscleGroup] ?? T.orange }}>{translateMuscle(ex.muscleGroup, lang)}</Text>
                      </View>
                    ) : null}
                  </View>
                  {ex.sets.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: T.borderSoft }}>
                      <Text style={{ fontSize: 12, color: T.text3 }}>{lang === 'en' ? 'Set' : 'Satz'} {i + 1}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: T.text1 }}>
                        {s.weight || '–'} kg × {s.reps || '–'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Routine Screens ──────────────────────────────────────────
function RoutineScreen({ routines, onSelectRoutine, onCreateRoutine, onUpdateRoutine, onDeleteRoutine, onBack }: {
  routines: Routine[]; onSelectRoutine: (r: Routine) => void; onCreateRoutine: (r: Routine) => void;
  onUpdateRoutine: (r: Routine) => void; onDeleteRoutine: (id: string) => void; onBack: () => void;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t } = useLanguage();
  const screen = { header: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, eyebrow: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: T.orange, marginBottom: 4 }, title: { fontSize: 26, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.7 }, closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border }, backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border, marginTop: 4 } };
  const btn = { primary: { backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const }, primaryText: { fontSize: 15, fontWeight: '700' as const, color: T.white }, outline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 14, borderStyle: 'dashed' as const, padding: 13, marginTop: 10 }, outlineText: { fontSize: 13, fontWeight: '600' as const, color: T.orange } };
  const field = { label: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: T.text4, marginBottom: 8, marginTop: 16 }, input: { backgroundColor: T.card, borderRadius: 14, padding: 14, color: T.text1, fontSize: 15, borderWidth: 1, borderColor: T.border }, list: { backgroundColor: T.card, borderRadius: 16, overflow: 'hidden' as const, marginBottom: 12, borderWidth: 1, borderColor: T.border }, row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 14 }, rowBorder: { borderBottomWidth: 1, borderBottomColor: T.borderSoft }, rowText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: T.text1 }, dot: { width: 8, height: 8, borderRadius: 4 } };
  const tabSt = { btn: { flex: 1, borderRadius: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.border, alignItems: 'center' as const }, btnActive: { backgroundColor: T.orangeAlpha, borderColor: T.orangeBorder }, text: { fontSize: 12, fontWeight: '600' as const, color: T.text4 }, textActive: { color: T.orange } };
  const rSt = { card: { backgroundColor: T.card, borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, borderWidth: 1, borderColor: T.border }, name: { fontSize: 16, fontWeight: '700' as const, color: T.text1, letterSpacing: -0.3, marginBottom: 4 }, meta: { fontSize: 11, color: T.text3, marginBottom: 8 }, chipRow: { flexDirection: 'row' as const, gap: 6 }, chip: { backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.orangeBorder }, chipText: { fontSize: 11, fontWeight: '600' as const, color: T.orange }, createCard: { backgroundColor: T.card, borderRadius: 18, padding: 16, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, marginBottom: 12, borderWidth: 1, borderColor: T.orangeBorder }, createIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.orangeAlpha, alignItems: 'center' as const, justifyContent: 'center' as const }, createTitle: { fontSize: 15, fontWeight: '700' as const, color: T.text1, marginBottom: 2 }, createSub: { fontSize: 11, color: T.text3 }, editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.blueAlpha, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.blueBorder }, deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.redAlpha, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.redBorder }, communityBadge: { backgroundColor: T.blueAlpha, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.blueBorder } };
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [showForm, setShowForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [newName, setNewName] = useState('');
  const [newExercises, setNewExercises] = useState<Routine['exercises']>([]);
  const [showPicker, setShowPicker] = useState(false);
  function openCreate() { setEditingRoutine(null); setNewName(''); setNewExercises([]); setShowForm(true); }
  function openEdit(r: Routine) { setEditingRoutine(r); setNewName(r.name); setNewExercises([...r.exercises]); setShowForm(true); }
  function saveForm() {
    if (!newName.trim()) { Alert.alert(t('training_routine_name_required')); return; }
    if (newExercises.length === 0) { Alert.alert(t('training_routine_exercise_required')); return; }
    if (editingRoutine) onUpdateRoutine({ ...editingRoutine, name: newName.trim(), exercises: newExercises });
    else onCreateRoutine({ id: Date.now().toString(), name: newName.trim(), exercises: newExercises });
    setShowForm(false);
  }
  if (showForm) return (
    <>
      {showPicker && <ExercisePicker onSelect={(n, mg, eq) => { setNewExercises(prev => [...prev, { name: n, muscleGroup: mg, defaultSets: 3, equipment: eq }]); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={screen.header}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={screen.backBtn}><IconChevronLeft /></TouchableOpacity>
          <View><Text style={screen.eyebrow}>{editingRoutine ? t('edit') : t('training_routine_new')}</Text><Text style={screen.title}>{newName || t('training_routine_unnamed')}</Text></View>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={field.label}>Name</Text>
          <TextInput style={field.input} value={newName} onChangeText={setNewName} placeholder="z.B. Push Day" placeholderTextColor={T.text4} />
          <Text style={field.label}>{t('training_exercises')}</Text>
          {newExercises.map((ex, i) => (
            <View key={i} style={field.row}>
              <View style={[field.dot, { backgroundColor: MUSCLE_COLORS[ex.muscleGroup] }]} />
              <View style={{ flex: 1 }}><Text style={field.rowText}>{ex.name}</Text>{ex.equipment && <Text style={{ fontSize: 10, color: T.text4 }}>{ex.equipment}</Text>}</View>
              <TouchableOpacity onPress={() => setNewExercises(prev => prev.filter((_, idx) => idx !== i))}><IconClose /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={16} /><Text style={btn.outlineText}>{t('training_add_exercise')}</Text></TouchableOpacity>
          <TouchableOpacity style={[btn.primary, { marginTop: 16 }]} onPress={saveForm}><Text style={btn.primaryText}>{t('save')}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={screen.header}>
        <TouchableOpacity onPress={onBack} style={screen.backBtn}><IconChevronLeft /></TouchableOpacity>
        <View><Text style={screen.eyebrow}>{t('training_strength')}</Text><Text style={screen.title}>{t('training_routines')}</Text></View>
      </View>
      <View style={{ paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {(['mine', 'discover'] as const).map(tabKey => (
            <TouchableOpacity key={tabKey} style={[tabSt.btn, tab === tabKey && tabSt.btnActive]} onPress={() => setTab(tabKey)}>
              <Text style={[tabSt.text, tab === tabKey && tabSt.textActive]}>{tabKey === 'mine' ? t('training_my_routines') : t('training_discover')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab === 'mine' ? (
          <>
            <TouchableOpacity style={rSt.createCard} onPress={openCreate}>
              <View style={rSt.createIcon}><IconPlus size={20} /></View>
              <View style={{ flex: 1 }}><Text style={rSt.createTitle}>{t('training_routine_new')}</Text><Text style={rSt.createSub}>{t('training_create_yourself')}</Text></View>
              <IconChevronRight />
            </TouchableOpacity>
            {routines.length === 0 && <Text style={{ color: T.text4, textAlign: 'center', marginTop: 40 }}>{t('training_no_routines')}</Text>}
            {routines.map(r => (
              <View key={r.id} style={rSt.card}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectRoutine(r)}>
                  <Text style={rSt.name}>{r.name}</Text>
                  <Text style={rSt.meta}>{r.exercises.slice(0, 3).map(e => e.name).join(' · ')}{r.exercises.length > 3 ? ` +${r.exercises.length - 3}` : ''}</Text>
                  <View style={rSt.chipRow}><View style={rSt.chip}><Text style={rSt.chipText}>{r.exercises.length} {t('training_exercises')}</Text></View></View>
                </TouchableOpacity>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={rSt.editBtn} onPress={() => openEdit(r)}><Text style={{ fontSize: 11, color: T.blue, fontWeight: '700' }}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity style={rSt.deleteBtn} onPress={() => Alert.alert(t('delete'), `"${r.name}" ${t('training_delete_item')}`, [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => onDeleteRoutine(r.id) }])}><IconTrash size={14} /></TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          COMMUNITY_ROUTINES.map(r => (
            <TouchableOpacity key={r.id} style={rSt.card} onPress={() => onSelectRoutine(r)}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={rSt.name}>{r.name}</Text>
                  <View style={rSt.communityBadge}><Text style={{ fontSize: 10, color: T.blue, fontWeight: '700' }}>Community</Text></View>
                </View>
                <Text style={rSt.meta}>{r.exercises.map(e => e.name).slice(0, 3).join(' · ')}</Text>
                <View style={rSt.chipRow}><View style={rSt.chip}><Text style={rSt.chipText}>{r.exercises.length} {t('training_exercises')}</Text></View></View>
              </View>
              <IconChevronRight />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
}

function RoutineDetail({ routine, onStart, onBack }: { routine: Routine; onStart: (r: Routine) => void; onBack: () => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t, lang } = useLanguage();
  const screen = { header: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, eyebrow: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: T.orange, marginBottom: 4 }, title: { fontSize: 26, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.7 }, backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border, marginTop: 4 } };
  const btn = { primary: { backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const }, primaryText: { fontSize: 15, fontWeight: '700' as const, color: T.white }, outline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 14, borderStyle: 'dashed' as const, padding: 13, marginTop: 10 }, outlineText: { fontSize: 13, fontWeight: '600' as const, color: T.orange } };
  const field = { list: { backgroundColor: T.card, borderRadius: 16, overflow: 'hidden' as const, marginBottom: 12, borderWidth: 1, borderColor: T.border }, row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 14 }, rowBorder: { borderBottomWidth: 1, borderBottomColor: T.borderSoft }, rowText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: T.text1 }, dot: { width: 8, height: 8, borderRadius: 4 } };
  const [extras, setExtras] = useState<Routine['exercises']>([]);
  const [showPicker, setShowPicker] = useState(false);
  const all = [...routine.exercises, ...extras];
  return (
    <>
      {showPicker && <ExercisePicker onSelect={(n, mg, eq) => { setExtras(prev => [...prev, { name: n, muscleGroup: mg, defaultSets: 3, equipment: eq }]); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={screen.header}>
          <TouchableOpacity onPress={onBack} style={screen.backBtn}><IconChevronLeft /></TouchableOpacity>
          <View><Text style={screen.eyebrow}>{t('training_routine_label')}</Text><Text style={screen.title}>{routine.name}</Text></View>
        </View>
        <View style={{ padding: 18 }}>
          <View style={field.list}>
            {all.map((ex, i) => (
              <View key={i} style={[field.row, i < all.length - 1 && field.rowBorder]}>
                <View style={[field.dot, { backgroundColor: MUSCLE_COLORS[ex.muscleGroup] ?? T.orange }]} />
                <View style={{ flex: 1 }}><Text style={field.rowText}>{ex.name}</Text>{ex.equipment && <Text style={{ fontSize: 10, color: T.text4 }}>{ex.equipment}</Text>}</View>
                <Text style={{ fontSize: 11, color: T.text4 }}>{translateMuscle(ex.muscleGroup, lang)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={16} /><Text style={btn.outlineText}>{t('training_add_exercise')}</Text></TouchableOpacity>
          <View style={{ marginTop: 16 }}><SwipeToStart onStart={() => onStart({ ...routine, exercises: all })} /></View>
        </View>
      </ScrollView>
    </>
  );
}

// ─── Active Gym Workout ───────────────────────────────────────
function ActiveGymWorkout({ workout, userMaxes, prHistory, lastWorkoutData, onUpdate, onFinish }: {
  workout: Workout; userMaxes: UserMaxes; prHistory: PRHistory; lastWorkoutData: Record<string, WorkoutSet[]>; onUpdate: (w: Workout) => void; onFinish: () => void;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t, lang } = useLanguage();
  const btn = { primary: { backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const }, primaryText: { fontSize: 15, fontWeight: '700' as const, color: T.white }, outline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 14, borderStyle: 'dashed' as const, padding: 13, marginTop: 10 }, outlineText: { fontSize: 13, fontWeight: '600' as const, color: T.orange } };
  const activeS = { header: { backgroundColor: T.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, workoutTag: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: T.orange, marginBottom: 4 }, workoutTitle: { fontSize: 20, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.4 }, timerBadge: { backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' as const, borderWidth: 1, borderColor: T.border }, timerText: { fontSize: 18, fontWeight: '700' as const, color: T.text1, letterSpacing: 1 }, timerLabel: { fontSize: 8, color: T.text4, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 2 }, statsRow: { flexDirection: 'row' as const, gap: 8, padding: 12, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, statBox: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 10, padding: 10, alignItems: 'center' as const, borderWidth: 1, borderColor: T.border }, statVal: { fontSize: 18, fontWeight: '700' as const }, statLbl: { fontSize: 8, color: T.text4, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 2 }, restCard: { backgroundColor: T.card, borderLeftWidth: 3, padding: 12, marginBottom: 12, marginTop: 12, borderRadius: 0 }, restLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 2 }, restTimer: { fontSize: 22, fontWeight: '800' as const, color: T.text1, letterSpacing: 1 }, restBtn: { backgroundColor: T.cardAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: T.border }, restBtnText: { fontSize: 11, fontWeight: '600' as const, color: T.text3 }, exCard: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border }, musclePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }, musclePillText: { fontSize: 11, fontWeight: '500' as const }, exName: { flex: 1, fontSize: 15, fontWeight: '700' as const, color: T.text1 }, recRow: { backgroundColor: T.blueAlpha, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: T.blueBorder }, recText: { fontSize: 12, color: T.blue, fontWeight: '500' as const }, lastRow: { flexDirection: 'row' as const, backgroundColor: T.cardAlt, borderRadius: 8, padding: 8, marginBottom: 8 }, lastLabel: { fontSize: 11, color: T.text3 }, lastVal: { fontSize: 11, color: T.orange, fontWeight: '500' as const, flex: 1 }, oneRM: { fontSize: 11, color: T.text3, marginBottom: 10 }, setHdr: { fontSize: 9, color: T.text4, textTransform: 'uppercase' as const, letterSpacing: 0.8, textAlign: 'center' as const }, setRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8, alignItems: 'center' as const }, setNum: { fontSize: 13, color: T.text3, width: 24, textAlign: 'center' as const }, setInput: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 10, padding: 11, color: T.text1, fontSize: 15, textAlign: 'center' as const, borderWidth: 1, borderColor: T.border }, setInputDone: { borderColor: 'rgba(52,199,89,0.4)', color: T.green }, addSetBtn: { padding: 8, alignItems: 'center' as const }, addSetText: { fontSize: 13, color: T.orange, fontWeight: '500' as const } };
  const [showPicker, setShowPicker] = useState(false);
  const workoutTimer = useWorkoutTimer('gymWorkoutTimer');
  const restTimer = useRestTimer();
  useEffect(() => { if (!workoutTimer.isRunning) workoutTimer.startNow(); }, []);
  async function addExercise(name: string, muscleGroup: string, equipment: string) {
    const lastSets = lastWorkoutData[name];
    const sets = lastSets ? lastSets.map(() => ({ reps: '', weight: '' })) : [{ reps: '', weight: '' }];
    const updated = { ...workout, exercises: [...workout.exercises, { id: Date.now().toString(), name, muscleGroup, equipment, sets }] };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated)); setShowPicker(false);
  }
  async function updateSet(exId: string, si: number, f: 'reps' | 'weight', val: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => { if (ex.id !== exId) return ex; const s = [...ex.sets]; s[si] = { ...s[si], [f]: val }; return { ...ex, sets: s }; }) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }
  async function addSet(exId: string) {
    const updated = { ...workout, exercises: workout.exercises.map(ex => { if (ex.id !== exId) return ex; const prev = ex.sets[ex.sets.length - 1]; return { ...ex, sets: [...ex.sets, { reps: '', weight: prev?.weight || '' }] }; }) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }
  async function removeExercise(exId: string) {
    const updated = { ...workout, exercises: workout.exercises.filter(ex => ex.id !== exId) };
    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }
  const totalSets = workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const totalVol = workout.exercises.reduce((t, ex) => t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0);
  return (
    <>
      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />}
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} showsVerticalScrollIndicator={false}>
        <View style={activeS.header}>
          <View style={{ flex: 1 }}>
            <Text style={activeS.workoutTag}>{workout.name} · {t('training_active')}</Text>
            <Text style={activeS.workoutTitle}>{workout.exercises[0]?.name ?? t('training_running_label')}</Text>
          </View>
          <View style={activeS.timerBadge}>
            <Text style={activeS.timerText}>{formatTime(workoutTimer.seconds)}</Text>
            <Text style={activeS.timerLabel}>Timer</Text>
          </View>
        </View>
        <View style={activeS.statsRow}>
          {[{ v: workout.exercises.length, l: t('training_exercises'), c: T.orange }, { v: totalSets, l: 'Sets', c: T.green }, { v: Math.round(totalVol), l: 'kg Vol.', c: T.blue }].map(s => (
            <View key={s.l} style={activeS.statBox}><Text style={[activeS.statVal, { color: s.c }]}>{s.v}</Text><Text style={activeS.statLbl}>{s.l}</Text></View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[activeS.restCard, { borderLeftColor: restTimer.isRunning ? T.orange : T.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[activeS.restLabel, { color: restTimer.isRunning ? T.orange : T.text4 }]}>{restTimer.isRunning ? t('training_rest_active') : t('training_rest_start')}</Text>
                {restTimer.isRunning && <Text style={activeS.restTimer}>{formatTime(restTimer.seconds)}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[60, 90, 120, 180].map(sec => (
                  <TouchableOpacity key={sec} style={[activeS.restBtn, restTimer.isRunning && { borderColor: T.orange }]} onPress={() => restTimer.isRunning ? restTimer.stop() : restTimer.startFor(sec)}>
                    <Text style={[activeS.restBtnText, restTimer.isRunning && { color: T.orange }]}>{sec < 120 ? `${sec}s` : `${sec / 60}m`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {restTimer.isRunning && (
              <View style={{ height: 3, backgroundColor: T.border, borderRadius: 2, marginTop: 10 }}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: restTimer.pct > 0.3 ? T.green : restTimer.pct > 0.1 ? T.orange : T.red, width: `${restTimer.pct * 100}%` as any }} />
              </View>
            )}
          </View>
          {workout.exercises.map(exercise => {
            const mc = MUSCLE_COLORS[exercise.muscleGroup] ?? '#888';
            const best1RM = getBest1RM(exercise.sets);
            const userMax = userMaxes[exercise.name];
            const pct = userMax && best1RM > 0 ? Math.round((best1RM / userMax) * 100) : null;
            const lastSets = lastWorkoutData[exercise.name];
            const rec = userMax ? Math.round((userMax * 0.75) / 2.5) * 2.5 : 0;
            return (
              <View key={exercise.id} style={activeS.exCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={[activeS.musclePill, { backgroundColor: mc + '22' }]}><Text style={[activeS.musclePillText, { color: mc }]}>{translateMuscle(exercise.muscleGroup, lang)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={activeS.exName}>{exercise.name}</Text>
                    {exercise.equipment && <Text style={{ fontSize: 10, color: T.text4, marginTop: 1 }}>{exercise.equipment}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(exercise.id)}><IconClose /></TouchableOpacity>
                </View>
                {rec > 0 && (
                  <TouchableOpacity style={activeS.recRow} onPress={async () => {
                    const newSets = Array.from({ length: Math.max(exercise.sets.length, 4) }, () => ({ reps: '8', weight: String(rec) }));
                    const updated = { ...workout, exercises: workout.exercises.map(ex => ex.id !== exercise.id ? ex : { ...ex, sets: newSets }) };
                    onUpdate(updated); await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
                  }}>
                    <Text style={activeS.recText}>💡 4 × 8 @ {rec} kg — {t('training_rec_tap')}</Text>
                  </TouchableOpacity>
                )}
                {lastSets && <View style={activeS.lastRow}><Text style={activeS.lastLabel}>{t('training_last_time')}: </Text><Text style={activeS.lastVal}>{lastSets.map(ls => `${ls.weight}×${ls.reps}`).join(' · ')}</Text></View>}
                {best1RM > 0 && <Text style={activeS.oneRM}>Est. 1RM: <Text style={{ color: T.orange, fontWeight: '600' }}>{best1RM} kg</Text>{pct ? `  ·  ${pct}% Max` : ''}</Text>}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <Text style={[activeS.setHdr, { width: 24 }]}>#</Text>
                  <Text style={[activeS.setHdr, { flex: 1 }]}>{t('training_reps_short')}</Text>
                  <Text style={[activeS.setHdr, { flex: 1 }]}>kg</Text>
                </View>
                {exercise.sets.map((set, si) => {
                  const filled = set.reps !== '' && set.weight !== '';
                  return (
                    <View key={si} style={activeS.setRow}>
                      <Text style={activeS.setNum}>{si + 1}</Text>
                      <TextInput style={[activeS.setInput, filled && activeS.setInputDone]} placeholder={lastSets?.[si]?.reps || '0'} placeholderTextColor={T.text4} value={set.reps} onChangeText={v => updateSet(exercise.id, si, 'reps', v)} keyboardType="numeric" />
                      <TextInput style={[activeS.setInput, filled && activeS.setInputDone]} placeholder={lastSets?.[si]?.weight || '0'} placeholderTextColor={T.text4} value={set.weight} onChangeText={v => updateSet(exercise.id, si, 'weight', v)} keyboardType="decimal-pad" />
                    </View>
                  );
                })}
                <TouchableOpacity style={activeS.addSetBtn} onPress={() => addSet(exercise.id)}><Text style={activeS.addSetText}>+ Set</Text></TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={18} /><Text style={btn.outlineText}>{t('training_add_exercise')}</Text></TouchableOpacity>
          <TouchableOpacity style={[btn.primary, { marginTop: 10, marginBottom: 20 }]} onPress={async () => { await workoutTimer.stop(); onFinish(); }}>
            <Text style={btn.primaryText}>{t('training_finish_btn')}</Text>
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </>
  );
}

// ─── Run Screen ───────────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t, lang } = useLanguage();
  const btn = { primary: { backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const }, primaryText: { fontSize: 15, fontWeight: '700' as const, color: T.white } };
  const runTimer = useWorkoutTimer('activeRunTimer');
  const [dist, setDist] = useState('');
  const [hr, setHr] = useState('');
  const [cal, setCal] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!runTimer.isRunning) runTimer.startNow();
    const a = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1.02, duration: 1000, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, []);
  const d = parseFloat(dist) || 0;
  const pace = d > 0 ? runTimer.seconds / d : 0;
  const kcal = parseInt(cal) || Math.round(runTimer.seconds / 60 * 8);
  async function finish() {
    const dur = runTimer.getDuration() * 60;
    await runTimer.stop();
    const run: RunData = { id: Date.now().toString(), distance: d, duration: dur, pace: formatPace(d > 0 ? dur / d : 0), calories: kcal, heartRate: parseInt(hr) || 0, date: new Date().toISOString() };
    const raw = await AsyncStorage.getItem('runs'); const runs = raw ? JSON.parse(raw) : [];
    runs.push(run); await AsyncStorage.setItem('runs', JSON.stringify(runs));
    await AsyncStorage.removeItem('activeWorkout');
    scheduleNutritionReminder(lang).catch(() => {});
    Alert.alert(t('training_run_complete'), `${d.toFixed(2)} km · ${formatTime(dur)} · ${formatPace(d > 0 ? dur / d : 0)} /km`, [{ text: 'OK', onPress: onStop }]);
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg, padding: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.green, marginTop: 60, marginBottom: 20 }}>{t('training_run_active')}</Text>
      <Animated.View style={{ backgroundColor: T.card, borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: T.green + '30', transform: [{ scale: pulse }] }}>
        <Text style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{t('training_run_time')}</Text>
        <Text style={{ fontSize: 60, fontWeight: '300', color: T.text1, letterSpacing: -2 }}>{formatTime(runTimer.seconds)}</Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[{ v: d.toFixed(2), l: 'km', c: T.green }, { v: formatPace(pace), l: '/km', c: T.blue }, { v: String(kcal), l: 'kcal', c: T.orange }].map(s => (
          <View key={s.l} style={{ flex: 1, backgroundColor: T.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: s.c }}>{s.v}</Text>
            <Text style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>{s.l}</Text>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: T.border }}>
        <Text style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>{t('training_data')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[{ lbl: t('training_run_distance'), val: dist, set: setDist, kb: 'decimal-pad' as const, ph: '0.00' }, { lbl: t('training_heartrate'), val: hr, set: setHr, kb: 'numeric' as const, ph: 'bpm' }, { lbl: t('nutrition_kcal'), val: cal, set: setCal, kb: 'numeric' as const, ph: 'kcal' }].map(f => (
            <View key={f.lbl} style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>{f.lbl}</Text>
              <TextInput style={{ backgroundColor: T.cardAlt, borderRadius: 10, padding: 11, color: T.text1, fontSize: 15, borderWidth: 1, borderColor: T.border }} value={f.val} onChangeText={f.set} keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={T.text4} />
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[btn.primary, { backgroundColor: T.green }]} onPress={finish}><Text style={btn.primaryText}>{t('training_run_end')}</Text></TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Body Recovery Full Modal ─────────────────────────────────
function BodyModal({ muscles, onClose }: { muscles: MuscleMap; onClose: () => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const { t, lang } = useLanguage();
  const screen = { header: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, eyebrow: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: T.orange, marginBottom: 4 }, title: { fontSize: 26, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.7 }, closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border } };
  const tabSt = { btn: { flex: 1, borderRadius: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.border, alignItems: 'center' as const }, btnActive: { backgroundColor: T.orangeAlpha, borderColor: T.orangeBorder }, text: { fontSize: 12, fontWeight: '600' as const, color: T.text4 }, textActive: { color: T.orange } };
  const [view, setView] = useState<'front' | 'back'>('front');
  const ready = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80);
  const warn = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40);
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={screen.header}>
          <View style={{ flex: 1 }}>
            <Text style={screen.eyebrow}>{t('body_title')}</Text>
            <Text style={screen.title}>{t('body_muscle_recovery')}</Text>
          </View>
          <TouchableOpacity style={screen.closeBtn} onPress={onClose}><IconClose /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['front', 'back'] as const).map(v => (
              <TouchableOpacity key={v} style={[tabSt.btn, view === v && tabSt.btnActive]} onPress={() => setView(v)}>
                <Text style={[tabSt.text, view === v && tabSt.textActive]}>{v === 'front' ? t('training_body_front') : t('training_body_back')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 10, borderWidth: 1, borderColor: T.border }}>
              {view === 'front' ? <BodyFront muscles={muscles} /> : <BodyBack muscles={muscles} />}
            </View>
            <View style={{ gap: 8, paddingTop: 12 }}>
              {[{ c: T.green, l: t('training_legend_recovered') }, { c: T.blue, l: t('training_legend_almost') }, { c: T.yellow, l: t('training_legend_medium') }, { c: T.orange, l: t('training_legend_low') }, { c: T.red, l: t('training_legend_caution') }].map(item => (
                <View key={item.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.c }} />
                  <Text style={{ fontSize: 12, color: T.text2 }}>{item.l}</Text>
                </View>
              ))}
            </View>
          </View>
          {warn.length > 0 && <View style={{ backgroundColor: T.redAlpha, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.redBorder }}><Text style={{ color: T.red, fontWeight: '700', marginBottom: 4 }}>{t('training_rest_today')}</Text><Text style={{ color: T.red, opacity: 0.8, fontSize: 12 }}>{warn.map(m => translateMuscle(m, lang)).join(', ')}</Text></View>}
          {ready.length > 0 && <View style={{ backgroundColor: T.greenAlpha, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: T.greenBorder }}><Text style={{ color: T.green, fontWeight: '700', marginBottom: 4 }}>{t('training_ready')}</Text><Text style={{ color: T.green, opacity: 0.8, fontSize: 12 }}>{ready.map(m => translateMuscle(m, lang)).join(', ')}</Text></View>}
          {MUSCLE_GROUPS.map(m => {
            const lvl = muscles[m]?.level ?? 100;
            const color = getMuscleRecoveryColor(lvl);
            return (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderSoft }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: T.text1, width: 100 }}>{translateMuscle(m, lang)}</Text>
                <View style={{ flex: 1, height: 4, backgroundColor: T.card, borderRadius: 2 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: color, width: `${lvl}%` as any }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color, width: 36, textAlign: 'right' }}>{lvl}%</Text>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
// ─── Progress Card (Mini) ─────────────────────────────────────
function ProgressCard({ prHistory, workouts, T, onPress }: { prHistory: PRHistory; workouts: Workout[]; T: any; onPress: () => void }) {
  const { t, lang } = useLanguage();
  const [period, setPeriod] = useState<'1M' | '6M' | '1J' | '2J' | 'Gesamt'>('1M');
  const periods = ['1M', '6M', '1J', '2J', 'Gesamt'] as const;
  const getPeriodLabel = (p: string) => {
    if (lang === 'en') {
      if (p === '1J') return '1Y';
      if (p === '2J') return '2Y';
      if (p === 'Gesamt') return 'All';
    }
    return p;
  };

  const chartData = computeProgressData(prHistory, period);
  const avgImprovement = chartData.length >= 2
    ? Math.round(((chartData[chartData.length - 1].avg - chartData[0].avg) / Math.max(chartData[0].avg, 1)) * 100)
    : 0;

  const W = SW - 32 - 32;
  const H = 90;
  const PAD = 8;
  const vals = chartData.map(d => d.avg);
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 1);
  const range = maxV - minV || 1;
  const pts = vals.map((v, i) => ({
    x: PAD + (i / Math.max(vals.length - 1, 1)) * (W - PAD * 2),
    y: H - PAD - ((v - minV) / range) * (H - PAD * 2),
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = pts.length >= 2
    ? `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`
    : '';

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 3 }}>{t('training_strength_dev')}</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.text1 }}>{t('training_avg_all_mg')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: avgImprovement >= 0 ? T.green : T.red, letterSpacing: -0.5 }}>
              {avgImprovement >= 0 ? '+' : ''}{avgImprovement}%
            </Text>
            <Text style={{ fontSize: 9, color: T.text4 }}>{period === 'Gesamt' ? t('training_total') : period === '1M' ? t('training_this_month') : period === '6M' ? t('training_in_6months') : period === '1J' ? t('training_this_year') : t('training_in_2years')}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 12 }}>
          {periods.map(p => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 5, borderRadius: 7, alignItems: 'center', backgroundColor: period === p ? T.orangeAlpha : T.cardAlt, borderWidth: 1, borderColor: period === p ? T.orangeBorder : T.border }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: period === p ? T.orange : T.text4 }}>{getPeriodLabel(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {vals.length >= 2 && workouts.length >= 5 ? (
          <Svg width={W} height={H}>
            {areaD ? <Path d={areaD} fill={T.orange + '18'} /> : null}
            <Path d={pathD} fill="none" stroke={T.orange} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5} fill={T.orange} />)}
          </Svg>
        ) : (
  <View style={{ height: H, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: T.text2 }}>{t('training_no_data')}</Text>
    <Text style={{ fontSize: 11, color: T.text4, textAlign: 'center' }}>
      {workouts.length < 5
        ? (lang === 'de'
            ? `Noch ${5 - workouts.length} Trainingseinheit${5 - workouts.length === 1 ? '' : 'en'} bis zur Auswertung`
            : `${5 - workouts.length} more workout${5 - workouts.length === 1 ? '' : 's'} until analysis`)
        : t('training_no_pr_data')}
    </Text>
  </View>
)}

        <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.orangeAlpha, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: T.orangeBorder, marginTop: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.orange }}>{t('training_detail_view')}</Text>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.orange, alignItems: 'center', justifyContent: 'center' }}>
            <IconChevronRight color="#fff" size={12} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Progress Detail Modal ────────────────────────────────────
function ProgressDetailModal({ prHistory, T, onClose }: { prHistory: PRHistory; T: any; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const [period, setPeriod] = useState<'1M' | '6M' | '1J' | '2J' | 'Gesamt'>('1M');
  const periods = ['1M', '6M', '1J', '2J', 'Gesamt'] as const;
  const getPeriodLabel = (p: string) => {
    if (lang === 'en') {
      if (p === '1J') return '1Y';
      if (p === '2J') return '2Y';
      if (p === 'Gesamt') return 'All';
    }
    return p;
  };
  const MG_COLORS: Record<string, string> = {
    Brust: '#E8572A', Rücken: '#3A7AC0', Bizeps: '#4A8C5C',
    Schultern: '#8B6914', Trizeps: '#7B4A2D', Quadrizeps: '#A03C78',
    Hamstrings: '#06B6D4', Gluteus: '#F472B6', Waden: '#FB923C', Core: '#F59E0B',
  };
  const ALL_MG = Object.keys(MG_COLORS);
  const [active, setActive] = useState<string[]>(ALL_MG.slice(0, 6));

  const W = SW - 32 - 32;
  const H = 200;
  const PAD = 12;

  const allData = ALL_MG.reduce<Record<string, { x: number; y: number }[]>>((acc, mg) => {
    const data = computeMGProgressData(prHistory, mg, period);
    const vals = data.map(d => d.val);
    const minV = Math.min(...vals, 0);
    const maxV = Math.max(...vals, 1);
    const range = maxV - minV || 1;
    acc[mg] = vals.map((v, i) => ({
      x: PAD + (i / Math.max(vals.length - 1, 1)) * (W - PAD * 2),
      y: H - PAD - ((v - minV) / range) * (H - PAD * 2),
    }));
    return acc;
  }, {});

  const improvements = ALL_MG.map(mg => {
    const data = computeMGProgressData(prHistory, mg, period);
    if (data.length < 2) return { mg, pct: 0 };
    const pct = Math.round(((data[data.length - 1].val - data[0].val) / Math.max(data[0].val, 1)) * 100);
    return { mg, pct };
  }).filter(x => x.pct !== 0).sort((a, b) => b.pct - a.pct);

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: T.borderSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', backgroundColor: T.card }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 5 }}>Kraftentwicklung</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }}>Fortschritt</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
            <IconClose />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 5, marginBottom: 16 }}>
            {periods.map(p => (
              <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center', backgroundColor: period === p ? T.orangeAlpha : T.card, borderWidth: 1, borderColor: period === p ? T.orangeBorder : T.border }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: period === p ? T.orange : T.text4 }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: T.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 12 }}>Verlauf nach Muskelgruppe</Text>
            <Svg width={W} height={H}>
              {active.map(mg => {
                const pts = allData[mg];
                if (!pts || pts.length < 2) return null;
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                return <Path key={mg} d={d} fill="none" stroke={MG_COLORS[mg]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
              })}
              {active.map(mg => {
                const pts = allData[mg];
                if (!pts || pts.length < 2) return null;
                return pts.map((p, i) => <Circle key={`${mg}-${i}`} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5} fill={MG_COLORS[mg]} />);
              })}
            </Svg>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {ALL_MG.map(mg => (
                <View key={mg} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: MG_COLORS[mg] }} />
                  <Text style={{ fontSize: 9, color: T.text3 }}>{mg}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 8 }}>Ein-/Ausblenden</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {ALL_MG.map(mg => {
              const on = active.includes(mg);
              return (
                <TouchableOpacity key={mg} onPress={() => setActive(prev => on ? prev.filter(x => x !== mg) : [...prev, mg])}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, backgroundColor: on ? MG_COLORS[mg] + '18' : T.cardAlt, borderColor: on ? MG_COLORS[mg] + '44' : T.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: on ? MG_COLORS[mg] : T.text4 }}>{mg}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {improvements.length > 0 && (
            <View style={{ backgroundColor: T.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.border }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 12 }}>Ranking — Verbesserung</Text>
              {improvements.map(({ mg, pct }) => (
                <View key={mg} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: T.text2, width: 80 }}>{mg}</Text>
                  <View style={{ flex: 1, height: 7, backgroundColor: T.cardAlt, borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: 7, borderRadius: 4, backgroundColor: MG_COLORS[mg], width: `${Math.min(Math.abs(pct), 100)}%` as any }} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: MG_COLORS[mg], width: 38, textAlign: 'right' }}>{pct >= 0 ? '+' : ''}{pct}%</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Progress Helpers ─────────────────────────────────────────
function computeProgressData(prHistory: PRHistory, period: string): { label: string; avg: number }[] {
  const now = Date.now();
  const msMap: Record<string, number> = { '1M': 30, '6M': 180, '1J': 365, '2J': 730, 'Gesamt': 9999 };
  const days = msMap[period] ?? 30;
  const buckets = period === '1M' ? 4 : period === '6M' ? 6 : period === '1J' ? 12 : period === '2J' ? 8 : 6;
  const raw = Array.from({ length: buckets }, (_, i) => {
    const bucketEnd = now - ((buckets - 1 - i) / buckets) * days * 24 * 3600000;
    const bucketStart = now - ((buckets - i) / buckets) * days * 24 * 3600000;
    let total = 0, count = 0;
    Object.values(prHistory).forEach(entries => {
      entries.forEach(e => {
        const t = new Date(e.date).getTime();
        if (t >= bucketStart && t <= bucketEnd) { total += e.estimated1RM; count++; }
      });
    });
    return count > 0 ? Math.round(total / count) : 0;
  });
  const base = raw.find(v => v > 0) ?? 1;
  return raw.map((v, i) => ({ label: `${i + 1}`, avg: v > 0 ? Math.round(((v - base) / base) * 100) : 0 }));
}

function computeMGProgressData(prHistory: PRHistory, muscleGroup: string, period: string): { label: string; val: number }[] {
  const now = Date.now();
  const msMap: Record<string, number> = { '1M': 30, '6M': 180, '1J': 365, '2J': 730, 'Gesamt': 9999 };
  const days = msMap[period] ?? 30;
  const buckets = period === '1M' ? 4 : period === '6M' ? 6 : period === '1J' ? 12 : period === '2J' ? 8 : 6;
  const mgCats: Record<string, string[]> = {
    Brust: ['Brust'], Rücken: ['Rücken (Breite)', 'Rücken (Dicke)', 'Rücken (Unterer)'],
    Bizeps: ['Bizeps'], Schultern: ['Schultern'], Trizeps: ['Trizeps'],
    Quadrizeps: ['Quadrizeps'], Hamstrings: ['Hamstrings'], Gluteus: ['Gesäß'],
    Waden: ['Waden'], Core: ['Core', 'Bauch', 'Obliques'],
  };
  const cats = mgCats[muscleGroup] ?? [muscleGroup];
  const relevantEntries = Object.entries(prHistory)
    .filter(([name]) => ALL_EXERCISES.some(ex => ex.name === name && cats.includes(ex.category)))
    .flatMap(([, entries]) => entries);
  const raw = Array.from({ length: buckets }, (_, i) => {
    const bucketEnd = now - ((buckets - 1 - i) / buckets) * days * 24 * 3600000;
    const bucketStart = now - ((buckets - i) / buckets) * days * 24 * 3600000;
    let total = 0, count = 0;
    relevantEntries.forEach(e => {
      const t = new Date(e.date).getTime();
      if (t >= bucketStart && t <= bucketEnd) { total += e.estimated1RM; count++; }
    });
    return count > 0 ? Math.round(total / count) : 0;
  });
  const base = raw.find(v => v > 0) ?? 1;
  return raw.map((v, i) => ({ label: `${i + 1}`, val: v > 0 ? Math.round(((v - base) / base) * 100) : 0 }));
}
function calculateStreak(workouts: Workout[]): number {
  const gymW = [...workouts].filter(w => w.type === 'gym').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (gymW.length === 0) return 0;
  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const prevDate = new Date(checkDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = prevDate.toISOString().slice(0, 10);
    const trainedOnDay = gymW.some(w => w.date.slice(0, 10) === dateStr);
    const trainedOnPrev = gymW.some(w => w.date.slice(0, 10) === prevStr);
    if (trainedOnDay) { streak++; checkDate = prevDate; }
    else if (i === 0 && trainedOnPrev) { checkDate = prevDate; }
    else break;
  }
  return streak;
}
// ─── Main Training Screen ─────────────────────────────────────
type Screen = 'home' | 'routines' | 'routineDetail';
function WorkoutCompleteModal({ data, T, onClose }: {
  data: { name: string; duration: number; volume: number; exerciseCount: number; newPRs: { name: string; weight: number }[]; streak: number; weekDays: boolean[] };
  T: any;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const streakNum = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1, duration: 1600, useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(ring2, { toValue: 1, duration: 1400, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(ring3, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ]),
      ]),
    ]).start();

    setTimeout(() => {
      Animated.spring(flameScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }).start();
    }, 800);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(contentY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
    }, 1100);

    const target = data.streak;
    const from = Math.max(0, target - 8);
    const startTime = Date.now() + 1600;
    const duration2 = 800;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      const p = Math.min(elapsed / duration2, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      streakNum.setValue(Math.round(from + (target - from) * ease));
      if (p >= 1) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const CIRCUMFERENCE_1 = 427;
  const CIRCUMFERENCE_2 = 345;
  const CIRCUMFERENCE_3 = 264;

  const ring1Offset = ring1.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE_1, 56] });
  const ring2Offset = ring2.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE_2, 88] });
  const ring3Offset = ring3.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE_3, 94] });

  const DAY_LBLS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  return (
    <Modal visible animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#3D1500' }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingTop: 70, paddingBottom: 30, position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.03)', top: -60, left: -60 }} />
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,140,0,0.05)', bottom: -40, right: -20 }} />

          {/* Rings */}
          <View style={{ width: 160, height: 160, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={160} height={160} viewBox="0 0 160 160" style={{ position: 'absolute' }}>
              <Circle cx={80} cy={80} r={68} fill="none" stroke="rgba(255,140,0,0.08)" strokeWidth={10} />
              <AnimatedCircle cx={80} cy={80} r={68} fill="none" stroke="rgba(255,200,0,0.9)" strokeWidth={10}
                strokeDasharray={CIRCUMFERENCE_1} strokeDashoffset={ring1Offset}
                strokeLinecap="round" transform="rotate(-90 80 80)" />
            </Svg>
            <Svg width={160} height={160} viewBox="0 0 160 160" style={{ position: 'absolute', opacity: 0.55 }}>
              <Circle cx={80} cy={80} r={55} fill="none" stroke="rgba(255,100,0,0.1)" strokeWidth={7} />
              <AnimatedCircle cx={80} cy={80} r={55} fill="none" stroke="rgba(255,100,0,0.8)" strokeWidth={7}
                strokeDasharray={CIRCUMFERENCE_2} strokeDashoffset={ring2Offset}
                strokeLinecap="round" transform="rotate(-90 80 80)" />
            </Svg>
            <Svg width={160} height={160} viewBox="0 0 160 160" style={{ position: 'absolute', opacity: 0.35 }}>
              <Circle cx={80} cy={80} r={42} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
              <AnimatedCircle cx={80} cy={80} r={42} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={5}
                strokeDasharray={CIRCUMFERENCE_3} strokeDashoffset={ring3Offset}
                strokeLinecap="round" transform="rotate(-90 80 80)" />
            </Svg>

            {/* Flame + Number */}
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: flameScale }] }}>
              <Svg width={44} height={52} viewBox="0 0 58 68" fill="none">
                <Path d="M29 2C29 2 42 14 42 26C42 26 46 20 44 14C44 14 56 24 56 38C56 52.6 43.7 66 29 66C14.3 66 2 52.6 2 38C2 24 14 14 14 14C12 20 16 26 16 26C16 14 29 2 29 2Z" fill="url(#fg1)" />
                <Path d="M29 22C29 22 36 30 36 38C36 38 38 34 37 30C37 30 44 36 44 42C44 49.7 37.2 56 29 56C20.8 56 14 49.7 14 42C14 36 21 30 21 30C20 34 22 38 22 38C22 30 29 22 29 22Z" fill="url(#fg2)" />
                <Path d="M29 36C29 36 32 40 32 44C32 47.3 30.8 50 29 50C27.2 50 26 47.3 26 44C26 40 29 36 29 36Z" fill="rgba(255,255,200,0.9)" />
                <Defs>
                  <Stop offset="0%" stopColor="#FFD700" />
                  <Stop offset="100%" stopColor="#CC2200" />
                </Defs>
              </Svg>
              <Animated.Text style={{ fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -2, marginTop: -4, textShadowColor: 'rgba(255,140,0,0.8)', textShadowRadius: 10 }}>
                {data.streak}
              </Animated.Text>
            </Animated.View>
          </View>

          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{lang === 'en' ? 'Workout Complete' : 'Training abgeschlossen'}</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.8 }}>{data.name}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{data.streak} {lang === 'en' ? 'Days Streak' : 'Tage Streak'}</Text>
          </View>
        </View>

        {/* Content */}
        <Animated.ScrollView
          style={{ flex: 1, backgroundColor: '#FAF6F1', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <Animated.View style={{ flexDirection: 'row', gap: 8, opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
            {[
              { v: `${data.duration}'`, l: 'Dauer' },
              { v: `${(data.volume / 1000).toFixed(1)}t`, l: 'Volumen' },
              { v: String(data.exerciseCount), l: 'Übungen' },
            ].map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(60,30,10,0.08)' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#2A1F14', letterSpacing: -0.8 }}>{s.v}</Text>
                <Text style={{ fontSize: 9, color: '#B0A89E', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 }}>{s.l}</Text>
              </View>
            ))}
          </Animated.View>

          {/* PRs */}
          {data.newPRs.length > 0 && (
            <Animated.View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: 'rgba(139,105,20,0.25)', opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
              <View style={{ height: 3, backgroundColor: '#FFD700', borderRadius: 2, marginBottom: 12, marginHorizontal: -16, marginTop: -16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
              {data.newPRs.slice(0, 2).map((pr, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: i < data.newPRs.length - 1 ? 10 : 0 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(139,105,20,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <IconTrophy size={20} color="#8B6914" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: '#8B6914', marginBottom: 3 }}>Neuer PR</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2A1F14' }} numberOfLines={1}>{pr.name}</Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#8B6914', letterSpacing: -0.5 }}>{pr.weight}<Text style={{ fontSize: 12 }}> kg</Text></Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Week */}
          <Animated.View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: 'rgba(60,30,10,0.08)', opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: '#B0A89E', marginBottom: 12 }}>{lang === 'en' ? 'This Week' : 'Diese Woche'}</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {DAY_LBLS.map((lbl, idx) => {
                const done = data.weekDays[idx];
                const isNow = idx === todayIdx;
                return (
                  <View key={lbl} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                    <View style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
                      done ? { backgroundColor: '#7B4A2D' } : isNow ? { backgroundColor: '#F5EFE8', borderWidth: 2, borderColor: '#7B4A2D' } : { backgroundColor: '#F5EFE8' }]}>
                      {done && <IconCheck color="#fff" size={12} />}
                    </View>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: done || isNow ? '#7B4A2D' : '#B0A89E' }}>{lbl}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Button */}
          <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
            <TouchableOpacity style={{ backgroundColor: '#7B4A2D', borderRadius: 18, padding: 18, alignItems: 'center' }} onPress={onClose} activeOpacity={0.85}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>{lang === 'en' ? 'Continue →' : 'Weiter →'}</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </View>
    </Modal>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export default function TrainingScreen() {
  const { colors } = useAppTheme();
  const { lang } = useLanguage();
const T = {
  bg:           colors.bg,
  card:         colors.card,
  cardAlt:      colors.cardSecondary,
  border:       'rgba(60,30,10,0.08)',
  borderSoft:   'rgba(60,30,10,0.05)',
  orange:       colors.accent,
  orangeAlpha:  colors.accent + '26',
  orangeBorder: colors.accent + '48',
  blue:         '#3A7AC0',
  blueAlpha:    'rgba(58,122,192,0.08)',
  blueBorder:   'rgba(58,122,192,0.14)',
  green:        '#4A8C5C',
  greenAlpha:   'rgba(74,140,92,0.08)',
  greenBorder:  'rgba(74,140,92,0.14)',
  red:          '#C0392B',
  redAlpha:     'rgba(192,57,43,0.07)',
  redBorder:    'rgba(192,57,43,0.14)',
  gold:         '#8B6914',
  goldAlpha:    'rgba(139,105,20,0.08)',
  goldBorder:   'rgba(139,105,20,0.18)',
  yellow:       '#8B6914',
  white:        '#FFFFFF',
  text1:        '#2A1F14',
  text2:        '#5A4A3A',
  text3:        '#7A6E63',
  text4:        '#B0A89E',
};
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPREntry, setShowPREntry] = useState(false);
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showWorkoutComplete, setShowWorkoutComplete] = useState(false);
const [completedWorkoutData, setCompletedWorkoutData] = useState<{
  name: string; duration: number; volume: number; exerciseCount: number;
  newPRs: { name: string; weight: number }[]; streak: number; weekDays: boolean[];
} | null>(null);
  const [editPR, setEditPR] = useState<{ name: string; weight: number; reps: number } | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionAdvice, setNutritionAdvice] = useState<ReturnType<typeof getNutritionAdvice> | null>(null);
  const [lastWorkoutScore, setLastWorkoutScore] = useState(0);
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, WorkoutSet[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [muscles, setMuscles] = useState<MuscleMap>({});
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [readiness, setReadiness] = useState<TrainingReadiness | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [lang]));

  async function loadAll() {
    await syncAppleHealthWorkouts().catch(() => {});
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const ws: Workout[] = JSON.parse(rawW);
      setWorkouts(ws);
      const lastData: Record<string, WorkoutSet[]> = {};
      [...ws].reverse().forEach(w => w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; }));
      setLastWorkoutData(lastData);
      const newMuscles = calculateMuscleRecovery(ws);
      setMuscles(newMuscles);
      await AsyncStorage.setItem('muscleRecovery', JSON.stringify(newMuscles));
    } else {
      const def: MuscleMap = {};
      MUSCLE_GROUPS.forEach(m => { def[m] = { level: 100, lastTrained: null }; });
      setMuscles(def);
      await AsyncStorage.setItem('muscleRecovery', JSON.stringify(def));
    }
    setReadiness(await getTrainingReadiness(lang));
    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w: Workout = JSON.parse(rawActive);
      if (isToday(w.date)) { if (w.type === 'run') setActiveRun(true); else setActiveWorkout(w); }
      else { await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer'); }
    }
    const rawMaxes = await AsyncStorage.getItem('userMaxes');
    if (rawMaxes) setUserMaxes(JSON.parse(rawMaxes));
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));
    const rawRoutines = await AsyncStorage.getItem('routines');
    if (rawRoutines) setRoutines(JSON.parse(rawRoutines));
  }

  async function saveRoutine(r: Routine) { const u = [...routines, r]; setRoutines(u); await AsyncStorage.setItem('routines', JSON.stringify(u)); }
  async function updateRoutine(r: Routine) { const u = routines.map(x => x.id === r.id ? r : x); setRoutines(u); await AsyncStorage.setItem('routines', JSON.stringify(u)); }
  async function deleteRoutine(id: string) { const u = routines.filter(r => r.id !== id); setRoutines(u); await AsyncStorage.setItem('routines', JSON.stringify(u)); }
  async function savePR(name: string, weight: number, reps: number) {
    const est = calc1RM(weight, reps);
    const newPRH = { ...prHistory, [name]: [...(prHistory[name] || []), { date: new Date().toISOString(), weight, reps, estimated1RM: est }] };
    setPRHistory(newPRH); await AsyncStorage.setItem('prHistory', JSON.stringify(newPRH));
    if (est > (userMaxes[name] || 0)) { const m = { ...userMaxes, [name]: est }; setUserMaxes(m); await AsyncStorage.setItem('userMaxes', JSON.stringify(m)); }
  }

  const gymWorkouts = workouts.filter(w => w.type === 'gym');
  const lastGym = [...gymWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const weekDays = getWeekTrainings(workouts);
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const prCount = Object.keys(prHistory).length;
  const bestPR = Object.entries(prHistory).sort((a, b) => (b[1][b[1].length - 1]?.estimated1RM ?? 0) - (a[1][a[1].length - 1]?.estimated1RM ?? 0))[0];
  const readyCount = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80).length;
  const warnCount = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40).length;
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12
    ? (lang === 'en' ? 'Good Morning' : 'Guten Morgen')
    : greetHour < 18
      ? (lang === 'en' ? 'Good Day' : 'Guten Tag')
      : (lang === 'en' ? 'Good Evening' : 'Guten Abend');

  async function startFree() {
    const w: Workout = { id: Date.now().toString(), date: new Date().toISOString(), name: 'Freies Training', exercises: [], duration: 0, intensity: 3, type: 'gym' };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }
  async function startWithLast() {
    if (!lastGym) return startFree();
    const w: Workout = { id: Date.now().toString(), date: new Date().toISOString(), name: lastGym.name, exercises: lastGym.exercises.map(ex => ({ ...ex, id: Date.now().toString() + ex.name, sets: ex.sets.map(() => ({ reps: '', weight: '' })) })), duration: 0, intensity: 3, type: 'gym' };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }
  async function startRoutine(r: Routine) {
    const w: Workout = { id: Date.now().toString(), date: new Date().toISOString(), name: r.name, exercises: r.exercises.map(re => ({ id: Date.now().toString() + re.name, name: re.name, muscleGroup: re.muscleGroup, equipment: re.equipment, sets: Array.from({ length: re.defaultSets }, () => ({ reps: '', weight: '' })) })), duration: 0, intensity: 3, type: 'gym' };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w)); setActiveWorkout(w); setScreen('home');
  }
  async function finishWorkout() {
    if (!activeWorkout) return;
    const raw = await AsyncStorage.getItem('gymWorkoutTimer');
    let duration = 1;
    if (raw) { try { const { startedAt } = JSON.parse(raw); if (startedAt) duration = Math.max(1, Math.round((Date.now() - startedAt) / 60000)); } catch {} }
    const score = calcWorkoutScore({ ...activeWorkout, duration }, userMaxes);
    const finished: Workout = { ...activeWorkout, duration, score };
    const newPRH = { ...prHistory };
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best > 0) { const cur = newPRH[ex.name] || []; const curMax = cur.length > 0 ? cur[cur.length - 1].estimated1RM : 0; if (best > curMax) { const bestSet = ex.sets.reduce((b, s) => calc1RM(parseFloat(s.weight || '0'), parseFloat(s.reps || '0')) > calc1RM(parseFloat(b.weight || '0'), parseFloat(b.reps || '0')) ? s : b, ex.sets[0]); newPRH[ex.name] = [...(newPRH[ex.name] || []), { date: new Date().toISOString(), weight: parseFloat(bestSet.weight || '0'), reps: parseFloat(bestSet.reps || '0'), estimated1RM: best }]; } }
    }
    await AsyncStorage.setItem('prHistory', JSON.stringify(newPRH));
    const newMaxes = { ...userMaxes };
    for (const ex of finished.exercises) { const best = getBest1RM(ex.sets); if (best > (newMaxes[ex.name] || 0)) newMaxes[ex.name] = best; }
    await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
    const raw2 = await AsyncStorage.getItem('workouts'); const arr = raw2 ? JSON.parse(raw2) : [];
    arr.push(finished); await AsyncStorage.setItem('workouts', JSON.stringify(arr));
    await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer');
    setActiveWorkout(null);
    const rawProfile = await AsyncStorage.getItem('profile');
    const bw = rawProfile ? JSON.parse(rawProfile).weight : 75;
    setNutritionAdvice(getNutritionAdvice(score, duration, parseFloat(bw) || 75));
    setLastWorkoutScore(score);
const newPRs: { name: string; weight: number }[] = [];
for (const ex of finished.exercises) {
  const best = getBest1RM(ex.sets);
  if (best > 0 && best > (userMaxes[ex.name] || 0)) {
    newPRs.push({ name: ex.name, weight: best });
  }
}
const vol = finished.exercises.reduce((t, ex) => t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0);
const raw3 = await AsyncStorage.getItem('workouts');
const allW: Workout[] = raw3 ? JSON.parse(raw3) : [];
const streakVal = calculateStreak(allW);
const weekD = getWeekTrainings(allW);
setCompletedWorkoutData({
  name: finished.name, duration, volume: Math.round(vol),
  exerciseCount: finished.exercises.length,
  newPRs, streak: streakVal, weekDays: weekD,
});
// Muscle Recovery neu berechnen
const rawWAfter = await AsyncStorage.getItem('workouts');
const allWAfter: Workout[] = rawWAfter ? JSON.parse(rawWAfter) : [];
const newMuscles = calculateMuscleRecovery(allWAfter);
setMuscles(newMuscles);
await AsyncStorage.setItem('muscleRecovery', JSON.stringify(newMuscles));
setMuscles(newMuscles);
await AsyncStorage.setItem('muscleRecovery', JSON.stringify(newMuscles));
setShowWorkoutComplete(true);
scheduleNutritionReminder(lang).catch(() => {});
await loadAll();
  }
  async function stopSession() {
    setActiveRun(false); setActiveWorkout(null);
    await AsyncStorage.removeItem('activeWorkout'); await AsyncStorage.removeItem('gymWorkoutTimer'); await AsyncStorage.removeItem('activeRunTimer');
    await loadAll();
  }

  // ─── Styles ───────────────────────────────────────────────────
  const sw = StyleSheet.create({
    track: { backgroundColor: T.card, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 50, padding: 6, height: 68, overflow: 'hidden', justifyContent: 'center' },
    thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.orange, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    label: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: '600', color: T.text3 },
  });

  const screenSt = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft },
    eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 4 },
    title: { fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border, marginTop: 4 },
  });

  const modalSt = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 0 },
    title: { fontSize: 20, fontWeight: '800', color: T.text1, letterSpacing: -0.5, marginBottom: 6 },
    sub: { fontSize: 13, color: T.text3, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: T.border },
    searchInput: { flex: 1, fontSize: 14, color: T.text1 },
    groupLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardAlt, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border },
    rowText: { flex: 1, fontSize: 14, color: T.text1, fontWeight: '500' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelText: { fontSize: 14, color: T.text3 },
  });

  const btn = StyleSheet.create({
    primary: { backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    primaryText: { fontSize: 15, fontWeight: '700', color: T.white },
    ghost: { padding: 14, alignItems: 'center' },
    ghostText: { fontSize: 14, color: T.text3 },
    outline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: T.orangeBorder, borderRadius: 14, borderStyle: 'dashed', padding: 13, marginTop: 10 },
    outlineText: { fontSize: 13, fontWeight: '600', color: T.orange },
  });

  const field = StyleSheet.create({
    label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: T.text4, marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: T.card, borderRadius: 14, padding: 14, color: T.text1, fontSize: 15, marginBottom: 0, borderWidth: 1, borderColor: T.border },
    list: { backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: T.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: T.borderSoft },
    rowText: { flex: 1, fontSize: 13, fontWeight: '600', color: T.text1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
  });

  const tabSt = StyleSheet.create({
    btn: { flex: 1, borderRadius: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.border, alignItems: 'center' },
    btnActive: { backgroundColor: T.orangeAlpha, borderColor: T.orangeBorder },
    text: { fontSize: 12, fontWeight: '600', color: T.text4 },
    textActive: { color: T.orange },
  });

  const rSt = StyleSheet.create({
    card: { backgroundColor: T.card, borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: T.border },
    name: { fontSize: 16, fontWeight: '700', color: T.text1, letterSpacing: -0.3, marginBottom: 4 },
    meta: { fontSize: 11, color: T.text3, marginBottom: 8 },
    chipRow: { flexDirection: 'row', gap: 6 },
    chip: { backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.orangeBorder },
    chipText: { fontSize: 11, fontWeight: '600', color: T.orange },
    createCard: { backgroundColor: T.card, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, borderWidth: 1, borderColor: T.orangeBorder },
    createIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.orangeAlpha, alignItems: 'center', justifyContent: 'center' },
    createTitle: { fontSize: 15, fontWeight: '700', color: T.text1, marginBottom: 2 },
    createSub: { fontSize: 11, color: T.text3 },
    editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.blueAlpha, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.blueBorder },
    deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.redAlpha, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.redBorder },
    communityBadge: { backgroundColor: T.blueAlpha, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.blueBorder },
  });

  const pr = StyleSheet.create({
    sectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, color: T.text4, marginBottom: 12 },
    repBtn: { flex: 1, backgroundColor: T.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: T.border },
    repBtnActive: { backgroundColor: T.orange, borderColor: T.orange },
    repNum: { fontSize: 30, fontWeight: '800', color: T.text1, marginBottom: 2 },
    repLbl: { fontSize: 11, color: T.text3 },
    weightBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
    weightInput: { flex: 1, fontSize: 52, fontWeight: '800', color: T.text1, letterSpacing: -1 },
    weightUnit: { fontSize: 20, fontWeight: '600', color: T.text4 },
    previewCard: { backgroundColor: T.orangeAlpha, borderRadius: 14, padding: 16, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: T.orangeBorder },
    previewLabel: { fontSize: 11, fontWeight: '700', color: T.orange, textTransform: 'uppercase', letterSpacing: 0.8 },
    previewVal: { fontSize: 30, fontWeight: '800', color: T.orange },
  });

  const prCard = StyleSheet.create({
    card: { backgroundColor: T.card, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border },
    rank: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    rankText: { fontSize: 12, fontWeight: '800' },
    name: { fontSize: 16, fontWeight: '700', color: T.text1, letterSpacing: -0.3 },
    date: { fontSize: 12, color: T.text4, marginTop: 2 },
    rm: { fontSize: 20, fontWeight: '800', color: T.text1, letterSpacing: -0.5 },
    rmLabel: { fontSize: 10, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.5 },
    stat: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border },
    statVal: { fontSize: 15, fontWeight: '700', color: T.text1 },
    statLbl: { fontSize: 9, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
    delta: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  });

  const hist = StyleSheet.create({
    card: { backgroundColor: T.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border },
    stat: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: T.border },
    statVal: { fontSize: 13, fontWeight: '700' },
    statLbl: { fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  });

  const activeS = StyleSheet.create({
    header: { backgroundColor: T.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderBottomColor: T.borderSoft },
    workoutTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: T.orange, marginBottom: 4 },
    workoutTitle: { fontSize: 20, fontWeight: '800', color: T.text1, letterSpacing: -0.4 },
    timerBadge: { backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border },
    timerText: { fontSize: 18, fontWeight: '700', color: T.text1, letterSpacing: 1 },
    timerLabel: { fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft },
    statBox: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: T.border },
    statVal: { fontSize: 18, fontWeight: '700' },
    statLbl: { fontSize: 8, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    restCard: { backgroundColor: T.card, borderLeftWidth: 3, padding: 12, marginBottom: 12, marginTop: 12, borderRadius: 0 },
    restLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    restTimer: { fontSize: 22, fontWeight: '800', color: T.text1, letterSpacing: 1 },
    restBtn: { backgroundColor: T.cardAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: T.border },
    restBtnText: { fontSize: 11, fontWeight: '600', color: T.text3 },
    exCard: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border },
    musclePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    musclePillText: { fontSize: 11, fontWeight: '500' },
    exName: { flex: 1, fontSize: 15, fontWeight: '700', color: T.text1 },
    recRow: { backgroundColor: T.blueAlpha, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: T.blueBorder },
    recText: { fontSize: 12, color: T.blue, fontWeight: '500' },
    lastRow: { flexDirection: 'row', backgroundColor: T.cardAlt, borderRadius: 8, padding: 8, marginBottom: 8 },
    lastLabel: { fontSize: 11, color: T.text3 },
    lastVal: { fontSize: 11, color: T.orange, fontWeight: '500', flex: 1 },
    oneRM: { fontSize: 11, color: T.text3, marginBottom: 10 },
    setHdr: { fontSize: 9, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
    setRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
    setNum: { fontSize: 13, color: T.text3, width: 24, textAlign: 'center' },
    setInput: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 10, padding: 11, color: T.text1, fontSize: 15, textAlign: 'center', borderWidth: 1, borderColor: T.border },
    setInputDone: { borderColor: 'rgba(52,199,89,0.4)', color: T.green },
    addSetBtn: { padding: 8, alignItems: 'center' },
    addSetText: { fontSize: 13, color: T.orange, fontWeight: '500' },
  });

  // Active states
  if (activeRun) return <RunScreen onStop={stopSession} />;
  if (activeWorkout) return <ActiveGymWorkout workout={activeWorkout} userMaxes={userMaxes} prHistory={prHistory} lastWorkoutData={lastWorkoutData} onUpdate={setActiveWorkout} onFinish={finishWorkout} />;
  if (screen === 'routines') return <RoutineScreen routines={routines} onSelectRoutine={r => { setSelectedRoutine(r); setScreen('routineDetail'); }} onCreateRoutine={saveRoutine} onUpdateRoutine={updateRoutine} onDeleteRoutine={deleteRoutine} onBack={() => setScreen('home')} />;
  if (screen === 'routineDetail' && selectedRoutine) return <RoutineDetail routine={selectedRoutine} onStart={startRoutine} onBack={() => setScreen('routines')} />;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {showHistory && <HistoryScreen onClose={() => { setShowHistory(false); loadAll(); }} onDelete={() => loadAll()} />}
      {editPR && <PREntryScreen onClose={() => setEditPR(null)} onSave={savePR} editExercise={editPR.name} editWeight={editPR.weight} editReps={editPR.reps} />}
      {showPREntry && <PREntryScreen onClose={() => setShowPREntry(false)} onSave={savePR} />}
      {showBodyModal && <BodyModal muscles={muscles} onClose={() => setShowBodyModal(false)} />}
      {showProgress && <ProgressDetailModal prHistory={prHistory} T={T} onClose={() => setShowProgress(false)} />}
      {showWorkoutComplete && completedWorkoutData && (
        <WorkoutCompleteModal data={completedWorkoutData} T={T} onClose={() => { setShowWorkoutComplete(false); setCompletedWorkoutData(null); setShowNutrition(true); }} />
      )}

      <Modal visible={showNutrition} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View><Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.orange, marginBottom: 4 }}>{lang === 'en' ? 'Done' : 'Fertig'}</Text><Text style={{ fontSize: 24, fontWeight: '800', color: T.text1, letterSpacing: -0.5 }}>{lang === 'en' ? 'Nutrition' : 'Ernährung'} 🍗</Text></View>
              <View style={{ backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: T.orangeBorder }}><Text style={{ fontSize: 14, fontWeight: '800', color: T.orange }}>⚡ {lastWorkoutScore}</Text></View>
            </View>
            {nutritionAdvice && <>
              <View style={{ backgroundColor: T.greenAlpha, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.greenBorder }}>
                <Text style={{ color: T.green, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{nutritionAdvice.immediate.timing}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.immediate.protein}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Protein</Text></View>
                  <View style={{ width: 1, backgroundColor: T.border }} />
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.immediate.carbs}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{lang === 'en' ? 'Carbs' : 'Kohlenhydrate'}</Text></View>
                </View>
              </View>
              <View style={{ backgroundColor: T.blueAlpha, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.blueBorder }}>
                <Text style={{ color: T.blue, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{nutritionAdvice.later.timing}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.later.protein}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Protein</Text></View>
                  <View style={{ width: 1, backgroundColor: T.border }} />
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.later.carbs}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{lang === 'en' ? 'Carbs' : 'Kohlenhydrate'}</Text></View>
                </View>
              </View>
            </>}
            <TouchableOpacity style={{ backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16 }} onPress={() => setShowNutrition(false)}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: T.white }}>{lang === 'en' ? 'Got it' : 'Verstanden'} ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* HEADER */}
          <View style={{ paddingTop: 62, paddingHorizontal: 20, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: T.text4, marginBottom: 5 }}>
                {DAY_LABELS[todayIdx]}tag
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: T.text1, letterSpacing: -1, lineHeight: 30 }}>{greeting}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowHistory(true)} style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
              <IconHistory size={17} color={T.text3} />
            </TouchableOpacity>
          </View>

          {/* TRAININGSBEREITSCHAFT */}
          {readiness && (
            <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
              <View style={{ backgroundColor: T.cardAlt, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={76} height={76} viewBox="0 0 76 76" style={{ position: 'absolute' }}>
                    <Circle cx={38} cy={38} r={30} fill="none" stroke={T.borderSoft} strokeWidth={9} />
                    <Circle
                      cx={38} cy={38} r={30} fill="none" stroke={readiness.color} strokeWidth={9}
                      strokeDasharray={`${(readiness.score / 100) * 188.5} 188.5`}
                      strokeLinecap="round" transform="rotate(-90 38 38)"
                    />
                  </Svg>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: T.text1 }}>{readiness.score}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 5 }}>
                    {lang === 'en' ? 'Training Readiness' : 'Trainingsbereitschaft'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: readiness.color }} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: readiness.color }}>{readiness.label}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: T.text2 }}>{readiness.recommendation}</Text>
                </View>
              </View>
            </View>
          )}

          {/* WEEK DOTS */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 18, marginBottom: 18 }}>
            {DAY_LABELS.map((lbl, idx) => {
              const done = weekDays[idx], isNow = idx === todayIdx;
              return (
                <View key={lbl} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
                    done ? { backgroundColor: T.text1 } :
                    isNow ? { borderWidth: 2, borderColor: T.text1 } :
                    { borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.12)' }]}>
                    {done ? <IconCheck color="#fff" size={10} /> : isNow ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.text1 }} /> : null}
                  </View>
                  <Text style={{ fontSize: 8, fontWeight: isNow ? '800' : '600', color: isNow ? T.text1 : done ? T.text4 : '#C8C0B8' }}>{lbl}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 20, marginBottom: 18 }} />

          {/* HEUTE EMPFOHLEN */}
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 10 }}>{lang === 'en' ? 'Today\'s Recommendation' : 'Heute empfohlen'}</Text>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
              {(() => {
                const readyMuscles = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80);
                const PUSH = ['Brust', 'Schultern', 'Trizeps'];
                const PULL = ['Rücken', 'Bizeps'];
                const LEGS = ['Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden'];
                const pushReady = PUSH.filter(m => readyMuscles.includes(m));
                const pullReady = PULL.filter(m => readyMuscles.includes(m));
                const legsReady = LEGS.filter(m => readyMuscles.includes(m));
                let workoutType = 'Fokus Training';
                if (readyMuscles.length === MUSCLE_GROUPS.length) workoutType = 'Full Body';
                else if (pushReady.length >= 2 && pushReady.length >= pullReady.length && pushReady.length >= legsReady.length) workoutType = 'Push Day';
                else if (pullReady.length >= 2 && pullReady.length >= legsReady.length) workoutType = 'Pull Day';
                else if (legsReady.length >= 2) workoutType = 'Leg Day';
                else if (pushReady.length > 0 && pullReady.length > 0) workoutType = 'Upper Body';
                return (
                  <>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.8, marginBottom: 16 }}>{workoutType}</Text>
                    <TouchableOpacity onPress={startFree} style={{ backgroundColor: T.text1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                          <IconPlay size={10} color="#fff" />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{lang === 'en' ? 'Start Now' : 'Jetzt starten'}</Text>
                      </View>
                      <IconChevronRight color="rgba(255,255,255,0.3)" size={12} />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setScreen('routines')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <IconList size={13} color={T.text2} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: T.text2 }}>{lang === 'en' ? 'Routines' : 'Routinen'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={startFree} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <IconPlus size={13} color={T.text2} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: T.text2 }}>{lang === 'en' ? 'Free' : 'Frei'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
          {/* MUSKELREGENERATION */}
          <View style={{ paddingHorizontal: 20, marginBottom: 22 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4, marginBottom: 10 }}>{lang === 'en' ? 'Muscle Recovery' : 'Muskelregeneration'}</Text>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Svg width={76} height={76} viewBox="0 0 76 76">
                <Circle cx={38} cy={38} r={30} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={9} />
                <Circle cx={38} cy={38} r={30} fill="none" stroke={T.green} strokeWidth={9}
                  strokeDasharray={`${(MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80).length / MUSCLE_GROUPS.length) * 188} 188`}
                  strokeDashoffset={0} strokeLinecap="round" transform="rotate(-90 38 38)" />
                <Circle cx={38} cy={38} r={30} fill="none" stroke={T.red} strokeWidth={9}
                  strokeDasharray={`${(MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40).length / MUSCLE_GROUPS.length) * 188} 188`}
                  strokeDashoffset={`-${(MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80).length / MUSCLE_GROUPS.length) * 188}`}
                  strokeLinecap="round" transform="rotate(-90 38 38)" />
              </Svg>
              <View style={{ flex: 1 }}>
                {[
                  { label: `${MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80).length} ${lang === 'en' ? 'ready' : 'bereit'}`, color: T.green },
                  { label: `${MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) < 40).length} ${lang === 'en' ? 'caution' : 'schonen'}`, color: T.red },
                  { label: `${MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 40 && (muscles[m]?.level ?? 100) < 80).length} ${lang === 'en' ? 'medium' : 'mittel'}`, color: T.text4 },
                ].map(item => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: item.color }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: T.text1 }}>{item.label}</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={() => setShowBodyModal(true)} style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: T.text2 }}>{lang === 'en' ? 'View Details' : 'Details ansehen'}</Text>
                  <IconChevronRight size={10} color={T.text2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* BOTTOM NAV */}
          <View style={{ marginHorizontal: 20, borderRadius: 18, overflow: 'hidden', gap: 0.5, backgroundColor: 'rgba(0,0,0,0.07)' }}>
            <TouchableOpacity onPress={() => router.push('/prs' as any)} style={{ backgroundColor: T.bg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 21h8M12 17v4" stroke={T.text1} strokeWidth={1.8} strokeLinecap="round" />
                  <Path d="M5 3h14v5a7 7 0 01-14 0V3z" stroke={T.text1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M5 5H2v2a3 3 0 003 3M19 5h3v2a3 3 0 01-3 3" stroke={T.text1} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text1 }}>{lang === 'en' ? 'Personal Records' : 'Persönliche Rekorde'}</Text>
                <Text style={{ fontSize: 9, color: T.text4, marginTop: 1 }}>{Object.keys(prHistory).length} Rekorde gespeichert</Text>
              </View>
              <IconChevronRight color="#C8C0B8" size={12} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowHistory(true)} style={{ backgroundColor: T.bg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={4} width={18} height={18} rx={2} stroke={T.text1} strokeWidth={1.8} />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke={T.text1} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text1 }}>{lang === 'en' ? 'Training History' : 'Trainingsverlauf'}</Text>
                <Text style={{ fontSize: 9, color: T.text4, marginTop: 1 }}>{workouts.length} Einheiten</Text>
              </View>
              <IconChevronRight color="#C8C0B8" size={12} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowProgress(true)} style={{ backgroundColor: T.bg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconHistory size={16} color={T.text1} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text1 }}>{lang === 'en' ? 'Strength Development' : 'Kraftentwicklung'}</Text>
                <Text style={{ fontSize: 9, color: T.text4, marginTop: 1 }}>diesen Monat</Text>
              </View>
              {(() => {
                const data = computeProgressData(prHistory, '1M');
                const pct = data.length >= 2 ? data[data.length - 1].avg : 0;
                return pct !== 0 ? (
                  <Text style={{ fontSize: 17, fontWeight: '800', color: pct >= 0 ? T.green : T.red, marginRight: 6 }}>{pct >= 0 ? '+' : ''}{pct}%</Text>
                ) : null;
              })()}
              <IconChevronRight color="#C8C0B8" size={12} />
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}
