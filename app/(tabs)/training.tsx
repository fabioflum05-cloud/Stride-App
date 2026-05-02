import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';

type Set = { reps: string; weight: string; };
type Exercise = { id: string; name: string; muscleGroup: string; sets: Set[]; };
type Workout = { id: string; date: string; name: string; exercises: Exercise[]; duration: number; intensity: number; type: 'gym' | 'run'; };
type RunData = { id: string; distance: number; duration: number; pace: string; calories: number; heartRate: number; date: string; };

const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core', 'Ganzkörper'];
const MUSCLE_COLORS: Record<string, string> = {
  'Brust': '#EC4899', 'Rücken': '#7C3AED', 'Schultern': '#06B6D4', 'Bizeps': '#10B981',
  'Trizeps': '#F59E0B', 'Quadrizeps': '#FB7185', 'Hamstrings': '#A78BFA', 'Gluteus': '#F472B6',
  'Waden': '#67E8F9', 'Core': '#FB923C', 'Ganzkörper': '#1A73E8',
};
const PRESET_EXERCISES = [
  { name: 'Bankdrücken', muscleGroup: 'Brust' }, { name: 'Schrägbankdrücken', muscleGroup: 'Brust' },
  { name: 'Butterfly', muscleGroup: 'Brust' }, { name: 'Klimmzüge', muscleGroup: 'Rücken' },
  { name: 'Rudern', muscleGroup: 'Rücken' }, { name: 'Kreuzheben', muscleGroup: 'Rücken' },
  { name: 'Schulterdrücken', muscleGroup: 'Schultern' }, { name: 'Seitheben', muscleGroup: 'Schultern' },
  { name: 'Curls', muscleGroup: 'Bizeps' }, { name: 'Trizepsdrücken', muscleGroup: 'Trizeps' },
  { name: 'Kniebeugen', muscleGroup: 'Quadrizeps' }, { name: 'Beinpresse', muscleGroup: 'Quadrizeps' },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' }, { name: 'Hip Thrust', muscleGroup: 'Gluteus' },
  { name: 'Plank', muscleGroup: 'Core' }, { name: 'Crunches', muscleGroup: 'Core' },
];

function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getBest1RM(sets: Set[]): number {
  return Math.max(0, ...sets.map(s => calculate1RM(parseFloat(s.weight || '0'), parseFloat(s.reps || '0'))));
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function isThisWeek(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatPace(paceSeconds: number) {
  if (!paceSeconds || !isFinite(paceSeconds) || paceSeconds <= 0) return '--:--';
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Run Screen ───────────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [manualDist, setManualDist] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const secondsRef = useRef(0);
  const intervalRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const startTimeRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function restore() {
        const raw = await AsyncStorage.getItem('activeRunTimer');
        if (raw) {
          const { startedAt, running } = JSON.parse(raw);
          if (running && startedAt) {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            secondsRef.current = elapsed;
            setSeconds(elapsed);
            setIsRunning(true);
            startTimeRef.current = startedAt;
          }
        }
      }
      restore();
      return () => { clearInterval(intervalRef.current); };
    }, [])
  );

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now() - secondsRef.current * 1000;
      AsyncStorage.setItem('activeRunTimer', JSON.stringify({ startedAt: startTimeRef.current, running: true }));
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        secondsRef.current = elapsed;
        setSeconds(elapsed);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      if (startTimeRef.current) {
        AsyncStorage.setItem('activeRunTimer', JSON.stringify({ startedAt: startTimeRef.current, running: false }));
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    if (isRunning) pulse.start();
    else pulse.stop();
    return () => pulse.stop();
  }, [isRunning]);

  const dist = parseFloat(manualDist) || 0;
  const paceSeconds = dist > 0 ? seconds / dist : 0;
  const estimatedCalories = parseInt(calories) || Math.round(seconds / 60 * 8);

  async function finishRun() {
    const runData: RunData = {
      id: Date.now().toString(),
      distance: dist,
      duration: seconds,
      pace: formatPace(dist > 0 ? seconds / dist : 0),
      calories: estimatedCalories,
      heartRate: parseInt(heartRate) || 0,
      date: new Date().toISOString(),
    };
    const raw = await AsyncStorage.getItem('runs');
    const runs = raw ? JSON.parse(raw) : [];
    runs.push(runData);
    await AsyncStorage.setItem('runs', JSON.stringify(runs));
    await AsyncStorage.removeItem('activeRunTimer');
    const rawBattery = await AsyncStorage.getItem('batteryData');
    if (rawBattery) {
      const battery = JSON.parse(rawBattery);
      const drain = Math.round(seconds / 60 * 0.8);
      await AsyncStorage.setItem('batteryData', JSON.stringify({
        ...battery,
        level: Math.max(0, battery.level - drain),
        calorieEntries: [...(battery.calorieEntries || []), {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          kcal: estimatedCalories,
          label: `Lauf ${dist.toFixed(2)} km`,
        }]
      }));
    }
    Alert.alert('Lauf abgeschlossen! 🏃', `${dist.toFixed(2)} km · ${formatTime(seconds)} · ${formatPace(dist > 0 ? seconds / dist : 0)} /km`);
    onStop();
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Lauf</Text>

      <Animated.View style={[styles.runTimerCard, isRunning && { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.runTimerLabel}>LAUFZEIT</Text>
        <Text style={styles.runTimerDisplay}>{formatTime(seconds)}</Text>
        <TouchableOpacity
          style={[styles.runControlBtn, isRunning ? styles.runPauseBtn : styles.runStartBtn]}
          onPress={() => setIsRunning(r => !r)}
          activeOpacity={0.8}
        >
          <Text style={[styles.runControlBtnText, { color: isRunning ? theme.red : theme.green }]}>
            {isRunning ? '⏸  Pause' : '▶  Start'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.runStatsGrid}>
        {[
          { val: dist.toFixed(2), lbl: 'km', color: theme.green },
          { val: formatPace(paceSeconds), lbl: '/km Pace', color: theme.blue },
          { val: String(estimatedCalories), lbl: 'kcal', color: theme.orange },
          { val: heartRate || '--', lbl: 'bpm', color: theme.pink },
        ].map(s => (
          <View key={s.lbl} style={styles.runStatCard}>
            <Text style={[styles.runStatVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.runStatLbl}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Daten eingeben</Text>
        <View style={styles.manualRow}>
          {[
            { label: 'Distanz (km)', value: manualDist, setter: setManualDist, kb: 'decimal-pad' as const, placeholder: '0.00' },
            { label: 'Herzfrequenz', value: heartRate, setter: setHeartRate, kb: 'numeric' as const, placeholder: 'bpm' },
            { label: 'Kalorien', value: calories, setter: setCalories, kb: 'numeric' as const, placeholder: 'kcal' },
          ].map(f => (
            <View key={f.label} style={styles.manualItem}>
              <Text style={styles.manualLabel}>{f.label}</Text>
              <TextInput style={styles.manualInput} value={f.value} onChangeText={f.setter}
                keyboardType={f.kb} placeholder={f.placeholder} placeholderTextColor={theme.textTertiary} />
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.finishRunBtn} onPress={finishRun} activeOpacity={0.85}>
        <Text style={styles.finishRunBtnText}>Lauf beenden ✓</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Training Screen ─────────────────────────────────────
export default function TrainingScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [customExercise, setCustomExercise] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [startTime] = useState(Date.now());
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});
  const [activeTab, setActiveTab] = useState<'gym' | 'run'>('gym');

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
    const raw = await AsyncStorage.getItem('workouts');
    if (raw) {
      const w: Workout[] = JSON.parse(raw);
      setWorkouts(w);
      const lastData: Record<string, Set[]> = {};
      [...w].reverse().forEach(workout => {
        workout.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; });
      });
      setLastWorkoutData(lastData);
    }
    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w = JSON.parse(rawActive);
      if (isToday(w.date)) {
        if (w.type === 'run') { setActiveRun(true); setActiveTab('run'); }
        else { setActiveWorkout(w); setActiveTab('gym'); }
      }
    }
    const rawRuns = await AsyncStorage.getItem('runs');
    if (rawRuns) setRuns(JSON.parse(rawRuns));
  }

  async function startRun() {
    setActiveRun(true);
    setActiveTab('run');
    await AsyncStorage.setItem('activeWorkout', JSON.stringify({
      id: Date.now().toString(), date: new Date().toISOString(),
      name: 'Lauf', exercises: [], duration: 0, intensity: 3, type: 'run'
    }));
  }

  async function stopRun() {
    setActiveRun(false);
    await AsyncStorage.removeItem('activeWorkout');
    await AsyncStorage.removeItem('activeRunTimer');
    await load();
  }

  async function startWorkout() {
    const workout: Workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      name: workoutName.trim() || 'Training', exercises: [], duration: 0, intensity, type: 'gym',
    };
    setActiveWorkout(workout);
    setShowNewWorkout(false);
    setWorkoutName('');
    setActiveTab('gym');
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(workout));
  }

  async function addExercise(name: string, muscleGroup: string) {
    if (!activeWorkout) return;
    const exercise: Exercise = { id: Date.now().toString(), name, muscleGroup, sets: [{ reps: '', weight: '' }] };
    const updated = { ...activeWorkout, exercises: [...activeWorkout.exercises, exercise] };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
    setShowExerciseModal(false);
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const newSets = [...ex.sets];
        newSets[setIndex] = { ...newSets[setIndex], [field]: value };
        return { ...ex, sets: newSets };
      })
    };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        return { ...ex, sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] };
      })
    };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout, exercises: activeWorkout.exercises.filter(ex => ex.id !== exerciseId) };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const finished = { ...activeWorkout, duration };
    const raw = await AsyncStorage.getItem('workouts');
    const history = raw ? JSON.parse(raw) : [];
    history.push(finished);
    await AsyncStorage.setItem('workouts', JSON.stringify(history));
    await AsyncStorage.removeItem('activeWorkout');
    const batteryDrain = Math.round(intensity * 5 + duration * 0.15);
    const rawBattery = await AsyncStorage.getItem('batteryData');
    if (rawBattery) {
      const battery = JSON.parse(rawBattery);
      await AsyncStorage.setItem('batteryData', JSON.stringify({
        ...battery,
        level: Math.max(0, battery.level - batteryDrain),
        calorieEntries: [...(battery.calorieEntries || []), {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          kcal: Math.round(intensity * 80 + duration * 5),
          label: finished.name,
        }]
      }));
    }
    setWorkouts(prev => [...prev, finished]);
    setActiveWorkout(null);
    Alert.alert('Training abgeschlossen! 💪', `${finished.exercises.length} Übungen · ${duration} Min`);
  }

  async function deleteWorkout(id: string) {
    Alert.alert('Training löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const updated = workouts.filter(w => w.id !== id);
          setWorkouts(updated);
          await AsyncStorage.setItem('workouts', JSON.stringify(updated));
        }
      }
    ]);
  }

  async function deleteRun(id: string) {
    Alert.alert('Lauf löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const updated = runs.filter(r => r.id !== id);
          setRuns(updated);
          await AsyncStorage.setItem('runs', JSON.stringify(updated));
        }
      }
    ]);
  }

  const isActive = activeWorkout || activeRun;
  const totalSets = activeWorkout?.exercises.reduce((s, ex) => s + ex.sets.length, 0) ?? 0;
  const totalVolume = activeWorkout?.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) => s + (parseFloat(set.reps || '0') * parseFloat(set.weight || '0')), 0), 0) ?? 0;
  const weekGyms = workouts.filter(w => isThisWeek(w.date) && w.type !== 'run');
  const weekRuns = runs.filter(r => isThisWeek(r.date));
  const weekRunKm = weekRuns.reduce((s, r) => s + r.distance, 0);
  const avgPaceSeconds = weekRuns.length > 0
    ? weekRuns.reduce((s, r) => { const [m, sec] = r.pace.split(':').map(Number); return s + (m * 60 + (sec || 0)); }, 0) / weekRuns.length
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>

      {/* Tab Toggle während Training */}
      {isActive && (
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, activeTab === 'gym' && styles.modeBtnGymActive]}
            onPress={() => setActiveTab('gym')} activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, activeTab === 'gym' && { color: theme.blue }]}>🏋️  Gym</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, activeTab === 'run' && styles.modeBtnRunActive]}
            onPress={() => setActiveTab('run')} activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, activeTab === 'run' && { color: theme.green }]}>🏃  Lauf</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeRun && activeTab === 'run' && <RunScreen onStop={stopRun} />}

      {(activeTab === 'gym' || !isActive) && (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {!isActive && (
              <>
                <Text style={styles.headerLabel}>Training</Text>
                <Text style={styles.title}>Bereit für{'\n'}heute?</Text>

                {/* Gym Card */}
                <TouchableOpacity style={styles.gymCard} onPress={() => setShowNewWorkout(true)} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon, { backgroundColor: theme.blueLight }]}>
                      <Text style={styles.cardEmoji}>🏋️</Text>
                    </View>
                    {weekGyms.length > 0 && (
                      <View style={[styles.cardBadge, { backgroundColor: theme.blueLight }]}>
                        <Text style={[styles.cardBadgeText, { color: theme.blue }]}>{weekGyms.length}× diese Woche</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle}>Gym Training</Text>
                  <Text style={styles.cardDesc}>Übungen, Sets & Gewichte loggen</Text>
                  {weekGyms.length > 0 && (
                    <View style={styles.cardStats}>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal, { color: theme.blue }]}>{Math.round(weekGyms.reduce((s, w) => s + w.exercises.reduce((t, ex) => t + ex.sets.reduce((ss, set) => ss + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0), 0)).toLocaleString()}</Text>
                        <Text style={styles.cardStatLbl}>kg Vol.</Text>
                      </View>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal, { color: theme.blue }]}>{Math.round(weekGyms.reduce((s, w) => s + w.duration, 0) / weekGyms.length)} min</Text>
                        <Text style={styles.cardStatLbl}>Ø Dauer</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Run Card */}
                <TouchableOpacity style={styles.runCard} onPress={startRun} activeOpacity={0.85}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon, { backgroundColor: theme.greenLight }]}>
                      <Text style={styles.cardEmoji}>🏃</Text>
                    </View>
                    {weekRuns.length > 0 && (
                      <View style={[styles.cardBadge, { backgroundColor: theme.greenLight }]}>
                        <Text style={[styles.cardBadgeText, { color: theme.green }]}>{weekRuns.length}× diese Woche</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.green }]}>Lauf</Text>
                  <Text style={styles.cardDesc}>Distanz, Pace & Zeit tracken</Text>
                  {weekRuns.length > 0 && (
                    <View style={styles.cardStats}>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal, { color: theme.green }]}>{weekRunKm.toFixed(1)} km</Text>
                        <Text style={styles.cardStatLbl}>Total</Text>
                      </View>
                      <View style={styles.cardStat}>
                        <Text style={[styles.cardStatVal, { color: theme.green }]}>{formatPace(avgPaceSeconds)}</Text>
                        <Text style={styles.cardStatLbl}>Ø Pace</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Quick Links – gross & schön */}
                <Text style={styles.sectionLabel}>Extras</Text>
                <View style={styles.quickLinksGrid}>
                  {[
                    { icon: '💪', label: 'Körper', sub: 'Muskel Recovery', color: theme.purple, bg: theme.purpleLight, route: '/body' },
                    { icon: '🏆', label: 'Ranking', sub: 'Dein Level', color: theme.orange, bg: theme.orangeLight, route: '/ranking' },
                    { icon: '⭐', label: 'PRs', sub: 'Bestleistungen', color: theme.blue, bg: theme.blueLight, route: '/prs' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.quickLinkCard, { borderLeftColor: item.color }]}
                      onPress={() => router.push(item.route as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.quickLinkIcon, { backgroundColor: item.bg }]}>
                        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.quickLinkLabel, { color: item.color }]}>{item.label}</Text>
                        <Text style={styles.quickLinkSub}>{item.sub}</Text>
                      </View>
                      <Text style={[styles.quickLinkArrow, { color: item.color }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* History */}
                {(workouts.length > 0 || runs.length > 0) && (
                  <>
                    <Text style={styles.sectionLabel}>Zuletzt</Text>
                    {[
                      ...workouts.filter(w => w.type !== 'run').slice(-4).map(w => ({ ...w, _type: 'gym' as const })),
                      ...runs.slice(-4).map(r => ({ ...r, _type: 'run' as const })),
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5)
                      .map((item, i) => {
                        if (item._type === 'run') {
                          const r = item as RunData & { _type: 'run' };
                          return (
                            <View key={r.id ?? i} style={styles.historyItem}>
                              <View style={[styles.historyDot, { backgroundColor: theme.green }]} />
                              <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>🏃 Lauf</Text>
                                <Text style={styles.historyMeta}>{r.distance.toFixed(2)} km · {formatTime(r.duration)} · {r.pace} /km</Text>
                              </View>
                              <View style={styles.historyRight}>
                                <Text style={styles.historyDate}>{new Date(r.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}</Text>
                                <TouchableOpacity onPress={() => deleteRun(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Text style={styles.deleteIcon}>×</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        } else {
                          const w = item as Workout & { _type: 'gym' };
                          return (
                            <View key={w.id ?? i} style={styles.historyItem}>
                              <View style={[styles.historyDot, { backgroundColor: theme.blue }]} />
                              <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>🏋️ {w.name}</Text>
                                <Text style={styles.historyMeta}>{w.exercises?.length ?? 0} Übungen · {w.duration} min</Text>
                              </View>
                              <View style={styles.historyRight}>
                                <Text style={styles.historyDate}>{new Date(w.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}</Text>
                                <TouchableOpacity onPress={() => deleteWorkout(w.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Text style={styles.deleteIcon}>×</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        }
                      })}
                  </>
                )}
                <View style={{ height: 120 }} />
              </>
            )}

            {/* Active Gym */}
            {activeWorkout && activeTab === 'gym' && (
              <>
                <Text style={[styles.title, { marginTop: 16 }]}>{activeWorkout.name}</Text>
                <View style={styles.liveStats}>
                  {[
                    { val: activeWorkout.exercises.length, lbl: 'Übungen', color: theme.blue },
                    { val: totalSets, lbl: 'Sets', color: theme.green },
                    { val: Math.round(totalVolume), lbl: 'kg Vol.', color: theme.orange },
                  ].map(s => (
                    <View key={s.lbl} style={styles.liveStat}>
                      <Text style={[styles.liveStatVal, { color: s.color }]}>{s.val}</Text>
                      <Text style={styles.liveStatLbl}>{s.lbl}</Text>
                    </View>
                  ))}
                </View>

                {activeWorkout.exercises.map(exercise => {
                  const best1RM = getBest1RM(exercise.sets);
                  const lastSets = lastWorkoutData[exercise.name];
                  const mc = MUSCLE_COLORS[exercise.muscleGroup];
                  return (
                    <View key={exercise.id} style={styles.exerciseCard}>
                      <View style={styles.exerciseHeader}>
                        <View style={[styles.muscleBadge, { backgroundColor: mc + '20' }]}>
                          <Text style={[styles.muscleBadgeText, { color: mc }]}>{exercise.muscleGroup}</Text>
                        </View>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                          <Text style={styles.removeBtn}>×</Text>
                        </TouchableOpacity>
                      </View>
                      {lastSets && (
                        <View style={styles.lastWorkoutRow}>
                          <Text style={styles.lastWorkoutLabel}>Letztes Mal: </Text>
                          <Text style={styles.lastWorkoutVal}>{lastSets.map(s => `${s.weight}kg × ${s.reps}`).join(' · ')}</Text>
                        </View>
                      )}
                      {best1RM > 0 && (
                        <Text style={styles.oneRM}>Est. 1RM: <Text style={{ color: theme.blue, fontWeight: '600' }}>{best1RM} kg</Text></Text>
                      )}
                      <View style={styles.setHeader}>
                        {['Set', 'Wdh.', 'Gewicht (kg)'].map(h => (
                          <Text key={h} style={styles.setHeaderText}>{h}</Text>
                        ))}
                      </View>
                      {exercise.sets.map((set, si) => (
                        <View key={si} style={styles.setRow}>
                          <Text style={styles.setNumber}>{si + 1}</Text>
                          <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.reps || '0'} placeholderTextColor={theme.textTertiary}
                            value={set.reps} onChangeText={v => updateSet(exercise.id, si, 'reps', v)} keyboardType="numeric" />
                          <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.weight || '0'} placeholderTextColor={theme.textTertiary}
                            value={set.weight} onChangeText={v => updateSet(exercise.id, si, 'weight', v)} keyboardType="decimal-pad" />
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise.id)}>
                        <Text style={styles.addSetBtnText}>+ Set hinzufügen</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setShowExerciseModal(true)}>
                  <Text style={styles.addExerciseBtnText}>+ Übung hinzufügen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
                  <Text style={styles.finishBtnText}>Training abschliessen ✓</Text>
                </TouchableOpacity>
                <View style={{ height: 120 }} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {/* New Gym Workout Modal */}
      <Modal visible={showNewWorkout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gym Training</Text>
            <Text style={styles.inputLabel}>Name (optional)</Text>
            <TextInput style={styles.input} placeholder="z.B. Oberkörper, Beine..." placeholderTextColor={theme.textTertiary}
              value={workoutName} onChangeText={setWorkoutName} />
            <Text style={styles.inputLabel}>Intensität</Text>
            <View style={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} style={[styles.intensityBtn, intensity === n && styles.intensityBtnActive]} onPress={() => setIntensity(n)}>
                  <Text style={[styles.intensityBtnText, intensity === n && { color: '#fff' }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={startWorkout}>
              <Text style={styles.saveBtnText}>Training starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewWorkout(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exercise Modal */}
      <Modal visible={showExerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Übung hinzufügen</Text>
              {MUSCLE_GROUPS.map(mg => (
                <View key={mg} style={styles.presetGroup}>
                  <Text style={[styles.presetGroupLabel, { color: MUSCLE_COLORS[mg] }]}>{mg}</Text>
                  <View style={styles.presetChips}>
                    {PRESET_EXERCISES.filter(e => e.muscleGroup === mg).map(ex => (
                      <TouchableOpacity key={ex.name} style={styles.presetChip} onPress={() => addExercise(ex.name, ex.muscleGroup)}>
                        <Text style={styles.presetChipText}>{ex.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              <Text style={styles.inputLabel}>Eigene Übung</Text>
              <TextInput style={styles.input} placeholder="Übungsname" placeholderTextColor={theme.textTertiary}
                value={customExercise} onChangeText={setCustomExercise} />
              <View style={styles.chipGrid}>
                {MUSCLE_GROUPS.map(mg => (
                  <TouchableOpacity key={mg} style={[styles.chip, customMuscle === mg && { backgroundColor: theme.blueLight, borderColor: theme.blue }]} onPress={() => setCustomMuscle(mg)}>
                    <Text style={[styles.chipText, customMuscle === mg && { color: theme.blue }]}>{mg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => { if (customExercise.trim()) addExercise(customExercise.trim(), customMuscle); }}>
                <Text style={styles.saveBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExerciseModal(false)}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },
  sectionLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  // Mode Toggle
  modeToggle: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.bg },
  modeBtn: { flex: 1, padding: 11, borderRadius: 12, alignItems: 'center', backgroundColor: theme.card, ...theme.shadow },
  modeBtnGymActive: { backgroundColor: theme.blueLight },
  modeBtnRunActive: { backgroundColor: theme.greenLight },
  modeBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: '500' },

  // Cards
  gymCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: theme.blue, ...theme.shadow },
  runCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: theme.green, ...theme.shadow },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  cardBadgeText: { fontSize: 11, fontWeight: '500' },
  cardTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 4 },
  cardDesc: { color: theme.textSecondary, fontSize: 12, marginBottom: 10 },
  cardStats: { flexDirection: 'row', gap: 16 },
  cardStat: { gap: 2 },
  cardStatVal: { fontSize: 16, fontWeight: '600' },
  cardStatLbl: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Quick Links
  quickLinksGrid: { gap: 8, marginBottom: 20 },
  quickLinkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 14, padding: 14, borderLeftWidth: 3, ...theme.shadow },
  quickLinkIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLinkLabel: { fontSize: 15, fontWeight: '600' },
  quickLinkSub: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  quickLinkArrow: { fontSize: 22 },

  // History
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  historyInfo: { flex: 1, gap: 3 },
  historyName: { color: theme.textPrimary, fontSize: 13, fontWeight: '600' },
  historyMeta: { color: theme.textSecondary, fontSize: 11 },
  historyRight: { alignItems: 'flex-end', gap: 8 },
  historyDate: { color: theme.textSecondary, fontSize: 11 },
  deleteIcon: { color: theme.textTertiary, fontSize: 20 },

  // Active Gym
  liveStats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  liveStat: { flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 12, alignItems: 'center', ...theme.shadow },
  liveStatVal: { fontSize: 22, fontWeight: '600' },
  liveStatLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  exerciseCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, ...theme.shadow },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  muscleBadgeText: { fontSize: 11, fontWeight: '500' },
  exerciseName: { flex: 1, color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  removeBtn: { color: theme.textTertiary, fontSize: 22 },
  lastWorkoutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: theme.cardSecondary, borderRadius: 8, padding: 8 },
  lastWorkoutLabel: { color: theme.textSecondary, fontSize: 11 },
  lastWorkoutVal: { color: theme.blue, fontSize: 11, fontWeight: '500' },
  oneRM: { color: theme.textSecondary, fontSize: 11, marginBottom: 10 },
  setHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setHeaderText: { flex: 1, color: theme.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  setRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  setNumber: { color: theme.textSecondary, fontSize: 14, width: 20, textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, color: theme.textPrimary, fontSize: 15, textAlign: 'center' },
  addSetBtn: { padding: 8, alignItems: 'center', marginTop: 4 },
  addSetBtnText: { color: theme.blue, fontSize: 13, fontWeight: '500' },
  addExerciseBtn: { backgroundColor: theme.blueLight, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  addExerciseBtnText: { color: theme.blue, fontSize: 15, fontWeight: '500' },
  finishBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20 },
  finishBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Run Screen
  runTimerCard: { margin: 20, marginTop: 12, backgroundColor: theme.card, borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, borderLeftWidth: 3, borderLeftColor: theme.green, ...theme.shadow },
  runTimerLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2 },
  runTimerDisplay: { color: theme.textPrimary, fontSize: 64, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  runControlBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 6 },
  runStartBtn: { backgroundColor: theme.greenLight },
  runPauseBtn: { backgroundColor: '#FFEBEE' },
  runControlBtnText: { fontSize: 15, fontWeight: '600' },
  runStatsGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  runStatCard: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', ...theme.shadow },
  runStatVal: { fontSize: 16, fontWeight: '600' },
  runStatLbl: { color: theme.textSecondary, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  manualCard: { marginHorizontal: 20, backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 14, ...theme.shadow },
  manualCardTitle: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualItem: { flex: 1, gap: 6 },
  manualLabel: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  manualInput: { backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, color: theme.textPrimary, fontSize: 15, textAlign: 'center' },
  finishRunBtn: { marginHorizontal: 20, backgroundColor: theme.green, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  finishRunBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardSecondary },
  intensityBtnActive: { backgroundColor: theme.blue },
  intensityBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
  presetGroup: { marginBottom: 12 },
  presetGroupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: '500' },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.cardSecondary },
  presetChipText: { color: theme.textPrimary, fontSize: 13 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary },
  chipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
});