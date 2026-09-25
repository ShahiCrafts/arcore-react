# Phone WebXR test (Android)

Requirements: an ARCore-capable Android phone, Google Play Services for AR, current Chrome, phone and development computer on the same Wi-Fi.

1. `cd example`
2. `npm install`
3. `npm run cert` (requires OpenSSL). This generates a private development CA and a server certificate containing the computer's LAN IP as a SAN.
4. Transfer **only** `example/certs/dev-ca.crt` to the phone. On Android install it as a CA certificate (Settings > Security/Encryption & credentials; exact wording varies by vendor). Do not transfer `dev-ca.key`.
5. Restart Chrome on the phone.
6. Run `npm run dev:https` and open the printed `https://<LAN-IP>:5173` URL on the phone.
7. Tap Start AR, grant camera access, move the phone slowly over a textured floor/table, then Place model. Use Scale, Rotate, and Color controls.

Security: `certs/*.key`, generated certs and CSRs are development-only and ignored by git. Remove the development CA from the phone when testing is finished. Never use these keys in production.

WebXR immersive AR is an Android Chrome path. iOS Safari does not currently expose the same immersive-ar WebXR flow; use the Capacitor/native implementation for native Android and a separate iOS AR implementation if required.
