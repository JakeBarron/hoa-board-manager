"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface FileUploadButtonProps {
  /** File types to accept, e.g. ".csv" or ".pdf,.doc" */
  accept?: string;
  /** Button label. Defaults to "Choose File". */
  label?: string;
  /** Called with the selected file(s). Always an array — use files[0] for single-file pickers. */
  onChange: (files: File[]) => void;
  /** Allow selecting multiple files at once. */
  multiple?: boolean;
  disabled?: boolean;
  /** Increment to force the input to reset (e.g. after a successful upload). */
  resetKey?: number;
}

/**
 * A styled file picker that looks like a button rather than a browser default
 * input. Shows the selected filename (or count) alongside the button after
 * files are chosen. Generic enough for CSV imports, PDF uploads, or any
 * document attachment flow.
 *
 * @param accept   - MIME types or extensions to filter (forwarded to input accept)
 * @param label    - Text shown on the trigger button
 * @param onChange - Callback fired with the chosen File array; use files[0] for single-file pickers
 * @param multiple - Allow selecting more than one file at a time
 * @param resetKey - Increment this to clear the selection (triggers remount)
 */
export function FileUploadButton({
  accept,
  label = "Choose File",
  onChange,
  multiple,
  disabled,
  resetKey = 0,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setFileName(files.length === 1 ? files[0].name : `${files.length} files selected`);
    onChange(files);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        key={resetKey}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
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
