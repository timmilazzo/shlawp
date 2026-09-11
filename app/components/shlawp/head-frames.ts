import { appPath } from "@agent-native/core/client/api-path";

export type HeadFrame =
  | "base"
  | "lookLeft"
  | "lookRight"
  | "speakOpen"
  | "speakClosing"
  | "query"
  | "puzzled"
  | "thinking"
  | "lasers";

const FRAME_FILES: Record<HeadFrame, string> = {
  base: "01-base",
  lookLeft: "02-look-left",
  lookRight: "03-look-right",
  speakOpen: "04-speak-open",
  speakClosing: "05-speak-closing",
  query: "06-query",
  puzzled: "07-puzzled",
  thinking: "08-thinking",
  lasers: "09-lasers",
};

export function headFrameSrc(frame: HeadFrame): string {
  return appPath(`/shlawp/head/${FRAME_FILES[frame]}.webp`);
}

let preloaded = false;

/** Warm the image cache so frame swaps never flash an empty orb. */
export function preloadHeadFrames() {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;
  for (const frame of Object.keys(FRAME_FILES) as HeadFrame[]) {
    const img = new Image();
    img.decoding = "async";
    img.src = headFrameSrc(frame);
  }
}
