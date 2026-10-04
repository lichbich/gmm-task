'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ProjectResource, ResourceLevel } from '../types/task';
import {
  CustomQuickLink,
  getPinnedResourceIds,
  togglePinResourceId,
  getCustomQuickLinks,
  addCustomQuickLink,
  removeCustomQuickLink,
  QUICK_RESOURCE_UPDATE_EVENT,
  normalizeUrl,
} from '../lib/quickResourceHelper';
import {
  FolderGit2,
  ExternalLink,
  Plus,
  Search,
  Star,
  X,
  Layers,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Link2,
  BookOpen,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Globe,
  PlusCircle,
} from 'lucide-react';

const FigmaIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38H19V28.5Z" fill="#1ABCFE" />
    <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
    <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262" />
    <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E" />
    <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF" />
  </svg>
);

const LEVEL_COMPACT: Record<
  ResourceLevel,
  { label: string; badge: string }
> = {
  'Business Plan': {
    label: 'Plan',
    badge: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
  },
  'Level 1 - Business': {
    label: 'L1 Business',
    badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
  },
  'Level 2 - Design': {
    label: 'L2 Design',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
  },
  'Level 3 - Implementation': {
    label: 'L3 Code',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
  },
};

const getToolVisual = (toolName?: string) => {
  const t = (toolName || '').toLowerCase();
  if (t.includes('figma')) {
    return {
      borderLeft: 'border-l-rose-500',
      iconBox: 'bg-rose-50 border-rose-200/80 text-rose-600 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-400',
      icon: <FigmaIcon className="w-4 h-4" />,
      label: 'Figma',
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300',
    };
  }
  if (t.includes('draw.io') || t.includes('diagram')) {
    return {
      borderLeft: 'border-l-cyan-500',
      iconBox: 'bg-cyan-50 border-cyan-200/80 text-cyan-600 dark:bg-cyan-950/60 dark:border-cyan-900 dark:text-cyan-400',
      icon: <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
      label: 'Draw.io',
      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300',
    };
  }
  if (t.includes('sheet') || t.includes('excel')) {
    return {
      borderLeft: 'border-l-emerald-500',
      iconBox: 'bg-emerald-50 border-emerald-200/80 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-400',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      label: 'Sheets',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300',
    };
  }
  if (t.includes('ai studio') || t.includes('ai')) {
    return {
      borderLeft: 'border-l-purple-500',
      iconBox: 'bg-purple-50 border-purple-200/80 text-purple-600 dark:bg-purple-950/60 dark:border-purple-900 dark:text-purple-400',
      icon: <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      label: 'AI Studio',
      badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300',
    };
  }
  if (t.includes('doc')) {
    return {
      borderLeft: 'border-l-blue-500',
      iconBox: 'bg-blue-50 border-blue-200/80 text-blue-600 dark:bg-blue-950/60 dark:border-blue-900 dark:text-blue-400',
      icon: <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      label: 'Docs',
      badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300',
    };
  }
  if (t.includes('github') || t.includes('git')) {
    return {
      borderLeft: 'border-l-slate-700 dark:border-l-slate-400',
      iconBox: 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
      icon: <Globe className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      label: 'GitHub',
      badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  return {
    borderLeft: 'border-l-indigo-500',
    iconBox: 'bg-indigo-50 border-indigo-200/80 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-900 dark:text-indigo-400',
    icon: <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
    label: toolName || 'Link',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300',
  };
};

interface QuickResourceFloatingButtonProps {
  onNavigateToResourceManager?: () => void;
}

export const QuickResourceFloatingButton: React.FC<QuickResourceFloatingButtonProps> = ({
  onNavigateToResourceManager,
}) => {
  const { resources, currentUser } = useApp();
  const userAccount = currentUser?.account;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'PINNED' | 'ALL'>('PINNED');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');

  // Pinned state & custom links state from localStorage
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [customLinks, setCustomLinks] = useState<CustomQuickLink[]>([]);

  // Add custom link form state
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customTool, setCustomTool] = useState('Figma');
  const [customNote, setCustomNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state from storage
  const reloadQuickState = () => {
    setPinnedIds(getPinnedResourceIds(userAccount));
    setCustomLinks(getCustomQuickLinks(userAccount));
  };

  useEffect(() => {
    reloadQuickState();

    const handleCustomEvent = () => reloadQuickState();
    const handleStorageEvent = (e: StorageEvent) => {
      if (
        e.key?.startsWith('saho_pinned_resources_') ||
        e.key?.startsWith('saho_custom_quick_links_')
      ) {
        reloadQuickState();
      }
    };

    window.addEventListener(QUICK_RESOURCE_UPDATE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener(QUICK_RESOURCE_UPDATE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [userAccount]);

  // Handle clicking outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setIsAddCustomOpen(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Toggle Pin
  const handleTogglePin = (resourceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    togglePinResourceId(userAccount, resourceId);
    setPinnedIds(getPinnedResourceIds(userAccount));
  };

  // Copy Link to clipboard with feedback
  const handleCopyLink = (url: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open link helper
  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Save new custom quick link
  const handleSaveCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;

    const normalized = normalizeUrl(customUrl);
    addCustomQuickLink(userAccount, {
      name: customName.trim(),
      url: normalized,
      tool: customTool,
      note: customNote.trim() || undefined,
    });

    setCustomLinks(getCustomQuickLinks(userAccount));
    setCustomName('');
    setCustomUrl('');
    setCustomNote('');
    setIsAddCustomOpen(false);
    setActiveTab('PINNED');
  };

  const handleDeleteCustomLink = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    removeCustomQuickLink(userAccount, id);
    setCustomLinks(getCustomQuickLinks(userAccount));
  };

  // Pinned Project Resources
  const pinnedProjectResources = useMemo(() => {
    return resources.filter((r) => pinnedIds.includes(r.id));
  }, [resources, pinnedIds]);

  const totalPinnedCount = pinnedProjectResources.length + customLinks.length;

  // Filtered resources for ALL tab
  const filteredAllResources = useMemo(() => {
    return resources.filter((r) => {
      if (selectedLevelFilter !== 'ALL' && r.level !== selectedLevelFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.name.toLowerCase().includes(q);
        const matchContent = (r.content || '').toLowerCase().includes(q);
        const matchTool = (r.tool || '').toLowerCase().includes(q);
        const matchLevel = r.level.toLowerCase().includes(q);
        const matchLabel = (r.primaryLinkLabel || '').toLowerCase().includes(q);
        if (!matchName && !matchContent && !matchTool && !matchLevel && !matchLabel) return false;
      }
      return true;
    });
  }, [resources, selectedLevelFilter, searchQuery]);

  // Filtered Pinned Items (Pinned Resources + Custom Links)
  const filteredPinnedResources = useMemo(() => {
    if (!searchQuery.trim()) return pinnedProjectResources;
    const q = searchQuery.toLowerCase().trim();
    return pinnedProjectResources.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        (r.content || '').toLowerCase().includes(q) ||
        (r.tool || '').toLowerCase().includes(q) ||
        r.level.toLowerCase().includes(q) ||
        (r.primaryLinkLabel || '').toLowerCase().includes(q)
      );
    });
  }, [pinnedProjectResources, searchQuery]);

  const filteredCustomLinks = useMemo(() => {
    if (!searchQuery.trim()) return customLinks;
    const q = searchQuery.toLowerCase().trim();
    return customLinks.filter((l) => {
      return (
        l.name.toLowerCase().includes(q) ||
        (l.note || '').toLowerCase().includes(q) ||
        (l.tool || '').toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q)
      );
    });
  }, [customLinks, searchQuery]);

  return (
    <div ref={containerRef} className="select-none">
      {/* 1. FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative group flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full transition-all duration-300 cursor-pointer shadow-xl active:scale-90 ${
            isOpen
              ? 'bg-slate-800 text-white rotate-90 ring-4 ring-slate-400/30'
              : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/35 hover:shadow-indigo-600/50 hover:scale-105 ring-4 ring-white/90 dark:ring-slate-900/90'
          }`}
          title="Truy Cập Nhanh Resource (Figma, Sơ đồ, GSheet...)"
          aria-label="Truy cập nhanh Resource"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <>
              {/* Pulsing subtle glow effect behind */}
              <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping opacity-40 group-hover:opacity-75 pointer-events-none" />
              <FolderGit2 className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-sm transition-transform duration-200 group-hover:scale-110" />
            </>
          )}

          {/* Pinned Count Badge */}
          {!isOpen && totalPinnedCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-extrabold text-[10px] rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md animate-in zoom-in">
              <Star className="w-2.5 h-2.5 fill-amber-950 text-amber-950 mr-0.5" />
              {totalPinnedCount}
            </span>
          )}

          {/* Floating Tooltip on Hover */}
          {!isOpen && (
            <div className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 text-white text-xs font-semibold rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none -translate-x-2 group-hover:translate-x-0">
              ⚡ Truy Cập Nhanh Resource
              <div className="text-[10px] text-indigo-300 font-normal">
                {totalPinnedCount > 0 ? `${totalPinnedCount} link đã ghim` : 'Figma, Sheet, Docs...'}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* 2. BACKDROP OVERLAY ON MOBILE */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 sm:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. QUICK RESOURCE FLYOUT CARD - Clean, High-Contrast & Sleek Layout */}
      {isOpen && (
        <div className="fixed bottom-24 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-20 z-50 sm:w-[460px] max-h-[82vh] sm:max-h-[640px] flex flex-col bg-slate-50/98 dark:bg-slate-900/98 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                  <span>Truy Cập Nhanh Resource</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Quick Links
                  </span>
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Bấm vào card để mở ngay tài liệu, sơ đồ & Figma
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddCustomOpen(!isAddCustomOpen)}
                className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                  isAddCustomOpen
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-indigo-600 dark:text-indigo-300 border border-slate-200/60 dark:border-slate-600'
                }`}
                title="Thêm link riêng"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thêm link</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Add Custom Link Form */}
          {isAddCustomOpen && (
            <form
              onSubmit={handleSaveCustomLink}
              className="p-3.5 bg-indigo-50/90 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/60 space-y-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0"
            >
              <div className="flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Thêm Liên Kết Nhanh Riêng Của Bạn:
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddCustomOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">
                    Tên hiển thị *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Figma App V2, Sheet QA..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">
                    Loại công cụ
                  </label>
                  <select
                    value={customTool}
                    onChange={(e) => setCustomTool(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Figma">Figma Design</option>
                    <option value="Draw.io">Draw.io Diagram</option>
                    <option value="Sheet">Google Sheets</option>
                    <option value="Doc">Google Docs</option>
                    <option value="AI Studio">Google AI Studio</option>
                    <option value="Github">Github / Code</option>
                    <option value="Khác">Tài liệu khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-0.5">
                  Đường dẫn (URL) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://figma.com/file/... hoặc https://docs.google.com/..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddCustomOpen(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <Star className="w-3 h-3 fill-white" />
                  Lưu & Ghim Ngay
                </button>
              </div>
            </form>
          )}

          {/* Search bar & Tabs */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 shrink-0 bg-white/70 dark:bg-slate-850">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm nhanh tài liệu, sơ đồ, Figma, Sheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Inset Segmented Tab Switcher */}
            <div className="flex items-center justify-between gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('PINNED')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 ${
                  activeTab === 'PINNED'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    activeTab === 'PINNED'
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-400'
                  }`}
                />
                <span>Đã Ghim & Của Tôi</span>
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                  {totalPinnedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 ${
                  activeTab === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tất Cả Resource</span>
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold font-mono">
                  {resources.length}
                </span>
              </button>
            </div>

            {/* Level filters (only visible on ALL tab) */}
            {activeTab === 'ALL' && (
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5 text-[10px]">
                {['ALL', 'Business Plan', 'Level 1 - Business', 'Level 2 - Design', 'Level 3 - Implementation'].map(
                  (lvl) => {
                    const label =
                      lvl === 'ALL'
                        ? 'Tất cả'
                        : lvl === 'Business Plan'
                        ? 'Plan'
                        : lvl.replace('Level ', 'L');
                    const isSelected = selectedLevelFilter === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSelectedLevelFilter(lvl)}
                        className={`px-2 py-0.8 rounded-lg font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Content List Area - Soft tinted background to eliminate white glare */}
          <div className="overflow-y-auto custom-scrollbar p-3 space-y-2.5 flex-1 min-h-[240px] bg-slate-100/60 dark:bg-slate-950/40">
            {/* TAB 1: PINNED & CUSTOM LINKS */}
            {activeTab === 'PINNED' && (
              <div className="space-y-2.5">
                {/* No items state */}
                {totalPinnedCount === 0 && !searchQuery && (
                  <div className="py-8 px-4 text-center space-y-3 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                      <Star className="w-6 h-6 fill-amber-400/40" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Chưa có liên kết nào được ghim
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                        Bấm ⭐ ở tab <b>"Tất Cả Resource"</b> hoặc bấm <b>"+ Thêm link"</b> ở trên để tạo danh sách truy cập nhanh của riêng bạn.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('ALL')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Xem Danh Sách Tài Liệu</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Search not found */}
                {totalPinnedCount > 0 &&
                  filteredPinnedResources.length === 0 &&
                  filteredCustomLinks.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      Không tìm thấy liên kết phù hợp với từ khóa "{searchQuery}".
                    </div>
                  )}

                {/* 1. Custom Personal Links section */}
                {filteredCustomLinks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 flex items-center justify-between">
                      <span>📌 Link Cá Nhân ({filteredCustomLinks.length})</span>
                    </div>

                    {filteredCustomLinks.map((link) => {
                      const visual = getToolVisual(link.tool);
                      const isCopied = copiedId === link.id;

                      return (
                        <div
                          key={link.id}
                          onClick={() => handleOpenUrl(link.url)}
                          className={`group relative flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer border-l-4 ${visual.borderLeft}`}
                        >
                          {/* Tool Icon container */}
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform group-hover:scale-105 ${visual.iconBox}`}
                          >
                            {visual.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate leading-snug">
                                {link.name}
                              </h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                                Cá nhân
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {link.note || link.url}
                            </p>
                          </div>

                          {/* Right action icons */}
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleCopyLink(link.url, link.id, e)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                              title="Copy link"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomLink(link.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                              title="Xóa link cá nhân"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="p-1 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                              <ExternalLink className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Pinned Project Resources section */}
                {filteredPinnedResources.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 flex items-center justify-between">
                      <span>⭐ Tài Liệu Dự Án Đã Ghim ({filteredPinnedResources.length})</span>
                    </div>

                    {filteredPinnedResources.map((res) => {
                      const visual = getToolVisual(res.tool);
                      const lvlConfig = LEVEL_COMPACT[res.level] || {
                        label: res.level,
                        badge: 'bg-slate-100 text-slate-700',
                      };
                      const isCopied = copiedId === res.id;

                      return (
                        <div
                          key={res.id}
                          onClick={() => handleOpenUrl(res.primaryLink)}
                          className={`group relative flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer border-l-4 ${visual.borderLeft}`}
                        >
                          {/* Tool Icon container */}
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform group-hover:scale-105 ${visual.iconBox}`}
                          >
                            {visual.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate leading-snug">
                                {res.name}
                              </h4>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md border shrink-0 ${lvlConfig.badge}`}
                              >
                                {lvlConfig.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {res.content || res.primaryLinkLabel || 'Mở tài liệu'}
                              </p>

                              {res.originLink && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenUrl(res.originLink);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600 shrink-0 transition"
                                  title="Mở bản tổng hợp (Origin)"
                                >
                                  Origin ↗
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {res.primaryLink && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyLink(res.primaryLink, res.id, e)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                title="Copy primary link"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleTogglePin(res.id, e)}
                              className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition cursor-pointer active:scale-90"
                              title="Bỏ ghim"
                            >
                              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                            </button>

                            <div className="p-1 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                              <ExternalLink className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ALL PROJECT RESOURCES */}
            {activeTab === 'ALL' && (
              <div className="space-y-2">
                {filteredAllResources.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    Không tìm thấy tài liệu phù hợp với điều kiện lọc.
                  </div>
                ) : (
                  filteredAllResources.map((res) => {
                    const isPinned = pinnedIds.includes(res.id);
                    const visual = getToolVisual(res.tool);
                    const lvlConfig = LEVEL_COMPACT[res.level] || {
                      label: res.level,
                      badge: 'bg-slate-100 text-slate-700',
                    };
                    const isCopied = copiedId === res.id;

                    return (
                      <div
                        key={res.id}
                        onClick={() => handleOpenUrl(res.primaryLink)}
                        className={`group relative flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer border-l-4 ${
                          visual.borderLeft
                        } ${
                          isPinned
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60 shadow-2xs hover:border-amber-400'
                            : 'bg-white dark:bg-slate-800/95 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md'
                        }`}
                      >
                        {/* Tool Icon container */}
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform group-hover:scale-105 ${visual.iconBox}`}
                        >
                          {visual.icon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate leading-snug">
                              {res.name}
                            </h4>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md border shrink-0 ${lvlConfig.badge}`}
                            >
                              {lvlConfig.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {res.content || res.primaryLinkLabel || 'Mở tài liệu'}
                            </p>

                            {res.originLink && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenUrl(res.originLink);
                                }}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-600 shrink-0 transition"
                                title="Mở bản tổng hợp (Origin)"
                              >
                                Origin ↗
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {res.primaryLink && (
                            <button
                              type="button"
                              onClick={(e) => handleCopyLink(res.primaryLink, res.id, e)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                              title="Copy primary link"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(res.id, e)}
                            className={`p-1.5 rounded-lg transition cursor-pointer active:scale-90 ${
                              isPinned
                                ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/60'
                                : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-700'
                            }`}
                            title={isPinned ? 'Bỏ ghim khỏi Quick Links' : 'Ghim vào Quick Links'}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                isPinned ? 'fill-amber-400 text-amber-500' : ''
                              }`}
                            />
                          </button>

                          <div className="p-1 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                            <ExternalLink className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer Navigation Bar */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 text-xs">
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {totalPinnedCount > 0 ? (
                <span>
                  ⭐ Đã ghim <b>{totalPinnedCount}</b> link nhanh
                </span>
              ) : (
                <span>⚡ Bấm thẻ để mở link tức thì</span>
              )}
            </div>

            {onNavigateToResourceManager && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToResourceManager();
                }}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 hover:underline cursor-pointer transition active:scale-95"
              >
                <span>Quản lý Resource đầy đủ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
