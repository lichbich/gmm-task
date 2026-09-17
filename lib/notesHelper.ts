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
