import { useState, useEffect, useRef, useCallback } from "react";

const VOICES_PREFER = ["Google UK English Male", "Microsoft David", "Alex", "Daniel"];

export function useVoice({ onTranscript, onEnd }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);
  const transcriptRef = useRef("");
  const [language, setLanguage] = useState("en");
  const LANGUAGE_CONFIG = {
  "en": {
    stt: "en-US",
    tts: ["Google UK English Male", "Microsoft David", "Alex"],
  },
  "ur": {
    stt: "ur-PK",
    tts: ["Urdu", "Pakistan", "Hindi"],
  },
  "hi": {
    stt: "hi-IN",
    tts: ["Hindi", "India"],
  },
  "ar": {
    stt: "ar-SA",
    tts: ["Arabic"],
  },
};

  // ─── Streaming TTS queue ───
  const ttsQueueRef = useRef([]);
  const ttsSpeakingRef = useRef(false);

  useEffect(() => {
    const sttOk = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const ttsOk = "speechSynthesis" in window;
    setSupported({ stt: sttOk, tts: ttsOk });
  }, []);

  // const pickVoice = useCallback(() => {
  //   const voices = synthRef.current.getVoices();
  //   for (const pref of VOICES_PREFER) {
  //     const v = voices.find((v) => v.name.includes(pref));
  //     if (v) return v;
  //   }
  //   return voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;
  // }, []);
  const pickVoice = useCallback(() => {
  const voices = synthRef.current.getVoices();

  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;

  // Try preferred voices first
  for (const pref of config.tts) {
    const found = voices.find(
      (v) =>
        v.name.toLowerCase().includes(pref.toLowerCase()) ||
        v.lang.toLowerCase().includes(pref.toLowerCase())
    );

    if (found) return found;
  }

  // fallback
  return (
    voices.find((v) => v.lang.startsWith(language)) ||
    voices[0] ||
    null
  );
}, [language]);

  // ─── Speak next item in queue ───
  const speakNext = useCallback(() => {
    const next = ttsQueueRef.current.shift();
    if (!next) {
      ttsSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const utter = new SpeechSynthesisUtterance(next);
    utter.voice = pickVoice();
    utter.rate = 1.05;
    utter.pitch = 0.85;
    utter.volume = 1;

    utter.onstart = () => {
      setIsSpeaking(true);
      ttsSpeakingRef.current = true;
    };
    utter.onend = () => speakNext();
    utter.onerror = () => speakNext();

    utteranceRef.current = utter;
    synthRef.current.speak(utter);
  }, [pickVoice]);

  // ─── Queue text for streaming TTS ───
  const speakQueue = useCallback((text) => {
    if (!synthRef.current || !text?.trim()) return;
    
    const clean = text
      .replace(/\[ACTION:[^\]]+\]/g, "")
      .replace(/[#*`_~]/g, "")
      .trim();
    if (clean.length > 2) {
      const lang = detectLanguage(clean);
      setLanguage(lang);
      ttsQueueRef.current.push(clean);
      if (!ttsSpeakingRef.current) {
        speakNext();
      }
    }
  }, [speakNext]);

  // ─── Legacy: speak full text at once (cancels everything) ───
  const speak = useCallback(
    (text, onDone) => {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      ttsQueueRef.current = [];
      ttsSpeakingRef.current = false;

      const clean = text
        .replace(/\[ACTION:[^\]]+\]/g, "")
        .replace(/[#*`_~]/g, "")
        .replace(/\n+/g, " ")
        .trim();

      const utter = new SpeechSynthesisUtterance(clean);
      utter.voice = pickVoice();
      utter.rate = 1.05;
      utter.pitch = 0.85;
      utter.volume = 1;

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => { setIsSpeaking(false); onDone?.(); };
      utter.onerror = () => { setIsSpeaking(false); onDone?.(); };

      utteranceRef.current = utter;
      synthRef.current.speak(utter);
    },
    [pickVoice]
  );

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const detectLanguage = (text) => {
    if (/[\u0600-\u06FF]/.test(text)) {
      return "ur"; // Urdu/Arabic script
    }

    if (/[\u0900-\u097F]/.test(text)) {
      return "hi"; // Hindi
    }

    return "en";
  };

  const startListening = useCallback(() => {
    if (!supported.stt || isListening) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    // rec.lang = "en-US";
    rec.lang = LANGUAGE_CONFIG[language]?.stt || "en-US";

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      transcriptRef.current = final || interim;
    };
    rec.onend = () => {
      setIsListening(false);
      if (transcriptRef.current?.trim()) {
        onTranscript?.(transcriptRef.current.trim());
      }
      transcriptRef.current = "";
      setTranscript("");
      onEnd?.();
    };
    rec.onerror = () => {
      setIsListening(false);
      transcriptRef.current = "";
      setTranscript("");
    };

    recognitionRef.current = rec;
    rec.start();
  }, [supported.stt, isListening, onTranscript, onEnd]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    supported,
    speak,       // legacy: speak immediately, cancel everything
    speakQueue,  // NEW: queue for streaming (doesn't cancel)
    stopSpeaking,
    startListening,
    stopListening,
  };
}