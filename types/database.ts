/**
 * Auto-generated Supabase database types.
 *
 * After creating the Supabase project and running migrations, regenerate with:
 *   npx supabase gen types typescript --project-id <your-project-ref> > types/database.ts
 *
 * Until then, this stub satisfies the TypeScript compiler and allows development
 * to proceed without a live Supabase connection.
 *
 * NOTE: Every table must include `Relationships: []` to satisfy GenericTable
 * from @supabase/postgrest-js, which requires that field for structural compatibility.
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          position_id: string;
          title: string;
          completed: boolean;
          due_date: string | null;
          meeting_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          title: string;
          completed?: boolean;
          due_date?: string | null;
          meeting_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          completed?: boolean;
          due_date?: string | null;
          meeting_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: string;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          meeting_date: string;
          called_by: string;
          seconded_by: string | null;
          seconded_at: string | null;
          started_at: string | null;
          adjourned_at: string | null;
          status: MeetingStatus;
          minutes_content: string | null;
          minutes_drive_url: string | null;
          reminder_sent_at: string | null;
          present_positions: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_date: string;
          called_by: string;
          seconded_by?: string | null;
          seconded_at?: string | null;
          started_at?: string | null;
          adjourned_at?: string | null;
          status?: MeetingStatus;
          minutes_content?: string | null;
          minutes_drive_url?: string | null;
          present_positions?: string[];
          created_at?: string;
        };
        Update: {
          meeting_date?: string;
          called_by?: string;
          seconded_by?: string | null;
          seconded_at?: string | null;
          started_at?: string | null;
          adjourned_at?: string | null;
          status?: MeetingStatus;
          minutes_content?: string | null;
          minutes_drive_url?: string | null;
          reminder_sent_at?: string | null;
          present_positions?: string[];
        };
        Relationships: [];
      };
      meeting_documents: {
        Row: {
          id: string;
          meeting_id: string;
          name: string;
          drive_url: string;
          doc_type: MeetingDocType;
          amendment_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          name: string;
          drive_url: string;
          doc_type?: MeetingDocType;
          amendment_number?: number | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      motions: {
        Row: {
          id: string;
          meeting_id: string;
          title: string;
          description: string | null;
          proposed_by: string;
          seconded_by: string | null;
          proposed_at: string;
          seconded_at: string | null;
          status: MotionStatus;
          quorum_met: boolean | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          title: string;
          description?: string | null;
          proposed_by: string;
          seconded_by?: string | null;
          proposed_at?: string;
          seconded_at?: string | null;
          status?: MotionStatus;
          quorum_met?: boolean | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          seconded_by?: string | null;
          seconded_at?: string | null;
          status?: MotionStatus;
          quorum_met?: boolean | null;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      motion_votes: {
        Row: {
          id: string;
          motion_id: string;
          position_id: string;
          vote: VoteChoice;
          recorded_by: string;
          voted_at: string;
        };
        Insert: {
          id?: string;
          motion_id: string;
          position_id: string;
          vote: VoteChoice;
          recorded_by: string;
          voted_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          lot_number: number;
          first_name: string | null;
          last_name: string;
          account_number: string | null;
          street_address: string | null;
          membership: string | null;
          membership_type: string | null;
          annual_lease_fee: number | null;
          has_annual_lease_fee: boolean;
          email_1: string | null;
          email_2: string | null;
          key_fob_1: string | null;
          key_fob_2: string | null;
          sayor: boolean;
        };
        Insert: {
          id?: string;
          lot_number: number;
          first_name?: string | null;
          last_name: string;
          account_number?: string | null;
          street_address?: string | null;
          membership?: string | null;
          membership_type?: string | null;
          annual_lease_fee?: number | null;
          has_annual_lease_fee?: boolean;
          email_1?: string | null;
          email_2?: string | null;
          key_fob_1?: string | null;
          key_fob_2?: string | null;
          sayor?: boolean;
        };
        Update: {
          id?: string;
          lot_number?: number;
          first_name?: string | null;
          last_name?: string;
          account_number?: string | null;
          street_address?: string | null;
          membership?: string | null;
          membership_type?: string | null;
          annual_lease_fee?: number | null;
          has_annual_lease_fee?: boolean;
          email_1?: string | null;
          email_2?: string | null;
          key_fob_1?: string | null;
          key_fob_2?: string | null;
          sayor?: boolean;
        };
        Relationships: [];
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
  | "secretary"
  | "treasurer"
  | "pool"
  | "membership"
  | "tennis"
  | "social"
  | "web"
  | "architecture"
  | "welcoming"
  | "clubhouse"
  | "cra";

export type PositionRole = "president" | "officer" | "member" | "chair";

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

export type MeetingStatus = "pending" | "in_progress" | "adjourned";

export type MeetingDocType = "minutes" | "amendment";

export type MotionStatus =
  | "proposed"
  | "seconded"
  | "voting"
  | "passed"
  | "failed"
  | "tabled";

export type VoteChoice = "yay" | "nay" | "absent" | "no_vote";

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
export type Setting = Database["public"]["Tables"]["settings"]["Row"];
export type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type MeetingDocument = Database["public"]["Tables"]["meeting_documents"]["Row"];
export type Motion = Database["public"]["Tables"]["motions"]["Row"];
export type MotionVote = Database["public"]["Tables"]["motion_votes"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
