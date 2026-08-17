import { PRE_START_VIEWS, type RunnerView } from "./types";

/**
 * What a dismissal gesture (Escape, or a press outside the surface) should do.
 *
 * - `close` — leave the runner entirely.
 * - `dismissPanel` — back out of the overlay panel to the running meeting.
 * - `refuse` — do nothing; the meeting is live and the gesture is almost
 *   certainly a slip.
 */
export type DismissOutcome = "close" | "dismissPanel" | "refuse";

/**
 * Decides what a dismissal gesture means for the view currently on screen.
 *
 * Escape closing the runner outright is the dangerous default here: the browser
 * does not fire `beforeunload` for it, so the guard that protects a reload does
 * not protect this. Mid-meeting the runner therefore refuses to be dismissed by
 * Escape at all — leaving is a deliberate act via Close in the top bar. From an
 * overlay panel Escape is unambiguous and useful, so it backs out to the
 * meeting; before the meeting starts and after it has adjourned there is nothing
 * live to lose, so it closes.
 *
 * @param view - The runner's current view
 * @returns The action the dismissal should take
 */
export function resolveDismiss(view: RunnerView): DismissOutcome {
  if (PRE_START_VIEWS.includes(view) || view === "export") return "close";
  if (view === "running") return "refuse";
  return "dismissPanel";
}
