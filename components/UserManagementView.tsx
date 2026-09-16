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
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Eye,
  Copy,
  Check,
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
    resetUserPassword,
    resetAllUninitializedPasswords,
    roles,
    addRole,
    updateRole,
    deleteRole,
    tasks,
    currentUser,
    confirmDialog,
  } = useApp();

  // SUB-TAB & SEARCH STATE
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES'>('USERS');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // SORT STATE FOR USER TABLE
  const [sortField, setSortField] = useState<'account' | 'name' | 'role' | 'level' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'account' | 'name' | 'role' | 'level') => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // SELECTED USER FOR DETAIL MODAL
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);

  // TEMPORARY CREDENTIAL MODAL (SINGLE USER)
  const [tempCredModal, setTempCredModal] = useState<{
    title: string;
    subtitle: string;
    name: string;
    account: string;
    tempPassword: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'all' | 'password' | null>(null);

  // BATCH CREDENTIALS MODAL (MULTIPLE USERS)
  const [batchCredModal, setBatchCredModal] = useState<{
    newlyGeneratedCount: number;
    results: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[];
  } | null>(null);
  const [batchCopied, setBatchCopied] = useState(false);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [individualCopiedId, setIndividualCopiedId] = useState<string | null>(null);

  // PENDING USERS (ALL WHO HAVE NOT COMPLETED FIRST LOGIN YET)
  const pendingFirstLoginUsers = users.filter((u) => {
    const isDisabled = u.disabled || u.status === 'disabled';
    if (isDisabled) return false;
    const hasOfficialPass = u.password && u.password.trim() !== '' && u.firstLoginCompleted === true;
    return !hasOfficialPass;
  });

  // USERS WHO DO NOT HAVE A TEMPORARY PASSWORD YET
  const needNewTempUsers = pendingFirstLoginUsers.filter(
    (u) => !u.tempPassword || u.tempPassword.trim() === ''
  );

  const handleCopyAllInfo = (account: string, name: string, tempPassword: string) => {
    const text = `THÔNG TIN TÀI KHOẢN SAHO TASK\n• Họ và tên: ${name}\n• Staff Code (Tài khoản): ${account}\n• Mật khẩu tạm thời: ${tempPassword}\n\n👉 Vui lòng đăng nhập hệ thống bằng Staff Code và Mật khẩu tạm thời trên để đổi mật khẩu chính thức lần đầu.`;
    navigator.clipboard.writeText(text);
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyPasswordOnly = (tempPassword: string) => {
    navigator.clipboard.writeText(tempPassword);
    setCopiedField('password');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyBatchList = (
    list: { id: string; name: string; account: string; tempPassword: string }[]
  ) => {
    let text = `📋 DANH SÁCH MẬT KHẨU TẠM ĐĂNG NHẬP SAHO TASK (${list.length} THÀNH VIÊN)\n`;
    text += `=========================================\n`;
    list.forEach((item, index) => {
      text += `${index + 1}. Staff Code: ${item.account} | ${item.name} -> Mật khẩu tạm: ${item.tempPassword}\n`;
    });
    text += `=========================================\n`;
    text += `💡 HƯỚNG DẪN ĐĂNG NHẬP:\n`;
    text += `1. Truy cập vào hệ thống Saho Task.\n`;
    text += `2. Nhập Staff Code (Username) và Mật khẩu tạm thời tương ứng ở trên.\n`;
    text += `3. Sau khi đăng nhập thành công, hệ thống sẽ yêu cầu bạn đổi sang Mật khẩu mới chính thức để kích hoạt tài khoản.\n`;

    navigator.clipboard.writeText(text);
    setBatchCopied(true);
    setTimeout(() => setBatchCopied(false), 2500);
  };

  const handleCopyIndividualFromBatch = (
    account: string,
    name: string,
    tempPassword: string,
    id: string
  ) => {
    const text = `THÔNG TIN TÀI KHOẢN SAHO TASK\n• Họ và tên: ${name}\n• Staff Code (Tài khoản): ${account}\n• Mật khẩu tạm thời: ${tempPassword}\n\n👉 Vui lòng đăng nhập hệ thống bằng Staff Code và Mật khẩu tạm thời trên để đổi mật khẩu chính thức lần đầu.`;
    navigator.clipboard.writeText(text);
    setIndividualCopiedId(id);
    setTimeout(() => setIndividualCopiedId(null), 2500);
  };

  const handleBatchReset = () => {
    if (pendingFirstLoginUsers.length === 0) {
      confirmDialog({
        title: 'Tất cả nhân sự đã kích hoạt',
        message: 'Hiện không có nhân viên mới nào chưa đổi mật khẩu hoặc thiếu mật khẩu.',
        confirmText: 'Đã hiểu',
        type: 'warning',
        cancelText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }

    const confirmMsg =
      needNewTempUsers.length > 0
        ? `Hệ thống sẽ cấp mật khẩu tạm thời cho ${needNewTempUsers.length} nhân sự chưa có mật khẩu tạm (giữ nguyên mật khẩu của ${pendingFirstLoginUsers.length - needNewTempUsers.length} người đã có) và hiển thị danh sách tổng hợp để bạn sao chép gửi nhóm.`
        : `Tất cả ${pendingFirstLoginUsers.length} nhân sự mới đều đã có mật khẩu tạm thời. Bấm xác nhận để mở bảng danh sách và sao chép gửi vào nhóm.`;

    confirmDialog({
      title: needNewTempUsers.length > 0 ? 'Cấp mật khẩu tạm cho nhân sự mới' : 'Danh sách mật khẩu tạm',
      message: confirmMsg,
      confirmText: needNewTempUsers.length > 0 ? `Cấp MK cho ${needNewTempUsers.length} người mới` : 'Xem & Sao Chép DS',
      type: 'warning',
      onConfirm: async () => {
        const res = await resetAllUninitializedPasswords();
        if (res.results.length > 0) {
          setBatchCredModal({
            newlyGeneratedCount: res.newlyGeneratedCount,
            results: res.results,
          });
          setBatchSearchQuery('');
        }
      },
    });
  };

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

  const handleSubmitUser = async (e: React.FormEvent) => {
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
      const res = await addUser(payload);
      if (res?.tempPassword) {
        setTempCredModal({
          title: 'Tạo Tài Khoản Thành Công',
          subtitle: 'Hệ thống đã tự động tạo mật khẩu tạm thời cho nhân viên mới. Hãy sao chép thông tin để gửi cho nhân viên đăng nhập lần đầu.',
          name: res.user.name,
          account: res.user.account,
          tempPassword: res.tempPassword,
        });
      }
    }

    setIsUserFormOpen(false);
  };

  const [showDisabledUsers, setShowDisabledUsers] = useState(false);

  const handleDeleteUser = (user: User) => {
    confirmDialog({
      title: 'Xác nhận vô hiệu hóa tài khoản',
      message: `Bạn có chắc chắn muốn vô hiệu hóa tài khoản ${user.name} (${user.account})? Tài khoản sẽ bị ẩn khỏi giao diện và ngưng hoạt động nhưng dữ liệu vẫn được bảo lưu an toàn trong Database. Tất cả task của thành viên này sẽ chuyển thành Task Trống để Leader giao cho người khác.`,
      confirmText: 'Xác nhận vô hiệu hóa',
      type: 'danger',
      onConfirm: () => deleteUser(user.id),
    });
  };

  const handleRestoreUser = (user: User) => {
    confirmDialog({
      title: 'Kích hoạt lại tài khoản',
      message: `Bạn có chắc chắn muốn khôi phục và kích hoạt lại tài khoản ${user.name} (${user.account})?`,
      confirmText: 'Kích hoạt lại',
      type: 'warning',
      onConfirm: () => updateUser(user.id, { disabled: false, status: 'active' }),
    });
  };

  const handleResetPassword = (user: User) => {
    confirmDialog({
      title: 'Xác nhận đặt lại mật khẩu',
      message: `Bạn có chắc chắn muốn đặt lại mật khẩu cho tài khoản ${user.name} (${user.account})? Hệ thống sẽ ngay lập tức đăng xuất tài khoản này khỏi tất cả các thiết bị đã đăng nhập và tạo mật khẩu tạm thời mới để bạn gửi cho nhân viên.`,
      confirmText: 'Đặt lại & Đăng xuất thiết bị',
      type: 'warning',
      onConfirm: async () => {
        const res = await resetUserPassword(user.id);
        if (res.success && res.tempPassword) {
          setTempCredModal({
            title: 'Đặt Lại Mật Khẩu Thành Công',
            subtitle: `Đã thu hồi phiên đăng nhập trên mọi thiết bị và tạo mật khẩu tạm thời mới cho ${user.account}. Hãy sao chép thông tin bên dưới và gửi cho nhân viên để đăng nhập lại.`,
            name: user.name,
            account: user.account,
            tempPassword: res.tempPassword,
          });
        }
      },
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
            <div className="shrink-0 flex items-center gap-2 flex-wrap">
              {activeSubTab === 'USERS' ? (
                <>
                  <button
                    onClick={handleBatchReset}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl shadow-xs transition shrink-0 active:scale-95 cursor-pointer"
                    title={
                      needNewTempUsers.length > 0
                        ? `Cấp mật khẩu tạm cho ${needNewTempUsers.length} người mới chưa có (giữ nguyên người đã có)`
                        : `Xem danh sách mật khẩu tạm của ${pendingFirstLoginUsers.length} người đang chờ kích hoạt`
                    }
                  >
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>
                      {needNewTempUsers.length > 0
                        ? `Cấp MK Tạm Cho Người Mới (${needNewTempUsers.length})`
                        : `DS Mật Khẩu Tạm (${pendingFirstLoginUsers.length})`}
                    </span>
                  </button>

                  <button
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-600/20 transition shrink-0 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Tài Khoản Mới
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOpenAddRole}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition shrink-0 active:scale-95 cursor-pointer"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Danh Sách Nhân Viên ({users.filter((u) => !u.disabled && u.status !== 'disabled').length} nhân sự hoạt động)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {users.some((u) => u.disabled || u.status === 'disabled') && (
                  <button
                    onClick={() => setShowDisabledUsers(!showDisabledUsers)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 font-semibold cursor-pointer ${
                      showDisabledUsers
                        ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={showDisabledUsers ? 'Ẩn các tài khoản đã bị khóa' : 'Xem danh sách tài khoản đã khóa trong DB'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showDisabledUsers
                      ? 'Đang hiện tài khoản đã khóa'
                      : `Tài khoản đã khóa (${users.filter((u) => u.disabled || u.status === 'disabled').length})`}
                  </button>
                )}

                {/* Search Bar Input */}
                <div className="relative min-w-[200px] sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tên, staff code, email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 transition"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <th className="py-3 px-3 w-10 text-center">STT</th>

                    {/* STAFF CODE Header */}
                    <th
                      onClick={() => handleSort('account')}
                      className="py-3 px-3 cursor-pointer select-none hover:text-purple-600 transition group"
                      title="Bấm để sắp xếp theo Staff Code (A-Z / Z-A)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>STAFF CODE (USERNAME)</span>
                        {sortField === 'account' ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* FULL NAME Header */}
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-purple-600 transition group"
                      title="Bấm để sắp xếp theo Họ và Tên (A-Z / Z-A)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>FULL NAME</span>
                        {sortField === 'name' ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-3">GMAIL / PHONE</th>

                    {/* ROLE Header */}
                    <th
                      onClick={() => handleSort('role')}
                      className="py-3 px-3 text-center cursor-pointer select-none hover:text-purple-600 transition group"
                      title="Bấm để sắp xếp theo Role/Chuyên môn (A-Z / Z-A)"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>ROLE</span>
                        {sortField === 'role' ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* LEVEL Header */}
                    <th
                      onClick={() => handleSort('level')}
                      className="py-3 px-3 text-center cursor-pointer select-none hover:text-purple-600 transition group"
                      title="Bấm để sắp xếp theo Cấp Phân Quyền Level"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>LEVEL</span>
                        {sortField === 'level' ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-3">TECHNOLOGY</th>
                    <th className="py-3 px-3 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {users
                    .filter((u) => {
                      if (!showDisabledUsers && (u.disabled || u.status === 'disabled')) return false;

                      if (!userSearchQuery.trim()) return true;
                      const q = userSearchQuery.toLowerCase().trim();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.account.toLowerCase().includes(q) ||
                        (u.email && u.email.toLowerCase().includes(q)) ||
                        (u.phone && u.phone.toLowerCase().includes(q)) ||
                        (u.technologies && u.technologies.toLowerCase().includes(q)) ||
                        (u.specializations && u.specializations.some((s) => s.toLowerCase().includes(q)))
                      );
                    })
                    .sort((a, b) => {
                      if (!sortField) return 0;
                      let valA = '';
                      let valB = '';

                      if (sortField === 'account') {
                        valA = a.account || '';
                        valB = b.account || '';
                      } else if (sortField === 'name') {
                        valA = a.name || '';
                        valB = b.name || '';
                      } else if (sortField === 'role') {
                        valA = (a.specializations || []).join(', ');
                        valB = (b.specializations || []).join(', ');
                      } else if (sortField === 'level') {
                        const levelOrder: Record<string, number> = { Admin: 1, Leader: 2, Advisor: 3, Member: 4 };
                        const rankA = levelOrder[a.role] || 99;
                        const rankB = levelOrder[b.role] || 99;
                        if (rankA !== rankB) {
                          return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
                        }
                        valA = a.role || '';
                        valB = b.role || '';
                      }

                      const cmp = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
                      return sortOrder === 'asc' ? cmp : -cmp;
                    })
                    .map((u, idx) => {
                      const isDisabled = u.disabled || u.status === 'disabled';
                      return (
                        <tr key={u.id} className={`transition ${isDisabled ? 'bg-slate-100/60 opacity-70' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-indigo-700 bg-indigo-50/40 rounded">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isDisabled
                                    ? 'bg-red-400'
                                    : u.password && u.password.trim() !== '' && u.firstLoginCompleted === true
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={
                                  isDisabled
                                    ? 'Tài khoản đã bị vô hiệu hóa (Disabled)'
                                    : u.password && u.password.trim() !== '' && u.firstLoginCompleted === true
                                    ? 'Đã vào hệ thống (Đã đổi mật khẩu cá nhân)'
                                    : 'Chưa vào hệ thống (Chưa đổi mật khẩu cá nhân / Đang dùng mật khẩu tạm)'
                                }
                              />
                              <button
                                onClick={() => setSelectedUserForDetail(u)}
                                className="hover:underline text-indigo-700 font-bold focus:outline-none"
                                title="Xem chi tiết & quản lý thành viên"
                              >
                                {u.account}
                              </button>
                              {isDisabled && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold border border-red-200">
                                  Đã khóa
                                </span>
                              )}
                            </div>
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
                              <div className="flex items-center justify-end gap-1">
                                {!isDisabled && (
                                  <button
                                    onClick={() => handleResetPassword(u)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 rounded-lg transition"
                                    title="Đặt lại mật khẩu (Tạo mật khẩu tạm mới)"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isDisabled ? (
                                  <button
                                    onClick={() => handleRestoreUser(u)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-lg transition"
                                    title="Kích hoạt / Khôi phục tài khoản"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition"
                                    title="Vô hiệu hóa tài khoản"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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

      {/* Temporary Credentials Modal (Displayed when Admin creates user or resets password) */}
      {tempCredModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTempCredModal(null);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-slate-800 relative animate-in zoom-in-95 duration-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{tempCredModal.title}</h3>
                  <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Mật Khẩu Tạm Thời Hệ Thống</span>
                </div>
              </div>
              <button
                onClick={() => setTempCredModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {tempCredModal.subtitle}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Họ & Tên:</span>
                <span className="font-bold text-slate-800">{tempCredModal.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Staff Code (Tài khoản):</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {tempCredModal.account}
                </span>
              </div>
              <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider block">Mật Khẩu Tạm Thời</span>
                  <span className="font-mono font-black text-amber-800 text-base tracking-wider">
                    {tempCredModal.tempPassword}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPasswordOnly(tempCredModal.tempPassword)}
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 flex items-center gap-1.5 transition active:scale-95"
                  title="Chỉ sao chép mật khẩu"
                >
                  {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'password' ? 'Đã chép!' : 'Chép MK'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-[11px] text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Cơ chế bảo mật đăng nhập lần đầu
              </div>
              <p className="text-indigo-800 leading-snug">
                Khi nhân viên đăng nhập bằng mật khẩu tạm này, hệ thống sẽ tự động bắt buộc đổi sang mật khẩu chính thức và mật khẩu tạm sẽ bị hủy.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyAllInfo(tempCredModal.account, tempCredModal.name, tempCredModal.tempPassword)}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-2 active:scale-95"
              >
                {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedField === 'all' ? 'Đã Sao Chép Toàn Bộ!' : 'Sao Chép Gửi Nhân Viên'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTempCredModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Temporary Credentials Modal */}
      {batchCredModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setBatchCredModal(null);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-800 relative max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    Danh Sách Mật Khẩu Tạm Thời
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold border border-amber-300">
                      {batchCredModal.results.length} thành viên
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {batchCredModal.newlyGeneratedCount > 0
                      ? `Đã tạo mật khẩu mới cho ${batchCredModal.newlyGeneratedCount} người và giữ nguyên mật khẩu của ${batchCredModal.results.length - batchCredModal.newlyGeneratedCount} người đã có.`
                      : `Danh sách ${batchCredModal.results.length} nhân sự mới đang có mật khẩu tạm chờ đăng nhập lần đầu.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchCredModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Copy Action Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-700 font-medium">
                <span className="font-bold text-slate-900 block sm:inline">1 Click sao chép:</span> Định dạng rõ ràng, sẵn sàng paste vào Slack / Zalo / Telegram.
              </div>
              <button
                type="button"
                onClick={() => handleCopyBatchList(batchCredModal.results)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer shrink-0"
              >
                {batchCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{batchCopied ? 'Đã Sao Chép Toàn Bộ Danh Sách!' : 'Sao Chép Toàn Bộ Gửi Nhóm'}</span>
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Lọc theo tên hoặc Staff Code..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                Hiển thị {batchCredModal.results.filter((u) => {
                  if (!batchSearchQuery.trim()) return true;
                  const q = batchSearchQuery.toLowerCase().trim();
                  return u.name.toLowerCase().includes(q) || u.account.toLowerCase().includes(q);
                }).length} / {batchCredModal.results.length}
              </span>
            </div>

            {/* Scrollable Table List */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-3">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                      <th className="py-2.5 px-3 w-10 text-center">STT</th>
                      <th className="py-2.5 px-3">STAFF CODE</th>
                      <th className="py-2.5 px-4">HỌ VÀ TÊN</th>
                      <th className="py-2.5 px-3">MẬT KHẨU TẠM</th>
                      <th className="py-2.5 px-3 text-right">GỬI RIÊNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {batchCredModal.results
                      .filter((u) => {
                        if (!batchSearchQuery.trim()) return true;
                        const q = batchSearchQuery.toLowerCase().trim();
                        return u.name.toLowerCase().includes(q) || u.account.toLowerCase().includes(q);
                      })
                      .map((u, idx) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              @{u.account}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            {u.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                {u.tempPassword}
                              </span>
                              {u.isNewlyGenerated && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded border border-emerald-200">
                                  Mới
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyIndividualFromBatch(u.account, u.name, u.tempPassword, u.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-lg text-[11px] font-semibold border border-slate-200 transition inline-flex items-center gap-1 active:scale-95"
                              title="Sao chép nội dung tin nhắn riêng cho thành viên này"
                            >
                              {individualCopiedId === u.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Chép info</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Instructions Reminder */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-[11px] text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Quy trình kích hoạt:
                </div>
                <p className="text-indigo-800 leading-snug">
                  Nhân viên chỉ cần đăng nhập bằng Staff Code và Mật khẩu tạm thời. Khi đăng nhập thành công, hệ thống sẽ tự động bắt buộc đổi sang mật khẩu chính thức và hủy mật khẩu tạm.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng: <strong className="text-slate-800">{batchCredModal.results.length}</strong> tài khoản
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyBatchList(batchCredModal.results)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {batchCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{batchCopied ? 'Đã Sao Chép!' : 'Sao Chép Toàn Bộ'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchCredModal(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
