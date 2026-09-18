'use client';

import React, { useState, useRef } from 'react';
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
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  Zap,
  Info,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Dropdown } from './common/Dropdown';
import { UserDetailModal } from './UserDetailModal';

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

export const UserManagementView: React.FC = () => {
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
    tasks,
    currentUser,
    confirmDialog,
  } = useApp();

  // SUB-TAB & SEARCH STATE
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES'>('USERS');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const isMouseDownOnBatchBackdrop = useRef(false);

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
    setSelectedSpecs(user.specializations && user.specializations.length > 0 ? user.specializations : ['BA']);
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                <span className="sm:hidden">Quản Trị Hệ Thống</span>
                <span className="hidden sm:inline">Quản Trị Hệ Thống & Phân Quyền</span>
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
                    className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl shadow-xs transition shrink-0 active:scale-95 cursor-pointer"
                    title={
                      needNewTempUsers.length > 0
                        ? `Cấp mật khẩu tạm cho ${needNewTempUsers.length} người mới chưa có (giữ nguyên người đã có)`
                        : `Xem danh sách mật khẩu tạm của ${pendingFirstLoginUsers.length} người đang chờ kích hoạt`
                    }
                  >
                    <KeyRound className="w-4 h-4 text-amber-600" />
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
                    className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-600/20 transition shrink-0 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="sm:hidden">Thêm TK</span>
                    <span className="hidden sm:inline">Tạo Tài Khoản Mới</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOpenAddRole}
                  className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition shrink-0 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Thêm Role</span>
                  <span className="hidden sm:inline">Thêm Role Mới</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sub-Tabs Switcher */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 w-full sm:w-fit gap-1">
          <button
            onClick={() => {
              setActiveSubTab('USERS');
              setIsRoleFormOpen(false);
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeSubTab === 'USERS'
                ? 'bg-white text-purple-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span className="sm:hidden">Tài Khoản ({users.length})</span>
            <span className="hidden sm:inline">Tài Khoản Thành Viên ({users.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('ROLES');
              setIsUserFormOpen(false);
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              activeSubTab === 'ROLES'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span className="sm:hidden">Role & Chuyên Môn ({roles.length})</span>
            <span className="hidden sm:inline">Danh Mục Role & Chuyên Môn ({roles.length})</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-500" />
                  {editingUserId ? 'Chỉnh Sửa Tài Khoản & Thông Tin Thành Viên' : 'Tạo Tài Khoản & Phân Quyền Mới'}
                </h3>
                {editingUserId && (
                  <span className="text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-lg font-bold">
                    Đang sửa: @{userAccount}
                  </span>
                )}
              </div>

              {/* QUICK SHEET PASTE BOX */}
              <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-purple-50/80 border border-purple-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-purple-900 block">
                        Nhập Nhanh Thông Tin Thành Viên Từ Google Sheet / Excel
                      </span>
                      <span className="text-[11px] text-purple-700">
                        Copy dòng nhân viên từ Sheet và dán vào đây để tự động điền & đối chiếu thông tin
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowColumnGuide(!showColumnGuide)}
                    className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 font-bold bg-white/90 hover:bg-white border border-purple-200 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Info className="w-3.5 h-3.5 text-purple-600" />
                    <span>{showColumnGuide ? 'Ẩn Cột Chuẩn' : 'Xem Thứ Tự Cột Chuẩn'}</span>
                  </button>
                </div>

                {/* Column Structure Helper & Reorder / Add Tool */}
                {showColumnGuide && (
                  <div className="p-3.5 bg-white/95 rounded-xl border border-purple-200 text-[11px] space-y-3 transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-2 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          Thứ tự các cột tương thích trên Google Sheet / Excel:
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                          {sheetColumns.length} cột
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetColumns}
                        className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 w-fit cursor-pointer"
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
                            className={`group relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border text-[11px] font-medium select-none cursor-pointer transition-all duration-150 ${
                              isDragging
                                ? 'opacity-30 scale-95 border-purple-400 bg-purple-100'
                                : isOver
                                ? 'border-purple-600 bg-purple-100 ring-2 ring-purple-400 shadow-md scale-105'
                                : isKeyCol
                                ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold hover:border-purple-400 hover:bg-purple-100/70 shadow-2xs'
                                : col.key === 'skip'
                                ? 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:bg-slate-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                            title="Kéo thả để đổi thứ tự, hoặc bấm vào để sửa tên / kiểu cột"
                          >
                            <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-purple-600 shrink-0 cursor-grab active:cursor-grabbing" />
                            <span className="font-mono text-[10px] text-purple-700 font-bold shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="truncate max-w-[130px] font-medium">{col.label}</span>

                            {col.key === 'skip' && (
                              <span className="text-[9px] text-slate-400 bg-slate-200/60 px-1 py-0.2 rounded font-normal shrink-0">
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
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-600 bg-purple-50/80 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-2xs"
                        title="Thêm cột mới vào cuối danh sách"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm Cột</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 italic leading-snug">
                      💡 Mẹo: <b>Kéo thả</b> các thẻ để đổi thứ tự cột, hoặc bấm vào từng thẻ để <b>đổi tên cột</b> / <b>chỉnh trường dữ liệu</b>. Bấm <b>&quot;+ Thêm Cột&quot;</b> để bổ sung cột mới. Cấu hình sẽ tự động lưu lại.
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
                      className="w-full bg-white border border-purple-300/90 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 shadow-2xs transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs shrink-0 cursor-pointer"
                    title="Đọc dữ liệu vừa copy trong Clipboard"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dán Từ Clipboard</span>
                  </button>
                </div>

                {/* Multi-member row switcher & Batch Action Banner if user pasted multiple rows */}
                {multiParsedList.length > 1 && (
                  <div className="p-3 bg-gradient-to-r from-purple-100/90 via-indigo-100/80 to-purple-100/90 border border-purple-300 rounded-2xl space-y-2.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                            <span>Đã nhận diện {multiParsedList.length} nhân sự từ Sheet</span>
                            <span className="text-[10px] font-mono font-bold bg-white text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                              {multiParsedList.filter((x) => !x.existingUser).length} mới •{' '}
                              {multiParsedList.filter((x) => !!x.existingUser).length} cập nhật
                            </span>
                          </div>
                          <span className="text-[11px] text-purple-800">
                            Bạn có thể bấm nhập hàng loạt tất cả cùng lúc hoặc bấm vào từng người để kiểm tra
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setBatchSelectedIndices(new Set(multiParsedList.map((_, i) => i)));
                          setIsBatchImportModalOpen(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer shrink-0"
                      >
                        <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                        <span>Mở Bảng Nhập Hàng Loạt ({multiParsedList.length})</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-purple-200/80">
                      {multiParsedList.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedMultiIdx(idx);
                            applyParsedMember(item.member);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            selectedMultiIdx === idx
                              ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300'
                              : 'bg-white text-slate-700 border border-purple-200 hover:bg-purple-50'
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
                    className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
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
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

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

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
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

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden p-3 space-y-3">
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
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {u.account.slice(0, 2).toUpperCase()}
                          </div>
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
                          return (
                            <span
                              key={s}
                              className={`px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border} font-bold text-[10px]`}
                            >
                              {s}
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
                            Chi tiết
                          </button>
                          {currentUser?.role === 'Admin' && (
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
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
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
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

            <div className="flex items-center gap-2 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
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
          </div>
        </div>
      )}

      {/* Batch Temporary Credentials Modal */}
      {batchCredModal && (
        <div
          onMouseDown={(e) => {
            isMouseDownOnBatchBackdrop.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (isMouseDownOnBatchBackdrop.current && e.target === e.currentTarget) {
              setBatchCredModal(null);
            }
            isMouseDownOnBatchBackdrop.current = false;
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-800 relative max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    Danh Sách Mật Khẩu Tạm Thời
                    <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold border border-amber-300">
                      {batchCredModal.results.length} thành viên
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {batchCredModal.newlyGeneratedCount > 0
                      ? `Đã tạo mật khẩu mới cho ${batchCredModal.newlyGeneratedCount} người và giữ nguyên mật khẩu của ${batchCredModal.results.length - batchCredModal.newlyGeneratedCount} người đã có.`
                      : `Danh sách ${batchCredModal.results.length} nhân sự mới đang có mật khẩu tạm chờ đăng nhập lần đầu.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchCredModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Copy Action Banner */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-700 font-medium">
                <span className="font-bold text-slate-900 block sm:inline">1 Click sao chép:</span> Định dạng rõ ràng, sẵn sàng paste vào Slack / Zalo / Telegram.
              </div>
              <button
                type="button"
                onClick={() => handleCopyBatchList(batchCredModal.results)}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer shrink-0"
              >
                {batchCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{batchCopied ? 'Đã Sao Chép Toàn Bộ Danh Sách!' : 'Sao Chép Toàn Bộ Gửi Nhóm'}</span>
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
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
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-3 overscroll-contain">
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
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
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
          </div>
        </div>
      )}
      {/* MODAL: THÊM CỘT MỚI VÀO SHEET MAPPING */}
      {isAddColumnOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Thêm Cột Mới Khớp Với Sheet</h4>
                  <p className="text-[11px] text-slate-500">Đặt tên cột trên Sheet và chọn kiểu dữ liệu tương ứng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddColumnOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddColumnOpen(false)}
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
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHỈNH SỬA CỘT HIỆN CÓ TRÊN SHEET MAPPING */}
      {editingColIdx !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Chỉnh Sửa Cột Số {editingColIdx + 1}
                  </h4>
                  <p className="text-[11px] text-slate-500">Cập nhật tên hiển thị hoặc thay đổi trường dữ liệu gán</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingColIdx(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                {sheetColumns.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveColumn(editingColIdx)}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Cột</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingColIdx(null)}
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
            </div>
          </div>
        </div>
      )}
      {/* MODAL: BẢNG XEM TRƯỚC & NHẬP HÀNG LOẠT THÀNH VIÊN TỪ SHEET */}
      {isBatchImportModalOpen && multiParsedList.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-purple-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-purple-950 flex items-center gap-2">
                    <span>Xem Trước & Nhập Hàng Loạt Từ Sheet</span>
                    <span className="text-xs font-mono font-bold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
                      {multiParsedList.length} nhân sự
                    </span>
                  </h3>
                  <p className="text-xs text-purple-700">
                    Hệ thống đã tự động trích xuất các cột và phân loại tài khoản tạo mới / cập nhật
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-white/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Selection Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0 text-xs">
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
            <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-extrabold sticky top-0 z-10 border-b border-slate-200">
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
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = new Set(batchSelectedIndices);
                                if (e.target.checked) next.add(idx);
                                else next.delete(idx);
                                setBatchSelectedIndices(next);
                              }}
                              className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
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

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
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
                  onClick={() => setIsBatchImportModalOpen(false)}
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
          </div>
        </div>
      )}
    </div>
  );
};
