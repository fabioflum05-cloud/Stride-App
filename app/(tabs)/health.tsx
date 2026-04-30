import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function AnimatedCard({ children, style, onPress, delay = 0 }: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  delay?: number;
}) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 400, delay,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1, delay,
          useNativeDriver: true,
          tension: 60, friction: 10,
        }),
      ]).start();
      return () => { opacity.setValue(0); scale.setValue(0.96); };
    }, [])
  );

  const pressScale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(pressScale, {
      toValue: 0.97, useNativeDriver: true,
      tension: 200, friction: 10,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(pressScale, {
      toValue: 1, useNativeDriver: true,
      tension: 200, friction: 10,
    }).start();
  }

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function DoneBadge({ color, text }: { color: string; text: string }) {
  const scale = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Animated.spring(scale, {
        toValue: 1, delay: 300,
        useNativeDriver: true,
        tension: 120, friction: 8,
      }).start();
      return () => scale.setValue(0);
    }, [])
  );

  return (
    <Animated.View style={[styles.doneBadge, {
      backgroundColor: color + '20',
      borderColor: color + '40',
      transform: [{ scale }],
    }]}>
      <Text style={[styles.doneBadgeText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

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

  const headerAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      load();
      Animated.timing(headerAnim, {
        toValue: 1, duration: 500,
        useNativeDriver: true,
      }).start();
      return () => headerAnim.setValue(0);
    }, [])
  );

  async function load() {
    const rawSleep = await AsyncStorage.getItem('lastSleep');
    const rawCheckin = await AsyncStorage.getItem('lastCheckin');
    const rawBattery = await AsyncStorage.getItem('batteryData');
    const rawHabits = await AsyncStorage.getItem('habits');
    const rawProfile = await AsyncStorage.getItem('profile');
    const rawWeight = await AsyncStorage.getItem('weightHistory');

    let sl = 0, ch = 0, bat = 0;

    if (rawSleep) {
      const s = JSON.parse(rawSleep);
      if (isToday(s.date)) { setSleepDone(true); setSleepScore(s.sleepScore); sl = s.sleepScore; }
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
      setHabitsCompleted(h.filter((habit: any) => habit.completedDates?.some(isToday)).length);
    }
    if (rawWeight) {
      const w = JSON.parse(rawWeight);
      if (w.length > 0) setCurrentWeight(w[w.length - 1].weight + ' kg');
    } else if (rawProfile) {
      const p = JSON.parse(rawProfile);
      if (p.weight) setCurrentWeight(p.weight + ' kg');
    }

    const score = sl && ch
      ? Math.round(sl * 0.35 + ch * 0.35 + bat * 0.3)
      : sl ? Math.round(sl * 0.6 + bat * 0.4)
      : 0;
    setPerfScore(score);
  }

  const focusText = perfScore >= 70
    ? { label: 'Vollgas möglich 💪', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' }
    : perfScore >= 50
    ? { label: 'Moderat halten ⚡', color: '#FB923C', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)' }
    : perfScore > 0
    ? { label: 'Erholung heute 🌙', color: '#F472B6', bg: 'rgba(244,114,182,0.15)', border: 'rgba(244,114,182,0.3)' }
    : { label: 'Log ausfüllen ✍️', color: '#5B4A8A', bg: 'rgba(91,74,138,0.15)', border: 'rgba(91,74,138,0.3)' };

  const completedCount = [sleepDone, checkinDone, batteryLevel > 0,
    habitsCompleted === habitsTotal && habitsTotal > 0, currentWeight !== null].filter(Boolean).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }]
      }}>
        <Text style={styles.headerLabel}>Health</Text>
        <Text style={styles.title}>Deine{'\n'}Gesundheit</Text>
      </Animated.View>

      {/* Hero Score Card */}
      <AnimatedCard
        style={styles.heroCard}
        onPress={() => {}}
        delay={50}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroScoreLabel}>Performance Score</Text>
            <Text style={styles.heroScore}>{perfScore || '--'}</Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroCompletedLabel}>Heute</Text>
            <View style={[styles.focusBadge, { backgroundColor: focusText.bg, borderColor: focusText.border }]}>
              <Text style={[styles.focusBadgeText, { color: focusText.color }]}>{focusText.label}</Text>
            </View>
          </View>
        </View>

        {/* Progress Bars */}
        <View style={styles.heroBars}>
          {[
            { label: 'Perf.', value: perfScore, color: '#7C3AED' },
            { label: 'Schlaf', value: sleepScore, color: '#EC4899' },
            { label: 'Energy', value: batteryLevel, color: '#06B6D4' },
          ].map(bar => (
            <View key={bar.label} style={styles.heroBarWrap}>
              <Text style={styles.heroBarLabel}>{bar.label}</Text>
              <View style={styles.heroBarTrack}>
                <Animated.View style={[styles.heroBarFill, {
                  width: `${bar.value}%` as any,
                  backgroundColor: bar.color,
                }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Completed Dots */}
        <View style={styles.heroDots}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.heroDot, {
              backgroundColor: i < completedCount ? '#7C3AED' : 'rgba(255,255,255,0.08)'
            }]} />
          ))}
          <Text style={styles.heroDotsLabel}>{completedCount}/5 erledigt</Text>
        </View>
      </AnimatedCard>

      {/* Row 1: Schlaf (wide) + Battery (narrow) */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.wideCard, { borderColor: sleepDone ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.push('/sleep' as any)}
          delay={100}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke="#EC4899" strokeWidth={1.5} />
              <Path d="M12 7V11L15 13" stroke="#EC4899" strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Schlaf</Text>
          <Text style={[styles.cardVal, { color: sleepDone ? '#EC4899' : '#3D2E5C' }]}>
            {sleepDone ? `Score ${sleepScore}` : 'Noch nicht geloggt'}
          </Text>
          {sleepDone && <DoneBadge color="#EC4899" text="✓ Geloggt" />}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.narrowCard, { borderColor: batteryLevel > 0 ? 'rgba(103,232,249,0.3)' : 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.push('/battery' as any)}
          delay={150}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(103,232,249,0.12)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={7} width={16} height={10} rx={2} stroke="#67E8F9" strokeWidth={1.5} />
              <Path d="M19 10V14" stroke="#67E8F9" strokeWidth={2} strokeLinecap="round" />
              <Rect x={5} y={9} width={batteryLevel > 0 ? 8 : 2} height={6} rx={1} fill="#67E8F9" opacity={0.5} />
            </Svg>
          </View>
          <Text style={styles.cardName}>Battery</Text>
          <Text style={[styles.cardVal, { color: batteryLevel > 0 ? '#67E8F9' : '#3D2E5C', fontSize: 10 }]}>
            {batteryLevel > 0 ? `${batteryLevel}%` : 'Nicht gestartet'}
          </Text>
          {batteryLevel > 0 && <DoneBadge color="#67E8F9" text="✓" />}
        </AnimatedCard>
      </View>

      {/* Row 2: Check-in + Habits + Gewicht */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.thirdCard, { borderColor: checkinDone ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.push('/checkin' as any)}
          delay={200}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke="#A78BFA" strokeWidth={1.5} />
              <Path d="M8.5 12L11 14.5L15.5 9.5" stroke="#A78BFA" strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Check-in</Text>
          <Text style={[styles.cardVal, { color: checkinDone ? '#A78BFA' : '#3D2E5C' }]}>
            {checkinDone ? `Score ${checkinScore}` : 'Ausstehend'}
          </Text>
          {checkinDone && <DoneBadge color="#A78BFA" text="✓" />}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.thirdCard, { borderColor: habitsTotal > 0 ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.push('/habits' as any)}
          delay={250}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(251,146,60,0.12)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={5} width={18} height={2} rx={1} fill="#FB923C" opacity={0.4} />
              <Rect x={3} y={11} width={18} height={2} rx={1} fill="#FB923C" opacity={0.7} />
              <Rect x={3} y={17} width={18} height={2} rx={1} fill="#FB923C" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Habits</Text>
          <Text style={[styles.cardVal, { color: habitsTotal > 0 ? '#FB923C' : '#3D2E5C' }]}>
            {habitsTotal > 0 ? `${habitsCompleted}/${habitsTotal}` : 'Keine'}
          </Text>
          {habitsCompleted === habitsTotal && habitsTotal > 0 && <DoneBadge color="#FB923C" text="✓" />}
        </AnimatedCard>

        <AnimatedCard
          style={[styles.thirdCard, { borderColor: currentWeight ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)' }]}
          onPress={() => router.push('/weight' as any)}
          delay={300}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3C9 3 6.5 5 6.5 8C6.5 9.5 7 10.8 8 11.8L5 21H19L16 11.8C17 10.8 17.5 9.5 17.5 8C17.5 5 15 3 12 3Z"
                stroke="#A78BFA" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.cardName}>Gewicht</Text>
          <Text style={[styles.cardVal, { color: currentWeight ? '#A78BFA' : '#3D2E5C', fontSize: 10 }]}>
            {currentWeight ?? 'Nicht geloggt'}
          </Text>
          {currentWeight && <DoneBadge color="#A78BFA" text="✓" />}
        </AnimatedCard>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 20 },

  // Hero Card
  heroCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', padding: 18, marginBottom: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroScoreLabel: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  heroScore: { color: '#E2D9F3', fontSize: 44, fontWeight: '300', letterSpacing: -1 },
  heroRight: { alignItems: 'flex-end', gap: 8 },
  heroCompletedLabel: { color: '#5B4A8A', fontSize: 10 },
  focusBadge: { borderRadius: 20, borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 5 },
  focusBadgeText: { fontSize: 11, fontWeight: '500' },
  heroBars: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  heroBarWrap: { flex: 1 },
  heroBarLabel: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  heroBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: 2 },
  heroDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroDotsLabel: { color: '#5B4A8A', fontSize: 10, marginLeft: 4 },

  // Rows
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },

  // Cards base
  wideCard: { flex: 2, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 0.5, padding: 14, gap: 6 },
  narrowCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 0.5, padding: 14, gap: 6 },
  thirdCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 0.5, padding: 12, gap: 5 },
  cardIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardName: { color: '#E2D9F3', fontSize: 12, fontWeight: '500' },
  cardVal: { fontSize: 11 },

  // Done Badge
  doneBadge: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 0.5, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  doneBadgeText: { fontSize: 9, fontWeight: '500' },
});