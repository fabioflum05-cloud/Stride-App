// constants/firebase.ts
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyCv8NhB9ozbKcrGJccOPUmGxMed6IfD-D0',
  authDomain:        'strideapp-e1d8c.firebaseapp.com',
  projectId:         'strideapp-e1d8c',
  storageBucket:     'strideapp-e1d8c.firebasestorage.app',
  messagingSenderId: '709025713919',
  appId:             '1:709025713919:web:852c1cfb8b51a7b66886ca',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;