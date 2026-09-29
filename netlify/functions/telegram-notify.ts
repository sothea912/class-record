import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseDb() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID || "athena-ai-438506";
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (serviceAccount) {
      try {
        const parsed = JSON.parse(serviceAccount);
        initializeApp({
          credential: cert(parsed),
          projectId: parsed.project_id
        });
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
        initializeApp({ projectId });
      }
    } else if (privateKey && clientEmail) {
      initializeApp({
        credential: cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail: clientEmail,
        }),
        projectId
      });
    } else {
      initializeApp({
        projectId
      });
    }
  }
  const dbId = "ai-studio-classrecordacade-d6f83979-1a94-482e-80d2-e2886956ae10";
  return getFirestore(dbId);
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { studentName, studentNo, className, date, category, message } = payload;

    if (!studentName || !className || !date || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields for Telegram notification.' }),
      };
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8996233820:AAFvDCpTO7ux-lUpWqnK6l29DQ3Pw4V2aa0';
    if (!TELEGRAM_BOT_TOKEN) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not configured on the server.' }),
      };
    }

    let chatId = '';
    const db = getFirebaseDb();
    const docSnap = await db.collection('app_settings').doc('global').get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.telegramConfig && data.telegramConfig.chatId) {
        chatId = data.telegramConfig.chatId;
      }
    }

    if (!chatId) {
      console.warn('[Telegram Notify] No Chat ID registered yet.');
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Telegram Chat ID is not registered. Please ensure the instructor has sent a message (e.g., /start) to the bot first.'
        }),
      };
    }

    const cleanStudentNo = studentNo ? ` (${studentNo})` : '';
    const textMessage = `📩 New Permission Request — ${studentName}${cleanStudentNo} (${className}) requested leave for ${date}. Reason: ${category || 'General'} — ${message}`;

    console.log(`[Telegram Notify] Sending message to Chat ID ${chatId}`);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textMessage,
      }),
    });

    const result: any = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.description || `HTTP ${response.status}`);
    }

    console.log('[Telegram Notify] Notification sent successfully!');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err: any) {
    console.error('[Telegram Notify Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to send Telegram notification: ${err.message || String(err)}` }),
    };
  }
};
