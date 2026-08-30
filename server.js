import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-load .env environment file
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  try {
    const envText = fs.readFileSync(envFile, 'utf8');
    envText.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (k && v) process.env[k] = v;
        }
      }
    });
  } catch(e){}
}

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'familygenapp_jwt_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

const DB_STORE_PATH = path.join(__dirname, 'db/database_store.json');
const globalUserCache = new Map();

// Helper to load database store with serverless memory cache sync
function loadDbStore() {
  let data = { members: [], users: [], audit_logs: [], pending_requests: [], notifications: [], otp_verifications: [] };
  try {
    if (fs.existsSync(DB_STORE_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_STORE_PATH, 'utf8'));
    }
  } catch(err) {
    console.error('Error reading DB store:', err);
  }
  if (!data.users) data.users = [];
  if (!data.members) data.members = [];
  if (!data.audit_logs) data.audit_logs = [];
  if (!data.pending_requests) data.pending_requests = [];
  if (!data.notifications) data.notifications = [];
  if (!data.otp_verifications) data.otp_verifications = [];

  // Merge in-memory cached users so serverless instances never lose registered users
  globalUserCache.forEach((u, em) => {
    if (!data.users.some(existing => existing.email && existing.email.toLowerCase() === em)) {
      data.users.unshift(u);
    }
  });

  // Sync memory cache
  data.users.forEach(u => {
    if (u.email) globalUserCache.set(u.email.trim().toLowerCase(), u);
  });

  return data;
}

// Helper to expire stale online sessions (> 35 seconds of inactivity)
function cleanStaleSessions(db) {
  const STALE_TIMEOUT_MS = 35 * 1000; // 35 seconds
  const now = Date.now();
  let changed = false;

  if (db && Array.isArray(db.users)) {
    db.users.forEach(u => {
      if (u.is_online) {
        const lastActivity = u.last_login ? new Date(u.last_login).getTime() : 0;
        if (now - lastActivity > STALE_TIMEOUT_MS) {
          u.is_online = false;
          if (u.email) globalUserCache.set(u.email.trim().toLowerCase(), u);
          changed = true;
        }
      }
    });
  }

  if (changed) {
    saveDbStore(db);
  }
  return changed;
}

// Helper to save database store
function saveDbStore(data) {
  try {
    fs.writeFileSync(DB_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch(err) {
    console.error('Error saving DB store:', err);
  }
}

// Script-sensitive surname helper
function appendTiwariSurname(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';

  const isHindi = /[\u0900-\u097F]/.test(trimmed);

  if (isHindi) {
    if (!trimmed.endsWith('तिवारी')) {
      return trimmed + ' तिवारी';
    }
    return trimmed;
  } else {
    if (!trimmed.toLowerCase().endsWith('tiwari')) {
      return trimmed + ' Tiwari';
    }
    return trimmed;
  }
}

// Helper for parsing month from DOB string
const HINDI_MONTHS = {
  'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
  'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'दिसंबर': 12
};

const ENGLISH_MONTHS = {
  'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
  'apr': 4, 'april': 4, 'may': 5, 'june': 6, 'jun': 6,
  'jul': 7, 'july': 7, 'aug': 8, 'august': 8, 'sep': 9, 'september': 9,
  'oct': 10, 'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12
};

function parseDobDayMonth(dobStr) {
  if (!dobStr) return null;
  const str = String(dobStr).trim();
  
  if (str.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
    const parts = str.split(/[\/\-]/);
    return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }
  
  const tokens = str.replace(/[,]/g, '').split(/[\s\-]+/);
  let day = null;
  let month = null;

  for (let tok of tokens) {
    const num = parseInt(tok, 10);
    if (!isNaN(num) && num >= 1 && num <= 31 && day === null) {
      day = num;
    }
    const lowerTok = tok.toLowerCase();
    if (HINDI_MONTHS[lowerTok]) month = HINDI_MONTHS[lowerTok];
    else if (ENGLISH_MONTHS[lowerTok]) month = ENGLISH_MONTHS[lowerTok];
  }

  if (day !== null && month !== null) {
    return { day, month };
  }
  return null;
}

import nodemailer from 'nodemailer';

// =========================================================================
// FREE SMTP EMAIL OTP AUTHENTICATION & SECURITY ENGINE
// =========================================================================

const OTP_SECRET = process.env.OTP_SECRET || 'familygen_secure_otp_secret_key_2026';

function generateStatelessOtpToken(email, otpCode, ttlMinutes = 5) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const data = `${email}:${otpCode}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', OTP_SECRET).update(data).digest('hex');
  return `${email}:${expiresAt}:${signature}`;
}

function verifyStatelessOtpToken(email, otpCode, token) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'INVALID_TOKEN' };
  const parts = token.split(':');
  if (parts.length !== 3) return { valid: false, reason: 'MALFORMED_TOKEN' };

  const [tokenEmail, tokenExpiresAt, tokenSignature] = parts;
  if (tokenEmail.toLowerCase() !== email.toLowerCase()) return { valid: false, reason: 'EMAIL_MISMATCH' };

  const expiresAtNum = Number(tokenExpiresAt);
  if (isNaN(expiresAtNum) || Date.now() > expiresAtNum) {
    return { valid: false, reason: 'EXPIRED' };
  }

  const expectedData = `${email}:${otpCode}:${tokenExpiresAt}`;
  const expectedSignature = crypto.createHmac('sha256', OTP_SECRET).update(expectedData).digest('hex');

  const bufA = Buffer.from(tokenSignature);
  const bufB = Buffer.from(expectedSignature);
  if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: true };
  }
  return { valid: false, reason: 'INVALID_OTP' };
}

function generateRandomOtp() {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
}

function generateJwtToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    mobile_number: user.mobile_number,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

let etherealTestAccount = null;

async function getSmtpTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }),
      isTest: false
    };
  }

  if (!etherealTestAccount) {
    try {
      etherealTestAccount = await nodemailer.createTestAccount();
      console.log('📧 Created Ethereal SMTP Account:', etherealTestAccount.user);
    } catch(err) {
      console.error('Failed to create Ethereal test account:', err.message);
    }
  }

  if (etherealTestAccount) {
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealTestAccount.user,
          pass: etherealTestAccount.pass
        }
      }),
      isTest: true
    };
  }

  return null;
}

function dispatchResendEmail(apiKey, fromEmail, recipientEmail, subject, htmlContent) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        from: fromEmail || 'onboarding@resend.dev',
        to: [recipientEmail],
        subject: subject,
        html: htmlContent
      });

      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch(e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', (err) => resolve({ status: 500, error: err.message }));
      req.write(payload);
      req.end();
    } catch(err) {
      resolve({ status: 500, error: err.message });
    }
  });
}

async function sendEmailViaSmtp(recipientEmail, otpCode) {
  const messageText = `Your Family-GenApp verification OTP is ${otpCode}. Valid for 5 minutes. Do not share it with anyone.`;
  
  console.log(`\n=================================================`);
  console.log(`📧 REAL-TIME EMAIL OTP DISPATCH`);
  console.log(`Recipient: ${recipientEmail}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`Message: "${messageText}"`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`=================================================\n`);

  // 1. Check for Resend API Key (Resend free testing domain allows sending directly to account owner email)
  if (process.env.RESEND_API_KEY && recipientEmail.toLowerCase().includes('rohitkumartiwari1993')) {
    try {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; background-color: #050B20; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #5C6CFF;">
          <h2 style="color: #5C6CFF; margin-bottom: 10px;">Family-GenApp Portal</h2>
          <p style="font-size: 14px; color: #cbd5e1;">Your login verification OTP code for <strong>${recipientEmail}</strong> is:</p>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #fbbf24; background: #0c1838; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid #38bdf8;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #94a3b8;">This OTP is valid for <strong>5 minutes</strong>. Maximum 5 verification attempts allowed.</p>
        </div>
      `;

      const resendResult = await dispatchResendEmail(
        process.env.RESEND_API_KEY,
        process.env.RESEND_FROM || 'onboarding@resend.dev',
        recipientEmail,
        '🔐 Family-GenApp Verification OTP Code',
        htmlBody
      );

      console.log('Resend API Delivery Response:', resendResult);
      if (resendResult.data && resendResult.data.id) {
        return { success: true, provider: 'Resend API Gateway', messageId: resendResult.data.id };
      }
    } catch (err) {
      console.error('Resend API Delivery Error:', err.message);
    }
  }

  // 2. Check for Brevo / Sendinblue API Key (https://brevo.com - Free 300 emails/day to any email address)
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Family-GenApp Portal', email: process.env.BREVO_SENDER || 'no-reply@familygen.com' },
          to: [{ email: recipientEmail }],
          subject: '🔐 Family-GenApp Verification OTP Code',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; background-color: #050B20; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #5C6CFF;">
              <h2 style="color: #5C6CFF; margin-bottom: 10px;">Family-GenApp Portal</h2>
              <p style="font-size: 14px; color: #cbd5e1;">Your login verification OTP code for <strong>${recipientEmail}</strong> is:</p>
              <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #fbbf24; background: #0c1838; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid #38bdf8;">
                ${otpCode}
              </div>
              <p style="font-size: 12px; color: #94a3b8;">This OTP is valid for <strong>5 minutes</strong>. Maximum 5 verification attempts allowed.</p>
            </div>
          `
        })
      });
      const resJson = await response.json();
      console.log('Brevo API Delivery Response:', resJson);
      if (resJson.messageId) {
        return { success: true, provider: 'Brevo API Gateway', messageId: resJson.messageId };
      }
    } catch (err) {
      console.error('Brevo API Delivery Error:', err.message);
    }
  }

  // 3. Check Nodemailer SMTP (Gmail / Custom SMTP)
  try {
    const smtpObj = await getSmtpTransporter();
    if (smtpObj && smtpObj.transporter) {
      const info = await smtpObj.transporter.sendMail({
        from: `"Family-GenApp Portal" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@familygen.com'}>`,
        to: recipientEmail,
        subject: '🔐 Family-GenApp Verification OTP Code',
        text: messageText,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #050B20; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #5C6CFF;">
            <h2 style="color: #5C6CFF; margin-bottom: 10px;">Family-GenApp Portal</h2>
            <p style="font-size: 14px; color: #cbd5e1;">Your login verification OTP code for <strong>${recipientEmail}</strong> is:</p>
            <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #fbbf24; background: #0c1838; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid #38bdf8;">
              ${otpCode}
            </div>
            <p style="font-size: 12px; color: #94a3b8;">This OTP is valid for <strong>5 minutes</strong>. Maximum 5 verification attempts allowed.</p>
          </div>
        `
      });

      console.log('Nodemailer SMTP Email Sent Successfully! Message ID:', info.messageId);

      let previewUrl = null;
      if (smtpObj.isTest) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log('🔗 Ethereal Live Email Preview URL:', previewUrl);
      }

      return {
        success: true,
        provider: smtpObj.isTest ? 'Ethereal Real-Time SMTP' : 'Gmail SMTP',
        messageId: info.messageId,
        previewUrl: previewUrl
      };
    }
  } catch (err) {
    console.error('Nodemailer SMTP Email Delivery Error:', err.message);
  }

  return { success: true, provider: 'Console Logging Fallback', otpCode };
}

// AUTH ROUTE 1: POST /api/auth/send-otp (EMAIL-BASED OTP DISPATCH)
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim().includes('@')) {
    return res.status(400).json({ success: false, message: 'वैध ईमेल आईडी दर्ज करें (Valid email address required)' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const db = loadDbStore();

  // Check if email is registered in application database or memory cache
  let user = db.users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail) || globalUserCache.get(cleanEmail);
  
  // Hardcoded Super Admin fallback check for rohitkumartiwari1993@gmail.com
  if (!user && cleanEmail === 'rohitkumartiwari1993@gmail.com') {
    user = {
      id: 'U_SUPER_ADMIN',
      first_name: 'Rohit',
      surname: 'Tiwari',
      full_name: 'Rohit Tiwari',
      mobile_number: '8871174576',
      email: 'rohitkumartiwari1993@gmail.com',
      role: 'SUPER_ADMIN',
      status: 'Active',
      registration_date: '2026-01-01T00:00:00.000Z',
      last_login: new Date().toISOString(),
      is_online: false
    };
    db.users.unshift(user);
    globalUserCache.set(cleanEmail, user);
  }

  // Fallback auto-registration if userInfo is passed in request body
  if (!user && req.body.userInfo && req.body.userInfo.email) {
    const uInfo = req.body.userInfo;
    user = {
      id: `U_${String(db.users.length + 1).padStart(3, '0')}`,
      first_name: uInfo.firstName || 'User',
      surname: uInfo.surname || 'Tiwari',
      full_name: uInfo.fullName || `${uInfo.firstName || ''} ${uInfo.surname || ''}`.trim() || 'User',
      dob: uInfo.dob || '',
      mobile_number: uInfo.mobileNumber || '9999999999',
      email: cleanEmail,
      role: 'MEMBER',
      status: 'Active',
      registration_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    db.users.unshift(user);
    globalUserCache.set(cleanEmail, user);
    saveDbStore(db);
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'This email address is not registered.' });
  }

  if (!db.email_otp_verification) db.email_otp_verification = [];

  // Check 30-Second Resend Cooldown Rule
  const activeVerifications = db.email_otp_verification.filter(v => v.email.toLowerCase() === cleanEmail && v.status === 'PENDING');
  if (activeVerifications.length > 0) {
    const latest = activeVerifications[0];
    const elapsedSeconds = Math.floor((Date.now() - new Date(latest.generated_at).getTime()) / 1000);
    if (elapsedSeconds < 30) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${30 - elapsedSeconds} seconds before requesting a new OTP.`,
        remainingSeconds: 30 - elapsedSeconds
      });
    }
    // Invalidate previous pending OTPs
    activeVerifications.forEach(v => v.status = 'SUPERSEDED');
  }

  // Generate cryptographically random 6-digit OTP
  const otpCode = generateRandomOtp();
  const otpHash = hashOtp(otpCode);
  const otpToken = generateStatelessOtpToken(cleanEmail, otpCode, 5);

  const otpRecord = {
    id: `OTP_${Date.now()}`,
    email: cleanEmail,
    otp_hash: otpHash,
    otp_token: otpToken,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 Minutes Expiry
    attempt_count: 0,
    status: 'PENDING',
    verified_at: null
  };

  db.email_otp_verification.unshift(otpRecord);

  // Audit Logging
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Email OTP Generated & Sent',
    user_modified: `${user.full_name} (${cleanEmail})`,
    old_role: user.role,
    new_role: user.role,
    changed_by: 'Auth System Core',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);

  // Dispatch via SMTP Email Provider
  const emailResult = await sendEmailViaSmtp(cleanEmail, otpCode);

  res.json({
    success: true,
    message: `OTP has been sent to ${cleanEmail}. Please check your email inbox.`,
    resendCooldownSeconds: 30,
    expiresInMinutes: 5,
    otpToken: otpToken,
    emailProvider: emailResult.provider,
    previewUrl: emailResult.previewUrl,
    demoOtpCode: otpCode
  });
});

// AUTH ROUTE 2: POST /api/auth/verify-otp (EMAIL-BASED OTP VERIFICATION)
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp, otpToken } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email address and OTP are required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  const db = loadDbStore();

  const user = db.users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Email address is not registered.' });
  }

  // A. Check Stateless HMAC Token First (100% Reliable for Vercel Serverless Functions)
  if (otpToken) {
    const tokenVerification = verifyStatelessOtpToken(cleanEmail, cleanOtp, otpToken);
    if (tokenVerification.valid) {
      user.is_online = true;
      user.last_login = new Date().toISOString();
      saveDbStore(db);

      return res.json({
        success: true,
        message: 'Authentication successful! Welcome to Family-GenApp.',
        user: user
      });
    } else if (tokenVerification.reason === 'EXPIRED') {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
    }
  }

  // B. Stateful Database Fallback Check
  if (!db.email_otp_verification) db.email_otp_verification = [];
  const otpRecord = db.email_otp_verification.find(v => v.email.toLowerCase() === cleanEmail && v.status === 'PENDING');
  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'गलत या अमान्य ओटीपी! (Invalid or Expired OTP code entered)' });
  }

  // 1. Check Expiration (5 Minutes Expiry Rule)
  if (new Date(otpRecord.expires_at) < new Date()) {
    otpRecord.status = 'EXPIRED';
    saveDbStore(db);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
  }

  // 2. Check Maximum Attempts (5 Attempts Rule)
  if (otpRecord.attempt_count >= 5) {
    otpRecord.status = 'BLOCKED';
    saveDbStore(db);
    return res.status(429).json({ success: false, message: 'Maximum verification attempts (5) exceeded. Please request a fresh OTP.' });
  }

  // 3. Verify OTP Hash
  const inputHash = hashOtp(cleanOtp);
  if (inputHash !== otpRecord.otp_hash) {
    otpRecord.attempt_count += 1;
    if (otpRecord.attempt_count >= 5) {
      otpRecord.status = 'BLOCKED';
    }

    // Log Failure
    db.audit_logs.unshift({
      id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
      action_type: 'Email OTP Failure (Invalid OTP)',
      user_modified: `${user.full_name} (${cleanEmail})`,
      old_role: user.role,
      new_role: 'FAILED_ATTEMPT',
      changed_by: 'Auth System Core',
      date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });

    saveDbStore(db);

    if (otpRecord.attempt_count >= 5) {
      return res.status(429).json({ success: false, message: 'Maximum verification attempts (5) exceeded. Please request a fresh OTP.' });
    }

    return res.status(400).json({
      success: false,
      message: `Invalid OTP. Please try again. (${5 - otpRecord.attempt_count} attempts remaining)`,
      remainingAttempts: 5 - otpRecord.attempt_count
    });
  }

  // OTP IS VALID & CORRECT!
  otpRecord.status = 'VERIFIED';
  otpRecord.verified_at = new Date().toISOString();

  // Mark User as ONLINE & Record Last Login Time
  user.status = 'Active';
  user.is_online = true;
  user.last_login = new Date().toISOString();
  user.updated_at = new Date().toISOString();

  // Create Signed JWT Session Token
  const jwtToken = generateJwtToken(user);

  // Log Login Success
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Login Success (Email OTP Verified)',
    user_modified: `${user.full_name} (${cleanEmail})`,
    old_role: user.role,
    new_role: user.role,
    changed_by: 'Auth System Core',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);

  res.json({
    success: true,
    message: 'OTP Verification Successful.',
    token: jwtToken,
    user: user
  });
});

// AUTH ROUTE 3: POST /api/auth/resend-otp
app.post('/api/auth/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const db = loadDbStore();

  const user = db.users.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Email address is not registered.' });
  }

  if (!db.email_otp_verification) db.email_otp_verification = [];

  // Check 30-second cooldown
  const latestPending = db.email_otp_verification.find(v => v.email.toLowerCase() === cleanEmail && v.status === 'PENDING');
  if (latestPending) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(latestPending.generated_at).getTime()) / 1000);
    if (elapsedSeconds < 30) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${30 - elapsedSeconds} seconds before requesting a new OTP.`,
        remainingSeconds: 30 - elapsedSeconds
      });
    }
    latestPending.status = 'SUPERSEDED';
  }

  const otpCode = generateRandomOtp();
  const otpHash = hashOtp(otpCode);

  const otpRecord = {
    id: `OTP_${Date.now()}`,
    email: cleanEmail,
    otp_hash: otpHash,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    attempt_count: 0,
    status: 'PENDING',
    verified_at: null
  };

  db.email_otp_verification.unshift(otpRecord);

  // Audit Logging
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Email OTP Resent',
    user_modified: `${user.full_name} (${cleanEmail})`,
    old_role: user.role,
    new_role: user.role,
    changed_by: 'Auth System Core',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);

  const emailResult = await sendEmailViaSmtp(cleanEmail, otpCode);

  res.json({
    success: true,
    message: 'OTP has been resent to your registered email.',
    resendCooldownSeconds: 30,
    expiresInMinutes: 5,
    emailProvider: emailResult.provider,
    demoOtpCode: otpCode
  });
});

// AUTH ROUTE 4: POST /api/auth/register (MANDATORY EMAIL ID + DEFAULT ROLE = MEMBER)
app.post('/api/auth/register', (req, res) => {
  const { firstName, surname, dob, mobileNumber, email } = req.body;
  if (!firstName || !surname || !dob || !mobileNumber || !email) {
    return res.status(400).json({ success: false, message: 'सभी आवश्यक विवरण भरें (All fields including Email ID are required)' });
  }

  const cleanMobile = String(mobileNumber).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (cleanMobile.length !== 10) {
    return res.status(400).json({ success: false, message: '10 अंकों का वैध मोबाइल नंबर दर्ज करें (10-digit mobile number required)' });
  }

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).json({ success: false, message: 'वैध ईमेल आईडी दर्ज करें (Valid email address required)' });
  }

  const db = loadDbStore();

  // Validate Unique Email Address
  if (db.users.some(u => u.email && u.email.trim().toLowerCase() === cleanEmail) || globalUserCache.has(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'यह ईमेल आईडी पहले से पंजीकृत है! (Email address already registered)' });
  }

  // Default Role = MEMBER for all new registrations
  const role = (cleanMobile === '8871174576' || cleanEmail === 'rohitkumartiwari1993@gmail.com') ? 'SUPER_ADMIN' : 'MEMBER';
  const fullName = `${firstName.trim()} ${surname.trim()}`;
  const nowIso = new Date().toISOString();

  const newUser = {
    id: `U_${String(db.users.length + 1).padStart(3, '0')}`,
    first_name: firstName.trim(),
    surname: surname.trim(),
    full_name: fullName,
    dob: dob.trim(),
    mobile_number: cleanMobile,
    email: cleanEmail,
    role: role,
    status: 'Active',
    registration_date: nowIso,
    last_login: null,
    is_online: false,
    created_at: nowIso,
    updated_at: nowIso
  };

  globalUserCache.set(cleanEmail, newUser);
  db.users.unshift(newUser);

  // Notify Super Admin
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: `NOTIF_${Date.now()}`,
    recipient_mobile: '8871174576',
    recipient_email: 'rohitkumartiwari1993@gmail.com',
    message: `New user registered: ${fullName} (${cleanEmail})`,
    created_at: nowIso,
    is_read: false
  });

  // Audit Logging
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'New User Registered',
    user_modified: `${fullName} (${cleanEmail})`,
    old_role: 'N/A',
    new_role: role,
    changed_by: 'Public Registration Form',
    date_time: nowIso.replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);

  res.json({
    success: true,
    message: 'Registration Successful. Please use your registered email to receive OTP during login.',
    user: newUser
  });
});

// AUTH ROUTE 5: POST /api/auth/logout (MARKS USER OFFLINE INSTANTLY)
app.post('/api/auth/logout', (req, res) => {
  let email = req.body ? req.body.email : null;
  let userId = req.body ? req.body.userId : null;

  // Support text payload from sendBeacon
  if (!email && typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      email = parsed.email;
      userId = parsed.userId;
    } catch(e){}
  }

  const db = loadDbStore();

  let user = null;
  if (email) user = db.users.find(u => u.email && u.email.trim().toLowerCase() === String(email).trim().toLowerCase()) || globalUserCache.get(String(email).trim().toLowerCase());
  else if (userId) user = db.users.find(u => u.id === userId);

  if (user) {
    user.is_online = false;
    user.updated_at = new Date().toISOString();
    if (user.email) globalUserCache.set(user.email.trim().toLowerCase(), user);
    saveDbStore(db);
  }

  cleanStaleSessions(db);
  res.json({ success: true, message: 'User logged out and marked OFFLINE.' });
});

// AUTH ROUTE 6: POST /api/auth/heartbeat (KEEPS ONLINE STATUS ACTIVE & EXPIRES STALE SESSIONS)
app.post('/api/auth/heartbeat', (req, res) => {
  const { email, userId } = req.body;
  const db = loadDbStore();

  let activeUser = null;
  if (email) activeUser = db.users.find(u => u.email && u.email.trim().toLowerCase() === String(email).trim().toLowerCase()) || globalUserCache.get(String(email).trim().toLowerCase());
  else if (userId) activeUser = db.users.find(u => u.id === userId);

  if (activeUser) {
    activeUser.is_online = true;
    activeUser.last_login = new Date().toISOString();
    if (activeUser.email) globalUserCache.set(activeUser.email.trim().toLowerCase(), activeUser);
  }

  cleanStaleSessions(db);
  saveDbStore(db);

  res.json({
    success: true,
    onlineCount: db.users.filter(u => u.is_online).length,
    users: db.users
  });
});

// USER MANAGEMENT ROUTE: GET /api/users/stats (SUPER ADMIN INSIGHTS & WIDGETS)
app.get('/api/users/stats', (req, res) => {
  const db = loadDbStore();

  const totalRegisteredUsers = db.users.length;
  const onlineUsers = db.users.filter(u => u.is_online).length;
  const offlineUsers = totalRegisteredUsers - onlineUsers;
  const adminsCount = db.users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length;
  const membersCount = db.users.filter(u => u.role === 'MEMBER').length;
  const recentRegistrations = db.users.slice(0, 5);

  res.json({
    success: true,
    data: {
      totalRegisteredUsers,
      onlineUsers,
      offlineUsers,
      adminsCount,
      membersCount,
      recentRegistrations
    }
  });
});

// 1. GET /api/members (All Village Members from DB)
app.get('/api/members', (req, res) => {
  const db = loadDbStore();
  res.json({
    success: true,
    count: db.members.length,
    data: db.members
  });
});

// 2. GET /api/tree (Reconstructed Parent-Child Hierarchy Tree from DB father_id)
app.get('/api/tree', (req, res) => {
  const db = loadDbStore();
  const memberMap = new Map();

  db.members.forEach(m => {
    memberMap.set(m.id, {
      text: {
        name: m.raw_name || m.full_name,
        title: m.occupation || '',
        DOB: m.dob || undefined
      },
      id: m.id,
      father_id: m.father_id,
      current_city: m.current_city || '',
      occupation: m.occupation || '',
      profile_image: m.profile_image || './default_avatar.png',
      children: []
    });
  });

  const rootNodes = [];

  db.members.forEach(m => {
    const node = memberMap.get(m.id);
    if (m.father_id && memberMap.has(m.father_id)) {
      memberMap.get(m.father_id).children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  res.json({
    success: true,
    data: rootNodes
  });
});

// 3. GET /api/birthdays (Current Month Birthdays from DB)
app.get('/api/birthdays', (req, res) => {
  const db = loadDbStore();
  const curMonth = new Date().getMonth() + 1;

  const matched = [];

  db.members.forEach(m => {
    if (m.dob) {
      const parsed = parseDobDayMonth(m.dob);
      if (parsed && parsed.month === curMonth) {
        matched.push({
          id: m.id,
          name: m.full_name,
          dobRaw: m.dob,
          day: parsed.day,
          month: parsed.month
        });
      }
    }
  });

  matched.sort((a, b) => a.day - b.day);

  res.json({
    success: true,
    month: curMonth,
    count: matched.length,
    data: matched
  });
});

// 4. GET /api/pending-requests & POST /api/pending-requests
app.get('/api/pending-requests', (req, res) => {
  const db = loadDbStore();
  res.json({
    success: true,
    count: db.pending_requests.length,
    data: db.pending_requests
  });
});

app.post('/api/pending-requests', (req, res) => {
  const { childName, dob, fatherId, fatherName, photoData, requestedBy, currentCity, occupation, housePhotos } = req.body;
  if (!childName || !dob || !fatherId) {
    return res.status(400).json({ success: false, message: 'कृपया सभी आवश्यक विवरण भरें (Child Name, DOB, and Father Selection are required)' });
  }

  const db = loadDbStore();
  let formattedName = appendTiwariSurname(childName);

  const newReq = {
    id: `REQ_${String(db.pending_requests.length + 1).padStart(3, '0')}`,
    child_name: formattedName,
    dob: dob,
    current_city: currentCity || '',
    occupation: occupation || '',
    father_id: fatherId,
    father_name: fatherName,
    photo_data: photoData || './default_avatar.png',
    house_photos: Array.isArray(housePhotos) ? housePhotos.slice(0, 5) : [],
    requested_by: requestedBy || 'Registered Member',
    request_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'PENDING',
    rejection_reason: null,
    approved_by: null,
    approval_date: null
  };

  db.pending_requests.unshift(newReq);

  // Notification for Admin
  db.notifications.unshift({
    id: `NOTIF_${Date.now()}`,
    recipient_mobile: 'SUPER_ADMIN',
    message: `New Member Addition Request Submitted for ${formattedName}`,
    created_at: new Date().toISOString(),
    is_read: false
  });

  // Audit Log
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Member Request Submitted',
    user_modified: `${formattedName} (Father: ${fatherName})`,
    old_role: 'N/A',
    new_role: 'PENDING',
    changed_by: requestedBy || 'Registered Member',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, data: newReq });
});

// 5. POST /api/pending-requests/:id/approve (Super Admin Approval)
app.post('/api/pending-requests/:id/approve', (req, res) => {
  const reqId = req.params.id;
  const { approvedBy } = req.body;
  const db = loadDbStore();

  const reqIdx = db.pending_requests.findIndex(r => r.id === reqId);
  if (reqIdx === -1) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const reqItem = db.pending_requests[reqIdx];
  if (reqItem.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: 'Request already processed' });
  }

  // Find father to derive generation level
  const father = db.members.find(m => m.id === reqItem.father_id);
  const fatherGen = father ? (father.generation_level || 1) : 1;
  const childGen = fatherGen + 1;

  let finalName = appendTiwariSurname(reqItem.child_name);

  const newMemberId = `P_${String(db.members.length + 1).padStart(3, '0')}`;

  const newMember = {
    id: newMemberId,
    full_name: finalName,
    raw_name: finalName,
    father_id: reqItem.father_id,
    dob: reqItem.dob,
    title: '',
    gender: 'Male',
    current_city: reqItem.current_city || '',
    occupation: reqItem.occupation || '',
    profile_image: reqItem.photo_data || './default_avatar.png',
    house_photos: reqItem.house_photos || [],
    marriage_note: null,
    marriages_count: 1,
    generation_level: childGen,
    created_at: new Date().toISOString()
  };

  // Insert into members table
  db.members.push(newMember);

  // Mark request APPROVED
  db.pending_requests[reqIdx].status = 'APPROVED';
  db.pending_requests[reqIdx].approved_by = approvedBy || 'Rohit Tiwari (Super Admin)';
  db.pending_requests[reqIdx].approval_date = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // User Notification
  db.notifications.unshift({
    id: `NOTIF_${Date.now()}`,
    recipient_mobile: reqItem.requested_by,
    message: `Your member request for ${finalName} has been approved.`,
    created_at: new Date().toISOString(),
    is_read: false
  });

  // Audit Log
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Member Request Approved',
    user_modified: `${newMemberId} (${finalName})`,
    old_role: 'PENDING',
    new_role: 'APPROVED (MEMBER)',
    changed_by: approvedBy || 'Rohit Tiwari (Super Admin)',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, member: newMember, request: db.pending_requests[reqIdx] });
});

// 6. POST /api/pending-requests/:id/reject (Super Admin Rejection)
app.post('/api/pending-requests/:id/reject', (req, res) => {
  const reqId = req.params.id;
  const { reason, rejectedBy } = req.body;
  const db = loadDbStore();

  const reqIdx = db.pending_requests.findIndex(r => r.id === reqId);
  if (reqIdx === -1) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  db.pending_requests[reqIdx].status = 'REJECTED';
  db.pending_requests[reqIdx].rejection_reason = reason || 'Not meeting village criteria';
  db.pending_requests[reqIdx].approved_by = rejectedBy || 'Rohit Tiwari (Super Admin)';
  db.pending_requests[reqIdx].approval_date = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // User Notification
  db.notifications.unshift({
    id: `NOTIF_${Date.now()}`,
    recipient_mobile: db.pending_requests[reqIdx].requested_by,
    message: `Your member request for ${db.pending_requests[reqIdx].child_name} has been rejected. Reason: ${reason || 'Not meeting criteria'}`,
    created_at: new Date().toISOString(),
    is_read: false
  });

  // Audit Log
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Member Request Rejected',
    user_modified: db.pending_requests[reqIdx].child_name,
    old_role: 'PENDING',
    new_role: 'REJECTED',
    changed_by: rejectedBy || 'Rohit Tiwari (Super Admin)',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, request: db.pending_requests[reqIdx] });
});

// 7. POST /api/members/direct-add (Super Admin Direct Addition)
app.post('/api/members/direct-add', (req, res) => {
  const { childName, dob, fatherId, photoData, addedBy, currentCity, occupation, housePhotos } = req.body;
  const db = loadDbStore();

  let finalName = appendTiwariSurname(childName);

  const father = db.members.find(m => m.id === fatherId);
  const fatherGen = father ? (father.generation_level || 1) : 1;
  const childGen = fatherGen + 1;

  const newMemberId = `P_${String(db.members.length + 1).padStart(3, '0')}`;

  const newMember = {
    id: newMemberId,
    full_name: finalName,
    raw_name: finalName,
    father_id: fatherId,
    dob: dob,
    title: '',
    gender: 'Male',
    current_city: currentCity || '',
    occupation: occupation || '',
    profile_image: photoData || './default_avatar.png',
    house_photos: Array.isArray(housePhotos) ? housePhotos.slice(0, 5) : [],
    marriage_note: null,
    marriages_count: 1,
    generation_level: childGen,
    created_at: new Date().toISOString()
  };

  db.members.push(newMember);

  // Audit Log
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Member Added Directly',
    user_modified: `${newMemberId} (${finalName})`,
    old_role: 'N/A',
    new_role: 'DIRECT_ADD',
    changed_by: addedBy || 'Rohit Tiwari (Super Admin)',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, data: newMember });
});

// 8. PUT /api/members/:id (Super Admin Edit Member)
app.put('/api/members/:id', (req, res) => {
  const memberId = req.params.id;
  const { full_name, dob, father_id, current_city, occupation, profile_image, updatedBy } = req.body;
  const db = loadDbStore();

  const idx = db.members.findIndex(m => m.id === memberId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Member not found' });
  }

  let finalName = full_name.trim();
  if (!finalName.endsWith('तिवारी')) {
    finalName += ' तिवारी';
  }

  if (father_id && father_id !== db.members[idx].father_id) {
    const father = db.members.find(m => m.id === father_id);
    if (father) {
      db.members[idx].generation_level = (father.generation_level || 1) + 1;
    }
  }

  db.members[idx].full_name = finalName;
  db.members[idx].raw_name = finalName;
  if (dob !== undefined) db.members[idx].dob = dob;
  if (father_id !== undefined) db.members[idx].father_id = father_id;
  if (current_city !== undefined) db.members[idx].current_city = current_city;
  if (occupation !== undefined) db.members[idx].occupation = occupation;
  if (profile_image !== undefined) db.members[idx].profile_image = profile_image;

  saveDbStore(db);

  // Audit Log
  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: 'Member Updated',
    user_modified: `${memberId} (${finalName})`,
    old_role: 'N/A',
    new_role: 'UPDATED',
    changed_by: updatedBy || 'Rohit Tiwari (Super Admin)',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, data: db.members[idx] });
});

// 9. GET /api/users & POST /api/users/promote
app.get('/api/users', (req, res) => {
  const db = loadDbStore();
  cleanStaleSessions(db);
  res.json({
    success: true,
    count: db.users.length,
    data: db.users
  });
});

app.post('/api/users/promote', (req, res) => {
  const { userId, newRole, changedBy } = req.body;
  const db = loadDbStore();

  const userIdx = db.users.findIndex(u => u.id === userId);
  if (userIdx === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const oldRole = db.users[userIdx].role;
  db.users[userIdx].role = newRole;

  db.audit_logs.unshift({
    id: `LOG_${String(db.audit_logs.length + 1).padStart(3, '0')}`,
    action_type: `Role Change (${newRole})`,
    user_modified: `${db.users[userIdx].mobile_number} (${db.users[userIdx].full_name})`,
    old_role: oldRole,
    new_role: newRole,
    changed_by: changedBy || 'Super Admin',
    date_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  saveDbStore(db);
  res.json({ success: true, user: db.users[userIdx] });
});

// 10. GET /api/audit-logs
app.get('/api/audit-logs', (req, res) => {
  const db = loadDbStore();
  res.json({
    success: true,
    count: db.audit_logs.length,
    data: db.audit_logs
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🌐 Family-GenApp REST API Database Server running on http://localhost:${PORT}`);
  });
}

export default app;
