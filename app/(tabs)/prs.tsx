import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Dimensions, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../../constants/ThemeContext';

const SW = Dimensions.get('window').width;


const MUSCLE_GROUPS_CONFIG = [
  { name: 'Olympic Lifts', categories: ['Olympic Lifts'], image: require('../../assets/muscles/olympic.png'), color: '#F59E0B' },
  { name: 'Bizeps',              categories: ['Bizeps'],                                    image: require('../../assets/muscles/bizeps.png'),       color: '#10B981' },
  { name: 'Trizeps',             categories: ['Trizeps'],                                   image: require('../../assets/muscles/trizeps.png'),      color: '#F59E0B' },
  { name: 'Schultern',           categories: ['Schultern'],                                 image: require('../../assets/muscles/schultern.png'),    color: '#06B6D4' },
  { name: 'Rücken',              categories: ['Rücken (Breite)', 'Rücken (Dicke)', 'Rücken (Unterer)', 'Trapez'], image: require('../../assets/muscles/ruecken.png'), color: '#7C3AED' },
  { name: 'Brust',               categories: ['Brust'],                                     image: require('../../assets/muscles/brust.png'),        color: '#EC4899' },
  { name: 'Core',                categories: ['Core', 'Bauch', 'Obliques'],                 image: require('../../assets/muscles/core.png'),         color: '#F97316' },
  { name: 'Quadrizeps',          categories: ['Quadrizeps'],                                image: require('../../assets/muscles/quadrizeps.png'),   color: '#FB7185' },
  { name: 'Hamstrings',          categories: ['Hamstrings'],                                image: require('../../assets/muscles/hamstrings.png'),   color: '#A78BFA' },
  { name: 'Abduktoren & Adduktoren', categories: ['Abduktoren', 'Adduktoren'],             image: require('../../assets/muscles/abduktoren.png'),   color: '#D946EF' },
  { name: 'Gesäß',               categories: ['Gesäß'],                                    image: require('../../assets/muscles/gesaess.png'),      color: '#F472B6' },
  { name: 'Waden',               categories: ['Waden'],        
                                image: require('../../assets/muscles/waden.png'),        color: '#67E8F9' },
];

type LocalExercise = { id: string; name: string; category: string };
type PREntry = { date: string; weight: number; reps: number; estimated1RM: number };
type PRHistory = Record<string, PREntry[]>;
type WorkoutSet = { reps: string; weight: string };
type Exercise = { id: string; name: string; muscleGroup: string; sets: WorkoutSet[] };
type Workout = { id: string; date: string; exercises: Exercise[] };

const EXERCISES: LocalExercise[] = [
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
function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][d.getMonth()]}`;
}

const PERIOD_OPTIONS = ['1M', '3M', '6M', '1J', 'Max'];

function filterByPeriod(entries: PREntry[], period: string): PREntry[] {
  if (period === 'Max') return entries;
  const now = Date.now();
  const months: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '1J': 12 };
  const ms = (months[period] ?? 1) * 30 * 24 * 3600000;
  return entries.filter(e => now - new Date(e.date).getTime() < ms);
}
function ManualPRModal({ visible, exerciseName, onSave, onClose }: {
  visible: boolean;
  exerciseName: string;
  onSave: (weight: number, reps: number) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const BG = colors.bg; const CARD = colors.card; const BORDER = colors.bg < '#888888' ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,10,0.08)';
  const dark = colors.bg < '#888888';
  const TEXT1 = dark ? '#F0F0F0' : '#2A1F14';
  const TEXT2 = dark ? '#B0B0B0' : '#5A4A3A';
  const TEXT3 = dark ? '#808080' : '#B0A89E';
  const ORANGE = colors.accent; const RED = '#C0392B';
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState(1);
  function handleSave() {
    const w = parseFloat(weight);
    if (!w || w <= 0) return;
    onSave(w, reps);
    setWeight('');
    setReps(1);
  }

  function handleClose() {
    setWeight('');
    setReps(1);
    onClose();
  }

  const REP_OPTIONS = [1, 2, 3, 4, 5, 6];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={handleClose} />
        <View style={{ backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT1, marginBottom: 4 }}>PR eintragen</Text>
          <Text style={{ fontSize: 13, color: TEXT2, marginBottom: 20 }}>{exerciseName}</Text>
          <Text style={st.secLabel}>Wiederholungen</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {REP_OPTIONS.map(r => (
              <TouchableOpacity key={r} onPress={() => setReps(r)} style={{ width: (SW - 48 - 8 * 2) / 3, backgroundColor: reps === r ? ORANGE : CARD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: reps === r ? ORANGE : BORDER }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: reps === r ? '#fff' : TEXT1 }}>{r}</Text>
                <Text style={{ fontSize: 10, color: reps === r ? 'rgba(255,255,255,0.7)' : TEXT3, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{r === 1 ? 'Rep' : 'Reps'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={st.secLabel}>Gewicht (kg)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 14 }}>
            <TextInput style={{ fontSize: 52, fontWeight: '800', color: TEXT1, flex: 1, padding: 0, letterSpacing: -2 }} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={TEXT3} returnKeyType="done" onSubmitEditing={handleSave} />
            <Text style={{ fontSize: 20, color: TEXT3, fontWeight: '600' }}>kg</Text>
          </View>
          {weight !== '' && parseFloat(weight) > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: ORANGE + '15', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE, textTransform: 'uppercase', letterSpacing: 1 }}>Est. 1RM</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: ORANGE }}>{calc1RM(parseFloat(weight), reps)} kg</Text>
            </View>
          )}
          <TouchableOpacity style={{ backgroundColor: weight && parseFloat(weight) > 0 ? ORANGE : '#D0CEC8', borderRadius: 16, padding: 16, alignItems: 'center' }} onPress={handleSave} disabled={!weight || parseFloat(weight) <= 0}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={handleClose}>
            <Text style={{ fontSize: 13, color: TEXT3 }}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LineChart({ entries, color }: { entries: PREntry[]; color: string }) {
  if (entries.length < 2) return null;
  const W = SW - 48;
  const H = 180;
  const PAD = 16;
  const vals = entries.map(e => e.estimated1RM);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => ({ x: PAD + (i / (vals.length - 1)) * (W - PAD * 2), y: H - PAD - 20 - ((v - min) / range) * (H - PAD * 2 - 30) }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD} L${pts[0].x.toFixed(1)},${H - PAD} Z`;
  const last = pts[pts.length - 1];
  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map(f => (
        <Line key={f} x1={PAD} y1={H - PAD - 20 - f * (H - PAD * 2 - 30)} x2={W - PAD} y2={H - PAD - 20 - f * (H - PAD * 2 - 30)} stroke="#EEECE8" strokeWidth={1} />
      ))}
      <Path d={areaD} fill="url(#chartGrad)" />
      <Path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? color : '#fff'} stroke={color} strokeWidth={2} />)}
      <SvgText x={last.x > W - 50 ? last.x - 50 : last.x + 8} y={last.y - 8} fill={color} fontSize={11} fontWeight="700">{Math.round(vals[vals.length - 1])} kg</SvgText>
      {pts.map((p, i) => i % Math.max(1, Math.floor(pts.length / 4)) === 0 ? <SvgText key={i} x={p.x} y={H - 4} fill="#AAA" fontSize={9} textAnchor="middle">{formatDate(entries[i].date)}</SvgText> : null)}
    </Svg>
  );
}

function ExerciseDetailScreen({ exercise, prHistory, setPRHistory, onClose, muscleColor }: {
  exercise: LocalExercise;
  prHistory: PRHistory;
  setPRHistory: (h: PRHistory) => void;
  onClose: () => void;
  muscleColor: string;
}) {
  const { colors } = useAppTheme();
  const dark = colors.bg < '#888888';
  const BG = colors.bg; const CARD = colors.card; const BORDER = dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,10,0.08)';
  const TEXT1 = dark ? '#F0F0F0' : '#2A1F14';
  const TEXT2 = dark ? '#B0B0B0' : '#5A4A3A';
  const TEXT3 = dark ? '#808080' : '#B0A89E';
  const ORANGE = colors.accent; const RED = '#C0392B';
  const [period, setPeriod] = useState('6M');
  const [showManual, setShowManual] = useState(false);
  const rawEntries = prHistory[exercise.name] ?? [];
  const filtered = filterByPeriod(rawEntries, period);
  const latest = rawEntries[rawEntries.length - 1];
  const prev = rawEntries.length > 1 ? rawEntries[rawEntries.length - 2] : null;
  const delta = prev && latest ? Math.round(latest.estimated1RM - prev.estimated1RM) : null;
  const maxRM = rawEntries.length ? Math.max(...rawEntries.map(e => e.estimated1RM)) : 0;
  async function savePR(weight: number, reps: number) {
    const est = calc1RM(weight, reps);
    const newPR: PREntry = { date: new Date().toISOString(), weight, reps, estimated1RM: est };
    const updated = { ...prHistory, [exercise.name]: [...(prHistory[exercise.name] ?? []), newPR].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) };
    setPRHistory(updated);
    await AsyncStorage.setItem('prHistory', JSON.stringify(updated));
    setShowManual(false);
  }

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: BG }}>
        <ManualPRModal visible={showManual} exerciseName={exercise.name} onSave={savePR} onClose={() => setShowManual(false)} />
        <View style={{ paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: muscleColor }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>← Zurück</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{exercise.category}</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4, lineHeight: 24 }} numberOfLines={2}>{exercise.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowManual(true)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Manuell</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {rawEntries.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 16 }}>
              <Text style={{ fontSize: 16, color: TEXT2 }}>Noch keine Daten</Text>
              <TouchableOpacity onPress={() => setShowManual(true)} style={{ backgroundColor: muscleColor, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>+ Manuell eintragen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ margin: 16, backgroundColor: CARD, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: muscleColor, marginBottom: 6 }}>Estimated 1 Rep Max</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ fontSize: 80, fontWeight: '800', color: TEXT1, letterSpacing: -4, lineHeight: 88 }}>{Math.round(latest?.estimated1RM ?? 0)}</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: muscleColor, marginBottom: 14 }}>kg</Text>
                </View>
                {delta !== null && (
                  <View style={{ backgroundColor: delta >= 0 ? '#EDFAF3' : '#FEF3F3', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: delta >= 0 ? '#A8E6C0' : '#F5C0C0', marginTop: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: delta >= 0 ? '#1B8A45' : '#C0392B' }}>{delta >= 0 ? '↑' : '↓'} {delta >= 0 ? '+' : ''}{delta} kg seit letztem Mal</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: TEXT1 }}>{latest?.weight} kg</Text>
                  <Text style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Gewicht</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: TEXT1 }}>{latest?.reps} Wdh.</Text>
                  <Text style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Reps</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: muscleColor }}>{latest ? formatDate(latest.date) : '—'}</Text>
                  <Text style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>Datum</Text>
                </View>
              </View>
              <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT3 }}>Entwicklung</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {PERIOD_OPTIONS.map(p => (
                      <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ backgroundColor: period === p ? muscleColor : CARD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: period === p ? '#fff' : TEXT3 }}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {filtered.length >= 2 ? <LineChart entries={filtered} color={muscleColor} /> : <Text style={{ color: TEXT3, padding: 20, textAlign: 'center' }}>Nicht genug Daten</Text>}
              </View>
              <View style={{ marginHorizontal: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT3, marginBottom: 12 }}>Verlauf</Text>
                {[...rawEntries].reverse().map((entry, i) => {
                  const pct2 = maxRM > 0 ? entry.estimated1RM / maxRM : 0;
                  const realIndex = rawEntries.length - 1 - i;
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                      <Text style={{ fontSize: 11, color: TEXT3, width: 52, flexShrink: 0 }}>{formatDate(entry.date)}</Text>
                      <View style={{ flex: 1, height: 3, backgroundColor: CARD, borderRadius: 2 }}>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: muscleColor, width: `${Math.round(pct2 * 100)}%` as any }} />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: TEXT1, width: 52, textAlign: 'right', flexShrink: 0 }}>{Math.round(entry.estimated1RM)} kg</Text>
                      <Text style={{ fontSize: 10, color: TEXT3, width: 38, textAlign: 'right', flexShrink: 0 }}>{entry.weight}×{entry.reps}</Text>
                      <TouchableOpacity onPress={async () => {
                        const updated = { ...prHistory, [exercise.name]: rawEntries.filter((_, idx) => idx !== realIndex) };
                        if (updated[exercise.name].length === 0) delete updated[exercise.name];
                        setPRHistory(updated);
                        await AsyncStorage.setItem('prHistory', JSON.stringify(updated));
                      }} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3F3', borderWidth: 1, borderColor: '#F5C0C0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Text style={{ color: RED, fontSize: 13 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ExerciseListScreen({ muscleGroup, prHistory, setPRHistory, onSelect, onClose }: {
  muscleGroup: typeof MUSCLE_GROUPS_CONFIG[0];
  prHistory: PRHistory;
  setPRHistory: (h: PRHistory) => void;
  onSelect: (ex: LocalExercise) => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const dark = colors.bg < '#888888';
  const BG = colors.bg; const CARD = colors.card; const BORDER = dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,10,0.08)';
  const TEXT1 = dark ? '#F0F0F0' : '#2A1F14';
  const TEXT2 = dark ? '#B0B0B0' : '#5A4A3A';
  const TEXT3 = dark ? '#808080' : '#B0A89E';
  const ORANGE = colors.accent; const RED = '#C0392B';
  const [showManual, setShowManual] = useState(false);
  const [manualExercise, setManualExercise] = useState<LocalExercise | null>(null);
  const exercises = EXERCISES.filter((e: LocalExercise) => muscleGroup.categories.includes(e.category));
  const withPR = exercises.filter((e: LocalExercise) => (prHistory[e.name]?.length ?? 0) > 0)
    .sort((a: LocalExercise, b: LocalExercise) => (prHistory[b.name]?.length ?? 0) - (prHistory[a.name]?.length ?? 0));
  const without = exercises.filter((e: LocalExercise) => (prHistory[e.name]?.length ?? 0) === 0);

  async function savePR(weight: number, reps: number) {
    if (!manualExercise) return;
    const est = calc1RM(weight, reps);
    const newPR: PREntry = { date: new Date().toISOString(), weight, reps, estimated1RM: est };
    const updated = { ...prHistory, [manualExercise.name]: [...(prHistory[manualExercise.name] ?? []), newPR].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) };
    setPRHistory(updated);
    await AsyncStorage.setItem('prHistory', JSON.stringify(updated));
    setShowManual(false);
  }

  const renderRow = (ex: LocalExercise) => {
    const entries = prHistory[ex.name] ?? [];
    const latest = entries[entries.length - 1];
    return (
      <TouchableOpacity key={ex.id} onPress={() => onSelect(ex)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: CARD }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT1 }} numberOfLines={1}>{ex.name}</Text>
          {latest && <Text style={{ fontSize: 11, color: TEXT3, marginTop: 2 }}>{latest.weight} kg × {latest.reps} Wdh.</Text>}
        </View>
        {latest ? (
          <Text style={{ fontSize: 22, fontWeight: '800', color: muscleGroup.color, letterSpacing: -0.5 }}>{Math.round(latest.estimated1RM)} kg</Text>
        ) : (
          <View style={{ backgroundColor: CARD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 11, color: TEXT3 }}>Kein PR</Text>
          </View>
        )}
        <Text style={{ color: TEXT3, fontSize: 16 }}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: BG }}>
        <ManualPRModal visible={showManual} exerciseName={manualExercise?.name ?? ''} onSave={savePR} onClose={() => setShowManual(false)} />
        <View style={{ paddingTop: 58, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: muscleGroup.color }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>← Muskelgruppen</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Image source={muscleGroup.image} style={{ width: 52, height: 52 }} resizeMode="contain" />
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.6 }}>{muscleGroup.name}</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {withPR.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT3, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>Mit PRs</Text>
              {withPR.map((ex: LocalExercise) => renderRow(ex))}
            </>
          )}
          {without.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT3, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>Noch keine PRs</Text>
              {without.map((ex: LocalExercise) => renderRow(ex))}
            </>
          )}
          <TouchableOpacity onPress={() => { setManualExercise(exercises[0] ?? null); setShowManual(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: muscleGroup.color, borderStyle: 'dashed' }}>
            <Text style={{ fontSize: 20, color: muscleGroup.color }}>+</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: muscleGroup.color }}>PR manuell eintragen</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function PRsScreen() {
  const { colors } = useAppTheme();
  const dark = colors.bg < '#888888';
  const BG = colors.bg; const CARD = colors.card; const BORDER = dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,10,0.08)';
  const TEXT1 = dark ? '#F0F0F0' : '#2A1F14';
  const TEXT2 = dark ? '#B0B0B0' : '#5A4A3A';
  const TEXT3 = dark ? '#808080' : '#B0A89E';
  const ORANGE = colors.accent; const RED = '#C0392B';
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [selected, setSelected] = useState<LocalExercise | null>(null);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<typeof MUSCLE_GROUPS_CONFIG[0] | null>(null);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    await AsyncStorage.removeItem('prHistory'); // ← temporär hinzufügen
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const ws: Workout[] = JSON.parse(rawW);
      await buildPRFromWorkouts(ws, rawPR ? JSON.parse(rawPR) : {});
    }
  }

  async function buildPRFromWorkouts(ws: Workout[], existing: PRHistory) {
    const built: PRHistory = { ...existing };
    for (const w of ws) {
      for (const ex of w.exercises ?? []) {
        for (const set of ex.sets ?? []) {
          const weight = parseFloat(set.weight || '0');
          const reps = parseInt(set.reps || '0');
          if (weight > 0 && reps > 0) {
            const est = calc1RM(weight, reps);
            const existing_entries = built[ex.name] ?? [];
            const alreadyExists = existing_entries.some(
              (e: PREntry) => e.date.slice(0, 10) === w.date.slice(0, 10) && e.weight === weight && e.reps === reps
            );
            if (!alreadyExists) {
              built[ex.name] = [...existing_entries, { date: w.date, weight, reps, estimated1RM: est }]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }
          }
        }
      }
    }
    setPRHistory(built);
    await AsyncStorage.setItem('prHistory', JSON.stringify(built));
  }

  const exercisesWithPR = Object.keys(prHistory).filter(n => prHistory[n].length > 0);
  const muscleColor = selectedMuscleGroup?.color ?? ORANGE;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {selected && showDetail && selectedMuscleGroup && (
        <ExerciseDetailScreen
          exercise={selected}
          prHistory={prHistory}
          setPRHistory={setPRHistory}
          muscleColor={muscleColor}
          onClose={() => { setShowDetail(false); setSelected(null); }}
        />
      )}
      {selectedMuscleGroup && showExerciseList && (
        <ExerciseListScreen
          muscleGroup={selectedMuscleGroup}
          prHistory={prHistory}
          setPRHistory={setPRHistory}
          onSelect={ex => { setSelected(ex); setShowExerciseList(false); setShowDetail(true); }}
          onClose={() => { setShowExerciseList(false); setSelectedMuscleGroup(null); }}
        />
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: ORANGE }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>← Training</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Personal Records</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginBottom: 16 }}>Muskelgruppe</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{exercisesWithPR.length}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>Übungen</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
                {(() => {
                  const now = new Date();
                  const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                  let d = 0;
                  Object.values(prHistory).forEach((entries: PREntry[]) => {
                    const rec = entries.filter((e: PREntry) => new Date(e.date).getTime() >= ms);
                    const pre = entries.filter((e: PREntry) => new Date(e.date).getTime() < ms);
                    if (rec.length > 0 && pre.length > 0) d += rec[rec.length - 1].estimated1RM - pre[pre.length - 1].estimated1RM;
                  });
                  return d >= 0 ? `+${Math.round(d)}` : Math.round(d);
                })()} kg
              </Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>Diesen Monat</Text>
            </View>
          </View>
        </View>
        <View style={{ padding: 12, gap: 8 }}>
          {MUSCLE_GROUPS_CONFIG.map(mg => {
            const count = EXERCISES.filter((e: LocalExercise) => mg.categories.includes(e.category) && (prHistory[e.name]?.length ?? 0) > 0).length;
            const bestRM = Math.max(0, ...EXERCISES.filter((e: LocalExercise) => mg.categories.includes(e.category)).flatMap((e: LocalExercise) => prHistory[e.name] ?? []).map((e: PREntry) => e.estimated1RM));
            return (
              <TouchableOpacity key={mg.name} onPress={() => { setSelectedMuscleGroup(mg); setShowExerciseList(true); }}
                style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Image source={mg.image} style={{ width: 48, height: 48 }} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT1 }}>{mg.name}</Text>
                  <Text style={{ fontSize: 11, color: count > 0 ? mg.color : TEXT3, fontWeight: count > 0 ? '600' : '400', marginTop: 2 }}>
                    {count > 0 ? `${count} PRs gespeichert` : 'Noch keine PRs'}
                  </Text>
                </View>
                {bestRM > 0 && (
                  <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT1, letterSpacing: -0.5 }}>{Math.round(bestRM)} kg</Text>
                    <Text style={{ fontSize: 9, color: TEXT3, textTransform: 'uppercase', letterSpacing: 0.4 }}>Bester 1RM</Text>
                  </View>
                )}
                <Text style={{ color: TEXT3, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  secLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: '#B0A89E', marginBottom: 10 },
});