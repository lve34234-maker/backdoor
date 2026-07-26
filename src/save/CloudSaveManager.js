import { firebaseConfig } from './firebaseConfig.js';

// Optional Firestore-backed cloud save. Entirely additive: when
// firebaseConfig is left blank (the default), `available` stays false and
// every method below is a safe no-op, so the game keeps working purely on
// LocalStorage. Fill in src/save/firebaseConfig.js with a real Firebase
// project to turn this on.

function isConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export class CloudSaveManager {
  constructor() {
    this.available = isConfigured();
    this.ready = false;
    this.uid = null;
    this._docRef = null;
    this._setDoc = null;
    this._getDoc = null;
    this.readyPromise = this.available ? this._init() : Promise.resolve(false);
  }

  async _init() {
    try {
      const [{ initializeApp }, authMod, storeMod] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore')
      ]);
      const app = initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = storeMod.getFirestore(app);

      await authMod.signInAnonymously(auth);
      const user = await new Promise((resolve) => {
        const unsubscribe = authMod.onAuthStateChanged(auth, (u) => {
          if (u) { unsubscribe(); resolve(u); }
        });
      });

      this.uid = user.uid;
      this._docRef = storeMod.doc(db, 'backdoorSaves', this.uid);
      this._getDoc = storeMod.getDoc;
      this._setDoc = storeMod.setDoc;
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('[BACKDOOR] Firebase cloud save unavailable, falling back to LocalStorage only:', err?.message || err);
      this.available = false;
      return false;
    }
  }

  async save(state) {
    if (!this.ready || !this._docRef) return false;
    try {
      await this._setDoc(this._docRef, { ...state, savedAt: Date.now() });
      return true;
    } catch (err) {
      console.warn('[BACKDOOR] Cloud save failed:', err?.message || err);
      return false;
    }
  }

  async load() {
    if (!this.ready || !this._docRef) return null;
    try {
      const snap = await this._getDoc(this._docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[BACKDOOR] Cloud load failed:', err?.message || err);
      return null;
    }
  }
}
