import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated, Dimensions, Platform, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useLanguage } from '../constants/LanguageContext';
import { useOnboarding } from '../constants/OnboardingContext';
import { initHealthKit } from '../utils/applehealth';

const SW = Dimensions.get('window').width;

const theme = {
  bg: '#1A1614', card: '#231F1C', cardSecondary: '#2E2825',
  border: 'rgba(255,255,255,0.07)' as string,
  orange: '#E8572A', orangeLight: 'rgba(232,87,42,0.15)' as string,
  orangeBorder: 'rgba(232,87,42,0.25)' as string,
  blue: '#4A9EFF', blueLight: 'rgba(74,158,255,0.15)' as string,
  green: '#34C759', greenLight: 'rgba(52,199,89,0.15)' as string,
  pink: '#EC4899',
  textPrimary: '#F5F0EE', textSecondary: 'rgba(245,240,238,0.45)' as string,
  textTertiary: 'rgba(245,240,238,0.22)' as string,
};

const GOALS = [
  { key: 'Masse aufbauen', tkey: 'onboarding_goal_masse', emoji: '💪' },
  { key: 'Stärker werden', tkey: 'onboarding_goal_kraft', emoji: '🏋️' },
  { key: 'Wettkampf', tkey: 'onboarding_goal_wettkampf', emoji: '🥇' },
  { key: 'Fett verlieren', tkey: 'onboarding_goal_abnehmen', emoji: '⚡' },
  { key: 'Gesundheit', tkey: 'onboarding_goal_gesundheit', emoji: '❤️' },
  { key: 'Performance', tkey: 'onboarding_goal_performance', emoji: '🚀' },
] as const;

// ─── Stride Logo ─────────────────────────────────────────────
function StrideLogo({ size = 80 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6B35" />
          <Stop offset="1" stopColor="#E8572A" />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} rx={24} fill="url(#lg)" />
      <Path d="M35 38C35 33 39 30 47 30H62C64 30 65 31 65 33C65 35 64 36 62 36H47C44 36 42 37 42 40C42 43 44 44 50 45C58 46 65 49 65 57C65 63 61 70 50 70H33C31 70 30 69 30 67C30 65 31 64 33 64H50C55 64 58 62 58 58C58 54 55 53 48 52C40 51 35 47 35 38Z"
        fill="white" />
    </Svg>
  );
}

// ─── Progress Dots ────────────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          height: 4, borderRadius: 2,
          width: i === current ? 24 : 6,
          backgroundColor: i === current ? theme.orange : theme.cardSecondary,
        }} />
      ))}
    </View>
  );
}

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { lang, setLang, t } = useLanguage();
  const { completeOnboarding } = useOnboarding();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  function goNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -SW, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(s => s + 1);
      slideAnim.setValue(SW);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  function goBack() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: SW, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(s => s - 1);
      slideAnim.setValue(-SW);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  async function connectHealth() {
    setHealthConnecting(true);
    try {
      const ok = await initHealthKit();
      setHealthConnected(ok);
    } catch {
      setHealthConnected(false);
    }
    setHealthConnecting(false);
  }

  async function finish() {
    if (!name.trim()) return;

    const profile = {
      name: name.trim(), username: '', age, weight, targetWeight: '',
      height, sport: 'Gym', goal, trainingType: '', trainingDaysPerWeek: '3',
    };
    try {
      await AsyncStorage.setItem('profile', JSON.stringify(profile));
      await AsyncStorage.setItem('onboardingDone', 'true');
    } catch {
      // even if persistence fails, let the user continue into the app
    }
    completeOnboarding();
    router.replace('/(tabs)' as any);
  }

  const canProceed = step === 3 ? name.trim().length > 0 && !!goal : true;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>

        {/* Step 0 – Willkommen */}
        {step === 0 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { justifyContent: 'center', flexGrow: 1, paddingTop: 0 }]}>
            <View style={styles.logoRow}>
              <StrideLogo size={84} />
            </View>
            <Text style={[styles.stepTitle, { textAlign: 'center' }]}>{t('onboarding_welcome_title')}</Text>
            <Text style={[styles.stepSub, { textAlign: 'center' }]}>{t('onboarding_welcome_subtitle')}</Text>

            <Text style={styles.langLabel}>{t('onboarding_choose_language')}</Text>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'de' && styles.langBtnActive]}
                onPress={() => setLang('de')} activeOpacity={0.85}>
                <Text style={[styles.langBtnText, lang === 'de' && { color: theme.orange }]}>🇩🇪 Deutsch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                onPress={() => setLang('en')} activeOpacity={0.85}>
                <Text style={[styles.langBtnText, lang === 'en' && { color: theme.orange }]}>🇬🇧 English</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* Step 1 – Features */}
        {step === 1 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>2 / {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>{t('onboarding_features_title')}</Text>
            <Text style={styles.stepSub}>{t('onboarding_features_subtitle')}</Text>

            <View style={styles.featureList}>
              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: theme.orangeLight }]}>
                  <Text style={{ fontSize: 24 }}>🏋️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t('onboarding_feature_training_title')}</Text>
                  <Text style={styles.featureDesc}>{t('onboarding_feature_training_desc')}</Text>
                </View>
              </View>
              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: theme.greenLight }]}>
                  <Text style={{ fontSize: 24 }}>❤️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t('onboarding_feature_health_title')}</Text>
                  <Text style={styles.featureDesc}>{t('onboarding_feature_health_desc')}</Text>
                </View>
              </View>
              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: theme.blueLight }]}>
                  <Text style={{ fontSize: 24 }}>🍎</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t('onboarding_feature_nutrition_title')}</Text>
                  <Text style={styles.featureDesc}>{t('onboarding_feature_nutrition_desc')}</Text>
                </View>
              </View>
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Step 2 – Apple Health */}
        {step === 2 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>3 / {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>{t('onboarding_health_title')}</Text>
            <Text style={styles.stepSub}>{t('onboarding_health_subtitle')}</Text>

            <View style={styles.healthCard}>
              <View style={[styles.featureIcon, { backgroundColor: theme.greenLight, marginBottom: 14 }]}>
                <Text style={{ fontSize: 28 }}>♥️</Text>
              </View>

              {Platform.OS !== 'ios' ? (
                <Text style={styles.healthUnavailable}>{t('onboarding_health_unavailable')}</Text>
              ) : healthConnected ? (
                <View style={styles.healthConnectedBadge}>
                  <Text style={styles.healthConnectedText}>{t('onboarding_health_connected')}</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.healthConnectBtn} onPress={connectHealth} disabled={healthConnecting} activeOpacity={0.85}>
                  {healthConnecting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.healthConnectBtnText}>{t('onboarding_health_connect')}</Text>}
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {/* Step 3 – Profil */}
        {step === 3 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepEyebrow}>4 / {TOTAL_STEPS}</Text>
            <Text style={styles.stepTitle}>{t('onboarding_profile_title')}</Text>
            <Text style={styles.stepSub}>{t('onboarding_profile_subtitle')}</Text>

            <Text style={styles.fieldLabel}>{t('onboarding_name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding_name_placeholder')}
              placeholderTextColor={theme.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('onboarding_age_label')}</Text>
                <TextInput style={styles.input} placeholder="25" placeholderTextColor={theme.textTertiary} value={age} onChangeText={setAge} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('onboarding_height_label')}</Text>
                <TextInput style={styles.input} placeholder="180" placeholderTextColor={theme.textTertiary} value={height} onChangeText={setHeight} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('onboarding_weight_label')}</Text>
                <TextInput style={styles.input} placeholder="75" placeholderTextColor={theme.textTertiary} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('onboarding_goal_label')}</Text>
            <View style={styles.goalGrid}>
              {GOALS.map(g => (
                <TouchableOpacity key={g.key}
                  style={[styles.goalCard, goal === g.key && styles.goalCardActive]}
                  onPress={() => setGoal(g.key)} activeOpacity={0.85}>
                  <Text style={styles.goalEmoji}>{g.emoji}</Text>
                  <Text style={[styles.goalLabel, goal === g.key && { color: theme.orange }]}>{t(g.tkey as any)}</Text>
                  {goal === g.key && (
                    <View style={styles.optionCheck}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 140 }} />
          </ScrollView>
        )}

      </Animated.View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <ProgressDots total={TOTAL_STEPS} current={step} />
        <View style={styles.bottomBtns}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>{t('onboarding_back')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled, { flex: step > 0 ? 2 : 1 }]}
            onPress={step === TOTAL_STEPS - 1 ? finish : goNext}
            activeOpacity={0.85}
            disabled={!canProceed}>
            <Text style={[styles.nextBtnText, !canProceed && { color: theme.textTertiary }]}>
              {step === TOTAL_STEPS - 1 ? t('onboarding_finish') : step === 0 ? t('onboarding_get_started') : t('onboarding_next')}
            </Text>
          </TouchableOpacity>
        </View>
        {step === 2 && !healthConnected && (
          <TouchableOpacity onPress={goNext} style={{ paddingTop: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.textTertiary, fontSize: 13 }}>{t('onboarding_health_skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 70 },

  logoRow: { alignItems: 'center', marginBottom: 32 },
  stepEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: theme.orange, marginBottom: 10 },
  stepTitle: { fontSize: 36, fontWeight: '800', color: theme.textPrimary, letterSpacing: -1, lineHeight: 42, marginBottom: 10 },
  stepSub: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 28 },

  langLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 12 },
  langRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  langBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.border },
  langBtnActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  langBtnText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },

  featureList: { gap: 12 },
  featureCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: theme.border },
  featureIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },

  healthCard: { backgroundColor: theme.card, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  healthConnectBtn: { backgroundColor: theme.orange, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, minWidth: 200, alignItems: 'center' },
  healthConnectBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  healthConnectedBadge: { backgroundColor: theme.greenLight, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  healthConnectedText: { color: theme.green, fontSize: 15, fontWeight: '700' },
  healthUnavailable: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: theme.card, borderRadius: 12, padding: 14, fontSize: 16, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  rowFields: { flexDirection: 'row', gap: 10 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: { width: (SW - 48 - 10) / 2, backgroundColor: theme.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.border },
  goalCardActive: { borderColor: theme.orange, backgroundColor: theme.orangeLight },
  goalEmoji: { fontSize: 26 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },
  optionCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center' },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16, backgroundColor: theme.bg, borderTopWidth: 0.5, borderTopColor: theme.border },
  bottomBtns: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  backBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  nextBtn: { backgroundColor: theme.orange, borderRadius: 14, padding: 15, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: theme.cardSecondary },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
