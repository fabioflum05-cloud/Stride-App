import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, AppStateStatus,
  Dimensions, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const SW = Dimensions.get('window').width;

// ─── Volcanic Dark Theme ───────────────────────────────────────
const theme = {
  bg:            '#1A1614',
  card:          '#231F1C',
  cardSecondary: '#2E2825',
  border:        'rgba(255,255,255,0.07)' as string,

  orange:        '#E8572A',
  orangeLight:   'rgba(232,87,42,0.15)' as string,
  orangeBorder:  'rgba(232,87,42,0.25)' as string,

  // kept as aliases so nothing breaks
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

// ─── SVG Icons ────────────────────────────────────────────────
function IconDumbbell({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4V20M18 4V20M3 8H7M17 8H21M3 16H7M17 16H21M7 12H17" stroke={color} strokeWidth={2} strokeLinecap="round" />
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
  return { seconds, isRunning, start, pause, reset };
}

// ─── Rest Timer ───────────────────────────────────────────────
function useRestTimer() {
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

  type HistoryItem = { _kind: 'workout'; data: Workout } | { _kind: 'run'; data: RunData };
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

  const typeConfig: Record<string, { bg: string; color: string; label: string; border: string }> = {
    gym:    { bg: 'rgba(232,87,42,0.15)',   color: theme.orange,  label: 'Kraft',     border: theme.orangeBorder },
    judo:   { bg: 'rgba(127,119,221,0.15)', color: '#7F77DD',     label: 'Judo',      border: 'rgba(127,119,221,0.3)' },
    manual: { bg: 'rgba(245,240,238,0.06)', color: theme.textSecondary, label: 'Sonstiges', border: theme.border },
    run:    { bg: 'rgba(52,199,89,0.12)',   color: theme.green,   label: 'Lauf',      border: 'rgba(52,199,89,0.25)' },
  };

  return (
    <Modal visible animationType="slide">
      <View style={hist.root}>
        <View style={hist.header}>
          <View>
            <Text style={hist.eyebrow}>Training</Text>
            <Text style={hist.title}>Verlauf</Text>
          </View>
          <TouchableOpacity style={hist.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <IconClose color={theme.textPrimary} size={16} />
          </TouchableOpacity>
        </View>

        <View style={hist.summaryBar}>
          {[
            { val: workouts.filter(w => w.type === 'gym').length, lbl: 'Kraft',  color: theme.orange },
            { val: runs.length,                                    lbl: 'Läufe',  color: theme.green },
            { val: workouts.filter(w => w.type === 'judo').length, lbl: 'Judo',  color: '#7F77DD' },
            { val: allItems.length,                                lbl: 'Gesamt', color: theme.textPrimary },
          ].map((s, i) => (
            <View key={s.lbl} style={[hist.summaryItem, i < 3 && { borderRightWidth: 0.5, borderRightColor: theme.border }]}>
              <Text style={[hist.summaryVal, { color: s.color }]}>{s.val}</Text>
              <Text style={hist.summaryLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hist.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key}
              style={[hist.filterPill, filter === f.key && hist.filterPillActive]}
              onPress={() => setFilter(f.key)} activeOpacity={0.7}>
              <Text style={[hist.filterPillText, filter === f.key && hist.filterPillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={hist.listContent}>
          {filtered.length === 0 && (
            <View style={hist.emptyWrap}>
              <View style={hist.emptyIcon}><IconHistory color={theme.textTertiary} size={32} /></View>
              <Text style={hist.emptyTitle}>Keine Trainings gefunden</Text>
              <Text style={hist.emptySub}>Starte dein erstes Training um es hier zu sehen.</Text>
            </View>
          )}
          {filtered.map((item, i) => {
            const isRun = item._kind === 'run';
            const r = isRun ? (item.data as RunData) : null;
            const w = !isRun ? (item.data as Workout) : null;
            const tc = isRun ? typeConfig.run : typeConfig[w?.type ?? 'manual'];
            const totalVolume = w?.exercises?.reduce((t, ex) =>
              t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0) ?? 0;
            const totalSets = w?.exercises?.reduce((s, ex) => s + ex.sets.length, 0) ?? 0;

            return (
              <View key={i} style={[hist.card, { borderLeftColor: tc.color }]}>
                <View style={hist.cardTop}>
                  <View style={[hist.typePill, { backgroundColor: tc.bg, borderColor: tc.border, borderWidth: 1 }]}>
                    <Text style={[hist.typePillText, { color: tc.color }]}>{tc.label}</Text>
                  </View>
                  <Text style={hist.cardDate}>{formatDateLabel(item.data.date)}</Text>
                </View>
                <Text style={hist.cardName}>{isRun ? 'Lauftraining' : w?.name}</Text>
                <View style={hist.statsRow}>
                  {isRun && r ? (
                    <>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.green }]}>{r.distance.toFixed(2)}</Text><Text style={hist.statLbl}>km</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.blue }]}>{formatTime(r.duration)}</Text><Text style={hist.statLbl}>Zeit</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.orange }]}>{r.pace}/km</Text><Text style={hist.statLbl}>Pace</Text></View>
                      {r.heartRate > 0 && <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.pink }]}>{r.heartRate}</Text><Text style={hist.statLbl}>bpm</Text></View>}
                    </>
                  ) : w?.type === 'gym' ? (
                    <>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.orange }]}>{w.duration}</Text><Text style={hist.statLbl}>min</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.blue }]}>{Math.round(totalVolume).toLocaleString()}</Text><Text style={hist.statLbl}>kg Vol.</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: '#7F77DD' }]}>{totalSets}</Text><Text style={hist.statLbl}>Sets</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.green }]}>{w.exercises?.length ?? 0}</Text><Text style={hist.statLbl}>Übungen</Text></View>
                    </>
                  ) : (
                    <>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.textPrimary }]}>{w?.duration}</Text><Text style={hist.statLbl}>min</Text></View>
                      <View style={hist.statBox}><Text style={[hist.statVal, { color: theme.textPrimary }]}>{w?.intensity}/5</Text><Text style={hist.statLbl}>Intensität</Text></View>
                    </>
                  )}
                </View>
                {!isRun && w?.type === 'gym' && w.exercises?.length > 0 && (
                  <View style={hist.exerciseList}>
                    {w.exercises.slice(0, 3).map((ex, ei) => (
                      <View key={ei} style={hist.exerciseChip}>
                        <View style={[hist.exerciseDot, { backgroundColor: MUSCLE_COLORS[ex.muscleGroup] || '#888' }]} />
                        <Text style={hist.exerciseChipText}>{ex.name}</Text>
                      </View>
                    ))}
                    {w.exercises.length > 3 && (
                      <View style={hist.exerciseChip}><Text style={hist.exerciseChipText}>+{w.exercises.length - 3} weitere</Text></View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── PR Screen ────────────────────────────────────────────────
function PRScreen({ prHistory, onClose }: { prHistory: PRHistory; onClose: () => void }) {
  const entries = Object.entries(prHistory).sort((a, b) => {
    const aMax = a[1][a[1].length - 1]?.estimated1RM ?? 0;
    const bMax = b[1][b[1].length - 1]?.estimated1RM ?? 0;
    return bMax - aMax;
  });

  return (
    <Modal visible animationType="slide">
      <View style={pr.root}>
        <View style={pr.header}>
          <View>
            <Text style={pr.eyebrow}>Bestleistungen</Text>
            <Text style={pr.title}>Personal Records</Text>
          </View>
          <TouchableOpacity style={pr.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <IconClose color={theme.textPrimary} size={16} />
          </TouchableOpacity>
        </View>

        {entries.length === 0 ? (
          <View style={pr.emptyWrap}>
            <View style={pr.emptyIcon}><IconTrophy color={theme.textTertiary} size={40} /></View>
            <Text style={pr.emptyTitle}>Noch keine PRs</Text>
            <Text style={pr.emptySub}>Starte ein Training und setze deinen ersten Personal Record.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            {entries.map(([name, history], i) => {
              const latest = history[history.length - 1];
              const prev = history.length > 1 ? history[history.length - 2] : null;
              const delta = prev ? latest.estimated1RM - prev.estimated1RM : null;
              const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
              const rankColor = i < 3 ? rankColors[i] : theme.border;
              return (
                <View key={name} style={pr.card}>
                  <View style={pr.cardTop}>
                    <View style={[pr.rankBadge, { backgroundColor: rankColor + '25', borderColor: rankColor }]}>
                      <Text style={[pr.rankText, { color: i < 3 ? rankColor : theme.textSecondary }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={pr.exerciseName}>{name}</Text>
                      <Text style={pr.exerciseDate}>{new Date(latest.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={pr.oneRMVal}>{latest.estimated1RM} kg</Text>
                      <Text style={pr.oneRMLabel}>Est. 1RM</Text>
                    </View>
                  </View>
                  <View style={pr.cardStats}>
                    <View style={pr.prStat}>
                      <Text style={pr.prStatVal}>{latest.weight} kg</Text>
                      <Text style={pr.prStatLbl}>Gewicht</Text>
                    </View>
                    <View style={pr.prStat}>
                      <Text style={pr.prStatVal}>{latest.reps}</Text>
                      <Text style={pr.prStatLbl}>Wiederholungen</Text>
                    </View>
                    {delta !== null && (
                      <View style={[pr.deltaChip, { backgroundColor: delta > 0 ? 'rgba(52,199,89,0.12)' : delta < 0 ? 'rgba(255,69,58,0.12)' : theme.cardSecondary }]}>
                        {delta > 0 ? <IconArrowUp color={theme.green} size={12} /> : delta < 0 ? <IconArrowDown color={theme.red} size={12} /> : null}
                        <Text style={[pr.deltaText, { color: delta > 0 ? theme.green : delta < 0 ? theme.red : theme.textSecondary }]}>
                          {delta >= 0 ? '+' : ''}{delta} kg
                        </Text>
                      </View>
                    )}
                  </View>
                  {history.length > 1 && (
                    <View style={pr.historyRow}>
                      {history.slice(-5).map((entry, ei) => {
                        const maxVal = Math.max(...history.map(e => e.estimated1RM));
                        const pct = maxVal > 0 ? entry.estimated1RM / maxVal : 0;
                        const isLast = ei === history.slice(-5).length - 1;
                        return (
                          <View key={ei} style={{ alignItems: 'center', flex: 1, gap: 3 }}>
                            <View style={{ height: 30, justifyContent: 'flex-end' }}>
                              <View style={{ width: 6, borderRadius: 3, height: Math.max(4, pct * 30), backgroundColor: isLast ? theme.orange : theme.cardSecondary }} />
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

// ─── Routine Manager ──────────────────────────────────────────
function RoutineManager({ routines, onSelect, onClose, onCreateNew }: {
  routines: Routine[]; onSelect: (r: Routine) => void; onClose: () => void; onCreateNew: () => void;
}) {
  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Routine laden</Text>
          {routines.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <IconDumbbell color={theme.textTertiary} size={26} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' }}>Keine Routinen gespeichert</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                Erstelle zuerst eine Routine um sie hier laden zu können.
              </Text>
              <TouchableOpacity style={[s.saveBtn, { marginTop: 4 }]} onPress={onCreateNew}>
                <Text style={s.saveBtnText}>Routine erstellen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {routines.map(routine => (
                <TouchableOpacity key={routine.id} style={rm.routineCard} onPress={() => onSelect(routine)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={rm.routineName}>{routine.name}</Text>
                    <Text style={rm.routineMeta}>{routine.exercises.length} Übungen</Text>
                    <View style={rm.chips}>
                      {routine.exercises.slice(0, 3).map(ex => (
                        <View key={ex.name} style={[rm.chip, { backgroundColor: (MUSCLE_COLORS[ex.muscleGroup] || '#888') + '22' }]}>
                          <Text style={[rm.chipText, { color: MUSCLE_COLORS[ex.muscleGroup] || '#888' }]}>{ex.name}</Text>
                        </View>
                      ))}
                      {routine.exercises.length > 3 && (
                        <View style={rm.chip}><Text style={rm.chipText}>+{routine.exercises.length - 3}</Text></View>
                      )}
                    </View>
                  </View>
                  <IconChevronRight color={theme.textTertiary} size={18} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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

// ─── PR Missing Warning ───────────────────────────────────────
function PRMissingWarning({ exerciseName, onAddPR, onSwap, onSkip }: {
  exerciseName: string; onAddPR: () => void; onSwap: () => void; onSkip: () => void;
}) {
  return (
    <View style={s.prWarn}>
      <Text style={s.prWarnTitle}>Kein PR für {exerciseName}</Text>
      <Text style={s.prWarnSub}>Ohne PR kann keine Gewichtsempfehlung berechnet werden.</Text>
      <View style={s.prWarnBtns}>
        <TouchableOpacity style={s.prWarnBtn} onPress={onAddPR}><Text style={s.prWarnBtnText}>PR eintragen</Text></TouchableOpacity>
        <TouchableOpacity style={s.prWarnBtn} onPress={onSwap}><Text style={s.prWarnBtnText}>Übung wechseln</Text></TouchableOpacity>
        <TouchableOpacity style={[s.prWarnBtn, s.prWarnBtnSkip]} onPress={onSkip}><Text style={s.prWarnSkipText}>Trotzdem machen</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Active Gym Workout ───────────────────────────────────────
function ActiveGymWorkout({ workout, userMaxes, prHistory, lastWorkoutData, onUpdate, onFinish }: {
  workout: Workout; userMaxes: UserMaxes; prHistory: PRHistory;
  lastWorkoutData: Record<string, Set[]>; onUpdate: (w: Workout) => void; onFinish: () => void;
}) {
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [dismissedPRWarnings, setDismissedPRWarnings] = useState<Set<string>>(new Set());
  const timer = usePersistentTimer('gymWorkoutTimer');
  const restTimer = useRestTimer();
  const workoutStartRef = useRef(Date.now());
  const [allExercises, setAllExercises] = useState(DEFAULT_EXERCISES);

  useEffect(() => {
    AsyncStorage.getItem('gymWorkoutTimer').then(raw => { if (!raw) timer.start(); });
    AsyncStorage.getItem('workoutStartTime').then(raw => {
      if (raw) workoutStartRef.current = parseInt(raw);
      else AsyncStorage.setItem('workoutStartTime', String(Date.now()));
    });
    AsyncStorage.getItem('userExercises').then(r => r && setAllExercises(JSON.parse(r)));
  }, []);

  async function addExercise(name: string, muscleGroup: string) {
    const lastSets = lastWorkoutData[name];
    const sets = lastSets ? lastSets.map(() => ({ reps: '', weight: '' })) : [{ reps: '', weight: '' }];
    const updated = { ...workout, exercises: [...workout.exercises, { id: Date.now().toString(), name, muscleGroup, sets }] };
    onUpdate(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
    setShowExercisePicker(false);
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
    t + ex.sets.reduce((s, set) => s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0);

  return (
    <>
      {showExercisePicker && (
        <ExercisePicker allExercises={allExercises} onSelect={addExercise} onClose={() => setShowExercisePicker(false)} />
      )}
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
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

        <View style={s.liveStats}>
          {[
            { val: workout.exercises.length, lbl: 'Übungen', color: theme.orange },
            { val: totalSets,                lbl: 'Sets',    color: theme.green },
            { val: Math.round(totalVolume),  lbl: 'kg Vol.', color: theme.blue },
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
              <TouchableOpacity onPress={restTimer.stop}><Text style={{ color: theme.red, fontSize: 12, fontWeight: '600' }}>Stopp</Text></TouchableOpacity>
            )}
          </View>
          {restTimer.isRunning && (
            <View style={{ height: 4, backgroundColor: theme.cardSecondary, borderRadius: 2, marginTop: 8 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: restTimer.pct > 0.3 ? theme.green : restTimer.pct > 0.1 ? theme.orange : theme.red, width: `${restTimer.pct * 100}%` as any }} />
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

        {workout.exercises.map(exercise => {
          const hasPR = !!(prHistory[exercise.name]?.length) || !!(userMaxes[exercise.name]);
          const isDismissed = dismissedPRWarnings.has(exercise.id);
          const best1RM = getBest1RM(exercise.sets);
          const userMax = userMaxes[exercise.name];
          const pctOfMax = userMax && best1RM > 0 ? Math.round((best1RM / userMax) * 100) : null;
          const lastSets = lastWorkoutData[exercise.name];
          const mc = MUSCLE_COLORS[exercise.muscleGroup] || '#888';
          const recText = userMax ? `Empfehlung: 4 × 8 Wdh. @ ${Math.round((userMax * 0.75) / 2.5) * 2.5} kg` : null;

          return (
            <View key={exercise.id} style={s.exerciseCard}>
              <View style={s.exerciseHeader}>
                <View style={[s.musclePill, { backgroundColor: mc + '22' }]}>
                  <Text style={[s.musclePillText, { color: mc }]}>{exercise.muscleGroup}</Text>
                </View>
                <Text style={s.exerciseName}>{exercise.name}</Text>
                <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                  <IconClose color={theme.textTertiary} size={16} />
                </TouchableOpacity>
              </View>
              {!hasPR && !isDismissed && (
                <PRMissingWarning
                  exerciseName={exercise.name}
                  onAddPR={() => setDismissedPRWarnings(prev => new Set(prev).add(exercise.id))}
                  onSwap={() => { removeExercise(exercise.id); setShowExercisePicker(true); }}
                  onSkip={() => setDismissedPRWarnings(prev => new Set(prev).add(exercise.id))}
                />
              )}
              {recText && <View style={s.recRow}><Text style={s.recText}>{recText}</Text></View>}
              {lastSets && (
                <View style={s.lastWorkoutRow}>
                  <Text style={s.lastWorkoutLabel}>Letztes Mal: </Text>
                  <Text style={s.lastWorkoutVal}>{lastSets.map(ls => `${ls.weight}kg × ${ls.reps}`).join(' · ')}</Text>
                </View>
              )}
              {best1RM > 0 && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                  <Text style={s.oneRM}>Est. 1RM: <Text style={{ color: theme.orange, fontWeight: '600' }}>{best1RM} kg</Text></Text>
                  {pctOfMax && <Text style={s.oneRM}>% Max: <Text style={{ color: pctOfMax >= 100 ? theme.green : pctOfMax >= 85 ? theme.orange : theme.textSecondary, fontWeight: '600' }}>{pctOfMax}%</Text></Text>}
                </View>
              )}
              <View style={s.setHeader}>
                {['Set', 'Wdh.', 'Gewicht (kg)'].map(h => <Text key={h} style={s.setHeaderText}>{h}</Text>)}
              </View>
              {exercise.sets.map((set, si) => (
                <View key={si} style={s.setRow}>
                  <Text style={s.setNumber}>{si + 1}</Text>
                  <TextInput style={s.setInput} placeholder={lastSets?.[si]?.reps || '0'} placeholderTextColor={theme.textTertiary}
                    value={set.reps} onChangeText={v => updateSet(exercise.id, si, 'reps', v)} keyboardType="numeric" />
                  <TextInput style={s.setInput} placeholder={lastSets?.[si]?.weight || '0'} placeholderTextColor={theme.textTertiary}
                    value={set.weight} onChangeText={v => updateSet(exercise.id, si, 'weight', v)} keyboardType="decimal-pad" />
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
// ─── Run Screen ───────────────────────────────────────────────
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
        <TouchableOpacity style={[s.runControlBtn, timer.isRunning ? s.runPauseBtn : s.runStartBtn]}
          onPress={() => timer.isRunning ? timer.pause() : timer.start()} activeOpacity={0.8}>
          <Text style={[s.runControlBtnText, { color: timer.isRunning ? theme.red : theme.green }]}>
            {timer.isRunning ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>
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

// ─── Main Training Screen ─────────────────────────────────────
export default function TrainingScreen() {
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeRun, setActiveRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoutineManager, setShowRoutineManager] = useState(false);
  const [showPRScreen, setShowPRScreen] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
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
      [...ws].reverse().forEach(w => { w.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; }); });
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
    const rawDevice = await AsyncStorage.getItem('connectedDevice');
    if (rawDevice) setConnectedDevice(rawDevice);
  }

  const lastGymWorkout = workouts.filter(w => w.type === 'gym').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const daysSinceGym = lastGymWorkout ? daysSince(lastGymWorkout.date) : -1;
  const neverTrainedGym = daysSinceGym === -1;
  const kraftRecommended = daysSinceGym >= 3;

  async function startFreeWorkout() {
    const w: Workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      name: 'Freies Training', exercises: [], duration: 0, intensity: 3, type: 'gym',
    };
    workoutStartRef.current = Date.now();
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    await AsyncStorage.setItem('workoutStartTime', String(Date.now()));
    setActiveWorkout(w);
  }

  async function startRoutineWorkout(routine: Routine) {
    const w: Workout = {
      id: Date.now().toString(), date: new Date().toISOString(), name: routine.name,
      exercises: routine.exercises.map(re => ({
        id: Date.now().toString() + re.name, name: re.name, muscleGroup: re.muscleGroup,
        sets: Array.from({ length: re.defaultSets }, () => ({ reps: '', weight: '' })),
      })),
      duration: 0, intensity: 3, type: 'gym',
    };
    workoutStartRef.current = Date.now();
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(w));
    await AsyncStorage.setItem('workoutStartTime', String(Date.now()));
    setActiveWorkout(w);
    setShowRoutineManager(false);
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
    const newPRHistory = { ...prHistory };
    for (const ex of finished.exercises) {
      const best = getBest1RM(ex.sets);
      if (best > 0) {
        const current = newPRHistory[ex.name] || [];
        const currentMax = current.length > 0 ? current[current.length - 1].estimated1RM : 0;
        if (best > currentMax) {
          const bestSet = ex.sets.reduce((b, set) =>
            calc1RM(parseFloat(set.weight || '0'), parseFloat(set.reps || '0')) >
            calc1RM(parseFloat(b.weight || '0'), parseFloat(b.reps || '0')) ? set : b, ex.sets[0]);
          newPRHistory[ex.name] = [...(newPRHistory[ex.name] || []), {
            date: new Date().toISOString(), weight: parseFloat(bestSet.weight || '0'),
            reps: parseFloat(bestSet.reps || '0'), estimated1RM: best,
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
    setActiveRun(false); setActiveWorkout(null);
    await AsyncStorage.removeItem('activeWorkout');
    await loadAll();
  }

  if (activeRun) return <RunScreen onStop={stopSession} />;
  if (activeWorkout) {
    return (
      <ActiveGymWorkout workout={activeWorkout} userMaxes={userMaxes} prHistory={prHistory}
        lastWorkoutData={lastWorkoutData} onUpdate={setActiveWorkout} onFinish={finishWorkout} />
    );
  }

  const prCount = Object.keys(prHistory).length;
  const topPRs = Object.entries(prHistory)
    .sort((a, b) => (b[1][b[1].length - 1]?.estimated1RM ?? 0) - (a[1][a[1].length - 1]?.estimated1RM ?? 0))
    .slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}
      {showPRScreen && <PRScreen prHistory={prHistory} onClose={() => setShowPRScreen(false)} />}
      {showRoutineManager && (
        <RoutineManager routines={routines} onSelect={startRoutineWorkout}
          onClose={() => setShowRoutineManager(false)} onCreateNew={() => setShowRoutineManager(false)} />
      )}

      {/* Device Modal */}
      <Modal visible={showDeviceModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Gerät verbinden</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16, lineHeight: 19 }}>
              Verbinde dein Gerät um Trainings automatisch zu synchronisieren.
            </Text>
            {['Polar', 'Garmin', 'Apple Watch', 'Suunto'].map(device => (
              <TouchableOpacity key={device}
                style={[s.presetChip, { paddingVertical: 14, marginBottom: 8, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={async () => {
                  await AsyncStorage.setItem('connectedDevice', device);
                  setConnectedDevice(device);
                  setShowDeviceModal(false);
                  Alert.alert('Verbunden', `${device} wurde erfolgreich verbunden.`);
                }}>
                <Text style={[s.presetChipText, { fontSize: 15 }]}>{device}</Text>
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

          {/* Header */}
          <View style={home.header}>
            <Text style={home.eyebrow}>Training</Text>
            <Text style={home.title}>Bereit für heute?</Text>
          </View>

          {/* ── KRAFTTRAINING CARD ── */}
          <View style={home.kraftCard}>
            {/* Geometric decoration */}
            <View style={home.gymVisual}>
              <View style={home.gymBar1} />
              <View style={home.gymBar2} />
              <View style={home.gymBar3} />
              <View style={home.gymCircle} />
            </View>
            <View style={home.kraftContent}>
              {kraftRecommended && (
                <View style={home.recBadge}>
                  <View style={home.recDot} />
                  <Text style={home.recBadgeText}>Heute empfohlen</Text>
                </View>
              )}
              <Text style={home.kraftTitle}>Krafttraining</Text>
              <Text style={home.kraftSub}>
                {neverTrainedGym ? 'Kein Training aufgezeichnet'
                  : kraftRecommended ? `Letztes Training vor ${daysSinceGym} Tagen`
                  : 'Bereit für die nächste Session'}
              </Text>
              <View style={home.kraftBtns}>
                <TouchableOpacity style={home.kraftBtnPrimary} onPress={startFreeWorkout} activeOpacity={0.85}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <IconPlus color="#fff" size={15} />
                    <Text style={home.kraftBtnPrimaryText}>Freies Training</Text>
                  </View>
                  <Text style={home.kraftBtnSub}>Selbst zusammenstellen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={home.kraftBtnSecondary} onPress={() => setShowRoutineManager(true)} activeOpacity={0.85}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <IconDumbbell color="rgba(255,255,255,0.85)" size={15} />
                    <Text style={home.kraftBtnSecondaryText}>Routine laden</Text>
                  </View>
                  <Text style={home.kraftBtnSub}>Gespeicherte Pläne</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── LAUF CARD ── */}
          <TouchableOpacity style={home.runCard} onPress={startRun} activeOpacity={0.88}>
            <View style={home.runIconWrap}>
              <IconRun color={theme.green} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={home.runTitle}>Lauf starten</Text>
              <Text style={home.runSub}>Distanz, Pace und Zeit erfassen</Text>
            </View>
            <View style={home.runStartBtn}>
              <Text style={home.runStartBtnText}>Start</Text>
            </View>
          </TouchableOpacity>

          {/* ── GERÄT ── */}
          <Text style={home.sectionLabel}>Gerät</Text>
          {connectedDevice ? (
            <View style={home.deviceCard}>
              <View style={[home.deviceIconWrap, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                <IconWatch color={theme.green} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={home.deviceTitle}>{connectedDevice}</Text>
                <Text style={[home.deviceSub, { color: theme.green }]}>Verbunden</Text>
              </View>
              <TouchableOpacity style={home.syncBtn}
                onPress={() => Alert.alert('Synchronisieren', 'Daten werden synchronisiert...')} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <IconSync color="#fff" size={14} />
                  <Text style={home.syncBtnText}>Sync</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={home.noDeviceCard} onPress={() => setShowDeviceModal(true)} activeOpacity={0.85}>
              <View style={[home.deviceIconWrap, { backgroundColor: theme.cardSecondary }]}>
                <IconWatch color={theme.textTertiary} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={home.deviceTitle}>Kein Gerät verbunden</Text>
                <Text style={home.deviceSub}>Polar, Garmin oder Apple Watch verbinden</Text>
              </View>
              <View style={home.connectBtn}>
                <Text style={home.connectBtnText}>Verbinden</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── PERSONAL RECORDS ── */}
          <Text style={home.sectionLabel}>Personal Records</Text>
          {prCount === 0 ? (
            <View style={home.prEmptyCard}>
              <View style={home.prEmptyIcon}>
                <IconTrophy color={theme.textTertiary} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={home.prEmptyTitle}>Noch keine PRs gespeichert</Text>
                <Text style={home.prEmptySub}>Mit deinen Bestleistungen empfiehlt die App optimale Gewichte.</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={home.prCard} onPress={() => setShowPRScreen(true)} activeOpacity={0.88}>
              <View style={home.prCardTop}>
                <Text style={home.prCardTitle}>Personal Records</Text>
                <View style={home.prCountBadge}><Text style={home.prCountText}>{prCount} PRs</Text></View>
                <IconChevronRight color={theme.textTertiary} size={18} />
              </View>
              {topPRs.map(([name, history], i) => {
                const latest = history[history.length - 1];
                const prev = history.length > 1 ? history[history.length - 2] : null;
                const delta = prev ? latest.estimated1RM - prev.estimated1RM : null;
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                return (
                  <View key={name} style={[home.prRow, i < topPRs.length - 1 && home.prRowBorder]}>
                    <View style={[home.prRank, { backgroundColor: rankColors[i] + '20' }]}>
                      <Text style={[home.prRankText, { color: rankColors[i] }]}>#{i + 1}</Text>
                    </View>
                    <Text style={home.prName}>{name}</Text>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={home.prVal}>{latest.estimated1RM} kg</Text>
                      {delta !== null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          {delta > 0 ? <IconArrowUp color={theme.green} size={10} /> : <IconArrowDown color={theme.red} size={10} />}
                          <Text style={[home.prDelta, delta < 0 && { color: theme.red }]}>{Math.abs(delta)} kg</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </TouchableOpacity>
          )}

          {/* ── VERLAUF BUTTON ── */}
          <TouchableOpacity style={home.verlaufBtn} onPress={() => setShowHistory(true)} activeOpacity={0.88}>
            <View style={home.verlaufLeft}>
              <View style={home.verlaufIconWrap}>
                <IconHistory color={theme.orange} size={26} />
              </View>
              <View>
                <Text style={home.verlaufTitle}>Trainingsverlauf</Text>
                <Text style={home.verlaufSub}>{workouts.length} Einheiten gespeichert</Text>
              </View>
            </View>
            <View style={home.verlaufArrow}>
              <IconChevronRight color={theme.orange} size={20} />
            </View>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const hist = StyleSheet.create({
  root:               { flex: 1, backgroundColor: theme.bg },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 14, backgroundColor: theme.card, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  eyebrow:            { fontSize: 11, fontWeight: '600', color: theme.orange, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  title:              { fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.8 },
  closeBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  summaryBar:         { flexDirection: 'row', backgroundColor: theme.card, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  summaryItem:        { flex: 1, paddingVertical: 14, alignItems: 'center' },
  summaryVal:         { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  summaryLbl:         { fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  filterRow:          { paddingHorizontal: 16, paddingVertical: 12, gap: 6, flexDirection: 'row' },
  filterPill:         { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  filterPillActive:   { backgroundColor: theme.orange, borderColor: theme.orange },
  filterPillText:     { fontSize: 13, fontWeight: '500', color: theme.textPrimary },
  filterPillTextActive: { color: '#fff' },
  listContent:        { paddingHorizontal: 16, paddingTop: 4 },
  emptyWrap:          { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon:          { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:         { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  emptySub:           { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
  card:               { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, borderLeftWidth: 3, ...theme.shadow },
  cardTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typePill:           { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typePillText:       { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDate:           { fontSize: 12, color: theme.textTertiary },
  cardName:           { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 12, letterSpacing: -0.3 },
  statsRow:           { flexDirection: 'row', gap: 6, marginBottom: 10 },
  statBox:            { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: theme.cardSecondary, borderRadius: 10 },
  statVal:            { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  statLbl:            { fontSize: 9, color: theme.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  exerciseList:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  exerciseChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  exerciseDot:        { width: 6, height: 6, borderRadius: 3 },
  exerciseChipText:   { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
});

const pr = StyleSheet.create({
  root:         { flex: 1, backgroundColor: theme.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 14, backgroundColor: theme.card, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  eyebrow:      { fontSize: 11, fontWeight: '600', color: theme.orange, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  title:        { fontSize: 28, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.8 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  emptyIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  emptySub:     { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21 },
  card:         { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 10, ...theme.shadow },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rankBadge:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  rankText:     { fontSize: 12, fontWeight: '800' },
  exerciseName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.3 },
  exerciseDate: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
  oneRMVal:     { fontSize: 20, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  oneRMLabel:   { fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardStats:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  prStat:       { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, alignItems: 'center' },
  prStatVal:    { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  prStatLbl:    { fontSize: 9, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  deltaChip:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText:    { fontSize: 12, fontWeight: '700' },
  historyRow:   { flexDirection: 'row', gap: 4, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: theme.border, alignItems: 'flex-end' },
});

const rm = StyleSheet.create({
  routineCard: { backgroundColor: theme.cardSecondary, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  routineMeta: { fontSize: 12, color: theme.textSecondary, marginBottom: 6 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: theme.card },
  chipText:    { fontSize: 10, fontWeight: '500', color: theme.textSecondary },
});

const home = StyleSheet.create({
  header:   { paddingTop: 60, paddingHorizontal: 22, paddingBottom: 16 },
  eyebrow:  { fontSize: 11, fontWeight: '600', color: theme.orange, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  title:    { fontSize: 30, fontWeight: '800', color: theme.textPrimary, letterSpacing: -1 },

  kraftCard:    { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.card, borderRadius: 22, overflow: 'hidden', minHeight: 200, borderWidth: 1, borderColor: theme.orangeBorder },
  gymVisual:    { position: 'absolute', right: 16, top: 16, opacity: 0.1, flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  gymBar1:      { width: 10, height: 50, backgroundColor: theme.orange, borderRadius: 3 },
  gymBar2:      { width: 10, height: 80, backgroundColor: theme.orange, borderRadius: 3 },
  gymBar3:      { width: 10, height: 60, backgroundColor: theme.orange, borderRadius: 3 },
  gymCircle:    { position: 'absolute', bottom: -16, left: -16, width: 48, height: 48, borderRadius: 24, borderWidth: 8, borderColor: theme.orange },
  kraftContent: { padding: 20 },
  recBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.orangeLight, borderRadius: 20, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12, borderWidth: 1, borderColor: theme.orangeBorder },
  recDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.orange },
  recBadgeText: { fontSize: 10, fontWeight: '700', color: theme.orange, letterSpacing: 0.8, textTransform: 'uppercase' },
  kraftTitle:   { fontSize: 22, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  kraftSub:     { fontSize: 13, color: theme.textSecondary, marginBottom: 18 },
  kraftBtns:    { flexDirection: 'row', gap: 10 },
  kraftBtnPrimary:     { flex: 1, backgroundColor: theme.orange, borderRadius: 14, padding: 13 },
  kraftBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  kraftBtnSecondary:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 13, borderWidth: 1, borderColor: theme.border },
  kraftBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  kraftBtnSub:  { fontSize: 10, color: theme.textTertiary, marginTop: 2 },

  runCard:      { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  runIconWrap:  { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.greenLight, alignItems: 'center', justifyContent: 'center' },
  runTitle:     { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  runSub:       { fontSize: 12, color: theme.textSecondary },
  runStartBtn:  { backgroundColor: theme.green, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10 },
  runStartBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: theme.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 22, marginBottom: 8, marginTop: 18 },

  deviceCard:   { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  noDeviceCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' },
  deviceIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  deviceTitle:  { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  deviceSub:    { fontSize: 12, color: theme.textSecondary },
  syncBtn:      { backgroundColor: theme.orange, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncBtnText:  { fontSize: 13, fontWeight: '600', color: '#fff' },
  connectBtn:   { backgroundColor: theme.orangeLight, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: theme.orangeBorder },
  connectBtnText: { fontSize: 13, fontWeight: '600', color: theme.orange },

  prEmptyCard:  { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  prEmptyIcon:  { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  prEmptyTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 3 },
  prEmptySub:   { fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  prCard:       { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  prCardTop:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  prCardTitle:  { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  prCountBadge: { backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  prCountText:  { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  prRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  prRowBorder:  { borderBottomWidth: 0.5, borderBottomColor: theme.border },
  prRank:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  prRankText:   { fontSize: 11, fontWeight: '800' },
  prName:       { flex: 1, fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  prVal:        { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  prDelta:      { fontSize: 11, color: theme.green, fontWeight: '600' },

  verlaufBtn:   { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.card, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.orangeBorder, ...theme.shadow },
  verlaufLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verlaufIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.orangeLight, alignItems: 'center', justifyContent: 'center' },
  verlaufTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.3, marginBottom: 2 },
  verlaufSub:   { fontSize: 12, color: theme.textSecondary },
  verlaufArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.orangeLight, alignItems: 'center', justifyContent: 'center' },
});

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel:       { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.textSecondary, marginTop: 60, marginBottom: 12 },
  title:             { fontSize: 26, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: 16 },
  activeHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 60, marginBottom: 16 },
  activeTimerBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.orangeBorder },
  activeTimerDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.orange },
  activeTimerText:   { fontSize: 14, fontWeight: '600', color: theme.orange },
  liveStats:         { flexDirection: 'row', gap: 8, marginBottom: 14 },
  liveStat:          { flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  liveStatVal:       { fontSize: 20, fontWeight: '600' },
  liveStatLbl:       { fontSize: 9, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  card:              { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  cardTitle:         { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: theme.textSecondary, marginBottom: 10 },
  inputLabel:        { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: theme.textSecondary, marginBottom: 6 },
  input:             { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 13, color: theme.textPrimary, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  exerciseCard:      { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  exerciseHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  musclePill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  musclePillText:    { fontSize: 11, fontWeight: '500' },
  exerciseName:      { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  prWarn:            { backgroundColor: 'rgba(232,87,42,0.1)', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: theme.orange, marginBottom: 12 },
  prWarnTitle:       { fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginBottom: 3 },
  prWarnSub:         { fontSize: 11, color: theme.textSecondary, lineHeight: 17, marginBottom: 8 },
  prWarnBtns:        { flexDirection: 'row', gap: 6 },
  prWarnBtn:         { flex: 1, borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardSecondary },
  prWarnBtnText:     { fontSize: 11, fontWeight: '600', color: theme.textPrimary },
  prWarnBtnSkip:     { backgroundColor: theme.cardSecondary, borderColor: 'transparent' },
  prWarnSkipText:    { fontSize: 11, color: theme.textSecondary },
  recRow:            { backgroundColor: theme.orangeLight, borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: theme.orangeBorder },
  recText:           { fontSize: 12, color: theme.orange, fontWeight: '500' },
  lastWorkoutRow:    { flexDirection: 'row', backgroundColor: theme.cardSecondary, borderRadius: 8, padding: 8, marginBottom: 8 },
  lastWorkoutLabel:  { fontSize: 11, color: theme.textSecondary },
  lastWorkoutVal:    { fontSize: 11, color: theme.orange, fontWeight: '500', flex: 1 },
  oneRM:             { fontSize: 11, color: theme.textSecondary, marginBottom: 10 },
  setHeader:         { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setHeaderText:     { flex: 1, fontSize: 10, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  setRow:            { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  setNumber:         { fontSize: 14, color: theme.textSecondary, width: 22, textAlign: 'center' },
  setInput:          { flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 10, color: theme.textPrimary, fontSize: 15, textAlign: 'center', borderWidth: 1, borderColor: theme.border },
  addSetBtn:         { padding: 8, alignItems: 'center' },
  addSetBtnText:     { fontSize: 13, color: theme.orange, fontWeight: '500' },
  addExerciseBtn:    { backgroundColor: theme.orangeLight, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: theme.orangeBorder },
  addExerciseBtnText: { fontSize: 15, color: theme.orange, fontWeight: '500' },
  finishBtn:         { backgroundColor: theme.orange, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20 },
  finishBtnText:     { fontSize: 15, color: '#fff', fontWeight: '600' },
  restBtn:           { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardSecondary, borderWidth: 1, borderColor: theme.border },
  restBtnText:       { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  runTimerCard:      { backgroundColor: theme.card, borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: theme.green, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  runTimerLabel:     { fontSize: 10, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },
  runTimerDisplay:   { fontSize: 60, fontWeight: '300', color: theme.textPrimary, letterSpacing: -2 },
  runControlBtn:     { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 6 },
  runStartBtn:       { backgroundColor: theme.greenLight },
  runPauseBtn:       { backgroundColor: 'rgba(255,69,58,0.12)' },
  runControlBtnText: { fontSize: 15, fontWeight: '600' },
  runStatsGrid:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  runStatCard:       { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  runStatVal:        { fontSize: 16, fontWeight: '600' },
  runStatLbl:        { fontSize: 8, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  finishRunBtn:      { backgroundColor: theme.green, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  finishRunBtnText:  { fontSize: 15, fontWeight: '600', color: '#000' },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard:         { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, borderTopWidth: 1, borderColor: theme.border },
  modalTitle:        { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  saveBtn:           { backgroundColor: theme.orange, borderRadius: 14, padding: 15, alignItems: 'center' },
  saveBtnText:       { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelBtn:         { padding: 14, alignItems: 'center' },
  cancelBtnText:     { fontSize: 14, color: theme.textSecondary },
  presetChip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.cardSecondary, borderWidth: 1, borderColor: theme.border },
  presetChipText:    { fontSize: 13, color: theme.textPrimary },
});