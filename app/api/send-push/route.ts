import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "docugen-676bf",
  private_key_id: "8ea6fddb7d901c1ba5fdee76b270bdd4f1ddbfd5",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC6fgOnKlHBbao+\nSSYzic0yDnbMD6wLDVxxNWGN6RqM6ldVxSNJwnDILgzp3J5XrC8tNcdDb9uuvUP7\nekGTKg4fxePZaX+3Nnz8iWyT3IdeTJCkRsIljnMU7jahB6KDPD7UqhD7kBEKvOUr\nB3pkUfAJlu2aVxOh3inz91Z0jeRMQKcKmq+Pp6pDz3lpMHUUiMyDkcqYvOTR73bP\nT2OsDnxrHS4v6N0nDb/SfKTy+D8YKxuBoqw7Uig9SM6EEYCVQN8pd99fveCo8nZo\nwpQXA05kdqQRJ9+C4a2e/CuZT+gDueUNDcJQ34be9p6UPqofSgAYpdhIfZuvh34R\nsV/sF4hNAgMBAAECggEAK8Z7pggdg7lxvkgeYvekRm01voWpPTjoK5y7pvuCI3S4\nhmYNd/lfzuVcW6LROkQtGMAoY3CE0RoVNJkIfnpfMV8askR82a09HmxFo9menuh7\nBUyksvsikVWvVhI8N/Dy0KmQ7fPtxCb95iFNvfGr1hxq7pElBxhmoaE71oUeAzW8\negg6vOAbcRthWYg9THjL1TTOuBDxHbge/B7KAb3EVQN+oeUq7k+kq2dG0X2WoBJA\nSvLhm7nl+RD8ZdAdrtsOST2F6/UkHCrkkUiqTdnEOr/0sjjPSZyfZafbL+OqHhap\nF929CEqe6rhdJXVa/fB4FmbmU7Xep3vQQjb1CR6YUQKBgQD371mQ/Z7zOmQ+Fevr\nTGfQyTn7tGYwVHpdp+gqZ3ch2OtGA0nl2DJgRCe4OneDvrWVKvcXTMdXfYFnhfO6\nLQt/PszkiyZF5WoAwwGLx6cEh2RI0hsNWOM3uYqu2MPMGr86+XQSXmReRfyLLQ9A\nmed7Lls1qjUll3mCIEHtAoFdNQKBgQDAjwHWNFR6JJ8z9GUMs/Ml+tmtaXUUnYVl\nGbHS+VOqGmGSv522aF3dmIAa3MHdFBnAMlsyCiZfxcdcftG1SKLa1P7y2e7YTmD/\n1UcGp2hvbknBgwmiTiPi7uIK8FfjiKWbrnU4Q1z1q3gJCd6etbHltf8r/3kFyO8+\nanraLZ0ZuQKBgDRrRmSBOrnx/n+h4t88qDZcVQYCfhh5w+VJOqy8c1OUqSmESHtv\n2jbAMiWhNuODzqBbFSK3+O1me5WHnKAgJe4hOPCY+t6MQn0mvYzwCT/L4EgFI/MO\nd/uwHsIY0ky02vl9BC1eB5pm8Z37SN4/q9E/W8lc0x+/htEcQNP7U56BAoGADMZw\nHMIECMZ9OXkxaxJVQ2PNJVAl0GRTAU4fGhwojNSLPK0xzXRHJfiEJ0QWKJC41KOC\noWNDAH+ipmRTjW9wPox7DamfywIINXD08WAR8bKjeg8ziG0evGOU45zmd9YNBrMg\nW8c8V6A0qoTZHDZ5wv+8GjMs2FFobf+qfucf0SECgYBFmRcPQGZjLKq80GLZkooL\nC3MLvN9VJ/7SGOIUvG/cvhjrm4aCd8sr02SrD7lLcvKtQAiQnIooGZylK8So1I6N\nsoQzsKzmWY3hHOyEUf5qsgShE1frB+PGPfGl5nR6u2gvdaw10UGYveYbdOdj6JAz\nLxt6B9JQq94oemB/21z78Q==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@docugen-676bf.iam.gserviceaccount.com",
  client_id: "111693688947790894058",
};

// Initialize firebase-admin singleton
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return initializeApp({
        credential: cert(sa),
        databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
      });
    }

    const keyPath = path.join(process.cwd(), 'securekey.json');
    if (fs.existsSync(keyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      return initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
      });
    }

    return initializeApp({
      credential: cert(DEFAULT_SERVICE_ACCOUNT as any),
      databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  } catch (err) {
    console.error('Failed to load credentials for firebase-admin:', err);
  }

  return initializeApp({
    projectId: 'docugen-676bf',
    databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
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

    const app = getAdminApp();
    const db = getDatabase(app);
    const messaging = getMessaging(app);

    const results: any[] = [];

    for (const acc of accounts) {
      // 1. Fetch registered FCM device tokens for this account (checking both exact and lowercase paths)
      const tokenSnap1 = await db.ref(`${dbRootNode}/userTokens/${acc}`).once('value');
      const tokenSnap2 =
        acc.toLowerCase() !== acc
          ? await db.ref(`${dbRootNode}/userTokens/${acc.toLowerCase()}`).once('value')
          : null;

      const tokensData1 = tokenSnap1.val() || {};
      const tokensData2 = tokenSnap2 ? tokenSnap2.val() || {} : {};
      const combinedTokensData = { ...tokensData2, ...tokensData1 };

      // 2. Also record in-app notification in DB (for both exact and lowercase)
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

      await db.ref(`${dbRootNode}/notifications/${acc}/${notificationId}`).set(notifPayload);
      if (acc.toLowerCase() !== acc) {
        await db
          .ref(`${dbRootNode}/notifications/${acc.toLowerCase()}/${notificationId}`)
          .set(notifPayload)
          .catch(console.error);
      }

      const tokensList: { key: string; token: string }[] = [];
      const seenTokens = new Set<string>();

      Object.entries(combinedTokensData).forEach(([key, val]: [string, any]) => {
        const tokenStr = typeof val === 'string' ? val : val?.token;
        if (tokenStr && !seenTokens.has(tokenStr)) {
          seenTokens.add(tokenStr);
          tokensList.push({ key, token: tokenStr });
        }
      });

      if (tokensList.length === 0) {
        results.push({ account: acc, tokensCount: 0, sentCount: 0, note: 'No device tokens found' });
        continue;
      }

      // 3. Send Multicast Push Message via FCM
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

      // 4. Cleanup any expired / invalid tokens
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
                db.ref(`${dbRootNode}/userTokens/${acc}/${expiredTokenObj.key}`).remove().catch(console.error);
              }
            }
          }
        });
      }

      results.push({
        account: acc,
        tokensCount: tokensList.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
