export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      report_contacts: {
        Row: {
          email: string | null
          name: string | null
          phone: string | null
          report_id: string
        }
        Insert: {
          email?: string | null
          name?: string | null
          phone?: string | null
          report_id: string
        }
        Update: {
          email?: string | null
          name?: string | null
          phone?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_contacts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_images: {
        Row: {
          created_at: string
          id: string
          path: string
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_images_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_supports: {
        Row: {
          created_at: string
          id: string
          report_id: string
          supporter_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          supporter_key: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          supporter_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_supports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string
          ai_authority: string | null
          ai_category: Database["public"]["Enums"]["report_category"] | null
          ai_source: string | null
          ai_summary: string | null
          authority: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          description: string
          forwarded_at: string | null
          forwarded_to: string | null
          forwarding_channel: string | null
          forwarding_reference: string | null
          id: string
          is_demo: boolean
          latitude: number | null
          locality: string
          longitude: number | null
          moderation: Database["public"]["Enums"]["moderation_state"]
          possible_duplicate_of: string | null
          reference: string
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          support_count: number
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          ai_authority?: string | null
          ai_category?: Database["public"]["Enums"]["report_category"] | null
          ai_source?: string | null
          ai_summary?: string | null
          authority?: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description: string
          forwarded_at?: string | null
          forwarded_to?: string | null
          forwarding_channel?: string | null
          forwarding_reference?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          locality: string
          longitude?: number | null
          moderation?: Database["public"]["Enums"]["moderation_state"]
          possible_duplicate_of?: string | null
          reference: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          support_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          ai_authority?: string | null
          ai_category?: Database["public"]["Enums"]["report_category"] | null
          ai_source?: string | null
          ai_summary?: string | null
          authority?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description?: string
          forwarded_at?: string | null
          forwarded_to?: string | null
          forwarding_channel?: string | null
          forwarding_reference?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          locality?: string
          longitude?: number | null
          moderation?: Database["public"]["Enums"]["moderation_state"]
          possible_duplicate_of?: string | null
          reference?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          support_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_possible_duplicate_of_fkey"
            columns: ["possible_duplicate_of"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          created_at: string
          id: string
          note: string | null
          report_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          report_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          report_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      moderation_state: "pending" | "approved" | "rejected" | "flagged"
      report_category:
        | "pothole"
        | "garbage"
        | "streetlight"
        | "water"
        | "public_safety"
        | "other"
      report_status:
        | "submitted"
        | "under_review"
        | "forwarded"
        | "in_progress"
        | "resolved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      moderation_state: ["pending", "approved", "rejected", "flagged"],
      report_category: [
        "pothole",
        "garbage",
        "streetlight",
        "water",
        "public_safety",
        "other",
      ],
      report_status: [
        "submitted",
        "under_review",
        "forwarded",
        "in_progress",
        "resolved",
      ],
    },
  },
} as const
