import { FormEvent, useEffect, useState } from 'react';
import {
  linkWithPopup,
  reauthenticateWithPopup,
  unlink,
  User,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Maximize2,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { CURATED_PRODUCTS, PRESET_STUDIO_IMAGES } from '../data/catalog';
import { BannerAdSlot, useBannerAds } from '../lib/bannerAds';
import {
  appleProvider,
  facebookProvider,
  githubProvider,
  googleProvider,
  yahooProvider,
} from '../lib/firebase';
import {
  changeAdminLoginPin,
  DEFAULT_BOTTOM_BANNER_HTML,
  DEFAULT_TOP_BANNER_HTML,
  deleteCuratedCatalogItem,
  deleteHelpcenterFeedback,
  deletePublishedProduct,
  extractGoogleDriveFileId,
  OFFICIAL_INVITE_CODE,
  OFFICIAL_INVITER_NAME,
  publishAffiliateProduct,
  resolveDriveImageUrl,
  resolveSupportTicketAsAdmin,
  restoreCuratedCatalogItem,
  reviewHelpcenterFeedbackAsAdmin,
  reviewOrderProofAsAdmin,
  reviewWithdrawalAsAdmin,
  sanitizeProductCode,
  saveCuratedCatalogItem,
  saveSiteBannerAdsConfig,
  toggleCuratedCatalogVisibility,
  toggleProductPublished,
  updatePublishedProduct,
  verifyAdminConfirmPin,
} from '../lib/mezoneDb';
import {
  AdminCenterTab,
  AffiliateProduct,
  BannerPlacementScope,
  CuratedCatalogOverride,
  HelpcenterFeedbackRecord,
  MarketplaceType,
  OrderProofRecord,
  ProductCategory,
  ReferralRecord,
  SupportTicketRecord,
  WithdrawalRecord,
} from '../types/mezone';
import { GmailOtpSection } from './GmailOtpSection';
import { SafeImage } from './SafeImage';

interface AdminCenterSectionProps {
  user: User;
  publishedProducts: AffiliateProduct[];
  curatedOverrides?: CuratedCatalogOverride[];
  adminOrderProofs: OrderProofRecord[];
  adminAllReferrals: ReferralRecord[];
  adminWithdrawals: WithdrawalRecord[];
  adminSupportTickets: SupportTicketRecord[];
  adminFeedbackList: HelpcenterFeedbackRecord[];
  categories: Array<'All' | ProductCategory>;
  unlockedByPin?: boolean;
  onPinUnlocked?: () => void;
  onLockPin?: () => void;
  onFlashStatus: (message: string) => void;
  onLogout: () => Promise<void>;
}

function isProductRecentlyAdded(createdAt: unknown): boolean {
  if (!createdAt) return true;
  let ms = 0;
  if (createdAt instanceof Date) {
    ms = createdAt.getTime();
  } else if (typeof createdAt === 'string') {
    ms = new Date(createdAt).getTime();
  } else if (typeof createdAt === 'object') {
    const maybe = createdAt as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') {
      ms = maybe.toMillis();
    } else if (typeof maybe.seconds === 'number') {
      ms = maybe.seconds * 1000;
    }
  }
  if (!ms || Number.isNaN(ms)) return true;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - ms <= sevenDaysMs;
}

export function AdminCenterSection({
  user,
  publishedProducts,
  curatedOverrides = [],
  adminOrderProofs,
  adminAllReferrals,
  adminWithdrawals,
  adminSupportTickets,
  adminFeedbackList,
  categories,
  unlockedByPin,
  onPinUnlocked,
  onLockPin,
  onFlashStatus,
  onLogout,
}: AdminCenterSectionProps) {
  const { bannerConfig } = useBannerAds();

  const [localUnlockedByPin, setLocalUnlockedByPin] = useState(false);
  const adminUnlockedByPin =
    unlockedByPin !== undefined ? unlockedByPin : localUnlockedByPin;
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinBusy, setAdminPinBusy] = useState(false);
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  const [adminTab, setAdminTab] = useState<AdminCenterTab>('productCenter');
  const [requestSubView, setRequestSubView] = useState<
    'withdraw' | 'proofs' | 'referrals' | 'tickets' | 'feedback'
  >('withdraw');
  const [withdrawFilter, setWithdrawFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [refSearch, setRefSearch] = useState('');
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});
  const [feedbackReplies, setFeedbackReplies] = useState<Record<string, string>>({});

  // Banner Ads HTML Editor state
  const [adEnabled, setAdEnabled] = useState(bannerConfig.enabled);
  const [adScope, setAdScope] = useState<BannerPlacementScope>(bannerConfig.placementScope);
  const [adTopHtml, setAdTopHtml] = useState(bannerConfig.topBannerHtml);
  const [adBottomHtml, setAdBottomHtml] = useState(bannerConfig.bottomBannerHtml);
  const [savingBannerAds, setSavingBannerAds] = useState(false);

  useEffect(() => {
    setAdEnabled(bannerConfig.enabled);
    setAdScope(bannerConfig.placementScope);
    setAdTopHtml(bannerConfig.topBannerHtml);
    setAdBottomHtml(bannerConfig.bottomBannerHtml);
  }, [
    bannerConfig.enabled,
    bannerConfig.placementScope,
    bannerConfig.topBannerHtml,
    bannerConfig.bottomBannerHtml,
  ]);

  // Product Center (Create Form)
  const [newTitle, setNewTitle] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  const [newMarketplace, setNewMarketplace] = useState<MarketplaceType>('Temu');
  const [newCategory, setNewCategory] = useState<ProductCategory>('Tech & Audio');
  const [newPrice, setNewPrice] = useState('29.90');
  const [newComparePrice, setNewComparePrice] = useState('49.00');
  const [newAffiliateUrl, setNewAffiliateUrl] = useState('https://www.temu.com/');
  const [newImageUrl, setNewImageUrl] = useState(PRESET_STUDIO_IMAGES[0].url);
  const [driveFetchStatus, setDriveFetchStatus] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Product Manage (Search, Draft/New/Published Filter, Edit & Delete)
  const [manageSearch, setManageSearch] = useState('');
  const [manageFilter, setManageFilter] = useState<'all' | 'draft' | 'new' | 'published'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProductCode, setEditProductCode] = useState('');
  const [editMarketplace, setEditMarketplace] = useState<MarketplaceType>('Temu');
  const [editCategory, setEditCategory] = useState<ProductCategory>('Tech & Audio');
  const [editPrice, setEditPrice] = useState('0');
  const [editComparePrice, setEditComparePrice] = useState('0');
  const [editAffiliateUrl, setEditAffiliateUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [editDriveStatus, setEditDriveStatus] = useState<string | null>(null);
  const [imageLightbox, setImageLightbox] = useState<{
    src: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Admin Setting: Connect Social Login, Change Login PIN, Change Mail, Logout
  const [socialBusy, setSocialBusy] = useState<
    'google' | 'apple' | 'facebook' | 'github' | 'yahoo' | null
  >(null);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeBusy, setPinChangeBusy] = useState(false);
  const [pinChangeMessage, setPinChangeMessage] = useState<string | null>(null);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [emailChangeBusy, setEmailChangeBusy] = useState(false);
  const [emailChangeMessage, setEmailChangeMessage] = useState<string | null>(null);

  const selectableCategories = categories.filter(
    (c): c is ProductCategory => c !== 'All'
  );

  const pendingWithdrawCount = adminWithdrawals.filter((w) => w.status === 'pending').length;
  const pendingProofCount = adminOrderProofs.filter((p) => p.status === 'pending').length;
  const openTicketCount = adminSupportTickets.filter((t) => t.status === 'open').length;

  const draftProductsCount = publishedProducts.filter((p) => !p.published).length;
  const liveProductsCount = publishedProducts.filter((p) => p.published).length;
  const newProductsCount = publishedProducts.filter((p) =>
    isProductRecentlyAdded(p.createdAt)
  ).length;

  const curatedOverrideMap = new Map(curatedOverrides.map((c) => [c.id, c]));
  const mergedCuratedCatalog = CURATED_PRODUCTS.map((starter) => {
    const override = curatedOverrideMap.get(starter.id);
    if (!override) {
      return { ...starter, deleted: false, isCuratedDefault: true };
    }
    return {
      ...starter,
      ...override,
      id: starter.id,
      isCuratedDefault: true,
      deleted: Boolean(override.deleted),
    };
  });
  const activeCuratedCatalog = mergedCuratedCatalog.filter((item) => !item.deleted);
  const deletedCuratedCatalog = mergedCuratedCatalog.filter((item) => item.deleted);
  const visibleCuratedCount = activeCuratedCatalog.filter((item) => item.published).length;
  const hiddenCuratedCount = activeCuratedCatalog.filter((item) => !item.published).length;

  const filteredManageProducts = publishedProducts.filter((p) => {
    if (manageFilter === 'draft' && p.published) return false;
    if (manageFilter === 'published' && !p.published) return false;
    if (manageFilter === 'new' && !isProductRecentlyAdded(p.createdAt)) return false;

    const q = manageSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.productCode || '').toLowerCase().includes(q) ||
      p.marketplace.toLowerCase().includes(q)
    );
  });

  const filteredWithdrawals = adminWithdrawals.filter((w) =>
    withdrawFilter === 'all' ? true : w.status === withdrawFilter
  );

  const hasGoogleLinked = user.providerData.some((p) => p.providerId === 'google.com');
  const hasAppleLinked = user.providerData.some((p) => p.providerId === 'apple.com');
  const hasFacebookLinked = user.providerData.some((p) => p.providerId === 'facebook.com');
  const hasGithubLinked = user.providerData.some((p) => p.providerId === 'github.com');
  const hasYahooLinked = user.providerData.some((p) => p.providerId === 'yahoo.com');

  const handleUnlockPin = async (e: FormEvent) => {
    e.preventDefault();
    setAdminPinError(null);
    setAdminPinBusy(true);
    try {
      const valid = await verifyAdminConfirmPin(adminPinInput);
      setAdminPinInput('');
      if (valid) {
        setLocalUnlockedByPin(true);
        onPinUnlocked?.();
        onFlashStatus('Admin Account unlocked in Admin Center.');
      } else {
        setAdminPinError('Incorrect confirmation PIN. Access denied.');
      }
    } finally {
      setAdminPinBusy(false);
    }
  };

  const handleFetchDriveImage = (rawUrl?: string) => {
    const targetUrl = (rawUrl ?? newImageUrl).trim();
    if (!targetUrl) {
      setDriveFetchStatus('Paste a Google Drive file link or direct image URL first.');
      return;
    }
    const { resolvedUrl, isDrive, fileId } = resolveDriveImageUrl(targetUrl);
    setNewImageUrl(resolvedUrl);

    if (isDrive && fileId) {
      setDriveFetchStatus(
        `Resolved Google Drive image (ID: ${fileId}) — live preview ready.`
      );
      onFlashStatus('Google Drive image URL resolved and ready for preview.');
    } else {
      setDriveFetchStatus('Using direct image URL.');
    }
  };

  const handleFetchEditDriveImage = (rawUrl?: string) => {
    const targetUrl = (rawUrl ?? editImageUrl).trim();
    if (!targetUrl) {
      setEditDriveStatus('Paste a Google Drive file link or direct image URL first.');
      return;
    }
    const { resolvedUrl, isDrive, fileId } = resolveDriveImageUrl(targetUrl);
    setEditImageUrl(resolvedUrl);

    if (isDrive && fileId) {
      setEditDriveStatus(`Resolved Google Drive image (ID: ${fileId}).`);
    } else {
      setEditDriveStatus('Using direct image URL.');
    }
  };

  const handleCreateProduct = async (publishNow: boolean) => {
    const cleanedCode = sanitizeProductCode(newProductCode);
    if (
      !newTitle.trim() ||
      !cleanedCode ||
      cleanedCode.length < 2 ||
      !newImageUrl.trim() ||
      !newAffiliateUrl.trim() ||
      !newDescription.trim()
    ) {
      onFlashStatus(
        'Complete Product Name, Product Code (min 2 chars), Image URL, Affiliate Link, and Description.'
      );
      return;
    }
    if (!newAffiliateUrl.trim().startsWith('https://')) {
      onFlashStatus('Affiliate Link must start with https://');
      return;
    }

    const { resolvedUrl } = resolveDriveImageUrl(newImageUrl);

    setPublishing(true);
    try {
      await publishAffiliateProduct({
        adminUid: user.uid,
        productCode: cleanedCode,
        title: newTitle,
        marketplace: newMarketplace,
        category: newCategory,
        price: Number(newPrice) || 19.99,
        compareAtPrice: Number(newComparePrice) || 0,
        affiliateUrl: newAffiliateUrl,
        imageUrl: resolvedUrl,
        description: newDescription,
        published: publishNow,
      });
      const savedTitle = newTitle;
      setNewTitle('');
      setNewProductCode('');
      setNewDescription('');
      setDriveFetchStatus(null);
      setNewAffiliateUrl(
        newMarketplace === 'Temu' ? 'https://www.temu.com/' : 'https://www.amazon.com/'
      );
      if (publishNow) {
        onFlashStatus(`Published "${savedTitle}" (${cleanedCode}) live to Mezone storefront.`);
      } else {
        setAdminTab('productManage');
        setManageFilter('draft');
        onFlashStatus(`Saved "${savedTitle}" (${cleanedCode}) to Product Manage Drafts.`);
      }
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishProduct = async (e: FormEvent) => {
    e.preventDefault();
    await handleCreateProduct(true);
  };

  const openEditProduct = (product: AffiliateProduct) => {
    setEditingProduct(product);
    setEditTitle(product.title);
    setEditProductCode(product.productCode || sanitizeProductCode(product.id));
    setEditMarketplace(product.marketplace);
    setEditCategory(product.category);
    setEditPrice(String(product.price));
    setEditComparePrice(String(product.compareAtPrice || 0));
    setEditAffiliateUrl(product.affiliateUrl);
    setEditImageUrl(product.imageUrl);
    setEditDescription(product.description);
    setEditPublished(product.published);
    setEditDriveStatus(null);
    window.setTimeout(() => {
      document
        .getElementById('admin-edit-product-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleSaveEditedProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const cleanedCode = sanitizeProductCode(editProductCode);
    if (
      !editTitle.trim() ||
      !cleanedCode ||
      cleanedCode.length < 2 ||
      !editImageUrl.trim() ||
      !editAffiliateUrl.trim() ||
      !editDescription.trim()
    ) {
      onFlashStatus(
        'Complete Product Name, Product Code (min 2 chars), Image URL, Affiliate Link, and Description.'
      );
      return;
    }
    if (!editAffiliateUrl.trim().startsWith('https://')) {
      onFlashStatus('Affiliate Link must start with https://');
      return;
    }

    setSavingEdit(true);
    try {
      if (editingProduct.isCuratedDefault) {
        await saveCuratedCatalogItem({
          adminUid: user.uid,
          productId: editingProduct.id,
          productCode: cleanedCode,
          title: editTitle,
          marketplace: editMarketplace,
          category: editCategory,
          price: Number(editPrice) || 1,
          compareAtPrice: Number(editComparePrice) || 0,
          affiliateUrl: editAffiliateUrl,
          imageUrl: editImageUrl,
          imageFocusClass: editingProduct.imageFocusClass,
          description: editDescription,
          published: editPublished,
          deleted: false,
        });
        onFlashStatus(`Updated Default Curated product "${editTitle}" (${cleanedCode}).`);
      } else {
        await updatePublishedProduct(editingProduct.id, {
          productCode: cleanedCode,
          title: editTitle,
          marketplace: editMarketplace,
          category: editCategory,
          price: Number(editPrice) || 1,
          compareAtPrice: Number(editComparePrice) || 0,
          affiliateUrl: editAffiliateUrl,
          imageUrl: editImageUrl,
          description: editDescription,
          published: editPublished,
        });
        onFlashStatus(`Updated "${editTitle}" (${cleanedCode}).`);
      }
      setEditingProduct(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteProduct = async (product: AffiliateProduct) => {
    if (product.isCuratedDefault) {
      await deleteCuratedCatalogItem(user.uid, product);
    } else {
      await deletePublishedProduct(product.id);
    }
    if (editingProduct?.id === product.id) {
      setEditingProduct(null);
    }
    setConfirmDeleteId(null);
    onFlashStatus(`Deleted "${product.title}" from Mezone catalog.`);
  };

  const handleToggleCuratedVisibility = async (item: AffiliateProduct) => {
    await toggleCuratedCatalogVisibility(user.uid, item);
    onFlashStatus(
      item.published
        ? `Hidden "${item.title}" from shopper storefront.`
        : `Unhidden "${item.title}" — now visible on storefront.`
    );
  };

  const handleRestoreCuratedItem = async (item: AffiliateProduct) => {
    await restoreCuratedCatalogItem(user.uid, item);
    onFlashStatus(`Restored "${item.title}" to Default Curated Catalog & Storefront.`);
  };

  const handleCloneStarterToForm = (starter: AffiliateProduct) => {
    setNewTitle(starter.title);
    setNewProductCode(`${starter.productCode}-NEW`);
    setNewMarketplace(starter.marketplace);
    setNewCategory(starter.category);
    setNewPrice(String(starter.price));
    setNewComparePrice(String(starter.compareAtPrice));
    setNewAffiliateUrl(starter.affiliateUrl);
    setNewImageUrl(starter.imageUrl);
    setNewDescription(starter.description);
    setAdminTab('productCenter');
    onFlashStatus(`Loaded "${starter.title}" into New Product / Draft form.`);
  };

  const handleSaveCuratedAsDraft = async (starter: AffiliateProduct) => {
    const draftCode = sanitizeProductCode(
      `${starter.productCode}-DRF-${Date.now().toString(36).slice(-3)}`
    );
    await publishAffiliateProduct({
      adminUid: user.uid,
      productCode: draftCode,
      title: `${starter.title} (Draft)`,
      marketplace: starter.marketplace,
      category: starter.category,
      price: starter.price,
      compareAtPrice: starter.compareAtPrice,
      affiliateUrl: starter.affiliateUrl,
      imageUrl: starter.imageUrl,
      description: starter.description,
      published: false,
    });
    setManageFilter('draft');
    onFlashStatus(`Saved "${starter.title}" as a Draft in Product Manage.`);
  };

  const handleReviewProof = async (
    proof: OrderProofRecord,
    decision: 'approved' | 'rejected'
  ) => {
    const res = await reviewOrderProofAsAdmin({
      proof,
      decision,
      adminNote:
        decision === 'approved'
          ? 'Order proof verified by Admin.'
          : 'Order details could not be verified.',
    });
    if (res.referralAcceptedNow && res.buyTwoBonusAwardedNow) {
      onFlashStatus(
        `Order approved! ${proof.userName} unlocked Buy-2 Bonus (+300 PKR) & Referral Accepted (+500 PKR).`
      );
    } else if (res.referralAcceptedNow) {
      onFlashStatus(
        `Order approved! ${proof.userName} reached 10 products — Referral Accepted (+500 PKR credited).`
      );
    } else if (res.buyTwoBonusAwardedNow) {
      onFlashStatus(
        `Order approved! ${proof.userName} reached 2 bought products — +300 PKR bonus credited.`
      );
    } else {
      onFlashStatus(`Order proof marked as ${decision}.`);
    }
  };

  const handleReviewWithdrawal = async (
    withdrawal: WithdrawalRecord,
    decision: 'approved' | 'rejected'
  ) => {
    await reviewWithdrawalAsAdmin({
      withdrawal,
      decision,
      adminNote:
        decision === 'approved'
          ? 'Payout approved by Admin.'
          : 'Withdrawal rejected and PKR refunded to wallet.',
    });
    onFlashStatus(
      decision === 'approved'
        ? `Withdrawal approved for ${withdrawal.userName} (${withdrawal.netAmountPkr.toLocaleString()} PKR net).`
        : `Withdrawal rejected and ${withdrawal.amount.toLocaleString()} PKR refunded to ${withdrawal.userName}.`
    );
  };

  const handleToggleSocialProvider = async (
    target: 'google' | 'apple' | 'facebook' | 'github' | 'yahoo'
  ) => {
    setSocialMessage(null);
    setSocialBusy(target);
    try {
      if (target === 'google') {
        if (hasGoogleLinked) {
          await reauthenticateWithPopup(user, googleProvider);
          setSocialMessage('Primary Google Login confirmed with Firebase Auth.');
          return;
        }
        await linkWithPopup(user, googleProvider);
        setSocialMessage('Google Social Login connected to your account.');
      } else {
        const map = {
          apple: { linked: hasAppleLinked, provider: appleProvider, id: 'apple.com', label: 'Apple' },
          facebook: { linked: hasFacebookLinked, provider: facebookProvider, id: 'facebook.com', label: 'Facebook' },
          github: { linked: hasGithubLinked, provider: githubProvider, id: 'github.com', label: 'GitHub' },
          yahoo: { linked: hasYahooLinked, provider: yahooProvider, id: 'yahoo.com', label: 'Yahoo' },
        } as const;
        const cfg = map[target];
        if (cfg.linked) {
          if (user.providerData.length <= 1) {
            setSocialMessage('Cannot disconnect your only sign-in method.');
            return;
          }
          await unlink(user, cfg.id);
          setSocialMessage(`${cfg.label} Social Login disconnected.`);
        } else {
          await linkWithPopup(user, cfg.provider);
          setSocialMessage(`${cfg.label} Social Login connected to your account.`);
        }
      }
      await user.reload();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/credential-already-in-use') {
        setSocialMessage('That social account is already linked to another Mezone profile.');
      } else if (code === 'auth/operation-not-allowed') {
        setSocialMessage(
          'Enable this provider in Firebase Console Authentication Sign-in methods first.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setSocialMessage('Social connection popup was closed before completing.');
      } else {
        setSocialMessage(
          err instanceof Error ? err.message : 'Unable to update social login connection.'
        );
      }
    } finally {
      setSocialBusy(null);
    }
  };

  const handleSaveBannerAds = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBannerAds(true);
    try {
      await saveSiteBannerAdsConfig({
        uid: user.uid,
        enabled: adEnabled,
        placementScope: adScope,
        topBannerHtml: adTopHtml,
        bottomBannerHtml: adBottomHtml,
      });
      onFlashStatus('Banner Ads HTML updated and published across Mezone pages.');
    } finally {
      setSavingBannerAds(false);
    }
  };

  const handleChangeLoginPin = async (e: FormEvent) => {
    e.preventDefault();
    setPinChangeMessage(null);
    if (newPin.trim() !== confirmNewPin.trim()) {
      setPinChangeMessage('New Login PIN and confirmation PIN do not match.');
      return;
    }
    setPinChangeBusy(true);
    try {
      const res = await changeAdminLoginPin({
        uid: user.uid,
        currentPin,
        newPin,
      });
      setPinChangeMessage(res.message);
      if (res.ok) {
        setCurrentPin('');
        setNewPin('');
        setConfirmNewPin('');
        onFlashStatus('Admin Login PIN updated successfully.');
      }
    } finally {
      setPinChangeBusy(false);
    }
  };

  const handleChangeAdminMail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailChangeMessage(null);
    const trimmed = newAdminEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailChangeMessage('Enter a valid new email address.');
      return;
    }
    if (trimmed.toLowerCase() === (user.email || '').toLowerCase()) {
      setEmailChangeMessage('New email address matches your current email.');
      return;
    }
    setEmailChangeBusy(true);
    try {
      try {
        await verifyBeforeUpdateEmail(user, trimmed);
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/requires-recent-login') {
          await reauthenticateWithPopup(user, googleProvider);
          await verifyBeforeUpdateEmail(user, trimmed);
        } else {
          throw err;
        }
      }
      setEmailChangeMessage(
        `Verification link sent to ${trimmed}. Open the link in your inbox to complete the email update.`
      );
      setNewAdminEmail('');
      onFlashStatus(`Email verification link sent to ${trimmed}.`);
    } catch (err) {
      setEmailChangeMessage(
        err instanceof Error ? err.message : 'Could not send email change verification.'
      );
    } finally {
      setEmailChangeBusy(false);
    }
  };

  if (!adminUnlockedByPin) {
    return (
      <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="pb-4 border-b border-black/10">
          <h1 className="font-display text-xl font-bold text-[#111113]">
            Admin Center · Confirm PIN
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Signed in via Google ({user.email}). Enter your hidden Admin confirmation PIN to
            unlock Product Center, Product Manage, Request Center, and Setting.
          </p>
        </div>

        {adminPinError && (
          <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412] leading-relaxed">
            {adminPinError}
          </div>
        )}

        <form onSubmit={handleUnlockPin} className="space-y-4 max-w-sm">
          <div>
            <label
              htmlFor="admin-confirm-pin"
              className="block text-xs font-medium text-[#111113] mb-1.5"
            >
              Confirm PIN
            </label>
            <input
              id="admin-confirm-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113] tracking-widest"
            />
          </div>

          <button
            type="submit"
            disabled={adminPinBusy}
            className="h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
          >
            {adminPinBusy ? 'Checking...' : 'Confirm PIN & Unlock'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Center Header + Admin Account Open Banner + Section Switcher */}
      <div className="bg-white border border-black/10 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-[#EFECE5] border border-black/10 shrink-0 flex items-center justify-center">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Admin Account'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-sm font-bold text-[#111113]">AD</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Account Open</span>
                </span>
                <span className="text-[11px] font-mono text-[#57534E]">
                  · {OFFICIAL_INVITE_CODE}
                </span>
              </div>
              <h1 className="font-display text-xl font-bold text-[#111113] truncate">
                {user.displayName || 'Mezone Admin'} · Operations Console
              </h1>
              <p className="text-xs text-[#57534E] truncate">
                {user.email} · UID: <span className="font-mono">{user.uid}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setLocalUnlockedByPin(false);
                onLockPin?.();
                onFlashStatus('Admin Center locked.');
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#FAF9F6] border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Lock PIN</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-black/15 text-xs font-semibold text-[#9A3412] rounded-lg hover:bg-[#FFF7ED] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#EFECE5] rounded-lg w-fit">
          {(
            [
              ['productCenter', 'New Product / Draft'],
              ['productManage', `All Manage Product (${publishedProducts.length})`],
              [
                'requestCenter',
                `Request Center (${pendingWithdrawCount + pendingProofCount + openTicketCount})`,
              ],
              ['bannerAds', 'Banner Ads'],
              ['adminSetting', 'Setting'],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setAdminTab(tabKey)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                adminTab === tabKey
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. PRODUCT CENTER: Product Form */}
      {adminTab === 'productCenter' && (
        <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="pb-4 border-b border-black/10">
            <p className="text-xs font-medium text-[#C2410C] mb-1">Product Center</p>
            <h2 className="font-display text-xl font-bold text-[#111113]">
              Publish Temu or Amazon Affiliate Product
            </h2>
          </div>

          <form onSubmit={handlePublishProduct} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pub-title"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Product Name
                </label>
                <input
                  id="pub-title"
                  type="text"
                  required
                  maxLength={140}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. EchoGlow Magnetic Charging Stand"
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="pub-code"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Product Code
                </label>
                <input
                  id="pub-code"
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={newProductCode}
                  onChange={(e) => setNewProductCode(sanitizeProductCode(e.target.value))}
                  placeholder="e.g. MZ-TM-205"
                  className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pub-market"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Marketplace
                </label>
                <select
                  id="pub-market"
                  value={newMarketplace}
                  onChange={(e) => setNewMarketplace(e.target.value as MarketplaceType)}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                >
                  <option value="Temu">Temu</option>
                  <option value="Amazon">Amazon</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pub-cat"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Category
                </label>
                <select
                  id="pub-cat"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ProductCategory)}
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                >
                  {selectableCategories.map((c) => (
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
                  htmlFor="pub-price"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Sell Price ($)
                </label>
                <input
                  id="pub-price"
                  type="number"
                  step="0.01"
                  min="0.50"
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="pub-compare"
                  className="block text-xs font-medium text-[#111113] mb-1.5"
                >
                  Original Price ($)
                </label>
                <input
                  id="pub-compare"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newComparePrice}
                  onChange={(e) => setNewComparePrice(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="pub-image-url"
                  className="text-xs font-medium text-[#111113]"
                >
                  Product Image Url (Google Drive Picker, URL Fetch, or Direct URL)
                </label>
                <select
                  aria-label="Studio Image Preset Quick Fill"
                  value={
                    PRESET_STUDIO_IMAGES.some((p) => p.url === newImageUrl) ? newImageUrl : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewImageUrl(e.target.value);
                      setDriveFetchStatus('Loaded Studio Image Preset.');
                    }
                  }}
                  className="h-8 px-2.5 text-xs bg-white border border-black/15 rounded-md text-[#111113]"
                >
                  <option value="">Studio Image Preset...</option>
                  {PRESET_STUDIO_IMAGES.map((img) => (
                    <option key={img.url} value={img.url}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="pub-image-url"
                  type="text"
                  required
                  maxLength={500}
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted.includes('drive.google.com')) {
                      e.preventDefault();
                      handleFetchDriveImage(pasted);
                    }
                  }}
                  placeholder="Paste Google Drive public link or direct image URL"
                  className="flex-1 h-10 px-3 text-sm font-mono bg-white border border-black/15 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => handleFetchDriveImage()}
                  className="h-10 px-3.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Convert Drive URL</span>
                </button>
              </div>

              {driveFetchStatus && (
                <p className="text-[11px] text-[#57534E]">{driveFetchStatus}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setImageLightbox({
                        src: resolveDriveImageUrl(newImageUrl).resolvedUrl,
                        title: newTitle || 'Product Image Preview',
                        subtitle: extractGoogleDriveFileId(newImageUrl)
                          ? `Google Drive File ID: ${extractGoogleDriveFileId(newImageUrl)}`
                          : undefined,
                      })
                    }
                    className="w-24 h-20 rounded-lg overflow-hidden bg-[#EFECE5] border border-black/10 shrink-0 cursor-pointer hover:opacity-90"
                    title="Click to view full image"
                  >
                    <SafeImage
                      src={resolveDriveImageUrl(newImageUrl).resolvedUrl}
                      alt={newTitle || 'Product image preview'}
                      fallbackTitle="Preview"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-[#111113] truncate">
                      Live Image Preview
                    </p>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Paste a direct product image URL or public Google Drive share link and click Convert Drive URL.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setImageLightbox({
                      src: resolveDriveImageUrl(newImageUrl).resolvedUrl,
                      title: newTitle || 'Product Image Preview',
                      subtitle: extractGoogleDriveFileId(newImageUrl)
                        ? `Google Drive File ID: ${extractGoogleDriveFileId(newImageUrl)}`
                        : undefined,
                    })
                  }
                  className="h-8 px-3 bg-white border border-black/15 rounded-lg text-xs font-semibold text-[#111113] hover:bg-[#EFECE5] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>See Image</span>
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="pub-url"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Affiliate Link (Shop Now URL)
              </label>
              <input
                id="pub-url"
                type="url"
                required
                maxLength={500}
                value={newAffiliateUrl}
                onChange={(e) => setNewAffiliateUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/... or https://www.temu.com/..."
                className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="pub-desc"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Product Description
              </label>
              <textarea
                id="pub-desc"
                required
                rows={3}
                maxLength={600}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Key specifications and highlights for Mezone shoppers..."
                className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={publishing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{publishing ? 'Saving...' : 'Publish New Product'}</span>
              </button>

              <button
                type="button"
                disabled={publishing}
                onClick={() => handleCreateProduct(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{publishing ? 'Saving...' : 'Save as Draft'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. PRODUCT MANAGE: Edit & Delete Products */}
      {adminTab === 'productManage' && (
        <div className="space-y-6">
          {editingProduct && (
            <div
              id="admin-edit-product-panel"
              className="bg-white border border-[#EA580C]/40 rounded-xl p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-black/10">
                <div>
                  <p className="text-xs font-medium text-[#C2410C]">
                    {editingProduct.isCuratedDefault
                      ? 'Edit Default Curated Catalog Product'
                      : 'Edit Product'}
                  </p>
                  <h2 className="text-base font-semibold text-[#111113]">
                    {editingProduct.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 text-[#57534E] hover:text-[#111113] cursor-pointer"
                  aria-label="Cancel editing"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="edit-prod-title"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Product Name
                    </label>
                    <input
                      id="edit-prod-title"
                      type="text"
                      required
                      maxLength={140}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-prod-code"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Product Code
                    </label>
                    <input
                      id="edit-prod-code"
                      type="text"
                      required
                      minLength={2}
                      maxLength={32}
                      value={editProductCode}
                      onChange={(e) => setEditProductCode(sanitizeProductCode(e.target.value))}
                      className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="edit-prod-mkt"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Marketplace
                    </label>
                    <select
                      id="edit-prod-mkt"
                      value={editMarketplace}
                      onChange={(e) => setEditMarketplace(e.target.value as MarketplaceType)}
                      className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                    >
                      <option value="Temu">Temu</option>
                      <option value="Amazon">Amazon</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-prod-cat"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Category
                    </label>
                    <select
                      id="edit-prod-cat"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                      className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                    >
                      {selectableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 h-10 px-3 w-full bg-[#FAF9F6] border border-black/15 rounded-lg text-xs font-medium text-[#111113] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPublished}
                        onChange={(e) => setEditPublished(e.target.checked)}
                        className="accent-[#EA580C]"
                      />
                      <span>Visible on Storefront</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="edit-prod-price"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Sell Price ($)
                    </label>
                    <input
                      id="edit-prod-price"
                      type="number"
                      step="0.01"
                      min="0.50"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-prod-compare"
                      className="block text-xs font-medium text-[#111113] mb-1"
                    >
                      Original Price ($)
                    </label>
                    <input
                      id="edit-prod-compare"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editComparePrice}
                      onChange={(e) => setEditComparePrice(e.target.value)}
                      className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label
                      htmlFor="edit-prod-image"
                      className="text-xs font-medium text-[#111113]"
                    >
                      Product Image Url
                    </label>
                    <select
                      aria-label="Edit Studio Image Preset"
                      value={
                        PRESET_STUDIO_IMAGES.some((p) => p.url === editImageUrl)
                          ? editImageUrl
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          setEditImageUrl(e.target.value);
                          setEditDriveStatus('Loaded Studio Image Preset.');
                        }
                      }}
                      className="h-8 px-2.5 text-xs bg-white border border-black/15 rounded-md"
                    >
                      <option value="">Studio Image Preset...</option>
                      {PRESET_STUDIO_IMAGES.map((img) => (
                        <option key={img.url} value={img.url}>
                          {img.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="edit-prod-image"
                      type="text"
                      required
                      maxLength={500}
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      className="flex-1 h-10 px-3 text-sm font-mono bg-white border border-black/15 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchEditDriveImage()}
                      className="h-10 px-3.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] cursor-pointer whitespace-nowrap"
                    >
                      Convert Drive URL
                    </button>
                  </div>
                  {editDriveStatus && (
                    <p className="text-[11px] text-[#57534E]">{editDriveStatus}</p>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-16 h-12 rounded-lg overflow-hidden bg-[#EFECE5] border border-black/10 shrink-0">
                        <SafeImage
                          src={resolveDriveImageUrl(editImageUrl).resolvedUrl}
                          alt={editTitle || 'Edit preview'}
                          fallbackTitle="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[11px] text-[#57534E] truncate">
                        Current Image Preview
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setImageLightbox({
                          src: resolveDriveImageUrl(editImageUrl).resolvedUrl,
                          title: editTitle || 'Product Image',
                        })
                      }
                      className="h-8 px-2.5 bg-white border border-black/15 rounded-lg text-[11px] font-semibold text-[#111113] hover:bg-[#EFECE5] inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Maximize2 className="w-3 h-3 text-[#EA580C]" />
                      <span>See Image</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-prod-url"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    Affiliate Link
                  </label>
                  <input
                    id="edit-prod-url"
                    type="url"
                    required
                    maxLength={500}
                    value={editAffiliateUrl}
                    onChange={(e) => setEditAffiliateUrl(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-prod-desc"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    Product Description
                  </label>
                  <textarea
                    id="edit-prod-desc"
                    required
                    rows={3}
                    maxLength={600}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="h-10 px-4 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#FAF9F6] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* All Manage Product KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-black/10 rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x divide-black/10">
            <div className="p-5">
              <p className="text-xs text-[#57534E] mb-1">All Managed Products</p>
              <p className="font-mono text-2xl font-bold text-[#111113] tabular-nums">
                {publishedProducts.length}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-[#57534E] mb-1">Product Drafts</p>
              <p className="font-mono text-2xl font-bold text-[#C2410C] tabular-nums">
                {draftProductsCount}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-[#57534E] mb-1">New Products (7d)</p>
              <p className="font-mono text-2xl font-bold text-[#111113] tabular-nums">
                {newProductsCount}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-[#57534E] mb-1">Published Live</p>
              <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {liveProductsCount}
              </p>
            </div>
          </div>

          <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#C2410C]">All Manage Product</p>
                  <h2 className="text-base font-semibold text-[#111113]">
                    Product Drafts &amp; New Products ({filteredManageProducts.length})
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={manageSearch}
                    onChange={(e) => setManageSearch(e.target.value)}
                    placeholder="Filter by name or code..."
                    className="h-9 px-3 text-xs bg-[#FAF9F6] border border-black/15 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setAdminTab('productCenter')}
                    className="h-9 px-3.5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] whitespace-nowrap cursor-pointer"
                  >
                    + New Product / Draft
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#EFECE5] rounded-lg w-fit">
                {(
                  [
                    ['all', `All (${publishedProducts.length})`],
                    ['draft', `Drafts (${draftProductsCount})`],
                    ['new', `New Products (${newProductsCount})`],
                    ['published', `Published (${liveProductsCount})`],
                  ] as const
                ).map(([filterKey, label]) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setManageFilter(filterKey)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      manageFilter === filterKey
                        ? 'bg-white text-[#111113] shadow-sm'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredManageProducts.length === 0 ? (
              <div className="p-6 text-xs text-[#57534E]">
                No products match this view. Create a New Product or Draft above, or import a
                starter item as Draft below.
              </div>
            ) : (
              <ul className="divide-y divide-black/10">
                {filteredManageProducts.map((prod) => {
                  const isNew = isProductRecentlyAdded(prod.createdAt);
                  return (
                    <li
                      key={prod.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-12 rounded-lg overflow-hidden bg-[#EFECE5] shrink-0 border border-black/10">
                          <SafeImage
                            src={prod.imageUrl}
                            alt={prod.title}
                            fallbackTitle={prod.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#111113] truncate">
                              {prod.title}
                            </p>
                            {isNew && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-[#FFF7ED] text-[#C2410C] border border-[#EA580C]/25">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#57534E] tabular-nums">
                            <span className="font-mono">{prod.productCode || prod.id}</span> ·{' '}
                            {prod.marketplace} · {prod.category} · ${prod.price.toFixed(2)} ·{' '}
                            <span
                              className={
                                prod.published
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-[#9A3412] font-semibold'
                              }
                            >
                              {prod.published ? 'Published (Live)' : 'Draft (Hidden)'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditProduct(prod)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#111113] bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleProductPublished(prod)}
                          title={prod.published ? 'Move to Draft' : 'Publish Live'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                            prod.published
                              ? 'text-[#57534E] bg-white border-black/15 hover:text-[#111113]'
                              : 'text-white bg-emerald-700 border-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          {prod.published ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Move to Draft</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Publish Live</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCloneStarterToForm(prod)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111113] bg-white border border-black/15 rounded-lg hover:bg-[#FAF9F6] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Clone New</span>
                        </button>

                        {confirmDeleteId === prod.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteProduct(prod)}
                              className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 text-xs font-medium text-[#57534E] border border-black/15 rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(prod.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-black/15 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#111113]">
                  Default Curated Catalog ({activeCuratedCatalog.length})
                </h3>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Edit, Delete, Hide, or Unhide built-in storefront catalog products, or save copies
                  into Product Manage.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                  {visibleCuratedCount} Visible
                </span>
                <span className="px-2 py-0.5 rounded bg-[#FFF7ED] text-[#9A3412] font-semibold">
                  {hiddenCuratedCount} Hidden
                </span>
              </div>
            </div>

            {activeCuratedCatalog.length === 0 ? (
              <div className="p-6 text-xs text-[#57534E]">
                All Default Curated Catalog items are deleted. Restore any item below if needed.
              </div>
            ) : (
              <ul className="divide-y divide-black/10">
                {activeCuratedCatalog.map((starter) => (
                  <li
                    key={starter.id}
                    className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-12 rounded-lg overflow-hidden bg-[#EFECE5] shrink-0 border border-black/10">
                        <SafeImage
                          src={starter.imageUrl}
                          alt={starter.title}
                          fallbackTitle={starter.title}
                          className={`w-full h-full object-cover ${
                            !starter.published ? 'opacity-50 grayscale' : ''
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-[#111113] truncate">
                            {starter.title}
                          </p>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${
                              starter.published
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#FFF7ED] text-[#9A3412] border border-[#EA580C]/25'
                            }`}
                          >
                            {starter.published ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#57534E] font-mono tabular-nums mt-0.5">
                          {starter.productCode} · {starter.marketplace} · {starter.category} · $
                          {starter.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditProduct(starter)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#111113] bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleCuratedVisibility(starter)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                          starter.published
                            ? 'text-[#57534E] bg-white border-black/15 hover:text-[#111113]'
                            : 'text-white bg-emerald-700 border-emerald-700 hover:bg-emerald-800'
                        }`}
                      >
                        {starter.published ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Unhide</span>
                          </>
                        )}
                      </button>

                      {confirmDeleteId === starter.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleConfirmDeleteProduct(starter)}
                            className="px-3 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 text-xs font-medium text-[#57534E] border border-black/15 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(starter.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-black/15 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSaveCuratedAsDraft(starter)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#111113] bg-white border border-black/15 rounded-lg hover:bg-[#FAF9F6] whitespace-nowrap cursor-pointer"
                      >
                        Save as Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloneStarterToForm(starter)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#111113] bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] whitespace-nowrap cursor-pointer"
                      >
                        Clone to New
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {deletedCuratedCatalog.length > 0 && (
              <div className="px-6 py-4 border-t border-black/10 bg-[#FAF9F6] space-y-2.5">
                <p className="text-xs font-semibold text-[#57534E]">
                  Deleted Default Curated Products ({deletedCuratedCatalog.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {deletedCuratedCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleRestoreCuratedItem(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#111113] bg-white border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Restore &amp; Unhide: {item.productCode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. REQUEST CENTER: User Withdraw Requests + Order Proofs + Track Referrals */}
      {adminTab === 'requestCenter' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFECE5] rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setRequestSubView('withdraw')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                requestSubView === 'withdraw'
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              User Withdraw Requests ({adminWithdrawals.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestSubView('proofs')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                requestSubView === 'proofs'
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              Order Proof Requests ({adminOrderProofs.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestSubView('referrals')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                requestSubView === 'referrals'
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              Reference Track ({adminAllReferrals.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestSubView('tickets')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                requestSubView === 'tickets'
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              Helpcenter Tickets ({adminSupportTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestSubView('feedback')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                requestSubView === 'feedback'
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              Ratings &amp; Feedback ({adminFeedbackList.length})
            </button>
          </div>

          {requestSubView === 'withdraw' && (
            <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#C2410C]">
                    Request Center · Payouts (5% Tax + 2% Fee)
                  </p>
                  <h2 className="text-base font-semibold text-[#111113]">
                    User Withdraw Requests ({filteredWithdrawals.length})
                  </h2>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#FAF9F6] border border-black/10 rounded-lg">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((statusKey) => (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => setWithdrawFilter(statusKey)}
                      className={`px-2.5 py-1 text-xs font-medium capitalize rounded cursor-pointer ${
                        withdrawFilter === statusKey
                          ? 'bg-[#111113] text-white'
                          : 'text-[#57534E] hover:text-[#111113]'
                      }`}
                    >
                      {statusKey}
                    </button>
                  ))}
                </div>
              </div>

              {filteredWithdrawals.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E]">
                  No user withdrawal requests in this view.
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {filteredWithdrawals.map((wd) => (
                    <li
                      key={wd.id}
                      className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#111113]">
                          {wd.bankName} · {wd.holderName}
                        </p>
                        <p className="text-xs text-[#57534E]">
                          {wd.userName} ({wd.userEmail}) · Cell{' '}
                          <span className="font-mono">{wd.cellNumber}</span>
                        </p>
                        <p className="text-xs font-mono text-[#111113] tabular-nums">
                          Amount: {wd.amount.toLocaleString()} PKR · Tax 5%: -
                          {wd.taxPkr.toLocaleString()} · Fee 2%: -{wd.feePkr.toLocaleString()} ·
                          Net:{' '}
                          <strong className="text-[#C2410C]">
                            {wd.netAmountPkr.toLocaleString()} PKR
                          </strong>
                        </p>
                      </div>

                      {wd.status === 'pending' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReviewWithdrawal(wd, 'approved')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewWithdrawal(wd, 'rejected')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF9F6] border border-black/15 text-[#9A3412] text-xs font-semibold rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject & Refund</span>
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-semibold capitalize ${
                            wd.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {wd.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {requestSubView === 'proofs' && (
            <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/10">
                <p className="text-xs font-medium text-[#C2410C]">Order Proof Verification</p>
                <h2 className="text-base font-semibold text-[#111113]">
                  Customer Order Proofs ({adminOrderProofs.length})
                </h2>
              </div>

              {adminOrderProofs.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E]">
                  No referral order proofs submitted yet.
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {adminOrderProofs.map((proof) => (
                    <li key={proof.id} className="p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[#111113]">
                            {proof.productTitle} ({proof.quantity} item
                            {proof.quantity > 1 ? 's' : ''})
                          </p>
                          <p className="text-xs text-[#57534E]">
                            {proof.userName} ({proof.userEmail}) · {proof.marketplace} · Order{' '}
                            <span className="font-mono">{proof.orderReference}</span>
                          </p>
                          <p className="text-xs text-[#111113]">Proof: {proof.proofNotes}</p>
                        </div>

                        {proof.status === 'pending' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleReviewProof(proof, 'approved')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Order</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReviewProof(proof, 'rejected')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF9F6] border border-black/15 text-[#9A3412] text-xs font-semibold rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`text-xs font-semibold capitalize ${
                              proof.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {proof.status}
                          </span>
                        )}
                      </div>

                      {proof.proofAttachment && (
                        <img
                          src={proof.proofAttachment}
                          alt={`Order proof ${proof.orderReference}`}
                          className="max-h-40 rounded-lg border border-black/10 object-contain bg-[#FAF9F6]"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {requestSubView === 'referrals' && (
            <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#C2410C]">
                    Reference Track · Account &amp; Invite Monitor (Official Code:{' '}
                    <span className="font-mono font-bold">{OFFICIAL_INVITE_CODE}</span>)
                  </p>
                  <h2 className="text-base font-semibold text-[#111113]">
                    Track Referral Users &amp; Account Activity ({adminAllReferrals.length})
                  </h2>
                </div>

                <input
                  type="search"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  placeholder="Search name, mail, account ID, ref user, or code..."
                  className="h-9 w-full lg:w-72 px-3 text-xs bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>

              {adminAllReferrals.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E]">No referred users recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F6] border-b border-black/10 text-[#57534E]">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Account Track (Name &amp; UID)</th>
                        <th className="px-6 py-3 font-semibold">Mail</th>
                        <th className="px-6 py-3 font-semibold">Ref User &amp; Invite Code</th>
                        <th className="px-6 py-3 font-semibold">Buy Product</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {adminAllReferrals
                        .filter((ref) => {
                          const q = refSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            ref.inviteeName.toLowerCase().includes(q) ||
                            (ref.inviteeEmail || '').toLowerCase().includes(q) ||
                            ref.inviteeUid.toLowerCase().includes(q) ||
                            (ref.inviterName || '').toLowerCase().includes(q) ||
                            ref.inviterCode.toLowerCase().includes(q)
                          );
                        })
                        .map((ref) => {
                          const userProofs = adminOrderProofs.filter(
                            (p) => p.userId === ref.inviteeUid
                          );
                          const approvedProofTitles = userProofs
                            .filter((p) => p.status === 'approved')
                            .map((p) => `${p.productTitle} (×${p.quantity})`);
                          const fallbackEmail =
                            ref.inviteeEmail || userProofs[0]?.userEmail || '—';
                          const resolvedRefName =
                            ref.inviterName ||
                            (ref.inviterCode === OFFICIAL_INVITE_CODE
                              ? OFFICIAL_INVITER_NAME
                              : 'Mezone Referrer');

                          return (
                            <tr key={ref.id} className="align-top">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-[#111113] whitespace-nowrap">
                                  {ref.inviteeName}
                                </p>
                                <p className="text-[11px] font-mono text-[#57534E] mt-0.5 break-all">
                                  ID: {ref.inviteeUid}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-[#57534E] font-mono">
                                {fallbackEmail}
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-[#111113]">
                                  {resolvedRefName}
                                </p>
                                <p className="text-[11px] font-mono text-[#C2410C] mt-0.5">
                                  {ref.inviterCode}
                                  {ref.inviterCode === OFFICIAL_INVITE_CODE ? ' (Official)' : ''}
                                </p>
                              </td>
                              <td className="px-6 py-4 text-[#111113]">
                                <p className="font-mono font-semibold tabular-nums">
                                  {ref.approvedProductCount} / {ref.requiredProductCount} Approved
                                </p>
                                {approvedProofTitles.length > 0 && (
                                  <p className="text-[11px] text-[#57534E] mt-1 max-w-xs">
                                    {approvedProofTitles.join(', ')}
                                  </p>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    ref.status === 'accepted'
                                      ? 'text-emerald-700'
                                      : 'text-[#C2410C]'
                                  }`}
                                >
                                  {ref.status === 'accepted' ? 'Accepted (+500 PKR)' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {requestSubView === 'tickets' && (
            <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/10">
                <p className="text-xs font-medium text-[#C2410C]">Helpcenter Inbox</p>
                <h2 className="text-base font-semibold text-[#111113]">
                  User Support Tickets ({adminSupportTickets.length})
                </h2>
              </div>

              {adminSupportTickets.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E]">
                  No Helpcenter support tickets submitted yet.
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {adminSupportTickets.map((ticket) => (
                    <li key={ticket.id} className="p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-[#C2410C]">
                            {ticket.topic}
                          </p>
                          <p className="text-sm font-semibold text-[#111113]">{ticket.subject}</p>
                          <p className="text-xs text-[#57534E]">
                            {ticket.userName} ({ticket.userEmail}) · UID{' '}
                            <span className="font-mono">{ticket.userId}</span>
                          </p>
                          <p className="text-xs text-[#111113] pt-1">{ticket.message}</p>
                        </div>

                        <span
                          className={`text-xs font-semibold capitalize shrink-0 ${
                            ticket.status === 'resolved' ? 'text-emerald-700' : 'text-[#C2410C]'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>

                      {ticket.status === 'open' ? (
                        <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                          <input
                            type="text"
                            maxLength={400}
                            value={ticketReplies[ticket.id] || ''}
                            onChange={(e) =>
                              setTicketReplies((prev) => ({
                                ...prev,
                                [ticket.id]: e.target.value,
                              }))
                            }
                            placeholder="Write Admin reply to resolve ticket..."
                            className="flex-1 h-9 px-3 text-xs bg-[#FAF9F6] border border-black/15 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await resolveSupportTicketAsAdmin({
                                ticketId: ticket.id,
                                adminReply:
                                  ticketReplies[ticket.id] ||
                                  'Resolved by Mezone Support Team.',
                              });
                              onFlashStatus(`Resolved support ticket "${ticket.subject}".`);
                            }}
                            className="h-9 px-4 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 cursor-pointer shrink-0"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      ) : (
                        ticket.adminReply && (
                          <p className="text-xs text-[#57534E]">
                            <span className="font-semibold text-[#111113]">Reply: </span>
                            {ticket.adminReply}
                          </p>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {requestSubView === 'feedback' && (
            <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/10">
                <p className="text-xs font-medium text-[#C2410C]">Helpcenter Ratings &amp; Reviews</p>
                <h2 className="text-base font-semibold text-[#111113]">
                  User Ratings &amp; Feedback ({adminFeedbackList.length})
                </h2>
              </div>

              {adminFeedbackList.length === 0 ? (
                <p className="p-6 text-xs text-[#57534E]">
                  No Helpcenter ratings or feedback submitted yet.
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {adminFeedbackList.map((fb) => (
                    <li key={fb.id} className="p-6 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#111113]">
                              {fb.userName}
                            </span>
                            <span className="text-[11px] font-semibold text-[#C2410C]">
                              {fb.category}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#111113]">
                              <Star className="w-3.5 h-3.5 text-[#EA580C] fill-[#EA580C]" />
                              {fb.rating}/5
                            </span>
                          </div>
                          <p className="text-xs text-[#57534E] leading-relaxed">{fb.comment}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              await reviewHelpcenterFeedbackAsAdmin({
                                feedbackId: fb.id,
                                published: !fb.published,
                                adminReply: fb.adminReply || '',
                              });
                              onFlashStatus(
                                fb.published
                                  ? 'Feedback hidden from public list.'
                                  : 'Feedback published to Helpcenter.'
                              );
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                          >
                            {fb.published ? 'Visible · Hide' : 'Hidden · Show'}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await deleteHelpcenterFeedback(fb.id);
                              onFlashStatus('Feedback deleted.');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-black/15 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                        <input
                          type="text"
                          maxLength={400}
                          value={feedbackReplies[fb.id] ?? fb.adminReply ?? ''}
                          onChange={(e) =>
                            setFeedbackReplies((prev) => ({
                              ...prev,
                              [fb.id]: e.target.value,
                            }))
                          }
                          placeholder="Optional Admin reply on this feedback..."
                          className="flex-1 h-9 px-3 text-xs bg-[#FAF9F6] border border-black/15 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await reviewHelpcenterFeedbackAsAdmin({
                              feedbackId: fb.id,
                              published: fb.published,
                              adminReply: feedbackReplies[fb.id] ?? fb.adminReply ?? '',
                            });
                            onFlashStatus('Feedback reply saved.');
                          }}
                          className="h-9 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] cursor-pointer shrink-0"
                        >
                          Save Reply
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3B. BANNER ADS: HTML Code Editor & Live Preview across Pages */}
      {adminTab === 'bannerAds' && (
        <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-black/10">
            <div>
              <p className="text-xs font-medium text-[#C2410C] mb-1">
                Admin Center · Banner Ads HTML Editor
              </p>
              <h2 className="font-display text-xl font-bold text-[#111113]">
                Banner Ads (Edit HTML Code Shown Across Pages)
              </h2>
              <p className="text-xs text-[#57534E] mt-1 max-w-2xl">
                Edit or paste custom HTML banner ads, promotional strips, or embed snippets below.
                Saved HTML ads render immediately inside sandboxed Banner Ad slots across Mezone pages.
              </p>
            </div>
            <Code2 className="w-6 h-6 text-[#EA580C] shrink-0" />
          </div>

          <form onSubmit={handleSaveBannerAds} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#FAF9F6] border border-black/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adEnabled}
                  onChange={(e) => setAdEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#EA580C]"
                />
                <div>
                  <span className="block text-xs font-semibold text-[#111113]">
                    Show Banner Ads on Pages
                  </span>
                  <span className="block text-[11px] text-[#57534E]">
                    Turn HTML banner placements on or off globally.
                  </span>
                </div>
              </label>

              <div>
                <label
                  htmlFor="banner-scope"
                  className="block text-xs font-medium text-[#111113] mb-1"
                >
                  Page Display Scope
                </label>
                <select
                  id="banner-scope"
                  value={adScope}
                  onChange={(e) => setAdScope(e.target.value as BannerPlacementScope)}
                  className="w-full h-10 px-3 text-xs bg-white border border-black/15 rounded-lg text-[#111113]"
                >
                  <option value="all">All Pages (Welcome, Auth, Onboarding &amp; Workspace)</option>
                  <option value="workspace">Shopping Workspace Pages Only</option>
                  <option value="public">Welcome &amp; Login/Register Pages Only</option>
                </select>
              </div>
            </div>

            {/* Top Banner HTML Editor */}
            <div className="space-y-3 p-5 rounded-xl bg-[#FAF9F6] border border-black/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ad-top-html"
                  className="text-xs font-semibold text-[#111113]"
                >
                  Top Banner Ad HTML Code
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdTopHtml(DEFAULT_TOP_BANNER_HTML)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-black/15 rounded-md hover:bg-[#EFECE5] cursor-pointer"
                  >
                    Load Default Promo HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdTopHtml('')}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#9A3412] bg-white border border-black/15 rounded-md hover:bg-[#EFECE5] cursor-pointer"
                  >
                    Clear Top Ad
                  </button>
                </div>
              </div>

              <textarea
                id="ad-top-html"
                rows={6}
                maxLength={20000}
                value={adTopHtml}
                onChange={(e) => setAdTopHtml(e.target.value)}
                placeholder="Paste HTML banner code (e.g. <div>...</div> or <a href='https://...'><img src='...' /></a>)"
                className="w-full p-3 text-xs font-mono bg-white border border-black/15 rounded-lg text-[#111113]"
              />

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#57534E]">
                  Live Top Banner HTML Preview:
                </p>
                {adTopHtml.trim() ? (
                  <BannerAdSlot
                    position="top"
                    pageGroup="workspace"
                    htmlOverride={adTopHtml}
                    forceShow
                  />
                ) : (
                  <p className="text-xs text-[#57534E]">Top banner slot is empty (hidden on pages).</p>
                )}
              </div>
            </div>

            {/* Bottom Banner HTML Editor */}
            <div className="space-y-3 p-5 rounded-xl bg-[#FAF9F6] border border-black/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ad-bottom-html"
                  className="text-xs font-semibold text-[#111113]"
                >
                  Bottom Banner Ad HTML Code
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdBottomHtml(DEFAULT_BOTTOM_BANNER_HTML)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-black/15 rounded-md hover:bg-[#EFECE5] cursor-pointer"
                  >
                    Load Referral Banner HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdBottomHtml('')}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#9A3412] bg-white border border-black/15 rounded-md hover:bg-[#EFECE5] cursor-pointer"
                  >
                    Clear Bottom Ad
                  </button>
                </div>
              </div>

              <textarea
                id="ad-bottom-html"
                rows={6}
                maxLength={20000}
                value={adBottomHtml}
                onChange={(e) => setAdBottomHtml(e.target.value)}
                placeholder="Paste secondary HTML banner ad code..."
                className="w-full p-3 text-xs font-mono bg-white border border-black/15 rounded-lg text-[#111113]"
              />

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#57534E]">
                  Live Bottom Banner HTML Preview:
                </p>
                {adBottomHtml.trim() ? (
                  <BannerAdSlot
                    position="bottom"
                    pageGroup="workspace"
                    htmlOverride={adBottomHtml}
                    forceShow
                  />
                ) : (
                  <p className="text-xs text-[#57534E]">
                    Bottom banner slot is empty (hidden on pages).
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBannerAds}
              className="h-11 px-6 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
            >
              {savingBannerAds ? 'Saving Banner Ads...' : 'Save Banner Ads HTML'}
            </button>
          </form>
        </div>
      )}

      {/* 4. ADMIN SETTING: Connect Social Login, Change Login Pin, Change Mail, Logout */}
      {adminTab === 'adminSetting' && (
        <div className="space-y-6">
          {/* Connect Social Login */}
          <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/10">
              <div>
                <h2 className="text-base font-semibold text-[#111113]">
                  Connect Social Login
                </h2>
                <p className="text-xs text-[#57534E] mt-1">
                  Link Google, Apple, Facebook, or Yahoo sign-in providers to your Admin Center account.
                </p>
              </div>
              <Link2 className="w-5 h-5 text-[#EA580C] shrink-0" />
            </div>

            {socialMessage && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
                {socialMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">Google Account (Recommend)</p>
                  <p className="text-xs text-[#57534E]">
                    {hasGoogleLinked ? `Connected (${user.email})` : 'Not connected'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={socialBusy !== null}
                  onClick={() => handleToggleSocialProvider('google')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    hasGoogleLinked
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#111113] text-white hover:bg-[#27272A]'
                  }`}
                >
                  {socialBusy === 'google'
                    ? 'Updating...'
                    : hasGoogleLinked
                      ? 'Connected'
                      : 'Connect Google'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">Apple Account</p>
                  <p className="text-xs text-[#57534E]">
                    {hasAppleLinked ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={socialBusy !== null}
                  onClick={() => handleToggleSocialProvider('apple')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    hasAppleLinked
                      ? 'bg-white border border-black/15 text-[#9A3412] hover:bg-[#EFECE5]'
                      : 'bg-[#111113] text-white hover:bg-[#27272A]'
                  }`}
                >
                  {socialBusy === 'apple'
                    ? 'Updating...'
                    : hasAppleLinked
                      ? 'Disconnect'
                      : 'Connect Apple'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">Facebook Account (Hot)</p>
                  <p className="text-xs text-[#57534E]">
                    {hasFacebookLinked ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={socialBusy !== null}
                  onClick={() => handleToggleSocialProvider('facebook')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    hasFacebookLinked
                      ? 'bg-white border border-black/15 text-[#9A3412] hover:bg-[#EFECE5]'
                      : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                  }`}
                >
                  {socialBusy === 'facebook'
                    ? 'Updating...'
                    : hasFacebookLinked
                      ? 'Disconnect'
                      : 'Connect Facebook'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">GitHub Account</p>
                  <p className="text-xs text-[#57534E]">
                    {hasGithubLinked ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={socialBusy !== null}
                  onClick={() => handleToggleSocialProvider('github')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    hasGithubLinked
                      ? 'bg-white border border-black/15 text-[#9A3412] hover:bg-[#EFECE5]'
                      : 'bg-[#24292F] text-white hover:bg-[#1B1F23]'
                  }`}
                >
                  {socialBusy === 'github'
                    ? 'Updating...'
                    : hasGithubLinked
                      ? 'Disconnect'
                      : 'Connect GitHub'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-black/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111113]">Yahoo Account</p>
                  <p className="text-xs text-[#57534E]">
                    {hasYahooLinked ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={socialBusy !== null}
                  onClick={() => handleToggleSocialProvider('yahoo')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    hasYahooLinked
                      ? 'bg-white border border-black/15 text-[#9A3412] hover:bg-[#EFECE5]'
                      : 'bg-[#6001D2] text-white hover:bg-[#5000B3]'
                  }`}
                >
                  {socialBusy === 'yahoo'
                    ? 'Updating...'
                    : hasYahooLinked
                      ? 'Disconnect'
                      : 'Connect Yahoo'}
                </button>
              </div>
            </div>
          </div>

          {/* Change Login Pin */}
          <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/10">
              <div>
                <h2 className="text-base font-semibold text-[#111113]">Change Login Pin</h2>
                <p className="text-xs text-[#57534E] mt-1">
                  Update your hidden Admin Center Login PIN (minimum 6 characters).
                </p>
              </div>
              <KeyRound className="w-5 h-5 text-[#EA580C] shrink-0" />
            </div>

            {pinChangeMessage && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
                {pinChangeMessage}
              </div>
            )}

            <form onSubmit={handleChangeLoginPin} className="space-y-3.5 max-w-md">
              <div>
                <label
                  htmlFor="admin-cur-pin"
                  className="block text-xs font-medium text-[#111113] mb-1"
                >
                  Current Login PIN
                </label>
                <input
                  id="admin-cur-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg tracking-widest"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-new-pin"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    New Login PIN
                  </label>
                  <input
                    id="admin-new-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    minLength={6}
                    maxLength={24}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg tracking-widest"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-conf-pin"
                    className="block text-xs font-medium text-[#111113] mb-1"
                  >
                    Confirm New PIN
                  </label>
                  <input
                    id="admin-conf-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    minLength={6}
                    maxLength={24}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pinChangeBusy}
                className="h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
              >
                {pinChangeBusy ? 'Updating PIN...' : 'Update Login PIN'}
              </button>
            </form>
          </div>

          {/* Change Mail */}
          <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/10">
              <div>
                <h2 className="text-base font-semibold text-[#111113]">Change Mail</h2>
                <p className="text-xs text-[#57534E] mt-1">
                  Current Admin Mail: <span className="font-mono">{user.email}</span>
                </p>
              </div>
              <Mail className="w-5 h-5 text-[#EA580C] shrink-0" />
            </div>

            {emailChangeMessage && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
                {emailChangeMessage}
              </div>
            )}

            <form onSubmit={handleChangeAdminMail} className="space-y-3.5 max-w-md">
              <div>
                <label
                  htmlFor="admin-new-mail"
                  className="block text-xs font-medium text-[#111113] mb-1"
                >
                  New Mail Address
                </label>
                <input
                  id="admin-new-mail"
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="new.email@gmail.com"
                  className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={emailChangeBusy}
                className="h-10 px-5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
              >
                {emailChangeBusy ? 'Sending Verification...' : 'Send Change Mail Link'}
              </button>
            </form>
          </div>

          {/* Gmail Send OTP with Mail inside Admin Center */}
          <GmailOtpSection user={user} onFlashStatus={onFlashStatus} />

          {/* Logout */}
          <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#111113]">Logout</h2>
              <p className="text-xs text-[#57534E] mt-1">
                Sign out from your Admin Center session and return to Mezone Auth.
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-[#9A3412] text-white text-xs font-semibold rounded-lg hover:bg-[#7C2D12] cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Drive Image Lightbox Modal ("See Image") */}
      {imageLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setImageLightbox(null)}
        >
          <div
            className="bg-white border border-black/10 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#C2410C]">
                  Google Drive Image Viewer
                </p>
                <h3 className="font-display text-base font-bold text-[#111113] truncate">
                  {imageLightbox.title}
                </h3>
                {imageLightbox.subtitle && (
                  <p className="text-[11px] font-mono text-[#57534E]">
                    {imageLightbox.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setImageLightbox(null)}
                aria-label="Close image viewer"
                className="p-1.5 text-[#57534E] hover:text-[#111113] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FAF9F6] border border-black/10 rounded-xl overflow-hidden flex items-center justify-center min-h-[260px] max-h-[70vh] p-2">
              <SafeImage
                src={imageLightbox.src}
                alt={imageLightbox.title}
                fallbackTitle={imageLightbox.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
