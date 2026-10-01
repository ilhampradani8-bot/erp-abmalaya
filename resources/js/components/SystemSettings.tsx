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
  SlidersHorizontal, Upload, X, Shield, Terminal, HardDrive, ArrowUpRight, Search
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
  // 8 Primary Apple-style Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'credentials' | 'inbox_rules' | 'ai' | 'paper' | 'quotation_settings' | 'invoice' | 'cloud_sync' | 'database'
  >('credentials');

  const [searchQuery, setSearchQuery] = useState('');

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
  const [savedMessage, setSavedMessage] = useState('Settings saved to SQL Database successfully!');

  // ── Tab 1: SMTP Credentials ───────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [plainPassword, setPlainPassword] = useState(decryptData(smtpConfig.app_password));
  const [formConfig, setFormConfig] = useState<SMTPConfig>({ ...smtpConfig });

  // ── Tab 2: Inbox Rules ───────────────────────────────────────────────────
  const [inboxRules, setInboxRules] = useState({
    excludeNoreply: true,
    excludeMedsos: true,
    prioritizePdf: true,
    requireAttachment: false,
    autoLabelRfq: true,
    excludeSystemAlerts: true,
    fetchStartDate: ''
  });

  // ── Tab 3: Gemini AI Keys Pool ───────────────────────────────────────────
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
      engineName: 'RFQ Inbox Classification AI Engine'
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
      engineName: 'Vision OCR Document Scanning Engine'
    }
  ]);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [editingKeyItem, setEditingKeyItem] = useState<AIKeyItem | null>(null);
  const [modalKeyPool, setModalKeyPool] = useState<'inbox' | 'ocr'>('inbox');
  const [modalAlias, setModalAlias] = useState('');
  const [modalKeyString, setModalKeyString] = useState('');

  // ── Tab 4: Paper & SPH Letterhead Settings ────────────────────────────────
  const [paperSettings, setPaperSettings] = useState({
    companyName: 'AB MALAYA SDN. BHD.',
    companyAddress: '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
    phone: '+60 3-8000 1234',
    email: 'sales@abmalaya.com',
    logoUrl: '/favicon.png',
    stampUrl: '',
    signatureUrl: '',
    headerImageUrl: '',
    bankName: 'Maybank Islamic Berhad',
    bankAccountNumber: '5648 9201 3345',
    bankAccountName: 'AB MALAYA SDN BHD',
    bankEmail: 'finance@abmalaya.com',
    headerTitle: 'COMMERCIAL QUOTATION (SPH)',
    footerTerms: '1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.',
    footerText: 'Thank you for choosing AB MALAYA SDN. BHD. as your trusted marine supplier.',
    headerColor: '#0080d0',
    defaultNotes: 'All prices are in MYR and subject to prevailing taxes unless specified otherwise.',
    paperSize: 'A4',
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 15,
    marginRight: 15,
    fontSize: 9
  });

  const [headerTemplate, setHeaderTemplate] = useState<'modern' | 'classic' | 'minimal' | 'custom_image'>('modern');
  const [tableHeaderBg, setTableHeaderBg] = useState('#0080d0');
  const [tableHeaderTextColor, setTableHeaderTextColor] = useState('#ffffff');
  const [isUploadingPaperImage, setIsUploadingPaperImage] = useState(false);

  // ── Tab 5: Quotation & Software Fee Settings ──────────────────────────────
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

  // ── Tab 6: Invoice Document Settings ──────────────────────────────────────
  const [invoiceSettings, setInvoiceSettings] = useState({
    companyName: 'AB MALAYA SDN. BHD.',
    ssmNumber: '202101012345 (1412644-T)',
    companyAddress: '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
    phone: '+60 3-8000 1234',
    email: 'finance@abmalaya.com',
    logoUrl: '/favicon.png',
    stampUrl: '',
    signatureUrl: '',
    headerImageUrl: '',
    signatoryName: 'Aiman Zaki',
    signatoryTitle: 'Managing Director',
    bankName: 'Maybank Islamic Berhad',
    bankAccountNumber: '5648 9201 3345',
    bankAccountName: 'AB MALAYA SDN BHD',
    bankSwiftCode: 'MBBEMYKL',
    invoiceTitle: 'TAX INVOICE',
    paymentTerms: 'Payment due within 30 days of invoice date.\nPlease transfer to the stated bank account with invoice reference.',
    headerColor: '#0f172a',
    paperSize: 'A4'
  });

  const [isUploadingInvoiceImage, setIsUploadingInvoiceImage] = useState(false);

  const maskKey = (keyStr: string) => {
    if (!keyStr) return 'Not Configured';
    if (keyStr.length <= 16) return keyStr;
    return keyStr.substring(0, 8) + '••••••••' + keyStr.substring(keyStr.length - 6);
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
              engineName: item.pool_type === 'ocr' ? 'OCR Vision Document Scan' : 'RFQ Inbox Classifier'
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
            paperSize: resData.data.paper_size || prev.paperSize,
            marginTop: Number(resData.data.margin_top || prev.marginTop),
            marginBottom: Number(resData.data.margin_bottom || prev.marginBottom),
            marginLeft: Number(resData.data.margin_left || prev.marginLeft),
            marginRight: Number(resData.data.margin_right || prev.marginRight),
            fontSize: Number(resData.data.font_size || prev.fontSize)
          }));
          if (resData.data.header_template) setHeaderTemplate(resData.data.header_template as any);
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
            ssmNumber: resData.data.ssm_number || prev.ssmNumber,
            companyAddress: resData.data.company_address || prev.companyAddress,
            phone: resData.data.phone || prev.phone,
            email: resData.data.email || prev.email,
            logoUrl: resData.data.logo_url || prev.logoUrl,
            stampUrl: resData.data.stamp_url || prev.stampUrl,
            signatureUrl: resData.data.signature_url || prev.signatureUrl,
            headerImageUrl: resData.data.header_image_url || prev.headerImageUrl,
            signatoryName: resData.data.signatory_name || prev.signatoryName,
            signatoryTitle: resData.data.signatory_title || prev.signatoryTitle,
            bankName: resData.data.bank_name || prev.bankName,
            bankAccountNumber: resData.data.bank_account_number || prev.bankAccountNumber,
            bankAccountName: resData.data.bank_account_name || prev.bankAccountName,
            bankSwiftCode: resData.data.bank_swift_code || prev.bankSwiftCode,
            invoiceTitle: resData.data.invoice_title || prev.invoiceTitle,
            paymentTerms: resData.data.payment_terms || prev.paymentTerms,
            headerColor: resData.data.header_color || prev.headerColor,
            paperSize: resData.data.paper_size || prev.paperSize
          }));
        }
      })
      .catch((err) => console.log('Fetch invoice settings error:', err));

    loadBackupsList();
  }, []);

  const loadBackupsList = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=list_backups'))
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          setBackupsList(data.data);
        }
      })
      .catch((err) => console.log('Fetch backups list error:', err));
  };

  const saveBatchSettings = (items: { credential_key: string; credential_value: string; service_name: string }[], successMsg: string) => {
    fetch(getApiUrl('/api_credentials.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: items })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(successMsg);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Save failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => alert('Save error: ' + err.message));
  };

  // Handlers
  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...formConfig,
      username: formConfig.from_email,
      app_password: encryptData(plainPassword)
    };
    onSaveSmtpConfig(updated);

    saveBatchSettings([
      { credential_key: 'SMTP_HOST', credential_value: updated.host, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_PORT', credential_value: String(updated.port), service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_EMAIL', credential_value: updated.from_email, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_APP_PASSWORD', credential_value: plainPassword, service_name: 'SMTP Credentials' },
      { credential_key: 'SMTP_USERNAME', credential_value: updated.from_email, service_name: 'SMTP Credentials' }
    ], 'SMTP Server Configuration saved to SQL Database successfully!');
  };

  const handleSaveInboxRules = () => {
    saveBatchSettings([
      { credential_key: 'INBOX_RULE_EXCLUDE_NOREPLY', credential_value: String(inboxRules.excludeNoreply), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_MEDSOS', credential_value: String(inboxRules.excludeMedsos), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_PRIORITIZE_PDF', credential_value: String(inboxRules.prioritizePdf), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_REQUIRE_ATTACHMENT', credential_value: String(inboxRules.requireAttachment), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_AUTO_LABEL', credential_value: String(inboxRules.autoLabelRfq), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_EXCLUDE_SYSTEM_ALERTS', credential_value: String(inboxRules.excludeSystemAlerts), service_name: 'Inbox Rules' },
      { credential_key: 'INBOX_RULE_START_DATE', credential_value: inboxRules.fetchStartDate, service_name: 'Inbox Rules' },
      { credential_key: 'CLIENT_CHAT_START_DATE', credential_value: inboxRules.fetchStartDate, service_name: 'Client Chat Settings' }
    ], 'Inbox Ingestion & Date Cutoff Rules saved to SQL Database successfully!');
  };

  const persistAiKeysPool = (poolType: 'inbox' | 'ocr', list: AIKeyItem[], msg?: string) => {
    fetch(getApiUrl('/api_gemini_keys.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_type: poolType,
        keys: list.map((k) => ({
          alias: k.alias,
          key: k.key,
          status: k.status,
          model_name: k.modelName,
          daily_limit: k.dailyLimit
        }))
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage(msg || 'Gemini AI API Keys saved to SQL Database successfully!');
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
          engineName: 'RFQ Inbox Classification Engine'
        });
      }
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'Gemini Inbox Key Pool updated in SQL Database!');
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
          engineName: 'Vision OCR Document Scanning Engine'
        });
      }
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'Gemini OCR Scanning Key Pool updated in SQL Database!');
    }

    setIsAiModalOpen(false);
    setEditingKeyItem(null);
    setModalAlias('');
    setModalKeyString('');
  };

  const handleDeleteAiKey = (id: string, pool: 'inbox' | 'ocr') => {
    if (!confirm('Are you sure you want to remove this AI Key from the database?')) return;
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.filter((x) => x.id !== id);
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'AI Key removed from SQL Database!');
    } else {
      const updatedList = ocrAiKeys.filter((x) => x.id !== id);
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'OCR AI Key removed from SQL Database!');
    }
  };

  const handleToggleAiKeyStatus = (id: string, pool: 'inbox' | 'ocr') => {
    if (pool === 'inbox') {
      const updatedList = inboxAiKeys.map((x) =>
        x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x
      );
      setInboxAiKeys(updatedList);
      persistAiKeysPool('inbox', updatedList, 'AI Key status updated in SQL Database!');
    } else {
      const updatedList = ocrAiKeys.map((x) =>
        x.id === id ? { ...x, status: (x.status === 'active' ? 'disabled' : 'active') as any } : x
      );
      setOcrAiKeys(updatedList);
      persistAiKeysPool('ocr', updatedList, 'OCR Key status updated in SQL Database!');
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
          setSavedMessage('SPH Letterhead & Paper settings saved to SQL Database successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Save failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => alert('Error saving paper settings: ' + err.message));
  };

  const handleSaveQuotationSettings = () => {
    saveBatchSettings([
      { credential_key: 'DOC_CURRENCY', credential_value: quotationSettings.currency, service_name: 'Quotation Settings' },
      { credential_key: 'DOC_TAX_PERCENT', credential_value: String(quotationSettings.taxPercent), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_DEFAULT_DISCOUNT', credential_value: String(quotationSettings.defaultDiscount), service_name: 'Quotation Settings' },
      { credential_key: 'DOC_VALID_UNTIL', credential_value: quotationSettings.validUntil, service_name: 'Quotation Settings' },
      { credential_key: 'SOFTWARE_FEE_PERCENT', credential_value: String(softwareFee.percent), service_name: 'System Fee' },
      { credential_key: 'SOFTWARE_FEE_MAX_LIMIT', credential_value: String(softwareFee.maxLimit), service_name: 'System Fee' }
    ], 'Quotation Defaults & System Fee Rules saved to SQL Database successfully!');
  };

  const handleSaveInvoiceSettings = () => {
    fetch(getApiUrl('/api_invoice_settings.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: invoiceSettings.companyName,
        ssm_number: invoiceSettings.ssmNumber,
        company_address: invoiceSettings.companyAddress,
        phone: invoiceSettings.phone,
        email: invoiceSettings.email,
        logo_url: invoiceSettings.logoUrl,
        stamp_url: invoiceSettings.stampUrl,
        signature_url: invoiceSettings.signatureUrl,
        header_image_url: invoiceSettings.headerImageUrl,
        signatory_name: invoiceSettings.signatoryName,
        signatory_title: invoiceSettings.signatoryTitle,
        bank_name: invoiceSettings.bankName,
        bank_account_number: invoiceSettings.bankAccountNumber,
        bank_account_name: invoiceSettings.bankAccountName,
        bank_swift_code: invoiceSettings.bankSwiftCode,
        invoice_title: invoiceSettings.invoiceTitle,
        payment_terms: invoiceSettings.paymentTerms,
        header_color: invoiceSettings.headerColor,
        paper_size: invoiceSettings.paperSize
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSavedMessage('Invoice Layout & Signatory Settings saved to SQL Database successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
        } else {
          alert('Save failed: ' + (resData.message || 'Error occurred'));
        }
      })
      .catch((err) => alert('Error saving invoice settings: ' + err.message));
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
          setSavedMessage(`Asset uploaded and stored to SQL Database successfully!`);
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
          setSavedMessage(`Invoice asset uploaded and stored to SQL Database successfully!`);
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
            message: data.message || (data.status === 'success' ? 'Connection Verified' : 'Connection Failed'),
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
          setSavedMessage(`Spreadsheet sync complete: ${data.total_rows || data.rows_synced || 0} product rows synchronized!`);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 4000);
          loadBackupsList();
        } else {
          alert('Sync failed: ' + (data.message || 'Error occurred'));
        }
      })
      .catch((err) => {
        setRunningBackupId(null);
        alert('Sync error: ' + err.message);
      });
  };

  const handleDeleteBackupTarget = (id: number) => {
    if (!confirm('Are you sure you want to delete this Spreadsheet target?')) return;
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
          alert(data.message || 'Failed to delete target');
        }
      })
      .catch((err) => console.log('Delete backup target error:', err));
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
          setSavedMessage('New Google Sheets target added successfully!');
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 3500);
        } else {
          alert('Failed to add target: ' + (data.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSavingBackup(false);
        alert('Error: ' + err.message);
      });
  };

  // 8 Apple-styled Tabs Specification with Custom Gradient Squircle Icons
  const tabs = [
    { 
      id: 'credentials', 
      label: 'Email & SMTP Server', 
      icon: Key, 
      color: 'from-blue-500 to-indigo-600',
      description: 'Host, TLS Port, and App Password'
    },
    { 
      id: 'inbox_rules', 
      label: 'Inbox Rules & Ingest Date', 
      icon: Sliders, 
      color: 'from-purple-500 to-violet-600',
      description: 'Filters, auto-tagging, and cutoff boundary'
    },
    { 
      id: 'ai', 
      label: 'AI Engines & Key Pool', 
      icon: Bot, 
      color: 'from-pink-500 to-rose-600',
      description: 'Gemini 2.5 Flash Inbox & OCR key pool'
    },
    { 
      id: 'paper', 
      label: 'SPH Letterhead & Branding', 
      icon: FileText, 
      color: 'from-amber-500 to-orange-600',
      description: 'Logo, stamp, digital signature & bank'
    },
    { 
      id: 'quotation_settings', 
      label: 'Quotation Defaults & Fee', 
      icon: Percent, 
      color: 'from-emerald-500 to-teal-600',
      description: 'Currency, Tax rate, and System Fee %'
    },
    { 
      id: 'invoice', 
      label: 'Invoice Template & Signatory', 
      icon: Receipt, 
      color: 'from-cyan-500 to-blue-600',
      description: 'SSM registration, signatories & terms'
    },
    { 
      id: 'cloud_sync', 
      label: 'Google Sheets Cloud Backup', 
      icon: Cloud, 
      color: 'from-sky-500 to-indigo-500',
      description: 'Multi-target live product catalog sync'
    },
    { 
      id: 'database', 
      label: 'SQL Database Architecture', 
      icon: Database, 
      color: 'from-slate-600 to-slate-800',
      description: 'Live MySQL schemas and table registries'
    },
  ];

  // Core MySQL Tables Registry
  const coreTables = [
    { name: 'rfq_requests', label: 'RFQ Inquiries Registry', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'RFQ Table', desc: 'Incoming RFQ email inquiries and manual entries.' },
    { name: 'quotations', label: 'Quotation Documents (SPH)', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'SPH Table', desc: 'Header data, SPH numbers, grand totals, SST/tax, and validity.' },
    { name: 'quotation_items', label: 'Quotation Line Items', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'SPH Items', desc: 'Item rows, IMPA codes, quantities, unit prices, and discounts.' },
    { name: 'invoices', label: 'Official Invoice Documents', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Invoice Table', desc: 'Commercial invoices, invoice numbers, due dates, and paid status.' },
    { name: 'invoice_items', label: 'Invoice Line Items', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Invoice Items', desc: 'Billed items, scope of supply, units, and itemized amounts.' },
    { name: 'products', label: 'Master Product Catalog', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Products', desc: 'Standard parts catalog, IMPA/SKU, description, and supplier.' },
    { name: 'product_categories', label: 'Product Categories', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Categories', desc: 'Hierarchical category structure and classification rules.' },
    { name: 'product_change_logs', label: 'Product Audit Logs', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Audit Trail', desc: 'Change history for pricing, specs, and supplier updates.' },
    { name: 'spreadsheet_backups', label: 'Cloud Spreadsheet Targets', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Cloud Targets', desc: 'Google Sheets IDs for automated master catalog sync.' },
    { name: 'gemini_api_keys', label: 'Gemini AI API Keys Pool', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'AI Keys Pool', desc: 'Active API key pool for AI RFQ classification and OCR PDF scans.' },
    { name: 'api_credentials', label: 'System Configuration Store', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Config Store', desc: 'SMTP server settings, filter rules, and system fee parameters.' },
    { name: 'system_paper_settings', label: 'SPH Letterhead Configuration', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'SPH Config', desc: 'Letterhead branding, logos, official stamps, and bank accounts.' },
    { name: 'system_invoice_settings', label: 'Invoice Format Settings', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Invoice Config', desc: 'Invoice headers, SSM number, signatories, and payment terms.' },
    { name: 'users', label: 'System User Accounts', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'User Accounts', desc: 'Active logins, role-based access controls, and password hashes.' },
    { name: 'user_activity_logs', label: 'Security & Activity Logs', type: 'InnoDB', charset: 'utf8mb4', estimatedRows: 'Activity Logs', desc: 'Audit record of user logins, quotation dispatches, and changes.' },
  ];

  const filteredTabs = tabs.filter(t => 
    t.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex-1 bg-[#f5f6f8] text-slate-800 font-sans min-h-screen flex flex-col antialiased">
      
      {/* ── TOP NOTIFICATION BANNER ────────────────────────────────────────── */}
      {isSaved && (
        <div className="w-full bg-emerald-600 text-white px-5 py-2.5 flex items-center justify-between text-xs font-semibold shadow-md z-30 animate-in fade-in sticky top-0">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{savedMessage}</span>
          </div>
          <span className="text-[10px] bg-emerald-700/80 px-2.5 py-0.5 rounded-full text-emerald-100 font-mono">SQL Live Sync Active</span>
        </div>
      )}

      {/* ── APPLE SYSTEM SETTINGS MASTER LAYOUT (SIDEBAR + MAIN CONTENT) ────── */}
      <div className="w-full flex-1 flex flex-col md:flex-row max-w-[1600px] mx-auto p-4 md:p-6 gap-6">
        
        {/* ── LEFT SIDEBAR (Apple macOS Style Navigation) ───────────────────── */}
        <aside className="w-full md:w-80 flex-shrink-0 flex flex-col space-y-4">
          
          {/* Header Card */}
          <div className="p-4 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">System Settings</h1>
                <p className="text-xs text-slate-500 font-medium">ERP Core & Services</p>
              </div>
            </div>

            {/* Quick Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          {/* Navigation Items List */}
          <nav className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs p-2 space-y-1">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br ${tab.color} shadow-2xs`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{tab.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {tab.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* System Status Pill Card */}
          <div className="p-3.5 bg-white/60 backdrop-blur-md border border-slate-200/60 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600 text-[11px] font-medium">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Database Status</span>
              </span>
              <span className="font-mono text-slate-700 font-semibold">MySQL 8.0</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 text-[11px] font-medium">
              <span>Sync Engine</span>
              <span className="font-mono text-blue-600 font-semibold">Auto Active</span>
            </div>
          </div>
        </aside>

        {/* ── RIGHT MAIN CONTENT PANE (Apple Inset Grouped Style) ────────────── */}
        <main className="flex-1 min-w-0 flex flex-col space-y-6">

          {/* ════════════════════════════════════════════════════════════════════
              TAB 1: EMAIL & SMTP SERVER
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'credentials' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Email & SMTP Server Settings</h2>
                    <p className="text-xs text-slate-500">Configure outbound email delivery service (Stored in SQL: <code className="text-blue-600 font-mono">api_credentials</code>)</p>
                  </div>
                  <span className="text-xs font-mono bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full border border-blue-100">
                    TLS 587
                  </span>
                </div>

                <form onSubmit={handleSaveSmtp} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">SMTP Host</label>
                      <input
                        type="text"
                        value={formConfig.host}
                        onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">SMTP Port</label>
                      <input
                        type="number"
                        value={formConfig.port}
                        onChange={(e) => setFormConfig({ ...formConfig, port: Number(e.target.value) })}
                        placeholder="587"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sender Email / Username</label>
                      <input
                        type="email"
                        value={formConfig.from_email || formConfig.username}
                        onChange={(e) => setFormConfig({ ...formConfig, from_email: e.target.value, username: e.target.value })}
                        placeholder="sales@abmalaya.com"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">App Password (16 Characters)</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={plainPassword}
                          onChange={(e) => setPlainPassword(e.target.value)}
                          placeholder="•••• •••• •••• ••••"
                          className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden font-mono pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Credentials are encrypted and safely stored in the MySQL database table.
                    </span>
                    <button
                      type="submit"
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Email Settings</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 2: INBOX RULES & INGEST DATE BOUNDARY
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'inbox_rules' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Email Ingestion & Filter Rules</h2>
                    <p className="text-xs text-slate-500">Automated classification rules and start date cutoff boundary</p>
                  </div>
                  <button
                    onClick={handleSaveInboxRules}
                    className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Rules</span>
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Date Boundary Box */}
                  <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Email Ingestion Date Cutoff</span>
                      <p className="text-[11px] text-slate-500">Emails received before this date are skipped automatically for faster sync.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={inboxRules.fetchStartDate}
                        onChange={(e) => setInboxRules({ ...inboxRules, fetchStartDate: e.target.value })}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setInboxRules({ ...inboxRules, fetchStartDate: '' })}
                        className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Rules Grouped Inset List */}
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                    {[
                      {
                        key: 'excludeNoreply',
                        title: 'Exclude Automated No-Reply Emails',
                        desc: 'Filter out noreply@, notification@, and automated robotic senders.'
                      },
                      {
                        key: 'excludeMedsos',
                        title: 'Exclude Social Media & Marketing Notifications',
                        desc: 'Skip newsletters, LinkedIn, marketing, and spam promotional materials.'
                      },
                      {
                        key: 'prioritizePdf',
                        title: 'Prioritize Inquiries with PDF Attachments',
                        desc: 'Place inquiries containing technical RFQ documents at the top of the queue.'
                      },
                      {
                        key: 'requireAttachment',
                        title: 'Require Attachments for RFQ Ingestion',
                        desc: 'Only classify emails that contain at least one file attachment as an RFQ.'
                      },
                      {
                        key: 'autoLabelRfq',
                        title: 'Automatic RFQ Tagging & Status Labeling',
                        desc: 'Apply classification tags (Equipment, Spare Parts, General Supply) automatically.'
                      },
                      {
                        key: 'excludeSystemAlerts',
                        title: 'Exclude System & IT Infrastructure Alerts',
                        desc: 'Ignore server alarms, delivery failure notices, and DNS reports.'
                      },
                    ].map((rule) => (
                      <div key={rule.key} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                        <div className="pr-4">
                          <div className="text-xs font-semibold text-slate-800">{rule.title}</div>
                          <div className="text-[11px] text-slate-500">{rule.desc}</div>
                        </div>
                        {/* Apple Style Toggle Switch */}
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={(inboxRules as any)[rule.key]}
                            onChange={(e) => setInboxRules({ ...inboxRules, [rule.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 3: AI ENGINES & KEY POOL
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Pool 1: Inbox RFQ AI */}
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">RFQ Inbox Classification AI Pool</h2>
                      <p className="text-xs text-slate-500">Gemini 2.5 Flash keys for intelligent email parsing and customer RFQ detection</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setModalKeyPool('inbox');
                      setEditingKeyItem(null);
                      setModalAlias('');
                      setModalKeyString('');
                      setIsAiModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Key</span>
                  </button>
                </div>

                <div className="p-6 space-y-3">
                  {inboxAiKeys.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{item.alias}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-600">{maskKey(item.key)}</div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-3 font-medium">
                          <span>Model: <code className="text-blue-600 font-mono">{item.modelName}</code></span>
                          <span>•</span>
                          <span>Quota: {item.dailyLimit}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleAiKeyStatus(item.id, 'inbox')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            item.status === 'active' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {item.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => {
                            setModalKeyPool('inbox');
                            setEditingKeyItem(item);
                            setModalAlias(item.alias);
                            setModalKeyString(item.key);
                            setIsAiModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAiKey(item.id, 'inbox')}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pool 2: OCR Vision AI */}
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-2xs">
                      <ScanLine className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Vision OCR Document Scanning Pool</h2>
                      <p className="text-xs text-slate-500">Gemini 2.5 Flash Vision keys for high-speed PDF & image table extraction</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setModalKeyPool('ocr');
                      setEditingKeyItem(null);
                      setModalAlias('');
                      setModalKeyString('');
                      setIsAiModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Key</span>
                  </button>
                </div>

                <div className="p-6 space-y-3">
                  {ocrAiKeys.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{item.alias}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-600">{maskKey(item.key)}</div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-3 font-medium">
                          <span>Model: <code className="text-indigo-600 font-mono">{item.modelName}</code></span>
                          <span>•</span>
                          <span>Quota: {item.dailyLimit}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleAiKeyStatus(item.id, 'ocr')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            item.status === 'active' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {item.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => {
                            setModalKeyPool('ocr');
                            setEditingKeyItem(item);
                            setModalAlias(item.alias);
                            setModalKeyString(item.key);
                            setIsAiModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAiKey(item.id, 'ocr')}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-200/60 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 4: SPH LETTERHEAD & PAPER BRANDING
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'paper' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">SPH Letterhead & Branding Layout</h2>
                    <p className="text-xs text-slate-500">Customize quotation documents, logos, official stamps, and bank accounts</p>
                  </div>
                  <button
                    onClick={handleSavePaper}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save SPH Settings</span>
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Uploads Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Company Logo', type: 'logo', val: paperSettings.logoUrl },
                      { label: 'Official Stamp', type: 'stamp', val: paperSettings.stampUrl },
                      { label: 'Digital Signature', type: 'signature', val: paperSettings.signatureUrl },
                      { label: 'Header Banner', type: 'header_image', val: paperSettings.headerImageUrl },
                    ].map((item) => (
                      <div key={item.type} className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-col items-center justify-center space-y-2 text-center">
                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                        {item.val ? (
                          <img src={item.val} alt={item.label} className="h-12 object-contain rounded border border-slate-200 bg-white p-1" />
                        ) : (
                          <div className="h-12 w-full flex items-center justify-center border border-dashed border-slate-300 rounded text-[11px] text-slate-400">
                            No Asset
                          </div>
                        )}
                        <label className="cursor-pointer inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadPaperImage(e, item.type as any)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Company Info Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company Name</label>
                      <input
                        type="text"
                        value={paperSettings.companyName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, companyName: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Contact Phone</label>
                      <input
                        type="text"
                        value={paperSettings.phone}
                        onChange={(e) => setPaperSettings({ ...paperSettings, phone: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company Address</label>
                      <textarea
                        rows={2}
                        value={paperSettings.companyAddress}
                        onChange={(e) => setPaperSettings({ ...paperSettings, companyAddress: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-900 block">Bank Account for Quotation Payment</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={paperSettings.bankName}
                          onChange={(e) => setPaperSettings({ ...paperSettings, bankName: e.target.value })}
                          placeholder="Maybank Islamic Berhad"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={paperSettings.bankAccountNumber}
                          onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountNumber: e.target.value })}
                          placeholder="5648 9201 3345"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Holder Name</label>
                        <input
                          type="text"
                          value={paperSettings.bankAccountName}
                          onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountName: e.target.value })}
                          placeholder="AB MALAYA SDN BHD"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 5: QUOTATION DEFAULTS & SOFTWARE FEE
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'quotation_settings' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Quotation Defaults & System Fee Rules</h2>
                    <p className="text-xs text-slate-500">Configure currency codes, SST/tax rates, quotation validity, and platform fee caps</p>
                  </div>
                  <button
                    onClick={handleSaveQuotationSettings}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Settings</span>
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Default Currency</label>
                      <select
                        value={quotationSettings.currency}
                        onChange={(e) => setQuotationSettings({ ...quotationSettings, currency: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-hidden"
                      >
                        <option value="MYR">MYR - Malaysian Ringgit (RM)</option>
                        <option value="USD">USD - US Dollar ($)</option>
                        <option value="SGD">SGD - Singapore Dollar (S$)</option>
                        <option value="IDR">IDR - Indonesian Rupiah (Rp)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tax Rate (%)</label>
                      <input
                        type="number"
                        value={quotationSettings.taxPercent}
                        onChange={(e) => setQuotationSettings({ ...quotationSettings, taxPercent: Number(e.target.value) })}
                        placeholder="11"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quotation Validity</label>
                      <input
                        type="text"
                        value={quotationSettings.validUntil}
                        onChange={(e) => setQuotationSettings({ ...quotationSettings, validUntil: e.target.value })}
                        placeholder="14 Days"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* System Fee Box */}
                  <div className="p-5 bg-gradient-to-br from-blue-50/60 to-indigo-50/60 border border-blue-200/80 rounded-2xl space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Percent className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900">Platform & System Software Fee</span>
                        <p className="text-[11px] text-slate-500">Calculated on total quotation margin with an automatic safety cap</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Percentage (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={softwareFee.percent}
                          onChange={(e) => setSoftwareFee({ ...softwareFee, percent: Number(e.target.value) })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Maximum Fee Cap ({quotationSettings.currency})</label>
                        <input
                          type="number"
                          value={softwareFee.maxLimit}
                          onChange={(e) => setSoftwareFee({ ...softwareFee, maxLimit: Number(e.target.value) })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 6: INVOICE TEMPLATE & SIGNATORIES
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'invoice' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Commercial Invoice Document Settings</h2>
                    <p className="text-xs text-slate-500">Configure SSM business registration, signatories, payment instructions, and terms</p>
                  </div>
                  <button
                    onClick={handleSaveInvoiceSettings}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Invoice Settings</span>
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Uploads Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Invoice Logo', type: 'logo', val: invoiceSettings.logoUrl },
                      { label: 'Official Stamp', type: 'stamp', val: invoiceSettings.stampUrl },
                      { label: 'Signatory Signature', type: 'signature', val: invoiceSettings.signatureUrl },
                      { label: 'Header Banner', type: 'header_image', val: invoiceSettings.headerImageUrl },
                    ].map((item) => (
                      <div key={item.type} className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-col items-center justify-center space-y-2 text-center">
                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                        {item.val ? (
                          <img src={item.val} alt={item.label} className="h-12 object-contain rounded border border-slate-200 bg-white p-1" />
                        ) : (
                          <div className="h-12 w-full flex items-center justify-center border border-dashed border-slate-300 rounded text-[11px] text-slate-400">
                            No Asset
                          </div>
                        )}
                        <label className="cursor-pointer inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadInvoiceImage(e, item.type as any)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">SSM Registration Number</label>
                      <input
                        type="text"
                        value={invoiceSettings.ssmNumber}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, ssmNumber: e.target.value })}
                        placeholder="202101012345 (1412644-T)"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Signatory Full Name</label>
                      <input
                        type="text"
                        value={invoiceSettings.signatoryName}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryName: e.target.value })}
                        placeholder="Aiman Zaki"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Signatory Designation / Title</label>
                      <input
                        type="text"
                        value={invoiceSettings.signatoryTitle}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryTitle: e.target.value })}
                        placeholder="Managing Director"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank SWIFT / BIC Code</label>
                      <input
                        type="text"
                        value={invoiceSettings.bankSwiftCode}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankSwiftCode: e.target.value })}
                        placeholder="MBBEMYKL"
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invoice Payment Instructions & Terms</label>
                      <textarea
                        rows={3}
                        value={invoiceSettings.paymentTerms}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 7: GOOGLE SHEETS CLOUD SYNC
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'cloud_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Google Sheets Cloud Backup Targets</h2>
                    <p className="text-xs text-slate-500">Synchronize products, pricing, and supplier catalogs to Google Spreadsheets</p>
                  </div>
                  <button
                    onClick={() => setIsAddBackupModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Target</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Service Account Email Info Box */}
                  <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900">Google Service Account</span>
                      <p className="text-[11px] text-slate-500">Share your Google Spreadsheet with Editor permissions to this account:</p>
                      <code className="text-xs font-mono text-blue-600 font-semibold block pt-1">
                        erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com
                      </code>
                    </div>
                    <button
                      onClick={() => handleCopyEmail('erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com')}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer"
                    >
                      {isCopiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedEmail ? 'Copied' : 'Copy Email'}</span>
                    </button>
                  </div>

                  {/* Targets List */}
                  <div className="space-y-3">
                    {backupsList.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        No Google Sheets backup targets configured. Click "Add Target" above.
                      </div>
                    ) : (
                      backupsList.map((target) => (
                        <div key={target.id} className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900">{target.title}</span>
                              {target.is_primary === 1 && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-slate-500">ID: {target.spreadsheet_id}</div>
                            <div className="text-[11px] text-slate-400">
                              Sheet: <span className="font-semibold text-slate-600">{target.sheet_name || 'Sheet1'}</span> • Last Sync: {target.last_sync_at || 'Never'}
                            </div>

                            {/* Result Indicator */}
                            {connectionResultsMap[target.id] && (
                              <div className={`text-[11px] font-semibold flex items-center space-x-1.5 pt-1 ${
                                connectionResultsMap[target.id].status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {connectionResultsMap[target.id].status === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                <span>{connectionResultsMap[target.id].message}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleTestConnection(target.id, target.spreadsheet_id)}
                              disabled={testingConnectionId === target.id}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                            >
                              {testingConnectionId === target.id ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                              onClick={() => handleRunBackupNow(target.id)}
                              disabled={runningBackupId === target.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
                            >
                              {runningBackupId === target.id ? 'Syncing...' : 'Sync Now'}
                            </button>
                            <button
                              onClick={() => handleDeleteBackupTarget(target.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB 8: SQL DATABASE ARCHITECTURE & TABLES REGISTRY
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'database' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">MySQL Database Architecture & Table Registries</h2>
                    <p className="text-xs text-slate-500">Live schema inspection, character encoding, and database storage health</p>
                  </div>
                  <a
                    href="/adminer.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Database Manager</span>
                  </a>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {coreTables.map((tbl) => (
                      <div key={tbl.name} className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1.5 hover:bg-white hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between">
                          <code className="text-xs font-mono font-bold text-blue-600">{tbl.name}</code>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                            {tbl.type}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800">{tbl.label}</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed">{tbl.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAL: ADD / EDIT AI KEY ────────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingKeyItem ? 'Edit AI API Key' : `Add ${modalKeyPool === 'inbox' ? 'Inbox RFQ' : 'Vision OCR'} Key`}
              </h3>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAiKeySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Key Alias / Description</label>
                <input
                  type="text"
                  value={modalAlias}
                  onChange={(e) => setModalAlias(e.target.value)}
                  placeholder="e.g. Gemini 2.5 Flash Backup Key"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">API Key String</label>
                <input
                  type="text"
                  value={modalKeyString}
                  onChange={(e) => setModalKeyString(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingKeyItem ? 'Update Key' : 'Save Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SPREADSHEET BACKUP TARGET ───────────────────────────── */}
      {isAddBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Google Sheets Target</h3>
              <button
                onClick={() => setIsAddBackupModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBackupTarget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Title / Label</label>
                <input
                  type="text"
                  value={backupTitle}
                  onChange={(e) => setBackupTitle(e.target.value)}
                  placeholder="Master Product Catalog 2026"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Google Spreadsheet ID</label>
                <input
                  type="text"
                  value={backupSpreadsheetId}
                  onChange={(e) => setBackupSpreadsheetId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sheet / Tab Name</label>
                <input
                  type="text"
                  value={backupSheetName}
                  onChange={(e) => setBackupSheetName(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chkPrimary"
                  checked={backupIsPrimary}
                  onChange={(e) => setBackupIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                />
                <label htmlFor="chkPrimary" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Set as Primary Catalog Target
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddBackupModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBackup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isSavingBackup ? 'Saving...' : 'Add Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
