import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_SITE_BANNER_CONFIG } from './mezoneDb';
import { SiteBannerConfigRecord } from '../types/mezone';

const BANNER_CACHE_KEY = 'mezone_site_banner_ads_cache';

interface BannerAdsContextValue {
  bannerConfig: SiteBannerConfigRecord;
  loadedFromServer: boolean;
}

const BannerAdsContext = createContext<BannerAdsContextValue>({
  bannerConfig: DEFAULT_SITE_BANNER_CONFIG,
  loadedFromServer: false,
});

function readCachedBannerConfig(): SiteBannerConfigRecord {
  try {
    const raw = localStorage.getItem(BANNER_CACHE_KEY);
    if (!raw) return DEFAULT_SITE_BANNER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SiteBannerConfigRecord>;
    return {
      enabled:
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_SITE_BANNER_CONFIG.enabled,
      placementScope:
        parsed.placementScope === 'workspace' ||
        parsed.placementScope === 'public' ||
        parsed.placementScope === 'all'
          ? parsed.placementScope
          : DEFAULT_SITE_BANNER_CONFIG.placementScope,
      topBannerHtml:
        typeof parsed.topBannerHtml === 'string'
          ? parsed.topBannerHtml
          : DEFAULT_SITE_BANNER_CONFIG.topBannerHtml,
      bottomBannerHtml:
        typeof parsed.bottomBannerHtml === 'string'
          ? parsed.bottomBannerHtml
          : DEFAULT_SITE_BANNER_CONFIG.bottomBannerHtml,
    };
  } catch {
    return DEFAULT_SITE_BANNER_CONFIG;
  }
}

export function BannerAdsProvider({ children }: { children: ReactNode }) {
  const [bannerConfig, setBannerConfig] = useState<SiteBannerConfigRecord>(
    readCachedBannerConfig
  );
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  useEffect(() => {
    const bannerRef = doc(db, 'siteConfig', 'bannerAds');
    const unsub = onSnapshot(
      bannerRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteBannerConfigRecord>;
          const nextConfig: SiteBannerConfigRecord = {
            enabled:
              typeof data.enabled === 'boolean' ? data.enabled : true,
            placementScope:
              data.placementScope === 'workspace' ||
              data.placementScope === 'public' ||
              data.placementScope === 'all'
                ? data.placementScope
                : 'all',
            topBannerHtml:
              typeof data.topBannerHtml === 'string' ? data.topBannerHtml : '',
            bottomBannerHtml:
              typeof data.bottomBannerHtml === 'string' ? data.bottomBannerHtml : '',
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt,
          };
          setBannerConfig(nextConfig);
          try {
            localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(nextConfig));
          } catch {
            // ignore storage limits
          }
        }
        setLoadedFromServer(true);
      },
      () => {
        setLoadedFromServer(true);
      }
    );

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ bannerConfig, loadedFromServer }),
    [bannerConfig, loadedFromServer]
  );

  return (
    <BannerAdsContext.Provider value={value}>{children}</BannerAdsContext.Provider>
  );
}

export function useBannerAds(): BannerAdsContextValue {
  return useContext(BannerAdsContext);
}

interface BannerAdSlotProps {
  position: 'top' | 'bottom';
  pageGroup: 'public' | 'workspace';
  htmlOverride?: string;
  forceShow?: boolean;
  className?: string;
}

export function BannerAdSlot({
  position,
  pageGroup,
  htmlOverride,
  forceShow = false,
  className = '',
}: BannerAdSlotProps) {
  const { bannerConfig } = useBannerAds();
  const rawId = useId();
  const slotId = useMemo(() => `mz_ad_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);
  const [frameHeight, setFrameHeight] = useState(84);

  const html =
    htmlOverride !== undefined
      ? htmlOverride.trim()
      : (position === 'top'
          ? bannerConfig.topBannerHtml
          : bannerConfig.bottomBannerHtml
        ).trim();

  const scopeMatches =
    bannerConfig.placementScope === 'all' ||
    bannerConfig.placementScope === pageGroup;

  const shouldRender = forceShow
    ? html.length > 0
    : bannerConfig.enabled && scopeMatches && html.length > 0;

  useEffect(() => {
    if (!shouldRender) return;
    const onMessage = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string;
        id?: string;
        height?: number;
      } | null;
      if (
        payload &&
        payload.type === 'mezone-banner-height' &&
        payload.id === slotId &&
        typeof payload.height === 'number' &&
        Number.isFinite(payload.height)
      ) {
        const clamped = Math.max(52, Math.min(340, Math.ceil(payload.height)));
        setFrameHeight(clamped);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [slotId, shouldRender]);

  const srcDoc = useMemo(() => {
    if (!html) return '';
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      img, video, iframe { max-width: 100%; height: auto; }
      a { text-decoration: none; }
    </style>
  </head>
  <body>
    <div id="ad-root">${html}</div>
    <script>
      (function () {
        function notifyHeight() {
          var root = document.getElementById('ad-root');
          var h = root ? root.getBoundingClientRect().height : document.body.scrollHeight;
          window.parent.postMessage({ type: 'mezone-banner-height', id: '${slotId}', height: Math.max(48, Math.ceil(h)) }, '*');
        }
        window.addEventListener('load', notifyHeight);
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(notifyHeight).observe(document.body);
        }
        setTimeout(notifyHeight, 80);
        setTimeout(notifyHeight, 350);
      })();
    </script>
  </body>
</html>`;
  }, [html, slotId]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`w-full ${className}`} aria-label={`Sponsored Banner Ad (${position})`}>
      <div className="rounded-xl overflow-hidden border border-black/10 bg-white/70">
        <div className="px-3 py-1 bg-[#FAF9F6] border-b border-black/10 flex items-center justify-between text-[10px] font-medium text-[#57534E]">
          <span>Sponsored Banner Ad</span>
          <span className="font-mono uppercase">{position}</span>
        </div>
        <div className="p-2">
          <iframe
            title={`Mezone Banner Ad ${position}`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
            style={{ width: '100%', height: `${frameHeight}px`, border: 'none', display: 'block' }}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
