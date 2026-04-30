
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

type CheckinData = { energie: number; stress: number; motivation: number; score: number; date?: string; };
type SleepData = { sleepScore: number; hrv: number; schlafStunden: number; date?: string; };
type BatteryData = { level: number; date?: string; calorieEntries?: { kcal: number }[]; };
type Profile = { name: string; goal: string; };
type Habit = { id: string; name: string; completedDates: string[]; streak: number; };

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

function calculatePerformanceScore(checkin: CheckinData | null, sleep: SleepData | null, battery: BatteryData | null): number {
  if (!checkin && !sleep) return 0;
  const sleepScore = sleep?.sleepScore ?? 50;
  const energieScore = checkin ? checkin.energie * 20 : 50;
  const stressScore = checkin ? (6 - checkin.stress) * 20 : 50;
  const motivationScore = checkin ? checkin.motivation * 20 : 50;
  const batteryScore = battery?.level ?? 50;
  return Math.round(sleepScore * 0.30 + energieScore * 0.20 + stressScore * 0.20 + motivationScore * 0.15 + batteryScore * 0.15);
}

function ScoreRings({ performance = 0, sleep = 0, energy = 0 }: { performance: number, sleep: number, energy: number }) {
  const toArc = (score: number, radius: number) => {
    const circumference = 2 * Math.PI * radius;
    const filled = (Math.min(score, 100) / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  };
  return (
    <Svg width={180} height={180} viewBox="0 0 160 160">
      <Circle cx={80} cy={80} r={68} fill="none" stroke="#130C1E" strokeWidth={12} />
      <Circle cx={80} cy={80} r={68} fill="none" stroke="#7C3AED" strokeWidth={12}
        strokeDasharray={toArc(performance, 68)} strokeDashoffset={2 * Math.PI * 68 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <Circle cx={80} cy={80} r={52} fill="none" stroke="#130C1E" strokeWidth={10} />
      <Circle cx={80} cy={80} r={52} fill="none" stroke="#EC4899" strokeWidth={10}
        strokeDasharray={toArc(sleep, 52)} strokeDashoffset={2 * Math.PI * 52 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <Circle cx={80} cy={80} r={36} fill="none" stroke="#130C1E" strokeWidth={8} />
      <Circle cx={80} cy={80} r={36} fill="none" stroke="#06B6D4" strokeWidth={8}
        strokeDasharray={toArc(energy, 36)} strokeDashoffset={2 * Math.PI * 36 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <SvgText x={80} y={82} textAnchor="middle" fill="#E2D9F3" fontSize={26} fontWeight="500">{performance}</SvgText>
      <SvgText x={80} y={94} textAnchor="middle" fill="#5B4A8A" fontSize={9} letterSpacing={2}>SCORE</SvgText>
    </Svg>
  );
}

function MiniBattery({ level }: { level: number }) {
  const color = level >= 70 ? '#7C3AED' : level >= 40 ? '#EC4899' : '#FB7185';
  const statusColor = level >= 70 ? '#A78BFA' : level >= 40 ? '#F472B6' : '#FB7185';
  const statusText = level >= 70 ? 'Gut' : level >= 40 ? 'Moderat' : 'Kritisch';
  const fillHeight = Math.round((level / 100) * 90);
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={60} height={110} viewBox="0 0 60 110">
        <Circle cx={30} cy={8} r={6} fill="none" stroke="#2A1F40" strokeWidth={1.5} />
        <Circle cx={30} cy={8} r={3} fill="#2A1F40" />
        <Rect x={5} y={15} width={50} height={90} rx={10} fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1.5} />
        <Rect x={5} y={15 + (90 - fillHeight)} width={50} height={fillHeight} rx={6} fill={color} opacity={0.85} />
        <Rect x={5} y={15} width={50} height={90} rx={10} fill="none" stroke="#3D2E5C" strokeWidth={1.5} />
        <SvgText x={30} y={66} textAnchor="middle" fill="#E2D9F3" fontSize={16} fontWeight="500">{level}</SvgText>
        <SvgText x={30} y={78} textAnchor="middle" fill="#5B4A8A" fontSize={7} letterSpacing={1}>BAT</SvgText>
      </Svg>
      <Text style={{ color: statusColor, fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{statusText}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [sleep, setSleep] = useState<SleepData | null>(null);
  const [battery, setBattery] = useState<BatteryData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    async function load() {
      const rawCheckin = await AsyncStorage.getItem('lastCheckin');
      const rawSleep = await AsyncStorage.getItem('lastSleep');
      const rawBattery = await AsyncStorage.getItem('batteryData');
      const rawProfile = await AsyncStorage.getItem('profile');
      const rawHabits = await AsyncStorage.getItem('habits');

      if (rawCheckin) { const c = JSON.parse(rawCheckin); if (isToday(c.date ?? '')) setCheckin(c); }
      if (rawSleep) { const s = JSON.parse(rawSleep); if (isToday(s.date ?? '')) setSleep(s); }
      if (rawBattery) { const b = JSON.parse(rawBattery); if (isToday(b.date ?? '')) setBattery(b); }
      if (rawProfile) setProfile(JSON.parse(rawProfile));
      if (rawHabits) {
        const h: Habit[] = JSON.parse(rawHabits);
        setHabits(h.map((habit: any) => ({ ...habit, completedToday: habit.completedDates?.some(isToday) ?? false })));
      }
    }
    load();
  }, []);

  const score = calculatePerformanceScore(checkin, sleep, battery);
  const sleepScore = sleep?.sleepScore ?? 0;
  const energieScore = checkin ? checkin.energie * 20 : 0;
  const batteryLevel = battery?.level ?? 0;
  const firstName = profile?.name?.split(' ')[0] ?? 'Athlet'
  const initial = firstName.charAt(0).toUpperCase();
  const completedHabits = habits.filter((h: any) => h.completedToday).length;
  const totalHabits = habits.length;

  const focusText = score >= 70
    ? { title: 'Vollgas möglich 💪', sub: 'Alles grün – perfekter Tag für intensives Training.' }
    : score >= 50
      ? { title: 'Moderat halten ⚡', sub: 'Solide Basis heute. Nicht übertreiben.' }
      : score > 0
        ? { title: 'Erholung heute 🌙', sub: 'Dein Körper braucht Pause. Leicht halten.' }
        : { title: `${getGreeting()}! 🌱`, sub: 'Füll Sleep Log und Check-in aus um deinen Score zu sehen.' };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/profile' as any)}>
          <Text style={styles.avatarText}>{initial}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topRow}>
        <View style={styles.mainCard}>
          <ScoreRings performance={score} sleep={sleepScore} energy={energieScore} />
          <View style={styles.legend}>
            {[{ color: '#7C3AED', label: 'Perf.' }, { color: '#EC4899', label: 'Schlaf' }, { color: '#06B6D4', label: 'Energy' }].map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.batteryCard}>
          <Text style={styles.batteryCardLabel}>Body{'\n'}Battery</Text>
          <MiniBattery level={batteryLevel} />
        </View>
      </View>

      <View style={styles.focusCard}>
        <View style={styles.focusTop}>
          <View style={styles.focusDot} />
          <Text style={styles.focusLabel}>Today's Focus</Text>
        </View>
        <Text style={styles.focusTitle}>{focusText.title}</Text>
        <Text style={styles.focusSub}>{focusText.sub}</Text>
      </View>

      <View style={styles.miniRow}>
        <View style={[styles.miniCard, styles.miniPink]}>
          <Text style={[styles.miniVal, { color: '#F472B6' }]}>{sleepScore || '--'}</Text>
          <Text style={[styles.miniLbl, { color: '#9D174D' }]}>Sleep Score</Text>
          <View style={styles.miniBar}><View style={[styles.miniBarFill, { width: `${sleepScore}%` as any, backgroundColor: '#EC4899' }]} /></View>
        </View>
        <View style={[styles.miniCard, styles.miniOrange]}>
          <Text style={[styles.miniVal, { color: '#FB923C' }]}>
            {battery?.calorieEntries ? battery.calorieEntries.reduce((s, e) => s + e.kcal, 0) : '--'}
          </Text>
          <Text style={[styles.miniLbl, { color: '#92400E' }]}>kcal</Text>
          <View style={styles.miniBar}><View style={[styles.miniBarFill, { width: `${Math.min(((battery?.calorieEntries?.reduce((s, e) => s + e.kcal, 0) ?? 0) / 3000) * 100, 100)}%` as any, backgroundColor: '#FB923C' }]} /></View>
        </View>
        <View style={[styles.miniCard, styles.miniPurple]}>
          <Text style={[styles.miniVal, { color: '#A78BFA' }]}>{batteryLevel || '--'}</Text>
          <Text style={[styles.miniLbl, { color: '#5B21B6' }]}>Battery</Text>
          <View style={styles.miniBar}><View style={[styles.miniBarFill, { width: `${batteryLevel}%` as any, backgroundColor: '#7C3AED' }]} /></View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Heute</Text>
          {totalHabits > 0 && (
            <Text style={styles.sectionBadge}>{completedHabits}/{totalHabits} Habits</Text>
          )}
        </View>
        {[
          { label: 'Schlaf geloggt', done: sleep !== null, score: sleep?.sleepScore ?? null },
          { label: 'Check-in', done: checkin !== null, score: checkin?.score ?? null },
          ...habits.slice(0, 4).map((h: any) => ({ label: h.name, done: h.completedToday, score: null, streak: h.streak })),
        ].map((item, i) => (
          <View key={i} style={styles.todayRow}>
            <View style={[styles.todayCheck, item.done && styles.todayCheckDone]}>
              {item.done && <Text style={styles.todayCheckMark}>✓</Text>}
            </View>
            <Text style={[styles.todayLabel, !item.done && { color: '#3D2E5C' }]}>{item.label}</Text>
            {item.score !== null && item.done && (
              <View style={styles.scorePill}><Text style={styles.scorePillText}>Score {item.score}</Text></View>
            )}
            {(item as any).streak > 0 && <Text style={styles.streakText}>🔥 {(item as any).streak}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  greeting: { color: '#5B4A8A', fontSize: 12, letterSpacing: 0.5 },
  name: { color: '#E2D9F3', fontSize: 26, fontWeight: '500', marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#A78BFA', fontSize: 18, fontWeight: '500' },
  topRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  mainCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 12, alignItems: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { color: '#5B4A8A', fontSize: 9 },
  batteryCard: { width: 90, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  batteryCardLabel: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  focusCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', padding: 16, marginBottom: 12 },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  focusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A78BFA' },
  focusLabel: { color: '#A78BFA', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '500' },
  focusTitle: { color: '#E2D9F3', fontSize: 16, fontWeight: '500', marginBottom: 4 },
  focusSub: { color: '#5B4A8A', fontSize: 12, lineHeight: 18 },
  miniRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  miniCard: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 0.5 },
  miniPink: { backgroundColor: 'rgba(236,72,153,0.08)', borderColor: 'rgba(236,72,153,0.2)' },
  miniOrange: { backgroundColor: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.2)' },
  miniPurple: { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' },
  miniVal: { fontSize: 18, fontWeight: '500' },
  miniLbl: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  miniBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  miniBarFill: { height: '100%', borderRadius: 2 },
  section: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 16, marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionBadge: { color: '#A78BFA', fontSize: 11, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)' },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  todayCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  todayCheckDone: { backgroundColor: 'rgba(124,58,237,0.3)', borderColor: 'rgba(124,58,237,0.5)' },
  todayCheckMark: { color: '#A78BFA', fontSize: 10 },
  todayLabel: { flex: 1, color: '#C4B5D9', fontSize: 13 },
  scorePill: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)' },
  scorePillText: { color: '#A78BFA', fontSize: 10, fontWeight: '500' },
  streakText: { color: '#5B4A8A', fontSize: 11 },
});