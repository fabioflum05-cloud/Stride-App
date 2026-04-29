import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Habit = { id: string; name: string; identity: string; category: string; streak: number; completedDates: string[]; };

const CATEGORIES = [
  { key: 'health', label: '💪 Health', color: '#10B981' },
  { key: 'mind', label: '🧠 Mental', color: '#A78BFA' },
  { key: 'sleep', label: '🌙 Schlaf', color: '#EC4899' },
  { key: 'nutrition', label: '🥗 Ernährung', color: '#FB923C' },
  { key: 'training', label: '🏋️ Training', color: '#67E8F9' },
  { key: 'other', label: '⭐ Anderes', color: '#F472B6' },
];

const CATEGORY_COLORS: Record<string, string> = {
  health: '#10B981', mind: '#A78BFA', sleep: '#EC4899',
  nutrition: '#FB923C', training: '#67E8F9', other: '#F472B6',
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function calculateStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const sorted = [...completedDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);
  for (const dateStr of sorted) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const diff = (checkDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1) { streak++; checkDate = date; } else break;
  }
  return streak;
}

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitIdentity, setHabitIdentity] = useState('');
  const [habitCategory, setHabitCategory] = useState('health');

  useEffect(() => {
    async function load() {
      const raw = await AsyncStorage.getItem('habits');
      if (raw) setHabits(JSON.parse(raw));
    }
    load();
  }, []);

  async function toggleHabit(id: string) {
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const completedToday = h.completedDates.some(isToday);
      const newDates = completedToday ? h.completedDates.filter(d => !isToday(d)) : [...h.completedDates, new Date().toISOString()];
      return { ...h, completedDates: newDates, streak: calculateStreak(newDates) };
    });
    setHabits(updated);
    await AsyncStorage.setItem('habits', JSON.stringify(updated));
  }

  async function addHabit() {
    if (!habitName.trim()) { Alert.alert('Name fehlt'); return; }
    const habit: Habit = { id: Date.now().toString(), name: habitName.trim(), identity: habitIdentity.trim(), category: habitCategory, streak: 0, completedDates: [] };
    const updated = [...habits, habit];
    setHabits(updated);
    await AsyncStorage.setItem('habits', JSON.stringify(updated));
    setHabitName(''); setHabitIdentity(''); setHabitCategory('health');
    setShowModal(false);
  }

  async function deleteHabit(id: string) {
    Alert.alert('Habit löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        const updated = habits.filter(h => h.id !== id);
        setHabits(updated);
        await AsyncStorage.setItem('habits', JSON.stringify(updated));
      }}
    ]);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>Habits</Text>
      <Text style={styles.title}>Deine{'\n'}Gewohnheiten</Text>

      {CATEGORIES.map(cat => {
        const catHabits = habits.filter(h => h.category === cat.key);
        if (catHabits.length === 0) return null;
        return (
          <View key={cat.key} style={styles.categorySection}>
            <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
            {catHabits.map(habit => {
              const done = habit.completedDates.some(isToday);
              const color = CATEGORY_COLORS[habit.category];
              return (
                <TouchableOpacity key={habit.id}
                  style={[styles.habitRow, done && { borderColor: color + '40', backgroundColor: color + '08' }]}
                  onPress={() => toggleHabit(habit.id)}
                  onLongPress={() => deleteHabit(habit.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.check, done && { backgroundColor: color + '30', borderColor: color }]}>
                    {done && <Text style={[styles.checkMark, { color }]}>✓</Text>}
                  </View>
                  <View style={styles.habitInfo}>
                    <Text style={[styles.habitName, done && { color: '#5B4A8A' }]}>{habit.name}</Text>
                  </View>
                  {habit.streak > 0 && (
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakText}>🔥 {habit.streak}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
        <Text style={styles.addBtnText}>+ Habit hinzufügen</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Neuer Habit</Text>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#3D2E5C" value={habitName} onChangeText={setHabitName} />
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat.key}
                  style={[styles.catBtn, habitCategory === cat.key && { backgroundColor: CATEGORY_COLORS[cat.key] + '25', borderColor: CATEGORY_COLORS[cat.key] + '60' }]}
                  onPress={() => setHabitCategory(cat.key)}>
                  <Text style={[styles.catBtnText, habitCategory === cat.key && { color: CATEGORY_COLORS[cat.key] }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={addHabit}>
              <Text style={styles.saveBtnText}>Erstellen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 20 },
  categorySection: { marginBottom: 20 },
  categoryLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500', marginBottom: 10 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 14, marginBottom: 8 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, fontWeight: '600' },
  habitInfo: { flex: 1 },
  habitName: { color: '#E2D9F3', fontSize: 14, fontWeight: '500' },
  streakBadge: { backgroundColor: 'rgba(251,146,60,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { color: '#FB923C', fontSize: 11, fontWeight: '500' },
  addBtn: { backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0D0A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: '#E2D9F3', fontSize: 20, fontWeight: '500' },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, color: '#E2D9F3', fontSize: 15 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  catBtnText: { color: '#3D2E5C', fontSize: 12, fontWeight: '500' },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  cancelBtnText: { color: '#5B4A8A', fontSize: 14, textAlign: 'center', padding: 14 },
});