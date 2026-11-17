import { useMemo, useState } from 'react';
import {
  linkWithPopup,
  reauthenticateWithPopup,
  sendEmailVerification,
  User,
} from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  MailCheck,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  appleProvider,
  facebookProvider,
  githubProvider,
  googleProvider,
  yahooProvider,
} from '../lib/firebase';
import {
  buildPermanentVerificationId,
  buildWhatsAppOrderProofUrl,
  formatLoginWayLabel,
  WHATSAPP_PROOF_DISPLAY,
} from '../lib/mezoneDb';
import { getLocalMailOtpVerifiedAt } from '../lib/otpApi';
import {
  OrderProofRecord,
  UserProfile,
} from '../types/mezone';
import { GmailOtpSection } from './GmailOtpSection';

interface VerificationCenterSectionProps {
  user: User;
  isVerified: boolean;
  profile: UserProfile | null;
  myOrderProofs: OrderProofRecord[];
  onRefreshVerification: () => Promise<void>;
  onFlashStatus: (message: string) => void;
  onGoToPersonalInfo: () => void;
}

export function VerificationCenterSection({
  user,
  isVerified,
  profile,
  myOrderProofs,
  onRefreshVerification,
  onFlashStatus,
  onGoToPersonalInfo,
}: VerificationCenterSectionProps) {
  const [sendingMail, setSendingMail] = useState(false);
  const [refreshingMail, setRefreshingMail] = useState(false);
  const [copiedVerificationId, setCopiedVerificationId] = useState(false);

  const [socialBusy, setSocialBusy] = useState<
    'google' | 'apple' | 'facebook' | 'github' | 'yahoo' | null
  >(null);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);
  const [confirmedSocialProviders, setConfirmedSocialProviders] = useState<Record<string, boolean>>(
    {}
  );
  const [sessionOtpVerifiedAt, setSessionOtpVerifiedAt] = useState<string | null>(() =>
    getLocalMailOtpVerifiedAt(user.uid)
  );
  const mailOtpVerified = Boolean(profile?.mailOtpVerified || sessionOtpVerifiedAt);

  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [previewProof, setPreviewProof] = useState<OrderProofRecord | null>(null);

  const googleProviderInfo = user.providerData.find((p) => p.providerId === 'google.com');
  const appleProviderInfo = user.providerData.find((p) => p.providerId === 'apple.com');
  const facebookProviderInfo = user.providerData.find((p) => p.providerId === 'facebook.com');
  const githubProviderInfo = user.providerData.find((p) => p.providerId === 'github.com');
  const yahooProviderInfo = user.providerData.find((p) => p.providerId === 'yahoo.com');
  const passwordProviderInfo = user.providerData.find((p) => p.providerId === 'password');

  const isProfileComplete = Boolean(
    profile?.displayName?.trim() &&
      profile?.phone?.trim() &&
      profile.phone.trim().length >= 7 &&
      profile?.countryName?.trim() &&
      profile?.birthDate?.trim() &&
      profile?.gender?.trim()
  );

  const approvedOrdersCount = useMemo(
    () => myOrderProofs.filter((p) => p.status === 'approved').length,
    [myOrderProofs]
  );
  const pendingOrdersCount = useMemo(
    () => myOrderProofs.filter((p) => p.status === 'pending').length,
    [myOrderProofs]
  );
  const rejectedOrdersCount = useMemo(
    () => myOrderProofs.filter((p) => p.status === 'rejected').length,
    [myOrderProofs]
  );

  const filteredOrderProofs = useMemo(() => {
    if (orderFilter === 'all') return myOrderProofs;
    return myOrderProofs.filter((p) => p.status === orderFilter);
  }, [myOrderProofs, orderFilter]);

  const handleSendMailVerification = async () => {
    setSendingMail(true);
    try {
      await sendEmailVerification(user);
      onFlashStatus(`Verification mail sent to ${user.email}. Check your inbox or spam folder.`);
    } catch {
      onFlashStatus('Verification email was sent recently. Please check your inbox and try again.');
    } finally {
      setSendingMail(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshingMail(true);
    try {
      await onRefreshVerification();
    } finally {
      setRefreshingMail(false);
    }
  };

  const handleSocialAction = async (
    target: 'google' | 'apple' | 'facebook' | 'github' | 'yahoo',
    mode: 'connect' | 'confirm'
  ) => {
    setSocialMessage(null);
    setSocialBusy(target);
    const providerMap = {
      google: { provider: googleProvider, label: 'Google' },
      apple: { provider: appleProvider, label: 'Apple' },
      facebook: { provider: facebookProvider, label: 'Facebook' },
      github: { provider: githubProvider, label: 'GitHub' },
      yahoo: { provider: yahooProvider, label: 'Yahoo' },
    } as const;
    const { provider, label: providerLabel } = providerMap[target];

    try {
      if (mode === 'connect') {
        await linkWithPopup(user, provider);
        setConfirmedSocialProviders((prev) => ({ ...prev, [target]: true }));
        setSocialMessage(
          `${providerLabel} Social Login connected and mail ownership confirmed.`
        );
      } else {
        await reauthenticateWithPopup(user, provider);
        setConfirmedSocialProviders((prev) => ({ ...prev, [target]: true }));
        setSocialMessage(
          `${providerLabel} Social Login mail verified & re-confirmed (${user.email}).`
        );
      }
      await onRefreshVerification();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/credential-already-in-use') {
        setSocialMessage(
          `That ${providerLabel} account is already linked to another Mezone account.`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setSocialMessage(
          `Enable ${providerLabel} Sign-In in Firebase Console Authentication Providers to link or confirm ${providerLabel}.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setSocialMessage(`${providerLabel} verification popup was closed before completing.`);
      } else {
        setSocialMessage(
          err instanceof Error
            ? err.message
            : `Unable to confirm ${providerLabel} social login mail.`
        );
      }
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-[#C2410C] mb-1">
          Identity, Mail & Purchase History
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
          Verification Center
        </h1>
        <p className="text-sm text-[#57534E] mt-1">
          Manage your Mezone Account Verification, Mail Verification, Social Login Confirm Mail
          Verification, and complete Order Verification History.
        </p>
      </div>

      {/* 1. ACCOUNT VERIFICATION & MAIL VERIFY (NEW ACCOUNT) */}
      <section className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10">
          <div className="flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[#111113]">
                Account Status &amp; Mail Verify (New Account)
              </h2>
              <p className="text-xs text-[#57534E] mt-0.5">
                Mail Verify is used for New Accounts (with Gmail API Green Tick). Existing Login
                Accounts do not need Mail Verification to shop or access Wallet &amp; Invite Program.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                isVerified || mailOtpVerified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-[#FAF9F6] border-black/15 text-[#111113]'
              }`}
            >
              {isVerified || mailOtpVerified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mail Verified</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#EA580C]" />
                  <span>Login Account Active</span>
                </>
              )}
            </span>

            {mailOtpVerified && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Green Tick Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Profile With Green Tick Summary */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#EFECE5] border border-black/10 flex items-center justify-center">
                {profile?.photoUrl || user.photoURL ? (
                  <img
                    src={profile?.photoUrl || user.photoURL || ''}
                    alt={profile?.displayName || user.displayName || 'Profile'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-sm font-bold text-[#111113]">
                    {(profile?.displayName || user.displayName || user.email || 'MZ')
                      .trim()
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <span
                title="Green Tick Verified Profile"
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white border-2 border-white flex items-center justify-center"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-[#111113] truncate">
                  {profile?.displayName || user.displayName || 'Mezone Shopper'}
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Profile · Green Tick</span>
                </span>
              </div>
              <p className="text-xs text-[#57534E] truncate mt-0.5">
                {profile?.countryName ? `${profile.countryName} · ` : ''}
                {profile?.phone || 'Add Cell Number in Personal Information'} ·{' '}
                {formatLoginWayLabel(user)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <p className="text-[11px] font-medium text-[#57534E]">Profile Verification</p>
            <p className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isProfileComplete ? 'Complete Profile · Green Tick' : 'Profile Active · Green Tick'}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-1">
            <p className="text-[11px] font-medium text-[#57534E]">Mail</p>
            <p className="text-xs font-mono font-semibold text-[#111113] break-all">
              {user.email || 'No email'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  isVerified || mailOtpVerified ? 'text-emerald-700' : 'text-[#57534E]'
                }`}
              >
                {(isVerified || mailOtpVerified) && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>
                  {isVerified || mailOtpVerified
                    ? 'Mail Verified (Green Tick)'
                    : 'Login Account (No Verification Needed)'}
                </span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-[#57534E]">Verification ID (Permanent)</p>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Permanent
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-semibold text-[#111113] truncate">
                {profile?.verificationId || buildPermanentVerificationId(user.uid)}
              </p>
              <button
                type="button"
                onClick={async () => {
                  const vid = profile?.verificationId || buildPermanentVerificationId(user.uid);
                  try {
                    await navigator.clipboard.writeText(vid);
                    setCopiedVerificationId(true);
                    window.setTimeout(() => setCopiedVerificationId(false), 1800);
                    onFlashStatus(`Permanent Verification ID copied (${vid}).`);
                  } catch {
                    // ignore clipboard failure
                  }
                }}
                className="text-xs text-[#57534E] hover:text-[#111113] shrink-0 cursor-pointer"
                aria-label="Copy Permanent Verification ID"
              >
                {copiedVerificationId ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#57534E] font-mono truncate">UID: {user.uid}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-1">
            <p className="text-[11px] font-medium text-[#57534E]">Profile With Green Tick</p>
            <p className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{isProfileComplete ? 'Verified Profile' : 'Active Profile'}</span>
            </p>
            <p className="text-[11px] text-[#57534E]">
              {profile?.phone ? `Cell: ${profile.phone}` : 'Add Cell Number (no leading 0)'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-1">
            <p className="text-[11px] font-medium text-[#57534E]">Referral Invite ID</p>
            <p className="text-xs font-mono font-semibold text-[#111113]">
              {profile?.inviteCode || 'Generating...'}
            </p>
            <p className="text-[11px] text-[#57534E]">
              Ready to invite users (500 PKR)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isVerified && (
            <button
              type="button"
              disabled={sendingMail}
              onClick={handleSendMailVerification}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
            >
              <MailCheck className="w-4 h-4" />
              <span>{sendingMail ? 'Sending...' : 'Send Mail Verify'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={refreshingMail}
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 h-10 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingMail ? 'animate-spin' : ''}`} />
            <span>{refreshingMail ? 'Checking...' : 'Refresh Verification Status'}</span>
          </button>

          <button
            type="button"
            onClick={onGoToPersonalInfo}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#FAF9F6] cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-[#EA580C]" />
            <span>Update Personal Information</span>
          </button>
        </div>
      </section>

      {/* 1B. MAIL OTP VERIFICATION (GMAIL API) */}
      <GmailOtpSection
        user={user}
        mailOtpVerified={mailOtpVerified}
        mailOtpVerifiedAt={profile?.mailOtpVerifiedAt || sessionOtpVerifiedAt || ''}
        onFlashStatus={onFlashStatus}
        onOtpVerified={async (_email, verifiedAt) => {
          setSessionOtpVerifiedAt(verifiedAt);
          await onRefreshVerification();
        }}
      />

      {/* 2. SOCIAL LOGIN CONFIRM MAIL VERIFICATION */}
      <section className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/10">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[#111113]">
                Social Login Confirm Mail Verification
              </h2>
              <p className="text-xs text-[#57534E] mt-0.5">
                Connect or re-confirm your Google or Apple social login email address directly with
                Firebase Auth.
              </p>
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
        </div>

        {socialMessage && (
          <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
            {socialMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Google Social Login Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">
                  Google Login <span className="text-[10px] font-bold text-emerald-700">(Recommend)</span>
                </p>
                <span
                  className={`text-[11px] font-semibold ${
                    googleProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {googleProviderInfo ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {googleProviderInfo?.email || 'No Google social mail linked'}
              </p>
              {googleProviderInfo && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {confirmedSocialProviders.google || isVerified
                    ? 'Social Mail Confirmed'
                    : 'Confirm Social Mail'}
                </p>
              )}
            </div>

            {googleProviderInfo ? (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('google', 'confirm')}
                className="h-9 px-3.5 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'google' ? 'Confirming...' : 'Confirm Google Mail'}
              </button>
            ) : (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('google', 'connect')}
                className="h-9 px-3.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'google' ? 'Connecting...' : 'Connect & Confirm Google'}
              </button>
            )}
          </div>

          {/* Apple Social Login Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">Apple Login</p>
                <span
                  className={`text-[11px] font-semibold ${
                    appleProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {appleProviderInfo ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {appleProviderInfo?.email || 'No Apple ID mail linked'}
              </p>
              {appleProviderInfo && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {confirmedSocialProviders.apple || isVerified
                    ? 'Social Mail Confirmed'
                    : 'Confirm Social Mail'}
                </p>
              )}
            </div>

            {appleProviderInfo ? (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('apple', 'confirm')}
                className="h-9 px-3.5 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'apple' ? 'Confirming...' : 'Confirm Apple Mail'}
              </button>
            ) : (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('apple', 'connect')}
                className="h-9 px-3.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'apple' ? 'Connecting...' : 'Connect & Confirm Apple'}
              </button>
            )}
          </div>

          {/* Facebook Social Login Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">
                  Facebook Login <span className="text-[10px] font-bold text-[#C2410C]">(Hot)</span>
                </p>
                <span
                  className={`text-[11px] font-semibold ${
                    facebookProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {facebookProviderInfo ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {facebookProviderInfo?.email || 'No Facebook mail linked'}
              </p>
              {facebookProviderInfo && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {confirmedSocialProviders.facebook || isVerified
                    ? 'Social Mail Confirmed'
                    : 'Confirm Social Mail'}
                </p>
              )}
            </div>

            {facebookProviderInfo ? (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('facebook', 'confirm')}
                className="h-9 px-3.5 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'facebook' ? 'Confirming...' : 'Confirm Facebook Mail'}
              </button>
            ) : (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('facebook', 'connect')}
                className="h-9 px-3.5 bg-[#1877F2] text-white text-xs font-semibold rounded-lg hover:bg-[#166FE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'facebook' ? 'Connecting...' : 'Connect & Confirm Facebook'}
              </button>
            )}
          </div>

          {/* GitHub Social Login Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">Github Login</p>
                <span
                  className={`text-[11px] font-semibold ${
                    githubProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {githubProviderInfo ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {githubProviderInfo?.email || 'No GitHub mail linked'}
              </p>
              {githubProviderInfo && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {confirmedSocialProviders.github || isVerified
                    ? 'Social Mail Confirmed'
                    : 'Confirm Social Mail'}
                </p>
              )}
            </div>

            {githubProviderInfo ? (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('github', 'confirm')}
                className="h-9 px-3.5 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'github' ? 'Confirming...' : 'Confirm GitHub Mail'}
              </button>
            ) : (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('github', 'connect')}
                className="h-9 px-3.5 bg-[#24292F] text-white text-xs font-semibold rounded-lg hover:bg-[#1B1F23] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'github' ? 'Connecting...' : 'Connect & Confirm GitHub'}
              </button>
            )}
          </div>

          {/* Yahoo Social Login Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">Yahoo Login</p>
                <span
                  className={`text-[11px] font-semibold ${
                    yahooProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {yahooProviderInfo ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {yahooProviderInfo?.email || 'No Yahoo mail linked'}
              </p>
              {yahooProviderInfo && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  {confirmedSocialProviders.yahoo || isVerified
                    ? 'Social Mail Confirmed'
                    : 'Confirm Social Mail'}
                </p>
              )}
            </div>

            {yahooProviderInfo ? (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('yahoo', 'confirm')}
                className="h-9 px-3.5 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'yahoo' ? 'Confirming...' : 'Confirm Yahoo Mail'}
              </button>
            ) : (
              <button
                type="button"
                disabled={socialBusy !== null}
                onClick={() => handleSocialAction('yahoo', 'connect')}
                className="h-9 px-3.5 bg-[#6001D2] text-white text-xs font-semibold rounded-lg hover:bg-[#5000B3] disabled:opacity-60 cursor-pointer"
              >
                {socialBusy === 'yahoo' ? 'Connecting...' : 'Connect & Confirm Yahoo'}
              </button>
            )}
          </div>

          {/* Email & Password Card */}
          <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#111113]">Email &amp; Password</p>
                <span
                  className={`text-[11px] font-semibold ${
                    passwordProviderInfo ? 'text-emerald-700' : 'text-[#57534E]'
                  }`}
                >
                  {passwordProviderInfo ? 'Active' : 'Not Set'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#57534E] break-all">
                {passwordProviderInfo?.email || user.email || '—'}
              </p>
              <p className="text-[11px] text-[#57534E]">
                {isVerified || mailOtpVerified
                  ? 'Mail Verify completed for this Mezone account.'
                  : 'Login Accounts are ready without Mail Verification. New Accounts use Mail Verify above.'}
              </p>
            </div>

            <span
              className={`inline-flex items-center justify-center h-9 px-3.5 rounded-lg text-xs font-semibold border ${
                isVerified || mailOtpVerified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-[#FAF9F6] border-black/15 text-[#111113]'
              }`}
            >
              {isVerified || mailOtpVerified ? 'Mail Verified' : 'Login Account Ready'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. ORDER VERIFICATION HISTORY */}
      <section className="bg-white border border-black/10 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#C2410C]">Purchase Proof Ledger</p>
            <h2 className="text-base font-semibold text-[#111113]">
              Order Verification History ({myOrderProofs.length})
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5 tabular-nums">
              {approvedOrdersCount} Approved · {pendingOrdersCount} Pending · {rejectedOrdersCount}{' '}
              Rejected · {profile?.approvedProductsCount ?? 0} Approved Product(s) Total
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFECE5] rounded-lg w-fit">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((statusKey) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setOrderFilter(statusKey)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize rounded-md transition-colors cursor-pointer ${
                  orderFilter === statusKey
                    ? 'bg-white text-[#111113] shadow-sm'
                    : 'text-[#57534E] hover:text-[#111113]'
                }`}
              >
                {statusKey}
              </button>
            ))}
          </div>
        </div>

        {filteredOrderProofs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#57534E]">
            No order proof submissions in this status filter yet.
          </div>
        ) : (
          <ul className="divide-y divide-black/10">
            {filteredOrderProofs.map((proof) => (
              <li
                key={proof.id}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {proof.proofAttachment && (
                    <button
                      type="button"
                      onClick={() => setPreviewProof(proof)}
                      className="w-16 h-16 rounded-lg overflow-hidden bg-[#FAF9F6] border border-black/10 shrink-0 cursor-pointer hover:opacity-90"
                      title="Inspect screenshot"
                    >
                      <img
                        src={proof.proofAttachment}
                        alt={`Receipt for ${proof.orderReference}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#111113]">{proof.productTitle}</p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold capitalize ${
                          proof.status === 'approved'
                            ? 'text-emerald-700'
                            : proof.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-[#C2410C]'
                        }`}
                      >
                        {proof.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {proof.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                        {proof.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                        <span>{proof.status}</span>
                      </span>
                    </div>

                    <p className="text-xs text-[#57534E] tabular-nums">
                      {proof.marketplace} · Order{' '}
                      <span className="font-mono text-[#111113]">{proof.orderReference}</span> ·{' '}
                      <span className="font-mono">{proof.quantity} item(s)</span>
                    </p>

                    <p className="text-xs text-[#57534E]">Notes: {proof.proofNotes}</p>

                    {proof.adminNote && (
                      <p className="text-xs text-[#111113]">
                        <span className="font-semibold text-[#C2410C]">Admin Note: </span>
                        {proof.adminNote}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {proof.proofAttachment && (
                    <button
                      type="button"
                      onClick={() => setPreviewProof(proof)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                    >
                      View Screenshot
                    </button>
                  )}

                  <a
                    href={buildWhatsAppOrderProofUrl({
                      userName: proof.userName,
                      userEmail: proof.userEmail,
                      marketplace: proof.marketplace,
                      productTitle: proof.productTitle,
                      orderReference: proof.orderReference,
                      quantity: proof.quantity,
                      proofNotes: proof.proofNotes,
                      proofId: proof.id,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534]"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp {WHATSAPP_PROOF_DISPLAY}</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewProof && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setPreviewProof(null)}
        >
          <div
            className="bg-white border border-black/10 rounded-xl max-w-xl w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#57534E]">
                  Order {previewProof.orderReference} · {previewProof.marketplace}
                </p>
                <h3 className="text-sm font-semibold text-[#111113]">
                  {previewProof.productTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                aria-label="Close receipt modal"
                className="p-1 text-[#57534E] hover:text-[#111113] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#FAF9F6] border border-black/10 rounded-lg overflow-hidden flex items-center justify-center max-h-[65vh]">
              <img
                src={previewProof.proofAttachment}
                alt={`Screenshot for ${previewProof.orderReference}`}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
