// WhatsApp notification utility using Twilio
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

const client = twilio(accountSid, authToken);

const sendWhatsApp = async (to, message) => {
  try {
    // Normalize number - strip any 'whatsapp:' prefix if accidentally passed
    const cleanTo = to.replace('whatsapp:', '').trim();
    const toFormatted = `whatsapp:${cleanTo}`;
    console.log(`📲 Sending WhatsApp to: ${toFormatted}`);
    console.log(`📤 From: ${whatsappFrom}`);
    const result = await client.messages.create({
      from: whatsappFrom,
      to: toFormatted,
      body: message,
    });
    console.log(`✅ WhatsApp sent! SID: ${result.sid}`);
  } catch (error) {
    console.error('❌ WhatsApp send error:', error.message);
    console.error('   Status:', error.status);
    console.error('   Code:', error.code);
    if (error.code === 63007 || error.message.includes('sandbox')) {
      console.error('💡 FIX: Send "join <your-sandbox-word>" from WhatsApp +917358498414 to +14155238886');
    }
  }
};

module.exports = sendWhatsApp;
