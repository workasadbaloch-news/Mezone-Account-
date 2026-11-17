export type RouteView = 'welcome' | 'register' | 'login' | 'workspace';

export type WorkspaceTab =
  | 'product'
  | 'history'
  | 'referral'
  | 'wallet'
  | 'chat'
  | 'verification'
  | 'helpcenter'
  | 'policy'
  | 'setting';

export type SettingSection =
  | 'personal'
  | 'verification'
  | 'linked'
  | 'wallet'
  | 'admin'
  | 'delete'
  | 'logout';

export type AdminCenterTab =
  | 'productCenter'
  | 'productManage'
  | 'requestCenter'
  | 'bannerAds'
  | 'adminSetting';

export type AuthProviderType = 'google' | 'apple' | 'facebook' | 'github' | 'yahoo' | 'email';

export type MarketplaceType = 'Temu' | 'Amazon';

export type GenderOption = '' | 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export type ProductCategory =
  | 'Tech & Audio'
  | 'Home & Living'
  | 'Travel & Carry'
  | 'Beauty & Care'
  | 'Everyday Deals';

export type SupportTopic =
  | 'Shopping & Products'
  | 'Order Proof Verification'
  | 'Referral Program'
  | 'Wallet & Withdraw'
  | 'Account Verification';

export type FeedbackCategory =
  | 'Shopping Experience'
  | 'Support Speed'
  | 'Rewards & Payouts'
  | 'App Design';

export type BannerPlacementScope = 'all' | 'workspace' | 'public';

export interface AffiliateProduct {
  id: string;
  productCode: string;
  title: string;
  marketplace: MarketplaceType;
  category: ProductCategory;
  price: number;
  compareAtPrice: number;
  affiliateUrl: string;
  imageUrl: string;
  imageFocusClass?: string;
  description: string;
  published: boolean;
  deleted?: boolean;
  isCuratedDefault?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CuratedCatalogOverride extends AffiliateProduct {
  deleted: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  region: string;
  provider: AuthProviderType;
  inviteCode: string;
  invitedByCode: string;
  verificationId?: string;
  photoUrl?: string;
  birthDate?: string;
  gender?: GenderOption;
  countryName?: string;
  address?: string;
  walletBalancePkr: number;
  accountBonusClaimed: boolean;
  profileBonusClaimed: boolean;
  buyTwoBonusClaimed: boolean;
  approvedProductsCount: number;
  loginTokens: number;
  dailyLoginDays: number;
  lastCheckInDate: string;
  totalWithdrawnPkr: number;
  dailyShoppingCount?: number;
  dailyShoppingEarnedPkr?: number;
  mailOtpVerified?: boolean;
  mailOtpVerifiedAt?: string;
  lastDailyAdminGrantDate?: string;
  walletPinHash?: string;
  walletPinUpdatedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReferralRecord {
  id: string;
  inviteeUid: string;
  inviteeName: string;
  inviteeEmail?: string;
  inviterUid: string;
  inviterCode: string;
  inviterName?: string;
  approvedProductCount: number;
  requiredProductCount: number;
  rewardPkr: number;
  status: 'pending' | 'accepted';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bankName: string;
  holderName: string;
  cellNumber: string;
  amount: number;
  taxPkr: number;
  feePkr: number;
  netAmountPkr: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderProofRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  marketplace: MarketplaceType;
  productTitle: string;
  orderReference: string;
  quantity: number;
  proofNotes: string;
  proofAttachment: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LikedItemRecord {
  id: string;
  userId: string;
  productId: string;
  title: string;
  marketplace: MarketplaceType;
  category: string;
  price: number;
  compareAtPrice: number;
  affiliateUrl: string;
  imageUrl: string;
  createdAt?: unknown;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  topic: SupportTopic;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  adminReply: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HelpcenterFeedbackRecord {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  category: FeedbackCategory;
  comment: string;
  published: boolean;
  adminReply: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SiteBannerConfigRecord {
  enabled: boolean;
  placementScope: BannerPlacementScope;
  topBannerHtml: string;
  bottomBannerHtml: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface DailyShoppingTrackRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  marketplace: MarketplaceType;
  productTitle: string;
  productCode: string;
  orderReference: string;
  trackDate: string;
  proofNotes: string;
  proofAttachment: string;
  rewardPkr: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
