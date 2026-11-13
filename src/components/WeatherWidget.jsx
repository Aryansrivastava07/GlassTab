import React, { useState, useEffect } from "react";
import { MapPin, Edit2, Check, X, RefreshCw } from "lucide-react";
import {
  getGlassTheme,
  getGlassStyleForPart,
  getTextStyleForPart,
  getMutedTextStyleForPart,
} from "../utils/glassThemeService";

const API_KEY = "0dc6ac6acd894f5a91d91701251502";
const WEATHER_CACHE_KEY = "landing_weather_cache";
const WEATHER_STALE_MS = 15 * 60 * 1000; // Refresh quietly in background every 15 mins

const readCachedWeather = () => {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch {
    return null;
  }
};

const WeatherWidget = () => {
  const initialCache = readCachedWeather();
  const [weather, setWeather] = useState(() => initialCache?.data || null);
  const [location, setLocation] = useState(
    () => initialCache?.data?.city || localStorage.getItem("weather_city") || "Delhi"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [glassTheme, setGlassTheme] = useState(() => getGlassTheme());

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) setGlassTheme(e.detail);
    };
    window.addEventListener('glassThemeUpdate', handleUpdate);
    return () => window.removeEventListener('glassThemeUpdate', handleUpdate);
  }, []);

  const widgetTheme = glassTheme?.widgets || {
    blur: 10,
    color: '#000000',
    opacity: 45,
    textColor: '#ffffff',
    textShadow: false,
  };

  const fetchWeatherByQuery = async (query, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Weather request failed");
      const data = await res.json();
      const parsed = {
        temp: Math.round(data.current.temp_c),
        condition: data.current.condition.text,
        icon: data.current.condition.icon ? `https:${data.current.condition.icon}` : null,
        city: data.location.name,
        country: data.location.country,
        humidity: data.current.humidity,
        wind: Math.round(data.current.wind_kph),
      };
      setWeather(parsed);
      setLocation(data.location.name);
      localStorage.setItem("weather_city", data.location.name);
      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ data: parsed, fetchedAt: Date.now() })
      );
    } catch (err) {
      console.warn("Weather background update failed (using cached):", err.message);
      setWeather((prev) =>
        prev || {
          temp: 24,
          condition: "Clear",
          icon: null,
          city: location,
          country: "",
          humidity: 50,
          wind: 10,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = readCachedWeather();
    const isFresh = cached && Date.now() - cached.fetchedAt < WEATHER_STALE_MS;

    // Never block paint — only run background refresh when stale or missing
    if (isFresh) return;

    const timer = setTimeout(() => {
      const savedCity = localStorage.getItem("weather_city");
      if (!savedCity && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
            fetchWeatherByQuery(coords, true);
          },
          () => {
            fetchWeatherByQuery(location, true);
          },
          { timeout: 4000 }
        );
      } else {
        fetchWeatherByQuery(location, true);
      }
    }, 50);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocationSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) {
      fetchWeatherByQuery(inputVal.trim(), false);
      setIsEditing(false);
      setInputVal("");
    }
  };

  return (
    <div
      className="weather-widget p-3 sm:p-4 w-full h-full flex flex-col justify-between select-none overflow-hidden"
      style={{
        ...getGlassStyleForPart(widgetTheme),
        ...getTextStyleForPart(widgetTheme),
      }}
    >
      {/* Location row */}
      <div className="flex items-center justify-between mb-2">
        {isEditing ? (
          <form onSubmit={handleLocationSubmit} className="flex items-center gap-1 w-full">
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="City name..."
              className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
            />
            <button type="submit" className="p-1 hover:text-green-400 transition-colors" title="Save">
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1 hover:text-red-400 transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <div
            className="flex items-center gap-1.5 cursor-pointer group text-xs transition-colors"
            style={getTextStyleForPart(widgetTheme)}
            onClick={() => {
              setInputVal(location);
              setIsEditing(true);
            }}
            title="Click to change city"
          >
            <MapPin size={13} className="text-red-400 shrink-0" />
            <span className="font-medium truncate max-w-[140px]">{weather?.city || location}</span>
            <Edit2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
          </div>
        )}

        {!isEditing && (
          <button
            onClick={() => fetchWeatherByQuery(location, false)}
            className="transition-colors p-1 cursor-pointer opacity-80 hover:opacity-100"
            style={{ color: widgetTheme.textColor || '#ffffff' }}
            title="Refresh weather"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {/* Main weather report */}
      <div className="flex items-center gap-3">
        {weather?.icon ? (
          <img
            src={weather.icon}
            alt={weather.condition}
            className="w-12 h-12 shrink-0 filter drop-shadow"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <span className="text-3xl shrink-0">🌤️</span>
        )}

        <div className="flex flex-col">
          <div
            className="text-2xl font-bold tracking-tight leading-none mb-1"
            style={getTextStyleForPart(widgetTheme)}
          >
            {weather ? `${weather.temp}°C` : "--°C"}
          </div>
          <div
            className="text-xs capitalize truncate max-w-[130px]"
            style={getMutedTextStyleForPart(widgetTheme, 75)}
          >
            {weather?.condition || "Syncing..."}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
