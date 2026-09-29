export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { appUrl } = payload;

    if (!appUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing appUrl parameter.' }),
      };
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8996233820:AAFvDCpTO7ux-lUpWqnK6l29DQ3Pw4V2aa0';
    if (!TELEGRAM_BOT_TOKEN) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not configured on the server.' }),
      };
    }

    // Ensure appUrl has no trailing slash and append /api/telegram-webhook
    const cleanAppUrl = appUrl.replace(/\/$/, '');
    const webhookUrl = `${cleanAppUrl}/api/telegram-webhook`;

    console.log(`[Telegram Webhook Setup] Setting webhook to: ${webhookUrl}`);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data: any = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || `HTTP error ${response.status}`);
    }

    console.log(`[Telegram Webhook Setup] Successfully registered:`, JSON.stringify(data));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, webhookUrl, telegramResponse: data }),
    };
  } catch (err: any) {
    console.error('[Telegram Webhook Setup Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to set Telegram webhook: ${err.message || String(err)}` }),
    };
  }
};
