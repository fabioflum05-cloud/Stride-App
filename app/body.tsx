import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
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

function BodyFront({ muscles }: { muscles: MuscleMap }) {
  const c = (name: string) => getMuscleColor(muscles[name]?.level ?? 100);
  const o = (name: string) => 0.3 + ((muscles[name]?.level ?? 100) / 100) * 0.7;
  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      <Circle cx={80} cy={24} r={18} fill={theme.card} stroke={theme.border} strokeWidth={1.5} />
      <Rect x={74} y={40} width={12} height={12} rx={3} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={50} cy={62} rx={14} ry={12} fill={c('Schultern')} opacity={o('Schultern')} />
      <Ellipse cx={110} cy={62} rx={14} ry={12} fill={c('Schultern')} opacity={o('Schultern')} />
      <Ellipse cx={68} cy={76} rx={16} ry={18} fill={c('Brust')} opacity={o('Brust')} />
      <Ellipse cx={92} cy={76} rx={16} ry={18} fill={c('Brust')} opacity={o('Brust')} />
      <Rect x={64} y={95} width={32} height={40} rx={8} fill={c('Core')} opacity={o('Core')} />
      <Ellipse cx={40} cy={90} rx={9} ry={16} fill={c('Bizeps')} opacity={o('Bizeps')} />
      <Ellipse cx={120} cy={90} rx={9} ry={16} fill={c('Bizeps')} opacity={o('Bizeps')} />
      <Ellipse cx={36} cy={120} rx={7} ry={14} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={124} cy={120} rx={7} ry={14} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={34} cy={140} rx={6} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={126} cy={140} rx={6} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Path d="M60 136 Q80 142 100 136 L104 152 Q80 158 56 152 Z" fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={68} cy={190} rx={17} ry={34} fill={c('Quadrizeps')} opacity={o('Quadrizeps')} />
      <Ellipse cx={92} cy={190} rx={17} ry={34} fill={c('Quadrizeps')} opacity={o('Quadrizeps')} />
      <Ellipse cx={68} cy={228} rx={10} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={92} cy={228} rx={10} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={68} cy={264} rx={11} ry={24} fill={c('Waden')} opacity={o('Waden')} />
      <Ellipse cx={92} cy={264} rx={11} ry={24} fill={c('Waden')} opacity={o('Waden')} />
      <Ellipse cx={66} cy={308} rx={13} ry={7} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={94} cy={308} rx={13} ry={7} fill={theme.card} stroke={theme.border} strokeWidth={1} />
    </Svg>
  );
}

function BodyBack({ muscles }: { muscles: MuscleMap }) {
  const c = (name: string) => getMuscleColor(muscles[name]?.level ?? 100);
  const o = (name: string) => 0.3 + ((muscles[name]?.level ?? 100) / 100) * 0.7;
  return (
    <Svg width={160} height={320} viewBox="0 0 160 320">
      <Circle cx={80} cy={24} r={18} fill={theme.card} stroke={theme.border} strokeWidth={1.5} />
      <Rect x={74} y={40} width={12} height={12} rx={3} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={50} cy={62} rx={14} ry={12} fill={c('Schultern')} opacity={o('Schultern')} />
      <Ellipse cx={110} cy={62} rx={14} ry={12} fill={c('Schultern')} opacity={o('Schultern')} />
      <Path d="M56 52 Q80 56 104 52 L108 100 Q80 108 52 100 Z" fill={c('Rücken')} opacity={o('Rücken')} />
      <Rect x={64} y={100} width={32} height={36} rx={6} fill={c('Rücken')} opacity={o('Rücken') * 0.8} />
      <Ellipse cx={40} cy={88} rx={9} ry={16} fill={c('Trizeps')} opacity={o('Trizeps')} />
      <Ellipse cx={120} cy={88} rx={9} ry={16} fill={c('Trizeps')} opacity={o('Trizeps')} />
      <Ellipse cx={36} cy={118} rx={7} ry={14} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={124} cy={118} rx={7} ry={14} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={34} cy={138} rx={6} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={126} cy={138} rx={6} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={70} cy={148} rx={18} ry={14} fill={c('Gluteus')} opacity={o('Gluteus')} />
      <Ellipse cx={90} cy={148} rx={18} ry={14} fill={c('Gluteus')} opacity={o('Gluteus')} />
      <Ellipse cx={68} cy={192} rx={16} ry={34} fill={c('Hamstrings')} opacity={o('Hamstrings')} />
      <Ellipse cx={92} cy={192} rx={16} ry={34} fill={c('Hamstrings')} opacity={o('Hamstrings')} />
      <Ellipse cx={68} cy={228} rx={10} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={92} cy={228} rx={10} ry={8} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={68} cy={264} rx={12} ry={26} fill={c('Waden')} opacity={o('Waden')} />
      <Ellipse cx={92} cy={264} rx={12} ry={26} fill={c('Waden')} opacity={o('Waden')} />
      <Ellipse cx={66} cy={308} rx={13} ry={7} fill={theme.card} stroke={theme.border} strokeWidth={1} />
      <Ellipse cx={94} cy={308} rx={13} ry={7} fill={theme.card} stroke={theme.border} strokeWidth={1} />
    </Svg>
  );
}

export default function BodyScreen() {
  const [muscles, setMuscles] = useState<MuscleMap>({});
  const [view, setView] = useState<'front' | 'back'>('front');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(
    useCallback(() => {
      load();
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
    }, [])
  );

  async function load() {
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
        <Text style={styles.headerLabel}>Körper</Text>
        <Text style={styles.title}>Muskel{'\n'}Recovery</Text>

        <View style={styles.viewToggle}>
          {(['front', 'back'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => setView(v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {v === 'front' ? 'Vorderseite' : 'Rückseite'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bodyWrap}>
          {view === 'front' ? <BodyFront muscles={muscles} /> : <BodyBack muscles={muscles} />}
          <View style={styles.legend}>
            {[
              { color: theme.green, label: '80–100%' },
              { color: theme.blue, label: '60–79%' },
              { color: theme.orange, label: '40–59%' },
              { color: theme.pink, label: '20–39%' },
              { color: theme.red, label: '0–19%' },
            ].map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {warnings.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠ Noch nicht erholt</Text>
            <Text style={styles.warningText}>{warnings.join(', ')} – heute schonen.</Text>
          </View>
        )}

        {ready.length > 0 && (
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>✓ Bereit</Text>
            <Text style={styles.readyText}>{ready.join(', ')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Alle Muskelgruppen</Text>
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
                  {muscle.lastTrained ? hoursLeft > 0 ? `noch ${Math.round(hoursLeft)}h` : 'Erholt ✓' : 'Nie trainiert'}
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
  bodyWrap: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'flex-start', justifyContent: 'center' },
  legend: { gap: 10, paddingTop: 40, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: theme.textSecondary, fontSize: 11 },
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