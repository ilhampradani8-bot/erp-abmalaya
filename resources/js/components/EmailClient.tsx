import React, { useState, useEffect, useRef } from 'react';
import { Quotation, RFQ } from '../types/erp';
import { 
  Send, CheckCircle2, X, Loader2, Sparkles, Clock,
  FileType, FileText, Search, Plus, Edit3, Building, Mail, Info, MapPin,
  Paperclip, CheckCheck, Menu, CornerUpLeft, Eye, MoreVertical, Maximize2
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

export interface ClientData {
  id?: number;
  company_name: string;
  client_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  logo_url?: string;
  notes?: string;
}

export interface EmailClientProps {
  rfq?: RFQ | null;
  quotation?: Quotation | null;
  quotationsList?: Quotation[];
  rfqList?: RFQ[];
  onClose?: () => void;
  onSuccessSend?: (replyBody: string, replySender?: string) => void;
  isModalMode?: boolean;
}

export interface CompanyGroup {
  companyKey: string;
  companyName: string;
  primaryClientName: string;
  primaryEmail: string;
  emailList: string[];
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId: string;
  logoUrl?: string;
  notes: string;
  dbClientId?: number;
  lastActivity: string;
  quotations: Quotation[];
  rfqs: RFQ[];
  repliedMessagesCount: number;
}

// Public domain email set to prevent over-grouping public emails
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 
  'live.com', 'ymail.com', 'aol.com', 'mail.com', 'protonmail.com', 'zoho.com'
]);

// Helper to extract domain-based company key & formatted company name
export const extractCompanyInfoFromEmail = (
  email?: string, 
  fallbackCompany?: string
): { companyKey: string; companyName: string } => {
  const normFallback = (fallbackCompany || '').trim();
  const cleanEmail = cleanSingleEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const fallbackName = normFallback || 'Unassigned Client';
    return { companyKey: fallbackName.toLowerCase(), companyName: fallbackName };
  }

  const parts = cleanEmail.trim().toLowerCase().split('@');
  const domain = parts[1] || '';

  if (PUBLIC_DOMAINS.has(domain)) {
    const key = (normFallback !== '' ? normFallback : parts[0]).toLowerCase();
    const name = normFallback !== '' ? normFallback : parts[0].toUpperCase();
    return { companyKey: key, companyName: name };
  }

  // Corporate domain: e.g. @mijdigital.my or @abmalaya.com
  const domainParts = domain.split('.');
  const rawBrand = domainParts[0] || domain;
  const companyName = normFallback !== '' ? normFallback : rawBrand.toUpperCase();

  return { companyKey: domain, companyName };
};

// Helper to parse multiple comma/line-separated or JSON formatted email addresses
export const parseEmails = (emailStr?: string): string[] => {
  if (!emailStr) return [];
  const trimmed = emailStr.trim();

  // 1. JSON parsing for objects or arrays
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsedData = JSON.parse(trimmed);
      const collected: string[] = [];
      if (parsedData.selected && typeof parsedData.selected === 'string') {
        collected.push(...parseEmails(parsedData.selected));
      }
      if (Array.isArray(parsedData.options)) {
        parsedData.options.forEach((opt: any) => {
          if (opt && typeof opt.email === 'string') {
            collected.push(...parseEmails(opt.email));
          }
        });
      }
      if (Array.isArray(parsedData)) {
        parsedData.forEach((item: any) => {
          if (typeof item === 'string') collected.push(...parseEmails(item));
          else if (item && typeof item.email === 'string') collected.push(...parseEmails(item.email));
        });
      }
      if (collected.length > 0) {
        return Array.from(new Set(collected.filter((e) => e && e.includes('@'))));
      }
    } catch (e) {
      // fallback to regex if JSON parse fails
    }
  }

  // 2. Regex matching for embedded email patterns
  const regexMatches = emailStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (regexMatches && regexMatches.length > 0) {
    return Array.from(new Set(regexMatches.map((e) => e.trim())));
  }

  // 3. Delimited fallback
  const list = emailStr
    .split(/[,;\n]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'));
  return Array.from(new Set(list));
};

// Helper to get a clean single email string (guaranteed never to return raw JSON)
export const cleanSingleEmail = (emailStr?: string): string => {
  if (!emailStr) return '';
  const parsed = parseEmails(emailStr);
  return parsed[0] || (emailStr.includes('@') ? emailStr.replace(/[{}"\\]/g, '').trim() : '');
};

// Helper to clean raw email body (strip MIME boundaries, CSS, base64 strings)
const cleanEmailBodyText = (text?: string): string => {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/boundary="[^"]*"/gi, '');
  cleaned = cleaned.replace(/boundary=[a-zA-Z0-9-@._]+/gi, '');
  cleaned = cleaned.replace(/content-type:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-transfer-encoding:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-description:[^\n]*/gi, '');
  cleaned = cleaned.replace(/creation-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/modification-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/content-id:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-disposition:[^\n]*/gi, '');
  cleaned = cleaned.replace(/\[cid:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/cid:[a-zA-Z0-9-@.]+/gi, '');
  cleaned = cleaned.replace(/[a-zA-Z0-9_#.,\s-]+\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');

  const lines = cleaned.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length > 40 && !trimmed.includes(' ') && /^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
      return false;
    }
    return true;
  });

  return filteredLines.join('\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
};

// Helper to extract 2-letter avatar initials for WhatsApp-style profile picture
const getCompanyInitials = (name?: string): string => {
  if (!name) return 'CP';
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
};

// Dynamic Company / Email Avatar component with official domain logo resolution & graceful initial fallback
const CompanyAvatar: React.FC<{
  email?: string;
  name?: string;
  logoUrl?: string;
  className?: string;
  size?: number;
}> = ({ email = '', name = '', logoUrl = '', className = 'w-10 h-10', size = 128 }) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Extract domain from email (e.g. user@petronas.com -> petronas.com)
  const domain = email && email.includes('@') ? email.split('@')[1]?.trim().toLowerCase() : '';
  const isGenericDomain = !domain || /gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\.|mail\.ru/i.test(domain);

  // Prioritize saved database logoUrl first if present, then Google Favicon 128px for corporate domains, or Unavatar
  const targetLogoUrl = logoUrl || (!isGenericDomain && domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
    : (email && email.includes('@') ? `https://unavatar.io/${encodeURIComponent(email)}?fallback=false` : null));

  const initials = getCompanyInitials(name || domain || 'CP');

  if (targetLogoUrl && !imgFailed) {
    return (
      <div className={`${className} rounded-full overflow-hidden shrink-0 bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-xs`}>
        <img
          src={targetLogoUrl}
          alt={name || 'Company Logo'}
          className="w-full h-full object-contain rounded-full"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`${className} bg-gradient-to-tr from-blue-700 to-indigo-600 text-white rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs uppercase tracking-wider`}>
      {initials}
    </div>
  );
};

export const EmailClient: React.FC<EmailClientProps> = ({
  rfq,
  quotation,
  quotationsList = [],
  rfqList = [],
  onClose,
  onSuccessSend,
  isModalMode = true,
}) => {
  // 1. Fetch clients & fallback quotations from MySQL API
  const [dbClients, setDbClients] = useState<ClientData[]>([]);
  const [internalQuotations, setInternalQuotations] = useState<Quotation[]>([]);
  const [isFetchingQuotations, setIsFetchingQuotations] = useState<boolean>(false);

  const fetchDbClients = () => {
    fetch(getApiUrl('/api_clients.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setDbClients(resData.data);
        }
      })
      .catch((err) => {
        console.error('Fetch clients error:', err);
      });
  };

  const fetchQuotationsData = () => {
    setIsFetchingQuotations(true);
    fetch(getApiUrl('/api_quotations.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setInternalQuotations(resData.data);
        }
      })
      .catch((err) => console.error('EmailClient quotations fetch error:', err))
      .finally(() => setIsFetchingQuotations(false));
  };

  useEffect(() => {
    fetchDbClients();
    fetchQuotationsData();
    const interval = setInterval(() => {
      fetchDbClients();
      fetchQuotationsData();
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const effectiveQuotationsList = (quotationsList && quotationsList.length > 0) ? quotationsList : internalQuotations;

  // 2. Build Company Groups by Corporate Domain & Quotation Mapping
  const companyGroupsMap = new Map<string, CompanyGroup>();

  // Add active RFQ / Quotation target company first if present
  if (rfq || quotation) {
    const qAny = quotation as any;
    const targetEmails = parseEmails(rfq?.sender_email || quotation?.client_email);
    const primaryEmail = targetEmails[0] || '';
    const { companyKey, companyName } = extractCompanyInfoFromEmail(primaryEmail, quotation?.company_name || rfq?.company);

    companyGroupsMap.set(companyKey, {
      companyKey,
      companyName,
      primaryClientName: rfq?.sender_name || quotation?.client_name || 'Client',
      primaryEmail,
      emailList: targetEmails,
      phone: quotation?.client_phone || rfq?.phone || '',
      addressLine1: qAny?.address_line1 || '',
      addressLine2: qAny?.address_line2 || '',
      city: qAny?.city || '',
      state: qAny?.state || '',
      postalCode: qAny?.postal_code || '',
      country: qAny?.country || 'Malaysia',
      taxId: qAny?.tax_id || '',
      notes: qAny?.notes || '',
      lastActivity: quotation?.date_issued || rfq?.date_received || 'Today',
      quotations: quotation ? [quotation] : [],
      rfqs: rfq ? [rfq] : [],
      repliedMessagesCount: quotation?.status === 'penawaran_terkirim' || quotation?.pdf_created === 1 ? 1 : 0,
    });
  }

  // Populate from MySQL Clients DB
  dbClients.forEach((dbC) => {
    const parsed = parseEmails(dbC.email);
    const primaryEmail = parsed[0] || '';
    const { companyKey, companyName } = extractCompanyInfoFromEmail(primaryEmail, dbC.company_name);

    if (!companyGroupsMap.has(companyKey)) {
      companyGroupsMap.set(companyKey, {
        companyKey,
        companyName,
        primaryClientName: dbC.client_name || 'Contact Person',
        primaryEmail,
        emailList: parsed,
        phone: dbC.phone || '',
        addressLine1: dbC.address_line1 || '',
        addressLine2: dbC.address_line2 || '',
        city: dbC.city || '',
        state: dbC.state || '',
        postalCode: dbC.postal_code || '',
        country: dbC.country || 'Malaysia',
        taxId: dbC.tax_id || '',
        logoUrl: dbC.logo_url || '',
        notes: dbC.notes || '',
        dbClientId: dbC.id,
        lastActivity: 'Registered',
        quotations: [],
        rfqs: [],
        repliedMessagesCount: 0,
      });
    } else {
      const existing = companyGroupsMap.get(companyKey)!;
      existing.dbClientId = dbC.id;
      if (dbC.logo_url) existing.logoUrl = dbC.logo_url;
      if (dbC.client_name) existing.primaryClientName = dbC.client_name;
      if (parsed.length > 0) {
        existing.emailList = Array.from(new Set([...existing.emailList, ...parsed]));
        existing.primaryEmail = existing.emailList[0] || '';
      }
      if (dbC.phone) existing.phone = dbC.phone;
      if (dbC.address_line1) existing.addressLine1 = dbC.address_line1;
      if (dbC.address_line2) existing.addressLine2 = dbC.address_line2;
      if (dbC.city) existing.city = dbC.city;
      if (dbC.state) existing.state = dbC.state;
      if (dbC.postal_code) existing.postalCode = dbC.postal_code;
      if (dbC.tax_id) existing.taxId = dbC.tax_id;
      if (dbC.notes) existing.notes = dbC.notes;
    }
  });

  // Aggregate Quotations List by Company Domain (Includes both email-based and manual SPH quotations)
  effectiveQuotationsList.forEach((q) => {
    const qAny = q as any;
    const qEmails = parseEmails(q.client_email);
    const primaryEmail = qEmails[0] || '';
    const { companyKey, companyName } = extractCompanyInfoFromEmail(primaryEmail, q.company_name);

    if (!companyGroupsMap.has(companyKey)) {
      companyGroupsMap.set(companyKey, {
        companyKey,
        companyName,
        primaryClientName: q.client_name || 'Client',
        primaryEmail,
        emailList: qEmails,
        phone: q.client_phone || '',
        addressLine1: qAny?.address_line1 || '',
        addressLine2: qAny?.address_line2 || '',
        city: qAny?.city || '',
        state: qAny?.state || '',
        postalCode: qAny?.postal_code || '',
        country: qAny?.country || 'Malaysia',
        taxId: qAny?.tax_id || '',
        notes: qAny?.notes || '',
        lastActivity: q.date_issued || 'Recent',
        quotations: [q],
        rfqs: [],
        repliedMessagesCount: q.status === 'penawaran_terkirim' || q.pdf_created === 1 ? 1 : 0,
      });
    } else {
      const group = companyGroupsMap.get(companyKey)!;
      if (qEmails.length > 0) {
        group.emailList = Array.from(new Set([...group.emailList, ...qEmails]));
        if (!group.primaryEmail) group.primaryEmail = group.emailList[0];
      }
      if (!group.quotations.some((x) => x.id === q.id)) {
        group.quotations.push(q);
        if (q.status === 'penawaran_terkirim' || q.pdf_created === 1) {
          group.repliedMessagesCount += 1;
        }
      }
    }
  });

  // Helper to strictly validate if an RFQ email is linked to an existing Quotation in effectiveQuotationsList
  const isLinkedToQuotationList = (r: RFQ): boolean => {
    if (!r) return false;
    const rIdStr = String(r.id || '').trim();
    const rNumStr = String((r as any).rfq_number || '').trim();
    const cleanSender = cleanSingleEmail(r.sender_email);

    return effectiveQuotationsList.some((q) => {
      const qRfqId = String(q.rfq_id || '').trim();
      if (qRfqId !== '' && (qRfqId === rIdStr || qRfqId === rNumStr || qRfqId === `RFQ-${rIdStr}` || qRfqId === `GMAIL-LIVE-${rIdStr}`)) {
        return true;
      }
      const cleanClient = cleanSingleEmail(q.client_email);
      if (cleanClient !== '' && cleanSender !== '' && cleanClient === cleanSender) {
        return true;
      }
      if (q.company_name && r.company && q.company_name.toLowerCase().trim() === r.company.toLowerCase().trim() && q.company_name.trim() !== '') {
        return true;
      }
      return false;
    });
  };

  // Aggregate RFQ List by Company Domain (STRICTLY FOR RFQS LINKED TO QUOTATION LIST)
  rfqList.forEach((r) => {
    if (!isLinkedToQuotationList(r)) return;

    const rEmails = parseEmails(r.sender_email);
    const primaryEmail = rEmails[0] || '';
    const { companyKey, companyName } = extractCompanyInfoFromEmail(primaryEmail, r.company);

    if (!companyGroupsMap.has(companyKey)) {
      companyGroupsMap.set(companyKey, {
        companyKey,
        companyName,
        primaryClientName: r.sender_name || 'Client',
        primaryEmail,
        emailList: rEmails,
        phone: r.phone || '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Malaysia',
        taxId: '',
        notes: '',
        lastActivity: r.date_received || 'Recent',
        quotations: [],
        rfqs: [r],
        repliedMessagesCount: r.status === 'penawaran_terkirim' ? 1 : 0,
      });
    } else {
      const group = companyGroupsMap.get(companyKey)!;
      if (rEmails.length > 0) {
        group.emailList = Array.from(new Set([...group.emailList, ...rEmails]));
        if (!group.primaryEmail) group.primaryEmail = group.emailList[0];
      }
      if (!group.rfqs.some((x) => x.id === r.id)) {
        group.rfqs.push(r);
        if (r.status === 'penawaran_terkirim') group.repliedMessagesCount += 1;
      }
    }
  });

  // STRICT QUOTATION-ONLY FILTER: Only include company groups that have active entries in quotationsList
  const companyGroups = Array.from(companyGroupsMap.values()).filter(
    (g) => g.quotations.length > 0
  );

  const [selectedGroup, setSelectedGroup] = useState<CompanyGroup>(
    companyGroups[0] || {
      companyKey: 'unassigned',
      companyName: 'No Company Assigned',
      primaryClientName: '',
      primaryEmail: '',
      emailList: [],
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Malaysia',
      taxId: '',
      notes: '',
      lastActivity: 'No Activity',
      quotations: [],
      rfqs: [],
      repliedMessagesCount: 0,
    }
  );

  // UI Toggle States
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCompanyDetailPanel, setShowCompanyDetailPanel] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'table' | 'profile'>('table');
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);

  // Attachment & Quoted Reply States
  const [showAttachmentPicker, setShowAttachmentPicker] = useState<boolean>(false);
  const [selectedReplyQuotation, setSelectedReplyQuotation] = useState<Quotation | null>(
    selectedGroup.quotations[0] || quotation || null
  );
  const [attachedPdfFile, setAttachedPdfFile] = useState<string | null>(null);

  // Clean Email Preview Modal State
  const [previewEmailData, setPreviewEmailData] = useState<RFQ | null>(null);

  // Bubble Info Popup Modal State
  const [infoModalData, setInfoModalData] = useState<{ rfq?: RFQ; quotation?: Quotation } | null>(null);

  // Fullscreen Table Modal & Search State
  const [showFullTableModal, setShowFullTableModal] = useState<boolean>(false);
  const [fullTableSearch, setFullTableSearch] = useState<string>('');

  // Active quotation & RFQ selection within group
  const activeQuotation = selectedReplyQuotation || selectedGroup.quotations[0] || quotation || undefined;
  const activeRfq = selectedGroup.rfqs[0] || rfq || undefined;

  // Memoized RFQ Email ↔ SPH Quotation Correlation Pairing for Right Panel Table
  const correlatedPairs = React.useMemo(() => {
    const pairs: Array<{
      rfq?: RFQ;
      quotations: Quotation[];
    }> = [];

    const matchedQuoIds = new Set<string>();

    // 1. Pair each RFQ Email with its matching Quotations
    selectedGroup.rfqs.forEach((r) => {
      const matchedQuos = selectedGroup.quotations.filter((q) => {
        const qRfqId = String(q.rfq_id || '').trim();
        const rId = String(r.id || '').trim();
        const rNum = String(r.rfq_number || '').trim();
        const isRfqIdMatch = qRfqId !== '' && (qRfqId === rId || qRfqId === rNum || qRfqId === `RFQ-${rId}` || qRfqId === `GMAIL-LIVE-${rId}`);
        const isEmailMatch = Boolean(q.client_email && r.sender_email && cleanSingleEmail(q.client_email) === cleanSingleEmail(r.sender_email));
        return isRfqIdMatch || isEmailMatch;
      });

      matchedQuos.forEach((q) => matchedQuoIds.add(String(q.id)));
      pairs.push({ rfq: r, quotations: matchedQuos });
    });

    // 2. Append unmatched Manual / Direct Quotations
    const orphanQuos = selectedGroup.quotations.filter((q) => !matchedQuoIds.has(String(q.id)));
    orphanQuos.forEach((q) => {
      pairs.push({ rfq: undefined, quotations: [q] });
    });

    return pairs;
  }, [selectedGroup]);

  // Client Modal Form State (+ Add / Edit Company)
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [editingClientData, setEditingClientData] = useState<ClientData>({
    company_name: '',
    client_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Malaysia',
    tax_id: '',
    notes: '',
  });
  const [clientEmailList, setClientEmailList] = useState<string[]>(['']);
  const [isSavingClient, setIsSavingClient] = useState<boolean>(false);

  // Composer States
  const [toEmail, setToEmail] = useState<string>(selectedGroup.primaryEmail || selectedGroup.emailList[0] || '');
  const [fromEmail] = useState<string>('sales@abmalaya.com');
  const [messageText, setMessageText] = useState<string>('');

  const [sending, setSending] = useState<boolean>(false);

  // AI Assistant States
  const [showAiBox, setShowAiBox] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLanguage, setAiLanguage] = useState<string>('English');
  const [generatingAI, setGeneratingAI] = useState<boolean>(false);

  // Auto-expanding textarea height ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Direct Action: Kirim Quotation SPH (Populate Composer & Update Database Status to penawaran_terkirim)
  const handleSendQuotationDirect = (targetQuo: Quotation) => {
    if (!targetQuo) return;

    // 1. Select Quotation & PDF File
    setSelectedReplyQuotation(targetQuo);
    const targetPdf = targetQuo.quotation_file || targetQuo.source_file || (targetQuo.pdf_created === 1 ? `SPH-${targetQuo.quotation_number}.pdf` : null);
    if (targetPdf) setAttachedPdfFile(targetPdf);

    // 2. Set Recipient Email
    const recipient = targetQuo.client_email || selectedGroup.primaryEmail || selectedGroup.emailList[0] || '';
    if (recipient) setToEmail(recipient);

    // 3. Draft Professional SPH Quotation Email Message Body
    const quoNo = targetQuo.quotation_number || targetQuo.id;
    const clientName = targetQuo.client_name || selectedGroup.primaryClientName || 'Bapak/Ibu';
    const grandTotalFormatted = Number(targetQuo.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const draftBody = `Yth. ${clientName},\n\n` +
      `Bersama email ini, kami dari PT/CV AB Malaya menyampaikan Surat Penawaran Harga (SPH) dengan rincian berikut:\n\n` +
      `• Nomor SPH: ${quoNo}\n` +
      `• Tanggal: ${targetQuo.date_issued || new Date().toISOString().split('T')[0]}\n` +
      `• Total Penawaran: RM ${grandTotalFormatted}\n\n` +
      `Dokumen penawaran harga lengkap terlampir dalam email ini.\n` +
      `Mohon konfirmasi jika ada pertanyaan atau penyesuaian spesifikasi yang dibutuhkan.\n\n` +
      `Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.\n\n` +
      `Hormat kami,\n` +
      `AB Malaya Sales Team`;

    setMessageText(draftBody);

    // 4. Sync Status directly to MySQL DB via api_quotations.php
    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: targetQuo.id,
        status: 'penawaran_terkirim',
        action: 'status_update',
        user_name: 'AB Malaya Sales Team (Direct Send)',
        user_email: fromEmail,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          fetchQuotationsData();
        }
      })
      .catch((err) => console.error('Error updating quotation status to penawaran_terkirim:', err));

    // 5. Close fullscreen popup modal & focus composer textarea
    setShowFullTableModal(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  };

  // Action: Generate & Open Automatic Invoice from Quotation SPH
  const handleGenerateInvoiceFromQuotation = (targetQuo: Quotation) => {
    if (!targetQuo) return;

    const quoId = String(targetQuo.id);
    const quoNum = targetQuo.quotation_number || quoId;
    const invId = `INV-${quoId}`;
    const invNum = `ABM/INV/${new Date().getFullYear()}/${quoNum}`;

    fetch(getApiUrl('/api_invoices.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: invId,
        invoice_number: invNum,
        quotation_id: quoId,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        client_name: targetQuo.client_name || selectedGroup.primaryClientName || '',
        client_email: targetQuo.client_email || selectedGroup.primaryEmail || '',
        client_phone: targetQuo.client_phone || selectedGroup.phone || '',
        company_name: targetQuo.company_name || selectedGroup.companyName || '',
        subtotal: Number(targetQuo.grand_total || 0),
        tax_percent: 11,
        tax_amount: Number(targetQuo.grand_total || 0) * 0.11,
        grand_total: Number(targetQuo.grand_total || 0),
        status: 'unpaid',
        created_by: 'AB Malaya Sales Team (Auto Invoice)',
      }),
    })
      .then((res) => res.json())
      .then(() => {
        window.open(getApiUrl(`view_doc.php?type=invoice&id=${encodeURIComponent(quoId)}`), '_blank');
      })
      .catch((err) => {
        console.error('Error auto-generating invoice:', err);
        window.open(getApiUrl(`view_doc.php?type=invoice&id=${encodeURIComponent(quoId)}`), '_blank');
      });
  };

  useEffect(() => {
    setIsLoadingChat(true);
    const timer = setTimeout(() => {
      setIsLoadingChat(false);
    }, 250);

    setToEmail(selectedGroup.primaryEmail || selectedGroup.emailList[0] || '');
    if (selectedGroup.quotations.length > 0 && !selectedReplyQuotation) {
      setSelectedReplyQuotation(selectedGroup.quotations[0]);
    }
    return () => clearTimeout(timer);
  }, [selectedGroup.companyKey]);

  // Reactive sync when quotation or rfq is explicitly passed from outside (e.g. QuotationList Send confirmation)
  useEffect(() => {
    if (quotation) {
      const targetEmails = parseEmails(quotation.client_email);
      const primaryEmail = targetEmails[0] || '';
      const { companyKey } = extractCompanyInfoFromEmail(primaryEmail, quotation.company_name);

      const foundGroup = companyGroups.find(
        (g) =>
          g.companyKey === companyKey ||
          g.quotations.some((q) => q.id === quotation.id) ||
          (quotation.company_name && g.companyName.toLowerCase() === quotation.company_name.toLowerCase()) ||
          (primaryEmail && g.emailList.includes(primaryEmail))
      );

      if (foundGroup) {
        setSelectedGroup(foundGroup);
      }
      setSelectedReplyQuotation(quotation);

      const targetFile = quotation.quotation_file || quotation.source_file || (quotation.pdf_created === 1 ? `SPH-${quotation.quotation_number}.pdf` : null);
      if (targetFile) {
        setAttachedPdfFile(targetFile);
      }

      if (quotation.client_email) {
        setToEmail(quotation.client_email);
      }

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 300);
    } else if (rfq) {
      const targetEmails = parseEmails(rfq.sender_email);
      const primaryEmail = targetEmails[0] || '';
      const { companyKey } = extractCompanyInfoFromEmail(primaryEmail, rfq.company);
      const foundGroup = companyGroups.find(
        (g) => g.companyKey === companyKey || g.rfqs.some((r) => r.id === rfq.id)
      );
      if (foundGroup) {
        setSelectedGroup(foundGroup);
      }
    }
  }, [quotation?.id, rfq?.id]);

  // Adjust textarea height dynamically up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const targetH = Math.min(Math.max(scrollH, 38), 140);
      textareaRef.current.style.height = `${targetH}px`;
    }
  }, [messageText]);

  // Open modal to Add New Client
  const handleOpenAddClient = () => {
    setEditingClientData({
      company_name: '',
      client_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Malaysia',
      tax_id: '',
      notes: '',
    });
    setClientEmailList(['']);
    setShowClientModal(true);
  };

  // Open modal to Edit Selected Client
  const handleOpenEditClient = () => {
    const rawEmails = parseEmails(selectedGroup.primaryEmail || selectedGroup.emailList.join(', '));
    const initialList = rawEmails.length > 0 ? rawEmails : [''];
    setEditingClientData({
      id: selectedGroup.dbClientId,
      company_name: selectedGroup.companyName,
      client_name: selectedGroup.primaryClientName,
      email: initialList.join(', '),
      phone: selectedGroup.phone,
      address_line1: selectedGroup.addressLine1,
      address_line2: selectedGroup.addressLine2,
      city: selectedGroup.city,
      state: selectedGroup.state,
      postal_code: selectedGroup.postalCode,
      country: selectedGroup.country || 'Malaysia',
      tax_id: selectedGroup.taxId,
      notes: selectedGroup.notes,
    });
    setClientEmailList(initialList);
    setShowClientModal(true);
  };

  // Save Client Data to MySQL via /api_clients.php
  const handleSaveClientData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientData.company_name.trim()) {
      alert('Company Name is required!');
      return;
    }

    const cleanEmailList = clientEmailList.map((em) => em.trim()).filter(Boolean);
    const joinedEmails = cleanEmailList.join(', ');

    const payloadToSave = {
      ...editingClientData,
      email: joinedEmails,
    };

    setIsSavingClient(true);

    setDbClients((prev) => {
      const idx = prev.findIndex(
        (c) =>
          (payloadToSave.id && c.id === payloadToSave.id) ||
          c.company_name.toLowerCase().trim() === payloadToSave.company_name.toLowerCase().trim()
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...payloadToSave };
        return copy;
      }
      return [...prev, { ...payloadToSave, id: Date.now() }];
    });
    setShowClientModal(false);

    fetch(getApiUrl('/api_clients.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSave),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingClient(false);
        if (resData.status === 'success') {
          fetchDbClients();
        } else {
          console.error('Failed to save client data:', resData.message);
        }
      })
      .catch((err) => {
        setIsSavingClient(false);
        console.error('Save client error:', err);
      });
  };

  // Send Email Handler
  const handleSendEmail = () => {
    if (!messageText.trim()) return;
    setSending(true);

    const targetId = activeQuotation?.id || activeRfq?.id || 'RFQ-001';

    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: targetId,
        status: 'penawaran_terkirim',
        reply_body: messageText,
        reply_sender: fromEmail,
        target_client_email: toEmail,
        attachment_file: attachedPdfFile || activeQuotation?.quotation_file || null,
        user_name: 'AB Malaya Sales Team (Staff PIC)',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSending(false);
        if (data.status === 'success') {
          selectedGroup.repliedMessagesCount += 1;
          setMessageText('');

          // Update active quotation status in database to done_send if present
          if (activeQuotation?.id) {
            fetch(getApiUrl('/api_quotations.php'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: activeQuotation.id,
                status: 'done_send',
                action: 'status_update',
                user_name: 'AB Malaya Sales Team (Staff PIC)',
                user_email: fromEmail,
              }),
            }).catch((e) => console.error('Error updating quotation to done_send:', e));
          }

          setTimeout(() => {
            if (onSuccessSend) onSuccessSend(messageText, fromEmail);
            if (onClose && isModalMode) onClose();
          }, 1200);
        } else {
          alert('Failed to send email: ' + (data.message || 'Mail server rejected the dispatch request.'));
        }
      })
      .catch((err) => {
        setSending(false);
        console.error(err);
        alert('Server communication error');
      });
  };

  // AI Assistant Draft Generator
  const handleGenerateAI = () => {
    setGeneratingAI(true);
    fetch(getApiUrl('/api_ai_rfq.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'draft_reply',
        language: aiLanguage,
        custom_prompt: aiPrompt,
        rfq_data: activeRfq || {
          sender_name: selectedGroup.primaryClientName,
          company: selectedGroup.companyName,
          sender_email: toEmail || selectedGroup.primaryEmail,
          subject: 'Commercial SPH Inquiry',
          message_body: 'Request for quotation and technical specification offer.',
        },
        quotation_data: activeQuotation ? {
          id: activeQuotation.id,
          quotation_number: activeQuotation.quotation_number,
          grand_total: activeQuotation.grand_total,
          date_issued: activeQuotation.date_issued,
          items: activeQuotation.items || activeQuotation.items_details,
        } : null,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGeneratingAI(false);
        if (data.status === 'success' && data.reply_text) {
          setMessageText(data.reply_text);
          setShowAiBox(false);
        } else {
          const generatedFallback = 
            `Dear ${selectedGroup.primaryClientName},\n\n` +
            `Thank you for contacting AB MALAYA SDN. BHD. regarding your requirement for ${selectedGroup.companyName}.\n\n` +
            `We are pleased to provide our commercial proposal (SPH No: ${activeQuotation?.quotation_number || activeQuotation?.id || 'SPH-2026'}).\n\n` +
            `Total Investment: MYR ${(activeQuotation?.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (Inclusive of 11% Tax)\n` +
            `Validity: 14 Days from date of issue.\n\n` +
            (aiPrompt ? `Note: ${aiPrompt}\n\n` : '') +
            `Please review the attached SPH document. Feel free to reply directly to this email for purchase order confirmation.\n\n` +
            `Best regards,\nSales & Estimating Desk\nAB MALAYA SDN. BHD.`;
          setMessageText(generatedFallback);
          setShowAiBox(false);
        }
      })
      .catch((err) => {
        setGeneratingAI(false);
        console.error('AI error:', err);
      });
  };

  // Filter groups based on search query
  const filteredGroups = companyGroups.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.companyName.toLowerCase().includes(q) ||
      g.primaryClientName.toLowerCase().includes(q) ||
      g.emailList.some((e) => e.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className={
        isModalMode
          ? 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 font-sans animate-in fade-in'
          : 'h-full w-full flex flex-col font-sans'
      }
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 ${
          isModalMode ? 'w-full max-w-7xl h-[92vh]' : 'w-full h-full'
        }`}
      >
        {/* HEADER BAR */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-800 rounded transition text-slate-300 hover:text-white cursor-pointer"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              <h2 className="font-extrabold text-sm tracking-wide flex items-center gap-2">
                <span className="truncate">Email Client</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenAddClient}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Company</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* SIDEBAR — COMPANY PROFILES LIST (COLLAPSIBLE) */}
          {isSidebarOpen && (
            <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 min-h-0 transition-all duration-300">
              
              {/* Search Box */}
              <div className="p-3 border-b border-slate-200 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Company / Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-300 rounded text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>
              </div>

              {/* List of Company Profiles */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {isFetchingQuotations && effectiveQuotationsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600 flex flex-col items-center justify-center space-y-2.5">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <span className="font-extrabold text-slate-800">Memuat Data Quotation...</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Menyinkronkan data SPH dari MySQL Database</span>
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700">Tidak ada perusahaan Quotation.</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">Hanya pesan & perusahaan yang terdaftar di Quotation List yang ditampilkan.</p>
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const isSelected = selectedGroup.companyKey === group.companyKey;
                    return (
                      <div
                        key={group.companyKey}
                        onClick={() => setSelectedGroup(group)}
                        className={`p-3 cursor-pointer transition flex items-start gap-2.5 ${
                          isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600' : 'hover:bg-slate-100'
                        }`}
                      >
                        {/* Dynamic WhatsApp-style Circle Avatar / Company Logo */}
                        <CompanyAvatar
                          email={group.primaryEmail}
                          name={group.companyName}
                          logoUrl={group.logoUrl}
                          className="w-10 h-10"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-extrabold text-xs text-slate-900 truncate">
                              {group.companyName}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {group.repliedMessagesCount > 0 || group.quotations.some(q => q.status === 'penawaran_terkirim' || q.status === 'done_send' || (q.status as string) === 'Sent' || q.status === 'sent' || q.pdf_created === 1) ? (
                                <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded">
                                  Dibalas
                                </span>
                              ) : (
                                <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">
                                  Belum
                                </span>
                              )}
                              {group.quotations.length > 0 && (
                                <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.2 rounded">
                                  {group.quotations.length} SPH
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] font-semibold text-slate-600 truncate mt-0.5 flex items-center justify-between gap-1">
                            <span className="truncate">{group.primaryClientName || 'Client Contact'}</span>
                            {group.quotations.length > 0 && (
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-mono shrink-0">
                                Reg: {group.quotations[0].quotation_number || `#${group.quotations[0].id}`}
                              </span>
                            )}
                          </p>

                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-slate-400 font-mono">
                            <span className="truncate">{cleanSingleEmail(group.primaryEmail) || 'No Email'}</span>
                            {group.emailList.length > 1 && (
                              <span className="bg-slate-200 text-slate-700 px-1 rounded text-[9px] font-bold">
                                +{group.emailList.length - 1} email
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* MAIN CHAT & COMPOSER AREA */}
          <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0">
            
            {/* WhatsApp-Style Header Bar for Selected Company */}
            <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Dynamic Circle Avatar */}
                <button
                  type="button"
                  onClick={() => setShowCompanyDetailPanel(!showCompanyDetailPanel)}
                  className="shrink-0 transition cursor-pointer hover:opacity-90"
                  title={showCompanyDetailPanel ? 'Hide Company Details' : 'View Company Profile Details'}
                >
                  <CompanyAvatar
                    email={selectedGroup.primaryEmail}
                    name={selectedGroup.companyName}
                    logoUrl={selectedGroup.logoUrl}
                    className="w-9 h-9"
                  />
                </button>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-2">
                    <span>{selectedGroup.companyName}</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono">
                      (Activity: {selectedGroup.lastActivity})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 truncate font-mono flex items-center gap-2 mt-0.5">
                    <span className="truncate">{selectedGroup.primaryClientName} — {cleanSingleEmail(selectedGroup.primaryEmail)}</span>
                    {activeQuotation && (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                        Quotation Reg: {activeQuotation.quotation_number || `#${activeQuotation.id}`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className="p-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md transition cursor-pointer flex items-center justify-center"
                  title="Options Menu"
                >
                  <MoreVertical className="w-4 h-4 text-slate-600" />
                </button>

                {showHeaderMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-300 rounded-md shadow-xl z-50 py-1 font-sans text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setShowCompanyDetailPanel(!showCompanyDetailPanel);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-800 transition flex items-center gap-2 font-bold cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-600" />
                      <span>{showCompanyDetailPanel ? 'Hide Details' : 'Company Details'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        handleOpenEditClient();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-800 transition flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit Profile</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* WHATSAPP-STYLE CHAT MESSAGES THREAD */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efeae2]/40">
              {isLoadingChat ? (
                /* LOADING INDICATOR & SKELETON STATE */
                <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="bg-white/90 backdrop-blur-xs border border-slate-300 shadow-sm px-4 py-2.5 rounded-full flex items-center gap-2.5 text-slate-700 text-xs font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span>Loading email messages & quotations...</span>
                  </div>

                  <div className="w-full max-w-lg space-y-3 px-2">
                    <div className="bg-white/80 rounded-lg p-3 w-4/5 space-y-2 border border-slate-200 shadow-xs animate-pulse">
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-2.5 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-2 bg-slate-100 rounded w-1/3 mt-2"></div>
                    </div>
                    <div className="bg-blue-50/90 rounded-lg p-3 w-3/4 ml-auto space-y-2 border border-blue-100 shadow-xs animate-pulse">
                      <div className="h-3 bg-blue-200 rounded w-2/3"></div>
                      <div className="h-2.5 bg-blue-100 rounded w-4/5"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Thread Messages: RFQ Emails (Left Bubble) & SPH Replies (Right Bubble) */}
                  {(() => {
                    const effectiveRfqs = selectedGroup.quotations.map((q, idx) => ({
                      id: q.id || String(idx + 1000),
                      company: q.company_name || selectedGroup.companyName,
                      sender_name: q.client_name || selectedGroup.primaryClientName,
                      sender_email: cleanSingleEmail(q.client_email) || selectedGroup.primaryEmail,
                      phone: q.client_phone || selectedGroup.phone,
                      subject: `Commercial Quotation Inquiry - ${q.quotation_number || `#${q.id}`}`,
                      item_requested: 'Quotation Request',
                      message_body: `Official Commercial Quotation Request from ${q.company_name || q.client_name || 'Client'}.`,
                      date_received: q.date_issued || selectedGroup.lastActivity || 'Recent',
                      status: q.status || 'waiting',
                      quotation_number: q.quotation_number,
                      rawQuotation: q
                    }));

                    if (effectiveRfqs.length === 0 && selectedGroup.quotations.filter(q => q.status === 'penawaran_terkirim').length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          No email history or quotations found for this company.
                        </div>
                      );
                    }

                    return (
                      <>
                        {effectiveRfqs.map((rfqItem) => {
                          const linkedQuotation = rfqItem.rawQuotation;

                          return (
                            <div key={rfqItem.id} className="flex flex-col items-start space-y-1 w-full">
                              {/* Left Bubble (Client Email / RFQ) with ! circle button on the RIGHT */}
                              <div className="flex items-center gap-2 max-w-[90%]">
                                <div className="bg-white text-slate-800 rounded-lg shadow-xs border border-slate-200 p-3 font-sans text-xs space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1">
                                    <div className="flex flex-col">
                                      <span className="font-extrabold text-slate-900">
                                        {rfqItem.sender_name || selectedGroup.primaryClientName} ({cleanSingleEmail(rfqItem.sender_email)})
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded w-fit flex items-center gap-1">
                                          <FileText className="w-3 h-3 text-blue-600" />
                                          <span>Quotation Reg: {linkedQuotation?.quotation_number || selectedGroup.quotations[0]?.quotation_number || 'Unlinked'}</span>
                                        </span>
                                        {((rfqItem as any).is_replied || (rfqItem as any).replies?.length > 0 || rfqItem.status === 'penawaran_terkirim' || rfqItem.status === 'done_send' || rfqItem.status === 'deal' || (linkedQuotation && (linkedQuotation.status === 'penawaran_terkirim' || linkedQuotation.status === 'done_send' || linkedQuotation.pdf_created === 1))) ? (
                                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded w-fit flex items-center gap-1">
                                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                                            <span>Sudah Dibalas</span>
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded w-fit flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-amber-600" />
                                            <span>Belum Dibalas</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">{rfqItem.date_received || 'Recent'}</span>
                                  </div>

                                  <p className="font-bold text-slate-800 text-xs">{rfqItem.subject || 'Quotation Request'}</p>

                                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewEmailData(rfqItem as RFQ);
                                      }}
                                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3 text-blue-600" />
                                      <span>View Full Email</span>
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setToEmail(cleanSingleEmail(rfqItem.sender_email) || selectedGroup.primaryEmail);
                                          const qLinked = linkedQuotation || selectedGroup.quotations[0] || null;
                                          setSelectedReplyQuotation(qLinked);
                                        }}
                                        className="text-[10px] font-extrabold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                      >
                                        <CornerUpLeft className="w-3 h-3 text-blue-600" />
                                        <span>Reply to this message</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setInfoModalData({ rfq: rfqItem as any, quotation: linkedQuotation || selectedGroup.quotations[0] })}
                                  className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-xs shrink-0 shadow-2xs border border-blue-300 transition cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95"
                                  title="Info Detail Email, Quotation & Status Inbox"
                                >
                                  !
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Right Bubbles (Sent SPH Replies) with ! circle button on the LEFT */}
                        {selectedGroup.quotations.filter(q => q.status === 'penawaran_terkirim' || q.status === 'done_send' || q.status === 'sent').map((quoItem) => (
                          <div key={quoItem.id} className="flex flex-col items-end space-y-1 w-full">
                            <div className="flex items-center gap-2 max-w-[90%] justify-end">
                              <button
                                type="button"
                                onClick={() => setInfoModalData({ quotation: quoItem, rfq: activeRfq })}
                                className="w-6 h-6 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-xs shrink-0 shadow-2xs border border-emerald-300 transition cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95"
                                title="Info Detail Email, Quotation & Status Inbox"
                              >
                                !
                              </button>

                              <div className="bg-blue-100 text-slate-900 rounded-lg shadow-xs border border-blue-200 p-3 font-sans text-xs space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 pb-1">
                                  <span className="font-extrabold text-blue-900 flex items-center gap-1">
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                                    <span>AB Malaya Sales Team</span>
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">{quoItem.date_issued}</span>
                                </div>

                                <div className="font-bold text-slate-800">
                                  Quotation Reply #{quoItem.quotation_number || quoItem.id}
                                </div>

                                <p className="text-slate-700 text-[11px] whitespace-pre-wrap">
                                  Quotation offer of RM {(quoItem.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been issued and sent.
                                </p>

                                <div className="pt-1 flex items-center gap-2 flex-wrap">
                                  {quoItem.quotation_file && (
                                    <a
                                      href={getApiUrl(quoItem.quotation_file)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 bg-blue-700 text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-2xs hover:bg-blue-800 transition"
                                    >
                                      <FileType className="w-3.5 h-3.5" />
                                      <span>Download {quoItem.quotation_file.substring(quoItem.quotation_file.lastIndexOf('/') + 1)}</span>
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateInvoiceFromQuotation(quoItem)}
                                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-extrabold shadow-2xs transition cursor-pointer"
                                    title="Buat & Buka Invoice Otomatis dari SPH ini"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Otomatis Invoice</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            {/* QUOTED REPLY CONTEXT HEADER BAR */}
            <div className="bg-slate-100 border-t border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
              <div className="flex items-center gap-2 truncate min-w-0">
                <CornerUpLeft className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-bold text-slate-700 truncate">
                  Replying to Email (Quotation: <span className="font-extrabold text-blue-900">{activeQuotation ? (activeQuotation.quotation_number || activeQuotation.id) : 'General / Inquiry'}</span>)
                </span>
                
                {/* Clean Email Selector if multiple emails, or clean single email badge */}
                {selectedGroup.emailList.length > 1 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-500 font-bold text-[10px]">To:</span>
                    <select
                      value={cleanSingleEmail(toEmail)}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="bg-white border border-blue-300 text-blue-900 rounded text-[11px] px-2 py-0.5 font-mono font-bold shrink-0 cursor-pointer shadow-2xs"
                      title="Select recipient email for this reply"
                    >
                      {selectedGroup.emailList.map((em) => {
                        const cleanEm = cleanSingleEmail(em);
                        return (
                          <option key={cleanEm} value={cleanEm}>
                            {cleanEm}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <span className="text-slate-600 font-mono text-[11px] truncate font-semibold">
                    ({cleanSingleEmail(toEmail || selectedGroup.primaryEmail)})
                  </span>
                )}
              </div>

              {selectedGroup.quotations.length > 1 && (
                <select
                  value={activeQuotation?.id || ''}
                  onChange={(e) => {
                    const q = selectedGroup.quotations.find((x) => x.id === e.target.value) || null;
                    setSelectedReplyQuotation(q);
                  }}
                  className="bg-white border border-slate-300 rounded text-[11px] px-2 py-0.5 font-mono text-slate-700 shrink-0 cursor-pointer shadow-2xs"
                >
                  {selectedGroup.quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      Select Quotation: {q.quotation_number || q.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* AI ASSISTANT EXPANDABLE DRAFT BOX */}
            {showAiBox && (
              <div className="bg-blue-50 border-t border-blue-200 p-3 text-xs space-y-2 font-sans">
                <div className="flex items-center justify-between font-bold text-blue-900">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                    Gemini AI Auto-Draft Assistant
                  </span>
                  <button onClick={() => setShowAiBox(false)} className="text-blue-700 hover:text-blue-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Custom instructions (e.g., offer 5% discount on this month PO)..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full bg-white border border-blue-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center justify-between pt-1">
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    className="bg-white border border-blue-300 rounded text-xs px-2 py-1"
                  >
                    <option value="English">English</option>
                    <option value="Indonesian">Indonesian / Malay</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={generatingAI}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1 rounded flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                  >
                    {generatingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Generate Draft</span>
                  </button>
                </div>
              </div>
            )}

            {/* SEAMLESS WHATSAPP-STYLE INPUT FOOTER BAR */}
            <div className="bg-[#f0f2f5] border-t border-slate-200 p-2.5 flex items-end gap-2 shrink-0 font-sans">
              
              {/* Paperclip File Attachment Button */}
              <button
                type="button"
                onClick={() => setShowAttachmentPicker(true)}
                className="p-2 text-slate-600 hover:text-blue-700 hover:bg-slate-200 rounded-full transition cursor-pointer shrink-0 mb-0.5"
                title="Attach Quotation PDF / File"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* AI Draft Quick Button */}
              <button
                type="button"
                onClick={() => setShowAiBox(!showAiBox)}
                className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition cursor-pointer shrink-0 mb-0.5"
                title="Gemini AI Draft Writer"
              >
                <Sparkles className="w-5 h-5" />
              </button>

              {/* Ramping Auto-Expanding Textarea Input with File Indicator */}
              <div className="flex-1 flex flex-col items-start min-w-0">
                {attachedPdfFile && (
                  <div className="mb-1.5 text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-mono text-[10px] border border-blue-200 flex items-center gap-1.5 w-fit shadow-xs truncate max-w-full transition">
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate font-bold tracking-wide">Attached File: {attachedPdfFile.split('/').pop()}</span>
                    <button onClick={() => setAttachedPdfFile(null)} className="hover:text-blue-900 hover:bg-blue-200 p-0.5 rounded-full shrink-0 ml-1 transition"><X className="w-3 h-3"/></button>
                  </div>
                )}
                <div className="w-full bg-white border border-slate-300 focus-within:border-blue-500 rounded-2xl px-3 py-1.5 flex items-center shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Type a message for ${selectedGroup.companyName}...`}
                    className="w-full bg-transparent text-xs text-slate-900 focus:outline-none resize-none font-sans leading-relaxed"
                    style={{ minHeight: '38px', maxHeight: '140px' }}
                  />
                </div>
              </div>

              {/* Circular WhatsApp Send Button */}
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !messageText.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition cursor-pointer disabled:opacity-40 shadow-md shrink-0 mb-0.5"
                title="Send Email Reply"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white ml-0.5" />}
              </button>

            </div>

          </div>

          {/* RIGHT PANEL — DETAILED COMPANY PROFILE INFO & EMAIL/QUOTATION CORRELATION TABLE */}
          {showCompanyDetailPanel && (
            <div className="w-96 md:w-[420px] border-l border-slate-200 bg-slate-50 flex flex-col shrink-0 min-h-0 overflow-y-auto font-sans p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Company Profile & Details</span>
                </h4>
                <button
                  onClick={() => setShowCompanyDetailPanel(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 rounded"
                  title="Close Detail Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Right Panel Tab Navigation */}
              <div className="flex items-center border border-slate-200 bg-white rounded-lg p-1 text-xs font-semibold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('table')}
                  className={`flex-1 py-1.5 px-2 rounded font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Daftar Email & SPH ({correlatedPairs.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('profile')}
                  className={`flex-1 py-1.5 px-2 rounded font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'profile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Profil Perusahaan</span>
                </button>
              </div>

              {!selectedGroup.dbClientId && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs shadow-xs">
                  <div className="flex items-start gap-2 text-rose-800">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold mb-1">Not Saved in Database</p>
                      <p className="text-rose-700 mb-2 leading-relaxed">This company's contact record is not yet officially saved in MySQL. Save now to retain permanent history.</p>
                      <button
                        type="button"
                        onClick={handleOpenEditClient}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded shadow-sm transition cursor-pointer"
                      >
                        Save Company Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: CORRELATION TABLE (Daftar Email & Nomor SPH Quotation) */}
              {activeRightTab === 'table' && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tabel Korelasi Email ↔ SPH Quotation</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowFullTableModal(true)}
                          className="bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                          title="Buka Popup Modal View Fullscreen"
                        >
                          <Maximize2 className="w-3 h-3 text-blue-600" />
                          <span>View Full</span>
                        </button>
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shrink-0">
                          {selectedGroup.rfqs.length} Email | {selectedGroup.quotations.length} SPH
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto pt-1">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-extrabold text-slate-600">
                            <th className="p-2 border-r border-slate-200">Email Pesan (RFQ)</th>
                            <th className="p-2 border-r border-slate-200">Nomor SPH Quotation</th>
                            <th className="p-2 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {correlatedPairs.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-4 text-center text-slate-400 italic">
                                Belum ada pesan email atau SPH untuk perusahaan ini.
                              </td>
                            </tr>
                          ) : (
                            correlatedPairs.map((pair, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition">
                                {/* Column 1: Pesan Email */}
                                <td className="p-2 border-r border-slate-100 align-top">
                                  {pair.rfq ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                                        <span className="font-mono text-blue-700 text-[10px] bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                          {pair.rfq.rfq_number || `#${pair.rfq.id}`}
                                        </span>
                                      </div>
                                      <p className="font-semibold text-slate-800 text-[11px] truncate max-w-[140px]" title={pair.rfq.subject}>
                                        {pair.rfq.subject || 'RFQ Email'}
                                      </p>
                                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                        {cleanSingleEmail(pair.rfq.sender_email)}
                                      </p>
                                      {pair.rfq.date_received && (
                                        <span className="text-[9px] text-slate-400 block">{pair.rfq.date_received}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] font-mono block p-1">
                                      Direct / Manual SPH
                                    </span>
                                  )}
                                </td>

                                {/* Column 2: Nomor SPH Quotation */}
                                <td className="p-2 border-r border-slate-100 align-top">
                                  {pair.quotations.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {pair.quotations.map((q) => (
                                        <div key={q.id} className="bg-slate-50 border border-slate-200 p-1.5 rounded space-y-0.5 shadow-2xs">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-mono font-extrabold text-blue-900 text-[10px]">
                                              {q.quotation_number || q.id}
                                            </span>
                                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-tight ${
                                              q.status === 'ready_send' || q.status === 'penawaran_terkirim' || q.status === 'done_send'
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : q.approved_by
                                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                                            }`}>
                                              {q.status || 'Draft'}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-0.5 border-t border-slate-200/60">
                                            <span>Total:</span>
                                            <span className="font-bold text-slate-900">RM {Number(q.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold block text-center mt-1">
                                      Belum Ada SPH
                                    </span>
                                  )}
                                </td>

                                {/* Column 3: Action Buttons */}
                                <td className="p-2 align-middle text-center">
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    {pair.rfq && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewEmailData(pair.rfq!)}
                                        className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded transition border border-slate-200 cursor-pointer w-7 h-7 flex items-center justify-center"
                                        title="Preview Pesan Email Mentah"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {pair.quotations.map((q) => (
                                      <div key={q.id} className="flex flex-col items-center gap-1">
                                        <a
                                          href={getApiUrl(`view_doc.php?id=${q.id}`)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition border border-slate-200 cursor-pointer w-7 h-7 flex items-center justify-center"
                                          title={`Buka PDF/Web SPH ${q.quotation_number || q.id}`}
                                        >
                                          <FileType className="w-3.5 h-3.5" />
                                        </a>

                                        {q.status !== 'penawaran_terkirim' && q.status !== 'done_send' && q.status !== 'sent' ? (
                                          <button
                                            type="button"
                                            onClick={() => handleSendQuotationDirect(q)}
                                            className="px-1.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition border border-emerald-700 cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold shadow-2xs w-full"
                                            title={`Kirim SPH Quotation ${q.quotation_number || q.id}`}
                                          >
                                            <Send className="w-2.5 h-2.5" />
                                            <span>Kirim</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleGenerateInvoiceFromQuotation(q)}
                                            className="px-1.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition border border-emerald-700 cursor-pointer flex items-center justify-center gap-1 text-[9px] font-extrabold shadow-2xs w-full"
                                            title="Buat & Buka Invoice Otomatis"
                                          >
                                            <FileText className="w-2.5 h-2.5" />
                                            <span>Invoice</span>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY PROFILE DETAILS */}
              {activeRightTab === 'profile' && (
                <div className="space-y-4">
                  {/* Section 1: Contact Information */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2.5 text-xs">
                    <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1">
                      Primary Identity & Contact
                    </div>
                    <div className="flex items-center gap-3 py-1">
                      <CompanyAvatar
                        email={selectedGroup.primaryEmail}
                        name={selectedGroup.companyName}
                        logoUrl={selectedGroup.logoUrl}
                        className="w-12 h-12"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Company</span>
                        <p className="font-extrabold text-slate-900 text-sm truncate">{selectedGroup.companyName}</p>
                        <p className="font-semibold text-slate-600 text-xs truncate">{selectedGroup.primaryClientName || '—'}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium text-[11px]">Phone / Mobile:</span>
                      <p className="font-mono text-slate-800 font-bold mt-0.5">{selectedGroup.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium text-[11px]">Tax ID / SST Reg No.:</span>
                      <p className="font-mono text-slate-800 font-bold mt-0.5">{selectedGroup.taxId || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium text-[11px]">Quotation Reg:</span>
                      <p className="font-mono text-blue-700 font-extrabold mt-0.5">
                        {selectedGroup.quotations.length > 0
                          ? selectedGroup.quotations.map(q => q.quotation_number || `#${q.id}`).join(', ')
                          : 'No Quotations'}
                      </p>
                    </div>
                  </div>

                  {/* Section 2: Connected Domain Emails */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1 flex items-center justify-between">
                      <span>Connected Domain Emails</span>
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold">
                        {selectedGroup.emailList.length} Emails
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                      {selectedGroup.emailList.map((em, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-2 rounded text-[11px] font-mono text-slate-800 truncate shadow-2xs">
                          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{em}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Company Address */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                    <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>Company Address</span>
                    </div>
                    <div className="text-slate-700 leading-relaxed font-sans pt-0.5">
                      {selectedGroup.addressLine1 || selectedGroup.addressLine2 || selectedGroup.city ? (
                        <>
                          {selectedGroup.addressLine1 && <p className="font-semibold">{selectedGroup.addressLine1}</p>}
                          {selectedGroup.addressLine2 && <p>{selectedGroup.addressLine2}</p>}
                          <p className="text-slate-600 mt-0.5">
                            {[selectedGroup.city, selectedGroup.state, selectedGroup.postalCode].filter(Boolean).join(', ')}
                          </p>
                          {selectedGroup.country && <p className="font-bold text-slate-800 mt-1">{selectedGroup.country}</p>}
                        </>
                      ) : (
                        <p className="text-slate-400 italic">Address not yet entered in database.</p>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Notes */}
                  {selectedGroup.notes && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-bold text-amber-900 uppercase text-[10px] tracking-wider border-b border-amber-200/60 pb-1">
                        Company Notes
                      </div>
                      <p className="text-amber-800 whitespace-pre-wrap leading-relaxed">{selectedGroup.notes}</p>
                    </div>
                  )}

                  {/* Section 5: Edit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenEditClient}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Company Data</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ATTACHMENT FILE PICKER POPUP MODAL */}
      {showAttachmentPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-700 rounded-lg w-full max-w-md shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <span>Select Attachment File ({selectedGroup.companyName})</span>
              </h3>
              <button onClick={() => setShowAttachmentPicker(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
              <p className="text-slate-500 font-semibold mb-2">Company Quotation Documents:</p>
              {selectedGroup.quotations.length === 0 ? (
                <p className="text-slate-400 italic">No quotation documents generated for this company yet.</p>
              ) : (
                selectedGroup.quotations.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => {
                      setAttachedPdfFile(q.quotation_file || null);
                      setSelectedReplyQuotation(q);
                      setShowAttachmentPicker(false);
                    }}
                    className={`p-2.5 rounded border cursor-pointer transition flex items-center justify-between ${
                      (attachedPdfFile === q.quotation_file || activeQuotation?.id === q.id)
                        ? 'bg-blue-50 border-blue-400 font-bold text-blue-900'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 w-[85%]">
                      <FileType className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate text-[11px] font-mono">
                        {q.quotation_number || q.id} - ID Email: #{q.rfq_id || q.id} - {q.quotation_file ? q.quotation_file.split('/').pop() : 'No PDF file'}
                      </span>
                    </div>
                    {attachedPdfFile === q.quotation_file && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAttachmentPicker(false)}
                className="px-3 py-1.5 bg-slate-800 text-white font-bold text-xs rounded hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAN EMAIL CONTENT PREVIEW MODAL */}
      {previewEmailData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-700 rounded-lg w-full max-w-xl shadow-2xl p-4 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 shrink-0">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>RFQ Email Message Details (Clean Preview)</span>
              </h3>
              <button onClick={() => setPreviewEmailData(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div><span className="font-bold text-slate-600">Sender:</span> {previewEmailData.sender_name} &lt;{previewEmailData.sender_email}&gt;</div>
                <div><span className="font-bold text-slate-600">Company:</span> {previewEmailData.company}</div>
                <div><span className="font-bold text-slate-600">Subject:</span> {previewEmailData.subject}</div>
                <div><span className="font-bold text-slate-600">Date:</span> {previewEmailData.date_received}</div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Message Content:</label>
                <div className="bg-white border border-slate-300 rounded p-3 text-slate-800 font-sans leading-relaxed whitespace-pre-wrap text-xs max-h-72 overflow-y-auto">
                  {cleanEmailBodyText(previewEmailData.message_body || previewEmailData.item_requested)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewEmailData(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold text-xs rounded hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT EDIT / ADD MODAL */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-700 rounded-lg w-full max-w-4xl shadow-2xl p-4 space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 shrink-0">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingClientData.id || editingClientData.company_name
                  ? `Editing Company Profile - ${editingClientData.company_name || selectedGroup.companyName}`
                  : 'Add New Company Profile'}
              </h3>
              <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClientData} className="flex-1 flex flex-col min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-5 p-1 pr-2">
                {/* Column 1: Kontak Dasar */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={editingClientData.company_name}
                      onChange={(e) => setEditingClientData({ ...editingClientData, company_name: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={editingClientData.client_name || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, client_name: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Company Emails (List)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...clientEmailList, ''];
                          setClientEmailList(updated);
                        }}
                        className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Plus className="w-3 h-3 text-blue-600" />
                        <span>Add Email</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {clientEmailList.map((emailVal, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="email"
                            placeholder="e.g. sales@company.com"
                            value={emailVal}
                            onChange={(e) => {
                              const updated = [...clientEmailList];
                              updated[idx] = e.target.value;
                              setClientEmailList(updated);
                              setEditingClientData({ ...editingClientData, email: updated.filter(Boolean).join(', ') });
                            }}
                            className="flex-1 border border-slate-300 rounded p-1.5 font-mono text-xs focus:outline-none focus:border-blue-500"
                          />
                          {clientEmailList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = clientEmailList.filter((_, i) => i !== idx);
                                setClientEmailList(updated.length > 0 ? updated : ['']);
                                setEditingClientData({ ...editingClientData, email: updated.filter(Boolean).join(', ') });
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200 cursor-pointer transition"
                              title="Remove email"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone / Mobile</label>
                    <input
                      type="text"
                      value={editingClientData.phone || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, phone: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tax ID / SST Reg No.</label>
                    <input
                      type="text"
                      value={editingClientData.tax_id || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, tax_id: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Column 2: Alamat & Catatan */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={editingClientData.address_line1 || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, address_line1: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={editingClientData.address_line2 || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, address_line2: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={editingClientData.city || ''}
                        onChange={(e) => setEditingClientData({ ...editingClientData, city: e.target.value })}
                        className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">State / Province</label>
                      <input
                        type="text"
                        value={editingClientData.state || ''}
                        onChange={(e) => setEditingClientData({ ...editingClientData, state: e.target.value })}
                        className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={editingClientData.postal_code || ''}
                        onChange={(e) => setEditingClientData({ ...editingClientData, postal_code: e.target.value })}
                        className="w-full border border-slate-300 rounded p-2 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={editingClientData.country || ''}
                        onChange={(e) => setEditingClientData({ ...editingClientData, country: e.target.value })}
                        className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Additional Notes</label>
                    <textarea
                      value={editingClientData.notes || ''}
                      onChange={(e) => setEditingClientData({ ...editingClientData, notes: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-blue-500 h-[68px] resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 font-bold rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded flex items-center gap-1.5"
                >
                  {isSavingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Data</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN POPUP MODAL FOR CORRELATION TABLE */}
      {showFullTableModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-6 font-sans">
          <div className="bg-white border border-slate-700 rounded-xl w-full max-w-6xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <CompanyAvatar
                  email={selectedGroup.primaryEmail}
                  name={selectedGroup.companyName}
                  logoUrl={selectedGroup.logoUrl}
                  className="w-10 h-10"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-base text-white">{selectedGroup.companyName}</h2>
                    <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                      {selectedGroup.rfqs.length} Email RFQ | {selectedGroup.quotations.length} SPH Quotation
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedGroup.primaryClientName} ({selectedGroup.primaryEmail || 'No Email Registered'})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullTableModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  title="Close Fullscreen View"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter by subject, RFQ number, SPH number, or status..."
                    value={fullTableSearch}
                    onChange={(e) => setFullTableSearch(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-semibold text-xs">
                <span>Total Items: <strong className="text-slate-900">{correlatedPairs.length}</strong> Pairs</span>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-slate-200 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-700">
                      <th className="p-3 border-r border-slate-700 w-1/3">Detail Email Pesan (RFQ)</th>
                      <th className="p-3 border-r border-slate-700 w-1/3">Surat Penawaran Harga (SPH Quotation)</th>
                      <th className="p-3 text-center w-1/3">Aksi & Status Kirim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {correlatedPairs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 italic">
                          Belum ada data email atau SPH untuk perusahaan ini.
                        </td>
                      </tr>
                    ) : (
                      correlatedPairs
                        .filter((pair) => {
                          if (!fullTableSearch.trim()) return true;
                          const s = fullTableSearch.toLowerCase();
                          const rfqMatch = pair.rfq && (
                            (pair.rfq.subject || '').toLowerCase().includes(s) ||
                            (pair.rfq.rfq_number || '').toLowerCase().includes(s) ||
                            (pair.rfq.sender_email || '').toLowerCase().includes(s)
                          );
                          const quoMatch = pair.quotations.some(q => 
                            (q.quotation_number || '').toLowerCase().includes(s) ||
                            (q.status || '').toLowerCase().includes(s)
                          );
                          return rfqMatch || quoMatch;
                        })
                        .map((pair, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40 transition">
                            {/* Column 1: RFQ Email */}
                            <td className="p-3 border-r border-slate-200 align-top">
                              {pair.rfq ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-blue-700 bg-blue-100 border border-blue-300 font-extrabold text-xs px-2 py-0.5 rounded">
                                      {pair.rfq.rfq_number || `#${pair.rfq.id}`}
                                    </span>
                                    {pair.rfq.date_received && (
                                      <span className="text-[10px] text-slate-500 font-mono">{pair.rfq.date_received}</span>
                                    )}
                                  </div>
                                  <h4 className="font-extrabold text-slate-900 text-xs">{pair.rfq.subject || 'RFQ Message'}</h4>
                                  <p className="text-slate-600 font-mono text-[11px]">
                                    {pair.rfq.sender_name} &lt;{cleanSingleEmail(pair.rfq.sender_email)}&gt;
                                  </p>
                                  <div className="bg-slate-50 border border-slate-200 rounded p-2 text-slate-700 text-[11px] leading-relaxed line-clamp-3">
                                    {cleanEmailBodyText(pair.rfq.message_body || pair.rfq.item_requested)}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded text-center">
                                  <span className="text-slate-500 font-semibold text-xs block">Direct / Manual SPH Quotation</span>
                                  <span className="text-[10px] text-slate-400 italic">Dibuat langsung dari Sistem Quotation List</span>
                                </div>
                              )}
                            </td>

                            {/* Column 2: Quotations */}
                            <td className="p-3 border-r border-slate-200 align-top">
                              {pair.quotations.length > 0 ? (
                                <div className="space-y-2">
                                  {pair.quotations.map((q) => (
                                    <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-black text-blue-900 text-xs">
                                          {q.quotation_number || q.id}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                                          q.status === 'ready_send' || q.status === 'penawaran_terkirim' || q.status === 'done_send'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : q.approved_by
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                                        }`}>
                                          {q.status || 'Draft'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-slate-600 font-mono pt-1 border-t border-slate-100">
                                        <span>Grand Total:</span>
                                        <span className="font-extrabold text-slate-900 text-xs">
                                          RM {Number(q.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-center font-bold text-xs">
                                  Belum Memiliki SPH Quotation
                                </div>
                              )}
                            </td>

                            {/* Column 3: Actions & Kirim Quotation */}
                            <td className="p-3 align-middle text-center">
                              <div className="flex flex-col items-center justify-center gap-2">
                                {pair.rfq && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewEmailData(pair.rfq!);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition border border-slate-300 text-xs font-semibold flex items-center gap-1.5 w-full justify-center cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Preview Pesan Email</span>
                                  </button>
                                )}

                                {pair.quotations.map((q) => (
                                  <div key={q.id} className="w-full space-y-1">
                                    <a
                                      href={getApiUrl(`view_doc.php?id=${q.id}`)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-200 text-xs font-semibold flex items-center gap-1.5 w-full justify-center cursor-pointer"
                                    >
                                      <FileType className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Buka Dokumen SPH ({q.quotation_number || q.id})</span>
                                    </a>

                                    {q.status !== 'penawaran_terkirim' && q.status !== 'done_send' && q.status !== 'sent' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSendQuotationDirect(q)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition border border-emerald-700 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Kirim SPH Quotation</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateInvoiceFromQuotation(q)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition border border-emerald-700 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer"
                                        title={`Buat & Buka Invoice Otomatis dari ${q.quotation_number || q.id}`}
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Otomatis Invoice</span>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowFullTableModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-lg shadow-xs cursor-pointer"
              >
                Tutup Popup View Full
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUBBLE DETAIL INFO POPUP MODAL */}
      {infoModalData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Detail Informasi Email & Status Sistem</span>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalData(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Section 1: Info Status di Inbox (RFQ Status) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-blue-900">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Status di Inbox (Pesan Email RFQ)</span>
                  </span>
                  <span className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                    {infoModalData.rfq?.status || 'Active Thread'}
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  <div><strong className="text-slate-900">No. RFQ:</strong> {infoModalData.rfq?.rfq_number || (infoModalData.rfq?.id ? `#${infoModalData.rfq.id}` : 'General Inquiry')}</div>
                  <div><strong className="text-slate-900">Subject:</strong> {infoModalData.rfq?.subject || 'Direct Quotation Reply'}</div>
                  <div><strong className="text-slate-900">Pengirim:</strong> {infoModalData.rfq?.sender_name || selectedGroup.primaryClientName} &lt;{cleanSingleEmail(infoModalData.rfq?.sender_email || selectedGroup.primaryEmail)}&gt;</div>
                  <div><strong className="text-slate-900">Tanggal Diterima/Masuk:</strong> {infoModalData.rfq?.date_received || selectedGroup.lastActivity}</div>
                  <div><strong className="text-slate-900">Sumber Email:</strong> {infoModalData.rfq ? 'Gmail Live API / Spreadsheet Sync' : 'Direct Manual System'}</div>
                </div>
              </div>

              {/* Section 2: Info Status di Quotation Database */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-900">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Status di Database Quotation List</span>
                  </span>
                  <span className={`font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border ${
                    infoModalData.quotation?.status === 'penawaran_terkirim' || infoModalData.quotation?.status === 'done_send'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : infoModalData.quotation?.approved_by
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {infoModalData.quotation?.status || 'Draft'}
                  </span>
                </div>

                {infoModalData.quotation ? (
                  <div className="space-y-1 text-slate-700">
                    <div><strong className="text-slate-900">Nomor SPH:</strong> {infoModalData.quotation.quotation_number || infoModalData.quotation.id}</div>
                    <div><strong className="text-slate-900">Perusahaan:</strong> {infoModalData.quotation.company_name || selectedGroup.companyName}</div>
                    <div><strong className="text-slate-900">Total Penawaran:</strong> RM {Number(infoModalData.quotation.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div><strong className="text-slate-900">Tanggal Dibuat:</strong> {infoModalData.quotation.date_issued}</div>
                    {infoModalData.quotation.approved_by && (
                      <div><strong className="text-slate-900">Disetujui Oleh:</strong> {infoModalData.quotation.approved_by}</div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px]">Belum terhubung ke dokumen SPH spesifik.</p>
                )}
              </div>

              {/* Section 3: Ringkasan Isi Pesan Email */}
              {infoModalData.rfq && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <span className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider block border-b border-slate-100 pb-1">
                    Ringkasan Teks Pesan Email
                  </span>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 leading-relaxed font-sans max-h-36 overflow-y-auto whitespace-pre-wrap text-[11px]">
                    {cleanEmailBodyText(infoModalData.rfq.message_body || infoModalData.rfq.item_requested)}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {infoModalData.quotation && (
                  <a
                    href={getApiUrl(`view_doc.php?id=${infoModalData.quotation.id}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 text-xs flex items-center gap-1"
                  >
                    <FileType className="w-3.5 h-3.5" />
                    <span>Buka Web SPH</span>
                  </a>
                )}
                {infoModalData.quotation && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = infoModalData.quotation!;
                      setInfoModalData(null);
                      handleGenerateInvoiceFromQuotation(q);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Otomatis Invoice</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInfoModalData(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmailClient;
