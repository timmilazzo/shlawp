import { useT } from "@agent-native/core/client/i18n";

import { cn } from "@/lib/utils";

const LINK_CLASS =
  "text-white/65 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Campaign tags so agent-native.com can attribute traffic the demo sends. */
const AGENT_NATIVE_URL =
  "https://agent-native.com/?utm_source=shlawp&utm_medium=referral&utm_campaign=shlawp-demo&utm_content=footer";

// YouTube drops unknown query parameters and reports nothing to the channel
// owner, so the tribute link stays clean.
const RYAN_GEORGE_URL = "https://www.youtube.com/@RyanGeorge";

export function ShlawpFooter({ className }: { className?: string }) {
  const t = useT();
  return (
    <p
      className={cn(
        "mx-auto max-w-[19rem] px-6 text-center text-[11px] leading-4 text-balance text-white/40",
        className,
      )}
    >
      <span className="block">
        {t("shlawp.tributeBefore")}
        <a
          href={RYAN_GEORGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {t("shlawp.tributeLink")}
        </a>
      </span>
      {t("shlawp.footerBefore")}
      <a
        href={AGENT_NATIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        {t("shlawp.footerLink")}
      </a>
      {t("shlawp.footerAfter")}
    </p>
  );
}
