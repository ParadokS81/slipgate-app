import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Same Firebase project as MatchScheduler
const firebaseConfig = {
  apiKey: "AIzaSyAElazBT8eT13fT0wCO5K7z3-5D1z42ZBM",
  authDomain: "matchscheduler-dev.firebaseapp.com",
  projectId: "matchscheduler-dev",
  storageBucket: "matchscheduler-dev.firebasestorage.app",
  messagingSenderId: "340309534131",
  appId: "1:340309534131:web:77155fb67f95ec2816d7c6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Sign in with the custom token from the Discord OAuth cloud function */
export async function signInWithDiscord(customToken: string): Promise<User> {
  const credential = await signInWithCustomToken(auth, customToken);
  return credential.user;
}

/** Sign out */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/** Subscribe to auth state changes */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
