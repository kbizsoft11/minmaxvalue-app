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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      casino_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_verification_history: {
        Row: {
          action: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          verification_id: string
        }
        Insert: {
          action: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          verification_id: string
        }
        Update: {
          action?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_verification_history_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "casino_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_verifications: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          purchase_id: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          purchase_id: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_id?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "casino_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casino_verifications_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_history: {
        Row: {
          action: string
          created_at: string
          dispute_id: string
          id: string
          new_status: Database["public"]["Enums"]["dispute_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["dispute_status"] | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          dispute_id: string
          id?: string
          new_status?: Database["public"]["Enums"]["dispute_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["dispute_status"] | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          dispute_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["dispute_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["dispute_status"] | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_history_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_at_risk: number
          buyer_id: string
          id: string
          opened_at: string
          organization_id: string | null
          purchase_id: string | null
          raised_by: string
          raised_by_role: string
          reason_code: Database["public"]["Enums"]["dispute_reason"]
          reason_details: string | null
          resolution: Database["public"]["Enums"]["dispute_resolution"] | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["dispute_status"]
          support_ticket_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          amount_at_risk?: number
          buyer_id: string
          id?: string
          opened_at?: string
          organization_id?: string | null
          purchase_id?: string | null
          raised_by: string
          raised_by_role?: string
          reason_code: Database["public"]["Enums"]["dispute_reason"]
          reason_details?: string | null
          resolution?: Database["public"]["Enums"]["dispute_resolution"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["dispute_status"]
          support_ticket_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          amount_at_risk?: number
          buyer_id?: string
          id?: string
          opened_at?: string
          organization_id?: string | null
          purchase_id?: string | null
          raised_by?: string
          raised_by_role?: string
          reason_code?: Database["public"]["Enums"]["dispute_reason"]
          reason_details?: string | null
          resolution?: Database["public"]["Enums"]["dispute_resolution"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["dispute_status"]
          support_ticket_id?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_entries: {
        Row: {
          created_at: string
          email: string
          giveaway_name: string
          id: string
          instagram_followed: boolean
          survey_completed: boolean
        }
        Insert: {
          created_at?: string
          email: string
          giveaway_name?: string
          id?: string
          instagram_followed?: boolean
          survey_completed?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          giveaway_name?: string
          id?: string
          instagram_followed?: boolean
          survey_completed?: boolean
        }
        Relationships: []
      }
      organization_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_earnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          fee_percentage: number
          id: string
          name: string
          status: Database["public"]["Enums"]["organization_status"]
          type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          fee_percentage?: number
          id?: string
          name: string
          status?: Database["public"]["Enums"]["organization_status"]
          type?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          fee_percentage?: number
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["organization_status"]
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          method: string
          method_details: Json | null
          notes: string | null
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          method: string
          method_details?: Json | null
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          method?: string
          method_details?: Json | null
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          reference_id: string | null
          reference_type: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          buyer_casino_alias: string | null
          buyer_dob: string | null
          buyer_first_name: string | null
          buyer_id: string
          buyer_last_name: string | null
          id: string
          purchased_at: string | null
          service_fee: number
          ticket_id: string
          ticket_price: number
          total_amount: number
        }
        Insert: {
          buyer_casino_alias?: string | null
          buyer_dob?: string | null
          buyer_first_name?: string | null
          buyer_id: string
          buyer_last_name?: string | null
          id?: string
          purchased_at?: string | null
          service_fee: number
          ticket_id: string
          ticket_price: number
          total_amount: number
        }
        Update: {
          buyer_casino_alias?: string | null
          buyer_dob?: string | null
          buyer_first_name?: string | null
          buyer_id?: string
          buyer_last_name?: string | null
          id?: string
          purchased_at?: string | null
          service_fee?: number
          ticket_id?: string
          ticket_price?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          answer: string
          created_at: string
          giveaway_entry_id: string
          id: string
          question_number: number
          question_text: string
        }
        Insert: {
          answer: string
          created_at?: string
          giveaway_entry_id: string
          id?: string
          question_number: number
          question_text: string
        }
        Update: {
          answer?: string
          created_at?: string
          giveaway_entry_id?: string
          id?: string
          question_number?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_giveaway_entry_id_fkey"
            columns: ["giveaway_entry_id"]
            isOneToOne: false
            referencedRelation: "giveaway_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_views: {
        Row: {
          id: string
          ticket_id: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          ticket_id: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          ticket_id?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_views_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          id: string
          ticket_id: string
          user_id: string
          watched_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          user_id: string
          watched_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asking_price: number
          buy_in: number
          casino_alias: string | null
          created_at: string | null
          description: string | null
          event_date: string
          first_name: string | null
          id: string
          last_name: string | null
          money_guarantee: number | null
          organization_id: string | null
          seller_dob: string | null
          seller_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          total_views: number
          tournament_name: string
          unique_viewers: number
          updated_at: string | null
          venue: string
          watchers: number
        }
        Insert: {
          asking_price: number
          buy_in: number
          casino_alias?: string | null
          created_at?: string | null
          description?: string | null
          event_date: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          money_guarantee?: number | null
          organization_id?: string | null
          seller_dob?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          total_views?: number
          tournament_name: string
          unique_viewers?: number
          updated_at?: string | null
          venue: string
          watchers?: number
        }
        Update: {
          asking_price?: number
          buy_in?: number
          casino_alias?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          money_guarantee?: number | null
          organization_id?: string | null
          seller_dob?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          total_views?: number
          tournament_name?: string
          unique_viewers?: number
          updated_at?: string | null
          venue?: string
          watchers?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_requests: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          venue_name: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          venue_name: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          venue_name?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_giveaway_entry: { Args: { p_email: string }; Returns: Json }
      current_user_is_admin: { Args: never; Returns: boolean }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ticket_views: {
        Args: { p_ticket_id: string; p_viewer_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_casino_user: { Args: { _user_id: string }; Returns: boolean }
      mark_ticket_pending: { Args: { p_ticket_id: string }; Returns: undefined }
      process_purchase_payment: {
        Args: {
          p_purchase_id: string
          p_seller_id: string
          p_service_fee: number
          p_ticket_price: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "casino_user"
      dispute_reason:
        | "invalid_ticket"
        | "transfer_not_completed"
        | "event_cancelled"
        | "fraud_chargeback"
        | "other"
      dispute_resolution: "buyer" | "seller" | "partial"
      dispute_status: "open" | "investigating" | "resolved" | "closed"
      organization_status: "waitlisted" | "active" | "suspended"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      ticket_status:
        | "available"
        | "pending"
        | "sold"
        | "pending_approval"
        | "rejected"
      transaction_type: "sale" | "payout" | "refund" | "fee" | "adjustment"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user", "casino_user"],
      dispute_reason: [
        "invalid_ticket",
        "transfer_not_completed",
        "event_cancelled",
        "fraud_chargeback",
        "other",
      ],
      dispute_resolution: ["buyer", "seller", "partial"],
      dispute_status: ["open", "investigating", "resolved", "closed"],
      organization_status: ["waitlisted", "active", "suspended"],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      ticket_status: [
        "available",
        "pending",
        "sold",
        "pending_approval",
        "rejected",
      ],
      transaction_type: ["sale", "payout", "refund", "fee", "adjustment"],
    },
  },
} as const
