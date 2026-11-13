// IndexedDB Binary Media Store for instant offline wallpapers & vault media (images + videos)
const DB_NAME = 'landing_page_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media';

let dbPromise = null;

const openMediaDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
};

/**
 * Save a Blob/File into IndexedDB for instant local loading.
 */
export const saveLocalMedia = async (key, blob, meta = {}) => {
  try {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const mimeType = meta.mimeType || blob?.type || 'application/octet-stream';
      const mediaType =
        meta.mediaType || (mimeType.startsWith('video/') ? 'video' : 'image');

      const record = {
        key,
        blob,
        mimeType,
        mediaType,
        name: meta.name || 'media',
        size: meta.size || blob?.size || 0,
        remoteUrl: meta.remoteUrl || null,
        wallpaperId: meta.wallpaperId || null,
        updatedAt: Date.now(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveLocalMedia failed:', err);
    return null;
  }
};

/**
 * Retrieve a stored media record from IndexedDB.
 */
export const getLocalMedia = async (key) => {
  try {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB getLocalMedia failed:', err);
    return null;
  }
};

/**
 * Delete a media record from IndexedDB.
 */
export const deleteLocalMedia = async (key) => {
  try {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB deleteLocalMedia failed:', err);
    return false;
  }
};

/**
 * Resolve a playable/displayable ObjectURL from IndexedDB if present.
 */
export const getLocalMediaObjectUrl = async (key) => {
  const record = await getLocalMedia(key);
  if (!record || !record.blob) return null;
  return {
    objectUrl: URL.createObjectURL(record.blob),
    mediaType: record.mediaType || (record.mimeType?.startsWith('video/') ? 'video' : 'image'),
    mimeType: record.mimeType,
    remoteUrl: record.remoteUrl,
    size: record.size,
    name: record.name,
  };
};
