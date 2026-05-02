import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

export default function BackButton() {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.back()}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.inner}>
        <Text style={styles.arrow}>‹</Text>
        <Text style={styles.label}>Zurück</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 56, marginBottom: 8, alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, ...theme.shadow },
  arrow: { color: theme.blue, fontSize: 20, fontWeight: '500', lineHeight: 22 },
  label: { color: theme.blue, fontSize: 14, fontWeight: '500' },
});