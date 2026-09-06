// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, Image as ImageIcon, Package, Check, X, Loader2, RefreshCw, Eye, Upload, AlertTriangle, Cloud, HardDrive, Settings, FileJson, CheckCircle2, Zap, ShieldAlert, MoreVertical, Filter, FileText, Copy, ExternalLink, Tag } from 'lucide-react';
import { getApiUrl } from '../utils/api';

export interface ProductItem {
  id: number;
  product_code?: string;
  impa_code?: string;
  product_name?: string;
  category_code?: string;
  category_name?: string;
  internal_category?: string;
  subcategories?: string;
  description?: string;
  specification?: string;
  unit?: string;
  unit_price?: number;
  capital?: number;
  stock_quantity?: number;
  discount_percent?: number;
  image_url?: string;
  category?: string;
  supplier_name?: string;
  offer?: string;
  offered_item?: string;
  status?: string;
  description_en?: string;
  description_my?: string;
  classification_rules?: string;
  created_at?: string;
}

export interface ProductProps {
  onSelectProductForQuotation?: (product: ProductItem) => void;
  onNavigateView?: (mode: string) => void;
}
export type ProductCatalogProps = ProductProps;

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

export const resolveProductImageUrl = (urlStr?: string): string => {
  if (!urlStr) return '';
  let cleanUrl = urlStr.trim();
  // Strip hardcoded local server hostnames so relative proxy/tunnel resolves correctly
  cleanUrl = cleanUrl.replace(/^http:\/\/(127\.0\.0\.1|localhost)(:8000)?/i, '');
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }
  return getApiUrl(cleanUrl);
};

export const Product: React.FC<ProductProps> = ({}) => {
  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const cached = localStorage.getItem('erp_products_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('erp_products_cache');
      return !(cached && JSON.parse(cached).length > 0);
    } catch (e) {
      return true;
    }
  });
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'junk'>('products');
  const [categoriesBlueprints, setCategoriesBlueprints] = useState<ProductItem[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<ProductItem | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductItem | null>(null);
  const [copiedCodeToast, setCopiedCodeToast] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [isSyncDropdownOpen, setIsSyncDropdownOpen] = useState<boolean>(false);
  const [syncModalTab, setSyncModalTab] = useState<'config' | 'logs' | 'conflicts' | 'session_audit'>('config');
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [conflictsList, setConflictsList] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isCopiedEmail, setIsCopiedEmail] = useState<boolean>(false);
  const [isSyncingSpreadsheet, setIsSyncingSpreadsheet] = useState<boolean>(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'url'>('upload');

  // Form Fields State
  const [productCode, setProductCode] = useState('');
  const [impaCode, setImpaCode] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [specification, setSpecification] = useState('');
  const [offerText, setOfferText] = useState('');
  const [showAlternativeOfferInput, setShowAlternativeOfferInput] = useState<boolean>(false);
  const [supplierName, setSupplierName] = useState('');
  const [unit, setUnit] = useState('Package');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [capitalCost, setCapitalCost] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(50);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('Hose & Fitting');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [productHistoryLogs, setProductHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [backgroundUploadStatus, setBackgroundUploadStatus] = useState<{ fileName: string; status: 'compressing' | 'uploading' | 'completed' | 'error'; progress: number } | null>(null);

  // Fetch product change history from MySQL when drawer is opened
  useEffect(() => {
    if (selectedProductDetail && selectedProductDetail.id) {
      setIsLoadingHistory(true);
      fetch(getApiUrl(`/api_products.php?action=get_history&product_id=${selectedProductDetail.id}`))
        .then((res) => res.json())
        .then((resData) => {
          if (resData.status === 'success' && resData.data) {
            setProductHistoryLogs(resData.data);
          } else {
            setProductHistoryLogs([]);
          }
        })
        .catch((err) => console.log('Fetch product history error:', err))
        .finally(() => setIsLoadingHistory(false));
    } else {
      setProductHistoryLogs([]);
    }
  }, [selectedProductDetail]);

  const logSessionAudit = (action: string, detail: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem('product_edit_history_session') || '[]');
      const newEntry = { time: new Date().toLocaleTimeString(), action, detail };
      localStorage.setItem('product_edit_history_session', JSON.stringify([newEntry, ...existing].slice(0, 30)));
    } catch (e) {
      console.error('Session audit log error:', e);
    }
  };

  const fetchSyncLogs = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=get_sync_logs'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.sync_logs) {
          setSyncLogs(resData.sync_logs);
        }
      })
      .catch((err) => console.log('Sync log fetch error:', err));
  };

  const fetchSpreadsheetBackups = () => {
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=get_backups'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.backups)) {
          setBackupsList(resData.backups);
        }
      })
      .catch((err) => console.log('Spreadsheet backups fetch error:', err));
  };

  const handleCopyEmail = (emailStr: string) => {
    try {
      navigator.clipboard.writeText(emailStr);
      setIsCopiedEmail(true);
      setTimeout(() => setIsCopiedEmail(false), 3000);
    } catch (e) {
      alert('Email Service Account: ' + emailStr);
    }
  };

  const handleManualSyncSpreadsheet = () => {
    setIsSyncingSpreadsheet(true);
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=manual_sync'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(resData.message);
          logSessionAudit('SPREADSHEET_SYNC', resData.message);
          setTimeout(() => setSaveSuccessMessage(null), 5000);
          fetchSyncLogs();
        }
      })
      .catch((err) => alert('Sync error: ' + err.message))
      .finally(() => setIsSyncingSpreadsheet(false));
  };

  const handleCheckConflictsManual = () => {
    setIsCheckingConflicts(true);
    fetch(getApiUrl('/api_spreadsheet_sync.php?action=check_conflicts'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setConflictsList(resData.conflicts || []);
          setSyncModalTab('conflicts');
          setIsSettingsModalOpen(true);
        }
      })
      .catch((err) => alert('Conflict check error: ' + err.message))
      .finally(() => setIsCheckingConflicts(false));
  };

  const handleDownloadFilteredCSV = (isTemplate = false) => {
    const url = getApiUrl(`/api_spreadsheet_sync.php?action=download_csv&category=${encodeURIComponent(activeCategory)}&q=${encodeURIComponent(searchTerm)}&template=${isTemplate ? 1 : 0}`);
    window.open(url, '_blank');
    logSessionAudit('DOWNLOAD_CSV', isTemplate ? 'Downloaded CSV Template' : `Downloaded Filtered CSV (${filteredProducts.length} items)`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setDraggedFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteCSVUpload = (fileToUpload?: File) => {
    const file = fileToUpload || draggedFile;
    if (!file) {
      alert('Pilih atau tarik (drag) file CSV terlebih dahulu!');
      return;
    }

    setIsUploadingCSV(true);
    const formData = new FormData();
    formData.append('csv_file', file);
    formData.append('action', 'upload_csv');

    fetch(getApiUrl('/api_spreadsheet_sync.php'), {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(resData.message);
          logSessionAudit('UPLOAD_CSV', resData.message);
          setTimeout(() => setSaveSuccessMessage(null), 5000);
          fetchProducts();
          setIsUploadModalOpen(false);
          setDraggedFile(null);
        } else {
          alert('Upload failed: ' + resData.message);
        }
      })
      .catch((err) => alert('Upload error: ' + err.message))
      .finally(() => setIsUploadingCSV(false));
  };


  // Auto-Compression Info State
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKb: string;
    compressedKb: string;
    ratio: number;
  } | null>(null);

  // Fetch Products from MySQL Database (Stale-While-Revalidate Instant Cache)
  const fetchProducts = () => {
    if (!products || products.length === 0) {
      setIsLoading(true);
    }
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
            try {
              localStorage.setItem('erp_products_cache', JSON.stringify(resData.data));
            } catch (e) {}
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

  const [currencySymbol, setCurrencySymbol] = useState<string>('RM');

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

  // Fetch Currency Setting from API Credentials
  const fetchCurrencySetting = () => {
    fetch(getApiUrl('/api_credentials.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          const currItem = resData.data.find((c: any) => c.credential_key === 'DOC_CURRENCY');
          if (currItem && currItem.credential_value) {
            const rawCurr = currItem.credential_value.toUpperCase();
            setCurrencySymbol(rawCurr === 'MYR' ? 'RM' : rawCurr === 'IDR' ? 'Rp' : rawCurr);
          }
        }
      })
      .catch((err) => console.log('Currency setting fetch error:', err));
  };

  useEffect(() => {
    fetchProducts();
  }, [activeTab]);

  useEffect(() => {
    checkGDriveSyncStatus();
    fetchCurrencySetting();
    fetchSpreadsheetBackups();
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

  const generateNextProductCode = (productList: ProductItem[]): string => {
    const existingNumbers = new Set<number>();
    productList.forEach((p) => {
      if (p.product_code) {
        const match = p.product_code.match(/PRD-(\d+)/i);
        if (match && match[1]) {
          existingNumbers.add(parseInt(match[1], 10));
        }
      }
    });

    let nextNum = 1;
    while (existingNumbers.has(nextNum)) {
      nextNum++;
    }

    const padded = nextNum.toString().padStart(4, '0');
    return `PRD-${padded}`;
  };

  const resetForm = () => {
    setEditingProduct(null);
    setProductCode(generateNextProductCode(products));
    setImpaCode('');
    setProductName('');
    setDescription('');
    setSpecification('');
    setOfferText('');
    setShowAlternativeOfferInput(false);
    setSupplierName('');
    setUnit('Package');
    setUnitPrice(0);
    setCapitalCost(0);
    setStockQuantity(50);
    setDiscountPercent(0);
    setImageUrl('');
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
    setProductCode(p.product_code || '');
    setImpaCode(p.impa_code || '');
    setProductName(p.product_name || '');
    setDescription(p.description || '');
    setSpecification(p.specification || '');
    const currentOffer = p.offer || p.offered_item || '';
    setOfferText(currentOffer);
    setShowAlternativeOfferInput(!!currentOffer.trim());
    setSupplierName(p.supplier_name || '');
    setUnit(p.unit || 'Package');
    setUnitPrice(p.unit_price || 0);
    setCapitalCost(p.capital || 0);
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

    const userSessionRaw = localStorage.getItem('abmalaya_user_session');
    let actorName = 'Super Admin';
    let actorEmail = 'admin@abmalaya.com';
    if (userSessionRaw) {
      try {
        const uObj = JSON.parse(userSessionRaw);
        if (uObj.name) actorName = uObj.name;
        if (uObj.email) actorEmail = uObj.email;
      } catch (e) {}
    }

    const formData = new FormData();
    if (editingProduct && editingProduct.id) {
      formData.append('id', editingProduct.id.toString());
    }
    formData.append('product_code', productCode);
    formData.append('impa_code', impaCode);
    formData.append('product_name', productName);
    formData.append('description', description);
    formData.append('specification', specification);
    formData.append('offer', offerText);
    formData.append('supplier_name', supplierName);
    formData.append('unit', unit);
    formData.append('unit_price', unitPrice.toString());
    formData.append('capital', capitalCost.toString());
    formData.append('stock_quantity', stockQuantity.toString());
    formData.append('discount_percent', discountPercent.toString());
    formData.append('category', category);
    formData.append('image_url', imageUrl);
    formData.append('actor_name', actorName);
    formData.append('actor_email', actorEmail);

    const uploadFileName = selectedFile ? selectedFile.name : (productName || 'Product Data');
    if (selectedFile) {
      formData.append('product_image', selectedFile);
      setBackgroundUploadStatus({
        fileName: uploadFileName,
        status: 'uploading',
        progress: 10
      });
    }

    // Immediately close modal popup so user can continue working while upload runs in background
    setIsFormModalOpen(false);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', getApiUrl('/api_products.php'), true);

    if (xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          if (selectedFile) {
            setBackgroundUploadStatus({
              fileName: uploadFileName,
              status: 'uploading',
              progress: percent
            });
          }
        }
      };
    }

    xhr.onload = () => {
      setIsSaving(false);
      try {
        const resData = JSON.parse(xhr.responseText);
        if (resData.status === 'success') {
          if (selectedFile) {
            setBackgroundUploadStatus({
              fileName: uploadFileName,
              status: 'completed',
              progress: 100
            });
            setTimeout(() => setBackgroundUploadStatus(null), 3500);
          }
          setSaveSuccessMessage(`Product "${productName}" saved to dedicated folder & MySQL!`);
          logSessionAudit('SAVE_PRODUCT', `Saved product ${productCode} - ${productName}`);
          setTimeout(() => setSaveSuccessMessage(null), 4000);
          fetchProducts();
          checkGDriveSyncStatus();
        } else {
          if (selectedFile) {
            setBackgroundUploadStatus({
              fileName: uploadFileName,
              status: 'error',
              progress: 0
            });
          }
        }
      } catch (err) {
        console.error('Parse save response error:', err);
      }
    };

    xhr.onerror = () => {
      setIsSaving(false);
      if (selectedFile) {
        setBackgroundUploadStatus({
          fileName: uploadFileName,
          status: 'error',
          progress: 0
        });
      }
    };

    xhr.send(formData);
  };

  const handleTrashProduct = (id: number, name: string) => {
    if (!window.confirm(`Move product "${name}" to Trash (Junk)?`)) return;

    // Optimistically remove row from UI table immediately for real-time feel!
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedProductDetail && selectedProductDetail.id === id) {
      setSelectedProductDetail(null);
    }

    const userSessionRaw = localStorage.getItem('abmalaya_user_session');
    let actorName = 'Super Admin';
    let actorEmail = 'admin@abmalaya.com';
    if (userSessionRaw) {
      try {
        const uObj = JSON.parse(userSessionRaw);
        if (uObj.name) actorName = uObj.name;
        if (uObj.email) actorEmail = uObj.email;
      } catch (e) {}
    }

    fetch(getApiUrl(`/api_products.php?action=trash&id=${id}&actor_name=${encodeURIComponent(actorName)}&actor_email=${encodeURIComponent(actorEmail)}`))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Product "${name}" moved to Trash.`);
          logSessionAudit('TRASH_PRODUCT', `Moved product #${id} (${name}) to Junk`);
          setTimeout(() => setSaveSuccessMessage(null), 3000);
        } else {
          fetchProducts();
        }
      })
      .catch(() => fetchProducts());
  };

  const handleRestoreProduct = (id: number, name: string) => {
    fetch(getApiUrl(`/api_products.php?action=restore&id=${id}`))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Product "${name}" restored to active list.`);
          logSessionAudit('RESTORE_PRODUCT', `Restored product #${id} (${name})`);
          setTimeout(() => setSaveSuccessMessage(null), 3000);
          fetchProducts();
        }
      });
  };

  const handlePermanentDelete = (id: number, name: string) => {
    if (!window.confirm(`WARNING: PERMANENTLY delete product "${name}"? This action cannot be undone.`)) return;

    // Optimistically remove row from UI table immediately for real-time feel!
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedProductDetail && selectedProductDetail.id === id) {
      setSelectedProductDetail(null);
    }

    fetch(getApiUrl(`/api_products.php?action=delete_permanent&id=${id}`))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setSaveSuccessMessage(`Product "${name}" permanently deleted.`);
          logSessionAudit('PERMANENT_DELETE', `Permanently deleted product #${id} (${name})`);
          setTimeout(() => setSaveSuccessMessage(null), 3000);
        } else {
          fetchProducts();
        }
      })
      .catch(() => fetchProducts());
  };

  const formatCurrency = (val: number, curr = currencySymbol || 'RM') => {
    const num = Number(val) || 0;
    const hasDec = num % 1 !== 0;
    return `${curr} ${num.toLocaleString('en-US', { minimumFractionDigits: hasDec ? 2 : 0, maximumFractionDigits: 2 })}`;
  };


  const categories = Array.from(new Set([
    'all',
    ...categoriesBlueprints.map((cb) => (cb.category_name ? (cb.category_code ? `${cb.category_code} ${cb.category_name}` : cb.category_name) : '')).filter(Boolean),
    ...products.map((p) => p.category || 'Equipment')
  ]));

  const filteredProducts = products.filter((p) => {
    const pStatus = (p.status || 'active').toLowerCase();
    if (pStatus === 'junk' || pStatus === 'trash' || pStatus === 'deleted' || pStatus === 'archived') {
      return false;
    }

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.impa_code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);

    if (activeCategory !== 'all') {
      const pCat = (p.category || 'Equipment').toLowerCase();
      const aCat = activeCategory.toLowerCase();
      const isMatch = pCat === aCat || pCat.includes(aCat) || aCat.includes(pCat);
      if (!isMatch) return false;
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory, activeTab]);

  const totalProductItems = filteredProducts.length;
  const totalCategoryItems = filteredCategories.length;
  const currentTotal = activeTab === 'categories' ? totalCategoryItems : totalProductItems;
  const effectivePageSize = pageSize === 0 ? Math.max(1, currentTotal) : pageSize;
  const totalPages = Math.max(1, Math.ceil(currentTotal / effectivePageSize));

  const paginatedProducts = pageSize === 0 
    ? filteredProducts 
    : filteredProducts.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const paginatedCategories = pageSize === 0 
    ? filteredCategories 
    : filteredCategories.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const totalMasterCatalogValue = products.reduce((acc, p) => acc + (p.unit_price || 0) * (p.stock_quantity || 1), 0);

  // Real Discrepancy Items between Local MySQL & Google Drive Backup from Backend API
  const conflictDiscrepancies = conflictsList;

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* FLOATING TOP PROGRESS BAR INDICATOR (GARIS ATAS UPLOADING BACKGROUND) */}
      {backgroundUploadStatus && (
        <div className="sticky top-0 z-50 bg-slate-900 text-white border-b-2 border-blue-500 shadow-xl px-4 py-2 flex items-center justify-between text-xs font-sans animate-in slide-in-from-top duration-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-full animate-pulse">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-blue-300 flex items-center gap-2">
                <span>Photo Upload Progress ({backgroundUploadStatus.progress}%)</span>
                {backgroundUploadStatus.status === 'completed' && (
                  <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded font-mono font-bold">
                    ✓ Upload Complete
                  </span>
                )}
                {backgroundUploadStatus.status === 'error' && (
                  <span className="text-[10px] text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded font-mono font-bold">
                    ✕ Upload Error
                  </span>
                )}
              </span>
              <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                {backgroundUploadStatus.fileName} • Running in background (drawer can be closed safely)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-36 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-200"
                style={{ width: `${backgroundUploadStatus.progress}%` }}
              />
            </div>
            {backgroundUploadStatus.status === 'completed' && (
              <button
                type="button"
                onClick={() => setBackgroundUploadStatus(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Dismiss indicator"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ITUNES-STYLE TOP METALLIC HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        {/* Left Side: Product Title & Category Filter Dropdown */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-slate-800" /> 
            <h2 className="font-extrabold text-sm text-[#3d3d3d] tracking-wide uppercase">
              {activeTab === 'categories' ? 'IMPA Category Blueprints' : 'Product'}
            </h2>
          </div>

          {/* LEFT-ALIGNED CATEGORY FILTER DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-bold transition cursor-pointer ${
                activeCategory !== 'all' || activeTab === 'categories'
                  ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-xs'
                  : 'bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] border-[#a0a0a0] shadow-inner'
              }`}
              title="Filter Categories & IMPA Blueprints"
            >
              <Filter className="w-3.5 h-3.5 text-slate-700" />
              <span className="max-w-[130px] truncate">
                {activeTab === 'categories'
                  ? 'IMPA Blueprints'
                  : activeCategory === 'all'
                  ? 'All Categories'
                  : activeCategory}
              </span>
              <span className="ml-1 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-mono font-extrabold">
                {activeTab === 'categories' ? categoriesBlueprints.length : filteredProducts.length}
              </span>
            </button>

            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-300 shadow-xl rounded-md overflow-hidden z-20 font-sans max-h-80 overflow-y-auto">
                  <div className="p-2 bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Filter & Catalog Mode</span>
                    {activeCategory !== 'all' && (
                      <button
                        onClick={() => {
                          setActiveCategory('all');
                          setActiveTab('products');
                          setIsFilterDropdownOpen(false);
                        }}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer lowercase font-normal"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>

                  <div className="py-1">
                    {/* IMPA Category Blueprints Option */}
                    <button
                      onClick={() => {
                        setActiveTab('categories');
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition cursor-pointer border-b border-slate-150 ${
                        activeTab === 'categories'
                          ? 'bg-amber-100 text-amber-900 font-bold border-l-4 border-amber-600'
                          : 'text-slate-800 hover:bg-slate-100 font-bold'
                      }`}
                    >
                      <span className="truncate pr-2 flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-amber-600" />
                        <span>IMPA Category Blueprints</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-amber-200 text-amber-900 font-bold">
                        {categoriesBlueprints.length}
                      </span>
                    </button>

                    {/* Standard Categories */}
                    {categories.map((cat) => {
                      const count = cat === 'all'
                        ? products.filter(p => (p.status || 'active') === 'active').length
                        : products.filter(p => {
                            if ((p.status || 'active') !== 'active') return false;
                            const pCat = (p.category || 'Equipment').toLowerCase();
                            const cCat = cat.toLowerCase();
                            return pCat === cCat || pCat.includes(cCat) || cCat.includes(pCat);
                          }).length;
                      const isSelected = activeTab === 'products' && activeCategory === cat;

                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            setActiveTab('products');
                            setActiveCategory(cat);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 text-blue-800 font-bold border-l-4 border-blue-600'
                              : 'text-slate-700 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <span className="truncate pr-2">{cat === 'all' ? 'All Categories' : cat}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                            isSelected ? 'bg-blue-200 text-blue-900 font-bold' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Search, + Add Product & CARD-MODEL 3-DOTS MENU */}
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

          {/* CARD-MODEL 3-DOTS ACTION DROPDOWN MENU */}
          <div className="relative">
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] rounded-md border border-[#a0a0a0] shadow-inner transition cursor-pointer flex items-center justify-center"
              title="More Actions & Spreadsheet Backup"
            >
              <MoreVertical className="w-3.5 h-3.5 text-slate-800" />
            </button>

            {/* Card-Style Dropdown Menu */}
            {isMoreMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMoreMenuOpen(false)} />
                
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-300 shadow-2xl rounded-lg p-3 z-20 font-sans space-y-3">
                  
                  {/* COMBINED CARD 1: SPREADSHEET BACKUP, SYNC & AUDIT LOGS */}
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md space-y-1.5 shadow-2xs">
                    <span className="font-extrabold text-[11px] text-blue-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1">
                      <Cloud className="w-3.5 h-3.5 text-blue-600" />
                      <span>Spreadsheet Backup, Sync & Audit Logs</span>
                    </span>
                    
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        onClick={() => {
                          handleManualSyncSpreadsheet();
                          setIsMoreMenuOpen(false);
                        }}
                        disabled={isSyncingSpreadsheet}
                        className="w-full text-left p-1.5 bg-white hover:bg-blue-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncingSpreadsheet ? 'animate-spin' : ''}`} />
                        <span>Sync Manual</span>
                      </button>

                      <button
                        onClick={() => {
                          handleCheckConflictsManual();
                          setIsMoreMenuOpen(false);
                        }}
                        disabled={isCheckingConflicts}
                        className="w-full text-left p-1.5 bg-white hover:bg-amber-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cek Konflik</span>
                      </button>

                      <button
                        onClick={() => {
                          fetchSyncLogs();
                          setSyncModalTab('logs');
                          setIsSettingsModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left p-1.5 bg-white hover:bg-purple-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>Log Error Sync</span>
                      </button>

                      <button
                        onClick={() => {
                          fetchProducts();
                          checkGDriveSyncStatus();
                          setIsMoreMenuOpen(false);
                        }}
                        disabled={isLoading}
                        className="w-full text-left p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh Data</span>
                      </button>
                    </div>
                  </div>

                  {/* CARD 2: IMPORT / EXPORT CSV DATA */}
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md space-y-1.5 shadow-2xs">
                    <span className="font-extrabold text-[11px] text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Export / Import Spreadsheet CSV</span>
                    </span>

                    <div className="space-y-1 pt-0.5">
                      <button
                        onClick={() => {
                          handleDownloadFilteredCSV(false);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left p-1.5 bg-white hover:bg-emerald-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-600 rotate-180" />
                        <span>Download Filtered CSV ({filteredProducts.length} items)</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUploadModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left p-1.5 bg-white hover:bg-purple-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-purple-600" />
                        <span>Upload Data CSV / Spreadsheet</span>
                      </button>
                    </div>
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
                  {paginatedCategories.map((p, idx) => {
                    const globalIdx = (currentPage - 1) * effectivePageSize + idx + 1;
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
                          {globalIdx}
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
            <table className="min-w-[1300px] w-full text-left text-xs font-sans border-collapse">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">

                <tr>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-10 text-center">^</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-10 text-center">
                    <Check className="w-3.5 h-3.5 mx-auto text-[#626262]" />
                  </th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-14 text-center">Photo</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32 font-mono">Product Code</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-28 font-mono text-purple-900">IMPA Code</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] min-w-[180px]">Product Name</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] min-w-[200px]">Specification</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] min-w-[160px]">Alternative Offered</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32 font-mono">Supplier / Seller</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36">Category</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-20 text-center">Unit</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32 text-right font-mono">Capital (MYR)</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36 text-right font-mono">Unit Price (MYR)</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-16 text-center font-mono">Stock</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-16 text-center font-mono">Disc (%)</th>
                  <th className="p-2.5 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((p, idx) => {
                  const globalIdx = (currentPage - 1) * effectivePageSize + idx + 1;
                  const isEven = idx % 2 === 1;
                  const isActive = activeRowIdx === idx;

                  let rowBgClass = isEven ? 'bg-[#F1F4F7]' : 'bg-[#FAFAFA]';
                  if (isActive) rowBgClass = 'bg-[#3d3d3d] text-white';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setActiveRowIdx(idx);
                        setSelectedProductDetail(p);
                      }}
                      className={`border-b border-[rgba(0,0,0,0.1)] transition cursor-pointer hover:bg-blue-50/40 ${rowBgClass}`}
                    >
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-[11px]">
                        {globalIdx}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center">
                        <Check className={`w-3.5 h-3.5 mx-auto ${isActive ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      </td>

                      <td className="p-1 border-r border-[rgba(0,0,0,0.1)] text-center w-14">
                        {p.image_url ? (
                          <div className="relative group mx-auto w-full max-w-[52px] h-12">
                            <img
                              src={resolveProductImageUrl(p.image_url)}
                              alt={p.product_name || 'Product Photo'}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).onerror = null;
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPhotoUrl(p.image_url || null);
                              }}
                              className="w-full h-12 object-cover border border-slate-300 shadow-2xs cursor-pointer group-hover:opacity-80 transition rounded-xs"
                              title="Click to preview photo"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPhotoUrl(p.image_url || null);
                              }}
                              className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer rounded-xs"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(p);
                              setPhotoInputMode('upload');
                            }}
                            className="w-full max-w-[52px] h-12 bg-slate-100 hover:bg-blue-50 border border-slate-300 hover:border-blue-400 rounded-xs flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition cursor-pointer group mx-auto"
                            title="No photo uploaded yet. Click to upload photo for this product"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 mb-0.5" />
                            <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-600">Upload</span>
                          </button>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs text-blue-700">
                        {p.product_code}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs">
                        {p.impa_code ? (
                          <span className="bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded text-[10px] shadow-2xs font-extrabold" title={`Kode Maritim IMPA: ${p.impa_code}`}>
                            IMPA {p.impa_code}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">—</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-bold text-xs">
                        <div
                          className="line-clamp-2 text-slate-800 leading-snug cursor-pointer hover:text-blue-600 transition"
                          title={p.product_name || ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductDetail(p);
                          }}
                        >
                          {p.product_name}
                        </div>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-[11px]">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductDetail(p);
                          }}
                          className="max-w-[200px] truncate text-slate-700 font-sans hover:text-blue-600 hover:underline cursor-pointer"
                          title="Klik untuk lihat rincian & aksi produk"
                        >
                          {p.specification || p.description || 'Standard specification'}
                        </div>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-[11px] text-slate-800">
                        {p.offer || p.offered_item ? (
                          <div
                            className="line-clamp-2 leading-tight max-w-[220px] cursor-pointer hover:text-blue-600 transition font-medium"
                            title={`Alternative Offered: ${p.offer || p.offered_item} (Alternatif produk/merek jika spesifikasi sama)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProductDetail(p);
                            }}
                          >
                            {p.offer || p.offered_item}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">—</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono text-[10px]">
                        {p.supplier_name ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.5 rounded">
                            {p.supplier_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-semibold text-slate-700 text-xs">
                        {p.category || 'Equipment'}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-semibold text-xs">
                        {p.unit || 'Package'}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-bold text-xs">
                        {(p.capital || 0) > 0 ? (
                          <span className={isActive ? 'text-emerald-300' : 'text-emerald-800'}>
                            {formatCurrency(p.capital || 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal text-[10px]">RM 0.00</span>
                        )}
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
                        <span className={(p.stock_quantity || 0) > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {p.stock_quantity || 0}
                        </span>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-xs">
                        {p.discount_percent || 0}%
                      </td>


                      <td className="p-2 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          {activeTab === 'junk' ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestoreProduct(p.id, p.product_name || '');
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                                title="Restore from Trash"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Restore</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePermanentDelete(p.id, p.product_name || '');
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Permanently Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
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
                                  handleTrashProduct(p.id, p.product_name || '');
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Move to Trash (Junk)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROL BAR */}
        <div className="bg-slate-100 border-t border-[#7b7b7b] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 font-sans shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-xs cursor-pointer shadow-2xs focus:ring-1 focus:ring-blue-500"
            >
              <option value={25}>25 Products</option>
              <option value={50}>50 Products</option>
              <option value={100}>100 Products</option>
              <option value={0}>Show All (Full)</option>
            </select>
            <span className="text-[11px] text-slate-500 font-medium">
              Showing {currentTotal === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1} - {Math.min(currentPage * effectivePageSize, currentTotal)} of {currentTotal} items
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition"
            >
              « Prev
            </button>
            <span className="px-2 py-1 bg-slate-200 text-slate-800 rounded font-mono text-xs">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-300 rounded text-xs text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition"
            >
              Next »
            </button>
          </div>
        </div>

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

      {/* POP-UP DRAWER: PRODUCT DETAILS & QUICK ACTIONS (RIGHT-SIDE SLIDE-IN) */}
      {selectedProductDetail && (
        <div className="fixed inset-y-0 right-0 z-50 pointer-events-none flex justify-end font-sans">
          {/* Right-Side Slide-in Drawer Container (No dark backdrop) */}
          <div className="pointer-events-auto w-full max-w-xl bg-white border-l border-slate-300 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-950 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Package className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-sm text-white uppercase tracking-wide">
                      Product Details & Quick Actions
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Product Code: {selectedProductDetail.product_code} • ID: #{selectedProductDetail.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item = selectedProductDetail;
                      setSelectedProductDetail(null);
                      handleOpenEditModal(item);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProductDetail(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition cursor-pointer"
                    title="Close Drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50 text-slate-800 text-xs">
                
                {/* Top Summary Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3.5 rounded-md shadow-2xs">
                  <div className="flex items-center gap-3">
                    {selectedProductDetail.image_url ? (
                      <img
                        src={resolveProductImageUrl(selectedProductDetail.image_url)}
                        alt={selectedProductDetail.product_name || 'Product'}
                        className="w-16 h-16 object-cover border border-slate-300 rounded shadow-xs shrink-0 cursor-pointer hover:opacity-80 transition"
                        onClick={() => setPreviewPhotoUrl(selectedProductDetail.image_url || null)}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded font-mono font-extrabold text-[11px]">
                          SKU: {selectedProductDetail.product_code}
                        </span>
                        {selectedProductDetail.impa_code && (
                          <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-mono font-extrabold text-[11px]">
                            IMPA: {selectedProductDetail.impa_code}
                          </span>
                        )}
                      </div>
                      <h2 className="font-extrabold text-sm text-slate-900 mt-1">
                        {selectedProductDetail.product_name}
                      </h2>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        Category: <strong className="text-slate-700">{selectedProductDetail.category || 'Equipment'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 shrink-0">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unit Price (MYR)</div>
                    <div className="text-sm font-extrabold text-emerald-700 font-mono">
                      {formatCurrency(selectedProductDetail.unit_price || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      Capital: <span className="font-mono font-bold text-slate-700">{formatCurrency(selectedProductDetail.capital || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Full Specification Box */}
                <div className="space-y-1 bg-amber-50/60 border border-amber-200 p-3.5 rounded-md">
                  <h4 className="font-bold text-amber-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5 border-b border-amber-200 pb-1">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>Full Product Specifications</span>
                  </h4>
                  <p className="leading-relaxed text-slate-800 whitespace-pre-line text-xs font-sans pt-1">
                    {selectedProductDetail.specification || selectedProductDetail.description || 'No specific technical details recorded in database.'}
                  </p>
                </div>

                {/* Alternative Offered Box */}
                {(selectedProductDetail.offer || selectedProductDetail.offered_item) && (
                  <div className="space-y-1 bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-md">
                    <h4 className="font-bold text-emerald-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5 border-b border-emerald-200 pb-1">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Alternative Offered (Produk / Merek Alternatif)</span>
                    </h4>
                    <p className="leading-relaxed text-emerald-900 font-bold text-xs font-sans pt-1">
                      {selectedProductDetail.offer || selectedProductDetail.offered_item}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium italic">
                      *Penawaran alternatif produk/merek dengan spesifikasi teknis yang setara.
                    </p>
                  </div>
                )}

                {/* Grid Properties */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier / Vendor</span>
                    <span className="font-extrabold text-slate-800 block truncate">
                      {selectedProductDetail.supplier_name || '—'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Unit</span>
                    <span className="font-extrabold text-slate-800 block">
                      {selectedProductDetail.unit || 'Package'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Available Stock</span>
                    <span className="font-extrabold text-emerald-700 font-mono block">
                      {selectedProductDetail.stock_quantity || 0} unit
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Discount (%)</span>
                    <span className="font-extrabold text-slate-800 font-mono block">
                      {selectedProductDetail.discount_percent || 0}%
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Status Record</span>
                    <span className="font-extrabold text-slate-800 uppercase block">
                      {selectedProductDetail.status || 'active'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200 space-y-0.5 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">ID Database</span>
                    <span className="font-mono text-slate-700 block">
                      #{selectedProductDetail.id}
                    </span>
                  </div>
                </div>

                {/* Product Change History Audit Logs (JSON Format) */}
                <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <FileJson className="w-4 h-4 text-purple-600" />
                      <span>Product Audit Trail & Change Logs</span>
                    </h4>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded font-mono">
                      {productHistoryLogs.length} Records
                    </span>
                  </div>

                  {isLoadingHistory ? (
                    <div className="py-4 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      <span>Loading history records from MySQL...</span>
                    </div>
                  ) : productHistoryLogs.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-2 text-center font-medium">
                      No change history recorded for this product yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {productHistoryLogs.map((log: any) => {
                        let parsedDiff: any = null;
                        try {
                          parsedDiff = typeof log.changes_json === 'string' ? JSON.parse(log.changes_json) : log.changes_json;
                        } catch (e) {}

                        return (
                          <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase ${
                                  log.action_type === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                                  log.action_type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                  log.action_type === 'TRASH' ? 'bg-amber-100 text-amber-800' :
                                  'bg-rose-100 text-rose-800'
                                }`}>
                                  {log.action_type}
                                </span>
                                <span>{log.actor_name}</span>
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 font-semibold">{log.created_at}</span>
                            </div>

                            <p className="text-[10px] text-slate-500 font-mono">
                              User Email: <strong className="text-slate-700">{log.actor_email}</strong>
                            </p>

                            {/* Diff Display */}
                            {parsedDiff && (
                              <div className="bg-white p-2 border border-slate-200 rounded text-[11px] font-mono space-y-1 mt-1">
                                {Object.entries(parsedDiff).map(([key, val]: [string, any]) => (
                                  <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-0.5 last:border-0 last:pb-0">
                                    <span className="font-bold text-slate-600 uppercase text-[10px]">{key}:</span>
                                    {val && typeof val === 'object' && 'old' in val && 'new' in val ? (
                                      <span className="text-[10px]">
                                        <span className="line-through text-rose-600 mr-1">{String(val.old)}</span>
                                        <span className="text-emerald-700 font-extrabold">➔ {String(val.new)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 text-[10px] font-bold truncate max-w-[200px]">{JSON.stringify(val)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Footer with Actions */}
              <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 shadow-md">
                <button
                  type="button"
                  onClick={() => setSelectedProductDetail(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 rounded shadow-xs transition cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const id = selectedProductDetail.id;
                    const name = selectedProductDetail.product_name || '';
                    setSelectedProductDetail(null);
                    handleTrashProduct(id, name);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Move to Trash</span>
                </button>
              </div>

            </div>
          </div>
        )}

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
                  Google Drive & Spreadsheet Cloud Sync & Backup Settings
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Multi-Tab Selector Bar */}
            <div className="flex items-center gap-1 bg-slate-200/90 px-3 py-1.5 border-b border-slate-300 text-xs font-extrabold shrink-0">
              <button
                onClick={() => setSyncModalTab('config')}
                className={`px-3 py-1 rounded cursor-pointer transition flex items-center gap-1.5 ${
                  syncModalTab === 'config' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Spreadsheet Link & Info</span>
              </button>

              <button
                onClick={() => {
                  fetchSyncLogs();
                  setSyncModalTab('logs');
                }}
                className={`px-3 py-1 rounded cursor-pointer transition flex items-center gap-1.5 ${
                  syncModalTab === 'logs' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Sync Error Logs ({syncLogs.length})</span>
              </button>

              <button
                onClick={() => {
                  handleCheckConflictsManual();
                  setSyncModalTab('conflicts');
                }}
                className={`px-3 py-1 rounded cursor-pointer transition flex items-center gap-1.5 ${
                  syncModalTab === 'conflicts' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Manual Conflict Check ({conflictsList.length})</span>
              </button>

              <button
                onClick={() => setSyncModalTab('session_audit')}
                className={`px-3 py-1 rounded cursor-pointer transition flex items-center gap-1.5 ${
                  syncModalTab === 'session_audit' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileJson className="w-3.5 h-3.5 text-purple-600" />
                <span>Edit Session Audit</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-900 bg-slate-50 flex-1">
              
              {/* TAB 1: CONFIG & SPREADSHEET LINK */}
              {syncModalTab === 'config' && (
                <>
                  {(() => {
                    const activeTarget = backupsList.find((b: any) => b.is_primary == 1) || backupsList[0] || {};
                    const rawTitle = activeTarget.title || 'Google Spreadsheet Backup Utama';
                    const fileTitle = rawTitle.includes('Utama') ? 'Primary Master Product Spreadsheet Backup' : rawTitle;
                    const spId = activeTarget.spreadsheet_id || '1PHMV-f5fEZzdzCHXXMZFn2laEIRnOWrDoH9ZJcxi1UQ';
                    const spUrl = spId.startsWith('http') ? spId : `https://docs.google.com/spreadsheets/d/${spId}/edit`;
                    const saEmail = activeTarget.service_account_email || 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com';

                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                              <Cloud className="w-4.5 h-4.5 text-blue-600" />
                              <span>Primary Google Spreadsheet Integration (Connected to MySQL)</span>
                            </h3>
                            <p className="text-slate-500 text-xs mt-0.5">
                              Configuration dynamically fetched 100% from MySQL <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono font-bold">spreadsheet_backups</code> table.
                            </p>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Google Sheets API Connected</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Spreadsheet Backup Filename</span>
                              <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">SQL Dynamic Record</span>
                            </div>
                            
                            <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{fileTitle}</span>
                              </div>

                              <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[11px]">
                                <span className="text-slate-500 font-mono">Tab: <strong>{activeTarget.sheet_name || 'Master_Products'}</strong></span>
                                <a
                                  href={spUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open / Visit File</span>
                                </a>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold uppercase block">Google Service Account Access</span>
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">Authorized Key</span>
                            </div>

                            <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2">
                              <div className="font-mono font-bold text-slate-800 text-[11px] truncate" title={saEmail}>
                                {saEmail}
                              </div>

                              <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[11px]">
                                <span className="text-slate-500 text-[10px]">Share edit access in Google Drive</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(saEmail)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                                >
                                  {isCopiedEmail ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Email</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-white p-4 border border-slate-300 space-y-2 shadow-2xs">
                    <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2">
                      Spreadsheet Manual Sync & Backup Actions:
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleManualSyncSpreadsheet}
                        disabled={isSyncingSpreadsheet}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSpreadsheet ? 'animate-spin' : ''}`} />
                        <span>Manual Sync: MySQL ➔ Spreadsheet</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCheckConflictsManual}
                        disabled={isCheckingConflicts}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Run Manual Conflict Check</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsModalOpen(false);
                          if (onNavigateView) onNavigateView('system_settings');
                        }}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs px-3.5 py-1.5 rounded cursor-pointer transition shadow-xs"
                      >
                        <Settings className="w-3.5 h-3.5 text-blue-300" />
                        <span>Advanced System Settings »</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: LOG ERROR SYNC */}
              {syncModalTab === 'logs' && (
                <div className="bg-white p-4 border border-slate-300 space-y-3 shadow-2xs">
                  <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>System Error & Warning Log Notifications:</span>
                    <button
                      onClick={fetchSyncLogs}
                      className="text-blue-600 hover:underline text-[10px] font-normal cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh Logs</span>
                    </button>
                  </h4>

                  {syncLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold text-xs">
                      No sync error logs recorded in database.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {syncLogs.map((log) => (
                        <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900">{log.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{log.created_at}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-sans">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CEK KONFLIK MANUAL */}
              {syncModalTab === 'conflicts' && (
                <div className="bg-white p-4 border border-slate-300 space-y-3 shadow-2xs">
                  <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2">
                    Data Conflict Scan Results (MySQL vs Spreadsheet):
                  </h4>

                  {conflictsList.length === 0 ? (
                    <div className="p-8 text-center text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-xs rounded">
                      ✅ All MySQL and Spreadsheet data are 100% synchronized. No unexpected discrepancies found.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse bg-white border border-slate-300">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase">
                        <tr>
                          <th className="p-2 border-r border-slate-200">Product Code</th>
                          <th className="p-2 border-r border-slate-200">Product Name</th>
                          <th className="p-2 border-r border-slate-200">Field</th>
                          <th className="p-2 border-r border-slate-200 bg-blue-50 text-blue-900">MySQL Version</th>
                          <th className="p-2 bg-emerald-50 text-emerald-900">Spreadsheet Version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflictsList.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">{c.product_code}</td>
                            <td className="p-2 border-r border-slate-200 font-bold">{c.product_name}</td>
                            <td className="p-2 border-r border-slate-200 font-semibold text-amber-800">{c.field}</td>
                            <td className="p-2 border-r border-slate-200 font-mono text-blue-800 font-bold">{c.local_val}</td>
                            <td className="p-2 font-mono text-emerald-800 font-bold">{c.cloud_val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIT SESI EDIT (LOCALSTORAGE) */}
              {syncModalTab === 'session_audit' && (
                <div className="bg-white p-4 border border-slate-300 space-y-3 shadow-2xs">
                  <h4 className="font-bold text-slate-900 uppercase text-xs border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>User Session Edit History (LocalStorage Audit Trail):</span>
                    <button
                      onClick={() => {
                        localStorage.removeItem('product_edit_history_session');
                        setSaveSuccessMessage('Session audit history cleared.');
                        setTimeout(() => setSaveSuccessMessage(null), 3000);
                      }}
                      className="text-rose-600 hover:underline text-[10px] font-normal cursor-pointer"
                    >
                      Clear Session Logs
                    </button>
                  </h4>

                  {(() => {
                    const logs = JSON.parse(localStorage.getItem('product_edit_history_session') || '[]');
                    if (logs.length === 0) {
                      return <div className="p-8 text-center text-slate-400 font-bold text-xs">No edit activity history in this browser session.</div>;
                    }
                    return (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto">
                        {logs.map((log: any, idx: number) => (
                          <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
                            <span className="font-bold text-slate-800 font-mono text-[11px]">{log.action}: {log.detail}</span>
                            <span className="font-mono text-[10px] text-slate-500">{log.time}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#e9e9e9] border-t border-[#dbdbdb] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  if (onNavigateView) onNavigateView('system_settings');
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-sm cursor-pointer transition flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-blue-300" />
                <span>Advanced System Settings</span>
              </button>

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
            <div className="p-3 flex items-center justify-center bg-slate-950 overflow-hidden min-h-[250px]">
              <img
                src={resolveProductImageUrl(previewPhotoUrl)}
                alt="Product Preview"
                onError={(e) => {
                  (e.target as HTMLImageElement).onerror = null;
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                }}
                className="max-w-full max-h-[70vh] object-contain shadow-lg bg-white/5 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT FORM SIDE DRAWER PANEL (NO DARK BACKDROP) */}
      {isFormModalOpen && (
        <div className="fixed inset-y-0 right-0 z-50 pointer-events-none flex justify-end font-sans">
          <div className="pointer-events-auto bg-white border-l border-slate-300 w-full max-w-3xl h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-3.5 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b] shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#0099ec]/15 rounded border border-[#0099ec]/30 text-[#0099ec]">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900">
                    {editingProduct ? `Edit Master Product — ${editingProduct.product_code}` : 'Add New Product to Database'}
                  </h3>
                  <p className="text-[10px] text-slate-600 font-medium">
                    {editingProduct ? 'Update product specifications & pricing in database' : 'Form input for new product record'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer rounded hover:bg-slate-200/50"
                title="Close Panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col min-h-0">
              
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs text-slate-900 bg-slate-100">
                
                {/* Form Table Container */}
                <div className="border border-slate-300 rounded shadow-xs overflow-hidden bg-white text-xs">
                  
                  {/* Section 1 Header */}
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-bold text-slate-800 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#0099ec]" />
                      IDENTIFIKASI & METADATA PRODUK
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Detail Master Barang</span>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="w-28 bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-middle">
                          Product Code <span className="text-rose-500">*</span>
                        </td>
                        <td className="p-1 border-r border-slate-200 align-middle w-1/2">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              required
                              value={productCode}
                              onChange={(e) => setProductCode(e.target.value)}
                              className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] px-2 py-1 font-mono text-xs font-bold text-slate-900 rounded-xs"
                            />
                            {!editingProduct && (
                              <button
                                type="button"
                                onClick={() => setProductCode(generateNextProductCode(products))}
                                title="Auto-generate next available unused code"
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded border border-blue-200 shrink-0 cursor-pointer transition"
                              >
                                Auto Next
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="w-28 bg-purple-50/80 px-2.5 py-1.5 font-bold text-purple-950 border-r border-slate-200 align-middle">
                          Kode IMPA
                        </td>
                        <td className="p-1 align-middle">
                          <input
                            type="text"
                            value={impaCode}
                            onChange={(e) => setImpaCode(e.target.value)}
                            placeholder="E.g. 330101"
                            className="w-full bg-purple-50/30 focus:bg-white border border-purple-300 focus:border-purple-600 px-2 py-1 font-mono text-xs font-bold text-purple-950 rounded-xs"
                          />
                        </td>
                      </tr>

                      <tr className="border-b border-slate-200">
                        <td className="bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-middle">
                          Category
                        </td>
                        <td className="p-1 border-r border-slate-200 align-middle">
                          <select
                            value={category}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                const custom = prompt('Masukkan nama kategori baru:');
                                if (custom && custom.trim()) {
                                  setCategory(custom.trim());
                                }
                              } else {
                                setCategory(e.target.value);
                              }
                            }}
                            className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] px-2 py-1 text-xs font-bold text-slate-800 rounded-xs cursor-pointer"
                          >
                            {Array.from(
                              new Set([
                                'Hose & Fitting',
                                'Valves',
                                'Hardware & Tools',
                                'Deck Store',
                                'Engine Store',
                                'Stationery & Office',
                                'Chemicals & Solvents',
                                'Safety Equipment',
                                'Electrical & Spares',
                                ...products.map((p) => p.category).filter(Boolean),
                              ])
                            )
                              .sort()
                              .map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            <option value="__custom__">+ Kategori Baru / Custom...</option>
                          </select>
                        </td>
                        <td className="bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-middle">
                          Supplier/Vendor
                        </td>
                        <td className="p-1 align-middle">
                          <input
                            type="text"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="Nama Supplier / Vendor"
                            className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] px-2 py-1 text-xs font-semibold text-emerald-800 rounded-xs"
                          />
                        </td>
                      </tr>

                      <tr className="border-b border-slate-200">
                        <td className="bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-middle">
                          Product Name <span className="text-rose-500">*</span>
                        </td>
                        <td colSpan={3} className="p-1 align-middle">
                          <input
                            type="text"
                            required
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="Nama Produk Lengkap..."
                            className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] px-2 py-1 text-xs font-bold text-slate-900 rounded-xs"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Section 2 Header */}
                  <div className="bg-slate-100 px-3 py-1.5 border-y border-slate-300 font-bold text-slate-800 flex items-center justify-between text-[11px]">
                    <span>DESKRIPSI & SPESIFIKASI TEKNIS</span>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="w-36 bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-top">
                          Short Description
                        </td>
                        <td className="p-1 align-top">
                          <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ringkasan singkat produk..."
                            className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] p-1.5 text-xs text-slate-800 rounded-xs resize-y"
                          />
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-top">
                          Tech Specs / Maker
                        </td>
                        <td className="p-1 align-top">
                          <textarea
                            rows={2}
                            value={specification}
                            onChange={(e) => setSpecification(e.target.value)}
                            placeholder="Spesifikasi teknis, model, dimensi, tekanan..."
                            className="w-full bg-slate-50/50 focus:bg-white border border-slate-300 focus:border-[#0099ec] p-1.5 text-xs font-mono text-slate-900 rounded-xs resize-y"
                          />
                        </td>
                      </tr>
                      {/* Conditional Alternative Offered Row */}
                      {!showAlternativeOfferInput && !offerText.trim() ? (
                        <tr className="border-b border-slate-200">
                          <td className="bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 border-r border-slate-200 align-middle">
                            Alternative Offered
                          </td>
                          <td className="p-1.5 align-middle bg-emerald-50/20">
                            <button
                              type="button"
                              onClick={() => setShowAlternativeOfferInput(true)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 hover:border-emerald-500 px-3 py-1 rounded cursor-pointer transition shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>+ Add Alternative Offered (Produk / Merek Alternatif)</span>
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr className="border-b border-slate-200">
                          <td className="bg-emerald-50/70 px-2.5 py-1.5 font-bold text-emerald-950 border-r border-slate-200 align-top">
                            <div className="flex flex-col gap-1">
                              <span>Alternative Offered</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setOfferText('');
                                  setShowAlternativeOfferInput(false);
                                }}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline text-left cursor-pointer"
                              >
                                Hapus / Batal
                              </button>
                            </div>
                          </td>
                          <td className="p-1 align-top">
                            <textarea
                              rows={2}
                              value={offerText}
                              onChange={(e) => setOfferText(e.target.value)}
                              placeholder="Penawaran alternatif produk/merek jika spesifikasi sama (contoh: BRAND B - EQUIVALENT SPEC...)"
                              className="w-full bg-emerald-50/20 focus:bg-white border border-emerald-300 focus:border-emerald-600 p-1.5 text-xs font-bold text-emerald-900 rounded-xs resize-y"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Section 3 Header */}
                  <div className="bg-slate-100 px-3 py-1.5 border-y border-slate-300 font-bold text-slate-800 flex items-center justify-between text-[11px]">
                    <span>HARGA, HPP & STOK BARANG</span>
                  </div>

                  <div className="p-1 bg-slate-50">
                    <table className="w-full border-collapse text-xs border border-slate-300 bg-white">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[11px]">
                          <th className="p-1 text-center border-r border-slate-200 w-1/5">Stock Qty</th>
                          <th className="p-1 text-center border-r border-slate-200 w-1/5">Unit</th>
                          <th className="p-1 text-center border-r border-slate-200 w-1/5">Capital Cost ({currencySymbol})</th>
                          <th className="p-1 text-center border-r border-slate-200 w-1/5">Unit Price ({currencySymbol})</th>
                          <th className="p-1 text-center w-1/5">Disc (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-1 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              value={stockQuantity}
                              onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-50 focus:bg-white border border-slate-300 p-1 text-xs text-center font-mono font-bold text-slate-900 rounded-xs"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-200">
                            <select
                              value={unit}
                              onChange={(e) => setUnit(e.target.value)}
                              className="w-full bg-slate-50 focus:bg-white border border-slate-300 p-1 text-xs text-center font-bold cursor-pointer rounded-xs"
                            >
                              {['Package', 'Pcs', 'Unit', 'Set', 'Box', 'Roll', 'Meter', 'Kg', 'Ltr', 'Can', 'Pair', 'Drum', 'Dozen', 'Bottle', 'Sheet', 'Canister', 'Bag', 'Coil'].map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                              {unit && !['Package', 'Pcs', 'Unit', 'Set', 'Box', 'Roll', 'Meter', 'Kg', 'Ltr', 'Can', 'Pair', 'Drum', 'Dozen', 'Bottle', 'Sheet', 'Canister', 'Bag', 'Coil'].includes(unit) && (
                                <option value={unit}>{unit}</option>
                              )}
                            </select>
                          </td>
                          <td className="p-1 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={capitalCost}
                              onChange={(e) => setCapitalCost(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full bg-emerald-50/40 focus:bg-white border border-emerald-300 p-1 text-xs text-center font-mono font-bold text-emerald-800 rounded-xs"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={unitPrice}
                              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full bg-blue-50/40 focus:bg-white border border-blue-300 p-1 text-xs text-center font-mono font-bold text-slate-900 rounded-xs"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={discountPercent}
                              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                              className="w-full bg-amber-50/40 focus:bg-white border border-amber-300 p-1 text-xs text-center font-mono font-bold text-amber-800 rounded-xs"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 4 Header */}
                  <div className="bg-slate-100 px-3 py-1.5 border-y border-slate-300 font-bold text-slate-800 flex items-center justify-between text-[11px]">
                    <span>FOTO PRODUK & UPLOAD</span>
                  </div>

                  {/* Photo Section Row */}
                  <div className="p-2.5 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#0099ec]" />
                        <span>Product Photo</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {photoInputMode === 'upload' ? (
                          <button
                            type="button"
                            onClick={() => setPhotoInputMode('url')}
                            className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                          >
                            <span>Use Web Image URL »</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPhotoInputMode('upload')}
                            className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                          >
                            <span>« Upload File from PC</span>
                          </button>
                        )}

                        <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-emerald-600" />
                          Auto-Compress
                        </span>
                      </div>
                    </div>

                    {photoInputMode === 'upload' && (
                      <div className="space-y-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0]);
                            }
                          }}
                          className="w-full text-[11px] text-slate-700 bg-slate-50 border border-slate-300 p-1 cursor-pointer rounded-xs"
                        />

                        {isCompressingImage && (
                          <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Compressing photo...</span>
                          </div>
                        )}

                        {compressionInfo && (
                          <div className="p-1.5 bg-emerald-50 border border-emerald-300 rounded text-[10px] text-emerald-950 font-semibold flex items-center justify-between">
                            <span>Original: {compressionInfo.originalKb} KB → Compressed: {compressionInfo.compressedKb} KB</span>
                            <span className="text-emerald-700 font-bold">Saved {compressionInfo.ratio}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {photoInputMode === 'url' && (
                      <div>
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://... or relative URL path"
                          className="w-full bg-slate-50 border border-slate-300 p-1.5 text-xs font-mono rounded-xs"
                        />
                      </div>
                    )}

                    {(selectedFile || imageUrl) && (
                      <div className="p-1.5 bg-slate-50 border border-slate-300 rounded flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={selectedFile ? URL.createObjectURL(selectedFile) : resolveProductImageUrl(imageUrl)}
                            alt="Product Preview"
                            className="w-12 h-12 object-cover border border-slate-300 rounded bg-white"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">
                              Photo Preview ({selectedFile ? 'New Upload File' : 'Saved Photo'})
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block max-w-[250px] truncate">
                              {selectedFile ? selectedFile.name : imageUrl}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setImageUrl('');
                            setCompressionInfo(null);
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200 text-[10px] font-bold cursor-pointer transition"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Drawer Footer Action Buttons */}
              <div className="p-3.5 bg-white border-t border-slate-300 flex items-center justify-between gap-3 shrink-0 shadow-md">
                <span className="text-[10px] text-slate-500 font-bold">
                  {editingProduct ? `Editing ID: #${editingProduct.id}` : 'New Product Record'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isCompressingImage}
                    className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] text-white font-extrabold text-xs px-5 py-1.5 rounded-sm border border-[#0060b0] shadow-sm cursor-pointer hover:brightness-105 transition disabled:opacity-50"
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
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CSV / SPREADSHEET UPLOAD POPUP MODAL */}
      {isUploadModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUploadModalOpen(false);
              setDraggedFile(null);
            }
          }}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in font-sans"
        >
          <div className="bg-white border border-slate-300 w-full max-w-lg shadow-2xl overflow-hidden rounded-md animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-3.5 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] text-[#3d3d3d] flex items-center justify-between border-b border-[#7b7b7b]">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#0099ec]" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  Upload Data CSV / Spreadsheet Produk
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setDraggedFile(null);
                }}
                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs text-slate-900 bg-slate-50">
              
              {/* Template Download Card */}
              <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-md flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-blue-900 block text-xs flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-blue-600" />
                    Need Standard CSV File Format?
                  </span>
                  <p className="text-[11px] text-blue-800">
                    Download ERP ABMALAYA standard template file as column format reference.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadFilteredCSV(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] flex items-center gap-1.5 shrink-0 shadow-xs transition cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Download Template CSV</span>
                </button>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                    : draggedFile
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 bg-white hover:bg-slate-100/70 hover:border-blue-400'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDraggedFile(e.target.files[0]);
                    }
                  }}
                />

                {draggedFile ? (
                  <div className="space-y-1.5">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-full w-11 h-11 mx-auto flex items-center justify-center shadow-xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <p className="font-extrabold text-slate-900 text-xs">{draggedFile.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono font-bold">
                      {(draggedFile.size / 1024).toFixed(1)} KB • {draggedFile.type || 'CSV File'}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-blue-600 font-bold hover:underline">
                      Click to choose another file
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full shadow-2xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 text-xs">
                        Drag & Drop CSV file here
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        or <span className="text-blue-600 font-bold hover:underline">click to browse file</span> from your computer
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase bg-slate-200 px-2 py-0.5 rounded">
                      Supported format: .CSV
                    </span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setDraggedFile(null);
                  }}
                  className="px-4 py-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] text-[#3d3d3d] border border-[#a0a0a0] font-bold text-xs rounded-sm cursor-pointer hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteCSVUpload()}
                  disabled={!draggedFile || isUploadingCSV}
                  className="flex items-center gap-1.5 bg-gradient-to-b from-[#00b4ff] to-[#0080d0] text-white font-extrabold text-xs px-5 py-1.5 rounded-sm border border-[#0060b0] shadow-sm cursor-pointer hover:brightness-105 transition disabled:opacity-50"
                >
                  {isUploadingCSV ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Uploading & Processing CSV...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-white" />
                      <span>Process Data Upload</span>
                    </>
                  )}
                </button>
              </div>

            </div>

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

export const ProductCatalog = Product;
export default Product;
