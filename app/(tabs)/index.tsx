import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ─── Colours ────────────────────────────────────────────────────────────────
const C = {
  bg:        '#1A1614',
  card:      '#231F1C',
  cardAlt:   '#2A2522',
  orange:    '#E8572A',
  blue:      '#4A9EFF',
  green:     '#34C759',
  yellow:    '#FFD60A',
  red:       '#FF3B30',
  text:      '#F5F0EE',
  textMuted: '#8A8078',
  textDim:   '#5A5450',
  border:    '#3A3430',
};

const { width: SW } = Dimensions.get('window');

// ─── Storage Keys ───────────────────────────────────────────────────────────
const KEYS = {
  stress:     'stride_home_stress',
  sleep:      'stride_home_sleep',
  energy:     'stride_home_energy',
  habits:     'stride_home_habits',
  perfScore:  'stride_home_perf',
  journal:    'stride_home_journal',
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface HabitItem {
  id: string;
  label: string;
  done: boolean;
  icon: string;
}

interface SleepData {
  hours: number;
  quality: number; // 1–5
  bedTime: string;
  wakeTime: string;
}

interface DailyData {
  date: string;
  stress: number;       // 1–10
  energy: number;       // 1–10
  sleep: SleepData;
  habits: HabitItem[];
  journal: string;
  performanceScore: number;
}

const DEFAULT_HABITS: HabitItem[] = [
  { id: 'h1', label: 'Mobility / Dehnen',  icon: '🧘', done: false },
  { id: 'h2', label: 'Ausreichend Wasser', icon: '💧', done: false },
  { id: 'h3', label: 'Proteinziel',        icon: '🥩', done: false },
  { id: 'h4', label: 'Kein Junk Food',     icon: '🥗', done: false },
  { id: 'h5', label: 'Meditation',         icon: '🧠', done: false },
  { id: 'h6', label: 'Kalt duschen',       icon: '🚿', done: false },
];

const DEFAULT_SLEEP: SleepData = {
  hours: 7.5,
  quality: 3,
  bedTime: '23:00',
  wakeTime: '06:30',
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Stress colour interpolation ─────────────────────────────────────────────
// 1–4 = green, 5–6 = yellow, 7–8 = orange, 9–10 = red
function stressColor(val: number): string {
  if (val <= 3)  return C.green;
  if (val <= 5)  return '#A8D800';   // yellow-green
  if (val === 6) return C.yellow;
  if (val <= 7)  return '#FF9500';   // orange
  if (val <= 8)  return '#FF6B00';
  return C.red;
}

function stressLabel(val: number): string {
  if (val <= 2)  return 'Erholt';
  if (val <= 4)  return 'Entspannt';
  if (val <= 6)  return 'Moderat';
  if (val <= 8)  return 'Hoch';
  return 'Kritisch';
}

function energyLabel(val: number): string {
  if (val <= 2)  return 'Erschöpft';
  if (val <= 4)  return 'Müde';
  if (val <= 6)  return 'Normal';
  if (val <= 8)  return 'Gut';
  return 'Top-Form';
}

function sleepLabel(hours: number): string {
  if (hours < 5)  return 'Zu wenig';
  if (hours < 6.5) return 'Knapp';
  if (hours < 8)  return 'Gut';
  if (hours < 9)  return 'Optimal';
  return 'Viel';
}

function calcPerformanceScore(
  stress: number,
  energy: number,
  sleep: SleepData,
  habits: HabitItem[],
): number {
  const stressScore  = ((10 - stress) / 9) * 30;
  const energyScore  = ((energy - 1) / 9) * 25;
  const sleepScore   = Math.min(sleep.hours / 8, 1) * 25 * (sleep.quality / 5);
  const habitsDone   = habits.filter(h => h.done).length;
  const habitsScore  = (habitsDone / habits.length) * 20;
  return Math.round(stressScore + energyScore + sleepScore + habitsScore);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Continuous slider with gradient track
interface SliderProps {
  value: number;            // 1–10
  onChange: (v: number) => void;
  accentColor?: string;
}

const GradientSlider: React.FC<SliderProps> = ({ value, onChange, accentColor }) => {
  const TRACK_W  = SW - 80;
  const THUMB_R  = 14;
  const x        = useRef(new Animated.Value(((value - 1) / 9) * TRACK_W)).current;
  const trackRef = useRef<View>(null);
  const lastVal  = useRef(value);

  useEffect(() => {
    Animated.spring(x, {
      toValue: ((value - 1) / 9) * TRACK_W,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const raw = e.nativeEvent.locationX - THUMB_R;
        const clamped = Math.max(0, Math.min(TRACK_W, raw));
        x.setValue(clamped);
        const newVal = Math.round((clamped / TRACK_W) * 9) + 1;
        if (newVal !== lastVal.current) { lastVal.current = newVal; onChange(newVal); }
      },
      onPanResponderMove: (e) => {
        const raw = e.nativeEvent.locationX - THUMB_R;
        const clamped = Math.max(0, Math.min(TRACK_W, raw));
        x.setValue(clamped);
        const newVal = Math.round((clamped / TRACK_W) * 9) + 1;
        if (newVal !== lastVal.current) { lastVal.current = newVal; onChange(newVal); }
      },
    })
  ).current;

  const color = accentColor ?? stressColor(value);

  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 12 }}>
      {/* Gradient track segments */}
      <View
        ref={trackRef}
        style={{ height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}
        {...pan.panHandlers}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const segVal = i + 1;
          const segColor = stressColor(segVal);
          return (
            <View
              key={i}
              style={{ flex: 1, backgroundColor: segColor, opacity: value > segVal ? 1 : 0.22 }}
            />
          );
        })}
      </View>
      {/* Thumb */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 8,
          left: x,
          width: THUMB_R * 2,
          height: THUMB_R * 2,
          borderRadius: THUMB_R,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: C.card,
          shadowColor: color,
          shadowOpacity: 0.6,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        }}
        {...pan.panHandlers}
      />
      {/* Tick marks */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i} style={{ color: i + 1 === value ? color : C.textDim, fontSize: 10 }}>
            {i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
};

// Sleep modal
interface SleepModalProps {
  visible: boolean;
  data: SleepData;
  onSave: (d: SleepData) => void;
  onClose: () => void;
}

const SleepModal: React.FC<SleepModalProps> = ({ visible, data, onSave, onClose }) => {
  const [local, setLocal] = useState<SleepData>(data);

  useEffect(() => { setLocal(data); }, [data]);

  const qualityLabels = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Schlaf erfassen</Text>

          {/* Hours */}
          <Text style={styles.modalLabel}>Schlafdauer: {local.hours.toFixed(1)} h</Text>
          <GradientSlider
            value={Math.round(local.hours)}
            onChange={v => setLocal(p => ({ ...p, hours: v }))}
            accentColor={C.blue}
          />

          {/* Quality */}
          <Text style={[styles.modalLabel, { marginTop: 16 }]}>Schlafqualität</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map(q => (
              <TouchableOpacity
                key={q}
                onPress={() => setLocal(p => ({ ...p, quality: q }))}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: local.quality === q ? C.blue : C.cardAlt,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: C.text, fontSize: 18 }}>
                  {['😣', '😕', '😐', '🙂', '😄'][q - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            {qualityLabels[local.quality - 1]}
          </Text>

          {/* Times */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalLabel}>Eingeschlafen</Text>
              <TextInput
                style={styles.timeInput}
                value={local.bedTime}
                onChangeText={t => setLocal(p => ({ ...p, bedTime: t }))}
                placeholder="23:00"
                placeholderTextColor={C.textDim}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalLabel}>Aufgewacht</Text>
              <TextInput
                style={styles.timeInput}
                value={local.wakeTime}
                onChangeText={t => setLocal(p => ({ ...p, wakeTime: t }))}
                placeholder="06:30"
                placeholderTextColor={C.textDim}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.cardAlt }]} onPress={onClose}>
              <Text style={{ color: C.textMuted }}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.blue, flex: 2 }]} onPress={() => { onSave(local); onClose(); }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Journal modal
interface JournalModalProps {
  visible: boolean;
  text: string;
  onSave: (t: string) => void;
  onClose: () => void;
}

const JournalModal: React.FC<JournalModalProps> = ({ visible, text, onSave, onClose }) => {
  const [local, setLocal] = useState(text);
  useEffect(() => { setLocal(text); }, [text]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>Tagesnotiz</Text>
          <TextInput
            style={styles.journalInput}
            multiline
            value={local}
            onChangeText={setLocal}
            placeholder="Wie war der Tag? Was ist aufgefallen? Gedanken zum Training…"
            placeholderTextColor={C.textDim}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.cardAlt }]} onPress={onClose}>
              <Text style={{ color: C.textMuted }}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.orange, flex: 2 }]} onPress={() => { onSave(local); onClose(); }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Circular progress ring (pure RN, no SVG dep needed here)
interface RingProps {
  score: number;
  size?: number;
}
const ScoreRing: React.FC<RingProps> = ({ score, size = 120 }) => {
  const ringColor = score >= 75 ? C.green : score >= 50 ? C.yellow : score >= 30 ? '#FF9500' : C.red;
  const label     = score >= 75 ? 'Sehr gut' : score >= 50 ? 'Gut' : score >= 30 ? 'Mäßig' : 'Schlecht';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: C.border,
      }} />
      {/* Progress arc via rotation trick: two half-covers */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: ringColor,
        borderRightColor: score < 50 ? 'transparent' : ringColor,
        borderBottomColor: score < 25 ? 'transparent' : ringColor,
        borderLeftColor: score < 75 ? 'transparent' : ringColor,
        transform: [{ rotate: '-45deg' }],
      }} />
      {/* Score text */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '700' }}>{score}</Text>
        <Text style={{ color: ringColor, fontSize: 11, fontWeight: '600', marginTop: -2 }}>{label}</Text>
      </View>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const today = todayKey();

  const [stress,       setStressRaw]   = useState(4);
  const [energy,       setEnergyRaw]   = useState(7);
  const [sleep,        setSleepRaw]    = useState<SleepData>(DEFAULT_SLEEP);
  const [habits,       setHabitsRaw]   = useState<HabitItem[]>(DEFAULT_HABITS);
  const [journal,      setJournalRaw]  = useState('');
  const [perfScore,    setPerfScore]   = useState(0);

  const [showSleep,    setShowSleep]   = useState(false);
  const [showJournal,  setShowJournal] = useState(false);
  const [loaded,       setLoaded]      = useState(false);

  // Persist helpers
  const persist = useCallback(async (key: string, value: unknown) => {
    await AsyncStorage.setItem(key + '_' + today, JSON.stringify(value));
  }, [today]);

  // Load today's data on mount
  useEffect(() => {
    (async () => {
      try {
        const [s, e, sl, h, j] = await Promise.all([
          AsyncStorage.getItem(KEYS.stress  + '_' + today),
          AsyncStorage.getItem(KEYS.energy  + '_' + today),
          AsyncStorage.getItem(KEYS.sleep   + '_' + today),
          AsyncStorage.getItem(KEYS.habits  + '_' + today),
          AsyncStorage.getItem(KEYS.journal + '_' + today),
        ]);
        if (s)  setStressRaw(JSON.parse(s));
        if (e)  setEnergyRaw(JSON.parse(e));
        if (sl) setSleepRaw(JSON.parse(sl));
        if (h)  setHabitsRaw(JSON.parse(h));
        if (j)  setJournalRaw(JSON.parse(j));
      } catch {}
      setLoaded(true);
    })();
  }, [today]);

  // Recalculate performance score whenever inputs change
  useEffect(() => {
    if (!loaded) return;
    const s = calcPerformanceScore(stress, energy, sleep, habits);
    setPerfScore(s);
    persist(KEYS.perfScore, s);
  }, [stress, energy, sleep, habits, loaded]);

  const setStress = (v: number) => { setStressRaw(v); persist(KEYS.stress, v); };
  const setEnergy = (v: number) => { setEnergyRaw(v); persist(KEYS.energy, v); };
  const setSleep  = (d: SleepData) => { setSleepRaw(d); persist(KEYS.sleep, d); };
  const setJournal = (t: string) => { setJournalRaw(t); persist(KEYS.journal, t); };
  const toggleHabit = (id: string) => {
    const updated = habits.map(h => h.id === id ? { ...h, done: !h.done } : h);
    setHabitsRaw(updated);
    persist(KEYS.habits, updated);
  };

  const habitsDone    = habits.filter(h => h.done).length;
  const stressCol     = stressColor(stress);
  const dateLabel     = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.textMuted }}>Lade…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerDate}>{dateLabel}</Text>
            <Text style={styles.headerTitle}>Guten Morgen 👋</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowJournal(true)}
            style={styles.journalBtn}
          >
            <Text style={{ fontSize: 18 }}>📓</Text>
            {journal.length > 0 && <View style={styles.journalDot} />}
          </TouchableOpacity>
        </View>

        {/* ── Performance Score ── */}
        <View style={styles.scoreCard}>
          <ScoreRing score={perfScore} size={130} />
          <View style={{ flex: 1, paddingLeft: 20 }}>
            <Text style={styles.cardLabel}>Performance Score</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
              Basierend auf Stress, Energie, Schlaf und Habits
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <ScorePill label="Stress"  value={`${stress}/10`}  color={stressCol} />
              <ScorePill label="Energie" value={`${energy}/10`}  color={C.blue} />
              <ScorePill label="Schlaf"  value={`${sleep.hours}h`} color={C.green} />
              <ScorePill label="Habits"  value={`${habitsDone}/${habits.length}`} color={C.orange} />
            </View>
          </View>
        </View>

        {/* ── Stress Widget ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>Stresslevel</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                Manuell · HRV-Integration folgt
              </Text>
            </View>
            <View style={styles.stressBadge}>
              <Text style={[styles.stressNumber, { color: stressCol }]}>{stress}</Text>
              <Text style={[styles.stressLabelText, { color: stressCol }]}>{stressLabel(stress)}</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <GradientSlider value={stress} onChange={setStress} />
          </View>

          {/* Stress context hints */}
          <View style={[styles.stressHint, { borderLeftColor: stressCol }]}>
            <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
              {stress <= 3 && '✅ Optimal. Intensives Training ist heute möglich.'}
              {stress === 4 && '✅ Guter Ausgangszustand. Normales Training empfohlen.'}
              {stress === 5 && '🟡 Leicht erhöht. Auf Körpersignale achten.'}
              {stress === 6 && '🟡 Moderat. Volumen ggf. reduzieren.'}
              {stress === 7 && '🟠 Erhöht. Leichteres Training oder aktive Erholung.'}
              {stress === 8 && '🟠 Hoch. Regeneration priorisieren.'}
              {stress >= 9 && '🔴 Kritisch. Rest Day empfohlen — kein intensives Training.'}
            </Text>
          </View>
        </View>

        {/* ── Energy ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>Energielevel</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>Subjektiv</Text>
            </View>
            <View style={styles.stressBadge}>
              <Text style={[styles.stressNumber, { color: C.blue }]}>{energy}</Text>
              <Text style={[styles.stressLabelText, { color: C.blue }]}>{energyLabel(energy)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <EnergySlider value={energy} onChange={setEnergy} />
          </View>
        </View>

        {/* ── Sleep ── */}
        <TouchableOpacity style={styles.card} onPress={() => setShowSleep(true)} activeOpacity={0.8}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>Schlaf</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                {sleep.bedTime} → {sleep.wakeTime}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.green, fontSize: 26, fontWeight: '700' }}>
                {sleep.hours.toFixed(1)}h
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>{sleepLabel(sleep.hours)}</Text>
            </View>
          </View>

          {/* Sleep quality stars */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <View key={s} style={{
                flex: 1, height: 6, borderRadius: 3,
                backgroundColor: s <= sleep.quality ? C.blue : C.border,
              }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: C.textDim, fontSize: 11 }}>Qualität</Text>
            <Text style={{ color: C.textMuted, fontSize: 11 }}>
              {['Sehr schlecht','Schlecht','Okay','Gut','Sehr gut'][sleep.quality - 1]} · Tippen zum Bearbeiten
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Habits ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>Habits</Text>
            <Text style={{ color: habitsDone === habits.length ? C.green : C.textMuted, fontSize: 13 }}>
              {habitsDone}/{habits.length} ✓
            </Text>
          </View>

          {/* Progress bar */}
          <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 10, marginBottom: 14 }}>
            <View style={{
              height: 4, borderRadius: 2, backgroundColor: C.orange,
              width: `${(habitsDone / habits.length) * 100}%`,
            }} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {habits.map(h => (
              <TouchableOpacity
                key={h.id}
                onPress={() => toggleHabit(h.id)}
                style={[styles.habitChip, { borderColor: h.done ? C.green : C.border, backgroundColor: h.done ? '#34C75920' : C.cardAlt }]}
              >
                <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                <Text style={{ color: h.done ? C.green : C.textMuted, fontSize: 12, marginLeft: 6 }}>
                  {h.label}
                </Text>
                {h.done && <Text style={{ color: C.green, marginLeft: 4, fontSize: 12 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Journal preview ── */}
        {journal.length > 0 && (
          <TouchableOpacity style={styles.journalCard} onPress={() => setShowJournal(true)} activeOpacity={0.8}>
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>📓 TAGESNOTIZ</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
              {journal}
            </Text>
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 8 }}>Tippen zum Bearbeiten</Text>
          </TouchableOpacity>
        )}

        {journal.length === 0 && (
          <TouchableOpacity style={[styles.journalCard, { borderStyle: 'dashed' }]} onPress={() => setShowJournal(true)}>
            <Text style={{ color: C.textDim, fontSize: 13, textAlign: 'center' }}>
              📓  Tagesnotiz hinzufügen…
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <SleepModal
        visible={showSleep}
        data={sleep}
        onSave={setSleep}
        onClose={() => setShowSleep(false)}
      />
      <JournalModal
        visible={showJournal}
        text={journal}
        onSave={setJournal}
        onClose={() => setShowJournal(false)}
      />
    </View>
  );
}

// Simple score pill
const ScorePill: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={{ backgroundColor: `${color}18`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
    <Text style={{ color: C.textDim, fontSize: 10 }}>{label}</Text>
    <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{value}</Text>
  </View>
);

// Energy-specific slider (blue gradient)
const EnergySlider: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const TRACK_W = SW - 80;
  const THUMB_R = 14;
  const x = useRef(new Animated.Value(((value - 1) / 9) * TRACK_W)).current;
  const lastVal = useRef(value);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const raw = e.nativeEvent.locationX - THUMB_R;
        const clamped = Math.max(0, Math.min(TRACK_W, raw));
        x.setValue(clamped);
        const nv = Math.round((clamped / TRACK_W) * 9) + 1;
        if (nv !== lastVal.current) { lastVal.current = nv; onChange(nv); }
      },
      onPanResponderMove: (e) => {
        const raw = e.nativeEvent.locationX - THUMB_R;
        const clamped = Math.max(0, Math.min(TRACK_W, raw));
        x.setValue(clamped);
        const nv = Math.round((clamped / TRACK_W) * 9) + 1;
        if (nv !== lastVal.current) { lastVal.current = nv; onChange(nv); }
      },
    })
  ).current;

  const energyColors = [
    '#FF3B30','#FF6B00','#FF9500','#FFD60A','#A8D800',
    '#34C759','#34C759','#4A9EFF','#4A9EFF','#007AFF',
  ];

  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 12 }}>
      <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }} {...pan.panHandlers}>
        {energyColors.map((col, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: col, opacity: value > i ? 1 : 0.22 }} />
        ))}
      </View>
      <Animated.View
        style={{
          position: 'absolute', top: 8, left: x,
          width: THUMB_R * 2, height: THUMB_R * 2, borderRadius: THUMB_R,
          backgroundColor: energyColors[value - 1] ?? C.blue,
          borderWidth: 3, borderColor: C.card,
          shadowColor: C.blue, shadowOpacity: 0.5, shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 }, elevation: 6,
        }}
        {...pan.panHandlers}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i} style={{ color: i + 1 === value ? energyColors[i] : C.textDim, fontSize: 10 }}>
            {i + 1}
          </Text>
        ))}
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerDate: {
    color: C.textMuted,
    fontSize: 13,
  },
  headerTitle: {
    color: C.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  journalBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.orange,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '600',
  },
  cardLabel: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stressBadge: {
    alignItems: 'flex-end',
  },
  stressNumber: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  stressLabelText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  stressHint: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  journalCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalLabel: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  timeInput: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  journalInput: {
    backgroundColor: C.cardAlt,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 140,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.border,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});