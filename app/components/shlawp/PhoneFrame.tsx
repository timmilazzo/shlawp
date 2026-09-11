import type { ReactNode } from "react";

/**
 * On desktop the experience sits inside a generic black handset. On a phone the
 * handset would be a phone inside a phone, so the screen goes full bleed.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="shlawp-stage">
      <div className="shlawp-phone">
        <span className="shlawp-phone-island" aria-hidden />
        <div className="shlawp-phone-screen">{children}</div>
      </div>
    </div>
  );
}
