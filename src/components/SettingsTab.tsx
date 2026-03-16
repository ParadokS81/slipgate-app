import { Show, For, createSignal, createEffect, onMount } from "solid-js";
import { LogIn, LogOut, Flag, MapPin, Image } from "lucide-solid";
import { startDiscordAuth, logOut, onAuthChange, type User, type AuthResult } from "../auth";
import { loadProfile, updateProfileSection, type ProfileData } from "../store";

// Countries available as flag assets (sorted by name)
const COUNTRIES: { code: string; name: string }[] = [
  { code: "at", name: "Austria" },
  { code: "au", name: "Australia" },
  { code: "by", name: "Belarus" },
  { code: "be", name: "Belgium" },
  { code: "br", name: "Brazil" },
  { code: "ca", name: "Canada" },
  { code: "cl", name: "Chile" },
  { code: "hr", name: "Croatia" },
  { code: "cz", name: "Czechia" },
  { code: "dk", name: "Denmark" },
  { code: "dz", name: "Algeria" },
  { code: "ee", name: "Estonia" },
  { code: "fi", name: "Finland" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "gb", name: "United Kingdom" },
  { code: "gb-sct", name: "Scotland" },
  { code: "gr", name: "Greece" },
  { code: "hu", name: "Hungary" },
  { code: "is", name: "Iceland" },
  { code: "in", name: "India" },
  { code: "ie", name: "Ireland" },
  { code: "it", name: "Italy" },
  { code: "jp", name: "Japan" },
  { code: "lv", name: "Latvia" },
  { code: "lt", name: "Lithuania" },
  { code: "lu", name: "Luxembourg" },
  { code: "mt", name: "Malta" },
  { code: "mx", name: "Mexico" },
  { code: "ma", name: "Morocco" },
  { code: "nl", name: "Netherlands" },
  { code: "no", name: "Norway" },
  { code: "pl", name: "Poland" },
  { code: "pt", name: "Portugal" },
  { code: "ro", name: "Romania" },
  { code: "ru", name: "Russia" },
  { code: "sk", name: "Slovakia" },
  { code: "za", name: "South Africa" },
  { code: "es", name: "Spain" },
  { code: "se", name: "Sweden" },
  { code: "ch", name: "Switzerland" },
  { code: "tr", name: "Turkey" },
  { code: "ua", name: "Ukraine" },
  { code: "us", name: "United States" },
];

// Common QW maps for backdrop selection
const MAPS = [
  "dm2", "dm3", "dm4", "dm6", "e1m2",
  "ztndm3", "aerowalk", "skull", "povdmm4",
];

interface SettingsTabProps {
  onProfileUpdate?: (profile: ProfileData) => void;
}

export default function SettingsTab(props: SettingsTabProps) {
  const [user, setUser] = createSignal<User | null>(null);
  const [discordName, setDiscordName] = createSignal<string | null>(null);
  const [authLoading, setAuthLoading] = createSignal(false);
  const [authError, setAuthError] = createSignal<string | null>(null);
  const [profile, setProfile] = createSignal<ProfileData | null>(null);

  // Listen for auth state changes
  onMount(() => {
    onAuthChange((u) => setUser(u));
    loadProfile().then((p) => {
      setProfile(p);
      // Restore Discord name from stored profile
      if (p.identity.discord_username) setDiscordName(p.identity.discord_username);
    });
  });

  async function handleSignIn() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await startDiscordAuth();
      // Store the Discord info from the cloud function response
      if (result.discord) {
        setDiscordName(result.discord.discordUsername);
        await updateProfileSection("identity", {
          discord_id: result.discord.discordUserId,
          discord_username: result.discord.discordUsername,
          discord_avatar: result.discord.discordAvatarHash,
        });
      }
    } catch (e: any) {
      setAuthError(e.message ?? "Authentication failed");
    }
    setAuthLoading(false);
  }

  async function handleSignOut() {
    await logOut();
    setUser(null);
  }

  async function updateIdentity(field: string, value: string | null) {
    const updated = await updateProfileSection("identity", { [field]: value });
    setProfile(updated);
    props.onProfileUpdate?.(updated);
  }

  async function updatePrefs(field: string, value: string) {
    const updated = await updateProfileSection("prefs", { [field]: value });
    setProfile(updated);
    props.onProfileUpdate?.(updated);
  }

  return (
    <div class="sg-profile-cards">
      {/* === DISCORD AUTH === */}
      <div class="sg-card">
        <div class="sg-card-header">
          <LogIn size={16} />
          <span>Account</span>
        </div>

        <Show
          when={user()}
          fallback={
            <div class="sg-row">
              <span class="sg-row-label">Discord</span>
              <div class="sg-input-group">
                <button
                  class="sg-launch-btn sg-launch-btn-primary"
                  onClick={handleSignIn}
                  disabled={authLoading()}
                >
                  {authLoading() ? "Signing in..." : "Sign in with Discord"}
                </button>
                <Show when={authError()}>
                  <span style={{ color: "var(--color-error)", "font-size": "12px" }}>
                    {authError()}
                  </span>
                </Show>
              </div>
            </div>
          }
        >
          <div class="sg-row">
            <span class="sg-row-label">Discord</span>
            <span class="sg-row-value">
              {discordName() ?? user()!.displayName ?? user()!.uid}
            </span>
          </div>
          <div class="sg-row">
            <span class="sg-row-label" />
            <button class="sg-launch-btn" onClick={handleSignOut}>
              <LogOut size={12} style={{ display: "inline", "vertical-align": "middle", "margin-right": "4px" }} />
              Sign out
            </button>
          </div>
        </Show>
      </div>

      {/* === PROFILE IDENTITY === */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Flag size={16} />
          <span>Profile</span>
        </div>

        {/* Nationality */}
        <div class="sg-row">
          <span class="sg-row-label">Nationality</span>
          <select
            class="sg-row-select"
            value={profile()?.identity.nationality ?? ""}
            onChange={(e) => updateIdentity("nationality", e.currentTarget.value || null)}
          >
            <option value="">Not set</option>
            <For each={COUNTRIES}>
              {(c) => <option value={c.code}>{c.name}</option>}
            </For>
          </select>
        </div>

        {/* Residence */}
        <div class="sg-row">
          <span class="sg-row-label">Residence</span>
          <select
            class="sg-row-select"
            value={profile()?.identity.residence ?? ""}
            onChange={(e) => updateIdentity("residence", e.currentTarget.value || null)}
          >
            <option value="">Same as nationality</option>
            <For each={COUNTRIES}>
              {(c) => <option value={c.code}>{c.name}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* === BANNER PREFERENCES === */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Image size={16} />
          <span>Banner</span>
        </div>

        {/* Map backdrop */}
        <div class="sg-row">
          <span class="sg-row-label">Map Backdrop</span>
          <select
            class="sg-row-select"
            value={profile()?.prefs.map_backdrop ?? "dm3"}
            onChange={(e) => updatePrefs("map_backdrop", e.currentTarget.value)}
          >
            <For each={MAPS}>
              {(m) => <option value={m}>{m}</option>}
            </For>
          </select>
        </div>
      </div>
    </div>
  );
}
