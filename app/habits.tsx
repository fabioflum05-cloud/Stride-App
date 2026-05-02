import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
type Habit = { id: string; name: string; category: string; streak: number; completedDates: string[]; };

const CATEGORIES = [
  { key: 'health', label: '💪 Health', color: theme.green },
  { key: 'mind', label: '🧠 Mental', color: theme.purple },
  { key: 'sleep', label: '🌙 Schlaf', color: theme.pink },
  { key: 'nutrition', label: '🥗 Ernährung', color: theme.orange },
  { key: 'training', label: '🏋️ Training', color: theme.teal },
  { key: 'other', label: '⭐ Anderes', color: theme.blue },
];

const CATEGORY_COLORS: Record<string, string> = {
  health: theme.green, mind: theme.purple, sleep: theme.pink,
  nutrition: theme.orange, training: theme.teal, other: theme.blue,
};

const CATEGORY_BG: Record<string, string> = {
  health: theme.greenLight, mind: theme.purpleLight, sleep: theme.pinkLight,
  nutrition: theme.orangeLight, training: theme.tealLight, other: theme.blueLight,
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
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState('health');

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
    const raw = await AsyncStorage.getItem('habits');
    if (raw) setHabits(JSON.parse(raw));
  }

  async function save(updated: Habit[]) {
    setHabits(updated);
    await AsyncStorage.setItem('habits', JSON.stringify(updated));
  }

  async function toggleHabit(id: string) {
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const completedToday = h.completedDates.some(isToday);
      const newDates = completedToday
        ? h.completedDates.filter(d => !isToday(d))
        : [...h.completedDates, new Date().toISOString()];
      return { ...h, completedDates: newDates, streak: calculateStreak(newDates) };
    });
    await save(updated);
  }

  async function addOrEditHabit() {
    if (!habitName.trim()) { Alert.alert('Name fehlt'); return; }

    if (editingHabit) {
      const updated = habits.map(h =>
        h.id === editingHabit.id ? { ...h, name: habitName.trim(), category: habitCategory } : h
      );
      await save(updated);
    } else {
      const habit: Habit = {
        id: Date.now().toString(),
        name: habitName.trim(),
        category: habitCategory,
        streak: 0,
        completedDates: [],
      };
      await save([...habits, habit]);
    }

    setHabitName('');
    setHabitCategory('health');
    setEditingHabit(null);
    setShowModal(false);
  }

  function openEdit(habit: Habit) {
    setEditingHabit(habit);
    setHabitName(habit.name);
    setHabitCategory(habit.category);
    setShowModal(true);
  }

  function openNew() {
    setEditingHabit(null);
    setHabitName('');
    setHabitCategory('health');
    setShowModal(true);
  }

  async function deleteHabit(id: string) {
    Alert.alert('Habit löschen?', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await save(habits.filter(h => h.id !== id));
        }
      }
    ]);
  }

  const completedToday = habits.filter(h => h.completedDates.some(isToday)).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <BackButton />
<Text style={styles.headerLabel}>Habits</Text>
          <Text style={styles.title}>Deine{'\n'}Gewohnheiten</Text>

          {/* Progress Card */}
          {habits.length > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressNum}>{completedToday}</Text>
                <Text style={styles.progressSlash}>/</Text>
                <Text style={styles.progressTotal}>{habits.length}</Text>
                <Text style={styles.progressLabel}>heute erledigt</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(completedToday / habits.length) * 100}%` as any }]} />
              </View>
            </View>
          )}

          {/* Habits by Category */}
          {CATEGORIES.map(cat => {
            const catHabits = habits.filter(h => h.category === cat.key);
            if (catHabits.length === 0) return null;
            return (
              <View key={cat.key} style={styles.categorySection}>
                <Text style={[styles.categoryLabel, { color: CATEGORY_COLORS[cat.key] }]}>{cat.label}</Text>
                {catHabits.map(habit => {
                  const done = habit.completedDates.some(isToday);
                  const color = CATEGORY_COLORS[habit.category];
                  const bg = CATEGORY_BG[habit.category];
                  return (
                    <View
                      key={habit.id}
                      style={[styles.habitRow, done && { backgroundColor: bg, borderColor: color + '40' }]}
                    >
                      <TouchableOpacity
                        style={[styles.check, done && { backgroundColor: color, borderColor: color }]}
                        onPress={() => toggleHabit(habit.id)}
                        activeOpacity={0.7}
                      >
                        {done && <Text style={styles.checkMark}>✓</Text>}
                      </TouchableOpacity>

                      <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleHabit(habit.id)} activeOpacity={0.7}>
                        <Text style={[styles.habitName, done && { color: color }]}>{habit.name}</Text>
                      </TouchableOpacity>

                      {habit.streak > 0 && (
                        <View style={[styles.streakBadge, { backgroundColor: theme.orangeLight }]}>
                          <Text style={styles.streakText}>🔥 {habit.streak}</Text>
                        </View>
                      )}

                      {/* Edit Button */}
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEdit(habit)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.editBtnText}>✎</Text>
                      </TouchableOpacity>

                      {/* Delete Button */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => deleteHabit(habit.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {habits.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Noch keine Habits</Text>
              <Text style={styles.emptySub}>Füge deinen ersten Habit hinzu und baue gesunde Gewohnheiten auf.</Text>
            </View>
          )}

          <TouchableOpacity style={styles.addBtn} onPress={openNew} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>+ Habit hinzufügen</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingHabit ? 'Habit bearbeiten' : 'Neuer Habit'}</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Meditation, Wasser trinken..."
              placeholderTextColor={theme.textTertiary}
              value={habitName}
              onChangeText={setHabitName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Kategorie</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.catBtn,
                    habitCategory === cat.key && {
                      backgroundColor: CATEGORY_BG[cat.key],
                      borderColor: CATEGORY_COLORS[cat.key],
                    }
                  ]}
                  onPress={() => setHabitCategory(cat.key)}
                >
                  <Text style={[styles.catBtnText, habitCategory === cat.key && { color: CATEGORY_COLORS[cat.key] }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={addOrEditHabit}>
              <Text style={styles.saveBtnText}>{editingHabit ? 'Speichern' : 'Erstellen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowModal(false); setEditingHabit(null); }}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 20 },

  progressCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 20, ...theme.shadow },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 },
  progressNum: { color: theme.blue, fontSize: 36, fontWeight: '700' },
  progressSlash: { color: theme.textTertiary, fontSize: 24 },
  progressTotal: { color: theme.textSecondary, fontSize: 24, fontWeight: '500' },
  progressLabel: { color: theme.textSecondary, fontSize: 13, marginLeft: 6 },
  progressBar: { height: 6, backgroundColor: theme.cardSecondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.blue, borderRadius: 3 },

  categorySection: { marginBottom: 20 },
  categoryLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', marginBottom: 8 },

  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 8, ...theme.shadow },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.textTertiary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  habitName: { color: theme.textPrimary, fontSize: 14, fontWeight: '500' },
  streakBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { color: theme.orange, fontSize: 11, fontWeight: '500' },
  editBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.blueLight, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { color: theme.blue, fontSize: 14 },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: theme.red, fontSize: 18 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  addBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', ...theme.shadow },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.cardSecondary, borderWidth: 1, borderColor: 'transparent' },
  catBtnText: { color: theme.textSecondary, fontSize: 12, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14, textAlign: 'center', padding: 14 },
});