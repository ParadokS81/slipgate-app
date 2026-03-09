use serde::Serialize;

#[derive(Serialize)]
pub struct AudioDevice {
    pub name: String,
    pub device_type: String, // "input" or "output"
}

#[derive(Serialize)]
pub struct HidDevice {
    pub name: String,
    pub device_type: String, // "mouse", "keyboard", or "other"
}

#[derive(Serialize)]
pub struct PeripheralSpecs {
    pub audio_devices: Vec<AudioDevice>,
    pub hid_devices: Vec<HidDevice>,
}

#[tauri::command]
pub fn get_peripheral_specs() -> PeripheralSpecs {
    let (hid_devices, audio_devices) = detect_all();

    PeripheralSpecs {
        audio_devices,
        hid_devices,
    }
}

// --- Windows detection using PowerShell script ---

#[cfg(target_os = "windows")]
fn detect_all() -> (Vec<HidDevice>, Vec<AudioDevice>) {
    let mut hid_devices = Vec::new();
    let mut audio_devices = Vec::new();

    // Single PowerShell invocation to get everything
    let script = r#"
$results = @()

# Get USB devices with bus-reported names (the real product strings)
$usbDevices = Get-PnpDevice -Class 'USB' -Status OK | Where-Object {
    $_.InstanceId -like 'USB\VID_*' -and $_.InstanceId -notlike '*MI_*'
}

foreach ($dev in $usbDevices) {
    try {
        $busName = (Get-PnpDeviceProperty -InstanceId $dev.InstanceId -KeyName DEVPKEY_Device_BusReportedDeviceDesc -ErrorAction SilentlyContinue).Data
        $friendlyName = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Enum\$($dev.InstanceId)" -ErrorAction SilentlyContinue).FriendlyName

        if (-not $busName -and -not $friendlyName) { continue }

        $name = if ($busName) { $busName } else { $friendlyName }

        # Skip hubs and root devices
        if ($name -like '*Hub*' -or $name -like '*Host Controller*') { continue }

        # Determine device type by checking child HID devices
        $vid_pid = $dev.InstanceId -replace 'USB\\(VID_[0-9A-F]+&PID_[0-9A-F]+)\\.*', '$1'

        $hasMouseChild = $false
        $hasKeyboardChild = $false

        $childDevices = Get-PnpDevice -Status OK | Where-Object {
            ($_.InstanceId -like "HID\$vid_pid*") -and ($_.Class -eq 'Mouse' -or $_.Class -eq 'Keyboard')
        }

        foreach ($child in $childDevices) {
            if ($child.Class -eq 'Mouse') { $hasMouseChild = $true }
            if ($child.Class -eq 'Keyboard') { $hasKeyboardChild = $true }
        }

        # Check if it's an audio device via registry service
        $service = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Enum\$($dev.InstanceId)" -ErrorAction SilentlyContinue).Service
        $isAudio = ($service -eq 'usbaudio' -or $service -eq 'usbaudio2')

        # Classification: keyboard takes priority over mouse (keyboards with knobs register as both)
        $deviceType = "other"
        if ($hasKeyboardChild) { $deviceType = "keyboard" }
        elseif ($hasMouseChild) { $deviceType = "mouse" }
        elseif ($isAudio) { $deviceType = "audio" }

        $results += [PSCustomObject]@{
            name = $name
            device_type = $deviceType
        }
    } catch {}
}

# Get audio endpoints for input/output device names
$audioEndpoints = @()
Get-PnpDevice -Class 'AudioEndpoint' -Status OK | ForEach-Object {
    $audioEndpoints += [PSCustomObject]@{
        name = $_.FriendlyName
    }
}

$output = [PSCustomObject]@{
    usb_devices = $results
    audio_endpoints = $audioEndpoints
}

$output | ConvertTo-Json -Depth 3
"#;

    let output = match run_powershell_script(script) {
        Some(s) => s,
        None => return (hid_devices, audio_devices),
    };

    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct UsbDevice {
        name: Option<String>,
        device_type: Option<String>,
    }

    #[derive(serde::Deserialize)]
    struct AudioEndpoint {
        name: Option<String>,
    }

    #[derive(serde::Deserialize)]
    struct ScriptOutput {
        usb_devices: Option<JsonArrayOrSingle<UsbDevice>>,
        audio_endpoints: Option<JsonArrayOrSingle<AudioEndpoint>>,
    }

    let parsed: ScriptOutput = match serde_json::from_str(&output) {
        Ok(p) => p,
        Err(_) => return (hid_devices, audio_devices),
    };

    // Process USB devices into HID and audio categories
    if let Some(usb_devs) = parsed.usb_devices {
        for dev in usb_devs.into_vec() {
            let name = match dev.name {
                Some(n) if !n.is_empty() => n,
                _ => continue,
            };
            let dtype = dev.device_type.unwrap_or_default();
            match dtype.as_str() {
                "mouse" | "keyboard" => {
                    hid_devices.push(HidDevice {
                        name,
                        device_type: dtype,
                    });
                }
                "audio" => {
                    audio_devices.push(AudioDevice {
                        name,
                        device_type: "output".into(),
                    });
                }
                _ => {}
            }
        }
    }

    // Process audio endpoints for microphone detection
    if let Some(endpoints) = parsed.audio_endpoints {
        for ep in endpoints.into_vec() {
            let name = match ep.name {
                Some(n) if !n.is_empty() => n,
                _ => continue,
            };

            // Skip virtual audio (Voicemeeter, VB-Audio, Steam Streaming, etc.)
            let lower = name.to_lowercase();
            if lower.contains("voicemeeter")
                || lower.contains("vb-audio")
                || lower.contains("steam streaming")
                || lower.contains("virtual")
            {
                continue;
            }

            // Determine input vs output from the endpoint name
            let device_type = if lower.contains("microphone") || lower.contains("mic") {
                "input"
            } else {
                "output"
            };

            // Only add if we don't already have this device from USB detection
            let short_name = extract_device_name(&name);
            let already_exists = audio_devices.iter().any(|d| {
                name.to_lowercase().contains(&d.name.to_lowercase())
                    || d.name.to_lowercase().contains(&short_name.to_lowercase())
            });

            if !already_exists {
                audio_devices.push(AudioDevice {
                    name: short_name,
                    device_type: device_type.into(),
                });
            } else if device_type == "input" {
                // If the USB device was classified as output but endpoint says microphone,
                // update it to input
                if let Some(existing) = audio_devices.iter_mut().find(|d| {
                    name.to_lowercase().contains(&d.name.to_lowercase())
                }) {
                    existing.device_type = "input".into();
                }
            }
        }
    }

    (hid_devices, audio_devices)
}

#[cfg(not(target_os = "windows"))]
fn detect_all() -> (Vec<HidDevice>, Vec<AudioDevice>) {
    (Vec::new(), Vec::new())
}

/// Extract the device name from an audio endpoint name like "Speakers (iBasso DC07 Pro)"
/// Returns "iBasso DC07 Pro"
fn extract_device_name(endpoint_name: &str) -> String {
    if let Some(start) = endpoint_name.find('(') {
        if let Some(end) = endpoint_name.rfind(')') {
            let inner = endpoint_name[start + 1..end].trim();
            if !inner.is_empty() {
                return inner.to_string();
            }
        }
    }
    endpoint_name.to_string()
}

// --- JSON helper: PowerShell returns a single object {} for 1 result, array [] for multiple ---

#[derive(serde::Deserialize)]
#[serde(untagged)]
enum JsonArrayOrSingle<T> {
    Array(Vec<T>),
    Single(T),
}

impl<T> JsonArrayOrSingle<T> {
    fn into_vec(self) -> Vec<T> {
        match self {
            JsonArrayOrSingle::Array(v) => v,
            JsonArrayOrSingle::Single(v) => vec![v],
        }
    }
}

#[cfg(target_os = "windows")]
fn run_powershell_script(script: &str) -> Option<String> {
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .ok()?;

    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() || s == "null" {
        None
    } else {
        Some(s)
    }
}
