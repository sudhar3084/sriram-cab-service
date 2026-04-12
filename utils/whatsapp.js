// WhatsApp notification utility using Twilio
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

const normalizePhone = (phone) => {
  if (!phone) return '';
  const stripped = String(phone).replace(/^whatsapp:/i, '').trim();
  const hasPlus = stripped.startsWith('+');
  const digits = stripped.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeFrom = (fromValue) => {
  const raw = String(fromValue || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
  return `whatsapp:${normalizePhone(raw)}`;
};

const sendWhatsApp = async (to, message) => {
  if (!accountSid || !authToken || !whatsappFrom) {
    const err = 'Twilio env vars missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.';
    console.error('❌ WhatsApp config error:', err);
    return { ok: false, errorMessage: err };
  }

  const cleanTo = normalizePhone(to);
  if (!cleanTo) {
    const err = `Invalid WhatsApp destination number: "${to}"`;
    console.error('❌ WhatsApp validation error:', err);
    return { ok: false, errorMessage: err };
  }

  const fromFormatted = normalizeFrom(whatsappFrom);
  if (!fromFormatted || fromFormatted === 'whatsapp:') {
    const err = `Invalid TWILIO_WHATSAPP_FROM value: "${whatsappFrom || ''}"`;
    console.error('❌ WhatsApp config error:', err);
    return { ok: false, errorMessage: err };
  }

  const client = twilio(accountSid, authToken);

  try {
    const toFormatted = `whatsapp:${cleanTo}`;
    console.log(`📲 Sending WhatsApp to: ${toFormatted}`);
    console.log(`📤 From: ${fromFormatted}`);
    const sendPayload = {
      from: fromFormatted,
      to: toFormatted,
      body: message,
    };

    let result;
    try {
      result = await client.messages.create(sendPayload);
    } catch (firstError) {
      const isRetryable = firstError.code === 20429 || (firstError.status && firstError.status >= 500);
      if (!isRetryable) throw firstError;
      console.warn(`⚠️ WhatsApp transient error (${firstError.code || firstError.status}). Retrying once...`);
      await wait(1200);
      result = await client.messages.create(sendPayload);
    }

    console.log(`✅ WhatsApp sent! SID: ${result.sid}`);
    return { ok: true, sid: result.sid, to: cleanTo };
  } catch (error) {
    console.error('❌ WhatsApp send error:', error.message);
    console.error('   Status:', error.status);
    console.error('   Code:', error.code);
    if (error.code === 63007 || error.message.includes('sandbox')) {
      console.error('💡 FIX: Join Twilio sandbox from your WhatsApp by sending the join code to +14155238886.');
    }
    return {
      ok: false,
      errorCode: error.code,
      errorMessage: error.message,
      to: cleanTo
    };
  }
};

module.exports = sendWhatsApp;
