import React from 'react';
import { User, Task, getUserRoleColorClass } from '../types/task';

export interface ParsedNote {
  raw: string;
  isTagged: boolean;
  authorInfo: string;
  baseAuthor: string;
  editedTime?: string;
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

  const authorInfo = match[1].trim();
  const messageBody = match[2];

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
    messageBody,
    isMyMessage,
  };
}

export function formatNewNoteLine(
  content: string,
  currentUser: { name?: string; specializations?: string[]; role?: string } | null | undefined
): string {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
  const userRole = currentUser?.specializations?.[0] || currentUser?.role || 'Member';
  const senderTag = currentUser ? `${currentUser.name} (${userRole})` : 'Thành viên';
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

  return `[${baseHeader} • đã sửa ${editTimeStr}]: ${newContent.trim()}`;
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
