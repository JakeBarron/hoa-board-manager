import type { PositionName } from "@/types/database";

/**
 * Human-readable title for every position.
 * Single source of truth — import this instead of defining local copies.
 */
export const POSITION_LABELS: Record<PositionName, string> = {
  president:    "President",
  vp:           "Vice President",
  secretary:    "Secretary",
  treasurer:    "Treasurer",
  pool:         "Pool",
  membership:   "Membership",
  tennis:       "Tennis",
  social:       "Social",
  grounds:      "Grounds",
  web:          "Web Committee",
  architecture: "Architecture Review",
  welcoming:    "Welcoming Committee",
  clubhouse:    "Clubhouse Committee",
  cra:          "CRA Committee",
};

/**
 * Returns the full display string for a position.
 * When display_name is set, returns "Role Person Name" (e.g. "President Jake Barron").
 * Falls back to the role title (e.g. "President") when display_name is null.
 *
 * @param positionName - The position's DB name key
 * @param displayName  - The person's name stored on the position row, or null
 */
export function formatPersonName(
  positionName: PositionName,
  displayName: string | null
): string {
  const title = POSITION_LABELS[positionName];
  return displayName ? `${title} — ${displayName}` : title;
}
