import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
const LEVELS = [
  { level: 1, title: 'Rookie', minXP: 0, maxXP: 100, color: '#9CA3AF' },
  { level: 2, title: 'Athlete', minXP: 100, maxXP: 300, color: '#10B981' },
  { level: 3, title: 'Competitor', minXP: 300, maxXP: 600, color: '#06B6D4' },
  { level: 4, title: 'Elite', minXP: 600, maxXP: 1000, color: '#7C3AED' },
  { level: 5, title: 'Champion', minXP: 1000, maxXP: 2000, color: '#F59E0B' },
  { level: 6, title: 'Legend', minXP: 2000, maxXP: 99999, color: '#EC4899' },
];

const XP_REWARDS = [
  { action: 'Check-in ausfüllen', xp: 10, icon: '✓' },
  { action: 'Schlaf loggen', xp: 15, icon: '🌙' },
  { action: 'Training absolvieren', xp: 25, icon: '💪' },
  { action: 'Habit erledigen', xp: 5, icon: '⚡' },
  { action: 'Performance Score > 70', xp: 20, icon: '🎯' },
  { action: '7-Tage Streak', xp: 50, icon: '🔥' },
];

function getCurrentLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(xp: number) {
  const current = getCurrentLevel(xp);
  const idx = LEVELS.findIndex(l => l.level === current.level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

function XPRing({ xp, currentLevel, nextLevel }: { xp: number, currentLevel: typeof LEVELS[0], nextLevel: typeof LEVELS[0] | null }) {
  const progress = nextLevel
    ? (xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)
    : 1;
  const circumference = 2 * Math.PI * 54;
  const filled = progress * circumference;

  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Circle cx={70} cy={70} r={54} fill="none" stroke="#130C1E" strokeWidth={10} />
      <Circle cx={70} cy={70} r={54} fill="none" stroke={currentLevel.color} strokeWidth={10}
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference * 0.25}
        strokeLinecap="round"
        rotation={-90} origin="70,70"
      />
      <Path x={52} y={46} d="M18 10L12 2L6 10H10V18H14V10Z" fill={currentLevel.color} opacity={0.9} />
    </Svg>
  );
}

export default function RankingScreen() {
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lostXP, setLostXP] = useState(0);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalCheckins: 0,
    totalSleepLogs: 0,
    totalHabits: 0,
    avgScore: 0,
  });

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const rawWorkouts = await AsyncStorage.getItem('workouts');
        const rawCheckins = await AsyncStorage.getItem('checkinHistory');
        const rawSleep = await AsyncStorage.getItem('sleepHistory');
        const rawHabits = await AsyncStorage.getItem('habits');

        const workouts = rawWorkouts ? JSON.parse(rawWorkouts) : [];
        const checkins = rawCheckins ? JSON.parse(rawCheckins) : [];
        const sleepLogs = rawSleep ? JSON.parse(rawSleep) : [];
        const habits: any[] = rawHabits ? JSON.parse(rawHabits) : [];

        const totalHabitsCompleted = habits.reduce((sum, h) => sum + (h.completedDates?.length ?? 0), 0);
        const avgScore = checkins.length > 0
          ? Math.round(checkins.reduce((s: number, c: any) => s + c.score, 0) / checkins.length)
          : 0;

        const highScoreCheckins = checkins.filter((c: any) => c.score > 70).length;

        const today = new Date();
        
        // XP Verlust: für jeden Tag ohne Check-in in den letzten 7 Tagen -5 XP
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          return d.toDateString();
        });
        
        const checkinDays = new Set(checkins.map((c: any) => new Date(c.date).toDateString()));
        const missedCheckins = last7Days.filter(d => !checkinDays.has(d)).length;
        
        const sleepDays = new Set(sleepLogs.map((s: any) => new Date(s.date).toDateString()));
        const missedSleep = last7Days.filter(d => !sleepDays.has(d)).length;


        const earnedXP =
          workouts.length * 25 +
          checkins.length * 10 +
          sleepLogs.length * 15 +
          totalHabitsCompleted * 5 +
          highScoreCheckins * 20 +
          (streak >= 7 ? 50 : 0);
          const lostXP = missedCheckins * 5 + missedSleep * 5;
          const totalXP = Math.max(0, earnedXP - lostXP);

        setXp(totalXP);
        setLostXP(lostXP);
        setStats({
          totalWorkouts: workouts.length,
          totalCheckins: checkins.length,
          totalSleepLogs: sleepLogs.length,
          totalHabits: totalHabitsCompleted,
          avgScore,
        });

        const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak ?? 0), 0);
        setStreak(maxStreak);
      }
      load();
    }, [])
  );

  const currentLevel = getCurrentLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progressPct = nextLevel
    ? Math.round(((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100)
    : 100;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <Text style={styles.headerLabel}>Ranking</Text>
      <Text style={styles.title}>Dein{'\n'}Level</Text>

      <View style={styles.levelCard}>
        <View style={styles.levelLeft}>
          <XPRing xp={xp} currentLevel={currentLevel} nextLevel={nextLevel} />
        </View>
        <View style={styles.levelRight}>
          <Text style={styles.levelNumber}>Level {currentLevel.level}</Text>
          <Text style={[styles.levelTitle, { color: currentLevel.color }]}>{currentLevel.title}</Text>
          <Text style={styles.xpText}>{xp} XP</Text>
          {nextLevel && (
            <>
              <View style={styles.xpBar}>
                <View style={[styles.xpFill, { width: `${progressPct}%` as any, backgroundColor: currentLevel.color }]} />
              </View>
              <Text style={styles.nextLevelText}>
                {nextLevel.minXP - xp} XP bis {nextLevel.title}
              </Text>
            </>
          )}
          {!nextLevel && (
            <Text style={[styles.maxLevelText, { color: currentLevel.color }]}>Max Level erreicht!</Text>
          )}
        </View>
      </View>

      {streak >= 7 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakBadgeText}>🔥 {streak}-Tage Streak – +50 Bonus XP!</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Alle Level</Text>
      <View style={styles.levelsCard}>
        {LEVELS.map((l, i) => {
          const unlocked = xp >= l.minXP;
          const isCurrent = currentLevel.level === l.level;
          return (
            <View key={i} style={[styles.levelRow, isCurrent && styles.levelRowActive]}>
              <View style={[styles.levelDot, { backgroundColor: unlocked ? l.color : '#1A1A2E', borderColor: l.color + '60' }]} />
              <View style={styles.levelInfo}>
                <Text style={[styles.levelName, { color: unlocked ? l.color : '#3D2E5C' }]}>
                  Level {l.level} – {l.title}
                </Text>
                <Text style={styles.levelXP}>{l.minXP} XP</Text>
              </View>
              {isCurrent && <Text style={[styles.currentBadge, { color: l.color }]}>Aktuell</Text>}
              {unlocked && !isCurrent && <Text style={styles.unlockedBadge}>✓</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>XP Verdienen</Text>
      <View style={styles.rewardsCard}>
        {XP_REWARDS.map((r, i) => (
          <View key={i} style={styles.rewardRow}>
            <Text style={styles.rewardIcon}>{r.icon}</Text>
            <Text style={styles.rewardAction}>{r.action}</Text>
            <Text style={styles.rewardXP}>+{r.xp} XP</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Statistiken</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#A78BFA' }]}>{stats.totalWorkouts}</Text>
          <Text style={styles.statLbl}>Trainings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#67E8F9' }]}>{stats.totalCheckins}</Text>
          <Text style={styles.statLbl}>Check-ins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#EC4899' }]}>{stats.totalSleepLogs}</Text>
          <Text style={styles.statLbl}>Schlaf Logs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, { color: '#FB923C' }]}>{stats.avgScore || '--'}</Text>
          <Text style={styles.statLbl}>Ø Score</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07040F',
    paddingHorizontal: 20,
    paddingBottom: 120,
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
    marginBottom: 24,
  },
  levelCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 16,
  },
  levelLeft: {
    alignItems: 'center',
  },
  levelRight: {
    flex: 1,
    gap: 6,
  },
  levelNumber: {
    color: '#5B4A8A',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelTitle: {
    fontSize: 28,
    fontWeight: '500',
  },
  xpText: {
    color: '#E2D9F3',
    fontSize: 16,
    fontWeight: '500',
  },
  xpBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
  },
  nextLevelText: {
    color: '#5B4A8A',
    fontSize: 11,
  },
  maxLevelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  streakBadge: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(245,158,11,0.3)',
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  streakBadgeText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  levelsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  levelRowActive: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  levelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 13,
    fontWeight: '500',
  },
  levelXP: {
    color: '#3D2E5C',
    fontSize: 11,
    marginTop: 2,
  },
  currentBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  unlockedBadge: {
    color: '#10B981',
    fontSize: 13,
  },
  rewardsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  rewardAction: {
    flex: 1,
    color: '#C4B5D9',
    fontSize: 13,
  },
  rewardXP: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 40,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
  },
  statVal: {
    fontSize: 28,
    fontWeight: '500',
  },
  statLbl: {
    color: '#5B4A8A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
});