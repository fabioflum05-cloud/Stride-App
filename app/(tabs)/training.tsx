import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, AppStateStatus,
  Dimensions, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, {
  Circle, Defs, Ellipse,
  Line,
  Path, RadialGradient, Rect, Stop
} from 'react-native-svg';
import { useAppTheme } from '../../constants/ThemeContext';

function getT(colors: any) {
  return {
    bg: colors.bg, card: colors.card, cardAlt: colors.cardSecondary,
    border: 'rgba(60,30,10,0.08)', borderSoft: 'rgba(60,30,10,0.05)',
    orange: colors.accent, orangeAlpha: colors.accent + '26', orangeBorder: colors.accent + '48',
    blue: '#3A7AC0', blueAlpha: 'rgba(58,122,192,0.08)', blueBorder: 'rgba(58,122,192,0.14)',
    green: '#4A8C5C', greenAlpha: 'rgba(74,140,92,0.08)', greenBorder: 'rgba(74,140,92,0.14)',
    red: '#C0392B', redAlpha: 'rgba(192,57,43,0.07)', redBorder: 'rgba(192,57,43,0.14)',
    gold: '#8B6914', goldAlpha: 'rgba(139,105,20,0.08)', goldBorder: 'rgba(139,105,20,0.18)',
    yellow: '#8B6914', white: '#FFFFFF',
    text1: '#2A1F14', text2: '#5A4A3A', text3: '#7A6E63', text4: '#B0A89E',
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
type Workout      = { id: string; date: string; name: string; exercises: Exercise[]; duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo'; score?: number };
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

function calculateMuscleRecovery(workouts: Workout[]): MuscleMap {
  const cutoff = Date.now() - 7 * 24 * 3600000;
  const hitMap: Record<string, { date: string; fatigue: number }[]> = {};

  workouts
    .filter(w => new Date(w.date).getTime() > cutoff)
    .forEach(w => {
      w.exercises?.forEach(ex => {
        const exData = EXERCISE_DB.find(e => e.name === ex.name);
        if (!exData) return;

        const setCount = ex.sets.filter(
          s => parseFloat(s.reps || '0') > 0 && parseFloat(s.weight || '0') > 0
        ).length || ex.sets.length;

        const primaryFatigue = Math.min(1.0, setCount / MAX_SETS_FOR_FULL_FATIGUE);
        if (!hitMap[exData.muscleGroup]) hitMap[exData.muscleGroup] = [];
        hitMap[exData.muscleGroup].push({ date: w.date, fatigue: primaryFatigue });

        exData.secondary.forEach(sec => {
          const secFatigue = Math.min(1.0, (setCount / MAX_SETS_FOR_FULL_FATIGUE) * sec.weight);
          if (!hitMap[sec.muscle]) hitMap[sec.muscle] = [];
          hitMap[sec.muscle].push({ date: w.date, fatigue: secFatigue });
        });
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
function formatDateLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(iso)) return `Heute, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  if (intensity === 'high') return { immediate: { protein: Math.round(w * 0.4), carbs: Math.round(w * 0.8), timing: 'Sofort (0–30 Min.)' }, later: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timing: '2–3 Stunden später' } };
  if (intensity === 'medium') return { immediate: { protein: Math.round(w * 0.3), carbs: Math.round(w * 0.5), timing: 'Sofort (0–45 Min.)' }, later: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timing: '3–4 Stunden später' } };
  return { immediate: { protein: Math.round(w * 0.25), carbs: Math.round(w * 0.3), timing: 'Innerhalb 1 Stunde' }, later: { protein: Math.round(w * 0.2), carbs: Math.round(w * 0.2), timing: '4–5 Stunden später' } };
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
      <Animated.Text style={[sw.label, { opacity: labelOpacity }]}>schieben zum starten</Animated.Text>
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
function ExercisePicker({ onSelect, onClose }: {
  onSelect: (name: string, muscleGroup: string, equipment: string) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const modal = { overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' as const }, sheet: { backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }, title: { fontSize: 20, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.5, marginBottom: 6 }, searchBox: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: T.border }, searchInput: { flex: 1, fontSize: 14, color: T.text1 }, row: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: T.cardAlt, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }, rowText: { flex: 1, fontSize: 14, color: T.text1, fontWeight: '500' as const }, cancelBtn: { padding: 14, alignItems: 'center' as const, marginTop: 4 }, cancelText: { fontSize: 14, color: T.text3 } };
  const [search, setSearch] = useState('');
  const exercises = ALL_EXERCISES ?? [];
  const filtered = search.length > 0 ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : exercises.slice(0, 30);
  return (
    <Modal visible transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={[modal.sheet, { maxHeight: '85%' }]}>
          <Text style={modal.title}>Übung hinzufügen</Text>
          <View style={modal.searchBox}>
            <IconSearch />
            <TextInput style={modal.searchInput} placeholder="Übung suchen..." placeholderTextColor={T.text4} value={search} onChangeText={setSearch} autoFocus />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filtered.map(ex => (
              <TouchableOpacity key={ex.id} style={modal.row} onPress={() => onSelect(ex.name, ex.category, '')}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.rowText}>{ex.name}</Text>
                  <Text style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{ex.category}</Text>
                </View>
                <IconChevronRight />
              </TouchableOpacity>
            ))}
            {search === '' && <Text style={{ color: T.text4, textAlign: 'center', padding: 16, fontSize: 12 }}>Tippe um alle {exercises.length} Übungen zu suchen</Text>}
          </ScrollView>
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── PR Screen ────────────────────────────────────────────────
function PRScreen({ prHistory, onClose, onAdd, onEdit }: {
  prHistory: PRHistory;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (name: string, weight: number, reps: number) => void;
}) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const entries = Object.entries(prHistory).sort(
    (a, b) => (b[1][b[1].length - 1]?.estimated1RM ?? 0) - (a[1][a[1].length - 1]?.estimated1RM ?? 0)
  );
  const rankColors = ['#FFD700', '#999999', '#CD7F32'];
  const rankBg = ['rgba(255,215,0,0.08)', 'rgba(192,192,192,0.06)', 'rgba(205,127,50,0.08)'];
  const rankBorder = ['rgba(255,215,0,0.2)', 'rgba(192,192,192,0.15)', 'rgba(205,127,50,0.2)'];
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: T.borderSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 5 }}>Bestleistungen</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }}>Records</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={onAdd} style={{ backgroundColor: T.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.white }}>+ Eintragen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
              <IconClose />
            </TouchableOpacity>
          </View>
        </View>
        {entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <IconTrophy size={40} color={T.text4} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: T.text1 }}>Noch keine PRs</Text>
            <Text style={{ fontSize: 13, color: T.text3 }}>Trage deinen ersten PR ein</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 60 }}>
            {entries.map(([name, history], i) => {
              const latest = history[history.length - 1];
              const prev = history.length > 1 ? history[history.length - 2] : null;
              const delta = prev ? Math.round(latest.estimated1RM - prev.estimated1RM) : null;
              return (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.borderSoft }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: rankBg[i] ?? T.cardAlt, borderWidth: 1, borderColor: rankBorder[i] ?? T.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: rankColors[i] ?? T.text4 }}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: T.text1 }} numberOfLines={1}>{name}</Text>
                    <Text style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{latest.weight} kg × {latest.reps} · {new Date(latest.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: '2-digit' })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 8, flexShrink: 0 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: T.text1, letterSpacing: -0.3 }}>{Math.round(latest.estimated1RM)} kg</Text>
                    <Text style={{ fontSize: 9, color: T.text4, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>1RM</Text>
                  </View>
                  {delta !== null && (
                    <View style={{ backgroundColor: delta >= 0 ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: delta >= 0 ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: delta >= 0 ? T.green : T.red }}>{delta >= 0 ? '+' : ''}{delta} kg</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => onEdit(name, latest.weight, latest.reps)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconEdit size={13} color={T.text4} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
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
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.orange, marginBottom: 5 }}>{isEdit ? 'PR bearbeiten' : 'Personal Record'}</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: T.text1, letterSpacing: -0.7 }}>{step === 'exercise' ? 'Übung wählen' : exercise}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
            <IconClose />
          </TouchableOpacity>
        </View>
        {step === 'exercise' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
              <IconSearch />
              <TextInput style={{ flex: 1, fontSize: 14, color: T.text1 }} placeholder="Übung suchen..." placeholderTextColor={T.text4} value={search} onChangeText={setSearch} />
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
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text4, marginBottom: 12 }}>Wiederholungen</Text>
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
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.text4, marginBottom: 12 }}>Gewicht</Text>
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
            <TouchableOpacity style={{ backgroundColor: T.orange, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => { const w = parseFloat(weight); if (!w || w <= 0) { Alert.alert('Bitte Gewicht eingeben'); return; } onSave(exercise, w, reps); onClose(); }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: T.white }}>{isEdit ? 'PR aktualisieren' : 'PR speichern'}</Text>
            </TouchableOpacity>
            {!isEdit && <TouchableOpacity style={{ padding: 14, alignItems: 'center', marginTop: 4 }} onPress={() => setStep('exercise')}><Text style={{ fontSize: 13, color: T.text3 }}>Andere Übung wählen</Text></TouchableOpacity>}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── History Screen ───────────────────────────────────────────
function HistoryScreen({ onClose, onDelete }: { onClose: () => void; onDelete: (id: string) => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
  const screen = { header: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.borderSoft }, eyebrow: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: T.orange, marginBottom: 4 }, title: { fontSize: 26, fontWeight: '800' as const, color: T.text1, letterSpacing: -0.7 }, closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border }, backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardAlt, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: T.border, marginTop: 4 } };
  const hist = { card: { backgroundColor: T.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.border }, stat: { flex: 1, backgroundColor: T.cardAlt, borderRadius: 8, padding: 8, alignItems: 'center' as const, borderWidth: 1, borderColor: T.border }, statVal: { fontSize: 13, fontWeight: '700' as const }, statLbl: { fontSize: 8, color: T.text4, textTransform: 'uppercase' as const, letterSpacing: 0.3, marginTop: 2 } };
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  useEffect(() => {
    AsyncStorage.getItem('workouts').then(r => r && setWorkouts(JSON.parse(r)));
    AsyncStorage.getItem('runs').then(r => r && setRuns(JSON.parse(r)));
  }, []);
  type Item = { _kind: 'workout'; data: Workout } | { _kind: 'run'; data: RunData };
  const all: Item[] = [...workouts.map(w => ({ _kind: 'workout' as const, data: w })), ...runs.map(r => ({ _kind: 'run' as const, data: r }))].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
  async function handleDelete(item: Item) {
    Alert.alert('Training löschen', 'Wirklich löschen?', [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: async () => {
      if (item._kind === 'workout') { const u = workouts.filter(w => w.id !== item.data.id); setWorkouts(u); await AsyncStorage.setItem('workouts', JSON.stringify(u)); onDelete(item.data.id); }
      else { const u = runs.filter(r => r.id !== item.data.id); setRuns(u); await AsyncStorage.setItem('runs', JSON.stringify(u)); }
    }}]);
  }
  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={screen.header}>
          <View style={{ flex: 1 }}>
            <Text style={screen.eyebrow}>Training</Text>
            <Text style={screen.title}>Verlauf</Text>
          </View>
          <TouchableOpacity style={screen.closeBtn} onPress={onClose}><IconClose /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {all.length === 0 && <Text style={{ color: T.text3, textAlign: 'center', marginTop: 60 }}>Noch keine Einheiten</Text>}
          {all.map((item, i) => {
            const isRun = item._kind === 'run';
            const w = !isRun ? item.data as Workout : null;
            const r = isRun ? item.data as RunData : null;
            const vol = w?.exercises?.reduce((t, ex) => t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0) ?? 0;
            return (
              <View key={i} style={hist.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isRun ? T.green : T.orange }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isRun ? T.green : T.orange, textTransform: 'uppercase', letterSpacing: 0.4 }}>{isRun ? 'Lauf' : 'Kraft'}</Text>
                  <Text style={{ fontSize: 11, color: T.text3 }}>{formatDateLabel(item.data.date)}</Text>
                  <TouchableOpacity style={{ marginLeft: 'auto' as any, width: 28, height: 28, borderRadius: 14, backgroundColor: T.redAlpha, alignItems: 'center', justifyContent: 'center' }} onPress={() => handleDelete(item)}>
                    <IconTrash size={14} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: T.text1, letterSpacing: -0.3, marginBottom: 10 }}>{isRun ? 'Lauftraining' : w?.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {isRun && r ? (
                    <>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.green }]}>{r.distance.toFixed(1)}</Text><Text style={hist.statLbl}>km</Text></View>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.blue }]}>{formatTime(r.duration)}</Text><Text style={hist.statLbl}>Zeit</Text></View>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.orange }]}>{r.pace}</Text><Text style={hist.statLbl}>/km</Text></View>
                    </>
                  ) : (
                    <>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.orange }]}>{w?.duration}</Text><Text style={hist.statLbl}>min</Text></View>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.blue }]}>{Math.round(vol).toLocaleString()}</Text><Text style={hist.statLbl}>kg Vol.</Text></View>
                      <View style={hist.stat}><Text style={[hist.statVal, { color: T.green }]}>{w?.exercises?.length ?? 0}</Text><Text style={hist.statLbl}>Üb.</Text></View>
                    </>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
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
    if (!newName.trim()) { Alert.alert('Bitte Namen eingeben'); return; }
    if (newExercises.length === 0) { Alert.alert('Bitte mindestens eine Übung hinzufügen'); return; }
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
          <View><Text style={screen.eyebrow}>{editingRoutine ? 'Bearbeiten' : 'Neue Routine'}</Text><Text style={screen.title}>{newName || 'Unbenannt'}</Text></View>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={field.label}>Name</Text>
          <TextInput style={field.input} value={newName} onChangeText={setNewName} placeholder="z.B. Push Day" placeholderTextColor={T.text4} />
          <Text style={field.label}>Übungen</Text>
          {newExercises.map((ex, i) => (
            <View key={i} style={field.row}>
              <View style={[field.dot, { backgroundColor: MUSCLE_COLORS[ex.muscleGroup] }]} />
              <View style={{ flex: 1 }}><Text style={field.rowText}>{ex.name}</Text>{ex.equipment && <Text style={{ fontSize: 10, color: T.text4 }}>{ex.equipment}</Text>}</View>
              <TouchableOpacity onPress={() => setNewExercises(prev => prev.filter((_, idx) => idx !== i))}><IconClose /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={16} /><Text style={btn.outlineText}>Übung hinzufügen</Text></TouchableOpacity>
          <TouchableOpacity style={[btn.primary, { marginTop: 16 }]} onPress={saveForm}><Text style={btn.primaryText}>Speichern</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={screen.header}>
        <TouchableOpacity onPress={onBack} style={screen.backBtn}><IconChevronLeft /></TouchableOpacity>
        <View><Text style={screen.eyebrow}>Krafttraining</Text><Text style={screen.title}>Routinen</Text></View>
      </View>
      <View style={{ paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {(['mine', 'discover'] as const).map(t => (
            <TouchableOpacity key={t} style={[tabSt.btn, tab === t && tabSt.btnActive]} onPress={() => setTab(t)}>
              <Text style={[tabSt.text, tab === t && tabSt.textActive]}>{t === 'mine' ? 'Meine Routinen' : 'Entdecken'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab === 'mine' ? (
          <>
            <TouchableOpacity style={rSt.createCard} onPress={openCreate}>
              <View style={rSt.createIcon}><IconPlus size={20} /></View>
              <View style={{ flex: 1 }}><Text style={rSt.createTitle}>Neue Routine</Text><Text style={rSt.createSub}>Selbst zusammenstellen</Text></View>
              <IconChevronRight />
            </TouchableOpacity>
            {routines.length === 0 && <Text style={{ color: T.text4, textAlign: 'center', marginTop: 40 }}>Noch keine Routinen</Text>}
            {routines.map(r => (
              <View key={r.id} style={rSt.card}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectRoutine(r)}>
                  <Text style={rSt.name}>{r.name}</Text>
                  <Text style={rSt.meta}>{r.exercises.slice(0, 3).map(e => e.name).join(' · ')}{r.exercises.length > 3 ? ` +${r.exercises.length - 3}` : ''}</Text>
                  <View style={rSt.chipRow}><View style={rSt.chip}><Text style={rSt.chipText}>{r.exercises.length} Übungen</Text></View></View>
                </TouchableOpacity>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={rSt.editBtn} onPress={() => openEdit(r)}><Text style={{ fontSize: 11, color: T.blue, fontWeight: '700' }}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity style={rSt.deleteBtn} onPress={() => Alert.alert('Löschen', `"${r.name}" löschen?`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => onDeleteRoutine(r.id) }])}><IconTrash size={14} /></TouchableOpacity>
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
                <View style={rSt.chipRow}><View style={rSt.chip}><Text style={rSt.chipText}>{r.exercises.length} Übungen</Text></View></View>
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
          <View><Text style={screen.eyebrow}>Routine</Text><Text style={screen.title}>{routine.name}</Text></View>
        </View>
        <View style={{ padding: 18 }}>
          <View style={field.list}>
            {all.map((ex, i) => (
              <View key={i} style={[field.row, i < all.length - 1 && field.rowBorder]}>
                <View style={[field.dot, { backgroundColor: MUSCLE_COLORS[ex.muscleGroup] ?? T.orange }]} />
                <View style={{ flex: 1 }}><Text style={field.rowText}>{ex.name}</Text>{ex.equipment && <Text style={{ fontSize: 10, color: T.text4 }}>{ex.equipment}</Text>}</View>
                <Text style={{ fontSize: 11, color: T.text4 }}>{ex.muscleGroup}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={16} /><Text style={btn.outlineText}>Übung hinzufügen</Text></TouchableOpacity>
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
            <Text style={activeS.workoutTag}>{workout.name} · Aktiv</Text>
            <Text style={activeS.workoutTitle}>{workout.exercises[0]?.name ?? 'Training läuft'}</Text>
          </View>
          <View style={activeS.timerBadge}>
            <Text style={activeS.timerText}>{formatTime(workoutTimer.seconds)}</Text>
            <Text style={activeS.timerLabel}>Timer</Text>
          </View>
        </View>
        <View style={activeS.statsRow}>
          {[{ v: workout.exercises.length, l: 'Übungen', c: T.orange }, { v: totalSets, l: 'Sets', c: T.green }, { v: Math.round(totalVol), l: 'kg Vol.', c: T.blue }].map(s => (
            <View key={s.l} style={activeS.statBox}><Text style={[activeS.statVal, { color: s.c }]}>{s.v}</Text><Text style={activeS.statLbl}>{s.l}</Text></View>
          ))}
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[activeS.restCard, { borderLeftColor: restTimer.isRunning ? T.orange : T.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[activeS.restLabel, { color: restTimer.isRunning ? T.orange : T.text4 }]}>{restTimer.isRunning ? 'Pause läuft' : 'Pause starten'}</Text>
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
                  <View style={[activeS.musclePill, { backgroundColor: mc + '22' }]}><Text style={[activeS.musclePillText, { color: mc }]}>{exercise.muscleGroup}</Text></View>
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
                    <Text style={activeS.recText}>💡 4 × 8 @ {rec} kg — Tippen zum Übernehmen</Text>
                  </TouchableOpacity>
                )}
                {lastSets && <View style={activeS.lastRow}><Text style={activeS.lastLabel}>Letztes Mal: </Text><Text style={activeS.lastVal}>{lastSets.map(ls => `${ls.weight}×${ls.reps}`).join(' · ')}</Text></View>}
                {best1RM > 0 && <Text style={activeS.oneRM}>Est. 1RM: <Text style={{ color: T.orange, fontWeight: '600' }}>{best1RM} kg</Text>{pct ? `  ·  ${pct}% Max` : ''}</Text>}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <Text style={[activeS.setHdr, { width: 24 }]}>#</Text>
                  <Text style={[activeS.setHdr, { flex: 1 }]}>Wdh.</Text>
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
          <TouchableOpacity style={btn.outline} onPress={() => setShowPicker(true)}><IconPlus size={18} /><Text style={btn.outlineText}>Übung hinzufügen</Text></TouchableOpacity>
          <TouchableOpacity style={[btn.primary, { marginTop: 10, marginBottom: 20 }]} onPress={async () => { await workoutTimer.stop(); onFinish(); }}>
            <Text style={btn.primaryText}>Training abschliessen</Text>
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
    Alert.alert('Lauf abgeschlossen!', `${d.toFixed(2)} km · ${formatTime(dur)} · ${formatPace(d > 0 ? dur / d : 0)} /km`, [{ text: 'OK', onPress: onStop }]);
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg, padding: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.green, marginTop: 60, marginBottom: 20 }}>Lauf aktiv</Text>
      <Animated.View style={{ backgroundColor: T.card, borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: T.green + '30', transform: [{ scale: pulse }] }}>
        <Text style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Laufzeit</Text>
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
        <Text style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Daten</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[{ lbl: 'Distanz (km)', val: dist, set: setDist, kb: 'decimal-pad' as const, ph: '0.00' }, { lbl: 'Herzfreq.', val: hr, set: setHr, kb: 'numeric' as const, ph: 'bpm' }, { lbl: 'Kalorien', val: cal, set: setCal, kb: 'numeric' as const, ph: 'kcal' }].map(f => (
            <View key={f.lbl} style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: T.text3, marginBottom: 6 }}>{f.lbl}</Text>
              <TextInput style={{ backgroundColor: T.cardAlt, borderRadius: 10, padding: 11, color: T.text1, fontSize: 15, borderWidth: 1, borderColor: T.border }} value={f.val} onChangeText={f.set} keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={T.text4} />
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[btn.primary, { backgroundColor: T.green }]} onPress={finish}><Text style={btn.primaryText}>Lauf beenden</Text></TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Body Recovery Full Modal ─────────────────────────────────
function BodyModal({ muscles, onClose }: { muscles: MuscleMap; onClose: () => void }) {
  const { colors } = useAppTheme();
  const T = getT(colors);
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
            <Text style={screen.eyebrow}>Körper</Text>
            <Text style={screen.title}>Muskel Recovery</Text>
          </View>
          <TouchableOpacity style={screen.closeBtn} onPress={onClose}><IconClose /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['front', 'back'] as const).map(v => (
              <TouchableOpacity key={v} style={[tabSt.btn, view === v && tabSt.btnActive]} onPress={() => setView(v)}>
                <Text style={[tabSt.text, view === v && tabSt.textActive]}>{v === 'front' ? 'Vorderseite' : 'Rückseite'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 10, borderWidth: 1, borderColor: T.border }}>
              {view === 'front' ? <BodyFront muscles={muscles} /> : <BodyBack muscles={muscles} />}
            </View>
            <View style={{ gap: 8, paddingTop: 12 }}>
              {[{ c: T.green, l: 'Erholt' }, { c: T.blue, l: 'Fast' }, { c: T.yellow, l: 'Mittel' }, { c: T.orange, l: 'Niedrig' }, { c: T.red, l: 'Schonen' }].map(item => (
                <View key={item.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.c }} />
                  <Text style={{ fontSize: 12, color: T.text2 }}>{item.l}</Text>
                </View>
              ))}
            </View>
          </View>
          {warn.length > 0 && <View style={{ backgroundColor: T.redAlpha, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.redBorder }}><Text style={{ color: T.red, fontWeight: '700', marginBottom: 4 }}>Heute schonen</Text><Text style={{ color: T.red, opacity: 0.8, fontSize: 12 }}>{warn.join(', ')}</Text></View>}
          {ready.length > 0 && <View style={{ backgroundColor: T.greenAlpha, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: T.greenBorder }}><Text style={{ color: T.green, fontWeight: '700', marginBottom: 4 }}>Bereit</Text><Text style={{ color: T.green, opacity: 0.8, fontSize: 12 }}>{ready.join(', ')}</Text></View>}
          {MUSCLE_GROUPS.map(m => {
            const lvl = muscles[m]?.level ?? 100;
            const color = getMuscleRecoveryColor(lvl);
            return (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderSoft }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: T.text1, width: 100 }}>{m}</Text>
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

// ─── Main Training Screen ─────────────────────────────────────
type Screen = 'home' | 'routines' | 'routineDetail';

export default function TrainingScreen() {
  const { colors } = useAppTheme();
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
  const [showPRScreen, setShowPRScreen] = useState(false);
  const [showPREntry, setShowPREntry] = useState(false);
  const [showBodyModal, setShowBodyModal] = useState(false);
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []));

  async function loadAll() {
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const ws: Workout[] = JSON.parse(rawW);
      setWorkouts(ws);
      const lastData: Record<string, WorkoutSet[]> = {};
      [...ws].reverse().forEach(w => w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; }));
      setLastWorkoutData(lastData);
      setMuscles(calculateMuscleRecovery(ws));
    } else {
      const def: MuscleMap = {};
      MUSCLE_GROUPS.forEach(m => { def[m] = { level: 100, lastTrained: null }; });
      setMuscles(def);
    }
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
  const greeting = greetHour < 12 ? 'Guten Morgen' : greetHour < 18 ? 'Guten Tag' : 'Guten Abend';

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
    setShowNutrition(true);
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
      {/* Modals */}
      {showHistory && <HistoryScreen onClose={() => { setShowHistory(false); loadAll(); }} onDelete={() => loadAll()} />}
      
{editPR && <PREntryScreen onClose={() => setEditPR(null)} onSave={savePR} editExercise={editPR.name} editWeight={editPR.weight} editReps={editPR.reps} />}
      {showPREntry && <PREntryScreen onClose={() => setShowPREntry(false)} onSave={savePR} />}
      {showBodyModal && <BodyModal muscles={muscles} onClose={() => setShowBodyModal(false)} />}

      {/* Nutrition Modal */}
      <Modal visible={showNutrition} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View><Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: T.orange, marginBottom: 4 }}>Fertig</Text><Text style={{ fontSize: 24, fontWeight: '800', color: T.text1, letterSpacing: -0.5 }}>Ernährung 🍗</Text></View>
              <View style={{ backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: T.orangeBorder }}><Text style={{ fontSize: 14, fontWeight: '800', color: T.orange }}>⚡ {lastWorkoutScore}</Text></View>
            </View>
            {nutritionAdvice && <>
              <View style={{ backgroundColor: T.greenAlpha, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.greenBorder }}>
                <Text style={{ color: T.green, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{nutritionAdvice.immediate.timing}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.immediate.protein}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Protein</Text></View>
                  <View style={{ width: 1, backgroundColor: T.border }} />
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.immediate.carbs}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Kohlenhydrate</Text></View>
                </View>
              </View>
              <View style={{ backgroundColor: T.blueAlpha, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.blueBorder }}>
                <Text style={{ color: T.blue, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{nutritionAdvice.later.timing}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.later.protein}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Protein</Text></View>
                  <View style={{ width: 1, backgroundColor: T.border }} />
                  <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 32, fontWeight: '800', color: T.text1 }}>{nutritionAdvice.later.carbs}g</Text><Text style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>Kohlenhydrate</Text></View>
                </View>
              </View>
            </>}
            <TouchableOpacity style={[btn.primary, { marginTop: 16 }]} onPress={() => setShowNutrition(false)}><Text style={btn.primaryText}>Verstanden ✓</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* HEADER */}
          <View style={{ paddingTop: 62, paddingHorizontal: 24, paddingBottom: 0 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase', color: T.orange, marginBottom: 8 }}>Training</Text>
            <Text style={{ fontSize: 36, fontWeight: '800', color: T.text1, letterSpacing: -1, lineHeight: 36 }}>{greeting}</Text>
            <Text style={{ fontSize: 14, color: T.text3, marginTop: 6, fontWeight: '400' }}>
              {DAY_LABELS[todayIdx]}tag · {lastGym ? `Letztes Training vor ${daysSince(lastGym.date)} Tagen` : 'Starte dein erstes Training'}
            </Text>
          </View>

          {/* WEEK BAR */}
          <View style={{ margin: 20, marginBottom: 0, backgroundColor: T.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4 }}>Diese Woche</Text>
              <View style={{ backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 3, borderWidth: 1, borderColor: T.orangeBorder }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.orange }}>{weekDays.filter(Boolean).length} Trainings</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {DAY_LABELS.map((lbl, idx) => {
                const done = weekDays[idx], isNow = idx === todayIdx;
                return (
                  <View key={lbl} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <View style={[{ width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, done ? { backgroundColor: T.orange } : isNow ? { borderWidth: 2, borderColor: T.orange } : { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.border }]}>
                      {done ? <IconCheck /> : isNow ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.orange }} /> : null}
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: isNow ? T.orange : T.text4 }}>{lbl}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* HERO */}
          {(() => {
            const REQUIRED_MUSCLE_GROUPS = ['Brust', 'Rücken', 'Beine', 'Arme'];
const missingPRMuscles = REQUIRED_MUSCLE_GROUPS.filter(mg => {
  const exsInGroup = EXERCISE_DB.filter(e => e.muscleGroup === mg);
  const prsInGroup = exsInGroup.filter(ex => (prHistory[ex.name]?.length ?? 0) >= 2);
  return prsInGroup.length < 2;
});
const hasEnoughPRs = lastGym && missingPRMuscles.length === 0;
            return (
              <View style={{ margin: 16, backgroundColor: T.card, borderRadius: 28, borderWidth: 1, borderColor: hasEnoughPRs ? T.orangeBorder : T.border, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: hasEnoughPRs ? 'rgba(232,87,42,0.07)' : 'rgba(255,255,255,0.02)' }} />
                <View style={{ padding: 22, paddingBottom: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasEnoughPRs ? T.orange : T.text4 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: hasEnoughPRs ? T.text3 : T.text4 }}>
                      {hasEnoughPRs ? 'Heute empfohlen' : 'Kein Empfehlungstraining'}
                    </Text>
                    {!hasEnoughPRs && (
                      <TouchableOpacity
                        onPress={() => Alert.alert(
                          'Warum keine Empfehlung?',
                          'Du brauchst mindestens 2 PRs pro Muskelgruppe damit die App dein Gewicht und Volumen intelligent empfehlen kann.\n\nFehlend: ' + (missingPRMuscles.length > 0 ? missingPRMuscles.join(', ') : 'Kein letztes Training'),
                          [{ text: 'Verstanden' }]
                        )}
                        style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.border, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 10, color: T.text3, fontWeight: '700' }}>i</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {hasEnoughPRs ? (
                    <>
                      <Text style={{ fontSize: 30, fontWeight: '800', color: T.text1, letterSpacing: -0.8, marginBottom: 18 }}>
                        {lastGym.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                        {[
                          { v: lastGym.exercises?.length ?? 0, l: 'Übungen', ac: T.orange },
                          { v: `${lastGym.duration ?? 0}'`, l: 'Dauer', ac: T.blue },
                          { v: Math.round(lastGym.exercises?.reduce((t, ex) => t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0) ?? 0).toLocaleString(), l: 'kg Vol.', ac: T.green },
                        ].map(s => (
                          <View key={s.l} style={{ flex: 1, backgroundColor: T.cardAlt, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
                            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: s.ac, opacity: 0.5 }} />
                            <Text style={{ fontSize: 19, fontWeight: '800', color: T.text1, letterSpacing: -0.4 }}>{s.v}</Text>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: T.text4, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 3 }}>{s.l}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: T.text2, letterSpacing: -0.5, marginBottom: 10 }}>
                        Freies Training
                      </Text>
                      <View style={{ backgroundColor: T.cardAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.border }}>
                        <Text style={{ fontSize: 12, color: T.text3, lineHeight: 18 }}>
                          Speichere mindestens <Text style={{ color: T.text2, fontWeight: '700' }}>2 PRs pro Muskelgruppe</Text> um personalisierte Trainingsempfehlungen zu erhalten.
                        </Text>
                        {missingPRMuscles.length > 0 && (
                          <Text style={{ fontSize: 11, color: T.text4, marginTop: 8 }}>
                            Fehlend: {missingPRMuscles.join(', ')}
                          </Text>
                        )}
                        <TouchableOpacity
                          style={{ marginTop: 12, backgroundColor: T.goldAlpha, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: T.goldBorder, alignItems: 'center' }}
                          onPress={() => setShowPREntry(true)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: T.gold }}>PR eintragen →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={{ backgroundColor: hasEnoughPRs ? T.orange : T.cardAlt, padding: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: T.border }}
                  onPress={hasEnoughPRs ? startWithLast : startFree}
                  activeOpacity={0.9}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hasEnoughPRs ? 'rgba(255,255,255,0.16)' : T.border, alignItems: 'center', justifyContent: 'center' }}>
                      <IconPlay size={16} color={hasEnoughPRs ? T.white : T.text3} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: hasEnoughPRs ? T.white : T.text2, letterSpacing: -0.3 }}>
                        {hasEnoughPRs ? 'Jetzt starten' : 'Trotzdem starten'}
                      </Text>
                      <Text style={{ fontSize: 11, color: hasEnoughPRs ? 'rgba(255,255,255,0.5)' : T.text4, marginTop: 2 }}>
                        {hasEnoughPRs
                          ? lastGym.exercises?.slice(0, 3).map(e => e.name).join(' · ')
                          : 'Freies Training ohne Empfehlung'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: hasEnoughPRs ? 'rgba(255,255,255,0.13)' : T.border, alignItems: 'center', justifyContent: 'center' }}>
                    <IconChevronRight color={hasEnoughPRs ? T.white : T.text3} size={14} />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })()}

      {/* ROUTINEN */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity onPress={() => setScreen('routines')} style={{ backgroundColor: T.card, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: T.orange }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.orange, alignItems: 'center', justifyContent: 'center' }}>
                  <IconDumbbell size={20} color={T.white} />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: T.text1, letterSpacing: -0.3 }}>Routinen</Text>
                  <Text style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{routines.length} gespeicherte Pläne</Text>
                </View>
              </View>
              <View style={{ backgroundColor: T.orangeAlpha, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: T.orangeBorder }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.orange }}>Neu →</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* PR SECTION */}
<View style={{ paddingHorizontal: 16, marginTop: 16 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4 }}>Persönliche Rekorde</Text>
    
  </View>
  <TouchableOpacity
    onPress={() => router.push('/prs' as any)}
    style={{
      backgroundColor: T.orange,
      borderRadius: 18,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    }}
    activeOpacity={0.85}
  >
    <View style={{
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <IconTrophy size={20} color={T.white} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: -0.3 }}>Persönliche Rekorde</Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{Object.keys(prHistory).length} Rekorde gespeichert</Text>
    </View>
    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
  <Text style={{ color: T.white, fontSize: 18, fontWeight: '300' }}>→</Text>
</View>
  </TouchableOpacity>
</View>

          {/* RECOVERY */}
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: T.text4 }}>Muskelregeneration</Text>
              <TouchableOpacity onPress={() => setShowBodyModal(true)}><Text style={{ fontSize: 12, color: T.orange, fontWeight: '600' }}>Details →</Text></TouchableOpacity>
            </View>
            <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.border }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(52,199,89,0.35)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: T.green }}>{readyCount}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(52,199,89,0.7)', marginTop: 3 }}>Bereit</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(232,87,42,0.15)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(232,87,42,0.35)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: T.orange }}>{warnCount}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(232,87,42,0.7)', marginTop: 3 }}>Erschöpft</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {MUSCLE_GROUPS.slice(0, 8).map(m => {
                  const lvl = muscles[m]?.level ?? 100;
                  const col = lvl >= 80 ? T.green : lvl >= 60 ? T.blue : lvl >= 40 ? T.yellow : lvl >= 20 ? T.orange : T.red;
                  return <View key={m} style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: col }} />;
                })}
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

