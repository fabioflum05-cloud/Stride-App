import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export default function MorningCheckin() {
  const [visible, setVisible] = useState(false);
  const [missingSleep, setMissingSleep] = useState(false);
  const [missingCheckin, setMissingCheckin] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    async function check() {
      const hour = new Date().getHours();
      if (hour < 5 || hour > 12) return;

      const snoozed = await AsyncStorage.getItem('morningSnooze');
      if (snoozed && new Date(snoozed).getTime() > Date.now()) return;

      const rawSleep = await AsyncStorage.getItem('lastSleep');
      const rawCheckin = await AsyncStorage.getItem('lastCheckin');

      const sleepDone = rawSleep ? isToday(JSON.parse(rawSleep).date ?? '') : false;
      const checkinDone = rawCheckin ? isToday(JSON.parse(rawCheckin).date ?? '') : false;

      if (!sleepDone || !checkinDone) {
        setMissingSleep(!sleepDone);
        setMissingCheckin(!checkinDone);
        setVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    }
    const timeout = setTimeout(check, 1500);
    return () => clearTimeout(timeout);
  }, []);

  async function snooze() {
    const snoozeUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await AsyncStorage.setItem('morningSnooze', snoozeUntil);
    setVisible(false);
  }

  function goToSleep() {
    setVisible(false);
    router.push('/(tabs)/sleep' as any);
  }

  function goToCheckin() {
    setVisible(false);
    router.push('/(tabs)/checkin' as any);
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.emoji}>🌅</Text>
          <Text style={styles.title}>Guten Morgen!</Text>
          <Text style={styles.subtitle}>Starte deinen Tag richtig – trag deine Daten ein.</Text>

          <View style={styles.missing}>
            {missingSleep && (
              <TouchableOpacity style={styles.actionBtn} onPress={goToSleep}>
                <Text style={styles.actionIcon}>🌙</Text>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Schlaf loggen</Text>
                  <Text style={styles.actionSub}>HRV, Puls, Schlafdauer</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
            )}
            {missingCheckin && (
              <TouchableOpacity style={styles.actionBtn} onPress={goToCheckin}>
                <Text style={styles.actionIcon}>⚡</Text>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Check-in ausfüllen</Text>
                  <Text style={styles.actionSub}>Energie, Stress, Motivation</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.snoozeBtn} onPress={snooze}>
            <Text style={styles.snoozeBtnText}>⏰ Erinnere mich in 15 Minuten</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={() => setVisible(false)}>
            <Text style={styles.dismissBtnText}>Später</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0D0A1A',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    color: '#E2D9F3',
    fontSize: 24,
    fontWeight: '500',
  },
  subtitle: {
    color: '#5B4A8A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  missing: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    color: '#E2D9F3',
    fontSize: 14,
    fontWeight: '500',
  },
  actionSub: {
    color: '#5B4A8A',
    fontSize: 11,
    marginTop: 2,
  },
  actionArrow: {
    color: '#A78BFA',
    fontSize: 16,
  },
  snoozeBtn: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  snoozeBtnText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 10,
  },
  dismissBtnText: {
    color: '#3D2E5C',
    fontSize: 13,
  },
});