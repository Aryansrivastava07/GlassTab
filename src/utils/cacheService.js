// Local Storage Cache Service
const CACHE_PREFIX = 'landing_page_cache_';
const CACHE_VERSION = '1.0';

// Cache keys
const CACHE_KEYS = {
    USER_DATA: (userId) => `${CACHE_PREFIX}user_data_${userId}`,
    SPEED_DIALS: (userId) => `${CACHE_PREFIX}speed_dials_${userId}`,
    FAVORITES: (userId) => `${CACHE_PREFIX}favorites_${userId}`,
    WALLPAPER: (userId) => `${CACHE_PREFIX}wallpaper_${userId}`,
    LAST_SYNC: (userId) => `${CACHE_PREFIX}last_sync_${userId}`,
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
    USER_DATA: 24 * 60 * 60 * 1000, // 24 hours
    SPEED_DIALS: 60 * 60 * 1000,     // 1 hour
    FAVORITES: 60 * 60 * 1000,       // 1 hour
    WALLPAPER: 24 * 60 * 60 * 1000,   // 24 hours
};

// Get cached data (Local-First: never auto-delete local DB entries on expiry)
export const getCachedData = (key) => {
    try {
        const cachedItem = localStorage.getItem(key);
        if (!cachedItem) return null;

        const { data, version } = JSON.parse(cachedItem);

        // Check version compatibility
        if (version !== CACHE_VERSION) {
            localStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error getting cached data:', error);
        localStorage.removeItem(key);
        return null;
    }
};

// Set cached data with timestamp
export const setCachedData = (key, data) => {
    try {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
        console.error('Error setting cached data:', error);
    }
};

// Remove cached data
export const removeCachedData = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error removing cached data:', error);
    }
};

// Clear all cache for a user
export const clearUserCache = (userId) => {
    try {
        Object.values(CACHE_KEYS).forEach(keyGenerator => {
            const key = keyGenerator(userId);
            localStorage.removeItem(key);
        });
    } catch (error) {
        console.error('Error clearing user cache:', error);
    }
};

// Cache user data
export const cacheUserData = (userId, userData) => {
    setCachedData(CACHE_KEYS.USER_DATA(userId), userData);
    setCachedData(CACHE_KEYS.SPEED_DIALS(userId), userData.speedDials || []);
    setCachedData(CACHE_KEYS.FAVORITES(userId), userData.favorites || []);
    setCachedData(CACHE_KEYS.WALLPAPER(userId), userData.wallpaper);
    setCachedData(CACHE_KEYS.LAST_SYNC(userId), Date.now());
};

// Get cached user data
export const getCachedUserData = (userId) => {
    const userData = getCachedData(CACHE_KEYS.USER_DATA(userId), CACHE_EXPIRY.USER_DATA);
    if (!userData) return null;

    // Get individual cached items
    const speedDials = getCachedData(CACHE_KEYS.SPEED_DIALS(userId), CACHE_EXPIRY.SPEED_DIALS);
    const favorites = getCachedData(CACHE_KEYS.FAVORITES(userId), CACHE_EXPIRY.FAVORITES);
    const wallpaper = getCachedData(CACHE_KEYS.WALLPAPER(userId), CACHE_EXPIRY.WALLPAPER);

    return {
        ...userData,
        speedDials: speedDials || userData.speedDials || [],
        favorites: favorites || userData.favorites || [],
        wallpaper: wallpaper !== null ? wallpaper : userData.wallpaper,
    };
};

// Update specific cached items
export const updateCachedSpeedDials = (userId, speedDials) => {
    setCachedData(CACHE_KEYS.SPEED_DIALS(userId), speedDials);
    // Also update the full user data cache
    const userData = getCachedUserData(userId);
    if (userData) {
        userData.speedDials = speedDials;
        setCachedData(CACHE_KEYS.USER_DATA(userId), userData);
    }
};

export const updateCachedFavorites = (userId, favorites) => {
    setCachedData(CACHE_KEYS.FAVORITES(userId), favorites);
    // Also update the full user data cache
    const userData = getCachedUserData(userId);
    if (userData) {
        userData.favorites = favorites;
        setCachedData(CACHE_KEYS.USER_DATA(userId), userData);
    }
};

export const updateCachedWallpaper = (userId, wallpaper) => {
    setCachedData(CACHE_KEYS.WALLPAPER(userId), wallpaper);
    // Also update the full user data cache
    const userData = getCachedUserData(userId);
    if (userData) {
        userData.wallpaper = wallpaper;
        setCachedData(CACHE_KEYS.USER_DATA(userId), userData);
    }
};

// Update cached user data with partial fields (merge)
export const updateCachedUserData = (userId, partialUserData) => {
    const existing = getCachedUserData(userId) || {};
    const merged = {
        ...existing,
        ...partialUserData,
    };

    setCachedData(CACHE_KEYS.USER_DATA(userId), merged);

    // Keep individual caches in sync only if provided
    if (partialUserData.speedDials !== undefined) {
        setCachedData(CACHE_KEYS.SPEED_DIALS(userId), partialUserData.speedDials);
    }
    if (partialUserData.favorites !== undefined) {
        setCachedData(CACHE_KEYS.FAVORITES(userId), partialUserData.favorites);
    }
    if (partialUserData.wallpaper !== undefined) {
        setCachedData(CACHE_KEYS.WALLPAPER(userId), partialUserData.wallpaper);
    }

    setCachedData(CACHE_KEYS.LAST_SYNC(userId), Date.now());
};

// Check if cache is stale (needs refresh)
export const isCacheStale = (userId) => {
    const lastSync = getCachedData(CACHE_KEYS.LAST_SYNC(userId), CACHE_EXPIRY.USER_DATA);
    if (!lastSync) return true;

    // Consider cache stale if older than 30 minutes
    return Date.now() - lastSync > 30 * 60 * 1000;
};

// Get cache size (for debugging)
export const getCacheSize = () => {
    try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                totalSize += localStorage.getItem(key).length;
            }
        }
        return totalSize;
    } catch (error) {
        console.error('Error getting cache size:', error);
        return 0;
    }
};
