'use client';

import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertTriangle, RefreshCw, Globe, Hash, ShieldCheck, Loader2 } from 'lucide-react';
import { Modal } from './common/Modal';
import { normalizeRoleToken, type RoleItem, type TelegramConfig } from '@/types/task';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleItem[];
  currentUserAccount?: string;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  roles,
  currentUserAccount,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  const [dbRootNode, setDbRootNode] = useState('');
  const [hasBotToken, setHasBotToken] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [customWebhookBaseUrl, setCustomWebhookBaseUrl] = useState('');

  const [enabled, setEnabled] = useState(true);
  const [chatId, setChatId] = useState('');
  const [defaultThreadId, setDefaultThreadId] = useState('');
  const [roleTopicInputs, setRoleTopicInputs] = useState<Record<string, string>>({});
  const [testRole, setTestRole] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /**
   * Tự động tách Group Chat ID (-100...) và Topic Thread ID khi người dùng dán trực tiếp link Telegram:
   * - Copy Topic Link:   https://t.me/c/2481234567/12
   * - Copy Message Link: https://t.me/c/2481234567/12/34  (hoặc ?thread=12)
   */
  const parseTelegramLink = (raw: string): { chatId?: string; threadId?: string } | null => {
    const trimmed = String(raw || '').trim();
    const privateMatch = trimmed.match(/t\.me\/c\/(\d+)(?:\/(\d+))?(?:\/(\d+))?/i);
    if (privateMatch) {
      const internalGroupId = privateMatch[1];
      const seg1 = privateMatch[2];
      const seg2 = privateMatch[3];
      const queryThread = trimmed.match(/[?&]thread=(\d+)/i)?.[1];
      return {
        chatId: `-100${internalGroupId}`,
        threadId: queryThread || (seg2 ? seg1 : seg1),
      };
    }
    return null;
  };

  const handleChatIdChange = (val: string) => {
    const parsed = parseTelegramLink(val);
    if (parsed?.chatId) {
      setChatId(parsed.chatId);
      setFeedback({
        type: 'success',
        text: `Đã tự tách Group Chat ID = ${parsed.chatId} từ link Telegram!`,
      });
      return;
    }
    setChatId(val);
  };

  const handleRoleTopicInputChange = (roleCode: string, val: string) => {
    const parsed = parseTelegramLink(val);
    if (parsed) {
      if (parsed.chatId) {
        setChatId(parsed.chatId);
      }
      if (parsed.threadId) {
        setRoleTopicInputs((prev) => ({
          ...prev,
          [roleCode]: parsed.threadId!,
        }));
      }
      setFeedback({
        type: 'success',
        text: `Đã tự tách từ link Telegram: Group Chat ID = ${parsed.chatId}${parsed.threadId ? ` • Topic ${roleCode} = ${parsed.threadId}` : ''}. Nhớ bấm "Lưu cấu hình"!`,
      });
      return;
    }
    setRoleTopicInputs((prev) => ({
      ...prev,
      [roleCode]: val.replace(/[^\d]/g, ''),
    }));
  };

  const loadConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/telegram/config', {
        cache: 'no-store',
        headers: {
          'x-saho-account': currentUserAccount || '',
        },
      });
      const data = await res.json();
      if (data.ok) {
        setDbRootNode(data.dbRootNode || '');
        setHasBotToken(Boolean(data.hasBotToken));
        setBotUsername(data.botUsername || '');
        setWebhookUrl(data.webhookUrl || '');

        const cfg: TelegramConfig = data.config || { enabled: true, chatId: '', roleTopicMap: {} };
        setEnabled(Boolean(cfg.enabled));
        setChatId(cfg.chatId || '');
        setDefaultThreadId(cfg.defaultThreadId ? String(cfg.defaultThreadId) : '');

        const mapInputs: Record<string, string> = {};
        const storedMap = cfg.roleTopicMap || {};
        roles.forEach((r) => {
          const norm = normalizeRoleToken(r.code);
          const matchedVal =
            storedMap[norm] ??
            Object.entries(storedMap).find(([k]) => normalizeRoleToken(k) === norm)?.[1];
          mapInputs[r.code] = matchedVal ? String(matchedVal) : '';
        });
        setRoleTopicInputs(mapInputs);
      } else {
        setFeedback({ type: 'error', text: data.error || 'Không thể tải cấu hình Telegram.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Lỗi kết nối API cấu hình Telegram.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const roleTopicMap: Record<string, number> = {};
      Object.entries(roleTopicInputs).forEach(([roleCode, rawThread]) => {
        const num = Number(String(rawThread || '').trim());
        const norm = normalizeRoleToken(roleCode);
        if (norm && Number.isFinite(num) && num > 0) {
          roleTopicMap[norm] = num;
        }
      });

      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-saho-account': currentUserAccount || '',
        },
        body: JSON.stringify({
          action: 'save',
          requesterAccount: currentUserAccount || '',
          config: {
            enabled,
            chatId: chatId.trim(),
            defaultThreadId: defaultThreadId.trim() ? Number(defaultThreadId.trim()) : undefined,
            roleTopicMap,
            updatedBy: currentUserAccount || 'admin',
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: 'success', text: `Đã lưu cấu hình Telegram vào DB (${dbRootNode})!` });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Lưu cấu hình thất bại.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Lỗi khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setRegisteringWebhook(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-saho-account': currentUserAccount || '',
        },
        body: JSON.stringify({
          action: 'register_webhook',
          requesterAccount: currentUserAccount || '',
          webhookBaseUrl: customWebhookBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWebhookUrl(data.webhookUrl || '');
        setFeedback({ type: 'success', text: `Đã đăng ký Webhook thành công: ${data.webhookUrl}` });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Đăng ký Webhook thất bại.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Lỗi kết nối khi đăng ký Webhook.' });
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const handleTestMessage = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      // Save first so test uses the latest typed chatId/topic mapping
      await handleSave();
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-saho-account': currentUserAccount || '',
        },
        body: JSON.stringify({
          action: 'test_message',
          requesterAccount: currentUserAccount || '',
          chatId: chatId.trim(),
          role: testRole,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({
          type: 'success',
          text: `Đã gửi tin nhắn kiểm tra thành công (Message ID: ${data.messageId})! Hãy kiểm tra trên Telegram.`,
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Gửi tin nhắn test thất bại.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Lỗi khi gửi tin nhắn test.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      zIndex="z-[145]"
      icon={
        <div className="w-9 h-9 rounded-[10px] bg-[rgba(24,144,255,0.14)] text-[#1890FF] flex items-center justify-center shrink-0">
          <Send className="w-4 h-4" />
        </div>
      }
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>Cấu Hình Bot Telegram</span>
          {dbRootNode && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                dbRootNode === 'gmm-task-test'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              DB: {dbRootNode}
            </span>
          )}
        </div>
      }
      description="Tự động bắn thông báo xin nhận task vào đúng Topic của từng Role kèm nút Duyệt / Từ chối trực tiếp trên Telegram."
      bodyClassName="space-y-4"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading}
            className="saho-modal-btn-secondary inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="saho-modal-btn-secondary">
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="saho-modal-btn-primary inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      }
    >
      {/* Trạng thái Bot */}
      <div
        className={`p-3 rounded-[10px] border text-xs flex items-start gap-2.5 ${
          hasBotToken
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
        }`}
      >
        {hasBotToken ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
        )}
        <div className="space-y-1 min-w-0 flex-1">
          <div className="font-semibold">
            {hasBotToken
              ? `Bot đã sẵn sàng${botUsername ? ` (@${botUsername})` : ''}`
              : 'Chưa phát hiện TELEGRAM_BOT_TOKEN trong biến môi trường (.env.local / Vercel)'}
          </div>
          {webhookUrl ? (
            <div className="text-[11px] opacity-85 break-all">
              Webhook hiện tại: <code className="font-mono font-semibold">{webhookUrl}</code>
            </div>
          ) : (
            <div className="text-[11px] opacity-85">
              Chưa đăng ký Webhook (cần đăng ký Webhook HTTPS để dùng nút Duyệt trực tiếp trên Telegram & lệnh <code>/bindtopic</code>).
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[10px] border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Bật/Tắt + Group Chat ID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-[10px] bg-white dark:bg-slate-800/70 border border-[#E8E9EF] dark:border-slate-700">
          <div>
            <div className="text-xs font-semibold text-[#1D202A] dark:text-slate-100">
              Bật thông báo Telegram khi thành viên xin nhận task
            </div>
            <div className="text-[11px] text-[#838899] dark:text-slate-400">
              Chỉ Admin hoặc Leader / Advisor của đúng Role đó mới có quyền bấm Duyệt / Từ chối.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-[#1890FF] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#1D202A] dark:text-slate-200 mb-1.5">
            Group Chat ID (hoặc dán thẳng link t.me/c/...)
          </label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => handleChatIdChange(e.target.value)}
            placeholder="-100... hoặc dán link tin nhắn/topic"
            className="saho-modal-input w-full font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#1D202A] dark:text-slate-200 mb-1.5">
            Topic Mặc Định (Fallback Thread ID)
          </label>
          <input
            type="text"
            value={defaultThreadId}
            onChange={(e) => setDefaultThreadId(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Để trống nếu gửi vào General"
            className="saho-modal-input w-full font-mono"
          />
        </div>
      </div>

      {/* Role -> Topic Mapping */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#1D202A] dark:text-slate-100 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-[#1890FF]" />
            <span>Mapping Role → Topic Thread ID</span>
          </div>
          <span className="text-[11px] text-[#838899]">
            Mẹo: chuột phải vào Topic → <b>Copy Topic Link</b> rồi dán thẳng vào ô bên dưới
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-[10px] bg-white/80 dark:bg-slate-800/50 border border-[#E8E9EF] dark:border-slate-700">
          {roles.map((r) => (
            <div key={r.id || r.code} className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate" title={`${r.code} - ${r.name}`}>
                {r.code} <span className="font-normal text-[#838899]">({r.name})</span>
              </label>
              <input
                type="text"
                value={roleTopicInputs[r.code] || ''}
                onChange={(e) => handleRoleTopicInputChange(r.code, e.target.value)}
                placeholder="Dán link Topic hoặc ID..."
                className="saho-modal-input w-full font-mono !h-[32px]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Webhook & Test */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-[10px] bg-white dark:bg-slate-800/70 border border-[#E8E9EF] dark:border-slate-700 space-y-2">
          <div className="text-xs font-semibold text-[#1D202A] dark:text-slate-100 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#1890FF]" />
            <span>Đăng ký Webhook (cho nút Duyệt)</span>
          </div>
          <input
            type="text"
            value={customWebhookBaseUrl}
            onChange={(e) => setCustomWebhookBaseUrl(e.target.value)}
            placeholder="https://gmm-task.vercel.app (hoặc ngrok HTTPS)"
            className="saho-modal-input w-full text-[11px]"
          />
          <button
            type="button"
            onClick={handleRegisterWebhook}
            disabled={registeringWebhook || !hasBotToken}
            className="w-full saho-modal-btn-secondary inline-flex items-center justify-center gap-1.5"
          >
            {registeringWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-[#1890FF]" />}
            <span>Đăng ký Webhook</span>
          </button>
        </div>

        <div className="p-3 rounded-[10px] bg-white dark:bg-slate-800/70 border border-[#E8E9EF] dark:border-slate-700 space-y-2">
          <div className="text-xs font-semibold text-[#1D202A] dark:text-slate-100 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-emerald-600" />
            <span>Gửi tin nhắn kiểm tra</span>
          </div>
          <select
            value={testRole}
            onChange={(e) => setTestRole(e.target.value)}
            className="saho-modal-input w-full text-[11px]"
          >
            <option value="">Topic mặc định / General</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                Topic của Role {r.code} ({r.name})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTestMessage}
            disabled={testing || !hasBotToken || !chatId.trim()}
            className="w-full saho-modal-btn-secondary inline-flex items-center justify-center gap-1.5"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-emerald-600" />}
            <span>Gửi test ngay</span>
          </button>
        </div>
      </div>

      {/* Hướng dẫn nhanh lấy ID & gắn Topic */}
      <div className="p-3 rounded-[10px] bg-[rgba(24,144,255,0.06)] dark:bg-sky-950/30 border border-[rgba(24,144,255,0.18)] text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
        <div className="font-bold text-[#1D202A] dark:text-slate-100">Cách lấy ID nhanh nhất (không cần gõ lệnh):</div>
        <div>
          1. Mở Telegram Desktop → vào nhóm → <b>chuột phải lên tên Topic</b> (hoặc 1 tin nhắn trong Topic) → chọn <b>Copy Topic Link</b> (hoặc <b>Copy Message Link</b>).
        </div>
        <div>
          2. <b>Dán thẳng link đó</b> (VD: <code className="px-1 py-0.5 rounded bg-white/80 dark:bg-slate-800 font-mono">https://t.me/c/1234567890/5</code>) vào ô Role tương ứng ở trên → hệ thống tự tách sẵn <b>Group Chat ID</b> và <b>Thread ID</b> cho bạn!
        </div>
        <div>
          3. Bấm <b>Lưu cấu hình</b> rồi bấm <b>Gửi test ngay</b> để kiểm tra. Webhook đã tối ưu chỉ lắng nghe sự kiện bấm nút Duyệt/Từ chối (<code>callback_query</code>) để không tốn tài nguyên Vercel khi nhóm chat bình thường.
        </div>
      </div>
    </Modal>
  );
};
