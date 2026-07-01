export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_id: string;
          created_at: string;
          event_type: string;
          group_id: string;
          id: string;
          payload: Json;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          event_type: string;
          group_id: string;
          id?: string;
          payload?: Json;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          event_type?: string;
          group_id?: string;
          id?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          }
        ];
      };
      device_tokens: {
        Row: {
          expo_token: string;
          id: string;
          last_seen_at: string;
          platform: string;
          user_id: string;
        };
        Insert: {
          expo_token: string;
          id?: string;
          last_seen_at?: string;
          platform: string;
          user_id: string;
        };
        Update: {
          expo_token?: string;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      expense_shares: {
        Row: {
          expense_id: string;
          share_paisa: number;
          user_id: string;
        };
        Insert: {
          expense_id: string;
          share_paisa: number;
          user_id: string;
        };
        Update: {
          expense_id?: string;
          share_paisa?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_shares_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      expenses: {
        Row: {
          amount_paisa: number;
          category: string;
          client_mutation_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          group_id: string;
          id: string;
          note: string | null;
          occurred_at: string;
          paid_by: string;
          receipt_url: string | null;
          split_method: string;
          updated_at: string;
        };
        Insert: {
          amount_paisa: number;
          category: string;
          client_mutation_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description: string;
          group_id: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          paid_by: string;
          receipt_url?: string | null;
          split_method: string;
          updated_at?: string;
        };
        Update: {
          amount_paisa?: number;
          category?: string;
          client_mutation_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          group_id?: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          paid_by?: string;
          receipt_url?: string | null;
          split_method?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          left_at: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          joined_at?: string;
          left_at?: string | null;
          role?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          left_at?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      groups: {
        Row: {
          archived_at: string | null;
          avatar_url: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          invite_code: string;
          name: string;
          template: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          invite_code?: string;
          name: string;
          template: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          invite_code?: string;
          name?: string;
          template?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bkash_number: string | null;
          created_at: string;
          default_currency: string;
          display_name: string;
          id: string;
          locale: string;
          nagad_number: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bkash_number?: string | null;
          created_at?: string;
          default_currency?: string;
          display_name: string;
          id: string;
          locale?: string;
          nagad_number?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bkash_number?: string | null;
          created_at?: string;
          default_currency?: string;
          display_name?: string;
          id?: string;
          locale?: string;
          nagad_number?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          amount_paisa: number;
          client_mutation_id: string | null;
          created_at: string;
          external_ref: string | null;
          from_user: string;
          group_id: string;
          id: string;
          method: string;
          occurred_at: string;
          to_user: string;
        };
        Insert: {
          amount_paisa: number;
          client_mutation_id?: string | null;
          created_at?: string;
          external_ref?: string | null;
          from_user: string;
          group_id: string;
          id?: string;
          method: string;
          occurred_at?: string;
          to_user: string;
        };
        Update: {
          amount_paisa?: number;
          client_mutation_id?: string | null;
          created_at?: string;
          external_ref?: string | null;
          from_user?: string;
          group_id?: string;
          id?: string;
          method?: string;
          occurred_at?: string;
          to_user?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_from_user_fkey";
            columns: ["from_user"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_to_user_fkey";
            columns: ["to_user"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_invite_code: string }; Returns: string };
      create_expense: {
        Args: {
          p_amount_paisa: number;
          p_category: string;
          p_client_mutation_id?: string;
          p_description: string;
          p_group_id: string;
          p_note?: string;
          p_occurred_at?: string;
          p_paid_by: string;
          p_receipt_url?: string;
          p_shares: Json;
          p_split_method: string;
        };
        Returns: string;
      };
      create_settlement: {
        Args: {
          p_amount_paisa: number;
          p_client_mutation_id?: string;
          p_external_ref?: string;
          p_from_user: string;
          p_group_id: string;
          p_method: string;
          p_occurred_at?: string;
          p_to_user: string;
        };
        Returns: string;
      };
      current_user_is_group_admin: {
        Args: { target_group_id: string };
        Returns: boolean;
      };
      current_user_is_group_member: {
        Args: { target_group_id: string };
        Returns: boolean;
      };
      delete_my_account: { Args: never; Returns: undefined };
      get_group_balances: {
        Args: { p_group_id: string };
        Returns: {
          net_paisa: number;
          user_id: string;
        }[];
      };
      simplify_debts: {
        Args: { p_group_id: string };
        Returns: {
          amount_paisa: number;
          from_user: string;
          to_user: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {}
  },
  public: {
    Enums: {}
  }
} as const;
