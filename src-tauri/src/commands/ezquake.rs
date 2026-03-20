use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ============================================================
// Config parser
// ============================================================

/// Known ezQuake cvar defaults (only the ones we care about).
fn default_cvars() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("sensitivity", "12"),
        ("m_yaw", "0.022"),
        ("m_pitch", "0.022"),
        ("m_accel", "0"),
        ("fov", "90"),
        ("default_fov", "90"),
        ("vid_fullscreen", "1"),
        ("vid_usedesktopres", "1"),
        ("vid_width", "0"),
        ("vid_height", "0"),
        ("vid_displayfrequency", "0"),
        ("vid_win_width", "0"),
        ("vid_win_height", "0"),
        ("vid_conwidth", "0"),
        ("vid_conheight", "0"),
        ("cl_maxfps", "0"),
        ("name", "player"),
        ("team", ""),
        ("topcolor", "0"),
        ("bottomcolor", "0"),
        ("in_raw", "1"),
        ("freelook", "1"),
        ("r_mode", "-1"),
    ])
}

/// Parsed config data — cvars, key bindings, aliases, and exec references.
struct ParsedConfig {
    cvars: HashMap<String, String>,
    bindings: Vec<(String, String)>,          // ordered list of (key, command)
    aliases: HashMap<String, String>,         // alias name → command string
    exec_refs: Vec<String>,                   // referenced config files (from exec and cl_onload)
}

/// Parse an ezQuake config file into cvars and key bindings.
fn parse_config(content: &str) -> ParsedConfig {
    let mut cvars = HashMap::new();
    let mut bindings = Vec::new();
    let mut aliases = HashMap::new();
    let mut exec_refs = Vec::new();

    let skip_commands = [
        "unbind", "unbindall", "unaliasall",
        "set", "tp_pickup", "tp_took", "tp_point",
        "filter", "mapgroup", "skygroup", "floodprot",
        "hud_recalculate", "sb_sourceunmarkall", "sb_sourcemark",
    ];

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("////") {
            continue;
        }
        if trimmed.starts_with('+') || trimmed.starts_with('-') {
            continue;
        }

        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let key = match parts.next() {
            Some(k) => k,
            None => continue,
        };

        let key_lower = key.to_lowercase();

        // Parse bind lines: bind KEY "command"
        if key_lower == "bind" {
            if let Some(rest) = parts.next() {
                let rest = rest.trim();
                let mut bind_parts = rest.splitn(2, char::is_whitespace);
                if let (Some(bind_key), Some(bind_cmd)) = (bind_parts.next(), bind_parts.next()) {
                    let cmd = bind_cmd.trim();
                    let cmd = if cmd.starts_with('"') && cmd.ends_with('"') && cmd.len() >= 2 {
                        &cmd[1..cmd.len() - 1]
                    } else {
                        cmd
                    };
                    bindings.push((bind_key.to_uppercase(), cmd.to_string()));
                }
            }
            continue;
        }

        // Parse alias lines: alias NAME "command"
        if key_lower == "alias" {
            if let Some(rest) = parts.next() {
                let rest = rest.trim();
                let mut alias_parts = rest.splitn(2, char::is_whitespace);
                if let (Some(alias_name), Some(alias_cmd)) = (alias_parts.next(), alias_parts.next()) {
                    let cmd = alias_cmd.trim();
                    let cmd = if cmd.starts_with('"') && cmd.ends_with('"') && cmd.len() >= 2 {
                        &cmd[1..cmd.len() - 1]
                    } else {
                        cmd
                    };
                    aliases.insert(alias_name.to_string(), cmd.to_string());
                }
            }
            continue;
        }

        // Parse exec lines: exec "path/to/config.cfg"
        if key_lower == "exec" {
            if let Some(rest) = parts.next() {
                let path = rest.trim().trim_matches('"');
                if !path.is_empty() {
                    exec_refs.push(path.to_string());
                }
            }
            continue;
        }

        if skip_commands.iter().any(|&cmd| key_lower == cmd) {
            continue;
        }

        if let Some(rest) = parts.next() {
            let value = rest.trim();
            let value = if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                &value[1..value.len() - 1]
            } else {
                value
            };
            cvars.insert(key.to_string(), value.to_string());
        }
    }

    // Also extract exec refs from cl_onload (e.g. "exec configs/tp.cfg; exec configs/servers.cfg")
    if let Some(onload) = cvars.get("cl_onload") {
        for part in onload.split(';') {
            let part = part.trim();
            if part.starts_with("exec ") {
                let path = part[5..].trim().trim_matches('"');
                if !path.is_empty() {
                    exec_refs.push(path.to_string());
                }
            }
        }
    }

    ParsedConfig { cvars, bindings, aliases, exec_refs }
}

// ============================================================
// QW name rendering — $x codes, ^x codes, raw bytes
// ============================================================

/// A single styled character in a QW nickname.
/// `color` is "w" (white, 0x20-0x7F), "b" (brown, 0x80-0xFF), or "g" (gold, 0x10-0x1B).
#[derive(Serialize, Clone, Debug)]
pub struct QwStyledChar {
    pub ch: String,
    pub color: String, // "w", "b", "g"
}

/// Expand `$x` escape code to a byte value.
/// Based on ezQuake `TP_ParseFunChars()` in teamplay.c.
fn expand_dollar_code(c: char) -> Option<u8> {
    match c {
        '\\' => Some(0x0D), // carriage return
        ':' => Some(0x0A),  // line feed
        '[' => Some(0x10),  // gold left bracket
        ']' => Some(0x11),  // gold right bracket
        '0' => Some(0x12),  // gold digits
        '1' => Some(0x13),
        '2' => Some(0x14),
        '3' => Some(0x15),
        '4' => Some(0x16),
        '5' => Some(0x17),
        '6' => Some(0x18),
        '7' => Some(0x19),
        '8' => Some(0x1A),
        '9' => Some(0x1B),
        ',' => Some(0x1C),  // white bullet dot
        '.' => Some(0x9C),  // brown/red middle dot
        '<' => Some(0x1D),  // small left bracket
        '-' => Some(0x1E),  // small dash
        '>' => Some(0x1F),  // small right bracket
        '(' => Some(0x80),  // big left bracket (brown)
        '=' => Some(0x81),  // big equal sign (brown)
        ')' => Some(0x82),  // big right bracket (brown)
        'a' => Some(0x83),  // big grey block
        'W' => Some(0x84),  // white LED
        'G' => Some(0x86),  // green LED
        'R' => Some(0x87),  // red LED
        'Y' => Some(0x88),  // yellow LED
        'B' => Some(0x89),  // blue LED
        'b' => Some(0x8B),  // filled red block
        'c' | 'd' => Some(0x8D), // right-pointing red arrow
        '$' => Some(0x24),  // literal $
        '^' => Some(0x5E),  // literal ^
        _ => None,
    }
}

/// Map a QW byte (0-255) to a displayable Unicode character.
fn qw_byte_to_char(byte: u8) -> char {
    // Strip high bit to get the base character
    let base = byte & 0x7F;
    match base {
        // Control characters / special glyphs → Unicode approximations
        0x00 => ' ',        // null → space
        0x01 => ' ',
        0x02 => ' ',
        0x03 => ' ',
        0x04 => ' ',
        0x05 => '•',        // bullet
        0x06 => ' ',
        0x07 => ' ',
        0x08 => ' ',
        0x09 => ' ',
        0x0A => ' ',        // newline
        0x0B => ' ',
        0x0C => ' ',
        0x0D => ' ',        // carriage return
        0x0E => '·',        // middle dot
        0x0F => ' ',
        0x10 => '[',        // gold left bracket
        0x11 => ']',        // gold right bracket
        0x12 => '0',        // gold digits
        0x13 => '1',
        0x14 => '2',
        0x15 => '3',
        0x16 => '4',
        0x17 => '5',
        0x18 => '6',
        0x19 => '7',
        0x1A => '8',
        0x1B => '9',
        0x1C => '•',        // bullet dot (the one ParadokS uses)
        0x1D => '‹',        // small left bracket
        0x1E => '—',        // small dash
        0x1F => '›',        // small right bracket
        // Standard printable ASCII range (0x20-0x7E)
        0x20..=0x7E => base as char,
        0x7F => ' ',        // DEL
        _ => ' ',           // shouldn't happen after masking
    }
}

/// Determine the color class for a QW byte.
fn qw_byte_color(byte: u8) -> &'static str {
    match byte {
        0x10..=0x1B => "g",         // gold range (brackets + digits)
        0x90..=0x9B => "g",         // gold range (brown variants still render gold)
        0x80..=0xFF => "b",         // brown/high-bit range
        _ => "w",                    // white/normal
    }
}

/// Parse a QW name string (from config.cfg) into styled characters.
/// Handles $x codes, ^x codes, and raw bytes (< 0x80 preserved by UTF-8).
fn expand_qw_name(raw: &str) -> Vec<QwStyledChar> {
    let mut result = Vec::new();
    let bytes = raw.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        let b = bytes[i];

        if b == b'$' && i + 1 < len {
            let next = bytes[i + 1];
            // Check for $xHH (hex notation)
            if next == b'x' && i + 3 < len {
                let h1 = bytes[i + 2];
                let h2 = bytes[i + 3];
                if let (Some(d1), Some(d2)) = (hex_digit(h1), hex_digit(h2)) {
                    let byte_val = (d1 << 4) | d2;
                    // $x00 maps to space (0x20), not null
                    let byte_val = if byte_val == 0 { 0x20 } else { byte_val };
                    result.push(QwStyledChar {
                        ch: qw_byte_to_char(byte_val).to_string(),
                        color: qw_byte_color(byte_val).to_string(),
                    });
                    i += 4;
                    continue;
                }
            }
            // Check for single-char $x codes
            if let Some(byte_val) = expand_dollar_code(next as char) {
                result.push(QwStyledChar {
                    ch: qw_byte_to_char(byte_val).to_string(),
                    color: qw_byte_color(byte_val).to_string(),
                });
                i += 2;
                continue;
            }
            // Unknown $ code — emit literal $
            result.push(QwStyledChar { ch: "$".to_string(), color: "w".to_string() });
            i += 1;
            continue;
        }

        if b == b'^' && i + 1 < len {
            let next = bytes[i + 1];
            if next != b' ' {
                // ^x = char OR'd with 128 (brown variant)
                let byte_val = next | 0x80;
                result.push(QwStyledChar {
                    ch: qw_byte_to_char(byte_val).to_string(),
                    color: qw_byte_color(byte_val).to_string(),
                });
                i += 2;
                continue;
            }
        }

        // Raw byte — could be a control char (< 0x20) or normal ASCII
        // For bytes < 128, they pass through UTF-8 lossy conversion intact
        if b < 0x20 {
            // Control character — map through QW table
            result.push(QwStyledChar {
                ch: qw_byte_to_char(b).to_string(),
                color: qw_byte_color(b).to_string(),
            });
        } else {
            // Normal printable ASCII
            result.push(QwStyledChar {
                ch: (b as char).to_string(),
                color: "w".to_string(),
            });
        }
        i += 1;
    }

    result
}

fn hex_digit(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Movement key bindings extracted from config.
#[derive(Serialize, Clone)]
pub struct MovementKeys {
    pub forward: String,
    pub back: String,
    pub moveleft: String,
    pub moveright: String,
    pub jump: String,
}

/// Parsed ezQuake settings that we care about.
#[derive(Serialize, Clone)]
pub struct EzQuakeConfig {
    pub player_name: String,
    pub player_name_qw: Vec<QwStyledChar>,
    pub team: String,
    pub team_qw: Vec<QwStyledChar>,
    pub topcolor: u8,
    pub bottomcolor: u8,
    pub sensitivity: f64,
    pub lg_sensitivity: Option<f64>,  // different sensitivity for LG (shaft), if detected
    pub m_yaw: f64,
    pub m_pitch: f64,
    pub m_accel: f64,
    pub fov: f64,
    pub in_raw: bool,
    pub vid_usedesktopres: bool,
    pub vid_width: u32,
    pub vid_height: u32,
    pub vid_displayfrequency: u32,
    pub cl_maxfps: u32,
    pub movement: MovementKeys,
    pub weapon_binds: Vec<WeaponBind>,
    pub raw_cvars: HashMap<String, String>,
}

fn get_cvar<'a>(parsed: &'a HashMap<String, String>, defaults: &'a HashMap<&str, &str>, key: &str) -> &'a str {
    parsed.get(key).map(|s| s.as_str()).unwrap_or_else(|| defaults.get(key).copied().unwrap_or(""))
}

/// Find which key is bound to a given command (e.g. "+forward").
/// When multiple keys bind the same command, prefer the last one in the file
/// (ezQuake processes config top-to-bottom, last bind wins).
fn find_bind(bindings: &[(String, String)], command: &str) -> String {
    let mut last_match: Option<&str> = None;
    for (key, cmd) in bindings {
        if cmd == command || cmd.starts_with(&format!("{};", command)) || cmd.starts_with(&format!("{}; ", command)) {
            last_match = Some(key);
        }
    }
    match last_match {
        Some(key) => format_key_name(key),
        None => "?".to_string(),
    }
}

/// Format a key name for display (e.g. "MOUSE2" → "Mouse2", "SPACE" → "Space")
fn format_key_name(key: &str) -> String {
    match key {
        "MOUSE1" => "Mouse1".to_string(),
        "MOUSE2" => "Mouse2".to_string(),
        "MOUSE3" => "Mouse3".to_string(),
        "MOUSE4" => "Mouse4".to_string(),
        "MOUSE5" => "Mouse5".to_string(),
        "MWHEELUP" => "MWheelUp".to_string(),
        "MWHEELDOWN" => "MWheelDown".to_string(),
        "SPACE" => "Space".to_string(),
        "CTRL" => "Ctrl".to_string(),
        "ALT" => "Alt".to_string(),
        "SHIFT" => "Shift".to_string(),
        "TAB" => "Tab".to_string(),
        "ENTER" => "Enter".to_string(),
        "ESCAPE" => "Esc".to_string(),
        "CAPSLOCK" => "CapsLock".to_string(),
        "BACKSPACE" => "Backspace".to_string(),
        "UPARROW" => "↑".to_string(),
        "DOWNARROW" => "↓".to_string(),
        "LEFTARROW" => "←".to_string(),
        "RIGHTARROW" => "→".to_string(),
        k if k.len() == 1 => k.to_uppercase(),
        k => k.to_string(),
    }
}

// ============================================================
// Weapon bind analysis
// ============================================================

/// QW weapon impulse → name mapping
fn impulse_to_weapon(n: u32) -> Option<&'static str> {
    match n {
        1 => Some("axe"),
        2 => Some("sg"),
        3 => Some("ssg"),
        4 => Some("ng"),
        5 => Some("sng"),
        6 => Some("gl"),
        7 => Some("rl"),
        8 => Some("lg"),
        _ => None,
    }
}

/// A detected weapon bind.
#[derive(Serialize, Clone, Debug)]
pub struct WeaponBind {
    pub weapon: String,         // "rl", "lg", "gl", etc.
    pub key: String,            // display name of the key
    pub method: String,         // "quickfire" or "manual"
    pub fire_key: Option<String>, // for manual: which key fires (usually Mouse1)
}

/// Default impulse binds on number keys (to detect legacy/unmodified binds)
fn is_default_impulse_bind(key: &str, cmd: &str) -> bool {
    matches!(
        (key, cmd),
        ("1", "impulse 1") | ("2", "impulse 2") | ("3", "impulse 3") |
        ("4", "impulse 4") | ("5", "impulse 5") | ("6", "impulse 6") |
        ("7", "impulse 7") | ("8", "impulse 8")
    )
}

/// Extract weapon numbers from a command string.
/// Handles "impulse 7", "weapon 7 3 2", and "+fire 7 2" / "+fire_ar 7 2" formats.
/// Returns the primary weapon number (first one listed).
/// Returns None for long chains (4+ numbers) — those are pack-drop/priority binds.
fn extract_weapon_number(cmd: &str) -> Option<u32> {
    let lower = cmd.to_lowercase();
    for part in lower.split(';') {
        let part = part.trim();
        // Match: impulse N, weapon N [N2...], +fire N [N2...], +fire_ar N [N2...]
        let (after_cmd, is_impulse_only) = if part.starts_with("impulse ") {
            (Some(&part[8..]), true)
        } else if part.starts_with("weapon ") {
            (Some(&part[7..]), false)
        } else if part.starts_with("+fire_ar ") {
            (Some(&part[9..]), false)
        } else if part.starts_with("+fire ") {
            (Some(&part[6..]), false)
        } else {
            (None, false)
        };
        if let Some(after) = after_cmd {
            let numbers: Vec<u32> = after.trim().split_whitespace()
                .filter_map(|n| n.parse::<u32>().ok())
                .collect();
            // 4+ numbers on impulse = pack-drop chain, skip.
            // But weapon/+fire chains with many fallbacks are legitimate.
            if is_impulse_only && numbers.len() >= 4 {
                return None;
            }
            if let Some(&num) = numbers.first() {
                if (1..=8).contains(&num) {
                    return Some(num);
                }
            }
        }
    }
    None
}

/// Check if a command string contains +attack or +fire/+fire_ar (built-in quickfire).
/// +fire is an ezQuake built-in that combines weapon select + attack.
/// Ignores +fire/+attack when they appear inside a "bind" command (rebind setup, not direct fire).
fn has_attack(cmd: &str) -> bool {
    cmd.to_lowercase().split(';').any(|part| {
        let p = part.trim();
        // Skip if this part is a bind command (e.g. "bind mouse1 +fire 3")
        if p.starts_with("bind ") {
            return false;
        }
        p.starts_with("+attack") || p.starts_with("+fire ") || p.starts_with("+fire_ar ")
    })
}

/// Check if a command string rebinds mouse1
fn rebinds_mouse1(cmd: &str) -> bool {
    let lower = cmd.to_lowercase();
    lower.contains("bind mouse1")
}

/// Extract all key rebinds from a command string.
/// Returns Vec of (target_key_uppercase, rebound_command).
/// e.g. "bind MOUSE1 +gl; bind CTRL +sng" → [("MOUSE1", "+gl"), ("CTRL", "+sng")]
fn extract_rebinds(cmd: &str) -> Vec<(String, String)> {
    let mut rebinds = Vec::new();
    let lower = cmd.to_lowercase();
    for part in lower.split(';') {
        let part = part.trim();
        if part.starts_with("bind ") {
            let after_bind = part[5..].trim();
            let mut parts = after_bind.splitn(2, char::is_whitespace);
            if let (Some(key), Some(rebound)) = (parts.next(), parts.next()) {
                rebinds.push((key.to_uppercase(), rebound.trim().to_string()));
            }
        }
    }
    rebinds
}

/// Resolve a command through aliases (one level deep, then check resolved).
/// Returns the fully resolved command string.
fn resolve_command(cmd: &str, aliases: &HashMap<String, String>) -> String {
    let cmd_trimmed = cmd.trim();
    // If the command starts with + or is a known alias, resolve it
    let alias_name = if cmd_trimmed.starts_with('+') {
        cmd_trimmed
    } else {
        cmd_trimmed
    };
    if let Some(resolved) = aliases.get(alias_name) {
        return resolved.clone();
    }
    // Try without the + prefix too
    if cmd_trimmed.starts_with('+') {
        if let Some(resolved) = aliases.get(&cmd_trimmed[1..]) {
            return resolved.clone();
        }
    }
    cmd.to_string()
}

/// Analyze all key bindings to extract weapon binds.
fn analyze_weapon_binds(
    bindings: &[(String, String)],
    aliases: &HashMap<String, String>,
) -> Vec<WeaponBind> {
    let mut weapon_binds = Vec::new();
    let mut has_custom_weapon_binds = false;

    // First pass: identify all weapon-related binds
    for (key, cmd) in bindings {
        let key_upper = key.to_uppercase();

        // Skip empty binds
        if cmd.is_empty() || cmd == "\"\"" {
            continue;
        }

        // Resolve through aliases (one level)
        let resolved = resolve_command(cmd, aliases);

        // Priority 1: check if this bind rebinds ANY key to a weapon
        // e.g. "bind mouse1 +rock; weapon 2" or "bind MOUSE1 +gl; bind CTRL +sng; bind MWHEELUP +axe"
        // If the resolved command ALSO has +attack, it's quickfire (e.g. +boom = "weapon 2; +attack; bind mouse1 +boom")
        let rebinds = extract_rebinds(&resolved);
        let raw_rebinds = extract_rebinds(cmd);
        let all_rebinds = if !rebinds.is_empty() { &rebinds } else { &raw_rebinds };

        if !all_rebinds.is_empty() {
            let mut found_any = false;
            for (target_key, rebound_cmd) in all_rebinds {
                let rebound_resolved = resolve_command(rebound_cmd, aliases);
                if let Some(wnum) = extract_weapon_number(&rebound_resolved) {
                    if let Some(wname) = impulse_to_weapon(wnum) {
                        // If the resolved alias also fires (+attack), it's quickfire
                        let is_quickfire = has_attack(&resolved);
                        has_custom_weapon_binds = true;
                        found_any = true;
                        weapon_binds.push(WeaponBind {
                            weapon: wname.to_string(),
                            key: format_key_name(&key_upper),
                            method: if is_quickfire { "quickfire".to_string() } else { "manual".to_string() },
                            fire_key: if is_quickfire { None } else { Some(format_key_name(target_key)) },
                        });
                    }
                }
            }
            // Also check for a direct weapon in the resolved command
            // e.g. +boom resolves to "weapon 2; +attack; bind mouse1 +boom"
            if !found_any {
                if let Some(wnum) = extract_weapon_number(&resolved) {
                    if let Some(wname) = impulse_to_weapon(wnum) {
                        let is_quickfire = has_attack(&resolved);
                        has_custom_weapon_binds = true;
                        weapon_binds.push(WeaponBind {
                            weapon: wname.to_string(),
                            key: format_key_name(&key_upper),
                            method: if is_quickfire { "quickfire".to_string() } else { "manual".to_string() },
                            fire_key: if is_quickfire { None } else { Some("Mouse1".to_string()) },
                        });
                    }
                }
            }
            continue;
        }

        // Priority 2: check if this command directly involves a weapon
        let weapon_num = extract_weapon_number(&resolved);
        if weapon_num.is_none() {
            continue;
        }

        let weapon_num = weapon_num.unwrap();
        let weapon_name = match impulse_to_weapon(weapon_num) {
            Some(name) => name,
            None => continue,
        };

        // Skip default impulse binds on number keys (legacy)
        if is_default_impulse_bind(&key_upper, cmd) {
            continue;
        }

        // Classify: quickfire vs manual
        if has_attack(&resolved) {
            // Has +attack in the resolved command → quickfire
            has_custom_weapon_binds = true;
            weapon_binds.push(WeaponBind {
                weapon: weapon_name.to_string(),
                key: format_key_name(&key_upper),
                method: "quickfire".to_string(),
                fire_key: None,
            });
        } else if rebinds_mouse1(&resolved) {
            // Rebinds mouse1 but no +attack → manual select
            has_custom_weapon_binds = true;
            weapon_binds.push(WeaponBind {
                weapon: weapon_name.to_string(),
                key: format_key_name(&key_upper),
                method: "manual".to_string(),
                fire_key: Some("Mouse1".to_string()),
            });
        } else {
            // Just impulse/weapon select, no attack, no rebind
            // Could be legacy or a select-only bind
            // Only include if it's NOT a default number key bind
            let is_number_key = key_upper.len() == 1 && key_upper.chars().next().map_or(false, |c| c.is_ascii_digit());
            if !is_number_key {
                has_custom_weapon_binds = true;
                weapon_binds.push(WeaponBind {
                    weapon: weapon_name.to_string(),
                    key: format_key_name(&key_upper),
                    method: "manual".to_string(),
                    fire_key: Some("Mouse1".to_string()),
                });
            }
        }
    }

    // If no custom weapon binds found, include number key binds as manual
    if !has_custom_weapon_binds {
        for (key, cmd) in bindings {
            let key_upper = key.to_uppercase();
            let resolved = resolve_command(cmd, aliases);
            if let Some(wnum) = extract_weapon_number(&resolved) {
                if let Some(wname) = impulse_to_weapon(wnum) {
                    weapon_binds.push(WeaponBind {
                        weapon: wname.to_string(),
                        key: format_key_name(&key_upper),
                        method: "manual".to_string(),
                        fire_key: Some("Mouse1".to_string()),
                    });
                }
            }
        }
    }

    // Check if Mouse1 is a "primary fire button" (target of multiple rebinds).
    // If other keys rebind Mouse1, then Mouse1's own weapon bind is just
    // the last-saved state, not an intentional weapon bind.
    let mouse1_rebind_count = weapon_binds.iter()
        .filter(|wb| wb.fire_key.as_deref() == Some("Mouse1"))
        .count();
    let mouse1_is_primary_fire = mouse1_rebind_count >= 2;

    // Keep all binds per weapon (a player may have multiple binds for the same weapon).
    // Just filter out Mouse1 if it's a primary fire button.
    let mut result: Vec<WeaponBind> = weapon_binds.into_iter()
        .filter(|wb| !(mouse1_is_primary_fire && wb.key == "Mouse1"))
        .collect();

    // Sort by weapon order: rl, lg, gl, sng, ng, ssg, sg, axe
    let order = ["rl", "lg", "gl", "sng", "ng", "ssg", "sg", "axe"];
    result.sort_by_key(|wb| order.iter().position(|&w| w == wb.weapon).unwrap_or(99));

    result
}

fn build_config(parsed: ParsedConfig) -> EzQuakeConfig {
    let bindings = parsed.bindings;
    let aliases = parsed.aliases;
    let parsed = parsed.cvars;
    let defaults = default_cvars();

    let sensitivity = get_cvar(&parsed, &defaults, "sensitivity").parse::<f64>().unwrap_or(12.0);
    let m_yaw = get_cvar(&parsed, &defaults, "m_yaw").parse::<f64>().unwrap_or(0.022);
    let m_pitch = get_cvar(&parsed, &defaults, "m_pitch").parse::<f64>().unwrap_or(0.022);
    let m_accel = get_cvar(&parsed, &defaults, "m_accel").parse::<f64>().unwrap_or(0.0);

    // Detect LG-specific sensitivity: scan aliases/binds for sensitivity changes
    // tied to LG (weapon 8). Common patterns:
    //   alias +lg "sensitivity .8; +fire 8 ..."
    //   alias __lg_settings "sensitivity 2.5; ..."
    let lg_sensitivity = {
        let mut lg_sens: Option<f64> = None;
        // Check all aliases that reference weapon 8 / LG
        for (_name, cmd) in &aliases {
            let lower = cmd.to_lowercase();
            let has_lg = lower.contains("impulse 8") || lower.contains("weapon 8")
                || lower.contains("+fire 8") || lower.contains("+fire_ar 8");
            if has_lg {
                // Look for "sensitivity X" in the same alias
                for part in lower.split(';') {
                    let part = part.trim();
                    if part.starts_with("sensitivity ") {
                        if let Ok(s) = part[12..].trim().parse::<f64>() {
                            lg_sens = Some(s);
                        }
                    }
                }
            }
        }
        // Also check binds that directly use +fire 8 with sensitivity
        for (_key, cmd) in &bindings {
            let resolved = resolve_command(cmd, &aliases);
            let lower = resolved.to_lowercase();
            let has_lg = lower.contains("+fire 8") || lower.contains("+fire_ar 8");
            if has_lg {
                for part in lower.split(';') {
                    let part = part.trim();
                    if part.starts_with("sensitivity ") {
                        if let Ok(s) = part[12..].trim().parse::<f64>() {
                            lg_sens = Some(s);
                        }
                    }
                }
            }
        }
        lg_sens
    };

    // fov: prefer default_fov if set (it's the "real" fov), fall back to fov
    let fov_str = if parsed.contains_key("default_fov") {
        get_cvar(&parsed, &defaults, "default_fov")
    } else {
        get_cvar(&parsed, &defaults, "fov")
    };
    let fov = fov_str.parse::<f64>().unwrap_or(90.0);

    let in_raw = get_cvar(&parsed, &defaults, "in_raw") != "0";
    let vid_usedesktopres = get_cvar(&parsed, &defaults, "vid_usedesktopres") != "0";
    let vid_fullscreen = get_cvar(&parsed, &defaults, "vid_fullscreen") != "0";

    // Determine effective playing resolution.
    // See docs/EZQUAKE-RESOLUTION.md for full source code analysis.
    //
    // Fullscreen: vid_width/vid_height always reflect the actual res
    //   (ezQuake auto-sets them even when vid_usedesktopres=1)
    // Windowed: vid_win_width/vid_win_height are the window dimensions
    let (vid_width, vid_height) = if vid_fullscreen {
        let w = get_cvar(&parsed, &defaults, "vid_width").parse::<u32>().unwrap_or(0);
        let h = get_cvar(&parsed, &defaults, "vid_height").parse::<u32>().unwrap_or(0);
        (w, h) // 0,0 means desktop res (frontend falls back to detected desktop res)
    } else {
        let w = get_cvar(&parsed, &defaults, "vid_win_width").parse::<u32>().unwrap_or(0);
        let h = get_cvar(&parsed, &defaults, "vid_win_height").parse::<u32>().unwrap_or(0);
        (w, h)
    };

    let vid_displayfrequency = get_cvar(&parsed, &defaults, "vid_displayfrequency")
        .parse::<u32>().unwrap_or(0);
    let cl_maxfps = get_cvar(&parsed, &defaults, "cl_maxfps")
        .parse::<u32>().unwrap_or(0);

    let player_name = get_cvar(&parsed, &defaults, "name").to_string();
    let player_name_qw = expand_qw_name(&player_name);
    let team = get_cvar(&parsed, &defaults, "team").to_string();
    let team_qw = expand_qw_name(&team);
    let topcolor = get_cvar(&parsed, &defaults, "topcolor").parse::<u8>().unwrap_or(0);
    let bottomcolor = get_cvar(&parsed, &defaults, "bottomcolor").parse::<u8>().unwrap_or(0);

    // Extract movement key bindings
    let movement = MovementKeys {
        forward: find_bind(&bindings, "+forward"),
        back: find_bind(&bindings, "+back"),
        moveleft: find_bind(&bindings, "+moveleft"),
        moveright: find_bind(&bindings, "+moveright"),
        jump: find_bind(&bindings, "+jump"),
    };

    let weapon_binds = analyze_weapon_binds(&bindings, &aliases);

    EzQuakeConfig {
        player_name,
        player_name_qw,
        team,
        team_qw,
        topcolor,
        bottomcolor,
        sensitivity,
        lg_sensitivity,
        m_yaw,
        m_pitch,
        m_accel,
        fov,
        in_raw,
        vid_usedesktopres,
        vid_width,
        vid_height,
        vid_displayfrequency,
        cl_maxfps,
        movement,
        weapon_binds,
        raw_cvars: parsed,
    }
}

// ============================================================
// Path resolution
// ============================================================

/// Given the path to ezquake.exe, derive the config directory.
/// ezQuake stores configs in `<exe_dir>/ezquake/configs/`
fn config_dir_from_exe(exe_path: &Path) -> PathBuf {
    exe_path.parent().unwrap_or(Path::new(".")).join("ezquake").join("configs")
}

/// Validate that a path points to a real ezQuake executable.
fn validate_exe(path: &Path) -> bool {
    if !path.exists() || !path.is_file() {
        return false;
    }
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    name.contains("ezquake") || name.contains("fteqw")
}

// ============================================================
// Tauri commands
// ============================================================

/// Validate an ezQuake exe path and return info about it.
#[derive(Serialize)]
pub struct EzQuakeInstallation {
    pub exe_path: String,
    pub config_dir: String,
    pub config_files: Vec<String>,
    pub valid: bool,
    pub version: Option<String>,
}

/// Read PE FileVersionRaw from an executable (Windows only).
#[cfg(target_os = "windows")]
pub fn read_exe_version(path: &Path) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, VS_FIXEDFILEINFO,
    };

    let wide_path: Vec<u16> = path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut handle = 0u32;
        let size = GetFileVersionInfoSizeW(PCWSTR(wide_path.as_ptr()), Some(&mut handle));
        if size == 0 {
            return None;
        }

        let mut buffer = vec![0u8; size as usize];
        let ok = GetFileVersionInfoW(
            PCWSTR(wide_path.as_ptr()),
            Some(handle),
            size,
            buffer.as_mut_ptr() as *mut _,
        );
        if !ok.is_ok() {
            return None;
        }

        let mut info_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
        let mut info_len: u32 = 0;
        let sub_block: Vec<u16> = "\\\0".encode_utf16().collect();
        let ok = VerQueryValueW(
            buffer.as_ptr() as *const _,
            PCWSTR(sub_block.as_ptr()),
            &mut info_ptr,
            &mut info_len,
        );
        if !ok.as_bool() || info_ptr.is_null() {
            return None;
        }

        let info = &*(info_ptr as *const VS_FIXEDFILEINFO);
        let major = (info.dwFileVersionMS >> 16) & 0xFFFF;
        let minor = info.dwFileVersionMS & 0xFFFF;
        let patch = (info.dwFileVersionLS >> 16) & 0xFFFF;
        let build = info.dwFileVersionLS & 0xFFFF;

        if major == 0 && minor == 0 && patch == 0 && build == 0 {
            return None; // No version info
        }

        Some(format!("{}.{}.{}.{}", major, minor, patch, build))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn read_exe_version(_path: &Path) -> Option<String> {
    None // Version detection only supported on Windows for now
}

#[tauri::command]
pub fn validate_ezquake_path(exe_path: String) -> EzQuakeInstallation {
    let path = PathBuf::from(&exe_path);

    if !validate_exe(&path) {
        return EzQuakeInstallation {
            exe_path,
            config_dir: String::new(),
            config_files: Vec::new(),
            valid: false,
            version: None,
        };
    }

    let version = read_exe_version(&path);

    let cfg_dir = config_dir_from_exe(&path);
    let config_files = if cfg_dir.exists() {
        std::fs::read_dir(&cfg_dir)
            .ok()
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map_or(false, |ext| ext == "cfg"))
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    EzQuakeInstallation {
        exe_path,
        config_dir: cfg_dir.to_string_lossy().to_string(),
        config_files,
        valid: true,
        version,
    }
}

/// Read and parse an ezQuake config file.
#[tauri::command]
pub fn read_ezquake_config(exe_path: String, config_name: String) -> Result<EzQuakeConfig, String> {
    let path = PathBuf::from(&exe_path);
    if !validate_exe(&path) {
        return Err("Invalid ezQuake path".into());
    }

    let cfg_dir = config_dir_from_exe(&path);
    let cfg_path = cfg_dir.join(&config_name);
    if !cfg_path.exists() {
        return Err(format!("Config file not found: {}", cfg_path.display()));
    }

    // Read as bytes and convert lossy — ezQuake configs may contain
    // non-UTF-8 bytes (QW color codes in player names, etc.)
    let bytes = std::fs::read(&cfg_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let content = String::from_utf8_lossy(&bytes).to_string();

    let mut parsed = parse_config(&content);

    // Follow exec references to load additional aliases and binds.
    // ezQuake resolves paths relative to the game directory (parent of configs/).
    let game_dir = cfg_dir.parent().unwrap_or(&cfg_dir);
    let exec_refs = parsed.exec_refs.clone();
    for exec_path in &exec_refs {
        // Try multiple resolution paths: relative to game dir, relative to config dir
        let candidates = [
            game_dir.join(exec_path),
            cfg_dir.join(exec_path),
            game_dir.join(exec_path.trim_start_matches("configs/")),
        ];
        for candidate in &candidates {
            if candidate.exists() {
                if let Ok(bytes) = std::fs::read(candidate) {
                    let sub_content = String::from_utf8_lossy(&bytes).to_string();
                    let sub_parsed = parse_config(&sub_content);
                    // Merge aliases from sub-config (main config takes priority)
                    for (k, v) in sub_parsed.aliases {
                        parsed.aliases.entry(k).or_insert(v);
                    }
                    // Merge binds (sub-config binds come after main, so they can override)
                    for binding in sub_parsed.bindings {
                        parsed.bindings.push(binding);
                    }
                }
                break;
            }
        }
    }

    Ok(build_config(parsed))
}

/// Launch ezQuake with optional parameters.
#[derive(Deserialize)]
pub struct LaunchOptions {
    pub exe_path: String,
    pub action: Option<String>,    // "connect", "observe", "join"
    pub server: Option<String>,    // "ip:port"
    pub extra_args: Option<Vec<String>>,
}

#[tauri::command]
pub fn launch_ezquake(options: LaunchOptions) -> Result<(), String> {
    let path = PathBuf::from(&options.exe_path);
    if !validate_exe(&path) {
        return Err("Invalid ezQuake path".into());
    }

    let mut cmd = std::process::Command::new(&path);

    // Set working directory to the exe's parent (ezQuake expects this)
    if let Some(parent) = path.parent() {
        cmd.current_dir(parent);
    }

    // Add server connection args
    if let (Some(action), Some(server)) = (&options.action, &options.server) {
        match action.as_str() {
            "connect" => { cmd.arg(format!("+connect {}", server)); }
            "observe" => { cmd.arg(format!("+observe {}", server)); }
            "join" => { cmd.arg(format!("+join {}", server)); }
            _ => {}
        }
    }

    // Add any extra args
    if let Some(args) = &options.extra_args {
        for arg in args {
            cmd.arg(arg);
        }
    }

    cmd.spawn().map_err(|e| format!("Failed to launch ezQuake: {}", e))?;
    Ok(())
}
