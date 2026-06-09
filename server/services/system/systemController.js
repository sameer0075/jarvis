const ollama = require("../ollama");
const robot = require("robotjs");
const { exec } = require("child_process");
const {
  setVolume,
  setBrightness,
  adjustVolume,
  adjustBrightness,
  getCurrentVolume,
  getCurrentBrightness,
} = require("./systemDrivers");
const os = require("os");

function fastParseSystemCommand(userMessage) {
  const msg = userMessage.toLowerCase();

  const volMatch = msg.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d+)/);
  if (volMatch) return { actions: [{ type: "set_volume", value: parseInt(volMatch[1]) }] };

  if (/volume\s+up|increase\s+volume|louder/.test(msg))
    return { actions: [{ type: "volume_up", value: 10 }] };
  if (/volume\s+down|decrease\s+volume|quieter|lower\s+volume/.test(msg))
    return { actions: [{ type: "volume_down", value: 10 }] };

  const brightMatch = msg.match(/brightness\s+(?:to\s+)?(\d+)/);
  if (brightMatch) return { actions: [{ type: "set_brightness", value: parseInt(brightMatch[1]) }] };

  if (/brightness\s+up|increase\s+brightness/.test(msg))
    return { actions: [{ type: "brightness_up", value: 10 }] };
  if (/brightness\s+down|decrease\s+brightness|dim/.test(msg))
    return { actions: [{ type: "brightness_down", value: 10 }] };

  if (/\bmute\b/.test(msg)) return { actions: [{ type: "set_volume", value: 0 }] };
  if (/lock\s+screen/.test(msg)) return { actions: [{ type: "lock_screen" }] };
  if (/screenshot/.test(msg)) return { actions: [{ type: "take_region_screenshot" }] };
  if (/sleep/.test(msg)) return { actions: [{ type: "sleep_display" }] };
  if (/wifi\s+on/.test(msg)) return { actions: [{ type: "wifi_on" }] };
  if (/wifi\s+off/.test(msg)) return { actions: [{ type: "wifi_off" }] };

  const openMatch = msg.match(/open\s+(.+)/);
  if (openMatch) return { actions: [{ type: "open_app", target: openMatch[1].trim() }] };

  return null; // fall through to LLM parser
}


async function systemController(userQuery) {
  const fast = fastParseSystemCommand(userQuery);
  if (fast) {
    const results = [];
    for (const action of fast.actions) results.push(await executeAction(action));
    return { parsed: fast, results };
  }
  
  const prompt = `
You are a system control parser. Convert user request into JSON actions ONLY. No explanation.

Allowed actions and their value field:
- minimize_window      → minimize current window
- maximize_window      → maximize current window
- force_quit           → target: app name

- next_track           → next media track
- previous_track       → previous media track
- play_pause           → toggle media playback

- wifi_on              → turn wifi on
- wifi_off             → turn wifi off
- bluetooth_on         → turn bluetooth on
- bluetooth_off        → turn bluetooth off

- clipboard_copy       → value: text
- clipboard_paste      → paste clipboard

- new_tab              → open new tab
- close_tab            → close current tab
- new_window           → open new window
- close_window         → close current window

- zoom_in              → zoom in current app
- zoom_out             → zoom out current app

- search_google        → value: query
- search_youtube       → value: query

- open_folder          → target: folder path or name

- get_battery          → get battery percentage
- get_volume           → get current volume
- get_brightness       → get current brightness

- microphone_mute      → mute microphone
- microphone_unmute    → unmute microphone

- empty_clipboard

- sleep_display
- lock_screen

- take_region_screenshot
- record_screen
- stop_recording

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

  const res = await ollama.post({
    model: "llama3.2:3b",
    keep_alive: -1,
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
    return { error: "Invalid system control response" };
  }

  const results = [];
  for (const action of parsed.actions || []) {
    results.push(await executeAction(action));
  }
  return { parsed, results };
}

async function executeAction(action) {
  const val = Number(action.value) || 0;
  const clipboardy = (await import("clipboardy")).default;

  switch (action.type) {
    // ── Volume ──────────────────────────────────────────────────────────────
    case "set_volume":
      return setVolume(val);

    case "volume_up":
      return adjustVolume("up", val || 10);

    case "volume_down":
      return adjustVolume("down", val || 10);

    case "mute":
    case "microphone_mute":
      return adjustVolume("down", val || 0);

    case "unmute":
    case "microphone_unmute":
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
    case "sleep_display":
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
    case "take_region_screenshot":
      if (os.platform() === "darwin") {
        const path = `${os.homedir()}/Desktop/screenshot_${Date.now()}.png`;

        exec(`screencapture "${path}"`, (err) => {
          if (err) {
          } else {
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

    case "play_pause":
      robot.keyTap("audio_play");
      return "Toggled playback";

    case "next_track":
      robot.keyTap("audio_next");
      return "Next track";

    case "previous_track":
      robot.keyTap("audio_prev");
      return "Previous track";

    case "minimize_window":
      if (os.platform() === "darwin") {
        exec(`
            osascript -e '
            tell application "System Events"
              tell (first application process whose frontmost is true)
                try
                  click button 3 of front window
                end try
              end tell
            end tell'
          `);
      } else if (os.platform() === "win32") {
        robot.keyTap("down", ["command"]);
      }

      return "Window minimized";

    case "close_window":
      robot.keyTap("w", ["command"]);
      return "Window closed";

    case "new_tab":
      robot.keyTap("t", ["command"]);
      return "New tab opened";

    case "close_tab":
      robot.keyTap("w", ["command"]);
      return "Tab closed";

    case "clipboard_copy":
      await clipboardy.write(action.value);
      return "Copied to clipboard";

    case "clipboard_paste":
      robot.keyTap("v", ["command"]);
      return "Pasted clipboard";

    case "empty_clipboard":
      await clipboardy.write("");
      return "Clipboard cleared";

    case "search_google": {
      const open = (await import("open")).default;
      const q = encodeURIComponent(action.value);
      await open(`https://www.google.com/search?q=${q}`);
      return `Searching Google for ${action.value}`;
    }

    case "search_youtube": {
      const open = (await import("open")).default;

      const query = String(action.value || "").trim();

      if (!query) {
        return "No YouTube search query provided";
      }

      const q = encodeURIComponent(query);

      await open(`https://www.youtube.com/results?search_query=${q}`);

      return `Searching YouTube for ${query}`;
    }

    case "open_folder":
      if (os.platform() === "darwin") {
        exec(`open "${action.target}"`);
      }
      return `Opened folder ${action.target}`;

    case "get_battery":
      if (os.platform() === "darwin") {
        exec(`pmset -g batt`);
      }
      return "Fetching battery info";

    case "maximize_window":
      if (os.platform() === "darwin") {
        exec(`
              osascript -e '
              tell application "System Events"
                tell (first application process whose frontmost is true)
                  click (first button of first window whose subrole is "AXZoomButton")
                end tell
              end tell'
            `);
      } else if (os.platform() === "win32") {
        robot.keyTap("up", ["command"]);
      } else {
        exec(`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`);
      }

      return "Window maximized";

    case "force_quit":
      if (os.platform() === "darwin") {
        exec(`osascript -e 'tell application "${action.target}" to quit'`);

        setTimeout(() => {
          exec(`pkill -9 "${action.target}"`);
        }, 2000);
      } else if (os.platform() === "win32") {
        exec(`taskkill /IM "${action.target}.exe" /F`);
      }

      return `Force quit ${action.target}`;

    case "new_window":
      if (os.platform() === "darwin") {
        robot.keyTap("n", ["command"]);
      } else if (os.platform() === "win32") {
        robot.keyTap("n", ["control"]);
      } else {
        robot.keyTap("n", ["control"]);
      }

      return "New window opened";

    case "zoom_in":
      if (os.platform() === "darwin") {
        robot.keyTap("=", ["command"]);
      } else {
        robot.keyTap("=", ["control"]);
      }

      return "Zoomed in";

    case "zoom_out":
      if (os.platform() === "darwin") {
        robot.keyTap("-", ["command"]);
      } else {
        robot.keyTap("-", ["control"]);
      }

      return "Zoomed out";

    case "get_volume": {
      const current = await getCurrentVolume();

      if (current === null) {
        return "Could not get current volume";
      }

      return `Current volume is ${current}%`;
    }

    case "get_brightness": {
      const current = await getCurrentBrightness();

      if (current === null) {
        return "Could not get current brightness";
      }

      return `Current brightness is ${current}%`;
    }

    case "wifi_off":
      exec(`networksetup -setairportpower en0 off`);
      return "WiFi turned off";

    case "wifi_on":
      exec(`networksetup -setairportpower en0 on`);
      return "WiFi turned on";

    case "bluetooth_off":
      exec(`blueutil --power 0`);
      return "Bluetooth off";

    case "bluetooth_on":
      exec(`blueutil --power 1`);
      return "Bluetooth on";

    case "record_screen":
      if (os.platform() === "darwin") {
        robot.keyTap("5", ["command", "shift"]);
      }

      return "Screen recorder opened";

    case "stop_recording":
      if (os.platform() === "darwin") {
        exec(`
                      osascript -e '
                      tell application "System Events"
                        keystroke "." using {command down, control down}
                      end tell'
                    `);
      }

      return "Stopped recording";
    
    case "next_tab":
      robot.keyTap("tab", ["control"]);
      return "Next tab";

    case "previous_tab":
      robot.keyTap("tab", ["control", "shift"]);
      return "Previous tab";

    // ── App switching ─────────────────────────────────────────────────────────
    case "next_app":
      if (os.platform() === "darwin") {
        robot.keyTap("tab", ["command"]);
      } else {
        robot.keyTap("tab", ["alt"]); // Win/Linux
      }
      return "Next app";

    case "previous_app":
      if (os.platform() === "darwin") {
        robot.keyTap("tab", ["command", "shift"]);
      } else {
        robot.keyTap("tab", ["alt", "shift"]);
      }
      return "Previous app";

    default:
      return `Unknown action: ${action.type}`;
  }
}

module.exports = { systemController, executeAction };

/* 
  TODO-FIXES
  - minimize_window      → minimize current window
  - maximize_window      → maximize current window
  - search_youtube → value: query
*/