import { useState, useRef, useCallback, useEffect } from "react";

const LANGUAGE_CONFIG = {
  "en": { stt: "en-US", tts: ["Google UK English Male", "Microsoft David", "Alex"] },
  "ur": { stt: "ur-PK", tts: ["Urdu", "Pakistan", "Hindi"] },
  "hi": { stt: "hi-IN", tts: ["Hindi", "India"] },
  "ar": { stt: "ar-SA", tts: ["Arabic"] },
};

export function useVoice({ onTranscript, onEnd }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [handsFreeActive, setHandsFreeActive] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);
  const transcriptRef = useRef("");
  const [language, setLanguage] = useState("en");

  // Shadow refs — always current inside async callbacks
  const handsFreeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const isThinkingRef = useRef(false); // tracks if Jarvis is generating a reply
  const restartTimerRef = useRef(null);
  const cycleActiveRef = useRef(false); // prevents double-start

  // TTS queue
  const ttsQueueRef = useRef([]);
  const ttsSpeakingRef = useRef(false);

  useEffect(() => {
    const sttOk = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const ttsOk = "speechSynthesis" in window;
    setSupported({ stt: sttOk, tts: ttsOk });
  }, []);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { handsFreeRef.current = handsFreeActive; }, [handsFreeActive]);

  const detectLanguage = (text) => {
    if (/[\u0600-\u06FF]/.test(text)) return "ur";
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    return "en";
  };

  const pickVoice = useCallback(() => {
    const voices = synthRef.current.getVoices();
    const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
    for (const pref of config.tts) {
      const found = voices.find(
        (v) => v.name.toLowerCase().includes(pref.toLowerCase()) ||
               v.lang.toLowerCase().includes(pref.toLowerCase())
      );
      if (found) return found;
    }
    return voices.find((v) => v.lang.startsWith(language)) || voices[0] || null;
  }, [language]);

  // ─── TTS queue ────────────────────────────────────────────────────────────
  const speakNext = useCallback(() => {
    const next = ttsQueueRef.current.shift();
    if (!next) {
      ttsSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(next);
    utter.voice = pickVoice();
    utter.rate = 1.05; utter.pitch = 0.85; utter.volume = 1;
    utter.onstart = () => { setIsSpeaking(true); ttsSpeakingRef.current = true; };
    utter.onend = () => speakNext();
    utter.onerror = () => speakNext();
    utteranceRef.current = utter;
    synthRef.current.speak(utter);
  }, [pickVoice]);

  const speakQueue = useCallback((text) => {
    if (!synthRef.current || !text?.trim()) return;
    const clean = text.replace(/\[ACTION:[^\]]+\]/g, "").replace(/[#*`_~]/g, "").trim();
    if (clean.length > 2) {
      setLanguage(detectLanguage(clean));
      ttsQueueRef.current.push(clean);
      if (!ttsSpeakingRef.current) speakNext();
    }
  }, [speakNext]);

  const speak = useCallback((text, onDone) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    ttsQueueRef.current = []; ttsSpeakingRef.current = false;
    const clean = text.replace(/\[ACTION:[^\]]+\]/g, "").replace(/[#*`_~]/g, "").replace(/\n+/g, " ").trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.voice = pickVoice();
    utter.rate = 1.05; utter.pitch = 0.85; utter.volume = 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { setIsSpeaking(false); onDone?.(); };
    utter.onerror = () => { setIsSpeaking(false); onDone?.(); };
    utteranceRef.current = utter;
    synthRef.current.speak(utter);
  }, [pickVoice]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    ttsQueueRef.current = []; ttsSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // ─── The core: schedule next mic cycle ───────────────────────────────────
  // This is the ONLY place we decide when to restart. Simple and reliable.
  const scheduleNextCycle = useCallback((delayMs = 800) => {
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!handsFreeRef.current) return;
      if (isListeningRef.current) return;
      if (cycleActiveRef.current) return;
      startOneCycleRef.current?.();
    }, delayMs);
  }, []);

  // ─── One mic session ─────────────────────────────────────────────────────
  const startOneCycle = useCallback(() => {
    if (!supported.stt) return;
    if (!handsFreeRef.current) return;
    if (isListeningRef.current) return;
    if (cycleActiveRef.current) return;

    // If Jarvis is speaking, wait for it to finish instead of starting now
    if (isSpeakingRef.current) {
      scheduleNextCycle(300);
      return;
    }

    cycleActiveRef.current = true;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec;
    try {
      rec = new SR();
    } catch (err) {
      console.warn("SR create failed:", err);
      cycleActiveRef.current = false;
      scheduleNextCycle(1000);
      return;
    }

    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = LANGUAGE_CONFIG[language]?.stt || "en-US";

    rec.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
    };

    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      transcriptRef.current = final || interim;
    };

    rec.onend = () => {
      cycleActiveRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      setTranscript("");

      const said = transcriptRef.current?.trim();
      transcriptRef.current = "";

      if (!handsFreeRef.current) return; // turned off while listening

      if (said) {
        // Send the command
        onTranscript?.(said);
        onEnd?.();
        // Wait longer — Jarvis needs time to think + optionally speak
        // We poll isSpeaking every 300ms; once it's done we restart
        const waitAndRestart = () => {
          if (!handsFreeRef.current) return;
          if (isSpeakingRef.current) {
            restartTimerRef.current = setTimeout(waitAndRestart, 300);
          } else {
            // Extra 600ms buffer after speaking stops (or after reply if no auto-speak)
            scheduleNextCycle(600);
          }
        };
        // Give Jarvis 1.5s to start generating/speaking before we check
        restartTimerRef.current = setTimeout(waitAndRestart, 1500);
      } else {
        // Nothing said — restart quickly
        scheduleNextCycle(350);
      }
    };

    rec.onerror = (e) => {
      cycleActiveRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      setTranscript("");
      transcriptRef.current = "";

      if (!handsFreeRef.current) return;

      // 'no-speech' is the most common — restart normally
      // 'not-allowed' means mic permission denied — stop hands-free
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        handsFreeRef.current = false;
        setHandsFreeActive(false);
        console.error("Mic permission denied — hands-free disabled");
        return;
      }

      scheduleNextCycle(500);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.warn("rec.start() threw:", err);
      cycleActiveRef.current = false;
      scheduleNextCycle(800);
    }
  }, [supported.stt, language, onTranscript, onEnd, scheduleNextCycle]);

  // Keep ref in sync so callbacks can call it without stale closure
  const startOneCycleRef = useRef(null);
  useEffect(() => { startOneCycleRef.current = startOneCycle; }, [startOneCycle]);

  // ─── Hands-free toggle ────────────────────────────────────────────────────
  const toggleHandsFree = useCallback(() => {
    if (handsFreeRef.current) {
      // Turn OFF
      handsFreeRef.current = false;
      setHandsFreeActive(false);
      clearTimeout(restartTimerRef.current);
      cycleActiveRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      // Turn ON
      setHandsFreeActive(true);
      handsFreeRef.current = true;
      cycleActiveRef.current = false;
      // Small delay to let state settle
      restartTimerRef.current = setTimeout(() => startOneCycleRef.current?.(), 200);
    }
  }, []);

  // ─── Manual mic (one-shot, works alongside hands-free) ───────────────────
  const startListening = useCallback(() => {
    if (!supported.stt || isListeningRef.current) return;
    clearTimeout(restartTimerRef.current);
    cycleActiveRef.current = true; // block hands-free from double-starting

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = LANGUAGE_CONFIG[language]?.stt || "en-US";

    rec.onstart = () => { setIsListening(true); isListeningRef.current = true; };
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      transcriptRef.current = final || interim;
    };
    rec.onend = () => {
      cycleActiveRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      if (transcriptRef.current?.trim()) onTranscript?.(transcriptRef.current.trim());
      transcriptRef.current = "";
      setTranscript("");
      onEnd?.();
      if (handsFreeRef.current) scheduleNextCycle(600);
    };
    rec.onerror = () => {
      cycleActiveRef.current = false;
      setIsListening(false);
      isListeningRef.current = false;
      transcriptRef.current = "";
      setTranscript("");
      if (handsFreeRef.current) scheduleNextCycle(500);
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch (err) { console.warn(err); cycleActiveRef.current = false; }
  }, [supported.stt, language, onTranscript, onEnd, scheduleNextCycle]);

  const stopListening = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    try { recognitionRef.current?.stop(); } catch (_) {}
    cycleActiveRef.current = false;
    setIsListening(false);
    isListeningRef.current = false;
    if (handsFreeRef.current) scheduleNextCycle(400);
  }, [scheduleNextCycle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.stop(); } catch (_) {}
      synthRef.current?.cancel();
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    supported,
    handsFreeActive,
    speak,
    speakQueue,
    stopSpeaking,
    startListening,
    stopListening,
    toggleHandsFree,
  };
}