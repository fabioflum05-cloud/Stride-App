import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { theme } from '../../constants/theme';

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
  const pressScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
      return () => { opacity.setValue(0); scale.setValue(0.96); };
    }, [])
  );

  function handlePressIn() {
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  }

  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
  }

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale: Animated.multiply(scale, pressScale) }] }]}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function DoneBadge({ color, text, bgColor }: { color: string; text: string; bgColor: string }) {
  const scale = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Animated.spring(scale, { toValue: 1, delay: 300, useNativeDriver: true, tension: 120, friction: 8 }).start();
      return () => scale.setValue(0);
    }, [])
  );

  return (
    <Animated.View style={[styles.doneBadge, { backgroundColor: bgColor, transform: [{ scale }] }]}>
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
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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

    if (rawSleep) { const s = JSON.parse(rawSleep); if (isToday(s.date)) { setSleepDone(true); setSleepScore(s.sleepScore); sl = s.sleepScore; } }
    if (rawCheckin) { const c = JSON.parse(rawCheckin); if (isToday(c.date ?? '')) { setCheckinDone(true); setCheckinScore(c.score); ch = c.score; } }
    if (rawBattery) { const b = JSON.parse(rawBattery); if (isToday(b.date)) { setBatteryLevel(b.level); bat = b.level; } }
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

      {/* Hero Card */}
      <AnimatedCard style={styles.heroCard} onPress={() => {}} delay={50}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroScoreLabel}>Performance Score</Text>
            <Text style={styles.heroScore}>{perfScore || '--'}</Text>
          </View>
          <View style={[styles.focusBadge, { backgroundColor: focusText.bg }]}>
            <Text style={[styles.focusBadgeText, { color: focusText.color }]}>{focusText.label}</Text>
          </View>
        </View>
        <View style={styles.heroBars}>
          {[
            { label: 'Perf.', value: perfScore, color: theme.blue },
            { label: 'Schlaf', value: sleepScore, color: theme.pink },
            { label: 'Energy', value: batteryLevel, color: theme.green },
          ].map(bar => (
            <View key={bar.label} style={styles.heroBarWrap}>
              <Text style={styles.heroBarLabel}>{bar.label}</Text>
              <View style={styles.heroBarTrack}>
                <View style={[styles.heroBarFill, { width: `${bar.value}%` as any, backgroundColor: bar.color }]} />
              </View>
            </View>
          ))}
        </View>
        <View style={styles.heroDots}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.heroDot, { backgroundColor: i < completedCount ? theme.blue : theme.border }]} />
          ))}
          <Text style={styles.heroDotsLabel}>{completedCount}/5 erledigt</Text>
        </View>
      </AnimatedCard>

      {/* Row 1: Schlaf (wide) + Battery (narrow) */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.wideCard, sleepDone && { borderColor: theme.pink, borderWidth: 1.5 }]}
          onPress={() => router.push('/sleep' as any)}
          delay={100}
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
          onPress={() => router.push('/battery' as any)}
          delay={150}
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

      {/* Row 2: Check-in + Habits + Gewicht */}
      <View style={styles.row}>
        <AnimatedCard
          style={[styles.thirdCard, checkinDone && { borderColor: theme.purple, borderWidth: 1.5 }]}
          onPress={() => router.push('/checkin' as any)}
          delay={200}
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
          onPress={() => router.push('/habits' as any)}
          delay={250}
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
          onPress={() => router.push('/weight' as any)}
          delay={300}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },

  // Hero
  heroCard: { backgroundColor: theme.card, borderRadius: 20, padding: 18, marginBottom: 12, ...theme.shadow },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroScoreLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  heroScore: { color: theme.textPrimary, fontSize: 44, fontWeight: '300', letterSpacing: -1 },
  focusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  focusBadgeText: { fontSize: 12, fontWeight: '500' },
  heroBars: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  heroBarWrap: { flex: 1 },
  heroBarLabel: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  heroBarTrack: { height: 4, backgroundColor: theme.cardSecondary, borderRadius: 2, overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: 2 },
  heroDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroDotsLabel: { color: theme.textSecondary, fontSize: 10, marginLeft: 4 },

  // Rows
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