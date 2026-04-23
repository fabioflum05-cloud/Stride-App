import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function BackButton() {
  return (
    <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
      <Text style={styles.text}>← Zurück</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 60,
    marginBottom: -20,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#5B4A8A',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});