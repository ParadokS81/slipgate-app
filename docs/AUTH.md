# Authentication — Discord OAuth in Tauri

## Overview

Slipgate App uses the same Discord OAuth flow as the website, resulting in the same Firebase Auth UID. One identity across web and desktop.

---

## How It Works

### The Flow

```
┌──────────────┐     1. Open browser      ┌──────────────┐
│  Slipgate    │ ──────────────────────>   │   Browser    │
│  App (Tauri) │                           │              │
│              │     2. User logs in       │  Discord     │
│              │        with Discord       │  OAuth page  │
│              │                           │              │
│  localhost   │  <──────────────────────  │  3. Redirect │
│  :PORT       │     ?code=abc123         │  to callback │
│  /callback   │                           └──────────────┘
│              │
│  4. Exchange code for tokens             ┌──────────────┐
│  ─────────────────────────────────────>  │  Firebase    │
│                                          │  Auth        │
│  5. Receive Firebase Auth token   <───── │  (Cloud Fn)  │
│                                          └──────────────┘
│  6. Store token securely
│  (OS keychain via Tauri store plugin)
└──────────────┘
```

### Step by Step

1. **User clicks "Sign in with Discord"** in the app
2. **App opens the system browser** (not a webview — better security, user sees real Discord domain) to:
   ```
   https://discord.com/api/oauth2/authorize?
     client_id=YOUR_CLIENT_ID
     &redirect_uri=http://localhost:{PORT}/callback
     &response_type=code
     &scope=identify+guilds
   ```
3. **App starts a local HTTP server** on a random available port, listening for the callback
4. **User authorizes on Discord** — Discord redirects to `http://localhost:{PORT}/callback?code=abc123`
5. **App catches the redirect**, extracts the auth code, shuts down the local server
6. **App sends the code to a Firebase Cloud Function** (or handles the token exchange directly):
   - Option A: Call existing `discordAuth` Cloud Function (already handles code → Firebase custom token)
   - Option B: Exchange code for Discord token locally, then use Firebase Auth `signInWithCustomToken`
7. **App receives Firebase Auth token** — stores it securely
8. **App is now authenticated** with the same UID as the web user

### Why This Works

- **Same Discord OAuth app** — same client ID and scopes as the website
- **Same Firebase project** — `matchscheduler-dev` (or future Slipgate project)
- **Same UID** — Discord user ID maps to the same Firebase Auth UID everywhere
- **Redirect URI** — just add `http://localhost` to the allowed redirect URIs in Discord developer portal (wildcard port)

---

## Token Storage

### Tauri Store Plugin (Recommended)

Tauri v2's `store` plugin provides encrypted, per-app persistent storage:

```rust
// Rust side
use tauri_plugin_store::StoreExt;

app.store("auth.json")?
    .set("firebase_token", token);
```

```typescript
// Frontend side
import { load } from '@tauri-apps/plugin-store';

const store = await load('auth.json');
await store.set('firebase_token', token);
await store.save();
```

The store file is saved in the app's data directory:
- Windows: `%APPDATA%/com.slipgate.app/auth.json`
- macOS: `~/Library/Application Support/com.slipgate.app/auth.json`
- Linux: `~/.config/com.slipgate.app/auth.json`

### Token Refresh

Firebase Auth tokens expire after 1 hour. Options:
- **Firebase Auth SDK (web)** — handles refresh automatically. Can use the JS SDK in Tauri's webview
- **Manual refresh** — store the refresh token, call Firebase's token refresh endpoint when needed
- **Re-auth on expiry** — simplest approach for MVP. If token expired, prompt re-login

For MVP, use the Firebase JS SDK in the frontend — it handles token lifecycle automatically.

---

## Security Considerations

- **Open system browser for OAuth**, not an embedded webview — prevents the app from intercepting credentials
- **Random port** for callback server — prevents port-prediction attacks
- **PKCE flow** (Proof Key for Code Exchange) — should be used for additional security. Discord supports it
- **Store tokens encrypted** — Tauri's store plugin handles this
- **Never store Discord token long-term** — only the Firebase Auth token matters after initial exchange
- **Redirect URI validation** — Discord validates the redirect URI matches what's registered in the app settings

---

## Changes Needed in Existing Infrastructure

### Discord Developer Portal
- Add `http://localhost` (with wildcard port, or a few specific ports) to the OAuth2 redirect URIs

### Firebase Cloud Functions (if using Option A)
- The existing `discordAuth` function in MatchScheduler may need a minor update to accept the localhost redirect URI
- Or create a new endpoint specifically for desktop app auth

### Firestore Security Rules
- Rules already check `request.auth.uid` — no changes needed as long as the app uses the same Firebase Auth

---

## Open Questions

- [ ] Use existing `discordAuth` Cloud Function or create a desktop-specific one?
- [ ] PKCE flow — implement from the start or add later?
- [ ] How to handle "remember me" / session persistence? (Token refresh vs re-auth)
- [ ] Should the app also support Google login (like MatchScheduler does)?
