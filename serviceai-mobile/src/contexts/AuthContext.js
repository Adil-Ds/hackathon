import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { ChatAPI, setChatAuthToken } from "../services/chatApi";

const AuthContext = createContext(null);

// ── Helper: sync Firebase user to PostgreSQL backend ─────────────────────────
async function syncToBackend(firebaseUser, profile) {
  try {
    const idToken = await firebaseUser.getIdToken(/* forceRefresh= */ false);
    setChatAuthToken(idToken);

    // Register display name in SQLite — always works, no PostgreSQL needed
    if (profile?.name) {
      ChatAPI.registerUserName(profile.name).catch(() => {});
    }

    // Create / update user row in PostgreSQL (best-effort, may fail if PG is down)
    await ChatAPI.syncUser(
      firebaseUser.uid,
      profile.email,
      profile.name,
      profile.role || "user",
      profile.phone || null,
    );

    // For providers: also create the provider profile in PostgreSQL
    if (profile.role === "provider") {
      try {
        await ChatAPI.onboardProvider({
          business_name: profile.businessName || profile.name,
          category:      profile.category    || "general",
          city:          profile.city        || "Lahore",
          area:          profile.area        || profile.city || "Lahore",
          bio:           profile.address     || null,
          experience_years: Number(profile.experienceYears) || 0,
          skills:        [],
          languages:     [],
          price_range:   {},
          website:       null,
          linkedin:      null,
          services:      [],
          availability:  [],
        });
      } catch (e) {
        // Provider profile may already exist — not a fatal error
        console.warn("[AuthContext] onboardProvider:", e.message);
      }
    }
  } catch (e) {
    // Backend sync is best-effort — never block the user
    console.warn("[AuthContext] backend sync failed:", e.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profile = await loadProfile(firebaseUser.uid);
        // Refresh backend token + re-register name on every app restart
        if (profile) {
          try {
            const idToken = await firebaseUser.getIdToken(false);
            setChatAuthToken(idToken);
            if (profile.name) ChatAPI.registerUserName(profile.name).catch(() => {});
          } catch (_) {}
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setChatAuthToken(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loadProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      setUserProfile(data);
      return data;
    }
    return null;
  }

  async function signUp({
    email, password, name, role,
    phone, category, city, area,
    businessName, experienceYears, address,
  }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    const profile = {
      uid:       cred.user.uid,
      email,
      name,
      role,
      createdAt: serverTimestamp(),
      ...(role === "provider" && {
        phone,
        category,
        city,
        area,
        businessName:    businessName || name,
        experienceYears: experienceYears || 0,
        address:         address || "",
        linkedProviderId: null,
      }),
    };

    await setDoc(doc(db, "users", cred.user.uid), profile);
    setUserProfile(profile);

    // Sync to PostgreSQL (non-blocking)
    await syncToBackend(cred.user, profile);

    return cred.user;
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadProfile(cred.user.uid);
    // Sync token to backend on login
    if (profile) await syncToBackend(cred.user, profile);
    return cred.user;
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setChatAuthToken(null);
    setUser(null);
    setUserProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
