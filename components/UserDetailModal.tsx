'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole, Specialization } from '../types/task';
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
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Dropdown } from './common/Dropdown';

interface UserDetailModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, isOpen, onClose }) => {
  const {
    currentUser,
    roles,
    tasks,
    selectedWeek,
    selectedYear,
    updateUser,
    deleteUser,
    confirmDialog,
  } = useApp();

  const { isRendered, isVisible, handleClose } = useModalAnimation(isOpen, onClose);

  // Form Fields
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

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync state when user prop changes or modal opens
  useEffect(() => {
    if (user) {
      setUserName(user.name || '');
      setUserAccount(user.account || '');
      setUserRole(user.role || 'Member');
      setSelectedSpecs(user.specializations && user.specializations.length > 0 ? user.specializations : ['BA']);
      setUserCccd(user.cccd || '');
      setUserBankAccount(user.bankAccount || '');
      setUserEmail(user.email || '');
      setUserPhone(user.phone || '');
      setUserTechnologies(user.technologies || '');
      setUserBirthDate(user.birthDate ? String(user.birthDate) : '');
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
  const currentWeekEffort = userCurrentTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0);
  const totalEffortCumulative = (user.totalEffort || 0) + currentWeekEffort;

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
      message: `Bạn có chắc chắn muốn đặt lại mật khẩu cho tài khoản ${user.name} (${user.account})? Mật khẩu sẽ bị xóa và người dùng sẽ được yêu cầu tạo mật khẩu mới khi đăng nhập.`,
      confirmText: 'Đặt lại mật khẩu',
      type: 'warning',
      onConfirm: () => {
        updateUser(user.id, { password: '', firstLoginCompleted: false });
        setSuccessMsg(`Đã đặt lại mật khẩu cho tài khoản ${user.account} thành công!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      },
    });
  };

  const handleDeleteUser = () => {
    confirmDialog({
      title: 'Xác nhận xóa thành viên',
      message: `Bạn có chắc chắn muốn xóa thành viên ${user.name} (${user.account})? Tất cả task của người này sẽ chuyển thành Task Trống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => {
        deleteUser(user.id);
        handleClose();
      },
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!userName.trim()) {
      setErrorMsg('Vui lòng nhập Họ & Tên.');
      return;
    }

    if (!userAccount.trim()) {
      setErrorMsg('Vui lòng nhập Staff Code / Username.');
      return;
    }

    updateUser(user.id, {
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
    });

    setSuccessMsg('Cập nhật thông tin nhân viên thành công!');
    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-800 relative max-h-[90vh] flex flex-col modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <UserIcon className="w-4 h-4 text-purple-600" />
            Chi Tiết & Quản Lý Thông Tin Nhân Viên
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {/* User Profile Banner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 rounded-2xl p-4 shadow-md gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${roleTheme.gradient} flex items-center justify-center text-white font-extrabold text-xl shadow-md`}
                >
                  {user.account ? user.account.slice(0, 2).toUpperCase() : 'NV'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-xs" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {userName || user.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md border border-white/15 font-bold">
                    @{userAccount || user.account}
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

          {/* Form Content */}
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Shield className="w-4 h-4 text-purple-600" />
                Cài Đặt Phân Quyền & Vai Trò Chuyên Môn
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Level / Quyền */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Cấp Phân Quyền (Level System):
                  </label>
                  {isAdmin ? (
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
                      buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300 font-semibold text-slate-800"
                    />
                  ) : (
                    <div className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                      {userRole}
                    </div>
                  )}
                </div>

                {/* Staff Code */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Staff Code (Username Đăng Nhập):
                  </label>
                  <input
                    type="text"
                    value={userAccount}
                    onChange={(e) => setUserAccount(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-indigo-700 font-mono font-bold focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                    required
                  />
                </div>

                {/* Specializations (Role Position) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">
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
                              ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs font-bold'
                              : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'active:scale-95'}`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {r.code} ({r.name})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details Section */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Hồ Sơ Lý Lịch Nhân Sự
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Họ & Tên Nhân Viên: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" /> Số Điện Thoại:
                  </label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" /> Gmail / Email:
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" /> Số Căn Cước (CCCD):
                  </label>
                  <input
                    type="text"
                    value={userCccd}
                    onChange={(e) => setUserCccd(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Năm Sinh (BirthDate):
                  </label>
                  <input
                    type="text"
                    value={userBirthDate}
                    onChange={(e) => setUserBirthDate(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" /> Tài Khoản Ngân Hàng (Tk Bank):
                  </label>
                  <input
                    type="text"
                    value={userBankAccount}
                    onChange={(e) => setUserBankAccount(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-slate-400" /> Kỹ Năng / Công Nghệ (Technology):
                  </label>
                  <input
                    type="text"
                    value={userTechnologies}
                    onChange={(e) => setUserTechnologies(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-purple-400 focus:bg-white disabled:opacity-75"
                  />
                </div>
              </div>
            </div>

            {/* Submit & Footer Actions */}
            <div className="flex items-center justify-between pt-2">
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
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    Lưu Thay Đổi
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
