// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SMTPConfig } from '../types/erp';
import { decryptData, encryptData } from '../utils/crypto';
import { 
  Key, Database, CheckCircle2, Eye, EyeOff, Save, 
  FileText, Sliders, Bot, AlertTriangle, 
  Plus, Edit3, Trash2, Percent, ExternalLink, 
  Activity, Layers, Server, Cpu, Calendar, ScanLine,
  Cloud, RefreshCw, ShieldCheck, Copy, Check, Receipt, Building2, CreditCard,
  Mail, MessageSquare, Package, FileSpreadsheet, Lock, Sparkles, CheckCircle,
  SlidersHorizontal, Upload, X, Shield, Terminal, HardDrive
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
  // 8 Humanized Ordered Tabs
  const [activeTab, setActiveTab] = useState<
    'credentials' | 'inbox_rules' | 'ai' | 'paper' | 'quotation_settings' | 'invoice' | 'cloud_sync' | 'database'
  >('credentials');

  // Cloud Sync & Multi-Spreadsheet Backup State
  const [backupsList, setBackupsList] = useState<any[]>([]);
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

  // Common Notification Banner State
  const [isSaved, setIsSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('Data berhasil disimpan ke Database SQL!');

  // ── Tab 1: SMTP Credentials ───────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [plainPassword, setPlainPassword] = useState(decryptData(smtpConfig.app_password));
  const [formConfig, setFormConfig] = useState<SMTPConfig>({ ...smtpConfig });

  // ── Tab 2: Filter Email Masuk ─────────────────────────────────────────────
  const [inboxRules, setInboxRules] = useState({
    excludeNoreply: true,
    excludeMedsos: true,
    prioritizePdf: true,
    requireAttachment: false,
    autoLabelRfq: true,
    excludeSystemAlerts: true,
    fetchStartDate: ''
  });

  // ── Tab 3: Kunci AI Gemini ────────────────────────────────────────────────
  const [inboxAiKeys, setInboxAiKeys] = useState<AIKeyItem[]>([
    {
      id: 'inbox-key-1',
      alias: 'Gemini Inbox Key 1 (Primary Production)',
      key: 'AIzaSyAm...0DWU',
      status: 'active',
      dailyRequests: 14,
      dailyLimit: '20 RPM / 1,500 RPD',
      tokensUsed: 42800,
      modelName: 'gemini-2.5-flash',
      engineName: 'Deteksi & Klasifikasi RFQ Email AI'
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
      modelName: 'gemini-2.5-flash',
      engineName: 'Vision OCR Pemindai Dokumen Lampiran'
    }
  ]);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingKeyItem, setEditingKeyItem] = useState<AIKeyItem | null>(null);
  const [modalKeyPool, setModalKeyPool] = useState<'inbox' | 'ocr'>('inbox');
  const [modalAlias, setModalAlias] = useState('');
  const [modalKeyString, setModalKeyString] = useState('');

  // ── Tab 4: Setting Format Kertas SPH ──────────────────────────────────────
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
    footerText: 'sales@abmalaya.com, +60 3-8000 1234, abmalaya.com',
    headerColor: '#0080d0',
    defaultNotes: 'Price excludes transport tax unless explicitly stated. All goods remain property of AB Malaya until fully paid.',
    paperSize: 'A4',
    marginTop: 18,
    marginBottom: 18,
    marginLeft: 14,
    marginRight: 14,
    fontSize: 9
  });
  const [headerTemplate, setHeaderTemplate] = useState<'default' | 'modern' | 'compact' | 'classic'>('default');
  const [tableHeaderBg, setTableHeaderBg] = useState('#0f172a');
  const [tableHeaderTextColor, setTableHeaderTextColor] = useState('#ffffff');
  const [isUploadingPaperImage, setIsUploadingPaperImage] = useState(false);

  // ── Tab 5: Penawaran & Fee Sistem ─────────────────────────────────────────
  const [quotationSettings, setQuotationSettings] = useState({
    currency: 'MYR',
    taxPercent: 11,
    defaultDiscount: 0,
    validUntil: '14 Days'
  });

  const [softwareFee, setSoftwareFee] = useState({
    percent: 1.75,
    maxLimit: 20000,
    currentAccumulated: 1245.50
  });

  // ── Tab 6: Setting Format Invoice ─────────────────────────────────────────
  const [invoiceSettings, setInvoiceSettings] = useState({
    companyName: 'AB MALAYA INDUSTRY',
    companyRegNo: '003320457-D',
    companyAddress: 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur',
    phone: '+60 3-8000 1234',
    email: 'abmalayaindustry@gmail.com',
    website: 'abmalaya.com',
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
    footerText: 'abmalayaindustry@gmail.com, +60 3-8000 1234, abmalaya.com',
    authorisedByName: 'Muhammad Aimanuddin Bin Mohd Zaki',
    authorisedByTitle: 'Procurement Manager / Head of Sales',
    receivedByLabel: 'Received by,',
    receivedByNameLabel: 'Name / Designation: ______________________',
    receivedByDateLabel: 'Date: ____ / ____ / ________',
    tableHeaderBg: '#0070c0',
    tableHeaderTextColor: '#ffffff',
    paperSize: 'A4',
    marginTop: 18,
    marginBottom: 18,
    marginLeft: 14,
    marginRight: 14,
    fontSize: 9
  });
  const [isUploadingInvoiceImage, setIsUploadingInvoiceImage] = useState(false);

  const [showPlainKeyMap, setShowPlainKeyMap] = useState<Record<string, boolean>>({});

  const toggleShowPlainKey = (id: string) => {
    setShowPlainKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKeyStr = (keyStr: string) => {
    if (!keyStr) return '';
    if (keyStr.length <= 16) return keyStr;
    return keyStr.substring(0, 10) + '••••••••' + keyStr.substring(keyStr.length - 6);
  };

  const handleCopyEmail = (emailStr: string) => {
    try {
      navigator.clipboard.writeText(emailStr);
      setIsCopiedEmail(true);
      setTimeout(() => setIsCopiedEmail(false), 3000);
    } catch (e) {
      alert('Service Account Email: ' + emailStr);
    }
  };

  // Listen for navigation events from other views
  useEffect(() => {
    const handleNav = (e: any) => {
      if (e.detail) {
        if (e.detail === 'credentials') setActiveTab('credentials');
        else if (e.detail === 'inbox_rules') setActiveTab('inbox_rules');
        else if (e.detail === 'ai') setActiveTab('ai');
        else if (e.detail === 'paper') setActiveTab('paper');
        else if (e.detail === 'quotation_settings' || e.detail === 'default_fee') setActiveTab('quotation_settings');
        else if (e.detail === 'invoice_settings' || e.detail === 'invoice') setActiveTab('invoice');
        else if (e.detail === 'cloud_sync') setActiveTab('cloud_sync');
        else if (e.detail === 'database') setActiveTab('database');
      }
    };
    window.addEventListener('navigate_settings_tab', handleNav);
    return () => window.removeEventListener('navigate_settings_tab', handleNav);
  }, []);

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
            if (k === 'DOC_FOOTER_TEXT') paper.footerText = v;
            if (k === 'DOC_HEADER_COLOR') paper.headerColor = v;
            if (k === 'DOC_DEFAULT_NOTES') paper.defaultNotes = v;
            if (k === 'DOC_HEADER_TEMPLATE') setHeaderTemplate(v as any);
            if (k === 'TABLE_HEADER_BG') setTableHeaderBg(v);
            if (k === 'TABLE_HEADER_TEXT_COLOR') setTableHeaderTextColor(v);

            // Inbox Rules & Date Cutoff
            if (k === 'INBOX_RULE_EXCLUDE_NOREPLY') rules.excludeNoreply = v === 'true';
            if (k === 'INBOX_RULE_EXCLUDE_MEDSOS') rules.excludeMedsos = v === 'true';
            if (k === 'INBOX_RULE_PRIORITIZE_PDF') rules.prioritizePdf = v === 'true';
            if (k === 'INBOX_RULE_REQUIRE_ATTACHMENT') rules.requireAttachment = v === 'true';
            if (k === 'INBOX_RULE_AUTO_LABEL') rules.autoLabelRfq = v === 'true';
            if (k === 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS') rules.excludeSystemAlerts = v === 'true';
            if (k === 'INBOX_RULE_START_DATE' || k === 'CLIENT_CHAT_START_DATE') rules.fetchStartDate = v;

            // Quotation Settings
            if (k === 'DOC_CURRENCY') quo.currency = v;
            if (k === 'DOC_TAX_PERCENT') quo.taxPercent = Number(v);
            if (k === 'DOC_DEFAULT_DISCOUNT') quo.defaultDiscount = Number(v);
            if (k === 'DOC_VALID_UNTIL') quo.validUntil = v;

            // SMTP
            if (k === 'SMTP_HOST') setFormConfig((prev) => ({ ...prev, host: v }));
            if (k === 'SMTP_PORT') setFormConfig((prev) => ({ ...prev, port: Number(v) }));
            if (k === 'SMTP_EMAIL' || k === 'SMTP_USERNAME') {
              setFormConfig((prev) => ({ ...prev, from_email: v, username: v }));
            }
            if (k === 'SMTP_APP_PASSWORD') {
              setFormConfig((prev) => ({ ...prev, app_password: encryptData(v) }));
              setPlainPassword(v);
            }
          });

          setInboxRules(rules);
          setPaperSettings(paper);
          setQuotationSettings(quo);
          setSoftwareFee(fee);
        }
      })
      .catch((err) => console.log('Fetch credentials error:', err));

    // Load AI Keys
    fetch(getApiUrl('/api_gemini_keys.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          const inbox: AIKeyItem[] = [];
          const ocr: AIKeyItem[] = [];

          resData.data.forEach((item: any) => {
            const parsed: AIKeyItem = {
              id: item.id ? String(item.id) : `key-${Date.now()}`,
              alias: item.key_alias || item.alias || 'Gemini Key',
              key: item.api_key || item.key || '',
              status: item.status || 'active',
              dailyRequests: Number(item.daily_requests || 0),
              dailyLimit: item.daily_limit || '20 RPM / 1,500 RPD',
              tokensUsed: Number(item.tokens_used || 0),
              modelName: item.model_name || 'gemini-2.5-flash',
              engineName: item.pool_type === 'ocr' ? 'OCR Vision Scan' : 'Klasifikasi RFQ Inbox'
            };
            if (item.pool_type === 'ocr') ocr.push(parsed);
            else inbox.push(parsed);
          });

          if (inbox.length > 0) setInboxAiKeys(inbox);
          if (ocr.length > 0) setOcrAiKeys(ocr);
        }
      })
      .catch((err) => console.log('Fetch AI keys error:', err));

    // Load Paper Settings Dedicated Table
    fetch(getApiUrl('/api_paper_settings.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setPaperSettings((prev) => ({
            ...prev,
            companyName: resData.data.company_name || prev.companyName,
            companyAddress: resData.data.company_address || prev.companyAddress,
            phone: resData.data.phone || prev.phone,
            email: resData.data.email || prev.email,
            logoUrl: resData.data.logo_url || prev.logoUrl,
            stampUrl: resData.data.stamp_url || prev.stampUrl,
            signatureUrl: resData.data.signature_url || prev.signatureUrl,
            headerImageUrl: resData.data.header_image_url || prev.headerImageUrl,
            bankName: resData.data.bank_name || prev.bankName,
            bankAccountNumber: resData.data.bank_account_number || prev.bankAccountNumber,
            bankAccountName: resData.data.bank_account_name || prev.bankAccountName,
            bankEmail: resData.data.bank_email || prev.bankEmail,
            headerTitle: resData.data.header_title || prev.headerTitle,
            footerTerms: resData.data.footer_terms || prev.footerTerms,
            footerText: resData.data.footer_text || prev.footerText,
            headerColor: resData.data.header_color || prev.headerColor,
            defaultNotes: resData.data.default_notes || prev.defaultNotes,
            paperSize: resData.data.paper_size || 'A4',
            marginTop: Number(resData.data.margin_top || 18),
            marginBottom: Number(resData.data.margin_bottom || 18),
            marginLeft: Number(resData.data.margin_left || 14),
            marginRight: Number(resData.data.margin_right || 14),
            fontSize: Number(resData.data.font_size || 9)
          }));
          if (resData.data.table_header_bg) setTableHeaderBg(resData.data.table_header_bg);
          if (resData.data.table_header_text_color) setTableHeaderTextColor(resData.data.table_header_text_color);
        }
      })
      .catch((err) => console.log('Fetch paper settings error:', err));

    // Load Invoice Settings Dedicated Table
    fetch(getApiUrl('/api_invoice_settings.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setInvoiceSettings((prev) => ({
            ...prev,
            companyName: resData.data.company_name || prev.companyName,
            companyRegNo: resData.data.company_reg_no || prev.companyRegNo,
            companyAddress: resData.data.company_address || prev.companyAddress,
            phone: resData.data.phone || prev.phone,
            email: resData.data.email || prev.email,
            website: resData.data.website || prev.website,
            logoUrl: resData.data.logo_url || prev.logoUrl,
            stampUrl: resData.data.stamp_url || prev.stampUrl,
            signatureUrl: resData.data.signature_url || prev.signatureUrl,
            headerImageUrl: resData.data.header_image_url || prev.headerImageUrl,
            invoiceTitle: resData.data.invoice_title || prev.invoiceTitle,
            bankName: resData.data.bank_name || prev.bankName,
            bankAccountNumber: resData.data.bank_account_number || prev.bankAccountNumber,
            bankAccountName: resData.data.bank_account_name || prev.bankAccountName,
            bankEmail: resData.data.bank_email || prev.bankEmail,
            remarksText: resData.data.remarks_text || prev.remarksText,
            footerText: resData.data.footer_text || prev.footerText,
            authorisedByName: resData.data.authorised_by_name || prev.authorisedByName,
            authorisedByTitle: resData.data.authorised_by_title || prev.authorisedByTitle,
            receivedByLabel: resData.data.received_by_label || prev.receivedByLabel,
            receivedByNameLabel: resData.data.received_by_name_label || prev.receivedByNameLabel,
            receivedByDateLabel: resData.data.received_by_date_label || prev.receivedByDateLabel,
            tableHeaderBg: resData.data.table_header_bg || '#0070c0',
            tableHeaderTextColor: resData.data.table_header_text_color || '#ffffff',
            paperSize: resData.data.paper_size || 'A4',
            marginTop: Number(resData.data.margin_top || 18),
            marginBottom: Number(resData.data.margin_bottom || 18),
            marginLeft: Number(resData.data.margin_left || 14),
            marginRight: Number(resData.data.margin_right || 14),
            fontSize: Number(resData.data.font_size || 9)
          }));
        }
      })
      .catch((err) => console.log('Fetch invoice settings error:', err));

    loadBackupsList();
  }, []);

  const loadBackupsList = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=get_backups'))
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.backups) {
          setBackupsList(data.backups);
        } else if (data.data) {
          setBackupsList(data.data);
        }
      })
      .catch((err) => console.log('Load backup targets error:', err));
  };

  const saveBatchSettings = (items: Array<{ credential_key: string; credential_value: string; service_name: string }>, customMsg?: string) => {
    fetch(getApiUrl('/api_credentials.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_batch', items })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(customMsg || 'Data berhasil disimpan ke Database SQL!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Gagal simpan: ' + (resData.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => alert('Error simpan: ' + err.message));
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...formConfig,
      app_password: encryptData(plainPassword)
    };
    onSaveSmtpConfig(updated);

    saveBatchSettings([
      { credential_key: 'SMTP_HOST', credential_value: formConfig.host, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_PORT', credential_value: String(formConfig.port), service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_EMAIL', credential_value: formConfig.from_email || formConfig.username, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_USERNAME', credential_value: formConfig.from_email || formConfig.username, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_APP_PASSWORD', credential_value: plainPassword, service_name: 'SMTP Credentials' }
    ], 'Pengaturan Server Email & SMTP berhasil disimpan ke Database SQL!');
  };

  const handleSaveInboxRules = () => {
    saveBatchSettings([
      { credential_key: 'INBOX_RULE_START_DATE', credential_value: inboxRules.fetchStartDate || '', service_name: 'Inbox Rules' },
      { credential_key: 'CLIENT_CHAT_START_DATE', credential_value: inboxRules.fetchStartDate || '', service_name: 'Client Chat Settings' },
      { credential_key: 'INBOX_RULE_EXCLUDE_NOREPLY', credential_value: String(inboxRules.excludeNoreply), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_MEDSOS', credential_value: String(inboxRules.excludeMedsos), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_PRIORITIZE_PDF', credential_value: String(inboxRules.prioritizePdf), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_REQUIRE_ATTACHMENT', credential_value: String(inboxRules.requireAttachment), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_AUTO_LABEL', credential_value: String(inboxRules.autoLabelRfq), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS', credential_value: String(inboxRules.excludeSystemAlerts), service_name: 'Inbox Rules' }
    ], 'Aturan filter email & batas tanggal berhasil disimpan ke Database SQL!');
  };

  const persistAiKeysPool = (pool: 'inbox' | 'ocr', list: AIKeyItem[], msg?: string) => {
    fetch(getApiUrl('/api_gemini_keys.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_batch',
        pool_type: pool,
        keys: list.map((k) => ({
          id: k.id,
          alias: k.alias,
          api_key: k.key,
          status: k.status,
          daily_requests: k.dailyRequests,
          daily_limit: k.dailyLimit,
          tokens_used: k.tokensUsed,
          model_name: k.modelName
        }))
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(msg || 'Kunci AI Gemini berhasil disimpan ke Database SQL!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        }
      })
      .catch((err) => console.log('Persist AI keys error:', err));
  };

  const handleAddAiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalKeyString.trim()) return;

    if (modalKeyPool === 'inbox') {
      let updatedList = [...inboxAiKeys];
      if (editingKeyItem) {
        updatedList = updatedList.map((x) =>
          x.id === editingKeyItem.id
            ? { ...x, alias: modalAlias || x.alias, key: modalKeyString }
            : x
        );
      } else {
        updatedList.push({
          id: `inbox-key-${Date.now()}`,
          alias: modalAlias || `Gemini Inbox Key ${updatedList.length + 1}`,
          key: modalKeyString,
          status: 'active',
          dailyRequests: 0,
          dailyLimit: '20 RPM / 1,500 RPD',
          tokensUsed: 0,
          modelName: 'gemini-2.5-flash',
          engineName: 'Deteksi & Klasifikasi RFQ Email AI'
        });
      }
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Kunci AI Gemini Inbox berhasil disimpan ke Database SQL!');
    } else {
      let updatedList = [...ocrAiKeys];
      if (editingKeyItem) {
        updatedList = updatedList.map((x) =>
          x.id === editingKeyItem.id
            ? { ...x, alias: modalAlias || x.alias, key: modalKeyString }
            : x
        );
      } else {
        updatedList.push({
          id: `ocr-key-${Date.now()}`,
          alias: modalAlias || `Gemini OCR Key ${updatedList.length + 1}`,
          key: modalKeyString,
          status: 'active',
          dailyRequests: 0,
          dailyLimit: '20 RPM / 1,500 RPD',
          tokensUsed: 0,
          modelName: 'gemini-2.5-flash',
          engineName: 'Vision OCR Pemindai Dokumen Lampiran'
        });
      }
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'Kunci AI Gemini OCR Scan berhasil disimpan ke Database SQL!');
    }

    setIsAiModalOpen(false);
    setEditingKeyItem(null);
    setModalAlias('');
    setModalKeyString('');
  };

  const handleDeleteAiKey = (id: string, pool: 'inbox' | 'ocr') => {
    if (!confirm('Yakin ingin menghapus kunci AI ini dari database?')) return;
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.filter((x) => x.id !== id);
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Kunci AI berhasil dihapus dari Database SQL!');
    } else {
      const updatedList = ocrAiKeys.filter((x) => x.id !== id);
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'Kunci AI OCR berhasil dihapus dari Database SQL!');
    }
  };

  const handleToggleAiKeyStatus = (id: string, pool: 'inbox' | 'ocr') => {
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.map((x) =>
        x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x
      );
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Status Kunci AI diperbarui di Database SQL!');
    } else {
      const updatedList = ocrAiKeys.map((x) =>
        x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x
      );
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'Status Kunci AI OCR diperbarui di Database SQL!');
    }
  };

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
        footer_text: paperSettings.footerText,
        header_color: paperSettings.headerColor,
        default_notes: paperSettings.defaultNotes,
        header_template: headerTemplate,
        table_header_bg: tableHeaderBg,
        table_header_text_color: tableHeaderTextColor,
        paper_size: paperSettings.paperSize,
        margin_top: paperSettings.marginTop,
        margin_bottom: paperSettings.marginBottom,
        margin_left: paperSettings.marginLeft,
        margin_right: paperSettings.marginRight,
        font_size: paperSettings.fontSize
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage('Format Kertas SPH berhasil disimpan ke Database SQL!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Gagal simpan: ' + (resData.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => alert('Error simpan format kertas: ' + err.message));
  };

  const handleSaveQuotationSettings = () => {
    saveBatchSettings([
      { credential_key: 'DOC_CURRENCY', credential_value: quotationSettings.currency, service_name: 'Quotation Settings' },
      { credential_key: 'DOC_TAX_PERCENT', credential_value: String(quotationSettings.taxPercent), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_DEFAULT_DISCOUNT', credential_value: String(quotationSettings.defaultDiscount), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_VALID_UNTIL', credential_value: quotationSettings.validUntil, service_name: 'Quotation Settings' },
      { credential_key: 'SOFTWARE_FEE_PERCENT', credential_value: String(softwareFee.percent), service_name: 'System Fee' },
      { credential_key: 'SOFTWARE_FEE_MAX_LIMIT', credential_value: String(softwareFee.maxLimit), service_name: 'System Fee' }
    ], 'Pengaturan Penawaran & Fee Sistem berhasil disimpan ke Database SQL!');
  };

  const handleUploadPaperImage = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature' | 'header_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    if (type === 'logo') formData.append('logo_file', file);
    else if (type === 'stamp') formData.append('stamp_file', file);
    else if (type === 'signature') formData.append('signature_file', file);
    else formData.append('header_image_file', file);

    setIsUploadingPaperImage(true);
    fetch(getApiUrl('/api_paper_settings.php'), {
      method: 'POST',
      body: formData
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsUploadingPaperImage(false);
        if (resData.status === 'success' && resData.data) {
          if (type === 'logo' && resData.data.logo_url) setPaperSettings((prev) => ({ ...prev, logoUrl: resData.data.logo_url }));
          if (type === 'stamp' && resData.data.stamp_url) setPaperSettings((prev) => ({ ...prev, stampUrl: resData.data.stamp_url }));
          if (type === 'signature' && resData.data.signature_url) setPaperSettings((prev) => ({ ...prev, signatureUrl: resData.data.signature_url }));
          if (type === 'header_image' && resData.data.header_image_url) setPaperSettings((prev) => ({ ...prev, headerImageUrl: resData.data.header_image_url }));
          setSavedMessage(`Gambar SPH berhasil diunggah dan disimpan ke Database SQL!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Upload gagal: ' + (resData.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => {
        setIsUploadingPaperImage(false);
        alert('Upload error: ' + err.message);
      });
  };

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
        website: invoiceSettings.website,
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
        footer_text: invoiceSettings.footerText,
        authorised_by_name: invoiceSettings.authorisedByName,
        authorised_by_title: invoiceSettings.authorisedByTitle,
        received_by_label: invoiceSettings.receivedByLabel,
        received_by_name_label: invoiceSettings.receivedByNameLabel,
        received_by_date_label: invoiceSettings.receivedByDateLabel,
        table_header_bg: invoiceSettings.tableHeaderBg,
        table_header_text_color: invoiceSettings.tableHeaderTextColor,
        paper_size: invoiceSettings.paperSize,
        margin_top: invoiceSettings.marginTop,
        margin_bottom: invoiceSettings.marginBottom,
        margin_left: invoiceSettings.marginLeft,
        margin_right: invoiceSettings.marginRight,
        font_size: invoiceSettings.fontSize
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage('Format Invoice berhasil disimpan ke Database SQL!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Gagal simpan: ' + (resData.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => alert('Error simpan format invoice: ' + err.message));
  };

  const handleUploadInvoiceImage = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp' | 'signature' | 'header_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    if (type === 'logo') formData.append('logo_file', file);
    else if (type === 'stamp') formData.append('stamp_file', file);
    else if (type === 'signature') formData.append('signature_file', file);
    else formData.append('header_image_file', file);

    setIsUploadingInvoiceImage(true);
    fetch(getApiUrl('/api_invoice_settings.php'), {
      method: 'POST',
      body: formData
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsUploadingInvoiceImage(false);
        if (resData.status === 'success' && resData.data) {
          if (type === 'logo' && resData.data.logo_url) setInvoiceSettings((prev) => ({ ...prev, logoUrl: resData.data.logo_url }));
          if (type === 'stamp' && resData.data.stamp_url) setInvoiceSettings((prev) => ({ ...prev, stampUrl: resData.data.stamp_url }));
          if (type === 'signature' && resData.data.signature_url) setInvoiceSettings((prev) => ({ ...prev, signatureUrl: resData.data.signature_url }));
          if (type === 'header_image' && resData.data.header_image_url) setInvoiceSettings((prev) => ({ ...prev, headerImageUrl: resData.data.header_image_url }));
          setSavedMessage(`Gambar Invoice berhasil diunggah dan disimpan ke Database SQL!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Upload gagal: ' + (resData.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => {
        setIsUploadingInvoiceImage(false);
        alert('Upload error: ' + err.message);
      });
  };

  const handleTestConnection = (id: number, sheetId: string) => {
    setTestingConnectionId(id);
    fetch(getApiUrl('/api_spreadsheet_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test_connection', spreadsheet_id: sheetId, id })
    })
      .then((res) => res.json())
      .then((data) => {
        setTestingConnectionId(null);
        setConnectionResultsMap((prev) => ({
          ...prev,
          [id]: {
            status: data.status === 'success' ? 'success' : 'error',
            message: data.message || (data.status === 'success' ? 'Koneksi Terverifikasi' : 'Gagal Terhubung'),
            docTitle: data.doc_title || data.document_title
          }
        }));
      })
      .catch((err) => {
        setTestingConnectionId(null);
        setConnectionResultsMap((prev) => ({
          ...prev,
          [id]: { status: 'error', message: err.message }
        }));
      });
  };

  const handleRunBackupNow = (id: number) => {
    setRunningBackupId(id);
    fetch(getApiUrl('/api_spreadsheet_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_backup_now', id, backup_id: id })
    })
      .then((res) => res.json())
      .then((data) => {
        setRunningBackupId(null);
        if (data.status === 'success') {
          setSavedMessage(`Sinkronisasi ke Spreadsheet berhasil: ${data.total_rows || data.rows_synced || 0} baris produk tersimpan!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
          loadBackupsList();
        } else {
          alert('Sinkronisasi gagal: ' + (data.message || 'Terjadi kesalahan'));
        }
      })
      .catch((err) => {
        setRunningBackupId(null);
        alert('Error sinkronisasi: ' + err.message);
      });
  };

  const handleDeleteBackupTarget = (id: number) => {
    if (!confirm('Yakin ingin menghapus target spreadsheet ini?')) return;
    fetch(getApiUrl('/api_spreadsheet_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_backup', id })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          loadBackupsList();
        } else {
          alert(data.message || 'Gagal menghapus target');
        }
      })
      .catch((err) => console.log('Hapus target backup error:', err));
  };

  const handleAddBackupTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupSpreadsheetId.trim()) return;

    setIsSavingBackup(true);
    fetch(getApiUrl('/api_spreadsheet_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_backup',
        title: backupTitle || 'Master Products Backup',
        spreadsheet_id: backupSpreadsheetId,
        sheet_name: backupSheetName || 'Sheet1',
        service_account_email: backupSaEmail,
        key_filename: backupKeyFile,
        is_primary: backupIsPrimary ? 1 : 0
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSavingBackup(false);
        if (data.status === 'success') {
          setIsAddBackupModalOpen(false);
          setBackupTitle('');
          setBackupSpreadsheetId('');
          setBackupIsPrimary(false);
          loadBackupsList();
          setSavedMessage('Target Spreadsheet baru berhasil ditambahkan!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Gagal menambah target: ' + (data.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSavingBackup(false);
        alert('Error: ' + err.message);
      });
  };

  // 8 Humanized Ordered Tabs Metadata
  const tabs = [
    { id: 'credentials', label: '1. Server Email & SMTP', icon: Key, badge: 'Email' },
    { id: 'inbox_rules', label: '2. Filter Email Masuk', icon: Sliders, badge: 'Rules' },
    { id: 'ai', label: '3. Kunci AI Gemini', icon: Bot, badge: 'AI Pool' },
    { id: 'paper', label: '4. Format Kertas SPH', icon: FileText, badge: 'SPH' },
    { id: 'quotation_settings', label: '5. Penawaran & Fee', icon: Percent, badge: 'Fee' },
    { id: 'invoice', label: '6. Format Invoice', icon: Receipt, badge: 'Invoice' },
    { id: 'cloud_sync', label: '7. Simpan ke Spreadsheet', icon: Cloud, badge: 'Spreadsheet' },
    { id: 'database', label: '8. Status Database SQL', icon: Database, badge: 'MySQL' },
  ];

  // Core MySQL Tables Registry
  const coreTables = [
    { name: 'rfq_requests', label: 'Daftar RFQ Masuk', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel RFQ', desc: 'Menyimpan permintaan penawaran harga dari email masuk atau input manual.' },
    { name: 'quotations', label: 'Dokumen Surat Penawaran (SPH)', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel SPH', desc: 'Data header, nomor SPH, total harga, PPN, dan masa berlaku penawaran.' },
    { name: 'quotation_items', label: 'Rincian Item Penawaran', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel Item SPH', desc: 'Baris produk, kode IMPA, kuantitas, harga satuan, dan diskon per item.' },
    { name: 'invoices', label: 'Dokumen Invoice Resmi', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel Invoice', desc: 'Data faktur penagihan, nomor invoice, tanggal jatuh tempo, dan status bayar.' },
    { name: 'invoice_items', label: 'Rincian Item Invoice', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel Item Invoice', desc: 'Baris rincian barang/jasa yang ditagihkan dalam invoice.' },
    { name: 'products', label: 'Katalog Master Produk', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel Produk', desc: 'Master data barang, kode IMPA/SKU, nama produk, harga modal, dan supplier.' },
    { name: 'product_categories', label: 'Kategori Produk', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Tabel Kategori', desc: 'Struktur hierarki kategori produk dan aturan klasifikasi otomatis.' },
    { name: 'product_change_logs', label: 'Riwayat Perubahan Produk', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Log Produk', desc: 'Audit log perubahan harga, spesifikasi, dan stok barang.' },
    { name: 'spreadsheet_backups', label: 'Target Backup Spreadsheet', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Target Cloud', desc: 'Daftar ID Google Sheets untuk sinkronisasi otomatis katalog produk.' },
    { name: 'gemini_api_keys', label: 'Kunci AI Gemini (Inbox & OCR)', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Pool AI Keys', desc: 'Daftar API Key Gemini untuk klasifikasi RFQ otomatis & scan OCR PDF.' },
    { name: 'api_credentials', label: 'Konfigurasi Sistem & Password', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Config Store', desc: 'Penyimpanan server email SMTP, aturan filter, dan batas tanggal.' },
    { name: 'system_paper_settings', label: 'Pengaturan Format Kertas SPH', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Format SPH', desc: 'Kop surat, logo, cap resmi, tanda tangan, dan rekening bank penawaran.' },
    { name: 'system_invoice_settings', label: 'Pengaturan Format Invoice', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Format Invoice', desc: 'Kop invoice, nomor SSM, penandatangan, footer, dan rekening bank invoice.' },
    { name: 'users', label: 'Daftar Pengguna Sistem', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Akun Pengguna', desc: 'Data akun login, hak akses (Admin, Sales, Finance), dan status aktif.' },
    { name: 'user_activity_logs', label: 'Log Aktivitas Pengguna', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Audit Log', desc: 'Rekaman aktivitas login, pengiriman penawaran, dan perubahan sistem.' },
  ];

  return (
    <div className="w-full flex-1 bg-[#f1f5f9] text-slate-800 font-sans min-h-screen flex flex-col">
      {/* ── TOP SEGMENTED TOOLBAR (Apple / Classic ERP Density) ─────────────── */}
      <header className="w-full bg-[#1e293b] border-b border-slate-800 shadow-md text-white sticky top-0 z-20">
        <div className="w-full px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-xs">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black tracking-tight text-white uppercase">Pengaturan Sistem (System Settings)</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded border border-blue-400/30">SQL Data Save Mode</span>
              </div>
              <p className="text-[11px] text-slate-400">Konfigurasi server email, kunci AI, format dokumen, dan database MySQL.</p>
            </div>
          </div>

          {/* Top Tabs Navigation Buttons */}
          <nav className="flex items-center flex-wrap gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── NOTIFICATION TOAST BANNER ────────────────────────────────────────── */}
      {isSaved && (
        <div className="w-full bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{savedMessage}</span>
          </div>
          <span className="text-[10px] bg-emerald-700 px-2 py-0.5 rounded text-emerald-100 font-mono">Tersimpan di MySQL</span>
        </div>
      )}

      {/* ── MAIN CONTENT AREA (FULL-WIDTH HIGH-DENSITY) ──────────────────────── */}
      <main className="w-full flex-1 p-4 md:p-6 space-y-4">

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: SERVER EMAIL & SMTP
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'credentials' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pengaturan Server Email & SMTP (Tersimpan di MySQL: api_credentials)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">smtp.gmail.com : Port 587 (TLS)</span>
              </div>

              <form onSubmit={handleSaveSmtp} className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={formConfig.host}
                      onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={formConfig.port}
                      onChange={(e) => setFormConfig({ ...formConfig, port: Number(e.target.value) })}
                      placeholder="587"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Username / Email Pengirim</label>
                    <input
                      type="email"
                      value={formConfig.from_email || formConfig.username}
                      onChange={(e) => setFormConfig({ ...formConfig, from_email: e.target.value, username: e.target.value })}
                      placeholder="sales@abmalaya.com"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">App Password (16 Digit)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={plainPassword}
                        onChange={(e) => setPlainPassword(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono pr-8"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Kredensial disimpan secara terenkripsi ke database MySQL tabel <code className="text-blue-600">api_credentials</code>.</span>
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs text-xs transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Pengaturan Email ke Database SQL</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: FILTER EMAIL MASUK (INBOX RULES)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'inbox_rules' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Aturan Filter Email Masuk & Batas Tanggal Pengambilan</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Tersimpan di MySQL: api_credentials</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Date Boundary */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Batas Tanggal Awal Pengambilan Email (Ingest Date Cutoff)</span>
                    <p className="text-[11px] text-slate-500">Email yang masuk sebelum tanggal ini akan diabaikan secara otomatis untuk mempercepat sinkronisasi.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={inboxRules.fetchStartDate}
                      onChange={(e) => setInboxRules({ ...inboxRules, fetchStartDate: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setInboxRules({ ...inboxRules, fetchStartDate: '' })}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:bg-slate-200 rounded"
                    >
                      Reset Tanggal
                    </button>
                  </div>
                </div>

                {/* Rules Table */}
                <div className="w-full border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-12 text-center">Status</th>
                        <th className="p-2.5 w-1/3">Nama Aturan Filter</th>
                        <th className="p-2.5">Keterangan & Logika Filter</th>
                        <th className="p-2.5 w-24 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.excludeNoreply ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Filter Otomatis Email Noreply & Newsletter</td>
                        <td className="p-2.5 text-slate-600">Mengabaikan email dengan pengirim noreply@, do-not-reply@, atau buletin promosi.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.excludeNoreply}
                            onChange={(e) => setInboxRules({ ...inboxRules, excludeNoreply: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.excludeMedsos ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Filter Media Sosial & Notifikasi Iklan</td>
                        <td className="p-2.5 text-slate-600">Mengabaikan notifikasi LinkedIn, Facebook, Instagram, atau promosi iklan pemasaran.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.excludeMedsos}
                            onChange={(e) => setInboxRules({ ...inboxRules, excludeMedsos: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.excludeSystemAlerts ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Filter Notifikasi Pajak & LHDN / Sistem Otomatis</td>
                        <td className="p-2.5 text-slate-600">Mengabaikan email hasil.gov.my, invoice tagihan server otomatis, atau konfirmasi gateway.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.excludeSystemAlerts}
                            onChange={(e) => setInboxRules({ ...inboxRules, excludeSystemAlerts: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.prioritizePdf ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Prioritaskan Email yang Memiliki Lampiran PDF</td>
                        <td className="p-2.5 text-slate-600">Menempatkan email permintaan harga dengan lampiran PDF di baris teratas daftar RFQ.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.prioritizePdf}
                            onChange={(e) => setInboxRules({ ...inboxRules, prioritizePdf: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.requireAttachment ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Wajib Memiliki Lampiran File (Attachment Only)</td>
                        <td className="p-2.5 text-slate-600">Hanya mengambil email yang memiliki file lampiran dokumen/gambar penawaran.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.requireAttachment}
                            onChange={(e) => setInboxRules({ ...inboxRules, requireAttachment: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${inboxRules.autoLabelRfq ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">Otomatis Deteksi Kategori Produk via AI Gemini</td>
                        <td className="p-2.5 text-slate-600">AI otomatis memetakan subjek email ke kode IMPA / kategori kapal yang sesuai.</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={inboxRules.autoLabelRfq}
                            onChange={(e) => setInboxRules({ ...inboxRules, autoLabelRfq: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveInboxRules}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs text-xs transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Aturan Filter ke Database SQL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: KUNCI AI GEMINI (INBOX & OCR POOLS)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ai' && (
          <div className="w-full space-y-4">
            {/* Pool 1: Inbox AI */}
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Pool Kunci AI Gemini: Deteksi & Klasifikasi Email RFQ</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalKeyPool('inbox');
                    setEditingKeyItem(null);
                    setModalAlias(`Gemini Inbox Key ${inboxAiKeys.length + 1}`);
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Kunci AI Inbox</span>
                </button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5 w-48">Alias Kunci</th>
                      <th className="p-2.5">String Kunci API (Tersimpan di MySQL: gemini_api_keys)</th>
                      <th className="p-2.5 w-24 text-center">Status</th>
                      <th className="p-2.5 w-28 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {inboxAiKeys.map((item, idx) => {
                      const isPlain = showPlainKeyMap[item.id];
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800">{item.alias}</td>
                          <td className="p-2.5 font-mono text-slate-600">
                            {isPlain ? item.key : maskKeyStr(item.key)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => toggleShowPlainKey(item.id)}
                                title="Lihat/Sembunyikan Kunci"
                                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200"
                              >
                                {isPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAiKeyStatus(item.id, 'inbox')}
                                title="Aktif/Nonaktifkan"
                                className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAiKey(item.id, 'inbox')}
                                title="Hapus Kunci"
                                className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pool 2: OCR Vision AI */}
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ScanLine className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Pool Kunci AI Gemini: Vision OCR Pemindai Dokumen Lampiran</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalKeyPool('ocr');
                    setEditingKeyItem(null);
                    setModalAlias(`Gemini OCR Key ${ocrAiKeys.length + 1}`);
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Kunci AI OCR</span>
                </button>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5 w-48">Alias Kunci</th>
                      <th className="p-2.5">String Kunci API (Tersimpan di MySQL: gemini_api_keys)</th>
                      <th className="p-2.5 w-24 text-center">Status</th>
                      <th className="p-2.5 w-28 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {ocrAiKeys.map((item, idx) => {
                      const isPlain = showPlainKeyMap[item.id];
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800">{item.alias}</td>
                          <td className="p-2.5 font-mono text-slate-600">
                            {isPlain ? item.key : maskKeyStr(item.key)}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => toggleShowPlainKey(item.id)}
                                title="Lihat/Sembunyikan Kunci"
                                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200"
                              >
                                {isPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAiKeyStatus(item.id, 'ocr')}
                                title="Aktif/Nonaktifkan"
                                className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAiKey(item.id, 'ocr')}
                                title="Hapus Kunci"
                                className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: FORMAT KERTAS SPH (QUOTATION)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'paper' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pengaturan Format Kertas Surat Penawaran Harga (SPH / Quotation)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Tersimpan di MySQL: system_paper_settings</span>
              </div>

              <div className="p-4 space-y-4 text-xs">
                {/* Bagian 1: Identitas & Kop Surat */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">1. Identitas Badan Usaha & Judul Kop SPH</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Perusahaan Penawar</label>
                      <input
                        type="text"
                        value={paperSettings.companyName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, companyName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Resmi Penawaran</label>
                      <input
                        type="email"
                        value={paperSettings.email}
                        onChange={(e) => setPaperSettings({ ...paperSettings, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. Telepon / WhatsApp</label>
                      <input
                        type="text"
                        value={paperSettings.phone}
                        onChange={(e) => setPaperSettings({ ...paperSettings, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Alamat Kantor / Workshop</label>
                      <input
                        type="text"
                        value={paperSettings.companyAddress}
                        onChange={(e) => setPaperSettings({ ...paperSettings, companyAddress: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Judul Dokumen Kop (Header Title)</label>
                      <input
                        type="text"
                        value={paperSettings.headerTitle}
                        onChange={(e) => setPaperSettings({ ...paperSettings, headerTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Upload Gambar & Cap */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">2. Logo Resmi, Cap Perusahaan, dan Tanda Tangan Digital SPH</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Logo Perusahaan</span>
                      {paperSettings.logoUrl && <img src={paperSettings.logoUrl} alt="Logo" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Logo
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'logo')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Cap Resmi SPH</span>
                      {paperSettings.stampUrl && <img src={paperSettings.stampUrl} alt="Stamp" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Cap
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'stamp')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Tanda Tangan Digital</span>
                      {paperSettings.signatureUrl && <img src={paperSettings.signatureUrl} alt="TTD" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah TTD
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'signature')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Gambar Kop Atas (Opsional)</span>
                      {paperSettings.headerImageUrl && <img src={paperSettings.headerImageUrl} alt="Header" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Gambar Kop
                        <input type="file" accept="image/*" onChange={(e) => handleUploadPaperImage(e, 'header_image')} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Rekening Bank Penawaran */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">3. Rekening Bank untuk Pembayaran SPH</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={paperSettings.bankName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={paperSettings.bankAccountNumber}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Pemilik Rekening</label>
                      <input
                        type="text"
                        value={paperSettings.bankAccountName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Notifikasi Bank</label>
                      <input
                        type="email"
                        value={paperSettings.bankEmail}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankEmail: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 4: Syarat & Footer SPH */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">4. Catatan Bawah & Syarat Ketentuan Penawaran</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Syarat & Ketentuan (Terms)</label>
                      <textarea
                        rows={3}
                        value={paperSettings.footerTerms}
                        onChange={(e) => setPaperSettings({ ...paperSettings, footerTerms: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Teks Footer Kaki Dokumen</label>
                      <textarea
                        rows={3}
                        value={paperSettings.footerText}
                        onChange={(e) => setPaperSettings({ ...paperSettings, footerText: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Catatan Default Penawaran</label>
                      <textarea
                        rows={3}
                        value={paperSettings.defaultNotes}
                        onChange={(e) => setPaperSettings({ ...paperSettings, defaultNotes: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-sans"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 5: Margin & Ukuran Kertas */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">5. Ukuran Kertas & Margin Cetak SPH</span>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ukuran Kertas</label>
                      <select
                        value={paperSettings.paperSize}
                        onChange={(e) => setPaperSettings({ ...paperSettings, paperSize: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      >
                        <option value="A4">A4 (Standard)</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Atas (mm)</label>
                      <input
                        type="number"
                        value={paperSettings.marginTop}
                        onChange={(e) => setPaperSettings({ ...paperSettings, marginTop: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Bawah (mm)</label>
                      <input
                        type="number"
                        value={paperSettings.marginBottom}
                        onChange={(e) => setPaperSettings({ ...paperSettings, marginBottom: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Kiri (mm)</label>
                      <input
                        type="number"
                        value={paperSettings.marginLeft}
                        onChange={(e) => setPaperSettings({ ...paperSettings, marginLeft: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Kanan (mm)</label>
                      <input
                        type="number"
                        value={paperSettings.marginRight}
                        onChange={(e) => setPaperSettings({ ...paperSettings, marginRight: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ukuran Font (pt)</label>
                      <input
                        type="number"
                        value={paperSettings.fontSize}
                        onChange={(e) => setPaperSettings({ ...paperSettings, fontSize: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePaper}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs text-xs transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Format Kertas SPH ke Database SQL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 5: PARAMETER PENAWARAN & FEE SISTEM
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'quotation_settings' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pengaturan Pajak, Diskon Penawaran & Fee Sistem</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Tersimpan di MySQL: api_credentials</span>
              </div>

              <div className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bagian 1: Parameter Penawaran SPH */}
                  <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                    <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">Parameter Nilai Penawaran (SPH)</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mata Uang Dokumen</label>
                        <input
                          type="text"
                          value={quotationSettings.currency}
                          onChange={(e) => setQuotationSettings({ ...quotationSettings, currency: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">PPN / Tax (%)</label>
                        <input
                          type="number"
                          value={quotationSettings.taxPercent}
                          onChange={(e) => setQuotationSettings({ ...quotationSettings, taxPercent: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Diskon Default (%)</label>
                        <input
                          type="number"
                          value={quotationSettings.defaultDiscount}
                          onChange={(e) => setQuotationSettings({ ...quotationSettings, defaultDiscount: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Masa Berlaku Penawaran</label>
                        <input
                          type="text"
                          value={quotationSettings.validUntil}
                          onChange={(e) => setQuotationSettings({ ...quotationSettings, validUntil: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bagian 2: Fee Software Sistem */}
                  <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                    <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">Fee Software & Maintenance ERP</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Persentase Fee (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={softwareFee.percent}
                          onChange={(e) => setSoftwareFee({ ...softwareFee, percent: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Batas Maksimal Fee (MYR)</label>
                        <input
                          type="number"
                          value={softwareFee.maxLimit}
                          onChange={(e) => setSoftwareFee({ ...softwareFee, maxLimit: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-800"
                        />
                      </div>
                      <div className="col-span-2 p-2 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900">Total Akumulasi Fee Terhitung:</span>
                        <span className="text-xs font-mono font-black text-emerald-800">MYR {softwareFee.currentAccumulated.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveQuotationSettings}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs text-xs transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Pengaturan Nilai & Fee ke Database SQL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 6: FORMAT INVOICE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-[#0070c0]" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Pengaturan Format Invoice Resmi (Tersimpan di MySQL: system_invoice_settings)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Dedicated Invoice Table</span>
              </div>

              <div className="p-4 space-y-4 text-xs">
                {/* Bagian 1: Identitas Badan Usaha Invoice */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">1. Identitas Badan Usaha Invoice</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Perusahaan Penerbit</label>
                      <input
                        type="text"
                        value={invoiceSettings.companyName}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. Registrasi Perusahaan (SSM)</label>
                      <input
                        type="text"
                        value={invoiceSettings.companyRegNo}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyRegNo: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Judul Faktur (Invoice Title)</label>
                      <input
                        type="text"
                        value={invoiceSettings.invoiceTitle}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Resmi Invoice</label>
                      <input
                        type="email"
                        value={invoiceSettings.email}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Website</label>
                      <input
                        type="text"
                        value={invoiceSettings.website}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, website: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. Telepon</label>
                      <input
                        type="text"
                        value={invoiceSettings.phone}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Alamat Penagihan Resmi</label>
                      <input
                        type="text"
                        value={invoiceSettings.companyAddress}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, companyAddress: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Logo, Cap & Gambar Invoice */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">2. Logo Resmi, Cap Perusahaan, dan TTD Digital Invoice</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Logo Invoice</span>
                      {invoiceSettings.logoUrl && <img src={invoiceSettings.logoUrl} alt="Logo" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Logo
                        <input type="file" accept="image/*" onChange={(e) => handleUploadInvoiceImage(e, 'logo')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Cap Resmi Invoice</span>
                      {invoiceSettings.stampUrl && <img src={invoiceSettings.stampUrl} alt="Stamp" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Cap
                        <input type="file" accept="image/*" onChange={(e) => handleUploadInvoiceImage(e, 'stamp')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Tanda Tangan Digital</span>
                      {invoiceSettings.signatureUrl && <img src={invoiceSettings.signatureUrl} alt="TTD" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah TTD
                        <input type="file" accept="image/*" onChange={(e) => handleUploadInvoiceImage(e, 'signature')} className="hidden" />
                      </label>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded text-center space-y-2">
                      <span className="text-[11px] font-bold block text-slate-700">Gambar Kop Atas</span>
                      {invoiceSettings.headerImageUrl && <img src={invoiceSettings.headerImageUrl} alt="Header" className="h-10 mx-auto object-contain" />}
                      <label className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded cursor-pointer text-[11px]">
                        Unggah Gambar Kop
                        <input type="file" accept="image/*" onChange={(e) => handleUploadInvoiceImage(e, 'header_image')} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Pejabat Penandatangan & Label Penerima */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">3. Pejabat Penandatangan & Format Penerima Invoice</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Pejabat Penandatangan (Authorised By)</label>
                      <input
                        type="text"
                        value={invoiceSettings.authorisedByName}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, authorisedByName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jabatan Penandatangan (Designation)</label>
                      <input
                        type="text"
                        value={invoiceSettings.authorisedByTitle}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, authorisedByTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Label Penerima (Received By Label)</label>
                      <input
                        type="text"
                        value={invoiceSettings.receivedByLabel}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, receivedByLabel: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Label Garis Nama Penerima</label>
                      <input
                        type="text"
                        value={invoiceSettings.receivedByNameLabel}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, receivedByNameLabel: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Label Garis Tanggal Penerima</label>
                      <input
                        type="text"
                        value={invoiceSettings.receivedByDateLabel}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, receivedByDateLabel: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 4: Rekening Bank Pembayaran Invoice */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">4. Rekening Bank untuk Pembayaran Invoice</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={invoiceSettings.bankName}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={invoiceSettings.bankAccountNumber}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankAccountNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Pemilik Rekening</label>
                      <input
                        type="text"
                        value={invoiceSettings.bankAccountName}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankAccountName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Bukti Pembayaran</label>
                      <input
                        type="email"
                        value={invoiceSettings.bankEmail}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankEmail: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 5: Catatan Petunjuk Pembayaran & Footer */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">5. Catatan Petunjuk Pembayaran & Footer Kaki Invoice</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Petunjuk Pembayaran (Remarks)</label>
                      <textarea
                        rows={4}
                        value={invoiceSettings.remarksText}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, remarksText: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Teks Footer Kaki Dokumen</label>
                      <textarea
                        rows={4}
                        value={invoiceSettings.footerText}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerText: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-sans"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 6: Warna Header & Margin Invoice */}
                <div className="border border-slate-200 rounded p-3 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 block border-b border-slate-200 pb-1.5 uppercase text-[11px]">6. Warna Header Tabel & Margin Kertas Invoice</span>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Warna Header Tabel</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={invoiceSettings.tableHeaderBg}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderBg: e.target.value })}
                          className="w-7 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={invoiceSettings.tableHeaderBg}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, tableHeaderBg: e.target.value })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-[11px]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Atas (mm)</label>
                      <input
                        type="number"
                        value={invoiceSettings.marginTop}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, marginTop: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Bawah (mm)</label>
                      <input
                        type="number"
                        value={invoiceSettings.marginBottom}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, marginBottom: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Kiri (mm)</label>
                      <input
                        type="number"
                        value={invoiceSettings.marginLeft}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, marginLeft: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Margin Kanan (mm)</label>
                      <input
                        type="number"
                        value={invoiceSettings.marginRight}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, marginRight: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ukuran Font (pt)</label>
                      <input
                        type="number"
                        value={invoiceSettings.fontSize}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, fontSize: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveInvoiceSettings}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs text-xs transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Format Invoice ke Database SQL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 7: SIMPAN KE SPREADSHEET (GOOGLE SHEETS & DRIVE BACKUP)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'cloud_sync' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Simpan ke Spreadsheet: Target Google Sheets & Backup Cloud</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBackupModalOpen(true)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Target Spreadsheet</span>
                </button>
              </div>

              {/* Service Account Email Info */}
              <div className="p-3 bg-emerald-50/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-emerald-900">Email Service Account Google:</span>{' '}
                  <code className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">{backupSaEmail}</code>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Pastikan email di atas telah di-share sebagai <b className="text-emerald-900">Editor</b> di file Google Spreadsheet Anda.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyEmail(backupSaEmail)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold inline-flex items-center space-x-1"
                >
                  {isCopiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedEmail ? 'Tersalin!' : 'Salin Email'}</span>
                </button>
              </div>

              {/* Backups List Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5 w-48">Nama Target</th>
                      <th className="p-2.5">Spreadsheet ID & Sheet Name</th>
                      <th className="p-2.5 w-24 text-center">Tipe</th>
                      <th className="p-2.5 w-40 text-center">Terakhir Disinkronkan</th>
                      <th className="p-2.5 w-56 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {backupsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Belum ada target Google Spreadsheet. Klik tombol <b>Tambah Target Spreadsheet</b> di atas.
                        </td>
                      </tr>
                    ) : (
                      backupsList.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800">{item.title}</td>
                          <td className="p-2.5">
                            <div className="font-mono text-slate-600">{item.spreadsheet_id}</div>
                            <span className="text-[10px] text-slate-400">Sheet: {item.sheet_name || 'Sheet1'}</span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_primary ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                              {item.is_primary ? 'Primary' : 'Secondary'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono text-[11px] text-slate-500">
                            {item.last_synced_at || 'Belum pernah'}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                disabled={testingConnectionId === item.id}
                                onClick={() => handleTestConnection(item.id, item.spreadsheet_id)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold inline-flex items-center space-x-1"
                              >
                                {testingConnectionId === item.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 text-blue-600" />}
                                <span>Tes</span>
                              </button>
                              <button
                                type="button"
                                disabled={runningBackupId === item.id}
                                onClick={() => handleRunBackupNow(item.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold inline-flex items-center space-x-1"
                              >
                                {runningBackupId === item.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                <span>Simpan Sekarang</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBackupTarget(item.id)}
                                title="Hapus Target"
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
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
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 8: STATUS DATABASE SQL & DATA TABEL
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'database' && (
          <div className="w-full space-y-4">
            <div className="w-full bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Status Database SQL & Data Tabel Tersimpan (MySQL Registry)</span>
                </div>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                  MySQL Engine Active (15 Tables)
                </span>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5 w-48 font-mono">Nama Tabel SQL</th>
                      <th className="p-2.5 w-56">Fungsi & Label Modul</th>
                      <th className="p-2.5">Keterangan Data yang Disimpan</th>
                      <th className="p-2.5 w-24 text-center">Storage</th>
                      <th className="p-2.5 w-24 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {coreTables.map((t, idx) => (
                      <tr key={t.name} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold font-mono text-blue-700">{t.name}</td>
                        <td className="p-2.5 font-bold text-slate-800">{t.label}</td>
                        <td className="p-2.5 text-slate-600">{t.desc}</td>
                        <td className="p-2.5 text-center font-mono text-[11px]">{t.type}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Tersedia
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── MODAL: TAMBAH / EDIT KUNCI AI ────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-300 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">
                {editingKeyItem ? 'Edit Kunci AI Gemini' : `Tambah Kunci AI (${modalKeyPool === 'ocr' ? 'OCR Vision Scan' : 'Klasifikasi RFQ'})`}
              </span>
              <button type="button" onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAiKeySubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Alias / Nama Label Kunci</label>
                <input
                  type="text"
                  value={modalAlias}
                  onChange={(e) => setModalAlias(e.target.value)}
                  placeholder="Gemini API Key 1"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">String API Key Gemini (AIzaSy... / AQ...)</label>
                <textarea
                  rows={3}
                  value={modalKeyString}
                  onChange={(e) => setModalKeyString(e.target.value)}
                  placeholder="Paste string API key dari Google AI Studio di sini..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-mono text-[11px] focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs"
                >
                  Simpan Kunci ke Database SQL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TAMBAH TARGET SPREADSHEET ─────────────────────────────────── */}
      {isAddBackupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-300 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">Tambah Target Google Spreadsheet Baru</span>
              <button type="button" onClick={() => setIsAddBackupModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBackupTarget} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Judul / Label Spreadsheet</label>
                <input
                  type="text"
                  value={backupTitle}
                  onChange={(e) => setBackupTitle(e.target.value)}
                  placeholder="Master Products Catalog Sheet"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Spreadsheet ID (Dari URL Google Sheet)</label>
                <input
                  type="text"
                  value={backupSpreadsheetId}
                  onChange={(e) => setBackupSpreadsheetId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-mono text-[11px] focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Tab Sheet</label>
                  <input
                    type="text"
                    value={backupSheetName}
                    onChange={(e) => setBackupSheetName(e.target.value)}
                    placeholder="Sheet1"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupIsPrimary}
                      onChange={(e) => setBackupIsPrimary(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span className="text-[11px] font-bold text-slate-700">Jadikan Target Utama (Primary)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddBackupModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingBackup}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs inline-flex items-center space-x-1"
                >
                  {isSavingBackup && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Simpan Target Spreadsheet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
