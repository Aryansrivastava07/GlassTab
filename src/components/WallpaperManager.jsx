import { DailyWallpaper, useWallpaperMode } from './DailyWallpaper';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateWallpaper, subscribeToUserData } from '../services/databaseService';
import { getCachedUserData, updateCachedWallpaper } from '../utils/cacheService';
import { getLocalMedia, deleteLocalMedia } from '../utils/localMediaDb';
import {
  resolveMediaSource,
  cacheRemoteMediaToLocal,
  detectMediaType,
  generateImageThumbnail,
} from '../services/mediaService';
import localWallpaper from '../assets/wallpaper-default.webp';
import { getStoredFeatures } from '../utils/featureToggleService';
import useReducedMotion from '../hooks/useReducedMotion';

const WALLPAPER_META_KEY = (uid) => `landing_wallpaper_meta_${uid}`;

export const saveWallpaperMeta = (uid, meta) => {
  try {
    if (!meta) {
      localStorage.removeItem(WALLPAPER_META_KEY(uid));
    } else {
      const existing = readWallpaperMeta(uid);
      const merged = {
        thumbnail: existing?.thumbnail || null,
        ...meta,
      };
      localStorage.setItem(WALLPAPER_META_KEY(uid), JSON.stringify(merged));
    }
  } catch {
    // ignore
  }
};

export const readWallpaperMeta = (uid) => {
  try {
    const raw = localStorage.getItem(WALLPAPER_META_KEY(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const PersonalWallpaper = ({ features, stillWallpaper }) => {
  const videoRef = useRef(null);
  const defaultWallpaper = localWallpaper;
  const { currentUser } = useAuth();
  const effectiveUid = currentUser?.uid || 'local_guest';
  const activeObjectUrlRef = useRef(null);

  const setActiveObjectUrl = (url, isBlobUrl) => {
    if (
      activeObjectUrlRef.current &&
      activeObjectUrlRef.current !== url &&
      activeObjectUrlRef.current.startsWith('blob:')
    ) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
    }
    activeObjectUrlRef.current = isBlobUrl ? url : null;
  };

  const initialMeta = readWallpaperMeta(effectiveUid);
  const [thumbnailSrc, setThumbnailSrc] = useState(() => initialMeta?.thumbnail || null);
  const [isFullLoaded, setIsFullLoaded] = useState(() => {
    if (initialMeta?.thumbnail) return false;
    if (initialMeta?.hasLocalBlob || initialMeta?.remoteUrl) return false;
    return true;
  });

  const handleFullImageLoaded = (e) => {
    setIsFullLoaded(true);
    // Auto-generate and cache replica thumbnail (< 3KB) if not yet created
    if (!thumbnailSrc && e?.target) {
      try {
        const thumb = generateImageThumbnail(e.target, 64, 36);
        if (thumb) {
          setThumbnailSrc(thumb);
          const currentMeta = readWallpaperMeta(effectiveUid) || {};
          saveWallpaperMeta(effectiveUid, {
            ...currentMeta,
            thumbnail: thumb,
          });
        }
      } catch (err) {
        console.warn('Thumbnail generation note:', err);
      }
    }
  };

  const handleFullVideoLoaded = (e) => {
    setIsFullLoaded(true);
    if (!thumbnailSrc && e?.target) {
      try {
        const thumb = generateImageThumbnail(e.target, 64, 36);
        if (thumb) {
          setThumbnailSrc(thumb);
          const currentMeta = readWallpaperMeta(effectiveUid) || {};
          saveWallpaperMeta(effectiveUid, {
            ...currentMeta,
            thumbnail: thumb,
          });
        }
      } catch (err) {
        console.warn('Video thumbnail generation note:', err);
      }
    }
  };

  // Synchronous initial state: avoid flashing 3.9MB default wallpaper if custom IndexedDB blob exists
  const [mediaState, setMediaState] = useState(() => {
    const meta = initialMeta;
    if (meta?.hasLocalBlob) {
      return { src: null, mediaType: meta.mediaType || 'image' };
    }
    const cachedData = getCachedUserData(effectiveUid);
    const cachedUrl = cachedData?.wallpaper;
    if (cachedUrl) {
      return {
        src: cachedUrl,
        mediaType: cachedData.wallpaperType || detectMediaType(cachedUrl),
      };
    }
    return { src: defaultWallpaper, mediaType: 'image' };
  });

  useEffect(() => {
    let cancelled = false;
    const localKey = `wallpaper_${effectiveUid}`;

    const applyLocalOrRemote = async (userData = null) => {
      try {
        // 1. Always check IndexedDB first (~1-2ms binary read, works 100% offline for images & videos)
        const localRec = await getLocalMedia(localKey);
        if (!cancelled && localRec?.blob) {
          const objUrl = URL.createObjectURL(localRec.blob);
          setActiveObjectUrl(objUrl, true);
          setMediaState({
            src: objUrl,
            mediaType: localRec.mediaType || (localRec.mimeType?.startsWith('video/') ? 'video' : 'image'),
          });
          saveWallpaperMeta(effectiveUid, {
            hasLocalBlob: true,
            mediaType: localRec.mediaType || 'image',
            remoteUrl: localRec.remoteUrl || userData?.wallpaper || null,
          });
          return;
        }

        // 2. Otherwise check synced userData (URL or Firestore media doc)
        const remoteUrl = userData?.wallpaper || getCachedUserData(effectiveUid)?.wallpaper || null;
        const firestoreMediaId = userData?.wallpaperMediaId || null;
        const typeHint = userData?.wallpaperType || (remoteUrl ? detectMediaType(remoteUrl) : 'image');

        if (remoteUrl || firestoreMediaId) {
          // If it's a bundled asset or immediate URL, display right away before caching
          if (remoteUrl && !cancelled) {
            setActiveObjectUrl(null, false);
            setMediaState({ src: remoteUrl, mediaType: typeHint });
          }

          const resolved = await resolveMediaSource({
            uid: effectiveUid,
            localKey,
            remoteUrl,
            firestoreMediaId,
            mediaTypeHint: typeHint,
          });

          if (!cancelled && resolved?.src) {
            setActiveObjectUrl(resolved.src, resolved.isObjectUrl);
            setMediaState({
              src: resolved.src,
              mediaType: resolved.mediaType || typeHint,
            });
            saveWallpaperMeta(effectiveUid, {
              hasLocalBlob: Boolean(resolved.isObjectUrl),
              mediaType: resolved.mediaType || typeHint,
              remoteUrl,
            });
          }
          return;
        }

        // 3. Fallback to bundled default wallpaper
        if (!cancelled) {
          saveWallpaperMeta(effectiveUid, null);
          setActiveObjectUrl(null, false);
          setMediaState({ src: defaultWallpaper, mediaType: 'image' });
        }
      } catch (err) {
        console.warn('Wallpaper load note:', err.message);
        if (!cancelled) {
          setMediaState({ src: defaultWallpaper, mediaType: 'image' });
        }
      }
    };

    // Immediate IndexedDB check + background Firestore sync listener
    applyLocalOrRemote();

    let lastSyncedUrl = getCachedUserData(effectiveUid)?.wallpaper || null;
    let lastSyncedMediaId = getCachedUserData(effectiveUid)?.wallpaperMediaId || null;
    let lastSyncedWallpaperId = getCachedUserData(effectiveUid)?.wallpaperId || null;

    const applySyncedUserData = async (userData, forceRemote = false) => {
      if (!userData || cancelled) return;
      const nextUrl = userData.wallpaper || null;
      const nextMediaId = userData.wallpaperMediaId || null;
      const nextWallpaperId = userData.wallpaperId || null;

      const changed =
        forceRemote ||
        nextUrl !== lastSyncedUrl ||
        nextMediaId !== lastSyncedMediaId ||
        nextWallpaperId !== lastSyncedWallpaperId;

      if (!changed) return;

      lastSyncedUrl = nextUrl;
      lastSyncedMediaId = nextMediaId;
      lastSyncedWallpaperId = nextWallpaperId;

      // Reset to default only if explicitly requested as preset_default or completely empty
      if (nextWallpaperId === 'preset_default' || (!nextUrl && !nextMediaId && !nextWallpaperId)) {
        await deleteLocalMedia(localKey);
        saveWallpaperMeta(effectiveUid, null);
        if (!cancelled) {
          setActiveObjectUrl(null, false);
          setMediaState({ src: defaultWallpaper, mediaType: 'image' });
        }
        return;
      }

      // If user uploaded a local image or video (local blob in IndexedDB, no remote URL yet)
      if (!nextUrl && !nextMediaId && nextWallpaperId) {
        const localRec = await getLocalMedia(localKey);
        if (!cancelled && localRec?.blob) {
          const objUrl = URL.createObjectURL(localRec.blob);
          setActiveObjectUrl(objUrl, true);
          setMediaState({
            src: objUrl,
            mediaType: localRec.mediaType || 'image',
          });
          saveWallpaperMeta(effectiveUid, {
            hasLocalBlob: true,
            wallpaperId: nextWallpaperId,
            mediaType: localRec.mediaType || 'image',
            remoteUrl: null,
          });
          return;
        }
      }

      const resolved = await resolveMediaSource({
        uid: effectiveUid,
        localKey,
        expectedWallpaperId: nextWallpaperId,
        remoteUrl: nextUrl,
        firestoreMediaId: nextMediaId,
        mediaTypeHint: userData.wallpaperType || detectMediaType(nextUrl || ''),
        forceRemote,
      });
      if (!cancelled && resolved?.src) {
        setActiveObjectUrl(resolved.src, resolved.isObjectUrl);
        setMediaState({
          src: resolved.src,
          mediaType: resolved.mediaType,
        });
        saveWallpaperMeta(effectiveUid, {
          hasLocalBlob: Boolean(resolved.isObjectUrl),
          wallpaperId: nextWallpaperId,
          mediaType: resolved.mediaType,
          remoteUrl: nextUrl,
        });
      }
    };

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      applySyncedUserData(userData, false);
    });

    // Listen for explicit "Sync from Account" trigger
    const handleForceAccountSync = (event) => {
      const detail = event.detail || {};
      if (detail.userId === effectiveUid && detail.userData) {
        applySyncedUserData(detail.userData, true);
      }
    };

    // Listen for immediate local updates from Sidebar
    const handleWallpaperUpdate = (event) => {
      const detail = event.detail || {};
      const nextSrc = detail.wallpaper;
      const nextWallpaperId = detail.wallpaperId || null;
      const nextType = detail.mediaType || detectMediaType(nextSrc || '');

      if (!nextSrc || nextWallpaperId === 'preset_default') {
        saveWallpaperMeta(effectiveUid, null);
        setActiveObjectUrl(null, false);
        setThumbnailSrc(null);
        setIsFullLoaded(true);
        setMediaState({ src: defaultWallpaper, mediaType: 'image' });
        return;
      }

      const isBlob = nextSrc.startsWith('blob:');
      setActiveObjectUrl(nextSrc, isBlob);
      if (detail.thumbnail) {
        setThumbnailSrc(detail.thumbnail);
      }
      setIsFullLoaded(false);
      setMediaState({ src: nextSrc, mediaType: nextType });
      saveWallpaperMeta(effectiveUid, {
        hasLocalBlob: isBlob,
        wallpaperId: nextWallpaperId,
        mediaType: nextType,
        remoteUrl: isBlob ? null : nextSrc,
        thumbnail: detail.thumbnail || null,
      });

      // Background cache if it's an external URL
      if (!isBlob && !nextSrc.startsWith('data:') && /^https?:/i.test(nextSrc)) {
        cacheRemoteMediaToLocal(localKey, nextSrc, nextType, nextWallpaperId).then((cached) => {
          if (cached?.objectUrl && !cancelled) {
            saveWallpaperMeta(effectiveUid, {
              hasLocalBlob: true,
              wallpaperId: nextWallpaperId,
              mediaType: cached.mediaType,
              remoteUrl: nextSrc,
            });
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('wallpaperUpdate', handleWallpaperUpdate);
    window.addEventListener('landing_force_account_sync', handleForceAccountSync);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('wallpaperUpdate', handleWallpaperUpdate);
      window.removeEventListener('landing_force_account_sync', handleForceAccountSync);
      if (activeObjectUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, [effectiveUid, defaultWallpaper]);

  useEffect(() => {
    const update = () => {
      if (!videoRef.current) return;
      if (document.hidden) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [stillWallpaper, mediaState.src]);

  return (
    <div
      className="wallpaper-container"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        backgroundColor: '#0b0d13',
        overflow: 'hidden',
      }}
    >
      {/* Progressive Blur-Up Replica Layer (< 3KB thumbnail replica rendered immediately on Frame 0) */}
      {thumbnailSrc && (
        <img
          src={thumbnailSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-24px',
            width: 'calc(100% + 48px)',
            height: 'calc(100% + 48px)',
            objectFit: 'cover',
            filter: features.liteMode ? 'none' : 'blur(20px)',
            transform: 'scale(1.06)',
            opacity: isFullLoaded ? 0 : 1,
            transition: features.liteMode ? 'none' : 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
            display: 'block',
            zIndex: 1,
          }}
        />
      )}

      {/* Full Resolution Heavy Media Layer with smooth crossfade (Video disabled in Lite Mode or when videoWallpapers is off) */}
      {mediaState.src && mediaState.mediaType === 'video' && !stillWallpaper ? (
        <video
          ref={videoRef}
          key={mediaState.src}
          src={mediaState.src}
          autoPlay={!document.hidden}
          loop
          muted
          playsInline
          onLoadedData={handleFullVideoLoaded}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: 'translateZ(0)',
            opacity: isFullLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
            zIndex: 2,
          }}
          onError={() => {
            setIsFullLoaded(true);
            setMediaState({ src: defaultWallpaper, mediaType: 'image' });
          }}
        />
      ) : (
        mediaState.src && (
          <img
            key={mediaState.src}
            src={(mediaState.mediaType === 'video' && stillWallpaper) ? (thumbnailSrc || defaultWallpaper) : mediaState.src}
            alt=""
            decoding="async"
            onLoad={handleFullImageLoaded}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: 'translateZ(0)',
              opacity: isFullLoaded ? 1 : 0,
              transition: features.liteMode ? 'none' : 'opacity 0.5s ease-in-out',
              zIndex: 2,
            }}
            loading="eager"
            onError={(e) => {
              setIsFullLoaded(true);
              if (e.target.src !== defaultWallpaper) {
                e.target.src = defaultWallpaper;
              }
            }}
          />
        )
      )}
    </div>
  );
};

export const useWallpaper = () => {
  const { currentUser } = useAuth();
  const [wallpaper, setWallpaper] = useState(null);

  const updateWallpaperUrl = async (newWallpaperUrl) => {
    if (!currentUser) return;
    setWallpaper(newWallpaperUrl);
    updateCachedWallpaper(currentUser.uid, newWallpaperUrl);
    await updateWallpaper(currentUser.uid, newWallpaperUrl);
  };

  return { wallpaper, updateWallpaperUrl };
};

export default function WallpaperManager() {
  const mode = useWallpaperMode();
  const reducedMotion = useReducedMotion();
  const [features, setFeatures] = useState(() => getStoredFeatures());
  const stillWallpaper = reducedMotion || features.liteMode || !features.videoWallpapers;
  useEffect(() => {
    const handleFeatures = (e) => {
      setFeatures(e.detail || getStoredFeatures());
    };
    window.addEventListener('landing_features_updated', handleFeatures);
    return () => window.removeEventListener('landing_features_updated', handleFeatures);
  }, []);

  return mode === 'personal' ? <PersonalWallpaper features={features} stillWallpaper={stillWallpaper} />
    : <DailyWallpaper mode={mode} still={stillWallpaper} />;
}
