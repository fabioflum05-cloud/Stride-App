import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Set = { reps: string; weight: string; };
type Exercise = { id: string; name: string; muscleGroup: string; sets: Set[]; };
type Workout = { id: string; date: string; name: string; exercises: Exercise[]; duration: number; intensity: number; };

const MUSCLE_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Quadrizeps', 'Hamstrings', 'Gluteus', 'Waden', 'Core', 'Ganzkörper'];
const MUSCLE_COLORS: Record<string, string> = {
  'Brust': '#EC4899', 'Rücken': '#7C3AED', 'Schultern': '#06B6D4', 'Bizeps': '#10B981',
  'Trizeps': '#F59E0B', 'Quadrizeps': '#FB7185', 'Hamstrings': '#A78BFA', 'Gluteus': '#F472B6',
  'Waden': '#67E8F9', 'Core': '#FB923C', 'Ganzkörper': '#E2D9F3',
};
const PRESET_EXERCISES = [
  { name: 'Bankdrücken', muscleGroup: 'Brust' }, { name: 'Schrägbankdrücken', muscleGroup: 'Brust' },
  { name: 'Butterfly', muscleGroup: 'Brust' }, { name: 'Klimmzüge', muscleGroup: 'Rücken' },
  { name: 'Rudern', muscleGroup: 'Rücken' }, { name: 'Kreuzheben', muscleGroup: 'Rücken' },
  { name: 'Schulterdrücken', muscleGroup: 'Schultern' }, { name: 'Seitheben', muscleGroup: 'Schultern' },
  { name: 'Curls', muscleGroup: 'Bizeps' }, { name: 'Trizepsdrücken', muscleGroup: 'Trizeps' },
  { name: 'Kniebeugen', muscleGroup: 'Quadrizeps' }, { name: 'Beinpresse', muscleGroup: 'Quadrizeps' },
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' }, { name: 'Hip Thrust', muscleGroup: 'Gluteus' },
  { name: 'Plank', muscleGroup: 'Core' }, { name: 'Crunches', muscleGroup: 'Core' },
];

function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getBest1RM(sets: Set[]): number {
  return Math.max(0, ...sets.map(s => calculate1RM(parseFloat(s.weight || '0'), parseFloat(s.reps || '0'))));
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

export default function TrainingScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [customExercise, setCustomExercise] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Brust');
  const [startTime] = useState(Date.now());
  const [lastWorkoutData, setLastWorkoutData] = useState<Record<string, Set[]>>({});

  useEffect(() => {
    async function load() {
      const raw = await AsyncStorage.getItem('workouts');
      if (raw) {
        const w: Workout[] = JSON.parse(raw);
        setWorkouts(w);
        const lastData: Record<string, Set[]> = {};
        [...w].reverse().forEach(workout => {
          workout.exercises?.forEach(ex => { if (!lastData[ex.name]) lastData[ex.name] = ex.sets; });
        });
        setLastWorkoutData(lastData);
      }
      const rawActive = await AsyncStorage.getItem('activeWorkout');
      if (rawActive) { const w = JSON.parse(rawActive); if (isToday(w.date)) setActiveWorkout(w); }
    }
    load();
  }, []);

  async function startWorkout() {
    const workout: Workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      name: workoutName.trim() || 'Training', exercises: [], duration: 0, intensity,
    };
    setActiveWorkout(workout);
    setShowNewWorkout(false);
    setWorkoutName('');
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(workout));
  }

  async function addExercise(name: string, muscleGroup: string) {
    if (!activeWorkout) return;
    const exercise: Exercise = { id: Date.now().toString(), name, muscleGroup, sets: [{ reps: '', weight: '' }] };
    const updated = { ...activeWorkout, exercises: [...activeWorkout.exercises, exercise] };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
    setShowExerciseModal(false);
  }

  async function updateSet(exerciseId: string, setIndex: number, field: 'reps' | 'weight', value: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const newSets = [...ex.sets];
        newSets[setIndex] = { ...newSets[setIndex], [field]: value };
        return { ...ex, sets: newSets };
      })
    };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function addSet(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        return { ...ex, sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] };
      })
    };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function removeExercise(exerciseId: string) {
    if (!activeWorkout) return;
    const updated = { ...activeWorkout, exercises: activeWorkout.exercises.filter(ex => ex.id !== exerciseId) };
    setActiveWorkout(updated);
    await AsyncStorage.setItem('activeWorkout', JSON.stringify(updated));
  }

  async function finishWorkout() {
    if (!activeWorkout) return;
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const finished = { ...activeWorkout, duration };
    const raw = await AsyncStorage.getItem('workouts');
    const history = raw ? JSON.parse(raw) : [];
    history.push(finished);
    await AsyncStorage.setItem('workouts', JSON.stringify(history));
    await AsyncStorage.removeItem('activeWorkout');
    const batteryDrain = Math.round(intensity * 5 + duration * 0.15);
    const rawBattery = await AsyncStorage.getItem('batteryData');
    if (rawBattery) {
      const battery = JSON.parse(rawBattery);
      await AsyncStorage.setItem('batteryData', JSON.stringify({
        ...battery,
        level: Math.max(0, battery.level - batteryDrain),
        calorieEntries: [...(battery.calorieEntries || []), {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }),
          kcal: Math.round(intensity * 80 + duration * 5),
          label: finished.name,
        }]
      }));
    }
    setWorkouts([...workouts, finished]);
    setActiveWorkout(null);
    Alert.alert('Training abgeschlossen! 💪', `${finished.exercises.length} Übungen · ${duration} Min · -${batteryDrain} Battery`);
  }

  async function deleteWorkout(index: number) {
    Alert.alert('Training löschen?', workouts[workouts.length - 1 - index].name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const updated = [...workouts];
          updated.splice(workouts.length - 1 - index, 1);
          setWorkouts(updated);
          await AsyncStorage.setItem('workouts', JSON.stringify(updated));
        }
      }
    ]);
  }

  const totalSets = activeWorkout?.exercises.reduce((s, ex) => s + ex.sets.length, 0) ?? 0;
  const totalVolume = activeWorkout?.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) => s + (parseFloat(set.reps || '0') * parseFloat(set.weight || '0')), 0), 0) ?? 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Training</Text>
      <Text style={styles.title}>{activeWorkout ? activeWorkout.name : 'Trainings\nLogger'}</Text>

      {!activeWorkout && (
        <>
          <TouchableOpacity style={styles.bodyBtn} onPress={() => router.push('/body' as any)}>
            <Text style={styles.bodyBtnText}>Körper Visualisierung →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bodyBtn} onPress={() => router.push('/ranking' as any)}>
            <Text style={styles.bodyBtnText}>🏆 Ranking & Level →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startBtn} onPress={() => setShowNewWorkout(true)}>
            <Text style={styles.startBtnText}>+ Neues Training starten</Text>
          </TouchableOpacity>
          {workouts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Letzte Workouts</Text>
              {workouts.slice(-5).reverse().map((w, i) => (
                <View key={i} style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    <Text style={styles.workoutDate}>{new Date(w.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}</Text>
                  </View>
                  <View style={styles.workoutStats}>
                    <Text style={styles.workoutStat}>{w.exercises?.length ?? 0} Übungen</Text>
                    <Text style={styles.workoutStat}>{w.duration} Min</Text>
                    <Text style={styles.workoutStat}>Intensität {w.intensity}/5</Text>
                  </View>
                  <View style={styles.muscleChips}>
                    {[...new Set(w.exercises?.map(ex => ex.muscleGroup) ?? [])].map(mg => (
                      <View key={mg} style={[styles.muscleChip, { borderColor: MUSCLE_COLORS[mg] + '60' }]}>
                        <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS[mg] }]}>{mg}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.deleteWorkoutBtn} onPress={() => deleteWorkout(i)}>
                    <Text style={styles.deleteWorkoutBtnText}>Löschen</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {activeWorkout && (
        <>
          <View style={styles.liveStats}>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatVal, { color: '#A78BFA' }]}>{activeWorkout.exercises.length}</Text>
              <Text style={styles.liveStatLbl}>Übungen</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatVal, { color: '#67E8F9' }]}>{totalSets}</Text>
              <Text style={styles.liveStatLbl}>Sets</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatVal, { color: '#FB923C' }]}>{Math.round(totalVolume)}</Text>
              <Text style={styles.liveStatLbl}>kg Vol.</Text>
            </View>
          </View>

          {activeWorkout.exercises.map(exercise => {
            const best1RM = getBest1RM(exercise.sets);
            const lastSets = lastWorkoutData[exercise.name];
            return (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={[styles.muscleBadge, { backgroundColor: MUSCLE_COLORS[exercise.muscleGroup] + '20', borderColor: MUSCLE_COLORS[exercise.muscleGroup] + '50' }]}>
                    <Text style={[styles.muscleBadgeText, { color: MUSCLE_COLORS[exercise.muscleGroup] }]}>{exercise.muscleGroup}</Text>
                  </View>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                    <Text style={styles.removeBtn}>×</Text>
                  </TouchableOpacity>
                </View>
                {lastSets && (
                  <View style={styles.lastWorkoutRow}>
                    <Text style={styles.lastWorkoutLabel}>Letztes Mal: </Text>
                    <Text style={styles.lastWorkoutVal}>{lastSets.map(s => `${s.weight}kg × ${s.reps}`).join(' · ')}</Text>
                  </View>
                )}
                {best1RM > 0 && (
                  <View style={styles.oneRMRow}>
                    <Text style={styles.oneRMLabel}>Est. 1RM: </Text>
                    <Text style={styles.oneRMVal}>{best1RM} kg</Text>
                  </View>
                )}
                <View style={styles.setHeader}>
                  <Text style={styles.setHeaderText}>Set</Text>
                  <Text style={styles.setHeaderText}>Wiederholungen</Text>
                  <Text style={styles.setHeaderText}>Gewicht (kg)</Text>
                </View>
                {exercise.sets.map((set, si) => (
                  <View key={si} style={styles.setRow}>
                    <Text style={styles.setNumber}>{si + 1}</Text>
                    <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.reps || '0'} placeholderTextColor="#3D2E5C"
                      value={set.reps} onChangeText={v => updateSet(exercise.id, si, 'reps', v)} keyboardType="numeric" />
                    <TextInput style={styles.setInput} placeholder={lastSets?.[si]?.weight || '0'} placeholderTextColor="#3D2E5C"
                      value={set.weight} onChangeText={v => updateSet(exercise.id, si, 'weight', v)} keyboardType="decimal-pad" />
                  </View>
                ))}
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise.id)}>
                  <Text style={styles.addSetBtnText}>+ Set hinzufügen</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setShowExerciseModal(true)}>
            <Text style={styles.addExerciseBtnText}>+ Übung hinzufügen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
            <Text style={styles.finishBtnText}>Training abschliessen ✓</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal visible={showNewWorkout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Neues Training</Text>
            <Text style={styles.inputLabel}>Name (optional)</Text>
            <TextInput style={styles.input} placeholder="z.B. Oberkörper, Beine..." placeholderTextColor="#3D2E5C"
              value={workoutName} onChangeText={setWorkoutName} />
            <Text style={styles.inputLabel}>Intensität</Text>
            <View style={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} style={[styles.intensityBtn, intensity === n && styles.intensityBtnActive]} onPress={() => setIntensity(n)}>
                  <Text style={[styles.intensityBtnText, intensity === n && styles.intensityBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={startWorkout}>
              <Text style={styles.saveBtnText}>Training starten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewWorkout(false)}>
              <Text style={styles.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showExerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Übung hinzufügen</Text>
              {MUSCLE_GROUPS.map(mg => (
                <View key={mg} style={styles.presetGroup}>
                  <Text style={[styles.presetGroupLabel, { color: MUSCLE_COLORS[mg] }]}>{mg}</Text>
                  <View style={styles.presetChips}>
                    {PRESET_EXERCISES.filter(e => e.muscleGroup === mg).map(ex => (
                      <TouchableOpacity key={ex.name} style={styles.presetChip} onPress={() => addExercise(ex.name, ex.muscleGroup)}>
                        <Text style={styles.presetChipText}>{ex.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              <Text style={styles.sectionTitle}>Eigene Übung</Text>
              <TextInput style={styles.input} placeholder="Übungsname" placeholderTextColor="#3D2E5C"
                value={customExercise} onChangeText={setCustomExercise} />
              <View style={styles.chipGrid}>
                {MUSCLE_GROUPS.map(mg => (
                  <TouchableOpacity key={mg} style={[styles.chip, customMuscle === mg && styles.chipActive]} onPress={() => setCustomMuscle(mg)}>
                    <Text style={[styles.chipText, customMuscle === mg && styles.chipTextActive]}>{mg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => { if (customExercise.trim()) addExercise(customExercise.trim(), customMuscle); }}>
                <Text style={styles.saveBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExerciseModal(false)}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  bodyBtn: { backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)', padding: 14, alignItems: 'center', marginBottom: 12 },
  bodyBtnText: { color: '#A78BFA', fontSize: 14, fontWeight: '500' },
  startBtn: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)', padding: 18, alignItems: 'center', marginBottom: 24 },
  startBtnText: { color: '#A78BFA', fontSize: 16, fontWeight: '500' },
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  workoutCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 10 },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  workoutName: { color: '#E2D9F3', fontSize: 15, fontWeight: '500' },
  workoutDate: { color: '#5B4A8A', fontSize: 13 },
  workoutStats: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  workoutStat: { color: '#5B4A8A', fontSize: 11 },
  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  muscleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, backgroundColor: 'transparent' },
  muscleChipText: { fontSize: 11, fontWeight: '500' },
  deleteWorkoutBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(251,113,133,0.1)', borderWidth: 0.5, borderColor: 'rgba(251,113,133,0.3)' },
  deleteWorkoutBtnText: { color: '#FB7185', fontSize: 11, fontWeight: '500' },
  liveStats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  liveStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 12, alignItems: 'center' },
  liveStatVal: { fontSize: 22, fontWeight: '500' },
  liveStatLbl: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  exerciseCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  muscleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5 },
  muscleBadgeText: { fontSize: 11, fontWeight: '500' },
  exerciseName: { flex: 1, color: '#E2D9F3', fontSize: 15, fontWeight: '500' },
  removeBtn: { color: '#3D2E5C', fontSize: 22 },
  lastWorkoutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8 },
  lastWorkoutLabel: { color: '#5B4A8A', fontSize: 11 },
  lastWorkoutVal: { color: '#A78BFA', fontSize: 11, fontWeight: '500' },
  oneRMRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  oneRMLabel: { color: '#5B4A8A', fontSize: 11 },
  oneRMVal: { color: '#67E8F9', fontSize: 13, fontWeight: '500' },
  setHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setHeaderText: { flex: 1, color: '#3D2E5C', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  setRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  setNumber: { color: '#5B4A8A', fontSize: 14, width: 20, textAlign: 'center' },
  setInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 10, color: '#E2D9F3', fontSize: 15, textAlign: 'center' },
  addSetBtn: { padding: 8, alignItems: 'center', marginTop: 4 },
  addSetBtnText: { color: '#5B4A8A', fontSize: 13 },
  addExerciseBtn: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', padding: 16, alignItems: 'center', marginBottom: 10 },
  addExerciseBtnText: { color: '#A78BFA', fontSize: 15, fontWeight: '500' },
  finishBtn: { backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 40 },
  finishBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0D0A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', gap: 12 },
  modalTitle: { color: '#E2D9F3', fontSize: 20, fontWeight: '500' },
  inputLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 14, color: '#E2D9F3', fontSize: 15 },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  intensityBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  intensityBtnText: { color: '#3D2E5C', fontSize: 15, fontWeight: '500' },
  intensityBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#5B4A8A', fontSize: 14 },
  presetGroup: { marginBottom: 12 },
  presetGroupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: '500' },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  presetChipText: { color: '#C4B5D9', fontSize: 13 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)' },
  chipText: { color: '#3D2E5C', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#A78BFA' },
});