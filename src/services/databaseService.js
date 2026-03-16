import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    getCachedUserData,
    cacheUserData,
    updateCachedSpeedDials,
    updateCachedFavorites,
    updateCachedWallpaper,
    updateCachedUserData,
    isCacheStale,
    clearUserCache
} from '../utils/cacheService';

// Get user document reference
const getUserDoc = (userId) => doc(db, 'users', userId);

// Initialize user data if not exists
export const initializeUserData = async (userId) => {
    try {
        // Check cache first
        const cachedData = getCachedUserData(userId);
        if (cachedData && !isCacheStale(userId)) {
            return cachedData;
        }

        // Try to fetch from Firebase with offline handling
        try {
            const userDoc = await getDoc(getUserDoc(userId));
            if (!userDoc.exists()) {
                const defaultData = {
                    speedDials: [
                        { id: 1, name: 'Google', url: 'https://google.com', logo: 'https://www.google.com/favicon.ico' },
                        { id: 2, name: 'YouTube', url: 'https://youtube.com', logo: 'https://www.youtube.com/favicon.ico' },
                        { id: 3, name: 'GitHub', url: 'https://github.com', logo: 'https://github.com/favicon.ico' },
                        { id: 4, name: 'Twitter', url: 'https://twitter.com', logo: 'https://twitter.com/favicon.ico' },
                    ],
                    favorites: [
                        { id: 1, name: 'Instagram', url: 'https://instagram.com', logo: 'https://www.instagram.com/favicon.ico' },
                        { id: 2, name: 'LinkedIn', url: 'https://linkedin.com', logo: 'https://www.linkedin.com/favicon.ico' },
                    ],
                    todos: [],
                    notes: [],
                    wallpaper: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await setDoc(getUserDoc(userId), defaultData);
                cacheUserData(userId, defaultData);
                return defaultData;
            }

            const userData = userDoc.data();
            cacheUserData(userId, userData);
            return userData;
        } catch (firebaseError) {
            // Handle Firebase offline errors gracefully
            if (firebaseError.code === 'unavailable' || firebaseError.code === 'offline') {
                console.log('Firebase is offline, using cached data if available');

                // Return cached data if available, even if stale
                const staleData = getCachedUserData(userId);
                if (staleData) {
                    return staleData;
                }

                // Return default data if no cache available
                const defaultData = {
                    speedDials: [
                        { id: 1, name: 'Google', url: 'https://google.com', logo: 'https://www.google.com/favicon.ico' },
                        { id: 2, name: 'YouTube', url: 'https://youtube.com', logo: 'https://www.youtube.com/favicon.ico' },
                        { id: 3, name: 'GitHub', url: 'https://github.com', logo: 'https://github.com/favicon.ico' },
                        { id: 4, name: 'Twitter', url: 'https://twitter.com', logo: 'https://twitter.com/favicon.ico' },
                    ],
                    favorites: [
                        { id: 1, name: 'Instagram', url: 'https://instagram.com', logo: 'https://www.instagram.com/favicon.ico' },
                        { id: 2, name: 'LinkedIn', url: 'https://linkedin.com', logo: 'https://www.linkedin.com/favicon.ico' },
                    ],
                    todos: [],
                    notes: [],
                    wallpaper: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Cache default data for offline use
                cacheUserData(userId, defaultData);
                return defaultData;
            }

            // Re-throw non-offline errors
            throw firebaseError;
        }
    } catch (error) {
        console.error('Error initializing user data:', error);

        // Final fallback - return cached data or default data
        const cachedData = getCachedUserData(userId);
        if (cachedData) {
            return cachedData;
        }

        // Return minimal default data
        return {
            speedDials: [],
            favorites: [],
            todos: [],
            notes: [],
            wallpaper: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
};

// Get user data (with cache fallback)
export const getUserData = async (userId) => {
    try {
        // Try cache first
        const cachedData = getCachedUserData(userId);
        if (cachedData && !isCacheStale(userId)) {
            return cachedData;
        }

        // Fetch from Firebase
        const userDoc = await getDoc(getUserDoc(userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            cacheUserData(userId, userData);
            return userData;
        }

        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        // Return cached data as fallback
        return getCachedUserData(userId);
    }
};

// Add speed dial
export const addSpeedDial = async (userId, speedDial) => {
    try {
        const userDoc = await getDoc(getUserDoc(userId));
        if (userDoc.exists()) {
            const currentSpeedDials = userDoc.data().speedDials || [];
            const newSpeedDial = {
                ...speedDial,
                id: Date.now(),
                createdAt: new Date().toISOString()
            };

            await updateDoc(getUserDoc(userId), {
                speedDials: [...currentSpeedDials, newSpeedDial],
                updatedAt: new Date().toISOString()
            });

            // Update cache
            const updatedSpeedDials = [...currentSpeedDials, newSpeedDial];
            updateCachedSpeedDials(userId, updatedSpeedDials);

            return newSpeedDial;
        }
    } catch (error) {
        console.error('Error adding speed dial:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            const cachedData = getCachedUserData(userId);
            if (cachedData) {
                const newSpeedDial = {
                    ...speedDial,
                    id: Date.now(),
                    createdAt: new Date().toISOString()
                };
                const updatedSpeedDials = [...(cachedData.speedDials || []), newSpeedDial];
                updateCachedSpeedDials(userId, updatedSpeedDials);
                return newSpeedDial;
            }
        }

        throw error;
    }
};

// Delete speed dial
export const deleteSpeedDial = async (userId, speedDialId) => {
    try {
        const userDoc = await getDoc(getUserDoc(userId));
        if (userDoc.exists()) {
            const currentSpeedDials = userDoc.data().speedDials || [];
            const updatedSpeedDials = currentSpeedDials.filter(dial => dial.id !== speedDialId);

            await updateDoc(getUserDoc(userId), {
                speedDials: updatedSpeedDials,
                updatedAt: new Date().toISOString()
            });

            // Update cache
            updateCachedSpeedDials(userId, updatedSpeedDials);
        }
    } catch (error) {
        console.error('Error deleting speed dial:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            const cachedData = getCachedUserData(userId);
            if (cachedData) {
                const updatedSpeedDials = (cachedData.speedDials || []).filter(dial => dial.id !== speedDialId);
                updateCachedSpeedDials(userId, updatedSpeedDials);
                return;
            }
        }

        throw error;
    }
};

// Add favorite
export const addFavorite = async (userId, favorite) => {
    try {
        const userDoc = await getDoc(getUserDoc(userId));
        if (userDoc.exists()) {
            const currentFavorites = userDoc.data().favorites || [];
            const newFavorite = {
                ...favorite,
                id: Date.now(),
                createdAt: new Date().toISOString()
            };

            await updateDoc(getUserDoc(userId), {
                favorites: [...currentFavorites, newFavorite],
                updatedAt: new Date().toISOString()
            });

            // Update cache
            const updatedFavorites = [...currentFavorites, newFavorite];
            updateCachedFavorites(userId, updatedFavorites);

            return newFavorite;
        }
    } catch (error) {
        console.error('Error adding favorite:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            const cachedData = getCachedUserData(userId);
            if (cachedData) {
                const newFavorite = {
                    ...favorite,
                    id: Date.now(),
                    createdAt: new Date().toISOString()
                };
                const updatedFavorites = [...(cachedData.favorites || []), newFavorite];
                updateCachedFavorites(userId, updatedFavorites);
                return newFavorite;
            }
        }

        throw error;
    }
};

// Delete favorite
export const deleteFavorite = async (userId, favoriteId) => {
    try {
        const userDoc = await getDoc(getUserDoc(userId));
        if (userDoc.exists()) {
            const currentFavorites = userDoc.data().favorites || [];
            const updatedFavorites = currentFavorites.filter(fav => fav.id !== favoriteId);

            await updateDoc(getUserDoc(userId), {
                favorites: updatedFavorites,
                updatedAt: new Date().toISOString()
            });

            // Update cache
            updateCachedFavorites(userId, updatedFavorites);
        }
    } catch (error) {
        console.error('Error deleting favorite:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            const cachedData = getCachedUserData(userId);
            if (cachedData) {
                const updatedFavorites = (cachedData.favorites || []).filter(fav => fav.id !== favoriteId);
                updateCachedFavorites(userId, updatedFavorites);
                return;
            }
        }

        throw error;
    }
};

// Update wallpaper
export const updateWallpaper = async (userId, wallpaperUrl) => {
    try {
        await updateDoc(getUserDoc(userId), {
            wallpaper: wallpaperUrl,
            updatedAt: new Date().toISOString()
        });

        // Update cache
        updateCachedWallpaper(userId, wallpaperUrl);
    } catch (error) {
        console.error('Error updating wallpaper:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            updateCachedWallpaper(userId, wallpaperUrl);
            return;
        }

        throw error;
    }
};

// Update user data (general purpose)
export const updateUserData = async (userId, userData) => {
    try {
        const payload = {
            ...userData,
            updatedAt: new Date().toISOString()
        };

        // Use merge so this works even if the user doc doesn't exist yet
        await setDoc(getUserDoc(userId), payload, { merge: true });

        // Update cache (merge, don't overwrite unrelated fields)
        updateCachedUserData(userId, payload);
    } catch (error) {
        console.error('Error updating user data:', error);

        // Handle offline errors - update cache only
        if (error.code === 'unavailable' || error.code === 'offline') {
            console.log('Firebase is offline, updating cache only');
            updateCachedUserData(userId, { ...userData, updatedAt: new Date().toISOString() });
            return;
        }

        throw error;
    }
};

// Real-time listener for user data (with cache updates)
export const subscribeToUserData = (userId, callback) => {
    const unsubscribe = onSnapshot(
        getUserDoc(userId),
        (doc) => {
            if (doc.exists()) {
                const userData = doc.data();

                // Update cache with latest data
                cacheUserData(userId, userData);

                callback(userData);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error('Error in real-time listener:', error);

            // Handle different error types
            if (error.code === 'unavailable' || error.code === 'offline') {
                console.log('📱 Firebase is offline, using cached data');
                // Return cached data as fallback
                const cachedData = getCachedUserData(userId);
                if (cachedData) {
                    callback(cachedData);
                } else {
                    // Return default data if no cache
                    callback({
                        speedDials: [
                            { id: 1, name: 'Google', url: 'https://google.com', logo: 'https://www.google.com/favicon.ico' },
                            { id: 2, name: 'YouTube', url: 'https://youtube.com', logo: 'https://www.youtube.com/favicon.ico' },
                            { id: 3, name: 'GitHub', url: 'https://github.com', logo: 'https://github.com/favicon.ico' },
                            { id: 4, name: 'Twitter', url: 'https://twitter.com', logo: 'https://twitter.com/favicon.ico' },
                        ],
                        favorites: [],
                        todos: [],
                        notes: [],
                        wallpaper: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            } else if (error.code === 'permission-denied') {
                console.error('🚫 Permission denied. Check Firebase security rules.');
                callback(null);
            } else {
                console.error('❌ Unknown Firebase error:', error);
                // Return cached data as fallback
                const cachedData = getCachedUserData(userId);
                callback(cachedData);
            }
        }
    );

    return unsubscribe;
};

// Clear user cache (for logout)
export const clearUserCacheOnLogout = (userId) => {
    clearUserCache(userId);
};

// Force refresh from Firebase (bypass cache)
export const forceRefreshUserData = async (userId) => {
    try {
        clearUserCache(userId);
        return await getUserData(userId);
    } catch (error) {
        console.error('Error force refreshing user data:', error);
        throw error;
    }
};
