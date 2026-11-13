import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import {
  saveLocalMedia,
  getLocalMedia,
  deleteLocalMedia,
} from '../utils/localMediaDb';

export const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024; // 25 MB threshold (images + videos)
export const MAX_VAULT_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB threshold (images + videos)
const CLOUDINARY_CONFIG_KEY = 'landing_cloudinary_config';

/**
 * Optional built-in fallback Cloudinary unsigned preset (used only when:
 * 1) User has not configured their own Cloudinary in Settings, AND
 * 2) Firebase Storage is unavailable on the Spark plan).
 * Replace cloudName + uploadPreset below with your Cloudinary unsigned preset
 * (restrict folder to "landing_page_ext" and max size 25MB in Cloudinary dashboard).
 */
export const DEFAULT_CLOUDINARY_FALLBACK = {
  cloudName: 'dctguawbh',
  uploadPreset: 'landing page',
};

export const getCloudinaryConfig = () => {
  try {
    const raw = localStorage.getItem(CLOUDINARY_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.cloudName && parsed?.uploadPreset) {
        return { ...parsed, isFallback: false };
      }
    }
  } catch {
    // ignore
  }
  if (DEFAULT_CLOUDINARY_FALLBACK.cloudName && DEFAULT_CLOUDINARY_FALLBACK.uploadPreset) {
    return { ...DEFAULT_CLOUDINARY_FALLBACK, isFallback: true };
  }
  return null;
};

export const getUserOnlyCloudinaryConfig = () => {
  try {
    const raw = localStorage.getItem(CLOUDINARY_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.cloudName && parsed?.uploadPreset) return parsed;
  } catch {
    // ignore
  }
  return null;
};

export const saveCloudinaryConfig = (cloudName, uploadPreset) => {
  if (!cloudName?.trim() || !uploadPreset?.trim()) {
    localStorage.removeItem(CLOUDINARY_CONFIG_KEY);
    return null;
  }
  const cfg = {
    cloudName: cloudName.trim(),
    uploadPreset: uploadPreset.trim(),
  };
  localStorage.setItem(CLOUDINARY_CONFIG_KEY, JSON.stringify(cfg));
  return cfg;
};

export const detectMediaType = (fileOrUrl, mimeHint = '') => {
  if (mimeHint?.startsWith('video/')) return 'video';
  if (typeof fileOrUrl === 'string') {
    const lower = fileOrUrl.toLowerCase();
    if (
      lower.startsWith('data:video/') ||
      /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(lower) ||
      lower.includes('/video/upload/')
    ) {
      return 'video';
    }
    return 'image';
  }
  if (fileOrUrl?.type?.startsWith('video/')) return 'video';
  return 'image';
};

export const formatBytes = (bytes) => {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Create a tiny Low-Quality Image Placeholder (LQIP) thumbnail replica (< 3KB)
 * for instant 0ms progressive blur-up rendering on page reload.
 */
export const generateImageThumbnail = (sourceImg, width = 64, height = 36) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(sourceImg, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.5) || canvas.toDataURL('image/jpeg', 0.5);
  } catch (err) {
    console.warn('Thumbnail generation skipped:', err.message);
    return null;
  }
};

export const generateFileThumbnail = async (file, width = 64, height = 36) => {
  if (!file) return null;

  if (file.type?.startsWith('image/')) {
    return new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const thumb = generateImageThumbnail(img, width, height);
        resolve(thumb);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      img.src = objUrl;
    });
  }

  if (file.type?.startsWith('video/')) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const objUrl = URL.createObjectURL(file);
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, width, height);
          URL.revokeObjectURL(objUrl);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } catch {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      video.src = objUrl;
    });
  }

  return null;
};

/**
 * Compress an image file cleanly so it fits inside a Firestore document (< 750KB)
 * when Firebase Storage bucket is unavailable on Spark plan.
 */
export const compressImageToDataUrl = (file, maxDimension = 1600, maxChars = 750000) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objUrl);
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Step down quality if still too big for Firestore 1MB limit
        while (dataUrl.length > maxChars && quality > 0.3) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 900000) {
          // One final dimension shrink
          canvas.width = Math.round(width * 0.65);
          canvas.height = Math.round(height * 0.65);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Failed to decode image'));
    };

    img.src = objUrl;
  });
};

const withTimeout = (promise, ms = 12000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Cloud storage request timed out')), ms)
    ),
  ]);

/**
 * Upload media to Cloudinary using an unsigned upload preset.
 */
const uploadToCloudinary = async (file, config, folderPath = '') => {
  const sendUpload = async (includeFolder) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', config.uploadPreset);
    if (includeFolder && folderPath) {
      formData.append('folder', folderPath);
    }

    return fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
      { method: 'POST', body: formData }
    );
  };

  let res = await sendUpload(true);
  // Some unsigned preset configurations disallow custom folder overrides; retry cleanly without folder if 400
  if (res.status === 400 && folderPath) {
    res = await sendUpload(false);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudinary upload failed: ${errText}`);
  }
  const data = await res.json();
  return data.secure_url;
};

/**
 * Save media locally into IndexedDB first (instant), then sync to cloud in background:
 * Priority: Cloudinary (if configured) -> Firebase Storage -> Firestore compressed image doc.
 */
export const saveMediaLocalFirst = async ({
  uid,
  file,
  scope = 'vault', // 'wallpaper' | 'vault'
  mediaId = `${Date.now()}`,
  maxBytes = MAX_VAULT_MEDIA_BYTES,
}) => {
  if (!file) throw new Error('No file selected');

  const isVideo = file.type?.startsWith('video/');
  const isImage = file.type?.startsWith('image/');
  if (!isVideo && !isImage) {
    throw new Error('Only image and video files are supported.');
  }

  if (file.size > maxBytes) {
    throw new Error(
      `File exceeds threshold limit of ${formatBytes(maxBytes)} (selected: ${formatBytes(file.size)}).`
    );
  }

  const mediaType = isVideo ? 'video' : 'image';
  const localKey = scope === 'wallpaper' ? `wallpaper_${uid}` : `vault_${uid}_${mediaId}`;

  // 1. Store full original binary in IndexedDB immediately
  await saveLocalMedia(localKey, file, {
    mimeType: file.type,
    mediaType,
    name: file.name,
    size: file.size,
    wallpaperId: scope === 'wallpaper' ? mediaId : null,
  });

  const objectUrl = URL.createObjectURL(file);

  return {
    localKey,
    objectUrl,
    mediaId,
    mediaType,
    mimeType: file.type,
    name: file.name,
    size: file.size,
  };
};

/**
 * Background cloud sync for an uploaded file (does NOT block UI).
 */
export const syncMediaToCloud = async ({
  uid,
  file,
  scope,
  mediaId,
  localKey,
}) => {
  if (!uid || uid === 'local_guest' || !file) {
    return { syncProvider: 'local', remoteUrl: null, firestoreMediaId: null };
  }

  const mediaType = file.type?.startsWith('video/') ? 'video' : 'image';
  const cloudCfg = getCloudinaryConfig();
  const folderPath = `landing_page_ext/${uid}/${scope}`;

  // 1. User's own configured Cloudinary (highest priority when explicitly set)
  if (cloudCfg && !cloudCfg.isFallback) {
    try {
      const remoteUrl = await withTimeout(uploadToCloudinary(file, cloudCfg, folderPath), 45000);
      await saveLocalMedia(localKey, file, {
        mimeType: file.type,
        mediaType,
        name: file.name,
        size: file.size,
        remoteUrl,
        wallpaperId: scope === 'wallpaper' ? mediaId : null,
      });
      return { syncProvider: 'cloudinary', remoteUrl, firestoreMediaId: null };
    } catch (err) {
      console.warn('User Cloudinary sync failed, falling back to Firebase:', err.message);
    }
  }

  // 2. Try Firebase Storage (supports both images & videos privately per user)
  if (storage) {
    try {
      const storagePath = `users/${uid}/${scope}/${mediaId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, storagePath);
      await withTimeout(
        uploadBytes(storageRef, file, { contentType: file.type }),
        mediaType === 'video' ? 45000 : 18000
      );
      const downloadUrl = await getDownloadURL(storageRef);

      await saveLocalMedia(localKey, file, {
        mimeType: file.type,
        mediaType,
        name: file.name,
        size: file.size,
        remoteUrl: downloadUrl,
        wallpaperId: scope === 'wallpaper' ? mediaId : null,
      });

      return {
        syncProvider: 'firebase-storage',
        remoteUrl: downloadUrl,
        storagePath,
        firestoreMediaId: null,
      };
    } catch (err) {
      console.warn('Firebase Storage unavailable or failed:', err.code || err.message);
    }
  }

  // 3. Fallback Cloudinary preset (when user didn't provide one & Firebase Storage is disabled)
  // Kept for wallpapers/public media (vault stays strictly in authenticated Firebase when possible)
  if (cloudCfg && cloudCfg.isFallback && scope === 'wallpaper') {
    try {
      const remoteUrl = await withTimeout(uploadToCloudinary(file, cloudCfg, folderPath), 45000);
      await saveLocalMedia(localKey, file, {
        mimeType: file.type,
        mediaType,
        name: file.name,
        size: file.size,
        remoteUrl,
        wallpaperId: mediaId,
      });
      return { syncProvider: 'cloudinary-fallback', remoteUrl, firestoreMediaId: null };
    } catch (err) {
      console.warn('Fallback Cloudinary sync failed:', err.message);
    }
  }

  // 4. Free Spark-plan Firestore compressed fallback (for images)
  if (mediaType === 'image') {
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const docId = scope === 'wallpaper' ? `wallpaper_${mediaId}` : `vault_${mediaId}`;
      await setDoc(doc(db, 'users', uid, 'media', docId), {
        dataUrl,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        name: file.name,
        wallpaperId: scope === 'wallpaper' ? mediaId : null,
        updatedAt: new Date().toISOString(),
      });
      return {
        syncProvider: 'firestore-image',
        remoteUrl: null,
        firestoreMediaId: docId,
      };
    } catch (fsErr) {
      console.warn('Firestore image fallback failed:', fsErr.message);
    }
  }

  return {
    syncProvider: 'local-only',
    remoteUrl: null,
    firestoreMediaId: null,
    note:
      mediaType === 'video'
        ? 'Video saved in local browser DB. Enable Firebase Storage or configure Cloudinary in Settings to sync videos across devices.'
        : 'Saved locally (offline). Will stay cached in browser DB.',
  };
};

/**
 * Fetch a remote media URL in the background and persist it in IndexedDB.
 */
export const cacheRemoteMediaToLocal = async (
  localKey,
  url,
  mediaTypeHint = null,
  wallpaperId = null
) => {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const detected = mediaTypeHint || (blob.type?.startsWith('video/') ? 'video' : detectMediaType(url));
    await saveLocalMedia(localKey, blob, {
      mimeType: blob.type,
      mediaType: detected,
      remoteUrl: url,
      wallpaperId,
    });
    return {
      objectUrl: URL.createObjectURL(blob),
      mediaType: detected,
    };
  } catch (err) {
    console.warn('Background media cache skipped:', err.message);
    return null;
  }
};

/**
 * Resolve media source locally first (~2ms) if version/URL matches; otherwise fetch remote or Firestore doc.
 */
export const resolveMediaSource = async ({
  uid,
  localKey,
  remoteUrl = null,
  firestoreMediaId = null,
  mediaTypeHint = 'image',
  expectedWallpaperId = null,
  forceRemote = false,
}) => {
  // 1. Check local IndexedDB first — only reuse if it matches expectedWallpaperId / remoteUrl
  if (localKey && !forceRemote) {
    const localRec = await getLocalMedia(localKey);
    if (localRec?.blob) {
      const idMatches = !expectedWallpaperId || localRec.wallpaperId === expectedWallpaperId;
      const urlMatches = !remoteUrl || !localRec.remoteUrl || localRec.remoteUrl === remoteUrl;
      if (idMatches && urlMatches) {
        return {
          src: URL.createObjectURL(localRec.blob),
          isObjectUrl: true,
          mediaType: localRec.mediaType || mediaTypeHint,
          fromLocal: true,
        };
      }
    }
  }

  // 2. Check remoteUrl (Firebase Storage / Cloudinary / custom URL) and cache locally
  if (remoteUrl) {
    const cached = await cacheRemoteMediaToLocal(localKey, remoteUrl, mediaTypeHint, expectedWallpaperId);
    if (cached) {
      return {
        src: cached.objectUrl,
        isObjectUrl: true,
        mediaType: cached.mediaType,
        fromLocal: false,
      };
    }
    return {
      src: remoteUrl,
      isObjectUrl: false,
      mediaType: detectMediaType(remoteUrl, ''),
      fromLocal: false,
    };
  }

  // 3. Check Firestore compressed media doc
  if (uid && uid !== 'local_guest' && firestoreMediaId) {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'media', firestoreMediaId));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.dataUrl) {
          // Persist into IndexedDB so next access is instant
          try {
            const resp = await fetch(data.dataUrl);
            const blob = await resp.blob();
            if (localKey) {
              await saveLocalMedia(localKey, blob, {
                mimeType: data.mimeType || 'image/jpeg',
                mediaType: data.mediaType || 'image',
                name: data.name || 'synced-image',
                wallpaperId: expectedWallpaperId || data.wallpaperId || null,
              });
            }
          } catch {
            // ignore
          }
          return {
            src: data.dataUrl,
            isObjectUrl: false,
            mediaType: data.mediaType || 'image',
            fromLocal: false,
          };
        }
      }
    } catch (err) {
      console.warn('Failed resolving Firestore media:', err.message);
    }
  }

  return null;
};

/**
 * Clean up both local IndexedDB and cloud storage when deleting an item.
 */
export const deleteMediaEverywhere = async ({
  uid,
  localKey,
  storagePath = null,
  firestoreMediaId = null,
}) => {
  if (localKey) {
    await deleteLocalMedia(localKey);
  }
  if (uid && uid !== 'local_guest') {
    if (storagePath && storage) {
      deleteObject(ref(storage, storagePath)).catch(() => {});
    }
    if (firestoreMediaId) {
      deleteDoc(doc(db, 'users', uid, 'media', firestoreMediaId)).catch(() => {});
    }
  }
};
