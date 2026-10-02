import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, QuotationItem } from '../types/erp';
import { 
  Printer, Send, ArrowLeft, ChevronDown, Settings, Loader2, 
  Move, Save, CheckCircle2, Edit3, Plus, Trash2, X, SlidersHorizontal, MoreVertical, FileType, ExternalLink, FileText, RotateCcw
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface QuotationDocProps {
  quotation: Quotation;
  onBack?: () => void;
  onBackToBuilder?: () => void;
  onSendEmail?: () => void;
  onNavigateView?: (mode: any) => void;
  paperSettings?: any;
  currentUser?: { id?: string; name?: string; email?: string; role?: string };
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
  style?: React.CSSProperties;
}

interface PageChunk {
  pageNumber: number;
  totalPages: number;
  items: QuotationItem[];
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
  style = {},
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

  const isRightAligned = id === 'signature_issuer' || className.includes('sig-issuer-box') || className.includes('summary-box');

  const transformStyle: React.CSSProperties = {
    transform: `translate(${currentOffset.x || 0}px, ${currentOffset.y || 0}px) scale(${currentScale})`,
    transformOrigin: isRightAligned ? 'right bottom' : 'left bottom',
    transition: isDragging || isResizing ? 'none' : 'transform 0.05s ease-out',
    position: 'relative',
    zIndex: isDragging || isResizing ? 50 : isDragMode ? 10 : 'auto',
    ...style,
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
            title="Scale Down Logo"
          >
            -
          </button>
          <span>{Math.round(currentScale * 100)}%</span>
          <button
            type="button"
            onClick={(e) => handleQuickScale(0.1, e)}
            className="hover:bg-slate-700 px-1 rounded font-bold cursor-pointer"
            title="Scale Up Logo"
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
  currentUser,
}) => {
  const [quotation, setQuotation] = useState<Quotation>(initialQuotation || {});
  const [paperSettings, setPaperSettings] = useState<any>(propPaperSettings || memoizedPaperSettingsDoc || null);
  const [isLoadingPaperSettings, setIsLoadingPaperSettings] = useState<boolean>(!propPaperSettings && !memoizedPaperSettingsDoc);
  const [productsCatalog, setProductsCatalog] = useState<any[]>(memoizedProductsCatalogDoc);
  const [savedQuotations, setSavedQuotations] = useState<Quotation[]>(memoizedSavedQuotationsDoc);
  const [selectedQuoId, setSelectedQuoId] = useState<string>(initialQuotation?.id || '');
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(memoizedSavedQuotationsDoc.length === 0);
  const [isLeftQuoDropdownOpen, setIsLeftQuoDropdownOpen] = useState<boolean>(false);

  // Helper to reliably resolve current active user session
  const resolveActiveUser = () => {
    if (currentUser?.name && currentUser.name.trim() && currentUser.name !== 'Unidentified Session' && currentUser.name !== 'Sesi Tidak Terdeteksi') {
      return currentUser.name;
    }
    if (currentUser?.email && currentUser.email.trim()) {
      return currentUser.email;
    }
    try {
      const raw = localStorage.getItem('abmalaya_user_session');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.name && u.name.trim() && u.name !== 'Unidentified Session' && u.name !== 'Sesi Tidak Terdeteksi') return u.name;
        if (u?.email && u.email.trim()) return u.email;
      }
    } catch (e) {}
    return 'Muhammad Aimanuddin Bin Mohd Zaki';
  };

  const getSessionUserParams = () => {
    try {
      const raw = localStorage.getItem('abmalaya_user_session');
      if (raw) {
        const u = JSON.parse(raw);
        const name = u?.name || currentUser?.name || 'Muhammad Aimanuddin Bin Mohd Zaki';
        const email = u?.email || currentUser?.email || 'admin@abmalaya.com';
        return `&user_name=${encodeURIComponent(name)}&user_email=${encodeURIComponent(email)}`;
      }
    } catch (e) {}
    const fallbackName = currentUser?.name || 'Muhammad Aimanuddin Bin Mohd Zaki';
    const fallbackEmail = currentUser?.email || 'admin@abmalaya.com';
    return `&user_name=${encodeURIComponent(fallbackName)}&user_email=${encodeURIComponent(fallbackEmail)}`;
  };

  // Drag Mode & Element Offsets State
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [offsets, setOffsets] = useState<Record<string, OffsetData>>({});
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [layoutSaveNotice, setLayoutSaveNotice] = useState<string | null>(null);

  // Quick Paper Setup Modal State
  const [isPaperSetupModalOpen, setIsPaperSetupModalOpen] = useState<boolean>(false);

  // Paper Setup Modal Form Fields (Default 6mm margin matching daemon engine)
  const [modalPaperSize, setModalPaperSize] = useState<string>('A4');
  const [modalMarginTop, setModalMarginTop] = useState<number>(6);
  const [modalMarginBottom, setModalMarginBottom] = useState<number>(6);
  const [modalMarginLeft, setModalMarginLeft] = useState<number>(6);
  const [modalMarginRight, setModalMarginRight] = useState<number>(6);
  const [modalFontSize, setModalFontSize] = useState<number>(9);
  const [modalTableHeaderBg, setModalTableHeaderBg] = useState<string>('#0070c0');
  const [modalFooterText, setModalFooterText] = useState<string>('');
  const [modalFooterTerms, setModalFooterTerms] = useState<string>('');
  const [isSavingPaperSetup, setIsSavingPaperSetup] = useState<boolean>(false);

  // Inline Document Editing State
  const [isEditDocMode, setIsEditDocMode] = useState<boolean>(false);
  const [isSavingQuotation, setIsSavingQuotation] = useState<boolean>(false);
  const [quotationSaveNotice, setQuotationSaveNotice] = useState<string | null>(null);

  // Editable Form Fields State - Default date to today automatically
  const [docRefNo, setDocRefNo] = useState<string>('');
  const [docDateIssued, setDocDateIssued] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [docValidUntil, setDocValidUntil] = useState<string>('14 Days');
  const [docProjectReference, setDocProjectReference] = useState<string>('');
  const [docClientName, setDocClientName] = useState<string>('');
  const [docCompanyName, setDocCompanyName] = useState<string>('');
  const [docClientPhone, setDocClientPhone] = useState<string>('');
  const [docClientEmail, setDocClientEmail] = useState<string>('');
  const [docNotes, setDocNotes] = useState<string>('');
  const [docFooterText, setDocFooterText] = useState<string>('');
  const [docCreatedBy, setDocCreatedBy] = useState<string>('');
  const [docTaxPercent, setDocTaxPercent] = useState<number>(11);
  const [docItems, setDocItems] = useState<QuotationItem[]>([]);

  // Initialize paper modal fields when paperSettings is loaded
  useEffect(() => {
    if (!paperSettings) return;
    setModalPaperSize(paperSettings.paper_size || paperSettings.paperSize || 'A4');
    setModalMarginTop(Number(paperSettings.margin_top || paperSettings.marginTop) || 6);
    setModalMarginBottom(Number(paperSettings.margin_bottom || paperSettings.marginBottom) || 6);
    setModalMarginLeft(Number(paperSettings.margin_left || paperSettings.marginLeft) || 6);
    setModalMarginRight(Number(paperSettings.margin_right || paperSettings.marginRight) || 6);
    setModalFontSize(Number(paperSettings.font_size || paperSettings.fontSize) || 9);
    setModalTableHeaderBg(paperSettings.table_header_bg || paperSettings.tableHeaderBg || '#0070c0');
    setModalFooterText(paperSettings.footer_text || paperSettings.footerText || '');
    setModalFooterTerms(paperSettings.footer_terms || paperSettings.footerTerms || '');
  }, [paperSettings]);

  // Clean email helper
  const cleanEmailStr = (emailRaw: any): string => {
    if (!emailRaw) return '';
    if (typeof emailRaw === 'string' && emailRaw.includes('{')) {
      try {
        const parsed = JSON.parse(emailRaw);
        if (parsed.selected) return parsed.selected;
        if (parsed.email) return parsed.email;
        if (Array.isArray(parsed.options) && parsed.options.length > 0) {
          return parsed.options[0].email || '';
        }
      } catch (e) {}
    }
    return typeof emailRaw === 'string' ? emailRaw.trim() : '';
  };

  // Initialize editable fields whenever `quotation` changes
  useEffect(() => {
    if (!quotation) return;
    
    setDocRefNo(quotation.quotation_number || (quotation as any).ref_number || (quotation.id ? `QUO-ABM/MY/2026/${quotation.id}` : 'ABM/QUO/2026-001'));
    setDocDateIssued(quotation.date_issued && quotation.date_issued.trim() ? quotation.date_issued : new Date().toISOString().split('T')[0]);
    setDocValidUntil(quotation.valid_until || '14 Days');
    setDocProjectReference((quotation as any).project_reference || quotation.notes || (quotation as any).category_name || 'INDUSTRIAL & MARITIME EQUIPMENT SUPPLY');
    setDocClientName(quotation.client_name || (quotation as any).contact_person || 'Valued Client');
    setDocCompanyName(quotation.company_name || (quotation as any).client_company || '');
    setDocClientPhone(quotation.client_phone || (quotation as any).phone || '');
    setDocClientEmail(cleanEmailStr(quotation.client_email) || 'sales@abmalaya.com');
    setDocNotes(quotation.notes || paperSettings?.footer_terms || paperSettings?.default_notes || '1. Prices stated in Malaysian Ringgit (MYR) and valid for 14 days.\n2. Goods remain property of AB Malaya Sdn. Bhd. until fully paid.\n3. Standard 1-year official manufacturer warranty applicable.');
    setDocFooterText((quotation as any).footer_text || paperSettings?.footer_text || paperSettings?.footerText || '');
    setDocCreatedBy(
      (quotation.created_by && quotation.created_by.trim() && quotation.created_by !== 'Sesi Tidak Terdeteksi' && quotation.created_by !== 'Unidentified Session')
        ? quotation.created_by
        : resolveActiveUser()
    );
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

  // Helper to compute visual height weight of a quotation item based on text length & photos
  const getItemHeightWeight = (item: any): number => {
    let w = 1.0; // base row height
    const desc = String(item.description || '');
    const spec = String(item.specification || '');
    const offer = String(item.offer || item.offered_item || '');
    
    // Description line count
    const descLines = desc.split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 42)), 0);
    w += Math.max(0, (descLines - 1) * 0.45);

    // Specification line count
    if (spec) {
      const specLines = spec.split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 48)), 0);
      w += specLines * 0.4;
    }

    // Offered item line count
    if (offer) {
      const offerLines = offer.split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 32)), 0);
      w += Math.max(0, (offerLines - 1) * 0.35);
    }

    // Product Photo
    if (item.image_url) {
      w += 3.2;
    }

    return Math.max(1.0, w);
  };

  // Smart Dynamic Pagination Algorithm (Fills A4 Sheets densely before moving to next page)
  const pageChunks: PageChunk[] = useMemo(() => {
    if (!docItems || docItems.length === 0) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        items: [],
        startIndex: 0,
        isFirstPage: true,
        isLastPage: true,
      }];
    }

    const itemWeights = docItems.map(getItemHeightWeight);
    const totalWeight = itemWeights.reduce((a, b) => a + b, 0);

    const SINGLE_PAGE_MAX_WEIGHT = 6.0;
    const PAGE1_MULTIPAGE_MAX_WEIGHT = 11.0;
    const MIDDLE_PAGE_MAX_WEIGHT = 16.5;
    const LAST_PAGE_MAX_WEIGHT = 8.0;

    if (totalWeight <= SINGLE_PAGE_MAX_WEIGHT && docItems.length <= 6) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        items: docItems,
        startIndex: 0,
        isFirstPage: true,
        isLastPage: true,
      }];
    }

    const pages: PageChunk[] = [];
    let currentIdx = 0;
    let pageNum = 1;

    while (currentIdx < docItems.length) {
      const isFirst = pageNum === 1;
      const remainingItems = docItems.slice(currentIdx);
      const remainingWeight = itemWeights.slice(currentIdx).reduce((a, b) => a + b, 0);

      const currentMaxWeightAsLast = isFirst ? SINGLE_PAGE_MAX_WEIGHT : LAST_PAGE_MAX_WEIGHT;
      if (remainingWeight <= currentMaxWeightAsLast) {
        pages.push({
          pageNumber: pageNum,
          totalPages: 0,
          items: remainingItems,
          startIndex: currentIdx,
          isFirstPage: isFirst,
          isLastPage: true,
        });
        break;
      }

      const currentMaxWeight = isFirst ? PAGE1_MULTIPAGE_MAX_WEIGHT : MIDDLE_PAGE_MAX_WEIGHT;
      let accumWeight = 0;
      let count = 0;

      while (currentIdx + count < docItems.length) {
        const nextWeight = itemWeights[currentIdx + count];
        if (count > 0 && accumWeight + nextWeight > currentMaxWeight) {
          break;
        }
        accumWeight += nextWeight;
        count++;
      }

      const pageItems = docItems.slice(currentIdx, currentIdx + count);
      pages.push({
        pageNumber: pageNum,
        totalPages: 0,
        items: pageItems,
        startIndex: currentIdx,
        isFirstPage: isFirst,
        isLastPage: currentIdx + count >= docItems.length,
      });

      currentIdx += count;
      pageNum++;
    }

    const total = pages.length;
    pages.forEach(p => p.totalPages = total);
    return pages;
  }, [docItems]);

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
      specification: 'Standard manufacturer specification',
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
      footer_text: docFooterText,
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
        console.error('Error saving quotation:', err);
        alert('Error communicating with server while saving quotation.');
      });
  };

  // Quick Paper Setup Modal Save Handler
  const handleSaveQuickPaperSetup = () => {
    setIsSavingPaperSetup(true);
    const payload = {
      action: 'save',
      paper_size: modalPaperSize,
      margin_top: modalMarginTop,
      margin_bottom: modalMarginBottom,
      margin_left: modalMarginLeft,
      margin_right: modalMarginRight,
      font_size: modalFontSize,
      table_header_bg: modalTableHeaderBg,
      footer_text: modalFooterText,
      footer_terms: modalFooterTerms,
    };

    fetch('/api_paper_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSavingPaperSetup(false);
        if (data.status === 'success') {
          const updated = {
            ...(paperSettings || {}),
            paper_size: modalPaperSize,
            margin_top: modalMarginTop,
            margin_bottom: modalMarginBottom,
            margin_left: modalMarginLeft,
            margin_right: modalMarginRight,
            font_size: modalFontSize,
            table_header_bg: modalTableHeaderBg,
          };
          setPaperSettings(updated);
          memoizedPaperSettingsDoc = updated;
          setIsPaperSetupModalOpen(false);
          setLayoutSaveNotice('Paper & Margins setup saved successfully!');
          setTimeout(() => setLayoutSaveNotice(null), 3000);
        } else {
          alert('Failed to save paper setup: ' + (data.message || 'Error'));
        }
      })
      .catch((err) => {
        setIsSavingPaperSetup(false);
        console.error('Error saving paper setup:', err);
      });
  };

  const handleOffsetChange = (id: string, newOffset: OffsetData) => {
    setOffsets((prev) => ({
      ...prev,
      [id]: newOffset,
    }));
  };

  const handleSaveLayout = (targetOffsets?: Record<string, OffsetData>) => {
    const toSave = targetOffsets !== undefined ? targetOffsets : offsets;
    setIsSavingLayout(true);
    fetch(getApiUrl('/api_paper_settings.php'), {
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
          setLayoutSaveNotice('✓ Document layout & element positions saved permanently!');
          setTimeout(() => setLayoutSaveNotice(null), 3500);
        }
      })
      .catch((err) => {
        setIsSavingLayout(false);
        console.error('Error saving layout offsets:', err);
      });
  };

  const handleDoneDragMode = () => {
    setIsDragMode(false);
    handleSaveLayout(offsets);
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
    return `MYR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDocDate = (rawDate: string) => {
    if (!rawDate) return '';
    if (rawDate.includes('/')) return rawDate;
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) {}
    return rawDate;
  };

  const [isPrintingDirect, setIsPrintingDirect] = useState<boolean>(false);

  const handlePrint = async () => {
    setIsPrintingDirect(true);
    // 1. Auto-save current quotation edits to MySQL
    try {
      if (isEditDocMode) {
        await handleSaveQuotation();
      }
    } catch (e) {
      console.warn('Auto-save before print warning:', e);
    }

    const docId = quotation?.id || quotation?.quotation_number || selectedQuoId;
    const printUrl = getApiUrl(`/view_doc.php?type=quotation&id=${encodeURIComponent(docId)}&print=1&t=${Date.now()}`);

    // 2. Print via isolated hidden iframe loading exact preview mode template (view_doc.php)
    let printIframe = document.getElementById('direct-quotation-print-frame') as HTMLIFrameElement;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'direct-quotation-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';
      document.body.appendChild(printIframe);
    }

    printIframe.onload = () => {
      setIsPrintingDirect(false);
      try {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
      } catch (err) {
        window.open(printUrl, '_blank');
      }
    };

    printIframe.src = printUrl;

    setTimeout(() => {
      setIsPrintingDirect(false);
    }, 4000);
  };

  // Helper to format asset URLs with environment prefix & cache buster
  const formatAssetUrl = (url?: string) => {
    if (!url || !url.trim()) return '';
    const clean = url.trim();
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    const apiPath = getApiUrl(clean);
    const timestamp = paperSettings?.updated_at ? new Date(paperSettings.updated_at).getTime() : '';
    return timestamp ? `${apiPath}?v=${timestamp}` : apiPath;
  };

  // Dynamic extractors from system_paper_settings database
  const logoUrl = paperSettings?.logo_url || paperSettings?.logoUrl || '/favicon.png';
  const stampUrl = paperSettings?.stamp_url || paperSettings?.stampUrl;
  const signatureUrl = paperSettings?.signature_url || paperSettings?.signatureUrl;
  const headerImageUrl = paperSettings?.header_image_url || paperSettings?.headerImageUrl;
  const companyName = paperSettings?.company_name || paperSettings?.companyName || 'AB MALAYA SDN. BHD.';
  const companyAddress = paperSettings?.company_address || paperSettings?.companyAddress;
  const companyEmail = paperSettings?.email || paperSettings?.companyEmail || 'sales@abmalaya.com';
  const companyPhone = paperSettings?.phone || paperSettings?.companyPhone || '+60 3-8000 1234';
  const companyWebsite = paperSettings?.website || paperSettings?.companyWebsite || 'abmalaya.com';
  const tableHeaderBgColor = paperSettings?.table_header_bg || paperSettings?.tableHeaderBg || '#0070c0';
  const headerTitle = paperSettings?.header_title || paperSettings?.headerTitle || 'OFFICIAL COMMERCIAL QUOTATION (SPH)';

  const renderDynamicAddress = (addrRaw?: string) => {
    const defaultAddress = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
    const clean = (addrRaw && addrRaw.trim()) ? addrRaw.trim() : defaultAddress;

    if (clean.includes('\n')) {
      const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.map((line, idx) => (
        <p key={idx} style={{ margin: 0, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? '#0f172a' : '#1e293b', fontSize: idx === 0 ? '8.5pt' : '8pt' }}>
          {line}
        </p>
      ));
    }

    const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const line1 = parts.slice(0, 2).join(', ') + ',';
      const line2 = parts.slice(2, parts.length - 1).join(', ') + ',';
      const line3 = parts[parts.length - 1];
      return (
        <>
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '8.5pt' }}>{line1}</p>
          <p style={{ margin: 0, color: '#1e293b', fontSize: '8pt' }}>{line2}</p>
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '8pt' }}>{line3}</p>
        </>
      );
    }

    return <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '8pt' }}>{clean}</p>;
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
    <div id="quotation-screen-container" className="w-full max-w-full bg-slate-300 min-h-[calc(100vh-53px)] space-y-0 font-sans overflow-y-auto h-full relative pb-24">
      
      {/* ── EXACT A4 PRINT STYLES (MATCHES ALL PAGES WITHOUT VIEWPORT CLIPPING) ── */}
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
          #quotation-screen-container, #quotation-paper-wrapper {
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
          .items-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .bottom-grid {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .signatures-grid {
            display: flex !important;
            justify-content: flex-end !important;
            align-items: flex-end !important;
            width: 100% !important;
            margin-left: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sig-issuer-box {
            width: 250px !important;
            max-width: 280px !important;
            margin-left: auto !important;
            margin-right: 0 !important;
            text-align: right !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-end !important;
            justify-content: flex-end !important;
          }
          .sig-img-container {
            height: 55px !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            margin-left: auto !important;
            margin-right: 0 !important;
            width: 100% !important;
            text-align: right !important;
          }
          .sig-img-container img {
            display: inline-block !important;
            margin-left: auto !important;
            margin-right: 0 !important;
            max-height: 50px !important;
            max-width: 120px !important;
            object-fit: contain !important;
          }
        }

        /* METADATA SECTION */
        .meta-table {
          width: 100%;
          border-collapse: collapse;
        }
        .meta-table td {
          padding: 2px 0;
          font-size: 8.5pt;
          vertical-align: top;
        }
        .meta-label {
          width: 140px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
        }
        .meta-colon {
          width: 12px;
          font-weight: 700;
          color: #0f172a;
        }
        .meta-val {
          font-weight: 600;
          color: #0f172a;
        }
        .meta-val-bold {
          font-weight: 800;
          color: #0f172a;
        }

        /* ITEMS TABLE */
        .items-table-box {
          border: 1px solid #0f172a;
          margin-bottom: 8px;
          background: #ffffff;
          width: 100%;
          box-sizing: border-box;
        }
        .items-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 7.5pt;
          box-sizing: border-box;
        }
        .items-table th {
          background-color: ${tableHeaderBgColor};
          color: #ffffff;
          font-weight: 800;
          font-size: 7.5pt;
          text-transform: uppercase;
          padding: 4px 3px;
          border-right: 1px solid #0f172a;
          border-bottom: 1px solid #0f172a;
          text-align: left;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .items-table th:last-child {
          border-right: none;
        }
        .items-table td {
          padding: 4px 4px;
          border-right: 1px solid #0f172a;
          border-bottom: 1px solid #0f172a;
          vertical-align: top;
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
          max-height: 140px !important;
          object-fit: contain !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 3px !important;
          background-color: #ffffff !important;
          padding: 2px !important;
          margin-top: 4px !important;
          display: block !important;
        }
        .product-photo {
          width: 26px;
          height: 26px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          display: block;
          margin: 0 auto;
        }
        .no-photo-box {
          width: 26px;
          height: 26px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 7pt;
          margin: 0 auto;
        }

        /* BOTTOM TERMS & FINANCIAL SUMMARY */
        .bottom-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }
        .terms-container {
          flex: 1;
          font-size: 7.5pt;
        }
        .terms-header {
          font-size: 7.5pt;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #0f172a;
          padding-bottom: 2px;
          margin-bottom: 3px;
        }
        .terms-content {
          color: #334155;
          white-space: pre-line;
          line-height: 1.3;
        }
        .summary-box {
          width: 260px;
          border: 2px solid #0f172a;
          padding: 8px;
          background: #ffffff;
          font-size: 7.5pt;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
          color: #334155;
        }
        .summary-row.grand-total {
          border-top: 2px solid #0f172a;
          padding-top: 4px;
          margin-bottom: 0;
          font-weight: 900;
          font-size: 9.5pt;
          color: #0f172a;
        }

        /* SIGNATURES GRID */
        .signatures-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
          margin-top: 10px;
          font-size: 7.5pt;
          gap: 12px;
        }
        .sig-client-box {
          flex: 1;
        }
        .sig-client-line {
          height: 45px;
          border-bottom: 1px solid #94a3b8;
          width: 170px;
          margin-bottom: 3px;
        }
        .sig-issuer-box {
          flex: 1;
          text-align: right;
        }
        .sig-img-container {
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          margin: 2px 0;
        }
        .sig-img-container img {
          max-height: 48px;
          max-width: 120px;
          object-fit: contain;
        }
      `}</style>

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
                  href={`/view_doc.php?type=quotation&id=${quotation.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsLeftQuoDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Open Live Template (view_doc.php)</span>
                </a>

                <a
                  href={`/api_pdf.php?action=download&type=quotation&id=${quotation.id}${getSessionUserParams()}`}
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
                  disabled={isPrintingDirect}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-slate-50 font-semibold cursor-pointer text-left border-t border-slate-100 transition disabled:opacity-60"
                >
                  {isPrintingDirect ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>{isPrintingDirect ? 'Menyiapkan Cetak...' : 'Direct Print (Exact Preview)'}</span>
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
              {isLoadingQuotations ? '-- Loading Quotations... --' : '-- Select Saved SPH / Quotation --'}
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
            <span>{isEditDocMode ? 'Editing Mode Active' : 'Edit Document'}</span>
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
            href={`/api_pdf.php?action=download&type=quotation&id=${quotation.id}${getSessionUserParams()}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              fetch(`/api_pdf.php?action=generate&type=quotation&id=${quotation.id}${getSessionUserParams()}`).catch(() => {});
            }}
            className="flex items-center gap-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs px-3.5 py-1.5 transition cursor-pointer shadow-md rounded border border-blue-900"
            title="Download Full PDF generated by Puppeteer daemon engine"
          >
            <FileType className="w-4 h-4 text-white" />
            <span>Download PDF</span>
          </a>

          <button
            onClick={handlePrint}
            disabled={isPrintingDirect}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-1.5 transition cursor-pointer shadow-md rounded border border-emerald-800 disabled:opacity-60"
            title="Print entire document to printer / browser PDF dialog"
          >
            {isPrintingDirect ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Printer className="w-4 h-4 text-white" />
            )}
            <span>{isPrintingDirect ? 'Menyiapkan...' : 'Direct Print (PDF)'}</span>
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
            className="ml-3 bg-white text-amber-900 px-2 py-0.5 rounded text-[11px] font-black uppercase hover:bg-amber-50 transition cursor-pointer"
          >
            Finish Editing
          </button>
        </div>
      )}

      {/* DRAG MODE ACTIVE BANNER NOTICE */}
      {isDragMode && (
        <div className="no-print bg-blue-700 text-white text-xs font-bold px-4 py-2.5 text-center shadow-lg flex flex-wrap items-center justify-between gap-3 sticky top-[49px] z-30 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-blue-200 animate-bounce shrink-0" />
            <span>DRAG & RESIZE MODE ACTIVE: Drag elements or adjust size (scale) of logo & text on the quotation!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveLayout()}
              disabled={isSavingLayout}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              title="Save current layout positions to database"
            >
              {isSavingLayout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSavingLayout ? 'Saving...' : 'Save Layout'}</span>
            </button>
            <button
              type="button"
              onClick={handleDoneDragMode}
              disabled={isSavingLayout}
              className="bg-white hover:bg-slate-100 active:scale-95 text-blue-900 px-3.5 py-1.5 rounded text-xs font-extrabold uppercase transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Done and auto-save element positions"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Done & Save</span>
            </button>
            {Object.keys(offsets).length > 0 && (
              <button
                type="button"
                onClick={handleResetLayout}
                className="bg-rose-500/80 hover:bg-rose-600 active:scale-95 text-white px-2.5 py-1.5 rounded text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                title="Reset all element positions to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* FLOATING SUCCESS NOTIFICATION TOAST */}
      {layoutSaveNotice && (
        <div className="no-print fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-emerald-500 shadow-2xl px-4 py-3 rounded-lg flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{layoutSaveNotice}</span>
        </div>
      )}

      {/* ── PAGINATED A4 SHEETS CANVAS (PAGE 1, PAGE 2, ETC.) ──────────────────── */}
      <div id="quotation-paper-wrapper" className="p-4 sm:p-8 w-full max-w-full flex flex-col items-center justify-start space-y-8 overflow-x-auto">
        
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
                minHeight: '297mm',
                boxSizing: 'border-box',
                paddingTop: `${modalMarginTop}mm`,
                paddingBottom: `${modalMarginBottom}mm`,
                paddingLeft: `${modalMarginLeft}mm`,
                paddingRight: `${modalMarginRight}mm`,
                fontSize: `${modalFontSize}pt`,
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
                          <DraggableElement id="header_logo" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Logo" resizable={true}>
                            {isLoadingPaperSettings ? (
                              <div className="h-10 w-28 bg-white/90 border border-slate-300 flex items-center justify-center gap-2 text-xs text-blue-700 font-mono font-bold animate-pulse">
                                <Loader2 className="w-3 animate-spin text-blue-600" />
                                <span>Loading...</span>
                              </div>
                            ) : logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={companyName}
                                style={{ height: '44px', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/favicon.png';
                                }}
                              />
                            ) : (
                              <div style={{ fontWeight: 900, fontSize: '15pt', color: '#004f8b', textTransform: 'uppercase' }}>
                                {companyName}
                              </div>
                            )}
                          </DraggableElement>
                        </td>

                        {/* Company Address Right */}
                        <td style={{ width: '45%', verticalAlign: 'bottom', textAlign: 'right', padding: 0, border: 'none', fontSize: '7.5pt', lineHeight: 1.25, color: '#1e293b' }}>
                          <DraggableElement id="header_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Company Address">
                            {renderDynamicAddress(companyAddress)}
                          </DraggableElement>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* METADATA & TITLE STRIP BANNER (Page 1 Only) */}
                {chunk.isFirstPage && (
                  <>
                    <DraggableElement id="metadata_section" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Metadata Section">
                      <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px' }}>
                        <table className="meta-table">
                          <tbody>
                            <tr>
                              <td className="meta-label">Ref No.</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val-bold font-mono">
                                {isEditDocMode ? (
                                  <input
                                    type="text"
                                    value={docRefNo}
                                    onChange={(e) => setDocRefNo(e.target.value)}
                                    className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                                  />
                                ) : (
                                  docRefNo
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="meta-label">Date</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val font-mono">
                                {isEditDocMode ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="date"
                                      value={docDateIssued}
                                      onChange={(e) => setDocDateIssued(e.target.value)}
                                      className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs focus:outline-blue-500"
                                    />
                                    <span className="text-slate-600 font-semibold">(Valid:</span>
                                    <input
                                      type="text"
                                      value={docValidUntil}
                                      onChange={(e) => setDocValidUntil(e.target.value)}
                                      className="font-mono font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs w-20 focus:outline-blue-500"
                                      placeholder="14 Days"
                                    />
                                    <span className="text-slate-600 font-semibold">)</span>
                                  </div>
                                ) : (
                                  `${formatDocDate(docDateIssued)} (Valid: ${docValidUntil})`
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="meta-label">Project Reference</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val">
                                {isEditDocMode ? (
                                  <input
                                    type="text"
                                    value={docProjectReference}
                                    onChange={(e) => setDocProjectReference(e.target.value)}
                                    className="font-semibold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-full focus:outline-blue-500"
                                    placeholder="Project reference name or specification"
                                  />
                                ) : (
                                  docProjectReference || '—'
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="meta-label">Attention</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val-bold">
                                {isEditDocMode ? (
                                  <div className="flex items-center gap-2 w-full">
                                    <input
                                      type="text"
                                      value={docClientName}
                                      onChange={(e) => setDocClientName(e.target.value)}
                                      className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs flex-1 focus:outline-blue-500"
                                      placeholder="Client Contact Name"
                                    />
                                    <span className="text-slate-500 font-bold">(</span>
                                    <input
                                      type="text"
                                      value={docCompanyName}
                                      onChange={(e) => setDocCompanyName(e.target.value)}
                                      className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs flex-1 focus:outline-blue-500"
                                      placeholder="Company Name"
                                    />
                                    <span className="text-slate-500 font-bold">)</span>
                                  </div>
                                ) : (
                                  `${docClientName} ${docCompanyName ? `(${docCompanyName})` : ''}`
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="meta-label">Tel No.</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val font-mono">
                                {isEditDocMode ? (
                                  <input
                                    type="text"
                                    value={docClientPhone}
                                    onChange={(e) => setDocClientPhone(e.target.value)}
                                    className="font-mono text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                                    placeholder="+60 12-345 6789"
                                  />
                                ) : (
                                  docClientPhone || '—'
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="meta-label">Email</td>
                              <td className="meta-colon">:</td>
                              <td className="meta-val font-mono">
                                {isEditDocMode ? (
                                  <input
                                    type="email"
                                    value={docClientEmail}
                                    onChange={(e) => setDocClientEmail(e.target.value)}
                                    className="font-mono text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-full max-w-sm focus:outline-blue-500"
                                    placeholder="client@company.com"
                                  />
                                ) : (
                                  docClientEmail || 'sales@abmalaya.com'
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </DraggableElement>

                    {/* Title Strip Banner */}
                    <DraggableElement id="title_banner" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Title Banner">
                      <div 
                        style={{
                          backgroundColor: tableHeaderBgColor,
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '9pt',
                          padding: '4px 10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          textAlign: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        {headerTitle}
                      </div>
                    </DraggableElement>

                    <p style={{ fontSize: '7.5pt', color: '#334155', fontWeight: 500, marginBottom: '6px' }}>
                      We would like to submit the following commercial quotation and specification list for your review and pricing:
                    </p>
                  </>
                )}

                {/* PRODUCT LINE ITEMS TABLE FOR THIS SHEET CHUNK */}
                <div className="items-table-box">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '4%', textAlign: 'center' }}>NO.</th>
                        <th style={{ width: '38%' }}>ITEM</th>
                        <th style={{ width: '6%', textAlign: 'center' }}>QTY</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>UNIT</th>
                        <th style={{ width: '20%' }}>OFFERED ITEM</th>
                        <th style={{ width: '11%', textAlign: 'right' }}>UNIT PRICE (MYR)</th>
                        <th style={{ width: isEditDocMode ? '10%' : '14%', textAlign: 'right' }}>TOTAL PRICE (MYR)</th>
                        {isEditDocMode && <th style={{ width: '4%', textAlign: 'center', background: '#be123c', color: '#ffffff' }}>DEL</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.items.map((item, localIdx) => {
                        const globalIdx = chunk.startIndex + localIdx;
                        const matchedCatalogProduct = findCatalogMatch(item.description);
                        const displayPhotoUrl = (item as any).image_url || matchedCatalogProduct?.image_url;
                        const specText = (item as any).specification || matchedCatalogProduct?.specification || matchedCatalogProduct?.description || 'Standard manufacturer specification';
                        const offeredItemText = (item as any).offer || (item as any).offered_item || (item as any).offer_name || '—';

                        return (
                          <tr key={item.id || globalIdx}>
                            <td style={{ textAlign: 'center' }} className="font-mono">{globalIdx + 1}</td>

                            {/* ITEM Column: Stacked Product Name, Specification, and Full-Width Photo */}
                            <td style={{ color: '#0f172a', verticalAlign: 'top' }}>
                              <div className="font-bold text-slate-900 leading-tight text-[8pt] mb-0.5">
                                {isEditDocMode ? (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => handleItemFieldChange(globalIdx, 'description', e.target.value)}
                                    className="w-full font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                    placeholder="Product description / name"
                                  />
                                ) : (
                                  item.description
                                )}
                              </div>

                              <div className="text-[7.5pt] text-slate-600 leading-snug font-sans mb-1">
                                {isEditDocMode ? (
                                  <textarea
                                    rows={2}
                                    value={(item as any).specification || ''}
                                    onChange={(e) => handleItemFieldChange(globalIdx, 'specification', e.target.value)}
                                    className="w-full text-slate-700 bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                    placeholder="Product specification text"
                                  />
                                ) : (
                                  specText
                                )}
                              </div>

                              {displayPhotoUrl && (
                                <div className="w-full mt-1">
                                  <DraggableElement id={`photo_${globalIdx}`} isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label={`Photo #${globalIdx + 1}`}>
                                    <img
                                      src={displayPhotoUrl}
                                      alt={item.description}
                                      className="product-photo-full"
                                    />
                                  </DraggableElement>
                                </div>
                              )}
                            </td>

                            {/* Quantity */}
                            <td style={{ textAlign: 'center' }} className="font-mono">
                              {isEditDocMode ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleItemFieldChange(globalIdx, 'quantity', Number(e.target.value))}
                                  className="w-10 text-center font-mono font-normal bg-amber-50/70 border border-amber-300 px-0.5 py-0.5 rounded text-xs focus:outline-blue-500"
                                />
                              ) : (
                                item.quantity
                              )}
                            </td>

                            {/* Unit */}
                            <td style={{ textAlign: 'center' }}>
                              {isEditDocMode ? (
                                <input
                                  type="text"
                                  value={item.unit || 'Unit'}
                                  onChange={(e) => handleItemFieldChange(globalIdx, 'unit', e.target.value)}
                                  className="w-12 text-center bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                />
                              ) : (
                                item.unit || 'Unit'
                              )}
                            </td>

                            {/* Offered Item / Name Offered */}
                            <td style={{ color: '#0f172a', verticalAlign: 'top' }}>
                              {isEditDocMode ? (
                                <textarea
                                  rows={2}
                                  value={(item as any).offer || (item as any).offered_item || ''}
                                  onChange={(e) => handleItemFieldChange(globalIdx, 'offer', e.target.value)}
                                  className="w-full text-slate-800 bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                  placeholder="Name offered / alternative item"
                                />
                              ) : (
                                offeredItemText
                              )}
                            </td>

                            {/* Unit Price */}
                            <td style={{ textAlign: 'right' }} className="font-mono">
                              {isEditDocMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemFieldChange(globalIdx, 'unit_price', Number(e.target.value))}
                                  className="w-20 text-right font-mono font-bold bg-amber-50/70 border border-amber-300 px-1 py-0.5 rounded text-xs focus:outline-blue-500"
                                />
                              ) : (
                                (Number(item.unit_price) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              )}
                            </td>

                            {/* Total Price */}
                            <td style={{ textAlign: 'right' }} className="font-mono font-bold">
                              {(Number(item.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Action Delete Row button in Edit Mode */}
                            {isEditDocMode && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItemRow(globalIdx)}
                                  className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded transition cursor-pointer"
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

                  {/* ADD ROW BUTTON IN EDIT MODE (Last Sheet Only) */}
                  {isEditDocMode && chunk.isLastPage && (
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

                {/* CLOSING BLOCK (Last Sheet Only) — Directly follows table in natural flow */}
                {chunk.isLastPage && (
                  <div style={{ width: '100%', paddingTop: '8px' }}>
                    {/* TERMS & CONDITIONS + FINANCIAL SUMMARY */}
                    <div className="bottom-grid">
                      {/* Terms & Conditions */}
                      <DraggableElement id="terms_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Terms & Conditions" className="terms-container">
                        <div className="terms-header">TERMS & CONDITIONS:</div>
                        <div className="terms-content">
                          {isEditDocMode ? (
                            <textarea
                              rows={3}
                              value={docNotes}
                              onChange={(e) => setDocNotes(e.target.value)}
                              className="w-full font-sans text-xs bg-amber-50/70 border border-amber-300 p-1.5 rounded focus:outline-blue-500 leading-relaxed"
                              placeholder="1. Prices stated in MYR..."
                            />
                          ) : (
                            docNotes
                          )}
                        </div>
                      </DraggableElement>

                      {/* Financial Summary Box */}
                      <DraggableElement id="summary_box" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Financial Summary" className="summary-box">
                        <div className="summary-row">
                          <span style={{ fontWeight: 600 }}>GROSS SUBTOTAL:</span>
                          <span className="font-mono font-bold">{formatCurrency(financialTotals.subtotal)}</span>
                        </div>

                        {financialTotals.discountTotal > 0 && (
                          <div className="summary-row" style={{ color: '#b45309' }}>
                            <span style={{ fontWeight: 600 }}>TOTAL DISCOUNT:</span>
                            <span className="font-mono font-bold">-{formatCurrency(financialTotals.discountTotal)}</span>
                          </div>
                        )}

                        <div className="summary-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                            <span>VAT TAX (</span>
                            {isEditDocMode ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={docTaxPercent}
                                onChange={(e) => setDocTaxPercent(Number(e.target.value))}
                                className="w-8 text-center font-mono bg-amber-50/70 border border-amber-300 px-0.5 py-0.2 rounded text-xs"
                              />
                            ) : (
                              <span>{docTaxPercent}</span>
                            )}
                            <span>%):</span>
                          </div>
                          <span className="font-mono font-bold">{formatCurrency(financialTotals.taxAmount)}</span>
                        </div>

                        <div className="summary-row grand-total">
                          <span>GRAND TOTAL:</span>
                          <span className="font-mono" style={{ color: '#0070c0' }}>{formatCurrency(financialTotals.grandTotal)}</span>
                        </div>
                      </DraggableElement>
                    </div>

                    {/* ISSUER AUTHORIZATION SIGNATURE BLOCK */}
                    <div className="signatures-grid" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', width: '100%', marginTop: '8px' }}>
                      <DraggableElement id="signature_issuer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Issuer Signatory" className="sig-issuer-box" style={{ textAlign: 'right', marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <p style={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', fontSize: '7pt', letterSpacing: '0.5px', textAlign: 'right' }}>
                          Yours faithfully,
                        </p>
                        <p style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontSize: '8pt', marginTop: '1px', textAlign: 'right' }}>
                          {companyName}
                        </p>

                        <div className="sig-img-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginLeft: 'auto', textAlign: 'right', width: 'auto', margin: '4px 0 4px auto' }}>
                          {stampUrl && (
                            <img
                              src={formatAssetUrl(stampUrl)}
                              alt="Company Stamp"
                              style={{ display: 'inline-block', maxHeight: '52px', maxWidth: '130px', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          {signatureUrl && (
                            <img
                              src={formatAssetUrl(signatureUrl)}
                              alt="Digital Signature"
                              style={{ display: 'inline-block', maxHeight: '52px', maxWidth: '130px', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          {!signatureUrl && !stampUrl && (
                            <div style={{ width: '100px', height: '35px', border: '2px dashed #0070c0', color: '#0070c0', fontSize: '7pt', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', marginLeft: 'auto' }}>
                              [STAMP & SIGNATURE]
                            </div>
                          )}
                        </div>

                        {isEditDocMode ? (
                          <input
                            type="text"
                            value={docCreatedBy}
                            onChange={(e) => setDocCreatedBy(e.target.value)}
                            className="font-bold text-slate-900 bg-amber-50/70 border border-amber-300 px-1.5 py-0.5 rounded text-xs text-right w-48 focus:outline-blue-500"
                            placeholder="Signatory Name"
                          />
                        ) : (
                          <p style={{ fontWeight: 800, color: '#0f172a', marginTop: '1px', fontSize: '7.5pt', textAlign: 'right' }}>
                            <u>{docCreatedBy || 'Muhammad Aimanuddin Bin Mohd Zaki'}</u>
                          </p>
                        )}
                        <p className="font-mono" style={{ color: '#64748b', fontSize: '7pt', textTransform: 'uppercase', textAlign: 'right' }}>
                          HEAD OF SALES & LOGISTICS
                        </p>
                      </DraggableElement>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTTOM FOOTER (Repeats on every sheet at bottom) */}
              <DraggableElement id="footer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Footer" className="mt-auto w-full">
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
                            {companyName}
                          </span>
                          {isEditDocMode ? (
                            <input
                              type="text"
                              value={docFooterText}
                              onChange={(e) => setDocFooterText(e.target.value)}
                              placeholder={paperSettings?.footer_text || paperSettings?.footerText || `${companyEmail}, ${companyPhone}, ${companyWebsite}`}
                              className="ml-1.5 px-1 py-0.5 text-[7pt] bg-amber-50 border border-amber-300 rounded text-slate-800 focus:outline-blue-500 w-80 font-mono"
                              title="Edit Quotation Footer Running Text"
                            />
                          ) : (
                            <span style={{ marginLeft: '6px', fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                              ({docFooterText || paperSettings?.footer_text || paperSettings?.footerText || `${companyEmail}, ${companyPhone}, ${companyWebsite}`})
                            </span>
                          )}
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

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Default SPH Footer Running Text (Bottom Sheet)</label>
                <input
                  type="text"
                  value={modalFooterText}
                  onChange={(e) => setModalFooterText(e.target.value)}
                  placeholder="sales@abmalaya.com, +60 3-8000 1234, abmalaya.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Default SPH Terms & Conditions (Above Signatures)</label>
                <textarea
                  rows={2}
                  value={modalFooterTerms}
                  onChange={(e) => setModalFooterTerms(e.target.value)}
                  placeholder="1. 50% DP payment required after PO is issued..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-sans focus:outline-blue-500"
                />
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

      {/* ── STICKY / FLOATING QUICK ACTION BAR (ALWAYS VISIBLE DURING SCROLLING) ── */}
      <div className="no-print fixed bottom-5 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-white animate-in fade-in slide-in-from-bottom-2">
        <div className="text-[11px] font-mono text-slate-300 pr-2 border-r border-slate-700 hidden sm:block">
          <span>SPH: </span>
          <strong className="text-white">{docRefNo || 'QUO'}</strong>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrintingDirect}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-lg transition cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-60"
          title="Print entire document to printer or save as PDF"
        >
          {isPrintingDirect ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Printer className="w-4 h-4 text-white" />
          )}
          <span>{isPrintingDirect ? 'Preparing...' : 'Direct Print (PDF)'}</span>
        </button>

        <a
          href={`/api_pdf.php?action=download&type=quotation&id=${quotation.id}${getSessionUserParams()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            fetch(`/api_pdf.php?action=generate&type=quotation&id=${quotation.id}${getSessionUserParams()}`).catch(() => {});
          }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-lg transition cursor-pointer hover:scale-105 active:scale-95"
          title="Download full PDF generated by Puppeteer engine"
        >
          <FileType className="w-4 h-4 text-white" />
          <span>Download Full PDF</span>
        </a>

        <a
          href={`/view_doc.php?type=quotation&id=${quotation.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-600 transition cursor-pointer"
          title="Open original view_doc.php template in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden md:inline">Live Template</span>
        </a>
      </div>

    </div>
  );
};

export default QuotationDoc;
