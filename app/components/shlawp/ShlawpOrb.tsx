import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { headFrameSrc, preloadHeadFrames, type HeadFrame } from "./head-frames";

export type ShlawpMood = "idle" | "listening" | "thinking" | "speaking";

type ShlawpOrbProps = {
  mood: ShlawpMood;
  size: "hero" | "compact";
  label: string;
  /** Loudness of the current reply, 0..1. Drives the mouth while speaking. */
  getLevel?: () => number;
  className?: string;
};

const LASER_MS = 1100;

function useHeadFrame(
  mood: ShlawpMood,
  getLevel: (() => number) | undefined,
  lasers: boolean,
): HeadFrame {
  const [frame, setFrame] = useState<HeadFrame>("base");

  useEffect(() => {
    if (lasers) {
      setFrame("lasers");
      return;
    }

    if (mood === "listening") {
      setFrame("query");
      return;
    }

    if (mood === "thinking") {
      let alt = false;
      setFrame("thinking");
      const id = window.setInterval(() => {
        alt = !alt;
        setFrame(alt ? "puzzled" : "thinking");
      }, 900);
      return () => window.clearInterval(id);
    }

    if (mood === "speaking") {
      let open = false;
      let raf = 0;
      setFrame("speakClosing");
      const tick = () => {
        const level = getLevel?.() ?? 0;
        // Hysteresis keeps the mouth from chattering around one threshold.
        const next = open ? level > 0.08 : level > 0.16;
        if (next !== open) {
          open = next;
          setFrame(open ? "speakOpen" : "speakClosing");
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // Idle: mostly straight ahead, with the occasional glance.
    setFrame("base");
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setFrame(Math.random() < 0.5 ? "lookLeft" : "lookRight");
          timer = window.setTimeout(() => {
            setFrame("base");
            schedule();
          }, 750);
        },
        3200 + Math.random() * 3800,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [mood, getLevel, lasers]);

  return frame;
}

export function ShlawpOrb({
  mood,
  size,
  label,
  getLevel,
  className,
}: ShlawpOrbProps) {
  const [lasers, setLasers] = useState(false);
  const laserTimer = useRef<number | null>(null);
  const frame = useHeadFrame(mood, getLevel, lasers);

  useEffect(() => {
    preloadHeadFrames();
    return () => {
      if (laserTimer.current !== null) window.clearTimeout(laserTimer.current);
    };
  }, []);

  function fireLasers() {
    setLasers(true);
    if (laserTimer.current !== null) window.clearTimeout(laserTimer.current);
    laserTimer.current = window.setTimeout(() => setLasers(false), LASER_MS);
  }

  return (
    <button
      type="button"
      onClick={fireLasers}
      aria-label={label}
      data-mood={mood}
      data-size={size}
      className={cn("shlawp-orb", className)}
    >
      <span className="shlawp-orb-glow" aria-hidden />
      <span className="shlawp-orb-core" aria-hidden>
        <img
          src={headFrameSrc(frame)}
          alt=""
          draggable={false}
          className="shlawp-orb-head"
        />
        <span className="shlawp-orb-scan" />
      </span>
      <span className="shlawp-orb-plasma shlawp-orb-plasma-a" aria-hidden />
      <span className="shlawp-orb-plasma shlawp-orb-plasma-b" aria-hidden />
      <span className="shlawp-orb-rim" aria-hidden />
    </button>
  );
}
