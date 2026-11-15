import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, Globe, X, CornerDownLeft } from 'lucide-react';
import { getGlassTheme, getGlassStyleForPart, getTextStyleForPart, getMutedTextStyleForPart } from '../utils/glassThemeService';
import { getStoredFeatures } from '../utils/featureToggleService';

const HISTORY_STORAGE_KEY = 'landing_search_history_v1';
const SUGGEST_CACHE_STORAGE_KEY = 'landing_suggest_cache_v1';
const MAX_HISTORY_ITEMS = 20;
const MAX_CACHE_ENTRIES = 80;
const SUGGEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const readSearchHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

const readSuggestCache = () => {
  const map = new Map();
  try {
    const raw = localStorage.getItem(SUGGEST_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return map;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (
        entry &&
        Array.isArray(entry.items) &&
        typeof entry.ts === 'number' &&
        now - entry.ts < SUGGEST_CACHE_TTL_MS
      ) {
        map.set(key, entry.items);
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return map;
};

const persistSuggestCache = (cacheMap) => {
  try {
    const now = Date.now();
    const obj = {};
    for (const [key, items] of cacheMap.entries()) {
      obj[key] = { items, ts: now };
    }
    localStorage.setItem(SUGGEST_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage quota errors
  }
};

const findInstantPrefixSuggestions = (cacheMap, scope, cleanLower) => {
  const exactKey = `${scope}:${cleanLower}`;
  if (cacheMap.has(exactKey)) {
    const items = cacheMap.get(exactKey);
    cacheMap.delete(exactKey);
    cacheMap.set(exactKey, items);
    return { exact: true, items };
  }

  for (let len = cleanLower.length - 1; len >= 1; len--) {
    const prefixItems = cacheMap.get(`${scope}:${cleanLower.slice(0, len)}`);
    if (!prefixItems || prefixItems.length === 0) continue;
    const startsWithMatches = [];
    const containsMatches = [];
    for (const item of prefixItems) {
      const lower = item.toLowerCase();
      if (lower.startsWith(cleanLower)) {
        startsWithMatches.push(item);
      } else if (lower.includes(cleanLower)) {
        containsMatches.push(item);
      }
    }
    if (startsWithMatches.length > 0 || containsMatches.length > 0) {
      return { exact: false, items: [...startsWithMatches, ...containsMatches] };
    }
  }

  return { exact: false, items: null };
};

const saveSearchHistory = (items) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // ignore quota errors
  }
};

const parseEnginePrefix = (rawValue) => {
  const lower = rawValue.toLowerCase();
  if (lower.startsWith('g ')) {
    return { prefix: 'g ', engine: 'Google', badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/30', term: rawValue.slice(2) };
  }
  if (lower.startsWith('b ')) {
    return { prefix: 'b ', engine: 'Bing', badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30', term: rawValue.slice(2) };
  }
  if (lower.startsWith('y ')) {
    return { prefix: 'y ', engine: 'YouTube', badgeClass: 'bg-red-500/20 text-red-300 border-red-400/30', term: rawValue.slice(2) };
  }
  return { prefix: '', engine: null, badgeClass: '', term: rawValue };
};

const isLikelyUrl = (text) => {
  const q = text.trim();
  if (!q || q.includes(' ')) return false;
  if (/^https?:\/\//i.test(q)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(q);
};

const fetchSuggestList = async (cleanTerm, isYouTube, signal) => {
  const dsParam = isYouTube ? '&ds=yt' : '';
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en${dsParam}&q=${encodeURIComponent(cleanTerm)}`;

  // Guard every network call with a tight 2.5s timeout paired with the caller's abort signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 2500);
  const onOuterAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  // 1. Direct fetch from extension page (lowest latency, HTTP cache enabled, no cookies)
  try {
    const res = await fetch(url, {
      signal: timeoutController.signal,
      credentials: 'omit',
      cache: 'default',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[1])) {
        return data[1].map((item) => String(item)).filter(Boolean);
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    // Fall through to background SW proxy if running under strict CORS
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onOuterAbort);
  }

  // 2. Fallback via MV3 background service worker (cached CORS-free fetch)
  if (typeof window !== 'undefined' && window.chrome?.runtime?.sendMessage) {
    const bgRes = await new Promise((resolve) => {
      window.chrome.runtime.sendMessage(
        { type: 'WIDGET_FETCH', url, options: { cacheTtlMs: 300000 } },
        (response) => {
          if (window.chrome.runtime.lastError || !response) {
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    });
    if (bgRes?.ok && bgRes.text) {
      const data = JSON.parse(bgRes.text);
      if (Array.isArray(data?.[1])) {
        return data[1].map((item) => String(item)).filter(Boolean);
      }
    }
  }

  return [];
};

const isAnyModalOpen = () => {
  try {
    // 1. Explicit modal attributes
    const modalCandidates = document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], .modal-backdrop, [data-modal="true"]'
    );
    for (const el of modalCandidates) {
      if (el.offsetParent !== null || window.getComputedStyle(el).display !== 'none') {
        return true;
      }
    }
    // 2. High z-index modal backdrops (Widget Studio, Notes, Todos, Speed Dial modal)
    // Exclude full-viewport dashboard layers (#ai-studio-overlay and .wallpaper-container)
    const overlayCandidates = document.querySelectorAll(
      'div.fixed.inset-0:not(#ai-studio-overlay):not(.wallpaper-container):not(.pointer-events-none)'
    );
    for (const el of overlayCandidates) {
      const comp = window.getComputedStyle(el);
      if (
        comp.display !== 'none' &&
        comp.visibility !== 'hidden' &&
        comp.pointerEvents !== 'none' &&
        parseFloat(comp.opacity || '1') > 0
      ) {
        return true;
      }
    }
  } catch {
    // fallback
  }
  return false;
};

const SearchBar = ({ isDashboardActive = true }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => readSearchHistory());
  const [remoteSuggestions, setRemoteSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [glassTheme, setGlassTheme] = useState(() => getGlassTheme());
  const [features, setFeatures] = useState(() => getStoredFeatures());

  useEffect(() => {
    const handleGlassUpdate = (e) => {
      if (e.detail) {
        setGlassTheme(e.detail);
      }
    };
    const handleFeaturesUpdate = (e) => {
      setFeatures(e.detail || getStoredFeatures());
    };
    window.addEventListener('glassThemeUpdate', handleGlassUpdate);
    window.addEventListener('landing_features_updated', handleFeaturesUpdate);
    return () => {
      window.removeEventListener('glassThemeUpdate', handleGlassUpdate);
      window.removeEventListener('landing_features_updated', handleFeaturesUpdate);
    };
  }, []);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const suggestCacheRef = useRef(null);
  const reqSeqRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const abortControllerRef = useRef(null);

  const { prefix, engine, badgeClass, term } = useMemo(
    () => parseEnginePrefix(searchQuery),
    [searchQuery]
  );

  // Measure search bar bounding box for portal dropdown positioning
  const updateDropdownRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 8,
      bottom: rect.top - 8,
      left: rect.left,
      width: rect.width,
      viewportHeight: window.innerHeight,
    });
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    updateDropdownRect();

    const handleReposition = () => updateDropdownRect();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    let observer;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(handleReposition);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      observer?.disconnect();
    };
  }, [isDropdownOpen, updateDropdownRect]);

  // Autofocus search input on initial mount (handles Chrome & Edge address bar focus timing)
  const hasAttemptedInitialFocusRef = useRef(false);
  useEffect(() => {
    if (!isDashboardActive || hasAttemptedInitialFocusRef.current) return;
    if (features.autoFocusSearch === false) return;
    hasAttemptedInitialFocusRef.current = true;

    const tryFocus = () => {
      if (isAnyModalOpen()) return false;
      if (document.activeElement === inputRef.current) return true;
      const isAnotherInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.isContentEditable;
      if (!isAnotherInput && inputRef.current) {
        window.focus();
        inputRef.current.focus({ preventScroll: true });
        return document.activeElement === inputRef.current;
      }
      return false;
    };

    // Try immediately on mount
    if (tryFocus()) return;

    let attempts = 0;
    const focusInterval = setInterval(() => {
      attempts++;
      if (tryFocus() || attempts >= 20) {
        clearInterval(focusInterval);
      }
    }, 30);

    return () => clearInterval(focusInterval);
  }, [isDashboardActive, features.autoFocusSearch]);

  // Type-anywhere-to-focus on Dashboard + SearchBar keyboard shortcuts
  useEffect(() => {
    if (!isDashboardActive) return;

    const handleGlobalKeyDown = (e) => {
      const target = e.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      // If already focused inside our search input:
      if (target === inputRef.current) {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          setSearchQuery('');
          setActiveIndex(-1);
        } else if (e.shiftKey && e.key === 'Backspace') {
          e.preventDefault();
          setSearchQuery('');
          setActiveIndex(-1);
        }
        return;
      }

      // If typing in another editable element or a modal is open, do not steal:
      if (isEditable) return;
      if (isAnyModalOpen()) return;

      // Ignore modifier keys and browser navigation shortcuts:
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.startsWith('F') && e.key.length > 1) return; // F1 - F12
      if (['Escape', 'Tab', 'CapsLock', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      // Don't hijack Space or Enter if user is deliberately clicking an active button or link
      if ((e.key === ' ' || e.key === 'Enter') && target?.closest?.('button, a, [role="button"]')) {
        return;
      }

      // '/' focuses search bar cleanly
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
        return;
      }

      // Backspace when on dashboard focuses search bar and pops last character
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true });
        }
        setSearchQuery((prev) => {
          const updated = prev.slice(0, -1);
          setTimeout(() => {
            if (inputRef.current) {
              const len = updated.length;
              inputRef.current.setSelectionRange(len, len);
            }
          }, 0);
          return updated;
        });
        return;
      }

      // Any single printable character typed on the dashboard immediately focuses and types into search!
      if (e.key.length === 1 && !e.isComposing) {
        e.preventDefault();
        const char = e.key;
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true });
        }
        setSearchQuery((prev) => {
          const updated = prev + char;
          setTimeout(() => {
            if (inputRef.current) {
              const len = updated.length;
              inputRef.current.setSelectionRange(len, len);
            }
          }, 0);
          return updated;
        });
        setIsDropdownOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isDashboardActive]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideMouseDown = (e) => {
      if (containerRef.current && containerRef.current.contains(e.target)) return;
      if (e.target?.closest?.('[data-search-dropdown="true"]')) return;
      setIsDropdownOpen(false);
      setActiveIndex(-1);
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, []);

  // Fast leading+debounced, persistently cached, prefix-filtered autocomplete fetcher
  useEffect(() => {
    if (!features.searchSuggestions) {
      abortControllerRef.current?.abort();
      setRemoteSuggestions([]);
      return;
    }
    const cleanTerm = term.trim();
    if (!cleanTerm || isLikelyUrl(searchQuery)) {
      abortControllerRef.current?.abort();
      setRemoteSuggestions([]);
      return;
    }

    if (suggestCacheRef.current === null) {
      suggestCacheRef.current = readSuggestCache();
    }
    const cache = suggestCacheRef.current;
    const scope = prefix || 'g';
    const cleanLower = cleanTerm.toLowerCase();
    const cacheKey = `${scope}:${cleanLower}`;

    const instant = findInstantPrefixSuggestions(cache, scope, cleanLower);
    if (instant.exact && instant.items) {
      setRemoteSuggestions(instant.items);
      return;
    }
    if (instant.items) {
      // Show 0ms locally narrowed suggestions while fresh remote results load
      setRemoteSuggestions(instant.items);
    }

    const seq = ++reqSeqRef.current;
    const elapsedSinceLastFetch = Date.now() - lastFetchAtRef.current;
    const delayMs = elapsedSinceLastFetch >= 90 ? 0 : 35;

    const timer = setTimeout(async () => {
      lastFetchAtRef.current = Date.now();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const list = await fetchSuggestList(cleanTerm, prefix === 'y ', controller.signal);
        if (seq !== reqSeqRef.current) return;

        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        cache.set(cacheKey, list);
        persistSuggestCache(cache);
        setRemoteSuggestions(list);
      } catch (err) {
        if (err?.name !== 'AbortError' && seq === reqSeqRef.current && !instant.items) {
          setRemoteSuggestions([]);
        }
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [term, prefix, searchQuery]);

  // Abort any in-flight suggestion request on unmount
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  // Keep keyboard-highlighted dropdown row scrolled into view
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Build merged, deduplicated suggestion items (0ms history + URL shortcut + live web suggestions)
  const suggestions = useMemo(() => {
    if (!features.searchSuggestions) return [];
    const items = [];
    const seen = new Set();
    const trimmed = searchQuery.trim();
    const cleanLower = term.trim().toLowerCase();

    if (trimmed && isLikelyUrl(trimmed)) {
      const targetUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      items.push({
        type: 'url',
        value: trimmed,
        display: targetUrl,
      });
      seen.add(trimmed.toLowerCase());
    }

    // History matches (up to 6 when empty, up to 3 when filtering)
    const historyLimit = cleanLower ? 3 : 6;
    let historyAdded = 0;
    for (const h of searchHistory) {
      if (historyAdded >= historyLimit) break;
      const hLower = h.toLowerCase();
      if (!cleanLower || hLower.includes(cleanLower) || hLower.includes(trimmed.toLowerCase())) {
        if (!seen.has(hLower)) {
          seen.add(hLower);
          items.push({
            type: 'history',
            value: h,
            display: h,
          });
          historyAdded++;
        }
      }
    }

    // Live remote suggestions
    for (const sug of remoteSuggestions) {
      if (items.length >= 9) break;
      const fullValue = prefix ? `${prefix}${sug}` : sug;
      const dedupeKey = fullValue.toLowerCase();
      if (!seen.has(dedupeKey) && !seen.has(sug.toLowerCase())) {
        seen.add(dedupeKey);
        items.push({
          type: 'suggest',
          value: fullValue,
          display: sug,
        });
      }
    }

    return items;
  }, [searchQuery, term, prefix, searchHistory, remoteSuggestions, features.searchSuggestions]);

  const executeSearch = useCallback(
    (rawInput) => {
      const query = String(rawInput ?? searchQuery).trim();
      if (!query) return;

      const updatedHistory = [
        query,
        ...searchHistory.filter((item) => item.toLowerCase() !== query.toLowerCase()),
      ].slice(0, MAX_HISTORY_ITEMS);
      setSearchHistory(updatedHistory);
      saveSearchHistory(updatedHistory);

      let searchUrl = '';
      const lower = query.toLowerCase();
      if (lower.startsWith('g ')) {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query.slice(2))}`;
      } else if (lower.startsWith('b ')) {
        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query.slice(2))}`;
      } else if (lower.startsWith('y ')) {
        searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.slice(2))}`;
      } else if (/^https?:\/\//i.test(query)) {
        searchUrl = query;
      } else if (isLikelyUrl(query)) {
        searchUrl = `https://${query}`;
      } else {
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }

      setIsDropdownOpen(false);
      setActiveIndex(-1);
      window.location.href = searchUrl;
    },
    [searchQuery, searchHistory]
  );

  const handleRemoveHistoryItem = (e, itemValue) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = searchHistory.filter((h) => h.toLowerCase() !== itemValue.toLowerCase());
    setSearchHistory(updated);
    saveSearchHistory(updated);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveIndex((prev) => (prev + 1 >= suggestions.length ? -1 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveIndex((prev) => (prev <= -1 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Tab' && isDropdownOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      setSearchQuery(suggestions[activeIndex].value);
      setActiveIndex(-1);
    } else if (e.key === 'Escape') {
      if (isDropdownOpen) {
        e.preventDefault();
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      } else {
        inputRef.current?.blur();
      }
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (isDropdownOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      executeSearch(suggestions[activeIndex].value);
      return;
    }
    executeSearch(searchQuery);
  };

  const renderHighlightedMatch = (text) => {
    const q = term.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        <span className="text-gray-300">{text.slice(0, idx)}</span>
        <span className="text-white font-semibold">{text.slice(idx, idx + q.length)}</span>
        <span className="text-gray-300">{text.slice(idx + q.length)}</span>
      </>
    );
  };

  const showDropdown = isFocused && isDropdownOpen && suggestions.length > 0 && dropdownRect;

  // Flip upward if search bar is near the bottom of the screen
  const spaceBelow = dropdownRect ? dropdownRect.viewportHeight - dropdownRect.top - 16 : 360;
  const openUpward = dropdownRect ? spaceBelow < 180 && dropdownRect.bottom > 200 : false;
  const maxDropdownHeight = dropdownRect
    ? Math.max(140, Math.min(340, openUpward ? dropdownRect.bottom - 16 : spaceBelow))
    : 320;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center rounded-full">
      <form onSubmit={handleFormSubmit} className="relative w-full h-full flex items-center rounded-full">
        <div
          onClick={() => inputRef.current?.focus({ preventScroll: true })}
          className="search-container rounded-full w-full h-full flex items-center relative"
          style={{
            ...getGlassStyleForPart(glassTheme.search),
            ...getTextStyleForPart(glassTheme.search),
          }}
        >
          <Search
            size={17}
            className="ml-5 shrink-0 pointer-events-none transition-colors"
            style={{ color: getMutedTextStyleForPart(glassTheme.search, 70).color }}
          />

          {engine && (
            <span
              className={`ml-2.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 select-none ${badgeClass}`}
            >
              {engine}
            </span>
          )}

          <input
            ref={inputRef}
            id="searchInput"
            type="text"
            autoFocus={features.autoFocusSearch !== false}
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onFocus={() => {
              setIsFocused(true);
              setIsDropdownOpen(true);
              updateDropdownRect();
            }}
            onBlur={() => {
              setIsFocused(false);
              setIsDropdownOpen(false);
              setActiveIndex(-1);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search the web or type g / b / y ..."
            style={{
              color: glassTheme.search.textColor || '#ffffff',
              textShadow: getTextStyleForPart(glassTheme.search).textShadow,
            }}
            className={`w-full h-full ${engine ? 'pl-2.5' : 'pl-3'} pr-28 text-base sm:text-lg bg-transparent border-none rounded-full focus:outline-none placeholder-gray-400`}
          />

          {searchQuery && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSearchQuery('');
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              style={{ color: getMutedTextStyleForPart(glassTheme.search, 70).color }}
              className="mr-24 p-1.5 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}

          <button
            type="submit"
            style={{
              color: glassTheme.search.textColor || '#ffffff',
              textShadow: getTextStyleForPart(glassTheme.search).textShadow,
              borderColor: getMutedTextStyleForPart(glassTheme.search, 25).color,
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/10 px-5 py-2 rounded-full hover:bg-white/20 transition-all duration-200 border text-sm font-medium cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      {/* Portal Autocomplete Dropdown (renders cleanly above SpeedDials & Custom Widgets) */}
      {showDropdown &&
        createPortal(
          <div
            data-search-dropdown="true"
            style={{
              position: 'fixed',
              left: `${dropdownRect.left}px`,
              width: `${dropdownRect.width}px`,
              ...(openUpward
                ? { bottom: `${dropdownRect.viewportHeight - dropdownRect.bottom}px` }
                : { top: `${dropdownRect.top}px` }),
              maxHeight: `${maxDropdownHeight}px`,
              zIndex: 9990,
              ...getGlassStyleForPart(glassTheme.search),
              ...getTextStyleForPart(glassTheme.search),
            }}
            className="dark-glass rounded-2xl border border-white/15 shadow-2xl overflow-y-auto py-1.5"
          >
            {suggestions.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={`${item.type}_${item.value}`}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onMouseDown={(e) => {
                    // Keep input focused so click fires reliably before blur closes dropdown
                    e.preventDefault();
                  }}
                  onClick={() => executeSearch(item.value)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSearchQuery(item.value);
                    setActiveIndex(-1);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    isSelected ? 'bg-white/15 text-white' : 'text-gray-200 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.type === 'history' ? (
                      <Clock size={15} className="text-blue-300/80 shrink-0" />
                    ) : item.type === 'url' ? (
                      <Globe size={15} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Search size={15} className="text-gray-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {item.type === 'url'
                        ? item.display
                        : renderHighlightedMatch(item.display)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.type === 'history' && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => handleRemoveHistoryItem(e, item.value)}
                        className="p-1 text-gray-400 hover:text-red-300 rounded-md hover:bg-white/10 transition cursor-pointer"
                        title="Remove from recent searches"
                      >
                        <X size={13} />
                      </button>
                    )}
                    {isSelected && <CornerDownLeft size={13} className="text-gray-400" />}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

export default SearchBar;
