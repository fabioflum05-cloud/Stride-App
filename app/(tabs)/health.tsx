// app/(tabs)/health.tsx
// Full Apple Health integration — reads HRV, sleep, HR, steps, weight etc.
// Data flows: Garmin Forerunner 265 → Garmin Connect → Apple Health → Stride

import React, { useState } from 'react';
import {
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppleHealth } from '../../hooks/useAppleHealth';

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
  teal:      '#5AC8FA',
  text:      '#F5F0EE',
  textMuted: '#8A8078',
  textDim:   '#5A5450',
  border:    '#3A3430',
};

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

function sleepLabel(h: number): string {
  if (h < 5)   return 'Zu wenig';
  if (h < 6.5) return 'Knapp';
  if (h < 8)   return 'Gut';
  if (h < 9)   return 'Optimal';
  return 'Viel';
}

function sleepColor(h: number): string {
  if (h < 5)   return C.red;
  if (h < 6.5) return C.yellow;
  if (h < 8)   return C.blue;
  return C.green;
}

function spo2Zone(v: number): { label: string; color: string } {
  if (v >= 98) return { label: 'Optimal',  color: C.green  };
  if (v >= 95) return { label: 'Normal',   color: C.blue   };
  if (v >= 90) return { label: 'Niedrig',  color: C.yellow };
  return             { label: 'Kritisch', color: C.red    };
}

function calcRecovery(hrv: number | null, rhr: number | null, sleep: number | null): number {
  let score = 0; let w = 0;
  if (hrv !== null)   { score += Math.min(100, Math.max(0, (hrv / 70) * 100)) * 0.4;          w += 0.4; }
  if (rhr !== null)   { score += Math.min(100, Math.max(0, ((80 - rhr) / 35) * 100)) * 0.25;  w += 0.25; }
  if (sleep !== null) { score += Math.min(100, (sleep / 8) * 100) * 0.35;                      w += 0.35; }
  return w > 0 ? Math.round(score / w) : 0;
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
  if (s >= 65) return 'Normales Training. Auf Grenzen achten.';
  if (s >= 50) return 'Moderates Training. Keine PR-Versuche.';
  if (s >= 35) return 'Leichte Einheit oder aktive Erholung.';
  return 'Rest Day. Regeneration hat Priorität.';
}

const StatCard: React.FC<{
  icon: string; label: string; value: string | null;
  unit?: string; sub?: string; color: string;
}> = ({ icon, label, value, unit, sub, color }) => (
  <View style={[s.statCard, { borderTopColor: color }]}>
    <Text style={{ fontSize: 22, marginBottom: 6 }}>{icon}</Text>
    <Text style={{ color: C.textDim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    {value !== null ? (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
        <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
        {unit && <Text style={{ color: C.textMuted, fontSize: 12 }}>{unit}</Text>}
      </View>
    ) : (
      <Text style={{ color: C.textDim, fontSize: 18, fontWeight: '700', marginTop: 4 }}>—</Text>
    )}
    {sub && <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{sub}</Text>}
  </View>
);

const SleepBar: React.FC<{
  label: string; hours: number | null; max: number; color: string;
}> = ({ label, hours, max, color }) => (
  <View style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: C.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{hours !== null ? `${hours}h` : '—'}</Text>
    </View>
    <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3 }}>
      {hours !== null && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.min(100, (hours / max) * 100)}%` }} />
      )}
    </View>
  </View>
);

const MiniStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ color: C.textDim, fontSize: 10 }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{value}</Text>
  </View>
);

export default function HealthScreen() {
  const { data, loading, refresh } = useAppleHealth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const recovery = calcRecovery(data.hrv, data.restingHR, data.sleepHours);
  const recColor = recoveryColor(recovery);
  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const lastUpdatedLabel = data.lastUpdated
    ? `Zuletzt: ${data.lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  if (Platform.OS !== 'ios') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🍎</Text>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Apple Health ist nur auf iOS verfügbar</Text>
      </View>
    );
  }

  if (data.error && !data.authorized) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🏥</Text>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Apple Health Zugriff benötigt</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Stride braucht Zugriff auf Apple Health um Garmin-Daten zu lesen.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: C.orange, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}
          onPress={() => Linking.openURL('app-settings:')}
        >
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Einstellungen öffnen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>{dateLabel}</Text>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginTop: 4 }}>Gesundheit</Text>
            {lastUpdatedLabel ? <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{lastUpdatedLabel} · Garmin → Apple Health</Text> : null}
          </View>
          <TouchableOpacity onPress={refresh} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>{loading ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>

        {/* Recovery Score */}
        <View style={s.recoveryCard}>
          <View style={{ alignItems: 'center', marginRight: 20 }}>
            <Text style={{ color: C.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>ERHOLUNG</Text>
            <Text style={[s.bigScore, { color: recColor }]}>{data.authorized ? recovery : '—'}</Text>
            <Text style={{ color: recColor, fontWeight: '600', fontSize: 13 }}>{data.authorized ? recoveryLabel(recovery) : 'Kein Zugriff'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
              {data.authorized ? recoveryAdvice(recovery) : 'Apple Health Zugriff erteilen.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MiniStat label="HRV"    value={data.hrv        ? `${data.hrv}ms`        : '—'} color={data.hrv        ? hrvZone(data.hrv).color        : C.textDim} />
              <MiniStat label="RHR"    value={data.restingHR  ? `${data.restingHR}bpm` : '—'} color={data.restingHR  ? hrZone(data.restingHR).color    : C.textDim} />
              <MiniStat label="Schlaf" value={data.sleepHours ? `${data.sleepHours}h`  : '—'} color={data.sleepHours ? sleepColor(data.sleepHours)     : C.textDim} />
            </View>
          </View>
        </View>

        {/* Heart */}
        <Text style={s.sectionTitle}>❤️ Herz</Text>
        <View style={s.grid2}>
          <StatCard icon="💓" label="HRV (RMSSD)" value={data.hrv?.toString() ?? null} unit="ms"
            sub={data.hrv ? hrvZone(data.hrv).label : undefined} color={data.hrv ? hrvZone(data.hrv).color : C.textDim} />
          <StatCard icon="🫀" label="Ruhepuls" value={data.restingHR?.toString() ?? null} unit="bpm"
            sub={data.restingHR ? hrZone(data.restingHR).label : undefined} color={data.restingHR ? hrZone(data.restingHR).color : C.textDim} />
        </View>
        <View style={s.grid2}>
          <StatCard icon="💗" label="Aktueller Puls" value={data.heartRate?.toString() ?? null} unit="bpm" color={C.red} />
          <StatCard icon="🫁" label="Atemfrequenz" value={data.respiratoryRate?.toString() ?? null} unit="/min" color={C.teal} />
        </View>

        {/* SpO2 */}
        {data.oxygenSaturation !== null && (
          <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
            <Text style={{ fontSize: 28 }}>🫧</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Blutsauerstoff (SpO₂)</Text>
              <Text style={{ color: spo2Zone(data.oxygenSaturation).color, fontSize: 28, fontWeight: '800', marginTop: 2 }}>{data.oxygenSaturation}%</Text>
            </View>
            <View style={[s.badge, { backgroundColor: spo2Zone(data.oxygenSaturation).color + '25' }]}>
              <Text style={{ color: spo2Zone(data.oxygenSaturation).color, fontWeight: '600', fontSize: 13 }}>{spo2Zone(data.oxygenSaturation).label}</Text>
            </View>
          </View>
        )}

        {/* Sleep */}
        <Text style={s.sectionTitle}>🌙 Schlaf</Text>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View>
              <Text style={{ color: C.textDim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Letzte Nacht</Text>
              <Text style={[s.bigScore, { fontSize: 36, color: data.sleepHours ? sleepColor(data.sleepHours) : C.textDim }]}>
                {data.sleepHours !== null ? `${data.sleepHours}h` : '—'}
              </Text>
            </View>
            {data.sleepHours !== null && (
              <View style={[s.badge, { backgroundColor: sleepColor(data.sleepHours) + '25' }]}>
                <Text style={{ color: sleepColor(data.sleepHours), fontWeight: '600', fontSize: 13 }}>{sleepLabel(data.sleepHours)}</Text>
              </View>
            )}
          </View>
          <SleepBar label="Tiefschlaf"  hours={data.sleepDeep}  max={3} color={C.purple} />
          <SleepBar label="REM-Schlaf"  hours={data.sleepREM}   max={3} color={C.blue}   />
          <SleepBar label="Wachphasen"  hours={data.sleepAwake} max={2} color={C.yellow}  />
          {data.sleepDeep === null && data.sleepREM === null && (
            <Text style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Schlafphasen: Garmin Connect → Apple Health Sync abwarten</Text>
          )}
        </View>

        {/* Activity */}
        <Text style={s.sectionTitle}>🏃 Aktivität</Text>
        <View style={s.grid2}>
          <StatCard icon="👣" label="Schritte"
            value={data.steps !== null ? data.steps.toLocaleString('de-DE') : null}
            sub={data.steps !== null ? `${Math.round((data.steps / 10000) * 100)}% Tagesziel` : undefined}
            color={data.steps !== null && data.steps >= 10000 ? C.green : C.orange} />
          <StatCard icon="🔥" label="Aktive Kalorien" value={data.activeCalories?.toString() ?? null} unit="kcal" color={C.orange} />
        </View>
        <View style={s.grid2}>
          <StatCard icon="⏱️" label="Trainingsminuten" value={data.exerciseMinutes?.toString() ?? null} unit="min" color={C.blue} />
          <StatCard icon="🎯" label="Stehstunden" value={data.standHours?.toString() ?? null} unit="h" color={C.teal} />
        </View>

        {/* Steps bar */}
        {data.steps !== null && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>Schrittziel</Text>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>{data.steps.toLocaleString('de-DE')} / 10.000</Text>
            </View>
            <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: data.steps >= 10000 ? C.green : C.orange, width: `${Math.min(100, (data.steps / 10000) * 100)}%` }} />
            </View>
          </View>
        )}

        {/* Body */}
        <Text style={s.sectionTitle}>⚖️ Körper</Text>
        <View style={s.grid2}>
          <StatCard icon="⚖️" label="Körpergewicht" value={data.weight?.toString() ?? null} unit="kg"
            sub="Ziel: < 66 kg"
            color={data.weight !== null ? (data.weight < 66 ? C.green : data.weight < 68 ? C.yellow : C.red) : C.textDim} />
          <StatCard icon="📊" label="Körperfett" value={data.bodyFat?.toString() ?? null} unit="%" color={C.blue} />
        </View>

        {/* Fight weight indicator */}
        {data.weight !== null && (
          <View style={s.card}>
            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>WETTKAMPFGEWICHT -66 KG</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: C.text, fontSize: 14 }}>Aktuell: {data.weight} kg</Text>
              <Text style={{ color: data.weight <= 66 ? C.green : data.weight <= 68 ? C.yellow : C.red, fontSize: 14, fontWeight: '700' }}>
                {data.weight <= 66 ? '✅ Im Limit' : `+${(data.weight - 66).toFixed(1)} kg`}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4 }}>
              <View style={{ height: 8, borderRadius: 4,
                backgroundColor: data.weight <= 66 ? C.green : data.weight <= 68 ? C.yellow : C.red,
                width: `${Math.min(100, (66 / data.weight) * 100)}%` }} />
            </View>
          </View>
        )}

        {/* Garmin info */}
        <View style={s.garminCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Text style={{ fontSize: 28 }}>⌚</Text>
            <View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>Garmin Forerunner 265</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>via Garmin Connect → Apple Health</Text>
            </View>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>
            Nach dem Training Garmin Connect App öffnen → Sync abwarten → hier nach unten ziehen zum Aktualisieren.
          </Text>
          <View style={[s.badge, { backgroundColor: C.green + '20', marginTop: 10, alignSelf: 'flex-start' }]}>
            <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>🟢 Automatischer Sync aktiv</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll:       { paddingHorizontal: 16, paddingTop: 60 },
  recoveryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#231F1C', borderRadius: 18, padding: 20, marginBottom: 20 },
  bigScore:     { fontSize: 52, fontWeight: '800', lineHeight: 60 },
  sectionTitle: { color: '#F5F0EE', fontSize: 17, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  grid2:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard:     { flex: 1, backgroundColor: '#231F1C', borderRadius: 16, padding: 14, borderTopWidth: 3 },
  card:         { backgroundColor: '#231F1C', borderRadius: 16, padding: 16, marginBottom: 10 },
  badge:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  garminCard:   { backgroundColor: '#231F1C', borderRadius: 18, padding: 18, marginTop: 8, borderWidth: 1, borderColor: '#34C75940' },
});