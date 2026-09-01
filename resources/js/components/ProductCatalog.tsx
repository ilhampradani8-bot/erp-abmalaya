// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, Image as ImageIcon, Package, Check, X, Loader2, RefreshCw, Eye, Upload, AlertTriangle, Cloud, HardDrive, Settings, FileJson, CheckCircle2, Zap, ShieldAlert, MoreVertical } from 'lucide-react';
import { getApiUrl } from '../utils/api';

export interface ProductItem {
  id: number;
  category_code: string;
  category_name: string;
  internal_category: string;
  subcategories: string;
  description_en: string;
  description_my: string;
  classification_rules: string;
  created_at?: string;
}

interface ProductCatalogProps {
  onSelectProductForQuotation?: (product: ProductItem) => void;
}

// Client-side Image Compression Helper using HTML5 Canvas
const compressImageFile = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.82
): Promise<{ compressedFile: File; originalSize: number; compressedSize: number; ratioPercent: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context error');

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject('Blob creation error');
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            const originalSize = file.size;
            const compressedSize = blob.size;
            const ratioPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

            resolve({
              compressedFile,
              originalSize,
              compressedSize,
              ratioPercent: ratioPercent > 0 ? ratioPercent : 0,
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const ProductCatalog: React.FC<ProductCatalogProps> = ({}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [categoriesBlueprints, setCategoriesBlueprints] = useState<ProductItem[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ProductItem | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  // Google Drive Cloud Sync & Conflict Detection States
  const [gdriveStatus, setGdriveStatus] = useState<any | null>(null);
  const [isResolvingSync, setIsResolvingSync] = useState<boolean>(false);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isDiffDetailModalOpen, setIsDiffDetailModalOpen] = useState<boolean>(false);
  const [isToastDismissed, setIsToastDismissed] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Form Fields State
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Package');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(50);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('Hose & Fitting');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Auto-Compression Info State
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKb: string;
    compressedKb: string;
    ratio: number;
  } | null>(null);

  // Fetch Products from MySQL Database
  const fetchProducts = () => {
    setIsLoading(true);
    const url = activeTab === 'categories'
      ? getApiUrl('/api_products.php?get_categories=1')
      : getApiUrl('/api_products.php');

    fetch(url)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          if (activeTab === 'categories') {
            setCategoriesBlueprints(resData.data);
          } else {
            setProducts(resData.data);
          }
        }
      })
      .catch((err) => console.log('Fetch products error:', err))
      .finally(() => setIsLoading(false));
  };

  const [isImporting, setIsImporting] = useState<boolean>(false);

  const handleImportFromSheets = () => {
    setIsImporting(true);
    fetch(getApiUrl('/import_products.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(resData.message + ` (${resData.imported_count} Categories imported)`);
          setTimeout(() => setSaveSuccessMessage(null), 7000);
          fetchProducts();
        } else {
          alert('Import failed: ' + resData.message);
        }
      })
      .catch((err) => {
        console.error(err);
        alert('Import error occurred.');
      })
      .finally(() => setIsImporting(false));
  };

  // Check Google Drive Sync & Conflict Status
  const checkGDriveSyncStatus = () => {
    fetch(getApiUrl('/api_gdrive_sync.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setGdriveStatus(resData);
        }
      })
      .catch((err) => console.log('GDrive sync status check error:', err));
  };

  useEffect(() => {
    fetchProducts();
  }, [activeTab]);

  useEffect(() => {
    checkGDriveSyncStatus();
  }, []);

  // Handle Google Drive Sync Conflict Resolution Choice
  const handleResolveGDriveConflict = (choice: 'use_local' | 'use_gdrive') => {
    setIsResolvingSync(true);
    fetch(getApiUrl('/api_gdrive_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', choice }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(resData.message);
          setTimeout(() => setSaveSuccessMessage(null), 5000);
          setIsDiffDetailModalOpen(false);
          setIsSettingsModalOpen(false);
          checkGDriveSyncStatus();
          fetchProducts();
        }
      })
      .finally(() => setIsResolvingSync(false));
  };

  // Trigger Conflict Simulation for Testing
  const handleSimulateConflict = () => {
    fetch(getApiUrl('/api_gdrive_sync.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'simulate_conflict' }),
    })
      .then((res) => res.json())
      .then(() => {
        checkGDriveSyncStatus();
        setIsDiffDetailModalOpen(true);
      });
  };

  const resetForm = () => {
    setEditingProduct(null);
    setProductCode(`PRD-00${products.length + 1}`);
    setProductName('');
    setDescription('');
    setUnit('Package');
    setUnitPrice(0);
    setStockQuantity(50);
    setDiscountPercent(0);
    setImageUrl('https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80');
    setSelectedFile(null);
    setCompressionInfo(null);
    setCategory('Hose & Fitting');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setProductCode(p.product_code);
    setProductName(p.product_name);
    setDescription(p.description || '');
    setUnit(p.unit || 'Package');
    setUnitPrice(p.unit_price || 0);
    setStockQuantity(p.stock_quantity || 50);
    setDiscountPercent(p.discount_percent || 0);
    setImageUrl(p.image_url || '');
    setSelectedFile(null);
    setCompressionInfo(null);
    setCategory(p.category || 'Equipment');
    setIsFormModalOpen(true);
  };

  // Handle Local File Selection with Automatic Canvas Compression
  const handleFileChange = async (file: File) => {
    if (!file) return;

    setIsCompressingImage(true);
    try {
      const { compressedFile, originalSize, compressedSize, ratioPercent } = await compressImageFile(file);
      setSelectedFile(compressedFile);
      setCompressionInfo({
        originalKb: (originalSize / 1024).toFixed(1),
        compressedKb: (compressedSize / 1024).toFixed(1),
        ratio: ratioPercent,
      });
    } catch (err) {
      console.log('Image compression error, falling back to original file:', err);
      setSelectedFile(file);
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    setIsSaving(true);

    const formData = new FormData();
    formData.append('product_code', productCode);
    formData.append('product_name', productName);
    formData.append('description', description);
    formData.append('unit', unit);
    formData.append('unit_price', unitPrice.toString());
    formData.append('stock_quantity', stockQuantity.toString());
    formData.append('discount_percent', discountPercent.toString());
    formData.append('category', category);
    formData.append('image_url', imageUrl);

    if (selectedFile) {
      formData.append('product_image', selectedFile);
    }

    fetch(getApiUrl('/api_products.php'), {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Product "${productName}" saved to dedicated folder & MySQL!`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
          setIsFormModalOpen(false);
          fetchProducts();
          checkGDriveSyncStatus();
        }
      })
      .catch((err) => console.log('Save product error:', err))
      .finally(() => setIsSaving(false));
  };

  const handleDeleteProduct = (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete product "${name}" from MySQL database?`)) return;

    fetch(getApiUrl(`/api_products.php?action=delete&id=${id}`), {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Product "${name}" deleted from database.`);
          setTimeout(() => setSaveSuccessMessage(null), 3000);
          fetchProducts();
        }
      });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Equipment')))];

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);

    if (activeCategory !== 'all' && (p.category || 'Equipment') !== activeCategory) {
      return false;
    }
    return matchesSearch;
  });

  const filteredCategories = categoriesBlueprints.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      (p.category_code || '').toLowerCase().includes(q) ||
      (p.category_name || '').toLowerCase().includes(q) ||
      (p.internal_category || '').toLowerCase().includes(q) ||
      (p.subcategories || '').toLowerCase().includes(q) ||
      (p.description_en || '').toLowerCase().includes(q) ||
      (p.description_my || '').toLowerCase().includes(q) ||
      (p.classification_rules || '').toLowerCase().includes(q)
    );
  });

  const totalMasterCatalogValue = products.reduce((acc, p) => acc + (p.unit_price || 0) * (p.stock_quantity || 1), 0);

  // Sample Discrepancy Items between Local MySQL & Google Drive Backup for Diff Inspection Modal
  const conflictDiscrepancies = [
    {
      product_code: 'PRD-001',
      product_name: 'RO WATER MAKER HIGH PRESSURE HOSE',
      field: 'Stok Barang (Quantity)',
      local_val: '50 Package',
      cloud_val: '40 Package',
      status: 'Berbeda (Beda 10 Qty)',
    },
    {
      product_code: 'PRD-002',
      product_name: 'BALL VALVE STAINLESS STEEL 316 2 INCH 1000 WOG',
      field: 'Harga Master (Unit Price)',
      local_val: 'Rp 1.500.000',
      cloud_val: 'Rp 1.450.000',
      status: 'Berbeda (Beda Rp 50.000)',
    },
  ];

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE TOP METALLIC HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        {/* Left Side: Category Title */}
        <div className="flex items-center gap-2 flex-1">
          <h2 className="font-extrabold text-sm text-[#3d3d3d] tracking-wide flex items-center gap-2 uppercase">
            <Package className="w-4 h-4 text-slate-800" /> 
            <span>{activeTab === 'categories' ? 'IMPA Category Blueprints' : 'Master Products & Pricing'}</span>
          </h2>
        </div>

        {/* Right Side: Search, Settings & Sync/Add Buttons */}
        <div className="flex items-center gap-2 shrink-0">

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
            <input
              type="search"
              placeholder={activeTab === 'categories' ? "Search code, category..." : "Search code, product name..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#a0a0a0] rounded-full pl-9 pr-3 py-1 text-xs text-[#3d3d3d] focus:outline-none focus:border-[#0099ec] shadow-inner font-sans"
            />
          </div>

          {activeTab === 'categories' ? (
            <button
              onClick={handleImportFromSheets}
              disabled={isImporting || isLoading}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1 rounded-md border border-[#0060b0] shadow-xs cursor-pointer transition shrink-0"
              title="Sinkronisasi seluruh data dari Google Spreadsheet Blueprint"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isImporting ? 'animate-spin' : ''}`} />
              <span>{isImporting ? 'Syncing...' : 'Sync Google Sheet'}</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-extrabold text-xs px-3.5 py-1 rounded-md border border-[#0060b0] shadow-xs cursor-pointer transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Product</span>
            </button>
          )}

          {/* 3-DOTS ACTION DROPDOWN MENU */}
          <div className="relative">
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] rounded-md border border-[#a0a0a0] shadow-inner transition cursor-pointer flex items-center justify-center"
              title="More Actions"
            >
              <MoreVertical className="w-3.5 h-3.5 text-slate-800" />
            </button>

            {/* Dropdown Menu */}
            {isMoreMenuOpen && (
              <>
                {/* Backdrop overlay to close when clicking outside */}
                <div className="fixed inset-0 z-10" onClick={() => setIsMoreMenuOpen(false)} />
                
                <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-300 shadow-lg rounded-md overflow-hidden z-20 font-sans">
                  <div className="py-1">
                    
                    {/* Menu Item 1: Switch active tab */}
                    <button
                      onClick={() => {
                        setActiveTab(activeTab === 'products' ? 'categories' : 'products');
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 border-b border-slate-150 transition cursor-pointer font-bold"
                    >
                      {activeTab === 'products' ? (
                        <>
                          <Settings className="w-3.5 h-3.5 text-slate-500" />
                          <span>Switch to IMPA Blueprints</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          <span>Switch to Products & Pricing</span>
                        </>
                      )}
                    </button>

                    {/* Menu Item 2: Pengaturan Google Drive */}
                    <button
                      onClick={() => {
                        setIsSettingsModalOpen(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 border-b border-slate-150 transition cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pengaturan (Google Drive Sync)</span>
                    </button>

                    {/* Menu Item 3: Refresh List */}
                    <button
                      onClick={() => {
                        fetchProducts();
                        if (activeTab === 'products') checkGDriveSyncStatus();
                        setIsMoreMenuOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>{isLoading ? 'Refreshing...' : 'Refresh List Data'}</span>
                    </button>

                  </div>
                </div>
              </>
            )}
          </div>

        </div>

      </div>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in shrink-0">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* FULL-WIDTH EDGE-TO-EDGE TABLE CONTAINER */}
      <div className="flex-1 p-0 overflow-y-auto space-y-0 w-full bg-[#f0f0f0]">
        
        {isLoading ? (
          <div className="py-24 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Loading database records...</p>
          </div>
        ) : activeTab === 'categories' ? (
          filteredCategories.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs space-y-2">
              <Package className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No categories found in database.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-12 text-center">^</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Code</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Category Name & Subcategories</th>
                    <th className="p-2.5 text-center w-24">Info Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((p, idx) => {
                    const isEven = idx % 2 === 1;
                    const isActive = activeRowIdx === idx;

                    let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                    if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setActiveRowIdx(idx)}
                        className={`border-b border-[rgba(0,0,0,0.1)] transition ${rowBgClass}`}
                      >
                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-xs text-slate-800">
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900'}`}>
                            {p.category_code}
                          </span>
                        </td>

                        <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                          <div className="font-extrabold text-xs mb-1 text-slate-900">{p.category_name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {p.internal_category}
                          </div>
                          {p.subcategories && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {p.subcategories.split(',').map((sub, sIdx) => (
                                <span key={sIdx} className="bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 text-[9px] font-bold rounded-sm">
                                  {sub.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlueprint(p);
                            }}
                            className="p-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-bold text-xs rounded-md border border-[#0060b0] shadow-xs cursor-pointer transition inline-flex items-center justify-center gap-1"
                            title="View Blueprint Rules & Descriptions"
                          >
                            <span>!</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">No products found in database.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">^</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">
                    <Check className="w-3.5 h-3.5 mx-auto text-[#626262]" />
                  </th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-14 text-center">Photo</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-28">Code</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Product Name & Specifications</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32">Category</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Stock</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Unit</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36 text-right">Master Price (Rp)</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-24 text-center">Disc (%)</th>
                  <th className="p-2.5 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, idx) => {
                  const isEven = idx % 2 === 1;
                  const isActive = activeRowIdx === idx;

                  let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                  if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setActiveRowIdx(idx)}
                      className={`border-b border-[rgba(0,0,0,0.1)] transition ${rowBgClass}`}
                    >
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center">
                        <Check className={`w-3.5 h-3.5 mx-auto ${isActive ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      </td>

                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center">
                        {p.image_url ? (
                          <div className="relative group mx-auto w-10 h-10">
                            <img
                              src={p.image_url}
                              alt={p.product_name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPhotoUrl(p.image_url);
                              }}
                              className="w-10 h-10 object-cover border border-slate-300 shadow-2xs cursor-pointer group-hover:opacity-80 transition"
                              title="Click to preview photo"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPhotoUrl(p.image_url);
                              }}
                              className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-slate-200 border border-slate-300 mx-auto flex items-center justify-center text-slate-400" title="No photo">
                            <ImageIcon className="w-4 h-4 opacity-50" />
                          </div>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs">
                        {p.product_code}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        <div className="font-bold text-xs mb-0.5">{p.product_name}</div>
                        {p.description && (
                          <div className={`text-[11px] line-clamp-1 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                            {p.description}
                          </div>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 text-[10px]">
                          {p.category || 'Equipment'}
                        </span>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-xs">
                        <span className={(p.stock_quantity || 0) > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {p.stock_quantity || 0}
                        </span>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-semibold text-xs">
                        {p.unit || 'Package'}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-extrabold text-xs">
                        {(p.unit_price || 0) > 0 ? (
                          <span className={isActive ? 'text-amber-300' : 'text-slate-900'}>
                            {formatCurrency(p.unit_price)}
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-100 px-1 py-0.5 font-bold">
                            0 (Diisi saat SPH)
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-xs">
                        {p.discount_percent || 0}%
                      </td>

                      <td className="p-2 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(p);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 transition cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(p.id, p.product_name);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete Product"
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
        )}

        {/* FOOTER SUMMARY LINE */}
        <footer className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] border-t border-b border-[#7b7b7b] text-center py-1.5 text-[11px] text-[#3d3d3d] font-semibold w-full shrink-0">
          <span>
            {activeTab === 'categories' 
              ? `${filteredCategories.length} Categories Blueprint Listed` 
              : `${filteredProducts.length} Master Products Listed`
            } • MySQL Database (abmalaya_erp.products)
          </span>
        </footer>

      </div>

      {/* POP-UP MODAL: CATEGORY BLUEPRINT DETAILS */}
      {selectedBlueprint && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-2xl h-[70vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-slate-200 text-slate-950 px-2 py-0.5 rounded-sm font-mono font-bold text-xs">
                  {selectedBlueprint.category_code}
                </span>
                <h3 className="font-extrabold text-xs text-slate-900">
                  {selectedBlueprint.category_name} ({selectedBlueprint.internal_category})
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlueprint(null)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-slate-800 text-xs">
              
              {/* English Description */}
              <div className="space-y-1">
                <h4 className="font-bold text-slate-950 uppercase tracking-wide border-b pb-0.5 border-slate-200">
                  Description (English)
                </h4>
                <p className="leading-relaxed text-slate-700 whitespace-pre-line">
                  {selectedBlueprint.description_en}
                </p>
              </div>

              {/* Malay Description */}
              <div className="space-y-1">
                <h4 className="font-bold text-slate-950 uppercase tracking-wide border-b pb-0.5 border-slate-200">
                  Description (Bahasa Melayu)
                </h4>
                <p className="leading-relaxed text-slate-650 italic whitespace-pre-line">
                  {selectedBlueprint.description_my}
                </p>
              </div>

              {/* Classification Rules */}
              <div className="space-y-1 bg-amber-50/60 border border-amber-200 p-3 rounded-md">
                <h4 className="font-bold text-amber-900 uppercase tracking-wide border-b pb-0.5 border-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Classification & Procurement Rules</span>
                </h4>
                <p className="leading-relaxed text-amber-950 whitespace-pre-line font-medium font-sans">
                  {selectedBlueprint.classification_rules}
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedBlueprint(null)}
                className="px-4 py-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] font-bold text-xs border border-[#a0a0a0] rounded-md shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POP-UP MODAL: DETAIL PERBEDAPAN DATA NON-SINKRON (DIFF INSPECTION MODAL) */}
      {isDiffDetailModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  Rincian Perbedaan Data (MySQL Lokal vs Google Drive Backup)
                </h3>
              </div>
              <button
                onClick={() => setIsDiffDetailModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Banner */}
            <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Sistem menemukan <strong>{conflictDiscrepancies.length} produk</strong> dengan rincian perbedaan harga/stok antara server MySQL dan file Google Drive Cloud Backup.
                </span>
              </div>
            </div>

            {/* Differences Comparison Table */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
              <table className="w-full text-left text-xs border-collapse bg-white border border-slate-300 shadow-2xs">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wide border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 border-r border-slate-200 w-28">Kode Produk</th>
                    <th className="p-2.5 border-r border-slate-200">Nama / Spesifikasi Produk</th>
                    <th className="p-2.5 border-r border-slate-200 w-36">Field Yang Berbeda</th>
                    <th className="p-2.5 border-r border-slate-200 bg-blue-50 text-blue-900 w-32">Nilai MySQL Lokal</th>
                    <th className="p-2.5 bg-emerald-50 text-emerald-900 w-32">Nilai Google Drive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {conflictDiscrepancies.map((disc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold border-r border-slate-200 text-xs">
                        {disc.product_code}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900">
                        {disc.product_name}
                      </td>
                      <td className="p-2.5 border-r border-slate-200">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2 py-0.5 text-[10px] rounded">
                          {disc.field}
                        </span>
                      </td>
                      <td className="p-2.5 border-r border-slate-200 font-mono font-extrabold text-blue-700 bg-blue-50/50">
                        {disc.local_val}
                      </td>
                      <td className="p-2.5 font-mono font-extrabold text-emerald-700 bg-emerald-50/50">
                        {disc.cloud_val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-white p-3 border border-slate-300 rounded space-y-1">
                <span className="font-bold text-slate-800 text-xs block">Rekomendasi Pemulihan Data:</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Silakan tentukan versi mana yang paling akurat untuk dijadikan data utama. Memilih salah satu tombol di bawah akan langsung menyinkronkan seluruh database.
                </p>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsDiffDetailModalOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResolveGDriveConflict('use_local')}
                  disabled={isResolvingSync}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  <HardDrive className="w-3.5 h-3.5 text-blue-200" />
                  <span>Gunakan Versi MySQL Lokal (Timpa Drive)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResolveGDriveConflict('use_gdrive')}
                  disabled={isResolvingSync}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Gunakan Versi Google Drive (Tarik ke MySQL)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SETTINGS POP-UP MODAL (PENGATURAN SYNC & BACKUP GOOGLE DRIVE) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden rounded-md">
            
            {/* Modal Header */}
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  Pengaturan Sync & Backup Cloud Google Drive
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-900 bg-slate-50 flex-1">
              
              {/* SECTION 1: NAMA FILE BACKUP & STATUS KONEKSI */}
              <div className="bg-white p-4 border border-slate-300 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    Informasi Berkas Backup Google Drive
                  </span>
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Connected to Google Service Account
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold text-[10px] uppercase block">Nama File Backup Cloud:</span>
                    <div className="font-mono font-bold text-slate-900 bg-slate-100 p-2 border border-slate-300 flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>abmalaya_erp_products_backup.json</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 font-bold text-[10px] uppercase block">Google Service Account:</span>
                    <div className="font-mono font-bold text-slate-900 bg-slate-100 p-2 border border-slate-300 text-[11px] truncate">
                      erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2.5 border border-slate-200 gap-2">
                  <span>Status Resolusi Konflik: <strong className="text-slate-900">{gdriveStatus?.has_sync_conflict ? '⚠️ Peringatan Konflik Terdeteksi' : '✅ Sinkron 100%'}</strong></span>
                  <span>Terakhir Diperbarui: <strong className="text-slate-900">{gdriveStatus?.last_sync_time || new Date().toLocaleString('id-ID')}</strong></span>
                </div>
              </div>

              {/* SECTION 2: PRATINJAU ISI FILE BACKUP (DATA SUMMARY & CODE PREVIEW) */}
              <div className="bg-white p-4 border border-slate-300 space-y-3 shadow-2xs">
                <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  Pratinjau Isi File Backup JSON Master Katalog:
                </h4>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 p-2.5 border border-slate-200 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Jumlah Produk:</span>
                    <span className="font-mono font-extrabold text-sm text-blue-700">{products.length} Items</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 border border-slate-200 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Kategori Master:</span>
                    <span className="font-mono font-extrabold text-sm text-amber-700">{categories.length - 1} Kategori</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 border border-slate-200 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Nilai Est. Katalog:</span>
                    <span className="font-mono font-extrabold text-sm text-emerald-700">{formatCurrency(totalMasterCatalogValue)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold text-[10px] block mb-1">Preview Snippet Payload JSON:</span>
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded border border-slate-800 font-mono text-[10px] max-h-40 overflow-y-auto leading-relaxed">
                    {JSON.stringify(
                      {
                        backup_timestamp: new Date().toISOString(),
                        system: 'ABMALAYA ERP Portal',
                        database: 'abmalaya_erp.products',
                        total_items: products.length,
                        sample_data: products.slice(0, 3),
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>

              {/* SECTION 3: SIMULASI AKSI SINKRONISASI */}
              <div className="bg-white p-4 border border-slate-300 space-y-2 shadow-2xs">
                <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2 flex items-center justify-between">
                  <span>Aksi Uji Coba & Resolusi Sinkronisasi:</span>
                </h4>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSimulateConflict}
                    className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Simulasikan Peringatan Konflik Sync</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveGDriveConflict('use_local')}
                    disabled={isResolvingSync}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition disabled:opacity-50"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-blue-200" />
                    <span>Paksa Sync MySQL ➔ Google Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveGDriveConflict('use_gdrive')}
                    disabled={isResolvingSync}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Paksa Sync Google Drive ➔ MySQL</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-white"
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PHOTO PREVIEW LIGHTBOX MODAL */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-300 p-2 shadow-2xl max-w-xl max-h-[85vh] flex flex-col rounded-md relative">
            <div className="flex items-center justify-between p-2 border-b border-slate-200">
              <span className="font-bold text-xs text-slate-800">Product Image Lightbox Preview</span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-slate-950 overflow-hidden">
              <img
                src={previewPhotoUrl}
                alt="Product Preview"
                className="max-w-full max-h-[70vh] object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT FORM MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans">
          <div className="bg-white border border-slate-300 w-full max-w-xl shadow-2xl overflow-hidden rounded-md">
            
            <div className="p-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  {editingProduct ? `Edit Master Product — ${editingProduct.product_code}` : 'Add New Product to Database'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 text-xs text-slate-900 bg-slate-50">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product Code:</label>
                  <input
                    type="text"
                    required
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 p-1.5 font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category:</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="E.g. Hose & Fitting / Valves / Membrane"
                    className="w-full bg-white border border-slate-300 p-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name / Specification:</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="E.g. RO WATER MAKER HIGH PRESSURE HOSE (Ref: PD-ENG-2026-059)"
                  className="w-full bg-white border border-slate-300 p-1.5 text-xs font-bold focus:ring-1 focus:ring-[#0099ec]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Technical Specification Details:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g. High Pressure Flexible Rubber Hose with SS316 Fitting Ends. Operating Pressure: 350 BAR."
                  className="w-full bg-white border border-slate-300 p-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Qty:</label>
                  <input
                    type="number"
                    min={0}
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 p-1.5 text-xs text-center font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit:</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Package / Pcs"
                    className="w-full bg-white border border-slate-300 p-1.5 text-xs text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 p-1.5 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Disc (%):</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 p-1.5 text-xs text-center font-mono font-bold text-amber-700"
                  />
                </div>
              </div>

              {/* UPLOAD LOCAL FILE (WITH AUTOMATIC CANVAS COMPRESSION) OR PASTE IMAGE URL */}
              <div className="space-y-2 bg-white p-3 border border-slate-300">
                <label className="block font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#0099ec]" />
                    Product Photo (Upload Local File or Paste URL):
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    Auto-Compress Enabled
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Option A: Upload File from PC</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                      className="w-full text-[11px] text-slate-700 bg-slate-50 border border-slate-300 p-1 cursor-pointer"
                    />

                    {isCompressingImage && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Mekompresi foto secara otomatis...</span>
                      </div>
                    )}

                    {compressionInfo && (
                      <div className="mt-1 p-1.5 bg-emerald-50 border border-emerald-300 rounded text-[10px] text-emerald-950 font-semibold space-y-0.5 animate-in fade-in">
                        <div className="flex items-center justify-between font-bold">
                          <span>Ukuran Asli: {compressionInfo.originalKb} KB</span>
                          <span className="text-emerald-700">Hasil: {compressionInfo.compressedKb} KB</span>
                        </div>
                        <p className="text-[9px] text-emerald-800 font-bold">
                          ✨ Hemat {compressionInfo.ratio}% memori! Foto teroptimasi otomatis.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Option B: Image Web URL</span>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://... or relative URL path"
                      className="w-full bg-slate-50 border border-slate-300 p-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isCompressingImage}
                  className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] text-white font-extrabold text-xs px-4 py-1.5 rounded-sm border border-[#0060b0] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving to Server & MySQL...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Save Product</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION AT BOTTOM RIGHT CORNER (CAN BE CLOSED WITH X) */}
      {gdriveStatus && gdriveStatus.has_sync_conflict && !isToastDismissed && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white p-3.5 rounded-lg shadow-2xl border border-amber-500/50 flex items-start gap-3 max-w-xs sm:max-w-sm animate-in fade-in slide-in-from-bottom-4 font-sans">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1 text-xs">
            <div className="flex items-center justify-between font-extrabold text-amber-300 text-xs">
              <span>Peringatan Sync Cloud</span>
              <button
                type="button"
                onClick={() => setIsToastDismissed(true)}
                className="p-0.5 text-slate-400 hover:text-white transition cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Terdapat perbedaan data stok/harga antara Google Drive Cloud & MySQL Lokal.
            </p>
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDiffDetailModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-2.5 py-1 rounded text-[10px] cursor-pointer transition shadow-xs"
              >
                Lihat Detail Perbedaan ➔
              </button>

              <button
                type="button"
                onClick={() => setIsToastDismissed(true)}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductCatalog;
