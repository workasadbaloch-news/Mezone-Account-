import { User } from 'firebase/auth';

export interface SendMailOtpResponse {
  ok: boolean;
  configured?: boolean;
  toEmail?: string;
  messageId?: string;
  expiresInSeconds?: number;
  sentAtIso?: string;
  error?: string;
}

export interface VerifyMailOtpResponse {
  ok: boolean;
  verifiedEmail?: string;
  verifiedAt?: string;
  error?: string;
}

const sessionVerifiedMap = new Map<string, string>();
const OTP_PENDING_STORAGE_PREFIX = 'mezone_pending_mail_otp_';

export function getLocalMailOtpVerifiedAt(uid: string): string | null {
  const mem = sessionVerifiedMap.get(uid);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(`${OTP_PENDING_STORAGE_PREFIX}${uid}`);
    return raw || null;
  } catch {
    return null;
  }
}

export function setLocalMailOtpVerifiedAt(uid: string, verifiedAtIso: string): void {
  sessionVerifiedMap.set(uid, verifiedAtIso);
  try {
    localStorage.setItem(`${OTP_PENDING_STORAGE_PREFIX}${uid}`, verifiedAtIso);
  } catch {
    // ignore storage errors
  }
}

export function clearLocalMailOtpVerifiedAt(uid: string): void {
  sessionVerifiedMap.delete(uid);
  try {
    localStorage.removeItem(`${OTP_PENDING_STORAGE_PREFIX}${uid}`);
  } catch {
    // ignore storage errors
  }
}

export async function requestMailOtp(
  user: User | null,
  purpose = 'New Account Mail Verify'
): Promise<SendMailOtpResponse> {
  if (!user) {
    return {
      ok: false,
      error: 'Please sign into your Mezone account to send the Mail Verify code.',
    };
  }

  const idToken = await user.getIdToken();
  const res = await fetch('/api/otp/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ purpose }),
  });

  const data = (await res.json()) as SendMailOtpResponse;
  if (!res.ok) {
    return {
      ok: false,
      configured: data.configured,
      error: data.error || 'Unable to send Mail Verify code.',
    };
  }
  return data;
}

export async function verifyMailOtpCode(
  user: User | null,
  otpCode: string
): Promise<VerifyMailOtpResponse> {
  if (!user) {
    return {
      ok: false,
      error: 'Please sign into your Mezone account before completing Mail Verify.',
    };
  }

  const idToken = await user.getIdToken();
  const res = await fetch('/api/otp/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ otpCode }),
  });

  const data = (await res.json()) as VerifyMailOtpResponse;
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || 'Unable to verify Mail Verify code.',
    };
  }

  const verifiedAt = data.verifiedAt || new Date().toISOString();
  setLocalMailOtpVerifiedAt(user.uid, verifiedAt);
  return { ...data, verifiedAt };
}
