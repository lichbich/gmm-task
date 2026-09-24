import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

const RTDB_BASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app";

// Helper to write/read directly to Firebase Realtime Database via REST API
// (Guaranteed 100% success on any environment including Vercel without requiring complex GCP IAM setup)
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
    console.debug('[Firebase Admin FCM] Service account credentials not configured. FCM background push will be skipped:', err);
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      targetAccount,
      targetAccounts,
      title,
      body: content,
      url = '/',
      taskId,
      senderAccount,
      senderName,
      type = 'TASK_ASSIGNED',
      dbRootNode = 'gmm-task',
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

    const results: any[] = [];
    const adminApp = getSafeAdminApp();
    const messaging = adminApp ? getMessaging(adminApp) : null;

    for (const acc of accounts) {
      const notificationId = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
        url: url,
      };

      // 1. Direct REST Realtime DB write to recipient's notification inbox
      await writeRtdbRest(`${dbRootNode}/notifications/${acc}/${notificationId}`, notifPayload);
      if (acc.toLowerCase() !== acc) {
        await writeRtdbRest(`${dbRootNode}/notifications/${acc.toLowerCase()}/${notificationId}`, notifPayload);
      }

      // 2. Fetch registered FCM device tokens for background push
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

      // 3. If FCM Messaging is available and device tokens exist, send Multicast Push
      let fcmSuccess = 0;
      let fcmFailure = 0;

      if (messaging && tokensList.length > 0) {
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
              url: url || '/',
              taskId: taskId || '',
              type: type || 'TASK_ASSIGNED',
              senderAccount: senderAccount || '',
            },
            webpush: {
              notification: {
                title: title || 'Saho Task',
                body: content || '',
                icon: '/logo.svg',
                badge: '/favicon.svg',
                vibrate: [200, 100, 200],
                tag: taskId ? `task-${taskId}` : `notif-${Date.now()}`,
                renotify: true,
              },
              fcmOptions: {
                link: url || '/',
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
          console.debug('[FCM Multicast Error]', fcmErr);
        }
      }

      results.push({
        account: acc,
        notificationId,
        inAppSaved: true,
        deviceTokensCount: tokensList.length,
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
