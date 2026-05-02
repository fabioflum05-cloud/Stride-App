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
};

const METRICS = [
  { key: 'checkinScore', label: 'Performance', color: theme.blue },
  { key: 'sleepScore', label: 'Sleep Score', color: theme.pink },
  { key: 'hrv', label: 'HRV', color: theme.teal },
  { key: 'schlafStunden', label: 'Schlafdauer', color: theme.purple },
  { key: 'batteryLevel', label: 'Battery', color: theme.green },
  { key: 'workouts', label: 'Training', color: theme.orange },
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
  const valid = data.filter(v => v !== undefined) as number[];
  if (valid.length === 0) return data.map(() => 0);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return data.map(v => v !== undefined ? 50 : 0);
  return data.map(v => v !== undefined ? Math.round(((v - min) / (max - min)) * 100) : 0);
}

export default function HistoryScreen() {
  const [days, setDays] = useState<DayData[]>([]);
  const [activeChart, setActiveChart] = useState<'performance' | 'sleep' | 'battery' | 'kcal'>('performance');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['sleepScore', 'checkinScore']);

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
    const rawCheckin = await AsyncStorage.getItem('checkinHistory');
    const rawSleep = await AsyncStorage.getItem('sleepHistory');
    const rawWorkouts = await AsyncStorage.getItem('workouts');

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

    const sorted = Object.values(dayMap).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sorted.length === 0) {
  setDays([]);
  return;

    }
    setDays(sorted);
  }

  async function clearHistory() {
    Alert.alert('Verlauf löschen?', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('checkinHistory');
          await AsyncStorage.removeItem('sleepHistory');
          setDays([]);
        }
      }
    ]);
  }

  function toggleMetric(key: string) {
    setSelectedMetrics(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter(k => k !== key);
      }
      if (prev.length >= 4) return prev;
      return [...prev, key];
    });
  }

  const last14 = days.slice(-14);
  const labels = last14.map(d => d.dateLabel);

  const chartConfigs: Record<string, { data: number[], color: string, label: string }> = {
    performance: { data: last14.map(d => d.checkinScore ?? 0), color: theme.blue, label: 'Performance Score' },
    sleep: { data: last14.map(d => d.sleepScore ?? 0), color: theme.pink, label: 'Sleep Score' },
    battery: { data: last14.map(d => d.batteryLevel ?? 0), color: theme.green, label: 'Body Battery' },
    kcal: { data: last14.map(d => d.totalKcal ?? 0), color: theme.orange, label: 'Kalorien' },
  };

  const active = chartConfigs[activeChart];
  const validData = active.data.some(v => v > 0) ? active.data : [1, 2, 3, 2, 3, 2, 1];

  const avg = days.filter(d => d.checkinScore).length > 0
    ? Math.round(days.reduce((s, d) => s + (d.checkinScore ?? 0), 0) / days.filter(d => d.checkinScore).length)
    : 0;
  const bestSleep = days.length > 0 ? Math.max(...days.map(d => d.sleepScore ?? 0)) : 0;
  const avgBattery = days.filter(d => d.batteryLevel).length > 0
    ? Math.round(days.reduce((s, d) => s + (d.batteryLevel ?? 0), 0) / days.filter(d => d.batteryLevel).length)
    : 0;

  const multiDatasets = selectedMetrics.map(key => {
    const m = METRICS.find(m => m.key === key)!;
    const raw = last14.map(d => d[key as keyof DayData] as number | undefined);
    const normalized = normalizeData(raw);
    return {
      data: normalized.map(v => Math.max(v, 0.1)),
      color: (opacity = 1) => m.color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
      strokeWidth: 2,
    };
  });

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `${active.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    labelColor: () => theme.textSecondary,
    propsForDots: { r: '4', strokeWidth: '2', stroke: active.color, fill: active.color },
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
            { val: avg || '--', lbl: 'Ø Performance', color: theme.blue },
            { val: bestSleep || '--', lbl: 'Bester Schlaf', color: theme.pink },
            { val: avgBattery || '--', lbl: 'Ø Battery', color: theme.green },
            { val: days.length, lbl: 'Tage getrackt', color: theme.orange },
          ].map(s => (
            <View key={s.lbl} style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.summaryLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartTabs}>
            {[
              { key: 'performance', label: 'Score', color: theme.blue },
              { key: 'sleep', label: 'Schlaf', color: theme.pink },
              { key: 'battery', label: 'Battery', color: theme.green },
              { key: 'kcal', label: 'kcal', color: theme.orange },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.chartTab, activeChart === tab.key && { backgroundColor: tab.color }]}
                onPress={() => setActiveChart(tab.key as any)}
              >
                <Text style={[styles.chartTabText, { color: activeChart === tab.key ? '#fff' : theme.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.chartLabel, { color: active.color }]}>{active.label}</Text>
          <LineChart
            data={{ labels, datasets: [{ data: validData.map(v => Math.max(v, 0.1)), color: (opacity = 1) => active.color }] }}
            width={screenWidth - 32}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            withDots={true}
          />
        </View>

        {/* Multi Metric */}
        <Text style={styles.sectionTitle}>Muster erkennen</Text>
        <Text style={styles.sectionSub}>Wähle bis zu 4 Metriken zum Vergleichen</Text>

        <View style={styles.metricGrid}>
          {METRICS.map(m => {
            const selected = selectedMetrics.includes(m.key);
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.metricChip, selected && { backgroundColor: m.color + '18', borderColor: m.color }]}
                onPress={() => toggleMetric(m.key)}
              >
                <View style={[styles.metricChipDot, { backgroundColor: selected ? m.color : theme.textTertiary }]} />
                <Text style={[styles.metricChipText, { color: selected ? m.color : theme.textSecondary }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {multiDatasets.length > 0 && last14.length >= 2 && (
          <View style={styles.multiChartCard}>
            <View style={styles.multiLegend}>
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
            <LineChart
              data={{ labels, datasets: multiDatasets }}
              width={screenWidth - 32}
              height={200}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: theme.card,
                backgroundGradientTo: theme.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(26,115,232,${opacity})`,
                labelColor: () => theme.textSecondary,
                propsForDots: { r: '3', strokeWidth: '1' },
                propsForBackgroundLines: { stroke: theme.borderLight },
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
            />
            <Text style={styles.normalizedNote}>* Alle Werte normalisiert auf 0–100</Text>
          </View>
        )}

        {/* Day Cards */}
        <Text style={styles.sectionTitle}>Tagesübersicht</Text>
        {days.slice(-7).reverse().map((day, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>{day.dateLabel}</Text>
              {day.checkinScore && (
                <View style={[styles.dayScorePill, { backgroundColor: theme.blueLight }]}>
                  <Text style={[styles.dayScoreText, { color: theme.blue }]}>Score {day.checkinScore}</Text>
                </View>
              )}
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
                  <Text style={[styles.dayStatVal, { color: theme.orange }]}>{day.workouts}</Text>
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

  chartCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 20, ...theme.shadow },
  chartTabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chartTab: { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', backgroundColor: theme.cardSecondary },
  chartTabText: { fontSize: 11, fontWeight: '500' },
  chartLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: '600' },
  chart: { borderRadius: 12, marginLeft: -16 },
  

  sectionTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  sectionSub: { color: theme.textSecondary, fontSize: 12, marginBottom: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, ...theme.shadow },
  metricChipDot: { width: 6, height: 6, borderRadius: 3 },
  metricChipText: { fontSize: 12, fontWeight: '500' },

  multiChartCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 24, gap: 12, ...theme.shadow },
  multiLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
  normalizedNote: { color: theme.textTertiary, fontSize: 10, fontStyle: 'italic' },

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

  // Expanded Modal
  expandedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  expandedCard: { backgroundColor: theme.card, borderRadius: 20, padding: 20, width: '100%', ...theme.shadow },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  expandedClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  expandedCloseText: { color: theme.textSecondary, fontSize: 13 },
});