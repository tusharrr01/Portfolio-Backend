import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Validation helper
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Send email endpoint
router.post('/send-email', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    // Check if environment variables are set
    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_PASSWORD) {
      console.error('Missing Gmail credentials in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Gmail credentials not set'
      });
    }

    // Create Nodemailer transporter with enhanced settings
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_PASSWORD
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false  // This helps with some server issues
      }
    });

    // Email content
    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: process.env.GMAIL_EMAIL,
      subject: `New Portfolio Contact from ${name}`,
      html: `
        <h2>New Message from Portfolio Contact Form</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This message was sent from your portfolio contact form.</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully! I will get back to you soon.'
    });

  } catch (error) {
    console.error('Email sending error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error response:', error.response?.data);
    console.error('Gmail user:', process.env.GMAIL_EMAIL);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.',
      errorDetails: error.message,  // Remove this in production
      errorCode: error.code
    });
  }
});

export default router;
