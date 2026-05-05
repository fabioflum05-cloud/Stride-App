import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
    Modal, Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { theme } from '../../constants/theme';

// ─── Firebase REST API Config ─────────────────────────────────
const API_KEY = 'AIzaSyCv8NhB9ozbKcrGJccOPUmGxMed6IfD-D0';
const PROJECT_ID = 'strideapp-e1d8c';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─── Types ────────────────────────────────────────────────────
type AuthUser = { uid: string; email: string; idToken: string; refreshToken: string; };
type UserProfile = { uid: string; username: string; displayName: string; friends: string[]; friendRequests: string[]; };
type FeedItem = {
  id: string; uid: string; username: string; displayName: string;
  type: 'workout' | 'pr'; workoutName?: string; workoutScore?: number;
  duration?: number; exercises?: number; volume?: number;
  exerciseName?: string; newMax?: number; timestamp: number;
};
type PRData = { exerciseName: string; estimated1RM: number; weight: number; reps: number; };

// ─── Firestore Helpers ────────────────────────────────────────
function toFirestore(data: Record<string, any>): any {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(item =>
      typeof item === 'string' ? { stringValue: item } :
      typeof item === 'number' ? { integerValue: String(item) } :
      { mapValue: { fields: toFirestore(item).fields ?? {} } }
    )}};
    else if (v && typeof v === 'object') fields[k] = { mapValue: { fields: toFirestore(v).fields ?? {} } };
    else fields[k] = { nullValue: null };
  }
  return { fields };
}

function fromFirestore(doc: any): any {
  if (!doc?.fields) return {};
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
    if ('stringValue' in v) result[k] = v.stringValue;
    else if ('integerValue' in v) result[k] = Number(v.integerValue);
    else if ('doubleValue' in v) result[k] = v.doubleValue;
    else if ('booleanValue' in v) result[k] = v.booleanValue;
    else if ('arrayValue' in v) result[k] = (v.arrayValue.values || []).map((item: any) =>
      'stringValue' in item ? item.stringValue :
      'integerValue' in item ? Number(item.integerValue) :
      'mapValue' in item ? fromFirestore(item.mapValue) : null
    );
    else if ('mapValue' in v) result[k] = fromFirestore(v.mapValue);
    else result[k] = null;
  }
  return result;
}

async function fsGet(path: string, token: string): Promise<any | null> {
  try {
    const res = await fetch(`${FIRESTORE_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.name?.split('/').pop(), ...fromFirestore(data) };
  } catch { return null; }
}

async function fsSet(path: string, data: Record<string, any>, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE_URL}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(toFirestore(data)),
    });
    return res.ok;
  } catch { return false; }
}

async function fsAdd(col: string, data: Record<string, any>, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${FIRESTORE_URL}/${col}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(toFirestore(data)),
    });
    if (!res.ok) return null;
    const doc = await res.json();
    return doc.name?.split('/').pop() || null;
  } catch { return null; }
}

async function fsQuery(col: string, token: string): Promise<any[]> {
  try {
    const res = await fetch(`${FIRESTORE_URL}/${col}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map((d: any) => ({ id: d.name?.split('/').pop(), ...fromFirestore(d) }));
  } catch { return []; }
}

async function doRefreshToken(refreshTok: string): Promise<string | null> {
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshTok }),
    });
    const data = await res.json();
    return data.id_token || null;
  } catch { return null; }
}

// ─── Auth Screen ──────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password || !username || !displayName) { Alert.alert('Alle Felder ausfüllen'); return; }
    if (username.length < 3) { Alert.alert('Username mindestens 3 Zeichen'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) { Alert.alert('Fehler', data.error.message); setLoading(false); return; }
      const user: AuthUser = { uid: data.localId, email, idToken: data.idToken, refreshToken: data.refreshToken };
      await fsSet(`users/${user.uid}`, { uid: user.uid, username: username.toLowerCase(), displayName, email, friends: [], friendRequests: [] }, user.idToken);
      await AsyncStorage.setItem('authUser', JSON.stringify(user));
      onAuth(user);
    } catch { Alert.alert('Netzwerkfehler – prüfe deine Verbindung'); }
    setLoading(false);
  }

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Email und Passwort eingeben'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) { Alert.alert('Login fehlgeschlagen', 'Email oder Passwort falsch'); setLoading(false); return; }
      const user: AuthUser = { uid: data.localId, email, idToken: data.idToken, refreshToken: data.refreshToken };
      await AsyncStorage.setItem('authUser', JSON.stringify(user));
      onAuth(user);
    } catch { Alert.alert('Netzwerkfehler'); }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.authContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.authLogo}>🏋️</Text>
        <Text style={styles.authTitle}>StrideApp</Text>
        <Text style={styles.authSub}>{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</Text>
        <View style={styles.authTabs}>
          <TouchableOpacity style={[styles.authTab, mode === 'login' && styles.authTabActive]} onPress={() => setMode('login')}>
            <Text style={[styles.authTabText, mode === 'login' && { color: theme.blue }]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.authTab, mode === 'register' && styles.authTabActive]} onPress={() => setMode('register')}>
            <Text style={[styles.authTabText, mode === 'register' && { color: theme.blue }]}>Registrieren</Text>
          </TouchableOpacity>
        </View>
        {mode === 'register' && (
          <>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput style={styles.input} value={username} onChangeText={t => setUsername(t.toLowerCase().replace(/\s/g, ''))}
              placeholder="z.B. fabio_judo" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
            <Text style={styles.inputLabel}>Anzeigename</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName}
              placeholder="z.B. Fabio" placeholderTextColor={theme.textTertiary} />
          </>
        )}
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="email@beispiel.ch" placeholderTextColor={theme.textTertiary}
          keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.inputLabel}>Passwort</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Mindestens 6 Zeichen" placeholderTextColor={theme.textTertiary} secureTextEntry />
        <TouchableOpacity style={styles.authBtn} onPress={mode === 'login' ? handleLogin : handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>{mode === 'login' ? 'Einloggen' : 'Konto erstellen'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function FriendsScreen() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'feed' | 'friends' | 'compare'>('feed');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [compareUser, setCompareUser] = useState<UserProfile | null>(null);
  const [comparePRs, setComparePRs] = useState<PRData[]>([]);
  const [myPRs, setMyPRs] = useState<PRData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      const raw = await AsyncStorage.getItem('authUser');
      if (!raw) { setLoading(false); Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); return; }
      let user: AuthUser = JSON.parse(raw);

      // Also try loading cached profile from AsyncStorage for instant display
      const rawProfile = await AsyncStorage.getItem('profile');
      if (rawProfile) {
        const localProfile = JSON.parse(rawProfile);
        setProfile({
          uid: user.uid,
          username: localProfile.username || '',
          displayName: localProfile.name || user.email,
          friends: [],
          friendRequests: [],
        });
      }

      // Refresh token silently
      const newToken = await doRefreshToken(user.refreshToken);
      if (newToken) {
        user = { ...user, idToken: newToken };
        await AsyncStorage.setItem('authUser', JSON.stringify(user));
      }
      setAuthUser(user);
      await loadProfile(user);
      syncToFirebase(user);
    } catch (e) { /* show login */ }
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }

  async function loadProfile(user: AuthUser) {
    const prof = await fsGet(`users/${user.uid}`, user.idToken);
    if (!prof) return;
    setProfile(prof as UserProfile);
    const friendIds: string[] = prof.friends || [];
    const friendProfiles: UserProfile[] = [];
    for (const fid of friendIds) {
      const fp = await fsGet(`users/${fid}`, user.idToken);
      if (fp) friendProfiles.push(fp as UserProfile);
    }
    setFriends(friendProfiles);
    const reqIds: string[] = prof.friendRequests || [];
    const reqProfiles: UserProfile[] = [];
    for (const rid of reqIds) {
      const rp = await fsGet(`users/${rid}`, user.idToken);
      if (rp) reqProfiles.push(rp as UserProfile);
    }
    setFriendRequests(reqProfiles);
    await loadFeed(user, friendIds);
    const rawPR = await AsyncStorage.getItem('prHistory');
    if (rawPR) {
      const prHistory = JSON.parse(rawPR);
      setMyPRs(Object.entries(prHistory).map(([exerciseName, entries]: any) => {
        const best = entries.reduce((b: any, e: any) => e.estimated1RM > b.estimated1RM ? e : b);
        return { exerciseName, ...best };
      }));
    }
  }

  async function loadFeed(user: AuthUser, friendIds: string[]) {
    const allUids = [user.uid, ...friendIds];
    const allItems: FeedItem[] = [];
    for (const uid of allUids.slice(0, 5)) {
      const items = await fsQuery(`feed/${uid}/items`, user.idToken);
      allItems.push(...items.map((i: any) => ({ ...i, uid })));
    }
    allItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    setFeed(allItems.slice(0, 30));
  }

  async function syncToFirebase(user: AuthUser) {
    setSyncing(true);
    try {
      const rawWorkouts = await AsyncStorage.getItem('workouts');
      const rawWH = await AsyncStorage.getItem('workoutHistory');
      const rawPR = await AsyncStorage.getItem('prHistory');
      const prof = await fsGet(`users/${user.uid}`, user.idToken);
      if (rawWorkouts) {
        const workouts = JSON.parse(rawWorkouts);
        const last = workouts[workouts.length - 1];
        if (last?.exercises?.length > 0) {
          const wh = rawWH ? JSON.parse(rawWH) : [];
          const lastScore = wh[wh.length - 1]?.score || 0;
          const totalVolume = last.exercises.reduce((t: number, ex: any) =>
            t + ex.sets.reduce((s: number, set: any) =>
              s + parseFloat(set.reps || '0') * parseFloat(set.weight || '0'), 0), 0);
          const existing = await fsQuery(`feed/${user.uid}/items`, user.idToken);
          if (!existing.some((i: any) => i.workoutId === last.id)) {
            await fsAdd(`feed/${user.uid}/items`, {
              uid: user.uid, username: prof?.username || '', displayName: prof?.displayName || '',
              type: 'workout', workoutId: last.id, workoutName: last.name,
              workoutScore: lastScore, duration: last.duration,
              exercises: last.exercises.length, volume: Math.round(totalVolume),
              timestamp: Date.now(),
            }, user.idToken);
          }
        }
      }
      if (rawPR) {
        const prHistory = JSON.parse(rawPR);
        for (const [exerciseName, entries] of Object.entries(prHistory)) {
          const entryArr = entries as any[];
          const best = entryArr.reduce((b, e) => e.estimated1RM > b.estimated1RM ? e : b);
          await fsSet(`users/${user.uid}/prs/${exerciseName.replace(/[\s/]/g, '_')}`,
            { exerciseName, ...best }, user.idToken);
        }
      }
    } catch { /* silent */ }
    setSyncing(false);
  }

  async function searchUser() {
    if (!authUser || !searchUsername.trim()) return;
    const all = await fsQuery('users', authUser.idToken);
    const found = all.find((u: any) => u.username === searchUsername.toLowerCase().trim());
    if (!found) { Alert.alert('Kein User gefunden'); setSearchResult(null); return; }
    if (found.uid === authUser.uid) { Alert.alert('Das bist du selbst 😄'); return; }
    setSearchResult(found as UserProfile);
  }

  async function sendFriendRequest(toUid: string) {
    if (!authUser) return;
    const toProf = await fsGet(`users/${toUid}`, authUser.idToken);
    if (!toProf) return;
    if ((toProf.friends || []).includes(authUser.uid)) { Alert.alert('Ihr seid bereits Freunde'); return; }
    if ((toProf.friendRequests || []).includes(authUser.uid)) { Alert.alert('Anfrage bereits gesendet'); return; }
    await fsSet(`users/${toUid}`, { ...toProf, friendRequests: [...(toProf.friendRequests || []), authUser.uid] }, authUser.idToken);
    Alert.alert('Freundschaftsanfrage gesendet! ✅');
    setShowAddFriend(false); setSearchUsername(''); setSearchResult(null);
  }

  async function acceptRequest(fromUid: string) {
    if (!authUser || !profile) return;
    await fsSet(`users/${authUser.uid}`, { ...profile, friends: [...(profile.friends || []), fromUid], friendRequests: (profile.friendRequests || []).filter(id => id !== fromUid) }, authUser.idToken);
    const theirProf = await fsGet(`users/${fromUid}`, authUser.idToken);
    if (theirProf) await fsSet(`users/${fromUid}`, { ...theirProf, friends: [...(theirProf.friends || []), authUser.uid] }, authUser.idToken);
    await loadProfile(authUser);
    Alert.alert('Freundschaft akzeptiert! 🤝');
  }

  async function declineRequest(fromUid: string) {
    if (!authUser || !profile) return;
    const updated = { ...profile, friendRequests: (profile.friendRequests || []).filter(id => id !== fromUid) };
    await fsSet(`users/${authUser.uid}`, updated, authUser.idToken);
    setFriendRequests(prev => prev.filter(f => f.uid !== fromUid));
    setProfile(updated);
  }

  async function loadComparePRs(friend: UserProfile) {
    if (!authUser) return;
    setCompareUser(friend); setTab('compare');
    const prs = await fsQuery(`users/${friend.uid}/prs`, authUser.idToken);
    setComparePRs(prs as PRData[]);
  }

  function logout() {
    AsyncStorage.removeItem('authUser');
    setAuthUser(null); setProfile(null); setFriends([]); setFeed([]);
    fadeAnim.setValue(1);
  }

  function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
    return `vor ${Math.floor(diff / 86400)} Tagen`;
  }

  if (loading) return (
    <View style={styles.loadingCenter}>
      <ActivityIndicator size="large" color={theme.blue} />
      <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 13 }}>Laden...</Text>
    </View>
  );

  if (!authUser) return (
    <AuthScreen onAuth={async u => {
      setAuthUser(u);
      await loadProfile(u);
      syncToFirebase(u);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }} />
  );

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: theme.bg }, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Freunde</Text>
          <Text style={styles.headerName}>{profile?.displayName || '...'}</Text>
          {profile?.username ? (
            <Text style={styles.headerUsername}>@{profile.username}</Text>
          ) : (
            <Text style={[styles.headerUsername, { color: theme.orange }]}>Username im Profil setzen</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {syncing && <ActivityIndicator size="small" color={theme.blue} />}
          {friendRequests.length > 0 && (
            <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{friendRequests.length}</Text></View>
          )}
          <TouchableOpacity onPress={logout}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {friendRequests.length > 0 && (
        <View style={styles.requestBanner}>
          <Text style={styles.requestBannerTitle}>📬 Freundschaftsanfragen</Text>
          {friendRequests.map(req => (
            <View key={req.uid} style={styles.requestRow}>
              <View style={styles.avatarSmall}><Text style={styles.avatarText}>{req.displayName[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestName}>{req.displayName}</Text>
                <Text style={styles.requestUsername}>@{req.username}</Text>
              </View>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(req.uid)}><Text style={styles.acceptBtnText}>✓</Text></TouchableOpacity>
              <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(req.uid)}><Text style={styles.declineBtnText}>×</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.tabs}>
        {[{ key: 'feed', label: '📰 Feed' }, { key: 'friends', label: `👥 Freunde${friends.length > 0 ? ` (${friends.length})` : ''}` }, { key: 'compare', label: '📊 Vergleich' }].map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key as any)}>
            <Text style={[styles.tabText, tab === t.key && { color: theme.blue }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {feed.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📰</Text>
              <Text style={styles.emptyTitle}>Noch nichts im Feed</Text>
              <Text style={styles.emptySub}>Füge Freunde hinzu um ihre Trainings zu sehen</Text>
            </View>
          ) : feed.map((item, i) => (
            <View key={i} style={[styles.feedCard, { borderLeftColor: item.type === 'pr' ? '#FFD700' : theme.blue }]}>
              <View style={styles.feedHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName?.[0] || '?'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedName}>{item.displayName}{item.uid === authUser.uid && <Text style={{ color: theme.textTertiary }}> (du)</Text>}</Text>
                  <Text style={styles.feedTime}>{timeAgo(item.timestamp)}</Text>
                </View>
                {item.workoutScore !== undefined && item.workoutScore > 0 && (
                  <View style={[styles.scoreBadge, { backgroundColor: item.workoutScore >= 70 ? theme.green + '20' : theme.orange + '20', borderColor: item.workoutScore >= 70 ? theme.green : theme.orange }]}>
                    <Text style={[styles.scoreBadgeText, { color: item.workoutScore >= 70 ? theme.green : theme.orange }]}>{item.workoutScore}</Text>
                  </View>
                )}
              </View>
              {item.type === 'workout' && (
                <View>
                  <Text style={styles.feedWorkoutName}>🏋️ {item.workoutName}</Text>
                  <View style={styles.feedStats}>
                    {item.duration !== undefined && <View style={styles.feedStat}><Text style={[styles.feedStatVal, { color: theme.green }]}>{item.duration}min</Text><Text style={styles.feedStatLbl}>Dauer</Text></View>}
                    {item.exercises !== undefined && <View style={styles.feedStat}><Text style={[styles.feedStatVal, { color: theme.blue }]}>{item.exercises}</Text><Text style={styles.feedStatLbl}>Übungen</Text></View>}
                    {item.volume !== undefined && <View style={styles.feedStat}><Text style={[styles.feedStatVal, { color: theme.orange }]}>{item.volume}kg</Text><Text style={styles.feedStatLbl}>Volumen</Text></View>}
                  </View>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'friends' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.addFriendBtn} onPress={() => setShowAddFriend(true)}>
            <Text style={styles.addFriendBtnText}>+ Freund hinzufügen</Text>
          </TouchableOpacity>
          {friends.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyEmoji}>👥</Text><Text style={styles.emptyTitle}>Noch keine Freunde</Text><Text style={styles.emptySub}>Suche nach dem Username deiner Freunde</Text></View>
          ) : friends.map(f => (
            <View key={f.uid} style={styles.friendCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{f.displayName[0]}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.friendName}>{f.displayName}</Text><Text style={styles.friendUsername}>@{f.username}</Text></View>
              <TouchableOpacity style={styles.compareBtn} onPress={() => loadComparePRs(f)}><Text style={styles.compareBtnText}>PR Vergleich →</Text></TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'compare' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!compareUser ? (
            <View style={styles.empty}><Text style={styles.emptyEmoji}>📊</Text><Text style={styles.emptyTitle}>Freund auswählen</Text><Text style={styles.emptySub}>Geh zu "Freunde" und tippe auf "PR Vergleich"</Text></View>
          ) : (() => {
            const myMap: Record<string, PRData> = {}; myPRs.forEach(p => { myMap[p.exerciseName] = p; });
            const theirMap: Record<string, PRData> = {}; comparePRs.forEach(p => { theirMap[p.exerciseName] = p; });
            const allEx = Array.from(new Set([...Object.keys(myMap), ...Object.keys(theirMap)]));
            return (
              <>
                <Text style={styles.compareTitle}>Du vs. {compareUser.displayName}</Text>
                {allEx.map(exName => {
                  const myVal = myMap[exName]?.estimated1RM || 0;
                  const theirVal = theirMap[exName]?.estimated1RM || 0;
                  const maxVal = Math.max(myVal, theirVal, 1);
                  const iWin = myVal > theirVal; const tied = myVal === theirVal;
                  return (
                    <View key={exName} style={styles.compareCard}>
                      <Text style={styles.compareExName}>{exName}</Text>
                      <View style={styles.compareRow}>
                        <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[styles.compareVal, { color: iWin ? theme.green : theme.textSecondary }]}>{myVal > 0 ? `${myVal}kg` : '--'}</Text>
                          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${(myVal / maxVal) * 100}%` as any, backgroundColor: iWin ? theme.green : theme.blue, alignSelf: 'flex-end' }]} /></View>
                          <Text style={styles.compareLabel}>Du</Text>
                        </View>
                        <View style={styles.compareVs}><Text style={styles.compareVsText}>{tied ? '=' : iWin ? '>' : '<'}</Text></View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[styles.compareVal, { color: !iWin && !tied ? theme.red : theme.textSecondary }]}>{theirVal > 0 ? `${theirVal}kg` : '--'}</Text>
                          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${(theirVal / maxVal) * 100}%` as any, backgroundColor: !iWin && !tied ? theme.red : '#A78BFA' }]} /></View>
                          <Text style={styles.compareLabel}>{compareUser.displayName}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <Modal visible={showAddFriend} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Freund finden 🔍</Text>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={searchUsername} onChangeText={setSearchUsername}
                placeholder="z.B. fabio_judo" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
              <TouchableOpacity style={[styles.authBtn, { paddingHorizontal: 16, flex: 0 }]} onPress={searchUser}>
                <Text style={styles.authBtnText}>Suchen</Text>
              </TouchableOpacity>
            </View>
            {searchResult && (
              <View style={[styles.friendCard, { marginTop: 12 }]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{searchResult.displayName[0]}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.friendName}>{searchResult.displayName}</Text><Text style={styles.friendUsername}>@{searchResult.username}</Text></View>
                <TouchableOpacity style={styles.compareBtn} onPress={() => sendFriendRequest(searchResult!.uid)}><Text style={styles.compareBtnText}>Anfrage senden</Text></TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddFriend(false); setSearchResult(null); setSearchUsername(''); }}>
              <Text style={styles.cancelBtnText}>Schliessen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  authContainer: { flex: 1, backgroundColor: theme.bg },
  authContent: { padding: 24, paddingTop: 80 },
  authLogo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  authTitle: { color: theme.textPrimary, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  authSub: { color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  authTabs: { flexDirection: 'row', gap: 8, marginBottom: 24, backgroundColor: theme.card, borderRadius: 14, padding: 4 },
  authTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  authTabActive: { backgroundColor: theme.blueLight },
  authTabText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
  authBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  authBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: theme.bg },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerName: { color: theme.textPrimary, fontSize: 22, fontWeight: '600' },
  headerUsername: { color: theme.textSecondary, fontSize: 12 },
  notifBadge: { backgroundColor: theme.red, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  requestBanner: { backgroundColor: theme.blueLight, marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 8, gap: 8 },
  requestBannerTitle: { color: theme.blue, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  requestUsername: { color: theme.textSecondary, fontSize: 11 },
  acceptBtn: { backgroundColor: theme.greenLight, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: theme.green, fontSize: 16, fontWeight: '700' },
  declineBtn: { backgroundColor: '#FFEBEE', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: theme.red, fontSize: 20 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: theme.card, ...theme.shadow },
  tabActive: { backgroundColor: theme.blueLight },
  tabText: { color: theme.textSecondary, fontSize: 11, fontWeight: '500' },
  content: { flex: 1, paddingHorizontal: 20 },
  feedCard: { backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderLeftWidth: 3, ...theme.shadow },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  feedName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  feedTime: { color: theme.textSecondary, fontSize: 11 },
  feedWorkoutName: { color: theme.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  feedStats: { flexDirection: 'row', gap: 20 },
  feedStat: { alignItems: 'center' },
  feedStatVal: { fontSize: 16, fontWeight: '600' },
  feedStatLbl: { color: theme.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  scoreBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  scoreBadgeText: { fontSize: 14, fontWeight: '700' },
  addFriendBtn: { backgroundColor: theme.blue, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  addFriendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 14, padding: 14, marginBottom: 8, ...theme.shadow },
  friendName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  friendUsername: { color: theme.textSecondary, fontSize: 11 },
  compareBtn: { backgroundColor: theme.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  compareBtnText: { color: theme.blue, fontSize: 11, fontWeight: '600' },
  compareTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 16 },
  compareCard: { backgroundColor: theme.card, borderRadius: 14, padding: 14, marginBottom: 10, ...theme.shadow },
  compareExName: { color: theme.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareVal: { fontSize: 16, fontWeight: '700' },
  compareLabel: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' },
  compareVs: { width: 28, alignItems: 'center' },
  compareVsText: { color: theme.textSecondary, fontSize: 16, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: theme.cardSecondary, borderRadius: 4, overflow: 'hidden', width: '100%' },
  barFill: { height: 8, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  inputLabel: { color: theme.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { backgroundColor: theme.cardSecondary, borderRadius: 12, padding: 14, color: theme.textPrimary, fontSize: 15 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.textSecondary, fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },
});