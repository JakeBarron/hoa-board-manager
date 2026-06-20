interface SpinnerProps {
  /** Optional text shown next to the spinner (e.g. "Saving…"). */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Small inline loading spinner with an optional label. Renders an
 * accessible status region so screen readers announce the busy state.
 *
 * @param label     - Optional text shown beside the spinner
 * @param className - Extra wrapper classes
 */
export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <span
        aria-hidden
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
      />
      {label && <span>{label}</span>}
    </span>
  );
}
