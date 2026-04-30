import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
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

  useEffect(() => {
    async function load() {
      const rawSleep = await AsyncStorage.getItem('lastSleep');
      const rawCheckin = await AsyncStorage.getItem('lastCheckin');
      const rawBattery = await AsyncStorage.getItem('batteryData');
      const rawHabits = await AsyncStorage.getItem('habits');
      const rawProfile = await AsyncStorage.getItem('profile');
      const rawWeight = await AsyncStorage.getItem('weightHistory');

      if (rawSleep) { const s = JSON.parse(rawSleep); if (isToday(s.date)) { setSleepDone(true); setSleepScore(s.sleepScore); } }
      if (rawCheckin) { const c = JSON.parse(rawCheckin); if (isToday(c.date ?? '')) { setCheckinDone(true); setCheckinScore(c.score); } }
      if (rawBattery) { const b = JSON.parse(rawBattery); if (isToday(b.date)) setBatteryLevel(b.level); }
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
    }
    load();
  }, []);

  const sections = [
    {
      title: 'Schlaf', subtitle: sleepDone ? `Score ${sleepScore}` : 'Noch nicht geloggt',
      done: sleepDone, color: '#EC4899', route: '/sleep',
      icon: (color: string) => (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
          <Path d="M12 7V11L15 13" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      ),
    },
    {
      title: 'Daily Check-in', subtitle: checkinDone ? `Score ${checkinScore}` : 'Noch nicht ausgefüllt',
      done: checkinDone, color: '#A78BFA', route: '/checkin',
      icon: (color: string) => (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
          <Path d="M8.5 12L11 14.5L15.5 9.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      ),
    },
    {
      title: 'Body Battery', subtitle: batteryLevel > 0 ? `${batteryLevel}% geladen` : 'Noch nicht gestartet',
      done: batteryLevel > 0, color: '#67E8F9', route: '/battery',
      icon: (color: string) => (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={7} width={16} height={10} rx={2} stroke={color} strokeWidth={1.5} />
          <Path d="M19 10V14" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Rect x={5} y={9} width={8} height={6} rx={1} fill={color} opacity={0.5} />
        </Svg>
      ),
    },
    {
      title: 'Habits', subtitle: habitsTotal > 0 ? `${habitsCompleted}/${habitsTotal} erledigt` : 'Keine Habits definiert',
      done: habitsCompleted === habitsTotal && habitsTotal > 0, color: '#FB923C', route: '/habits',
      icon: (color: string) => (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={5} width={18} height={2} rx={1} fill={color} opacity={0.4} />
          <Rect x={3} y={11} width={18} height={2} rx={1} fill={color} opacity={0.7} />
          <Rect x={3} y={17} width={18} height={2} rx={1} fill={color} />
        </Svg>
      ),
    },
    {
      title: 'Gewicht', subtitle: currentWeight ?? 'Noch nicht geloggt',
      done: currentWeight !== null, color: '#A78BFA', route: '/weight',
      icon: (color: string) => (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3C9 3 6.5 5 6.5 8C6.5 9.5 7 10.8 8 11.8L5 21H19L16 11.8C17 10.8 17.5 9.5 17.5 8C17.5 5 15 3 12 3Z"
            stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ),
    },
  ];

  const completedCount = sections.filter(s => s.done).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Health</Text>
      <Text style={styles.title}>Deine{'\n'}Gesundheit</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressTop}>
          <Text style={styles.progressBig}>{completedCount}/{sections.length}</Text>
          <Text style={styles.progressSub}>Heute erledigt</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completedCount / sections.length) * 100}%` as any }]} />
        </View>
      </View>

      <View style={styles.grid}>
        {sections.map((section, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.card, { borderColor: section.done ? section.color + '40' : 'rgba(255,255,255,0.07)' }]}
            onPress={() => router.push(section.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, { backgroundColor: section.color + '15' }]}>
                {section.icon(section.color)}
              </View>
              {section.done && (
                <View style={[styles.doneBadge, { backgroundColor: section.color + '20', borderColor: section.color + '40' }]}>
                  <Text style={[styles.doneBadgeText, { color: section.color }]}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={[styles.cardSub, { color: section.done ? section.color : '#3D2E5C' }]}>{section.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  progressCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', padding: 20, marginBottom: 20 },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  progressBig: { color: '#E2D9F3', fontSize: 36, fontWeight: '500' },
  progressSub: { color: '#5B4A8A', fontSize: 13 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 120 },
  card: { width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, borderWidth: 0.5, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  doneBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  doneBadgeText: { fontSize: 12, fontWeight: '500' },
  cardTitle: { color: '#E2D9F3', fontSize: 14, fontWeight: '500' },
  cardSub: { fontSize: 12 },
});