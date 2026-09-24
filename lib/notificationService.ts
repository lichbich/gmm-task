import { app, database, ref, set, DB_ROOT_NODE } from './firebase';
import { AppNotification, NotificationType } from '../types/notification';

export const VAPID_KEY =
  'BNafJbOZLfOCaBYaC6W57oBiWpoItFZqlOIwCWA9Dwhy1Z4m_skovsbOgSQtojDhVbe_Gy9OVRmMql0l4l30Z10';

// Convert base64 url-safe string to Uint8Array for Web Push applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Play a high-quality notification chime using Web Audio API
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;

    // Tone 1 (High, crisp sine chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 (Harmonic ringing second chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now + 0.1); // A6
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.debug('Could not play audio chime:', e);
  }
}

/**
 * Show a native OS/browser notification banner (supports Mobile Android/iOS via ServiceWorker)
 */
export async function showLocalBrowserNotification(
  title: string,
  body: string,
  url: string = '/',
  tag?: string
) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notifTag = tag || `saho-${Date.now()}`;
  const options: any = {
    body,
    icon: '/logo.png?v=2',
    badge: '/badge.png?v=2',
    tag: notifTag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: url || '/',
    },
  };

  // 1. Mandatory on Android Chrome & Mobile browsers: Use ServiceWorkerRegistration.showNotification
  if ('serviceWorker' in navigator) {
    try {
      // Find active registration without blocking indefinitely
      let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = (await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
        ])) as ServiceWorkerRegistration | null;
      }

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    } catch (swErr) {
      console.warn('[NotificationService] ServiceWorker showNotification error:', swErr);
    }

    // Try posting message to active controller as secondary trigger
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options,
        });
        return;
      }
    } catch (msgErr) {
      console.warn('[NotificationService] ServiceWorker controller postMessage error:', msgErr);
    }
  }

  // 2. Fallback for Desktop browsers without ServiceWorker
  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      if (url && url !== '/') {
        window.location.href = url;
      }
      notif.close();
    };
  } catch (e) {
    console.debug('[NotificationService] Desktop Notification error:', e);
  }
}

/**
 * Request notification permission and register both WebPush and FCM tokens
 */
export async function registerDeviceForPushNotifications(account: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.log('[NotificationService] Push notifications not supported by this browser');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[NotificationService] Notification permission denied by user');
      return null;
    }

    // Register Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 1500)),
    ]);

    // Create a deterministic device key based on browser user agent
    const deviceFingerprint = btoa(
      navigator.userAgent.slice(0, 40) + '-' + (screen?.width || 0) + 'x' + (screen?.height || 0)
    ).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const tokenKey = `dev_${deviceFingerprint}`;

    // 1. Standard W3C Push Subscription using VAPID (100% reliable on Android Chrome & Safari iOS)
    let pushSub = await registration.pushManager.getSubscription();
    if (!pushSub) {
      try {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_KEY);
        pushSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
      } catch (subErr) {
        console.warn('[NotificationService] pushManager subscribe error:', subErr);
      }
    }

    if (pushSub) {
      const subJson = pushSub.toJSON();
      const subPayload = {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        deviceInfo: navigator.userAgent.slice(0, 100),
        updatedAt: new Date().toISOString(),
      };

      await set(ref(database, `${DB_ROOT_NODE}/userPushSubscriptions/${account}/${tokenKey}`), subPayload);
      if (account.toLowerCase() !== account) {
        await set(ref(database, `${DB_ROOT_NODE}/userPushSubscriptions/${account.toLowerCase()}/${tokenKey}`), subPayload);
      }
      console.log('[NotificationService] Standard Web Push Subscription saved successfully');
    }

    // 2. Also try FCM token registration if available
    try {
      const { getMessaging, getToken } = await import('firebase/messaging');
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        const tokenPayload = {
          token,
          deviceInfo: navigator.userAgent.slice(0, 100),
          updatedAt: new Date().toISOString(),
        };

        await set(ref(database, `${DB_ROOT_NODE}/userTokens/${account}/${tokenKey}`), tokenPayload);
        if (account.toLowerCase() !== account) {
          await set(ref(database, `${DB_ROOT_NODE}/userTokens/${account.toLowerCase()}/${tokenKey}`), tokenPayload);
        }
      }
    } catch {
      // Ignored if apiKey is not in Firebase config
    }

    return pushSub ? pushSub.endpoint : 'granted';
  } catch (error) {
    console.warn('[NotificationService] Failed to register device push token:', error);
  }

  return null;
}

/**
 * Send a quick test notification to verify audio, browser popup and push
 */
export async function sendTestNotification(account: string) {
  playNotificationChime();
  await showLocalBrowserNotification(
    '🔔 Kiểm tra thông báo thành công!',
    'Hệ thống Saho Task đã kết nối thông báo đa thiết bị cho tài khoản của bạn.'
  );

  await sendPushNotification({
    targetAccount: account,
    title: '🔔 Thông báo thử nghiệm (Test Push)',
    body: 'Hệ thống Saho Task đã kết nối thành công với thiết bị của bạn!',
    type: 'GENERAL',
  });
}

/**
 * Dispatch Push Notification to a user (calls /api/send-push)
 */
export async function sendPushNotification({
  targetAccount,
  title,
  body,
  url,
  taskId,
  senderAccount,
  senderName,
  type = 'TASK_ASSIGNED',
}: {
  targetAccount: string;
  title: string;
  body: string;
  url?: string;
  taskId?: string;
  senderAccount?: string;
  senderName?: string;
  type?: NotificationType;
}) {
  if (!targetAccount) return;

  const targetUrl = url || (taskId ? `/?openTaskId=${taskId}` : '/');
  const notificationId = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const notifPayload: AppNotification = {
    id: notificationId,
    targetAccount,
    senderAccount: senderAccount || 'System',
    senderName: senderName || senderAccount || 'System',
    title: title || 'Thông báo mới',
    body: body || '',
    taskId: taskId || undefined,
    type: type || 'TASK_ASSIGNED',
    isRead: false,
    createdAt: new Date().toISOString(),
    url: targetUrl,
  };

  // 1. Direct Realtime DB write via Client SDK (Instant sub-100ms sync to all active sessions)
  try {
    set(ref(database, `${DB_ROOT_NODE}/notifications/${targetAccount}/${notificationId}`), notifPayload).catch(console.error);

    if (targetAccount.toLowerCase() !== targetAccount) {
      set(ref(database, `${DB_ROOT_NODE}/notifications/${targetAccount.toLowerCase()}/${notificationId}`), notifPayload).catch(console.error);
    }
  } catch (err) {
    console.debug('Error writing direct notification:', err);
  }

  // 2. Call server-side API to send Web Push to background/closed devices
  try {
    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: notificationId,
        targetAccount,
        title,
        body,
        url: targetUrl,
        taskId,
        senderAccount,
        senderName,
        type,
        dbRootNode: DB_ROOT_NODE,
        skipDbWrite: true,
      }),
    }).catch((err) => {
      console.warn('[NotificationService] Background push fetch failed:', err);
    });
  } catch (error) {
    console.warn('[NotificationService] Error sending push notification:', error);
  }
}
