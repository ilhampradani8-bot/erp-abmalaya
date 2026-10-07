import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, Trash2, Check, RefreshCw, Filter, Search, Calendar, X } from 'lucide-react';
import { getApiUrl } from '../utils/api';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  category?: string;
  is_read: number;
  action_link?: string;
  created_at: string;
}

interface NotificationLogProps {
  onOpenSyncConflictModal?: () => void;
  onNavigateView?: (view: any) => void;
}

export const NotificationLog: React.FC<NotificationLogProps> = ({
  onOpenSyncConflictModal,
  onNavigateView,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const fetchNotificationsFromMySQL = () => {
    setIsLoading(true);
    fetch(getApiUrl('/api_notifications.php'))
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && resData.data) {
          setNotifications(resData.data);
          setUnreadCount(resData.unread_count || 0);
        }
      })
      .catch((err) => console.log('Fetch notifications error:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchNotificationsFromMySQL();
  }, []);

  const handleMarkAllAsRead = () => {
    fetch(getApiUrl('/api_notifications.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_as_read' }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          fetchNotificationsFromMySQL();
        }
      });
  };

  const handleClearAllHistory = () => {
    if (!window.confirm('Delete all notification log history from MySQL database?')) return;

    fetch(getApiUrl('/api_notifications.php'), {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success') {
          fetchNotificationsFromMySQL();
        }
      });
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (item.is_read === 0) {
      fetch(getApiUrl('/api_notifications.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_as_read', id: item.id }),
      }).then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    setSelectedNotification(item);
  };

  const filteredNotifications = notifications.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (item.title || '').toLowerCase().includes(q) ||
      (item.message || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q);

    if (filterType === 'unread') return item.is_read === 0 && matchesSearch;
    if (filterType === 'warning') return (item.type === 'warning' || item.type === 'danger') && matchesSearch;
    if (filterType === 'sync') return item.category === 'sync' && matchesSearch;

    return matchesSearch;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
      case 'danger':
        return (
          <span className="backdrop-blur-md bg-amber-500/15 text-amber-900 border border-amber-400/50 font-black px-2.5 py-0.5 text-[10px] rounded-none flex items-center gap-1 shadow-2xs">
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Sync Warning</span>
          </span>
        );
      case 'success':
        return (
          <span className="backdrop-blur-md bg-emerald-500/15 text-emerald-950 border border-emerald-400/50 font-black px-2.5 py-0.5 text-[10px] rounded-none flex items-center gap-1 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Success</span>
          </span>
        );
      default:
        return (
          <span className="backdrop-blur-md bg-blue-500/15 text-blue-950 border border-blue-400/50 font-bold px-2.5 py-0.5 text-[10px] rounded-none flex items-center gap-1 shadow-2xs">
            <Info className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Information</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full bg-[#f0f0f0] overflow-y-auto flex flex-col font-sans p-0 m-0">
      
      {/* ITUNES-STYLE METALLIC TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-b from-[#fcfcfc] to-[#c6c6c6] px-4 py-2 border-b border-[#7b7b7b] shrink-0 w-full shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 mr-2">
            <Bell className="w-4 h-4 text-[#0099ec]" />
            <span className="uppercase tracking-tight text-xs">System Notifications Log & Activity History</span>
          </div>

          {unreadCount > 0 && (
            <span className="backdrop-blur-md bg-rose-600/90 text-white border border-rose-300/50 font-black px-2.5 py-0.5 rounded-none text-[10px] shadow-xs">
              {unreadCount} Unread
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="px-3 py-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-white text-[#3d3d3d] font-bold text-xs border border-[#a0a0a0] rounded-md shadow-inner transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark All as Read</span>
          </button>

          <button
            type="button"
            onClick={handleClearAllHistory}
            className="px-3 py-1 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] hover:bg-rose-50 text-rose-700 font-bold text-xs border border-[#a0a0a0] rounded-md shadow-inner transition cursor-pointer flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear History</span>
          </button>

          <button
            onClick={fetchNotificationsFromMySQL}
            disabled={isLoading}
            className="p-1.5 bg-gradient-to-b from-[#fafafa] to-[#eaeaea] border border-[#a0a0a0] text-[#3d3d3d] rounded-md shadow-inner transition cursor-pointer"
            title="Refresh Notification Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0099ec]' : ''}`} />
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <span className="font-bold text-slate-500 text-[11px] mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {['all', 'unread', 'warning', 'sync'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 font-bold text-xs rounded transition cursor-pointer capitalize ${
                filterType === type
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
          <input
            type="search"
            placeholder="Search notification history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-full pl-9 pr-3 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-inner"
          />
        </div>
      </div>

      {/* NOTIFICATIONS LOG TABLE CONTAINER */}
      <div className="flex-1 p-0 overflow-y-auto space-y-0 w-full bg-[#f0f0f0]">
        {isLoading ? (
          <div className="py-24 text-center space-y-2">
            <RefreshCw className="w-7 h-7 text-[#0099ec] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Loading notifications log from MySQL...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">No notification history found.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-b border-[rgba(0,0,0,0.2)]">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="bg-gradient-to-b from-[#DFDFDF] to-[#EDEDED] border-b border-[rgba(0,0,0,0.15)] text-[#626262] font-semibold text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-8 text-center">^</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-32">Status / Type</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-60">Notification Title</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)]">Message & Activity Details</th>
                  <th className="p-2.5 border-r border-[rgba(0,0,0,0.1)] w-44 text-center">Created At</th>
                  <th className="p-2.5 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredNotifications.map((item, idx) => {
                  const isUnread = item.is_read === 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`cursor-pointer transition ${
                        isUnread ? 'bg-amber-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-2.5 border-r border-slate-200">
                        {getTypeBadge(item.type)}
                      </td>

                      <td className="p-2.5 border-r border-slate-200">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />}
                          <span>{item.title}</span>
                        </div>
                      </td>

                      <td className="p-2.5 border-r border-slate-200">
                        <p className="text-slate-700 text-xs leading-relaxed">{item.message}</p>
                      </td>

                      <td className="p-2.5 border-r border-slate-200 text-center font-mono text-[11px] text-slate-600">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{item.created_at}</span>
                        </div>
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(item);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] rounded shadow-2xs transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RIGHT SLIDE-OUT DRAWER FOR NOTIFICATION DETAILS */}
      {selectedNotification && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-opacity duration-300 font-sans"
          onClick={() => setSelectedNotification(null)}
        >
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in-right {
              animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div
            className="bg-white border-l-2 border-slate-700 w-full sm:w-[480px] max-w-[95vw] shadow-2xl flex flex-col h-screen overflow-hidden animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400 shrink-0" />
                <h3 className="font-extrabold text-xs">Notification Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-rose-600 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 text-xs">
              {/* Type & Time Badge Card */}
              <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>{getTypeBadge(selectedNotification.type)}</div>
                  <span className="font-mono text-[11px] text-slate-500">{selectedNotification.created_at}</span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 pt-1">{selectedNotification.title}</h4>
              </div>

              {/* Message Details Box */}
              <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-2xs space-y-2">
                <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider block">Message & Log Details:</span>
                <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">{selectedNotification.message}</p>
              </div>

              {/* Category & Status Info Grid */}
              <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-2xs grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-400 text-[10px] block uppercase">Category</span>
                  <span className="font-mono font-bold text-slate-800 uppercase">{selectedNotification.category || 'System'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 text-[10px] block uppercase">Read Status</span>
                  <span className={`font-bold font-mono ${selectedNotification.is_read === 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedNotification.is_read === 1 ? 'Read' : 'Unread'}
                  </span>
                </div>
              </div>

              {/* Action Shortcuts */}
              <div className="space-y-2 pt-2">
                {(selectedNotification.category === 'sph' || selectedNotification.title.toLowerCase().includes('quotation') || selectedNotification.title.toLowerCase().includes('sph')) && onNavigateView && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotification(null);
                      onNavigateView('quotations_list');
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Quotations List →</span>
                  </button>
                )}

                {(selectedNotification.category === 'rfq' || selectedNotification.title.toLowerCase().includes('rfq') || selectedNotification.title.toLowerCase().includes('email')) && onNavigateView && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotification(null);
                      onNavigateView('rfq_inbox');
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Live RFQ Inbox →</span>
                  </button>
                )}

                {(selectedNotification.category === 'sync' || selectedNotification.title.toLowerCase().includes('sync') || selectedNotification.title.toLowerCase().includes('gdrive')) && onOpenSyncConflictModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotification(null);
                      onOpenSyncConflictModal();
                    }}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Sync Conflict Manager →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationLog;
