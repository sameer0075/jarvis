import { useEffect, useRef, useCallback, useState } from "react";

const CONFIG = {
  // ── Sensitivity ──
  RISE_THRESHOLD:   0.08,   // ← Lower: catches soft/distant claps (was 0.15)
  PEAK_THRESHOLD:   0.18,   // ← Lower peak needed (was 0.25)
  FALL_THRESHOLD:   0.06,   // ← Lower fall threshold (was 0.08)
  
  // ── Timing ──
  MIN_DURATION_MS:  5,      // ← Faster transients allowed (was 8)
  MAX_DURATION_MS:  300,    // ← Wider window (was 250)
  DOUBLE_GAP_MIN:   60,     // ← Faster double claps (was 80)
  DOUBLE_GAP_MAX:   1000,   // ← Slower double claps allowed (was 800)
  COOLDOWN_MS:      2000,   // ← Shorter cooldown (was 2500)
  
  // ── Noise filtering ──
  NOISE_FLOOR:      0.03,   // Ignore below this (ambient noise)
  CONSISTENCY_CHECK: true,   // Require 2 consecutive peaks for validation
};

export function useClap({ onDoubleClap }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // Enhanced state machine with validation counter
  const stateRef = useRef({
    phase: "idle",
    startT: 0,
    peakT: 0,
    peakVal: 0,
    lastClapT: 0,
    cooldown: false,
    // NEW: consistency tracking
    consecutivePeaks: 0,
    lastRms: 0,
  });

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    setListening(false);
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (audioCtxRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,      // ← Enable: kills background noise
          noiseSuppression: true,      // ← Enable: suppresses ambient
          autoGainControl: true,       // ← Enable: normalizes volume
        },
        video: false,
      });

      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;        // ← Higher resolution (was 512)
      analyser.smoothingTimeConstant = 0.1;  // ← Slight smoothing (was 0.0)

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      runningRef.current = true;
      setListening(true);
      setError(null);

      const buffer = new Float32Array(analyser.fftSize);
      const freqBuffer = new Uint8Array(analyser.frequencyBinCount);

      const detect = () => {
        if (!runningRef.current) return;

        rafRef.current = requestAnimationFrame(detect);
        analyser.getFloatTimeDomainData(buffer);
        analyser.getByteFrequencyData(freqBuffer);

        // ── RMS Calculation ──
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();
        const s = stateRef.current;

        // Noise gate: ignore ambient
        if (rms < CONFIG.NOISE_FLOOR) return;
        if (s.cooldown) return;

        // ── Spectral Analysis: Check for high-frequency content (claps are 2kHz-8kHz) ──
        let highFreqEnergy = 0;
        let totalEnergy = 0;
        for (let i = 0; i < freqBuffer.length; i++) {
          const freq = (i * ctx.sampleRate) / (2 * freqBuffer.length);
          const energy = freqBuffer[i] * freqBuffer[i];
          totalEnergy += energy;
          if (freq > 2000 && freq < 8000) {  // Clap frequency range
            highFreqEnergy += energy;
          }
        }
        const spectralRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
        const isClapLike = spectralRatio > 0.3;  // 30%+ energy in clap range

        // ── State Machine with Validation ──
        switch (s.phase) {
          case "idle": {
            if (rms > CONFIG.RISE_THRESHOLD && isClapLike) {
              s.phase = "rising";
              s.startT = now;
              s.peakVal = rms;
              s.consecutivePeaks = 1;
            }
            break;
          }
          
          case "rising": {
            s.peakVal = Math.max(s.peakVal, rms);
            
            // Count consecutive peaks for validation
            if (rms > s.lastRms * 0.5) {
              s.consecutivePeaks++;
            }
            
            if (rms > CONFIG.PEAK_THRESHOLD && s.consecutivePeaks >= 2) {
              s.phase = "peaked";
              s.peakT = now;
            } else if (now - s.startT > CONFIG.MAX_DURATION_MS) {
              s.phase = "idle";
              s.consecutivePeaks = 0;
            }
            break;
          }
          
          case "peaked": {
            if (rms < CONFIG.FALL_THRESHOLD) {
              const dur = now - s.startT;
              
              // Validate: proper duration + spectral signature
              if (dur >= CONFIG.MIN_DURATION_MS && 
                  dur <= CONFIG.MAX_DURATION_MS && 
                  isClapLike) {
                    
                s.phase = "resolved";
                
                // ── Double Clap Detection ──
                if (s.lastClapT === 0) {
                  s.lastClapT = now;
                  console.log("[CLAP] First clap detected, waiting for second...");
                } else {
                  const gap = now - s.lastClapT;
                  console.log(`[CLAP] Second clap! Gap: ${gap}ms`);
                  
                  if (gap >= CONFIG.DOUBLE_GAP_MIN && gap <= CONFIG.DOUBLE_GAP_MAX) {
                    // SUCCESS: Double clap!
                    s.lastClapT = 0;
                    s.cooldown = true;
                    console.log("[CLAP] ✓ DOUBLE CLAP CONFIRMED");
                    onDoubleClap?.();
                    
                    setTimeout(() => { s.cooldown = false; }, CONFIG.COOLDOWN_MS);
                  } else if (gap > CONFIG.DOUBLE_GAP_MAX) {
                    // Too slow, reset
                    s.lastClapT = now;
                    console.log("[CLAP] Too slow, resetting...");
                  }
                  // else: too fast, ignore
                }
                
                setTimeout(() => { 
                  if (s.phase === "resolved") s.phase = "idle"; 
                }, 50);
                
              } else {
                s.phase = "idle";
                s.consecutivePeaks = 0;
              }
            } else if (now - s.peakT > CONFIG.MAX_DURATION_MS) {
              s.phase = "idle";
              s.consecutivePeaks = 0;
            }
            break;
          }
          
          case "resolved": break;
        }

        s.lastRms = rms;
      };

      detect();
    } catch (e) {
      console.error("[CLAP] Mic failed:", e.message);
      setError(e.message);
      setListening(false);
    }
  }, [onDoubleClap]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop, listening, error };
}