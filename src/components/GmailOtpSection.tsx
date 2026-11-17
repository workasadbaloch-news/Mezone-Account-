import { FormEvent, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { markUserMailOtpVerified } from '../lib/mezoneDb';
import {
  getLocalMailOtpVerifiedAt,
  requestMailOtp,
  verifyMailOtpCode,
} from '../lib/otpApi';

interface GmailOtpSectionProps {
  user: User;
  mailOtpVerified?: boolean;
  mailOtpVerifiedAt?: string;
  onFlashStatus: (message: string) => void;
  onOtpVerified?: (verifiedEmail: string, verifiedAtIso: string) => void | Promise<void>;
}

interface ActiveOtpMeta {
  toEmail: string;
  purpose: string;
  messageId?: string;
  expiresAtMs: number;
}

export function GmailOtpSection({
  user,
  mailOtpVerified = false,
  mailOtpVerifiedAt = '',
  onFlashStatus,
  onOtpVerified,
}: GmailOtpSectionProps) {
  const [purpose, setPurpose] = useState('New Account Mail Verify');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [activeChallenge, setActiveChallenge] = useState<ActiveOtpMeta | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [localVerifiedAt, setLocalVerifiedAt] = useState<string | null>(() =>
    getLocalMailOtpVerifiedAt(user.uid)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setLocalVerifiedAt(getLocalMailOtpVerifiedAt(user.uid));
  }, [user.uid]);

  useEffect(() => {
    if (!activeChallenge) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeChallenge]);

  const effectiveVerified = Boolean(mailOtpVerified || localVerifiedAt);
  const effectiveVerifiedAt = mailOtpVerifiedAt || localVerifiedAt || '';

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      setErrorMsg('Please sign into your Mezone account with an email address first.');
      return;
    }

    setErrorMsg(null);
    setSendingOtp(true);
    try {
      const res = await requestMailOtp(user, purpose);
      if (!res.ok) {
        setErrorMsg(res.error || 'Unable to send Mail Verify code via Gmail API.');
        return;
      }

      const ttlMs = (res.expiresInSeconds || 600) * 1000;
      setActiveChallenge({
        toEmail: res.toEmail || user.email,
        purpose,
        messageId: res.messageId,
        expiresAtMs: Date.now() + ttlMs,
      });
      setOtpInput('');
      onFlashStatus(
        `6-digit Mail Verify code sent via Mezone Gmail API to ${res.toEmail || user.email}.`
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!activeChallenge) {
      setErrorMsg('Click Send Mail Verify first to receive a 6-digit verification code.');
      return;
    }
    if (Date.now() > activeChallenge.expiresAtMs) {
      setErrorMsg('This Mail Verify code has expired. Please request a new code.');
      return;
    }

    const cleanedCode = otpInput.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanedCode)) {
      setErrorMsg('Enter the 6-digit numeric Mail Verify code from your email.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await verifyMailOtpCode(user, cleanedCode);
      if (!res.ok) {
        setErrorMsg(res.error || 'Incorrect Mail Verify code. Please check your inbox.');
        return;
      }

      const verifiedIso = res.verifiedAt || new Date().toISOString();
      setLocalVerifiedAt(verifiedIso);
      setActiveChallenge(null);
      setOtpInput('');

      await markUserMailOtpVerified(user.uid, verifiedIso);
      onFlashStatus(
        `Mail Verify completed successfully for ${res.verifiedEmail || user.email}!`
      );
      if (onOtpVerified) {
        await onOtpVerified(res.verifiedEmail || user.email || '', verifiedIso);
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const secondsLeft = activeChallenge
    ? Math.max(0, Math.floor((activeChallenge.expiresAtMs - nowMs) / 1000))
    : 0;
  const minsLeft = Math.floor(secondsLeft / 60);
  const remSecs = secondsLeft % 60;

  return (
    <section className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-[#111113]">
              Mail Verify (New Account · Gmail API)
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Used for New Account Mail Verify via Mezone&apos;s Gmail API server (Green Tick on
              completion). Existing Login Accounts do not need Mail Verification.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shrink-0 ${
            effectiveVerified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-[#FFF7ED] border-[#EA580C]/30 text-[#C2410C]'
          }`}
        >
          {effectiveVerified ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Mail Verified</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span>Mail Verify Ready (New Account)</span>
            </>
          )}
        </span>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412] leading-relaxed"
        >
          {errorMsg}
        </div>
      )}

      {effectiveVerified && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-emerald-700/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">
                Mail Verify Complete · Green Tick Active
              </p>
              <p className="text-[11px] text-emerald-800">
                Account mail <span className="font-mono font-semibold">{user.email}</span>{' '}
                completed 6-digit Mail Verify
                {effectiveVerifiedAt
                  ? ` on ${new Date(effectiveVerifiedAt).toLocaleDateString()}`
                  : ''}
                .
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-700 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Mail Verified</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSendOtp}
          className="lg:col-span-6 p-5 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-4"
        >
          <div>
            <p className="text-xs font-semibold text-[#111113]">
              Step 1 · Send Mail Verify Code (New Account)
            </p>
            <p className="text-[11px] text-[#57534E] mt-0.5">
              Mail Verify code is dispatched strictly to your new account email via Gmail API.
            </p>
          </div>

          <div>
            <label
              htmlFor="gmail-otp-account-mail"
              className="block text-xs font-medium text-[#111113] mb-1.5"
            >
              Account Email
            </label>
            <input
              id="gmail-otp-account-mail"
              type="email"
              disabled
              value={user.email || ''}
              className="w-full h-10 px-3 text-sm font-mono bg-[#EFECE5] border border-black/10 rounded-lg text-[#57534E]"
            />
          </div>

          <div>
            <label
              htmlFor="gmail-otp-purpose"
              className="block text-xs font-medium text-[#111113] mb-1.5"
            >
              Verification Purpose
            </label>
            <select
              id="gmail-otp-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-black/15 rounded-lg text-[#111113]"
            >
              <option value="New Account Mail Verify">
                New Account Mail Verify
              </option>
              <option value="Withdrawal Security Check">
                Withdrawal Security Check
              </option>
              <option value="Social Login Mail Confirmation">
                Social Login Mail Confirmation
              </option>
            </select>
          </div>

          <button
            type="submit"
            disabled={sendingOtp || !user.email}
            className="w-full h-10 px-4 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {sendingOtp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {sendingOtp
                ? 'Sending Mail Verify Code...'
                : activeChallenge
                  ? 'Resend Mail Verify'
                  : 'Send Mail Verify'}
            </span>
          </button>
        </form>

        <form
          onSubmit={handleVerifyOtp}
          className="lg:col-span-6 p-5 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#111113]">
                  Step 2 · Confirm 6-Digit Mail Verify Code
                </p>
                <p className="text-[11px] text-[#57534E] mt-0.5">
                  {activeChallenge
                    ? `Sent to ${activeChallenge.toEmail}`
                    : effectiveVerified
                      ? 'Your account email has completed Mail Verify.'
                      : 'Send a Mail Verify code first, then enter the 6-digit code from your inbox.'}
                </p>
              </div>
              {activeChallenge && (
                <span className="text-[11px] font-mono font-semibold text-[#C2410C] tabular-nums shrink-0">
                  {secondsLeft > 0
                    ? `${String(minsLeft).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`
                    : 'Expired'}
                </span>
              )}
            </div>

            {activeChallenge?.messageId && (
              <p className="text-[11px] font-mono text-[#57534E] bg-white border border-black/10 rounded-lg px-3 py-2 break-all">
                Gmail API Message ID: {activeChallenge.messageId}
              </p>
            )}

            <div>
              <label
                htmlFor="gmail-otp-code-input"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                6-Digit Code from Mail
              </label>
              <input
                id="gmail-otp-code-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                disabled={!activeChallenge || verifyingOtp}
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="w-full h-11 px-3 text-lg font-mono tracking-[0.35em] text-center bg-white border border-black/15 rounded-lg text-[#111113] disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!activeChallenge || otpInput.length < 6 || verifyingOtp}
            className="w-full h-10 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {verifyingOtp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            <span>{verifyingOtp ? 'Verifying...' : 'Confirm Mail Verify'}</span>
          </button>
        </form>
      </div>
    </section>
  );
}
