import { AffiliateProduct } from '../types/mezone';

export const HERO_SHOWCASE_IMAGE =
  '/src/assets/images/hero_mezone_showcase_1794892247219.jpg';

export const PRESET_STUDIO_IMAGES = [
  {
    label: 'Wireless Earbuds Studio',
    url: '/src/assets/images/product_wireless_earbuds_1794892247751.jpg',
  },
  {
    label: 'Cordless Desk Lamp',
    url: '/src/assets/images/product_desk_lamp_1794892247997.jpg',
  },
  {
    label: 'Commuter Backpack',
    url: '/src/assets/images/product_travel_backpack_1794892248053.jpg',
  },
  {
    label: 'Skincare Vanity Caddy',
    url: '/src/assets/images/product_skincare_organizer_1794892249448.jpg',
  },
  {
    label: 'Studio Lifestyle Showcase',
    url: '/src/assets/images/hero_mezone_showcase_1794892247219.jpg',
  },
];

export const CURATED_PRODUCTS: AffiliateProduct[] = [
  {
    id: 'tm_anc_earbuds',
    productCode: 'MZ-TM-101',
    title: 'AeroPulse Active Noise Cancelling Earbuds',
    marketplace: 'Temu',
    category: 'Tech & Audio',
    price: 24.9,
    compareAtPrice: 49.0,
    affiliateUrl: 'https://www.temu.com/search_result.html?search_key=anc+wireless+earbuds',
    imageUrl: '/src/assets/images/product_wireless_earbuds_1794892247751.jpg',
    description:
      'Matte charcoal hybrid ANC earbuds with 32-hour USB-C pocket charging case, low-latency mode, and crisp call microphones.',
    published: true,
    isCuratedDefault: true,
  },
  {
    id: 'az_cordless_lamp',
    productCode: 'MZ-AZ-102',
    title: 'Lumiere Cordless Aluminum LED Desk Lamp',
    marketplace: 'Amazon',
    category: 'Home & Living',
    price: 34.5,
    compareAtPrice: 64.0,
    affiliateUrl: 'https://www.amazon.com/s?k=cordless+led+desk+lamp+walnut',
    imageUrl: '/src/assets/images/product_desk_lamp_1794892247997.jpg',
    description:
      'Minimalist anodized aluminum reading bar on a solid walnut wood base with 3-stage warm touch dimming and 18-hour battery life.',
    published: true,
    isCuratedDefault: true,
  },
  {
    id: 'tm_commuter_pack',
    productCode: 'MZ-TM-103',
    title: 'Nomad 22L Weatherproof Travel Backpack',
    marketplace: 'Temu',
    category: 'Travel & Carry',
    price: 38.0,
    compareAtPrice: 72.0,
    affiliateUrl: 'https://www.temu.com/search_result.html?search_key=waterproof+commuter+backpack',
    imageUrl: '/src/assets/images/product_travel_backpack_1794892248053.jpg',
    description:
      'Structured water-resistant daily commuter pack featuring a padded 16-inch laptop compartment and quick-access vertical front zip.',
    published: true,
    isCuratedDefault: true,
  },
  {
    id: 'az_vanity_organizer',
    productCode: 'MZ-AZ-104',
    title: 'Fluted Glass & Ceramic Skincare Vanity Caddy',
    marketplace: 'Amazon',
    category: 'Beauty & Care',
    price: 19.9,
    compareAtPrice: 34.0,
    affiliateUrl: 'https://www.amazon.com/s?k=fluted+glass+skincare+organizer',
    imageUrl: '/src/assets/images/product_skincare_organizer_1794892249448.jpg',
    description:
      'Weighted stoneware base paired with smoked fluted dividers sized for dropper serums, toners, and daily skincare bottles.',
    published: true,
    isCuratedDefault: true,
  },
  {
    id: 'az_studio_headphones',
    productCode: 'MZ-AZ-105',
    title: 'Monolith Over-Ear Wireless Studio Headphones',
    marketplace: 'Amazon',
    category: 'Tech & Audio',
    price: 46.0,
    compareAtPrice: 89.0,
    affiliateUrl: 'https://www.amazon.com/s?k=matte+black+over+ear+wireless+headphones',
    imageUrl: '/src/assets/images/hero_mezone_showcase_1794892247219.jpg',
    imageFocusClass: 'object-[18%_65%]',
    description:
      'Memory-foam over-ear wireless headphones with 45-hour playback, multipoint Bluetooth pairing, and foldable alloy hinges.',
    published: true,
    isCuratedDefault: true,
  },
  {
    id: 'tm_ceramic_vessels',
    productCode: 'MZ-TM-106',
    title: 'Travertine Stoneware Desk Planter & Vessel Set',
    marketplace: 'Temu',
    category: 'Home & Living',
    price: 21.5,
    compareAtPrice: 40.0,
    affiliateUrl: 'https://www.temu.com/search_result.html?search_key=minimalist+ceramic+desk+vase+set',
    imageUrl: '/src/assets/images/hero_mezone_showcase_1794892247219.jpg',
    imageFocusClass: 'object-[88%_58%]',
    description:
      'Two-piece matte stoneware desktop vessel and planter set with protective cork underside pads for home studios and workspaces.',
    published: true,
    isCuratedDefault: true,
  },
];
