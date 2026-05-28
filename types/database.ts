/**
 * Auto-generated Supabase database types.
 *
 * After creating the Supabase project and running migrations, regenerate with:
 *   npx supabase gen types typescript --project-id <your-project-ref> > types/database.ts
 *
 * Until then, this stub satisfies the TypeScript compiler and allows development
 * to proceed without a live Supabase connection.
 */
export type Database = {
  public: {
    Tables: {
      positions: {
        Row: {
          id: string;
          name: PositionName;
          email: string;
          role: PositionRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: PositionName;
          email: string;
          role: PositionRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: PositionName;
          email?: string;
          role?: PositionRole;
          created_at?: string;
        };
      };
      architecture_requests: {
        Row: {
          id: string;
          address: string;
          description: string;
          status: ArchitectureStatus;
          vote_outcome: VoteOutcome | null;
          vote_ratio: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          description: string;
          status?: ArchitectureStatus;
          vote_outcome?: VoteOutcome | null;
          vote_ratio?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          address?: string;
          description?: string;
          status?: ArchitectureStatus;
          vote_outcome?: VoteOutcome | null;
          vote_ratio?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      architecture_documents: {
        Row: {
          id: string;
          request_id: string;
          storage_path: string;
          file_name: string;
          doc_type: ArchitectureDocType;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          storage_path: string;
          file_name: string;
          doc_type: ArchitectureDocType;
          created_at?: string;
        };
        Update: never;
      };
      cra_projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: CRAProjectStatus;
          estimated_cost: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: CRAProjectStatus;
          estimated_cost?: number | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: CRAProjectStatus;
          estimated_cost?: number | null;
          updated_at?: string;
        };
      };
      cra_quotes: {
        Row: {
          id: string;
          project_id: string;
          vendor_name: string;
          amount: number;
          notes: string | null;
          document_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          vendor_name: string;
          amount: number;
          notes?: string | null;
          document_url?: string | null;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
          document_url?: string | null;
        };
      };
      cra_updates: {
        Row: {
          id: string;
          project_id: string;
          content: string;
          created_by_position: PositionName;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          content: string;
          created_by_position: PositionName;
          created_at?: string;
        };
        Update: never;
      };
      cra_documents: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          url: string;
          url_type: DocumentUrlType;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          url: string;
          url_type: DocumentUrlType;
          created_at?: string;
        };
        Update: never;
      };
      meeting_minutes: {
        Row: {
          id: string;
          position_id: string;
          meeting_date: string;
          content: string | null;
          google_doc_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          meeting_date: string;
          content?: string | null;
          google_doc_url?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string | null;
          google_doc_url?: string | null;
        };
      };
      todos: {
        Row: {
          id: string;
          position_id: string;
          title: string;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          title: string;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          completed?: boolean;
          updated_at?: string;
        };
      };
      pre_meeting_updates: {
        Row: {
          id: string;
          position_id: string;
          meeting_date: string;
          content: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          meeting_date: string;
          content: string;
          submitted_at?: string;
        };
        Update: {
          content?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// ─── Enum-style string union types ──────────────────────────────────────────

export type PositionName =
  | "president"
  | "vp"
  | "treasurer"
  | "pool"
  | "membership"
  | "tennis"
  | "social";

export type PositionRole = "president" | "member";

export type ArchitectureStatus = "pending" | "approved" | "denied";

export type VoteOutcome = "unanimous" | "majority" | "denied";

export type ArchitectureDocType = "form" | "plan" | "sample" | "other";

export type CRAProjectStatus =
  | "proposed"
  | "approved"
  | "in_progress"
  | "complete"
  | "on_hold";

export type DocumentUrlType = "google_doc" | "storage_file";

// ─── Convenience row types ───────────────────────────────────────────────────

export type Position = Database["public"]["Tables"]["positions"]["Row"];
export type ArchitectureRequest = Database["public"]["Tables"]["architecture_requests"]["Row"];
export type ArchitectureDocument = Database["public"]["Tables"]["architecture_documents"]["Row"];
export type CRAProject = Database["public"]["Tables"]["cra_projects"]["Row"];
export type CRAQuote = Database["public"]["Tables"]["cra_quotes"]["Row"];
export type CRAUpdate = Database["public"]["Tables"]["cra_updates"]["Row"];
export type CRADocument = Database["public"]["Tables"]["cra_documents"]["Row"];
export type MeetingMinutes = Database["public"]["Tables"]["meeting_minutes"]["Row"];
export type Todo = Database["public"]["Tables"]["todos"]["Row"];
export type PreMeetingUpdate = Database["public"]["Tables"]["pre_meeting_updates"]["Row"];
