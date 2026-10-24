import React from 'react';
import { PlusCircle, Menu, BookOpen } from 'lucide-react';

interface HeaderProps {
  viewMode: 'inbox' | 'builder' | 'invoice_builder' | 'doc_preview' | 'account_settings' | 'system_settings' | 'quotation_list' | 'product_catalog' | 'notification_log' | 'trash_quotation' | 'trash' | 'downloads' | string;
  sentCount: number;
  dealCount: number;
  pendingCount: number;
  onNewQuotation: () => void;
  onToggleMobileSidebar?: () => void;
  onNavigateView?: (mode: string) => void;
  onOpenGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onNewQuotation,
  onToggleMobileSidebar,
  onNavigateView,
  onOpenGuide,
}) => {
  const handleOpenGuide = () => {
    if (onOpenGuide) {
      onOpenGuide();
    } else {
      if (onNavigateView) onNavigateView('system_settings');
      window.dispatchEvent(new CustomEvent('navigate_settings_tab', { detail: 'user_guide' }));
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-1.5 shadow-2xs w-full font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 w-full">
        
        {/* Left: Active View Title, MySQL Live Status, and Guide Button */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-1 text-slate-600 hover:text-slate-900 rounded-none hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Active View Label */}
          <span className="font-extrabold text-blue-700 uppercase tracking-wide text-xs">
            {viewMode === 'inbox' && 'RFQ Inbox'}
            {viewMode === 'product_catalog' && 'Product Master Catalog'}
            {viewMode === 'quotation_list' && 'Quotation Records'}
            {viewMode === 'builder' && 'Quotation Builder'}
            {viewMode === 'notification_log' && 'Notifications Log & History'}
            {viewMode === 'doc_preview' && 'Document Preview (PDF)'}
            {viewMode === 'account_settings' && 'User Account Settings'}
            {viewMode === 'system_settings' && 'ERP System Settings'}
            {viewMode === 'daemon_monitor' && 'Daemon & Activity Monitor'}
            {viewMode === 'trash' && 'Product Trash Bin'}
            {viewMode === 'trash_quotation' && 'Quotation Trash Bin'}
          </span>

          {/* MySQL 8.0 Live Status Badge */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            MySQL 8.0 Live
          </span>

          {/* Tombol Guide Persis di sebelah ERP System Settings / MySQL 8.0 Live */}
          <button
            type="button"
            onClick={handleOpenGuide}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-500 hover:to-amber-500 text-slate-950 border border-amber-500/80 shadow-xs cursor-pointer transition hover:scale-105"
            title="Buka Buku Panduan Penggunaan & Penjelasan Sistem ERP"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-950" />
            <span>📖 Panduan & Penjelasan</span>
            <span className="bg-slate-900 text-amber-300 text-[8.5px] px-1 py-0.2 rounded font-mono font-black uppercase">GUIDE</span>
          </button>
        </div>

        {/* Right: Quick Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onNewQuotation}
            className="flex items-center gap-1.5 bg-[#0099ec] hover:bg-[#0080ce] text-white font-extrabold text-[11px] px-3 py-1 rounded-none transition cursor-pointer shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create New Quotation</span>
          </button>
        </div>

      </div>
    </header>
  );
};

export default Header;

