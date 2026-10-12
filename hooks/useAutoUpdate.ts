'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { APP_VERSION, BUILD_ID, isNewerVersion, SystemVersionInfo } from '../lib/version';
import { database, ref, onValue, DB_ROOT_NODE } from '../lib/firebase';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const POLL_INTERVAL_MS = 3 * 60 * 1000; // Poll version every 3 minutes
const CHUNK_RELOAD_COOLDOWN_MS = 30 * 1000; // 30s cooldown between chunk auto-reloads

/**
 * Checks whether the current UI state is safe to reload
 * (i.e. user is not in the middle of typing in an input/textarea or having a modal open).
 */
export function isSafeToReload(): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Check if user is typing in an active input, textarea, or contentEditable element
  const activeEl = document.activeElement;
  if (activeEl) {
    const tag = activeEl.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (activeEl as HTMLElement).isContentEditable) {
      return false;
    }
  }

  // 2. Check if any modal backdrop or dialog is currently open in the DOM
  const modalBackdrops = document.querySelectorAll(
    '.modal-backdrop-transition, .modal-backdrop-animate, [role="dialog"]'
  );
  if (modalBackdrops.length > 0) {
    return false;
  }

  const fixedOverlays = document.querySelectorAll('.fixed.inset-0');
  const hasModalOverlay = Array.from(fixedOverlays).some((el) => {
    const cls = el.className || '';
    return cls.includes('bg-slate-900') || cls.includes('backdrop-blur');
  });

  if (hasModalOverlay) {
    return false;
  }

  return true;
}

export interface SundayMilestoneInfo {
  milestoneKey: string;
  type: 'SUNDAY_12H' | 'SUNDAY_16H';
  label: string;
}

/**
 * Checks if current time hits Sunday 12:00 or 16:00 milestone requiring a reload.
 * Ensures:
 * 1. Only triggers on Sunday (day 0).
 * 2. Does NOT trigger if already reloaded for this milestone today (persisted in localStorage).
 * 3. Does NOT trigger if page was mounted fresh AFTER the milestone time.
 */
export function getSundayMilestone(date: Date, mountTime: number): SundayMilestoneInfo | null {
  if (typeof window === 'undefined') return null;
  if (date.getDay() !== 0) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${d}`;

  const currentMs = date.getTime();
  const noon12 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0).getTime();
  const afternoon16 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0, 0, 0).getTime();

  // Clean up stale sunday markers from previous weeks
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('saho_sunday_reload_') && !k.includes(dateKey)) {
        localStorage.removeItem(k);
      }
    }
  } catch {}

  // 1. Check 16h milestone (4:00 PM Sunday)
  if (currentMs >= afternoon16) {
    const key16 = `saho_sunday_reload_${dateKey}_16h`;
    let is16Done = false;
    try {
      is16Done = Boolean(localStorage.getItem(key16));
    } catch {}

    if (!is16Done) {
      if (mountTime >= afternoon16) {
        // Page was loaded after 16:00 -> already has fresh afternoon state
        try {
          localStorage.setItem(key16, 'done');
        } catch {}
      } else {
        return {
          milestoneKey: key16,
          type: 'SUNDAY_16H',
          label: '16h chiều Chủ nhật',
        };
      }
    }
  }

  // 2. Check 12h milestone (12:00 PM Sunday)
  if (currentMs >= noon12) {
    const key12 = `saho_sunday_reload_${dateKey}_12h`;
    let is12Done = false;
    try {
      is12Done = Boolean(localStorage.getItem(key12));
    } catch {}

    if (!is12Done) {
      if (mountTime >= noon12) {
        // Page was loaded after 12:00 -> already has fresh noon state
        try {
          localStorage.setItem(key12, 'done');
        } catch {}
      } else {
        return {
          milestoneKey: key12,
          type: 'SUNDAY_12H',
          label: '12h trưa Chủ nhật',
        };
      }
    }
  }

  return null;
}

export function useAutoUpdate(customTime?: string) {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local')));

  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [newVersionInfo, setNewVersionInfo] = useState<Partial<SystemVersionInfo> | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [isIdle, setIsIdle] = useState<boolean>(false);

  // Sunday scheduled reload states
  const pageMountTimeRef = useRef<number>(Date.now());
  const [sundayMilestone, setSundayMilestone] = useState<SundayMilestoneInfo | null>(null);
  const sundayMilestoneRef = useRef<SundayMilestoneInfo | null>(null);
  const [dismissedSundayKey, setDismissedSundayKey] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const hasUpdateRef = useRef<boolean>(false);
  const hiddenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isReloadingRef = useRef<boolean>(false);

  // Synchronize ref
  useEffect(() => {
    hasUpdateRef.current = hasUpdate;
  }, [hasUpdate]);

  const reloadNow = useCallback(() => {
    if (typeof window === 'undefined' || isReloadingRef.current) return;
    isReloadingRef.current = true;
    if (sundayMilestoneRef.current) {
      try {
        localStorage.setItem(sundayMilestoneRef.current.milestoneKey, 'done');
      } catch {}
    }
    try {
      window.location.reload();
    } catch {
      window.location.href = window.location.href;
    }
  }, []);

  const checkSundaySchedule = useCallback(() => {
    const now = customTime ? new Date(customTime) : new Date();
    const milestone = getSundayMilestone(now, pageMountTimeRef.current);
    sundayMilestoneRef.current = milestone;
    setSundayMilestone(milestone);

    if (milestone) {
      // If tab is currently hidden and it's safe -> reload immediately in background
      if (document.hidden && isSafeToReload()) {
        reloadNow();
      }
    }
  }, [customTime, reloadNow]);

  // 1. Function to inspect remote version
  const checkVersion = useCallback(async () => {
    if (typeof window === 'undefined' || isDev) return;
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return;
      const remoteData: SystemVersionInfo = await res.json();

      // Only consider it an update if remoteData.version is strictly newer than current APP_VERSION
      const isNewer = isNewerVersion(remoteData.version, APP_VERSION);

      if (isNewer) {
        setHasUpdate(true);
        setNewVersionInfo(remoteData);

        // If tab is currently hidden and it's safe -> reload immediately in background
        if (document.hidden && isSafeToReload()) {
          reloadNow();
        }
      } else {
        // If client is already up-to-date, ensure hasUpdate is false
        setHasUpdate(false);
      }
    } catch (err) {
      console.debug('[AutoUpdate] Version check fetch skipped/failed:', err);
    }
  }, [isDev, reloadNow]);

  // 2. Realtime Firebase Listener for instant broadcast from Admin/Deploy
  useEffect(() => {
    if (isDev) return;
    try {
      const configRef = ref(database, `${DB_ROOT_NODE}/systemConfig`);
      const unsubscribe = onValue(
        configRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data) {
              const remoteVersion = String(data.version || data.appVersion || '').trim();
              const isNewer = isNewerVersion(remoteVersion, APP_VERSION);

              if (isNewer) {
                setHasUpdate(true);
                setNewVersionInfo({
                  version: remoteVersion,
                  releaseNote: data.message || data.releaseNote,
                });

                if (document.hidden && isSafeToReload()) {
                  reloadNow();
                }
              } else {
                setHasUpdate(false);
              }
            }
          }
        },
        (error) => {
          console.debug('[AutoUpdate] Firebase systemConfig listener error:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.debug('[AutoUpdate] Firebase ref error:', err);
    }
  }, [isDev, reloadNow]);

  // 3. Periodic Polling & Visibility Change
  useEffect(() => {
    checkSundaySchedule();

    // Initial check after short delay (let app initialize first)
    const initialTimer = setTimeout(() => {
      if (!isDev) checkVersion();
    }, 5000);

    // Periodic version polling
    const pollInterval = setInterval(() => {
      if (!isDev) checkVersion();
    }, POLL_INTERVAL_MS);

    // Periodic Sunday milestone check (every 10 seconds)
    const sundayInterval = setInterval(() => {
      checkSundaySchedule();
    }, 10000);

    // On visibility change (e.g. user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden. If update or Sunday milestone is waiting and safe -> schedule reload after 1.5s
        const isPending = hasUpdateRef.current || Boolean(sundayMilestoneRef.current);
        if (isPending && isSafeToReload()) {
          hiddenTimerRef.current = setTimeout(() => {
            if (document.hidden && isSafeToReload()) {
              reloadNow();
            }
          }, 1500);
        }
      } else {
        // Tab became visible. Clear hidden timer and check for latest version / Sunday schedule
        if (hiddenTimerRef.current) {
          clearTimeout(hiddenTimerRef.current);
          hiddenTimerRef.current = null;
        }
        if (!isDev) checkVersion();
        checkSundaySchedule();
      }
    };

    const handleFocus = () => {
      if (!isDev) checkVersion();
      checkSundaySchedule();
    };

    const handleOnline = () => {
      if (!isDev) checkVersion();
      checkSundaySchedule();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
      clearInterval(sundayInterval);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [isDev, checkVersion, checkSundaySchedule, reloadNow]);

  // 4. Inactivity / Idle Tracker
  useEffect(() => {
    let throttleTimer: NodeJS.Timeout | null = null;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
      if (isIdle) {
        setIsIdle(false);
      }
    };

    const handleUserInteraction = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          recordActivity();
          throttleTimer = null;
        }, 3000);
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // Idle timer checker every 30 seconds
    const idleCheckInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIsIdle(true);

        // If user is idle, update or Sunday milestone is waiting, and no modal is blocking -> reload safely
        const isPending = hasUpdateRef.current || Boolean(sundayMilestoneRef.current);
        if (isPending && isSafeToReload()) {
          reloadNow();
        }
      }
    }, 30000);

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      clearInterval(idleCheckInterval);
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [isIdle, reloadNow]);

  // 5. Global ChunkLoadError Auto-Recovery
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const message =
        'message' in event
          ? event.message
          : 'reason' in event && event.reason
          ? String(event.reason)
          : '';

      const isChunkError =
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('loading dynamically imported module');

      if (isChunkError) {
        console.warn('[AutoUpdate] Next.js ChunkLoadError detected, performing self-heal reload...');
        try {
          const lastChunkReload = sessionStorage.getItem('gmm_chunk_reload_ts');
          const now = Date.now();
          if (!lastChunkReload || now - Number(lastChunkReload) > CHUNK_RELOAD_COOLDOWN_MS) {
            sessionStorage.setItem('gmm_chunk_reload_ts', now.toString());
            window.location.reload();
          }
        } catch {
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleGlobalError);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleGlobalError);
    };
  }, []);

  const isDismissed = Boolean(
    (newVersionInfo?.version && dismissedVersion === newVersionInfo.version) ||
    (sundayMilestone && dismissedSundayKey === sundayMilestone.milestoneKey)
  );

  return {
    hasUpdate,
    newVersionInfo,
    sundayMilestone,
    isDismissed,
    dismiss: () => {
      if (newVersionInfo?.version) {
        setDismissedVersion(newVersionInfo.version);
      }
      if (sundayMilestoneRef.current) {
        setDismissedSundayKey(sundayMilestoneRef.current.milestoneKey);
      }
    },
    reloadNow,
    isIdle,
    currentVersion: APP_VERSION,
  };
}
