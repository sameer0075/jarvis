# 🤖 JARVIS — Local AI Assistant

> Just A Rather Very Intelligent System  
> Built with Ollama (free, local AI) + Express.js + React

---

## ✨ Features

- 💬 **Chat** — Streaming responses via WebSocket
- 🎙️ **Voice Input** — Speak commands using Web Speech API
- 🔊 **Voice Output** — Jarvis reads responses aloud
- 🌐 **Browser Panel** — Opens URLs/articles inline within the app
- 🧠 **Memory** — Maintains conversation context per session
- 🔄 **Model Switching** — Switch between any installed Ollama models
- ⚡ **Streaming** — Real-time token-by-token streaming responses

---

## 🛠️ Prerequisites

### 1. Install Ollama (free, runs locally)

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows — Download from:
# https://ollama.com/download
```

### 2. Pull a Model (choose one)

```bash
# Recommended — Fast & smart (2GB)
ollama pull qwen3.5:9b => Currently Used

# Smaller, faster (1.3GB)
ollama pull llama3.2:1b

# More powerful (4.7GB)
ollama pull llama3.1

# Mistral — Great for conversation (4.1GB)
ollama pull mistral

# Code-focused (3.8GB)
ollama pull codellama

# Very small, very fast (637MB)
ollama pull phi3
```

### 3. Start Ollama

```bash
ollama serve
# Runs at http://localhost:11434
```

### 4. Node.js 18+

```bash
node --version  # Should be v18 or higher
```

---

## 🚀 Installation & Running

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both server + client
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

---

## ⚙️ Configuration

Set environment variables to customize:

```bash
# Change Ollama URL (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Change default model (default: llama3.2)
OLLAMA_MODEL=mistral

# Change server port (default: 3001)
PORT=3001
```

Example:
```bash
OLLAMA_MODEL=mistral npm run dev
```

---

## 🗣️ Voice Commands

- Click the **microphone button** or press it to start listening
- Speak naturally — Jarvis will process your voice command
- Enable **AUTO-SPEAK** to have Jarvis read responses aloud
- Click the speaker button to stop Jarvis from talking

### Voice works best in:
- Chrome / Edge (full support)
- Safari (partial support)
- Firefox (limited support)

---

## 🌐 Opening URLs

Ask Jarvis to open URLs naturally:

- *"Open github.com"*
- *"Visit wikipedia.org and tell me about quantum computing"*
- *"Search for latest news about AI"*
- *"Show me the React documentation"*

Jarvis will open a split browser panel inside the app!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Ollama connection status |
| GET | `/api/models` | List installed models |
| POST | `/api/chat` | Send message (non-streaming) |
| WS | `/api/chat/stream` | Send message (streaming WebSocket) |
| POST | `/api/clear` | Clear conversation memory |

---

## 🔧 Troubleshooting

**Ollama offline?**
```bash
# Make sure Ollama is running
ollama serve

# Check it's accessible
curl http://localhost:11434/api/tags
```

**No models listed?**
```bash
ollama pull llama3.2
```

**Voice not working?**
- Use Chrome or Edge
- Allow microphone permissions
- Voice recognition requires internet for the Web Speech API

**Site won't load in browser panel?**
- Some sites block iframe embedding (X-Frame-Options)
- Use the "Open in new tab" button in the browser panel toolbar

---

## 🧠 How Actions Work

Jarvis parses special action tags from the AI response:

- `[ACTION:OPEN_URL:https://example.com]` → Opens URL in browser panel
- `[ACTION:SEARCH:query]` → Google search in browser panel

The system prompt instructs the model to emit these when relevant.

## 📡 Shows Latest News and Weather Details

## 🧠 Currently Tested on Mac Only
- System Control
    - minimize_window      → TODO
    - maximize_window      → TODO
    - force_quit           

    - next_track           → NOT TESTED
    - previous_track       → NOT TESTED
    - play_pause           → NOT TESTED

    - wifi_on              
    - wifi_off             
    - bluetooth_on         
    - bluetooth_off        

    - clipboard_copy       
    - clipboard_paste      

    - new_tab              
    - close_tab            
    - new_window           
    - close_window         

    - zoom_in              
    - zoom_out             

    - search_google        
    - search_youtube       TODO

    - open_folder          

    - get_battery          
    - get_volume           
    - get_brightness       TODO

    - microphone_mute      
    - microphone_unmute    

    - lock_screen

    - take_screenshot
    - record_screen
    - stop_recording
- FileSystem
    - Search and Display Parent Level Files & Folders.