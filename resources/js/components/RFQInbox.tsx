// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RFQ, RFQStatus, EmailAttachment, isOutboundEmail } from '../types/erp';
import { Search, Mail, Send, CheckCircle2, Clock, Building, User, Phone, Loader2, Paperclip, Eye, ShieldCheck, RefreshCw, PlusCircle, FileType, Image as ImageIcon, Maximize2, AlertTriangle, X, ExternalLink, ChevronDown, ChevronUp, MoreVertical, Menu, Sparkles, Settings, Info, ArrowRightLeft, Copy, Download, Terminal, FileText, Trash2, Ban, ShieldAlert, ArrowUpRight, Folder } from 'lucide-react';
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

const bodyCleanCache = new Map<string, string>();
const cleanEmailBodyText = (text: string): string => {
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

  // Live Daemon Log Viewer States
  const [isLogViewerOpen, setIsLogViewerOpen] = useState<boolean>(false);
  const [logFiles, setLogFiles] = useState<any[]>([]);
  const [dbErrors, setDbErrors] = useState<any[]>([]);
  const [activeLogTab, setActiveLogTab] = useState<string>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Delete & Blacklist Modal State
  const [deleteModalRfq, setDeleteModalRfq] = useState<RFQ | null>(null);
  const [deleteType, setDeleteType] = useState<'delete_only' | 'blacklist'>('delete_only');
  const [blacklistReason, setBlacklistReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleOpenDeleteModal = (rfq: RFQ) => {
    setDeleteModalRfq(rfq);
    setDeleteType('delete_only');
    setBlacklistReason('');
  };

  const handleConfirmDelete = () => {
    if (!deleteModalRfq) return;
    if (deleteType === 'blacklist' && !blacklistReason.trim()) {
      alert('Please enter a blacklist reason for AI & automated filtering.');
      return;
    }

    setIsDeleting(true);
    fetch(getApiUrl('/api_rfq_status.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfq_id: deleteModalRfq.id,
        action: 'delete_rfq',
        delete_type: deleteType,
        reason: blacklistReason.trim(),
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsDeleting(false);
        if (data.status === 'success') {
          setNotificationText(
            deleteType === 'blacklist'
              ? `Sender ${deleteModalRfq.sender_email} has been permanently blacklisted. Future emails will be rejected automatically!`
              : `RFQ from ${deleteModalRfq.sender_name} moved to deleted status.`
          );
          setShowNotificationBanner(true);
          setTimeout(() => setShowNotificationBanner(false), 5000);
          setDeleteModalRfq(null);
          if (onRefreshLiveEmails) {
            onRefreshLiveEmails();
          }
        } else {
          alert('Failed to delete: ' + (data.message || 'System error occurred'));
        }
      })
      .catch((err) => {
        setIsDeleting(false);
        console.error('Delete RFQ error:', err);
        alert('Connection error occurred while deleting RFQ.');
      });
  };

  // ACC Approval Confirmation Modal State
  const [accModalRfq, setAccModalRfq] = useState<RFQ | null>(null);
  const [accNote, setAccNote] = useState<string>('');
  const [isGrantingAcc, setIsGrantingAcc] = useState<boolean>(false);

  const handleTriggerReply = (rfq: RFQ) => {
    if (rfq.quotation_id && !rfq.is_acc_approved && rfq.quotation_status !== 'approved' && rfq.quotation_status !== 'acc' && rfq.quotation_status !== 'done_send') {
      setAccModalRfq(rfq);
      setAccNote('');
      return;
    }
    onOpenEmailReply(rfq);
  };

  const handleConfirmAcc = () => {
    if (!accModalRfq) return;
    setIsGrantingAcc(true);
    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        id: accModalRfq.quotation_id,
        rfq_id: accModalRfq.id,
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com',
        note: accNote.trim() || 'Approved via Client Chat fast-track',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsGrantingAcc(false);
        if (data.status === 'success') {
          accModalRfq.is_acc_approved = true;
          accModalRfq.quotation_status = 'approved';
          const target = accModalRfq;
          setAccModalRfq(null);
          setNotificationText(`Quotation ${target.quotation_number || ''} approved (ACC)! Opening email reply editor...`);
          setShowNotificationBanner(true);
          setTimeout(() => setShowNotificationBanner(false), 4000);
          onOpenEmailReply(target);
          if (onRefreshLiveEmails) onRefreshLiveEmails();
        } else {
          alert('Failed to grant ACC approval: ' + (data.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsGrantingAcc(false);
        console.error(err);
        alert('Connection error while granting ACC approval.');
      });
  };

  const fetchLiveLogs = () => {
    setIsLoadingLogs(true);
    fetch(getApiUrl('/api_daemons.php?action=get_logs'))
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setLogFiles(data.log_files || []);
          setDbErrors(data.db_errors || []);
        }
      })
      .catch(err => console.error('Error fetching live logs:', err))
      .finally(() => setIsLoadingLogs(false));
  };

  const handleMoveToRequisition = (rfq: RFQ) => {
    if (!rfq) return;
    setIsOcrProcessing(true);
    const subj = rfq.subject || rfq.rfq_number || rfq.sender_name || 'RFQ';
    setNotificationText(`Processing "${subj}" & linking Quotation...`);
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
          setNotificationText(`Quotation ${resData.quotation?.quotation_number || ''} linked successfully!`);
          setShowNotificationBanner(true);
          if (onRefreshLiveEmails) {
            onRefreshLiveEmails();
          }
        } else {
          setNotificationText(`Info: ${resData.message || 'Failed to process'}`);
          setShowNotificationBanner(true);
        }
      })
      .catch((err) => {
        console.error('Error moving RFQ:', err);
        setNotificationText('Failed to contact server.');
        setShowNotificationBanner(true);
      })
      .finally(() => {
        setIsOcrProcessing(false);
        setTimeout(() => setShowNotificationBanner(false), 3500);
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
            if (item.credential_key === 'INBOX_RULE_START_DATE') {
              rules.startDate = item.credential_value || '';
              rules.fetchStartDate = item.credential_value || '';
            }
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

  const uniqueRecipients = useMemo(() => [
    'all',
    ...Array.from(
      new Set(
        (rfqs || [])
          .map((r) => (r.recipient_email || 'abmalayaindustry@gmail.com').toLowerCase())
          .filter(Boolean)
      )
    ),
  ], [rfqs]);

  const parsedStartDateLimit = useMemo(() => {
    if (!inboxRules.fetchStartDate) return null;
    const limitTime = new Date(inboxRules.fetchStartDate + 'T00:00:00').getTime();
    return isNaN(limitTime) ? null : limitTime;
  }, [inboxRules.fetchStartDate]);

  const parsedCutoffDate = useMemo(() => {
    if (!inboxRules.startDate) return null;
    const parts = inboxRules.startDate.split('-');
    const cutoffDate = parts.length === 3
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0)
      : new Date(inboxRules.startDate);
    const time = cutoffDate.getTime();
    return isNaN(time) ? null : time;
  }, [inboxRules.startDate]);

  const satisfiesInboxFilter = useCallback((item: RFQ, targetSubTab: 'detected' | 'unrecognized') => {
    if (!item) return false;
    const sender = (item.sender_email || '').toLowerCase();
    const subject = (item.subject || '').toLowerCase();
    const name = (item.sender_name || '').toLowerCase();

    // MySQL Inbox Rules
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

    if (parsedStartDateLimit !== null) {
      const itemDateStr = item.created_at || item.received_at || item.date || (item as any).date_received;
      if (itemDateStr) {
        const itemTime = new Date(itemDateStr).getTime();
        if (!isNaN(itemTime) && itemTime < parsedStartDateLimit) {
          return false;
        }
      }
    }

    if (parsedCutoffDate !== null) {
      const rawDateStr = (item as any).date_received || (item as any).created_at || item.date || '';
      if (rawDateStr) {
        const emailDate = new Date(rawDateStr).getTime();
        if (!isNaN(emailDate) && emailDate < parsedCutoffDate) {
          return false;
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
    if (term) {
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
      if (!matchesSearch) return false;
    }

    const isDetected = isDetectedClientEmail(item);
    const matchesSubTab = targetSubTab === 'detected' ? isDetected : !isDetected;
    if (!matchesSubTab) return false;

    const st = (item.status || 'masuk').toLowerCase();

    // Statuses that mean email was moved into active quotation building:
    const isInProgress =
      st === 'in_progress' || st === 'diproses' || st === 'quotation_build' || st === 'requisition';

    // Statuses that mean quotation was sent to client:
    const isSent =
      st === 'penawaran_terkirim' || st === 'siap_kirim' ||
      st === 'ready_to_send' || st === 'terkirim' || st === 'sent';

    // Statuses that mean closed / done deal:
    const isDone =
      st === 'deal' || st === 'selesai' || st === 'done' ||
      st === 'done_send' || st === 'disetujui' || st === 'acc';

    const isConvertedToQuotation = isInProgress || isSent || isDone;

    if (activeMainTab === 'error') {
      return Boolean(item.ai_error && item.ai_error.trim() !== '');
    }
    if (activeMainTab === 'received') {
      return !isConvertedToQuotation;
    }
    if (activeMainTab === 'diproses') {
      return isInProgress;
    }
    if (activeMainTab === 'siap_kirim') {
      return isSent;
    }
    if (activeMainTab === 'done') {
      return isDone;
    }

    return true;
  }, [inboxRules, parsedStartDateLimit, parsedCutoffDate, selectedToFilter, searchTerm, activeMainTab]);

  const errorCount = useMemo(() => {
    return (rfqs || []).filter((r) => r.ai_error && r.ai_error.trim() !== '').length;
  }, [rfqs]);

  const { detectedCount, unrecognizedCount, filteredRfqs } = useMemo(() => {
    let dCount = 0;
    let uCount = 0;
    const filtered: RFQ[] = [];

    const list = rfqs || [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const isDet = satisfiesInboxFilter(item, 'detected');
      if (isDet) dCount++;
      const isUnrec = satisfiesInboxFilter(item, 'unrecognized');
      if (isUnrec) uCount++;

      if (activeSubTab === 'detected' && isDet) {
        filtered.push(item);
      } else if (activeSubTab === 'unrecognized' && isUnrec) {
        filtered.push(item);
      }
    }

    if (inboxRules.prioritizePdf) {
      filtered.sort((a, b) => {
        const aHasPdf = a.attachments && a.attachments.some((att) => (att.filename || '').toLowerCase().endsWith('.pdf'));
        const bHasPdf = b.attachments && b.attachments.some((att) => (att.filename || '').toLowerCase().endsWith('.pdf'));
        const aHasGdrive = a.attachments && a.attachments.some((att) => att.is_gdrive);
        const bHasGdrive = b.attachments && b.attachments.some((att) => att.is_gdrive);
        const aHasFile = aHasPdf || aHasGdrive;
        const bHasFile = bHasPdf || bHasGdrive;
        if (aHasFile && !bHasFile) return -1;
        if (!aHasFile && bHasFile) return 1;
        return 0;
      });
    }

    return { detectedCount: dCount, unrecognizedCount: uCount, filteredRfqs: filtered };
  }, [rfqs, activeSubTab, satisfiesInboxFilter, inboxRules.prioritizePdf]);

  const totalPages = Math.ceil(filteredRfqs.length / itemsPerPage) || 1;
  const paginatedRfqs = useMemo(() => {
    return filteredRfqs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRfqs, currentPage, itemsPerPage]);

  const selectedRfq = useMemo(() => {
    return filteredRfqs.find((r) => r.id === selectedRfqId) || filteredRfqs[0] || null;
  }, [filteredRfqs, selectedRfqId]);

  const getAttachmentPreviewUrl = (att: EmailAttachment | null) => {
    if (!att) return '';
    if (att.url) {
      let cleanUrl = att.url;
      // Strip localhost:8000 / 127.0.0.1:8000 if present so it works seamlessly on tunnel / production domain
      cleanUrl = cleanUrl.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1):8000/, '');
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return cleanUrl;
      }
      return getApiUrl(cleanUrl);
    }
    const rfqIdClean = selectedRfq?.id ? String(selectedRfq.id).replace(/[^0-9]/g, '') : '';
    const msgno = (selectedRfq as any)?.msgno || (selectedRfq as any)?.db_id || rfqIdClean || '';
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
    if (rfq.quotation_id) {
      setNotificationText(`Quotation ${rfq.quotation_number || ''} sudah terhubung ke percakapan ini.`);
      setShowNotificationBanner(true);
      setTimeout(() => setShowNotificationBanner(false), 3000);
      return;
    }
    // Directly process and open Quotation Builder
    handleDirectProcessQuotation(rfq);
  };

  const handleDirectProcessQuotation = (targetRfq: RFQ) => {
    setIsOcrProcessing(true);

    const uniqueQuoId = targetRfq.quotation_id || `QUO-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const quoNumber = targetRfq.quotation_number || `QUO-ABM/MY/2026/0${Math.floor(Math.random() * 900 + 100)}`;
    const rfqRefId = (targetRfq as any).db_id || targetRfq.id;

    const isTargetOutbound = isOutboundEmail(targetRfq);
    const targetClientEmail = isTargetOutbound
      ? (targetRfq.recipient_email || targetRfq.sender_email)
      : targetRfq.sender_email;
    const targetClientName = isTargetOutbound
      ? (targetRfq.recipient_email ? targetRfq.recipient_email.split('@')[0].toUpperCase() : 'Partner Client')
      : targetRfq.sender_name;
    const targetCompanyName = isTargetOutbound
      ? (targetRfq.recipient_email ? targetRfq.recipient_email.split('@')[1] : 'Partner Enterprise')
      : (targetRfq.company || targetRfq.sender_name);

    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: uniqueQuoId,
        rfq_id: rfqRefId,
        quotation_number: quoNumber,
        client_name: targetClientName,
        client_email: targetClientEmail,
        company_name: targetCompanyName,
        date_issued: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        items: [
          {
            id: 'item-autogen-1',
            description: targetRfq.item_requested || 'Industrial Equipment Specification',
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
        notes: `Extracted from RFQ: ${targetRfq.subject || targetRfq.message_body}`,
        user_name: currentUser?.name || 'Admin',
        user_email: currentUser?.email || 'admin@abmalaya.com',
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'error') {
          const errMsg = 'Validasi 2-Arah Gagal: ' + (resData.message || 'MySQL Error saat menyimpan Quotation.');
          targetRfq.ai_error = errMsg;
          alert(errMsg);
          return;
        }
        // Validated 2-way: Quotation successfully created!
        targetRfq.quotation_id = resData.id || targetRfq.quotation_id;
        targetRfq.quotation_number = resData.quotation_number || targetRfq.quotation_number;
        targetRfq.status = 'diproses';
        targetRfq.ai_error = null;
        if (onUpdateRfqStatus) {
          onUpdateRfqStatus(targetRfq.id, 'in_progress');
        }
        setNotificationText(`RFQ from ${targetRfq.sender_name} valid terhubung ke Quotation! Membuka Quotation Builder...`);
        setShowNotificationBanner(true);
        setTimeout(() => setShowNotificationBanner(false), 4000);
        onCreateQuotationFromRfq(targetRfq);
      })
      .catch((err) => {
        console.error('Error saving quotation to MySQL:', err);
        const netErr = 'Validasi 2-Arah Gagal: Terputus dari basis data MySQL saat memproses Quotation.';
        targetRfq.ai_error = netErr;
        alert(netErr);
      })
      .finally(() => {
        setIsOcrProcessing(false);
      });
  };

  const handleConfirmQuotationCreation = () => {
    if (!pendingConfirmRfq) return;
    handleDirectProcessQuotation(pendingConfirmRfq);
    setPendingConfirmRfq(null);
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
                <span className="bg-amber-500 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded">
                  {filteredRfqs.length}
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

            {/* Filter Tabs: To Dropdown | Status Dropdown */}
            <div className="flex gap-1.5 border-b border-slate-200 pb-1.5 text-xs pt-1 items-center w-full justify-between">
              
              {/* FILTER TO DROP-DOWN */}
              <div className="relative">
                <button
                  onClick={() => setIsToFilterOpen(!isToFilterOpen)}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-md transition cursor-pointer flex items-center gap-1 border ${
                    selectedToFilter !== 'all'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
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

              {/* STATUS DROPDOWN (Received, In Progress, Sent / Replied, Done, Errors) */}
              <div className="relative ml-auto shrink-0">
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-md transition cursor-pointer flex items-center gap-1 border ${
                    activeMainTab === 'error'
                      ? 'bg-rose-600 text-white shadow-2xs border-rose-700'
                      : activeMainTab === 'received'
                      ? 'bg-blue-600 text-white shadow-2xs border-blue-700'
                      : 'bg-indigo-600 text-white shadow-2xs border-indigo-700'
                  }`}
                  style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}
                  title="Filter by status: Received, In Progress, Sent, Done, Daemon Errors"
                >
                  <span>
                    {activeMainTab === 'received'
                      ? 'Status: Received'
                      : activeMainTab === 'diproses'
                      ? 'Status: In Progress'
                      : activeMainTab === 'siap_kirim'
                      ? 'Status: Sent / Replied'
                      : activeMainTab === 'error'
                      ? `Status: Errors (${errorCount})`
                      : 'Status: Done'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-white/80" />
                </button>

                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-300 shadow-lg rounded-md overflow-hidden z-50 py-1 font-sans text-xs">
                      {[
                        { id: 'received', label: 'Received' },
                        { id: 'diproses', label: 'In Progress' },
                        { id: 'siap_kirim', label: 'Sent / Replied' },
                        { id: 'done', label: 'Done' },
                        { id: 'error', label: `Errors / Daemon Issues ${errorCount > 0 ? `(${errorCount})` : ''}`, isError: true },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setActiveMainTab(st.id);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 transition cursor-pointer font-bold flex items-center justify-between ${
                            st.isError
                              ? 'text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border-t border-rose-100'
                              : activeMainTab === st.id
                              ? 'text-blue-600 bg-blue-50/50'
                              : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {st.isError && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                            <span>{st.label}</span>
                          </div>
                          {activeMainTab === st.id && <span className="text-blue-600 font-extrabold">✓</span>}
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
                <span>RECEIVED ({detectedCount})</span>
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
                <span>OTHERS ({unrecognizedCount})</span>
              </button>
            </div>

            {errorCount > 0 && activeMainTab !== 'error' && (
              <div className="px-3 pb-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setActiveMainTab('error')}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-bold rounded cursor-pointer transition shadow-2xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">{errorCount} Error Daemon / Validasi Terdeteksi</span>
                  </div>
                  <span className="bg-rose-600 text-white px-1.5 py-0.5 rounded font-extrabold text-[9px] shrink-0">Lihat List</span>
                </button>
              </div>
            )}

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
                    {(() => {
                      const isItemOutbound = isOutboundEmail(item);
                      return (
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="min-w-0 pr-2">
                            {isItemOutbound ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.2 text-[8px] font-black rounded-xs bg-purple-700 text-white uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                                    <ArrowUpRight className="w-2.5 h-2.5" />
                                    SENT
                                  </span>
                                  <h3 className="font-bold text-xs text-slate-900 truncate" title={`Kepada: ${item.recipient_email || 'Klien / Rekanan'}`}>
                                    To: <span className="text-purple-950 font-extrabold">{item.recipient_email || 'Klien / Rekanan'}</span>
                                  </h3>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium truncate">
                                  Dari: {item.sender_name || item.sender_email}
                                </div>
                              </div>
                            ) : (
                              <h3 className="font-bold text-xs text-slate-900 truncate pr-4">
                                {item.company || item.sender_name}
                              </h3>
                            )}
                          </div>
                          
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
                                      <span>Process to Quotation</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveListKebabId(null);
                                        onSelectRfq(item);
                                        handleTriggerReply(item);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-left border-t border-slate-100"
                                    >
                                      {isItemOutbound ? (
                                        <>
                                          <ArrowUpRight className="w-3.5 h-3.5 text-purple-600" />
                                          <span>Teruskan / Follow-up</span>
                                        </>
                                      ) : (
                                        <>
                                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Reply Email</span>
                                        </>
                                      )}
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
                      );
                    })()}

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
                        } else if (st === 'deleted') {
                          labelText = item.is_blacklisted ? 'Blacklisted (Mesin Abaikan)' : 'Deleted';
                          badgeClass = 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold';
                        }
                        return (
                          <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-sm border uppercase ${badgeClass}`}>
                            DB Status: {labelText}
                          </span>
                        );
                      })()}

                      {item.blacklist_reason && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-sm border bg-amber-50 text-amber-900 border-amber-300" title={item.blacklist_reason}>
                          Alasan: {item.blacklist_reason}
                        </span>
                      )}

                      {item.ai_error && item.ai_error.trim() !== '' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiErrorModalData(item);
                          }}
                          className="px-1.5 py-0.2 text-[9px] font-extrabold rounded-sm border bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          title={`Error Log: ${item.ai_error}`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span className="truncate max-w-[140px]">Error: {item.ai_error}</span>
                        </button>
                      )}

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
                  
                  {/* SPH ACC Status Badge in Chat Header */}
                  {selectedRfq.quotation_number && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedRfq.is_acc_approved && selectedRfq.quotation_status !== 'approved' && selectedRfq.quotation_status !== 'acc' && selectedRfq.quotation_status !== 'done_send') {
                          setAccModalRfq(selectedRfq);
                          setAccNote('');
                        } else if (onNavigateView) {
                          onNavigateView('quotation_list');
                        }
                      }}
                      className={`flex items-center gap-1.5 ${
                        selectedRfq.is_acc_approved || selectedRfq.quotation_status === 'approved' || selectedRfq.quotation_status === 'acc' || selectedRfq.quotation_status === 'done_send'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      } border font-extrabold text-xs px-3 py-1.5 rounded-md shadow-xs cursor-pointer transition`}
                      title="Status ACC Approval Quotation"
                    >
                      <span>
                        {selectedRfq.is_acc_approved || selectedRfq.quotation_status === 'approved' || selectedRfq.quotation_status === 'acc' || selectedRfq.quotation_status === 'done_send'
                          ? '✓ Quotation ACC Approved'
                          : '⚠️ Quotation Belum di-ACC'}
                      </span>
                      <span className="text-[10px] font-mono opacity-80">({selectedRfq.quotation_number})</span>
                    </button>
                  )}

                  {/* Process RFQ to Quotation Button (Only shown if quotation not created yet) */}
                  {!selectedRfq.quotation_number && (
                    <button
                      onClick={() => handleProcessRfqClick(selectedRfq)}
                      className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-md border border-[#0060b0] shadow-sm cursor-pointer transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      <span>Process RFQ to Quotation</span>
                    </button>
                  )}

                  {/* More Actions Kebab */}

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
                          {(() => {
                            const isSelectedOutbound = isOutboundEmail(selectedRfq);
                            return (
                              <button
                                onClick={() => {
                                  setIsPreviewActionsOpen(false);
                                  handleTriggerReply(selectedRfq);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                              >
                                {isSelectedOutbound ? (
                                  <>
                                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>Teruskan / Follow-up</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Reply Email</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
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
                    <span><strong>To:</strong> <span className="font-bold text-emerald-900">{selectedRfq.recipient_email || 'abmalayaindustry@gmail.com'}</span></span>
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
            <div className="flex-1 bg-slate-900 p-0 overflow-hidden flex items-center justify-center relative">
              {(() => {
                const u = previewAttachment.original_url || previewAttachment.url || '';
                const gdriveFolderId = (() => {
                  const m = u.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                  if (m) return m[1];
                  const qm = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                  if (qm && previewAttachment.is_folder) return qm[1];
                  if (previewAttachment.id && previewAttachment.id.startsWith('gdrive-') && previewAttachment.is_folder) {
                    return previewAttachment.id.replace('gdrive-', '');
                  }
                  return '';
                })();

                const gdriveFileId = (() => {
                  const m = u.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([a-zA-Z0-9_-]+)/);
                  if (m) return m[1];
                  const qm = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                  if (qm && !previewAttachment.is_folder) return qm[1];
                  if (previewAttachment.id && previewAttachment.id.startsWith('gdrive-') && !previewAttachment.is_folder) {
                    return previewAttachment.id.replace('gdrive-', '');
                  }
                  return '';
                })();

                // 1. Google Drive Folder Live View
                if (previewAttachment.is_folder || (previewAttachment.is_gdrive && gdriveFolderId)) {
                  const targetFolderId = gdriveFolderId || (previewAttachment.id ? previewAttachment.id.replace('gdrive-', '') : '');
                  return (
                    <div className="w-full h-full flex flex-col bg-slate-900">
                      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-xs text-slate-200 shrink-0">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-amber-400" />
                          <span className="font-bold text-white">Google Drive Folder Viewer</span>
                          <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/60 px-1.5 py-0.5 rounded font-mono">Interactive Web View</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (u) {
                                navigator.clipboard.writeText(u);
                                alert("Link folder Google Drive disalin ke clipboard!");
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Link</span>
                          </button>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Buka di Google Drive Tab Baru</span>
                          </a>
                        </div>
                      </div>
                      <div className="flex-1 w-full h-full bg-white relative">
                        <iframe
                          src={`https://drive.google.com/embeddedfolderview?id=${targetFolderId}#grid`}
                          className="w-full h-full border-none bg-white"
                          title="Google Drive Folder Explorer"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                        />
                      </div>
                    </div>
                  );
                }

                // 2. Google Drive Single File (Not Yet Downloaded)
                if (previewAttachment.is_gdrive && !previewAttachment.downloaded && gdriveFileId) {
                  return (
                    <div className="w-full h-full flex flex-col bg-slate-900">
                      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-xs text-slate-200 shrink-0">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-blue-400" />
                          <span className="font-bold text-white truncate max-w-sm">{previewAttachment.filename}</span>
                          <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/60 px-1.5 py-0.5 rounded font-mono">Google Drive Cloud Preview</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadAttachment(previewAttachment)}
                            disabled={downloadingAttachmentId !== null}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            {downloadingAttachmentId !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            <span>Download ke Server</span>
                          </button>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Buka di Tab Baru</span>
                          </a>
                        </div>
                      </div>
                      <div className="flex-1 w-full h-full bg-white relative">
                        <iframe
                          src={`https://drive.google.com/file/d/${gdriveFileId}/preview`}
                          className="w-full h-full border-none bg-white"
                          title="Google Drive Document Viewer"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                        />
                      </div>
                    </div>
                  );
                }

                // 3. Downloaded Excel / Spreadsheet File
                const fnLower = (previewAttachment.filename || '').toLowerCase();
                const isExcel = fnLower.endsWith('.xlsx') || fnLower.endsWith('.xls') || fnLower.endsWith('.csv');
                if (isExcel) {
                  const fileUrl = getAttachmentPreviewUrl(previewAttachment);
                  return (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-800 text-white space-y-4 max-w-md mx-auto rounded-lg border border-slate-700 shadow-xl text-center">
                      <div className="w-16 h-16 bg-emerald-900/40 text-emerald-400 border border-emerald-800 rounded-full flex items-center justify-center shadow-lg">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white" style={{ fontFamily: "'Eurostile', monospace" }}>
                          {previewAttachment.filename}
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          File Spreadsheet Excel tersimpan di server ({previewAttachment.filesize}).
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center pt-2">
                        <a
                          href={fileUrl}
                          download={previewAttachment.filename}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          <span>Unduh File Excel</span>
                        </a>
                        {u && (
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Buka Link Asli</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                }

                // 4. PDF Document Viewer
                if (fnLower.endsWith('.pdf')) {
                  const pdfUrl = getAttachmentPreviewUrl(previewAttachment);
                  return (
                    <object
                      data={pdfUrl}
                      type="application/pdf"
                      className="w-full h-full border-none shadow-lg bg-white"
                    >
                      <iframe
                        src={pdfUrl}
                        className="w-full h-full border-none shadow-lg bg-white"
                        title="PDF Attachment Viewer"
                      >
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-700 bg-slate-50">
                          <p className="font-bold text-xs mb-2">Browser Anda memblokir preview PDF langsung.</p>
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs inline-flex items-center gap-1.5 transition"
                          >
                            Buka Dokumen PDF di Tab Baru
                          </a>
                        </div>
                      </iframe>
                    </object>
                  );
                }

                // 5. Image Viewer
                return (
                  <img
                    src={getAttachmentPreviewUrl(previewAttachment)}
                    alt={previewAttachment.filename || 'Attachment'}
                    className="max-w-full max-h-full object-contain shadow-2xl"
                  />
                );
              })()}
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
                    <span>Sent Email Reply (Outbound Quotation)</span>
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

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = aiErrorModalData;
                  setAiErrorModalData(null);
                  if (target) {
                    target.ai_error = null;
                    handleDirectProcessQuotation(target);
                  }
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer rounded-md shadow-sm transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Validasi Ulang & Buat Quotation</span>
              </button>

              <button
                onClick={() => setAiErrorModalData(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs cursor-pointer rounded-md shadow-sm transition"
              >
                Tutup
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
                      <td className="py-2.5 font-mono flex items-center justify-between">
                        {rfqs.filter(r => r.ai_error && r.ai_error.trim() !== '').length > 0 ? (
                          <span className="font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-200 rounded-sm">
                            {rfqs.filter(r => r.ai_error && r.ai_error.trim() !== '').length} Errors
                          </span>
                        ) : (
                          <span className="font-extrabold text-slate-500 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded-sm">
                            0 Errors
                          </span>
                        )}
                        <button
                          onClick={() => {
                            fetchLiveLogs();
                            setIsLogViewerOpen(true);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-slate-100 font-extrabold text-[11px] rounded flex items-center gap-1 cursor-pointer transition"
                        >
                          <Terminal className="w-3 h-3 text-emerald-400" />
                          <span>View Full Logs</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsInfoModalOpen(false);
                    if (onNavigateView) onNavigateView('system_settings');
                  }}
                  className="px-3.5 py-1.5 backdrop-blur-sm bg-white/50 hover:bg-white/80 border border-white/70 ring-1 ring-blue-200/60 hover:ring-blue-400/60 text-blue-700 font-extrabold text-xs cursor-pointer rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Advanced Settings</span>
                </button>

                <button
                  onClick={() => {
                    fetchLiveLogs();
                    setIsLogViewerOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-200" />
                  <span>View Full Logs</span>
                </button>
              </div>

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

      {/* Terminal Live Log Viewer Modal */}
      {isLogViewerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[99999] backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-slate-950 px-5 py-3.5 flex items-center justify-between border-b border-slate-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                    <span>System Activity & Background Logs</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">System Active</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Activity overview for email processing and document scanning</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchLiveLogs}
                  disabled={isLoadingLogs}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                  <span>{isLoadingLogs ? 'Refreshing...' : 'Refresh Logs'}</span>
                </button>
                <button
                  onClick={() => setIsLogViewerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer rounded-lg border border-transparent hover:border-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Header Tabs */}
            <div className="bg-slate-950/60 px-5 py-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveLogTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeLogTab === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Log Files ({logFiles.length})</span>
              </button>

              {logFiles.map((lf) => (
                <button
                  key={lf.file}
                  onClick={() => setActiveLogTab(lf.file)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeLogTab === lf.file
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3 h-3 text-blue-400" />
                  <span>{lf.file}</span>
                </button>
              ))}

              <button
                onClick={() => setActiveLogTab('db_errors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ml-auto ${
                  activeLogTab === 'db_errors'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Database Errors ({dbErrors.length})</span>
              </button>
            </div>

            {/* Log Content Area */}
            <div className="flex-1 p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-y-auto space-y-4">
              {isLoadingLogs ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="font-sans font-bold">Loading live execution logs from server...</p>
                </div>
              ) : activeLogTab === 'db_errors' ? (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-extrabold text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>MySQL Database Trace Errors ({dbErrors.length})</span>
                    </h4>
                  </div>
                  {dbErrors.length === 0 ? (
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="font-bold">No AI errors recorded in database!</p>
                    </div>
                  ) : (
                    dbErrors.map((err, idx) => (
                      <div key={idx} className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl font-mono text-xs text-rose-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-bold text-rose-300">RFQ #{err.rfq_number}</span>
                          <span>{err.created_at}</span>
                        </div>
                        <p className="font-semibold text-slate-200 font-sans">{err.subject}</p>
                        <p className="text-rose-400 bg-slate-900/90 p-2 rounded border border-rose-900/60 whitespace-pre-wrap">{err.error}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {logFiles
                    .filter((lf) => activeLogTab === 'all' || activeLogTab === lf.file)
                    .map((lf) => (
                      <div key={lf.file} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/90 shadow-lg">
                        <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700/60 text-slate-300 font-sans text-xs">
                          <div className="flex items-center gap-2 font-mono">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-bold text-slate-100">{lf.file}</span>
                            <span className="text-[10px] text-slate-400">({lf.mtime})</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(lf.content);
                              alert(`Copied ${lf.file} content to clipboard!`);
                            }}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="p-4 text-[11px] leading-relaxed overflow-x-auto text-emerald-300/90 whitespace-pre-wrap font-mono">
                          {lf.content || 'Log file is empty.'}
                        </pre>
                      </div>
                    ))}
                  {logFiles.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-sans">
                      <p className="font-bold">No log files found in daemon/logs directory yet.</p>
                      <p className="text-xs text-slate-500 mt-1">Run daemon tasks to generate execution log files.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono text-[11px] text-slate-500">Log Directory: /daemon/logs/*.log</span>
              <button
                onClick={() => setIsLogViewerOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs cursor-pointer rounded-lg transition"
              >
                Close Terminal
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ACC Approval Confirmation Modal */}
      {accModalRfq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-sm">Konfirmasi ACC Approval Quotation</h3>
              </div>
              <button
                type="button"
                onClick={() => setAccModalRfq(null)}
                className="text-white/80 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                <strong>Quotation No: {accModalRfq.quotation_number || 'Draft'}</strong> for client{' '}
                <strong>{accModalRfq.sender_name || accModalRfq.company || 'Client'}</strong>
                {accModalRfq.quotation_grand_total
                  ? ` with total RM ${Number(accModalRfq.quotation_grand_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : ''}{' '}
                has not been approved yet (Pending ACC Approval).
              </p>

              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-amber-900 leading-relaxed rounded-r-md text-[11px]">
                In accordance with system policy, Quotation requires management ACC approval before being dispatched to the client via email.
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 text-[11px]">ACC Approval Notes (Optional):</label>
                <textarea
                  value={accNote}
                  onChange={(e) => setAccNote(e.target.value)}
                  placeholder="e.g., Approved by management via expedited fast-track..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccModalRfq(null);
                  if (onNavigateView) onNavigateView('quotation_list');
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded cursor-pointer"
              >
                Open in Quotation List
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isGrantingAcc}
                  onClick={() => setAccModalRfq(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isGrantingAcc}
                  onClick={handleConfirmAcc}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isGrantingAcc ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <span>✓ Grant ACC & Proceed to Send Email</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
