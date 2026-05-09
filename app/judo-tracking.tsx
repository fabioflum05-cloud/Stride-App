import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, AppStateStatus,
  Dimensions, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────
// 1. Copy this entire file to app/judo-tracking.tsx  (or paste components into training.tsx)
// 2. In training.tsx, add to imports:
//      import { JudoTrackingScreen } from './judo-tracking';
// 3. In training.tsx, add state:
//      const [showJudo, setShowJudo] = useState(false);
// 4. In training.tsx JSX, add before <ScrollView>:
//      {showJudo && <JudoTrackingScreen onClose={() => setShowJudo(false)} />}
// 5. In training.tsx Quick Actions grid, add:
//      { label: 'Judo', icon: <Text style={{fontSize:22}}>🥋</Text>, onPress: () => setShowJudo(true) }
// ─────────────────────────────────────────────────────────────────────────────

const SW = Dimensions.get('window').width;

const theme = {
  bg:            '#1A1614',
  card:          '#231F1C',
  cardSecondary: '#2E2825',
  border:        'rgba(255,255,255,0.07)' as string,
  orange:        '#E8572A',
  orangeLight:   'rgba(232,87,42,0.15)' as string,
  orangeBorder:  'rgba(232,87,42,0.25)' as string,
  blue:          '#4A9EFF',
  blueLight:     'rgba(74,158,255,0.12)' as string,
  green:         '#34C759',
  greenLight:    'rgba(52,199,89,0.12)' as string,
  red:           '#FF453A',
  redLight:      'rgba(255,69,58,0.12)' as string,
  yellow:        '#FFD60A',
  yellowLight:   'rgba(255,214,10,0.12)' as string,
  textPrimary:   '#F5F0EE',
  textSecondary: 'rgba(245,240,238,0.45)' as string,
  textTertiary:  'rgba(245,240,238,0.22)' as string,
};

// ─── Types ────────────────────────────────────────────────────
export type JudoSessionType = 'randori' | 'kata' | 'newaza' | 'wettkampf' | 'uchi_komi' | 'nage_komi';
export type JudoResult = 'sieg' | 'niederlage' | 'unentschieden' | 'n/a';
export type OpponentLevel = 'anfaenger' | 'fortgeschritten' | 'gleich' | 'staerker' | 'viel_staerker';

export type JudoRound = {
  result: JudoResult;
  opponentLevel: OpponentLevel;
  opponentWeight?: string; // kg
  duration: number;        // seconds
  notes: string;
  techniques: string[];
  ippon: boolean;
  wazari: boolean;
  shido: number;           // penalties received
};

export type JudoSession = {
  id: string;
  date: string;
  type: JudoSessionType;
  totalDuration: number;   // minutes
  rounds: JudoRound[];
  weightClass: string;
  trainingPartner?: string;
  location?: string;
  intensity: number;       // 1-5
  notes: string;
  score: number;           // calculated performance score
};

// ─── Constants ───────────────────────────────────────────────
const SESSION_TYPES: { key: JudoSessionType; label: string; emoji: string; desc: string }[] = [
  { key: 'randori',    label: 'Randori',     emoji: '🥋', desc: 'Freies Sparring' },
  { key: 'newaza',     label: 'Newaza',      emoji: '🤼', desc: 'Bodenarbeit' },
  { key: 'uchi_komi',  label: 'Uchi-Komi',  emoji: '🔄', desc: 'Einübungen / Wiederholungen' },
  { key: 'nage_komi',  label: 'Nage-Komi',  emoji: '⬇️', desc: 'Wurf-Wiederholungen' },
  { key: 'kata',       label: 'Kata',        emoji: '🎌', desc: 'Formübungen' },
  { key: 'wettkampf',  label: 'Wettkampf',  emoji: '🏆', desc: 'Turniertraining / Match' },
];

const OPPONENT_LEVELS: { key: OpponentLevel; label: string; color: string }[] = [
  { key: 'anfaenger',    label: 'Anfänger',       color: theme.green },
  { key: 'fortgeschritten', label: 'Fortgeschritten', color: theme.blue },
  { key: 'gleich',       label: 'Gleichstark',    color: theme.orange },
  { key: 'staerker',     label: 'Stärker',        color: '#FF9500' },
  { key: 'viel_staerker',label: 'Viel stärker',   color: theme.red },
];

const WEIGHT_CLASSES = ['-55kg','-60kg','-66kg','-73kg','-81kg','-90kg','-100kg','+100kg'];

const COMMON_TECHNIQUES = [
  // Nage-waza (Würfe)
  'O-soto-gari', 'O-uchi-gari', 'Seoi-nage', 'Tai-otoshi', 'Uchi-mata',
  'Harai-goshi', 'Morote-seoi-nage', 'Ippon-seoi-nage', 'Ko-uchi-gari',
  'De-ashi-barai', 'Tomoe-nage', 'Sumi-gaeshi', 'Tani-otoshi',
  // Newaza (Boden)
  'Kesa-gatame', 'Tate-shiho-gatame', 'Juji-gatame', 'Okuri-eri-jime',
  'Hadaka-jime', 'Ude-garami', 'Kami-shiho-gatame',
];

const RESULT_CONFIG: Record<JudoResult, { label: string; color: string; emoji: string }> = {
  sieg:         { label: 'Sieg',         color: theme.green,  emoji: '✅' },
  niederlage:   { label: 'Niederlage',   color: theme.red,    emoji: '❌' },
  unentschieden:{ label: 'Unentschieden',color: theme.orange, emoji: '🤝' },
  'n/a':        { label: 'N/A',          color: theme.textSecondary, emoji: '—' },
};

// ─── Helpers ─────────────────────────────────────────────────
function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Heute, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function calcJudoScore(session: Omit<JudoSession, 'score'>): number {
  if (session.rounds.length === 0) return 0;
  const wins = session.rounds.filter(r => r.result === 'sieg').length;
  const total = session.rounds.filter(r => r.result !== 'n/a').length;
  const winRate = total > 0 ? wins / total : 0.5;
  const ipponBonus = session.rounds.filter(r => r.ippon).length * 5;
  const strongOpponentBonus = session.rounds.filter(
    r => r.opponentLevel === 'staerker' || r.opponentLevel === 'viel_staerker'
  ).length * 3;
  const techniqueBonus = Math.min(10, session.rounds.reduce((s,r) => s + r.techniques.length, 0));
  const durationScore = Math.min(20, session.totalDuration / 3);
  const intensityScore = session.intensity * 4;
  const base = winRate * 40 + ipponBonus + strongOpponentBonus + techniqueBonus + durationScore + intensityScore;
  return Math.min(100, Math.round(base));
}

// ─── Icons ───────────────────────────────────────────────────
function IconClose({ color = theme.textPrimary, size = 16 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconChevronLeft({ color = theme.textPrimary, size = 20 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconChevronRight({ color = theme.textTertiary, size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9 18L15 12L9 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}
function IconPlus({ color = theme.orange, size = 18 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 5V19M5 12H19" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconTrash({ color = theme.red, size = 16 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconCheck({ color = theme.green, size = 14 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 6L9 17L4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconTrophy({ color = '#FFD700', size = 20 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4C3.45 9 3 8.55 3 8V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V8C21 8.55 20.55 9 20 9H18M6 9C6 13 9 17 12 17C15 17 18 13 18 9M6 9H18M12 17V21M8 21H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

// ─── Timer Hook ───────────────────────────────────────────────
function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const STORE_KEY = 'judoSessionTimer';

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then(raw => {
      if (!raw) return;
      try {
        const { startedAt } = JSON.parse(raw);
        if (startedAt) {
          startAtRef.current = startedAt;
          setSeconds(Math.floor((Date.now() - startedAt) / 1000));
          setIsRunning(true);
        }
      } catch {}
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && startAtRef.current)
        setSeconds(Math.floor((Date.now() - startAtRef.current) / 1000));
    });
    return () => { sub.remove(); clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startAtRef.current) setSeconds(Math.floor((Date.now() - startAtRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  async function start() {
    const now = Date.now();
    startAtRef.current = now;
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ startedAt: now }));
    setIsRunning(true);
  }

  async function stop(): Promise<number> {
    const dur = startAtRef.current ? Math.max(1, Math.round((Date.now() - startAtRef.current) / 60000)) : 1;
    clearInterval(intervalRef.current);
    startAtRef.current = null;
    setIsRunning(false);
    setSeconds(0);
    await AsyncStorage.removeItem(STORE_KEY);
    return dur;
  }

  return { seconds, isRunning, start, stop };
}

// ─── RoundEntryModal ─────────────────────────────────────────
function RoundEntryModal({
  onSave, onClose, roundNumber,
}: {
  onSave: (round: JudoRound) => void;
  onClose: () => void;
  roundNumber: number;
}) {
  const [result, setResult] = useState<JudoResult>('n/a');
  const [opponentLevel, setOpponentLevel] = useState<OpponentLevel>('gleich');
  const [opponentWeight, setOpponentWeight] = useState('');
  const [duration, setDuration] = useState('5');
  const [notes, setNotes] = useState('');
  const [techniques, setTechniques] = useState<string[]>([]);
  const [ippon, setIppon] = useState(false);
  const [wazari, setWazari] = useState(false);
  const [shido, setShido] = useState(0);
  const [customTechnique, setCustomTechnique] = useState('');

  function toggleTechnique(t: string) {
    setTechniques(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function save() {
    onSave({
      result, opponentLevel, opponentWeight,
      duration: (parseInt(duration) || 5) * 60,
      notes, techniques, ippon, wazari, shido,
    });
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.orange, marginBottom: 2 }}>Runde {roundNumber}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.textPrimary }}>Kampf eintragen</Text>
            </View>
            <TouchableOpacity style={judo.closeBtn} onPress={onClose}><IconClose size={15} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 20 }}>

            {/* Result */}
            <View>
              <Text style={judo.sectionLabel}>Ergebnis</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['sieg','unentschieden','niederlage'] as JudoResult[]).map(r => {
                  const cfg = RESULT_CONFIG[r];
                  const active = result === r;
                  return (
                    <TouchableOpacity key={r} onPress={() => setResult(r)} activeOpacity={0.8}
                      style={{ flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
                        backgroundColor: active ? cfg.color + '22' : theme.cardSecondary,
                        borderWidth: 1.5, borderColor: active ? cfg.color : theme.border }}>
                      <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? cfg.color : theme.textSecondary }}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Scoring */}
            <View>
              <Text style={judo.sectionLabel}>Wertungen</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => { setIppon(!ippon); if (!ippon) setWazari(false); }} activeOpacity={0.8}
                  style={{ flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
                    backgroundColor: ippon ? 'rgba(255,214,10,0.15)' : theme.cardSecondary,
                    borderWidth: 1.5, borderColor: ippon ? theme.yellow : theme.border }}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: ippon ? theme.yellow : theme.textSecondary }}>Ippon</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setWazari(!wazari); if (!wazari) setIppon(false); }} activeOpacity={0.8}
                  style={{ flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
                    backgroundColor: wazari ? theme.blueLight : theme.cardSecondary,
                    borderWidth: 1.5, borderColor: wazari ? theme.blue : theme.border }}>
                  <Text style={{ fontSize: 22 }}>💙</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: wazari ? theme.blue : theme.textSecondary }}>Waza-ari</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
                  backgroundColor: shido > 0 ? theme.redLight : theme.cardSecondary,
                  borderWidth: 1.5, borderColor: shido > 0 ? theme.red : theme.border }}>
                  <Text style={{ fontSize: 22 }}>🚫</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: shido > 0 ? theme.red : theme.textSecondary }}>Shido</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => setShido(Math.max(0, shido - 1))} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '700' }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: shido > 0 ? theme.red : theme.textTertiary, minWidth: 20, textAlign: 'center' }}>{shido}</Text>
                    <TouchableOpacity onPress={() => setShido(Math.min(3, shido + 1))} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '700' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Opponent Level */}
            <View>
              <Text style={judo.sectionLabel}>Gegner-Niveau</Text>
              <View style={{ gap: 6 }}>
                {OPPONENT_LEVELS.map(lvl => {
                  const active = opponentLevel === lvl.key;
                  return (
                    <TouchableOpacity key={lvl.key} onPress={() => setOpponentLevel(lvl.key)} activeOpacity={0.8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12,
                        backgroundColor: active ? lvl.color + '18' : theme.cardSecondary,
                        borderWidth: 1.5, borderColor: active ? lvl.color : theme.border }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? lvl.color : theme.border }} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: active ? theme.textPrimary : theme.textSecondary }}>{lvl.label}</Text>
                      {active && <IconCheck color={lvl.color} size={14} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Duration + Weight */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={judo.sectionLabel}>Kampfdauer (Min)</Text>
                <TextInput style={judo.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="5" placeholderTextColor={theme.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={judo.sectionLabel}>Gegner Gewicht (kg)</Text>
                <TextInput style={judo.input} value={opponentWeight} onChangeText={setOpponentWeight} keyboardType="decimal-pad" placeholder="z.B. 68" placeholderTextColor={theme.textTertiary} />
              </View>
            </View>

            {/* Techniques */}
            <View>
              <Text style={judo.sectionLabel}>Techniken ({techniques.length})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                {COMMON_TECHNIQUES.map(t => {
                  const active = techniques.includes(t);
                  return (
                    <TouchableOpacity key={t} onPress={() => toggleTechnique(t)} activeOpacity={0.8}
                      style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: active ? theme.orangeLight : theme.cardSecondary,
                        borderWidth: 1, borderColor: active ? theme.orange : theme.border }}>
                      <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? theme.orange : theme.textSecondary }}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[judo.input, { flex: 1, marginBottom: 0 }]} value={customTechnique} onChangeText={setCustomTechnique} placeholder="Eigene Technik..." placeholderTextColor={theme.textTertiary} />
                <TouchableOpacity onPress={() => { if (customTechnique.trim()) { toggleTechnique(customTechnique.trim()); setCustomTechnique(''); } }}
                  style={{ width: 46, borderRadius: 12, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center' }}>
                  <IconPlus color="#fff" size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes */}
            <View>
              <Text style={judo.sectionLabel}>Notizen</Text>
              <TextInput style={[judo.input, { height: 80, textAlignVertical: 'top' }]}
                value={notes} onChangeText={setNotes} multiline
                placeholder="Was lief gut? Was verbessern? Spezifische Situationen..." placeholderTextColor={theme.textTertiary} />
            </View>

            <TouchableOpacity style={judo.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={judo.saveBtnText}>Kampf speichern ✓</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── ActiveJudoSession ────────────────────────────────────────
function ActiveJudoSession({
  sessionType, onFinish, onDiscard,
}: {
  sessionType: JudoSessionType;
  onFinish: (data: { rounds: JudoRound[]; duration: number; intensity: number; notes: string; weightClass: string; location: string }) => void;
  onDiscard: () => void;
}) {
  const timer = useSessionTimer();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [rounds, setRounds] = useState<JudoRound[]>([]);
  const [showRoundEntry, setShowRoundEntry] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [sessionNotes, setSessionNotes] = useState('');
  const [weightClass, setWeightClass] = useState('-66kg');
  const [location, setLocation] = useState('');

  const typeConfig = SESSION_TYPES.find(t => t.key === sessionType)!;
  const isRandori = sessionType === 'randori' || sessionType === 'newaza' || sessionType === 'wettkampf';

  useEffect(() => {
    timer.start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.015, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  function addRound(round: JudoRound) {
    setRounds(prev => [...prev, round]);
    setShowRoundEntry(false);
  }

  async function handleFinish() {
    const duration = await timer.stop();
    onFinish({ rounds, duration, intensity, notes: sessionNotes, weightClass, location });
  }

  const wins = rounds.filter(r => r.result === 'sieg').length;
  const losses = rounds.filter(r => r.result === 'niederlage').length;
  const draws = rounds.filter(r => r.result === 'unentschieden').length;
  const ippons = rounds.filter(r => r.ippon).length;

  return (
    <>
      {showRoundEntry && (
        <RoundEntryModal roundNumber={rounds.length + 1} onSave={addRound} onClose={() => setShowRoundEntry(false)} />
      )}
      <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: theme.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.orange, marginBottom: 3 }}>
                {typeConfig.emoji} {typeConfig.label} · Aktiv
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary }}>Session läuft</Text>
            </View>
            <Animated.View style={[judo.timerBadge, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={judo.timerText}>{formatTime(timer.seconds)}</Text>
              <Text style={judo.timerLabel}>TIMER</Text>
            </Animated.View>
          </View>
          {/* Live stats */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { val: rounds.length, lbl: 'Kämpfe', color: theme.orange },
              { val: wins, lbl: 'Siege', color: theme.green },
              { val: losses, lbl: 'Niederlagen', color: theme.red },
              { val: ippons, lbl: 'Ippons', color: theme.yellow },
            ].map(stat => (
              <View key={stat.lbl} style={{ flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: stat.color }}>{stat.val}</Text>
                <Text style={{ fontSize: 8, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{stat.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {/* Weight class */}
          <View>
            <Text style={judo.sectionLabel}>Gewichtsklasse</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {WEIGHT_CLASSES.map(wc => (
                  <TouchableOpacity key={wc} onPress={() => setWeightClass(wc)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: weightClass === wc ? theme.orangeLight : theme.card,
                      borderWidth: 1.5, borderColor: weightClass === wc ? theme.orange : theme.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: weightClass === wc ? theme.orange : theme.textSecondary }}>{wc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Location */}
          <View>
            <Text style={judo.sectionLabel}>Ort (optional)</Text>
            <TextInput style={judo.input} value={location} onChangeText={setLocation} placeholder="z.B. Judo Club Zürich" placeholderTextColor={theme.textTertiary} />
          </View>

          {/* Rounds list */}
          {rounds.length > 0 && (
            <View>
              <Text style={judo.sectionLabel}>Kämpfe ({rounds.length})</Text>
              <View style={{ gap: 8 }}>
                {rounds.map((round, i) => {
                  const rc = RESULT_CONFIG[round.result];
                  const lvl = OPPONENT_LEVELS.find(l => l.key === round.opponentLevel)!;
                  return (
                    <View key={i} style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: rc.color + '30', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: rc.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{rc.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                          Runde {i + 1} · <Text style={{ color: rc.color }}>{rc.label}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                          {lvl.label}{round.ippon ? ' · ⚡ Ippon' : round.wazari ? ' · 💙 Waza-ari' : ''}{round.techniques.length > 0 ? ` · ${round.techniques.slice(0,2).join(', ')}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setRounds(prev => prev.filter((_,idx) => idx !== i))}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.redLight, alignItems: 'center', justifyContent: 'center' }}>
                        <IconTrash size={13} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Add round button */}
          {isRandori && (
            <TouchableOpacity style={judo.addRoundBtn} onPress={() => setShowRoundEntry(true)} activeOpacity={0.85}>
              <IconPlus size={18} />
              <Text style={judo.addRoundBtnText}>Kampf hinzufügen</Text>
            </TouchableOpacity>
          )}

          {/* Intensity */}
          <View>
            <Text style={judo.sectionLabel}>Intensität</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1,2,3,4,5].map(i => (
                <TouchableOpacity key={i} onPress={() => setIntensity(i)} activeOpacity={0.8}
                  style={{ flex: 1, borderRadius: 12, padding: 12, alignItems: 'center',
                    backgroundColor: intensity >= i ? theme.orange + '22' : theme.card,
                    borderWidth: 1.5, borderColor: intensity >= i ? theme.orange : theme.border }}>
                  <Text style={{ fontSize: 18 }}>{['😴','🙂','💪','🔥','⚡'][i-1]}</Text>
                  <Text style={{ fontSize: 9, color: intensity >= i ? theme.orange : theme.textTertiary, fontWeight: '600', marginTop: 3 }}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Session notes */}
          <View>
            <Text style={judo.sectionLabel}>Session Notizen</Text>
            <TextInput style={[judo.input, { height: 80, textAlignVertical: 'top' }]}
              value={sessionNotes} onChangeText={setSessionNotes} multiline
              placeholder="Allgemeine Notizen zur heutigen Session..." placeholderTextColor={theme.textTertiary} />
          </View>

          {/* Finish */}
          <TouchableOpacity style={judo.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={judo.finishBtnText}>Session abschliessen 🥋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={() => Alert.alert('Session verwerfen', 'Wirklich abbrechen ohne zu speichern?', [
            { text: 'Weitermachen', style: 'cancel' },
            { text: 'Verwerfen', style: 'destructive', onPress: onDiscard },
          ])}>
            <Text style={{ fontSize: 13, color: theme.textTertiary }}>Session verwerfen</Text>
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </>
  );
}

// ─── JudoSessionDetail ────────────────────────────────────────
function JudoSessionDetail({ session, onClose }: { session: JudoSession; onClose: () => void }) {
  const typeConfig = SESSION_TYPES.find(t => t.key === session.type)!;
  const wins = session.rounds.filter(r => r.result === 'sieg').length;
  const losses = session.rounds.filter(r => r.result === 'niederlage').length;
  const ippons = session.rounds.filter(r => r.ippon).length;
  const allTechniques = [...new Set(session.rounds.flatMap(r => r.techniques))];

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Header */}
        <View style={{ backgroundColor: theme.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <TouchableOpacity style={judo.closeBtn} onPress={onClose}><IconChevronLeft size={20} /></TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.orange, marginBottom: 3 }}>
                {typeConfig.emoji} {typeConfig.label} · {formatDateLabel(session.date)}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary }}>
                {session.location || 'Judo Session'}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                {session.weightClass} · {session.totalDuration} Min
              </Text>
            </View>
            <View style={{ backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.orangeBorder }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.orange }}>⚡ {session.score}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { val: session.rounds.length, lbl: 'Kämpfe', color: theme.orange },
              { val: wins, lbl: 'Siege', color: theme.green },
              { val: losses, lbl: 'Niederlagen', color: theme.red },
              { val: ippons, lbl: 'Ippons', color: theme.yellow },
            ].map(stat => (
              <View key={stat.lbl} style={{ flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 10, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: stat.color }}>{stat.val}</Text>
                <Text style={{ fontSize: 8, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{stat.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Rounds */}
          {session.rounds.length > 0 && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.border }}>
              <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>Kämpfe</Text>
              </View>
              {session.rounds.map((round, i) => {
                const rc = RESULT_CONFIG[round.result];
                const lvl = OPPONENT_LEVELS.find(l => l.key === round.opponentLevel)!;
                return (
                  <View key={i} style={{ padding: 14, borderBottomWidth: i < session.rounds.length - 1 ? 0.5 : 0, borderBottomColor: theme.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: round.notes || round.techniques.length > 0 ? 8 : 0 }}>
                      <Text style={{ fontSize: 18 }}>{rc.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                          Runde {i + 1} · <Text style={{ color: rc.color }}>{rc.label}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: lvl.color, marginTop: 2 }}>{lvl.label}{round.opponentWeight ? ` · ${round.opponentWeight}kg` : ''}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {round.ippon && <View style={{ backgroundColor: 'rgba(255,214,10,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: 10, color: theme.yellow, fontWeight: '700' }}>⚡ Ippon</Text></View>}
                        {round.wazari && <View style={{ backgroundColor: theme.blueLight, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: 10, color: theme.blue, fontWeight: '700' }}>Waza-ari</Text></View>}
                        {round.shido > 0 && <View style={{ backgroundColor: theme.redLight, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ fontSize: 10, color: theme.red, fontWeight: '700' }}>{round.shido}× Shido</Text></View>}
                      </View>
                    </View>
                    {round.techniques.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: round.notes ? 8 : 0 }}>
                        {round.techniques.map(t => (
                          <View key={t} style={{ backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: theme.orangeBorder }}>
                            <Text style={{ fontSize: 11, color: theme.orange, fontWeight: '500' }}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {round.notes ? <Text style={{ fontSize: 12, color: theme.textSecondary, fontStyle: 'italic' }}>"{round.notes}"</Text> : null}
                  </View>
                );
              })}
            </View>
          )}

          {/* Technique Summary */}
          {allTechniques.length > 0 && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 }}>Verwendete Techniken</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {allTechniques.map(t => {
                  const count = session.rounds.filter(r => r.techniques.includes(t)).length;
                  return (
                    <View key={t} style={{ backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: theme.orangeBorder, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: theme.orange, fontWeight: '600' }}>{t}</Text>
                      {count > 1 && <View style={{ backgroundColor: theme.orange, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>{count}</Text></View>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Session Notes */}
          {session.notes ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.textTertiary, marginBottom: 8 }}>Notizen</Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>{session.notes}</Text>
            </View>
          ) : null}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── JudoHistoryView ──────────────────────────────────────────
function JudoHistoryView({ sessions, onSelect, onDelete }: {
  sessions: JudoSession[];
  onSelect: (s: JudoSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
        <Text style={{ fontSize: 40 }}>🥋</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>Noch keine Judo Sessions</Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 40 }}>Starte deine erste Session und tracke deine Kämpfe, Techniken und Fortschritte.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {sessions.map((session, i) => {
        const typeConfig = SESSION_TYPES.find(t => t.key === session.type)!;
        const wins = session.rounds.filter(r => r.result === 'sieg').length;
        const losses = session.rounds.filter(r => r.result === 'niederlage').length;
        const ippons = session.rounds.filter(r => r.ippon).length;

        return (
          <TouchableOpacity key={session.id} onPress={() => onSelect(session)} activeOpacity={0.88}
            style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 18 }}>{typeConfig.emoji}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.blue, textTransform: 'uppercase', letterSpacing: 0.4 }}>{typeConfig.label}</Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatDateLabel(session.date)}</Text>
              <View style={{ marginLeft: 'auto' as any, backgroundColor: theme.orangeLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.orangeBorder }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.orange }}>⚡ {session.score}</Text>
              </View>
              <TouchableOpacity onPress={e => { e.stopPropagation?.(); onDelete(session.id); }}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.redLight, alignItems: 'center', justifyContent: 'center' }}>
                <IconTrash size={12} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3, marginBottom: 8 }}>
              {session.location || typeConfig.label + ' Session'} · {session.weightClass}
            </Text>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[
                { val: session.rounds.length, lbl: 'Kämpfe', color: theme.orange },
                { val: wins, lbl: 'Siege', color: theme.green },
                { val: losses, lbl: 'Niederlagen', color: theme.red },
                { val: ippons, lbl: 'Ippons', color: theme.yellow },
                { val: `${session.totalDuration}m`, lbl: 'Dauer', color: theme.blue },
              ].map(stat => (
                <View key={stat.lbl} style={{ flex: 1, backgroundColor: theme.cardSecondary, borderRadius: 8, padding: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: stat.color }}>{stat.val}</Text>
                  <Text style={{ fontSize: 7, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 }}>{stat.lbl}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── JudoStatsView ────────────────────────────────────────────
function JudoStatsView({ sessions }: { sessions: JudoSession[] }) {
  if (sessions.length === 0) return null;

  const allRounds = sessions.flatMap(s => s.rounds);
  const totalRounds = allRounds.filter(r => r.result !== 'n/a').length;
  const wins = allRounds.filter(r => r.result === 'sieg').length;
  const winRate = totalRounds > 0 ? Math.round((wins / totalRounds) * 100) : 0;
  const ippons = allRounds.filter(r => r.ippon).length;
  const ipponRate = wins > 0 ? Math.round((ippons / wins) * 100) : 0;
  const totalMinutes = sessions.reduce((s, sess) => s + sess.totalDuration, 0);

  // Top techniques
  const techCount: Record<string, number> = {};
  allRounds.forEach(r => r.techniques.forEach(t => { techCount[t] = (techCount[t] || 0) + 1; }));
  const topTechs = Object.entries(techCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // Win rate by opponent level
  const winsVsStrong = allRounds.filter(r => (r.opponentLevel === 'staerker' || r.opponentLevel === 'viel_staerker') && r.result === 'sieg').length;
  const vsStrong = allRounds.filter(r => r.opponentLevel === 'staerker' || r.opponentLevel === 'viel_staerker').filter(r => r.result !== 'n/a').length;

  return (
    <View style={{ gap: 12 }}>
      <Text style={[judo.sectionLabel, { marginBottom: 0 }]}>Statistiken</Text>

      {/* Key stats */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { val: `${winRate}%`, lbl: 'Siegquote', color: theme.green },
          { val: `${ipponRate}%`, lbl: 'Ippon-Rate', color: theme.yellow },
          { val: sessions.length, lbl: 'Sessions', color: theme.orange },
          { val: `${Math.round(totalMinutes/60)}h`, lbl: 'Gesamtzeit', color: theme.blue },
        ].map(stat => (
          <View key={stat.lbl} style={{ flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: theme.border }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: stat.color }}>{stat.val}</Text>
            <Text style={{ fontSize: 9, color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3, textAlign: 'center' }}>{stat.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Win rate bar */}
      <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary }}>Ergebnis-Verteilung</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>{totalRounds} Kämpfe total</Text>
        </View>
        <View style={{ flexDirection: 'row', borderRadius: 6, overflow: 'hidden', height: 10 }}>
          {wins > 0 && <View style={{ flex: wins, backgroundColor: theme.green }} />}
          {draws > 0 && <View style={{ flex: draws, backgroundColor: theme.orange }} />}
          {(totalRounds - wins - draws) > 0 && <View style={{ flex: totalRounds - wins - draws, backgroundColor: theme.red }} />}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {[
            { label: 'Siege', val: wins, color: theme.green },
            { label: 'Niederlagen', val: totalRounds - wins - draws, color: theme.red },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>{item.label}: <Text style={{ fontWeight: '700', color: item.color }}>{item.val}</Text></Text>
            </View>
          ))}
        </View>
      </View>

      {/* vs Stronger */}
      {vsStrong > 0 && (
        <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 }}>vs. Stärkere Gegner</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>{winsVsStrong} Siege von {vsStrong} Kämpfen</Text>
          <View style={{ flexDirection: 'row', borderRadius: 4, overflow: 'hidden', height: 6, marginTop: 8, backgroundColor: theme.cardSecondary }}>
            {vsStrong > 0 && <View style={{ flex: winsVsStrong, backgroundColor: '#FF9500' }} />}
            <View style={{ flex: vsStrong - winsVsStrong, backgroundColor: 'transparent' }} />
          </View>
        </View>
      )}

      {/* Top techniques */}
      {topTechs.length > 0 && (
        <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: theme.border }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 }}>Top Techniken</Text>
          {topTechs.map(([tech, count], i) => {
            const maxCount = topTechs[0][1];
            return (
              <View key={tech} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: theme.textPrimary, fontWeight: '500' }}>{tech}</Text>
                  <Text style={{ fontSize: 12, color: theme.orange, fontWeight: '700' }}>{count}×</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.cardSecondary }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.orange, width: `${(count/maxCount)*100}%` as any }} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const draws = 0; // used in JudoStatsView scope — declare here

// ─── Main JudoTrackingScreen ──────────────────────────────────
export function JudoTrackingScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'start' | 'history' | 'stats'>('start');
  const [activeSessionType, setActiveSessionType] = useState<JudoSessionType | null>(null);
  const [sessions, setSessions] = useState<JudoSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<JudoSession | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSessions();
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  async function loadSessions() {
    const raw = await AsyncStorage.getItem('judoSessions');
    if (raw) setSessions(JSON.parse(raw));
  }

  async function saveSession(data: { rounds: JudoRound[]; duration: number; intensity: number; notes: string; weightClass: string; location: string }) {
    const newSession: JudoSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: activeSessionType!,
      totalDuration: data.duration,
      rounds: data.rounds,
      weightClass: data.weightClass,
      location: data.location,
      intensity: data.intensity,
      notes: data.notes,
      score: 0,
    };
    newSession.score = calcJudoScore(newSession);

    const raw = await AsyncStorage.getItem('judoSessions');
    const all: JudoSession[] = raw ? JSON.parse(raw) : [];
    all.push(newSession);
    await AsyncStorage.setItem('judoSessions', JSON.stringify(all));

    // Also save to workouts so it shows in training history
    const rawW = await AsyncStorage.getItem('workouts');
    const workouts = rawW ? JSON.parse(rawW) : [];
    workouts.push({
      id: newSession.id,
      date: newSession.date,
      name: `Judo ${SESSION_TYPES.find(t => t.key === newSession.type)?.label}`,
      exercises: [],
      duration: data.duration,
      intensity: data.intensity,
      type: 'judo',
      score: newSession.score,
      judoSessionId: newSession.id,
    });
    await AsyncStorage.setItem('workouts', JSON.stringify(workouts));

    setSessions(all);
    setActiveSessionType(null);
    setTab('history');
    Alert.alert('Session gespeichert! 🥋', `Score: ${newSession.score} · ${data.rounds.length} Kämpfe`);
  }

  async function deleteSession(id: string) {
    Alert.alert('Session löschen', 'Wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        await AsyncStorage.setItem('judoSessions', JSON.stringify(updated));
      }},
    ]);
  }

  if (selectedSession) return <JudoSessionDetail session={selectedSession} onClose={() => setSelectedSession(null)} />;
  if (activeSessionType) return (
    <ActiveJudoSession
      sessionType={activeSessionType}
      onFinish={saveSession}
      onDiscard={() => setActiveSessionType(null)}
    />
  );

  const totalSessions = sessions.length;
  const totalRounds = sessions.flatMap(s => s.rounds).filter(r => r.result !== 'n/a').length;
  const totalWins = sessions.flatMap(s => s.rounds).filter(r => r.result === 'sieg').length;

  return (
    <Modal visible animationType="slide">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Header */}
        <View style={{ backgroundColor: theme.card, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.orange, marginBottom: 4 }}>Training</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.6 }}>Judo 🥋</Text>
              {totalSessions > 0 && (
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                  {totalSessions} Sessions · {totalRounds} Kämpfe · {totalWins} Siege
                </Text>
              )}
            </View>
            <TouchableOpacity style={judo.closeBtn} onPress={onClose}><IconClose size={15} /></TouchableOpacity>
          </View>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', gap: 0 }}>
            {[
              { key: 'start', label: '▶ Starten' },
              { key: 'history', label: '📋 Verlauf' },
              { key: 'stats', label: '📊 Stats' },
            ].map(t => (
              <TouchableOpacity key={t.key} onPress={() => setTab(t.key as any)}
                style={{ flex: 1, paddingBottom: 12, alignItems: 'center', borderBottomWidth: 2.5,
                  borderBottomColor: tab === t.key ? theme.orange : 'transparent' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tab === t.key ? theme.orange : theme.textSecondary }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Animated.ScrollView style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>

          {tab === 'start' && (
            <View style={{ gap: 10 }}>
              <Text style={[judo.sectionLabel, { marginBottom: 4 }]}>Session-Typ wählen</Text>
              {SESSION_TYPES.map(type => (
                <TouchableOpacity key={type.key} onPress={() => setActiveSessionType(type.key)} activeOpacity={0.88}
                  style={{ backgroundColor: theme.card, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.orangeLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.orangeBorder }}>
                    <Text style={{ fontSize: 26 }}>{type.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 }}>{type.label}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{type.desc}</Text>
                  </View>
                  <IconChevronRight />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tab === 'history' && (
            <JudoHistoryView
              sessions={[...sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
              onSelect={setSelectedSession}
              onDelete={deleteSession}
            />
          )}

          {tab === 'stats' && <JudoStatsView sessions={sessions} />}

        </Animated.ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const judo = StyleSheet.create({
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  timerBadge: { backgroundColor: theme.orangeLight, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.orangeBorder },
  timerText: { fontSize: 22, fontWeight: '800', color: theme.orange, letterSpacing: 1 },
  timerLabel: { fontSize: 7, color: theme.orange, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2, opacity: 0.6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.textTertiary, marginBottom: 10 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 13, color: theme.textPrimary, fontSize: 15, borderWidth: 1, borderColor: theme.border, marginBottom: 0 },
  saveBtn: { backgroundColor: theme.orange, borderRadius: 16, padding: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addRoundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: theme.orangeBorder, borderRadius: 14, borderStyle: 'dashed', padding: 14 },
  addRoundBtnText: { fontSize: 14, fontWeight: '600', color: theme.orange },
  finishBtn: { backgroundColor: theme.orange, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  finishBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
export default JudoTrackingScreen;