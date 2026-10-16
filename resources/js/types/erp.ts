export type RFQStatus = 'masuk' | 'diproses' | 'penawaran_terkirim' | 'deal' | 'ditolak' | 'deleted' | 'in_progress' | 'batal';

export interface EmailAttachment {
  id: string;
  filename: string;
  filesize: string;
  filetype: string;
  url: string;
  part?: string;
  extension?: string;
  is_gdrive?: boolean;
  is_folder?: boolean;
  downloaded?: boolean;
  original_url?: string;
}

export interface RFQ {
  id: string;
  sender_name: string;
  sender_email: string;
  company: string;
  phone?: string;
  subject: string;
  message_body: string;
  original_body?: string;
  item_requested: string;
  quantity_requested?: string;
  budget_estimate?: string;
  date_received: string;
  status: RFQStatus;
  is_blacklisted?: number | boolean;
  blacklist_reason?: string;
  ai_verified?: number;
  ai_classification?: string;
  ai_error?: string | null;
  labels?: string[];
  attachments?: EmailAttachment[];
  notes?: string;
  msgno?: number;
  recipient_email?: string;
  replies?: Array<{ body: string; date: string; sender: string }>;
}

export interface QuotationItem {
  id: string;
  product_code?: string;
  category_code?: string | null;
  impa_code?: string | null;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  total: number;
  image_url?: string;
  item_code?: string;
  qty?: number;
}


export type QuotationStatus = 'draft' | 'terkirim' | 'disetujui' | 'ditolak' | 'siap_kirim' | 'quotation_build' | 'penawaran_terkirim' | 'deal' | 'masuk' | 'diproses';

export interface Quotation {
  id: string;
  rfq_id?: string;
  quotation_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  company_name: string;
  company_address?: string;
  date_issued: string;
  valid_until?: string;
  items: QuotationItem[];
  subtotal: number;
  discount_total: number;
  tax_percent: number;
  tax_amount: number;
  grand_total: number;
  currency?: string;
  notes?: string;
  terms_conditions?: string;
  status: QuotationStatus;
  created_by?: string;
  created_at?: string;
  history_log?: string;
  total_items_count?: number;
  unregistered_items_count?: number;
  items_details?: QuotationItem[];
  email_source?: {
    id: number;
    rfq_number: string;
    sender_name: string;
    sender_email: string;
    subject: string;
    message_body: string;
    attachment_url: string;
    created_at: string;
  } | null;
  ocr_scan_status?: 'pending' | 'processing' | 'done' | 'error' | 'skipped' | 'waiting_ai_limit' | 'waiting' | null;
  ocr_scan_result?: string | null; // JSON string
  approved_by?: string | null; // JSON string — array of approval entries
  category_name?: string | null;
  impa_code?: string | null;
}


export interface EmailReplyPayload {
  to: string;
  subject: string;
  body: string;
  quotation_number: string;
  attach_pdf: boolean;
}

export type UserRole = 'Admin' | 'Karyawan';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  encryption: 'tls' | 'ssl';
  username: string;
  app_password: string;
  from_name: string;
  from_email: string;
  is_connected: boolean;
  email?: string;
}
