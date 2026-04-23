import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type PR = {
  exercise: string;
  weight: number;
  reps: number;
  oneRM: number;
  date: string;
};

function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export default function PRScreen() {
  const [prs, setPRs] = useState<PR[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const raw = await AsyncStorage.getItem('workouts');
        if (!raw) return;
        const workouts = JSON.parse(raw);
        const prMap: Record<string, PR> = {};

        workouts.forEach((w: any) => {
          w.exercises?.forEach((ex: any) => {
            ex.sets?.forEach((set: any) => {
              const weight = parseFloat(set.weight || '0');
              const reps = parseFloat(set.reps || '0');
              if (weight <= 0 || reps <= 0) return;
              const oneRM = calculate1RM(weight, reps);
              if (!prMap[ex.name] || oneRM > prMap[ex.name].oneRM) {
                prMap[ex.name] = { exercise: ex.name, weight, reps, oneRM, date: w.date };
              }
            });
          });
        });

        setPRs(Object.values(prMap).sort((a, b) => b.oneRM - a.oneRM));
      }
      load();
    }, [])
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>Personal Records</Text>
      <Text style={styles.title}>Deine{'\n'}Bestleistungen</Text>

      {prs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Noch keine PRs – starte ein Training!</Text>
        </View>
      ) : (
        prs.map((pr, i) => (
          <View key={i} style={styles.prCard}>
            <View style={styles.prHeader}>
              <Text style={styles.prRank}>#{i + 1}</Text>
              <Text style={styles.prName}>{pr.exercise}</Text>
              <Text style={styles.prDate}>
                {new Date(pr.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}
              </Text>
            </View>
            <View style={styles.prStats}>
              <View style={styles.prStat}>
                <Text style={[styles.prStatVal, { color: '#A78BFA' }]}>{pr.oneRM}</Text>
                <Text style={styles.prStatLbl}>Est. 1RM</Text>
              </View>
              <View style={styles.prStat}>
                <Text style={[styles.prStatVal, { color: '#67E8F9' }]}>{pr.weight}kg</Text>
                <Text style={styles.prStatLbl}>Gewicht</Text>
              </View>
              <View style={styles.prStat}>
                <Text style={[styles.prStatVal, { color: '#FB923C' }]}>{pr.reps}</Text>
                <Text style={styles.prStatLbl}>Reps</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: '#E2D9F3', fontSize: 28, fontWeight: '500', lineHeight: 36, marginBottom: 24 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#3D2E5C', fontSize: 14, textAlign: 'center' },
  prCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 10 },
  prHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  prRank: { color: '#5B4A8A', fontSize: 12, width: 24 },
  prName: { flex: 1, color: '#E2D9F3', fontSize: 15, fontWeight: '500' },
  prDate: { color: '#5B4A8A', fontSize: 11 },
  prStats: { flexDirection: 'row', gap: 16 },
  prStat: { alignItems: 'center' },
  prStatVal: { fontSize: 20, fontWeight: '500' },
  prStatLbl: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
});