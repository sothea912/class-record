import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Firebase Admin using credentials or local config
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('[Server Admin] Failed to parse firebase-applet-config.json:', err);
  }
}

let db: any = null;
try {
  // If already initialized, use existing app
  if (getApps().length === 0) {
    initializeApp({
      projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID,
    });
  }
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  db = getFirestore(dbId);
  console.log(`[Server Admin] Firebase Admin Firestore initialized successfully with database ID: "${dbId || 'default'}"`);
} catch (err) {
  console.error('[Server Admin] Failed to initialize Firebase Admin SDK:', err);
}

// Bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8996233820:AAFvDCpTO7ux-lUpWqnK6l29DQ3Pw4V2aa0';

// Webhook setup endpoint
app.post('/api/telegram-webhook-setup', async (req, res) => {
  const { appUrl } = req.body;
  if (!appUrl) {
    return res.status(400).json({ error: 'Missing appUrl parameter.' });
  }

  try {
    const cleanAppUrl = appUrl.replace(/\/$/, '');
    const webhookUrl = `${cleanAppUrl}/api/telegram-webhook`;

    console.log(`[Express Webhook Setup] Setting webhook to: ${webhookUrl}`);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data: any = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || `HTTP error ${response.status}`);
    }

    return res.json({ success: true, webhookUrl, telegramResponse: data });
  } catch (err: any) {
    console.error('[Express Webhook Setup Error]:', err);
    return res.status(500).json({ error: `Failed to set Telegram webhook: ${err.message || String(err)}` });
  }
});

// Webhook endpoint to receive updates from Telegram
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('[Express Webhook] Received update payload:', JSON.stringify(payload));

    const message = payload.message;
    if (message && message.chat && message.chat.id) {
      const chatId = message.chat.id;
      const username = message.chat.username || '';
      const firstName = message.chat.first_name || '';
      const lastName = message.chat.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Teacher';

      console.log(`[Express Webhook] Extracted chat ID: ${chatId}, user: ${fullName} (@${username})`);

      if (db) {
        await db.collection('app_settings').doc('global').set({
          telegramConfig: {
            chatId: String(chatId),
            username: username,
            name: fullName,
            updatedAt: new Date().toISOString()
          }
        }, { merge: true });
        console.log(`[Express Webhook] Stored chatId ${chatId} successfully!`);
      }

      // Send a confirmation reply
      const welcomeText = `🎉 Bot linked successfully!\n\nInstructor: ${fullName}\nUsername: @${username || 'N/A'}\nChat ID: ${chatId}\n\nYou will now receive real-time leave permission notifications here! 📩`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
        }),
      }).catch(err => {
        console.error('[Express Webhook] Failed to send reply message:', err);
      });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[Express Webhook Error]:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint to send a Telegram message
app.post('/api/telegram-notify', async (req, res) => {
  const { studentName, studentNo, className, date, category, message } = req.body;

  if (!studentName || !className || !date || !message) {
    return res.status(400).json({ error: 'Missing required fields for Telegram notification.' });
  }

  try {
    let chatId = '';
    // Fetch Chat ID from Firestore global settings
    if (db) {
      const docSnap = await db.collection('app_settings').doc('global').get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && data.telegramConfig && data.telegramConfig.chatId) {
          chatId = data.telegramConfig.chatId;
        }
      }
    }

    if (!chatId) {
      console.warn('[Telegram Notify] No Chat ID registered yet. Please send /start to the Telegram bot first.');
      return res.status(400).json({
        error: 'Telegram Chat ID is not registered. Please ensure the instructor has sent a message (e.g., /start) to the bot first.'
      });
    }

    const cleanStudentNo = studentNo ? ` (${studentNo})` : '';
    const textMessage = `📩 New Permission Request — ${studentName}${cleanStudentNo} (${className}) requested leave for ${date}. Reason: ${category || 'General'} — ${message}`;

    console.log(`[Telegram Notify] Sending message to Chat ID ${chatId}: "${textMessage}"`);

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
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Telegram Notify] Failed to send notification:', err);
    return res.status(500).json({ error: `Failed to send Telegram notification: ${err.message || String(err)}` });
  }
});

// Global process safety handlers to prevent container crashes on transient errors
process.on('uncaughtException', (err) => {
  console.error('[App Server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[App Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend assets / run Vite middleware
const distPath = path.join(__dirname, 'dist');
const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  hasDist;

if (!isProduction && process.env.NODE_ENV === 'development') {
  try {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.error('[App Server] Failed to initialize Vite dev server, falling back to static dist:', err);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!doctype html><html><head><title>App</title></head><body>Loading application...</body></html>');
      }
    });
  }
} else {
  // Production mode: Serve pre-built static assets from dist
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send('<!doctype html><html><head><title>App</title></head><body>Loading application...</body></html>');
    }
  });
}

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[App Server] Server listening on 0.0.0.0:${PORT} (production: ${isProduction})`);
});
