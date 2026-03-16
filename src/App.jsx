import { AuthProvider } from "./context/AuthContext";
import SearchBar from "./components/SearchBar";
import SpeedDials from "./components/SpeedDials";
import WelcomePopup from "./components/WelcomePopup";
import WallpaperManager from "./components/WallpaperManager";
import FavoritesBar from "./components/FavoritesBar";
import TodosButton from "./components/TodosButton";
import NotesOnlyButton from "./components/NotesOnlyButton";
import NotesButton from "./components/NotesButton";
import { useState, useEffect, Suspense, lazy } from "react";
import "./App.css";

// Lazy load non-critical components
const LazyWeatherWidget = lazy(() => import("./components/WeatherWidget"));
const LazyAnalogClock = lazy(() => import("./components/AnalogClock"));

function App() {
  const [showSecondary, setShowSecondary] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSecondary(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen relative">
        {/* Critical: Load immediately - wallpaper is background */}
        <WallpaperManager />

        {showSecondary && (
          <div className="p-5 w-full grid grid-cols-3 gap-6 mb-8 animate-fadeIn items-start">
            {/* Weather widget - left */}
            <Suspense
              fallback={
                <div className="w-28 h-32 bg-gray-800/50 backdrop-blur-md rounded-2xl animate-pulse" />
              }
            >
              <LazyWeatherWidget />
            </Suspense>

            <SpeedDials />

            {/* Clock widget - right */}

            {/* <Navbar /> */}
            {/* <Suspense
              fallback={
                <div className="w-48 h-48 bg-gray-800/50 backdrop-blur-md rounded-full animate-pulse" />
              }
            > */}
            {/* <LazyAnalogClock /> */}
            {/* <div className="w-full h-full bg-amber-200"></div> */}
            {/* </Suspense> */}
          </div>
        )}

        {/* Critical: Load immediately - navigation is essential */}

        {/* Main content - redesigned layout */}
        <main className="flex flex-col items-center justify-center">
          {/* Center: Search Bar */}
          <div className="w-full max-w-2xl mb-8">
            <SearchBar />
          </div>
          <div className="w-full max-w-4xl">
            <FavoritesBar />
          </div>
        </main>

        {/* Notes Buttons */}
        {/* <TodosButton /> */}
        <NotesButton />
        <NotesOnlyButton />

        {/* Critical: Load immediately - welcome popup is important for UX */}
        <WelcomePopup />
      </div>
    </AuthProvider>
  );
}

export default App;
