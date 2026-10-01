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
  const [role, setRole] = useState<UserRole>('Karyawan');
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
    setRole('Karyawan');
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
    setRole(user.role || 'Karyawan');
    setModalTab(tab);
    setModalPwdMessage(null);
    setShowAddModal(true);
  };

  const handleModalPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!currentPasswordInput.trim()) {
      setModalPwdMessage({ type: 'error', text: 'Please enter your current password or ERP Master Passphrase.' });
      return;
    }
    if (!userPassword.trim() || userPassword.trim().length < 4) {
      setModalPwdMessage({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }
    if (userPassword !== confirmPassword) {
      setModalPwdMessage({ type: 'error', text: 'Password confirmation does not match.' });
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
        setModalPwdMessage({ type: 'success', text: `Password for ${editingUser.name} updated successfully in MySQL!` });
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
    setRole('Karyawan');
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
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">User Accounts & Roles</h1>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                MySQL Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Manage operator permissions, reset passwords, and switch active profiles.</p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Total:</span>
            <span className="font-bold text-slate-900 font-mono">{users.length} Users</span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-600 font-medium">Admins:</span>
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
              Card View
            </button>
          </div>

          {/* Refresh Activity Logs */}
          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            title="Refresh logs"
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
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* ── ACCOUNTS LISTING (FAST TABLE / CARD VIEW) ────────────────────────── */}
      {viewLayout === 'table' ? (
        <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">User Details</th>
                <th className="py-2.5 px-4">Role & Access</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.email?.toLowerCase() === user.email.toLowerCase();
                  const isAdmin = user.role === 'Admin';
                  return (
                    <tr key={user.id} className="hover:bg-blue-50/40 transition-all group">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-2xs ${
                            isAdmin ? 'bg-gradient-to-b from-blue-600 to-indigo-700' : 'bg-gradient-to-b from-slate-600 to-slate-800'
                          }`}>
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{user.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300">
                                  Current Session
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">{user.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          <Shield className="w-3 h-3" />
                          <span>{user.role}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {user.department || 'General'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => onSwitchUser(user)}
                            title="Switch into this user account"
                            className="px-2 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-300 rounded text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Switch
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(user, 'password')}
                            title="Change password"
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(user, 'profile')}
                            title="Edit details"
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {users.length > 1 && (
                            <button
                              onClick={() => handleDeleteClick(user.id, user.name)}
                              title="Delete account"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isCurrent = currentUser?.email?.toLowerCase() === user.email.toLowerCase();
            const isAdmin = user.role === 'Admin';
            return (
              <div key={user.id} className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs space-y-3 relative hover:border-blue-400 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs ${
                      isAdmin ? 'bg-gradient-to-b from-blue-600 to-indigo-700' : 'bg-gradient-to-b from-slate-600 to-slate-800'
                    }`}>
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{user.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">{user.department}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isAdmin ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {user.role}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <button
                    onClick={() => onSwitchUser(user)}
                    className="flex-1 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-all cursor-pointer text-center"
                  >
                    Switch User
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(user, 'password')}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(user, 'profile')}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {users.length > 1 && (
                    <button
                      onClick={() => handleDeleteClick(user.id, user.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RECENT SECURITY & ACTIVITY AUDIT LOGS ────────────────────────────── */}
      <div className="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Security & User Activity Logs</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Real-time MySQL Audit Trail</span>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
          {activityLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No recorded user activity logs in MySQL database.
            </div>
          ) : (
            activityLogs.map((log, index) => (
              <div key={log.id || index} className="p-3 flex items-start justify-between hover:bg-slate-50 transition-all">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">{log.user_name || 'System'}</span>
                    <span className="text-[10px] font-mono text-slate-400">({log.user_email || 'system'})</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded border border-slate-200 font-mono">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{log.details}</p>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono flex-shrink-0 pl-3">
                  <div>{log.created_at}</div>
                  <div>IP: {log.ip_address || '127.0.0.1'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── MODAL: ADD / EDIT USER & PASSWORD ────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
            
            {/* Modal Top Bar */}
            <div className="px-5 py-3.5 bg-gradient-to-b from-slate-100 to-slate-200 border-b border-slate-300 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {editingUser ? `Account Settings: ${editingUser.name}` : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Selector if Editing */}
            {editingUser && (
              <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
                <button
                  onClick={() => { setModalTab('profile'); setModalPwdMessage(null); }}
                  className={`flex-1 py-2 text-center transition-all cursor-pointer ${
                    modalTab === 'profile' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Profile & Roles
                </button>
                <button
                  onClick={() => { setModalTab('password'); setModalPwdMessage(null); }}
                  className={`flex-1 py-2 text-center transition-all cursor-pointer ${
                    modalTab === 'password' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Change Password
                </button>
              </div>
            )}

            {/* TAB 1: Profile & Details */}
            {modalTab === 'profile' && (
              <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aiman Zaki"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Login Username)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sales@abmalaya.com"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role / Access</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden font-semibold"
                    >
                      <option value="Admin">Admin (Full Master Access)</option>
                      <option value="Sales Engineer">Sales Engineer</option>
                      <option value="Manager">Manager</option>
                      <option value="Finance">Finance</option>
                      <option value="Karyawan">Staff / Operator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Sales & Business Dev"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Default Password</label>
                    <input
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Leave empty for default abm.admin2026!"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {editingUser ? 'Save Changes' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Change Password */}
            {modalTab === 'password' && editingUser && (
              <form onSubmit={handleModalPasswordSave} className="p-5 space-y-4 text-xs">
                {modalPwdMessage && (
                  <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 ${
                    modalPwdMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {modalPwdMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <X className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                    <span>{modalPwdMessage.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password / Master Passphrase</label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password or abm.admin2026!"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-hidden"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
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
