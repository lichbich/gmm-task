import React from 'react';
import { User, Task, getUserRoleColorClass } from '../types/task';

export interface NoteReplyContext {
  replyAuthor: string;
  replyText: string;
}

export interface ParsedNote {
  raw: string;
  isTagged: boolean;
  authorInfo: string;
  baseAuthor: string;
  editedTime?: string;
  replyTo?: NoteReplyContext;
  messageBody: string;
  isMyMessage: boolean;
}

export function parseNoteLine(
  line: string,
  currentUser: { name?: string; account?: string } | null | undefined
): ParsedNote {
  const isTagged = line.startsWith('[') && line.includes(']:');
  if (!isTagged) {
    return {
      raw: line,
      isTagged: false,
      authorInfo: '',
      baseAuthor: '',
      messageBody: line,
      isMyMessage: false,
    };
  }

  const match = line.match(/^\[(.*?)\]:\s*([\s\S]*)$/);
  if (!match) {
    return {
      raw: line,
      isTagged: false,
      authorInfo: '',
      baseAuthor: '',
      messageBody: line,
      isMyMessage: false,
    };
  }

  let authorInfo = match[1].trim();
  const messageBody = match[2];

  let replyTo: NoteReplyContext | undefined = undefined;

  // Match reply format in header: "[Author - Time | reply: TargetAuthor | quote: Snippet]"
  const replyMatch = authorInfo.match(/^(.*?)\s*\|\s*reply:\s*([^|]+)\s*\|\s*quote:\s*(.+)$/i);
  if (replyMatch) {
    authorInfo = replyMatch[1].trim();
    replyTo = {
      replyAuthor: replyMatch[2].trim(),
      replyText: replyMatch[3].trim(),
    };
  }

  let baseAuthor = authorInfo;
  let editedTime: string | undefined = undefined;

  // Match pattern like "Name (Role) - HH:mm DD/MM • đã sửa HH:mm DD/MM" or "(đã sửa HH:mm DD/MM)"
  const editMatch = authorInfo.match(/^(.*?)(?:\s*(?:•|\(|\[)?\s*đã\s*sửa\s*:?\s*([^()\]]+)(?:\)|\])?)?$/i);
  if (editMatch && editMatch[2]) {
    baseAuthor = editMatch[1].trim();
    editedTime = editMatch[2].trim();
  }

  const isMyMessage = Boolean(
    currentUser &&
      baseAuthor &&
      ((currentUser.name && baseAuthor.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        (currentUser.account && baseAuthor.toLowerCase().includes(currentUser.account.toLowerCase())))
  );

  return {
    raw: line,
    isTagged: true,
    authorInfo,
    baseAuthor,
    editedTime,
    replyTo,
    messageBody,
    isMyMessage,
  };
}

export function formatNewNoteLine(
  content: string,
  currentUser: { name?: string; specializations?: string[]; role?: string } | null | undefined,
  replyTo?: { author: string; text: string } | null
): string {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
  const userRole = currentUser?.specializations?.[0] || currentUser?.role || 'Member';
  const senderTag = currentUser ? `${currentUser.name} (${userRole})` : 'Thành viên';

  if (replyTo && replyTo.author && replyTo.text) {
    const sanitizedQuote = replyTo.text
      .replace(/\r?\n+/g, ' ')
      .replace(/\|/g, '/')
      .trim()
      .slice(0, 80);
    const sanitizedAuthor = replyTo.author.replace(/\|/g, '/').trim();
    return `[${senderTag} - ${timeStr} | reply: ${sanitizedAuthor} | quote: ${sanitizedQuote}]: ${content.trim()}`;
  }

  return `[${senderTag} - ${timeStr}]: ${content.trim()}`;
}

export function formatEditedNoteLine(
  originalLine: string,
  newContent: string,
  currentUser: { name?: string; specializations?: string[]; role?: string; account?: string } | null | undefined
): string {
  const now = new Date();
  const editTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  const parsed = parseNoteLine(originalLine, currentUser);
  const userRole = currentUser?.specializations?.[0] || currentUser?.role || 'Member';
  const fallbackSenderTag = currentUser ? `${currentUser.name} (${userRole})` : 'Thành viên';
  const baseHeader = parsed.baseAuthor || `${fallbackSenderTag} - ${editTimeStr}`;

  let replySegment = '';
  if (parsed.replyTo) {
    replySegment = ` | reply: ${parsed.replyTo.replyAuthor} | quote: ${parsed.replyTo.replyText}`;
  }

  return `[${baseHeader}${replySegment} • đã sửa ${editTimeStr}]: ${newContent.trim()}`;
}

/**
 * Extract distinct @mention account tokens from text (e.g. '@HaiLH' -> ['HaiLH'])
 * If `users` is provided, filters to only registered valid users.
 */
export function extractMentions(text: string, users?: User[]): string[] {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g);
  if (!matches) return [];

  const rawTokens = matches.map((m) => m.slice(1).trim()).filter(Boolean);
  const uniqueTokens = Array.from(new Set(rawTokens));

  if (!users || users.length === 0) {
    return uniqueTokens;
  }

  return uniqueTokens.filter((token) => {
    const lower = token.toLowerCase();
    return users.some(
      (u) => u.account && u.account.toLowerCase() === lower && !u.disabled && u.status !== 'disabled'
    );
  });
}

/**
 * Extract all accounts participating in this task's conversation thread:
 * 1. Current Assignee
 * 2. Task Creator
 * 3. Any user who has sent a message in the notes history
 * 4. Any user who was @mentioned in the notes history
 */
export function extractDiscussionParticipants(
  notesText: string,
  task: Task,
  users: User[] = []
): string[] {
  const participants = new Set<string>();

  // 1. Assignee
  if (task.assigneeAccount && task.assigneeAccount.trim()) {
    participants.add(task.assigneeAccount.trim());
  }

  // 2. Creator
  if (task.createdBy) {
    const creatorMatch = task.createdBy.match(/@([a-zA-Z0-9._-]+)/);
    if (creatorMatch) {
      participants.add(creatorMatch[1].trim());
    } else {
      // Find by full name or account prefix
      const creatorRaw = task.createdBy.trim();
      const creatorUser = users.find(
        (u) =>
          creatorRaw.toLowerCase().includes(u.name.toLowerCase()) ||
          creatorRaw.toLowerCase().includes(u.account.toLowerCase())
      );
      if (creatorUser) {
        participants.add(creatorUser.account);
      }
    }
  }

  // 3. All previous commenters in notes lines
  if (notesText) {
    const lines = notesText.split('\n').filter(Boolean);
    for (const line of lines) {
      const parsed = parseNoteLine(line, null);
      if (parsed.isTagged && parsed.baseAuthor) {
        const authorStr = parsed.baseAuthor.toLowerCase();
        const matchedUser = users.find(
          (u) =>
            (u.name && authorStr.includes(u.name.toLowerCase())) ||
            (u.account && authorStr.includes(u.account.toLowerCase()))
        );
        if (matchedUser) {
          participants.add(matchedUser.account);
        }
      }
      if (parsed.replyTo && parsed.replyTo.replyAuthor) {
        const replyAuthorStr = parsed.replyTo.replyAuthor.toLowerCase();
        const matchedUser = users.find(
          (u) =>
            (u.name && replyAuthorStr.includes(u.name.toLowerCase())) ||
            (u.account && replyAuthorStr.includes(u.account.toLowerCase()))
        );
        if (matchedUser) {
          participants.add(matchedUser.account);
        }
      }
    }

    // 4. All @mentions in notes history
    const allMentions = extractMentions(notesText, users);
    allMentions.forEach((acc) => participants.add(acc));
  }

  // Filter out any disabled accounts and normalize
  return Array.from(participants).filter((acc) => {
    const lower = acc.toLowerCase();
    return users.some(
      (u) => u.account.toLowerCase() === lower && !u.disabled && u.status !== 'disabled'
    );
  });
}

/**
 * Render sleek quoted message preview (Telegram / Messenger style)
 */
export function NoteReplyQuoteBlock({
  replyTo,
  onClick,
}: {
  replyTo: NoteReplyContext;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-3 border-indigo-500 bg-slate-100/90 dark:bg-slate-900/60 text-[11px] space-y-0.5 select-none transition-all group ${
        onClick
          ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/60 hover:border-indigo-600 active:scale-[0.98]'
          : ''
      }`}
      title={onClick ? 'Bấm để trượt đến tin nhắn được trả lời' : undefined}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 text-[10.5px] truncate">
          <span className="text-xs group-hover:-translate-x-0.5 transition-transform">↩</span>
          <span className="truncate">{replyTo.replyAuthor}</span>
        </div>
        {onClick && (
          <span className="text-[9.5px] text-indigo-400 dark:text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline">
            Xem tin nhắn gốc ↗
          </span>
        )}
      </div>
      <p className="text-slate-600 dark:text-slate-300 italic truncate text-[11px] leading-tight">
        "{replyTo.replyText}"
      </p>
    </div>
  );
}

/**
 * Render message body highlighting @mentions with their role level color
 * (clean text highlight, no pill/background/borders as requested)
 */
export function renderFormattedMessage(text: string, users: User[] = []): React.ReactNode {
  if (!text) return null;

  // Split text by @mention tokens while retaining delimiters
  const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          const accountToken = part.slice(1);
          const matchedUser = users.find(
            (u) => u.account && u.account.toLowerCase() === accountToken.toLowerCase()
          );

          if (matchedUser) {
            return (
              <span
                key={`mention-${index}-${accountToken}`}
                className={`font-bold inline-block ${getUserRoleColorClass(matchedUser.role)}`}
              >
                @{matchedUser.account}
              </span>
            );
          }
        }

        return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
}
