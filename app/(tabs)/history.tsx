// app/(tabs)/history.tsx
// History Screen — Theme-aware, SVG charts, Oura-Stil

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert, Animated, LayoutChangeEvent, ScrollView, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useLanguage } from '../../constants/LanguageContext';
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

type MetricKey = Exclude<keyof Omit<DayData, 'date' | 'label'>, 'workouts' | 'kcal'>;
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

// ─── Mini Line Chart (interaktiv: Finger über Chart ziehen zeigt Wert + Datum) ──
function MiniChart({ data, dates, color, isDark, lang, unit }: {
  data: (number | null)[];
  dates: string[];
  color: string;
  isDark: boolean;
  lang: string;
  unit?: string;
}) {
  const H = 90; const PAD_TOP = 10; const PAD_BOTTOM = 10; const PAD_L = 34; const PAD_R = 10;
  const [chartW, setChartW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const valid = data.filter(v => v !== null) as number[];
  const textMuted = isDark ? 'rgba(245,240,238,0.4)' : 'rgba(26,18,9,0.4)';

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - chartW) > 0.5) setChartW(w);
  }

  if (valid.length < 2) return (
    <View onLayout={onLayout} style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontSize: 12 }}>
        {lang === 'en' ? 'Not enough data' : 'Noch zu wenig Daten'}
      </Text>
    </View>
  );

  const CW = chartW || 280;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const plotW = CW - PAD_L - PAD_R;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const pts = data.map((v, i) => ({
    x: PAD_L + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2),
    y: v !== null ? PAD_TOP + (1 - (v - min) / range) * plotH : null,
  }));
  const validPts = pts.filter(p => p.y !== null) as { x: number; y: number }[];
  const poly = validPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const fmt = (v: number) => Number.isInteger(v) ? `${v}` : v.toFixed(1);

  function nearestIndexForX(x: number): number {
    const clamped = Math.min(Math.max(x, PAD_L), CW - PAD_R);
    let idx = Math.round(((clamped - PAD_L) / (plotW || 1)) * (data.length - 1));
    idx = Math.min(Math.max(idx, 0), data.length - 1);
    if (pts[idx].y === null) {
      let lo = idx, hi = idx, found = -1;
      while (lo >= 0 || hi < data.length) {
        if (lo >= 0 && pts[lo].y !== null) { found = lo; break; }
        if (hi < data.length && pts[hi].y !== null) { found = hi; break; }
        lo--; hi++;
      }
      if (found >= 0) idx = found;
    }
    return idx;
  }

  function updateActive(x: number) { setActiveIdx(nearestIndexForX(x)); }
  function clearActive() { setActiveIdx(null); }

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onBegin((e) => { runOnJS(updateActive)(e.x); })
    .onUpdate((e) => { runOnJS(updateActive)(e.x); })
    .onFinalize(() => { runOnJS(clearActive)(); });

  const active = activeIdx !== null ? pts[activeIdx] : null;
  const activeValue = activeIdx !== null ? data[activeIdx] : null;
  const activeDate = activeIdx !== null ? dates[activeIdx] : null;

  const tooltipW = 96;
  const tooltipX = active ? Math.min(Math.max(active.x - tooltipW / 2, 0), Math.max(0, CW - tooltipW)) : 0;

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={onLayout} style={{ height: H }}>
        <Svg width={CW} height={H} viewBox={`0 0 ${CW} ${H}`}>
          {[0, 0.5, 1].map(f => (
            <Line key={f} x1={PAD_L} y1={PAD_TOP + plotH * f} x2={CW - PAD_R} y2={PAD_TOP + plotH * f}
              stroke={gridColor} strokeWidth={1} />
          ))}
          <SvgText x={PAD_L - 6} y={PAD_TOP + 4} fontSize={9} fill={textMuted} textAnchor="end">{fmt(max)}</SvgText>
          <SvgText x={PAD_L - 6} y={PAD_TOP + plotH + 4} fontSize={9} fill={textMuted} textAnchor="end">{fmt(min)}</SvgText>
          {validPts.length > 1 && (
            <Polyline points={poly} fill="none" stroke={color} strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => p.y !== null ? (
            <Circle key={i} cx={p.x} cy={p.y}
              r={i === pts.length - 1 && activeIdx === null ? 5 : 3}
              fill={i === pts.length - 1 && activeIdx === null ? color : (isDark ? '#1C1917' : '#fff')}
              stroke={color} strokeWidth={2}
              opacity={activeIdx !== null && i !== activeIdx ? 0.35 : 1} />
          ) : null)}
          {active && (
            <>
              <Line x1={active.x} y1={PAD_TOP} x2={active.x} y2={PAD_TOP + plotH}
                stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
              <Circle cx={active.x} cy={active.y!} r={6} fill={color} stroke={isDark ? '#1C1917' : '#fff'} strokeWidth={2} />
            </>
          )}
        </Svg>
        {active && activeValue !== null && (
          <View pointerEvents="none" style={{
            position: 'absolute', left: tooltipX, top: 0, width: tooltipW,
            backgroundColor: isDark ? '#2A2622' : '#1A1209', borderRadius: 10,
            paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
              {Number.isInteger(activeValue) ? activeValue : activeValue.toFixed(1)}{unit ? ` ${unit}` : ''}
            </Text>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
              {activeDate ? new Date(activeDate).toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' }) : ''}
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const { t, lang } = useLanguage();
  const metricLabel: Record<MetricKey, { de: string; en: string }> = {
    perfScore:    { de: 'Performance',  en: 'Performance' },
    workoutScore: { de: 'Training',     en: 'Training' },
    sleepScore:   { de: 'Schlaf Score', en: 'Sleep Score' },
    sleepHours:   { de: 'Schlafdauer',  en: 'Sleep Duration' },
    hrv:          { de: 'HRV',          en: 'HRV' },
    restingHR:    { de: 'Ruhepuls',     en: 'Resting HR' },
    battLevel:    { de: 'Energie',      en: 'Energy' },
    recovery:     { de: 'Erholung',     en: 'Recovery' },
  };
  const ml = (key: MetricKey) => lang === 'en' ? metricLabel[key].en : metricLabel[key].de;
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
    Alert.alert(
      lang === 'en' ? 'Delete history?' : 'Verlauf löschen?',
      lang === 'en' ? 'This cannot be undone.' : 'Kann nicht rückgängig gemacht werden.',
      [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
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
      <Text style={{ color: textMuted }}>{t('loading')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 120 }}>
        <Animated.View style={{ opacity: fade }}>

          {/* ── Header ── */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
              {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: text, letterSpacing: -0.8 }}>{lang === 'en' ? 'History' : 'Verlauf'}</Text>
          </View>

          {/* ── Summary ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {[
              { label: lang === 'en' ? 'Workouts' : 'Trainings', value: totalWorkouts.toString(), color: colors.accent },
              { label: lang === 'en' ? 'Avg Performance' : 'Ø Performance', value: avgPerf ? `${avgPerf}` : '—', color: '#818CF8' },
              { label: lang === 'en' ? 'Avg Sleep' : 'Ø Schlaf', value: avgSleep ? `${avgSleep}h` : '—', color: '#60A5FA' },
              { label: 'Ø HRV', value: avgHRV ? `${avgHRV}ms` : '—', color: '#4ADE80' },
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
                  {r}{lang === 'en' ? 'D' : 'T'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Metric Selector ── */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 12 }}>{lang === 'en' ? 'Metrics' : 'Metriken'}</Text>
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
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? m.color : textMuted }}>{ml(m.key)}</Text>
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
                      {m.emoji} {ml(m.key)}
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

                <MiniChart data={vals} dates={ranged.map(d => d.date)} color={m.color} isDark={isDark} lang={lang} unit={m.unit} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: textDim }}>{ranged[0]?.label ?? ''}</Text>
                  <Text style={{ fontSize: 10, color: textDim }}>{t('today')}</Text>
                </View>
              </View>
            );
          })}

          {/* ── Daily Overview (grouped by day) ── */}
          {ranged.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 10, marginTop: 4 }}>
                {lang === 'en' ? 'Daily Overview' : 'Tagesübersicht'}
              </Text>
              {[...ranged].reverse().map((day) => {
                const statusCol = dayStatusColor(day, textDim);
                const weekday = new Date(day.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { weekday: 'short' });
                const rows: { key: MetricKey; value: number }[] = [
                  ...(day.sleepHours ? [{ key: 'sleepHours' as MetricKey, value: day.sleepHours }] : []),
                  ...(day.hrv ? [{ key: 'hrv' as MetricKey, value: day.hrv }] : []),
                  ...(day.restingHR ? [{ key: 'restingHR' as MetricKey, value: day.restingHR }] : []),
                  ...(day.battLevel ? [{ key: 'battLevel' as MetricKey, value: day.battLevel }] : []),
                  ...(day.recovery ? [{ key: 'recovery' as MetricKey, value: day.recovery }] : []),
                ];
                return (
                  <View key={day.date} style={{ backgroundColor: card, borderRadius: 18, borderWidth: 1, borderColor: border,
                    borderLeftWidth: 4, borderLeftColor: statusCol, padding: 16, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text style={{ fontSize: 17, fontWeight: '800', color: text, letterSpacing: -0.3 }}>{weekday}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: textMuted }}>{day.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {day.workoutScore ? (
                          <View style={{ backgroundColor: '#C084FC20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                            <Text style={{ fontSize: 11, color: '#C084FC', fontWeight: '700' }}>🏋️ {day.workoutScore}</Text>
                          </View>
                        ) : null}
                        {day.perfScore ? (
                          <View style={{ backgroundColor: statusCol + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                            <Text style={{ fontSize: 11, color: statusCol, fontWeight: '700' }}>⚡ {day.perfScore}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {rows.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {rows.map(({ key, value }) => {
                          const m = METRICS.find(x => x.key === key)!;
                          const col = metricStatusColor(key, value);
                          return (
                            <View key={key} style={{ minWidth: 72 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 12 }}>{m.emoji}</Text>
                                <Text style={{ fontSize: 15, fontWeight: '800', color: col }}>
                                  {key === 'sleepHours' ? value.toFixed(1) : value}
                                  <Text style={{ fontSize: 10, fontWeight: '600', color: textDim }}> {m.unit}</Text>
                                </Text>
                              </View>
                              <Text style={{ fontSize: 9, color: textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 }}>{ml(key)}</Text>
                            </View>
                          );
                        })}
                        {day.workouts ? (
                          <View style={{ minWidth: 72 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 12 }}>🏋️</Text>
                              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accent }}>{day.workouts}×</Text>
                            </View>
                            <Text style={{ fontSize: 9, color: textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 }}>
                              {lang === 'en' ? 'Workout' : 'Training'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: textDim }}>{lang === 'en' ? 'No metrics logged' : 'Keine Werte erfasst'}</Text>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {days.length === 0 && (
            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 48 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 6 }}>{lang === 'en' ? 'No data yet' : 'Noch keine Daten'}</Text>
              <Text style={{ fontSize: 13, color: textMuted, textAlign: 'center' }}>
                {lang === 'en' ? 'Log sleep, check-ins and workouts to see your history here.' : 'Trage Schlaf, Check-in und Training ein um hier deinen Verlauf zu sehen.'}
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
              <Text style={{ color: '#F87171', fontSize: 13, fontWeight: '600' }}>{lang === 'en' ? 'Delete History' : 'Verlauf löschen'}</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** Grün/Gelb/Rot je nach Metrik-Wert, damit man auf einen Blick sieht was gut/schlecht war. */
function metricStatusColor(key: MetricKey, value: number): string {
  switch (key) {
    case 'sleepHours':
      return value >= 7 ? '#4ADE80' : value >= 6 ? '#FBBF24' : '#F87171';
    case 'sleepScore':
    case 'perfScore':
    case 'workoutScore':
    case 'recovery':
      return value >= 70 ? '#4ADE80' : value >= 45 ? '#FBBF24' : '#F87171';
    case 'hrv':
      return value >= 50 ? '#4ADE80' : value >= 35 ? '#FBBF24' : '#F87171';
    case 'restingHR':
      return value <= 60 ? '#4ADE80' : value <= 70 ? '#FBBF24' : '#F87171';
    case 'battLevel':
      return value >= 65 ? '#4ADE80' : value >= 35 ? '#FBBF24' : '#F87171';
    default:
      return '#818CF8';
  }
}

/** Gesamtfarbe für den Tag (linker Rand der Karte) basierend auf Performance/Recovery/Schlaf. */
function dayStatusColor(day: DayData, fallback: string): string {
  const score = day.perfScore ?? day.recovery ?? day.sleepScore ?? day.battLevel ?? null;
  if (score == null) return fallback;
  return score >= 70 ? '#4ADE80' : score >= 45 ? '#FBBF24' : '#F87171';
}