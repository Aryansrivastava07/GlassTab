import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  initializeUserData,
  addSpeedDial,
  deleteSpeedDial,
  subscribeToUserData,
} from "../services/databaseService";
import { getCachedUserData } from "../utils/cacheService";
import { getUrlSuggestionsForName } from "../utils/urlSuggestionService";
import UrlSuggestions from "./UrlSuggestions";
import { getGlassTheme, getGlassStyleForPart, getTextStyleForPart, getMutedTextStyleForPart } from "../utils/glassThemeService";

const FALLBACK_SPEED_DIALS = [
  { id: 1, name: "Google", url: "https://google.com", logo: "https://www.google.com/s2/favicons?domain=google.com&sz=128" },
  { id: 2, name: "YouTube", url: "https://youtube.com", logo: "https://www.google.com/s2/favicons?domain=youtube.com&sz=128" },
  { id: 3, name: "GitHub", url: "https://github.com", logo: "https://www.google.com/s2/favicons?domain=github.com&sz=128" },
  { id: 4, name: "ChatGPT", url: "https://chatgpt.com", logo: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128" },
  { id: 5, name: "Reddit", url: "https://reddit.com", logo: "https://www.google.com/s2/favicons?domain=reddit.com&sz=128" },
  { id: 6, name: "LinkedIn", url: "https://linkedin.com", logo: "https://www.google.com/s2/favicons?domain=linkedin.com&sz=128" },
];

const SpeedDials = ({ onCountChange }) => {
  const containerRef = useRef(null);
  const { currentUser } = useAuth();
  const effectiveUid = currentUser?.uid || "local_guest";

  // Synchronous local DB read on frame 0 (no flicker!)
  const [speedDials, setSpeedDials] = useState(() => {
    const cached = getCachedUserData(effectiveUid);
    return cached?.speedDials?.length > 0 ? cached.speedDials : FALLBACK_SPEED_DIALS;
  });
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", url: "", logo: "" });
  const [urlSuggestions, setUrlSuggestions] = useState([]);
  const [isUrlManuallyEdited, setIsUrlManuallyEdited] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 720, height: 125 });
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
    setNewItem({ name: "", url: "", logo: "" });
    setUrlSuggestions([]);
    setIsUrlManuallyEdited(false);
    setShowAddDialog(false);
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
    if (onCountChange) {
      onCountChange(speedDials.length);
    }
  }, [speedDials.length, onCountChange]);

  // Measure container dimensions on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setContainerSize({
            width: Math.round(entry.contentRect.width),
            height: Math.round(entry.contentRect.height),
          });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cached = getCachedUserData(effectiveUid);
    if (cached?.speedDials?.length > 0) {
      setSpeedDials(cached.speedDials);
    }

    const unsubscribe = subscribeToUserData(effectiveUid, (userData) => {
      if (userData && Array.isArray(userData.speedDials) && userData.speedDials.length > 0) {
        setSpeedDials(userData.speedDials);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [effectiveUid]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.url.trim()) return;

    try {
      let finalUrl = newItem.url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }

      let domain = "";
      try {
        domain = new URL(finalUrl).hostname;
      } catch {
        domain = finalUrl;
      }

      const item = {
        name: newItem.name.trim(),
        url: finalUrl,
        logo:
          newItem.logo.trim() ||
          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      };

      await addSpeedDial(effectiveUid, item);
      resetForm();
    } catch (error) {
      console.error("Error adding speed dial:", error);
    }
  };

  const handleDeleteItem = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteSpeedDial(effectiveUid, id);
    } catch (error) {
      console.error("Error deleting speed dial:", error);
    }
  };

  // Calculate grid capacity based on width and height
  const slotWidth = 92;
  const numCols = Math.max(1, Math.floor((containerSize.width + 12) / slotWidth));
  const slotHeight = 92;
  const numRows = Math.max(1, Math.floor((containerSize.height + 12) / slotHeight));
  const totalCapacity = numCols * numRows;

  // Extra width/capacity will render as dotted thumbnail placeholder areas
  const emptySlotsCount = Math.max(0, totalCapacity - speedDials.length);

  return (
    <div
      ref={containerRef}
      className="speed-dials-dock relative w-full h-full dark-glass rounded-2xl p-3 sm:p-3.5 border border-white/10 shadow-2xl flex flex-col items-center overflow-hidden select-none group"
      style={{
        ...getGlassStyleForPart(glassTheme.speedDial),
        ...getTextStyleForPart(glassTheme.speedDial),
      }}
    >
      {/* Quick Add shortcut button on dock corner */}
      <button
        onClick={() => setShowAddDialog(true)}
        style={{ color: getMutedTextStyleForPart(glassTheme.speedDial, 70).color }}
        className="absolute top-1.5 right-1.5 p-1 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 cursor-pointer z-10"
        title="Add Shortcut"
      >
        <Plus size={14} />
      </button>

      <div className="my-auto w-full flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {/* 1. Existing Shortcut Items */}
        {speedDials.map((item) => (
          <div
            key={item.id}
            onClick={() => { window.location.href = item.url; }}
            className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-white/10 transition-all duration-200 group/item relative cursor-pointer w-16 sm:w-20"
          >
            {/* Icon Tile */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center shadow-md group-hover/item:scale-105 group-hover/item:border-white/35 group-hover/item:shadow-blue-500/20 group-hover/item:shadow-lg transition-all duration-200 overflow-hidden">
              <img
                src={item.logo}
                alt={item.name}
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=2563eb&color=fff&size=64`;
                }}
              />
            </div>

            {/* Name with custom text contrast */}
            <p
              className="text-[11px] sm:text-xs font-medium mt-1 truncate max-w-[64px] sm:max-w-[76px] text-center tracking-tight transition-colors"
              style={getTextStyleForPart(glassTheme.speedDial)}
            >
              {item.name}
            </p>

            {/* Delete button */}
            <button
              onClick={(e) => handleDeleteItem(e, item.id)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg cursor-pointer"
              title="Delete shortcut"
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {/* 2. Dotted Thumbnail Areas for Empty Columns when having extra width */}
        {Array.from({ length: emptySlotsCount }).map((_, index) => (
          <div
            key={`empty-slot-${index}`}
            onClick={() => setShowAddDialog(true)}
            className="flex flex-col items-center justify-center p-1.5 rounded-xl group/slot cursor-pointer w-16 sm:w-20 transition-all duration-200"
            title="Add shortcut to this slot"
          >
            {/* Dotted Thumbnail Box */}
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-dashed group-hover/slot:border-blue-400/80 bg-white/[0.02] group-hover/slot:bg-blue-500/10 flex flex-col items-center justify-center group-hover/slot:text-blue-300 group-hover/slot:scale-105 transition-all duration-200 shadow-inner"
              style={{
                borderColor: getMutedTextStyleForPart(glassTheme.speedDial, 25).color,
                color: getMutedTextStyleForPart(glassTheme.speedDial, 60).color,
              }}
            >
              <Plus size={16} className="group-hover/slot:rotate-90 transition-transform duration-200" />
            </div>
            <p
              className="text-[10px] sm:text-[11px] font-medium mt-1 truncate max-w-[64px] sm:max-w-[76px] text-center tracking-tight transition-colors"
              style={getMutedTextStyleForPart(glassTheme.speedDial, 65)}
            >
              Add
            </p>
          </div>
        ))}

        {/* 3. Initial Add button if there are zero shortcuts */}
        {speedDials.length === 0 && emptySlotsCount === 0 && (
          <div
            onClick={() => setShowAddDialog(true)}
            className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-white/10 transition-all duration-200 group/slot cursor-pointer w-16 sm:w-20"
            title="Add Shortcut"
          >
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-dashed group-hover/slot:border-blue-400 bg-white/5 group-hover/slot:bg-blue-500/10 flex items-center justify-center group-hover/slot:text-blue-300 group-hover/slot:scale-105 transition-all duration-200 shadow-md"
              style={{
                borderColor: getMutedTextStyleForPart(glassTheme.speedDial, 35).color,
                color: getMutedTextStyleForPart(glassTheme.speedDial, 75).color,
              }}
            >
              <Plus size={18} />
            </div>
            <p
              className="text-[11px] sm:text-xs font-medium mt-1 tracking-tight transition-colors"
              style={getTextStyleForPart(glassTheme.speedDial)}
            >
              Add
            </p>
          </div>
        )}
      </div>

      {/* Add Modal rendered via portal directly on document.body */}
      {showAddDialog &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/75 z-[99999] flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
            onClick={() => setShowAddDialog(false)}
          >
            <div
              className="bg-[#14161f] border border-white/15 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-base font-semibold">Add Shortcut</h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. YouTube"
                    value={newItem.name}
                    onChange={handleNameChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">URL</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. youtube.com"
                    value={newItem.url}
                    onChange={handleUrlChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                  />
                  {urlSuggestions.length > 0 && (
                    <UrlSuggestions
                      suggestions={urlSuggestions}
                      onSelect={handleSelectSuggestion}
                      currentUrl={newItem.url}
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">Icon URL (optional)</label>
                  <input
                    type="url"
                    placeholder="Leave empty for auto-favicon"
                    value={newItem.logo}
                    onChange={(e) => setNewItem({ ...newItem, logo: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition cursor-pointer"
                  >
                    Add Shortcut
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-sm transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SpeedDials;
