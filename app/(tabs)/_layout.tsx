import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../constants/ThemeContext';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HealthIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21C12 21 3 14 3 8.5C3 6 5 4 7.5 4C9 4 10.5 4.8 12 6.5C13.5 4.8 15 4 16.5 4C19 4 21 6 21 8.5C21 14 12 21 12 21Z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrainingIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M6 7H18M6 17H18M4 10H6V14H4M18 10H20V14H18M2 11H4V13H2M20 11H22V13H20"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function NutritionIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8 2 4 6 4 10C4 14 7 17 12 22C17 17 20 14 20 10C20 6 16 2 12 2Z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 6V12M9 9H15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function StopIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function BodyIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={2} stroke={color} strokeWidth={1.5} />
      <Path d="M12 7V14M9 9H15M9 21L12 14L15 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function PRIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9L12 2Z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TimerIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={1.5} />
      <Path d="M12 9V13L15 15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M9 3H15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

const MAIN_TABS = [
  { route: '/', label: 'Home', Icon: HomeIcon },
  { route: '/training', label: 'Training', Icon: TrainingIcon },
  { route: '/nutrition', label: 'Food', Icon: NutritionIcon },
  { route: '/health', label: 'Health', Icon: HealthIcon },
];

const MAIN_ROUTES = ['/', '/training', '/nutrition', '/health'];

const TRAINING_TABS = [
  { route: '/training', label: 'Workout', Icon: TrainingIcon },
  { route: '/body', label: 'Körper', Icon: BodyIcon },
  { route: '/workout-timer', label: 'Timer', Icon: TimerIcon },
  { route: '/prs', label: 'PRs', Icon: PRIcon },
  { route: '/', label: 'Beenden', Icon: StopIcon, isStop: true },
];

function MainTabBar({ pathname }: { pathname: string }) {
  const { colors } = useAppTheme();

  function getIndex() {
    if (pathname === '/') return 0;
    if (pathname.includes('/training') || pathname.includes('/body') ||
        pathname.includes('/ranking') || pathname.includes('/workout-timer') ||
        pathname.includes('/prs')) return 1;
    if (pathname.includes('/nutrition')) return 2;
    if (pathname.includes('/health') || pathname.includes('/sleep') ||
        pathname.includes('/checkin') || pathname.includes('/battery') ||
        pathname.includes('/habits') || pathname.includes('/weight')) return 3;
    return 0;
  }

  const currentIndex = getIndex();

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.container, {
        backgroundColor: colors.card,
        borderColor: 'rgba(0,0,0,0.08)',
      }]}>
        {MAIN_TABS.map(({ route, label, Icon }, index) => {
          const active = index === currentIndex;
          const isTrainingTab = index === 1;
          return (
            <TouchableOpacity
              key={route}
              style={styles.tab}
              onPress={() => { if (index !== currentIndex) router.push(route as any); }}
              activeOpacity={0.6}
            >
              <View style={styles.dotWrap}>
                {active && <View style={[styles.dotActive, { backgroundColor: colors.accent }]} />}
              </View>
              {isTrainingTab ? (
                <View style={{
                  backgroundColor: active ? colors.accent : colors.cardSecondary,
                  borderRadius: 14, width: 48, height: 36,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon color={active ? '#fff' : colors.accent} />
                </View>
              ) : (
                <Icon color={active ? colors.accent : '#C7C7CC'} />
              )}
              <Text style={[styles.label, active && { color: colors.accent, fontWeight: '500' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TrainingTabBar({ onStop }: { onStop: () => void }) {
  const pathname = usePathname();
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.container, {
        backgroundColor: colors.card,
        borderColor: 'rgba(0,0,0,0.08)',
      }]}>
        {TRAINING_TABS.map(({ route, label, Icon, isStop }: any) => {
          const active = !isStop && pathname.includes(route);
          return (
            <TouchableOpacity
              key={label}
              style={styles.tab}
              onPress={() => { if (isStop) onStop(); else router.push(route as any); }}
              activeOpacity={0.6}
            >
              <View style={styles.dotWrap}>
                {active && <View style={[styles.dotActive, { backgroundColor: colors.accent }]} />}
              </View>
              <Icon color={isStop ? '#FF3B30' : active ? colors.accent : '#C7C7CC'} />
              <Text style={[styles.label, active && { color: colors.accent }, isStop && { color: '#FF3B30' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedScreen() {
  const pathname = usePathname();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
  }, [pathname]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Slot />
    </Animated.View>
  );
}

export default function TabLayout() {
  const pathname = usePathname();
  const { colors } = useAppTheme();
  const [isTraining, setIsTraining] = useState(false);

  const currentIdx = MAIN_ROUTES.findIndex(r =>
    r === '/' ? pathname === '/' : pathname.startsWith(r)
  );

  useEffect(() => {
    async function checkTraining() {
      const raw = await AsyncStorage.getItem('activeWorkout');
      if (raw) {
        const w = JSON.parse(raw);
        const today = new Date();
        const date = new Date(w.date);
        const todayMatch =
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();
        setIsTraining(todayMatch);
      } else {
        setIsTraining(false);
      }
    }
    checkTraining();
    const interval = setInterval(checkTraining, 1000);
    return () => clearInterval(interval);
  }, [pathname]);

  async function stopTraining() {
    await AsyncStorage.removeItem('activeWorkout');
    setIsTraining(false);
    router.push('/');
  }

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-25, 25])
    .failOffsetY([-8, 8])
    .minDistance(30)
    .enabled(false)
    .onEnd((e) => {
      if (e.velocityX > 200 || e.translationX > 50) {
        if (currentIdx > 0) router.push(MAIN_ROUTES[currentIdx - 1] as any);
        else router.back();
        return;
      }
      if (e.velocityX < -200 || e.translationX < -50) {
        const next = MAIN_ROUTES[Math.min(currentIdx + 1, MAIN_ROUTES.length - 1)];
        if (next !== MAIN_ROUTES[currentIdx]) router.push(next as any);
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.bg }}>
          <View style={{ flex: 1, paddingBottom: 100 }}>
            <AnimatedScreen />
          </View>
          {isTraining
            ? <TrainingTabBar onStop={stopTraining} />
            : <MainTabBar pathname={pathname} />
          }
        </View>
      </KeyboardAvoidingView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 22, backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row', borderRadius: 26,
    borderWidth: 0.5,
    paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  dotWrap: { height: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dotActive: { width: 4, height: 4, borderRadius: 2 },
  label: { color: '#C7C7CC', fontSize: 9, letterSpacing: 0.5 },
});