# Mobile Application Guide (Branch: `mobile-app`)

This branch (`mobile-app`) is specifically optimized for **Mobile Web Application** use and ready for **Future Native Mobile App (Android APK / iOS)** compilation without changing any business logic or desktop functionality.

---

## 1. How to Run & Test on Your Mobile Phone Right Now

Both your computer and mobile phone must be on the same Wi-Fi network:

1. In `vite.config.js`, ensure the host is set to `0.0.0.0` or local network IP.
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Look for the Network URL printed in your terminal (e.g., `http://192.168.1.X:5173`).
4. Open Chrome or Safari on your phone and browse to that URL.

---

## 2. PWA (Install as Native Mobile App on Phone - Zero Build Needed)

Because of the included `manifest.json` and mobile meta tags:
- **On Android (Chrome)**: Tap the 3 dots in Chrome → Tap **"Install app"** or **"Add to Home screen"**.
- **On iPhone (Safari)**: Tap the Share button → Tap **"Add to Home Screen"**.

The app will appear with its own app icon on your home screen and open in standalone full-screen mode without any browser URL bar, feeling like a real mobile app.

---

## 3. How to Build a Native Android APK (Future Mobile App)

When you are ready to compile a real `.apk` file for the Google Play Store or APK distribution:

### Step 1: Install Capacitor CLI
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 2: Initialize & Build the Web Assets
```bash
npm run build
npx cap init "Invoice Pro" com.invoicepro.mobile --web-dir dist
```

### Step 3: Add the Android Platform
```bash
npx cap add android
```

### Step 4: Open in Android Studio & Build APK
```bash
npx cap open android
```
Inside Android Studio, click **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate your release Android APK!

---

## 4. Git Branch Switch Reminder

* **Desktop / Windows Version**:
  ```bash
  git checkout main
  ```

* **Mobile Web & Mobile App Version**:
  ```bash
  git checkout mobile-app
  ```
