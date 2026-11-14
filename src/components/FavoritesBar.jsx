import React, { useState, useEffect } from 'react';
import { Plus, Heart, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  initializeUserData,
  addFavorite,
  deleteFavorite,
  subscribeToUserData
} from '../services/databaseService';
import { getCachedUserData } from '../utils/cacheService';
import { getUrlSuggestionsForName } from '../utils/urlSuggestionService';
import UrlSuggestions from './UrlSuggestions';
import { getGlassTheme, getGlassStyleForPart, getTextStyleForPart, getMutedTextStyleForPart } from '../utils/glassThemeService';
import { SiteThumbnail } from '../utils/thumbnailHelper';

const FavoritesBar = () => {
  const { currentUser } = useAuth();
  const effectiveUid = currentUser?.uid || 'local_guest';

  // Synchronous local DB read on frame 0
  const [favorites, setFavorites] = useState(() => {
    const cached = getCachedUserData(effectiveUid);
    return cached?.favorites || [];
  });
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '', icon: '' });
  const [urlSuggestions, setUrlSuggestions] = useState([]);
  const [isUrlManuallyEdited, setIsUrlManuallyEdited] = useState(false);
  const [glassTheme, setGlassTheme] = useState(() => getGlassTheme(effectiveUid));

  useEffect(() => {
    const handleGlassUpdate = (e) => {
      if (e.detail) {
        setGlassTheme(e.detail);
      }
    };
    window.addEventListener('glassThemeUpdate', handleGlassUpdate);
    return () => window.removeEventListener('glassThemeUpdate', handleGlassUpdate);
  }, []);

  const resetForm = () => {
    setNewItem({ name: '', url: '', icon: '' });
    setUrlSuggestions([]);
    setIsUrlManuallyEdited(false);
    setShowAddForm(false);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    const { primaryUrl, suggestions } = getUrlSuggestionsForName(name);
    setUrlSuggestions(suggestions);
    setNewItem((prev) => ({
      ...prev,
      name,
      url: isUrlManuallyEdited ? prev.url : (primaryUrl || prev.url)
    }));
  };

  const handleUrlChange = (e) => {
    setIsUrlManuallyEdited(true);
    setNewItem((prev) => ({ ...prev, url: e.target.value }));
  };

  const handleSelectSuggestion = (suggestedUrl) => {
    setIsUrlManuallyEdited(true);
    setNewItem((prev) => ({ ...prev, url: suggestedUrl }));
  };

  useEffect(() => {
    const cached = getCachedUserData(effectiveUid);
    if (cached?.favorites) {
      setFavorites(cached.favorites);
    }

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      if (userData) {
        setFavorites(userData.favorites || []);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [effectiveUid]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.url.trim()) return;

    let url = newItem.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    let icon = newItem.icon.trim();
    if (!icon) {
      try {
        const domain = new URL(url).hostname;
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch (err) {
        icon = '';
      }
    }

    try {
      const item = {
        name: newItem.name.trim(),
        url,
        icon
      };

      await addFavorite(effectiveUid, item);
      resetForm();
    } catch (error) {
      console.error('Error adding favorite:', error);
    }
  };

  const handleDeleteItem = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteFavorite(effectiveUid, id);
    } catch (error) {
      console.error('Error deleting favorite:', error);
    }
  };

  const getFaviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      return null;
    }
  };

  const favTheme = glassTheme.favorites || glassTheme.shortcuts;

  return (
    <div className="w-full h-full flex flex-col rounded-2xl">
      <div
        className="dark-glass rounded-2xl p-4 sm:p-5 border border-white/10 w-full h-full flex flex-col overflow-y-auto"
        style={{
          ...getGlassStyleForPart(favTheme),
          ...getTextStyleForPart(favTheme),
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center" style={getTextStyleForPart(favTheme)}>
            <Heart size={18} className="mr-2 text-red-400 fill-red-400/20" />
            Favorites
          </h3>
          <button
            onClick={() => {
              if (showAddForm) {
                resetForm();
              } else {
                setShowAddForm(true);
              }
            }}
            style={{
              color: favTheme.textColor || '#ffffff',
              textShadow: getTextStyleForPart(favTheme).textShadow,
              borderColor: getMutedTextStyleForPart(favTheme, 25).color,
            }}
            className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center text-xs font-medium cursor-pointer border"
          >
            <Plus size={14} className="mr-1" />
            Add Favorite
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddItem} className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Name (e.g. GitHub)"
                value={newItem.name}
                onChange={handleNameChange}
                className="px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400"
                required
              />
              <input
                type="text"
                placeholder="URL (e.g. github.com)"
                value={newItem.url}
                onChange={handleUrlChange}
                className="px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400"
                required
              />
              <input
                type="text"
                placeholder="Icon URL (optional)"
                value={newItem.icon}
                onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                className="px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
            {urlSuggestions.length > 0 && (
              <UrlSuggestions
                suggestions={urlSuggestions}
                onSelect={handleSelectSuggestion}
                currentUrl={newItem.url}
              />
            )}
          </form>
        )}

        {/* Favorites List */}
        {loading && favorites.length === 0 ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-b-blue-400"></div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 sm:gap-3 flex-1">
            {favorites.map((favorite) => {
              const iconSrc = favorite.icon || favorite.logo || getFaviconUrl(favorite.url);
              const isImage = typeof iconSrc === 'string' && (iconSrc.startsWith('http') || iconSrc.startsWith('data:'));

              return (
                <div
                  key={favorite.id}
                  onClick={() => { window.location.href = favorite.url; }}
                  className="flex items-center justify-between p-2.5 bg-black/30 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/25 transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      <SiteThumbnail
                        logo={iconSrc}
                        name={favorite.name}
                        url={favorite.url}
                        className="w-5 h-5"
                        fallbackClassName="text-[11px]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-medium text-sm truncate group-hover:text-blue-300 transition-colors"
                        style={getTextStyleForPart(favTheme)}
                      >
                        {favorite.name}
                      </h4>
                      <p
                        className="text-xs truncate"
                        style={getMutedTextStyleForPart(favTheme, 65)}
                      >
                        {favorite.url.replace(/^https?:\/\//i, '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <a
                      href={favorite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: getMutedTextStyleForPart(favTheme, 70).color }}
                      className="p-1.5 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={(e) => handleDeleteItem(e, favorite.id)}
                      style={{ color: getMutedTextStyleForPart(favTheme, 70).color }}
                      className="p-1.5 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete favorite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {favorites.length === 0 && !loading && (
              <div className="col-span-full text-center py-6 text-gray-400">
                <Heart size={36} className="mx-auto mb-2 opacity-30 text-red-400" />
                <p className="text-sm font-medium" style={getTextStyleForPart(favTheme)}>No favorites yet</p>
                <p className="text-xs mt-1" style={getMutedTextStyleForPart(favTheme, 60)}>Add your favorite links or use Settings to customize</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesBar;
