import React, { useState, useEffect } from 'react';

/**
 * Hook to track whether the browser has an active internet connection.
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Extracts the first two letters for a site thumbnail.
 * e.g. "Google" -> "GO", "YouTube" -> "YT", "GitHub" -> "GH", "Reddit" -> "RE"
 */
export const getTwoLetterThumbnail = (name, url) => {
  const cleanName = (name || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  if (cleanName) {
    // If multiple words, take the first letter of the first two words (e.g. "Google Docs" -> "GD")
    const words = cleanName.split(/[\s\-_]+/).filter(Boolean);
    if (words.length >= 2 && words[0][0] && words[1][0]) {
      const initials = (words[0][0] + words[1][0]).toUpperCase();
      if (/^[A-Z0-9]{2}$/.test(initials)) {
        return initials;
      }
    }

    // Check CamelCase (e.g. "YouTube" -> "YT", "GitHub" -> "GH")
    const camelMatches = cleanName.match(/[A-Z][a-z0-9]*/g);
    if (camelMatches && camelMatches.length >= 2) {
      const camelInitials = (camelMatches[0][0] + camelMatches[1][0]).toUpperCase();
      if (/^[A-Z0-9]{2}$/.test(camelInitials)) {
        return camelInitials;
      }
    }

    // Default to first two alphanumeric characters (e.g. "Google" -> "GO", "Reddit" -> "RE")
    const alpha = cleanName.replace(/[^a-zA-Z0-9]/g, '');
    if (alpha.length >= 2) {
      return alpha.substring(0, 2).toUpperCase();
    }
    if (alpha.length === 1) {
      return alpha.toUpperCase();
    }
  }

  // Fallback to domain name if name is missing or empty
  if (url) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = parsed.hostname.replace(/^www\./i, '').split('.')[0] || '';
      const domainAlpha = domain.replace(/[^a-zA-Z0-9]/g, '');
      if (domainAlpha.length >= 2) {
        return domainAlpha.substring(0, 2).toUpperCase();
      }
      if (domainAlpha.length === 1) {
        return domainAlpha.toUpperCase();
      }
    } catch {
      // ignore
    }
  }

  return 'GT';
};

const GRADIENTS = [
  'from-blue-600/40 to-indigo-700/50 text-blue-100 border-blue-400/40',
  'from-purple-600/40 to-pink-700/50 text-purple-100 border-purple-400/40',
  'from-emerald-600/40 to-teal-700/50 text-emerald-100 border-emerald-400/40',
  'from-amber-600/40 to-orange-700/50 text-amber-100 border-amber-400/40',
  'from-cyan-600/40 to-sky-700/50 text-cyan-100 border-cyan-400/40',
  'from-rose-600/40 to-red-700/50 text-rose-100 border-rose-400/40',
  'from-violet-600/40 to-fuchsia-700/50 text-violet-100 border-violet-400/40',
];

/**
 * Returns a consistent stylish glass gradient class for a given site name or URL.
 */
export const getThumbnailGradient = (str) => {
  let hash = 0;
  const s = str || 'GlassTab';
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

/**
 * Responsive Site Thumbnail Component.
 * Automatically switches to first two letters on offline mode or when image fails to load.
 */
export const SiteThumbnail = ({
  logo,
  name,
  url,
  className = 'w-7 h-7 sm:w-8 sm:h-8',
  fallbackClassName = 'w-full h-full text-xs sm:text-sm font-bold',
}) => {
  const isOnline = useOnlineStatus();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logo, isOnline]);

  const letters = getTwoLetterThumbnail(name, url);
  const gradient = getThumbnailGradient(name || url);

  if (!isOnline || hasError || !logo) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${gradient} border flex items-center justify-center font-bold tracking-wider select-none shadow-inner rounded-inherit ${fallbackClassName}`}
        title={name || url}
      >
        <span>{letters}</span>
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={name || ''}
      className={`object-contain transition-opacity duration-150 ${className}`}
      onError={() => setHasError(true)}
    />
  );
};
