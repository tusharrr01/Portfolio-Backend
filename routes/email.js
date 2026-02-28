import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Helper function to escape HTML and prevent XSS
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Validation helper
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmedEmail) && trimmedEmail.length <= 254;
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 5000); // Limit length to prevent abuse
};

// Create transporter (reuse single instance for better performance)
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_PASSWORD) {
    throw new Error('Missing Gmail credentials in environment variables');
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD
    },
    connectionTimeout: 15000,
    socketTimeout: 15000,
    pool: {
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 4000,
      rateLimit: 14
    },
    tls: {
      rejectUnauthorized: false
    },
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development'
  });

  return transporter;
};

// Rate limiting map (simple in-memory rate limiting)
const rateLimitMap = new Map();

const checkRateLimit = (identifier, maxRequests = 5, windowMs = 3600000) => {
  const now = Date.now();
  const key = identifier;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }

  const requests = rateLimitMap.get(key);
  const recentRequests = requests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(key, recentRequests);
  return true;
};

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of rateLimitMap.entries()) {
    const recent = times.filter((time) => now - time < 3600000);
    if (recent.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, recent);
    }
  }
}, 300000); // Clean every 5 minutes

// Send email endpoint
router.post('/send-email', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    // Parse and validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be valid JSON'
      });
    }

    // Extract and sanitize input
    let { name, email, message } = req.body;

    name = sanitizeInput(name).trim();
    email = sanitizeInput(email).trim().toLowerCase();
    message = sanitizeInput(message).trim();

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be less than 100 characters'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message must be less than 5000 characters'
      });
    }

    // Rate limiting check (5 requests per hour per IP)
    if (!checkRateLimit(clientIP, 5, 3600000)) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    // Check environment variables
    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_PASSWORD) {
      console.error('[Email Service] Missing Gmail credentials');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please try again later.'
      });
    }

    // Get transporter and send email
    const emailTransporter = getTransporter();

    // Escape HTML to prevent XSS
    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: process.env.GMAIL_EMAIL,
      replyTo: email,
      subject: `New Portfolio Contact from ${escapedName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
            New Message from Portfolio Contact Form
          </h2>
          <div style="margin: 20px 0;">
            <p style="margin: 10px 0;">
              <strong style="color: #333;">Name:</strong> 
              <span style="color: #666;">${escapedName}</span>
            </p>
            <p style="margin: 10px 0;">
              <strong style="color: #333;">Email:</strong> 
              <span style="color: #666;">${escapedEmail}</span>
            </p>
            <p style="margin: 10px 0;">
              <strong style="color: #333;">Message:</strong>
            </p>
            <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #0066cc; margin: 10px 0; color: #333;">
              ${escapedMessage}
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This message was sent from your portfolio contact form. 
            <br>Sent on ${new Date().toLocaleString()}
          </p>
        </div>
      `,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}

---
This message was sent from your portfolio contact form.
Sent on ${new Date().toLocaleString()}
      `
    };

    // Send email with timeout
    await Promise.race([
      emailTransporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout')), 30000)
      )
    ]);

    console.log(`[Email Service] Email sent successfully from ${escapedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully! I will get back to you soon.'
    });

  } catch (error) {
    console.error('[Email Service] Error sending email:', error.message);
    console.error('[Email Service] Error code:', error.code);

    // Log error but don't expose details to client in production
    const isDev = process.env.NODE_ENV === 'development';
    const errorDetails = isDev ? error.message : undefined;

    // Handle specific error types
    if (error.code === 'EAUTH') {
      return res.status(500).json({
        success: false,
        message: 'Authentication error. Please check Gmail credentials.',
        ...(isDev && { error: error.message })
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
        ...(isDev && { error: error.message })
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.',
      ...(isDev && { error: errorDetails })
    });
  }
});

export default router;
