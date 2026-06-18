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
      academic_years: {
        Row: {
          buffer_days: number
          created_at: string
          end_date: string
          id: string
          label: string
          lunch_end_time: string | null
          lunch_start_time: string | null
          org_id: string
          period_duration_minutes: number
          periods_per_day: number
          school_end_time: string | null
          school_id: string
          school_start_time: string | null
          senior_extra_classes: Json
          start_date: string
          status: string
          updated_at: string
          weekly_off_days: number[]
          working_days_per_week: number
        }
        Insert: {
          buffer_days?: number
          created_at?: string
          end_date: string
          id?: string
          label: string
          lunch_end_time?: string | null
          lunch_start_time?: string | null
          org_id: string
          period_duration_minutes?: number
          periods_per_day?: number
          school_end_time?: string | null
          school_id: string
          school_start_time?: string | null
          senior_extra_classes?: Json
          start_date: string
          status?: string
          updated_at?: string
          weekly_off_days?: number[]
          working_days_per_week?: number
        }
        Update: {
          buffer_days?: number
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          lunch_end_time?: string | null
          lunch_start_time?: string | null
          org_id?: string
          period_duration_minutes?: number
          periods_per_day?: number
          school_end_time?: string | null
          school_id?: string
          school_start_time?: string | null
          senior_extra_classes?: Json
          start_date?: string
          status?: string
          updated_at?: string
          weekly_off_days?: number[]
          working_days_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      ai_credit_grants: {
        Row: {
          created_at: string
          credits_granted: number
          credits_remaining: number
          environment: string
          id: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_granted: number
          credits_remaining: number
          environment?: string
          id?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_granted?: number
          credits_remaining?: number
          environment?: string
          id?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          action: string
          created_at: string
          credits_spent: number
          details: Json
          error: string | null
          id: string
          lovable_run_id: string | null
          status: string
          user_id: string
          year_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          credits_spent?: number
          details?: Json
          error?: string | null
          id?: string
          lovable_run_id?: string | null
          status?: string
          user_id: string
          year_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          credits_spent?: number
          details?: Json
          error?: string | null
          id?: string
          lovable_run_id?: string | null
          status?: string
          user_id?: string
          year_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_calendars: {
        Row: {
          created_at: string
          id: string
          meta: Json
          plan: Json
          updated_at: string
          user_id: string
          year_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          plan?: Json
          updated_at?: string
          user_id: string
          year_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          plan?: Json
          updated_at?: string
          user_id?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_calendars_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: true
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_results: {
        Row: {
          academic_year_id: string
          b_buffer: number
          c_total: number
          computed_at: string
          e_events: number
          h_gov: number
          h_school: number
          id: string
          org_id: string
          t_available: number
          t_training: number
          total_periods_available: number
          v_vacation: number
          w_offs: number
          x_exams: number
        }
        Insert: {
          academic_year_id: string
          b_buffer?: number
          c_total: number
          computed_at?: string
          e_events?: number
          h_gov?: number
          h_school?: number
          id?: string
          org_id: string
          t_available: number
          t_training?: number
          total_periods_available: number
          v_vacation?: number
          w_offs?: number
          x_exams?: number
        }
        Update: {
          academic_year_id?: string
          b_buffer?: number
          c_total?: number
          computed_at?: string
          e_events?: number
          h_gov?: number
          h_school?: number
          id?: string
          org_id?: string
          t_available?: number
          t_training?: number
          total_periods_available?: number
          v_vacation?: number
          w_offs?: number
          x_exams?: number
        }
        Relationships: [
          {
            foreignKeyName: "capacity_results_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_versions: {
        Row: {
          created_at: string
          created_by: string | null
          diff_summary: string | null
          entity_type: string
          grade: string | null
          id: string
          meta: Json
          org_id: string
          payload: Json
          source: string
          subject: string | null
          version_no: number
          year_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diff_summary?: string | null
          entity_type: string
          grade?: string | null
          id?: string
          meta?: Json
          org_id: string
          payload: Json
          source?: string
          subject?: string | null
          version_no: number
          year_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diff_summary?: string | null
          entity_type?: string
          grade?: string | null
          id?: string
          meta?: Json
          org_id?: string
          payload?: Json
          source?: string
          subject?: string | null
          version_no?: number
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_versions_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      disruptions: {
        Row: {
          affected_grades: string[]
          affected_sections: string[]
          applied_version_id: string | null
          category: string
          created_at: string
          end_date: string | null
          id: string
          lost_days: number
          lost_periods: number
          notes: string | null
          org_id: string
          reason: string
          reported_by: string | null
          school_id: string
          start_date: string | null
          status: string
          updated_at: string
          year_id: string
        }
        Insert: {
          affected_grades?: string[]
          affected_sections?: string[]
          applied_version_id?: string | null
          category?: string
          created_at?: string
          end_date?: string | null
          id?: string
          lost_days?: number
          lost_periods?: number
          notes?: string | null
          org_id: string
          reason: string
          reported_by?: string | null
          school_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year_id: string
        }
        Update: {
          affected_grades?: string[]
          affected_sections?: string[]
          applied_version_id?: string | null
          category?: string
          created_at?: string
          end_date?: string | null
          id?: string
          lost_days?: number
          lost_periods?: number
          notes?: string | null
          org_id?: string
          reason?: string
          reported_by?: string | null
          school_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disruptions_applied_version_id_fkey"
            columns: ["applied_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disruptions_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          org_id: string
          prep_days: number
          start_date: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          org_id: string
          prep_days?: number
          start_date: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          org_id?: string
          prep_days?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_windows: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          org_id: string
          start_date: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          org_id: string
          start_date: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          org_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_windows_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_windows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_subjects: {
        Row: {
          academic_year_id: string
          completed_chapters: string | null
          created_at: string
          grade: string
          id: string
          kind: string
          org_id: string
          periods_per_week: number
          stream: string | null
          subject: string
          teacher_name: string | null
          weekdays: number[]
        }
        Insert: {
          academic_year_id: string
          completed_chapters?: string | null
          created_at?: string
          grade: string
          id?: string
          kind?: string
          org_id: string
          periods_per_week?: number
          stream?: string | null
          subject: string
          teacher_name?: string | null
          weekdays?: number[]
        }
        Update: {
          academic_year_id?: string
          completed_chapters?: string | null
          created_at?: string
          grade?: string
          id?: string
          kind?: string
          org_id?: string
          periods_per_week?: number
          stream?: string | null
          subject?: string
          teacher_name?: string | null
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "grade_subjects_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_subjects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          academic_year_id: string
          created_at: string
          date: string
          id: string
          name: string
          org_id: string
          scope: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          date: string
          id?: string
          name: string
          org_id: string
          scope?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          org_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          board: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          school_name: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          board?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          school_name?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          board?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          school_name?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      plan_usage: {
        Row: {
          ai_credits_used: number
          created_at: string
          exports_used: number
          id: string
          period_month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_credits_used?: number
          created_at?: string
          exports_used?: number
          id?: string
          period_month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_credits_used?: number
          created_at?: string
          exports_used?: number
          id?: string
          period_month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          referred_by_partner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          referred_by_partner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          referred_by_partner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_attributions: {
        Row: {
          attributed_at: string
          code_used: string
          id: string
          is_house_fallback: boolean
          org_id: string
          partner_id: string
          source_url: string | null
        }
        Insert: {
          attributed_at?: string
          code_used: string
          id?: string
          is_house_fallback?: boolean
          org_id: string
          partner_id: string
          source_url?: string | null
        }
        Update: {
          attributed_at?: string
          code_used?: string
          id?: string
          is_house_fallback?: boolean
          org_id?: string
          partner_id?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_attributions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          accrued_at: string
          commission_cents: number
          commission_rate: number
          currency: string
          gross_amount_cents: number
          id: string
          notes: string | null
          org_id: string
          paid_at: string | null
          partner_id: string
          payout_id: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string
        }
        Insert: {
          accrued_at?: string
          commission_cents: number
          commission_rate?: number
          currency?: string
          gross_amount_cents: number
          id?: string
          notes?: string | null
          org_id: string
          paid_at?: string | null
          partner_id: string
          payout_id?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id: string
        }
        Update: {
          accrued_at?: string
          commission_cents?: number
          commission_rate?: number
          currency?: string
          gross_amount_cents?: number
          id?: string
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          partner_id?: string
          payout_id?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_enforcement_actions: {
        Row: {
          action: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_url: string | null
          forfeited_amount_cents: number | null
          id: string
          notice_text: string | null
          partner_id: string
          reason_category: string
          responded_at: string | null
          response_due_at: string | null
          response_text: string | null
        }
        Insert: {
          action: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          forfeited_amount_cents?: number | null
          id?: string
          notice_text?: string | null
          partner_id: string
          reason_category: string
          responded_at?: string | null
          response_due_at?: string | null
          response_text?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          forfeited_amount_cents?: number | null
          id?: string
          notice_text?: string | null
          partner_id?: string
          reason_category?: string
          responded_at?: string | null
          response_due_at?: string | null
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_enforcement_actions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_house: boolean
          nda_accepted_at: string | null
          payout_email: string | null
          payout_method: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_house?: boolean
          nda_accepted_at?: string | null
          payout_email?: string | null
          payout_method?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_house?: boolean
          nda_accepted_at?: string | null
          payout_email?: string | null
          payout_method?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referral_payouts: {
        Row: {
          created_at: string
          currency: string
          external_ref: string | null
          id: string
          paid_at: string | null
          partner_id: string
          period_end: string
          period_start: string
          provider: string
          status: string
          total_cents: number
        }
        Insert: {
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          paid_at?: string | null
          partner_id: string
          period_end: string
          period_start: string
          provider?: string
          status?: string
          total_cents: number
        }
        Update: {
          created_at?: string
          currency?: string
          external_ref?: string | null
          id?: string
          paid_at?: string | null
          partner_id?: string
          period_end?: string
          period_start?: string
          provider?: string
          status?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          board: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string | null
          fee_tier: string | null
          id: string
          latitude: number | null
          longitude: number | null
          monthly_fee_per_student: number | null
          name: string
          org_id: string
          region: string | null
          state_province: string | null
          updated_at: string
        }
        Insert: {
          board?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          fee_tier?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          monthly_fee_per_student?: number | null
          name: string
          org_id: string
          region?: string | null
          state_province?: string | null
          updated_at?: string
        }
        Update: {
          board?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          fee_tier?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          monthly_fee_per_student?: number | null
          name?: string
          org_id?: string
          region?: string | null
          state_province?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_curricula: {
        Row: {
          chapters: Json
          created_at: string
          deleted_at: string | null
          grade: string
          id: string
          meta: Json
          subject: string
          updated_at: string
          user_id: string
          year_id: string
        }
        Insert: {
          chapters?: Json
          created_at?: string
          deleted_at?: string | null
          grade: string
          id?: string
          meta?: Json
          subject: string
          updated_at?: string
          user_id: string
          year_id: string
        }
        Update: {
          chapters?: Json
          created_at?: string
          deleted_at?: string | null
          grade?: string
          id?: string
          meta?: Json
          subject?: string
          updated_at?: string
          user_id?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_curricula_year_id_fkey"
            columns: ["year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          extra_seats: number
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          extra_seats?: number
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          extra_seats?: number
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by: string | null
          grade: string
          id: string
          org_id: string
          school_id: string
          section: string | null
          subject: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by?: string | null
          grade: string
          id?: string
          org_id: string
          school_id: string
          section?: string | null
          subject: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by?: string | null
          grade?: string
          id?: string
          org_id?: string
          school_id?: string
          section?: string | null
          subject?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks_input: {
        Row: {
          ai_recommended: boolean
          author: string | null
          created_at: string
          edition_year: number | null
          grade_subject_id: string
          id: string
          org_id: string
          publisher: string | null
          title: string | null
        }
        Insert: {
          ai_recommended?: boolean
          author?: string | null
          created_at?: string
          edition_year?: number | null
          grade_subject_id: string
          id?: string
          org_id: string
          publisher?: string | null
          title?: string | null
        }
        Update: {
          ai_recommended?: boolean
          author?: string | null
          created_at?: string
          edition_year?: number | null
          grade_subject_id?: string
          id?: string
          org_id?: string
          publisher?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textbooks_input_grade_subject_id_fkey"
            columns: ["grade_subject_id"]
            isOneToOne: false
            referencedRelation: "grade_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textbooks_input_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_days: {
        Row: {
          academic_year_id: string
          created_at: string
          date: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          date: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_days_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacation_breaks: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          org_id: string
          start_date: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          org_id: string
          start_date: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          org_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_breaks_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_breaks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_curriculum_version: {
        Args: {
          _created_by: string
          _diff_summary: string
          _entity_type: string
          _grade: string
          _meta: Json
          _payload: Json
          _source: string
          _subject: string
          _year_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          diff_summary: string | null
          entity_type: string
          grade: string | null
          id: string
          meta: Json
          org_id: string
          payload: Json
          source: string
          subject: string | null
          version_no: number
          year_id: string
        }
        SetofOptions: {
          from: "*"
          to: "curriculum_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_ai_credits: {
        Args: {
          _check_env?: string
          _cost: number
          _monthly_quota: number
          _user_id: string
        }
        Returns: number
      }
      get_ai_credit_balance: {
        Args: { _check_env?: string; _monthly_quota: number; _user_id: string }
        Returns: Json
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      record_export: { Args: { _user_id: string }; Returns: number }
      refund_ai_credits: {
        Args: { _amount: number; _check_env?: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "super_admin" | "coordinator" | "viewer"
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
      app_role: ["admin", "teacher", "super_admin", "coordinator", "viewer"],
    },
  },
} as const
