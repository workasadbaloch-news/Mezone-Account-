import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Heart,
  History,
  BookOpen,
  LifeBuoy,
  Link2,
  Loader2,
  LocateFixed,
  Lock,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Upload,
  User as UserIcon,
  Users,
  Wallet,
  X,
  MessageCircle,
} from 'lucide-react';
import { CURATED_PRODUCTS } from '../data/catalog';
import { BannerAdSlot } from '../lib/bannerAds';
import {
  appleProvider,
  auth,
  db,
  facebookProvider,
  githubProvider,
  googleProvider,
  handleFirestoreError,
  OperationType,
  yahooProvider,
} from '../lib/firebase';
import {
  ACCOUNT_CREATE_BONUS_PKR,
  ADMIN_DAILY_GRANT_PKR,
  ADMIN_EMAIL,
  buildWhatsAppOrderProofUrl,
  COUNTRY_NAME_OPTIONS,
  COUNTRY_PHONE_OPTIONS,
  deleteMezoneAccountData,
  detectUserCountryFromBrowserLocation,
  ensureUserProfile,
  formatLoginWayLabel,
  getAccountInviteWindow,
  getRewardSystemStatus,
  linkUserToInviteCode,
  lookupCountryOption,
  lookupInviteCodeOwner,
  normalizeInternationalPhone,
  OFFICIAL_INVITE_CODE,
  OFFICIAL_INVITER_NAME,
  parseInternationalPhone,
  REWARD_SYSTEM_START_LABEL,
  removeLikedItemById,
  submitOrderProof,
  toggleLikedProduct,
  updatePersonalInformation,
  WHATSAPP_PROOF_DISPLAY,
} from '../lib/mezoneDb';
import { ThemeToggleButton, useTheme } from '../lib/theme';
import {
  AffiliateProduct,
  CuratedCatalogOverride,
  GenderOption,
  HelpcenterFeedbackRecord,
  LikedItemRecord,
  MarketplaceType,
  OrderProofRecord,
  ProductCategory,
  ReferralRecord,
  SettingSection,
  SupportTicketRecord,
  UserProfile,
  WithdrawalRecord,
  WorkspaceTab,
} from '../types/mezone';
import { AdminCenterSection } from './AdminCenterSection';
import { HelpcenterSection } from './HelpcenterSection';
import { LinkedLoginSection } from './LinkedLoginSection';
import { ReferenceAnalyticsSection } from './ReferenceAnalyticsSection';
import { SafeImage } from './SafeImage';
import { VerificationCenterSection } from './VerificationCenterSection';
import { WalletWithdrawSection } from './WalletWithdrawSection';

interface MezoneWorkspaceProps {
  user: User;
  initialTab?: WorkspaceTab;
  sessionOrigin?: 'register' | 'login' | null;
  onSignedOut: () => void;
}

const CATEGORIES: Array<'All' | ProductCategory> = [
  'All',
  'Tech & Audio',
  'Home & Living',
  'Travel & Carry',
  'Beauty & Care',
  'Everyday Deals',
];

const MARKETPLACES: Array<'All' | MarketplaceType> = ['All', 'Temu', 'Amazon'];

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        resolve(dataUrl.slice(0, 68000));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function MezoneWorkspace({
  user,
  initialTab = 'product',
  sessionOrigin = null,
  onSignedOut,
}: MezoneWorkspaceProps) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [settingSection, setSettingSection] = useState<SettingSection>('personal');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publishedProducts, setPublishedProducts] = useState<AffiliateProduct[]>([]);
  const [curatedOverrides, setCuratedOverrides] = useState<CuratedCatalogOverride[]>([]);
  const [likedItems, setLikedItems] = useState<LikedItemRecord[]>([]);
  const [myInvitedReferrals, setMyInvitedReferrals] = useState<ReferralRecord[]>([]);
  const [myInviterRecord, setMyInviterRecord] = useState<ReferralRecord | null>(null);
  const [myOrderProofs, setMyOrderProofs] = useState<OrderProofRecord[]>([]);
  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [mySupportTickets, setMySupportTickets] = useState<SupportTicketRecord[]>([]);
  const [adminOrderProofs, setAdminOrderProofs] = useState<OrderProofRecord[]>([]);
  const [adminAllReferrals, setAdminAllReferrals] = useState<ReferralRecord[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [adminSupportTickets, setAdminSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [feedbackList, setFeedbackList] = useState<HelpcenterFeedbackRecord[]>([]);
  const [verifyChecked, setVerifyChecked] = useState(
    Boolean(user.emailVerified || sessionOrigin === 'login')
  );
  const [, setAuthRefreshTick] = useState(0);
  const [referralSubTab, setReferralSubTab] = useState<'referral' | 'wallet'>('referral');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historySubTab, setHistorySubTab] = useState<
    'all' | 'orders' | 'liked' | 'withdrawals'
  >('all');

  // Filters
  const [selectedMarketplace, setSelectedMarketplace] = useState<'All' | MarketplaceType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);

  // Referral Program UI state
  const [manualInviteCode, setManualInviteCode] = useState('');
  const [lookupRefName, setLookupRefName] = useState<string | null>(null);
  const [linkingInvite, setLinkingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [proofMarketplace, setProofMarketplace] = useState<MarketplaceType>('Temu');
  const [proofProductTitle, setProofProductTitle] = useState(CURATED_PRODUCTS[0].title);
  const [proofOrderRef, setProofOrderRef] = useState('');
  const [proofQty, setProofQty] = useState('1');
  const [proofNotes, setProofNotes] = useState('');
  const [proofAttachment, setProofAttachment] = useState('');
  const [proofError, setProofError] = useState<string | null>(null);
  const [lastSubmittedWhatsAppUrl, setLastSubmittedWhatsAppUrl] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  // Personal Information state
  const [editName, setEditName] = useState(user.displayName || '');
  const [editPhoneCode, setEditPhoneCode] = useState('+92');
  const [editPhoneLocal, setEditPhoneLocal] = useState('');
  const [phoneInputError, setPhoneInputError] = useState<string | null>(null);
  const [editRegion, setEditRegion] = useState('Pakistan (PKR / USD)');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<GenderOption>('');
  const [editCountryName, setEditCountryName] = useState('Pakistan');
  const [editAddress, setEditAddress] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [copiedAccountUid, setCopiedAccountUid] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [adminPinUnlocked, setAdminPinUnlocked] = useState(false);

  const isGoogleProvider = user.providerData.some((p) => p.providerId === 'google.com');
  const isProtectedAdminAccount =
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const canSeeAdminCenterOption =
    user.emailVerified &&
    isGoogleProvider &&
    isProtectedAdminAccount;

  const inviteWindow = useMemo(
    () => getAccountInviteWindow(profile?.createdAt, user.metadata?.creationTime),
    [profile?.createdAt, user.metadata?.creationTime]
  );
  const rewardStatus = getRewardSystemStatus();
  const displayWalletBalance =
    profile?.walletBalancePkr ??
    (isProtectedAdminAccount && user.emailVerified
      ? ADMIN_DAILY_GRANT_PKR
      : rewardStatus.isActive
        ? ACCOUNT_CREATE_BONUS_PKR
        : 0);

  useEffect(() => {
    if (!canSeeAdminCenterOption) {
      setAdminPinUnlocked(false);
    }
    if (!canSeeAdminCenterOption && settingSection === 'admin') {
      setSettingSection('personal');
    }
    if (isProtectedAdminAccount && settingSection === 'delete') {
      setSettingSection('personal');
    }
  }, [canSeeAdminCenterOption, isProtectedAdminAccount, settingSection]);

  useEffect(() => {
    const cleaned = manualInviteCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setLookupRefName(null);
      return;
    }
    let cancelled = false;
    void lookupInviteCodeOwner(cleaned).then((res) => {
      if (!cancelled) {
        setLookupRefName(res.found ? res.ownerName || null : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [manualInviteCode]);

  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  useEffect(() => {
    setVerifyChecked(
      Boolean(user.emailVerified || sessionOrigin === 'login' || profile?.mailOtpVerified)
    );

    const syncPersonalFields = (loaded: UserProfile) => {
      setProfile(loaded);
      setEditName(loaded.displayName);
      const parsed = parseInternationalPhone(loaded.phone || '');
      setEditPhoneCode(parsed.countryCode);
      setEditPhoneLocal(parsed.localNumber);
      setEditRegion(loaded.region || 'Pakistan (PKR / USD)');
      setEditBirthDate(loaded.birthDate || '');
      setEditGender(loaded.gender || '');
      setEditCountryName(loaded.countryName || 'Pakistan');
      setEditAddress(loaded.address || '');
    };

    void ensureUserProfile(user, undefined, undefined, { allowUnverified: true }).then((loaded) => {
      if (loaded) {
        syncPersonalFields(loaded);
      }
    });

      const userRef = doc(db, 'users', user.uid);
      const unsubUser = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            syncPersonalFields(data);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );

      const likedQuery = query(
        collection(db, 'likedItems'),
        where('userId', '==', user.uid)
      );
      const unsubLiked = onSnapshot(
        likedQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<LikedItemRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setLikedItems(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'likedItems');
        }
      );

      // Users I invited
      const invitedQuery = query(
        collection(db, 'referrals'),
        where('inviterUid', '==', user.uid)
      );
      const unsubInvited = onSnapshot(
        invitedQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ReferralRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setMyInvitedReferrals(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'referrals');
        }
      );

      // My own invite qualification progress (if I was invited)
      const myRefDoc = doc(db, 'referrals', user.uid);
      const unsubMyRef = onSnapshot(
        myRefDoc,
        (snap) => {
          if (snap.exists()) {
            setMyInviterRecord({
              id: snap.id,
              ...(snap.data() as Omit<ReferralRecord, 'id'>),
            });
          } else {
            setMyInviterRecord(null);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `referrals/${user.uid}`);
        }
      );

      // My submitted order proofs
      const myProofsQuery = query(
        collection(db, 'orderProofs'),
        where('userId', '==', user.uid)
      );
      const unsubMyProofs = onSnapshot(
        myProofsQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<OrderProofRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setMyOrderProofs(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'orderProofs');
        }
      );

      // My withdrawal requests
      const myWithdrawalsQuery = query(
        collection(db, 'withdrawals'),
        where('userId', '==', user.uid)
      );
      const unsubMyWithdrawals = onSnapshot(
        myWithdrawalsQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<WithdrawalRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setMyWithdrawals(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'withdrawals');
        }
      );

      // My Helpcenter support tickets
      const myTicketsQuery = query(
        collection(db, 'supportTickets'),
        where('userId', '==', user.uid)
      );
      const unsubMyTickets = onSnapshot(
        myTicketsQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SupportTicketRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setMySupportTickets(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'supportTickets');
        }
      );

      const isAdminAccount =
        user.emailVerified &&
        user.providerData.some((p) => p.providerId === 'google.com') &&
        user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      const productsQuery = isAdminAccount
        ? query(collection(db, 'products'))
        : query(collection(db, 'products'), where('published', '==', true));

      const unsubProducts = onSnapshot(
        productsQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AffiliateProduct, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setPublishedProducts(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'products');
        }
      );

      const unsubCurated = onSnapshot(
        query(collection(db, 'curatedCatalog')),
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CuratedCatalogOverride, 'id'>),
            isCuratedDefault: true,
          }));
          setCuratedOverrides(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'curatedCatalog');
        }
      );

      const feedbackQuery = isAdminAccount
        ? query(collection(db, 'helpcenterFeedback'))
        : query(collection(db, 'helpcenterFeedback'), where('published', '==', true));

      const unsubFeedback = onSnapshot(
        feedbackQuery,
        (snap) => {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<HelpcenterFeedbackRecord, 'id'>),
          }));
          rows.sort((a, b) => {
            const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setFeedbackList(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'helpcenterFeedback');
        }
      );

      let unsubAdminProofs = () => {};
      let unsubAdminReferrals = () => {};
      let unsubAdminWithdrawals = () => {};
      let unsubAdminTickets = () => {};

      if (isAdminAccount) {
        const allProofsQuery = query(collection(db, 'orderProofs'));
        unsubAdminProofs = onSnapshot(
          allProofsQuery,
          (snap) => {
            const rows = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<OrderProofRecord, 'id'>),
            }));
            rows.sort((a, b) => {
              const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setAdminOrderProofs(rows);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, 'orderProofs');
          }
        );

        const allRefsQuery = query(collection(db, 'referrals'));
        unsubAdminReferrals = onSnapshot(
          allRefsQuery,
          (snap) => {
            const rows = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ReferralRecord, 'id'>),
            }));
            rows.sort((a, b) => {
              const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setAdminAllReferrals(rows);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, 'referrals');
          }
        );

        const allWithdrawalsQuery = query(collection(db, 'withdrawals'));
        unsubAdminWithdrawals = onSnapshot(
          allWithdrawalsQuery,
          (snap) => {
            const rows = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WithdrawalRecord, 'id'>),
            }));
            rows.sort((a, b) => {
              const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setAdminWithdrawals(rows);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, 'withdrawals');
          }
        );

        const allTicketsQuery = query(collection(db, 'supportTickets'));
        unsubAdminTickets = onSnapshot(
          allTicketsQuery,
          (snap) => {
            const rows = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SupportTicketRecord, 'id'>),
            }));
            rows.sort((a, b) => {
              const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setAdminSupportTickets(rows);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, 'supportTickets');
          }
        );
      }

      return () => {
        unsubUser();
        unsubLiked();
        unsubInvited();
        unsubMyRef();
        unsubMyProofs();
        unsubMyWithdrawals();
        unsubMyTickets();
        unsubProducts();
        unsubCurated();
        unsubFeedback();
        unsubAdminProofs();
        unsubAdminReferrals();
        unsubAdminWithdrawals();
        unsubAdminTickets();
      };
  }, [user, sessionOrigin]);

  const allStorefrontProducts = useMemo(() => {
    const visibleAdminProducts = publishedProducts.filter((p) => p.published);
    const curatedMap = new Map(curatedOverrides.map((c) => [c.id, c]));
    const visibleCuratedProducts = CURATED_PRODUCTS.reduce<AffiliateProduct[]>(
      (acc, starter) => {
        const override = curatedMap.get(starter.id);
        if (override?.deleted) {
          return acc;
        }
        const merged: AffiliateProduct = override
          ? { ...starter, ...override, id: starter.id, isCuratedDefault: true }
          : starter;
        if (merged.published) {
          acc.push(merged);
        }
        return acc;
      },
      []
    );
    return [...visibleAdminProducts, ...visibleCuratedProducts];
  }, [publishedProducts, curatedOverrides]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStorefrontProducts.filter((item) => {
      const marketMatch =
        selectedMarketplace === 'All' || item.marketplace === selectedMarketplace;
      const catMatch =
        selectedCategory === 'All' || item.category === selectedCategory;
      const queryMatch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.productCode || '').toLowerCase().includes(q) ||
        item.marketplace.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return marketMatch && catMatch && queryMatch;
    });
  }, [allStorefrontProducts, selectedMarketplace, selectedCategory, searchQuery]);

  const likedProductIds = useMemo(
    () => new Set(likedItems.map((l) => l.productId)),
    [likedItems]
  );

  const handleToggleLike = async (product: AffiliateProduct) => {
    const isLiked = likedProductIds.has(product.id);
    await toggleLikedProduct({
      uid: user.uid,
      product,
      isCurrentlyLiked: isLiked,
    });
    flashStatus(
      isLiked
        ? `Removed "${product.title}" from My History.`
        : `Saved "${product.title}" to My History.`
    );
  };

  const handleLinkManualInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteWindow.allowed) {
      flashStatus('Invite code cannot be verified after 24 hours of account creation.');
      return;
    }
    setLinkingInvite(true);
    try {
      const res = await linkUserToInviteCode({
        inviteeUid: user.uid,
        inviteeName: profile?.displayName || user.displayName || 'Mezone Shopper',
        inviteeEmail: profile?.email || user.email || '',
        inviterCodeRaw: manualInviteCode,
        accountCreatedAt: profile?.createdAt,
        authCreationTime: user.metadata?.creationTime,
      });
      flashStatus(res.message);
      if (res.ok) setManualInviteCode('');
    } finally {
      setLinkingInvite(false);
    }
  };

  const handleScreenshotFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setProofAttachment(compressed);
      setProofError(null);
      flashStatus('Order proof screenshot attached.');
    } catch {
      setProofError('Could not process that image. Please choose a valid JPG or PNG.');
      flashStatus('Could not process that image. Please choose a valid JPG or PNG.');
    }
  };

  const handleSubmitOrderProof = async (e: FormEvent) => {
    e.preventDefault();
    setProofError(null);
    if (!proofOrderRef.trim() || !proofProductTitle.trim() || !proofNotes.trim()) {
      setProofError('Please complete Order ID, Product Purchased, and Order Confirmation Details.');
      flashStatus('Please complete Order ID, Product Title, and Proof Details.');
      return;
    }
    if (!proofAttachment || proofAttachment.trim().length < 20) {
      setProofError('Order receipt screenshot is required. Please upload your order screenshot.');
      flashStatus('Order receipt screenshot is required.');
      return;
    }

    const shopperName = profile?.displayName || user.displayName || 'Mezone Shopper';
    const shopperEmail = user.email || '';
    const qtyNum = Number(proofQty) || 1;

    setSubmittingProof(true);
    try {
      const proofId = await submitOrderProof({
        uid: user.uid,
        userName: shopperName,
        userEmail: shopperEmail,
        marketplace: proofMarketplace,
        productTitle: proofProductTitle,
        orderReference: proofOrderRef,
        quantity: qtyNum,
        proofNotes,
        proofAttachment,
      });

      const waUrl = buildWhatsAppOrderProofUrl({
        userName: shopperName,
        userEmail: shopperEmail,
        marketplace: proofMarketplace,
        productTitle: proofProductTitle,
        orderReference: proofOrderRef,
        quantity: qtyNum,
        proofNotes,
        proofId,
      });
      setLastSubmittedWhatsAppUrl(waUrl);

      setProofOrderRef('');
      setProofQty('1');
      setProofNotes('');
      setProofAttachment('');
      flashStatus(
        `Order proof submitted! Click "Send to WhatsApp (${WHATSAPP_PROOF_DISPLAY})" to send your screenshot.`
      );
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleSavePersonalInfo = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneInputError(null);

    const phoneResult = normalizeInternationalPhone(editPhoneCode, editPhoneLocal);
    if (!phoneResult.ok) {
      setPhoneInputError(phoneResult.error || 'Enter a valid cell number without leading 0.');
      flashStatus(phoneResult.error || 'Enter a valid cell number without leading 0.');
      return;
    }

    setSavingProfile(true);
    try {
      await updatePersonalInformation(user.uid, {
        displayName: editName,
        phone: phoneResult.formatted,
        region: editRegion,
        birthDate: editBirthDate,
        gender: editGender,
        countryName: editCountryName,
        address: editAddress,
      });
      if (phoneResult.formatted.length >= 7 && !profile?.profileBonusClaimed) {
        flashStatus('Personal information saved! You can now claim +50 PKR in Wallet & Withdraw.');
      } else {
        flashStatus('Personal information saved.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // Delete Account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (isProtectedAdminAccount) {
      setDeleteError('Admin Center owner account is protected and cannot be deleted.');
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE in uppercase to confirm permanent account deletion.');
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteMezoneAccountData(
        user.uid,
        likedItems,
        profile?.inviteCode,
        user.email
      );
      try {
        await deleteUser(user);
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/requires-recent-login') {
          const providerId = user.providerData?.[0]?.providerId || '';
          if (providerId.includes('google')) {
            await reauthenticateWithPopup(user, googleProvider);
          } else if (providerId.includes('apple')) {
            await reauthenticateWithPopup(user, appleProvider);
          } else if (providerId.includes('facebook')) {
            await reauthenticateWithPopup(user, facebookProvider);
          } else if (providerId.includes('github')) {
            await reauthenticateWithPopup(user, githubProvider);
          } else if (providerId.includes('yahoo')) {
            await reauthenticateWithPopup(user, yahooProvider);
          } else if (deletePassword && user.email) {
            await reauthenticateWithCredential(
              user,
              EmailAuthProvider.credential(user.email, deletePassword)
            );
          } else {
            throw new Error(
              'Please enter your current password or re-authenticate before deleting your account.'
            );
          }
          await deleteUser(user);
        } else {
          throw err;
        }
      }
      onSignedOut();
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Unable to delete account. Please sign out and sign back in.'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    setAdminPinUnlocked(false);
    await signOut(auth);
    onSignedOut();
  };

  const handleRefreshVerification = async () => {
    await user.reload();
    setAuthRefreshTick((tick) => tick + 1);
    const verifiedNow = Boolean(auth.currentUser?.emailVerified || profile?.mailOtpVerified);
    setVerifyChecked(verifiedNow);
    await ensureUserProfile(auth.currentUser || user, undefined, undefined, {
      allowUnverified: true,
    });
    if (verifiedNow) {
      flashStatus('Mail Verify synced with Green Tick.');
    } else {
      flashStatus('Account active. Use New Account Mail Verify above to add a Green Tick.');
    }
  };

  const handleRefreshLinkedLogins = async () => {
    await user.reload();
    setVerifyChecked(Boolean(auth.currentUser?.emailVerified || profile?.mailOtpVerified));
    setAuthRefreshTick((tick) => tick + 1);
    await ensureUserProfile(auth.currentUser || user, undefined, undefined, {
      allowUnverified: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex flex-col">
      {/* Three-Zone Top Bar Contract + 3-Line Main Menu Trigger */}
      <header className="border-b border-black/10 bg-[#FAF9F6]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Main Menu"
              className="p-2 -ml-1 rounded-lg border border-black/10 bg-white text-[#111113] hover:bg-[#EFECE5] transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('product')}
              className="font-display text-xl font-bold tracking-tight text-[#111113] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mezone
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-4 lg:gap-5 text-[13px] font-medium overflow-x-auto">
            {(
              [
                ['product', 'Product'],
                ['history', 'My History'],
                ['referral', 'Reference Program'],
                ['wallet', 'Wallet'],
                ['helpcenter', 'Help Center'],
                ['policy', 'Law & Policy'],
                ['setting', 'Setting'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
                  activeTab === tabKey
                    ? 'text-[#111113] border-b-2 border-[#EA580C]'
                    : 'text-[#57534E] hover:text-[#111113]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="shrink-0 flex items-center gap-2">
            <ThemeToggleButton compact />
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs font-semibold bg-[#111113] text-white rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>
                Wallet · {displayWalletBalance.toLocaleString()} PKR
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Menu Sidebar (3-Line Drawer) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-80 max-w-[85vw] bg-white border-r border-black/10 h-full flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="h-16 px-5 border-b border-black/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-lg font-bold text-[#111113]">
                    Mezone
                  </span>
                  <span className="text-[11px] font-medium text-[#57534E]">
                    Main Menu
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close Main Menu"
                  className="p-1.5 rounded-lg text-[#57534E] hover:text-[#111113] hover:bg-[#FAF9F6] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-black/10 bg-[#FAF9F6]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-[#EFECE5] border border-black/10 shrink-0 flex items-center justify-center">
                    {profile?.photoUrl || user.photoURL ? (
                      <img
                        src={profile?.photoUrl || user.photoURL || ''}
                        alt={profile?.displayName || user.displayName || 'User'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-sm font-bold text-[#111113]">
                        {(profile?.displayName || user.displayName || user.email || 'MZ')
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111113] truncate">
                      {profile?.displayName || user.displayName || 'Mezone Shopper'}
                    </p>
                    <p className="text-[11px] text-[#57534E] truncate">{user.email}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('verification');
                        setSidebarOpen(false);
                      }}
                      className={`mt-1 text-[11px] font-semibold hover:underline cursor-pointer ${
                        verifyChecked ? 'text-emerald-700' : 'text-[#C2410C]'
                      }`}
                    >
                      {verifyChecked ? 'Verified Account' : 'Verify Mail Required →'}
                    </button>
                  </div>
                </div>
              </div>

              <nav className="p-3 space-y-1">
                {(
                  [
                    {
                      key: 'product' as const,
                      label: 'Product',
                      icon: ShoppingBag,
                      meta: `${filteredProducts.length}`,
                    },
                    {
                      key: 'history' as const,
                      label: 'My History',
                      icon: History,
                      meta: `${
                        myOrderProofs.length +
                        likedItems.length +
                        myWithdrawals.length
                      }`,
                    },
                    {
                      key: 'referral' as const,
                      label: 'Reference Program',
                      icon: Users,
                      meta: `${myInvitedReferrals.length}`,
                    },
                    {
                      key: 'wallet' as const,
                      label: 'Wallet',
                      icon: Wallet,
                      meta: `${displayWalletBalance.toLocaleString()} PKR`,
                      locked: false,
                    },
                    {
                      key: 'chat' as const,
                      label: 'Chat',
                      icon: MessageCircle,
                      meta: 'Coming Soon',
                      locked: true,
                    },
                    {
                      key: 'helpcenter' as const,
                      label: 'Help Center',
                      icon: LifeBuoy,
                      meta: '',
                      locked: false,
                    },
                    {
                      key: 'policy' as const,
                      label: 'Law & Policy',
                      icon: BookOpen,
                      meta: '',
                      locked: false,
                    },
                    {
                      key: 'setting' as const,
                      label: 'Setting',
                      icon: Settings,
                      meta: '',
                      locked: false,
                    },
                  ]
                ).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#FFF7ED] text-[#9A3412] font-semibold border border-[#EA580C]/25'
                          : 'text-[#111113] hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#EA580C]' : 'text-[#57534E]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </span>
                      {item.locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EFECE5] border border-black/10 text-[10px] font-semibold text-[#57534E]">
                          <Lock className="w-3 h-3 text-[#C2410C]" />
                          <span>{item.meta}</span>
                        </span>
                      ) : item.meta ? (
                        <span className="text-[11px] font-mono text-[#57534E] tabular-nums">
                          {item.meta}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-3 border-t border-black/10 space-y-1.5 bg-[#FAF9F6]">
              {canSeeAdminCenterOption && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('setting');
                    setSettingSection('admin');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'setting' && settingSection === 'admin'
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-[#FFF7ED] border border-[#EA580C]/30 text-[#9A3412] hover:bg-[#FFEDD5]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Admin Center</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    Admin Open
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('verification');
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'verification'
                    ? 'bg-[#111113] text-white'
                    : 'bg-white border border-black/10 text-[#111113] hover:bg-[#EFECE5]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#EA580C] shrink-0" />
                <span>Verification Center</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  void handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-[#9A3412] hover:bg-[#FFF7ED] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {!verifyChecked && (
        <div className="border-b border-[#EA580C]/30 bg-[#FFF7ED]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9A3412]">
            <p>
              <strong>Mail Verify for new accounts:</strong> Complete Mail Verify for{' '}
              <strong>{user.email}</strong> in Verification Center (or via inbox link). Login
              Accounts do not need Mail Verification.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await sendEmailVerification(user);
                    flashStatus(`Verification email sent to ${user.email}.`);
                  } catch {
                    flashStatus('Verification email sent recently. Check your inbox.');
                  }
                }}
                className="font-semibold underline underline-offset-2 cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={handleRefreshVerification}
                className="px-3 py-1.5 bg-[#EA580C] text-white font-semibold rounded-md hover:bg-[#C2410C] cursor-pointer"
              >
                I Have Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="max-w-7xl mx-auto px-6 pt-4 w-full">
          <div className="px-4 py-2.5 bg-white border border-black/10 rounded-lg text-xs font-medium text-[#111113] flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[#57534E] hover:text-[#111113] cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <BannerAdSlot position="top" pageGroup="workspace" className="mb-6" />

        {/* TAB 1: PRODUCT */}
        {activeTab === 'product' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-medium text-[#57534E] mb-1">
                  Mezone Curated Storefront · Temu & Amazon Official Affiliate Listings
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                  Shop Temu & Amazon Affiliate Products
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#57534E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Temu & Amazon items..."
                    className="h-10 w-full sm:w-64 pl-9 pr-3 text-sm bg-white border border-black/15 rounded-lg text-[#111113] placeholder:text-[#78716C] focus:outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFECE5] rounded-lg">
                {MARKETPLACES.map((mkt) => (
                  <button
                    key={mkt}
                    type="button"
                    onClick={() => setSelectedMarketplace(mkt)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedMarketplace === mkt
                        ? 'bg-white text-[#111113] shadow-sm'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    {mkt === 'All' ? 'All Stores' : mkt}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFECE5] rounded-lg">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white text-[#111113] shadow-sm'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white border border-black/10 rounded-xl p-12 text-center">
                <p className="text-sm font-medium text-[#111113] mb-2">
                  No products match your current filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMarketplace('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-[#EA580C] underline underline-offset-4 cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredProducts.map((product) => {
                  const isLiked = likedProductIds.has(product.id);
                  return (
                    <article
                      key={product.id}
                      className="bg-white border border-black/10 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE5] text-left cursor-pointer"
                      >
                        <SafeImage
                          src={product.imageUrl}
                          alt={product.title}
                          fallbackTitle={product.title}
                          className={`w-full h-full object-cover ${product.imageFocusClass || ''}`}
                        />
                      </button>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 text-xs text-[#57534E]">
                              <span className="font-semibold text-[#C2410C]">
                                {product.marketplace}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{product.category}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleLike(product)}
                              aria-label={
                                isLiked ? 'Remove from My Liked' : 'Add to My Liked'
                              }
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                isLiked
                                  ? 'text-[#EA580C]'
                                  : 'text-[#78716C] hover:text-[#111113]'
                              }`}
                            >
                              <Heart
                                className="w-4 h-4"
                                fill={isLiked ? 'currentColor' : 'none'}
                              />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className="text-left text-base font-semibold text-[#111113] hover:text-[#EA580C] transition-colors leading-snug mb-1 cursor-pointer"
                          >
                            {product.title}
                          </button>

                          <p className="text-[11px] font-mono text-[#57534E] mb-2">
                            Code: {product.productCode || product.id}
                          </p>

                          <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed mb-4">
                            {product.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/10">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-base font-semibold text-[#111113] tabular-nums">
                              ${product.price.toFixed(2)}
                            </span>
                            {product.compareAtPrice > product.price && (
                              <span className="font-mono text-xs text-[#57534E] line-through tabular-nums">
                                ${product.compareAtPrice.toFixed(2)}
                              </span>
                            )}
                          </div>

                          <a
                            href={product.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] transition-colors whitespace-nowrap shrink-0"
                          >
                            <span>Shop Now</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY HISTORY (Orders, Saved Liked & Withdrawals) */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#C2410C] mb-1">
                  Account Activity, Orders &amp; Saved Favorites
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                  My History
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('verification')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Verification Center</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('product')}
                  className="px-3.5 py-2 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] cursor-pointer"
                >
                  Browse Products
                </button>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 border border-black/10 rounded-xl bg-white divide-y sm:divide-y-0 sm:divide-x divide-black/10">
              <div className="p-5">
                <p className="text-xs text-[#57534E] mb-1">Order Proofs</p>
                <p className="font-mono text-2xl font-semibold text-[#111113] tabular-nums">
                  {myOrderProofs.length}
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs text-[#57534E] mb-1">Saved Liked Products</p>
                <p className="font-mono text-2xl font-semibold text-[#C2410C] tabular-nums">
                  {likedItems.length}
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs text-[#57534E] mb-1">Withdraw Requests</p>
                <p className="font-mono text-2xl font-semibold text-[#111113] tabular-nums">
                  {myWithdrawals.length}
                </p>
              </div>
            </div>

            {/* Sub-filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFECE5] rounded-lg w-fit">
              {(
                [
                  ['all', 'All Activity'],
                  ['orders', `Order Proofs (${myOrderProofs.length})`],
                  ['liked', `My Liked (${likedItems.length})`],
                  ['withdrawals', `Withdraw History (${myWithdrawals.length})`],
                ] as const
              ).map(([subKey, label]) => (
                <button
                  key={subKey}
                  type="button"
                  onClick={() => setHistorySubTab(subKey)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    historySubTab === subKey
                      ? 'bg-white text-[#111113] shadow-sm'
                      : 'text-[#57534E] hover:text-[#111113]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 1. Order Proof History */}
            {(historySubTab === 'all' || historySubTab === 'orders') && (
              <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#111113]">
                    Order Proof History ({myOrderProofs.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('referral');
                      setReferralSubTab('referral');
                    }}
                    className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    + Submit Order Proof
                  </button>
                </div>
                {myOrderProofs.length === 0 ? (
                  <div className="p-6 text-xs text-[#57534E]">
                    No order proofs submitted yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-black/10">
                    {myOrderProofs.map((proof) => (
                      <li key={proof.id} className="px-6 py-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#111113]">
                            {proof.productTitle}
                          </p>
                          <span
                            className={`text-xs font-semibold capitalize ${
                              proof.status === 'approved'
                                ? 'text-emerald-700'
                                : proof.status === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-[#C2410C]'
                            }`}
                          >
                            {proof.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#57534E]">
                          {proof.marketplace} · Order{' '}
                          <span className="font-mono text-[#111113]">{proof.orderReference}</span> ·{' '}
                          <span className="font-mono tabular-nums">
                            {proof.quantity} product(s)
                          </span>
                        </p>
                        {proof.adminNote && (
                          <p className="text-xs text-[#57534E]">Admin note: {proof.adminNote}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 2. Saved / My Liked Products */}
            {(historySubTab === 'all' || historySubTab === 'liked') && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-[#111113]">
                  Saved &amp; Liked Products ({likedItems.length})
                </h2>

                {likedItems.length === 0 ? (
                  <div className="bg-white border border-black/10 rounded-xl p-10 text-center">
                    <p className="text-sm text-[#57534E] mb-4">
                      You have not liked any Temu or Amazon products yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className="px-4 py-2 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] cursor-pointer"
                    >
                      Browse Product Catalog
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                    {likedItems.map((item) => (
                      <article
                        key={item.id}
                        className="bg-white border border-black/10 rounded-xl overflow-hidden flex flex-col"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE5]">
                          <SafeImage
                            src={item.imageUrl}
                            alt={item.title}
                            fallbackTitle={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-[#57534E] mb-2">
                              <span className="font-semibold text-[#C2410C]">
                                {item.marketplace}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.category}</span>
                            </div>
                            <h3 className="text-base font-semibold text-[#111113] leading-snug mb-3">
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-black/10">
                            <span className="font-mono text-base font-semibold text-[#111113] tabular-nums">
                              ${item.price.toFixed(2)}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeLikedItemById(item.id)}
                                className="px-3 py-2 text-xs font-medium bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] text-[#57534E] cursor-pointer"
                              >
                                Remove
                              </button>
                              <a
                                href={item.affiliateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] transition-colors whitespace-nowrap"
                              >
                                <span>Shop Now</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Withdraw History */}
            {(historySubTab === 'all' || historySubTab === 'withdrawals') && (
              <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[#111113]">
                    Withdraw History ({myWithdrawals.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('wallet')}
                    className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    Open Wallet →
                  </button>
                </div>
                {myWithdrawals.length === 0 ? (
                  <div className="p-6 text-xs text-[#57534E]">
                    No withdrawal requests submitted yet.
                  </div>
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
                          Requested: {wd.amount} PKR · Net Payout: {wd.netAmountPkr}{' '}
                          PKR (5% Tax + 2% Fee) · Cell: {wd.cellNumber}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2B: DEDICATED WALLET TAB */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-[#C2410C] mb-1">
                Mezone PKR Wallet, Daily Login Tokens &amp; Withdraw
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                My Wallet
              </h1>
            </div>
            <WalletWithdrawSection
              uid={user.uid}
              userEmail={user.email || ''}
              isVerified={true}
              profile={profile}
              myWithdrawals={myWithdrawals}
              onFlashStatus={flashStatus}
              onGoToPersonalInfo={() => {
                setActiveTab('setting');
                setSettingSection('personal');
              }}
            />
          </div>
        )}

        {/* TAB 2C: LOCKED CHAT PAGE (COMING SOON) */}
        {activeTab === 'chat' && (
          <div className="max-w-2xl mx-auto py-8">
            <div className="bg-white border border-black/10 rounded-xl p-8 sm:p-10 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#FFF7ED] border border-[#EA580C]/30 text-[#EA580C] flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFECE5] border border-black/10 text-[11px] font-semibold text-[#9A3412]">
                  <Lock className="w-3 h-3" />
                  <span>Locked · Coming Soon</span>
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                  Mezone Chat — Coming Soon
                </h1>
                <p className="text-sm text-[#57534E] leading-relaxed max-w-md mx-auto">
                  Direct community &amp; shopper messaging is currently locked while we finalize the
                  Mezone Chat experience. In the meantime, you can reach Mezone Support in Help
                  Center or browse curated products.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('helpcenter')}
                  className="h-10 px-5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] inline-flex items-center gap-2 cursor-pointer"
                >
                  <LifeBuoy className="w-4 h-4" />
                  <span>Go to Help Center</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('product')}
                  className="h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] inline-flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Browse Products</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REFERRAL PROGRAM (INVITE PROGRAM ONLY) */}
        {activeTab === 'referral' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#C2410C] mb-1">
                  Mezone Invite Program &amp; Rewards Wallet
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                  {referralSubTab === 'wallet'
                    ? 'PKR Wallet, 30-Day Tokens & Withdraw'
                    : 'Invite Program · 1 User = 500 PKR'}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFECE5] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setReferralSubTab('referral')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      referralSubTab === 'referral'
                        ? 'bg-white text-[#111113] shadow-sm'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    Invite Program
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferralSubTab('wallet')}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      referralSubTab === 'wallet'
                        ? 'bg-white text-[#111113] shadow-sm'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    Wallet & Withdraw ({displayWalletBalance.toLocaleString()} PKR)
                  </button>
                </div>

                {profile?.inviteCode ? (
                  <div className="flex flex-wrap items-center gap-3 bg-white border border-black/10 rounded-lg px-4 py-2">
                    <span className="text-xs text-[#57534E]">Invite ID</span>
                    <span className="font-mono text-sm font-semibold text-[#111113]">
                      {profile.inviteCode}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(profile.inviteCode);
                        } catch {
                          // ignore
                        }
                        setCopiedCode(true);
                        window.setTimeout(() => setCopiedCode(false), 2000);
                        flashStatus(`Invite ID copied (${profile.inviteCode}).`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#111113] hover:text-[#EA580C] cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const shareText = `Join Mezone at ${window.location.origin} and apply my Invite ID (${profile.inviteCode}) in Reference Program within 24h!`;
                        try {
                          await navigator.clipboard.writeText(shareText);
                        } catch {
                          // ignore
                        }
                        flashStatus(`Invite share message copied (${profile.inviteCode}).`);
                      }}
                      className="text-xs font-semibold text-[#EA580C] hover:text-[#C2410C] cursor-pointer"
                    >
                      Copy Share
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {!rewardStatus.isActive && (
              <div className="rounded-xl border border-[#EA580C]/30 bg-[#FFF7ED] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9A3412]">
                <span className="inline-flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Reward Expired:</strong> Referral 500 PKR reward payouts start on{' '}
                    <strong>{REWARD_SYSTEM_START_LABEL}</strong>.
                  </span>
                </span>
                <span className="font-mono font-semibold shrink-0">
                  {rewardStatus.countdownLabel}
                </span>
              </div>
            )}

            {referralSubTab === 'wallet' ? (
              <WalletWithdrawSection
                uid={user.uid}
                userEmail={user.email || ''}
                isVerified={true}
                profile={profile}
                myWithdrawals={myWithdrawals}
                onFlashStatus={flashStatus}
                onGoToPersonalInfo={() => {
                  setActiveTab('setting');
                  setSettingSection('personal');
                }}
              />
            ) : (
              <>
            {/* Top Card (Earning, Yesterday earning, Weekly earning, Withdraw money) + Account Invite UID, Status, Reference Task & Analysis For Add User */}
            <ReferenceAnalyticsSection
              user={user}
              verifyChecked={true}
              profile={profile}
              myInvitedReferrals={myInvitedReferrals}
              myInviterRecord={myInviterRecord}
              myWithdrawals={myWithdrawals}
              onOpenWallet={() => setActiveTab('wallet')}
              onGoToVerification={() => setActiveTab('verification')}
              onFlashStatus={flashStatus}
            />

            {/* Accept Referral Rule 3-Step Panel */}
            <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8">
              <h2 className="text-base font-semibold text-[#111113] mb-4">
                Accept Referral Rule
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
                  <p className="text-xs font-mono text-[#C2410C] mb-1">Step 01</p>
                  <p className="text-sm font-semibold text-[#111113] mb-1">
                    Create Account with User Invite Code
                  </p>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    New user registers on Mezone using your personal Invite Code or invite
                    registration link.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
                  <p className="text-xs font-mono text-[#C2410C] mb-1">Step 02</p>
                  <p className="text-sm font-semibold text-[#111113] mb-1">
                    Buy 10 Products with Order Proof
                  </p>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    The invited user shops 10 Temu or Amazon products and submits their Order
                    ID & purchase proof below.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#FAF9F6] border border-black/10">
                  <p className="text-xs font-mono text-[#C2410C] mb-1">Step 03</p>
                  <p className="text-sm font-semibold text-[#111113] mb-1">
                    Order Approved → Referral Accepted
                  </p>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    Once Admin approves 10 purchased products, the referral is marked Accepted
                    and 500 PKR is credited.
                  </p>
                </div>
              </div>
            </div>

            {/* Two-Column Interactive Referral Action Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Invite Qualification + Submit Order Proof */}
              <div className="lg:col-span-6 space-y-6">
                {/* Invited Status / Link Invite Code & Reference Track */}
                <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-[#111113]">
                      Your Invite Qualification &amp; Reference Track
                    </h2>
                    <span className="text-[11px] font-mono font-semibold text-[#C2410C]">
                      Official Code: {OFFICIAL_INVITE_CODE}
                    </span>
                  </div>

                  {myInviterRecord ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-lg bg-[#FAF9F6] border border-black/10 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#57534E]">Ref User Name:</span>
                          <span className="font-semibold text-[#111113]">
                            {myInviterRecord.inviterName ||
                              (myInviterRecord.inviterCode === OFFICIAL_INVITE_CODE
                                ? OFFICIAL_INVITER_NAME
                                : 'Mezone Referrer')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#57534E]">Invite Code Used:</span>
                          <span className="font-mono font-semibold text-[#C2410C]">
                            {myInviterRecord.inviterCode}
                            {myInviterRecord.inviterCode === OFFICIAL_INVITE_CODE
                              ? ' (Official)'
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#57534E]">Reference Track Account ID:</span>
                          <span className="font-mono text-[#111113] truncate max-w-[200px]">
                            {user.uid}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#57534E]">
                        <span>Buy Product Qualification</span>
                        <span className="font-mono font-semibold text-[#C2410C] tabular-nums">
                          {Math.min(10, myInviterRecord.approvedProductCount)} / 10 Approved
                          Products
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-[#EFECE5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#EA580C] transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (myInviterRecord.approvedProductCount / 10) * 100
                            )}%`,
                          }}
                        />
                      </div>

                      <p className="text-xs text-[#57534E]">
                        Status:{' '}
                        <span className="font-semibold text-[#111113] capitalize">
                          {myInviterRecord.status === 'accepted'
                            ? 'Accepted (500 PKR Credited to Inviter)'
                            : 'Pending (Submit & Approve 10 Products)'}
                        </span>
                      </p>
                    </div>
                  ) : !inviteWindow.allowed ? (
                    <div className="p-4 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 space-y-1">
                      <p className="text-xs font-semibold text-[#9A3412]">
                        24-Hour Invite Code Window Expired
                      </p>
                      <p className="text-xs text-[#57534E] leading-relaxed">
                        Invite codes can only be verified within 24 hours of creating a new Mezone
                        account. This account is past the 24-hour verification window.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleLinkManualInvite} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-[#57534E] leading-relaxed">
                          Enter a User Invite Code within 24h of account creation (
                          <span className="font-mono font-semibold text-[#111113]">
                            {inviteWindow.hoursRemaining}h {inviteWindow.minutesRemaining}m left
                          </span>
                          ):
                        </p>
                        <button
                          type="button"
                          onClick={() => setManualInviteCode(OFFICIAL_INVITE_CODE)}
                          className="text-[11px] font-mono font-semibold text-[#C2410C] hover:underline cursor-pointer"
                        >
                          Use Official: {OFFICIAL_INVITE_CODE}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          maxLength={24}
                          value={manualInviteCode}
                          onChange={(e) => setManualInviteCode(e.target.value.toUpperCase())}
                          placeholder={`Enter Invite Code (Official: ${OFFICIAL_INVITE_CODE})`}
                          className="flex-1 h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                        />
                        <button
                          type="submit"
                          disabled={linkingInvite}
                          className="h-10 px-4 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                        >
                          {linkingInvite ? 'Linking...' : 'Apply Code'}
                        </button>
                      </div>
                      {lookupRefName && (
                        <p className="text-xs font-medium text-emerald-700">
                          Ref User Name: <span className="font-semibold">{lookupRefName}</span>
                        </p>
                      )}
                    </form>
                  )}
                </div>

                {/* Submit Order Proof Form */}
                <div className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#111113]">
                      Submit Order Proof (Temu / Amazon Purchase)
                    </h2>
                    <p className="text-xs text-[#57534E] mt-1">
                      Screenshot is required. Submit your Order ID & screenshot below, then
                      send your proof to WhatsApp{' '}
                      <span className="font-mono font-semibold text-[#111113]">
                        {WHATSAPP_PROOF_DISPLAY}
                      </span>
                      .
                    </p>
                  </div>

                  {proofError && (
                    <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/40 text-xs text-[#9A3412]">
                      {proofError}
                    </div>
                  )}

                  {lastSubmittedWhatsAppUrl && (
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2.5">
                      <p className="text-xs font-medium text-emerald-900">
                        Order proof saved! Now send your order screenshot directly to Mezone
                        WhatsApp ({WHATSAPP_PROOF_DISPLAY}):
                      </p>
                      <a
                        href={lastSubmittedWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send Screenshot to WhatsApp ({WHATSAPP_PROOF_DISPLAY})</span>
                      </a>
                    </div>
                  )}

                  <form onSubmit={handleSubmitOrderProof} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="proof-mkt"
                          className="block text-xs font-medium text-[#111113] mb-1"
                        >
                          Store
                        </label>
                        <select
                          id="proof-mkt"
                          value={proofMarketplace}
                          onChange={(e) =>
                            setProofMarketplace(e.target.value as MarketplaceType)
                          }
                          className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                        >
                          <option value="Temu">Temu</option>
                          <option value="Amazon">Amazon</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="proof-qty"
                          className="block text-xs font-medium text-[#111113] mb-1"
                        >
                          Products Bought (1–10)
                        </label>
                        <input
                          id="proof-qty"
                          type="number"
                          min={1}
                          max={10}
                          required
                          value={proofQty}
                          onChange={(e) => setProofQty(e.target.value)}
                          className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="proof-title"
                        className="block text-xs font-medium text-[#111113] mb-1"
                      >
                        Product Purchased
                      </label>
                      <input
                        id="proof-title"
                        type="text"
                        required
                        maxLength={140}
                        value={proofProductTitle}
                        onChange={(e) => setProofProductTitle(e.target.value)}
                        placeholder="Product name from Temu or Amazon"
                        className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="proof-order-id"
                        className="block text-xs font-medium text-[#111113] mb-1"
                      >
                        Official Temu / Amazon Order ID
                      </label>
                      <input
                        id="proof-order-id"
                        type="text"
                        required
                        minLength={3}
                        maxLength={64}
                        value={proofOrderRef}
                        onChange={(e) => setProofOrderRef(e.target.value)}
                        placeholder="e.g. PO-044-9281736 or 114-3928174"
                        className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="proof-notes"
                        className="block text-xs font-medium text-[#111113] mb-1"
                      >
                        Order Confirmation Details / Receipt URL
                      </label>
                      <textarea
                        id="proof-notes"
                        required
                        rows={2}
                        maxLength={300}
                        value={proofNotes}
                        onChange={(e) => setProofNotes(e.target.value)}
                        placeholder="Paste order confirmation text, total paid, or receipt link..."
                        className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#111113] mb-1.5">
                        Order Screenshot <span className="text-[#EA580C]">(Required)</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#FAF9F6] border border-black/15 rounded-lg hover:bg-[#EFECE5] cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>
                            {proofAttachment ? 'Replace Screenshot' : 'Upload Order Screenshot'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleScreenshotFile}
                            className="hidden"
                          />
                        </label>
                        {proofAttachment ? (
                          <button
                            type="button"
                            onClick={() => setProofAttachment('')}
                            className="text-xs text-[#9A3412] underline underline-offset-2 cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#57534E]">
                            Required before submitting or sending to WhatsApp
                          </span>
                        )}
                      </div>

                      {proofAttachment && (
                        <div className="mt-2.5 p-2 bg-[#FAF9F6] border border-black/10 rounded-lg inline-block">
                          <img
                            src={proofAttachment}
                            alt="Order screenshot preview"
                            className="max-h-32 rounded object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="submit"
                        disabled={submittingProof}
                        className="h-10 px-4 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        {submittingProof ? 'Submitting Proof...' : 'Submit Order Proof'}
                      </button>

                      {proofAttachment ? (
                        <a
                          href={buildWhatsAppOrderProofUrl({
                            userName: profile?.displayName || user.displayName || 'Mezone Shopper',
                            userEmail: user.email || '',
                            marketplace: proofMarketplace,
                            productTitle: proofProductTitle || 'Mezone Product',
                            orderReference: proofOrderRef || 'Pending-ID',
                            quantity: Number(proofQty) || 1,
                            proofNotes: proofNotes || 'Sending order screenshot on WhatsApp',
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-10 px-4 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Send to WhatsApp {WHATSAPP_PROOF_DISPLAY}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setProofError(
                              `Order screenshot is required before sending proof to WhatsApp (${WHATSAPP_PROOF_DISPLAY}).`
                            );
                            flashStatus('Please upload your order screenshot first.');
                          }}
                          className="h-10 px-4 bg-[#EFECE5] text-[#57534E] border border-black/15 text-xs font-semibold rounded-lg hover:bg-[#E7E2D8] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Send to WhatsApp {WHATSAPP_PROOF_DISPLAY}</span>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column: My Invited Users + My Order Proofs */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-black/10">
                    <h2 className="text-base font-semibold text-[#111113]">
                      Users Joined With Your Invite Code ({myInvitedReferrals.length})
                    </h2>
                  </div>
                  {myInvitedReferrals.length === 0 ? (
                    <div className="p-6 text-xs text-[#57534E]">
                      No users have registered with your invite code yet. Share your Invite
                      Link above to earn 500 PKR per accepted user.
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/10">
                      {myInvitedReferrals.map((ref) => (
                        <li
                          key={ref.id}
                          className="px-6 py-4 flex items-center justify-between gap-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#111113]">
                              {ref.inviteeName}
                            </p>
                            <p className="text-xs font-mono text-[#57534E] tabular-nums">
                              {Math.min(10, ref.approvedProductCount)} / 10 approved products
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              ref.status === 'accepted'
                                ? 'text-emerald-700'
                                : 'text-[#C2410C]'
                            }`}
                          >
                            {ref.status === 'accepted' ? 'Accepted · +500 PKR' : 'Pending'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-black/10">
                    <h2 className="text-base font-semibold text-[#111113]">
                      Your Submitted Order Proofs ({myOrderProofs.length})
                    </h2>
                  </div>
                  {myOrderProofs.length === 0 ? (
                    <div className="p-6 text-xs text-[#57534E]">
                      No order proofs submitted yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/10">
                      {myOrderProofs.map((proof) => (
                        <li key={proof.id} className="px-6 py-4 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#111113]">
                              {proof.productTitle}
                            </p>
                            <span
                              className={`text-xs font-semibold capitalize ${
                                proof.status === 'approved'
                                  ? 'text-emerald-700'
                                  : proof.status === 'rejected'
                                    ? 'text-red-700'
                                    : 'text-[#C2410C]'
                              }`}
                            >
                              {proof.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#57534E]">
                            {proof.marketplace} · Order{' '}
                            <span className="font-mono">{proof.orderReference}</span> ·{' '}
                            <span className="font-mono tabular-nums">
                              {proof.quantity} product(s)
                            </span>
                          </p>
                          {proof.adminNote && (
                            <p className="text-xs text-[#57534E]">
                              Admin note: {proof.adminNote}
                            </p>
                          )}
                          <div className="pt-1">
                            <a
                              href={buildWhatsAppOrderProofUrl({
                                userName: proof.userName,
                                userEmail: proof.userEmail,
                                marketplace: proof.marketplace,
                                productTitle: proof.productTitle,
                                orderReference: proof.orderReference,
                                quantity: proof.quantity,
                                proofNotes: proof.proofNotes,
                                proofId: proof.id,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] hover:underline underline-offset-2"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Send Proof to WhatsApp ({WHATSAPP_PROOF_DISPLAY})</span>
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3B: VERIFICATION CENTER */}
        {activeTab === 'verification' && (
          <VerificationCenterSection
            user={user}
            isVerified={Boolean(user.emailVerified || profile?.mailOtpVerified)}
            profile={profile}
            myOrderProofs={myOrderProofs}
            onRefreshVerification={handleRefreshVerification}
            onFlashStatus={flashStatus}
            onGoToPersonalInfo={() => {
              setActiveTab('setting');
              setSettingSection('personal');
            }}
          />
        )}

        {/* TAB 3C: HELPCENTER */}
        {activeTab === 'helpcenter' && (
          <HelpcenterSection
            uid={user.uid}
            userName={profile?.displayName || user.displayName || 'Mezone Shopper'}
            userEmail={user.email || ''}
            isVerified={true}
            profile={profile}
            myTickets={mySupportTickets}
            feedbackList={feedbackList}
            onFlashStatus={flashStatus}
            onGoToVerificationCenter={() => setActiveTab('verification')}
          />
        )}

        {/* TAB 4: LAW & POLICY */}
        {activeTab === 'policy' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <p className="text-xs font-medium text-[#C2410C] mb-1">
                Platform Governance & Compliance
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                Mezone Law & Policy
              </h1>
              <p className="text-sm text-[#57534E] mt-2">
                Clear terms governing how Mezone publishes Temu and Amazon affiliate
                products, verifies referrals, and protects your account information.
              </p>
            </div>

            <div className="bg-white border border-black/10 rounded-xl divide-y divide-black/10">
              <section className="p-6 sm:p-8 space-y-2">
                <h2 className="text-base font-semibold text-[#111113]">
                  01. Affiliate Disclosure (Temu & Amazon)
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Mezone participates in official Temu and Amazon affiliate marketing
                  programs. Products displayed in the Product tab link directly to the
                  official Temu or Amazon product page via the Shop Now button.
                </p>
              </section>

              <section className="p-6 sm:p-8 space-y-2">
                <h2 className="text-base font-semibold text-[#111113]">
                  02. Shopping-Only Storefront (No User Reselling)
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Mezone is a consumer product discovery and shopping platform, not a user
                  reselling marketplace. Mezone does not stock inventory or permit users to
                  resell listed items.
                </p>
              </section>

              <section className="p-6 sm:p-8 space-y-2">
                <h2 className="text-base font-semibold text-[#111113]">
                  03. Invite Program Rules (1 User = 500 PKR · 24h Window)
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  A referral is accepted only when a new user links a valid User Invite Code within
                  24 hours of account creation, purchases 10 Temu or Amazon products with
                  verifiable Order Proof, and those orders are approved by Mezone Admin.
                </p>
              </section>

              <section className="p-6 sm:p-8 space-y-2">
                <h2 className="text-base font-semibold text-[#111113]">
                  04. Rewards Wallet, Daily Tokens & Withdraw Policy
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Verified accounts receive 100 PKR on account creation, 300 PKR upon
                  buying 2 approved products, 50 PKR after completing Personal Information,
                  and 50 PKR for collecting 1,000 tokens over 30 daily logins. Withdrawals
                  unlock once verified with a minimum balance of 1,000 PKR (5% Tax + 2%
                  Fee applied).
                </p>
              </section>

              <section className="p-6 sm:p-8 space-y-2">
                <h2 className="text-base font-semibold text-[#111113]">
                  05. Mezone Auth & Personal Data Privacy
                </h2>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Your account details and My Liked products are stored securely in your
                  private Firestore profile. You can update Personal Information or
                  permanently delete your Mezone Account anytime under Setting.
                </p>
              </section>
            </div>
          </div>
        )}

        {/* TAB 5: SETTING */}
        {activeTab === 'setting' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-2">
              <div className="bg-white border border-black/10 rounded-xl p-2 space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingSection('personal')}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                    settingSection === 'personal'
                      ? 'bg-[#FAF9F6] text-[#111113] font-semibold'
                      : 'text-[#57534E] hover:text-[#111113]'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>Personal Information</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingSection('verification')}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                    settingSection === 'verification'
                      ? 'bg-[#FAF9F6] text-[#111113] font-semibold'
                      : 'text-[#57534E] hover:text-[#111113]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>Verification Center</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingSection('linked')}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                    settingSection === 'linked'
                      ? 'bg-[#FAF9F6] text-[#111113] font-semibold'
                      : 'text-[#57534E] hover:text-[#111113]'
                  }`}
                >
                  <Link2 className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>Linked Login</span>
                </button>

                {canSeeAdminCenterOption && (
                  <button
                    type="button"
                    onClick={() => setSettingSection('admin')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                      settingSection === 'admin'
                        ? 'bg-[#FAF9F6] text-[#111113] font-semibold'
                        : 'text-[#57534E] hover:text-[#111113]'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-[#EA580C] shrink-0" />
                    <span>Admin Center</span>
                  </button>
                )}

                {!isProtectedAdminAccount && (
                  <button
                    type="button"
                    onClick={() => setSettingSection('delete')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                      settingSection === 'delete'
                        ? 'bg-[#FFF7ED] text-[#9A3412] font-semibold'
                        : 'text-[#57534E] hover:text-[#9A3412]'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-[#C2410C] shrink-0" />
                    <span>Delete Account</span>
                  </button>
                )}

                <div className="pt-1 mt-1 border-t border-black/10">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg text-[#111113] hover:bg-[#FAF9F6] transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-[#57534E] shrink-0" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </aside>

            <section className="lg:col-span-8">
              {/* 1. PERSONAL INFORMATION */}
              {settingSection === 'personal' && (
                <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-6">
                  <div className="pb-4 border-b border-black/10">
                    <h1 className="font-display text-xl font-bold text-[#111113]">
                      Personal Information
                    </h1>
                    <p className="text-xs text-[#57534E] mt-1">
                      Manage your Mezone Auth shopper profile. Profile DP, Mail, Login Way, and
                      Account ID are fetched automatically from Firebase Auth.
                    </p>
                  </div>

                  {/* Read-only Profile DP (Fetched only, no change) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-[#FAF9F6] border border-black/10">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#EFECE5] border border-black/10 shrink-0 flex items-center justify-center">
                      {profile?.photoUrl || user.photoURL ? (
                        <img
                          src={profile?.photoUrl || user.photoURL || ''}
                          alt={editName || 'Profile DP'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-lg font-bold text-[#111113]">
                          {(editName || user.email || 'MZ')
                            .trim()
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-[#111113]">
                        Profile DP (Fetch Only · Read-only)
                      </p>
                      <p className="text-[11px] text-[#57534E]">
                        Synced directly from your sign-in provider. Profile photo cannot be changed
                        manually.
                      </p>
                      <p className="text-[11px] font-mono text-[#57534E]">
                        Login Way: <span className="text-[#111113]">{formatLoginWayLabel(user)}</span>
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSavePersonalInfo} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="pi-name"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Name
                        </label>
                        <input
                          id="pi-name"
                          type="text"
                          required
                          maxLength={80}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="pi-email"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Mail (Read-only)
                        </label>
                        <input
                          id="pi-email"
                          type="email"
                          disabled
                          value={user.email || ''}
                          className="w-full h-10 px-3 text-sm bg-[#EFECE5] border border-black/10 rounded-lg text-[#57534E]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="pi-login-way"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Login Way
                        </label>
                        <input
                          id="pi-login-way"
                          type="text"
                          disabled
                          value={formatLoginWayLabel(user)}
                          className="w-full h-10 px-3 text-sm bg-[#EFECE5] border border-black/10 rounded-lg text-[#57534E]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="pi-uid"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Account ID (Firebase UID)
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="pi-uid"
                            type="text"
                            disabled
                            value={user.uid}
                            className="flex-1 min-w-0 h-10 px-3 text-xs font-mono bg-[#EFECE5] border border-black/10 rounded-lg text-[#57534E]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(user.uid);
                                setCopiedAccountUid(true);
                                window.setTimeout(() => setCopiedAccountUid(false), 1800);
                                flashStatus('Account ID copied.');
                              } catch {
                                // ignore clipboard failure
                              }
                            }}
                            className="h-10 px-3 bg-white border border-black/15 rounded-lg text-xs font-semibold text-[#111113] hover:bg-[#FAF9F6] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            aria-label="Copy Account ID"
                          >
                            {copiedAccountUid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="pi-birth"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Birth of day
                        </label>
                        <input
                          id="pi-birth"
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="pi-gender"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Gender
                        </label>
                        <select
                          id="pi-gender"
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value as GenderOption)}
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
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <label
                            htmlFor="pi-country"
                            className="block text-xs font-medium text-[#111113]"
                          >
                            Country Name
                          </label>
                          <button
                            type="button"
                            disabled={detectingLocation}
                            onClick={async () => {
                              setDetectingLocation(true);
                              try {
                                const res = await detectUserCountryFromBrowserLocation();
                                if (res.ok) {
                                  if (res.countryName) setEditCountryName(res.countryName);
                                  if (res.dialCode) setEditPhoneCode(res.dialCode);
                                  if (res.region) setEditRegion(res.region);
                                  if (res.address) setEditAddress(res.address);
                                }
                                flashStatus(res.message);
                              } finally {
                                setDetectingLocation(false);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] hover:underline cursor-pointer disabled:opacity-60"
                          >
                            <LocateFixed className="w-3 h-3" />
                            <span>{detectingLocation ? 'Detecting...' : 'Detect'}</span>
                          </button>
                        </div>
                        <select
                          id="pi-country"
                          value={editCountryName}
                          onChange={(e) => {
                            const nextCountry = e.target.value;
                            setEditCountryName(nextCountry);
                            const matched = lookupCountryOption(nextCountry);
                            if (matched) {
                              setEditPhoneCode(matched.dialCode);
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
                          htmlFor="pi-phone-local"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Cell Number (Country Code · No Leading 0)
                        </label>
                        <div className="flex gap-2">
                          <select
                            aria-label="Country Calling Code"
                            value={editPhoneCode}
                            onChange={(e) => {
                              setEditPhoneCode(e.target.value);
                              setPhoneInputError(null);
                            }}
                            className="w-36 h-10 px-2.5 text-xs font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                          >
                            {COUNTRY_PHONE_OPTIONS.map((opt) => (
                              <option key={`${opt.iso2}-${opt.code}`} value={opt.code}>
                                {opt.code} ({opt.country})
                              </option>
                            ))}
                          </select>
                          <input
                            id="pi-phone-local"
                            type="tel"
                            inputMode="numeric"
                            maxLength={14}
                            value={editPhoneLocal}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              if (digits.startsWith('0')) {
                                setPhoneInputError(
                                  'Do not start cell number with 0 (enter e.g. 3001234567).'
                                );
                                setEditPhoneLocal(digits.replace(/^0+/, ''));
                              } else {
                                setPhoneInputError(null);
                                setEditPhoneLocal(digits);
                              }
                            }}
                            placeholder="3001234567"
                            className="flex-1 min-w-0 h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                          />
                        </div>
                        {phoneInputError ? (
                          <p className="text-[11px] text-[#9A3412] mt-1">{phoneInputError}</p>
                        ) : (
                          <p className="text-[11px] text-[#57534E] mt-1">
                            Saved as{' '}
                            <span className="font-mono text-[#111113]">
                              {editPhoneLocal ? `${editPhoneCode}${editPhoneLocal}` : `${editPhoneCode}...`}
                            </span>{' '}
                            (without leading 0) · Required for +50 PKR bonus.
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="pi-region"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Shopping Region & Currency
                        </label>
                        <select
                          id="pi-region"
                          value={editRegion}
                          onChange={(e) => setEditRegion(e.target.value)}
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
                          htmlFor="pi-address"
                          className="block text-xs font-medium text-[#111113]"
                        >
                          Address (With Location Auto-Fill)
                        </label>
                        <button
                          type="button"
                          disabled={detectingLocation}
                          onClick={async () => {
                            setDetectingLocation(true);
                            try {
                              const res = await detectUserCountryFromBrowserLocation();
                              if (res.ok) {
                                if (res.address) setEditAddress(res.address);
                                if (res.countryName) setEditCountryName(res.countryName);
                                if (res.dialCode) setEditPhoneCode(res.dialCode);
                                if (res.region) setEditRegion(res.region);
                              }
                              flashStatus(res.message);
                            } finally {
                              setDetectingLocation(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] hover:underline cursor-pointer disabled:opacity-60"
                        >
                          <LocateFixed className="w-3 h-3" />
                          <span>
                            {detectingLocation ? 'Detecting Location...' : 'Detect Address & Location'}
                          </span>
                        </button>
                      </div>
                      <textarea
                        id="pi-address"
                        rows={2}
                        maxLength={240}
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="House/Street, Area/Sector, City, Postal Code, Country"
                        className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
                      />
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                      <p className="text-xs text-[#57534E]">
                        Invite ID:{' '}
                        <span className="font-mono font-medium text-[#111113]">
                          {profile?.inviteCode || 'Generating...'}
                        </span>
                      </p>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-5 py-2.5 bg-[#111113] text-white text-xs font-semibold rounded-lg hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
                      >
                        {savingProfile ? 'Saving...' : 'Save Information'}
                      </button>
                    </div>
                  </form>

                  {/* Theme Appearance Selector */}
                  <div className="pt-5 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#111113]">
                        Appearance Theme (Light & Dark)
                      </p>
                      <p className="text-[11px] text-[#57534E]">
                        Switch Mezone between crisp editorial Light mode and low-glare Dark mode.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE5] rounded-lg w-fit">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white text-[#111113] shadow-sm'
                            : 'text-[#57534E] hover:text-[#111113]'
                        }`}
                      >
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-white text-[#111113] shadow-sm'
                            : 'text-[#57534E] hover:text-[#111113]'
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 1A. VERIFICATION CENTER INSIDE SETTING */}
              {settingSection === 'verification' && (
                <VerificationCenterSection
                  user={user}
                  isVerified={Boolean(user.emailVerified || profile?.mailOtpVerified)}
                  profile={profile}
                  myOrderProofs={myOrderProofs}
                  onRefreshVerification={handleRefreshVerification}
                  onFlashStatus={flashStatus}
                  onGoToPersonalInfo={() => setSettingSection('personal')}
                />
              )}

              {/* 1B. LINKED LOGIN INSIDE SETTING */}
              {settingSection === 'linked' && (
                <LinkedLoginSection
                  user={user}
                  onRefreshUser={handleRefreshLinkedLogins}
                  onFlashStatus={flashStatus}
                />
              )}

              {/* 1C. WALLET, BONUSES, 30-DAY TOKENS & WITHDRAW */}
              {settingSection === 'wallet' && (
                <WalletWithdrawSection
                  uid={user.uid}
                  userEmail={user.email || ''}
                  isVerified={true}
                  profile={profile}
                  myWithdrawals={myWithdrawals}
                  onFlashStatus={flashStatus}
                  onGoToPersonalInfo={() => setSettingSection('personal')}
                />
              )}

              {/* 2. ADMIN CENTER */}
              {settingSection === 'admin' && canSeeAdminCenterOption && (
                <AdminCenterSection
                  user={user}
                  publishedProducts={publishedProducts}
                  curatedOverrides={curatedOverrides}
                  adminOrderProofs={adminOrderProofs}
                  adminAllReferrals={adminAllReferrals}
                  adminWithdrawals={adminWithdrawals}
                  adminSupportTickets={adminSupportTickets}
                  adminFeedbackList={feedbackList}
                  categories={CATEGORIES}
                  unlockedByPin={adminPinUnlocked}
                  onPinUnlocked={() => setAdminPinUnlocked(true)}
                  onLockPin={() => setAdminPinUnlocked(false)}
                  onFlashStatus={flashStatus}
                  onLogout={handleLogout}
                />
              )}

              {/* 3. DELETE MEZONE ACCOUNT (Disabled for Protected Admin Account) */}
              {settingSection === 'delete' && !isProtectedAdminAccount && (
                <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
                  <div className="pb-4 border-b border-black/10">
                    <h1 className="font-display text-xl font-bold text-[#9A3412]">
                      Delete Mezone Account
                    </h1>
                    <p className="text-xs text-[#57534E] mt-1 leading-relaxed">
                      Permanently deletes your Mezone Auth credentials, Personal
                      Information, invite code, and saved My Liked items. This action
                      cannot be undone.
                    </p>
                  </div>

                  {deleteError && (
                    <div className="p-3.5 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
                      {deleteError}
                    </div>
                  )}

                  <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-md">
                    {user.providerData.some((p) => p.providerId === 'password') && (
                      <div>
                        <label
                          htmlFor="del-password"
                          className="block text-xs font-medium text-[#111113] mb-1.5"
                        >
                          Confirm Password (if prompted)
                        </label>
                        <input
                          id="del-password"
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Current account password"
                          className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="del-confirm"
                        className="block text-xs font-medium text-[#111113] mb-1.5"
                      >
                        Type <span className="font-mono font-bold">DELETE</span> to confirm
                      </label>
                      <input
                        id="del-confirm"
                        type="text"
                        required
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full h-10 px-3 text-sm font-mono bg-[#FAF9F6] border border-black/15 rounded-lg"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={deletingAccount}
                      className="h-10 px-5 bg-[#9A3412] text-white text-xs font-semibold rounded-lg hover:bg-[#7C2D12] disabled:opacity-60 cursor-pointer"
                    >
                      {deletingAccount
                        ? 'Deleting Account...'
                        : 'Permanently Delete Mezone Account'}
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        )}

        <BannerAdSlot position="bottom" pageGroup="workspace" className="mt-8" />
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white border border-black/10 rounded-xl max-w-3xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#EFECE5] aspect-[4/3] md:aspect-auto md:h-full">
              <SafeImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                fallbackTitle={selectedProduct.title}
                className={`w-full h-full object-cover ${selectedProduct.imageFocusClass || ''}`}
              />
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-[#57534E]">
                    <span className="font-semibold text-[#C2410C]">
                      {selectedProduct.marketplace}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedProduct.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close product modal"
                    className="p-1 text-[#57534E] hover:text-[#111113] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h2 className="font-display text-xl font-bold text-[#111113] mb-1">
                  {selectedProduct.title}
                </h2>
                <p className="text-xs font-mono text-[#57534E] mb-3">
                  Product Code: {selectedProduct.productCode || selectedProduct.id}
                </p>

                <div className="flex items-baseline gap-3 mb-4">
                  <span className="font-mono text-2xl font-semibold text-[#111113] tabular-nums">
                    ${selectedProduct.price.toFixed(2)}
                  </span>
                  {selectedProduct.compareAtPrice > selectedProduct.price && (
                    <span className="font-mono text-sm text-[#57534E] line-through tabular-nums">
                      ${selectedProduct.compareAtPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                <p className="text-sm text-[#57534E] leading-relaxed mb-6">
                  {selectedProduct.description}
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-black/10">
                <a
                  href={selectedProduct.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 px-4 bg-[#EA580C] text-white text-sm font-semibold rounded-lg hover:bg-[#C2410C] transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>Shop Now on {selectedProduct.marketplace}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => handleToggleLike(selectedProduct)}
                  className="w-full h-10 px-4 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#FAF9F6] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Heart
                    className="w-3.5 h-3.5 text-[#EA580C]"
                    fill={likedProductIds.has(selectedProduct.id) ? 'currentColor' : 'none'}
                  />
                  <span>
                    {likedProductIds.has(selectedProduct.id)
                      ? 'Saved in My Liked'
                      : 'Save to My Liked'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
