import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface LoginScreenProps {
  onLoginSuccess: (token: string, expiresAt: string, user?: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [passphrase, setPassphrase] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    fetch(getApiUrl('/api_users.php'))
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          setAvailableUsers(data.data);
          const savedSession = localStorage.getItem('abmalaya_user_session');
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed && parsed.email) {
                const userExists = data.data.some((u: any) => u.email && u.email.toLowerCase() === parsed.email.toLowerCase());
                if (userExists) {
                  setSelectedUserEmail(parsed.email);
                } else {
                  localStorage.removeItem('abmalaya_user_session');
                  setSelectedUserEmail('');
                }
              }
            } catch (e) {
              localStorage.removeItem('abmalaya_user_session');
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setErrorMessage('Please enter your account access password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(getApiUrl('/api_auth.php?action=login'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          passphrase: passphrase.trim(),
          email: selectedUserEmail || undefined,
          remember_me: rememberMe,
          device_info: navigator.userAgent || 'Web Browser',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: status ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.token) {
        setIsSuccess(true);
        // Persist immediately in localStorage so HMR / Reload keeps session active
        localStorage.setItem('erp_auth_token', data.token);
        if (data.expires_at) {
          localStorage.setItem('erp_token_expires', data.expires_at);
        }
        localStorage.setItem('erp_auth_active', 'true');
        if (data.user) {
          localStorage.setItem('abmalaya_user_session', JSON.stringify(data.user));
        }

        setTimeout(() => {
          onLoginSuccess(data.token, data.expires_at || '', data.user);
        }, 400);
      } else {
        setErrorMessage(data.message || 'Invalid access password for this account. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(
        'Failed to connect to authentication server. ' + 
        (err.message ? `(${err.message})` : 'Please check your network connection.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] flex flex-col items-center justify-center p-4 relative font-sans select-none text-slate-800">
      {/* Background Subtle Accent Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-60" />

      {/* Main Rectangular Soft-White Card */}
      <div className="relative w-full max-w-[420px] bg-white border border-[#cbd5e1] rounded-none shadow-[4px_4px_16px_rgba(0,0,0,0.08),-4px_-4px_16px_rgba(255,255,255,0.9)] overflow-hidden">
        
        {/* Card Header Top Blue Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0080d0] via-[#00b4ff] to-[#0050a0]" />

        <div className="p-8 space-y-6">
          {/* Brand Header with Official AB Malaya Logo */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-2 bg-[#f8fafc] border border-slate-200 rounded-none shadow-xs mb-1">
              <img
                src="/favicon.png"
                alt="AB Malaya Logo"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div>
              <h1 className="text-base font-black tracking-wider text-slate-900 uppercase">
                AB MALAYA SDN. BHD.
              </h1>
              <p className="text-[11px] font-bold text-[#0070c0] tracking-wider uppercase mt-0.5">
                Enterprise Resource Planning (ERP)
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f1f5f9] border border-slate-300 text-[11px] font-bold text-slate-700">
              <Lock className="w-3.5 h-3.5 text-[#0070c0]" />
              <span>Secure Authentication Gate</span>
            </div>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Success Alert Box */}
          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">Authentication Successful! Opening ERP...</span>
            </div>
          )}

          {/* Form Area */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* User Account Selection (Optional / Quick Select) */}
            {availableUsers.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0070c0]" />
                    <span>Select User Account:</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                </label>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  disabled={isLoading || isSuccess}
                  className="w-full bg-[#fcfdfe] border border-[#a0b0c0] rounded-none px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#0080d0] focus:ring-1 focus:ring-[#0080d0] transition font-sans"
                >
                  <option value="">-- Auto-Detect / Master Passphrase --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email}) — {u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#0070c0]" />
                  <span>Account Access Password:</span>
                </span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter account access password..."
                  disabled={isLoading || isSuccess}
                  autoFocus
                  className="w-full bg-[#fcfdfe] border border-[#a0b0c0] rounded-none px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0080d0] focus:ring-1 focus:ring-[#0080d0] transition pr-10 font-mono shadow-[inset_1px_1px_3px_rgba(0,0,0,0.06)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 rounded-none transition cursor-pointer"
                  title={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Use individual account password or ERP Master Passphrase.
              </p>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-none border-slate-300 text-[#0080d0] focus:ring-[#0080d0] cursor-pointer"
                />
                <span>Remember session on this device (30 Days)</span>
              </label>
            </div>

            {/* Submit Button with Classic ERP Cyan-Blue Gradient */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full bg-gradient-to-b from-[#00b4ff] to-[#0080d0] hover:from-[#00a2e8] hover:to-[#0070b8] active:from-[#0070b8] active:to-[#0050a0] text-white font-extrabold text-xs py-3 rounded-none border border-[#0060b0] shadow-[0_2px_4px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 uppercase tracking-wider"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Credentials...</span>
                </>
              ) : isSuccess ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Access Granted! Opening ERP...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-white" />
                  <span>Unlock ERP Access</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Subtext */}
          <div className="pt-4 border-t border-slate-200 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>256-Bit Bcrypt Protected Security Gate</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Restricted Access • AB Malaya Sdn. Bhd. (Malaysia)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
