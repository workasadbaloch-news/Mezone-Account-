import { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AffiliateProduct,
  AuthProviderType,
  BannerPlacementScope,
  FeedbackCategory,
  GenderOption,
  LikedItemRecord,
  MarketplaceType,
  OrderProofRecord,
  ProductCategory,
  ReferralRecord,
  SiteBannerConfigRecord,
  SupportTopic,
  UserProfile,
  WithdrawalRecord,
} from '../types/mezone';
import { db, handleFirestoreError, OperationType } from './firebase';

const MAX_DISPLAY_NAME = 80;
const MAX_EMAIL = 160;
const MAX_PHONE = 32;
const MAX_REGION = 40;
const MAX_BIRTH_DATE = 16;
const MAX_COUNTRY_NAME = 60;
const MAX_TITLE = 140;
const MAX_URL = 500;
const MAX_DESC = 600;
const MAX_INVITE_CODE = 24;
const MAX_ORDER_REF = 64;
const MAX_PROOF_NOTES = 300;
const MAX_PROOF_ATTACHMENT = 70000;
const MAX_ADMIN_NOTE = 200;
const MAX_PRODUCT_CODE = 32;
const MAX_BANK_NAME = 80;
const MAX_TICKET_SUBJECT = 120;
const MAX_TICKET_MESSAGE = 600;
const MAX_TICKET_REPLY = 400;
const MAX_FEEDBACK_COMMENT = 500;
const MAX_BANNER_HTML = 20000;

export const ADMIN_EMAIL = 'work.asadbaloch804@gmail.com';
export const PENDING_INVITE_STORAGE_KEY = 'mezone_pending_invite_code';
export const WHATSAPP_PROOF_NUMBER = '923312558875';
export const WHATSAPP_PROOF_DISPLAY = '+92 3312558875';

export const COUNTRY_PHONE_OPTIONS = [
  { code: '+92', country: 'Pakistan', iso2: 'PK', region: 'Pakistan (PKR / USD)' },
  { code: '+971', country: 'United Arab Emirates', iso2: 'AE', region: 'United States (USD)' },
  { code: '+966', country: 'Saudi Arabia', iso2: 'SA', region: 'United States (USD)' },
  { code: '+974', country: 'Qatar', iso2: 'QA', region: 'United States (USD)' },
  { code: '+965', country: 'Kuwait', iso2: 'KW', region: 'United States (USD)' },
  { code: '+968', country: 'Oman', iso2: 'OM', region: 'United States (USD)' },
  { code: '+973', country: 'Bahrain', iso2: 'BH', region: 'United States (USD)' },
  { code: '+1', country: 'United States', iso2: 'US', region: 'United States (USD)' },
  { code: '+1', country: 'Canada', iso2: 'CA', region: 'Canada (CAD)' },
  { code: '+44', country: 'United Kingdom', iso2: 'GB', region: 'United Kingdom (GBP)' },
  { code: '+91', country: 'India', iso2: 'IN', region: 'United States (USD)' },
  { code: '+880', country: 'Bangladesh', iso2: 'BD', region: 'United States (USD)' },
  { code: '+61', country: 'Australia', iso2: 'AU', region: 'United States (USD)' },
  { code: '+49', country: 'Germany', iso2: 'DE', region: 'European Union (EUR)' },
  { code: '+33', country: 'France', iso2: 'FR', region: 'European Union (EUR)' },
  { code: '+39', country: 'Italy', iso2: 'IT', region: 'European Union (EUR)' },
  { code: '+34', country: 'Spain', iso2: 'ES', region: 'European Union (EUR)' },
  { code: '+31', country: 'Netherlands', iso2: 'NL', region: 'European Union (EUR)' },
  { code: '+90', country: 'Turkey', iso2: 'TR', region: 'European Union (EUR)' },
  { code: '+60', country: 'Malaysia', iso2: 'MY', region: 'United States (USD)' },
  { code: '+65', country: 'Singapore', iso2: 'SG', region: 'United States (USD)' },
  { code: '+81', country: 'Japan', iso2: 'JP', region: 'United States (USD)' },
  { code: '+86', country: 'China', iso2: 'CN', region: 'United States (USD)' },
] as const;

export const COUNTRY_NAME_OPTIONS = [
  'Pakistan',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Oman',
  'Bahrain',
  'United States',
  'Canada',
  'United Kingdom',
  'India',
  'Bangladesh',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Turkey',
  'Malaysia',
  'Singapore',
  'Japan',
  'China',
  'Other',
] as const;

export interface PendingProfileDraft {
  displayName: string;
  phone: string;
  region: string;
  birthDate: string;
  gender: GenderOption;
  countryName: string;
}

export function savePendingProfileDraft(uid: string, draft: PendingProfileDraft): void {
  try {
    localStorage.setItem(`mezone_pending_profile_${uid}`, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
}

export function getPendingProfileDraft(uid: string): PendingProfileDraft | null {
  try {
    const raw = localStorage.getItem(`mezone_pending_profile_${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as PendingProfileDraft;
  } catch {
    return null;
  }
}

export function clearPendingProfileDraft(uid: string): void {
  try {
    localStorage.removeItem(`mezone_pending_profile_${uid}`);
  } catch {
    // ignore storage errors
  }
}

export function lookupCountryOption(countryOrIso: string): {
  countryName: string;
  dialCode: string;
  region: string;
} | null {
  const query = countryOrIso.trim().toLowerCase();
  if (!query) return null;
  const matched = COUNTRY_PHONE_OPTIONS.find(
    (opt) =>
      opt.iso2.toLowerCase() === query ||
      opt.country.toLowerCase() === query ||
      query.includes(opt.country.toLowerCase())
  );
  if (!matched) return null;
  return {
    countryName: matched.country,
    dialCode: matched.code,
    region: matched.region,
  };
}

export async function detectUserCountryFromBrowserLocation(): Promise<{
  ok: boolean;
  countryName?: string;
  dialCode?: string;
  region?: string;
  city?: string;
  message: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      ok: false,
      message: 'Location detection is not supported in this browser. Choose your country manually.',
    };
  }

  let coords: GeolocationCoordinates;
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 300000,
      });
    });
    coords = position.coords;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 1) {
      return {
        ok: false,
        message: 'Location permission was denied. Allow location access or select your country manually.',
      };
    }
    return {
      ok: false,
      message: 'Unable to read GPS location right now. You can select your country and code manually.',
    };
  }

  let detectedIso = '';
  let detectedCountryName = '';
  let detectedCity = '';

  try {
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
    );
    if (resp.ok) {
      const data = (await resp.json()) as {
        countryCode?: string;
        countryName?: string;
        city?: string;
        locality?: string;
      };
      detectedIso = data.countryCode || '';
      detectedCountryName = data.countryName || '';
      detectedCity = data.city || data.locality || '';
    }
  } catch {
    // fallback to nominatim below
  }

  if (!detectedIso && !detectedCountryName) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          address?: {
            country_code?: string;
            country?: string;
            city?: string;
            town?: string;
          };
        };
        detectedIso = (data.address?.country_code || '').toUpperCase();
        detectedCountryName = data.address?.country || '';
        detectedCity = data.address?.city || data.address?.town || '';
      }
    } catch {
      // ignore network error
    }
  }

  const mapped =
    lookupCountryOption(detectedIso) ||
    lookupCountryOption(detectedCountryName);

  if (mapped) {
    return {
      ok: true,
      countryName: mapped.countryName,
      dialCode: mapped.dialCode,
      region: mapped.region,
      city: detectedCity,
      message: `Detected ${detectedCity ? `${detectedCity}, ` : ''}${mapped.countryName} (${mapped.dialCode}). Country and Cell Code auto-filled.`,
    };
  }

  if (detectedCountryName) {
    return {
      ok: true,
      countryName: 'Other',
      dialCode: '+1',
      region: 'United States (USD)',
      city: detectedCity,
      message: `Detected ${detectedCountryName}. Select your preferred Cell Number country code below.`,
    };
  }

  return {
    ok: false,
    message: 'Location coordinates detected, but country lookup was unavailable. Choose your country manually.',
  };
}

export const ACCOUNT_CREATE_BONUS_PKR = 100;
export const BUY_TWO_PRODUCTS_BONUS_PKR = 300;
export const PROFILE_COMPLETE_BONUS_PKR = 50;
export const DAILY_TOKENS_TARGET = 1000;
export const DAILY_TOKENS_CYCLE_DAYS = 30;
export const DAILY_TOKENS_CLAIM_PKR = 50;
export const WITHDRAW_MIN_PKR = 1000;
export const WITHDRAW_TAX_RATE = 0.05;
export const WITHDRAW_FEE_RATE = 0.02;

const DEFAULT_ADMIN_PIN_SHA256 =
  'ab2bfd38a7ba6d803f4005fa3316a77fa7bab392c19971fbcd37bb29dd9c86a9';

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAdminConfirmPin(pinInput: string): Promise<boolean> {
  const cleaned = pinInput.trim();
  if (!cleaned) return false;
  try {
    const hashHex = await sha256Hex(cleaned);
    let expectedHash = DEFAULT_ADMIN_PIN_SHA256;
    try {
      const configSnap = await getDoc(doc(db, 'adminConfig', 'security'));
      if (configSnap.exists()) {
        const storedHash = (configSnap.data() as { pinHash?: string })?.pinHash;
        if (storedHash && /^[a-f0-9]{64}$/.test(storedHash)) {
          expectedHash = storedHash;
        }
      }
    } catch {
      // fallback to default hash if config doc not yet created
    }
    return hashHex === expectedHash;
  } catch {
    return false;
  }
}

export async function changeAdminLoginPin(params: {
  uid: string;
  currentPin: string;
  newPin: string;
}): Promise<{ ok: boolean; message: string }> {
  const cleanedNew = params.newPin.trim();
  if (cleanedNew.length < 6 || cleanedNew.length > 24) {
    return { ok: false, message: 'New Login PIN must be between 6 and 24 characters.' };
  }

  const currentValid = await verifyAdminConfirmPin(params.currentPin);
  if (!currentValid) {
    return { ok: false, message: 'Current confirmation PIN is incorrect.' };
  }

  try {
    const newHash = await sha256Hex(cleanedNew);
    await setDoc(doc(db, 'adminConfig', 'security'), {
      pinHash: newHash,
      updatedBy: params.uid,
      updatedAt: serverTimestamp(),
    });
    return {
      ok: true,
      message: 'Admin Login PIN updated successfully.',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'adminConfig/security');
  }
}

export function sanitizeString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeInviteCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, MAX_INVITE_CODE);
}

export function sanitizeProductCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, MAX_PRODUCT_CODE);
}

export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const pathMatch = trimmed.match(
    /(?:drive\.google\.com|docs\.google\.com|lh3\.googleusercontent\.com)\/(?:file\/d|d|spreadsheets\/d|presentation\/d|document\/d)\/([a-zA-Z0-9_-]{10,})/i
  );
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const queryMatch = trimmed.match(
    /drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*\bid=([a-zA-Z0-9_-]{10,})/i
  );
  if (queryMatch?.[1]) {
    return queryMatch[1];
  }

  return null;
}

export function resolveDriveImageUrl(inputUrl: string): {
  resolvedUrl: string;
  fallbackUrl: string | null;
  isDrive: boolean;
  fileId: string | null;
} {
  const trimmed = sanitizeString(inputUrl, MAX_URL);
  const fileId = extractGoogleDriveFileId(trimmed);
  if (!fileId) {
    return {
      resolvedUrl: trimmed,
      fallbackUrl: null,
      isDrive: false,
      fileId: null,
    };
  }

  return {
    resolvedUrl: `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
    fallbackUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    isDrive: true,
    fileId,
  };
}

export function buildWhatsAppOrderProofUrl(params: {
  userName: string;
  userEmail: string;
  marketplace: MarketplaceType;
  productTitle: string;
  orderReference: string;
  quantity: number;
  proofNotes: string;
  proofId?: string;
}): string {
  const lines = [
    '*Mezone Order Proof Submission*',
    params.proofId ? `Proof ID: ${params.proofId}` : '',
    `Shopper: ${params.userName}`,
    params.userEmail ? `Email: ${params.userEmail}` : '',
    `Store: ${params.marketplace}`,
    `Product: ${params.productTitle}`,
    `Order ID: ${params.orderReference}`,
    `Quantity: ${params.quantity} product(s)`,
    `Details: ${params.proofNotes}`,
    'Screenshot attached below in this chat.',
  ].filter(Boolean);

  return `https://wa.me/${WHATSAPP_PROOF_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function generateInviteCode(uid: string, name?: string | null): string {
  const cleanPrefix = (name || 'MZ')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(2, 'X');
  const uidSuffix = uid
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-5)
    .padStart(5, '0');
  return `MZ-${cleanPrefix}${uidSuffix}`.slice(0, MAX_INVITE_CODE);
}

export function detectProvider(user: User): AuthProviderType {
  const providerId = user.providerData?.[0]?.providerId || '';
  if (providerId.includes('google')) return 'google';
  if (providerId.includes('apple')) return 'apple';
  if (providerId.includes('facebook')) return 'facebook';
  if (providerId.includes('yahoo')) return 'yahoo';
  return 'email';
}

export function formatLoginWayLabel(user: User): string {
  const providers = (user.providerData || []).map((p) => {
    if (p.providerId.includes('google')) return 'Google Sign-In';
    if (p.providerId.includes('apple')) return 'Apple Sign-In';
    if (p.providerId.includes('facebook')) return 'Facebook Login';
    if (p.providerId.includes('yahoo')) return 'Yahoo Login';
    if (p.providerId === 'password') return 'Email & Password';
    return p.providerId;
  });
  const unique = Array.from(new Set(providers));
  return unique.length > 0 ? unique.join(' · ') : 'Email & Password';
}

export function parseInternationalPhone(storedPhone: string): {
  countryCode: string;
  localNumber: string;
} {
  const cleaned = (storedPhone || '').replace(/[^+\d]/g, '');
  if (!cleaned) {
    return { countryCode: '+92', localNumber: '' };
  }
  const sortedCodes = [...COUNTRY_PHONE_OPTIONS].sort(
    (a, b) => b.code.length - a.code.length
  );
  for (const opt of sortedCodes) {
    if (cleaned.startsWith(opt.code)) {
      const rest = cleaned.slice(opt.code.length).replace(/^0+/, '');
      return { countryCode: opt.code, localNumber: rest };
    }
  }
  if (cleaned.startsWith('+')) {
    const match = cleaned.match(/^(\+\d{1,3})(\d*)$/);
    if (match) {
      return { countryCode: match[1], localNumber: match[2].replace(/^0+/, '') };
    }
  }
  return { countryCode: '+92', localNumber: cleaned.replace(/^0+/, '') };
}

export function normalizeInternationalPhone(
  countryCode: string,
  localRaw: string
): { ok: boolean; formatted: string; error?: string } {
  const digitsOnly = localRaw.replace(/\D/g, '');
  if (!digitsOnly) {
    return { ok: true, formatted: '' };
  }
  if (digitsOnly.startsWith('0')) {
    return {
      ok: false,
      formatted: '',
      error: 'Cell number cannot start with 0. Enter the number without leading 0 (e.g. 3001234567).',
    };
  }
  const codeDigits = countryCode.replace(/\D/g, '');
  if (!codeDigits || codeDigits.startsWith('0')) {
    return {
      ok: false,
      formatted: '',
      error: 'Select a valid country code.',
    };
  }
  const combinedDigits = `${codeDigits}${digitsOnly}`;
  if (combinedDigits.length < 7 || combinedDigits.length > 15) {
    return {
      ok: false,
      formatted: '',
      error: 'Cell number with country code must be between 7 and 15 digits.',
    };
  }
  return { ok: true, formatted: `+${combinedDigits}` };
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyTokenAmountForDay(dayNumber: number): number {
  // Days 1-20 earn 33 tokens/day, Days 21-30 earn 34 tokens/day -> exact 1,000 tokens at Day 30
  return dayNumber > 20 ? 34 : 33;
}

export function calculateWithdrawalBreakdown(amountRaw: number): {
  amount: number;
  taxPkr: number;
  feePkr: number;
  netAmountPkr: number;
} {
  const amount = Number(Math.max(0, amountRaw).toFixed(2));
  const taxPkr = Number((amount * WITHDRAW_TAX_RATE).toFixed(2));
  const feePkr = Number((amount * WITHDRAW_FEE_RATE).toFixed(2));
  const netAmountPkr = Number(Math.max(0, amount - taxPkr - feePkr).toFixed(2));
  return { amount, taxPkr, feePkr, netAmountPkr };
}

export function getPendingInviteCode(): string {
  try {
    return sanitizeInviteCode(localStorage.getItem(PENDING_INVITE_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function setPendingInviteCode(code: string): void {
  try {
    const cleaned = sanitizeInviteCode(code);
    if (cleaned) {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function ensureInviteCodeIndexed(code: string, ownerUid: string): Promise<void> {
  const cleaned = sanitizeInviteCode(code);
  if (cleaned.length < 4) return;
  const codeRef = doc(db, 'inviteCodes', cleaned);
  try {
    const snap = await getDoc(codeRef);
    if (!snap.exists()) {
      await setDoc(codeRef, {
        code: cleaned,
        ownerUid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `inviteCodes/${cleaned}`);
  }
}

export async function linkUserToInviteCode(params: {
  inviteeUid: string;
  inviteeName: string;
  inviteeEmail: string;
  inviterCodeRaw: string;
}): Promise<{ ok: boolean; message: string }> {
  const code = sanitizeInviteCode(params.inviterCodeRaw);
  if (code.length < 4) {
    return { ok: false, message: 'Invite code must be at least 4 characters.' };
  }

  const codeRef = doc(db, 'inviteCodes', code);
  try {
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      return { ok: false, message: `Invite code "${code}" was not found.` };
    }
    const codeData = codeSnap.data() as { ownerUid: string; code: string };
    if (codeData.ownerUid === params.inviteeUid) {
      return { ok: false, message: 'You cannot use your own invite code.' };
    }

    const referralRef = doc(db, 'referrals', params.inviteeUid);
    const existingRefSnap = await getDoc(referralRef);
    if (existingRefSnap.exists()) {
      return { ok: false, message: 'Your account is already linked to an invite code.' };
    }

    await setDoc(referralRef, {
      inviteeUid: params.inviteeUid,
      inviteeName: sanitizeString(params.inviteeName || 'Mezone Shopper', MAX_DISPLAY_NAME),
      inviteeEmail: sanitizeString(params.inviteeEmail || `${params.inviteeUid}@mezone.app`, MAX_EMAIL),
      inviterUid: codeData.ownerUid,
      inviterCode: code,
      approvedProductCount: 0,
      requiredProductCount: 10,
      rewardPkr: 500,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const userRef = doc(db, 'users', params.inviteeUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && !userSnap.data().invitedByCode) {
      await updateDoc(userRef, {
        invitedByCode: code,
        updatedAt: serverTimestamp(),
      });
    }

    setPendingInviteCode('');
    return {
      ok: true,
      message: `Linked to invite code ${code}. Buy 10 products with approved order proof to accept the referral (500 PKR).`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `referrals/${params.inviteeUid}`);
  }
}

export async function ensureUserProfile(
  user: User,
  preferredName?: string,
  explicitInviteCode?: string
): Promise<UserProfile | null> {
  if (!user.emailVerified) {
    return null;
  }

  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const pendingCode = sanitizeInviteCode(explicitInviteCode || getPendingInviteCode());

      if (snap.exists()) {
      const existingData = snap.data() as UserProfile;
      let resolvedInviteCode = existingData.inviteCode;
      const needsWalletBackfill = typeof existingData.walletBalancePkr !== 'number';
      const verifiedTokenEmail = user.email ? sanitizeString(user.email, MAX_EMAIL) : '';
      const authPhotoUrl = user.photoURL ? sanitizeString(user.photoURL, MAX_URL) : '';

      if (verifiedTokenEmail && existingData.email !== verifiedTokenEmail) {
        await updateDoc(userRef, {
          email: verifiedTokenEmail,
          updatedAt: serverTimestamp(),
        });
      }

      if (authPhotoUrl !== (existingData.photoUrl || '')) {
        await updateDoc(userRef, {
          photoUrl: authPhotoUrl,
          updatedAt: serverTimestamp(),
        });
      }

      if (!resolvedInviteCode || needsWalletBackfill) {
        resolvedInviteCode =
          resolvedInviteCode ||
          generateInviteCode(user.uid, existingData.displayName || user.displayName);

        const backfillPayload: Record<string, unknown> = {
          inviteCode: resolvedInviteCode,
          invitedByCode: existingData.invitedByCode || '',
          updatedAt: serverTimestamp(),
        };
        if (needsWalletBackfill) {
          backfillPayload.walletBalancePkr = ACCOUNT_CREATE_BONUS_PKR;
          backfillPayload.accountBonusClaimed = true;
          backfillPayload.profileBonusClaimed = false;
          backfillPayload.buyTwoBonusClaimed = false;
          backfillPayload.approvedProductsCount = 0;
          backfillPayload.loginTokens = 0;
          backfillPayload.dailyLoginDays = 0;
          backfillPayload.lastCheckInDate = '';
          backfillPayload.totalWithdrawnPkr = 0;
        }
        await updateDoc(userRef, backfillPayload);
      }

      await ensureInviteCodeIndexed(resolvedInviteCode, user.uid);
      if (pendingCode && !existingData.invitedByCode) {
        await linkUserToInviteCode({
          inviteeUid: user.uid,
          inviteeName: existingData.displayName,
          inviteeEmail: verifiedTokenEmail || existingData.email || '',
          inviterCodeRaw: pendingCode,
        });
      }
      return {
        ...existingData,
        email: verifiedTokenEmail || existingData.email,
        photoUrl: authPhotoUrl,
        birthDate: existingData.birthDate || '',
        gender: existingData.gender || '',
        countryName: existingData.countryName || '',
        inviteCode: resolvedInviteCode,
        invitedByCode: existingData.invitedByCode || '',
        walletBalancePkr: needsWalletBackfill
          ? ACCOUNT_CREATE_BONUS_PKR
          : existingData.walletBalancePkr,
        accountBonusClaimed: needsWalletBackfill ? true : existingData.accountBonusClaimed,
        profileBonusClaimed: needsWalletBackfill ? false : existingData.profileBonusClaimed,
        buyTwoBonusClaimed: needsWalletBackfill ? false : existingData.buyTwoBonusClaimed,
        approvedProductsCount: needsWalletBackfill ? 0 : existingData.approvedProductsCount,
        loginTokens: needsWalletBackfill ? 0 : existingData.loginTokens,
        dailyLoginDays: needsWalletBackfill ? 0 : existingData.dailyLoginDays,
        lastCheckInDate: needsWalletBackfill ? '' : existingData.lastCheckInDate,
        totalWithdrawnPkr: needsWalletBackfill ? 0 : existingData.totalWithdrawnPkr,
      };
    }

    const pendingDraft = getPendingProfileDraft(user.uid);
    const displayName = sanitizeString(
      pendingDraft?.displayName ||
        preferredName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'Mezone Shopper',
      MAX_DISPLAY_NAME
    );
    const email = sanitizeString(user.email || `${user.uid}@mezone.app`, MAX_EMAIL);
    const provider = detectProvider(user);
    const inviteCode = generateInviteCode(user.uid, displayName);
    const photoUrl = user.photoURL ? sanitizeString(user.photoURL, MAX_URL) : '';
    const draftPhone =
      pendingDraft?.phone && /^\+[1-9][0-9]{6,15}$/.test(pendingDraft.phone)
        ? sanitizeString(pendingDraft.phone, MAX_PHONE)
        : '';

    const newProfile = {
      uid: user.uid,
      displayName,
      email,
      phone: draftPhone,
      region: sanitizeString(pendingDraft?.region || 'Pakistan (PKR / USD)', MAX_REGION),
      provider,
      inviteCode,
      invitedByCode: '',
      photoUrl,
      birthDate: sanitizeString(pendingDraft?.birthDate || '', MAX_BIRTH_DATE),
      gender: (pendingDraft?.gender || '') as GenderOption,
      countryName: sanitizeString(pendingDraft?.countryName || 'Pakistan', MAX_COUNTRY_NAME),
      walletBalancePkr: ACCOUNT_CREATE_BONUS_PKR,
      accountBonusClaimed: true,
      profileBonusClaimed: false,
      buyTwoBonusClaimed: false,
      approvedProductsCount: 0,
      loginTokens: 0,
      dailyLoginDays: 0,
      lastCheckInDate: '',
      totalWithdrawnPkr: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    if (pendingDraft) {
      clearPendingProfileDraft(user.uid);
    }
    await ensureInviteCodeIndexed(inviteCode, user.uid);

    if (pendingCode) {
      await linkUserToInviteCode({
        inviteeUid: user.uid,
        inviteeName: displayName,
        inviteeEmail: email,
        inviterCodeRaw: pendingCode,
      });
    }

    return {
      ...newProfile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updatePersonalInformation(
  uid: string,
  payload: {
    displayName: string;
    phone: string;
    region: string;
    birthDate: string;
    gender: GenderOption;
    countryName: string;
  }
): Promise<void> {
  const displayName = sanitizeString(payload.displayName, MAX_DISPLAY_NAME);
  const phone = sanitizeString(payload.phone, MAX_PHONE);
  const region = sanitizeString(payload.region || 'Pakistan (PKR / USD)', MAX_REGION);
  const birthDate = sanitizeString(payload.birthDate || '', MAX_BIRTH_DATE);
  const gender: GenderOption = payload.gender || '';
  const countryName = sanitizeString(payload.countryName || '', MAX_COUNTRY_NAME);
  if (!displayName) return;

  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      displayName,
      phone,
      region,
      birthDate,
      gender,
      countryName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function claimCompleteProfileBonus(
  uid: string,
  profile: UserProfile
): Promise<{ ok: boolean; message: string }> {
  if (profile.profileBonusClaimed) {
    return { ok: false, message: 'Verify Account & Complete Profile 50 PKR bonus already claimed.' };
  }
  if ((profile.phone || '').trim().length < 7 || !profile.displayName.trim() || !profile.region.trim()) {
    return {
      ok: false,
      message: 'Please save your Full Name, Phone Number (min 7 digits), and Region in Personal Information first.',
    };
  }

  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      profileBonusClaimed: true,
      walletBalancePkr: Number(((profile.walletBalancePkr || 0) + PROFILE_COMPLETE_BONUS_PKR).toFixed(2)),
      updatedAt: serverTimestamp(),
    });
    return {
      ok: true,
      message: `Claimed +${PROFILE_COMPLETE_BONUS_PKR} PKR for Verify Account & Complete Profile!`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function collectDailyLoginToken(
  uid: string,
  profile: UserProfile
): Promise<{ ok: boolean; tokensAdded: number; message: string }> {
  const today = getTodayDateKey();
  if (profile.lastCheckInDate === today) {
    return {
      ok: false,
      tokensAdded: 0,
      message: 'Today’s daily login tokens are already collected. Come back tomorrow!',
    };
  }
  if ((profile.dailyLoginDays || 0) >= DAILY_TOKENS_CYCLE_DAYS) {
    return {
      ok: false,
      tokensAdded: 0,
      message: '30-day cycle complete! Claim your 1,000 tokens for 50 PKR first.',
    };
  }

  const nextDay = (profile.dailyLoginDays || 0) + 1;
  const tokensAdded = getDailyTokenAmountForDay(nextDay);
  const nextTokens = Math.min(DAILY_TOKENS_TARGET, (profile.loginTokens || 0) + tokensAdded);

  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      dailyLoginDays: nextDay,
      loginTokens: nextTokens,
      lastCheckInDate: today,
      updatedAt: serverTimestamp(),
    });
    return {
      ok: true,
      tokensAdded,
      message: `Day ${nextDay}/30 checked in! Collected +${tokensAdded} tokens (${nextTokens}/1,000).`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function claimDailyTokensToPkr(
  uid: string,
  profile: UserProfile
): Promise<{ ok: boolean; message: string }> {
  if ((profile.loginTokens || 0) < DAILY_TOKENS_TARGET) {
    return {
      ok: false,
      message: `Collect ${DAILY_TOKENS_TARGET - (profile.loginTokens || 0)} more tokens to claim 50 PKR.`,
    };
  }

  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      loginTokens: profile.loginTokens - DAILY_TOKENS_TARGET,
      dailyLoginDays: 0,
      walletBalancePkr: Number(((profile.walletBalancePkr || 0) + DAILY_TOKENS_CLAIM_PKR).toFixed(2)),
      updatedAt: serverTimestamp(),
    });
    return {
      ok: true,
      message: `Converted 1,000 daily login tokens into +${DAILY_TOKENS_CLAIM_PKR} PKR!`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function submitOrderProof(params: {
  uid: string;
  userName: string;
  userEmail: string;
  marketplace: MarketplaceType;
  productTitle: string;
  orderReference: string;
  quantity: number;
  proofNotes: string;
  proofAttachment: string;
}): Promise<string> {
  const proofId = `prf_${params.uid.slice(0, 10)}_${Date.now().toString(36)}`;
  const proofRef = doc(db, 'orderProofs', proofId);
  const clampedQty = Math.max(1, Math.min(10, Math.round(params.quantity)));
  const cleanedAttachment = params.proofAttachment.trim().slice(0, MAX_PROOF_ATTACHMENT);

  if (cleanedAttachment.length < 20) {
    throw new Error('Order receipt screenshot is required before submitting proof.');
  }

  try {
    await setDoc(proofRef, {
      userId: params.uid,
      userName: sanitizeString(params.userName || 'Mezone Shopper', MAX_DISPLAY_NAME),
      userEmail: sanitizeString(params.userEmail || '', MAX_EMAIL),
      marketplace: params.marketplace,
      productTitle: sanitizeString(params.productTitle, MAX_TITLE),
      orderReference: sanitizeString(params.orderReference, MAX_ORDER_REF),
      quantity: clampedQty,
      proofNotes: sanitizeString(params.proofNotes, MAX_PROOF_NOTES),
      proofAttachment: cleanedAttachment,
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return proofId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orderProofs/${proofId}`);
  }
}

export async function reviewOrderProofAsAdmin(params: {
  proof: OrderProofRecord;
  decision: 'approved' | 'rejected';
  adminNote?: string;
}): Promise<{ referralAcceptedNow: boolean; buyTwoBonusAwardedNow: boolean }> {
  const { proof, decision, adminNote = '' } = params;
  const proofRef = doc(db, 'orderProofs', proof.id);

  try {
    await updateDoc(proofRef, {
      status: decision,
      adminNote: sanitizeString(adminNote, MAX_ADMIN_NOTE),
      updatedAt: serverTimestamp(),
    });

    let referralAcceptedNow = false;
    let buyTwoBonusAwardedNow = false;

    if (decision === 'approved') {
      // 1. Update buyer's approved product count & award 300 PKR when reaching 2 bought products
      const buyerRef = doc(db, 'users', proof.userId);
      const buyerSnap = await getDoc(buyerRef);
      if (buyerSnap.exists()) {
        const buyerData = buyerSnap.data() as UserProfile;
        const currentApproved = buyerData.approvedProductsCount || 0;
        const nextApproved = currentApproved + proof.quantity;
        const shouldAwardBuyTwo = !buyerData.buyTwoBonusClaimed && nextApproved >= 2;

        const buyerUpdate: Record<string, unknown> = {
          approvedProductsCount: nextApproved,
          updatedAt: serverTimestamp(),
        };
        if (shouldAwardBuyTwo) {
          buyerUpdate.buyTwoBonusClaimed = true;
          buyerUpdate.walletBalancePkr = Number(
            ((buyerData.walletBalancePkr || 0) + BUY_TWO_PRODUCTS_BONUS_PKR).toFixed(2)
          );
          buyTwoBonusAwardedNow = true;
        }
        await updateDoc(buyerRef, buyerUpdate);
      }

      // 2. Update referral progress & award 500 PKR to inviter at 10 approved products
      const referralRef = doc(db, 'referrals', proof.userId);
      const referralSnap = await getDoc(referralRef);
      if (referralSnap.exists()) {
        const refData = referralSnap.data() as ReferralRecord;
        const nextCount = Math.min(1000, (refData.approvedProductCount || 0) + proof.quantity);
        const nextStatus = nextCount >= 10 ? 'accepted' : 'pending';
        await updateDoc(referralRef, {
          approvedProductCount: nextCount,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });

        if (refData.status !== 'accepted' && nextStatus === 'accepted') {
          referralAcceptedNow = true;
          const inviterRef = doc(db, 'users', refData.inviterUid);
          const inviterSnap = await getDoc(inviterRef);
          if (inviterSnap.exists()) {
            const inviterData = inviterSnap.data() as UserProfile;
            await updateDoc(inviterRef, {
              walletBalancePkr: Number(((inviterData.walletBalancePkr || 0) + 500).toFixed(2)),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }
    return { referralAcceptedNow, buyTwoBonusAwardedNow };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orderProofs/${proof.id}`);
  }
}

export async function submitWithdrawalRequest(params: {
  uid: string;
  userName: string;
  userEmail: string;
  bankName: string;
  holderName: string;
  cellNumber: string;
  amount: number;
  currentBalance: number;
  currentTotalWithdrawn: number;
}): Promise<string> {
  const { amount, taxPkr, feePkr, netAmountPkr } = calculateWithdrawalBreakdown(params.amount);
  if (amount < WITHDRAW_MIN_PKR) {
    throw new Error(`Minimum withdrawal amount is ${WITHDRAW_MIN_PKR.toLocaleString()} PKR.`);
  }
  if (amount > params.currentBalance) {
    throw new Error('Withdrawal amount exceeds your available PKR wallet balance.');
  }

  const withdrawalId = `wdr_${params.uid.slice(0, 10)}_${Date.now().toString(36)}`;
  const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
  const userRef = doc(db, 'users', params.uid);

  const batch = writeBatch(db);
  batch.update(userRef, {
    walletBalancePkr: Number((params.currentBalance - amount).toFixed(2)),
    totalWithdrawnPkr: Number((params.currentTotalWithdrawn + amount).toFixed(2)),
    updatedAt: serverTimestamp(),
  });
  batch.set(withdrawalRef, {
    userId: params.uid,
    userName: sanitizeString(params.userName || 'Mezone Shopper', MAX_DISPLAY_NAME),
    userEmail: sanitizeString(params.userEmail || '', MAX_EMAIL),
    bankName: sanitizeString(params.bankName, MAX_BANK_NAME),
    holderName: sanitizeString(params.holderName, MAX_DISPLAY_NAME),
    cellNumber: sanitizeString(params.cellNumber, MAX_PHONE),
    amount,
    taxPkr,
    feePkr,
    netAmountPkr,
    status: 'pending',
    adminNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${withdrawalId}`);
  }
}

export async function reviewWithdrawalAsAdmin(params: {
  withdrawal: WithdrawalRecord;
  decision: 'approved' | 'rejected';
  adminNote?: string;
}): Promise<void> {
  const { withdrawal, decision, adminNote = '' } = params;
  const withdrawalRef = doc(db, 'withdrawals', withdrawal.id);

  try {
    await updateDoc(withdrawalRef, {
      status: decision,
      adminNote: sanitizeString(adminNote, MAX_ADMIN_NOTE),
      updatedAt: serverTimestamp(),
    });

    if (decision === 'rejected') {
      const userRef = doc(db, 'users', withdrawal.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        await updateDoc(userRef, {
          walletBalancePkr: Number(((userData.walletBalancePkr || 0) + withdrawal.amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
  }
}

export async function toggleLikedProduct(params: {
  uid: string;
  product: AffiliateProduct;
  isCurrentlyLiked: boolean;
}): Promise<void> {
  const { uid, product, isCurrentlyLiked } = params;
  const docId = `${uid}_${product.id}`;
  const likedRef = doc(db, 'likedItems', docId);
  try {
    if (isCurrentlyLiked) {
      await deleteDoc(likedRef);
    } else {
      await setDoc(likedRef, {
        userId: uid,
        productId: product.id,
        title: sanitizeString(product.title, MAX_TITLE),
        marketplace: product.marketplace,
        category: sanitizeString(product.category, 60),
        price: Number(product.price),
        compareAtPrice: Number(product.compareAtPrice || 0),
        affiliateUrl: sanitizeString(product.affiliateUrl, MAX_URL),
        imageUrl: sanitizeString(product.imageUrl, MAX_URL),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCurrentlyLiked ? OperationType.DELETE : OperationType.CREATE,
      `likedItems/${docId}`
    );
  }
}

export async function removeLikedItemById(docId: string): Promise<void> {
  const likedRef = doc(db, 'likedItems', docId);
  try {
    await deleteDoc(likedRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `likedItems/${docId}`);
  }
}

export async function publishAffiliateProduct(params: {
  adminUid: string;
  productCode: string;
  title: string;
  marketplace: MarketplaceType;
  category: ProductCategory;
  price: number;
  compareAtPrice: number;
  affiliateUrl: string;
  imageUrl: string;
  description: string;
}): Promise<string> {
  const productId = `mz_${params.marketplace.toLowerCase()}_${Date.now().toString(36)}`;
  const prodRef = doc(db, 'products', productId);
  const cleanedCode =
    sanitizeProductCode(params.productCode) ||
    `MZ-${params.marketplace.slice(0, 2).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const { resolvedUrl } = resolveDriveImageUrl(params.imageUrl);

  try {
    await setDoc(prodRef, {
      productCode: cleanedCode,
      title: sanitizeString(params.title, MAX_TITLE),
      marketplace: params.marketplace,
      category: params.category,
      price: Number(Math.max(0.01, params.price).toFixed(2)),
      compareAtPrice: Number(Math.max(0, params.compareAtPrice).toFixed(2)),
      affiliateUrl: sanitizeString(params.affiliateUrl, MAX_URL),
      imageUrl: sanitizeString(resolvedUrl, MAX_URL),
      description: sanitizeString(params.description, MAX_DESC),
      published: true,
      createdBy: params.adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return productId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `products/${productId}`);
  }
}

export async function updatePublishedProduct(
  productId: string,
  params: {
    productCode: string;
    title: string;
    marketplace: MarketplaceType;
    category: ProductCategory;
    price: number;
    compareAtPrice: number;
    affiliateUrl: string;
    imageUrl: string;
    description: string;
    published: boolean;
  }
): Promise<void> {
  const prodRef = doc(db, 'products', productId);
  const cleanedCode = sanitizeProductCode(params.productCode) || 'MZ-EDIT';
  const { resolvedUrl } = resolveDriveImageUrl(params.imageUrl);

  try {
    await updateDoc(prodRef, {
      productCode: cleanedCode,
      title: sanitizeString(params.title, MAX_TITLE),
      marketplace: params.marketplace,
      category: params.category,
      price: Number(Math.max(0.01, params.price).toFixed(2)),
      compareAtPrice: Number(Math.max(0, params.compareAtPrice).toFixed(2)),
      affiliateUrl: sanitizeString(params.affiliateUrl, MAX_URL),
      imageUrl: sanitizeString(resolvedUrl, MAX_URL),
      description: sanitizeString(params.description, MAX_DESC),
      published: Boolean(params.published),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function toggleProductPublished(
  product: AffiliateProduct
): Promise<void> {
  const prodRef = doc(db, 'products', product.id);
  try {
    const updatePayload: Record<string, unknown> = {
      published: !product.published,
      updatedAt: serverTimestamp(),
    };
    if (!product.productCode) {
      updatePayload.productCode = sanitizeProductCode(product.id) || 'MZ-LEGACY';
    }
    await updateDoc(prodRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
  }
}

export async function deletePublishedProduct(productId: string): Promise<void> {
  const prodRef = doc(db, 'products', productId);
  try {
    await deleteDoc(prodRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function createSupportTicket(params: {
  uid: string;
  userName: string;
  userEmail: string;
  topic: SupportTopic;
  subject: string;
  message: string;
}): Promise<string> {
  const ticketId = `tkt_${params.uid.slice(0, 10)}_${Date.now().toString(36)}`;
  const ticketRef = doc(db, 'supportTickets', ticketId);
  const subject = sanitizeString(params.subject, MAX_TICKET_SUBJECT);
  const message = sanitizeString(params.message, MAX_TICKET_MESSAGE);

  if (subject.length < 3 || message.length < 5) {
    throw new Error('Enter a subject (min 3 characters) and detailed message (min 5 characters).');
  }

  try {
    await setDoc(ticketRef, {
      userId: params.uid,
      userName: sanitizeString(params.userName || 'Mezone Shopper', MAX_DISPLAY_NAME),
      userEmail: sanitizeString(params.userEmail || '', MAX_EMAIL),
      topic: params.topic,
      subject,
      message,
      status: 'open',
      adminReply: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ticketId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `supportTickets/${ticketId}`);
  }
}

export async function resolveSupportTicketAsAdmin(params: {
  ticketId: string;
  adminReply: string;
}): Promise<void> {
  const ticketRef = doc(db, 'supportTickets', params.ticketId);
  try {
    await updateDoc(ticketRef, {
      status: 'resolved',
      adminReply: sanitizeString(params.adminReply || 'Resolved by Mezone Support.', MAX_TICKET_REPLY),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `supportTickets/${params.ticketId}`);
  }
}

export const DEFAULT_TOP_BANNER_HTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 18px;border-radius:10px;background:linear-gradient(90deg,#111113 0%,#292524 60%,#9a3412 100%);color:#ffffff;font-family:system-ui,-apple-system,sans-serif;">
  <div style="display:flex;align-items:center;gap:12px;min-width:0;">
    <span style="padding:3px 8px;border-radius:6px;background:#ea580c;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.04em;white-space:nowrap;">SPONSORED</span>
    <div style="min-width:0;">
      <div style="font-size:13px;font-weight:700;line-height:1.25;">Mezone Official Temu &amp; Amazon Flash Deals</div>
      <div style="font-size:11px;color:#e7e5e4;opacity:0.9;">Verified affiliate savings · Edit this Banner HTML anytime in Admin Center → Banner Ads</div>
    </div>
  </div>
  <span style="padding:6px 12px;border-radius:8px;background:#ffffff;color:#111113;font-size:11px;font-weight:700;white-space:nowrap;">Hot Deals</span>
</div>`;

export const DEFAULT_BOTTOM_BANNER_HTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-radius:10px;border:1px solid rgba(234,88,12,0.28);background:linear-gradient(90deg,#fff7ed 0%,#ffedd5 100%);color:#111113;font-family:system-ui,-apple-system,sans-serif;">
  <div>
    <div style="font-size:13px;font-weight:700;color:#9a3412;">Invite Friends &amp; Earn 500 PKR Per Accepted Referral</div>
    <div style="font-size:11px;color:#57534e;margin-top:2px;">Shop curated Temu &amp; Amazon finds · Submit Order Proof · Withdraw from 1,000 PKR</div>
  </div>
  <span style="padding:6px 12px;border-radius:8px;background:#ea580c;color:#ffffff;font-size:11px;font-weight:700;white-space:nowrap;">500 PKR Bonus</span>
</div>`;

export const DEFAULT_SITE_BANNER_CONFIG: SiteBannerConfigRecord = {
  enabled: true,
  placementScope: 'all',
  topBannerHtml: DEFAULT_TOP_BANNER_HTML,
  bottomBannerHtml: DEFAULT_BOTTOM_BANNER_HTML,
};

export async function saveSiteBannerAdsConfig(params: {
  uid: string;
  enabled: boolean;
  placementScope: BannerPlacementScope;
  topBannerHtml: string;
  bottomBannerHtml: string;
}): Promise<void> {
  const bannerRef = doc(db, 'siteConfig', 'bannerAds');
  try {
    await setDoc(bannerRef, {
      enabled: Boolean(params.enabled),
      placementScope: params.placementScope,
      topBannerHtml: params.topBannerHtml.trim().slice(0, MAX_BANNER_HTML),
      bottomBannerHtml: params.bottomBannerHtml.trim().slice(0, MAX_BANNER_HTML),
      updatedBy: params.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'siteConfig/bannerAds');
  }
}

export async function submitHelpcenterFeedback(params: {
  uid: string;
  userName: string;
  rating: number;
  category: FeedbackCategory;
  comment: string;
}): Promise<string> {
  const feedbackId = `fb_${params.uid.slice(0, 10)}_${Date.now().toString(36)}`;
  const feedbackRef = doc(db, 'helpcenterFeedback', feedbackId);
  const clampedRating = Math.max(1, Math.min(5, Math.round(params.rating)));
  const comment = sanitizeString(params.comment, MAX_FEEDBACK_COMMENT);

  if (comment.length < 3) {
    throw new Error('Please write at least 3 characters of feedback.');
  }

  try {
    await setDoc(feedbackRef, {
      userId: params.uid,
      userName: sanitizeString(params.userName || 'Mezone Shopper', MAX_DISPLAY_NAME),
      rating: clampedRating,
      category: params.category,
      comment,
      published: true,
      adminReply: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return feedbackId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `helpcenterFeedback/${feedbackId}`);
  }
}

export async function reviewHelpcenterFeedbackAsAdmin(params: {
  feedbackId: string;
  published: boolean;
  adminReply: string;
}): Promise<void> {
  const feedbackRef = doc(db, 'helpcenterFeedback', params.feedbackId);
  try {
    await updateDoc(feedbackRef, {
      published: Boolean(params.published),
      adminReply: sanitizeString(params.adminReply, MAX_TICKET_REPLY),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `helpcenterFeedback/${params.feedbackId}`);
  }
}

export async function deleteHelpcenterFeedback(feedbackId: string): Promise<void> {
  const feedbackRef = doc(db, 'helpcenterFeedback', feedbackId);
  try {
    await deleteDoc(feedbackRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `helpcenterFeedback/${feedbackId}`);
  }
}

export async function deleteMezoneAccountData(
  uid: string,
  likedItems: LikedItemRecord[],
  inviteCode?: string,
  userEmail?: string | null
): Promise<void> {
  if ((userEmail || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Admin Center owner account is protected and cannot be deleted.');
  }

  for (const item of likedItems) {
    try {
      await deleteDoc(doc(db, 'likedItems', item.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `likedItems/${item.id}`);
    }
  }

  if (inviteCode) {
    try {
      await deleteDoc(doc(db, 'inviteCodes', inviteCode));
    } catch {
      // ignore if missing
    }
  }

  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}
