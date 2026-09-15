'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, Specialization, User, RoleItem } from '../types/task';
import {
  Users,
  Plus,
  Shield,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  KeyRound,
  Layers,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { Dropdown } from './common/Dropdown';
import { UserDetailModal } from './UserDetailModal';

const COLOR_OPTIONS: { id: string; name: string; bg: string; text: string; border: string; preview: string }[] = [
  { id: 'purple', name: 'Tím', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', preview: 'bg-purple-500' },
  { id: 'amber', name: 'Vàng cam', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', preview: 'bg-amber-500' },
  { id: 'blue', name: 'Xanh dương', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', preview: 'bg-blue-500' },
  { id: 'emerald', name: 'Xanh ngọc', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', preview: 'bg-emerald-500' },
  { id: 'rose', name: 'Đỏ hồng', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', preview: 'bg-rose-500' },
  { id: 'indigo', name: 'Xanh chàm', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', preview: 'bg-indigo-500' },
  { id: 'cyan', name: 'Xanh lơ', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300', preview: 'bg-cyan-500' },
  { id: 'slate', name: 'Xám than', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', preview: 'bg-slate-500' },
];

const getRoleStyle = (colorId?: string) => {
  const found = COLOR_OPTIONS.find((c) => c.id === colorId);
  return found || COLOR_OPTIONS[0];
};

export const UserManagementView: React.FC = () => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    roles,
    addRole,
    updateRole,
    deleteRole,
    tasks,
    currentUser,
    confirmDialog,
  } = useApp();

  // Sub-tabs: 'USERS' or 'ROLES'
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES'>('USERS');

  // SELECTED USER FOR DETAIL MODAL
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);

  // USER FORM STATE
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userAccount, setUserAccount] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('Member');
  const [selectedSpecs, setSelectedSpecs] = useState<Specialization[]>(['BA']);
  const [userCccd, setUserCccd] = useState('');
  const [userBankAccount, setUserBankAccount] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userTechnologies, setUserTechnologies] = useState('');
  const [userBirthDate, setUserBirthDate] = useState('');

  // ROLE FORM STATE
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleColor, setRoleColor] = useState('purple');
  const [roleError, setRoleError] = useState('');

  // USER ACTIONS
  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserAccount('');
    setUserRole('Member');
    setSelectedSpecs([roles[0]?.code || 'BA']);
    setUserCccd('');
    setUserBankAccount('');
    setUserEmail('');
    setUserPhone('');
    setUserTechnologies('');
    setUserBirthDate('');
    setIsUserFormOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserAccount(user.account);
    setUserRole(user.role);
    setSelectedSpecs(user.specializations && user.specializations.length > 0 ? user.specializations : ['BA']);
    setUserCccd(user.cccd || '');
    setUserBankAccount(user.bankAccount || '');
    setUserEmail(user.email || '');
    setUserPhone(user.phone || '');
    setUserTechnologies(user.technologies || '');
    setUserBirthDate(user.birthDate ? String(user.birthDate) : '');
    setIsUserFormOpen(true);
  };

  const toggleSpec = (spec: Specialization) => {
    if (selectedSpecs.includes(spec)) {
      if (selectedSpecs.length === 1) return;
      setSelectedSpecs(selectedSpecs.filter((s) => s !== spec));
    } else {
      setSelectedSpecs([...selectedSpecs, spec]);
    }
  };

  const handleSubmitUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userAccount.trim()) return;

    const payload = {
      name: userName.trim(),
      account: userAccount.trim(),
      role: userRole,
      specializations: selectedSpecs,
      cccd: userCccd.trim(),
      bankAccount: userBankAccount.trim(),
      email: userEmail.trim(),
      phone: userPhone.trim(),
      technologies: userTechnologies.trim(),
      birthDate: userBirthDate.trim(),
    };

    if (editingUserId) {
      updateUser(editingUserId, payload);
    } else {
      addUser(payload);
    }

    setIsUserFormOpen(false);
  };

  const handleDeleteUser = (user: User) => {
    confirmDialog({
      title: 'Xác nhận xóa thành viên',
      message: `Bạn có chắc chắn muốn xóa thành viên ${user.name} (${user.account})? Tất cả task của thành viên này sẽ chuyển thành Task Trống để Leader giao cho người khác.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => deleteUser(user.id),
    });
  };

  const handleResetPassword = (user: User) => {
    confirmDialog({
      title: 'Xác nhận đặt lại mật khẩu',
      message: `Bạn có chắc chắn muốn đặt lại mật khẩu cho tài khoản ${user.name} (${user.account})? Người dùng sẽ được yêu cầu tạo mật khẩu mới trong lần đăng nhập tiếp theo.`,
      confirmText: 'Đặt lại mật khẩu',
      type: 'warning',
      onConfirm: () => updateUser(user.id, { password: '', firstLoginCompleted: false }),
    });
  };

  // ROLE ACTIONS
  const handleOpenAddRole = () => {
    setEditingRoleId(null);
    setRoleCode('');
    setRoleName('');
    setRoleDesc('');
    setRoleColor('indigo');
    setRoleError('');
    setIsRoleFormOpen(true);
  };

  const handleOpenEditRole = (roleItem: RoleItem) => {
    setEditingRoleId(roleItem.id);
    setRoleCode(roleItem.code);
    setRoleName(roleItem.name);
    setRoleDesc(roleItem.description || '');
    setRoleColor(roleItem.color || 'purple');
    setRoleError('');
    setIsRoleFormOpen(true);
  };

  const handleSubmitRole = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleError('');

    const cleanCode = roleCode.trim().toUpperCase();
    const cleanName = roleName.trim();

    if (!cleanCode) {
      setRoleError('Vui lòng nhập mã Role (VD: BA, Design, DevOps).');
      return;
    }
    if (!cleanName) {
      setRoleError('Vui lòng nhập tên đầy đủ của Role.');
      return;
    }

    // Check duplicate code
    const existing = roles.find(
      (r) => r.code.toUpperCase() === cleanCode && r.id !== editingRoleId
    );
    if (existing) {
      setRoleError(`Mã Role "${cleanCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      return;
    }

    if (editingRoleId) {
      updateRole(editingRoleId, {
        code: cleanCode,
        name: cleanName,
        description: roleDesc.trim(),
        color: roleColor,
      });
    } else {
      addRole({
        code: cleanCode,
        name: cleanName,
        description: roleDesc.trim(),
        color: roleColor,
      });
    }

    setIsRoleFormOpen(false);
  };

  const handleDeleteRole = (roleItem: RoleItem) => {
    if (roles.length <= 1) {
      confirmDialog({
        title: 'Không thể xóa Role',
        message: 'Hệ thống cần duy trì ít nhất 1 Role để phân công công việc. Không thể xóa toàn bộ role.',
        confirmText: 'Đã hiểu',
        type: 'warning',
        cancelText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }

    const usersWithRole = users.filter((u) => u.specializations?.includes(roleItem.code));
    const tasksWithRole = tasks.filter((t) => t.role === roleItem.code);

    let warningText = `Bạn có chắc chắn muốn xóa Role "${roleItem.code} - ${roleItem.name}"?`;
    if (usersWithRole.length > 0 || tasksWithRole.length > 0) {
      warningText += `\n\nẢnh hưởng khi xóa:`;
      if (usersWithRole.length > 0) {
        warningText += `\n• ${usersWithRole.length} thành viên đang kiêm nhiệm role này sẽ được gỡ bỏ role và cập nhật chuyên môn.`;
      }
      if (tasksWithRole.length > 0) {
        warningText += `\n• ${tasksWithRole.length} task thuộc role này.`;
      }
    }
    warningText += `\n\nHành động này không thể hoàn tác.`;

    confirmDialog({
      title: 'Xác nhận xóa Role',
      message: warningText,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => deleteRole(roleItem.id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner with Sub-Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                Quản Trị Hệ Thống & Phân Quyền
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300">
                Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Admin tạo/sửa/xóa thành viên, phân quyền và quản lý danh mục các Role/Chuyên môn trong toàn hệ thống.
            </p>
          </div>

          {currentUser?.role === 'Admin' && (
            <div className="shrink-0">
              {activeSubTab === 'USERS' ? (
                <button
                  onClick={handleOpenAddUser}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-600/20 transition shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Tạo Tài Khoản Mới
                </button>
              ) : (
                <button
                  onClick={handleOpenAddRole}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Role Mới
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sub-Tabs Switcher */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 max-w-fit gap-1">
          <button
            onClick={() => {
              setActiveSubTab('USERS');
              setIsRoleFormOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
              activeSubTab === 'USERS'
                ? 'bg-white text-purple-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            Tài Khoản Thành Viên ({users.length})
          </button>
          <button
            onClick={() => {
              setActiveSubTab('ROLES');
              setIsUserFormOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
              activeSubTab === 'ROLES'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            Danh Mục Role & Chuyên Môn ({roles.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: USERS MANAGEMENT                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Add / Edit User Form */}
          {isUserFormOpen && (
            <form
              onSubmit={handleSubmitUser}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-500" />
                {editingUserId ? 'Chỉnh Sửa Tài Khoản & Đa Chuyên Môn' : 'Tạo Tài Khoản & Phân Quyền Mới'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Tên Hiển Thị (Full Name): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn Quỳnh"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Staff Code (Username Đăng Nhập): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: QuynhNV, ThanhNDT..."
                    value={userAccount}
                    onChange={(e) => setUserAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 font-mono font-bold text-indigo-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Cấp Phân Quyền (Level):
                  </label>
                  <Dropdown
                    value={userRole}
                    onChange={(newRole) => setUserRole(newRole as UserRole)}
                    options={[
                      { value: 'Member', label: 'Member (Thành viên báo cáo)' },
                      { value: 'Leader', label: 'Leader (Break task & Phân công)' },
                      { value: 'Advisor', label: 'Advisor (Cố vấn dự án)' },
                      { value: 'Admin', label: 'Admin (Quản trị hệ thống)' },
                    ]}
                    className="w-full"
                    buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Số Căn Cước (CCCD):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 001099036785"
                    value={userCccd}
                    onChange={(e) => setUserCccd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Tài Khoản Ngân Hàng (Tk Bank):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 04891636001 - TPB - NGUYEN VAN QUYNH"
                    value={userBankAccount}
                    onChange={(e) => setUserBankAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Địa Chỉ Email (Gmail):
                  </label>
                  <input
                    type="email"
                    placeholder="VD: nguyenvanquynh396lp@gmail.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Số Điện Thoại (Phone):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0388607463"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Công Nghệ / Kỹ Năng (Technology):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: PO, Angular, JavaSpring"
                    value={userTechnologies}
                    onChange={(e) => setUserTechnologies(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Năm Sinh (BirthDate):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 1999"
                    value={userBirthDate}
                    onChange={(e) => setUserBirthDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 font-mono"
                  />
                </div>

                {/* DYNAMIC ROLE / SPECIALIZATION CHECKBOXES */}
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Vị Trí Chuyên Môn Kiêm Nhiệm (Role):
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {roles.map((r) => {
                      const isChecked = selectedSpecs.includes(r.code);
                      const style = getRoleStyle(r.color);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleSpec(r.code)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                            isChecked
                              ? `${style.bg} ${style.text} ${style.border} shadow-2xs`
                              : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{r.code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl hover:bg-slate-200 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-500 shadow-md shadow-purple-600/20 transition"
                >
                  {editingUserId ? 'Lưu Thay Đổi' : 'Tạo Account'}
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Danh Sách Nhân Viên ({users.length} nhân sự)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-3">STAFF CODE (USERNAME)</th>
                    <th className="py-3 px-4">FULL NAME</th>
                    <th className="py-3 px-3">GMAIL / PHONE</th>
                    <th className="py-3 px-3 text-center">ROLE</th>
                    <th className="py-3 px-3 text-center">LEVEL</th>
                    <th className="py-3 px-3">TECHNOLOGY</th>
                    <th className="py-3 px-3 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {users.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700 bg-indigo-50/40 rounded">
                        <button
                          onClick={() => setSelectedUserForDetail(u)}
                          className="hover:underline text-indigo-700 font-bold focus:outline-none"
                          title="Xem chi tiết & quản lý thành viên"
                        >
                          {u.account}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <button
                          onClick={() => setSelectedUserForDetail(u)}
                          className="text-left font-bold text-slate-800 hover:text-indigo-600 hover:underline transition focus:outline-none"
                          title="Xem chi tiết & quản lý thành viên"
                        >
                          {u.name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        <div className="text-slate-700 font-semibold">{u.email || '—'}</div>
                        <div className="text-slate-400 font-mono text-[10px]">{u.phone || '—'}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {(u.specializations || ['BA']).map((s) => {
                            const rObj = roles.find((r) => r.code === s);
                            const style = getRoleStyle(rObj?.color);
                            return (
                              <span
                                key={s}
                                className={`px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border} font-bold text-[10px]`}
                              >
                                {s}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            u.role === 'Admin'
                              ? 'bg-purple-100 text-purple-700 border-purple-300'
                              : u.role === 'Leader'
                              ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : u.role === 'Advisor'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-blue-100 text-blue-700 border-blue-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-600 font-semibold">{u.technologies || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        {currentUser?.role === 'Admin' && (
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition"
                              title="Xóa tài khoản thành viên"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ROLES & SPECIALIZATION MANAGEMENT                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'ROLES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Add / Edit Role Form */}
          {isRoleFormOpen && (
            <form
              onSubmit={handleSubmitRole}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                {editingRoleId ? `Chỉnh Sửa Role: ${roleCode}` : 'Thêm Role / Chuyên Môn Mới'}
              </h3>

              {roleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{roleError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Mã Role (Code):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: BA, Design, Mobile..."
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 uppercase font-bold focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Mã viết hoa đại diện cho vai trò (ngắn gọn)
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Tên Hiển Thị Role:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Business Analyst (Phân tích nghiệp vụ)"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Mô Tả Nhiệm Vụ & Phạm Vi:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Phân tích yêu cầu, quy trình nghiệp vụ & viết đặc tả..."
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Màu Sắc Đại Diện:
                  </label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setRoleColor(c.id)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${c.preview} ${
                          roleColor === c.id
                            ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-sm'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                        title={c.name}
                      >
                        {roleColor === c.id && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRoleFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl hover:bg-slate-200 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition"
                >
                  {editingRoleId ? 'Lưu Thay Đổi' : 'Tạo Role'}
                </button>
              </div>
            </form>
          )}

          {/* Roles Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Danh Mục Role & Chuyên Môn Dự Án ({roles.length} role)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các role dùng để phân nhóm công việc, giao task và theo dõi cột mốc milestone.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Mã Role</th>
                    <th className="py-3 px-4">Tên Hiển Thị & Mô Tả</th>
                    <th className="py-3 px-3">Thành Viên Đảm Nhận</th>
                    <th className="py-3 px-3 text-center">Tổng Task</th>
                    <th className="py-3 px-4 text-right">Thao Tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {roles.map((r) => {
                    const style = getRoleStyle(r.color);
                    const members = users.filter((u) => u.specializations?.includes(r.code));
                    const roleTasks = tasks.filter((t) => t.role === r.code);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold font-mono text-xs border ${style.bg} ${style.text} ${style.border} shadow-2xs`}
                          >
                            <span className={`w-2 h-2 rounded-full ${style.preview}`} />
                            {r.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{r.name}</div>
                          {r.description && (
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              {r.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {members.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {members.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                                >
                                  {m.name}
                                </span>
                              ))}
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({members.length})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa có ai</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono text-xs">
                            {roleTasks.length}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {currentUser?.role === 'Admin' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditRole(r)}
                                className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg transition"
                                title="Chỉnh sửa thông tin Role"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(r)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition"
                                title="Xóa Role này khỏi hệ thống"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Detail & Edit Modal */}
      <UserDetailModal
        user={selectedUserForDetail}
        isOpen={!!selectedUserForDetail}
        onClose={() => setSelectedUserForDetail(null)}
      />
    </div>
  );
};
