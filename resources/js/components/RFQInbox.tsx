// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { RFQ, RFQStatus, EmailAttachment } from '../types/erp';
import { Search, Mail, Send, CheckCircle2, Clock, Building, User, Phone, Loader2, Paperclip, Eye, ShieldCheck, RefreshCw, PlusCircle, FileType, Image as ImageIcon, Maximize2, AlertTriangle, X, ExternalLink, ChevronDown, ChevronUp, MoreVertical, Menu, Sparkles, Settings, Info, ArrowRightLeft, Copy, Download } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface RFQInboxProps {
  rfqs: RFQ[];
  selectedRfqId: string | null;
  onSelectRfq: (rfq: RFQ) => void;
  onCreateQuotationFromRfq: (rfq: RFQ) => void;
  onOpenEmailReply: (rfq: RFQ) => void;
  onUpdateRfqStatus?: (rfqId: string, status: RFQStatus) => void;
  onConvertEmailToRfq?: (rfqId: string) => void;
  onRefreshLiveEmails?: () => void;
  isFetchingLive?: boolean;
  onNewQuotation?: () => void;
  onToggleMobileSidebar?: () => void;
  onPreviewStateChange?: (isOpen: boolean) => void;
  sentCount?: number;
  dealCount?: number;
  pendingCount?: number;
  onNavigateView?: (mode: any) => void;
  currentUser?: any;
}

const cleanEmailBodyText = (text: string): string => {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove boundary header parameters
  cleaned = cleaned.replace(/boundary="[^"]*"/gi, '');
  cleaned = cleaned.replace(/boundary=[a-zA-Z0-9-@._]+/gi, '');

  // 2. Remove MIME headers
  cleaned = cleaned.replace(/content-type:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-transfer-encoding:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-description:[^\n]*/gi, '');
  cleaned = cleaned.replace(/creation-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/modification-date="[^"]*";?/gi, '');
  cleaned = cleaned.replace(/content-id:[^\n]*/gi, '');
  cleaned = cleaned.replace(/content-disposition:[^\n]*/gi, '');

  // 3. Remove [cid:...] and inline cid:...
  cleaned = cleaned.replace(/\[cid:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/cid:[a-zA-Z0-9-@.]+/gi, '');

  // 4. Remove CSS styles
  cleaned = cleaned.replace(/[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '');

  // 5. Remove long base64 chunks
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length > 40 && !trimmed.includes(' ') && /^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
      return false;
    }
    return true;
  });
  cleaned = filteredLines.join('\n');

  // 6. Clean consecutive newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  return cleaned.trim();
};

export const RFQInbox: React.FC<RFQInboxProps> = ({
  rfqs = [],
  selectedRfqId,
  onSelectRfq,
  onCreateQuotationFromRfq,
  onOpenEmailReply,
  onUpdateRfqStatus,
  onRefreshLiveEmails,
  isFetchingLive = false,
  onNewQuotation,
  onToggleMobileSidebar,
  onPreviewStateChange,
  pendingCount = 0,
  onNavigateView,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<string>('received');
  const [activeSubTab, setActiveSubTab] = useState<'detected' | 'unrecognized'>('detected');

  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [notificationText, setNotificationText] = useState<string>('');
  const [isEmailMenuOpen, setIsEmailMenuOpen] = useState<boolean>(false);

  const [selectedToFilter, setSelectedToFilter] = useState<string>('all');
  const [isToFilterOpen, setIsToFilterOpen] = useState<boolean>(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState<boolean>(false);

  // Full-Width Canvas, Polkadot Action Menu & Modal States
  const [isFullViewModalOpen, setIsFullViewModalOpen] = useState<boolean>(false);
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachment | null>(null);

  const [activeListKebabId, setActiveListKebabId] = useState<string | null>(null);

  const [isTextTruncated, setIsTextTruncated] = useState<boolean>(true);
  const [pendingConfirmRfq, setPendingConfirmRfq] = useState<RFQ | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

  const [isPreviewActionsOpen, setIsPreviewActionsOpen] = useState<boolean>(false);
  const [aiSummaryModalData, setAiSummaryModalData] = useState<RFQ | null>(null);
  const [aiErrorModalData, setAiErrorModalData] = useState<RFQ | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [connectedEmail, setConnectedEmail] = useState<string>('abmalayaindustry@gmail.com');
  const [isReplyOpen, setIsReplyOpen] = useState<boolean>(true);

  const handleMoveToRequisition = (rfq: RFQ) => {
    setIsOcrProcessing(true);
    setNotificationText(`Moving "${rfq.subject}" to Requisition & generating SPH...`);
    setShowNotificationBanner(true);

    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: rfq.id,
        action: 'move_to_requisition',
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com',
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setNotificationText(`Successfully moved RFQ to Requisition! Opening Quotation Builder...`);
          setShowNotificationBanner(true);
          setTimeout(() => setShowNotificationBanner(false), 4000);
          if (onRefreshLiveEmails) {
            onRefreshLiveEmails();
          }
          onCreateQuotationFromRfq(rfq);
        } else {
          alert('Error moving RFQ: ' + resData.message);
        }
      })
      .catch((err) => console.error('Error moving RFQ:', err))
      .finally(() => {
        setIsOcrProcessing(false);
      });
  };

  useEffect(() => {
    if (onPreviewStateChange) {
      onPreviewStateChange(previewAttachment !== null || isFullViewModalOpen);
    }
  }, [previewAttachment, isFullViewModalOpen]);

  useEffect(() => {
    setIsReplyOpen(true);
  }, [selectedRfqId]);

  const [inboxRules, setInboxRules] = useState({
    excludeNoreply: true,
    excludeMedsos: true,
    prioritizePdf: true,
    requireAttachment: false,
    autoLabelRfq: true,
    excludeSystemAlerts: true,
    startDate: '',
  });

  useEffect(() => {
    fetch(getApiUrl('/api_credentials.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          const rules = { ...inboxRules };
          resData.data.forEach((item: any) => {
            if (item.credential_key === 'INBOX_RULE_EXCLUDE_NOREPLY') rules.excludeNoreply = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_EXCLUDE_MEDSOS') rules.excludeMedsos = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_PRIORITIZE_PDF') rules.prioritizePdf = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_REQUIRE_ATTACHMENT') rules.requireAttachment = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_AUTO_LABEL') rules.autoLabelRfq = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS') rules.excludeSystemAlerts = item.credential_value === 'true';
            if (item.credential_key === 'INBOX_RULE_START_DATE') rules.startDate = item.credential_value || '';
            if (item.credential_key === 'COMPANY_EMAIL') setConnectedEmail(item.credential_value || 'abmalayaindustry@gmail.com');
          });
          setInboxRules(rules);
        }
      })
      .catch((err) => console.log('RFQInbox fetch rules error:', err));
  }, []);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50); // Default 50 items per page!
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  const handleDownloadAttachment = (att: EmailAttachment) => {
    if (!selectedRfq) return;
    setDownloadingAttachmentId(att.id);
    setNotificationText(`Downloading Google Drive attachment: ${att.filename}...`);
    setShowNotificationBanner(true);

    fetch(getApiUrl('/api_download_attachment.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: selectedRfq.id,
        link_id: att.id.replace('gdrive-', '')
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setDownloadingAttachmentId(null);
        if (data.status === 'success') {
          setNotificationText(`Successfully downloaded: ${att.filename}!`);
          
          if (onRefreshLiveEmails) {
            onRefreshLiveEmails();
          }
          
          setPreviewAttachment({
            ...att,
            downloaded: true,
            filesize: 'Downloaded',
            url: data.url
          });
          
          setTimeout(() => setShowNotificationBanner(false), 3000);
        } else {
          setNotificationText(`Download failed: ${data.message}`);
          setTimeout(() => setShowNotificationBanner(false), 5000);
        }
      })
      .catch((err) => {
        setDownloadingAttachmentId(null);
        setNotificationText(`Network error occurred while downloading.`);
        console.error(att.filename, err);
        setTimeout(() => setShowNotificationBanner(false), 3000);
      });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeMainTab, activeSubTab]);

  const isSystemOrNoreplyEmail = (rfq: RFQ) => {
    if (!rfq) return false;
    const sender = (rfq.sender_email || '').toLowerCase();
    const name = (rfq.sender_name || '').toLowerCase();
    const subject = (rfq.subject || '').toLowerCase();
    const company = (rfq.company || '').toLowerCase();

    return (
      sender.includes('noreply') ||
      sender.includes('no-reply') ||
      sender.includes('do-not-reply') ||
      sender.includes('donotreply') ||
      sender.includes('hasil.gov.my') ||
      sender.includes('lhdn') ||
      sender.includes('mailer-daemon') ||
      sender.includes('facebook') ||
      sender.includes('linkedin') ||
      sender.includes('instagram') ||
      subject.includes('pemakluman berkaitan') ||
      subject.includes('e-invois hasil') ||
      subject.includes('e-invois') ||
      subject.includes('hasil') ||
      subject.includes('newsletter') ||
      subject.includes('promo') ||
      name.includes('facebook') ||
      name.includes('linkedin') ||
      name.includes('hasil') ||
      name.includes('lhdn') ||
      company.includes('hasil') ||
      company.includes('lhdn')
    );
  };

  const isDetectedClientEmail = (rfq: RFQ) => {
    if (!rfq) return false;
    return rfq.ai_classification === 'client_rfq';
  };

  const uniqueRecipients = [
    'all',
    ...Array.from(
      new Set(
        (rfqs || [])
          .map((r) => (r.recipient_email || 'abmalayaindustry@gmail.com').toLowerCase())
          .filter(Boolean)
      )
    ),
  ];

  const filteredRfqs = (rfqs || []).filter((item) => {
    const sender = (item.sender_email || '').toLowerCase();
    const subject = (item.subject || '').toLowerCase();
    const name = (item.sender_name || '').toLowerCase();

    // Apply MySQL Inbox Rules
    if (inboxRules.excludeNoreply && isSystemOrNoreplyEmail(item)) {
      return false;
    }

    if (
      inboxRules.excludeMedsos &&
      (sender.includes('facebook') ||
        sender.includes('linkedin') ||
        sender.includes('instagram') ||
        subject.includes('newsletter') ||
        subject.includes('promo') ||
        name.includes('facebook') ||
        name.includes('linkedin'))
    ) {
      return false;
    }

    if (
      inboxRules.excludeSystemAlerts &&
      (sender.includes('hasil.gov.my') || subject.includes('pemakluman berkaitan') || subject.includes('e-invois hasil'))
    ) {
      return false;
    }

    if (inboxRules.requireAttachment && (!item.attachments || item.attachments.length === 0)) {
      return false;
    }

    if (inboxRules.fetchStartDate) {
      const itemDateStr = item.created_at || item.received_at || item.date;
      if (itemDateStr) {
        const itemTime = new Date(itemDateStr).getTime();
        const limitTime = new Date(inboxRules.fetchStartDate + 'T00:00:00').getTime();
        if (!isNaN(itemTime) && !isNaN(limitTime) && itemTime < limitTime) {
          return false;
        }
      }
    }



    const isDetected = isDetectedClientEmail(item);
    const matchesSubTab = activeSubTab === 'detected' ? isDetected : !isDetected;

    // Apply Inbox Rules
    if (activeSubTab === 'detected') {
      if (inboxRules.excludeNoreply && isSystemOrNoreplyEmail(item)) {
        return false;
      }
      if (
        inboxRules.excludeMedsos &&
        (sender.includes('facebook') ||
          sender.includes('linkedin') ||
          sender.includes('instagram') ||
          subject.includes('newsletter') ||
          subject.includes('promo'))
      ) {
        return false;
      }
    } else {
      // In General Email sub-tab, hide social media promo & system alerts if rule enabled, but display general inquiries
      if (
        inboxRules.excludeMedsos &&
        (sender.includes('facebook') ||
          sender.includes('linkedin') ||
          sender.includes('instagram') ||
          subject.includes('newsletter') ||
          subject.includes('promo'))
      ) {
        return false;
      }
    }

    if (inboxRules.requireAttachment && (!item.attachments || item.attachments.length === 0)) {
      return false;
    }

    // Filter out emails received before Fetch Start Date if configured
    if (inboxRules.startDate) {
      const rawDateStr = item.date_received || (item as any).created_at || '';
      const emailDate = new Date(rawDateStr);
      const parts = inboxRules.startDate.split('-');
      const cutoffDate = parts.length === 3
        ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0)
        : new Date(inboxRules.startDate);

      if (!isNaN(emailDate.getTime()) && !isNaN(cutoffDate.getTime())) {
        if (emailDate < cutoffDate) {
          return false; // Exclude old emails prior to start date
        }
      }
    }

    // Filter by recipient_email alias / custom domain if selected
    if (selectedToFilter !== 'all') {
      const recipient = (item.recipient_email || 'abmalayaindustry@gmail.com').toLowerCase();
      if (recipient !== selectedToFilter.toLowerCase()) {
        return false;
      }
    }

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (item.sender_name || '').toLowerCase().includes(term) ||
      (item.sender_email || '').toLowerCase().includes(term) ||
      (item.recipient_email || '').toLowerCase().includes(term) ||
      (item.company || '').toLowerCase().includes(term) ||
      (item.subject || '').toLowerCase().includes(term) ||
      (item.message_body || '').toLowerCase().includes(term) ||
      (item.item_requested || '').toLowerCase().includes(term) ||
      (item.id || '').toLowerCase().includes(term) ||
      (item.rfq_number || '').toLowerCase().includes(term);

    const st = (item.status || 'received').toLowerCase();
    // All statuses that mean the email is no longer just "received"
    const isAlreadyConverted =
      st === 'in_progress' || st === 'diproses' ||
      st === 'quotation_build' || st === 'requisition' ||
      st === 'penawaran_terkirim' || st === 'siap_kirim' ||
      st === 'ready_to_send' || st === 'terkirim' ||
      st === 'sent' || st === 'done_send' ||
      st === 'deal' || st === 'selesai' || st === 'done' ||
      st === 'disetujui' || st === 'acc';

    if (activeMainTab === 'received') {
      return matchesSearch && matchesSubTab && !isAlreadyConverted;
    }
    // In Progress: email has been moved to quotation (any active quotation status)
    if (activeMainTab === 'diproses') {
      return matchesSearch && (
        st === 'diproses' || st === 'in_progress' ||
        st === 'quotation_build' || st === 'requisition'
      );
    }
    // Sent / Replied: quotation has been sent to client
    if (activeMainTab === 'siap_kirim') {
      return matchesSearch && (
        st === 'penawaran_terkirim' || st === 'siap_kirim' ||
        st === 'ready_to_send' || st === 'terkirim' || st === 'sent'
      );
    }
    // Done: quotation approved / deal closed
    if (activeMainTab === 'done') {
      return matchesSearch && (
        st === 'deal' || st === 'selesai' || st === 'done' ||
        st === 'done_send' || st === 'disetujui' || st === 'acc'
      );
    }

    return matchesSearch && matchesSubTab;
  }).sort((a, b) => {
    if (inboxRules.prioritizePdf) {
      const aHasPdf = a.attachments && a.attachments.some((att) => (att.filename || '').toLowerCase().endsWith('.pdf'));
      const bHasPdf = b.attachments && b.attachments.some((att) => (att.filename || '').toLowerCase().endsWith('.pdf'));
      const aHasGdrive = a.attachments && a.attachments.some((att) => att.is_gdrive);
      const bHasGdrive = b.attachments && b.attachments.some((att) => att.is_gdrive);
      const aHasFile = aHasPdf || aHasGdrive;
      const bHasFile = bHasPdf || bHasGdrive;
      if (aHasFile && !bHasFile) return -1;
      if (!aHasFile && bHasFile) return 1;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredRfqs.length / itemsPerPage) || 1;
  const paginatedRfqs = filteredRfqs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedRfq = filteredRfqs.find((r) => r.id === selectedRfqId) || filteredRfqs[0] || null;

  const getAttachmentPreviewUrl = (att: EmailAttachment | null) => {
    if (!att) return '';
    if (att.url && att.url.startsWith('http')) return att.url;
    const msgno = (selectedRfq as any)?.msgno || 403;
    const part = att.part || 2;
    const fn = att.filename || 'attachment.pdf';
    const ext = att.extension || (fn.toLowerCase().endsWith('.png') ? 'png' : 'pdf');
    return getApiUrl(`/api_fetch_live_gmail.php?preview=1&msgno=${msgno}&part=${part}&ext=${ext}&fn=${encodeURIComponent(fn)}`);
  };

  const getAttachmentLabelText = (att: EmailAttachment) => {
    if (att.is_gdrive) {
      if ((att as any).is_folder) return `drive: folder`;
      return att.downloaded 
        ? `file: ${att.filename}`
        : `drive: file`;
    }
    return `file: ${att.filename}`;
  };

  const getTruncatedText = (text?: string, maxLength: number = 400) => {
    if (!text) return 'No email body content.';
    if (!isTextTruncated || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderFormattedBodyText = (rawText: string) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      const isHeader = trimmed.startsWith('Fwd:') || trimmed.startsWith('Subject:') || trimmed.startsWith('From:');

      if (isHeader) {
        return (
          <p key={idx} className="font-bold text-[#0080d0] text-xs">
            {line}
          </p>
        );
      }

      return (
        <p key={idx} className="text-slate-800 text-xs">
          {line}
        </p>
      );
    });
  };

  const handleProcessRfqClick = (rfq: RFQ) => {
    setPendingConfirmRfq(rfq);
  };

  const handleConfirmQuotationCreation = () => {
    if (!pendingConfirmRfq) return;
    setIsOcrProcessing(true);

    if (onUpdateRfqStatus) {
      onUpdateRfqStatus(pendingConfirmRfq.id, 'in_progress');
    }

    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `QUO-${Date.now().toString().slice(-4)}`,
        rfq_id: pendingConfirmRfq.id,
        quotation_number: `SPH-ABM/MY/2026/0${Math.floor(Math.random() * 900 + 100)}`,
        client_name: pendingConfirmRfq.sender_name,
        client_email: pendingConfirmRfq.sender_email,
        company_name: pendingConfirmRfq.company || pendingConfirmRfq.sender_name,
        date_issued: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        items: [
          {
            id: 'item-autogen-1',
            description: pendingConfirmRfq.item_requested || 'Industrial Equipment Specification',
            quantity: 1,
            unit: 'Package',
            unit_price: 0,
            discount_percent: 0,
            total: 0,
          }
        ],
        subtotal: 0,
        discount_total: 0,
        tax_percent: 11,
        tax_amount: 0,
        grand_total: 0,
        notes: `Extracted from RFQ: ${pendingConfirmRfq.subject || pendingConfirmRfq.message_body}`,
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com',
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        console.log('Processed RFQ saved to MySQL:', resData);
        setNotificationText(`RFQ from ${pendingConfirmRfq.sender_name} processed and saved to MySQL! Opening Quotation Builder...`);
        setShowNotificationBanner(true);
        setTimeout(() => setShowNotificationBanner(false), 4000);
        onCreateQuotationFromRfq(pendingConfirmRfq);
      })
      .catch((err) => console.log('Error saving quotation to MySQL:', err))
      .finally(() => {
        setIsOcrProcessing(false);
        setPendingConfirmRfq(null);
      });
  };

  const getFileIcon = (filename?: string) => {
    const fn = (filename || '').toLowerCase();
    if (fn.endsWith('.pdf')) return <FileType className="w-3.5 h-3.5 text-red-600 shrink-0" />;
    if (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    return <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  const formatAttachmentSummary = (atts?: EmailAttachment[]) => {
    if (!atts || atts.length === 0) return 'No attachment';
    if (atts.length === 1) return `1 file (${atts[0].filename})`;
    return `${atts.length} files attached (${atts.map(a => a.filename).join(', ')})`;
  };



  return (
    <div className="w-full h-full bg-slate-100 flex flex-col font-sans overflow-hidden p-0 m-0">
      
      {/* Dynamic Processing Status Banner */}
      {showNotificationBanner && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-950 font-bold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notificationText}</span>
          </div>
          <button onClick={() => setShowNotificationBanner(false)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edge-to-Edge Split View Area */}
      <div className="flex-1 flex overflow-hidden w-full h-full">
        
        {/* LEFT COLUMN: LIST OF RFQs */}
        <div className="w-full md:w-96 border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
          
          {/* Header Bar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onToggleMobileSidebar && (
                  <button onClick={onToggleMobileSidebar} className="md:hidden p-1 text-slate-600">
                    <Menu className="w-4 h-4" />
                  </button>
                )}
                <h2 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">RFQ Inbox</h2>
                <span className="bg-amber-500 text-white font-extrabold text-[10px] px-1.5 py-0.5">
                  {pendingCount}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEmailMenuOpen(!isEmailMenuOpen)}
                    className="p-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition cursor-pointer border border-slate-300/60"
                    title="Opsi & Pengaturan Email"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isEmailMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsEmailMenuOpen(false)} />
                      <div className="absolute right-0 top-8 bg-white border border-slate-300 rounded-md shadow-xl py-1 z-50 w-44 animate-in fade-in slide-in-from-top-1 text-xs">
                        <button
                          onClick={() => {
                            setIsEmailMenuOpen(false);
                            setIsInfoModalOpen(true);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 text-slate-800 font-bold flex items-center gap-2 cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Info Settings</span>
                        </button>

                        {onRefreshLiveEmails && (
                          <button
                            onClick={() => {
                              setIsEmailMenuOpen(false);
                              onRefreshLiveEmails();
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 text-slate-800 font-bold flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Sync Live Gmail</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Search Input & Sync Button */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search quotation, RFQ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-8 pr-2 py-1 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {onRefreshLiveEmails && (
                <button
                  onClick={onRefreshLiveEmails}
                  disabled={isFetchingLive}
                  className="p-1.5 backdrop-blur-sm bg-white/40 hover:bg-white/60 text-blue-700 border border-white/60 ring-1 ring-blue-200/60 text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0 disabled:opacity-40 rounded-lg shadow-sm"
                  title="Sync Live Gmail IMAP"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLive ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              )}
            </div>

            {/* Filter Tabs: Received | Filter To Dropdown | More Statuses Dropdown */}
            <div className="flex gap-1.5 border-b border-slate-200 pb-1.5 text-xs pt-1 items-center w-full">
              
              {/* RECEIVED TAB */}
              <button
                onClick={() => {
                  setActiveMainTab('received');
                }}
                className={`px-3 py-1 font-bold text-[11px] rounded-md transition cursor-pointer flex items-center gap-1 ${
                  activeMainTab === 'received'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}
              >
                <span>Received</span>
              </button>

              {/* FILTER TO DROP-DOWN */}
              <div className="relative">
                <button
                  onClick={() => setIsToFilterOpen(!isToFilterOpen)}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-md transition cursor-pointer flex items-center gap-1 border ${
                    selectedToFilter !== 'all'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                  }`}
                  style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}
                  title="Filter by recipient email alias / domain"
                >
                  <span>To: {selectedToFilter === 'all' ? 'All' : selectedToFilter.split('@')[0]}</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {isToFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsToFilterOpen(false)} />
                    <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-350 shadow-lg rounded-md overflow-hidden z-50 py-1 font-sans text-xs">
                      {uniqueRecipients.map((rec) => (
                        <button
                          key={rec}
                          onClick={() => {
                            setSelectedToFilter(rec);
                            setIsToFilterOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 transition truncate cursor-pointer font-bold ${
                            selectedToFilter === rec ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          {rec === 'all' ? '✓ All Recipient Domains' : rec}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* CORNER dropdown FOR OTHER STATUSES */}
              <div className="relative ml-auto shrink-0">
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-md transition cursor-pointer flex items-center gap-1 border ${
                    activeMainTab !== 'received'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                  }`}
                  style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}
                  title="Filter by status: In Progress, Sent, Done"
                >
                  <span>
                    {activeMainTab === 'received'
                      ? 'Status...'
                      : activeMainTab === 'diproses'
                      ? 'In Progress'
                      : activeMainTab === 'siap_kirim'
                      ? 'Sent / Replied'
                      : 'Done'}
                  </span>
                  <MoreVertical className="w-3 h-3" />
                </button>

                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-300 shadow-lg rounded-md overflow-hidden z-50 py-1 font-sans text-xs">
                      {[
                        { id: 'diproses', label: 'In Progress' },
                        { id: 'siap_kirim', label: 'Sent / Replied' },
                        { id: 'done', label: 'Done' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setActiveMainTab(st.id);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 transition cursor-pointer font-bold ${
                            activeMainTab === st.id ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Sub-Tabs: Detected Client vs Unrecognized */}
            <div className="flex gap-1.5 text-xs pt-0.5 px-3 mb-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('detected')}
                className={`flex-1 py-1.5 px-2 text-[10px] font-extrabold border text-center transition cursor-pointer flex items-center justify-center gap-1.5 rounded-md shadow-2xs ${
                  activeSubTab === 'detected'
                    ? 'bg-gradient-to-b from-[#2e2e2e] to-[#121212] text-white border-[#111]'
                    : 'bg-gradient-to-b from-[#ffffff] to-[#f5f5f5] text-slate-700 border-slate-200 hover:from-[#fcfcfc] hover:to-[#ebebeb]'
                }`}
                style={{ fontFamily: "'Eurostile', monospace" }}
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${activeSubTab === 'detected' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span>REQUISITION ({(rfqs || []).filter(isDetectedClientEmail).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('unrecognized')}
                className={`flex-1 py-1.5 px-2 text-[10px] font-extrabold border text-center transition cursor-pointer flex items-center justify-center gap-1.5 rounded-md shadow-2xs ${
                  activeSubTab === 'unrecognized'
                    ? 'bg-gradient-to-b from-[#2e2e2e] to-[#121212] text-white border-[#111]'
                    : 'bg-gradient-to-b from-[#ffffff] to-[#f5f5f5] text-slate-700 border-slate-200 hover:from-[#fcfcfc] hover:to-[#ebebeb]'
                }`}
                style={{ fontFamily: "'Eurostile', monospace" }}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${activeSubTab === 'unrecognized' ? 'text-amber-400' : 'text-amber-600'}`} />
                <span>OTHERS ({(rfqs || []).filter(r => !isDetectedClientEmail(r)).length})</span>
              </button>
            </div>

          </div>



          {/* Pagination Controls Bar (< > Buttons & Limit Selector) */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#f8fafc] border-b border-slate-200 text-xs font-bold text-slate-700 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 text-[11px] font-bold px-1 py-0.5 rounded cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50 / page</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-600 font-mono text-[10px]">
                {filteredRfqs.length > 0
                  ? `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredRfqs.length)} of ${filteredRfqs.length}`
                  : '0 emails'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-black cursor-pointer shadow-2xs text-xs"
                  title="Previous Page (<)"
                >
                  &lt;
                </button>

                <span className="font-mono text-[10px] text-slate-700 px-0.5">{currentPage}/{totalPages}</span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-black cursor-pointer shadow-2xs text-xs"
                  title="Next Page (>)"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          {/* RFQ List Scroll Container */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 h-full">
            {paginatedRfqs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Mail className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600">No emails found in this tab.</p>
              </div>
            ) : (
              paginatedRfqs.map((item) => {
                const isSelected = item.id === selectedRfq?.id;
                const isDetected = isDetectedClientEmail(item);
                const attachmentSummary = formatAttachmentSummary(item.attachments);
                const isKebabOpen = activeListKebabId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectRfq(item);
                      setShowNotificationBanner(false);
                    }}
                    className={`p-3 transition-all cursor-pointer border-l-4 relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-600'
                        : !isDetected
                        ? 'bg-amber-50/30 hover:bg-amber-50/60 border-transparent'
                        : 'hover:bg-slate-50 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h3 className="font-bold text-xs text-slate-900 truncate pr-4">
                        {item.company || item.sender_name}
                      </h3>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                          {(item.date_received || '').split(' ')[0]}
                        </span>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveListKebabId(isKebabOpen ? null : item.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer rounded-sm"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {isKebabOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveListKebabId(null); }} />
                              <div className="absolute right-0 top-6 w-44 bg-white border border-slate-300 shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveListKebabId(null);
                                    onSelectRfq(item);
                                    handleProcessRfqClick(item);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold text-left"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Process to SPH</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveListKebabId(null);
                                    onSelectRfq(item);
                                    onOpenEmailReply(item);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-left border-t border-slate-100"
                                >
                                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Reply Email</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveListKebabId(null);
                                    setAiSummaryModalData(item);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-amber-50 hover:text-amber-700 font-semibold text-left border-t border-slate-100"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-550" />
                                  <span>AI Summary</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveListKebabId(null);
                                    setAiErrorModalData(item);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-rose-50 hover:text-rose-700 font-semibold text-left border-t border-slate-100"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>AI Error Log</span>
                                </button>

                                {activeSubTab === 'unrecognized' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveListKebabId(null);
                                      handleMoveToRequisition(item);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-amber-50 hover:text-amber-700 font-semibold text-left border-t border-slate-100"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Move to Requisition</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-800 font-bold mb-1 line-clamp-1">
                      {item.subject}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {/* Database Status Badge */}
                      {(() => {
                        const st = (item.status || 'received').toLowerCase();
                        let labelText = 'Received';
                        let badgeClass = 'bg-blue-50 text-blue-800 border-blue-300';
                        if (st === 'diproses' || st === 'in_progress') {
                          labelText = 'In Progress';
                          badgeClass = 'bg-amber-50 text-amber-800 border-amber-400 font-extrabold';
                        } else if (st === 'penawaran_terkirim' || st === 'sent' || st === 'done_send') {
                          labelText = 'Sent / Replied';
                          badgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-300';
                        } else if (st === 'deal' || st === 'done') {
                          labelText = 'Done';
                          badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                        } else if (st === 'batal' || st === 'cancelled') {
                          labelText = 'Cancelled';
                          badgeClass = 'bg-slate-50 text-slate-600 border-slate-350';
                        }
                        return (
                          <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm border uppercase ${badgeClass}`}>
                            DB Status: {labelText}
                          </span>
                        );
                      })()}

                      {item.labels && item.labels.filter(l => l !== 'Primary RFQ' && l !== 'AI Verified').map((lbl, lIdx) => (
                        <span
                          key={lIdx}
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm border ${
                            lbl === 'Primary RFQ' || lbl === 'AI Verified' || lbl === 'AI: Permintaan Klien' || lbl === 'AI: Requisition'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : lbl === 'Waiting AI Detection' || lbl === 'Pending AI Scan'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse font-extrabold'
                              : lbl === 'AI Junk' || lbl === 'AI: Spam / Junk' || lbl === 'AI: Iklan / Sampah' || lbl === 'AI: Notifikasi / Iklan'
                              ? 'bg-rose-50 text-rose-800 border-rose-350'
                              : lbl === 'Has File'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-slate-50 text-slate-700 border-slate-350'
                          }`}
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 leading-tight">
                      {cleanEmailBodyText(item.message_body)}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] pt-1 border-t border-slate-200/50">
                      <div className="flex flex-wrap items-center gap-1 max-w-[75%]">
                        {item.attachments && item.attachments.map((att, attIdx) => (
                          <span
                            key={attIdx}
                            className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 rounded-xs truncate max-w-[110px]"
                            title={att.filename}
                          >
                            {getFileIcon(att.filename)}
                            <span className="truncate">{getAttachmentLabelText(att)}</span>
                          </span>
                        ))}
                      </div>

                      {(() => {
                        const st = (item.status || 'received').toLowerCase();
                        if (st === 'diproses' || st === 'in_progress' || st === 'quotation_build' || st === 'requisition') {
                          return (
                            <span className="bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 border border-amber-300 rounded-sm">
                              In Progress
                            </span>
                          );
                        }
                        if (st === 'penawaran_terkirim' || st === 'sent' || st === 'done_send' || st === 'siap_kirim' || st === 'ready_to_send' || st === 'terkirim') {
                          return (
                            <span className="bg-indigo-100 text-indigo-900 font-extrabold px-1.5 py-0.5 border border-indigo-300 rounded-sm">
                              Sent / Replied
                            </span>
                          );
                        }
                        if (st === 'deal' || st === 'done' || st === 'disetujui' || st === 'acc') {
                          return (
                            <span className="bg-emerald-100 text-emerald-900 font-extrabold px-1.5 py-0.5 border border-emerald-300 rounded-sm">
                              Done
                            </span>
                          );
                        }
                        return (
                          <span className="bg-blue-100 text-blue-900 font-extrabold px-1.5 py-0.5 border border-blue-300 rounded-sm">
                            Received
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL READER CANVAS */}
        <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
          {selectedRfq ? (
            <>
              {/* Header Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {/* Database Status Badge in Preview */}
                    {(() => {
                      const st = (selectedRfq.status || 'received').toLowerCase();
                      let labelText = 'Received';
                      let badgeClass = 'bg-blue-600 text-white';
                      if (st === 'diproses' || st === 'in_progress') {
                        labelText = 'In Progress';
                        badgeClass = 'bg-amber-500 text-white font-extrabold';
                      } else if (st === 'penawaran_terkirim' || st === 'sent' || st === 'done_send') {
                        labelText = 'Sent / Replied';
                        badgeClass = 'bg-indigo-600 text-white';
                      } else if (st === 'deal' || st === 'done') {
                        labelText = 'Done';
                        badgeClass = 'bg-emerald-600 text-white';
                      } else if (st === 'batal' || st === 'cancelled') {
                        labelText = 'Cancelled';
                        badgeClass = 'bg-slate-500 text-white';
                      }
                      return (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 uppercase shadow-xs ${badgeClass}`} style={{ fontFamily: "'Eurostile', monospace" }}>
                          DB Status: {labelText}
                        </span>
                      );
                    })()}

                    <span className="bg-slate-200 text-slate-800 font-extrabold text-[10px] px-2 py-0.5">
                      {selectedRfq.company || selectedRfq.sender_name}
                    </span>
                    {selectedRfq.labels && selectedRfq.labels.filter(l => l !== 'Primary RFQ' && l !== 'AI Verified').map((lbl, lIdx) => (
                      <span
                        key={lIdx}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border ${
                          lbl === 'Primary RFQ' || lbl === 'AI Verified' || lbl === 'AI: Permintaan Klien' || lbl === 'AI: Requisition'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : lbl === 'Waiting AI Detection' || lbl === 'Pending AI Scan'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse font-extrabold'
                            : lbl === 'AI Junk' || lbl === 'AI: Spam / Junk' || lbl === 'AI: Iklan / Sampah' || lbl === 'AI: Notifikasi / Iklan'
                            ? 'bg-rose-50 text-rose-800 border-rose-350'
                            : lbl === 'Has File'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-slate-50 text-slate-700 border-slate-350'
                        }`}
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>

                  <h2 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                    {selectedRfq.subject}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0 relative">
                  
                  {/* Process RFQ to SPH Button */}
                  <button
                    onClick={() => handleProcessRfqClick(selectedRfq)}
                    className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-md border border-[#0060b0] shadow-sm cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Process RFQ to SPH</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsPreviewActionsOpen(!isPreviewActionsOpen)}
                      className="p-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition cursor-pointer text-slate-700 flex items-center justify-center"
                      title="More Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {isPreviewActionsOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsPreviewActionsOpen(false)} />
                        <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 w-44 text-xs font-bold text-slate-800">
                          <button
                            onClick={() => {
                              setIsPreviewActionsOpen(false);
                              onOpenEmailReply(selectedRfq);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Reply Email</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsPreviewActionsOpen(false);
                              setAiSummaryModalData(selectedRfq);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 border-t border-slate-100 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>AI Summary</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsPreviewActionsOpen(false);
                              setAiErrorModalData(selectedRfq);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 border-t border-slate-100 cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Error & AI Log</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>

              {/* Email Meta Info & Attachments */}
              <div className="p-4 bg-slate-50/30 border-b border-slate-200 text-xs space-y-2 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>From:</strong> <span className="font-bold text-slate-900">{selectedRfq.sender_name}</span> ({selectedRfq.sender_email})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>To:</strong> <span className="font-bold text-emerald-900">{(selectedRfq as any).recipient_email || 'mijdigital2026@gmail.com'}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>Company:</strong> {selectedRfq.company || selectedRfq.sender_name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>Phone:</strong> {selectedRfq.phone || '-'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span><strong>Date Received:</strong> {selectedRfq.date_received}</span>
                  </div>
                </div>

                {/* ATTACHMENT PILL BUTTONS WITH DIRECT LIGHTBOX MODAL PREVIEW */}
                {selectedRfq.attachments && selectedRfq.attachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      Detected Attachments ({selectedRfq.attachments.length}):
                    </span>

                    {selectedRfq.attachments.map((att) => (
                      <button
                        key={att.id || att.filename}
                        onClick={() => setPreviewAttachment(att)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs backdrop-blur-sm bg-white/70 hover:bg-white/90 text-slate-800 border border-white/80 ring-1 ring-slate-200/70 hover:ring-blue-300/70 transition cursor-pointer shadow-sm font-semibold rounded-lg"
                        title="Click to preview file attachment"
                      >
                        {getFileIcon(att.filename)}
                        <span className="truncate max-w-[150px]">{getAttachmentLabelText(att)}</span>
                        <span className="text-[10px] opacity-75 font-mono">({att.filesize})</span>
                        <Eye className="w-3 h-3 text-blue-600 ml-0.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column Content View */}
              <div className="flex-1 overflow-y-auto space-y-4 w-full bg-white h-full">
                
                <div className="p-5 space-y-4 w-full bg-white">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Executive RFQ Message Content & Extracted Details
                    </h3>

                    <button
                      onClick={() => setIsFullViewModalOpen(true)}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-blue-700 font-bold text-[11px] px-2.5 py-1 border border-slate-300 transition cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3 text-blue-600" />
                      <span>Full View</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="whitespace-pre-line font-sans text-xs text-slate-900 leading-relaxed bg-slate-50/60 p-4 border border-slate-200 space-y-2 break-words overflow-x-auto rounded-sm">
                      {renderFormattedBodyText(getTruncatedText(cleanEmailBodyText(selectedRfq.message_body)))}
                    </div>

                    {selectedRfq.message_body && selectedRfq.message_body.length > 400 && (
                      <button
                        type="button"
                        onClick={() => setIsTextTruncated(!isTextTruncated)}
                        className="mt-1 flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                      >
                        {isTextTruncated ? (
                          <>
                            <span>View More</span>
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                          </>
                        ) : (
                          <>
                            <span>View Less</span>
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Collapsible Sent Email Replies Section */}
                  {selectedRfq.replies && selectedRfq.replies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsReplyOpen(!isReplyOpen)}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-b from-[#2e2e2e] to-[#121212] hover:from-[#3e3e3e] hover:to-[#1c1c1c] text-white font-extrabold text-[10px] px-3 py-1.5 rounded-md border border-[#111] shadow-sm cursor-pointer transition"
                        style={{ fontFamily: "'Eurostile', monospace" }}
                      >
                        <Send className="w-3 h-3 text-white" />
                        <span>VIEW REPLY BY EMAIL : {selectedRfq.replies[0].sender} ({selectedRfq.replies[0].date})</span>
                        {isReplyOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>

                      {isReplyOpen && (
                        <div className="mt-3 bg-indigo-50/20 border border-indigo-150 p-4 rounded-sm space-y-2 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-850 border-b border-indigo-100 pb-1 mb-2">
                            <span>From: {selectedRfq.replies[0].sender}</span>
                            <span>Sent Date: {selectedRfq.replies[0].date}</span>
                          </div>
                          <div className="whitespace-pre-line font-sans text-xs text-slate-800 leading-relaxed break-words overflow-x-auto">
                            {selectedRfq.replies[0].body}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>

            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select an email message from the left to view details.
            </div>
          )}
        </div>

      </div>

      {/* ATTACHMENT PREVIEW LIGHTBOX MODAL (PDF & IMAGES) */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                {getFileIcon(previewAttachment.filename)}
                <h3 className="font-extrabold text-xs text-slate-900 truncate">
                  Preview Attachment — {previewAttachment.filename} ({previewAttachment.filesize})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {previewAttachment.is_gdrive && (
                  <>
                    <button
                      onClick={() => {
                        if (previewAttachment.original_url) {
                          navigator.clipboard.writeText(previewAttachment.original_url);
                          alert("Google Drive Link copied to clipboard!");
                        }
                      }}
                      className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-1.5 border border-slate-350 rounded cursor-pointer transition shadow-2xs"
                      title="Copy Google Drive Link"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Link</span>
                    </button>

                    <button
                      onClick={() => handleDownloadAttachment(previewAttachment)}
                      disabled={downloadingAttachmentId !== null}
                      className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-blue-750 font-bold text-xs px-3 py-1.5 border border-slate-350 rounded cursor-pointer transition shadow-2xs disabled:opacity-50"
                      title="Force download file from Google Drive to server"
                    >
                      {downloadingAttachmentId !== null ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>Download File</span>
                    </button>
                  </>
                )}

                <a
                  href={getAttachmentPreviewUrl(previewAttachment)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-white hover:bg-slate-100 text-blue-700 font-bold text-xs px-3 py-1 border border-slate-300 rounded cursor-pointer transition shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open in New Tab</span>
                </a>

                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-900 p-2 overflow-hidden flex items-center justify-center">
              {previewAttachment.is_gdrive && (previewAttachment.is_folder || !previewAttachment.downloaded) ? (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-800 text-white space-y-4 max-w-lg mx-auto rounded-lg border border-slate-700 shadow-xl">
                  <div className="w-16 h-16 bg-blue-900/40 text-blue-400 border border-blue-800 rounded-full flex items-center justify-center shadow-lg">
                    <Paperclip className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-extrabold" style={{ fontFamily: "'Eurostile', monospace" }}>
                    {previewAttachment.is_folder ? 'Google Drive Folder Link' : 'Google Drive / Docs Attachment Link'}
                  </h4>
                  <p className="text-xs text-slate-300 text-center leading-relaxed">
                    {previewAttachment.is_folder
                      ? 'This is a Google Drive folder link shared in the email. Folders cannot be downloaded directly — click below to open it in Google Drive.'
                      : 'This file is linked from the email body. It has not been cached on our server yet. You can copy the original link or download it to the server.'}
                  </p>
                  
                  <div className="flex flex-wrap gap-3 items-center justify-center w-full pt-2">
                    {/* Copy Link Button */}
                    <button
                      onClick={() => {
                        if (previewAttachment.original_url) {
                          navigator.clipboard.writeText(previewAttachment.original_url);
                          alert("Google Drive Link copied to clipboard!");
                        }
                      }}
                      className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Google Drive Link</span>
                    </button>
                    
                    {/* Open in Drive (always) or Download to Server (only for files) */}
                    {previewAttachment.is_folder ? (
                      <a
                        href={previewAttachment.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Folder in Google Drive</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDownloadAttachment(previewAttachment)}
                        disabled={downloadingAttachmentId !== null}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {downloadingAttachmentId !== null ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Download File to Server</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (previewAttachment.filename || '').toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={getAttachmentPreviewUrl(previewAttachment)}
                  className="w-full h-full border-none shadow-lg bg-white"
                  title="PDF Attachment Viewer"
                />
              ) : (
                <img
                  src={getAttachmentPreviewUrl(previewAttachment)}
                  alt={previewAttachment.filename || 'Attachment'}
                  className="max-w-full max-h-full object-contain shadow-2xl"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-mono text-slate-600">
                Path: public/attachments/{previewAttachment.filename}
              </span>

              <button
                onClick={() => setPreviewAttachment(null)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FULL VIEW EMAIL MESSAGE MODAL */}
      {isFullViewModalOpen && selectedRfq && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-0 animate-in fade-in font-sans">
          <div className="bg-white w-screen h-screen flex flex-col shadow-2xl overflow-hidden rounded-none border-0">
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <h3 className="font-extrabold text-xs text-slate-900 truncate pr-4">
                Full View RFQ Email — {selectedRfq.subject}
              </h3>
              <button
                onClick={() => setIsFullViewModalOpen(false)}
                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition cursor-pointer flex items-center justify-center shadow-sm shrink-0"
                title="Close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-900 bg-slate-50 flex-1">
              {/* Meta information box */}
              <div className="bg-white p-4 border border-slate-300 shadow-2xs space-y-2.5 rounded-sm">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Email Subject</span>
                  <h2 className="text-xs font-extrabold text-slate-900 leading-snug">
                    {selectedRfq.subject}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">From</span>
                    <p className="font-extrabold text-slate-900 text-[11px]">{selectedRfq.sender_name} ({selectedRfq.sender_email})</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">To</span>
                    <p className="font-extrabold text-slate-900 text-[11px] font-bold text-emerald-900">{(selectedRfq as any).recipient_email || 'mijdigital2026@gmail.com'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Company</span>
                    <p className="font-extrabold text-slate-900 text-[11px]">{selectedRfq.company || selectedRfq.sender_name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone</span>
                    <p className="font-extrabold text-slate-900 text-[11px]">{selectedRfq.phone || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date Received</span>
                    <p className="font-extrabold text-slate-900 text-[11px]">{selectedRfq.date_received || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="bg-white p-4 border border-slate-350 shadow-2xs space-y-2 rounded-sm">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">
                  Full Email Body Content:
                </h4>
                <div className="whitespace-pre-line font-sans text-xs text-slate-900 leading-relaxed bg-slate-50 p-4 border border-slate-200 break-words overflow-x-auto">
                  {cleanEmailBodyText(selectedRfq.message_body)}
                </div>
              </div>

              {/* Display Sent Email Replies in Full View */}
              {selectedRfq.replies && selectedRfq.replies.length > 0 && (
                <div className="bg-white p-4 border border-indigo-200 shadow-2xs space-y-2 rounded-sm">
                  <h4 className="font-bold text-indigo-950 text-xs border-b border-indigo-200 pb-2 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-indigo-650" />
                    <span>Sent Email Reply (Outbound Quotation SPH)</span>
                  </h4>
                  <div className="bg-indigo-50/20 border border-indigo-100 p-4 rounded-sm space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-850 border-b border-indigo-100 pb-1 mb-2">
                      <span>From: {selectedRfq.replies[0].sender}</span>
                      <span>Sent Date: {selectedRfq.replies[0].date}</span>
                    </div>
                    <div className="whitespace-pre-line font-sans text-xs text-slate-800 leading-relaxed break-words overflow-x-auto">
                      {selectedRfq.replies[0].body}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex justify-end shrink-0">
              <button
                onClick={() => setIsFullViewModalOpen(false)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-sm cursor-pointer shadow-sm border border-red-700 transition"
              >
                Close Full View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION POP-UP MODAL FOR DATABASE LOGGING */}
      {pendingConfirmRfq && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-lg shadow-2xl overflow-hidden rounded-md">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between border-b border-blue-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-300 animate-pulse" />
                <h3 className="font-extrabold text-sm text-white">
                  Confirm Process RFQ to MySQL Database
                </h3>
              </div>
              <button
                onClick={() => setPendingConfirmRfq(null)}
                className="p-1 text-slate-300 hover:text-white hover:bg-blue-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800 bg-white">
              <div className="bg-blue-50 border-l-4 border-blue-600 p-3 space-y-1">
                <p className="font-bold text-blue-900">Are you sure you want to process this RFQ?</p>
                <p className="text-slate-600">
                  This will log the RFQ in MySQL database <strong>abmalaya_erp (Tabel quotations & rfq_requests)</strong>, set its status to <strong>In Progress</strong>, and move this RFQ into the In Progress filter tab!
                </p>
              </div>

              <div className="bg-slate-50 p-3 border border-slate-200 space-y-1 text-[11px] font-mono">
                <div><strong>Subject:</strong> {pendingConfirmRfq.subject}</div>
                <div><strong>Client:</strong> {pendingConfirmRfq.sender_name} ({pendingConfirmRfq.sender_email})</div>
                <div><strong>Attachment:</strong> {pendingConfirmRfq.attachments?.[0]?.filename || 'No PDF attachment'}</div>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingConfirmRfq(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmQuotationCreation}
                disabled={isOcrProcessing}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isOcrProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing & Saving to MySQL...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Confirm & Move to In Progress</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal Popup */}
      {aiSummaryModalData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-blue-600 px-4 py-3 flex items-center justify-between text-white border-b border-blue-700">
              <div className="flex items-center gap-1.5 font-extrabold text-sm">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>AI Classification Summary / Resume</span>
              </div>
              <button
                onClick={() => setAiSummaryModalData(null)}
                className="p-1 text-blue-200 hover:text-white hover:bg-blue-700 transition cursor-pointer rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Target Email subject</span>
                <p className="font-extrabold text-slate-900 text-sm bg-slate-50 p-2 border border-slate-200">{aiSummaryModalData.subject}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AI Classification Result</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-sm font-bold border text-[10px] ${
                  aiSummaryModalData.ai_classification === 'client_rfq'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {aiSummaryModalData.ai_classification === 'client_rfq' ? 'AI: Requisition' : 'AI: Iklan / Sampah (Junk/Alert)'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AI Extracted Items / Resume Details</span>
                <p className="text-slate-800 bg-slate-50 p-3 border border-slate-200 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md text-[11px] mb-2" style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}>
                  {aiSummaryModalData.item_requested || 'No specific spares or items were extracted by AI.'}
                </p>
              </div>

              {/* Activity History Logs (Riwayat) */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Activity History Log (Riwayat)</span>
                <div className="bg-slate-900 text-slate-200 p-3 border border-slate-800 leading-relaxed max-h-36 overflow-y-auto rounded-md text-[10px] space-y-2.5" style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}>
                  {(aiSummaryModalData as any).history_log ? (
                    (() => {
                      try {
                        const logs = JSON.parse((aiSummaryModalData as any).history_log);
                        if (Array.isArray(logs) && logs.length > 0) {
                          return logs.map((log: any, idx: number) => (
                            <div key={idx} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                              <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                <span>{log.timestamp}</span>
                                <span className="text-amber-400">{log.action}</span>
                              </div>
                              <p className="text-slate-300 mt-0.5 leading-normal">{log.details}</p>
                              <span className="text-[8px] text-slate-500 font-bold block mt-0.5">By: {log.user_name} ({log.user_email})</span>
                            </div>
                          ));
                        }
                      } catch (e) {
                        console.error(e);
                      }
                      return <p className="text-slate-500 italic">No activity recorded for this RFQ yet.</p>;
                    })()
                  ) : (
                    <p className="text-slate-500 italic">No activity recorded for this RFQ yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setAiSummaryModalData(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer rounded-md shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Error Log Modal Popup */}
      {aiErrorModalData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between text-white border-b border-slate-900">
              <div className="flex items-center gap-1.5 font-extrabold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Execution Error & AI Log</span>
              </div>
              <button
                onClick={() => setAiErrorModalData(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Target Email subject</span>
                <p className="font-extrabold text-slate-900 text-sm bg-slate-50 p-2 border border-slate-200">{aiErrorModalData.subject}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Verification Status</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-sm font-bold border text-[10px] ${
                  aiErrorModalData.ai_verified === 1
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                }`}>
                  {aiErrorModalData.ai_verified === 1 ? 'AI Scan Success (Verified)' : 'AI Scan Pending / Failed (Waiting Scan)'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Execution Log Details</span>
                <div className="text-slate-800 bg-slate-900 p-3 border border-slate-800 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-md text-[11px] text-rose-300" style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}>
                  {(aiErrorModalData as any).ai_error || 'No errors detected during AI processing. Classification succeeded.'}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setAiErrorModalData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs cursor-pointer rounded-md shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Settings Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between text-white border-b border-slate-900">
              <div className="flex items-center gap-1.5 font-extrabold text-sm">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Inbox Status & Info Settings</span>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500 w-1/2">Email Connected</td>
                      <td className="py-2.5 font-extrabold text-slate-800 font-mono">{connectedEmail}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">Info Start From (Date)</td>
                      <td className="py-2.5 font-extrabold text-slate-800 font-mono">{inboxRules.startDate || 'Not configured'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">Emails in Database</td>
                      <td className="py-2.5 font-extrabold text-slate-800 font-mono">{rfqs.length}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">Total Emails (All)</td>
                      <td className="py-2.5 font-extrabold text-slate-800 font-mono">{rfqs.length}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">AI Requisition Emails (Count)</td>
                      <td className="py-2.5 font-extrabold text-emerald-700 font-mono">
                        {rfqs.filter(r => r.ai_classification === 'client_rfq').length}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">Emails Failed Requisition Verification</td>
                      <td className="py-2.5 font-extrabold text-rose-700 font-mono">
                        {rfqs.filter(r => r.ai_classification && r.ai_classification !== 'client_rfq').length}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-slate-500">Error Log (Count)</td>
                      <td className="py-2.5 font-mono">
                        {rfqs.filter(r => r.ai_error && r.ai_error.trim() !== '').length > 0 ? (
                          <span className="font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-200 rounded-sm">
                            {rfqs.filter(r => r.ai_error && r.ai_error.trim() !== '').length} Errors
                          </span>
                        ) : (
                          <span className="font-extrabold text-slate-500 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded-sm">
                            0 Errors
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setIsInfoModalOpen(false);
                  if (onNavigateView) onNavigateView('system_settings');
                }}
                className="px-4 py-2 backdrop-blur-sm bg-white/50 hover:bg-white/80 border border-white/70 ring-1 ring-blue-200/60 hover:ring-blue-400/60 text-blue-700 font-extrabold text-xs cursor-pointer rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Advanced Settings</span>
              </button>

              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs cursor-pointer rounded-md shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
