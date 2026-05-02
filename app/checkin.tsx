import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

const LEVELS = [
  { value: 1, emoji: '😴', label: 'Sehr niedrig' },
  { value: 2, emoji: '😕', label: 'Niedrig' },
  { value: 3, emoji: '😐', label: 'Mittel' },
  { value: 4, emoji: '🙂', label: 'Gut' },
  { value: 5, emoji: '🔥', label: 'Top' },
];

const STRESS_LEVELS = [
  { value: 1, emoji: '😌', label: 'Kein Stress' },
  { value: 2, emoji: '🙂', label: 'Wenig' },
  { value: 3, emoji: '😐', label: 'Moderat' },
  { value: 4, emoji: '😰', label: 'Hoch' },
  { value: 5, emoji: '🤯', label: 'Sehr hoch' },
];

export default function CheckinScreen() {
  const [energie, setEnergie] = useState(3);
  const [stress, setStress] = useState(2);
  const [motivation, setMotivation] = useState(3);
  const [saved, setSaved] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

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
    const raw = await AsyncStorage.getItem('lastCheckin');
    if (raw) {
      const c = JSON.parse(raw);
      const today = new Date();
      const date = new Date(c.date ?? '');
      if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth()) {
        setLastScore(c.score);
        setSaved(true);
      }
    }
  }

  async function save() {
    const score = Math.round(((energie * 20) + ((6 - stress) * 20) + (motivation * 20)) / 3);
    const data = { energie, stress, motivation, score, date: new Date().toISOString() };
    await AsyncStorage.setItem('lastCheckin', JSON.stringify(data));
    const rawHistory = await AsyncStorage.getItem('checkinHistory');
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    const today = new Date().toDateString();
    const filtered = history.filter((h: any) => new Date(h.date ?? '').toDateString() !== today);
    filtered.push(data);
    await AsyncStorage.setItem('checkinHistory', JSON.stringify(filtered));
    setLastScore(score);
    setSaved(true);
    router.push('/score-reveal' as any);
  }

  const sections = [
    { label: 'Energie', value: energie, setValue: setEnergie, levels: LEVELS, color: theme.orange, bg: theme.orangeLight },
    { label: 'Stress', value: stress, setValue: setStress, levels: STRESS_LEVELS, color: theme.pink, bg: theme.pinkLight },
    { label: 'Motivation', value: motivation, setValue: setMotivation, levels: LEVELS, color: theme.purple, bg: theme.purpleLight },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>Daily Check-in</Text>
        <Text style={styles.title}>Wie geht es{'\n'}dir heute?</Text>

        {saved && lastScore !== null && (
          <View style={styles.savedCard}>
            <View style={styles.savedIconWrap}>
              <Text style={styles.savedIcon}>✓</Text>
            </View>
            <Text style={styles.savedTitle}>Heute bereits eingecheckt</Text>
            <Text style={styles.savedScore}>{lastScore}</Text>
            <Text style={styles.savedScoreLabel}>Check-in Score</Text>
            <TouchableOpacity onPress={() => setSaved(false)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Bearbeiten</Text>
            </TouchableOpacity>
          </View>
        )}

        {!saved && (
          <>
            {sections.map(item => (
              <View key={item.label} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: item.bg }]}>
                    <Text style={styles.cardEmoji}>{item.levels[item.value - 1].emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: item.color }]}>{item.label}</Text>
                    <Text style={styles.cardLevel}>{item.levels[item.value - 1].label}</Text>
                  </View>
                  <View style={[styles.valueBadge, { backgroundColor: item.bg }]}>
                    <Text style={[styles.valueText, { color: item.color }]}>{item.value}/5</Text>
                  </View>
                </View>
                <View style={styles.btnRow}>
                  {item.levels.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      style={[
                        styles.levelBtn,
                        item.value === level.value && { backgroundColor: item.bg, borderColor: item.color, borderWidth: 1.5 }
                      ]}
                      onPress={() => item.setValue(level.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.levelEmoji}>{level.emoji}</Text>
                      <Text style={[styles.levelNum, item.value === level.value && { color: item.color, fontWeight: '600' }]}>
                        {level.value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Check-in speichern</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 24 },

  savedCard: { backgroundColor: theme.card, borderRadius: 20, padding: 28, alignItems: 'center', gap: 6, ...theme.shadow, marginBottom: 20 },
  savedIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.blueLight, alignItems: 'center', justifyContent: 'center' },
  savedIcon: { color: theme.blue, fontSize: 22, fontWeight: '700' },
  savedTitle: { color: theme.textSecondary, fontSize: 14, marginTop: 8 },
  savedScore: { color: theme.textPrimary, fontSize: 56, fontWeight: '300', letterSpacing: -2 },
  savedScoreLabel: { color: theme.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: -8 },
  editBtn: { marginTop: 8, backgroundColor: theme.cardSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  editBtnText: { color: theme.blue, fontSize: 13, fontWeight: '500' },

  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, gap: 14, ...theme.shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardLevel: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  valueBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  valueText: { fontSize: 13, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: 8 },
  levelBtn: { flex: 1, borderRadius: 12, backgroundColor: theme.cardSecondary, padding: 10, alignItems: 'center', gap: 4 },
  levelEmoji: { fontSize: 18 },
  levelNum: { color: theme.textSecondary, fontSize: 11, fontWeight: '500' },

  saveBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', ...theme.shadow },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});