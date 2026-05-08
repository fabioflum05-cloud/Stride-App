import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isToday(dateString: string) {
  const d = new Date(dateString), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function formatTime(iso: string) {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function dayLabel(dateString: string) {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return days[new Date(dateString).getDay()];
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ value, color, label, size = 72 }: {
  value: number; color: string; label: string; size?: number;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color + '22'} strokeWidth={7} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={7} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          rotation={-90} originX={size / 2} originY={size / 2}
        />
        <SvgText x={size / 2} y={size / 2 + 6} textAnchor="middle" fill={color} fontSize={16} fontWeight="600">
          {value > 0 ? value : '--'}
        </SvgText>
      </Svg>
      <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

// ─── Sleep Phase Bar ─────────────────────────────────────────────────────────

function SleepPhaseBar({ deep, rem, light }: { deep: number; rem: number; light: number }) {
  const total = deep + rem + light;
  if (total === 0) return null;
  const deepPct = (deep / total) * 100;
  const remPct = (rem / total) * 100;
  const lightPct = (light / total) * 100;
  const fmt = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionLabel}>Schlafphasen</Text>
      <View style={{ height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden' }}>
        <View style={{ flex: deepPct, backgroundColor: '#5B7FFF' }} />
        <View style={{ flex: remPct, backgroundColor: theme.purple }} />
        <View style={{ flex: lightPct, backgroundColor: theme.pink + 'BB' }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {[
          { label: 'Tief', val: fmt(deep), color: '#5B7FFF' },
          { label: 'REM', val: fmt(rem), color: theme.purple },
          { label: 'Leicht', val: fmt(light), color: theme.pink },
        ].map(p => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{p.label} </Text>
            <Text style={{ color: theme.textPrimary, fontSize: 10, fontWeight: '600' }}>{p.val}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── HRV Sparkline ───────────────────────────────────────────────────────────

function HRVSparkline({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return null;
  const W = SCREEN_W - 80, H = 50;
  const vals = data.map(d => d.value);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const range = mx - mn || 1;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.value - mn) / range) * (H - 8) - 4,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const trend = vals[vals.length - 1] - vals[0];
  const arrow = trend > 2 ? '↑' : trend < -2 ? '↓' : '→';
  const arrowColor = trend > 2 ? theme.green : trend < -2 ? theme.pink : theme.textSecondary;
  const latest = vals[vals.length - 1];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.sectionLabel}>HRV – 7 Tage</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600' }}>{latest}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11 }}>ms</Text>
          <Text style={{ color: arrowColor, fontSize: 16, fontWeight: '700' }}>{arrow}</Text>
        </View>
      </View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="hrv" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.purple} stopOpacity="0.4" />
            <Stop offset="1" stopColor={theme.blue} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={pathD} stroke="url(#hrv)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5}
            fill={i === pts.length - 1 ? theme.blue : theme.purple + '88'} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.map((d, i) => (
          <Text key={i} style={{ color: theme.textTertiary, fontSize: 9 }}>{dayLabel(d.date)}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Week Grid ───────────────────────────────────────────────────────────────

function WeekGrid({ sleepHistory }: { sleepHistory: { date: string; sleepScore: number }[] }) {
  const last7 = [...sleepHistory].slice(-7);
  if (last7.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionLabel}>Wochenübersicht – Schlaf</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {last7.map((d, i) => {
          const score = d.sleepScore;
          const color = score >= 70 ? theme.green : score >= 50 ? theme.orange : theme.pink;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{
                height: 36, width: '100%', borderRadius: 8,
                backgroundColor: score > 0 ? color + '33' : theme.cardSecondary,
                borderWidth: 1, borderColor: score > 0 ? color + '66' : theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: score > 0 ? color : theme.textTertiary, fontSize: 11, fontWeight: '600' }}>
                  {score > 0 ? score : '–'}
                </Text>
              </View>
              <Text style={{ color: theme.textTertiary, fontSize: 9 }}>{dayLabel(d.date)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Weight Chart ─────────────────────────────────────────────────────────────

function WeightChart({ data }: { data: { date: string; weight: number }[] }) {
  const last14 = [...data].slice(-14);
  if (last14.length < 2) return null;

  const W = SCREEN_W - 80, H = 60;
  const weights = last14.map(d => d.weight);
  const mn = Math.min(...weights) - 0.5, mx = Math.max(...weights) + 0.5;
  const range = mx - mn || 1;
  const pts = last14.map((d, i) => ({
    x: (i / (last14.length - 1)) * W,
    y: H - ((d.weight - mn) / range) * (H - 8) - 4,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const latest = weights[weights.length - 1];
  const delta = (latest - weights[0]).toFixed(1);
  const deltaColor = parseFloat(delta) > 0 ? theme.green : theme.pink;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.sectionLabel}>Gewichtsverlauf</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600' }}>{latest}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11 }}>kg</Text>
          <Text style={{ color: deltaColor, fontSize: 11, fontWeight: '600' }}>
            {parseFloat(delta) > 0 ? `+${delta}` : delta}
          </Text>
        </View>
      </View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="wt" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.blue} stopOpacity="0.4" />
            <Stop offset="1" stopColor={theme.teal} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={pathD} stroke="url(#wt)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4} fill={theme.teal} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.textTertiary, fontSize: 9 }}>{last14[0]?.date?.slice(5)}</Text>
        <Text style={{ color: theme.textTertiary, fontSize: 9 }}>{last14[last14.length - 1]?.date?.slice(5)}</Text>
      </View>
    </View>
  );
}

// ─── Animated Card ───────────────────────────────────────────────────────────

function AnimatedCard({ children, style, onPress, delay = 0 }: {
  children: React.ReactNode; style?: any; onPress?: () => void; delay?: number;
}) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
    return () => { opacity.setValue(0); scale.setValue(0.96); };
  }, []));

  const handlePressIn = () => Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const handlePressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
        onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function DoneBadge({ color, text, bgColor }: { color: string; text: string; bgColor: string }) {
  const scale = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    Animated.spring(scale, { toValue: 1, delay: 300, useNativeDriver: true, tension: 120, friction: 8 }).start();
    return () => scale.setValue(0);
  }, []));
  return (
    <Animated.View style={[styles.doneBadge, { backgroundColor: bgColor, transform: [{ scale }] }]}>
      <Text style={[styles.doneBadgeText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HealthScreen() {
  const [sleepDone, setSleepDone] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [sleepScore, setSleepScore] = useState(0);
  const [checkinScore, setCheckinScore] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [habitsCompleted, setHabitsCompleted] = useState(0);
  const [habitsTotal, setHabitsTotal] = useState(0);
  const [currentWeight, setCurrentWeight] = useState<string | null>(null);
  const [perfScore, setPerfScore] = useState(0);

  // New detail state
  const [sleepPhases, setSleepPhases] = useState({ deep: 0, rem: 0, light: 0 });
  const [sleepMeta, setSleepMeta] = useState({ bedtime: '', wakeTime: '', restingHR: 0 });
  const [sleepHistory, setSleepHistory] = useState<{ date: string; sleepScore: number }[]>([]);
  const [hrvHistory, setHrvHistory] = useState<{ date: string; value: number }[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    load();
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return () => headerAnim.setValue(0);
  }, []));

  async function load() {
    const [
      rawSleep, rawCheckin, rawBattery, rawHabits,
      rawProfile, rawWeight, rawSleepHist, rawHRV,
    ] = await Promise.all([
      AsyncStorage.getItem('lastSleep'),
      AsyncStorage.getItem('lastCheckin'),
      AsyncStorage.getItem('batteryData'),
      AsyncStorage.getItem('habits'),
      AsyncStorage.getItem('profile'),
      AsyncStorage.getItem('weightHistory'),
      AsyncStorage.getItem('sleepHistory'),
      AsyncStorage.getItem('hrvHistory'),
    ]);

    let sl = 0, ch = 0, bat = 0;

    if (rawSleep) {
      const s = JSON.parse(rawSleep);
      if (isToday(s.date)) {
        setSleepDone(true); setSleepScore(s.sleepScore); sl = s.sleepScore;
        if (s.deep != null) setSleepPhases({ deep: s.deep ?? 0, rem: s.rem ?? 0, light: s.light ?? 0 });
        setSleepMeta({ bedtime: s.bedtime ?? '', wakeTime: s.wakeTime ?? '', restingHR: s.restingHR ?? 0 });
      }
    }
    if (rawCheckin) {
      const c = JSON.parse(rawCheckin);
      if (isToday(c.date ?? '')) { setCheckinDone(true); setCheckinScore(c.score); ch = c.score; }
    }
    if (rawBattery) {
      const b = JSON.parse(rawBattery);
      if (isToday(b.date)) { setBatteryLevel(b.level); bat = b.level; }
    }
    if (rawHabits) {
      const h = JSON.parse(rawHabits);
      setHabitsTotal(h.length);
      setHabitsCompleted(h.filter((hb: any) => hb.completedDates?.some(isToday)).length);
    }
    if (rawWeight) {
      const w = JSON.parse(rawWeight);
      setWeightHistory(w);
      if (w.length > 0) setCurrentWeight(w[w.length - 1].weight + ' kg');
    } else if (rawProfile) {
      const p = JSON.parse(rawProfile);
      if (p.weight) setCurrentWeight(p.weight + ' kg');
    }
    if (rawSleepHist) setSleepHistory(JSON.parse(rawSleepHist));
    if (rawHRV) setHrvHistory(JSON.parse(rawHRV));

    const score = sl && ch
      ? Math.round(sl * 0.35 + ch * 0.35 + bat * 0.3)
      : sl ? Math.round(sl * 0.6 + bat * 0.4) : 0;
    setPerfScore(score);
  }

  const focusText = perfScore >= 70
    ? { label: '💪 Vollgas möglich', color: theme.green, bg: theme.greenLight }
    : perfScore >= 50
    ? { label: '⚡ Moderat halten', color: theme.orange, bg: theme.orangeLight }
    : perfScore > 0
    ? { label: '🌙 Erholung heute', color: theme.pink, bg: theme.pinkLight }
    : { label: '✍️ Log ausfüllen', color: theme.textSecondary, bg: theme.cardSecondary };

  const completedCount = [
    sleepDone, checkinDone, batteryLevel > 0,
    habitsCompleted === habitsTotal && habitsTotal > 0, currentWeight !== null,
  ].filter(Boolean).length;

  const hasPhases = sleepPhases.deep + sleepPhases.rem + sleepPhases.light > 0;
  const hasMeta = sleepMeta.bedtime || sleepMeta.wakeTime || sleepMeta.restingHR > 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}>
        <Text style={styles.headerLabel}>Health</Text>
        <Text style={styles.title}>Deine{'\n'}Gesundheit</Text>
      </Animated.View>

      {/* ── Score Rings Card ── */}
      <AnimatedCard style={styles.card} onPress={() => {}} delay={50}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View>
            <Text style={styles.heroScoreLabel}>Performance Score</Text>
            <Text style={styles.heroScore}>{perfScore || '--'}</Text>
          </View>
          <View style={[styles.focusBadge, { backgroundColor: focusText.bg }]}>
            <Text style={[styles.focusBadgeText, { color: focusText.color }]}>{focusText.label}</Text>
          </View>
        </View>

        {/* 3 Rings */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          <ScoreRing value={perfScore} color={theme.blue} label="Score" />
          <ScoreRing value={sleepScore} color={theme.pink} label="Schlaf" />
          <ScoreRing value={batteryLevel} color={theme.green} label="Energy" />
        </View>

        {/* Progress dots */}
        <View style={styles.heroDots}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.heroDot, { backgroundColor: i < completedCount ? theme.blue : theme.border }]} />
          ))}
          <Text style={styles.heroDotsLabel}>{completedCount}/5 erledigt</Text>
        </View>
      </AnimatedCard>

      {/* ── Schlaf Detail Card ── */}
      {sleepDone && (
        <AnimatedCard style={styles.card} onPress={() => router.push('/sleep' as any)} delay={100}>
          <Text style={styles.cardTitle}>Schlaf Details</Text>

          {hasMeta && (
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
              {sleepMeta.bedtime ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Eingeschlafen</Text>
                  <Text style={styles.metaVal}>{formatTime(sleepMeta.bedtime)}</Text>
                </View>
              ) : null}
              {sleepMeta.wakeTime ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Aufgewacht</Text>
                  <Text style={styles.metaVal}>{formatTime(sleepMeta.wakeTime)}</Text>
                </View>
              ) : null}
              {sleepMeta.restingHR > 0 ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Ruhepuls</Text>
                  <Text style={[styles.metaVal, { color: theme.pink }]}>{sleepMeta.restingHR} bpm</Text>
                </View>
              ) : null}
            </View>
          )}

          {hasPhases && <SleepPhaseBar deep={sleepPhases.deep} rem={sleepPhases.rem} light={sleepPhases.light} />}
        </AnimatedCard>
      )}

      {/* ── HRV Sparkline Card ── */}
      {hrvHistory.length >= 2 && (
        <AnimatedCard style={styles.card} onPress={() => router.push('/checkin' as any)} delay={150}>
          <HRVSparkline data={hrvHistory.slice(-7)} />
        </AnimatedCard>
      )}

      {/* ── Wochenübersicht ── */}
      {sleepHistory.length > 0 && (
        <AnimatedCard style={styles.card} onPress={() => router.push('/sleep' as any)} delay={200}>
          <WeekGrid sleepHistory={sleepHistory} />
        </AnimatedCard>
      )}

      {/* ── Gewichtsverlauf ── */}
      {weightHistory.length >= 2 && (
        <AnimatedCard style={styles.card} onPress={() => router.push('/weight' as any)} delay={250}>
          <WeightChart data={weightHistory} />
        </AnimatedCard>
      )}

      {/* ── Quick Actions Row 1: Schlaf + Battery ── */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.wideCard, sleepDone && { borderColor: theme.pink, borderWidth: 1.5 }]}
          onPress={() => router.push('/sleep' as any)} delay={300}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: theme.pinkLight }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={theme.pink} strokeWidth={1.5} />
              <Path d="M12 7V11L15 13" stroke={theme.pink} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Schlaf</Text>
          <Text style={[styles.cardVal, { color: sleepDone ? theme.pink : theme.textTertiary }]}>
            {sleepDone ? `Score ${sleepScore}` : 'Noch nicht geloggt'}
          </Text>
          {sleepDone && <DoneBadge color={theme.pink} text="✓ Geloggt" bgColor={theme.pinkLight} />}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.narrowCard, batteryLevel > 0 && { borderColor: theme.teal, borderWidth: 1.5 }]}
          onPress={() => router.push('/battery' as any)} delay={320}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: theme.tealLight }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={7} width={16} height={10} rx={2} stroke={theme.teal} strokeWidth={1.5} />
              <Path d="M19 10V14" stroke={theme.teal} strokeWidth={2} strokeLinecap="round" />
              <Rect x={5} y={9} width={batteryLevel > 0 ? 8 : 2} height={6} rx={1} fill={theme.teal} opacity={0.5} />
            </Svg>
          </View>
          <Text style={styles.cardName}>Battery</Text>
          <Text style={[styles.cardVal, { color: batteryLevel > 0 ? theme.teal : theme.textTertiary, fontSize: 10 }]}>
            {batteryLevel > 0 ? `${batteryLevel}%` : 'Nicht gestartet'}
          </Text>
          {batteryLevel > 0 && <DoneBadge color={theme.teal} text="✓" bgColor={theme.tealLight} />}
        </AnimatedCard>
      </View>

      {/* ── Quick Actions Row 2: Check-in + Habits + Gewicht ── */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.thirdCard, checkinDone && { borderColor: theme.purple, borderWidth: 1.5 }]}
          onPress={() => router.push('/checkin' as any)} delay={340}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: theme.purpleLight }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={theme.purple} strokeWidth={1.5} />
              <Path d="M8.5 12L11 14.5L15.5 9.5" stroke={theme.purple} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Check-in</Text>
          <Text style={[styles.cardVal, { color: checkinDone ? theme.purple : theme.textTertiary }]}>
            {checkinDone ? `Score ${checkinScore}` : 'Ausstehend'}
          </Text>
          {checkinDone && <DoneBadge color={theme.purple} text="✓" bgColor={theme.purpleLight} />}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.thirdCard, habitsTotal > 0 && { borderColor: theme.orange, borderWidth: 1.5 }]}
          onPress={() => router.push('/habits' as any)} delay={360}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: theme.orangeLight }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={5} width={18} height={2} rx={1} fill={theme.orange} opacity={0.4} />
              <Rect x={3} y={11} width={18} height={2} rx={1} fill={theme.orange} opacity={0.7} />
              <Rect x={3} y={17} width={18} height={2} rx={1} fill={theme.orange} />
            </Svg>
          </View>
          <Text style={styles.cardName}>Habits</Text>
          <Text style={[styles.cardVal, { color: habitsTotal > 0 ? theme.orange : theme.textTertiary }]}>
            {habitsTotal > 0 ? `${habitsCompleted}/${habitsTotal}` : 'Keine'}
          </Text>
          {habitsCompleted === habitsTotal && habitsTotal > 0 && (
            <DoneBadge color={theme.orange} text="✓" bgColor={theme.orangeLight} />
          )}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.thirdCard, currentWeight && { borderColor: theme.blue, borderWidth: 1.5 }]}
          onPress={() => router.push('/weight' as any)} delay={380}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: theme.blueLight }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3C9 3 6.5 5 6.5 8C6.5 9.5 7 10.8 8 11.8L5 21H19L16 11.8C17 10.8 17.5 9.5 17.5 8C17.5 5 15 3 12 3Z"
                stroke={theme.blue} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Gewicht</Text>
          <Text style={[styles.cardVal, { color: currentWeight ? theme.blue : theme.textTertiary, fontSize: 10 }]}>
            {currentWeight ?? 'Nicht geloggt'}
          </Text>
          {currentWeight && <DoneBadge color={theme.blue} text="✓" bgColor={theme.blueLight} />}
        </AnimatedCard>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },

  card: { backgroundColor: theme.card, borderRadius: 20, padding: 18, marginBottom: 12, ...theme.shadow },
  cardTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 12, letterSpacing: 0.2 },
  sectionLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2 },

  heroScoreLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  heroScore: { color: theme.textPrimary, fontSize: 44, fontWeight: '300', letterSpacing: -1 },
  focusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  focusBadgeText: { fontSize: 12, fontWeight: '500' },
  heroDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroDotsLabel: { color: theme.textSecondary, fontSize: 10, marginLeft: 4 },

  metaItem: { gap: 2 },
  metaLabel: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  metaVal: { color: theme.textPrimary, fontSize: 16, fontWeight: '600' },

  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  wideCard: { flex: 2, backgroundColor: theme.card, borderRadius: 18, padding: 14, gap: 6, ...theme.shadow },
  narrowCard: { flex: 1, backgroundColor: theme.card, borderRadius: 18, padding: 14, gap: 6, ...theme.shadow },
  thirdCard: { flex: 1, backgroundColor: theme.card, borderRadius: 18, padding: 12, gap: 5, ...theme.shadow },
  cardIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardName: { color: theme.textPrimary, fontSize: 12, fontWeight: '600' },
  cardVal: { fontSize: 11 },
  doneBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  doneBadgeText: { fontSize: 9, fontWeight: '600' },
});