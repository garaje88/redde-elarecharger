export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          created_at: string;
          event: string;
          id: number;
          metadata: NonNullable<Json>;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event: string;
          id?: never;
          metadata?: NonNullable<Json>;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          user_id?: string | null;
        };
        Relationships: [];
      };
      catalog_submissions: {
        Row: {
          created_at: string;
          created_charger_model_id: string | null;
          created_variant_id: string | null;
          extracted: Json | null;
          id: string;
          kind: Database["public"]["Enums"]["catalog_kind"];
          query: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          sources: NonNullable<Json>;
          status: Database["public"]["Enums"]["submission_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_charger_model_id?: string | null;
          created_variant_id?: string | null;
          extracted?: Json | null;
          id?: string;
          kind: Database["public"]["Enums"]["catalog_kind"];
          query: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sources?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["submission_status"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          created_charger_model_id?: string | null;
          created_variant_id?: string | null;
          extracted?: Json | null;
          id?: string;
          kind?: Database["public"]["Enums"]["catalog_kind"];
          query?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sources?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["submission_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_submissions_created_charger_model_id_fkey";
            columns: ["created_charger_model_id"];
            isOneToOne: false;
            referencedRelation: "charger_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_submissions_created_variant_id_fkey";
            columns: ["created_variant_id"];
            isOneToOne: false;
            referencedRelation: "ev_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_sync_runs: {
        Row: {
          errors: NonNullable<Json>;
          finished_at: string | null;
          id: number;
          inserted: number;
          skipped_verified: number;
          source: string;
          started_at: string;
          updated: number;
        };
        ComputedFields: never;
        Insert: {
          errors?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          inserted?: number;
          skipped_verified?: number;
          source: string;
          started_at?: string;
          updated?: number;
        };
        Update: {
          errors?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          inserted?: number;
          skipped_verified?: number;
          source?: string;
          started_at?: string;
          updated?: number;
        };
        Relationships: [];
      };
      charge_calculations: {
        Row: {
          charger_id: string | null;
          cost: number | null;
          created_at: string;
          duration_min: number;
          effective_kw: number;
          energy_grid_kwh: number;
          engine_version: string;
          id: string;
          inputs: NonNullable<Json>;
          start_soc: number;
          target_soc: number;
          updated_at: string;
          user_id: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          charger_id?: string | null;
          cost?: number | null;
          created_at?: string;
          duration_min: number;
          effective_kw: number;
          energy_grid_kwh: number;
          engine_version: string;
          id?: string;
          inputs?: NonNullable<Json>;
          start_soc: number;
          target_soc: number;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Update: {
          charger_id?: string | null;
          cost?: number | null;
          created_at?: string;
          duration_min?: number;
          effective_kw?: number;
          energy_grid_kwh?: number;
          engine_version?: string;
          id?: string;
          inputs?: NonNullable<Json>;
          start_soc?: number;
          target_soc?: number;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "charge_calculations_charger_id_fkey";
            columns: ["charger_id"];
            isOneToOne: false;
            referencedRelation: "chargers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charge_calculations_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      charger_models: {
        Row: {
          adjustable_amperage: number[];
          brand: string;
          connector_type_id: number | null;
          created_at: string;
          field_sources: NonNullable<Json>;
          id: string;
          input_voltage_max: number | null;
          input_voltage_min: number | null;
          kind: Database["public"]["Enums"]["charger_kind"];
          max_amperage_a: number | null;
          model: string;
          phases: number;
          rated_kw: number;
          status: Database["public"]["Enums"]["catalog_status"];
          submitted_by: string | null;
          tethered_cable: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adjustable_amperage?: number[];
          brand: string;
          connector_type_id?: number | null;
          created_at?: string;
          field_sources?: NonNullable<Json>;
          id?: string;
          input_voltage_max?: number | null;
          input_voltage_min?: number | null;
          kind: Database["public"]["Enums"]["charger_kind"];
          max_amperage_a?: number | null;
          model: string;
          phases?: number;
          rated_kw: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          submitted_by?: string | null;
          tethered_cable?: boolean;
          updated_at?: string;
        };
        Update: {
          adjustable_amperage?: number[];
          brand?: string;
          connector_type_id?: number | null;
          created_at?: string;
          field_sources?: NonNullable<Json>;
          id?: string;
          input_voltage_max?: number | null;
          input_voltage_min?: number | null;
          kind?: Database["public"]["Enums"]["charger_kind"];
          max_amperage_a?: number | null;
          model?: string;
          phases?: number;
          rated_kw?: number;
          status?: Database["public"]["Enums"]["catalog_status"];
          submitted_by?: string | null;
          tethered_cable?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charger_models_connector_type_id_fkey";
            columns: ["connector_type_id"];
            isOneToOne: false;
            referencedRelation: "connector_types";
            referencedColumns: ["id"];
          },
        ];
      };
      chargers: {
        Row: {
          charger_model_id: string | null;
          circuit_amperage_a: number;
          connector_type_id: number | null;
          created_at: string;
          efficiency: number | null;
          id: string;
          name: string;
          owner_id: string;
          phases: number;
          updated_at: string;
          use: Database["public"]["Enums"]["charger_use"];
          voltage_v: number;
        };
        ComputedFields: never;
        Insert: {
          charger_model_id?: string | null;
          circuit_amperage_a: number;
          connector_type_id?: number | null;
          created_at?: string;
          efficiency?: number | null;
          id?: string;
          name: string;
          owner_id?: string;
          phases?: number;
          updated_at?: string;
          use?: Database["public"]["Enums"]["charger_use"];
          voltage_v: number;
        };
        Update: {
          charger_model_id?: string | null;
          circuit_amperage_a?: number;
          connector_type_id?: number | null;
          created_at?: string;
          efficiency?: number | null;
          id?: string;
          name?: string;
          owner_id?: string;
          phases?: number;
          updated_at?: string;
          use?: Database["public"]["Enums"]["charger_use"];
          voltage_v?: number;
        };
        Relationships: [
          {
            foreignKeyName: "chargers_charger_model_id_fkey";
            columns: ["charger_model_id"];
            isOneToOne: false;
            referencedRelation: "charger_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chargers_connector_type_id_fkey";
            columns: ["connector_type_id"];
            isOneToOne: false;
            referencedRelation: "connector_types";
            referencedColumns: ["id"];
          },
        ];
      };
      charging_sessions: {
        Row: {
          charger_id: string | null;
          cost: number | null;
          created_at: string;
          end_soc: number | null;
          ended_at: string | null;
          energy_kwh: number | null;
          id: string;
          location_label: string | null;
          notes: string | null;
          odometer_km: number | null;
          start_soc: number | null;
          started_at: string;
          updated_at: string;
          user_id: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          charger_id?: string | null;
          cost?: number | null;
          created_at?: string;
          end_soc?: number | null;
          ended_at?: string | null;
          energy_kwh?: number | null;
          id?: string;
          location_label?: string | null;
          notes?: string | null;
          odometer_km?: number | null;
          start_soc?: number | null;
          started_at: string;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Update: {
          charger_id?: string | null;
          cost?: number | null;
          created_at?: string;
          end_soc?: number | null;
          ended_at?: string | null;
          energy_kwh?: number | null;
          id?: string;
          location_label?: string | null;
          notes?: string | null;
          odometer_km?: number | null;
          start_soc?: number | null;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "charging_sessions_charger_id_fkey";
            columns: ["charger_id"];
            isOneToOne: false;
            referencedRelation: "chargers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charging_sessions_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      connector_types: {
        Row: {
          code: string;
          compatible_adapters: string[];
          created_at: string;
          current: Database["public"]["Enums"]["current_type"];
          id: number;
          max_kw_typical: number | null;
          name: string;
          ocm_id: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          compatible_adapters?: string[];
          created_at?: string;
          current: Database["public"]["Enums"]["current_type"];
          id?: never;
          max_kw_typical?: number | null;
          name: string;
          ocm_id?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          compatible_adapters?: string[];
          created_at?: string;
          current?: Database["public"]["Enums"]["current_type"];
          id?: never;
          max_kw_typical?: number | null;
          name?: string;
          ocm_id?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ev_brands: {
        Row: {
          country: string | null;
          created_at: string;
          id: string;
          logo_path: string | null;
          name: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          country?: string | null;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ev_models: {
        Row: {
          aliases: string[];
          body_type: string | null;
          brand_id: string;
          created_at: string;
          id: string;
          markets: string[];
          name: string;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          body_type?: string | null;
          brand_id: string;
          created_at?: string;
          id?: string;
          markets?: string[];
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          body_type?: string | null;
          brand_id?: string;
          created_at?: string;
          id?: string;
          markets?: string[];
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ev_models_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "ev_brands";
            referencedColumns: ["id"];
          },
        ];
      };
      ev_variants: {
        Row: {
          ac_onboard_kw: number | null;
          ac_phases: number | null;
          battery_gross_kwh: number | null;
          battery_usable_kwh: number | null;
          charge_curve: Json | null;
          chemistry: string | null;
          connector_ac_id: number | null;
          connector_dc_id: number | null;
          consumption_kwh_100km: number | null;
          created_at: string;
          curb_weight_kg: number | null;
          dc_max_kw: number | null;
          field_sources: NonNullable<Json>;
          id: string;
          model_id: string;
          range_cycle: Database["public"]["Enums"]["range_cycle"] | null;
          range_km: number | null;
          status: Database["public"]["Enums"]["catalog_status"];
          submitted_by: string | null;
          trim: string;
          updated_at: string;
          year_from: number;
          year_to: number | null;
        };
        ComputedFields: never;
        Insert: {
          ac_onboard_kw?: number | null;
          ac_phases?: number | null;
          battery_gross_kwh?: number | null;
          battery_usable_kwh?: number | null;
          charge_curve?: Json | null;
          chemistry?: string | null;
          connector_ac_id?: number | null;
          connector_dc_id?: number | null;
          consumption_kwh_100km?: number | null;
          created_at?: string;
          curb_weight_kg?: number | null;
          dc_max_kw?: number | null;
          field_sources?: NonNullable<Json>;
          id?: string;
          model_id: string;
          range_cycle?: Database["public"]["Enums"]["range_cycle"] | null;
          range_km?: number | null;
          status?: Database["public"]["Enums"]["catalog_status"];
          submitted_by?: string | null;
          trim?: string;
          updated_at?: string;
          year_from: number;
          year_to?: number | null;
        };
        Update: {
          ac_onboard_kw?: number | null;
          ac_phases?: number | null;
          battery_gross_kwh?: number | null;
          battery_usable_kwh?: number | null;
          charge_curve?: Json | null;
          chemistry?: string | null;
          connector_ac_id?: number | null;
          connector_dc_id?: number | null;
          consumption_kwh_100km?: number | null;
          created_at?: string;
          curb_weight_kg?: number | null;
          dc_max_kw?: number | null;
          field_sources?: NonNullable<Json>;
          id?: string;
          model_id?: string;
          range_cycle?: Database["public"]["Enums"]["range_cycle"] | null;
          range_km?: number | null;
          status?: Database["public"]["Enums"]["catalog_status"];
          submitted_by?: string | null;
          trim?: string;
          updated_at?: string;
          year_from?: number;
          year_to?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ev_variants_connector_ac_id_fkey";
            columns: ["connector_ac_id"];
            isOneToOne: false;
            referencedRelation: "connector_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ev_variants_connector_dc_id_fkey";
            columns: ["connector_dc_id"];
            isOneToOne: false;
            referencedRelation: "connector_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ev_variants_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "ev_models";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          currency: string;
          default_charger_id: string | null;
          default_vehicle_id: string | null;
          display_name: string | null;
          id: string;
          onboarded_at: string | null;
          reserve_pct: number;
          tariff_per_kwh: number | null;
          units: Database["public"]["Enums"]["unit_system"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          default_charger_id?: string | null;
          default_vehicle_id?: string | null;
          display_name?: string | null;
          id: string;
          onboarded_at?: string | null;
          reserve_pct?: number;
          tariff_per_kwh?: number | null;
          units?: Database["public"]["Enums"]["unit_system"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          default_charger_id?: string | null;
          default_vehicle_id?: string | null;
          display_name?: string | null;
          id?: string;
          onboarded_at?: string | null;
          reserve_pct?: number;
          tariff_per_kwh?: number | null;
          units?: Database["public"]["Enums"]["unit_system"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_default_charger_fk";
            columns: ["default_charger_id"];
            isOneToOne: false;
            referencedRelation: "chargers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_default_vehicle_fk";
            columns: ["default_vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_calculations: {
        Row: {
          arrival_soc: number;
          ascent_m: number;
          consumed_pct: number;
          created_at: string;
          descent_m: number;
          dest_label: string | null;
          dest_lat: number;
          dest_lng: number;
          distance_km: number;
          duration_min: number;
          energy_kwh: number;
          engine_version: string;
          id: string;
          inputs: NonNullable<Json>;
          origin_label: string | null;
          origin_lat: number;
          origin_lng: number;
          route_polyline: string | null;
          start_soc: number;
          updated_at: string;
          user_id: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          arrival_soc: number;
          ascent_m?: number;
          consumed_pct: number;
          created_at?: string;
          descent_m?: number;
          dest_label?: string | null;
          dest_lat: number;
          dest_lng: number;
          distance_km: number;
          duration_min: number;
          energy_kwh: number;
          engine_version: string;
          id?: string;
          inputs?: NonNullable<Json>;
          origin_label?: string | null;
          origin_lat: number;
          origin_lng: number;
          route_polyline?: string | null;
          start_soc: number;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Update: {
          arrival_soc?: number;
          ascent_m?: number;
          consumed_pct?: number;
          created_at?: string;
          descent_m?: number;
          dest_label?: string | null;
          dest_lat?: number;
          dest_lng?: number;
          distance_km?: number;
          duration_min?: number;
          energy_kwh?: number;
          engine_version?: string;
          id?: string;
          inputs?: NonNullable<Json>;
          origin_label?: string | null;
          origin_lat?: number;
          origin_lng?: number;
          route_polyline?: string | null;
          start_soc?: number;
          updated_at?: string;
          user_id?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_calculations_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          battery_health_pct: number;
          created_at: string;
          id: string;
          nickname: string;
          overrides: NonNullable<Json>;
          owner_id: string;
          updated_at: string;
          variant_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          battery_health_pct?: number;
          created_at?: string;
          id?: string;
          nickname: string;
          overrides?: NonNullable<Json>;
          owner_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          battery_health_pct?: number;
          created_at?: string;
          id?: string;
          nickname?: string;
          overrides?: NonNullable<Json>;
          owner_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "ev_variants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_valid_charge_curve: { Args: { curve: Json }; Returns: boolean };
      log_audit_event: { Args: { event: string; metadata?: Json }; Returns: undefined };
      owns_charger: { Args: { charger: string }; Returns: boolean };
      owns_vehicle: { Args: { vehicle: string }; Returns: boolean };
    };
    Enums: {
      catalog_kind: "vehicle" | "charger";
      catalog_status: "pending" | "verified";
      charger_kind: "wallbox" | "portable";
      charger_use: "home" | "public";
      current_type: "AC" | "DC";
      range_cycle: "NEDC" | "WLTP" | "EPA" | "CLTC";
      submission_status: "pending" | "approved" | "rejected";
      unit_system: "metric" | "imperial";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      catalog_kind: ["vehicle", "charger"],
      catalog_status: ["pending", "verified"],
      charger_kind: ["wallbox", "portable"],
      charger_use: ["home", "public"],
      current_type: ["AC", "DC"],
      range_cycle: ["NEDC", "WLTP", "EPA", "CLTC"],
      submission_status: ["pending", "approved", "rejected"],
      unit_system: ["metric", "imperial"],
    },
  },
} as const;
