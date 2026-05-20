import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { THEMES, useAppTheme } from '../../constants/ThemeContext';
import { theme } from '../../constants/theme';

const W = Dimensions.get('window').width;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function isToday(dateString: string) {
  const d = new Date(dateString), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Nachmittag';
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

// ─── Icons ────────────────────────────────────────────────────
function IconChevron({ color = '#B0A89E' }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconUser({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function IconTrophy({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4a1 1 0 01-1-1V4a1 1 0 011-1h16a1 1 0 011 1v4a1 1 0 01-1 1h-2m-10 0c0 4 3 8 6 8s6-4 6-8m-12 0h12M12 17v4m-4 0h8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconBell({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M18 8C18 6.4 17.4 4.9 16.2 3.8C15.1 2.6 13.6 2 12 2C10.4 2 8.9 2.6 7.8 3.8C6.6 4.9 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8ZM13.7 21C13.3 21.6 12.7 22 12 22C11.3 22 10.7 21.6 10.3 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function IconSun({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.5} /><Path d="M12 2V4M12 20V22M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M2 12H4M20 12H22M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function IconLock() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M5 11H19C19.55 11 20 11.45 20 12V20C20 20.55 19.55 21 19 21H5C4.45 21 4 20.55 4 20V12C4 11.45 4.45 11 5 11ZM8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11" stroke={theme.textSecondary} strokeWidth={1.5} strokeLinecap="round" /></Svg>;
}
function IconCrown() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M2 19H22M3 15L5 7L9 11L12 4L15 11L19 7L21 15H3Z" stroke={theme.purple} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconChat({ color }: { color: string }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconLogout() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M9 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H9M16 17L21 12L16 7M21 12H9" stroke={theme.red} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

// ─── Animated Ring ────────────────────────────────────────────
function AnimatedRing({ value, size, strokeWidth, color, trackColor, children }: {
  value: number; size: number; strokeWidth: number; color: string; trackColor: string; children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 1400, useNativeDriver: false }).start();
  }, [value]);

  const dashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashoffset}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

// ─── Bar ─────────────────────────────────────────────────────
function AnimatedBar({ value, color, trackColor, height = 4, delay = 0 }: {
  value: number; color: string; trackColor: string; height?: number; delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 1000, delay, useNativeDriver: false }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${value}%`] });
  return (
    <View style={{ height, backgroundColor: trackColor, borderRadius: height / 2, overflow: 'hidden' }}>
      <Animated.View style={{ height, backgroundColor: color, borderRadius: height / 2, width }} />
    </View>
  );
}

// ─── Menu ─────────────────────────────────────────────────────
type MenuItem = { Icon: (p: any) => React.ReactElement; label: string; bg: string; onPress: () => void; badge?: string; badgeColor?: string; };
function MenuSection({ title, items, colors }: { title: string; items: MenuItem[]; colors: any }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <TouchableOpacity key={item.label} style={[styles.menuRow, { backgroundColor: colors.card }, i < items.length - 1 && styles.menuRowBorder]} onPress={item.onPress} activeOpacity={0.7}>
          <View style={[styles.menuRowIcon, { backgroundColor: item.bg }]}><item.Icon color={colors.accent} /></View>
          <Text style={[styles.menuRowLabel, { color: theme.textPrimary }]}>{item.label}</Text>
          {item.badge && (
            <View style={[styles.menuBadge, item.badgeColor === 'purple' && styles.menuBadgePurple]}>
              <Text style={[styles.menuBadgeText, item.badgeColor === 'purple' && styles.menuBadgeTextPurple]}>{item.badge}</Text>
            </View>
          )}
          <IconChevron />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function UebersichtScreen() {
  const { colors, themeIndex, setTheme } = useAppTheme();

  const [checkin, setCheckin] = useState<any>(null);
  const [sleep, setSleep] = useState<any>(null);
  const [battery, setBattery] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [habits, setHabits] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [nutrition, setNutrition] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<any>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const menuSlide = useRef(new Animated.Value(320)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    load();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []));

  async function load() {
    try {
      const [rawCheckin, rawSleep, rawBattery, rawProfile, rawHabits, rawNutrition, rawWorkouts] = await Promise.all([
        AsyncStorage.getItem('lastCheckin'),
        AsyncStorage.getItem('lastSleep'),
        AsyncStorage.getItem('batteryData'),
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('habits'),
        AsyncStorage.getItem('nutritionToday'),
        AsyncStorage.getItem('workouts'),
      ]);
      if (rawCheckin) { const c = JSON.parse(rawCheckin); if (isToday(c.date ?? '')) setCheckin(c); }
      if (rawSleep) { const s = JSON.parse(rawSleep); if (isToday(s.date ?? '')) setSleep(s); }
      if (rawBattery) { const b = JSON.parse(rawBattery); if (isToday(b.date ?? '')) setBattery(b); }
      if (rawProfile) setProfile(JSON.parse(rawProfile));
      if (rawNutrition) setNutrition(JSON.parse(rawNutrition));
      if (rawWorkouts) setWorkouts(JSON.parse(rawWorkouts));
      if (rawHabits) {
        const h = JSON.parse(rawHabits);
        const mapped = h.map((habit: any) => ({ ...habit, completedToday: habit.completedDates?.some(isToday) ?? false }));
        setHabits(mapped);
        setStreak(calcStreak(mapped));
      }
    } catch {}
  }

  function calcStreak(habitList: any[]): number {
    if (!habitList.length) return 0;
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const anyDone = habitList.some(h => h.completedDates?.some((cd: string) => {
        const dd = new Date(cd);
        return dd.getDate() === d.getDate() && dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear();
      }));
      if (anyDone) s++; else break;
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
  const firstName = profile?.name?.split(' ')[0] ?? 'Athlet';
  const fullName = profile?.name ?? 'Athlet';
  const initial = firstName.charAt(0).toUpperCase();
  const completedHabits = habits.filter(h => h.completedToday).length;
  const totalHabits = habits.length;

  // Nutrition defaults
  const kcalGoal = nutrition?.goal ?? 2500;
  const kcalEaten = nutrition?.eaten ?? 0;
  const kcalBurned = nutrition?.burned ?? 0;
  const kcalPct = kcalGoal > 0 ? Math.min(100, Math.round((kcalEaten / kcalGoal) * 100)) : 0;
  const protein = nutrition?.protein ?? 0;
  const carbs = nutrition?.carbs ?? 0;
  const fat = nutrition?.fat ?? 0;

  // Training readiness
  const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core'];
  const readyCount = MUSCLE_GROUPS.filter(m => (muscles[m]?.level ?? 100) >= 80).length;
  const readinessScore = Math.round((readyCount / MUSCLE_GROUPS.length) * 10);

  const scoreColor = score >= 70 ? '#4A8C5C' : score >= 50 ? colors.accent : score > 0 ? '#C0392B' : '#B0A89E';
  const battColor = batteryLevel >= 60 ? '#4ADE80' : batteryLevel >= 30 ? '#E8C547' : '#E87B6E';

  const menuSections = [
    { title: 'Mein Konto', items: [
      { Icon: IconUser, label: 'Mein Profil', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => router.push('/profile' as any), 250); } },
      { Icon: IconTrophy, label: 'Abzeichen & Erfolge', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => router.push('/achievements' as any), 250); } },
    ]},
    { title: 'App & Einstellungen', items: [
      { Icon: IconBell, label: 'Benachrichtigungen', bg: colors.cardSecondary, onPress: () => {} },
      { Icon: IconSun, label: 'Erscheinungsbild', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => setThemePickerVisible(true), 300); } },
      { Icon: IconLock, label: 'Datenschutz', bg: colors.cardSecondary, onPress: () => {} },
    ]},
    { title: 'Abo & Support', items: [
      { Icon: IconCrown, label: 'Pro-Abo verwalten', bg: colors.cardSecondary, onPress: () => {}, badge: 'Pro', badgeColor: 'purple' },
      { Icon: IconChat, label: 'Support', bg: colors.cardSecondary, onPress: () => {} },
    ]},
  ];

  return (
    <View style={[styles.root, { backgroundColor: '#EEE8E0' }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── HEADER ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.dateLabel}>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.subGreeting}>Dein heutiger Status</Text>
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={styles.headerBtn} onPress={openMenu} activeOpacity={0.8}>
                <View style={styles.menuLine} />
                <View style={[styles.menuLine, { width: 12 }]} />
                <View style={styles.menuLine} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#1A1209" strokeWidth={1.8} strokeLinecap="round">
                  <Path d="M18 8C18 6.4 17.4 4.9 16.2 3.8C15.1 2.6 13.6 2 12 2C10.4 2 8.9 2.6 7.8 3.8C6.6 4.9 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8ZM13.7 21C13.3 21.6 12.7 22 12 22C11.3 22 10.7 21.6 10.3 21" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── PERFORMANCE SCORE ── */}
          <View style={styles.section}>
            <View style={[styles.scoreCard, { backgroundColor: '#1A1209' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View>
                  <Text style={styles.scoreEy}>Performance Score</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
                    <Text style={styles.scoreNum}>{score || '--'}</Text>
                    <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)', fontWeight: '600' }}>/100</Text>
                  </View>
                  <View style={[styles.scorePill, { backgroundColor: score >= 70 ? 'rgba(74,140,92,0.25)' : score >= 50 ? 'rgba(255,255,255,0.1)' : 'rgba(192,57,43,0.25)' }]}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: scoreColor, marginRight: 5 }} />
                    <Text style={{ fontSize: 10, color: scoreColor, fontWeight: '700' }}>
                      {score >= 70 ? 'Top Form' : score >= 50 ? 'Moderat' : score > 0 ? 'Erholen' : 'Daten fehlen'}
                    </Text>
                  </View>
                </View>
                <AnimatedRing value={score} size={88} strokeWidth={8} color="rgba(255,255,255,0.85)" trackColor="rgba(255,255,255,0.07)">
                  <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>Score</Text>
                </AnimatedRing>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Schlaf', value: sleepScore },
                  { label: 'Energy', value: batteryLevel },
                  { label: 'Check-in', value: checkin ? (checkin.energie ?? 3) * 20 : 0 },
                ].map(b => (
                  <View key={b.label} style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>{b.label}</Text>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>{b.value}</Text>
                    </View>
                    <AnimatedBar value={b.value} color="rgba(255,255,255,0.8)" trackColor="rgba(255,255,255,0.08)" height={3} />
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* ── SCHLAF + BATTERY ── */}
          <View style={styles.section}>
            <View style={[styles.darkCard, { backgroundColor: '#0D1B2A' }]}>
              {/* Stars */}
              {[[18, 30], [35, 80], [14, 240], [50, 270], [28, 200]].map(([top, left], i) => (
                <View key={i} style={{ position: 'absolute', width: i % 2 === 0 ? 3 : 2, height: i % 2 === 0 ? 3 : 2, borderRadius: 2, backgroundColor: `rgba(255,255,255,${[0.3, 0.2, 0.25, 0.15, 0.2][i]})`, top, left }} />
              ))}

              {/* Schlaf */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <View>
                  <Text style={styles.darkEy}>Schlafanalyse</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <Text style={styles.darkBigNum}>{sleepScore || '--'}</Text>
                    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: '600' }}>/100</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#5B9BD5' }} />
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                      {sleep ? `Gut · ${sleep.duration ?? '7h 20'} Min` : 'Kein Log heute'}
                    </Text>
                  </View>
                </View>
                <AnimatedRing value={sleepScore} size={84} strokeWidth={7} color="#5B9BD5" trackColor="rgba(255,255,255,0.07)">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="rgba(255,255,255,0.55)" strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                </AnimatedRing>
              </View>

              {/* Sleep stats */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                {[
                  { label: 'Tief', value: sleep?.deepPct ? `${sleep.deepPct}%` : '—' },
                  { label: 'Einschlaf', value: sleep?.bedTime ?? '—' },
                  { label: 'Aufwach', value: sleep?.wakeTime ?? '—' },
                ].map(s => (
                  <View key={s.label} style={styles.sleepStat}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{s.value}</Text>
                    <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 16 }} />

              {/* Battery */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                {/* Real battery svg */}
                <View style={{ alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Text style={styles.darkEy}>Battery</Text>
                  <View style={{ position: 'relative' }}>
                    {/* tip */}
                    <View style={{ width: 18, height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, marginLeft: 13, marginBottom: -2, zIndex: 3 }} />
                    {/* body */}
                    <View style={{ width: 44, height: 78, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', justifyContent: 'flex-end' }}>
                      {/* segments */}
                      {[25, 50, 75].map(pct => (
                        <View key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: `${pct}%` as any, height: 1, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 2 }} />
                      ))}
                      {/* fill */}
                      <View style={{ height: `${batteryLevel}%` as any, backgroundColor: battColor, borderRadius: 1 }}>
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%', backgroundColor: 'rgba(255,255,255,0.12)' }} />
                      </View>
                      {/* bolt */}
                      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={16} height={20} viewBox="0 0 24 24" fill="none">
                          <Path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                    <Text style={{ fontSize: 40, fontWeight: '800', color: battColor, letterSpacing: -1.5, lineHeight: 44 }}>{batteryLevel || '--'}</Text>
                    {batteryLevel > 0 && <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>%</Text>}
                  </View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 12 }}>
                    {batteryLevel >= 60 ? 'Gut · ↑ steigend' : batteryLevel >= 30 ? 'Moderat' : batteryLevel > 0 ? 'Niedrig' : 'Kein Eintrag'}
                  </Text>
                  {[
                    { label: 'Max heute', value: battery?.max ? `${battery.max}%` : '—' },
                    { label: 'Seit 8h', value: battery?.delta ? `+${battery.delta}%` : '—' },
                  ].map(r => (
                    <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{r.label}</Text>
                      <Text style={{ fontSize: 9, color: battColor, fontWeight: '700' }}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Schlafanalyse button */}
              <TouchableOpacity
                style={styles.sleepBtn}
                onPress={() => router.push('/sleep' as any)}
                activeOpacity={0.8}
              >
                <View style={styles.sleepBtnIcon}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="#5B9BD5" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#5B9BD5', letterSpacing: -0.2 }}>Zur Schlafanalyse</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(91,155,213,0.5)', marginTop: 2 }}>Tiefschlaf · REM · Verlauf</Text>
                </View>
                <View style={styles.sleepBtnArrow}>
                  <IconChevron color="#5B9BD5" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── ERNÄHRUNG ── */}
          <View style={styles.section}>
            <View style={[styles.lightCard]}>
              <Text style={styles.lightEy}>Ernährung heute</Text>

              {/* Big ring */}
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <AnimatedRing value={kcalPct} size={150} strokeWidth={12} color="#7B4A2D" trackColor="#F5EFE8">
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 34, fontWeight: '800', color: '#1A1209', letterSpacing: -1.5, lineHeight: 36 }}>{kcalEaten || '--'}</Text>
                    <Text style={{ fontSize: 9, color: '#B0A89E', fontWeight: '600', marginTop: 3 }}>kcal</Text>
                    <View style={{ backgroundColor: '#7B4A2D', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 7 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{kcalPct}%</Text>
                    </View>
                  </View>
                </AnimatedRing>
              </View>

              {/* Makros row */}
              <View style={styles.macroRow}>
                {[
                  { label: 'Protein', value: protein, unit: 'g', color: '#4A8C5C' },
                  { label: 'Carbs', value: carbs, unit: 'g', color: '#3A7AC0' },
                  { label: 'Fett', value: fat, unit: 'g', color: '#8B6914' },
                ].map((m, i) => (
                  <React.Fragment key={m.label}>
                    {i > 0 && <View style={styles.macroSep} />}
                    <View style={styles.macroItem}>
                      <Text style={[styles.macroVal, { color: m.color }]}>{m.value || '--'}<Text style={styles.macroUnit}>{m.value ? m.unit : ''}</Text></Text>
                      <Text style={styles.macroLbl}>{m.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={styles.nutritionBtn}
                onPress={() => router.push('/nutrition' as any)}
                activeOpacity={0.85}
              >
                <View style={styles.nutritionBtnIcon}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 }}>Zur Ernährung</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Details · Eintragen · Verlauf</Text>
                </View>
                <IconChevron color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── TRAININGSBEREITSCHAFT ── */}
          <View style={styles.section}>
  <View style={{ backgroundColor: '#1A1209', borderRadius: 24, padding: 20, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(74,140,92,0.08)', top: -60, right: -40 }} />

    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
      <View>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Trainingsbereitschaft</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>Push Day</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ADE80' }} />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600' }}>{readyCount} von 12 bereit</Text>
        </View>
      </View>
      <View style={{ backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 16, padding: 10, paddingHorizontal: 14, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(74,222,128,0.2)' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#4ADE80', letterSpacing: -1 }}>{readyCount}</Text>
        <Text style={{ fontSize: 8, color: 'rgba(74,222,128,0.5)', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>/12</Text>
      </View>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
      {[
        { name: 'Brust', pct: muscles['Brust']?.level ?? 100 },
        { name: 'Rücken', pct: muscles['Rücken']?.level ?? 100 },
        { name: 'Schultern', pct: muscles['Schultern']?.level ?? 100 },
        { name: 'Bizeps', pct: muscles['Bizeps']?.level ?? 100 },
        { name: 'Trizeps', pct: muscles['Trizeps']?.level ?? 100 },
        { name: 'Quadrizeps', pct: muscles['Quadrizeps']?.level ?? 100 },
        { name: 'Hamstrings', pct: muscles['Hamstrings']?.level ?? 100 },
        { name: 'Gesäß', pct: muscles['Gluteus']?.level ?? 100 },
        { name: 'Waden', pct: muscles['Waden']?.level ?? 100 },
        { name: 'Core', pct: muscles['Core']?.level ?? 100 },
        { name: 'Abduktoren', pct: muscles['Abduktoren']?.level ?? 100 },
        { name: 'Olympic', pct: 100 },
      ].map(m => {
        const col = m.pct >= 80 ? '#4ADE80' : m.pct >= 50 ? '#E8C547' : '#E87B6E';
        const bg = m.pct >= 80 ? 'rgba(74,222,128,0.12)' : m.pct >= 50 ? 'rgba(232,197,71,0.12)' : 'rgba(232,123,110,0.12)';
        return (
          <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: col }} />
            <Text style={{ fontSize: 9, fontWeight: '700', color: col }}>{m.name}</Text>
          </View>
        );
      })}
    </View>

    <View style={{ flexDirection: 'row', gap: 7 }}>
      <TouchableOpacity style={{ flex: 1.3, backgroundColor: '#fff', borderRadius: 14, padding: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => router.push('/training' as any)} activeOpacity={0.85}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A1209' }}>Zum Training</Text>
        <IconChevron color="rgba(0,0,0,0.3)" />
      </TouchableOpacity>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} onPress={() => router.push('/body' as any)} activeOpacity={0.85}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)' }}>Regen.</Text>
        <IconChevron color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    </View>
  </View>
</View>

              

          {/* ── HABITS + HEUTE ── */}
          {totalHabits > 0 && (
            <View style={styles.section}>
              <View style={styles.lightCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={styles.lightEy}>Habits heute</Text>
                  <View style={{ backgroundColor: '#F5EFE8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#D8D0C6' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#7B4A2D' }}>{completedHabits}/{totalHabits} ✓</Text>
                  </View>
                </View>
                {habits.slice(0, 4).map((h, i) => (
                  <View key={h.id} style={[styles.taskRow, i === Math.min(habits.length, 4) - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <View style={[styles.taskCheck, h.completedToday && { backgroundColor: '#7B4A2D', borderColor: '#7B4A2D' }]}>
                      {h.completedToday && (
                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                          <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                        </Svg>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: h.completedToday ? '#B0A89E' : '#1A1209', flex: 1, textDecorationLine: h.completedToday ? 'line-through' : 'none' }}>{h.name}</Text>
                    {h.streak > 0 && <Text style={{ fontSize: 10, color: '#7B4A2D', fontWeight: '700' }}>🔥 {h.streak}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── HEUTE ERLEDIGEN ── */}
          <View style={styles.section}>
            <View style={styles.lightCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={styles.lightEy}>Heute erledigen</Text>
                <Text style={{ fontSize: 9, color: '#7B4A2D', fontWeight: '700' }}>
                  {[sleep, checkin, batteryLevel > 0].filter(Boolean).length}/3
                </Text>
              </View>
              {[
                { label: 'Schlaf Log', done: sleep !== null, route: '/sleep' },
                { label: 'Daily Check-in', done: checkin !== null, route: '/checkin' },
                { label: 'Body Battery', done: batteryLevel > 0, route: '/battery' },
              ].map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.taskRow, i === 2 && { borderBottomWidth: 0, paddingBottom: 0 }]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.taskCheck, item.done && { backgroundColor: '#7B4A2D', borderColor: '#7B4A2D' }]}>
                    {item.done && (
                      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                        <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                      </Svg>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', flex: 1, color: item.done ? '#B0A89E' : '#1A1209', textDecorationLine: item.done ? 'line-through' : 'none' }}>{item.label}</Text>
                  {!item.done && <IconChevron />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── SIDE MENU ── */}
      {menuVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: menuFade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMenu} activeOpacity={1}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          </TouchableOpacity>
          <Animated.View style={[styles.menuPanel, { backgroundColor: colors.card, transform: [{ translateX: menuSlide }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <TouchableOpacity style={[styles.menuProfileRow, { borderBottomColor: colors.cardSecondary }]} onPress={() => { closeMenu(); setTimeout(() => router.push('/profile' as any), 250); }} activeOpacity={0.7}>
                <View style={[styles.menuAvatar, { backgroundColor: colors.cardSecondary }]}>
                  <Text style={[styles.menuAvatarText, { color: colors.accent }]}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuProfileName, { color: theme.textPrimary }]}>{fullName}</Text>
                  <Text style={[styles.menuProfileSub, { color: theme.textSecondary }]}>{`Pro · ${profile?.sport ?? 'Gym'}`}</Text>
                </View>
                <IconChevron />
              </TouchableOpacity>
              {menuSections.map(s => (
                <MenuSection key={s.title} title={s.title} items={s.items} colors={colors} />
              ))}
              <TouchableOpacity style={[styles.menuLogoutBtn, { borderTopColor: colors.cardSecondary }]} onPress={() => {}} activeOpacity={0.7}>
                <IconLogout />
                <Text style={styles.menuLogoutText}>Abmelden</Text>
              </TouchableOpacity>
              <Text style={[styles.menuFooter, { color: theme.textTertiary }]}>Stride · v1.0</Text>
              <View style={{ height: 40 }} />
            </ScrollView>
            <TouchableOpacity onPress={closeMenu} style={[styles.menuCloseBtn, { backgroundColor: colors.cardSecondary }]} activeOpacity={0.7}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6L18 18" stroke={theme.textSecondary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── THEME PICKER ── */}
      <Modal visible={themePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setThemePickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.textPrimary }}>Erscheinungsbild</Text>
            <TouchableOpacity onPress={() => setThemePickerVisible(false)} activeOpacity={0.7}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Fertig</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {THEMES.map((t, i) => (
              <TouchableOpacity key={t.name} onPress={() => setTheme(i)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, marginBottom: 8, backgroundColor: colors.card, borderWidth: themeIndex === i ? 2 : 0.5, borderColor: themeIndex === i ? t.accent : 'rgba(0,0,0,0.08)' }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[t.accent, t.bg, t.cardSecondary].map((c, j) => (
                    <View key={j} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} />
                  ))}
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: t.accent, fontWeight: '600' }}>{t.name}</Text>
                {themeIndex === i && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16 },
  dateLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: '#B0A89E', marginBottom: 7 },
  greeting: { fontSize: 30, fontWeight: '800', color: '#1A1209', letterSpacing: -1, lineHeight: 32 },
  subGreeting: { fontSize: 11, color: '#B0A89E', marginTop: 5 },
  headerBtn: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#fff', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  menuLine: { width: 16, height: 1.5, backgroundColor: '#1A1209', borderRadius: 1 },
  section: { paddingHorizontal: 14, marginBottom: 10 },
  scoreCard: { borderRadius: 24, padding: 20 },
  scoreEy: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' },
  scoreNum: { fontSize: 56, fontWeight: '800', color: '#fff', letterSpacing: -2.5, lineHeight: 56 },
  scorePill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  darkCard: { borderRadius: 24, padding: 20, overflow: 'hidden' },
  darkEy: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' },
  darkBigNum: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -2.5, lineHeight: 52 },
  sleepStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 8, alignItems: 'center' },
  sleepBtn: { backgroundColor: 'rgba(91,155,213,0.12)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(91,155,213,0.25)' },
  sleepBtnIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(91,155,213,0.2)', alignItems: 'center', justifyContent: 'center' },
  sleepBtnArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(91,155,213,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  lightEy: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: '#B0A89E', marginBottom: 0 },
  macroRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F5F1', borderRadius: 16, padding: 14, marginBottom: 16 },
  macroItem: { flex: 1, alignItems: 'center' },
  macroVal: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  macroUnit: { fontSize: 11, fontWeight: '600' },
  macroLbl: { fontSize: 9, color: '#B0A89E', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3, fontWeight: '700' },
  macroSep: { width: 0.5, height: 32, backgroundColor: 'rgba(0,0,0,0.07)' },
  nutritionBtn: { backgroundColor: '#7B4A2D', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nutritionBtnIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  readyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1209', letterSpacing: -0.5, marginTop: 4 },
  readyBadge: { backgroundColor: '#EAF4EE', borderRadius: 16, padding: 10, paddingHorizontal: 14, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(74,140,92,0.2)' },
  readyBtnDark: { flex: 1, backgroundColor: '#1A1209', borderRadius: 14, padding: 13 },
  readyBtnLight: { flex: 1, backgroundColor: '#F0EBE3', borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.07)' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D8D0C6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '80%', paddingTop: 56, borderLeftWidth: 0.5, borderLeftColor: 'rgba(0,0,0,0.08)' },
  menuProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 0.5 },
  menuAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { fontSize: 20, fontWeight: '700' },
  menuProfileName: { fontSize: 16, fontWeight: '700' },
  menuProfileSub: { fontSize: 12, marginTop: 2 },
  menuSection: { paddingBottom: 4, marginBottom: 4 },
  menuSectionTitle: { color: theme.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  menuRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  menuRowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuRowLabel: { flex: 1, fontSize: 15 },
  menuBadge: { backgroundColor: theme.greenLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 },
  menuBadgeText: { color: '#27500A', fontSize: 10, fontWeight: '600' },
  menuBadgePurple: { backgroundColor: theme.purpleLight },
  menuBadgeTextPurple: { color: theme.purple },
  menuLogoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4, borderTopWidth: 0.5 },
  menuLogoutText: { color: theme.red, fontSize: 15, fontWeight: '600' },
  menuCloseBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  menuFooter: { fontSize: 11, textAlign: 'center', marginTop: 16 },
});