import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
      <Path d="M6 4V20M18 4V20M3 8H7M17 8H21M3 16H7M17 16H21M7 12H17"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function HistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3V21M3 17L9 11L13 15L21 7"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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
  { route: '/health', label: 'Health', Icon: HealthIcon },
  { route: '/training', label: 'Training', Icon: TrainingIcon },
  { route: '/history', label: 'Verlauf', Icon: HistoryIcon },
];

const TRAINING_TABS = [
  { route: '/training', label: 'Workout', Icon: TrainingIcon },
  { route: '/body', label: 'Körper', Icon: BodyIcon },
  { route: '/workout-timer', label: 'Timer', Icon: TimerIcon },
  { route: '/prs', label: 'PRs', Icon: PRIcon },
  { route: '/', label: 'Beenden', Icon: StopIcon, isStop: true },
];

function MainTabBar({ pathname }: { pathname: string }) {
  function getIndex() {
    if (pathname === '/') return 0;
    if (pathname.includes('/health') || pathname.includes('/sleep') || pathname.includes('/checkin') || pathname.includes('/battery') || pathname.includes('/habits')) return 1;
    if (pathname.includes('/training') || pathname.includes('/body') || pathname.includes('/ranking') || pathname.includes('/workout-timer') || pathname.includes('/prs')) return 2;
    if (pathname.includes('/history')) return 3;
    return 0;
  }

  const currentIndex = getIndex();

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {MAIN_TABS.map(({ route, label, Icon }, index) => {
          const active = index === currentIndex;
          return (
            <TouchableOpacity
              key={route}
              style={styles.tab}
              onPress={() => { if (index !== currentIndex) router.push(route as any); }}
              activeOpacity={0.6}
            >
              <View style={styles.dotWrap}>
                {active && <View style={styles.dotActive} />}
              </View>
              <Icon color={active ? '#A5F3FC' : '#1A3A4A'} />
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TrainingTabBar({ onStop }: { onStop: () => void }) {
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, styles.trainingContainer]}>
        {TRAINING_TABS.map(({ route, label, Icon, isStop }: any) => {
          const active = pathname.includes(route) && !isStop;
          return (
            <TouchableOpacity
              key={label}
              style={styles.tab}
              onPress={() => {
                if (isStop) {
                  onStop();
                } else {
                  router.push(route as any);
                }
              }}
              activeOpacity={0.6}
            >
              <View style={styles.dotWrap}>
                {active && <View style={[styles.dotActive, { backgroundColor: '#FB7185' }]} />}
              </View>
              <Icon color={isStop ? '#FB7185' : active ? '#FB923C' : '#1A3A4A'} />
              <Text style={[styles.label, active && { color: '#FB923C' }, isStop && { color: '#FB7185' }]}>
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [pathname]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <Slot />
    </Animated.View>
  );
}

export default function TabLayout() {
  const pathname = usePathname();
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    async function checkTraining() {
      const raw = await AsyncStorage.getItem('activeWorkout');
      if (raw) {
        const w = JSON.parse(raw);
        const today = new Date();
        const date = new Date(w.date);
        const isToday = date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();
        setIsTraining(isToday);
      } else {
        setIsTraining(false);
      }
    }
    checkTraining();
  }, [pathname]);

  async function stopTraining() {
    await AsyncStorage.removeItem('activeWorkout');
    setIsTraining(false);
    router.push('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#07040F' }}>
      <View style={{ flex: 1, paddingBottom: 100 }}>
        <AnimatedScreen />
      </View>
      {isTraining
        ? <TrainingTabBar onStop={stopTraining} />
        : <MainTabBar pathname={pathname} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 22,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#080E12',
    borderRadius: 26,
    borderWidth: 0.5,
    borderColor: 'rgba(34,211,238,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  trainingContainer: {
    borderColor: 'rgba(251,146,60,0.3)',
    backgroundColor: '#120A05',
    shadowColor: '#FB923C',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dotWrap: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dotActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  label: {
    color: '#1A3A4A',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: '#A5F3FC',
  },
});