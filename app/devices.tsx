import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { POLAR_CLIENT_ID, POLAR_CLIENT_SECRET } from '../constants/keys';
import { theme } from '../constants/theme';
import { fetchAndImportHealthData } from '../utils/applehealth';

WebBrowser.maybeCompleteAuthSession();

const POLAR_AUTH_URL = 'https://flow.polar.com/oauth2/authorization';
const POLAR_TOKEN_URL = 'https://polarremote.com/v2/oauth2/token';
const POLAR_API = 'https://www.polaraccesslink.com/v3';

const redirectUri = AuthSession.makeRedirectUri({ scheme: 'performanceapp', path: 'polar-callback' });

type PolarToken = { access_token: string; token_type: string; x_user_id: number };
type SyncResult = { sleep?: any; activity?: any; recharge?: any };
function AppleHealthCard() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('appleHealthData').then(raw => {
      if (raw) setLastSync(JSON.parse(raw).date);
    });
  }, []);

  async function sync() {
    setSyncing(true);
    const result = await fetchAndImportHealthData();
    setSyncing(false);
    if (result.success) {
      setLastSync(new Date().toISOString());
      Alert.alert('Sync erfolgreich!', result.message);
    } else {
      Alert.alert('Fehler', result.message);
    }
  }

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={[styles.deviceIcon, { backgroundColor: '#FF2D55' }]}>
          <Text style={styles.deviceIconText}>♥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>Apple Health</Text>
          <Text style={styles.deviceStatus}>{lastSync ? '● Verbunden' : '○ Nicht synchronisiert'}</Text>
        </View>
        <TouchableOpacity style={styles.connectBtn} onPress={sync} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.connectBtnText}>Sync</Text>}
        </TouchableOpacity>
      </View>
      {lastSync && <Text style={styles.lastSync}>{`Zuletzt: ${new Date(lastSync).toLocaleString('de-CH')}`}</Text>}
      <Text style={styles.deviceDesc}>Importiert Schlaf, HRV, Ruhepuls und Aktivität automatisch.</Text>
    </View>
  );
}
export default function DevicesScreen() {
  const [polarToken, setPolarToken] = useState<PolarToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncData, setSyncData] = useState<SyncResult>({});

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const raw = await AsyncStorage.getItem('polarToken');
    if (raw) setPolarToken(JSON.parse(raw));
    const sync = await AsyncStorage.getItem('polarLastSync');
    if (sync) setLastSync(sync);
    const data = await AsyncStorage.getItem('polarSyncData');
    if (data) setSyncData(JSON.parse(data));
  }

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: POLAR_CLIENT_ID,
      scopes: ['accesslink.read_all'],
      redirectUri,
      responseType: 'code',
    },
    { authorizationEndpoint: POLAR_AUTH_URL }
  );

  async function handleConnect() {
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success' && result.params.code) {
        const code = result.params.code;
        const tokenRes = await fetch(POLAR_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${POLAR_CLIENT_ID}:${POLAR_CLIENT_SECRET}`)}`,
          },
          body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`,
        });
        const token = await tokenRes.json();
        if (token.access_token) {
          // Register user with Polar
          await fetch(`${POLAR_API}/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.access_token}`,
            },
            body: JSON.stringify({ 'member-id': String(token.x_user_id) }),
          });
          await AsyncStorage.setItem('polarToken', JSON.stringify(token));
          setPolarToken(token);
          Alert.alert('Verbunden!', 'Polar Konto erfolgreich verknüpft.');
          syncData_();
        } else {
          Alert.alert('Fehler', 'Verbindung fehlgeschlagen.');
        }
      }
    } catch (e) {
      Alert.alert('Fehler', String(e));
    }
    setLoading(false);
  }

  async function syncData_() {
    if (!polarToken) return;
    setSyncing(true);
    try {
      const headers = { 'Authorization': `Bearer ${polarToken.access_token}`, 'Accept': 'application/json' };

      // Create transaction to pull new data
      const txRes = await fetch(`${POLAR_API}/users/${polarToken.x_user_id}/activity-transactions`, {
        method: 'POST', headers,
      });

      let activityData = null;
      if (txRes.ok) {
        const tx = await txRes.json();
        const txId = tx['transaction-id'];

        // Get activity list
        const listRes = await fetch(`${POLAR_API}/users/${polarToken.x_user_id}/activity-transactions/${txId}`, { headers });
        if (listRes.ok) {
          const list = await listRes.json();
          const activities = list['activity-log'] || [];

          if (activities.length > 0) {
            // Get latest activity
            const actRes = await fetch(activities[activities.length - 1], { headers });
            if (actRes.ok) activityData = await actRes.json();
          }

          // Commit transaction
          await fetch(`${POLAR_API}/users/${polarToken.x_user_id}/activity-transactions/${txId}`, {
            method: 'PUT', headers,
          });
        }
      }

      // Get sleep data
      let sleepData = null;
      const sleepTxRes = await fetch(`${POLAR_API}/users/${polarToken.x_user_id}/sleep`, { headers });
      if (sleepTxRes.ok) {
        const sleepList = await sleepTxRes.json();
        const nights = sleepList?.nights || [];
        if (nights.length > 0) sleepData = nights[nights.length - 1];
      }

      // Get nightly recharge
      let rechargeData = null;
      const rechargeRes = await fetch(`${POLAR_API}/users/${polarToken.x_user_id}/nightly-recharge`, { headers });
      if (rechargeRes.ok) {
        const rechargeList = await rechargeRes.json();
        const items = rechargeList?.['nightly-recharge-list'] || [];
        if (items.length > 0) rechargeData = items[items.length - 1];
      }

      const result: SyncResult = {
        sleep: sleepData,
        activity: activityData,
        recharge: rechargeData,
      };

      // Save to AsyncStorage and auto-fill sleep tab
      await AsyncStorage.setItem('polarSyncData', JSON.stringify(result));
      setSyncData(result);

      if (sleepData) {
        await importSleepData(sleepData);
      }

      const now = new Date().toISOString();
      await AsyncStorage.setItem('polarLastSync', now);
      setLastSync(now);

      Alert.alert('Sync erfolgreich!', `Schlaf, Aktivität und Recovery wurden importiert.`);
    } catch (e) {
      Alert.alert('Sync Fehler', String(e));
    }
    setSyncing(false);
  }

  async function importSleepData(sleep: any) {
    try {
      const sleepStart = new Date(sleep['sleep-start-time']);
      const sleepEnd = new Date(sleep['sleep-end-time']);
      const schlafMin = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / 60000);
      const hrv = sleep['hrv-avg'] || 0;
      const tiefsterPuls = sleep['heart-rate-avg'] || 50;

      const sleepScore = Math.min(100, Math.round(
        (Math.min(schlafMin / 480, 1) * 40) +
        (Math.min(hrv / 75, 1) * 30) +
        (Math.max(0, (65 - tiefsterPuls) / 25) * 30)
      ));

      const data = {
        bedHour: String(sleepStart.getHours()),
        bedMinute: String(sleepStart.getMinutes()).padStart(2, '0'),
        wakeHour: String(sleepEnd.getHours()),
        wakeMinute: String(sleepEnd.getMinutes()).padStart(2, '0'),
        schlafStunden: Math.round(schlafMin / 60 * 10) / 10,
        schlafMin,
        tiefsterPuls,
        avgPuls: tiefsterPuls,
        hrv,
        remZeit: (sleep['rem-sleep'] || 0) / 60,
        deepZeit: (sleep['deep-sleep'] || 0) / 60,
        sleepScore,
        date: new Date().toISOString(),
        source: 'polar',
      };

      await AsyncStorage.setItem('lastSleep', JSON.stringify(data));

      const rawHistory = await AsyncStorage.getItem('sleepHistory');
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      const today = new Date().toDateString();
      const filtered = history.filter((h: any) => new Date(h.date).toDateString() !== today);
      filtered.push(data);
      await AsyncStorage.setItem('sleepHistory', JSON.stringify(filtered));
    } catch { /* silent */ }
  }

  async function disconnect() {
    Alert.alert('Polar trennen?', 'Alle Polar-Daten werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Trennen', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('polarToken');
          await AsyncStorage.removeItem('polarSyncData');
          await AsyncStorage.removeItem('polarLastSync');
          setPolarToken(null); setSyncData({}); setLastSync(null);
        }
      }
    ]);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  const sleep = syncData.sleep;
  const activity = syncData.activity;
  const recharge = syncData.recharge;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerLabel}>Geräte</Text>
      <Text style={styles.title}>Verknüpfungen</Text>

      {/* Polar Card */}
      <View style={styles.deviceCard}>
        <View style={styles.deviceHeader}>
          <View style={[styles.deviceIcon, { backgroundColor: '#D00000' }]}>
            <Text style={styles.deviceIconText}>P</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deviceName}>Polar</Text>
            <Text style={styles.deviceStatus}>
              {polarToken ? '● Verbunden' : '○ Nicht verbunden'}
            </Text>
          </View>
          {polarToken ? (
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
              <Text style={styles.disconnectBtnText}>Trennen</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={loading || !request}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.connectBtnText}>Verbinden</Text>}
            </TouchableOpacity>
          )}
        </View>

        {polarToken && (
          <>
            {lastSync && (
              <Text style={styles.lastSync}>{`Zuletzt sync: ${formatDate(lastSync)}`}</Text>
            )}

            <TouchableOpacity style={styles.syncBtn} onPress={syncData_} disabled={syncing}>
              {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncBtnText}>Jetzt synchronisieren</Text>}
            </TouchableOpacity>

            {/* Sleep Data */}
            {sleep && (
              <View style={styles.dataSection}>
                <Text style={styles.dataSectionTitle}>Letzter Schlaf</Text>
                <View style={styles.dataRow}>
                  <View style={styles.dataStat}>
                    <Text style={[styles.dataVal, { color: theme.purple }]}>{`${Math.round((new Date(sleep['sleep-end-time']).getTime() - new Date(sleep['sleep-start-time']).getTime()) / 3600000 * 10) / 10}h`}</Text>
                    <Text style={styles.dataLbl}>Schlafdauer</Text>
                  </View>
                  {sleep['hrv-avg'] > 0 && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.blue }]}>{`${sleep['hrv-avg']} ms`}</Text>
                      <Text style={styles.dataLbl}>HRV</Text>
                    </View>
                  )}
                  {sleep['heart-rate-avg'] > 0 && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.pink }]}>{`${sleep['heart-rate-avg']} bpm`}</Text>
                      <Text style={styles.dataLbl}>Ø Puls</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Nightly Recharge */}
            {recharge && (
              <View style={styles.dataSection}>
                <Text style={styles.dataSectionTitle}>Nightly Recharge</Text>
                <View style={styles.dataRow}>
                  {recharge['ans-charge'] && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.green }]}>{recharge['ans-charge']}</Text>
                      <Text style={styles.dataLbl}>ANS Charge</Text>
                    </View>
                  )}
                  {recharge['hrv-avg-ms'] && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.blue }]}>{`${recharge['hrv-avg-ms']} ms`}</Text>
                      <Text style={styles.dataLbl}>HRV</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Activity */}
            {activity && (
              <View style={styles.dataSection}>
                <Text style={styles.dataSectionTitle}>Aktivität</Text>
                <View style={styles.dataRow}>
                  {activity.calories > 0 && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.orange }]}>{`${activity.calories} kcal`}</Text>
                      <Text style={styles.dataLbl}>Kalorien</Text>
                    </View>
                  )}
                  {activity.steps > 0 && (
                    <View style={styles.dataStat}>
                      <Text style={[styles.dataVal, { color: theme.green }]}>{activity.steps.toLocaleString()}</Text>
                      <Text style={styles.dataLbl}>Schritte</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {!polarToken && (
          <Text style={styles.deviceDesc}>
            Verbinde deine Polar-Uhr um Schlaf, HRV, Aktivität und Nightly Recharge automatisch zu importieren.
          </Text>
        )}
      </View>

     <AppleHealthCard />

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  headerLabel: { color: theme.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 60, marginBottom: 12 },
  title: { color: theme.textPrimary, fontSize: 28, fontWeight: '600', marginBottom: 20 },
  deviceCard: { backgroundColor: theme.card, borderRadius: 18, padding: 16, marginBottom: 12, ...theme.shadow },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  deviceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deviceIconText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  deviceName: { color: theme.textPrimary, fontSize: 16, fontWeight: '600' },
  deviceStatus: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  connectBtn: { backgroundColor: theme.blue, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disconnectBtn: { backgroundColor: theme.cardSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  disconnectBtnText: { color: theme.red, fontSize: 13, fontWeight: '500' },
  deviceDesc: { color: theme.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  lastSync: { color: theme.textTertiary, fontSize: 11, marginBottom: 10 },
  syncBtn: { backgroundColor: theme.blue, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  syncBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dataSection: { borderTopWidth: 0.5, borderTopColor: theme.borderLight, paddingTop: 12, marginTop: 4, marginBottom: 8 },
  dataSectionTitle: { color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: '600' },
  dataRow: { flexDirection: 'row', gap: 16 },
  dataStat: { alignItems: 'center' },
  dataVal: { fontSize: 18, fontWeight: '700' },
  dataLbl: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
});