#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║     JARVIS AI — Setup Script          ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo ""
    echo "⚠️  Ollama not found."
    echo "   Install from: https://ollama.com/download"
    echo "   Then run: ollama pull llama3.2"
    echo ""
else
    echo "✅ Ollama found: $(ollama --version 2>/dev/null || echo 'installed')"
fi

echo ""
echo "📦 Installing dependencies..."
npm install
cd client && npm install && cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Make sure Ollama is running: ollama serve"
echo "  2. Pull a model if needed:     ollama pull llama3.2"
echo "  3. Start Jarvis:               npm run dev"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo ""
