import React, { useState } from 'react';
import { Quotation } from '../types/erp';
import { RotateCcw, Trash2, Search, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface TrashQuotationProps {
  quotations: Quotation[];
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[]>>;
  isLoading?: boolean;
  onRefresh: () => void;
  setViewMode: (mode: any) => void;
}

export const TrashQuotation: React.FC<TrashQuotationProps> = ({
  quotations,
  setQuotations,
  isLoading = false,
  onRefresh,
  setViewMode,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const junkQuotations = quotations.filter((q) => {
    const st = (q.status || 'draft').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (q.quotation_number || '').toLowerCase().includes(term) ||
      (q.company_name || '').toLowerCase().includes(term) ||
      (q.client_name || '').toLowerCase().includes(term);
    return st === 'junk' && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleRestore = (id: string) => {
    if (!window.confirm('Are you sure you want to restore this SPH Quotation back to Draft status?')) {
      return;
    }

    // Call update API
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
          // Update local state: change status to 'draft'
          setQuotations((prev) =>
            prev.map((q) => (q.id === id ? { ...q, status: 'draft' } : q))
          );
          alert('SPH Quotation restored successfully as Draft!');
        } else {
          alert('Error restoring SPH: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((err) => console.error('Restore error:', err));
  };

  const handlePermanentDelete = (id: string) => {
    if (
      !window.confirm(
        'WARNING: This action is permanent and cannot be undone! Are you sure you want to delete this SPH permanently from the database?'
      )
    ) {
      return;
    }

    fetch(getApiUrl(`/api_quotations.php?action=delete&id=${encodeURIComponent(id)}&force=true`), {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          // Remove from local state completely
          setQuotations((prev) => prev.filter((q) => q.id !== id));
          alert('SPH Quotation permanently deleted.');
        } else {
          alert('Error deleting SPH: ' + (data.message || 'Unknown error'));
        }
      })
      .catch((err) => console.error('Permanent delete error:', err));
  };

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE TOP METALLIC NAVIGATION & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2.5 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        
        {/* Title and Back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('quotation_list')}
            className="flex items-center gap-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-[#e0e0e0] border border-[#a0a0a0] rounded px-3 py-1 font-bold text-xs shadow-xs text-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <h2 className="font-extrabold text-sm text-slate-800 tracking-wide">Trash Quotation</h2>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
            <input
              type="search"
              placeholder="Search trash SPH..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#a0a0a0] rounded-full pl-9 pr-3 py-1 text-xs text-[#3d3d3d] focus:outline-none shadow-inner font-sans"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] hover:bg-[#e0e0e0] text-[#3d3d3d] rounded transition cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh Trash List"
          >
            <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="flex-1 p-0 overflow-y-auto w-full bg-[#f0f0f0]">
        {isLoading ? (
          <div className="py-24 text-center space-y-2">
            <Loader2 className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Loading trash records...</p>
          </div>
        ) : junkQuotations.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-xs space-y-2">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">Trash is empty. No junked SPH records found.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">No</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-36">SPH Number</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Client Company & Contact</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-28 text-center">Date Issued</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-44 text-right">Grand Total (RM)</th>
                  <th className="p-2.5 text-center w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c6c6c6] bg-white">
                {junkQuotations.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    
                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] font-mono font-bold text-xs">
                      {q.quotation_number}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">
                      <div className="font-bold text-xs mb-0.5">{q.company_name}</div>
                      <div className="text-[11px] text-slate-500">
                        U.p. {q.client_name} • {q.client_email}
                      </div>
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-center font-mono">
                      {q.date_issued}
                    </td>

                    <td className="p-2.5 border-r border-[rgba(0,0,0,0.1)] text-right font-mono font-extrabold text-xs text-slate-600">
                      {formatCurrency(q.grand_total)}
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleRestore(q.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Restore SPH back to draft list"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        
                        <button
                          onClick={() => handlePermanentDelete(q.id)}
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
        <span>{junkQuotations.length} Junked Quotation Records Found in Trash</span>
      </footer>
    </div>
  );
};
