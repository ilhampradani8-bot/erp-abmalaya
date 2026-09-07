import React, { useState, useEffect } from 'react';
import { Quotation, InvoiceItem } from '../types/erp';
import { 
  Printer, Send, ArrowLeft, Package, ChevronDown, FileText, Settings, Loader2, Save, CheckCircle2, Building2, Truck, Move, RotateCcw, Plus, Download, ExternalLink, Eye, SlidersHorizontal, X, MoreVertical
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface InvoiceBuilderProps {
  initialInvoice?: any;
  onBack?: () => void;
  onSendEmail?: (inv: any) => void;
  onNavigateView?: (mode: any) => void;
  paperSettings?: any;
}

interface OffsetData {
  x: number;
  y: number;
  scale?: number;
  width?: number;
  height?: number;
}

interface DraggableElementProps {
  id: string;
  isDragMode: boolean;
  offsets: Record<string, OffsetData>;
  onOffsetChange: (id: string, offset: OffsetData) => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
  inline?: boolean;
  resizable?: boolean;
}

const DraggableElement: React.FC<DraggableElementProps> = ({
  id,
  isDragMode,
  offsets,
  onOffsetChange,
  children,
  className = '',
  label,
  inline = false,
  resizable = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const currentOffset = offsets[id] || { x: 0, y: 0, scale: 1 };
  const currentScale = currentOffset.scale || 1;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDragMode || isResizing) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = currentOffset.x || 0;
    const initialY = currentOffset.y || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onOffsetChange(id, { ...currentOffset, x: initialX + dx, y: initialY + dy });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isDragMode) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const initialScale = currentScale;

    const handleResizeMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dScale = dx / 120;
      const newScale = Math.max(0.3, Math.min(3.0, Math.round((initialScale + dScale) * 100) / 100));
      onOffsetChange(id, { ...currentOffset, scale: newScale });
    };

    const handleResizeMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };

    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleQuickScale = (delta: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newScale = Math.max(0.3, Math.min(3.0, Math.round((currentScale + delta) * 100) / 100));
    onOffsetChange(id, { ...currentOffset, scale: newScale });
  };

  const transformStyle: React.CSSProperties = {
    transform: `translate(${currentOffset.x || 0}px, ${currentOffset.y || 0}px) scale(${currentScale})`,
    transformOrigin: 'left bottom',
    transition: isDragging || isResizing ? 'none' : 'transform 0.05s ease-out',
    position: 'relative',
    zIndex: isDragging || isResizing ? 50 : isDragMode ? 10 : 'auto',
  };

  const Component = inline ? 'span' : 'div';

  if (!isDragMode) {
    return (
      <Component className={className} style={transformStyle}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      onMouseDown={handleMouseDown}
      className={`group relative transition-all duration-150 ${className} ${
        isDragging || isResizing
          ? 'outline-2 outline-dashed outline-blue-600 bg-blue-500/10 cursor-grabbing shadow-lg select-none z-50'
          : 'hover:outline-2 hover:outline-dashed hover:outline-blue-400 hover:bg-blue-500/5 cursor-grab select-none'
      }`}
      style={transformStyle}
      title={isDragMode ? `Click & Drag to reposition ${label || id}` : undefined}
    >
      <span className="no-print opacity-0 group-hover:opacity-100 absolute -top-6 left-0 bg-blue-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-50 flex items-center gap-1.5 whitespace-nowrap transition-opacity">
        <Move className="w-2.5 h-2.5" />
        <span>{label || id} ({Math.round(currentScale * 100)}%)</span>
      </span>

      {resizable && (
        <span className="no-print opacity-0 group-hover:opacity-100 absolute -top-6 right-0 bg-slate-900 text-white text-[9px] font-mono px-1 py-0.5 rounded shadow z-50 flex items-center gap-1 transition-opacity pointer-events-auto">
          <button
            type="button"
            onClick={(e) => handleQuickScale(-0.1, e)}
            className="hover:bg-slate-700 px-1 rounded font-bold cursor-pointer"
            title="Perkecil Logo"
          >
            -
          </button>
          <span>{Math.round(currentScale * 100)}%</span>
          <button
            type="button"
            onClick={(e) => handleQuickScale(0.1, e)}
            className="hover:bg-slate-700 px-1 rounded font-bold cursor-pointer"
            title="Perbesar Logo"
          >
            +
          </button>
        </span>
      )}

      {children}

      {resizable && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="no-print absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md z-50 flex items-center justify-center hover:scale-125 transition-transform"
          title="Drag handle to resize logo larger or smaller"
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      )}
    </Component>
  );
};

// Module-level in-memory cache for instant page switching without loading screens
let memoizedInvoiceSettingsInv: any = null;
let memoizedCompletedQuotationsInv: Quotation[] = [];
let memoizedSavedInvoicesInv: any[] = [];

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  initialInvoice,
  onBack,
  onSendEmail,
  onNavigateView,
  paperSettings: propInvoiceSettings,
}) => {
  const [completedQuotations, setCompletedQuotations] = useState<Quotation[]>(memoizedCompletedQuotationsInv);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(memoizedCompletedQuotationsInv.length === 0);
  const [selectedQuoId, setSelectedQuoId] = useState<string>('');
  
  const [savedInvoices, setSavedInvoices] = useState<any[]>(memoizedSavedInvoicesInv);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(memoizedSavedInvoicesInv.length === 0);
  const [selectedSavedInvoiceId, setSelectedSavedInvoiceId] = useState<string>(initialInvoice?.id || '');

  const [invoiceSettings, setInvoiceSettings] = useState<any>(propInvoiceSettings || memoizedInvoiceSettingsInv || null);
  const [isLoadingInvoiceSettings, setIsLoadingInvoiceSettings] = useState<boolean>(!propInvoiceSettings && !memoizedInvoiceSettingsInv);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isLeftQuoDropdownOpen, setIsLeftQuoDropdownOpen] = useState<boolean>(false);

  // Drag Mode & Element Offsets State
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [layoutSaveNotice, setLayoutSaveNotice] = useState<string | null>(null);

  const handleOffsetChange = (id: string, newOffset: { x: number; y: number }) => {
    setOffsets((prev) => ({ ...prev, [id]: newOffset }));
  };

  const handleSaveLayout = (targetOffsets?: Record<string, { x: number; y: number }>) => {
    const toSave = targetOffsets !== undefined ? targetOffsets : offsets;
    setIsSavingLayout(true);
    fetch(getApiUrl('/api_invoice_settings.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_layout',
        layout_offsets: toSave,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSavingLayout(false);
        if (data.status === 'success') {
          const updatedSettings = { ...(invoiceSettings || {}), layout_offsets: toSave };
          setInvoiceSettings(updatedSettings);
          memoizedInvoiceSettingsInv = updatedSettings;
          setLayoutSaveNotice('Invoice layout positions saved permanently!');
          setTimeout(() => setLayoutSaveNotice(null), 3000);
        }
      })
      .catch((err) => {
        setIsSavingLayout(false);
        console.error('Error saving invoice layout offsets:', err);
      });
  };

  const handleResetLayout = () => {
    setOffsets({});
    handleSaveLayout({});
  };

  // Auto-load saved layout offsets from system_invoice_settings database
  useEffect(() => {
    if (invoiceSettings && invoiceSettings.layout_offsets) {
      try {
        const parsed = typeof invoiceSettings.layout_offsets === 'string'
          ? JSON.parse(invoiceSettings.layout_offsets)
          : invoiceSettings.layout_offsets;
        if (parsed && typeof parsed === 'object') {
          setOffsets(parsed);
        }
      } catch (err) {
        console.error('Error parsing layout_offsets in InvoiceBuilder:', err);
      }
    }
  }, [invoiceSettings]);

  // Invoice Form State
  const [invoiceId, setInvoiceId] = useState<string>(initialInvoice?.id || `INV-${Date.now()}`);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialInvoice?.invoice_number || `ABM/INV/${new Date().toISOString().split('T')[0].replace(/-/g, '')}/${Math.floor(100 + Math.random() * 900)}`);
  
  // Modal States
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isPaperSetupModalOpen, setIsPaperSetupModalOpen] = useState<boolean>(false);

  // Paper Setup Modal Form Fields
  const [modalPaperSize, setModalPaperSize] = useState<string>('A4');
  const [modalMarginTop, setModalMarginTop] = useState<number>(18);
  const [modalMarginBottom, setModalMarginBottom] = useState<number>(18);
  const [modalMarginLeft, setModalMarginLeft] = useState<number>(14);
  const [modalMarginRight, setModalMarginRight] = useState<number>(14);
  const [modalFontSize, setModalFontSize] = useState<number>(9);
  const [modalTableHeaderBg, setModalTableHeaderBg] = useState<string>('#0070c0');
  const [isSavingPaperSetup, setIsSavingPaperSetup] = useState<boolean>(false);
  const [quotationId, setQuotationId] = useState<string>(initialInvoice?.quotation_id || '');
  const [poNumber, setPoNumber] = useState<string>(initialInvoice?.po_number || '');
  const [invoiceDate, setInvoiceDate] = useState<string>(initialInvoice?.invoice_date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(initialInvoice?.due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  
  // Billing Address State (TO:)
  const [clientName, setClientName] = useState<string>(initialInvoice?.client_name || '');
  const [clientEmail, setClientEmail] = useState<string>(initialInvoice?.client_email || '');
  const [clientPhone, setClientPhone] = useState<string>(initialInvoice?.client_phone || '');
  const [companyName, setCompanyName] = useState<string>(initialInvoice?.company_name || '');
  const [billingAddress, setBillingAddress] = useState<string>(initialInvoice?.billing_address || '');

  // Delivery Address State (DELIVERY:)
  const [deliveryCompany, setDeliveryCompany] = useState<string>(initialInvoice?.delivery_company || '');
  const [deliveryAddress, setDeliveryAddress] = useState<string>(initialInvoice?.delivery_address || '');
  const [deliveryPic, setDeliveryPic] = useState<string>(initialInvoice?.delivery_pic || '');
  const [deliveryPhone, setDeliveryPhone] = useState<string>(initialInvoice?.delivery_phone || '');

  // Items & Financials
  const [items, setItems] = useState<InvoiceItem[]>(initialInvoice?.items || []);
  const [subtotal, setSubtotal] = useState<number>(initialInvoice?.subtotal || 0);
  const [discountTotal, setDiscountTotal] = useState<number>(initialInvoice?.discount_total || 0);
  const [taxPercent, setTaxPercent] = useState<number>(initialInvoice?.tax_percent || 0);
  const [taxAmount, setTaxAmount] = useState<number>(initialInvoice?.tax_amount || 0);
  const [grandTotal, setGrandTotal] = useState<number>(initialInvoice?.grand_total || 0);
  const [notes] = useState<string>(initialInvoice?.notes || '');
  const [status] = useState<string>(initialInvoice?.status || 'unpaid');

  // Fetch invoice settings from dedicated MySQL table (system_invoice_settings) (cached)
  useEffect(() => {
    if (!invoiceSettings) {
      if (!memoizedInvoiceSettingsInv) setIsLoadingInvoiceSettings(true);
      fetch(getApiUrl('/api_invoice_settings.php'))
        .then((res) => res.json())
        .then((data) => {
          setIsLoadingInvoiceSettings(false);
          if (data.status === 'success' && data.data) {
            memoizedInvoiceSettingsInv = data.data;
            setInvoiceSettings(data.data);
          }
        })
        .catch((err) => {
          setIsLoadingInvoiceSettings(false);
          console.error('Error fetching invoice settings:', err);
        });
    } else {
      memoizedInvoiceSettingsInv = invoiceSettings;
      setIsLoadingInvoiceSettings(false);
    }
  }, [invoiceSettings]);

  // Fetch saved invoices from MySQL database (/api_invoices.php)
  const fetchSavedInvoicesList = () => {
    setIsLoadingInvoices(true);
    fetch(getApiUrl('/api_invoices.php'))
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingInvoices(false);
        if (data.status === 'success' && Array.isArray(data.data)) {
          memoizedSavedInvoicesInv = data.data;
          setSavedInvoices(data.data);
        }
      })
      .catch((err) => {
        setIsLoadingInvoices(false);
        console.error('Error fetching saved invoices:', err);
      });
  };

  useEffect(() => {
    fetchSavedInvoicesList();
  }, []);

  // Fetch all quotations from MySQL database (/api_quotations.php) (cached)
  useEffect(() => {
    if (memoizedCompletedQuotationsInv.length === 0) setIsLoadingQuotations(true);
    fetch(getApiUrl('/api_quotations.php'))
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingQuotations(false);
        if (data.status === 'success' && Array.isArray(data.data)) {
          memoizedCompletedQuotationsInv = data.data;
          setCompletedQuotations(data.data);
        }
      })
      .catch((err) => {
        setIsLoadingQuotations(false);
        console.error('Error fetching quotations:', err);
      });
  }, []);

  // Load a Saved Invoice from Database
  const handleSelectSavedInvoice = (invId: string) => {
    setSelectedSavedInvoiceId(invId);
    if (!invId) return;

    const target = savedInvoices.find((inv) => String(inv.id) === String(invId));
    if (target) {
      populateFromInvoice(target);
    } else {
      fetch(getApiUrl(`/api_invoices.php?id=${invId}`))
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && data.data) {
            populateFromInvoice(data.data);
          }
        })
        .catch((err) => console.error('Error fetching invoice details:', err));
    }
  };

  const populateFromInvoice = (inv: any) => {
    setInvoiceId(inv.id || `INV-${Date.now()}`);
    setInvoiceNumber(inv.invoice_number || '');
    setQuotationId(inv.quotation_id || '');
    setPoNumber(inv.po_number || '');
    setInvoiceDate(inv.invoice_date || new Date().toISOString().split('T')[0]);
    setDueDate(inv.due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setClientName(inv.client_name || '');
    setClientEmail(inv.client_email || '');
    setClientPhone(inv.client_phone || '');
    setCompanyName(inv.company_name || '');
    setBillingAddress(inv.billing_address || '');
    setDeliveryCompany(inv.delivery_company || '');
    setDeliveryAddress(inv.delivery_address || '');
    setDeliveryPic(inv.delivery_pic || '');
    setDeliveryPhone(inv.delivery_phone || '');

    const rawItems = inv.items || [];
    setItems(rawItems.map((it: any) => ({
      product_code: it.product_code || '',
      description: it.description || '',
      specification: it.specification || '',
      quantity: Number(it.quantity || 1),
      unit: it.unit || 'Unit',
      unit_price: Number(it.unit_price || 0),
      discount_percent: Number(it.discount_percent || 0),
      total: Number(it.total || 0),
      image_url: it.image_url || '',
    })));

    setSubtotal(Number(inv.subtotal || 0));
    setDiscountTotal(Number(inv.discount_total || 0));
    setTaxPercent(Number(inv.tax_percent || 11));
    setTaxAmount(Number(inv.tax_amount || 0));
    setGrandTotal(Number(inv.grand_total || 0));
  };

  const handleCreateNewInvoice = () => {
    setSelectedSavedInvoiceId('');
    setSelectedQuoId('');
    setInvoiceId(`INV-${Date.now()}`);
    setInvoiceNumber(`ABM/INV/${new Date().toISOString().split('T')[0].replace(/-/g, '')}/${Math.floor(100 + Math.random() * 900)}`);
    setQuotationId('');
    setPoNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setCompanyName('');
    setBillingAddress('');
    setDeliveryCompany('');
    setDeliveryAddress('');
    setDeliveryPic('');
    setDeliveryPhone('');
    setItems([]);
    setSubtotal(0);
    setDiscountTotal(0);
    setTaxPercent(11);
    setTaxAmount(0);
    setGrandTotal(0);
  };

  // Populate Invoice fields from selected completed Quotation
  const handleSelectQuotation = (quoId: string) => {
    setSelectedQuoId(quoId);
    if (!quoId) return;

    const quo = completedQuotations.find((q) => String(q.id) === String(quoId));
    if (quo) {
      populateFromQuotation(quo);
    } else {
      fetch(getApiUrl(`/api_quotations.php?action=get&id=${quoId}`))
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && data.data) {
            populateFromQuotation(data.data);
          }
        })
        .catch((err) => console.error('Error fetching quotation detail:', err));
    }
  };

  const populateFromQuotation = (quo: Quotation) => {
    setQuotationId(quo.id || '');
    setClientName(quo.client_name || '');
    setClientEmail(quo.client_email || '');
    setClientPhone(quo.client_phone || '');
    setCompanyName(quo.company_name || '');
    setBillingAddress(quo.company_address || '');
    
    // Default delivery address to billing address if empty
    setDeliveryCompany(quo.company_name || '');
    setDeliveryAddress(quo.company_address || '');
    setDeliveryPic(quo.client_name || '');
    setDeliveryPhone(quo.client_phone || '');

    const rawItems = quo.items || (quo as any).items_details || [];
    const mappedItems: InvoiceItem[] = rawItems.map((it: any) => ({
      product_code: it.product_code || it.item_code || '',
      description: it.description || '',
      specification: it.specification || it.offer || '',
      quantity: Number(it.quantity || it.qty || 1),
      unit: it.unit || 'Unit',
      unit_price: Number(it.unit_price || 0),
      discount_percent: Number(it.discount_percent || 0),
      total: Number(it.total || 0),
      image_url: it.image_url || '',
    }));

    setItems(mappedItems);
    setSubtotal(Number(quo.subtotal || quo.grand_total || 0));
    setDiscountTotal(Number(quo.discount_total || 0));
    setTaxPercent(Number(quo.tax_percent || 0));
    setTaxAmount(Number(quo.tax_amount || 0));
    setGrandTotal(Number(quo.grand_total || 0));
  };

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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdfDirect = () => {
    const targetId = invoiceId || invoiceNumber;
    const downloadUrl = `/api_pdf_doc.php?type=invoice&id=${encodeURIComponent(targetId)}&action=download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${invoiceNumber || 'INV-ABM'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewPdfInTab = () => {
    const targetId = invoiceId || invoiceNumber;
    const previewUrl = `/api_pdf_doc.php?type=invoice&id=${encodeURIComponent(targetId)}&action=stream`;
    window.open(previewUrl, '_blank');
  };

  const handleSaveInvoice = () => {
    setIsSaving(true);
    const payload = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      quotation_id: quotationId,
      po_number: poNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      company_name: companyName,
      billing_address: billingAddress,
      delivery_company: deliveryCompany,
      delivery_address: deliveryAddress,
      delivery_pic: deliveryPic,
      delivery_phone: deliveryPhone,
      subtotal: subtotal,
      discount_total: discountTotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      bank_name: invoiceSettings?.bank_name || 'PUBLIC BANK',
      bank_account_number: invoiceSettings?.bank_account_number || '3818192115',
      bank_account_name: invoiceSettings?.bank_account_name || 'AB MALAYA INDUSTRY',
      bank_email: invoiceSettings?.bank_email || 'abmalayaindustry@gmail.com',
      notes: notes,
      status: status,
      items: items,
    };

    fetch(getApiUrl('/api_invoices.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSaving(false);
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Invoice ${invoiceNumber} saved successfully to MySQL database!`);
          fetchSavedInvoicesList();
          setTimeout(() => setSaveSuccessMessage(null), 4000);
        } else {
          alert('Failed to save invoice: ' + (resData.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSaving(false);
        console.error('Save invoice error:', err);
        alert('Save invoice error: ' + err.message);
      });
  };

  const logoUrl = invoiceSettings?.logo_url || invoiceSettings?.logoUrl;
  const stampUrl = invoiceSettings?.stamp_url || invoiceSettings?.stampUrl;
  const signatureUrl = invoiceSettings?.signature_url || invoiceSettings?.signatureUrl;
  const headerImageUrl = invoiceSettings?.header_image_url || invoiceSettings?.headerImageUrl;
  const companyNameSetting = invoiceSettings?.company_name || invoiceSettings?.companyName || 'AB MALAYA INDUSTRY';
  const companyRegNoSetting = invoiceSettings?.company_reg_no || invoiceSettings?.companyRegNo || '003320457-D';
  const companyAddressSetting = invoiceSettings?.company_address || invoiceSettings?.companyAddress || 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur';
  const companyEmailSetting = invoiceSettings?.email || invoiceSettings?.companyEmail || 'abmalayaindustry@gmail.com';
  const companyPhoneSetting = invoiceSettings?.phone || invoiceSettings?.companyPhone || '+60 3-8000 1234';
  const invoiceTitleSetting = invoiceSettings?.invoice_title || invoiceSettings?.invoiceTitle || 'OFFICIAL INVOICE';

  const bankName = invoiceSettings?.bank_name || invoiceSettings?.bankName || 'PUBLIC BANK';
  const bankAccount = invoiceSettings?.bank_account_number || invoiceSettings?.bankAccountNumber || '3818192115';
  const bankHolder = invoiceSettings?.bank_account_name || invoiceSettings?.bankAccountName || 'AB MALAYA INDUSTRY';
  const bankEmail = invoiceSettings?.bank_email || invoiceSettings?.bankEmail || companyEmailSetting;
  const remarksText = invoiceSettings?.remarks_text || invoiceSettings?.remarksText;

  const authSignatoryName = invoiceSettings?.authorised_by_name || invoiceSettings?.authorisedByName || 'Muhammad Aimanuddin Bin Mohd Zaki';
  const authSignatoryTitle = invoiceSettings?.authorised_by_title || invoiceSettings?.authorisedByTitle || 'Procurement Manager / Head of Sales';
  const receivedByLabel = invoiceSettings?.received_by_label || invoiceSettings?.receivedByLabel || 'Received by,';

  const tableHeaderBg = invoiceSettings?.table_header_bg || invoiceSettings?.tableHeaderBg || '#0070c0';
  const tableHeaderTextColor = invoiceSettings?.table_header_text_color || invoiceSettings?.tableHeaderTextColor || '#ffffff';

  return (
    <div className="w-full h-full bg-[#f0f0f0] flex flex-col font-sans p-0 m-0 overflow-y-auto">
      
      {/* FROZEN STICKY TOP NAVBAR (MATCHING BUILDER STYLE) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-3 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs sticky top-0 z-30 print:hidden">
        
        {/* LEFT SECTION: Options Dropdown + Completed Quotations Selector */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          
          {/* OPTIONS DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLeftQuoDropdownOpen(!isLeftQuoDropdownOpen)}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-2.5 py-1 rounded shadow-inner cursor-pointer transition"
              title="Options, PDF Preview & Paper Setup (...)"
            >
              <MoreVertical className="w-4 h-4 text-[#0099ec]" />
              <span>Options (...)</span>
              <ChevronDown className="w-3 h-3 text-slate-600" />
            </button>

            {isLeftQuoDropdownOpen && (
              <div className="absolute left-0 top-8 w-60 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleCreateNewInvoice();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-700 hover:bg-blue-50 font-bold cursor-pointer text-left transition"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Create New Blank Invoice</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleSaveInvoice();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span>Save Invoice to MySQL</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsPdfModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-800 hover:bg-blue-50 font-bold cursor-pointer text-left transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview PDF Live (Web Viewer)</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleDownloadPdfDirect();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download PDF (Dompdf Engine)</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsPaperSetupModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-purple-800 hover:bg-purple-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                  <span>Paper & Margins Setup</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handlePreviewPdfInTab();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Preview PDF in New Tab</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handlePrint();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print / Export Invoice PDF</span>
                </button>

                {onSendEmail && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      onSendEmail({
                        id: invoiceId,
                        invoice_number: invoiceNumber,
                        client_email: clientEmail,
                        company_name: companyName,
                        grand_total: grandTotal,
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Send Invoice via Email</span>
                  </button>
                )}

                {onNavigateView && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      onNavigateView('quotation_list');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-slate-50 hover:text-slate-900 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>View Quotation List</span>
                  </button>
                )}

                {onNavigateView && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      onNavigateView('system_settings');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-purple-50 hover:text-purple-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-purple-600" />
                    <span>Invoice & Bank Settings</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SAVED INVOICES SELECTOR DROPDOWN */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-[11px]">Saved Invoice:</span>
            <select
              value={selectedSavedInvoiceId}
              onChange={(e) => handleSelectSavedInvoice(e.target.value)}
              disabled={isLoadingInvoices}
              className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-3 py-1 text-xs text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer max-w-xs focus:outline-none disabled:opacity-60 transition"
            >
              <option value="">
                {isLoadingInvoices ? '-- Loading Invoices... --' : savedInvoices.length === 0 ? '-- No Saved Invoices --' : '-- Load Saved Invoice --'}
              </option>
              {savedInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} • {inv.client_name || inv.company_name} ({formatCurrency(inv.grand_total || 0)})
                </option>
              ))}
            </select>
          </div>

          {/* SPH / QUOTATIONS SELECTOR DROPDOWN */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-[11px]">Load from SPH:</span>
            <select
              value={selectedQuoId}
              onChange={(e) => handleSelectQuotation(e.target.value)}
              disabled={isLoadingQuotations}
              className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-3 py-1 text-xs text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer max-w-xs focus:outline-none disabled:opacity-60 transition"
            >
              <option value="">
                {isLoadingQuotations ? '-- Loading Quotations... --' : '-- Select SPH / Quotation --'}
              </option>
              {completedQuotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotation_number} • {q.company_name || q.client_name} ({formatCurrency(q.grand_total || 0)}) [{q.status || 'draft'}]
                </option>
              ))}
            </select>
          </div>

          {isLoadingQuotations && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              <span>Loading SPH...</span>
            </div>
          )}

          {saveSuccessMessage && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* RIGHT SECTION: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* DRAG & MOVE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={() => setIsDragMode(!isDragMode)}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-1 transition cursor-pointer rounded border shadow-xs ${
              isDragMode
                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400 animate-pulse'
                : 'bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-slate-800 border-[#a0a0a0] shadow-inner'
            }`}
            title="Toggle Drag & Reposition Mode to move elements freely"
          >
            <Move className={`w-3.5 h-3.5 ${isDragMode ? 'text-white' : 'text-blue-600'}`} />
            <span>{isDragMode ? 'Exit Drag Mode' : 'Drag & Move'}</span>
          </button>

          {/* SAVE LAYOUT POSITIONS PERMANENTLY BUTTON */}
          <button
            type="button"
            onClick={() => handleSaveLayout()}
            disabled={isSavingLayout}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border border-sky-800 disabled:opacity-60"
            title="Save custom element positions permanently to database"
          >
            {isSavingLayout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
            <span>{isSavingLayout ? 'Saving...' : 'Save Layout'}</span>
          </button>

          {/* RESET LAYOUT POSITIONS BUTTON */}
          {Object.keys(offsets).length > 0 && (
            <button
              type="button"
              onClick={handleResetLayout}
              className="flex items-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-rose-700 font-bold text-xs px-2.5 py-1 transition cursor-pointer border border-[#a0a0a0] rounded shadow-inner"
              title="Reset all element positions to default and clear from database"
            >
              <RotateCcw className="w-3 h-3 text-rose-600" />
              <span>Reset Layout</span>
            </button>
          )}

          {layoutSaveNotice && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{layoutSaveNotice}</span>
            </div>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-slate-800 font-bold text-xs px-3 py-1 transition cursor-pointer border border-[#a0a0a0] rounded shadow-inner"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              <span>Back</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#4f46e5] to-[#3730a3] hover:from-[#4338ca] hover:to-[#312e81] text-white font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border border-indigo-800"
            title="Preview rendered Dompdf Invoice PDF live on screen inside a clean modal viewer"
          >
            <Eye className="w-3.5 h-3.5 text-white" />
            <span>PDF Preview (Live)</span>
          </button>

          <button
            onClick={handleSaveInvoice}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white font-bold text-xs px-3.5 py-1 shadow-xs transition cursor-pointer rounded border border-sky-800 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
            <span>{isSaving ? 'Saving...' : 'Save Invoice'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdfDirect}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#10b981] to-[#047857] hover:from-[#059669] hover:to-[#046c4e] text-white font-bold text-xs px-3.5 py-1 shadow-xs transition cursor-pointer rounded border border-emerald-800"
            title="Download crisp Invoice PDF generated by pure PHP 8.1 Dompdf engine"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#3d3d3d] to-[#222222] hover:from-[#2d2d2d] hover:to-[#111111] text-white font-bold text-xs px-3.5 py-1 transition cursor-pointer shadow-xs rounded border border-slate-900"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span>Print</span>
          </button>
        </div>

      </div>

      {/* DRAG MODE ACTIVE BANNER NOTICE (Shown when in Drag Mode) */}
      {isDragMode && (
        <div className="no-print bg-blue-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 sticky top-[49px] z-30 animate-in fade-in">
          <Move className="w-4 h-4 animate-bounce" />
          <span>DRAG MODE ACTIVE: Click & drag any logo, text, address, table, photo, signature, or stamp on the invoice to reposition freely!</span>
          <button
            onClick={() => setIsDragMode(false)}
            className="ml-3 bg-white text-blue-800 px-2 py-0.5 rounded text-[11px] font-black uppercase hover:bg-blue-50 transition"
          >
            Done
          </button>
        </div>
      )}

      {/* OFFICIAL INVOICE PAPER SHEET CONTAINER */}
      <div className="p-4 sm:p-6 w-full max-w-full">
        <div
          id="official-invoice-document"
          className="bg-white text-slate-900 p-8 sm:p-12 font-sans border border-slate-400 shadow-xl w-full max-w-full rounded-none relative overflow-hidden"
        >
          <table className="w-full border-collapse">
            {/* 1. REPEATING HEADER BANNER & LOGO FOR PRINT / MULTI-PAGE */}
            <thead className="table-header-group">
              <tr>
                <td className="p-0 border-none pb-4">
                  <div className="relative -mx-8 -mt-8 sm:-mx-12 sm:-mt-12 mb-4 w-[calc(100%+4rem)] sm:w-[calc(100%+6rem)] overflow-hidden border-b-2 border-[#004f8b] min-h-[120px] sm:min-h-[140px] flex items-stretch">
                    {headerImageUrl ? (
                      <img
                        src={headerImageUrl}
                        alt="Header Background"
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0 brightness-[1.02] contrast-[1.05]"
                      />
                    ) : (
                      <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-[#004f8b] via-[#0070c0] to-[#0080d0] z-0"></div>
                    )}

                    <div className="relative z-10 px-8 pt-6 sm:px-12 sm:pt-8 pb-2 sm:pb-3 flex flex-col sm:flex-row items-end justify-between gap-6 w-full">
                      <DraggableElement id="invoice_logo" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Logo" resizable={true} className="self-end pb-0.5">
                        <div className="flex items-end gap-4">
                          {isLoadingInvoiceSettings ? (
                            <div className="h-16 w-36 bg-white/90 border border-slate-300 rounded-none flex items-center justify-center gap-2 text-xs text-blue-700 font-mono font-bold animate-pulse shrink-0">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              <span>Loading...</span>
                            </div>
                          ) : logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={companyNameSetting}
                              className="h-16 max-w-[240px] object-contain shrink-0 pointer-events-none"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/favicon.png';
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-14 h-14 bg-[#004f8b] text-white font-black text-2xl flex items-center justify-center tracking-wider rounded-none shadow-xs">
                                Ab
                              </div>
                              <div>
                                <h2 className="text-xl font-black text-[#004f8b] tracking-wide uppercase leading-none">{companyNameSetting}</h2>
                                <span className="text-xs font-bold text-[#0070c0] font-mono block">({companyRegNoSetting})</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </DraggableElement>

                      <DraggableElement id="invoice_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Company Address" className="self-end pb-0.5">
                        <div className="text-left sm:text-right text-xs text-slate-800 leading-snug font-sans shrink-0 font-medium">
                          <p className="font-bold text-slate-900 text-xs">{companyNameSetting}</p>
                          <p className="max-w-xs">{companyAddressSetting}</p>
                          <p className="font-semibold text-slate-900 font-mono">{companyPhoneSetting} | {companyEmailSetting}</p>
                        </div>
                      </DraggableElement>
                    </div>
                  </div>
                </td>
              </tr>
            </thead>

            {/* MAIN DOCUMENT BODY */}
            <tbody>
              <tr>
                <td className="p-0 border-none space-y-6">
                  {/* 2. SOLID TITLE STRIP BANNER: OFFICIAL INVOICE */}
                  <DraggableElement id="invoice_title" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Title Banner">
                    <div 
                      className="font-black text-center py-2 uppercase tracking-widest text-sm shadow-2xs rounded-none"
                      style={{ backgroundColor: tableHeaderBg, color: tableHeaderTextColor }}
                    >
                      {invoiceTitleSetting}
                    </div>
                  </DraggableElement>

                  {/* 3. METADATA SECTION & 2-COLUMN ADDRESS LAYOUT */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs text-slate-800 border-b border-slate-300 pb-5">
                    
                    {/* LEFT COLUMN: TO / BILLING ADDRESS */}
                    <DraggableElement id="invoice_to_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="TO Address Box" className="md:col-span-6">
                      <div className="space-y-2 bg-slate-50/70 p-3.5 border border-slate-300">
                        <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wide text-[11px] border-b border-slate-300 pb-1">
                          <Building2 className="w-3.5 h-3.5 text-[#0070c0]" />
                          <span>TO (BILLING ADDRESS):</span>
                        </div>
                        <div className="space-y-1 font-sans">
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Client Company Name (e.g. Duta Marine Sdn Bhd)"
                            className="w-full bg-white border border-slate-300 px-2 py-1 font-bold text-slate-900 rounded-none text-xs focus:outline-none"
                          />
                          <textarea
                            rows={2}
                            value={billingAddress}
                            onChange={(e) => setBillingAddress(e.target.value)}
                            placeholder="Billing Street Address & Location"
                            className="w-full bg-white border border-slate-300 px-2 py-1 text-slate-700 rounded-none text-xs focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Attention (PIC):</span>
                              <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Attention / Contact Person"
                                className="w-full bg-white border border-slate-300 px-2 py-0.5 font-semibold text-slate-900 rounded-none text-[11px]"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Email:</span>
                              <input
                                type="text"
                                value={clientEmail}
                                onChange={(e) => setClientEmail(e.target.value)}
                                placeholder="client@company.com"
                                className="w-full bg-white border border-slate-300 px-2 py-0.5 font-mono text-slate-800 rounded-none text-[11px]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </DraggableElement>

                    {/* RIGHT COLUMN: DELIVERY / SHIPPING ADDRESS */}
                    <DraggableElement id="invoice_del_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="DELIVERY Address Box" className="md:col-span-6">
                      <div className="space-y-2 bg-slate-50/70 p-3.5 border border-slate-300">
                        <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wide text-[11px] border-b border-slate-300 pb-1">
                          <Truck className="w-3.5 h-3.5 text-[#0070c0]" />
                          <span>DELIVERY (SHIPPING ADDRESS):</span>
                        </div>
                        <div className="space-y-1 font-sans">
                          <input
                            type="text"
                            value={deliveryCompany}
                            onChange={(e) => setDeliveryCompany(e.target.value)}
                            placeholder="Delivery Ship / Project Name (e.g. C/O Masters of AG Azzam)"
                            className="w-full bg-white border border-slate-300 px-2 py-1 font-bold text-slate-900 rounded-none text-xs focus:outline-none"
                          />
                          <textarea
                            rows={2}
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Delivery Destination / Yard Address"
                            className="w-full bg-white border border-slate-300 px-2 py-1 text-slate-700 rounded-none text-xs focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Delivery PIC:</span>
                              <input
                                type="text"
                                value={deliveryPic}
                                onChange={(e) => setDeliveryPic(e.target.value)}
                                placeholder="Delivery Contact Person"
                                className="w-full bg-white border border-slate-300 px-2 py-0.5 font-semibold text-slate-900 rounded-none text-[11px]"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Contact No:</span>
                              <input
                                type="text"
                                value={deliveryPhone}
                                onChange={(e) => setDeliveryPhone(e.target.value)}
                                placeholder="+6012-3456789"
                                className="w-full bg-white border border-slate-300 px-2 py-0.5 font-mono text-slate-800 rounded-none text-[11px]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </DraggableElement>

                    {/* INVOICE METADATA ROW */}
                    <DraggableElement id="invoice_meta" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Invoice Numbers & Date" className="md:col-span-12">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3 border border-slate-300 font-mono">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Invoice No. :</span>
                          <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 px-2 py-1 font-extrabold text-slate-900 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Invoice Date :</span>
                          <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 px-2 py-1 font-bold text-slate-900 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">PO Numb (Client PO) :</span>
                          <input
                            type="text"
                            value={poNumber}
                            onChange={(e) => setPoNumber(e.target.value)}
                            placeholder="e.g. DM/AGA/ABMI/PO/279/24"
                            className="w-full bg-blue-50 border border-blue-300 px-2 py-1 font-black text-blue-900 text-xs"
                          />
                        </div>
                      </div>
                    </DraggableElement>

                  </div>

                  {/* 4. LINE ITEMS TABLE WITH PHOTO THUMBNAIL (SHARP BLACK GRID) */}
                  <DraggableElement id="invoice_table" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Invoice Items Table">
                    <div className="border border-slate-900 rounded-none overflow-x-auto w-full bg-white">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead 
                          className="font-bold text-[11px] uppercase tracking-wide border-b border-slate-900"
                          style={{ backgroundColor: tableHeaderBg, color: tableHeaderTextColor }}
                        >
                          <tr>
                            <th className="p-2.5 w-10 text-center border-r border-slate-900">NO.</th>
                            <th className="p-2.5 w-16 text-center border-r border-slate-900">PHOTO</th>
                            <th className="p-2.5 border-r border-slate-900 min-w-[220px]">PRODUCTS & SPECIFICATIONS</th>
                            <th className="p-2.5 w-16 text-center border-r border-slate-900">QTT</th>
                            <th className="p-2.5 w-32 text-right border-r border-slate-900">PRICE PER UNIT (RM)</th>
                            <th className="p-2.5 w-36 text-right">PRICE TOTAL (RM)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {items.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 italic font-medium">
                                No items listed. Please select a completed Quotation above to populate items.
                              </td>
                            </tr>
                          ) : (
                            items.map((item, idx) => (
                              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/90' : 'bg-white'}>
                                <td className="p-2.5 text-center font-mono font-bold text-slate-800 border-r border-slate-900">
                                  {idx + 1}
                                </td>

                                {/* Photo Thumbnail */}
                                <td className="p-1.5 text-center border-r border-slate-900">
                                  {item.image_url ? (
                                    <DraggableElement id={`inv_photo_${idx}`} isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label={`Photo #${idx + 1}`} inline>
                                      <img
                                        src={item.image_url}
                                        alt={item.description}
                                        className="w-10 h-10 object-cover border border-slate-400 rounded-none mx-auto pointer-events-none"
                                      />
                                    </DraggableElement>
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-100 border border-slate-300 rounded-none mx-auto flex items-center justify-center text-slate-400" title="No photo">
                                      <Package className="w-4 h-4 opacity-40" />
                                    </div>
                                  )}
                                </td>

                                {/* Product Name & Specifications */}
                                <td className="p-2.5 border-r border-slate-900">
                                  <p className="font-bold text-slate-900 text-xs">{item.description}</p>
                                  {item.specification && (
                                    <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{item.specification}</p>
                                  )}
                                  {item.product_code && (
                                    <span className="inline-block font-mono text-[10px] text-purple-900 font-bold bg-purple-50 px-1 rounded border border-purple-200 mt-1">
                                      Code: {item.product_code}
                                    </span>
                                  )}
                                </td>

                                {/* QTT */}
                                <td className="p-2.5 text-center font-mono font-bold text-slate-900 border-r border-slate-900">
                                  {item.quantity} {item.unit || ''}
                                </td>

                                {/* Price Per Unit */}
                                <td className="p-2.5 text-right font-mono text-slate-900 border-r border-slate-900">
                                  {formatCurrency(item.unit_price)}
                                </td>

                                {/* Price Total */}
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900 text-xs">
                                  {formatCurrency(item.total)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </DraggableElement>

                  {/* 5. REMARKS / BANK PAYMENT INSTRUCTIONS & FINANCIAL TOTALS */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-2 w-full">
                    
                    {/* BANK PAYMENT INSTRUCTIONS (REMARKS BOX) */}
                    <DraggableElement id="invoice_bank_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Bank Payment Box" className="w-full md:w-1/2">
                      <div className="space-y-2 text-xs bg-slate-50 p-4 border border-slate-300">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-wide block border-b border-slate-300 pb-1">
                          Remarks & Bank Payment Instructions:
                        </span>
                        <div className="text-slate-800 leading-relaxed font-sans pt-1 space-y-1.5 text-xs whitespace-pre-line">
                          {remarksText ? (
                            <p>{remarksText}</p>
                          ) : (
                            <>
                              <p className="font-bold text-slate-900">
                                1. Please make all payment crossed & payable to: <u className="font-mono text-blue-900">{bankHolder}; {bankAccount} ({bankName})</u>
                              </p>
                              <p>
                                2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: <u className="font-mono font-bold text-blue-900">{bankEmail}</u>.
                              </p>
                              <p className="italic text-slate-600">
                                3. Do not forget to keep a copy of any document as a prove of any transaction.
                              </p>
                              <p className="text-[11px] text-slate-500 font-semibold pt-1">
                                Kindly contact us should you have further enquiries.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </DraggableElement>

                    {/* FINANCIAL TOTALS BOX */}
                    <DraggableElement id="invoice_summary" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Financial Summary" className="w-full md:w-80">
                      <div className="border-2 border-slate-900 rounded-none p-4 space-y-2 text-xs bg-white">
                        <div className="flex justify-between items-center text-slate-700">
                          <span className="font-semibold">GROSS SUBTOTAL:</span>
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                        </div>

                        {discountTotal > 0 && (
                          <div className="flex justify-between items-center text-amber-800">
                            <span className="font-semibold">TOTAL DISCOUNT:</span>
                            <span className="font-mono font-bold">-{formatCurrency(discountTotal)}</span>
                          </div>
                        )}

                        {taxAmount > 0 && (
                          <div className="flex justify-between items-center text-slate-700">
                            <span className="font-semibold">VAT TAX ({taxPercent}%):</span>
                            <span className="font-mono font-bold text-slate-900">{formatCurrency(taxAmount)}</span>
                          </div>
                        )}

                        <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-slate-900 font-black text-base">
                          <span>PRICE TOTAL (RM):</span>
                          <span className="font-mono text-[#0070c0]">{formatCurrency(grandTotal || subtotal)}</span>
                        </div>
                      </div>
                    </DraggableElement>

                  </div>

                  {/* 6. DUAL AUTHORIZATION SIGNATURE BLOCK (AUTHORISED BY & RECEIVED BY) */}
                  <div className="flex flex-col sm:flex-row justify-between items-end pt-8 border-t border-slate-300 text-xs w-full gap-8">
                    {/* AUTHORISED BY (ISSUER SIGNATORY) */}
                    <DraggableElement id="invoice_sig_auth" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Authorised By Signatory">
                      <div className="space-y-1 text-left">
                        <p className="text-slate-700 font-bold uppercase tracking-wide">Authorised by,</p>
                        
                        <div className="h-20 flex items-center justify-start my-1 gap-2">
                          {signatureUrl && (
                            <img
                              src={signatureUrl}
                              alt="Digital Signature"
                              className="h-20 object-contain max-w-[140px] pointer-events-none"
                            />
                          )}
                          {stampUrl && (
                            <img
                              src={stampUrl}
                              alt="Company Stamp"
                              className="h-20 object-contain max-w-[140px] pointer-events-none"
                            />
                          )}
                          {!signatureUrl && !stampUrl && (
                            <div className="w-36 h-12 border-2 border-[#0070c0] border-dashed flex items-center justify-center text-[#0070c0] text-[10px] font-black uppercase tracking-wider transform -rotate-2">
                              [STAMP]
                            </div>
                          )}
                        </div>

                        <p className="font-bold text-slate-900 text-sm"><u>{authSignatoryName}</u></p>
                        <p className="text-slate-600 font-mono text-[11px]">{authSignatoryTitle}</p>
                      </div>
                    </DraggableElement>

                    {/* RECEIVED BY (CLIENT RECEIVER SIGNATURE LINE) */}
                    <DraggableElement id="invoice_sig_recv" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Received By Line">
                      <div className="text-left sm:text-right space-y-1">
                        <p className="text-slate-700 font-bold uppercase tracking-wide">{receivedByLabel}</p>
                        
                        <div className="h-16 border-b-2 border-slate-900 w-56 my-1"></div>

                        <p className="font-bold text-slate-900">Name / Designation: ______________________</p>
                        <p className="text-slate-500 font-mono text-[11px]">Date: ____ / ____ / ________</p>
                      </div>
                    </DraggableElement>
                  </div>
                </td>
              </tr>
            </tbody>

            {/* REPEATING FOOTER FOR PRINT / MULTI-PAGE */}
            <tfoot className="table-footer-group">
              <tr>
                <td className="p-0 border-none pt-4">
                  {/* 7. OFFICIAL FOOTER BADGE */}
                  <DraggableElement id="invoice_footer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Footer">
                    <div className="border-t border-slate-300 pt-5 mt-6 text-center space-y-1 w-full">
                      <h4 className="font-extrabold text-xs text-[#004f8b] uppercase tracking-wide">{companyNameSetting}</h4>
                      <p className="text-[10px] text-slate-600 font-mono">
                        {companyAddressSetting} | Email: {companyEmailSetting} | Tel: {companyPhoneSetting}
                      </p>
                    </div>
                  </DraggableElement>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── LIVE WEB PDF PREVIEW MODAL ───────────────────────────────────────── */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">
                  Live Invoice PDF Preview — <span className="font-mono text-blue-300">{invoiceNumber}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdfDirect}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handlePreviewPdfInTab}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs px-3 py-1.5 rounded transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>New Tab</span>
                </button>
                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-0 overflow-hidden relative">
              <iframe
                src={`/api_pdf_doc.php?type=invoice&id=${encodeURIComponent(invoiceId || invoiceNumber)}&action=stream#toolbar=1`}
                className="w-full h-full border-none"
                title="Live Invoice PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK PAPER & MARGINS SETUP MODAL ──────────────────────────────── */}
      {isPaperSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-300 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm">Invoice Paper Size & Margin Setup</h3>
              </div>
              <button
                onClick={() => setIsPaperSetupModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Paper Size</label>
                  <select
                    value={modalPaperSize}
                    onChange={(e) => setModalPaperSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900 focus:outline-blue-500"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="Letter">Letter (8.5 x 11 in)</option>
                    <option value="Legal">Legal (8.5 x 14 in)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Base Font Size (pt)</label>
                  <input
                    type="number"
                    min="7"
                    max="14"
                    value={modalFontSize}
                    onChange={(e) => setModalFontSize(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold focus:outline-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Document Page Margins (mm)</label>
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 border border-slate-200 rounded">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Top</span>
                    <input
                      type="number"
                      value={modalMarginTop}
                      onChange={(e) => setModalMarginTop(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Bottom</span>
                    <input
                      type="number"
                      value={modalMarginBottom}
                      onChange={(e) => setModalMarginBottom(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Left</span>
                    <input
                      type="number"
                      value={modalMarginLeft}
                      onChange={(e) => setModalMarginLeft(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold mb-0.5">Right</span>
                    <input
                      type="number"
                      value={modalMarginRight}
                      onChange={(e) => setModalMarginRight(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-center font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Table Header Color</label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 border border-slate-200 rounded">
                  <input
                    type="color"
                    value={modalTableHeaderBg}
                    onChange={(e) => setModalTableHeaderBg(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-slate-900">{modalTableHeaderBg}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPaperSetupModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSavingPaperSetup(true);
                    const payload = {
                      ...(invoiceSettings || {}),
                      paper_size: modalPaperSize,
                      margin_top: modalMarginTop,
                      margin_bottom: modalMarginBottom,
                      margin_left: modalMarginLeft,
                      margin_right: modalMarginRight,
                      font_size: modalFontSize,
                      table_header_bg: modalTableHeaderBg,
                    };
                    fetch(getApiUrl('/api_invoice_settings.php'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    })
                      .then((res) => res.json())
                      .then((resData) => {
                        setIsSavingPaperSetup(false);
                        if (resData.status === 'success') {
                          setInvoiceSettings(payload);
                          memoizedInvoiceSettingsInv = payload;
                          setIsPaperSetupModalOpen(false);
                          setLayoutSaveNotice('Invoice Paper & Margin settings saved to database!');
                          setTimeout(() => setLayoutSaveNotice(null), 3000);
                        } else {
                          alert('Failed to save paper settings: ' + (resData.message || 'Error'));
                        }
                      })
                      .catch((err) => {
                        setIsSavingPaperSetup(false);
                        console.error('Error saving paper setup:', err);
                      });
                  }}
                  disabled={isSavingPaperSetup}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSavingPaperSetup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Setup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceBuilder;
