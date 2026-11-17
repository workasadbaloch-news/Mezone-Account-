import { FormEvent, useEffect, useRef, useState } from 'react';
import { sendEmailVerification, signOut, User } from 'firebase/auth';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  LocateFixed,
  LogOut,
  MailCheck,
  Send,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  COUNTRY_NAME_OPTIONS,
  COUNTRY_PHONE_OPTIONS,
  detectUserCountryFromBrowserLocation,
  ensureUserProfile,
  formatLoginWayLabel,
  getRewardSystemStatus,
  lookupCountryOption,
  markUserMailOtpVerified,
  normalizeInternationalPhone,
  savePendingProfileDraft,
  updatePersonalInformation,
} from '../lib/mezoneDb';
import {
  getLocalMailOtpVerifiedAt,
  requestMailOtp,
  verifyMailOtpCode,
} from '../lib/otpApi';
import { BannerAdSlot } from '../lib/bannerAds';
import { ThemeToggleButton } from '../lib/theme';
import { GenderOption } from '../types/mezone';

interface CompleteProfilePageProps {
  user: User;
  onProfileCompleted: () => void;
  onSkipToThankYou: () => void;
}

export function CompleteProfilePage({
  user,
  onProfileCompleted,
  onSkipToThankYou,
}: CompleteProfilePageProps) {
  const [displayName, setDisplayName] = useState(
    user.displayName || user.email?.split('@')[0] || ''
  );
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<GenderOption>('');
  const [countryName, setCountryName] = useState('Pakistan');
  const [phoneCode, setPhoneCode] = useState('+92');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [region, setRegion] = useState('Pakistan (PKR / USD)');
  const [address, setAddress] = useState('');

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mailVerified, setMailVerified] = useState(user.emailVerified);
  const [verificationNote, setVerificationNote] = useState<string | null>(null);

  const [otpVerifiedAt, setOtpVerifiedAt] = useState<string | null>(() =>
    getLocalMailOtpVerifiedAt(user.uid)
  );
  const [otpStatusMsg, setOtpStatusMsg] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const autoOtpSentRef = useRef(false);

  const dispatchNewAccountOtp = async () => {
    if (!user.email) return;
    setOtpSending(true);
    try {
      const res = await requestMailOtp(user, 'New Account Mail Verify');
      if (res.ok) {
        setOtpStatusMsg(
          `6-digit Mail Verify code sent via Gmail API to ${res.toEmail || user.email}. Enter it below to verify your new account.`
        );
      } else {
        setOtpStatusMsg(res.error || 'Could not dispatch Mail Verify code yet.');
      }
    } finally {
      setOtpSending(false);
    }
  };

  const runLocationDetection = async () => {
    setDetectingLocation(true);
    setLocationMessage('Requesting location access to auto-fill Address, Country & Cell Code...');
    try {
      const res = await detectUserCountryFromBrowserLocation();
      setLocationMessage(res.message);
      if (res.ok) {
        if (res.countryName) setCountryName(res.countryName);
        if (res.dialCode) setPhoneCode(res.dialCode);
        if (res.region) setRegion(res.region);
        if (res.address) setAddress(res.address);
      }
    } finally {
      setDetectingLocation(false);
    }
  };

  useEffect(() => {
    void runLocationDetection();
  }, []);

  useEffect(() => {
    if (autoOtpSentRef.current || otpVerifiedAt || !user.email) return;
    autoOtpSentRef.current = true;
    void dispatchNewAccountOtp();
  }, [user.uid, user.email]);

  const handleRefreshMailCheck = async () => {
    await user.reload();
    if (auth.currentUser?.emailVerified) {
      setMailVerified(true);
      setVerificationNote('Email verified! Your profile will sync directly to Mezone.');
    } else {
      setVerificationNote('Verification link check still pending, or use the 6-digit Mail Verify code above.');
    }
  };

  const handleVerifyAccountOtp = async () => {
    const cleaned = otpInput.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      setOtpStatusMsg('Enter the 6-digit Mail Verify code sent to your email.');
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await verifyMailOtpCode(user, cleaned);
      if (!res.ok) {
        setOtpStatusMsg(res.error || 'Invalid Mail Verify code.');
        return;
      }
      const verifiedIso = res.verifiedAt || new Date().toISOString();
      setOtpVerifiedAt(verifiedIso);
      setOtpInput('');
      setOtpStatusMsg(`Mail Verify complete for ${res.verifiedEmail || user.email}!`);
      await markUserMailOtpVerified(user.uid, verifiedIso);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanedName = displayName.trim();
    if (!cleanedName) {
      setFormError('Please enter your Name.');
      return;
    }

    const phoneCheck = normalizeInternationalPhone(phoneCode, phoneLocal);
    if (!phoneCheck.ok) {
      setFormError(phoneCheck.error || 'Enter a valid Cell Number without leading 0.');
      return;
    }

    if (!phoneCheck.formatted) {
      setFormError('Please enter your Cell Number (without leading 0) to complete your profile.');
      return;
    }

    setSaving(true);
    try {
      await user.reload();
      const verifiedNow = Boolean(auth.currentUser?.emailVerified || otpVerifiedAt);
      setMailVerified(Boolean(auth.currentUser?.emailVerified));

      if (verifiedNow) {
        await ensureUserProfile(auth.currentUser || user, cleanedName, undefined, {
          allowUnverified: true,
        });
        await updatePersonalInformation(user.uid, {
          displayName: cleanedName,
          phone: phoneCheck.formatted,
          region,
          birthDate,
          gender,
          countryName,
          address,
        });
        onProfileCompleted();
      } else {
        savePendingProfileDraft(user.uid, {
          displayName: cleanedName,
          phone: phoneCheck.formatted,
          region,
          birthDate,
          gender,
          countryName,
          address,
        });
        setFormError(
          `New Account Mail Verify is required before continuing. Complete the 6-digit Mail Verify code sent to ${user.email || 'your email'} (or verify via inbox link).`
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save profile details.');
    } finally {
      setSaving(false);
    }
  };

  const rewardStatus = getRewardSystemStatus();

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex flex-col">
      <header className="border-b border-black/10 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <span className="font-display text-xl font-bold tracking-tight text-[#111113]">
            Mezone
          </span>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#57534E] hidden sm:inline">
              Step 2 of 3 · Complete Profile &amp; Verify Mail
            </span>
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#111113] bg-white border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6">
        <div className="w-full max-w-2xl">
          <BannerAdSlot position="top" pageGroup="public" />
        </div>
        <div className="w-full max-w-2xl bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/10">
            <div>
              <p className="text-xs font-medium text-[#C2410C] mb-1">
                Account Setup · Step 2 of 3
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                Complete Your Mezone Profile
              </h1>
              <p className="text-xs sm:text-sm text-[#57534E] mt-1">
                Confirm your personal details and detect your country for faster checkout & +50 PKR
                profile verification bonus.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 p-2.5 rounded-xl bg-[#FAF9F6] border border-black/10">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-[#EFECE5] border border-black/10 flex items-center justify-center shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName || 'Profile DP'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-sm font-bold text-[#111113]">
                    {(displayName || user.email || 'MZ').trim().slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] font-semibold text-[#111113] truncate max-w-[160px]">
                  {user.email || 'Mezone Account'}
                </p>
                <p className="text-[10px] font-mono text-[#57534E]">
                  {formatLoginWayLabel(user)}
                </p>
              </div>
            </div>
          </div>

          {!rewardStatus.isActive && (
            <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/25 text-xs text-[#9A3412] flex items-center justify-between gap-3">
              <span>
                <strong>Reward Expired:</strong> Reward System starts on{' '}
                <strong>{rewardStatus.startDateLabel}</strong> ({rewardStatus.countdownLabel}).
              </span>
            </div>
          )}

          {/* Mail Verify (Auto-sent for new account) */}
          {otpVerifiedAt ? (
            <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-700/25 text-xs text-emerald-900 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mail Verify Complete for {user.email} (Green Tick Active)</span>
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#111113] flex items-center gap-1.5">
                    <MailCheck className="w-4 h-4 text-[#EA580C]" />
                    <span>New Account Mail Verify (Gmail API)</span>
                  </p>
                  <p className="text-[11px] text-[#57534E] mt-0.5">
                    {otpStatusMsg ||
                      `We dispatch a 6-digit Mail Verify code to your new account email (${user.email}).`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={otpSending}
                  onClick={() => void dispatchNewAccountOtp()}
                  className="h-8 px-3 bg-white border border-black/15 rounded-lg text-[11px] font-semibold text-[#111113] hover:bg-[#EFECE5] disabled:opacity-60 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {otpSending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3 text-[#EA580C]" />
                  )}
                  <span>{otpSending ? 'Sending...' : 'Send / Resend Mail Verify'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) =>
                    setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="flex-1 h-9 px-3 text-sm font-mono tracking-[0.25em] bg-white border border-black/15 rounded-lg text-[#111113]"
                />
                <button
                  type="button"
                  disabled={otpVerifying || otpInput.length < 6}
                  onClick={() => void handleVerifyAccountOtp()}
                  className="h-9 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {otpVerifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span>{otpVerifying ? 'Verifying...' : 'Confirm Mail Verify'}</span>
                </button>
              </div>
            </div>
          )}

          {!mailVerified && !otpVerifiedAt && (
            <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-semibold">
                  New Account Mail Verify ({user.email})
                </p>
                <p className="text-[11px]">
                  {verificationNote ||
                    'Complete the 6-digit Mail Verify code above or open the inbox link, then click I Have Verified.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await sendEmailVerification(user);
                      setVerificationNote(`Verification link resent to ${user.email}.`);
                    } catch {
                      setVerificationNote('Verification link sent recently. Check your inbox.');
                    }
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Resend Mail
                </button>
                <button
                  type="button"
                  onClick={handleRefreshMailCheck}
                  className="px-3 py-1.5 bg-[#EA580C] text-white text-[11px] font-semibold rounded-md hover:bg-[#C2410C] cursor-pointer"
                >
                  I Have Verified
                </button>
              </div>
            </div>
          )}

          {/* Location Access Detection Banner */}
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#111113] flex items-center gap-1.5">
                <LocateFixed className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Location Detection (Auto-Fill Address, Country &amp; Cell Code)</span>
              </p>
              <p className="text-[11px] text-[#57534E]">
                {locationMessage ||
                  'Allow browser location access to auto-fill your Address, Country Name and Cell Code.'}
              </p>
            </div>
            <button
              type="button"
              disabled={detectingLocation}
              onClick={runLocationDetection}
              className="h-9 px-3.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {detectingLocation ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              <span>{detectingLocation ? 'Detecting...' : 'Detect Location'}</span>
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cp-name"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="cp-name"
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                />
              </div>

              <div>
                <label
                  htmlFor="cp-uid"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Account ID (Firebase UID)
                </label>
                <input
                  id="cp-uid"
                  type="text"
                  disabled
                  value={user.uid}
                  className="w-full h-10 px-3 text-xs font-mono bg-[#EFECE5] border border-black/10 rounded-lg text-[#57534E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="cp-birth"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Birth of day
                </label>
                <input
                  id="cp-birth"
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                />
              </div>

              <div>
                <label
                  htmlFor="cp-gender"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Gender
                </label>
                <select
                  id="cp-gender"
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderOption)}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cp-country"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Country Name
                </label>
                <select
                  id="cp-country"
                  value={countryName}
                  onChange={(e) => {
                    const nextCountry = e.target.value;
                    setCountryName(nextCountry);
                    const matched = lookupCountryOption(nextCountry);
                    if (matched) {
                      setPhoneCode(matched.dialCode);
                      setRegion(matched.region);
                    }
                  }}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                >
                  {COUNTRY_NAME_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cp-phone-local"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Cell Number (Changeable Country Code · No Leading 0)
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label="Cell Number Country Code"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className="w-36 h-10 px-2.5 text-xs font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                  >
                    {COUNTRY_PHONE_OPTIONS.map((opt) => (
                      <option key={`${opt.iso2}-${opt.code}`} value={opt.code}>
                        {opt.code} ({opt.country})
                      </option>
                    ))}
                  </select>
                  <input
                    id="cp-phone-local"
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={14}
                    value={phoneLocal}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (digits.startsWith('0')) {
                        setFormError(
                          'Cell number cannot start with 0 (enter e.g. 3001234567).'
                        );
                        setPhoneLocal(digits.replace(/^0+/, ''));
                      } else {
                        setFormError(null);
                        setPhoneLocal(digits);
                      }
                    }}
                    placeholder="3001234567"
                    className="flex-1 min-w-0 h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                  />
                </div>
                <p className="text-[11px] text-[#57534E] mt-1">
                  Formatted:{' '}
                  <span className="font-mono text-[#111113]">
                    {phoneLocal ? `${phoneCode}${phoneLocal}` : `${phoneCode}...`}
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="cp-region"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Shopping Region & Currency
                </label>
                <select
                  id="cp-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                >
                  <option value="Pakistan (PKR / USD)">Pakistan (PKR / USD)</option>
                  <option value="United States (USD)">United States (USD)</option>
                  <option value="United Kingdom (GBP)">United Kingdom (GBP)</option>
                  <option value="European Union (EUR)">European Union (EUR)</option>
                  <option value="Canada (CAD)">Canada (CAD)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="cp-address"
                  className="block text-xs font-medium text-[#111113]"
                >
                  Address (Auto-Filled with Location or Editable)
                </label>
                <button
                  type="button"
                  disabled={detectingLocation}
                  onClick={runLocationDetection}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] hover:underline cursor-pointer disabled:opacity-60"
                >
                  <LocateFixed className="w-3 h-3" />
                  <span>{detectingLocation ? 'Detecting Address...' : 'Use Current Location'}</span>
                </button>
              </div>
              <textarea
                id="cp-address"
                rows={2}
                maxLength={240}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Street, Area/Sector, City, Postal Code, Country"
                className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              />
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/10">
              {mailVerified ? (
                <button
                  type="button"
                  onClick={onSkipToThankYou}
                  className="text-xs font-medium text-[#57534E] hover:text-[#111113] underline underline-offset-4 cursor-pointer"
                >
                  Skip for now
                </button>
              ) : (
                <span className="text-[11px] font-medium text-[#9A3412]">
                  Mail verification required before continuing
                </span>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 h-11 px-6 bg-[#EA580C] text-white text-sm font-semibold rounded-lg hover:bg-[#C2410C] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{saving ? 'Checking Verification...' : 'Complete Profile & Continue'}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

interface ThankYouPageProps {
  user: User;
  onGoToProducts: () => void;
}

export function ThankYouPage({ user, onGoToProducts }: ThankYouPageProps) {
  const [secondsLeft, setSecondsLeft] = useState(4);
  const onGoToProductsRef = useRef(onGoToProducts);

  useEffect(() => {
    onGoToProductsRef.current = onGoToProducts;
  }, [onGoToProducts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      onGoToProductsRef.current();
    }
  }, [secondsLeft]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex flex-col">
      <header className="border-b border-black/10 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <span className="font-display text-xl font-bold tracking-tight text-[#111113]">
            Mezone
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#57534E]">Step 3 of 3 · Welcome</span>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6">
        <div className="w-full max-w-lg">
          <BannerAdSlot position="bottom" pageGroup="public" />
        </div>
        <div className="w-full max-w-lg bg-white border border-black/10 rounded-xl p-8 sm:p-10 text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-[#FFF7ED] border border-[#EA580C]/30 text-[#EA580C] flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#C2410C]">
              Profile Completed · Welcome to Mezone
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
              Thank You, {user.displayName || user.email?.split('@')[0] || 'Shopper'}!
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed">
              Your Mezone Digital Affiliate Shopping account is ready. Browse curated Temu and
              Amazon deals, save favorites to My Liked, and track your PKR wallet rewards.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Account Status</span>
              <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                <MailCheck className="w-3.5 h-3.5" />
                {user.emailVerified ? 'Verified & Active' : 'Mail Confirmation Sent'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Reward System Status</span>
              <span className="font-mono font-semibold text-[#C2410C] tabular-nums">
                {getRewardSystemStatus().isActive
                  ? '+100 PKR Ready'
                  : 'Starts 20 November 2026'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Next Destination</span>
              <span className="font-semibold text-[#111113]">Product Catalog</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onGoToProducts}
              className="w-full h-11 px-5 bg-[#EA580C] text-white text-sm font-semibold rounded-lg hover:bg-[#C2410C] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Go to Product Page Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs font-mono text-[#57534E] tabular-nums">
              Redirecting to Product page in {secondsLeft}s...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
