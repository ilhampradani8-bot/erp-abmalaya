import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, QuotationItem } from '../types/erp';
import { 
  Printer, Send, ArrowLeft, Package, ChevronDown, Settings, Loader2, 
  Move, Save, CheckCircle2, Edit3, Plus, Trash2, X, SlidersHorizontal, MoreVertical, FileType
} from 'lucide-react';

interface QuotationDocProps {
  quotation: Quotation;
  onBack?: () => void;
  onBackToBuilder?: () => void;
  onSendEmail?: () => void;
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
let memoizedPaperSettingsDoc: any = null;
let memoizedSavedQuotationsDoc: Quotation[] = [];
let memoizedProductsCatalogDoc: any[] = [];

export const QuotationDoc: React.FC<QuotationDocProps> = ({
  quotation: initialQuotation,
  onBack,
  onBackToBuilder,
  onSendEmail,
  onNavigateView,
  paperSettings: propPaperSettings,
}) => {
  const [quotation, setQuotation] = useState<Quotation>(initialQuotation || {});
  const [paperSettings, setPaperSettings] = useState<any>(propPaperSettings || memoizedPaperSettingsDoc || null);
  const [isLoadingPaperSettings, setIsLoadingPaperSettings] = useState<boolean>(!propPaperSettings && !memoizedPaperSettingsDoc);
  const [productsCatalog, setProductsCatalog] = useState<any[]>(memoizedProductsCatalogDoc);
  const [savedQuotations, setSavedQuotations] = useState<Quotation[]>(memoizedSavedQuotationsDoc);
  const [selectedQuoId, setSelectedQuoId] = useState<string>(initialQuotation?.id || '');
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(memoizedSavedQuotationsDoc.length === 0);
  const [isLeftQuoDropdownOpen, setIsLeftQuoDropdownOpen] = useState<boolean>(false);

  // Drag Mode & Element Offsets State
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [layoutSaveNotice, setLayoutSaveNotice] = useState<string | null>(null);

  // Quick Paper Setup Modal State
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

  // Inline Document Editing State
  const [isEditDocMode, setIsEditDocMode] = useState<boolean>(false);
  const [isSavingQuotation, setIsSavingQuotation] = useState<boolean>(false);
  const [quotationSaveNotice, setQuotationSaveNotice] = useState<string | null>(null);

  // Editable Form Fields State
  const [docRefNo, setDocRefNo] = useState<string>('');
  const [docDateIssued, setDocDateIssued] = useState<string>('');
  const [docValidUntil, setDocValidUntil] = useState<string>('14 Days');
  const [docProjectReference, setDocProjectReference] = useState<string>('');
  const [docClientName, setDocClientName] = useState<string>('');
  const [docCompanyName, setDocCompanyName] = useState<string>('');
  const [docClientPhone, setDocClientPhone] = useState<string>('');
  const [docClientEmail, setDocClientEmail] = useState<string>('');
  const [docNotes, setDocNotes] = useState<string>('');
  const [docCreatedBy, setDocCreatedBy] = useState<string>('');
  const [docTaxPercent, setDocTaxPercent] = useState<number>(11);
  const [docItems, setDocItems] = useState<QuotationItem[]>([]);

  // Initialize paper modal fields when paperSettings is loaded
  useEffect(() => {
    if (!paperSettings) return;
    setModalPaperSize(paperSettings.paper_size || paperSettings.paperSize || 'A4');
    setModalMarginTop(Number(paperSettings.margin_top || paperSettings.marginTop) || 18);
    setModalMarginBottom(Number(paperSettings.margin_bottom || paperSettings.marginBottom) || 18);
    setModalMarginLeft(Number(paperSettings.margin_left || paperSettings.marginLeft) || 14);
    setModalMarginRight(Number(paperSettings.margin_right || paperSettings.marginRight) || 14);
    setModalFontSize(Number(paperSettings.font_size || paperSettings.fontSize) || 9);
    setModalTableHeaderBg(paperSettings.table_header_bg || paperSettings.tableHeaderBg || '#0070c0');
  }, [paperSettings]);

  // Initialize editable fields whenever `quotation` changes
  useEffect(() => {
    if (!quotation) return;
    
    setDocRefNo(quotation.quotation_number || (quotation as any).ref_number || (quotation.id ? `ABM/QUO/${quotation.id}` : 'ABM/QUO/2026-001'));
    setDocDateIssued(quotation.date_issued || (quotation as any).created_at?.split(' ')[0] || new Date().toISOString().split('T')[0]);
    setDocValidUntil(quotation.valid_until || '14 Days');
    setDocProjectReference((quotation as any).project_reference || quotation.notes || (quotation as any).category_name || 'INDUSTRIAL & MARITIME EQUIPMENT SUPPLY');
    setDocClientName(quotation.client_name || (quotation as any).contact_person || 'Valued Client');
    setDocCompanyName(quotation.company_name || (quotation as any).client_company || '');
    setDocClientPhone(quotation.client_phone || (quotation as any).phone || '');
    
    let emailStr = '';
    if (typeof quotation.client_email === 'string') {
      if (quotation.client_email.startsWith('{') || quotation.client_email.startsWith('[')) {
        try {
          const parsed = JSON.parse(quotation.client_email);
          emailStr = parsed.selected || parsed[0]?.email || quotation.client_email;
        } catch {
          emailStr = quotation.client_email;
        }
      } else {
        emailStr = quotation.client_email;
      }
    }
    setDocClientEmail(emailStr || (quotation as any).email || 'client@company.com');
    setDocNotes(quotation.notes || paperSettings?.default_notes || paperSettings?.footer_terms || '1. Prices stated in Malaysian Ringgit (MYR) and valid for 14 days.\n2. Goods remain property of AB Malaya Sdn. Bhd. until fully paid.\n3. Standard 1-year official manufacturer warranty applicable.');
    setDocCreatedBy(quotation.created_by || 'Muhammad Aimanuddin Bin Mohd Zaki');
    setDocTaxPercent(Number(quotation.tax_percent) || 11);

    const raw = quotation.items && quotation.items.length > 0
      ? quotation.items
      : quotation.items_details && quotation.items_details.length > 0
      ? quotation.items_details
      : [];

    if (raw.length > 0) {
      setDocItems(raw.map((item, idx) => ({
        ...item,
        id: item.id || `item-${idx + 1}`,
        quantity: Number(item.quantity) || Number(item.qty) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount_percent: Number(item.discount_percent) || 0,
        total: Number(item.total) || ((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)),
      })));
    } else {
      setDocItems([
        {
          id: 'item-1',
          product_code: 'ABM-EQ-01',
          impa_code: '—',
          description: quotation.notes || 'Industrial Equipment & Services Specification',
          specification: 'Standard Manufacturer Specification',
          quantity: 1,
          unit: 'Package',
          unit_price: quotation.grand_total || 1500,
          discount_percent: 0,
          total: quotation.grand_total || 1500,
        }
      ]);
    }
  }, [quotation, paperSettings]);

  // Real-time calculation of financial summaries
  const financialTotals = useMemo(() => {
    let grossSubtotal = 0;
    let discountTotal = 0;

    docItems.forEach((it) => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.unit_price) || 0;
      const d = Number(it.discount_percent) || 0;
      const base = q * p;
      const disc = base * (d / 100);
      grossSubtotal += base;
      discountTotal += disc;
    });

    const netBeforeTax = grossSubtotal - discountTotal;
    const taxAmt = netBeforeTax * (docTaxPercent / 100);
    const grand = netBeforeTax + taxAmt;

    return {
      subtotal: grossSubtotal,
      discountTotal: discountTotal,
      taxAmount: taxAmt,
      grandTotal: grand,
    };
  }, [docItems, docTaxPercent]);

  const handleItemFieldChange = (index: number, field: keyof QuotationItem | string, value: any) => {
    setDocItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };
      
      const qty = Number(target.quantity) || 0;
      const price = Number(target.unit_price) || 0;
      const disc = Number(target.discount_percent) || 0;
      target.total = qty * price * (1 - disc / 100);

      updated[index] = target;
      return updated;
    });
  };

  const handleAddItemRow = () => {
    const newItem: QuotationItem = {
      id: `item-${Date.now()}`,
      product_code: '',
      impa_code: '',
      description: 'New Supply Item / Service',
      specification: 'Standard industrial grade',
      quantity: 1,
      unit: 'Unit',
      unit_price: 0,
      discount_percent: 0,
      total: 0,
    };
    setDocItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItemRow = (index: number) => {
    if (docItems.length <= 1) {
      alert('Quotation must have at least one line item.');
      return;
    }
    setDocItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save Quotation Edits back to MySQL Database
  const handleSaveQuotation = () => {
    setIsSavingQuotation(true);
    const payload = {
      id: quotation.id || `QUO-${Date.now()}`,
      quotation_number: docRefNo,
      client_name: docClientName,
      company_name: docCompanyName,
      client_phone: docClientPhone,
      client_email: docClientEmail,
      date_issued: docDateIssued,
      valid_until: docValidUntil,
      project_reference: docProjectReference,
      subtotal: financialTotals.subtotal,
      discount_total: financialTotals.discountTotal,
      tax_percent: docTaxPercent,
      tax_amount: financialTotals.taxAmount,
      grand_total: financialTotals.grandTotal,
      notes: docNotes,
      created_by: docCreatedBy,
      items: docItems,
    };

    fetch('/api_quotations.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingQuotation(false);
        if (resData.status === 'success') {
          setQuotationSaveNotice(`Quotation ${docRefNo} saved successfully to MySQL database!`);
          const updatedQuotation: Quotation = {
            ...quotation,
            ...payload,
            status: quotation.status || 'draft',
          };
          setQuotation(updatedQuotation);
          
          // Update in-memory cached quotations list
          setSavedQuotations((prev) => {
            const next = prev.map((q) => q.id === quotation.id ? updatedQuotation : q);
            memoizedSavedQuotationsDoc = next;
            return next;
          });

          setTimeout(() => setQuotationSaveNotice(null), 4000);
        } else {
          alert('Failed to save quotation: ' + (resData.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSavingQuotation(false);
        console.error('Save quotation error:', err);
        alert('Save quotation error: ' + err.message);
      });
  };

  // Save Quick Paper Setup Modal settings to MySQL
  const handleSaveQuickPaperSetup = () => {
    setIsSavingPaperSetup(true);
    const payload = {
      ...(paperSettings || {}),
      paper_size: modalPaperSize,
      margin_top: modalMarginTop,
      margin_bottom: modalMarginBottom,
      margin_left: modalMarginLeft,
      margin_right: modalMarginRight,
      font_size: modalFontSize,
      table_header_bg: modalTableHeaderBg,
    };

    fetch('/api_paper_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        setIsSavingPaperSetup(false);
        if (resData.status === 'success') {
          setPaperSettings(payload);
          memoizedPaperSettingsDoc = payload;
          setIsPaperSetupModalOpen(false);
          setLayoutSaveNotice('Paper & Margin settings saved to database!');
          setTimeout(() => setLayoutSaveNotice(null), 3000);
        } else {
          alert('Failed to save paper settings: ' + (resData.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSavingPaperSetup(false);
        console.error('Error saving paper setup:', err);
        alert('Error saving paper setup: ' + err.message);
      });
  };

  // Layout drag & drop saving
  const handleOffsetChange = (id: string, newOffset: { x: number; y: number }) => {
    setOffsets((prev) => ({ ...prev, [id]: newOffset }));
  };

  const handleSaveLayout = (targetOffsets?: Record<string, { x: number; y: number }>) => {
    const toSave = targetOffsets !== undefined ? targetOffsets : offsets;
    setIsSavingLayout(true);
    fetch('/api_paper_settings.php', {
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
          const updatedSettings = { ...(paperSettings || {}), layout_offsets: toSave };
          setPaperSettings(updatedSettings);
          memoizedPaperSettingsDoc = updatedSettings;
          setLayoutSaveNotice('Layout positions saved permanently!');
          setTimeout(() => setLayoutSaveNotice(null), 3000);
        }
      })
      .catch((err) => {
        setIsSavingLayout(false);
        console.error('Error saving layout offsets:', err);
      });
  };

  const handleResetLayout = () => {
    setOffsets({});
    handleSaveLayout({});
  };

  // Auto-load saved layout offsets from system_paper_settings database
  useEffect(() => {
    if (paperSettings && paperSettings.layout_offsets) {
      try {
        const parsed = typeof paperSettings.layout_offsets === 'string'
          ? JSON.parse(paperSettings.layout_offsets)
          : paperSettings.layout_offsets;
        if (parsed && typeof parsed === 'object') {
          setOffsets(parsed);
        }
      } catch (err) {
        console.error('Error parsing layout_offsets:', err);
      }
    }
  }, [paperSettings]);

  // Sync quotation state if prop changes
  useEffect(() => {
    if (initialQuotation) {
      setQuotation(initialQuotation);
      if (initialQuotation.id) setSelectedQuoId(initialQuotation.id);
    }
  }, [initialQuotation]);

  // Fetch paper settings if not provided via props (with instant cache load)
  useEffect(() => {
    if (!paperSettings) {
      if (!memoizedPaperSettingsDoc) setIsLoadingPaperSettings(true);
      fetch('/api_paper_settings.php')
        .then((res) => res.json())
        .then((data) => {
          setIsLoadingPaperSettings(false);
          if (data.status === 'success' && data.data) {
            memoizedPaperSettingsDoc = data.data;
            setPaperSettings(data.data);
          }
        })
        .catch((err) => {
          setIsLoadingPaperSettings(false);
          console.error('Error fetching paper settings in QuotationDoc:', err);
        });
    } else {
      memoizedPaperSettingsDoc = paperSettings;
      setIsLoadingPaperSettings(false);
    }
  }, [paperSettings]);

  // Fetch master products catalog to match item images & specifications (cached)
  useEffect(() => {
    fetch('/api_products.php')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          memoizedProductsCatalogDoc = data.data;
          setProductsCatalog(data.data);
        } else if (Array.isArray(data)) {
          memoizedProductsCatalogDoc = data;
          setProductsCatalog(data);
        }
      })
      .catch((err) => console.error('Error fetching products catalog in QuotationDoc:', err));
  }, []);

  // Fetch saved quotations list for top navbar selector (cached)
  useEffect(() => {
    if (memoizedSavedQuotationsDoc.length === 0) setIsLoadingQuotations(true);
    fetch('/api_quotations.php')
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingQuotations(false);
        if (data.status === 'success' && Array.isArray(data.data)) {
          memoizedSavedQuotationsDoc = data.data;
          setSavedQuotations(data.data);
        }
      })
      .catch((err) => {
        setIsLoadingQuotations(false);
        console.error('Error fetching quotations in QuotationDoc:', err);
      });
  }, []);

  const handleSelectQuotationFromDropdown = (quoId: string) => {
    if (!quoId) return;
    setSelectedQuoId(quoId);
    const target = savedQuotations.find((q) => String(q.id) === String(quoId));
    if (target) {
      setQuotation(target);
    } else {
      fetch(`/api_quotations.php?action=get&id=${quoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && data.data) {
            setQuotation(data.data);
          }
        })
        .catch((err) => console.error('Error fetching quotation detail:', err));
    }
  };

  const handleBackNavigation = () => {
    if (onBackToBuilder) {
      onBackToBuilder();
    } else if (onBack) {
      onBack();
    }
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

  // Dynamic extractors from system_paper_settings database
  const logoUrl = paperSettings?.logo_url || paperSettings?.logoUrl;
  const stampUrl = paperSettings?.stamp_url || paperSettings?.stampUrl;
  const signatureUrl = paperSettings?.signature_url || paperSettings?.signatureUrl;
  const headerImageUrl = paperSettings?.header_image_url || paperSettings?.headerImageUrl;
  const companyName = paperSettings?.company_name || paperSettings?.companyName || 'AB MALAYA SDN. BHD.';
  const companyAddress = paperSettings?.company_address || paperSettings?.companyAddress;
  const companyEmail = paperSettings?.email || paperSettings?.companyEmail || 'sales@abmalaya.com';
  const companyPhone = paperSettings?.phone || paperSettings?.companyPhone || '+60 3-8000 1234';
  const companyWebsite = paperSettings?.website || paperSettings?.companyWebsite || 'abmalaya.com';
  const tableHeaderBgColor = paperSettings?.table_header_bg || paperSettings?.tableHeaderBg || '#0070c0';

  const renderDynamicAddress = (addrRaw?: string) => {
    const defaultAddress = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
    const addr = (addrRaw && addrRaw.trim()) ? addrRaw.trim() : defaultAddress;

    if (addr.includes('\n')) {
      const lines = addr.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.map((line, idx) => (
        <p key={idx} className={idx === 0 ? 'font-bold text-slate-900 text-xs' : idx === lines.length - 1 ? 'font-semibold text-slate-900' : 'text-slate-800'}>
          {line}
        </p>
      ));
    }

    const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const line1 = parts.slice(0, 2).join(', ') + ',';
      const line2 = parts.slice(2, parts.length - 1).join(', ') + ',';
      const line3 = parts[parts.length - 1];
      return (
        <>
          <p className="font-bold text-slate-900 text-xs">{line1}</p>
          <p className="text-slate-800">{line2}</p>
          <p className="font-semibold text-slate-900">{line3}</p>
        </>
      );
    }

    return <p className="font-semibold text-slate-900">{addr}</p>;
  };

  // Match item description against products catalog database for photos and IMPA codes
  const findCatalogMatch = (desc: string): any | null => {
    if (!desc || desc.trim() === '') return null;
    const cleanDesc = desc.toLowerCase();
    
    return (
      productsCatalog.find((p) => {
        const pName = (p.product_name || '').toLowerCase();
        const pCode = (p.product_code || '').toLowerCase();
        return cleanDesc.includes(pCode) || cleanDesc.includes(pName) || pName.includes(cleanDesc);
      }) || null
    );
  };

  return (
    <div className="w-full max-w-full bg-slate-200 min-h-[calc(100vh-53px)] space-y-0 font-sans overflow-y-auto h-full relative">
      
      {/* FROZEN / STICKY TOP NAVBAR HEADER (Hidden during Print) */}
      <div className="sticky top-0 z-40 no-print flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] w-full shadow-md">
        
        {/* LEFT SECTION: Options Dropdown + Quotation Selection Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          
          {/* 3-DOTS OPTIONS DROPDOWN MENU BUTTON */}
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
              <div className="absolute left-0 top-8 w-64 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
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

                <a
                  href={`/api_pdf.php?action=download&type=quotation&id=${quotation.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsLeftQuoDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-900 hover:bg-blue-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <FileType className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Full PDF (Puppeteer)</span>
                </a>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handlePrint();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-slate-50 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print / Save as PDF (Browser)</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    handleBackNavigation();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
                  <span>Back to Quotation Builder</span>
                </button>

                {onSendEmail && (
                  <button
                    onClick={() => {
                      setIsLeftQuoDropdownOpen(false);
                      onSendEmail();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Send via Email</span>
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
                    <span>System Settings & Branding</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* QUOTATION SELECTOR DROPDOWN */}
          <select
            value={selectedQuoId}
            onChange={(e) => handleSelectQuotationFromDropdown(e.target.value)}
            disabled={isLoadingQuotations}
            className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-3 py-1 text-xs text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer max-w-xs focus:outline-none disabled:opacity-60 transition"
          >
            <option value="">
              {isLoadingQuotations ? '-- Loading Quotations... --' : '-- Select Saved Quotation / RFQ --'}
            </option>
            {savedQuotations.map((q) => {
              const itemCnt = (q.items || q.items_details || []).length;
              return (
                <option key={q.id} value={q.id}>
                  {q.quotation_number} • {q.company_name || q.client_name} ({itemCnt} items)
                </option>
              );
            })}
          </select>

          {isLoadingQuotations && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              <span>Fetching...</span>
            </div>
          )}

          {quotationSaveNotice && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{quotationSaveNotice}</span>
            </div>
          )}
        </div>

        {/* RIGHT SECTION: Action Buttons Frozen on Top Navbar */}
        <div className="flex items-center gap-2">
          
          {/* INLINE EDIT MODE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={() => setIsEditDocMode(!isEditDocMode)}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-1 transition cursor-pointer rounded border shadow-xs ${
              isEditDocMode
                ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-400'
                : 'bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-slate-800 border-[#a0a0a0] shadow-inner'
            }`}
            title="Toggle Live Document Editor to edit text, items, prices, and terms directly on the sheet"
          >
            <Edit3 className={`w-3.5 h-3.5 ${isEditDocMode ? 'text-white' : 'text-amber-600'}`} />
            <span>{isEditDocMode ? 'Editing Mode ON' : 'Edit Document'}</span>
          </button>

          {/* SAVE QUOTATION EDITS BUTTON */}
          <button
            type="button"
            onClick={handleSaveQuotation}
            disabled={isSavingQuotation}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border border-sky-800 disabled:opacity-60"
            title="Save all changes directly to MySQL Database"
          >
            {isSavingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
            <span>{isSavingQuotation ? 'Saving...' : 'Save Changes'}</span>
          </button>

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
            <span>{isDragMode ? 'Exit Drag' : 'Drag & Move'}</span>
          </button>

          {/* SAVE LAYOUT POSITIONS PERMANENTLY BUTTON */}
          {isDragMode && (
            <button
              type="button"
              onClick={() => handleSaveLayout()}
              disabled={isSavingLayout}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#4f46e5] to-[#4338ca] hover:from-[#4338ca] hover:to-[#3730a3] text-white font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border border-indigo-800 disabled:opacity-60"
              title="Save custom element positions permanently to database"
            >
              {isSavingLayout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
              <span>Save Layout</span>
            </button>
          )}

          {Object.keys(offsets).length > 0 && isDragMode && (
            <button
              type="button"
              onClick={handleResetLayout}
              className="flex items-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-rose-700 font-bold text-xs px-2.5 py-1 transition cursor-pointer border border-[#a0a0a0] rounded shadow-inner"
              title="Reset all element positions to default and clear from database"
            >
              <span>Reset</span>
            </button>
          )}

          {layoutSaveNotice && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{layoutSaveNotice}</span>
            </div>
          )}

          <a
            href={`/api_pdf.php?action=download&type=quotation&id=${quotation.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              fetch(`/api_pdf.php?action=generate&type=quotation&id=${quotation.id}`).catch(() => {});
            }}
            className="flex items-center gap-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs px-3.5 py-1.5 transition cursor-pointer shadow-md rounded border border-blue-900"
            title="Download Full PDF generated by Puppeteer engine and promote to ACC"
          >
            <FileType className="w-4 h-4 text-white" />
            <span>Create Full PDF</span>
          </a>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-1.5 transition cursor-pointer shadow-md rounded border border-emerald-800"
            title="Open browser print & PDF dialog"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Cetak / Save PDF</span>
          </button>
        </div>

      </div>

      {/* EDIT MODE ACTIVE BANNER NOTICE */}
      {isEditDocMode && (
        <div className="no-print bg-amber-500 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 sticky top-[49px] z-30 animate-in fade-in">
          <Edit3 className="w-4 h-4" />
          <span>EDITING MODE ACTIVE: Click on any text, item, code, quantity, price, discount, or terms below to edit directly. Click "Save Changes" when done.</span>
          <button
            onClick={() => setIsEditDocMode(false)}
            className="ml-3 bg-white text-amber-900 px-2 py-0.5 rounded text-[11px] font-black uppercase hover:bg-amber-50 transition"
          >
            Finish Editing
          </button>
        </div>
      )}

      {/* DRAG MODE ACTIVE BANNER NOTICE */}
      {isDragMode && (
        <div className="no-print bg-blue-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 sticky top-[49px] z-30 animate-in fade-in">
          <Move className="w-4 h-4 animate-bounce" />
          <span>DRAG MODE ACTIVE: Click & drag any logo, text, table, photo, signature, or stamp on the paper to reposition freely!</span>
          <button
            onClick={() => setIsDragMode(false)}
            className="ml-3 bg-white text-blue-800 px-2 py-0.5 rounded text-[11px] font-black uppercase hover:bg-blue-50 transition"
          >
            Done
          </button>
        </div>
      )}

      {/* OFFICIAL AB MALAYA INTERNATIONAL STANDARD PAPER SHEET */}
      <div className="p-4 sm:p-6 w-full max-w-full flex justify-center">
        <div
          id="quotation-pdf-document"
          className="bg-white text-slate-900 p-8 sm:p-12 font-sans border border-slate-400 shadow-xl w-full max-w-[850px] min-h-[1100px] rounded-none relative overflow-hidden"
          style={{
            paddingTop: `${modalMarginTop}mm`,
            paddingBottom: `${modalMarginBottom}mm`,
            paddingLeft: `${modalMarginLeft}mm`,
            paddingRight: `${modalMarginRight}mm`,
            fontSize: `${modalFontSize}pt`,
          }}
        >
          <table className="w-full border-collapse">
            {/* 1. REPEATING LETTERHEAD HEADER FOR PRINT / MULTI-PAGE */}
            <thead className="table-header-group">
              <tr>
                <td className="p-0 border-none pb-4">
                  <div className="relative -mx-8 -mt-8 sm:-mx-12 sm:-mt-12 mb-2 w-[calc(100%+4rem)] sm:w-[calc(100%+6rem)] overflow-hidden border-b-2 border-[#004f8b] min-h-[120px] sm:min-h-[140px] flex items-stretch">
                    {/* HEADER IMAGE BACKGROUND */}
                    {headerImageUrl ? (
                      <img
                        src={headerImageUrl}
                        alt="Header Background"
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0 brightness-[1.02] contrast-[1.05]"
                      />
                    ) : (
                      <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-[#004f8b] via-[#0070c0] to-[#0080d0] z-0"></div>
                    )}

                    {/* LETTERHEAD CONTENT */}
                    <div className="relative z-10 px-8 pt-6 sm:px-12 sm:pt-8 pb-2 sm:pb-3 flex flex-col sm:flex-row items-end justify-between gap-6 w-full">
                      {/* Logo & Company Name Left */}
                      <DraggableElement id="header_logo" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Logo" resizable={true} className="self-end pb-0.5">
                        <div className="flex items-end gap-4">
                          {isLoadingPaperSettings ? (
                            <div className="h-16 w-36 bg-white/90 border border-slate-300 rounded-none flex items-center justify-center gap-2 text-xs text-blue-700 font-mono font-bold animate-pulse shrink-0">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                              <span>Loading Logo...</span>
                            </div>
                          ) : logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={companyName}
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
                                <h2 className="text-xl font-black text-[#004f8b] tracking-wide uppercase leading-none">
                                  {companyName}
                                </h2>
                                <span className="text-xs font-bold text-[#0070c0] font-mono block">(1601411-W)</span>
                                <span className="text-[10px] text-slate-500 italic font-semibold">Serve To Solve</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </DraggableElement>

                      {/* Official Registered Office Address Right */}
                      <DraggableElement id="header_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Company Address" className="self-end pb-0.5">
                        <div className="text-left sm:text-right text-xs text-slate-800 leading-snug font-sans shrink-0 font-medium">
                          {renderDynamicAddress(companyAddress)}
                        </div>
                      </DraggableElement>
                    </div>
                  </div>
                </td>
              </tr>
            </thead>

            {/* MAIN DOCUMENT CONTENT BODY */}
            <tbody>
              <tr>
                <td className="p-0 border-none space-y-6">
                  {/* 3. METADATA SECTION */}
                  <DraggableElement id="metadata_section" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Metadata Info">
                    <div className="py-2 text-xs text-slate-800 font-sans space-y-1.5 w-full border-b border-slate-300 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-1.5 gap-x-2 items-center">
                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Ref No.</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <input
                              type="text"
                              value={docRefNo}
                              onChange={(e) => setDocRefNo(e.target.value)}
                              className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                            />
                          ) : (
                            <span className="font-mono font-bold text-slate-900">{docRefNo}</span>
                          )}
                        </div>

                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Date</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={docDateIssued}
                                onChange={(e) => setDocDateIssued(e.target.value)}
                                className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs focus:outline-blue-500"
                              />
                              <span className="text-slate-600 font-semibold">(Valid:</span>
                              <input
                                type="text"
                                value={docValidUntil}
                                onChange={(e) => setDocValidUntil(e.target.value)}
                                className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-24 focus:outline-blue-500"
                                placeholder="14 Days"
                              />
                              <span className="text-slate-600 font-semibold">)</span>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-slate-900">{docDateIssued} (Valid: {docValidUntil})</span>
                          )}
                        </div>

                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Project Reference</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <input
                              type="text"
                              value={docProjectReference}
                              onChange={(e) => setDocProjectReference(e.target.value)}
                              className="font-semibold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs w-full focus:outline-blue-500"
                              placeholder="Project reference name or specification"
                            />
                          ) : (
                            <span className="font-semibold text-slate-900 leading-normal">{docProjectReference}</span>
                          )}
                        </div>

                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Attention</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                type="text"
                                value={docClientName}
                                onChange={(e) => setDocClientName(e.target.value)}
                                className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs flex-1 focus:outline-blue-500"
                                placeholder="Client Contact Name"
                              />
                              <span className="text-slate-500 font-bold">(</span>
                              <input
                                type="text"
                                value={docCompanyName}
                                onChange={(e) => setDocCompanyName(e.target.value)}
                                className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs flex-1 focus:outline-blue-500"
                                placeholder="Company Name"
                              />
                              <span className="text-slate-500 font-bold">)</span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-900">
                              {docClientName} {docCompanyName ? `(${docCompanyName})` : ''}
                            </span>
                          )}
                        </div>

                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Tel No.</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <input
                              type="text"
                              value={docClientPhone}
                              onChange={(e) => setDocClientPhone(e.target.value)}
                              className="font-mono text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                              placeholder="+60 12-345 6789"
                            />
                          ) : (
                            <span className="font-mono text-slate-900">{docClientPhone || '—'}</span>
                          )}
                        </div>

                        <span className="md:col-span-3 font-bold text-slate-700 uppercase">Email</span>
                        <div className="md:col-span-9 flex items-center gap-1">
                          <span className="font-bold text-slate-900">:</span>
                          {isEditDocMode ? (
                            <input
                              type="email"
                              value={docClientEmail}
                              onChange={(e) => setDocClientEmail(e.target.value)}
                              className="font-mono text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                              placeholder="client@company.com"
                            />
                          ) : (
                            <span className="font-mono text-slate-900">{docClientEmail}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </DraggableElement>

                  {/* 4. TITLE STRIP BANNER */}
                  <DraggableElement id="title_banner" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Title Banner">
                    <div 
                      className="text-white font-extrabold text-xs sm:text-sm px-4 py-2 uppercase tracking-wider text-center shadow-2xs rounded-none"
                      style={{ backgroundColor: tableHeaderBgColor }}
                    >
                      COMMERCIAL QUOTATION - {docRefNo}
                    </div>
                  </DraggableElement>

                  <DraggableElement id="intro_text" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Intro Message">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      We would like to submit the following commercial quotation and specification list for your review and pricing:
                    </p>
                  </DraggableElement>

                  {/* 5. LINE ITEMS SPECIFICATIONS TABLE */}
                  <DraggableElement id="items_table" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Product Table">
                    <div className="border border-slate-900 rounded-none overflow-x-auto w-full bg-white">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead 
                          className="text-white font-bold text-[10px] uppercase tracking-wide border-b border-slate-900"
                          style={{ backgroundColor: tableHeaderBgColor }}
                        >
                          <tr>
                            <th className="p-1.5 w-7 text-center border-r border-slate-900">NO.</th>
                            <th className="p-1.5 w-10 text-center border-r border-slate-900">PHOTO</th>
                            <th className="p-1.5 w-24 border-r border-slate-900 font-mono">PRODUCT CODE</th>
                            <th className="p-1.5 w-16 border-r border-slate-900 font-mono">IMPA</th>
                            <th className="p-1.5 w-36 border-r border-slate-900">PRODUCT NAME</th>
                            <th className="p-1.5 border-r border-slate-900">SPECIFICATION / DETAILS</th>
                            <th className="p-1.5 w-14 text-center border-r border-slate-900">QTY</th>
                            <th className="p-1.5 w-14 text-center border-r border-slate-900">UNIT</th>
                            <th className="p-1.5 w-24 text-right border-r border-slate-900">UNIT PRICE (MYR)</th>
                            <th className="p-1.5 w-14 text-center border-r border-slate-900">DISC (%)</th>
                            <th className="p-1.5 w-24 text-right border-r border-slate-900">TOTAL (MYR)</th>
                            {isEditDocMode && <th className="p-1.5 w-8 text-center bg-rose-700 text-white">DEL</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {docItems.map((item, idx) => {
                            const isEven = idx % 2 === 1;
                            const matchedCatalogProduct = findCatalogMatch(item.description);
                            const displayPhotoUrl = (item as any).image_url || matchedCatalogProduct?.image_url;
                            const productCode = item.product_code || item.item_code || matchedCatalogProduct?.product_code || '';
                            const impaCode = (item as any).impa_code || item.category_code || matchedCatalogProduct?.impa_code || '';
                            const specText = (item as any).specification || (item as any).offer || matchedCatalogProduct?.specification || matchedCatalogProduct?.description || '';

                            return (
                              <tr key={item.id || idx} className={`${isEven ? 'bg-slate-50/90' : 'bg-white'} print:break-inside-avoid`}>
                                <td className="p-2 text-center font-mono font-bold text-slate-800 border-r border-slate-900">
                                  {idx + 1}
                                </td>

                                {/* Product Photo Column */}
                                <td className="p-1 text-center border-r border-slate-900">
                                  {displayPhotoUrl && !displayPhotoUrl.includes('unsplash') ? (
                                    <DraggableElement id={`photo_${item.id || idx}`} isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label={`Photo #${idx + 1}`} inline>
                                      <img
                                        src={displayPhotoUrl}
                                        alt={item.description}
                                        className="w-8 h-8 object-cover border border-slate-400 rounded-none mx-auto pointer-events-none"
                                      />
                                    </DraggableElement>
                                  ) : (
                                    <div className="w-8 h-8 bg-slate-100 border border-slate-300 rounded-none mx-auto flex items-center justify-center text-slate-400" title="No photo">
                                      <Package className="w-3.5 h-3.5 opacity-40" />
                                    </div>
                                  )}
                                </td>

                                {/* Product Code */}
                                <td className="p-1.5 font-mono font-bold text-slate-900 border-r border-slate-900 text-xs">
                                  {isEditDocMode ? (
                                    <input
                                      type="text"
                                      value={item.product_code || ''}
                                      onChange={(e) => handleItemFieldChange(idx, 'product_code', e.target.value)}
                                      className="w-full font-mono font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                      placeholder="Code / SKU"
                                    />
                                  ) : (
                                    productCode || '—'
                                  )}
                                </td>

                                {/* IMPA Code */}
                                <td className="p-1.5 font-mono font-bold text-purple-900 border-r border-slate-900 text-xs">
                                  {isEditDocMode ? (
                                    <input
                                      type="text"
                                      value={(item as any).impa_code || ''}
                                      onChange={(e) => handleItemFieldChange(idx, 'impa_code', e.target.value)}
                                      className="w-full font-mono font-bold text-purple-900 bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                      placeholder="IMPA"
                                    />
                                  ) : (
                                    impaCode || '—'
                                  )}
                                </td>

                                {/* Product Name */}
                                <td className="p-1.5 font-bold text-slate-900 border-r border-slate-900 text-xs">
                                  {isEditDocMode ? (
                                    <input
                                      type="text"
                                      value={item.description}
                                      onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                                      className="w-full font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                      placeholder="Product description"
                                    />
                                  ) : (
                                    item.description
                                  )}
                                </td>

                                {/* Specification */}
                                <td className="p-1.5 text-slate-700 border-r border-slate-900 text-[11px] leading-snug">
                                  {isEditDocMode ? (
                                    <textarea
                                      rows={2}
                                      value={(item as any).specification || specText}
                                      onChange={(e) => handleItemFieldChange(idx, 'specification', e.target.value)}
                                      className="w-full text-slate-800 bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                      placeholder="Detailed specifications"
                                    />
                                  ) : (
                                    specText || 'Standard specification'
                                  )}
                                </td>

                                {/* Quantity */}
                                <td className="p-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-900">
                                  {isEditDocMode ? (
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleItemFieldChange(idx, 'quantity', Number(e.target.value))}
                                      className="w-12 text-center font-mono font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                    />
                                  ) : (
                                    item.quantity
                                  )}
                                </td>

                                {/* Unit */}
                                <td className="p-1.5 text-center text-slate-800 border-r border-slate-900">
                                  {isEditDocMode ? (
                                    <input
                                      type="text"
                                      value={item.unit || 'Unit'}
                                      onChange={(e) => handleItemFieldChange(idx, 'unit', e.target.value)}
                                      className="w-12 text-center bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                    />
                                  ) : (
                                    item.unit || 'Unit'
                                  )}
                                </td>

                                {/* Unit Price */}
                                <td className="p-1.5 text-right font-mono text-slate-900 border-r border-slate-900">
                                  {isEditDocMode ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) => handleItemFieldChange(idx, 'unit_price', Number(e.target.value))}
                                      className="w-20 text-right font-mono font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                    />
                                  ) : (
                                    formatCurrency(item.unit_price)
                                  )}
                                </td>

                                {/* Discount % */}
                                <td className="p-1.5 text-center font-mono text-slate-900 border-r border-slate-900 font-bold">
                                  {isEditDocMode ? (
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={item.discount_percent || 0}
                                      onChange={(e) => handleItemFieldChange(idx, 'discount_percent', Number(e.target.value))}
                                      className="w-10 text-center font-mono bg-amber-50/70 border border-amber-300 px-0.5 py-0.5 rounded text-xs focus:outline-blue-500"
                                    />
                                  ) : (
                                    item.discount_percent > 0 ? `${item.discount_percent}%` : '-'
                                  )}
                                </td>

                                {/* Total */}
                                <td className="p-2 text-right font-mono font-bold text-slate-900 text-xs border-r border-slate-900">
                                  {formatCurrency(item.total)}
                                </td>

                                {/* Action Delete row button in Edit Mode */}
                                {isEditDocMode && (
                                  <td className="p-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItemRow(idx)}
                                      className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded transition"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* ADD ROW BUTTON IN EDIT MODE */}
                      {isEditDocMode && (
                        <div className="p-2 bg-slate-100 border-t border-slate-300 flex justify-start">
                          <button
                            type="button"
                            onClick={handleAddItemRow}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1 rounded shadow-xs cursor-pointer transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Product Row</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </DraggableElement>

                  {/* 6. TERMS & CONDITIONS + FINANCIAL SUMMARY GRID */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-2 w-full print:break-inside-avoid">
                    
                    {/* TERMS & CONDITIONS */}
                    <DraggableElement id="terms_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Terms & Conditions" className="w-full md:w-1/2">
                      <div className="space-y-2 text-xs">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block border-b border-slate-900 pb-1">
                          TERMS & CONDITIONS:
                        </span>
                        <div className="text-slate-700 whitespace-pre-line leading-relaxed font-sans pt-1 space-y-1 text-xs">
                          {isEditDocMode ? (
                            <textarea
                              rows={4}
                              value={docNotes}
                              onChange={(e) => setDocNotes(e.target.value)}
                              className="w-full font-sans text-xs bg-amber-50/70 border border-amber-300 p-2 rounded focus:outline-blue-500 leading-relaxed"
                              placeholder="1. Prices stated in MYR..."
                            />
                          ) : (
                            <p>{docNotes}</p>
                          )}
                        </div>
                      </div>
                    </DraggableElement>

                    {/* FINANCIAL SUMMARY BOX */}
                    <DraggableElement id="summary_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Financial Summary" className="w-full md:w-80">
                      <div className="border-2 border-slate-900 rounded-none p-4 space-y-2 text-xs bg-white">
                        <div className="flex justify-between items-center text-slate-700">
                          <span className="font-semibold">GROSS SUBTOTAL:</span>
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(financialTotals.subtotal)}</span>
                        </div>

                        {financialTotals.discountTotal > 0 && (
                          <div className="flex justify-between items-center text-amber-800">
                            <span className="font-semibold">TOTAL DISCOUNT:</span>
                            <span className="font-mono font-bold">-{formatCurrency(financialTotals.discountTotal)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-slate-700">
                          <div className="flex items-center gap-1 font-semibold">
                            <span>VAT TAX (</span>
                            {isEditDocMode ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={docTaxPercent}
                                onChange={(e) => setDocTaxPercent(Number(e.target.value))}
                                className="w-10 text-center font-mono bg-amber-50/70 border border-amber-300 px-0.5 py-0.2 rounded text-xs"
                              />
                            ) : (
                              <span>{docTaxPercent}</span>
                            )}
                            <span>%):</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(financialTotals.taxAmount)}</span>
                        </div>

                        <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-slate-900 font-black text-base">
                          <span>GRAND TOTAL:</span>
                          <span className="font-mono text-[#0070c0]">{formatCurrency(financialTotals.grandTotal)}</span>
                        </div>
                      </div>
                    </DraggableElement>

                  </div>

                  {/* 7. DUAL AUTHORIZATION SIGNATURE BLOCK */}
                  <div className="flex flex-col sm:flex-row justify-between items-end pt-8 border-t border-slate-300 text-xs w-full gap-8 print:break-inside-avoid">
                    {/* CLIENT ACCEPTANCE */}
                    <DraggableElement id="signature_client" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Client Acceptance">
                      <div className="space-y-1">
                        <p className="text-slate-600 font-bold uppercase tracking-wide">CONFIRMED & ACCEPTED BY (CLIENT):</p>
                        <div className="h-16 border-b border-slate-400 w-48"></div>
                        <p className="font-bold text-slate-900 pt-1">NAME: ({docClientName || 'Client Contact'})</p>
                        <p className="text-slate-600 font-mono text-[11px]">COMPANY: {docCompanyName || 'Client Company'}</p>
                        <p className="text-slate-500 font-mono text-[11px]">DATE: ____ / ____ / ________</p>
                      </div>
                    </DraggableElement>

                    {/* ISSUER SIGNATORY */}
                    <DraggableElement id="signature_issuer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Issuer Signature">
                      <div className="text-left sm:text-right space-y-1">
                        <p className="text-slate-600 font-bold uppercase tracking-wide">Yours faithfully,</p>
                        <strong className="block text-slate-900 font-extrabold uppercase">{companyName}</strong>
                        
                        <div className="h-20 flex items-center justify-start sm:justify-end my-1 gap-2">
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

                        {isEditDocMode ? (
                          <input
                            type="text"
                            value={docCreatedBy}
                            onChange={(e) => setDocCreatedBy(e.target.value)}
                            className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-2 py-0.5 rounded text-xs text-right w-56 focus:outline-blue-500"
                            placeholder="Signatory Name"
                          />
                        ) : (
                          <p className="font-bold text-slate-900"><u>{docCreatedBy || 'Muhammad Aimanuddin Bin Mohd Zaki'}</u></p>
                        )}
                        <p className="text-slate-600 font-mono text-[11px]">HEAD OF SALES & LOGISTICS</p>
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
                  {/* 8. OFFICIAL AB MALAYA FOOTER */}
                  <DraggableElement id="footer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Footer">
                    <div className="border-t border-slate-300 pt-5 mt-6 text-center space-y-2 w-full">
                      <div className="flex items-center justify-center gap-2">
                        <img
                          src={logoUrl || '/favicon.png'}
                          alt="Company Logo / Favicon"
                          className="h-6 max-h-6 object-contain block pointer-events-none"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/favicon.png';
                          }}
                        />
                        <span className="font-bold text-xs text-[#004f8b] uppercase tracking-wide">{companyName}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-mono">
                        {(quotation as any).created_by_email || (quotation as any).sender_email || (quotation as any).user_email || companyEmail}, {companyPhone}, {companyWebsite}
                      </p>
                    </div>
                  </DraggableElement>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── QUICK PAPER & MARGINS SETUP MODAL ──────────────────────────────── */}
      {isPaperSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-300 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm">Paper Size & Margin Setup</h3>
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
                  onClick={handleSaveQuickPaperSetup}
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

export default QuotationDoc;
