// app/(tabs)/history.tsx
// History Screen — Theme-aware, SVG charts, Oura-Stil

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert, Animated, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useAppTheme } from '../../constants/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayData {
  date:         string;
  label:        string; // DD.MM
  perfScore?:   number;
  workoutScore?:number;
  sleepScore?:  number;
  sleepHours?:  number;
  hrv?:         number;
  restingHR?:   number;
  battLevel?:   number;
  workouts?:    number;
  kcal?:        number;
  recovery?:    number;
}

type MetricKey = keyof Omit<DayData, 'date' | 'label'>;
type Range = 7 | 14 | 30 | 90;

// ─── Metrics config ───────────────────────────────────────────────────────────
const METRICS: { key: MetricKey; label: string; color: string; emoji: string; unit?: string }[] = [
  { key: 'perfScore',    label: 'Performance',   color: '#818CF8', emoji: '⚡', unit: 'pts' },
  { key: 'workoutScore', label: 'Training',      color: '#C084FC', emoji: '🏋️', unit: 'pts' },
  { key: 'sleepScore',   label: 'Schlaf Score',  color: '#60A5FA', emoji: '😴', unit: 'pts' },
  { key: 'sleepHours',   label: 'Schlafdauer',   color: '#818CF8', emoji: '🌙', unit: 'h'   },
  { key: 'hrv',          label: 'HRV',           color: '#4ADE80', emoji: '💓', unit: 'ms'  },
  { key: 'restingHR',    label: 'Ruhepuls',      color: '#F87171', emoji: '❤️', unit: 'bpm' },
  { key: 'battLevel',    label: 'Energie',       color: '#FBBF24', emoji: '🔋', unit: '%'   },
  { key: 'recovery',     label: 'Erholung',      color: '#34D399', emoji: '🧘', unit: 'pts' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── Mini Line Chart ──────────────────────────────────────────────────────────
function MiniChart({ data, color, isDark }: {
  data: (number | null)[];
  color: string;
  isDark: boolean;
}) {
  const W = 280; const H = 56; const PAD = 6;
  const valid = data.filter(v => v !== null) as number[];
  if (valid.length < 2) return (
    <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontSize: 12 }}>
        Noch zu wenig Daten
      </Text>
    </View>
  );
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: v !== null ? PAD + (1 - (v - min) / range) * (H - PAD * 2) : null,
  }));
  const validPts = pts.filter(p => p.y !== null) as { x: number; y: number }[];
  const poly = validPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map(f => (
        <Line key={f} x1={PAD} y1={H * f} x2={W - PAD} y2={H * f}
          stroke={gridColor} strokeWidth={1} />
      ))}
      {validPts.length > 1 && (
        <Polyline points={poly} fill="none" stroke={color} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {pts.map((p, i) => p.y !== null ? (
        <Circle key={i} cx={p.x} cy={p.y}
          r={i === pts.length - 1 ? 5 : 3}
          fill={i === pts.length - 1 ? color : (isDark ? '#1C1917' : '#fff')}
          stroke={color} strokeWidth={2} />
      ) : null)}
    </Svg>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const [days,     setDays]    = useState<DayData[]>([]);
  const [selected, setSelected]= useState<MetricKey[]>(['perfScore', 'sleepScore', 'hrv']);
  const [range,    setRange]   = useState<Range>(14);
  const [loaded,   setLoaded]  = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const isDark     = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const bg         = colors.bg;
  const card       = colors.card;
  const cardAlt    = colors.cardSecondary;
  const border     = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const text       = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted  = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim    = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  const load = useCallback(async () => {
    const map: Record<string, DayData> = {};

    const ensure = (key: string, iso: string) => {
      if (!map[key]) map[key] = { date: iso, label: dateLabel(iso) };
    };

    // Checkin / Performance
    const rc = await AsyncStorage.getItem('checkinHistory');
    if (rc) JSON.parse(rc).forEach((e: any) => {
      const k = dayKey(e.date); ensure(k, e.date);
      map[k].perfScore = e.score;
    });

    // Sleep
    const rs = await AsyncStorage.getItem('sleepHistory');
    if (rs) JSON.parse(rs).forEach((e: any) => {
      const k = dayKey(e.date); ensure(k, e.date);
      map[k].sleepScore  = e.sleepScore;
      map[k].sleepHours  = e.schlafStunden;
      map[k].hrv         = e.hrv || undefined;
    });

    // Health (stride_health_history)
    const rh = await AsyncStorage.getItem('stride_health_history');
    if (rh) JSON.parse(rh).forEach((e: any) => {
      const k = dayKey(e.date); ensure(k, e.date);
      if (e.hrv)           map[k].hrv        = e.hrv;
      if (e.restingHR)     map[k].restingHR  = e.restingHR;
      if (e.sleepHours)    map[k].sleepHours = e.sleepHours;
      if (e.recoveryScore) map[k].recovery   = e.recoveryScore;
    });

    // Battery
    const rb = await AsyncStorage.getItem('batteryHistory');
    if (rb) JSON.parse(rb).forEach((e: any) => {
      const k = dayKey(e.date); ensure(k, e.date);
      map[k].battLevel = e.level;
    });

    // Workouts
    const rw = await AsyncStorage.getItem('workouts');
    if (rw) JSON.parse(rw).forEach((w: any) => {
      const k = dayKey(w.date); ensure(k, w.date);
      map[k].workouts = (map[k].workouts ?? 0) + 1;
    });
    const rwh = await AsyncStorage.getItem('workoutHistory');
    if (rwh) JSON.parse(rwh).forEach((w: any) => {
      const k = dayKey(w.date); ensure(k, w.date);
      map[k].workoutScore = Math.max(map[k].workoutScore ?? 0, w.score ?? 0);
    });

    const sorted = Object.values(map).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setDays(sorted);
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [load]));

  function toggleMetric(key: MetricKey) {
    setSelected(prev => prev.includes(key)
      ? prev.length > 1 ? prev.filter(k => k !== key) : prev
      : [...prev, key]
    );
  }

  async function clearHistory() {
    Alert.alert('Verlauf löschen?', 'Kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['checkinHistory','sleepHistory','workoutHistory','batteryHistory']);
        setDays([]);
      }},
    ]);
  }

  const ranged = days.slice(-range);

  // Summary stats
  const totalWorkouts = days.reduce((s, d) => s + (d.workouts ?? 0), 0);
  const avgPerf = (() => {
    const v = days.filter(d => d.perfScore).map(d => d.perfScore!);
    return v.length ? Math.round(v.reduce((a,b)=>a+b)/v.length) : null;
  })();
  const avgSleep = (() => {
    const v = days.filter(d => d.sleepHours).map(d => d.sleepHours!);
    return v.length ? Math.round(v.reduce((a,b)=>a+b)/v.length * 10) / 10 : null;
  })();
  const avgHRV = (() => {
    const v = days.filter(d => d.hrv).map(d => d.hrv!);
    return v.length ? Math.round(v.reduce((a,b)=>a+b)/v.length) : null;
  })();

  const cardStyle = { backgroundColor: card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: border, marginBottom: 12 };

  if (!loaded) return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: textMuted }}>Lade…</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 120 }}>
        <Animated.View style={{ opacity: fade }}>

          {/* ── Header ── */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: text, letterSpacing: -0.8 }}>Verlauf</Text>
          </View>

          {/* ── Summary ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Trainings',   value: totalWorkouts.toString(), color: colors.accent },
              { label: 'Ø Performance',value: avgPerf ? `${avgPerf}` : '—', color: '#818CF8' },
              { label: 'Ø Schlaf',    value: avgSleep ? `${avgSleep}h` : '—', color: '#60A5FA' },
              { label: 'Ø HRV',       value: avgHRV ? `${avgHRV}ms` : '—', color: '#4ADE80' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: border, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: s.color, letterSpacing: -0.5 }}>{s.value}</Text>
                <Text style={{ fontSize: 9, color: textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, textAlign: 'center', fontWeight: '600' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Range Selector ── */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {([7, 14, 30, 90] as Range[]).map(r => (
              <TouchableOpacity key={r} onPress={() => setRange(r)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center',
                  backgroundColor: range === r ? colors.accent : card,
                  borderWidth: 1, borderColor: range === r ? colors.accent : border }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: range === r ? '#fff' : textMuted }}>
                  {r}T
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Metric Selector ── */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 12 }}>Metriken</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {METRICS.map(m => {
                const active = selected.includes(m.key);
                return (
                  <TouchableOpacity key={m.key} onPress={() => toggleMetric(m.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: active ? m.color + '20' : cardAlt,
                      borderWidth: 1, borderColor: active ? m.color : border }}>
                    <Text style={{ fontSize: 12 }}>{m.emoji}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? m.color : textMuted }}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Charts per selected metric ── */}
          {selected.map(key => {
            const m = METRICS.find(x => x.key === key)!;
            const vals = ranged.map(d => {
              const v = d[key] as number | undefined;
              return v !== undefined && v > 0 ? v : null;
            });
            const nonNull = vals.filter(v => v !== null) as number[];
            const avg  = nonNull.length ? Math.round(nonNull.reduce((a,b)=>a+b)/nonNull.length * 10) / 10 : null;
            const best = nonNull.length ? Math.max(...nonNull) : null;
            const latest = [...vals].reverse().find(v => v !== null) ?? null;

            return (
              <View key={key} style={[cardStyle, { borderTopWidth: 3, borderTopColor: m.color }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: m.color, marginBottom: 4 }}>
                      {m.emoji} {m.label}
                    </Text>
                    {latest !== null && (
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: text, letterSpacing: -1 }}>{latest}</Text>
                        <Text style={{ fontSize: 12, color: textMuted }}>{m.unit}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {avg !== null && (
                      <View style={{ backgroundColor: m.color + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ fontSize: 11, color: m.color, fontWeight: '700' }}>Ø {avg} {m.unit}</Text>
                      </View>
                    )}
                    {best !== null && (
                      <Text style={{ fontSize: 11, color: textDim }}>Max {best} {m.unit}</Text>
                    )}
                  </View>
                </View>

                <MiniChart data={vals} color={m.color} isDark={isDark} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: textDim }}>{ranged[0]?.label ?? ''}</Text>
                  <Text style={{ fontSize: 10, color: textDim }}>Heute</Text>
                </View>
              </View>
            );
          })}

          {/* ── Daily Log ── */}
          {ranged.length > 0 && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 14 }}>
                Tagesübersicht
              </Text>
              {[...ranged].reverse().map((day, i) => (
                <View key={day.date} style={{ paddingVertical: 12,
                  borderBottomWidth: i < ranged.length - 1 ? 1 : 0,
                  borderBottomColor: border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: text }}>{day.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {day.workoutScore ? (
                        <View style={{ backgroundColor: '#C084FC20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, color: '#C084FC', fontWeight: '700' }}>🏋️ {day.workoutScore}</Text>
                        </View>
                      ) : null}
                      {day.perfScore ? (
                        <View style={{ backgroundColor: '#818CF820', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, color: '#818CF8', fontWeight: '700' }}>⚡ {day.perfScore}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                    {day.sleepHours && <StatCell label="Schlaf" value={`${day.sleepHours}h`} color="#60A5FA" />}
                    {day.hrv && <StatCell label="HRV" value={`${day.hrv}ms`} color="#4ADE80" />}
                    {day.restingHR && <StatCell label="RHR" value={`${day.restingHR}bpm`} color="#F87171" />}
                    {day.battLevel && <StatCell label="Energie" value={`${day.battLevel}%`} color="#FBBF24" />}
                    {day.recovery && <StatCell label="Erholung" value={`${day.recovery}`} color="#34D399" />}
                    {day.workouts && <StatCell label="Training" value={`${day.workouts}×`} color={colors.accent} />}
                  </View>
                </View>
              ))}
            </View>
          )}

          {days.length === 0 && (
            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 48 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 6 }}>Noch keine Daten</Text>
              <Text style={{ fontSize: 13, color: textMuted, textAlign: 'center' }}>
                Trage Schlaf, Check-in und Training ein um hier deinen Verlauf zu sehen.
              </Text>
            </View>
          )}

          {/* ── Clear Button ── */}
          {days.length > 0 && (
            <TouchableOpacity onPress={clearHistory}
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 16,
                backgroundColor: isDark ? 'rgba(248,113,113,0.1)' : '#FFF0F0',
                borderWidth: 1, borderColor: isDark ? 'rgba(248,113,113,0.2)' : '#FECACA',
                marginBottom: 8 }}>
              <Text style={{ color: '#F87171', fontSize: 13, fontWeight: '600' }}>Verlauf löschen</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const StatCell: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value}</Text>
    <Text style={{ fontSize: 9, color: 'rgba(128,128,128,0.6)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{label}</Text>
  </View>
);