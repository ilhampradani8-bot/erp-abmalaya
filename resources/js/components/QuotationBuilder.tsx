// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Quotation, QuotationItem } from '../types/erp';
import { 
  Plus, Trash2, Send, FileCheck, X, Paperclip, FileType, CheckCircle2, Loader2, Terminal, Save, Eye, MoreVertical, Package, Image as ImageIcon, PlusCircle, Search, RefreshCw, Sliders, Settings, Building, User, Mail, Calendar, DollarSign, ShieldCheck, FileText, ChevronDown
} from 'lucide-react';
import { ProductItem } from './Product';
import { getApiUrl } from '../utils/api';

interface QuotationBuilderProps {
  initialQuotation: Quotation;
  onSaveAndPreviewDoc: (quo: Quotation) => void;
  onSaveAndSendEmail: (quo: Quotation) => void;
  onCancel?: () => void;
  onNavigateView?: (mode: any) => void;
  currentUser?: any;
}

export const QuotationBuilder: React.FC<QuotationBuilderProps> = ({
  initialQuotation,
  onSaveAndPreviewDoc,
  onSaveAndSendEmail,
  onCancel,
  onNavigateView,
  currentUser,
}) => {
  const [quotation, setQuotation] = useState<Quotation>(initialQuotation || {});
  const [savedQuotations, setSavedQuotations] = useState<Quotation[]>([]);
  const [productsCatalog, setProductsCatalog] = useState<ProductItem[]>([]);
  const [selectedQuoId, setSelectedQuoId] = useState<string>('');
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const [isSavingMySQL, setIsSavingMySQL] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Exactly 2 Tabs Navigation State: 'header' (Tab 1: Info SPH & Klien) | 'items' (Tab 2: Tabel Items & Total)
  const [activeTab, setActiveTab] = useState<'header' | 'items'>('items');

  // Header Dropdown Menu & Modals State
  const [isHeaderKebabOpen, setIsHeaderKebabOpen] = useState<boolean>(false);
  const [isLeftQuoDropdownOpen, setIsLeftQuoDropdownOpen] = useState<boolean>(false);
  const [isHistoryLogModalOpen, setIsHistoryLogModalOpen] = useState<boolean>(false);

  // Source Pop-up Modal & AI Gemini OCR Scanning Log States
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isScanningModalOcr, setIsScanningModalOcr] = useState<boolean>(false);
  const [scanOcrLog, setScanOcrLog] = useState<any | null>(null);

  // MULTI-SELECT & ROW REPLACE PRODUCT PICKER MODAL STATES
  const [isProductPickerModalOpen, setIsProductPickerModalOpen] = useState<boolean>(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [pickerSearchTerm, setPickerSearchTerm] = useState<string>('');
  const [rowToReplaceIndex, setRowToReplaceIndex] = useState<number | null>(null);

  // Dedicated loading states for MySQL quotation list & dropdown selection
  const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(false);
  const [isSelectingDropdownQuo, setIsSelectingDropdownQuo] = useState<boolean>(false);

  // Dedicated system_paper_settings state for company logo and branding
  const [paperSettings, setPaperSettings] = useState<any>(null);
  const [isLoadingPaperSettings, setIsLoadingPaperSettings] = useState<boolean>(true);

  const loadPaperSettingsFromMySQL = () => {
    setIsLoadingPaperSettings(true);
    fetch(getApiUrl('/api_paper_settings.php'))
      .then((res) => res.json())
      .then((resData) => {
        setIsLoadingPaperSettings(false);
        if (resData.status === 'success' && resData.data) {
          setPaperSettings(resData.data);
        }
      })
      .catch((err) => {
        setIsLoadingPaperSettings(false);
        console.log('Load paper settings error:', err);
      });
  };

  // Load list of saved quotations from MySQL database for dropdown selector
  const loadQuotationsListFromMySQL = () => {
    setIsLoadingQuotations(true);
    fetch(getApiUrl('/api_quotations.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setSavedQuotations(resData.data);
        }
      })
      .catch((err) => console.log('Load saved quotations error:', err))
      .finally(() => setIsLoadingQuotations(false));
  };

  // Load products catalog from MySQL database
  const loadProductsCatalogFromMySQL = () => {
    fetch(getApiUrl('/api_products.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setProductsCatalog(resData.data);
        }
      })
      .catch((err) => console.log('Load products catalog error:', err));
  };

  useEffect(() => {
    loadQuotationsListFromMySQL();
    loadProductsCatalogFromMySQL();
    loadPaperSettingsFromMySQL();
  }, []);



  // Robust items normalization helper to ensure dropdown selection loads all items from MySQL
  const normalizeQuotationItems = (targetQuo: any): QuotationItem[] => {
    if (!targetQuo) return [];

    let rawItems: any[] = [];
    if (Array.isArray(targetQuo.items) && targetQuo.items.length > 0) {
      rawItems = targetQuo.items;
    } else if (Array.isArray(targetQuo.items_details) && targetQuo.items_details.length > 0) {
      rawItems = targetQuo.items_details;
    } else if (typeof targetQuo.items === 'string' && targetQuo.items.trim() !== '') {
      try {
        const parsed = JSON.parse(targetQuo.items);
        if (Array.isArray(parsed) && parsed.length > 0) rawItems = parsed;
      } catch (e) {}
    } else if (typeof targetQuo.items_details === 'string' && targetQuo.items_details.trim() !== '') {
      try {
        const parsed = JSON.parse(targetQuo.items_details);
        if (Array.isArray(parsed) && parsed.length > 0) rawItems = parsed;
      } catch (e) {}
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return [
        {
          id: 'item-1',
          description: targetQuo.notes || '',
          quantity: 1,
          unit: 'Package',
          unit_price: 0,
          discount_percent: 0,
          total: 0,
        }
      ];
    }

    return rawItems.map((it: any, idx: number) => {
      const qty = parseFloat(it.quantity || it.qty || 1) || 1;
      const price = parseFloat(it.unit_price || it.price || 0) || 0;
      const disc = parseFloat(it.discount_percent || 0) || 0;
      const gross = qty * price;
      const calculatedTot = gross - (gross * disc) / 100;
      const tot = parseFloat(it.total) || calculatedTot;

      return {
        id: it.id ? String(it.id) : `item-${Date.now()}-${idx}`,
        product_code: it.product_code || it.item_code || '',
        category_code: it.category_code || it.category_name || it.category || null,
        category_name: it.category_name || it.category_code || it.category || null,
        impa_code: it.impa_code || null,
        description: it.description || '',
        specification: it.specification || it.spec || '',
        quantity: qty,
        unit: it.unit || 'Unit',
        unit_price: price,
        discount_percent: disc,
        total: tot,
        image_url: it.image_url || null,
      };
    });
  };

  // Sync state whenever initialQuotation prop changes
  useEffect(() => {
    if (initialQuotation) {
      const items = normalizeQuotationItems(initialQuotation);

      setQuotation({
        ...initialQuotation,
        items,
        quotation_number: initialQuotation.quotation_number || `QUO-ABM/MY/2026/0${Math.floor(Math.random() * 900 + 100)}`,
        company_name: initialQuotation.company_name || '',
        client_name: initialQuotation.client_name || '',
        client_email: initialQuotation.client_email || '',
        date_issued: initialQuotation.date_issued || new Date().toISOString().split('T')[0],
      });
      setSelectedQuoId(initialQuotation.id || '');
    }
  }, [initialQuotation]);

  // Handle dropdown selection to auto-fill form fields from MySQL
  const handleSelectQuotationFromDropdown = (quoId: string) => {
    setSelectedQuoId(quoId);
    if (!quoId) return;

    setIsSelectingDropdownQuo(true);
    const target = savedQuotations.find((q) => q.id === quoId);
    if (target) {
      const items = normalizeQuotationItems(target);

      setQuotation({
        ...target,
        items,
      });

      // Recalculate financial breakdown for the selected quotation
      updateQuotationTotals(items, parseFloat(target.tax_percent as any) || 11);

      setSaveSuccessMessage(`Loaded Quotation "${target.quotation_number}" (${items.length} item(s)) from MySQL database!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    }
    setTimeout(() => {
      setIsSelectingDropdownQuo(false);
    }, 350);
  };



  // Match item description against products catalog database
  const findCatalogMatch = (desc: string): ProductItem | null => {
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

  // Apply catalog product details to an item row
  const handleApplyCatalogProduct = (index: number, product: ProductItem) => {
    const updatedItems = [...(quotation?.items || [])];
    const offerVal = product.offer || product.offered_item || '';
    updatedItems[index] = {
      ...updatedItems[index],
      product_code: product.product_code || `PRD-${product.id}`,
      impa_code: product.impa_code || '',
      description: product.product_name || updatedItems[index].description,
      specification: product.specification || product.description || offerVal,
      offer: offerVal,
      unit: product.unit || 'Unit',
      unit_price: product.unit_price || 0,
      discount_percent: product.discount_percent || 0,
      image_url: product.image_url,
    };
    updateQuotationTotals(updatedItems, quotation?.tax_percent || 11);
    setSaveSuccessMessage(`Applied specs & price from product catalog: "${product.product_name}"`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Add custom line items from table to Master Product Catalog database
  const handleAddCustomItemsToProductCatalog = () => {
    const unregisteredItems = (quotation?.items || []).filter(
      (it) => it.description && it.description.trim() !== '' && !findCatalogMatch(it.description)
    );

    if (unregisteredItems.length === 0) {
      setSaveSuccessMessage('All items in table are already registered in database.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      return;
    }

    let savedCount = 0;
    unregisteredItems.forEach((item) => {
      fetch(getApiUrl('/api_products.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_code: `PRD-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
          product_name: item.description,
          description: item.description,
          unit: item.unit || 'Package',
          unit_price: item.unit_price || 0,
          image_url: (item as any).image_url || null,
          category: 'Equipment',
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.status === 'success') {
            savedCount++;
            if (savedCount === unregisteredItems.length) {
              setSaveSuccessMessage(`${savedCount} custom item(s) saved to Master Product Catalog database!`);
              setTimeout(() => setSaveSuccessMessage(null), 4000);
              loadProductsCatalogFromMySQL();
            }
          }
        });
    });
  };

  // Add multiple selected products from Product Catalog Modal into Line Items Table
  const handleAddSelectedProductsFromModal = () => {
    if (selectedProductIds.length === 0) return;

    if (rowToReplaceIndex !== null) {
      const firstProdId = selectedProductIds[0];
      const prod = productsCatalog.find((p) => p.id === firstProdId);
      if (prod) {
        handleApplyCatalogProduct(rowToReplaceIndex, prod);
      }
      setRowToReplaceIndex(null);
      setSelectedProductIds([]);
      setIsProductPickerModalOpen(false);
      return;
    }

    const newItems: QuotationItem[] = selectedProductIds.map((id, idx) => {
      const prod = productsCatalog.find((p) => p.id === id);
      const offerVal = prod?.offer || prod?.offered_item || '';
      return {
        id: `item-picker-${Date.now()}-${idx}`,
        product_code: prod?.product_code || `PRD-${prod?.id}`,
        category_code: prod?.category || null,
        category_name: prod?.category || null,
        impa_code: prod?.impa_code || null,
        description: prod?.product_name || 'Product Specification',
        specification: prod?.specification || prod?.description || offerVal,
        quantity: 1,
        unit: prod?.unit || 'Unit',
        unit_price: prod?.unit_price || 0,
        discount_percent: prod?.discount_percent || 0,
        total: prod?.unit_price || 0,
        image_url: prod?.image_url || null,
      } as any;
    });

    const currentItems = (quotation?.items || []).filter(it => it.description && it.description.trim() !== '');
    const combinedItems = [...currentItems, ...newItems];

    updateQuotationTotals(combinedItems, quotation?.tax_percent || 11);
    setSelectedProductIds([]);
    setIsProductPickerModalOpen(false);
    setSaveSuccessMessage(`${newItems.length} product(s) added from Master Database to Line Items Table!`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };


  // Select product in row replace mode directly
  const handleSelectProductInReplaceMode = (prod: ProductItem) => {
    if (rowToReplaceIndex !== null) {
      handleApplyCatalogProduct(rowToReplaceIndex, prod);
      setRowToReplaceIndex(null);
      setSelectedProductIds([]);
      setIsProductPickerModalOpen(false);
    }
  };

  // Toggle single product selection in picker modal
  const toggleSelectProductInPicker = (id: number) => {
    if (rowToReplaceIndex !== null) {
      setSelectedProductIds([id]);
      return;
    }
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Toggle Select All products in picker modal
  const toggleSelectAllProductsInPicker = (filteredProducts: ProductItem[]) => {
    const allFilteredIds = filteredProducts.map((p) => p.id);
    const isAllSelected = allFilteredIds.every((id) => selectedProductIds.includes(id));

    if (isAllSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Run Authentic Google Gemini AI PDF OCR Scanning via PHP backend
  const handleScanPdfWithGeminiAiInModal = () => {
    if (!quotation?.id) {
      setScanOcrLog({ status: 'error', message: 'ID SPH Quotation tidak ditemukan.' });
      return;
    }
    setIsScanningModalOcr(true);
    setScanOcrLog({ status: 'connecting', message: 'Scanning authentic PDF binary via Gemini AI Engine...' });

    fetch(getApiUrl('/api_ocr_scan.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quo_id: quotation.id,
        actor_name: currentUser?.name || currentUser?.email || 'Aiman Zaki',
        actor_email: currentUser?.email || null,
      })
    })
      .then((res) => res.json())
      .then((resData) => {
        setScanOcrLog(resData);
        const scanRes = resData.ocr_scan_result || resData;
        const rawItems = scanRes?.items || resData?.items || [];
        if (resData.status === 'success' && Array.isArray(rawItems) && rawItems.length > 0) {
          const formattedItems: QuotationItem[] = rawItems.map((it: any, idx: number) => {
            const qty = it.qty || it.quantity || 1;
            const price = it.unit_price || 0;
            return {
              id: `gemini-live-${idx + 1}`,
              description: it.description || 'RFQ Equipment Item',
              specification: it.specification || null,
              quantity: qty,
              unit: it.unit || 'Pcs',
              unit_price: price,
              discount_percent: it.discount_percent || 0,
              total: qty * price,
            };
          });

          setQuotation((prev) => ({
            ...prev,
            items: formattedItems,
            category_name: scanRes?.category_name || prev.category_name,
            impa_code: scanRes?.impa_code || prev.impa_code,
          }));

          setSaveSuccessMessage(`Gemini AI PDF scan results (${formattedItems.length} items) populated into quotation table successfully!`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
        } else if (resData.status === 'skipped') {
          setScanOcrLog({ status: 'skipped', message: resData.message || 'RFQ attachment file not found.' });
        } else {
          setScanOcrLog({ status: 'error', message: resData.message || scanRes?.reason || 'Failed to extract items from document.' });
        }
      })
      .catch((err) => {
        setScanOcrLog({ status: 'error', message: err.toString() });
      })
      .finally(() => {
        setIsScanningModalOcr(false);
      });
  };

  // Recalculate totals
  const updateQuotationTotals = (items: QuotationItem[], taxPercent: number) => {
    let subtotal = 0;
    let totalDiscount = 0;

    (items || []).forEach((item) => {
      const gross = (item.quantity || 0) * (item.unit_price || 0);
      const disc = (gross * (item.discount_percent || 0)) / 100;
      item.total = gross - disc;
      subtotal += gross;
      totalDiscount += disc;
    });

    const netSubtotal = subtotal - totalDiscount;
    const taxAmount = (netSubtotal * taxPercent) / 100;
    const grandTotal = netSubtotal + taxAmount;

    setQuotation((prev) => ({
      ...prev,
      items,
      subtotal,
      discount_total: totalDiscount,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      grand_total: grandTotal,
    }));
  };

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const updatedItems = [...(quotation?.items || [])];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    updateQuotationTotals(updatedItems, quotation?.tax_percent || 11);
  };

  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: 'Unit',
      unit_price: 0,
      discount_percent: 0,
      total: 0,
    };
    const updatedItems = [...(quotation?.items || []), newItem];
    updateQuotationTotals(updatedItems, quotation?.tax_percent || 11);
  };

  const handleRemoveItem = (index: number) => {
    if (!quotation?.items || quotation.items.length === 1) return;
    const updatedItems = quotation.items.filter((_, i) => i !== index);
    updateQuotationTotals(updatedItems, quotation.tax_percent || 11);
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

  const saveQuotationToMySQL = (quo: Quotation, callback?: () => void) => {
    setIsSavingMySQL(true);
    const validUntilVal = quo.valid_until || '14 Days';
    const payload = {
      ...quo,
      valid_until: validUntilVal,
      status: (quo.status && (quo.status === 'terkirim' || quo.status === 'penawaran_terkirim' || quo.status === 'deal')) ? quo.status : 'siap_kirim',
      user_name: currentUser?.name || 'Admin',
      user_email: currentUser?.email || 'admin@abmalaya.com',
      created_by: quo.created_by || currentUser?.name || currentUser?.email || 'Muhammad Aimanuddin Bin Mohd Zaki',
      items: quo.items || [],
    };
    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          const savedId = resData.id || quo.id;
          const savedNum = resData.quotation_number || quo.quotation_number;
          const updatedQuo: Quotation = {
            ...quo,
            ...payload,
            id: savedId,
            quotation_number: savedNum,
          };
          setQuotation(updatedQuo);
          setSelectedQuoId(savedId);
          setSaveSuccessMessage(`Quotation ${savedNum} saved successfully to MySQL database!`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
          loadQuotationsListFromMySQL();
          if (callback) callback();
        } else {
          alert('Failed to save quotation: ' + (resData.message || 'MySQL Error'));
        }
      })
      .catch((err) => {
        console.error('Save Quotation MySQL error:', err);
        alert('Save quotation network error: ' + err.message);
      })
      .finally(() => {
        setIsSavingMySQL(false);
      });
  };

  const isBlank = (val: any) => {
    if (val === undefined || val === null) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    if (typeof val === 'number' && val === 0) return true;
    return false;
  };

  const filteredPickerProducts = productsCatalog.filter((p) => {
    const term = pickerSearchTerm.toLowerCase();
    return (
      (p.product_name || '').toLowerCase().includes(term) ||
      (p.product_code || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );
  });

  const unregisteredItems = (quotation?.items || []).filter(
    (it) => it.description && it.description.trim() !== '' && !findCatalogMatch(it.description)
  );

  return (
    <div className="w-full h-full bg-[#f0f0f0] flex flex-col font-sans p-0 m-0 overflow-hidden">
      
      {/* TOP HEADER BAR (FROZEN STICKY TOP NAVBAR) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-3 py-1.5 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs sticky top-0 z-30">
        
        <div className="flex items-center gap-2 text-xs">
          
          {/* NEW DROPDOWN MENU BUTTON TO THE LEFT OF QUOTATION SELECTOR */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLeftQuoDropdownOpen(!isLeftQuoDropdownOpen)}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-2.5 py-1 rounded shadow-inner cursor-pointer transition"
              title="Quotation Options & Actions"
            >
              <Sliders className="w-3.5 h-3.5 text-[#0099ec]" />
              <span>Options</span>
              <ChevronDown className="w-3 h-3 text-slate-600" />
            </button>

            {isLeftQuoDropdownOpen && (
              <div className="absolute left-0 top-8 w-56 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setQuotation({
                      id: `QUO-${Date.now()}`,
                      quotation_number: `SPH-ABM/MY/2026/${Math.floor(1000 + Math.random() * 9000)}`,
                      client_name: '',
                      client_email: '',
                      company_name: '',
                      date_issued: new Date().toISOString().split('T')[0],
                      valid_until: '14 Days',
                      items: [],
                      subtotal: 0,
                      discount_total: 0,
                      tax_percent: 11,
                      tax_amount: 0,
                      grand_total: 0,
                      status: 'draft',
                    });
                    setSelectedQuoId('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left transition"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ New Blank Quotation</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    onSaveAndPreviewDoc(quotation);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Document (PDF)</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    onSaveAndSendEmail(quotation);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Send via Email</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    if (onNavigateView) onNavigateView('quotation_list');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-slate-50 hover:text-slate-900 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>View Quotation List</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    setIsSourceModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-sky-50 hover:text-sky-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                  <span>Source RFQ Details</span>
                </button>

                <button
                  onClick={() => {
                    setIsLeftQuoDropdownOpen(false);
                    if (onNavigateView) {
                      onNavigateView('system_settings');
                    } else if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('navigate_settings_tab', { detail: 'paper' }));
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-purple-50 hover:text-purple-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                  <span>Paper & SPH Settings</span>
                </button>
              </div>
            )}
          </div>

          <select
            value={selectedQuoId}
            onChange={(e) => handleSelectQuotationFromDropdown(e.target.value)}
            disabled={isLoadingQuotations || isSelectingDropdownQuo}
            className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-2.5 py-1 text-xs text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer max-w-xs focus:outline-none disabled:opacity-60 transition"
          >
            <option value="">
              {isLoadingQuotations ? '-- Loading Quotations from Database... --' : '-- Select Saved Quotation / RFQ --'}
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

          {(isLoadingQuotations || isSelectingDropdownQuo) && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold font-mono bg-blue-50 px-2.5 py-1 rounded border border-blue-200 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>{isSelectingDropdownQuo ? 'Loading Items...' : 'Fetching Data...'}</span>
            </div>
          )}

          <button
            onClick={() => setIsSourceModalOpen(true)}
            className="flex items-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-2.5 py-1 rounded shadow-inner transition cursor-pointer hover:bg-white"
            title="View Original RFQ Source File / Message"
          >

            <Paperclip className="w-3.5 h-3.5 text-[#0099ec]" />
            <span>Source RFQ</span>
          </button>
        </div>

        {/* Action Buttons: Save + Kebab Dropdown Menu */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => saveQuotationToMySQL(quotation)}
            disabled={isSavingMySQL}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1 rounded border border-[#0060b0] shadow-xs cursor-pointer disabled:opacity-50 transition"
          >
            {isSavingMySQL ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Save className="w-3.5 h-3.5 text-white" />
            )}
            <span>Save</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsHeaderKebabOpen(!isHeaderKebabOpen)}
              className="p-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold rounded shadow-inner cursor-pointer transition flex items-center justify-center"
              title="More Actions Menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isHeaderKebabOpen && (
              <div className="absolute right-0 top-8 w-56 bg-white border border-slate-300 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                
                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left transition"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span>Save</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    onSaveAndPreviewDoc(quotation);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Document</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    onSaveAndSendEmail(quotation);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Send Email</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation, () => onSaveAndSendEmail(quotation));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Save & Send Email</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation, () => onSaveAndPreviewDoc(quotation));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Save & Preview PDF</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    setIsHistoryLogModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-amber-50 hover:text-amber-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-600" />
                  <span>History Audit Trail Log</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    setIsSourceModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-sky-50 hover:text-sky-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                  <span>Source RFQ Details</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    if (onNavigateView) {
                      onNavigateView('system_settings');
                    } else if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('navigate_settings_tab', { detail: 'paper' }));
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-800 hover:bg-purple-50 hover:text-purple-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  <span>Advance SPH Settings (System Settings)</span>
                </button>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* MySQL Connection Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-3 py-1.5 text-xs text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* 2 TABS NAVIGATION STRIP */}
      <div className="flex items-center justify-between bg-[#dfdfdf] border-b border-[#a0a0a0] px-3 pt-1.5 shrink-0 text-xs w-full">
        
        {/* Exactly 2 Tab Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`px-4 py-1.5 font-bold text-xs rounded-t-md transition cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeTab === 'header'
                ? 'bg-white text-blue-700 border-[#a0a0a0] shadow-2xs font-extrabold'
                : 'bg-[#ebebeb] text-[#555] border-transparent hover:bg-[#f3f3f3]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tab 1: Quotation & Client Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-1.5 font-bold text-xs rounded-t-md transition cursor-pointer flex items-center gap-1.5 border-t border-x ${
              activeTab === 'items'
                ? 'bg-white text-blue-700 border-[#a0a0a0] shadow-2xs font-extrabold'
                : 'bg-[#ebebeb] text-[#555] border-transparent hover:bg-[#f3f3f3]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Tab 2: Line Items & Financial Summary ({(quotation?.items || []).length})</span>
          </button>
        </div>

        {/* Compact Summary Quick Badge Strip */}
        <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-mono text-slate-700 bg-white/80 px-2.5 py-1 rounded border border-slate-300 mb-1">
          <span>Quotation No: <strong className="text-blue-700 font-bold">{quotation?.quotation_number || '—'}</strong></span>
          <span className="text-slate-300">•</span>
          <span>Category: <strong className="text-purple-700 font-bold">{quotation?.category_name || 'General Equipment'}</strong></span>
          <span className="text-slate-300">•</span>
          <span>Client: <strong className="text-slate-900 font-bold">{quotation?.company_name || quotation?.client_name || '—'}</strong></span>
          <span className="text-slate-300">•</span>
          <span>Grand Total: <strong className="text-emerald-700 font-extrabold">{formatCurrency(quotation?.grand_total || 0)}</strong></span>
        </div>
      </div>


      {/* DYNAMIC TAB BODY CONTAINER */}
      <div className="flex-1 overflow-y-auto w-full bg-[#f0f0f0] flex flex-col">
        
        {/* TAB 1: QUOTATION & CLIENT DETAILS (FULL WIDTH NO WRAPPING CARD) */}
        {activeTab === 'header' && (
          <div className="p-4 sm:p-6 w-full max-w-full space-y-4 font-sans">
            
            {/* Company Logo & Official Branding Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-3.5 rounded-md shadow-2xs">
              <div className="flex items-center gap-3">
                {isLoadingPaperSettings ? (
                  <div className="h-11 w-28 bg-slate-100 border border-slate-200 rounded flex items-center justify-center gap-1.5 text-xs text-blue-600 font-mono font-bold animate-pulse shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Logo...</span>
                  </div>
                ) : paperSettings?.logo_url ? (
                  <img
                    src={paperSettings.logo_url}
                    alt="Company Logo"
                    className="h-11 max-w-[160px] object-contain shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/favicon.png';
                    }}
                  />
                ) : (
                  <img
                    src="/favicon.png"
                    alt="Company Logo"
                    className="h-11 w-11 object-contain shrink-0"
                  />
                )}
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 tracking-tight uppercase">
                    {paperSettings?.company_name || 'AB MALAYA SDN. BHD.'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {paperSettings?.company_address || 'No. 12, Jalan Industrial Park, 50000 Kuala Lumpur, Malaysia'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs font-mono">
                <span className="text-slate-500 text-[10px] block font-bold uppercase">Official Provider Contact</span>
                <span className="text-blue-700 font-bold">{paperSettings?.email || 'sales@abmalaya.com'} • {paperSettings?.phone || '+60 3-8000 1234'}</span>
              </div>
            </div>

            {/* Quotation Category & Master IMPA Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/70 border border-purple-200 rounded-md p-3.5 shadow-2xs">
              <div>
                <label className="block text-[11px] font-extrabold text-purple-900 uppercase tracking-wider mb-1">
                  Quotation Category / Industry Segment:
                </label>
                <input
                  type="text"
                  value={quotation?.category_name || ''}
                  onChange={(e) => setQuotation({ ...quotation, category_name: e.target.value })}
                  placeholder="e.g. Marine Spare Parts, Industrial Valves, Oil & Gas Equipment"
                  className="w-full bg-white border border-purple-300 rounded px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-purple-900 uppercase tracking-wider mb-1">
                  Master IMPA / Reference Category Code:
                </label>
                <input
                  type="text"
                  value={quotation?.impa_code || ''}
                  onChange={(e) => setQuotation({ ...quotation, impa_code: e.target.value })}
                  placeholder="e.g. IMPA-174001 / CAT-MARINE-VALVE"
                  className="w-full bg-white border border-purple-300 rounded px-3 py-1.5 text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Grid FROM & TO Provider-Client Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* FROM Provider Details */}
              <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs shadow-2xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>FROM (Quotation Provider):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono font-bold">Official Provider</span>
                </div>
                <div className="space-y-2 text-slate-700">
                  <p className="font-bold text-slate-900 text-sm">
                    {paperSettings?.company_name || 'AB MALAYA SDN. BHD.'}
                    {paperSettings?.company_reg ? ` (Reg: ${paperSettings.company_reg})` : ''}
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {paperSettings?.company_address || '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.'}
                  </p>
                  
                  {/* Dynamic Provider Email Selection (Detected Inbox vs Official Email) */}
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase">
                      <span>Provider Email / Receiving Inbox:</span>
                      {(quotation as any)?.email_source?.recipient_email && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono lowercase">
                          detected: {(quotation as any).email_source.recipient_email}
                        </span>
                      )}
                    </div>
                    <select
                      value={(quotation as any)?.provider_email || (quotation as any)?.email_source?.recipient_email || paperSettings?.email || 'sales@abmalaya.com'}
                      onChange={(e) => setQuotation({ ...quotation, provider_email: e.target.value } as any)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {(quotation as any)?.email_source?.recipient_email && (
                        <option value={(quotation as any).email_source.recipient_email}>
                          {(quotation as any).email_source.recipient_email} (Target Inbox yang Menerima RFQ)
                        </option>
                      )}
                      <option value={paperSettings?.email || 'sales@abmalaya.com'}>
                        {paperSettings?.email || 'sales@abmalaya.com'} (Official Primary Email)
                      </option>
                      <option value="abmalayaindustry@gmail.com">abmalayaindustry@gmail.com (Gmail Live Inbox)</option>
                      <option value="procurement@abmalaya.com">procurement@abmalaya.com (Procurement)</option>
                      <option value="info@abmalaya.com">info@abmalaya.com (General Info)</option>
                    </select>
                    <p className="font-mono text-[11px] text-slate-600 pt-0.5">
                      Tel: <span className="font-bold text-slate-900">{paperSettings?.phone || '+60 3-8000 1234'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                    <span className="shrink-0 font-medium">Created By:</span>
                    <input
                      type="text"
                      value={quotation?.created_by || ''}
                      placeholder={currentUser?.name || 'System Automation Daemon'}
                      onChange={(e) => setQuotation({ ...quotation, created_by: e.target.value })}
                      className="font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs focus:bg-white focus:border-blue-500 focus:outline-none flex-1 max-w-xs"
                    />
                  </div>
                </div>
              </div>

              {/* TO Target Client Details */}
              <div className="bg-blue-50/40 border border-blue-200 rounded-md p-4 space-y-3 text-xs shadow-2xs">
                <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                  <span className="font-extrabold text-xs text-blue-900 uppercase flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>TO (Target Client / Recipient):</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-mono font-bold">Client Target</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Contact Person:</label>
                    <input
                      type="text"
                      value={quotation?.client_name || ''}
                      onChange={(e) => setQuotation({ ...quotation, client_name: e.target.value })}
                      placeholder="e.g. Mr. David Tan / Procurement Manager"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Email Address:</label>
                    {(() => {
                      let currentVal = quotation?.client_email || '';
                      let optionsList: Array<{ email: string; source: string }> = [];

                      if (currentVal.startsWith('{') || currentVal.startsWith('[')) {
                        try {
                          const pJson = JSON.parse(currentVal);
                          currentVal = pJson.selected || '';
                          optionsList = pJson.options || [];
                        } catch (e) {}
                      }

                      if (optionsList.length === 0 && currentVal) {
                        optionsList.push({ email: currentVal, source: 'Entered Email' });
                      }

                      const updateEmailJson = (selected: string, newOpts: Array<{ email: string; source: string }>) => {
                        const jsonPayload = JSON.stringify({
                          selected,
                          options: newOpts
                        });
                        setQuotation({ ...quotation, client_email: jsonPayload });
                      };

                      return (
                        <div className="space-y-1">
                          <select
                            value={currentVal}
                            onChange={(e) => updateEmailJson(e.target.value, optionsList)}
                            className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-xs font-mono font-bold text-blue-800 focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Select Client Email --</option>
                            {optionsList.map((opt, oIdx) => (
                              <option key={oIdx} value={opt.email}>
                                {opt.email} ({opt.source})
                              </option>
                            ))}
                          </select>
                          <input
                            type="email"
                            placeholder="+ Add Custom Email (Press Enter)"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && val.includes('@')) {
                                  const exists = optionsList.some(o => o.email.toLowerCase() === val.toLowerCase());
                                  const updatedOpts = exists ? optionsList : [...optionsList, { email: val, source: 'Manual Added' }];
                                  updateEmailJson(val, updatedOpts);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                            className="w-full bg-white/90 border border-slate-300 rounded px-2 py-0.5 text-[10px] font-mono text-slate-700"
                          />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Company Name:</label>
                    <input
                      type="text"
                      value={quotation?.company_name || ''}
                      onChange={(e) => setQuotation({ ...quotation, company_name: e.target.value })}
                      placeholder="Client Company Name (Sdn. Bhd. / PT / Inc.)"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Quotation Validity & Approval Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-md text-xs text-slate-500 font-mono shadow-2xs">
              <div>
                <span>Date Issued: <strong className="text-slate-800 font-bold">{quotation?.date_issued || new Date().toISOString().split('T')[0]}</strong></span> • 
                <span> Valid Until: <strong className="text-slate-800 font-bold">{quotation?.valid_until || '14 Days'}</strong></span> • 
                <span> Created At: <strong className="text-slate-800 font-bold">{quotation?.created_at || '—'}</strong></span>
              </div>
              <div>
                <span>Approval ACC Status: <strong className={quotation?.approved_by ? 'text-emerald-700 font-extrabold' : 'text-amber-700 font-bold'}>{quotation?.approved_by ? 'ACC Approved' : 'Pending ACC'}</strong></span>
              </div>
            </div>

            {/* Quotation Notes & Warranty Terms Card */}
            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <label className="block text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Quotation Notes & Warranty Terms:</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Realtime Auto-Sync
                </span>
              </div>
              <textarea
                rows={4}
                value={quotation?.notes || ''}
                onChange={(e) => setQuotation({ ...quotation, notes: e.target.value })}
                placeholder="Enter quotation notes, delivery timeframe, 1-year official manufacturer warranty, payment terms, or special conditions..."
                className="w-full bg-slate-50 border border-slate-300 p-3 text-xs text-slate-900 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none font-sans font-medium leading-relaxed"
              />
            </div>

            {/* Custom Footer Running Text for Quotation */}
            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <label className="block text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>Custom Footer Running Text (Kop Footer Bawah SPH):</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Default dari Setting Paper jika dikosongkan
                </span>
              </div>
              <textarea
                rows={2}
                value={quotation?.footer_text || ''}
                onChange={(e) => setQuotation({ ...quotation, footer_text: e.target.value })}
                placeholder={paperSettings?.footer_text || 'sales@abmalaya.com, +60 3-8000 1234, abmalaya.com'}
                className="w-full bg-slate-50 border border-slate-300 p-2.5 text-xs text-slate-900 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono leading-relaxed"
              />
              <p className="text-[10px] text-slate-400">Teks ini akan dicetak di bagian paling bawah lembar dokumen preview dan PDF SPH.</p>
            </div>

          </div>
        )}



        {/* TAB 2: TABEL LINE ITEMS & TOTAL SPH (COMBINED FULL TAB) */}
        {activeTab === 'items' && (
          <div className="flex-1 flex flex-col w-full h-full space-y-0">
            
            {/* Table Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-1.5 bg-[#e9e9e9] border-b border-[#dbdbdb] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-[#3d3d3d] uppercase tracking-wider">
                  Line Items Specifications Table
                </span>
                {isSelectingDropdownQuo ? (
                  <span className="text-xs text-blue-700 font-bold font-mono flex items-center gap-1.5 animate-pulse bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Loading items from MySQL...</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">({(quotation?.items || []).length} items listed)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRowToReplaceIndex(null);
                    setIsProductPickerModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3 py-1 rounded-sm border border-[#0060b0] shadow-xs cursor-pointer transition"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>+ Select from Products Database</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] font-bold text-xs px-3 py-1 border border-[#a0a0a0] rounded-sm shadow-inner cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#0099ec]" />
                  <span>+ Blank Line</span>
                </button>
              </div>
            </div>

            {/* Scrollable Table View OR Loading Spinner Overlay */}
            {isSelectingDropdownQuo ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white space-y-3.5 animate-in fade-in min-h-[350px]">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <Package className="w-5 h-5 text-blue-600 absolute" />
                </div>
                <div className="text-center space-y-1">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider block">
                    Loading Quotation Line Items from Database...
                  </span>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Populating line item specifications, quantities, and prices from MySQL
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-auto border-b border-[rgba(0,0,0,0.2)] bg-white min-h-[320px]">

              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide sticky top-0 z-10">
                  <tr>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">#</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-8 text-center" title="Swap / Replace from Product Catalog">
                      <RefreshCw className="w-3.5 h-3.5 mx-auto text-[#626262]" />
                    </th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-12 text-center">Photo</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-28 font-mono">Product Code</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-32 font-mono">IMPA</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-48">Product Name</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)]">Specification</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Qty</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-20">Unit</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-32">Unit Price (MYR)</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-16 text-center">Disc (%)</th>
                    <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-32 text-right">Subtotal (MYR)</th>
                    <th className="p-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(quotation?.items || []).map((item, idx) => {
                    const isEven = idx % 2 === 1;
                    const isActive = activeRowIdx === idx;
                    const isDescEmpty = isBlank(item.description);
                    const isPriceEmpty = isBlank(item.unit_price);

                    const matchedCatalogProduct = findCatalogMatch(item.description);
                    const displayPhotoUrl = (item as any).image_url || matchedCatalogProduct?.image_url;

                    let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                    if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                    return (
                      <tr
                        key={item.id || idx}
                        onClick={() => setActiveRowIdx(idx)}
                        className={`border-b border-[rgba(0,0,0,0.1)] transition ${rowBgClass}`}
                      >
                        <td className="p-1.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="p-1.5 border-r border-[rgba(0,0,0,0.1)] text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRowToReplaceIndex(idx);
                              setIsProductPickerModalOpen(true);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition cursor-pointer"
                            title="Swap product from catalog"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mx-auto text-blue-600 hover:rotate-180 transition-transform duration-300" />
                          </button>
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center">
                          {displayPhotoUrl ? (
                            <img
                              src={displayPhotoUrl}
                              alt="Product"
                              className="w-8 h-8 object-cover border border-slate-300 mx-auto rounded-xs"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-slate-200 border border-slate-300 mx-auto flex items-center justify-center text-slate-400" title="No photo">
                              <ImageIcon className="w-3.5 h-3.5 opacity-50" />
                            </div>
                          )}
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <input
                            type="text"
                            value={item.product_code || item.item_code || ''}
                            onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                            placeholder="Code"
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-mono font-bold ${
                              isActive ? 'text-amber-300' : 'text-blue-700'
                            }`}
                          />
                        </td>

                        {/* Per Item IMPA Code Field */}
                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <input
                            type="text"
                            value={(item as any).impa_code || (item as any).category_name || ''}
                            onChange={(e) => handleItemChange(idx, 'impa_code' as any, e.target.value)}
                            placeholder="IMPA Code"
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-mono font-bold ${
                              isActive ? 'text-purple-300 placeholder-slate-400' : 'text-purple-900 placeholder-slate-400'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Product Name..."
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-bold ${
                              isActive
                                ? 'text-white placeholder-slate-400'
                                : isDescEmpty
                                ? 'text-amber-800 font-medium placeholder-amber-600/70'
                                : 'text-slate-900 placeholder-slate-400'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <textarea
                            rows={1}
                            value={item.specification || ''}
                            onChange={(e) => handleItemChange(idx, 'specification', e.target.value)}
                            placeholder="Technical specification, size, material..."
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-sans resize-y min-h-[28px] ${
                              isActive
                                ? 'text-white placeholder-slate-400'
                                : 'text-slate-700 placeholder-slate-400'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs text-center font-bold ${
                              isActive ? 'text-white' : 'text-slate-900'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs ${
                              isActive ? 'text-white' : 'text-slate-900'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className={`w-full p-1 text-xs font-mono transition ${
                              isPriceEmpty
                                ? 'bg-amber-200/90 text-amber-950 font-extrabold border border-amber-500 rounded'
                                : isActive
                                ? 'bg-transparent text-white border-none outline-none'
                                : 'bg-transparent text-slate-900 border-none outline-none'
                            }`}
                          />
                        </td>

                        <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discount_percent}
                            onChange={(e) => handleItemChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs text-center font-bold ${
                              isActive ? 'text-amber-300' : 'text-amber-700'
                            }`}
                          />
                        </td>

                        <td className={`p-1.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-bold text-xs ${
                          isActive ? 'text-white' : 'text-slate-900'
                        }`}>
                          {formatCurrency(item.total)}
                        </td>

                        <td className="p-1.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(idx);
                            }}
                            disabled={(quotation?.items || []).length === 1}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}


            {/* Unregistered Custom Items Notice Banner */}
            {unregisteredItems.length > 0 && (
              <div className="p-2.5 bg-amber-50 border-t border-amber-300 flex items-center justify-between gap-2 text-xs text-amber-950 shrink-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium text-slate-800">
                    <strong className="text-amber-950 font-bold">{unregisteredItems.length} unregistered item(s)</strong> in table ({unregisteredItems.map(i => `"${i.description}"`).join(', ')})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomItemsToProductCatalog}
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1 rounded cursor-pointer transition shadow-xs shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-200" />
                  <span>+ Save to Database</span>
                </button>
              </div>
            )}

            {/* FINANCIAL BREAKDOWN SUMMARY IN TAB 2 */}
            <div className="flex justify-end p-3 bg-[#f0f0f0] border-t border-[#dbdbdb] shrink-0">
              
              {/* Financial Breakdown Summary Card */}
              <div className="w-full md:w-96 bg-white border border-slate-300 rounded p-3.5 space-y-2 text-xs shadow-2xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-semibold">{formatCurrency(quotation?.subtotal || 0)}</span>
                </div>

                {(quotation?.discount_total || 0) > 0 && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span>Total Discount:</span>
                    <span className="font-mono font-semibold">-{formatCurrency(quotation?.discount_total || 0)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center gap-2 text-slate-700">
                  <span className="flex items-center gap-1 font-semibold">
                    VAT Tax (%):
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={quotation?.tax_percent || 11}
                      onChange={(e) => updateQuotationTotals(quotation?.items || [], parseFloat(e.target.value) || 0)}
                      className="w-12 bg-slate-100 border border-slate-300 px-1 py-0.5 text-center font-bold text-slate-900 rounded"
                    />
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(quotation?.tax_amount || 0)}</span>
                </div>

                <div className="flex justify-between items-center text-[11px] bg-blue-50/70 border border-blue-200 p-1.5 rounded text-blue-900">
                  <span className="font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Software Fee Allocation (1.75% Internal):
                  </span>
                  <span className="font-mono font-bold text-blue-800">
                    {formatCurrency(((quotation?.subtotal || 0) - (quotation?.discount_total || 0)) * 0.0175)}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-slate-900 font-extrabold text-base">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-[#0099ec]">{formatCurrency(quotation?.grand_total || 0)}</span>
                </div>
              </div>

            </div>


            {/* Footer Status Bar */}
            <footer className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] border-t border-[#7b7b7b] text-center py-1 text-[11px] text-[#3d3d3d] font-semibold shrink-0">
              <span>{(quotation?.items || []).length} Items Listed • Grand Total: {formatCurrency(quotation?.grand_total || 0)} • Realtime Live Sync Active</span>
            </footer>

          </div>
        )}

      </div>


      {/* MULTI-SELECT & ROW REPLACE PRODUCT PICKER MODAL */}
      {isProductPickerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-lg">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-slate-900 tracking-wide uppercase">
                  {rowToReplaceIndex !== null
                    ? `Select Replacement Product for Line Item #${rowToReplaceIndex + 1}`
                    : 'Select Products from Master Catalog (Multi-Select & Bulk Import)'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsProductPickerModalOpen(false);
                  setRowToReplaceIndex(null);
                }}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar & Select All Header */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="search"
                  placeholder="Search product code, IMPA code, product name, specs, category, or supplier..."
                  value={pickerSearchTerm}
                  onChange={(e) => setPickerSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-full pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {rowToReplaceIndex === null && (
                <button
                  type="button"
                  onClick={() => toggleSelectAllProductsInPicker(filteredPickerProducts)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded transition cursor-pointer shrink-0"
                >
                  {filteredPickerProducts.length > 0 && filteredPickerProducts.every((p) => selectedProductIds.includes(p.id))
                    ? 'Deselect All'
                    : `Select All (${filteredPickerProducts.length})`}
                </button>
              )}
            </div>

            {/* Scrollable Table Body with Horizontal & Vertical Overflow */}
            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white p-0">
              {filteredPickerProducts.length === 0 ? (
                <div className="py-20 text-center text-slate-500 text-xs font-bold space-y-1">
                  <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-700">No products found in catalog matching "{pickerSearchTerm}".</p>
                  <p className="text-slate-400 font-mono text-[11px]">Try adjusting your search keywords.</p>
                </div>
              ) : (
                <table className="min-w-[1280px] w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wide border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center border-r border-slate-200">
                        {rowToReplaceIndex !== null ? 'Pick' : 'Sel'}
                      </th>
                      <th className="p-2.5 w-14 text-center border-r border-slate-200">Photo</th>
                      <th className="p-2.5 w-28 border-r border-slate-200 font-mono">Product Code</th>
                      <th className="p-2.5 w-28 border-r border-slate-200 font-mono">IMPA</th>
                      <th className="p-2.5 w-52 border-r border-slate-200">Product Name</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[220px]">Specification</th>
                      <th className="p-2.5 w-28 border-r border-slate-200">Category</th>
                      <th className="p-2.5 w-32 border-r border-slate-200">Supplier Name</th>
                      <th className="p-2.5 w-16 text-center border-r border-slate-200">Unit</th>
                      <th className="p-2.5 w-32 text-right border-r border-slate-200">Selling Price (MYR)</th>
                      <th className="p-2.5 w-28 text-right border-r border-slate-200">Capital Cost (MYR)</th>
                      <th className="p-2.5 w-20 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPickerProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const hasRealPhoto = p.image_url && p.image_url.trim() !== '' && !p.image_url.includes('unsplash');

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            if (rowToReplaceIndex !== null) {
                              handleSelectProductInReplaceMode(p);
                            } else {
                              toggleSelectProductInPicker(p.id);
                            }
                          }}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/90 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2 text-center border-r border-slate-200">
                            {rowToReplaceIndex !== null ? (
                              <button
                                type="button"
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] rounded cursor-pointer transition shadow-2xs"
                              >
                                Select
                              </button>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                              />
                            )}
                          </td>

                          <td className="p-1 text-center border-r border-slate-200">
                            {hasRealPhoto ? (
                              <img
                                src={p.image_url!}
                                alt={p.product_name}
                                className="w-9 h-9 object-cover border border-slate-300 rounded mx-auto"
                              />
                            ) : (
                              <div className="w-9 h-9 bg-slate-100 border border-slate-200 rounded mx-auto flex items-center justify-center text-slate-400" title="No catalog image">
                                <Package className="w-4 h-4 opacity-50" />
                              </div>
                            )}
                          </td>

                          <td className="p-2 font-mono font-bold border-r border-slate-200 text-xs text-blue-700">
                            {p.product_code || `PRD-${p.id}`}
                          </td>

                          <td className="p-2 font-mono font-medium border-r border-slate-200 text-[11px] text-purple-900">
                            {p.impa_code || '—'}
                          </td>

                          <td className="p-2 border-r border-slate-200 font-bold text-xs text-slate-900">
                            <div className="line-clamp-2 leading-snug" title={p.product_name || ''}>
                              {p.product_name}
                            </div>
                          </td>

                          <td className="p-2 border-r border-slate-200 text-[11px] text-slate-600 leading-snug">
                            <div className="line-clamp-2">
                              {p.specification || p.offer || p.description || 'Standard catalog specification'}
                            </div>
                          </td>

                          <td className="p-2 border-r border-slate-200">
                            <span className="bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 text-[10px] font-bold rounded">
                              {p.category || 'Equipment'}
                            </span>
                          </td>

                          <td className="p-2 border-r border-slate-200 font-mono text-[11px]">
                            {p.supplier_name ? (
                              <span className="bg-slate-100 text-slate-800 border border-slate-300 font-medium px-2 py-0.5 rounded">
                                {p.supplier_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>

                          <td className="p-2 text-center border-r border-slate-200 font-medium">
                            {p.unit || 'Unit'}
                          </td>

                          <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-slate-900">
                            {formatCurrency(p.unit_price)}
                          </td>

                          <td className="p-2 text-right border-r border-slate-200 font-mono text-slate-600">
                            {formatCurrency(p.capital || 0)}
                          </td>

                          <td className="p-2 text-center font-mono font-bold text-[10px]">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded uppercase">
                              {p.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Bar */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 font-mono">
                {rowToReplaceIndex !== null ? (
                  <span>Click any product row above to replace line item #{rowToReplaceIndex + 1}</span>
                ) : (
                  <>
                    <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-300">
                      {selectedProductIds.length} Product(s) Selected
                    </span>
                    <span className="text-slate-500 font-sans font-normal text-[11px]">
                      (From total {productsCatalog.length} catalog items in MySQL)
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductPickerModalOpen(false);
                    setRowToReplaceIndex(null);
                  }}
                  className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded cursor-pointer hover:bg-white"
                >
                  Cancel
                </button>

                {rowToReplaceIndex === null && (
                  <button
                    type="button"
                    onClick={handleAddSelectedProductsFromModal}
                    disabled={selectedProductIds.length === 0}
                    className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-4 py-1.5 rounded border border-[#0060b0] shadow-xs cursor-pointer disabled:opacity-50 transition"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    <span>Add {selectedProductIds.length} Selected Product(s) to Line Items Table</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}


      {/* POP-UP MODAL: SOURCE RFQ FILE / TEXT VIEWER */}
      {isSourceModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-[#3d3d3d]">
                  Source RFQ Inspection & Gemini AI OCR Scanner — {quotation?.quotation_number}
                </h3>
              </div>
              <button
                onClick={() => setIsSourceModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs text-slate-900 bg-slate-50 flex-1">
              <div className="bg-white p-3.5 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Source Target Specification File:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-900 text-xs">
                    <FileType className="w-4 h-4 text-red-600" />
                    <span>Attachment for {quotation?.quotation_number} ({quotation?.company_name || 'Client RFQ Document'})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (quotation?.id) {
                        window.open(getApiUrl(`/api_ocr_scan.php?quo_id=${encodeURIComponent(quotation.id)}`), '_blank');
                      }
                    }}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded border border-slate-300 shadow-xs cursor-pointer transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Scan Result</span>
                  </button>

                  <button
                    onClick={handleScanPdfWithGeminiAiInModal}
                    disabled={isScanningModalOcr}
                    className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1.5 rounded border border-[#0060b0] shadow-xs cursor-pointer disabled:opacity-50 transition"
                  >
                    {isScanningModalOcr ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Scanning via Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-white" />
                        <span>Scan PDF dengan Gemini AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {scanOcrLog && (
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 space-y-2 text-emerald-400 text-[11px] shadow-lg animate-in fade-in font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      Google Gemini Flash AI Engine Execution Console
                    </span>
                  </div>

                  {isScanningModalOcr ? (
                    <div className="p-4 text-center space-y-2">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin mx-auto" />
                      <p className="text-slate-300 font-bold">Scanning PDF binary via Google Gemini Flash AI Engine...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap justify-between text-slate-300 text-[10px] gap-2 border-b border-slate-800 pb-2">
                        <span>Status: <strong className="text-emerald-400">{scanOcrLog.status}</strong></span>
                        <span>Scanned File: <strong className="text-amber-300">{scanOcrLog.scanned_pdf_file}</strong></span>
                      </div>

                      {scanOcrLog.prompt_sent_to_gemini && (
                        <div>
                          <span className="text-slate-400 block font-bold mb-1">[1] System Prompt & Payload Sent to Gemini API:</span>
                          <div className="bg-slate-900 p-2 rounded border border-slate-800 text-blue-300 text-[10px] whitespace-pre-wrap">
                            {scanOcrLog.prompt_sent_to_gemini}
                          </div>
                        </div>
                      )}

                      {scanOcrLog.extracted_raw_text && (
                        <div>
                          <span className="text-slate-400 block font-bold mb-1">[2] Extracted Raw Specification Text:</span>
                          <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-200 text-[10px] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {scanOcrLog.extracted_raw_text}
                          </div>
                        </div>
                      )}

                      {scanOcrLog.items && (
                        <div>
                          <span className="text-slate-400 block font-bold mb-1">[3] Gemini AI Structured Line Items Output:</span>
                          <pre className="bg-slate-900 p-2.5 rounded border border-slate-800 text-amber-300 text-[10px] max-h-40 overflow-y-auto">
                            {JSON.stringify(scanOcrLog.items, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white p-3.5 border border-slate-300 space-y-2 shadow-2xs">
                <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-1.5">
                  Original Email Specification Text:
                </h4>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed font-sans bg-slate-50 p-2.5 border border-slate-200">
                  {quotation?.notes || 'Spesifikasi email belum diisi.'}
                </p>
              </div>

            </div>

            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex justify-end shrink-0">
              <button
                onClick={() => setIsSourceModalOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Close Inspection
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POP-UP MODAL: HISTORY AUDIT TRAIL LOG VIEWER */}
      {isHistoryLogModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-600" />
                <h3 className="font-extrabold text-xs text-[#3d3d3d]">
                  History Audit Trail Log — {quotation?.quotation_number}
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryLogModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2 text-slate-200 font-mono shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                  <span className="font-bold text-amber-400">MySQL Audit Log Events</span>
                  <span>ID SPH: {quotation?.id}</span>
                </div>

                {quotation?.history_log ? (
                  <pre className="text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {typeof quotation.history_log === 'string'
                      ? quotation.history_log
                      : JSON.stringify(quotation.history_log, null, 2)}
                  </pre>
                ) : (
                  <div className="py-6 text-center text-slate-500 font-sans">
                    <p className="font-bold text-slate-400">No audit history log recorded yet.</p>
                    <p className="text-[11px]">Every creation, modification, manager approval, and email dispatch will be recorded here.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex justify-end shrink-0">
              <button
                onClick={() => setIsHistoryLogModalOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Close Audit Log
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default QuotationBuilder;
