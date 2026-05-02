import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

type PR = { exercise: string; weight: number; reps: number; oneRM: number; date: string; };

function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export default function PRScreen() {
  const [prs, setPRs] = useState<PR[]>([]);

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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <BackButton />
        <Text style={styles.headerLabel}>Personal Records</Text>
        <Text style={styles.title}>Deine{'\n'}Bestleistungen</Text>

        {prs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyTitle}>Noch keine PRs</Text>
            <Text style={styles.emptySub}>Starte ein Training um deine ersten PRs zu setzen!</Text>
          </View>
        ) : (
          prs.map((pr, i) => (
            <View key={i} style={[styles.prCard, i === 0 && styles.prCardGold]}>
              <View style={styles.prHeader}>
                <View style={[styles.prRankBadge, i === 0 && { backgroundColor: theme.orangeLight }]}>
                  <Text style={[styles.prRank, i === 0 && { color: theme.orange }]}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </Text>
                </View>
                <Text style={styles.prName}>{pr.exercise}</Text>
                <Text style={styles.prDate}>
                  {new Date(pr.date).toLocaleDateString('de', { day: '2-digit', month: '2-digit' })}
                </Text>
              </View>
              <View style={styles.prStats}>
                <View style={styles.prStat}>
                  <Text style={[styles.prStatVal, { color: theme.blue }]}>{pr.oneRM}</Text>
                  <Text style={styles.prStatLbl}>Est. 1RM</Text>
                </View>
                <View style={styles.prDivider} />
                <View style={styles.prStat}>
                  <Text style={[styles.prStatVal, { color: theme.green }]}>{pr.weight} kg</Text>
                  <Text style={styles.prStatLbl}>Gewicht</Text>
                </View>
                <View style={styles.prDivider} />
                <View style={styles.prStat}>
                  <Text style={[styles.prStatVal, { color: theme.orange }]}>{pr.reps}</Text>
                  <Text style={styles.prStatLbl}>Reps</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 80 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', lineHeight: 36, marginBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },
  prCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 10, ...theme.shadow },
  prCardGold: { borderLeftWidth: 3, borderLeftColor: theme.orange },
  prHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  prRankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.cardSecondary, alignItems: 'center', justifyContent: 'center' },
  prRank: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  prName: { flex: 1, color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  prDate: { color: theme.textSecondary, fontSize: 11 },
  prStats: { flexDirection: 'row', alignItems: 'center' },
  prStat: { flex: 1, alignItems: 'center' },
  prStatVal: { fontSize: 20, fontWeight: '600' },
  prStatLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  prDivider: { width: 0.5, height: 30, backgroundColor: theme.border },
});