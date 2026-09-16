'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, User as UserIcon, CheckCircle, Key, LogIn, Sparkles, ArrowLeft } from 'lucide-react';
import { GMMLogo } from './common/GMMLogo';

export const LoginModal: React.FC = () => {
  const { authSession, login, setupFirstTimePassword } = useApp();

  const [accountInput, setAccountInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // First-time setup state
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (authSession) return null; // Already logged in

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!accountInput.trim()) {
      setErrorMsg('Vui lòng nhập tên tài khoản.');
      return;
    }

    const res = await login(accountInput, passwordInput);

    if (!res.success) {
      setErrorMsg(res.error || 'Đăng nhập thất bại.');
      return;
    }

    if (res.firstTime && res.user) {
      setIsFirstTimeSetup(true);
      setTargetUserId(res.user.id);
      setErrorMsg('');
    }
  };

  const handleFirstTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mật khẩu phải có ít nhất 4 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu không trùng khớp.');
      return;
    }

    const success = await setupFirstTimePassword(targetUserId, newPassword);
    if (!success) {
      setErrorMsg('Không thể lưu mật khẩu. Vui lòng thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 modal-backdrop-animate">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl text-slate-800 space-y-6 relative overflow-hidden modal-content-animate">
        {/* Top Glow Background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-200/40 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <GMMLogo size={56} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {isFirstTimeSetup ? 'Tạo Mật Khẩu Lần Đầu' : 'Đăng Nhập Saho Task System'}
          </h2>
          <p className="text-xs text-slate-500">
            {isFirstTimeSetup
              ? 'Tài khoản của bạn chưa có mật khẩu. Vui lòng tạo mật khẩu mới để đăng nhập các lần sau.'
              : 'Nhập Account ID được Admin cấp để đăng nhập vào hệ thống.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        {!isFirstTimeSetup ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Staff Code (Username Đăng Nhập):
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="VD: QuynhNV, ThanhNDT, LichDT, NhiHT..."
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Mật Khẩu (Password):
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="Nhập mật khẩu (Bỏ trống nếu là lần đầu)..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                💡 Nếu là lần đầu tiên đăng nhập, chỉ cần nhập Account ID rồi bấm Đăng nhập.
              </p>
            </div>

            <button
              type="submit"
              className="group w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/50 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              <span>Đăng Nhập</span>
            </button>
          </form>
        ) : (
          /* First Time Password Setup Form */
          <form onSubmit={handleFirstTimeSubmit} className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                Xin chào <strong>{accountInput}</strong>! Vui lòng đặt mật khẩu mới cho tài khoản của bạn.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Mật Khẩu Mới:
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Xác Nhận Mật Khẩu Mới:
              </label>
              <div className="relative">
                <CheckCircle className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 text-xs focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFirstTimeSetup(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setErrorMsg('');
                }}
                className="group flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
                <span>Quay Lại</span>
              </button>
              <button
                type="submit"
                className="group flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/50 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                <span>Hoàn Tất & Đăng Nhập</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
