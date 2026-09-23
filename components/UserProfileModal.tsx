import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  User as UserIcon,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Award,
  AlertTriangle,
  LogOut,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  Shield,
  Clock,
  Edit2,
  Save,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users, tasks, roles, selectedWeek, selectedYear, weeklyAwards, weeklyArchives, updateUser, changePassword, logout } =
    useApp();
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'INFO' | 'PASSWORD'>('INFO');

  // Info editing states
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCccd, setEditCccd] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTechnologies, setEditTechnologies] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editSpecializations, setEditSpecializations] = useState<string[]>(['BA']);

  // Change password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isSavedInfo, setIsSavedInfo] = useState(false);
  const [isSavedPassword, setIsSavedPassword] = useState(false);

  if (!isRendered || !currentUser) return null;

  // Retrieve full user record from state/database
  const userRecord =
    users.find((u) => u.account.toLowerCase() === currentUser.account.toLowerCase()) || currentUser;

  // Calculate user's current week stats
  const userCurrentTasks = tasks.filter(
    (t) =>
      t.assigneeAccount?.toLowerCase() === currentUser.account.toLowerCase() &&
      t.weekNumber === selectedWeek &&
      t.year === selectedYear
  );

  const activeTasksCount = userCurrentTasks.filter((t) => t.status !== 'Done').length;
  const completedTasksCount = userCurrentTasks.filter((t) => t.status === 'Done').length;
  const currentWeekEffort = userCurrentTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0);
  const totalEffortCumulative = (userRecord.totalEffort || 0) + currentWeekEffort;

  const isWeekFinalized = weeklyArchives.some(
    (a) => a.weekNumber === selectedWeek && a.year === selectedYear
  );
  const userAward = weeklyAwards.find((w) => w.account === currentUser?.account);
  const isTopEffort = isWeekFinalized && (userAward?.isTopEffort || false);
  const isLate = isWeekFinalized && (userAward?.isLate || false);

  const startEditInfo = () => {
    setEditName(userRecord.name || '');
    setEditCccd(userRecord.cccd || '');
    setEditBankAccount(userRecord.bankAccount || '');
    setEditEmail(userRecord.email || '');
    setEditPhone(userRecord.phone || '');
    setEditTechnologies(userRecord.technologies || '');
    setEditBirthDate(userRecord.birthDate ? String(userRecord.birthDate) : '');
    setEditSpecializations(
      userRecord.specializations && userRecord.specializations.length > 0
        ? userRecord.specializations
        : ['BA']
    );
    setIsEditingInfo(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveProfileInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setErrorMsg('Vui lòng nhập Họ & Tên.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSavingInfo(true);

    setTimeout(() => {
      updateUser(userRecord.id, {
        name: editName.trim(),
        cccd: editCccd.trim(),
        bankAccount: editBankAccount.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        technologies: editTechnologies.trim(),
        birthDate: editBirthDate.trim(),
        specializations: editSpecializations,
      });

      setIsSavingInfo(false);
      setIsSavedInfo(true);
      setIsEditingInfo(false);
      setSuccessMsg('Cập nhật thông tin cá nhân thành công!');
      setTimeout(() => {
        setIsSavedInfo(false);
        setSuccessMsg('');
      }, 4000);
    }, 300);
  };

  const getRoleTheme = (role: string) => {
    switch (role) {
      case 'Admin':
        return {
          badge: 'bg-purple-100 text-purple-700 border-purple-300',
          gradient: 'from-purple-600 to-indigo-600',
          glow: 'shadow-purple-500/25',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />,
        };
      case 'Leader':
        return {
          badge: 'bg-amber-100 text-amber-700 border-amber-300',
          gradient: 'from-amber-500 to-orange-600',
          glow: 'shadow-amber-500/25',
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'Advisor':
        return {
          badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
          gradient: 'from-emerald-600 to-teal-600',
          glow: 'shadow-emerald-500/25',
          icon: <Award className="w-3.5 h-3.5 text-emerald-600" />,
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-700 border-blue-300',
          gradient: 'from-indigo-600 to-blue-500',
          glow: 'shadow-indigo-500/25',
          icon: <Briefcase className="w-3.5 h-3.5 text-blue-600" />,
        };
    }
  };

  const roleTheme = getRoleTheme(userRecord.role);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (currentUser.password && !currentPassword.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 4 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    if (currentUser.password && currentPassword === newPassword) {
      setErrorMsg('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(currentUser.id, currentPassword, newPassword);
      if (res.success) {
        setIsSavedPassword(true);
        setSuccessMsg('Đổi mật khẩu thành công! Mật khẩu mới đã được mã hoá an toàn.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsSavedPassword(false);
          setSuccessMsg('');
        }, 4000);
      } else {
        setErrorMsg(res.error || 'Đổi mật khẩu không thành công.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi cập nhật mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-800 relative max-h-[92vh] flex flex-col modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <UserIcon className="w-4 h-4 text-indigo-600" />
            Hồ Sơ & Bảo Mật Nhân Viên
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Main Content Container with custom-scrollbar */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto custom-scrollbar min-h-0 overscroll-contain">
          {/* User Profile Header (Sleek Dark Gradient Card) */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3.5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${roleTheme.gradient} flex items-center justify-center text-white font-extrabold text-xl shadow-md ${roleTheme.glow}`}
                >
                  {userRecord.account.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow-xs ${
                    userRecord.password && userRecord.password.trim() !== '' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  title={
                    userRecord.password && userRecord.password.trim() !== ''
                      ? 'Trạng thái: Đã tham gia hệ thống (Đã tạo mật khẩu)'
                      : 'Trạng thái: Chưa tham gia hệ thống (Chưa tạo mật khẩu)'
                  }
                />
              </div>

              {/* Name & Account Details */}
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {userRecord.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                    Mã NV: @{userRecord.account}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${roleTheme.badge}`}>
                    {roleTheme.icon}
                    {userRecord.role}
                  </span>
                  {(userRecord.specializations && userRecord.specializations.length > 0) && (
                    <div className="flex items-center gap-1">
                      {userRecord.specializations.map((spec) => (
                        <span
                          key={spec}
                          className="px-2 py-0.5 bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 rounded-md text-[10px] font-bold font-mono"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
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

          {/* Tab Navigation Controls (Animated Segments) */}
          <div className="flex items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 gap-1.5">
            <button
              onClick={() => setActiveTab('INFO')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'INFO'
                  ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Thông Tin Chi Tiết
            </button>
            <button
              onClick={() => setActiveTab('PASSWORD')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'PASSWORD'
                  ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Đổi Mật Khẩu
            </button>
          </div>

          {/* TAB 1: USER INFO & STATS */}
          {activeTab === 'INFO' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 4 Stats Cards Grid Including Total Effort */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-3 text-center space-y-0.5">
                  <div className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider">Tổng Effort Lũy Kế</div>
                  <div className="text-base sm:text-lg font-black text-indigo-700 font-mono">
                    {totalEffortCumulative}h
                  </div>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-center space-y-0.5">
                  <div className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wider">Effort Tuần {selectedWeek}</div>
                  <div className="text-base sm:text-lg font-black text-amber-700 font-mono">
                    {currentWeekEffort}h
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center space-y-0.5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Task Đang Làm</div>
                  <div className="text-base sm:text-lg font-black text-indigo-600 font-mono">
                    {activeTasksCount}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center space-y-0.5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Đã Hoàn Thành</div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                    {completedTasksCount}
                  </div>
                </div>
              </div>

              {/* Status & Alerts in Current Week */}
              {(isTopEffort || isLate) && (
                <div className="p-3 rounded-2xl border flex items-center gap-2.5 text-xs">
                  {isTopEffort && (
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border-emerald-200 p-2.5 rounded-xl w-full">
                      <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <strong>Thưởng Tuần Này:</strong> Bạn đang có tổng giờ nỗ lực cao nhất hệ thống!
                      </div>
                    </div>
                  )}
                  {isLate && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border-red-200 p-2.5 rounded-xl w-full">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <strong>Phạt:</strong> Có báo cáo nộp sau 22h tối Chủ Nhật cần lưu ý.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW MODE vs EDIT MODE */}
              {!isEditingInfo ? (
                <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden text-xs shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50/80 font-bold text-slate-700 flex items-center justify-between border-b border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                      Hồ Sơ Lý Lịch & Chuyên Môn
                    </span>
                    <button
                      onClick={startEditInfo}
                      className="flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 transition active:scale-95 shadow-2xs"
                      title="Chỉnh sửa thông tin cá nhân"
                    >
                      <Edit2 className="w-3 h-3 text-indigo-600" /> Chỉnh Sửa Thông Tin
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Họ & Tên Nhân Viên</span>
                      <div className="font-bold text-slate-800 text-xs">{userRecord.name}</div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Số Căn Cước (CCCD)</span>
                      <div className="font-mono font-bold text-slate-800">{userRecord.cccd || '—'}</div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Năm Sinh</span>
                      <div className="font-bold text-slate-800">{userRecord.birthDate || '—'}</div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Số Điện Thoại</span>
                      <div className="font-mono font-bold text-slate-800">{userRecord.phone || '—'}</div>
                    </div>

                    <div className="space-y-0.5 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gmail / Email</span>
                      <div className="font-semibold text-slate-800 truncate" title={userRecord.email}>{userRecord.email || '—'}</div>
                    </div>

                    <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Vị Trí Chuyên Môn (Role / Specialization)</span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(userRecord.specializations && userRecord.specializations.length > 0 ? userRecord.specializations : ['BA']).map((spec) => {
                          const matched = roles.find((r) => r.code === spec);
                          return (
                            <span
                              key={spec}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1"
                            >
                              <Layers className="w-3 h-3 text-indigo-500" />
                              {spec} {matched ? `(${matched.name})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-0.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tài Khoản Ngân Hàng Thụ Hưởng</span>
                      <div className="font-mono font-bold text-slate-800 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-200/70">
                        {userRecord.bankAccount || '—'}
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Công Nghệ / Kỹ Năng Thế Mạnh</span>
                      <div className="font-semibold text-indigo-700 bg-indigo-50/70 p-2 rounded-xl border border-indigo-100 text-[11px]">
                        {userRecord.technologies || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfileInfo} className="border border-indigo-200 rounded-2xl bg-white overflow-hidden text-xs p-4 space-y-3 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                      Chỉnh Sửa Thông Tin Cá Nhân
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Staff Code: @{userRecord.account}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Họ & Tên Nhân Viên: <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Số Căn Cước (CCCD):
                      </label>
                      <input
                        type="text"
                        value={editCccd}
                        onChange={(e) => setEditCccd(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Năm Sinh (BirthDate):
                      </label>
                      <input
                        type="text"
                        value={editBirthDate}
                        onChange={(e) => setEditBirthDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Số Điện Thoại (Phone):
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Gmail / Email:
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    {/* SPECIALIZATION / ROLE SELECTION IN EDIT MODE */}
                    <div className="sm:col-span-2 space-y-1 pt-1 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block">
                        Vị Trí Chuyên Môn Kiêm Nhiệm (Role):
                      </label>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {roles.map((r) => {
                          const isChecked = editSpecializations.includes(r.code);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  if (editSpecializations.length === 1) return;
                                  setEditSpecializations(editSpecializations.filter((s) => s !== r.code));
                                } else {
                                  setEditSpecializations([...editSpecializations, r.code]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                                isChecked
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs font-bold'
                                  : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {isChecked ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white" />
                              )}
                              <span>{r.code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Tài Khoản Ngân Hàng Thụ Hưởng (Tk Bank):
                      </label>
                      <input
                        type="text"
                        value={editBankAccount}
                        onChange={(e) => setEditBankAccount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Công Nghệ / Kỹ Năng Thế Mạnh (Technology):
                      </label>
                      <input
                        type="text"
                        value={editTechnologies}
                        onChange={(e) => setEditTechnologies(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(false)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingInfo}
                      className={`px-4 py-1.5 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 ${
                        isSavingInfo
                          ? 'bg-indigo-500 opacity-80 cursor-wait'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                      }`}
                    >
                      {isSavingInfo ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu Thay Đổi</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'PASSWORD' && (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 animate-in fade-in duration-200">
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

              {/* Current Password Field */}
              {currentUser.password && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Mật khẩu hiện tại: <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Nhập mật khẩu bạn đang sử dụng..."
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300/90 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password Field */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mật khẩu mới: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300/90 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Xác nhận mật khẩu mới: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CheckCircle2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300/90 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] ${
                    isSavedPassword
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang mã hoá & cập nhật...</span>
                    </>
                  ) : isSavedPassword ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Đã Cập Nhật Mật Khẩu Thành Công!</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Cập Nhật Mật Khẩu Mới</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Fixed Modal Footer Controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 shrink-0 bg-slate-50/60 rounded-b-2xl sm:rounded-b-3xl">
          <button
            onClick={() => {
              handleClose();
              setTimeout(() => {
                logout();
              }, 200);
            }}
            className="px-3.5 py-2 text-red-600 hover:bg-red-50 border border-red-200/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
            title="Đăng xuất khỏi phiên làm việc"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>

          <button
            onClick={handleClose}
            className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition active:scale-95 shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
