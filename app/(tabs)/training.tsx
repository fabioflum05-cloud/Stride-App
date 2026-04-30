import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Set = { reps: string; weight: string; };
type Exercise = { id: string; name: string; muscleGroup: string; sets: Set[]; };
type Workout = { id: string; date: string; name: string; exercises: Exercise[]; duration: number; intensity: number; type: 'gym' | 'run'; };
type RunData = { id: string; distance: number; duration: number; pace: string; calories: number; heartRate: number; date: string; };

const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core', 'Ganzkörper'];
const MUSCLE_COLORS: Record<string, string> = {
  'Brust': '#EC4899', 'Rücken': '#7C3AED', 'Schultern': '#06B6D4', 'Bizeps': '#10B981',
  'Trizeps': '#F59E0B', 'Quadrizeps': '#FB7185', 'Hamstrings': '#A78BFA', 'Gluteus': '#F472B6',
  'Waden': '#67E8F9', 'Core': '#FB923C', 'Ganzkörper': '#E2D9F3',
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

// ─── Run Timer Screen ─────────────────────────────────────────
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
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
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
        <View style={styles.runTimerBtns}>
          <TouchableOpacity
            style={[styles.runControlBtn, isRunning ? styles.runPauseBtn : styles.runStartBtn]}
            onPress={() => setIsRunning(r => !r)}
            activeOpacity={0.8}
          >
            <Text style={[styles.runControlBtnText, isRunning ? { color: '#FB7185' } : { color: '#10B981' }]}>
              {isRunning ? '⏸  Pause' : '▶  Start'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.runStatsGrid}>
        <View style={[styles.runStatCard, { borderColor: 'rgba(16,185,129,0.3)' }]}>
          <Text style={[styles.runStatVal, { color: '#10B981' }]}>{dist.toFixed(2)}</Text>
          <Text style={styles.runStatLbl}>km</Text>
        </View>
        <View style={[styles.runStatCard, { borderColor: 'rgba(167,139,250,0.3)' }]}>
          <Text style={[styles.runStatVal, { color: '#A78BFA' }]}>{formatPace(paceSeconds)}</Text>
          <Text style={styles.runStatLbl}>/km Pace</Text>
        </View>
        <View style={[styles.runStatCard, { borderColor: 'rgba(251,146,60,0.3)' }]}>
          <Text style={[styles.runStatVal, { color: '#FB923C' }]}>{estimatedCalories}</Text>
          <Text style={styles.runStatLbl}>kcal</Text>
        </View>
        <View style={[styles.runStatCard, { borderColor: 'rgba(244,114,182,0.3)' }]}>
          <Text style={[styles.runStatVal, { color: '#F472B6' }]}>{heartRate || '--'}</Text>
          <Text style={styles.runStatLbl}>bpm</Text>
        </View>
      </View>

      <View style={styles.manualCard}>
        <Text style={styles.manualCardTitle}>Daten eingeben</Text>
        <View style={styles.manualRow}>
          <View style={styles.manualItem}>
            <Text style={styles.manualLabel}>Distanz (km)</Text>
            <TextInput style={styles.manualInput} value={manualDist} onChangeText={setManualDist}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#3D2E5C" />
          </View>
          <View style={styles.manualItem}>
            <Text style={styles.manualLabel}>Herzfrequenz</Text>
            <TextInput style={styles.manualInput} value={heartRate} onChangeText={setHeartRate}
              keyboardType="numeric" placeholder="bpm" placeholderTextColor="#3D2E5C" />
          </View>
          <View style={styles.manualItem}>
            <Text style={styles.manualLabel}>Kalorien</Text>
            <TextInput style={styles.manualInput} value={calories} onChangeText={setCalories}
              keyboardType="numeric" placeholder="kcal" placeholderTextColor="#3D2E5C" />
          </View>
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
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [customExercise, setCustomExercise] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [startTime] = useState(Date.now());
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});
  const [activeTab, setActiveTab] = useState<'gym' | 'run'>('gym');

  useFocusEffect(
    useCallback(() => {
      load();
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
    setShowTypeModal(false);
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
  const weekGymVol = weekGyms.reduce((s, w) =>
    s + w.exercises.reduce((t, ex) => t + ex.sets.reduce((ss, set) =>
      ss + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0), 0);
  const weekRunKm = weekRuns.reduce((s, r) => s + r.distance, 0);
  const avgPaceSeconds = weekRuns.length > 0
    ? weekRuns.reduce((s, r) => {
      const [m, sec] = r.pace.split(':').map(Number);
      return s + (m * 60 + (sec || 0));
    }, 0) / weekRuns.length
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#07040F' }}>

      {/* Tab Toggle während Training */}
      {isActive && (
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, activeTab === 'gym' && styles.modeBtnGymActive]}
            onPress={() => setActiveTab('gym')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, activeTab === 'gym' && { color: '#A78BFA' }]}>🏋️  Gym</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, activeTab === 'run' && styles.modeBtnRunActive]}
            onPress={() => setActiveTab('run')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnText, activeTab === 'run' && { color: '#10B981' }]}>🏃  Lauf</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lauf Screen */}
      {activeRun && activeTab === 'run' && <RunScreen onStop={stopRun} />}

      {/* Gym / Startseite */}
      {(activeTab === 'gym' || !isActive) && (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

          {!isActive && (
            <>
              <Text style={styles.headerLabel}>Training</Text>
              <Text style={styles.title}>Bereit für{'\n'}heute?</Text>

              {/* Gym Card */}
              <TouchableOpacity
                style={styles.gymCard}
                onPress={() => setShowTypeModal(true)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: 'rgba(124,58,237,0.25)' }]}>
                    <Text style={styles.cardEmoji}>🏋️</Text>
                  </View>
                  {weekGyms.length > 0 && (
                    <View style={styles.gymBadge}>
                      <Text style={styles.gymBadgeText}>{weekGyms.length}× diese Woche</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle}>Gym Training</Text>
                <Text style={styles.cardDesc}>Übungen, Sets & Gewichte loggen</Text>
                {weekGyms.length > 0 && (
                  <View style={styles.cardStats}>
                    <View style={styles.cardStat}>
                      <Text style={[styles.cardStatVal, { color: '#A78BFA' }]}>{Math.round(weekGymVol).toLocaleString()}</Text>
                      <Text style={styles.cardStatLbl}>kg Vol.</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={[styles.cardStatVal, { color: '#A78BFA' }]}>
                        {Math.round(weekGyms.reduce((s, w) => s + w.duration, 0) / weekGyms.length)} min
                      </Text>
                      <Text style={styles.cardStatLbl}>Ø Dauer</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={[styles.cardStatVal, { color: '#A78BFA' }]}>
                        {weekGyms.reduce((s, w) => s + (w.exercises?.length ?? 0), 0)}
                      </Text>
                      <Text style={styles.cardStatLbl}>Übungen</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* Run Card */}
              <TouchableOpacity
                style={styles.runCard}
                onPress={() => setShowTypeModal(true)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: 'rgba(16,185,129,0.22)' }]}>
                    <Text style={styles.cardEmoji}>🏃</Text>
                  </View>
                  {weekRuns.length > 0 && (
                    <View style={styles.runBadge}>
                      <Text style={styles.runBadgeText}>{weekRuns.length}× diese Woche</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardTitle, { color: '#10B981' }]}>Lauf</Text>
                <Text style={styles.cardDesc}>Distanz, Pace & Zeit tracken</Text>
                {weekRuns.length > 0 && (
                  <View style={styles.cardStats}>
                    <View style={styles.cardStat}>
                      <Text style={[styles.cardStatVal, { color: '#10B981' }]}>{weekRunKm.toFixed(1)} km</Text>
                      <Text style={styles.cardStatLbl}>Total</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={[styles.cardStatVal, { color: '#10B981' }]}>{formatPace(avgPaceSeconds)}</Text>
                      <Text style={styles.cardStatLbl}>Ø Pace</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* Quick Links */}
              <View style={styles.quickLinks}>
                <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/body' as any)} activeOpacity={0.7}>
                  <Text style={styles.quickLinkText}>💪  Körper</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/ranking' as any)} activeOpacity={0.7}>
                  <Text style={styles.quickLinkText}>🏆  Ranking</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/prs' as any)} activeOpacity={0.7}>
                  <Text style={styles.quickLinkText}>⭐  PRs</Text>
                </TouchableOpacity>
              </View>

              {/* History */}
              {(workouts.length > 0 || runs.length > 0) && (
                <>
                  <Text style={styles.sectionTitle}>Zuletzt</Text>
                  {[
                    ...workouts.filter(w => w.type !== 'run').slice(-5).map(w => ({ ...w, _type: 'gym' as const })),
                    ...runs.slice(-5).map(r => ({ ...r, _type: 'run' as const })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 6)
                    .map((item, i) => {
                      if (item._type === 'run') {
                        const r = item as RunData & { _type: 'run' };
                        return (
                          <View key={r.id ?? i} style={[styles.historyItem, { borderColor: 'rgba(16,185,129,0.15)' }]}>
                            <View style={[styles.historyDot, { backgroundColor: '#10B981' }]} />
                            <View style={styles.historyInfo}>
                              <Text style={styles.historyName}>🏃 Lauf</Text>
                              <Text style={styles.historyMeta}>
                                {r.distance.toFixed(2)} km · {formatTime(r.duration)} · {r.pace} /km
                                {r.heartRate > 0 ? ` · ♥ ${r.heartRate}` : ''}
                              </Text>
                            </View>
                            <View style={styles.historyRight}>
                              <Text style={styles.historyDate}>
                                {new Date(r.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}
                              </Text>
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
                            <View style={[styles.historyDot, { backgroundColor: '#7C3AED' }]} />
                            <View style={styles.historyInfo}>
                              <Text style={styles.historyName}>🏋️ {w.name}</Text>
                              <Text style={styles.historyMeta}>
                                {w.exercises?.length ?? 0} Übungen · {w.duration} min · Int. {w.intensity}/5
                              </Text>
                              <View style={styles.musclePills}>
                                {[...new Set(w.exercises?.map(ex => ex.muscleGroup) ?? [])].slice(0, 3).map(mg => (
                                  <View key={mg} style={[styles.musclePill, { borderColor: MUSCLE_COLORS[mg] + '50' }]}>
                                    <Text style={[styles.musclePillText, { color: MUSCLE_COLORS[mg] }]}>{mg}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                            <View style={styles.historyRight}>
                              <Text style={styles.historyDate}>
                                {new Date(w.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}
                              </Text>
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

          {/* Active Gym Workout */}
          {activeWorkout && activeTab === 'gym' && (
            <>
              <Text style={[styles.title, { marginTop: 16 }]}>{activeWorkout.name}</Text>
              <View style={styles.liveStats}>
                <View style={styles.liveStat}>
                  <Text style={[styles.liveStatVal, { color: '#A78BFA' }]}>{activeWorkout.exercises.length}</Text>
                  <Text style={styles.liveStatLbl}>Übungen</Text>
                </View>
                <View style={styles.liveStat}>
                  <Text style={[styles.liveStatVal, { color: '#67E8F9' }]}>{totalSets}</Text>
                  <Text style={styles.liveStatLbl}>Sets</Text>
                </View>
                <View style={styles.liveStat}>
                  <Text style={[styles.liveStatVal, { color: '#FB923C' }]}>{Math.round(totalVolume)}</Text>
                  <Text style={styles.liveStatLbl}>kg Vol.</Text>
                </View>
              </View>

              {activeWorkout.exercises.map(exercise => {
                const best1RM = getBest1RM(exercise.sets);
                const lastSets = lastWorkoutData[exercise.name];
                return (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={[styles.muscleBadge, { backgroundColor: MUSCLE_COLORS[exercise.muscleGroup] + '20', borderColor: MUSCLE_COLORS[exercise.muscleGroup] + '50' }]}>
                        <Text style={[styles.muscleBadgeText, { color: MUSCLE_COLORS[exercise.muscleGroup] }]}>{exercise.muscleGroup}</Text>
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
                      <View style={styles.oneRMRow}>
                        <Text style={styles.oneRMLabel}>Est. 1RM: </Text>
                        <Text style={styles.oneRMVal}>{best1RM} kg</Text>
                      </View>
                    )}
                    <View style={styles.setHeader}>
                      <Text style={styles.setHeaderText}>Set</Text>
                      <Text style={styles.setHeaderText}>Wiederholungen</Text>
                      <Text style={styles.setHeaderText}>Gewicht (kg)</Text>
                    </View>
                    {exercise.sets.map((set, si) => (
                      <View key={si} style={styles.setRow}>
                        <Text style={styles.setNumber}>{si + 1}</Text>
                        <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.reps || '0'} placeholderTextColor="#3D2E5C"
                          value={set.reps} onChangeText={v => updateSet(exercise.id, si, 'reps', v)} keyboardType="numeric" />
                        <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.weight || '0'} placeholderTextColor="#3D2E5C"
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
        </ScrollView>
      )}

      {/* Training Type Modal */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.typeModalCard}>
            <Text style={styles.typeModalTitle}>Training starten</Text>
            <Text style={styles.typeModalSub}>Was machst du heute?</Text>

            <TouchableOpacity style={styles.typeBtn} onPress={() => { setShowTypeModal(false); setShowNewWorkout(true); }} activeOpacity={0.85}>
              <View style={[styles.typeBtnIcon, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
                <Text style={styles.typeBtnEmoji}>🏋️</Text>
              </View>
              <View style={styles.typeBtnInfo}>
                <Text style={styles.typeBtnTitle}>Gym Training</Text>
                <Text style={styles.typeBtnDesc}>Übungen, Sets & Gewichte</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.typeBtn, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)' }]} onPress={startRun} activeOpacity={0.85}>
              <View style={[styles.typeBtnIcon, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                <Text style={styles.typeBtnEmoji}>🏃</Text>
              </View>
              <View style={styles.typeBtnInfo}>
                <Text style={[styles.typeBtnTitle, { color: '#10B981' }]}>Lauf</Text>
                <Text style={styles.typeBtnDesc}>Distanz, Pace & Zeit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTypeModal(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Gym Workout Modal */}
      <Modal visible={showNewWorkout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gym Training</Text>
            <Text style={styles.inputLabel}>Name (optional)</Text>
            <TextInput style={styles.input} placeholder="z.B. Oberkörper, Beine..." placeholderTextColor="#3D2E5C"
              value={workoutName} onChangeText={setWorkoutName} />
            <Text style={styles.inputLabel}>Intensität</Text>
            <View style={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} style={[styles.intensityBtn, intensity === n && styles.intensityBtnActive]} onPress={() => setIntensity(n)}>
                  <Text style={[styles.intensityBtnText, intensity === n && styles.intensityBtnTextActive]}>{n}</Text>
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
              <Text style={styles.sectionTitle}>Eigene Übung</Text>
              <TextInput style={styles.input} placeholder="Übungsname" placeholderTextColor="#3D2E5C"
                value={customExercise} onChangeText={setCustomExercise} />
              <View style={styles.chipGrid}>
                {MUSCLE_GROUPS.map(mg => (
                  <TouchableOpacity key={mg} style={[styles.chip, customMuscle === mg && styles.chipActive]} onPress={() => setCustomMuscle(mg)}>
                    <Text style={[styles.chipText, customMuscle === mg && styles.chipTextActive]}>{mg}</Text>
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
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },

  // Cards
  gymCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 22, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.35)', padding: 18, marginBottom: 12 },
  runCard: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 22, borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.3)', padding: 18, marginBottom: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  gymBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.4)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  gymBadgeText: { color: '#A78BFA', fontSize: 11, fontWeight: '500' },
  runBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.35)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  runBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '500' },
  cardTitle: { color: '#A78BFA', fontSize: 18, fontWeight: '500', marginBottom: 4 },
  cardDesc: { color: '#5B4A8A', fontSize: 12, marginBottom: 12 },
  cardStats: { flexDirection: 'row', gap: 16 },
  cardStat: { gap: 2 },
  cardStatVal: { fontSize: 16, fontWeight: '500' },
  cardStatLbl: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Quick Links
  quickLinks: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  quickLink: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 12, alignItems: 'center' },
  quickLinkText: { color: '#5B4A8A', fontSize: 12, fontWeight: '500' },

  // History
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  historyInfo: { flex: 1, gap: 3 },
  historyName: { color: '#C4B5D9', fontSize: 13, fontWeight: '500' },
  historyMeta: { color: '#5B4A8A', fontSize: 11 },
  historyRight: { alignItems: 'flex-end', gap: 8 },
  historyDate: { color: '#5B4A8A', fontSize: 11 },
  deleteIcon: { color: '#3D2E5C', fontSize: 20, fontWeight: '400' },
  musclePills: { flexDirection: 'row', gap: 4, marginTop: 4 },
  musclePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 0.5 },
  musclePillText: { fontSize: 10, fontWeight: '500' },

  // Mode Toggle
  modeToggle: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#07040F' },
  modeBtn: { flex: 1, padding: 11, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  modeBtnGymActive: { backgroundColor: 'rgba(124,58,237,0.18)', borderColor: 'rgba(124,58,237,0.4)' },
  modeBtnRunActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)' },
  modeBtnText: { color: '#3D2E5C', fontSize: 14, fontWeight: '500' },

  // Run Screen
  runTimerCard: { margin: 20, marginTop: 12, backgroundColor: 'rgba(16,185,129,0.07)', borderRadius: 28, borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.2)', padding: 32, alignItems: 'center', gap: 10 },
  runTimerLabel: { color: '#10B981', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2 },
  runTimerDisplay: { color: '#E2D9F3', fontSize: 68, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  runTimerBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  runControlBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22, borderWidth: 0.5 },
  runStartBtn: { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.4)' },
  runPauseBtn: { backgroundColor: 'rgba(251,113,133,0.12)', borderColor: 'rgba(251,113,133,0.3)' },
  runControlBtnText: { fontSize: 15, fontWeight: '500' },
  runStatsGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  runStatCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, padding: 12, alignItems: 'center' },
  runStatVal: { fontSize: 16, fontWeight: '500' },
  runStatLbl: { color: '#5B4A8A', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  manualCard: { marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 14 },
  manualCardTitle: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualItem: { flex: 1, gap: 6 },
  manualLabel: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  manualInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 10, color: '#E2D9F3', fontSize: 15, textAlign: 'center' },
  finishRunBtn: { marginHorizontal: 20, backgroundColor: '#10B981', borderRadius: 18, padding: 16, alignItems: 'center', marginBottom: 40 },
  finishRunBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Active Gym
  liveStats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  liveStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 12, alignItems: 'center' },
  liveStatVal: { fontSize: 22, fontWeight: '500' },
  liveStatLbl: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  exerciseCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5 },
  muscleBadgeText: { fontSize: 11, fontWeight: '500' },
  exerciseName: { flex: 1, color: '#E2D9F3', fontSize: 15, fontWeight: '500' },
  removeBtn: { color: '#3D2E5C', fontSize: 22 },
  lastWorkoutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8 },
  lastWorkoutLabel: { color: '#5B4A8A', fontSize: 11 },
  lastWorkoutVal: { color: '#A78BFA', fontSize: 11, fontWeight: '500' },
  oneRMRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  oneRMLabel: { color: '#5B4A8A', fontSize: 11 },
  oneRMVal: { color: '#67E8F9', fontSize: 13, fontWeight: '500' },
  setHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setHeaderText: { flex: 1, color: '#3D2E5C', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  setRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  setNumber: { color: '#5B4A8A', fontSize: 14, width: 20, textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 10, color: '#E2D9F3', fontSize: 15, textAlign: 'center' },
  addSetBtn: { padding: 8, alignItems: 'center', marginTop: 4 },
  addSetBtnText: { color: '#5B4A8A', fontSize: 13 },
  addExerciseBtn: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', padding: 16, alignItems: 'center', marginBottom: 10 },
  addExerciseBtnText: { color: '#A78BFA', fontSize: 15, fontWeight: '500' },
  finishBtn: { backgroundColor: '#7C3AED', borderRadius: 18, padding: 16, alignItems: 'center', marginBottom: 20 },
  finishBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  typeModalCard: { backgroundColor: '#0D0A1A', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 28, borderTopWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', gap: 12 },
  typeModalTitle: { color: '#E2D9F3', fontSize: 22, fontWeight: '500' },
  typeModalSub: { color: '#5B4A8A', fontSize: 13, marginTop: -6, marginBottom: 4 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)', padding: 16 },
  typeBtnIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeBtnEmoji: { fontSize: 24 },
  typeBtnInfo: { flex: 1 },
  typeBtnTitle: { color: '#A78BFA', fontSize: 16, fontWeight: '500', marginBottom: 3 },
  typeBtnDesc: { color: '#5B4A8A', fontSize: 12 },
  modalCard: { backgroundColor: '#0D0A1A', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, borderTopWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', gap: 12 },
  modalTitle: { color: '#E2D9F3', fontSize: 20, fontWeight: '500' },
  inputLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 14, color: '#E2D9F3', fontSize: 15 },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  intensityBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  intensityBtnText: { color: '#3D2E5C', fontSize: 15, fontWeight: '500' },
  intensityBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#5B4A8A', fontSize: 14 },
  presetGroup: { marginBottom: 12 },
  presetGroupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: '500' },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  presetChipText: { color: '#C4B5D9', fontSize: 13 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)' },
  chipText: { color: '#3D2E5C', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#A78BFA' },
});