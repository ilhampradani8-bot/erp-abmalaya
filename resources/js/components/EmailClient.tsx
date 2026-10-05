import React, { useState, useEffect, useRef } from 'react';
import { Quotation, RFQ } from '../types/erp';
import { 
  Send, CheckCircle2, X, Loader2, Sparkles, Clock, ArrowLeft,
  FileType, FileText, Search, Plus, Edit3, Building, Mail, Info, MapPin,
  Paperclip, CheckCheck, Menu, CornerUpLeft, Eye, MoreVertical, Maximize2, Save,
  UserCheck, UserPlus, Star, Trash2
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

export interface Signatory {
  id?: number;
  client_id?: number;
  company_name: string;
  name: string;
  designation: string;
  is_default?: number | boolean;
  created_at?: string;
}

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
  received_by_name?: string;
  received_by_designation?: string;
  signatories?: Signatory[];
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
      <div className={`${className} rounded-none overflow-hidden shrink-0 bg-white border border-slate-300 flex items-center justify-center p-0.5 shadow-2xs`}>
        <img
          src={targetLogoUrl}
          alt={name || 'Company Logo'}
          className="w-full h-full object-contain rounded-none"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`${className} bg-slate-900 text-white rounded-none font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs uppercase tracking-wider border border-slate-800`}>
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
    fetch(getApiUrl(`/api_clients.php?t=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setDbClients((prev) => {
            if (prev.length === resData.data.length && JSON.stringify(prev) === JSON.stringify(resData.data)) {
              return prev;
            }
            return resData.data;
          });
        }
      })
      .catch((err) => {
        console.error('Fetch clients error:', err);
      });
  };

  const fetchQuotationsData = (isInitial: boolean = false) => {
    if (isInitial) {
      setIsFetchingQuotations(true);
    }
    fetch(getApiUrl(`/api_quotations.php?t=${Date.now()}`), { cache: 'no-store' })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setInternalQuotations((prev) => {
            if (prev.length === resData.data.length && JSON.stringify(prev) === JSON.stringify(resData.data)) {
              return prev;
            }
            return resData.data;
          });
        }
      })
      .catch((err) => console.error('EmailClient quotations fetch error:', err))
      .finally(() => setIsFetchingQuotations(false));
  };

  useEffect(() => {
    fetchDbClients();
    fetchQuotationsData(true);
    const interval = setInterval(() => {
      fetchDbClients();
      fetchQuotationsData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const effectiveQuotationsList = (quotationsList && quotationsList.length > 0) ? quotationsList : internalQuotations;

  // 2. Build Company Groups by Corporate Domain & Quotation Mapping
  const companyGroups = React.useMemo(() => {
    const companyGroupsMap = new Map<string, CompanyGroup>();

    // Helper map of client emails -> dbClients for instant exact match lookup
    const emailToDbClientMap = new Map<string, ClientData>();
    dbClients.forEach((dbC) => {
      parseEmails(dbC.email).forEach((e) => {
        if (e) emailToDbClientMap.set(e.toLowerCase().trim(), dbC);
      });
    });

    // Step 1: Strictly create company groups from Quotations List ONLY (Only include companies in Quotation List)
    effectiveQuotationsList.forEach((q) => {
      const qAny = q as any;
      const qEmails = parseEmails(q.client_email);
      const primaryEmail = qEmails[0] || '';

      // Check if an existing dbClient matches by email or quotation company_name
      const matchedDbClient = emailToDbClientMap.get(primaryEmail.toLowerCase().trim());
      const effectiveCompName = (matchedDbClient?.company_name && matchedDbClient.company_name.trim() !== '') 
        ? matchedDbClient.company_name 
        : q.company_name;

      const { companyKey, companyName } = extractCompanyInfoFromEmail(primaryEmail, effectiveCompName);

      // Check if an existing group matches by domain (for corporate domains), DB ID, or exact company name
      let targetKey = companyKey;
      if (!companyGroupsMap.has(targetKey)) {
        for (const [gKey, gObj] of companyGroupsMap.entries()) {
          const isIdMatch = Boolean(matchedDbClient?.id && gObj.dbClientId && matchedDbClient.id === gObj.dbClientId);
          const domain1 = primaryEmail.includes('@') ? primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const domain2 = gObj.primaryEmail.includes('@') ? gObj.primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const isCorporateDomainMatch = Boolean(domain1 && domain2 && !PUBLIC_DOMAINS.has(domain1) && domain1 === domain2);
          const isNameMatch = Boolean(effectiveCompName && gObj.companyName.toLowerCase().trim() === effectiveCompName.toLowerCase().trim() && effectiveCompName.trim() !== '');

          if (isIdMatch || isCorporateDomainMatch || isNameMatch) {
            targetKey = gKey;
            break;
          }
        }
      }

      if (!companyGroupsMap.has(targetKey)) {
        companyGroupsMap.set(targetKey, {
          companyKey: targetKey,
          companyName: effectiveCompName || companyName,
          primaryClientName: matchedDbClient?.client_name || q.client_name || 'Client',
          primaryEmail,
          emailList: qEmails,
          phone: matchedDbClient?.phone || q.client_phone || '',
          addressLine1: matchedDbClient?.address_line1 || qAny?.address_line1 || '',
          addressLine2: matchedDbClient?.address_line2 || qAny?.address_line2 || '',
          city: matchedDbClient?.city || qAny?.city || '',
          state: matchedDbClient?.state || qAny?.state || '',
          postalCode: matchedDbClient?.postal_code || qAny?.postal_code || '',
          country: matchedDbClient?.country || qAny?.country || 'Malaysia',
          taxId: matchedDbClient?.tax_id || qAny?.tax_id || '',
          notes: matchedDbClient?.notes || qAny?.notes || '',
          dbClientId: matchedDbClient?.id,
          lastActivity: q.date_issued || 'Recent',
          quotations: [q],
          rfqs: [],
          repliedMessagesCount: q.status === 'penawaran_terkirim' || q.pdf_created === 1 ? 1 : 0,
        });
      } else {
        const group = companyGroupsMap.get(targetKey)!;
        if (effectiveCompName && (!group.companyName || group.companyName.trim() === '')) group.companyName = effectiveCompName;
        if (q.client_name && !group.primaryClientName) group.primaryClientName = q.client_name;
        if (q.client_phone && !group.phone) group.phone = q.client_phone;
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

    // Step 2: Sync metadata & extra emails from MySQL dbClients ONLY to existing quotation company groups
    dbClients.forEach((dbC) => {
      const parsed = parseEmails(dbC.email);
      const primaryEmail = parsed[0] || '';
      const { companyKey } = extractCompanyInfoFromEmail(primaryEmail, dbC.company_name);

      let targetKey = companyKey;
      let foundMatchingKey: string | null = null;

      if (companyGroupsMap.has(targetKey)) {
        foundMatchingKey = targetKey;
      } else {
        for (const [gKey, gObj] of companyGroupsMap.entries()) {
          const isIdMatch = Boolean(dbC.id && gObj.dbClientId && dbC.id === gObj.dbClientId);
          const isEmailMatch = parsed.some((e) => e && (gObj.emailList.includes(e) || cleanSingleEmail(gObj.primaryEmail) === e));
          
          const domain1 = primaryEmail.includes('@') ? primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const domain2 = gObj.primaryEmail.includes('@') ? gObj.primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const isCorporateDomainMatch = Boolean(domain1 && domain2 && !PUBLIC_DOMAINS.has(domain1) && domain1 === domain2);
          const isNameMatch = Boolean(dbC.company_name && gObj.companyName.toLowerCase().trim() === dbC.company_name.toLowerCase().trim() && dbC.company_name.trim() !== '');

          if (isIdMatch || isEmailMatch || isCorporateDomainMatch || isNameMatch) {
            foundMatchingKey = gKey;
            break;
          }
        }
      }

      if (foundMatchingKey && companyGroupsMap.has(foundMatchingKey)) {
        const existing = companyGroupsMap.get(foundMatchingKey)!;
        existing.dbClientId = dbC.id;
        // ALWAYS prioritize user's saved DB company_name over raw email prefix/username fallback!
        if (dbC.company_name && dbC.company_name.trim() !== '') {
          existing.companyName = dbC.company_name;
        }
        if (dbC.client_name) existing.primaryClientName = dbC.client_name;
        if (dbC.logo_url) existing.logoUrl = dbC.logo_url;
        if (parsed.length > 0) {
          existing.emailList = Array.from(new Set([...existing.emailList, ...parsed]));
          if (!existing.primaryEmail) existing.primaryEmail = existing.emailList[0] || '';
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

    // Step 3: Attach matching RFQ emails ONLY to existing company groups from Quotation List
    rfqList.forEach((r) => {
      const rEmails = parseEmails(r.sender_email);
      const primaryEmail = rEmails[0] || '';
      const { companyKey } = extractCompanyInfoFromEmail(primaryEmail, r.company);

      let targetKey = companyKey;
      if (!companyGroupsMap.has(targetKey)) {
        for (const [gKey, gObj] of companyGroupsMap.entries()) {
          const domain1 = primaryEmail.includes('@') ? primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const domain2 = gObj.primaryEmail.includes('@') ? gObj.primaryEmail.split('@')[1].toLowerCase().trim() : '';
          const isCorporateDomainMatch = domain1 && domain2 && !PUBLIC_DOMAINS.has(domain1) && domain1 === domain2;
          const isNameMatch = r.company && gObj.companyName.toLowerCase().trim() === r.company.toLowerCase().trim();

          if (isCorporateDomainMatch || isNameMatch) {
            targetKey = gKey;
            break;
          }
        }
      }

      // ONLY attach if company group exists in Quotation List
      if (companyGroupsMap.has(targetKey)) {
        const group = companyGroupsMap.get(targetKey)!;
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

    return Array.from(companyGroupsMap.values());
  }, [rfq, quotation, dbClients, effectiveQuotationsList, rfqList]);

  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>('');

  // Dynamically derive selectedGroup from current companyGroups so it always syncs with MySQL DB updates
  const selectedGroup = React.useMemo<CompanyGroup>(() => {
    if (companyGroups.length === 0) {
      return {
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
      };
    }
    const found = companyGroups.find((g) => g.companyKey === selectedCompanyKey);
    return found || companyGroups[0];
  }, [companyGroups, selectedCompanyKey]);

  const setSelectedGroup = (group: CompanyGroup) => {
    setSelectedCompanyKey(group.companyKey);
  };

  // UI Toggle States
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCompanyDetailPanel, setShowCompanyDetailPanel] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'table' | 'profile'>('table');
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  const isLoadingChat = false;

  // Attachment & Quoted Reply States
  const [showAttachmentPicker, setShowAttachmentPicker] = useState<boolean>(false);
  const [selectedReplyQuotation, setSelectedReplyQuotation] = useState<Quotation | null>(
    selectedGroup.quotations[0] || quotation || null
  );
  const [attachedPdfFile, setAttachedPdfFile] = useState<string | null>(null);

  // Clean Email Preview Modal State
  const [previewEmailData, setPreviewEmailData] = useState<RFQ | null>(null);

  // Document PDF Preview Popup Modal State
  const [pdfPreviewModalData, setPdfPreviewModalData] = useState<{ id: string; title: string } | null>(null);
  const [emailPdfViewerMode, setEmailPdfViewerMode] = useState<'doc' | 'pdf'>('doc');

  // Bubble Info Popup Modal State
  const [infoModalData, setInfoModalData] = useState<{ rfq?: RFQ; quotation?: Quotation } | null>(null);

  // Fullscreen Table Modal & Search State
  const [showFullTableModal, setShowFullTableModal] = useState<boolean>(false);
  const [fullTableSearch, setFullTableSearch] = useState<string>('');

  // Targeted Reply State (WhatsApp Style)
  const [selectedReplyTarget, setSelectedReplyTarget] = useState<{
    rfqId?: string;
    quotationId?: string;
    subject?: string;
    recipientEmail?: string;
    senderName?: string;
  } | null>(null);

  // PDF Generation & OCR Scanning Progress States
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [scanningOcrId, setScanningOcrId] = useState<string | null>(null);

  // Status Progression Helper Functions (Matching QuotationList.tsx)
  const isReadyForSend = (q: Quotation) => {
    const hasPrice = Number(q.grand_total) > 0 || Number(q.subtotal) > 0;
    const hasFile = Boolean(q.quotation_file) || q.pdf_created === 1;
    const hasRecipient = Boolean(q.client_email || selectedGroup.primaryEmail || selectedGroup.emailList[0]);
    return hasPrice && hasFile && hasRecipient;
  };

  const isDoneStatus = (q: Quotation) => {
    const st = (q.status || 'draft').toLowerCase();
    return st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim' || st === 'penawaran_terkirim';
  };

  const isReadySendStatus = (q: Quotation) => {
    const st = (q.status || 'draft').toLowerCase();
    return st === 'ready_send' || st === 'acc' || st === 'approved' || st === 'disetujui' || (isReadyForSend(q) && !isDoneStatus(q));
  };

  // Active quotation & RFQ selection within group
  const activeQuotation = selectedReplyQuotation || selectedGroup.quotations[0] || quotation || undefined;
  const activeRfq = selectedGroup.rfqs[0] || rfq || undefined;

  // Memoized RFQ Email ↔ SPH Quotation Correlation Pairing for Right Panel Table (Strict RFQ Matching with DB ID & RFQ Number Support)
  const correlatedPairs = React.useMemo(() => {
    const pairs: Array<{
      rfq?: RFQ;
      quotations: Quotation[];
    }> = [];

    const matchedQuoIds = new Set<string>();

    const checkMatch = (qRfqId: string, r: RFQ) => {
      if (!qRfqId || qRfqId === '0' || qRfqId === 'null') return false;
      const rId = String(r.id || '').trim();
      const rNum = String(r.rfq_number || '').trim();
      const rDbId = String(r.db_id || '').trim();
      const rLiveClean = rId.replace(/^GMAIL-LIVE-|^RFQ-/i, '');

      return (
        qRfqId === rId ||
        (rDbId !== '' && qRfqId === rDbId) ||
        (rNum !== '' && (qRfqId === rNum || qRfqId === rNum.replace(/^RFQ-/i, ''))) ||
        qRfqId === `RFQ-${rId}` ||
        qRfqId === `GMAIL-LIVE-${rId}` ||
        (rLiveClean !== '' && (qRfqId === rLiveClean || qRfqId === `RFQ-${rLiveClean}` || qRfqId === `GMAIL-LIVE-${rLiveClean}`))
      );
    };

    // 1. Pair each RFQ in selectedGroup STRICTLY with its matching Quotations
    selectedGroup.rfqs.forEach((r) => {
      const matchedQuos = selectedGroup.quotations.filter((q) => {
        const qRfqId = String(q.rfq_id || '').trim();
        return checkMatch(qRfqId, r);
      });

      matchedQuos.forEach((q) => matchedQuoIds.add(String(q.id)));
      pairs.push({ rfq: r, quotations: matchedQuos });
    });

    // 2. For remaining SPHs, check if their rfq_id points to an RFQ in the wider rfqList (e.g. from previous days or same client)
    const orphanQuos = selectedGroup.quotations.filter((q) => !matchedQuoIds.has(String(q.id)));
    orphanQuos.forEach((q) => {
      const qRfqId = String(q.rfq_id || '').trim();
      let matchedGlobalRfq: RFQ | undefined = undefined;

      if (qRfqId && qRfqId !== '0' && qRfqId !== 'null') {
        matchedGlobalRfq = rfqList.find((r) => checkMatch(qRfqId, r));
      }

      if (matchedGlobalRfq) {
        matchedQuoIds.add(String(q.id));
        pairs.push({ rfq: matchedGlobalRfq, quotations: [q] });
      } else {
        pairs.push({ rfq: undefined, quotations: [q] });
      }
    });

    return pairs;
  }, [selectedGroup, rfqList]);

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
    const clientName = targetQuo.client_name || selectedGroup.primaryClientName || 'Sir/Madam';
    const grandTotalFormatted = Number(targetQuo.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const draftBody = `Dear ${clientName},\n\n` +
      `Please find attached our official Commercial Price Quotation (SPH) with details as follows:\n\n` +
      `• Quotation No: ${quoNo}\n` +
      `• Date: ${targetQuo.date_issued || new Date().toISOString().split('T')[0]}\n` +
      `• Total Amount: MYR ${grandTotalFormatted}\n\n` +
      `The full quotation document is attached to this email.\n` +
      `Please let us know if you have any questions or require specification adjustments.\n\n` +
      `Thank you for your business.\n\n` +
      `Best regards,\n` +
      `AB Malaya Sales Team`;

    setMessageText(draftBody);

    // 4. Direct into Chat: Close popup modal & focus composer textarea (Status is preserved as-is until email is actually sent)
    setShowFullTableModal(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  };

  // Direct Action: Create PDF in background via api_pdf.php
  const handleCreatePdfBackground = async (q: Quotation) => {
    setGeneratingPdfId(q.id);
    try {
      const actorName = 'AB Malaya Sales Team';
      const actorEmail = fromEmail || 'sales@abmalaya.com';
      const res = await fetch(
        getApiUrl(
          `/api_pdf.php?action=generate&type=quotation&id=${encodeURIComponent(q.id)}&user_name=${encodeURIComponent(actorName)}&user_email=${encodeURIComponent(actorEmail)}`
        )
      );
      const data = await res.json();
      if (data.status === 'success') {
        fetchQuotationsData();
      } else {
        alert(`PDF Generation failed: ${data.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Create PDF error:', err);
      alert(`Error generating PDF: ${err?.message || 'Server connection error'}`);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  // Direct Action: Trigger AI OCR Scan via api_ocr_scan.php
  const handleTriggerOcrScan = async (q: Quotation) => {
    setScanningOcrId(q.id);
    try {
      const res = await fetch(getApiUrl('/api_ocr_scan.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quo_id: q.id,
          actor_name: 'AB Malaya Sales Team',
          actor_email: fromEmail || 'sales@abmalaya.com',
        }),
      });
      const d = await res.json();
      if (d.status === 'success') {
        fetchQuotationsData();
      } else {
        alert(`AI Scan result: ${d.message || 'Scan requested'}`);
        fetchQuotationsData();
      }
    } catch (err: any) {
      console.error('OCR scan error:', err);
      alert(`Error running AI scan: ${err?.message || 'Server error'}`);
    } finally {
      setScanningOcrId(null);
    }
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
    setToEmail(selectedGroup.primaryEmail || selectedGroup.emailList[0] || '');
    if (selectedGroup.quotations.length > 0 && !selectedReplyQuotation) {
      setSelectedReplyQuotation(selectedGroup.quotations[0]);
    }
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

    // Check if real MySQL ID exists in dbClients
    let targetDbId = editingClientData.id;
    if (!targetDbId || targetDbId > 10000000) {
      const matchComp = dbClients.find(
        (c) => c.company_name.toLowerCase().trim() === editingClientData.company_name.toLowerCase().trim()
      );
      if (matchComp && matchComp.id && matchComp.id < 10000000) {
        targetDbId = matchComp.id;
      }
    }

    const payloadToSave = {
      ...editingClientData,
      id: targetDbId && targetDbId < 10000000 ? targetDbId : 0,
      email: joinedEmails,
    };

    setIsSavingClient(true);

    fetch(getApiUrl('/api_clients.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSave),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingClient(false);
        if (resData.status === 'success') {
          const savedId = resData.id || targetDbId;
          const savedLogo = resData.logo_url || payloadToSave.logo_url;

          setDbClients((prev) => {
            const idx = prev.findIndex(
              (c) =>
                (savedId && c.id === savedId) ||
                c.company_name.toLowerCase().trim() === payloadToSave.company_name.toLowerCase().trim()
            );
            const fullRecord: ClientData = { ...payloadToSave, id: savedId, logo_url: savedLogo };
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = fullRecord;
              return copy;
            }
            return [...prev, fullRecord];
          });

          fetchDbClients();
          const { companyKey: updatedKey } = extractCompanyInfoFromEmail(joinedEmails, payloadToSave.company_name);
          setSelectedCompanyKey(updatedKey);
          setShowClientModal(false);
          alert(`Company profile for "${payloadToSave.company_name}" saved successfully!`);
        } else {
          alert(`Failed to save company profile: ${resData.message || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        setIsSavingClient(false);
        alert(`Save company error: ${err.message || err}`);
      });
  };

  // 1-Click Save Company to MySQL Database from Quotation Group
  const [isQuickSavingDb, setIsQuickSavingDb] = useState<boolean>(false);

  const handleQuickSaveCompanyGroup = (group: CompanyGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!group.companyName || !group.companyName.trim()) {
      alert('Company Name is required!');
      return;
    }
    setIsQuickSavingDb(true);

    const cleanEmails = (group.emailList && group.emailList.length > 0)
      ? group.emailList.join(', ')
      : (group.primaryEmail || '');

    const payload = {
      id: 0,
      company_name: group.companyName,
      client_name: group.primaryClientName || '',
      email: cleanEmails,
      phone: group.phone || '',
      address_line1: group.addressLine1 || '',
      address_line2: group.addressLine2 || '',
      city: group.city || '',
      state: group.state || '',
      postal_code: group.postalCode || '',
      country: group.country || 'Malaysia',
      tax_id: group.taxId || '',
      notes: group.notes || '',
    };

    fetch(getApiUrl('/api_clients.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsQuickSavingDb(false);
        if (resData.status === 'success') {
          fetchDbClients();
          alert(`Company profile "${group.companyName}" saved to contacts successfully!`);
        } else {
          alert(`Failed to save contact: ${resData.message || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        setIsQuickSavingDb(false);
        alert(`Save DB error: ${err.message || err}`);
      });
  };

  // Inline Editing for Right Panel Paper Drawer (Tab 2: Company Profile)
  const [isEditingRightProfile, setIsEditingRightProfile] = useState<boolean>(false);
  const [rightProfileEmailList, setRightProfileEmailList] = useState<string[]>([]);
  const [rightProfileNewEmailInput, setRightProfileNewEmailInput] = useState<string>('');
  const [rightProfileData, setRightProfileData] = useState<ClientData>({
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
  const [isSavingRightProfile, setIsSavingRightProfile] = useState<boolean>(false);

  useEffect(() => {
    setIsEditingRightProfile(false);
  }, [selectedGroup.companyKey]);

  const handleStartEditingRightProfile = () => {
    // Strictly find matching dbClient record by ID, email, or company name
    const matchedDbClient = dbClients.find(
      (c) =>
        (selectedGroup.dbClientId && c.id === selectedGroup.dbClientId) ||
        (c.company_name && c.company_name.toLowerCase().trim() === selectedGroup.companyName.toLowerCase().trim()) ||
        parseEmails(c.email).some((e) => e && (selectedGroup.emailList.includes(e) || cleanSingleEmail(selectedGroup.primaryEmail) === e))
    );

    const activeDbId = matchedDbClient?.id || selectedGroup.dbClientId;
    const rawEmailStr = matchedDbClient?.email || selectedGroup.emailList.join(', ') || selectedGroup.primaryEmail || '';
    const parsedList = parseEmails(rawEmailStr);
    const initialEmails = parsedList.length > 0 ? parsedList : (selectedGroup.emailList.length > 0 ? [...selectedGroup.emailList] : [cleanSingleEmail(selectedGroup.primaryEmail) || '']);
    setRightProfileEmailList(initialEmails);
    setRightProfileNewEmailInput('');

    setRightProfileData({
      id: activeDbId,
      company_name: matchedDbClient?.company_name || selectedGroup.companyName || '',
      client_name: matchedDbClient?.client_name || selectedGroup.primaryClientName || '',
      email: initialEmails.filter(Boolean).join(', '),
      phone: matchedDbClient?.phone || selectedGroup.phone || '',
      address_line1: matchedDbClient?.address_line1 || selectedGroup.addressLine1 || '',
      address_line2: matchedDbClient?.address_line2 || selectedGroup.addressLine2 || '',
      city: matchedDbClient?.city || selectedGroup.city || '',
      state: matchedDbClient?.state || selectedGroup.state || '',
      postal_code: matchedDbClient?.postal_code || selectedGroup.postalCode || '',
      country: matchedDbClient?.country || selectedGroup.country || 'Malaysia',
      tax_id: matchedDbClient?.tax_id || selectedGroup.taxId || '',
      notes: matchedDbClient?.notes || selectedGroup.notes || '',
    });
    setIsEditingRightProfile(true);
  };

  const handleSaveRightProfileData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rightProfileData.company_name.trim()) {
      alert('Company Name is required!');
      return;
    }
    setIsSavingRightProfile(true);

    const targetDbClient = dbClients.find(
      (c) =>
        (rightProfileData.id && c.id === rightProfileData.id) ||
        (selectedGroup.dbClientId && c.id === selectedGroup.dbClientId) ||
        (c.company_name && c.company_name.toLowerCase().trim() === selectedGroup.companyName.toLowerCase().trim()) ||
        parseEmails(c.email).some((e) => e && (selectedGroup.emailList.includes(e) || cleanSingleEmail(selectedGroup.primaryEmail) === e))
    );

    const activeDbId = rightProfileData.id || targetDbClient?.id || selectedGroup.dbClientId || 0;
    const cleanList = rightProfileEmailList.map(e => e.trim()).filter(Boolean);
    const joinedEmails = cleanList.join(', ');

    const payload = {
      ...rightProfileData,
      email: joinedEmails,
      id: activeDbId,
      old_company_name: targetDbClient?.company_name || selectedGroup.companyName || '',
    };

    fetch(getApiUrl('/api_clients.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingRightProfile(false);
        if (resData.status === 'success') {
          const newKey = extractCompanyInfoFromEmail(selectedGroup.primaryEmail, payload.company_name).companyKey;
          if (newKey) setSelectedCompanyKey(newKey);
          fetchDbClients();
          fetchQuotationsData();
          setIsEditingRightProfile(false);
          alert(`Company profile "${payload.company_name}" updated successfully!`);
        } else {
          alert(`Failed to save profile: ${resData.message || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        setIsSavingRightProfile(false);
        alert(`Save profile error: ${err.message || err}`);
      });
  };

  // ── SIGNATORY & RECEIVED-BY MANAGEMENT ─────────────────────────────────────
  const [companySignatories, setCompanySignatories] = useState<Signatory[]>([]);
  const [isLoadingSignatories, setIsLoadingSignatories] = useState<boolean>(false);
  const [isAddingSignatory, setIsAddingSignatory] = useState<boolean>(false);
  const [newSigName, setNewSigName] = useState<string>('');
  const [newSigDesignation, setNewSigDesignation] = useState<string>('');
  const [newSigIsDefault, setNewSigIsDefault] = useState<boolean>(false);
  const [isSavingSignatory, setIsSavingSignatory] = useState<boolean>(false);
  const [signatorySuccessNotice, setSignatorySuccessNotice] = useState<string | null>(null);

  // Fetch signatories for selected company
  const fetchSignatoriesForCompany = (compName: string, clientId?: number) => {
    if (!compName && !clientId) {
      setCompanySignatories([]);
      return;
    }
    setIsLoadingSignatories(true);
    const url = clientId && clientId > 0 
      ? `/api_clients.php?action=signatories&client_id=${clientId}&company_name=${encodeURIComponent(compName || '')}`
      : `/api_clients.php?action=signatories&company_name=${encodeURIComponent(compName || '')}`;

    fetch(getApiUrl(url))
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingSignatories(false);
        if (data.status === 'success' && Array.isArray(data.data)) {
          setCompanySignatories(data.data);
        }
      })
      .catch((err) => {
        setIsLoadingSignatories(false);
        console.error('Error fetching signatories:', err);
      });
  };

  useEffect(() => {
    fetchSignatoriesForCompany(selectedGroup.companyName, selectedGroup.dbClientId);
  }, [selectedGroup.companyKey, selectedGroup.companyName, selectedGroup.dbClientId]);

  // Add / Save Signatory
  const handleSaveNewSignatory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSigName.trim()) {
      alert('PIC / Signatory name is required!');
      return;
    }
    const targetComp = selectedGroup.companyName || editingClientData.company_name || 'Client Company';
    setIsSavingSignatory(true);

    try {
      const res = await fetch(getApiUrl('/api_clients.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_signatory',
          client_id: selectedGroup.dbClientId || 0,
          company_name: targetComp,
          name: newSigName.trim(),
          designation: newSigDesignation.trim(),
          is_default: newSigIsDefault || companySignatories.length === 0 ? 1 : 0,
        }),
      });
      const data = await res.json();
      setIsSavingSignatory(false);
      if (data.status === 'success') {
        setNewSigName('');
        setNewSigDesignation('');
        setNewSigIsDefault(false);
        setIsAddingSignatory(false);
        setSignatorySuccessNotice('PIC Signatory saved to database successfully!');
        setTimeout(() => setSignatorySuccessNotice(null), 3000);
        fetchSignatoriesForCompany(targetComp, selectedGroup.dbClientId);
        fetchDbClients();
      } else {
        alert(data.message || 'Failed to save signatory');
      }
    } catch (err: any) {
      setIsSavingSignatory(false);
      alert('Failed to save signatory: ' + (err?.message || 'Network error'));
    }
  };

  // Set Signatory as Default
  const handleSetDefaultSignatory = async (sig: Signatory) => {
    if (!sig.id) return;
    try {
      const res = await fetch(getApiUrl('/api_clients.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_signatory',
          id: sig.id,
          client_id: sig.client_id || selectedGroup.dbClientId || 0,
          company_name: sig.company_name || selectedGroup.companyName,
          name: sig.name,
          designation: sig.designation,
          is_default: 1,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSignatorySuccessNotice(`"${sig.name}" is now the default signatory!`);
        setTimeout(() => setSignatorySuccessNotice(null), 3000);
        fetchSignatoriesForCompany(selectedGroup.companyName, selectedGroup.dbClientId);
        fetchDbClients();
      }
    } catch (err: any) {
      console.error('Error setting default signatory:', err);
    }
  };

  // Delete Signatory
  const handleDeleteSignatory = async (sigId?: number) => {
    if (!sigId) return;
    if (!confirm('Delete this PIC Signatory?')) return;
    try {
      const res = await fetch(getApiUrl('/api_clients.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_signatory',
          id: sigId,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSignatorySuccessNotice('Signatory deleted successfully!');
        setTimeout(() => setSignatorySuccessNotice(null), 3000);
        fetchSignatoriesForCompany(selectedGroup.companyName, selectedGroup.dbClientId);
        fetchDbClients();
      }
    } catch (err: any) {
      console.error('Error deleting signatory:', err);
    }
  };

  // Send Email Handler
  const handleSendEmail = () => {
    if (!messageText.trim()) return;
    setSending(true);

    const targetId = selectedReplyTarget?.quotationId || selectedReplyTarget?.rfqId || activeQuotation?.id || activeRfq?.id || 'RFQ-001';
    const recipient = selectedReplyTarget?.recipientEmail || toEmail || selectedGroup.primaryEmail || selectedGroup.emailList[0] || '';

    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: targetId,
        quotation_id: selectedReplyTarget?.quotationId || activeQuotation?.id,
        status: 'penawaran_terkirim',
        reply_body: messageText,
        reply_sender: fromEmail,
        target_client_email: recipient,
        attachment_file: attachedPdfFile || activeQuotation?.quotation_file || null,
        user_name: 'AB Malaya Sales Team (Staff PIC)',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSending(false);
        if (data.status === 'success') {
          selectedGroup.repliedMessagesCount += 1;
          const sentText = messageText;
          setMessageText('');
          setSelectedReplyTarget(null);
          setAttachedPdfFile(null);
          setSelectedReplyQuotation(null);

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

          fetchQuotationsData();
          fetchDbClients();

          if (onSuccessSend) onSuccessSend(sentText, fromEmail);
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
  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) return companyGroups;
    const q = searchQuery.toLowerCase();
    return companyGroups.filter((g) =>
      g.companyName.toLowerCase().includes(q) ||
      g.primaryClientName.toLowerCase().includes(q) ||
      g.emailList.some((e) => e.toLowerCase().includes(q))
    );
  }, [companyGroups, searchQuery]);

  return (
    <div
      className={
        isModalMode
          ? 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 font-sans animate-in fade-in'
          : 'h-full w-full flex flex-col font-sans'
      }
    >
      <div
        className={`bg-white rounded-none shadow-2xl flex flex-col overflow-hidden border border-slate-700 ${
          isModalMode ? 'w-full max-w-7xl h-[92vh]' : 'w-full h-full'
        }`}
      >

        {/* MAIN SPLIT VIEW */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* SIDEBAR — COMPANY PROFILES LIST (COLLAPSIBLE / RESPONSIVE WA STYLE) */}
          {isSidebarOpen && (
            <div className={`w-full sm:w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 min-h-0 transition-all duration-300 ${
              mobileView === 'chat' ? 'hidden sm:flex' : 'flex'
            }`}>
              
              {/* Sidebar Header & Search Box */}
              <div className="p-2.5 border-b border-slate-200 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-1 hover:bg-slate-100 rounded-none text-slate-700 transition cursor-pointer border border-slate-300"
                    title="Hide Sidebar"
                  >
                    <Menu className="w-4 h-4 text-slate-700" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-xs text-slate-900 tracking-wide uppercase">Email Client</span>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Company / Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-300 rounded-none text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>
              </div>

              {/* List of Company Profiles */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {isFetchingQuotations && effectiveQuotationsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600 flex flex-col items-center justify-center space-y-2.5">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <span className="font-extrabold text-slate-800">Loading Quotations...</span>
                    <span className="text-[10px] text-slate-400 leading-tight">Syncing latest quotation data</span>
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700">No Quotations or Companies Found.</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">Only companies registered in the Quotation List are displayed.</p>
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const isSelected = selectedGroup.companyKey === group.companyKey;
                    return (
                      <div
                        key={group.companyKey}
                        onClick={() => {
                          setSelectedGroup(group);
                          setMobileView('chat');
                        }}
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
                                  Replied
                                </span>
                              ) : (
                                <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">
                                  Pending
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
                            {group.dbClientId ? (
                              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded flex items-center gap-0.5 shrink-0" title="Saved to official contacts">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Saved
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isQuickSavingDb}
                                onClick={(e) => handleQuickSaveCompanyGroup(group, e)}
                                className="text-[9px] font-extrabold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1 py-0.2 rounded flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0"
                                title="Save company to official contacts"
                              >
                                <Save className="w-2.5 h-2.5 text-amber-700" />
                                <span>+ Save Contact</span>
                              </button>
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
          <div className={`flex-1 flex flex-col bg-white min-w-0 min-h-0 ${
            mobileView === 'sidebar' ? 'hidden sm:flex' : 'flex'
          }`}>
            
            {/* WhatsApp-Style Native Chat Header Bar */}
            <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 rounded-none">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Mobile WhatsApp-Style Back Button */}
                <button
                  type="button"
                  onClick={() => setMobileView('sidebar')}
                  className="sm:hidden p-1.5 bg-white hover:bg-slate-200 text-slate-800 rounded-none transition cursor-pointer shrink-0 border border-slate-300"
                  title="Back to Company List"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-800" />
                </button>

                {/* Burger Button (Toggle Sidebar) */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-none transition cursor-pointer shrink-0 border border-slate-300"
                  title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                >
                  <Menu className="w-4 h-4 text-slate-700" />
                </button>

                {/* Dynamic Square Avatar */}
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
                    className="w-9 h-9 rounded-none"
                  />
                </button>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-2">
                    <span>{selectedGroup.companyName}</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono">
                      ({selectedGroup.lastActivity})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 truncate font-mono flex items-center gap-1.5 mt-0.5">
                    {selectedGroup.primaryClientName && (
                      <span className="font-bold text-slate-800">{selectedGroup.primaryClientName} — </span>
                    )}
                    <span className="truncate text-blue-700 font-medium" title={selectedGroup.emailList.join(', ') || selectedGroup.primaryEmail}>
                      {selectedGroup.emailList && selectedGroup.emailList.length > 0
                        ? selectedGroup.emailList.join(', ')
                        : cleanSingleEmail(selectedGroup.primaryEmail) || 'No Email'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCompanyDetailPanel(!showCompanyDetailPanel)}
                  className={`p-1.5 border rounded-none transition cursor-pointer flex items-center justify-center ${
                    showCompanyDetailPanel ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                  title="Corporate Profile Details"
                >
                  <Building className="w-4 h-4" />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                    className="p-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-none transition cursor-pointer flex items-center justify-center"
                    title="Options Menu"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-600" />
                  </button>

                  {showHeaderMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-300 rounded-none shadow-xl z-50 py-1 font-sans text-xs">
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

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          handleOpenAddClient();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-800 transition flex items-center gap-2 font-bold cursor-pointer border-t border-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Add New Company</span>
                      </button>
                    </div>
                  )}
                </div>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 rounded-none transition cursor-pointer border border-slate-300"
                    title="Close Email Client"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
                  {(() => {
                    const effectiveRfqs = (() => {
                      const list: any[] = [];
                      if (selectedGroup.rfqs && selectedGroup.rfqs.length > 0) {
                        selectedGroup.rfqs.forEach((r) => {
                          const linkedQuo = selectedGroup.quotations.find((q) => {
                            const qRfqId = String(q.rfq_id || '').trim();
                            if (!qRfqId || qRfqId === '0' || qRfqId === 'null') return false;
                            const rId = String(r.id || '').trim();
                            const rNum = String(r.rfq_number || '').trim();
                            const rDbId = String(r.db_id || '').trim();
                            const rLiveClean = rId.replace(/^GMAIL-LIVE-|^RFQ-/i, '');
                            return (
                              qRfqId === rId ||
                              (rDbId !== '' && qRfqId === rDbId) ||
                              (rNum !== '' && (qRfqId === rNum || qRfqId === rNum.replace(/^RFQ-/i, ''))) ||
                              qRfqId === `RFQ-${rId}` ||
                              qRfqId === `GMAIL-LIVE-${rId}` ||
                              (rLiveClean !== '' && (qRfqId === rLiveClean || qRfqId === `RFQ-${rLiveClean}`))
                            );
                          }) || selectedGroup.quotations[0];

                          list.push({
                            id: String(r.id),
                            company: r.company || selectedGroup.companyName,
                            sender_name: r.sender_name || selectedGroup.primaryClientName,
                            sender_email: cleanSingleEmail(r.sender_email) || selectedGroup.primaryEmail,
                            phone: r.phone || selectedGroup.phone,
                            subject: r.subject || `Email Inquiry from ${r.sender_name || selectedGroup.companyName}`,
                            item_requested: r.item_requested || 'Commercial Inquiry',
                            message_body: r.message_body || r.item_requested || `Official email inquiry from ${r.sender_name || selectedGroup.companyName}.`,
                            date_received: r.date_received || selectedGroup.lastActivity || 'Recent',
                            status: r.status || 'masuk',
                            quotation_number: linkedQuo?.quotation_number,
                            rawQuotation: linkedQuo,
                            rawRfq: r,
                          });
                        });
                      }

                      selectedGroup.quotations.forEach((q, idx) => {
                        const isAlreadyRepresented = list.some((it) => it.rawQuotation?.id === q.id);
                        if (!isAlreadyRepresented) {
                          list.push({
                            id: String(q.id || idx + 1000),
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
                            rawQuotation: q,
                          });
                        }
                      });

                      return list;
                    })();

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
                                            <span>Replied</span>
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded w-fit flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-amber-600" />
                                            <span>Pending Reply</span>
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
                                          const cleanEmail = cleanSingleEmail(rfqItem.sender_email) || selectedGroup.primaryEmail;
                                          setToEmail(cleanEmail);
                                          setSelectedReplyTarget({
                                            rfqId: String(rfqItem.id),
                                            quotationId: linkedQuotation?.id,
                                            subject: rfqItem.subject || 'Quotation Request',
                                            recipientEmail: cleanEmail,
                                            senderName: rfqItem.sender_name || selectedGroup.primaryClientName,
                                          });
                                          if (linkedQuotation) {
                                            setSelectedReplyQuotation(linkedQuotation);
                                          }
                                          if (textareaRef.current) {
                                            textareaRef.current.focus();
                                          }
                                        }}
                                        className="text-[10px] font-extrabold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition hover:bg-blue-100"
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

                        {/* Right Bubbles (Sent SPH Replies - Supports Multi-Reply History Balasan #1, Balasan #2) */}
                        {selectedGroup.quotations.filter(q => q.status === 'penawaran_terkirim' || q.status === 'done_send' || q.status === 'sent').map((quoItem, quoIdx) => (
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

                              <div className="bg-blue-100 text-slate-900 rounded-none shadow-xs border border-blue-200 p-3 font-sans text-xs space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 border-b border-blue-200/60 pb-1">
                                  <span className="font-extrabold text-blue-900 flex items-center gap-1">
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                                    <span>AB Malaya Sales Team — <span className="text-[10px] text-blue-800 bg-blue-200/80 px-1 rounded font-mono">Reply #{quoIdx + 1}</span></span>
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">{quoItem.date_issued}</span>
                                </div>

                                <div className="font-bold text-slate-800">
                                  Quotation Reply #{quoItem.quotation_number || quoItem.id}
                                </div>

                                <p className="text-slate-700 text-[11px] whitespace-pre-wrap">
                                  Quotation offer of RM {(quoItem.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been issued and sent.
                                </p>

                                <div className="pt-1 flex items-center justify-between gap-2 flex-wrap border-t border-blue-200/40">
                                  {quoItem.quotation_file ? (
                                    <a
                                      href={getApiUrl(quoItem.quotation_file)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 bg-blue-700 text-white px-2 py-0.5 rounded-none text-[10px] font-bold shadow-2xs hover:bg-blue-800 transition"
                                    >
                                      <FileType className="w-3 h-3" />
                                      <span>Download Quotation PDF</span>
                                    </a>
                                  ) : (
                                    <span></span>
                                  )}

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleanEmail = cleanSingleEmail(quoItem.client_email) || selectedGroup.primaryEmail;
                                        setToEmail(cleanEmail);
                                        setSelectedReplyTarget({
                                          rfqId: String(quoItem.rfq_id || quoItem.id),
                                          quotationId: quoItem.id,
                                          subject: `Reply #${quoIdx + 2}: Quotation ${quoItem.quotation_number || quoItem.id}`,
                                          recipientEmail: cleanEmail,
                                          senderName: quoItem.client_name || selectedGroup.primaryClientName,
                                        });
                                        setSelectedReplyQuotation(quoItem);
                                        if (textareaRef.current) {
                                          textareaRef.current.focus();
                                        }
                                      }}
                                      className="text-[10px] font-extrabold text-blue-800 hover:text-blue-950 inline-flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-none border border-blue-300 shadow-2xs transition"
                                    >
                                      <CornerUpLeft className="w-3 h-3 text-blue-600" />
                                      <span>Reply (Reply #{quoIdx + 2})</span>
                                    </button>
                                  </div>
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

            {/* QUOTED REPLY BANNER OR NEW EMAIL RECIPIENT SELECTOR */}
            {selectedReplyTarget ? (
              <div className="bg-blue-50 border-l-4 border-blue-600 px-3 py-2 flex items-center justify-between text-xs font-sans border-t border-b border-blue-200 shrink-0">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <CornerUpLeft className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-extrabold text-blue-900 truncate block">
                      Replying to Email: {selectedReplyTarget.senderName || 'Client'} ({selectedReplyTarget.recipientEmail})
                    </span>
                    <span className="text-[11px] text-slate-600 font-mono truncate block">
                      Subject / RFQ: {selectedReplyTarget.subject || selectedReplyTarget.rfqId || 'Quotation Request'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReplyTarget(null)}
                  className="p-1 hover:bg-blue-200 text-slate-600 rounded-none cursor-pointer shrink-0 ml-2"
                  title="Cancel Reply Mode"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-slate-100 border-t border-b border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-sans flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-bold text-slate-700 text-xs shrink-0 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>To:</span>
                  </span>
                  <select
                    value={toEmail || selectedGroup.primaryEmail || ''}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-900 text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-blue-500 min-w-0 max-w-xs cursor-pointer shadow-2xs"
                  >
                    {Array.from(new Set([selectedGroup.primaryEmail, ...selectedGroup.emailList].filter(Boolean))).map((email) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold shrink-0 hidden sm:inline">
                  Direct Email Mode
                </span>
              </div>
            )}

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
                <div className="w-full bg-white border border-slate-300 focus-within:border-blue-500 rounded-none px-3 py-1.5 flex items-center shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                    placeholder={
                      selectedReplyTarget
                        ? `Type email reply for ${selectedReplyTarget.senderName || selectedGroup.companyName}...`
                        : `Type a new email message for ${selectedGroup.companyName}...`
                    }
                    className="w-full bg-transparent text-xs text-slate-900 focus:outline-none resize-none font-sans leading-relaxed disabled:opacity-50 disabled:bg-slate-50 cursor-text"
                    style={{ minHeight: '38px', maxHeight: '140px' }}
                  />
                </div>
              </div>

              {/* Circular WhatsApp Send Button */}
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !messageText.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-none flex items-center justify-center transition cursor-pointer disabled:opacity-40 shadow-md shrink-0 mb-0.5"
                title={selectedReplyTarget ? "Send Email Reply" : `Send Direct Email to ${toEmail || selectedGroup.primaryEmail}`}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white ml-0.5" />}
              </button>

            </div>

          </div>

          {/* RIGHT PANEL — CORPORATE PROFILE SLIDE-OVER RIGHT POPUP DRAWER */}
          {showCompanyDetailPanel && (
            <div
              onClick={() => setShowCompanyDetailPanel(false)}
              className="fixed inset-0 z-50 flex justify-end bg-transparent font-sans animate-in fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md sm:max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200 overflow-hidden"
              >
                
                {/* Popup Header */}
                <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <Building className="w-4.5 h-4.5 text-blue-400" />
                    <span>Company Profile & Details</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCompanyDetailPanel(false)}
                    className="text-slate-400 hover:text-white transition p-1 rounded cursor-pointer"
                    title="Close Details"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Popup Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
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
                      <span>Email & Quotation List ({correlatedPairs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRightTab('profile')}
                      className={`flex-1 py-1.5 px-2 rounded font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeRightTab === 'profile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Company Profile</span>
                    </button>
                  </div>

                  {selectedGroup.dbClientId ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs shadow-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Saved in Official Contacts (ID: #{selectedGroup.dbClientId})</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                        Official Contact
                      </span>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs shadow-xs space-y-2">
                      <div className="flex items-start gap-2 text-amber-900">
                        <Info className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-extrabold text-xs">Not Saved in Contacts Yet</p>
                          <p className="text-amber-800 text-[11px] leading-relaxed mt-0.5">
                            This company was extracted from SPH Quotations. Click save below to register it in official client contacts.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isQuickSavingDb}
                        onClick={() => handleQuickSaveCompanyGroup(selectedGroup)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                      >
                        {isQuickSavingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>+ Save to Contacts</span>
                      </button>
                    </div>
                  )}

                  {/* TAB 1: CORRELATION TABLE (Full Width Table) */}
                  {activeRightTab === 'table' && (
                    <div className="w-full overflow-x-auto border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-extrabold text-slate-600">
                            <th className="p-2 border-r border-slate-200 w-2/5">Email Message (RFQ)</th>
                            <th className="p-2 border-r border-slate-200 w-3/5">SPH Quotation & Action Workflow</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-sans">
                          {correlatedPairs.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-4 text-center text-slate-400 italic">
                                No email messages or quotations found for this company.
                              </td>
                            </tr>
                          ) : (
                            correlatedPairs.map((pair, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition">
                                {/* Column 1: Pesan Email */}
                                <td className="p-2 border-r border-slate-200 align-top">
                                  {pair.rfq ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span className="font-mono text-blue-700 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                                          {pair.rfq.rfq_number || `#${pair.rfq.id}`}
                                        </span>
                                      </div>
                                      <p className="font-bold text-slate-900 text-[11px] truncate max-w-[130px]" title={pair.rfq.subject}>
                                        {pair.rfq.subject || 'RFQ Email'}
                                      </p>
                                      <p className="text-[10px] font-mono text-slate-600 truncate max-w-[130px]">
                                        {cleanSingleEmail(pair.rfq.sender_email)}
                                      </p>
                                      {pair.rfq.date_received && (
                                        <span className="text-[9px] text-slate-400 block font-mono">{pair.rfq.date_received}</span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setPreviewEmailData(pair.rfq!)}
                                        className="mt-1 px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded transition border border-slate-200 cursor-pointer text-[9px] font-bold inline-flex items-center gap-1"
                                        title="Preview Raw Email Message"
                                      >
                                        <Eye className="w-3 h-3 text-blue-600" />
                                        <span>Preview</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px] font-mono block p-1">
                                      Direct / Manual SPH
                                    </span>
                                  )}
                                </td>

                                {/* Column 2: Aligned SPH Quotation Details & Action Buttons */}
                                <td className="p-1.5 align-top">
                                  {pair.quotations.length > 0 ? (
                                    <div className="space-y-2">
                                      {pair.quotations.map((q, qIdx) => {
                                        const isDone = isDoneStatus(q);
                                        const isReady = isReadySendStatus(q);
                                        const pdfReady = Boolean(q.quotation_file) || q.pdf_created === 1;
                                        const ocrDone = q.ocr_scan_status === 'done' || q.ocr_scan_status === 'skipped';
                                        const isScanning = scanningOcrId === q.id || q.ocr_scan_status === 'processing';
                                        const isGeneratingPdf = generatingPdfId === q.id;

                                        return (
                                          <div
                                            key={q.id}
                                            className={`p-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-1.5 shadow-2xs ${
                                              qIdx > 0 ? 'border-t-2 border-t-slate-300 pt-2 mt-2' : ''
                                            }`}
                                          >
                                            {/* SPH Info */}
                                            <div className="flex-1 space-y-1 text-left min-w-0">
                                              <div className="flex items-center justify-between gap-1">
                                                <span className="font-mono font-black text-blue-900 text-[10px] truncate">
                                                  {q.quotation_number || q.id}
                                                </span>
                                                {(() => {
                                                  const badgeClass = isDone
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    : isReady
                                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                    : 'bg-amber-100 text-amber-800 border border-amber-300';
                                                  const badgeLabel = isDone ? 'Done' : isReady ? 'Ready to Send' : 'Draft';
                                                  return (
                                                    <span className={`px-1 py-0.2 rounded text-[8px] font-extrabold uppercase tracking-tight shrink-0 ${badgeClass}`}>
                                                      {badgeLabel}
                                                    </span>
                                                  );
                                                })()}
                                              </div>
                                              <div className="text-[9px] text-slate-600 font-mono pt-0.5 border-t border-slate-200/80 flex items-center justify-between gap-1">
                                                <span>Total:</span>
                                                <span className="font-extrabold text-slate-900">
                                                  RM {Number(q.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Vertical Divider */}
                                            <div className="w-[1px] bg-slate-300 self-stretch shrink-0" />

                                            {/* Action Buttons */}
                                            <div className="w-24 shrink-0 flex flex-col items-center justify-center gap-1">
                                              {!ocrDone && !isDone && (
                                                <button
                                                  type="button"
                                                  disabled={isScanning}
                                                  onClick={() => handleTriggerOcrScan(q)}
                                                  className={`px-1 py-0.5 text-white rounded transition border cursor-pointer flex items-center justify-center gap-1 text-[8px] font-extrabold shadow-2xs w-full ${
                                                    isScanning
                                                      ? 'bg-purple-400 border-purple-500 cursor-not-allowed'
                                                      : q.ocr_scan_status === 'waiting_ai_limit' || q.ocr_scan_status === 'waiting'
                                                      ? 'bg-amber-600 hover:bg-amber-700 border-amber-700'
                                                      : 'bg-purple-600 hover:bg-purple-700 border-purple-700'
                                                  }`}
                                                  title="Run AI OCR Item Scanning"
                                                >
                                                  {isScanning ? (
                                                    <>
                                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                      <span>Scanning...</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                                      <span>{q.ocr_scan_status === 'waiting_ai_limit' ? 'Waiting AI' : 'Scan AI'}</span>
                                                    </>
                                                  )}
                                                </button>
                                              )}

                                              {!pdfReady && !isDone && (
                                                <button
                                                  type="button"
                                                  disabled={isGeneratingPdf}
                                                  onClick={() => handleCreatePdfBackground(q)}
                                                  className="px-1 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition border border-blue-700 cursor-pointer flex items-center justify-center gap-1 text-[8px] font-extrabold shadow-2xs w-full disabled:opacity-75"
                                                  title="Generate PDF SPH Document"
                                                >
                                                  {isGeneratingPdf ? (
                                                    <>
                                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                      <span>Generating...</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <FileType className="w-2.5 h-2.5" />
                                                      <span>Create PDF</span>
                                                    </>
                                                  )}
                                                </button>
                                              )}

                                              {pdfReady ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setPdfPreviewModalData({ id: q.quotation_number || q.id, title: q.quotation_number || q.id })}
                                                  className="px-1 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-[8px] font-extrabold flex items-center justify-center gap-1 border border-blue-200 transition shadow-2xs w-full cursor-pointer"
                                                  title={`Preview Quotation Doc ${q.quotation_number || q.id}`}
                                                >
                                                  <Eye className="w-2.5 h-2.5 text-blue-600" />
                                                  <span>View Doc</span>
                                                </button>
                                              ) : (
                                                <span className="px-1 py-0.5 bg-slate-100 border border-slate-200 text-slate-400 text-[8px] font-extrabold rounded flex items-center justify-center gap-1 w-full text-center">
                                                  No File
                                                </span>
                                              )}

                                              {!isDone && (isReady || pdfReady) && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleSendQuotationDirect(q)}
                                                  className="px-1 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition border border-emerald-700 cursor-pointer flex items-center justify-center gap-1 text-[8px] font-extrabold shadow-2xs w-full"
                                                  title={`Send SPH ${q.quotation_number || q.id}`}
                                                >
                                                  <Send className="w-2.5 h-2.5" />
                                                  <span>Ready to Send</span>
                                                </button>
                                              )}

                                              {isDone && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleGenerateInvoiceFromQuotation(q)}
                                                  className="px-1 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition border border-emerald-800 cursor-pointer flex items-center justify-center gap-1 text-[8px] font-extrabold shadow-2xs w-full"
                                                  title="Generate & View Automatic Invoice"
                                                >
                                                  <FileText className="w-2.5 h-2.5" />
                                                  <span>Auto Invoice</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold block text-center mt-1">
                                      No Quotation
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: COMPANY PROFILE DETAILS */}
                  {activeRightTab === 'profile' && (
                    <div className="space-y-4">
                      {isEditingRightProfile ? (
                        /* INLINE EDIT FORM FOR RIGHT PANEL DRAWER */
                        <form onSubmit={handleSaveRightProfileData} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-3 text-xs">
                          <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-blue-700 font-extrabold">
                              <Edit3 className="w-3.5 h-3.5" /> Edit Company Profile
                            </span>
                            <span className="text-slate-400 text-[10px] lowercase font-normal">Direct Inline Edit</span>
                          </div>

                          <div className="space-y-2.5">
                            <div>
                              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                                Company Name <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={rightProfileData.company_name}
                                onChange={(e) => setRightProfileData({ ...rightProfileData, company_name: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                placeholder="e.g. PT MIJ DIGITAL INDONESIA"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Person / PIC</label>
                                <input
                                  type="text"
                                  value={rightProfileData.client_name || ''}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, client_name: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="PIC Name"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                                <input
                                  type="text"
                                  value={rightProfileData.phone || ''}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, phone: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="+60123456789"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-bold text-slate-700">Contact Emails (Dropdown & List)</label>
                                <span className="text-[10px] text-blue-700 font-extrabold font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {rightProfileEmailList.length} Emails
                                </span>
                              </div>

                              {/* Quick Dropdown Selector for Connected Domain Emails */}
                              {selectedGroup.emailList && selectedGroup.emailList.length > 0 && (
                                <div className="mb-2">
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      if (val && !rightProfileEmailList.includes(val)) {
                                        const updated = [...rightProfileEmailList, val];
                                        setRightProfileEmailList(updated);
                                        setRightProfileData(prev => ({ ...prev, email: updated.join(', ') }));
                                      }
                                    }}
                                    className="w-full bg-blue-50/90 border border-blue-300 text-blue-900 rounded px-2 py-1 text-xs font-mono focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
                                  >
                                    <option value="">+ Select & Add from Connected Emails ({selectedGroup.emailList.length})...</option>
                                    {selectedGroup.emailList.map((em, idx) => (
                                      <option key={idx} value={em} disabled={rightProfileEmailList.includes(em)}>
                                        {em} {rightProfileEmailList.includes(em) ? '(Already Added)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Interactive Email List */}
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 bg-slate-50 p-2 rounded border border-slate-200">
                                {rightProfileEmailList.length === 0 ? (
                                  <p className="text-slate-400 italic text-[11px] text-center py-2">
                                    No contact email yet. Select from dropdown or type below.
                                  </p>
                                ) : (
                                  rightProfileEmailList.map((em, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded shadow-2xs">
                                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <input
                                        type="email"
                                        value={em}
                                        onChange={(e) => {
                                          const updated = [...rightProfileEmailList];
                                          updated[idx] = e.target.value;
                                          setRightProfileEmailList(updated);
                                          setRightProfileData(prev => ({ ...prev, email: updated.filter(Boolean).join(', ') }));
                                        }}
                                        placeholder="name@company.com"
                                        className="flex-1 text-xs font-mono text-slate-800 bg-transparent focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = rightProfileEmailList.filter((_, i) => i !== idx);
                                          setRightProfileEmailList(updated);
                                          setRightProfileData(prev => ({ ...prev, email: updated.filter(Boolean).join(', ') }));
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                        title="Remove email"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Add New Email Input Row */}
                              <div className="flex items-center gap-1.5 mt-2">
                                <input
                                  type="email"
                                  value={rightProfileNewEmailInput}
                                  onChange={(e) => setRightProfileNewEmailInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = rightProfileNewEmailInput.trim();
                                      if (val && !rightProfileEmailList.includes(val)) {
                                        const updated = [...rightProfileEmailList, val];
                                        setRightProfileEmailList(updated);
                                        setRightProfileData(prev => ({ ...prev, email: updated.join(', ') }));
                                        setRightProfileNewEmailInput('');
                                      }
                                    }
                                  }}
                                  placeholder="Type new email and press Add..."
                                  className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = rightProfileNewEmailInput.trim();
                                    if (val && !rightProfileEmailList.includes(val)) {
                                      const updated = [...rightProfileEmailList, val];
                                      setRightProfileEmailList(updated);
                                      setRightProfileData(prev => ({ ...prev, email: updated.join(', ') }));
                                      setRightProfileNewEmailInput('');
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add</span>
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tax ID / SST Reg No.</label>
                              <input
                                type="text"
                                value={rightProfileData.tax_id || ''}
                                onChange={(e) => setRightProfileData({ ...rightProfileData, tax_id: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                placeholder="C1234567890"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Address Line 1</label>
                              <input
                                type="text"
                                value={rightProfileData.address_line1 || ''}
                                onChange={(e) => setRightProfileData({ ...rightProfileData, address_line1: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                placeholder="Building / Street Address"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Address Line 2</label>
                              <input
                                type="text"
                                value={rightProfileData.address_line2 || ''}
                                onChange={(e) => setRightProfileData({ ...rightProfileData, address_line2: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                placeholder="District / Unit / Suite"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                                <input
                                  type="text"
                                  value={rightProfileData.city || ''}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, city: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="Kuala Lumpur"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">State / Province</label>
                                <input
                                  type="text"
                                  value={rightProfileData.state || ''}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, state: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="Selangor"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Postal Code</label>
                                <input
                                  type="text"
                                  value={rightProfileData.postal_code || ''}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, postal_code: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="50450"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Country</label>
                                <input
                                  type="text"
                                  value={rightProfileData.country || 'Malaysia'}
                                  onChange={(e) => setRightProfileData({ ...rightProfileData, country: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                                  placeholder="Malaysia"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Notes</label>
                              <textarea
                                rows={2}
                                value={rightProfileData.notes || ''}
                                onChange={(e) => setRightProfileData({ ...rightProfileData, notes: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none resize-none"
                                placeholder="Special client notes..."
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => setIsEditingRightProfile(false)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingRightProfile}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {isSavingRightProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* READ-ONLY VIEW MODE WITH QUICK ACTION BUTTONS */
                        <>
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
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {selectedGroup.quotations.length > 0 ? (
                                  selectedGroup.quotations.map((q) => {
                                    const qPdfReady = Boolean(q.quotation_file) || q.pdf_created === 1;
                                    return qPdfReady ? (
                                      <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => setPdfPreviewModalData({ id: q.quotation_number || q.id, title: q.quotation_number || q.id })}
                                        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition shadow-2xs cursor-pointer"
                                        title={`Preview Dokumen SPH ${q.quotation_number || q.id}`}
                                      >
                                        <FileType className="w-3 h-3 text-blue-600" />
                                        <span>View Doc ({q.quotation_number || `#${q.id}`})</span>
                                      </button>
                                    ) : (
                                      <span
                                        key={q.id}
                                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                                      >
                                        No file attached ({q.quotation_number || `#${q.id}`})
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-slate-400 italic font-mono text-[11px]">No Quotations Registered</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Section 1.5: PIC Tanda Terima & Signatories Management */}
                          <div className="bg-white border border-blue-200 rounded-lg p-3.5 shadow-xs space-y-2.5 text-xs">
                            <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider border-b border-blue-100 pb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-blue-700 font-extrabold">
                                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>Received by (PIC Signatory)</span>
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ml-1">
                                  {companySignatories.length} PIC
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsAddingSignatory(!isAddingSignatory)}
                                className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition shadow-2xs"
                              >
                                <UserPlus className="w-3 h-3 text-blue-600" />
                                <span>{isAddingSignatory ? 'Close Form' : '+ Add PIC'}</span>
                              </button>
                            </div>

                            {/* Success Notice */}
                            {signatorySuccessNotice && (
                              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{signatorySuccessNotice}</span>
                              </div>
                            )}

                            {/* Inline Add Signatory Form */}
                            {isAddingSignatory && (
                              <form onSubmit={handleSaveNewSignatory} className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg space-y-2 text-xs animate-in fade-in">
                                <div className="font-bold text-blue-900 text-[11px] flex items-center gap-1">
                                  <UserPlus className="w-3.5 h-3.5 text-blue-700" />
                                  <span>Add New PIC for {selectedGroup.companyName}</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">PIC Full Name *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Ahmad Fauzi"
                                    value={newSigName}
                                    onChange={(e) => setNewSigName(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-blue-600"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Designation / Role</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Warehouse & Logistics PIC"
                                    value={newSigDesignation}
                                    onChange={(e) => setNewSigDesignation(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-blue-600"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {[
                                      'Warehouse PIC',
                                      'Logistics PIC',
                                      'Finance & Admin',
                                      'Purchasing Staff',
                                      'Receiver',
                                    ].map((desig) => (
                                      <button
                                        key={desig}
                                        type="button"
                                        onClick={() => setNewSigDesignation(desig)}
                                        className="bg-white hover:bg-blue-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition font-medium"
                                      >
                                        + {desig}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    type="checkbox"
                                    id="sig_default_chk"
                                    checked={newSigIsDefault}
                                    onChange={(e) => setNewSigIsDefault(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <label htmlFor="sig_default_chk" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                                    Set as Default for this Company
                                  </label>
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setIsAddingSignatory(false)}
                                    className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 font-bold rounded text-[11px] hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isSavingSignatory || !newSigName.trim()}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                                  >
                                    {isSavingSignatory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    <span>Save PIC</span>
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Signatories List */}
                            <div className="space-y-2">
                              {isLoadingSignatories ? (
                                <div className="py-3 flex items-center justify-center gap-2 text-slate-400 text-xs">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                  <span>Loading PIC data...</span>
                                </div>
                              ) : companySignatories.length === 0 ? (
                                <div className="bg-slate-50 border border-dashed border-slate-300 rounded p-3 text-center text-slate-400 text-[11px]">
                                  <UserCheck className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                                  <p>No recipient PIC registered yet.</p>
                                  <button
                                    type="button"
                                    onClick={() => setIsAddingSignatory(true)}
                                    className="text-blue-600 hover:underline font-bold mt-1 inline-block"
                                  >
                                    + Add PIC Now
                                  </button>
                                </div>
                              ) : (
                                companySignatories.map((sig) => {
                                  const isDefault = Number(sig.is_default) === 1 || sig.is_default === true;
                                  return (
                                    <div
                                      key={sig.id}
                                      className={`p-2.5 rounded-lg border transition flex items-center justify-between gap-2 shadow-2xs ${
                                        isDefault
                                          ? 'bg-gradient-to-r from-amber-50/80 to-amber-100/60 border-amber-300'
                                          : 'bg-slate-50/90 border-slate-200 hover:bg-white'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="font-extrabold text-slate-900 text-xs truncate">{sig.name}</p>
                                          {isDefault && (
                                            <span className="inline-flex items-center gap-0.5 bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded-full text-[9px] uppercase tracking-wider shadow-2xs">
                                              <Star className="w-2.5 h-2.5 fill-white" />
                                              <span>Default</span>
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-slate-600 font-mono text-[10px] mt-0.5 uppercase tracking-wide">
                                          {sig.designation || 'Recipient PIC'}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {!isDefault && (
                                          <button
                                            type="button"
                                            onClick={() => handleSetDefaultSignatory(sig)}
                                            className="px-2 py-0.5 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded text-[10px] font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                                            title="Set as default for invoices"
                                          >
                                            <Star className="w-2.5 h-2.5 text-amber-500" />
                                            <span>Set Default</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSignatory(sig.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                          title="Delete this signatory"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
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
                                <p className="text-slate-400 italic">No address provided.</p>
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

                          {/* Section 5: Action Buttons (Inline Edit + Save to Contacts) */}
                          <div className="pt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleStartEditingRightProfile}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Profile</span>
                            </button>
                            {!selectedGroup.dbClientId && (
                              <button
                                type="button"
                                disabled={isQuickSavingDb}
                                onClick={() => handleQuickSaveCompanyGroup(selectedGroup)}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                {isQuickSavingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>+ Save Contact</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Popup Footer */}
                <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCompanyDetailPanel(false)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-lg shadow-2xs cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </div>
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
                    {/* Quick Dropdown Picker for Connected Domain Emails */}
                    {selectedGroup.emailList && selectedGroup.emailList.length > 0 && (
                      <div className="mb-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            if (val && !clientEmailList.includes(val)) {
                              const updated = [...clientEmailList.filter(Boolean), val];
                              setClientEmailList(updated);
                              setEditingClientData({ ...editingClientData, email: updated.join(', ') });
                            }
                          }}
                          className="w-full bg-blue-50/90 border border-blue-300 text-blue-900 rounded p-1.5 text-xs font-mono focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="">+ Select & Add from Connected Emails ({selectedGroup.emailList.length})...</option>
                          {selectedGroup.emailList.map((em, idx) => (
                            <option key={idx} value={em} disabled={clientEmailList.includes(em)}>
                              {em} {clientEmailList.includes(em) ? '(Already Added)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
                      <th className="p-3 border-r border-slate-700 w-1/3">Email Message Details (RFQ)</th>
                      <th className="p-3 border-r border-slate-700 w-1/3">Commercial Quotation (SPH)</th>
                      <th className="p-3 text-center w-1/3">Actions & Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {correlatedPairs.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 italic">
                          No email or quotation records for this company.
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
                                  <span className="text-[10px] text-slate-400 italic">Created directly from Quotation System</span>
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
                                        {(() => {
                                          const isDone = isDoneStatus(q);
                                          const isReady = isReadySendStatus(q);
                                          const badgeClass = isDone
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : isReady
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-amber-100 text-amber-800 border border-amber-300';
                                          const badgeLabel = isDone ? 'Done' : isReady ? 'Ready to Send' : 'Draft';
                                          return (
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${badgeClass}`}>
                                              {badgeLabel}
                                            </span>
                                          );
                                        })()}
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
                                  No Quotation Issued
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
                                    <span>Preview Email</span>
                                  </button>
                                )}

                                {pair.quotations.map((q) => {
                                  const isDone = isDoneStatus(q);
                                  const isReady = isReadySendStatus(q);
                                  const pdfReady = Boolean(q.quotation_file) || q.pdf_created === 1;
                                  const ocrDone = q.ocr_scan_status === 'done' || q.ocr_scan_status === 'skipped';
                                  const isScanning = scanningOcrId === q.id || q.ocr_scan_status === 'processing';
                                  const isGeneratingPdf = generatingPdfId === q.id;

                                  return (
                                    <div key={q.id} className="w-full space-y-1 pt-1 border-t border-slate-100 first:border-t-0">
                                      {/* 1. OCR Scan AI (If not scanned yet and not done) */}
                                      {!ocrDone && !isDone && (
                                        <button
                                          type="button"
                                          disabled={isScanning}
                                          onClick={() => handleTriggerOcrScan(q)}
                                          className={`px-3 py-1.5 text-white rounded-lg transition border text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer ${
                                            isScanning
                                              ? 'bg-purple-400 border-purple-500 cursor-not-allowed'
                                              : q.ocr_scan_status === 'waiting_ai_limit' || q.ocr_scan_status === 'waiting'
                                              ? 'bg-amber-600 hover:bg-amber-700 border-amber-700'
                                              : 'bg-purple-600 hover:bg-purple-700 border-purple-700'
                                          }`}
                                          title="Run AI OCR Item Scanning"
                                        >
                                          {isScanning ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Scanning AI...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                              <span>{q.ocr_scan_status === 'waiting_ai_limit' ? 'Waiting AI (Limit)' : 'Scan AI'}</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      {/* 2. Create PDF / Build SPH (If PDF not created yet and not done) */}
                                      {!pdfReady && !isDone && (
                                        <button
                                          type="button"
                                          disabled={isGeneratingPdf}
                                          onClick={() => handleCreatePdfBackground(q)}
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition border border-blue-700 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer disabled:opacity-75"
                                          title="Generate PDF SPH Document"
                                        >
                                          {isGeneratingPdf ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Generating PDF...</span>
                                            </>
                                          ) : (
                                            <>
                                              <FileType className="w-3.5 h-3.5" />
                                              <span>Create PDF</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      {/* 3. View Doc Link (If PDF created) */}
                                      {pdfReady && (
                                        <a
                                          href={getApiUrl(`view_doc.php?id=${encodeURIComponent(q.quotation_number || q.id)}`)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg transition border border-blue-200 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                                          <span>View Doc ({q.quotation_number || q.id})</span>
                                        </a>
                                      )}

                                      {/* 4. Send SPH / Siap Kirim (If Ready for send and not done) */}
                                      {!isDone && (isReady || pdfReady) && (
                                        <button
                                          type="button"
                                          onClick={() => handleSendQuotationDirect(q)}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition border border-emerald-700 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          <span>Send SPH Quotation</span>
                                        </button>
                                      )}

                                      {/* 5. Auto Invoice (If Done / Terkirim) */}
                                      {isDone && (
                                        <button
                                          type="button"
                                          onClick={() => handleGenerateInvoiceFromQuotation(q)}
                                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition border border-emerald-800 text-xs font-extrabold flex items-center gap-1.5 w-full justify-center shadow-xs cursor-pointer"
                                          title={`Generate Automatic Invoice from ${q.quotation_number || q.id}`}
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>Auto Invoice</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
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
                Close Fullscreen View
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
                <span>Email Details & System Status</span>
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
                    <span>Inbox Status (RFQ Email Message)</span>
                  </span>
                  <span className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                    {infoModalData.rfq?.status || 'Active Thread'}
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  <div><strong className="text-slate-900">RFQ No:</strong> {infoModalData.rfq?.rfq_number || (infoModalData.rfq?.id ? `#${infoModalData.rfq.id}` : 'General Inquiry')}</div>
                  <div><strong className="text-slate-900">Subject:</strong> {infoModalData.rfq?.subject || 'Direct Quotation Reply'}</div>
                  <div><strong className="text-slate-900">Sender:</strong> {infoModalData.rfq?.sender_name || selectedGroup.primaryClientName} &lt;{cleanSingleEmail(infoModalData.rfq?.sender_email || selectedGroup.primaryEmail)}&gt;</div>
                  <div><strong className="text-slate-900">Received Date:</strong> {infoModalData.rfq?.date_received || selectedGroup.lastActivity}</div>
                  <div><strong className="text-slate-900">Email Source:</strong> {infoModalData.rfq ? 'Gmail Live API / Spreadsheet Sync' : 'Direct Manual System'}</div>
                </div>
              </div>

              {/* Section 2: Info Status di Quotation Database */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-900">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Quotation Database Status</span>
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
                    <div><strong className="text-slate-900">Quotation No:</strong> {infoModalData.quotation.quotation_number || infoModalData.quotation.id}</div>
                    <div><strong className="text-slate-900">Company:</strong> {infoModalData.quotation.company_name || selectedGroup.companyName}</div>
                    <div><strong className="text-slate-900">Total Offer:</strong> MYR {Number(infoModalData.quotation.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div><strong className="text-slate-900">Date Issued:</strong> {infoModalData.quotation.date_issued}</div>
                    {infoModalData.quotation.approved_by && (
                      <div><strong className="text-slate-900">Approved By:</strong> {infoModalData.quotation.approved_by}</div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px]">Not linked to a specific quotation document.</p>
                )}
              </div>

              {/* Section 3: Ringkasan Isi Pesan Email */}
              {infoModalData.rfq && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <span className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider block border-b border-slate-100 pb-1">
                    Email Message Content Summary
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
                  (() => {
                    const infoPdfReady = Boolean(infoModalData.quotation.quotation_file) || infoModalData.quotation.pdf_created === 1;
                    return infoPdfReady ? (
                      <button
                        type="button"
                        onClick={() => {
                          const quoId = infoModalData.quotation!.quotation_number || infoModalData.quotation!.id;
                          setPdfPreviewModalData({ id: quoId, title: quoId });
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded border border-blue-700 text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-white" />
                        <span>View Quotation Doc ({infoModalData.quotation.quotation_number || infoModalData.quotation.id})</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 font-extrabold rounded text-xs">
                        No file available
                      </span>
                    );
                  })()
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
                    <span>Auto Invoice</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInfoModalData(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded text-xs hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW POPUP MODAL */}
      {pdfPreviewModalData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 font-sans animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-700">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2 font-extrabold text-sm min-w-0">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">Dokumen SPH Quotation #{pdfPreviewModalData.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* View Mode Toggle */}
                <div className="bg-slate-800 p-0.5 rounded border border-slate-700 flex items-center gap-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setEmailPdfViewerMode('doc')}
                    className={`px-2 py-0.5 rounded transition ${emailPdfViewerMode === 'doc' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    Doc View
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPdfViewerMode('pdf')}
                    className={`px-2 py-0.5 rounded transition ${emailPdfViewerMode === 'pdf' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    PDF Stream
                  </button>
                </div>

                <a
                  href={emailPdfViewerMode === 'doc' 
                    ? getApiUrl(`view_doc.php?id=${encodeURIComponent(pdfPreviewModalData.id)}`) 
                    : getApiUrl(`/api_pdf.php?action=stream&type=quotation&id=${encodeURIComponent(pdfPreviewModalData.id)}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Open in New Browser Tab"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Open New Tab</span>
                </a>
                <a
                  href={getApiUrl(`/api_pdf.php?action=download&type=quotation&id=${encodeURIComponent(pdfPreviewModalData.id)}`)}
                  target="_blank"
                  rel="noreferrer"
                  download={`${String(pdfPreviewModalData.title).replace(/[^A-Za-z0-9_\-]/g, '_')}.pdf`}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Download PDF File"
                >
                  <FileType className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewModalData(null)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded transition cursor-pointer"
                  title="Close Preview Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Iframe Body */}
            <div className="flex-1 bg-slate-100 relative w-full h-full">
              <iframe
                src={emailPdfViewerMode === 'doc'
                  ? getApiUrl(`view_doc.php?id=${encodeURIComponent(pdfPreviewModalData.id)}`)
                  : getApiUrl(`/api_pdf.php?action=stream&type=quotation&id=${encodeURIComponent(pdfPreviewModalData.id)}`)}
                className="w-full h-full border-0"
                title={`Quotation Preview ${pdfPreviewModalData.title}`}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmailClient;
