import React from "react";
import { Award, Crown } from "lucide-react";

/**
 * Displays a referral achievement badge based on count:
 *  - 2-4 referrals → "Elçi" (Ambassador)
 *  - 5+ referrals  → "Küçük Ortak" (Junior Partner)
 *  - < 2           → nothing
 */
export function ReferralBadge({ count = 0, size = "sm" }) {
  if (!count || count < 2) return null;
  const isPartner = count >= 5;
  const Icon = isPartner ? Crown : Award;
  const label = isPartner ? "Küçük Ortak" : "Elçi";
  const cls = isPartner
    ? "bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-900 border-amber-400 shadow-sm"
    : "bg-purple-100 text-purple-800 border-purple-200";
  const sizeCls = size === "lg" ? "text-xs px-2.5 py-1 gap-1" : "text-[10px] px-1.5 py-0.5 gap-0.5";
  const iconSize = size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${cls} ${sizeCls}`}
      title={`${count} kişi referans getirdi`}
      data-testid={`referral-badge-${isPartner ? "partner" : "ambassador"}`}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  );
}

export default ReferralBadge;
