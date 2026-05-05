import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { theme } from '../../constants/theme';

const screenWidth = Dimensions.get('window').width - 40;

type DayData = {
  date: string;
  dateLabel: string;
  checkinScore?: number;
  sleepScore?: number;
  batteryLevel?: number;
  totalKcal?: number;
  hrv?: number;
  schlafStunden?: number;
  workouts?: number;
  workoutScore?: number;
};

const METRICS = [
  { key: 'checkinScore',   label: 'Performance',     color: theme.blue,    emoji: '⚡' },
  { key: 'workoutScore',   label: 'Trainingsscore',  color: '#7C3AED',     emoji: '🏋️' },
  { key: 'sleepScore',     label: 'Sleep Score',     color: theme.pink,    emoji: '😴' },
  { key: 'schlafStunden',  label: 'Schlafdauer',     color: theme.purple,  emoji: '🌙' },
  { key: 'hrv',            label: 'HRV',             color: theme.teal,    emoji: '💓' },
  { key: 'batteryLevel',   label: 'Battery',         color: theme.green,   emoji: '🔋' },
  { key: 'workouts',       label: 'Trainings',       color: theme.orange,  emoji: '📅' },
  { key: 'totalKcal',      label: 'Kalorien',        color: '#FB923C',     emoji: '🍽️' },
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function getDayKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function normalizeData(data: (number | undefined)[]): number[] {
  const valid = data.filter(v => v !== undefined && v > 0) as number[];
  if (valid.length === 0) return data.map(() => 0);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return data.map(v => v !== undefined && v > 0 ? 50 : 0);
  return data.map(v => v !== undefined && v > 0 ? Math.round(((v - min) / (max - min)) * 100) : 0);
}

export default function HistoryScreen() {
  const [days, setDays] = useState<DayData[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['workoutScore', 'sleepScore', 'checkinScore']);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);

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
    const rawCheckin  = await AsyncStorage.getItem('checkinHistory');
    const rawSleep    = await AsyncStorage.getItem('sleepHistory');
    const rawWorkouts = await AsyncStorage.getItem('workouts');
    const rawWH       = await AsyncStorage.getItem('workoutHistory');

    const dayMap: Record<string, DayData> = {};

    if (rawCheckin) {
      JSON.parse(rawCheckin).forEach((e: any) => {
        const key = getDayKey(e.date);
        if (!dayMap[key]) dayMap[key] = { date: e.date, dateLabel: formatDate(e.date) };
        dayMap[key].checkinScore = e.score;
      });
    }

    if (rawSleep) {
      JSON.parse(rawSleep).forEach((e: any) => {
        const key = getDayKey(e.date);
        if (!dayMap[key]) dayMap[key] = { date: e.date, dateLabel: formatDate(e.date) };
        dayMap[key].sleepScore = e.sleepScore;
        dayMap[key].hrv = e.hrv;
        dayMap[key].schlafStunden = e.schlafStunden;
      });
    }

    if (rawWorkouts) {
      JSON.parse(rawWorkouts).forEach((w: any) => {
        const key = getDayKey(w.date);
        if (!dayMap[key]) dayMap[key] = { date: w.date, dateLabel: formatDate(w.date) };
        dayMap[key].workouts = (dayMap[key].workouts ?? 0) + 1;
      });
    }

    // Workout scores from workoutHistory
    if (rawWH) {
      JSON.parse(rawWH).forEach((w: any) => {
        const key = getDayKey(w.date);
        if (!dayMap[key]) dayMap[key] = { date: w.date, dateLabel: formatDate(w.date) };
        // Take highest score of the day
        dayMap[key].workoutScore = Math.max(dayMap[key].workoutScore ?? 0, w.score ?? 0);
      });
    }

    const sorted = Object.values(dayMap).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setDays(sorted);
  }

  async function clearHistory() {
    Alert.alert('Verlauf löschen?', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove(['checkinHistory', 'sleepHistory', 'workoutHistory']);
          setDays([]);
        }
      }
    ]);
  }

  function toggleMetric(key: string) {
    setSelectedMetrics(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter(k => k !== key);
      }
      return [...prev, key]; // no upper limit
    });
  }

  const rangedDays = days.slice(-timeRange);
  const labels = rangedDays.map(d => d.dateLabel);

  // Build multi-line datasets
  const multiDatasets = selectedMetrics.map(key => {
    const m = METRICS.find(m => m.key === key)!;
    const raw = rangedDays.map(d => d[key as keyof DayData] as number | undefined);
    const normalized = normalizeData(raw);
    return {
      data: normalized.map(v => Math.max(v, 0.1)),
      color: (opacity = 1) => m.color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
      strokeWidth: 2,
    };
  });

  // Summary stats
  const avgScore = days.filter(d => d.checkinScore).length > 0
    ? Math.round(days.reduce((s, d) => s + (d.checkinScore ?? 0), 0) / days.filter(d => d.checkinScore).length) : 0;
  const avgWorkoutScore = days.filter(d => d.workoutScore && d.workoutScore > 0).length > 0
    ? Math.round(days.filter(d => d.workoutScore && d.workoutScore > 0).reduce((s, d) => s + (d.workoutScore ?? 0), 0) / days.filter(d => d.workoutScore && d.workoutScore > 0).length) : 0;
  const bestSleep = days.length > 0 ? Math.max(...days.map(d => d.sleepScore ?? 0)) : 0;
  const totalWorkouts = days.reduce((s, d) => s + (d.workouts ?? 0), 0);

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(26,115,232,${opacity})`,
    labelColor: () => theme.textSecondary,
    propsForDots: { r: '3', strokeWidth: '1' },
    propsForBackgroundLines: { stroke: theme.borderLight },
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        <Text style={styles.headerLabel}>Verlauf</Text>
        <Text style={styles.title}>Dein{'\n'}Fortschritt</Text>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          {[
            { val: avgScore || '--',        lbl: 'Ø Performance',   color: theme.blue },
            { val: avgWorkoutScore || '--', lbl: 'Ø Training',      color: '#7C3AED' },
            { val: bestSleep || '--',       lbl: 'Bester Schlaf',   color: theme.pink },
            { val: totalWorkouts,           lbl: 'Trainings total', color: theme.orange },
          ].map(s => (
            <View key={s.lbl} style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.summaryLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Time range selector */}
        <View style={styles.timeRangeRow}>
          {([7, 14, 30] as const).map(r => (
            <TouchableOpacity key={r} style={[styles.rangeBtn, timeRange === r && styles.rangeBtnActive]} onPress={() => setTimeRange(r)}>
              <Text style={[styles.rangeBtnText, timeRange === r && { color: theme.blue }]}>{r}T</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Metric selector – unlimited */}
        <Text style={styles.sectionTitle}>Metriken vergleichen</Text>
        <Text style={styles.sectionSub}>Wähle beliebig viele Metriken</Text>
        <View style={styles.metricGrid}>
          {METRICS.map(m => {
            const selected = selectedMetrics.includes(m.key);
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.metricChip, selected && { backgroundColor: m.color + '18', borderColor: m.color }]}
                onPress={() => toggleMetric(m.key)}
              >
                <Text style={{ fontSize: 13 }}>{m.emoji}</Text>
                <Text style={[styles.metricChipText, { color: selected ? m.color : theme.textSecondary }]}>{m.label}</Text>
                {selected && <View style={[styles.metricChipDot, { backgroundColor: m.color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        {selectedMetrics.length > 0 && (
          <View style={styles.legendRow}>
            {selectedMetrics.map(key => {
              const m = METRICS.find(m => m.key === key)!;
              return (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                  <Text style={[styles.legendText, { color: m.color }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Multi-metric chart */}
        {multiDatasets.length > 0 && rangedDays.length >= 2 ? (
          <View style={styles.chartCard}>
            <LineChart
              data={{ labels, datasets: multiDatasets }}
              width={screenWidth - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withDots={rangedDays.length <= 14}
            />
            <Text style={styles.normalizedNote}>* Alle Werte normalisiert auf 0–100 für Vergleichbarkeit</Text>
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>Noch zu wenig Daten für ein Diagramm</Text>
          </View>
        )}

        {/* Per-metric raw value cards */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Rohwerte</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {selectedMetrics.map(key => {
              const m = METRICS.find(m => m.key === key)!;
              const values = rangedDays.map(d => d[key as keyof DayData] as number | undefined).filter(v => v !== undefined && v > 0) as number[];
              const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
              const best = values.length > 0 ? Math.max(...values) : null;
              const latest = rangedDays.slice().reverse().find(d => d[key as keyof DayData] !== undefined)?.[key as keyof DayData] as number | undefined;
              return (
                <View key={key} style={[styles.rawCard, { borderTopColor: m.color }]}>
                  <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                  <Text style={[styles.rawCardLabel, { color: m.color }]}>{m.label}</Text>
                  {latest !== undefined && <Text style={[styles.rawCardVal, { color: m.color }]}>{latest}</Text>}
                  {avg !== null && <Text style={styles.rawCardSub}>Ø {avg}</Text>}
                  {best !== null && <Text style={styles.rawCardSub}>Max {best}</Text>}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Day Cards */}
        <Text style={styles.sectionTitle}>Tagesübersicht</Text>
        {rangedDays.slice().reverse().map((day, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>{day.dateLabel}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {day.workoutScore !== undefined && day.workoutScore > 0 && (
                  <View style={[styles.dayScorePill, { backgroundColor: '#7C3AED20' }]}>
                    <Text style={[styles.dayScoreText, { color: '#7C3AED' }]}>🏋️ {day.workoutScore}</Text>
                  </View>
                )}
                {day.checkinScore && (
                  <View style={[styles.dayScorePill, { backgroundColor: theme.blueLight }]}>
                    <Text style={[styles.dayScoreText, { color: theme.blue }]}>⚡ {day.checkinScore}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.dayStats}>
              {day.sleepScore !== undefined && (
                <View style={styles.dayStat}>
                  <Text style={[styles.dayStatVal, { color: theme.pink }]}>{day.sleepScore}</Text>
                  <Text style={styles.dayStatLbl}>Schlaf</Text>
                </View>
              )}
              {day.hrv !== undefined && (
                <View style={styles.dayStat}>
                  <Text style={[styles.dayStatVal, { color: theme.teal }]}>{day.hrv}</Text>
                  <Text style={styles.dayStatLbl}>HRV</Text>
                </View>
              )}
              {day.schlafStunden !== undefined && (
                <View style={styles.dayStat}>
                  <Text style={[styles.dayStatVal, { color: theme.purple }]}>{day.schlafStunden}h</Text>
                  <Text style={styles.dayStatLbl}>Dauer</Text>
                </View>
              )}
              {day.workouts !== undefined && day.workouts > 0 && (
                <View style={styles.dayStat}>
                  <Text style={[styles.dayStatVal, { color: theme.orange }]}>{day.workouts}×</Text>
                  <Text style={styles.dayStatLbl}>Training</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.clearBtn} onPress={clearHistory}>
          <Text style={styles.clearBtnText}>Verlauf löschen</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 24 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { width: '48%', backgroundColor: theme.card, borderRadius: 14, padding: 14, ...theme.shadow },
  summaryVal: { fontSize: 28, fontWeight: '600' },
  summaryLbl: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  timeRangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: theme.card, ...theme.shadow },
  rangeBtnActive: { backgroundColor: theme.blueLight },
  rangeBtnText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  sectionSub: { color: theme.textSecondary, fontSize: 12, marginBottom: 12 },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  metricChipDot: { width: 6, height: 6, borderRadius: 3 },
  metricChipText: { fontSize: 12, fontWeight: '500' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },

  chartCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 20, ...theme.shadow },
  chart: { borderRadius: 12, marginLeft: -16 },
  normalizedNote: { color: theme.textTertiary, fontSize: 10, fontStyle: 'italic', marginTop: 8 },

  emptyChart: { backgroundColor: theme.card, borderRadius: 18, padding: 32, alignItems: 'center', marginBottom: 20, ...theme.shadow },
  emptyChartText: { color: theme.textSecondary, fontSize: 13 },

  rawCard: { backgroundColor: theme.card, borderRadius: 14, padding: 14, width: 110, borderTopWidth: 3, alignItems: 'center', gap: 4, ...theme.shadow },
  rawCardLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  rawCardVal: { fontSize: 24, fontWeight: '700' },
  rawCardSub: { color: theme.textSecondary, fontSize: 10 },

  dayCard: { backgroundColor: theme.card, borderRadius: 14, padding: 14, marginBottom: 8, ...theme.shadow },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayDate: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  dayScorePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  dayScoreText: { fontSize: 11, fontWeight: '500' },
  dayStats: { flexDirection: 'row', gap: 16 },
  dayStat: { alignItems: 'center' },
  dayStatVal: { fontSize: 16, fontWeight: '600' },
  dayStatLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  clearBtn: { padding: 14, alignItems: 'center', marginBottom: 20, borderRadius: 14, backgroundColor: '#FFEBEE' },
  clearBtnText: { color: theme.red, fontSize: 13, fontWeight: '500' },
});