"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface FileUploadButtonProps {
  /** File types to accept, e.g. ".csv" or ".pdf,.doc" */
  accept?: string;
  /** Button label. Defaults to "Choose File". */
  label?: string;
  /** Called with the selected File when the user picks one. */
  onChange: (file: File) => void;
  disabled?: boolean;
  /** Increment to force the input to reset (e.g. after a successful upload). */
  resetKey?: number;
}

/**
 * A styled file picker that looks like a button rather than a browser default
 * input. Shows the selected filename alongside the button after a file is chosen.
 * Generic enough for CSV imports, PDF uploads, or any document attachment flow.
 *
 * @param accept   - MIME types or extensions to filter (forwarded to input accept)
 * @param label    - Text shown on the trigger button
 * @param onChange - Callback fired with the chosen File
 * @param resetKey - Increment this to clear the selection (triggers remount)
 */
export function FileUploadButton({
  accept,
  label = "Choose File",
  onChange,
  disabled,
  resetKey = 0,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    onChange(file);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        key={resetKey}
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {label}
      </Button>
      {fileName && (
        <span className="text-sm text-muted-foreground truncate max-w-xs">
          {fileName}
        </span>
      )}
    </div>
  );
}
