# Complete HTTPS Setup for AR Playground

## Overview

This document provides complete instructions for running the AR Playground development server over HTTPS so you can access it from any device on your network using your machine's IP address.

## What You Get

✅ **HTTPS Dev Server** - Secure local development
✅ **Network Access** - Access from phone/tablet using IP
✅ **Hot Reload** - Changes reflect instantly
✅ **Self-Signed Certs** - Already generated, no extra steps needed
✅ **Easy IP Display** - Terminal shows your exact URL

---

## 🚀 Quick Start (3 steps)

### 1. Install Dependencies (first time only)

```bash
cd example
npm install
```

### 2. Start HTTPS Server

```bash
npm run dev:https
```

Terminal output will show:

```
╔════════════════════════════════════════════╗
║  🚀 AR Playground - HTTPS Dev Server      ║
╚════════════════════════════════════════════╝

📍 Local:        https://localhost:5173
📱 Your Phone:   https://192.168.1.4:5173

⚠️  Browser Certificate Warning:
   Your browser will warn about an untrusted certificate.
   This is normal for self-signed certificates.
   Click "Accept" or "Proceed" to continue.

💡 Tips:
   • Make sure your phone is on the same network
   • Use https:// (not http://)
   • Accept the certificate warning on first access
```

### 3. Open on Your Phone

1. **Copy the IP from terminal** (e.g., `192.168.1.4`)
2. **On your phone browser**, type: `https://192.168.1.4:5173`
3. **Accept the certificate warning**
4. **React app loads!** You can now interact with it

---

## 🔐 SSL Certificates Explained

### What Are They?

- **localhost-cert.pem** - The certificate (public)
- **localhost-key.pem** - The private key (secret)
- **Valid for** - 365 days from creation (Sep 22, 2026)
- **Type** - Self-signed (generated on your machine)

### Why Self-Signed?

For **local development only**:
- ✅ No cost
- ✅ No CA required
- ✅ Works on private networks
- ✅ Full HTTPS support

### Why the Warning?

Browsers warn because:
- Not issued by a trusted Certificate Authority
- This is **expected and normal** for local development
- **Safe to proceed** - you trust your own machine

### How to Accept

**Chrome:**
- Click "Advanced"
- Click "Proceed to localhost (unsafe)"

**Safari:**
- Tap the address bar
- Tap "Visit this website"

**Firefox:**
- Click "Advanced..."
- Click "Accept Risk and Continue"

**Edge:**
- Click "Details"
- Click "Go on to the webpage"

---

## 🌐 Network Configuration

### How It Works

```
Your Machine (192.168.1.4)
    ↓
npm run dev:https
    ↓
Vite Server (host: 0.0.0.0, port: 5173)
    ↓
Listens on all network interfaces
    ↓
Your Phone (same WiFi)
    ↓
Opens: https://192.168.1.4:5173
    ↓
React app loads
    ↓
Hot reload works
```

### Requirements

1. **Network Access**
   - Your machine: Connected to WiFi/Ethernet
   - Your phone: On the same network
   - Different networks (4G/5G) won't work

2. **Firewall**
   - Port 5173 must not be blocked
   - Usually open by default
   - Check: `lsof -i :5173` should show `node`

3. **Protocol**
   - Must use `https://` (not `http://`)
   - HTTP won't work with Capacitor on Android

### Find Your IP Address

**macOS:**
```bash
ipconfig getifaddr en0
```

**Linux:**
```bash
hostname -I
# or
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

**Windows:**
```bash
ipconfig | findstr "IPv4"
# or
ipconfig | Select-String IPv4
```

**Any OS (in browser):**
- Open: https://whatismyipaddress.com/
- Look for "IPv4 Address" on your WiFi network

---

## 📱 Phone Access Step-by-Step

### Prerequisites

- Phone on same WiFi as dev machine
- Phone has internet/WiFi enabled
- Know your machine's IP address

### Steps

1. **Start dev server on your machine:**
   ```bash
   npm run dev:https
   ```
   Note the IP shown (e.g., `192.168.1.4`)

2. **On your phone, open browser**
   - Safari, Chrome, Firefox, etc.

3. **Type in address bar:**
   ```
   https://192.168.1.4:5173
   ```
   (Replace `192.168.1.4` with your actual IP)

4. **Press Enter/Go**

5. **See certificate warning:**
   - This is **normal** for self-signed certs
   - Tap "Accept", "Proceed", or equivalent

6. **Wait for page to load**
   - May take 5-10 seconds first time
   - React app appears

7. **Test it works:**
   - Try clicking buttons
   - Check "Logs" section
   - Verify "No events yet" message

8. **Make a change on your machine**
   - Edit `src/App.jsx` (add a comment or space)
   - Save file
   - Phone page auto-refreshes
   - Your change appears!

---

## 🛠️ Troubleshooting

### "DNS_PROBE_FINISHED_NXDOMAIN" or "Cannot find server"

**Cause:** Wrong IP address or server not running

**Fix:**
1. Check dev server is running: `npm run dev:https`
2. Check IP is correct: `ipconfig getifaddr en0` (macOS)
3. Verify same WiFi network
4. Try: `https://localhost:5173` on your **machine** first

### Certificate Warning Doesn't Go Away

**Cause:** Browser doesn't trust self-signed cert

**Fix:**
- This is **expected** - it's a self-signed cert
- Accept the warning
- Most browsers remember your choice
- Won't appear again for that domain

### Page Shows Blank or Errors

**Cause:** React app not loading

**Fix:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab - see requests?
4. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (other)
5. Try localhost first: `https://localhost:5173`

### "Connection refused" on Phone

**Cause:** Server not running or port blocked

**Fix:**
```bash
# On your machine, verify server is running
npm run dev:https

# Check port is open
lsof -i :5173

# Check IP address is correct
ipconfig getifaddr en0

# Test from same machine first
curl -k https://localhost:5173
```

### Phone and Machine on Different Networks

**Cause:** 4G/5G on phone vs WiFi on machine

**Fix:**
- Put phone on same WiFi network
- Both must show same `ifconfig getifaddr` IP
- Or use IP specific to your WiFi

### Port 5173 Already in Use

**Cause:** Another app using port

**Fix:**
```bash
# Find what's using port 5173
lsof -i :5173

# Kill that process
kill -9 <PID>

# Or use different port (edit vite.config.js)
```

---

## 📚 Available Commands

### Regular Commands

```bash
# Browser dev server (HTTP, localhost only)
npm run dev

# HTTPS dev server (HTTPS, network accessible)
npm run dev:https

# Build for production
npm run build

# Sync with Android
npm run sync

# Open Android project
npm run open:android
```

### Manual Commands

```bash
# Show your IP (what npm run dev:https shows)
node scripts/show-ip.js

# Regenerate SSL certificates
openssl req -x509 -newkey rsa:4096 \
  -keyout localhost-key.pem \
  -out localhost-cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

---

## 🔄 Development Workflow

### Typical Session

```bash
# Terminal 1: Start server
cd example
npm run dev:https

# Terminal 2 (separate terminal): Your editor/IDE
code .
# or: vim, emacs, WebStorm, VS Code, etc.

# Phone 1: Open browser
https://192.168.1.4:5173

# Phone 2: Edit files in your editor
# Changes auto-reload on phone!

# When ready to test native:
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### File Structure During Development

```
example/
├── src/
│   ├── components/       ← Edit these
│   │   └── *.jsx
│   ├── App.jsx           ← Or edit this
│   └── App.css
├── public/
│   └── models/           ← GLB files
├── dist/                 ← Generated by npm run build
│   └── (sync to Android)
├── android/              ← Native project
│   └── (for APK builds)
├── localhost-cert.pem    ← SSL cert (don't edit)
├── localhost-key.pem     ← SSL key (don't edit)
├── vite.config.js        ← HTTPS config (done)
└── package.json          ← Scripts (done)
```

---

## 🔒 Security Notes

### Local Development Only

⚠️ **Important:** This setup is for **local development only**

- Self-signed certs are **not secure for production**
- Port 5173 should not be exposed to internet
- Only use on trusted private networks
- Not suitable for public internet

### For Production

When deploying:
- Use **CA-signed certificates** (from Let's Encrypt, etc.)
- Use standard **HTTPS port 443**
- Implement proper **authentication**
- Use **environment variables** for secrets
- Follow **security best practices**

---

## 💡 Tips & Tricks

### Speed Up Development

```bash
# Use split terminal
# Left: npm run dev:https
# Right: Your editor/git commands

# Use phone for UI testing
# Use machine for debugging
```

### Test Multiple Devices

```bash
# All devices on same WiFi can access:
# Phone 1: https://192.168.1.4:5173
# Phone 2: https://192.168.1.4:5173
# Tablet: https://192.168.1.4:5173

# All get hot reload when you save files
```

### Debug from Phone

```bash
# In browser on phone, open DevTools
# Chrome: Menu → More tools → Developer tools
# Safari: Settings → Advanced → Web Inspector

# Check console for errors
# Check Network tab for requests
# Use debugger statements in code
```

### Clear Browser Cache

```bash
# If changes don't appear:
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (other)
# Or: Settings → Clear browsing data → All time
```

---

## 📞 Getting Help

### Check These First

1. **Server running?**
   ```bash
   npm run dev:https
   # Should see "Local: https://localhost:5173"
   ```

2. **Same WiFi?**
   ```bash
   ipconfig getifaddr en0  # Your IP
   # Phone must be on same network
   ```

3. **HTTPS and correct IP?**
   - Must use `https://` (not `http://`)
   - Must use correct IP from terminal

4. **Certificate accepted?**
   - Click "Proceed" or "Accept" on warning

### Logs to Check

```bash
# Terminal output from npm run dev:https
# Shows server start messages

# Browser console (F12)
# Shows JavaScript errors

# Network tab (F12)
# Shows HTTP requests

# Mobile: Remote debugging
# Connect phone via USB to debug on desktop
```

---

## ✅ Verification Checklist

- [ ] npm dependencies installed
- [ ] SSL certificates exist (`localhost-*.pem`)
- [ ] Can start dev server (`npm run dev:https`)
- [ ] Terminal shows your IP address
- [ ] Can reach server on same machine (`https://localhost:5173`)
- [ ] Phone on same WiFi network
- [ ] Can reach server from phone (`https://YOUR_IP:5173`)
- [ ] Accept certificate warning on phone
- [ ] React app loads on phone
- [ ] Can see hot reload (edit a file and save)

---

## 📖 Additional Resources

- **Vite HTTPS:** https://vitejs.dev/config/server-options.html#server-https
- **OpenSSL:** https://www.openssl.org/docs/
- **Capacitor:** https://capacitorjs.com/docs/basics/developing-your-app
- **React:** https://react.dev/learn
- **Port 5173:** Standard Vite dev port

---

## 🎯 Next Steps

1. **Quick test:** `npm run dev:https` → open on phone
2. **Make changes:** Edit React components and see hot reload
3. **Build for Android:** `npm run build && npx cap sync android`
4. **Deploy to device:** `./gradlew assembleDebug && adb install ...`
5. **Test ARCore:** Launch app and test camera/AR features

---

**You're all set! Happy developing! 🚀**
