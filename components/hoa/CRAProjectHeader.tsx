"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCRAProject, deleteCRAProject } from "@/actions/cra";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { InlineConfirm } from "@/components/hoa/InlineConfirm";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/hoa/StatusBadge";
import type { CRAProject, CRAProjectStatus, CRAPriority } from "@/types/database";

interface FiscalYearOption {
  id: string;
  label: string;
}

interface CRAProjectHeaderProps {
  project: CRAProject;
  fiscalYears: FiscalYearOption[];
  canEdit: boolean;
}

const STATUSES: CRAProjectStatus[] = [
  "proposed",
  "approved",
  "in_progress",
  "complete",
  "on_hold",
];

/**
 * Inline-editable header for a CRA project. Editors get a status dropdown and
 * click-to-edit cost/date/priority/category/fiscal-year/description fields plus
 * a confirm-gated delete. Non-editors see read-only values.
 *
 * @param project     - The project to display/edit
 * @param fiscalYears - Fiscal-year options for the FY field
 * @param canEdit     - Whether the current user may edit (canEditCRA)
 */
export function CRAProjectHeader({
  project,
  fiscalYears,
  canEdit,
}: CRAProjectHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (patch: Parameters<typeof updateCRAProject>[1]) =>
    startTransition(async () => {
      await updateCRAProject(project.id, patch);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      await deleteCRAProject(project.id);
      router.push("/cra");
    });

  if (!canEdit) {
    const fiscalYearLabel =
      fiscalYears.find((f) => f.id === project.fiscal_year_id)?.label ?? "—";

    return (
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={project.status} />
          </dd>
        </div>
        <Field
          label="Estimated"
          value={formatCents(project.estimated_cost ?? 0)}
        />
        <Field
          label="Actual"
          value={
            project.actual_cost === null ? "—" : formatCents(project.actual_cost)
          }
        />
        <Field label="Priority" value={project.priority ?? "—"} />
        <Field label="Target date" value={project.target_date ?? "—"} />
        <Field label="Fiscal year" value={fiscalYearLabel} />
        <Field label="Category" value={project.category ?? "—"} />
        {project.description && (
          <Field label="Description" value={project.description} wide />
        )}
      </dl>
    );
  }

  const input =
    "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-4 rounded-md border border-border p-4 text-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <select
            className={`${input} w-full`}
            value={project.status}
            disabled={isPending}
            onChange={(e) =>
              save({ status: e.target.value as CRAProjectStatus })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <MoneyField
          label="Estimated"
          cents={project.estimated_cost}
          onSave={(c) => save({ estimated_cost: c })}
          disabled={isPending}
        />
        <MoneyField
          label="Actual"
          cents={project.actual_cost}
          onSave={(c) => save({ actual_cost: c })}
          disabled={isPending}
        />

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Priority</span>
          <select
            className={`${input} w-full`}
            value={project.priority ?? ""}
            disabled={isPending}
            onChange={(e) =>
              save({ priority: (e.target.value || null) as CRAPriority | null })
            }
          >
            <option value="">None</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Target date</span>
          <input
            type="date"
            className={`${input} w-full`}
            defaultValue={project.target_date ?? ""}
            disabled={isPending}
            onBlur={(e) => save({ target_date: e.target.value || null })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Fiscal year</span>
          <select
            className={`${input} w-full`}
            value={project.fiscal_year_id ?? ""}
            disabled={isPending}
            onChange={(e) =>
              save({ fiscal_year_id: e.target.value || null })
            }
          >
            <option value="">Unassigned</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Category</span>
          <input
            className={`${input} w-full`}
            defaultValue={project.category ?? ""}
            disabled={isPending}
            onBlur={(e) => save({ category: e.target.value || null })}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Description</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
          defaultValue={project.description ?? ""}
          disabled={isPending}
          onBlur={(e) => save({ description: e.target.value || null })}
        />
      </label>

      <div>
        {confirmDelete ? (
          <InlineConfirm
            message={`Delete "${project.name}" and all its quotes, updates, and documents?`}
            confirmLabel="Delete project"
            onConfirm={remove}
            onDismiss={() => setConfirmDelete(false)}
            isPending={isPending}
          />
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            Delete project
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}

/**
 * Click-to-edit money field: shows formatted cents, edits as dollars.
 */
function MoneyField({
  label,
  cents,
  onSave,
  disabled,
}: {
  label: string;
  cents: number | null;
  onSave: (cents: number | null) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        className="space-y-1 text-left"
        onClick={() => {
          setDraft(cents === null ? "" : String(cents / 100));
          setEditing(true);
        }}
      >
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span>{cents === null ? "—" : formatCents(cents)}</span>
      </button>
    );
  }
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label} (USD)</span>
      <input
        autoFocus
        inputMode="decimal"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(parseDollarsToCents(draft));
        }}
      />
    </label>
  );
}
