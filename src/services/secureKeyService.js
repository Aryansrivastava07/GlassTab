import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Storage keys
export const GEMINI_API_KEY_STORAGE = 'landing_gemini_api_key';
const APP_PEPPER = 'GlassTab_v2_SecureKey_Pepper_2026';

// Helper encoders
const enc = new TextEncoder();
const dec = new TextDecoder();

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM 256-bit encryption key using PBKDF2.
 * Combines the user's UID with the application pepper so every user has an isolated cryptographic key.
 */
async function getDerivedAesKey(userId, saltBytes) {
  const keyMaterial = enc.encode(`${userId}::${APP_PEPPER}`);
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain API key using AES-GCM-256 with a unique random IV and Salt per encryption.
 * In Firestore, this appears as completely unreadable ciphertext.
 */
export async function encryptApiKey(plainKey, userId) {
  if (!plainKey || !plainKey.trim() || !userId || userId === 'local_guest') {
    return null;
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await getDerivedAesKey(userId, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plainKey.trim())
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    algorithm: 'AES-GCM-256',
  };
}

/**
 * Decrypts an AES-GCM-256 encrypted payload into the original plain API key.
 */
export async function decryptApiKey(encryptedPayload, userId) {
  if (
    !encryptedPayload ||
    !encryptedPayload.ciphertext ||
    !encryptedPayload.iv ||
    !encryptedPayload.salt ||
    !userId ||
    userId === 'local_guest'
  ) {
    return '';
  }

  try {
    const salt = new Uint8Array(base64ToBuffer(encryptedPayload.salt));
    const iv = new Uint8Array(base64ToBuffer(encryptedPayload.iv));
    const ciphertext = base64ToBuffer(encryptedPayload.ciphertext);

    const aesKey = await getDerivedAesKey(userId, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );

    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Failed to decrypt API key from cloud payload:', err);
    return '';
  }
}

/**
 * Mask an API key for safe UI display (e.g. AIzaSy••••••••••••34a1).
 */
export function maskApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return '';
  }
  const clean = apiKey.trim();
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}${'•'.repeat(14)}${suffix}`;
}

/**
 * Synchronous local getter for 0ms startup.
 */
export function getLocalGeminiApiKey() {
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

/**
 * Saves the Gemini API key locally and syncs it encrypted (AES-256) to Firestore.
 */
export async function saveAndSyncGeminiKey(plainKey, userId) {
  const clean = (plainKey || '').trim();

  // 1. Save locally
  try {
    if (!clean) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, clean);
    }
  } catch (err) {
    console.warn('Could not write API key to localStorage:', err);
  }

  // 2. Dispatch cross-component event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('landing_gemini_key_changed', {
        detail: { key: clean, masked: maskApiKey(clean) },
      })
    );
  }

  // 3. Encrypt and sync to Cloud Firestore if signed in
  if (userId && userId !== 'local_guest') {
    try {
      const keyDocRef = doc(db, 'users', userId, 'private', 'geminiKey');
      if (!clean) {
        await setDoc(keyDocRef, { encrypted: null, updatedAt: new Date().toISOString() });
      } else {
        const encrypted = await encryptApiKey(clean, userId);
        if (encrypted) {
          await setDoc(
            keyDocRef,
            {
              encrypted,
              updatedAt: new Date().toISOString(),
              version: '2.0.2',
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn('Failed to sync encrypted API key to Firestore:', err);
    }
  }

  return clean;
}

/**
 * Fetches and decrypts the user's Gemini key from Firestore on login.
 */
export async function fetchAndRestoreGeminiKeyFromCloud(userId) {
  if (!userId || userId === 'local_guest') return getLocalGeminiApiKey();

  try {
    const keyDocRef = doc(db, 'users', userId, 'private', 'geminiKey');
    const snap = await getDoc(keyDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.encrypted) {
        const decrypted = await decryptApiKey(data.encrypted, userId);
        if (decrypted && decrypted.trim().length > 10) {
          localStorage.setItem(GEMINI_API_KEY_STORAGE, decrypted.trim());
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('landing_gemini_key_changed', {
                detail: { key: decrypted.trim(), masked: maskApiKey(decrypted.trim()) },
              })
            );
          }
          return decrypted.trim();
        }
      }
    }
  } catch (err) {
    console.warn('Could not restore encrypted key from Firestore:', err);
  }

  return getLocalGeminiApiKey();
}

/**
 * Real-time listener for multi-device sync (e.g. key added on Laptop automatically decrypts on Desktop).
 */
export function subscribeToCloudGeminiKey(userId, callback) {
  if (!userId || userId === 'local_guest') {
    callback(getLocalGeminiApiKey());
    return () => {};
  }

  // First callback with local cache
  callback(getLocalGeminiApiKey());

  try {
    const keyDocRef = doc(db, 'users', userId, 'private', 'geminiKey');
    const unsubscribe = onSnapshot(
      keyDocRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.encrypted) {
            const decrypted = await decryptApiKey(data.encrypted, userId);
            if (decrypted && decrypted.trim().length > 10) {
              localStorage.setItem(GEMINI_API_KEY_STORAGE, decrypted.trim());
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('landing_gemini_key_changed', {
                    detail: { key: decrypted.trim(), masked: maskApiKey(decrypted.trim()) },
                  })
                );
              }
              callback(decrypted.trim());
              return;
            }
          } else if (data?.encrypted === null) {
            localStorage.removeItem(GEMINI_API_KEY_STORAGE);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('landing_gemini_key_changed', {
                  detail: { key: '', masked: '' },
                })
              );
            }
            callback('');
            return;
          }
        }
        callback(getLocalGeminiApiKey());
      },
      (err) => {
        console.warn('Cloud Gemini key listener warning:', err.message);
      }
    );
    return () => unsubscribe();
  } catch (err) {
    console.warn('Could not establish cloud key subscription:', err);
    return () => {};
  }
}
