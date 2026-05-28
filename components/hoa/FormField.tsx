"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  /** The label text displayed above the input */
  label: string;
  /** The id connecting the label to the input via htmlFor */
  htmlFor: string;
  /** Validation error message — rendered in red below the input when present */
  error?: string;
  /** Whether the field is required — appends an asterisk to the label */
  required?: boolean;
  /** The input, textarea, or select element */
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a form control with a consistent label + error message layout.
 * Keeps label, control, and error co-located so every form field looks identical.
 *
 * Use with react-hook-form by passing `error={errors.fieldName?.message}`.
 */
export function FormField({
  label,
  htmlFor,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
