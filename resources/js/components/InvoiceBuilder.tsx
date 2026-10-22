import React, { useState, useEffect, useMemo } from 'react';
import { Quotation, InvoiceItem } from '../types/erp';
import { 
  Printer, Send, ArrowLeft, ChevronDown, FileText, Settings, Loader2, Save, CheckCircle2, Building2, Move, RotateCcw, Plus, Download, ExternalLink, Eye, SlidersHorizontal, X, Trash2, UserPlus, HelpCircle, Receipt, CreditCard, ShieldCheck, BookOpen, Layers
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
  disableScaleTransform?: boolean;
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
  disableScaleTransform = false,
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
    transform: disableScaleTransform
      ? `translate(${currentOffset.x || 0}px, ${currentOffset.y || 0}px)`
      : `translate(${currentOffset.x || 0}px, ${currentOffset.y || 0}px) scale(${currentScale})`,
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
  paperSettings: _propInvoiceSettings,
}) => {
  const [completedQuotations, setCompletedQuotations] = useState<Quotation[]>(memoizedCompletedQuotationsInv);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(memoizedCompletedQuotationsInv.length === 0);
  const [selectedQuoId, setSelectedQuoId] = useState<string>('');
  
  const [savedInvoices, setSavedInvoices] = useState<any[]>(memoizedSavedInvoicesInv);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(memoizedSavedInvoicesInv.length === 0);
  const [selectedSavedInvoiceId, setSelectedSavedInvoiceId] = useState<string>(initialInvoice?.id || '');

  const [invoiceSettings, setInvoiceSettings] = useState<any>(memoizedInvoiceSettingsInv || null);
  const [isLoadingInvoiceSettings, setIsLoadingInvoiceSettings] = useState<boolean>(!memoizedInvoiceSettingsInv);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isRightActionsDropdownOpen, setIsRightActionsDropdownOpen] = useState<boolean>(false);
  const [isDocPreviewMode, setIsDocPreviewMode] = useState<boolean>(false);

  // User Guide / SOP Invoice Modal State (!)
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [guideTab, setGuideTab] = useState<'workflow' | 'fields' | 'payment' | 'faq'>('workflow');

  // Drag Mode & Element Offsets State
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [offsets, setOffsets] = useState<Record<string, OffsetData>>({});
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [layoutSaveNotice, setLayoutSaveNotice] = useState<string | null>(null);

  const handleOffsetChange = (id: string, newOffset: OffsetData) => {
    setOffsets((prev) => ({ ...prev, [id]: newOffset }));
  };

  const handleSaveLayout = (targetOffsets?: Record<string, OffsetData>) => {
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
          setLayoutSaveNotice('✓ Invoice layout & element positions saved permanently!');
          setTimeout(() => setLayoutSaveNotice(null), 3500);
        }
      })
      .catch((err) => {
        setIsSavingLayout(false);
        console.error('Error saving invoice layout offsets:', err);
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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
  const [isGeneratingPdfPreview, setIsGeneratingPdfPreview] = useState<boolean>(false);
  const [isPaperSetupModalOpen, setIsPaperSetupModalOpen] = useState<boolean>(false);

  // Paper & Header Setup Modal Form Fields
  const [modalPaperSize, setModalPaperSize] = useState<string>('A4');
  const [modalMarginTop, setModalMarginTop] = useState<number>(18);
  const [modalMarginBottom, setModalMarginBottom] = useState<number>(18);
  const [modalMarginLeft, setModalMarginLeft] = useState<number>(14);
  const [modalMarginRight, setModalMarginRight] = useState<number>(14);
  const [modalFontSize, setModalFontSize] = useState<number>(9);
  const [modalTableHeaderBg, setModalTableHeaderBg] = useState<string>('#0070c0');
  const [modalCompanyName, setModalCompanyName] = useState<string>('AB MALAYA INDUSTRY');
  const [modalCompanyRegNo, setModalCompanyRegNo] = useState<string>('003320457-D');
  const [modalCompanyAddress, setModalCompanyAddress] = useState<string>('2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.');
  const [modalPhone, setModalPhone] = useState<string>('+60 3-8000 1234');
  const [modalEmail, setModalEmail] = useState<string>('abmalayaindustry@gmail.com');
  const [modalWebsite, setModalWebsite] = useState<string>('abmalaya.com');
  const [modalInvoiceTitle, setModalInvoiceTitle] = useState<string>('OFFICIAL INVOICE');
  const [modalFooterText, setModalFooterText] = useState<string>('');
  const [isSavingPaperSetup, setIsSavingPaperSetup] = useState<boolean>(false);
  const [headerImageHeight, setHeaderImageHeight] = useState<number | null>(null);

  useEffect(() => {
    const bannerUrl = invoiceSettings?.header_image_url || invoiceSettings?.headerImageUrl;
    if (bannerUrl) {
      const img = new Image();
      img.onload = () => {
        if (img.width > 0) {
          const aspect = img.height / img.width;
          const calcH = Math.round(700 * aspect);
          setHeaderImageHeight(calcH);
        }
      };
      img.src = formatAssetUrl(bannerUrl);
    } else {
      setHeaderImageHeight(null);
    }
  }, [invoiceSettings?.header_image_url, invoiceSettings?.headerImageUrl]);
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
  const [footerText, setFooterText] = useState<string>(initialInvoice?.footer_text || '');
  const [status] = useState<string>(initialInvoice?.status || 'unpaid');

  // Received By (Client Signatory) State
  const [receivedByName, setReceivedByName] = useState<string>(initialInvoice?.received_by_name || '');
  const [receivedByDesignation, setReceivedByDesignation] = useState<string>(initialInvoice?.received_by_designation || '');
  const [receivedByDate, setReceivedByDate] = useState<string>(initialInvoice?.received_by_date || '');
  const [companySignatories, setCompanySignatories] = useState<any[]>([]);
  const [isAddSignatoryModalOpen, setIsAddSignatoryModalOpen] = useState<boolean>(false);
  const [sigTargetCompany, setSigTargetCompany] = useState<string>('');
  const [allClientCompanies, setAllClientCompanies] = useState<Array<{ id?: number; company_name: string; client_name?: string }>>([]);
  const [newSigName, setNewSigName] = useState<string>('');
  const [newSigDesignation, setNewSigDesignation] = useState<string>('');
  const [isNewSigDefault, setIsNewSigDefault] = useState<boolean>(true);
  const [isSavingNewSig, setIsSavingNewSig] = useState<boolean>(false);
  const [isCustomSigMode, setIsCustomSigMode] = useState<boolean>(false);

  // Auto-fetch signatories for current company
  const fetchCompanySignatories = (comp: string) => {
    if (!comp || comp.trim() === '') {
      setCompanySignatories([]);
      return;
    }
    fetch(getApiUrl(`/api_clients.php?action=signatories&company_name=${encodeURIComponent(comp.trim())}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          setCompanySignatories(data.data);
        }
      })
      .catch((err) => {
        console.error('Error fetching company signatories:', err);
      });
  };

  // Fetch all registered companies for dropdown selection in modal
  const fetchAllCompanies = () => {
    fetch(getApiUrl('/api_clients.php'))
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          const comps: Array<{ id?: number; company_name: string; client_name?: string }> = [];
          const seen = new Set<string>();
          data.data.forEach((c: any) => {
            const comp = String(c.company_name || '').trim();
            if (comp && !seen.has(comp.toLowerCase())) {
              seen.add(comp.toLowerCase());
              comps.push({ id: c.id, company_name: comp, client_name: c.client_name });
            }
          });
          setAllClientCompanies(comps);
        }
      })
      .catch((err) => {
        console.error('Error fetching client companies:', err);
      });
  };

  useEffect(() => {
    fetchAllCompanies();
  }, []);

  useEffect(() => {
    if (companyName) {
      fetchCompanySignatories(companyName);
    } else {
      setCompanySignatories([]);
    }
  }, [companyName]);

  const openAddSignatoryModal = () => {
    const currentComp = companyName.trim() || clientName.trim() || '';
    setSigTargetCompany(currentComp);
    setIsNewSigDefault(companySignatories.length === 0);
    setIsAddSignatoryModalOpen(true);
    fetchAllCompanies();
  };

  const handleAddNewSignatory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSigName.trim()) {
      alert('Nama PIC / Signatory wajib diisi!');
      return;
    }
    const targetComp = sigTargetCompany.trim() || companyName.trim() || clientName.trim() || 'Client Company';
    setIsSavingNewSig(true);
    try {
      const res = await fetch(getApiUrl('/api_clients.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_signatory',
          company_name: targetComp,
          name: newSigName.trim(),
          designation: newSigDesignation.trim(),
          is_default: isNewSigDefault ? 1 : 0
        }),
      });
      const data = await res.json();
      setIsSavingNewSig(false);
      if (data.status === 'success') {
        const savedSig = data.data || { name: newSigName.trim(), designation: newSigDesignation.trim(), company_name: targetComp };
        
        // If saved signatory belongs to current invoice company, set active & update local dropdown list
        const activeInvoiceComp = (companyName.trim() || clientName.trim()).toLowerCase();
        if (targetComp.toLowerCase().trim() === activeInvoiceComp) {
          setReceivedByName(savedSig.name);
          setReceivedByDesignation(savedSig.designation || '');
          setIsCustomSigMode(false);
          setCompanySignatories((prev) => [...prev.filter((s) => s.id !== savedSig.id), savedSig]);
        }
        
        setNewSigName('');
        setNewSigDesignation('');
        setIsAddSignatoryModalOpen(false);
        fetchAllCompanies();
        if (companyName) {
          fetchCompanySignatories(companyName);
        }
      } else {
        alert(data.message || 'Failed to save signatory');
      }
    } catch (err: any) {
      setIsSavingNewSig(false);
      alert('Failed to save signatory: ' + (err?.message || 'Network error'));
    }
  };

  // Auto-recalculate subtotal, tax amount, and grand total whenever items, tax, or discount change
  useEffect(() => {
    const newSub = items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const itemTot = item.total !== undefined ? Number(item.total) : (qty * price);
      return acc + itemTot;
    }, 0);
    setSubtotal(newSub);
    const newTax = (newSub * (taxPercent || 0)) / 100;
    setTaxAmount(newTax);
    setGrandTotal(newSub - (discountTotal || 0) + newTax);
  }, [items, taxPercent, discountTotal]);

  // Item Table Handlers
  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const currentItem = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : (Number(currentItem.quantity) || 0);
        const price = field === 'unit_price' ? Number(value) : (Number(currentItem.unit_price) || 0);
        currentItem.total = qty * price;
      }
      updated[index] = currentItem;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: 'New Product / Item Description',
        specification: '',
        quantity: 1,
        unit: 'Unit',
        unit_price: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to compute visual height weight of an invoice item based on text length & photos
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
    if (!items || items.length === 0) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        items: [],
        startIndex: 0,
        isFirstPage: true,
        isLastPage: true,
      }];
    }

    const itemWeights = items.map(getItemHeightWeight);
    const totalWeight = itemWeights.reduce((a, b) => a + b, 0);

    // Capacity thresholds in weight units (1 unit ≈ 1 regular single-line row):
    // - Single page: Header + 2-Column Addresses + Items + Bank Remarks + Totals + Signatures + Footer
    const SINGLE_PAGE_MAX_WEIGHT = 6.0;
    // - Page 1 of multi-page: Header + 2-Column Addresses + Items (NO bottom bank/signatures)
    const PAGE1_MULTIPAGE_MAX_WEIGHT = 11.0;
    // - Middle continuation page: Header + Items only
    const MIDDLE_PAGE_MAX_WEIGHT = 16.5;
    // - Last page of multi-page: Header + Items + Bank Remarks + Totals + Signatures + Footer
    const LAST_PAGE_MAX_WEIGHT = 8.0;

    if (totalWeight <= SINGLE_PAGE_MAX_WEIGHT && items.length <= 6) {
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
    let currentIdx = 0;
    let pageNum = 1;

    while (currentIdx < items.length) {
      const isFirst = pageNum === 1;
      const remainingItems = items.slice(currentIdx);
      const remainingWeight = itemWeights.slice(currentIdx).reduce((a, b) => a + b, 0);

      // Check if all remaining items fit comfortably on the current page as the LAST page
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

      // Otherwise, pack items up to page capacity (as a non-last page)
      const currentMaxWeight = isFirst ? PAGE1_MULTIPAGE_MAX_WEIGHT : MIDDLE_PAGE_MAX_WEIGHT;
      let accumWeight = 0;
      let count = 0;

      while (currentIdx + count < items.length) {
        const nextWeight = itemWeights[currentIdx + count];
        if (count > 0 && accumWeight + nextWeight > currentMaxWeight) {
          break;
        }
        accumWeight += nextWeight;
        count++;
      }

      const pageItems = items.slice(currentIdx, currentIdx + count);
      pages.push({
        pageNumber: pageNum,
        totalPages: 0,
        items: pageItems,
        startIndex: currentIdx,
        isFirstPage: isFirst,
        isLastPage: currentIdx + count >= items.length,
      });

      currentIdx += count;
      pageNum++;
    }

    const total = pages.length;
    pages.forEach(p => p.totalPages = total);
    return pages;
  }, [items]);

  // Always fetch fresh invoice settings from dedicated MySQL table (system_invoice_settings) on mount & reload
  const fetchLiveInvoiceSettings = () => {
    setIsLoadingInvoiceSettings(true);
    fetch(getApiUrl(`/api_invoice_settings.php?t=${Date.now()}`))
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingInvoiceSettings(false);
        if (data.status === 'success' && data.data) {
          memoizedInvoiceSettingsInv = data.data;
          setInvoiceSettings(data.data);
          if (data.data.company_name) setModalCompanyName(data.data.company_name);
          if (data.data.company_reg_no) setModalCompanyRegNo(data.data.company_reg_no);
          if (data.data.company_address) setModalCompanyAddress(data.data.company_address);
          if (data.data.phone) setModalPhone(data.data.phone);
          if (data.data.email) setModalEmail(data.data.email);
          if (data.data.website) setModalWebsite(data.data.website);
          if (data.data.invoice_title) setModalInvoiceTitle(data.data.invoice_title);
          if (data.data.footer_text) setModalFooterText(data.data.footer_text);
          if (data.data.paper_size) setModalPaperSize(data.data.paper_size);
          if (data.data.margin_top !== undefined) setModalMarginTop(Number(data.data.margin_top));
          if (data.data.margin_bottom !== undefined) setModalMarginBottom(Number(data.data.margin_bottom));
          if (data.data.margin_left !== undefined) setModalMarginLeft(Number(data.data.margin_left));
          if (data.data.margin_right !== undefined) setModalMarginRight(Number(data.data.margin_right));
          if (data.data.font_size !== undefined) setModalFontSize(Number(data.data.font_size));
          if (data.data.table_header_bg) setModalTableHeaderBg(data.data.table_header_bg);
        }
      })
      .catch((err) => {
        setIsLoadingInvoiceSettings(false);
        console.error('Error fetching live invoice settings:', err);
      });
  };

  useEffect(() => {
    fetchLiveInvoiceSettings();
  }, []);

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

    setReceivedByName(inv.received_by_name || '');
    setReceivedByDesignation(inv.received_by_designation || '');
    setReceivedByDate(inv.received_by_date || '');
    setFooterText(inv.footer_text || '');
    setIsCustomSigMode(false);

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
    setReceivedByName('');
    setReceivedByDesignation('');
    setReceivedByDate('');
    setIsCustomSigMode(false);
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

    // Fallback: If quotation does not have company_address, auto-lookup from clients database
    if (!quo.company_address && quo.company_name) {
      fetch(getApiUrl(`/api_clients.php?search=${encodeURIComponent(quo.company_name.trim())}`))
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
            const matchedClient = data.data.find(
              (c: any) => c.company_name && c.company_name.toLowerCase().trim() === quo.company_name?.toLowerCase().trim()
            ) || data.data[0];
            
            const fullAddress = [
              matchedClient.address_line1,
              matchedClient.address_line2,
              [matchedClient.postal_code, matchedClient.city].filter(Boolean).join(' '),
              [matchedClient.state, matchedClient.country].filter(Boolean).join(', ')
            ].filter(Boolean).join('\n');
            
            if (fullAddress) {
              setBillingAddress((prev) => prev || fullAddress);
              setDeliveryAddress((prev) => prev || fullAddress);
            }
          }
        })
        .catch(() => {});
    }

    setReceivedByName((quo as any).received_by_name || '');
    setReceivedByDesignation((quo as any).received_by_designation || '');
    setReceivedByDate('');
    setIsCustomSigMode(false);

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

  const [isPrintingDirect, setIsPrintingDirect] = useState<boolean>(false);

  const handlePrint = async () => {
    setIsPrintingDirect(true);
    // 1. Auto-save current invoice to MySQL so all live inputs, items, remarks, and PIC are completely up to date
    try {
      await saveInvoicePayload(true);
    } catch (e) {
      console.warn('Auto-save before print warning:', e);
    }

    const docId = invoiceId || invoiceNumber || quotationId;
    const printUrl = getApiUrl(`/view_doc.php?type=invoice&id=${encodeURIComponent(docId)}&print=1&t=${Date.now()}`);

    // 2. Print via isolated hidden iframe loading exact preview mode template (view_doc.php)
    let printIframe = document.getElementById('direct-invoice-print-frame') as HTMLIFrameElement;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'direct-invoice-print-frame';
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

  const saveInvoicePayload = async (silent = false): Promise<boolean> => {
    if (!silent) setIsSaving(true);
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
      footer_text: footerText,
      received_by_name: receivedByName,
      received_by_designation: receivedByDesignation,
      received_by_date: receivedByDate,
      status: status,
      items: items,
    };

    try {
      const res = await fetch(getApiUrl('/api_invoices.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!silent) setIsSaving(false);
      if (resData.status === 'success') {
        if (!silent) {
          setSaveSuccessMessage(`Invoice ${invoiceNumber} saved successfully to MySQL database!`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
        }
        fetchSavedInvoicesList();
        return true;
      } else {
        if (!silent) alert('Failed to save invoice: ' + (resData.message || 'Error'));
        return false;
      }
    } catch (err: any) {
      if (!silent) {
        setIsSaving(false);
        console.error('Save invoice error:', err);
        alert('Save invoice error: ' + (err?.message || 'Network error'));
      }
      return false;
    }
  };

  const handleSaveInvoice = () => {
    saveInvoicePayload(false);
  };

  const handleOpenPdfModal = async () => {
    setIsPdfModalOpen(true);
    setIsGeneratingPdfPreview(true);
    setPdfPreviewUrl('');
    await saveInvoicePayload(true);
    const targetId = invoiceId || invoiceNumber;
    const stableUrl = getApiUrl(`/api_pdf.php?type=invoice&id=${encodeURIComponent(targetId)}&action=stream&force=1&t=${Date.now()}#toolbar=1`);
    setPdfPreviewUrl(stableUrl);
  };

  const handleDownloadPdfDirect = async () => {
    await saveInvoicePayload(true);
    const targetId = invoiceId || invoiceNumber;
    const downloadUrl = getApiUrl(`/api_pdf.php?type=invoice&id=${encodeURIComponent(targetId)}&action=download&force=1`);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${invoiceNumber || 'INV-ABM'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewPdfInTab = async () => {
    await saveInvoicePayload(true);
    const targetId = invoiceId || invoiceNumber;
    const previewUrl = getApiUrl(`/api_pdf.php?type=invoice&id=${encodeURIComponent(targetId)}&action=stream&force=1`);
    window.open(previewUrl, '_blank');
  };

  const formatAssetUrl = (url?: string) => {
    if (!url || !url.trim()) return '';
    const clean = url.trim();
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    const apiPath = getApiUrl(clean);
    const timestamp = invoiceSettings?.updated_at ? new Date(invoiceSettings.updated_at).getTime() : '';
    return timestamp ? `${apiPath}?v=${timestamp}` : apiPath;
  };

  const logoUrl = invoiceSettings?.logo_url || invoiceSettings?.logoUrl || '/favicon.png';
  const stampUrl = invoiceSettings?.stamp_url || invoiceSettings?.stampUrl;
  const signatureUrl = invoiceSettings?.signature_url || invoiceSettings?.signatureUrl;
  const headerImageUrl = invoiceSettings?.header_image_url || invoiceSettings?.headerImageUrl;
  const companyNameSetting = invoiceSettings?.company_name || invoiceSettings?.companyName || 'AB MALAYA INDUSTRY';
  const companyRegNoSetting = invoiceSettings?.company_reg_no || invoiceSettings?.companyRegNo || '003320457-D';

  const logoScale = offsets['invoice_logo']?.scale || 1.0;
  const logoHeightPx = Math.max(20, Math.round(44 * logoScale));
  const defaultHeaderHeight = logoHeightPx + 10;
  const finalHeaderHeight = headerImageHeight ? Math.max(defaultHeaderHeight, Math.min(180, headerImageHeight)) : defaultHeaderHeight;
  const companyAddressSetting = (invoiceSettings?.company_address && invoiceSettings.company_address.trim())
    || (invoiceSettings?.companyAddress && invoiceSettings.companyAddress.trim())
    || '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
  const companyEmailSetting = invoiceSettings?.email || invoiceSettings?.companyEmail || 'abmalayaindustry@gmail.com';
  const companyPhoneSetting = invoiceSettings?.phone || invoiceSettings?.companyPhone || '+60 3-8000 1234';
  const companyWebsiteSetting = invoiceSettings?.website || invoiceSettings?.companyWebsite || 'abmalaya.com';
  const invoiceTitleSetting = invoiceSettings?.invoice_title || invoiceSettings?.invoiceTitle || 'OFFICIAL INVOICE';

  const bankName = invoiceSettings?.bank_name || invoiceSettings?.bankName || 'PUBLIC BANK';
  const bankAccount = invoiceSettings?.bank_account_number || invoiceSettings?.bankAccountNumber || '3818192115';
  const bankHolder = invoiceSettings?.bank_account_name || invoiceSettings?.bankAccountName || 'AB MALAYA INDUSTRY';
  const bankEmail = invoiceSettings?.bank_email || invoiceSettings?.bankEmail || companyEmailSetting;
  const remarksText = invoiceSettings?.remarks_text || invoiceSettings?.remarksText;

  const authSignatoryName = invoiceSettings?.authorised_by_name || invoiceSettings?.authorisedByName || 'Muhammad Aimanuddin Bin Mohd Zaki';
  const authSignatoryTitle = invoiceSettings?.authorised_by_title || invoiceSettings?.authorisedByTitle || 'Procurement Manager / Head of Sales';
  const receivedByLabel = invoiceSettings?.received_by_label || invoiceSettings?.receivedByLabel || 'Received by,';
  const receivedByNameLabel = invoiceSettings?.received_by_name_label || invoiceSettings?.receivedByNameLabel || 'Name / Designation: ______________________';
  const receivedByDateLabel = invoiceSettings?.received_by_date_label || invoiceSettings?.receivedByDateLabel || 'Date: ____ / ____ / ________';

  const tableHeaderBg = invoiceSettings?.table_header_bg || invoiceSettings?.tableHeaderBg || '#0070c0';
  const tableHeaderTextColor = invoiceSettings?.table_header_text_color || invoiceSettings?.tableHeaderTextColor || '#ffffff';

  const renderDynamicAddress = (addrRaw?: string) => {
    const defaultAddress = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
    const clean = (addrRaw && addrRaw.trim()) ? addrRaw.trim() : defaultAddress;

    if (clean.includes('\n')) {
      const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.map((line, idx) => (
        <p key={idx} style={{ margin: 0, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? '#0f172a' : '#1e293b', fontSize: idx === 0 ? '7.5pt' : '7pt' }}>
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
          <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '7.5pt' }}>{line1}</p>
          <p style={{ margin: 0, color: '#1e293b', fontSize: '7pt' }}>{line2}</p>
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '7pt' }}>{line3}</p>
        </>
      );
    }

    return <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '7.5pt' }}>{clean}</p>;
  };

  return (
    <div className="w-full h-full bg-[#f0f0f0] flex flex-col font-sans p-0 m-0 overflow-y-auto">
      
      {/* FROZEN STICKY TOP NAVBAR (MATCHING QUOTATION DOC STYLE) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-3 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs sticky top-0 z-30 print:hidden">
        
        {/* LEFT SECTION: Options Dropdown + Selectors */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          

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
            <span className="font-bold text-slate-700 text-[11px]">Load from Quotation:</span>
            <select
              value={selectedQuoId}
              onChange={(e) => handleSelectQuotation(e.target.value)}
              disabled={isLoadingQuotations}
              className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-3 py-1 text-xs text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer max-w-xs focus:outline-none disabled:opacity-60 transition"
            >
              <option value="">
                {isLoadingQuotations ? '-- Loading Quotations... --' : '-- Select Quotation --'}
              </option>
              {completedQuotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotation_number} • {q.company_name || q.client_name} ({formatCurrency(q.grand_total || 0)}) [{q.status || 'draft'}]
                </option>
              ))}
            </select>
          </div>

          {/* USER GUIDE / SOP INVOICE BUTTON (!) */}
          <button
            type="button"
            onClick={() => setIsGuideModalOpen(true)}
            className="p-1 px-2.5 bg-gradient-to-b from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 border border-amber-300 text-amber-900 rounded shadow-inner transition cursor-pointer flex items-center justify-center font-black gap-1.5 shrink-0 group"
            title="Invoice Guide & SOP (Panduan & Penjelasan Alur Faktur)"
          >
            <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center text-[10px] font-black shadow-xs group-hover:scale-110 transition-transform">!</span>
            <span className="text-[11px] font-bold">Guide</span>
          </button>

          {isLoadingQuotations && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              <span>Loading Quotation...</span>
            </div>
          )}

          {saveSuccessMessage && (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* RIGHT SECTION: Standardized Action Buttons (Matching QuotationDoc) */}
        <div className="flex items-center gap-2 flex-wrap">
          
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
            <span>{isDocPreviewMode ? 'Exit Doc Preview' : 'Doc Preview'}</span>
          </button>

          {/* PRIMARY SAVE INVOICE BUTTON */}
          <button
            onClick={handleSaveInvoice}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white font-bold text-xs px-3 py-1 shadow-xs transition cursor-pointer rounded border border-sky-800 disabled:opacity-60"
            title="Save Invoice directly to MySQL database"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-white" />}
            <span>{isSaving ? 'Saving...' : 'Save Invoice'}</span>
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

          {/* DOWNLOAD FULL PDF BUTTON (PUPPETEER ENGINE) */}
          <button
            type="button"
            onClick={handleDownloadPdfDirect}
            className="flex items-center gap-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs px-3.5 py-1.5 transition cursor-pointer shadow-md rounded border border-blue-900"
            title="Download Full PDF generated by Puppeteer daemon engine"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Download PDF</span>
          </button>

          {/* DIRECT PRINT BUTTON */}
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
            <span>{isPrintingDirect ? 'Preparing...' : 'Direct Print (PDF)'}</span>
          </button>

          {/* ACTIONS & SETTINGS DROPDOWN MENU WITH GEAR SVG */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRightActionsDropdownOpen(!isRightActionsDropdownOpen)}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-2.5 py-1 rounded shadow-inner cursor-pointer transition"
              title="Actions, Invoice Settings & Setup"
            >
              <Settings className="w-4 h-4 text-purple-600" />
              <span>Actions</span>
              <ChevronDown className="w-3 h-3 text-slate-600" />
            </button>

            {isRightActionsDropdownOpen && (
              <div className="absolute right-0 top-8 w-64 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    handleCreateNewInvoice();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-700 hover:bg-blue-50 font-bold cursor-pointer text-left transition"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Create New Blank Invoice</span>
                </button>

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    handleSaveInvoice();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span>Save Invoice to MySQL</span>
                </button>

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    setIsPaperSetupModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-purple-800 hover:bg-purple-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                  <span>Invoice & Header Settings (Setup)</span>
                </button>

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    handleOpenPdfModal();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-800 hover:bg-blue-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview PDF Live (Puppeteer Modal)</span>
                </button>

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    handlePreviewPdfInTab();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Preview PDF in New Tab</span>
                </button>

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
                    handleDownloadPdfDirect();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Full PDF (Puppeteer)</span>
                </button>

                {onSendEmail && (
                  <button
                    onClick={() => {
                      setIsRightActionsDropdownOpen(false);
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

                <button
                  onClick={() => {
                    setIsRightActionsDropdownOpen(false);
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
                      setIsRightActionsDropdownOpen(false);
                      handleResetLayout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reset Layout Positions</span>
                  </button>
                )}

                {onNavigateView && (
                  <button
                    onClick={() => {
                      setIsRightActionsDropdownOpen(false);
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
                      setIsRightActionsDropdownOpen(false);
                      onNavigateView('system_settings');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-purple-50 hover:text-purple-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-purple-600" />
                    <span>System Settings</span>
                  </button>
                )}

                {onBack && (
                  <button
                    onClick={() => {
                      setIsRightActionsDropdownOpen(false);
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
        <div className="no-print bg-blue-700 text-white text-xs font-bold px-4 py-2.5 text-center shadow-lg flex flex-wrap items-center justify-between gap-3 sticky top-[49px] z-30 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-blue-200 animate-bounce shrink-0" />
            <span>DRAG & RESIZE MODE ACTIVE: Drag elements or scale logo & text on the invoice sheet!</span>
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
              title="Finish and save positions automatically"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Done & Save Layout</span>
            </button>
            {Object.keys(offsets).length > 0 && (
              <button
                type="button"
                onClick={handleResetLayout}
                className="bg-rose-500/80 hover:bg-rose-600 active:scale-95 text-white px-2.5 py-1.5 rounded text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                title="Reset all positions to default"
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
            padding: ${modalMarginTop}mm ${modalMarginRight}mm ${modalMarginBottom}mm ${modalMarginLeft}mm !important;
            font-size: ${modalFontSize}pt !important;
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
                <div 
                  style={{ 
                    width: '100%', 
                    height: `${finalHeaderHeight}px`,
                    borderBottom: '2px solid #004f8b', 
                    padding: '4px 0 3px 0', 
                    marginBottom: '4px',
                    boxSizing: 'border-box',
                    backgroundImage: headerImageUrl ? `url("${formatAssetUrl(headerImageUrl)}")` : 'linear-gradient(to right, #004f8b, #0070c0, #0080d0)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'top center',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', margin: 0, padding: 0 }}>
                    <tbody>
                      <tr>
                        {/* Logo Left */}
                        <td style={{ width: '55%', verticalAlign: 'bottom', textAlign: 'left', padding: 0, border: 'none' }}>
                          <DraggableElement id="invoice_logo" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Logo" resizable={true} disableScaleTransform={true}>
                            {isLoadingInvoiceSettings ? (
                              <div className="h-11 w-36 bg-slate-50 border border-slate-200 rounded flex items-center justify-center gap-1.5 text-[10px] text-blue-700 font-mono font-bold animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                <span>Loading Logo...</span>
                              </div>
                            ) : logoUrl ? (
                              <img
                                src={formatAssetUrl(logoUrl)}
                                alt={companyNameSetting}
                                style={{
                                  height: `${logoHeightPx}px`,
                                  maxWidth: `${Math.round(220 * logoScale)}px`,
                                  objectFit: 'contain',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/favicon.png';
                                }}
                              />
                            ) : (
                              <div>
                                <div style={{ fontWeight: 900, fontSize: `${Math.round(15 * logoScale)}pt`, color: '#004f8b', textTransform: 'uppercase' }}>
                                  {companyNameSetting}
                                </div>
                                {companyRegNoSetting && (
                                  <span style={{ fontSize: `${Math.round(10 * logoScale)}px`, fontWeight: 700, color: '#0070c0', fontFamily: 'monospace', display: 'block' }}>({companyRegNoSetting})</span>
                                )}
                              </div>
                            )}
                          </DraggableElement>
                        </td>

                        {/* Company Address Right */}
                        <td style={{ width: '45%', verticalAlign: 'bottom', textAlign: 'right', padding: 0, border: 'none', fontSize: '7.5pt', lineHeight: 1.25, color: '#1e293b' }}>
                          <DraggableElement id="invoice_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Company Address" resizable={true}>
                            {renderDynamicAddress(companyAddressSetting)}
                          </DraggableElement>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

                {/* METADATA & TITLE STRIP BANNER (Page 1 Only) */}
                {chunk.isFirstPage && (
                  <>
                    <DraggableElement id="invoice_title" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Title Banner">
                      <div 
                        style={{
                          backgroundColor: tableHeaderBg,
                          color: tableHeaderTextColor || '#ffffff',
                          fontWeight: 800,
                          fontSize: '9pt',
                          padding: '4px 10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          textAlign: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        {invoiceTitleSetting}
                      </div>
                    </DraggableElement>

                    {/* 2-COLUMN ADDRESS LAYOUT & METADATA SECTION (TEXT MODEL MATCHING PDF) */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-3 text-xs text-slate-900 border-b border-slate-300 pb-3 mb-3">
                      
                      {/* LEFT COLUMN: TO / BILLING ADDRESS */}
                      <DraggableElement id="invoice_to_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="TO Address Text" className="md:col-span-7">
                        {isDocPreviewMode ? (
                          <div className="space-y-1 font-sans text-slate-900 text-[11px] leading-relaxed">
                            <div>
                              <span className="font-bold text-slate-900 uppercase">TO: </span>
                              <span className="font-extrabold text-slate-900 uppercase">{companyName || '—'}</span>
                            </div>
                            {billingAddress && (
                              <p className="text-[11px] text-slate-800 whitespace-pre-line font-medium leading-snug">
                                {billingAddress}
                              </p>
                            )}
                            {clientName && (
                              <p className="pt-0.5">
                                <span className="font-bold text-slate-900">Attention: </span>
                                <span className="font-medium text-slate-900">{clientName}</span>
                              </p>
                            )}
                            {clientEmail && (
                              <p>
                                <span className="font-bold text-slate-900">Email: </span>
                                <span className="font-medium text-blue-700 underline">{clientEmail}</span>
                              </p>
                            )}
                            {clientPhone && (
                              <p>
                                <span className="font-bold text-slate-900">Cont. Numb : </span>
                                <span className="font-medium text-slate-900 font-mono">{clientPhone}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 font-sans text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 shrink-0 w-20">TO:</span>
                              <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Client Company Name"
                                className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-bold text-slate-900 rounded-none text-xs focus:outline-none"
                              />
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-slate-900 shrink-0 w-20 text-[10px] uppercase text-slate-400">Address:</span>
                              <textarea
                                rows={2}
                                value={billingAddress}
                                onChange={(e) => setBillingAddress(e.target.value)}
                                placeholder="Billing Street Address & Location"
                                className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 text-slate-800 rounded-none text-[11px] focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 shrink-0 w-20 text-[11px]">Attention:</span>
                              <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Contact Person"
                                className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-medium text-slate-900 rounded-none text-[11px] focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 shrink-0 w-20 text-[11px]">Email:</span>
                              <div className="flex-1 flex items-center gap-1">
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
                                    className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-mono text-slate-800 rounded-none text-[11px] focus:outline-none cursor-pointer"
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
                                    className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-mono text-slate-800 rounded-none text-[11px] focus:outline-none"
                                  />
                                )}
                                {clientEmailOptions.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setIsCustomEmailMode(!isCustomEmailMode)}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 font-bold underline shrink-0 cursor-pointer"
                                    title="Toggle email mode"
                                  >
                                    {isCustomEmailMode ? 'Dropdown' : 'Custom'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 shrink-0 w-20 text-[11px]">Cont. Numb :</span>
                              <input
                                type="text"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="Contact Phone / Mobile No."
                                className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-mono text-slate-800 rounded-none text-[11px] focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </DraggableElement>

                      {/* RIGHT COLUMN: INVOICE METADATA & DELIVERY (SHIPPING ADDRESS) */}
                      <div className="md:col-span-5 space-y-3">
                        {/* INVOICE METADATA (Invoice No, Date, PO Numb) */}
                        <DraggableElement id="invoice_meta" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Invoice Numbers & Date">
                          {isDocPreviewMode ? (
                            <div className="space-y-1 font-sans text-[11px] leading-snug">
                              <div>
                                <span className="font-bold text-slate-900">Invoice No. :</span>
                                <div className="font-extrabold text-slate-900 font-mono text-xs pl-2">{invoiceNumber || '—'}</div>
                              </div>
                              <div>
                                <span className="font-bold text-slate-900">Invoice Date :</span>
                                <div className="font-medium text-slate-900 pl-2">{invoiceDate || '—'}</div>
                              </div>
                              <div>
                                <span className="font-bold text-slate-900">PO Numb :</span>
                                <div className="font-extrabold text-slate-900 font-mono text-xs pl-2">{poNumber || '—'}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5 font-sans text-xs">
                              <div>
                                <span className="font-bold text-slate-900 block text-[11px]">Invoice No. :</span>
                                <input
                                  type="text"
                                  value={invoiceNumber}
                                  onChange={(e) => setInvoiceNumber(e.target.value)}
                                  placeholder="e.g. ABM/INV/20260930/384"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-bold font-mono text-slate-900 text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block text-[11px]">Invoice Date :</span>
                                <input
                                  type="text"
                                  value={invoiceDate}
                                  onChange={(e) => setInvoiceDate(e.target.value)}
                                  placeholder="e.g. 30/09/2026 or 30 September 2026"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 text-slate-900 text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block text-[11px]">PO Numb :</span>
                                <input
                                  type="text"
                                  value={poNumber}
                                  onChange={(e) => setPoNumber(e.target.value)}
                                  placeholder="e.g. DM/AGA/ABMI/PO/279/24"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-bold font-mono text-slate-900 text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </DraggableElement>

                        {/* DELIVERY (SHIPPING ADDRESS) */}
                        <DraggableElement id="invoice_del_address" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="DELIVERY Address Text">
                          {isDocPreviewMode ? (
                            <div className="space-y-1 font-sans text-slate-900 text-[11px] leading-relaxed pt-1">
                              <div>
                                <span className="font-bold text-slate-900 uppercase">DELIVERY: </span>
                                <span className="font-extrabold text-slate-900">{deliveryCompany || companyName || '—'}</span>
                              </div>
                              {(deliveryAddress || billingAddress) && (
                                <p className="text-[11px] text-slate-800 whitespace-pre-line font-medium leading-snug">
                                  {deliveryAddress || billingAddress}
                                </p>
                              )}
                              {deliveryPic && (
                                <p className="pt-0.5">
                                  <span className="font-bold text-slate-900">PIC – </span>
                                  <span className="font-medium text-slate-900">{deliveryPic}</span>
                                </p>
                              )}
                              {deliveryPhone && (
                                <p>
                                  <span className="font-bold text-slate-900">Contact No. : </span>
                                  <span className="font-medium text-slate-900 font-mono">{deliveryPhone}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5 font-sans text-xs pt-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 shrink-0 w-24 text-[11px]">DELIVERY:</span>
                                <input
                                  type="text"
                                  value={deliveryCompany}
                                  onChange={(e) => setDeliveryCompany(e.target.value)}
                                  placeholder="Delivery Ship / Project Name"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-bold text-slate-900 text-xs focus:outline-none"
                                />
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-900 shrink-0 w-24 text-[10px] uppercase text-slate-400">Address:</span>
                                <textarea
                                  rows={2}
                                  value={deliveryAddress}
                                  onChange={(e) => setDeliveryAddress(e.target.value)}
                                  placeholder="Delivery Destination / Yard Address"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 text-slate-800 rounded-none text-[11px] focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 shrink-0 w-24 text-[11px]">PIC –</span>
                                <input
                                  type="text"
                                  value={deliveryPic}
                                  onChange={(e) => setDeliveryPic(e.target.value)}
                                  placeholder="Delivery Contact Person"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-medium text-slate-900 text-[11px] focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 shrink-0 w-24 text-[11px]">Contact No. :</span>
                                <input
                                  type="text"
                                  value={deliveryPhone}
                                  onChange={(e) => setDeliveryPhone(e.target.value)}
                                  placeholder="+6012-3456789"
                                  className="w-full bg-transparent border-b border-slate-300 focus:border-blue-600 px-1 py-0.5 font-mono text-slate-800 text-[11px] focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </DraggableElement>
                      </div>

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
                              Belum ada item faktur. Muat dari penawaran (<em>Load from Quotation</em>) atau klik "+ Add Item" untuk input manual.
                            </td>
                          </tr>
                        ) : (
                          chunk.items.map((item: any, localIdx: number) => {
                            const globalIdx = chunk.startIndex + localIdx;
                            return (
                              <tr key={globalIdx} className="hover:bg-slate-50 transition">
                                <td style={{ textAlign: 'center' }} className="font-mono text-xs">
                                  {globalIdx + 1}
                                  {!isDocPreviewMode && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(globalIdx)}
                                      className="block mx-auto mt-1 text-red-400 hover:text-red-600 transition cursor-pointer"
                                      title="Remove Item"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>

                                {/* ITEM Column */}
                                <td style={{ color: '#0f172a', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                  {isDocPreviewMode ? (
                                    <>
                                      <p className="font-bold text-slate-900 text-xs leading-tight mb-0.5 whitespace-pre-line break-words">{item.description}</p>
                                      {item.specification && (
                                        <p className="text-[10px] text-slate-600 leading-snug font-sans mb-1 whitespace-pre-line break-words">{item.specification}</p>
                                      )}
                                    </>
                                  ) : (
                                    <div className="space-y-1">
                                      <textarea
                                        rows={Math.max(1, (item.description || '').split('\n').length)}
                                        value={item.description || ''}
                                        onChange={(e) => handleItemChange(globalIdx, 'description', e.target.value)}
                                        className="w-full text-xs font-bold text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 resize-y"
                                        placeholder="Item Description..."
                                      />
                                      <textarea
                                        rows={Math.max(1, (item.specification || '').split('\n').length)}
                                        value={item.specification || ''}
                                        onChange={(e) => handleItemChange(globalIdx, 'specification', e.target.value)}
                                        className="w-full text-[10px] text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-400 resize-y"
                                        placeholder="Specifications (optional)..."
                                      />
                                    </div>
                                  )}
                                  {item.product_code && (
                                    <span className="inline-block font-mono text-[9px] text-purple-900 font-bold bg-purple-50 px-1 rounded border border-purple-200 mt-1">
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
                                <td style={{ textAlign: 'center' }} className="font-mono">
                                  {isDocPreviewMode ? (
                                    item.quantity
                                  ) : (
                                    <input
                                      type="number"
                                      min="1"
                                      step="any"
                                      value={item.quantity ?? 1}
                                      onChange={(e) => handleItemChange(globalIdx, 'quantity', e.target.value)}
                                      className="w-14 text-center font-mono text-xs border border-slate-300 rounded px-1 py-0.5"
                                    />
                                  )}
                                </td>

                                {/* UNIT */}
                                <td style={{ textAlign: 'center' }}>
                                  {isDocPreviewMode ? (
                                    item.unit || 'Unit'
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.unit || 'Unit'}
                                      onChange={(e) => handleItemChange(globalIdx, 'unit', e.target.value)}
                                      className="w-16 text-center text-xs border border-slate-300 rounded px-1 py-0.5"
                                    />
                                  )}
                                </td>

                                {/* OFFERED ITEM */}
                                <td style={{ color: '#0f172a', verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                  {isDocPreviewMode ? (
                                    <div className="text-xs text-slate-900 leading-snug whitespace-pre-line break-words">
                                      {item.offer || item.offered_item || '—'}
                                    </div>
                                  ) : (
                                    <textarea
                                      rows={Math.max(1, (item.offer || item.offered_item || '').split('\n').length)}
                                      value={item.offer || item.offered_item || ''}
                                      onChange={(e) => handleItemChange(globalIdx, 'offer', e.target.value)}
                                      className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 resize-y"
                                      placeholder="Offered details..."
                                    />
                                  )}
                                </td>

                                {/* UNIT PRICE (MYR) */}
                                <td style={{ textAlign: 'right' }} className="font-mono">
                                  {isDocPreviewMode ? (
                                    formatCurrency(item.unit_price)
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.unit_price ?? 0}
                                      onChange={(e) => handleItemChange(globalIdx, 'unit_price', e.target.value)}
                                      className="w-24 text-right font-mono text-xs border border-slate-300 rounded px-1.5 py-0.5"
                                    />
                                  )}
                                </td>

                                {/* TOTAL PRICE (MYR) */}
                                <td style={{ textAlign: 'right' }} className="font-mono font-bold">
                                  {formatCurrency(item.total !== undefined ? item.total : (Number(item.quantity || 0) * Number(item.unit_price || 0)))}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </DraggableElement>

                {/* + ADD ITEM BUTTON (Non-Preview Mode) */}
                {!isDocPreviewMode && chunk.isLastPage && (
                  <div className="mt-2 mb-3">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 rounded border border-blue-200 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add New Invoice Item</span>
                    </button>
                  </div>
                )}

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
                            {isLoadingInvoiceSettings ? (
                              <div className="h-12 w-44 border border-blue-200 bg-blue-50/70 rounded flex items-center justify-center gap-1.5 text-[10px] text-blue-700 font-bold font-mono animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                <span>Loading Stamp & Signatures...</span>
                              </div>
                            ) : (
                              <>
                                {signatureUrl && (
                                  <img
                                    src={formatAssetUrl(signatureUrl)}
                                    alt="Digital Signature"
                                    className="h-14 object-contain max-w-[120px] pointer-events-none"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                {stampUrl && (
                                  <img
                                    src={formatAssetUrl(stampUrl)}
                                    alt="Company Stamp"
                                    className="h-14 object-contain max-w-[120px] pointer-events-none"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                {!signatureUrl && !stampUrl && (
                                  <div className="w-32 h-10 border-2 border-[#0070c0] border-dashed flex items-center justify-center text-[#0070c0] text-[9px] font-black uppercase tracking-wider transform -rotate-2">
                                    [STAMP & TTD]
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <p className="font-bold text-slate-900 text-xs"><u>{authSignatoryName}</u></p>
                          <p className="text-slate-600 font-mono text-[10px]">{authSignatoryTitle}</p>
                        </div>
                      </DraggableElement>

                      {/* RECEIVED BY (CLIENT RECEIVER SIGNATURE LINE & DYNAMIC SIGNATORIES) */}
                      <DraggableElement id="invoice_sig_recv" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Received By Line">
                        <div className="text-left sm:text-right space-y-1">
                          
                          {/* Interactive Signatory Toolbar (Hidden when printing/PDF) */}
                          <div className="print:hidden no-print mb-1.5 flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <select
                                value={isCustomSigMode ? '__custom__' : (receivedByName ? receivedByName : '__blank__')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '__blank__') {
                                    setReceivedByName('');
                                    setReceivedByDesignation('');
                                    setIsCustomSigMode(false);
                                  } else if (val === '__custom__') {
                                    setIsCustomSigMode(true);
                                  } else {
                                    const match = companySignatories.find((s) => s.name === val);
                                    if (match) {
                                      setReceivedByName(match.name);
                                      setReceivedByDesignation(match.designation || '');
                                    } else {
                                      setReceivedByName(val);
                                    }
                                    setIsCustomSigMode(false);
                                  }
                                }}
                                className="bg-white border border-blue-400 text-slate-800 text-[10px] font-bold rounded px-1.5 py-1 shadow-xs max-w-[180px] focus:outline-blue-500"
                                title="Select recipient PIC / signatory for this invoice"
                              >
                                <option value="__blank__">📝 Blank Signature Line (Default)</option>
                                {companySignatories.map((sig, sIdx) => (
                                  <option key={sig.id || sIdx} value={sig.name}>
                                    👤 {sig.name} {sig.designation ? `(${sig.designation})` : ''}
                                  </option>
                                ))}
                                <option value="__custom__">✍️ Custom Input...</option>
                              </select>

                              <button
                                type="button"
                                onClick={openAddSignatoryModal}
                                className="inline-flex items-center gap-1 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-300 text-blue-700 text-[10px] font-bold px-1.5 py-1 rounded shadow-xs cursor-pointer transition"
                                title={`Add new PIC for ${companyName || 'this company'}`}
                              >
                                <UserPlus className="w-3 h-3 text-blue-600" />
                                <span>+ Add PIC</span>
                              </button>
                            </div>

                            {isCustomSigMode && (
                              <div className="w-full max-w-[200px] bg-slate-50 border border-slate-300 p-1.5 rounded space-y-1 text-[10px] text-left">
                                <input
                                  type="text"
                                  placeholder="Recipient PIC Name"
                                  value={receivedByName}
                                  onChange={(e) => setReceivedByName(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold"
                                />
                                <input
                                  type="text"
                                  placeholder="Job Title / Designation"
                                  value={receivedByDesignation}
                                  onChange={(e) => setReceivedByDesignation(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5"
                                />
                                <input
                                  type="text"
                                  placeholder="Date (e.g. 16/08/2026)"
                                  value={receivedByDate}
                                  onChange={(e) => setReceivedByDate(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5"
                                />
                              </div>
                            )}
                          </div>

                          <p className="text-slate-700 font-bold uppercase tracking-wide text-[10px]">{receivedByLabel}</p>
                          
                          <div className="h-12 border-b-2 border-slate-900 w-48 my-0.5 ml-auto"></div>

                          {receivedByName ? (
                            <div>
                              <p className="font-bold text-slate-900 text-xs"><u>{receivedByName}</u></p>
                              {receivedByDesignation && (
                                <p className="text-slate-600 font-mono text-[10px] uppercase">{receivedByDesignation}</p>
                              )}
                              <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                                Date: {receivedByDate || '____ / ____ / ________'}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-900 text-[10px]">{receivedByNameLabel}</p>
                              <p className="text-slate-500 font-mono text-[10px]">{receivedByDateLabel}</p>
                            </div>
                          )}
                        </div>
                      </DraggableElement>
                    </div>
                  </div>
                )}

              {/* BOTTOM FOOTER (Repeats on every sheet at bottom - Fully Dynamic) */}
              <DraggableElement id="invoice_footer" isDragMode={isDragMode} offsets={offsets} onOffsetChange={handleOffsetChange} label="Footer" className="mt-auto w-full">
                <footer style={{ borderTop: '1px solid #cbd5e1', paddingTop: '4px', marginTop: '4px', textAlign: 'center', fontSize: '7pt', color: '#64748b', background: '#ffffff', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1px', tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ textAlign: 'left', width: '70%', verticalAlign: 'middle', padding: 0, border: 'none' }}>
                          {logoUrl && (
                            <img
                              src={formatAssetUrl(logoUrl)}
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
                          {!isDocPreviewMode || isDragMode ? (
                            <input
                              type="text"
                              value={footerText}
                              onChange={(e) => setFooterText(e.target.value)}
                              placeholder={invoiceSettings?.footer_text || `${companyEmailSetting}, ${companyPhoneSetting}, ${companyWebsiteSetting}`}
                              className="ml-1.5 px-1 py-0.5 text-[7pt] bg-amber-50 border border-amber-300 rounded text-slate-800 focus:outline-blue-500 w-80 font-mono"
                              title="Edit Invoice Footer Running Text"
                            />
                          ) : (
                            <span style={{ marginLeft: '6px', fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>
                              ({footerText || invoiceSettings?.footer_text || `${companyEmailSetting}, ${companyPhoneSetting}, ${companyWebsiteSetting}`})
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

            <div className="flex-1 bg-slate-950 p-0 overflow-hidden relative flex items-center justify-center">
              {(!pdfPreviewUrl || isGeneratingPdfPreview) && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-xs font-bold text-slate-300">Preparing Live Invoice PDF Preview...</p>
                  <p className="text-[10px] text-slate-500 font-mono">Headless Chrome Puppeteer Engine</p>
                </div>
              )}
              {pdfPreviewUrl && (
                <iframe
                  src={pdfPreviewUrl}
                  onLoad={() => setIsGeneratingPdfPreview(false)}
                  className="w-full h-full border-none"
                  title="Live Invoice PDF Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── PAPER, HEADER & INVOICE SETTINGS MODAL ────────────────────── */}
      {isPaperSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-300 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-sans max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm">Invoice Setup & Settings</h3>
              </div>
              <button
                onClick={() => setIsPaperSetupModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
              {/* Company & Header Information */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Header & Company Info
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Company Name</label>
                    <input
                      type="text"
                      value={modalCompanyName}
                      onChange={(e) => setModalCompanyName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-semibold focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Company Reg No.</label>
                    <input
                      type="text"
                      value={modalCompanyRegNo}
                      onChange={(e) => setModalCompanyRegNo(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono focus:outline-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-0.5">Company Address</label>
                  <textarea
                    rows={2}
                    value={modalCompanyAddress}
                    onChange={(e) => setModalCompanyAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-blue-500"
                    placeholder="2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur."
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Phone</label>
                    <input
                      type="text"
                      value={modalPhone}
                      onChange={(e) => setModalPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Email</label>
                    <input
                      type="email"
                      value={modalEmail}
                      onChange={(e) => setModalEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Website</label>
                    <input
                      type="text"
                      value={modalWebsite}
                      onChange={(e) => setModalWebsite(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs focus:outline-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Invoice Title</label>
                    <input
                      type="text"
                      value={modalInvoiceTitle}
                      onChange={(e) => setModalInvoiceTitle(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-bold focus:outline-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Table Header Color</label>
                    <div className="flex items-center gap-2 bg-white p-1 border border-slate-300 rounded">
                      <input
                        type="color"
                        value={modalTableHeaderBg}
                        onChange={(e) => setModalTableHeaderBg(e.target.value)}
                        className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                      />
                      <span className="font-mono font-bold text-slate-900">{modalTableHeaderBg}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Paper & Margins */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  Paper Size & Margins
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Paper Size</label>
                    <select
                      value={modalPaperSize}
                      onChange={(e) => setModalPaperSize(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 focus:outline-blue-500"
                    >
                      <option value="A4">A4 (210 x 297 mm)</option>
                      <option value="Letter">Letter (8.5 x 11 in)</option>
                      <option value="Legal">Legal (8.5 x 14 in)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-0.5">Font Size (pt)</label>
                    <input
                      type="number"
                      min="7"
                      max="14"
                      value={modalFontSize}
                      onChange={(e) => setModalFontSize(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold focus:outline-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-0.5">Margins (mm)</label>
                  <div className="grid grid-cols-4 gap-2">
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
                  <label className="block font-bold text-slate-700 uppercase mb-0.5">Footer Running Text (Bottom Sheet)</label>
                  <textarea
                    rows={2}
                    value={modalFooterText}
                    onChange={(e) => setModalFooterText(e.target.value)}
                    placeholder="abmalayaindustry@gmail.com, +60 3-8000 1234, abmalaya.com"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:outline-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 shrink-0">
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
                      company_name: modalCompanyName,
                      company_reg_no: modalCompanyRegNo,
                      company_address: modalCompanyAddress,
                      phone: modalPhone,
                      email: modalEmail,
                      website: modalWebsite,
                      invoice_title: modalInvoiceTitle,
                      footer_text: modalFooterText,
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
                          setLayoutSaveNotice('Invoice Settings & Header saved to database!');
                          setTimeout(() => setLayoutSaveNotice(null), 3000);
                        } else {
                          alert('Failed to save settings: ' + (resData.message || 'Error'));
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

      {/* ── ADD NEW SIGNATORY / PIC MODAL ──────────────────────────────── */}
      {isAddSignatoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-200" />
                <h3 className="font-bold text-sm">Add Recipient Signatory (Received By PIC)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSignatoryModalOpen(false)}
                className="text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewSignatory} className="p-5 space-y-4 text-xs text-slate-800">
              {/* Company Selection Field */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Select Target Company *</span>
                </label>
                
                {/* Existing Companies Quick Picker */}
                <select
                  value={
                    allClientCompanies.some((c) => c.company_name.toLowerCase().trim() === sigTargetCompany.toLowerCase().trim())
                      ? sigTargetCompany
                      : (sigTargetCompany === (companyName || clientName) ? sigTargetCompany : '__custom__')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setSigTargetCompany('');
                    } else {
                      setSigTargetCompany(val);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-blue-600 focus:bg-white"
                >
                  {companyName && (
                    <option value={companyName}>
                      📍 Current Invoice Company ({companyName})
                    </option>
                  )}
                  {allClientCompanies
                    .filter((c) => c.company_name !== companyName)
                    .map((comp) => (
                      <option key={comp.id || comp.company_name} value={comp.company_name}>
                        🏢 {comp.company_name}
                      </option>
                    ))}
                  <option value="__custom__">✏️ Enter Custom Company Name...</option>
                </select>

                {/* Company Name Editable Input */}
                <input
                  type="text"
                  required
                  placeholder="Type or edit target company name..."
                  value={sigTargetCompany}
                  onChange={(e) => setSigTargetCompany(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-blue-600 shadow-2xs"
                />
                <p className="text-[10px] text-slate-500 italic">
                  This PIC signatory will be saved specifically for the company above and automatically available for its invoices.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Recipient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmad Fauzi / Masuriani"
                  value={newSigName}
                  onChange={(e) => setNewSigName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-900 focus:outline-blue-600 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Job Title / Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse & Logistics PIC"
                  value={newSigDesignation}
                  onChange={(e) => setNewSigDesignation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-blue-600 focus:bg-white"
                />

                {/* Quick Designation Shortcuts */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {[
                    'Warehouse PIC',
                    'Logistics PIC',
                    'Finance & Admin',
                    'Purchasing Staff',
                    'Procurement Officer',
                    'Receiver',
                  ].map((desig) => (
                    <button
                      key={desig}
                      type="button"
                      onClick={() => setNewSigDesignation(desig)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] cursor-pointer transition font-medium"
                    >
                      + {desig}
                    </button>
                  ))}
                </div>
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNewSigDefault}
                  onChange={(e) => setIsNewSigDefault(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700">
                  Set as default recipient PIC for this company
                </span>
              </label>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddSignatoryModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewSig || !newSigName.trim() || !sigTargetCompany.trim()}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingNewSig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Signatory to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          INVOICE GUIDE & SOP MODAL (!) - DEDICATED SOLELY TO INVOICE MODULE
          ========================================================================= */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in">
          <div className="bg-white border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden rounded-xl animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white flex items-center justify-between border-b border-blue-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                  <Receipt className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                    <span>Panduan & Alur Faktur Penjualan (Commercial Invoice)</span>
                    <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Invoice SOP</span>
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Panduan resmi alur penerbitan faktur tagihan, pengaturan jatuh tempo, rincian rekening bank, hingga cetak & ekspor PDF.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                title="Tutup Panduan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setGuideTab('workflow')}
                className={`pb-2.5 px-3 text-xs font-extrabold transition cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  guideTab === 'workflow'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-slate-200 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Alur Pembuatan Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setGuideTab('fields')}
                className={`pb-2.5 px-3 text-xs font-extrabold transition cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  guideTab === 'fields'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-slate-200 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Struktur Kolom & Bagian Dokumen</span>
              </button>

              <button
                type="button"
                onClick={() => setGuideTab('payment')}
                className={`pb-2.5 px-3 text-xs font-extrabold transition cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  guideTab === 'payment'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-slate-200 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Termin Pembayaran & Cetak A4</span>
              </button>

              <button
                type="button"
                onClick={() => setGuideTab('faq')}
                className={`pb-2.5 px-3 text-xs font-extrabold transition cursor-pointer border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  guideTab === 'faq'
                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg border-t border-x border-slate-200 shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>4. FAQ & Status Murni Kosong</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-800 flex-1 bg-[#fcfcfd]">
              
              {/* TAB 1: ALUR PEMBUATAN INVOICE */}
              {guideTab === 'workflow' && (
                <div className="space-y-4 animate-in fade-in">
                  
                  {/* Clean State Notification */}
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-lg text-amber-950 space-y-1">
                    <p className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>Prinsip Murni Kosong (Clean State)</span>
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-amber-900/90">
                      Daftar invoice sengaja dimulai murni kosong tanpa file contoh atau draft invoice bayangan. Faktur baru akan resmi tersimpan dan memiliki dokumen hanya jika Anda menyimpannya melalui tombol <strong>Save Invoice</strong>.
                    </p>
                  </div>

                  {/* 4 Steps Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                    {/* Step 1 */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center">1</div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Pilih Sumber Faktur</h4>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        <strong>Cara Rekomendasi:</strong> Pilih penawaran di dropdown <em>Load from Quotation</em>. Item barang, klien, dan harga otomatis terisi!
                      </p>
                      <p className="text-[10.5px] text-slate-500 italic">
                        Atau klik <em>Actions &gt; Create New Blank Invoice</em> untuk mulai manual dari nol.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center">2</div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Isi PO & Jatuh Tempo</h4>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        Masukkan nomor PO dari pembeli. Tentukan <strong>Invoice Date</strong> dan batas waktu pembayaran <strong>Due Date</strong> (standar 14 hari).
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
                      <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-[11px] flex items-center justify-center">3</div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Atur Item & Pajak</h4>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        Periksa rincian jumlah barang, harga satuan, dan diskon. Subtotal, PPN/SST, serta Grand Total dihitung otomatis secara presisi.
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">4</div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Simpan & Cetak</h4>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        Klik <strong>Save Invoice</strong> untuk menyimpan ke MySQL. Lalu gunakan <strong>Direct Print (PDF)</strong> untuk mencetak dokumen resmi A4.
                      </p>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11.5px] text-slate-700">
                    <p className="font-bold text-slate-900">Tips Penggunaan Cepat:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      <li>Gunakan tombol <strong>Doc Preview</strong> untuk melihat tampilan bersih lembar faktur tanpa garis input formulir.</li>
                      <li>Jika perlu mengatur posisi logo atau kop surat secara visual, aktifkan <strong>Drag &amp; Move</strong> lalu geser elemen dengan mouse.</li>
                      <li>Invoice yang telah disimpan otomatis dapat dipilih kembali sewaktu-waktu melalui dropdown <strong>Saved Invoice</strong>.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: STRUKTUR KOLOM & BAGIAN DOKUMEN */}
              {guideTab === 'fields' && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="bg-indigo-50 border-l-4 border-indigo-600 p-3 rounded-r-lg text-indigo-950">
                    <p className="font-bold text-xs text-indigo-900">Anatomi Lembar Faktur Penjualan (Commercial Invoice A4)</p>
                    <p className="text-[11px] text-indigo-900/80">Setiap faktur yang dicetak terdiri dari bagian-bagian resmi berikut:</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <strong className="text-slate-900 text-xs">Kop Surat & Nomor Faktur</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Memuat logo AB Malaya, nomor registrasi SSM (003320457-D), kontak resmi, dan <strong>Invoice No</strong> dengan format resmi (contoh: <code>ABM/INV/20261019/270</code>).
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        <strong className="text-slate-900 text-xs">Billing Address (TO)</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Ditujukan kepada perusahaan pembeli, PIC bagian penagihan/keuangan, alamat kantor, nomor telepon, dan email resmi untuk pengiriman tagihan.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <strong className="text-slate-900 text-xs">Delivery Address (PENGIRIMAN)</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Alamat gudang / site proyek penerima fisik barang, nama PIC gudang, dan nomor kontak yang dapat dihubungi saat pengantaran.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                        <strong className="text-slate-900 text-xs">Tabel Rincian Item (7 Kolom)</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Memuat nomor urut, deskripsi/spesifikasi item, jumlah (Qty), satuan (Unit), harga satuan (Unit Price RM), diskon (%), dan total harga.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                        <strong className="text-slate-900 text-xs">Tanda Terima PIC Klien (Received By)</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Kolom tanda tangan dan nama terang penanggung jawab dari sisi klien yang berwenang menerima dokumen dan barang. Anda dapat menambah PIC baru dengan tombol <em>+ New Signatory</em>.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        <strong className="text-slate-900 text-xs">Otorisasi & Stempel AB Malaya</strong>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Tanda tangan resmi pejabat berwenang AB Malaya (Head of Finance & Sales) dilengkapi stempel basah perusahaan untuk keabsahan hukum penagihan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TERMIN PEMBAYARAN & CETAK A4 */}
              {guideTab === 'payment' && (
                <div className="space-y-3.5 animate-in fade-in">
                  
                  {/* Bank Details Card */}
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-700" />
                      <h4 className="font-black text-emerald-950 text-xs uppercase tracking-wide">Rekening Resmi Pembayaran (Public Bank)</h4>
                    </div>
                    <p className="text-[11.5px] text-emerald-900 leading-relaxed">
                      Semua pembayaran faktur tagihan wajib dialamatkan ke rekening resmi perusahaan berikut yang otomatis tercetak pada lembar invoice:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                      <div className="bg-white p-2.5 rounded border border-emerald-200">
                        <span className="text-slate-500 block text-[10px]">Bank:</span>
                        <strong className="text-slate-900">PUBLIC BANK BERHAD</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-emerald-200">
                        <span className="text-slate-500 block text-[10px]">Nomor Rekening:</span>
                        <strong className="text-emerald-700 font-black text-xs">3818192115</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded border border-emerald-200">
                        <span className="text-slate-500 block text-[10px]">Nama Penerima:</span>
                        <strong className="text-slate-900">AB MALAYA INDUSTRY</strong>
                      </div>
                    </div>
                  </div>

                  {/* Printing Methods */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-emerald-600" />
                        <h5 className="font-extrabold text-slate-900 text-xs">Metode 1: Direct Print (PDF)</h5>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Direkomendasikan untuk cetak harian ke printer kantor atau *Save as PDF* langsung dari dialog browser. Ukuran kertas otomatis diatur ke A4 portrait dengan margin presisi.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-blue-600" />
                        <h5 className="font-extrabold text-slate-900 text-xs">Metode 2: Download PDF (Server Engine)</h5>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Menggunakan Puppeteer Headless Engine di server untuk menghasilkan file PDF resmi dengan resolusi cetak tinggi, stempel digital tajam, dan siap kirim ke email klien.
                      </p>
                    </div>
                  </div>

                  {/* Multi-page Note */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                    <strong className="text-slate-800 block">Paginasi Otomatis (Multi-Page Split):</strong>
                    <p className="leading-relaxed">
                      Jika invoice memuat banyak baris barang (&gt; 6 item), sistem otomatis memecah invoice ke dalam lembar bersambung (Halaman 1 dari 2, dst) secara rapi agar tabel tidak tumpang tindih dengan kolom tanda tangan dan rekening bank di halaman akhir.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: FAQ & STATUS MURNI KOSONG */}
              {guideTab === 'faq' && (
                <div className="space-y-3 animate-in fade-in">
                  
                  <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-blue-700">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Kenapa daftar invoice awalnya kosong (0 data)?</span>
                    </h5>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                      Sesuai standar operasional, sistem tidak lagi memunculkan invoice contoh (*dummy*) atau membuat invoice palsu secara otomatis. Daftar invoice murni mencerminkan transaksi nyata yang Anda simpan.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-blue-700">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Bagaimana cara cepat membuat invoice dari penawaran harga (Quotation)?</span>
                    </h5>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                      Cukup klik dropdown <strong>Load from Quotation</strong> di bilah atas, lalu pilih nomor Quotation yang disetujui. Semua data item, harga, nama perusahaan, dan alamat penagihan akan terisi otomatis dalam 1 detik.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-blue-700">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Apakah data item yang ditarik dari Quotation bisa diedit?</span>
                    </h5>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                      Bisa! Anda bebas mengubah kuantitas (Qty), harga satuan (Unit Price), diskon, menambah baris item baru, atau menghapus item sebelum menekan tombol <strong>Save Invoice</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-blue-700">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Bagaimana jika klien meminta invoice direvisi?</span>
                    </h5>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                      Pilih invoice tersebut dari dropdown <strong>Saved Invoice</strong>, lakukan perubahan yang diminta, lalu klik <strong>Save Invoice</strong> kembali. Sistem akan memperbarui data faktur di database dan memperbarui dokumen cetak.
                    </p>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                AB Malaya ERP • Commercial Invoice Management SOP
              </span>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded shadow-xs transition cursor-pointer"
              >
                Tutup Panduan (OK)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceBuilder;
