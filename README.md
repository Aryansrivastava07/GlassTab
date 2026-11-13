# 🪟 GlassTab — Futuristic Glassmorphic AI New Tab Dashboard

[![Chrome Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gemini 3.8 Flash](https://img.shields.io/badge/Google_Gemini-3.8_Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Transform your browser's default blank new tab into a **hyper-customizable, dark-glass cyber-aesthetic productivity cockpit** powered by **Google Gemini 3.8 Flash**, progressive blur-up wallpapers, draggable freeform widgets, and offline-first cloud synchronization.

---

## 🌟 Highlights & Features

### 🤖 Built-in AI Studio (Powered by Gemini 3.8 Flash & 2.5 Flash)
- **Cutting-Edge Gemini Integration:** Direct support for Google's modern Gemini Interactions API with multi-turn context memory and live Google Search grounding.
- **Dynamic AI Personas:**
  - **GlassTab AI 🤖:** Clean, intelligent, concise, code-first browser companion.
  - **Ginnie 🧞‍♂️:** Sarcastic, witty, dramatic genie trapped in your browser who answers with puns and magical flair.
  - **Custom Companion Studio ✨:** Build your own AI companion with custom avatars, system prompts, personality traits, and tone.
- **Voice Dictation & Code Highlighting:** Native speech-to-text dictation via Web Speech API and syntax-highlighted code blocks with one-click copy.
- **Cloud-Synced Trial & Account Protection:** 10 free trial messages strictly synced to user Google accounts in Cloud Firestore (`users/{userId}.aiTrialCount`). Guests are prompted to sign in with 1-click Google auth to prevent cross-browser resets.
- **BYOK (Bring Your Own Key):** Add your personal Google AI Studio Gemini API key anytime for 100% unlimited, unmetered AI conversations.

### 🖼️ Progressive Blur-Up Wallpapers (0ms Reloads)
- **Zero Blank Screen Delay:** High-resolution 4K images and video wallpapers load with zero stutter.
- **Low-Quality Image Placeholder (LQIP):** Auto-generates an ultra-lightweight (< 3KB) replica thumbnail saved synchronously in `localStorage`. On page reload, the blurred replica renders instantly on **Frame 0**, then smoothly cross-fades into the full-res media once decoded.
- **Offline Storage:** Full media assets are stored directly in browser **IndexedDB** for 100% offline access.

### 🎨 Deep Glassmorphic & RGB Color Customization
- **Full Styling Suite:** Real-time controls for background blur, frosted glass opacity, borders, and RGB tint.
- **Independent Module Tuning:** Customize Search Bar, Quick Links, Speed Dials, and Widgets separately.
- **Widget Color & Contrast:** Live RGB tinting and text contrast adjustment for Analog Clocks, Weather cards, and custom tiles.

### 🧩 Freeform Draggable & Resizable Widgets
- **Live Analog Clock:** Fluid ticking second-hand with glass face reflections.
- **Live Weather Widget:** Instant auto-location or worldwide city search with temperature, humidity, wind, and forecast.
- **Notes & Scratchpad:** Fast floating note cards or full markdown modal vault.
- **Sandboxed Custom Widgets:** Safely execute custom HTML/CSS/JS widgets inside an isolated iframe sandbox (`widget-sandbox.html`) via a secure `postMessage` bridge.
- **Community Widget Store:** Browse and install community widgets or publish your own directly to Cloud Firestore.
- **Persistent Grid:** Freeform drag-and-drop and resize coordinates persist across browser restarts.

### ⚡ Smart Omnibar & Speed Dials
- Instant search engine redirect (Google, Bing, DuckDuckGo) with keyboard navigation.
- Real-time URL autocomplete suggestions based on top web destinations.
- Customizable dock with speed dial shortcuts, favicons, and custom bookmarking.

### 🚀 Performance & Focus Features
- **Lite Mode for Low-Spec PCs:** 1-click toggle to disable backdrop blurs, heavy animations, and video wallpapers for ultra-smooth 60fps performance on budget laptops.
- **Standby / Focus Mode (`Alt + Z`):** Clean minimalist view hiding all sidebars, dials, and controls — displaying only wallpaper, clock, search bar, and primary widgets.
- **Granular Feature Toggles:** Individually turn off features you don't use (weather, quick links, search bar, analog clock, speed dials) to maximize speed.

### ☁️ Offline-First & Firebase Cloud Sync
- **Guest Mode:** Ready immediately with 0 login required (persists 100% locally in IndexedDB & LocalStorage).
- **Cloud Account Sync:** Sign in with Google or Email to backup and synchronize wallpapers, widgets, notes, shortcuts, and themes across multiple machines.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    subgraph Browser ["Chrome Browser New Tab (MV3)"]
        UI["GlassTab React 18 UI<br/>(Tailwind + Lucide Icons)"]
        Omnibar["Search Omnibar &<br/>Autocomplete Engine"]
        AI["AI Studio<br/>(GlassTab / Ginnie / Custom)"]
        WidgetGrid["Draggable Widget Grid<br/>(Clock, Weather, Notes)"]
        Sandbox["Sandboxed Iframe<br/>(widget-sandbox.html)"]
        WP["Wallpaper Manager<br/>(Progressive LQIP Blur-Up)"]
    end

    subgraph Storage ["Local-First Persistence"]
        LS["localStorage<br/>(Settings, Coordinates, LQIP < 3KB)"]
        IDB["IndexedDB (localMediaDb)<br/>(Full 4K Wallpapers & Videos)"]
    end

    subgraph External ["Cloud & APIs"]
        Gemini["Google Gemini 3.8 Flash<br/>(/v1beta/interactions)"]
        WeatherAPI["WeatherAPI.com"]
        Firebase["Firebase Auth &<br/>Cloud Firestore Sync"]
    end

    UI --> Omnibar
    UI --> AI
    UI --> WidgetGrid
    UI --> WP
    WidgetGrid <--> Sandbox

    WP <--> LS
    WP <--> IDB
    Omnibar <--> LS
    AI <--> LS

    AI --> Gemini
    WidgetGrid --> WeatherAPI
    UI <--> Firebase
```

---

## 🚀 Installation & Setup

### Option 1: Quick Install (From Pre-Built Zip)
1. Download or locate `glasstab-cws-v2.0.2.zip`.
2. Extract the archive into a folder (e.g. `glasstab-extension/`).
3. Follow the [Chrome Setup Instructions](#-chrome-setup-instructions) below.

---

### Option 2: Build From Source (Developer Mode)

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or newer)
- npm or pnpm

#### 1. Clone the Repository
```bash
git clone https://github.com/Aryansrivastava07/Landing-Page-React.git
cd Landing-Page-React
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Run Development Server (HMR)
```bash
npm run dev
```

#### 4. Build Production Extension
```bash
npm run build
```
The optimized extension bundle will be generated inside `Landing-Page-React/dist/`.

---

## 🌐 Chrome Setup Instructions

Because Chrome Manifest V3 has strict security boundaries for new tab overrides and local media, follow these exact steps to load GlassTab into Google Chrome:

### 1. Enable Developer Mode
1. Open Google Chrome.
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** to **ON**.

---

### 2. Load the Unpacked Extension
1. Click the **Load unpacked** button in the top-left toolbar.
2. Select the `dist/` folder inside `Landing-Page-React/` (or the extracted zip directory).
3. You will now see **GlassTab - Custom New Tab Dashboard** listed among your extensions.

---

### 3. Handle Chrome's "Keep Changes" Security Prompt ⚠️
When you open your very first new tab (`Ctrl + T` on Windows/Linux or `Cmd + T` on Mac), Google Chrome shows a native security banner:

> **"Is this the new tab page you were expecting?"**  
> An extension changed the page that appears when you open a new tab.

👉 **Important:** Click **"Keep changes"** (or *"Keep it"*). If you click "Change back", Chrome disables the extension's new tab override.

---

### 4. Pin & Allow in Incognito (Optional)
1. Click the **Puzzle piece icon** (Extensions menu) in the top-right of your Chrome toolbar.
2. Find **GlassTab** and click the **Pin** icon for instant access.
3. To allow in Incognito:
   - Go to `chrome://extensions` > GlassTab > **Details**.
   - Toggle **"Allow in Incognito"** to **ON**.

---

### 5. Add Your Free Google Gemini API Key
GlassTab includes 10 free trial messages synced to your Google account. For unlimited AI chats:
1. Open a new tab and click the **AI Studio** button.
2. Click **"Add Free Gemini Key for Unlimited"** at the bottom of the left sidebar.
3. Obtain your free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Paste the key and click **Save & Verify Key**. Your key is securely stored in local browser storage.

---

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **React 18** | High-performance reactive UI and component lifecycle |
| **Vite 5** | Lightning-fast HMR and production bundle builder |
| **Tailwind CSS** | Atomic styling, glassmorphism filters, and responsive layout |
| **Google Gemini 3.8 Flash** | Ultra-low latency generative AI reasoning & search grounding |
| **Chrome Manifest V3** | Modern extension architecture with Service Worker & sandboxed iframes |
| **IndexedDB** | High-capacity offline binary storage for 4K wallpapers and video |
| **Firebase Auth & Firestore** | Cloud user accounts, Google OAuth, and cross-device sync |
| **Lucide React** | Ultra-clean, lightweight vector iconography |

---

## 🔒 Firebase Firestore Security Rules

To allow cross-device account synchronization and publishing to the community Widget Store, paste these rules in the **Firebase Console** ➔ **Firestore Database** ➔ **Rules** tab and click **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User personal data & cloud sync
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Wallpaper and media binaries
      match /media/{mediaId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Community Widget Store
    match /widgetStore/{widgetId} {
      // Anyone can browse and load community widgets
      allow read: if true;

      // Signed-in users can publish new widgets
      allow create: if request.auth != null;

      // Creators can update their widgets, or users can increment install count
      allow update: if request.auth != null || 
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['installs']);

      // Only the author can delete their published widget
      allow delete: if request.auth != null && resource.data.authorUid == request.auth.uid;
    }
  }
}
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by Aryan Srivastava for a cleaner, faster, and more beautiful browsing experience.
</p>
#   G l a s s T a b  
 