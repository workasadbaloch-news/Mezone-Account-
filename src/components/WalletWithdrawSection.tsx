import { FormEvent, useEffect, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, Coins, Landmark, Lock, ShieldCheck, Wallet } from 'lucide-react';
import {
  ACCOUNT_CREATE_BONUS_PKR,
  BUY_TWO_PRODUCTS_BONUS_PKR,
  calculateWithdrawalBreakdown,
  claimCompleteProfileBonus,
  claimDailyTokensToPkr,
  collectDailyLoginToken,
  DAILY_TOKENS_CLAIM_PKR,
  DAILY_TOKENS_CYCLE_DAYS,
  DAILY_TOKENS_TARGET,
  getDailyTokenAmountForDay,
  getTodayDateKey,
  PROFILE_COMPLETE_BONUS_PKR,
  submitWithdrawalRequest,
  WITHDRAW_MIN_PKR,
} from '../lib/mezoneDb';
import { UserProfile, WithdrawalRecord } from '../types/mezone';

interface WalletWithdrawSectionProps {
  uid: string;
  userEmail: string;
  isVerified: boolean;
  profile: UserProfile | null;
  myWithdrawals: WithdrawalRecord[];
  onFlashStatus: (message: string) => void;
  onGoToPersonalInfo: () => void;
}

const POPULAR_BANKS = [
  'JazzCash',
  'Easypaisa',
  'Meezan Bank',
  'HBL (Habib Bank)',
  'SadaPay',
  'NayaPay',
  'UBL',
  'MCB Bank',
  'Allied Bank',
  'Bank Alfalah',
];

export function WalletWithdrawSection({
  uid,
  userEmail,
  isVerified,
  profile,
  myWithdrawals,
  onFlashStatus,
  onGoToPersonalInfo,
}: WalletWithdrawSectionProps) {
  const [busyAction, setBusyAction] = useState<'profileBonus' | 'dailyToken' | 'claimTokens' | 'withdraw' | null>(null);
  const [bankName, setBankName] = useState('JazzCash');
  const [holderName, setHolderName] = useState(profile?.displayName || '');
  const [cellNumber, setCellNumber] = useState(profile?.phone || '');
  const [withdrawAmount, setWithdrawAmount] = useState('1000');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const syncedDefaultsRef = useRef({ name: Boolean(profile?.displayName), phone: Boolean(profile?.phone) });

  useEffect(() => {
    if (profile?.displayName && !syncedDefaultsRef.current.name) {
      syncedDefaultsRef.current.name = true;
      setHolderName((prev) => prev || profile.displayName);
    }
    if (profile?.phone && !syncedDefaultsRef.current.phone) {
      syncedDefaultsRef.current.phone = true;
      setCellNumber((prev) => prev || profile.phone);
    }
  }, [profile?.displayName, profile?.phone]);

  const walletBalance = profile?.walletBalancePkr ?? ACCOUNT_CREATE_BONUS_PKR;
  const approvedProductsCount = profile?.approvedProductsCount ?? 0;
  const loginTokens = profile?.loginTokens ?? 0;
  const dailyLoginDays = profile?.dailyLoginDays ?? 0;
  const lastCheckInDate = profile?.lastCheckInDate ?? '';
  const todayKey = getTodayDateKey();
  const checkedInToday = lastCheckInDate === todayKey;
  const nextDayNumber = Math.min(DAILY_TOKENS_CYCLE_DAYS, dailyLoginDays + 1);
  const nextDayTokens = getDailyTokenAmountForDay(nextDayNumber);
  const canClaimTokens = loginTokens >= DAILY_TOKENS_TARGET;

  const hasCompletedProfile =
    Boolean(profile?.displayName?.trim()) &&
    (profile?.phone?.trim().length ?? 0) >= 7 &&
    Boolean(profile?.region?.trim());

  const withdrawUnlocked = isVerified && walletBalance >= WITHDRAW_MIN_PKR;

  const parsedAmount = Number(withdrawAmount) || 0;
  const breakdown = calculateWithdrawalBreakdown(parsedAmount);

  const handleClaimProfileBonus = async () => {
    if (!profile) return;
    setBusyAction('profileBonus');
    try {
      const res = await claimCompleteProfileBonus(uid, profile);
      onFlashStatus(res.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDailyCheckIn = async () => {
    if (!profile) return;
    setBusyAction('dailyToken');
    try {
      const res = await collectDailyLoginToken(uid, profile);
      onFlashStatus(res.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleClaimTokens = async () => {
    if (!profile) return;
    setBusyAction('claimTokens');
    try {
      const res = await claimDailyTokensToPkr(uid, profile);
      onFlashStatus(res.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleWithdrawSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    if (!isVerified) {
      setWithdrawError('Please verify your Mezone email account before withdrawing.');
      return;
    }
    if (walletBalance < WITHDRAW_MIN_PKR) {
      setWithdrawError(
        `Withdraw is locked until your balance reaches ${WITHDRAW_MIN_PKR.toLocaleString()} PKR.`
      );
      return;
    }
    if (parsedAmount < WITHDRAW_MIN_PKR) {
      setWithdrawError(`Minimum withdrawal amount is ${WITHDRAW_MIN_PKR.toLocaleString()} PKR.`);
      return;
    }
    if (parsedAmount > walletBalance) {
      setWithdrawError('Withdrawal amount cannot exceed your available wallet balance.');
      return;
    }
    if (bankName.trim().length < 2 || holderName.trim().length < 2 || cellNumber.trim().length < 7) {
      setWithdrawError('Enter valid Bank Name, Holder Name, and Cell Number.');
      return;
    }

    setBusyAction('withdraw');
    try {
      await submitWithdrawalRequest({
        uid,
        userName: profile?.displayName || 'Mezone Shopper',
        userEmail,
        bankName,
        holderName,
        cellNumber,
        amount: parsedAmount,
        currentBalance: walletBalance,
        currentTotalWithdrawn: profile?.totalWithdrawnPkr ?? 0,
      });
      setWithdrawAmount('1000');
      onFlashStatus(
        `Withdrawal request submitted for ${parsedAmount.toLocaleString()} PKR (Net payout ${breakdown.netAmountPkr.toLocaleString()} PKR after 5% tax & 2% fee).`
      );
    } catch (err) {
      setWithdrawError(
        err instanceof Error ? err.message : 'Unable to submit withdrawal request.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 4-Column Wallet KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-black/10 rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x divide-black/10">
        <div className="p-6">
          <p className="text-xs text-[#57534E] mb-1">Wallet Balance</p>
          <p className="font-mono text-2xl font-semibold text-[#C2410C] tabular-nums">
            {walletBalance.toLocaleString()} PKR
          </p>
          <p className="text-xs text-[#57534E] mt-1">Available reward balance</p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[#57534E] mb-1">30-Day Daily Tokens</p>
          <p className="font-mono text-2xl font-semibold text-[#111113] tabular-nums">
            {loginTokens.toLocaleString()} / {DAILY_TOKENS_TARGET.toLocaleString()}
          </p>
          <p className="text-xs text-[#57534E] mt-1 tabular-nums">
            Day {dailyLoginDays} of {DAILY_TOKENS_CYCLE_DAYS} · 1,000 = 50 PKR
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[#57534E] mb-1">Approved Bought Products</p>
          <p className="font-mono text-2xl font-semibold text-[#111113] tabular-nums">
            {approvedProductsCount}
          </p>
          <p className="text-xs text-[#57534E] mt-1">
            {profile?.buyTwoBonusClaimed
              ? 'Buy 2 Bonus (+300 PKR) Credited'
              : `${Math.min(2, approvedProductsCount)} / 2 for 300 PKR`}
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs text-[#57534E] mb-1">Withdraw Status</p>
          <p
            className={`font-mono text-lg font-semibold tabular-nums ${
              withdrawUnlocked ? 'text-emerald-700' : 'text-[#111113]'
            }`}
          >
            {withdrawUnlocked ? 'Unlocked' : 'Locked'}
          </p>
          <p className="text-xs text-[#57534E] mt-1 tabular-nums">
            Min {WITHDRAW_MIN_PKR.toLocaleString()} PKR · 5% Tax + 2% Fee
          </p>
        </div>
      </div>

      {/* Rewards & 30-Day Daily Login Token Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Account Milestones (100 PKR + 300 PKR + 50 PKR) & 30-Day Daily Login Tokens */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#111113]">
                Mezone Account & Shopping Bonuses
              </h2>
              <Wallet className="w-4 h-4 text-[#EA580C]" />
            </div>

            <div className="divide-y divide-black/10">
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">
                    Account Create Bonus
                  </p>
                  <p className="text-xs text-[#57534E]">
                    Credited when your Mezone account is registered and verified.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-[#111113] tabular-nums">
                    +{ACCOUNT_CREATE_BONUS_PKR} PKR
                  </p>
                  <p className="text-xs font-semibold text-emerald-700">Credited</p>
                </div>
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">
                    Buy 2 Products Bonus
                  </p>
                  <p className="text-xs text-[#57534E]">
                    Awarded once 2 Temu/Amazon purchased products are approved via Order Proof.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-[#111113] tabular-nums">
                    +{BUY_TWO_PRODUCTS_BONUS_PKR} PKR
                  </p>
                  <p
                    className={`text-xs font-semibold tabular-nums ${
                      profile?.buyTwoBonusClaimed ? 'text-emerald-700' : 'text-[#C2410C]'
                    }`}
                  >
                    {profile?.buyTwoBonusClaimed
                      ? 'Credited'
                      : `${Math.min(2, approvedProductsCount)} / 2 Products`}
                  </p>
                </div>
              </div>

              <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">
                    Verify Account & Complete Profile
                  </p>
                  <p className="text-xs text-[#57534E]">
                    Verify email and save Name, Phone Number, and Region in Personal Information.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-semibold text-[#111113] tabular-nums">
                    +{PROFILE_COMPLETE_BONUS_PKR} PKR
                  </span>
                  {profile?.profileBonusClaimed ? (
                    <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Claimed
                    </span>
                  ) : hasCompletedProfile && isVerified ? (
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={handleClaimProfileBonus}
                      className="px-3 py-1.5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    >
                      {busyAction === 'profileBonus' ? 'Claiming...' : 'Claim 50 PKR'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onGoToPersonalInfo}
                      className="px-3 py-1.5 bg-[#FAF9F6] border border-black/15 text-[#111113] text-xs font-semibold rounded-lg hover:bg-[#EFECE5] cursor-pointer whitespace-nowrap"
                    >
                      Complete Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 30-Day Daily Login Collect Tokens Card */}
          <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#C2410C] mb-0.5">
                  30-Day Daily Login Program
                </p>
                <h2 className="text-base font-semibold text-[#111113]">
                  Collect 1,000 Tokens → Claim 50 PKR
                </h2>
              </div>
              <Coins className="w-5 h-5 text-[#EA580C] shrink-0" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="tabular-nums">
                  Day <strong className="text-[#111113]">{dailyLoginDays}</strong> of 30
                </span>
                <span className="font-mono font-semibold text-[#111113] tabular-nums">
                  {loginTokens.toLocaleString()} / {DAILY_TOKENS_TARGET.toLocaleString()} Tokens
                </span>
              </div>

              <div className="w-full h-2.5 bg-[#EFECE5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#EA580C] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (loginTokens / DAILY_TOKENS_TARGET) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              Check in once daily for 30 days to collect 1,000 total tokens (Days 1–20: +33
              tokens/day, Days 21–30: +34 tokens/day), then claim {DAILY_TOKENS_CLAIM_PKR} PKR
              directly into your wallet.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={
                  !isVerified ||
                  checkedInToday ||
                  dailyLoginDays >= DAILY_TOKENS_CYCLE_DAYS ||
                  busyAction !== null
                }
                onClick={handleDailyCheckIn}
                className="h-10 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>
                  {checkedInToday
                    ? 'Collected Today'
                    : dailyLoginDays >= DAILY_TOKENS_CYCLE_DAYS
                      ? '30/30 Days Completed'
                      : `Collect Day ${nextDayNumber} (+${nextDayTokens} Tokens)`}
                </span>
              </button>

              <button
                type="button"
                disabled={!canClaimTokens || busyAction !== null}
                onClick={handleClaimTokens}
                className="h-10 px-4 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-50 cursor-pointer"
              >
                {busyAction === 'claimTokens'
                  ? 'Claiming...'
                  : canClaimTokens
                    ? `Claim 1,000 Tokens → ${DAILY_TOKENS_CLAIM_PKR} PKR`
                    : `Need ${(DAILY_TOKENS_TARGET - loginTokens).toLocaleString()} More Tokens`}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Withdraw Account Form (1,000 PKR Minimum, 5% Tax, 2% Fee) & History */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#111113]">
                  Withdraw Account (Minimum 1,000 PKR)
                </h2>
                <p className="text-xs text-[#57534E] mt-1">
                  Withdraw unlocks when your account is verified and Wallet Balance reaches
                  1,000 PKR. Tax (5%) and Service Fee (2%) apply.
                </p>
              </div>
              <Landmark className="w-5 h-5 text-[#EA580C] shrink-0" />
            </div>

            {/* Unlock Requirement Checklist */}
            <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#57534E]">1. Account Verification</span>
                <span
                  className={`font-semibold inline-flex items-center gap-1 ${
                    isVerified ? 'text-emerald-700' : 'text-[#C2410C]'
                  }`}
                >
                  {isVerified ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Pending
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#57534E]">2. Balance Minimum (1,000 PKR)</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    walletBalance >= WITHDRAW_MIN_PKR ? 'text-emerald-700' : 'text-[#C2410C]'
                  }`}
                >
                  {walletBalance.toLocaleString()} / 1,000 PKR
                </span>
              </div>
            </div>

            {withdrawError && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/40 text-xs text-[#9A3412]">
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="wd-bank"
                  className="block text-xs font-medium text-[#111113] mb-1"
                >
                  Bank Name
                </label>
                <input
                  id="wd-bank"
                  list="mezone-bank-list"
                  type="text"
                  required
                  maxLength={80}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="JazzCash, Easypaisa, HBL, Meezan Bank..."
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
                <datalist id="mezone-bank-list">
                  {POPULAR_BANKS.map((bank) => (
                    <option key={bank} value={bank} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="wd-holder"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    Holder Name
                  </label>
                  <input
                    id="wd-holder"
                    type="text"
                    required
                    maxLength={80}
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Account holder full name"
                    className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wd-cell"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    Cell Number
                  </label>
                  <input
                    id="wd-cell"
                    type="tel"
                    required
                    minLength={7}
                    maxLength={32}
                    value={cellNumber}
                    onChange={(e) => setCellNumber(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="wd-amount"
                  className="block text-xs font-medium text-[#111113] mb-1"
                >
                  Amount (PKR · Min 1,000 PKR)
                </label>
                <input
                  id="wd-amount"
                  type="number"
                  min={1000}
                  step="1"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg tabular-nums"
                />
              </div>

              {/* Tax (5%) & Fee (2%) Live Breakdown */}
              <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[#57534E]">
                  <span>Requested Amount</span>
                  <span className="font-mono text-[#111113] tabular-nums">
                    {breakdown.amount.toLocaleString()} PKR
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#57534E]">
                  <span>Tax (5%)</span>
                  <span className="font-mono text-[#9A3412] tabular-nums">
                    -{breakdown.taxPkr.toLocaleString()} PKR
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#57534E]">
                  <span>Fee (2%)</span>
                  <span className="font-mono text-[#9A3412] tabular-nums">
                    -{breakdown.feePkr.toLocaleString()} PKR
                  </span>
                </div>
                <div className="pt-1.5 border-t border-black/10 flex items-center justify-between font-semibold text-[#111113]">
                  <span>Net Payout You Receive</span>
                  <span className="font-mono text-sm text-[#C2410C] tabular-nums">
                    {breakdown.netAmountPkr.toLocaleString()} PKR
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!withdrawUnlocked || busyAction !== null}
                className="w-full h-10 px-4 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {!withdrawUnlocked && <Lock className="w-3.5 h-3.5" />}
                <span>
                  {busyAction === 'withdraw'
                    ? 'Submitting Withdrawal...'
                    : withdrawUnlocked
                      ? `Submit Withdrawal (${breakdown.netAmountPkr.toLocaleString()} PKR Net)`
                      : 'Withdraw Locked (Verify & Reach 1,000 PKR)'}
                </span>
              </button>
            </form>
          </div>

          {/* User's Withdrawal History */}
          <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10">
              <h2 className="text-base font-semibold text-[#111113]">
                Withdrawal Requests ({myWithdrawals.length})
              </h2>
            </div>
            {myWithdrawals.length === 0 ? (
              <p className="p-6 text-xs text-[#57534E]">
                No withdrawal requests submitted yet.
              </p>
            ) : (
              <ul className="divide-y divide-black/10">
                {myWithdrawals.map((wd) => (
                  <li key={wd.id} className="px-6 py-4 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#111113]">
                        {wd.bankName} · {wd.holderName}
                      </p>
                      <span
                        className={`text-xs font-semibold capitalize ${
                          wd.status === 'approved'
                            ? 'text-emerald-700'
                            : wd.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-[#C2410C]'
                        }`}
                      >
                        {wd.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E] font-mono tabular-nums">
                      Cell: {wd.cellNumber} · Amount: {wd.amount.toLocaleString()} PKR · Tax 5%:{' '}
                      {wd.taxPkr.toLocaleString()} · Fee 2%: {wd.feePkr.toLocaleString()} · Net:{' '}
                      {wd.netAmountPkr.toLocaleString()} PKR
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
