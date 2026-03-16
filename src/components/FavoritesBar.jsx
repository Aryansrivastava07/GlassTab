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

const FavoritesBar = () => {
  const { currentUser } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '', icon: '' });

  useEffect(() => {
    if (!currentUser) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    // Load cached data immediately for faster UI
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData && cachedData.favorites) {
      setFavorites(cachedData.favorites);
      setLoading(false);
    }

    // Initialize user data and subscribe to real-time updates
    initializeUserData(currentUser.uid);

    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setFavorites(userData.favorites || []);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!currentUser || !newItem.name || !newItem.url) return;

    try {
      const item = {
        name: newItem.name,
        url: newItem.url,
        icon: newItem.icon || ''
      };

      await addFavorite(currentUser.uid, item);
      setNewItem({ name: '', url: '', icon: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding favorite:', error);
      alert('Failed to add favorite. Please try again.');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!currentUser) return;

    try {
      await deleteFavorite(currentUser.uid, id);
    } catch (error) {
      console.error('Error deleting favorite:', error);
      alert('Failed to delete favorite. Please try again.');
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="w-full mb-8">
      <div className="dark-glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold flex items-center">
            <Heart size={20} className="mr-2 text-red-400" />
            Favorites
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center text-sm"
          >
            <Plus size={16} className="mr-1" />
            Add
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddItem} className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                required
              />
              <input
                type="url"
                placeholder="URL"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                required
              />
              <input
                type="text"
                placeholder="Icon"
                value={newItem.icon}
                onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-500/80 hover:bg-green-500 text-white rounded-lg transition-all duration-200"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Favorites List */}
        {loading && favorites.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.map((favorite) => {
              const icon = favorite.icon || favorite.logo || '';
              const isImage = typeof icon === 'string' && (icon.startsWith('http') || icon.startsWith('data:'));

              return (
                <div
                  key={favorite.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-xl shrink-0">
                      {isImage ? <img src={icon} alt="" className="h-6 w-6" /> : icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">{favorite.name}</h4>
                      <p className="text-xs text-gray-400 truncate">{favorite.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <a
                      href={favorite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-400 hover:bg-white/10 rounded transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => handleDeleteItem(favorite.id)}
                      className="p-1.5 text-red-400 hover:bg-white/10 rounded transition-colors"
                      title="Delete favorite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {favorites.length === 0 && !loading && (
              <div className="col-span-full text-center py-8 text-gray-400">
                <Heart size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">No favorites yet</p>
                <p className="text-xs mt-1">Add your favorite websites to access them quickly</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesBar;
