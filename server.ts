import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface FirebaseConfigFile {
  apiKey?: string;
  projectId?: string;
}

function loadFirebaseWebApiKey(): string {
  try {
    const raw = fs.readFileSync(
      path.resolve(__dirname, 'firebase-applet-config.json'),
      'utf8'
    );
    const parsed = JSON.parse(raw) as FirebaseConfigFile;
    return parsed.apiKey || '';
  } catch {
    return '';
  }
}

const FIREBASE_WEB_API_KEY = loadFirebaseWebApiKey();

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

interface OtpChallengeRecord {
  uid: string;
  email: string;
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const otpChallenges = new Map<string, OtpChallengeRecord>();

function hashOtp(uid: string, email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${uid}:${email.toLowerCase()}:${code}`)
    .digest('hex');
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

async function verifyFirebaseBearerToken(
  req: Request
): Promise<VerifiedFirebaseUser> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_REQUIRED');
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('AUTH_REQUIRED');
  }
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error('FIREBASE_CONFIG_MISSING');
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      FIREBASE_WEB_API_KEY
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!lookupRes.ok) {
    throw new Error('AUTH_INVALID');
  }

  const lookupData = (await lookupRes.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      displayName?: string;
      emailVerified?: boolean;
    }>;
  };

  const user = lookupData.users?.[0];
  if (!user?.localId || !user?.email) {
    throw new Error('AUTH_INVALID');
  }

  return {
    uid: user.localId,
    email: user.email.trim(),
    displayName: (user.displayName || '').trim(),
    emailVerified: Boolean(user.emailVerified),
  };
}

function hasServerGmailCredentials(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID?.trim() &&
      process.env.GMAIL_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_REFRESH_TOKEN?.trim()
  );
}

async function fetchServerGmailAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim() || '';
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim() || '';

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_NOT_CONFIGURED');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Gmail OAuth token refresh failed (${tokenRes.status}): ${errText.slice(0, 180)}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error('Gmail API did not return an access token.');
  }

  return tokenJson.access_token;
}

async function dispatchGmailOtpMessage(params: {
  toEmail: string;
  recipientName: string;
  otpCode: string;
  purpose: string;
}): Promise<{ messageId: string }> {
  const accessToken = await fetchServerGmailAccessToken();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL?.trim() || '';

  const subject = `Mezone Mail Verify Code: ${params.otpCode} (${params.purpose})`;
  const textBody = [
    `Assalam-o-Alaikum ${params.recipientName || 'Mezone Member'},`,
    '',
    `Your 6-digit Mezone Mail Verify Code is: ${params.otpCode}`,
    '',
    `Purpose: ${params.purpose}`,
    `Recipient Account: ${params.toEmail}`,
    'This code expires in 10 minutes. Enter it on Mezone to complete your New Account Mail Verify.',
    '',
    'If you did not request this Mail Verify code, you can ignore this email.',
    '',
    '— Mezone Support',
  ].join('\r\n');

  const headers = [
    senderEmail ? `From: Mezone Verification <${senderEmail}>` : null,
    `To: ${params.toEmail}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ].filter(Boolean);

  const rawMime = `${headers.join('\r\n')}\r\n\r\n${textBody}`;
  const raw = encodeBase64Url(rawMime);

  const sendRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!sendRes.ok) {
    const errBody = await sendRes.text();
    throw new Error(`Gmail send failed (${sendRes.status}): ${errBody.slice(0, 200)}`);
  }

  const sent = (await sendRes.json()) as { id?: string };
  return { messageId: sent.id || '' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/otp/status', async (req: Request, res: Response) => {
    try {
      const user = await verifyFirebaseBearerToken(req);
      res.json({
        ok: true,
        configured: hasServerGmailCredentials(),
        email: user.email,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID') {
        res.status(401).json({
          ok: false,
          error: 'Account sign-in required before checking Mail Verify status.',
        });
        return;
      }
      res.status(500).json({ ok: false, error: 'Unable to check Mail Verify status.' });
    }
  });

  app.post('/api/otp/send', async (req: Request, res: Response) => {
    try {
      const user = await verifyFirebaseBearerToken(req);
      const rawPurpose =
        typeof req.body?.purpose === 'string' && req.body.purpose.trim()
          ? req.body.purpose.trim().slice(0, 80)
          : 'New Account Mail Verify';

      if (!hasServerGmailCredentials()) {
        res.status(503).json({
          ok: false,
          configured: false,
          error:
            'Gmail API server credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) are not configured in server secrets yet.',
        });
        return;
      }

      const existing = otpChallenges.get(user.uid);
      const now = Date.now();
      if (existing && now - existing.lastSentAt < 15_000) {
        const waitSec = Math.ceil((15_000 - (now - existing.lastSentAt)) / 1000);
        res.status(429).json({
          ok: false,
          error: `Please wait ${waitSec}s before requesting another Mail Verify code.`,
        });
        return;
      }

      const otpCode = String(crypto.randomInt(100000, 999999));
      const { messageId } = await dispatchGmailOtpMessage({
        toEmail: user.email,
        recipientName: user.displayName || user.email.split('@')[0] || 'Mezone Member',
        otpCode,
        purpose: rawPurpose,
      });

      const expiresAt = now + 10 * 60 * 1000;
      otpChallenges.set(user.uid, {
        uid: user.uid,
        email: user.email,
        codeHash: hashOtp(user.uid, user.email, otpCode),
        expiresAt,
        lastSentAt: now,
        attempts: 0,
      });

      res.json({
        ok: true,
        configured: true,
        toEmail: user.email,
        messageId,
        expiresInSeconds: 600,
        sentAtIso: new Date(now).toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send Mail Verify code.';
      if (msg === 'AUTH_REQUIRED' || msg === 'AUTH_INVALID') {
        res.status(401).json({
          ok: false,
          error: 'Please sign into your Mezone account to receive a Mail Verify code.',
        });
        return;
      }
      if (msg === 'GMAIL_NOT_CONFIGURED') {
        res.status(503).json({
          ok: false,
          configured: false,
          error:
            'Gmail API server credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) are not configured yet.',
        });
        return;
      }
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/otp/verify', async (req: Request, res: Response) => {
    try {
      const user = await verifyFirebaseBearerToken(req);
      const otpCode =
        typeof req.body?.otpCode === 'string'
          ? req.body.otpCode.trim().replace(/\s+/g, '')
          : '';

      if (!/^\d{6}$/.test(otpCode)) {
        res.status(400).json({
          ok: false,
          error: 'Enter the 6-digit numeric Mail Verify code sent to your email.',
        });
        return;
      }

      const challenge = otpChallenges.get(user.uid);
      if (!challenge) {
        res.status(400).json({
          ok: false,
          error: 'No active Mail Verify code found. Click Send Mail Verify first.',
        });
        return;
      }

      if (Date.now() > challenge.expiresAt) {
        otpChallenges.delete(user.uid);
        res.status(400).json({
          ok: false,
          error: 'This Mail Verify code has expired. Request a new code.',
        });
        return;
      }

      if (challenge.attempts >= 5) {
        otpChallenges.delete(user.uid);
        res.status(429).json({
          ok: false,
          error: 'Too many invalid attempts. Request a new Mail Verify code.',
        });
        return;
      }

      const expectedBuf = Buffer.from(challenge.codeHash, 'hex');
      const incomingBuf = Buffer.from(
        hashOtp(user.uid, user.email, otpCode),
        'hex'
      );

      if (
        expectedBuf.length !== incomingBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, incomingBuf)
      ) {
        challenge.attempts += 1;
        res.status(400).json({
          ok: false,
          error: 'Incorrect 6-digit Mail Verify code. Please check your inbox and try again.',
        });
        return;
      }

      otpChallenges.delete(user.uid);
      res.json({
        ok: true,
        verifiedEmail: user.email,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete Mail Verify.';
      if (msg === 'AUTH_REQUIRED' || msg === 'AUTH_INVALID') {
        res.status(401).json({
          ok: false,
          error: 'Please sign into your Mezone account to complete Mail Verify.',
        });
        return;
      }
      res.status(500).json({ ok: false, error: msg });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mezone server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
