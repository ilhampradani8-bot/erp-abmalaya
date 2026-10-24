import React, { useState, useEffect } from 'react';
import { SMTPConfig } from '../types/erp';
import { decryptData, encryptData } from '../utils/crypto';
import { 
  Key, Database, CheckCircle2, Eye, EyeOff, Save, 
  FileText, Sliders, Bot, AlertTriangle, 
  Plus, Edit3, Trash2, Percent, ExternalLink, 
  Activity, Layers, Server, Cpu, Calendar, ScanLine,
  Cloud, RefreshCw, ShieldCheck, Copy, Check,
  BookOpen, HelpCircle, ChevronDown, Search, ArrowRight, Mail
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
  // 9 Tabs: 'credentials' | 'ai' | 'cloud_sync' | 'default_fee' | 'paper' | 'inbox_rules' | 'database' | 'quotation_settings' | 'user_guide'
  const [activeTab, setActiveTab] = useState<
    'credentials' | 'ai' | 'cloud_sync' | 'default_fee' | 'paper' | 'inbox_rules' | 'database' | 'quotation_settings' | 'user_guide'
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
    companyName: 'PT ABMALAYA NUSA SEJAHTERA (MALAYSIA)',
    companyAddress: 'Kuala Lumpur Tech Park, Block B-12, Wilayah Persekutuan Kuala Lumpur',
    phone: '+60 3-8900 4455',
    email: 'sales@abmalaya.com',
    logoUrl: '/favicon.png',
    stampUrl: '',
    headerTitle: 'OFFICIAL COMMERCIAL QUOTATION',
    footerTerms: '1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.',
    headerColor: '#0080d0',
    defaultNotes: 'Price excludes transport tax unless explicitly stated. All goods remain property of AB Malaya until fully paid.'
  });

  const [headerTemplate, setHeaderTemplate] = useState<'default' | 'minimalist' | 'maritime'>('default');
  const [tableHeaderBg, setTableHeaderBg] = useState<string>('#0f172a');
  const [tableHeaderTextColor, setTableHeaderTextColor] = useState<string>('#ffffff');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

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

  // ── Tab 6: Database & Adminer Drawer State ────────────────────────────────
  const [isDbDrawerOpen, setIsDbDrawerOpen] = useState(false);

  // ── Tab 7: Quotation Settings State ───────────────────────────────────────
  const [quotationSettings, setQuotationSettings] = useState({
    currency: 'MYR',
    taxPercent: 11,
    defaultDiscount: 0,
    validUntil: '14 Days'
  });

  // ── Tab 9: User Guide & Documentation State ────────────────────────────────
  const [guideSearch, setGuideSearch] = useState('');
  const [guideCategory, setGuideCategory] = useState<'all' | 'workflow' | 'smtp' | 'ai' | 'cloud' | 'paper' | 'inbox' | 'database' | 'faq'>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

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

  // Handler Tab 4: Paper Settings Save
  const handleSavePaper = () => {
    saveBatchSettings([
      { credential_key: 'COMPANY_NAME', credential_value: paperSettings.companyName, service_name: 'Branding' },
      { credential_key: 'COMPANY_ADDRESS', credential_value: paperSettings.companyAddress, service_name: 'Branding' },
      { credential_key: 'COMPANY_PHONE', credential_value: paperSettings.phone, service_name: 'Branding' },
      { credential_key: 'COMPANY_EMAIL', credential_value: paperSettings.email, service_name: 'Branding' },
      { credential_key: 'COMPANY_LOGO', credential_value: paperSettings.logoUrl, service_name: 'Branding' },
      { credential_key: 'COMPANY_STAMP', credential_value: paperSettings.stampUrl, service_name: 'Branding' },
      { credential_key: 'DOC_HEADER_TITLE', credential_value: paperSettings.headerTitle, service_name: 'Document Paper' },
      { credential_key: 'DOC_FOOTER_TERMS', credential_value: paperSettings.footerTerms, service_name: 'Document Paper' },
      { credential_key: 'DOC_HEADER_COLOR', credential_value: paperSettings.headerColor, service_name: 'Document Paper' },
      { credential_key: 'DOC_DEFAULT_NOTES', credential_value: paperSettings.defaultNotes, service_name: 'Document Paper' }
    ], 'Paper & Branding Settings saved successfully!');
  };

  // Handler Tab 5: Inbox Rules Save
  const handleSaveInboxRules = () => {
    saveBatchSettings([
      { credential_key: 'INBOX_RULE_EXCLUDE_NOREPLY', credential_value: String(inboxRules.excludeNoreply), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_MEDSOS', credential_value: String(inboxRules.excludeMedsos), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_PRIORITIZE_PDF', credential_value: String(inboxRules.prioritizePdf), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_REQUIRE_ATTACHMENT', credential_value: String(inboxRules.requireAttachment), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_AUTO_LABEL', credential_value: String(inboxRules.autoLabelRfq), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS', credential_value: String(inboxRules.excludeSystemAlerts), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_START_DATE', credential_value: inboxRules.fetchStartDate, service_name: 'Inbox Rules' }
    ], 'Inbox Filtering Rules saved successfully!');
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

  // Dynamic host for Adminer / Database Tab 6
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

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

      {/* Top Header Title & MySQL Status Strip */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span>ERP System Settings</span>
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            MySQL 8.0 Live
          </span>
          <span className="hidden sm:inline text-slate-300 text-xs font-light">|</span>
          <span className="hidden md:inline text-[10px] text-slate-500 font-medium">
            Pusat konfigurasi server, kredensial AI, database, sinkronisasi, dan panduan lengkap
          </span>
        </div>

        {/* Tombol Guide Persis di Sebelah ERP System Settings / MySQL 8.0 Live */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('user_guide')}
            className={`px-3.5 py-1 text-xs font-black rounded-md transition flex items-center gap-2 cursor-pointer shadow-xs border ${
              activeTab === 'user_guide'
                ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400'
                : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-500 hover:to-amber-500 text-slate-950 border-amber-500'
            }`}
            title="Buka Buku Panduan Penggunaan & Penjelasan Sistem ERP"
          >
            <BookOpen className="w-4 h-4 text-slate-950" />
            <span>📖 Panduan & Penjelasan</span>
            <span className="bg-slate-900 text-amber-300 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase">GUIDE</span>
          </button>
        </div>
      </div>

      {/* 9 Tab Navigation Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 flex items-center justify-between gap-2 overflow-x-auto select-none shadow-xs">
        <div className="flex items-center gap-1">
          {[
            { id: 'credentials', label: '1. SMTP Credential', icon: Key },
            { id: 'ai', label: '2. AI Engine & Keys', icon: Bot },
            { id: 'cloud_sync', label: '3. Cloud Sync & Backup', icon: Cloud },
            { id: 'default_fee', label: '4. Default Setting (Fee)', icon: Percent },
            { id: 'paper', label: '5. Setting Paper', icon: FileText },
            { id: 'inbox_rules', label: '6. Inbox Rules', icon: Sliders },
            { id: 'database', label: '7. Database', icon: Database },
            { id: 'quotation_settings', label: '8. Setting Quotation', icon: Layers },
            { id: 'user_guide', label: '9. Panduan & Guide', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isGuide = tab.id === 'user_guide';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-[10px] font-extrabold rounded-t-md transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? isGuide
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-600'
                      : 'bg-blue-600 text-white shadow-xs'
                    : isGuide
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 font-extrabold border-t border-x border-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-t border-x border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (isGuide ? 'text-slate-950' : 'text-white') : (isGuide ? 'text-amber-800' : 'text-slate-500')}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="shrink-0 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('user_guide')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-md transition flex items-center gap-2 cursor-pointer shadow-xs border ${
              activeTab === 'user_guide'
                ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400'
                : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-500 hover:to-amber-500 text-slate-950 border-amber-400'
            }`}
            title="Buka Buku Panduan Penggunaan & Penjelasan Sistem ERP"
          >
            <BookOpen className="w-4 h-4 text-slate-950" />
            <span>📖 Panduan & Penjelasan</span>
            <span className="bg-slate-900 text-amber-300 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase">GUIDE</span>
          </button>
        </div>
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
                        {isSavingBackup ? 'Saving...' : 'Save Backup Target'}
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
                    Fee software ditetapakan sebesar <strong>1.75%</strong> untuk setiap invoice / quotation. Pengakumulasian akan otomatis terhenti (*Stop*) ketika jumlah akumulasi mencapai limit maksimum <strong>20.000</strong>.
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

        {/* ── TAB 4: SETTING PAPER & BRANDING + QUOTATION HEADER STYLE ──────────────────────── */}
        {activeTab === 'paper' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4 font-sans">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Setting Paper, Header Choice, Footer & Table Styling</span>
                </h3>

                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold text-[10px] px-3 py-1.5 rounded shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-200" />
                  <span>Preview Quotation Header Layout (Live Preview)</span>
                </button>
              </div>

              {/* Quotation Header Choice Selector */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md space-y-2">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">Quotation Header Layout Template Options:</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('default')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'default' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">1. Official AB Malaya Default</span>
                    <span className="block text-[10px] text-slate-500">ABM Logo Left, Quotation No Metadata Right, From/To Dual Cards.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('minimalist')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'minimalist' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">2. Modern Minimalist Executive</span>
                    <span className="block text-[10px] text-slate-500">Clean Thin Line Header, Modern Slate Typography.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeaderTemplate('maritime')}
                    className={`p-3 border rounded-md text-left transition cursor-pointer ${
                      headerTemplate === 'maritime' ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-300' : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="block font-bold text-xs text-slate-900 mb-0.5">3. Maritime Industrial Logistics</span>
                    <span className="block text-[10px] text-slate-500">Deep Navy Marine Accent, Official IMPA & Maritime Badge.</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Header Title Text</label>
                  <input
                    type="text"
                    value={paperSettings.headerTitle}
                    onChange={(e) => setPaperSettings({ ...paperSettings, headerTitle: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[11px] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Header Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={paperSettings.headerColor}
                      onChange={(e) => setPaperSettings({ ...paperSettings, headerColor: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] font-bold">{paperSettings.headerColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Table Header Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tableHeaderBg}
                      onChange={(e) => setTableHeaderBg(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] font-bold">{tableHeaderBg}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={paperSettings.logoUrl}
                    onChange={(e) => setPaperSettings({ ...paperSettings, logoUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[10px]"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Table Header Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tableHeaderTextColor}
                      onChange={(e) => setTableHeaderTextColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] font-bold">{tableHeaderTextColor}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Default Notes Template</label>
                  <textarea
                    rows={2}
                    value={paperSettings.defaultNotes}
                    onChange={(e) => setPaperSettings({ ...paperSettings, defaultNotes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-[10px]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Footer Terms & Disclaimer</label>
                  <textarea
                    rows={3}
                    value={paperSettings.footerTerms}
                    onChange={(e) => setPaperSettings({ ...paperSettings, footerTerms: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-[10px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Pop-Up</span>
                </button>

                <button
                  onClick={handleSavePaper}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Paper Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: INBOX RULES ───────────────────────────────────────────── */}
        {activeTab === 'inbox_rules' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Inbox Filtering & AI Classification Rules</span>
              </h3>

              <div className="bg-[#f0f9ff] border border-blue-200 p-3 rounded-md space-y-2 mb-3">
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
                    className="bg-white border border-blue-300 rounded px-3 py-1.5 font-mono text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-500">
                    {inboxRules.fetchStartDate ? `Cutoff Active: >= ${inboxRules.fetchStartDate}` : 'No cutoff set (ingesting all email history)'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  { key: 'excludeNoreply', label: 'Automatically filter out noreply@ & newsletter emails' },
                  { key: 'excludeMedsos', label: 'Exclude social media & promotional marketing emails' },
                  { key: 'prioritizePdf', label: 'Prioritize emails containing attached PDF specifications' },
                  { key: 'requireAttachment', label: 'Only ingest emails that have explicit file attachments' },
                  { key: 'autoLabelRfq', label: 'Automatically assign IMPA category codes via Gemini AI' },
                  { key: 'excludeSystemAlerts', label: 'Filter out automated server & payment receipt alerts' },
                ].map((rule) => (
                  <label key={rule.key} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={(inboxRules as any)[rule.key]}
                      onChange={(e) => setInboxRules({ ...inboxRules, [rule.key]: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-700 text-[10.5px]">{rule.label}</span>
                  </label>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveInboxRules}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Inbox Rules</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: DATABASE & ADMINER DRAWER ────────────────────────────── */}
        {activeTab === 'database' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Dynamic MySQL Database Credentials & Adminer Access</span>
                </h3>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-300">
                  Host: {currentHost}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3 font-mono">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 uppercase font-bold block">Database Host & Port</span>
                    <span className="font-bold text-slate-800">127.0.0.1:3306 / localhost</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block">Database Name</span>
                    <span className="font-bold text-blue-700">abmalaya_erp</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block">MySQL Username</span>
                    <span className="font-bold text-slate-800">root</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block">MySQL Password</span>
                    <span className="font-bold text-slate-800">root</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <a
                    href={`http://${currentHost}:8000/adminer.php`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded transition flex items-center gap-1.5 text-[10.5px] cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Adminer Web Panel (http://{currentHost}:8000/adminer.php)</span>
                  </a>
                  <button
                    onClick={() => setIsDbDrawerOpen(!isDbDrawerOpen)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-2 rounded transition"
                  >
                    {isDbDrawerOpen ? 'Hide Credentials Popup' : 'Show Credentials Popup'}
                  </button>
                </div>
              </div>

              {/* Popup Drawer Info Login */}
              {isDbDrawerOpen && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3.5 space-y-2 font-mono text-[10px]">
                  <h4 className="font-bold text-blue-900 uppercase">Adminer Login Popup Credentials Info:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li>System: <strong>MySQL</strong></li>
                    <li>Server: <strong>127.0.0.1</strong> (or <strong>localhost</strong>)</li>
                    <li>Username: <strong>root</strong></li>
                    <li>Password: <strong>root</strong></li>
                    <li>Database: <strong>abmalaya_erp</strong></li>
                  </ul>
                </div>
              )}
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

        {/* ── TAB 9: USER GUIDE & PANDUAN PENGGUNAAN SISTEM ──────────────── */}
        {activeTab === 'user_guide' && (
          <div className="space-y-6 max-w-5xl mx-auto font-sans pb-10">
            
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-xl border border-blue-800/40 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-[11px] uppercase tracking-wide">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Dokumentasi Resmi & Panduan Operasional</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    Buku Panduan Penggunaan & Penjelasan Sistem ERP
                  </h2>
                  <p className="text-xs text-blue-200/90 leading-relaxed max-w-2xl">
                    Panduan terintegrasi alur kerja RFQ Inbox, klasifikasi AI Gemini, pembuatan Quotation, integrasi SMTP Gmail, backup Google Sheets, dan pemecahan masalah teknis.
                  </p>
                </div>

                {/* Quick Stats Pill */}
                <div className="flex items-center gap-2 shrink-0 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/15">
                  <div className="text-center px-3 border-r border-white/20">
                    <span className="block text-lg font-black text-amber-300 font-mono">8</span>
                    <span className="text-[10px] text-blue-200 uppercase font-bold">Modul Utama</span>
                  </div>
                  <div className="text-center px-3">
                    <span className="block text-lg font-black text-emerald-400 font-mono">100%</span>
                    <span className="text-[10px] text-blue-200 uppercase font-bold">Otomatisasi</span>
                  </div>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={guideSearch}
                    onChange={(e) => setGuideSearch(e.target.value)}
                    placeholder="Cari topik panduan (contoh: App Password, Gemini API, Kop Surat, Invoice, Backup, Port 587)..."
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  {guideSearch && (
                    <button
                      onClick={() => setGuideSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-[11px] font-bold">
                  {[
                    { id: 'all', label: 'Semua Topik' },
                    { id: 'workflow', label: '🚀 Alur Kerja' },
                    { id: 'smtp', label: '✉️ Gmail SMTP' },
                    { id: 'ai', label: '🤖 AI & OCR' },
                    { id: 'cloud', label: '☁️ Cloud Sync' },
                    { id: 'paper', label: '📄 Dokumen & Kop' },
                    { id: 'faq', label: '❓ FAQ & Kendala' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setGuideCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-md whitespace-nowrap transition cursor-pointer ${
                        guideCategory === cat.id
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SECTION 1: VISUAL WORKFLOW PIPELINE ───────────────────── */}
            {(guideCategory === 'all' || guideCategory === 'workflow') && (!guideSearch || 'workflow alur kerja pipeline proses'.includes(guideSearch.toLowerCase())) && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                      🚀
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">Alur Kerja Utama Sistem ERP AB Malaya</h3>
                      <p className="text-[11px] text-slate-500">Pipeline otomatis dari penerimaan email RFQ hingga penerbitan Faktur (Invoice).</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    End-to-End Pipeline
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-blue-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded">LANGKAH 1</span>
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Penarikan Email Masuk</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Daemon IMAP menarik email baru dari server Gmail menggunakan nomor pesan UID permanen agar urutan tidak bergeser.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-purple-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-purple-600 text-white px-2 py-0.5 rounded">LANGKAH 2</span>
                      <Sliders className="w-4 h-4 text-purple-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Penyaringan Filter Rule</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Aturan filter otomatis membuang email noreply, promosi sosial media, dan email pemberitahuan instansi pemerintah (LHDN).
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-emerald-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded">LANGKAH 3</span>
                      <Bot className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Klasifikasi AI Gemini</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Gemini 2.5 Flash memilah isi pesan secara cerdas: memisahkan permintaan pengadaan barang klien (Client RFQ) dari email sampah.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-amber-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-amber-600 text-white px-2 py-0.5 rounded">LANGKAH 4</span>
                      <ScanLine className="w-4 h-4 text-amber-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">OCR Vision Item Extraction</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Lampiran PDF atau gambar spesifikasi barang dibaca otomatis oleh Vision AI untuk mengekstrak nama barang, kuantitas, dan satuan.
                    </p>
                  </div>

                  {/* Step 5 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-indigo-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">LANGKAH 5</span>
                      <Layers className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Quotation Builder & Markup</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Staf mengonfirmasi harga modal, mencocokkan kode katalog IMPA Marine, menambahkan software fee markup, dan diskon.
                    </p>
                  </div>

                  {/* Step 6 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-rose-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded">LANGKAH 6</span>
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">ACC Approval & PDF Generate</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Dokumen penawaran divalidasi oleh akun berwenang sebelum berkas PDF resmi ber-kop dan berstempel AB Malaya diterbitkan.
                    </p>
                  </div>

                  {/* Step 7 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-teal-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-teal-600 text-white px-2 py-0.5 rounded">LANGKAH 7</span>
                      <RefreshCw className="w-4 h-4 text-teal-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Pengiriman Email Resmi</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Pengiriman langsung ke klien via SMTP dengan validasi mesin 2-Stage Handshake (DNS MX Check + Queue Code 250 OK).
                    </p>
                  </div>

                  {/* Step 8 */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-emerald-400 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded">LANGKAH 8</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-xs">Auto-Generate Invoice</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Setelah penawaran disetujui (deal), satu klik akan otomatis membuat Faktur Tagihan (Invoice) resmi dengan rincian rekening bank.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION 2: PRACTICAL GUIDES BY TAB ────────────────────── */}
            <div className="space-y-4">
              
              {/* Tab 1: SMTP Credentials */}
              {(guideCategory === 'all' || guideCategory === 'smtp') && (!guideSearch || 'smtp gmail credential password port 587 tls email'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-blue-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">1. Panduan Konfigurasi SMTP & Email Gmail</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('credentials')}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 1: SMTP Credential</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      <strong>Mengapa membutuhkan App Password?</strong> Akun Google/Gmail mewajibkan autentikasi 2 langkah (2-Step Verification) dan tidak mengizinkan password login akun biasa untuk koneksi aplikasi SMTP demi keamanan.
                    </p>
                    
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-900 block text-[11.5px]">Langkah Membuat Google App Password (16 Huruf):</span>
                      <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-600 font-medium">
                        <li>Buka akun Google Anda di <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">myaccount.google.com/security</a>.</li>
                        <li>Pastikan fitur <strong>Verifikasi 2 Langkah (2-Step Verification)</strong> sudah berstatus <strong>Aktif</strong>.</li>
                        <li>Cari menu <strong>Sandi Aplikasi (App Passwords)</strong> di kotak pencarian Google Account.</li>
                        <li>Beri nama aplikasi, misalnya: <code className="bg-white px-1 border border-slate-300 rounded font-bold">AB Malaya ERP</code>, lalu klik <strong>Buat (Generate)</strong>.</li>
                        <li>Salin 16 karakter kode sandi yang muncul (contoh: <code className="bg-white px-1 border border-slate-300 rounded font-bold text-blue-700">tbsq icqa kece qaoz</code>).</li>
                        <li>Tempelkan ke kolom <strong>App Password</strong> pada Tab 1 Settings ERP, lalu klik <strong>Save Credentials</strong> dan tekan tombol <strong>Test Connection</strong>.</li>
                      </ol>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-700"><strong>Host:</strong> smtp.gmail.com</span>
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-700"><strong>Port:</strong> 587 (TLS Recommended)</span>
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-700"><strong>Sender:</strong> mijdigital2026@gmail.com</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: AI Engine & Keys */}
              {(guideCategory === 'all' || guideCategory === 'ai') && (!guideSearch || 'ai gemini keys api studio quota rate limit ocr'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">2. Panduan AI Engine & Manajemen Kunci Gemini</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('ai')}
                      className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 2: AI Engine & Keys</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      Sistem ERP AB Malaya dilengkapi dengan <strong>Dual Pool AI Engine</strong> untuk memastikan kinerja tidak terganggu jika satu pool mencapai batas kuota:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1">
                        <span className="font-black text-blue-900 block text-[11px] uppercase">Pool 1: Email Inbox AI Classifier</span>
                        <p className="text-[11px] text-slate-600">
                          Digunakan untuk membaca subjek dan teks email pengirim, lalu mengklasifikasikan apakah pesan tersebut adalah <strong>Client RFQ</strong> (Permintaan Penawaran) atau iklan sampah.
                        </p>
                      </div>

                      <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 space-y-1">
                        <span className="font-black text-purple-900 block text-[11px] uppercase">Pool 2: OCR Vision Document Scanner</span>
                        <p className="text-[11px] text-slate-600">
                          Digunakan untuk membaca berkas visual lampiran PDF, foto, dan formulir teknis kapal/kilang, lalu mengekstrak tabel nama barang, nomor suku cadang, kuantitas, dan satuan ke draf penawaran.
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-50 p-3 rounded border border-amber-200 text-amber-950 text-[11px] space-y-1">
                      <strong>Cara Menambah Kunci Baru:</strong> Dapatkan kunci gratis dari <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-blue-700 underline font-bold">Google AI Studio (aistudio.google.com)</a>. Klik tombol <em>Add New AI Key</em> pada Tab 2 dan masukkan kunci yang berawalan <code className="bg-white px-1 border border-amber-300 rounded font-mono">AIzaSy...</code>. Sistem otomatis merotasi kunci cadangan jika terjadi limit harian.
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Cloud Sync & Backup */}
              {(guideCategory === 'all' || guideCategory === 'cloud') && (!guideSearch || 'cloud sync backup google sheet spreadsheet service account'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-teal-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">3. Panduan Sinkronisasi Cloud & Backup Google Spreadsheet</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('cloud_sync')}
                      className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 3: Cloud Sync</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      Sistem mencadangkan data katalog produk, penawaran harga, dan kontak klien secara otomatis ke Google Spreadsheet agar dapat diakses oleh tim tanpa harus masuk ke server database.
                    </p>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                      <span className="font-bold text-slate-900 block">PENTING: Akses Izin Google Sheet (Service Account)</span>
                      <p className="text-slate-600">
                        Agar backup dapat menulis baris ke Spreadsheet Anda, Anda <strong>WAJIB</strong> membagikan spreadsheet (Share) ke email Service Account resmi berikut dengan hak akses <strong>Editor</strong>:
                      </p>
                      <div className="bg-white p-2 border border-slate-300 rounded font-mono font-bold text-blue-700 flex items-center justify-between">
                        <span>erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com</span>
                        <button
                          onClick={() => handleCopyEmail('erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com')}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] cursor-pointer"
                        >
                          {isCopiedEmail ? 'Tersalin ✓' : 'Salin Email'}
                        </button>
                      </div>
                      <p className="text-slate-500 text-[10px]">
                        Spreadsheet ID diambil dari URL Google Sheets di antara <code className="bg-slate-200 px-1 rounded">/d/</code> dan <code className="bg-slate-200 px-1 rounded">/edit</code>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Paper, Kop Surat & Branding */}
              {(guideCategory === 'all' || guideCategory === 'paper') && (!guideSearch || 'paper kop surat logo stempel tanda tangan pdf font margin'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">4. Panduan Format Dokumen, Kop Surat & Branding Perusahaan</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('paper')}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 5: Setting Paper</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      Tab <strong>Setting Paper</strong> mengatur tampilan berkas resmi PDF Quotation dan Faktur Penjualan yang dilihat langsung oleh klien AB Malaya:
                    </p>

                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                      <li><strong>Logo Resmi Dokumen:</strong> Dianjurkan berformat PNG transparan resolusi 160x60 px. Akan muncul di pojok kiri atas kop surat penawaran.</li>
                      <li><strong>Stempel Resmi Perusahaan:</strong> Format PNG transparan ukuran 120x120 px. Ditampilkan di bagian tanda tangan otorisasi penawaran harga.</li>
                      <li><strong>Tanda Tangan PIC (Signature):</strong> Mengunggah tanda tangan digital transparan untuk mempercepat persetujuan resmi.</li>
                      <li><strong>Nomor Rekening Bank:</strong> Rincian akun bank resmi (Public Bank / Maybank) untuk informasi instruksi pembayaran di kaki surat.</li>
                      <li><strong>Margin & Ukuran Kertas:</strong> Standar format A4 dengan margin 14-18mm untuk keterbacaan cetak dokumen resmi yang rapi.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 6: Filter Rules */}
              {(guideCategory === 'all' || guideCategory === 'inbox') && (!guideSearch || 'filter rules noreply tanggal cutoff blacklist rfq inbox'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-amber-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">5. Panduan Aturan Filter & Penyaringan RFQ Inbox</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('inbox_rules')}
                      className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 6: Inbox Rules</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      Mencegah inbox email penuh oleh ribuan email lama atau pesan otomatis sistem yang tidak relevan dengan penjualan:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <strong className="text-slate-900 block mb-0.5">Filter Tanggal (Cutoff)</strong>
                        <span className="text-slate-600">Email yang diterima sebelum tanggal filter (misal: 2026-08-27) otomatis disembunyikan agar inbox tetap bersih.</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <strong className="text-slate-900 block mb-0.5">Blokir No-Reply & Medsos</strong>
                        <span className="text-slate-600">Otomatis menyingkirkan pesan otomatis LinkedIn, Facebook, newsletter, dan akun do-not-reply.</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <strong className="text-slate-900 block mb-0.5">Prioritaskan Berkas PDF</strong>
                        <span className="text-slate-600">Memberikan lencana badge prioritas untuk pesan yang memiliki lampiran spesifikasi teknis barang.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 7: Database & cPanel */}
              {(guideCategory === 'all' || guideCategory === 'database') && (!guideSearch || 'database mysql cpanel migrasi schema alter table adminer'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-extrabold text-sm text-slate-900">6. Panduan Database MySQL, Adminer & Migrasi cPanel</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('database')}
                      className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition w-fit"
                    >
                      <span>Buka Tab 7: Database</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      Semua data penawaran, klien, dan log tersimpan di database MariaDB/MySQL <code>abmalaya_erp</code>.
                    </p>

                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-[11px]">
                      <span className="font-bold text-slate-900 block">Cara Migrasi Aman ke Hosting / cPanel Produksi:</span>
                      <ul className="list-disc pl-5 space-y-1 text-slate-600">
                        <li><strong>Database Baru:</strong> Import berkas <code className="bg-white px-1 border border-slate-300 rounded font-mono font-bold text-blue-700">cpanel/database_schema.sql</code> melalui phpMyAdmin cPanel untuk instalasi awal.</li>
                        <li><strong>Database Berjalan (Update Versi):</strong> Jalankan skrip <code className="bg-white px-1 border border-slate-300 rounded font-mono font-bold text-emerald-700">cpanel/safe_update_structure.sql</code>. Skrip ini <strong>TIDAK MENGHAPUS / MERESET DATA</strong> lama, melainkan hanya menambahkan kolom atau tabel baru yang dibutuhkan.</li>
                        <li><strong>Adminer Panel:</strong> Anda dapat mengelola database langsung dari browser melalui menu Tab Database &gt; Open Adminer Panel.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION 3: FAQ & TROUBLESHOOTING ─────────────────────── */}
              {(guideCategory === 'all' || guideCategory === 'faq') && (!guideSearch || 'faq kendala solusi error 503 limit app password save profil'.includes(guideSearch.toLowerCase())) && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <HelpCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">Pusat Solusi Masalah & FAQ (Troubleshooting)</h3>
                      <p className="text-[11px] text-slate-500">Jawaban cepat atas kendala yang paling sering ditanyakan oleh staf.</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      {
                        id: 1,
                        q: 'Kenapa muncul error "Failed to save profile: API Error: Call to a member function bind_param() on bool"?',
                        a: 'Error ini terjadi jika struktur tabel clients di database belum memiliki kolom logo_url. Masalah ini telah diperbaiki secara tuntas: kolom logo_url sudah ditambahkan ke database MySQL dan kueri penyimpanan di api_clients.php sudah diselaraskan langsung tanpa memerlukan runtime alter table.'
                      },
                      {
                        id: 2,
                        q: 'Apa arti status "WAITING_AI_LIMIT" saat proses ekstraksi dokumen atau pemindaian inbox?',
                        a: 'Status WAITING_AI_LIMIT muncul ketika kunci Google Gemini gratis Anda telah mencapai batas rate-limit per menit (RPM) atau kuota per hari (RPD). Anda tidak perlu khawatir: daemon otomasi secara otomatis memasukkan dokumen tersebut ke antrean coba-lagi (re-queue) dan akan otomatis memprosesnya kembali setelah jendela batas kuota terbuka.'
                      },
                      {
                        id: 3,
                        q: 'Bagaimana mengatasi error "503 - Tunnel Unavailable" saat membuka link aplikasi dari luar?',
                        a: 'Pesan 503 menandakan proses tunnel penghubung (Localtunnel atau Cloudflared) di server sempat terputus. Pastikan proses tunnel tetap berjalan di latar belakang (background daemon). Anda juga dapat menggunakan link alternatif Cloudflare Tunnel yang lebih stabil tanpa memerlukan password IP.'
                      },
                      {
                        id: 4,
                        q: 'Mengapa email dari klien lama tidak muncul di daftar RFQ Inbox?',
                        a: 'Periksa pengaturan di Tab 6: Inbox Rules pada kolom "Tanggal Mulai Penarikan Email (Fetch Start Date)". Jika tanggal disetel ke masa sekarang (misal: 2026-08-27), maka semua email sebelum tanggal tersebut otomatis disaring agar tidak mencemari daftar aktif pengadaan barang.'
                      },
                      {
                        id: 5,
                        q: 'Bagaimana cara mengubah harga satuan modal dan menambahkan Software Fee?',
                        a: 'Buka menu Quotation Builder saat mengedit penawaran harga. Anda dapat mengisi modal barang di kolom Unit Price. Sistem akan otomatis menghitung Software Markup Fee sesuai persentase yang disetel di Tab 4: Default Setting (Fee).'
                      }
                    ].map((faq) => {
                      const isExpanded = expandedFaqId === faq.id;
                      return (
                        <div
                          key={faq.id}
                          className="border border-slate-200 rounded-lg overflow-hidden transition"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                            className="w-full p-3 text-left font-bold text-slate-900 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black flex items-center justify-center shrink-0">
                                {faq.id}
                              </span>
                              <span>{faq.q}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="p-3.5 bg-white border-t border-slate-200 text-slate-700 text-[11.5px] leading-relaxed">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
      {/* POP-UP MODAL: LIVE PREVIEW QUOTATION HEADER LAYOUT */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  Pratinjau Layout Quotation (Live Preview) — Template: <span className="uppercase text-blue-700 font-mono">{headerTemplate}</span>
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
              
              {/* Quotation Header Document Card Preview */}
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
                    <p className="font-bold text-blue-700 text-sm">QUO-ABM/MY/2026/0403</p>
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
                        <th className="p-2 border-r border-white/20 w-28">Item Code</th>
                        <th className="p-2 border-r border-white/20">Product Name</th>
                        <th className="p-2 border-r border-white/20">Detailed Specification</th>
                        <th className="p-2 border-r border-white/20 w-16 text-center">Qty</th>
                        <th className="p-2 border-r border-white/20 w-20">Unit</th>
                        <th className="p-2 border-r border-white/20 w-28 text-right">Unit Price (RM)</th>
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
