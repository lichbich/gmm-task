import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import webpush from 'web-push';
import path from 'path';
import fs from 'fs';

const RTDB_BASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BNafJbOZLfOCaBYaC6W57oBiWpoItFZqlOIwCWA9Dwhy1Z4m_skovsbOgSQtojDhVbe_Gy9OVRmMql0l4l30Z10';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'M4Nvy5bHrRNM795Ke0Hd0OBXvhuFMeuiddomyD-Hs88';

try {
  webpush.setVapidDetails('mailto:admin@saho.vn', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.error('[WebPush VAPID Init Error]', vapidErr);
}

// Helper to write/read directly to Firebase Realtime Database via REST API
async function writeRtdbRest(nodePath: string, data: any) {
  try {
    const res = await fetch(`${RTDB_BASE_URL}/${nodePath}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.error(`[REST RTDB Write Error] path: ${nodePath}`, err);
    return false;
  }
}

async function readRtdbRest(nodePath: string): Promise<any> {
  try {
    const res = await fetch(`${RTDB_BASE_URL}/${nodePath}.json`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[REST RTDB Read Error] path: ${nodePath}`, err);
    return null;
  }
}

async function removeRtdbRest(nodePath: string) {
  try {
    await fetch(`${RTDB_BASE_URL}/${nodePath}.json`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error(`[REST RTDB Delete Error] path: ${nodePath}`, err);
  }
}

// Safely attempt to initialize firebase-admin for FCM background push
function getSafeAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return initializeApp({
        credential: cert(sa),
        databaseURL: RTDB_BASE_URL,
      });
    }

    const keyPath = path.join(process.cwd(), 'securekey.json');
    if (fs.existsSync(keyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      return initializeApp({
        credential: cert(serviceAccount),
        databaseURL: RTDB_BASE_URL,
      });
    }
  } catch (err) {
    console.debug('[Firebase Admin FCM] Service account credentials not active:', err);
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id: providedId,
      targetAccount,
      targetAccounts,
      title,
      body: content,
      url,
      taskId,
      senderAccount,
      senderName,
      type = 'TASK_ASSIGNED',
      dbRootNode = 'gmm-task',
      skipDbWrite = false,
    } = body;

    const accounts: string[] = [];
    if (Array.isArray(targetAccounts)) {
      accounts.push(...targetAccounts);
    } else if (targetAccount && typeof targetAccount === 'string') {
      accounts.push(targetAccount);
    }

    if (accounts.length === 0) {
      return NextResponse.json({ success: false, error: 'No target account provided' }, { status: 400 });
    }

    const targetUrl = url || (taskId ? `/?openTaskId=${taskId}` : '/');
    const results: any[] = [];
    const adminApp = getSafeAdminApp();
    const messaging = adminApp ? getMessaging(adminApp) : null;

    for (const acc of accounts) {
      const notificationId = providedId || `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const notifPayload = {
        id: notificationId,
        targetAccount: acc,
        senderAccount: senderAccount || 'System',
        senderName: senderName || senderAccount || 'System',
        title: title || 'Thông báo mới',
        body: content || '',
        taskId: taskId || null,
        type: type,
        isRead: false,
        createdAt: new Date().toISOString(),
        url: targetUrl,
      };

      // 1. Direct REST Realtime DB write to recipient's notification inbox
      if (!skipDbWrite) {
        await writeRtdbRest(`${dbRootNode}/notifications/${acc}/${notificationId}`, notifPayload);
        if (acc.toLowerCase() !== acc) {
          await writeRtdbRest(`${dbRootNode}/notifications/${acc.toLowerCase()}/${notificationId}`, notifPayload);
        }
      }

      // 2. Send standard W3C WebPush via VAPID (100% reliable on Android Chrome & Safari iOS)
      let webpushSuccess = 0;
      let webpushFailure = 0;

      const pushSubs1 = (await readRtdbRest(`${dbRootNode}/userPushSubscriptions/${acc}`)) || {};
      const pushSubs2 =
        acc.toLowerCase() !== acc
          ? (await readRtdbRest(`${dbRootNode}/userPushSubscriptions/${acc.toLowerCase()}`)) || {}
          : {};
      const combinedPushSubs = { ...pushSubs2, ...pushSubs1 };

      const webPushPayload = JSON.stringify({
        notification: {
          title: title || 'Saho Task',
          body: content || '',
          icon: '/logo.png?v=2',
          badge: '/badge.png?v=2',
        },
        data: {
          title: title || 'Saho Task',
          body: content || '',
          url: targetUrl,
          taskId: taskId || '',
          type: type,
        },
      });

      for (const [subKey, subVal] of Object.entries(combinedPushSubs)) {
        const sub = subVal as any;
        if (sub && sub.endpoint && sub.keys) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys,
              },
              webPushPayload,
              {
                urgency: 'high',
                TTL: 86400,
              }
            );
            webpushSuccess++;
          } catch (pushErr: any) {
            webpushFailure++;
            console.warn('[WebPush send error]', pushErr?.statusCode, pushErr?.message);
            if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
              await removeRtdbRest(`${dbRootNode}/userPushSubscriptions/${acc}/${subKey}`);
            }
          }
        }
      }

      // 3. Optional FCM Multicast Push
      let fcmSuccess = 0;
      let fcmFailure = 0;

      if (messaging) {
        const tokensData1 = (await readRtdbRest(`${dbRootNode}/userTokens/${acc}`)) || {};
        const tokensData2 =
          acc.toLowerCase() !== acc
            ? (await readRtdbRest(`${dbRootNode}/userTokens/${acc.toLowerCase()}`)) || {}
            : {};
        const combinedTokensData = { ...tokensData2, ...tokensData1 };

        const tokensList: { key: string; token: string }[] = [];
        const seenTokens = new Set<string>();

        Object.entries(combinedTokensData).forEach(([key, val]: [string, any]) => {
          const tokenStr = typeof val === 'string' ? val : val?.token;
          if (tokenStr && !seenTokens.has(tokenStr)) {
            seenTokens.add(tokenStr);
            tokensList.push({ key, token: tokenStr });
          }
        });

        if (tokensList.length > 0) {
          try {
            const rawTokens = tokensList.map((t) => t.token);
            const response = await messaging.sendEachForMulticast({
              tokens: rawTokens,
              notification: {
                title: title || 'Saho Task',
                body: content || '',
              },
              data: {
                title: title || 'Saho Task',
                body: content || '',
                url: targetUrl,
                taskId: taskId || '',
                type: type || 'TASK_ASSIGNED',
                senderAccount: senderAccount || '',
              },
              webpush: {
                headers: {
                  Urgency: 'high',
                },
                notification: {
                  title: title || 'Saho Task',
                  body: content || '',
                  icon: '/logo.png?v=2',
                  badge: '/badge.png?v=2',
                  vibrate: [200, 100, 200],
                  tag: taskId ? `task-${taskId}` : `notif-${Date.now()}`,
                  renotify: true,
                  requireInteraction: true,
                },
                fcmOptions: {
                  link: targetUrl,
                },
              },
            });

            fcmSuccess = response.successCount;
            fcmFailure = response.failureCount;

            // Cleanup any invalid or expired tokens
            if (response.failureCount > 0) {
              response.responses.forEach((resp: any, idx: number) => {
                if (!resp.success) {
                  const errCode = resp.error?.code;
                  if (
                    errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered'
                  ) {
                    const expiredTokenObj = tokensList[idx];
                    if (expiredTokenObj) {
                      removeRtdbRest(`${dbRootNode}/userTokens/${acc}/${expiredTokenObj.key}`);
                    }
                  }
                }
              });
            }
          } catch (fcmErr) {
            console.debug('[FCM Multicast Note]', fcmErr);
          }
        }
      }

      results.push({
        account: acc,
        notificationId,
        inAppSaved: true,
        webpushSent: webpushSuccess,
        webpushFailed: webpushFailure,
        fcmSent: fcmSuccess,
        fcmFailed: fcmFailure,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error in send-push route:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
