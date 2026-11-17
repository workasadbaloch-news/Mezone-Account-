import { ArrowRight, ExternalLink, Heart, ShieldCheck, ShoppingBag } from 'lucide-react';
import { CURATED_PRODUCTS, HERO_SHOWCASE_IMAGE } from '../data/catalog';
import { BannerAdSlot } from '../lib/bannerAds';
import { ThemeToggleButton } from '../lib/theme';
import { SafeImage } from './SafeImage';

interface WelcomePageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export function WelcomePage({ onGetStarted, onLogin }: WelcomePageProps) {
  const previewProducts = CURATED_PRODUCTS.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="border-b border-black/10 bg-[#FAF9F6]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-xl font-bold tracking-tight text-[#111113] whitespace-nowrap shrink-0"
          >
            Mezone
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]">
            <a
              href="#platform"
              className="hover:text-[#111113] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Platform
            </a>
            <a
              href="#catalog"
              className="hover:text-[#111113] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Catalog
            </a>
            <a
              href="#marketplaces"
              className="hover:text-[#111113] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Temu & Amazon
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#111113] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          <div className="shrink-0 flex items-center gap-2.5">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={onGetStarted}
              className="px-4 py-2 text-sm font-medium bg-[#EA580C] text-white rounded-lg hover:bg-[#C2410C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <BannerAdSlot position="top" pageGroup="public" />
        </div>

        {/* Hero Split Section */}
        <section id="platform" className="max-w-7xl mx-auto px-6 pt-8 pb-14 lg:pt-12 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium tracking-wide text-[#57534E] mb-4">
                Mezone Auth · Curated Temu & Amazon Shopping Platform
              </p>

              <h1 className="font-display text-[clamp(2.25rem,4vw,3.6rem)] font-bold tracking-tight leading-[1.08] text-[#111113] text-balance mb-6">
                Welcome to Mezone Digital Affiliate Marketing Platform
              </h1>

              <p className="text-base sm:text-lg text-[#57534E] leading-relaxed max-w-[54ch] mb-8">
                A dedicated shopping platform featuring hand-picked Temu and Amazon
                affiliate products. Sign in with Mezone Auth to browse curated finds, save
                favorites to My Liked, and shop directly from official stores.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#EA580C] text-white text-sm font-semibold rounded-lg hover:bg-[#C2410C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onLogin}
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-[#111113] border border-black/15 text-sm font-semibold rounded-lg hover:bg-[#F3F1EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  I have an account
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-black/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#57534E]">
                <span>Google, Apple, Facebook &amp; Yahoo Sign-In</span>
                <span aria-hidden="true">·</span>
                <span>Temu &amp; Amazon Deals</span>
                <span aria-hidden="true">·</span>
                <span>Direct Shop Now Links</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[320px] lg:min-h-[440px] rounded-xl overflow-hidden border border-black/10 bg-[#EFECE5]">
                <SafeImage
                  src={HERO_SHOWCASE_IMAGE}
                  alt="Curated Mezone lifestyle tech, desk lighting, and commuter gear"
                  fallbackTitle="Mezone Featured Collection"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Platform Strip */}
          <div
            id="marketplaces"
            className="mt-12 grid grid-cols-2 lg:grid-cols-4 border border-black/10 rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x divide-black/10"
          >
            <div className="p-6">
              <p className="text-xs text-[#57534E] mb-1">Partner Marketplaces</p>
              <p className="font-mono text-2xl font-semibold text-[#111113]">
                Temu & Amazon
              </p>
              <p className="text-xs text-[#57534E] mt-1">Official affiliate listings</p>
            </div>
            <div className="p-6">
              <p className="text-xs text-[#57534E] mb-1">Shopping Mode</p>
              <p className="font-mono text-2xl font-semibold text-[#111113]">
                Shop Now
              </p>
              <p className="text-xs text-[#57534E] mt-1">Direct official checkout</p>
            </div>
            <div className="p-6">
              <p className="text-xs text-[#57534E] mb-1">Personal Curation</p>
              <p className="font-mono text-2xl font-semibold text-[#111113]">
                My Liked
              </p>
              <p className="text-xs text-[#57534E] mt-1">Synced wishlist across devices</p>
            </div>
            <div className="p-6">
              <p className="text-xs text-[#57534E] mb-1">Account Access</p>
              <p className="font-mono text-2xl font-semibold text-[#111113]">
                Mezone Auth
              </p>
              <p className="text-xs text-[#57534E] mt-1">Google, Apple, or Email</p>
            </div>
          </div>
        </section>

        {/* Featured Catalog Preview */}
        <section id="catalog" className="border-t border-black/10 bg-white py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-xs font-medium text-[#C2410C] mb-2">
                  Curated Catalog Preview
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
                  Temu & Amazon Finds Ready to Shop
                </h2>
              </div>
              <button
                type="button"
                onClick={onGetStarted}
                className="text-sm font-semibold text-[#111113] hover:text-[#EA580C] underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-left"
              >
                Create account to browse full catalog
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {previewProducts.map((product) => (
                <article
                  key={product.id}
                  className="group bg-[#FAF9F6] border border-black/10 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFECE5]">
                    <SafeImage
                      src={product.imageUrl}
                      alt={product.title}
                      fallbackTitle={product.title}
                      className={`w-full h-full object-cover ${product.imageFocusClass || ''}`}
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#57534E] mb-2">
                        <span className="font-semibold text-[#C2410C]">
                          {product.marketplace}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{product.category}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#111113] leading-snug mb-3">
                        {product.title}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-black/10">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-base font-semibold text-[#111113] tabular-nums">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-[#57534E] line-through tabular-nums">
                          ${product.compareAtPrice.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={onGetStarted}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#EA580C] hover:text-[#C2410C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Shop Now
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How Mezone Shopping Works */}
        <section id="how-it-works" className="border-t border-black/10 bg-[#FAF9F6] py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113] mb-3">
                Simple, Transparent Affiliate Shopping
              </h2>
              <p className="text-sm sm:text-base text-[#57534E] leading-relaxed">
                Mezone connects shoppers directly to published Temu and Amazon affiliate
                products with zero middleman markups or reselling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white border border-black/10 rounded-xl p-6">
                <ShieldCheck className="w-5 h-5 text-[#EA580C] mb-4" />
                <h3 className="text-base font-semibold text-[#111113] mb-2">
                  01. Register with Mezone Auth
                </h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Sign up using Google or Apple login, or optionally register with your
                  name, email address, and password.
                </p>
              </div>

              <div className="bg-white border border-black/10 rounded-xl p-6">
                <Heart className="w-5 h-5 text-[#EA580C] mb-4" />
                <h3 className="text-base font-semibold text-[#111113] mb-2">
                  02. Browse & Save to My Liked
                </h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Filter curated Temu and Amazon products by marketplace or category and
                  bookmark your favorite picks in My Liked.
                </p>
              </div>

              <div className="bg-white border border-black/10 rounded-xl p-6">
                <ShoppingBag className="w-5 h-5 text-[#EA580C] mb-4" />
                <h3 className="text-base font-semibold text-[#111113] mb-2">
                  03. Shop Now on Official Stores
                </h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Every Shop Now button takes you straight to the official Temu or Amazon
                  product listing for secure checkout.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6 pb-10">
          <BannerAdSlot position="bottom" pageGroup="public" />
        </div>
      </main>

      <footer className="border-t border-black/10 bg-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#57534E]">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-[#111113]">Mezone</span>
            <span aria-hidden="true">·</span>
            <span>Curated Temu & Amazon Affiliate Shopping Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onGetStarted}
              className="hover:text-[#111113] transition-colors cursor-pointer"
            >
              Register
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="hover:text-[#111113] transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <span>© {new Date().getFullYear()} Mezone</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
