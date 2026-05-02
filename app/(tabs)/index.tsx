import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';
import { theme } from '../../constants/theme';

const W = Dimensions.get('window').width;

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

function calculatePerformanceScore(checkin: any, sleep: any, battery: any): number {
  if (!checkin && !sleep) return 0;
  const sleepScore = sleep?.sleepScore ?? 50;
  const energieScore = checkin ? checkin.energie * 20 : 50;
  const stressScore = checkin ? (6 - checkin.stress) * 20 : 50;
  const motivationScore = checkin ? checkin.motivation * 20 : 50;
  const batteryScore = battery?.level ?? 50;
  return Math.round(sleepScore * 0.30 + energieScore * 0.20 + stressScore * 0.20 + motivationScore * 0.15 + batteryScore * 0.15);
}

function EnergyChart() {
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const values = [20, 35, 75, 90, 85, 70, 55, 40, 25];
  const W = 280;
  const H = 60;
  const pad = 10;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / 100) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const optimalStart = pad + (2 / (values.length - 1)) * (W - pad * 2);
  const optimalEnd = pad + (4 / (values.length - 1)) * (W - pad * 2);

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.green} stopOpacity={0.15} />
            <Stop offset="1" stopColor={theme.green} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path
          d={`M ${optimalStart} ${pad} L ${optimalEnd} ${pad} L ${optimalEnd} ${H - pad} L ${optimalStart} ${H - pad} Z`}
          fill="url(#optGrad)"
        />
        <Polyline
          points={points}
          fill="none"
          stroke={theme.blue}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * (W - pad * 2);
          const y = H - pad - (v / 100) * (H - pad * 2);
          const color = v >= 70 ? theme.green : v >= 45 ? theme.orange : theme.red;
          return <Circle key={i} cx={x} cy={y} r={3} fill={color} />;
        })}
      </Svg>
      <View style={styles.energyTimes}>
        {hours.filter((_, i) => i % 2 === 0).map(h => (
          <Text key={h} style={styles.energyTime}>{h}h</Text>
        ))}
      </View>
      <View style={styles.optimalBadge}>
        <View style={styles.optimalDot} />
        <Text style={styles.optimalText}>Optimal trainieren: 10–14 Uhr</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [checkin, setCheckin] = useState<any>(null);
  const [sleep, setSleep] = useState<any>(null);
  const [battery, setBattery] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [habits, setHabits] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const menuSlide = useRef(new Animated.Value(320)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

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
      const h = JSON.parse(rawHabits);
      const mapped = h.map((habit: any) => ({
        ...habit,
        completedToday: habit.completedDates?.some(isToday) ?? false,
      }));
      setHabits(mapped);
      const s = calculateStreak(mapped);
      setStreak(s);
    }
  }

  function calculateStreak(habitList: any[]): number {
    if (habitList.length === 0) return 0;
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const anyDone = habitList.some(h =>
        h.completedDates?.some((cd: string) => {
          const dd = new Date(cd);
          return dd.getDate() === d.getDate() &&
            dd.getMonth() === d.getMonth() &&
            dd.getFullYear() === d.getFullYear();
        })
      );
      if (anyDone) s++;
      else break;
    }
    return s;
  }

  function openMenu() {
    setMenuVisible(true);
    Animated.parallel([
      Animated.spring(menuSlide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(menuFade, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }

  function closeMenu() {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: 320, duration: 220, useNativeDriver: true }),
      Animated.timing(menuFade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  }

  const score = calculatePerformanceScore(checkin, sleep, battery);
  const sleepScore = sleep?.sleepScore ?? 0;
  const batteryLevel = battery?.level ?? 0;
  const kcal = battery?.calorieEntries?.reduce((s: number, e: any) => s + e.kcal, 0) ?? 0;
  const firstName = profile?.name?.split(' ')[0] ?? 'Athlet';
  const initial = firstName.charAt(0).toUpperCase();
  const completedHabits = habits.filter(h => h.completedToday).length;
  const totalHabits = habits.length;

  const focusText = score >= 70
    ? '💪 Vollgas möglich'
    : score >= 50
    ? '⚡ Moderat halten'
    : score > 0
    ? '🌙 Erholung heute'
    : '🌱 Score ausfüllen';

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.7}>
              <View style={styles.menuBtnLine} />
              <View style={[styles.menuBtnLine, { width: 14 }]} />
              <View style={[styles.menuBtnLine, { width: 18 }]} />
            </TouchableOpacity>
          </View>

          {/* Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreTop}>
              <View>
                <Text style={styles.scoreLabel}>Performance Score</Text>
                <Text style={styles.scoreNum}>{score || '--'}</Text>
              </View>
              <View style={styles.focusBadge}>
                <Text style={styles.focusBadgeText}>{focusText}</Text>
              </View>
            </View>
            <View style={styles.scoreBars}>
              {[
                { label: 'Schlaf', value: sleepScore },
                { label: 'Energy', value: batteryLevel },
                { label: 'Check-in', value: checkin ? checkin.score : 0 },
              ].map(bar => (
                <View key={bar.label} style={styles.scoreBarWrap}>
                  <Text style={styles.scoreBarLabel}>{bar.label}</Text>
                  <View style={styles.scoreBarTrack}>
                    <View style={[styles.scoreBarFill, { width: `${bar.value}%` as any }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Streak */}
          {streak > 0 && (
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakTitle}>{streak} Tage Streak!</Text>
                <Text style={styles.streakSub}>Jeden Tag aktiv – weiter so!</Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>{streak}</Text>
              </View>
            </View>
          )}

          {/* Mini Stats */}
          <View style={styles.statsRow}>
            {[
              { label: 'Sleep Score', value: sleepScore || '--', color: theme.pink },
              { label: 'kcal', value: kcal || '--', color: theme.orange },
              { label: 'Battery', value: batteryLevel || '--', color: theme.blue },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Energy Chart */}
          <View style={styles.energyCard}>
            <Text style={styles.sectionTitle}>Energie-Verlauf</Text>
            <EnergyChart />
          </View>

          {/* Habits */}
          <View style={styles.habitsCard}>
            <View style={styles.habitsHeader}>
              <Text style={styles.sectionTitle}>Habits heute</Text>
              {totalHabits > 0 && (
                <View style={styles.habitsBadge}>
                  <Text style={styles.habitsBadgeText}>{completedHabits}/{totalHabits} ✓</Text>
                </View>
              )}
            </View>
            {habits.length === 0 ? (
              <Text style={styles.emptyText}>Keine Habits definiert</Text>
            ) : (
              habits.slice(0, 5).map((h, i) => (
                <View key={h.id} style={[styles.habitRow, i === habits.slice(0, 5).length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.habitCheck, h.completedToday && styles.habitCheckDone]}>
                    {h.completedToday && <Text style={styles.habitCheckMark}>✓</Text>}
                  </View>
                  <Text style={[styles.habitName, !h.completedToday && { color: theme.textSecondary }]}>
                    {h.name}
                  </Text>
                  {h.streak > 0 && (
                    <Text style={styles.habitStreak}>🔥 {h.streak}</Text>
                  )}
                </View>
              ))
            )}
            {totalHabits > 5 && (
              <TouchableOpacity onPress={() => router.push('/habits' as any)}>
                <Text style={styles.habitsMore}>+{totalHabits - 5} weitere →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Today Checklist */}
          <View style={styles.todayCard}>
            <Text style={styles.sectionTitle}>Heute erledigen</Text>
            {[
              { label: 'Schlaf Log', done: sleep !== null, route: '/sleep' },
              { label: 'Daily Check-in', done: checkin !== null, route: '/checkin' },
              { label: 'Body Battery', done: batteryLevel > 0, route: '/battery' },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.todayRow, i === 2 && { borderBottomWidth: 0 }]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.todayCheck, item.done && styles.todayCheckDone]}>
                  {item.done && <Text style={styles.todayCheckMark}>✓</Text>}
                </View>
                <Text style={[styles.todayLabel, !item.done && { color: theme.textSecondary }]}>
                  {item.label}
                </Text>
                <Text style={styles.todayArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

      {/* Side Menu */}
      {menuVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: menuFade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMenu} activeOpacity={1}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          </TouchableOpacity>
          <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuSlide }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <TouchableOpacity
                style={styles.menuProfileRow}
                onPress={() => { closeMenu(); setTimeout(() => router.push('/profile' as any), 250); }}
                activeOpacity={0.7}
              >
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuProfileName}>{firstName}</Text>
                  <Text style={styles.menuProfileSub}>{profile?.goal ?? 'Performance'}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <Text style={styles.menuSectionLabel}>Allgemein</Text>
              <View style={styles.menuGroup}>
                {[
                  { icon: '🎨', label: 'Design', bg: theme.blue, onPress: () => {} },
                  { icon: '🔔', label: 'Benachrichtigungen', bg: theme.orange, onPress: () => {} },
                  { icon: '🌐', label: 'Sprache', bg: theme.teal, onPress: () => {} },
                ].map((item, i, arr) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuRow, i < arr.length - 1 && styles.menuRowBorder]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuRowIcon, { backgroundColor: item.bg }]}>
                      <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                    </View>
                    <Text style={styles.menuRowLabel}>{item.label}</Text>
                    <Text style={styles.menuChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.menuSectionLabel}>Daten</Text>
              <View style={styles.menuGroup}>
                {[
                  { icon: '📊', label: 'Statistiken', bg: theme.green, onPress: () => {} },
                  { icon: '📤', label: 'Export', bg: theme.pink, onPress: () => {} },
                ].map((item, i, arr) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuRow, i < arr.length - 1 && styles.menuRowBorder]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuRowIcon, { backgroundColor: item.bg }]}>
                      <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                    </View>
                    <Text style={styles.menuRowLabel}>{item.label}</Text>
                    <Text style={styles.menuChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.menuSectionLabel}>Info</Text>
              <View style={styles.menuGroup}>
                <TouchableOpacity style={styles.menuRow} onPress={() => {}} activeOpacity={0.7}>
                  <View style={[styles.menuRowIcon, { backgroundColor: theme.purple }]}>
                    <Text style={{ fontSize: 15 }}>ℹ️</Text>
                  </View>
                  <Text style={styles.menuRowLabel}>Über die App</Text>
                  <Text style={styles.menuChevron}>›</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.menuFooterText}>Stride App · v1.0</Text>
              <View style={{ height: 40 }} />
            </ScrollView>
            <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn} activeOpacity={0.7}>
              <Text style={styles.menuCloseText}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  greeting: { color: theme.textSecondary, fontSize: 13 },
  name: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', marginTop: 2 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.card, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 10, gap: 5, ...theme.shadow },
  menuBtnLine: { height: 1.5, width: 18, backgroundColor: theme.textSecondary, borderRadius: 1 },

  // Score Card
  scoreCard: { backgroundColor: theme.blue, borderRadius: 20, padding: 18, marginBottom: 12 },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  scoreLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  scoreNum: { color: '#FFFFFF', fontSize: 48, fontWeight: '300', lineHeight: 52 },
  focusBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  focusBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  scoreBars: { flexDirection: 'row', gap: 10 },
  scoreBarWrap: { flex: 1 },
  scoreBarLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  scoreBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },

  // Streak
  streakCard: { backgroundColor: theme.orange, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, ...theme.shadow },
  streakEmoji: { fontSize: 24 },
  streakTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  streakSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  streakBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  streakBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 12, alignItems: 'center', ...theme.shadow },
  statVal: { fontSize: 20, fontWeight: '600' },
  statLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  // Energy Chart
  energyCard: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 12, ...theme.shadow },
  energyTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 10 },
  energyTime: { color: theme.textSecondary, fontSize: 9 },
  optimalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: theme.greenLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  optimalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.green },
  optimalText: { color: '#1B5E20', fontSize: 11, fontWeight: '500' },

  // Habits
  habitsCard: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 12, ...theme.shadow },
  habitsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  habitsBadge: { backgroundColor: theme.blueLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  habitsBadgeText: { color: theme.blue, fontSize: 11, fontWeight: '500' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.textTertiary, alignItems: 'center', justifyContent: 'center' },
  habitCheckDone: { backgroundColor: theme.green, borderColor: theme.green },
  habitCheckMark: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  habitName: { flex: 1, color: theme.textPrimary, fontSize: 14 },
  habitStreak: { color: theme.orange, fontSize: 12, fontWeight: '500' },
  habitsMore: { color: theme.blue, fontSize: 12, marginTop: 8, textAlign: 'center' },
  emptyText: { color: theme.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 10 },

  // Today
  todayCard: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 12, ...theme.shadow },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  todayCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.textTertiary, alignItems: 'center', justifyContent: 'center' },
  todayCheckDone: { backgroundColor: theme.blue, borderColor: theme.blue },
  todayCheckMark: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  todayLabel: { flex: 1, color: theme.textPrimary, fontSize: 14 },
  todayArrow: { color: theme.textTertiary, fontSize: 18 },

  // Section Title
  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 10 },

  // Menu
  menuPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '78%', backgroundColor: '#FFFFFF', paddingTop: 56 },
  menuProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.blueLight, alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { color: theme.blue, fontSize: 22, fontWeight: '600' },
  menuProfileName: { color: theme.textPrimary, fontSize: 17, fontWeight: '600' },
  menuProfileSub: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  menuChevron: { color: theme.textTertiary, fontSize: 22 },
  menuDivider: { height: 0.5, backgroundColor: theme.border, marginHorizontal: 20, marginVertical: 12 },
  menuSectionLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  menuGroup: { backgroundColor: theme.cardSecondary, borderRadius: 14, marginHorizontal: 14, marginBottom: 20, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 14, backgroundColor: theme.card },
  menuRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.border },
  menuRowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuRowLabel: { flex: 1, color: theme.textPrimary, fontSize: 15 },
  menuCloseBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  menuCloseText: { color: theme.textSecondary, fontSize: 13 },
  menuFooterText: { color: theme.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 8 },
});