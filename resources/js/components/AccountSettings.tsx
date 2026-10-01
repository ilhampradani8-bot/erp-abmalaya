// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, ActivityLog } from '../types/erp';
import { 
  UserPlus, Users, Search, Trash2, Key, ShieldCheck, CheckCircle2, 
  X, Edit3, Activity, Shield, Sparkles, Clock, Lock, Check,
  SlidersHorizontal, RefreshCw, Smartphone, Laptop, Zap, Eye, EyeOff
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
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('table');

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
      setModalPwdMessage({ type: 'error', text: 'Silakan masukkan sandi saat ini atau Master Passphrase.' });
      return;
    }
    if (!userPassword.trim() || userPassword.trim().length < 4) {
      setModalPwdMessage({ type: 'error', text: 'Sandi baru minimal harus 4 karakter.' });
      return;
    }
    if (userPassword !== confirmPassword) {
      setModalPwdMessage({ type: 'error', text: 'Konfirmasi sandi baru tidak cocok. Periksa kembali.' });
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
        setModalPwdMessage({ type: 'success', text: `Sandi untuk ${editingUser.name} berhasil diperbarui di MySQL!` });
        setCurrentPasswordInput('');
        setUserPassword('');
        setConfirmPassword('');
        fetchLogs();
      } else {
        setModalPwdMessage({ type: 'error', text: data.message || 'Gagal mengubah sandi akun.' });
      }
    } catch (err: any) {
      setModalPwdMessage({ type: 'error', text: 'Koneksi error: ' + err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Nama dan Email wajib diisi!');
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
    if (confirm(`Apakah Anda yakin ingin menghapus akun pengguna "${userName}"?`)) {
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
    <div className="w-full flex-1 bg-[#090a0f] text-slate-100 font-sans min-h-screen flex flex-col p-4 md:p-6 space-y-5 selection:bg-cyan-500 selection:text-black">
      
      {/* ── TOP WATCHOS ACTIVITY METRIC CAPSULES ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ring 1: Total Users */}
        <div className="bg-[#13151f]/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="space-y-1 z-10">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              Total Akun
            </span>
            <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
              <span>{users.length}</span>
              <span className="text-[11px] font-semibold text-slate-400">Pengguna</span>
            </div>
            <p className="text-[10px] text-cyan-400 font-medium">Terdaftar di MySQL</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Ring 2: Active Session */}
        <div className="bg-[#13151f]/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="space-y-1 z-10">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00e676]" />
              Sesi Anda
            </span>
            <div className="text-sm font-black text-white tracking-tight truncate max-w-[130px]">
              {currentUser?.name || 'Admin'}
            </div>
            <p className="text-[10px] text-emerald-400 font-mono truncate">{currentUser?.email || 'sales@abmalaya.com'}</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(0,230,118,0.15)]">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Ring 3: Admin Privileges */}
        <div className="bg-[#13151f]/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="space-y-1 z-10">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#ff9500]" />
              Hak Akses Admin
            </span>
            <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
              <span>{adminCount}</span>
              <span className="text-[11px] font-semibold text-slate-400">/ {users.length}</span>
            </div>
            <p className="text-[10px] text-amber-400 font-medium">Full Master Control</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(255,149,0,0.15)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Ring 4: Standard Staff */}
        <div className="bg-[#13151f]/90 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="space-y-1 z-10">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#af52de]" />
              Karyawan & Sales
            </span>
            <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
              <span>{staffCount}</span>
              <span className="text-[11px] font-semibold text-slate-400">Anggota</span>
            </div>
            <p className="text-[10px] text-purple-400 font-medium">Standard Operator</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-400 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(175,82,222,0.15)]">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── SEARCH & CONTROLS TOOLBAR ────────────────────────────────────────── */}
      <div className="w-full bg-[#13151f]/90 border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg backdrop-blur-xl">
        <div className="flex items-center space-x-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama anggota tim, email, atau divisi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#090a0f] border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Layout Toggle */}
          <div className="bg-[#090a0f] p-1 rounded-xl border border-white/10 flex items-center space-x-1 text-xs">
            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${viewLayout === 'table' ? 'bg-cyan-500 text-black shadow-xs' : 'text-slate-400 hover:text-white'}`}
            >
              Tabel
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${viewLayout === 'grid' ? 'bg-cyan-500 text-black shadow-xs' : 'text-slate-400 hover:text-white'}`}
            >
              Kartu Modular
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* ── MODULAR GRID VIEW (watchOS Style) ─────────────────────────────────── */}
      {viewLayout === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredUsers.map((user) => {
            const isSelf = Boolean(currentUser && user.email.toLowerCase() === currentUser.email?.toLowerCase());
            const isAdmin = user.role === 'Admin';
            return (
              <div
                key={user.id}
                onClick={() => handleOpenEditModal(user, 'profile')}
                className={`bg-[#13151f]/90 border ${isSelf ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(0,230,118,0.15)]' : 'border-white/10 hover:border-cyan-500/40'} rounded-3xl p-4 flex flex-col justify-between space-y-3 backdrop-blur-xl transition-all cursor-pointer group relative overflow-hidden`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                    {user.role || 'Karyawan'}
                  </span>
                  {isSelf && (
                    <span className="flex items-center space-x-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00e676]" />
                      <span>Sesi Aktif</span>
                    </span>
                  )}
                </div>

                {/* Avatar & Info */}
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base ${isAdmin ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-black shadow-lg shadow-orange-500/20' : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20'}`}>
                    {getInitials(user.name)}
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h4 className="font-extrabold text-sm text-white truncate group-hover:text-cyan-400 transition">{user.name}</h4>
                    <p className="text-[11px] font-mono text-slate-400 truncate">{user.email}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.department || 'Sales Executive'}</p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(user, 'password')}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 inline-flex items-center space-x-1"
                  >
                    <Key className="w-3 h-3" />
                    <span>Ubah Sandi</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(user)}
                        className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition"
                      >
                        Beralih Sesi
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(user.id, user.name)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HIGH DENSITY TABLE VIEW ──────────────────────────────────────────── */}
      {viewLayout === 'table' && (
        <div className="w-full bg-[#13151f]/90 border border-white/10 rounded-2xl overflow-hidden shadow-lg backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#090a0f]/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3 w-12 text-center">Inisial</th>
                  <th className="p-3">Nama & Alamat Email</th>
                  <th className="p-3 w-36">Hak Akses (Role)</th>
                  <th className="p-3 w-48">Departemen / Divisi</th>
                  <th className="p-3 w-36 text-center">Status Sesi</th>
                  <th className="p-3 w-40 text-center">Aksi / Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Tidak ditemukan anggota tim yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelf = Boolean(currentUser && user.email.toLowerCase() === currentUser.email?.toLowerCase());
                    const isAdmin = user.role === 'Admin';
                    return (
                      <tr
                        key={user.id}
                        onClick={() => handleOpenEditModal(user, 'profile')}
                        className={`hover:bg-white/5 transition cursor-pointer ${isSelf ? 'bg-emerald-500/5' : ''}`}
                      >
                        <td className="p-3 text-center">
                          <div className={`w-8 h-8 rounded-xl mx-auto flex items-center justify-center font-black text-xs ${isAdmin ? 'bg-amber-500 text-black' : 'bg-cyan-500 text-black'}`}>
                            {getInitials(user.name)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-extrabold text-white flex items-center space-x-2">
                            <span>{user.name}</span>
                            {isSelf && (
                              <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                Sesi Anda
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-cyan-400 text-[11px] mt-0.5">{user.email}</div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                            <Shield className="w-3 h-3" />
                            <span>{user.role || 'Karyawan'}</span>
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-300">{user.department || 'Sales Executive'}</td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {isSelf ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(user)}
                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-[10px] font-bold transition"
                            >
                              Beralih Sesi
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(user, 'password')}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition inline-flex items-center space-x-1"
                              title="Ganti Sandi"
                            >
                              <Key className="w-3 h-3" />
                              <span>Sandi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(user, 'profile')}
                              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                              title="Edit Profil"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(user.id, user.name)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                                title="Hapus Akun"
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
        </div>
      )}

      {/* ── LIVE AUDIT TRAIL TIMELINE (watchOS Activity Log) ──────────────────── */}
      <div className="w-full bg-[#13151f]/90 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Log Aktivitas & Audit Trail Sesi Pengguna (Live MySQL)</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="p-1 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/5 transition"
            title="Muat Ulang Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#090a0f] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="p-2.5 w-44">Waktu / Timestamp</th>
                <th className="p-2.5 w-48">Pengguna</th>
                <th className="p-2.5 w-32">Jenis Aktivitas</th>
                <th className="p-2.5">Rincian Detail</th>
                <th className="p-2.5 w-28 text-center">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-slate-500 font-medium">
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-slate-500 font-medium">
                    Belum ada log aktivitas sesi login recorded di database.
                  </td>
                </tr>
              ) : (
                activityLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">{log.created_at}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="font-bold text-white">{log.user_name}</div>
                      <div className="text-[10px] font-mono text-cyan-400">{log.user_email}</div>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        {log.action_type || log.action || 'LOGIN'}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-300 font-medium">{log.details}</td>
                    <td className="p-2.5 font-mono text-[10px] text-center text-slate-400 whitespace-nowrap">{log.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── WATCHOS POPUP MODAL (Add / Edit User & Password) ─────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
          <div className="bg-[#13151f] border border-white/20 max-w-lg w-full shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 bg-[#090a0f] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black">
                  {modalTab === 'password' ? <Key className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">
                    {editingUser ? `Kelola Pengguna: ${editingUser.name}` : 'Tambah Anggota Tim Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingUser ? `${editingUser.email} • ${editingUser.role}` : 'Pendaftaran akun sistem ERP'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs for existing user */}
            {editingUser && (
              <div className="flex border-b border-white/10 bg-[#090a0f] p-1.5 gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalTab('profile')}
                  className={`flex-1 py-1.5 rounded-xl transition ${modalTab === 'profile' ? 'bg-cyan-500 text-black font-black shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  1. User Profile
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('password')}
                  className={`flex-1 py-1.5 rounded-xl transition ${modalTab === 'password' ? 'bg-amber-500 text-black font-black shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  2. Password & Security
                </button>
              </div>
            )}

            {/* TAB 1: PROFIL */}
            {modalTab === 'profile' && (
              <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Full Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aiman Zaki"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Address:</label>
                  <input
                    type="email"
                    required
                    placeholder="aimanzaki@abmalaya.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Department / Division:</label>
                  <input
                    type="text"
                    placeholder="Sales / Procurement / Operations"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-2">
                    Role & Permissions:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center justify-between p-3 border rounded-2xl cursor-pointer transition ${
                        role === 'Admin'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold'
                          : 'bg-[#090a0f] border-white/10 hover:border-white/20 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="user_role"
                          value="Admin"
                          checked={role === 'Admin'}
                          onChange={() => setRole('Admin')}
                          className="accent-amber-500"
                        />
                        <div>
                          <span className="block text-xs text-white">Admin</span>
                          <span className="text-[10px] text-slate-400 font-normal">Full Control</span>
                        </div>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                    </label>

                    <label
                      className={`flex items-center justify-between p-3 border rounded-2xl cursor-pointer transition ${
                        role === 'Karyawan' || role === 'Staff'
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-bold'
                          : 'bg-[#090a0f] border-white/10 hover:border-white/20 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="user_role"
                          value="Staff"
                          checked={role === 'Karyawan' || role === 'Staff'}
                          onChange={() => setRole('Staff')}
                          className="accent-cyan-500"
                        />
                        <div>
                          <span className="block text-xs text-white">Staff</span>
                          <span className="text-[10px] text-slate-400 font-normal">Standard</span>
                        </div>
                      </div>
                      <Users className="w-4 h-4 text-cyan-400" />
                    </label>
                  </div>
                </div>

                {!editingUser && (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Initial Password:</label>
                    <input
                      type="password"
                      placeholder="Default: abmalaya2026!"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Leave empty to automatically use default password <code>abmalaya2026!</code>.
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold rounded-xl shadow-lg shadow-cyan-500/20"
                  >
                    {editingUser ? 'Save User Profile' : '+ Create User Account'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: PASSWORD */}
            {modalTab === 'password' && editingUser && (
              <form onSubmit={handleModalPasswordSave} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-2xl flex items-start gap-2.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300">Change Password: {editingUser.name}</strong>
                    <span className="text-[11px] text-amber-200/80">
                      This new password will be used for login and user switching across the ERP.
                    </span>
                  </div>
                </div>

                {modalPwdMessage && (
                  <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 font-bold ${
                    modalPwdMessage.type === 'success' 
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                      : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  }`}>
                    {modalPwdMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-rose-400" />}
                    <span>{modalPwdMessage.text}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Current Password / Master Passphrase:</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password or Master Passphrase..."
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Use current account password or Master Passphrase (<code>abmalaya2026!</code>).
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">New Password:</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min. 4 characters)..."
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Confirm New Password:</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#090a0f] border border-white/15 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword || !userPassword.trim()}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isUpdatingPassword ? 'Saving...' : 'Save New Password'}</span>
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

export default AccountSettings;
