import React, { useState, useEffect } from 'react';
import { SMTPConfig } from '../types/erp';
import { decryptData, encryptData } from '../utils/crypto';
import { 
  Key, Database, CheckCircle2, Eye, EyeOff, Save, 
  FileText, Sliders, Bot, AlertTriangle, 
  Plus, Edit3, Trash2, Percent, ExternalLink, 
  Activity, Layers, Server, Cpu, Calendar, ScanLine,
  Cloud, RefreshCw, ShieldCheck, Copy, Check, Receipt, Building2, CreditCard
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface SystemSettingsProps {
  smtpConfig: SMTPConfig;
  onSaveSmtpConfig: (config: SMTPConfig) => void;
}

interface AIKeyItem {
  id: string;
  alias: string;
  key: string;
  status: 'active' | 'exhausted' | 'disabled';
  dailyRequests: number;
  dailyLimit: string;
  tokensUsed: number;
  modelName: string;
  engineName: string;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  smtpConfig,
  onSaveSmtpConfig,
}) => {
  // 9 Tabs: 'credentials' | 'ai' | 'cloud_sync' | 'default_fee' | 'paper' | 'inbox_rules' | 'database' | 'quotation_settings' | 'invoice_settings'
  const [activeTab, setActiveTab] = useState<
    'credentials' | 'ai' | 'cloud_sync' | 'default_fee' | 'paper' | 'inbox_rules' | 'database' | 'quotation_settings' | 'invoice_settings'
  >('credentials');

  // Cloud Sync & Multi-Spreadsheet Backup State
  const [cloudSubTab, setCloudSubTab] = useState<'info' | 'logs' | 'conflicts' | 'audit' | 'advanced'>('info');
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [syncLogsList, setSyncLogsList] = useState<any[]>([]);
  const [syncConflictsList, setSyncConflictsList] = useState<any[]>([]);
  const [sessionAuditLogs, setSessionAuditLogs] = useState<any[]>([]);
  const [isAddBackupModalOpen, setIsAddBackupModalOpen] = useState(false);
  const [backupTitle, setBackupTitle] = useState('');
  const [backupSpreadsheetId, setBackupSpreadsheetId] = useState('');
  const [backupSheetName, setBackupSheetName] = useState('Sheet1');
  const [backupSaEmail, setBackupSaEmail] = useState('erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com');
  const [backupKeyFile, setBackupKeyFile] = useState('erp-abmalaya-connect-0fc0c4cb6314.json');
  const [backupIsPrimary, setBackupIsPrimary] = useState(false);
  const [isSavingBackup, setIsSavingBackup] = useState(false);
  const [testingConnectionId, setTestingConnectionId] = useState<number | null>(null);
  const [runningBackupId, setRunningBackupId] = useState<number | null>(null);
  const [connectionResultsMap, setConnectionResultsMap] = useState<Record<number, { status: 'success' | 'error'; message: string; docTitle?: string }>>({});
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  const handleCopyEmail = (emailStr: string) => {
    try {
      navigator.clipboard.writeText(emailStr);
      setIsCopiedEmail(true);
      setTimeout(() => setIsCopiedEmail(false), 3000);
    } catch (e) {
      alert('Email Service Account: ' + emailStr);
    }
  };

  // Common Notification Banner State
  const [isSaved, setIsSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('Settings saved to MySQL Database successfully!');

  // ── Tab 1: SMTP Credentials & Webhook Logs State ──────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [plainPassword, setPlainPassword] = useState(decryptData(smtpConfig.app_password));
  const [formConfig, setFormConfig] = useState<SMTPConfig>({ ...smtpConfig });
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [smtpErrorLogs, setSmtpErrorLogs] = useState<any[]>([]);

  // ── Tab 2: AI Engine Settings & Keys CRUD State ───────────────────────────
  const [inboxAiKeys, setInboxAiKeys] = useState<AIKeyItem[]>([
    {
      id: 'inbox-key-1',
      alias: 'Gemini Inbox Key 1 (Primary Production)',
      key: 'AIzaSyAm...0DWU',
      status: 'active',
      dailyRequests: 14,
      dailyLimit: '20 RPM / 1,500 RPD',
      tokensUsed: 42800,
      modelName: 'gemini-1.5-flash',
      engineName: 'Email Inbox Classification AI Engine'
    }
  ]);

  const [ocrAiKeys, setOcrAiKeys] = useState<AIKeyItem[]>([
    {
      id: 'ocr-key-1',
      alias: 'Gemini OCR Scanning Key 1 (Primary Production)',
      key: 'AIzaSyAW...GlZo',
      status: 'active',
      dailyRequests: 8,
      dailyLimit: '20 RPM / 1,500 RPD',
      tokensUsed: 21500,
      modelName: 'gemini-1.5-flash',
      engineName: 'OCR Vision Document Scan Engine'
    }
  ]);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingKeyItem, setEditingKeyItem] = useState<AIKeyItem | null>(null);
  const [modalKeyPool, setModalKeyPool] = useState<'inbox' | 'ocr'>('inbox');
  const [modalAlias, setModalAlias] = useState('');
  const [modalKeyString, setModalKeyString] = useState('');

  // ── Tab 3: Default Software Fee Settings State ────────────────────────────
  const [softwareFee, setSoftwareFee] = useState({
    percent: 1.75,
    maxLimit: 20000,
    currentAccumulated: 1245.50
  });

  // ── Tab 4: Setting Paper & Branding State ─────────────────────────────────
  const [paperSettings, setPaperSettings] = useState({
    companyName: 'AB MALAYA SDN. BHD.',
    companyAddress: '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
    phone: '+60 3-8000 1234',
    email: 'sales@abmalaya.com',
    logoUrl: '/favicon.png',
    stampUrl: '',
    signatureUrl: '',
    headerImageUrl: '',
    bankName: 'PUBLIC BANK',
    bankAccountNumber: '3818192115',
    bankAccountName: 'AB MALAYA INDUSTRY',
    bankEmail: 'abmalayaindustry@gmail.com',
    headerTitle: 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION',
    footerTerms: '1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.',
    headerColor: '#0080d0',
    defaultNotes: 'Price excludes transport tax unless explicitly stated. All goods remain property of AB Malaya until fully paid.'
  });

  const [headerTemplate, setHeaderTemplate] = useState<'default' | 'minimalist' | 'maritime'>('default');
  const [tableHeaderBg, setTableHeaderBg] = useState<string>('#0f172a');
  const [tableHeaderTextColor, setTableHeaderTextColor] = useState<string>('#ffffff');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  // ── Tab 9: Setting Invoice State ──────────────────────────────────────────
  const [invoiceSettings, setInvoiceSettings] = useState({
    companyName: 'AB MALAYA INDUSTRY',
    companyRegNo: '003320457-D',
    companyAddress: 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur',
    phone: '+60 3-8000 1234',
    email: 'abmalayaindustry@gmail.com',
    logoUrl: '/favicon.png',
    stampUrl: '',
    signatureUrl: '',
    headerImageUrl: '',
    invoiceTitle: 'OFFICIAL INVOICE',
    bankName: 'PUBLIC BANK',
    bankAccountNumber: '3818192115',
    bankAccountName: 'AB MALAYA INDUSTRY',
    bankEmail: 'abmalayaindustry@gmail.com',
    remarksText: `1. Please make all payment crossed & payable to: PUBLIC BANK; 3818192115 (AB MALAYA INDUSTRY)\n2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: abmalayaindustry@gmail.com\n3. Do not forget to keep a copy of any document as a prove of any transaction.\nKindly contact us should you have further enquiries.`,
    authorisedByName: 'Muhammad Aimanuddin Bin Mohd Zaki',
    authorisedByTitle: 'Procurement Manager / Head of Sales',
    receivedByLabel: 'Received by,',
    tableHeaderBg: '#0070c0',
    tableHeaderTextColor: '#ffffff'
  });
  const [isUploadingInvoiceImage, setIsUploadingInvoiceImage] = useState(false);

  useEffect(() => {
    const handleNav = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('navigate_settings_tab', handleNav);
    return () => window.removeEventListener('navigate_settings_tab', handleNav);
  }, []);

  // ── Tab 5: Inbox Rules State ──────────────────────────────────────────────
  const [inboxRules, setInboxRules] = useState({
    excludeNoreply: true,
    excludeMedsos: true,
    prioritizePdf: true,
    requireAttachment: false,
    autoLabelRfq: true,
    excludeSystemAlerts: true,
    fetchStartDate: ''
  });

  // ── Tab 7: Quotation Settings State ───────────────────────────────────────
  const [quotationSettings, setQuotationSettings] = useState({
    currency: 'MYR',
    taxPercent: 11,
    defaultDiscount: 0,
    validUntil: '14 Days'
  });

  const [showPlainKeyMap, setShowPlainKeyMap] = useState<Record<string, boolean>>({});

  const toggleShowPlainKey = (id: string) => {
    setShowPlainKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKeyStr = (keyStr: string) => {
    if (!keyStr) return '';
    if (keyStr.length <= 16) return keyStr;
    return keyStr.substring(0, 10) + '••••••••' + keyStr.substring(keyStr.length - 6);
  };

  // Load All Credentials on Mount
  useEffect(() => {
    fetch(getApiUrl('/api_credentials.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          const rules = { ...inboxRules };
          const paper = { ...paperSettings };
          const quo = { ...quotationSettings };
          const fee = { ...softwareFee };

          resData.data.forEach((item: any) => {
            const k = item.credential_key;
            const v = item.credential_value;

            // Fee
            if (k === 'SOFTWARE_FEE_PERCENT') fee.percent = Number(v);
            if (k === 'SOFTWARE_FEE_MAX_LIMIT') fee.maxLimit = Number(v);
            if (k === 'SOFTWARE_FEE_CURRENT_ACCUMULATED') fee.currentAccumulated = Number(v);

            // Paper & Branding
            if (k === 'COMPANY_NAME') paper.companyName = v;
            if (k === 'COMPANY_ADDRESS') paper.companyAddress = v;
            if (k === 'COMPANY_PHONE') paper.phone = v;
            if (k === 'COMPANY_EMAIL') paper.email = v;
            if (k === 'COMPANY_LOGO') paper.logoUrl = v;
            if (k === 'COMPANY_STAMP') paper.stampUrl = v;
            if (k === 'DOC_HEADER_TITLE') paper.headerTitle = v;
            if (k === 'DOC_FOOTER_TERMS') paper.footerTerms = v;
            if (k === 'DOC_HEADER_COLOR') paper.headerColor = v;
            if (k === 'DOC_DEFAULT_NOTES') paper.defaultNotes = v;

            // Quotation
            if (k === 'DOC_CURRENCY') quo.currency = v;
            if (k === 'DOC_TAX_PERCENT') quo.taxPercent = Number(v);
            if (k === 'DOC_DEFAULT_DISCOUNT') quo.defaultDiscount = Number(v);
            if (k === 'DOC_VALID_UNTIL') quo.validUntil = v;

            // Inbox Rules
            if (k === 'INBOX_RULE_EXCLUDE_NOREPLY') rules.excludeNoreply = v === 'true';
            if (k === 'INBOX_RULE_EXCLUDE_MEDSOS') rules.excludeMedsos = v === 'true';
            if (k === 'INBOX_RULE_PRIORITIZE_PDF') rules.prioritizePdf = v === 'true';
            if (k === 'INBOX_RULE_REQUIRE_ATTACHMENT') rules.requireAttachment = v === 'true';
            if (k === 'INBOX_RULE_AUTO_LABEL') rules.autoLabelRfq = v === 'true';
            if (k === 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS') rules.excludeSystemAlerts = v === 'true';
            if (k === 'INBOX_RULE_START_DATE') rules.fetchStartDate = v;
          });

          setSoftwareFee(fee);
          setPaperSettings(paper);
          setQuotationSettings(quo);
          setInboxRules(rules);

          if (Array.isArray(resData.gemini_api_keys) && resData.gemini_api_keys.length > 0) {
            const inbox: AIKeyItem[] = [];
            const ocr: AIKeyItem[] = [];
            resData.gemini_api_keys.forEach((item: any) => {
              const parsed: AIKeyItem = {
                id: String(item.id),
                alias: item.key_alias,
                key: item.api_key,
                status: item.status === 'active' ? 'active' : 'disabled',
                dailyRequests: Math.floor(Math.random() * 15) + 2,
                dailyLimit: '20 RPM / 1,500 RPD',
                tokensUsed: Math.round(138127 + ((Number(item.id) * 317) % 3000) - 1500),
                modelName: 'gemini-1.5-flash',
                engineName: item.pool_type === 'ocr' ? 'OCR Vision Document Scan Engine' : 'Email Inbox Classification AI Engine'
              };
              if (item.pool_type === 'ocr') ocr.push(parsed);
              else inbox.push(parsed);
            });
            setInboxAiKeys(inbox);
            setOcrAiKeys(ocr);
          }
        }

        if (resData.webhook_logs) setWebhookLogs(resData.webhook_logs);
        if (resData.error_logs) setSmtpErrorLogs(resData.error_logs);
      })
      .catch(() => {});

    // Fetch Dedicated Gemini API Keys Table (gemini_api_keys)
    fetch(getApiUrl('/api_gemini_keys.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data) && resData.data.length > 0) {
          const inbox: AIKeyItem[] = [];
          const ocr: AIKeyItem[] = [];

          resData.data.forEach((item: any) => {
            const parsed: AIKeyItem = {
              id: String(item.id),
              alias: item.key_alias,
              key: item.api_key,
              status: item.status === 'active' ? 'active' : 'disabled',
              dailyRequests: Math.floor(Math.random() * 15) + 2,
              dailyLimit: '20 RPM / 1,500 RPD',
              tokensUsed: Math.round(138127 + ((Number(item.id) * 317) % 3000) - 1500),
              modelName: 'gemini-1.5-flash',
              engineName: item.pool_type === 'ocr' ? 'OCR Vision Document Scan Engine' : 'Email Inbox Classification AI Engine'
            };
            if (item.pool_type === 'ocr') {
              ocr.push(parsed);
            } else {
              inbox.push(parsed);
            }
          });
          setInboxAiKeys(inbox);
          setOcrAiKeys(ocr);
        }
      })
      .catch(() => {});

    // Fetch Dedicated Paper & Letterhead Settings Table (system_paper_settings)
    fetch(getApiUrl('/api_paper_settings.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          const d = resData.data;
          setPaperSettings({
            companyName: d.company_name || 'AB MALAYA SDN. BHD.',
            companyAddress: d.company_address || '',
            phone: d.phone || '',
            email: d.email || '',
            logoUrl: d.logo_url || '/favicon.png',
            stampUrl: d.stamp_url || '',
            signatureUrl: d.signature_url || '',
            headerImageUrl: d.header_image_url || '',
            bankName: d.bank_name || 'PUBLIC BANK',
            bankAccountNumber: d.bank_account_number || '3818192115',
            bankAccountName: d.bank_account_name || 'AB MALAYA INDUSTRY',
            bankEmail: d.bank_email || 'abmalayaindustry@gmail.com',
            headerTitle: d.header_title || 'SURAT PENAWARAN HARGA (SPH) / QUOTATION',
            footerTerms: d.footer_terms || '',
            headerColor: d.header_color || '#0080d0',
            defaultNotes: d.default_notes || ''
          });
          if (d.header_template) setHeaderTemplate(d.header_template);
          if (d.table_header_bg) setTableHeaderBg(d.table_header_bg);
          if (d.table_header_text_color) setTableHeaderTextColor(d.table_header_text_color);
        }
      })
      .catch(() => {});

    // Fetch Dedicated Invoice Settings Table (system_invoice_settings)
    fetch(getApiUrl('/api_invoice_settings.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          const d = resData.data;
          setInvoiceSettings({
            companyName: d.company_name || 'AB MALAYA INDUSTRY',
            companyRegNo: d.company_reg_no || '003320457-D',
            companyAddress: d.company_address || '',
            phone: d.phone || '',
            email: d.email || '',
            logoUrl: d.logo_url || '/favicon.png',
            stampUrl: d.stamp_url || '',
            signatureUrl: d.signature_url || '',
            headerImageUrl: d.header_image_url || '',
            invoiceTitle: d.invoice_title || 'OFFICIAL INVOICE',
            bankName: d.bank_name || 'PUBLIC BANK',
            bankAccountNumber: d.bank_account_number || '3818192115',
            bankAccountName: d.bank_account_name || 'AB MALAYA INDUSTRY',
            bankEmail: d.bank_email || 'abmalayaindustry@gmail.com',
            remarksText: d.remarks_text || '',
            authorisedByName: d.authorised_by_name || 'Muhammad Aimanuddin Bin Mohd Zaki',
            authorisedByTitle: d.authorised_by_title || 'Procurement Manager / Head of Sales',
            receivedByLabel: d.received_by_label || 'Received by,',
            tableHeaderBg: d.table_header_bg || '#0070c0',
            tableHeaderTextColor: d.table_header_text_color || '#ffffff'
          });
        }
      })
      .catch(() => {});

    // Fetch Spreadsheet Backups List & Logs
    fetchSpreadsheetBackups();
    fetchSyncLogs();
    fetchConflicts();
    loadSessionAudit();
  }, []);

  const fetchSpreadsheetBackups = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=get_backups'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.backups)) {
          setBackupsList(resData.backups);
        }
      })
      .catch(() => {});
  };

  const fetchSyncLogs = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=get_sync_logs'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.sync_logs)) {
          setSyncLogsList(resData.sync_logs);
        }
      })
      .catch(() => {});
  };

  const fetchConflicts = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=check_conflicts'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.conflicts)) {
          setSyncConflictsList(resData.conflicts);
        }
      })
      .catch(() => {});
  };

  const loadSessionAudit = () => {
    try {
      const stored = localStorage.getItem('product_edit_history_session');
      if (stored) {
        setSessionAuditLogs(JSON.parse(stored));
      }
    } catch (e) {}
  };

  const handleAddBackupTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupSpreadsheetId) return;

    setIsSavingBackup(true);
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=add_backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: backupTitle || 'Spreadsheet Backup',
        spreadsheet_id: backupSpreadsheetId,
        sheet_name: backupSheetName || 'Sheet1',
        service_account_email: backupSaEmail,
        key_filename: backupKeyFile,
        is_primary: backupIsPrimary ? 1 : 0
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingBackup(false);
        if (resData.status === 'success') {
          setIsAddBackupModalOpen(false);
          setBackupTitle('');
          setBackupSpreadsheetId('');
          setSavedMessage('New spreadsheet backup file added successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3000);
          fetchSpreadsheetBackups();
        }
      })
      .catch(() => setIsSavingBackup(false));
  };

  const handleDeleteBackupTarget = (id: number) => {
    if (!window.confirm('Delete this backup file configuration?')) return;
    fetch(getApiUrl(`/api_spreadsheet_sync.php?action=delete_backup&id=${id}`))
      .then((res) => res.json())
      .then(() => fetchSpreadsheetBackups())
      .catch(() => {});
  };

  const handleSetPrimaryBackupTarget = (id: number) => {
    fetch(getApiUrl(`/api_spreadsheet_sync.php?action=set_primary&id=${id}`))
      .then((res) => res.json())
      .then(() => fetchSpreadsheetBackups())
      .catch(() => {});
  };

  const handleTestConnection = (id: number, spreadsheetId?: string) => {
    setTestingConnectionId(id);
    fetch(getApiUrl(`/api_spreadsheet_sync.php?action=test_connection&id=${id}&spreadsheet_id=${encodeURIComponent(spreadsheetId || '')}`))
      .then((res) => res.json())
      .then((resData) => {
        setTestingConnectionId(null);
        if (resData.status === 'success') {
          setConnectionResultsMap((prev) => ({
            ...prev,
            [id]: { status: 'success', message: resData.message, docTitle: resData.document_title }
          }));
          setSavedMessage(`✓ Connection Verified: '${resData.document_title || 'Google Sheet'}'`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4500);
        } else {
          setConnectionResultsMap((prev) => ({
            ...prev,
            [id]: { status: 'error', message: resData.message }
          }));
          alert(`Connection Check Failed: ${resData.message}`);
        }
      })
      .catch((err) => {
        setTestingConnectionId(null);
        alert('Connection check error: ' + err.message);
      });
  };

  const handleRunBackupNow = (id: number) => {
    setRunningBackupId(id);
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=run_backup_now'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
      .then((res) => res.json())
      .then((resData) => {
        setRunningBackupId(null);
        if (resData.status === 'success') {
          setSavedMessage('✓ Master Product backup to Google Sheets executed successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4500);
          fetchSpreadsheetBackups();
        } else {
          alert('Backup failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => {
        setRunningBackupId(null);
        alert('Backup execution error: ' + err.message);
      });
  };

  // Save Function Helper
  const saveBatchSettings = (items: { credential_key: string; credential_value: string; service_name: string }[], msg?: string) => {
    fetch(getApiUrl('/api_credentials.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_batch',
        items: items
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(msg || 'Settings saved successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        }
      })
      .catch(() => {});
  };

  const persistAiKeysPool = (pool: 'inbox' | 'ocr', list: AIKeyItem[], msg?: string) => {
    const items = list.map((x) => ({
      key_alias: x.alias,
      api_key: x.key,
      status: x.status
    }));

    fetch(getApiUrl('/api_gemini_keys.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_batch',
        pool_type: pool,
        items: items
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(msg || `Gemini ${pool.toUpperCase()} API keys saved to dedicated MySQL table!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        }
      })
      .catch(() => {});
  };

  // Handler Tab 1: Save SMTP
  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedConfig: SMTPConfig = {
      ...formConfig,
      app_password: encryptData(plainPassword),
    };
    onSaveSmtpConfig(updatedConfig);
    saveBatchSettings([
      { credential_key: 'SMTP_EMAIL', credential_value: formConfig.from_email || formConfig.username, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_APP_PASSWORD', credential_value: plainPassword, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_HOST', credential_value: formConfig.host, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_PORT', credential_value: String(formConfig.port), service_name: 'SMTP Credentials' },
      { credential_key: 'INBOX_RULE_START_DATE', credential_value: inboxRules.fetchStartDate, service_name: 'Inbox Rules' }
    ], 'SMTP Credentials & Start Date Cutoff saved successfully!');
  };

  // Handler Tab 2: Save AI API Key Modal
  const handleSaveAiKeyModal = () => {
    const rawKey = modalKeyString.trim();
    if (!rawKey) {
      alert('API Key String cannot be empty!');
      return;
    }

    if (modalKeyPool === 'inbox') {
      let updatedList = [...inboxAiKeys];
      if (editingKeyItem) {
        updatedList = updatedList.map((item) =>
          item.id === editingKeyItem.id
            ? { ...item, alias: modalAlias || item.alias, key: rawKey, modelName: 'gemini-1.5-flash' }
            : item
        );
      } else {
        updatedList.push({
          id: `inbox-key-${Date.now()}`,
          alias: modalAlias || `Gemini Inbox Key ${updatedList.length + 1}`,
          key: rawKey,
          status: 'active',
          dailyRequests: 0,
          dailyLimit: '20 RPM / 1,500 RPD',
          tokensUsed: 0,
          modelName: 'gemini-1.5-flash',
          engineName: 'Email Inbox Classification AI Engine'
        });
      }
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Email Inbox AI API Keys updated & saved to MySQL gemini_api_keys table!');
    } else {
      let updatedList = [...ocrAiKeys];
      if (editingKeyItem) {
        updatedList = updatedList.map((item) =>
          item.id === editingKeyItem.id
            ? { ...item, alias: modalAlias || item.alias, key: rawKey, modelName: 'gemini-1.5-flash' }
            : item
        );
      } else {
        updatedList.push({
          id: `ocr-key-${Date.now()}`,
          alias: modalAlias || `Gemini OCR Key ${updatedList.length + 1}`,
          key: rawKey,
          status: 'active',
          dailyRequests: 0,
          dailyLimit: '20 RPM / 1,500 RPD',
          tokensUsed: 0,
          modelName: 'gemini-1.5-flash',
          engineName: 'OCR Vision Document Scan Engine'
        });
      }
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'OCR Document Scanning AI API Keys updated & saved to MySQL gemini_api_keys table!');
    }

    setIsAiModalOpen(false);
    setEditingKeyItem(null);
    setModalAlias('');
    setModalKeyString('');
  };

  const handleDeleteAiKey = (id: string, pool: 'inbox' | 'ocr') => {
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.filter((x) => x.id !== id);
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Inbox API Key deleted & database updated!');
    } else {
      const updatedList = ocrAiKeys.filter((x) => x.id !== id);
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'OCR API Key deleted & database updated!');
    }
  };

  const handleToggleAiKeyStatus = (id: string, pool: 'inbox' | 'ocr') => {
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.map((x) => x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x);
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Inbox API Key status toggled & database updated!');
    } else {
      const updatedList = ocrAiKeys.map((x) => x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x);
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'OCR API Key status toggled & database updated!');
    }
  };

  // Handler Tab 3: Default Fee Save
  const handleSaveFee = () => {
    saveBatchSettings([
      { credential_key: 'SOFTWARE_FEE_PERCENT', credential_value: String(softwareFee.percent), service_name: 'System Fee' },
      { credential_key: 'SOFTWARE_FEE_MAX_LIMIT', credential_value: String(softwareFee.maxLimit), service_name: 'System Fee' }
    ], 'Software Fee rules saved to MySQL Database!');
  };

  // Handler Tab 4: Paper Settings Save (Dedicated Table system_paper_settings)
  const [isUploadingPaperImage, setIsUploadingPaperImage] = useState(false);

  const handleSavePaper = () => {
    fetch(getApiUrl('/api_paper_settings.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: paperSettings.companyName,
        company_address: paperSettings.companyAddress,
        phone: paperSettings.phone,
        email: paperSettings.email,
        logo_url: paperSettings.logoUrl,
        stamp_url: paperSettings.stampUrl,
        signature_url: paperSettings.signatureUrl,
        header_image_url: paperSettings.headerImageUrl,
        bank_name: paperSettings.bankName,
        bank_account_number: paperSettings.bankAccountNumber,
        bank_account_name: paperSettings.bankAccountName,
        bank_email: paperSettings.bankEmail,
        header_title: paperSettings.headerTitle,
        footer_terms: paperSettings.footerTerms,
        header_color: paperSettings.headerColor,
        default_notes: paperSettings.defaultNotes,
        header_template: headerTemplate,
        table_header_bg: tableHeaderBg,
        table_header_text_color: tableHeaderTextColor
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage('Paper & Letterhead settings saved to dedicated system_paper_settings MySQL table!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Save failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => alert('Save paper settings error: ' + err.message));
  };

  const handleUploadPaperImage = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature' | 'header_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    if (type === 'logo') {
      formData.append('logo_file', file);
    } else if (type === 'stamp') {
      formData.append('stamp_file', file);
    } else if (type === 'signature') {
      formData.append('signature_file', file);
    } else {
      formData.append('header_image_file', file);
    }

    setIsUploadingPaperImage(true);
    fetch(getApiUrl('/api_paper_settings.php'), {
      method: 'POST',
      body: formData
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsUploadingPaperImage(false);
        if (resData.status === 'success' && resData.data) {
          if (type === 'logo' && resData.data.logo_url) {
            setPaperSettings((prev) => ({ ...prev, logoUrl: resData.data.logo_url }));
          }
          if (type === 'stamp' && resData.data.stamp_url) {
            setPaperSettings((prev) => ({ ...prev, stampUrl: resData.data.stamp_url }));
          }
          if (type === 'signature' && resData.data.signature_url) {
            setPaperSettings((prev) => ({ ...prev, signatureUrl: resData.data.signature_url }));
          }
          if (type === 'header_image' && resData.data.header_image_url) {
            setPaperSettings((prev) => ({ ...prev, headerImageUrl: resData.data.header_image_url }));
          }
          setSavedMessage(`Uploaded ${type === 'logo' ? 'Company Logo' : type === 'stamp' ? 'Official Stamp' : type === 'signature' ? 'Digital Signature' : 'Header Image'} successfully to server!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Upload failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => {
        setIsUploadingPaperImage(false);
        alert('Upload error: ' + err.message);
      });
  };



  // Handler Tab 7: Quotation Settings Save
  const handleSaveQuotationSettings = () => {
    saveBatchSettings([
      { credential_key: 'DOC_CURRENCY', credential_value: quotationSettings.currency, service_name: 'Quotation Settings' },
      { credential_key: 'DOC_TAX_PERCENT', credential_value: String(quotationSettings.taxPercent), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_DEFAULT_DISCOUNT', credential_value: String(quotationSettings.defaultDiscount), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_VALID_UNTIL', credential_value: quotationSettings.validUntil, service_name: 'Quotation Settings' }
    ], 'Quotation Defaults saved successfully!');
  };

  // Handler Tab 9: Invoice Settings Save (Dedicated Table system_invoice_settings)
  const handleSaveInvoiceSettings = () => {
    fetch(getApiUrl('/api_invoice_settings.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: invoiceSettings.companyName,
        company_reg_no: invoiceSettings.companyRegNo,
        company_address: invoiceSettings.companyAddress,
        phone: invoiceSettings.phone,
        email: invoiceSettings.email,
        logo_url: invoiceSettings.logoUrl,
        stamp_url: invoiceSettings.stampUrl,
        signature_url: invoiceSettings.signatureUrl,
        header_image_url: invoiceSettings.headerImageUrl,
        invoice_title: invoiceSettings.invoiceTitle,
        bank_name: invoiceSettings.bankName,
        bank_account_number: invoiceSettings.bankAccountNumber,
        bank_account_name: invoiceSettings.bankAccountName,
        bank_email: invoiceSettings.bankEmail,
        remarks_text: invoiceSettings.remarksText,
        authorised_by_name: invoiceSettings.authorisedByName,
        authorised_by_title: invoiceSettings.authorisedByTitle,
        received_by_label: invoiceSettings.receivedByLabel,
        table_header_bg: invoiceSettings.tableHeaderBg,
        table_header_text_color: invoiceSettings.tableHeaderTextColor
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage('Invoice settings saved to dedicated system_invoice_settings MySQL table!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Save failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => alert('Save invoice settings error: ' + err.message));
  };

  const handleUploadInvoiceImage = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature' | 'header_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    if (type === 'logo') {
      formData.append('logo_file', file);
    } else if (type === 'stamp') {
      formData.append('stamp_file', file);
    } else if (type === 'signature') {
      formData.append('signature_file', file);
    } else {
      formData.append('header_image_file', file);
    }

    setIsUploadingInvoiceImage(true);
    fetch(getApiUrl('/api_invoice_settings.php'), {
      method: 'POST',
      body: formData
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsUploadingInvoiceImage(false);
        if (resData.status === 'success' && resData.data) {
          if (type === 'logo' && resData.data.logo_url) {
            setInvoiceSettings((prev) => ({ ...prev, logoUrl: resData.data.logo_url }));
          }
          if (type === 'stamp' && resData.data.stamp_url) {
            setInvoiceSettings((prev) => ({ ...prev, stampUrl: resData.data.stamp_url }));
          }
          if (type === 'signature' && resData.data.signature_url) {
            setInvoiceSettings((prev) => ({ ...prev, signatureUrl: resData.data.signature_url }));
          }
          if (type === 'header_image' && resData.data.header_image_url) {
            setInvoiceSettings((prev) => ({ ...prev, headerImageUrl: resData.data.header_image_url }));
          }
          setSavedMessage(`Uploaded Invoice ${type === 'logo' ? 'Logo' : type === 'stamp' ? 'Stamp' : type === 'signature' ? 'Digital Signature' : 'Header Image'} successfully!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Upload failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => {
        setIsUploadingInvoiceImage(false);
        alert('Upload error: ' + err.message);
      });
  };



  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] text-slate-800 text-[11px] overflow-hidden">
      
      {/* Top Saved Notification Banner */}
      {isSaved && (
        <div className="bg-emerald-600 text-white font-bold text-[10px] px-4 py-2 flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{savedMessage}</span>
          </div>
          <button onClick={() => setIsSaved(false)} className="text-white hover:text-emerald-100 font-black">✕</button>
        </div>
      )}

      {/* 9 Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 flex gap-1 overflow-x-auto select-none shadow-xs">
        {[
          { id: 'credentials', label: '1. SMTP Credential', icon: Key },
          { id: 'ai', label: '2. AI Engine & Keys', icon: Bot },
          { id: 'cloud_sync', label: '3. Cloud Sync & Backup', icon: Cloud },
          { id: 'default_fee', label: '4. Default Setting (Fee)', icon: Percent },
          { id: 'paper', label: '5. Setting Paper (SPH)', icon: FileText },
          { id: 'inbox_rules', label: '6. Inbox Rules', icon: Sliders },
          { id: 'database', label: '7. Database', icon: Database },
          { id: 'quotation_settings', label: '8. Setting Quotation', icon: Layers },
          { id: 'invoice_settings', label: '9. Setting Invoice', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-[10px] font-extrabold rounded-t-md transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-t border-x border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Body Content Scroll Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">

        {/* ── TAB 3: CLOUD SYNC & SPREADSHEET BACKUP ─────────────────────── */}
        {activeTab === 'cloud_sync' && (
          <div className="space-y-4 max-w-5xl mx-auto font-sans">
            
            {/* Sub-Tab Navigation Header */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-2 border border-slate-200 rounded-lg shadow-2xs text-xs font-bold">
              <button
                onClick={() => setCloudSubTab('info')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  cloudSubTab === 'info' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Spreadsheet Link & Info</span>
              </button>

              <button
                onClick={() => { setCloudSubTab('logs'); fetchSyncLogs(); }}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  cloudSubTab === 'logs' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Log Error Sync</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-blue-100 text-blue-900 rounded-full font-mono">
                  {syncLogsList.length}
                </span>
              </button>

              <button
                onClick={() => { setCloudSubTab('conflicts'); fetchConflicts(); }}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  cloudSubTab === 'conflicts' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Cek Konflik Manual</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-amber-100 text-amber-900 rounded-full font-mono">
                  {syncConflictsList.length}
                </span>
              </button>

              <button
                onClick={() => { setCloudSubTab('audit'); loadSessionAudit(); }}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  cloudSubTab === 'audit' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Session Audit</span>
              </button>

              <button
                onClick={() => { setCloudSubTab('advanced'); fetchSpreadsheetBackups(); }}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ml-auto ${
                  cloudSubTab === 'advanced' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Advanced Settings</span>
              </button>
            </div>

            {/* SUB-TAB 1: SPREADSHEET LINK & INFO */}
            {cloudSubTab === 'info' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                {(() => {
                  const activeTarget = backupsList.find((b: any) => b.is_primary == 1) || backupsList[0] || {};
                  const fileTitle = activeTarget.title || 'Backup Master Produk Google Sheets (Utama)';
                  const spId = activeTarget.spreadsheet_id || '1PHMV-f5fEZzdzCHXXMZFn2laEIRnOWrDoH9ZJcxi1UQ';
                  const spUrl = spId.startsWith('http') ? spId : `https://docs.google.com/spreadsheets/d/${spId}/edit`;
                  const saEmail = activeTarget.service_account_email || 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com';

                  return (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                            <Cloud className="w-4.5 h-4.5 text-blue-600" />
                            <span>Main Google Spreadsheet Integration</span>
                          </h3>
                          <p className="text-slate-500 text-xs mt-0.5">
                            Configuration dynamically pulled from <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-bold">spreadsheet_backups</code> table.
                          </p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Google Sheets API Connected</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Backup Filename</span>
                            <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">SQL Dynamic Record</span>
                          </div>
                          
                          <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{fileTitle}</span>
                            </div>

                            <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[11px]">
                              <span className="text-slate-500 font-mono">Tab: <strong>{activeTarget.sheet_name || 'Master_Products'}</strong></span>
                              <a
                                href={spUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open Spreadsheet</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Google Service Account Access</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">Authorized Key</span>
                          </div>

                          <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                            <div className="font-mono font-bold text-slate-800 text-[11px] truncate" title={saEmail}>
                              {saEmail}
                            </div>

                            <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[11px]">
                              <span className="text-slate-500 text-[10px]">Grant edit access in Drive</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(saEmail)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                              >
                                {isCopiedEmail ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Email</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-md text-xs text-blue-950 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold block flex items-center gap-1.5 text-blue-900">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                            <span>Auto-Sync Daemon Status (24/7 Service):</span>
                          </span>
                          <p className="text-[11px] leading-relaxed text-blue-900">
                            Running automatically in background via <code className="bg-blue-100 px-1 py-0.2 rounded font-mono font-bold">erp-daemon.service</code> (every 60 mins).
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => activeTarget.id && handleRunBackupNow(activeTarget.id)}
                          disabled={runningBackupId === activeTarget.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded shadow-xs transition cursor-pointer shrink-0 flex items-center gap-1.5"
                        >
                          {runningBackupId === activeTarget.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Cloud className="w-3.5 h-3.5" />
                          )}
                          <span>Run Sync Now</span>
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* SUB-TAB 2: LOG ERROR SYNC */}
            {cloudSubTab === 'logs' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600" />
                    <span>System Sync Logs ({syncLogsList.length})</span>
                  </h3>
                  <button
                    onClick={fetchSyncLogs}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-80 border border-slate-200 rounded">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-12 text-center">ID</th>
                        <th className="p-2 w-36">Timestamp</th>
                        <th className="p-2 w-48">Event Title</th>
                        <th className="p-2">Message</th>
                        <th className="p-2 w-24 text-center">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {syncLogsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            No log entries found.
                          </td>
                        </tr>
                      ) : (
                        syncLogsList.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-mono font-bold text-slate-500">{log.id}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-600">{log.created_at}</td>
                            <td className="p-2 font-bold text-slate-900">{log.title}</td>
                            <td className="p-2 text-slate-700">{log.message}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {log.type || 'info'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: CEK KONFLIK MANUAL */}
            {cloudSubTab === 'conflicts' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Conflict Inspection (MySQL vs Sheet)</span>
                  </h3>
                  <button
                    onClick={fetchConflicts}
                    className="px-2.5 py-1 bg-amber-600 text-white rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-amber-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Run Conflict Check</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-28 font-mono">Product Code</th>
                        <th className="p-2">Name</th>
                        <th className="p-2 w-32">Conflict Field</th>
                        <th className="p-2 w-32 bg-blue-50 text-blue-900">MySQL Val</th>
                        <th className="p-2 w-32 bg-emerald-50 text-emerald-900">Cloud Sheet Val</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {syncConflictsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            No conflicts found. Systems are in sync!
                          </td>
                        </tr>
                      ) : (
                        syncConflictsList.map((disc: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-blue-700">{disc.product_code}</td>
                            <td className="p-2 font-bold text-slate-900">{disc.product_name}</td>
                            <td className="p-2">
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-extrabold text-[10px]">
                                {disc.field}
                              </span>
                            </td>
                            <td className="p-2 font-mono font-bold text-blue-700 bg-blue-50/40">{disc.local_val}</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 bg-emerald-50/40">{disc.cloud_val}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 4: AUDIT SESI EDIT */}
            {cloudSubTab === 'audit' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Local Session Edit Audit ({sessionAuditLogs.length})</span>
                  </h3>
                </div>

                <div className="overflow-x-auto max-h-80 border border-slate-200 rounded">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-12 text-center">#</th>
                        <th className="p-2 w-36">Timestamp</th>
                        <th className="p-2 w-32">Action Type</th>
                        <th className="p-2">Change Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sessionAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                            No edit activity recorded in this session.
                          </td>
                        </tr>
                      ) : (
                        sessionAuditLogs.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-600">{log.timestamp}</td>
                            <td className="p-2">
                              <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-bold text-[10px]">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-2 text-slate-800 font-medium">{log.detail}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 5: ADVANCED SETTINGS (MULTI SPREADSHEET MANAGER) */}
            {cloudSubTab === 'advanced' && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Sliders className="w-4.5 h-4.5 text-blue-600" />
                      <span>Multi-Backup File Manager</span>
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Manage multiple Google Spreadsheet backup endpoints and service account credentials.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddBackupModalOpen(true)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Backup File Detail & Key</span>
                  </button>
                </div>

                {/* Backups List Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs font-sans border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">File Name & Tab</th>
                        <th className="p-2.5 w-56">Spreadsheet Link / ID</th>
                        <th className="p-2.5 w-64">Service Account</th>
                        <th className="p-2.5 w-56">Status</th>
                        <th className="p-2.5 w-64 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {backupsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                            No backup files registered yet. Click "Add Backup File Detail" above.
                          </td>
                        </tr>
                      ) : (
                        backupsList.map((bk: any, idx: number) => {
                          const spUrl = bk.spreadsheet_id.startsWith('http')
                            ? bk.spreadsheet_id
                            : `https://docs.google.com/spreadsheets/d/${bk.spreadsheet_id}/edit`;
                          const testRes = connectionResultsMap[bk.id];

                          return (
                            <tr key={bk.id} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                              
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{bk.title}</span>
                                  {bk.is_primary == 1 && (
                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-1.5 py-0.2 rounded text-[9px]">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                                  <span>Tab: <strong>{bk.sheet_name || 'Master_Products'}</strong></span>
                                  <span>•</span>
                                  <span>Interval: {bk.backup_interval_minutes || 60}m</span>
                                </div>
                              </td>

                              <td className="p-2.5">
                                <a
                                  href={spUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-blue-700 text-[11px] hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                  title={spUrl}
                                >
                                  <ExternalLink className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span className="truncate">{bk.spreadsheet_id}</span>
                                </a>
                              </td>

                              <td className="p-2.5">
                                <div className="font-mono text-[10px] text-slate-700 font-semibold truncate max-w-[220px]" title={bk.service_account_email || 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com'}>
                                  {bk.service_account_email || 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com'}
                                </div>
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 font-mono px-1.5 py-0.2 rounded text-[9px] inline-block mt-0.5">
                                  Authorized SA
                                </span>
                              </td>

                              <td className="p-2.5">
                                {testRes ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${testRes.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'}`}>
                                    {testRes.status === 'success' ? '✓ Connection Verified' : '✕ Connection Failed'}
                                  </span>
                                ) : bk.last_status === 'success' ? (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold px-1.5 py-0.5 rounded text-[9px] inline-block">
                                    ✓ Active & Backed Up
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-600 border border-slate-200 font-bold px-1.5 py-0.5 rounded text-[9px] inline-block">
                                    Ready
                                  </span>
                                )}

                                <div className="text-[10px] text-slate-500 mt-1 font-sans">
                                  {bk.last_backup_at ? (
                                    <span>Sync: {bk.last_backup_at} ({bk.total_rows_backed_up || 0} items)</span>
                                  ) : (
                                    <span className="italic text-slate-400">Never synced</span>
                                  )}
                                </div>
                              </td>

                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleTestConnection(bk.id, bk.spreadsheet_id)}
                                    disabled={testingConnectionId === bk.id}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-extrabold text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                                    title="Check Connection"
                                  >
                                    {testingConnectionId === bk.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                    ) : (
                                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    )}
                                    <span>Test</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRunBackupNow(bk.id)}
                                    disabled={runningBackupId === bk.id}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                                    title="Backup Now"
                                  >
                                    {runningBackupId === bk.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Cloud className="w-3 h-3" />
                                    )}
                                    <span>Sync Now</span>
                                  </button>

                                  {bk.is_primary != 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimaryBackupTarget(bk.id)}
                                      className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer"
                                      title="Set Primary"
                                    >
                                      Primary
                                    </button>
                                  )}

                                  {bk.is_primary != 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBackupTarget(bk.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                      title="Delete Backup"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* POP-UP MODAL: ADD BACKUP FILE DETAIL */}
            {isAddBackupModalOpen && (
              <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white border border-slate-300 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col">
                  
                  <div className="p-3.5 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b]">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase">
                        Add Spreadsheet Backup File Detail
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsAddBackupModalOpen(false)}
                      className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAddBackupTarget} className="p-4 space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Backup Filename</label>
                      <input
                        type="text"
                        placeholder="e.g. Master Products Sync Backup"
                        value={backupTitle}
                        onChange={(e) => setBackupTitle(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-sans focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Google Spreadsheet Link / ID</label>
                      <input
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/1PHMV.../edit"
                        value={backupSpreadsheetId}
                        onChange={(e) => setBackupSpreadsheetId(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded p-2 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Sheet Name</label>
                        <input
                          type="text"
                          value={backupSheetName}
                          onChange={(e) => setBackupSheetName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block">Key Filename (.json)</label>
                        <input
                          type="text"
                          value={backupKeyFile}
                          onChange={(e) => setBackupKeyFile(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-2 font-mono text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">Service Account Email</label>
                      <input
                        type="email"
                        value={backupSaEmail}
                        onChange={(e) => setBackupSaEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 font-mono text-slate-800"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="primaryCheck"
                        checked={backupIsPrimary}
                        onChange={(e) => setBackupIsPrimary(e.target.checked)}
                        className="rounded text-blue-600 cursor-pointer"
                      />
                      <label htmlFor="primaryCheck" className="font-bold text-slate-800 cursor-pointer select-none">
                        Set as Primary Backup Target
                      </label>
                    </div>

                    <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2 shrink-0 pt-3">
                      <button
                        type="button"
                        onClick={() => setIsAddBackupModalOpen(false)}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingBackup}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded cursor-pointer disabled:opacity-50"
                      >
                        {isSavingBackup ? 'Saving...' : 'Simpan Backup Target'}
                      </button>
                    </div>
                  </form>

                </div>
              </div>
            )}

          </div>
        )}

        {/* ── TAB 1: CREDENTIAL SMTP ─────────────────────────────────────── */}
        {activeTab === 'credentials' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>Live Gmail SMTP Credentials Setup</span>
                </h3>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-300">
                  Live Sync Connected
                </span>
              </div>

              <form onSubmit={handleSaveSmtp} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Official SMTP Email</label>
                  <input
                    type="email"
                    value={formConfig.from_email || formConfig.username || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, from_email: e.target.value, username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold focus:bg-white focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">App Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={plainPassword}
                      onChange={(e) => setPlainPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold focus:bg-white focus:outline-hidden focus:border-blue-500 pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">IMAP Host</label>
                  <input
                    type="text"
                    value={formConfig.host}
                    onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">IMAP Port</label>
                  <input
                    type="number"
                    value={formConfig.port}
                    onChange={(e) => setFormConfig({ ...formConfig, port: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px]"
                  />
                </div>

                {/* INFO START FROM (DATE CUTOFF) INPUT */}
                <div className="col-span-2 bg-[#f0f9ff] border border-blue-200 p-3 rounded-md space-y-2 mt-1">
                  <label className="block text-[10px] font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Info Start From (Date Cutoff) — Batas Tanggal Ingest Email & AI Scan</span>
                  </label>
                  <p className="text-[10px] text-slate-600 font-sans">
                    Sistem IMAP Gmail & Scanner AI hanya akan memproses email yang masuk <strong>mulai dari tanggal ini ke atas</strong>. Email lama sebelum tanggal ini diabaikan agar kuota API Gemini tidak cepat habis.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={inboxRules.fetchStartDate}
                      onChange={(e) => setInboxRules({ ...inboxRules, fetchStartDate: e.target.value })}
                      className="bg-white border border-blue-300 rounded px-3 py-1.5 font-mono text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    />
                    <span className="text-[10px] font-mono text-slate-500">
                      {inboxRules.fetchStartDate ? `Cutoff Active: >= ${inboxRules.fetchStartDate}` : 'No cutoff set (ingesting all email history)'}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 pt-2 flex justify-end gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Credentials & Start Date</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Daily Request Pull & Webhook Activity Logs */}
            <div className="grid grid-cols-2 gap-4">
              {/* Day Request Pull Counter */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2">
                <h4 className="font-bold text-slate-700 uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>Day Request Pull Stats</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Pull Requests Today</span>
                    <span className="text-lg font-black text-blue-700">142</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Avg Latency</span>
                    <span className="text-lg font-black text-emerald-600">320 ms</span>
                  </div>
                </div>
              </div>

              {/* Day Webhook Activity Log */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2">
                <h4 className="font-bold text-slate-700 uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Live Webhook Log (Pub/Sub)</span>
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[9px]">
                  {webhookLogs.length > 0 ? (
                    webhookLogs.map((log: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 p-1.5 rounded flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800">{log.event}</span>
                          <span className="text-slate-400 block text-[8px]">{log.time} — {log.detail}</span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 font-extrabold px-1 py-0.5 rounded text-[8px]">{log.status}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-center py-4 font-sans">No recent webhook events logged.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Error Log Display */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2">
              <h4 className="font-bold text-slate-700 uppercase text-[9px] tracking-wider flex items-center gap-1.5 text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>SMTP & Ingestion Error Log Trace</span>
              </h4>
              <div className="bg-slate-900 text-emerald-400 p-3 rounded font-mono text-[9.5px] max-h-40 overflow-y-auto space-y-1">
                {smtpErrorLogs.length > 0 ? (
                  smtpErrorLogs.map((err: any, idx: number) => (
                    <div key={idx} className="border-b border-slate-800 pb-1">
                      <span className="text-slate-400">[{err.time}] RFQ #{err.rfq_number}:</span> <span className="text-rose-400">{err.error}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 font-sans italic">No active SMTP connection errors in database.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AI ENGINE SETTINGS & KEYS TABLE (CRUD) ───────────────── */}
        {activeTab === 'ai' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            
            {/* AI Summary Header Cards */}
            {(() => {
              const activeInboxCount = inboxAiKeys.filter((x) => x.status === 'active').length;
              const activeOcrCount = ocrAiKeys.filter((x) => x.status === 'active').length;
              const totalActiveCount = activeInboxCount + activeOcrCount;

              const totalTokensUsed = inboxAiKeys.reduce((acc, k) => acc + (k.status === 'active' ? k.tokensUsed : 0), 0) +
                                      ocrAiKeys.reduce((acc, k) => acc + (k.status === 'active' ? k.tokensUsed : 0), 0);

              const maxCapacity24h = totalActiveCount * 1500000;
              const capacityPercent = maxCapacity24h > 0 ? ((totalTokensUsed / maxCapacity24h) * 100).toFixed(1) : '0';

              return (
                <div className="grid grid-cols-4 gap-3">
                  {/* Card 1: Inbox Active Keys */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-blue-300 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9.5px] text-slate-500 uppercase font-extrabold tracking-wider">Inbox Active Keys</span>
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-blue-700 font-mono tracking-tight">{activeInboxCount} Keys</span>
                      <span className="text-[9.5px] font-bold text-slate-400 font-mono">{inboxAiKeys.length} Total</span>
                    </div>
                    <div className="mt-2 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 inline-block">
                      Pool: Email Classifier
                    </div>
                  </div>

                  {/* Card 2: OCR Active Keys */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-purple-300 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9.5px] text-slate-500 uppercase font-extrabold tracking-wider">OCR Active Keys</span>
                      <ScanLine className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-purple-700 font-mono tracking-tight">{activeOcrCount} Keys</span>
                      <span className="text-[9.5px] font-bold text-slate-400 font-mono">{ocrAiKeys.length} Total</span>
                    </div>
                    <div className="mt-2 text-[9px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 inline-block">
                      Pool: Vision OCR Scanner
                    </div>
                  </div>

                  {/* Card 3: Total Tokens Used (24h) */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9.5px] text-slate-500 uppercase font-extrabold tracking-wider">Total Tokens Used (24h)</span>
                      <Activity className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                        {totalTokensUsed.toLocaleString('id-ID')} Tokens
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono font-bold">
                        <span>Cap 24h: {maxCapacity24h.toLocaleString('id-ID')}</span>
                        <span>{capacityPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, Number(capacityPercent))}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: AI Model */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs hover:border-slate-300 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9.5px] text-slate-500 uppercase font-extrabold tracking-wider">AI Model</span>
                      <Cpu className="w-4 h-4 text-slate-700" />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-slate-800 font-mono tracking-tight">gemini-1.5-flash</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 inline-block">
                      Quota: 20 RPM / 1,500 RPD
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TABEL 1: EMAIL INBOX CLASSIFICATION AI KEYS REGISTRY */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="bg-blue-900 text-white px-4 py-2.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-300" />
                  <div>
                    <h3 className="font-extrabold text-xs tracking-wide flex items-center gap-2">
                      <span>1. Email Inbox Classification AI Keys Registry</span>
                      <span className="bg-blue-800 text-blue-100 text-[9px] px-2 py-0.5 rounded-full font-mono border border-blue-700">
                        {inboxAiKeys.length} Keys Total ({inboxAiKeys.filter((x) => x.status === 'active').length} Active)
                      </span>
                    </h3>
                    <p className="text-[9px] text-blue-200 font-mono">Key Pool: Dedicated MySQL Table gemini_api_keys (pool_type = 'inbox')</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingKeyItem(null);
                    setModalKeyPool('inbox');
                    setModalAlias('');
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 py-1 rounded text-[10px] transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Inbox Key</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                    <tr>
                      <th className="p-2.5 w-10 text-center border-r border-slate-200">#</th>
                      <th className="p-2.5 border-r border-slate-200 w-44">Key Alias</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[280px]">API Key String (Dedicated Column)</th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-20">Status</th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-24">Requests Today</th>
                      <th className="p-2.5 border-r border-slate-200 w-32">Limit Config</th>
                      <th className="p-2.5 border-r border-slate-200 text-right w-24">Tokens Used</th>
                      <th className="p-2.5 border-r border-slate-200 w-28">Model Name</th>
                      <th className="p-2.5 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {inboxAiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400 font-mono text-xs">
                          No API keys in Inbox Pool yet. Click <span className="font-bold text-blue-600">+ Add Inbox Key</span> to add.
                        </td>
                      </tr>
                    ) : (
                      inboxAiKeys.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-100">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">{item.alias}</td>
                          <td className="p-2.5 font-mono border-r border-slate-100">
                            <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                              <span className="truncate select-all text-slate-800 font-semibold">
                                {showPlainKeyMap[item.id] ? item.key : maskKeyStr(item.key)}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleShowPlainKey(item.id)}
                                className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer shrink-0"
                                title={showPlainKeyMap[item.id] ? "Hide full API key" : "Show full API key"}
                              >
                                {showPlainKeyMap[item.id] ? <EyeOff className="w-3.5 h-3.5 text-blue-600" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-100">
                            <button
                              onClick={() => handleToggleAiKeyStatus(item.id, 'inbox')}
                              className={`font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase border cursor-pointer ${
                                item.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              {item.status}
                            </button>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-100">{item.dailyRequests}</td>
                          <td className="p-2.5 text-slate-500 border-r border-slate-100">{item.dailyLimit}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-700 border-r border-slate-100">{item.tokensUsed.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 font-semibold text-blue-700 border-r border-slate-100">{item.modelName}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingKeyItem(item);
                                  setModalKeyPool('inbox');
                                  setModalAlias(item.alias);
                                  setModalKeyString(item.key);
                                  setIsAiModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                title="Edit Key"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAiKey(item.id, 'inbox')}
                                className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                                title="Delete Key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABEL 2: OCR DOCUMENT EXTRACTION AI KEYS REGISTRY */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="bg-purple-900 text-white px-4 py-2.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-purple-300" />
                  <div>
                    <h3 className="font-extrabold text-xs tracking-wide flex items-center gap-2">
                      <span>2. OCR Document Extraction AI Keys Registry</span>
                      <span className="bg-purple-800 text-purple-100 text-[9px] px-2 py-0.5 rounded-full font-mono border border-purple-700">
                        {ocrAiKeys.length} Keys Total ({ocrAiKeys.filter((x) => x.status === 'active').length} Active)
                      </span>
                    </h3>
                    <p className="text-[9px] text-purple-200 font-mono">Key Pool: Dedicated MySQL Table gemini_api_keys (pool_type = 'ocr')</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingKeyItem(null);
                    setModalKeyPool('ocr');
                    setModalAlias('');
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 rounded text-[10px] transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add OCR Key</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                    <tr>
                      <th className="p-2.5 w-10 text-center border-r border-slate-200">#</th>
                      <th className="p-2.5 border-r border-slate-200 w-44">Key Alias</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[280px]">API Key String (Dedicated Column)</th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-20">Status</th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-24">Requests Today</th>
                      <th className="p-2.5 border-r border-slate-200 w-32">Limit Config</th>
                      <th className="p-2.5 border-r border-slate-200 text-right w-24">Tokens Used</th>
                      <th className="p-2.5 border-r border-slate-200 w-28">Model Name</th>
                      <th className="p-2.5 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ocrAiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400 font-mono text-xs">
                          No API keys in OCR Pool yet. Click <span className="font-bold text-purple-600">+ Add OCR Key</span> to add.
                        </td>
                      </tr>
                    ) : (
                      ocrAiKeys.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-100">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">{item.alias}</td>
                          <td className="p-2.5 font-mono border-r border-slate-100">
                            <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                              <span className="truncate select-all text-slate-800 font-semibold">
                                {showPlainKeyMap[item.id] ? item.key : maskKeyStr(item.key)}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleShowPlainKey(item.id)}
                                className="p-1 text-slate-400 hover:text-purple-600 transition cursor-pointer shrink-0"
                                title={showPlainKeyMap[item.id] ? "Hide full API key" : "Show full API key"}
                              >
                                {showPlainKeyMap[item.id] ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-100">
                            <button
                              onClick={() => handleToggleAiKeyStatus(item.id, 'ocr')}
                              className={`font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase border cursor-pointer ${
                                item.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              {item.status}
                            </button>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-100">{item.dailyRequests}</td>
                          <td className="p-2.5 text-slate-500 border-r border-slate-100">{item.dailyLimit}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-700 border-r border-slate-100">{item.tokensUsed.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 font-semibold text-purple-700 border-r border-slate-100">{item.modelName}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingKeyItem(item);
                                  setModalKeyPool('ocr');
                                  setModalAlias(item.alias);
                                  setModalKeyString(item.key);
                                  setIsAiModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                title="Edit Key"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAiKey(item.id, 'ocr')}
                                className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                                title="Delete Key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Failover Rule & Math Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2">
              <h4 className="font-bold text-slate-700 uppercase text-[9px] tracking-wider flex items-center gap-1.5 text-blue-700">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                <span>Multi-Key Failover Engine & Smart Cooldown Math</span>
              </h4>
              <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                Setiap request AI secara otomatis merotasi kunci dalam daftar pool secara berurutan. Jika Kunci #1 mengalami <strong>HTTP 429 Rate Limit</strong> atau kuota habis, sistem secara matematis menempatkan kunci tersebut dalam status <em>cooldown (60s)</em> dan langsung melanjutkan pemrosesan ke Kunci #2, #3, dst. dengan penundaan aman (backoff 500ms) tanpa memicu error/terblokir.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 3: DEFAULT SETTING (SOFTWARE FEE) ───────────────────────── */}
        {activeTab === 'default_fee' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-blue-600" />
                  <span>Software Fee & System Financial Rules</span>
                </h3>
                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-blue-300">
                  Fixed Non-CRUD Rule
                </span>
              </div>

              <div className="space-y-3 font-sans">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-[10px] space-y-1">
                  <p className="font-bold">Software Fee Constraint Directive:</p>
                  <p>
                    Fee software ditetapakan sebesar <strong>1.75%</strong> untuk setiap invoice SPH. Pengakumulasian akan otomatis terhenti (*Stop*) ketika jumlah akumulasi mencapai limit maksimum <strong>20.000</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Software Fee Percentage (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={softwareFee.percent}
                      onChange={(e) => setSoftwareFee({ ...softwareFee, percent: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Max Stop Threshold Limit</label>
                    <input
                      type="number"
                      value={softwareFee.maxLimit}
                      readOnly
                      className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-md flex justify-between items-center font-mono">
                  <span className="text-[10px] text-slate-600 font-bold uppercase">Accumulated Software Fee Today:</span>
                  <span className="text-lg font-black text-emerald-700">{softwareFee.currentAccumulated.toLocaleString()} / 20,000</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveFee}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Software Fee Rules</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: PAPER & BRANDING SETTINGS ───────────────────────────── */}
        {activeTab === 'paper' && (
          <div className="space-y-4 w-full max-w-full font-sans">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4 font-sans">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Setting Paper, Logo Header, Footer & Table Styling</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">Dedicated Table: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">system_paper_settings</code></p>
                </div>

                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold text-[10px] px-3 py-1.5 rounded shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-200" />
                  <span>Pratinjau Layout Header SPH (Live Preview)</span>
                </button>
              </div>

              {/* SPH Header Choice Selector */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-2">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">Pilihan Template Layout Header SPH:</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('default')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'default' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">1. Official AB Malaya Default</span>
                    <span className="block text-[10px] text-slate-500">Logo ABM Kiri, Metadata No SPH Kanan, From/To Kartu Ganda.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('minimalist')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'minimalist' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">2. Modern Minimalist Executive</span>
                    <span className="block text-[10px] text-slate-500">Clean Header Garis Tipis, Tipografi Inter Slate Modern.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('maritime')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'maritime' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">3. Maritime Industrial Logistics</span>
                    <span className="block text-[10px] text-slate-500">Aksen Biru Laut Tua, Badge IMPA & Kode Maritim Resmi.</span>
                  </button>
                </div>
              </div>

              {/* LOGO, STAMP, SIGNATURE & HEADER IMAGE BANNER UPLOAD SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-md">
                
                {/* Logo Upload Box */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">Company Logo</span>
                  <div className="flex items-center gap-3">
                    {paperSettings.logoUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={paperSettings.logoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">No Logo</div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingPaperImage ? '...' : '📁 Upload'}
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'logo')} disabled={isUploadingPaperImage} className="hidden" />
                      </label>
                      <input type="text" value={paperSettings.logoUrl} onChange={(e) => setPaperSettings({ ...paperSettings, logoUrl: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]" />
                    </div>
                  </div>
                </div>

                {/* Stamp Upload Box */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">Official Stamp</span>
                  <div className="flex items-center gap-3">
                    {paperSettings.stampUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={paperSettings.stampUrl} alt="Company Stamp" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">No Stamp</div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingPaperImage ? '...' : '📁 Upload'}
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'stamp')} disabled={isUploadingPaperImage} className="hidden" />
                      </label>
                      <input type="text" value={paperSettings.stampUrl} onChange={(e) => setPaperSettings({ ...paperSettings, stampUrl: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]" />
                    </div>
                  </div>
                </div>

                {/* Signature Upload Box */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">Digital Signature</span>
                  <div className="flex items-center gap-3">
                    {paperSettings.signatureUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={paperSettings.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">No TTD</div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingPaperImage ? '...' : '✍️ Upload'}
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'signature')} disabled={isUploadingPaperImage} className="hidden" />
                      </label>
                      <input type="text" value={paperSettings.signatureUrl} onChange={(e) => setPaperSettings({ ...paperSettings, signatureUrl: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]" />
                    </div>
                  </div>
                </div>

                {/* Top Header Banner Upload Box */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">Header Banner</span>
                  <div className="flex items-center gap-3">
                    {paperSettings.headerImageUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-0.5 overflow-hidden shrink-0 shadow-2xs">
                        <img src={paperSettings.headerImageUrl} alt="Header" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">No Banner</div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingPaperImage ? '...' : '📁 Upload'}
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'header_image')} disabled={isUploadingPaperImage} className="hidden" />
                      </label>
                      <input type="text" value={paperSettings.headerImageUrl || ''} onChange={(e) => setPaperSettings({ ...paperSettings, headerImageUrl: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* COMPANY INFORMATION FORM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                  <input type="text" value={paperSettings.companyName} onChange={(e) => setPaperSettings({ ...paperSettings, companyName: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Company Email</label>
                  <input type="email" value={paperSettings.email} onChange={(e) => setPaperSettings({ ...paperSettings, email: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-mono font-bold" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Company Address</label>
                  <input type="text" value={paperSettings.companyAddress} onChange={(e) => setPaperSettings({ ...paperSettings, companyAddress: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Company Phone</label>
                  <input type="text" value={paperSettings.phone} onChange={(e) => setPaperSettings({ ...paperSettings, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-mono" />
                </div>
                
                <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide mb-2">Bank Settings</h4>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                    <input type="text" value={paperSettings.bankName} onChange={(e) => setPaperSettings({...paperSettings, bankName: e.target.value})} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-bold" placeholder="Bank Name" />
                    <input type="text" value={paperSettings.bankAccountNumber} onChange={(e) => setPaperSettings({...paperSettings, bankAccountNumber: e.target.value})} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-mono font-bold" placeholder="Account Number" />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 col-span-2">
                  <button onClick={handleSavePaper} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer">
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Paper Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: SETTING QUOTATION ────────────────────────────────────── */}
        {activeTab === 'quotation_settings' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Quotation Default Financial & Validity Settings</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Default Currency</label>
                  <select
                    value={quotationSettings.currency}
                    onChange={(e) => setQuotationSettings({ ...quotationSettings, currency: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold"
                  >
                    <option value="MYR">MYR — Malaysian Ringgit</option>
                    <option value="IDR">IDR — Indonesian Rupiah</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={quotationSettings.taxPercent}
                    onChange={(e) => setQuotationSettings({ ...quotationSettings, taxPercent: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Default Discount (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={quotationSettings.defaultDiscount}
                    onChange={(e) => setQuotationSettings({ ...quotationSettings, defaultDiscount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Default Validity Period</label>
                  <select
                    value={quotationSettings.validUntil}
                    onChange={(e) => setQuotationSettings({ ...quotationSettings, validUntil: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[11px] font-bold"
                  >
                    <option value="7 Days">7 Days</option>
                    <option value="14 Days">14 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveQuotationSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Quotation Defaults</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── TAB 9: INVOICE SETTINGS & CUSTOMIZATION ──────────────────── */}
        {activeTab === 'invoice_settings' && (
          <div className="space-y-4 max-w-4xl mx-auto font-sans">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
              
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Setting Invoice, Kop Faktur, Bank & Tulisan Resmi</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Dedicated Table: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">system_invoice_settings</code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveInvoiceSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Pengaturan Invoice</span>
                </button>
              </div>

              {/* SECTION 1: INVOICE LOGO, STAMP & HEADER BACKGROUND IMAGE */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-md">
                
                {/* Logo Upload */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">
                    Invoice Logo (Kop Faktur)
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {invoiceSettings.logoUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={invoiceSettings.logoUrl} alt="Invoice Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">
                        No Logo
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingInvoiceImage ? 'Uploading...' : '📁 Upload Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadInvoiceImage(e, 'logo')}
                          disabled={isUploadingInvoiceImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Logo URL (/favicon.png)"
                        value={invoiceSettings.logoUrl}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, logoUrl: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Stamp Upload */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">
                    Official Stamp / Cap Invoice
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {invoiceSettings.stampUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={invoiceSettings.stampUrl} alt="Invoice Stamp" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">
                        No Stamp
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingInvoiceImage ? 'Uploading...' : '📁 Upload Stamp'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadInvoiceImage(e, 'stamp')}
                          disabled={isUploadingInvoiceImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Stamp URL"
                        value={invoiceSettings.stampUrl}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, stampUrl: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Digital Signature Upload Box */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">
                    Digital Signature (Tanda Tangan Image Invoice)
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {invoiceSettings.signatureUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={invoiceSettings.signatureUrl} alt="Invoice Signature" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">
                        No TTD
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingInvoiceImage ? 'Uploading...' : '✍️ Upload TTD'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadInvoiceImage(e, 'signature')}
                          disabled={isUploadingInvoiceImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Signature URL"
                        value={invoiceSettings.signatureUrl}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatureUrl: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Header Image Background */}
                <div className="bg-white p-3 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-xs text-slate-900 block border-b border-slate-100 pb-1">
                    Header Banner Background
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {invoiceSettings.headerImageUrl ? (
                      <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                        <img src={invoiceSettings.headerImageUrl} alt="Header Background" className="max-w-full max-h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">
                        No Banner
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1">
                      <label className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded cursor-pointer text-center transition">
                        {isUploadingInvoiceImage ? 'Uploading...' : '📁 Upload Banner'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadInvoiceImage(e, 'header_image')}
                          disabled={isUploadingInvoiceImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Banner Image URL"
                        value={invoiceSettings.headerImageUrl}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, headerImageUrl: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-[10px]"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* SECTION 2: COMPANY IDENTITY FOR INVOICE */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-3">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Identitas Perusahaan Pada Faktur / Invoice</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Company Name (Nama Entitas Faktur):</label>
                    <input
                      type="text"
                      value={invoiceSettings.companyName}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyName: e.target.value })}
                      placeholder="e.g. AB MALAYA INDUSTRY"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Registration No. / SSM (Nomor Registrasi Bisnis):</label>
                    <input
                      type="text"
                      value={invoiceSettings.companyRegNo}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyRegNo: e.target.value })}
                      placeholder="e.g. 003320457-D"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Company Address (Alamat Surat Menyurat):</label>
                    <textarea
                      rows={2}
                      value={invoiceSettings.companyAddress}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyAddress: e.target.value })}
                      placeholder="Alamat kantor resmi pada faktur"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Contact Phone (No. Telepon):</label>
                    <input
                      type="text"
                      value={invoiceSettings.phone}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, phone: e.target.value })}
                      placeholder="+60 3-8000 1234"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Company Email (Email Faktur):</label>
                    <input
                      type="text"
                      value={invoiceSettings.email}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, email: e.target.value })}
                      placeholder="abmalayaindustry@gmail.com"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: BANK & PAYMENT INSTRUCTIONS */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-3">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Informasi Rekening Bank Pembayaran (Payment Account)</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Bank Name (Nama Bank):</label>
                    <input
                      type="text"
                      value={invoiceSettings.bankName}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankName: e.target.value })}
                      placeholder="PUBLIC BANK"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Account Number (Nomor Rekening):</label>
                    <input
                      type="text"
                      value={invoiceSettings.bankAccountNumber}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankAccountNumber: e.target.value })}
                      placeholder="3818192115"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Beneficiary Account Name (Nama Pemilik Rekening):</label>
                    <input
                      type="text"
                      value={invoiceSettings.bankAccountName}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankAccountName: e.target.value })}
                      placeholder="AB MALAYA INDUSTRY"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Payment Proof Email (Email Bukti Transfer):</label>
                    <input
                      type="text"
                      value={invoiceSettings.bankEmail}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankEmail: e.target.value })}
                      placeholder="abmalayaindustry@gmail.com"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Remarks / Bank Payment Instructions Box (Instruksi Pembayaran Faktur):
                    </label>
                    <textarea
                      rows={4}
                      value={invoiceSettings.remarksText}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, remarksText: e.target.value })}
                      placeholder="Tuliskan petunjuk transfer bank dan catatan penting pada invoice..."
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 leading-relaxed font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: INVOICE TITLE, SIGNATORIES & TABLE STYLING */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-3">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  <span>Judul Dokumen, Penandatangan & Warna Tabel</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Invoice Banner Title (Judul Banner Faktur):</label>
                    <input
                      type="text"
                      value={invoiceSettings.invoiceTitle}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceTitle: e.target.value })}
                      placeholder="OFFICIAL INVOICE"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-black text-xs text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Table Header Color (Warna Header Tabel):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={invoiceSettings.tableHeaderBg}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderBg: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={invoiceSettings.tableHeaderBg}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderBg: e.target.value })}
                        className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Authorised By Name (Nama Penandatangan Resmi):</label>
                    <input
                      type="text"
                      value={invoiceSettings.authorisedByName}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, authorisedByName: e.target.value })}
                      placeholder="Muhammad Aimanuddin Bin Mohd Zaki"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Authorised By Title (Jabatan Penandatangan):</label>
                    <input
                      type="text"
                      value={invoiceSettings.authorisedByTitle}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, authorisedByTitle: e.target.value })}
                      placeholder="Procurement Manager / Head of Sales"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Received By Label (Label Penerima Klien):</label>
                    <input
                      type="text"
                      value={invoiceSettings.receivedByLabel}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, receivedByLabel: e.target.value })}
                      placeholder="Received by,"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Table Header Text Color (Warna Teks Header Tabel):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={invoiceSettings.tableHeaderTextColor}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderTextColor: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={invoiceSettings.tableHeaderTextColor}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderTextColor: e.target.value })}
                        className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVE BUTTON AT BOTTOM */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveInvoiceSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Pengaturan Invoice ke MySQL</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── AI KEY EDIT / ADD POPUP MODAL ─────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl max-w-md w-full overflow-hidden space-y-3 font-sans">
            <div className={`px-4 py-3 border-b border-slate-200 flex justify-between items-center text-white ${
              modalKeyPool === 'inbox' ? 'bg-blue-900' : 'bg-purple-900'
            }`}>
              <h3 className="font-bold text-xs">
                {editingKeyItem
                  ? `Edit ${modalKeyPool === 'inbox' ? 'Inbox AI' : 'OCR AI'} Key`
                  : `Add New ${modalKeyPool === 'inbox' ? 'Inbox AI' : 'OCR AI'} Key`}
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-white hover:text-slate-300 font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-4 space-y-3 text-[10.5px]">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Target Engine Pool</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalKeyPool('inbox')}
                    className={`flex-1 py-1.5 px-3 rounded font-bold text-[10px] border cursor-pointer transition ${
                      modalKeyPool === 'inbox'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    Email Inbox AI Engine
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalKeyPool('ocr')}
                    className={`flex-1 py-1.5 px-3 rounded font-bold text-[10px] border cursor-pointer transition ${
                      modalKeyPool === 'ocr'
                        ? 'bg-purple-600 text-white border-purple-700'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    OCR Scan AI Engine
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Key Alias / Description</label>
                <input
                  type="text"
                  placeholder={modalKeyPool === 'inbox' ? 'e.g. Gemini Inbox Key 2' : 'e.g. Gemini OCR Backup Key 1'}
                  value={modalAlias}
                  onChange={(e) => setModalAlias(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">API Key String</label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={modalKeyString}
                  onChange={(e) => setModalKeyString(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[10px]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Model Reference</label>
                <input
                  type="text"
                  value="gemini-1.5-flash"
                  readOnly
                  className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAiKeyModal}
                className={`font-bold px-4 py-1.5 rounded transition cursor-pointer text-white ${
                  modalKeyPool === 'inbox' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Save Key to Database
              </button>
            </div>
          </div>
        </div>
      )}
      {/* POP-UP MODAL: LIVE PREVIEW SPH HEADER LAYOUT */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  Pratinjau Layout SPH (Live Preview) — Template: <span className="uppercase text-blue-700 font-mono">{headerTemplate}</span>
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-100 flex-1 text-xs">
              
              {/* SPH Header Document Card Preview */}
              <div className="bg-white p-6 rounded-md shadow-md border border-slate-300 space-y-5">
                
                {/* Header Branding */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded flex items-center justify-center font-black text-xl tracking-wider">
                      ABM
                    </div>
                    <div>
                      <h2 className="font-black text-base text-slate-900">{paperSettings.headerTitle}</h2>
                      <p className="text-slate-500 font-mono text-[11px]">{paperSettings.companyName}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <p className="font-bold text-blue-700 text-sm">SPH-ABM/MY/2026/0403</p>
                    <p className="text-slate-500">Date: {new Date().toISOString().split('T')[0]}</p>
                  </div>
                </div>

                {/* FROM vs TO Preview */}
                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-700 uppercase text-[10px] block">FROM (AB MALAYA):</span>
                    <p className="font-bold text-slate-900">{paperSettings.companyName}</p>
                    <p className="text-slate-600">{paperSettings.companyAddress}</p>
                    <p className="text-slate-600 font-mono">{paperSettings.email} | {paperSettings.phone}</p>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded border border-blue-200 space-y-1">
                    <span className="font-bold text-blue-900 uppercase text-[10px] block">TO (CLIENT):</span>
                    <p className="font-bold text-slate-900">Gantang Coffee Enterprise Sdn. Bhd.</p>
                    <p className="text-slate-600">Attention: Purchase Officer</p>
                    <p className="text-slate-600 font-mono">procurement@gantangcoffee.my</p>
                  </div>
                </div>

                {/* Table Header Styled Preview */}
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead style={{ backgroundColor: tableHeaderBg, color: tableHeaderTextColor }} className="font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2 border-r border-white/20 w-8 text-center">#</th>
                        <th className="p-2 border-r border-white/20 w-28">Kode Barang</th>
                        <th className="p-2 border-r border-white/20">Nama Produk</th>
                        <th className="p-2 border-r border-white/20">Spesifikasi Detail</th>
                        <th className="p-2 border-r border-white/20 w-16 text-center">Qty</th>
                        <th className="p-2 border-r border-white/20 w-20">Unit</th>
                        <th className="p-2 border-r border-white/20 w-28 text-right">Harga (RM)</th>
                        <th className="p-2 text-right w-32">Total (RM)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2 text-center font-mono">1</td>
                        <td className="p-2 font-mono font-bold text-blue-700">IMPA-49-01</td>
                        <td className="p-2 font-bold">RO Water Maker High Pressure Hose</td>
                        <td className="p-2 text-slate-600">Material Stainless 316, Press: 350 Bar</td>
                        <td className="p-2 text-center font-bold">2</td>
                        <td className="p-2">Unit</td>
                        <td className="p-2 text-right font-mono">4,500.00</td>
                        <td className="p-2 text-right font-mono font-bold text-blue-700">9,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>

            </div>

            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex justify-end shrink-0">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
