import { RFQ, Quotation, UserAccount } from '../types/erp';

// 100% CLEAN MYSQL DATABASE SCHEMAS (ZERO FAKE DATA POLICY)
export const initialRFQs: RFQ[] = [];
export const initialUsers: UserAccount[] = [];

export const sampleQuotation: Quotation = {
  id: '',
  rfq_id: '',
  quotation_number: '',
  client_name: '',
  client_email: '',
  company_name: '',
  company_address: '',
  date_issued: new Date().toISOString().split('T')[0],
  valid_until: '',
  items: [],
  subtotal: 0,
  discount_total: 0,
  tax_percent: 11,
  tax_amount: 0,
  grand_total: 0,
  currency: 'MYR',
  notes: '',
  terms_conditions: '',
  status: 'draft',
  created_by: ''
};
