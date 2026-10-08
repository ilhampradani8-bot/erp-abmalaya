import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quotation } from '../types/erp';
import { Search, Plus, Edit, Send, RefreshCw, Loader2, Trash2, FileType, FileText, Download, Check, Sparkles, CheckCircle2, Sliders, Clock, MoreVertical, History, X as CloseIcon, User, AlertTriangle, Printer, Image as ImageIcon, ShieldCheck, ScanLine, Info, Database, Activity, Terminal, Tag, Filter, Eye, ExternalLink, Mail, DollarSign, Paperclip } from 'lucide-react';

import { getApiUrl } from '../utils/api';


interface QuotationListProps {
  onEditQuotation: (quo: Quotation) => void;
  onPreviewDoc: (quo: Quotation) => void;
  onSendEmail: (quo: Quotation) => void;
  onOpenEmailClient?: (quo?: Quotation) => void;
  onNewQuotation: () => void;
  cachedQuotations: Quotation[];
  setCachedQuotations: (data: Quotation[]) => void;
  hasFetched: boolean;
  currentUser?: { id?: string; name?: string; email?: string; role?: string };
  setIsGlobalLoading?: (loading: boolean) => void;
}

const bodyCleanCache = new Map<string, string>();
const cleanEmailBodyText = (text?: string): string => {
  if (!text) return '';
  if (bodyCleanCache.has(text)) return bodyCleanCache.get(text)!;

  let cleaned = text;

  // 1. Remove <style>...</style> and <script>...</script> blocks
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 2. Remove HTML comments <!-- ... -->
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Remove boundary header parameters & MIME headers
  cleaned = cleaned.replace(/boundary="[^"]*"/gi, '');
  cleaned = cleaned.replace(/boundary=[a-zA-Z0-9-@._]+/gi, '');
  cleaned = cleaned.replace(/content-type:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-transfer-encoding:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-description:[^\n]*/gi, '');
  cleaned = cleaned.replace(/creation-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/modification-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/content-id:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-disposition:[^\n]*/gi, '');

  // 4. Remove [cid:...] and inline cid:...
  cleaned = cleaned.replace(/\[cid:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/cid:[a-zA-Z0-9-@.]+/gi, '');

  // 5. Remove CSS rule blocks like: table { ... }, th, td { ... }, a { ... }, #id { ... }, .class { ... }
  cleaned = cleaned.replace(/[a-zA-Z0-9_#.,\s-]+\{[^}]*\}/g, '');

  // 6. Strip remaining HTML tags (like <div>, <p>, <table>, <tr>, <td>, etc.)
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');

  // 7. Remove long base64 lines
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length > 40 && !trimmed.includes(' ') && /^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
      return false;
    }
    return true;
  });
  cleaned = filteredLines.join('\n');

  // 8. Clean consecutive newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');

  const result = cleaned.trim();
  if (bodyCleanCache.size > 500) bodyCleanCache.clear();
  bodyCleanCache.set(text, result);
  return result;
};

export interface QuotationAlertItem {
  id: string;
  type: 'unregistered' | 'missing_price' | 'missing_file';
  severity: 'warning' | 'error' | 'info';
  title: string;
  description: string;
}

export const getQuotationAlerts = (q?: Quotation | null): QuotationAlertItem[] => {
  const alerts: QuotationAlertItem[] = [];
  if (!q) return alerts;
  const st = (q.status || 'draft').toLowerCase();
  const isDone = ['done_send', 'sent', 'deal', 'terkirim', 'penawaran_terkirim', 'junk'].includes(st);

  // 1. Unregistered products alert
  if (q.unregistered_items_count && q.unregistered_items_count > 0 && !isDone) {
    alerts.push({
      id: 'unregistered',
      type: 'unregistered',
      severity: 'warning',
      title: `${q.unregistered_items_count} Unregistered Items`,
      description: `There are ${q.unregistered_items_count} item(s) in this quotation not found in the master product catalog.`
    });
  }

  // 2. Missing price / RM 0 alert
  let itemsWithoutPrice = 0;
  let itemsList: any[] = [];
  if (q.items_details && Array.isArray(q.items_details) && q.items_details.length > 0) {
    itemsList = q.items_details;
  } else if (q.items && Array.isArray(q.items) && q.items.length > 0) {
    itemsList = q.items;
  }

  if (itemsList.length > 0) {
    itemsWithoutPrice = itemsList.filter(item => {
      const price = Number(item.unit_price ?? item.price ?? 0);
      return isNaN(price) || price <= 0;
    }).length;
  } else if (!q.grand_total || Number(q.grand_total) <= 0) {
    itemsWithoutPrice = 1;
  }

  if (itemsWithoutPrice > 0 && !isDone) {
    alerts.push({
      id: 'missing_price',
      type: 'missing_price',
      severity: 'error',
      title: `${itemsWithoutPrice} Items Missing Price`,
      description: `There are ${itemsWithoutPrice} item(s) with RM 0.00 unit price or missing pricing.`
    });
  }

  // 3. Missing quotation PDF file alert
  if (!q.quotation_file && !isDone) {
    alerts.push({
      id: 'missing_file',
      type: 'missing_file',
      severity: 'warning',
      title: 'Quotation PDF Not Generated',
      description: 'Official quotation PDF document has not been generated for this quotation yet.'
    });
  }

  return alerts;
};

export const QuotationList: React.FC<QuotationListProps> = ({
  onEditQuotation,
  onPreviewDoc,
  onSendEmail,
  onOpenEmailClient,
  onNewQuotation,
  cachedQuotations,
  setCachedQuotations,
  hasFetched,
  currentUser,
  setIsGlobalLoading,
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>(cachedQuotations || []);
  const [isLoading, setIsLoading] = useState<boolean>(!hasFetched && cachedQuotations.length === 0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'requisition' | 'draft' | 'quotation' | 'ready_send' | 'done' | 'junk'>('all');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  
  // Dropdown & History log modal states
  const [showActionsMenu, setShowActionsMenu] = useState<boolean>(false);
  const [selectedHistoryQuotation, setSelectedHistoryQuotation] = useState<Quotation | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  
  // Alert details popup modal state
  const [selectedAlertQuotation, setSelectedAlertQuotation] = useState<Quotation | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);

  // Row-specific kebab dropdown state & Info modal state
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  const [selectedInfoQuotation, setSelectedInfoQuotation] = useState<Quotation | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [selectedPdfViewerQuotation, setSelectedPdfViewerQuotation] = useState<Quotation | null>(null);
  const [isPdfViewerModalOpen, setIsPdfViewerModalOpen] = useState<boolean>(false);
  const [pdfViewerMode, setPdfViewerMode] = useState<'doc' | 'pdf'>('doc');

  const pdfDocUrl = React.useMemo(() => {
    if (!selectedPdfViewerQuotation) return '';
    return getApiUrl(`/view_doc.php?type=quotation&id=${encodeURIComponent(selectedPdfViewerQuotation.id)}`);
  }, [selectedPdfViewerQuotation?.id]);

  const pdfStreamUrl = React.useMemo(() => {
    if (!selectedPdfViewerQuotation) return '';
    if (selectedPdfViewerQuotation.quotation_file) {
      return getApiUrl(selectedPdfViewerQuotation.quotation_file);
    }
    return getApiUrl(`/api_pdf.php?action=stream&type=quotation&id=${encodeURIComponent(selectedPdfViewerQuotation.id)}`);
  }, [selectedPdfViewerQuotation?.id, selectedPdfViewerQuotation?.quotation_file]);

  const pdfDownloadUrl = React.useMemo(() => {
    if (!selectedPdfViewerQuotation) return '';
    return getApiUrl(`/api_pdf.php?action=download&type=quotation&id=${encodeURIComponent(selectedPdfViewerQuotation.id)}`);
  }, [selectedPdfViewerQuotation?.id]);

  // Send Confirmation Popup Modal State
  const [sendConfirmQuotation, setSendConfirmQuotation] = useState<Quotation | null>(null);
  const [isSendingQuotation, setIsSendingQuotation] = useState<boolean>(false);

  useEffect(() => {
    if (isLoading || generatingPdfId !== null) {
      setIsGlobalLoading?.(true);
    } else {
      setIsGlobalLoading?.(false);
    }
  }, [isLoading, generatingPdfId]);

  const handleCreatePdfBackground = async (q: Quotation) => {
    setGeneratingPdfId(q.id);

    try {
      const actorName = currentUserRef.current?.name || currentUserRef.current?.email || 'Sistem';
      const actorEmail = currentUserRef.current?.email || '';
      const res = await fetch(
        getApiUrl(
          `/api_pdf.php?action=generate&type=quotation&id=${encodeURIComponent(q.id)}&user_name=${encodeURIComponent(actorName)}&user_email=${encodeURIComponent(actorEmail)}`
        )
      );
      const data = await res.json();
      if (data.status === 'success') {
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const generatedUrl = data.pdf_url || `/uploads/pdf/${data.filename || (q.quotation_number || q.id) + '.pdf'}`;
        setQuotations((prev) =>
          prev.map((item) => {
            if (item.id === q.id) {
              let logs = [];
              try {
                if (item.history_log) {
                  logs = typeof item.history_log === 'string' ? JSON.parse(item.history_log) : item.history_log;
                }
              } catch (e) {}
              if (!Array.isArray(logs)) logs = [];
              logs.push({
                action: 'Generate PDF Quotation',
                user_name: actorName,
                user_email: actorEmail || null,
                details: `PDF Quotation document ${item.quotation_number || item.id} generated successfully.`,
                timestamp: nowStr,
              });

              return {
                ...item,
                pdf_created: 1,
                quotation_file: generatedUrl,
                pdf_created_at: new Date().toISOString(),
                history_log: JSON.stringify(logs),
              };
            }
            return item;
          })
        );
        if (selectedInfoQuotation?.id === q.id) {
          setSelectedInfoQuotation((prev) =>
            prev ? { ...prev, pdf_created: 1, quotation_file: generatedUrl, pdf_created_at: new Date().toISOString() } : null
          );
        }
      }
    } catch (err) {
      console.error('Error generating PDF in background:', err);
    } finally {
      setGeneratingPdfId(null);
    }
  };
  
  // Drawer tabs and email body states
  const [drawerTab, setDrawerTab] = useState<'summary' | 'email' | 'history' | 'acc'>('summary');
  const [showEmailBody, setShowEmailBody] = useState<boolean>(false);

  useEffect(() => {
    setShowEmailBody(false);
    setDrawerTab('summary');
  }, [selectedInfoQuotation?.id]);

  useEffect(() => {
    setShowEmailBody(false);
  }, [drawerTab]);
  
  // OCR scan states
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [_ocrScanResult, setOcrScanResult] = useState<any>(null);
  const [ocrRateLimitInfo, setOcrRateLimitInfo] = useState<{
    active: boolean;
    quo_id: string;
    retryAfter: number;       // seconds remaining in countdown
    totalWait: number;        // original wait seconds
    attempt: number;          // which attempt this is
    message: string;
    isPartialSuccess: boolean;
  } | null>(null);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string | null>(null);
  const ocrRetryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ocrRetryAttemptRef = React.useRef<number>(0);
  const MAX_OCR_RETRIES = 10;

  // Keep a ref to currentUser so useCallback always reads latest value (avoids stale closure)
  const currentUserRef = React.useRef(currentUser);
  React.useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Robust session detection helper across QuotationList
  const getSessionActorName = React.useCallback((fallbackName: string = 'Muhammad Aimanuddin Bin Mohd Zaki') => {
    if (currentUserRef.current?.name && currentUserRef.current.name.trim() && currentUserRef.current.name !== 'Unidentified Session' && currentUserRef.current.name !== 'Sesi Tidak Terdeteksi') {
      return currentUserRef.current.name;
    }
    if (currentUserRef.current?.email && currentUserRef.current.email.trim()) {
      return currentUserRef.current.email;
    }
    try {
      const raw = localStorage.getItem('abmalaya_user_session');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.name && u.name.trim() && u.name !== 'Unidentified Session' && u.name !== 'Sesi Tidak Terdeteksi') return u.name;
        if (u?.email && u.email.trim()) return u.email;
      }
    } catch (e) {}
    return fallbackName;
  }, []);

  // Live countdown tick — decrements retryAfter every second
  React.useEffect(() => {
    if (!ocrRateLimitInfo?.active || ocrRateLimitInfo.retryAfter <= 0) return;
    const tick = setInterval(() => {
      setOcrRateLimitInfo(prev => {
        if (!prev) return null;
        const next = prev.retryAfter - 1;
        if (next <= 0) { clearInterval(tick); return null; }
        return { ...prev, retryAfter: next };
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [ocrRateLimitInfo?.active, ocrRateLimitInfo?.totalWait]);

  // Auto-retry trigger — fires after countdown reaches 0
  const scheduleOcrRetry = (quo_id: string, retryAfterSecs: number, attempt: number) => {
    if (ocrRetryTimerRef.current) clearTimeout(ocrRetryTimerRef.current);
    ocrRetryTimerRef.current = setTimeout(() => {
      triggerOcrScan(quo_id, attempt + 1);
    }, retryAfterSecs * 1000);
  };

  // Core OCR scan + IMPA chain function (called on button click & auto-retry)
  const triggerOcrScan = React.useCallback((quo_id: string, attempt: number = 1) => {
    if (attempt > MAX_OCR_RETRIES) {
      setIsScanningOcr(false);
      setOcrRateLimitInfo(null);
      setOcrErrorMsg(`Scan failed after ${MAX_OCR_RETRIES} attempts. Gemini API temporarily unavailable. Please try again later.`);
      return;
    }
    ocrRetryAttemptRef.current = attempt;
    setIsScanningOcr(true);
    setOcrRateLimitInfo(null);
    if (attempt === 1) { setOcrSuccessMsg(null); setOcrErrorMsg(null); }

    fetch(getApiUrl('/api_ocr_scan.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quo_id,
        actor_name:  getSessionActorName('Admin'),
        actor_email: currentUserRef.current?.email || null,
      }),
    })
      .then(r => r.json())
      .then(d => {
        const resObj = d.ocr_scan_result || null;
        const resStr = typeof resObj === 'string' ? resObj : JSON.stringify(resObj);
        const rateLimited    = d.rate_limited || resObj?.ai_rate_limited || false;
        const retryAfterSecs = d.retry_after_secs || resObj?.retry_after_secs || 60;

          if (d.status === 'success') {
          setOcrScanResult(resObj);
          setQuotations(prev => prev.map(q => q.id === quo_id
            ? { ...q, ocr_scan_status: d.ocr_scan_status as any, ocr_scan_result: resStr } : q));
          setSelectedInfoQuotation(prev => prev
            ? { ...prev, ocr_scan_status: d.ocr_scan_status as any, ocr_scan_result: resStr } : null);

          // All AI keys are disabled — only native fallback ran, no real AI extraction
          if (d.all_keys_disabled) {
            setIsScanningOcr(false);
            const itemCount = Array.isArray(resObj?.items) ? resObj.items.length : 0;
            if (itemCount === 0) {
              setOcrErrorMsg('Scan incomplete: All AI keys are currently disabled. No items were extracted. Enable at least one API key in System Settings and try again.');
              setTimeout(() => setOcrErrorMsg(null), 10000);
            } else {
              setOcrSuccessMsg(`Scan via native engine only (AI keys disabled) • ${itemCount} items extracted • Enable AI keys for better accuracy.`);
              setTimeout(() => setOcrSuccessMsg(null), 9000);
            }
            return;
          }

          if (rateLimited && resObj?.scan_confidence?.includes('Native')) {
            // Partial success — native items extracted, AI rate limited, auto-retry for AI
            setOcrRateLimitInfo({
              active: true, quo_id, retryAfter: retryAfterSecs, totalWait: retryAfterSecs,
              attempt, isPartialSuccess: true,
              message: `Waiting - ${retryAfterSecs}s (Items extracted via native engine. Waiting for Gemini AI quota reset...)`,
            });
            scheduleOcrRetry(quo_id, retryAfterSecs, attempt);
            setIsScanningOcr(false);
          } else {
            const itemCount = Array.isArray(resObj?.items) ? resObj.items.length : 0;
            const model = resObj?.scan_model ? ` [${resObj.scan_model}]` : '';

            if (d.ocr_scan_status === 'error' || itemCount === 0) {
              setIsScanningOcr(false);
              setOcrErrorMsg(`Scan OCR Selesai (0 Item): Tidak dapat mengekstrak rincian barang dari dokumen/email. Silakan periksa kejelasan dokumen atau isi secara manual.`);
              setTimeout(() => setOcrErrorMsg(null), 9000);
              return;
            }

            if (d.ocr_scan_status === 'waiting_ai_limit') {
              setOcrSuccessMsg(`Waiting for AI quota reset. Items saved via native engine. Auto-retry scheduled...`);
            } else {
              setOcrSuccessMsg(`✓ Scan done${model} — ${itemCount} items found. Matching IMPA category...`);
            }
            setIsScanningOcr(false);
            // Auto-chain IMPA matching
            fetch(getApiUrl('/api_impa_match.php'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quo_id }),
            })
              .then(r => r.json())
              .then(im => {
                if (im.status === 'success') {
                  const catName = im.category_name || 'No matching category.';
                  setOcrSuccessMsg(`✓ Scan + IMPA done${model} — ${itemCount} items — Category: ${catName} (${im.impa_code || 'N/A'}) — ${im.confidence || 0}% confidence`);
                  setQuotations(prev => prev.map(q => q.id === quo_id
                    ? { ...q, impa_code: im.impa_code, category_name: im.category_name } : q));
                  setSelectedInfoQuotation(prev => prev
                    ? { ...prev, impa_code: im.impa_code, category_name: im.category_name } : null);
                } else {
                  const catMsg = im.category_name || im.message || 'No IMPA category matched.';
                  setOcrSuccessMsg(`✓ Scan done — ${itemCount} items extracted. IMPA: ${catMsg}`);
                }
                setTimeout(() => setOcrSuccessMsg(null), 8000);
              })
              .catch(() => {
                setTimeout(() => setOcrSuccessMsg(null), 6000);
              });
          }
        } else if (d.status === 'skipped') {
          setIsScanningOcr(false);
          setOcrErrorMsg('Scan skipped: ' + (d.message || 'Attachment file not found.'));
          setTimeout(() => setOcrErrorMsg(null), 6000);
        } else {
          // Error response
          if (rateLimited) {
            setOcrRateLimitInfo({
              active: true, quo_id, retryAfter: retryAfterSecs, totalWait: retryAfterSecs,
              attempt, isPartialSuccess: false,
              message: `Waiting - ${retryAfterSecs}s (Gemini AI rate limited. Automatic retry scheduled upon countdown expiry...)`,
            });
            scheduleOcrRetry(quo_id, retryAfterSecs, attempt);
            setIsScanningOcr(false);
          } else {
            setIsScanningOcr(false);
            setOcrErrorMsg('Scan failed: ' + (d.message || resObj?.reason || 'Unknown error.'));
            setTimeout(() => setOcrErrorMsg(null), 8000);
          }
        }
      })

      .catch(e => {
        console.error('OCR scan error:', e);
        setIsScanningOcr(false);
        setOcrErrorMsg('Failed to connect to OCR Scanner API.');
        setTimeout(() => setOcrErrorMsg(null), 5000);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, setQuotations, setSelectedInfoQuotation]);

  // Cleanup retry timer on unmount
  React.useEffect(() => {
    return () => { if (ocrRetryTimerRef.current) clearTimeout(ocrRetryTimerRef.current); };
  }, []);


  
  // ACC approval states
  const [accNote, setAccNote] = useState<string>('');
  
  // Checkbox selection & Batch action states
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // System diagnostic & category info modal states
  const [isSystemInfoModalOpen, setIsSystemInfoModalOpen] = useState<boolean>(false);
  const [infoModalTab, setInfoModalTab] = useState<'sph' | 'categories' | 'errors'>('sph');
  const [aiErrors, setAiErrors] = useState<any[]>([]);
  const [dynamicDaemons, setDynamicDaemons] = useState<any[]>([]);
  const [showAllDbColumns, setShowAllDbColumns] = useState<boolean>(false);
  const [isLoadingErrors, setIsLoadingErrors] = useState<boolean>(false);
  const [selectedFullDbQuotation, setSelectedFullDbQuotation] = useState<Quotation | null>(null);
  const [isFullDbModalOpen, setIsFullDbModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isSystemInfoModalOpen) {
      setIsLoadingErrors(true);
      fetch(getApiUrl('/api_daemons.php'))
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success') {
            setDynamicDaemons(data.data || []);
            setAiErrors(data.errors || []);
          }
        })
        .catch((err) => console.error('Fetch daemons failed:', err))
        .finally(() => setIsLoadingErrors(false));
    }
  }, [isSystemInfoModalOpen]);
  const [showBatchStatusDropdown, setShowBatchStatusDropdown] = useState<boolean>(false);

  const shortenQuotationNumber = (num: string) => {
    if (!num) return '';
    if (num.includes('/')) {
      const parts = num.split('/');
      return parts[parts.length - 1];
    }
    if (num.length > 10) {
      return '...' + num.slice(-6);
    }
    return num;
  };

  const getQuotationCompany = (q: Quotation) => {
    if (q.company_name && q.company_name.toLowerCase() !== q.client_name.toLowerCase()) {
      return q.company_name;
    }
    if (q.client_email && q.client_email.includes('@')) {
      const domain = q.client_email.split('@')[1];
      const publicDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'mail.com', 'yahoo.co.id', 'yahoo.co.uk', 'ymail.com', 'icloud.com'];
      if (!publicDomains.includes(domain.toLowerCase())) {
        const namePart = domain.split('.')[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    }
    return q.company_name || 'Individual';
  };

  const triggerSPHPrint = (quo: Quotation, _format: 'pdf' | 'png') => {
    const w = window.open('', '_blank');
    if (!w) return;
    
    // Calculate totals
    const taxRate = quo.tax_percent || 11.00;
    const sub = quo.subtotal || 0;
    const tax = quo.tax_amount || 0;
    const total = quo.grand_total || 0;
    const disc = quo.discount_total || 0;
    
    // Format RM currency helper in HTML
    const fmt = (v: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2,
      }).format(v || 0);
    };
    
    // SPH Items
    const itemsHtml = (quo.items_details || []).map((it, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: center; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; font-weight: bold;">${it.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: center;">${it.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: center;">${it.unit}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: right; font-family: monospace;">${fmt(it.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: center; color: #b45309; font-family: monospace;">${it.discount_percent > 0 ? it.discount_percent + '%' : '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #d2d2d2; text-align: right; font-weight: bold; font-family: monospace;">${fmt(it.total)}</td>
      </tr>
    `).join('');
    
    const docHtml = `
      <html>
        <head>
          <title>Quotation - ${quo.quotation_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .logo-box { width: 60px; height: 60px; background: #333; color: white; font-weight: 900; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
            .company-info h1 { font-size: 20px; margin: 0; text-transform: uppercase; font-weight: 900; }
            .company-info p { font-size: 11px; margin: 2px 0; color: #666; }
            .sph-title { font-size: 12px; font-weight: 950; background: #333; color: white; padding: 4px 10px; display: inline-block; margin-bottom: 10px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; margin-bottom: 20px; font-size: 12px; }
            .meta-grid span { color: #888; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #f2f2f2; padding: 10px; border-bottom: 2px solid #ddd; font-weight: bold; text-transform: uppercase; }
            .totals-box { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; }
            .grand-total { font-size: 14px; font-weight: 900; color: #0080d0; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
            .footer-sigs { display: flex; justify-content: space-between; font-size: 12px; margin-top: 40px; }
            .stamp-box { width: 120px; height: 50px; border: 2px dashed #0080d0; color: #0080d0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; transform: rotate(-3deg); margin: 10px 0; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center;">
              <div class="logo-box">AB</div>
              <div class="company-info">
                <h1>ABMALAYA.COM (MALAYSIA)</h1>
                <p>Industrial Equipment, Spareparts & Digital Enterprise Solutions</p>
                <p>Kuala Lumpur Tech Park, Block B-12, Wilayah Persekutuan Kuala Lumpur, Malaysia</p>
                <p>Tel: +60 3-8900 1122 | Email: sales@abmalaya.com | Web: www.abmalaya.com</p>
              </div>
            </div>
            <div style="text-align: right;">
              <span class="sph-title">COMMERCIAL QUOTATION</span>
              <div style="font-family: monospace; font-weight: bold;">No: ${quo.quotation_number}</div>
              <div style="color: #666; font-size: 11px;">Date: ${quo.date_issued}</div>
            </div>
          </div>
          
          <div class="meta-grid">
            <div>
              <span>Quotation Recipient (Attn):</span>
              <strong>${quo.company_name}</strong>
              <p style="margin: 4px 0 0 0;">Attn: <strong>${quo.client_name}</strong></p>
              <p style="margin: 2px 0 0 0; color: #555;">Email: ${quo.client_email}</p>
            </div>
            <div style="text-align: right;">
              <span>Quotation Document Details:</span>
              <p style="margin: 3px 0;">Date Issued: <strong>${quo.date_issued}</strong></p>
              <p style="margin: 3px 0;">Valid Until: <strong style="color: #b45309;">${quo.valid_until || '14 Days'}</strong></p>
              <p style="margin: 3px 0;">Currency: <strong>MYR (Malaysian Ringgit)</strong></p>
              <p style="margin: 3px 0;">Issued By: <strong>${quo.created_by || getSessionActorName()}</strong></p>
            </div>
          </div>
          
          <p style="font-size: 12px; margin-bottom: 15px;">
            Dear Valued Customer,<br/>
            In response to your Request for Quotation (RFQ), we hereby submit our official quotation for the items/services detailed below:
          </p>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">No</th>
                <th>Item Description / Service Specification</th>
                <th style="width: 50px; text-align: center;">Qty</th>
                <th style="width: 70px; text-align: center;">Unit</th>
                <th style="width: 120px; text-align: right;">Unit Price</th>
                <th style="width: 50px; text-align: center;">Disc</th>
                <th style="width: 120px; text-align: right;">Total (RM)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">No items defined in quotation.</td></tr>'}
            </tbody>
          </table>
          
          <div class="totals-box">
            <div style="width: 48%; font-size: 11px; background: #f9f9f9; padding: 10px; border: 1px solid #eee;">
              <strong>Quotation Notes:</strong>
              <p style="color: #666; margin: 4px 0 0 0; font-style: italic;">${quo.notes || 'Standard quotation terms apply.'}</p>
            </div>
            <div style="width: 48%; text-align: right; font-family: monospace;">
              <div style="margin: 4px 0;">Subtotal: ${fmt(sub)}</div>
              <div style="margin: 4px 0; color: red;">Discount: -${fmt(disc)}</div>
              <div style="margin: 4px 0;">SST (${taxRate}%): ${fmt(tax)}</div>
              <div class="grand-total">GRAND TOTAL: ${fmt(total)}</div>
            </div>
          </div>
          
          <div class="footer-sigs">
            <div>
              <p style="color: #888; margin: 0 0 5px 0;">Confirmed & Accepted by,</p>
              <div style="height: 60px;"></div>
              <strong>(${quo.client_name})</strong>
              <p style="margin: 2px 0 0 0; color: #666;">${quo.company_name}</p>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; margin-left: auto;">
              <p style="color: #888; margin: 0 0 5px 0;">Sincerely Yours,</p>
              <strong>ABMALAYA.COM (MALAYSIA)</strong>
              <div style="display: flex; justify-content: flex-end; width: 100%; margin: 5px 0;">
                <div class="stamp-box" style="margin-left: auto;">[STAMP ABMALAYA]</div>
              </div>
              <strong><u>${quo.created_by || getSessionActorName()}</u></strong>
              <p style="margin: 2px 0 0 0; color: #666;">Head of Sales & Business Development</p>
            </div>
          </div>
          <div style="margin-top: 30px; padding-top: 8px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 8pt; color: #64748b; font-family: monospace;">
            ${quo.footer_text || 'sales@abmalaya.com | +60 3-8000 1234 | www.abmalaya.com'}
          </div>
        </body>
      </html>
    `;
    w.document.write(docHtml);
    w.document.close();
    
    // Auto print
    setTimeout(() => {
      w.print();
    }, 500);
  };
  
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
      const target = event.target as HTMLElement;
      if (!target.closest('.row-action-dropdown-container')) {
        setOpenRowActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prevQuotationsJsonRef = useRef<string>('');

  const fetchQuotationsFromMySQL = (isSilent = false) => {
    // Only show loading spinner on initial load when cache is empty and not silent
    if (!isSilent && quotations.length === 0) {
      setIsLoading(true);
    }
    fetch(getApiUrl('/api_quotations.php'))
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse quotations JSON:', e, 'Raw text length:', text.length);
          return null;
        }
      })
      .then((resData) => {
        if (resData && resData.status === 'success' && Array.isArray(resData.data)) {
          const jsonStr = JSON.stringify(resData.data);
          if (prevQuotationsJsonRef.current !== jsonStr) {
            prevQuotationsJsonRef.current = jsonStr;
            setQuotations(resData.data);
            setCachedQuotations(resData.data);
          }
        }
      })
      .catch((err) => console.log('Fetch quotations error:', err))
      .finally(() => {
        if (!isSilent) setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchQuotationsFromMySQL(false);

    // Silent background poll every 10 seconds — no loading toggle, no flicker
    const pollInterval = setInterval(() => {
      fetchQuotationsFromMySQL(true);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleDeleteQuotation = (id: string) => {
    if (!window.confirm('Are you sure you want to move this Quotation to Trash (Junk status)?')) {
      return;
    }

    fetch(getApiUrl(`/api_quotations.php?action=delete&id=${encodeURIComponent(id)}`), {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then(() => {
        setQuotations((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: 'junk' as any } : q))
        );
      })
      .catch((err) => console.log('Delete quotation error:', err));
  };

  const handleSelectAllToggle = () => {
    const visibleIds = filteredQuotations.map((q) => q.id);
    const allAreSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allAreSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const union = new Set([...prev, ...visibleIds]);
        return Array.from(union);
      });
    }
  };

  const handleRowCheckboxToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to move the ${selectedIds.length} selected quotations to Trash (Junk)?`)) {
      return;
    }

    setIsLoading(true);
    const promises = selectedIds.map((id) => {
      const payload = {
        id: id,
        status: 'junk',
        action: 'delete',
        user_name: currentUserRef.current?.name || currentUserRef.current?.email || 'Admin',
        user_email: currentUserRef.current?.email || 'admin@abmalaya.com'
      };
      return fetch(getApiUrl('/api_quotations.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((res) => res.json());
    });

    Promise.all(promises)
      .then(() => {
        setQuotations((prev) =>
          prev.map((q) => (selectedIds.includes(q.id) ? { ...q, status: 'junk' as any } : q))
        );
        setSelectedIds([]);
        setIsSelectionMode(false);
        alert('Selected quotation items moved to Trash!');
      })
      .catch((err) => console.error('Batch delete error:', err))
      .finally(() => setIsLoading(false));
  };

  const handleBatchStatusUpdate = (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    const actorName = currentUserRef.current?.name || currentUserRef.current?.email || 'Admin';
    const actorEmail = currentUserRef.current?.email || 'admin@abmalaya.com';
    const promises = selectedIds.map((id) => {
      const payload = {
        id: id,
        status: newStatus,
        action: 'status_update',
        user_name: actorName,
        user_email: actorEmail
      };
      return fetch(getApiUrl('/api_quotations.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((res) => res.json());
    });

    Promise.all(promises)
      .then(() => {
        setQuotations((prev) =>
          prev.map((q) => (selectedIds.includes(q.id) ? { ...q, status: newStatus as any } : q))
        );
        setSelectedIds([]);
        setIsSelectionMode(false);
        setShowBatchStatusDropdown(false);
        alert(`Selected quotation items status updated to ${newStatus}!`);
      })
      .catch((err) => console.error('Batch status update error:', err))
      .finally(() => setIsLoading(false));
  };

  // Siap Kirim = ada harga, ada file PDF/quotation, ada penerima email
  const isReadyForSend = (q: Quotation) => {
    const hasPrice = Number(q.grand_total) > 0 || Number(q.subtotal) > 0;
    const hasFile = Boolean(q.quotation_file) || q.pdf_created === 1;
    const hasRecipient = Boolean(q.client_email);
    return hasPrice && hasFile && hasRecipient;
  };

  // handleSendQuotation: Update status ke Done/Selesai di internal database (Pengiriman email otomatis diblokir demi keamanan)
  const handleSendQuotation = async (q: Quotation) => {
    const actorName = currentUserRef.current?.name || currentUserRef.current?.email || 'Admin';
    const actorEmail = currentUserRef.current?.email || 'admin@abmalaya.com';
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetFile = q.quotation_file || q.source_file || `QUO-${q.quotation_number}.pdf`;

    setIsSendingQuotation(true);

    try {
      // Update status di database ke 'done_send' tanpa menembak/mengirim email nyata ke klien (Blocked for safety)
      await fetch(getApiUrl('/api_quotations.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: q.id,
          status: 'done_send',
          action: 'status_update',
          user_name: actorName,
          user_email: actorEmail
        }),
      });

      setQuotations((prev) =>
        prev.map((item) => {
          if (item.id !== q.id) return item;
          let logs = [];
          try {
            if (item.history_log) logs = typeof item.history_log === 'string' ? JSON.parse(item.history_log) : item.history_log;
          } catch (e) {}
          if (!Array.isArray(logs)) logs = [];
          logs.push({ action: 'Mark Done / Sent', user_name: actorName, user_email: actorEmail, details: `Quotation & file (${targetFile}) marked Done / Sent by ${actorName}.`, timestamp: nowStr });
          return { ...item, status: 'done_send' as any, history_log: JSON.stringify(logs) };
        })
      );

      if (selectedInfoQuotation?.id === q.id) {
        setSelectedInfoQuotation((prev) => prev ? { ...prev, status: 'done_send' as any } : null);
      }

      alert(`[Status Updated]\nQuotation #${q.quotation_number} has been marked as Done / Sent.`);
      
    } catch (err: any) {
      console.error('Update quotation status error:', err);
      alert(`Failed to update status: ${err?.message || 'Database error'}`);
    } finally {
      setIsSendingQuotation(false);
    }
  };

  const tabCounts = useMemo(() => {
    let all = 0, requisition = 0, draft = 0, quotation = 0, ready_send = 0, done = 0, junk = 0;
    quotations.forEach((q) => {
      const st = (q.status || 'draft').toLowerCase();
      if (st === 'junk' || st === 'trash') {
        junk++;
      } else {
        all++;
        if (st === 'requisition' || st === '0' || st === 'masuk') requisition++;
        else if (st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim') done++;
        else if (st === 'ready_send' || st === 'acc' || st === 'approved' || st === 'disetujui') ready_send++;
        else if (st === 'quotation' || st === 'penawaran_terkirim') quotation++;
        else if (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress' || st === 'quotation_build') draft++;
        else if (isReadyForSend(q)) ready_send++;
        else draft++;
      }
    });
    return { all, requisition, draft, quotation, ready_send, done, junk };
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (q.quotation_number || '').toLowerCase().includes(term) ||
        (q.company_name || '').toLowerCase().includes(term) ||
        (q.client_name || '').toLowerCase().includes(term) ||
        (q.client_email || '').toLowerCase().includes(term) ||
        (q.category_name || '').toLowerCase().includes(term) ||
        (q.impa_code || '').toLowerCase().includes(term);

      const st = (q.status || 'draft').toLowerCase();

      if (activeTab === 'junk') {
        return matchesSearch && (st === 'junk' || st === 'trash');
      }

      if (st === 'junk' || st === 'trash') {
        return false;
      }

      if (activeTab === 'requisition') {
        return matchesSearch && (st === 'requisition' || st === '0' || st === 'masuk');
      }
      if (activeTab === 'draft') {
        // Draft = semua yang belum siap kirim dan bukan done/junk
        return matchesSearch && (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress' || st === 'quotation_build') && !isReadyForSend(q);
      }
      if (activeTab === 'quotation') {
        return matchesSearch && (st === 'quotation' || st === 'penawaran_terkirim');
      }
      if (activeTab === 'ready_send') {
        // Siap Kirim = status ready_send/acc/approved ATAU draft tapi sudah memenuhi syarat
        return matchesSearch && (st === 'ready_send' || st === 'acc' || st === 'approved' || st === 'disetujui' || isReadyForSend(q))
          && !(st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim')
          && !(st === 'junk' || st === 'trash');
      }
      if (activeTab === 'done') {
        return matchesSearch && (st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim');
      }

      return matchesSearch;
    });
  }, [quotations, searchTerm, activeTab]);

  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    const hasDec = num % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE TOP METALLIC NAVIGATION & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        {/* UNIFIED DROPDOWN FILTER BAR */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center bg-gradient-to-b from-white to-[#f0f0f0] border border-[#a0a0a0] rounded-md px-2.5 py-1 shadow-inner text-xs font-bold text-[#3d3d3d]">
            <Filter className="w-3.5 h-3.5 text-[#0080d0] shrink-0 mr-1.5" />
            <span className="text-[11px] text-slate-500 font-semibold mr-1.5 whitespace-nowrap">Filter Status:</span>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="bg-transparent font-bold text-xs text-[#0080d0] focus:outline-none cursor-pointer pr-1 appearance-none"
            >
              <option value="all">All Quotations ({tabCounts.all})</option>
              <option value="requisition">Requisition ({tabCounts.requisition})</option>
              <option value="draft">Draft / In Progress ({tabCounts.draft})</option>
              <option value="quotation">Quotation ({tabCounts.quotation})</option>
              <option value="ready_send">Ready to Send ({tabCounts.ready_send})</option>
              <option value="done">Done / Sent ({tabCounts.done})</option>
              <option value="junk">Trash / Junk ({tabCounts.junk})</option>
            </select>
            <Sliders className="w-3 h-3 text-slate-400 pointer-events-none ml-1 shrink-0" />
          </div>

          <div className="hidden md:flex items-center gap-1 bg-[#0080d0]/10 border border-[#0080d0]/20 px-2 py-1 rounded-md text-[11px] font-extrabold text-[#0080d0]">
            <span className="text-slate-500">Selected:</span>
            <span className="uppercase">
              {activeTab === 'all' && `All (${tabCounts.all})`}
              {activeTab === 'requisition' && `Requisition (${tabCounts.requisition})`}
              {activeTab === 'draft' && `Draft / In Progress (${tabCounts.draft})`}
              {activeTab === 'quotation' && `Quotation (${tabCounts.quotation})`}
              {activeTab === 'ready_send' && `Ready to Send (${tabCounts.ready_send})`}
              {activeTab === 'done' && `Done / Sent (${tabCounts.done})`}
              {activeTab === 'junk' && `Trash (${tabCounts.junk})`}
            </span>
          </div>
        </div>

        {/* Search Input Bar & Refresh Button */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
            <input
              type="search"
              placeholder="Search Quotation ID, company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#a0a0a0] rounded-full pl-9 pr-3 py-1 text-xs text-[#3d3d3d] focus:outline-none focus:border-[#0099ec] shadow-inner font-sans"
            />
          </div>

          <button
            onClick={() => fetchQuotationsFromMySQL(false)}
            disabled={isLoading}
            className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] text-[#3d3d3d] rounded-md shadow-inner transition cursor-pointer"
            title="Refresh MySQL Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0099ec]' : ''}`} />
          </button>

          <div className="relative shrink-0" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e6e6e6] border border-[#a0a0a0] text-[#3d3d3d] rounded-md shadow-inner transition cursor-pointer flex items-center justify-center"
              title="Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            
            {showActionsMenu && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white border border-[#9b9b9b] rounded-md shadow-lg z-50 py-1 font-sans text-xs">
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    onNewQuotation();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-[#3d3d3d]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#0080d0]" />
                  <span>New Quotation</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedIds([]);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-[#3d3d3d]"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isSelectionMode ? 'Exit Selection' : 'Select Quotations'}</span>
                </button>

                {/* USER REQUESTED: Right below "Select Quotations", add "Tampilkan Semua Kolom Database (Full)" */}
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowAllDbColumns(!showAllDbColumns);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-indigo-700 bg-indigo-50/60 border-t border-slate-100"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showAllDbColumns ? 'Standard Table View' : 'Show All Database Columns (Full)'}</span>
                </button>

                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setIsSystemInfoModalOpen(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-[#3d3d3d] border-t border-[#eee]"
                >
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Quotation & Categories Info</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Floating Batch Actions Bar */}
      {isSelectionMode && selectedIds.length > 0 && (
        <div className="bg-gradient-to-b from-[#e2e8f0] to-[#cbd5e1] border-b border-[#94a3b8] px-4 py-2 flex items-center justify-between text-xs text-slate-800 font-sans shadow-inner shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="bg-[#0080d0] text-white font-extrabold px-2 py-0.5 rounded-full text-[10px] animate-pulse">
              {selectedIds.length} Quotations Selected
            </span>
          </div>
          
          <div className="flex items-center gap-2 relative">
            {/* Batch Edit Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBatchStatusDropdown(!showBatchStatusDropdown)}
                className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] border border-[#a0a0a0] font-bold px-3 py-1 rounded shadow-xs cursor-pointer text-xs"
              >
                Batch Edit Status...
              </button>
              
              {showBatchStatusDropdown && (
                <div className="absolute right-0 top-7 w-40 bg-white border border-[#9b9b9b] rounded-md shadow-lg z-50 py-1 text-left font-sans text-xs">
                  {[
                    { val: 'requisition', label: 'REQUISITION' },
                    { val: 'draft', label: 'DRAFT / IN PROGRESS' },
                    { val: 'quotation', label: 'QUOTATION' },
                    { val: 'ready_send', label: 'READY TO SEND' },
                    { val: 'done_send', label: 'DONE / SENT' }
                  ].map((stItem) => (
                    <button
                      key={stItem.val}
                      onClick={() => handleBatchStatusUpdate(stItem.val)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 font-bold text-[#3d3d3d] transition"
                    >
                      Set to {stItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Batch Delete */}
            <button
              onClick={handleBatchDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded shadow-xs flex items-center gap-1 cursor-pointer text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move to Trash</span>
            </button>
          </div>
        </div>
      )}

      {/* PDF GENERATION IN PROGRESS BANNER INDICATOR */}
      {generatingPdfId && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold border-b border-amber-600 flex items-center justify-center gap-2 shadow-sm animate-pulse z-30 shrink-0">
          <Loader2 className="w-4 h-4 text-amber-950 animate-spin shrink-0" />
          <span>Generating PDF Document... Please wait a moment.</span>
        </div>
      )}

      {/* FULL WIDTH EDGE-TO-EDGE TABLE CONTAINER */}
      <div className="flex-1 p-0 overflow-y-auto space-y-0 w-full bg-[#f0f0f0] flex flex-col min-h-full">
        
        {isLoading ? (
          <div className="py-24 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Loading quotations...</p>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-[calc(100vh-140px)] overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)] bg-white pb-36">
            <table className="w-full text-left text-xs font-sans border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800 font-bold text-[11px] uppercase tracking-wider shadow-xs">
                <tr>
                  <th className="p-2.5 border-r border-slate-800 w-8 text-center">^</th>
                  <th className="p-2.5 border-r border-slate-800 w-8 text-center">
                    {isSelectionMode ? (
                      <input
                        type="checkbox"
                        checked={filteredQuotations.length > 0 && filteredQuotations.every((q) => selectedIds.includes(q.id))}
                        onChange={handleSelectAllToggle}
                        className="cursor-pointer"
                      />
                    ) : (
                      <Check className="w-3.5 h-3.5 mx-auto text-slate-300" />
                    )}
                  </th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-16 text-center">ID (DB)</th>}
                  <th className="p-2.5 border-r border-slate-800 w-28">Quotation Number</th>
                  <th className="p-2.5 border-r border-slate-800 w-44">IMPA Category</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-20 text-center">RFQ ID</th>}

                  <th className="p-2.5 border-r border-slate-800 w-32">Client Name</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-44">Client Email</th>}
                  <th className="p-2.5 border-r border-slate-800">Company</th>
                  <th className="p-2.5 border-r border-slate-800 w-28 text-center">Date Issued</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-28 text-center">Valid Until</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-32 text-right">Subtotal</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-28 text-right">Discount</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-20 text-center">Tax (%)</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-28 text-right">Tax Amount</th>}
                  <th className="p-2.5 border-r border-slate-800 w-44 text-right">Grand Total (RM)</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-36">Notes</th>}
                  <th className="p-2.5 border-r border-slate-800 w-36 text-center">Status</th>
                  <th className="p-2.5 border-r border-slate-800 w-28 text-center">File</th>
                  <th className="p-2.5 border-r border-slate-800 w-24 text-center">OCR Scan</th>
                  <th className="p-2.5 border-r border-slate-800 w-48">Petugas & Aktivitas</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-32 text-center">Approved By</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-28 text-center">Created By</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-36 text-center">Created At</th>}
                  <th className="p-2.5 border-r border-slate-800 w-28 text-center">Alerts</th>
                  <th className="p-2.5 text-center w-28 sticky right-0 z-30 bg-slate-900 border-l border-slate-800 shadow-[-3px_0_6px_rgba(0,0,0,0.25)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={showAllDbColumns ? 24 : 12} className="py-20 text-center text-slate-400 text-xs space-y-2 bg-white">
                      <FileType className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">No quotation data found in this view.</p>
                    </td>
                  </tr>
                ) : (
                  filteredQuotations.map((q, idx) => {
                  const isEven = idx % 2 === 1;
                  const isActive = activeRowId === q.id;

                  const st = (q.status || 'draft').toLowerCase();
                  const isDone = st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim' || st === 'penawaran_terkirim';
                  const isDraft = (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress') && !isReadyForSend(q);
                  const isQuotation = st === 'quotation' || st === 'quotation_build';
                  const isReadySend = st === 'ready_send' || st === 'acc' || st === 'approved' || st === 'disetujui' || (isReadyForSend(q) && !isDone && st !== 'requisition');

                  let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                  if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                  return (
                    <tr
                      key={q.id}
                      onClick={() => {
                        setActiveRowId(q.id);
                        setSelectedInfoQuotation(q);
                        setIsInfoModalOpen(true);
                      }}
                      className={`border-b border-[rgba(0,0,0,0.1)] hover:bg-slate-200/50 cursor-pointer transition ${rowBgClass}`}
                    >
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center" onClick={(e) => e.stopPropagation()}>
                        {isSelectionMode ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(q.id)}
                            onChange={() => handleRowCheckboxToggle(q.id)}
                            className="cursor-pointer"
                          />
                        ) : (
                          <Check className={`w-3.5 h-3.5 mx-auto ${isActive ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        )}
                      </td>

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-[11px] font-bold text-slate-500">
                          {q.id}
                        </td>
                      )}

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs">
                        {shortenQuotationNumber(q.quotation_number || q.id)}
                      </td>

                      {/* IMPA Category Column (Next to SPH Number / ID) */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        {q.impa_code || q.category_name ? (
                          <span
                            className="text-indigo-800 font-semibold text-[11px] truncate max-w-[170px] inline-block"
                            title={q.impa_code ? `${q.impa_code} - ${q.category_name}` : (q.category_name || '')}
                          >
                            {q.impa_code ? `${q.impa_code} — ` : ''}{q.category_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px] italic">—</span>
                        )}
                      </td>


                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-[11px] text-slate-600">
                          {q.rfq_id || '—'}
                        </td>
                      )}

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        <div className={`font-bold text-xs truncate max-w-[120px]`}>{q.client_name}</div>
                      </td>

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono text-[11px] text-slate-600">
                          {(() => {
                            const rawEm = q.client_email || '—';
                            if (rawEm.startsWith('{') || rawEm.startsWith('[')) {
                              try {
                                return JSON.parse(rawEm).selected || rawEm;
                              } catch (e) {}
                            }
                            return rawEm;
                          })()}
                        </td>
                      )}

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        <div className="font-bold text-xs mb-0.5 truncate max-w-[160px]">{getQuotationCompany(q)}</div>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-xs">
                        {q.date_issued}
                      </td>

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-xs text-slate-600">
                          {q.valid_until || '—'}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono text-xs text-slate-700 font-bold">
                          {formatCurrency(q.subtotal || 0)}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono text-xs text-slate-500">
                          {formatCurrency(q.discount_total || 0)}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-xs text-slate-600 font-bold">
                          {q.tax_percent !== undefined && q.tax_percent !== null ? `${q.tax_percent}%` : '11%'}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono text-xs text-slate-600 font-bold">
                          {formatCurrency(q.tax_amount || 0)}
                        </td>
                      )}

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-extrabold text-xs">
                        <span className={isActive ? 'text-amber-300' : 'text-blue-700'}>
                          {formatCurrency(q.grand_total)}
                        </span>
                      </td>

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-xs text-slate-600">
                          <div className="truncate max-w-[140px]" title={q.notes}>{q.notes || '—'}</div>
                        </td>
                      )}
                      
                      {/* STATUS CELL — status badge saja, tanpa PDF indicator */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans">
                        <div className="flex flex-col items-center gap-1">
                          {generatingPdfId === q.id ? (
                            <span className="font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 inline-flex items-center gap-1 text-[11px] animate-pulse" title="Puppeteer Headless Chrome is generating SPH PDF in background...">
                              <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                              <span>Generating PDF...</span>
                            </span>
                          ) : st === 'requisition' ? (
                            <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1 text-[11px]">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Requisition
                            </span>
                          ) : isDone ? (
                            <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Done / Sent
                            </span>
                          ) : isReadySend ? (
                            <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded inline-flex items-center gap-1 text-[11px]">
                              <Send className="w-3 h-3 text-indigo-600 shrink-0" />
                              Ready to Send
                            </span>
                          ) : isQuotation ? (
                            <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-flex items-center gap-1 text-[11px]">
                              <Sliders className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              Quotation
                            </span>
                          ) : isDraft ? (
                            <span className="font-extrabold text-amber-600 bg-amber-50/80 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1 text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Draft
                            </span>
                          ) : (
                            <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {q.status || 'Draft'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* FILE COLUMN CELL */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans">
                        {(Boolean(q.quotation_file) || q.pdf_created === 1) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPdfViewerQuotation(q);
                              setIsPdfViewerModalOpen(true);
                            }}
                            className="font-extrabold text-emerald-700 hover:text-emerald-900 bg-emerald-50/90 border border-emerald-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 text-[10px] cursor-pointer hover:bg-emerald-100 transition shadow-2xs"
                            title={q.quotation_file || 'PDF tersedia — klik untuk preview'}
                          >
                            <FileText className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-[80px]">
                              {q.quotation_file
                                ? q.quotation_file.substring(q.quotation_file.lastIndexOf('/') + 1)
                                : 'PDF Quotation'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* OCR SCAN STATUS CELL */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans">
                        {(() => {
                          const isWaitingThisRow = ocrRateLimitInfo?.active && ocrRateLimitInfo.quo_id === q.id && ocrRateLimitInfo.retryAfter > 0;
                          if (isWaitingThisRow) {
                            const secs = ocrRateLimitInfo.retryAfter;
                            const fmtTime = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
                            return (
                              <span className="font-extrabold text-amber-700 inline-flex items-center gap-1" title="Quota rate limited — Auto-retrying when countdown finishes">
                                <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                                Waiting AI ({fmtTime})
                              </span>
                            );
                          }
                          const ocrSt = q.ocr_scan_status || 'pending';
                          if (ocrSt === 'done') return <span className="font-bold text-emerald-700 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />Done</span>;
                          if (ocrSt === 'processing') return <span className="font-bold text-blue-700 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />Scanning</span>;
                          if (ocrSt === 'waiting_ai_limit' || ocrSt === 'waiting') return (
                            <span className="font-extrabold text-amber-700 inline-flex items-center gap-1" title="AI quota rate limited — Active countdown & auto-retry pending">
                              <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                              Waiting AI (Limit)
                            </span>
                          );
                          if (ocrSt === 'error') return <span className="font-bold text-rose-700 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />Error</span>;
                          if (ocrSt === 'skipped') return <span className="font-semibold text-slate-500">Skipped</span>;
                          return <span className="font-semibold text-slate-400">Pending</span>;
                        })()}
                      </td>

                      {/* PETUGAS & AKTIVITAS COLUMN */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-sans" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          let logsArr: any[] = [];
                          if (q.history_log) {
                            try {
                              logsArr = typeof q.history_log === 'string' ? JSON.parse(q.history_log) : q.history_log;
                            } catch (e) {}
                          }
                          const latestLog = Array.isArray(logsArr) && logsArr.length > 0 ? logsArr[logsArr.length - 1] : null;
                          
                          const rawActorName = latestLog?.user_name || q.created_by || getSessionActorName();
                          const lowerActor = rawActorName.toLowerCase();
                          const isDummyActor = lowerActor.includes('sales engineer') || lowerActor.includes('ilham') || lowerActor.includes('system') || lowerActor.includes('ocr daemon');
                          const actorName = isDummyActor ? (q.created_by || getSessionActorName()) : rawActorName;
                          const actionTitle = latestLog?.action || 'Record Initialized';
                          const logTime    = latestLog?.timestamp ? (latestLog.timestamp.split(' ')[1] || latestLog.timestamp).substring(0, 5) : '';

                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHistoryQuotation(q);
                                setIsHistoryModalOpen(true);
                              }}
                              className="text-left w-full hover:bg-blue-50/80 p-0.5 rounded transition cursor-pointer group"
                              title="Click to view full activity history log"
                            >
                              <div className="flex items-center gap-1 font-bold text-xs text-slate-900 truncate">
                                <User className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate">{actorName}</span>
                              </div>
                              <div className="flex items-center justify-between gap-1 mt-0.5">
                                <span className="text-[10px] font-bold text-indigo-700 truncate">
                                  {actionTitle}
                                </span>
                                {logTime && <span className="text-[9px] font-mono text-slate-400 shrink-0">{logTime}</span>}
                              </div>
                            </button>
                          );
                        })()}
                      </td>

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs">
                          {q.approved_by ? (
                            <span className="font-extrabold text-emerald-700">ACC Approved</span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">—</span>
                          )}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-[11px] text-slate-600">
                          {q.created_by || 'system'}
                        </td>
                      )}

                      {showAllDbColumns && (
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-[10px] text-slate-500">
                          {q.created_at || '—'}
                        </td>
                      )}

                      {/* ALERTS CELL */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const alerts = getQuotationAlerts(q);
                          if (alerts.length === 0) {
                            return <span className="text-slate-400 font-bold">-</span>;
                          }
                          const hasError = alerts.some(a => a.severity === 'error');
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAlertQuotation(q);
                                setIsAlertModalOpen(true);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black cursor-pointer transition shadow-2xs ${
                                hasError
                                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                              }`}
                              title={`Klik untuk melihat detail ${alerts.length} alert on this quotation`}
                            >
                              <AlertTriangle className={`w-3.5 h-3.5 ${hasError ? 'text-rose-600' : 'text-amber-600'}`} />
                              <span>{alerts.length}</span>
                            </button>
                          );
                        })()}
                      </td>

                      {/* ACTIONS BUTTONS (FROZEN ON RIGHT) */}
                      <td 
                        className={`p-2 text-center sticky right-0 z-20 border-l border-[rgba(0,0,0,0.1)] shadow-[-3px_0_6px_rgba(0,0,0,0.06)] ${isActive ? 'bg-[#3d3d3d] text-white' : isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          
                          {(isReadySend || isReadyForSend(q)) && !isDone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSendConfirmQuotation(q);
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] inline-flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
                              title="Send Quotation to Client"
                            >
                              <Send className="w-3 h-3 text-white" />
                              <span>Send</span>
                            </button>
                          )}

                          {/* Kebab action dropdown */}
                          <div className="relative row-action-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenRowActionId(openRowActionId === q.id ? null : q.id);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer flex items-center justify-center"
                              title="More Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {openRowActionId === q.id && (
                              <div className={`absolute right-0 w-48 bg-white border border-[#9b9b9b] rounded-md shadow-2xl z-50 py-1 text-left font-sans text-xs ${idx >= filteredQuotations.length - 2 && filteredQuotations.length > 2 ? 'bottom-full mb-1' : 'mt-1'}`}>
                                
                                {/* EDIT SPH / QUOTATION */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onEditQuotation(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-900 transition flex items-center gap-2 cursor-pointer font-bold border-b border-slate-100"
                                >
                                  <Edit className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Edit Quotation</span>
                                </button>

                                {/* OPEN IN EMAIL CLIENT */}
                                {onOpenEmailClient && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowActionId(null);
                                      onOpenEmailClient(q);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-indigo-900 transition flex items-center gap-2 cursor-pointer font-semibold border-b border-slate-100"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Open in Email Client</span>
                                  </button>
                                )}

                                {/* 1. CREATE PDF (Background Download) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    handleCreatePdfBackground(q);
                                  }}
                                  disabled={generatingPdfId === q.id}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-900 transition flex items-center gap-2 cursor-pointer font-bold disabled:opacity-60"
                                >
                                  {generatingPdfId === q.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                  ) : (
                                    <FileType className="w-3.5 h-3.5 text-blue-600" />
                                  )}
                                  <span>
                                    {generatingPdfId === q.id
                                      ? 'Generating PDF...'
                                      : q.pdf_created === 1
                                      ? 'Re-Create PDF'
                                      : 'Create PDF'}
                                  </span>
                                </button>

                                {/* 2. VIEW & PRINT SPH (HTML) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onPreviewDoc(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-900 transition flex items-center gap-2 cursor-pointer font-semibold border-t border-slate-100"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>View & Print Quotation (HTML)</span>
                                </button>

                                {/* 3. CREATE INVOICE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    const invUrl = `/view_doc.php?type=invoice&id=${encodeURIComponent(q.id)}`;
                                    window.open(invUrl, '_blank');
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-purple-900 transition flex items-center gap-2 cursor-pointer font-bold border-t border-slate-100"
                                >
                                  <FileType className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Create Invoice</span>
                                </button>

                                {/* 4. TO BUILDER */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onEditQuotation(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-amber-900 transition flex items-center gap-2 cursor-pointer font-semibold border-t border-slate-100"
                                >
                                  <Edit className="w-3.5 h-3.5 text-amber-600" />
                                  <span>To Builder</span>
                                </button>

                                {/* 5. VIEW LOG */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    setSelectedHistoryQuotation(q);
                                    setIsHistoryModalOpen(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-[#3d3d3d] transition flex items-center gap-2 cursor-pointer font-semibold border-t border-slate-100"
                                >
                                  <History className="w-3.5 h-3.5 text-purple-600" />
                                  <span>View Log</span>
                                </button>

                                {/* 6. SEND EMAIL */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onSendEmail(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-900 transition flex items-center gap-2 cursor-pointer font-bold border-t border-slate-100"
                                >
                                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Send Email (Attach PDF)</span>
                                </button>

                                {/* 7. VIEW FULL RECORD (DB) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    setSelectedFullDbQuotation(q);
                                    setIsFullDbModalOpen(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-900 transition flex items-center gap-2 cursor-pointer font-bold border-t border-slate-100"
                                >
                                  <Database className="w-3.5 h-3.5 text-blue-600" />
                                  <span>View Full Record (DB)</span>
                                </button>

                                <div className="border-t border-slate-100 my-1"></div>

                                {/* 5. DELETE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    handleDeleteQuotation(q.id);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition flex items-center gap-2 cursor-pointer font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}

      </div>


      {/* HISTORY AUDIT TRAIL LOG MODAL (SLIDE-OUT DRAWER FROM RIGHT) */}
      {isHistoryModalOpen && selectedHistoryQuotation && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-opacity duration-300 font-sans"
          onClick={() => {
            setIsHistoryModalOpen(false);
            setSelectedHistoryQuotation(null);
          }}
        >
          <div 
            className="bg-white border-l-2 border-slate-700 w-full sm:w-[500px] max-w-[95vw] shadow-2xl flex flex-col h-screen overflow-hidden animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-xs text-white">Quotation Audit Trail History</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Quotation ID: {selectedHistoryQuotation.quotation_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryQuotation(null);
                }}
                className="p-1 hover:bg-rose-600 hover:text-white rounded-md transition text-slate-400 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body: Timeline */}
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50">
              {(() => {
                let logs = [];
                try {
                  if (selectedHistoryQuotation.history_log) {
                    logs = JSON.parse(selectedHistoryQuotation.history_log);
                  }
                } catch (e) {
                  console.error("Error parsing history_log JSON", e);
                }

                if (!Array.isArray(logs) || logs.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-slate-300" />
                      <p>No audit trail or change history recorded for this quotation.</p>
                    </div>
                  );
                }

                return (
                  <div className="relative border-l-2 border-amber-500/40 ml-3 pl-5 space-y-4">
                    {logs.map((log: any, idx: number) => (
                      <div key={idx} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-amber-500 bg-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                        </div>

                        {/* Event Content */}
                        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-2xs flex flex-col gap-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider self-start sm:self-auto">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                              {log.timestamp}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-semibold">{log.details}</p>

                          <div className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-100 pt-1.5 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Executed by: <strong>{log.user_name}</strong> ({log.user_email})</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Drawer Footer */}
            <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryQuotation(null);
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded cursor-pointer"
              >
                Close History
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUOTATION INFO DETAIL MODAL (SLIDE-OUT DRAWER FROM RIGHT) */}
      {isInfoModalOpen && selectedInfoQuotation && (() => {
        const activeQuotation = quotations.find((q) => q.id === selectedInfoQuotation.id) || selectedInfoQuotation;
        return (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-opacity duration-300"
            onClick={() => {
              setIsInfoModalOpen(false);
              setSelectedInfoQuotation(null);
            }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .animate-slide-in-right {
                animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}</style>
            
            <div 
              className="bg-white border-l-2 border-[#7b7b7b] w-full sm:w-[80%] max-w-[95vw] shadow-2xl flex flex-col h-screen overflow-hidden font-sans animate-slide-in-right"
              onClick={(e) => e.stopPropagation()}
            >
              
              <div className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-3.5 py-3 border-b border-[#7b7b7b] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileType className="w-4 h-4 text-[#0080d0]" />
                  <div>
                    <h3 className="font-extrabold text-xs text-[#3d3d3d]">Full Info — Quotation</h3>
                    <select
                      value={activeQuotation.id}
                      onChange={(e) => {
                        const target = quotations.find((q) => q.id === e.target.value);
                        if (target) {
                          setSelectedInfoQuotation(target);
                          setActiveRowId(target.id);
                        }
                      }}
                      className="text-[9.5px] font-mono font-bold bg-white/90 border border-slate-400 rounded px-1.5 py-0.5 text-slate-800 cursor-pointer shadow-2xs mt-0.5 max-w-[260px] truncate"
                    >
                      {filteredQuotations.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quotation_number || q.id} — {q.client_name || 'Client'} ({getQuotationCompany(q)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Create Quotation Button */}
                  <button
                    onClick={() => handleCreatePdfBackground(activeQuotation)}
                    disabled={generatingPdfId === activeQuotation.id}
                    className="p-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded font-extrabold text-[10px] transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                    title="Generate PDF Quotation & buat file quotation"
                  >
                    {generatingPdfId === activeQuotation.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileType className="w-3.5 h-3.5" />
                    )}
                    <span>{generatingPdfId === activeQuotation.id ? 'Generating...' : 'Create Quotation'}</span>
                  </button>

                  {/* View PDF Button */}
                  <button
                    onClick={() => {
                      setSelectedPdfViewerQuotation(activeQuotation);
                      setIsPdfViewerModalOpen(true);
                    }}
                    className="p-1.5 bg-gradient-to-b from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-300 text-emerald-900 rounded font-extrabold text-[10px] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="View PDF preview in popup modal"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View PDF</span>
                  </button>

                  {/* SEND QUOTATION BUTTON — appears when ready to send, not yet done */}
                  {isReadyForSend(activeQuotation) && !(['done_send','sent','deal','terkirim','penawaran_terkirim'].includes((activeQuotation.status || '').toLowerCase())) && (
                    <button
                      onClick={() => setSendConfirmQuotation(activeQuotation)}
                      className="p-1.5 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded font-extrabold text-[10px] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Send quotation to client"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Quotation</span>
                    </button>
                  )}

                  {/* OCR Scan Trigger */}
                  <button
                    onClick={() => {
                      if (ocrRetryTimerRef.current) clearTimeout(ocrRetryTimerRef.current);
                      ocrRetryAttemptRef.current = 0;
                      triggerOcrScan(activeQuotation.id, 1);
                    }}
                    disabled={isScanningOcr}
                    className="p-1.5 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-300 rounded text-blue-900 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                    title="Trigger live Gemini AI OCR scan + IMPA matching"
                  >
                    {isScanningOcr ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <ScanLine className="w-3.5 h-3.5 text-blue-600" />}
                    <span className="text-[10px] font-extrabold">
                      {isScanningOcr
                        ? `Scanning${ocrRetryAttemptRef.current > 1 ? ` #${ocrRetryAttemptRef.current}` : ''}...`
                        : 'Rescan AI + IMPA'}
                    </span>
                  </button>


                  <button
                    onClick={() => {
                      setIsInfoModalOpen(false);
                      setSelectedInfoQuotation(null);
                    }}
                    className="p-1 hover:bg-rose-600 hover:text-white rounded-md transition text-slate-600 cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── OCR Status Notification Banners ─────────────────────── */}

              {/* Rate Limit Banner — live countdown + progress bar + auto-retry info */}
              {ocrRateLimitInfo && (
                <div className={`shrink-0 px-3 py-2.5 border-b ${
                  ocrRateLimitInfo.isPartialSuccess ? 'bg-amber-50 border-amber-300' : 'bg-orange-50 border-orange-300'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      <svg className={`w-4 h-4 ${ocrRateLimitInfo.isPartialSuccess ? 'text-amber-600' : 'text-orange-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-extrabold uppercase tracking-wide ${ocrRateLimitInfo.isPartialSuccess ? 'text-amber-700' : 'text-orange-700'}`}>
                          {ocrRateLimitInfo.isPartialSuccess ? 'AI Rate Limit — Partial Scan' : 'AI Rate Limit — Auto Retry'}
                        </p>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          ocrRateLimitInfo.isPartialSuccess ? 'bg-amber-200 text-amber-800' : 'bg-orange-200 text-orange-800'
                        }`}>
                          Attempt {ocrRateLimitInfo.attempt}/{MAX_OCR_RETRIES}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{ocrRateLimitInfo.message}</p>

                      {/* Progress bar + countdown */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500">Auto-retry in:</span>
                          <span className={`text-[10px] font-mono font-black ${
                            ocrRateLimitInfo.retryAfter <= 10
                              ? 'text-emerald-600'
                              : ocrRateLimitInfo.isPartialSuccess ? 'text-amber-700' : 'text-orange-700'
                          }`}>
                            {ocrRateLimitInfo.retryAfter >= 60
                              ? `${Math.floor(ocrRateLimitInfo.retryAfter / 60)}m ${String(ocrRateLimitInfo.retryAfter % 60).padStart(2,'0')}s`
                              : `${ocrRateLimitInfo.retryAfter}s`
                            }
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              ocrRateLimitInfo.isPartialSuccess ? 'bg-amber-500' : 'bg-orange-500'
                            }`}
                            style={{
                              width: `${Math.max(0, Math.min(100, 100 - (ocrRateLimitInfo.retryAfter / (ocrRateLimitInfo.totalWait || 60)) * 100))}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (ocrRetryTimerRef.current) clearTimeout(ocrRetryTimerRef.current);
                        setOcrRateLimitInfo(null);
                        setOcrErrorMsg('Auto-retry cancelled.');
                        setTimeout(() => setOcrErrorMsg(null), 4000);
                      }}
                      className="shrink-0 text-slate-400 hover:text-slate-600 mt-0.5"
                      title="Cancel auto-retry"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}


              {/* Success Banner */}
              {ocrSuccessMsg && (
                <div className="shrink-0 px-3 py-2 border-b bg-emerald-50 border-emerald-300 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <p className="text-[10px] text-emerald-800 font-semibold flex-1">{ocrSuccessMsg}</p>
                  <button onClick={() => setOcrSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {ocrErrorMsg && (
                <div className="shrink-0 px-3 py-2 border-b bg-rose-50 border-rose-300 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <p className="text-[10px] text-rose-700 font-semibold flex-1">{ocrErrorMsg}</p>
                  <button onClick={() => setOcrErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {/* TAB SYSTEM NAVIGATION — 4 TABS */}

              <div className="bg-slate-100 border-b border-slate-300 flex shrink-0 text-[11px]">
                {([
                  { id: 'summary', label: 'Summary & Items' },
                  { id: 'email', label: 'Email Source' },
                  { id: 'history', label: 'Edit History' },
                  { id: 'acc', label: 'ACC Approval' },
                ] as Array<{ id: 'summary'|'email'|'history'|'acc'; label: string }>).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id)}
                    className={`flex-1 text-center py-2 font-bold cursor-pointer transition ${
                      drawerTab === tab.id
                        ? 'bg-white border-b-2 border-[#0080d0] text-[#0080d0]'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content Area — Clean Border-Separated Flat Layout */}
              <div key={activeQuotation.id} className="flex-1 p-4 overflow-y-auto bg-white divide-y divide-slate-200 text-[11px] text-[#3d3d3d] space-y-4">
                
                {drawerTab === 'summary' && (
                  <>
                    {/* Status Header Bar */}
                    <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Status:</span>
                        {(() => {
                          const st = (activeQuotation.status || 'draft').toLowerCase();
                          const isDoneDrawer = st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim' || st === 'penawaran_terkirim';
                          const isReadySendDrawer = st === 'ready_send' || st === 'acc' || st === 'approved' || st === 'disetujui' || (isReadyForSend(activeQuotation) && !isDoneDrawer && st !== 'requisition');
                          const isDraftDrawer = (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress') && !isReadySendDrawer;
                          const isQuotationDrawer = st === 'quotation' || st === 'quotation_build';

                          if (st === 'requisition') {
                            return <span className="bg-amber-50 text-amber-800 border border-amber-300 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Requisition</span>;
                          } else if (isDoneDrawer) {
                            return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Done / Sent</span>;
                          } else if (isReadySendDrawer) {
                            return <span className="bg-indigo-50 text-indigo-800 border border-indigo-300 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Ready to Send</span>;
                          } else if (isDraftDrawer) {
                            return <span className="bg-amber-100 text-amber-800 border border-amber-200 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Draft</span>;
                          } else if (isQuotationDrawer) {
                            return <span className="bg-blue-50 text-blue-900 border border-blue-200 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Quotation</span>;
                          }
                          return <span className="bg-slate-200 font-bold px-2 py-0.5 rounded-sm uppercase text-[9px]">{activeQuotation.status}</span>;
                        })()}
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-500">
                        Date Issued: <strong className="text-slate-800">{activeQuotation.date_issued}</strong>
                      </div>
                    </div>

                    {/* Alerts Warning Banner in Full Info */}
                    {(() => {
                      const alerts = getQuotationAlerts(activeQuotation);
                      if (alerts.length === 0) return null;
                      return (
                        <div className="mb-3 bg-amber-50/90 border border-amber-300 rounded-md p-2.5 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11px] mb-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Quotation Warnings & Alerts ({alerts.length} Active Warnings):</span>
                          </div>
                          <div className="space-y-1">
                            {alerts.map((al) => (
                              <div key={al.id} className="flex items-start gap-1.5 text-[10px] text-amber-950">
                                <span className="font-bold shrink-0">• {al.title}:</span>
                                <span className="text-amber-900">{al.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Client & Document Details (Flat Rows with Left Border Highlights) */}
                    <div className="pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                        <div className="border-l-2 border-blue-500 pl-2.5">
                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Company Name</h4>
                          <p className="font-bold text-[#0080d0] text-xs">{getQuotationCompany(activeQuotation)}</p>
                        </div>
                        <div className="border-l-2 border-slate-300 pl-2.5">
                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Attention / Contact</h4>
                          <p className="font-bold text-slate-800">{activeQuotation.client_name || '-'}</p>
                        </div>
                        <div className="border-l-2 border-slate-300 pl-2.5">
                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Phone Number</h4>
                          <p className="font-mono font-bold text-slate-800">
                            {activeQuotation.client_phone || (() => {
                              if (activeQuotation.ocr_scan_result) {
                                try {
                                  const parsed = JSON.parse(activeQuotation.ocr_scan_result);
                                  return parsed.phone || '—';
                                } catch(e) {}
                              }
                              return '—';
                            })()}
                          </p>
                        </div>
                        <div className="col-span-2 border-l-2 border-slate-300 pl-2.5">
                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Client Email (JSON Selected Dropdown)</h4>
                          {(() => {
                            let selectedEmail = activeQuotation.client_email || '';
                            let optionsList: Array<{ email: string; source: string }> = [];

                            if (selectedEmail.startsWith('{') || selectedEmail.startsWith('[')) {
                              try {
                                const parsedJson = JSON.parse(selectedEmail);
                                selectedEmail = parsedJson.selected || '';
                                optionsList = parsedJson.options || [];
                              } catch (e) {}
                            }

                            if (optionsList.length === 0 && selectedEmail) {
                              optionsList.push({ email: selectedEmail, source: 'Primary Sender Email' });
                            }

                            const handleSelectEmail = (newEmail: string) => {
                              const updatedJson = JSON.stringify({
                                selected: newEmail,
                                options: optionsList.length > 0 ? optionsList : [{ email: newEmail, source: 'Selected Email' }]
                              });
                              setQuotations(prev => prev.map(q => q.id === activeQuotation.id ? { ...q, client_email: updatedJson } : q));
                              setSelectedInfoQuotation(prev => prev ? { ...prev, client_email: updatedJson } : null);

                              fetch(getApiUrl('/api_quotations.php'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: activeQuotation.id, client_email: updatedJson })
                              }).catch(err => console.error('Save email update error:', err));
                            };

                            return (
                              <div className="space-y-1">
                                {optionsList.length > 1 ? (
                                  <select
                                    value={selectedEmail}
                                    onChange={(e) => handleSelectEmail(e.target.value)}
                                    className="bg-blue-50 border border-blue-300 font-mono text-[10px] font-bold text-blue-900 px-2 py-1 rounded w-full cursor-pointer focus:outline-none"
                                  >
                                    {optionsList.map((opt, oIdx) => (
                                      <option key={oIdx} value={opt.email}>
                                        {opt.email} ({opt.source})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="text-slate-800 font-mono font-bold text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                                    {selectedEmail || '—'}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="border-l-2 border-indigo-500 pl-2.5">
                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Category & IMPA Code</h4>
                          {activeQuotation.impa_code || activeQuotation.category_name ? (
                            <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                              <Tag className="w-3 h-3 text-indigo-600" />
                              {activeQuotation.impa_code ? `${activeQuotation.impa_code} — ` : ''}{activeQuotation.category_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px] italic">Not specified</span>
                          )}
                        </div>
                        {/* Document & Files Section (File Sumber RFQ, File Quotation SPH, File Quotation Invoice) */}
                        <div className="col-span-3 border-l-2 border-indigo-500 pl-2.5 bg-slate-50/80 p-2.5 rounded border border-slate-200 mt-1">
                          <h4 className="text-[9.5px] text-slate-700 uppercase font-extrabold tracking-wider mb-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>Documents & Files (RFQ, Quotation & Invoice)</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                            {/* 1. File Sumber RFQ */}
                            <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                              <span className="text-slate-400 font-extrabold text-[9px] block uppercase tracking-wider mb-1">Source File:</span>
                              {(() => {
                                let fileUrl = activeQuotation.source_file || activeQuotation.email_source?.attachment_url || '';
                                if ((!fileUrl || fileUrl === 'NONE') && activeQuotation.ocr_scan_result) {
                                  try {
                                    const parsedOcr = JSON.parse(activeQuotation.ocr_scan_result);
                                    fileUrl = parsedOcr?.file_url || '';
                                  } catch (e) {}
                                }
                                if (!fileUrl || fileUrl === 'NONE') {
                                  return <span className="font-mono text-slate-400 italic">No attachments</span>;
                                }
                                const isDrive = fileUrl.toLowerCase().includes('drive.google') || fileUrl.toLowerCase().includes('docs.google') || fileUrl.toLowerCase().includes('gdrive');
                                let filename = fileUrl;
                                if (fileUrl.includes('fn=')) {
                                  const match = fileUrl.match(/fn=([^&]+)/);
                                  if (match) filename = decodeURIComponent(match[1]);
                                } else if (fileUrl.includes('/')) {
                                  filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
                                }
                                return (
                                  <a
                                    href={getApiUrl(fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-blue-600 hover:underline flex items-center gap-1 font-mono text-[10px] truncate"
                                    title={getApiUrl(fileUrl)}
                                  >
                                    <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{isDrive ? 'Google Drive Link' : filename}</span>
                                  </a>
                                );
                              })()}
                            </div>

                            {/* 2. File Quotation SPH */}
                            <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                              <span className="text-slate-400 font-extrabold text-[9px] block uppercase tracking-wider mb-1">Quotation PDF File:</span>
                              {activeQuotation.quotation_file || activeQuotation.pdf_created === 1 ? (
                                <div className="flex items-center justify-between gap-1">
                                  <a
                                    href={activeQuotation.quotation_file ? getApiUrl(activeQuotation.quotation_file) : getApiUrl(`/api_pdf.php?action=stream&type=quotation&id=${encodeURIComponent(activeQuotation.id)}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1 font-mono text-[10px] truncate"
                                    title="Download / Open Quotation PDF File"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">{activeQuotation.quotation_number || activeQuotation.id}.pdf</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPdfViewerQuotation(activeQuotation);
                                      setIsPdfViewerModalOpen(true);
                                    }}
                                    className="text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-100 cursor-pointer shrink-0"
                                  >
                                    Preview
                                  </button>
                                </div>
                              ) : (
                                <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[9.5px] font-semibold block border border-amber-200">
                                  Not generated yet (Click 'Create Quotation')
                                </span>
                              )}
                            </div>

                            {/* 3. File Quotation Invoice */}
                            <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                              <span className="text-slate-400 font-extrabold text-[9px] block uppercase tracking-wider mb-1">File Quotation Invoice:</span>
                              <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[9.5px] block border border-slate-200 italic">
                                Not generated yet (Invoice Plan)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unified Items Table (Combined SPH & AI OCR Extracted Items with Full Specification Columns) */}
                    <div className="pt-3 space-y-2">
                      {(() => {
                        let ocrItems: any[] = [];
                        if (activeQuotation.ocr_scan_result) {
                          try {
                            const parsed = JSON.parse(activeQuotation.ocr_scan_result);
                            if (Array.isArray(parsed?.items)) ocrItems = parsed.items;
                          } catch (e) {}
                        }

                        const hasSphItems = Array.isArray(activeQuotation.items_details) && activeQuotation.items_details.length > 0;
                        const displayItems = hasSphItems ? activeQuotation.items_details! : [];
                        
                        const unregCount = hasSphItems
                          ? displayItems.filter(it => it.is_registered === false).length
                          : (activeQuotation.unregistered_items_count ?? ocrItems.length);

                        return (
                          <>
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Line Items Specification & Details</span>
                                {unregCount > 0 && (
                                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1 shadow-2xs animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    <span>{unregCount} Unregistered Item{unregCount > 1 ? 's' : ''}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="border border-slate-200 rounded-md overflow-x-auto shadow-2xs">
                              <table className="w-full text-left text-[10px] font-sans border-collapse">
                                <thead className="border-b bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-slate-300">
                                  <tr>
                                    <th className="py-2.5 px-2.5 text-center w-8">#</th>
                                    <th className="py-2.5 px-2 text-center w-12">Photo</th>
                                    <th className="py-2.5 px-2 w-28 font-mono">Part / IMPA Code</th>
                                    <th className="py-2.5 px-2">Item Name (Description)</th>
                                    <th className="py-2.5 px-2">Specification / Technical Details</th>
                                    <th className="py-2.5 px-2 w-24">Supplier / Seller</th>
                                    <th className="py-2.5 px-2 text-center w-16">Qty</th>
                                    <th className="py-2.5 px-2 text-right w-24">Unit Price (MYR)</th>
                                    <th className="py-2.5 px-2 text-center w-16">Disc (%)</th>
                                    <th className="py-2.5 px-2 text-right w-24">Total Amount</th>
                                    <th className="py-2.5 px-2 text-center w-24">Catalog Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {hasSphItems ? (
                                    displayItems.map((item, idx) => {
                                      const isRegistered = item.is_registered === true;
                                      return (
                                        <tr 
                                          key={idx} 
                                          className={`transition-colors ${
                                            isRegistered 
                                              ? 'hover:bg-slate-50' 
                                              : 'bg-rose-50/60 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                                          }`}
                                        >
                                          <td className="py-2 px-2.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                                          <td className="py-1 px-2 text-center">
                                            {item.image_url ? (
                                              <img src={item.image_url} alt="Photo" className="w-8 h-8 object-cover rounded border border-slate-200 mx-auto" />
                                            ) : (
                                              <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded mx-auto flex items-center justify-center text-slate-400 text-[8px]">
                                                <ImageIcon className="w-3.5 h-3.5 opacity-40" />
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 font-mono text-slate-700 font-bold">
                                            <div>{item.product_code || '—'}</div>
                                            {item.impa_code || item.category_code || activeQuotation.impa_code ? (
                                              <span className="mt-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded text-[8px] inline-flex items-center gap-1">
                                                <span>🏷 IMPA {item.impa_code || item.category_code || activeQuotation.impa_code}</span>
                                              </span>
                                            ) : null}
                                          </td>
                                          <td className="py-2 px-2 font-bold text-slate-800">
                                            {item.description}
                                          </td>
                                          <td className="py-2 px-2 text-slate-600 italic leading-snug">{item.specification || 'Standard specification'}</td>
                                          <td className="py-2 px-2 font-mono text-[9px] text-slate-600">
                                            {(item as any).supplier_name ? (
                                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded">
                                                {(item as any).supplier_name}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 italic">—</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2 text-center font-mono font-bold">{item.quantity} {item.unit}</td>
                                          <td className="py-2 px-2 text-right font-mono text-slate-600">{formatCurrency(item.unit_price || 0)}</td>
                                          <td className="py-2 px-2 text-center font-mono text-rose-600">{item.discount_percent ? `${item.discount_percent}%` : '0%'}</td>
                                          <td className="py-2 px-2 text-right font-mono font-extrabold text-slate-900">{formatCurrency(item.total)}</td>
                                          <td className="py-2 px-2 text-center">
                                            {isRegistered ? (
                                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[8px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                                <span>✓</span>
                                                <span>Registered</span>
                                              </span>
                                            ) : (
                                              <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[8px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shadow-2xs whitespace-nowrap">
                                                <span>⚠️</span>
                                                <span>Unregistered</span>
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : ocrItems.length > 0 ? (
                                    ocrItems.map((it: any, idx: number) => (
                                      <tr key={idx} className="bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500 transition-colors">
                                        <td className="py-2 px-2.5 text-center font-mono text-amber-700 font-bold">{idx + 1}</td>
                                        <td className="py-1 px-2 text-center">
                                          {it.image_url ? (
                                            <img src={it.image_url} alt="Photo" className="w-8 h-8 object-cover rounded border border-amber-200 mx-auto" />
                                          ) : (
                                            <div className="w-8 h-8 bg-amber-100/60 border border-amber-200 rounded mx-auto flex items-center justify-center text-amber-500 text-[8px]">
                                              <ImageIcon className="w-3.5 h-3.5 opacity-60" />
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-700 font-bold">
                                          <div>{it.product_code || '—'}</div>
                                          {it.impa_code || it.category_code || activeQuotation.impa_code ? (
                                            <span className="mt-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded text-[8px] inline-flex items-center gap-1">
                                              <span>🏷 IMPA {it.impa_code || it.category_code || activeQuotation.impa_code}</span>
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="py-2 px-2 font-bold text-slate-900">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>{it.description || '—'}</span>
                                            <span className="bg-blue-100 text-blue-800 text-[8px] font-black px-1.5 py-0.2 rounded border border-blue-300">OCR</span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 text-slate-700 italic leading-snug">{it.specification || 'Extracted via Vision AI'}</td>
                                        <td className="py-2 px-2 font-mono text-[9px] text-slate-600">
                                          {it.supplier_name ? (
                                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded">
                                              {it.supplier_name}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 italic">—</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2 text-center font-mono font-bold text-amber-900">{it.qty ?? 1} {it.unit || 'pcs'}</td>
                                        <td className="py-2 px-2 text-right font-mono font-bold text-amber-900">{it.unit_price != null ? formatCurrency(it.unit_price) : '—'}</td>
                                        <td className="py-2 px-2 text-center font-mono text-rose-600">{it.discount_percent != null ? `${it.discount_percent}%` : '—'}</td>
                                        <td className="py-2 px-2 text-right font-mono font-extrabold text-amber-950">{it.total != null ? formatCurrency(it.total) : '—'}</td>
                                        <td className="py-2 px-2 text-center">
                                          <span className="bg-amber-100 text-amber-950 border border-amber-300 font-bold text-[8px] px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap">
                                            ⚠️ Draft OCR
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={11} className="py-6 text-center text-slate-400 font-bold">No line items specified.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Financial Costing Summary (Border Separated, Flat Lines) */}
                    <div className="pt-3 space-y-2">
                      <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Financial Breakdown</h4>
                      <div className="space-y-1.5 font-mono text-[11px] max-w-xs ml-auto">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-bold">{formatCurrency(activeQuotation.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span>-{formatCurrency(activeQuotation.discount_total)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Tax / SST ({activeQuotation.tax_percent}%):</span>
                          <span>{formatCurrency(activeQuotation.tax_amount)}</span>
                        </div>
                        <div className="border-t-2 border-slate-800 pt-2 flex justify-between font-bold text-xs text-[#0080d0]">
                          <span>Grand Total:</span>
                          <span className="text-sm">{formatCurrency(activeQuotation.grand_total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Remarks Section */}
                    {activeQuotation.notes && (
                      <div className="pt-3 space-y-1">
                        <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Notes & Remarks</h4>
                        <p className="text-slate-600 italic leading-relaxed">{activeQuotation.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── TAB: EMAIL SOURCE ────────────────────────────────────────── */}
                {drawerTab === 'email' && (
                  <>
                    {/* Email Source Tab */}
                    {activeQuotation.email_source ? (
                      <div className="space-y-3 pt-1">
                        <div className="border-l-2 border-blue-500 pl-3 space-y-2">
                          <div>
                            <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Linked RFQ Record</h4>
                            <p className="font-mono text-slate-800 font-bold">RFQ-{activeQuotation.email_source.id} (Seq: {activeQuotation.email_source.rfq_number})</p>
                          </div>
                          <div>
                            <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Sender Details</h4>
                            <p className="font-bold text-slate-800">{activeQuotation.email_source.sender_name} <span className="font-mono text-[10px] text-slate-500 font-normal">({activeQuotation.email_source.sender_email})</span></p>
                          </div>
                          <div>
                            <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Email Subject</h4>
                            <p className="font-semibold text-slate-800">{activeQuotation.email_source.subject}</p>
                          </div>
                          <div>
                            <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Date Received</h4>
                            <p className="font-mono text-slate-600">{activeQuotation.email_source.created_at}</p>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => setShowEmailBody(!showEmailBody)}
                            className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-bold text-slate-700 transition cursor-pointer text-xs"
                          >
                            {showEmailBody ? 'Hide Full Email Body' : 'Show Full Email Body'}
                          </button>
                          
                          {showEmailBody && (
                            <div className="mt-2 p-3 border-t border-b border-slate-200 font-mono text-[10px] whitespace-pre-wrap leading-relaxed text-slate-700 select-text max-h-80 overflow-y-auto">
                              {cleanEmailBodyText(activeQuotation.email_source.message_body) || 'No email body text stored.'}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center text-slate-400 font-bold space-y-1">
                        <Clock className="w-8 h-8 mx-auto text-slate-300" />
                        <p>This quotation was created manually without a linked IMAP Gmail RFQ email source.</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── TAB: EDIT HISTORY ────────────────────────────────────────── */}
                {drawerTab === 'history' && (
                  <div className="pt-1 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Audit Trail & History Log</h4>
                      <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                        <span className="text-slate-400 font-bold">OCR Status:</span>
                        {activeQuotation.ocr_scan_status === 'done' && (
                          <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-300">Done (Scanned)</span>
                        )}
                        {(activeQuotation.ocr_scan_status === 'waiting_ai_limit' || activeQuotation.ocr_scan_status === 'waiting') && (
                          <span className="bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-amber-300 inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                            Waiting AI (Limit)
                          </span>
                        )}
                        {activeQuotation.ocr_scan_status === 'skipped' && (
                          <span className="bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-slate-300">Skipped (No Attachment)</span>
                        )}
                        {activeQuotation.ocr_scan_status === 'error' && (
                          <span className="bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded text-[9px] uppercase border border-rose-300">Error</span>
                        )}
                        {(!activeQuotation.ocr_scan_status || activeQuotation.ocr_scan_status === 'pending') && (
                          <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[9px] uppercase">Pending</span>
                        )}
                      </div>
                    </div>

                    {(() => {
                      let logs: any[] = [];
                      try {
                        if (activeQuotation.history_log) {
                          logs = JSON.parse(activeQuotation.history_log);
                        }
                      } catch (e) {}

                      // Filter out obsolete pre-fix OCR error logs if status is skipped or done
                      const currentOcrSt = activeQuotation.ocr_scan_status;
                      const activeLogs = Array.isArray(logs) ? logs.filter((entry: any) => {
                        const actionStr = String(entry?.action || '').toLowerCase();
                        const detailsStr = String(entry?.details || '');
                        const isOcr = actionStr.includes('ocr');
                        const isObsoleteError = detailsStr.includes('HTTP 404') || detailsStr.includes('URL: NONE') || detailsStr.includes('Download failed');
                        if (isOcr && isObsoleteError && (currentOcrSt === 'skipped' || currentOcrSt === 'done')) {
                          return false;
                        }
                        return true;
                      }) : [];

                      if (activeLogs.length === 0) {
                        return (
                          <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                            <Clock className="w-7 h-7 mx-auto text-slate-300" />
                            <p>No active audit trail records found for this quotation.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="divide-y divide-slate-100">
                          {[...activeLogs].reverse().map((entry: any, idx: number) => (
                            <div key={idx} className="py-2.5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="bg-slate-100 text-slate-700 font-black px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-wider">{entry.action}</span>
                                <span className="font-mono text-[9px] text-slate-400">{entry.timestamp}</span>
                              </div>
                              {(() => {
                                const rawLogName = entry.user_name || activeQuotation.created_by || getSessionActorName();
                                const lowerLogName = rawLogName.toLowerCase();
                                const isDummyLog = lowerLogName.includes('sales engineer') || lowerLogName.includes('ilham') || lowerLogName.includes('system') || lowerLogName.includes('ocr daemon');
                                const displayLogName = isDummyLog ? (activeQuotation.created_by || getSessionActorName()) : rawLogName;
                                const displayEmail = (entry.user_email && !entry.user_email.toLowerCase().includes('system@') && !entry.user_email.toLowerCase().includes('daemon@'))
                                  ? entry.user_email
                                  : (currentUserRef.current?.email || '');
                                return <p className="font-bold text-[10px] text-slate-800">{displayLogName} {displayEmail && <span className="text-slate-400 font-normal">({displayEmail})</span>}</p>;
                              })()}
                              <p className="text-[10px] text-slate-600">{entry.details}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── TAB: ACC APPROVAL ────────────────────────────────────────── */}
                {drawerTab === 'acc' && (
                  <div className="pt-1 space-y-3">
                    <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Internal Management Approval</h4>

                    {/* Approval log list */}
                    {(() => {
                      let approvals: any[] = [];
                      try {
                        if (activeQuotation.approved_by) {
                          approvals = JSON.parse(activeQuotation.approved_by);
                        }
                      } catch (e) {}
                      if (!Array.isArray(approvals) || approvals.length === 0) {
                        return (
                          <div className="py-10 text-center text-slate-400 text-xs font-bold space-y-2">
                            <ShieldCheck className="w-7 h-7 mx-auto text-slate-300" />
                            <p>No management approvals granted for this quotation yet.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="divide-y divide-slate-100 mb-3">
                          {approvals.map((a: any, idx: number) => (
                            <div key={idx} className="py-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-emerald-700 font-extrabold text-[10px] uppercase flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Approved
                                </span>
                                <span className="font-mono text-[9px] text-slate-400">{a.timestamp}</span>
                              </div>
                              <p className="font-bold text-[10px] text-slate-800">{a.user_name} <span className="text-slate-400 font-normal">({a.user_email})</span></p>
                              {a.note && <p className="text-[10px] text-slate-600 italic">Note: {a.note}</p>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* ACC Approval Form */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Grant Approval & Remarks</p>
                      <textarea
                        value={accNote}
                        onChange={e => setAccNote(e.target.value)}
                        placeholder="Approval remarks (optional)..."
                        className="w-full bg-white border border-slate-300 rounded p-2 text-[11px] focus:outline-none focus:border-[#0080d0] resize-none font-sans"
                        rows={2}
                      />
                      <button
                        onClick={() => {
                          const userName = currentUserRef.current?.name || currentUserRef.current?.email || 'Admin';
                          const userEmail = currentUserRef.current?.email || 'admin@abmalaya.com';
                          fetch(getApiUrl('/api_quotations.php'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'approve',
                              id: activeQuotation.id,
                              user_name: userName,
                              user_email: userEmail,
                              note: accNote
                            })
                          })
                            .then(r => r.json())
                            .then(d => {
                              if (d.status === 'success') {
                                let current: any[] = [];
                                try { if (activeQuotation.approved_by) current = JSON.parse(activeQuotation.approved_by); } catch(e) {}
                                current.push({ timestamp: new Date().toISOString().replace('T',' ').substring(0,19), user_name: userName, user_email: userEmail, note: accNote });
                                setQuotations(prev => prev.map(q => q.id === activeQuotation.id ? { ...q, approved_by: JSON.stringify(current), status: 'ready_send' } : q));
                                setAccNote('');
                                alert('ACC Approval recorded and Quotation status updated to Ready to Send (ready_send)!');
                              }
                            })
                            .catch(e => console.error('ACC error:', e));
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Grant ACC Approval</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>{/* END Drawer Content Area */}

              {/* Modal Footer Actions */}
              <div className="bg-gradient-to-b from-[#fcfcfc] to-[#e1e1e1] px-3.5 py-3 border-t border-[#7b7b7b] flex justify-between items-center gap-2 shrink-0">
                
                {/* Direct Print Buttons toolbar */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => triggerSPHPrint(activeQuotation, 'png')}
                    className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e6e6e6] text-[#3d3d3d] font-bold text-xs p-1.5 rounded border border-[#a0a0a0] transition cursor-pointer flex items-center justify-center gap-1"
                    title="Save Quotation PNG image"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />

                    <span className="hidden sm:inline">PNG</span>
                  </button>
                </div>

                {/* Edit and Close */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsInfoModalOpen(false);
                      onEditQuotation(activeQuotation);
                    }}
                    className="bg-gradient-to-b from-[#00b4ff] to-[#0080d0] text-white font-bold text-xs px-3.5 py-1.5 rounded border border-[#0060b0] hover:bg-[#0070b8] transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit in Builder</span>
                  </button>
                  
                  <button
onClick={() => {
                      setIsInfoModalOpen(false);
                      setSelectedInfoQuotation(null);
                    }}
                    className="bg-gradient-to-b from-[#fcfcfc] to-[#d2d2d2] text-[#3d3d3d] font-bold text-xs px-3.5 py-1.5 rounded border border-[#7b7b7b] hover:bg-[#c8c8c8] shadow-inner transition cursor-pointer"
                  >
                    Close Details
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* System info and Category Diagnostics Modal - White Theme, Eurostile Font & Sharp Corners */}
      {isSystemInfoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div 
            className="bg-white text-slate-900 border border-slate-300 shadow-2xl w-full max-w-5xl flex flex-col h-[600px] overflow-hidden rounded-none"
            style={{ fontFamily: "'Eurostile', 'Inter', -apple-system, sans-serif" }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
              <span className="font-extrabold uppercase text-cyan-400 tracking-widest text-xs flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>PHP DAEMON AUTOMATION ENGINES & SYSTEM DIAGNOSTICS</span>
              </span>
              <button 
                onClick={() => setIsSystemInfoModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1"
              >
                <CloseIcon className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Tab Headers */}
            <div className="flex border-b border-slate-200 bg-slate-100 px-3 py-1 shrink-0 gap-1">
              {[
                { id: 'sph', label: 'Tabel Mesin Daemon PHP' },
                { id: 'categories', label: 'IMPA Category Blueprints' },
                { id: 'errors', label: 'AI OCR Scan Error Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInfoModalTab(tab.id as any)}
                  className={`px-4 py-2 font-extrabold text-[11px] uppercase tracking-wider transition cursor-pointer rounded-none ${
                    infoModalTab === tab.id
                      ? 'bg-white text-blue-700 border-t-2 border-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Scroll Content */}
            <div className="flex-1 p-4 overflow-y-auto text-xs text-slate-700 space-y-4 bg-slate-50/50">
              
              {infoModalTab === 'sph' && (
                <div className="space-y-4 font-sans">
                  {/* Status Summary Bar */}
                  <div className="bg-white p-3 border border-slate-200 rounded-none shadow-2xs flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>PHP Daemon Automation Engines Status ({dynamicDaemons.length} Scripts Detected)</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Real-time scan of <code className="text-blue-700 font-mono">daemon/</code> & <code className="text-blue-700 font-mono">public/api_*.php</code> directory — New scripts are automatically detected without code changes.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>PHP DAEMON ONLINE</span>
                    </span>
                  </div>

                  {/* Tabel Mesin Daemon PHP (Padat & Profesional) */}
                  <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider border-b border-slate-800 font-mono">
                          <th className="p-2.5 text-center w-12 border-r border-slate-800">NO</th>
                          <th className="p-2.5 text-center w-28 border-r border-slate-800">STATUS</th>
                          <th className="p-2.5 w-52 border-r border-slate-800">FILE SCRIPT / DAEMON</th>
                          <th className="p-2.5 border-r border-slate-800">DESKRIPSI MESIN</th>
                          <th className="p-2.5">INFO DIAGNOSTIK & KONEKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dynamicDaemons && dynamicDaemons.length > 0 ? (
                          dynamicDaemons.map((item: any, idx: number) => {
                            const isErr = item.is_error || false;
                            const isAi = item.file_name.includes('ai') || item.file_name.includes('ocr');
                            const isSync = item.file_name.includes('sync') || item.file_name.includes('import');

                            const lightColor = isErr 
                              ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' 
                              : isAi 
                              ? 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]' 
                              : isSync 
                              ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' 
                              : 'bg-emerald-500 shadow-[0_0_8px_#10b981]';

                            const badgeStyle = isErr
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : isAi
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-300'
                              : isSync
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300';

                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition border-b border-slate-200">
                                <td className="p-2 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                                  {idx + 1}
                                </td>
                                <td className="p-2 text-center border-r border-slate-200">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`w-2.5 h-2.5 rounded-full ${lightColor} shrink-0 animate-pulse`} />
                                    <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-mono font-extrabold border ${badgeStyle}`}>
                                      {item.status_label || 'ACTIVE'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200">
                                  {item.file_name}
                                </td>
                                <td className="p-2 text-slate-600 border-r border-slate-200 font-sans">
                                  {item.description}
                                </td>
                                <td className="p-2 text-slate-700 font-sans">
                                  {isErr ? (
                                    <span className="text-rose-600 font-bold flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                      <span>{item.info_diag || 'Engine execution anomaly detected.'}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                      <span>{item.info_diag || 'Normal - Ready to process quotation data.'}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                              <span>Scanning PHP daemon script table...</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Realtime Terminal Log Console */}
                  <div className="border border-slate-800 bg-slate-950 rounded-none overflow-hidden shadow-lg mt-3 text-slate-100">
                    <div className="bg-slate-900 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Konsol Aktivitas Eksekusi & Log Error Mesin Daemon PHP</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>PENJADWALAN CRON AKTIF</span>
                      </span>
                    </div>

                    <div className="p-3 font-mono text-[10px] space-y-1.5 max-h-44 overflow-y-auto bg-[#070b14] text-slate-200 divide-y divide-slate-800/60">
                      {/* Live Execution Trace */}
                      <div className="pt-1 flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">[CRON-PHP]</span>
                        <span>Penjadwalan Cron panel host mengeksekusi <code className="text-cyan-300 font-bold">daemon/run_all.php</code> secara periodik.</span>
                      </div>
                      <div className="pt-1 flex items-start gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">[IMAP-GMAIL]</span>
                        <span><code className="text-emerald-300 font-bold">daemon/sync_gmail.php</code>: Active Gmail IMAP SSL connection (99 RFQs saved).</span>
                      </div>
                      <div className="pt-1 flex items-start gap-2">
                        <span className="text-cyan-400 font-bold shrink-0">[GEMINI-AI]</span>
                        <span><code className="text-cyan-300 font-bold">daemon/scan_inbox.php</code>: Engine AI Gemini 3 API Key terkonfigurasi.</span>
                      </div>

                      {/* Display Real Database API Error Logs if any exist */}
                      {aiErrors && aiErrors.length > 0 ? (
                        aiErrors.map((errLog: any, idx: number) => (
                          <div key={idx} className="pt-1.5 text-amber-300 flex items-start gap-2">
                            <span className="text-rose-400 font-bold shrink-0">[LOG-ERROR]</span>
                            <div className="overflow-hidden">
                              <span className="font-bold text-amber-200">{errLog.rfq_number || 'SYSTEM'}: </span>
                              <span className="text-rose-300 break-words">{errLog.ai_error || errLog.error || 'Rate limit check / background scan queue'}</span>
                              {errLog.created_at && <span className="text-slate-500 text-[9px] block font-sans">Time: {errLog.created_at}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="pt-1.5 flex items-start gap-2 text-emerald-400">
                          <span className="font-bold shrink-0">[STATUS-OK]</span>
                          <span>No critical errors detected. All PHP daemon automation scripts are operating normally.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {infoModalTab === 'categories' && (
                <div className="space-y-3">
                  <div className="border-b border-[#333] pb-2 mb-2 font-sans">
                    <h4 className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                      IMPA International Marine Category Blueprints
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      International marine classifications mapped directly from Google Sheets blueprints (0% Emojis rule enforced).
                    </p>
                  </div>

                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-[#121212] border-b border-[#333] text-slate-400 uppercase tracking-wider">
                        <th className="p-2 w-16">Code</th>
                        <th className="p-2 w-48">IMPA Category Name</th>
                        <th className="p-2">Logistics Classification Rules / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2a2a]">
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">00</td>
                        <td className="p-2 font-bold text-white">General & Administration</td>
                        <td className="p-2 text-slate-400 font-sans">General marine consumables, services, and administrative materials.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">11</td>
                        <td className="p-2 font-bold text-white">Clothing & Textiles</td>
                        <td className="p-2 text-slate-400 font-sans">Personal protective equipment, crew uniforms, safety wear.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">39</td>
                        <td className="p-2 font-bold text-white">Medicine & Medical</td>
                        <td className="p-2 text-slate-400 font-sans">Vessel medical chest inventory, pharmaceuticals, first aid kits.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">45</td>
                        <td className="p-2 font-bold text-white">Petroleum Products</td>
                        <td className="p-2 text-slate-400 font-sans">Oils, marine grease, high-temperature lubricants, hydraulic fluid.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">49</td>
                        <td className="p-2 font-bold text-white">Hardware & Perkakasan</td>
                        <td className="p-2 text-slate-400 font-sans">Fasteners, bolts, hand tools, standard rigging mechanical fixtures.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">51</td>
                        <td className="p-2 font-bold text-white">Cabin Store</td>
                        <td className="p-2 text-slate-400 font-sans">Vessel cleaning detergents, domestic equipment, crew quarters.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono font-bold text-[#00b4ff]">53</td>
                        <td className="p-2 font-bold text-white">Galley Store</td>
                        <td className="p-2 text-slate-400 font-sans">Kitchen utensils, food preparation tools, galley provisions.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {infoModalTab === 'errors' && (
                <div className="space-y-3">
                  <div className="border-b border-[#333] pb-2 mb-2 font-sans">
                    <h4 className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                      Gemini AI Classification Error Trace Logs
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Latest error logs recorded during automated live scan and vision OCR ingestion loops.
                    </p>
                  </div>

                  {isLoadingErrors ? (
                    <div className="py-12 flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#00b4ff]" />
                      <span className="text-[10px] font-bold text-slate-400">LOADING DIAGNOSTIC TRACE...</span>
                    </div>
                  ) : aiErrors.length === 0 ? (
                    <div className="p-8 text-center bg-[#242424] border border-[#333]">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">No AI Classification Errors Found</span>
                      <p className="text-[10px] text-slate-400 mt-1 font-sans">
                        All incoming Gmail client requests classified, parsed, and registered successfully.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                      {aiErrors.map((err, idx) => (
                        <div key={err.id || idx} className="bg-[#141414] border border-[#333] p-3 text-[10px]">
                          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-1.5 mb-1.5 font-bold">
                            <span className="text-[#ff5555] font-mono">{err.rfq_number || 'UNKNOWN RFQ'}</span>
                            <span className="text-slate-500">{err.created_at}</span>
                          </div>
                          <div className="space-y-1 font-sans">
                            <p className="text-white font-bold"><strong className="text-slate-400">Subject:</strong> {err.subject}</p>
                            <p className="text-slate-300"><strong className="text-slate-400">Client:</strong> {err.client_email}</p>
                          </div>
                          <div className="mt-2 bg-[#0a0a0a] border border-[#242424] p-2 overflow-x-auto">
                            <pre className="font-mono text-[9px] text-[#ff8888] leading-tight select-all">
                              {err.ai_error || 'No error log saved.'}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-[#0d0d0d] border-t border-[#333] shrink-0 flex justify-end">
              <button
                onClick={() => setIsSystemInfoModalOpen(false)}
                className="bg-gradient-to-b from-[#fcfcfc] to-[#d2d2d2] text-[#3d3d3d] font-extrabold text-[10px] uppercase tracking-wider px-4 py-2 border border-[#7b7b7b] hover:bg-[#c8c8c8] shadow-inner transition cursor-pointer"
              >
                Close diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MYSQL DATABASE RECORD INSPECTOR MODAL — White Theme, Eurostile Font & Sharp Corners */}
      {isFullDbModalOpen && selectedFullDbQuotation && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-in fade-in">
          <div 
            className="bg-white border border-slate-300 rounded-none w-full max-w-5xl shadow-2xl flex flex-col h-[650px] overflow-hidden font-sans text-slate-800"
            style={{ fontFamily: "'Eurostile', 'Inter', -apple-system, sans-serif" }}
          >
            {/* Modal Header */}
            <div className="px-5 py-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 font-mono">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="font-extrabold text-xs uppercase tracking-wider text-cyan-400">
                  FULL DATA DATABASE RECORD — {selectedFullDbQuotation.quotation_number || selectedFullDbQuotation.id}
                </span>
              </div>
              <button
                onClick={() => setIsFullDbModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                <CloseIcon className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body: Raw MySQL Tables Inspection */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-[11px] bg-slate-50/50">
              
              {/* Table 1: quotations MySQL Record */}
              <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-2xs">
                <div className="bg-slate-900 text-white px-3.5 py-2 font-bold uppercase text-[10px] tracking-wide flex justify-between items-center border-b border-slate-800">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Database className="w-3.5 h-3.5" />
                    <span>Tabel MySQL: quotations</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Record ID: {selectedFullDbQuotation.id}</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-white">
                  {Object.entries(selectedFullDbQuotation).map(([key, val]) => {
                    if (typeof val === 'object' && val !== null) return null;
                    return (
                      <div key={key} className="bg-slate-50 border border-slate-200 p-2 rounded-none flex justify-between items-center">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">{key}:</span>
                        <span className="font-bold text-slate-900 font-mono truncate max-w-[180px]" title={String(val)}>
                          {val !== null && val !== undefined && String(val) !== '' ? String(val) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table 2: rfq_requests MySQL Record */}
              {selectedFullDbQuotation.email_source ? (
                <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-2xs">
                  <div className="bg-slate-800 text-white px-3.5 py-2 font-bold uppercase text-[10px] tracking-wide flex justify-between items-center border-b border-slate-700">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <FileType className="w-3.5 h-3.5" />
                      <span>Tabel MySQL: rfq_requests (Sumber Email Client)</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">RFQ ID: {selectedFullDbQuotation.email_source.id}</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-white">
                    {Object.entries(selectedFullDbQuotation.email_source).map(([key, val]) => (
                      <div key={key} className="bg-slate-50 border border-slate-200 p-2 rounded-none flex justify-between items-center">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">{key}:</span>
                        <span className="font-bold text-slate-900 font-mono truncate max-w-[180px]" title={String(val)}>
                          {val !== null && val !== undefined && String(val) !== '' ? String(val) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 border border-slate-200 p-3 rounded-none text-slate-600 text-[11px] font-bold">
                  Data sumber email rfq_requests terhubung secara internal via ID: {selectedFullDbQuotation.rfq_id || selectedFullDbQuotation.id}
                </div>
              )}

              {/* Table 3: quotation_items Line Items */}
              <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-2xs">
                <div className="bg-slate-900 text-white px-3.5 py-2 font-bold uppercase text-[10px] tracking-wide flex justify-between items-center border-b border-slate-800">
                  <span className="text-cyan-400">Quotation Line Items ({selectedFullDbQuotation.items?.length || 0} Items)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-800 border-b border-slate-700 text-slate-200 font-bold uppercase">
                      <tr>
                        <th className="p-2 border-r border-slate-700 text-center w-10">#</th>
                        <th className="p-2 border-r border-slate-700 w-32">Item Code</th>
                        <th className="p-2 border-r border-slate-700">Item Description / Services</th>
                        <th className="p-2 border-r border-slate-700 text-center w-16">Qty</th>
                        <th className="p-2 border-r border-slate-700 text-center w-16">Unit</th>
                        <th className="p-2 border-r border-slate-700 text-right w-28">Unit Price</th>
                        <th className="p-2 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedFullDbQuotation.items && selectedFullDbQuotation.items.length > 0 ? (
                        selectedFullDbQuotation.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 border-b border-slate-200">
                            <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-slate-800 border-r border-slate-200">
                              {it.impa_code ? (
                                <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                                  IMPA {it.impa_code}
                                </span>
                              ) : (
                                it.product_code || it.item_code || '—'
                              )}
                            </td>
                            <td className="p-2 font-sans font-bold text-slate-900 border-r border-slate-200">{it.description}</td>
                            <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                            <td className="p-2 text-center text-slate-600 border-r border-slate-200">{it.unit}</td>
                            <td className="p-2 text-right text-slate-700 border-r border-slate-200 font-mono">{formatCurrency(it.unit_price)}</td>
                            <td className="p-2 text-right font-bold text-blue-700 font-mono">{formatCurrency(it.total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 font-sans italic">No item details saved for this quotation yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw JSON Scan Result */}
              {selectedFullDbQuotation.ocr_scan_result && (
                <div className="bg-slate-950 text-emerald-400 p-3.5 rounded-none border border-slate-800 space-y-1">
                  <span className="text-slate-400 uppercase font-bold text-[9px] block">Raw JSON Data (ocr_scan_result):</span>
                  <pre className="text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap select-all font-mono text-emerald-300">{selectedFullDbQuotation.ocr_scan_result}</pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-300 flex justify-end shrink-0">
              <button
                onClick={() => setIsFullDbModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-none transition cursor-pointer text-xs uppercase tracking-wider"
              >
                Close Full Data Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PDF VIEWER POPUP MODAL */}
      {isPdfViewerModalOpen && selectedPdfViewerQuotation && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setIsPdfViewerModalOpen(false);
            setSelectedPdfViewerQuotation(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-700 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileType className="w-4 h-4 text-blue-400" />
                <h3 className="font-extrabold text-xs">
                  Quotation Preview — {selectedPdfViewerQuotation.quotation_number || selectedPdfViewerQuotation.id}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="bg-slate-800 p-0.5 rounded border border-slate-700 flex items-center gap-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPdfViewerMode('doc')}
                    className={`px-2 py-0.5 rounded transition ${pdfViewerMode === 'doc' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    Doc View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfViewerMode('pdf')}
                    className={`px-2 py-0.5 rounded transition ${pdfViewerMode === 'pdf' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                  >
                    PDF Stream
                  </button>
                </div>

                <a
                  href={pdfViewerMode === 'doc' ? pdfDocUrl : pdfStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] rounded transition flex items-center gap-1"
                  title="Open preview in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  <span>Open in Tab ↗</span>
                </a>

                <a
                  href={pdfDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded transition flex items-center gap-1"
                >
                  Download PDF
                </a>
                <button
                  onClick={() => {
                    setIsPdfViewerModalOpen(false);
                    setSelectedPdfViewerQuotation(null);
                  }}
                  className="p-1 text-slate-300 hover:text-white hover:bg-rose-600 rounded transition cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 relative w-full h-full">
              <iframe
                src={pdfViewerMode === 'doc' ? pdfDocUrl : pdfStreamUrl}
                className="w-full h-full border-0"
                title={`Preview ${selectedPdfViewerQuotation.id}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ALERT DETAILS POPUP MODAL */}
      {isAlertModalOpen && selectedAlertQuotation && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans"
          onClick={() => {
            setIsAlertModalOpen(false);
            setSelectedAlertQuotation(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-xs">
                    Quotation Alerts & Warnings — {selectedAlertQuotation.quotation_number || selectedAlertQuotation.id}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {getQuotationCompany(selectedAlertQuotation)} ({selectedAlertQuotation.client_name || 'Client'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAlertModalOpen(false);
                  setSelectedAlertQuotation(null);
                }}
                className="p-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded transition cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3 bg-slate-50">
              {(() => {
                const alerts = getQuotationAlerts(selectedAlertQuotation);
                if (alerts.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-bold">No warnings or alerts for this quotation.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">All items, pricing, and PDF documents are complete.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Found {alerts.length} item(s) requiring attention:
                    </p>
                    {alerts.map((al) => {
                      const isErr = al.severity === 'error';
                      return (
                        <div
                          key={al.id}
                          className={`p-3 rounded-lg border flex items-start gap-3 shadow-xs ${
                            isErr
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${
                            isErr ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {al.type === 'missing_price' && <DollarSign className="w-4 h-4" />}
                            {al.type === 'missing_file' && <FileText className="w-4 h-4" />}
                            {al.type === 'unregistered' && <AlertTriangle className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-xs">{al.title}</h4>
                            <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">{al.description}</p>
                            
                            {/* Action helper */}
                            {al.type === 'missing_price' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAlertModalOpen(false);
                                  onEditQuotation(selectedAlertQuotation);
                                }}
                                className="mt-2 text-[10px] font-extrabold text-rose-700 hover:text-rose-900 underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Open Quotation Builder to Set Prices</span>
                              </button>
                            )}

                            {al.type === 'missing_file' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAlertModalOpen(false);
                                  handleCreatePdfBackground(selectedAlertQuotation);
                                }}
                                className="mt-2 text-[10px] font-extrabold text-amber-800 hover:text-amber-950 underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileType className="w-3 h-3" />
                                <span>Generate Quotation PDF Now</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = selectedAlertQuotation;
                  setIsAlertModalOpen(false);
                  setSelectedInfoQuotation(target);
                  setActiveRowId(target.id);
                  setIsInfoModalOpen(true);
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Full Info</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAlertModalOpen(false);
                  setSelectedAlertQuotation(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND QUOTATION CONFIRMATION POPUP MODAL */}
      {sendConfirmQuotation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-300 rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden font-sans">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-3.5 flex items-center justify-between text-white border-b border-indigo-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-400/30">
                  <Send className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">Confirm Send Quotation</h3>
                  <p className="text-[11px] text-slate-300">Quotation #{sendConfirmQuotation.quotation_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSendConfirmQuotation(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Details */}
            <div className="p-5 space-y-4 text-xs bg-slate-50/50">

              {/* Safety Banner */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 flex items-center gap-2 font-semibold text-[11px]">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Security Mode Active: Direct email transmission restricted. Status updated in system records.</span>
              </div>
              
              {/* Recipient Details (Sent To) */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Associated Client</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Company / Client:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {sendConfirmQuotation.company_name || sendConfirmQuotation.client_name || '-'}
                    </span>
                    {sendConfirmQuotation.client_name && sendConfirmQuotation.company_name && (
                      <span className="text-[11px] text-slate-500 block font-medium">Attn: {sendConfirmQuotation.client_name}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Recipient Email:</span>
                    <span className="font-mono font-bold text-blue-700 text-xs break-all">
                      {sendConfirmQuotation.client_email || <span className="text-amber-600 italic">No email provided</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quotation / SPH Details */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>As Quotation</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Quotation No.:</span>
                    <span className="font-mono font-black text-indigo-900 text-xs">{sendConfirmQuotation.quotation_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Grand Total:</span>
                    <span className="font-extrabold text-emerald-700 text-xs">
                      RM {(sendConfirmQuotation.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Items:</span>
                    <span className="font-bold text-slate-700 text-xs">
                      {sendConfirmQuotation.items?.length || sendConfirmQuotation.total_items_count || 0} Items
                    </span>
                  </div>
                </div>
              </div>

              {/* Attached File Details */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Attached Document</span>
                  </div>
                  {sendConfirmQuotation.pdf_created === 1 ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> PDF Ready
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Auto Quotation
                    </span>
                  )}
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center gap-2">
                  <div className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-md">
                    <FileType className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-xs text-slate-800 truncate">
                      {sendConfirmQuotation.quotation_file || sendConfirmQuotation.source_file || `QUO-${sendConfirmQuotation.quotation_number}.pdf`}
                    </p>
                    <p className="text-[10px] text-slate-400">Official Quotation PDF document attachment</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSendConfirmQuotation(null)}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer border border-slate-300"
              >
                Cancel
              </button>

              {/* Open in Email Client */}
              <button
                type="button"
                onClick={() => {
                  const target = sendConfirmQuotation;
                  setSendConfirmQuotation(null);
                  if (onOpenEmailClient) {
                    onOpenEmailClient(target);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
              >
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Open in Email Client</span>
              </button>

              {/* Mark Done / Sent */}
              <button
                type="button"
                disabled={isSendingQuotation}
                onClick={() => {
                  const target = sendConfirmQuotation;
                  setSendConfirmQuotation(null);
                  handleSendQuotation(target);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs rounded-lg shadow-md flex items-center justify-center gap-2 transition cursor-pointer border border-indigo-700 disabled:opacity-60"
              >
                {isSendingQuotation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>{isSendingQuotation ? 'Updating...' : 'Mark Done / Sent'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default QuotationList;
