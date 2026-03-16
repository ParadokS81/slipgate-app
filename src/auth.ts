import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { signInWithDiscord, logOut, onAuthChange } from "./firebase";
import type { User } from "firebase/auth";

const DISCORD_CLIENT_ID = "1465332663152808031";
const REDIRECT_URI = "http://localhost:17420/callback";
const CLOUD_FUNCTION_URL = "https://europe-west3-matchscheduler-dev.cloudfunctions.net/discordOAuthExchange";

interface OAuthCallbackResult {
  code: string;
  redirect_uri: string;
}

/**
 * Full Discord OAuth flow:
 * 1. Open Discord auth in system browser
 * 2. Start local listener (Rust) to catch the callback
 * 3. Exchange code via MatchScheduler cloud function → Firebase custom token
 * 4. Sign in to Firebase with the custom token
 */
export async function startDiscordAuth(): Promise<User> {
  // Build Discord OAuth URL
  const discordUrl = new URL("https://discord.com/api/oauth2/authorize");
  discordUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
  discordUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  discordUrl.searchParams.set("response_type", "code");
  discordUrl.searchParams.set("scope", "identify");

  // Open browser first (user takes seconds to auth)
  await openUrl(discordUrl.toString());

  // Start listening for the callback (blocks until received or timeout)
  const result = await invoke<OAuthCallbackResult>("await_oauth_callback");

  // Exchange the code for a Firebase custom token
  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        code: result.code,
        redirectUri: result.redirect_uri,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth server error: ${response.status}`);
  }

  const json = await response.json();
  const data = json.result ?? json;

  if (!data.success || !data.customToken) {
    throw new Error(data.error ?? "Failed to authenticate");
  }

  // Sign in to Firebase
  const user = await signInWithDiscord(data.customToken);

  // Return both the Firebase user and the Discord info from the cloud function
  return {
    user,
    discord: data.user ?? null,
  };
}

export interface AuthResult {
  user: User;
  discord: { discordUsername: string; discordUserId: string; discordAvatarHash: string } | null;
}

export { logOut, onAuthChange };
export type { User };
