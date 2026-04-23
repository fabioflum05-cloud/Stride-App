import { router, usePathname } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SleepIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M12 7V11L15 13" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckinIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M8.5 12L11 14.5L15.5 9.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HabitsIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={2} rx={1} fill={color} opacity={0.4} />
      <Rect x={3} y={11} width={18} height={2} rx={1} fill={color} opacity={0.7} />
      <Rect x={3} y={17} width={18} height={2} rx={1} fill={color} />
    </Svg>
  );
}

function HistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3V21M3 17L9 11L13 15L21 7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BatteryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={16} height={10} rx={2} stroke={color} strokeWidth={1.5} />
      <Path d="M19 10V14" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x={5} y={9} width={8} height={6} rx={1} fill={color} opacity={0.5} />
    </Svg>
  );
}

const TABS = [
  { route: '/(tabs)/', label: 'Home', Icon: HomeIcon },
  { route: '/(tabs)/sleep', label: 'Schlaf', Icon: SleepIcon },
  { route: '/(tabs)/checkin', label: 'Check-in', Icon: CheckinIcon },
  { route: '/(tabs)/habits', label: 'Habits', Icon: HabitsIcon },
  { route: '/(tabs)/history', label: 'Verlauf', Icon: HistoryIcon },
  { route: '/(tabs)/battery', label: 'Batterie', Icon: BatteryIcon },
];

export default function CustomTabBar() {
  const pathname = usePathname();

  function isActive(route: string) {
    if (route === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)/';
    return pathname.includes(route.replace('/(tabs)', ''));
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map(({ route, label, Icon }) => {
          const active = isActive(route);
          return (
            <TouchableOpacity
              key={route}
              style={styles.tab}
              onPress={() => router.push(route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.dotWrap}>
                <View style={[styles.dot, active && styles.dotActive]} />
              </View>
              <Icon color={active ? '#E2D9F3' : '#2A1F40'} />
              <Text style={[styles.label, active && styles.labelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#13102A',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-around',
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
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: '#E2D9F3',
    shadowColor: '#E2D9F3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  label: {
    color: '#2A1F40',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: '#E2D9F3',
  },
});