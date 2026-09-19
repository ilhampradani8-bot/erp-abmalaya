import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, InvoiceItem } from '../types/erp';
import { 
  Printer, Send, ArrowLeft, ChevronDown, FileText, Settings, Loader2, Save, CheckCircle2, Building2, Truck, Move, RotateCcw, Plus, Download, ExternalLink, Eye, SlidersHorizontal, X, MoreVertical
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

interface EmailOption {
  email: string;
  source?: string;
}

const parseClientEmail = (raw: any): { selected: string; options: EmailOption[] } => {
  if (!raw) return { selected: '', options: [] };

  if (typeof raw === 'object' && raw !== null) {
    const selected = raw.selected || raw.email || '';
    let optionsList: EmailOption[] = [];
    if (Array.isArray(raw.options)) {
      optionsList = raw.options.map((o: any) => ({
        email: typeof o === 'string' ? o : o.email || '',
        source: typeof o === 'object' ? o.source || 'Email Option' : 'Email Option',
      })).filter((o: EmailOption) => o.email);
    }
    if (selected && !optionsList.some((o) => o.email === selected)) {
      optionsList.unshift({ email: selected, source: 'Selected Email' });
    }
    return { selected, options: optionsList.length > 0 ? optionsList : (selected ? [{ email: selected, source: 'Primary Email' }] : []) };
  }

  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parseClientEmail(parsed);
      }
    } catch (e) {
      // Ignore JSON parse error
    }
  }

  const clean = typeof raw === 'string' ? raw.trim() : String(raw);
  return {
    selected: clean,
    options: clean ? [{ email: clean, source: 'Primary Email' }] : [],
  };
};

interface PageChunk {
  pageNumber: number;
  totalPages: number;
  items: InvoiceItem[];
  startIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
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
  const [isDocPreviewMode, setIsDocPreviewMode] = useState<boolean>(false);

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
  const initialEmailParsed = useMemo(() => parseClientEmail(initialInvoice?.client_email), [initialInvoice]);
  const [clientName, setClientName] = useState<string>(initialInvoice?.client_name || '');
  const [clientEmail, setClientEmail] = useState<string>(initialEmailParsed.selected);
  const [clientEmailOptions, setClientEmailOptions] = useState<EmailOption[]>(initialEmailParsed.options);
  const [isCustomEmailMode, setIsCustomEmailMode] = useState<boolean>(false);
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

  // Smart Pagination Algorithm (Fills A4 Sheets densely before moving to next page)
  const pageChunks: PageChunk[] = useMemo(() => {
    const totalItems = items.length;
    
    // Page 1 capacity: 6 items if single-page, 7 items if multi-page
    // Subsequent page capacity: 10 items if middle page, 8 items if last page with bank/signatures
    
    if (totalItems <= 6) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        items: items,
        startIndex: 0,
        isFirstPage: true,
        isLastPage: true,
      }];
    }

    const pages: PageChunk[] = [];
    const page1Count = Math.min(7, totalItems);
    pages.push({
      pageNumber: 1,
      totalPages: 0,
      items: items.slice(0, page1Count),
      startIndex: 0,
      isFirstPage: true,
      isLastPage: page1Count === totalItems,
    });

    let remaining = items.slice(page1Count);
    let currentIndex = page1Count;
    let pNum = 2;

    while (remaining.length > 0) {
      if (remaining.length <= 8) {
        pages.push({
          pageNumber: pNum,
          totalPages: 0,
          items: remaining,
          startIndex: currentIndex,
          isFirstPage: false,
          isLastPage: true,
        });
        break;
      } else {
        const chunk = remaining.slice(0, 10);
        remaining = remaining.slice(10);
        pages.push({
          pageNumber: pNum,
          totalPages: 0,
          items: chunk,
          startIndex: currentIndex,
          isFirstPage: false,
          isLastPage: remaining.length === 0,
        });
        currentIndex += chunk.length;
        pNum++;
      }
    }

    const total = pages.length;
    pages.forEach(p => p.totalPages = total);
    return pages;
  }, [items]);

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
    
    const invEmailParsed = parseClientEmail(inv.client_email);
    setClientEmail(invEmailParsed.selected);
    setClientEmailOptions(invEmailParsed.options);
    setIsCustomEmailMode(false);

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
    setClientEmailOptions([]);
    setIsCustomEmailMode(false);
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
    
    const quoEmailParsed = parseClientEmail(quo.client_email);
    setClientEmail(quoEmailParsed.selected);
    setClientEmailOptions(quoEmailParsed.options);
    setIsCustomEmailMode(false);

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
    const downloadUrl = `/api_pdf.php?type=invoice&id=${encodeURIComponent(targetId)}&action=download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${invoiceNumber || 'INV-ABM'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewPdfInTab = () => {
    const targetId = invoiceId || invoiceNumber;
    const previewUrl = `/api_pdf.php?type=invoice&id=${encodeURIComponent(targetId)}&action=stream`;
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
                  <span>Download Full PDF (Puppeteer Engine)</span>
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

        {/* RIGHT SECTION: Action Buttons & 3-Dots Options Dropdown */}
        <div className="flex items-center gap-2">
          
          {layoutSaveNotice && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{layoutSaveNotice}</span>
            </div>
          )}

          {/* INLINE DOC PREVIEW MODE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={() => setIsDocPreviewMode(!isDocPreviewMode)}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border ${
              isDocPreviewMode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-400'
                : 'bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-slate-800 border-[#a0a0a0] shadow-inner'
            }`}
            title="Toggle Read-Only Document Preview mode without input borders/boxes"
          >
            <Eye className={`w-3.5 h-3.5 ${isDocPreviewMode ? 'text-white' : 'text-emerald-600'}`} />
            <span>{isDocPreviewMode ? 'Exit Doc Preview' : 'Doc Preview (Read-Only)'}</span>
          </button>

          {/* PRIMARY QUICK CTA: SAVE INVOICE */}
          <button
            onClick={handleSaveInvoice}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white font-bold text-xs px-3.5 py-1 shadow-xs transition cursor-pointer rounded border border-sky-800 disabled:opacity-60"
            title="Save Invoice directly to MySQL database"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
            <span>{isSaving ? 'Saving...' : 'Save Invoice'}</span>
          </button>

          {/* 3-DOTS (...) OPTIONS DROPDOWN MENU */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLeftQuoDropdownOpen(!isLeftQuoDropdownOpen)}
              className="flex items-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-2.5 py-1 rounded shadow-inner cursor-pointer transition"
              title="More Actions & Options (...)"
            >
              <MoreVertical className="w-4 h-4 text-[#0099ec]" />
              <span>Actions (...)</span>
              <ChevronDown className="w-3 h-3 text-slate-600" />
            </button>

            {isLeftQuoDropdownOpen && (
              <div className="absolute right-0 top-8 w-64 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsDocPreviewMode(!isDocPreviewMode);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer text-left transition"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isDocPreviewMode ? 'Exit Doc Preview Mode' : 'Doc Preview Mode (Read-Only)'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleSaveInvoice();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-800 hover:bg-blue-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span>Save Invoice to MySQL</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsPdfModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-indigo-800 hover:bg-indigo-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PDF Preview (Live Modal)</span>
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
                    handlePrint();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-slate-100 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Print Invoice (Direct)</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleSaveLayout();
                  }}
                  disabled={isSavingLayout}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sky-800 hover:bg-sky-50 font-bold cursor-pointer text-left border-t border-slate-100 transition disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5 text-sky-600" />
                  <span>{isSavingLayout ? 'Saving Layout...' : 'Save Layout Positions'}</span>
                </button>

                {Object.keys(offsets).length > 0 && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      handleResetLayout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reset Layout Positions</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsDragMode(!isDragMode);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-800 hover:bg-blue-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Move className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isDragMode ? 'Exit Drag Mode' : 'Toggle Drag & Move'}</span>
                </button>

                {onBack && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      onBack();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                    <span>Back</span>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* DOC PREVIEW MODE ACTIVE BANNER NOTICE */}
      {isDocPreviewMode && (
        <div className="no-print bg-emerald-800 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 sticky top-[49px] z-30 animate-in fade-in">
          <Eye className="w-4 h-4 text-emerald-300 animate-pulse" />
          <span>DOC PREVIEW MODE (Read-Only): Viewing clean document version without edit input boxes.</span>
          <button
            onClick={() => setIsDocPreviewMode(false)}
            className="ml-3 bg-white text-emerald-900 px-2.5 py-0.5 rounded text-[11px] font-black uppercase hover:bg-emerald-50 transition"
          >
            Edit Form Fields
          </button>
        </div>
      )}

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

      {/* ── EXACT A4 PRINT & PAPER SHEET STYLES ── */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          *, *::before, *::after {
            overflow: visible !important;
          }
          html, body, #root, #root > div, main {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            position: static !important;
            overflow: visible !important;
            display: block !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #invoice-screen-container, #invoice-paper-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
          }
          .a4-page-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 6mm 6mm !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .a4-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }

        /* ITEMS TABLE STYLING */
        .items-table-box {
          border: 1px solid #0f172a;
          margin-bottom: 6px;
          background: #ffffff;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .items-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 7.5pt;
          box-sizing: border-box;
        }
        .items-table th {
          background-color: ${tableHeaderBg};
          color: ${tableHeaderTextColor};
          font-weight: 800;
          font-size: 7.5pt;
          text-transform: uppercase;
          padding: 4px 3px;
          border-right: 1px solid #0f172a;
          border-bottom: 1px solid #0f172a;
          text-align: left;
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .items-table th:last-child {
          border-right: none;
        }
        .items-table td {
          padding: 3px 4px;
          border-right: 1px solid #0f172a;
          border-bottom: 1px solid #0f172a;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
          font-size: 7.5pt;
        }
        .items-table td:last-child {
          border-right: none;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .items-table tr:nth-child(even) td {
          background-color: #f8fafc;
        }
        .product-photo-full {
          width: 100% !important;
          max-height: 100px !important;
          object-fit: contain !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 2px !important;
          background-color: #ffffff !important;
          padding: 2px !important;
          margin-top: 3px !important;
          display: block !important;
        }
      `}</style>

      {/* OFFICIAL INVOICE PAPER SHEETS CONTAINER */}
      <div id="invoice-paper-wrapper" className="p-4 sm:p-8 w-full max-w-full flex flex-col items-center justify-start space-y-8 overflow-x-auto">
        {pageChunks.map((chunk) => (
          <div key={`sheet-${chunk.pageNumber}`} className="flex flex-col items-center">
            
            {/* Sheet Page Label on Screen */}
            <div className="no-print mb-2 flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 w-[210mm] max-w-[210mm] px-2 bg-slate-200 py-1 rounded shadow-xs">
              <span className="flex items-center gap-1.5 text-slate-800">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>A4 SHEET (PAGE {chunk.pageNumber} OF {chunk.totalPages})</span>
              </span>
              <span className="text-slate-500 text-[10px]">
                {chunk.isFirstPage && chunk.isLastPage ? 'Single Page' : chunk.isFirstPage ? 'Opening Page' : chunk.isLastPage ? 'Closing & Signatures' : 'Continuation Page'} • Margin: {modalMarginLeft}mm
              </span>
            </div>

            {/* Exact A4 Sheet Container (210mm x 297mm) */}
            <div
              className="a4-page-sheet bg-white text-slate-900 font-sans border border-slate-400 shadow-2xl rounded-none relative flex flex-col justify-between"
              style={{
                width: '210mm',
                minWidth: '210mm',
                maxWidth: '210mm',
                height: '297mm',
                minHeight: '297mm',
                maxHeight: '297mm',
                boxSizing: 'border-box',
                paddingTop: `${modalMarginTop}mm`,
                paddingBottom: `${modalMarginBottom}mm`,
                paddingLeft: `${modalMarginLeft}mm`,
                paddingRight: `${modalMarginRight}mm`,
                fontSize: `${modalFontSize}pt`,
                overflow: 'hidden',
              }}
            >
              {/* TOP HEADER BLOCK (Synchronized across all sheets) */}
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%', borderBottom: '2px solid #004f8b', paddingBottom: '3px', marginBottom: '4px', background: '#ffffff' }}>
                  {headerImageUrl ? (
                    <div style={{ width: '100%', marginBottom: '4px', marginTop: '-2px' }}>
                      <img
                        src={headerImageUrl}
                        alt="Header Banner"
                        style={{ width: '100%', height: 'auto', maxHeight: '90px', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '4px', background: 'linear-gradient(to right, #004f8b, #0070c0, #0080d0)', marginBottom: '3px' }}></div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', margin: 0, padding: 0 }}>
                    <tbody>
                      <tr>
                        {/* Logo Left */}
                        <td style={{ width: '55%', verticalAlign: 'bottom', textAlign: 'left', padding: 0, border: 'none' }}>
                          <DraggableElement id="invoice_logo" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Logo" resizable={true}>
                            {isLoadingInvoiceSettings ? (
                              <div className="h-10 w-28 bg-white/90 border border-slate-300 flex items-center justify-center gap-2 text-xs text-blue-700 font-mono font-bold animate-pulse">
                                <Loader2 className="w-3 animate-spin text-blue-600" />
                                <span>Loading...</span>
                              </div>
                            ) : logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={companyNameSetting}
                                style={{ height: '44px', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/favicon.png';
                                }}
                              />
                            ) : (
                              <div>
                                <div style={{ fontWeight: 900, fontSize: '15pt', color: '#004f8b', textTransform: 'uppercase' }}>
                                  {companyNameSetting}
                                </div>
                                <span className="text-[10px] font-bold text-[#0070c0] font-mono block">({companyRegNoSetting})</span>
                              </div>
                            )}
                          </DraggableElement>
                        </td>

                        {/* Company Address Right */}
                        <td style={{ width: '45%', verticalAlign: 'bottom', textAlign: 'right', padding: 0, border: 'none', fontSize: '7.5pt', lineHeight: 1.25, color: '#1e293b' }}>
                          <DraggableElement id="invoice_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Company Address">
                            <div className="text-right text-xs text-slate-800 leading-snug font-sans shrink-0 font-medium">
                              <p className="font-bold text-slate-900 text-xs">{companyNameSetting}</p>
                              <p className="max-w-xs ml-auto">{companyAddressSetting}</p>
                              <p className="font-semibold text-slate-900 font-mono">{companyPhoneSetting} | {companyEmailSetting}</p>
                            </div>
                          </DraggableElement>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* METADATA & TITLE STRIP BANNER (Page 1 Only) */}
                {chunk.isFirstPage && (
                  <>
                    <DraggableElement id="invoice_title" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Title Banner">
                      <div 
                        className="font-black text-center py-1.5 uppercase tracking-widest text-xs rounded-none mb-3"
                        style={{ backgroundColor: tableHeaderBg, color: tableHeaderTextColor }}
                      >
                        {invoiceTitleSetting}
                      </div>
                    </DraggableElement>

                    {/* 2-COLUMN ADDRESS LAYOUT & METADATA SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs text-slate-800 border-b border-slate-300 pb-3 mb-3">
                      
                      {/* LEFT COLUMN: TO / BILLING ADDRESS */}
                      <DraggableElement id="invoice_to_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="TO Address Box" className="md:col-span-6">
                        <div className="space-y-1.5 bg-slate-50/70 p-2.5 border border-slate-300">
                          <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wide text-[10px] border-b border-slate-300 pb-0.5">
                            <Building2 className="w-3 h-3 text-[#0070c0]" />
                            <span>TO (BILLING ADDRESS):</span>
                          </div>
                          {isDocPreviewMode ? (
                            <div className="space-y-1 font-sans text-slate-900 min-h-[78px] text-[11px]">
                              <p className="font-extrabold text-xs text-slate-900 uppercase leading-snug">{companyName || '—'}</p>
                              <p className="text-[11px] text-slate-700 leading-normal whitespace-pre-line font-medium">{billingAddress || '—'}</p>
                              {(clientName || clientEmail) && (
                                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200 mt-1 text-[10.5px]">
                                  {clientName && <p><span className="font-bold text-slate-500 text-[9px] uppercase block">Attention:</span> <span className="font-semibold text-slate-900">{clientName}</span></p>}
                                  {clientEmail && <p><span className="font-bold text-slate-500 text-[9px] uppercase block">Email:</span> <span className="font-mono text-slate-800">{clientEmail}</span></p>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1 font-sans">
                              <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Client Company Name"
                                className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-bold text-slate-900 rounded-none text-[11px] focus:outline-none"
                              />
                              <textarea
                                rows={2}
                                value={billingAddress}
                                onChange={(e) => setBillingAddress(e.target.value)}
                                placeholder="Billing Street Address & Location"
                                className="w-full bg-white border border-slate-300 px-1.5 py-0.5 text-slate-700 rounded-none text-[11px] focus:outline-none"
                              />
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-500 block uppercase">Attention:</span>
                                  <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="Contact Person"
                                    className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-900 rounded-none text-[10px]"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Email:</span>
                                    {clientEmailOptions.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setIsCustomEmailMode(!isCustomEmailMode)}
                                        className="text-[8.5px] text-blue-600 hover:text-blue-800 font-bold underline transition cursor-pointer"
                                        title="Toggle between email dropdown list and custom text input"
                                      >
                                        {isCustomEmailMode ? 'Select Dropdown' : '+ Custom Email'}
                                      </button>
                                    )}
                                  </div>
                                  {!isCustomEmailMode && clientEmailOptions.length > 0 ? (
                                    <select
                                      value={clientEmail}
                                      onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                          setIsCustomEmailMode(true);
                                        } else {
                                          setClientEmail(e.target.value);
                                        }
                                      }}
                                      className="w-full bg-white border border-slate-300 px-1 py-0.5 font-mono text-slate-800 rounded-none text-[10px] focus:outline-none cursor-pointer font-semibold"
                                    >
                                      {clientEmailOptions.map((opt, idx) => (
                                        <option key={idx} value={opt.email}>
                                          {opt.email} {opt.source ? `(${opt.source})` : ''}
                                        </option>
                                      ))}
                                      {clientEmail && !clientEmailOptions.some((o) => o.email === clientEmail) && (
                                        <option value={clientEmail}>{clientEmail}</option>
                                      )}
                                      <option value="__custom__">+ Enter Custom Email...</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={clientEmail}
                                      onChange={(e) => setClientEmail(e.target.value)}
                                      placeholder="client@company.com"
                                      className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-mono text-slate-800 rounded-none text-[10px]"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DraggableElement>

                      {/* RIGHT COLUMN: DELIVERY / SHIPPING ADDRESS */}
                      <DraggableElement id="invoice_del_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="DELIVERY Address Box" className="md:col-span-6">
                        <div className="space-y-1.5 bg-slate-50/70 p-2.5 border border-slate-300">
                          <div className="flex items-center gap-1.5 font-black text-slate-900 uppercase tracking-wide text-[10px] border-b border-slate-300 pb-0.5">
                            <Truck className="w-3 h-3 text-[#0070c0]" />
                            <span>DELIVERY (SHIPPING ADDRESS):</span>
                          </div>
                          {isDocPreviewMode ? (
                            <div className="space-y-1 font-sans text-slate-900 min-h-[78px] text-[11px]">
                              <p className="font-extrabold text-xs text-slate-900 uppercase leading-snug">{deliveryCompany || companyName || '—'}</p>
                              <p className="text-[11px] text-slate-700 leading-normal whitespace-pre-line font-medium">{deliveryAddress || billingAddress || '—'}</p>
                              {(deliveryPic || deliveryPhone) && (
                                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200 mt-1 text-[10.5px]">
                                  {deliveryPic && <p><span className="font-bold text-slate-500 text-[9px] uppercase block">Delivery PIC:</span> <span className="font-semibold text-slate-900">{deliveryPic}</span></p>}
                                  {deliveryPhone && <p><span className="font-bold text-slate-500 text-[9px] uppercase block">Contact No:</span> <span className="font-mono text-slate-800">{deliveryPhone}</span></p>}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1 font-sans">
                              <input
                                type="text"
                                value={deliveryCompany}
                                onChange={(e) => setDeliveryCompany(e.target.value)}
                                placeholder="Delivery Ship / Project Name"
                                className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-bold text-slate-900 rounded-none text-[11px] focus:outline-none"
                              />
                              <textarea
                                rows={2}
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                placeholder="Delivery Destination / Yard Address"
                                className="w-full bg-white border border-slate-300 px-1.5 py-0.5 text-slate-700 rounded-none text-[11px] focus:outline-none"
                              />
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-500 block uppercase">Delivery PIC:</span>
                                  <input
                                    type="text"
                                    value={deliveryPic}
                                    onChange={(e) => setDeliveryPic(e.target.value)}
                                    placeholder="Delivery Contact Person"
                                    className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-900 rounded-none text-[10px]"
                                  />
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-500 block uppercase">Contact No:</span>
                                  <input
                                    type="text"
                                    value={deliveryPhone}
                                    onChange={(e) => setDeliveryPhone(e.target.value)}
                                    placeholder="+6012-3456789"
                                    className="w-full bg-white border border-slate-300 px-1.5 py-0.5 font-mono text-slate-800 rounded-none text-[10px]"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DraggableElement>

                      {/* INVOICE METADATA ROW */}
                      <DraggableElement id="invoice_meta" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Invoice Numbers & Date" className="md:col-span-12">
                        {isDocPreviewMode ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/90 p-2 border border-slate-300 font-mono text-xs">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">Invoice No. :</span>
                              <span className="font-extrabold text-slate-900 text-xs block py-0.5">{invoiceNumber || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">Invoice Date :</span>
                              <span className="font-bold text-slate-900 text-xs block py-0.5">{invoiceDate || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">PO Numb (Client PO) :</span>
                              <span className="font-black text-blue-900 text-xs block py-0.5">{poNumber || '—'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-2 border border-slate-300 font-mono">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">Invoice No. :</span>
                              <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 px-1.5 py-0.5 font-extrabold text-slate-900 text-xs"
                              />
                            </div>

                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">Invoice Date :</span>
                              <input
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 px-1.5 py-0.5 font-bold text-slate-900 text-xs"
                              />
                            </div>

                            <div>
                              <span className="text-[9px] font-bold text-slate-500 block uppercase">PO Numb (Client PO) :</span>
                              <input
                                type="text"
                                value={poNumber}
                                onChange={(e) => setPoNumber(e.target.value)}
                                placeholder="e.g. DM/AGA/ABMI/PO/279/24"
                                className="w-full bg-blue-50 border border-blue-300 px-1.5 py-0.5 font-black text-blue-900 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </DraggableElement>

                    </div>
                  </>
                )}

                {/* LINE ITEMS TABLE (Per Sheet Chunk) */}
                <DraggableElement id="invoice_table" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Invoice Items Table">
                  <div className="items-table-box">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '4%', textAlign: 'center' }}>NO.</th>
                          <th style={{ width: '38%' }}>ITEM</th>
                          <th style={{ width: '6%', textAlign: 'center' }}>QTY</th>
                          <th style={{ width: '7%', textAlign: 'center' }}>UNIT</th>
                          <th style={{ width: '20%' }}>OFFERED ITEM</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>UNIT PRICE (MYR)</th>
                          <th style={{ width: '13%', textAlign: 'right' }}>TOTAL PRICE (MYR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-400 italic font-medium">
                              No items listed. Please select a completed Quotation above to populate items.
                            </td>
                          </tr>
                        ) : (
                          chunk.items.map((item: any, localIdx: number) => {
                            const globalIdx = chunk.startIndex + localIdx;
                            return (
                              <tr key={globalIdx}>
                                <td style={{ textAlign: 'center' }} className="font-mono">{globalIdx + 1}</td>

                                {/* ITEM Column */}
                                <td style={{ color: '#0f172a', verticalAlign: 'top' }}>
                                  <p className="font-bold text-slate-900 text-xs leading-tight mb-0.5">{item.description}</p>
                                  {item.specification && (
                                    <p className="text-[10px] text-slate-600 leading-snug font-sans mb-1">{item.specification}</p>
                                  )}
                                  {item.product_code && (
                                    <span className="inline-block font-mono text-[9px] text-purple-900 font-bold bg-purple-50 px-1 rounded border border-purple-200 mb-1">
                                      Code: {item.product_code}
                                    </span>
                                  )}
                                  {item.image_url ? (
                                    <div className="w-full mt-1">
                                      <DraggableElement id={`inv_photo_${globalIdx}`} isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label={`Photo #${globalIdx + 1}`}>
                                        <img
                                          src={item.image_url}
                                          alt={item.description}
                                          className="product-photo-full"
                                        />
                                      </DraggableElement>
                                    </div>
                                  ) : null}
                                </td>

                                {/* QTY */}
                                <td style={{ textAlign: 'center' }} className="font-mono">{item.quantity}</td>

                                {/* UNIT */}
                                <td style={{ textAlign: 'center' }}>{item.unit || 'Unit'}</td>

                                {/* OFFERED ITEM */}
                                <td style={{ color: '#0f172a', verticalAlign: 'top' }}>{item.offer || item.offered_item || '—'}</td>

                                {/* UNIT PRICE (MYR) */}
                                <td style={{ textAlign: 'right' }} className="font-mono">{formatCurrency(item.unit_price)}</td>

                                {/* TOTAL PRICE (MYR) */}
                                <td style={{ textAlign: 'right' }} className="font-mono font-bold">{formatCurrency(item.total)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </DraggableElement>

                {/* CLOSING BLOCK (Last Sheet Only) — Directly follows table in natural flow */}
                {chunk.isLastPage && (
                  <div style={{ width: '100%', paddingTop: '8px' }}>
                    {/* REMARKS / BANK PAYMENT INSTRUCTIONS & FINANCIAL TOTALS */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-1 w-full mb-4">
                      
                      {/* BANK PAYMENT INSTRUCTIONS (REMARKS BOX) */}
                      <DraggableElement id="invoice_bank_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Bank Payment Box" className="w-full md:w-1/2">
                        <div className="space-y-1 text-[11px] bg-slate-50 p-3 border border-slate-300">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-wide block border-b border-slate-300 pb-0.5">
                            Remarks & Bank Payment Instructions:
                          </span>
                          <div className="text-slate-800 leading-relaxed font-sans pt-0.5 space-y-1 text-[10.5px] whitespace-pre-line">
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
                                <p className="text-[10px] text-slate-500 font-semibold pt-0.5">
                                  Kindly contact us should you have further enquiries.
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </DraggableElement>

                      {/* FINANCIAL TOTALS BOX */}
                      <DraggableElement id="invoice_summary" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Financial Summary" className="w-full md:w-72">
                        <div className="border-2 border-slate-900 rounded-none p-3 space-y-1.5 text-xs bg-white">
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

                          <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between items-center text-slate-900 font-black text-sm">
                            <span>PRICE TOTAL (RM):</span>
                            <span className="font-mono text-[#0070c0]">{formatCurrency(grandTotal || subtotal)}</span>
                          </div>
                        </div>
                      </DraggableElement>

                    </div>

                    {/* DUAL AUTHORIZATION SIGNATURE BLOCK (AUTHORISED BY & RECEIVED BY) */}
                    <div className="flex flex-col sm:flex-row justify-between items-end pt-4 border-t border-slate-300 text-xs w-full gap-6">
                      {/* AUTHORISED BY (ISSUER SIGNATORY) */}
                      <DraggableElement id="invoice_sig_auth" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Authorised By Signatory">
                        <div className="space-y-0.5 text-left">
                          <p className="text-slate-700 font-bold uppercase tracking-wide text-[10px]">Authorised by,</p>
                          
                          <div className="h-14 flex items-center justify-start my-0.5 gap-2">
                            {signatureUrl && (
                              <img
                                src={signatureUrl}
                                alt="Digital Signature"
                                className="h-14 object-contain max-w-[120px] pointer-events-none"
                              />
                            )}
                            {stampUrl && (
                              <img
                                src={stampUrl}
                                alt="Company Stamp"
                                className="h-14 object-contain max-w-[120px] pointer-events-none"
                              />
                            )}
                            {!signatureUrl && !stampUrl && (
                              <div className="w-32 h-10 border-2 border-[#0070c0] border-dashed flex items-center justify-center text-[#0070c0] text-[9px] font-black uppercase tracking-wider transform -rotate-2">
                                [STAMP]
                              </div>
                            )}
                          </div>

                          <p className="font-bold text-slate-900 text-xs"><u>{authSignatoryName}</u></p>
                          <p className="text-slate-600 font-mono text-[10px]">{authSignatoryTitle}</p>
                        </div>
                      </DraggableElement>

                      {/* RECEIVED BY (CLIENT RECEIVER SIGNATURE LINE) */}
                      <DraggableElement id="invoice_sig_recv" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Received By Line">
                        <div className="text-left sm:text-right space-y-0.5">
                          <p className="text-slate-700 font-bold uppercase tracking-wide text-[10px]">{receivedByLabel}</p>
                          
                          <div className="h-12 border-b-2 border-slate-900 w-48 my-0.5 ml-auto"></div>

                          <p className="font-bold text-slate-900 text-[10px]">Name / Designation: ______________________</p>
                          <p className="text-slate-500 font-mono text-[10px]">Date: ____ / ____ / ________</p>
                        </div>
                      </DraggableElement>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM FOOTER (Repeats on every sheet at bottom) */}
              <DraggableElement id="invoice_footer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Footer" className="mt-auto w-full">
                <footer style={{ borderTop: '1px solid #cbd5e1', paddingTop: '4px', marginTop: '4px', textAlign: 'center', fontSize: '7pt', color: '#64748b', background: '#ffffff', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1px', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ textAlign: 'left', width: '70%', verticalAlign: 'middle', padding: 0, border: 'none' }}>
                          {logoUrl && (
                            <img
                              src={logoUrl}
                              alt="Logo"
                              style={{ height: '14px', maxHeight: '14px', verticalAlign: 'middle', marginRight: '4px', display: 'inline-block' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/favicon.png';
                              }}
                            />
                          )}
                          <span style={{ fontWeight: 700, color: '#004f8b', textTransform: 'uppercase', verticalAlign: 'middle' }}>
                            {companyNameSetting}
                          </span>
                          <span style={{ marginLeft: '6px', fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                            ({companyEmailSetting}, {companyPhoneSetting})
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', width: '30%', verticalAlign: 'middle', padding: 0, border: 'none', fontWeight: 700, color: '#475569' }}>
                          Page {chunk.pageNumber} of {chunk.totalPages}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </footer>
              </DraggableElement>

            </div>
          </div>
        ))}
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
                src={`/api_pdf.php?type=invoice&id=${encodeURIComponent(invoiceId || invoiceNumber)}&action=stream#toolbar=1`}
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
