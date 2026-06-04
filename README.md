# 🤖 JARVIS

<div align="center">

### Just A Rather Very Intelligent System

**Local AI Assistant powered by Ollama, Express.js & React**

⚡ Streaming Responses • 🎙️ Voice Control • 🧠 Memory • 🌐 Built-in Browser • 🖐️ Gesture Control

</div>

---

## ✨ Features

| Feature             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| 💬 Chat             | Streaming responses via WebSocket                           |
| 🎙️ Voice Input     | Speak commands using Web Speech API                         |
| 🔊 Voice Output     | Jarvis reads responses aloud                                |
| 🌐 Browser Panel    | Opens URLs/articles inline within the app                   |
| 🧠 Memory           | Maintains conversation context per session                  |
| 🔄 Model Switching  | Switch between any installed Ollama models                  |
| ⚡ Streaming         | Real-time token-by-token streaming responses                |
| 🖐️ Gesture Control | Control your Mac hands-free with gestures & trackpad swipes |

---

## 🛠️ Prerequisites

### 1️⃣ Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from:
# https://ollama.com/download
```

### 2️⃣ Pull a Model

| Model       | Size   | Notes                  |
| ----------- | ------ | ---------------------- |
| qwen3.5:9b  | ~2GB   | ✅ Currently Used       |
| llama3.2:1b | ~1.3GB | Fast & Lightweight     |
| llama3.1    | ~4.7GB | More Powerful          |
| mistral     | ~4.1GB | Great for Conversation |
| codellama   | ~3.8GB | Code Focused           |
| phi3        | ~637MB | Very Small & Fast      |

```bash
ollama pull qwen3.5:9b
```

### 3️⃣ Start Ollama

```bash
ollama serve
```

Runs on:

```text
http://localhost:11434
```

### 4️⃣ Install Node.js

```bash
node --version
```

Requires:

```text
Node.js v18+
```

---

## 🚀 Installation & Running

```bash
# Install dependencies
npm run install:all

# Start frontend + backend
npm run dev
```

### Services

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:3001 |

---

## ⚙️ Configuration

Environment Variables

```bash
# Ollama Endpoint
OLLAMA_URL=http://localhost:11434

# Default Model
OLLAMA_MODEL=mistral

# Backend Port
PORT=3001
```

Example:

```bash
OLLAMA_MODEL=mistral npm run dev
```

---

## 🗣️ Voice Commands

### Usage

1. Click the microphone button
2. Speak naturally
3. Jarvis processes your command
4. Enable AUTO-SPEAK for spoken responses

### Browser Support

| Browser | Support    |
| ------- | ---------- |
| Chrome  | ✅ Full     |
| Edge    | ✅ Full     |
| Safari  | ⚠️ Partial |
| Firefox | ⚠️ Limited |

---

## 🌐 Opening URLs

Examples:

```text
Open github.com

Visit wikipedia.org and tell me about quantum computing

Search for latest news about AI

Show me the React documentation
```

Jarvis automatically opens content inside the built-in browser panel.

---

## 📡 API Endpoints

| Method | Endpoint         | Description                  |
| ------ | ---------------- | ---------------------------- |
| GET    | /api/status      | Ollama connection status     |
| GET    | /api/models      | List installed models        |
| POST   | /api/chat        | Send message (non-streaming) |
| WS     | /api/chat/stream | Streaming chat               |
| POST   | /api/clear       | Clear conversation memory    |

---

## 📡 News & Weather

✅ Shows latest news

✅ Provides weather information

---

## 🧠 Currently Tested on macOS

### System Controls

| Feature                  | Status |
| ------------------------ | ------ |
| Force Quit               | ✅      |
| WiFi On / Off            | ✅      |
| Bluetooth On / Off       | ✅      |
| Clipboard Copy / Paste   | ✅      |
| New / Close Tab          | ✅      |
| New / Close Window       | ✅      |
| Zoom In / Out            | ✅      |
| Open Folder              | ✅      |
| Get Battery              | ✅      |
| Get Volume               | ✅      |
| Microphone Mute / Unmute | ✅      |
| Lock Screen              | ✅      |
| Screenshot               | ✅      |
| Screen Recording         | ✅      |
| Stop Recording           | ✅      |

### Pending / Untested

| Feature         | Status        |
| --------------- | ------------- |
| Minimize Window | 🚧 TODO       |
| Maximize Window | 🚧 TODO       |
| Search YouTube  | 🚧 TODO       |
| Get Brightness  | 🚧 TODO       |
| Next Track      | 🧪 Not Tested |
| Previous Track  | 🧪 Not Tested |
| Play / Pause    | 🧪 Not Tested |

### File System

✅ Search and display parent-level files & folders

---

# 🖐️ Gesture Control

Control your Mac without touching the keyboard or mouse.

### Setup

Install dependencies:

```bash
cd gesture

pip3 install opencv-python mediapipe pyautogui pynput requests

# Optional
pip3 install pyobjc-framework-Quartz pyobjc-framework-CoreFoundation
```

Grant Accessibility Permissions:

```text
System Settings
→ Privacy & Security
→ Accessibility

Add:
• Terminal
• VS Code
• Cursor
```

### Gesture Reference

| Gesture        | Mode    | Action                       |
| -------------- | ------- | ---------------------------- |
| ☝️ Point       | Mouse   | Move Cursor                  |
| 🤏 Pinch       | Mouse   | Click / Double Click         |
| ✌️ Peace       | Mouse   | Scroll                       |
| 🖐️ Open Palm  | Both    | Exit Mouse Mode / Switch Tab |
| ✊ Fist Swipe (left/right)   | Command | Switch macOS Space           |
| 🖐️ Palm Swipe (left/right) | Command | Switch Browser Tab           |

### How It Works

**Command Mode**

* Default mode
* Triggers shortcuts

**Mouse Mode**

* Hold ☝️ Point for ~0.5 seconds

**Exit Mouse Mode**

* Show 🖐️ Open Palm

**Trackpad Gestures**

* Two-finger swipe switches spaces

> 💡 Everything runs locally. Webcam processing stays on-device and no video leaves your machine.
