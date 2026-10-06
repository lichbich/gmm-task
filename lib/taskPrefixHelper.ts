/**
 * Task Title Role Prefix Helper for Saho Task System.
 * Standardizes prefixes for all teams (Design, BA, FE, BE, DevOps, AI, PO, SA, QC, QA, etc.).
 *
 * Example prefixes:
 * - Designer / Design -> "Design | "
 * - BA -> "BA | "
 * - FE / Frontend -> "FE | "
 * - BE / Backend -> "BE | "
 * - DevOps -> "DevOps | "
 * - AI -> "AI | "
 * - PO -> "PO | "
 * - SA -> "SA | "
 * - QC / Tester -> "QC | "
 * - QA -> "QA | "
 */

const ROLE_PREFIX_MAP: Record<string, string> = {
  designer: 'Design | ',
  design: 'Design | ',
  fe: 'FE | ',
  frontend: 'FE | ',
  be: 'BE | ',
  backend: 'BE | ',
  devops: 'DevOps | ',
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
};

/**
 * Get the standard role prefix string for a role or specialization.
 * E.g., 'Designer' -> 'Design | ', 'BA' -> 'BA | ', 'FE' -> 'FE | '
 */
export function getRoleTaskPrefix(role?: string): string {
  if (!role) return '';
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase();

  if (ROLE_PREFIX_MAP[lower]) {
    return ROLE_PREFIX_MAP[lower];
  }

  // If role is all uppercase or standard acronym, keep it
  return `${trimmed} | `;
}

/**
 * Checks if a task title already starts with a role prefix.
 * Checks against:
 * 1. Current role prefix (e.g. "Design | ", "Designer | ", "BA | ")
 * 2. Any role/tag prefix with a pipe: `^[A-Za-z0-9_.\-&/]+\s*\|\s+`
 * 3. Any bracket prefix: `^\[[A-Za-z0-9_.\-&/]+\]\s+`
 */
export function hasTaskPrefix(title: string, role?: string): boolean {
  if (!title) return false;
  const trimmed = title.trim();

  // 1. Check if starts with the matching role prefix directly
  if (role) {
    const rolePrefix = getRoleTaskPrefix(role);
    if (rolePrefix && trimmed.toLowerCase().startsWith(rolePrefix.toLowerCase())) {
      return true;
    }
    const directPrefix = `${role.trim().toLowerCase()} |`;
    if (trimmed.toLowerCase().startsWith(directPrefix)) {
      return true;
    }
  }

  // 2. Check if starts with ANY pipe prefix (e.g. "Design | ", "BA | ", "FE | ", "BE | ", "DevOps | ", etc.)
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
 * If the title already contains a prefix, it is returned unchanged.
 * If missing, the role prefix (e.g. "Design | ") is automatically prepended.
 *
 * Example:
 * - ensureTaskTitlePrefix("Build Complex Module Components", "Designer")
 *   -> "Design | Build Complex Module Components"
 * - ensureTaskTitlePrefix("Design | System login flow", "Designer")
 *   -> "Design | System login flow"
 * - ensureTaskTitlePrefix("BA | Viết SRS", "BA")
 *   -> "BA | Viết SRS"
 */
export function ensureTaskTitlePrefix(title: string, role?: string): string {
  if (!title || !title.trim()) return title || '';
  const trimmed = title.trim();

  if (hasTaskPrefix(trimmed, role)) {
    return trimmed;
  }

  const prefix = getRoleTaskPrefix(role);
  if (!prefix) return trimmed;

  return `${prefix}${trimmed}`;
}
