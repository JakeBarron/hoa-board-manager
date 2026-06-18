import type { PositionName, PositionRole } from "@/types/database";

/**
 * Permission model:
 *   president — full access + admin (manage positions, reassign accounts)
 *   officer   — can read and edit any section (VP, secretary)
 *   member    — can read all sections, edit only their own
 */

/**
 * Returns true if the role can edit content in any board section,
 * not just their own. Applies to president and officers (VP, secretary).
 *
 * @param role - The current user's position role
 */
export const canEditAll = (role: PositionRole): boolean =>
  role === "president" || role === "officer";

/**
 * Returns true if the current user can edit content belonging to the target section.
 * Members may only edit their own section; officers and president can edit any.
 *
 * @param currentPosition - The logged-in user's position name
 * @param targetPosition  - The position whose section is being edited
 * @param role            - The logged-in user's role
 */
export const canEditSection = (
  currentPosition: PositionName,
  targetPosition: PositionName,
  role: PositionRole
): boolean => canEditAll(role) || currentPosition === targetPosition;

/**
 * Returns true if the role has access to admin-only features
 * such as reassigning position accounts.
 *
 * @param role - The current user's position role
 */
export const isAdmin = (role: PositionRole): boolean =>
  role === "president";

/**
 * Returns true if the user can edit CRA project data.
 * President and officers can edit any section; the CRA committee chair
 * (position name 'cra') can edit CRA data despite the chair role.
 *
 * @param role         - The current user's position role
 * @param positionName - The current user's position name
 */
export const canEditCRA = (
  role: PositionRole,
  positionName: PositionName
): boolean => canEditAll(role) || positionName === "cra";

/**
 * Returns true if the role can record architecture request vote outcomes.
 * Only the president records final votes.
 *
 * @param role - The current user's position role
 */
export const canRecordVote = (role: PositionRole): boolean =>
  role === "president";

/**
 * Returns true if the role is a non-voting committee chair.
 * Chairs can only edit their own section and cannot access most board routes.
 *
 * @param role - The current user's position role
 */
export const isChair = (role: PositionRole): boolean => role === "chair";

/**
 * Returns true if the user can create or modify treasury data.
 * President and officers (VP, secretary) have edit access by explicit policy decision.
 * The Treasurer position always has edit access regardless of role label.
 *
 * @param role         - The current user's position role
 * @param positionName - The current user's position name
 */
export const canEditTreasury = (
  role: PositionRole,
  positionName: PositionName
): boolean =>
  role === "president" || role === "officer" || positionName === "treasurer";
