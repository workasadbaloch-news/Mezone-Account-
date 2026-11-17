# Mezone Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: `/users/{userId}` and `/likedItems/{likedId}` are accessible only by `request.auth.uid == userId`. `/inviteCodes/{code}` contains zero PII (only `code` and `ownerUid`) and disallows `list`.
2. **Self-Referral Prevention**: Creating `/referrals/{inviteeUid}` enforces `incoming().inviteeUid == request.auth.uid`, `incoming().inviterUid != request.auth.uid`, and verifies the invite code exists via `exists()` and `get()` on `/inviteCodes/{code}`.
3. **Admin-Only Order Proof Approval & Referral Acceptance**: Shoppers can create `/orderProofs/{proofId}` only with `status == 'pending'` and a non-empty `proofAttachment` screenshot (`20..70000` chars). Only verified Admins may update `/orderProofs/{proofId}` to `'approved'` / `'rejected'` or update `/referrals/{inviteeUid}` (`approvedProductCount` and `status: 'accepted'`).
4. **Reward & Threshold Invariants**: On referral creation, `rewardPkr == 500`, `requiredProductCount == 10`, `approvedProductCount == 0`, `status == 'pending'`. Transition to `status == 'accepted'` requires `approvedProductCount >= 10`.
5. **Admin-Only Product Publishing**: Only verified Admins may create, update, or delete `/products/{productId}`, including a valid alphanumeric `productCode`.
6. **Wallet Integrity & Bonus Guardrails**: Users start with 100 PKR (`accountBonusClaimed: true`) on profile creation and cannot arbitrarily increment `walletBalancePkr` or `approvedProductsCount` (`+50 PKR` profile completion bonus requires verified account + completed phone and is one-time; `+50 PKR` token claim requires `loginTokens >= 1000` over 30 daily check-ins; `+300 PKR` buy-2-products bonus and `+500 PKR` referral payouts are Admin-controlled).
7. **Atomic Withdrawal Validation (1,000 PKR Min, 5% Tax, 2% Fee)**: Creating `/withdrawals/{withdrawalId}` requires `isVerifiedUser()`, `amount >= 1000`, `taxPkr ~= 5%`, `feePkr ~= 2%`, `netAmountPkr ~= 93%`, sufficient existing `walletBalancePkr`, and atomic deduction verified via `getAfter()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read on `/users/{uid}` -> `PERMISSION_DENIED`.
2. Shopper attempting self-referral (`inviterUid == inviteeUid`) -> `PERMISSION_DENIED`.
3. Shopper creating `/referrals/{uid}` with pre-accepted status (`status: 'accepted'`) -> `PERMISSION_DENIED`.
4. Shopper forging `rewardPkr: 50000` on `/referrals/{uid}` -> `PERMISSION_DENIED`.
5. Non-admin shopper attempting to approve their own `/orderProofs/{id}` -> `PERMISSION_DENIED`.
6. Non-admin shopper attempting to increment `approvedProductCount` on `/referrals/{uid}` -> `PERMISSION_DENIED`.
7. Admin attempting to mark `/referrals/{uid}` as `'accepted'` when `approvedProductCount < 10` -> `PERMISSION_DENIED`.
8. Missing or oversized attachment (`< 20` or `> 70KB`) on `/orderProofs/{id}` -> `PERMISSION_DENIED`.
9. Unscoped `list` query on `/inviteCodes` -> `PERMISSION_DENIED`.
10. Unscoped `list` query on `/orderProofs` by non-admin -> `PERMISSION_DENIED`.
11. Non-admin shopper arbitrarily inflating `walletBalancePkr` on `/users/{uid}` -> `PERMISSION_DENIED`.
12. Withdrawal under `1,000 PKR` or without atomic `/users/{uid}` balance deduction -> `PERMISSION_DENIED`.
