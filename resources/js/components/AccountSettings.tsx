import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types/erp';
import { ShieldAlert, UserPlus, Users, Search, Trash2, Key, ShieldCheck, CheckCircle2, X } from 'lucide-react';

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

  const isAdmin = currentUser.role === 'Admin';

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

  if (!isAdmin) {
    return (
      <div className="w-full p-8 bg-white min-h-[calc(100vh-53px)] space-y-6 text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            Access Restricted — Admin Only Permission Required
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Your current logged-in role is <strong className="text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200">{currentUser.role}</strong>. 
            Access to Account Settings and User Management is strictly restricted to accounts with the <strong className="text-blue-700 font-bold">Admin</strong> role.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 bg-slate-50 p-6 space-y-3 max-w-xl mx-auto border border-slate-200">
          <p className="text-xs font-semibold text-slate-700">
            Want to test Admin role permissions? Switch to an Admin account:
          </p>
          <div className="flex justify-center gap-3">
            {users
              .filter((u) => u.role === 'Admin')
              .map((adminUser) => (
                <button
                  key={adminUser.id}
                  onClick={() => onSwitchUser(adminUser)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 shadow-2xs transition cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Switch to {adminUser.name} (Admin)</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 sm:p-8 bg-white min-h-[calc(100vh-53px)] space-y-6">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 w-full">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Account & User Management — abmalaya.com (Malaysia)
          </h2>
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
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUser.id;
              return (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{user.name}</span>
                      {isSelf && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5">
                          (You)
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] font-mono">{user.email}</div>
                  </td>
                  <td className="p-3.5">
                    {user.role === 'Admin' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-0.5 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-0.5 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-500" /> Karyawan
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 font-medium text-slate-700">{user.department}</td>
                  <td className="p-3.5 text-center">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] px-2 py-0.5 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {user.status}
                    </span>
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
