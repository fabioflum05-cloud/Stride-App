import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
type CalorieEntry = {
  id: string;
  time: string;
  kcal: number;
  label: string;
};

type BatteryData = {
  level: number;
  calorieEntries: CalorieEntry[];
  date: string;
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function AnimatedBattery({ level }: { level: number }) {
  const startColor = level >= 70 ? '#7C3AED' : level >= 40 ? '#EC4899' : '#FB7185';
  const endColor = level >= 70 ? '#06B6D4' : level >= 40 ? '#F472B6' : '#FB7185';
  const statusText = level >= 70 ? 'Gut geladen' : level >= 40 ? 'Moderat' : 'Kritisch';
  const statusColor = level >= 70 ? '#A78BFA' : level >= 40 ? '#F472B6' : '#FB7185';
  const translateY = (1 - level / 100) * 154;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={140} height={260} viewBox="0 0 140 260">
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
          <ClipPath id="battClip">
            <Rect x="10" y="30" width="120" height="220" rx="18" />
          </ClipPath>
        </Defs>
        <Rect x="45" y="6" width="50" height="22" rx="8" fill="none" stroke="#2A1F40" strokeWidth={2} />
        <Rect x="51" y="10" width="38" height="14" rx="5" fill="#2A1F40" />
        <Rect x="10" y="30" width="120" height="220" rx="18" fill="#0D0A1A" stroke="#2A1F40" strokeWidth={1.5} />
        <Rect x="10" y={30 + translateY} width="120" height={220 - translateY} rx="4"
          fill="url(#fillGrad)" clipPath="url(#battClip)" />
        <Rect x="10" y="30" width="120" height="220" rx="18" fill="none" stroke="#3D2E5C" strokeWidth={1.5} />
        <SvgText x={70} y={152} textAnchor="middle" fill="#E2D9F3" fontSize={38} fontWeight="500">
          {level}
        </SvgText>
        <SvgText x={70} y={170} textAnchor="middle" fill="#5B4A8A" fontSize={9} letterSpacing={2}>
          BATTERY
        </SvgText>
        <SvgText x={70} y={188} textAnchor="middle" fill={statusColor} fontSize={11}>
          {statusText}
        </SvgText>
        {level <= 20 && (
          <Path d="M75 108 L65 130 L72 130 L65 150 L80 126 L73 126 Z" fill="#FFD700" opacity={0.9} />
        )}
      </Svg>
    </View>
  );
}

export default function BatteryScreen() {
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [sleepScore, setSleepScore] = useState(0);
  const [stress, setStress] = useState(3);
  const [showModal, setShowModal] = useState(false);
  const [kcalInput, setKcalInput] = useState('');
  const [labelInput, setLabelInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const rawSleep = await AsyncStorage.getItem('lastSleep');
    const rawCheckin = await AsyncStorage.getItem('lastCheckin');
    const rawBattery = await AsyncStorage.getItem('batteryData');

    let sleepSc = 0;
    let stressVal = 3;

    if (rawSleep) {
      const sleep = JSON.parse(rawSleep);
      if (isToday(sleep.date)) sleepSc = sleep.sleepScore ?? 0;
    }
    if (rawCheckin) {
      const checkin = JSON.parse(rawCheckin);
      if (isToday(checkin.date)) stressVal = checkin.stress ?? 3;
    }

    setSleepScore(sleepSc);
    setStress(stressVal);

    if (rawBattery) {
      const data: BatteryData = JSON.parse(rawBattery);
      if (isToday(data.date)) {
        setBatteryData(data);
        return;
      }
    }

    const startLevel = Math.round(sleepSc * 0.85);
    const newData: BatteryData = {
      level: startLevel,
      calorieEntries: [],
      date: new Date().toISOString(),
    };
    setBatteryData(newData);
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
  }

  function calculateLevel(entries: CalorieEntry[], baseSleep: number, stressVal: number) {
    const base = Math.round(baseSleep * 0.85);
    const totalKcal = entries.reduce((sum, e) => sum + e.kcal, 0);
    const kcalDrain = Math.round((totalKcal / 100) * 1.5);
    const stressDrain = stressVal * 4;
    return Math.max(0, Math.min(100, base - kcalDrain - stressDrain));
  }

  async function addCalories() {
    const kcal = parseInt(kcalInput);
    if (isNaN(kcal) || kcal <= 0) {
      Alert.alert('Ungültige Eingabe', 'Bitte eine gültige Kalorienzahl eingeben.');
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry: CalorieEntry = {
      id: Date.now().toString(),
      time: timeStr,
      kcal,
      label: labelInput.trim() || 'Aktivität',
    };
    const newEntries = [...(batteryData?.calorieEntries ?? []), entry];
    const newLevel = calculateLevel(newEntries, sleepScore, stress);
    const newData: BatteryData = {
      level: newLevel,
      calorieEntries: newEntries,
      date: new Date().toISOString(),
    };
    setBatteryData(newData);
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
    setKcalInput('');
    setLabelInput('');
    setShowModal(false);
  }

  async function deleteEntry(id: string) {
    const newEntries = (batteryData?.calorieEntries ?? []).filter(e => e.id !== id);
    const newLevel = calculateLevel(newEntries, sleepScore, stress);
    const newData: BatteryData = { ...batteryData!, level: newLevel, calorieEntries: newEntries };
    setBatteryData(newData);
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
  }

  async function editEntry(id: string, newKcal: number, newLabel: string) {
    const newEntries = (batteryData?.calorieEntries ?? []).map(e =>
      e.id === id ? { ...e, kcal: newKcal, label: newLabel } : e
    );
    const newLevel = calculateLevel(newEntries, sleepScore, stress);
    const newData: BatteryData = { ...batteryData!, level: newLevel, calorieEntries: newEntries };
    setBatteryData(newData);
    await AsyncStorage.setItem('batteryData', JSON.stringify(newData));
  }

  const level = batteryData?.level ?? 0;
  const entries = batteryData?.calorieEntries ?? [];
  const totalKcal = entries.reduce((sum, e) => sum + e.kcal, 0);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <BackButton />
      <Text style={styles.headerLabel}>Body Battery</Text>
      <Text style={styles.title}>Deine{'\n'}Energie</Text>

      <View style={styles.batteryWrap}>
        <AnimatedBattery level={level} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#A78BFA' }]}>{sleepScore}</Text>
          <Text style={styles.statLbl}>Sleep Score</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#FB7185' }]}>{totalKcal}</Text>
          <Text style={styles.statLbl}>kcal verbrannt</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#F472B6' }]}>{stress}/5</Text>
          <Text style={styles.statLbl}>Stress</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoDot} />
          <Text style={styles.infoLabel}>Wie wird berechnet?</Text>
        </View>
        <Text style={styles.infoText}>
          Schlaf lädt deine Batterie morgens auf. Kalorien verbrannt und Stress entladen sie über den Tag.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Heutige Events</Text>

      {sleepScore > 0 && (
        <View style={styles.eventRow}>
          <View style={[styles.eventDot, { backgroundColor: '#A78BFA' }]} />
          <View style={styles.eventContent}>
            <Text style={styles.eventName}>Schlaf</Text>
            <Text style={styles.eventTime}>Heute Nacht</Text>
          </View>
          <Text style={[styles.eventDelta, { color: '#A78BFA' }]}>+{Math.round(sleepScore * 0.85)}</Text>
        </View>
      )}

      {stress > 3 && (
        <View style={styles.eventRow}>
          <View style={[styles.eventDot, { backgroundColor: '#F472B6' }]} />
          <View style={styles.eventContent}>
            <Text style={styles.eventName}>Stress</Text>
            <Text style={styles.eventTime}>Check-in</Text>
          </View>
          <Text style={[styles.eventDelta, { color: '#F472B6' }]}>-{stress * 4}</Text>
        </View>
      )}

      {entries.map((entry, i) => (
        <View key={entry.id ?? i} style={styles.eventRow}>
          <View style={[styles.eventDot, { backgroundColor: '#FB7185' }]} />
          <View style={styles.eventContent}>
            <Text style={styles.eventName}>{entry.label}</Text>
            <Text style={styles.eventTime}>{entry.time} · {entry.kcal} kcal</Text>
          </View>
          <View style={styles.eventActions}>
            <TouchableOpacity
              style={styles.editEntryBtn}
              onPress={() => {
                Alert.prompt(
                  'Kalorien bearbeiten',
                  entry.label,
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Speichern',
                      onPress: (val?: string) => {
                        const kcal = parseInt(val ?? '0');
                        if (!isNaN(kcal) && kcal > 0) editEntry(entry.id, kcal, entry.label);
                      }
                    }
                  ],
                  'plain-text',
                  String(entry.kcal),
                  'numeric'
                );
              }}
            >
              <Text style={styles.editEntryBtnText}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteEntryBtn}
              onPress={() => Alert.alert('Löschen?', entry.label, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => deleteEntry(entry.id) }
              ])}
            >
              <Text style={styles.deleteEntryBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {entries.length === 0 && sleepScore === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Füll zuerst den Sleep Log aus um deine Batterie zu starten.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
        <Text style={styles.addBtnText}>+ Kalorien verbrannt eintragen</Text>
      </TouchableOpacity>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Wann eintragen?</Text>
        <Text style={styles.tipText}>Morgens, mittags und abends. So siehst du wie deine Energie über den Tag sinkt.</Text>
      </View>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kalorien verbrannt</Text>

            <Text style={styles.inputLabel}>Bezeichnung</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Morgen, Mittag, Training..."
              placeholderTextColor="#3D2E5C"
              value={labelInput}
              onChangeText={setLabelInput}
            />

            <Text style={styles.inputLabel}>Kalorien (kcal)</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. 800"
              placeholderTextColor="#3D2E5C"
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="numeric"
            />

            <View style={styles.quickBtns}>
              {[500, 800, 1200, 2000].map(v => (
                <TouchableOpacity key={v} style={styles.quickBtn} onPress={() => setKcalInput(String(v))}>
                  <Text style={styles.quickBtnText}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={addCalories}>
              <Text style={styles.saveBtnText}>Eintragen</Text>
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
    marginBottom: 20,
  },
  batteryWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 12,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '500',
  },
  statLbl: {
    color: '#5B4A8A',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.15)',
    padding: 14,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
  },
  infoLabel: {
    color: '#7C3AED',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoText: {
    color: '#5B4A8A',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventContent: {
    flex: 1,
  },
  eventName: {
    color: '#C4B5D9',
    fontSize: 13,
  },
  eventTime: {
    color: '#5B4A8A',
    fontSize: 11,
    marginTop: 2,
  },
  eventDelta: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editEntryBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editEntryBtnText: {
    color: '#A78BFA',
    fontSize: 13,
  },
  deleteEntryBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(251,113,133,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(251,113,133,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteEntryBtnText: {
    color: '#FB7185',
    fontSize: 18,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#3D2E5C',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  addBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  addBtnText: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '500',
  },
  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    marginBottom: 40,
  },
  tipTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  tipText: {
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
    gap: 12,
  },
  modalTitle: {
    color: '#E2D9F3',
    fontSize: 20,
    fontWeight: '500',
  },
  inputLabel: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    color: '#E2D9F3',
    fontSize: 15,
  },
  quickBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickBtnText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#5B4A8A',
    fontSize: 14,
  },
});