import { RoleItem, normalizeRoleToken } from '../types/task';

/**
 * Task Title Role Prefix Helper for Saho Task System.
 * Standardizes prefixes for all teams (Design, BA, FE, BE, DevOps, AI, PO, SA, QC, QA, BOP, OPS, etc.).
 *
 * Example prefixes:
 * - Designer / Design -> "Design | " or "DES | "
 * - BA -> "BA | "
 * - FE / Frontend -> "FE | "
 * - BE / Backend -> "BE | "
 * - DevOps -> "DevOps | " or "OPS | "
 * - AI -> "AI | "
 * - PO -> "PO | "
 * - SA -> "SA | "
 * - QC / Tester -> "QC | "
 * - QA -> "QA | "
 */

const ROLE_PREFIX_MAP: Record<string, string> = {
  designer: 'Design | ',
  design: 'Design | ',
  des: 'DES | ',
  fe: 'FE | ',
  frontend: 'FE | ',
  be: 'BE | ',
  backend: 'BE | ',
  devops: 'DevOps | ',
  ops: 'OPS | ',
  infra: 'DevOps | ',
  ba: 'BA | ',
  'business analyst': 'BA | ',
  ai: 'AI | ',
  po: 'PO | ',
  'product owner': 'PO | ',
  sa: 'SA | ',
  'solution architect': 'SA | ',
  qc: 'QC | ',
  qa: 'QA | ',
  tester: 'QC | ',
  pm: 'PM | ',
  bop: 'BOP | ',
  'back office': 'BOP | ',
};

/**
 * Escape a string for use in a RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a token string represents a recognized role in the system
 */
export function isRecognizedRoleToken(token: string, roles?: RoleItem[]): boolean {
  if (!token) return false;
  const trimmed = token.trim();
  const tLower = trimmed.toLowerCase();
  const tUpper = trimmed.toUpperCase();

  // 1. Dynamic roles check
  if (roles && roles.length > 0) {
    const found = roles.some(
      (r) =>
        r.code?.trim().toUpperCase() === tUpper ||
        r.name?.trim().toLowerCase() === tLower ||
        normalizeRoleToken(r.code) === normalizeRoleToken(trimmed) ||
        normalizeRoleToken(r.name) === normalizeRoleToken(trimmed)
    );
    if (found) return true;
  }

  // 2. Static maps check
  if (ROLE_PREFIX_MAP[tLower]) return true;

  const norm = normalizeRoleToken(trimmed);
  if (
    norm &&
    [
      'design',
      'fe',
      'be',
      'ba',
      'qa',
      'qc',
      'devops',
      'ai',
      'po',
      'pm',
      'sa',
      'bop',
      'ops',
      'back office',
    ].includes(norm)
  ) {
    return true;
  }

  return false;
}

/**
 * Get the standard role prefix string for a role or specialization.
 * Always prioritizes dynamic role codes defined in Admin Role Management.
 * E.g., 'QC' -> 'QC | ', 'BA' -> 'BA | ', 'FE' -> 'FE | '
 */
export function getRoleTaskPrefix(role?: string, roles?: RoleItem[]): string {
  if (!role) return '';
  const trimmed = role.trim();

  // 1. Match against dynamic roles from database
  if (roles && roles.length > 0) {
    // 1a. Direct code match (case-insensitive)
    const byCode = roles.find((r) => r.code?.trim().toUpperCase() === trimmed.toUpperCase());
    if (byCode && byCode.code) {
      return `${byCode.code.trim()} | `;
    }
    // 1b. Direct full name match (case-insensitive)
    const byName = roles.find((r) => r.name?.trim().toLowerCase() === trimmed.toLowerCase());
    if (byName && byName.code) {
      return `${byName.code.trim()} | `;
    }
    // 1c. Token match on code or name
    const token = normalizeRoleToken(trimmed);
    const byToken = roles.find(
      (r) => normalizeRoleToken(r.code) === token || normalizeRoleToken(r.name) === token
    );
    if (byToken && byToken.code) {
      return `${byToken.code.trim()} | `;
    }
    // 1d. Fuzzy contains match
    const fuzzy = roles.find((r) => {
      const c = r.code?.trim().toLowerCase();
      const n = r.name?.trim().toLowerCase();
      const t = trimmed.toLowerCase();
      return (
        (c && (c === t || t.includes(c) || c.includes(t))) ||
        (n && (n === t || t.includes(n) || n.includes(t)))
      );
    });
    if (fuzzy && fuzzy.code) {
      return `${fuzzy.code.trim()} | `;
    }
  }

  // 2. Static lookup
  const lower = trimmed.toLowerCase();
  if (ROLE_PREFIX_MAP[lower]) {
    return ROLE_PREFIX_MAP[lower];
  }

  const token = normalizeRoleToken(trimmed);
  if (ROLE_PREFIX_MAP[token]) {
    return ROLE_PREFIX_MAP[token];
  }

  // 3. Fallback for uppercase acronyms or raw role code
  const r = trimmed.toUpperCase();
  if (
    r === 'FE' ||
    r === 'BE' ||
    r === 'BA' ||
    r === 'QA' ||
    r === 'QC' ||
    r === 'PO' ||
    r === 'PM' ||
    r === 'SA' ||
    r === 'AI' ||
    r === 'OPS' ||
    r === 'BOP' ||
    r === 'DES'
  ) {
    return `${r} | `;
  }

  return `${trimmed} | `;
}

/**
 * Checks if a task title already starts with a role prefix.
 * If a role is provided, checks strictly if it starts with THAT role's prefix.
 * If role is omitted, checks if it starts with ANY pipe or bracket prefix.
 */
export function hasTaskPrefix(title: string, role?: string, roles?: RoleItem[]): boolean {
  if (!title) return false;
  const trimmed = title.trim();

  // 1. If role is provided, check specifically for this role's prefix
  if (role) {
    const rolePrefix = getRoleTaskPrefix(role, roles);
    if (rolePrefix && trimmed.toLowerCase().startsWith(rolePrefix.toLowerCase())) {
      return true;
    }
    const directPrefix = `${role.trim().toLowerCase()} |`;
    if (trimmed.toLowerCase().startsWith(directPrefix)) {
      return true;
    }
    const bracketPattern = new RegExp(`^\\[${escapeRegExp(role.trim())}\\]\\s*`, 'i');
    if (bracketPattern.test(trimmed)) {
      return true;
    }
    return false;
  }

  // 2. If NO role was provided, check if starts with ANY pipe prefix (e.g. "Design | ", "BA | ", "FE | ", etc.)
  const pipePrefixRegex = /^[A-Za-z0-9_.\-&/]+\s*\|\s+/;
  if (pipePrefixRegex.test(trimmed)) {
    return true;
  }

  // 3. Check bracket prefix (e.g. "[Design] ", "[BA] ")
  const bracketPrefixRegex = /^\[[A-Za-z0-9_.\-&/]+\]\s+/;
  if (bracketPrefixRegex.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Ensures that a task title has the appropriate role prefix.
 * Guarantees that:
 * 1. If the title starts with the correct role prefix, standardizes casing and preserves it.
 * 2. If the title starts with a MISMATCHED role prefix (e.g. "QA | ..." on a QC task),
 *    automatically replaces it with the correct role prefix ("QC | ...").
 * 3. If missing, prepends the correct role prefix.
 *
 * Example:
 * - ensureTaskTitlePrefix("Discuss week progress...", "QC") -> "QC | Discuss week progress..."
 * - ensureTaskTitlePrefix("QA | Discuss week progress...", "QC") -> "QC | Discuss week progress..."
 */
export function ensureTaskTitlePrefix(
  title: string,
  role?: string,
  roles?: RoleItem[]
): string {
  if (!title || !title.trim()) return title || '';
  const trimmed = title.trim();
  if (!role) return trimmed;

  const targetPrefix = getRoleTaskPrefix(role, roles);
  if (!targetPrefix) return trimmed;

  // 1. Check if title already starts with the matching role prefix
  if (trimmed.toLowerCase().startsWith(targetPrefix.toLowerCase())) {
    return `${targetPrefix}${trimmed.slice(targetPrefix.length).trimStart()}`;
  }
  const directPrefix = `${role.trim().toLowerCase()} |`;
  if (trimmed.toLowerCase().startsWith(directPrefix)) {
    return `${targetPrefix}${trimmed.slice(directPrefix.length).trimStart()}`;
  }

  // 2. Check bracket prefix matching this role (e.g. "[QC] Title" -> "QC | Title")
  const bracketMatchSame = new RegExp(`^\\[${escapeRegExp(role.trim())}\\]\\s*`, 'i');
  if (bracketMatchSame.test(trimmed)) {
    return `${targetPrefix}${trimmed.replace(bracketMatchSame, '').trimStart()}`;
  }

  // 3. Check if starts with a recognized role prefix that belongs to a DIFFERENT role
  // e.g. "QA | ..." when current role is "QC" -> replace with "QC | ..."
  const pipeMatch = trimmed.match(/^([A-Za-z0-9_.\-&/]+)\s*\|\s*(.*)$/);
  if (pipeMatch) {
    const existingToken = pipeMatch[1].trim();
    const remainingText = pipeMatch[2].trim();
    if (isRecognizedRoleToken(existingToken, roles)) {
      return `${targetPrefix}${remainingText}`;
    }
  }

  // Bracket format: e.g. "[QA] ..." when current role is "QC"
  const bracketMatchOther = trimmed.match(/^\[([A-Za-z0-9_.\-&/]+)\]\s*(.*)$/);
  if (bracketMatchOther) {
    const existingBracketToken = bracketMatchOther[1].trim();
    const remainingText = bracketMatchOther[2].trim();
    if (isRecognizedRoleToken(existingBracketToken, roles)) {
      return `${targetPrefix}${remainingText}`;
    }
  }

  // 4. If no recognized prefix was present, prepend targetPrefix
  return `${targetPrefix}${trimmed}`;
}
