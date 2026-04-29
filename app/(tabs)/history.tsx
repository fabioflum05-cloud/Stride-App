import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

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
  { key: 'checkinScore', label: 'Performance', color: '#7C3AED' },
  { key: 'sleepScore', label: 'Sleep Score', color: '#EC4899' },
  { key: 'hrv', label: 'HRV', color: '#67E8F9' },
  { key: 'schlafStunden', label: 'Schlafdauer', color: '#A78BFA' },
  { key: 'batteryLevel', label: 'Battery', color: '#06B6D4' },
  { key: 'workouts', label: 'Training', color: '#FB923C' },
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

  useEffect(() => {
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
        setDays([
          { date: '2026-04-16', dateLabel: '16.4', checkinScore: 65, sleepScore: 71, batteryLevel: 55, hrv: 52, schlafStunden: 6.5, workouts: 1 },
          { date: '2026-04-17', dateLabel: '17.4', checkinScore: 70, sleepScore: 78, batteryLevel: 62, hrv: 61, schlafStunden: 7.5, workouts: 0 },
          { date: '2026-04-18', dateLabel: '18.4', checkinScore: 58, sleepScore: 65, batteryLevel: 48, hrv: 45, schlafStunden: 5.5, workouts: 1 },
          { date: '2026-04-19', dateLabel: '19.4', checkinScore: 80, sleepScore: 85, batteryLevel: 70, hrv: 72, schlafStunden: 8.5, workouts: 0 },
          { date: '2026-04-20', dateLabel: '20.4', checkinScore: 75, sleepScore: 80, batteryLevel: 65, hrv: 68, schlafStunden: 7.0, workouts: 1 },
          { date: '2026-04-21', dateLabel: '21.4', checkinScore: 82, sleepScore: 88, batteryLevel: 72, hrv: 81, schlafStunden: 8.0, workouts: 0 },
          { date: '2026-04-22', dateLabel: '22.4', checkinScore: 78, sleepScore: 94, batteryLevel: 68, hrv: 90, schlafStunden: 9.0, workouts: 1 },
        ]);
        return;
      }
      setDays(sorted);
    }
    load();
  }, []);

  async function clearHistory() {
    Alert.alert('Verlauf löschen?', '', [
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
    performance: { data: last14.map(d => d.checkinScore ?? 0), color: '#7C3AED', label: 'Performance Score' },
    sleep: { data: last14.map(d => d.sleepScore ?? 0), color: '#EC4899', label: 'Sleep Score' },
    battery: { data: last14.map(d => d.batteryLevel ?? 0), color: '#06B6D4', label: 'Body Battery' },
    kcal: { data: last14.map(d => d.totalKcal ?? 0), color: '#FB923C', label: 'Kalorien' },
  };

  const active = chartConfigs[activeChart];
  const validData = active.data.some(v => v > 0) ? active.data : [1, 1, 1, 1, 1, 1, 1];

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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Verlauf</Text>
      <Text style={styles.title}>Dein{'\n'}Fortschritt</Text>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { borderColor: 'rgba(124,58,237,0.25)' }]}>
          <Text style={[styles.summaryVal, { color: '#A78BFA' }]}>{avg || '--'}</Text>
          <Text style={styles.summaryLbl}>Ø Performance</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: 'rgba(236,72,153,0.25)' }]}>
          <Text style={[styles.summaryVal, { color: '#F472B6' }]}>{bestSleep || '--'}</Text>
          <Text style={styles.summaryLbl}>Bester Schlaf</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: 'rgba(6,182,212,0.25)' }]}>
          <Text style={[styles.summaryVal, { color: '#67E8F9' }]}>{avgBattery || '--'}</Text>
          <Text style={styles.summaryLbl}>Ø Battery</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: 'rgba(251,146,60,0.25)' }]}>
          <Text style={[styles.summaryVal, { color: '#FB923C' }]}>{days.length}</Text>
          <Text style={styles.summaryLbl}>Tage getrackt</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartTabs}>
          {[
            { key: 'performance', label: 'Score', color: '#7C3AED' },
            { key: 'sleep', label: 'Schlaf', color: '#EC4899' },
            { key: 'battery', label: 'Battery', color: '#06B6D4' },
            { key: 'kcal', label: 'kcal', color: '#FB923C' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.chartTab, activeChart === tab.key && { borderColor: tab.color, backgroundColor: tab.color + '20' }]}
              onPress={() => setActiveChart(tab.key as any)}
            >
              <Text style={[styles.chartTabText, { color: activeChart === tab.key ? tab.color : '#3D2E5C' }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.chartLabel, { color: active.color }]}>{active.label}</Text>
        <LineChart
          data={{ labels, datasets: [{ data: validData.map(v => Math.max(v, 0.1)) }] }}
          width={screenWidth - 32}
          height={180}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: '#0D0A1A',
            backgroundGradientTo: '#0D0A1A',
            decimalPlaces: 0,
            color: (opacity = 1) => `${active.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
            labelColor: () => '#5B4A8A',
            propsForDots: { r: '4', strokeWidth: '2', stroke: active.color, fill: active.color },
            propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.04)' },
          }}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={false}
        />
      </View>

      <Text style={styles.sectionTitle}>Muster erkennen</Text>
      <Text style={styles.sectionSub}>Wähle bis zu 4 Metriken – normalisiert für Vergleichbarkeit.</Text>

      <View style={styles.metricGrid}>
        {METRICS.map(m => {
          const selected = selectedMetrics.includes(m.key);
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.metricChip, selected && { backgroundColor: m.color + '20', borderColor: m.color + '60' }]}
              onPress={() => toggleMetric(m.key)}
            >
              <View style={[styles.metricChipDot, { backgroundColor: selected ? m.color : '#3D2E5C' }]} />
              <Text style={[styles.metricChipText, { color: selected ? m.color : '#3D2E5C' }]}>{m.label}</Text>
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
              backgroundGradientFrom: '#0D0A1A',
              backgroundGradientTo: '#0D0A1A',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(167,139,250,${opacity})`,
              labelColor: () => '#5B4A8A',
              propsForDots: { r: '3', strokeWidth: '1' },
              propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.04)' },
            }}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            withDots={true}
          />
          <Text style={styles.normalizedNote}>* Alle Werte normalisiert auf 0–100</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tagesübersicht</Text>
      {days.slice(-7).reverse().map((day, i) => (
        <View key={i} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayDate}>{day.dateLabel}</Text>
            {day.checkinScore && (
              <View style={styles.dayScorePill}>
                <Text style={styles.dayScoreText}>Score {day.checkinScore}</Text>
              </View>
            )}
          </View>
          <View style={styles.dayStats}>
            {day.sleepScore !== undefined && (
              <View style={styles.dayStat}>
                <Text style={[styles.dayStatVal, { color: '#F472B6' }]}>{day.sleepScore}</Text>
                <Text style={styles.dayStatLbl}>Schlaf</Text>
              </View>
            )}
            {day.hrv !== undefined && (
              <View style={styles.dayStat}>
                <Text style={[styles.dayStatVal, { color: '#67E8F9' }]}>{day.hrv}</Text>
                <Text style={styles.dayStatLbl}>HRV</Text>
              </View>
            )}
            {day.schlafStunden !== undefined && (
              <View style={styles.dayStat}>
                <Text style={[styles.dayStatVal, { color: '#A78BFA' }]}>{day.schlafStunden}h</Text>
                <Text style={styles.dayStatLbl}>Dauer</Text>
              </View>
            )}
            {day.workouts !== undefined && day.workouts > 0 && (
              <View style={styles.dayStat}>
                <Text style={[styles.dayStatVal, { color: '#FB923C' }]}>{day.workouts}</Text>
                <Text style={styles.dayStatLbl}>Training</Text>
              </View>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.clearBtn} onPress={clearHistory}>
        <Text style={styles.clearBtnText}>Verlauf löschen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, padding: 14 },
  summaryVal: { fontSize: 28, fontWeight: '500' },
  summaryLbl: { color: '#5B4A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  chartCard: { backgroundColor: '#0D0A1A', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)', padding: 16, marginBottom: 24 },
  chartTabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chartTab: { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  chartTabText: { fontSize: 11, fontWeight: '500' },
  chartLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  chart: { borderRadius: 12, marginLeft: -16 },
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  sectionSub: { color: '#3D2E5C', fontSize: 12, marginBottom: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  metricChipDot: { width: 6, height: 6, borderRadius: 3 },
  metricChipText: { fontSize: 12, fontWeight: '500' },
  multiChartCard: { backgroundColor: '#0D0A1A', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 24, gap: 12 },
  multiLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
  normalizedNote: { color: '#3D2E5C', fontSize: 10, fontStyle: 'italic' },
  dayCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 14, marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayDate: { color: '#E2D9F3', fontSize: 14, fontWeight: '500' },
  dayScorePill: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  dayScoreText: { color: '#A78BFA', fontSize: 11, fontWeight: '500' },
  dayStats: { flexDirection: 'row', gap: 16 },
  dayStat: { alignItems: 'center' },
  dayStatVal: { fontSize: 16, fontWeight: '500' },
  dayStatLbl: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  clearBtn: { padding: 14, alignItems: 'center', marginBottom: 40, borderRadius: 14, backgroundColor: 'rgba(251,113,133,0.08)', borderWidth: 0.5, borderColor: 'rgba(251,113,133,0.2)' },
  clearBtnText: { color: '#FB7185', fontSize: 13 },
});