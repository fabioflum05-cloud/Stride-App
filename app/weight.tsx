import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { theme } from '../constants/theme';

const screenWidth = Dimensions.get('window').width - 40;

type WeightEntry = { date: string; weight: number; note?: string; };
type Profile = { weight: string; targetWeight: string; name: string; };

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
    const rawEntries = await AsyncStorage.getItem('weightHistory');
    const rawProfile = await AsyncStorage.getItem('profile');
    if (rawEntries) {
      const e: WeightEntry[] = JSON.parse(rawEntries);
      setEntries(e);
      setTodayLogged(e.some(entry => isToday(entry.date)));
    }
    if (rawProfile) setProfile(JSON.parse(rawProfile));
  }

  async function saveWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w < 30 || w > 300) { Alert.alert('Ungültig', 'Bitte ein gültiges Gewicht eingeben.'); return; }
    const entry: WeightEntry = { date: new Date().toISOString(), weight: w, note: noteInput.trim() || undefined };
    const filtered = entries.filter(e => !isToday(e.date));
    const updated = [...filtered, entry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>Gewicht</Text>
        <Text style={styles.title}>Körpergewicht{'\n'}Tracking</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { val: currentWeight || '--', lbl: 'Aktuell (kg)', color: theme.blue },
            { val: targetWeight || '--', lbl: 'Ziel (kg)', color: theme.green },
            { val: diff ? `${parseFloat(diff) > 0 ? '+' : ''}${diff}` : '--', lbl: 'Differenz', color: parseFloat(diff ?? '0') > 0 ? theme.orange : theme.green },
            { val: trend ? `${parseFloat(trend) > 0 ? '+' : ''}${trend}` : '--', lbl: 'Trend (kg)', color: parseFloat(trend ?? '0') > 0 ? theme.red : theme.green },
          ].map(s => (
            <View key={s.lbl} style={styles.statCard}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Chart */}
        {last30.length >= 2 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Verlauf</Text>
            <LineChart
              data={{
                labels: chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0),
                datasets: [
                  { data: chartData, color: () => theme.blue },
                  ...(targetWeight > 0 ? [{ data: chartData.map(() => targetWeight), color: () => theme.green + '80', strokeDashArray: [5, 5] }] : [])
                ]
              }}
              width={screenWidth - 32}
              height={180}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(26,115,232,${opacity})`,
                labelColor: () => theme.textSecondary,
                propsForDots: { r: '4', strokeWidth: '2', stroke: theme.blue, fill: theme.blue },
                propsForBackgroundLines: { stroke: theme.borderLight },
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
                  <View style={[styles.legendDot, { backgroundColor: theme.blue }]} />
                  <Text style={styles.legendText}>Gewicht</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.green }]} />
                  <Text style={styles.legendText}>Ziel</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Log Button */}
        {!todayLogged ? (
          <TouchableOpacity style={styles.logBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Text style={styles.logBtnText}>+ Gewicht heute eintragen</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Text style={styles.editBtnText}>Heutiges Gewicht bearbeiten</Text>
          </TouchableOpacity>
        )}

        {/* History */}
        <Text style={styles.sectionTitle}>Letzte Einträge</Text>
        {entries.slice(-14).reverse().map((entry, i) => (
          <View key={i} style={styles.entryRow}>
            <View style={styles.entryLeft}>
              <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
              {entry.note && <Text style={styles.entryNote}>{entry.note}</Text>}
            </View>
            <Text style={styles.entryWeight}>{entry.weight} kg</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deleteEntry(entries.length - 1 - i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </Animated.View>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gewicht eintragen</Text>
            <Text style={styles.inputLabel}>Gewicht (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder={String(currentWeight || '70.0')}
              placeholderTextColor={theme.textTertiary}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.inputLabel}>Notiz (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. nach dem Frühstück"
              placeholderTextColor={theme.textTertiary}
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
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 24 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { width: '48%', backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  statVal: { fontSize: 24, fontWeight: '600' },
  statLbl: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  chartCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadow },
  chartTitle: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, fontWeight: '600' },
  chart: { borderRadius: 12, marginLeft: -16 },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: theme.textSecondary, fontSize: 11 },

  logBtn: { backgroundColor: theme.blue, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20, ...theme.shadow },
  logBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  editBtn: { backgroundColor: theme.blueLight, borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 20 },
  editBtnText: { color: theme.blue, fontSize: 14, fontWeight: '500' },

  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.borderLight, gap: 12 },
  entryLeft: { flex: 1 },
  entryDate: { color: theme.textPrimary, fontSize: 14, fontWeight: '500' },
  entryNote: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  entryWeight: { color: theme.blue, fontSize: 16, fontWeight: '600' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: theme.red, fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  saveBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
});