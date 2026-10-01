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
  // 8 Primary Navigation Tabs (Apple iTunes / System Preferences density)
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

  // 8 Fast Apple-styled Tabs Navigation
  const tabs = [
    { id: 'credentials', label: '1. Email & SMTP', icon: Key, badge: 'TLS 587' },
    { id: 'inbox_rules', label: '2. Inbox Rules & Cutoff', icon: Sliders, badge: 'Rules' },
    { id: 'ai', label: '3. Gemini AI Keys Pool', icon: Bot, badge: 'Pool' },
    { id: 'paper', label: '4. SPH Letterhead & Paper', icon: FileText, badge: 'SPH' },
    { id: 'quotation_settings', label: '5. Quotation Defaults & Fee', icon: Percent, badge: 'Fee' },
    { id: 'invoice', label: '6. Invoice Format & Signatory', icon: Receipt, badge: 'Invoice' },
    { id: 'cloud_sync', label: '7. Google Sheets Backup', icon: Cloud, badge: 'Sheets' },
    { id: 'database', label: '8. MySQL Tables & Schema', icon: Database, badge: 'MySQL' },
  ];

  // Core MySQL Tables Registry
  const coreTables = [
    { name: 'rfq_requests', label: 'RFQ Inquiries Registry', type: 'InnoDB', charset: 'utf8mb4', desc: 'Incoming RFQ inquiries and manual quotes.' },
    { name: 'quotations', label: 'Quotation Documents (SPH)', type: 'InnoDB', charset: 'utf8mb4', desc: 'Header data, SPH numbers, grand totals, SST, and validity.' },
    { name: 'quotation_items', label: 'Quotation Line Items', type: 'InnoDB', charset: 'utf8mb4', desc: 'Item rows, IMPA codes, quantities, and unit prices.' },
    { name: 'invoices', label: 'Official Invoices', type: 'InnoDB', charset: 'utf8mb4', desc: 'Commercial invoices, numbers, due dates, and paid status.' },
    { name: 'invoice_items', label: 'Invoice Line Items', type: 'InnoDB', charset: 'utf8mb4', desc: 'Itemized products/services billed in invoice.' },
    { name: 'products', label: 'Master Product Catalog', type: 'InnoDB', charset: 'utf8mb4', desc: 'Standard catalog, IMPA/SKU, description, and supplier.' },
    { name: 'product_categories', label: 'Product Categories', type: 'InnoDB', charset: 'utf8mb4', desc: 'Category structure and auto-classification rules.' },
    { name: 'product_change_logs', label: 'Product Audit Logs', type: 'InnoDB', charset: 'utf8mb4', desc: 'Change history for pricing, specs, and supplier updates.' },
    { name: 'spreadsheet_backups', label: 'Cloud Spreadsheet Targets', type: 'InnoDB', charset: 'utf8mb4', desc: 'Google Sheets IDs for automated catalog backup.' },
    { name: 'gemini_api_keys', label: 'Gemini AI API Keys Pool', type: 'InnoDB', charset: 'utf8mb4', desc: 'API key pool for AI RFQ classification and OCR PDF scans.' },
    { name: 'api_credentials', label: 'Configuration Key-Value Store', type: 'InnoDB', charset: 'utf8mb4', desc: 'SMTP settings, filter rules, and system fee parameters.' },
    { name: 'system_paper_settings', label: 'SPH Letterhead Configuration', type: 'InnoDB', charset: 'utf8mb4', desc: 'Branding, logos, official stamps, and bank accounts.' },
    { name: 'system_invoice_settings', label: 'Invoice Format Settings', type: 'InnoDB', charset: 'utf8mb4', desc: 'Invoice headers, SSM number, signatories, and payment terms.' },
    { name: 'users', label: 'System User Accounts', type: 'InnoDB', charset: 'utf8mb4', desc: 'Logins, role-based permissions, and password hashes.' },
    { name: 'user_activity_logs', label: 'Security & Activity Logs', type: 'InnoDB', charset: 'utf8mb4', desc: 'Audit record of user logins and system dispatches.' },
  ];

  return (
    <div className="w-full flex-1 bg-[#f0f2f5] text-slate-800 font-sans min-h-screen flex flex-col antialiased overflow-y-auto">
      
      {/* ── TOP NOTIFICATION TOAST BANNER ───────────────────────────────────── */}
      {isSaved && (
        <div className="w-full bg-emerald-600 text-white px-5 py-2.5 flex items-center justify-between text-xs font-semibold shadow-md z-30 animate-in fade-in sticky top-0">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{savedMessage}</span>
          </div>
          <span className="text-[10px] bg-emerald-700/80 px-2.5 py-0.5 rounded-full text-emerald-100 font-mono">SQL Live Sync Active</span>
        </div>
      )}

      {/* ── FAST SILVER HEADER & SEGMENTED TABS (Classic Apple iTunes / Mac Preferences Style) ── */}
      <header className="w-full bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-300 shadow-2xs sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-xs">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">System Settings</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                  MySQL 8.0 Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Configure email servers, AI keys, document letterheads, and database registries.</p>
            </div>
          </div>

          {/* Segmented Fast Tab Bar */}
          <nav className="flex items-center flex-wrap gap-1 bg-slate-200/80 p-1 rounded-lg border border-slate-300 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── MAIN SETTINGS BODY PANE (High Density, Fast & Clean) ─────────────── */}
      <main className="w-full flex-1 max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: EMAIL & SMTP SERVER
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'credentials' && (
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Outbound SMTP Server Configuration (MySQL: api_credentials)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">TLS Port 587</span>
              </div>

              <form onSubmit={handleSaveSmtp} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={formConfig.host}
                      onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
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
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Sender Email / Username</label>
                    <input
                      type="email"
                      value={formConfig.from_email || formConfig.username}
                      onChange={(e) => setFormConfig({ ...formConfig, from_email: e.target.value, username: e.target.value })}
                      placeholder="sales@abmalaya.com"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">App Password (16 Characters)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={plainPassword}
                        onChange={(e) => setPlainPassword(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Credentials are safely encrypted and stored in MySQL database table <code className="text-blue-600 font-mono">api_credentials</code>.</span>
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-xs text-xs transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Email Configuration</span>
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
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Automated Ingestion Rules & Ingest Date Boundary</span>
                </div>
                <button
                  onClick={handleSaveInboxRules}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-xs text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Rules</span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Date Boundary Box */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">Email Ingestion Date Cutoff</span>
                    <p className="text-[11px] text-slate-500">Emails received before this date will be automatically ignored to speed up background sync.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={inboxRules.fetchStartDate}
                      onChange={(e) => setInboxRules({ ...inboxRules, fetchStartDate: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setInboxRules({ ...inboxRules, fetchStartDate: '' })}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Reset Date
                    </button>
                  </div>
                </div>

                {/* Grouped Rules Rows */}
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
                  {[
                    { key: 'excludeNoreply', title: 'Exclude Automated No-Reply Emails', desc: 'Skip noreply@, notification@, and automated robotic messages.' },
                    { key: 'excludeMedsos', title: 'Exclude Social Media & Promotional Newsletters', desc: 'Filter out social updates, LinkedIn notifications, and promotional circulars.' },
                    { key: 'prioritizePdf', title: 'Prioritize Inquiries with PDF Documents', desc: 'Move inquiries containing technical RFQ attachments to the top of inbox.' },
                    { key: 'requireAttachment', title: 'Require Attachments for RFQ Ingestion', desc: 'Only classify emails that contain at least one document as an RFQ.' },
                    { key: 'autoLabelRfq', title: 'Automatic RFQ Tagging & Status Labeling', desc: 'Tag categories (Equipment, Spare Parts, General) automatically.' },
                    { key: 'excludeSystemAlerts', title: 'Exclude System & IT Infrastructure Alerts', desc: 'Ignore server delivery reports, mailer-daemon, and system warnings.' },
                  ].map((rule) => (
                    <div key={rule.key} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-all">
                      <div className="pr-4">
                        <div className="font-bold text-slate-900">{rule.title}</div>
                        <div className="text-[11px] text-slate-500">{rule.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={(inboxRules as any)[rule.key]}
                          onChange={(e) => setInboxRules({ ...inboxRules, [rule.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: GEMINI AI KEYS POOL
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ai' && (
          <div className="w-full space-y-4 animate-in fade-in">
            {/* Pool 1: Inbox RFQ AI */}
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-pink-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">RFQ Inbox Classification AI Pool (Gemini 2.5 Flash)</span>
                </div>
                <button
                  onClick={() => {
                    setModalKeyPool('inbox');
                    setEditingKeyItem(null);
                    setModalAlias('');
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Key</span>
                </button>
              </div>

              <div className="p-4 space-y-2.5">
                {inboxAiKeys.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.alias}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-mono text-slate-600">{maskKey(item.key)}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Model: {item.modelName} • Quota: {item.dailyLimit}</div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleToggleAiKeyStatus(item.id, 'inbox')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
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
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAiKey(item.id, 'inbox')}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pool 2: OCR Vision AI */}
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ScanLine className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Vision OCR Document Scan Pool (Gemini 2.5 Flash Vision)</span>
                </div>
                <button
                  onClick={() => {
                    setModalKeyPool('ocr');
                    setEditingKeyItem(null);
                    setModalAlias('');
                    setModalKeyString('');
                    setIsAiModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Key</span>
                </button>
              </div>

              <div className="p-4 space-y-2.5">
                {ocrAiKeys.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{item.alias}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-mono text-slate-600">{maskKey(item.key)}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Model: {item.modelName} • Quota: {item.dailyLimit}</div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleToggleAiKeyStatus(item.id, 'ocr')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
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
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAiKey(item.id, 'ocr')}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Quotation Letterhead (SPH) & Company Branding</span>
                </div>
                <button
                  onClick={handleSavePaper}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg shadow-xs text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save SPH Settings</span>
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {/* Visual Assets Upload Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Company Logo', type: 'logo', val: paperSettings.logoUrl },
                    { label: 'Official Stamp', type: 'stamp', val: paperSettings.stampUrl },
                    { label: 'Digital Signature (TTD)', type: 'signature', val: paperSettings.signatureUrl },
                    { label: 'Header Image Banner', type: 'header_image', val: paperSettings.headerImageUrl },
                  ].map((item) => (
                    <div key={item.type} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center space-y-1.5 text-center">
                      <span className="font-bold text-slate-700 text-[11px]">{item.label}</span>
                      {item.val ? (
                        <img src={item.val} alt={item.label} className="h-10 object-contain rounded border border-slate-200 bg-white p-0.5" />
                      ) : (
                        <div className="h-10 w-full flex items-center justify-center border border-dashed border-slate-300 rounded text-[10px] text-slate-400">
                          No File
                        </div>
                      )}
                      <label className="cursor-pointer inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-700">
                        <Upload className="w-3 h-3" />
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

                {/* Company Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Company Legal Name</label>
                    <input
                      type="text"
                      value={paperSettings.companyName}
                      onChange={(e) => setPaperSettings({ ...paperSettings, companyName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Official Telephone / Contact</label>
                    <input
                      type="text"
                      value={paperSettings.phone}
                      onChange={(e) => setPaperSettings({ ...paperSettings, phone: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Registered Address</label>
                    <textarea
                      rows={2}
                      value={paperSettings.companyAddress}
                      onChange={(e) => setPaperSettings({ ...paperSettings, companyAddress: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Bank Details */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <span className="font-bold text-slate-900 block text-xs">Bank Account for Quotation Payments</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Bank Name</label>
                      <input
                        type="text"
                        value={paperSettings.bankName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Account Number</label>
                      <input
                        type="text"
                        value={paperSettings.bankAccountNumber}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Account Beneficiary Name</label>
                      <input
                        type="text"
                        value={paperSettings.bankAccountName}
                        onChange={(e) => setPaperSettings({ ...paperSettings, bankAccountName: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
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
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Quotation Defaults & System Margin Fee Parameters</span>
                </div>
                <button
                  onClick={handleSaveQuotationSettings}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg shadow-xs text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Settings</span>
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Currency Code</label>
                    <select
                      value={quotationSettings.currency}
                      onChange={(e) => setQuotationSettings({ ...quotationSettings, currency: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold focus:outline-hidden"
                    >
                      <option value="MYR">MYR - Malaysian Ringgit (RM)</option>
                      <option value="USD">USD - US Dollar ($)</option>
                      <option value="SGD">SGD - Singapore Dollar (S$)</option>
                      <option value="IDR">IDR - Indonesian Rupiah (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Standard Tax Rate (%)</label>
                    <input
                      type="number"
                      value={quotationSettings.taxPercent}
                      onChange={(e) => setQuotationSettings({ ...quotationSettings, taxPercent: Number(e.target.value) })}
                      placeholder="11"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono font-bold focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Quotation Validity</label>
                    <input
                      type="text"
                      value={quotationSettings.validUntil}
                      onChange={(e) => setQuotationSettings({ ...quotationSettings, validUntil: e.target.value })}
                      placeholder="14 Days"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Platform Fee Box */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2">
                    <Percent className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-xs">Platform Software Fee Formula</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fee Percentage (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={softwareFee.percent}
                        onChange={(e) => setSoftwareFee({ ...softwareFee, percent: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Maximum Safety Cap ({quotationSettings.currency})</label>
                      <input
                        type="number"
                        value={softwareFee.maxLimit}
                        onChange={(e) => setSoftwareFee({ ...softwareFee, maxLimit: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 6: INVOICE TEMPLATE & SIGNATORY
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice' && (
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Commercial Invoice Template & Legal Signatories</span>
                </div>
                <button
                  onClick={handleSaveInvoiceSettings}
                  className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg shadow-xs text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Invoice Settings</span>
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {/* Uploads Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Invoice Logo', type: 'logo', val: invoiceSettings.logoUrl },
                    { label: 'Official Stamp', type: 'stamp', val: invoiceSettings.stampUrl },
                    { label: 'Signatory Signature', type: 'signature', val: invoiceSettings.signatureUrl },
                    { label: 'Header Banner', type: 'header_image', val: invoiceSettings.headerImageUrl },
                  ].map((item) => (
                    <div key={item.type} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center space-y-1.5 text-center">
                      <span className="font-bold text-slate-700 text-[11px]">{item.label}</span>
                      {item.val ? (
                        <img src={item.val} alt={item.label} className="h-10 object-contain rounded border border-slate-200 bg-white p-0.5" />
                      ) : (
                        <div className="h-10 w-full flex items-center justify-center border border-dashed border-slate-300 rounded text-[10px] text-slate-400">
                          No File
                        </div>
                      )}
                      <label className="cursor-pointer inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-700">
                        <Upload className="w-3 h-3" />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">SSM Registration Number</label>
                    <input
                      type="text"
                      value={invoiceSettings.ssmNumber}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, ssmNumber: e.target.value })}
                      placeholder="202101012345 (1412644-T)"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Signatory Full Name</label>
                    <input
                      type="text"
                      value={invoiceSettings.signatoryName}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryName: e.target.value })}
                      placeholder="Aiman Zaki"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Signatory Designation</label>
                    <input
                      type="text"
                      value={invoiceSettings.signatoryTitle}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryTitle: e.target.value })}
                      placeholder="Managing Director"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bank SWIFT / BIC Code</label>
                    <input
                      type="text"
                      value={invoiceSettings.bankSwiftCode}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankSwiftCode: e.target.value })}
                      placeholder="MBBEMYKL"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Invoice Payment Terms & Bank Instructions</label>
                    <textarea
                      rows={2}
                      value={invoiceSettings.paymentTerms}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
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
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Google Sheets Automated Master Catalog Backup</span>
                </div>
                <button
                  onClick={() => setIsAddBackupModalOpen(true)}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Target</span>
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Service Account Copy Box */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 block">Google Cloud Service Account</span>
                    <p className="text-[11px] text-slate-500">Share your target Google Spreadsheet with Editor permissions to:</p>
                    <code className="text-xs font-mono text-blue-600 font-bold block pt-0.5">
                      erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com
                    </code>
                  </div>
                  <button
                    onClick={() => handleCopyEmail('erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com')}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 cursor-pointer"
                  >
                    {isCopiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedEmail ? 'Copied!' : 'Copy Email'}</span>
                  </button>
                </div>

                {/* Target Spreadsheets List */}
                <div className="space-y-2">
                  {backupsList.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-lg">
                      No Google Sheets backup targets configured. Click "Add Target" to connect.
                    </div>
                  ) : (
                    backupsList.map((target) => (
                      <div key={target.id} className="p-3.5 bg-white border border-slate-300 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{target.title}</span>
                            {target.is_primary === 1 && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-slate-500 text-[11px]">ID: {target.spreadsheet_id}</div>
                          <div className="text-[11px] text-slate-400">Sheet: <span className="font-semibold text-slate-700">{target.sheet_name || 'Sheet1'}</span> • Last Sync: {target.last_sync_at || 'Never'}</div>
                          
                          {connectionResultsMap[target.id] && (
                            <div className={`text-[11px] font-bold flex items-center space-x-1 pt-0.5 ${
                              connectionResultsMap[target.id].status === 'success' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {connectionResultsMap[target.id].status === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                              <span>{connectionResultsMap[target.id].message}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleTestConnection(target.id, target.spreadsheet_id)}
                            disabled={testingConnectionId === target.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                          >
                            {testingConnectionId === target.id ? 'Testing...' : 'Test Connection'}
                          </button>
                          <button
                            onClick={() => handleRunBackupNow(target.id)}
                            disabled={runningBackupId === target.id}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs cursor-pointer"
                          >
                            {runningBackupId === target.id ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={() => handleDeleteBackupTarget(target.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            TAB 8: MYSQL DATABASE SCHEMA & ARCHITECTURE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'database' && (
          <div className="w-full space-y-4 animate-in fade-in">
            <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">MySQL Core Tables & Storage Engine Registry</span>
                </div>
                <a
                  href="/adminer.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Database Manager</span>
                </a>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {coreTables.map((tbl) => (
                    <div key={tbl.name} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 hover:border-blue-400 transition-all">
                      <div className="flex items-center justify-between">
                        <code className="font-mono font-bold text-blue-600 text-xs">{tbl.name}</code>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded font-mono">
                          {tbl.type}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900">{tbl.label}</div>
                      <div className="text-[11px] text-slate-500">{tbl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── MODAL: ADD / EDIT AI KEY ────────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden text-xs">
            <div className="px-5 py-3.5 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {editingKeyItem ? 'Edit AI Key' : `Add ${modalKeyPool === 'inbox' ? 'Inbox RFQ' : 'Vision OCR'} Key`}
              </h3>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAiKeySubmit} className="p-5 space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Key Description / Alias</label>
                <input
                  type="text"
                  value={modalAlias}
                  onChange={(e) => setModalAlias(e.target.value)}
                  placeholder="e.g. Gemini 2.5 Flash Secondary Key"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">API Key String</label>
                <input
                  type="text"
                  value={modalKeyString}
                  onChange={(e) => setModalKeyString(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  {editingKeyItem ? 'Save Changes' : 'Add API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SPREADSHEET TARGET ───────────────────────────────────── */}
      {isAddBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden text-xs">
            <div className="px-5 py-3.5 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Add Google Spreadsheet Target</h3>
              <button
                onClick={() => setIsAddBackupModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBackupTarget} className="p-5 space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Name / Title</label>
                <input
                  type="text"
                  value={backupTitle}
                  onChange={(e) => setBackupTitle(e.target.value)}
                  placeholder="Master Product Catalog 2026"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Google Spreadsheet ID</label>
                <input
                  type="text"
                  value={backupSpreadsheetId}
                  onChange={(e) => setBackupSpreadsheetId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sheet / Tab Name</label>
                <input
                  type="text"
                  value={backupSheetName}
                  onChange={(e) => setBackupSheetName(e.target.value)}
                  placeholder="Sheet1"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="chkPrimary"
                  checked={backupIsPrimary}
                  onChange={(e) => setBackupIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300"
                />
                <label htmlFor="chkPrimary" className="font-bold text-slate-700 cursor-pointer">
                  Set as Primary Catalog Target
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddBackupModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBackup}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
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
