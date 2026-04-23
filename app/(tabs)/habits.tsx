import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
type Habit = {
  id: string;
  name: string;
  identity: string;
  category: 'morgen' | 'training' | 'ernaehrung' | 'abend' | 'custom';
  streak: number;
  completedToday: boolean;
  completedDates: string[];
};

const DEFAULT_HABITS: Habit[] = [
  { id: '1', name: 'Kreatin nehmen', identity: 'Ich bin jemand der konstant supplementiert', category: 'morgen', streak: 0, completedToday: false, completedDates: [] },
  { id: '2', name: '2L Wasser trinken', identity: 'Ich bin jemand der gut hydriert bleibt', category: 'morgen', streak: 0, completedToday: false, completedDates: [] },
  { id: '3', name: 'Training absolviert', identity: 'Ich bin ein Athlet', category: 'training', streak: 0, completedToday: false, completedDates: [] },
  { id: '4', name: 'Protein-Ziel erreicht', identity: 'Ich bin jemand der seinen Körper gut ernährt', category: 'ernaehrung', streak: 0, completedToday: false, completedDates: [] },
  { id: '5', name: 'Vor 23:00 ins Bett', identity: 'Ich bin jemand der Schlaf priorisiert', category: 'abend', streak: 0, completedToday: false, completedDates: [] },
];

const CATEGORY_COLORS: Record<string, string> = {
  morgen: '#F472B6',
  training: '#67E8F9',
  ernaehrung: '#FB923C',
  abend: '#A78BFA',
  custom: '#7C3AED',
};

const CATEGORY_LABELS: Record<string, string> = {
  morgen: 'Morgen',
  training: 'Training',
  ernaehrung: 'Ernährung',
  abend: 'Abend',
  custom: 'Custom',
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIdentity, setNewIdentity] = useState('');
  const [newCategory, setNewCategory] = useState<Habit['category']>('custom');
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const raw = await AsyncStorage.getItem('habits');
        if (raw) {
          const saved: Habit[] = JSON.parse(raw);
          const updated = saved.map(h => ({
            ...h,
            completedToday: h.completedDates.some(isToday),
          }));
          setHabits(updated);
        } else {
          setHabits(DEFAULT_HABITS);
          await AsyncStorage.setItem('habits', JSON.stringify(DEFAULT_HABITS));
        }
      }
      load();
    }, [])
  );

  async function toggleHabit(id: string) {
    const today = new Date().toISOString();
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const alreadyDone = h.completedDates.some(isToday);
      if (alreadyDone) {
        const newDates = h.completedDates.filter(d => !isToday(d));
        return { ...h, completedToday: false, completedDates: newDates, streak: Math.max(0, h.streak - 1) };
      } else {
        return { ...h, completedToday: true, completedDates: [...h.completedDates, today], streak: h.streak + 1 };
      }
    });
    setHabits(updated);
    await AsyncStorage.setItem('habits', JSON.stringify(updated));
  }

  async function addHabit() {
    if (!newName.trim()) return;
    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      identity: newIdentity.trim() || `Ich bin jemand der ${newName.toLowerCase()} macht`,
      category: newCategory,
      streak: 0,
      completedToday: false,
      completedDates: [],
    };
    const updated = [...habits, habit];
    setHabits(updated);
    await AsyncStorage.setItem('habits', JSON.stringify(updated));
    setNewName('');
    setNewIdentity('');
    setShowModal(false);
  }

  async function deleteHabit(id: string) {
    Alert.alert('Habit löschen?', 'Der gesamte Streak geht verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const updated = habits.filter(h => h.id !== id);
          setHabits(updated);
          await AsyncStorage.setItem('habits', JSON.stringify(updated));
        }
      }
    ]);
  }

  const completedCount = habits.filter(h => h.completedToday).length;
  const totalCount = habits.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const categories = ['morgen', 'training', 'ernaehrung', 'abend', 'custom'] as const;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <Text style={styles.headerLabel}>Habits</Text>
      <Text style={styles.title}>Deine{'\n'}Gewohnheiten</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryBig}>{completedCount}/{totalCount}</Text>
            <Text style={styles.summaryLbl}>Heute erledigt</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryRate, { color: completionRate >= 80 ? '#A78BFA' : completionRate >= 50 ? '#F472B6' : '#FB7185' }]}>
              {completionRate}%
            </Text>
            <Text style={styles.summaryLbl}>Konsistenz</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${completionRate}%` as any,
            backgroundColor: completionRate >= 80 ? '#7C3AED' : completionRate >= 50 ? '#EC4899' : '#FB7185'
          }]} />
        </View>
        <Text style={styles.atomicQuote}>
          {completionRate === 100 ? '🔥 Perfekter Tag – 1% besser als gestern!' :
            completionRate >= 80 ? '💪 Fast da – bleib dran!' :
              completionRate >= 50 ? '⚡ Halbzeit – du schaffst das!' :
                '🌱 Jeder Start zählt – fang klein an'}
        </Text>
      </View>

      {categories.map(cat => {
        const catHabits = habits.filter(h => h.category === cat);
        if (catHabits.length === 0) return null;
        const color = CATEGORY_COLORS[cat];
        return (
          <View key={cat} style={styles.categorySection}>
            <Text style={[styles.categoryLabel, { color }]}>{CATEGORY_LABELS[cat]}</Text>
            {catHabits.map(habit => (
              <View key={habit.id}>
                <TouchableOpacity
                  style={[styles.habitRow, habit.completedToday && styles.habitRowDone]}
                  onPress={() => toggleHabit(habit.id)}
                  onLongPress={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
                >
                  <View style={[styles.habitCheck, habit.completedToday && { backgroundColor: color + '33', borderColor: color }]}>
                    {habit.completedToday && <Text style={[styles.habitCheckMark, { color }]}>✓</Text>}
                  </View>
                  <View style={styles.habitContent}>
                    <Text style={[styles.habitName, habit.completedToday && { color: '#5B4A8A' }]}>{habit.name}</Text>
                    {habit.streak > 0 && (
                      <Text style={styles.habitStreak}>🔥 {habit.streak} Tage</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => deleteHabit(habit.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {expandedHabit === habit.id && (
                  <View style={styles.identityBox}>
                    <Text style={styles.identityText}>"{habit.identity}"</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
        <Text style={styles.addBtnText}>+ Neue Habit hinzufügen</Text>
      </TouchableOpacity>

      <View style={styles.atomicTip}>
        <Text style={styles.atomicTipTitle}>Atomic Habits Tipp</Text>
        <Text style={styles.atomicTipText}>
          Mach es einfach. Eine neue Habit sollte in under 2 Minuten machbar sein. Starte klein – "Training absolviert" kann auch ein 10-Minuten Spaziergang sein.
        </Text>
      </View>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Neue Habit</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Meditation"
              placeholderTextColor="#3D2E5C"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Identity (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ich bin jemand der..."
              placeholderTextColor="#3D2E5C"
              value={newIdentity}
              onChangeText={setNewIdentity}
            />

            <Text style={styles.inputLabel}>Kategorie</Text>
            <View style={styles.categoryPicker}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, newCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] + '33', borderColor: CATEGORY_COLORS[cat] }]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catBtnText, newCategory === cat && { color: CATEGORY_COLORS[cat] }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={addHabit}>
              <Text style={styles.saveBtnText}>Hinzufügen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.2)',
    padding: 20,
    marginBottom: 24,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryBig: {
    color: '#E2D9F3',
    fontSize: 36,
    fontWeight: '500',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryRate: {
    fontSize: 36,
    fontWeight: '500',
  },
  summaryLbl: {
    color: '#5B4A8A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  atomicQuote: {
    color: '#5B4A8A',
    fontSize: 12,
    fontStyle: 'italic',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    fontWeight: '500',
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    marginBottom: 6,
    gap: 12,
  },
  habitRowDone: {
    backgroundColor: 'rgba(124,58,237,0.05)',
    borderColor: 'rgba(124,58,237,0.15)',
  },
  habitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckMark: {
    fontSize: 12,
    fontWeight: '500',
  },
  habitContent: {
    flex: 1,
  },
  habitName: {
    color: '#C4B5D9',
    fontSize: 14,
    fontWeight: '500',
  },
  habitStreak: {
    color: '#5B4A8A',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: '#3D2E5C',
    fontSize: 18,
  },
  identityBox: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    marginLeft: 36,
  },
  identityText: {
    color: '#A78BFA',
    fontSize: 12,
    fontStyle: 'italic',
  },
  addBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  addBtnText: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '500',
  },
  atomicTip: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 40,
  },
  atomicTipTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  atomicTipText: {
    color: '#3D2E5C',
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0D0A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  modalTitle: {
    color: '#E2D9F3',
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    color: '#E2D9F3',
    fontSize: 15,
    marginBottom: 16,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catBtnText: {
    color: '#3D2E5C',
    fontSize: 12,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelBtnText: {
    color: '#5B4A8A',
    fontSize: 14,
  },
});