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
  positionRole: Position["role"];
  email: string;
}

/** Represents a pre-meeting status update enriched with position metadata */
export interface PreMeetingUpdateWithPosition {
  positionName: Position["name"];
  content: string;
  submittedAt: string;
}
