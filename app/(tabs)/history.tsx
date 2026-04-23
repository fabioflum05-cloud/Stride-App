import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
  habitsCompleted?: number;
  habitsTotal?: number;
  hrv?: number;
  schlafStunden?: number;
  workouts?: number;
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function getDayKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const CORRELATIONS = [
  { key: 'sleep_performance', label: 'Schlaf → Performance', xKey: 'sleepScore', yKey: 'checkinScore', xLabel: 'Sleep Score', yLabel: 'Performance', color: '#EC4899' },
  { key: 'hrv_performance', label: 'HRV → Performance', xKey: 'hrv', yKey: 'checkinScore', xLabel: 'HRV (ms)', yLabel: 'Performance', color: '#67E8F9' },
  { key: 'sleep_hours', label: 'Schlafdauer → Score', xKey: 'schlafStunden', yKey: 'sleepScore', xLabel: 'Stunden', yLabel: 'Sleep Score', color: '#A78BFA' },
  { key: 'training_battery', label: 'Training → Battery', xKey: 'workouts', yKey: 'batteryLevel', xLabel: 'Trainings', yLabel: 'Battery', color: '#FB923C' },
];

export default function HistoryScreen() {
  const [days, setDays] = useState<DayData[]>([]);
  const [activeChart, setActiveChart] = useState<'performance' | 'sleep' | 'battery' | 'kcal'>('performance');
  const [activeCorrelation, setActiveCorrelation] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const rawCheckin = await AsyncStorage.getItem('checkinHistory');
    const rawSleep = await AsyncStorage.getItem('sleepHistory');
    const rawBattery = await AsyncStorage.getItem('batteryHistory');
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
      const mockDays: DayData[] = [
        { date: '2026-04-16', dateLabel: '16.4', checkinScore: 65, sleepScore: 71, batteryLevel: 55, hrv: 52, schlafStunden: 6.5, workouts: 1 },
        { date: '2026-04-17', dateLabel: '17.4', checkinScore: 70, sleepScore: 78, batteryLevel: 62, hrv: 61, schlafStunden: 7.5, workouts: 0 },
        { date: '2026-04-18', dateLabel: '18.4', checkinScore: 58, sleepScore: 65, batteryLevel: 48, hrv: 45, schlafStunden: 5.5, workouts: 1 },
        { date: '2026-04-19', dateLabel: '19.4', checkinScore: 80, sleepScore: 85, batteryLevel: 70, hrv: 72, schlafStunden: 8.5, workouts: 0 },
        { date: '2026-04-20', dateLabel: '20.4', checkinScore: 75, sleepScore: 80, batteryLevel: 65, hrv: 68, schlafStunden: 7.0, workouts: 1 },
        { date: '2026-04-21', dateLabel: '21.4', checkinScore: 82, sleepScore: 88, batteryLevel: 72, hrv: 81, schlafStunden: 8.0, workouts: 0 },
        { date: '2026-04-22', dateLabel: '22.4', checkinScore: 78, sleepScore: 94, batteryLevel: 68, hrv: 90, schlafStunden: 9.0, workouts: 1 },
      ];
      setDays(mockDays);
      return;
    }

    setDays(sorted);
  }

  async function clearHistory() {
    Alert.alert('Verlauf löschen?', 'Alle gespeicherten Daten werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('checkinHistory');
          await AsyncStorage.removeItem('sleepHistory');
          await AsyncStorage.removeItem('batteryHistory');
          setDays([]);
        }
      }
    ]);
  }

  const last7 = days.slice(-7);

  const chartConfigs: Record<string, { data: number[], color: string, label: string }> = {
    performance: { data: last7.map(d => d.checkinScore ?? 0), color: '#7C3AED', label: 'Performance Score' },
    sleep: { data: last7.map(d => d.sleepScore ?? 0), color: '#EC4899', label: 'Sleep Score' },
    battery: { data: last7.map(d => d.batteryLevel ?? 0), color: '#06B6D4', label: 'Body Battery' },
    kcal: { data: last7.map(d => d.totalKcal ?? 0), color: '#FB923C', label: 'Kalorien' },
  };

  const active = chartConfigs[activeChart];
  const validData = active.data.some(v => v > 0) ? active.data : [1, 1, 1, 1, 1, 1, 1];
  const labels = last7.length > 0 ? last7.map(d => d.dateLabel) : ['', '', '', '', '', '', ''];

  const avg = days.filter(d => d.checkinScore).length > 0
    ? Math.round(days.reduce((s, d) => s + (d.checkinScore ?? 0), 0) / days.filter(d => d.checkinScore).length)
    : 0;
  const bestSleep = days.length > 0 ? Math.max(...days.map(d => d.sleepScore ?? 0)) : 0;
  const avgBattery = days.filter(d => d.batteryLevel).length > 0
    ? Math.round(days.reduce((s, d) => s + (d.batteryLevel ?? 0), 0) / days.filter(d => d.batteryLevel).length)
    : 0;
  const totalHabits = days.reduce((s, d) => s + (d.habitsCompleted ?? 0), 0);

  const corr = CORRELATIONS[activeCorrelation];
  const corrData = days.filter(d => d[corr.xKey as keyof DayData] && d[corr.yKey as keyof DayData]);

  function getCorrelationStrength() {
    if (corrData.length < 3) return { text: 'Zu wenig Daten', color: '#5B4A8A' };
    const xVals = corrData.map(d => d[corr.xKey as keyof DayData] as number);
    const yVals = corrData.map(d => d[corr.yKey as keyof DayData] as number);
    const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length;
    const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
    const num = xVals.reduce((sum, x, i) => sum + (x - xMean) * (yVals[i] - yMean), 0);
    const den = Math.sqrt(
      xVals.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0) *
      yVals.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0)
    );
    const r = den === 0 ? 0 : num / den;
    if (r > 0.7) return { text: `Starke positive Korrelation (r=${r.toFixed(2)})`, color: '#A78BFA' };
    if (r > 0.4) return { text: `Moderate Korrelation (r=${r.toFixed(2)})`, color: '#67E8F9' };
    if (r > 0) return { text: `Schwache Korrelation (r=${r.toFixed(2)})`, color: '#FB923C' };
    return { text: `Negative Korrelation (r=${r.toFixed(2)})`, color: '#FB7185' };
  }

  const corrStrength = getCorrelationStrength();

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
              <Text style={[styles.chartTabText, { color: activeChart === tab.key ? tab.color : '#3D2E5C' }]}>
                {tab.label}
              </Text>
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
            propsForDots: { r: '5', strokeWidth: '2', stroke: active.color, fill: active.color },
            propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.04)' },
          }}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={false}
        />
      </View>

      <Text style={styles.sectionTitle}>Muster erkennen</Text>
      <Text style={styles.sectionSub}>Siehst du Zusammenhänge zwischen verschiedenen Metriken?</Text>

      <View style={styles.corrTabs}>
        {CORRELATIONS.map((c, i) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.corrTab, activeCorrelation === i && { borderColor: c.color, backgroundColor: c.color + '15' }]}
            onPress={() => setActiveCorrelation(i)}
          >
            <Text style={[styles.corrTabText, { color: activeCorrelation === i ? c.color : '#3D2E5C' }]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.corrCard}>
        <View style={styles.corrHeader}>
          <Text style={[styles.corrTitle, { color: corr.color }]}>{corr.label}</Text>
          <View style={[styles.corrBadge, { borderColor: corrStrength.color + '40', backgroundColor: corrStrength.color + '15' }]}>
            <Text style={[styles.corrBadgeText, { color: corrStrength.color }]}>{corrStrength.text}</Text>
          </View>
        </View>

        {corrData.length >= 3 ? (
          <View style={styles.dotPlot}>
            {corrData.map((d, i) => {
              const xVals = corrData.map(dd => dd[corr.xKey as keyof DayData] as number);
              const yVals = corrData.map(dd => dd[corr.yKey as keyof DayData] as number);
              const xMin = Math.min(...xVals);
              const xMax = Math.max(...xVals);
              const yMin = Math.min(...yVals);
              const yMax = Math.max(...yVals);
              const x = xMax === xMin ? 0.5 : (((d[corr.xKey as keyof DayData] as number) - xMin) / (xMax - xMin));
              const y = yMax === yMin ? 0.5 : (1 - (((d[corr.yKey as keyof DayData] as number) - yMin) / (yMax - yMin)));
              return (
                <View key={i} style={[styles.dot, {
                  left: `${x * 85 + 5}%` as any,
                  top: `${y * 80 + 5}%` as any,
                  backgroundColor: corr.color,
                }]} />
              );
            })}
            <Text style={styles.dotPlotXLabel}>{corr.xLabel} →</Text>
            <Text style={styles.dotPlotYLabel}>↑ {corr.yLabel}</Text>
          </View>
        ) : (
          <View style={styles.corrEmpty}>
            <Text style={styles.corrEmptyText}>Mehr Daten nötig – tracke mindestens 3 Tage um Muster zu sehen.</Text>
          </View>
        )}
      </View>

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
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
  },
  summaryVal: {
    fontSize: 28,
    fontWeight: '500',
  },
  summaryLbl: {
    color: '#5B4A8A',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  chartCard: {
    backgroundColor: '#0D0A1A',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.2)',
    padding: 16,
    marginBottom: 24,
  },
  chartTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  chartTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chartTabText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chartLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -16,
  },
  sectionTitle: {
    color: '#5B4A8A',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionSub: {
    color: '#3D2E5C',
    fontSize: 12,
    marginBottom: 12,
  },
  corrTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  corrTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  corrTabText: {
    fontSize: 11,
    fontWeight: '500',
  },
  corrCard: {
    backgroundColor: '#0D0A1A',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 24,
  },
  corrHeader: {
    gap: 8,
    marginBottom: 16,
  },
  corrTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  corrBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  corrBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dotPlot: {
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.8,
  },
  dotPlotXLabel: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    color: '#3D2E5C',
    fontSize: 10,
  },
  dotPlotYLabel: {
    position: 'absolute',
    top: 6,
    left: 8,
    color: '#3D2E5C',
    fontSize: 10,
  },
  corrEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  corrEmptyText: {
    color: '#3D2E5C',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayDate: {
    color: '#E2D9F3',
    fontSize: 14,
    fontWeight: '500',
  },
  dayScorePill: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  dayScoreText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '500',
  },
  dayStats: {
    flexDirection: 'row',
    gap: 16,
  },
  dayStat: {
    alignItems: 'center',
  },
  dayStatVal: {
    fontSize: 16,
    fontWeight: '500',
  },
  dayStatLbl: {
    color: '#5B4A8A',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  clearBtn: {
    padding: 14,
    alignItems: 'center',
    marginBottom: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(251,113,133,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(251,113,133,0.2)',
  },
  clearBtnText: {
    color: '#FB7185',
    fontSize: 13,
  },
});