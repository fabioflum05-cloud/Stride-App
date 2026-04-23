import BackButton from '@/components/BackButton';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WorkoutTimerScreen() {
  const [seconds, setSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const intervalRef = useRef<any>(null);
  const restRef = useRef<any>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  function startRest(duration: number) {
    setRestDuration(duration);
    setRestSeconds(duration);
    setIsResting(true);
    restRef.current = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          clearInterval(restRef.current);
          setIsResting(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  const restProgress = restDuration > 0 ? restSeconds / restDuration : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton />
      <Text style={styles.headerLabel}>Timer</Text>

      <View style={styles.mainTimer}>
        <Text style={styles.timerLabel}>Training läuft</Text>
        <Text style={styles.timerDisplay}>{formatTime(seconds)}</Text>
      </View>

      {isResting && (
        <View style={styles.restCard}>
          <Text style={styles.restLabel}>Pause</Text>
          <Text style={styles.restTimer}>{formatTime(restSeconds)}</Text>
          <View style={styles.restBarWrap}>
            <View style={[styles.restBar, { width: `${restProgress * 100}%` as any }]} />
          </View>
          <TouchableOpacity style={styles.skipBtn} onPress={() => {
            clearInterval(restRef.current);
            setIsResting(false);
          }}>
            <Text style={styles.skipBtnText}>Überspringen →</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isResting && (
        <>
          <Text style={styles.sectionTitle}>Pause starten</Text>
          <View style={styles.restBtns}>
            {[30, 60, 90, 120, 180].map(d => (
              <TouchableOpacity key={d} style={styles.restBtn} onPress={() => startRest(d)}>
                <Text style={styles.restBtnTime}>{d < 60 ? `${d}s` : `${d / 60}m`}</Text>
                <Text style={styles.restBtnLabel}>Pause</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07040F', paddingHorizontal: 20 },
  headerLabel: { color: '#5B4A8A', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24 },
  mainTimer: { alignItems: 'center', marginBottom: 32, backgroundColor: 'rgba(251,146,60,0.08)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(251,146,60,0.2)', padding: 32 },
  timerLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  timerDisplay: { color: '#FB923C', fontSize: 64, fontWeight: '500', fontVariant: ['tabular-nums'] },
  restCard: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)', padding: 24, alignItems: 'center', marginBottom: 24, gap: 12 },
  restLabel: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  restTimer: { color: '#A78BFA', fontSize: 48, fontWeight: '500', fontVariant: ['tabular-nums'] },
  restBarWrap: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  restBar: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 2 },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.1)' },
  skipBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '500' },
  sectionTitle: { color: '#5B4A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  restBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  restBtn: { flex: 1, minWidth: '18%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 14, alignItems: 'center' },
  restBtnTime: { color: '#E2D9F3', fontSize: 16, fontWeight: '500' },
  restBtnLabel: { color: '#5B4A8A', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
});