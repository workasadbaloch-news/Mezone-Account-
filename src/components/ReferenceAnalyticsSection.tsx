import { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  ACCOUNT_CREATE_BONUS_PKR,
  OFFICIAL_INVITE_CODE,
  OFFICIAL_INVITER_NAME,
} from '../lib/mezoneDb';
import {
  ReferralRecord,
  UserProfile,
  WithdrawalRecord,
} from '../types/mezone';

interface ReferenceAnalyticsSectionProps {
  user: User;
  verifyChecked: boolean;
  profile: UserProfile | null;
  myInvitedReferrals: ReferralRecord[];
  myInviterRecord: ReferralRecord | null;
  myWithdrawals: WithdrawalRecord[];
  onOpenWallet: () => void;
  onGoToVerification: () => void;
  onFlashStatus: (message: string) => void;
}

function formatDateKeyLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateKeyOffset(daysAgo: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return formatDateKeyLocal(dt);
}

function toLocalDateKey(ts: unknown): string | null {
  if (!ts) return null;
  if (ts instanceof Date) return formatDateKeyLocal(ts);
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : formatDateKeyLocal(parsed);
  }
  if (typeof ts === 'object') {
    const maybe = ts as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      return formatDateKeyLocal(maybe.toDate());
    }
    if (typeof maybe.seconds === 'number') {
      return formatDateKeyLocal(new Date(maybe.seconds * 1000));
    }
  }
  return null;
}

export function ReferenceAnalyticsSection({
  user,
  verifyChecked,
  profile,
  myInvitedReferrals,
  myInviterRecord,
  myWithdrawals,
  onOpenWallet,
  onGoToVerification,
  onFlashStatus,
}: ReferenceAnalyticsSectionProps) {
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const yesterdayKey = getDateKeyOffset(1);
    const last7Keys = new Set(
      Array.from({ length: 7 }, (_, i) => getDateKeyOffset(i))
    );

    const acceptedReferrals = myInvitedReferrals.filter(
      (r) => r.status === 'accepted'
    );

    const referralTotalPkr = acceptedReferrals.length * 500;
    const walletPlusWithdrawn = Number(
      (
        (profile?.walletBalancePkr ?? ACCOUNT_CREATE_BONUS_PKR) +
        (profile?.totalWithdrawnPkr ?? 0)
      ).toFixed(2)
    );
    const totalEarningPkr = Math.max(walletPlusWithdrawn, referralTotalPkr);

    let yesterdayEarningPkr = 0;
    let yesterdayCount = 0;
    let weeklyEarningPkr = 0;
    let weeklyCount = 0;

    for (const ref of acceptedReferrals) {
      const key = toLocalDateKey(ref.updatedAt || ref.createdAt);
      if (key === yesterdayKey) {
        yesterdayEarningPkr += ref.rewardPkr || 500;
        yesterdayCount += 1;
      }
      if (key && last7Keys.has(key)) {
        weeklyEarningPkr += ref.rewardPkr || 500;
        weeklyCount += 1;
      }
    }

    const approvedWithdrawalsPkr = myWithdrawals
      .filter((w) => w.status === 'approved')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    const withdrawMoneyPkr = Math.max(
      profile?.totalWithdrawnPkr ?? 0,
      approvedWithdrawalsPkr
    );
    const pendingWithdrawPkr = myWithdrawals
      .filter((w) => w.status === 'pending')
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    // 7-day Add User analysis
    const dailyAddUsers = Array.from({ length: 7 }, (_, idx) => {
      const offset = 6 - idx;
      const key = getDateKeyOffset(offset);
      const dt = new Date();
      dt.setDate(dt.getDate() - offset);
      const shortLabel =
        offset === 0
          ? 'Today'
          : dt.toLocaleDateString('en-US', { weekday: 'short' });
      const count = myInvitedReferrals.filter(
        (r) => toLocalDateKey(r.createdAt || r.updatedAt) === key
      ).length;
      return { key, shortLabel, count };
    });

    const maxDailyAdd = Math.max(1, ...dailyAddUsers.map((d) => d.count));
    const inProgressUsers = myInvitedReferrals.filter(
      (r) => r.status !== 'accepted' && (r.approvedProductCount || 0) > 0
    ).length;
    const waitingUsers = myInvitedReferrals.filter(
      (r) => r.status !== 'accepted' && (r.approvedProductCount || 0) === 0
    ).length;
    const acceptanceRate =
      myInvitedReferrals.length > 0
        ? Math.round((acceptedReferrals.length / myInvitedReferrals.length) * 100)
        : 0;

    return {
      totalEarningPkr,
      referralTotalPkr,
      yesterdayEarningPkr: Number(yesterdayEarningPkr.toFixed(2)),
      yesterdayCount,
      weeklyEarningPkr: Number(weeklyEarningPkr.toFixed(2)),
      weeklyCount,
      withdrawMoneyPkr: Number(withdrawMoneyPkr.toFixed(2)),
      pendingWithdrawPkr: Number(pendingWithdrawPkr.toFixed(2)),
      acceptedCount: acceptedReferrals.length,
      inProgressUsers,
      waitingUsers,
      acceptanceRate,
      dailyAddUsers,
      maxDailyAdd,
    };
  }, [
    myInvitedReferrals,
    myWithdrawals,
    profile,
  ]);

  const handleCopyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUid(value);
      window.setTimeout(() => setCopiedUid(null), 1800);
      onFlashStatus(`${label} copied.`);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP CARD: Earning, Yesterday earning, Weekly earning, Withdraw money */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-black/10 rounded-xl bg-white divide-y sm:divide-y-0 sm:divide-x divide-black/10">
        <div className="p-6 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#57534E]">Earning</p>
            <TrendingUp className="w-4 h-4 text-[#EA580C]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#111113] tabular-nums">
            {metrics.totalEarningPkr.toLocaleString()} PKR
          </p>
          <p className="text-[11px] text-[#57534E] tabular-nums">
            Invite Program: {metrics.referralTotalPkr.toLocaleString()} PKR ({metrics.acceptedCount}{' '}
            accepted)
          </p>
        </div>

        <div className="p-6 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#57534E]">
              Yesterday earning
            </p>
            <Clock className="w-4 h-4 text-[#57534E]" />
          </div>
          <p className="font-mono text-2xl font-bold text-[#C2410C] tabular-nums">
            {metrics.yesterdayEarningPkr.toLocaleString()} PKR
          </p>
          <p className="text-[11px] text-[#57534E] tabular-nums">
            {metrics.yesterdayCount} approved credit(s) yesterday
          </p>
        </div>

        <div className="p-6 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#57534E]">Weekly earning</p>
            <BarChart3 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {metrics.weeklyEarningPkr.toLocaleString()} PKR
          </p>
          <p className="text-[11px] text-[#57534E] tabular-nums">
            Last 7 days · {metrics.weeklyCount} approved credit(s)
          </p>
        </div>

        <div className="p-6 space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#57534E]">
                Withdraw money
              </p>
              <Wallet className="w-4 h-4 text-[#111113]" />
            </div>
            <p className="font-mono text-2xl font-bold text-[#111113] tabular-nums mt-1.5">
              {metrics.withdrawMoneyPkr.toLocaleString()} PKR
            </p>
            <p className="text-[11px] text-[#57534E] tabular-nums mt-1">
              {metrics.pendingWithdrawPkr > 0
                ? `${metrics.pendingWithdrawPkr.toLocaleString()} PKR pending payout`
                : `Available: ${(profile?.walletBalancePkr ?? 0).toLocaleString()} PKR`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenWallet}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#EA580C] hover:text-[#C2410C] cursor-pointer w-fit"
          >
            <span>Open Withdraw Wallet</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. ACCOUNT INVITE UID, STATUS & REFERENCE TASK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Invite UID & Status */}
        <div className="lg:col-span-5 bg-white border border-black/10 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10">
            <div>
              <p className="text-xs font-medium text-[#C2410C]">
                Reference Identity
              </p>
              <h2 className="text-base font-semibold text-[#111113]">
                Account Invite UID &amp; Status
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                verifyChecked ? 'text-emerald-700' : 'text-[#C2410C]'
              }`}
            >
              {verifyChecked ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Verify Pending</span>
                </>
              )}
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#57534E]">
                  Account Invite UID
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(user.uid, 'Account Invite UID')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#111113] hover:text-[#EA580C] cursor-pointer"
                >
                  {copiedUid === user.uid ? (
                    <Check className="w-3 h-3 text-emerald-700" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy UID</span>
                </button>
              </div>
              <p className="font-mono text-xs font-semibold text-[#111113] break-all">
                {user.uid}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#57534E]">
                  Invite Code ID (Share to Add User)
                </span>
                {verifyChecked && profile?.inviteCode ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(profile.inviteCode, 'Invite Code ID')
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EA580C] hover:text-[#C2410C] cursor-pointer"
                  >
                    {copiedUid === profile.inviteCode ? (
                      <Check className="w-3 h-3 text-emerald-700" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Copy Code</span>
                  </button>
                ) : null}
              </div>
              <p className="font-mono text-sm font-bold text-[#111113]">
                {verifyChecked && profile?.inviteCode
                  ? profile.inviteCode
                  : 'Locked — Verify Mail First'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF9F6] border border-black/10">
                <p className="text-[11px] text-[#57534E]">Status</p>
                <p
                  className={`font-semibold mt-0.5 ${
                    verifyChecked ? 'text-emerald-700' : 'text-[#C2410C]'
                  }`}
                >
                  {verifyChecked
                    ? myInviterRecord?.status === 'accepted'
                      ? 'Verified · Accepted'
                      : 'Verified · Active'
                    : 'Mail Verification Needed'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F6] border border-black/10">
                <p className="text-[11px] text-[#57534E]">Reward Tier</p>
                <p className="font-mono font-semibold text-[#111113] mt-0.5">
                  500 PKR / User
                </p>
              </div>
            </div>

            {myInviterRecord && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/25 text-xs space-y-1">
                <p className="font-semibold text-[#9A3412]">
                  Linked Referrer:{' '}
                  {myInviterRecord.inviterName ||
                    (myInviterRecord.inviterCode === OFFICIAL_INVITE_CODE
                      ? OFFICIAL_INVITER_NAME
                      : 'Mezone Referrer')}
                </p>
                <p className="text-[11px] text-[#57534E] font-mono">
                  Code: {myInviterRecord.inviterCode} · Status:{' '}
                  <span className="capitalize font-semibold text-[#111113]">
                    {myInviterRecord.status}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reference Task */}
        <div className="lg:col-span-7 bg-white border border-black/10 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/10">
            <div>
              <p className="text-xs font-medium text-[#C2410C]">
                Qualification Checklist
              </p>
              <h2 className="text-base font-semibold text-[#111113]">
                Reference Task
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold text-[#111113] tabular-nums">
              {metrics.acceptedCount} / {myInvitedReferrals.length} Accepted
            </span>
          </div>

          <div className="space-y-3">
            {/* Task 1 */}
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-mono text-[#C2410C]">Task 01</p>
                <p className="text-sm font-semibold text-[#111113]">
                  Verify Mail &amp; Unlock Account Invite UID
                </p>
                <p className="text-xs text-[#57534E]">
                  Confirm your inbox so your Invite Code and Shop Now button are
                  active.
                </p>
              </div>
              {verifyChecked ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Done</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onGoToVerification}
                  className="px-3 py-1.5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] shrink-0 cursor-pointer"
                >
                  Verify Mail
                </button>
              )}
            </div>

            {/* Task 2 */}
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-mono text-[#C2410C]">Task 02</p>
                <p className="text-sm font-semibold text-[#111113]">
                  Add Users with Your Invite Code
                </p>
                <p className="text-xs text-[#57534E]">
                  Share your Invite ID ({profile?.inviteCode || OFFICIAL_INVITE_CODE})
                  with shoppers when they register on Mezone.
                </p>
              </div>
              <span
                className={`text-xs font-mono font-semibold shrink-0 tabular-nums ${
                  myInvitedReferrals.length > 0
                    ? 'text-emerald-700'
                    : 'text-[#57534E]'
                }`}
              >
                {myInvitedReferrals.length} User(s)
              </span>
            </div>

            {/* Task 3 */}
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-mono text-[#C2410C]">Task 03</p>
                  <p className="text-sm font-semibold text-[#111113]">
                    Complete 10 Approved Product Orders with Order Proof
                  </p>
                  <p className="text-xs text-[#57534E]">
                    Invited users must buy 10 Temu/Amazon products with approved
                    Order Proof to unlock 500 PKR.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-[#C2410C] shrink-0 tabular-nums">
                  {myInviterRecord
                    ? `${Math.min(10, myInviterRecord.approvedProductCount)} / 10`
                    : `${metrics.acceptedCount} Completed`}
                </span>
              </div>
              <div className="w-full h-2 bg-[#EFECE5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#EA580C] transition-all duration-300"
                  style={{
                    width: `${
                      myInviterRecord
                        ? Math.min(
                            100,
                            (myInviterRecord.approvedProductCount / 10) * 100
                          )
                        : myInvitedReferrals.length > 0
                          ? Math.min(
                              100,
                              (metrics.acceptedCount / myInvitedReferrals.length) *
                                100
                            )
                          : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ANALYSIS FOR ADD USER */}
      <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/10">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[#111113]">
                Analysis For Add User
              </h2>
              <p className="text-xs text-[#57534E] mt-0.5">
                Live breakdown of users who joined with your Invite Code, their
                Account Invite UID, Status, and 10-order Reference Task progress.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-semibold text-[#111113] tabular-nums">
            Acceptance Rate: {metrics.acceptanceRate}%
          </span>
        </div>

        {/* Summary Metrics & 7-Day Add User Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
              <p className="text-[11px] text-[#57534E]">Total Added Users</p>
              <p className="font-mono text-xl font-bold text-[#111113] tabular-nums mt-1">
                {myInvitedReferrals.length}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
              <p className="text-[11px] text-[#57534E]">Accepted (10/10)</p>
              <p className="font-mono text-xl font-bold text-emerald-700 tabular-nums mt-1">
                {metrics.acceptedCount}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
              <p className="text-[11px] text-[#57534E]">Shopping (1–9)</p>
              <p className="font-mono text-xl font-bold text-[#C2410C] tabular-nums mt-1">
                {metrics.inProgressUsers}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
              <p className="text-[11px] text-[#57534E]">Waiting (0 Orders)</p>
              <p className="font-mono text-xl font-bold text-[#57534E] tabular-nums mt-1">
                {metrics.waitingUsers}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-[#111113]">
                7-Day Add User Trend
              </p>
              <span className="text-[11px] text-[#57534E]">
                New users registered per day
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
              {metrics.dailyAddUsers.map((bar) => {
                const heightPct =
                  bar.count > 0
                    ? Math.max(18, Math.round((bar.count / metrics.maxDailyAdd) * 100))
                    : 8;
                return (
                  <div
                    key={bar.key}
                    className="flex flex-col items-center justify-end h-full gap-1.5"
                  >
                    <span className="font-mono text-[10px] font-semibold text-[#111113] tabular-nums">
                      {bar.count}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          bar.count > 0 ? 'bg-[#EA580C]' : 'bg-[#E7E2D8]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${bar.key}: ${bar.count} user(s) added`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-[#57534E]">
                      {bar.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Account Invite UID / Status / Reference Task Table */}
        <div className="overflow-x-auto border border-black/10 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-black/10 text-[11px] font-semibold text-[#57534E] uppercase tracking-wider">
                <th className="py-3 px-4">Added User</th>
                <th className="py-3 px-4">Account Invite UID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reference Task</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 text-xs">
              {myInvitedReferrals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-[#57534E]">
                    No users added yet. Share your Invite ID ({profile?.inviteCode || 'Verify Mail First'}) to track Added Users here.
                  </td>
                </tr>
              ) : (
                myInvitedReferrals.map((ref) => {
                  const pct = Math.min(
                    100,
                    Math.round(((ref.approvedProductCount || 0) / 10) * 100)
                  );
                  return (
                    <tr key={ref.id} className="hover:bg-[#FAF9F6]/60">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#111113]">
                          {ref.inviteeName}
                        </p>
                        {ref.inviteeEmail && (
                          <p className="text-[11px] text-[#57534E]">
                            {ref.inviteeEmail}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[#111113] truncate max-w-[140px]">
                            {ref.inviteeUid}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                ref.inviteeUid,
                                'User Account Invite UID'
                              )
                            }
                            className="text-[#57534E] hover:text-[#111113] cursor-pointer"
                            aria-label="Copy User UID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] font-mono text-[#57534E]">
                          Code: {ref.inviterCode}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            ref.status === 'accepted'
                              ? 'text-emerald-700'
                              : 'text-[#C2410C]'
                          }`}
                        >
                          {ref.status === 'accepted' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accepted · +500 PKR</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums mb-1">
                          <span className="text-[#111113]">
                            {Math.min(10, ref.approvedProductCount || 0)} / 10
                            Products
                          </span>
                          <span className="text-[#57534E]">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#EFECE5] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              ref.status === 'accepted'
                                ? 'bg-emerald-600'
                                : 'bg-[#EA580C]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
