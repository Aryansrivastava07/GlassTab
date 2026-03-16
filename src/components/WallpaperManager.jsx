import React, { useState, useEffect } from 'react';
import { Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateWallpaper, subscribeToUserData } from '../services/databaseService';
import { getCachedUserData, updateCachedWallpaper } from '../utils/cacheService';

const WallpaperManager = () => {
  // Default wallpaper
  const defaultWallpaper = 'https://picsum.photos/1920/1080';
  const { currentUser } = useAuth();
  const [wallpaper, setWallpaper] = useState(defaultWallpaper);
  const [loading, setLoading] = useState(true);
  const [userInitiatedUpdate, setUserInitiatedUpdate] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setWallpaper(null);
      setLoading(false);
      return;
    }

    const loadWallpaper = async () => {
      setLoading(true);
      
      try {
        // 1. First try to get stored image data from localStorage
        const storedImageData = localStorage.getItem(`wallpaper_image_${currentUser.uid}`);
        if (storedImageData) {
          console.log('Loading wallpaper from stored image data');
          setWallpaper(storedImageData);
          setLoading(false);
          return;
        }

        // 2. Then try to fetch from cache (URL)
        const cachedData = getCachedUserData(currentUser.uid);
        if (cachedData && cachedData.wallpaper) {
          console.log('Loading wallpaper from cache URL:', cachedData.wallpaper);
          setWallpaper(cachedData.wallpaper);
          setLoading(false);
          return;
        }

        // 3. If not in cache, fetch from Firebase
        console.log('No cached wallpaper, fetching from Firebase...');
        const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
          // Don't override if user just made a change
          if (userInitiatedUpdate) {
            console.log('User initiated update, skipping Firebase override');
            setUserInitiatedUpdate(false);
            return;
          }

          if (userData && userData.wallpaper) {
            console.log('Loading wallpaper from Firebase:', userData.wallpaper);
            setWallpaper(userData.wallpaper);
            // Cache the wallpaper for future use
            updateCachedWallpaper(currentUser.uid, userData.wallpaper);
          } else {
            // 4. If not in Firebase either, set to default wallpaper
            console.log('No wallpaper in Firebase, setting default:', defaultWallpaper);
            setWallpaper(defaultWallpaper);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading wallpaper:', error);
        // Fallback to default wallpaper
        setWallpaper(defaultWallpaper);
        setLoading(false);
      }
    };

    loadWallpaper();

    // Listen for wallpaper updates from sidebar
    const handleWallpaperUpdate = (event) => {
      console.log('Received wallpaper update event:', event.detail);
      setUserInitiatedUpdate(true); // Prevent Firebase from overriding
      setWallpaper(event.detail.wallpaper);
    };

    window.addEventListener('wallpaperUpdate', handleWallpaperUpdate);

    return () => {
      window.removeEventListener('wallpaperUpdate', handleWallpaperUpdate);
    };
  }, [currentUser]);

  const updateWallpaperUrl = async (newWallpaperUrl) => {
    if (!currentUser) return;

    try {
      console.log('Updating wallpaper to:', newWallpaperUrl);
      
      // Update UI immediately
      setWallpaper(newWallpaperUrl);
      
      // Fetch and store the actual image data in localStorage
      try {
        const response = await fetch(newWallpaperUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = () => {
          const imageData = reader.result;
          // Store image data in localStorage
          localStorage.setItem(`wallpaper_image_${currentUser.uid}`, imageData);
          console.log('Wallpaper image data stored in localStorage');
          
          // Also store the URL for reference
          updateCachedWallpaper(currentUser.uid, newWallpaperUrl);
        };
        
        reader.readAsDataURL(blob);
      } catch (imageError) {
        console.error('Failed to fetch and store image:', imageError);
        // Fallback to just storing the URL
        updateCachedWallpaper(currentUser.uid, newWallpaperUrl);
      }
      
      // Save to Firebase
      await updateWallpaper(currentUser.uid, newWallpaperUrl);
      console.log('Wallpaper updated successfully');
    } catch (error) {
      console.error('Error updating wallpaper:', error);
      // If Firebase fails, keep the cached version
      console.log('Firebase update failed, wallpaper saved to cache only');
    }
  };

  const removeWallpaper = async () => {
    if (!currentUser) return;

    try {
      console.log('Removing wallpaper...');
      
      // Update UI immediately to default
      setWallpaper(defaultWallpaper);
      
      // Remove stored image data from localStorage
      localStorage.removeItem(`wallpaper_image_${currentUser.uid}`);
      
      // Remove from cache using the dedicated function
      updateCachedWallpaper(currentUser.uid, null);
      
      // Remove from Firebase
      await updateWallpaper(currentUser.uid, null);
      console.log('Wallpaper removed successfully');
    } catch (error) {
      console.error('Error removing wallpaper:', error);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {wallpaper && (
        <div
          className="wallpaper-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: -1,
            pointerEvents: 'none',
            willChange: 'transform'
          }}
        >
          <img
            src={wallpaper}
            alt="Wallpaper"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: 'translateZ(0)'
            }}
            loading="eager"
            onLoad={(event) => {
              console.log('Wallpaper loaded successfully:', wallpaper);
              // Add fade-in effect
              const img = event.target;
              img.style.opacity = '0';
              setTimeout(() => {
                img.style.transition = 'opacity 0.3s ease-in-out';
                img.style.opacity = '1';
              }, 50);
            }}
            onError={(e) => {
              console.error('Failed to load wallpaper:', wallpaper);
              // Fallback to default if image fails to load
              e.target.src = defaultWallpaper;
            }}
          />
        </div>
      )}
    </>
  );
};

// Export wallpaper management functions for use in other components
export const useWallpaper = () => {
  const { currentUser } = useAuth();
  const [wallpaper, setWallpaper] = useState(null);

  const updateWallpaperUrl = async (newWallpaperUrl) => {
    if (!currentUser) return;

    try {
      // Update UI immediately
      setWallpaper(newWallpaperUrl);
      
      // Save to cache
      const cachedData = getCachedUserData(currentUser.uid) || {};
      setCachedData(`user_data_${currentUser.uid}`, {
        ...cachedData,
        wallpaper: newWallpaperUrl
      });
      
      // Save to Firebase
      await updateWallpaper(currentUser.uid, newWallpaperUrl);
    } catch (error) {
      console.error('Error updating wallpaper:', error);
    }
  };

  return { wallpaper, updateWallpaperUrl };
};

export default WallpaperManager;