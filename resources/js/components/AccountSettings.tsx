import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types/erp';
import { UserPlus, Users, Search, Trash2, Key, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface AccountSettingsProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onAddUser: (user: Omit<UserAccount, 'id' | 'created_at'>) => void;
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Sales Executive');
  const [role, setRole] = useState<UserRole>('Karyawan');


  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    onAddUser({
      name,
      email,
      role,
      department,
      status: 'Active',
    });

    setName('');
    setEmail('');
    setDepartment('Sales Executive');
    setRole('Karyawan');
    setShowAddModal(false);
  };

  // Fetch user activity logs from API
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingLogs(true);
    fetch(getApiUrl('/api_user_activity.php'))
      .then(res => res.json())
      .then(d => {
        if (d.status === 'success' && d.data) {
          setActivityLogs(d.data);
        }
      })
      .catch(err => console.error('Fetch activity logs error:', err))
      .finally(() => setIsLoadingLogs(false));
  }, []);

  const teamEmails = ['aimanzaki@abmalaya.com', 'info@abmalaya.com', 'sales@abmalaya.com', 'purchasing@abmalaya.com'];

  return (
    <div className="w-full p-6 sm:p-8 bg-white min-h-[calc(100vh-53px)] space-y-6 font-sans">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 w-full">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            User Login Sessions & Activity Log — abmalaya.com
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select and activate team user sessions. All SPH & login activity is automatically logged.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 shadow-2xs transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add User Account</span>
        </button>
      </div>

      {/* 4 TEAM EMAIL ACCOUNTS QUICK SESSION ACTIVATION CARDS */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Key className="w-4 h-4 text-blue-600" />
          4 Official Team Accounts (1-Click Switch Active Session):
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {users
            .filter(u => teamEmails.includes(u.email.toLowerCase()) || true)
            .slice(0, 4)
            .map((u) => {
              const isActiveSession = u.email.toLowerCase() === currentUser.email.toLowerCase();
              return (
                <div
                  key={u.id}
                  className={`p-3.5 border rounded-lg transition flex flex-col justify-between gap-3 ${
                    isActiveSession
                      ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-slate-50 hover:bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs text-slate-900 truncate">{u.name}</span>
                      {isActiveSession && (
                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          ACTIVE SESSION
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-blue-700 font-bold truncate">{u.email}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{u.department} • {u.role}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSwitchUser(u)}
                    disabled={isActiveSession}
                    className={`w-full py-1.5 px-3 font-bold text-xs rounded transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActiveSession
                        ? 'bg-emerald-600 text-white font-extrabold opacity-90 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    }`}
                  >
                    {isActiveSession ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Current Active Session</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Login as {u.name.split(' ')[0]}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-3 w-full">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Registered Users: <strong className="text-slate-900">{users.length}</strong>
        </div>
      </div>

      {/* Users Table (Full Width Edge to Edge) */}
      <div className="overflow-x-auto border border-slate-200 bg-white w-full">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3.5">User Name & Email</th>
              <th className="p-3.5">Role Permission</th>
              <th className="p-3.5">Department</th>
              <th className="p-3.5 text-center">Session Status</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const isSelf = user.email.toLowerCase() === currentUser.email.toLowerCase();
              return (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{user.name}</span>
                      {isSelf && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5">
                          (Current Active Session)
                        </span>
                      )}
                    </div>
                    <div className="text-blue-700 text-[11px] font-mono font-bold">{user.email}</div>
                  </td>
                  <td className="p-3.5">
                    {user.role === 'Admin' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-0.5 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-0.5 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-500" /> Employee
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 font-medium text-slate-700">{user.department}</td>
                  <td className="p-3.5 text-center">
                    {isSelf ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-0.5 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active (Logged-in)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(user)}
                        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2.5 py-1 font-bold cursor-pointer transition"
                      >
                        <Key className="w-3 h-3 text-blue-600" /> Activate Login Session
                      </button>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    {!isSelf && (
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* USER LOGIN & ACTIVITY LOGS SECTION */}
      <div className="border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            User Login Session Activity Log (Live Audit Trail):
          </h3>
          <span className="text-[10px] text-slate-500 font-mono font-bold">
            Total Logs: {activityLogs.length}
          </span>
        </div>

        <div className="bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">User Name & Email</th>
                <th className="p-2.5">Activity Type</th>
                <th className="p-2.5">Activity Details</th>
                <th className="p-2.5 text-center">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 font-bold">
                    Loading activity log...
                  </td>
                </tr>
              ) : activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 font-bold">
                    No login session logs recorded yet.
                  </td>
                </tr>
              ) : (
                activityLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-[11px] text-slate-500 font-bold">{log.created_at}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{log.user_name}</div>
                      <div className="text-[10px] font-mono text-blue-700">{log.user_email}</div>
                    </td>
                    <td className="p-2.5">
                      <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                        {log.action_type || log.action || 'LOGIN'}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700 font-medium">{log.details}</td>
                    <td className="p-2.5 font-mono text-[10px] text-center text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 max-w-md w-full overflow-hidden shadow-xl">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Add New User Account
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign account role: Admin or Karyawan
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Andi Wijaya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  placeholder="andi@abmalaya.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department:</label>
                <input
                  type="text"
                  placeholder="Sales / Procurement / Finance"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-2">
                  Account Role Permission:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-between p-3 border cursor-pointer transition ${
                      role === 'Admin'
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="user_role"
                        value="Admin"
                        checked={role === 'Admin'}
                        onChange={() => setRole('Admin')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="block font-extrabold text-xs">Admin</span>
                        <span className="text-[10px] text-slate-500">Full Control</span>
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                  </label>

                  <label
                    className={`flex items-center justify-between p-3 border cursor-pointer transition ${
                      role === 'Karyawan'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="user_role"
                        value="Karyawan"
                        checked={role === 'Karyawan'}
                        onChange={() => setRole('Karyawan')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="block font-extrabold text-xs">Karyawan</span>
                        <span className="text-[10px] text-slate-500">Standard Access</span>
                      </div>
                    </div>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs cursor-pointer"
                >
                  + Save User Account
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default AccountSettings;
