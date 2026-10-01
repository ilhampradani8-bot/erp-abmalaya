import React, { useState } from 'react';
import { UserAccount } from '../types/erp';
import { Eye, EyeOff, Loader2, AlertCircle, X, KeyRound, UserCheck } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface SwitchUserModalProps {
  isOpen: boolean;
  targetUser: UserAccount | null;
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

export const SwitchUserModal: React.FC<SwitchUserModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Silakan masukkan sandi akses akun.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(getApiUrl('/api_auth.php?action=verify_user_password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          user_id: targetUser.id,
          email: targetUser.email,
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (data.status === 'success' && data.valid) {
        setPassword('');
        setErrorMessage('');
        onSuccess(data.user || targetUser);
      } else {
        setErrorMessage(data.message || 'Sandi akses salah untuk akun ini.');
      }
    } catch (err: any) {
      setErrorMessage(
        'Gagal memverifikasi sandi. ' + (err.message ? `(${err.message})` : 'Periksa koneksi server.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="w-full max-w-[400px] bg-white border border-slate-300 shadow-2xl rounded-none overflow-hidden font-sans text-slate-800">
        
        {/* Top Header Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0080d0] via-[#00b4ff] to-[#0050a0]" />

        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 border border-blue-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Konfirmasi Sandi Akses Pengguna
              </h3>
              <p className="text-[10px] text-slate-500">
                Verifikasi keamanan untuk beralih sesi akun
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target User Info Badge */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 border border-blue-700 shadow-xs">
              {targetUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-900 truncate">{targetUser.name}</p>
                <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-none uppercase">
                  {targetUser.role}
                </span>
              </div>
              <p className="text-[11px] font-mono text-blue-700 font-bold truncate">{targetUser.email}</p>
              <p className="text-[10px] text-slate-500 truncate">{targetUser.department || 'Divisi ERP'}</p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Masukkan Sandi Akun Pengguna:</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan sandi akses..."
                  autoFocus
                  disabled={isLoading}
                  className="w-full bg-[#fcfdfe] border border-[#a0b0c0] rounded-none px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#0080d0] focus:ring-1 focus:ring-[#0080d0] transition pr-10 font-mono shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Gunakan sandi akun atau Master Passphrase ERP.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] text-white font-bold text-xs px-4 py-2 border border-[#0060b0] shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Beralih ke Sesi Ini</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
