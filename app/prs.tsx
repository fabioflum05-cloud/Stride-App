import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert, Animated, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useLanguage } from '../constants/LanguageContext';

type PREntry = { date: string; weight: number; reps: number; estimated1RM: number; };
type PRHistory = Record<string, PREntry[]>;
type UserMaxes = Record<string, number>;

function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getMuscleColor(mg: string): string {
  const colors: Record<string, string> = {
    'Brust': '#EC4899', 'Rücken': '#7C3AED', 'Schultern': '#06B6D4', 'Bizeps': '#10B981',
    'Trizeps': '#F59E0B', 'Quadrizeps': '#FB7185', 'Hamstrings': '#A78BFA', 'Gluteus': '#F472B6',
    'Waden': '#67E8F9', 'Core': '#FB923C', 'Ganzkörper': '#1A73E8',
  };
  return colors[mg] || theme.blue;
}

export default function PRScreen() {
  const { t, lang } = useLanguage();
  const [prHistory, setPRHistory] = useState<PRHistory>({});
  const [userMaxes, setUserMaxes] = useState<UserMaxes>({});
  const [exerciseMuscles, setExerciseMuscles] = useState<Record<string, string>>({});
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ exName: string; idx: number } | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editDate, setEditDate] = useState('');
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [addWeight, setAddWeight] = useState('');
  const [addReps, setAddReps] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(useCallback(() => {
    load();
    fadeAnim.setValue(0); slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []));

  async function load() {
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) setPRHistory(JSON.parse(rawPR));

    const rawMaxes = await AsyncStorage.getItem('userMaxes');
    if (rawMaxes) setUserMaxes(JSON.parse(rawMaxes));

    // Build exercise → muscleGroup map from workouts
    const rawW = await AsyncStorage.getItem('workouts');
    if (rawW) {
      const workouts = JSON.parse(rawW);
      const mgMap: Record<string, string> = {};
      workouts.forEach((w: any) => {
        w.exercises?.forEach((ex: any) => { if (!mgMap[ex.name]) mgMap[ex.name] = ex.muscleGroup; });
      });
      setExerciseMuscles(mgMap);
    }

    // Also build PRHistory from workouts if empty
    const rawPR2 = await AsyncStorage.getItem('prHistory');
    if (!rawPR2 || Object.keys(JSON.parse(rawPR2)).length === 0) {
      if (rawW) {
        const workouts = JSON.parse(rawW);
        const history: PRHistory = {};
        workouts.forEach((w: any) => {
          w.exercises?.forEach((ex: any) => {
            ex.sets?.forEach((set: any) => {
              const weight = parseFloat(set.weight || '0');
              const reps = parseFloat(set.reps || '0');
              if (weight <= 0 || reps <= 0) return;
              const est1RM = calculate1RM(weight, reps);
              const existing = history[ex.name] || [];
              const currentMax = existing.length > 0 ? existing[existing.length - 1].estimated1RM : 0;
              if (est1RM > currentMax) {
                history[ex.name] = [...existing, { date: w.date, weight, reps, estimated1RM: est1RM }];
              }
            });
          });
        });
        setPRHistory(history);
        await AsyncStorage.setItem('prHistory', JSON.stringify(history));
      }
    }
  }

  async function savePRHistory(updated: PRHistory) {
    setPRHistory(updated);
    await AsyncStorage.setItem('prHistory', JSON.stringify(updated));
    // Update userMaxes
    const newMaxes = { ...userMaxes };
    for (const [name, entries] of Object.entries(updated)) {
      if (entries.length > 0) {
        const max = Math.max(...entries.map(e => e.estimated1RM));
        newMaxes[name] = max;
      }
    }
    setUserMaxes(newMaxes);
    await AsyncStorage.setItem('userMaxes', JSON.stringify(newMaxes));
  }

  async function saveEdit() {
    if (!editingEntry) return;
    const w = parseFloat(editWeight), r = parseFloat(editReps);
    if (w <= 0 || r <= 0) { Alert.alert(lang === 'en' ? 'Invalid values' : 'Ungültige Werte'); return; }
    const est1RM = calculate1RM(w, r);
    const updated = { ...prHistory };
    updated[editingEntry.exName] = updated[editingEntry.exName].map((e, i) =>
      i === editingEntry.idx ? { ...e, weight: w, reps: r, estimated1RM: est1RM, date: editDate || e.date } : e
    );
    await savePRHistory(updated);
    setEditingEntry(null);
  }

  async function deleteEntry(exName: string, idx: number) {
    Alert.alert(lang === 'en' ? 'Delete entry?' : 'Eintrag löschen?', '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          const updated = { ...prHistory };
          updated[exName] = updated[exName].filter((_, i) => i !== idx);
          if (updated[exName].length === 0) delete updated[exName];
          await savePRHistory(updated);
        }
      }
    ]);
  }

  async function addEntry() {
    if (!showAddModal) return;
    const w = parseFloat(addWeight), r = parseFloat(addReps);
    if (w <= 0 || r <= 0) { Alert.alert(lang === 'en' ? 'Invalid values' : 'Ungültige Werte'); return; }
    const est1RM = calculate1RM(w, r);
    const updated = { ...prHistory };
    updated[showAddModal] = [...(updated[showAddModal] || []), {
      date: new Date().toISOString(), weight: w, reps: r, estimated1RM: est1RM,
    }];
    await savePRHistory(updated);
    setShowAddModal(null); setAddWeight(''); setAddReps('');
  }

  const exercises = Object.keys(prHistory).filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const aMax = Math.max(...(prHistory[a] || []).map(e => e.estimated1RM));
    const bMax = Math.max(...(prHistory[b] || []).map(e => e.estimated1RM));
    return bMax - aMax;
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>Personal Records</Text>
        <Text style={styles.title}>{lang === 'en' ? 'Your\nPersonal Bests' : 'Deine\nBestleistungen'}</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={lang === 'en' ? 'Search exercise...' : 'Übung suchen...'}
            placeholderTextColor={theme.textTertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: theme.textTertiary, fontSize: 16 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {exercises.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? (lang === 'en' ? 'No matches' : 'Keine Treffer')
                : (lang === 'en' ? 'No PRs yet' : 'Noch keine PRs')}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? (lang === 'en' ? 'Try a different spelling' : 'Andere Schreibweise versuchen')
                : (lang === 'en' ? 'Start a workout to set your first PRs!' : 'Starte ein Training um deine ersten PRs zu setzen!')}
            </Text>
          </View>
        ) : (
          exercises.map((exName, i) => {
            const entries = prHistory[exName] || [];
            const latest = entries[entries.length - 1];
            const best = Math.max(...entries.map(e => e.estimated1RM));
            const isOpen = selectedEx === exName;
            const mg = exerciseMuscles[exName];
            const mgColor = mg ? getMuscleColor(mg) : theme.blue;
            const trend = entries.length >= 2
              ? entries[entries.length - 1].estimated1RM - entries[entries.length - 2].estimated1RM
              : null;

            return (
              <View key={exName} style={[styles.prCard, isOpen && { borderLeftWidth: 3, borderLeftColor: mgColor }]}>
                {/* Header – tap to expand */}
                <TouchableOpacity onPress={() => setSelectedEx(isOpen ? null : exName)} activeOpacity={0.7}>
                  <View style={styles.prHeader}>
                    <View style={[styles.rankBadge, { backgroundColor: mgColor + '20' }]}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: mgColor }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prName}>{exName}</Text>
                      {mg && <Text style={[styles.mgLabel, { color: mgColor }]}>{mg}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[styles.prMax, { color: mgColor }]}>{best} kg</Text>
                      <Text style={styles.prMaxLabel}>1RM</Text>
                    </View>
                    <Text style={[styles.chevron, { color: mgColor }]}>{isOpen ? '▲' : '▼'}</Text>
                  </View>

                  {/* Compact stats row */}
                  {!isOpen && (
                    <View style={styles.compactRow}>
                      <Text style={styles.compactStat}>
                        <Text style={{ color: theme.green, fontWeight: '600' }}>{latest?.weight}kg</Text>
                        {' × '}{latest?.reps} {lang === 'en' ? 'reps' : 'Wdh.'}
                      </Text>
                      {trend !== null && (
                        <Text style={[styles.trendBadge, { color: trend >= 0 ? theme.green : theme.red }]}>
                          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}kg
                        </Text>
                      )}
                      <Text style={styles.compactDate}>
                        {new Date(latest?.date || '').toLocaleDateString(lang === 'en' ? 'en' : 'de', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Expanded view */}
                {isOpen && (
                  <View style={{ marginTop: 12 }}>
                    {/* Mini bar chart */}
                    {entries.length > 0 && (
                      <View style={styles.chartWrap}>
                        {entries.map((e, idx) => {
                          const maxVal = Math.max(...entries.map(x => x.estimated1RM));
                          const h = Math.max(8, Math.round((e.estimated1RM / maxVal) * 64));
                          const isLatest = idx === entries.length - 1;
                          return (
                            <View key={idx} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                              <Text style={{ color: isLatest ? mgColor : theme.textTertiary, fontSize: 8, fontWeight: '600' }}>
                                {e.estimated1RM}
                              </Text>
                              <View style={{ width: '75%', height: h, backgroundColor: isLatest ? mgColor : mgColor + '40', borderRadius: 3 }} />
                              <Text style={{ color: theme.textTertiary, fontSize: 7 }}>
                                {new Date(e.date).toLocaleDateString(lang === 'en' ? 'en' : 'de', { day: '2-digit', month: '2-digit' })}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Entry list with edit/delete */}
                    {entries.map((e, idx) => (
                      <View key={idx} style={styles.entryRow}>
                        <View style={[styles.entryDot, { backgroundColor: idx === entries.length - 1 ? mgColor : theme.textTertiary }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entryMain}>
                            {e.weight}kg × {e.reps} {lang === 'en' ? 'reps' : 'Wdh.'}
                            <Text style={{ color: mgColor, fontWeight: '600' }}> → {e.estimated1RM}kg 1RM</Text>
                          </Text>
                          <Text style={styles.entryDate}>
                            {new Date(e.date).toLocaleDateString(lang === 'en' ? 'en' : 'de', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => {
                            setEditingEntry({ exName, idx });
                            setEditWeight(String(e.weight));
                            setEditReps(String(e.reps));
                            setEditDate(e.date.split('T')[0]);
                          }}>
                          <Text style={{ color: theme.blue, fontSize: 12 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtn} onPress={() => deleteEntry(exName, idx)}>
                          <Text style={{ color: theme.red, fontSize: 14 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add new entry */}
                    <TouchableOpacity
                      style={[styles.addEntryBtn, { borderColor: mgColor }]}
                      onPress={() => { setShowAddModal(exName); setAddWeight(''); setAddReps(''); }}>
                      <Text style={[styles.addEntryText, { color: mgColor }]}>{lang === 'en' ? '+ Log new PR' : '+ Neuen PR eintragen'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </Animated.View>

      {/* Edit Modal */}
      <Modal visible={!!editingEntry} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{lang === 'en' ? 'Edit entry' : 'Eintrag bearbeiten'}</Text>
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Weight (kg)' : 'Gewicht (kg)'}</Text>
            <TextInput style={styles.input} value={editWeight} onChangeText={setEditWeight}
              keyboardType="decimal-pad" placeholder="85" placeholderTextColor={theme.textTertiary} />
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Reps' : 'Wiederholungen'}</Text>
            <TextInput style={styles.input} value={editReps} onChangeText={setEditReps}
              keyboardType="numeric" placeholder="3" placeholderTextColor={theme.textTertiary} />
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Date (YYYY-MM-DD)' : 'Datum (JJJJ-MM-TT)'}</Text>
            <TextInput style={styles.input} value={editDate} onChangeText={setEditDate}
              placeholder="2025-01-15" placeholderTextColor={theme.textTertiary} />
            {editWeight && editReps && parseFloat(editWeight) > 0 && parseFloat(editReps) > 0 && (
              <View style={styles.estimate}>
                <Text style={styles.estimateLabel}>{lang === 'en' ? 'New Est. 1RM' : 'Neuer Est. 1RM'}</Text>
                <Text style={styles.estimateVal}>
                  {calculate1RM(parseFloat(editWeight), parseFloat(editReps))} kg
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
              <Text style={styles.saveBtnText}>{lang === 'en' ? 'Save' : 'Speichern'} ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingEntry(null)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add PR Modal */}
      <Modal visible={!!showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{showAddModal}</Text>
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Weight (kg)' : 'Gewicht (kg)'}</Text>
            <TextInput style={styles.input} value={addWeight} onChangeText={setAddWeight}
              keyboardType="decimal-pad" placeholder="85" placeholderTextColor={theme.textTertiary} />
            <Text style={styles.inputLabel}>{lang === 'en' ? 'Reps' : 'Wiederholungen'}</Text>
            <TextInput style={styles.input} value={addReps} onChangeText={setAddReps}
              keyboardType="numeric" placeholder="3" placeholderTextColor={theme.textTertiary} />
            {addWeight && addReps && parseFloat(addWeight) > 0 && parseFloat(addReps) > 0 && (
              <View style={styles.estimate}>
                <Text style={styles.estimateLabel}>Est. 1RM</Text>
                <Text style={styles.estimateVal}>
                  {calculate1RM(parseFloat(addWeight), parseFloat(addReps))} kg
                </Text>
                <Text style={[styles.estimateLabel, { marginTop: 4 }]}>
                  = {Math.round(calculate1RM(parseFloat(addWeight), parseFloat(addReps)) * 0.85)}kg {lang === 'en' ? 'for 5 reps' : 'für 5 Wdh.'}
                  · {Math.round(calculate1RM(parseFloat(addWeight), parseFloat(addReps)) * 0.75)}kg {lang === 'en' ? 'for 10 reps' : 'für 10 Wdh.'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={addEntry}>
              <Text style={styles.saveBtnText}>{lang === 'en' ? 'Add' : 'Hinzufügen'} ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(null)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 16 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, ...theme.shadow },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: theme.textPrimary, fontSize: 15 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },

  prCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, ...theme.shadow },
  prHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  prName: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  mgLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 },
  prMax: { fontSize: 18, fontWeight: '700' },
  prMaxLabel: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  chevron: { fontSize: 14, marginLeft: 4 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: theme.borderLight },
  compactStat: { flex: 1, color: theme.textSecondary, fontSize: 12 },
  trendBadge: { fontSize: 12, fontWeight: '600' },
  compactDate: { color: theme.textTertiary, fontSize: 11 },

  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 88, marginBottom: 14, paddingHorizontal: 4 },

  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight },
  entryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  entryMain: { color: theme.textPrimary, fontSize: 13 },
  entryDate: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  editBtn: { padding: 6, borderRadius: 8, backgroundColor: theme.cardSecondary },

  addEntryBtn: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  addEntryText: { fontSize: 13, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  estimate: { backgroundColor: theme.blueLight, borderRadius: 12, padding: 14, alignItems: 'center' },
  estimateLabel: { color: theme.blue, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  estimateVal: { color: theme.blue, fontSize: 28, fontWeight: '700', marginTop: 2 },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
});