// app/friends.tsx
// Friends Screen — Streak & Score Vergleich via Firebase

import BackButton from '@/components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs,
  query, setDoc, where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Modal, ScrollView,
  Share,
  Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { auth, db } from '../../constants/firebase';
import { useLanguage } from '../../constants/LanguageContext';
import { useAppTheme } from '../../constants/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FriendData {
  uid:          string;
  name:         string;
  friendCode:   string;
  streak:       number;
  perfScore:    number;
  workouts:     number;
  lastActive:   string; // ISO
  sport:        string;
  updatedAt:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateCode(uid: string): string {
  // 6-char alphanumeric from uid
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[(uid.charCodeAt(i % uid.length) + i * 7) % chars.length];
  }
  return code;
}

function calcStreak(workouts: any[]): number {
  const sorted = [...workouts]
    .filter(w => w.type === 'gym' || w.type === 'judo' || w.type === 'run')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (!sorted.length) return 0;
  let streak = 0;
  let check = new Date(); check.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const ds = check.toISOString().slice(0,10);
    const prev = new Date(check); prev.setDate(prev.getDate()-1);
    const ps = prev.toISOString().slice(0,10);
    if (sorted.some(w => w.date.slice(0,10) === ds)) { streak++; check = prev; }
    else if (i === 0 && sorted.some(w => w.date.slice(0,10) === ps)) { check = prev; }
    else break;
  }
  return streak;
}

function timeAgo(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (lang === 'en') {
    if (h < 1)  return 'Just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `${d}d ago`;
    return `${Math.floor(d/7)}w ago`;
  }
  if (h < 1)  return 'Gerade eben';
  if (h < 24) return `vor ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `vor ${d}T`;
  return `vor ${Math.floor(d/7)}W`;
}

function scoreColor(s: number): string {
  if (s >= 80) return '#4ADE80';
  if (s >= 60) return '#FBBF24';
  if (s > 0)   return '#F87171';
  return '#6B7280';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const { colors } = useAppTheme();
  const { t, lang } = useLanguage();
  const isDark    = colors.bg.startsWith('#0') || colors.bg.startsWith('#1') || colors.bg.startsWith('#2') || colors.bg === '#383838';
  const bg        = colors.bg;
  const card      = colors.card;
  const cardAlt   = colors.cardSecondary;
  const border    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const text      = isDark ? '#F5F0EE' : '#1A1209';
  const textMuted = isDark ? 'rgba(245,240,238,0.45)' : 'rgba(26,18,9,0.45)';
  const textDim   = isDark ? 'rgba(245,240,238,0.22)' : 'rgba(26,18,9,0.22)';

  const [myUid,       setMyUid]       = useState<string | null>(null);
  const [myCode,      setMyCode]      = useState('');
  const [myData,      setMyData]      = useState<FriendData | null>(null);
  const [friends,     setFriends]     = useState<FriendData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [addVisible,  setAddVisible]  = useState(false);
  const [inputCode,   setInputCode]   = useState('');
  const [addLoading,  setAddLoading]  = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // ── Init Firebase Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        let uid = await AsyncStorage.getItem('firebase_uid');
        if (!uid) {
          const cred = await signInAnonymously(auth);
          uid = cred.user.uid;
          await AsyncStorage.setItem('firebase_uid', uid);
        }
        setMyUid(uid);
        setMyCode(generateCode(uid));
      } catch (e) {
        console.error('Auth error:', e);
      }
    })();
  }, []);

  // ── Sync own data to Firebase ───────────────────────────────────────────────
  const syncMyData = useCallback(async (uid: string) => {
    setSyncing(true);
    try {
      const [rawProfile, rawWorkouts, rawCheckin] = await Promise.all([
        AsyncStorage.getItem('profile'),
        AsyncStorage.getItem('workouts'),
        AsyncStorage.getItem('lastCheckin'),
      ]);
      const profile  = rawProfile  ? JSON.parse(rawProfile)  : {};
      const workouts = rawWorkouts ? JSON.parse(rawWorkouts)  : [];
      const checkin  = rawCheckin  ? JSON.parse(rawCheckin)   : null;

      const streak    = calcStreak(workouts);
      const perfScore = checkin?.score ?? 0;
      const code      = generateCode(uid);

      const data: FriendData = {
        uid,
        name:       profile.name ?? 'Athlet',
        friendCode: code,
        streak,
        perfScore,
        workouts:   workouts.length,
        lastActive: new Date().toISOString(),
        sport:      profile.sport ?? 'Gym',
        updatedAt:  new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', uid), data);
      setMyData(data);
    } catch (e) {
      console.error('Sync error:', e);
    }
    setSyncing(false);
  }, []);

  // ── Load friends ────────────────────────────────────────────────────────────
  const loadFriends = useCallback(async (uid: string) => {
    try {
      const raw = await AsyncStorage.getItem('friend_uids');
      const uids: string[] = raw ? JSON.parse(raw) : [];
      if (!uids.length) { setFriends([]); setLoading(false); return; }

      const results: FriendData[] = [];
      for (const fuid of uids) {
        const snap = await getDoc(doc(db, 'users', fuid));
        if (snap.exists()) results.push(snap.data() as FriendData);
      }
      setFriends(results.sort((a,b) => b.streak - a.streak));
    } catch (e) {
      console.error('Load friends error:', e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!myUid) return;
    syncMyData(myUid);
    loadFriends(myUid);
    fade.setValue(0);
    Animated.timing(fade, { toValue:1, duration:400, useNativeDriver:true }).start();
  }, [myUid]));

  // ── Add friend by code ──────────────────────────────────────────────────────
  async function addFriend() {
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 6) { Alert.alert(lang === 'en' ? 'Invalid code' : 'Ungültiger Code', lang === 'en' ? 'Please enter a 6-digit code.' : 'Bitte 6-stelligen Code eingeben.'); return; }
    if (code === myCode)   { Alert.alert(lang === 'en' ? 'That\'s you 😄' : 'Das bist du 😄', lang === 'en' ? 'You can\'t add yourself.' : 'Du kannst dich nicht selbst hinzufügen.'); return; }
    setAddLoading(true);
    try {
      // Search by friendCode
      const q = query(collection(db, 'users'), where('friendCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert(lang === 'en' ? 'Not found' : 'Nicht gefunden', lang === 'en' ? 'No user found with this code.' : 'Kein Nutzer mit diesem Code gefunden.'); setAddLoading(false); return; }

      const friendDoc = snap.docs[0];
      const friendData = friendDoc.data() as FriendData;

      // Check already added
      const raw  = await AsyncStorage.getItem('friend_uids');
      const uids: string[] = raw ? JSON.parse(raw) : [];
      if (uids.includes(friendData.uid)) {
        Alert.alert(lang === 'en' ? 'Already added' : 'Bereits hinzugefügt', lang === 'en' ? `${friendData.name} is already in your list.` : `${friendData.name} ist schon in deiner Liste.`);
        setAddLoading(false);
        return;
      }

      uids.push(friendData.uid);
      await AsyncStorage.setItem('friend_uids', JSON.stringify(uids));
      setFriends(prev => [...prev, friendData].sort((a,b) => b.streak - a.streak));
      setAddVisible(false);
      setInputCode('');
      Alert.alert(lang === 'en' ? 'Friend added! 🎉' : 'Freund hinzugefügt! 🎉', lang === 'en' ? `${friendData.name} has been added.` : `${friendData.name} wurde hinzugefügt.`);
    } catch (e) {
      Alert.alert(t('error'), lang === 'en' ? 'Connection error. Please try again.' : 'Verbindungsfehler. Bitte nochmal versuchen.');
    }
    setAddLoading(false);
  }

  async function removeFriend(uid: string, name: string) {
    Alert.alert(lang === 'en' ? `Remove ${name}?` : `${name} entfernen?`, '', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('friends_remove'), style: 'destructive', onPress: async () => {
        const raw  = await AsyncStorage.getItem('friend_uids');
        const uids: string[] = raw ? JSON.parse(raw) : [];
        const updated = uids.filter(u => u !== uid);
        await AsyncStorage.setItem('friend_uids', JSON.stringify(updated));
        setFriends(prev => prev.filter(f => f.uid !== uid));
      }},
    ]);
  }

  async function shareCode() {
    await Share.share({
      message: lang === 'en'
        ? `Join my Stride friends list! My code: ${myCode}\n\nStride – Performance Tracking App`
        : `Tritt meiner Stride-Freundesliste bei! Mein Code: ${myCode}\n\nStride – Performance Tracking App`,
    });
  }

  // ── Leaderboard (me + friends sorted by streak) ─────────────────────────────
  const leaderboard: (FriendData & { isMe?: boolean })[] = [
    ...(myData ? [{ ...myData, isMe: true }] : []),
    ...friends,
  ].sort((a, b) => b.streak - a.streak);

  const cardStyle = { backgroundColor: card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: border, marginBottom: 12 };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <Animated.View style={{ opacity: fade }}>

          <BackButton />

          {/* ── Header ── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Social</Text>
              <Text style={{ fontSize: 30, fontWeight: '800', color: text, letterSpacing: -0.8 }}>{t('friends_title')}</Text>
            </View>
            <TouchableOpacity onPress={() => setAddVisible(true)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 24, lineHeight: 26, marginTop: -1 }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* ── Mein Code ── */}
          <View style={[cardStyle, { borderColor: colors.accent + '40' }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 10 }}>
              {t('friends_code')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {/* Big code display */}
              <View style={{ flex: 1, backgroundColor: cardAlt, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: border }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.accent, letterSpacing: 8 }}>{myCode}</Text>
              </View>
              <TouchableOpacity onPress={shareCode}
                style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: textMuted, textAlign: 'center', lineHeight: 18 }}>
              {lang === 'en' ? 'Share this code with friends so they can add you.' : 'Teile diesen Code mit Freunden damit sie dich hinzufügen können.'}
            </Text>
          </View>

          {/* ── Eigene Stats ── */}
          {myData && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 14 }}>
                {t('friends_stats')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatBox label="Streak" value={`${myData.streak}🔥`} color={myData.streak >= 7 ? '#F97316' : myData.streak >= 3 ? '#FBBF24' : textMuted} isDark={isDark} card={cardAlt} border={border} text={text} dim={textDim} />
                <StatBox label="Score" value={`${myData.perfScore}`} color={scoreColor(myData.perfScore)} isDark={isDark} card={cardAlt} border={border} text={text} dim={textDim} />
                <StatBox label="Trainings" value={`${myData.workouts}`} color={colors.accent} isDark={isDark} card={cardAlt} border={border} text={text} dim={textDim} />
              </View>
              {syncing && <Text style={{ color: textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>Syncing…</Text>}
            </View>
          )}

          {/* ── Leaderboard ── */}
          {leaderboard.length > 0 && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 14 }}>
                {t('friends_ranking')}
              </Text>
              {leaderboard.map((f, i) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal  = medals[i] ?? `${i+1}.`;
                return (
                  <TouchableOpacity key={f.uid}
                    onLongPress={() => !f.isMe && removeFriend(f.uid, f.name)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
                      borderBottomWidth: i < leaderboard.length - 1 ? 1 : 0,
                      borderBottomColor: border }}
                    activeOpacity={0.8}>

                    {/* Rank */}
                    <Text style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{medal}</Text>

                    {/* Avatar */}
                    <View style={{ width: 40, height: 40, borderRadius: 20,
                      backgroundColor: f.isMe ? colors.accent + '30' : cardAlt,
                      borderWidth: f.isMe ? 2 : 1,
                      borderColor: f.isMe ? colors.accent : border,
                      alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: f.isMe ? colors.accent : textMuted }}>
                        {f.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>{f.name}</Text>
                        {f.isMe && (
                          <View style={{ backgroundColor: colors.accent + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                            <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>DU</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: textDim, marginTop: 2 }}>
                        {f.sport} · {timeAgo(f.lastActive, lang)}
                      </Text>
                    </View>

                    {/* Streak + Score */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: f.streak >= 7 ? '#F97316' : f.streak >= 3 ? '#FBBF24' : textMuted }}>
                        {f.streak}🔥
                      </Text>
                      <Text style={{ fontSize: 11, color: scoreColor(f.perfScore), fontWeight: '600' }}>
                        {f.perfScore > 0 ? `⚡ ${f.perfScore}` : '—'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={{ color: textDim, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                {lang === 'en' ? 'Long press to remove a friend' : 'Lang drücken um Freund zu entfernen'}
              </Text>
            </View>
          )}

          {/* ── Empty State ── */}
          {friends.length === 0 && !loading && (
            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 40, borderStyle: 'dashed' }]}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>👥</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 6 }}>{t('friends_empty')}</Text>
              <Text style={{ fontSize: 13, color: textMuted, textAlign: 'center', marginBottom: 20 }}>
                {lang === 'en' ? 'Share your code or enter a friend\'s code.' : 'Teile deinen Code oder gib den Code eines Freundes ein.'}
              </Text>
              <TouchableOpacity onPress={() => setAddVisible(true)}
                style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('friends_add')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Refresh ── */}
          {myUid && (
            <TouchableOpacity onPress={() => { syncMyData(myUid); loadFriends(myUid); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
                backgroundColor: cardAlt, borderRadius: 16, borderWidth: 1, borderColor: border }}>
              <Text style={{ fontSize: 14 }}>🔄</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textMuted }}>{t('friends_refresh')}</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Add Friend Modal ── */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: text }}>{t('friends_add')}</Text>
              <TouchableOpacity onPress={() => { setAddVisible(false); setInputCode(''); }}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: cardAlt }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              {lang === 'en' ? 'Enter 6-digit code' : '6-stelligen Code eingeben'}
            </Text>
            <TextInput
              style={{ backgroundColor: cardAlt, borderRadius: 16, padding: 18, color: text,
                fontSize: 28, fontWeight: '800', letterSpacing: 8, textAlign: 'center',
                borderWidth: 1, borderColor: border, marginBottom: 20 }}
              value={inputCode}
              onChangeText={t => setInputCode(t.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              placeholderTextColor={textDim}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity onPress={addFriend} disabled={addLoading || inputCode.length !== 6}
              style={{ backgroundColor: inputCode.length === 6 ? colors.accent : cardAlt,
                borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: inputCode.length === 6 ? '#fff' : textDim, fontWeight: '800', fontSize: 16 }}>
                {addLoading ? (lang === 'en' ? 'Searching…' : 'Suche…') : t('friends_add')}
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: border }}>
              <Text style={{ fontSize: 11, color: textDim, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                {lang === 'en' ? 'Or share my code' : 'Oder meinen Code teilen'}
              </Text>
              <TouchableOpacity onPress={shareCode}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                  backgroundColor: cardAlt, borderRadius: 14, paddingVertical: 14,
                  borderWidth: 1, borderColor: border }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.accent, letterSpacing: 4 }}>{myCode}</Text>
                <Text style={{ fontSize: 13, color: textMuted }}>· {t('friends_share')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Stat Box ─────────────────────────────────────────────────────────────────
const StatBox: React.FC<{
  label: string; value: string; color: string;
  isDark: boolean; card: string; border: string; text: string; dim: string;
}> = ({ label, value, color, card, border, text, dim }) => (
  <View style={{ flex: 1, backgroundColor: card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: border }}>
    <Text style={{ fontSize: 20, fontWeight: '800', color, letterSpacing: -0.5 }}>{value}</Text>
    <Text style={{ fontSize: 9, color: dim, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontWeight: '600' }}>{label}</Text>
  </View>
);