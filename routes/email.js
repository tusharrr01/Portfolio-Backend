import express from 'express';
import sgMail from '@sendgrid/mail';

const router = express.Router();

// Helper to escape HTML
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return (text || '').toString().replace(/[&<>"']/g, (m) => map[m]);
};

// Validation utilities
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(trimmed) && trimmed.length <= 254;
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 5000);
};

// initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('[Email Service] SendGrid API key loaded');
} else {
  console.error('[Email Service] SENDGRID_API_KEY missing');
}

// rate limiter
const rateLimitMap = new Map();
const checkRateLimit = (id, max = 5, windowMs = 3600000) => {
  const now = Date.now();
  if (!rateLimitMap.has(id)) rateLimitMap.set(id, []);
  const times = rateLimitMap.get(id).filter(t => now - t < windowMs);
  if (times.length >= max) return false;
  times.push(now);
  rateLimitMap.set(id, times);
  return true;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    const recent = v.filter(t => now - t < 3600000);
    if (recent.length) rateLimitMap.set(k, recent);
    else rateLimitMap.delete(k);
  }
}, 300000);

// POST /send-email
router.post('/send-email', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Request body must be JSON' });
    }

    let { name, email, message } = req.body;
    name = sanitizeInput(name);
    email = sanitizeInput(email).toLowerCase();
    message = sanitizeInput(message);

    // validation
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be 2-100 characters' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }
    if (!message || message.length < 10 || message.length > 5000) {
      return res.status(400).json({ success: false, message: 'Message must be 10-5000 characters' });
    }

    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Try again later.' });
    }

    if (!process.env.SENDGRID_API_KEY || !process.env.GMAIL_EMAIL) {
      console.error('[Email Service] missing configuration');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;border-bottom:2px solid #0066cc;">New Message from Portfolio Contact Form</h2>
        <p><strong>Name:</strong> ${escapedName}</p>
        <p><strong>Email:</strong> ${escapedEmail}</p>
        <p><strong>Message:</strong></p>
        <div style="background:#f5f5f5;padding:15px;border-left:4px solid #0066cc;">${escapedMessage}</div>
        <hr>
        <p style="color:#999;font-size:12px;">Sent on ${new Date().toLocaleString()}</p>
      </div>
    `;

    const textBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\nSent on ${new Date().toLocaleString()}`;

    const msg = {
      to: process.env.GMAIL_EMAIL,
      from: process.env.GMAIL_EMAIL,
      replyTo: email,
      subject: `New Portfolio Contact from ${escapedName}`,
      text: textBody,
      html: htmlBody
    };

    const sendStart = Date.now();
    await Promise.race([
      sgMail.send(msg),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SendGrid timeout')), 60000))
    ]);
    console.log(`[Email Service] sent via SendGrid in ${Date.now() - sendStart}ms`);

    return res.status(200).json({ success: true, message: 'Email sent successfully! I will get back to you soon.' });
  } catch (err) {
    console.error('[Email Service] error', err);
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(503).json({
      success: false,
      message: 'Email service temporarily unavailable.',
      ...(isDev && { error: err.message })
    });
  }
});

export default router;
