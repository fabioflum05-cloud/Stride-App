// app/(tabs)/health.tsx
// Manueller Health Screen — automatische Apple Health Integration folgt mit expo-health

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  bg:        '#1A1614',
  card:      '#231F1C',
  cardAlt:   '#2A2522',
  orange:    '#E8572A',
  blue:      '#4A9EFF',
  green:     '#34C759',
  red:       '#FF3B30',
  yellow:    '#FFD60A',
  purple:    '#BF5AF2',
  text:      '#F5F0EE',
  textMuted: '#8A8078',
  textDim:   '#5A5450',
  border:    '#3A3430',
};

const STORAGE_KEY = 'stride_health_history';

interface DayHealth {
  date:          string;
  hrv:           number | null;
  restingHR:     number | null;
  sleepHours:    number;
  sleepQuality:  number;
  recoveryScore: number;
  bodyweight:    number | null;
  notes:         string;
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

function calcRecovery(d: DayHealth, avgHRV: number | null): number {
  let score = 0; let weight = 0;
  if (d.hrv !== null) {
    const baseline = avgHRV ?? 55;
    score  += Math.min(100, Math.max(0, (d.hrv / baseline) * 80)) * 0.4;
    weight += 0.4;
  }
  if (d.restingHR !== null) {
    score  += Math.min(100, Math.max(0, ((80 - d.restingHR) / 30) * 100)) * 0.25;
    weight += 0.25;
  }
  const hoursPts   = Math.min(100, (d.sleepHours / 8) * 100);
  const qualityPts = ((d.sleepQuality - 1) / 4) * 100;
  score  += (hoursPts * 0.6 + qualityPts * 0.4) * 0.35;
  weight += 0.35;
  return weight > 0 ? Math.round(score / weight) : 0;
}

function recoveryColor(s: number): string {
  if (s >= 75) return C.green;
  if (s >= 50) return C.blue;
  if (s >= 30) return C.yellow;
  return C.red;
}

function recoveryLabel(s: number): string {
  if (s >= 80) return 'Optimal';
  if (s >= 65) return 'Gut erholt';
  if (s >= 50) return 'Moderat';
  if (s >= 35) return 'Eingeschränkt';
  return 'Nicht erholt';
}

function recoveryAdvice(s: number): string {
  if (s >= 80) return 'Intensives Training & Wettkampf empfohlen.';
  if (s >= 65) return 'Normales Training möglich.';
  if (s >= 50) return 'Moderates Training. Keine PR-Versuche.';
  if (s >= 35) return 'Leichte Einheit oder aktive Erholung.';
  return 'Rest Day. Regeneration hat Priorität.';
}

function hrvZone(v: number): { label: string; color: string } {
  if (v >= 80) return { label: 'Sehr gut',  color: C.green  };
  if (v >= 60) return { label: 'Normal',    color: C.blue   };
  if (v >= 40) return { label: 'Niedrig',   color: C.yellow };
  return             { label: 'Kritisch',  color: C.red    };
}

function hrZone(v: number): { label: string; color: string } {
  if (v <= 45) return { label: 'Athletisch', color: C.green  };
  if (v <= 55) return { label: 'Sehr gut',   color: C.blue   };
  if (v <= 65) return { label: 'Normal',     color: C.yellow };
  return             { label: 'Erhöht',     color: C.red    };
}

// Input Modal
interface InputModalProps {
  visible: boolean;
  data:    DayHealth;
  onSave:  (d: DayHealth) => void;
  onClose: () => void;
}

const InputModal: React.FC<InputModalProps> = ({ visible, data, onSave, onClose }) => {
  const [local, setLocal] = useState<DayHealth>(data);
  const [tab, setTab]     = useState<'hrv' | 'sleep' | 'body'>('hrv');

  useEffect(() => { if (visible) { setLocal(data); setTab('hrv'); } }, [visible, data]);

  const set = <K extends keyof DayHealth>(k: K, v: DayHealth[K]) =>
    setLocal(p => ({ ...p, [k]: v }));

  const qualityLabels = ['Sehr schlecht','Schlecht','Okay','Gut','Sehr gut'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={hs.overlay}>
          <View style={hs.sheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={hs.modalTitle}>Gesundheit erfassen</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: C.textMuted, fontSize: 15 }}>Abbrechen</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['hrv','sleep','body'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)}
                  style={[hs.tab, tab === t && { backgroundColor: C.orange }]}>
                  <Text style={{ color: tab === t ? C.text : C.textMuted, fontSize: 13, fontWeight: '600' }}>
                    {t === 'hrv' ? '❤️ HRV' : t === 'sleep' ? '🌙 Schlaf' : '⚖️ Körper'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {tab === 'hrv' && (
                <View>
                  <View style={hs.infoBox}>
                    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
                      💡 HRV morgens messen: direkt nach dem Aufwachen, liegend, 1–2 Minuten. Garmin Forerunner 265 misst automatisch.
                    </Text>
                  </View>
                  <Text style={hs.label}>HRV (RMSSD, ms)</Text>
                  <TextInput style={hs.input}
                    value={local.hrv?.toString() ?? ''}
                    onChangeText={t => set('hrv', t ? Number(t) : null)}
                    placeholder="z. B. 58" placeholderTextColor={C.textDim} keyboardType="numeric" />
                  {local.hrv !== null && (
                    <Text style={{ color: hrvZone(local.hrv).color, fontSize: 13, marginTop: 8, marginBottom: 16 }}>
                      {hrvZone(local.hrv).label} · {local.hrv} ms
                    </Text>
                  )}
                  <Text style={[hs.label, { marginTop: 8 }]}>Ruhepuls (bpm)</Text>
                  <TextInput style={hs.input}
                    value={local.restingHR?.toString() ?? ''}
                    onChangeText={t => set('restingHR', t ? Number(t) : null)}
                    placeholder="z. B. 52" placeholderTextColor={C.textDim} keyboardType="numeric" />
                  {local.restingHR !== null && (
                    <Text style={{ color: hrZone(local.restingHR).color, fontSize: 13, marginTop: 8, marginBottom: 16 }}>
                      {hrZone(local.restingHR).label} · {local.restingHR} bpm
                    </Text>
                  )}
                  <Text style={[hs.label, { marginTop: 8 }]}>Notizen</Text>
                  <TextInput style={[hs.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    value={local.notes} onChangeText={t => set('notes', t)}
                    placeholder="Krank, Reise, Stress…" placeholderTextColor={C.textDim} multiline />
                </View>
              )}

              {tab === 'sleep' && (
                <View>
                  <Text style={hs.label}>Schlafdauer (Stunden)</Text>
                  <TextInput style={hs.input}
                    value={local.sleepHours?.toString() ?? ''}
                    onChangeText={t => set('sleepHours', Number(t) || 0)}
                    placeholder="z. B. 7.5" placeholderTextColor={C.textDim} keyboardType="decimal-pad" />
                  <Text style={[hs.label, { marginTop: 16 }]}>Schlafqualität</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {[1,2,3,4,5].map(q => (
                      <TouchableOpacity key={q} onPress={() => set('sleepQuality', q)}
                        style={[hs.qualityBtn, local.sleepQuality === q && { backgroundColor: C.blue + '30', borderColor: C.blue }]}>
                        <Text style={{ fontSize: 20 }}>{['😣','😕','😐','🙂','😄'][q-1]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    {qualityLabels[local.sleepQuality - 1]}
                  </Text>
                </View>
              )}

              {tab === 'body' && (
                <View>
                  <Text style={hs.label}>Körpergewicht (kg)</Text>
                  <TextInput style={hs.input}
                    value={local.bodyweight?.toString() ?? ''}
                    onChangeText={t => set('bodyweight', t ? Number(t) : null)}
                    placeholder="z. B. 65.4" placeholderTextColor={C.textDim} keyboardType="decimal-pad" />
                  <View style={[hs.infoBox, { marginTop: 12 }]}>
                    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
                      💡 Täglich morgens nüchtern messen. Wettkampfgewicht -66 kg im Blick behalten.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity style={[hs.saveBtn, { marginTop: 24 }]} onPress={() => { onSave(local); onClose(); }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const Sparkline: React.FC<{ values: (number | null)[]; color: string; max: number }> = ({ values, color, max }) => {
  const last7 = values.slice(-7);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 4 }}>
      {last7.map((v, i) => (
        <View key={i} style={{ flex: 1, height: v !== null ? Math.max(4, (v / max) * 36) : 4,
          borderRadius: 2, backgroundColor: i === last7.length - 1 ? color : color + '55' }} />
      ))}
    </View>
  );
};

export default function HealthScreen() {
  const today = todayKey();
  const [history,   setHistory]   = useState<DayHealth[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [todayData, setTodayData] = useState<DayHealth | null>(null);
  const [loaded,    setLoaded]    = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (history.length > 0) setTodayData(history.find(d => d.date === today) ?? null);
  }, [history, today]);

  const saveDay = async (d: DayHealth) => {
    const hrvValues = history.filter(x => x.hrv !== null).map(x => x.hrv as number);
    const avgHRV    = hrvValues.length > 0 ? hrvValues.reduce((a,b) => a+b,0) / hrvValues.length : null;
    const updated   = { ...d, date: today, recoveryScore: calcRecovery(d, avgHRV) };
    const newHistory = history.some(x => x.date === today)
      ? history.map(x => x.date === today ? updated : x)
      : [updated, ...history];
    setHistory(newHistory);
    setTodayData(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const emptyToday: DayHealth = {
    date: today, hrv: null, restingHR: null,
    sleepHours: 7.5, sleepQuality: 3, recoveryScore: 0,
    bodyweight: null, notes: '',
  };

  const last14    = history.slice(0, 14).reverse();
  const hrvValues = last14.map(d => d.hrv);
  const hrValues  = last14.map(d => d.restingHR);
  const recValues = last14.map(d => d.recoveryScore);

  const avgHRV7 = (() => {
    const vals = last14.slice(-7).map(d => d.hrv).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  })();

  const avgHR7 = (() => {
    const vals = last14.slice(-7).map(d => d.restingHR).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  })();

  const recovery  = todayData?.recoveryScore ?? 0;
  const recColor  = recoveryColor(recovery);
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!loaded) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textMuted }}>Lade…</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={hs.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>{dateLabel}</Text>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginTop: 4 }}>Gesundheit</Text>
          </View>
          <TouchableOpacity onPress={() => setShowModal(true)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.text, fontSize: 22 }}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* Recovery Score */}
        <View style={hs.recoveryCard}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>ERHOLUNG</Text>
            <Text style={[hs.bigScore, { color: recColor }]}>{todayData ? recovery : '—'}</Text>
            <Text style={{ color: recColor, fontWeight: '600', fontSize: 14 }}>
              {todayData ? recoveryLabel(recovery) : 'Noch nicht erfasst'}
            </Text>
          </View>
          <View style={hs.divider} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 19, marginBottom: 8 }}>
              {todayData ? recoveryAdvice(recovery) : 'Erfasse heute deine Werte für eine Empfehlung.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View>
                <Text style={{ color: C.textDim, fontSize: 11 }}>HRV</Text>
                <Text style={{ color: todayData?.hrv ? hrvZone(todayData.hrv).color : C.textDim, fontSize: 16, fontWeight: '700' }}>
                  {todayData?.hrv ?? '—'}{todayData?.hrv ? 'ms' : ''}
                </Text>
              </View>
              <View>
                <Text style={{ color: C.textDim, fontSize: 11 }}>Ruhepuls</Text>
                <Text style={{ color: todayData?.restingHR ? hrZone(todayData.restingHR).color : C.textDim, fontSize: 16, fontWeight: '700' }}>
                  {todayData?.restingHR ?? '—'}{todayData?.restingHR ? 'bpm' : ''}
                </Text>
              </View>
              <View>
                <Text style={{ color: C.textDim, fontSize: 11 }}>Schlaf</Text>
                <Text style={{ color: C.blue, fontSize: 16, fontWeight: '700' }}>
                  {todayData ? `${todayData.sleepHours}h` : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {!todayData && (
          <TouchableOpacity style={hs.capturePrompt} onPress={() => setShowModal(true)}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🩺</Text>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>Heutige Werte erfassen</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>HRV, Ruhepuls, Schlaf</Text>
          </TouchableOpacity>
        )}

        {/* HRV Trend */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={hs.cardTitle}>HRV-Verlauf</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>7-Tage-Ø: {avgHRV7 ?? '—'} ms</Text>
              </View>
              {todayData?.hrv && (
                <View style={[hs.badge, { backgroundColor: hrvZone(todayData.hrv).color + '25' }]}>
                  <Text style={{ color: hrvZone(todayData.hrv).color, fontWeight: '600', fontSize: 13 }}>
                    {todayData.hrv} ms · {hrvZone(todayData.hrv).label}
                  </Text>
                </View>
              )}
            </View>
            <Sparkline values={hrvValues} color={C.green} max={120} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.textDim, fontSize: 10 }}>vor 13 Tagen</Text>
              <Text style={{ color: C.textDim, fontSize: 10 }}>Heute</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              {[{ r:'< 40', l:'Kritisch', c:C.red },{ r:'40–59', l:'Niedrig', c:C.yellow },{ r:'60–79', l:'Normal', c:C.blue },{ r:'≥ 80', l:'Sehr gut', c:C.green }].map(x => (
                <View key={x.r} style={{ alignItems: 'center' }}>
                  <Text style={{ color: x.c, fontSize: 11, fontWeight: '700' }}>{x.r}</Text>
                  <Text style={{ color: C.textDim, fontSize: 10 }}>{x.l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ruhepuls Trend */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={hs.cardTitle}>Ruhepuls</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>7-Tage-Ø: {avgHR7 ?? '—'} bpm</Text>
              </View>
              {todayData?.restingHR && (
                <View style={[hs.badge, { backgroundColor: hrZone(todayData.restingHR).color + '25' }]}>
                  <Text style={{ color: hrZone(todayData.restingHR).color, fontWeight: '600', fontSize: 13 }}>
                    {todayData.restingHR} bpm · {hrZone(todayData.restingHR).label}
                  </Text>
                </View>
              )}
            </View>
            <Sparkline values={hrValues} color={C.red} max={90} />
          </View>
        )}

        {/* Recovery Trend */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <Text style={[hs.cardTitle, { marginBottom: 14 }]}>Erholungs-Verlauf</Text>
            <Sparkline values={recValues} color={C.orange} max={100} />
          </View>
        )}

        {/* Verlauf */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <Text style={[hs.cardTitle, { marginBottom: 14 }]}>Letzte Einträge</Text>
            {last14.slice(0, 7).map(d => (
              <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.textMuted, fontSize: 13, width: 90 }}>{d.date}</Text>
                <View style={{ flex: 1, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {d.hrv !== null && <Text style={{ color: hrvZone(d.hrv).color, fontSize: 12 }}>HRV {d.hrv}ms</Text>}
                  {d.restingHR !== null && <Text style={{ color: hrZone(d.restingHR).color, fontSize: 12 }}>{d.restingHR}bpm</Text>}
                  <Text style={{ color: C.blue, fontSize: 12 }}>{d.sleepHours}h</Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: recoveryColor(d.recoveryScore) + '25' }}>
                  <Text style={{ color: recoveryColor(d.recoveryScore), fontSize: 12, fontWeight: '700' }}>{d.recoveryScore}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Garmin Hinweis */}
        <View style={hs.garminCard}>
          <Text style={{ fontSize: 24, marginBottom: 8 }}>⌚</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>Garmin Forerunner 265</Text>
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            HRV und Ruhepuls direkt aus der Garmin Connect App ablesen und hier manuell eintragen. Automatischer Sync folgt.
          </Text>
          <View style={[hs.badge, { backgroundColor: C.orange + '20', marginTop: 12, borderWidth: 1, borderColor: C.orange + '60' }]}>
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '600' }}>Manuell aktiv · Auto-Sync folgt</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <InputModal visible={showModal} data={todayData ?? emptyToday} onSave={saveDay} onClose={() => setShowModal(false)} />
    </View>
  );
}

const hs = StyleSheet.create({
  scroll:        { paddingHorizontal: 16, paddingTop: 60 },
  recoveryCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#231F1C', borderRadius: 18, padding: 20, marginBottom: 14 },
  bigScore:      { fontSize: 52, fontWeight: '800', lineHeight: 60 },
  divider:       { width: 1, height: 80, backgroundColor: '#3A3430', marginHorizontal: 16 },
  capturePrompt: { backgroundColor: '#231F1C', borderRadius: 18, padding: 28, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3A3430', borderStyle: 'dashed' },
  card:          { backgroundColor: '#231F1C', borderRadius: 18, padding: 18, marginBottom: 14 },
  cardTitle:     { color: '#F5F0EE', fontSize: 17, fontWeight: '600' },
  badge:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  garminCard:    { backgroundColor: '#231F1C', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E8572A40' },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#231F1C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, maxHeight: '88%' },
  modalTitle:    { color: '#F5F0EE', fontSize: 20, fontWeight: '700' },
  label:         { color: '#8A8078', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input:         { backgroundColor: '#2A2522', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#F5F0EE', fontSize: 16, borderWidth: 1, borderColor: '#3A3430' },
  infoBox:       { backgroundColor: '#2A2522', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#4A9EFF' },
  tab:           { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#2A2522' },
  qualityBtn:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3A3430', backgroundColor: '#2A2522' },
  saveBtn:       { backgroundColor: '#E8572A', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
});