// Service Worker for Android & Desktop Web Push & Local Notifications
// Guarantees 100% reliability without crashing even if external CDNs are unavailable

const LOGO_ICON = '/logo.png?v=2';
const BADGE_ICON = '/badge.png?v=2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Direct message dispatch from webpage (e.g. showLocalBrowserNotification)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const finalOptions = {
      ...options,
      icon: options?.icon || LOGO_ICON,
      badge: options?.badge || BADGE_ICON,
      vibrate: options?.vibrate || [200, 100, 200],
      requireInteraction: true,
    };
    event.waitUntil(self.registration.showNotification(title, finalOptions));
  }
});

// 2. Native Web Push Event Handler (Works for VAPID Web Push & FCM Push)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        payload = JSON.parse(event.data.text());
      } catch (e2) {
        payload = { title: 'Saho Task', body: event.data.text() };
      }
    }
  }

  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || data.title || payload.title || 'Saho Task - Thông báo mới';
  const body = notif.body || data.body || payload.body || 'Bạn có thông báo mới từ hệ thống task.';
  const taskId = data.taskId || notif.taskId || payload.taskId || '';
  const url = data.url || notif.url || payload.url || (taskId ? `/?openTaskId=${taskId}` : '/');
  const tag = data.tag || notif.tag || payload.tag || (taskId ? `task-${taskId}` : `saho-${Date.now()}`);

  const options = {
    body: body,
    icon: LOGO_ICON,
    badge: BADGE_ICON,
    tag: tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: url,
      taskId: taskId,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Notification Click Handler (Brings app to front and navigates to target task)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const taskId = notifData.taskId || '';
  const targetUrl = notifData.url || (taskId ? `/?openTaskId=${taskId}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open:
      for (const client of windowClients) {
        if ('focus' in client) {
          // Send message to open the task directly in the existing tab
          client.postMessage({
            type: 'OPEN_TASK_NOTIFICATION',
            taskId: taskId,
            url: targetUrl,
          });

          // If navigation is supported and we have a task ID
          if (taskId && client.navigate) {
            client.navigate(targetUrl).catch(() => {});
          }

          return client.focus();
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 4. Optional Firebase Messaging Compat (safely wrapped in try...catch so it never crashes SW)
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    projectId: "docugen-676bf",
    messagingSenderId: "631881183468",
  };

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase background message:', payload);
    const title = payload.notification?.title || payload.data?.title || 'Saho Task';
    const body = payload.notification?.body || payload.data?.body || '';
    const taskId = payload.data?.taskId || '';
    const url = payload.data?.url || payload.fcmOptions?.link || (taskId ? `/?openTaskId=${taskId}` : '/');

    return self.registration.showNotification(title, {
      body,
      icon: LOGO_ICON,
      badge: BADGE_ICON,
      tag: taskId ? `task-${taskId}` : `saho-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url, taskId },
    });
  });
} catch (e) {
  // Silent fallback - native handlers above handle everything
}
