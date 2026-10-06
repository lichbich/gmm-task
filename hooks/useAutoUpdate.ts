'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { APP_VERSION, BUILD_ID, BUILD_TIMESTAMP, SystemVersionInfo } from '../lib/version';
import { database, ref, onValue, DB_ROOT_NODE } from '../lib/firebase';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes of inactivity
const POLL_INTERVAL_MS = 2 * 60 * 1000; // Poll version every 2 minutes
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

export function useAutoUpdate() {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local')));

  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [newVersionInfo, setNewVersionInfo] = useState<Partial<SystemVersionInfo> | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(isDev);
  const [isIdle, setIsIdle] = useState<boolean>(false);

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
    try {
      // Clear any session storage markers if needed
      window.location.reload();
    } catch {
      window.location.href = window.location.href;
    }
  }, []);

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

      // Check if remote version or build ID differs
      const isDifferentBuild =
        (remoteData.buildId && remoteData.buildId !== BUILD_ID) ||
        (remoteData.version && remoteData.version !== APP_VERSION) ||
        (remoteData.buildTimestamp && remoteData.buildTimestamp > BUILD_TIMESTAMP);

      if (isDifferentBuild) {
        setHasUpdate(true);
        setNewVersionInfo(remoteData);

        // If tab is currently hidden and it's safe -> reload immediately in background
        if (document.hidden && isSafeToReload()) {
          reloadNow();
        }
      }
    } catch (err) {
      // Fail silently on network drop
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
              const remoteDeployTime = Number(data.lastDeployTime || data.deployTimestamp || 0);
              const remoteVersion = String(data.version || data.appVersion || '');

              const isNewer =
                (remoteDeployTime > BUILD_TIMESTAMP) ||
                (remoteVersion && remoteVersion !== APP_VERSION);

              if (isNewer) {
                setHasUpdate(true);
                setNewVersionInfo({
                  version: remoteVersion || APP_VERSION,
                  releaseNote: data.message || data.releaseNote,
                  buildTimestamp: remoteDeployTime || Date.now(),
                });

                if (document.hidden && isSafeToReload()) {
                  reloadNow();
                }
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
    if (isDev) return;

    // Initial check after short delay (let app initialize first)
    const initialTimer = setTimeout(() => {
      checkVersion();
    }, 5000);

    // Periodic polling
    const pollInterval = setInterval(() => {
      checkVersion();
    }, POLL_INTERVAL_MS);

    // On visibility change (e.g. user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden. If update is waiting and safe -> schedule reload after 1.5s
        if (hasUpdateRef.current && isSafeToReload()) {
          hiddenTimerRef.current = setTimeout(() => {
            if (document.hidden && isSafeToReload()) {
              reloadNow();
            }
          }, 1500);
        }
      } else {
        // Tab became visible. Clear hidden timer and check for latest version
        if (hiddenTimerRef.current) {
          clearTimeout(hiddenTimerRef.current);
          hiddenTimerRef.current = null;
        }
        checkVersion();
      }
    };

    const handleFocus = () => {
      checkVersion();
    };

    const handleOnline = () => {
      checkVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [isDev, checkVersion, reloadNow]);

  // 4. Inactivity / Idle Tracker
  useEffect(() => {
    if (isDev) return;

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

        // If user is idle, update is waiting, and no modal is blocking -> reload safely
        if (hasUpdateRef.current && isSafeToReload()) {
          reloadNow();
        }
      }
    }, 30000);

    return () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      clearInterval(idleCheckInterval);
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [isDev, isIdle, reloadNow]);

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

  return {
    hasUpdate,
    newVersionInfo,
    isDismissed,
    dismiss: () => setIsDismissed(true),
    reloadNow,
    isIdle,
    currentVersion: APP_VERSION,
  };
}
