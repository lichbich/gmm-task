'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { parseSahoRoute, useSyncModalUrl } from '../lib/sahoUrl';
import {
  UserRole,
  Specialization,
  User,
  RoleItem,
  validateRoleQuota,
  getUserRoleColorClass,
  getUserRoleInSpec,
  calculateHighestRole,
} from '../types/task';
import {
  Users,
  Plus,
  Shield,
  ShieldCheck,
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
  Save,
  Eye,
  Copy,
  Check,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  Zap,
  Info,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  Send,
} from 'lucide-react';
import { Dropdown } from './common/Dropdown';
import { Modal } from './common/Modal';
import { UserDetailModal } from './UserDetailModal';
import { UserAvatar } from './common/UserAvatar';
import { SystemPermissionsMatrixView } from './SystemPermissionsMatrixView';
import { SahoCheckbox } from './common/SahoControls';
import { sahoToast } from './common/SahoToast';

export type SheetFieldKey =
  | 'no'
  | 'name'
  | 'cccd'
  | 'bankAccount'
  | 'email'
  | 'phone'
  | 'account'
  | 'role'
  | 'level'
  | 'technologies'
  | 'birthDate'
  | 'effort'
  | 'effortTotal'
  | 'skip';

export interface SheetColumnItem {
  id: string;
  key: SheetFieldKey;
  label: string;
}

export const DEFAULT_SHEET_COLUMNS: SheetColumnItem[] = [
  { id: 'col-no', key: 'no', label: 'No' },
  { id: 'col-name', key: 'name', label: 'Full Name' },
  { id: 'col-cccd', key: 'cccd', label: 'CCCD' },
  { id: 'col-bank', key: 'bankAccount', label: 'Tk Bank' },
  { id: 'col-email', key: 'email', label: 'Gmail' },
  { id: 'col-phone', key: 'phone', label: 'Phone' },
  { id: 'col-account', key: 'account', label: 'Staff Code' },
  { id: 'col-role', key: 'role', label: 'Role' },
  { id: 'col-level', key: 'level', label: 'Level' },
  { id: 'col-tech', key: 'technologies', label: 'Technology' },
  { id: 'col-birth', key: 'birthDate', label: 'BirthDate' },
  { id: 'col-effort', key: 'effort', label: 'Effort' },
  { id: 'col-effort-total', key: 'effortTotal', label: 'Effort Total' },
];

export const AVAILABLE_SHEET_FIELDS: { key: SheetFieldKey; label: string; defaultName: string }[] = [
  { key: 'no', label: 'No (Số thứ tự)', defaultName: 'No' },
  { key: 'name', label: 'Full Name (Họ và tên)', defaultName: 'Full Name' },
  { key: 'account', label: 'Staff Code (Username)', defaultName: 'Staff Code' },
  { key: 'role', label: 'Role (Vị trí chuyên môn)', defaultName: 'Role' },
  { key: 'level', label: 'Level (Cấp phân quyền)', defaultName: 'Level' },
  { key: 'cccd', label: 'CCCD (Số căn cước)', defaultName: 'CCCD' },
  { key: 'bankAccount', label: 'Tk Bank (Tài khoản NH)', defaultName: 'Tk Bank' },
  { key: 'email', label: 'Gmail / Email', defaultName: 'Gmail' },
  { key: 'phone', label: 'Phone (Số điện thoại)', defaultName: 'Phone' },
  { key: 'technologies', label: 'Technology (Công nghệ)', defaultName: 'Technology' },
  { key: 'birthDate', label: 'BirthDate (Năm sinh)', defaultName: 'BirthDate' },
  { key: 'effort', label: 'Effort (Giờ tuần)', defaultName: 'Effort' },
  { key: 'effortTotal', label: 'Effort Total (Tổng giờ)', defaultName: 'Effort Total' },
  { key: 'skip', label: 'Cột bỏ qua / Cột trống (Skip)', defaultName: 'Bỏ Qua' },
];

export const LOCAL_STORAGE_SHEET_COLS = 'saho_sheet_column_order';

export interface ParsedSheetMember {
  name: string;
  cccd: string;
  bankAccount: string;
  email: string;
  phone: string;
  account: string;
  role: UserRole;
  specializations: Specialization[];
  technologies: string;
  birthDate: string;
}

export const parseSheetRowWithColumns = (
  rawText: string,
  columns: SheetColumnItem[],
  availableRoles: RoleItem[]
): ParsedSheetMember | null => {
  if (!rawText || !rawText.trim()) return null;

  // Split line by tab '\t' or '|'
  let cells = rawText.split('\t').map((c) => c.trim());
  if (cells.length === 1 && rawText.includes('|')) {
    cells = rawText.split('|').map((c) => c.trim());
  }

  const result: ParsedSheetMember = {
    name: '',
    cccd: '',
    bankAccount: '',
    email: '',
    phone: '',
    account: '',
    role: 'Member',
    specializations: [],
    technologies: '',
    birthDate: '',
  };

  let roleRaw = '';
  let levelRaw = '';

  columns.forEach((col, idx) => {
    const val = cells[idx] ?? '';
    switch (col.key) {
      case 'name':
        result.name = val;
        break;
      case 'account':
        result.account = val.replace(/^@+/, '').trim();
        break;
      case 'cccd':
        result.cccd = val;
        break;
      case 'bankAccount':
        result.bankAccount = val;
        break;
      case 'email':
        result.email = val;
        break;
      case 'phone':
        result.phone = val;
        break;
      case 'technologies':
        result.technologies = val;
        break;
      case 'birthDate':
        result.birthDate = val;
        break;
      case 'role':
        roleRaw = val;
        break;
      case 'level':
        levelRaw = val;
        break;
      case 'no':
      case 'effort':
      case 'effortTotal':
      case 'skip':
      default:
        break;
    }
  });

  // If no account is extracted, try to generate or find from email
  if (!result.account && result.email) {
    result.account = result.email.split('@')[0];
  }

  if (!result.name && !result.account && !result.email && !result.phone && !result.cccd) {
    return null;
  }

  // Parse Level (UserRole)
  if (levelRaw) {
    const levelUpper = levelRaw.toUpperCase();
    if (levelUpper.includes('ADMIN')) {
      result.role = 'Admin';
    } else if (levelUpper.includes('LEADER')) {
      result.role = 'Leader';
    } else if (levelUpper.includes('ADVISOR') || levelUpper.includes('CỐ VẤN') || levelUpper.includes('CO VAN')) {
      result.role = 'Advisor';
    } else {
      result.role = 'Member';
    }
  }

  // Parse Specializations (Role)
  if (roleRaw) {
    const specs: Specialization[] = [];
    const normalizedRoleRaw = roleRaw.toUpperCase();

    availableRoles.forEach((r) => {
      const codeUpper = r.code.toUpperCase();
      const nameUpper = r.name.toUpperCase();
      if (
        normalizedRoleRaw === codeUpper ||
        normalizedRoleRaw.includes(codeUpper) ||
        (nameUpper && normalizedRoleRaw.includes(nameUpper))
      ) {
        if (!specs.includes(r.code)) {
          specs.push(r.code);
        }
      }
    });

    if (specs.length === 0) {
      if (normalizedRoleRaw.includes('BA')) specs.push('BA');
      if (normalizedRoleRaw.includes('FE') || normalizedRoleRaw.includes('FRONT')) specs.push('FE');
      if (normalizedRoleRaw.includes('BE') || normalizedRoleRaw.includes('BACK')) specs.push('BE');
      if (normalizedRoleRaw.includes('QA') || normalizedRoleRaw.includes('TEST')) specs.push('QA');
      if (normalizedRoleRaw.includes('PO') || normalizedRoleRaw.includes('PRODUCT')) specs.push('PO');
      if (normalizedRoleRaw.includes('DESIGN')) specs.push('Design');
    }

    result.specializations = specs.length > 0 ? specs : [availableRoles[0]?.code || 'BA'];
  } else {
    result.specializations = [availableRoles[0]?.code || 'BA'];
  }

  return result;
};

export const parseSheetRow = (rawText: string, availableRoles: RoleItem[]): ParsedSheetMember | null => {
  let savedCols = DEFAULT_SHEET_COLUMNS;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SHEET_COLS);
      if (raw) savedCols = JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return parseSheetRowWithColumns(rawText, savedCols, availableRoles);
};

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

interface WelcomeEmailRequest {
  name: string;
  account: string;
  tempPassword: string;
  email: string;
  role?: string;
  specializations?: string[];
  specializationRoles?: Record<string, string>;
  specializationNames?: Record<string, string>;
  cccd?: string;
  bankAccount?: string;
  phone?: string;
  technologies?: string;
  birthDate?: string | number;
}

interface UserManagementViewProps {
  activeSubTab?: 'USERS' | 'ROLES' | 'PERMISSIONS';
  onChangeSubTab?: (tab: 'USERS' | 'ROLES' | 'PERMISSIONS') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  activeSubTab: activeSubTabProp,
  onChangeSubTab,
}) => {
  const {
    users,
    addUser,
    updateUser,
    batchImportUsers,
    deleteUser,
    resetUserPassword,
    resetAllUninitializedPasswords,
    roles,
    addRole,
    updateRole,
    deleteRole,
    reorderRoles,
    tasks,
    currentUser,
    confirmDialog,
  } = useApp();

  // SUB-TAB & SEARCH STATE (controlled by Sidebar/MainAppClient when props provided)
  const isAdmin = currentUser?.role === 'Admin';
  const [internalSubTab, setInternalSubTab] = useState<'USERS' | 'ROLES' | 'PERMISSIONS'>(() => {
    if (typeof window !== 'undefined') {
      const parsed = parseSahoRoute(window.location.pathname, window.location.search);
      if (parsed.userSubTab) return parsed.userSubTab;
    }
    return 'USERS';
  });
  const activeSubTab: 'USERS' | 'ROLES' | 'PERMISSIONS' = !isAdmin
    ? 'USERS'
    : activeSubTabProp ?? internalSubTab;
  const setActiveSubTab = useCallback(
    (tab: 'USERS' | 'ROLES' | 'PERMISSIONS') => {
      if (onChangeSubTab) {
        onChangeSubTab(tab);
      } else {
        setInternalSubTab(tab);
      }
    },
    [onChangeSubTab]
  );
  const [userDetailEditMode, setUserDetailEditMode] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [permState, setPermState] = useState({ isDirty: false, isSaving: false });
  const permActionsRef = useRef<{ resetToDefaults: () => void; save: () => void } | null>(null);
  const isMouseDownOnBatchBackdrop = useRef(false);

  // Non-admin roles should only see the USERS list
  useEffect(() => {
    if (!isAdmin && internalSubTab !== 'USERS') {
      setInternalSubTab('USERS');
    }
  }, [isAdmin, internalSubTab]);

  useEffect(() => {
    if (typeof window === 'undefined' || activeSubTabProp !== undefined) return;
    const handlePop = () => {
      const parsed = parseSahoRoute(window.location.pathname, window.location.search);
      if (parsed.section === 'users' && parsed.userSubTab && !parsed.modal) {
        setInternalSubTab(isAdmin ? parsed.userSubTab : 'USERS');
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isAdmin, activeSubTabProp]);

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
  const [selectedUserIdForDetail, setSelectedUserIdForDetail] = useState<string | null>(null);
  const selectedUserForDetail = useMemo(
    () => (selectedUserIdForDetail ? users.find((u) => u.id === selectedUserIdForDetail) || null : null),
    [users, selectedUserIdForDetail]
  );
  const setSelectedUserForDetail = useCallback((u: User | null) => {
    setSelectedUserIdForDetail(u ? u.id : null);
  }, []);

  // TEMPORARY CREDENTIAL MODAL (SINGLE USER)
  const [tempCredModal, setTempCredModal] = useState<{
    title: string;
    subtitle: string;
    name: string;
    account: string;
    tempPassword: string;
    email?: string;
    emailStatus?: 'sending' | 'sent' | 'failed' | 'skipped' | 'no_email';
    emailMessage?: string;
    emailPayload?: WelcomeEmailRequest;
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
  const [specRoles, setSpecRoles] = useState<Record<Specialization, UserRole>>({});
  const [userCccd, setUserCccd] = useState('');
  const [userBankAccount, setUserBankAccount] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userTechnologies, setUserTechnologies] = useState('');
  const [userBirthDate, setUserBirthDate] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useSyncModalUrl(
    isUserFormOpen && activeSubTab === 'USERS',
    isUserFormOpen && activeSubTab === 'USERS' ? '/users/create' : null,
    () => setIsUserFormOpen(false),
    'Tạo Tài Khoản Thành Viên'
  );

  const deepLinkUserHandledRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || deepLinkUserHandledRef.current) return;
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (parsed.modal?.kind === 'user-create') {
      deepLinkUserHandledRef.current = true;
      if (isAdmin) {
        setActiveSubTab('USERS');
        setIsUserFormOpen(true);
      }
    } else if (
      (parsed.modal?.kind === 'user-detail' || parsed.modal?.kind === 'user-edit') &&
      parsed.modal.id &&
      users.length > 0
    ) {
      deepLinkUserHandledRef.current = true;
      const targetAcc = decodeURIComponent(parsed.modal.id).trim().toLowerCase();
      const found = users.find((u) => u.account.toLowerCase() === targetAcc || u.id === parsed.modal?.id);
      if (found) {
        setUserDetailEditMode(parsed.modal.kind === 'user-edit' && isAdmin);
        setSelectedUserForDetail(found);
      }
    }
  }, [users, isAdmin, setSelectedUserForDetail]);

  // QUICK SHEET PASTE STATE
  const [sheetColumns, setSheetColumns] = useState<SheetColumnItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_SHEET_COLS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_SHEET_COLUMNS;
  });
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);
  
  // ADD COLUMN MODAL STATE
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColKey, setNewColKey] = useState<SheetFieldKey>('skip');

  // EDIT COLUMN MODAL STATE
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColKey, setEditColKey] = useState<SheetFieldKey>('skip');

  const [quickPasteInput, setQuickPasteInput] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState<{
    type: 'create' | 'update' | 'error';
    message: string;
    userAccount?: string;
    userName?: string;
  } | null>(null);
  const [multiParsedList, setMultiParsedList] = useState<{
    member: ParsedSheetMember;
    existingUser?: User;
  }[]>([]);
  const [selectedMultiIdx, setSelectedMultiIdx] = useState<number>(0);
  const [showColumnGuide, setShowColumnGuide] = useState(true);

  // BATCH IMPORT MODAL STATE
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [batchSelectedIndices, setBatchSelectedIndices] = useState<Set<number>>(new Set());
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [batchFilterTab, setBatchFilterTab] = useState<'ALL' | 'NEW' | 'UPDATE'>('ALL');

  const checkBatchImportDirtyAndConfirmClose = () => {
    if (multiParsedList.length > 0 && !isImportingBatch) {
      confirmDialog({
        title: 'Đóng xem trước nhập dữ liệu',
        message: 'Bạn có danh sách nhân sự đã trích xuất từ Sheet chưa được nhập vào hệ thống. Bạn có chắc chắn muốn hủy và đóng không?',
        confirmText: 'Đóng & Hủy',
        cancelText: 'Tiếp tục xem',
        type: 'warning',
        onConfirm: () => setIsBatchImportModalOpen(false),
      });
      return false;
    }
    return true;
  };

  const handleCloseBatchImportModal = () => {
    if (checkBatchImportDirtyAndConfirmClose()) {
      setIsBatchImportModalOpen(false);
    }
  };

  // Column management methods
  const saveColumns = (newCols: SheetColumnItem[]) => {
    setSheetColumns(newCols);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_SHEET_COLS, JSON.stringify(newCols));
      } catch {}
    }
  };

  const handleReorderColumns = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= sheetColumns.length || toIdx >= sheetColumns.length) return;
    const next = [...sheetColumns];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    saveColumns(next);
  };

  const handleOpenAddColumn = () => {
    setNewColName('');
    setNewColKey('skip');
    setIsAddColumnOpen(true);
  };

  const handleConfirmAddColumn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const defaultLabel = AVAILABLE_SHEET_FIELDS.find((f) => f.key === newColKey)?.defaultName || 'Cột mới';
    const label = newColName.trim() || defaultLabel;
    const newCol: SheetColumnItem = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: newColKey,
      label,
    };
    const next = [...sheetColumns, newCol];
    saveColumns(next);
    setIsAddColumnOpen(false);
    setNewColName('');
    setNewColKey('skip');
  };

  const handleOpenEditColumn = (idx: number) => {
    const col = sheetColumns[idx];
    if (!col) return;
    setEditingColIdx(idx);
    setEditColName(col.label);
    setEditColKey(col.key);
  };

  const handleConfirmEditColumn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingColIdx === null) return;
    const defaultLabel = AVAILABLE_SHEET_FIELDS.find((f) => f.key === editColKey)?.defaultName || 'Cột';
    const label = editColName.trim() || defaultLabel;
    const next = [...sheetColumns];
    next[editingColIdx] = {
      ...next[editingColIdx],
      label,
      key: editColKey,
    };
    saveColumns(next);
    setEditingColIdx(null);
  };

  const handleRemoveColumn = (idx: number) => {
    if (sheetColumns.length <= 1) return;
    const next = sheetColumns.filter((_, i) => i !== idx);
    saveColumns(next);
    if (editingColIdx === idx) {
      setEditingColIdx(null);
    }
  };

  const handleResetColumns = () => {
    saveColumns(DEFAULT_SHEET_COLUMNS);
  };

  // ROLE FORM STATE
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleColor, setRoleColor] = useState('purple');
  const [roleError, setRoleError] = useState('');

  // QUICK PASTE & SHEET PARSING LOGIC
  const applyParsedMember = (parsed: ParsedSheetMember) => {
    const cleanAccount = parsed.account.toLowerCase();
    const existingUser = users.find(
      (u) =>
        (cleanAccount && u.account.toLowerCase() === cleanAccount) ||
        (parsed.email && u.email && u.email.toLowerCase() === parsed.email.toLowerCase()) ||
        (parsed.phone && u.phone && u.phone === parsed.phone) ||
        (parsed.cccd && u.cccd && u.cccd === parsed.cccd)
    );

    setUserName(parsed.name || (existingUser?.name ?? ''));
    setUserAccount(parsed.account || (existingUser?.account ?? ''));
    setUserRole(parsed.role);
    setSelectedSpecs(parsed.specializations);
    const initialSpecRoles: Record<Specialization, UserRole> = existingUser?.specializationRoles
      ? { ...existingUser.specializationRoles }
      : {};
    parsed.specializations.forEach((s) => {
      if (!initialSpecRoles[s]) {
        initialSpecRoles[s] = parsed.role === 'Admin' ? 'Member' : parsed.role;
      }
    });
    setSpecRoles(initialSpecRoles);
    setUserCccd(parsed.cccd || (existingUser?.cccd ?? ''));
    setUserBankAccount(parsed.bankAccount || (existingUser?.bankAccount ?? ''));
    setUserEmail(parsed.email || (existingUser?.email ?? ''));
    setUserPhone(parsed.phone || (existingUser?.phone ?? ''));
    setUserTechnologies(parsed.technologies || (existingUser?.technologies ?? ''));
    setUserBirthDate(parsed.birthDate || (existingUser?.birthDate ? String(existingUser.birthDate) : ''));

    if (existingUser) {
      setEditingUserId(existingUser.id);
      setPasteFeedback({
        type: 'update',
        message: `Đã tìm thấy nhân viên @${existingUser.account} (${existingUser.name}) trong hệ thống! Đã tự động điền thông tin mới từ Sheet và chuyển sang chế độ CẬP NHẬT.`,
        userAccount: existingUser.account,
        userName: existingUser.name,
      });
    } else {
      setEditingUserId(null);
      setPasteFeedback({
        type: 'create',
        message: `Đã tự động trích xuất thông tin nhân viên mới @${parsed.account || 'mới'} (${parsed.name}). Sẵn sàng TẠO MỚI!`,
        userAccount: parsed.account,
        userName: parsed.name,
      });
    }
  };

  const handleProcessSheetData = (rawPastedText: string) => {
    if (!rawPastedText || !rawPastedText.trim()) return;

    const lines = rawPastedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    // Filter out header line if present
    const dataLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      return !(
        (lower.includes('full name') || lower.includes('họ & tên') || lower.includes('họ và tên') || lower.includes('tên hiển thị')) &&
        (lower.includes('staff code') || lower.includes('cccd') || lower.includes('gmail') || lower.includes('tk bank'))
      );
    });

    const parsedMembers: { member: ParsedSheetMember; existingUser?: User }[] = [];

    dataLines.forEach((line) => {
      const parsed = parseSheetRowWithColumns(line, sheetColumns, roles);
      if (parsed) {
        const cleanAcc = parsed.account.toLowerCase();
        const existing = users.find(
          (u) =>
            (cleanAcc && u.account.toLowerCase() === cleanAcc) ||
            (parsed.email && u.email && u.email.toLowerCase() === parsed.email.toLowerCase()) ||
            (parsed.phone && u.phone && u.phone === parsed.phone) ||
            (parsed.cccd && u.cccd && u.cccd === parsed.cccd)
        );
        parsedMembers.push({ member: parsed, existingUser: existing });
      }
    });

    if (parsedMembers.length === 0) {
      setPasteFeedback({
        type: 'error',
        message: 'Không thể nhận diện định dạng dữ liệu từ Sheet. Vui lòng kiểm tra lại dòng dữ liệu đã sao chép.',
      });
      return;
    }

    setMultiParsedList(parsedMembers);
    setSelectedMultiIdx(0);

    if (parsedMembers.length > 1) {
      setBatchSelectedIndices(new Set(parsedMembers.map((_, i) => i)));
      setIsBatchImportModalOpen(true);
      applyParsedMember(parsedMembers[0].member);
      setQuickPasteInput('');
      const newCount = parsedMembers.filter((x) => !x.existingUser).length;
      const updateCount = parsedMembers.filter((x) => !!x.existingUser).length;
      setPasteFeedback({
        type: 'create',
        message: `Đã nhận diện ${parsedMembers.length} nhân sự (${newCount} tạo mới, ${updateCount} cập nhật). Bảng nhập hàng loạt đã được mở!`,
      });
    } else {
      applyParsedMember(parsedMembers[0].member);
      setQuickPasteInput('');
    }
  };

  const handleExecuteBatchImport = async () => {
    if (batchSelectedIndices.size === 0) return;
    setIsImportingBatch(true);
    try {
      const selectedItems = multiParsedList
        .filter((_, idx) => batchSelectedIndices.has(idx))
        .map((item) => ({
          member: item.member,
          existingUserId: item.existingUser?.id,
        }));

      const res = await batchImportUsers(selectedItems);

      setIsBatchImportModalOpen(false);
      setMultiParsedList([]);
      setIsUserFormOpen(false);

      if (res.newCredentials.length > 0) {
        setBatchCredModal({
          newlyGeneratedCount: res.createdCount,
          results: res.newCredentials,
        });
        setPasteFeedback({
          type: 'create',
          message: `🎉 Nhập thành công ${selectedItems.length} nhân sự (${res.createdCount} tạo mới, ${res.updatedCount} cập nhật)! Đã mở danh sách mật khẩu tạm thời.`,
        });
      } else {
        setPasteFeedback({
          type: 'update',
          message: `🎉 Đã cập nhật thông tin thành công cho ${res.updatedCount} nhân sự từ Sheet!`,
        });
      }
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra khi nhập hàng loạt dữ liệu.');
    } finally {
      setIsImportingBatch(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleProcessSheetData(text);
      }
    } catch {
      const el = document.getElementById('sheet-quick-paste-input');
      if (el) el.focus();
    }
  };

  // USER ACTIONS
  const handleUserRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    if (newRole !== 'Admin') {
      const updated: Record<Specialization, UserRole> = { ...specRoles };
      selectedSpecs.forEach((s) => {
        updated[s] = newRole;
      });
      setSpecRoles(updated);
    }
  };

  const handleSpecRoleChange = (specCode: Specialization, newRole: UserRole) => {
    const updated: Record<Specialization, UserRole> = { ...specRoles, [specCode]: newRole };
    setSpecRoles(updated);
    if (userRole !== 'Admin') {
      const highest = calculateHighestRole(updated, newRole);
      setUserRole(highest);
    }
  };

  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserAccount('');
    setUserRole('Member');
    const defaultSpec = roles[0]?.code || 'BA';
    setSelectedSpecs([defaultSpec]);
    setSpecRoles({ [defaultSpec]: 'Member' });
    setUserCccd('');
    setUserBankAccount('');
    setUserEmail('');
    setUserPhone('');
    setUserTechnologies('');
    setUserBirthDate('');
    setSendWelcomeEmail(true);
    setQuickPasteInput('');
    setPasteFeedback(null);
    setMultiParsedList([]);
    setSelectedMultiIdx(0);
    setShowColumnGuide(false);
    setIsUserFormOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserAccount(user.account);
    setUserRole(user.role);
    const initialSpecs = user.specializations && user.specializations.length > 0 ? user.specializations : ['BA'];
    setSelectedSpecs(initialSpecs);
    const initialSpecRoles: Record<Specialization, UserRole> = user.specializationRoles
      ? { ...user.specializationRoles }
      : {};
    initialSpecs.forEach((s) => {
      if (!initialSpecRoles[s]) {
        initialSpecRoles[s] = user.role === 'Admin' ? 'Member' : user.role || 'Member';
      }
    });
    setSpecRoles(initialSpecRoles);
    setUserCccd(user.cccd || '');
    setUserBankAccount(user.bankAccount || '');
    setUserEmail(user.email || '');
    setUserPhone(user.phone || '');
    setUserTechnologies(user.technologies || '');
    setUserBirthDate(user.birthDate ? String(user.birthDate) : '');
    setQuickPasteInput('');
    setPasteFeedback(null);
    setMultiParsedList([]);
    setSelectedMultiIdx(0);
    setShowColumnGuide(false);
    setIsUserFormOpen(true);
  };

  const toggleSpec = (spec: Specialization) => {
    if (selectedSpecs.includes(spec)) {
      if (selectedSpecs.length === 1) return;
      const nextSpecs = selectedSpecs.filter((s) => s !== spec);
      setSelectedSpecs(nextSpecs);
      const nextSpecRoles = { ...specRoles };
      delete nextSpecRoles[spec];
      setSpecRoles(nextSpecRoles);
      if (userRole !== 'Admin') {
        setUserRole(calculateHighestRole(nextSpecRoles, 'Member'));
      }
    } else {
      const nextSpecs = [...selectedSpecs, spec];
      setSelectedSpecs(nextSpecs);
      const nextSpecRoles = {
        ...specRoles,
        [spec]: userRole === 'Admin' ? 'Member' : userRole || 'Member',
      };
      setSpecRoles(nextSpecRoles);
      if (userRole !== 'Admin') {
        setUserRole(calculateHighestRole(nextSpecRoles, userRole));
      }
    }
  };

  const triggerWelcomeEmail = async (emailPayload: WelcomeEmailRequest) => {
    setTempCredModal((prev) =>
      prev && prev.account === emailPayload.account && prev.tempPassword === emailPayload.tempPassword
        ? {
            ...prev,
            emailStatus: 'sending',
            emailMessage: `Đang gửi thông tin tài khoản tới ${emailPayload.email}...`,
          }
        : prev
    );

    try {
      const siteUrl =
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
          ? window.location.origin
          : undefined;

      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emailPayload, siteUrl }),
      });
      const data = await response.json().catch(() => null);

      setTempCredModal((prev) => {
        if (!prev || prev.account !== emailPayload.account || prev.tempPassword !== emailPayload.tempPassword) {
          return prev;
        }
        if (response.ok && data?.success) {
          sahoToast.success('Đã gửi Email kích hoạt', `Email thông tin tài khoản đã được gửi tới ${emailPayload.email}.`);
          return {
            ...prev,
            emailStatus: 'sent',
            emailMessage: `Đã gửi email thông tin tài khoản & hồ sơ cá nhân tới ${emailPayload.email}.`,
          };
        }
        sahoToast.warning('Chưa gửi được Email', data?.error || 'Bạn vẫn có thể sao chép mật khẩu tạm cho thành viên.');
        return {
          ...prev,
          emailStatus: 'failed',
          emailMessage:
            data?.error || 'Không thể gửi email thông báo. Bạn vẫn có thể sao chép thông tin bên dưới.',
        };
      });
    } catch {
      setTempCredModal((prev) =>
        prev && prev.account === emailPayload.account && prev.tempPassword === emailPayload.tempPassword
          ? {
              ...prev,
              emailStatus: 'failed',
              emailMessage: 'Lỗi kết nối khi gửi email. Vui lòng thử lại hoặc sao chép thông tin bên dưới.',
            }
          : prev
      );
    }
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userAccount.trim() || isCreatingUser) return;

    // Validate Role Level Quotas per specialization
    const quotaCheck = validateRoleQuota(userRole, selectedSpecs, users, editingUserId || undefined, specRoles);
    if (!quotaCheck.valid && quotaCheck.error) {
      confirmDialog({
        title: 'Cảnh báo định mức vai trò (Role Quota)',
        message: quotaCheck.error,
        confirmText: 'Đã hiểu & Điều chỉnh',
        type: 'warning',
        cancelText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }

    const effectiveRole = userRole === 'Admin' ? 'Admin' : calculateHighestRole(specRoles, userRole);

    const payload = {
      name: userName.trim(),
      account: userAccount.trim(),
      role: effectiveRole,
      specializations: selectedSpecs,
      specializationRoles: specRoles,
      cccd: userCccd.trim(),
      bankAccount: userBankAccount.trim(),
      email: userEmail.trim(),
      phone: userPhone.trim(),
      technologies: userTechnologies.trim(),
      birthDate: userBirthDate.trim(),
    };

    if (editingUserId) {
      updateUser(editingUserId, payload);
      setIsUserFormOpen(false);
    } else {
      setIsCreatingUser(true);
      try {
        const res = await addUser(payload);
        if (res?.tempPassword) {
          const trimmedEmail = payload.email.trim();
          const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
          const specializationNames: Record<string, string> = {};
          payload.specializations.forEach((specCode) => {
            const matchedRole = roles.find(
              (r) => r.code.trim().toLowerCase() === specCode.trim().toLowerCase()
            );
            specializationNames[specCode] = matchedRole?.name?.trim() || specCode;
          });
          const emailPayload: WelcomeEmailRequest | undefined = hasValidEmail
            ? {
                name: res.user.name,
                account: res.user.account,
                tempPassword: res.tempPassword,
                email: trimmedEmail,
                role: payload.role,
                specializations: payload.specializations,
                specializationRoles: payload.specializationRoles,
                specializationNames,
                cccd: payload.cccd,
                bankAccount: payload.bankAccount,
                phone: payload.phone,
                technologies: payload.technologies,
                birthDate: payload.birthDate,
              }
            : undefined;

          const shouldSend = sendWelcomeEmail && Boolean(emailPayload);

          setTempCredModal({
            title: 'Tạo Tài Khoản Thành Công',
            subtitle:
              'Hệ thống đã tự động tạo mật khẩu tạm thời cho nhân viên mới. Hãy kiểm tra trạng thái gửi email hoặc sao chép thông tin để gửi cho nhân viên đăng nhập lần đầu.',
            name: res.user.name,
            account: res.user.account,
            tempPassword: res.tempPassword,
            email: trimmedEmail || undefined,
            emailStatus: shouldSend ? 'sending' : emailPayload ? 'skipped' : 'no_email',
            emailMessage: shouldSend
              ? `Đang gửi thông tin tài khoản tới ${trimmedEmail}...`
              : emailPayload
              ? `Đã tạo tài khoản (chưa gửi mail tới ${trimmedEmail} vì bạn đang tắt tự động gửi email).`
              : 'Chưa nhập địa chỉ email hợp lệ nên hệ thống chưa gửi mail tự động.',
            emailPayload,
          });

          setIsUserFormOpen(false);
          if (shouldSend && emailPayload) {
            void triggerWelcomeEmail(emailPayload);
          }
          return;
        }
        setIsUserFormOpen(false);
      } finally {
        setIsCreatingUser(false);
      }
    }
  };

  const checkUserDirtyAndConfirmClose = useCallback((): boolean => {
    let isDirty = false;
    if (editingUserId) {
      const orig = users.find((u) => u.id === editingUserId);
      if (orig) {
        isDirty =
          userName.trim() !== orig.name ||
          userAccount.trim() !== orig.account ||
          userRole !== orig.role ||
          userCccd.trim() !== (orig.cccd || '') ||
          userBankAccount.trim() !== (orig.bankAccount || '') ||
          userEmail.trim() !== (orig.email || '') ||
          userPhone.trim() !== (orig.phone || '') ||
          userTechnologies.trim() !== (orig.technologies || '') ||
          userBirthDate.trim() !== (orig.birthDate ? String(orig.birthDate) : '') ||
          JSON.stringify(selectedSpecs) !== JSON.stringify(orig.specializations || ['BA']);
      }
    } else {
      isDirty =
        userName.trim() !== '' ||
        userAccount.trim() !== '' ||
        userCccd.trim() !== '' ||
        userBankAccount.trim() !== '' ||
        userEmail.trim() !== '' ||
        userPhone.trim() !== '' ||
        userTechnologies.trim() !== '' ||
        userBirthDate.trim() !== '';
    }

    if (isDirty) {
      confirmDialog({
        title: 'Thông tin nhân viên chưa được lưu',
        message: 'Bạn đang nhập dở thông tin thành viên. Bạn có chắc chắn muốn hủy và thoát không? Mọi thông tin vừa nhập sẽ bị mất.',
        confirmText: 'Rời khỏi & Hủy',
        cancelText: 'Tiếp tục điền',
        type: 'warning',
        onConfirm: () => {
          setIsUserFormOpen(false);
        },
      });
      return false;
    }
    return true;
  }, [
    editingUserId,
    users,
    userName,
    userAccount,
    userRole,
    userCccd,
    userBankAccount,
    userEmail,
    userPhone,
    userTechnologies,
    userBirthDate,
    selectedSpecs,
    confirmDialog,
  ]);

  const handleCloseUserForm = () => {
    if (checkUserDirtyAndConfirmClose()) {
      setIsUserFormOpen(false);
    }
  };

  const [isLockedUsersModalOpen, setIsLockedUsersModalOpen] = useState(false);
  const [lockedUsersSearchQuery, setLockedUsersSearchQuery] = useState('');

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

  const checkRoleDirtyAndConfirmClose = useCallback((): boolean => {
    let isDirty = false;
    if (editingRoleId) {
      const orig = roles.find((r) => r.id === editingRoleId);
      if (orig) {
        isDirty =
          roleCode.trim().toUpperCase() !== orig.code.toUpperCase() ||
          roleName.trim() !== orig.name ||
          roleDesc.trim() !== (orig.description || '') ||
          roleColor !== (orig.color || 'purple');
      }
    } else {
      isDirty =
        roleCode.trim() !== '' ||
        roleName.trim() !== '' ||
        roleDesc.trim() !== '';
    }

    if (isDirty) {
      confirmDialog({
        title: 'Thông tin Role chưa được lưu',
        message: 'Bạn đang nhập dở thông tin vai trò / chuyên môn. Bạn có chắc chắn muốn hủy và thoát không? Mọi thông tin vừa nhập sẽ bị mất.',
        confirmText: 'Rời khỏi & Hủy',
        cancelText: 'Tiếp tục điền',
        type: 'warning',
        onConfirm: () => {
          setIsRoleFormOpen(false);
        },
      });
      return false;
    }
    return true;
  }, [editingRoleId, roles, roleCode, roleName, roleDesc, roleColor, confirmDialog]);

  const handleCloseRoleModal = () => {
    if (checkRoleDirtyAndConfirmClose()) {
      setIsRoleFormOpen(false);
    }
  };

  const checkAddColDirtyAndConfirmClose = useCallback((): boolean => {
    if (newColName.trim() !== '') {
      confirmDialog({
        title: 'Cột mới chưa được lưu',
        message: 'Bạn đang nhập dở tên cột mới. Bạn có chắc chắn muốn hủy và đóng không?',
        confirmText: 'Rời khỏi & Hủy',
        cancelText: 'Tiếp tục điền',
        type: 'warning',
        onConfirm: () => setIsAddColumnOpen(false),
      });
      return false;
    }
    return true;
  }, [newColName, confirmDialog]);

  const checkEditColDirtyAndConfirmClose = useCallback((): boolean => {
    if (editingColIdx !== null) {
      const orig = sheetColumns[editingColIdx];
      if (orig && (editColName.trim() !== orig.label || editColKey !== orig.key)) {
        confirmDialog({
          title: 'Thay đổi cột chưa được lưu',
          message: 'Bạn đang chỉnh sửa cấu hình cột dở dang. Bạn có chắc chắn muốn hủy không?',
          confirmText: 'Rời khỏi & Hủy',
          cancelText: 'Tiếp tục sửa',
          type: 'warning',
          onConfirm: () => setEditingColIdx(null),
        });
        return false;
      }
    }
    return true;
  }, [editingColIdx, sheetColumns, editColName, editColKey, confirmDialog]);

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

    const usersWithRole = users.filter((u) => !u.disabled && u.status !== 'disabled' && u.specializations?.includes(roleItem.code));
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

  // Drag & drop role ordering state and handler
  const [draggedRoleId, setDraggedRoleId] = useState<string | null>(null);
  const [dragOverRoleId, setDragOverRoleId] = useState<string | null>(null);

  const handleReorderRoles = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceIdx = roles.findIndex((r) => r.id === sourceId);
    const targetIdx = roles.findIndex((r) => r.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;

    const newRoles = [...roles];
    const [moved] = newRoles.splice(sourceIdx, 1);
    newRoles.splice(targetIdx, 0, moved);

    reorderRoles(newRoles);
  };

  return (
    <div className="space-y-6">
      {/* Section Header Banner (Sub-tabs are placed in the Sidebar under "Hệ Thống") */}
      <div className="saho-hero-card border border-[#E8E9EF] dark:border-slate-800 rounded-[12px] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-bold text-[#1D202A] dark:text-slate-100 tracking-tight flex items-center gap-2">
                {activeSubTab === 'ROLES' && isAdmin ? (
                  <>
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#1890FF]" />
                    <span>Danh Mục Role & Chuyên Môn ({roles.length})</span>
                  </>
                ) : activeSubTab === 'PERMISSIONS' && isAdmin ? (
                  <>
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#1890FF]" />
                    <span>Phân Quyền Hệ Thống</span>
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#1890FF]" />
                    <span>Danh Sách Thành Viên ({users.length})</span>
                  </>
                )}
              </h2>
              {isAdmin ? (
                <>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-[12px] bg-[rgba(179,127,235,0.16)] text-[#9254DE]">
                    Admin Only
                  </span>
                  {activeSubTab === 'PERMISSIONS' && permState.isDirty && (
                    <span className="px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(255,77,79,0.16)] text-[#FF4D4F] animate-pulse">
                      Có thay đổi chưa lưu
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-[12px] bg-[rgba(24,144,255,0.14)] text-[#1890FF]">
                  {users.filter((u) => !u.disabled && u.status !== 'disabled').length} thành viên
                </span>
              )}
            </div>
            <p className="text-xs text-[#838899] dark:text-slate-400 mt-1">
              {activeSubTab === 'ROLES' && isAdmin
                ? 'Quản lý danh mục các Role/Chuyên môn, mô tả và thứ tự hiển thị trên toàn hệ thống.'
                : activeSubTab === 'PERMISSIONS' && isAdmin
                ? 'Cấu hình quyền truy cập chức năng theo từng Vai trò (Role) và tùy biến quyền riêng cho từng Thành viên.'
                : isAdmin
                ? 'Admin tạo, sửa, khóa tài khoản thành viên và cấp mật khẩu khởi tạo trong toàn hệ thống.'
                : 'Xem danh sách thành viên, vai trò (role), level và kỹ năng chuyên môn của các nhân sự trong dự án.'}
            </p>
          </div>

          {isAdmin && (
            <div className="shrink-0 flex items-center gap-2 flex-wrap">
              {activeSubTab === 'PERMISSIONS' ? (
                <>
                  <button
                    type="button"
                    disabled={permState.isSaving}
                    onClick={() => permActionsRef.current?.resetToDefaults()}
                    className="flex items-center gap-1.5 h-[34px] px-3 text-xs font-medium text-[#1D202A] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-[#F8FAFB] dark:hover:bg-slate-700 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="Khôi phục ma trận phân quyền về chuẩn mặc định"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Mặc Định Chuẩn</span>
                  </button>

                  <button
                    type="button"
                    disabled={permState.isSaving || !permState.isDirty}
                    onClick={() => permActionsRef.current?.save()}
                    className={`flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-xs font-medium transition-all active:scale-95 ${
                      permState.isDirty
                        ? 'bg-[#1890FF] hover:bg-[#40A9FF] text-white shadow-[0_2px_8px_rgba(24,144,255,0.28)] cursor-pointer'
                        : 'bg-[#E8E9EF] dark:bg-slate-800 text-[#A2A6B4] cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{permState.isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                  </button>
                </>
              ) : activeSubTab === 'USERS' ? (
                <>
                  <button
                    onClick={handleBatchReset}
                    className="flex items-center gap-1.5 h-[34px] px-3.5 bg-white dark:bg-slate-900 hover:bg-[rgba(255,169,64,0.12)] text-[#D46B08] border border-[#FFA940]/50 text-xs font-medium rounded-[8px] transition shrink-0 active:scale-95 cursor-pointer"
                    title={
                      needNewTempUsers.length > 0
                        ? `Cấp mật khẩu tạm cho ${needNewTempUsers.length} người mới chưa có (giữ nguyên người đã có)`
                        : `Xem danh sách mật khẩu tạm của ${pendingFirstLoginUsers.length} người đang chờ kích hoạt`
                    }
                  >
                    <KeyRound className="w-4 h-4 text-[#FF7A45]" />
                    <span className="sm:hidden">
                      {needNewTempUsers.length > 0 ? `Cấp MK (${needNewTempUsers.length})` : `DS MK (${pendingFirstLoginUsers.length})`}
                    </span>
                    <span className="hidden sm:inline">
                      {needNewTempUsers.length > 0
                        ? `Cấp MK Tạm Cho Người Mới (${needNewTempUsers.length})`
                        : `DS Mật Khẩu Tạm (${pendingFirstLoginUsers.length})`}
                    </span>
                  </button>

                  <button
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-2 h-[34px] px-4 bg-[#1890FF] hover:bg-[#40A9FF] text-white text-xs font-medium rounded-[8px] shadow-[0_2px_8px_rgba(24,144,255,0.28)] transition shrink-0 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="sm:hidden">Thêm TK</span>
                    <span className="hidden sm:inline">Tạo Tài Khoản Mới</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOpenAddRole}
                  className="flex items-center gap-2 h-[34px] px-4 bg-[#1890FF] hover:bg-[#40A9FF] text-white text-xs font-medium rounded-[8px] shadow-[0_2px_8px_rgba(24,144,255,0.28)] transition shrink-0 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Thêm Role</span>
                  <span className="hidden sm:inline">Thêm Role Mới</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: USERS MANAGEMENT                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 rounded-[12px] overflow-hidden p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E9EF] dark:border-slate-800 pb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1D202A] dark:text-slate-100">
                  {isAdmin
                    ? `Danh Sách Nhân Viên (${users.filter((u) => !u.disabled && u.status !== 'disabled').length} nhân sự hoạt động)`
                    : `Danh Sách Nhân Sự Dự Án (${users.filter((u) => !u.disabled && u.status !== 'disabled').length} thành viên)`}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && users.some((u) => u.disabled || u.status === 'disabled') && (
                  <button
                    onClick={() => {
                      setLockedUsersSearchQuery('');
                      setIsLockedUsersModalOpen(true);
                    }}
                    className="h-[32px] text-xs px-3 rounded-[8px] border border-[#FF4D4F]/30 bg-[rgba(255,77,79,0.08)] text-[#FF4D4F] hover:bg-[rgba(255,77,79,0.16)] transition flex items-center gap-1.5 font-medium cursor-pointer"
                    title="Xem danh sách tài khoản đã khóa trong DB"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#FF4D4F]" />
                    <span>Tài khoản đã khóa ({users.filter((u) => u.disabled || u.status === 'disabled').length})</span>
                  </button>
                )}

                {/* Search Bar Input */}
                <div className="relative min-w-[200px] sm:w-64">
                  <Search className="w-4 h-4 text-[#838899] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tên, staff code, email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full h-[32px] bg-[#F8FAFB] dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] pl-9 pr-8 text-xs text-[#1D202A] dark:text-slate-100 font-medium placeholder:text-[#838899] focus:outline-none focus:border-[#1890FF] focus:bg-white focus:shadow-[0_0_0_3px_#E6F7FF] transition"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A2A6B4] hover:text-[#1D202A] p-0.5 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto rounded-[8px] border border-[#E8E9EF] dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="h-[40px] bg-[rgba(73,82,106,0.03)] dark:bg-slate-800/80 text-[#838899] font-semibold uppercase tracking-wide border-b border-[#E8E9EF] dark:border-slate-700 text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">STT</th>

                    {/* STAFF CODE Header */}
                    <th
                      onClick={() => handleSort('account')}
                      className="py-3 px-3 cursor-pointer select-none hover:text-[#1890FF] transition group"
                      title="Bấm để sắp xếp theo Staff Code (A-Z / Z-A)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>STAFF CODE (USERNAME)</span>
                        {sortField === 'account' ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#1890FF] shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#1890FF] shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#A2A6B4] opacity-60 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* FULL NAME Header */}
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-[#1890FF] transition group"
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
                    {isAdmin && <th className="py-3 px-3 text-right">THAO TÁC</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {users
                    .filter((u) => {
                      if (u.disabled || u.status === 'disabled') return false;

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
                                className={`hover:underline font-bold focus:outline-none ${getUserRoleColorClass(u.role)}`}
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
                              className={`text-left font-bold hover:underline transition focus:outline-none ${getUserRoleColorClass(u.role)}`}
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
                                const sRole = getUserRoleInSpec(u, s);
                                const isL = sRole === 'Leader';
                                const isA = sRole === 'Advisor';
                                return (
                                  <span
                                    key={s}
                                    className={`px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border} font-bold text-[10px] inline-flex items-center gap-1 font-mono`}
                                    title={`Nghiệp vụ ${s}: ${sRole}`}
                                  >
                                    <span>{s}</span>
                                    {u.role !== 'Admin' && (
                                      <span className="text-[9px] font-normal opacity-85">
                                        • {isL ? '👑 Leader' : isA ? '🎖️ Advisor' : '👥 Member'}
                                      </span>
                                    )}
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
                          {isAdmin && (
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!isDisabled && (
                                  <button
                                    onClick={() => handleResetPassword(u)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 rounded-lg transition cursor-pointer"
                                    title="Đặt lại mật khẩu (Tạo mật khẩu tạm mới)"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isDisabled ? (
                                  <button
                                    onClick={() => handleRestoreUser(u)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-lg transition cursor-pointer"
                                    title="Kích hoạt / Khôi phục tài khoản"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded-lg transition cursor-pointer"
                                    title="Vô hiệu hóa tài khoản"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden p-3 space-y-3">
              {users
                .filter((u) => {
                  if (u.disabled || u.status === 'disabled') return false;

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
                .map((u) => {
                  const isDisabled = u.disabled || u.status === 'disabled';
                  return (
                    <div
                      key={`mobile-user-${u.id}`}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                        isDisabled ? 'bg-slate-50 opacity-75 border-slate-200' : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={u} size="sm" />
                          <div>
                            <button
                              onClick={() => setSelectedUserForDetail(u)}
                              className={`font-bold text-xs text-left block leading-tight cursor-pointer hover:underline ${getUserRoleColorClass(u.role)}`}
                            >
                              {u.name}
                            </button>
                            <span className={`font-mono text-[11px] font-bold ${getUserRoleColorClass(u.role)}`}>
                              @{u.account}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
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
                      </div>

                      {/* Specializations & Tech */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(u.specializations || ['BA']).map((s) => {
                          const rObj = roles.find((r) => r.code === s);
                          const style = getRoleStyle(rObj?.color);
                          const sRole = getUserRoleInSpec(u, s);
                          const isL = sRole === 'Leader';
                          const isA = sRole === 'Advisor';
                          return (
                            <span
                              key={s}
                              className={`px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border} font-bold text-[10px] inline-flex items-center gap-1`}
                              title={`Nghiệp vụ ${s}: ${sRole}`}
                            >
                              <span>{s}</span>
                              {u.role !== 'Admin' && (
                                <span className="text-[9px] font-normal opacity-85">
                                  • {isL ? '👑 Leader' : isA ? '🎖️ Advisor' : '👥 Member'}
                                </span>
                              )}
                            </span>
                          );
                        })}
                        {u.technologies && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {u.technologies}
                          </span>
                        )}
                      </div>

                      {/* Contact Info & Actions */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 gap-2">
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.email || u.phone || 'Chưa cập nhật liên hệ'}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedUserForDetail(u)}
                            className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 text-[11px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
                          >
                            {isAdmin ? 'Quản lý' : 'Chi tiết'}
                          </button>
                          {isAdmin && (
                            <>
                              {!isDisabled && (
                                <button
                                  onClick={() => handleResetPassword(u)}
                                  className="p-1.5 bg-amber-50 text-amber-600 rounded-lg active:scale-95 cursor-pointer"
                                  title="Đặt lại mật khẩu"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isDisabled ? (
                                <button
                                  onClick={() => handleRestoreUser(u)}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg active:scale-95 cursor-pointer"
                                  title="Khôi phục tài khoản"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 bg-red-50 text-red-500 rounded-lg active:scale-95 cursor-pointer"
                                  title="Vô hiệu hóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ROLES & SPECIALIZATION MANAGEMENT                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'ROLES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Roles Table */}
          <div className="bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 rounded-[12px] overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E9EF] dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1D202A] dark:text-slate-100">
                  Danh Mục Role & Chuyên Môn Dự Án ({roles.length} role)
                </h3>
                <p className="text-xs text-[#838899] mt-0.5">
                  {isAdmin
                    ? 'Kéo thả (drag & drop) các dòng từ trên xuống dưới để sắp xếp thứ tự hiển thị của các role trên toàn bộ hệ thống.'
                    : 'Các role dùng để phân nhóm công việc, giao task và theo dõi cột mốc milestone.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[8px] border border-[#E8E9EF] dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="h-[40px] bg-[rgba(73,82,106,0.03)] dark:bg-slate-800/80 text-[#838899] text-[11px] font-semibold uppercase tracking-wide border-b border-[#E8E9EF] dark:border-slate-700">
                    {isAdmin && <th className="py-3 px-2 w-10 text-center">#</th>}
                    <th className="py-3 px-4">Mã Role</th>
                    <th className="py-3 px-4">Tên Hiển Thị & Mô Tả</th>
                    <th className="py-3 px-3">Thành Viên Đảm Nhận</th>
                    <th className="py-3 px-3 text-center">Tổng Task</th>
                    <th className="py-3 px-4 text-right">Thao Tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {roles.map((r) => {
                    const isDragging = draggedRoleId === r.id;
                    const isOver = dragOverRoleId === r.id;
                    const style = getRoleStyle(r.color);
                    const members = users.filter((u) => !u.disabled && u.status !== 'disabled' && u.specializations?.includes(r.code));
                    const roleTasks = tasks.filter((t) => t.role === r.code);

                    return (
                      <tr
                        key={r.id}
                        draggable={isAdmin}
                        onDragStart={(e) => {
                          if (!isAdmin) return;
                          e.dataTransfer.setData('text/plain', r.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedRoleId(r.id);
                        }}
                        onDragOver={(e) => {
                          if (!isAdmin) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverRoleId !== r.id && draggedRoleId !== r.id) {
                            setDragOverRoleId(r.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverRoleId === r.id) setDragOverRoleId(null);
                        }}
                        onDrop={(e) => {
                          if (!isAdmin) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const sourceId = e.dataTransfer.getData('text/plain') || draggedRoleId;
                          setDragOverRoleId(null);
                          setDraggedRoleId(null);
                          if (sourceId && sourceId !== r.id) {
                            handleReorderRoles(sourceId, r.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedRoleId(null);
                          setDragOverRoleId(null);
                        }}
                        className={`transition select-none ${
                          isDragging
                            ? 'opacity-30 bg-indigo-50/50'
                            : isOver
                            ? 'border-t-2 border-indigo-600 bg-indigo-50/60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {isAdmin && (
                          <td className="py-3 px-2 text-center text-slate-400">
                            <div
                              className="flex items-center justify-center cursor-grab active:cursor-grabbing hover:text-indigo-600 transition p-1"
                              title="Kéo thả để sắp xếp thứ tự Role"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                          </td>
                        )}
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
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-400 italic">
                        Chưa có role nào được định nghĩa
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DANH SÁCH TÀI KHOẢN ĐÃ KHÓA */}
      <Modal
        isOpen={isLockedUsersModalOpen}
        onClose={() => setIsLockedUsersModalOpen(false)}
        size="full"
        className="max-w-4xl"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
        }
        title={
          <div className="flex items-center gap-2 flex-wrap text-base font-bold text-slate-800">
            <span>Danh Sách Tài Khoản Đã Khóa</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold border border-rose-300">
              {users.filter((u) => u.disabled || u.status === 'disabled').length} tài khoản
            </span>
          </div>
        }
        description="Danh sách các tài khoản đang bị vô hiệu hóa / ngưng hoạt động. Bạn có thể mở khóa để khôi phục quyền truy cập bất cứ lúc nào."
        bodyClassName="space-y-3"
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Tổng cộng: <strong className="text-slate-800">{users.filter((u) => u.disabled || u.status === 'disabled').length}</strong> tài khoản đã khóa
            </span>
            <button
              type="button"
              onClick={() => setIsLockedUsersModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        }
      >
        {/* Search Filter Bar */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, Staff Code, Gmail, SĐT..."
              value={lockedUsersSearchQuery}
              onChange={(e) => setLockedUsersSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 transition"
            />
            {lockedUsersSearchQuery && (
              <button
                onClick={() => setLockedUsersSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-medium shrink-0">
            Hiển thị{' '}
            <strong className="text-slate-800">
              {
                users
                  .filter((u) => u.disabled || u.status === 'disabled')
                  .filter((u) => {
                    if (!lockedUsersSearchQuery.trim()) return true;
                    const q = lockedUsersSearchQuery.toLowerCase().trim();
                    return (
                      u.name.toLowerCase().includes(q) ||
                      u.account.toLowerCase().includes(q) ||
                      (u.email && u.email.toLowerCase().includes(q)) ||
                      (u.phone && u.phone.toLowerCase().includes(q)) ||
                      (u.technologies && u.technologies.toLowerCase().includes(q)) ||
                      (u.specializations && u.specializations.some((s) => s.toLowerCase().includes(q)))
                    );
                  }).length
              }
            </strong>{' '}
            / {users.filter((u) => u.disabled || u.status === 'disabled').length} tài khoản
          </span>
        </div>

        {/* Content Body */}
        {users.filter((u) => u.disabled || u.status === 'disabled').length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Không có tài khoản nào bị khóa</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Tất cả các tài khoản nhân viên đều đang hoạt động bình thường trên hệ thống.
            </p>
          </div>
        ) : users
            .filter((u) => u.disabled || u.status === 'disabled')
            .filter((u) => {
              if (!lockedUsersSearchQuery.trim()) return true;
              const q = lockedUsersSearchQuery.toLowerCase().trim();
              return (
                u.name.toLowerCase().includes(q) ||
                u.account.toLowerCase().includes(q) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.phone && u.phone.toLowerCase().includes(q)) ||
                (u.technologies && u.technologies.toLowerCase().includes(q)) ||
                (u.specializations && u.specializations.some((s) => s.toLowerCase().includes(q)))
              );
            }).length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">Không tìm thấy tài khoản phù hợp</h4>
            <p className="text-xs text-slate-400">
              Thử tìm kiếm với từ khóa khác (tên nhân viên, staff code, email hoặc số điện thoại).
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Desktop Table */}
            <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <th className="py-2.5 px-3 w-10 text-center">STT</th>
                    <th className="py-2.5 px-3">STAFF CODE</th>
                    <th className="py-2.5 px-4">HỌ VÀ TÊN</th>
                    <th className="py-2.5 px-3">GMAIL / SĐT</th>
                    <th className="py-2.5 px-3 text-center">ROLE</th>
                    <th className="py-2.5 px-3 text-center">LEVEL</th>
                    <th className="py-2.5 px-3">CÔNG NGHỆ</th>
                    <th className="py-2.5 px-3 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {users
                    .filter((u) => u.disabled || u.status === 'disabled')
                    .filter((u) => {
                      if (!lockedUsersSearchQuery.trim()) return true;
                      const q = lockedUsersSearchQuery.toLowerCase().trim();
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.account.toLowerCase().includes(q) ||
                        (u.email && u.email.toLowerCase().includes(q)) ||
                        (u.phone && u.phone.toLowerCase().includes(q)) ||
                        (u.technologies && u.technologies.toLowerCase().includes(q)) ||
                        (u.specializations && u.specializations.some((s) => s.toLowerCase().includes(q)))
                      );
                    })
                    .map((u, idx) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Tài khoản đã bị khóa" />
                            <button
                              onClick={() => setSelectedUserForDetail(u)}
                              className="hover:underline text-indigo-700 font-bold focus:outline-none cursor-pointer"
                              title="Xem chi tiết thành viên"
                            >
                              {u.account}
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold border border-rose-200">
                              Đã khóa
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          <button
                            onClick={() => setSelectedUserForDetail(u)}
                            className="text-left font-bold text-slate-800 hover:text-indigo-600 hover:underline transition focus:outline-none cursor-pointer"
                            title="Xem chi tiết thành viên"
                          >
                            {u.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <div className="text-slate-700 font-semibold">{u.email || '—'}</div>
                          <div className="text-slate-400 font-mono text-[10px]">{u.phone || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
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
                        <td className="py-2.5 px-3 text-center">
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
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 font-semibold">
                          {u.technologies || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestoreUser(u)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                            title="Khôi phục & Mở khóa tài khoản này"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mở Khóa</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-2.5">
              {users
                .filter((u) => u.disabled || u.status === 'disabled')
                .filter((u) => {
                  if (!lockedUsersSearchQuery.trim()) return true;
                  const q = lockedUsersSearchQuery.toLowerCase().trim();
                  return (
                    u.name.toLowerCase().includes(q) ||
                    u.account.toLowerCase().includes(q) ||
                    (u.email && u.email.toLowerCase().includes(q)) ||
                    (u.phone && u.phone.toLowerCase().includes(q)) ||
                    (u.technologies && u.technologies.toLowerCase().includes(q)) ||
                    (u.specializations && u.specializations.some((s) => s.toLowerCase().includes(q)))
                  );
                })
                .map((u) => (
                  <div
                    key={`locked-mobile-${u.id}`}
                    className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={u} size="sm" />
                        <div>
                          <button
                            onClick={() => setSelectedUserForDetail(u)}
                            className="font-bold text-xs text-slate-800 text-left hover:text-purple-600 block leading-tight cursor-pointer"
                          >
                            {u.name}
                          </button>
                          <span className="font-mono text-[11px] text-indigo-600 font-bold">
                            @{u.account}
                          </span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold border border-rose-200 shrink-0">
                        Đã khóa
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-rose-100 text-xs">
                      <div className="text-slate-500 text-[11px]">
                        {u.email || u.phone || 'Chưa cập nhật email'}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreUser(u)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Mở Khóa</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Temporary Credentials Modal (Displayed when Admin creates user or resets password) */}
      <Modal
        isOpen={!!tempCredModal}
        onClose={() => setTempCredModal(null)}
        size="md"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-xs shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
        }
        title={
          <div>
            <div className="text-sm sm:text-base font-bold text-slate-800">{tempCredModal?.title || 'Thông Tin Mật Khẩu'}</div>
            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">Mật Khẩu Tạm Thời Hệ Thống</span>
          </div>
        }
        footer={
          tempCredModal ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyAllInfo(tempCredModal.account, tempCredModal.name, tempCredModal.tempPassword)}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedField === 'all' ? 'Đã Sao Chép Toàn Bộ!' : 'Sao Chép Gửi Nhân Viên'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTempCredModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          ) : null
        }
      >
        {tempCredModal && (
          <div className="space-y-4">
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
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Chỉ sao chép mật khẩu"
                >
                  {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'password' ? 'Đã chép!' : 'Chép MK'}</span>
                </button>
              </div>
            </div>

            {tempCredModal.emailStatus && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2.5 ${
                  tempCredModal.emailStatus === 'sent'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : tempCredModal.emailStatus === 'sending'
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : tempCredModal.emailStatus === 'failed'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {tempCredModal.emailStatus === 'sent' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : tempCredModal.emailStatus === 'sending' ? (
                    <Loader2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 animate-spin" />
                  ) : tempCredModal.emailStatus === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug min-w-0 break-words">
                    <div className="font-bold">Trạng thái gửi Email</div>
                    <div className="text-[11px] opacity-90 mt-0.5">{tempCredModal.emailMessage}</div>
                  </div>
                </div>
                {(tempCredModal.emailStatus === 'failed' || tempCredModal.emailStatus === 'skipped') &&
                  tempCredModal.emailPayload && (
                    <button
                      type="button"
                      onClick={() => triggerWelcomeEmail(tempCredModal.emailPayload!)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-2xs transition cursor-pointer active:scale-95"
                    >
                      <Send className="w-3 h-3" />
                      <span>{tempCredModal.emailStatus === 'failed' ? 'Gửi lại' : 'Gửi ngay'}</span>
                    </button>
                  )}
              </div>
            )}

            <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-[11px] text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Cơ chế bảo mật đăng nhập lần đầu
              </div>
              <p className="text-indigo-800 leading-snug">
                Khi nhân viên đăng nhập bằng mật khẩu tạm này, hệ thống sẽ tự động bắt buộc đổi sang mật khẩu chính thức và mật khẩu tạm sẽ bị hủy.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Batch Temporary Credentials Modal */}
      <Modal
        isOpen={!!batchCredModal}
        onClose={() => setBatchCredModal(null)}
        size="2xl"
        className="max-w-2xl"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
        }
        title={
          <div className="flex items-center gap-2 flex-wrap text-base font-bold text-slate-800">
            <span>Danh Sách Mật Khẩu Tạm Thời</span>
            {batchCredModal && (
              <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold border border-amber-300">
                {batchCredModal.results.length} thành viên
              </span>
            )}
          </div>
        }
        description={
          batchCredModal
            ? batchCredModal.newlyGeneratedCount > 0
              ? `Đã tạo mật khẩu mới cho ${batchCredModal.newlyGeneratedCount} người và giữ nguyên mật khẩu của ${batchCredModal.results.length - batchCredModal.newlyGeneratedCount} người đã có.`
              : `Danh sách ${batchCredModal.results.length} nhân sự mới đang có mật khẩu tạm chờ đăng nhập lần đầu.`
            : undefined
        }
        footer={
          batchCredModal ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng: <strong className="text-slate-800">{batchCredModal.results.length}</strong> tài khoản
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyBatchList(batchCredModal.results)}
                  className="px-3.5 sm:px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {batchCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{batchCopied ? 'Đã Sao Chép!' : 'Sao Chép Toàn Bộ'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchCredModal(null)}
                  className="px-3.5 sm:px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {batchCredModal && (
          <div className="space-y-3">
            {/* Search Filter Bar */}
            <div className="pt-1 pb-1 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Lọc theo tên hoặc Staff Code..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 transition"
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

            {/* Table List */}
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
                            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-lg text-[11px] font-semibold border border-slate-200 transition inline-flex items-center gap-1 active:scale-95 cursor-pointer"
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
        )}
      </Modal>
      {/* MODAL: TẠO / CHỈNH SỬA TÀI KHOẢN THÀNH VIÊN (Saho Figma Design) */}
      <Modal
        isOpen={isUserFormOpen}
        onClose={handleCloseUserForm}
        onRequestClose={checkUserDirtyAndConfirmClose}
        size="2xl"
        bodyClassName="space-y-5"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {editingUserId
                ? 'Chỉnh sửa thông tin thành viên'
                : 'Tạo tài khoản & phân quyền mới'}
            </span>
            {editingUserId && (
              <span className="text-[11px] font-mono bg-[rgba(24,144,255,0.12)] text-[#1890FF] border border-[rgba(24,144,255,0.28)] px-2 py-0.5 rounded-[6px] font-bold">
                @{userAccount}
              </span>
            )}
          </div>
        }
        description={
          editingUserId
            ? `Đang cập nhật • @${userAccount}`
            : 'Thông tin cá nhân • Phân quyền hệ thống'
        }
        footer={
          <div className="flex items-center justify-between w-full gap-3">
            <button
              type="button"
              onClick={handleCloseUserForm}
              disabled={isCreatingUser}
              className="h-[36px] px-5 bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:bg-[#F8FAFB] dark:hover:bg-slate-700 hover:border-[#A2A6B4] text-[#1D202A] dark:text-slate-200 text-xs font-medium rounded-[8px] transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="user-account-modal-form"
              disabled={isCreatingUser}
              className="h-[36px] px-5 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white text-xs font-medium rounded-[8px] shadow-[0_2px_8px_rgba(24,144,255,0.28)] transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {isCreatingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {editingUserId
                  ? 'Lưu Thay Đổi'
                  : isCreatingUser
                  ? 'Đang Tạo Tài Khoản...'
                  : 'Tạo Account'}
              </span>
            </button>
          </div>
        }
      >
        <form
          id="user-account-modal-form"
          onSubmit={handleSubmitUser}
          className="space-y-5"
        >
          {/* 2-Column Figma Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {/* Row 1: Full Name | Staff Code */}
            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Tên Hiển Thị (Full Name): <span className="text-[#FF4D4F]">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn Quỳnh"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none font-medium transition"
                required
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Staff Code (Username Đăng Nhập): <span className="text-[#FF4D4F]">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: QuynhNV, ThanhNDT..."
                value={userAccount}
                onChange={(e) => setUserAccount(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#096DD9] dark:text-[#69C0FF] placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none font-mono font-bold transition"
                required
              />
            </div>

            {/* Row 2: Email | Phone */}
            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Địa Chỉ Email (Gmail):
              </label>
              <input
                type="email"
                placeholder="VD: nguyenvanquynh396lp@gmail.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none transition"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Số Điện Thoại (Phone):
              </label>
              <input
                type="text"
                placeholder="VD: 0388607463"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none font-mono transition"
              />
            </div>

            {/* Row 3: System Level | BirthDate */}
            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Cấp Phân Quyền Tổng Thể (System Level):
              </label>
              <Dropdown
                value={userRole}
                onChange={(newRole) => handleUserRoleChange(newRole as UserRole)}
                options={[
                  { value: 'Leader', label: '👑 Leader (Trưởng nhóm)' },
                  { value: 'Advisor', label: '🎖️ Advisor (Cố vấn)' },
                  { value: 'Member', label: '👥 Member (Thành viên)' },
                  { value: 'Admin', label: '🛡️ Admin (Quản trị)' },
                ]}
                className="w-full"
                buttonClassName="h-[38px] px-3.5 text-xs font-semibold bg-white dark:bg-slate-800/90"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Năm Sinh (BirthDate):
              </label>
              <input
                type="text"
                placeholder="VD: 1999"
                value={userBirthDate}
                onChange={(e) => setUserBirthDate(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none font-mono transition"
              />
            </div>

            {/* Row 4: CCCD | Technology */}
            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Số Căn Cước (CCCD):
              </label>
              <input
                type="text"
                placeholder="VD: 001099036785"
                value={userCccd}
                onChange={(e) => setUserCccd(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none font-mono transition"
              />
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Công Nghệ / Kỹ Năng (Technology):
              </label>
              <input
                type="text"
                placeholder="VD: PO, Angular, JavaSpring"
                value={userTechnologies}
                onChange={(e) => setUserTechnologies(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none transition"
              />
            </div>

            {/* Row 5: Bank Account (Full width in 2-col layout) */}
            <div className="sm:col-span-2">
              <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                Tài Khoản Ngân Hàng (Tk Bank):
              </label>
              <input
                type="text"
                placeholder="VD: 04891636001 - TPB - NGUYEN VAN QUYNH"
                value={userBankAccount}
                onChange={(e) => setUserBankAccount(e.target.value)}
                className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none transition"
              />
            </div>

                {/* Row 6: Specializations (Role) */}
                <div className="sm:col-span-2 pt-1">
                  <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 block mb-1.5">
                    Vị Trí Chuyên Môn Kiêm Nhiệm (Role):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((r) => {
                      const isChecked = selectedSpecs.includes(r.code);
                      return (
                        <div
                          key={r.id}
                          onClick={() => toggleSpec(r.code)}
                          className={`px-2.5 py-1.5 rounded-[8px] border text-xs font-medium transition flex items-center gap-2 cursor-pointer select-none ${
                            isChecked
                              ? 'bg-[rgba(24,144,255,0.10)] text-[#1890FF] border-[#1890FF]'
                              : 'bg-white dark:bg-slate-800/90 text-[#838899] dark:text-slate-300 border-[#E8E9EF] dark:border-slate-700 hover:border-[#A2A6B4] hover:text-[#1D202A]'
                          }`}
                        >
                          <SahoCheckbox
                            checked={isChecked}
                            onChange={() => toggleSpec(r.code)}
                            stopPropagation
                          />
                          <span>{r.code}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Row 7: Per-Specialization Role Matrix (Figma Segmented Control Style) */}
                {selectedSpecs.length > 0 && userRole !== 'Admin' && (
                  <div className="sm:col-span-2 pt-2 space-y-2 border-t border-[var(--saho-modal-divider)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#1890FF]" />
                        <span>Phân Quyền Vai Trò Chi Tiết Theo Từng Nghiệp Vụ:</span>
                      </label>
                      <span className="text-[11px] text-[#838899] dark:text-slate-400">
                        Leader / Advisor / Member theo từng team
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedSpecs.map((spec) => {
                        const currentSpecRole = specRoles[spec] || userRole || 'Member';
                        const rObj = roles.find((r) => r.code === spec);
                        return (
                          <div
                            key={spec}
                            className="bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[10px] p-2.5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#1D202A] dark:text-slate-100 flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-[#1890FF] bg-[rgba(24,144,255,0.10)] px-2 py-0.5 rounded-[6px] text-[11px] font-bold shrink-0">
                                  {spec}
                                </span>
                                {rObj?.name && rObj.name !== spec && (
                                  <span className="text-[11px] text-[#838899] font-normal truncate">
                                    ({rObj.name})
                                  </span>
                                )}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                  currentSpecRole === 'Leader'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                    : currentSpecRole === 'Advisor'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-[rgba(24,144,255,0.10)] text-[#1890FF] border-[rgba(24,144,255,0.28)]'
                                }`}
                              >
                                {currentSpecRole}
                              </span>
                            </div>

                            {/* Figma Segmented Control Track */}
                            <div className="bg-[rgba(73,82,106,0.05)] dark:bg-slate-900 p-1 rounded-[8px] grid grid-cols-3 gap-1">
                              {(['Leader', 'Advisor', 'Member'] as UserRole[]).map((rOption) => {
                                const isSelected = currentSpecRole === rOption;
                                return (
                                  <button
                                    key={rOption}
                                    type="button"
                                    onClick={() => handleSpecRoleChange(spec, rOption)}
                                    className={`py-1 px-1.5 rounded-[6px] text-[11px] transition flex items-center justify-center cursor-pointer ${
                                      isSelected
                                        ? 'bg-white dark:bg-slate-800 text-[#1D202A] dark:text-white font-semibold shadow-2xs'
                                        : 'text-[#838899] hover:text-[#1D202A] dark:hover:text-slate-200 font-medium'
                                    }`}
                                  >
                                    <span>
                                      {rOption === 'Leader'
                                        ? '👑 Leader'
                                        : rOption === 'Advisor'
                                        ? '🎖️ Advisor'
                                        : '👥 Member'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Figma Dashed Upload-Style Section: Quick Google Sheet / Excel Import */}
              <div className="bg-[rgba(73,82,106,0.03)] dark:bg-slate-800/40 border border-dashed border-[#A2A6B4] dark:border-slate-600 rounded-[12px] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-[42px] h-[42px] rounded-full border border-[#ECF1FF] dark:border-sky-800/70 flex items-center justify-center shrink-0 relative overflow-hidden"
                      style={{
                        backgroundImage:
                          'linear-gradient(180deg, rgba(201, 229, 255, 0.35) 0%, rgba(24, 144, 255, 0.16) 100%)',
                        boxShadow:
                          'inset 0px -4px 5px 0px rgba(255,255,255,0.6), inset 0px 3px 8px 0px rgba(57,121,223,0.22)',
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#1890FF] dark:text-[#40A9FF]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-[#1D202A] dark:text-slate-100 block">
                        Nhập Nhanh Thông Tin Thành Viên Từ Google Sheet / Excel
                      </span>
                      <span className="text-[11px] text-[#838899] dark:text-slate-400 block">
                        Copy dòng nhân viên từ Sheet và dán vào ô bên dưới để tự động điền thông tin
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowColumnGuide(!showColumnGuide)}
                    className="flex items-center gap-1 text-[11px] text-[#1890FF] hover:text-[#40A9FF] font-semibold bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 px-2.5 py-1.5 rounded-[8px] transition shrink-0 cursor-pointer active:scale-95"
                  >
                    <Info className="w-3.5 h-3.5 text-[#1890FF]" />
                    <span>{showColumnGuide ? 'Ẩn Cột Chuẩn' : 'Xem Thứ Tự Cột Chuẩn'}</span>
                  </button>
                </div>

                {/* Column Structure Helper & Reorder / Add Tool */}
                {showColumnGuide && (
                  <div className="p-3 bg-white/95 dark:bg-slate-900/90 rounded-[10px] border border-[#E8E9EF] dark:border-slate-700 text-[11px] space-y-2.5 transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-2 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#1D202A] dark:text-slate-100">
                          Thứ tự các cột tương thích trên Google Sheet / Excel:
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-[rgba(24,144,255,0.12)] text-[#1890FF] px-1.5 py-0.5 rounded-full">
                          {sheetColumns.length} cột
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetColumns}
                        className="text-[10px] font-semibold text-[#1890FF] hover:text-[#096DD9] hover:underline flex items-center gap-1 w-fit cursor-pointer"
                        title="Khôi phục lại 13 cột theo mẫu Google Sheet mặc định"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Đặt lại mặc định</span>
                      </button>
                    </div>

                    {/* Draggable Column Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sheetColumns.map((col, idx) => {
                        const isKeyCol = col.key === 'account' || col.key === 'name';
                        const isDragging = draggedColIdx === idx;
                        const isOver = dragOverColIdx === idx;

                        return (
                          <div
                            key={col.id || `${col.key}-${idx}`}
                            draggable
                            onDragStart={(e) => {
                              setDraggedColIdx(idx);
                              e.dataTransfer.setData('text/plain', String(idx));
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragOverColIdx !== idx) setDragOverColIdx(idx);
                            }}
                            onDragLeave={() => {
                              if (dragOverColIdx === idx) setDragOverColIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedColIdx !== null && draggedColIdx !== idx) {
                                handleReorderColumns(draggedColIdx, idx);
                              }
                              setDraggedColIdx(null);
                              setDragOverColIdx(null);
                            }}
                            onDragEnd={() => {
                              setDraggedColIdx(null);
                              setDragOverColIdx(null);
                            }}
                            onClick={() => handleOpenEditColumn(idx)}
                            className={`group relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-[6px] border text-[11px] font-medium select-none cursor-pointer transition-all duration-150 ${
                              isDragging
                                ? 'opacity-30 scale-95 border-[#1890FF] bg-[rgba(24,144,255,0.12)]'
                                : isOver
                                ? 'border-[#1890FF] bg-[rgba(24,144,255,0.12)] ring-2 ring-[#1890FF]/40 shadow-md scale-105'
                                : isKeyCol
                                ? 'bg-[rgba(24,144,255,0.08)] text-[#096DD9] dark:text-[#69C0FF] border-[#1890FF]/35 font-bold hover:border-[#1890FF]'
                                : col.key === 'skip'
                                ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-dashed border-slate-300 dark:border-slate-600'
                                : 'bg-[#F8FAFB] dark:bg-slate-800 text-[#1D202A] dark:text-slate-200 border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF]'
                            }`}
                            title="Kéo thả để đổi thứ tự, hoặc bấm vào để sửa tên / kiểu cột"
                          >
                            <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-[#1890FF] shrink-0 cursor-grab active:cursor-grabbing" />
                            <span className="font-mono text-[10px] text-[#1890FF] font-bold shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="truncate max-w-[120px] font-medium">{col.label}</span>

                            {col.key === 'skip' && (
                              <span className="text-[9px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1 py-0.2 rounded font-normal shrink-0">
                                Bỏ qua
                              </span>
                            )}

                            {sheetColumns.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveColumn(idx);
                                }}
                                title="Xóa cột này khỏi mapping"
                                className="w-3.5 h-3.5 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer shrink-0 ml-0.5"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Column Button */}
                      <button
                        type="button"
                        onClick={handleOpenAddColumn}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-dashed border-[#1890FF]/50 hover:border-[#1890FF] bg-[rgba(24,144,255,0.06)] hover:bg-[rgba(24,144,255,0.12)] text-[#1890FF] text-[11px] font-bold transition active:scale-95 cursor-pointer"
                        title="Thêm cột mới vào cuối danh sách"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm Cột</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-[#838899] italic leading-snug">
                      💡 Mẹo: <b>Kéo thả</b> các thẻ để đổi thứ tự cột, hoặc bấm vào từng thẻ để <b>đổi tên cột</b> / <b>chỉnh trường dữ liệu</b>. Bấm <b>&quot;+ Thêm Cột&quot;</b> để bổ sung cột mới.
                    </p>
                  </div>
                )}

                {/* Paste Action Input & Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="sheet-quick-paste-input"
                      type="text"
                      value={quickPasteInput}
                      onChange={(e) => {
                        setQuickPasteInput(e.target.value);
                        handleProcessSheetData(e.target.value);
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        if (pasted) {
                          e.preventDefault();
                          handleProcessSheetData(pasted);
                        }
                      }}
                      placeholder="👉 Dán (Ctrl + V) dòng dữ liệu copy từ Google Sheet hoặc Excel vào đây..."
                      className="w-full h-[38px] bg-white dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] px-3.5 text-xs text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] font-medium hover:border-[#40A9FF] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] dark:focus:shadow-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="h-[38px] px-4 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white rounded-[8px] text-xs font-medium transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm shadow-[#1890FF]/20 shrink-0 cursor-pointer"
                    title="Đọc dữ liệu vừa copy trong Clipboard"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dán Từ Clipboard</span>
                  </button>
                </div>

                {/* Multi-member row switcher & Batch Action Banner if user pasted multiple rows */}
                {multiParsedList.length > 1 && (
                  <div className="p-3 bg-[rgba(24,144,255,0.08)] dark:bg-sky-950/50 border border-[#1890FF]/30 rounded-[10px] space-y-2.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[8px] bg-[#1890FF] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#1D202A] dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span>Đã nhận diện {multiParsedList.length} nhân sự từ Sheet</span>
                            <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-[#1890FF] px-1.5 py-0.2 rounded border border-[#1890FF]/25">
                              {multiParsedList.filter((x) => !x.existingUser).length} mới •{' '}
                              {multiParsedList.filter((x) => !!x.existingUser).length} cập nhật
                            </span>
                          </div>
                          <span className="text-[11px] text-[#838899] dark:text-slate-300">
                            Bạn có thể mở bảng nhập hàng loạt hoặc bấm vào từng người để kiểm tra
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setBatchSelectedIndices(new Set(multiParsedList.map((_, i) => i)));
                          setIsBatchImportModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-[#1890FF] hover:bg-[#40A9FF] text-white rounded-[8px] text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm shadow-[#1890FF]/20 active:scale-95 cursor-pointer shrink-0"
                      >
                        <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                        <span>Mở Bảng Nhập Hàng Loạt ({multiParsedList.length})</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#1890FF]/20">
                      {multiParsedList.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedMultiIdx(idx);
                            applyParsedMember(item.member);
                          }}
                          className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            selectedMultiIdx === idx
                              ? 'bg-[#1890FF] text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-[#1D202A] dark:text-slate-200 border border-[#E8E9EF] dark:border-slate-700 hover:border-[#40A9FF]'
                          }`}
                        >
                          <span>{item.member.name || `@${item.member.account}`}</span>
                          {item.existingUser ? (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded font-mono font-medium">
                              Sửa
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 py-0.2 rounded font-mono font-medium">
                              Mới
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Banner (Check existing vs New) */}
                {pasteFeedback && (
                  <div
                    className={`p-2.5 rounded-[8px] text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
                      pasteFeedback.type === 'update'
                        ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs'
                        : pasteFeedback.type === 'create'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {pasteFeedback.type === 'update' ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : pasteFeedback.type === 'create' ? (
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 leading-snug">
                      <span>{pasteFeedback.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPasteFeedback(null)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Welcome Email Option */}
              {!editingUserId && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-[rgba(24,144,255,0.06)] border border-[#1890FF]/25 rounded-[8px]">
                  <div className="flex items-center gap-2.5">
                    <SahoCheckbox
                      checked={sendWelcomeEmail}
                      onChange={setSendWelcomeEmail}
                      size="md"
                    />
                    <Mail className="w-3.5 h-3.5 text-[#1890FF] shrink-0" />
                    <span
                      onClick={() => setSendWelcomeEmail(!sendWelcomeEmail)}
                      className="text-xs text-[#1D202A] dark:text-slate-200 font-medium cursor-pointer select-none"
                    >
                      Tự động gửi Email thông tin tài khoản &amp; hồ sơ cá nhân cho thành viên
                    </span>
                  </div>
                  {sendWelcomeEmail && !userEmail.trim() && (
                    <span className="text-[11px] text-[#FF7A45] font-medium">
                      * Vui lòng nhập Địa Chỉ Email (Gmail) ở trên để gửi mail
                    </span>
                  )}
                </div>
              )}
        </form>
      </Modal>

      {/* MODAL: THÊM CỘT MỚI VÀO SHEET MAPPING */}
      <Modal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onRequestClose={checkAddColDirtyAndConfirmClose}
        size="md"
        zIndex="z-[150]"
        icon={
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Plus className="w-4 h-4" />
          </div>
        }
        title="Thêm Cột Mới Khớp Với Sheet"
        description="Đặt tên cột trên Sheet và chọn kiểu dữ liệu tương ứng"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (checkAddColDirtyAndConfirmClose()) {
                  setIsAddColumnOpen(false);
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleConfirmAddColumn()}
              className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Vào Danh Sách</span>
            </button>
          </div>
        }
      >
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmAddColumn();
            }
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Tên cột hiển thị (Khớp với tiêu đề trên Sheet): <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="VD: Họ & Tên, Mã NV, CCCD, Link CV, v.v..."
              className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-200 transition font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              2. Gán vào trường thông tin thành viên (Kiểu dữ liệu):
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
              {AVAILABLE_SHEET_FIELDS.map((field) => {
                const isSelected = newColKey === field.key;
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => {
                      setNewColKey(field.key);
                      if (!newColName || AVAILABLE_SHEET_FIELDS.some((f) => f.defaultName === newColName)) {
                        setNewColName(field.defaultName);
                      }
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    <span className="truncate text-[11px]">{field.label}</span>
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: CHỈNH SỬA CỘT HIỆN CÓ TRÊN SHEET MAPPING */}
      <Modal
        isOpen={editingColIdx !== null}
        onClose={() => setEditingColIdx(null)}
        onRequestClose={checkEditColDirtyAndConfirmClose}
        size="md"
        zIndex="z-[150]"
        icon={
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Edit2 className="w-4 h-4" />
          </div>
        }
        title={`Chỉnh Sửa Cột Số ${(editingColIdx ?? 0) + 1}`}
        description="Cập nhật tên hiển thị hoặc thay đổi trường dữ liệu gán"
        footer={
          <div className="flex items-center justify-between w-full">
            {sheetColumns.length > 1 ? (
              <button
                type="button"
                onClick={() => editingColIdx !== null && handleRemoveColumn(editingColIdx)}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Cột</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (checkEditColDirtyAndConfirmClose()) {
                    setEditingColIdx(null);
                  }
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleConfirmEditColumn()}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu Thay Đổi</span>
              </button>
            </div>
          </div>
        }
      >
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmEditColumn();
            }
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Tên cột hiển thị (Khớp với tiêu đề trên Sheet): <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              placeholder="VD: Họ & Tên, Mã NV, CCCD..."
              className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-200 transition font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              2. Gán vào trường thông tin thành viên (Kiểu dữ liệu):
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
              {AVAILABLE_SHEET_FIELDS.map((field) => {
                const isSelected = editColKey === field.key;
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => setEditColKey(field.key)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    <span className="truncate text-[11px]">{field.label}</span>
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
      {/* MODAL: BẢNG XEM TRƯỚC & NHẬP HÀNG LOẠT THÀNH VIÊN TỪ SHEET */}
      <Modal
        isOpen={isBatchImportModalOpen && multiParsedList.length > 0}
        onClose={() => setIsBatchImportModalOpen(false)}
        onRequestClose={checkBatchImportDirtyAndConfirmClose}
        size="full"
        zIndex="z-[150]"
        className="max-w-5xl"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        }
        title={
          <div className="flex items-center gap-2 flex-wrap text-base font-extrabold text-purple-950">
            <span>Xem Trước & Nhập Hàng Loạt Từ Sheet</span>
            <span className="text-xs font-mono font-bold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
              {multiParsedList.length} nhân sự
            </span>
          </div>
        }
        description="Hệ thống đã tự động trích xuất các cột và phân loại tài khoản tạo mới / cập nhật"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-600">
              <span>Chuẩn bị xử lý: </span>
              <strong className="text-purple-700 font-bold">{batchSelectedIndices.size}</strong> nhân sự (
              <span className="text-emerald-700 font-bold">
                {multiParsedList.filter((x, idx) => batchSelectedIndices.has(idx) && !x.existingUser).length} tạo mới
              </span>
              ,{' '}
              <span className="text-amber-700 font-bold">
                {multiParsedList.filter((x, idx) => batchSelectedIndices.has(idx) && !!x.existingUser).length} cập nhật
              </span>
              )
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCloseBatchImportModal}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition cursor-pointer"
              >
                Hủy / Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBatchImportModalOpen(false);
                  applyParsedMember(multiParsedList[0].member);
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition cursor-pointer"
              >
                Điền Từng Người
              </button>
              <button
                type="button"
                disabled={batchSelectedIndices.size === 0 || isImportingBatch}
                onClick={handleExecuteBatchImport}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImportingBatch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang Nhập Dữ Liệu...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>Xác Nhận Nhập Hàng Loạt ({batchSelectedIndices.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Filter & Selection Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (batchSelectedIndices.size === multiParsedList.length) {
                    setBatchSelectedIndices(new Set());
                  } else {
                    setBatchSelectedIndices(new Set(multiParsedList.map((_, i) => i)));
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-purple-500 rounded-xl font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                {batchSelectedIndices.size === multiParsedList.length ? (
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                ) : batchSelectedIndices.size > 0 ? (
                  <div className="w-4 h-4 rounded bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                    -
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {batchSelectedIndices.size === multiParsedList.length
                    ? 'Bỏ chọn tất cả'
                    : `Chọn tất cả (${multiParsedList.length})`}
                </span>
              </button>

              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl gap-0.5">
                <button
                  type="button"
                  onClick={() => setBatchFilterTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    batchFilterTab === 'ALL' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({multiParsedList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilterTab('NEW')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    batchFilterTab === 'NEW' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Tạo mới ({multiParsedList.filter((x) => !x.existingUser).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilterTab('UPDATE')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    batchFilterTab === 'UPDATE' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Cập nhật ({multiParsedList.filter((x) => !!x.existingUser).length})</span>
                </button>
              </div>
            </div>

            <div className="text-slate-600 font-semibold flex items-center gap-2">
              <span>Đã chọn:</span>
              <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg font-mono">
                {batchSelectedIndices.size} / {multiParsedList.length}
              </span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-extrabold sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">Chọn</th>
                  <th className="px-2 py-2.5 w-10 text-center">STT</th>
                  <th className="px-3 py-2.5">Trạng Thái</th>
                  <th className="px-3 py-2.5">Họ và Tên</th>
                  <th className="px-3 py-2.5">Staff Code</th>
                  <th className="px-3 py-2.5">Role / Quyền</th>
                  <th className="px-3 py-2.5">CCCD</th>
                  <th className="px-3 py-2.5">TK Ngân Hàng</th>
                  <th className="px-3 py-2.5">Gmail / SĐT</th>
                  <th className="px-3 py-2.5">Công Nghệ</th>
                  <th className="px-3 py-2.5">Năm Sinh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {multiParsedList.map((item, idx) => {
                  const isNew = !item.existingUser;
                  if (batchFilterTab === 'NEW' && !isNew) return null;
                  if (batchFilterTab === 'UPDATE' && isNew) return null;
                  const isChecked = batchSelectedIndices.has(idx);

                  return (
                    <tr
                      key={idx}
                      onClick={() => {
                        const next = new Set(batchSelectedIndices);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setBatchSelectedIndices(next);
                      }}
                      className={`hover:bg-purple-50/60 transition cursor-pointer ${
                        isChecked ? 'bg-purple-50/30' : 'opacity-60 bg-slate-50/40'
                      }`}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <SahoCheckbox
                          checked={isChecked}
                          onChange={(checked) => {
                            const next = new Set(batchSelectedIndices);
                            if (checked) next.add(idx);
                            else next.delete(idx);
                            setBatchSelectedIndices(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[11px] text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        {isNew ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Tạo Mới</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Sửa (@{item.existingUser?.account})</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">
                        {item.member.name || <span className="text-slate-400 italic">Chưa có tên</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-bold text-purple-700 whitespace-nowrap">
                        @{item.member.account || 'tự sinh'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            {item.member.specializations[0] || 'BA'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {item.member.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {item.member.cccd || '-'}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[150px] truncate" title={item.member.bankAccount}>
                        {item.member.bankAccount || '-'}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        <div className="text-slate-800 truncate max-w-[140px]" title={item.member.email}>
                          {item.member.email || '-'}
                        </div>
                        <div className="text-slate-500 font-mono text-[10px]">
                          {item.member.phone || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[130px] truncate" title={item.member.technologies}>
                        {item.member.technologies || '-'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 text-center">
                        {item.member.birthDate || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* MODAL: TẠO / CHỈNH SỬA ROLE */}
      <Modal
        isOpen={isRoleFormOpen}
        onClose={handleCloseRoleModal}
        onRequestClose={checkRoleDirtyAndConfirmClose}
        size="xl"
        className="max-w-xl sm:max-w-2xl min-h-[480px] sm:min-h-[500px]"
        bodyClassName="overflow-visible"
        icon={
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
            <Tag className="w-5 h-5" />
          </div>
        }
        title={
          <div className="flex items-center gap-2 flex-wrap text-base font-bold text-slate-800">
            <span>{editingRoleId ? `Chỉnh Sửa Role: ${roleCode || ''}` : 'Thêm Role / Chuyên Môn Mới'}</span>
            {editingRoleId && (
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-200">
                {roleCode}
              </span>
            )}
          </div>
        }
        description={
          editingRoleId
            ? 'Cập nhật thông tin mã role, tên hiển thị, mô tả nhiệm vụ và màu sắc đại diện.'
            : 'Tạo mới vai trò / chuyên môn để phân công công việc và quản lý cột mốc milestone trong dự án.'
        }
        footer={
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCloseRoleModal}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="role-modal-form"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-95"
            >
              {editingRoleId ? 'Lưu Thay Đổi' : 'Tạo Role'}
            </button>
          </div>
        }
      >
        <form id="role-modal-form" onSubmit={handleSubmitRole} className="space-y-5 pb-3">
          {roleError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{roleError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Mã Role (Code): <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: BA, Design..."
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 uppercase font-bold focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Mã viết hoa ngắn gọn
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Tên Hiển Thị Role: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Business Analyst (Phân tích nghiệp vụ)"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition font-medium"
                required
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Mô Tả Nhiệm Vụ & Phạm Vi:
              </label>
              <input
                type="text"
                placeholder="VD: Phân tích yêu cầu, quy trình nghiệp vụ & viết đặc tả..."
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-slate-700 block mb-2">
                Màu Sắc Đại Diện:
              </label>
              <div className="flex flex-wrap items-center gap-3 py-2 px-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setRoleColor(c.id)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer ${c.preview} ${
                      roleColor === c.id
                        ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-sm'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={c.name}
                  >
                    {roleColor === c.id && (
                      <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* SUB-TAB 3: SYSTEM PERMISSIONS MATRIX                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'PERMISSIONS' && (
        <SystemPermissionsMatrixView
          actionsRef={permActionsRef}
          onStateChange={setPermState}
        />
      )}

      {/* User Detail & Edit Modal */}
      <UserDetailModal
        user={selectedUserForDetail}
        isOpen={!!selectedUserForDetail}
        initialEditMode={userDetailEditMode}
        onClose={() => {
          setSelectedUserForDetail(null);
          setUserDetailEditMode(false);
        }}
      />
    </div>
  );
};
