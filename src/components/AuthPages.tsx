import { FormEvent, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, LogIn, MailCheck } from 'lucide-react';
import { BannerAdSlot } from '../lib/bannerAds';
import {
  appleProvider,
  auth,
  facebookProvider,
  googleProvider,
  yahooProvider,
} from '../lib/firebase';
import {
  ensureUserProfile,
  getPendingInviteCode,
  sanitizeInviteCode,
  setPendingInviteCode,
} from '../lib/mezoneDb';
import { ThemeToggleButton } from '../lib/theme';

interface AuthPagesProps {
  mode: 'register' | 'login';
  initialInviteCode?: string;
  onSwitchMode: (mode: 'register' | 'login') => void;
  onBackHome: () => void;
  onAuthenticated: (origin: 'register' | 'login') => void;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43Zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"
      />
    </svg>
  );
}

function YahooIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M14.12 14.37 21 3.5h-4.15l-4.53 7.51L7.86 3.5H3.5l6.85 10.87V20.5h3.77v-6.13Zm4.92 1.86a2.14 2.14 0 1 0 0 4.27 2.14 2.14 0 0 0 0-4.27Z"
      />
    </svg>
  );
}

function mapAuthError(err: unknown, providerLabel: string): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return `${providerLabel} sign-in popup was closed before completing.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site and try again.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return `${providerLabel} sign-in is not yet enabled in your Firebase project. Enable it in Firebase Console → Authentication → Sign-in method, or continue with Google Login right now.`;
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return `An account already exists with this email using another login method. Sign in with that method first, then connect ${providerLabel} in Verification Center.`;
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Use "I have an account" to sign in.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (code === 'auth/weak-password') {
    return 'Please choose a password with at least 6 characters.';
  }
  return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
}

export function AuthPages({
  mode,
  initialInviteCode,
  onSwitchMode,
  onBackHome,
  onAuthenticated,
}: AuthPagesProps) {
  const [showOptionalEmail, setShowOptionalEmail] = useState(mode === 'login');
  const [inviteCode, setInviteCode] = useState(
    () => sanitizeInviteCode(initialInviteCode || getPendingInviteCode())
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<
    'google' | 'apple' | 'facebook' | 'yahoo' | 'email' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const persistInviteIfProvided = () => {
    setPendingInviteCode(inviteCode);
  };

  const handleSocialPopup = async (
    target: 'google' | 'apple' | 'facebook' | 'yahoo'
  ) => {
    setErrorMessage(null);
    setVerificationNotice(null);
    persistInviteIfProvided();
    setBusyAction(target);
    const providerMap = {
      google: { provider: googleProvider, label: 'Google' },
      apple: { provider: appleProvider, label: 'Apple' },
      facebook: { provider: facebookProvider, label: 'Facebook' },
      yahoo: { provider: yahooProvider, label: 'Yahoo' },
    } as const;
    const { provider, label } = providerMap[target];

    try {
      const cred = await signInWithPopup(auth, provider);
      await ensureUserProfile(cred.user, undefined, inviteCode);
      onAuthenticated(mode);
    } catch (err) {
      setErrorMessage(mapAuthError(err, label));
    } finally {
      setBusyAction(null);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setVerificationNotice(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter your email address and password.');
      return;
    }

    if (isRegister && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    persistInviteIfProvided();
    setBusyAction('email');
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (trimmedName) {
          await updateProfile(cred.user, { displayName: trimmedName });
        }
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email rate limits
        }
        setVerificationNotice(
          `Your Mezone account was created for ${trimmedEmail}. A verification link has been sent to activate your invite code & profile.`
        );
        onAuthenticated('register');
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        if (cred.user.emailVerified) {
          await ensureUserProfile(cred.user);
        }
        onAuthenticated('login');
      }
    } catch (err) {
      setErrorMessage(mapAuthError(err, 'Email/Password'));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex flex-col">
      <header className="border-b border-black/10 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="font-display text-xl font-bold tracking-tight text-[#111113] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Mezone
          </button>

          <div className="flex items-center gap-3">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#57534E] hover:text-[#111113] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Welcome</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-6 pt-6">
        <BannerAdSlot position="top" pageGroup="public" />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md bg-white border border-black/10 rounded-xl p-8">
          <div className="mb-6">
            <p className="text-xs font-medium text-[#C2410C] mb-2">Mezone Auth</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113] mb-2">
              {isRegister ? 'Create your Mezone Account' : 'Mezone Login'}
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed">
              {isRegister
                ? 'Choose Google Login (Recommend), Apple Login, Facebook Login (Hot), Yahoo Login, or Mezone Login.'
                : 'Sign in with Google, Apple, Facebook, Yahoo, or your Mezone credentials.'}
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412] leading-relaxed"
            >
              {errorMessage}
            </div>
          )}

          {verificationNotice && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#F0FDF4] border border-emerald-700/20 text-xs text-emerald-900 flex items-start gap-2.5 leading-relaxed">
              <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{verificationNotice}</span>
            </div>
          )}

          {isRegister && (
            <div className="mb-5">
              <label
                htmlFor="mezone-invite-code"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                User Invite Code (Optional · Referral Program)
              </label>
              <input
                id="mezone-invite-code"
                type="text"
                maxLength={24}
                value={inviteCode}
                onChange={(e) => {
                  const val = sanitizeInviteCode(e.target.value);
                  setInviteCode(val);
                  setPendingInviteCode(val);
                }}
                placeholder="e.g. MZ-ASAD12345"
                className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]"
              />
            </div>
          )}

          {/* Primary Auth Providers: Google (Recommend), Apple, Facebook (Hot), Yahoo & Mezone Login */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSocialPopup('google')}
              className="w-full h-11 px-4 flex items-center justify-between gap-3 bg-white border border-black/15 rounded-lg text-sm font-semibold text-[#111113] hover:bg-[#FAF9F6] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                {busyAction === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                <span>Google Login</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-emerald-100 text-emerald-800">
                Recommend
              </span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSocialPopup('apple')}
              className="w-full h-11 px-4 flex items-center justify-between gap-3 bg-[#111113] rounded-lg text-sm font-semibold text-white hover:bg-[#27272A] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                {busyAction === 'apple' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AppleIcon />
                )}
                <span>Apple Login</span>
              </span>
              <span className="text-[11px] font-normal text-white/70">iOS / Web</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSocialPopup('facebook')}
              className="w-full h-11 px-4 flex items-center justify-between gap-3 bg-[#1877F2] rounded-lg text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                {busyAction === 'facebook' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FacebookIcon />
                )}
                <span>Facebook Login</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-[#EA580C] text-white">
                Hot
              </span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSocialPopup('yahoo')}
              className="w-full h-11 px-4 flex items-center justify-between gap-3 bg-[#6001D2] rounded-lg text-sm font-semibold text-white hover:bg-[#5000B3] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                {busyAction === 'yahoo' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <YahooIcon />
                )}
                <span>Yahoo Login</span>
              </span>
              <span className="text-[11px] font-normal text-white/80">Yahoo Mail</span>
            </button>

            {isRegister && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => {
                  setErrorMessage(null);
                  setVerificationNotice(null);
                  onSwitchMode('login');
                }}
                className="w-full h-11 px-4 flex items-center justify-center gap-2.5 bg-[#FAF9F6] border border-black/15 rounded-lg text-sm font-semibold text-[#111113] hover:bg-[#EFECE5] transition-colors disabled:opacity-60 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#EA580C]" />
                <span>Mezone Login · Sign In with Account</span>
              </button>
            )}
          </div>

          {/* Optional Name / Mail / Password Section */}
          <div className="mt-6 pt-6 border-t border-black/10">
            {isRegister ? (
              <button
                type="button"
                onClick={() => setShowOptionalEmail((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#57534E] hover:text-[#111113] transition-colors cursor-pointer"
              >
                <span>Optional: Register with Name, Mail & Password</span>
                {showOptionalEmail ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            ) : (
              <p className="text-xs font-semibold text-[#57534E] mb-3">
                Mezone Login (Email & Password)
              </p>
            )}

            {(showOptionalEmail || !isRegister) && (
              <form onSubmit={handleEmailSubmit} className="mt-4 space-y-4">
                {isRegister && (
                  <div>
                    <label
                      htmlFor="mezone-name"
                      className="block text-xs font-medium text-[#111113] mb-1.5"
                    >
                      Name (Optional)
                    </label>
                    <input
                      id="mezone-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="Your full name"
                      className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="mezone-email"
                    className="block text-xs font-medium text-[#111113] mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="mezone-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={160}
                    placeholder="you@example.com"
                    className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mezone-password"
                    className="block text-xs font-medium text-[#111113] mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="mezone-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? 'Create a password (min 6 chars)' : 'Enter password'}
                    className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113] placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/30 focus:border-[#EA580C]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="w-full h-11 px-4 bg-[#EA580C] text-white text-sm font-semibold rounded-lg hover:bg-[#C2410C] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {busyAction === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isRegister ? 'Create Mezone Account' : 'Sign In'}</span>
                </button>
              </form>
            )}
          </div>

          <div className="mt-7 pt-5 border-t border-black/10 text-center text-sm text-[#57534E]">
            {isRegister ? (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setVerificationNotice(null);
                    onSwitchMode('login');
                  }}
                  className="font-semibold text-[#111113] hover:text-[#EA580C] underline underline-offset-4 cursor-pointer"
                >
                  I have an account
                </button>
              </span>
            ) : (
              <span>
                New to Mezone?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setVerificationNotice(null);
                    onSwitchMode('register');
                  }}
                  className="font-semibold text-[#111113] hover:text-[#EA580C] underline underline-offset-4 cursor-pointer"
                >
                  Get Started
                </button>
              </span>
            )}
          </div>
        </div>
      </main>

      <div className="max-w-3xl w-full mx-auto px-6 pb-8">
        <BannerAdSlot position="bottom" pageGroup="public" />
      </div>
    </div>
  );
}
