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
    console.log('[Telegram Webhook] Received update payload:', JSON.stringify(payload));

    const message = payload.message;
    if (message && message.chat && message.chat.id) {
      const chatId = message.chat.id;
      const username = message.chat.username || '';
      const firstName = message.chat.first_name || '';
      const lastName = message.chat.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Teacher';

      console.log(`[Telegram Webhook] Extracted chat ID: ${chatId}, user: ${fullName} (${username})`);

      // Store in Firestore
      const db = getFirebaseDb();
      const settingsRef = db.collection('app_settings').doc('global');
      await settingsRef.set({
        telegramConfig: {
          chatId: String(chatId),
          username: username,
          name: fullName,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      console.log(`[Telegram Webhook] Stored config successfully in Firestore!`);

      // Reply to user on Telegram that they are successfully linked!
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8996233820:AAFvDCpTO7ux-lUpWqnK6l29DQ3Pw4V2aa0';
      if (TELEGRAM_BOT_TOKEN) {
        const welcomeText = `🎉 Bot linked successfully!\n\nInstructor: ${fullName}\nUsername: @${username || 'N/A'}\nChat ID: ${chatId}\n\nYou will now receive real-time leave permission notifications here! 📩`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
          }),
        }).catch(err => {
          console.error('[Telegram Webhook] Failed to send welcome reply:', err);
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
