/**
 * Firestore Security Rules Verification Suite (Phase 0 TDD)
 * Validates the "Dirty Dozen" adversarial payloads against Mezone's shopping & referral invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: 'users' | 'inviteCodes' | 'referrals' | 'orderProofs' | 'products' | 'likedItems' | 'withdrawals';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on user profile',
    collection: 'users',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: { auth: null, targetDoc: 'users/user1' },
  },
  {
    id: 2,
    name: 'Self-referral attempt (inviterUid == inviteeUid)',
    collection: 'referrals',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { inviteeUid: 'user1', inviterUid: 'user1' },
  },
  {
    id: 3,
    name: 'Creating referral with pre-accepted status',
    collection: 'referrals',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { inviteeUid: 'user1', status: 'accepted' },
  },
  {
    id: 4,
    name: 'Forging rewardPkr != 500 on referral create',
    collection: 'referrals',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { inviteeUid: 'user1', rewardPkr: 50000 },
  },
  {
    id: 5,
    name: 'Non-admin shopper approving their own orderProof',
    collection: 'orderProofs',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { authEmail: 'shopper@example.com', status: 'approved' },
  },
  {
    id: 6,
    name: 'Non-admin shopper modifying approvedProductCount on referral',
    collection: 'referrals',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { authEmail: 'shopper@example.com', approvedProductCount: 10 },
  },
  {
    id: 7,
    name: 'Marking referral accepted with fewer than 10 approved products',
    collection: 'referrals',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { approvedProductCount: 5, status: 'accepted' },
  },
  {
    id: 8,
    name: 'Empty or oversized proofAttachment payload (< 20 or > 70000 chars)',
    collection: 'orderProofs',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { proofAttachment: '' },
  },
  {
    id: 9,
    name: 'Listing all inviteCodes',
    collection: 'inviteCodes',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { query: 'collection(db, "inviteCodes")' },
  },
  {
    id: 10,
    name: 'Non-admin unscoped list query on orderProofs',
    collection: 'orderProofs',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { query: 'collection(db, "orderProofs")' },
  },
  {
    id: 11,
    name: 'Non-admin shopper arbitrarily inflating walletBalancePkr',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { walletBalancePkr: 99999 },
  },
  {
    id: 12,
    name: 'Submitting withdrawal under 1,000 PKR minimum',
    collection: 'withdrawals',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { amount: 500, taxPkr: 25, feePkr: 10, netAmountPkr: 465 },
  },
];
