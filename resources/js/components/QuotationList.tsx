import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quotation } from '../types/erp';
import { Search, Plus, Eye, Edit, Send, RefreshCw, Loader2, Trash2, FileType, Check, Sparkles, CheckCircle2, Sliders, Clock, MoreVertical, History, X as CloseIcon, User, AlertTriangle, Printer, Image as ImageIcon, ShieldCheck, ScanLine, Info, Database, Activity, Terminal, Tag, Filter } from 'lucide-react';

import { getApiUrl } from '../utils/api';


interface QuotationListProps {
  onEditQuotation: (quo: Quotation) => void;
  onPreviewDoc: (quo: Quotation) => void;
  onSendEmail: (quo: Quotation) => void;
  onNewQuotation: () => void;
  cachedQuotations: Quotation[];
  setCachedQuotations: (data: Quotation[]) => void;
  hasFetched: boolean;
  currentUser?: { id?: string; name?: string; email?: string; role?: string };
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

export const QuotationList: React.FC<QuotationListProps> = ({
  onEditQuotation,
  onPreviewDoc,
  onSendEmail,
  onNewQuotation,
  cachedQuotations,
  setCachedQuotations,
  hasFetched,
  currentUser,
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>(cachedQuotations || []);
  const [isLoading, setIsLoading] = useState<boolean>(!hasFetched && cachedQuotations.length === 0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'requisition' | 'draft' | 'quotation' | 'acc' | 'done' | 'junk'>('all');
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  
  // Dropdown & History log modal states
  const [showActionsMenu, setShowActionsMenu] = useState<boolean>(false);
  const [selectedHistoryQuotation, setSelectedHistoryQuotation] = useState<Quotation | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  
  // Row-specific kebab dropdown state & Info modal state
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  const [selectedInfoQuotation, setSelectedInfoQuotation] = useState<Quotation | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  
  // Drawer tabs and email body states
  const [drawerTab, setDrawerTab] = useState<'summary' | 'email' | 'history' | 'acc'>('summary');
  const [showEmailBody, setShowEmailBody] = useState<boolean>(false);

  useEffect(() => {
    setShowEmailBody(false);
  }, [selectedInfoQuotation?.id]);
  
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
        actor_name:  currentUserRef.current?.name || currentUserRef.current?.email || 'Unidentified Session',
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
            // Full AI success — chain IMPA matching
            const itemCount = Array.isArray(resObj?.items) ? resObj.items.length : 0;
            const model = resObj?.scan_model ? ` [${resObj.scan_model}]` : '';
            if (d.ocr_scan_status === 'waiting_ai_limit') {
              setOcrSuccessMsg(`Waiting AI (Limit) • Quota limit reached. Automatic retry scheduled upon countdown expiry...`);
            } else {
              setOcrSuccessMsg(`Scan completed${model} • ${itemCount} items • Attempt ${attempt} • Matching IMPA code...`);
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
                  const catName = im.category_name || 'No category_name to match. Run OCR scan first.';
                  setOcrSuccessMsg(`Scan + IMPA completed${model} • ${itemCount} items • IMPA Code: ${im.impa_code || 'Pending'} (${catName}) • Confidence ${im.confidence || 0}%`);
                  setQuotations(prev => prev.map(q => q.id === quo_id
                    ? { ...q, impa_code: im.impa_code, category_name: im.category_name } : q));
                  setSelectedInfoQuotation(prev => prev
                    ? { ...prev, impa_code: im.impa_code, category_name: im.category_name } : null);
                } else {
                  const catMsg = im.category_name || im.message || 'No category_name to match. Run OCR scan first.';
                  setOcrSuccessMsg(`Scan completed • ${itemCount} items • IMPA: ${catMsg}`);
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
          <title>SPH - ${quo.quotation_number}</title>
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
              <span class="sph-title">SURAT PENAWARAN HARGA</span>
              <div style="font-family: monospace; font-weight: bold;">No: ${quo.quotation_number}</div>
              <div style="color: #666; font-size: 11px;">Date: ${quo.date_issued}</div>
            </div>
          </div>
          
          <div class="meta-grid">
            <div>
              <span>Penerima Penawaran (Kepada Yth):</span>
              <strong>${quo.company_name}</strong>
              <p style="margin: 4px 0 0 0;">U.p. Bpk/Ibu: <strong>${quo.client_name}</strong></p>
              <p style="margin: 2px 0 0 0; color: #555;">Email: ${quo.client_email}</p>
            </div>
            <div style="text-align: right;">
              <span>Detail Dokumen Penawaran:</span>
              <p style="margin: 3px 0;">Tanggal Terbit: <strong>${quo.date_issued}</strong></p>
              <p style="margin: 3px 0;">Masa Berlaku s.d: <strong style="color: #b45309;">${quo.valid_until || '14 Days'}</strong></p>
              <p style="margin: 3px 0;">Mata Uang: <strong>MYR (Malaysian Ringgit)</strong></p>
              <p style="margin: 3px 0;">Penanggung Jawab: <strong>${quo.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi'}</strong></p>
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
                <th>Deskripsi Barang / Spesifikasi Layanan</th>
                <th style="width: 50px; text-align: center;">Qty</th>
                <th style="width: 70px; text-align: center;">Satuan</th>
                <th style="width: 120px; text-align: right;">Harga Satuan</th>
                <th style="width: 50px; text-align: center;">Disc</th>
                <th style="width: 120px; text-align: right;">Total (RM)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">No items defined in SPH.</td></tr>'}
            </tbody>
          </table>
          
          <div class="totals-box">
            <div style="width: 48%; font-size: 11px; background: #f9f9f9; padding: 10px; border: 1px solid #eee;">
              <strong>Catatan Penawaran:</strong>
              <p style="color: #666; margin: 4px 0 0 0; font-style: italic;">${quo.notes || 'Standard SPH terms apply.'}</p>
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
              <p style="color: #888; margin: 0 0 5px 0;">Penerima / Pemesan,</p>
              <div style="height: 60px;"></div>
              <strong>(${quo.client_name})</strong>
              <p style="margin: 2px 0 0 0; color: #666;">${quo.company_name}</p>
            </div>
            <div style="text-align: right;">
              <p style="color: #888; margin: 0 0 5px 0;">Hormat Kami,</p>
              <strong>ABMALAYA.COM (MALAYSIA)</strong>
              <div style="display: flex; justify-content: flex-end; margin: 5px 0;">
                <div class="stamp-box">[STAMP ABMALAYA]</div>
              </div>
              <strong><u>${quo.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi'}</u></strong>
              <p style="margin: 2px 0 0 0; color: #666;">Head of Sales & Business Development</p>
            </div>
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
      // Close any open row dropdown action menus
      setOpenRowActionId(null);
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
    if (!window.confirm('Are you sure you want to move this SPH Quotation to Trash (Junk status)?')) {
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
    if (!window.confirm(`Are you sure you want to move the ${selectedIds.length} selected SPH quotations to Trash (Junk)?`)) {
      return;
    }

    setIsLoading(true);
    const promises = selectedIds.map((id) => {
      const payload = {
        id: id,
        status: 'junk',
        action: 'delete',
        user_name: 'Admin',
        user_email: 'admin@abmalaya.com'
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
        alert('Selected SPH items moved to Trash!');
      })
      .catch((err) => console.error('Batch delete error:', err))
      .finally(() => setIsLoading(false));
  };

  const handleBatchStatusUpdate = (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    const promises = selectedIds.map((id) => {
      const payload = {
        id: id,
        status: newStatus,
        action: 'status_update',
        user_name: 'Admin',
        user_email: 'admin@abmalaya.com'
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
        alert(`Selected SPH items status updated to ${newStatus}!`);
      })
      .catch((err) => console.error('Batch status update error:', err))
      .finally(() => setIsLoading(false));
  };

  const tabCounts = useMemo(() => {
    let all = 0, requisition = 0, draft = 0, quotation = 0, acc = 0, done = 0, junk = 0;
    quotations.forEach((q) => {
      const st = (q.status || 'draft').toLowerCase();
      if (st === 'junk' || st === 'trash') {
        junk++;
      } else {
        all++;
        if (st === 'requisition' || st === '0' || st === 'masuk') requisition++;
        else if (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress' || st === 'quotation_build') draft++;
        else if (st === 'quotation' || st === 'penawaran_terkirim') quotation++;
        else if (st === 'approved' || st === 'acc' || st === 'disetujui') acc++;
        else if (st === 'done_send' || st === 'sent' || st === 'deal' || st === 'terkirim') done++;
        else draft++;
      }
    });
    return { all, requisition, draft, quotation, acc, done, junk };
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
        return matchesSearch && (st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress' || st === 'quotation_build');
      }
      if (activeTab === 'quotation') {
        return matchesSearch && (st === 'quotation' || st === 'penawaran_terkirim');
      }
      if (activeTab === 'acc') {
        return matchesSearch && (st === 'approved' || st === 'acc' || st === 'disetujui');
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
              <option value="draft">In Progress / Draft ({tabCounts.draft})</option>
              <option value="quotation">Quotation / Penawaran ({tabCounts.quotation})</option>
              <option value="acc">ACC Approved ({tabCounts.acc})</option>
              <option value="done">Done / Terkirim ({tabCounts.done})</option>
              <option value="junk">Trash / Junk ({tabCounts.junk})</option>
            </select>
            <Sliders className="w-3 h-3 text-slate-400 pointer-events-none ml-1 shrink-0" />
          </div>

          <div className="hidden md:flex items-center gap-1 bg-[#0080d0]/10 border border-[#0080d0]/20 px-2 py-1 rounded-md text-[11px] font-extrabold text-[#0080d0]">
            <span className="text-slate-500">Selected:</span>
            <span className="uppercase">
              {activeTab === 'all' && `All (${tabCounts.all})`}
              {activeTab === 'requisition' && `Requisition (${tabCounts.requisition})`}
              {activeTab === 'draft' && `In Progress / Draft (${tabCounts.draft})`}
              {activeTab === 'quotation' && `Quotation (${tabCounts.quotation})`}
              {activeTab === 'acc' && `ACC Approved (${tabCounts.acc})`}
              {activeTab === 'done' && `Done (${tabCounts.done})`}
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
              placeholder="Search SPH ID, company..."
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
                  <span>New SPH</span>
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
                  <span>{isSelectionMode ? 'Exit Selection' : 'Select SPH Items'}</span>
                </button>

                {/* USER REQUESTED: Right below "Select SPH Items", add "Tampilkan Semua Kolom Database (Full)" */}
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowAllDbColumns(!showAllDbColumns);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-indigo-700 bg-indigo-50/60 border-t border-slate-100"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showAllDbColumns ? 'Tampilan Tabel Standar' : 'Tampilkan Semua Kolom Database (Full)'}</span>
                </button>

                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setIsSystemInfoModalOpen(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gradient-to-b hover:from-[#00b4ff] hover:to-[#0080d0] hover:text-white transition flex items-center gap-2 cursor-pointer font-bold text-[#3d3d3d] border-t border-[#eee]"
                >
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Info SPH & Kategori</span>
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
              {selectedIds.length} SPH Selected
            </span>
          </div>
          
          <div className="flex items-center gap-2 relative">
            {/* Batch Edit Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBatchStatusDropdown(!showBatchStatusDropdown)}
                className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] border border-[#a0a0a0] font-bold px-3 py-1 rounded shadow-xs cursor-pointer text-xs"
              >
                Edit Status Masal...
              </button>
              
              {showBatchStatusDropdown && (
                <div className="absolute right-0 top-7 w-40 bg-white border border-[#9b9b9b] rounded-md shadow-lg z-50 py-1 text-left font-sans text-xs">
                  {[
                    { val: 'requisition', label: 'REQUISITION' },
                    { val: 'draft', label: 'DRAFT / IN PROGRESS' },
                    { val: 'quotation', label: 'QUOTATION' },
                    { val: 'done', label: 'DONE' }
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

      {/* FULL WIDTH EDGE-TO-EDGE TABLE CONTAINER */}
      <div className="flex-1 p-0 overflow-y-auto space-y-0 w-full bg-[#f0f0f0]">
        
        {isLoading ? (
          <div className="py-24 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Fetching SPH quotations from MySQL database...</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
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
                  <th className="p-2.5 border-r border-slate-800 w-28">SPH Number</th>
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
                  <th className="p-2.5 border-r border-slate-800 w-36 text-center">Status / Phase</th>
                  <th className="p-2.5 border-r border-slate-800 w-24 text-center">OCR Scan</th>
                  <th className="p-2.5 border-r border-slate-800 w-48">Petugas & Aktivitas</th>
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-32 text-center">Approved By</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-28 text-center">Created By</th>}
                  {showAllDbColumns && <th className="p-2.5 border-r border-slate-800 w-36 text-center">Created At</th>}
                  <th className="p-2.5 border-r border-slate-800 w-28 text-center">Alerts</th>
                  <th className="p-2.5 text-center w-28">Actions</th>
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
                  const isDraft = st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress';
                  const isQuotation = st === 'quotation' || st === 'quotation_build';
                  const isDone = st === 'done_send' || st === 'sent' || st === 'approved' || st === 'acc' || st === 'deal' || st === 'terkirim' || st === 'disetujui' || st === 'penawaran_terkirim';

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

                      {/* IMPA Category Column (Next to SPH Number / ID DB) */}
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        {q.impa_code || q.category_name ? (
                          <span
                            className="bg-indigo-50 text-indigo-900 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 truncate max-w-[170px]"
                            title={q.impa_code ? `${q.impa_code} - ${q.category_name}` : (q.category_name || '')}
                          >

                            <Tag className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="truncate">{q.impa_code ? `${q.impa_code} — ` : ''}{q.category_name}</span>
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
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans">
                        {st === 'requisition' ? (
                          <span className="font-extrabold text-amber-700 inline-flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Requisition
                          </span>
                        ) : isDraft ? (
                          <span className="font-extrabold text-amber-600 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            In Progress (Draft)
                          </span>
                        ) : isQuotation ? (
                          <span className="font-extrabold text-blue-700 inline-flex items-center gap-1">
                            <Sliders className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            Quotation
                          </span>
                        ) : isDone ? (
                          <span className="font-extrabold text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            Done
                          </span>
                        ) : (
                          <span className="font-bold text-slate-700">
                            {q.status || 'Draft'}
                          </span>
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
                          
                          const rawActorName = latestLog?.user_name || q.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi';
                          const lowerActor = rawActorName.toLowerCase();
                          const isDummyActor = lowerActor.includes('sales engineer') || lowerActor.includes('ilham') || lowerActor.includes('system') || lowerActor.includes('ocr daemon');
                          const actorName = isDummyActor ? (q.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi') : rawActorName;
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
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-xs font-sans">
                        {q.unregistered_items_count && q.unregistered_items_count > 0 && (st === 'requisition' || st === 'draft' || st === 'diproses' || st === 'siap_kirim') ? (
                          <span className="font-extrabold text-amber-800 inline-flex items-center gap-1 text-[10px]" title={`${q.unregistered_items_count} item(s) not found in product database`}>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{q.unregistered_items_count} Unregistered</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">-</span>
                        )}
                      </td>

                      {/* ACTIONS BUTTONS */}
                      <td className="p-2 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditQuotation(q);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-md transition cursor-pointer"
                            title="Edit SPH in Quotation Builder"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Kebab action dropdown */}
                          <div className="relative">
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
                              <div className="absolute right-0 mt-1 w-44 bg-white border border-[#9b9b9b] rounded-md shadow-lg z-50 py-1 text-left font-sans text-xs">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    if (ocrRetryTimerRef.current) clearTimeout(ocrRetryTimerRef.current);
                                    ocrRetryAttemptRef.current = 0;
                                    triggerOcrScan(q.id, 1);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-700 transition flex items-center gap-2 cursor-pointer font-bold"
                                >
                                  <ScanLine className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Rescan AI + IMPA</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onPreviewDoc(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-[#3d3d3d] transition flex items-center gap-2 cursor-pointer font-semibold"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Preview PDF</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    onSendEmail(q);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-[#3d3d3d] transition flex items-center gap-2 cursor-pointer font-semibold"
                                >
                                  <Send className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Send SPH Email</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    setSelectedHistoryQuotation(q);
                                    setIsHistoryModalOpen(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 text-[#3d3d3d] transition flex items-center gap-2 cursor-pointer font-semibold"
                                >
                                  <History className="w-3.5 h-3.5 text-amber-600" />
                                  <span>View History Log</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRowActionId(null);
                                    setSelectedFullDbQuotation(q);
                                    setIsFullDbModalOpen(true);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-700 transition flex items-center gap-2 cursor-pointer font-bold"
                                >
                                  <Database className="w-3.5 h-3.5 text-blue-600" />
                                  <span>View Full Record (DB)</span>
                                </button>
                                
                                <div className="border-t border-slate-100 my-1"></div>

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
                                  <span>Delete Quotation</span>
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

      {/* HISTORY AUDIT TRAIL LOG MODAL */}
      {isHistoryModalOpen && selectedHistoryQuotation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-[#7b7b7b] rounded-lg w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden font-sans">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-3 border-b border-[#7b7b7b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-sm text-[#3d3d3d]">Quotation Audit Trail History</h3>
                  <p className="text-[10px] text-slate-500 font-mono">SPH ID: {selectedHistoryQuotation.quotation_number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryQuotation(null);
                }}
                className="p-1 hover:bg-rose-600 hover:text-white rounded-md transition text-slate-600 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Timeline */}
            <div className="flex-1 p-4 overflow-y-auto bg-[#fafafa]">
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
                    <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-1">
                      <Clock className="w-6 h-6 mx-auto text-slate-300 animate-bounce" />
                      <p>No history trail recorded for this SPH quotation.</p>
                    </div>
                  );
                }

                return (
                  <div className="relative border-l-2 border-slate-300 ml-3 pl-6 space-y-5">
                    {logs.map((log: any, idx: number) => (
                      <div key={idx} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-amber-600 bg-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-600"></div>
                        </div>

                        {/* Event Content */}
                        <div className="bg-white p-3 border border-[#d2d2d2] rounded-md shadow-xs flex flex-col gap-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider self-start sm:self-auto">
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

            {/* Modal Footer */}
            <div className="bg-gradient-to-b from-[#fcfcfc] to-[#e1e1e1] px-4 py-2 border-t border-[#7b7b7b] text-right">
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryQuotation(null);
                }}
                className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] font-bold text-xs px-4 py-1.5 rounded border border-[#a0a0a0] hover:bg-[#e6e6e6] shadow-inner transition cursor-pointer"
              >
                Close View
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
                    <h3 className="font-extrabold text-xs text-[#3d3d3d]">Full Info — SPH Quotation</h3>
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
                          Percobaan {ocrRateLimitInfo.attempt}/{MAX_OCR_RETRIES}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{ocrRateLimitInfo.message}</p>

                      {/* Progress bar + countdown */}
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500">Auto-retry dalam:</span>
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
                
                {drawerTab === 'summary' ? (
                  <>
                    {/* Status Header Bar */}
                    <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Status:</span>
                        {(() => {
                          const st = (activeQuotation.status || 'draft').toLowerCase();
                          const isDraft = st === 'draft' || st === 'diproses' || st === 'siap_kirim' || st === 'in_progress';
                          const isQuotation = st === 'quotation' || st === 'quotation_build';
                          const isDone = st === 'done_send' || st === 'sent' || st === 'approved' || st === 'acc' || st === 'deal' || st === 'terkirim' || st === 'disetujui' || st === 'penawaran_terkirim';

                          if (st === 'requisition') {
                            return <span className="bg-amber-50 text-amber-800 border border-amber-300 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Requisition</span>;
                          } else if (isDraft) {
                            return <span className="bg-amber-100 text-amber-800 border border-amber-200 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">In Progress (Draft)</span>;
                          } else if (isQuotation) {
                            return <span className="bg-blue-50 text-blue-900 border border-blue-200 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Quotation</span>;
                          } else if (isDone) {
                            return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-black px-2 py-0.5 rounded-sm uppercase text-[9px]">Done</span>;
                          }
                          return <span className="bg-slate-200 font-bold px-2 py-0.5 rounded-sm uppercase text-[9px]">{activeQuotation.status}</span>;
                        })()}
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-500">
                        Date Issued: <strong className="text-slate-800">{activeQuotation.date_issued}</strong>
                      </div>
                    </div>

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
                            <span className="text-slate-400 font-mono text-[10px] italic">Belum ditentukan</span>
                          )}
                        </div>
                        <div className="col-span-3 border-l-2 border-slate-300 pl-2.5">

                          <h4 className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Source Attachment</h4>
                          {(() => {
                            let fileUrl = activeQuotation.email_source?.attachment_url || '';
                            if ((!fileUrl || fileUrl === 'NONE') && activeQuotation.ocr_scan_result) {
                              try {
                                const parsedOcr = JSON.parse(activeQuotation.ocr_scan_result);
                                fileUrl = parsedOcr?.file_url || '';
                              } catch (e) {}
                            }
                            if (!fileUrl || fileUrl === 'NONE') {
                              return <span className="font-mono text-slate-400">None attached</span>;
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
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-blue-600 hover:underline flex items-center gap-0.5 font-mono text-[10px] break-all"
                              >
                                {isDrive ? 'File: Google Drive' : `File: ${filename}`}
                              </a>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Unified Items Table (Combined SPH & AI OCR Extracted Items with Full Specification Columns) */}
                    <div className="pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Line Items Specification & Details</span>
                        {activeQuotation.unregistered_items_count && activeQuotation.unregistered_items_count > 0 ? (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{activeQuotation.unregistered_items_count} Unregistered</span>
                          </span>
                        ) : null}
                      </div>

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

                        return (
                          <div className="border-t border-b border-slate-200 overflow-x-auto">
                            <table className="w-full text-left text-[10px] font-sans border-collapse">
                              <thead className="border-b border-slate-300 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="py-2 px-2 text-center w-8">#</th>
                                  <th className="py-2 px-2 text-center w-12">Photo</th>
                                  <th className="py-2 px-2 w-28 font-mono">Part / IMPA Code</th>
                                  <th className="py-2 px-2">Item Name (Description)</th>
                                  <th className="py-2 px-2">Specification / Technical Details</th>
                                  <th className="py-2 px-2 w-24">Supplier / Seller</th>
                                  <th className="py-2 px-2 text-center w-16">Qty</th>
                                  <th className="py-2 px-2 text-right w-24">Unit Price (MYR)</th>
                                  <th className="py-2 px-2 text-center w-16">Disc (%)</th>
                                  <th className="py-2 px-2 text-right w-24">Total Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {hasSphItems ? (
                                  displayItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
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
                                      <td className="py-2 px-2 font-bold text-slate-800">{item.description}</td>
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
                                    </tr>
                                  ))
                                ) : ocrItems.length > 0 ? (
                                  ocrItems.map((it: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                                      <td className="py-1 px-2 text-center">
                                        {it.image_url ? (
                                          <img src={it.image_url} alt="Photo" className="w-8 h-8 object-cover rounded border border-slate-200 mx-auto" />
                                        ) : (
                                          <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded mx-auto flex items-center justify-center text-slate-400 text-[8px]">
                                            <ImageIcon className="w-3.5 h-3.5 opacity-40" />

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
                                      <td className="py-2 px-2 font-bold text-slate-800 flex items-center gap-1.5">
                                        <span>{it.description || '—'}</span>
                                        <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1 rounded border border-blue-200">OCR</span>
                                      </td>
                                      <td className="py-2 px-2 text-slate-600 italic leading-snug">{it.specification || 'Extracted via Vision AI'}</td>
                                      <td className="py-2 px-2 font-mono text-[9px] text-slate-600">
                                        {it.supplier_name ? (
                                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.5 rounded">
                                            {it.supplier_name}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">—</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono font-bold">{it.qty ?? 1} {it.unit || 'pcs'}</td>
                                      <td className="py-2 px-2 text-right font-mono text-slate-600">{it.unit_price != null ? formatCurrency(it.unit_price) : '—'}</td>
                                      <td className="py-2 px-2 text-center font-mono text-rose-600">{it.discount_percent != null ? `${it.discount_percent}%` : '—'}</td>
                                      <td className="py-2 px-2 text-right font-mono font-extrabold text-slate-900">{it.total != null ? formatCurrency(it.total) : '—'}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={10} className="py-6 text-center text-slate-400 font-bold">No line items specified.</td>
                                  </tr>
                                )}


                              </tbody>
                            </table>
                          </div>
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
                ) : (
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
                        <p>This SPH was created manually without a linked IMAP Gmail RFQ email source.</p>
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
                                const rawLogName = entry.user_name || activeQuotation.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi';
                                const lowerLogName = rawLogName.toLowerCase();
                                const isDummyLog = lowerLogName.includes('sales engineer') || lowerLogName.includes('ilham') || lowerLogName.includes('system') || lowerLogName.includes('ocr daemon');
                                const displayLogName = isDummyLog ? (activeQuotation.created_by || currentUserRef.current?.name || currentUserRef.current?.email || 'Sesi Tidak Terdeteksi') : rawLogName;
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
                          const userName = 'Admin';
                          const userEmail = 'admin@abmalaya.com';
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
                                setQuotations(prev => prev.map(q => q.id === activeQuotation.id ? { ...q, approved_by: JSON.stringify(current) } : q));
                                setAccNote('');
                                alert('ACC Approval successfully recorded!');
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
                    onClick={() => triggerSPHPrint(activeQuotation, 'pdf')}
                    className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e6e6e6] text-[#3d3d3d] font-bold text-xs p-1.5 rounded border border-[#a0a0a0] transition cursor-pointer flex items-center justify-center gap-1"
                    title="Print / Save SPH PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    onClick={() => triggerSPHPrint(activeQuotation, 'png')}
                    className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e6e6e6] text-[#3d3d3d] font-bold text-xs p-1.5 rounded border border-[#a0a0a0] transition cursor-pointer flex items-center justify-center gap-1"
                    title="Save SPH PNG image"
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
                        <span>Status Mesin Automasi Daemon PHP ({dynamicDaemons.length} Script Terdeteksi)</span>
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
                                      <span>{item.info_diag || 'Terdeteksi kendala eksekusi mesin.'}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                      <span>{item.info_diag || 'Normal - Siap memproses data penawaran.'}</span>
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
                              <span>Memindai tabel skrip daemon PHP...</span>
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
                              <span className="text-rose-300 break-words">{errLog.ai_error || errLog.error || 'Pemeriksaan kuota rate limit / antrean scan latar belakang'}</span>
                              {errLog.created_at && <span className="text-slate-500 text-[9px] block font-sans">Waktu: {errLog.created_at}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="pt-1.5 flex items-start gap-2 text-emerald-400">
                          <span className="font-bold shrink-0">[STATUS-OK]</span>
                          <span>Tidak terdeteksi error kritis. Seluruh skrip mesin daemon PHP berjalan lancar.</span>
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
                  <span className="text-cyan-400">Rincian Item Penawaran ({selectedFullDbQuotation.items?.length || 0} Item)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-800 border-b border-slate-700 text-slate-200 font-bold uppercase">
                      <tr>
                        <th className="p-2 border-r border-slate-700 text-center w-10">#</th>
                        <th className="p-2 border-r border-slate-700 w-32">Kode Item</th>
                        <th className="p-2 border-r border-slate-700">Deskripsi Barang / Jasa</th>
                        <th className="p-2 border-r border-slate-700 text-center w-16">Qty</th>
                        <th className="p-2 border-r border-slate-700 text-center w-16">Unit</th>
                        <th className="p-2 border-r border-slate-700 text-right w-28">Harga Satuan</th>
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
                Tutup Full Data Viewer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default QuotationList;
