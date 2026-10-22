// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Quotation } from '../types/erp';
import { ProductItem } from './Product';
import { RotateCcw, Trash2, Search, AlertTriangle, ArrowLeft, Loader2, Package, FileText, Check, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface TrashProps {
  quotations?: Quotation[];
  setQuotations?: React.Dispatch<React.SetStateAction<Quotation[]>>;
  products?: ProductItem[];
  setProducts?: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  isLoading?: boolean;
  onRefresh?: () => void;
  setViewMode: (mode: any) => void;
}

export const Trash: React.FC<TrashProps> = ({
  quotations = [],
  setQuotations,
  products: initialProducts = [],
  setProducts: setParentProducts,
  isLoading = false,
  onRefresh,
  setViewMode,
}) => {
  const [activeTab, setActiveTab] = useState<'quotations' | 'products'>('quotations');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [productList, setProductList] = useState<ProductItem[]>(initialProducts);
  const [isFetchingProducts, setIsFetchingProducts] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchJunkProducts = () => {
    setIsFetchingProducts(true);
    fetch(getApiUrl('/api_products.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setProductList(resData.data);
          if (setParentProducts) setParentProducts(resData.data);
        }
      })
      .catch((err) => console.error('Fetch products trash error:', err))
      .finally(() => setIsFetchingProducts(false));
  };

  useEffect(() => {
    fetchJunkProducts();
  }, []);

  const junkQuotations = quotations.filter((q) => {
    const st = (q.status || 'draft').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (q.quotation_number || '').toLowerCase().includes(term) ||
      (q.company_name || '').toLowerCase().includes(term) ||
      (q.client_name || '').toLowerCase().includes(term);
    return st === 'junk' && matchesSearch;
  });

  const junkProducts = productList.filter((p) => {
    const st = (p.status || 'active').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (p.product_name || '').toLowerCase().includes(term) ||
      (p.product_code || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term);
    return st === 'junk' && matchesSearch;
  });

  const formatCurrency = (val: number, curr = 'MYR') => {
    const num = Number(val || 0);
    const hasDec = num % 1 !== 0;
    return `${curr} ${num.toLocaleString('en-US', { minimumFractionDigits: hasDec ? 2 : 0, maximumFractionDigits: 2 })}`;
  };

  const handleRestoreQuotation = (id: string) => {
    if (!window.confirm('Restore Quotation back to Draft status?')) return;

    const payload = {
      id: id,
      status: 'draft',
      action: 'restore',
      user_name: 'Admin',
      user_email: 'admin@abmalaya.com'
    };

    fetch(getApiUrl('/api_quotations.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          if (setQuotations) {
            setQuotations((prev) =>
              prev.map((q) => (q.id === id ? { ...q, status: 'draft' } : q))
            );
          }
          setNotification('Quotation restored to Draft successfully!');
          setTimeout(() => setNotification(null), 4000);
          if (onRefresh) onRefresh();
        } else {
          alert('Error restoring quotation: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((err) => console.error('Restore quotation error:', err));
  };

  const handlePermanentDeleteQuotation = (id: string) => {
    if (!window.confirm('WARNING: Delete this quotation permanently from the database? This action cannot be undone.')) return;

    fetch(getApiUrl(`/api_quotations.php?action=delete&id=${encodeURIComponent(id)}&force=true`), {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          if (setQuotations) {
            setQuotations((prev) => prev.filter((q) => q.id !== id));
          }
          setNotification('Quotation permanently deleted.');
          setTimeout(() => setNotification(null), 4000);
          if (onRefresh) onRefresh();
        } else {
          alert('Error deleting quotation: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((err) => console.error('Permanent delete quotation error:', err));
  };

  const handleRestoreProduct = (id: number, name: string) => {
    setProductList((prev) => prev.filter((p) => p.id !== id));

    fetch(getApiUrl(`/api_products.php?action=restore&id=${id}`))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setNotification(`Product "${name}" restored to active product list.`);
          setTimeout(() => setNotification(null), 4000);
        } else {
          fetchJunkProducts();
        }
      })
      .catch(() => fetchJunkProducts());
  };

  const handlePermanentDeleteProduct = (id: number, name: string) => {
    if (!window.confirm(`WARNING: Delete product "${name}" PERMANENTLY? This action cannot be undone.`)) return;

    setProductList((prev) => prev.filter((p) => p.id !== id));

    fetch(getApiUrl(`/api_products.php?action=delete_permanent&id=${id}`))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setNotification(`Product "${name}" permanently deleted.`);
          setTimeout(() => setNotification(null), 4000);
        } else {
          fetchJunkProducts();
        }
      })
      .catch(() => fetchJunkProducts());
  };

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE TOP METALLIC NAVIGATION & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        {/* Title, Back & Sub-tabs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(activeTab === 'products' ? 'product_catalog' : 'quotation_list')}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e0e0e0] border border-[#a0a0a0] rounded px-3 py-1 font-bold text-xs shadow-xs text-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 pr-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <h2 className="font-extrabold text-sm text-slate-800 tracking-wide uppercase">System Trash / Junk Repository</h2>
          </div>

          {/* Sub-tab Switchers */}
          <div className="flex items-center gap-1 bg-slate-200/90 p-0.5 rounded-md border border-slate-300">
            <button
              onClick={() => setActiveTab('quotations')}
              className={`px-3 py-1 text-xs font-extrabold rounded cursor-pointer transition flex items-center gap-1.5 ${
                activeTab === 'quotations' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Quotations ({quotations.filter(q => (q.status || 'draft').toLowerCase() === 'junk').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1 text-xs font-extrabold rounded cursor-pointer transition flex items-center gap-1.5 ${
                activeTab === 'products' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Master Products ({productList.filter(p => (p.status || 'active').toLowerCase() === 'junk').length})</span>
            </button>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
            <input
              type="search"
              placeholder={activeTab === 'quotations' ? "Search trash quotations..." : "Search trash products..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#a0a0a0] rounded-full pl-9 pr-3 py-1 text-xs text-[#3d3d3d] focus:outline-none shadow-inner font-sans"
            />
          </div>

          <button
            onClick={() => {
              if (onRefresh) onRefresh();
              fetchJunkProducts();
            }}
            disabled={isLoading || isFetchingProducts}
            className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] hover:bg-[#e0e0e0] text-[#3d3d3d] rounded transition cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Trash List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isFetchingProducts ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs text-emerald-950 font-bold flex items-center gap-2 shrink-0 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="flex-1 p-0 overflow-y-auto w-full bg-[#f0f0f0]">
        {isLoading || isFetchingProducts ? (
          <div className="py-24 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Loading trash records...</p>
          </div>
        ) : activeTab === 'quotations' ? (
          junkQuotations.length === 0 ? (
            <div className="py-24 text-center text-slate-400 text-xs space-y-2">
              <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">Quotations Trash is empty. No junked quotation records found.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)] min-w-full">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="sticky top-0 z-10 bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide shadow-2xs">
                  <tr>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">No</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36 font-mono">Quotation No.</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Client Company & Contact</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-28 text-center font-mono">Date Issued</th>
                    <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-44 text-right font-mono">Grand Total (RM)</th>
                    <th className="p-2.5 text-center w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c6c6c6] bg-white">
                  {junkQuotations.map((q, idx) => (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-slate-400 font-mono font-bold">
                        {idx + 1}
                      </td>
                      
                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs text-blue-700">
                        {q.quotation_number}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                        <div className="font-bold text-xs mb-0.5 text-slate-900">{q.company_name}</div>
                        <div className="text-[11px] text-slate-500">
                          U.p. {q.client_name} • {q.client_email}
                        </div>
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono text-slate-600">
                        {q.date_issued}
                      </td>

                      <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-extrabold text-xs text-slate-900">
                        {formatCurrency(q.grand_total)}
                      </td>

                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleRestoreQuotation(q.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Restore quotation back to draft list"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          
                          <button
                            onClick={() => handlePermanentDeleteQuotation(q.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Permanently delete from database"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : junkProducts.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-xs space-y-2">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">Products Trash is empty. No junked master product records found.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)] min-w-full">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide shadow-2xs">
                <tr>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">No</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-28 font-mono">Product Code</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Product Name</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32">Category</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32 font-mono text-right">Capital (MYR)</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36 font-mono text-right">Unit Price (MYR)</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-20 text-center font-mono">Stock</th>
                  <th className="p-2.5 text-center w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c6c6c6] bg-white">
                {junkProducts.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-slate-400 font-mono font-bold">
                      {idx + 1}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs text-blue-700">
                      {p.product_code}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-bold text-xs">
                      {p.product_name}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 text-[10px] rounded">
                        {p.category || 'Equipment'}
                      </span>
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-bold text-xs text-emerald-800">
                      {formatCurrency(p.capital || 0)}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-extrabold text-xs text-slate-900">
                      {formatCurrency(p.unit_price || 0)}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono font-bold text-xs text-slate-700">
                      {p.stock_quantity || 0}
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleRestoreProduct(p.id, p.product_name || '')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Restore product back to active list"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>

                        <button
                          onClick={() => handlePermanentDeleteProduct(p.id, p.product_name || '')}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Permanently delete from database"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] border-t border-b border-[#7b7b7b] text-center py-1.5 text-[11px] text-[#3d3d3d] font-semibold w-full shrink-0">
        <span>
          {activeTab === 'quotations'
            ? `${junkQuotations.length} Junked Quotation Records Found in Trash`
            : `${junkProducts.length} Junked Product Records Found in Trash`
          }
        </span>
      </footer>
    </div>
  );
};

export const TrashQuotation = Trash;
export default Trash;
