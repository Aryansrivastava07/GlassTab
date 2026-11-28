import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';
import { fetchAndRestoreGeminiKeyFromCloud } from '../services/secureKeyService';

const AuthContext = createContext();
const AUTH_CACHE_KEY = 'landing_cached_auth_user';

export const GUEST_USER = {
  uid: 'local_guest',
  displayName: 'Guest User',
  email: '',
  photoURL: null,
  isGuest: true
};

const readCachedAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.uid !== 'local_guest') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

const writeCachedAuthUser = (user) => {
  try {
    if (user && user.uid && user.uid !== 'local_guest') {
      localStorage.setItem(
        AUTH_CACHE_KEY,
        JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || null,
          isGuest: false
        })
      );
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    // ignore
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Synchronously restore last signed-in user so UI renders instantly at 0ms
  const [currentUser, setCurrentUser] = useState(() => readCachedAuthUser());
  const [loading, setLoading] = useState(false);

  const [googleUser, setGoogleUser] = useState(null);

  useEffect(() => {
    let generation = 0;
    let isMounted = true;
    try {
      const unsubscribe = onIdTokenChanged(auth, (user) => {
        if (!isMounted) return;
        const version = ++generation;
        setGoogleUser(previous => previous === user ? previous : null);
        if (user) user.getIdTokenResult().then(result => {
          if (isMounted && generation === version) setGoogleUser(result.signInProvider === 'google.com' ? user : null);
        }).catch(() => { if (isMounted && generation === version) setGoogleUser(null); });
        setCurrentUser(user);
        writeCachedAuthUser(user);
        if (user?.uid && user.uid !== 'local_guest') {
          fetchAndRestoreGeminiKeyFromCloud(user.uid).catch((err) => {
            console.warn('Auto-restore Gemini key warning:', err);
          });
        }
        setLoading(false);
      });
      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.warn('Auth listener warning (running offline/guest):', err);
      if (isMounted) setLoading(false);
    }
  }, []);

  const value = {
    currentUser: currentUser || GUEST_USER,
    googleUser,
    firebaseUser: currentUser,
    isGuest: !currentUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
