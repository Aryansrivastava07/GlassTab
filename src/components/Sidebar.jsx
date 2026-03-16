import React, { useState, useEffect } from 'react';
import { X, Plus, Heart, Globe, Star, Trash2, Edit2, Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  addFavorite, 
  deleteFavorite, 
  subscribeToUserData,
  updateWallpaper
} from '../services/databaseService';
import { getCachedUserData, updateCachedWallpaper } from '../utils/cacheService';

const Sidebar = ({ isOpen, onClose, currentUser, onLogout }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('favorites');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '', icon: '' });
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [currentWallpaper, setCurrentWallpaper] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    // Load cached data immediately for faster UI
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData) {
      if (cachedData.favorites) {
        setFavorites(cachedData.favorites);
      }
      if (cachedData.wallpaper) {
        setCurrentWallpaper(cachedData.wallpaper);
      }
      setLoading(false);
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setFavorites(userData.favorites || []);
        setCurrentWallpaper(userData.wallpaper || null);
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
        icon: newItem.icon
      };

      await addFavorite(currentUser.uid, item);
      setNewItem({ name: '', url: '', icon: '🔗' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding favorite:', error);
      // Show user-friendly error message
      alert('Failed to add favorite. Please try again.');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!currentUser) return;

    try {
      await deleteFavorite(currentUser.uid, id);
    } catch (error) {
      console.error('Error deleting favorite:', error);
      // Show user-friendly error message
      alert('Failed to delete favorite. Please try again.');
    }
  };

  const handleWallpaperUpdate = async (e) => {
    e.preventDefault();
    if (!currentUser || !wallpaperUrl.trim()) return;

    try {
      const newWallpaperUrl = wallpaperUrl.trim();
      console.log('Updating wallpaper to:', newWallpaperUrl);
      
      // Update UI immediately by dispatching a custom event
      window.dispatchEvent(new CustomEvent('wallpaperUpdate', { 
        detail: { wallpaper: newWallpaperUrl } 
      }));
      
      // Save to cache using the dedicated function
      updateCachedWallpaper(currentUser.uid, newWallpaperUrl);
      
      // Update local state
      setCurrentWallpaper(newWallpaperUrl);
      setWallpaperUrl('');
      
      // Save to Firebase
      await updateWallpaper(currentUser.uid, newWallpaperUrl);
      console.log('Wallpaper updated successfully');
    } catch (error) {
      console.error('Error updating wallpaper:', error);
      alert('Failed to update wallpaper. Please try again.');
    }
  };

  const handleRemoveWallpaper = async () => {
    if (!currentUser) return;

    try {
      console.log('Removing wallpaper...');
      
      // Update UI immediately
      window.dispatchEvent(new CustomEvent('wallpaperUpdate', { 
        detail: { wallpaper: 'https://picsum.photos/1920/1080' } 
      }));
      
      // Remove from cache using the dedicated function
      updateCachedWallpaper(currentUser.uid, null);
      
      // Update local state
      setCurrentWallpaper(null);
      
      // Remove from Firebase
      await updateWallpaper(currentUser.uid, null);
      console.log('Wallpaper removed successfully');
    } catch (error) {
      console.error('Error removing wallpaper:', error);
      alert('Failed to remove wallpaper. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img
                src={currentUser?.photoURL}
                alt="User avatar"
                className="w-10 h-10 rounded-full border-2 border-white"
              />
              <div>
                <h3 className="font-semibold">{currentUser?.displayName}</h3>
                <p className="text-sm opacity-90">{currentUser?.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'favorites'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Heart size={18} className="inline mr-2" />
            Favorites
          </button>
          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'wallpaper'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Image size={18} className="inline mr-2" />
            Wallpaper
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'favorites' && (
            <>
              {loading && favorites.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <>
                  {/* Add Button */}
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center"
                  >
                    <Plus size={18} className="mr-2" />
                    Add Favorite
                  </button>

                  {/* Add Form */}
                  {showAddForm && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <input
                        type="url"
                        placeholder="URL (https://...)"
                        value={newItem.url}
                        onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                        className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <input
                        type="text"
                        placeholder="Icon (emoji)"
                        value={newItem.icon}
                        onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                        className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleAddItem}
                          className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Favorites List */}
                  <div className="space-y-2">
                    {favorites.map((favorite) => (
                      <div
                        key={favorite.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{favorite.icon}</span>
                          <div>
                            <h4 className="font-medium text-gray-800">{favorite.name}</h4>
                            <p className="text-sm text-gray-500 truncate">{favorite.url}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(favorite.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {favorites.length === 0 && !loading && (
                      <div className="text-center py-8 text-gray-500">
                        <Heart size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No favorites yet</p>
                        <p className="text-sm">Add your favorite websites to access them quickly</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'wallpaper' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <Image size={48} className="mx-auto mb-4 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Custom Wallpaper</h3>
                <p className="text-sm text-gray-600">Set any image URL as your background</p>
              </div>

              {/* Current Wallpaper */}
              {currentWallpaper && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Wallpaper</h4>
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={currentWallpaper}
                      alt="Current wallpaper"
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.target.src = 'https://picsum.photos/400/200?random';
                      }}
                    />
                    <button
                      onClick={handleRemoveWallpaper}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{currentWallpaper}</p>
                </div>
              )}

              {/* Wallpaper URL Form */}
              <form onSubmit={handleWallpaperUpdate} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallpaper URL
                  </label>
                  <input
                    type="url"
                    value={wallpaperUrl}
                    onChange={(e) => setWallpaperUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!wallpaperUrl.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set Wallpaper
                </button>
              </form>

              {/* Preset Wallpapers */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Preset Wallpapers</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
                    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop',
                    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
                    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop'
                  ].map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setWallpaperUrl(url)}
                      className="relative rounded-lg overflow-hidden border-2 border-gray-200 hover:border-purple-500 transition-colors"
                    >
                      <img
                        src={url}
                        alt={`Preset ${index + 1}`}
                        className="w-full h-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onLogout}
            className="w-full py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
