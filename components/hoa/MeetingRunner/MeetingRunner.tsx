"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { RichTextEditor } from "@/components/hoa/RichTextEditor";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  adjournMeeting,
  callToOrder,
  cancelMeeting,
  loadMeetingRunnerState,
  saveMeetingMinutes,
  seedMeetingScaffold,
  updateAttendance,
} from "@/actions/meetings";
import type { NewBusinessItem } from "@/lib/agenda";
import { hasMinutesContent } from "@/lib/minutes";
import { ActionItemPanel } from "./ActionItemPanel";
import { AdjournPanel } from "./AdjournPanel";
import { AttendancePanel } from "./AttendancePanel";
import { CallToOrderPanel } from "./CallToOrderPanel";
import { DeleteMeetingConfirm } from "./DeleteMeetingConfirm";
import { ExportPanel } from "./ExportPanel";
import { NewBusinessPanel } from "./NewBusinessPanel";
import { TopBar } from "./TopBar";
import { VotePanel } from "./VotePanel";
import { resolveDismiss } from "./dismiss";
import { useAutosave } from "./useAutosave";
import { useElapsedTimer } from "./useElapsedTimer";
import { PRE_START_VIEWS, type Position, type RunnerView } from "./types";

export interface MeetingRunnerProps {
  /** All non-chair board positions; voting members are filtered internally. */
  positions: Position[];
  /** The meeting being run, if it is already underway. */
  existingMeeting: { id: string; status: "pending" | "in_progress" } | null;
  /** Called when the runner should close. */
  onClose: () => void;
  /** UUID of the meeting being run — known before this renders. */
  meetingId: string;
  /** ISO date (YYYY-MM-DD) of the meeting being run. */
  meetingDate: string;
  /** Voting members needed for quorum, from `settings.quorum_required`. */
  quorumRequired: number;
}

/**
 * Full-screen runner for a live board meeting.
 *
 * Moves through a pre-start wizard (new business → attendance → call to order)
 * and then into the running meeting. From that point the minutes editor stays
 * mounted for the rest of the session and the vote, action-item, adjourn, and
 * export panels draw on top of it. That matters for more than layout: unmounting
 * the editor destroyed the Tiptap instance, so recorded votes had to be
 * concatenated onto the end of the HTML string and the editor remounted — which
 * put a motion made during the Treasurer's report after "Adjournment" and wiped
 * undo history, selection, and scroll every time. Keeping it mounted lets text
 * be inserted at the cursor instead.
 *
 * The minutes autosave on a debounce, and on resume the runner will not let the
 * meeting be adjourned until the saved state has loaded — adjourning against an
 * unloaded editor used to overwrite the minutes with an empty string.
 *
 * The surface is a Base UI `Dialog`, which supplies the focus trap, the inert
 * treatment of everything behind it, the body scroll lock, and focus restore on
 * close — none of which the hand-rolled fixed-position container had. Its one
 * dangerous default, closing on Escape, is intercepted: see `resolveDismiss`.
 *
 * @param props - Positions, the meeting identity, quorum threshold, and onClose
 */
export function MeetingRunner({
  positions,
  existingMeeting,
  onClose,
  meetingId,
  meetingDate,
  quorumRequired,
}: MeetingRunnerProps) {
  const votingPositions = positions.filter((p) => p.is_voting_member);
  const isResuming = existingMeeting?.status === "in_progress";

  const [view, setView] = useState<RunnerView>(isResuming ? "running" : "newBusiness");
  // Nobody is present until roll call says so.
  const [presentIds, setPresentIds] = useState<Set<string>>(() => new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [minutesContent, setMinutesContent] = useState("");
  const [hasLoadedState, setHasLoadedState] = useState(!isResuming);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDismissHint, setShowDismissHint] = useState(false);
  const [isPending, startTransition] = useTransition();

  const editorRef = useRef<Editor | null>(null);
  const elapsed = useElapsedTimer(startedAt);

  const newBusinessKey = `meeting-new-business-${meetingId}`;
  const [newBusiness, setNewBusiness] = useState<NewBusinessItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.sessionStorage.getItem(newBusinessKey);
      return stored ? (JSON.parse(stored) as NewBusinessItem[]) : [];
    } catch {
      return [];
    }
  });

  /** Switches panel and clears any leftover "Escape won't do that" hint. */
  const goToView = (next: RunnerView) => {
    setShowDismissHint(false);
    setView(next);
  };

  const persistMinutes = useCallback(
    (html: string) => saveMeetingMinutes(meetingId, html),
    [meetingId]
  );

  const { status: saveStatus, lastSavedAt, error: saveError, saveNow, markClean } =
    useAutosave({
      value: minutesContent,
      save: persistMinutes,
      // Never write before the meeting has started or before resumed state has
      // landed — either would persist an empty document over real minutes.
      enabled: hasLoadedState && !PRE_START_VIEWS.includes(view),
    });

  // Restore minutes, attendance, and start time when re-entering a meeting that
  // is already underway.
  useEffect(() => {
    if (!isResuming) return;
    let cancelled = false;

    (async () => {
      try {
        const state = await loadMeetingRunnerState(meetingId);
        if (cancelled) return;
        setPresentIds(new Set(state.presentPositionIds));
        setStartedAt(state.startedAt);
        setMinutesContent(state.minutesContent);
        markClean(state.minutesContent);
        setHasLoadedState(true);
      } catch (err) {
        if (cancelled) return;
        // Deliberately leaves hasLoadedState false: the editor stays gated and
        // adjournment stays blocked rather than risking a write of empty minutes
        // over the real ones. This used to be swallowed silently.
        setLoadError(
          err instanceof Error ? err.message : "Could not load this meeting's minutes."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isResuming, meetingId, markClean]);

  /** Updates new business locally and mirrors it to sessionStorage. */
  const persistNewBusiness = (items: NewBusinessItem[]) => {
    setNewBusiness(items);
    try {
      sessionStorage.setItem(newBusinessKey, JSON.stringify(items));
    } catch {
      // Storage unavailable (private mode); the items still live in state.
    }
  };

  /** Writes an attendance set, reverting the optimistic update if it fails. */
  const commitAttendance = (next: Set<string>) => {
    const previous = presentIds;
    setPresentIds(next);
    setActionError(null);
    startTransition(async () => {
      try {
        await updateAttendance(meetingId, Array.from(next));
      } catch (err) {
        setPresentIds(previous);
        setActionError(
          err instanceof Error ? err.message : "Could not save attendance."
        );
      }
    });
  };

  const togglePresent = (id: string) => {
    const next = new Set(presentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commitAttendance(next);
  };

  const markAllPresent = () => commitAttendance(new Set(positions.map((p) => p.id)));

  const handleCallToOrder = (calledBy: string, secondedBy: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await callToOrder(meetingId, calledBy, secondedBy, Array.from(presentIds));
        const { scaffold } = await seedMeetingScaffold(meetingId, newBusiness);
        setMinutesContent(scaffold);
        markClean(scaffold);
        try {
          sessionStorage.removeItem(newBusinessKey);
        } catch {
          // Storage unavailable; nothing to clean up.
        }
        setStartedAt(new Date().toISOString());
        goToView("running");
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to start meeting.");
      }
    });
  };

  /**
   * Inserts a paragraph at the cursor, so text lands in the section the operator
   * was working in rather than at the end of the document.
   */
  const insertParagraph = (text: string) => {
    const editor = editorRef.current;
    if (!editor || !text) return;
    editor
      .chain()
      .focus()
      .insertContentAt(editor.state.selection.head, {
        type: "paragraph",
        content: [{ type: "text", text }],
      })
      .run();
    // The editor's onChange has already updated minutesContent; flush it now
    // rather than waiting out the debounce, since a recorded vote matters.
    void saveNow().catch(() => {});
  };

  const handleVoteRecorded = (resultText: string) => {
    insertParagraph(resultText);
    goToView("running");
  };

  const handleActionItemCreated = (assigneeName: string, title: string) => {
    insertParagraph(`Action item assigned to ${assigneeName}: ${title}`);
    goToView("running");
  };

  const handleAdjourn = (movedBy: string, secondedBy: string) => {
    setActionError(null);
    startTransition(async () => {
      try {
        // Throws if the minutes cannot be written — better to block adjournment
        // than to close a meeting whose record was never saved.
        await saveNow();
        const { uploadError } = await adjournMeeting(meetingId, movedBy, secondedBy);
        goToView("export");
        if (uploadError) {
          setActionError(`Meeting adjourned, but the document upload failed: ${uploadError}`);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to adjourn.");
      }
    });
  };

  const handleDeleteMeeting = () => {
    startTransition(async () => {
      try {
        await cancelMeeting(meetingId);
        onClose();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to delete meeting.");
        setShowDeleteConfirm(false);
      }
    });
  };

  /**
   * Handles Escape and outside presses, which Base UI would otherwise treat as
   * "close". Mid-meeting that would tear down the runner on one keystroke, and
   * `beforeunload` does not fire for it, so the guard that protects a reload
   * would not protect this.
   */
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    const outcome = resolveDismiss(view);
    if (outcome === "close") onClose();
    else if (outcome === "dismissPanel") goToView("running");
    else setShowDismissHint(true);
  };

  const presentVotingPositions = votingPositions.filter((p) => presentIds.has(p.id));
  const isPreStart = PRE_START_VIEWS.includes(view);
  const banner = actionError ?? loadError ?? saveError;

  return (
    <Dialog
      open
      onOpenChange={handleOpenChange}
      // Nothing outside this surface is reachable anyway, and Base UI would
      // otherwise also close on focus-out — another way to lose a meeting to a
      // stray click. Escape stays the only dismissal, and it is governed above.
      disablePointerDismissal
    >
      <DialogContent
        showCloseButton={false}
        aria-label={`Meeting runner for ${meetingDate}`}
        // Overrides the primitive's small centred card: this surface is
        // full-bleed. `inset-0` supersedes its top/left, and the translate,
        // radius, padding, ring, and max-width all have to be unwound.
        className="inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 text-base text-foreground ring-0 sm:max-w-none"
      >
        <TopBar
          meetingDate={meetingDate}
          elapsed={elapsed}
          view={view}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onCallVote={() => goToView("voting")}
          onCreateActionItem={() => goToView("actionItem")}
          onAdjourn={() => goToView("adjourn")}
          onDeleteMeeting={() => setShowDeleteConfirm(true)}
          onExit={onClose}
        />

        {showDeleteConfirm && (
          <div className="px-4 pt-3 shrink-0">
            <DeleteMeetingConfirm
              onConfirm={handleDeleteMeeting}
              onDismiss={() => setShowDeleteConfirm(false)}
              isPending={isPending}
            />
          </div>
        )}

        {showDismissHint && (
          <div className="shrink-0 px-4 pt-3">
            <p role="status" className="text-xs text-muted-foreground">
              The meeting is still running — Escape will not leave it. Use Close
              in the top bar when you are done.
            </p>
          </div>
        )}

        {banner && (
          <div className="px-4 pt-3 shrink-0">
            <p role="alert" className="text-xs text-destructive">
              {banner}
            </p>
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto">
          {isPreStart ? (
            <>
              {view === "newBusiness" && (
                <NewBusinessPanel
                  items={newBusiness}
                  onAdd={(item) => persistNewBusiness([...newBusiness, item])}
                  onRemove={(index) =>
                    persistNewBusiness(newBusiness.filter((_, i) => i !== index))
                  }
                  onContinue={() => goToView("attendance")}
                />
              )}

              {view === "attendance" && (
                <AttendancePanel
                  positions={positions}
                  presentIds={presentIds}
                  quorumRequired={quorumRequired}
                  onToggle={togglePresent}
                  onMarkAllPresent={markAllPresent}
                  onProceed={() => goToView("callToOrder")}
                  isPending={isPending}
                />
              )}

              {view === "callToOrder" && (
                <CallToOrderPanel
                  presentPositions={presentVotingPositions}
                  onConfirm={handleCallToOrder}
                  onBack={() => goToView("attendance")}
                  isPending={isPending}
                />
              )}
            </>
          ) : !hasLoadedState ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              {!loadError && <Loader2 className="size-4 animate-spin" />}
              {loadError ? "Reload the page to try again." : "Loading this meeting…"}
            </div>
          ) : (
            <>
              {/* Stays mounted for the rest of the meeting — see the note above. */}
              <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
                <p className="text-sm text-muted-foreground">
                  Meeting in progress — use the buttons above to call votes, assign
                  action items, or adjourn.
                </p>
                <div className="flex-1">
                  <RichTextEditor
                    initialContent={minutesContent}
                    onChange={setMinutesContent}
                    onReady={(editor) => {
                      editorRef.current = editor;
                    }}
                  />
                </div>
              </div>

              {view !== "running" && (
                <div className="absolute inset-0 overflow-y-auto bg-background">
                  {view === "voting" && (
                    <VotePanel
                      votingPositions={votingPositions}
                      presentIds={presentIds}
                      meetingId={meetingId}
                      onVoteRecorded={handleVoteRecorded}
                      onCancel={() => goToView("running")}
                    />
                  )}

                  {view === "actionItem" && (
                    <ActionItemPanel
                      positions={positions}
                      meetingId={meetingId}
                      onCreated={handleActionItemCreated}
                      onCancel={() => goToView("running")}
                    />
                  )}

                  {view === "adjourn" && (
                    <AdjournPanel
                      presentPositions={presentVotingPositions}
                      minutesLookEmpty={!hasMinutesContent(minutesContent)}
                      onAdjourn={handleAdjourn}
                      onCancel={() => goToView("running")}
                      isPending={isPending}
                    />
                  )}

                  {view === "export" && (
                    <ExportPanel
                      meetingId={meetingId}
                      meetingDate={meetingDate}
                      onClose={onClose}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
