/**
 * Application-level domain types that don't map 1:1 to database rows.
 * These are the shapes the UI works with after data is fetched and transformed.
 */

import type {
  ArchitectureRequest,
  ArchitectureDocument,
  CRAProject,
  CRAQuote,
  CRAUpdate,
  CRADocument,
  Position,
  BudgetLineItem,
  CategoryActual,
  AccountType,
} from "./database";

/** Architecture request with all its associated documents pre-loaded */
export interface ArchitectureRequestWithDocs extends ArchitectureRequest {
  documents: ArchitectureDocument[];
}

/** CRA project with all related data pre-loaded for the detail view */
export interface CRAProjectDetail extends CRAProject {
  quotes: CRAQuote[];
  updates: CRAUpdate[];
  documents: CRADocument[];
}

/**
 * The currently authenticated board member's session context.
 * Stored in a React context and available to all Client Components.
 */
export interface BoardSession {
  userId: string;
  positionName: Position["name"];
  /** president = full access + admin | officer = edit any section | member = edit own only */
  positionRole: Position["role"];
  email: string;
}

/** Represents a pre-meeting status update enriched with position metadata */
export interface PreMeetingUpdateWithPosition {
  positionName: Position["name"];
  content: string;
  submittedAt: string;
}

/**
 * Filter state for the interactive map property table.
 * sayor: null = show all, true = SAYOR only, false = non-SAYOR only.
 */
export type MapFilters = {
  membership: string;
  sayor: boolean | null;
  lotSearch: string;
};

/**
 * Budget totals for one category+account_type pair, merged with the latest actuals.
 * Built server-side by grouping budget_line_items and joining with budget_category_actuals.
 */
export interface CategoryBudgetSummary {
  category: string;
  account_type: AccountType;
  budget_amount: number;
  ytd_actual: number;
  as_of_date: string | null;
  line_items: BudgetLineItem[];
}

/** Aggregate assessment counts used on the treasury overview strip. */
export interface AssessmentSummary {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  waived: number;
  total_due: number;
  total_paid: number;
}
