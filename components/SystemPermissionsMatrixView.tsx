'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, User } from '../types/task';
import {
  SYSTEM_FEATURES,
  SYSTEM_FEATURE_CATEGORIES,
  SystemFeatureDefinition,
  SystemPermissionsMatrix,
  getDefaultPermissionsMatrix,
} from '../lib/permissionsHelper';
import {
  ShieldCheck,
  Save,
  RotateCcw,
  Search,
  Check,
  X,
  Bot,
  Sparkles,
  Users,
  CheckSquare,
  Square,
  Filter,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserAvatar } from './common/UserAvatar';

const ROLES_LIST: UserRole[] = ['Admin', 'Leader', 'Advisor', 'Member'];

// Role Hierarchy Level Rank: Admin (1) -> Leader (2) -> Advisor (3) -> Member (4)
const getRoleLevelRank = (role?: string): number => {
  if (!role) return 99;
  const lower = role.trim().toLowerCase();
  if (lower === 'admin') return 1;
  if (lower === 'leader') return 2;
  if (lower === 'advisor') return 3;
  if (lower === 'member') return 4;
  return 90;
};

// Specialization display order
const getSpecOrderRank = (u: User): number => {
  const specs = u.specializations || [];
  if (specs.length === 0) return 99;
  const first = specs[0].trim().toLowerCase();
  if (first === 'ba') return 1;
  if (first.includes('design')) return 2;
  if (first === 'fe' || first.includes('frontend')) return 3;
  if (first === 'be' || first.includes('backend')) return 4;
  if (first.includes('devops') || first.includes('infra')) return 5;
  if (first === 'ai') return 6;
  if (first === 'po') return 7;
  if (first === 'sa') return 8;
  if (first.includes('qa') || first.includes('qc') || first.includes('test')) return 9;
  return 50;
};

export const SystemPermissionsMatrixView: React.FC = () => {
  const { users, currentUser, systemPermissions, updateSystemPermissions, confirmDialog } = useApp();

  const isAdmin =
    currentUser?.account?.toLowerCase() === 'admin' ||
    currentUser?.role === 'Admin';

  const [activeMode, setActiveMode] = useState<'ROLES' | 'USERS'>('ROLES');
  const [matrixState, setMatrixState] = useState<SystemPermissionsMatrix>(() => {
    return systemPermissions || getDefaultPermissionsMatrix();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [userFilterTab, setUserFilterTab] = useState<'ALL' | 'AI_ALLOWED' | 'CUSTOM_OVERRIDE' | 'DEFAULT'>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedUserAcc, setExpandedUserAcc] = useState<string | null>(null);

  // Sync initial matrix from context
  useEffect(() => {
    if (systemPermissions) {
      setMatrixState(systemPermissions);
      setIsDirty(false);
    } else {
      setMatrixState(getDefaultPermissionsMatrix());
    }
  }, [systemPermissions]);

  // Toggle role feature
  const handleToggleRoleFeature = (role: UserRole, featureKey: string) => {
    if (!isAdmin || role === 'Admin') return; // Admin is always locked true

    setMatrixState((prev) => {
      const currentRolePerms = prev.rolePermissions?.[role] || {};
      const currentVal = !!currentRolePerms[featureKey];
      const nextRolePerms = {
        ...currentRolePerms,
        [featureKey]: !currentVal,
      };

      setIsDirty(true);
      return {
        ...prev,
        rolePermissions: {
          ...prev.rolePermissions,
          [role]: nextRolePerms,
        },
      };
    });
  };

  // Toggle all features for a role
  const handleToggleAllForRole = (role: UserRole) => {
    if (!isAdmin || role === 'Admin') return;

    setMatrixState((prev) => {
      const currentRolePerms = prev.rolePermissions?.[role] || {};
      const allEnabled = SYSTEM_FEATURES.every((f) => !!currentRolePerms[f.key]);
      const nextRolePerms: Record<string, boolean> = {};

      SYSTEM_FEATURES.forEach((f) => {
        nextRolePerms[f.key] = !allEnabled;
      });

      setIsDirty(true);
      return {
        ...prev,
        rolePermissions: {
          ...prev.rolePermissions,
          [role]: nextRolePerms,
        },
      };
    });
  };

  // Toggle individual user feature override
  const handleToggleUserFeature = (account: string, featureKey: string, userRole: UserRole) => {
    if (!isAdmin || account.toLowerCase() === 'admin') return;

    setMatrixState((prev) => {
      const currentUserOverrides = prev.userOverrides?.[account] || {};
      const roleDefault = !!prev.rolePermissions?.[userRole]?.[featureKey];
      const currentVal =
        currentUserOverrides[featureKey] !== undefined
          ? currentUserOverrides[featureKey]
          : roleDefault;

      const nextOverrides = {
        ...currentUserOverrides,
        [featureKey]: !currentVal,
      };

      setIsDirty(true);
      return {
        ...prev,
        userOverrides: {
          ...prev.userOverrides,
          [account]: nextOverrides,
        },
      };
    });
  };

  // Quick action: Grant AI Features to User
  const handleQuickGrantAI = (account: string) => {
    if (!isAdmin || account.toLowerCase() === 'admin') return;

    setMatrixState((prev) => {
      const currentUserOverrides = prev.userOverrides?.[account] || {};
      const nextOverrides = {
        ...currentUserOverrides,
        ai_assistant: true,
        ai_weekly_report: true,
      };

      setIsDirty(true);
      return {
        ...prev,
        userOverrides: {
          ...prev.userOverrides,
          [account]: nextOverrides,
        },
      };
    });
  };

  // Quick action: Grant All Features to User
  const handleQuickGrantAll = (account: string) => {
    if (!isAdmin || account.toLowerCase() === 'admin') return;

    setMatrixState((prev) => {
      const nextOverrides: Record<string, boolean> = {};
      SYSTEM_FEATURES.forEach((f) => {
        nextOverrides[f.key] = true;
      });

      setIsDirty(true);
      return {
        ...prev,
        userOverrides: {
          ...prev.userOverrides,
          [account]: nextOverrides,
        },
      };
    });
  };

  // Quick action: Clear user overrides (Reset back to Role defaults)
  const handleClearUserOverrides = (account: string) => {
    if (!isAdmin || account.toLowerCase() === 'admin') return;

    setMatrixState((prev) => {
      const nextOverridesMap = { ...prev.userOverrides };
      delete nextOverridesMap[account];

      setIsDirty(true);
      return {
        ...prev,
        userOverrides: nextOverridesMap,
      };
    });
  };

  // Reset entire matrix to default system matrix
  const handleResetToDefaults = () => {
    if (!isAdmin) return;

    confirmDialog({
      title: 'Khôi phục ma trận phân quyền chuẩn',
      message: 'Hệ thống sẽ đặt lại toàn bộ phân quyền Role và các đặc quyền thành viên về thiết lập chuẩn mặc định (Bao gồm cấp quyền AI cho Admin, LichDT, QuynhNV, NhiHT). Bạn có chắc chắn muốn thực hiện?',
      confirmText: 'Đặt lại mặc định',
      cancelText: 'Hủy bỏ',
      type: 'warning',
      onConfirm: () => {
        const defaults = getDefaultPermissionsMatrix();
        setMatrixState(defaults);
        setIsDirty(true);
      },
    });
  };

  // Save changes to Firebase RTDB
  const handleSave = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await updateSystemPermissions(matrixState);
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(`Lỗi lưu ma trận phân quyền: ${e?.message || 'Không thể kết nối Firebase'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Only display active users (exclude disabled/locked accounts)
  const activeUsers = useMemo(() => {
    return (users || []).filter((u) => !u.disabled && u.status !== 'disabled');
  }, [users]);

  // Filtered & sorted users for User Override tab (Ordered by Role hierarchy: Admin -> Leader -> Advisor -> Member, then Specialization, then Name)
  const filteredUsers = useMemo(() => {
    return activeUsers
      .filter((u) => {
        if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) return false;

        const isUserAdmin = u.account.toLowerCase() === 'admin' || u.role === 'Admin';
        const userOverrides = matrixState.userOverrides?.[u.account];
        const hasOverrides = userOverrides && Object.keys(userOverrides).length > 0;

        const hasAIAssistant =
          isUserAdmin ||
          (userOverrides?.ai_assistant !== undefined
            ? !!userOverrides.ai_assistant
            : !!matrixState.rolePermissions?.[u.role]?.ai_assistant);

        const hasAIWeekly =
          isUserAdmin ||
          (userOverrides?.ai_weekly_report !== undefined
            ? !!userOverrides.ai_weekly_report
            : !!matrixState.rolePermissions?.[u.role]?.ai_weekly_report);

        const isAIAllowed = hasAIAssistant || hasAIWeekly;

        if (userFilterTab === 'AI_ALLOWED' && !isAIAllowed) return false;
        if (userFilterTab === 'CUSTOM_OVERRIDE' && !hasOverrides) return false;
        if (userFilterTab === 'DEFAULT' && hasOverrides) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const matchName = (u.name || '').toLowerCase().includes(q);
        const matchAccount = (u.account || '').toLowerCase().includes(q);
        const matchRole = (u.role || '').toLowerCase().includes(q);
        const matchSpec = (u.specializations || []).some((s) => s.toLowerCase().includes(q));
        return matchName || matchAccount || matchRole || matchSpec;
      })
      .sort((a, b) => {
        // 1. Role Level (Admin: 1, Leader: 2, Advisor: 3, Member: 4)
        const rankRoleA = getRoleLevelRank(a.role);
        const rankRoleB = getRoleLevelRank(b.role);
        if (rankRoleA !== rankRoleB) return rankRoleA - rankRoleB;

        // 2. Specialization primary rank
        const rankSpecA = getSpecOrderRank(a);
        const rankSpecB = getSpecOrderRank(b);
        if (rankSpecA !== rankSpecB) return rankSpecA - rankSpecB;

        // 3. Alphabetical order by Account / Name
        const nameA = a.account || a.name || '';
        const nameB = b.account || b.name || '';
        return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
      });
  }, [activeUsers, matrixState, userFilterTab, selectedRoleFilter, searchQuery]);

  // Group features by category
  const featuresByCategory = useMemo(() => {
    const groups: Record<string, SystemFeatureDefinition[]> = {};
    SYSTEM_FEATURE_CATEGORIES.forEach((cat) => {
      groups[cat.key] = SYSTEM_FEATURES.filter((f) => f.category === cat.key);
    });
    return groups;
  }, []);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Main Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Ma Trận Phân Quyền Hệ Thống Saho
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80">
                Admin Exclusive
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 animate-pulse">
                  Có thay đổi chưa lưu
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Thiết lập quyền hạn truy cập chức năng theo từng Vai trò (Role) và tùy biến quyền riêng cho từng Thành viên.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            disabled={!isAdmin || isSaving}
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Khôi phục ma trận phân quyền về chuẩn mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc Định Chuẩn</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={isSaving || !isDirty}
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer ${
                isDirty
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-600/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Đã lưu và đồng bộ ma trận phân quyền thành công! Tất cả người dùng sẽ nhận cấu hình mới ngay lập tức.</span>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-fit gap-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveMode('ROLES')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
              activeMode === 'ROLES'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>1. Phân Quyền Theo Vai Trò (Role Matrix)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('USERS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
              activeMode === 'USERS'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>2. Phân Quyền Từng Thành Viên (Member Overrides)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
          <Info className="w-3.5 h-3.5 text-purple-500" />
          <span>Tài khoản <strong>Admin</strong> luôn được bảo vệ với 100% quyền hạn cao nhất.</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: ROLE-BASED PERMISSION MATRIX                                 */}
      {/* ========================================================================= */}
      {activeMode === 'ROLES' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                  <th className="py-3 px-4 sm:px-6 w-[280px] sm:w-[340px]">
                    Chức Năng Hệ Thống ({SYSTEM_FEATURES.length})
                  </th>
                  <th className="py-3 px-4 hidden md:table-cell">
                    Mô Tả & Phạm Vi Hoạt Động
                  </th>
                  {ROLES_LIST.map((role) => (
                    <th
                      key={role}
                      className="py-3 px-3 text-center min-w-[110px] whitespace-nowrap border-l border-slate-200/60 dark:border-slate-700/60"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            role === 'Admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : role === 'Leader'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : role === 'Advisor'
                              ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {role}
                        </span>
                        {role !== 'Admin' && isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleAllForRole(role)}
                            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                            title={`Bật/tắt tất cả quyền cho nhóm ${role}`}
                          >
                            Đảo chọn
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body grouped by Category */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {SYSTEM_FEATURE_CATEGORIES.map((cat) => {
                  const catFeatures = featuresByCategory[cat.key] || [];
                  if (catFeatures.length === 0) return null;

                  return (
                    <React.Fragment key={cat.key}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-50/90 dark:bg-slate-950/60 font-extrabold text-slate-800 dark:text-slate-200 border-t-2 border-slate-200 dark:border-slate-700">
                        <td
                          colSpan={2 + ROLES_LIST.length}
                          className="py-2.5 px-4 sm:px-6 text-xs text-purple-900 dark:text-purple-300"
                        >
                          <div className="flex items-center gap-2">
                            <span>{cat.name}</span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {catFeatures.length} chức năng
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Feature Rows */}
                      {catFeatures.map((feat) => {
                        return (
                          <tr
                            key={feat.key}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Feature Name */}
                            <td className="py-3 px-4 sm:px-6">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] flex items-center gap-1.5">
                                {feat.category === 'ai' && (
                                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                )}
                                <span>{feat.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 md:hidden">
                                {feat.description}
                              </div>
                            </td>

                            {/* Feature Description */}
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs hidden md:table-cell leading-relaxed">
                              {feat.description}
                            </td>

                            {/* Role Checkbox Columns */}
                            {ROLES_LIST.map((role) => {
                              const isRoleAdmin = role === 'Admin';
                              const isChecked = isRoleAdmin
                                ? true
                                : !!matrixState.rolePermissions?.[role]?.[feat.key];

                              return (
                                <td
                                  key={role}
                                  className="py-3 px-3 text-center border-l border-slate-100 dark:border-slate-800/60 align-middle"
                                >
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      disabled={!isAdmin || isRoleAdmin}
                                      onClick={() => handleToggleRoleFeature(role, feat.key)}
                                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                                        isChecked
                                          ? 'bg-purple-600 text-white shadow-2xs shadow-purple-600/20'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-300 hover:text-slate-400 border border-slate-200 dark:border-slate-700'
                                      } ${!isAdmin || isRoleAdmin ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-90 hover:scale-105'}`}
                                      title={
                                        isRoleAdmin
                                          ? 'Admin luôn có toàn quyền'
                                          : isChecked
                                          ? `Bỏ quyền "${feat.name}" cho Role ${role}`
                                          : `Cấp quyền "${feat.name}" cho Role ${role}`
                                      }
                                    >
                                      {isRoleAdmin ? (
                                        <Lock className="w-3.5 h-3.5 text-white" />
                                      ) : isChecked ? (
                                        <Check className="w-4 h-4 stroke-[3]" />
                                      ) : (
                                        <X className="w-3.5 h-3.5 opacity-30" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: USER OVERRIDE PERMISSION MATRIX                              */}
      {/* ========================================================================= */}
      {activeMode === 'USERS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm nhân sự theo tên, @account, vai trò..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold shrink-0 gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setUserFilterTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    userFilterTab === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tất cả ({activeUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab('AI_ALLOWED')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    userFilterTab === 'AI_ALLOWED'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🤖 Được Dùng AI ({activeUsers.filter((u) => {
                    const isUserAdmin = u.account.toLowerCase() === 'admin' || u.role === 'Admin';
                    const ov = matrixState.userOverrides?.[u.account];
                    return isUserAdmin || ov?.ai_assistant || ov?.ai_weekly_report || matrixState.rolePermissions?.[u.role]?.ai_assistant || matrixState.rolePermissions?.[u.role]?.ai_weekly_report;
                  }).length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab('CUSTOM_OVERRIDE')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    userFilterTab === 'CUSTOM_OVERRIDE'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ⭐ Có Tùy Biến ({activeUsers.filter((u) => {
                    const ov = matrixState.userOverrides?.[u.account];
                    return ov && Object.keys(ov).length > 0;
                  }).length})
                </button>
              </div>
            </div>

            {/* Role Hierarchy Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> Sắp xếp & Lọc theo Vai Trò:
              </span>
              <button
                type="button"
                onClick={() => setSelectedRoleFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedRoleFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Tất cả ({activeUsers.length})
              </button>
              {ROLES_LIST.map((role) => {
                const count = activeUsers.filter((u) => u.role === role).length;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      selectedRoleFilter === role
                        ? role === 'Admin'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : role === 'Leader'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : role === 'Advisor'
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{role}</span>
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members List with Feature Grids */}
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Users className="w-8 h-8 opacity-40 text-slate-400" />
                <span>Không tìm thấy thành viên phù hợp với bộ lọc tìm kiếm.</span>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isUserAdmin = user.account.toLowerCase() === 'admin' || user.role === 'Admin';
                const userOverrides = matrixState.userOverrides?.[user.account] || {};
                const hasOverrides = Object.keys(userOverrides).length > 0;
                const isExpanded = expandedUserAcc === user.account;

                return (
                  <div
                    key={user.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all shadow-2xs ${
                      hasOverrides
                        ? 'border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* User Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} size="md" showStatus={false} className="shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                              {user.name}
                            </span>
                            <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-bold">
                              @{user.account}
                            </span>
                            <span
                              className={`px-2 py-0.2 rounded-md text-[10px] font-bold ${
                                user.role === 'Admin'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : user.role === 'Leader'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {user.role}
                            </span>
                            {hasOverrides && (
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {Object.keys(userOverrides).length} quyền tùy biến
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Chuyên môn: {(user.specializations || []).join(', ') || 'Chung'}
                          </div>
                        </div>
                      </div>

                      {/* Quick Member Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {!isUserAdmin && isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQuickGrantAI(user.account)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition active:scale-95 cursor-pointer shadow-2xs"
                              title="Bật nhanh quyền AI Trợ Lý & AI Báo Cáo cho thành viên này"
                            >
                              🤖 Cấp Quyền AI
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickGrantAll(user.account)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition active:scale-95 cursor-pointer shadow-2xs"
                              title="Cấp toàn bộ quyền hệ thống cho thành viên này"
                            >
                              ✓ Cấp Toàn Quyền
                            </button>
                            {hasOverrides && (
                              <button
                                type="button"
                                onClick={() => handleClearUserOverrides(user.account)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition active:scale-95 cursor-pointer"
                                title="Xóa toàn bộ tùy biến và áp dụng lại theo Role mặc định"
                              >
                                ✕ Theo Role
                              </button>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedUserAcc(isExpanded ? null : user.account)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                          title={isExpanded ? 'Thu gọn danh sách quyền' : 'Xem chi tiết ma trận quyền'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Feature Chips / Matrix Grid */}
                    <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {SYSTEM_FEATURES.map((feat) => {
                        const roleDefault = !!matrixState.rolePermissions?.[user.role]?.[feat.key];
                        const isOverridden = userOverrides[feat.key] !== undefined;
                        const isEnabled = isUserAdmin
                          ? true
                          : isOverridden
                          ? userOverrides[feat.key]
                          : roleDefault;

                        // Only show all features if expanded, or show active features / key features if collapsed
                        if (!isExpanded && !isEnabled && !isOverridden) return null;

                        return (
                          <div
                            key={feat.key}
                            onClick={() => handleToggleUserFeature(user.account, feat.key, user.role)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all select-none ${
                              isEnabled
                                ? 'bg-white dark:bg-slate-800/90 border-purple-300/80 dark:border-purple-700/80 shadow-2xs'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                            } ${!isUserAdmin && isAdmin ? 'cursor-pointer hover:border-purple-500 hover:shadow-xs active:scale-98' : 'cursor-default'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {feat.category === 'ai' && (
                                  <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                )}
                                <span
                                  className={`text-xs font-bold truncate ${
                                    isEnabled
                                      ? 'text-slate-900 dark:text-slate-100'
                                      : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {feat.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                {isOverridden ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                    ★ Tùy biến riêng
                                  </span>
                                ) : (
                                  <span>Theo vai trò {user.role}</span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-white ${
                                isEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                              }`}
                            >
                              {isUserAdmin ? (
                                <Lock className="w-3 h-3" />
                              ) : isEnabled ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
