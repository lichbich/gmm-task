'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectResource, ResourceLevel } from '../types/task';
import {
  FolderGit2,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Layers,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Link2,
  CheckCircle2,
  ShieldAlert,
  Info,
  BookOpen,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Dropdown } from './common/Dropdown';

const FigmaIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38H19V28.5Z" fill="#1ABCFE"/>
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
    <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
    <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
    <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
  </svg>
);

const LEVEL_OPTIONS: { id: ResourceLevel; name: string; desc: string; badge: string; border: string; bg: string }[] = [
  {
    id: 'Business Plan',
    name: 'Business Plan (Chiến Lược & Ngân Sách)',
    desc: 'Chiến lược, ước tính nỗ lực, landing page & bảo mật',
    badge: 'bg-purple-100 text-purple-700 border-purple-300',
    border: 'border-purple-200',
    bg: 'bg-purple-50/50',
  },
  {
    id: 'Level 1 - Business',
    name: 'Level 1 - Business (Phân Tích Nghiệp Vụ)',
    desc: 'AI / Members hiểu "LÀM CÁI GÌ" (Screen Flow, Backlog, SRS)',
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    border: 'border-blue-200',
    bg: 'bg-blue-50/50',
  },
  {
    id: 'Level 2 - Design',
    name: 'Level 2 - Design (Thiết Kế & UI/UX)',
    desc: 'AI / Members hiểu "THIẾT KẾ NHƯ THẾ NÀO" (Figma, Architecture, Usecase)',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    border: 'border-amber-200',
    bg: 'bg-amber-50/50',
  },
  {
    id: 'Level 3 - Implementation',
    name: 'Level 3 - Implementation (Lập Trình & CSDL)',
    desc: 'AI / Members hiểu "CODE NHƯ THẾ NÀO" (ERD, Class Diagram, Solution, CSDL)',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/50',
  },
];

const getToolStyle = (toolName?: string) => {
  const t = (toolName || '').toLowerCase();
  if (t.includes('figma')) {
    return {
      badge: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/80',
      icon: <FigmaIcon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
      label: 'Figma Design',
    };
  }
  if (t.includes('draw.io') || t.includes('diagram')) {
    return {
      badge: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/80',
      icon: <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />,
      label: 'Draw.io Diagram',
    };
  }
  if (t.includes('sheet') || t.includes('excel')) {
    return {
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/80',
      icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      label: 'Google Sheet',
    };
  }
  if (t.includes('ai studio') || t.includes('ai')) {
    return {
      badge: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800/80',
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
      label: 'Google AI Studio',
    };
  }
  if (t.includes('doc')) {
    return {
      badge: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800/80',
      icon: <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
      label: 'Google Docs',
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: <BookOpen className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />,
    label: toolName || 'Tài liệu',
  };
};

const getToolBadgeConfig = getToolStyle;

export const ResourceManagerView: React.FC = () => {
  const { resources, addResource, updateResource, deleteResource, currentUser, confirmDialog } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
  const [selectedToolFilter, setSelectedToolFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const activeFilterCount =
    (selectedLevelFilter !== 'ALL' ? 1 : 0) + (selectedToolFilter !== 'ALL' ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedLevelFilter('ALL');
    setSelectedToolFilter('ALL');
  };

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [resLevel, setResLevel] = useState<ResourceLevel>('Level 1 - Business');
  const [resName, setResName] = useState('');
  const [resContent, setResContent] = useState('');
  const [resTool, setResTool] = useState('Draw.io');
  const [resPrimaryLink, setResPrimaryLink] = useState('');
  const [resPrimaryLinkLabel, setResPrimaryLinkLabel] = useState('');
  const [resOriginLink, setResOriginLink] = useState('');
  const [resOriginLinkLabel, setResOriginLinkLabel] = useState('');

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Leader' || currentUser?.role === 'Advisor';

  const handleOpenAddModal = () => {
    setEditingResId(null);
    setResLevel('Level 1 - Business');
    setResName('');
    setResContent('');
    setResTool('Draw.io');
    setResPrimaryLink('');
    setResPrimaryLinkLabel('');
    setResOriginLink('');
    setResOriginLinkLabel('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (res: ProjectResource) => {
    setEditingResId(res.id);
    setResLevel(res.level);
    setResName(res.name);
    setResContent(res.content || '');
    setResTool(res.tool || 'Docs');
    setResPrimaryLink(res.primaryLink || '');
    setResPrimaryLinkLabel(res.primaryLinkLabel || '');
    setResOriginLink(res.originLink || '');
    setResOriginLinkLabel(res.originLinkLabel || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName.trim()) return;

    const payload = {
      level: resLevel,
      name: resName.trim(),
      content: resContent.trim(),
      tool: resTool.trim(),
      primaryLink: resPrimaryLink.trim(),
      primaryLinkLabel: resPrimaryLinkLabel.trim() || (resPrimaryLink.trim() ? `Saho | GMM | ${resName.trim()}` : ''),
      originLink: resOriginLink.trim(),
      originLinkLabel: resOriginLinkLabel.trim() || (resOriginLink.trim() ? `Saho | GMM | ${resName.trim()} (Bản tổng hợp)` : ''),
    };

    if (editingResId) {
      updateResource(editingResId, payload);
    } else {
      addResource(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (res: ProjectResource) => {
    confirmDialog({
      title: 'Xác nhận xóa Resource',
      message: `Bạn có chắc chắn muốn xóa liên kết tài liệu "${res.name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => deleteResource(res.id),
    });
  };

  // Filtered resources
  const filteredResources = resources.filter((r) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = r.name.toLowerCase().includes(q);
      const matchContent = (r.content || '').toLowerCase().includes(q);
      const matchTool = (r.tool || '').toLowerCase().includes(q);
      const matchLevel = r.level.toLowerCase().includes(q);
      const matchLink = (r.primaryLinkLabel || '').toLowerCase().includes(q);
      if (!matchName && !matchContent && !matchTool && !matchLevel && !matchLink) return false;
    }

    // Level filter
    if (selectedLevelFilter !== 'ALL' && r.level !== selectedLevelFilter) {
      return false;
    }

    // Tool filter
    if (selectedToolFilter !== 'ALL') {
      const toolLower = (r.tool || '').toLowerCase();
      if (!toolLower.includes(selectedToolFilter.toLowerCase())) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                <span className="sm:hidden">Tài Liệu Dự Án</span>
                <span className="hidden sm:inline">Quản Lý Resource & Tài Liệu Dự Án</span>
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300">
                {resources.length} Hạng Mục
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kho lưu trữ tập trung toàn bộ các liên kết tài liệu, thiết kế Figma, sơ đồ kiến trúc Draw.io, SRS và tài liệu chuẩn của dự án.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Thêm Resource Mới
            </button>
          )}
        </div>

        {/* Filter Toolbar & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          {/* MOBILE SEARCH & FILTER BAR (< md) */}
          <div className="flex md:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu, sơ đồ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Round Filter Button */}
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 cursor-pointer active:scale-95 ${
                activeFilterCount > 0
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              }`}
              title="Mở bộ lọc tài liệu"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Mobile View Switcher (Compact Icons) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg transition active:scale-95 ${
                  viewMode === 'GRID' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng Card"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition active:scale-95 ${
                  viewMode === 'TABLE' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dạng Bảng"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DESKTOP SEARCH & INLINE FILTERS (>= md) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm tài liệu, sơ đồ, Figma..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Level Filter Dropdown */}
              <Dropdown
                value={selectedLevelFilter}
                onChange={setSelectedLevelFilter}
                options={[
                  { value: 'ALL', label: 'Tất Cả Level' },
                  ...LEVEL_OPTIONS.map((l) => ({ value: l.id, label: l.id })),
                ]}
                size="sm"
                buttonClassName="py-1.5 px-3 text-xs font-semibold bg-slate-50 border-slate-300 text-slate-700 shrink-0"
              />

              {/* Tool Filter Dropdown */}
              <Dropdown
                value={selectedToolFilter}
                onChange={setSelectedToolFilter}
                options={[
                  { value: 'ALL', label: 'Tất Cả Công Cụ (Tools)' },
                  { value: 'Draw.io', label: 'Draw.io Diagram' },
                  { value: 'Figma', label: 'Figma Design' },
                  { value: 'Sheet', label: 'Google Sheets' },
                  { value: 'Doc', label: 'Google Docs' },
                  { value: 'AI Studio', label: 'Google AI Studio' },
                ]}
                size="sm"
                buttonClassName="py-1.5 px-3 text-xs font-semibold bg-slate-50 border-slate-300 text-slate-700 shrink-0"
              />
            </div>

            {/* Desktop View Switcher: Card Grid vs Table View */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 gap-1 ml-auto">
              <button
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                  viewMode === 'GRID'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dưới dạng Card phân cấp"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                Dạng Card
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dưới dạng Bảng như Google Sheet gốc"
              >
                <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                Dạng Bảng Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: GRID CARDS GROUPED BY LEVEL */}
      {viewMode === 'GRID' && (
        <div className="space-y-6">
          {LEVEL_OPTIONS.map((lvl) => {
            const levelRes = filteredResources.filter((r) => r.level === lvl.id);
            if (selectedLevelFilter !== 'ALL' && selectedLevelFilter !== lvl.id) return null;
            if (levelRes.length === 0 && searchQuery) return null;

            return (
              <div key={lvl.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                {/* Level Header Bar */}
                <div className={`px-5 py-3.5 ${lvl.bg} border-b ${lvl.border} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${lvl.badge}`}>
                        {lvl.id}
                      </span>
                      <span>{lvl.name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{lvl.desc}</p>
                  </div>

                  <span className="text-xs font-bold text-slate-400 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto font-mono">
                    {levelRes.length} tài liệu
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {levelRes.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-400 italic">
                      Chưa có tài liệu nào thuộc level này.
                    </div>
                  ) : (
                    levelRes.map((r) => {
                      const toolStyle = getToolStyle(r.tool);
                      return (
                        <div
                          key={r.id}
                          className="bg-white border border-slate-200/90 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between group"
                        >
                          <div className="space-y-2">
                            {/* Top row: Tool badge & Admin actions */}
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${toolStyle.badge}`}
                              >
                                {toolStyle.icon}
                                {r.tool || 'Tài liệu'}
                              </span>

                              {canManage && (
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => handleOpenEditModal(r)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                                    title="Chỉnh sửa tài liệu"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                    title="Xóa tài liệu"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Resource Name */}
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition">
                              {r.name}
                            </h4>

                            {/* Resource Content / Description */}
                            {r.content && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                {r.content}
                              </p>
                            )}
                          </div>

                          {/* Action Links */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs font-semibold">
                            {/* Primary Link (Break Down - Ưu Tiên) */}
                            {r.primaryLink && (
                              <a
                                href={r.primaryLink}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl transition flex items-center justify-between gap-2 group/link active:scale-[0.99] shadow-2xs"
                              >
                                <span className="truncate text-[11px] font-bold flex items-center gap-1.5">
                                  <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  {r.primaryLinkLabel || 'Mở tài liệu (Break down)'}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0 group-hover/link:translate-x-0.5 transition-transform" />
                              </a>
                            )}

                            {/* Origin Link (Đặc biệt) */}
                            {r.originLink && (
                              <a
                                href={r.originLink}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-xl transition flex items-center justify-between gap-2 group/link text-[10px] active:scale-[0.99]"
                              >
                                <span className="truncate font-semibold flex items-center gap-1.5">
                                  <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                                  {r.originLinkLabel || 'Bản tổng hợp (Origin)'}
                                </span>
                                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 group-hover/link:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: SPREADSHEET TABLE VIEW */}
      {viewMode === 'TABLE' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-3 sm:p-4 space-y-3">
          {/* Mobile Card List (< md) */}
          <div className="md:hidden space-y-3">
            {filteredResources.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                Không tìm thấy tài liệu phù hợp với điều kiện lọc.
              </div>
            ) : (
              filteredResources.map((r, idx) => {
                const toolStyle = getToolStyle(r.tool);
                const matchedLvl = LEVEL_OPTIONS.find((l) => l.id === r.level);
                return (
                  <div
                    key={r.id}
                    className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${matchedLvl?.badge || 'bg-slate-100'}`}>
                          {r.level}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${toolStyle.badge}`}>
                          {toolStyle.icon}
                          {r.tool || 'Tài liệu'}
                        </span>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition border border-slate-200/60"
                            title="Sửa tài liệu"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg transition border border-slate-200/60"
                            title="Xóa tài liệu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-800 leading-snug">
                        {r.name}
                      </h4>
                      {r.content && (
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          {r.content}
                        </p>
                      )}
                    </div>

                    {/* Links */}
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 text-xs">
                      {r.primaryLink && (
                        <a
                          href={r.primaryLink}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg transition flex items-center justify-between gap-1.5 font-semibold text-[11px]"
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <Link2 className="w-3 h-3 text-indigo-600 shrink-0" />
                            {r.primaryLinkLabel || 'Mở tài liệu (Break down)'}
                          </span>
                          <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0" />
                        </a>
                      )}
                      {r.originLink && (
                        <a
                          href={r.originLink}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition flex items-center justify-between gap-1.5 font-medium text-[10px]"
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                            {r.originLinkLabel || 'Bản tổng hợp (Origin)'}
                          </span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar relative">
            <table className="w-full text-left text-xs border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <th className="py-3 px-3 w-10 text-center whitespace-nowrap">STT</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">LEVEL</th>
                  <th className="py-3 px-3 min-w-[150px]">NAME (HẠNG MỤC)</th>
                  <th className="py-3 px-4 min-w-[180px]">CONTENT (NỘI DUNG)</th>
                  <th className="py-3 px-3 text-center w-28 whitespace-nowrap">TOOL</th>
                  <th className="py-3 px-4 min-w-[180px]">LINK (BREAK DOWN) - ƯU TIÊN</th>
                  <th className="py-3 px-4 min-w-[180px]">LINK (ORIGIN) - ĐẶC BIỆT</th>
                  {canManage && (
                    <th className="py-3 px-4 text-center w-24 sticky right-0 bg-slate-100 border-l border-slate-200 z-10 shadow-sm text-slate-800 whitespace-nowrap">
                      THAO TÁC
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 italic text-xs">
                      Không tìm thấy tài liệu phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((r, idx) => {
                    const toolStyle = getToolStyle(r.tool);
                    const matchedLvl = LEVEL_OPTIONS.find((l) => l.id === r.level);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition group">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-semibold">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border ${matchedLvl?.badge || 'bg-slate-100'}`}>
                            {r.level}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">{r.name}</td>
                        <td className="py-3 px-4 text-[11px] text-slate-600">{r.content || '—'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${toolStyle.badge}`}>
                            {toolStyle.icon}
                            {r.tool || 'Tài liệu'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.primaryLink ? (
                            <a
                              href={r.primaryLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 truncate max-w-[220px]"
                              title={r.primaryLink}
                            >
                              <Link2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{r.primaryLinkLabel || 'Mở tài liệu'}</span>
                              <ExternalLink className="w-3 h-3 text-indigo-400 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Không có link</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {r.originLink ? (
                            <a
                              href={r.originLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-600 font-semibold hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                              title={r.originLink}
                            >
                              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{r.originLinkLabel || 'Bản tổng hợp'}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Không có link</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-200 z-10 shadow-sm">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(r)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Sửa tài liệu"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Xóa tài liệu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT RESOURCE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 relative">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
                {editingResId ? 'Chỉnh Sửa Resource Dự Án' : 'Thêm Resource / Tài Liệu Mới'}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0 overscroll-contain">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Cấp Phân Loại Level: <span className="text-red-500">*</span>
                  </label>
                  <Dropdown
                    value={resLevel}
                    onChange={(val) => setResLevel(val as ResourceLevel)}
                    options={LEVEL_OPTIONS.map((l) => ({ value: l.id, label: l.name }))}
                    className="w-full"
                    buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên Hạng Mục / Hàng (Name): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Requirement, SRS, Usecase Diagram, FE Architecture..."
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nội Dung / Mô Tả (Content):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Screen Flow, Master Plan / Angular - Typescript..."
                    value={resContent}
                    onChange={(e) => setResContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Công Cụ (Tool):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Draw.io, Figma, Google Sheets, Docs..."
                    value={resTool}
                    onChange={(e) => setResTool(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đường Link Trực Tiếp (Break down - Ưu tiên):
                  </label>
                  <input
                    type="text"
                    placeholder="https://... (Không bắt buộc)"
                    value={resPrimaryLink}
                    onChange={(e) => setResPrimaryLink(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-indigo-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên Hiển Thị Link Ưu Tiên (Label):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Saho | GMM | Requirement"
                    value={resPrimaryLinkLabel}
                    onChange={(e) => setResPrimaryLinkLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đường Link Gốc (Origin - Trường hợp đặc biệt):
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={resOriginLink}
                    onChange={(e) => setResOriginLink(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên Hiển Thị Link Gốc (Origin Label):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Saho | GMM | Requirement (Bản tổng hợp)"
                    value={resOriginLinkLabel}
                    onChange={(e) => setResOriginLinkLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 sm:px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition cursor-pointer text-xs sm:text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition cursor-pointer text-xs sm:text-sm active:scale-95"
                >
                  {editingResId ? 'Lưu Thay Đổi' : 'Tạo Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MOBILE FILTER MODAL / BOTTOM SHEET */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Bộ Lọc Tài Liệu & Sơ Đồ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeFilterCount > 0 ? `Đang chọn ${activeFilterCount} bộ lọc` : 'Tất cả điều kiện mặc định'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Level Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block">
                  Cấp Phân Loại (Level):
                </label>
                <Dropdown
                  value={selectedLevelFilter}
                  onChange={setSelectedLevelFilter}
                  options={[
                    { value: 'ALL', label: 'Tất Cả Level' },
                    ...LEVEL_OPTIONS.map((l) => ({ value: l.id, label: l.id })),
                  ]}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              {/* Tool Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block">
                  Công Cụ Sử Dụng (Tool):
                </label>
                <Dropdown
                  value={selectedToolFilter}
                  onChange={setSelectedToolFilter}
                  options={[
                    { value: 'ALL', label: 'Tất Cả Công Cụ (Tools)' },
                    { value: 'Draw.io', label: 'Draw.io Diagram' },
                    { value: 'Figma', label: 'Figma Design' },
                    { value: 'Sheet', label: 'Google Sheets' },
                    { value: 'Doc', label: 'Google Docs' },
                    { value: 'AI Studio', label: 'Google AI Studio' },
                  ]}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </button>

              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-95 text-center"
              >
                Áp Dụng ({filteredResources.length} mục)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
