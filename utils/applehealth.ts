// utils/applehealth.ts
// Apple Health Integration — deaktiviert bis expo-health verfügbar ist

export async function initHealthKit(): Promise<boolean> {
  return false;
}

export async function fetchAndImportHealthData(): Promise<{ success: boolean; message: string }> {
  return { success: false, message: 'Apple Health Integration folgt in einem späteren Update.' };
}