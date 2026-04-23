import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width - 40;

type WeightEntry = {
  date: string;
  weight: number;
  note?: string;
};

type Profile = {
  weight: string;
  targetWeight: string;
  name: string;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export default function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [todayLogged, setTodayLogged] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const rawEntries = await AsyncStorage.getItem('weightHistory');
        const rawProfile = await AsyncStorage.getItem('profile');
        if (rawEntries) {
          const e: WeightEntry[] = JSON.parse(rawEntries);
          setEntries(e);
          setTodayLogged(e.some(entry => isToday(entry.date)));
        }
        if (rawProfile) setProfile(JSON.parse(rawProfile));
      }
      load();
    }, [])
  );

  async function saveWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 30 || w > 300) {
      Alert.alert('Ungültig', 'Bitte ein gültiges Gewicht eingeben.');
      return;
    }
    const entry: WeightEntry = {
      date: new Date().toISOString(),
      weight: w,
      note: noteInput.trim() || undefined,
    };
    const filtered = entries.filter(e => !isToday(e.date));
    const updated = [...filtered, entry].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setEntries(updated);
    setTodayLogged(true);
    await AsyncStorage.setItem('weightHistory', JSON.stringify(updated));

    if (profile) {
      const updatedProfile = { ...profile, weight: String(w) };
      setProfile(updatedProfile);
      await AsyncStorage.setItem('profile', JSON.stringify(updatedProfile));
    }

    setWeightInput('');
    setNoteInput('');
    setShowModal(false);
  }

  async function deleteEntry(index: number) {
    Alert.alert('Eintrag löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          const updated = entries.filter((_, i) => i !== index);
          setEntries(updated);
          await AsyncStorage.setItem('weightHistory', JSON.stringify(updated));
          setTodayLogged(updated.some(e => isToday(e.date)));
        }
      }
    ]);
  }

  const last30 = entries.slice(-30);
  const currentWeight = entries.length > 0 ? entries[entries.length - 1].weight : parseFloat(profile?.weight ?? '0');
  const targetWeight = parseFloat(profile?.targetWeight ?? '0');
  const diff = targetWeight > 0 ? (targetWeight - currentWeight).toFixed(1) : null;
  const trend = entries.length >= 2
    ? (entries[entries.length - 1].weight - entries[entries.length - 2].weight).toFixed(1)
    : null;

  const chartData = last30.length >= 2 ? last30.map(e => e.weight) : [currentWeight || 70, currentWeight || 70];
  const chartLabels = last30.length >= 2 ? last30.map(e => formatDate(e.date)) : ['', ''];

  const minWeight = chartData.length > 0 ? Math.min(...chartData) - 1 : 60;
  const maxWeight = chartData.length > 0 ? Math.max(...chartData) + 1 : 80;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>Gewicht</Text>
      <Text style={styles.title}>Körpergewicht{'\n'}Tracking</Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: 'rgba(167,139,250,0.25)' }]}>
          <Text style={[styles.statVal, { color: '#A78BFA' }]}>{currentWeight || '--'}</Text>
          <Text style={styles.statLbl}>Aktuell (kg)</Text>
        </View>
        <View style={[styles.statCard, { borderColor: 'rgba(103,232,249,0.25)' }]}>
          <Text style={[styles.statVal, { color: '#67E8F9' }]}>{targetWeight || '--'}</Text>
          <Text style={styles.statLbl}>Ziel (kg)</Text>
        </View>
        <View style={[styles.statCard, { borderColor: diff && parseFloat(diff) > 0 ? 'rgba(167,139,250,0.25)' : 'rgba(251,113,133,0.25)' }]}>
          <Text style={[styles.statVal, { color: diff && parseFloat(diff) > 0 ? '#A78BFA' : '#FB7185' }]}>
            {diff ? `${parseFloat(diff) > 0 ? '+' : ''}${diff}` : '--'}
          </Text>
          <Text style={styles.statLbl}>Differenz</Text>
        </View>
        <View style={[styles.statCard, { borderColor: 'rgba(251,146,60,0.25)' }]}>
          <Text style={[styles.statVal, {
            color: trend
              ? parseFloat(trend) > 0 ? '#A78BFA' : parseFloat(trend) < 0 ? '#67E8F9' : '#5B4A8A'
              : '#5B4A8A'
          }]}>
            {trend ? `${parseFloat(trend) > 0 ? '+' : ''}${trend}` : '--'}
          </Text>
          <Text style={styles.statLbl}>Trend (kg)</Text>
        </View>
      </View>

      {last30.length >= 2 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Verlauf</Text>
          <LineChart
            data={{
              labels: chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0),
              datasets: [{
                data: chartData,
                color: () => '#A78BFA',
              },
              ...(targetWeight > 0 ? [{
                data: chartData.map(() => targetWeight),
                color: () => 'rgba(103,232,249,0.4)',
                strokeDashArray: [5, 5],
              }] : [])
              ]
            }}
            width={screenWidth - 32}
            height={180}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: '#0D0A1A',
              backgroundGradientTo: '#0D0A1A',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(167,139,250,${opacity})`,
              labelColor: () => '#5B4A8A',
              propsForDots: { r: '4', strokeWidth: '2', stroke: '#A78BFA', fill: '#A78BFA' },
              propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.04)' },
            }}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            fromZero={false}
          />
          {targetWeight > 0 && (
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#A78BFA' }]} />
                <Text style={styles.legendText}>Gewicht</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#67E8F9', opacity: 0.5 }]} />
                <Text style={styles.legendText}>Ziel</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {!todayLogged && (
        <TouchableOpacity style={styles.logBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.logBtnText}>+ Gewicht heute eintragen</Text>
        </TouchableOpacity>
      )}

      {todayLogged && (
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.editBtnText}>Heutiges Gewicht bearbeiten</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Letzte Einträge</Text>
      {entries.slice(-14).reverse().map((entry, i) => (
        <View key={i} style={styles.entryRow}>
          <View style={styles.entryLeft}>
            <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
            {entry.note && <Text style={styles.entryNote}>{entry.note}</Text>}
          </View>
          <Text style={styles.entryWeight}>{entry.weight} kg</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteEntry(entries.length - 1 - i)}>
            <Text style={styles.deleteBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gewicht eintragen</Text>
            <Text style={styles.inputLabel}>Gewicht (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder={String(currentWeight || '70.0')}
              placeholderTextColor="#3D2E5C"
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.inputLabel}>Notiz (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. nach dem Frühstück"
              placeholderTextColor="#3D2E5C"
              value={noteInput}
              onChangeText={setNoteInput}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveWeight}>
              <Text style={styles.saveBtnText}>Speichern</Text>
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
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, padding: 14 },
  statVal: { fontSize: 24, fontWeight: '500' },
  statLbl: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  chartCard: { backgroundColor: '#0D0A1A', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.2)', padding: 16, marginBottom: 16 },
  chartTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  chart: { borderRadius: 12, marginLeft: -16 },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#5B4A8A', fontSize: 11 },
  logBtn: { backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20 },
  logBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  editBtn: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.3)', padding: 14, alignItems: 'center', marginBottom: 20 },
  editBtnText: { color: '#A78BFA', fontSize: 14, fontWeight: '500' },
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12 },
  entryLeft: { flex: 1 },
  entryDate: { color: '#C4B5D9', fontSize: 14 },
  entryNote: { color: '#5B4A8A', fontSize: 11, marginTop: 2 },
  entryWeight: { color: '#A78BFA', fontSize: 16, fontWeight: '500' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(251,113,133,0.1)', borderWidth: 0.5, borderColor: 'rgba(251,113,133,0.3)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#FB7185', fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0D0A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', gap: 12 },
  modalTitle: { color: '#E2D9F3', fontSize: 20, fontWeight: '500' },
  inputLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 14, color: '#E2D9F3', fontSize: 15 },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#5B4A8A', fontSize: 14 },
});