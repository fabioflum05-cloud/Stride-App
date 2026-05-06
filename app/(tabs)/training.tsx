import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────
type Set = { reps: string; weight: string };
type Exercise = { id: string; name: string; muscleGroup: string; sets: Set[] };
type Workout = {
  id: string; date: string; name: string; exercises: Exercise[];
  duration: number; intensity: number; type: 'gym' | 'run' | 'manual' | 'judo';
  notes?: string;
};
type RunData = {
  id: string; distance: number; duration: number; pace: string;
  calories: number; heartRate: number; date: string;
};
type JudoSession = {
  id: string; date: string; totalDuration: number;
  warmupDuration: number; randoriRounds: { duration: number }[]; notes: string;
};
type ManualSession = {
  id: string; date: string; name: string; duration: number;
  intensity: number; notes: string; type: string;
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
  'Brust','Rücken','Schultern','Bizeps','Trizeps',
  'Quadrizeps','Hamstrings','Gluteus','Waden','Core','Ganzkörper',
];
const MUSCLE_COLORS: Record<string, string> = {
  Brust: '#EC4899', Rücken: '#7C3AED', Schultern: '#06B6D4',
  Bizeps: '#10B981', Trizeps: '#F59E0B', Quadrizeps: '#FB7185',
  Hamstrings: '#A78BFA', Gluteus: '#F472B6', Waden: '#67E8F9',
  Core: '#FB923C', Ganzkörper: '#1A73E8',
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
  { name: 'Schulterdrücken (Maschine)', muscleGroup: 'Schultern' },
  { name: 'Curls', muscleGroup: 'Bizeps' },
  { name: 'Hammer Curls', muscleGroup: 'Bizeps' },
  { name: 'Trizepsdrücken', muscleGroup: 'Trizeps' },
  { name: 'Dips', muscleGroup: 'Trizeps' },
  { name: 'Kniebeugen', muscleGroup: 'Quadrizeps' },
  { name: 'Beinpresse', muscleGroup: 'Quadrizeps' },
  { name: 'Beinstrecker', muscleGroup: 'Quadrizeps' },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' },
  { name: 'Beinbeuger', muscleGroup: 'Hamstrings' },
  { name: 'Hip Thrust', muscleGroup: 'Gluteus' },
  { name: 'Wadenheben', muscleGroup: 'Waden' },
  { name: 'Plank', muscleGroup: 'Core' },
  { name: 'Crunches', muscleGroup: 'Core' },
];

// ─── Helpers ──────────────────────────────────────────────────
function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
function getBest1RM(sets: Set[]): number {
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
function isThisWeek(dateString: string) {
  return new Date(dateString) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
function daysSince(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}
function formatSyncDate(isoString: string | null): { text: string; isNever: boolean } {
  if (!isoString) return { text: 'Noch nie synchronisiert', isNever: true };
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2,'0');
  const month = String(d.getMonth() + 1).padStart(2,'0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2,'0');
  const mins = String(d.getMinutes()).padStart(2,'0');
  return { text: `Zuletzt: ${day}.${month}.${year}, ${hours}:${mins}`, isNever: false };
}

// ─── Persistent Timer ─────────────────────────────────────────
function usePersistentTimer(key: string) {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      const { startedAt, running, elapsed } = JSON.parse(raw);
      if (running && startedAt) {
        startTimeRef.current = startedAt;
        setSeconds(Math.floor((Date.now() - startedAt) / 1000));
        setIsRunning(true);
      } else if (elapsed) setSeconds(elapsed);
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/) && startTimeRef.current) {
        AsyncStorage.setItem(key, JSON.stringify({ startedAt: startTimeRef.current, running: true }));
      }
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        AsyncStorage.getItem(key).then(raw => {
          if (!raw) return;
          const { startedAt, running } = JSON.parse(raw);
          if (running && startedAt) setSeconds(Math.floor((Date.now() - startedAt) / 1000));
        });
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [key]);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now() - seconds * 1000;
      AsyncStorage.setItem(key, JSON.stringify({ startedAt: startTimeRef.current, running: true }));
      intervalRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      if (startTimeRef.current) {
        AsyncStorage.setItem(key, JSON.stringify({
          startedAt: startTimeRef.current, running: false,
          elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const reset = useCallback(() => {
    setSeconds(0); setIsRunning(false);
    startTimeRef.current = null;
    AsyncStorage.removeItem(key);
  }, [key]);
  const start = useCallback(() => {
    startTimeRef.current = Date.now() - seconds * 1000;
    setIsRunning(true);
  }, [seconds]);
  const pause = useCallback(() => setIsRunning(false), []);

  return { seconds, isRunning, start, pause, reset, setSeconds };
}

// ─── Rest Timer ───────────────────────────────────────────────
function useRestTimer() {
  const KEY = 'restTimerState';
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState(90);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        const remaining = Math.max(0, targetSeconds - elapsed);
        setSeconds(remaining);
        if (remaining === 0) { setIsRunning(false); startTimeRef.current = null; clearInterval(intervalRef.current); }
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, targetSeconds]);

  function startFor(secs: number) {
    setTargetSeconds(secs); setSeconds(secs);
    startTimeRef.current = Date.now(); setIsRunning(true);
  }
  function stop() { setIsRunning(false); setSeconds(0); startTimeRef.current = null; }
  const pct = targetSeconds > 0 ? Math.max(0, seconds / targetSeconds) : 0;
  return { seconds, isRunning, startFor, stop, pct };
}

// ─── History Screen ───────────────────────────────────────────
type HistoryFilter = 'alle' | 'kraft' | 'judo' | 'lauf' | 'sonstiges';

function HistoryScreen({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<HistoryFilter>('alle');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunData[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('workouts').then(r => r && setWorkouts(JSON.parse(r)));
    AsyncStorage.getItem('runs').then(r => r && setRuns(JSON.parse(r)));
  }, []);

  const FILTERS: { key: HistoryFilter; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'kraft', label: 'Kraft' },
    { key: 'judo', label: 'Judo' },
    { key: 'lauf', label: 'Lauf' },
    { key: 'sonstiges', label: 'Sonstiges' },
  ];

  type HistoryItem =
    | { _kind: 'workout'; data: Workout }
    | { _kind: 'run'; data: RunData };

  const allItems: HistoryItem[] = [
    ...workouts.map(w => ({ _kind: 'workout' as const, data: w })),
    ...runs.map(r => ({ _kind: 'run' as const, data: r })),
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  const filtered = allItems.filter(item => {
    if (filter === 'alle') return true;
    if (item._kind === 'run') return filter === 'lauf';
    const t = (item.data as Workout).type;
    if (filter === 'kraft') return t === 'gym';
    if (filter === 'judo') return t === 'judo';
    if (filter === 'sonstiges') return t === 'manual';
    return true;
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    if (isToday(iso)) return `Heute, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}., ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return (
    <Modal visible animationType="slide">
      <View style={[hist.root]}>
        {/* Header */}
        <View style={hist.header}>
          <View>
            <Text style={hist.headerSub}>Training</Text>
            <Text style={hist.headerTitle}>Verlauf</Text>
          </View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={hist.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={hist.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[hist.filterPill, filter === f.key && hist.filterPillActive]}
              onPress={() => setFilter(f.key)} activeOpacity={0.7}>
              <Text style={[hist.filterPillText, filter === f.key && hist.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={hist.listContent}>
          {filtered.length === 0 && (
            <View style={hist.emptyWrap}>
              <Text style={hist.emptyTitle}>Keine Trainings gefunden</Text>
              <Text style={hist.emptySub}>Starte dein erstes Training um es hier zu sehen.</Text>
            </View>
          )}
          {filtered.map((item, i) => {
            if (item._kind === 'run') {
              const r = item.data;
              return (
                <View key={r.id ?? i} style={hist.card}>
                  <View style={hist.cardTop}>
                    <View style={[hist.typePill, { backgroundColor: '#E9F8EE' }]}>
                      <Text style={[hist.typePillText, { color: '#34C759' }]}>Lauf</Text>
                    </View>
                    <Text style={hist.cardDate}>{formatDate(r.date)}</Text>
                  </View>
                  <Text style={hist.cardName}>Lauftraining</Text>
                  <View style={hist.cardStats}>
                    <View><Text style={hist.statVal}>{r.distance.toFixed(2)} km</Text><Text style={hist.statLbl}>Distanz</Text></View>
                    <View><Text style={hist.statVal}>{formatTime(r.duration)}</Text><Text style={hist.statLbl}>Zeit</Text></View>
                    <View><Text style={hist.statVal}>{r.pace} /km</Text><Text style={hist.statLbl}>Pace</Text></View>
                    {r.heartRate > 0 && <View><Text style={hist.statVal}>{r.heartRate} bpm</Text><Text style={hist.statLbl}>HR</Text></View>}
                  </View>
                </View>
              );
            }
            const w = item.data as Workout;
            const totalVolume = w.exercises?.reduce((t, ex) =>
              t + ex.sets.reduce((s, set) => s + parseFloat(set.reps||'0') * parseFloat(set.weight||'0'), 0), 0) ?? 0;
            const totalSets = w.exercises?.reduce((s, ex) => s + ex.sets.length, 0) ?? 0;

            const typeConfig: Record<string, { bg: string; color: string; label: string }> = {
              gym:    { bg: '#FFF0E5', color: '#FF6B00', label: 'Kraft' },
              judo:   { bg: '#EDE8FF', color: '#5E5CE6', label: 'Judo' },
              manual: { bg: '#F2F2F7', color: '#8E8E93', label: 'Sonstiges' },
            };
            const tc = typeConfig[w.type] ?? typeConfig.manual;

            return (
              <View key={w.id ?? i} style={hist.card}>
                <View style={hist.cardTop}>
                  <View style={[hist.typePill, { backgroundColor: tc.bg }]}>
                    <Text style={[hist.typePillText, { color: tc.color }]}>{tc.label}</Text>
                  </View>
                  <Text style={hist.cardDate}>{formatDate(w.date)}</Text>
                </View>
                <Text style={hist.cardName}>{w.name}</Text>
                <View style={hist.cardStats}>
                  <View><Text style={hist.statVal}>{w.duration} min</Text><Text style={hist.statLbl}>Dauer</Text></View>
                  {w.type === 'gym' && <>
                    <View><Text style={hist.statVal}>{Math.round(totalVolume).toLocaleString()} kg</Text><Text style={hist.statLbl}>Volumen</Text></View>
                    <View><Text style={hist.statVal}>{totalSets}</Text><Text style={hist.statLbl}>Sets</Text></View>
                    <View><Text style={hist.statVal}>{w.exercises?.length ?? 0}</Text><Text style={hist.statLbl}>Übungen</Text></View>
                  </>}
                  {w.type === 'judo' && <>
                    <View><Text style={hist.statVal}>{w.intensity}/5</Text><Text style={hist.statLbl}>Intensität</Text></View>
                  </>}
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Active Run Screen ────────────────────────────────────────
function RunScreen({ onStop }: { onStop: () => void }) {
  const timer = usePersistentTimer('activeRunTimer');
  const [manualDist, setManualDist] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [calories, setCalories] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]));
    if (timer.isRunning) p.start(); else p.stop();
    return () => p.stop();
  }, [timer.isRunning]);

  const dist = parseFloat(manualDist) || 0;
  const paceSeconds = dist > 0 ? timer.seconds / dist : 0;
  const estimatedCalories = parseInt(calories) || Math.round(timer.seconds / 60 * 8);

  async function finishRun() {
    const runData: RunData = {
      id: Date.now().toString(), distance: dist, duration: timer.seconds,
      pace: formatPace(dist > 0 ? timer.seconds / dist : 0),
      calories: estimatedCalories, heartRate: parseInt(heartRate) || 0,
      date: new Date().toISOString(),
    };
    const raw = await AsyncStorage.getItem('runs');
    const runs = raw ? JSON.parse(raw) : [];
    runs.push(runData);
    await AsyncStorage.setItem('runs', JSON.stringify(runs));
    await AsyncStorage.removeItem('activeRunTimer');
    Alert.alert('Lauf abgeschlossen!', `${dist.toFixed(2)} km · ${formatTime(timer.seconds)} · ${formatPace(dist > 0 ? timer.seconds / dist : 0)} /km`,
      [{ text: 'OK', onPress: onStop }]);
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.headerLabel}>Lauf</Text>
      <Animated.View style={[s.runTimerCard, timer.isRunning && { transform: [{ scale: pulseAnim }] }]}>
        <Text style={s.runTimerLabel}>LAUFZEIT</Text>
        <Text style={s.runTimerDisplay}>{formatTime(timer.seconds)}</Text>
        <TouchableOpacity
          style={[s.runControlBtn, timer.isRunning ? s.runPauseBtn : s.runStartBtn]}
          onPress={() => timer.isRunning ? timer.pause() : timer.start()} activeOpacity={0.8}>
          <Text style={[s.runControlBtnText, { color: timer.isRunning ? theme.red : theme.green }]}>
            {timer.isRunning ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={s.runStatsGrid}>
        {[
          { val: dist.toFixed(2), lbl: 'km', color: theme.green },
          { val: formatPace(paceSeconds), lbl: '/km Pace', color: theme.blue },
          { val: String(estimatedCalories), lbl: 'kcal', color: theme.orange },
          { val: heartRate || '--', lbl: 'bpm', color: theme.pink },
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
              <TextInput style={s.input} value={f.value} onChangeText={f.setter}
                keyboardType={f.kb} placeholder={f.ph} placeholderTextColor={theme.textTertiary} />
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

// ─── Exercise Picker Modal ────────────────────────────────────
function ExercisePicker({
  allExercises, onSelect, onClose,
}: {
  allExercises: typeof DEFAULT_EXERCISES;
  onSelect: (name: string, muscleGroup: string) => void;
  onClose: () => void;
}) {
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalOverlay}>
        <ScrollView>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Übung hinzufügen</Text>
            {MUSCLE_GROUPS.map(mg => {
              const exs = allExercises.filter(e => e.muscleGroup === mg);
              if (exs.length === 0) return null;
              return (
                <View key={mg} style={{ marginBottom: 12 }}>
                  <Text style={[s.inputLabel, { color: MUSCLE_COLORS[mg], marginBottom: 8 }]}>{mg}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {exs.map(ex => (
                      <TouchableOpacity key={ex.name}
                        style={s.presetChip}
                        onPress={() => onSelect(ex.name, ex.muscleGroup)}>
                        <Text style={s.presetChipText}>{ex.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            <Text style={[s.inputLabel, { marginBottom: 6 }]}>Eigene Übung</Text>
            <TextInput style={s.input} value={customName} onChangeText={setCustomName}
              placeholder="Name" placeholderTextColor={theme.textTertiary} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {MUSCLE_GROUPS.map(mg => (
                <TouchableOpacity key={mg}
                  style={[s.presetChip, customMuscle === mg && { backgroundColor: theme.blueLight, borderColor: theme.blue }]}
                  onPress={() => setCustomMuscle(mg)}>
                  <Text style={[s.presetChipText, customMuscle === mg && { color: theme.blue }]}>{mg}</Text>
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

// ─── PR Missing Warning ───────────────────────────────────────
function PRMissingWarning({
  exerciseName, onAddPR, onSwap, onSkip,
}: {
  exerciseName: string;
  onAddPR: () => void;
  onSwap: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={s.prWarn}>
      <Text style={s.prWarnTitle}>Kein PR für {exerciseName} gespeichert</Text>
      <Text style={s.prWarnSub}>Ohne PR kann keine Gewichtsempfehlung berechnet werden.</Text>
      <View style={s.prWarnBtns}>
        <TouchableOpacity style={s.prWarnBtn} onPress={onAddPR} activeOpacity={0.7}>
          <Text style={s.prWarnBtnText}>PR eintragen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.prWarnBtn} onPress={onSwap} activeOpacity={0.7}>
          <Text style={s.prWarnBtnText}>Übung wechseln</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.prWarnBtn, s.prWarnBtnSkip]} onPress={onSkip} activeOpacity={0.7}>
          <Text style={s.prWarnSkipText}>Trotzdem machen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Active Gym Workout ───────────────────────────────────────
function ActiveGymWorkout({
  workout, userMaxes, prHistory, lastWorkoutData,
  onUpdate, onFinish,
}: {
  workout: Workout;
  userMaxes: UserMaxes;
  prHistory: PRHistory;
  lastWorkoutData: Record<string, Set[]>;
  onUpdate: (w: Workout) => void;
  onFinish: () => void;
}) {
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [dismissedPRWarnings, setDismissedPRWarnings] = useState<Set<string>>(new Set());
  const timer = usePersistentTimer('gymWorkoutTimer');
  const restTimer = useRestTimer();
  const workoutStartRef = useRef(Date.now());
  const [allExercises, setAllExercises] = useState(DEFAULT_EXERCISES);

  useEffect(() => {
    AsyncStorage.getItem('gymWorkoutTimer').then(raw => {
      if (!raw) { timer.start(); }
    });
    AsyncStorage.getItem('workoutStartTime').then(raw => {
      if (raw) workoutStartRef.current = parseInt(raw);
      else { AsyncStorage.setItem('workoutStartTime', String(Date.now())); }
    });
    AsyncStorage.getItem('userExercises').then(r => r && setAllExercises(JSON.parse(r)));
  }, []);

  async function addExercise(name: string, muscleGroup: string) {
    const lastSets = lastWorkoutData[name];
    const sets = lastSets ? lastSets.map(() => ({ reps: '', weight: '' })) : [{ reps: '', weight: '' }];
    const updated = {
      ...workout,
      exercises: [...workout.exercises, { id: Date.now().toString(), name, muscleGroup, sets }],
    };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
    setShowExercisePicker(false);
    // Save custom exercise if new
    if (!allExercises.find(e => e.name === name)) {
      const newAll = [...allExercises, { name, muscleGroup }];
      setAllExercises(newAll);
      await AsyncStorage.setItem('userExercises', JSON.stringify(newAll));
    }
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    const updated = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const newSets = [...ex.sets];
        newSets[setIndex] = { ...newSets[setIndex], [field]: value };
        return { ...ex, sets: newSets };
      }),
    };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    const updated = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const prev = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { reps: '', weight: prev?.weight || '' }] };
      }),
    };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    const updated = { ...workout, exercises: workout.exercises.filter(ex => ex.id !== exerciseId) };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  const totalSets = workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const totalVolume = workout.exercises.reduce((t, ex) =>
    t + ex.sets.reduce((s, set) => s + parseFloat(set.reps||'0') * parseFloat(set.weight||'0'), 0), 0);

  return (
    <>
      {showExercisePicker && (
        <ExercisePicker
          allExercises={allExercises}
          onSelect={addExercise}
          onClose={() => setShowExercisePicker(false)}
        />
      )}

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.activeHeader}>
          <View>
            <Text style={s.headerLabel}>Aktives Training</Text>
            <Text style={s.title}>{workout.name}</Text>
          </View>
          <View style={s.activeTimerBadge}>
            <View style={s.activeTimerDot} />
            <Text style={s.activeTimerText}>{formatTime(timer.seconds)}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.liveStats}>
          {[
            { val: workout.exercises.length, lbl: 'Übungen', color: theme.blue },
            { val: totalSets, lbl: 'Sets', color: theme.green },
            { val: Math.round(totalVolume), lbl: 'kg Vol.', color: theme.orange },
          ].map(stat => (
            <View key={stat.lbl} style={s.liveStat}>
              <Text style={[s.liveStatVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={s.liveStatLbl}>{stat.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Rest Timer */}
        <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: restTimer.isRunning ? theme.orange : theme.cardSecondary }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.cardTitle, { color: restTimer.isRunning ? theme.orange : theme.textSecondary }]}>
              Pause{restTimer.isRunning ? ` — ${restTimer.seconds}s` : ''}
            </Text>
            {restTimer.isRunning && (
              <TouchableOpacity onPress={restTimer.stop}>
                <Text style={{ color: theme.red, fontSize: 12, fontWeight: '600' }}>Stopp</Text>
              </TouchableOpacity>
            )}
          </View>
          {restTimer.isRunning && (
            <View style={{ height: 4, backgroundColor: theme.cardSecondary, borderRadius: 2, marginTop: 8 }}>
              <View style={{
                height: 4, borderRadius: 2,
                backgroundColor: restTimer.pct > 0.3 ? theme.green : restTimer.pct > 0.1 ? theme.orange : theme.red,
                width: `${restTimer.pct * 100}%` as any,
              }} />
            </View>
          )}
          {!restTimer.isRunning && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {[60, 90, 120, 180].map(sec => (
                <TouchableOpacity key={sec} style={s.restBtn} onPress={() => restTimer.startFor(sec)}>
                  <Text style={s.restBtnText}>{sec < 60 ? `${sec}s` : `${sec / 60}min`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Exercises */}
        {workout.exercises.map(exercise => {
          const hasPR = !!(prHistory[exercise.name]?.length) || !!(userMaxes[exercise.name]);
          const isDismissed = dismissedPRWarnings.has(exercise.id);
          const best1RM = getBest1RM(exercise.sets);
          const userMax = userMaxes[exercise.name];
          const pctOfMax = userMax && best1RM > 0 ? Math.round((best1RM / userMax) * 100) : null;
          const lastSets = lastWorkoutData[exercise.name];
          const mc = MUSCLE_COLORS[exercise.muscleGroup] || '#888';

          // Training recommendation based on 1RM
          let recText: string | null = null;
          if (userMax) {
            const weight = Math.round((userMax * 0.75) / 2.5) * 2.5;
            recText = `Empfehlung: 4 × 8 Wdh. @ ${weight} kg`;
          }

          return (
            <View key={exercise.id} style={s.exerciseCard}>
              <View style={s.exerciseHeader}>
                <View style={[s.musclePill, { backgroundColor: mc + '20' }]}>
                  <Text style={[s.musclePillText, { color: mc }]}>{exercise.muscleGroup}</Text>
                </View>
                <Text style={s.exerciseName}>{exercise.name}</Text>
                <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                  <Text style={s.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* PR missing warning */}
              {!hasPR && !isDismissed && (
                <PRMissingWarning
                  exerciseName={exercise.name}
                  onAddPR={() => setDismissedPRWarnings(prev => new Set(prev).add(exercise.id))}
                  onSwap={() => { removeExercise(exercise.id); setShowExercisePicker(true); }}
                  onSkip={() => setDismissedPRWarnings(prev => new Set(prev).add(exercise.id))}
                />
              )}

              {/* Recommendation */}
              {recText && (
                <View style={s.recRow}>
                  <Text style={s.recText}>{recText}</Text>
                </View>
              )}

              {/* Last workout reference */}
              {lastSets && (
                <View style={s.lastWorkoutRow}>
                  <Text style={s.lastWorkoutLabel}>Letztes Mal: </Text>
                  <Text style={s.lastWorkoutVal}>{lastSets.map(ls => `${ls.weight}kg × ${ls.reps}`).join(' · ')}</Text>
                </View>
              )}

              {/* 1RM */}
              {best1RM > 0 && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                  <Text style={s.oneRM}>Est. 1RM: <Text style={{ color: theme.blue, fontWeight: '600' }}>{best1RM} kg</Text></Text>
                  {pctOfMax && (
                    <Text style={s.oneRM}>% vom Max: <Text style={{ color: pctOfMax >= 100 ? theme.green : pctOfMax >= 85 ? theme.orange : theme.textSecondary, fontWeight: '600' }}>{pctOfMax}%</Text></Text>
                  )}
                </View>
              )}

              {/* Set headers */}
              <View style={s.setHeader}>
                {['Set', 'Wdh.', 'Gewicht (kg)'].map(h => (
                  <Text key={h} style={s.setHeaderText}>{h}</Text>
                ))}
              </View>

              {/* Sets */}
              {exercise.sets.map((set, si) => (
                <View key={si} style={s.setRow}>
                  <Text style={s.setNumber}>{si + 1}</Text>
                  <TextInput
                    style={s.setInput}
                    placeholder={lastSets?.[si]?.reps || '0'}
                    placeholderTextColor={theme.textTertiary}
                    value={set.reps}
                    onChangeText={v => updateSet(exercise.id, si, 'reps', v)}
                    keyboardType="numeric" />
                  <TextInput
                    style={s.setInput}
                    placeholder={lastSets?.[si]?.weight || '0'}
                    placeholderTextColor={theme.textTertiary}
                    value={set.weight}
                    onChangeText={v => updateSet(exercise.id, si, 'weight', v)}
                    keyboardType="decimal-pad" />
                </View>
              ))}

              <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(exercise.id)}>
                <Text style={s.addSetBtnText}>+ Set hinzufügen</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={s.addExerciseBtn} onPress={() => setShowExercisePicker(true)}>
          <Text style={s.addExerciseBtnText}>+ Übung hinzufügen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.finishBtn} onPress={onFinish} activeOpacity={0.85}>
          <Text style={s.finishBtnText}>Training abschliessen</Text>
        </TouchableOpacity>
        <View style={{ height: 120 }} />
      </ScrollView>
    </>
  );
}

// ─── Main Training Screen ─────────────────────────────────────
export default function TrainingScreen() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [showRoutineManager, setShowRoutineManager] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutIntensity, setWorkoutIntensity] = useState(3);
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const workoutStartRef = useRef(Date.now());

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
      const lastData: Record<string, Set[]> = {};
      [...ws].reverse().forEach(w => {
        w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; });
      });
      setLastWorkoutData(lastData);
    }
    const rawActive = await AsyncStorage.getItem('activeWorkout');
    if (rawActive) {
      const w: Workout = JSON.parse(rawActive);
      if (isToday(w.date)) {
        if (w.type === 'run') setActiveRun(true);
        else setActiveWorkout(w);
      }
    }
    const rawStart = await AsyncStorage.getItem('workoutStartTime');
    if (rawStart) workoutStartRef.current = parseInt(rawStart);
    const rawMaxes = await AsyncStorage.getItem('userMaxes');
    if (rawMaxes) setUserMaxes(JSON.parse(rawMaxes));
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));
    const rawRoutines = await AsyncStorage.getItem('routines');
    if (rawRoutines) setRoutines(JSON.parse(rawRoutines));
    const rawSync = await AsyncStorage.getItem('lastSyncDate');
    setLastSyncDate(rawSync);
  }

  // Detect if krafttraining is "recommended" (no gym workout in last 3 days)
  const lastGymWorkout = workouts
    .filter(w => w.type === 'gym')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const daysSinceGym = lastGymWorkout ? daysSince(lastGymWorkout.date) : 999;
  const kraftRecommended = daysSinceGym >= 3;

  const syncInfo = formatSyncDate(lastSyncDate);

  async function handleSync() {
    // Simulate sync
    const now = new Date().toISOString();
    await AsyncStorage.setItem('lastSyncDate', now);
    setLastSyncDate(now);
    Alert.alert('Synchronisierung', 'Trainings wurden erfolgreich synchronisiert.');
  }

  async function startWorkout(fromRoutine?: Routine) {
    const w: Workout = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      name: workoutName.trim() || fromRoutine?.name || 'Training',
      exercises: fromRoutine ? fromRoutine.exercises.map(re => ({
        id: Date.now().toString() + re.name,
        name: re.name,
        muscleGroup: re.muscleGroup,
        sets: Array.from({ length: re.defaultSets }, () => ({ reps: '', weight: '' })),
      })) : [],
      duration: 0,
      intensity: workoutIntensity,
      type: 'gym',
    };
    workoutStartRef.current = Date.now();
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    await AsyncStorage.setItem('workoutStartTime', String(Date.now()));
    setActiveWorkout(w);
    setShowNewWorkout(false);
    setWorkoutName('');
  }

  async function startRun() {
    const w: Workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      name: 'Lauf', exercises: [], duration: 0, intensity: 3, type: 'run',
    };
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    setActiveRun(true);
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    const duration = Math.max(1, Math.round((Date.now() - workoutStartRef.current) / 60000));
    const finished = { ...activeWorkout, duration };

    // Update PRs
    const newPRHistory = { ...prHistory };
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best > 0) {
        const current = newPRHistory[ex.name] || [];
        const currentMax = current.length > 0 ? current[current.length - 1].estimated1RM : 0;
        if (best > currentMax) {
          const bestSet = ex.sets.reduce((b, set) =>
            calc1RM(parseFloat(set.weight||'0'), parseFloat(set.reps||'0')) >
            calc1RM(parseFloat(b.weight||'0'), parseFloat(b.reps||'0')) ? set : b, ex.sets[0]);
          newPRHistory[ex.name] = [...(newPRHistory[ex.name] || []), {
            date: new Date().toISOString(),
            weight: parseFloat(bestSet.weight || '0'),
            reps: parseFloat(bestSet.reps || '0'),
            estimated1RM: best,
          }];
        }
      }
    }
    await AsyncStorage.setItem('prHistory', JSON.stringify(newPRHistory));
    const newMaxes = { ...userMaxes };
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best > (newMaxes[ex.name] || 0)) newMaxes[ex.name] = best;
    }
    await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
    const rawWH = await AsyncStorage.getItem('workouts');
    const history = rawWH ? JSON.parse(rawWH) : [];
    history.push(finished);
    await AsyncStorage.setItem('workouts', JSON.stringify(history));
    await AsyncStorage.removeItem('activeWorkout');
    await AsyncStorage.removeItem('workoutStartTime');
    setActiveWorkout(null);
    await loadAll();
    Alert.alert('Training abgeschlossen!', `${duration} Minuten · ${finished.exercises.length} Übungen`);
  }

  async function stopSession() {
    setActiveRun(false);
    setActiveWorkout(null);
    await AsyncStorage.removeItem('activeWorkout');
    await loadAll();
  }

  // ── Render active sessions ────────────────────────────────
  if (activeRun) {
    return <RunScreen onStop={stopSession} />;
  }
  if (activeWorkout) {
    return (
      <ActiveGymWorkout
        workout={activeWorkout}
        userMaxes={userMaxes}
        prHistory={prHistory}
        lastWorkoutData={lastWorkoutData}
        onUpdate={setActiveWorkout}
        onFinish={finishWorkout}
      />
    );
  }

  // ── Home screen ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>

      {/* History screen */}
      {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}

      {/* New workout modal */}
      <Modal visible={showNewWorkout} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Krafttraining starten</Text>
            {routines.length > 0 && (
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.cardSecondary, marginBottom: 6 }]}
                onPress={() => { setShowNewWorkout(false); setShowRoutineManager(true); }}>
                <Text style={[s.saveBtnText, { color: theme.textPrimary }]}>Routine laden</Text>
              </TouchableOpacity>
            )}
            <Text style={s.inputLabel}>Name (optional)</Text>
            <TextInput style={s.input} placeholder="z.B. Oberkörper A"
              placeholderTextColor={theme.textTertiary} value={workoutName} onChangeText={setWorkoutName} />
            <Text style={s.inputLabel}>Intensität</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.intensityBtn, workoutIntensity === n && s.intensityBtnActive]}
                  onPress={() => setWorkoutIntensity(n)}>
                  <Text style={[s.intensityBtnText, workoutIntensity === n && { color: '#fff' }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={() => startWorkout()}>
              <Text style={s.saveBtnText}>Training starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNewWorkout(false)}>
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Header */}
          <View style={home.header}>
            <View>
              <Text style={home.headerSub}>Training</Text>
              <Text style={home.headerTitle}>Bereit für heute?</Text>
            </View>
            <TouchableOpacity style={home.historyBtn} onPress={() => setShowHistory(true)} activeOpacity={0.7}>
              <Text style={home.historyBtnText}>Verlauf</Text>
            </TouchableOpacity>
          </View>

          {/* Krafttraining card */}
          <TouchableOpacity
            style={[home.kraftCard, kraftRecommended && home.kraftCardRec]}
            onPress={() => setShowNewWorkout(true)}
            activeOpacity={0.88}>
            {kraftRecommended && (
              <View style={home.recBadge}>
                <View style={home.recDot} />
                <Text style={home.recBadgeText}>Heute empfohlen</Text>
              </View>
            )}
            <Text style={home.kraftTitle}>Krafttraining</Text>
            <Text style={home.kraftSub}>
              {kraftRecommended
                ? `Letztes Training vor ${daysSinceGym} Tagen`
                : 'Weiteres Training oder Routine starten'}
            </Text>
            <View style={home.kraftBtns}>
              <View style={home.kraftBtnPrimary}>
                <Text style={home.kraftBtnPrimaryText}>Freies Training</Text>
                <Text style={home.kraftBtnSub}>Selbst zusammenstellen</Text>
              </View>
              <View style={home.kraftBtnSecondary}>
                <Text style={home.kraftBtnSecondaryText}>Routine laden</Text>
                <Text style={home.kraftBtnSub}>Gespeicherte Pläne</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Lauf */}
          <TouchableOpacity style={home.actionCard} onPress={startRun} activeOpacity={0.88}>
            <View>
              <Text style={home.actionTitle}>Lauf starten</Text>
              <Text style={home.actionSub}>Distanz, Pace und Zeit erfassen</Text>
            </View>
            <Text style={home.actionArrow}>›</Text>
          </TouchableOpacity>

          {/* Sync */}
          <Text style={home.sectionLabel}>Synchronisieren</Text>
          <View style={home.syncCard}>
            <View style={home.syncLeft}>
              <Text style={home.syncTitle}>Trainings synchronisieren</Text>
              <Text style={[home.syncMeta, syncInfo.isNever && home.syncMetaNever]}>
                {syncInfo.text}
              </Text>
            </View>
            <TouchableOpacity style={home.syncBtn} onPress={handleSync} activeOpacity={0.8}>
              <Text style={home.syncBtnText}>Sync</Text>
            </TouchableOpacity>
          </View>

          {/* Strava */}
          <TouchableOpacity style={home.stravaCard} activeOpacity={0.88}>
            <View style={home.stravaIcon}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={home.stravaTitle}>Strava Import</Text>
              <Text style={home.stravaSub}>Training von Strava hier speichern</Text>
            </View>
            <Text style={home.actionArrow}>›</Text>
          </TouchableOpacity>

          {/* PRs */}
          <Text style={home.sectionLabel}>Personal Records</Text>
          {Object.keys(prHistory).length === 0 ? (
            <View style={home.prEmpty}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={home.prEmptyTitle}>Noch keine PRs</Text>
                <TouchableOpacity style={home.prAddBtn}>
                  <Text style={home.prAddBtnText}>+ Eintragen</Text>
                </TouchableOpacity>
              </View>
              <Text style={home.prEmptySub}>
                Mit deinen Bestleistungen empfiehlt die App optimale Gewichte für jede Übung.
              </Text>
            </View>
          ) : (
            <View style={home.prList}>
              {Object.entries(prHistory)
                .slice(0, 5)
                .map(([name, entries], i, arr) => {
                  const latest = entries[entries.length - 1];
                  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
                  const delta = prev ? latest.estimated1RM - prev.estimated1RM : null;
                  return (
                    <View key={name} style={[home.prRow, i < arr.length - 1 && home.prRowBorder]}>
                      <Text style={home.prName}>{name}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={home.prVal}>{latest.estimated1RM} kg</Text>
                        {delta !== null && (
                          <Text style={[home.prDelta, delta < 0 && { color: theme.red }]}>
                            {delta >= 0 ? '+' : ''}{delta} kg
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          )}

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── History Styles ───────────────────────────────────────────
const hist = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12,
  },
  headerSub: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  closeBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 6, flexDirection: 'row' },
  filterPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA' },
  filterPillActive: { backgroundColor: '#000', borderColor: '#000' },
  filterPillText: { fontSize: 13, fontWeight: '500', color: '#000' },
  filterPillTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  typePill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  typePillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDate: { fontSize: 12, color: '#8E8E93' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 6, letterSpacing: -0.2 },
  cardStats: { flexDirection: 'row', gap: 14 },
  statVal: { fontSize: 13, fontWeight: '600', color: '#000' },
  statLbl: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
});

// ─── Home Styles ──────────────────────────────────────────────
const home = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingTop: 60, paddingHorizontal: 22, paddingBottom: 14,
  },
  headerSub: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#000', letterSpacing: -0.5 },
  historyBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  historyBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },

  kraftCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#000', borderRadius: 20, padding: 20 },
  kraftCardRec: { shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8, borderWidth: 1.5, borderColor: '#FF6B00' },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF6B00', borderRadius: 20, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  recDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  recBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.8, textTransform: 'uppercase' },
  kraftTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginBottom: 3 },
  kraftSub: { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 },
  kraftBtns: { flexDirection: 'row', gap: 8 },
  kraftBtnPrimary: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 12, padding: 12, alignItems: 'center' },
  kraftBtnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  kraftBtnSecondary: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  kraftBtnSecondaryText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  kraftBtnSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 },

  actionCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 2 },
  actionSub: { fontSize: 12, color: '#8E8E93' },
  actionArrow: { fontSize: 22, color: '#C7C7CC', marginLeft: 8 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 22, marginBottom: 8, marginTop: 18 },

  syncCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  syncLeft: { flex: 1 },
  syncTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 3 },
  syncMeta: { fontSize: 12, color: '#34C759', fontWeight: '500' },
  syncMetaNever: { color: '#FF3B30' },
  syncBtn: { backgroundColor: '#000', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  syncBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  stravaCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  stravaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FC4C02', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stravaTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  stravaSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },

  prEmpty: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  prEmptyTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  prAddBtn: { backgroundColor: '#F2F2F7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  prAddBtnText: { fontSize: 12, fontWeight: '600', color: '#000' },
  prEmptySub: { fontSize: 13, color: '#8E8E93', lineHeight: 19 },

  prList: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  prRow: { flexDirection: 'row', alignItems: 'center', padding: 13, paddingHorizontal: 16 },
  prRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#F2F2F7' },
  prName: { flex: 1, fontSize: 14, color: '#000' },
  prVal: { fontSize: 14, fontWeight: '600', color: '#000' },
  prDelta: { fontSize: 11, color: '#34C759', fontWeight: '500', marginTop: 1 },
});

// ─── General Styles ───────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textSecondary, marginTop: 60, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '600', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: 16 },

  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 60, marginBottom: 16 },
  activeTimerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.greenLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  activeTimerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.green },
  activeTimerText: { fontSize: 14, fontWeight: '600', color: theme.green },

  liveStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  liveStat: { flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 12, alignItems: 'center', ...theme.shadow },
  liveStatVal: { fontSize: 20, fontWeight: '600' },
  liveStatLbl: { fontSize: 9, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  card: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, ...theme.shadow },
  cardTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: theme.textSecondary, marginBottom: 10 },
  inputLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: theme.textSecondary, marginBottom: 6 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 13, color: theme.textPrimary, fontSize: 15, marginBottom: 12 },

  exerciseCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, ...theme.shadow },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  musclePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  musclePillText: { fontSize: 11, fontWeight: '500' },
  exerciseName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  removeBtn: { fontSize: 18, color: theme.textTertiary },

  prWarn: { backgroundColor: '#FFF9E5', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#FF9500', marginBottom: 12 },
  prWarnTitle: { fontSize: 12, fontWeight: '700', color: '#000', marginBottom: 3 },
  prWarnSub: { fontSize: 11, color: '#8E8E93', lineHeight: 17, marginBottom: 8 },
  prWarnBtns: { flexDirection: 'row', gap: 6 },
  prWarnBtn: { flex: 1, borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA', backgroundColor: '#fff' },
  prWarnBtnText: { fontSize: 11, fontWeight: '600', color: '#000' },
  prWarnBtnSkip: { backgroundColor: '#F2F2F7', borderColor: 'transparent' },
  prWarnSkipText: { fontSize: 11, color: '#8E8E93' },

  recRow: { backgroundColor: theme.blueLight, borderRadius: 8, padding: 8, marginBottom: 10 },
  recText: { fontSize: 12, color: theme.blue, fontWeight: '500' },

  lastWorkoutRow: { flexDirection: 'row', backgroundColor: theme.cardSecondary, borderRadius: 8, padding: 8, marginBottom: 8 },
  lastWorkoutLabel: { fontSize: 11, color: theme.textSecondary },
  lastWorkoutVal: { fontSize: 11, color: theme.blue, fontWeight: '500', flex: 1 },
  oneRM: { fontSize: 11, color: theme.textSecondary, marginBottom: 10 },

  setHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setHeaderText: { flex: 1, fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  setRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  setNumber: { fontSize: 14, color: theme.textSecondary, width: 22, textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, color: theme.textPrimary, fontSize: 15, textAlign: 'center' },
  addSetBtn: { padding: 8, alignItems: 'center' },
  addSetBtnText: { fontSize: 13, color: theme.blue, fontWeight: '500' },

  addExerciseBtn: { backgroundColor: theme.blueLight, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  addExerciseBtnText: { fontSize: 15, color: theme.blue, fontWeight: '500' },
  finishBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20 },
  finishBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },

  restBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardSecondary },
  restBtnText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },

  runTimerCard: { backgroundColor: theme.card, borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: theme.green, ...theme.shadow },
  runTimerLabel: { fontSize: 10, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },
  runTimerDisplay: { fontSize: 60, fontWeight: '300', color: theme.textPrimary, letterSpacing: -2 },
  runControlBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 6 },
  runStartBtn: { backgroundColor: theme.greenLight },
  runPauseBtn: { backgroundColor: '#1A0000' },
  runControlBtnText: { fontSize: 15, fontWeight: '600' },
  runStatsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  runStatCard: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', ...theme.shadow },
  runStatVal: { fontSize: 16, fontWeight: '600' },
  runStatLbl: { fontSize: 8, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  finishRunBtn: { backgroundColor: theme.green, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  finishRunBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: theme.textSecondary },
  intensityBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardSecondary },
  intensityBtnActive: { backgroundColor: theme.blue },
  intensityBtnText: { fontSize: 15, color: theme.textSecondary, fontWeight: '500' },

  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.cardSecondary },
  presetChipText: { fontSize: 13, color: theme.textPrimary },
});