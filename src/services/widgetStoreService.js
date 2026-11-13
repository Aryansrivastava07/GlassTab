import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';

const STORE_COLLECTION = 'widgetStore';
const STORE_CACHE_KEY = 'landing_widget_store_cache_v1';

/**
 * Checks whether the current Firebase user is signed in with Google.
 */
export const isGoogleSignedIn = (firebaseUser) => {
  if (!firebaseUser || !firebaseUser.uid || firebaseUser.uid === 'local_guest') {
    return false;
  }
  const providers = firebaseUser.providerData || [];
  if (providers.length === 0) {
    // Allow if cached Google user metadata doesn't expose providerData yet,
    // though Firestore writes still require an active Firebase Auth session.
    return Boolean(firebaseUser.email);
  }
  return providers.some((p) => p?.providerId === 'google.com');
};

export const getCachedStoreWidgets = () => {
  try {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cacheStoreWidgets = (items) => {
  try {
    localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
};

const sortStoreWidgets = (list) => {
  return [...list].sort((a, b) => {
    const installDiff = (b.installs || 0) - (a.installs || 0);
    if (installDiff !== 0) return installDiff;
    return String(b.updatedAt || b.publishedAt || '').localeCompare(
      String(a.updatedAt || a.publishedAt || '')
    );
  });
};

/**
 * Local-first real-time subscription to the Firebase Widget Store collection.
 */
export const subscribeToStoreWidgets = (callback) => {
  const initial = getCachedStoreWidgets();
  callback(initial);

  let unsubscribe = () => {};
  try {
    unsubscribe = onSnapshot(
      collection(db, STORE_COLLECTION),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const sorted = sortStoreWidgets(items);
        cacheStoreWidgets(sorted);
        callback(sorted);
      },
      (err) => {
        console.warn('Widget Store sync note:', err?.code || err?.message);
      }
    );
  } catch (err) {
    console.warn('Widget Store fallback to cache:', err?.message || err);
  }

  return () => unsubscribe();
};

/**
 * Publishes (or updates) a custom widget in the Firebase Widget Store.
 * Requires an active Google Sign-In Firebase session.
 */
export const publishWidgetToStore = async ({ widget, description, firebaseUser }) => {
  if (!isGoogleSignedIn(firebaseUser)) {
    throw new Error('Google Sign-In is required to publish widgets to the Store.');
  }
  if (!widget?.name?.trim()) {
    throw new Error('Give your widget a title before publishing.');
  }
  if (!description?.trim()) {
    throw new Error('Add a short description explaining what this widget does before publishing.');
  }
  if (!widget?.code?.trim()) {
    throw new Error('Widget code cannot be empty.');
  }

  const safeWidgetId = String(widget.id || `cw_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storeId = widget.storeId || `${firebaseUser.uid.slice(0, 10)}_${safeWidgetId}`;
  const now = new Date().toISOString();

  const payload = {
    id: storeId,
    sourceWidgetId: widget.id || safeWidgetId,
    name: widget.name.trim(),
    summary: description.trim(),
    sourceId: widget.sourceId || 'custom',
    width: Math.max(160, Number(widget.width) || 360),
    height: Math.max(100, Number(widget.height) || 210),
    code: widget.code,
    prompt: widget.description || '',
    authorUid: firebaseUser.uid,
    authorName: firebaseUser.displayName || firebaseUser.email || 'Creator',
    authorPhoto: firebaseUser.photoURL || null,
    updatedAt: now,
  };

  if (!widget.storeId) {
    payload.publishedAt = now;
    payload.installs = 0;
  }

  try {
    await setDoc(doc(db, STORE_COLLECTION, storeId), payload, { merge: true });
    return { ...payload, storeId };
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error(
        'Firestore permission denied for "widgetStore". Allow authenticated writes to widgetStore/{id} in Firebase Firestore Rules.'
      );
    }
    throw new Error(err?.message || 'Failed to publish widget to Firebase.');
  }
};

/**
 * Allows an author to remove their own widget from the Firebase Store.
 */
export const deleteStoreWidget = async (storeId, firebaseUser) => {
  if (!isGoogleSignedIn(firebaseUser)) {
    throw new Error('Sign in with Google to manage your published widgets.');
  }
  try {
    await deleteDoc(doc(db, STORE_COLLECTION, storeId));
  } catch (err) {
    throw new Error(err?.message || 'Failed to remove widget from Store.');
  }
};

/**
 * Increments install count in the background when a user adds a Store widget.
 */
export const recordStoreInstall = async (storeId) => {
  if (!storeId) return;
  try {
    await updateDoc(doc(db, STORE_COLLECTION, storeId), {
      installs: increment(1),
    });
  } catch {
    // Non-blocking telemetry; ignore if offline or guest
  }
};
