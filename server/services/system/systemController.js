const ollama = require("../ollama");
const robot = require("robotjs");
const { exec } = require("child_process");
const {
  setVolume,
  setBrightness,
  adjustVolume,
  adjustBrightness,
} = require("./systemDrivers");
const { platform } = require("os");
const os = require("os");

async function systemController(userQuery) {
  const prompt = `
You are a system control parser. Convert user request into JSON actions ONLY. No explanation.

Allowed actions and their value field:
- set_volume        → value: 0-100 (exact percentage)
- volume_up         → value: amount to increase (default 10)
- volume_down       → value: amount to decrease (default 10)
- set_brightness    → value: 0-100 (exact percentage)
- brightness_up     → value: amount to increase (default 10)
- brightness_down   → value: amount to decrease (default 10)
- open_app          → target: app name (e.g. "Safari", "Spotify", "Calculator")
- close_app         → target: app name
- sleep             → put computer to sleep (no value needed)
- lock_screen       → lock the screen (no value needed)
- shutdown          → shut down the computer (no value needed)
- restart           → restart the computer (no value needed)
- show_desktop      → hide all windows and show desktop (no value needed)
- screenshot        → take a screenshot (no value needed)
- app_switcher      → open the app switcher / show all open apps (no value needed)
- mute              → mute audio (no value needed)
- unmute            → unmute audio (no value needed)
- type_text         → value: text to type
- press_key         → value: key name
- open_url          → target: full URL

Return ONLY valid JSON, no markdown, no explanation:
{
  "actions": [
    { "type": "action_name", "target": "", "value": 0 }
  ]
}

Examples:
"set volume to 30 percent"     → { "actions": [{ "type": "set_volume", "value": 30 }] }
"turn volume up"               → { "actions": [{ "type": "volume_up", "value": 10 }] }
"increase volume by 20"        → { "actions": [{ "type": "volume_up", "value": 20 }] }
"mute"                         → { "actions": [{ "type": "set_volume", "value": 0 }] }
"set brightness to 50"         → { "actions": [{ "type": "set_brightness", "value": 50 }] }
"brightness down a little"     → { "actions": [{ "type": "brightness_down", "value": 5 }] }
"open Chrome"                  → { "actions": [{ "type": "open_app", "target": "Google Chrome" }] }

User request: ${userQuery}
`;

  console.log("[SYSCTL] Parsing:", userQuery);
  const res = await ollama.post({
    model: "qwen3.5:9b",
    messages: [{ role: "user", content: prompt }],
    stream: false,
    think: false,
  });

  let parsed;
  try {
    let content = res.message.content?.trim() || "";
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^`+|`+$/g, "");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.log("[SYSCTL] RAW:", res.message.content);
    console.log("[SYSCTL] Parse error:", e.message);
    return { error: "Invalid system control response" };
  }

  console.log("[SYSCTL] Parsed:", JSON.stringify(parsed));
  const results = [];
  for (const action of parsed.actions || []) {
    results.push(await executeAction(action));
  }
  return { parsed, results };
}

async function executeAction(action) {
  console.log("[SYSCTL] Executing platform:", action, os.platform());
  const val = Number(action.value) || 0;

  switch (action.type) {
    // ── Volume ──────────────────────────────────────────────────────────────
    case "set_volume":
      return setVolume(val);

    case "volume_up":
      return adjustVolume("up", val || 10);

    case "volume_down":
      return adjustVolume("down", val || 10);

    case "mute":
      return adjustVolume("down", val || 0);

    case "unmute":
      return adjustVolume("up", val || 100);

    // ── Brightness ──────────────────────────────────────────────────────────
    case "set_brightness": {
      const result = await setBrightness(val);
      return result;
    }

    case "brightness_up":
      return adjustBrightness("up", val || 10);

    case "brightness_down":
      return adjustBrightness("down", val || 10);

    // ── Apps ────────────────────────────────────────────────────────────────
    case "open_app":
      if (os.platform() === "darwin") {
        exec(
          `open -a "${action.target}" 2>/dev/null || open -a "${action.target}.app"`,
        );
      } else if (os.platform() === "win32") {
        exec(`start "" "${action.target}"`);
      } else {
        exec(
          `xdg-open "${action.target}" 2>/dev/null || ${action.target.toLowerCase()}`,
        );
      }
      return `Opened ${action.target}`;

    case "close_app":
      if (os.platform() === "darwin") {
        exec(`osascript -e 'quit app "${action.target}"' 2>/dev/null`);
      } else if (os.platform() === "win32") {
        exec(`taskkill /IM "${action.target}.exe" /F`);
      } else {
        exec(`pkill -f "${action.target}"`);
      }
      return `Closed ${action.target}`;

    // ── Input ───────────────────────────────────────────────────────────────
    case "type_text":
      robot.typeString(action.value || "");
      return "Typed text";

    case "press_key":
      robot.keyTap(action.value || "");
      return `Pressed ${action.value}`;

    case "click":
      robot.mouseClick();
      return "Clicked";

    case "move_mouse":
      robot.moveMouse(action.x || 0, action.y || 0);
      return "Mouse moved";

    case "scroll":
      robot.scrollMouse(0, action.value > 0 ? 3 : -3);
      return "Scrolled";

    // ── URLs ─────────────────────────────────────────────────────────────────
    case "open_url": {
      const open = (await import("open")).default;
      await open(action.target);
      return `Opened ${action.target}`;
    }

    case "switch_tab":
      robot.keyTap("tab", ["control"]);
      return "Switched tab";

    case "sleep":
      if (os.platform() === "darwin") {
        exec(`pmset displaysleepnow`);
      } else if (os.platform() === "win32") {
        exec(`rundll32.exe powrprof.dll,SetSuspendState 0,1,0`);
      } else {
        exec(`systemctl suspend`);
      }
      return "Putting computer to sleep...";

    case "lock_screen":
      if (os.platform() === "darwin") {
        console.log("sleep test");
        const { spawn } = require("child_process");

        spawn("pmset", ["displaysleepnow"], {
          detached: true,
          stdio: "ignore",
          env: process.env,
        }).unref();
      } else if (os.platform() === "win32") {
        exec(`rundll32.exe user32.dll,LockWorkStation`);
      } else {
        exec(`loginctl lock-session 2>/dev/null || xdg-screensaver lock`);
      }

      return "Screen locked";

    case "shutdown":
      if (os.platform() === "darwin") {
        exec(`osascript -e 'tell application "System Events" to shut down'`);
      } else if (os.platform() === "win32") {
        exec(`shutdown /s /t 10`);
      } else {
        exec(`shutdown -h now`);
      }
      return "Shutting down...";

    case "restart":
      if (os.platform() === "darwin") {
        exec(`osascript -e 'tell application "System Events" to restart'`);
      } else if (os.platform() === "win32") {
        exec(`shutdown /r /t 10`);
      } else {
        exec(`shutdown -r now`);
      }
      return "Restarting...";

    case "show_desktop":
      if (os.platform() === "darwin") {
        // Mission Control show desktop shortcut: Fn+F11 or Command+F3
        exec(
          `osascript -e 'tell application "System Events" to key code 103 using {command down}'`,
        );
      } else if (os.platform() === "win32") {
        exec(
          `powershell -c "(New-Object -ComObject Shell.Application).ToggleDesktop()"`,
        );
      } else {
        exec(`wmctrl -k on 2>/dev/null`);
      }
      return "Showing desktop";

    case "app_switcher":
      if (os.platform() === "darwin") {
        // Mission Control (shows all open windows)
        exec(`osascript -e 'tell application "Mission Control" to launch'`);
      } else if (os.platform() === "win32") {
        // Task View
        exec(
          `powershell -c "(New-Object -ComObject WScript.Shell).SendKeys('^{ESC}')"`,
        );
        robot.keyTap("tab", ["meta"]);
      } else {
        exec(`wmctrl -k off 2>/dev/null`);
      }
      return "Opening app switcher";

    case "screenshot":
      if (os.platform() === "darwin") {
        const path = `${os.homedir()}/Desktop/screenshot_${Date.now()}.png`;

        exec(`screencapture "${path}"`, (err) => {
          if (err) {
            console.error("[SCREENSHOT ERROR]", err);
          } else {
            console.log("[SCREENSHOT SAVED]", path);
          }
        });
      } else if (os.platform() === "win32") {
        robot.keyTap("printscreen");
      } else {
        exec(
          `scrot ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png 2>/dev/null || gnome-screenshot`,
        );
      }

      return "Screenshot taken";

    default:
      console.log("[SYSCTL] Unknown action:", action.type);
      return `Unknown action: ${action.type}`;
  }
}

module.exports = { systemController };
