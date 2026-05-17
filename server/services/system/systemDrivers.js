const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const path = require("path");
const util = require("util");

const execAsync = util.promisify(exec);

// ─── AppleScript runner ───────────────────────────────────────────────────────
async function runAppleScript(script) {
  const tmpFile = path.join(os.tmpdir(), `jarvis_as_${Date.now()}.applescript`);
  fs.writeFileSync(tmpFile, script, "utf8");
  try {
    const { stdout } = await execAsync(`osascript "${tmpFile}"`);
    return stdout.trim();
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME
// ═══════════════════════════════════════════════════════════════════════════════

// Read current system volume (0–100)
async function getCurrentVolume() {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await execAsync(
        `osascript -e "output volume of (get volume settings)"`,
      );
      const val = parseInt(stdout.trim());
      if (!isNaN(val)) {
        console.log(`[VOLUME] Current: ${val}%`);
        return val;
      }
    } else if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `powershell -c "(Get-WmiObject -Query 'SELECT * FROM Win32_SoundDevice').Volume"`,
      );
      const val = parseInt(stdout.trim());
      if (!isNaN(val)) return Math.round((val / 65535) * 100);
    } else {
      // Linux: amixer
      const { stdout } = await execAsync(`amixer get Master 2>/dev/null`);
      const match = stdout.match(/(\d+)%/);
      if (match) return parseInt(match[1]);
    }
  } catch (e) {
    console.log("[VOLUME] Could not read current volume:", e.message);
  }
  return null;
}

// Set volume to exact percentage
async function setVolume(level) {
  const clamped = Math.max(0, Math.min(100, level));
  console.log(`[VOLUME] Target: ${clamped}%`);

  if (process.platform === "darwin") {
    // macOS: osascript can set exact volume directly — no key tapping needed
    try {
      await execAsync(`osascript -e "set volume output volume ${clamped}"`);
      console.log(`[VOLUME] Set via osascript to ${clamped}%`);
      return `Volume set to ${clamped}%`;
    } catch (e) {
      console.log("[VOLUME] osascript failed:", e.message);
    }
  } else if (process.platform === "win32") {
    // Windows: nircmd (if installed) or PowerShell
    try {
      await execAsync(
        `nircmd.exe setsysvolume ${Math.round(clamped * 655.35)}`,
      );
      return `Volume set to ${clamped}%`;
    } catch (_) {}
    // PowerShell fallback
    try {
      const script = `
$obj = New-Object -ComObject WScript.Shell
$current = (Get-WmiObject -Query 'SELECT * FROM Win32_SoundDevice').Volume
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume { }
"@
`;
      // Simple fallback: use key taps via PowerShell
      const current = await getCurrentVolume();
      if (current !== null) {
        await setVolumeViaKeys(clamped, current);
      }
      return `Volume set to ~${clamped}%`;
    } catch (e) {
      return `Volume failed: ${e.message}`;
    }
  } else {
    // Linux: amixer or pactl
    try {
      await execAsync(`amixer set Master ${clamped}% 2>/dev/null`);
      return `Volume set to ${clamped}%`;
    } catch (_) {}
    try {
      await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${clamped}%`);
      return `Volume set to ${clamped}%`;
    } catch (e) {
      return `Volume failed: ${e.message}`;
    }
  }

  return `Volume set to ${clamped}%`;
}

// Volume via key taps (fallback for Windows, or for up/down commands)
async function setVolumeViaKeys(targetPct, currentPct) {
  // Each media key tap = ~2% on most systems
  const PCT_PER_TAP = 2;
  const diff = targetPct - currentPct;
  const taps = Math.max(1, Math.round(Math.abs(diff) / PCT_PER_TAP));
  const key = diff > 0 ? "audio_vol_up" : "audio_vol_down";

  console.log(`[VOLUME] Keys: ${diff > 0 ? "UP" : "DOWN"} ${taps} taps`);

  if (process.platform === "darwin") {
    const keyCode = diff > 0 ? 0 : 1; // F12=up F11=down on some layouts
    const lines = [];
    for (let i = 0; i < taps; i++) {
      lines.push(
        `key code ${diff > 0 ? 0 : 11} using {shift down, option down}`,
      );
      lines.push(`delay 0.02`);
    }
    const script = `tell application "System Events"\n  ${lines.join("\n  ")}\nend tell`;
    try {
      await runAppleScript(script);
    } catch (_) {}
  }
}

// Volume up/down by a relative amount
async function adjustVolume(direction, amount = 10) {
  const current = await getCurrentVolume();

  if (current !== null) {
    const target =
      direction === "up"
        ? Math.min(100, current + amount)
        : Math.max(0, current - amount);
    return setVolume(target);
  }

  // Fallback to key taps
  if (process.platform === "darwin") {
    const taps = Math.round(amount / 6.25); // each tap ≈ 6.25% on mac
    const keyCode = direction === "up" ? 0 : 1;
    const lines = [];
    for (let i = 0; i < taps; i++) {
      lines.push(
        `key code ${direction === "up" ? 0 : 11} using {shift down, option down}`,
      );
      lines.push(`delay 0.02`);
    }
    const script = `tell application "System Events"\n  ${lines.join("\n  ")}\nend tell`;
    try {
      await runAppleScript(script);
    } catch (_) {}
    return `Volume ${direction}`;
  }

  return `Volume ${direction}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRIGHTNESS
// ═══════════════════════════════════════════════════════════════════════════════

async function getCurrentBrightnessIoreg() {
  const classes = [
    "AppleBacklightDisplay",
    "IODisplayConnect",
    "AppleM1DisplayPipe",
    "IOMobileFramebuffer",
  ];
  for (const cls of classes) {
    try {
      const { stdout } = await execAsync(
        `ioreg -c ${cls} -r -d 4 2>/dev/null | grep -E '"brightness"|"Brightness"|"BrightnessValue"' | head -3`,
      );
      if (!stdout.trim()) continue;
      const match = stdout.match(/=\s*([\d.]+)/);
      if (match) {
        const raw = parseFloat(match[1]);
        const pct =
          raw <= 1
            ? Math.round(raw * 100)
            : raw <= 100
              ? Math.round(raw)
              : Math.round((raw / 1024) * 100);
        console.log(`[BRIGHTNESS] ioreg (${cls}): raw=${raw} → ${pct}%`);
        return pct;
      }
    } catch (_) {}
  }
  return null;
}

async function getCurrentBrightness() {
  try {
    const { stdout } = await execAsync(
      `osascript -e "tell application \\"System Events\\" to get value of (first slider of first window of process \\"ControlCenter\\")" 2>/dev/null`,
    );
    const val = parseFloat(stdout.trim());
    if (!isNaN(val) && val >= 0 && val <= 1) {
      const pct = Math.round(val * 100);
      console.log(`[BRIGHTNESS] Read ControlCenter slider: ${pct}%`);
      return pct;
    }
  } catch (_) {}

  const ioPct = await getCurrentBrightnessIoreg();
  if (ioPct !== null) return ioPct;

  console.log("[BRIGHTNESS] Could not read current brightness");
  return null;
}

async function detectBrightnessSteps() {
  try {
    const { stdout } = await execAsync("uname -m");
    if (stdout.trim() === "arm64") {
      console.log("[BRIGHTNESS] M-series → 32 steps");
      return 32;
    }
  } catch (_) {}
  console.log("[BRIGHTNESS] Intel → 16 steps");
  return 16;
}

async function sendBrightnessKeys(keyCode, steps) {
  if (steps <= 0) return;
  const lines = [];
  for (let i = 0; i < steps; i++) {
    lines.push(`key code ${keyCode}`);
    lines.push(`delay 0.03`);
  }
  const script = `tell application "System Events"\n  ${lines.join("\n  ")}\nend tell`;
  await runAppleScript(script);
}

async function setBrightness(level) {
  const clamped = Math.max(0, Math.min(100, level));
  console.log(`[BRIGHTNESS] Target: ${clamped}%`);

  if (process.platform !== "darwin") {
    if (process.platform === "win32") {
      exec(
        `powershell (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${clamped})`,
      );
    } else {
      // Linux
      try {
        await execAsync(`brightnessctl set ${clamped}%`);
        return `Brightness set to ${clamped}%`;
      } catch (_) {}
      try {
        await execAsync(`xrandr --output eDP-1 --brightness ${clamped / 100}`);
        return `Brightness set to ${clamped}%`;
      } catch (_) {}
    }
    return `Brightness set to ${clamped}`;
  }

  const totalSteps = await detectBrightnessSteps();
  const pctPerStep = 100 / totalSteps;
  const current = await getCurrentBrightness();

  if (current !== null) {
    const diff = clamped - current;
    const steps = Math.round(Math.abs(diff) / pctPerStep);
    if (steps === 0) return `Brightness already at ${current}%`;
    const keyCode = diff > 0 ? 144 : 145;
    console.log(
      `[BRIGHTNESS] Delta: ${diff > 0 ? "UP" : "DOWN"} ${steps} steps from ${current}% → ${clamped}%`,
    );
    await sendBrightnessKeys(keyCode, steps);
    return `Brightness set to ~${clamped}% (was ${current}%)`;
  }

  // Absolute reset fallback
  console.log("[BRIGHTNESS] Absolute reset fallback");
  const targetSteps = Math.round((clamped / 100) * totalSteps);
  await sendBrightnessKeys(145, totalSteps + 5);
  await new Promise((r) => setTimeout(r, 300));
  if (targetSteps > 0) await sendBrightnessKeys(144, targetSteps);
  return `Brightness set to ~${clamped}%`;
}

// Relative brightness adjustment
async function adjustBrightness(direction, amount = 10) {
  const current = await getCurrentBrightness();
  if (current !== null) {
    const target =
      direction === "up"
        ? Math.min(100, current + amount)
        : Math.max(0, current - amount);
    return setBrightness(target);
  }
  // Fallback key taps
  const totalSteps = await detectBrightnessSteps();
  const steps = Math.round((amount / 100) * totalSteps);
  await sendBrightnessKeys(direction === "up" ? 144 : 145, steps);
  return `Brightness ${direction}`;
}

module.exports = {
  setVolume,
  setBrightness,
  getCurrentVolume,
  getCurrentBrightness,
  adjustVolume,
  adjustBrightness,
};
