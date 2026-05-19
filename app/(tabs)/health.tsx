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
  View
} from 'react-native';

// ─── Colours ────────────────────────────────────────────────────────────────
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

const STORAGE_KEY_PREFIX = 'stride_health_';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DayHealth {
  date:         string;
  hrv:          number | null;    // ms — null = nicht gemessen
  restingHR:    number | null;    // bpm
  sleepHours:   number;
  sleepQuality: number;           // 1–5
  recoveryScore: number;          // 0–100 (berechnet)
  bodyweight:   number | null;    // kg
  notes:        string;
}

interface HRVEntry {
  date:  string;
  value: number;
  source: 'manual' | 'polar';
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

// ─── Recovery score algorithm ────────────────────────────────────────────────
// HRV-Anteil 40 %, Ruhepuls 25 %, Schlaf 35 %
// HRV: Basis 60 ms = 100 Punkte. Unter 30 = 0.
// Ruhepuls: Unter 50 = 100, über 80 = 0.
function calcRecovery(d: DayHealth, avgHRV: number | null): number {
  let score = 0;
  let weight = 0;

  // HRV (40%)
  if (d.hrv !== null) {
    const baseline = avgHRV ?? 55;
    const ratio    = d.hrv / baseline;
    const pts      = Math.min(100, Math.max(0, ratio * 80));
    score  += pts * 0.4;
    weight += 0.4;
  }

  // Ruhepuls (25%)
  if (d.restingHR !== null) {
    const pts = Math.min(100, Math.max(0, ((80 - d.restingHR) / 30) * 100));
    score  += pts * 0.25;
    weight += 0.25;
  }

  // Schlaf (35%): Stunden + Qualität kombiniert
  {
    const hoursPts   = Math.min(100, (d.sleepHours / 8) * 100);
    const qualityPts = ((d.sleepQuality - 1) / 4) * 100;
    const pts        = hoursPts * 0.6 + qualityPts * 0.4;
    score  += pts * 0.35;
    weight += 0.35;
  }

  if (weight === 0) return 0;
  return Math.round(score / weight);
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
  if (s >= 80) return 'Intensives Training und Wettkampf empfohlen.';
  if (s >= 65) return 'Normales Training möglich. Auf Belastungsgrenzen achten.';
  if (s >= 50) return 'Moderates Training. Keine PR-Versuche heute.';
  if (s >= 35) return 'Leichte Einheit oder aktive Erholung. Volumen reduzieren.';
  return 'Rest Day empfohlen. Regeneration hat Priorität.';
}

function hrvZone(hrv: number): { label: string; color: string } {
  if (hrv >= 80) return { label: 'Sehr gut',    color: C.green  };
  if (hrv >= 60) return { label: 'Normal',       color: C.blue   };
  if (hrv >= 40) return { label: 'Niedrig',      color: C.yellow };
  return             { label: 'Kritisch',      color: C.red    };
}

function hrZone(hr: number): { label: string; color: string } {
  if (hr <= 45) return { label: 'Athletisch',  color: C.green  };
  if (hr <= 55) return { label: 'Sehr gut',    color: C.blue   };
  if (hr <= 65) return { label: 'Normal',      color: C.yellow };
  return             { label: 'Erhöht',       color: C.red    };
}

// ─── InputModal: HRV + Ruhepuls + Schlaf + Gewicht ───────────────────────────
interface InputModalProps {
  visible:  boolean;
  data:     DayHealth;
  onSave:   (d: DayHealth) => void;
  onClose:  () => void;
}

const InputModal: React.FC<InputModalProps> = ({ visible, data, onSave, onClose }) => {
  const [local, setLocal] = useState<DayHealth>(data);
  const [tab, setTab]     = useState<'hrv' | 'sleep' | 'body'>('hrv');

  useEffect(() => { if (visible) { setLocal(data); setTab('hrv'); } }, [visible, data]);

  const set = <K extends keyof DayHealth>(k: K, v: DayHealth[K]) =>
    setLocal(p => ({ ...p, [k]: v }));

  const qualityLabels = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut'];

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

            {/* Tabs */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['hrv', 'sleep', 'body'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  style={[hs.tab, tab === t && { backgroundColor: C.orange }]}
                >
                  <Text style={{ color: tab === t ? C.text : C.textMuted, fontSize: 13, fontWeight: '600' }}>
                    {t === 'hrv' ? '❤️ HRV' : t === 'sleep' ? '🌙 Schlaf' : '⚖️ Körper'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── HRV + Ruhepuls ── */}
              {tab === 'hrv' && (
                <View>
                  <View style={hs.infoBox}>
                    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
                      💡 HRV morgens messen: direkt nach dem Aufwachen, liegend, 1–2 Minuten. Empfohlen: Polar H10 + EliteHRV App.
                    </Text>
                  </View>

                  <Text style={hs.label}>HRV (RMSSD, ms)</Text>
                  <TextInput
                    style={hs.input}
                    value={local.hrv?.toString() ?? ''}
                    onChangeText={t => set('hrv', t ? Number(t) : null)}
                    placeholder="z. B. 58"
                    placeholderTextColor={C.textDim}
                    keyboardType="numeric"
                  />
                  {local.hrv !== null && (
                    <View style={{ marginTop: 8, marginBottom: 16 }}>
                      <Text style={{ color: hrvZone(local.hrv).color, fontSize: 13 }}>
                        {hrvZone(local.hrv).label} · {local.hrv} ms
                      </Text>
                    </View>
                  )}

                  <Text style={[hs.label, { marginTop: 8 }]}>Ruhepuls (bpm)</Text>
                  <TextInput
                    style={hs.input}
                    value={local.restingHR?.toString() ?? ''}
                    onChangeText={t => set('restingHR', t ? Number(t) : null)}
                    placeholder="z. B. 52"
                    placeholderTextColor={C.textDim}
                    keyboardType="numeric"
                  />
                  {local.restingHR !== null && (
                    <View style={{ marginTop: 8, marginBottom: 16 }}>
                      <Text style={{ color: hrZone(local.restingHR).color, fontSize: 13 }}>
                        {hrZone(local.restingHR).label} · {local.restingHR} bpm
                      </Text>
                    </View>
                  )}

                  <Text style={[hs.label, { marginTop: 8 }]}>Notizen</Text>
                  <TextInput
                    style={[hs.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    value={local.notes}
                    onChangeText={t => set('notes', t)}
                    placeholder="Krank, Reise, Stress, besondere Umstände…"
                    placeholderTextColor={C.textDim}
                    multiline
                  />
                </View>
              )}

              {/* ── Schlaf ── */}
              {tab === 'sleep' && (
                <View>
                  <Text style={hs.label}>Schlafdauer (Stunden)</Text>
                  <TextInput
                    style={hs.input}
                    value={local.sleepHours?.toString() ?? ''}
                    onChangeText={t => set('sleepHours', Number(t) || 0)}
                    placeholder="z. B. 7.5"
                    placeholderTextColor={C.textDim}
                    keyboardType="decimal-pad"
                  />

                  {/* Schlafqualität */}
                  <Text style={[hs.label, { marginTop: 16 }]}>Schlafqualität</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {[1,2,3,4,5].map(q => (
                      <TouchableOpacity
                        key={q}
                        onPress={() => set('sleepQuality', q)}
                        style={[hs.qualityBtn, local.sleepQuality === q && { backgroundColor: C.blue + '30', borderColor: C.blue }]}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {['😣','😕','😐','🙂','😄'][q-1]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    {qualityLabels[local.sleepQuality - 1]}
                  </Text>
                </View>
              )}

              {/* ── Körper ── */}
              {tab === 'body' && (
                <View>
                  <Text style={hs.label}>Körpergewicht (kg)</Text>
                  <TextInput
                    style={hs.input}
                    value={local.bodyweight?.toString() ?? ''}
                    onChangeText={t => set('bodyweight', t ? Number(t) : null)}
                    placeholder="z. B. 65.4"
                    placeholderTextColor={C.textDim}
                    keyboardType="decimal-pad"
                  />
                  <View style={hs.infoBox}>
                    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
                      💡 Täglich zur gleichen Zeit messen: morgens nach dem Aufstehen, nüchtern.
                      Wettkampfgewicht -66 kg im Blick behalten.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[hs.saveBtn, { marginTop: 24 }]}
                onPress={() => { onSave(local); onClose(); }}
              >
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Mini Trend Sparkline (pure RN boxes, no SVG) ────────────────────────────
const Sparkline: React.FC<{ values: (number | null)[]; color: string; max: number }> = ({ values, color, max }) => {
  const last7 = values.slice(-7);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 4 }}>
      {last7.map((v, i) => {
        const h = v !== null ? Math.max(4, (v / max) * 36) : 4;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: 2,
              backgroundColor: i === last7.length - 1 ? color : color + '55',
            }}
          />
        );
      })}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HealthScreen() {
  const today = todayKey();

  const [history,     setHistory]     = useState<DayHealth[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [todayData,   setTodayData]   = useState<DayHealth | null>(null);
  const [loaded,      setLoaded]      = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + 'history');
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (history.length > 0) {
      const t = history.find(d => d.date === today);
      setTodayData(t ?? null);
    }
  }, [history, today]);

  const saveDay = async (d: DayHealth) => {
    // Calc recovery
    const hrvValues = history.filter(x => x.hrv !== null).map(x => x.hrv as number);
    const avgHRV    = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;
    const rec       = calcRecovery(d, avgHRV);
    const updated   = { ...d, date: today, recoveryScore: rec };

    const newHistory = history.some(x => x.date === today)
      ? history.map(x => x.date === today ? updated : x)
      : [updated, ...history];

    setHistory(newHistory);
    setTodayData(updated);
    await AsyncStorage.setItem(STORAGE_KEY_PREFIX + 'history', JSON.stringify(newHistory));
  };

  const emptyToday: DayHealth = {
    date:          today,
    hrv:           null,
    restingHR:     null,
    sleepHours:    7.5,
    sleepQuality:  3,
    recoveryScore: 0,
    bodyweight:    null,
    notes:         '',
  };

  const last14     = history.slice(0, 14).reverse();
  const hrvValues  = last14.map(d => d.hrv);
  const hrValues   = last14.map(d => d.restingHR);
  const recValues  = last14.map(d => d.recoveryScore);

  const avgHRV7    = (() => {
    const vals = last14.slice(-7).map(d => d.hrv).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
  })();

  const avgHR7 = (() => {
    const vals = last14.slice(-7).map(d => d.restingHR).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
  })();

  const recovery  = todayData?.recoveryScore ?? 0;
  const recColor  = recoveryColor(recovery);
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.textMuted }}>Lade…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={hs.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>{dateLabel}</Text>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginTop: 4 }}>Gesundheit</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            style={hs.addBtn}
          >
            <Text style={{ color: C.text, fontSize: 22 }}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recovery Score Card ── */}
        <View style={hs.recoveryCard}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>ERHOLUNGS-SCORE</Text>
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

            {/* HRV + HR mini stats */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View>
                <Text style={{ color: C.textDim, fontSize: 11 }}>HRV</Text>
                <Text style={{ color: todayData?.hrv ? hrvZone(todayData.hrv).color : C.textDim, fontSize: 16, fontWeight: '700' }}>
                  {todayData?.hrv ?? '—'} {todayData?.hrv ? 'ms' : ''}
                </Text>
              </View>
              <View>
                <Text style={{ color: C.textDim, fontSize: 11 }}>Ruhepuls</Text>
                <Text style={{ color: todayData?.restingHR ? hrZone(todayData.restingHR).color : C.textDim, fontSize: 16, fontWeight: '700' }}>
                  {todayData?.restingHR ?? '—'} {todayData?.restingHR ? 'bpm' : ''}
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

        {/* ── HRV Trend ── */}
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

            {/* HRV Referenz */}
            <View style={[hs.refRow, { marginTop: 14 }]}>
              {[{ r: '< 40', l: 'Kritisch', c: C.red },{ r: '40–59', l: 'Niedrig', c: C.yellow },{ r: '60–79', l: 'Normal', c: C.blue },{ r: '≥ 80', l: 'Sehr gut', c: C.green }].map(x => (
                <View key={x.r} style={{ alignItems: 'center' }}>
                  <Text style={{ color: x.c, fontSize: 11, fontWeight: '700' }}>{x.r}</Text>
                  <Text style={{ color: C.textDim, fontSize: 10 }}>{x.l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Ruhepuls ── */}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.textDim, fontSize: 10 }}>vor 13 Tagen</Text>
              <Text style={{ color: C.textDim, fontSize: 10 }}>Heute</Text>
            </View>

            <View style={[hs.refRow, { marginTop: 14 }]}>
              {[{ r: '≤ 45', l: 'Athletisch', c: C.green },{ r: '46–55', l: 'Sehr gut', c: C.blue },{ r: '56–65', l: 'Normal', c: C.yellow },{ r: '> 65', l: 'Erhöht', c: C.red }].map(x => (
                <View key={x.r} style={{ alignItems: 'center' }}>
                  <Text style={{ color: x.c, fontSize: 11, fontWeight: '700' }}>{x.r}</Text>
                  <Text style={{ color: C.textDim, fontSize: 10 }}>{x.l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Recovery History ── */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <Text style={[hs.cardTitle, { marginBottom: 14 }]}>Erholungs-Verlauf</Text>
            <Sparkline values={recValues} color={C.orange} max={100} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: C.textDim, fontSize: 10 }}>vor 13 Tagen</Text>
              <Text style={{ color: C.textDim, fontSize: 10 }}>Heute</Text>
            </View>
          </View>
        )}

        {/* ── Verlauf Liste (letzte 7 Tage) ── */}
        {last14.length > 0 && (
          <View style={hs.card}>
            <Text style={[hs.cardTitle, { marginBottom: 14 }]}>Letzte Einträge</Text>
            {last14.slice(0, 7).map(d => (
              <View key={d.date} style={hs.historyRow}>
                <Text style={{ color: C.textMuted, fontSize: 13, width: 90 }}>{d.date}</Text>
                <View style={{ flex: 1, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {d.hrv !== null && (
                    <Text style={{ color: hrvZone(d.hrv).color, fontSize: 12 }}>HRV {d.hrv}ms</Text>
                  )}
                  {d.restingHR !== null && (
                    <Text style={{ color: hrZone(d.restingHR).color, fontSize: 12 }}>{d.restingHR}bpm</Text>
                  )}
                  <Text style={{ color: C.blue, fontSize: 12 }}>{d.sleepHours}h</Text>
                </View>
                <View style={[hs.recPill, { backgroundColor: recoveryColor(d.recoveryScore) + '25' }]}>
                  <Text style={{ color: recoveryColor(d.recoveryScore), fontSize: 12, fontWeight: '700' }}>
                    {d.recoveryScore}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Polar Integration Hinweis ── */}
        <View style={hs.polarCard}>
          <Text style={{ fontSize: 24, marginBottom: 8 }}>📡</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>Polar Flow Integration</Text>
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
            Automatische HRV- und Ruhepuls-Daten über Polar H10 werden nach dem TestFlight-Launch hinzugefügt.
          </Text>
          <View style={hs.polarBadge}>
            <Text style={{ color: C.orange, fontSize: 12, fontWeight: '600' }}>Kommt bald · Manuell aktiv</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <InputModal
        visible={showModal}
        data={todayData ?? emptyToday}
        onSave={saveDay}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const hs = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  bigScore: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 60,
  },
  divider: {
    width: 1,
    height: 80,
    backgroundColor: C.border,
    marginHorizontal: 16,
  },
  capturePrompt: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 28,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  recPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 36,
    alignItems: 'center',
  },
  polarCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.orange + '40',
  },
  polarBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.orange + '20',
    borderWidth: 1,
    borderColor: C.orange + '60',
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '88%',
  },
  modalTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoBox: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: C.blue,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: C.cardAlt,
  },
  qualityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardAlt,
  },
  saveBtn: {
    backgroundColor: C.orange,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});