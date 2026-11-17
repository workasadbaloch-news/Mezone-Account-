import { useState } from 'react';
import {
  linkWithPopup,
  reauthenticateWithPopup,
  unlink,
  User,
} from 'firebase/auth';
import {
  CheckCircle2,
  Link2,
  Loader2,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import {
  appleProvider,
  facebookProvider,
  githubProvider,
  googleProvider,
  yahooProvider,
} from '../lib/firebase';
import { ADMIN_EMAIL, formatLoginWayLabel } from '../lib/mezoneDb';

interface LinkedLoginSectionProps {
  user: User;
  onRefreshUser: () => Promise<void>;
  onFlashStatus: (message: string) => void;
}

type SocialTarget = 'google' | 'apple' | 'facebook' | 'github' | 'yahoo';

const PROVIDER_CARDS: Array<{
  key: SocialTarget;
  providerId: string;
  label: string;
  badge?: string;
  badgeTone?: string;
  buttonStyle: string;
}> = [
  {
    key: 'google',
    providerId: 'google.com',
    label: 'Google Login',
    badge: 'Recommend',
    badgeTone: 'bg-emerald-100 text-emerald-800',
    buttonStyle: 'bg-white border border-black/15 text-[#111113] hover:bg-[#FAF9F6]',
  },
  {
    key: 'apple',
    providerId: 'apple.com',
    label: 'Apple Login',
    buttonStyle: 'bg-[#111113] text-white hover:bg-[#27272A]',
  },
  {
    key: 'facebook',
    providerId: 'facebook.com',
    label: 'Facebook Login',
    badge: 'Hot',
    badgeTone: 'bg-[#EA580C] text-white',
    buttonStyle: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
  },
  {
    key: 'github',
    providerId: 'github.com',
    label: 'Github Login',
    buttonStyle: 'bg-[#24292F] text-white hover:bg-[#1B1F23]',
  },
  {
    key: 'yahoo',
    providerId: 'yahoo.com',
    label: 'Yahoo Login',
    buttonStyle: 'bg-[#6001D2] text-white hover:bg-[#5000B3]',
  },
];

export function LinkedLoginSection({
  user,
  onRefreshUser,
  onFlashStatus,
}: LinkedLoginSectionProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const isProtectedAdmin =
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const linkedCount = user.providerData.length;
  const passwordInfo = user.providerData.find((p) => p.providerId === 'password');

  const getProviderInstance = (target: SocialTarget) => {
    switch (target) {
      case 'google':
        return googleProvider;
      case 'apple':
        return appleProvider;
      case 'facebook':
        return facebookProvider;
      case 'github':
        return githubProvider;
      case 'yahoo':
        return yahooProvider;
    }
  };

  const handleLink = async (target: SocialTarget, label: string) => {
    setFeedbackMsg(null);
    setBusyKey(`link:${target}`);
    try {
      await linkWithPopup(user, getProviderInstance(target));
      await onRefreshUser();
      const msg = `${label} linked to your Mezone account.`;
      setFeedbackMsg(msg);
      onFlashStatus(msg);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/credential-already-in-use') {
        setFeedbackMsg(
          `This ${label} account is already linked to another Mezone profile.`
        );
      } else if (code === 'auth/provider-already-linked') {
        setFeedbackMsg(`${label} is already linked to this account.`);
      } else if (code === 'auth/operation-not-allowed') {
        setFeedbackMsg(
          `Enable ${label} in Firebase Console → Authentication → Sign-in method to link it.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setFeedbackMsg(`${label} popup was closed before finishing.`);
      } else {
        setFeedbackMsg(
          err instanceof Error ? err.message : `Unable to link ${label}.`
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirm = async (target: SocialTarget, label: string) => {
    setFeedbackMsg(null);
    setBusyKey(`confirm:${target}`);
    try {
      await reauthenticateWithPopup(user, getProviderInstance(target));
      await onRefreshUser();
      const msg = `${label} login confirmed for ${user.email || 'your account'}.`;
      setFeedbackMsg(msg);
      onFlashStatus(msg);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setFeedbackMsg(`${label} confirmation popup was closed.`);
      } else {
        setFeedbackMsg(
          err instanceof Error ? err.message : `Unable to confirm ${label}.`
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleUnlink = async (providerId: string, label: string) => {
    if (linkedCount <= 1) {
      setFeedbackMsg('At least one login method must stay linked to your account.');
      return;
    }
    if (isProtectedAdmin && providerId === 'google.com') {
      setFeedbackMsg(
        'Google Login is required for the protected Admin Center owner account and cannot be unlinked.'
      );
      return;
    }

    setFeedbackMsg(null);
    setBusyKey(`unlink:${providerId}`);
    try {
      await unlink(user, providerId);
      await onRefreshUser();
      const msg = `${label} unlinked from your Mezone account.`;
      setFeedbackMsg(msg);
      onFlashStatus(msg);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : `Unable to unlink ${label}.`
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10">
        <div className="flex items-start gap-3">
          <Link2 className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
          <div>
            <h1 className="font-display text-xl font-bold text-[#111113]">
              Linked Login
            </h1>
            <p className="text-xs text-[#57534E] mt-1">
              Manage your connected Firebase sign-in providers (Google, Apple, Facebook,
              GitHub, Yahoo, and Email). Active Login Way:{' '}
              <span className="font-semibold text-[#111113]">
                {formatLoginWayLabel(user)}
              </span>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>{linkedCount} Method(s) Linked</span>
        </span>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
          {feedbackMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDER_CARDS.map((card) => {
          const info = user.providerData.find(
            (p) => p.providerId === card.providerId
          );
          const isConnected = Boolean(info);
          const canUnlink =
            isConnected &&
            linkedCount > 1 &&
            !(isProtectedAdmin && card.providerId === 'google.com');

          return (
            <div
              key={card.key}
              className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#111113]">
                      {card.label}
                    </p>
                    {card.badge && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${card.badgeTone}`}
                      >
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      isConnected ? 'text-emerald-700' : 'text-[#57534E]'
                    }`}
                  >
                    {isConnected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isConnected ? 'Connected' : 'Not Linked'}</span>
                  </span>
                </div>

                <p className="text-xs font-mono text-[#57534E] break-all">
                  {info?.email ||
                    info?.displayName ||
                    (isConnected
                      ? `Linked UID: ${info?.uid}`
                      : `No ${card.label} linked`)}
                </p>
              </div>

              {isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => handleConfirm(card.key, card.label)}
                    className="flex-1 h-9 px-3 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {busyKey === `confirm:${card.key}` && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Confirm Login</span>
                  </button>
                  {canUnlink && (
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => handleUnlink(card.providerId, card.label)}
                      className="h-9 px-3 bg-white border border-black/15 text-xs font-semibold text-[#9A3412] rounded-lg hover:bg-[#FFF7ED] disabled:opacity-60 inline-flex items-center gap-1 cursor-pointer"
                      title={`Unlink ${card.label}`}
                    >
                      {busyKey === `unlink:${card.providerId}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      <span>Unlink</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => handleLink(card.key, card.label)}
                  className={`h-9 px-3.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer ${card.buttonStyle}`}
                >
                  {busyKey === `link:${card.key}` && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Connect {card.label}</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Email & Password Status Card */}
        <div className="p-5 rounded-xl bg-[#FAF9F6] border border-black/10 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#111113]">
                Email &amp; Password Login
              </p>
              <span
                className={`text-[11px] font-semibold ${
                  passwordInfo ? 'text-emerald-700' : 'text-[#57534E]'
                }`}
              >
                {passwordInfo ? 'Active' : 'Social Only'}
              </span>
            </div>
            <p className="text-xs font-mono text-[#57534E] break-all">
              {passwordInfo?.email || user.email || '—'}
            </p>
          </div>
          <div className="h-9 px-3.5 rounded-lg border border-black/10 bg-white text-xs font-medium text-[#57534E] inline-flex items-center justify-center">
            {user.emailVerified
              ? 'Primary Mail Verified'
              : 'Mail Verification Pending'}
          </div>
        </div>
      </div>
    </div>
  );
}
