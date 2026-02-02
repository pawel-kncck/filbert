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
          ksef_hash: string | null
          ksef_status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'error' | null
          ksef_error: string | null
          ksef_sent_at: string | null
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
          ksef_hash?: string | null
          ksef_status?: 'pending' | 'sent' | 'accepted' | 'rejected' | 'error' | null
          ksef_error?: string | null
          ksef_sent_at?: string | null
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
          ksef_hash?: string | null
          ksef_status?: 'pending' | 'sent' | 'accepted' | 'rejected' | 'error' | null
          ksef_error?: string | null
          ksef_sent_at?: string | null
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
      vendors: {
        Row: {
          id: string
          company_id: string
          name: string
          nip: string | null
          address: string | null
          email: string | null
          phone: string | null
          notes: string | null
          is_synced: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          nip?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          nip?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendors_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          nip: string | null
          address: string | null
          email: string | null
          phone: string | null
          notes: string | null
          is_synced: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          nip?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          nip?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          position: number
          description: string
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
          net_amount: number
          vat_amount: number
          gross_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          position: number
          description: string
          quantity?: number
          unit?: string
          unit_price: number
          vat_rate?: number
          net_amount: number
          vat_amount: number
          gross_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          position?: number
          description?: string
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
          net_amount?: number
          vat_amount?: number
          gross_amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
        ]
      }
      company_ksef_credentials: {
        Row: {
          company_id: string
          token: string | null
          environment: 'test' | 'demo' | 'prod'
          auth_method: 'token' | 'certificate'
          certificate_pem: string | null
          encrypted_private_key: string | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          token?: string | null
          environment?: 'test' | 'demo' | 'prod'
          auth_method?: 'token' | 'certificate'
          certificate_pem?: string | null
          encrypted_private_key?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          token?: string | null
          environment?: 'test' | 'demo' | 'prod'
          auth_method?: 'token' | 'certificate'
          certificate_pem?: string | null
          encrypted_private_key?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'company_ksef_credentials_company_id_fkey'
            columns: ['company_id']
            isOneToOne: true
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
      get_missing_vendors_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_missing_vendors: {
        Args: { p_company_id: string }
        Returns: { name: string; nip: string | null }[]
      }
      get_missing_customers_count: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_missing_customers: {
        Args: { p_company_id: string }
        Returns: { name: string; nip: string | null }[]
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

export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type UserCompany = Database['public']['Tables']['user_companies']['Row']
export type UserCompanyInsert = Database['public']['Tables']['user_companies']['Insert']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type Vendor = Database['public']['Tables']['vendors']['Row']
export type VendorInsert = Database['public']['Tables']['vendors']['Insert']
export type VendorUpdate = Database['public']['Tables']['vendors']['Update']
export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert']
export type InvoiceItemUpdate = Database['public']['Tables']['invoice_items']['Update']
export type KsefCredentials = Database['public']['Tables']['company_ksef_credentials']['Row']
export type KsefCredentialsInsert =
  Database['public']['Tables']['company_ksef_credentials']['Insert']
export type KsefCredentialsUpdate =
  Database['public']['Tables']['company_ksef_credentials']['Update']
