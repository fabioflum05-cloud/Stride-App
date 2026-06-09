import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../constants/LanguageContext';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { theme } from '../constants/theme';
type MuscleState = { level: number; lastTrained: string | null; };
type MuscleMap = Record<string, MuscleState>;

const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core'];

const MUSCLE_RECOVERY_HOURS: Record<string, number> = {
  'Brust': 48, 'Rücken': 48, 'Schultern': 36, 'Bizeps': 36,
  'Trizeps': 36, 'Quadrizeps': 72, 'Hamstrings': 72, 'Gluteus': 48, 'Waden': 24, 'Core': 24,
};

function getMuscleColor(level: number) {
  if (level >= 80) return theme.green;
  if (level >= 60) return theme.blue;
  if (level >= 40) return theme.orange;
  if (level >= 20) return theme.pink;
  return theme.red;
}

function calculateRecovery(lastTrained: string | null, recoveryHours: number): number {
  if (!lastTrained) return 100;
  const hours = (Date.now() - new Date(lastTrained).getTime()) / 3600000;
  return Math.min(100, Math.round((hours / recoveryHours) * 100));
}

// Skin tone base
const SKIN = '#C8956C';
const SKIN_DARK = '#A8754C';
const SKIN_SHADOW = '#8B5E3C';

function muscleFill(muscles: MuscleMap, name: string): string {
  const level = muscles[name]?.level ?? 100;
  const color = getMuscleColor(level);
  return color;
}

function muscleOpacity(muscles: MuscleMap, name: string): number {
  const level = muscles[name]?.level ?? 100;
  return 0.25 + (level / 100) * 0.75;
}

// ─── Realistic Front Body ─────────────────────────────────────
function BodyFront({ muscles }: { muscles: MuscleMap }) {
  const mc = (n: string) => muscleOpacity(muscles, n);
  const mf = (n: string) => muscleFill(muscles, n);

  return (
    <Svg width={170} height={380} viewBox="0 0 170 380">
      <Defs>
        <LinearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} stopOpacity="1" />
          <Stop offset="0.5" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="1" stopColor={SKIN_DARK} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="torsoGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} stopOpacity="1" />
          <Stop offset="0.3" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="0.7" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="1" stopColor={SKIN_DARK} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* ── HEAD ── */}
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#skinGrad)" />
      {/* Jaw */}
      <Path d="M66 32 Q85 46 104 32 L102 40 Q85 52 68 40 Z" fill={SKIN_DARK} opacity={0.3} />
      {/* Ears */}
      <Ellipse cx={65} cy={26} rx={4} ry={6} fill={SKIN_DARK} />
      <Ellipse cx={105} cy={26} rx={4} ry={6} fill={SKIN_DARK} />
      {/* Hair */}
      <Path d="M65 16 Q85 4 105 16 Q100 6 85 4 Q70 4 65 16Z" fill="#3D2B1F" />

      {/* ── NECK ── */}
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#skinGrad)" />
      {/* Trapezius neck part */}
      <Path d="M68 50 Q78 46 85 48 Q92 46 102 50 L106 62 Q85 66 64 62 Z"
        fill={mf('Schultern')} opacity={mc('Schultern') * 0.5} />

      {/* ── SHOULDERS ── */}
      {/* Left deltoid */}
      <Path d="M54 56 Q44 58 38 66 Q36 76 40 86 Q46 90 54 86 Q58 80 60 70 Q62 62 54 56Z"
        fill={mf('Schultern')} opacity={mc('Schultern')} />
      {/* Right deltoid */}
      <Path d="M116 56 Q126 58 132 66 Q134 76 130 86 Q124 90 116 86 Q112 80 110 70 Q108 62 116 56Z"
        fill={mf('Schultern')} opacity={mc('Schultern')} />

      {/* ── TORSO BASE ── */}
      <Path d="M60 62 Q85 58 110 62 L114 136 Q85 144 56 136 Z" fill="url(#torsoGrad)" />

      {/* ── CHEST (Pectorals) ── */}
      {/* Left pec */}
      <Path d="M62 64 Q74 60 84 64 Q88 72 86 84 Q84 90 76 92 Q66 90 62 82 Q58 74 62 64Z"
        fill={mf('Brust')} opacity={mc('Brust')} />
      {/* Right pec */}
      <Path d="M88 64 Q98 60 108 64 Q112 74 108 82 Q104 90 94 92 Q86 90 84 84 Q82 72 88 64Z"
        fill={mf('Brust')} opacity={mc('Brust')} />
      {/* Pec dividing line */}
      <Path d="M85 62 L85 94" stroke={SKIN_SHADOW} strokeWidth={0.8} opacity={0.3} />
      {/* Chest highlight */}
      <Path d="M68 68 Q76 64 82 68" stroke="#fff" strokeWidth={0.8} opacity={0.15} fill="none" />
      <Path d="M88 68 Q96 64 104 68" stroke="#fff" strokeWidth={0.8} opacity={0.15} fill="none" />

      {/* ── CORE / ABS ── */}
      <Path d="M66 94 Q85 98 104 94 L106 136 Q85 140 64 136 Z"
        fill={mf('Core')} opacity={mc('Core') * 0.6} />
      {/* Abs grid */}
      {[0,1,2].map(row => (
        <G key={row}>
          <Rect x={70} y={96 + row*13} width={12} height={10} rx={3}
            fill={mf('Core')} opacity={mc('Core')} />
          <Rect x={87} y={96 + row*13} width={12} height={10} rx={3}
            fill={mf('Core')} opacity={mc('Core')} />
        </G>
      ))}
      {/* Linea alba */}
      <Path d="M85 94 L85 136" stroke={SKIN_SHADOW} strokeWidth={1} opacity={0.25} />

      {/* ── OBLIQUES ── */}
      <Path d="M62 98 Q58 110 60 124 Q64 130 70 128 Q68 114 66 98Z"
        fill={mf('Core')} opacity={mc('Core') * 0.7} />
      <Path d="M108 98 Q112 110 110 124 Q106 130 100 128 Q102 114 104 98Z"
        fill={mf('Core')} opacity={mc('Core') * 0.7} />

      {/* ── UPPER ARMS ── */}
      {/* Left bicep */}
      <Path d="M40 86 Q32 90 30 104 Q30 116 36 122 Q44 124 50 118 Q56 110 54 96 Q52 88 40 86Z"
        fill={mf('Bizeps')} opacity={mc('Bizeps')} />
      {/* Left bicep peak highlight */}
      <Path d="M36 98 Q34 106 36 112" stroke="#fff" strokeWidth={1} opacity={0.2} fill="none" />

      {/* Right bicep */}
      <Path d="M130 86 Q138 90 140 104 Q140 116 134 122 Q126 124 120 118 Q114 110 116 96 Q118 88 130 86Z"
        fill={mf('Bizeps')} opacity={mc('Bizeps')} />

      {/* ── FOREARMS ── */}
      <Path d="M36 122 Q28 128 26 144 Q28 156 34 158 Q42 158 46 150 Q50 140 50 128 Q46 122 36 122Z"
        fill={SKIN} />
      <Path d="M134 122 Q142 128 144 144 Q142 156 136 158 Q128 158 124 150 Q120 140 120 128 Q124 122 134 122Z"
        fill={SKIN} />

      {/* ── HANDS ── */}
      <Ellipse cx={30} cy={164} rx={7} ry={9} fill={SKIN_DARK} />
      <Ellipse cx={140} cy={164} rx={7} ry={9} fill={SKIN_DARK} />

      {/* ── HIPS / PELVIS ── */}
      <Path d="M62 134 Q85 142 108 134 L112 152 Q85 158 58 152 Z" fill={SKIN_DARK} opacity={0.5} />

      {/* ── THIGHS (Quads) ── */}
      {/* Left quad */}
      <Path d="M58 152 Q66 148 74 152 Q78 168 76 192 Q74 210 68 218 Q60 214 56 196 Q52 174 58 152Z"
        fill={mf('Quadrizeps')} opacity={mc('Quadrizeps')} />
      {/* Left quad inner */}
      <Path d="M74 152 Q82 152 84 158 Q84 180 80 198 Q76 210 68 218 Q74 210 76 192 Q78 168 74 152Z"
        fill={mf('Quadrizeps')} opacity={mc('Quadrizeps') * 0.8} />
      {/* Left quad highlight */}
      <Path d="M62 160 Q60 175 62 190" stroke="#fff" strokeWidth={1.2} opacity={0.15} fill="none" />

      {/* Right quad */}
      <Path d="M112 152 Q104 148 96 152 Q92 168 94 192 Q96 210 102 218 Q110 214 114 196 Q118 174 112 152Z"
        fill={mf('Quadrizeps')} opacity={mc('Quadrizeps')} />
      {/* Right quad inner */}
      <Path d="M96 152 Q88 152 86 158 Q86 180 90 198 Q94 210 102 218 Q96 210 94 192 Q92 168 96 152Z"
        fill={mf('Quadrizeps')} opacity={mc('Quadrizeps') * 0.8} />

      {/* ── KNEES ── */}
      <Ellipse cx={67} cy={222} rx={11} ry={9} fill={SKIN_DARK} opacity={0.6} />
      <Ellipse cx={103} cy={222} rx={11} ry={9} fill={SKIN_DARK} opacity={0.6} />

      {/* ── SHINS + CALVES ── */}
      {/* Left calf */}
      <Path d="M58 230 Q62 228 67 232 Q70 248 68 266 Q66 278 62 282 Q56 278 54 264 Q52 248 58 230Z"
        fill={mf('Waden')} opacity={mc('Waden')} />
      <Path d="M67 232 Q72 232 74 240 Q74 258 70 272 Q66 280 62 282 Q66 278 68 266 Q70 248 67 232Z"
        fill={mf('Waden')} opacity={mc('Waden') * 0.7} />

      {/* Right calf */}
      <Path d="M112 230 Q108 228 103 232 Q100 248 102 266 Q104 278 108 282 Q114 278 116 264 Q118 248 112 230Z"
        fill={mf('Waden')} opacity={mc('Waden')} />
      <Path d="M103 232 Q98 232 96 240 Q96 258 100 272 Q104 280 108 282 Q104 278 102 266 Q100 248 103 232Z"
        fill={mf('Waden')} opacity={mc('Waden') * 0.7} />

      {/* ── ANKLES + FEET ── */}
      <Rect x={56} y={282} width={22} height={10} rx={4} fill={SKIN_DARK} opacity={0.7} />
      <Rect x={92} y={282} width={22} height={10} rx={4} fill={SKIN_DARK} opacity={0.7} />
      <Ellipse cx={63} cy={296} rx={14} ry={6} fill={SKIN_SHADOW} opacity={0.6} />
      <Ellipse cx={107} cy={296} rx={14} ry={6} fill={SKIN_SHADOW} opacity={0.6} />
    </Svg>
  );
}

// ─── Realistic Back Body ──────────────────────────────────────
function BodyBack({ muscles }: { muscles: MuscleMap }) {
  const mc = (n: string) => muscleOpacity(muscles, n);
  const mf = (n: string) => muscleOpacity(muscles, n);
  const fill = (n: string) => muscleOpacity(muscles, n);

  // shortcut
  const clr = (n: string) => muscleOpacity(muscles, n);
  const col = (n: string) => getMuscleColor(muscles[n]?.level ?? 100);

  return (
    <Svg width={170} height={380} viewBox="0 0 170 380">
      <Defs>
        <LinearGradient id="skinGradB" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} stopOpacity="1" />
          <Stop offset="0.5" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="1" stopColor={SKIN_DARK} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="torsoGradB" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SKIN_DARK} stopOpacity="1" />
          <Stop offset="0.35" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="0.65" stopColor={SKIN} stopOpacity="1" />
          <Stop offset="1" stopColor={SKIN_DARK} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* ── HEAD (back) ── */}
      <Ellipse cx={85} cy={26} rx={20} ry={24} fill="url(#skinGradB)" />
      <Path d="M65 16 Q85 4 105 16 Q100 6 85 4 Q70 4 65 16Z" fill="#3D2B1F" />
      <Ellipse cx={65} cy={26} rx={4} ry={6} fill={SKIN_DARK} />
      <Ellipse cx={105} cy={26} rx={4} ry={6} fill={SKIN_DARK} />

      {/* ── NECK ── */}
      <Rect x={78} y={48} width={14} height={16} rx={4} fill="url(#skinGradB)" />

      {/* ── TRAPEZIUS ── */}
      <Path d="M64 50 Q85 44 106 50 Q114 58 112 70 Q98 66 85 68 Q72 66 58 70 Q56 58 64 50Z"
        fill={col('Schultern')} opacity={clr('Schultern')} />
      {/* Trap center line */}
      <Path d="M85 50 L85 68" stroke={SKIN_SHADOW} strokeWidth={0.8} opacity={0.3} />

      {/* ── REAR DELTS ── */}
      <Path d="M54 58 Q44 60 38 70 Q36 80 40 88 Q46 92 54 88 Q60 82 60 70 Q62 64 54 58Z"
        fill={col('Schultern')} opacity={clr('Schultern')} />
      <Path d="M116 58 Q126 60 132 70 Q134 80 130 88 Q124 92 116 88 Q110 82 110 70 Q108 64 116 58Z"
        fill={col('Schultern')} opacity={clr('Schultern')} />

      {/* ── TORSO BASE ── */}
      <Path d="M60 68 Q85 64 110 68 L112 138 Q85 146 58 138 Z" fill="url(#torsoGradB)" />

      {/* ── LATS (Latissimus) ── */}
      <Path d="M60 68 Q50 74 46 90 Q44 106 48 120 Q54 130 62 128 Q66 118 66 104 Q64 88 62 76 Q62 72 60 68Z"
        fill={col('Rücken')} opacity={clr('Rücken')} />
      <Path d="M110 68 Q120 74 124 90 Q126 106 122 120 Q116 130 108 128 Q104 118 104 104 Q106 88 108 76 Q108 72 110 68Z"
        fill={col('Rücken')} opacity={clr('Rücken')} />

      {/* ── RHOMBOIDS / MID TRAPS ── */}
      <Path d="M62 70 Q85 66 108 70 Q106 88 85 92 Q64 88 62 70Z"
        fill={col('Rücken')} opacity={clr('Rücken') * 0.9} />

      {/* ── ERECTOR SPINAE (lower back) ── */}
      <Rect x={78} y={92} width={8} height={40} rx={4} fill={col('Rücken')} opacity={clr('Rücken') * 0.6} />
      <Rect x={84} y={92} width={8} height={40} rx={4} fill={col('Rücken')} opacity={clr('Rücken') * 0.6} />
      {/* Spine line */}
      <Path d="M85 68 L85 138" stroke={SKIN_SHADOW} strokeWidth={1} opacity={0.2} />

      {/* ── TERES / INFRASPINATUS ── */}
      <Ellipse cx={68} cy={82} rx={10} ry={8} fill={col('Rücken')} opacity={clr('Rücken') * 0.7} />
      <Ellipse cx={102} cy={82} rx={10} ry={8} fill={col('Rücken')} opacity={clr('Rücken') * 0.7} />

      {/* ── TRICEPS ── */}
      <Path d="M40 88 Q32 92 30 106 Q30 118 36 124 Q44 126 50 120 Q56 112 54 98 Q52 90 40 88Z"
        fill={col('Trizeps')} opacity={clr('Trizeps')} />
      <Path d="M130 88 Q138 92 140 106 Q140 118 134 124 Q126 126 120 120 Q114 112 116 98 Q118 90 130 88Z"
        fill={col('Trizeps')} opacity={clr('Trizeps')} />
      {/* Tricep horseshoe detail */}
      <Path d="M38 100 Q36 110 38 118" stroke="#fff" strokeWidth={1} opacity={0.15} fill="none" />
      <Path d="M132 100 Q134 110 132 118" stroke="#fff" strokeWidth={1} opacity={0.15} fill="none" />

      {/* ── FOREARMS ── */}
      <Path d="M36 124 Q28 130 26 146 Q28 158 34 160 Q42 160 46 152 Q50 142 50 130 Q46 124 36 124Z" fill={SKIN} />
      <Path d="M134 124 Q142 130 144 146 Q142 158 136 160 Q128 160 124 152 Q120 142 120 130 Q124 124 134 124Z" fill={SKIN} />
      <Ellipse cx={30} cy={166} rx={7} ry={9} fill={SKIN_DARK} />
      <Ellipse cx={140} cy={166} rx={7} ry={9} fill={SKIN_DARK} />

      {/* ── GLUTES ── */}
      <Path d="M58 138 Q70 134 84 138 Q88 148 84 162 Q80 172 70 174 Q60 170 56 158 Q52 148 58 138Z"
        fill={col('Gluteus')} opacity={clr('Gluteus')} />
      <Path d="M86 138 Q100 134 112 138 Q118 148 114 158 Q110 170 100 174 Q90 172 86 162 Q82 148 86 138Z"
        fill={col('Gluteus')} opacity={clr('Gluteus')} />
      {/* Glute highlight */}
      <Path d="M64 146 Q62 155 64 163" stroke="#fff" strokeWidth={1} opacity={0.12} fill="none" />
      <Path d="M106 146 Q108 155 106 163" stroke="#fff" strokeWidth={1} opacity={0.12} fill="none" />

      {/* ── HAMSTRINGS ── */}
      <Path d="M56 172 Q62 170 70 174 Q74 190 72 214 Q70 228 64 234 Q56 228 52 210 Q48 190 56 172Z"
        fill={col('Hamstrings')} opacity={clr('Hamstrings')} />
      <Path d="M70 174 Q78 174 82 178 Q82 200 78 220 Q74 232 64 234 Q70 228 72 214 Q74 190 70 174Z"
        fill={col('Hamstrings')} opacity={clr('Hamstrings') * 0.8} />
      <Path d="M114 172 Q108 170 100 174 Q96 190 98 214 Q100 228 106 234 Q114 228 118 210 Q122 190 114 172Z"
        fill={col('Hamstrings')} opacity={clr('Hamstrings')} />
      <Path d="M100 174 Q92 174 88 178 Q88 200 92 220 Q96 232 106 234 Q100 228 98 214 Q96 190 100 174Z"
        fill={col('Hamstrings')} opacity={clr('Hamstrings') * 0.8} />

      {/* ── KNEES (back) ── */}
      <Ellipse cx={67} cy={234} rx={12} ry={9} fill={SKIN_DARK} opacity={0.5} />
      <Ellipse cx={103} cy={234} rx={12} ry={9} fill={SKIN_DARK} opacity={0.5} />

      {/* ── CALVES (back view, more prominent) ── */}
      <Path d="M56 242 Q60 240 67 244 Q72 260 70 278 Q68 290 62 294 Q54 290 52 274 Q50 258 56 242Z"
        fill={col('Waden')} opacity={clr('Waden')} />
      <Path d="M67 244 Q74 244 76 252 Q76 270 72 284 Q68 292 62 294 Q68 290 70 278 Q72 260 67 244Z"
        fill={col('Waden')} opacity={clr('Waden') * 0.75} />
      <Path d="M114 242 Q110 240 103 244 Q98 260 100 278 Q102 290 108 294 Q116 290 118 274 Q120 258 114 242Z"
        fill={col('Waden')} opacity={clr('Waden')} />
      <Path d="M103 244 Q96 244 94 252 Q94 270 98 284 Q102 292 108 294 Q102 290 100 278 Q98 260 103 244Z"
        fill={col('Waden')} opacity={clr('Waden') * 0.75} />

      {/* ── ANKLES + FEET ── */}
      <Rect x={56} y={294} width={22} height={10} rx={4} fill={SKIN_DARK} opacity={0.7} />
      <Rect x={92} y={294} width={22} height={10} rx={4} fill={SKIN_DARK} opacity={0.7} />
      <Ellipse cx={63} cy={308} rx={14} ry={6} fill={SKIN_SHADOW} opacity={0.6} />
      <Ellipse cx={107} cy={308} rx={14} ry={6} fill={SKIN_SHADOW} opacity={0.6} />
    </Svg>
  );
}

export default function BodyScreen() {
  const { t, lang } = useLanguage();
  const [muscles, setMuscles] = useState<MuscleMap>({});
  const [view, setView] = useState<'front' | 'back'>('front');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(useCallback(() => {
  load();
  fadeAnim.setValue(0);
  slideAnim.setValue(20);
  Animated.parallel([
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
  ]).start();
}, []));

  async function load() {
  // Zuerst gecachte Muscle Recovery laden (von training.tsx gesetzt)
  const rawCached = await AsyncStorage.getItem('muscleRecovery');
  if (rawCached) {
    setMuscles(JSON.parse(rawCached));
    return;
  }

  // Fallback: selbst berechnen
  const rawWorkouts = await AsyncStorage.getItem('workouts');
  if (!rawWorkouts) {
    const def: MuscleMap = {};
    MUSCLES.forEach(m => { def[m] = { level: 100, lastTrained: null }; });
    setMuscles(def);
    return;
  }
  const workouts = JSON.parse(rawWorkouts);
  const lastTrainedMap: Record<string, string> = {};
  workouts.forEach((w: any) => {
    w.exercises?.forEach((ex: any) => {
      const mg = ex.muscleGroup;
      if (!lastTrainedMap[mg] || new Date(w.date) > new Date(lastTrainedMap[mg])) {
        lastTrainedMap[mg] = w.date;
      }
    });
  });
  const newMuscles: MuscleMap = {};
  MUSCLES.forEach(m => {
    const lastTrained = lastTrainedMap[m] ?? null;
    newMuscles[m] = { level: calculateRecovery(lastTrained, MUSCLE_RECOVERY_HOURS[m]), lastTrained };
  });
  setMuscles(newMuscles);
}

  const warnings = MUSCLES.filter(m => (muscles[m]?.level ?? 100) < 40);
  const ready = MUSCLES.filter(m => (muscles[m]?.level ?? 100) >= 80);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>{t('body_title')}</Text>
        <Text style={styles.title}>{t('body_recovery')}</Text>

        <View style={styles.viewToggle}>
          {(['front', 'back'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => setView(v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {v === 'front' ? t('body_front') : t('body_back')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bodyWrap}>
          <View style={styles.figureContainer}>
            {view === 'front' ? <BodyFront muscles={muscles} /> : <BodyBack muscles={muscles} />}
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>{t('body_legend')}</Text>
            {[
              { color: theme.green, label: '80–100%', note: t('training_legend_recovered') },
              { color: theme.blue, label: '60–79%', note: t('training_legend_almost') },
              { color: theme.orange, label: '40–59%', note: t('training_legend_medium') },
              { color: theme.pink, label: '20–39%', note: t('training_legend_low') },
              { color: theme.red, label: '0–19%', note: t('training_legend_caution') },
            ].map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <View>
                  <Text style={styles.legendText}>{item.note}</Text>
                  <Text style={styles.legendSub}>{item.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {warnings.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>{t('body_warning')}</Text>
            <Text style={styles.warningText}>{warnings.join(', ')} – {t('body_warning_msg')}</Text>
          </View>
        )}

        {ready.length > 0 && (
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>{t('body_ready')}</Text>
            <Text style={styles.readyText}>{ready.join(', ')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('body_all')}</Text>
        {MUSCLES.map(m => {
          const muscle = muscles[m];
          if (!muscle) return null;
          const color = getMuscleColor(muscle.level);
          const hoursLeft = muscle.lastTrained
            ? Math.max(0, MUSCLE_RECOVERY_HOURS[m] - (Date.now() - new Date(muscle.lastTrained).getTime()) / 3600000)
            : 0;
          return (
            <View key={m} style={styles.muscleRow}>
              <View style={styles.muscleLeft}>
                <Text style={styles.muscleName}>{m}</Text>
                <Text style={styles.muscleTime}>
                  {muscle.lastTrained ? hoursLeft > 0 ? (lang === 'en' ? `${Math.round(hoursLeft)}h left` : `noch ${Math.round(hoursLeft)}h`) : t('body_recovered') : t('body_never')}
                </Text>
              </View>
              <View style={styles.muscleBarWrap}>
                <View style={[styles.muscleBar, { width: `${muscle.level}%` as any, backgroundColor: color }]} />
              </View>
              <Text style={[styles.muscleLevel, { color }]}>{muscle.level}%</Text>
            </View>
          );
        })}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },
  viewToggle: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', backgroundColor: theme.card, ...theme.shadow },
  toggleBtnActive: { backgroundColor: theme.blueLight },
  toggleText: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
  toggleTextActive: { color: theme.blue, fontWeight: '600' },
  bodyWrap: { flexDirection: 'row', gap: 12, marginBottom: 20, alignItems: 'flex-start', justifyContent: 'center' },
  figureContainer: { backgroundColor: theme.card, borderRadius: 20, padding: 10, ...theme.shadow },
  legend: { gap: 12, paddingTop: 20, justifyContent: 'center', flex: 1 },
  legendTitle: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: theme.textPrimary, fontSize: 12, fontWeight: '500' },
  legendSub: { color: theme.textSecondary, fontSize: 10 },
  warningCard: { backgroundColor: '#FFEBEE', borderRadius: 14, padding: 14, marginBottom: 10 },
  warningTitle: { color: theme.red, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  warningText: { color: theme.red, fontSize: 12, opacity: 0.8 },
  readyCard: { backgroundColor: theme.greenLight, borderRadius: 14, padding: 14, marginBottom: 20 },
  readyTitle: { color: theme.green, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  readyText: { color: theme.green, fontSize: 12, opacity: 0.8 },
  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  muscleLeft: { width: 110 },
  muscleName: { color: theme.textPrimary, fontSize: 13, fontWeight: '500' },
  muscleTime: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  muscleBarWrap: { flex: 1, height: 4, backgroundColor: theme.cardSecondary, borderRadius: 2, overflow: 'hidden' },
  muscleBar: { height: '100%', borderRadius: 2 },
  muscleLevel: { fontSize: 12, fontWeight: '500', width: 36, textAlign: 'right' },
});