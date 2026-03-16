import React, { useState, useEffect } from "react";
import { MapPin, Edit2, X } from "lucide-react";

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState("Delhi");
  const [isEditing, setIsEditing] = useState(false);
  const [tempLocation, setTempLocation] = useState("");

  const cities = [
    "Delhi",
    "Mumbai",
    "Bangalore",
    "Chennai",
    "Kolkata",
    "Hyderabad",
    "Pune",
    "Ahmedabad",
    "Jaipur",
    "Lucknow",
  ];

  useEffect(() => {
    fetchWeather();
  }, [location]);

  const fetchWeather = async () => {
    try {
      // Since we don't have a valid API key, use mock data
      // To use real weather, get a free API key from https://openweathermap.org/api
      const mockWeatherData = {
        temp: Math.floor(Math.random() * 15) + 20,
        description: "Partly Cloudy",
        icon: "02d",
        location: location,
      };

      setWeather(mockWeatherData);

      // If you want to use real API, uncomment and replace YOUR_API_KEY:
      /*
      const apiKey = 'YOUR_API_KEY'; // Replace with actual API key from openweathermap.org
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=metric`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWeather({
          temp: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          location: data.name
        });
      } else {
        // Fallback to mock data
        setWeather(mockWeatherData);
      }
      */
    } catch (error) {
      console.error("Error fetching weather:", error);
      // Fallback to mock data
      setWeather({
        temp: Math.floor(Math.random() * 15) + 20,
        description: "Partly Cloudy",
        icon: "02d",
        location: location,
      });
    }
  };

  const handleLocationSubmit = (e) => {
    e.preventDefault();
    if (tempLocation.trim()) {
      setLocation(tempLocation.trim());
      setIsEditing(false);
      setTempLocation("");
    }
  };

  const getWeatherIcon = (iconCode) => {
    const iconMap = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "⛅",
      "02n": "☁️",
      "03d": "☁️",
      "03n": "☁️",
      "04d": "☁️",
      "04n": "☁️",
      "09d": "🌧️",
      "09n": "🌧️",
      "10d": "🌦️",
      "10n": "🌧️",
      "11d": "⛈️",
      "11n": "⛈️",
      "13d": "❄️",
      "13n": "❄️",
      "50d": "🌫️",
      "50n": "🌫️",
    };
    return iconMap[iconCode] || "🌤️";
  };

  return (
    <div className="weather w-28">
      <div className="editLocation">
        <span>
          {!isEditing ? (
            <button
              type="button"
              className="locationButton"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="locationButton cancelButton"
              onClick={() => {
                setIsEditing(false);
                setTempLocation("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </span>

        {isEditing ? (
          <form onSubmit={handleLocationSubmit} className="locationForm">
            <input
              type="text"
              list="cityOptions"
              value={tempLocation}
              onChange={(e) => setTempLocation(e.target.value)}
              placeholder="Enter Your City"
              className="locationInput"
              autoFocus
            />
            <datalist id="cityOptions">
              {cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </form>
        ) : (
          <div className="locationName">{weather?.location || location}</div>
        )}
      </div>

      <div className="weatherReport">
        <div className="weatherIcon">
          {weather ? getWeatherIcon(weather.icon) : "🌤️"}
        </div>
        <div>
          <p className="temp">{weather ? `${weather.temp}°C` : "--°C"}</p>
          <p className="sum">{weather?.description || "Loading..."}</p>
        </div>
      </div>

      <style>{`
        .weather {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          min-width: 200px;
        }

        .editLocation {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .locationButton {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          color: #6b7280;
          transition: color 0.2s;
        }

        .locationButton:hover {
          color: #374151;
        }

        .cancelButton {
          color: #ef4444;
        }

        .locationForm {
          flex: 1;
        }

        .locationInput {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .locationName {
          flex: 1;
          font-weight: 500;
          color: #374151;
        }

        .weatherReport {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .weatherIcon {
          font-size: 2rem;
        }

        .temp {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1f2937;
          margin: 0;
        }

        .sum {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0;
          text-transform: capitalize;
        }
      `}</style>
    </div>
  );
};

export default WeatherWidget;
