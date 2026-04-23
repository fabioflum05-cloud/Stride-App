import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect as useEff, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

type CheckinData = {
  energie: number;
  stress: number;
  motivation: number;
  score: number;
  date?: string;
};

type SleepData = {
  sleepScore: number;
  hrv: number;
  schlafStunden: number;
  date?: string;
};

type BatteryData = {
  level: number;
  date?: string;
};

function calculatePerformanceScore(checkin: CheckinData | null, sleep: SleepData | null, battery: BatteryData | null): number {
  if (!checkin && !sleep) return 0;

  const sleepScore = sleep?.sleepScore ?? 50;
  const energieScore = checkin ? checkin.energie * 20 : 50;
  const stressScore = checkin ? (6 - checkin.stress) * 20 : 50;
  const motivationScore = checkin ? checkin.motivation * 20 : 50;
  const batteryScore = battery?.level ?? 50;

  return Math.round(
    sleepScore * 0.30 +
    energieScore * 0.20 +
    stressScore * 0.20 +
    motivationScore * 0.15 +
    batteryScore * 0.15
  );
}

function AnimatedRings({ progress, score, sleepScore, energieScore }: {
  progress: Animated.Value,
  score: number,
  sleepScore: number,
  energieScore: number
}) {
  const [p, setP] = useState(0);

  useEff(() => {
    const listener = progress.addListener(({ value }) => setP(value));
    return () => progress.removeListener(listener);
  }, []);

  const toArc = (val: number, radius: number) => {
    const circumference = 2 * Math.PI * radius;
    const filled = (Math.min(val, 100) / 100) * circumference;
    return `${filled * p} ${circumference - filled * p}`;
  };

  return (
    <Svg width={200} height={200} viewBox="0 0 160 160">
      <Circle cx={80} cy={80} r={68} fill="none" stroke="#130C1E" strokeWidth={12} />
      <Circle cx={80} cy={80} r={68} fill="none" stroke="#7C3AED" strokeWidth={12}
        strokeDasharray={toArc(score, 68)}
        strokeDashoffset={2 * Math.PI * 68 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <Circle cx={80} cy={80} r={52} fill="none" stroke="#130C1E" strokeWidth={10} />
      <Circle cx={80} cy={80} r={52} fill="none" stroke="#EC4899" strokeWidth={10}
        strokeDasharray={toArc(sleepScore, 52)}
        strokeDashoffset={2 * Math.PI * 52 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <Circle cx={80} cy={80} r={36} fill="none" stroke="#130C1E" strokeWidth={8} />
      <Circle cx={80} cy={80} r={36} fill="none" stroke="#06B6D4" strokeWidth={8}
        strokeDasharray={toArc(energieScore, 36)}
        strokeDashoffset={2 * Math.PI * 36 * 0.25}
        strokeLinecap="round" rotation={-90} origin="80,80" />
      <SvgText x={80} y={82} textAnchor="middle" fill="#E2D9F3" fontSize={28} fontWeight="500">
        {Math.round(score * p)}
      </SvgText>
      <SvgText x={80} y={94} textAnchor="middle" fill="#5B4A8A" fontSize={9} letterSpacing={2}>
        SCORE
      </SvgText>
    </Svg>
  );
}

export default function ScoreRevealScreen() {
  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [sleep, setSleep] = useState<SleepData | null>(null);
  const [battery, setBattery] = useState<BatteryData | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fadeCards = useRef(new Animated.Value(0)).current;
  const fadeLabel = useRef(new Animated.Value(0)).current;

  useEff(() => {
    async function load() {
      const rawCheckin = await AsyncStorage.getItem('lastCheckin');
      const rawSleep = await AsyncStorage.getItem('lastSleep');
      const rawBattery = await AsyncStorage.getItem('batteryData');
      if (rawCheckin) setCheckin(JSON.parse(rawCheckin));
      if (rawSleep) setSleep(JSON.parse(rawSleep));
      if (rawBattery) setBattery(JSON.parse(rawBattery));
    }
    load().then(() => {
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.parallel([
          Animated.timing(fadeLabel, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(fadeCards, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, []);

  const score = calculatePerformanceScore(checkin, sleep, battery);
  const sleepScore = sleep?.sleepScore ?? 0;
  const energieScore = checkin ? checkin.energie * 20 : 0;
  const scoreColor = score >= 70 ? '#A78BFA' : score >= 50 ? '#F472B6' : '#FB7185';
  const scoreText = score >= 70 ? 'Gut – weiter so!' : score >= 50 ? 'Moderat – bleib dran!' : 'Erholung empfohlen';

  const breakdown = [
    { label: 'Schlaf', value: sleepScore, weight: '30%', color: '#EC4899' },
    { label: 'Energie', value: energieScore, weight: '20%', color: '#67E8F9' },
    { label: 'Stress', value: checkin ? (6 - checkin.stress) * 20 : 0, weight: '20%', color: '#F472B6' },
    { label: 'Motivation', value: checkin ? checkin.motivation * 20 : 0, weight: '15%', color: '#FB923C' },
    { label: 'Battery', value: battery?.level ?? 0, weight: '15%', color: '#A78BFA' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Performance Score</Text>
      <Text style={styles.title}>Dein heutiger{'\n'}Score</Text>

      <View style={styles.ringsWrap}>
        <AnimatedRings progress={progress} score={score} sleepScore={sleepScore} energieScore={energieScore} />
      </View>

      <Animated.View style={{ opacity: fadeLabel }}>
        <Text style={[styles.scoreText, { color: scoreColor }]}>{scoreText}</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeCards }}>
        <Text style={styles.sectionTitle}>Score Aufschlüsselung</Text>
        <View style={styles.breakdownCard}>
          {breakdown.map((item, i) => (
            <View key={i} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownWeight}>{item.weight}</Text>
              </View>
              <View style={styles.breakdownBarWrap}>
                <View style={[styles.breakdownBar, { width: `${item.value}%` as any, backgroundColor: item.color }]} />
              </View>
              <Text style={[styles.breakdownVal, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
        <Text style={styles.homeBtnText}>Zum Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07040F',
    paddingHorizontal: 20,
  },
  headerLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 60,
    marginBottom: 12,
  },
  title: {
    color: '#E2D9F3',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 36,
    marginBottom: 16,
  },
  ringsWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  scoreText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  breakdownCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakdownLabel: {
    color: '#C4B5D9',
    fontSize: 12,
  },
  breakdownWeight: {
    color: '#3D2E5C',
    fontSize: 10,
  },
  breakdownBarWrap: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '500',
    width: 28,
    textAlign: 'right',
  },
  homeBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 120,
    backgroundColor: '#7C3AED',
  },
  homeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});