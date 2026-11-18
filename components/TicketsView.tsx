'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { parseSahoRoute } from '../lib/sahoUrl';
import { Ticket, TicketStatus, TicketPriority, getUserRoleColorClass, getUserRoleInSpec, isUserAdminOrPM } from '../types/task';
import { TicketCreateModal } from './TicketCreateModal';
import { TicketDetailModal } from './TicketDetailModal';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { UserAvatar } from './common/UserAvatar';
import { FormattedTaskTitle } from './common/FormattedTaskTitle';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Flame,
  CheckCircle2,
  Clock,
  Activity,
  Lock,
  MessageSquare,
  ArrowRight,
  Inbox,
  Send,
  UserCheck,
  Building2,
  ExternalLink,
  ChevronRight,
  Layers,
  X,
  FileText,
} from 'lucide-react';

interface TicketsViewProps {
  initialSelectedTicketId?: string | null;
  onClearInitialTicketId?: () => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  initialSelectedTicketId,
  onClearInitialTicketId,
}) => {
  const { currentUser, tickets, users, roles } = useApp();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Filter states
  const [activeScope, setActiveScope] = useState<'INBOX' | 'OUTBOX' | 'MINE'>('INBOX');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [toRoleFilter, setToRoleFilter] = useState<string>('ALL');
  const [fromRoleFilter, setFromRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isMatchSpec = (specA?: string, specB?: string) => {
    if (!specA || !specB) return false;
    const a = specA.trim().toLowerCase();
    const b = specB.trim().toLowerCase();
    if (a === b) return true;
    if ((a === 'design' && b === 'designer') || (a === 'designer' && b === 'design')) return true;
    return false;
  };

  const userSpecializations = useMemo(() => {
    return currentUser?.specializations && currentUser.specializations.length > 0
      ? currentUser.specializations
      : [isUserAdminOrPM(currentUser) ? 'PO' : 'BA'];
  }, [currentUser]);

  // Handle deep-linking /requests/create and /requests/:id cleanly
  const deepLinkTicketHandledRef = React.useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || deepLinkTicketHandledRef.current) return;
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (parsed.modal?.kind === 'request-create') {
      deepLinkTicketHandledRef.current = true;
      setIsCreateModalOpen(true);
    } else if (parsed.modal?.kind === 'request-detail' && parsed.modal.id && tickets.length > 0) {
      deepLinkTicketHandledRef.current = true;
      const targetId = decodeURIComponent(parsed.modal.id).trim().toLowerCase();
      const found = tickets.find(
        (t) =>
          t.id.toLowerCase() === targetId ||
          (t.code && t.code.toLowerCase() === targetId)
      );
      if (found) setSelectedTicket(found);
    }
  }, [tickets]);

  // Handle auto-opening ticket from prop (one-shot consumption)
  useEffect(() => {
    if (initialSelectedTicketId && tickets.length > 0) {
      const found = tickets.find((t) => t.id === initialSelectedTicketId || t.code === initialSelectedTicketId);
      if (found) {
        setSelectedTicket(found);
        onClearInitialTicketId?.();
      }
    }
  }, [initialSelectedTicketId, tickets, onClearInitialTicketId]);

  // Keep selectedTicket synchronized with latest ticket data from context
  useEffect(() => {
    if (selectedTicket) {
      const latest = tickets.find((t) => t.id === selectedTicket.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedTicket)) {
        setSelectedTicket(latest);
      }
    }
  }, [tickets, selectedTicket]);

  // Available roles
  const availableRoles = useMemo(() => {
    return roles && roles.length > 0
      ? roles.map((r) => r.code)
      : ['BA', 'Design', 'FE', 'BE', 'QA', 'SA', 'DevOps', 'Mobile', 'AI'];
  }, [roles]);

  const fromRoleFilterOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'Tất cả Team gửi' },
    ...availableRoles.map((r) => ({ value: r, label: `Team ${r}` })),
  ], [availableRoles]);

  const toRoleFilterOptions: DropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'Tất cả Team nhận' },
    ...availableRoles.map((r) => ({ value: r, label: `Team ${r}` })),
  ], [availableRoles]);

  const statusFilterOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'Open', label: 'Mới tạo (Open)' },
    { value: 'In Progress', label: 'Đang xử lý (In Progress)' },
    { value: 'Resolved', label: 'Đã giải quyết (Resolved)' },
    { value: 'Closed', label: 'Đã đóng (Closed)' },
  ];

  const priorityFilterOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả ưu tiên' },
    { value: 'Urgent', label: 'Khẩn cấp (Urgent)' },
    { value: 'High', label: 'Cao (High)' },
    { value: 'Medium', label: 'Trung bình' },
    { value: 'Low', label: 'Thấp' },
  ];

  // Quick statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const userAccount = (currentUser?.account || '').toLowerCase();

    const inbox = tickets.filter((t) => {
      const isToMyTeam = userSpecializations.some((s) => isMatchSpec(s, t.toRole));
      const isCreatedByMe = t.fromAccount.toLowerCase() === userAccount;
      // Inbox: Must be sent to user's team AND not created by the user themselves
      return isToMyTeam && !isCreatedByMe;
    }).length;

    const outbox = tickets.filter((t) => {
      const isFromMyTeam = userSpecializations.some((s) => isMatchSpec(s, t.fromRole));
      const isCreatedByMe = t.fromAccount.toLowerCase() === userAccount;
      return isFromMyTeam || isCreatedByMe;
    }).length;

    const mine = tickets.filter((t) =>
      Boolean(t.assignedTo && t.assignedTo.toLowerCase() === userAccount)
    ).length;

    const open = tickets.filter((t) => t.status === 'Open').length;
    const inProgress = tickets.filter((t) => t.status === 'In Progress').length;
    const resolved = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
    const urgent = tickets.filter((t) => t.priority === 'Urgent' && t.status !== 'Closed').length;

    return { total, inbox, outbox, mine, open, inProgress, resolved, urgent };
  }, [tickets, userSpecializations, currentUser]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const userAccount = (currentUser?.account || '').toLowerCase();

    return tickets.filter((t) => {
      // Scope filter
      if (activeScope === 'INBOX') {
        const isToMyTeam = userSpecializations.some((s) => isMatchSpec(s, t.toRole));
        const isCreatedByMe = t.fromAccount.toLowerCase() === userAccount;
        if (!isToMyTeam || isCreatedByMe) return false;
      } else if (activeScope === 'OUTBOX') {
        const isFromMyTeam = userSpecializations.some((s) => isMatchSpec(s, t.fromRole));
        const isCreatedByMe = t.fromAccount.toLowerCase() === userAccount;
        if (!isFromMyTeam && !isCreatedByMe) return false;
      } else if (activeScope === 'MINE') {
        const isAssignedToMe = Boolean(t.assignedTo && t.assignedTo.toLowerCase() === userAccount);
        if (!isAssignedToMe) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      // From / To role filter
      if (fromRoleFilter !== 'ALL' && !isMatchSpec(t.fromRole, fromRoleFilter)) return false;
      if (toRoleFilter !== 'ALL' && !isMatchSpec(t.toRole, toRoleFilter)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = t.code.toLowerCase().includes(q);
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const fromNameMatch = (t.fromName || '').toLowerCase().includes(q);
        const assignedNameMatch = (t.assignedToName || t.assignedTo || '').toLowerCase().includes(q);
        const roleMatch = t.fromRole.toLowerCase().includes(q) || t.toRole.toLowerCase().includes(q);

        if (!codeMatch && !titleMatch && !descMatch && !fromNameMatch && !assignedNameMatch && !roleMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    tickets,
    activeScope,
    statusFilter,
    priorityFilter,
    fromRoleFilter,
    toRoleFilter,
    searchQuery,
    userSpecializations,
    currentUser,
  ]);

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
            <Flame className="w-3 h-3 text-rose-600 animate-pulse" />
            Khẩn cấp
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            Ưu tiên cao
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Trung bình
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Thấp
          </span>
        );
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(24,144,255,0.14)] dark:bg-sky-950/80 text-[#1890FF] dark:text-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1890FF] animate-pulse" />
            Mới tạo (Open)
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(255,169,64,0.16)] dark:bg-amber-950/80 text-[#FF7A45] dark:text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A45]" />
            Đang xử lý
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(10,177,133,0.16)] dark:bg-emerald-950/80 text-[#0AB185] dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-[#0AB185] dark:text-emerald-400" />
            Đã giải quyết
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(162,166,180,0.16)] dark:bg-slate-800 text-[#838899] dark:text-slate-400">
            <Lock className="w-3 h-3" />
            Đã đóng
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[12px] text-[11px] font-medium bg-[rgba(255,77,79,0.16)] dark:bg-rose-950/80 text-[#FF4D4F] dark:text-rose-300">
            <X className="w-3 h-3" />
            Từ chối
          </span>
        );
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 5) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & MAIN CTA */}
      <div className="saho-hero-card border border-[#E8E9EF] dark:border-slate-800 rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#1D202A] dark:text-slate-100 tracking-tight">
              Request
            </h2>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-[rgba(24,144,255,0.14)] text-[#1890FF] rounded-[12px]">
              Ticket
            </span>
          </div>
          <p className="text-xs text-[#838899] dark:text-slate-400 mt-0.5">
            Gửi & tiếp nhận các yêu cầu phối hợp công việc giữa các team.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-1.5 h-[34px] px-4 bg-[#1890FF] hover:bg-[#40A9FF] text-white text-[13px] font-medium rounded-[8px] shadow-[0_2px_8px_rgba(24,144,255,0.28)] transition active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo Yêu Cầu Mới
        </button>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Card 1: Total */}
        <div className="bg-[#F8FAFB] dark:bg-slate-900 p-3 rounded-[8px] border border-[#E8E9EF] dark:border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#838899] dark:text-slate-400 uppercase tracking-wider">
            Tổng Requests
          </span>
          <div className="text-xl font-bold text-[#1D202A] dark:text-white mt-1 tabular-nums">
            {stats.total}
          </div>
        </div>

        {/* Card 2: Inbox (Yêu Cầu Đến) */}
        <div className="bg-[#F8FAFB] dark:bg-slate-900 p-3 rounded-[8px] border border-[#E8E9EF] dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Yêu Cầu Đến
            </span>
            <Inbox className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {stats.inbox}
          </div>
        </div>

        {/* Card 3: Open */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Chờ xử lý (Open)
            </span>
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
            {stats.open}
          </div>
        </div>

        {/* Card 4: In Progress */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Đang giải quyết
            </span>
            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
            {stats.inProgress}
          </div>
        </div>

        {/* Card 5: Resolved */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Đã giải quyết
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {stats.resolved}
          </div>
        </div>

        {/* Card 6: Urgent */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Khẩn cấp
            </span>
            <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {stats.urgent}
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR: SAHO CHIP SCOPE TABS & COMMON DROPDOWN FILTERS */}
      <div className="bg-[#F8FAFB] dark:bg-slate-900 p-3 sm:p-4 rounded-[12px] border border-[#E8E9EF] dark:border-slate-800 space-y-3">
        {/* Row 1: Scope Chips & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Saho Chips (Figma BaseComponents/Chip) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveScope('INBOX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[14px] text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeScope === 'INBOX'
                  ? 'bg-[rgba(24,144,255,0.16)] text-[#1890FF] font-semibold'
                  : 'bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 text-[#838899] hover:text-[#1D202A]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Yêu cầu đến · {stats.inbox}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('OUTBOX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[14px] text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeScope === 'OUTBOX'
                  ? 'bg-[rgba(24,144,255,0.16)] text-[#1890FF] font-semibold'
                  : 'bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 text-[#838899] hover:text-[#1D202A]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Đã gửi · {stats.outbox}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('MINE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[14px] text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeScope === 'MINE'
                  ? 'bg-[rgba(10,177,133,0.16)] text-[#0AB185] font-semibold'
                  : 'bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 text-[#838899] hover:text-[#1D202A]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Của tôi · {stats.mine}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#838899] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã ticket (#REQ), tiêu đề, tên người gửi, người xử lý..."
              className="w-full h-[32px] bg-white dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 rounded-[8px] pl-9 pr-8 text-[13px] text-[#1D202A] dark:text-slate-100 placeholder:text-[#838899] focus:outline-none focus:border-[#1890FF] focus:shadow-[0_0_0_3px_#E6F7FF] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters using Common Dropdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* From Team Filter */}
          <div>
            <Dropdown
              value={fromRoleFilter}
              onChange={(val) => setFromRoleFilter(val)}
              options={fromRoleFilterOptions}
              size="sm"
              className="w-full"
            />
          </div>

          {/* To Team Filter */}
          <div>
            <Dropdown
              value={toRoleFilter}
              onChange={(val) => setToRoleFilter(val)}
              options={toRoleFilterOptions}
              size="sm"
              className="w-full"
            />
          </div>

          {/* Status Filter */}
          <div>
            <Dropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={statusFilterOptions}
              size="sm"
              className="w-full"
            />
          </div>

          {/* Priority Filter */}
          <div>
            <Dropdown
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
              options={priorityFilterOptions}
              size="sm"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* 4. TICKETS LIST / CARDS */}
      <div className="space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[12px] border border-[#E8E9EF] dark:border-slate-800 p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-[12px] bg-[rgba(24,144,255,0.12)] dark:bg-sky-950/60 flex items-center justify-center text-[#1890FF] dark:text-sky-400">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-[#1D202A] dark:text-slate-200">
                Không tìm thấy yêu cầu nào phù hợp
              </h3>
              <p className="text-xs text-[#838899] dark:text-slate-400 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || fromRoleFilter !== 'ALL' || toRoleFilter !== 'ALL'
                  ? 'Thử xóa bộ lọc để xem các yêu cầu khác.'
                  : 'Chưa có yêu cầu nào trong danh sách này. Bấm nút bên dưới để tạo yêu cầu mới!'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (statusFilter !== 'ALL' || priorityFilter !== 'ALL' || fromRoleFilter !== 'ALL' || toRoleFilter !== 'ALL' || searchQuery) {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setFromRoleFilter('ALL');
                  setToRoleFilter('ALL');
                  setSearchQuery('');
                } else {
                  setIsCreateModalOpen(true);
                }
              }}
              className="px-4 h-[34px] bg-[#1890FF] hover:bg-[#40A9FF] text-white text-xs font-medium rounded-[8px] active:scale-95 transition cursor-pointer"
            >
              {statusFilter !== 'ALL' || priorityFilter !== 'ALL' || fromRoleFilter !== 'ALL' || toRoleFilter !== 'ALL' || searchQuery
                ? 'Xóa Bộ Lọc'
                : 'Tạo Yêu Cầu Mới'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTickets.map((t) => {
              const isInboxForMe = userSpecializations.some((s) => isMatchSpec(s, t.toRole));
              const commentsCount = t.comments?.length || 0;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`group relative bg-white dark:bg-slate-900 rounded-[12px] border p-4 sm:p-5 transition-all duration-150 hover:shadow-[0_6px_18px_rgba(24,144,255,0.08)] hover:border-[#1890FF] dark:hover:border-sky-600 cursor-pointer flex flex-col justify-between gap-3.5 ${
                    t.priority === 'Urgent' && t.status !== 'Closed'
                      ? 'border-[#FF4D4F]/40 bg-[rgba(255,77,79,0.03)] dark:bg-rose-950/10'
                      : isInboxForMe
                      ? 'border-[#1890FF]/35 dark:border-sky-900/50'
                      : 'border-[#E8E9EF] dark:border-slate-800'
                  }`}
                >
                  {/* Top Row: Code, Flow Badge, Status & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-2xs">
                        {t.code}
                      </span>

                      {/* From Team -> To Team Flow Tag */}
                      <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <span className="text-amber-700 dark:text-amber-400">Team {t.fromRole}</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-purple-700 dark:text-purple-400 font-extrabold">
                          Team {t.toRole}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getStatusBadge(t.status)}
                      {getPriorityBadge(t.priority)}
                    </div>
                  </div>

                  {/* Middle Content: Title & Excerpt */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug line-clamp-2">
                      <FormattedTaskTitle title={t.title} />
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  </div>

                  {/* Linked Milestone / Task or Attachments badge */}
                  {(t.relatedMilestoneTitle || t.relatedTaskTitle || (t.attachments && t.attachments.length > 0)) && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      {t.relatedMilestoneTitle && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium truncate max-w-[200px]">
                          Milestone: {t.relatedMilestoneTitle}
                        </span>
                      )}
                      {t.relatedTaskTitle && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium truncate max-w-[200px]">
                          Task: {t.relatedTaskTitle}
                        </span>
                      )}
                      {t.attachments && t.attachments.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          📎 {t.attachments.length} link đính kèm
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom Footer Row: Requester, Assignee, Discussion count */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                    {/* Left: Requester & Date */}
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {t.fromName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[11px]">{formatDate(t.createdAt)}</span>
                    </div>

                    {/* Right: Assignee & Discussion Pill */}
                    <div className="flex items-center gap-2 shrink-0">
                      {t.assignedTo ? (() => {
                        const assigneeUser = users.find((u) => u.account.toLowerCase() === t.assignedTo!.toLowerCase());
                        const assigneeRole = assigneeUser ? getUserRoleInSpec(assigneeUser, t.toRole) : 'Member';
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <UserAvatar
                              user={assigneeUser}
                              account={t.assignedTo}
                              name={t.assignedToName}
                              size="xs"
                              shape="circle"
                            />
                            <span className={getUserRoleColorClass(assigneeRole)}>{t.assignedToName || t.assignedTo}</span>
                          </div>
                        );
                      })() : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">
                          Chưa phân công
                        </span>
                      )}

                      {/* Comment Count */}
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                        <MessageSquare className="w-3 h-3" />
                        <span>{commentsCount}</span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. CREATE TICKET MODAL */}
      <TicketCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newTicket) => {
          setActiveScope('OUTBOX');
          setSelectedTicket(newTicket);
        }}
      />

      {/* 6. TICKET DETAIL & LIVE DISCUSSION MODAL */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => {
          setSelectedTicket(null);
          onClearInitialTicketId?.();
        }}
      />
    </div>
  );
};
