"use client";

import type { CRAUpdate } from "@/types/database";

interface CRAUpdatesSectionProps {
  projectId: string;
  updates: (CRAUpdate & { positions: { name: string } | null })[];
  canEdit: boolean;
}

/**
 * Placeholder for CRA project updates section — fleshed out in Task 12.
 */
export function CRAUpdatesSection(_props: CRAUpdatesSectionProps) {
  return null;
}
