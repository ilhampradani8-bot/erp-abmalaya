import React from 'react';
import { PlusCircle, Menu } from 'lucide-react';

interface HeaderProps {
  viewMode: 'inbox' | 'builder' | 'invoice_builder' | 'doc_preview' | 'account_settings' | 'system_settings' | 'quotation_list' | 'product_catalog' | 'notification_log' | 'trash_quotation' | 'trash' | 'client_chat';
  sentCount: number;
  dealCount: number;
  pendingCount: number;
  onNewQuotation: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onNewQuotation,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-1.5 shadow-2xs w-full font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 w-full">
        
        {/* Left: Active View Title */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
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
            {viewMode === 'quotation_list' && 'Quotation Data (SPH Records)'}
            {viewMode === 'builder' && 'Quotation Builder'}
            {viewMode === 'notification_log' && 'Notifications Log & History'}
            {viewMode === 'doc_preview' && 'Document Preview (PDF)'}
            {viewMode === 'account_settings' && 'Account Settings'}
            {viewMode === 'system_settings' && 'System Settings'}
          </span>
        </div>

        {/* Right: Quick Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onNewQuotation}
            className="flex items-center gap-1.5 bg-[#0099ec] hover:bg-[#0080ce] text-white font-extrabold text-[11px] px-3 py-1 rounded-none transition cursor-pointer shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create New SPH Quotation</span>
          </button>
        </div>

      </div>
    </header>
  );
};

export default Header;
