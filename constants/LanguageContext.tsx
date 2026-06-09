// constants/LanguageContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Lang = 'de' | 'en';

const translations = {
  de: {
    // General
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    close: 'Schließen',
    add: 'Hinzufügen',
    edit: 'Bearbeiten',
    done: 'Fertig',
    back: 'Zurück',
    loading: 'Laden...',
    error: 'Fehler',
    today: 'Heute',
    yesterday: 'Gestern',
    noData: 'Keine Daten',

    // Home
    home_greeting_night: 'Gute Nacht',
    home_greeting_morning: 'Guten Morgen',
    home_greeting_day: 'Guten Tag',
    home_greeting_evening: 'Guten Abend',
    home_welcome: 'Willkommen zurück',
    home_performance: 'Performance Score',
    home_optimal: 'Optimal',
    home_good: 'Gut',
    home_moderate: 'Moderat',
    home_low: 'Niedrig',
    home_no_entry: 'Kein Eintrag',
    home_sleep_last: 'Schlaf letzte Nacht',
    home_sleep_details: 'Schlaf Details',
    home_fall_asleep: 'Schlafen',
    home_wake_up: 'Aufwachen',
    home_energy: 'Energie & Body Battery',
    home_energy_high: '⚡ Hoch — bereit für intensives Training',
    home_energy_medium: '🔶 Moderat — leichte bis mittlere Belastung',
    home_energy_low: '🔋 Niedrig — Erholung empfohlen',
    home_energy_none: 'Noch kein Eintrag heute',
    home_energy_log: 'Energie eintragen',
    home_nutrition: 'Ernährung heute',
    home_nutrition_goal: 'Ziel',
    home_nutrition_reached: 'erreicht',
    home_nutrition_log: 'Mahlzeit eintragen',
    home_readiness: 'Trainingsbereitschaft',
    home_muscles_ready: 'Muskelgruppen erholt',
    home_start_training: 'Training starten',
    home_recovery: 'Recovery',
    home_habits: 'Habits heute',
    home_journal: 'Tagesnotiz schreiben',
    home_journal_title: 'Tagesnotiz',
    home_journal_placeholder: 'Wie war dein Tag?',
    home_journal_subtitle: 'Wie war dein Tag? Stimmung, Training, Gedanken.',
    home_todo: 'Heute erledigen',
    home_todo_sleep: 'Schlaf erfassen',
    home_todo_checkin: 'Daily Check-in',
    home_todo_battery: 'Body Battery',
    home_todo_journal: 'Tagesnotiz',
    home_streak: 'Tage',

    // Side Menu
    menu_appearance: 'Erscheinungsbild',
    menu_profile: 'Mein Profil',
    menu_achievements: 'Abzeichen',
    menu_history: 'Verlauf',
    menu_friends: 'Freunde',
    menu_photos: 'Fortschrittsfotos',
    menu_language: 'Sprache',

    // Training
    training_title: 'Training',
    training_start: 'Training starten',
    training_finish: 'Training beenden',
    training_duration: 'Dauer',
    training_exercises: 'Übungen',
    training_sets: 'Sätze',
    training_reps: 'Wiederholungen',
    training_weight: 'Gewicht',
    training_rest: 'Pause',
    training_pr: 'Persönlicher Rekord',
    training_score: 'Workout Score',
    training_calories: 'Kalorien verbrannt',
    training_add_exercise: 'Übung hinzufügen',
    training_complete: 'Workout abgeschlossen',
    training_streak: 'Streak',

    // Nutrition
    nutrition_title: 'Ernährung',
    nutrition_score: 'Nutrition Score',
    nutrition_history: 'Verlauf',
    nutrition_report: '📊 Report',
    nutrition_goal: 'Basis-Ziel',
    nutrition_burned: 'Verbrannt',
    nutrition_left: 'Übrig',
    nutrition_macros: 'Makros',
    nutrition_micros: 'Mikronährstoffe',
    nutrition_meals: 'Mahlzeiten',
    nutrition_breakfast: 'Frühstück',
    nutrition_lunch: 'Mittagessen',
    nutrition_dinner: 'Abendessen',
    nutrition_snacks: 'Snacks',
    nutrition_add: 'Kalorien eintragen',
    nutrition_barcode: 'Barcode scannen',
    nutrition_ai: 'KI-Foto',
    nutrition_gallery: 'Aus Galerie',
    nutrition_manual: 'Manuell',
    nutrition_goals: 'Tagesziele',
    nutrition_protein: 'Protein',
    nutrition_carbs: 'Kohlenhydrate',
    nutrition_fat: 'Fett',
    nutrition_kcal: 'Kalorien',
    nutrition_details: 'Details',
    nutrition_product: 'Verpacktes Produkt',
    nutrition_self: 'Selbst eintragen',
    nutrition_photo: 'Mahlzeit fotografieren',
    nutrition_from_gallery: 'Foto aus Bibliothek',
    nutrition_add_entry: 'Eintrag hinzufügen',
    nutrition_nothing: 'Noch nichts',
    nutrition_entries: 'Einträge',
    nutrition_entry: 'Eintrag',
    nutrition_ai_loading: 'KI analysiert Mahlzeit…',
    nutrition_ai_seconds: 'Das dauert ein paar Sekunden',
    nutrition_day_report: 'Tagesreport',
    nutrition_analyzing: 'KI analysiert deinen Tag…',
    nutrition_detected: '🍽 Mahlzeit erkannt',
    nutrition_correct: 'Stimmt das?',
    nutrition_fix: 'Korrigieren',
    nutrition_confirm: 'Hinzufügen ✓',

    // Health
    health_title: 'Health',
    health_hrv: 'HRV',
    health_pulse: 'Ruhepuls',
    health_recovery: 'Recovery',
    health_sleep: 'Schlaf',
    health_body: 'Körper',
    health_history: 'Verlauf',
    health_add: 'Eintragen',

    // Body
    body_title: 'Körper',
    body_recovery: 'Muskel\nRecovery',
    body_front: '▶ Vorderseite',
    body_back: '◀ Rückseite',
    body_legend: 'Recovery',
    body_ready: '✓ Bereit',
    body_warning: '⚠ Noch nicht erholt',
    body_warning_msg: 'heute schonen.',
    body_all: 'Alle Muskelgruppen',
    body_never: 'Nie trainiert',
    body_recovered: 'Erholt ✓',

    // Friends
    friends_title: 'Freunde',
    friends_code: 'Mein Friend-Code',
    friends_stats: 'Deine Stats',
    friends_ranking: 'Rangliste · Streak',
    friends_add: 'Freund hinzufügen',
    friends_share: 'Teilen',
    friends_remove: 'Entfernen',
    friends_empty: 'Noch keine Freunde',
    friends_refresh: 'Aktualisieren',

    // Progress Photos
    photos_title: 'Fortschrittsfotos',
    photos_current: 'Aktuell',
    photos_compare: 'Vergleich',
    photos_before: 'Vorher',
    photos_after: 'Jetzt',
    photos_add: 'Foto hinzufügen',
    photos_empty: 'Noch keine Fotos',
    photos_front: 'Vorne',
    photos_side: 'Seite',
    photos_back: 'Rücken',

    // Mood
    mood_bad: 'Schlecht',
    mood_ok: 'Mäßig',
    mood_okay: 'Okay',
    mood_good: 'Gut',
    mood_great: 'Super',

    // Scores
    score_best: 'Bester Tag',
    score_worst: 'Schwächster',
    score_avg: 'Durchschnitt',
  },

  en: {
    // General
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    add: 'Add',
    edit: 'Edit',
    done: 'Done',
    back: 'Back',
    loading: 'Loading...',
    error: 'Error',
    today: 'Today',
    yesterday: 'Yesterday',
    noData: 'No data',

    // Home
    home_greeting_night: 'Good Night',
    home_greeting_morning: 'Good Morning',
    home_greeting_day: 'Good Day',
    home_greeting_evening: 'Good Evening',
    home_welcome: 'Welcome back',
    home_performance: 'Performance Score',
    home_optimal: 'Optimal',
    home_good: 'Good',
    home_moderate: 'Moderate',
    home_low: 'Low',
    home_no_entry: 'No Entry',
    home_sleep_last: 'Last Night\'s Sleep',
    home_sleep_details: 'Sleep Details',
    home_fall_asleep: 'Bedtime',
    home_wake_up: 'Wake Up',
    home_energy: 'Energy & Body Battery',
    home_energy_high: '⚡ High — ready for intense training',
    home_energy_medium: '🔶 Moderate — light to medium load',
    home_energy_low: '🔋 Low — recovery recommended',
    home_energy_none: 'No entry today yet',
    home_energy_log: 'Log energy',
    home_nutrition: 'Today\'s Nutrition',
    home_nutrition_goal: 'Goal',
    home_nutrition_reached: 'reached',
    home_nutrition_log: 'Log meal',
    home_readiness: 'Training Readiness',
    home_muscles_ready: 'muscle groups recovered',
    home_start_training: 'Start Training',
    home_recovery: 'Recovery',
    home_habits: 'Today\'s Habits',
    home_journal: 'Write daily note',
    home_journal_title: 'Daily Note',
    home_journal_placeholder: 'How was your day?',
    home_journal_subtitle: 'How was your day? Mood, training, thoughts.',
    home_todo: 'Today\'s Tasks',
    home_todo_sleep: 'Log sleep',
    home_todo_checkin: 'Daily Check-in',
    home_todo_battery: 'Body Battery',
    home_todo_journal: 'Daily Note',
    home_streak: 'days',

    // Side Menu
    menu_appearance: 'Appearance',
    menu_profile: 'My Profile',
    menu_achievements: 'Achievements',
    menu_history: 'History',
    menu_friends: 'Friends',
    menu_photos: 'Progress Photos',
    menu_language: 'Language',

    // Training
    training_title: 'Training',
    training_start: 'Start Training',
    training_finish: 'Finish Workout',
    training_duration: 'Duration',
    training_exercises: 'Exercises',
    training_sets: 'Sets',
    training_reps: 'Reps',
    training_weight: 'Weight',
    training_rest: 'Rest',
    training_pr: 'Personal Record',
    training_score: 'Workout Score',
    training_calories: 'Calories burned',
    training_add_exercise: 'Add Exercise',
    training_complete: 'Workout Complete',
    training_streak: 'Streak',

    // Nutrition
    nutrition_title: 'Nutrition',
    nutrition_score: 'Nutrition Score',
    nutrition_history: 'History',
    nutrition_report: '📊 Report',
    nutrition_goal: 'Base Goal',
    nutrition_burned: 'Burned',
    nutrition_left: 'Remaining',
    nutrition_macros: 'Macros',
    nutrition_micros: 'Micronutrients',
    nutrition_meals: 'Meals',
    nutrition_breakfast: 'Breakfast',
    nutrition_lunch: 'Lunch',
    nutrition_dinner: 'Dinner',
    nutrition_snacks: 'Snacks',
    nutrition_add: 'Log calories',
    nutrition_barcode: 'Scan barcode',
    nutrition_ai: 'AI Photo',
    nutrition_gallery: 'From Gallery',
    nutrition_manual: 'Manual',
    nutrition_goals: 'Daily Goals',
    nutrition_protein: 'Protein',
    nutrition_carbs: 'Carbohydrates',
    nutrition_fat: 'Fat',
    nutrition_kcal: 'Calories',
    nutrition_details: 'Details',
    nutrition_product: 'Packaged product',
    nutrition_self: 'Enter manually',
    nutrition_photo: 'Photograph meal',
    nutrition_from_gallery: 'Photo from library',
    nutrition_add_entry: 'Add entry',
    nutrition_nothing: 'Nothing yet',
    nutrition_entries: 'entries',
    nutrition_entry: 'entry',
    nutrition_ai_loading: 'AI analyzing meal…',
    nutrition_ai_seconds: 'This takes a few seconds',
    nutrition_day_report: 'Day Report',
    nutrition_analyzing: 'AI analyzing your day…',
    nutrition_detected: '🍽 Meal detected',
    nutrition_correct: 'Is this correct?',
    nutrition_fix: 'Correct',
    nutrition_confirm: 'Add ✓',

    // Health
    health_title: 'Health',
    health_hrv: 'HRV',
    health_pulse: 'Resting Pulse',
    health_recovery: 'Recovery',
    health_sleep: 'Sleep',
    health_body: 'Body',
    health_history: 'History',
    health_add: 'Log',

    // Body
    body_title: 'Body',
    body_recovery: 'Muscle\nRecovery',
    body_front: '▶ Front',
    body_back: '◀ Back',
    body_legend: 'Recovery',
    body_ready: '✓ Ready',
    body_warning: '⚠ Not recovered yet',
    body_warning_msg: 'rest today.',
    body_all: 'All Muscle Groups',
    body_never: 'Never trained',
    body_recovered: 'Recovered ✓',

    // Friends
    friends_title: 'Friends',
    friends_code: 'My Friend Code',
    friends_stats: 'Your Stats',
    friends_ranking: 'Leaderboard · Streak',
    friends_add: 'Add Friend',
    friends_share: 'Share',
    friends_remove: 'Remove',
    friends_empty: 'No friends yet',
    friends_refresh: 'Refresh',

    // Progress Photos
    photos_title: 'Progress Photos',
    photos_current: 'Current',
    photos_compare: 'Compare',
    photos_before: 'Before',
    photos_after: 'Now',
    photos_add: 'Add photo',
    photos_empty: 'No photos yet',
    photos_front: 'Front',
    photos_side: 'Side',
    photos_back: 'Back',

    // Mood
    mood_bad: 'Bad',
    mood_ok: 'Poor',
    mood_okay: 'Okay',
    mood_good: 'Good',
    mood_great: 'Great',

    // Scores
    score_best: 'Best Day',
    score_worst: 'Weakest',
    score_avg: 'Average',
  },
};

type TranslationKey = keyof typeof translations.de;

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'de',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');

  useEffect(() => {
    AsyncStorage.getItem('appLanguage').then(l => {
      if (l === 'de' || l === 'en') setLangState(l);
    });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem('appLanguage', l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key] ?? translations.de[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export type { Lang, TranslationKey };
