// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Quotation, QuotationItem } from '../types/erp';
import { Plus, Trash2, Send, FileCheck, X, Paperclip, FileType, CheckCircle2, Sparkles, Loader2, Terminal, Save, Eye, MoreVertical, Package, Image as ImageIcon, PlusCircle, Search, RefreshCw } from 'lucide-react';
import { ProductItem } from './ProductCatalog';
import { getApiUrl } from '../utils/api';

interface QuotationBuilderProps {
  initialQuotation: Quotation;
  onSaveAndPreviewDoc: (quo: Quotation) => void;
  onSaveAndSendEmail: (quo: Quotation) => void;
  onCancel?: () => void;
  currentUser?: any;
}

export const QuotationBuilder: React.FC<QuotationBuilderProps> = ({
  initialQuotation,
  onSaveAndPreviewDoc,
  onSaveAndSendEmail,
  currentUser,
}) => {
  const [quotation, setQuotation] = useState<Quotation>(initialQuotation || {});
  const [savedQuotations, setSavedQuotations] = useState<Quotation[]>([]);
  const [productsCatalog, setProductsCatalog] = useState<ProductItem[]>([]);
  const [selectedQuoId, setSelectedQuoId] = useState<string>('');
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const [isSavingMySQL, setIsSavingMySQL] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Header Dropdown Menu & Modals State
  const [isHeaderKebabOpen, setIsHeaderKebabOpen] = useState<boolean>(false);
  const [isHistoryLogModalOpen, setIsHistoryLogModalOpen] = useState<boolean>(false);

  // Helper: Clean generic default text like "Extract to...", "Summary:..." from AI notes
  const cleanAiNotesText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
      .replace(/^extract\s+to\s*:?\s*/i, '')
      .replace(/^extracted\s+details\s*:?\s*/i, '')
      .replace(/^summary\s*:?\s*/i, '')
      .trim();
  };

  // Source Pop-up Modal & AI Gemini OCR Scanning Log States
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isScanningModalOcr, setIsScanningModalOcr] = useState<boolean>(false);
  const [scanOcrLog, setScanOcrLog] = useState<any | null>(null);

  // MULTI-SELECT & ROW REPLACE PRODUCT PICKER MODAL STATES
  const [isProductPickerModalOpen, setIsProductPickerModalOpen] = useState<boolean>(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [pickerSearchTerm, setPickerSearchTerm] = useState<string>('');
  const [rowToReplaceIndex, setRowToReplaceIndex] = useState<number | null>(null);

  // Load list of saved quotations from MySQL database for dropdown selector
  const loadQuotationsListFromMySQL = () => {
    fetch(getApiUrl('/api_quotations.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setSavedQuotations(resData.data);
        }
      })
      .catch((err) => console.log('Load saved quotations error:', err));
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
  }, []);

  // Sync state whenever initialQuotation prop changes
  useEffect(() => {
    if (initialQuotation) {
      const items = initialQuotation.items && initialQuotation.items.length > 0 ? initialQuotation.items : [
        {
          id: 'item-1',
          description: initialQuotation.notes || '',
          quantity: 1,
          unit: 'Package',
          unit_price: 0,
          discount_percent: 0,
          total: 0,
        }
      ];

      setQuotation({
        ...initialQuotation,
        items,
        quotation_number: initialQuotation.quotation_number || `SPH-ABM/MY/2026/0${Math.floor(Math.random() * 900 + 100)}`,
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

    const target = savedQuotations.find((q) => q.id === quoId);
    if (target) {
      const items = target.items && target.items.length > 0 ? target.items : [
        {
          id: 'item-1',
          description: target.notes || '',
          quantity: 1,
          unit: 'Package',
          unit_price: 0,
          discount_percent: 0,
          total: 0,
        }
      ];

      setQuotation({
        ...target,
        items,
      });
    }
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
    updatedItems[index] = {
      ...updatedItems[index],
      description: product.product_name,
      unit: product.unit || 'Package',
      unit_price: product.unit_price || 0,
      image_url: product.image_url,
    };
    updateQuotationTotals(updatedItems, quotation?.tax_percent || 11);
    setSaveSuccessMessage(`Applied specs & price from product catalog: "${product.product_name}"`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Add custom line items from table to Master Product Catalog database (PRESERVES FILLED PRICES)
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
          unit_price: item.unit_price || 0, // PRESERVES FILLED PRICE
          image_url: (item as any).image_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80',
          category: 'Equipment',
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.status === 'success') {
            savedCount++;
            if (savedCount === unregisteredItems.length) {
              setSaveSuccessMessage(`${savedCount} custom item(s) saved to Master Product Catalog database with filled prices!`);
              setTimeout(() => setSaveSuccessMessage(null), 4000);
              loadProductsCatalogFromMySQL();
            }
          }
        });
    });
  };

  // Add multiple selected products from Product Catalog Modal into SPH Table (or Replace Row)
  const handleAddSelectedProductsFromModal = () => {
    if (selectedProductIds.length === 0) return;

    if (rowToReplaceIndex !== null) {
      // Single Row Replace Mode
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

    // Multi-Select Add Mode
    const newItems: QuotationItem[] = selectedProductIds.map((id, idx) => {
      const prod = productsCatalog.find((p) => p.id === id);
      return {
        id: `item-picker-${Date.now()}-${idx}`,
        description: prod?.product_name || 'Product Specification',
        quantity: 1,
        unit: prod?.unit || 'Package',
        unit_price: prod?.unit_price || 0,
        discount_percent: prod?.discount_percent || 0,
        total: prod?.unit_price || 0,
        image_url: prod?.image_url,
      } as any;
    });

    const currentItems = (quotation?.items || []).filter(it => it.description && it.description.trim() !== '');
    const combinedItems = [...currentItems, ...newItems];

    updateQuotationTotals(combinedItems, quotation?.tax_percent || 11);
    setSelectedProductIds([]);
    setIsProductPickerModalOpen(false);
    setSaveSuccessMessage(`${newItems.length} products added from Master Database to SPH Table!`);
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
      // In replace mode, single selection applies immediately or highlights
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
        console.log('Gemini OCR backend response:', resData);
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

          setSaveSuccessMessage(`Hasil Scan AI Gemini PDF (${formattedItems.length} item) berhasil diisikan ke tabel SPH!`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
        } else if (resData.status === 'skipped') {
          setScanOcrLog({ status: 'skipped', message: resData.message || 'File lampiran RFQ tidak ditemukan.' });
        } else {
          setScanOcrLog({ status: 'error', message: resData.message || scanRes?.reason || 'Gagal mengekstrak item dari dokumen.' });
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const saveQuotationToMySQL = (quo: Quotation, callback?: () => void) => {
    setIsSavingMySQL(true);
    const payload = {
      ...quo,
      status: (quo.status && (quo.status === 'terkirim' || quo.status === 'penawaran_terkirim' || quo.status === 'deal')) ? quo.status : 'siap_kirim',
      user_name: currentUser?.name || 'Admin',
      user_email: currentUser?.email || 'admin@abmalaya.com',
    };
    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((resData) => {
        console.log('Save Quotation MySQL response:', resData);
        setSaveSuccessMessage(`Quotation ${quo.quotation_number} saved successfully to MySQL database (abmalaya_erp.quotations)!`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        loadQuotationsListFromMySQL();
        if (callback) callback();
      })
      .catch((err) => console.log('Save Quotation MySQL error:', err))
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
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        <div className="flex items-center gap-3 text-xs">
          <select
            value={selectedQuoId}
            onChange={(e) => handleSelectQuotationFromDropdown(e.target.value)}
            className="bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] px-3 py-1 text-xs text-[#3d3d3d] font-bold rounded-md shadow-inner cursor-pointer max-w-xs focus:outline-none"
          >
            <option value="">-- Select Saved SPH / RFQ --</option>
            {savedQuotations.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quotation_number} • {q.company_name || q.client_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsSourceModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] text-[#3d3d3d] font-bold text-xs px-3 py-1 rounded-md shadow-inner transition cursor-pointer hover:bg-white"
            title="View Original RFQ Source File / Message"
          >
            <Paperclip className="w-3.5 h-3.5 text-[#0099ec]" />
            <span>Source RFQ</span>
          </button>
        </div>

        {/* Action Buttons: Save + Polkadot Kebab Dropdown */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => saveQuotationToMySQL(quotation)}
            disabled={isSavingMySQL}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-4 py-1.5 rounded-md border border-[#0060b0] shadow-sm cursor-pointer disabled:opacity-50 transition"
          >
            {isSavingMySQL ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4 text-white" />
            )}
            <span>Save</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsHeaderKebabOpen(!isHeaderKebabOpen)}
              className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white border border-[#a0a0a0] text-[#3d3d3d] font-bold rounded-md shadow-inner cursor-pointer transition flex items-center justify-center"
              title="More Actions Menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isHeaderKebabOpen && (
              <div className="absolute right-0 top-9 w-52 bg-white border border-slate-300 shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 text-xs font-sans rounded-md">
                
                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left transition"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  <span>Save</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    onSaveAndPreviewDoc(quotation);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Preview Document</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    onSaveAndSendEmail(quotation);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Send Email</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation, () => onSaveAndSendEmail(quotation));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Save & Send Email</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    saveQuotationToMySQL(quotation, () => onSaveAndPreviewDoc(quotation));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-blue-50 hover:text-blue-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Save & Preview PDF</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    setIsHistoryLogModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-amber-50 hover:text-amber-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Terminal className="w-4 h-4 text-amber-600" />
                  <span>History Audit Trail Log</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    setIsSourceModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-sky-50 hover:text-sky-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Paperclip className="w-4 h-4 text-sky-600" />
                  <span>Source RFQ Details</span>
                </button>

                <button
                  onClick={() => {
                    setIsHeaderKebabOpen(false);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('navigate_settings_tab', { detail: 'paper' }));
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-800 hover:bg-purple-50 hover:text-purple-700 font-semibold cursor-pointer text-left border-t border-slate-100 transition"
                >
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>Advance SPH Settings</span>
                </button>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* MySQL Connection Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* SPH HEADER INFO CARD: LOGO, FROM (AB MALAYA), TO (CLIENT), & MYSQL METADATA */}
      <div className="bg-white border-b border-[#dbdbdb] p-4 shadow-xs shrink-0 w-full font-sans">
        
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* Top Title & Branding Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-md flex items-center justify-center text-white font-extrabold text-lg tracking-wider border border-slate-800 shadow-xs">
                ABM
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-900 tracking-tight">SURAT PENAWARAN HARGA (SPH) / QUOTATION</h2>
                <p className="text-[11px] text-slate-500 font-mono">AB MALAYA SDN. BHD. • MALAYSIA INDUSTRIAL LOGISTICS</p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded text-right">
                <span className="text-[10px] text-slate-500 block font-sans font-bold uppercase">No. SPH:</span>
                <span className="font-extrabold text-blue-700">{quotation?.quotation_number || 'SPH-ABM/MY/2026/0403'}</span>
              </div>
              <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded text-right">
                <span className="text-[10px] text-slate-500 block font-sans font-bold uppercase">Status / Phase:</span>
                <span className="font-bold text-emerald-700 uppercase text-[11px]">{quotation?.status || 'Draft'}</span>
              </div>
            </div>
          </div>

          {/* Grid: FROM vs TO Info Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* FROM: AB MALAYA SENDER INFO */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>FROM (Pengirim Penawaran):</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Official Provider</span>
              </div>
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-slate-900 text-xs">AB MALAYA SDN. BHD. (Reg: 202601001234)</p>
                <p className="text-slate-600">No. 12, Jalan Industrial Park, 50000 Kuala Lumpur, Malaysia</p>
                <p className="text-slate-600 font-mono">Email: sales@abmalaya.com | Tel: +60 3-8000 1234</p>
                <p className="text-slate-500 text-[11px]">Dibuat Oleh: <span className="font-bold text-slate-700">{quotation?.created_by || currentUser?.name || 'Aiman Zaki'}</span></p>
              </div>
            </div>

            {/* TO: CLIENT RECIPIENT INFO */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-md p-3.5 space-y-2">
              <div className="flex justify-between items-center border-b border-blue-200 pb-1.5">
                <span className="font-extrabold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>TO (Tujuan Penawaran / Klien):</span>
                </span>
                <span className="text-[10px] text-blue-700 font-mono font-bold">Client Reply Target</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Name:</label>
                  <input
                    type="text"
                    value={quotation?.client_name || ''}
                    onChange={(e) => setQuotation({ ...quotation, client_name: e.target.value })}
                    placeholder="Client Contact Name"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Reply Email (JSON Selector):</label>
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
                        <div className="flex items-center gap-1">
                          <select
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateEmailJson(val, optionsList);
                            }}
                            className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-xs font-mono font-bold text-blue-800 focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Select Client Email --</option>
                            {optionsList.map((opt, oIdx) => (
                              <option key={oIdx} value={opt.email}>
                                {opt.email} ({opt.source})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="email"
                            placeholder="+ Add Custom Email"
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
                            className="w-full bg-white/80 border border-slate-300 rounded px-2 py-0.5 text-[10px] font-mono text-slate-700"
                            title="Press Enter to add new email to JSON list"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Client Company Name:</label>
                  <input
                    type="text"
                    value={quotation?.company_name || ''}
                    onChange={(e) => setQuotation({ ...quotation, company_name: e.target.value })}
                    placeholder="Client Company Name (Sdn. Bhd. / PT / Inc.)"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Database Metadata Footer Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
            <div>
              <span>Date Issued: <strong className="text-slate-700">{quotation?.date_issued || date}</strong></span> • 
              <span> Valid Until: <strong className="text-slate-700">{quotation?.valid_until || '14 Days'}</strong></span> • 
              <span> Created At: <strong className="text-slate-700">{quotation?.created_at || '—'}</strong></span>
            </div>
            <div>
              <span>ACC Status: <strong className={quotation?.approved_by ? 'text-emerald-700 font-bold' : 'text-amber-700'}>{quotation?.approved_by ? 'ACC Approved' : 'Pending ACC'}</strong></span>
            </div>
          </div>

        </div>
      </div>

      {/* ITUNES TABLE-WRAP CONTAINER */}
      <div className="flex-1 p-0 overflow-y-auto space-y-0 w-full bg-[#f0f0f0]">
        
        <div className="w-full">
          
          {/* ITUNES PLAYLIST INFO BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 bg-[#e9e9e9] border-b border-[#dbdbdb]">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-[#3d3d3d] uppercase tracking-wider">
                SPH Item Specifications Table — {quotation?.quotation_number || 'SPH-ABM/MY/2026/0403'}
              </span>
            </div>

            {/* TWO ACTION BUTTONS: BLANK ITEM LINE OR PICK FROM PRODUCTS DATABASE (MULTI-SELECT) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRowToReplaceIndex(null);
                  setIsProductPickerModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3 py-1 rounded-sm border border-[#0060b0] shadow-sm cursor-pointer transition"
              >
                <Package className="w-3.5 h-3.5" />
                <span>+ Select from Products Database (Multi-Select)</span>
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

          {/* EXACT ITUNES PROJECT SCROLL TABLE DESIGN */}
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">^</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-8 text-center" title="Klik icon berputar ini pada baris mana saja untuk mengganti barang dari Katalog Produk">
                    <RefreshCw className="w-3.5 h-3.5 mx-auto text-[#626262]" />
                  </th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-14 text-center">Photo</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-28 font-mono">Kode Barang</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-48">Nama Produk</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)]">Spesifikasi Detail</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Qty</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-24">Satuan</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-36">Harga Unit (RM)</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Disc (%)</th>
                  <th className="p-2 border-r border-[rgba(0,0,0,0.1)] w-36 text-right">Subtotal (RM)</th>
                  <th className="p-2 text-center w-12">Action</th>
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
                  const displayProductCode = item.product_code || item.item_code || matchedCatalogProduct?.product_code || '—';

                  let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                  if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => setActiveRowIdx(idx)}
                      className={`border-b border-[rgba(0,0,0,0.1)] transition ${rowBgClass}`}
                    >
                      <td className="p-2 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                        {idx + 1}
                      </td>

                      {/* ROTATING REFRESH SVG ICON COLUMN TO PICK/SWAP PRODUCT FROM CATALOG POP-UP */}
                      <td className="p-2 border-r border-[rgba(0,0,0,0.1)] text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRowToReplaceIndex(idx);
                            setIsProductPickerModalOpen(true);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition cursor-pointer"
                          title="Klik untuk mengganti barang baris ini dari Katalog Produk Master"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mx-auto text-blue-600 hover:rotate-180 transition-transform duration-300" />
                        </button>
                      </td>

                      {/* PRODUCT THUMBNAIL PHOTO COLUMN */}
                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center">
                        {displayPhotoUrl ? (
                          <img
                            src={displayPhotoUrl}
                            alt="Product"
                            className="w-10 h-10 object-cover border border-slate-300 mx-auto shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-200 border border-slate-300 mx-auto flex items-center justify-center text-slate-400" title="No catalog photo">
                            <ImageIcon className="w-4 h-4 opacity-50" />
                          </div>
                        )}
                      </td>

                      {/* KODE BARANG COLUMN */}
                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                        <input
                          type="text"
                          value={item.product_code || item.item_code || ''}
                          onChange={(e) => handleItemChange(idx, 'product_code', e.target.value)}
                          placeholder="Code (e.g. IMPA-49)"
                          className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-mono font-bold ${
                            isActive ? 'text-amber-300' : 'text-blue-700'
                          }`}
                        />
                      </td>

                      {/* NAMA PRODUK COLUMN */}
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

                      {/* SPESIFIKASI DETAIL COLUMN */}
                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                        <textarea
                          rows={2}
                          value={item.specification || ''}
                          onChange={(e) => handleItemChange(idx, 'specification', e.target.value)}
                          placeholder="Technical specification, size, material, warranty..."
                          className={`w-full bg-transparent border-none outline-none focus:ring-0 p-1 text-xs font-sans resize-none ${
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

                      {/* UNIT PRICE COLUMN — HIGHLIGHTED IN YELLOW WHEN 0/EMPTY */}
                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)]">
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="0 (Manual entry)"
                          className={`w-full p-1 text-xs font-mono transition ${
                            isPriceEmpty
                              ? 'bg-amber-200/90 text-amber-950 font-extrabold border-2 border-amber-500 shadow-inner'
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

                      <td className={`p-2 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-bold text-xs ${
                        isActive ? 'text-white' : 'text-slate-900'
                      }`}>
                        {formatCurrency(item.total)}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(idx);
                          }}
                          disabled={(quotation?.items || []).length === 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CONDITIONAL SINGLE WARNING BANNER AT THE VERY BOTTOM OF TABLE (ONLY SHOWN IF UNREGISTERED ITEMS EXIST) */}
          {unregisteredItems.length > 0 && (
            <div className="p-3 bg-amber-50/90 border-b border-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 font-sans animate-in fade-in">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-amber-950">
                    Custom Item Notice ({unregisteredItems.length} unregistered products):
                  </p>
                  <p className="text-slate-800 font-medium">
                    {unregisteredItems.map((it) => `"${it.description}"`).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Unregistered products in the table above can be saved directly into the Master Product Catalog database (with specifications & pricing).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustomItemsToProductCatalog}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-3.5 py-2 rounded cursor-pointer transition shadow-xs shrink-0"
              >
                <PlusCircle className="w-4 h-4 text-amber-200" />
                <span>+ Add {unregisteredItems.length} Custom Items to Database</span>
              </button>
            </div>
          )}

        </div>

        {/* SUMMARY & FOOTER STATS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-[#f0f0f0] border-t border-[#dbdbdb] w-full pb-8">
          <div className="md:col-span-7 bg-[#FAFAFA] border border-[rgba(0,0,0,0.15)] p-3.5 space-y-2">
            <label className="block text-xs font-bold text-[#3d3d3d]">
              Quotation Notes & Warranty Terms:
            </label>
            <textarea
              rows={3}
              value={quotation?.notes || ''}
              onChange={(e) => setQuotation({ ...quotation, notes: e.target.value })}
              placeholder="E.g. Shipping cost excluded. Includes 1-year official manufacturer warranty."
              className="w-full bg-white border border-slate-300 p-2 text-xs text-slate-900 focus:ring-1 focus:ring-[#0099ec]"
            />
          </div>

          <div className="md:col-span-5 bg-[#F1F4F7] border border-[rgba(0,0,0,0.15)] p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[#3d3d3d]">
              <span>Gross Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(quotation?.subtotal || 0)}</span>
            </div>

            {(quotation?.discount_total || 0) > 0 && (
              <div className="flex justify-between items-center text-amber-700">
                <span>Total Discount:</span>
                <span className="font-mono font-semibold">-{formatCurrency(quotation?.discount_total || 0)}</span>
              </div>
            )}

            <div className="flex justify-between items-center gap-2 text-[#3d3d3d]">
              <span className="flex items-center gap-1 font-semibold">
                VAT Tax (%):
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={quotation?.tax_percent || 11}
                  onChange={(e) => updateQuotationTotals(quotation?.items || [], parseFloat(e.target.value) || 0)}
                  className="w-14 bg-white border border-slate-300 px-1.5 py-0.5 text-center font-bold text-slate-900"
                />
              </span>
              <span className="font-mono font-semibold">{formatCurrency(quotation?.tax_amount || 0)}</span>
            </div>

            <div className="flex justify-between items-center text-blue-700 font-bold">
              <span>Software Fee (1.75%):</span>
              <span className="font-mono font-bold">{formatCurrency(((quotation?.subtotal || 0) - (quotation?.discount_total || 0)) * 0.0175)}</span>
            </div>

            <div className="border-t border-[#dbdbdb] pt-2 flex justify-between items-center text-[#3d3d3d] font-extrabold text-sm sm:text-base">
              <span>GRAND TOTAL:</span>
              <span className="font-mono text-[#0099ec]">{formatCurrency(quotation?.grand_total || 0)}</span>
            </div>
          </div>
        </div>

        {/* ITUNES FOOTER SUMMARY LINE */}
        <footer className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] border-t border-b border-[#7b7b7b] text-center py-1.5 text-[11px] text-[#3d3d3d] font-semibold w-full shrink-0">
          <span>{(quotation?.items || []).length} Items Listed • Grand Total: {formatCurrency(quotation?.grand_total || 0)} • Live MySQL Connection (abmalaya_erp)</span>
        </footer>

      </div>

      {/* MULTI-SELECT & ROW REPLACE PRODUCT PICKER MODAL */}
      {isProductPickerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  {rowToReplaceIndex !== null
                    ? `Select Replacement Product for Line Item #${rowToReplaceIndex + 1}`
                    : 'Select Products from Master Catalog (Multi-Select)'}
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
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
                <input
                  type="search"
                  placeholder="Search product code, name, specs..."
                  value={pickerSearchTerm}
                  onChange={(e) => setPickerSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-full pl-9 pr-3 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {rowToReplaceIndex === null && (
                <button
                  type="button"
                  onClick={() => toggleSelectAllProductsInPicker(filteredPickerProducts)}
                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded transition cursor-pointer shrink-0"
                >
                  {filteredPickerProducts.length > 0 && filteredPickerProducts.every((p) => selectedProductIds.includes(p.id))
                    ? 'Deselect All'
                    : 'Select All Filtered'}
                </button>
              )}
            </div>

            {/* Table Body with Checkboxes or Click-to-Replace */}
            <div className="flex-1 overflow-y-auto bg-white p-0">
              {filteredPickerProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs font-bold">
                  No products found in catalog.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wide border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center border-r border-slate-200">
                        {rowToReplaceIndex !== null ? 'Pick' : 'Sel'}
                      </th>
                      <th className="p-2.5 w-12 text-center border-r border-slate-200">Photo</th>
                      <th className="p-2.5 w-28 border-r border-slate-200">Product Code</th>
                      <th className="p-2.5 border-r border-slate-200">Product Name</th>
                      <th className="p-2.5 border-r border-slate-200">Specification</th>
                      <th className="p-2.5 w-28 border-r border-slate-200">Supplier / Seller</th>
                      <th className="p-2.5 w-24 border-r border-slate-200">Category</th>
                      <th className="p-2.5 w-16 text-center border-r border-slate-200">Unit</th>
                      <th className="p-2.5 w-28 text-right border-r border-slate-200">Unit Price (MYR)</th>
                      <th className="p-2.5 w-16 text-center">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPickerProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
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
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded cursor-pointer"
                              >
                                Pilih
                              </button>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by row onClick
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                              />
                            )}
                          </td>

                          <td className="p-1 text-center border-r border-slate-200">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.product_name}
                                className="w-8 h-8 object-cover border border-slate-300 rounded mx-auto"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-slate-200 border border-slate-300 rounded mx-auto flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-3.5 h-3.5 opacity-50" />

                              </div>
                            )}
                          </td>

                          <td className="p-2 font-mono font-bold border-r border-slate-200 text-xs text-blue-700">
                            {p.product_code}
                          </td>

                          <td className="p-2 border-r border-slate-200 font-bold text-xs text-slate-900">
                            {p.product_name}
                          </td>

                          <td className="p-2 border-r border-slate-200 text-[11px] text-slate-600 italic">
                            {p.specification || p.description || 'Standard catalog specification'}
                          </td>

                          <td className="p-2 border-r border-slate-200 font-mono text-[10px]">
                            {p.supplier_name ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded">
                                {p.supplier_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>

                          <td className="p-2 border-r border-slate-200">
                            <span className="bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold rounded">
                              {p.category || 'Equipment'}
                            </span>
                          </td>

                          <td className="p-2 text-center border-r border-slate-200 font-medium">
                            {p.unit || 'Unit'}
                          </td>

                          <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-slate-800">
                            {formatCurrency(p.unit_price)}
                          </td>

                          <td className="p-2 text-center font-mono font-bold text-slate-600">
                            {p.stock_quantity ?? 50}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold text-slate-800">
                {rowToReplaceIndex !== null
                  ? `Click any product above to replace item on Line #${rowToReplaceIndex + 1}`
                  : `${selectedProductIds.length} Products Selected`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductPickerModalOpen(false);
                    setRowToReplaceIndex(null);
                  }}
                  className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
                >
                  Cancel
                </button>

                {rowToReplaceIndex === null && (
                  <button
                    type="button"
                    onClick={handleAddSelectedProductsFromModal}
                    disabled={selectedProductIds.length === 0}
                    className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-4 py-1.5 rounded-sm border border-[#0060b0] shadow-sm cursor-pointer disabled:opacity-50 transition"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    <span>Add {selectedProductIds.length} Selected Items to SPH</span>
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

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-900 bg-slate-50 flex-1">
              <div className="bg-white p-4 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Source Target Specification File:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
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
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-md border border-slate-300 shadow-xs cursor-pointer transition"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>View Scan Result</span>
                  </button>


                  <button
                    onClick={handleScanPdfWithGeminiAiInModal}
                    disabled={isScanningModalOcr}
                    className="flex items-center gap-2 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-4 py-2 rounded-md border border-[#0060b0] shadow-md cursor-pointer disabled:opacity-50 transition"
                  >
                    {isScanningModalOcr ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Scanning via Gemini Flash AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                        <span>Scan PDF dengan Gemini AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {scanOcrLog && (
                <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2 text-emerald-400 text-[11px] shadow-lg animate-in fade-in" style={{ fontFamily: "'Eurostile', 'Microgramma D OT', 'Euro Stile', monospace" }}>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      Google Gemini Flash AI Engine Execution Console
                    </span>
                  </div>

                  {isScanningModalOcr ? (
                    <div className="p-4 text-center space-y-2">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                      <p className="text-slate-300 font-bold">Scanning authentic 159.7 KB PDF binary via Google Gemini Flash AI Engine...</p>
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

              <div className="bg-white p-4 border border-slate-300 space-y-2 shadow-2xs">
                <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2">
                  Original Email Specification Text:
                </h4>
                <p className="whitespace-pre-line text-slate-800 leading-relaxed font-sans bg-slate-50 p-3 border border-slate-200">
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
                    <p className="font-bold text-slate-400">Belum ada jejak riwayat khusus tersimpan.</p>
                    <p className="text-[11px]">Setiap tindakan pembuatan, pengubahan, approval ACC, dan pengiriman email akan dicatat di sini.</p>
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
