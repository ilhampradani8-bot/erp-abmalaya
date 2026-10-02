// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, ActivityLog } from '../types/erp';
import { 
  UserPlus, Users, Search, Trash2, Key, ShieldCheck, CheckCircle2, 
  X, Edit3, Activity, Shield, Sparkles, Clock, Lock, Check,
  SlidersHorizontal, RefreshCw, UserCheck, Eye, EyeOff, Laptop, Zap
} from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface AccountSettingsProps {
  currentUser?: UserAccount | null;
  users: UserAccount[];
  onAddUser: (user: UserAccount | Omit<UserAccount, 'created_at'>) => void;
  onDeleteUser: (userId: string) => void;
  onSwitchUser: (user: UserAccount) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  currentUser,
  users,
  onAddUser,
  onDeleteUser,
  onSwitchUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'profile' | 'password'>('profile');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [viewLayout, setViewLayout] = useState<'table' | 'cards'>('table');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Sales Executive');
  const [role, setRole] = useState<UserRole>('Staff');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Tab Password Change State inside Modal
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [modalPwdMessage, setModalPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  const fetchLogs = () => {
    setIsLoadingLogs(true);
    fetch(getApiUrl('/api_user_activity.php'))
      .then((res) => res.json())
      .then((d) => {
        if (d.status === 'success' && d.data) {
          setActivityLogs(d.data);
        }
      })
      .catch((err) => console.error('Fetch activity logs error:', err))
      .finally(() => setIsLoadingLogs(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adminCount = users.filter((u) => u.role === 'Admin').length;
  const staffCount = users.filter((u) => u.role !== 'Admin').length;

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setCurrentPasswordInput('');
    setUserPassword('');
    setConfirmPassword('');
    setDepartment('Sales Executive');
    setRole('Staff');
    setModalTab('profile');
    setModalPwdMessage(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (user: UserAccount, tab: 'profile' | 'password' = 'profile') => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setCurrentPasswordInput('');
    setUserPassword('');
    setConfirmPassword('');
    setDepartment(user.department || 'Sales Executive');
    setRole(user.role || 'Staff');
    setModalTab(tab);
    setModalPwdMessage(null);
    setShowAddModal(true);
  };

  const handleModalPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!currentPasswordInput.trim()) {
      setModalPwdMessage({ type: 'error', text: 'Please enter old password or ERP Master Passphrase.' });
      return;
    }
    if (!userPassword.trim() || userPassword.trim().length < 4) {
      setModalPwdMessage({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }
    if (userPassword !== confirmPassword) {
      setModalPwdMessage({ type: 'error', text: 'New password confirmation does not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    setModalPwdMessage(null);

    try {
      const res = await fetch(getApiUrl('/api_auth.php?action=change_user_password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editingUser.id,
          current_password: currentPasswordInput.trim(),
          new_password: userPassword.trim(),
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setModalPwdMessage({ type: 'success', text: `Account password for ${editingUser.name} updated successfully in database!` });
        setCurrentPasswordInput('');
        setUserPassword('');
        setConfirmPassword('');
        fetchLogs();
      } else {
        setModalPwdMessage({ type: 'error', text: data.message || 'Failed to update account password.' });
      }
    } catch (err: any) {
      setModalPwdMessage({ type: 'error', text: 'Connection error: ' + err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Name and Email are required!');
      return;
    }

    if (editingUser) {
      // Update existing user
      onAddUser({
        id: editingUser.id,
        name: name.trim(),
        email: email.trim(),
        role,
        department: department.trim(),
        status: editingUser.status || 'Active',
        created_at: editingUser.created_at,
        password: userPassword.trim() || undefined,
      } as any);
    } else {
      // Add new user
      onAddUser({
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        email: email.trim(),
        role,
        department: department.trim(),
        status: 'Active',
        password: userPassword.trim() || undefined,
      } as any);
    }

    setName('');
    setEmail('');
    setUserPassword('');
    setDepartment('Sales Executive');
    setRole('Staff');
    setEditingUser(null);
    setShowAddModal(false);
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete user account "${userName}"?`)) {
      onDeleteUser(userId);
    }
  };

  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return str.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-full flex-1 bg-[#f0f2f5] text-slate-800 font-sans min-h-screen flex flex-col p-4 md:p-6 space-y-5 antialiased overflow-y-auto">
      
      {/* ── TOP FAST METRICS TOOLBAR (Apple iTunes / Mac Preferences Bar) ────── */}
      <header className="w-full bg-gradient-to-b from-white via-slate-50 to-slate-100 border border-slate-300 rounded-xl shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-xs font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">User Accounts & Access Permissions</h1>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                MySQL Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Manage operator permissions, update account credentials, and switch active profiles.</p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Total:</span>
            <span className="font-bold text-slate-900 font-mono">{users.length} Accounts</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-600 font-medium">Admin:</span>
            <span className="font-bold text-blue-700 font-mono">{adminCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Staff:</span>
            <span className="font-bold text-slate-700 font-mono">{staffCount}</span>
          </div>
        </div>
      </header>

      {/* ── SEARCH & ACTION CONTROLS BAR ─────────────────────────────────────── */}
      <div className="w-full bg-white border border-slate-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Layout Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-300 flex items-center text-xs">
            <button
              onClick={() => setViewLayout('table')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                viewLayout === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewLayout('cards')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                viewLayout === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cards View
            </button>
          </div>

          {/* Refresh Activity Logs */}
          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            title="Refresh activity logs"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Add New User Button */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* ── ACCOUNTS LISTING (FAST TABLE / CARD VIEW) ────────────────────────── */}
      {viewLayout === 'table' ? (
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">User Name & Email</th>
                  <th className="py-2.5 px-4">Department / Division</th>
                  <th className="py-2.5 px-4">Role & Access</th>
                  <th className="py-2.5 px-4">Account Status</th>
                  <th className="py-2.5 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No user accounts found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isCurrent = currentUser?.id === user.id || currentUser?.email === user.email;
                    const isAdminUser = user.role === 'Admin';
                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isCurrent ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs ${
                              isAdminUser ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900">{user.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                                    Active
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{user.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200">
                            {user.department || 'Sales Executive'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {isAdminUser ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span>Administrator</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                              <span>{user.role || 'Staff'}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{user.status || 'Active'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {!isCurrent && (
                              <button
                                onClick={() => onSwitchUser(user)}
                                title="Switch to this account"
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] transition-all border border-slate-300 cursor-pointer"
                              >
                                Switch Account
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEditModal(user, 'password')}
                              title="Change account password"
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-all cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(user, 'profile')}
                              title="Edit profile details"
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteClick(user.id, user.name)}
                              disabled={isCurrent}
                              title={isCurrent ? 'Cannot delete currently active account' : 'Delete account'}
                              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                                isCurrent 
                                  ? 'text-slate-300 cursor-not-allowed' 
                                  : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isCurrent = currentUser?.id === user.id || currentUser?.email === user.email;
            const isAdminUser = user.role === 'Admin';
            return (
              <div
                key={user.id}
                className={`bg-white border rounded-xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 ${
                  isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-2xs ${
                      isAdminUser ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{user.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                    {user.department || 'Sales Executive'}
                  </span>
                  {isAdminUser ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      <ShieldCheck className="w-3 h-3 text-purple-600" />
                      <span>Admin</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-300">
                      {user.role || 'Staff'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {!isCurrent ? (
                    <button
                      onClick={() => onSwitchUser(user)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs border border-slate-300 cursor-pointer"
                    >
                      Switch Account
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-blue-700 flex items-center space-x-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Your Session</span>
                    </span>
                  )}

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(user, 'password')}
                      title="Change account password"
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(user, 'profile')}
                      title="Edit profile details"
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user.id, user.name)}
                      disabled={isCurrent}
                      title={isCurrent ? 'Cannot delete currently active account' : 'Delete account'}
                      className={`p-1.5 rounded-md cursor-pointer ${
                        isCurrent ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SECURITY & ACTIVITY AUDIT TRAIL ─────────────────────────────────── */}
      <div className="w-full bg-white border border-slate-300 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Security & Activity Audit Trail (MySQL: user_activity_logs)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Last 20 Entries</span>
        </div>

        {isLoadingLogs ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Loading user activity logs...</span>
          </div>
        ) : activityLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No security activity logs recorded in the database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Operator</th>
                  <th className="py-2 px-3">Action Type</th>
                  <th className="py-2 px-3">Details & Description</th>
                  <th className="py-2 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                {activityLogs.slice(0, 15).map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {log.created_at || log.timestamp || 'Just Now'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {log.user_name || log.operator || 'System'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px]">
                        {log.action || log.activity_type || 'Activity'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {log.details || log.description || '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: ADD / EDIT USER & PASSWORD CHANGE (Fast Apple UI) ────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">
                  {editingUser ? `Edit Account: ${editingUser.name}` : 'Add New User Account'}
                </span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-Tabs if Editing */}
            {editingUser && (
              <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
                <button
                  onClick={() => setModalTab('profile')}
                  className={`pb-2 px-3 font-semibold text-xs transition-all border-b-2 cursor-pointer ${
                    modalTab === 'profile'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Profile Information
                </button>
                <button
                  onClick={() => setModalTab('password')}
                  className={`pb-2 px-3 font-semibold text-xs transition-all border-b-2 cursor-pointer ${
                    modalTab === 'password'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Change Password
                </button>
              </div>
            )}

            {/* Tab 1: Profile Information */}
            {modalTab === 'profile' && (
              <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Muhammad Aiman"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address (Login ID)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. aiman@abmalaya.com"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Department / Division</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="Sales Executive">Sales Executive</option>
                      <option value="Purchasing">Purchasing</option>
                      <option value="Finance & Accounting">Finance & Accounting</option>
                      <option value="Operations">Operations</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Role & Permissions</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-semibold"
                    >
                      <option value="Staff">Staff (Standard Access)</option>
                      <option value="Admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Initial Password</label>
                    <input
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Enter initial password for new account..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    {editingUser ? 'Save Changes' : 'Add Account'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Change Password (Inside Modal) */}
            {modalTab === 'password' && editingUser && (
              <form onSubmit={handleModalPasswordSave} className="p-5 space-y-4">
                {modalPwdMessage && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-semibold ${
                      modalPwdMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {modalPwdMessage.text}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Current Password / ERP Master Passphrase
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Old password or abm.admin2026!"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Enter the current password or the ERP Master Passphrase for verification.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    {isUpdatingPassword ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
