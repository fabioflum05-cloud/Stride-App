import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

export default function ScoreRevealScreen() {
  const [score, setScore] = useState<number | null>(null);
  const [type, setType] = useState<'sleep' | 'checkin'>('sleep');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const rawSleep = await AsyncStorage.getItem('lastSleep');
    const rawCheckin = await AsyncStorage.getItem('lastCheckin');

    const today = new Date().toDateString();

    if (rawSleep) {
      const s = JSON.parse(rawSleep);
      if (new Date(s.date).toDateString() === today) {
        setScore(s.sleepScore);
        setType('sleep');
        animate();
        return;
      }
    }
    if (rawCheckin) {
      const c = JSON.parse(rawCheckin);
      if (new Date(c.date ?? '').toDateString() === today) {
        setScore(c.score);
        setType('checkin');
        animate();
      }
    }
  }

  function animate() {
    scaleAnim.setValue(0);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  const color = score && score >= 70 ? theme.green : score && score >= 50 ? theme.orange : theme.red;
  const bg = score && score >= 70 ? theme.greenLight : score && score >= 50 ? theme.orangeLight : '#FFEBEE';
  const label = type === 'sleep' ? 'Sleep Score' : 'Check-in Score';
  const emoji = score && score >= 70 ? '🎉' : score && score >= 50 ? '⚡' : '💪';
  const message = score && score >= 70
    ? 'Ausgezeichnet! Dein Körper ist top erholt.'
    : score && score >= 50
    ? 'Solide! Moderat trainieren heute.'
    : 'Erholung priorisieren – leicht halten.';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        <Text style={styles.emoji}>{emoji}</Text>

        <Animated.View style={[styles.scoreWrap, { backgroundColor: bg, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.scoreLabel}>{label}</Text>
          <Text style={[styles.score, { color }]}>{score ?? '--'}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </Animated.View>

        <Text style={styles.message}>{message}</Text>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: color }]}
            onPress={() => router.push('/' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Zum Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  content: { alignItems: 'center', gap: 20, width: '100%' },
  emoji: { fontSize: 60 },
  scoreWrap: { alignItems: 'center', borderRadius: 24, paddingHorizontal: 40, paddingVertical: 24, width: '100%' },
  scoreLabel: { color: theme.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  score: { fontSize: 80, fontWeight: '300', letterSpacing: -4 },
  scoreMax: { color: theme.textSecondary, fontSize: 16, marginTop: -10 },
  message: { color: theme.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btnRow: { width: '100%', gap: 10, marginTop: 10 },
  primaryBtn: { borderRadius: 16, padding: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { borderRadius: 16, padding: 14, alignItems: 'center', backgroundColor: theme.cardSecondary },
  secondaryBtnText: { color: theme.textSecondary, fontSize: 15, fontWeight: '500' },
});