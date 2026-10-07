import React, { useState, useRef, useEffect } from 'react';
import { UserAccount } from '../types/erp';
import { Mail, FileText, FileCheck, Users, Settings, ChevronRight, Check, PanelLeftClose, PanelLeft, FileSpreadsheet, Package, Bell, Trash2, Receipt, MessageSquare, LogOut } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface SidebarProps {
  viewMode: 'inbox' | 'builder' | 'invoice_builder' | 'doc_preview' | 'account_settings' | 'system_settings' | 'quotation_list' | 'product_catalog' | 'notification_log' | 'trash_quotation' | 'trash' | 'client_chat';
  setViewMode: (mode: any) => void;
  onNewQuotation: () => void;
  pendingCount: number;
  sentCount: number;
  dealCount: number;
  currentUser?: UserAccount;
  users?: UserAccount[];
  onSwitchUser?: (user: UserAccount) => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  setViewMode,
  pendingCount,
  currentUser,
  users = [],
  onSwitchUser,
  onLogout,
  isMobileOpen = false,
  setIsMobileOpen,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [dbUsers, setDbUsers] = useState<UserAccount[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeUser = currentUser || {
    id: '',
    name: 'System User',
    email: '',
    role: 'Admin' as const,
    department: '',
    status: 'Active' as const,
    created_at: '',
  };

  // Fetch unread notification count & MySQL users from backend
  useEffect(() => {
    fetch(getApiUrl('/api_notifications.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          setUnreadNotificationCount(resData.unread_count || 0);
        }
      })
      .catch((err) => console.log('Sidebar unread count error:', err));

    fetch(getApiUrl('/api_users.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data && resData.data.length > 0) {
          setDbUsers(resData.data);
        }
      })
      .catch((err) => console.log('Sidebar MySQL users fetch error:', err));
  }, []);

  const userList = (users && users.length > 0) ? users : (dbUsers.length > 0 ? dbUsers : [activeUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    // ── Communications & Inbox ──
    {
      id: 'inbox',
      label: 'RFQ Inbox',
      icon: Mail,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-amber-500 text-white font-bold',
    },
    {
      id: 'client_chat',
      label: 'Client Emails',
      icon: MessageSquare,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'notification_log',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
      badgeColor: 'backdrop-blur-md bg-rose-600/90 text-white border border-rose-300/50 shadow-xs font-black',
    },
    // ── Quotations & Commercial Documents ──
    {
      id: 'product_catalog',
      label: 'Product Catalog',
      icon: Package,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'quotation_list',
      label: 'Quotations List',
      icon: FileSpreadsheet,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'builder',
      label: 'Create Quotation',
      icon: FileText,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'invoice_builder',
      label: 'Create Invoice',
      icon: Receipt,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'doc_preview',
      label: 'Document Preview',
      icon: FileCheck,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'trash',
      label: 'Trash Bin',
      icon: Trash2,
      badge: null,
      badgeColor: '',
    },
    // ── System & Administration ──
    {
      id: 'account_settings',
      label: 'User Accounts & Access',
      icon: Users,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'system_settings',
      label: 'System Settings',
      icon: Settings,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar — WHITE NEOMORPHISM SOFT-UI DESIGN */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 bg-[#f4f6f9] text-slate-800 flex flex-col transition-all duration-300 border-r border-[#cbd5e1] font-sans ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Top Header: Favicon + Account Name + Dropdown & Collapse */}
        <div className="p-3 border-b border-[#cbd5e1]/60 relative" ref={dropdownRef}>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={`flex-1 flex items-center gap-2.5 p-2 rounded-lg bg-[#f4f6f9] shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] border border-white hover:bg-white transition text-left cursor-pointer overflow-hidden ${
                isCollapsed ? 'justify-center p-2' : ''
              }`}
              title={isCollapsed ? activeUser.name : 'Switch Account'}
            >
              <img
                src="/favicon.png"
                alt="Favicon"
                className="w-7 h-7 rounded object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-xs font-black text-slate-900 truncate leading-tight">{activeUser.name}</p>
                </div>
              )}
              {!isCollapsed && (
                <ChevronRight
                  className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                    isAccountMenuOpen ? 'rotate-90' : ''
                  }`}
                />
              )}
            </button>

            {onToggleCollapse && !isCollapsed && (
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-[#f4f6f9] shadow-[2px_2px_4px_#cbd5e1,-2px_-2px_4px_#ffffff] border border-white transition cursor-pointer shrink-0"
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {onToggleCollapse && isCollapsed && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-[#f4f6f9] shadow-[2px_2px_4px_#cbd5e1,-2px_-2px_4px_#ffffff] border border-white transition cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Account Dropdown Menu */}
          {isAccountMenuOpen && !isCollapsed && (
            <div className="absolute left-3 right-3 top-14 bg-white border border-slate-300 rounded-lg shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Switch User Account</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setViewMode('account_settings');
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold cursor-pointer"
                >
                  Manage
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {userList.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(u);
                      setIsAccountMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-blue-50 transition cursor-pointer ${
                      u.id === activeUser.id ? 'text-blue-700 font-bold bg-blue-50/70' : 'text-slate-700'
                    }`}
                  >
                    <div className="truncate">
                      <p className="truncate font-bold">{u.name}</p>
                      <p className="text-[10px] text-slate-500">{u.email} • {u.role}</p>
                    </div>
                    {u.id === activeUser.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items (White Neomorphism Soft-UI Buttons) */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = viewMode === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setViewMode(item.id);
                  if (setIsMobileOpen) setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-b from-[#00b4ff] to-[#0080d0] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] border border-[#0060b0]'
                    : 'bg-[#f4f6f9] text-slate-700 shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] border border-white hover:bg-white hover:text-slate-900'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-600'}`} />

                {!isCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}

                {!isCollapsed && item.badge !== null && (
                  <span className={`px-2 py-0.5 rounded-none text-[10px] font-extrabold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Logout / Lock ERP Access Button */}
          {onLogout && (
            <div className="pt-3 mt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onLogout}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
                title={isCollapsed ? 'Lock ERP Access (Log Out)' : undefined}
              >
                <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
                {!isCollapsed && <span>Lock ERP Access (Log Out)</span>}
              </button>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
