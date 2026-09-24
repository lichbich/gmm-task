// Firebase Messaging Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "docugen-676bf",
  messagingSenderId: "631881183468",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'Saho Task - Thông báo mới';
  const body = payload.notification?.body || payload.data?.body || 'Bạn có thông báo mới từ hệ thống task.';
  const icon = payload.notification?.icon || payload.data?.icon || '/logo.svg';
  const url = payload.data?.url || payload.fcmOptions?.link || '/';
  const tag = payload.data?.tag || payload.data?.taskId || 'saho-task-notification';

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: '/favicon.svg',
    tag: tag,
    renotify: true,
    data: {
      url: url,
      taskId: payload.data?.taskId,
    },
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
