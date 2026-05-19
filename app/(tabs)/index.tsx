import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';
import { THEMES, useAppTheme } from '../../constants/ThemeContext';
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

function EnergyChart({ colors }: { colors: any }) {
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  const values = [20, 35, 75, 90, 85, 70, 55, 40, 25];
  const CW = W - 80; const H = 60; const pad = 10;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (CW - pad * 2);
    const y = H - pad - (v / 100) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const optimalStart = pad + (2 / (values.length - 1)) * (CW - pad * 2);
  const optimalEnd = pad + (4 / (values.length - 1)) * (CW - pad * 2);
  return (
    <View>
      <Svg width={CW} height={H}>
        <Defs>
          <LinearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.green} stopOpacity={0.15} />
            <Stop offset="1" stopColor={theme.green} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={`M ${optimalStart} ${pad} L ${optimalEnd} ${pad} L ${optimalEnd} ${H - pad} L ${optimalStart} ${H - pad} Z`} fill="url(#optGrad)" />
        <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * (CW - pad * 2);
          const y = H - pad - (v / 100) * (H - pad * 2);
          const color = v >= 70 ? theme.green : v >= 45 ? colors.accent : theme.red;
          return <Circle key={i} cx={x} cy={y} r={3} fill={color} />;
        })}
      </Svg>
      <View style={styles.energyTimes}>
        {hours.filter((_, i) => i % 2 === 0).map(h => (
          <Text key={h} style={[styles.energyTime, { color: theme.textSecondary }]}>{`${h}h`}</Text>
        ))}
      </View>
      <View style={styles.optimalBadge}>
        <View style={[styles.optimalDot, { backgroundColor: theme.green }]} />
        <Text style={styles.optimalText}>Optimal: 10–14 Uhr</Text>
      </View>
    </View>
  );
}

function IconUser({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconTrophy({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4C3.45 9 3 8.55 3 8V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V8C21 8.55 20.55 9 20 9H18M6 9C6 9 6 17 12 17C18 17 18 9 18 9M6 9H18M12 17V21M8 21H16" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconTarget() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={theme.purple} strokeWidth={1.5} /><Circle cx={12} cy={12} r={5} stroke={theme.purple} strokeWidth={1.5} /><Circle cx={12} cy={12} r={1.5} fill={theme.purple} /></Svg>; }
function IconCalendar() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M8 2V5M16 2V5M3 8H21M5 4H19C20.1 4 21 4.9 21 6V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V6C3 4.9 3.9 4 5 4Z" stroke={theme.green} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconWatch() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={6} stroke={theme.teal} strokeWidth={1.5} /><Path d="M12 9V12L14 14M9 3H15L16 6H8L9 3ZM8 18L9 21H15L16 18H8Z" stroke={theme.teal} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconHeart() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 21C12 21 3 14 3 8.5C3 6 5 4 7.5 4C9 4 10.5 4.8 12 6.5C13.5 4.8 15 4 16.5 4C19 4 21 6 21 8.5C21 14 12 21 12 21Z" stroke={theme.pink} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconUpload() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15M17 8L12 3L7 8M12 3V15" stroke={theme.teal} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconBell({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8ZM13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconSun({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={4} stroke={colors.accent} strokeWidth={1.5} /><Path d="M12 2V4M12 20V22M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M2 12H4M20 12H22M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconGlobe() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={theme.green} strokeWidth={1.5} /><Path d="M12 3C12 3 9 7 9 12C9 17 12 21 12 21M12 3C12 3 15 7 15 12C15 17 12 21 12 21M3 12H21" stroke={theme.green} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconLock() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M5 11H19C19.55 11 20 11.45 20 12V20C20 20.55 19.55 21 19 21H5C4.45 21 4 20.55 4 20V12C4 11.45 4.45 11 5 11ZM8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11" stroke={theme.textSecondary} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconCrown() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M2 19H22M3 15L5 7L9 11L12 4L15 11L19 7L21 15H3Z" stroke={theme.purple} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconChat({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconStar({ colors }: any) { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconDoc() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2ZM14 2V8H20M16 13H8M16 17H8M10 9H8" stroke={theme.textSecondary} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }
function IconLogout() { return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12L16 7M21 12H9" stroke={theme.red} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function IconChevron() { return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M9 18L15 12L9 6" stroke={theme.textTertiary} strokeWidth={1.5} strokeLinecap="round" /></Svg>; }

type MenuItem = { Icon: (p: any) => React.ReactElement; label: string; bg: string; onPress: () => void; badge?: string; badgeColor?: string; };

function MenuSection({ title, items, colors }: { title: string; items: MenuItem[]; colors: any }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <TouchableOpacity key={item.label} style={[styles.menuRow, { backgroundColor: colors.card }, i < items.length - 1 && styles.menuRowBorder]} onPress={item.onPress} activeOpacity={0.7}>
          <View style={[styles.menuRowIcon, { backgroundColor: item.bg }]}><item.Icon colors={colors} /></View>
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

export default function HomeScreen() {
  const { colors, themeIndex, setTheme } = useAppTheme();

  const [checkin, setCheckin] = useState<any>(null);
  const [sleep, setSleep] = useState<any>(null);
  const [battery, setBattery] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [habits, setHabits] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [themePickerVisible, setThemePickerVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const menuSlide = useRef(new Animated.Value(320)).current;
  const menuFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    load();
    fadeAnim.setValue(0); slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []));

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
      const mapped = h.map((habit: any) => ({ ...habit, completedToday: habit.completedDates?.some(isToday) ?? false }));
      setHabits(mapped);
      setStreak(calculateStreak(mapped));
    }
  }

  function calculateStreak(habitList: any[]): number {
    if (habitList.length === 0) return 0;
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
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
  const kcal = battery?.calorieEntries?.reduce((s: number, e: any) => s + e.kcal, 0) ?? 0;
  const firstName = profile?.name?.split(' ')[0] ?? 'Athlet';
  const fullName = profile?.name ?? 'Athlet';
  const initial = firstName.charAt(0).toUpperCase();
  const completedHabits = habits.filter(h => h.completedToday).length;
  const totalHabits = habits.length;
  const focusText = score >= 70 ? '💪 Vollgas möglich' : score >= 50 ? '⚡ Moderat halten' : score > 0 ? '🌙 Erholung heute' : '🌱 Score ausfüllen';

  const menuSections = [
    { title: 'Mein Konto', items: [
      { Icon: IconUser, label: 'Mein Profil', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => router.push('/profile' as any), 250); } },
      { Icon: IconTrophy, label: 'Abzeichen & Erfolge', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => router.push('/achievements' as any), 250); } },
      { Icon: IconTarget, label: 'Meine Ziele', bg: theme.purpleLight, onPress: () => { closeMenu(); setTimeout(() => router.push('/goals' as any), 250); } },
      { Icon: IconCalendar, label: 'Trainingsplan verwalten', bg: theme.greenLight, onPress: () => { closeMenu(); setTimeout(() => router.push('/training-plan' as any), 250); } },
    ]},
    { title: 'Gesundheit & Daten', items: [
      { Icon: IconWatch, label: 'Geräte & Wearables', bg: theme.tealLight, onPress: () => { closeMenu(); setTimeout(() => router.push('/devices' as any), 250); } },
      { Icon: IconHeart, label: 'Gesundheitsdaten', bg: theme.pinkLight, onPress: () => {} },
      { Icon: IconUpload, label: 'Daten exportieren', bg: colors.cardSecondary, onPress: () => {}, badge: 'Neu' },
    ]},
    { title: 'App & Einstellungen', items: [
      { Icon: IconBell, label: 'Benachrichtigungen', bg: colors.cardSecondary, onPress: () => {} },
      { Icon: IconSun, label: 'Erscheinungsbild', bg: colors.cardSecondary, onPress: () => { closeMenu(); setTimeout(() => setThemePickerVisible(true), 300); } },
      { Icon: IconGlobe, label: 'Sprache & Region', bg: theme.greenLight, onPress: () => {} },
      { Icon: IconLock, label: 'Datenschutz', bg: colors.cardSecondary, onPress: () => {} },
    ]},
    { title: 'Abo & Support', items: [
      { Icon: IconCrown, label: 'Pro-Abo verwalten', bg: theme.purpleLight, onPress: () => {}, badge: 'Pro', badgeColor: 'purple' },
      { Icon: IconChat, label: 'Support kontaktieren', bg: colors.cardSecondary, onPress: () => {} },
      { Icon: IconStar, label: 'App bewerten', bg: colors.cardSecondary, onPress: () => {} },
      { Icon: IconDoc, label: 'Nutzungsbedingungen', bg: colors.cardSecondary, onPress: () => {} },
    ]},
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>{getGreeting()}</Text>
              <Text style={[styles.name, { color: theme.textPrimary }]}>{firstName}</Text>
            </View>
            <TouchableOpacity style={[styles.menuBtn, { backgroundColor: colors.card }]} onPress={openMenu} activeOpacity={0.7}>
              <View style={[styles.menuBtnLine, { backgroundColor: colors.accent }]} />
              <View style={[styles.menuBtnLine, { width: 14, backgroundColor: colors.accent }]} />
              <View style={[styles.menuBtnLine, { width: 18, backgroundColor: colors.accent }]} />
            </TouchableOpacity>
          </View>

          <View style={[styles.scoreCard, { backgroundColor: colors.accent }]}>
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

          {streak > 0 && (
            <View style={[styles.streakCard, { backgroundColor: colors.cardSecondary, borderColor: colors.accent, borderWidth: 1 }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakTitle, { color: colors.accent }]}>{`${streak} Tage Streak!`}</Text>
                <Text style={[styles.streakSub, { color: theme.textSecondary }]}>Jeden Tag aktiv – weiter so!</Text>
              </View>
              <View style={[styles.streakBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.streakBadgeText}>{String(streak)}</Text>
              </View>
            </View>
          )}

          <View style={styles.statsRow}>
            {[
              { label: 'Sleep Score', value: sleepScore || '--', color: theme.pink },
              { label: 'kcal', value: kcal || '--', color: colors.accent },
              { label: 'Battery', value: batteryLevel || '--', color: theme.teal },
            ].map(s => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.statVal, { color: s.color }]}>{String(s.value)}</Text>
                <Text style={[styles.statLbl, { color: theme.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.energyCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Energie-Verlauf</Text>
            <EnergyChart colors={colors} />
          </View>

          <View style={[styles.habitsCard, { backgroundColor: colors.card }]}>
            <View style={styles.habitsHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Habits heute</Text>
              {totalHabits > 0 && (
                <View style={[styles.habitsBadge, { backgroundColor: colors.cardSecondary }]}>
                  <Text style={[styles.habitsBadgeText, { color: colors.accent }]}>{`${completedHabits}/${totalHabits} ✓`}</Text>
                </View>
              )}
            </View>
            {habits.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Keine Habits definiert</Text>
            ) : (
              habits.slice(0, 5).map((h, i) => (
                <View key={h.id} style={[styles.habitRow, i === Math.min(habits.length, 5) - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.habitCheck, h.completedToday && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                    {h.completedToday && <Text style={styles.habitCheckMark}>✓</Text>}
                  </View>
                  <Text style={[styles.habitName, { color: h.completedToday ? theme.textPrimary : theme.textSecondary }]}>{h.name}</Text>
                  {h.streak > 0 && <Text style={[styles.habitStreak, { color: colors.accent }]}>{`🔥 ${h.streak}`}</Text>}
                </View>
              ))
            )}
          </View>

          <View style={[styles.todayCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Heute erledigen</Text>
            {[
              { label: 'Schlaf Log', done: sleep !== null, route: '/sleep' },
              { label: 'Daily Check-in', done: checkin !== null, route: '/checkin' },
              { label: 'Body Battery', done: batteryLevel > 0, route: '/battery' },
            ].map((item, i) => (
              <TouchableOpacity key={item.label} style={[styles.todayRow, i === 2 && { borderBottomWidth: 0 }]} onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
                <View style={[styles.todayCheck, item.done && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  {item.done && <Text style={styles.todayCheckMark}>✓</Text>}
                </View>
                <Text style={[styles.todayLabel, { color: item.done ? theme.textPrimary : theme.textSecondary }]}>{item.label}</Text>
                <IconChevron />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

      {/* Menü Overlay */}
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
                  <Text style={[styles.menuProfileSub, { color: theme.textSecondary }]}>{`Pro-Mitglied · ${profile?.sport ?? 'Gym'}`}</Text>
                </View>
                <IconChevron />
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: colors.cardSecondary }]} />
              {menuSections.map(section => (
                <MenuSection key={section.title} title={section.title} items={section.items} colors={colors} />
              ))}
              <TouchableOpacity style={[styles.menuLogoutBtn, { borderTopColor: colors.cardSecondary }]} onPress={() => {}} activeOpacity={0.7}>
                <IconLogout />
                <Text style={styles.menuLogoutText}>Abmelden</Text>
              </TouchableOpacity>
              <Text style={[styles.menuFooterText, { color: theme.textTertiary }]}>Stride App · v1.0</Text>
              <View style={{ height: 40 }} />
            </ScrollView>
            <TouchableOpacity onPress={closeMenu} style={[styles.menuCloseBtn, { backgroundColor: colors.cardSecondary }]} activeOpacity={0.7}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6L18 18" stroke={theme.textSecondary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Theme Picker Modal */}
      <Modal visible={themePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setThemePickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: theme.textPrimary }}>Erscheinungsbild</Text>
            <TouchableOpacity onPress={() => setThemePickerVisible(false)} activeOpacity={0.7}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '500' }}>Fertig</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>Farbschema</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {THEMES.map((t, i) => (
              <TouchableOpacity
                key={t.name}
                onPress={() => setTheme(i)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  padding: 14, borderRadius: 14, marginBottom: 8,
                  backgroundColor: colors.card,
                  borderWidth: themeIndex === i ? 2 : 0.5,
                  borderColor: themeIndex === i ? t.accent : 'rgba(0,0,0,0.08)',
                }}
              >
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent }} />
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.bg }} />
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.cardSecondary }} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: t.accent, fontWeight: '500' }}>{t.name}</Text>
                {themeIndex === i && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>
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
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  greeting: { fontSize: 13 },
  name: { fontSize: 28, fontWeight: '600', marginTop: 2 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 10, gap: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  menuBtnLine: { height: 1.5, borderRadius: 1 },
  scoreCard: { borderRadius: 20, padding: 18, marginBottom: 12 },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  scoreLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  scoreNum: { color: '#fff', fontSize: 48, fontWeight: '300', lineHeight: 52 },
  focusBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  focusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  scoreBars: { flexDirection: 'row', gap: 10 },
  scoreBarWrap: { flex: 1 },
  scoreBarLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  scoreBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 2 },
  streakCard: { borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakEmoji: { fontSize: 24 },
  streakTitle: { fontSize: 14, fontWeight: '600' },
  streakSub: { fontSize: 11, marginTop: 2 },
  streakBadge: { borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  streakBadgeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statVal: { fontSize: 20, fontWeight: '600' },
  statLbl: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  energyCard: { borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  energyTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 10 },
  energyTime: { fontSize: 9 },
  optimalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: theme.greenLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  optimalDot: { width: 6, height: 6, borderRadius: 3 },
  optimalText: { color: '#1B5E20', fontSize: 11, fontWeight: '500' },
  habitsCard: { borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  habitsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  habitsBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  habitsBadgeText: { fontSize: 11, fontWeight: '500' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.textTertiary, alignItems: 'center', justifyContent: 'center' },
  habitCheckMark: { color: '#fff', fontSize: 11, fontWeight: '600' },
  habitName: { flex: 1, fontSize: 14 },
  habitStreak: { fontSize: 12, fontWeight: '500' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  todayCard: { borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  todayCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.textTertiary, alignItems: 'center', justifyContent: 'center' },
  todayCheckMark: { color: '#fff', fontSize: 11, fontWeight: '600' },
  todayLabel: { flex: 1, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  menuPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '80%', paddingTop: 56, borderLeftWidth: 0.5, borderLeftColor: 'rgba(0,0,0,0.08)' },
  menuProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 0.5 },
  menuAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  menuAvatarText: { fontSize: 20, fontWeight: '600' },
  menuProfileName: { fontSize: 16, fontWeight: '600' },
  menuProfileSub: { fontSize: 12, marginTop: 2 },
  menuDivider: { height: 0.5, marginBottom: 8 },
  menuSection: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 4, marginBottom: 4 },
  menuSectionTitle: { color: theme.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  menuRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  menuRowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuRowLabel: { flex: 1, fontSize: 15 },
  menuBadge: { backgroundColor: theme.greenLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 },
  menuBadgeText: { color: '#27500A', fontSize: 10, fontWeight: '500' },
  menuBadgePurple: { backgroundColor: theme.purpleLight },
  menuBadgeTextPurple: { color: theme.purple },
  menuLogoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4, borderTopWidth: 0.5 },
  menuLogoutText: { color: theme.red, fontSize: 15, fontWeight: '500' },
  menuCloseBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  menuFooterText: { fontSize: 11, textAlign: 'center', marginTop: 16 },
});