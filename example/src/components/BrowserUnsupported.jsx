import React from 'react';
import './BrowserUnsupported.css';

function BrowserUnsupported() {
  return (
    <div className="browser-unsupported">
      <div className="unsupported-container">
        <h1>📱 AR Integration Playground</h1>
        <div className="unsupported-icon">⚠️</div>
        
        <h2>Native AR Not Available</h2>
        <p className="subtitle">
          This application requires native ARCore capabilities that are only available on Android devices.
        </p>

        <div className="info-box">
          <h3>To Test This App:</h3>
          <ol>
            <li>Build the APK using Capacitor</li>
            <li>Install on an ARCore-capable Android device</li>
            <li>Open the app from your device</li>
            <li>Grant camera permissions when prompted</li>
            <li>Click "Check Support" to verify ARCore is available</li>
          </ol>
        </div>

        <div className="browser-info">
          <h3>ℹ️ Browser Limitations</h3>
          <p>
            While this React application runs in the browser, the native AR functionality requires:
          </p>
          <ul>
            <li>Android OS (API level 21+)</li>
            <li>ARCore library installed</li>
            <li>Camera permission granted</li>
            <li>Capacitor native bridge</li>
            <li>Filament rendering engine</li>
          </ul>
        </div>

        <div className="code-box">
          <h3>📦 Build Instructions</h3>
          <pre>{`npm run build
npx cap sync android
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk`}</pre>
        </div>

        <div className="features-box">
          <h3>✨ Features When Running on Android</h3>
          <ul>
            <li>✓ Real-time ARCore surface detection</li>
            <li>✓ Camera feed with Filament rendering</li>
            <li>✓ GLB model loading and placement</li>
            <li>✓ Model transformation (rotate, scale, move)</li>
            <li>✓ Material/color customization</li>
            <li>✓ Hit testing on detected surfaces</li>
            <li>✓ Real-world anchor persistence</li>
            <li>✓ Transparent React UI overlay</li>
          </ul>
        </div>

        <p className="footer">
          Running on: <strong>Browser</strong> (Unsupported for AR)
        </p>
      </div>
    </div>
  );
}

export default BrowserUnsupported;
