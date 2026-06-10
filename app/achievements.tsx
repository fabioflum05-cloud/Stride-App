import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';

const SW = Dimensions.get('window').width;

type Badge = {
  id: string; title: string; titleEn: string; desc: string; descEn: string;
  color: string; bg: string; xp: number;
  unlocked: boolean; progress?: number; total?: number;
  category: string; tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  unlockedAt?: string; unlockedAtEn?: string;
};

type DailyQuest = {
  id: string; title: string; titleEn: string; desc: string; descEn: string;
  xp: number; completed: boolean; color: string; bg: string;
  progress: number; total: number;
};

type SeasonChallenge = {
  id: string; title: string; titleEn: string; desc: string; descEn: string;
  color: string; bg: string; xp: number;
  progress: number; total: number; daysLeft: number;
};

const LEVELS = [
  { name: 'Rookie', nameEn: 'Rookie', minXP: 0, color: '#8E8E93' },
  { name: 'Amateur', nameEn: 'Amateur', minXP: 150, color: theme.blue },
  { name: 'Athlet', nameEn: 'Athlete', minXP: 400, color: theme.green },
  { name: 'Pro', nameEn: 'Pro', minXP: 800, color: theme.orange },
  { name: 'Elite', nameEn: 'Elite', minXP: 1500, color: theme.purple },
  { name: 'Champion', nameEn: 'Champion', minXP: 2500, color: '#FF2D55' },
  { name: 'Legend', nameEn: 'Legend', minXP: 5000, color: '#FFD700' },
];

const TIER_COLORS = {
  bronze: { bg: '#FDF0E6', border: '#CD7F32', text: '#7D4E1E', label: 'Bronze', labelEn: 'Bronze' },
  silver: { bg: '#F5F5F5', border: '#9E9E9E', text: '#616161', label: 'Silber', labelEn: 'Silver' },
  gold: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', label: 'Gold', labelEn: 'Gold' },
  diamond: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', label: 'Diamant', labelEn: 'Diamond' },
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  'Alle': 'All', 'Streak': 'Streak', 'Training': 'Training', 'Recovery': 'Recovery',
  'Performance': 'Performance', 'Habits': 'Habits', 'PRs': 'PRs', 'Spezial': 'Special',
};

function getLevel(xp: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.minXP) level = l; }
  return level;
}

function getNextLevel(xp: number) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp < LEVELS[i].minXP) return LEVELS[i];
  }
  return null;
}

// ─── SVG Icons ───────────────────────────────────────────────
function IconFlame({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 2C12 2 7 7 7 13C7 16.31 9.69 19 13 19C16.31 19 19 16.31 19 13C19 9 15 5 12 2ZM12 17C10.34 17 9 15.66 9 14C9 12 11 10 12 8C13 10 15 12 15 14C15 15.66 13.66 17 12 17Z" fill={color} /></Svg>;
}
function IconDumbbell({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M6 4V20M18 4V20M3 8H7M17 8H21M3 16H7M17 16H21M7 12H17" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconMoon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconZap({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconCheck({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M9 11L12 14L22 4M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconStar({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconTrophy({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M6 9H4C3.45 9 3 8.55 3 8V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V8C21 8.55 20.55 9 20 9H18M6 9C6 13 9 17 12 17C15 17 18 13 18 9M6 9H18M12 17V21M8 21H16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconCrown({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M2 19H22M3 15L5 7L9 11L12 4L15 11L19 7L21 15H3Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconDiamond({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M2.7 10.3L12 21.4L21.3 10.3L16.6 2.6H7.4L2.7 10.3ZM2.7 10.3H21.3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconTarget({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} /><Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={2} /><Circle cx={12} cy={12} r={2} fill={color} /></Svg>;
}
function IconRocket({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4.5 16.5L3 21L7.5 19.5M4.5 16.5L7.5 19.5M4.5 16.5C4.5 16.5 2 14 4 10C6 6 10 4.5 13 3C16 1.5 21 3 21 3C21 3 22.5 8 21 11C19.5 14 18 18 14 19.5C10 21 7.5 19.5 7.5 19.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Circle cx={14} cy={10} r={2} stroke={color} strokeWidth={2} /></Svg>;
}
function IconShield({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 22C12 22 4 18 4 10V4L12 2L20 4V10C20 18 12 22 12 22Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function IconGem({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M6 3H18L22 9L12 21L2 9L6 3Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M2 9H22M6 3L12 21M18 3L12 21" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconHeart({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 21C12 21 3 14 3 8.5C3 6 5 4 7.5 4C9 4 10.5 4.8 12 6.5C13.5 4.8 15 4 16.5 4C19 4 21 6 21 8.5C21 14 12 21 12 21Z" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconSun({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={2} /><Path d="M12 2V4M12 20V22M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M2 12H4M20 12H22M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function IconArrowUp({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M12 19V5M5 12L12 5L19 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function getBadgeIcon(id: string, color: string) {
  if (id.startsWith('s')) return <IconFlame color={color} />;
  if (id.startsWith('t')) return <IconDumbbell color={color} />;
  if (id.startsWith('r')) return <IconMoon color={color} />;
  if (id.startsWith('p')) return <IconZap color={color} />;
  if (id.startsWith('h')) return <IconCheck color={color} />;
  if (id.startsWith('pr')) return <IconStar color={color} />;
  if (id === 'sp1') return <IconShield color={color} />;
  if (id === 'sp2') return <IconRocket color={color} />;
  if (id === 'sp3') return <IconGem color={color} />;
  if (id === 'sp4') return <IconCrown color={color} />;
  if (id === 'sp5') return <IconHeart color={color} />;
  if (id === 'sp6') return <IconSun color={color} />;
  return <IconTarget color={color} />;
}

function LevelRing({ xp, size = 96 }: { xp: number; size?: number }) {
  const level = getLevel(xp);
  const next = getNextLevel(xp);
  const prevXP = level.minXP;
  const nextXP = next?.minXP ?? prevXP + 1000;
  const progress = Math.min(1, (xp - prevXP) / (nextXP - prevXP));
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const filled = progress * circ;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F2F2F7" strokeWidth={7} />
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={level.color}
          strokeWidth={7} strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round" rotation={-90} origin={`${size/2},${size/2}`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.18, fontWeight: '800', color: '#000', letterSpacing: -0.5 }}>{xp}</Text>
        <Text style={{ fontSize: size * 0.09, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>XP</Text>
      </View>
    </View>
  );
}

export default function AchievementsScreen() {
  const { lang } = useLanguage();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [activeTab, setActiveTab] = useState<'badges' | 'quests' | 'season'>('badges');
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [seasonChallenges, setSeasonChallenges] = useState<SeasonChallenge[]>([]);
  const [stats, setStats] = useState({ workouts: 0, streak: 0, sleepDays: 0, habitDays: 0, bestScore: 0, prCount: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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
    const rawWorkouts = await AsyncStorage.getItem('workouts');
    const rawHabits = await AsyncStorage.getItem('habits');
    const rawSleep = await AsyncStorage.getItem('sleepHistory');
    const rawCheckin = await AsyncStorage.getItem('checkinHistory');
    const rawBattery = await AsyncStorage.getItem('batteryData');

    const workoutList = rawWorkouts ? JSON.parse(rawWorkouts) : [];
    const workoutCount = workoutList.length;
    const sleepDays = rawSleep ? JSON.parse(rawSleep).length : 0;
    const habitList = rawHabits ? JSON.parse(rawHabits) : [];
    const habitDays = habitList.filter((h: any) => h.completedDates?.length > 0).length;
    const checkinList = rawCheckin ? JSON.parse(rawCheckin) : [];
    const bestScore = checkinList.length > 0 ? Math.max(0, ...checkinList.map((c: any) => c.score ?? 0)) : 0;
    const battery = rawBattery ? JSON.parse(rawBattery) : null;

    const prMap: Record<string, number> = {};
    workoutList.forEach((w: any) => {
      w.exercises?.forEach((ex: any) => {
        ex.sets?.forEach((set: any) => {
          const weight = parseFloat(set.weight || '0');
          const reps = parseFloat(set.reps || '0');
          if (weight > 0 && reps > 0) {
            const oneRM = reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
            if (!prMap[ex.name] || oneRM > prMap[ex.name]) prMap[ex.name] = oneRM;
          }
        });
      });
    });
    const prCount = Object.keys(prMap).length;

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const anyDone = habitList.some((h: any) => h.completedDates?.some((cd: string) => {
        const dd = new Date(cd);
        return dd.getDate() === d.getDate() && dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear();
      }));
      if (anyDone) streak++; else break;
    }

    setStats({ workouts: workoutCount, streak, sleepDays, habitDays, bestScore, prCount });

    // Daily Quests
    const todayStr = today.toDateString();
    const completedQuests = JSON.parse(await AsyncStorage.getItem('completedQuests') || '{}');
    const quests: DailyQuest[] = [
      { id: 'q1', title: 'Schlaf loggen', titleEn: 'Log Sleep', desc: 'Logge deine heutige Nacht', descEn: "Log tonight's sleep", xp: 15, completed: !!completedQuests[`${todayStr}_q1`], color: theme.pink, bg: theme.pinkLight, progress: rawSleep ? 1 : 0, total: 1 },
      { id: 'q2', title: 'Check-in machen', titleEn: 'Do Check-in', desc: 'Täglichen Check-in ausfüllen', descEn: 'Fill out your daily check-in', xp: 15, completed: !!completedQuests[`${todayStr}_q2`], color: theme.purple, bg: theme.purpleLight, progress: checkinList.some((c: any) => new Date(c.date ?? '').toDateString() === todayStr) ? 1 : 0, total: 1 },
      { id: 'q3', title: 'Alle Habits erledigen', titleEn: 'Complete All Habits', desc: 'Heutige Habits abschliessen', descEn: "Finish today's habits", xp: 20, completed: !!completedQuests[`${todayStr}_q3`], color: theme.teal, bg: theme.tealLight, progress: habitList.filter((h: any) => h.completedDates?.some((cd: string) => new Date(cd).toDateString() === todayStr)).length, total: Math.max(1, habitList.length) },
      { id: 'q4', title: 'Battery tracken', titleEn: 'Track Battery', desc: 'Body Battery heute eintragen', descEn: 'Log your Body Battery today', xp: 10, completed: !!completedQuests[`${todayStr}_q4`], color: theme.green, bg: theme.greenLight, progress: battery && new Date(battery.date).toDateString() === todayStr ? 1 : 0, total: 1 },
      { id: 'q5', title: 'Training absolvieren', titleEn: 'Complete Workout', desc: 'Heute ein Training machen', descEn: 'Do a workout today', xp: 25, completed: !!completedQuests[`${todayStr}_q5`], color: theme.blue, bg: theme.blueLight, progress: workoutList.filter((w: any) => new Date(w.date).toDateString() === todayStr).length > 0 ? 1 : 0, total: 1 },
    ];
    setDailyQuests(quests);

    // Season Challenges – Mai 2026
    const season: SeasonChallenge[] = [
      { id: 'sc1', title: 'Mai Krieger', titleEn: 'May Warrior', desc: '20 Trainings im Mai', descEn: '20 workouts in May', color: theme.blue, bg: theme.blueLight, xp: 300, progress: workoutList.filter((w: any) => new Date(w.date).getMonth() === 4 && new Date(w.date).getFullYear() === 2026).length, total: 20, daysLeft: 27 },
      { id: 'sc2', title: 'Sleep Champion', titleEn: 'Sleep Champion', desc: '25 Nächte im Mai loggen', descEn: 'Log 25 nights in May', color: theme.pink, bg: theme.pinkLight, xp: 250, progress: rawSleep ? JSON.parse(rawSleep).filter((s: any) => new Date(s.date).getMonth() === 4).length : 0, total: 25, daysLeft: 27 },
      { id: 'sc3', title: 'Habit Streak', titleEn: 'Habit Streak', desc: '21 Tage Streak im Mai', descEn: '21 day streak in May', color: theme.orange, bg: theme.orangeLight, xp: 400, progress: Math.min(streak, 21), total: 21, daysLeft: 27 },
      { id: 'sc4', title: 'Score 80+', titleEn: 'Score 80+', desc: '10x Score über 80 erreichen', descEn: 'Reach a score over 80, 10x', color: theme.green, bg: theme.greenLight, xp: 350, progress: checkinList.filter((c: any) => c.score >= 80 && new Date(c.date ?? '').getMonth() === 4).length, total: 10, daysLeft: 27 },
      { id: 'sc5', title: 'PR Monat', titleEn: 'PR Month', desc: '3 neue PRs im Mai setzen', descEn: 'Set 3 new PRs in May', color: theme.purple, bg: theme.purpleLight, xp: 200, progress: Math.min(prCount, 3), total: 3, daysLeft: 27 },
    ];
    setSeasonChallenges(season);

    // All Badges
    const allBadges: Badge[] = [
      // STREAK
      { id: 's1', title: 'Erster Schritt', titleEn: 'First Step', desc: '3 Tage Streak', descEn: '3 day streak', color: '#FF6B35', bg: '#FFF3EE', xp: 25, category: 'Streak', tier: 'bronze', unlocked: streak >= 3, progress: Math.min(streak, 3), total: 3 },
      { id: 's2', title: 'Momentum', titleEn: 'Momentum', desc: '7 Tage Streak', descEn: '7 day streak', color: '#FF6B35', bg: '#FFF3EE', xp: 50, category: 'Streak', tier: 'bronze', unlocked: streak >= 7, progress: Math.min(streak, 7), total: 7 },
      { id: 's3', title: 'Gewohnheit', titleEn: 'Habit', desc: '14 Tage Streak', descEn: '14 day streak', color: '#FF4500', bg: '#FFF0EB', xp: 100, category: 'Streak', tier: 'silver', unlocked: streak >= 14, progress: Math.min(streak, 14), total: 14 },
      { id: 's4', title: 'Unaufhaltsam', titleEn: 'Unstoppable', desc: '21 Tage Streak', descEn: '21 day streak', color: '#E63900', bg: '#FFF0EB', xp: 150, category: 'Streak', tier: 'silver', unlocked: streak >= 21, progress: Math.min(streak, 21), total: 21 },
      { id: 's5', title: 'Legende', titleEn: 'Legend', desc: '30 Tage Streak', descEn: '30 day streak', color: '#CC0000', bg: '#FFE8E8', xp: 250, category: 'Streak', tier: 'gold', unlocked: streak >= 30, progress: Math.min(streak, 30), total: 30 },
      { id: 's6', title: 'Titan', titleEn: 'Titan', desc: '60 Tage Streak', descEn: '60 day streak', color: '#9B0000', bg: '#FFE0E0', xp: 400, category: 'Streak', tier: 'gold', unlocked: streak >= 60, progress: Math.min(streak, 60), total: 60 },
      { id: 's7', title: 'Unsterblich', titleEn: 'Immortal', desc: '90 Tage Streak', descEn: '90 day streak', color: '#7C3AED', bg: '#F3E8FF', xp: 600, category: 'Streak', tier: 'diamond', unlocked: streak >= 90, progress: Math.min(streak, 90), total: 90 },
      { id: 's8', title: 'Halbes Jahr', titleEn: 'Half Year', desc: '180 Tage Streak', descEn: '180 day streak', color: '#5B21B6', bg: '#EDE9FE', xp: 1000, category: 'Streak', tier: 'diamond', unlocked: streak >= 180, progress: Math.min(streak, 180), total: 180 },
      { id: 's9', title: 'Ein Jahr', titleEn: 'One Year', desc: '365 Tage Streak', descEn: '365 day streak', color: '#B8860B', bg: '#FFFBEB', xp: 2000, category: 'Streak', tier: 'diamond', unlocked: streak >= 365, progress: Math.min(streak, 365), total: 365 },

      // TRAINING
      { id: 't1', title: 'Erster Schweiss', titleEn: 'First Sweat', desc: '1 Training', descEn: '1 workout', color: theme.blue, bg: theme.blueLight, xp: 20, category: 'Training', tier: 'bronze', unlocked: workoutCount >= 1, progress: Math.min(workoutCount, 1), total: 1 },
      { id: 't2', title: 'Anfänger', titleEn: 'Beginner', desc: '5 Trainings', descEn: '5 workouts', color: theme.blue, bg: theme.blueLight, xp: 40, category: 'Training', tier: 'bronze', unlocked: workoutCount >= 5, progress: Math.min(workoutCount, 5), total: 5 },
      { id: 't3', title: 'Regelmässig', titleEn: 'Regular', desc: '10 Trainings', descEn: '10 workouts', color: '#1565C0', bg: '#E3F2FD', xp: 75, category: 'Training', tier: 'bronze', unlocked: workoutCount >= 10, progress: Math.min(workoutCount, 10), total: 10 },
      { id: 't4', title: 'Dedicated', titleEn: 'Dedicated', desc: '25 Trainings', descEn: '25 workouts', color: '#0D47A1', bg: '#E1F5FE', xp: 150, category: 'Training', tier: 'silver', unlocked: workoutCount >= 25, progress: Math.min(workoutCount, 25), total: 25 },
      { id: 't5', title: 'Veteran', titleEn: 'Veteran', desc: '50 Trainings', descEn: '50 workouts', color: '#01579B', bg: '#E0F7FA', xp: 300, category: 'Training', tier: 'silver', unlocked: workoutCount >= 50, progress: Math.min(workoutCount, 50), total: 50 },
      { id: 't6', title: 'Iron 100', titleEn: 'Iron 100', desc: '100 Trainings', descEn: '100 workouts', color: '#1A237E', bg: '#E8EAF6', xp: 500, category: 'Training', tier: 'gold', unlocked: workoutCount >= 100, progress: Math.min(workoutCount, 100), total: 100 },
      { id: 't7', title: 'Maschine', titleEn: 'Machine', desc: '200 Trainings', descEn: '200 workouts', color: '#0D1B7A', bg: '#E8EAF6', xp: 800, category: 'Training', tier: 'gold', unlocked: workoutCount >= 200, progress: Math.min(workoutCount, 200), total: 200 },
      { id: 't8', title: 'Iron 500', titleEn: 'Iron 500', desc: '500 Trainings', descEn: '500 workouts', color: '#7C3AED', bg: '#F3E8FF', xp: 1500, category: 'Training', tier: 'diamond', unlocked: workoutCount >= 500, progress: Math.min(workoutCount, 500), total: 500 },

      // RECOVERY
      { id: 'r1', title: 'Erste Nacht', titleEn: 'First Night', desc: '1 Nacht geloggt', descEn: '1 night logged', color: theme.pink, bg: theme.pinkLight, xp: 10, category: 'Recovery', tier: 'bronze', unlocked: sleepDays >= 1, progress: Math.min(sleepDays, 1), total: 1 },
      { id: 'r2', title: 'Guter Schläfer', titleEn: 'Good Sleeper', desc: '7 Nächte geloggt', descEn: '7 nights logged', color: '#DB2777', bg: theme.pinkLight, xp: 30, category: 'Recovery', tier: 'bronze', unlocked: sleepDays >= 7, progress: Math.min(sleepDays, 7), total: 7 },
      { id: 'r3', title: 'Sleep Routine', titleEn: 'Sleep Routine', desc: '14 Nächte geloggt', descEn: '14 nights logged', color: '#BE185D', bg: '#FDF2F8', xp: 60, category: 'Recovery', tier: 'silver', unlocked: sleepDays >= 14, progress: Math.min(sleepDays, 14), total: 14 },
      { id: 'r4', title: 'Sleep Master', titleEn: 'Sleep Master', desc: '30 Nächte geloggt', descEn: '30 nights logged', color: '#9D174D', bg: '#FDF2F8', xp: 100, category: 'Recovery', tier: 'silver', unlocked: sleepDays >= 30, progress: Math.min(sleepDays, 30), total: 30 },
      { id: 'r5', title: 'Recovery Pro', titleEn: 'Recovery Pro', desc: '60 Nächte geloggt', descEn: '60 nights logged', color: '#831843', bg: theme.pinkLight, xp: 200, category: 'Recovery', tier: 'gold', unlocked: sleepDays >= 60, progress: Math.min(sleepDays, 60), total: 60 },
      { id: 'r6', title: 'Traumschlaf', titleEn: 'Dream Sleep', desc: 'Sleep Score 90+', descEn: 'Sleep Score 90+', color: theme.purple, bg: theme.purpleLight, xp: 150, category: 'Recovery', tier: 'gold', unlocked: bestScore >= 90, progress: Math.min(Math.max(0, bestScore - 60), 30), total: 30 },

      // PERFORMANCE
      { id: 'p1', title: 'Erster Score', titleEn: 'First Score', desc: 'Check-in gemacht', descEn: 'Check-in done', color: theme.green, bg: theme.greenLight, xp: 15, category: 'Performance', tier: 'bronze', unlocked: bestScore > 0, progress: bestScore > 0 ? 1 : 0, total: 1 },
      { id: 'p2', title: 'Aufsteiger', titleEn: 'Riser', desc: 'Score 60+', descEn: 'Score 60+', color: '#2E7D32', bg: theme.greenLight, xp: 40, category: 'Performance', tier: 'bronze', unlocked: bestScore >= 60, progress: Math.min(bestScore, 60), total: 60 },
      { id: 'p3', title: 'Solide Form', titleEn: 'Solid Form', desc: 'Score 70+', descEn: 'Score 70+', color: '#1B5E20', bg: '#E8F5E9', xp: 75, category: 'Performance', tier: 'silver', unlocked: bestScore >= 70, progress: Math.min(bestScore, 70), total: 70 },
      { id: 'p4', title: 'Top Athlet', titleEn: 'Top Athlete', desc: 'Score 80+', descEn: 'Score 80+', color: '#00695C', bg: '#E0F2F1', xp: 150, category: 'Performance', tier: 'silver', unlocked: bestScore >= 80, progress: Math.min(bestScore, 80), total: 80 },
      { id: 'p5', title: 'Hochleistung', titleEn: 'High Performance', desc: 'Score 90+', descEn: 'Score 90+', color: '#004D40', bg: '#E0F2F1', xp: 250, category: 'Performance', tier: 'gold', unlocked: bestScore >= 90, progress: Math.min(bestScore, 90), total: 90 },
      { id: 'p6', title: 'Perfekter Tag', titleEn: 'Perfect Day', desc: 'Score 95+', descEn: 'Score 95+', color: '#FF9500', bg: theme.orangeLight, xp: 400, category: 'Performance', tier: 'gold', unlocked: bestScore >= 95, progress: Math.min(bestScore, 95), total: 95 },
      { id: 'p7', title: 'Maximum', titleEn: 'Maximum', desc: 'Score 100', descEn: 'Score 100', color: '#7C3AED', bg: theme.purpleLight, xp: 1000, category: 'Performance', tier: 'diamond', unlocked: bestScore >= 100, progress: Math.min(bestScore, 100), total: 100 },

      // HABITS
      { id: 'h1', title: 'Erste Gewohnheit', titleEn: 'First Habit', desc: '1 Habit aktiv', descEn: '1 habit active', color: theme.teal, bg: theme.tealLight, xp: 10, category: 'Habits', tier: 'bronze', unlocked: habitDays >= 1, progress: Math.min(habitDays, 1), total: 1 },
      { id: 'h2', title: 'Aufgebaut', titleEn: 'Built Up', desc: '3 Habits aktiv', descEn: '3 habits active', color: '#0097A7', bg: theme.tealLight, xp: 30, category: 'Habits', tier: 'bronze', unlocked: habitDays >= 3, progress: Math.min(habitDays, 3), total: 3 },
      { id: 'h3', title: 'Routine', titleEn: 'Routine', desc: '5 Habits aktiv', descEn: '5 habits active', color: '#00838F', bg: theme.tealLight, xp: 60, category: 'Habits', tier: 'silver', unlocked: habitDays >= 5, progress: Math.min(habitDays, 5), total: 5 },
      { id: 'h4', title: 'Habit Master', titleEn: 'Habit Master', desc: '10 Habits aktiv', descEn: '10 habits active', color: '#006064', bg: theme.tealLight, xp: 100, category: 'Habits', tier: 'silver', unlocked: habitDays >= 10, progress: Math.min(habitDays, 10), total: 10 },
      { id: 'h5', title: 'Lebensweise', titleEn: 'Lifestyle', desc: '20 Habits aktiv', descEn: '20 habits active', color: '#37474F', bg: '#ECEFF1', xp: 200, category: 'Habits', tier: 'gold', unlocked: habitDays >= 20, progress: Math.min(habitDays, 20), total: 20 },

      // PRs
      { id: 'pr1', title: 'Erster PR', titleEn: 'First PR', desc: '1 Personal Record', descEn: '1 personal record', color: theme.orange, bg: theme.orangeLight, xp: 25, category: 'PRs', tier: 'bronze', unlocked: prCount >= 1, progress: Math.min(prCount, 1), total: 1 },
      { id: 'pr2', title: 'Stärker', titleEn: 'Stronger', desc: '3 PRs gesetzt', descEn: '3 PRs set', color: '#F57C00', bg: theme.orangeLight, xp: 60, category: 'PRs', tier: 'bronze', unlocked: prCount >= 3, progress: Math.min(prCount, 3), total: 3 },
      { id: 'pr3', title: 'PR Jäger', titleEn: 'PR Hunter', desc: '5 PRs gesetzt', descEn: '5 PRs set', color: '#E65100', bg: '#FBE9E7', xp: 100, category: 'PRs', tier: 'silver', unlocked: prCount >= 5, progress: Math.min(prCount, 5), total: 5 },
      { id: 'pr4', title: 'Rekordbrecher', titleEn: 'Record Breaker', desc: '10 PRs gesetzt', descEn: '10 PRs set', color: '#BF360C', bg: '#FBE9E7', xp: 200, category: 'PRs', tier: 'gold', unlocked: prCount >= 10, progress: Math.min(prCount, 10), total: 10 },
      { id: 'pr5', title: 'PR Maschine', titleEn: 'PR Machine', desc: '20 PRs gesetzt', descEn: '20 PRs set', color: '#7C3AED', bg: theme.purpleLight, xp: 400, category: 'PRs', tier: 'diamond', unlocked: prCount >= 20, progress: Math.min(prCount, 20), total: 20 },

      // SPEZIAL
      { id: 'sp1', title: 'Vollständig', titleEn: 'Complete', desc: 'Profil zu 100% ausgefüllt', descEn: 'Profile 100% filled out', color: '#7C3AED', bg: theme.purpleLight, xp: 50, category: 'Spezial', tier: 'silver', unlocked: false },
      { id: 'sp2', title: 'Early Adopter', titleEn: 'Early Adopter', desc: 'App in der Beta genutzt', descEn: 'Used the app during beta', color: '#FF2D55', bg: '#FFF0F3', xp: 100, category: 'Spezial', tier: 'gold', unlocked: true, unlockedAt: 'Mai 2026', unlockedAtEn: 'May 2026' },
      { id: 'sp3', title: 'Perfekte Woche', titleEn: 'Perfect Week', desc: '7 Tage + 3 Trainings + alle Habits', descEn: '7 days + 3 workouts + all habits', color: '#B8860B', bg: '#FFFBEB', xp: 200, category: 'Spezial', tier: 'gold', unlocked: streak >= 7 && workoutCount >= 3 && habitDays >= 3 },
      { id: 'sp4', title: 'Allrounder', titleEn: 'All-Rounder', desc: 'Alle 5 Bereiche geloggt', descEn: 'All 5 areas logged', color: '#0D7377', bg: '#E0FAFA', xp: 150, category: 'Spezial', tier: 'silver', unlocked: workoutCount >= 1 && sleepDays >= 1 && habitDays >= 1 && bestScore > 0 },
      { id: 'sp5', title: 'Freundeskreis', titleEn: 'Circle of Friends', desc: 'Ersten Freund geaddet', descEn: 'Added your first friend', color: '#C2185B', bg: '#FCE4EC', xp: 50, category: 'Spezial', tier: 'bronze', unlocked: false },
      { id: 'sp6', title: 'Morgenmensch', titleEn: 'Early Bird', desc: '7x vor 8 Uhr Check-in', descEn: '7x check-in before 8am', color: '#F57F17', bg: '#FFFDE7', xp: 100, category: 'Spezial', tier: 'silver', unlocked: false },
    ];

    const xp = allBadges.filter(b => b.unlocked).reduce((sum, b) => sum + b.xp, 0);
    setBadges(allBadges);
    setTotalXP(xp);
  }

  const categories = ['Alle', 'Streak', 'Training', 'Recovery', 'Performance', 'Habits', 'PRs', 'Spezial'];
  const filtered = activeCategory === 'Alle' ? badges : badges.filter(b => b.category === activeCategory);
  const unlocked = badges.filter(b => b.unlocked).length;
  const level = getLevel(totalXP);
  const nextLevel = getNextLevel(totalXP);
  const dailyXP = dailyQuests.filter(q => q.completed).reduce((s, q) => s + q.xp, 0);
  const seasonXP = seasonChallenges.filter(c => c.progress >= c.total).reduce((s, c) => s + c.xp, 0);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>{lang === 'en' ? 'Achievements' : 'Erfolge'}</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Level Card */}
        <View style={styles.levelCard}>
          <LevelRing xp={totalXP} size={96} />
          <View style={styles.levelInfo}>
            <View style={[styles.levelPill, { backgroundColor: level.color }]}>
              <Text style={styles.levelPillText}>{lang === 'en' ? level.nameEn : level.name}</Text>
            </View>
            <Text style={styles.levelXP}>{totalXP} XP</Text>
            {nextLevel ? (
              <>
                <Text style={styles.levelNextText}>{lang === 'en' ? `${nextLevel.minXP - totalXP} XP until ${nextLevel.nameEn}` : `Noch ${nextLevel.minXP - totalXP} XP bis ${nextLevel.name}`}</Text>
                <View style={styles.levelProgressBar}>
                  <View style={[styles.levelProgressFill, {
                    width: `${Math.round(((totalXP - level.minXP) / (nextLevel.minXP - level.minXP)) * 100)}%` as any,
                    backgroundColor: level.color,
                  }]} />
                </View>
              </>
            ) : (
              <Text style={[styles.levelNextText, { color: '#B8860B', fontWeight: '600' }]}>{lang === 'en' ? 'Maximum reached!' : 'Maximum erreicht!'}</Text>
            )}
            <View style={styles.levelMeta}>
              <View style={styles.levelMetaItem}>
                <Text style={styles.levelMetaVal}>{unlocked}</Text>
                <Text style={styles.levelMetaLbl}>Badges</Text>
              </View>
              <View style={[styles.levelMetaItem, styles.levelMetaBorder]}>
                <Text style={styles.levelMetaVal}>{badges.length}</Text>
                <Text style={styles.levelMetaLbl}>Total</Text>
              </View>
              <View style={[styles.levelMetaItem, styles.levelMetaBorder]}>
                <Text style={[styles.levelMetaVal, { color: theme.green }]}>{Math.round((unlocked / Math.max(badges.length, 1)) * 100)}%</Text>
                <Text style={styles.levelMetaLbl}>{lang === 'en' ? 'Done' : 'Fertig'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {[
            { key: 'badges', label: 'Badges' },
            { key: 'quests', label: `${lang === 'en' ? 'Daily Quests' : 'Tagesquests'}${dailyQuests.filter(q => !q.completed && q.progress > 0).length > 0 ? ' •' : ''}` },
            { key: 'season', label: 'Season' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BADGES TAB */}
        {activeTab === 'badges' && (
          <>
            {/* Next Badge */}
            {badges.filter(b => !b.unlocked && b.progress !== undefined).slice(0, 1).map(next => {
              const tier = TIER_COLORS[next.tier];
              return (
                <View key={next.id} style={[styles.nextCard, { borderLeftColor: next.color }]}>
                  <View style={[styles.nextIconWrap, { backgroundColor: '#F2F2F7', borderColor: '#E5E5EA' }]}>
                    {getBadgeIcon(next.id, '#C7C7CC')}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.nextLabel}>{lang === 'en' ? 'Next Goal' : 'Nächstes Ziel'}</Text>
                      <View style={[styles.tierPill, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                        <Text style={[styles.tierPillText, { color: tier.text }]}>{lang === 'en' ? tier.labelEn : tier.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.nextTitle}>{lang === 'en' ? next.titleEn : next.title}</Text>
                    <Text style={styles.nextDesc}>{lang === 'en' ? next.descEn : next.desc}</Text>
                    {next.progress !== undefined && next.total && (
                      <View style={styles.nextProgressWrap}>
                        <View style={styles.nextProgressTrack}>
                          <View style={[styles.nextProgressFill, { width: `${Math.round((next.progress / next.total) * 100)}%` as any, backgroundColor: next.color }]} />
                        </View>
                        <Text style={[styles.nextProgressText, { color: next.color }]}>{next.progress}/{next.total}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.xpPill, { backgroundColor: next.bg }]}>
                    <Text style={[styles.xpPillText, { color: next.color }]}>+{next.xp}</Text>
                  </View>
                </View>
              );
            })}

            {/* Category Scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{lang === 'en' ? (CATEGORY_LABELS_EN[cat] ?? cat) : cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Badges Grid */}
            <View style={styles.grid}>
              {filtered.map(badge => {
                const tier = TIER_COLORS[badge.tier];
                return (
                  <View key={badge.id} style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}>
                    {badge.unlocked && (
                      <View style={[styles.tierTag, { backgroundColor: tier.bg, borderColor: tier.border }]}>
                        <Text style={[styles.tierTagText, { color: tier.text }]}>{lang === 'en' ? tier.labelEn : tier.label}</Text>
                      </View>
                    )}
                    <View style={[styles.badgeIconWrap, {
                      backgroundColor: badge.unlocked ? badge.bg : '#F2F2F7',
                      borderColor: badge.unlocked ? badge.color + '50' : '#E5E5EA',
                    }]}>
                      {getBadgeIcon(badge.id, badge.unlocked ? badge.color : '#C7C7CC')}
                      {badge.unlocked && (
                        <View style={[styles.checkDot, { backgroundColor: badge.color }]}>
                          <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800' }}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.badgeTitle, !badge.unlocked && { color: '#8E8E93' }]}>{lang === 'en' ? badge.titleEn : badge.title}</Text>
                    <Text style={styles.badgeDesc}>{lang === 'en' ? badge.descEn : badge.desc}</Text>
                    {!badge.unlocked && badge.progress !== undefined && badge.total && (
                      <View style={{ width: '100%', gap: 2 }}>
                        <View style={styles.badgeProgressTrack}>
                          <View style={[styles.badgeProgressFill, { width: `${Math.round((badge.progress / badge.total) * 100)}%` as any, backgroundColor: badge.color }]} />
                        </View>
                        <Text style={styles.badgeProgressMeta}>{badge.progress}/{badge.total}</Text>
                      </View>
                    )}
                    {badge.unlocked && badge.unlockedAt && (
                      <Text style={styles.unlockedAt}>{lang === 'en' ? badge.unlockedAtEn : badge.unlockedAt}</Text>
                    )}
                    <View style={[styles.xpChip, { backgroundColor: badge.unlocked ? badge.bg : '#F2F2F7' }]}>
                      <Text style={[styles.xpChipText, { color: badge.unlocked ? badge.color : '#C7C7CC' }]}>+{badge.xp} XP</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* QUESTS TAB */}
        {activeTab === 'quests' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{lang === 'en' ? "Today's Quests" : 'Heutige Quests'}</Text>
              <View style={[styles.xpPill, { backgroundColor: theme.greenLight }]}>
                <Text style={[styles.xpPillText, { color: theme.green }]}>+{dailyXP} XP {lang === 'en' ? 'today' : 'heute'}</Text>
              </View>
            </View>
            <Text style={styles.sectionSub}>{lang === 'en' ? 'New quests every day – a fresh chance to earn XP each day' : 'Täglich neue Quests – jeden Tag eine neue Chance XP zu sammeln'}</Text>

            {dailyQuests.map(quest => (
              <View key={quest.id} style={[styles.questCard, quest.completed && { borderLeftColor: quest.color, borderLeftWidth: 3 }]}>
                <View style={[styles.questIconWrap, { backgroundColor: quest.completed ? quest.bg : '#F2F2F7' }]}>
                  {quest.completed
                    ? <View style={[styles.questCheck, { backgroundColor: quest.color }]}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text></View>
                    : <View style={{ opacity: 0.4 }}>{getBadgeIcon('h1', quest.color)}</View>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.questTitle, quest.completed && { color: quest.color }]}>{lang === 'en' ? quest.titleEn : quest.title}</Text>
                  <Text style={styles.questDesc}>{lang === 'en' ? quest.descEn : quest.desc}</Text>
                  {!quest.completed && (
                    <View style={styles.questProgressWrap}>
                      <View style={styles.questProgressTrack}>
                        <View style={[styles.questProgressFill, { width: `${Math.round((quest.progress / quest.total) * 100)}%` as any, backgroundColor: quest.color }]} />
                      </View>
                      <Text style={[styles.questProgressText, { color: quest.color }]}>{quest.progress}/{quest.total}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.xpPill, { backgroundColor: quest.completed ? quest.bg : '#F2F2F7' }]}>
                  <Text style={[styles.xpPillText, { color: quest.completed ? quest.color : '#C7C7CC' }]}>+{quest.xp} XP</Text>
                </View>
              </View>
            ))}

            <View style={styles.questInfoCard}>
              <Text style={styles.questInfoTitle}>{lang === 'en' ? 'How quests work' : 'Wie Quests funktionieren'}</Text>
              <Text style={styles.questInfoText}>{lang === 'en' ? 'New quests appear at midnight every day. Complete them to earn XP and level up faster.' : 'Täglich neue Quests erscheinen um Mitternacht. Schliesse sie ab um XP zu sammeln und schneller Level aufzusteigen.'}</Text>
            </View>
          </View>
        )}

        {/* SEASON TAB */}
        {activeTab === 'season' && (
          <View style={styles.section}>
            <View style={styles.seasonHero}>
              <Text style={styles.seasonMonth}>{lang === 'en' ? 'May 2026' : 'Mai 2026'}</Text>
              <Text style={styles.seasonTitle}>Season Challenge</Text>
              <Text style={styles.seasonSub}>{lang === 'en' ? '27 days left' : '27 Tage verbleibend'}</Text>
              <View style={[styles.xpPill, { backgroundColor: theme.purpleLight, marginTop: 8 }]}>
                <Text style={[styles.xpPillText, { color: theme.purple }]}>+{seasonChallenges.reduce((s, c) => s + c.xp, 0)} XP {lang === 'en' ? 'total available' : 'total verfügbar'}</Text>
              </View>
            </View>

            {seasonChallenges.map(challenge => {
              const done = challenge.progress >= challenge.total;
              const pct = Math.round((challenge.progress / challenge.total) * 100);
              return (
                <View key={challenge.id} style={[styles.seasonCard, done && { borderLeftColor: challenge.color, borderLeftWidth: 3 }]}>
                  <View style={styles.seasonCardTop}>
                    <View style={[styles.seasonIconWrap, { backgroundColor: done ? challenge.bg : '#F2F2F7' }]}>
                      {getBadgeIcon('t1', done ? challenge.color : '#C7C7CC')}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.seasonCardTitle, done && { color: challenge.color }]}>{lang === 'en' ? challenge.titleEn : challenge.title}</Text>
                        {done && (
                          <View style={[styles.doneBadge, { backgroundColor: challenge.bg }]}>
                            <Text style={[styles.doneBadgeText, { color: challenge.color }]}>{lang === 'en' ? 'Done' : 'Fertig'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.seasonCardDesc}>{lang === 'en' ? challenge.descEn : challenge.desc}</Text>
                    </View>
                    <View style={[styles.xpPill, { backgroundColor: done ? challenge.bg : '#F2F2F7' }]}>
                      <Text style={[styles.xpPillText, { color: done ? challenge.color : '#C7C7CC' }]}>+{challenge.xp}</Text>
                    </View>
                  </View>
                  <View style={styles.seasonProgressWrap}>
                    <View style={styles.seasonProgressTrack}>
                      <View style={[styles.seasonProgressFill, { width: `${pct}%` as any, backgroundColor: challenge.color }]} />
                    </View>
                    <Text style={[styles.seasonProgressText, { color: challenge.color }]}>{challenge.progress}/{challenge.total}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000', letterSpacing: -0.3 },

  levelCard: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 20, flexDirection: 'row', gap: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  levelInfo: { flex: 1, gap: 5 },
  levelPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  levelPillText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  levelXP: { fontSize: 26, fontWeight: '800', color: '#000', letterSpacing: -0.8 },
  levelNextText: { fontSize: 12, color: '#8E8E93' },
  levelProgressBar: { height: 4, backgroundColor: '#F2F2F7', borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  levelProgressFill: { height: '100%', borderRadius: 2 },
  levelMeta: { flexDirection: 'row', gap: 0, marginTop: 6 },
  levelMetaItem: { flex: 1 },
  levelMetaBorder: { borderLeftWidth: 0.5, borderLeftColor: '#E5E5EA', paddingLeft: 12 },
  levelMetaVal: { fontSize: 16, fontWeight: '700', color: '#000' },
  levelMetaLbl: { fontSize: 9, color: '#C7C7CC', textTransform: 'uppercase', letterSpacing: 0.5 },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E5EA', marginBottom: 0 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#000' },
  tabBtnText: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  tabBtnTextActive: { color: '#000', fontWeight: '700' },

  nextCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  nextIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  nextLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.8 },
  nextTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginTop: 1 },
  nextDesc: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  nextProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  nextProgressTrack: { flex: 1, height: 4, backgroundColor: '#F2F2F7', borderRadius: 2, overflow: 'hidden' },
  nextProgressFill: { height: '100%', borderRadius: 2 },
  nextProgressText: { fontSize: 11, fontWeight: '700', minWidth: 30 },

  tierPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  tierPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  catScroll: { marginVertical: 12 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E5E5EA' },
  catChipActive: { backgroundColor: '#000', borderColor: '#000' },
  catChipText: { fontSize: 12, fontWeight: '500', color: '#8E8E93' },
  catChipTextActive: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 20 },
  badgeCard: { width: (SW - 44) / 2, backgroundColor: '#fff', borderRadius: 18, padding: 16, alignItems: 'center', gap: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, position: 'relative' },
  badgeCardLocked: { opacity: 0.65 },
  tierTag: { position: 'absolute', top: 10, left: 10, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  tierTagText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  badgeIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, position: 'relative' },
  checkDot: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeTitle: { fontSize: 12, fontWeight: '700', color: '#000', textAlign: 'center', letterSpacing: -0.2 },
  badgeDesc: { fontSize: 10, color: '#8E8E93', textAlign: 'center', lineHeight: 14 },
  badgeProgressTrack: { height: 3, backgroundColor: '#F2F2F7', borderRadius: 2, overflow: 'hidden', width: '100%' },
  badgeProgressFill: { height: '100%', borderRadius: 2 },
  badgeProgressMeta: { fontSize: 9, color: '#C7C7CC', textAlign: 'right' },
  unlockedAt: { fontSize: 9, color: '#C7C7CC', fontStyle: 'italic' },
  xpChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  xpChipText: { fontSize: 10, fontWeight: '700' },

  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#000', letterSpacing: -0.5 },
  sectionSub: { fontSize: 13, color: '#8E8E93', marginBottom: 16, lineHeight: 18 },

  questCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  questIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  questCheck: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  questTitle: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 2 },
  questDesc: { fontSize: 12, color: '#8E8E93' },
  questProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  questProgressTrack: { flex: 1, height: 3, backgroundColor: '#F2F2F7', borderRadius: 2, overflow: 'hidden' },
  questProgressFill: { height: '100%', borderRadius: 2 },
  questProgressText: { fontSize: 10, fontWeight: '600', minWidth: 25 },
  questInfoCard: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginTop: 8 },
  questInfoTitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  questInfoText: { fontSize: 12, color: '#3B82F6', lineHeight: 18 },

  seasonHero: { backgroundColor: '#000', borderRadius: 20, padding: 20, marginBottom: 16, alignItems: 'center' },
  seasonMonth: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 },
  seasonTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginTop: 4 },
  seasonSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  seasonCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  seasonCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  seasonIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  seasonCardTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  seasonCardDesc: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  seasonProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seasonProgressTrack: { flex: 1, height: 5, backgroundColor: '#F2F2F7', borderRadius: 3, overflow: 'hidden' },
  seasonProgressFill: { height: '100%', borderRadius: 3 },
  seasonProgressText: { fontSize: 11, fontWeight: '700', minWidth: 35, textAlign: 'right' },

  doneBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  doneBadgeText: { fontSize: 10, fontWeight: '700' },

  xpPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  xpPillText: { fontSize: 11, fontWeight: '700' },
});