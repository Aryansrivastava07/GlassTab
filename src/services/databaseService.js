import {
    doc,
    setDoc,
    getDoc,
    getDocFromServer
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    getCachedUserData,
    cacheUserData,
    updateCachedSpeedDials,
    updateCachedFavorites,
    updateCachedWallpaper,
    updateCachedUserData,
    clearUserCache
} from '../utils/cacheService';
import { getLocalMedia } from '../utils/localMediaDb';
import { syncMediaToCloud } from './mediaService';

// Local reactive event dispatchers for instant 0ms UI updates across components (manual cloud sync only)
const GUEST_DISPATCH_EVENT = 'landing_page_guest_data_changed';
const LOCAL_DISPATCH_EVENT = 'landing_page_local_data_changed';
export const SYNC_STATUS_EVENT = 'landing_cloud_sync_meta_changed';

const CLOUD_SYNC_META_KEY = (uid) => `landing_cloud_sync_meta_${uid}`;

const notifyLocalListeners = (userId, data) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(LOCAL_DISPATCH_EVENT, { detail: { userId, data } })
    );
    window.dispatchEvent(
        new CustomEvent(SYNC_STATUS_EVENT, {
            detail: { userId, updatedAt: data?.updatedAt || null }
        })
    );
    if (!userId || userId === 'local_guest') {
        window.dispatchEvent(new CustomEvent(GUEST_DISPATCH_EVENT, { detail: data }));
    }
};

export const getCloudSyncMeta = (userId) => {
    if (!userId || userId === 'local_guest') {
        return { baseCloudUpdatedAt: null, lastPulledAt: null, lastPushedAt: null };
    }
    try {
        const raw = localStorage.getItem(CLOUD_SYNC_META_KEY(userId));
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return { baseCloudUpdatedAt: null, lastPulledAt: null, lastPushedAt: null };
};

export const saveCloudSyncMeta = (userId, partialMeta) => {
    if (!userId || userId === 'local_guest') return;
    try {
        const current = getCloudSyncMeta(userId);
        const next = { ...current, ...partialMeta };
        localStorage.setItem(CLOUD_SYNC_META_KEY(userId), JSON.stringify(next));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(SYNC_STATUS_EVENT, { detail: { userId, meta: next } })
            );
        }
    } catch {
        // ignore
    }
};

export const DEFAULT_GUEST_DATA = {
    speedDials: [
        { id: 1, name: 'Google', url: 'https://google.com', logo: 'https://www.google.com/s2/favicons?domain=google.com&sz=128' },
        { id: 2, name: 'YouTube', url: 'https://youtube.com', logo: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128' },
        { id: 3, name: 'GitHub', url: 'https://github.com', logo: 'https://www.google.com/s2/favicons?domain=github.com&sz=128' },
        { id: 4, name: 'ChatGPT', url: 'https://chatgpt.com', logo: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128' },
        { id: 5, name: 'Reddit', url: 'https://reddit.com', logo: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=128' },
        { id: 6, name: 'LinkedIn', url: 'https://linkedin.com', logo: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=128' },
        { id: 7, name: 'LeetCode', url: 'https://leetcode.com', logo: 'https://www.google.com/s2/favicons?domain=leetcode.com&sz=128' },
    ],
    favorites: [
        { id: 1, name: 'Gmail', url: 'https://mail.google.com', logo: 'https://www.google.com/s2/favicons?domain=mail.google.com&sz=128' },
        { id: 2, name: 'LinkedIn', url: 'https://linkedin.com', logo: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=128' },
        { id: 3, name: 'ChatGPT', url: 'https://chatgpt.com', logo: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128' },
        { id: 4, name: 'Instagram', url: 'https://instagram.com', logo: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128' },
    ],
    todos: [],
    notes: [],
    vaultNotes: [],
    customWidgets: [],
    wallpaper: null,
    wallpaperId: null,
    wallpaperType: 'image',
    wallpaperMediaId: null,
    widgetLayout: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

const getUserDoc = (userId) => doc(db, 'users', userId);

// Ensure local DB has baseline data synchronously (0ms, zero automatic cloud reads/writes)
export const getOrSeedLocalData = (userId) => {
    const uid = userId || 'local_guest';
    let cached = getCachedUserData(uid);
    if (!cached) {
        // Also seed from guest data if signing in locally for the first time
        const guest = uid !== 'local_guest' ? getCachedUserData('local_guest') : null;
        const now = new Date().toISOString();
        cached = guest
            ? { ...DEFAULT_GUEST_DATA, ...guest, updatedAt: guest.updatedAt || now }
            : { ...DEFAULT_GUEST_DATA, createdAt: now, updatedAt: now };
        cacheUserData(uid, cached);
    }
    return cached;
};

// Local-only initialization: returns local DB immediately without auto-pulling or auto-pushing Firebase
export const initializeUserData = async (userId) => {
    return getOrSeedLocalData(userId || 'local_guest');
};

export const getUserData = async (userId) => {
    return initializeUserData(userId);
};

// Add speed dial (local only + stamps updatedAt; pushed only when user clicks Push)
export const addSpeedDial = async (userId, speedDial) => {
    const uid = userId || 'local_guest';
    const data = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const newSpeedDial = {
        ...speedDial,
        id: Date.now(),
        createdAt: now
    };
    const updatedSpeedDials = [...(data.speedDials || []), newSpeedDial];
    const updated = { ...data, speedDials: updatedSpeedDials, updatedAt: now };

    updateCachedSpeedDials(uid, updatedSpeedDials);
    cacheUserData(uid, updated);
    notifyLocalListeners(uid, updated);

    return newSpeedDial;
};

// Delete speed dial (local only + stamps updatedAt)
export const deleteSpeedDial = async (userId, speedDialId) => {
    const uid = userId || 'local_guest';
    const data = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const updatedSpeedDials = (data.speedDials || []).filter((dial) => dial.id !== speedDialId);
    const updated = { ...data, speedDials: updatedSpeedDials, updatedAt: now };

    updateCachedSpeedDials(uid, updatedSpeedDials);
    cacheUserData(uid, updated);
    notifyLocalListeners(uid, updated);
};

// Add favorite (local only + stamps updatedAt)
export const addFavorite = async (userId, favorite) => {
    const uid = userId || 'local_guest';
    const data = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const newFavorite = {
        ...favorite,
        id: Date.now(),
        createdAt: now
    };
    const updatedFavorites = [...(data.favorites || []), newFavorite];
    const updated = { ...data, favorites: updatedFavorites, updatedAt: now };

    updateCachedFavorites(uid, updatedFavorites);
    cacheUserData(uid, updated);
    notifyLocalListeners(uid, updated);

    return newFavorite;
};

// Delete favorite (local only + stamps updatedAt)
export const deleteFavorite = async (userId, favoriteId) => {
    const uid = userId || 'local_guest';
    const data = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const updatedFavorites = (data.favorites || []).filter((fav) => fav.id !== favoriteId);
    const updated = { ...data, favorites: updatedFavorites, updatedAt: now };

    updateCachedFavorites(uid, updatedFavorites);
    cacheUserData(uid, updated);
    notifyLocalListeners(uid, updated);
};

// Update wallpaper (local only + stamps updatedAt; never pushes automatically)
export const updateWallpaper = async (userId, wallpaperUrl, extraMeta = {}) => {
    const uid = userId || 'local_guest';
    const data = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const patch = {
        wallpaper: wallpaperUrl,
        ...extraMeta,
        updatedAt: now
    };
    const updated = { ...data, ...patch };

    updateCachedWallpaper(uid, wallpaperUrl);
    updateCachedUserData(uid, patch);
    notifyLocalListeners(uid, updated);
};

// Update user data (local only + stamps updatedAt; never pushes automatically)
export const updateUserData = async (userId, userData) => {
    const uid = userId || 'local_guest';
    const existing = getOrSeedLocalData(uid);
    const now = new Date().toISOString();
    const payload = {
        ...userData,
        updatedAt: now
    };
    const merged = { ...existing, ...payload };

    updateCachedUserData(uid, payload);
    notifyLocalListeners(uid, merged);
    return merged;
};

// Local-only reactive subscription: emits cached local DB and listens to local updates + manual Pulls.
// Intentionally does NOT attach an automatic Firestore onSnapshot listener so changes on another
// browser never overwrite or affect this browser until the user explicitly clicks Pull.
export const subscribeToUserData = (userId, callback) => {
    const uid = userId || 'local_guest';

    const initial = getOrSeedLocalData(uid);
    let lastSerialized = JSON.stringify(initial);
    callback(initial);

    const localHandler = (e) => {
        if (e.detail?.userId === uid && e.detail?.data) {
            const nextStr = JSON.stringify(e.detail.data);
            if (nextStr !== lastSerialized) {
                lastSerialized = nextStr;
                callback(e.detail.data);
            }
        }
    };
    window.addEventListener(LOCAL_DISPATCH_EVENT, localHandler);

    return () => {
        window.removeEventListener(LOCAL_DISPATCH_EVENT, localHandler);
    };
};

// Clear user cache (for logout)
export const clearUserCacheOnLogout = (userId) => {
    clearUserCache(userId);
    if (userId && userId !== 'local_guest') {
        try {
            localStorage.removeItem(CLOUD_SYNC_META_KEY(userId));
        } catch {
            // ignore
        }
    }
};

const parseIsoMs = (iso) => {
    if (!iso) return 0;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
};

/**
 * Non-destructively inspect Firebase vs Local timestamps without altering local state.
 */
export const checkCloudSyncStatus = async (userId) => {
    if (!userId || userId === 'local_guest') {
        return {
            hasRemote: false,
            localUpdatedAt: getOrSeedLocalData('local_guest').updatedAt || null,
            remoteUpdatedAt: null,
            remoteSyncedAt: null,
            baseCloudUpdatedAt: null,
            status: 'guest',
        };
    }

    const localData = getOrSeedLocalData(userId);
    const localUpdatedAt = localData?.updatedAt || null;
    const meta = getCloudSyncMeta(userId);

    let snap;
    try {
        snap = await getDocFromServer(getUserDoc(userId));
    } catch {
        snap = await getDoc(getUserDoc(userId));
    }

    if (!snap.exists()) {
        return {
            hasRemote: false,
            localUpdatedAt,
            remoteUpdatedAt: null,
            remoteSyncedAt: null,
            baseCloudUpdatedAt: meta.baseCloudUpdatedAt || null,
            status: 'cloud_empty',
        };
    }

    const remoteData = snap.data() || {};
    const remoteUpdatedAt = remoteData.updatedAt || remoteData.syncedAt || null;
    const remoteSyncedAt = remoteData.syncedAt || remoteData.updatedAt || null;

    const baseMs = parseIsoMs(meta.baseCloudUpdatedAt);
    const localMs = parseIsoMs(localUpdatedAt);
    const remoteMs = parseIsoMs(remoteUpdatedAt);

    let status = 'in_sync';
    if (!baseMs) {
        if (remoteMs > localMs) status = 'cloud_newer';
        else if (localMs > remoteMs) status = 'local_newer';
        else status = 'in_sync';
    } else {
        const localChanged = localMs > baseMs;
        const remoteChanged = remoteMs > baseMs;
        if (localChanged && remoteChanged) status = 'diverged';
        else if (remoteChanged) status = 'cloud_newer';
        else if (localChanged) status = 'local_newer';
        else status = 'in_sync';
    }

    return {
        hasRemote: true,
        localUpdatedAt,
        remoteUpdatedAt,
        remoteSyncedAt,
        baseCloudUpdatedAt: meta.baseCloudUpdatedAt || null,
        status,
    };
};

/**
 * Manual PULL: Fetch synced Firebase snapshot from server and apply it into local storage
 * (overwrites local fields, widgetLayout, customWidgets, speed dials, favorites, notes, wallpaper).
 */
export const pullFromAccount = async (userId) => {
    if (!userId || userId === 'local_guest') {
        throw new Error('Sign in with your account first to pull from cloud.');
    }

    let snap;
    try {
        snap = await getDocFromServer(getUserDoc(userId));
    } catch {
        snap = await getDoc(getUserDoc(userId));
    }

    if (!snap.exists()) {
        throw new Error('No synced cloud snapshot found yet. Push from a browser first.');
    }

    const remoteData = snap.data() || {};
    const remoteTs = remoteData.updatedAt || remoteData.syncedAt || new Date().toISOString();
    const merged = {
        ...DEFAULT_GUEST_DATA,
        ...remoteData,
        updatedAt: remoteTs,
    };

    cacheUserData(userId, merged);

    try {
        if (merged.widgetLayout && typeof merged.widgetLayout === 'object') {
            localStorage.setItem(
                `landing_widget_layout_${userId}`,
                JSON.stringify(merged.widgetLayout)
            );
        } else {
            localStorage.removeItem(`landing_widget_layout_${userId}`);
        }
    } catch {
        // ignore
    }

    saveCloudSyncMeta(userId, {
        baseCloudUpdatedAt: remoteTs,
        lastPulledAt: new Date().toISOString(),
        remoteSyncedAt: remoteData.syncedAt || remoteTs,
    });

    notifyLocalListeners(userId, merged);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('landing_force_account_sync', {
                detail: { userId, userData: merged },
            })
        );
    }

    return {
        pulled: true,
        remoteUpdatedAt: remoteTs,
        remoteSyncedAt: remoteData.syncedAt || remoteTs,
        userData: merged,
    };
};

/**
 * Manual PUSH: Upload complete local state (including layout, wallpaper, uploaded file media if needed,
 * and timestamps) to Firebase so other browsers can pull it when ready.
 */
export const pushToAccount = async (userId) => {
    if (!userId || userId === 'local_guest') {
        throw new Error('Sign in with your account first to push to cloud.');
    }

    const localData = getOrSeedLocalData(userId);

    // Ensure latest widgetLayout from localStorage is captured
    let currentLayout = localData.widgetLayout || null;
    try {
        const rawLayout = localStorage.getItem(`landing_widget_layout_${userId}`);
        if (rawLayout) currentLayout = JSON.parse(rawLayout);
    } catch {
        // ignore
    }

    let wallpaperUrl = localData.wallpaper || null;
    let wallpaperMediaId = localData.wallpaperMediaId || null;
    let wallpaperType = localData.wallpaperType || 'image';
    const wallpaperId = localData.wallpaperId || null;
    let wallpaperUploadNote = null;

    // If user uploaded a local image/video wallpaper that hasn't been uploaded to cloud yet, upload it on Push
    if (wallpaperId && wallpaperId !== 'preset_default' && !wallpaperUrl && !wallpaperMediaId) {
        const localKey = `wallpaper_${userId}`;
        const localRec = await getLocalMedia(localKey);
        if (localRec?.blob) {
            const syncRes = await syncMediaToCloud({
                uid: userId,
                file: localRec.blob,
                scope: 'wallpaper',
                mediaId: wallpaperId,
                localKey,
            });
            wallpaperUrl = syncRes.remoteUrl || null;
            wallpaperMediaId = syncRes.firestoreMediaId || null;
            wallpaperType = localRec.mediaType || wallpaperType;
            wallpaperUploadNote = syncRes.note || null;
        }
    }

    const now = new Date().toISOString();
    const localUpdatedAt = localData.updatedAt || now;

    const fullSnapshot = {
        ...DEFAULT_GUEST_DATA,
        ...localData,
        wallpaper: wallpaperUrl,
        wallpaperId,
        wallpaperType,
        wallpaperMediaId,
        widgetLayout: currentLayout,
        updatedAt: localUpdatedAt,
        syncedAt: now,
    };

    await setDoc(getUserDoc(userId), fullSnapshot);

    cacheUserData(userId, fullSnapshot);
    saveCloudSyncMeta(userId, {
        baseCloudUpdatedAt: localUpdatedAt,
        lastPushedAt: now,
        remoteSyncedAt: now,
    });
    notifyLocalListeners(userId, fullSnapshot);

    return {
        pushed: true,
        updatedAt: localUpdatedAt,
        syncedAt: now,
        wallpaperUploadNote,
        userData: fullSnapshot,
    };
};

// Backward-compatible exports if anything still imports these names
export const syncFromAccount = pullFromAccount;
export const forceRefreshUserData = async (userId) => {
    return getOrSeedLocalData(userId || 'local_guest');
};
