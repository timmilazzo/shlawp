import { useT } from "@agent-native/core/client/i18n";

import { cn } from "@/lib/utils";

const LINK_CLASS =
  "text-white/65 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
          href="https://www.youtube.com/@RyanGeorge"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {t("shlawp.tributeLink")}
        </a>
      </span>
      {t("shlawp.footerBefore")}
      <a
        href="https://agent-native.com"
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
