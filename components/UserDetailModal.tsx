'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole, Specialization, validateRoleQuota } from '../types/task';
import {
  X,
  User as UserIcon,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  Save,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
  Award,
  CreditCard,
  Phone,
  Mail,
  Calendar,
  FileText,
  Cpu,
  Info,
  Copy,
  Check,
  Edit2,
  FileSpreadsheet,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Dropdown } from './common/Dropdown';
import { parseSheetRow } from './UserManagementView';

interface UserDetailModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, isOpen, onClose }) => {
  const {
    currentUser,
    users,
    roles,
    tasks,
    selectedWeek,
    selectedYear,
    updateUser,
    deleteUser,
    resetUserPassword,
    confirmDialog,
  } = useApp();

  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  // Form Fields (Admin updates role, specializations, and personal info)
  const [userRole, setUserRole] = useState<UserRole>('Member');
  const [selectedSpecs, setSelectedSpecs] = useState<Specialization[]>(['BA']);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userCccd, setUserCccd] = useState('');
  const [userBirthDate, setUserBirthDate] = useState('');
  const [userBankAccount, setUserBankAccount] = useState('');
  const [userTechnologies, setUserTechnologies] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Temporary password popup state
  const [tempCredModal, setTempCredModal] = useState<{
    name: string;
    account: string;
    tempPassword: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'all' | 'password' | null>(null);

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

  // Sync state when user prop changes or modal opens
  useEffect(() => {
    if (user) {
      setUserRole(user.role || 'Member');
      setSelectedSpecs(user.specializations && user.specializations.length > 0 ? user.specializations : ['BA']);
      setUserName(user.name || '');
      setUserPhone(user.phone || '');
      setUserEmail(user.email || '');
      setUserCccd(user.cccd || '');
      setUserBirthDate(user.birthDate ? String(user.birthDate) : '');
      setUserBankAccount(user.bankAccount || '');
      setUserTechnologies(user.technologies || '');
      setIsEditingProfile(false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [user, isOpen]);

  if (!isRendered || !user) return null;

  const isAdmin = currentUser?.role === 'Admin';

  // Calculate task & effort stats for this user in current week
  const userCurrentTasks = tasks.filter(
    (t) =>
      t.assigneeAccount?.toLowerCase() === user.account.toLowerCase() &&
      t.weekNumber === selectedWeek &&
      t.year === selectedYear
  );

  const activeTasksCount = userCurrentTasks.filter((t) => t.status !== 'Done').length;
  const completedTasksCount = userCurrentTasks.filter((t) => t.status === 'Done').length;
  const currentWeekEffort =
    Math.round(userCurrentTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0) * 100) / 100;
  const totalEffortCumulative =
    Math.round(((user.totalEffort || 0) + currentWeekEffort) * 100) / 100;

  const toggleSpec = (specCode: Specialization) => {
    if (!isAdmin) return;
    if (selectedSpecs.includes(specCode)) {
      if (selectedSpecs.length === 1) return; // Must keep at least 1 role
      setSelectedSpecs(selectedSpecs.filter((s) => s !== specCode));
    } else {
      setSelectedSpecs([...selectedSpecs, specCode]);
    }
  };

  const handleResetPassword = () => {
    confirmDialog({
      title: 'Xác nhận đặt lại mật khẩu',
      message: `Bạn có chắc chắn muốn đặt lại mật khẩu cho tài khoản ${user.name} (${user.account})? Hệ thống sẽ ngay lập tức đăng xuất tài khoản này khỏi tất cả các thiết bị đã đăng nhập và tạo mật khẩu tạm thời mới để bạn gửi cho nhân viên.`,
      confirmText: 'Đặt lại & Đăng xuất thiết bị',
      type: 'warning',
      onConfirm: async () => {
        const res = await resetUserPassword(user.id);
        if (res.success && res.tempPassword) {
          setTempCredModal({
            name: user.name,
            account: user.account,
            tempPassword: res.tempPassword,
          });
          setSuccessMsg(`Đã thu hồi phiên đăng nhập & tạo mật khẩu tạm thời mới cho ${user.account}!`);
        } else {
          setErrorMsg(res.error || 'Có lỗi xảy ra khi đặt lại mật khẩu.');
        }
      },
    });
  };

  const handleDeleteUser = () => {
    confirmDialog({
      title: 'Xác nhận vô hiệu hóa tài khoản',
      message: `Bạn có chắc chắn muốn vô hiệu hóa tài khoản ${user.name} (${user.account})? Tài khoản sẽ bị ẩn khỏi giao diện nhưng dữ liệu vẫn được bảo lưu an toàn trong Database. Tất cả task của người này sẽ chuyển thành Task Trống.`,
      confirmText: 'Xác nhận vô hiệu hóa',
      type: 'danger',
      onConfirm: () => {
        deleteUser(user.id);
        handleClose();
      },
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMsg('Vui lòng nhập Họ & Tên nhân viên.');
      return;
    }

    // Validate Role Level Quota per specialization when changing role or specs
    const quotaCheck = validateRoleQuota(userRole, selectedSpecs, users, user.id);
    if (!quotaCheck.valid && quotaCheck.error) {
      setErrorMsg(quotaCheck.error);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    setTimeout(() => {
      updateUser(user.id, {
        name: userName.trim(),
        role: userRole,
        specializations: selectedSpecs,
        phone: userPhone.trim(),
        email: userEmail.trim(),
        cccd: userCccd.trim(),
        birthDate: userBirthDate.trim(),
        bankAccount: userBankAccount.trim(),
        technologies: userTechnologies.trim(),
      });

      setIsSaving(false);
      setIsSaved(true);
      setIsEditingProfile(false);
      setSuccessMsg('Cập nhật thông tin & phân quyền nhân viên thành công!');
      setTimeout(() => {
        setIsSaved(false);
        setSuccessMsg('');
      }, 3500);
    }, 300);
  };

  const getRoleTheme = (role: string) => {
    switch (role) {
      case 'Admin':
        return {
          badge: 'bg-purple-100 text-purple-700 border-purple-300',
          gradient: 'from-purple-600 to-indigo-600',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />,
        };
      case 'Leader':
        return {
          badge: 'bg-amber-100 text-amber-700 border-amber-300',
          gradient: 'from-amber-500 to-orange-600',
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'Advisor':
        return {
          badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
          gradient: 'from-emerald-600 to-teal-600',
          icon: <Award className="w-3.5 h-3.5 text-emerald-600" />,
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-700 border-blue-300',
          gradient: 'from-indigo-600 to-blue-500',
          icon: <Briefcase className="w-3.5 h-3.5 text-blue-600" />,
        };
    }
  };

  const roleTheme = getRoleTheme(userRole);

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-800 relative max-h-[92vh] flex flex-col modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <UserIcon className="w-4 h-4 text-purple-600" />
            {isAdmin ? 'Chi Tiết & Quản Lý Thông Tin Nhân Viên' : 'Thông Tin Chi Tiết Thành Viên'}
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto custom-scrollbar min-h-0 overscroll-contain">
          {/* User Profile Banner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 rounded-2xl p-4 shadow-md gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${roleTheme.gradient} flex items-center justify-center text-white font-extrabold text-xl shadow-md`}
                >
                  {user.account ? user.account.slice(0, 2).toUpperCase() : 'NV'}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow-xs ${
                    user.password && user.password.trim() !== '' && user.firstLoginCompleted === true
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  }`}
                  title={
                    user.password && user.password.trim() !== '' && user.firstLoginCompleted === true
                      ? 'Trạng thái: Đã vào hệ thống (Đã đổi mật khẩu cá nhân)'
                      : 'Trạng thái: Chưa vào hệ thống (Chưa đổi mật khẩu cá nhân / Đang dùng mật khẩu tạm)'
                  }
                />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {userName || user.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md border border-white/15 font-bold">
                    @{user.account}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${roleTheme.badge}`}
                  >
                    {roleTheme.icon}
                    {userRole}
                  </span>
                  {selectedSpecs.map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 bg-purple-500/25 text-purple-200 border border-purple-400/40 rounded-md text-[10px] font-bold font-mono"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Action: Reset Password Button */}
            {isAdmin && (
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                  title="Đặt lại mật khẩu cho nhân viên này"
                >
                  <KeyRound className="w-4 h-4 text-amber-300" />
                  Đặt Lại Mật Khẩu
                </button>
              </div>
            )}
          </div>

          {/* Temporary Password Notice Banner for Admin */}
          {user.firstLoginCompleted === false && user.tempPassword && (
            <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-900">
                    Tài khoản chưa hoàn tất đổi mật khẩu lần đầu
                  </div>
                  <div className="text-amber-700 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Mật khẩu tạm thời đang cấp:</span>
                    <span className="font-mono font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                      {user.tempPassword}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyAllInfo(user.account, userName || user.name, user.tempPassword!)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 shadow-xs"
              >
                {copiedField === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'all' ? 'Đã Sao Chép!' : 'Sao Chép Thông Tin'}</span>
              </button>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-3 text-center space-y-0.5">
              <div className="text-[10px] text-purple-600 font-extrabold uppercase tracking-wider">
                Tổng Effort Lũy Kế
              </div>
              <div className="text-base sm:text-lg font-black text-purple-700 font-mono">
                {totalEffortCumulative}h
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-center space-y-0.5">
              <div className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wider">
                Effort Tuần {selectedWeek}
              </div>
              <div className="text-base sm:text-lg font-black text-amber-700 font-mono">
                {currentWeekEffort}h
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Task Đang Làm
              </div>
              <div className="text-base sm:text-lg font-black text-indigo-600 font-mono">
                {activeTasksCount}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Đã Hoàn Thành
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                {completedTasksCount}
              </div>
            </div>
          </div>

          {/* Admin Edit Controls: Level & Specializations + Personal Profile Info */}
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="border border-purple-200/80 rounded-2xl p-4 bg-purple-50/30 space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-100 pb-2">
                <Shield className="w-4 h-4 text-purple-600" />
                {isAdmin ? 'Quản Lý Phân Quyền & Vai Trò Chuyên Môn (Admin Only)' : 'Phân Quyền & Vị Trí Chuyên Môn'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Level / Quyền */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Cấp Phân Quyền (Level System):
                  </label>
                  {isAdmin ? (
                    <Dropdown
                      value={userRole}
                      onChange={(newRole) => setUserRole(newRole as UserRole)}
                      options={[
                        { value: 'Leader', label: '👑 Leader (Trưởng nhóm)' },
                        { value: 'Advisor', label: '🎖️ Advisor (Cố vấn)' },
                        { value: 'Member', label: '👥 Member (Thành viên)' },
                        { value: 'Admin', label: '🛡️ Admin (Quản trị)' },
                      ]}
                      className="w-full"
                      buttonClassName="py-2 px-3 text-xs bg-white border-purple-300 font-bold text-slate-800 shadow-2xs"
                    />
                  ) : (
                    <div className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                      {userRole}
                    </div>
                  )}
                </div>

                {/* Staff Code (Read-Only) */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Staff Code (Username):
                  </label>
                  <div className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700 shadow-2xs">
                    @{user.account}
                  </div>
                </div>

                {/* Specializations (Role Position) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Vị Trí Chuyên Môn Kiêm Nhiệm (Role):
                  </label>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {roles.map((r) => {
                      const isChecked = selectedSpecs.includes(r.code);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleSpec(r.code)}
                          disabled={!isAdmin}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-bold'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-purple-50'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'active:scale-95'}`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {r.name && r.name.trim().toLowerCase() !== r.code.trim().toLowerCase() ? `${r.code} (${r.name})` : r.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details Section (View Mode with Edit Trigger or Active Edit Mode) */}
            <div className={`border rounded-2xl p-4 bg-white space-y-3.5 shadow-2xs transition-all duration-200 ${
              isEditingProfile ? 'border-purple-300 ring-2 ring-purple-100/80 bg-purple-50/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Hồ Sơ Lý Lịch Nhân Sự
                  </h4>
                  {isEditingProfile && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md font-bold animate-pulse">
                      <Edit2 className="w-3 h-3 text-purple-600" />
                      Đang mở chỉnh sửa
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div>
                    {!isEditingProfile ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200/90 transition active:scale-95 shadow-2xs cursor-pointer"
                        title="Bấm vào để mở các ô nhập liệu chỉnh sửa hồ sơ"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Chỉnh Sửa Hồ Sơ</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setUserName(user.name || '');
                          setUserPhone(user.phone || '');
                          setUserEmail(user.email || '');
                          setUserCccd(user.cccd || '');
                          setUserBirthDate(user.birthDate ? String(user.birthDate) : '');
                          setUserBankAccount(user.bankAccount || '');
                          setUserTechnologies(user.technologies || '');
                          setIsEditingProfile(false);
                          setErrorMsg('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold rounded-lg border border-slate-200 transition active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Hủy Chỉnh Sửa</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isEditingProfile ? (
                /* VIEW MODE: Read-only display cards to prevent accidental changes */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Họ & Tên</span>
                    <span className="font-bold text-slate-800 text-xs">{userName || user.name || '—'}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> Số Điện Thoại
                    </span>
                    <span className="font-mono font-bold text-slate-800">{userPhone || user.phone || '—'}</span>
                  </div>

                  <div className="sm:col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> Gmail / Email
                    </span>
                    <span className="font-semibold text-slate-800 truncate block">{userEmail || user.email || '—'}</span>
                  </div>

                  {(isAdmin || currentUser?.account?.toLowerCase() === user.account.toLowerCase()) && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" /> Số Căn Cước (CCCD)
                      </span>
                      <span className="font-mono font-bold text-slate-800">{userCccd || user.cccd || '—'}</span>
                    </div>
                  )}

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Năm Sinh
                    </span>
                    <span className="font-mono font-bold text-slate-800">{userBirthDate || user.birthDate || '—'}</span>
                  </div>

                  {(isAdmin || currentUser?.account?.toLowerCase() === user.account.toLowerCase()) && (
                    <div className="sm:col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" /> Tài Khoản Ngân Hàng (Tk Bank)
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block">
                        {userBankAccount || user.bankAccount || '—'}
                      </span>
                    </div>
                  )}

                  <div className="sm:col-span-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 space-y-0.5">
                    <span className="text-[10px] text-indigo-500 uppercase font-bold tracking-wider block flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-indigo-500" /> Kỹ Năng / Công Nghệ (Technology)
                    </span>
                    <span className="font-semibold text-indigo-700 text-xs block">
                      {userTechnologies || user.technologies || '—'}
                    </span>
                  </div>
                </div>
              ) : (
                /* EDIT MODE: Active, bright input fields for editing */
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* Quick Sheet Paste Bar in Edit Mode */}
                  <div className="bg-purple-50/80 border border-purple-200/90 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-purple-900 font-bold shrink-0">
                      <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                      <span>Dán từ Sheet:</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Dán (Ctrl + V) dòng thông tin copy từ Google Sheet để tự động điền..."
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text');
                        if (text) {
                          e.preventDefault();
                          const parsed = parseSheetRow(text, roles);
                          if (parsed) {
                            if (parsed.name) setUserName(parsed.name);
                            if (parsed.phone) setUserPhone(parsed.phone);
                            if (parsed.email) setUserEmail(parsed.email);
                            if (parsed.cccd) setUserCccd(parsed.cccd);
                            if (parsed.birthDate) setUserBirthDate(parsed.birthDate);
                            if (parsed.bankAccount) setUserBankAccount(parsed.bankAccount);
                            if (parsed.technologies) setUserTechnologies(parsed.technologies);
                            if (parsed.specializations.length > 0) setSelectedSpecs(parsed.specializations);
                            if (parsed.role) setUserRole(parsed.role);
                            setSuccessMsg(`Đã trích xuất thông tin từ Sheet cho ${parsed.name || user.name}!`);
                            setTimeout(() => setSuccessMsg(''), 3000);
                          } else {
                            setErrorMsg('Không thể nhận diện định dạng dòng từ Sheet.');
                            setTimeout(() => setErrorMsg(''), 3000);
                          }
                        }
                      }}
                      className="flex-1 bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-200"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            const parsed = parseSheetRow(text, roles);
                            if (parsed) {
                              if (parsed.name) setUserName(parsed.name);
                              if (parsed.phone) setUserPhone(parsed.phone);
                              if (parsed.email) setUserEmail(parsed.email);
                              if (parsed.cccd) setUserCccd(parsed.cccd);
                              if (parsed.birthDate) setUserBirthDate(parsed.birthDate);
                              if (parsed.bankAccount) setUserBankAccount(parsed.bankAccount);
                              if (parsed.technologies) setUserTechnologies(parsed.technologies);
                              if (parsed.specializations.length > 0) setSelectedSpecs(parsed.specializations);
                              if (parsed.role) setUserRole(parsed.role);
                              setSuccessMsg(`Đã trích xuất thông tin từ Sheet cho ${parsed.name || user.name}!`);
                              setTimeout(() => setSuccessMsg(''), 3000);
                            }
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shrink-0 active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Dán Clipboard</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Họ & Tên */}
                    <div>
                      <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-purple-600" /> Họ & Tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                      placeholder="Nhập họ và tên..."
                      required
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Số Điện Thoại */}
                  <div>
                    <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-purple-600" /> Số Điện Thoại
                    </label>
                    <input
                      type="text"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      placeholder="0901234567..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Gmail / Email */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-purple-600" /> Gmail / Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="email@example.com..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Số Căn Cước (CCCD) */}
                  <div>
                    <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-purple-600" /> Số Căn Cước (CCCD)
                    </label>
                    <input
                      type="text"
                      value={userCccd}
                      onChange={(e) => setUserCccd(e.target.value)}
                      placeholder="012345678901..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Năm Sinh */}
                  <div>
                    <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-purple-600" /> Năm Sinh
                    </label>
                    <input
                      type="text"
                      value={userBirthDate}
                      onChange={(e) => setUserBirthDate(e.target.value)}
                      placeholder="YYYY (ví dụ: 1998, 2000)..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Tài Khoản Ngân Hàng (Tk Bank) */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-purple-600" /> Tài Khoản Ngân Hàng (Tk Bank)
                    </label>
                    <input
                      type="text"
                      value={userBankAccount}
                      onChange={(e) => setUserBankAccount(e.target.value)}
                      placeholder="STK - Tên Ngân Hàng - Tên Chủ TK..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>

                  {/* Kỹ Năng / Công Nghệ (Technology) */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-purple-700 uppercase font-bold tracking-wider block mb-1 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-purple-600" /> Kỹ Năng / Công Nghệ (Technology)
                    </label>
                    <input
                      type="text"
                      value={userTechnologies}
                      onChange={(e) => setUserTechnologies(e.target.value)}
                      placeholder="Angular, ReactJS, Java Spring, Python, DevOps..."
                      className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Submit & Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa Thành Viên
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {isSaved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-in fade-in slide-in-from-right-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Đã lưu thành công!
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition"
                >
                  Đóng
                </button>
                {isAdmin && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 ${
                      isSaved
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        : isSaving
                        ? 'bg-purple-500 opacity-80 cursor-wait'
                        : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : isSaved ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Đã Lưu!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Lưu Thay Đổi</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Temporary Password Modal upon Reset */}
      {tempCredModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTempCredModal(null);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-slate-800 relative animate-in zoom-in-95 duration-200 p-5 sm:p-6 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Đặt Lại Mật Khẩu Thành Công</h3>
                  <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Mật Khẩu Tạm Thời Mới</span>
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
              Mật khẩu cũ đã bị hủy. Hãy gửi thông tin đăng nhập và mật khẩu tạm thời mới này cho nhân viên.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Họ & Tên:</span>
                <span className="font-bold text-slate-800">{tempCredModal.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Staff Code:</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {tempCredModal.account}
                </span>
              </div>
              <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider block">Mật Khẩu Tạm Thời Mới</span>
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
                Cơ chế bảo mật đổi mật khẩu lần đầu
              </div>
              <p className="text-indigo-800 leading-snug">
                Khi nhân viên đăng nhập bằng mật khẩu tạm này, hệ thống sẽ yêu cầu tạo mật khẩu mới ngay lập tức.
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
    </div>
  );
};
