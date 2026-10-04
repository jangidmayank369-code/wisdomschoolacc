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
      academic_sessions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      driver_km_logs: {
        Row: {
          change_reason: string | null
          created_at: string
          date: string
          id: string
          is_auto: boolean
          is_override: boolean
          km: number
          recorded_by: string | null
          remarks: string | null
          session_id: string
          staff_id: string
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          date: string
          id?: string
          is_auto?: boolean
          is_override?: boolean
          km: number
          recorded_by?: string | null
          remarks?: string | null
          session_id: string
          staff_id: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          date?: string
          id?: string
          is_auto?: boolean
          is_override?: boolean
          km?: number
          recorded_by?: string | null
          remarks?: string | null
          session_id?: string
          staff_id?: string
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_km_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_km_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_km_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      fee_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      fee_payments: {
        Row: {
          amount: number
          category_id: string | null
          category_name: string | null
          change_reason: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          id: string
          is_reversed: boolean
          mode: string
          payment_date: string
          receipt_no: string
          received_by: string | null
          reference: string | null
          remarks: string | null
          reversal_reason: string | null
          session_id: string
          student_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          category_name?: string | null
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          mode?: string
          payment_date?: string
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id: string
          student_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          category_name?: string | null
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          mode?: string
          payment_date?: string
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_rates: {
        Row: {
          change_reason: string | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          fuel_type: string
          id: string
          month: string
          rate_per_litre: number
          session_id: string
          status: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          fuel_type?: string
          id?: string
          month: string
          rate_per_litre: number
          session_id: string
          status?: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          fuel_type?: string
          id?: string
          month?: string
          rate_per_litre?: number
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_rates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          duplicates: number
          errors: Json | null
          failed: number
          file_name: string | null
          id: string
          module: string
          status: string
          successful: number
          total_rows: number
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duplicates?: number
          errors?: Json | null
          failed?: number
          file_name?: string | null
          id?: string
          module: string
          status?: string
          successful?: number
          total_rows?: number
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duplicates?: number
          errors?: Json | null
          failed?: number
          file_name?: string | null
          id?: string
          module?: string
          status?: string
          successful?: number
          total_rows?: number
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      income_categories: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          from_date: string
          id: string
          reason: string
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string
          staff_id: string
          status: string
          to_date: string
        }
        Insert: {
          created_at?: string
          from_date: string
          id?: string
          reason: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id: string
          staff_id: string
          status?: string
          to_date: string
        }
        Update: {
          created_at?: string
          from_date?: string
          id?: string
          reason?: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          staff_id?: string
          status?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_expenses: {
        Row: {
          amount: number
          bill_no: string | null
          category: string | null
          change_reason: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_reversed: boolean
          location: string | null
          mode: string
          paid_by: string | null
          remarks: string | null
          reversal_reason: string | null
          session_id: string
          vendor: string | null
          work: string
        }
        Insert: {
          amount: number
          bill_no?: string | null
          category?: string | null
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_reversed?: boolean
          location?: string | null
          mode?: string
          paid_by?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id: string
          vendor?: string | null
          work: string
        }
        Update: {
          amount?: number
          bill_no?: string | null
          category?: string | null
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_reversed?: boolean
          location?: string | null
          mode?: string
          paid_by?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id?: string
          vendor?: string | null
          work?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      master_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: []
      }
      monthly_vehicle_km: {
        Row: {
          change_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          month: string
          remarks: string | null
          session_id: string
          staff_id: string
          total_km: number
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          remarks?: string | null
          session_id: string
          staff_id: string
          total_km: number
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          remarks?: string | null
          session_id?: string
          staff_id?: string
          total_km?: number
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_vehicle_km_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_vehicle_km_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_vehicle_km_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          absent_days: number | null
          change_reason: string | null
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          half_days: number | null
          id: string
          leave_days: number | null
          month: string
          payable_days: number | null
          present_days: number | null
          remarks: string | null
          salary_due: number
          session_id: string
          staff_id: string
        }
        Insert: {
          absent_days?: number | null
          change_reason?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          half_days?: number | null
          id?: string
          leave_days?: number | null
          month: string
          payable_days?: number | null
          present_days?: number | null
          remarks?: string | null
          salary_due: number
          session_id: string
          staff_id: string
        }
        Update: {
          absent_days?: number | null
          change_reason?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          half_days?: number | null
          id?: string
          leave_days?: number | null
          month?: string
          payable_days?: number | null
          present_days?: number | null
          remarks?: string | null
          salary_due?: number
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          mobile: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          mobile?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          mobile?: string | null
          username?: string | null
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          address: string | null
          email: string | null
          id: number
          logo_url: string | null
          phone: string | null
          receipt_footer: string | null
          school_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          school_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          receipt_footer?: string | null
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          employee_id: string
          gender: string | null
          id: string
          mobile: string | null
          name: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          employee_id: string
          gender?: string | null
          id?: string
          mobile?: string | null
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          employee_id?: string
          gender?: string | null
          id?: string
          mobile?: string | null
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          change_reason: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          remarks: string | null
          session_id: string
          staff_id: string
          status: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          remarks?: string | null
          session_id: string
          staff_id: string
          status: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          remarks?: string | null
          session_id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payments: {
        Row: {
          amount: number
          calculated_amount: number | null
          change_reason: string | null
          client_token: string | null
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_reversed: boolean
          mode: string
          paid_by: string | null
          payment_date: string
          payroll_month: string
          reference: string | null
          remarks: string | null
          reversal_reason: string | null
          salary_days: number | null
          session_id: string
          staff_id: string
        }
        Insert: {
          amount: number
          calculated_amount?: number | null
          change_reason?: string | null
          client_token?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          mode?: string
          paid_by?: string | null
          payment_date?: string
          payroll_month: string
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          salary_days?: number | null
          session_id: string
          staff_id: string
        }
        Update: {
          amount?: number
          calculated_amount?: number | null
          change_reason?: string | null
          client_token?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_reversed?: boolean
          mode?: string
          paid_by?: string | null
          payment_date?: string
          payroll_month?: string
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          salary_days?: number | null
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_sessions: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          designation: string
          exit_date: string | null
          id: string
          joining_date: string | null
          monthly_salary: number
          optional_role: string | null
          remarks: string | null
          session_id: string
          staff_id: string
          status: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string
          exit_date?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          optional_role?: string | null
          remarks?: string | null
          session_id: string
          staff_id: string
          status?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string
          exit_date?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          optional_role?: string | null
          remarks?: string | null
          session_id?: string
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      student_charges: {
        Row: {
          amount: number
          category_id: string
          category_name: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          installment: string | null
          remarks: string | null
          session_id: string
          student_id: string
        }
        Insert: {
          amount: number
          category_id: string
          category_name?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          installment?: string | null
          remarks?: string | null
          session_id: string
          student_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          category_name?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          installment?: string | null
          remarks?: string | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_charges_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_charges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          class: string
          created_at: string
          created_by: string | null
          enrollment_date: string | null
          id: string
          remarks: string | null
          roll_no: string | null
          section: string | null
          session_id: string
          status: string
          student_id: string
          transport_route: string | null
        }
        Insert: {
          class: string
          created_at?: string
          created_by?: string | null
          enrollment_date?: string | null
          id?: string
          remarks?: string | null
          roll_no?: string | null
          section?: string | null
          session_id: string
          status?: string
          student_id: string
          transport_route?: string | null
        }
        Update: {
          class?: string
          created_at?: string
          created_by?: string | null
          enrollment_date?: string | null
          id?: string
          remarks?: string | null
          roll_no?: string | null
          section?: string | null
          session_id?: string
          status?: string
          student_id?: string
          transport_route?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          admission_no: string
          created_at: string
          dob: string | null
          father_name: string | null
          gender: string | null
          id: string
          mother_name: string | null
          name: string
          phone: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          admission_no: string
          created_at?: string
          dob?: string | null
          father_name?: string | null
          gender?: string | null
          id?: string
          mother_name?: string | null
          name: string
          phone?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          admission_no?: string
          created_at?: string
          dob?: string | null
          father_name?: string | null
          gender?: string | null
          id?: string
          mother_name?: string | null
          name?: string
          phone?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          change_reason: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_reversed: boolean
          mode: string | null
          party: string | null
          reference: string | null
          remarks: string | null
          reversal_reason: string | null
          session_id: string
          source_id: string | null
          source_module: string
          type: string
        }
        Insert: {
          amount: number
          category: string
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_reversed?: boolean
          mode?: string | null
          party?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id: string
          source_id?: string | null
          source_module?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_reversed?: boolean
          mode?: string | null
          party?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id?: string
          source_id?: string | null
          source_module?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_expenses: {
        Row: {
          amount: number
          change_reason: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          date: string
          expense_type: string
          id: string
          is_reversed: boolean
          mode: string
          paid_by: string | null
          reference: string | null
          remarks: string | null
          reversal_reason: string | null
          session_id: string
          staff_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          expense_type?: string
          id?: string
          is_reversed?: boolean
          mode?: string
          paid_by?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id: string
          staff_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          change_reason?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          expense_type?: string
          id?: string
          is_reversed?: boolean
          mode?: string
          paid_by?: string | null
          reference?: string | null
          remarks?: string | null
          reversal_reason?: string | null
          session_id?: string
          staff_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicle_assignments: {
        Row: {
          created_at: string
          effective_from: string | null
          fuel_rate_per_km: number
          id: string
          remarks: string | null
          route: string | null
          session_id: string
          staff_id: string
          status: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          fuel_rate_per_km?: number
          id?: string
          remarks?: string | null
          route?: string | null
          session_id: string
          staff_id: string
          status?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          fuel_rate_per_km?: number
          id?: string
          remarks?: string | null
          route?: string | null
          session_id?: string
          staff_id?: string
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_km_defaults: {
        Row: {
          created_at: string
          created_by: string | null
          daily_km: number
          effective_from: string
          effective_to: string | null
          id: string
          remarks: string | null
          session_id: string | null
          start_odometer: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_km: number
          effective_from: string
          effective_to?: string | null
          id?: string
          remarks?: string | null
          session_id?: string | null
          start_odometer?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_km?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          remarks?: string | null
          session_id?: string | null
          start_odometer?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_km_defaults_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_km_defaults_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity: number | null
          created_at: string
          fuel_average_kmpl: number | null
          id: string
          model: string | null
          registration: string | null
          status: string
          type: string | null
          vehicle_no: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          fuel_average_kmpl?: number | null
          id?: string
          model?: string | null
          registration?: string | null
          status?: string
          type?: string | null
          vehicle_no: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          fuel_average_kmpl?: number | null
          id?: string
          model?: string | null
          registration?: string | null
          status?: string
          type?: string | null
          vehicle_no?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_student_balances: {
        Row: {
          admission_no: string | null
          class: string | null
          father_name: string | null
          name: string | null
          phone: string | null
          roll_no: string | null
          section: string | null
          session_id: string | null
          status: string | null
          student_id: string | null
          student_session_id: string | null
          total_charges: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_km_logs: { Args: { _upto?: string }; Returns: number }
      has_any_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_finance: { Args: never; Returns: boolean }
      my_staff_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "accountant" | "staff"
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
      app_role: ["admin", "accountant", "staff"],
    },
  },
} as const
