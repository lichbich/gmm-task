'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Ticket, TicketStatus, TicketPriority } from '../types/task';
import { Dropdown, DropdownOption } from './common/Dropdown';
import {
  X,
  Send,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Flame,
  UserCheck,
  MessageSquare,
  Trash2,
  Lock,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  Tag,
  ArrowRight,
  Edit2,
  Plus,
} from 'lucide-react';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenTaskModal?: (taskId: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onOpenTaskModal,
}) => {
  const {
    currentUser,
    users,
    tasks,
    milestones,
    updateTicket,
    deleteTicket,
    assignTicket,
    resolveTicket,
    closeTicket,
    reopenTicket,
    addTicketComment,
    confirmDialog,
  } = useApp();

  const [commentContent, setCommentContent] = useState('');
  const [commentAttachment, setCommentAttachment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

  // Ticket Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket?.title || '');
  const [editDescription, setEditDescription] = useState(ticket?.description || '');
  const [editPriority, setEditPriority] = useState<TicketPriority>(ticket?.priority || 'Medium');
  const [editAttachments, setEditAttachments] = useState<string[]>(
    ticket?.attachments && ticket.attachments.length > 0 ? ticket.attachments : ['']
  );
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sync edit form fields when ticket changes
  React.useEffect(() => {
    if (ticket) {
      setEditTitle(ticket.title || '');
      setEditDescription(ticket.description || '');
      setEditPriority(ticket.priority || 'Medium');
      setEditAttachments(
        ticket.attachments && ticket.attachments.length > 0 ? ticket.attachments : ['']
      );
      setIsEditing(false);
    }
  }, [ticket?.id]);

  const {
    isRendered,
    isVisible,
    handleClose,
    handleBackdropMouseDown,
    handleBackdropClick,
  } = useModalAnimation(isOpen, onClose);

  if (!isRendered || !ticket || !currentUser) return null;

  const isMatchSpec = (specA?: string, specB?: string) => {
    if (!specA || !specB) return false;
    const a = specA.trim().toLowerCase();
    const b = specB.trim().toLowerCase();
    if (a === b) return true;
    if ((a === 'design' && b === 'designer') || (a === 'designer' && b === 'design')) return true;
    return false;
  };

  // Determine permissions
  const isCreator = ticket.fromAccount.toLowerCase() === currentUser.account.toLowerCase();
  const isSendingTeam = currentUser.specializations?.some((s) => isMatchSpec(s, ticket.fromRole));
  const isTargetTeam =
    currentUser.specializations?.some((s) => isMatchSpec(s, ticket.toRole)) ||
    isMatchSpec(currentUser.role, ticket.toRole);
  const isAssignee = Boolean(
    ticket.assignedTo && ticket.assignedTo.toLowerCase() === currentUser.account.toLowerCase()
  );

  // Can edit content (Title, Description, Priority, Attachments): Creator or Admin
  const canEdit = isCreator || currentUser.role === 'Admin';

  // Can assign: Destination team members/leaders/advisors, assignee, or uninvolved Admin
  const canAssign = isTargetTeam || isAssignee || (currentUser.role === 'Admin' && !isCreator && !isSendingTeam);

  // Can manage processing status (In Progress, Resolved, Rejected):
  // ONLY destination team (toRole), assignee, or uninvolved Admin. Requester/Sending Team CANNOT update destination team's status!
  const canManageStatus = isTargetTeam || isAssignee || (currentUser.role === 'Admin' && !isCreator && !isSendingTeam);

  const canDelete = isCreator || currentUser.role === 'Admin';

  // Candidate users for assignment in toRole
  const candidateAssignees = users.filter((u) => {
    if (u.disabled || u.status === 'disabled') return false;
    return (
      u.specializations?.some((s) => isMatchSpec(s, ticket.toRole)) ||
      u.role === 'Admin'
    );
  });

  const assigneeOptions: DropdownOption[] = [
    {
      value: '',
      label: '-- Chưa phân công --',
    },
    ...candidateAssignees.map((u) => ({
      value: u.account,
      label: `${u.name} (@${u.account})`,
      subLabel: `${u.role} • ${u.specializations?.join(', ') || ''}`,
      badge: (
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          {u.role}
        </span>
      ),
    })),
  ];

  const statusOptions: DropdownOption<TicketStatus>[] = [
    {
      value: 'Open',
      label: 'Mới tạo (Open)',
      icon: <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />,
    },
    {
      value: 'In Progress',
      label: 'Đang xử lý (In Progress)',
      icon: <span className="w-2 h-2 rounded-full bg-indigo-500" />,
    },
    {
      value: 'Resolved',
      label: 'Đã giải quyết (Resolved)',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      value: 'Closed',
      label: 'Đã đóng (Closed)',
      icon: <Lock className="w-3.5 h-3.5 text-slate-500" />,
    },
    {
      value: 'Rejected',
      label: 'Từ chối (Rejected)',
      icon: <X className="w-3.5 h-3.5 text-rose-500" />,
    },
  ];

  const priorityOptions: DropdownOption<TicketPriority>[] = [
    {
      value: 'Urgent',
      label: 'Khẩn cấp (Urgent)',
      icon: <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />,
    },
    {
      value: 'High',
      label: 'Cao (High)',
      icon: <Flame className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      value: 'Medium',
      label: 'Trung bình',
    },
    {
      value: 'Low',
      label: 'Thấp',
    },
  ];

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-2xs">
            <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            Khẩn cấp (Urgent)
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            Cao (High)
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
            Trung bình
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            Thấp
          </span>
        );
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Mới tạo (Open)
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Đang xử lý (In Progress)
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Đã giải quyết (Resolved)
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Lock className="w-3.5 h-3.5" />
            Đã đóng (Closed)
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <X className="w-3.5 h-3.5" />
            Từ chối (Rejected)
          </span>
        );
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || isSendingComment) return;

    setIsSendingComment(true);
    try {
      const attachments = commentAttachment.trim() ? [commentAttachment.trim()] : undefined;
      await addTicketComment(ticket.id, commentContent.trim(), attachments);
      setCommentContent('');
      setCommentAttachment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleQuickAssignSelf = () => {
    assignTicket(ticket.id, currentUser.account);
  };

  const handleConfirmResolve = async () => {
    if (!resolutionNoteInput.trim()) return;
    await resolveTicket(ticket.id, resolutionNoteInput.trim());
    setIsResolving(false);
    setResolutionNoteInput('');
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editDescription.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const validAttachments = editAttachments
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      await updateTicket(ticket.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        attachments: validAttachments,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update ticket content:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteTicket = () => {
    confirmDialog({
      title: `Xóa Request Ticket ${ticket.code}?`,
      message: `Bạn có chắc chắn muốn xóa ticket "${ticket.title}" này không? Mọi lịch sử thảo luận sẽ bị xóa hoàn toàn.`,
      confirmText: 'Xác nhận Xóa',
      type: 'danger',
      onConfirm: async () => {
        await deleteTicket(ticket.id);
        handleClose();
      },
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-2xs">
              {ticket.code}
            </span>
            {getStatusBadge(ticket.status)}
            {getPriorityBadge(ticket.priority)}

            {/* Team Flow Banner */}
            <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <span className="text-amber-700 dark:text-amber-400">Team {ticket.fromRole}</span>
              <span className="text-slate-400">➔</span>
              <span className="text-purple-700 dark:text-purple-400 font-extrabold">
                Team {ticket.toRole}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN BODY: 2 COLUMN RESPONSIVE LAYOUT */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* LEFT PANE: TICKET DETAILS & STATUS/ASSIGNEE (7 cols on lg) */}
          <div className="lg:col-span-7 p-5 overflow-y-auto space-y-4 no-scrollbar">
            {/* Title & Creator Info */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug break-words">
                  {ticket.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                  <span>
                    Tạo bởi <strong>{ticket.fromName}</strong> (@{ticket.fromAccount})
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDate(ticket.createdAt)}
                  </span>
                </div>
              </div>

              {canEdit && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(ticket.title);
                    setEditDescription(ticket.description);
                    setEditPriority(ticket.priority);
                    setEditAttachments(
                      ticket.attachments && ticket.attachments.length > 0 ? ticket.attachments : ['']
                    );
                    setIsEditing(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                  title="Chỉnh sửa nội dung yêu cầu"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              )}
            </div>

            {isEditing ? (
              /* INLINE EDIT MODE FOR CREATOR / ADMIN */
              <div className="p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800/60 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                    Chỉnh sửa nội dung yêu cầu
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {ticket.code}
                  </span>
                </div>

                {/* Edit Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề yêu cầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Nhập tiêu đề yêu cầu..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Edit Priority */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mức độ ưu tiên
                  </label>
                  <Dropdown
                    value={editPriority}
                    onChange={(val) => setEditPriority(val as TicketPriority)}
                    options={priorityOptions}
                    size="sm"
                    className="w-full sm:w-56"
                  />
                </div>

                {/* Edit Description */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nội dung yêu cầu chi tiết <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Mô tả chi tiết nội dung cần team bạn phối hợp / giải đáp..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Edit Attachments */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Link tài liệu & thiết kế đính kèm
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditAttachments([...editAttachments, ''])}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Thêm link
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {editAttachments.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            const next = [...editAttachments];
                            next[idx] = e.target.value;
                            setEditAttachments(next);
                          }}
                          placeholder="https://figma.com/file/... hoặc Google Doc..."
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = editAttachments.filter((_, i) => i !== idx);
                            setEditAttachments(next.length > 0 ? next : ['']);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title="Xóa link này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edit Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(ticket.title);
                      setEditDescription(ticket.description);
                      setEditPriority(ticket.priority);
                      setEditAttachments(
                        ticket.attachments && ticket.attachments.length > 0 ? ticket.attachments : ['']
                      );
                      setIsEditing(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!editTitle.trim() || !editDescription.trim() || isSavingEdit}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isSavingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Assignee Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Người tiếp nhận xử lý (Team {ticket.toRole})
                </span>
                {ticket.assignedTo ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Đã phân công
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Chờ tiếp nhận
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                    {(ticket.assignedToName || ticket.assignedTo || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {ticket.assignedToName || (ticket.assignedTo ? `@${ticket.assignedTo}` : 'Chưa phân công')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {ticket.assignedTo
                        ? `@${ticket.assignedTo} (Team ${ticket.toRole})`
                        : `Chờ Leader/Advisor Team ${ticket.toRole} tiếp nhận`}
                    </div>
                  </div>
                </div>

                {canAssign ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    {!ticket.assignedTo && (
                      <button
                        type="button"
                        onClick={handleQuickAssignSelf}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Tôi nhận xử lý</span>
                      </button>
                    )}

                    <div className="w-full sm:w-56">
                      <Dropdown
                        value={ticket.assignedTo || ''}
                        onChange={(val) => {
                          assignTicket(ticket.id, val);
                        }}
                        options={assigneeOptions}
                        placeholder="Phân công thành viên..."
                        searchable={true}
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 italic shrink-0">
                    {ticket.assignedTo
                      ? `Đang được xử lý bởi @${ticket.assignedTo}`
                      : `Đang chờ Team ${ticket.toRole} phân công`}
                  </div>
                )}
              </div>

              {/* Synchronized Task Badge */}
              {ticket.assignedTo && (
                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">
                      Đã đồng bộ thành <strong>1 Task công việc</strong> trong danh sách của <strong>@{ticket.assignedTo}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isEditing && (
              <>
                {/* Description Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Nội dung yêu cầu chi tiết
                  </label>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                  </div>
                </div>
              </>
            )}

            {/* Resolution Note if resolved */}
            {ticket.resolutionNote && (
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Giải pháp / Kết quả xử lý ({ticket.resolvedByName || ticket.resolvedBy})</span>
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
                  {ticket.resolutionNote}
                </p>
                {ticket.resolvedAt && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-1">
                    Hoàn thành lúc: {formatDate(ticket.resolvedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Resolving Prompt Input (when destination team is marking resolved) */}
            {isResolving && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Nhập ghi chú giải pháp / Link tài liệu đã hoàn thiện:
                </label>
                <textarea
                  rows={3}
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  placeholder="VD: Đã define đầy đủ tài liệu luồng cấp phát tài khoản tại link Google Doc/Figma: https://..."
                  className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResolving(false);
                      setResolutionNoteInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResolve}
                    disabled={!resolutionNoteInput.trim()}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    Xác nhận Đã Giải Quyết
                  </button>
                </div>
              </div>
            )}

            {/* Related Milestone / Task */}
            {(ticket.relatedMilestoneTitle || ticket.relatedTaskTitle) && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Liên kết liên quan
                </span>
                {ticket.relatedMilestoneTitle && (
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      Milestone
                    </span>
                    <span className="font-medium">{ticket.relatedMilestoneTitle}</span>
                  </div>
                )}
                {ticket.relatedTaskTitle && (
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Task
                    </span>
                    <span className="font-medium">{ticket.relatedTaskTitle}</span>
                  </div>
                )}
              </div>
            )}

            {/* Attachment Links */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Tài liệu & Thiết kế đính kèm
                </label>
                <div className="space-y-1.5">
                  {ticket.attachments.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-xs text-indigo-700 dark:text-indigo-300 font-medium transition group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <LinkIcon className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <span className="truncate">{url}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 transition" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION FOOTER BAR: SEPARATED BY ROLE */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {canManageStatus ? (
                /* DESTINATION TEAM / ASSIGNEE CONTROLS */
                <>
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      Trạng thái:
                    </span>
                    <Dropdown
                      value={ticket.status}
                      onChange={(newStatus) => {
                        if (newStatus === 'Resolved') {
                          setIsResolving(true);
                        } else {
                          updateTicket(ticket.id, { status: newStatus });
                        }
                      }}
                      options={statusOptions}
                      size="sm"
                      className="w-48"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {ticket.status !== 'Resolved' && (
                      <button
                        type="button"
                        onClick={() => setIsResolving(true)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đánh dấu Đã Giải Quyết</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteTicket}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                        title="Xóa request ticket này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* REQUESTER / CREATOR / SENDING TEAM CONTROLS (READ-ONLY STATUS + CLOSE/REOPEN) */
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      Trạng thái:
                    </span>
                    {getStatusBadge(ticket.status)}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
                      {ticket.status === 'Open' && `(Chờ Team ${ticket.toRole} tiếp nhận)`}
                      {ticket.status === 'In Progress' && `(Team ${ticket.toRole} đang xử lý)`}
                      {ticket.status === 'Resolved' && `(Team ${ticket.toRole} đã giải quyết xong)`}
                      {ticket.status === 'Closed' && `(Yêu cầu đã đóng)`}
                      {ticket.status === 'Rejected' && `(Team ${ticket.toRole} từ chối yêu cầu)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.status === 'Resolved' && (
                      <>
                        <button
                          type="button"
                          onClick={() => reopenTicket(ticket.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Yêu cầu sửa thêm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => closeTicket(ticket.id)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Xác nhận & Đóng Ticket</span>
                        </button>
                      </>
                    )}

                    {ticket.status === 'Closed' && (
                      <button
                        type="button"
                        onClick={() => reopenTicket(ticket.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Mở lại Ticket</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteTicket}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                        title="Xóa request ticket này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT PANE: LIVE CROSS-TEAM DISCUSSION THREAD (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 h-[380px] lg:h-auto max-h-[500px] lg:max-h-none">
            {/* Comments Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Trao Đổi Liên Team
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {ticket.comments?.length || 0}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Đồng bộ tức thì</span>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {(!ticket.comments || ticket.comments.length === 0) && (
                <div className="py-12 text-center text-slate-400 space-y-1.5">
                  <MessageSquare className="w-8 h-8 mx-auto stroke-1 opacity-50 text-indigo-400" />
                  <p className="text-xs font-medium">Chưa có tin nhắn trao đổi nào.</p>
                  <p className="text-[11px] text-slate-400">Hãy gửi phản hồi để 2 team cùng phối hợp!</p>
                </div>
              )}

              {ticket.comments?.map((comment) => {
                const isMe = comment.authorAccount.toLowerCase() === currentUser.account.toLowerCase();
                return (
                  <div
                    key={comment.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Author & Timestamp */}
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {comment.authorName}
                      </span>
                      {comment.authorRole && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {comment.authorRole}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{comment.content}</p>

                      {/* Attached links */}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/20 dark:border-slate-700 space-y-1">
                          {comment.attachments.map((att, attIdx) => (
                            <a
                              key={attIdx}
                              href={att}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1 text-[11px] underline truncate ${
                                isMe ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 dark:text-indigo-400'
                              }`}
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{att}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comment Input Footer */}
            <form
              onSubmit={handleSendComment}
              className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
            >
              <textarea
                rows={2}
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Nhập nội dung phản hồi, câu hỏi hoặc giải đáp..."
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={commentAttachment}
                    onChange={(e) => setCommentAttachment(e.target.value)}
                    placeholder="Link đính kèm (Figma / Doc / API)..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!commentContent.trim() || isSendingComment}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
