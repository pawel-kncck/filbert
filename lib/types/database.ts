export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          nip: string
          is_demo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          nip: string
          is_demo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          nip?: string
          is_demo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          user_id: string
          company_id: string
          role: 'admin' | 'member' | 'viewer'
          status: 'active' | 'pending'
          created_at: string
        }
        Insert: {
          user_id: string
          company_id: string
          role?: 'admin' | 'member' | 'viewer'
          status?: 'active' | 'pending'
          created_at?: string
        }
        Update: {
          user_id?: string
          company_id?: string
          role?: 'admin' | 'member' | 'viewer'
          status?: 'active' | 'pending'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_companies_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          type: 'sales' | 'purchase'
          invoice_number: string
          issue_date: string
          vendor_name: string
          vendor_nip: string | null
          customer_name: string
          customer_nip: string | null
          net_amount: number
          vat_amount: number
          gross_amount: number
          currency: string
          ksef_reference: string | null
          source: 'manual' | 'demo' | 'ksef'
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: 'sales' | 'purchase'
          invoice_number: string
          issue_date: string
          vendor_name: string
          vendor_nip?: string | null
          customer_name: string
          customer_nip?: string | null
          net_amount: number
          vat_amount: number
          gross_amount: number
          currency?: string
          ksef_reference?: string | null
          source?: 'manual' | 'demo' | 'ksef'
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: 'sales' | 'purchase'
          invoice_number?: string
          issue_date?: string
          vendor_name?: string
          vendor_nip?: string | null
          customer_name?: string
          customer_nip?: string | null
          net_amount?: number
          vat_amount?: number
          gross_amount?: number
          currency?: string
          ksef_reference?: string | null
          source?: 'manual' | 'demo' | 'ksef'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type UserCompany = Database['public']['Tables']['user_companies']['Row']
export type UserCompanyInsert = Database['public']['Tables']['user_companies']['Insert']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
