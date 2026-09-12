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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          run_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          run_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload_hash: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload_hash: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload_hash?: string
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          total_runs: number
          username: string | null
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          total_runs?: number
          username?: string | null
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          total_runs?: number
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          endpoint: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          endpoint: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          endpoint?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      run_usage_events: {
        Row: {
          action_key: string
          action_type: string
          created_at: string
          id: string
          plan_at_use: string
          user_id: string
        }
        Insert: {
          action_key: string
          action_type: string
          created_at?: string
          id?: string
          plan_at_use: string
          user_id: string
        }
        Update: {
          action_key?: string
          action_type?: string
          created_at?: string
          id?: string
          plan_at_use?: string
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          ai_diagnosis: Json | null
          ai_model_used: string | null
          buggy_code: string
          constraints_json: Json | null
          correct_code: string
          created_at: string
          failing_input: string | null
          id: string
          language: string
          output_buggy: string | null
          output_correct: string | null
          sample_input: string | null
          status: string
          syntax_check: Json | null
          user_id: string
        }
        Insert: {
          ai_diagnosis?: Json | null
          ai_model_used?: string | null
          buggy_code: string
          constraints_json?: Json | null
          correct_code: string
          created_at?: string
          failing_input?: string | null
          id?: string
          language?: string
          output_buggy?: string | null
          output_correct?: string | null
          sample_input?: string | null
          status?: string
          syntax_check?: Json | null
          user_id: string
        }
        Update: {
          ai_diagnosis?: Json | null
          ai_model_used?: string | null
          buggy_code?: string
          constraints_json?: Json | null
          correct_code?: string
          created_at?: string
          failing_input?: string | null
          id?: string
          language?: string
          output_buggy?: string | null
          output_correct?: string | null
          sample_input?: string | null
          status?: string
          syntax_check?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_state_changes: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          new_plan: string | null
          new_status: string | null
          previous_plan: string | null
          previous_status: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          new_plan?: string | null
          new_status?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          new_plan?: string | null
          new_status?: string | null
          previous_plan?: string | null
          previous_status?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          cycle_end: string | null
          cycle_start: string | null
          grace_period_end: string | null
          pending_plan: string | null
          plan: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          run_limit: number
          runs_used: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          grace_period_end?: string | null
          pending_plan?: string | null
          plan?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          run_limit?: number
          runs_used?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          grace_period_end?: string | null
          pending_plan?: string | null
          plan?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          run_limit?: number
          runs_used?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          created_at: string
          id: string
          input_data: string
          is_failing: boolean | null
          output_buggy: string | null
          output_correct: string | null
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_data: string
          is_failing?: boolean | null
          output_buggy?: string | null
          output_correct?: string | null
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_data?: string
          is_failing?: boolean | null
          output_buggy?: string | null
          output_correct?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_subscription_state: {
        Args: {
          _cycle_end: string
          _cycle_start: string
          _event_id?: string
          _grace_period_end: string
          _plan: string
          _razorpay_customer_id: string
          _razorpay_subscription_id: string
          _reset_runs: boolean
          _run_limit: number
          _source: string
          _status: string
          _user_id: string
        }
        Returns: {
          created_at: string
          cycle_end: string | null
          cycle_start: string | null
          grace_period_end: string | null
          pending_plan: string | null
          plan: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          run_limit: number
          runs_used: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_rate_limit: {
        Args: {
          _endpoint: string
          _max_requests: number
          _user_id: string
          _window_minutes: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_runs: { Args: never; Returns: undefined }
      consume_run_quota: {
        Args: { _action_key: string; _action_type: string; _user_id: string }
        Returns: Json
      }
      initialize_subscription: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          cycle_end: string | null
          cycle_start: string | null
          grace_period_end: string | null
          pending_plan: string | null
          plan: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          run_limit: number
          runs_used: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_subscription_pending: {
        Args: { _plan: string; _subscription_id: string; _user_id: string }
        Returns: {
          created_at: string
          cycle_end: string | null
          cycle_start: string | null
          grace_period_end: string | null
          pending_plan: string | null
          plan: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          run_limit: number
          runs_used: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_run_action: {
        Args: { _action_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
