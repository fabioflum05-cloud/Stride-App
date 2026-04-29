import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

  useEffect(() => {
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
    load();
  }, []);

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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>Daily Check-in</Text>
      <Text style={styles.title}>Wie geht es{'\n'}dir heute?</Text>

      {saved && lastScore !== null && (
        <View style={styles.savedCard}>
          <Text style={styles.savedTitle}>Heute bereits eingecheckt ✓</Text>
          <Text style={styles.savedScore}>{lastScore}</Text>
          <TouchableOpacity onPress={() => setSaved(false)}>
            <Text style={styles.editLink}>Bearbeiten</Text>
          </TouchableOpacity>
        </View>
      )}

      {!saved && (
        <>
          {[
            { label: 'Energie', value: energie, setValue: setEnergie, levels: LEVELS, color: '#FB923C' },
            { label: 'Stress', value: stress, setValue: setStress, levels: STRESS_LEVELS, color: '#F472B6' },
            { label: 'Motivation', value: motivation, setValue: setMotivation, levels: LEVELS, color: '#A78BFA' },
          ].map(item => (
            <View key={item.label} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: item.color }]}>{item.label}</Text>
                <Text style={styles.cardEmoji}>{item.levels[item.value - 1].emoji}</Text>
                <Text style={styles.cardLevel}>{item.levels[item.value - 1].label}</Text>
              </View>
              <View style={styles.btnRow}>
                {item.levels.map(level => (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.levelBtn, item.value === level.value && { backgroundColor: item.color + '30', borderColor: item.color }]}
                    onPress={() => item.setValue(level.value)}
                  >
                    <Text style={styles.levelEmoji}>{level.emoji}</Text>
                    <Text style={[styles.levelNum, item.value === level.value && { color: item.color }]}>{level.value}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>Check-in speichern</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  savedCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)', padding: 24, marginBottom: 20, alignItems: 'center', gap: 6 },
  savedTitle: { color: '#A78BFA', fontSize: 14, fontWeight: '500' },
  savedScore: { color: '#E2D9F3', fontSize: 48, fontWeight: '500' },
  editLink: { color: '#5B4A8A', fontSize: 13, marginTop: 8 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 12, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '500', flex: 1 },
  cardEmoji: { fontSize: 20 },
  cardLevel: { color: '#5B4A8A', fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 8 },
  levelBtn: { flex: 1, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, alignItems: 'center', gap: 4 },
  levelEmoji: { fontSize: 18 },
  levelNum: { color: '#5B4A8A', fontSize: 11, fontWeight: '500' },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});