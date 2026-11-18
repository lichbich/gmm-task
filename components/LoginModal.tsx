'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ShaderEffect } from '@figma/expressive-components';
import {
  setup as setupMovingBlobs,
  render as renderMovingBlobs,
  manifest as manifestMovingBlobs,
} from '../lib/custom-effects/CodeComponentId_01bf77d94add74e8222115e4eed761cb294d1f8e_624';
import { SahoCheckbox } from './common/SahoControls';
import { GMMLogo } from './common/GMMLogo';
import { lockBodyScroll, unlockBodyScroll } from '../hooks/useModalAnimation';

const REMEMBER_ACCOUNT_KEY = 'saho_remember_account';

// Module-level constant shader configs & memoized backdrop prevent WebGPU shader
// re-initialization / animation resets when form inputs re-render.
const PRIMARY_GLOW_SHADERS = [
  {
    setup: setupMovingBlobs,
    render: renderMovingBlobs,
    params: {
      threshold: 46.29999923706055,
      strength: -72,
      chromaticAberration: 83.80000305175781,
      detail: 88,
      shadow: 0,
      mode: 'Refraction',
      speed: 26.100000381469727,
      region: 'Whole Area',
      softness: 100,
      scale: 93,
    },
    manifest: manifestMovingBlobs,
  },
];

const SECONDARY_GLOW_SHADERS = [
  {
    setup: setupMovingBlobs,
    render: renderMovingBlobs,
    params: {
      threshold: 60,
      strength: 100,
      chromaticAberration: 71.0999984741211,
      detail: 10,
      shadow: 0,
      mode: 'Refraction',
      speed: 70.30000305175781,
      region: 'Whole Area',
      softness: 84,
      scale: 100,
    },
    manifest: manifestMovingBlobs,
  },
];

const LoginAmbientBackdrop = React.memo(function LoginAmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none select-none flex items-center justify-center"
    >
      <div className="relative w-full h-full flex items-center justify-center dark:opacity-25">
        {/* Primary Glow Layer */}
        <div className="absolute flex items-center justify-center">
          <ShaderEffect className="h-[1080px] w-[1227px]" shaders={PRIMARY_GLOW_SHADERS}>
            <div className="relative h-[1080px] w-[1227px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                src="/saho-login/bg-glow-1.png"
                className="block h-full w-full object-contain pointer-events-none"
              />
            </div>
          </ShaderEffect>
        </div>

        {/* Secondary Sculpted Blob Layer */}
        <div className="absolute flex items-center justify-center translate-y-[18px] -translate-x-[36px]">
          <ShaderEffect className="h-[876px] w-[1031px]" shaders={SECONDARY_GLOW_SHADERS}>
            <div className="relative h-[876px] w-[1031px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                src="/saho-login/bg-glow-2.png"
                className="block h-full w-full object-contain object-bottom pointer-events-none"
              />
            </div>
          </ShaderEffect>
        </div>
      </div>
    </div>
  );
});

export interface LoginModalProps {
  isAuthenticated?: boolean;
  onLoginStart?: () => void;
  onLoginAbort?: () => void;
  onLoginRevealStart?: () => void;
  onLoginTransitionEnd?: () => void;
}

type SubmitPhase = 'idle' | 'loading' | 'success';

export const LoginModal: React.FC<LoginModalProps> = ({
  isAuthenticated = false,
  onLoginStart,
  onLoginAbort,
  onLoginRevealStart,
  onLoginTransitionEnd,
}) => {
  const { authSession, login, setupFirstTimePassword } = useApp();

  const [accountInput, setAccountInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(REMEMBER_ACCOUNT_KEY) || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return Boolean(localStorage.getItem(REMEMBER_ACCOUNT_KEY));
      } catch {
        return false;
      }
    }
    return false;
  });
  const [errorMsg, setErrorMsg] = useState('');

  // First-time setup state
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading & smooth transition state
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
  const [isExiting, setIsExiting] = useState(false);
  const timersRef = useRef<number[]>([]);

  const activeSession = isAuthenticated || Boolean(authSession);
  const shouldRender = !(activeSession && submitPhase === 'idle' && !isExiting);

  useEffect(() => {
    if (!shouldRender) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [shouldRender]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (!shouldRender) {
    return null;
  }

  const runSuccessEntrance = () => {
    setSubmitPhase('success');
    const tReveal = window.setTimeout(() => {
      onLoginRevealStart?.();
      setIsExiting(true);
    }, 360);
    const tDone = window.setTimeout(() => {
      onLoginTransitionEnd?.();
    }, 820);
    timersRef.current.push(tReveal, tDone);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitPhase !== 'idle') return;
    setErrorMsg('');

    const trimmedAccount = accountInput.trim();
    if (!trimmedAccount) {
      setErrorMsg('Vui lòng nhập Staff Code hoặc tên tài khoản.');
      return;
    }

    onLoginStart?.();
    setSubmitPhase('loading');

    try {
      if (typeof window !== 'undefined') {
        if (rememberAccount) {
          localStorage.setItem(REMEMBER_ACCOUNT_KEY, trimmedAccount);
        } else {
          localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
        }
      }
    } catch {}

    const minFeedbackDelay = new Promise((resolve) => window.setTimeout(resolve, 420));
    const [res] = await Promise.all([
      login(trimmedAccount, passwordInput),
      minFeedbackDelay,
    ]);

    if (!res.success) {
      setSubmitPhase('idle');
      setErrorMsg(res.error || 'Đăng nhập thất bại.');
      onLoginAbort?.();
      return;
    }

    if (res.firstTime && res.user) {
      setSubmitPhase('idle');
      setIsFirstTimeSetup(true);
      setTargetUserId(res.user.id);
      setErrorMsg('');
      onLoginAbort?.();
      return;
    }

    runSuccessEntrance();
  };

  const handleFirstTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitPhase !== 'idle') return;
    setErrorMsg('');

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu không trùng khớp.');
      return;
    }

    onLoginStart?.();
    setSubmitPhase('loading');

    const minFeedbackDelay = new Promise((resolve) => window.setTimeout(resolve, 420));
    const [success] = await Promise.all([
      setupFirstTimePassword(targetUserId, newPassword),
      minFeedbackDelay,
    ]);

    if (!success) {
      setSubmitPhase('idle');
      setErrorMsg('Không thể lưu mật khẩu mới. Vui lòng thử lại.');
      onLoginAbort?.();
      return;
    }

    runSuccessEntrance();
  };

  const isBusy = submitPhase !== 'idle';

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#F3F4F7] dark:bg-[#080c14] overflow-y-auto transition-all duration-500 ease-out ${
        isExiting
          ? 'opacity-0 scale-[1.03] pointer-events-none'
          : 'opacity-100 scale-100 animate-in fade-in duration-300'
      }`}
    >
      {/* Ambient Saho Fluid Backdrop (Memoized to keep 60fps shader uninterrupted) */}
      <LoginAmbientBackdrop />

      {/* Centered Single-Viewport Layout (Zero Internal Card Scroll) */}
      <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div
          className={`w-full max-w-[368px] backdrop-blur-[25px] bg-[rgba(248,250,251,0.68)] dark:bg-slate-900/80 border border-white/80 dark:border-slate-800 rounded-[12px] p-5 sm:p-6 shadow-[0_16px_44px_rgba(29,32,42,0.06)] text-[#1D202A] dark:text-slate-100 flex flex-col gap-6 relative transition-all duration-400 ease-out ${
            isExiting
              ? 'opacity-0 -translate-y-2 scale-[0.98]'
              : 'opacity-100 translate-y-0 scale-100 animate-in fade-in zoom-in-95 duration-300'
          }`}
        >
          {/* Header Block (System Task Logo + Heading + Subtitle) */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center shrink-0">
              <GMMLogo size={54} />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[18px] leading-[26px] font-bold text-[#1D202A] dark:text-slate-100 tracking-tight">
                {isFirstTimeSetup ? 'Thiết lập mật khẩu mới' : 'Đăng nhập tài khoản'}
              </h1>
              <p className="text-[13px] leading-[19px] font-normal text-[#838899] dark:text-slate-400">
                {isFirstTimeSetup
                  ? 'Bạn đang đăng nhập bằng mật khẩu tạm. Hãy đổi sang mật khẩu chính thức để tiếp tục.'
                  : 'Sử dụng tài khoản nội bộ hoặc Staff Code do Admin cấp để truy cập không gian làm việc.'}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="px-3 py-2.5 bg-[rgba(255,77,79,0.10)] border border-[#FF4D4F]/30 rounded-[8px] text-[12.5px] text-[#FF4D4F] text-center font-medium animate-in fade-in duration-150">
              {errorMsg}
            </div>
          )}

          {/* Form Section */}
          {!isFirstTimeSetup ? (
            <form onSubmit={handleLoginSubmit} className="px-1 flex flex-col gap-4">
              <div className="space-y-3">
                {/* Username / Staff Code Input */}
                <input
                  type="text"
                  autoComplete="username"
                  disabled={isBusy}
                  placeholder="Nhập Staff Code (VD: Admin, QuynhNV...)"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  className="w-full h-[36px] bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] rounded-[8px] px-3 text-[13.5px] text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] transition disabled:opacity-65"
                  required
                />

                {/* Password Input + Eye Toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={isBusy}
                    placeholder="Nhập mật khẩu"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full h-[36px] bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] rounded-[8px] pl-3 pr-9 text-[13.5px] text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] transition disabled:opacity-65"
                    required
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#838899] hover:text-[#1D202A] dark:hover:text-slate-200 rounded-[6px] transition cursor-pointer disabled:pointer-events-none"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Remember Account Checkbox */}
                <div className="pt-0.5 flex items-center">
                  <SahoCheckbox
                    size="md"
                    checked={rememberAccount}
                    onChange={(next) => !isBusy && setRememberAccount(next)}
                    disabled={isBusy}
                    label={
                      <span className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200">
                        Ghi nhớ tài khoản
                      </span>
                    }
                  />
                </div>
              </div>

              {/* Primary Log In Button + Loading & Entering Animation */}
              <button
                type="submit"
                disabled={isBusy}
                className={`w-full h-[40px] rounded-[12px] font-medium text-[14px] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                  submitPhase === 'success'
                    ? 'bg-[#0AB185] text-white shadow-[0_6px_16px_rgba(10,177,133,0.28)]'
                    : submitPhase === 'loading'
                    ? 'bg-[#1890FF]/90 text-white shadow-[0_6px_16px_rgba(24,144,255,0.22)]'
                    : 'bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white shadow-[0_6px_16px_rgba(24,144,255,0.28)] active:scale-[0.985]'
                }`}
              >
                {submitPhase === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : submitPhase === 'success' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đang vào không gian làm việc...</span>
                  </>
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>
            </form>
          ) : (
            /* First-Time Password Setup Flow */
            <form onSubmit={handleFirstTimeSubmit} className="px-1 flex flex-col gap-4">
              <div className="p-2.5 bg-[rgba(24,144,255,0.08)] border border-[#1890FF]/25 rounded-[8px] text-[12px] text-[#096DD9] dark:text-sky-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1890FF] shrink-0" />
                <span>
                  Xin chào <strong>{accountInput}</strong>, hãy đổi mật khẩu chính thức cho tài khoản của bạn.
                </span>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    disabled={isBusy}
                    placeholder="Mật khẩu mới (ít nhất 4 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-[36px] bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] rounded-[8px] pl-3 pr-9 text-[13.5px] text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] transition disabled:opacity-65"
                    required
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#838899] hover:text-[#1D202A] dark:hover:text-slate-200 rounded-[6px] transition cursor-pointer"
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    disabled={isBusy}
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-[36px] bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] rounded-[8px] pl-3 pr-9 text-[13.5px] text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] transition disabled:opacity-65"
                    required
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#838899] hover:text-[#1D202A] dark:hover:text-slate-200 rounded-[6px] transition cursor-pointer"
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setIsFirstTimeSetup(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setErrorMsg('');
                  }}
                  className="h-[40px] px-3.5 bg-white dark:bg-slate-800 hover:bg-[#F8FAFB] dark:hover:bg-slate-700 text-[#1D202A] dark:text-slate-200 font-medium text-[13px] rounded-[12px] transition flex items-center justify-center gap-1.5 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#A2A6B4] cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>

                <button
                  type="submit"
                  disabled={isBusy}
                  className={`flex-1 h-[40px] font-medium text-[13.5px] rounded-[12px] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                    submitPhase === 'success'
                      ? 'bg-[#0AB185] text-white shadow-[0_6px_16px_rgba(10,177,133,0.28)]'
                      : 'bg-[#0AB185] hover:bg-[#088E6A] text-white shadow-[0_6px_16px_rgba(10,177,133,0.28)] active:scale-[0.985]'
                  }`}
                >
                  {submitPhase === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu mật khẩu...</span>
                    </>
                  ) : submitPhase === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đang vào hệ thống...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Hoàn tất & Đăng nhập</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer Mark (System Logo Sync) */}
          <div className="flex items-center justify-center gap-1.5 text-[12px] leading-[18px] text-[#A2A6B4] pt-1">
            <span>Secured by</span>
            <GMMLogo size={16} />
            <span className="font-medium text-[#838899]">Saho Task</span>
          </div>

          {/* Subtle progress indicator bar along bottom edge when entering */}
          {submitPhase === 'success' && (
            <div className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full overflow-hidden bg-[#E6F7F3]">
              <div className="h-full w-full bg-[#0AB185] animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
