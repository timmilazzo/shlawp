import { appPath } from "@agent-native/core/client/api-path";
import { useCallback, useEffect, useRef } from "react";

// A 44-byte silent WAV. Playing it inside the tap gesture unlocks audio on
// iOS so the reply can play later, after the network round-trip.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export type ShlawpVoice = {
  /** Call from the tap that starts a turn. */
  unlock: () => void;
  /** Resolves when speech ends, is stopped, or fails. */
  speak: (text: string) => Promise<void>;
  stop: () => void;
  /** Current loudness, 0..1, for the mouth. */
  getLevel: () => number;
};

export function useShlawpVoice(): ShlawpVoice {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const elevenUnavailableRef = useRef(false);

  const ensureAudioGraph = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }
    if (!ctxRef.current && typeof AudioContext !== "undefined") {
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx
          .createMediaElementSource(audioRef.current)
          .connect(analyser)
          .connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        // Without the graph the audio still plays; the mouth falls back to a
        // steady flap driven by `playing` below.
      }
    }
    return audioRef.current;
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    levelRef.current = 0;
  }, []);

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
    const started = performance.now();
    const tick = () => {
      if (analyser && buf) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      } else {
        const t = (performance.now() - started) / 1000;
        levelRef.current = Math.abs(Math.sin(t * 9));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    stopMeter();
    finishRef.current?.();
    finishRef.current = null;
  }, [stopMeter]);

  const unlock = useCallback(() => {
    const audio = ensureAudioGraph();
    void ctxRef.current?.resume().catch(() => {});
    if (audio && !audio.src) {
      audio.src = SILENT_WAV;
      void audio.play().catch(() => {});
    }
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
  }, [ensureAudioGraph]);

  const speakWithBrowser = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (typeof speechSynthesis === "undefined") return resolve();
        const utterance = new SpeechSynthesisUtterance(text);
        let pulse: number | null = null;
        const done = () => {
          if (pulse !== null) window.clearTimeout(pulse);
          levelRef.current = 0;
          resolve();
        };
        utterance.onboundary = () => {
          levelRef.current = 1;
          if (pulse !== null) window.clearTimeout(pulse);
          pulse = window.setTimeout(() => (levelRef.current = 0), 140);
        };
        utterance.onend = done;
        utterance.onerror = done;
        finishRef.current = done;
        speechSynthesis.speak(utterance);
      }),
    [],
  );

  const speak = useCallback(
    async (text: string) => {
      stop();
      if (!text.trim()) return;

      if (!elevenUnavailableRef.current) {
        try {
          const res = await fetch(appPath("/api/shlawp/speak"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (res.status === 409) elevenUnavailableRef.current = true;
          if (res.ok) {
            const url = URL.createObjectURL(await res.blob());
            const audio = ensureAudioGraph();
            if (audio) {
              await new Promise<void>((resolve) => {
                const done = () => {
                  audio.onended = null;
                  audio.onerror = null;
                  stopMeter();
                  URL.revokeObjectURL(url);
                  resolve();
                };
                finishRef.current = done;
                audio.onended = done;
                audio.onerror = done;
                audio.src = url;
                void ctxRef.current?.resume().catch(() => {});
                audio
                  .play()
                  .then(startMeter)
                  .catch(done);
              });
              return;
            }
          }
        } catch {
          // Network failure: fall through to the browser voice.
        }
      }

      await speakWithBrowser(text);
    },
    [ensureAudioGraph, speakWithBrowser, startMeter, stop, stopMeter],
  );

  useEffect(() => stop, [stop]);

  return {
    unlock,
    speak,
    stop,
    getLevel: useCallback(() => levelRef.current, []),
  };
}
