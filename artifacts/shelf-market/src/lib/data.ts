import {
  Coffee, ShoppingBasket, Pill, BookOpen, Shirt, Flower2, Croissant, Wrench, Gift, Plane, BedDouble, Factory,
  type LucideIcon,
} from "lucide-react";

export interface Business { code: string; label: string; icon: LucideIcon; }

// Representative ISIC Rev.4 classes
export const BUSINESSES: Business[] = [
  { code: "4711", label: "Grocery", icon: ShoppingBasket },
  { code: "5610", label: "Café", icon: Coffee },
  { code: "1071", label: "Bakery", icon: Croissant },
  { code: "4772", label: "Pharmacy", icon: Pill },
  { code: "4761", label: "Books", icon: BookOpen },
  { code: "4771", label: "Clothing", icon: Shirt },
  { code: "4776", label: "Florist", icon: Flower2 },
  { code: "4752", label: "Hardware", icon: Wrench },
  { code: "4773", label: "Boutique & gifts", icon: Gift },
  { code: "4719", label: "Airport & travel retail", icon: Plane },
  { code: "5510", label: "Hotel", icon: BedDouble },
  { code: "1079", label: "Factory & outlet", icon: Factory },
];

/** Priority markets first. Others are kept so earlier demo data stays readable. */
export const COUNTRIES = [
  { code: "EG", name: "Egypt", priority: true },
  { code: "PT", name: "Portugal", priority: true },
  { code: "HU", name: "Hungary", priority: true },
  { code: "TR", name: "Türkiye", priority: true },
  { code: "AE", name: "UAE", priority: true },
  { code: "KE", name: "Kenya", priority: false },
  { code: "JP", name: "Japan", priority: false },
  { code: "MX", name: "Mexico", priority: false },
  { code: "DE", name: "Germany", priority: false },
  { code: "IN", name: "India", priority: false },
  { code: "CA", name: "Canada", priority: false },
];
export const PRIORITY_COUNTRIES = COUNTRIES.filter((c) => c.priority);
/**
 * Local currency for each market, so owners see money the way they think about it. Amounts on InRaf are set in USD;
 * these are approximate conversions for display only. Update RATES_AS_OF when the rates are refreshed.
 */
export const LOCAL_CURRENCY: Record<string, { code: string; perUsd: number }> = {
  AE: { code: "AED", perUsd: 3.67 }, EG: { code: "EGP", perUsd: 49 }, TR: { code: "TRY", perUsd: 41 },
  HU: { code: "HUF", perUsd: 350 }, PT: { code: "EUR", perUsd: 0.88 },
};
export const RATES_AS_OF = "November 2026";
/** "≈ AED 110" for a USD amount in that country's currency, or "" where there's no local currency on file. */
export function localApprox(usdAmount: number, country?: string): string {
  const c = country ? LOCAL_CURRENCY[country] : undefined;
  if (!c || !usdAmount) return "";
  const v = usdAmount * c.perUsd;
  const rounded = v >= 1000 ? Math.round(v / 10) * 10 : v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `≈ ${c.code} ${rounded.toLocaleString("en-US")}`;
}

export const countryName = (c: string) => COUNTRIES.find((x) => x.code === c)?.name ?? c;
export const businessOf = (c: string) => BUSINESSES.find((b) => b.code === c) ?? BUSINESSES[0];

/** Illustrative demo percentages only. Not tax advice and not a jurisdictional calculation. */
export const DEMO_TAX: Record<string, number> = { EG: 14, PT: 23, HU: 27, TR: 20, AE: 5 };
export const demoTaxFor = (country: string) => DEMO_TAX[country] ?? 10;

/** Illustrative platform economics (demo). */
export const PLATFORM_COMMISSION_PCT = 8;
export const CUSTOMER_SERVICE_FEE = 0.35;

export const CATEGORIES = [
  { id: "food", label: "Packaged food" },
  { id: "drinks", label: "Drinks" },
  { id: "beauty", label: "Soap & beauty" },
  { id: "craft", label: "Crafts & ceramics" },
  { id: "textile", label: "Textiles" },
  { id: "alcohol", label: "Alcohol" },
];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** The two special shelf offers. Days are the "about to expire" window: stock must expire within it. */
export const EXPIRING_WINDOW_DAYS = 45;
export const OFFERS = [
  { id: "expiring", title: "About to expire", tagline: "Good food from factories, close to its date.", sub: "Factories place stock that expires soon on neighbourhood shelves, at a lower price, so it sells instead of going to waste.", cta: "See near-date deals" },
  { id: "flying", title: "About to Fly Inside", tagline: "National products from local manufacturers, at the airport.", sub: "A shared \"Made in Our Country\" shelf in airport shops: local makers split the cost of the space, each sells their own products to travellers and keeps their own sales.", cta: "See airport shelves" },
] as const;
export type ProductId = (typeof OFFERS)[number]["id"];
export const isProductId = (x: unknown): x is ProductId => x === "expiring" || x === "flying";

/**
 * The two products the marketplace is built around, with everything the journey shows about them:
 * the explanation image (the product's own one-pager), the four steps, and the copy for shop owners
 * ("Your empty shelves could earn") and for token holders ("Find a shelf").
 */
export const PRODUCT_JOURNEY: Record<ProductId, {
  title: string; headline: [string, string]; summary: string; image: string; illustration: string; imageAlt: string;
  /** Promo video: a small muted preview played on hover/tap, and the full version for the larger player. */
  video: { preview: string; full: string; label: string };
  steps: { title: string; text: string }[]; motto: string; pillars: string[];
  owner: { pitch: string; who: string; promises: { title: string; text: string }[]; faq: [string, string][]; cta: string };
  holder: { title: string; pitch: string; who: string; promises: { title: string; text: string }[]; cta: string };
}> = {
  expiring: {
    title: "About to Expire",
    headline: ["Sell Closer,", "Waste Never."],
    summary: "Local factories place soon-to-expire stock on neighbourhood shelves at lower prices, turning waste into shared value.",
    image: "images/product-expire.jpg",
    illustration: "images/near-date-grocery.jpg",
    video: { preview: "videos/about-to-expire-preview.mp4", full: "videos/about-to-expire.mp4", label: "About to Expire promotional video" },
    imageAlt: "About to Expire: a neighbourhood grocery with an About to Expire shelf, and the four steps — identify stock, price wisely, place locally, rescue and share.",
    motto: "Source. Price. Place. Save.",
    steps: [
      { title: "Identify stock", text: "Factories identify goods close to their expiry date." },
      { title: "Price wisely", text: "Discounts are applied so the stock sells fast." },
      { title: "Place locally", text: "Products are stocked on neighbourhood shelves." },
      { title: "Rescue & share", text: "Neighbours buy affordable food, and less goes to waste." },
    ],
    pillars: ["Empower communities", "Support local factories", "Affordable goods", "Zero waste"],
    owner: {
      pitch: "Host an About to Expire shelf: local factories fill it with near-date food and drinks at a discount, and your neighbours come in for the deals.",
      who: "For neighbourhood groceries, minimarkets and pharmacies",
      promises: [
        { title: "Stock arrives priced to move", text: "Every batch shows its usual price crossed out and the days left, so it sells before its date." },
        { title: "More reasons to come in", text: "Near-date deals bring neighbours back every week, and they buy your own products too." },
        { title: "You approve every batch", text: "You see the expiry date of every batch before it goes on your shelf, and the factory collects anything unsold before it expires." },
      ],
      faq: [
        ["What if stock reaches its date on my shelf?", "Batches must expire within 45 days and are listed with their date. The factory collects anything unsold before it expires; sales after the date are flagged to compliance."],
        ["Who sets the discount?", "The factory sets the offer price and the usual price. Shoppers see both, so the saving is clear."],
        ["Do I need a fridge?", "Only for chilled goods. Most near-date stock is packaged food and drinks that keep on an ordinary shelf."],
        ["How do I get paid?", "Monthly rent, a share of each sale, or both — you choose. Payments are still simulated on InRaf, so no money moves yet."],
      ],
      cta: "List your shop for About to Expire",
    },
    holder: {
      title: "Find a neighbourhood shelf for your near-date stock",
      pitch: "Rent a shelf in a neighbourhood shop, stock it with products close to their date at a lower price, and sell them before they go to waste.",
      who: "For factories and producers with short-dated stock",
      promises: [
        { title: "Recover value, not write-offs", text: "Sell stock you would otherwise destroy, at a discount you choose." },
        { title: "Shops near the shoppers", text: "Only neighbourhood shops that take food or drinks are shown." },
        { title: "Dates handled for you", text: "Each batch carries its expiry date; the shelf shows days left and you collect before the date." },
      ],
      cta: "Find a neighbourhood shelf",
    },
  },
  flying: {
    title: "About to Fly Inside",
    headline: ["Together, We Retail", "at the Airport."],
    summary: "A shared airport shelf where local manufacturers split the cost of the space and each sells their own national products to travellers.",
    image: "images/product-fly-inside.jpg",
    illustration: "images/airport-kiosk.jpg",
    video: { preview: "videos/about-to-fly-preview.mp4", full: "videos/about-to-fly.mp4", label: "About to Fly Inside promotional video" },
    imageAlt: "About to Fly Inside: a Made in Our Country shop at an airport gate, and four steps — share the space, make it local, retail together, get paid for your own sales.",
    motto: "Share the space. Show your country. Sell to the world.",
    steps: [
      { title: "Share the space", text: "Each maker rents their own section of a shared display in an airport shop, so nobody pays for a whole shelf alone." },
      { title: "Make it local", text: "Every product is made in the airport's country and carries the story of where it comes from." },
      { title: "Retail together", text: "National products are shown under one retail brand at airport shops." },
      { title: "Get paid for your own sales", text: "Each maker is paid for the products they sell, minus the disclosed InRaf commission. Nobody shares in anyone else's profit." },
    ],
    pillars: ["Empower communities", "Support local manufacturers", "Showcase national products", "Share the cost, not the risk"],
    owner: {
      pitch: "Host a \"Made in Our Country\" shelf for travellers: several local makers each rent a section of it, stock it with their own national products, and sell under one display.",
      who: "For shops and kiosks inside airports",
      promises: [
        { title: "Rent from several makers", text: "Each section is rented by its own maker under its own contract, so one maker leaving doesn't empty the whole shelf." },
        { title: "Products travellers want", text: "National products from vetted local manufacturers — the gifts people look for before they fly." },
        { title: "One display, one contact", text: "The shelf looks like one \"Made in Our Country\" display, and InRaf is your single contact for every maker on it." },
      ],
      faq: [
        ["Does it have to be airside?", "Any shop inside an airport terminal works — before or after security. Your airport's own retail rules still apply."],
        ["Who decides what goes on the shelf?", "Each maker proposes their own products; you approve every product before it goes on sale."],
        ["How do I get paid?", "You receive the rent for each section (and a share of each sale if you choose). Each maker is paid only for their own sales. Payments are still simulated on InRaf."],
        ["What about duty-free rules?", "InRaf doesn't handle customs or duty-free licensing. Check with your airport operator."],
      ],
      cta: "List your airport shop",
    },
    holder: {
      title: "Find a shelf at the airport",
      pitch: "Rent your own section of a shared airport shelf, stock it with the national products you make, and sell to travellers.",
      who: "For local manufacturers",
      promises: [
        { title: "Share the space, not the risk", text: "Airport space is costly alone; a token is your right to use your own section of a shared shelf. It is not an investment." },
        { title: "Made in Our Country", text: "Products must be made in the airport's country, each with the story of where it comes from." },
        { title: "Your sales are yours", text: "You are paid for the products you sell, minus the disclosed InRaf commission." },
      ],
      cta: "Find an airport shelf",
    },
  },
};

/** Which shops serve which product: airport shops for About to Fly Inside, neighbourhood food shops for About to Expire. */
export const shopServes = (s: { venue?: string; categories: string[] }, p: ProductId) =>
  p === "flying" ? s.venue === "airport" : s.venue !== "airport" && (s.categories.includes("food") || s.categories.includes("drinks"));
export const offerTitle = (id?: string) => OFFERS.find((o) => o.id === id)?.title ?? "";

export const RESTRICTIONS = [
  { id: "no-plastic", label: "No single-use plastic" },
  { id: "fair-trade", label: "Fair-trade only" },
  { id: "no-animal-test", label: "No animal testing" },
];

export interface Product {
  id: string; name: string; category: string; origins: string[];
  unitCost: number; retail: number; color: string;
  expiry?: string; // ISO date of sample batch
  blockedIn?: string[]; // illustrative destination block
  tags?: string[]; // e.g. "plastic", "animal-test", "fair-trade"
  description?: string;
  offer?: "expiring" | "flying"; wasPrice?: number; story?: string;
}

export const PRODUCTS: Product[] = [
  { id: "dukkah", name: "Dukkah spice mix", category: "food", origins: ["EG"], unitCost: 2.6, retail: 6.9, color: "#B5834A", expiry: "2027-02-01", tags: ["fair-trade"], description: "Toasted hazelnut, sesame and coriander, ground in Giza." },
  { id: "towel", name: "Hand-loomed cotton towel", category: "textile", origins: ["EG", "TR"], unitCost: 7.4, retail: 18.5, color: "#5E8FA8", tags: ["fair-trade"], description: "Long-staple cotton, flat-woven, 50 × 90 cm." },
  { id: "paprika", name: "Sweet paprika tin", category: "food", origins: ["HU"], unitCost: 2.9, retail: 7.2, color: "#C8412E", expiry: "2027-05-01", tags: ["fair-trade"], description: "Stone-milled noble-sweet paprika, 100 g." },
  { id: "napkin", name: "Embroidered linen napkin", category: "textile", origins: ["HU", "PT"], unitCost: 5.1, retail: 13.8, color: "#2F5E9E", description: "Hand-stitched floral border, set of two." },
  { id: "lokum", name: "Rose lokum box", category: "food", origins: ["TR"], unitCost: 3.4, retail: 8.6, color: "#D9799A", expiry: "2026-09-30", description: "Rose-water Turkish delight dusted in sugar, 250 g." },
  { id: "coaster", name: "Iznik-style tile coaster", category: "craft", origins: ["TR"], unitCost: 4.8, retail: 12.4, color: "#2C7DA0", description: "Hand-painted quartz-frit tile with cork base." },
  { id: "dates", name: "Date & tahini spread", category: "food", origins: ["AE", "EG"], unitCost: 3.9, retail: 9.2, color: "#8A5A3C", expiry: "2026-12-01", description: "Khalas dates blended with stone-ground tahini." },
  { id: "cork", name: "Cork card wallet", category: "craft", origins: ["PT"], unitCost: 6.2, retail: 16.9, color: "#A9825A", description: "Alentejo cork sheet, stitched by hand." },
  { id: "honey", name: "Wildflower honey", category: "food", origins: ["KE", "PT", "MX", "IN", "HU", "TR"], unitCost: 4.2, retail: 9.5, color: "#E9A23B", expiry: "2027-08-01", tags: ["fair-trade"] },
  { id: "coffee", name: "Single-origin beans", category: "food", origins: ["KE", "MX", "IN"], unitCost: 6.8, retail: 14.9, color: "#7A4A2E", expiry: "2026-11-15", tags: ["fair-trade"] },
  { id: "soap", name: "Olive oil soap", category: "beauty", origins: ["PT", "IN", "MX", "TR", "EG"], unitCost: 2.1, retail: 6.4, color: "#9DB79A", tags: ["fair-trade"] },
  { id: "bowl", name: "Glazed tea bowl", category: "craft", origins: ["JP", "MX", "PT", "HU", "TR"], unitCost: 11.5, retail: 27, color: "#5E7FA6" },
  { id: "scarf", name: "Handwoven scarf", category: "textile", origins: ["IN", "KE", "MX", "EG"], unitCost: 9.4, retail: 24, color: "#C5523B", tags: ["fair-trade"] },
  { id: "tea", name: "Hibiscus tea", category: "drinks", origins: ["KE", "MX", "IN", "EG"], unitCost: 3.3, retail: 7.8, color: "#B03A5B", expiry: "2027-03-01" },
  { id: "mezcal", name: "Small-batch mezcal", category: "alcohol", origins: ["MX"], unitCost: 18, retail: 42, color: "#C9B47A", blockedIn: ["AE"] },
  { id: "chili", name: "Chili paste (old batch)", category: "food", origins: ["MX", "IN", "KE", "EG"], unitCost: 1.9, retail: 5.5, color: "#D8462F", expiry: "2024-12-01" },
  { id: "wipes", name: "Plastic wet wipes", category: "beauty", origins: ["DE", "IN", "CA", "TR"], unitCost: 0.9, retail: 3.2, color: "#A8C3D6", tags: ["plastic"] },
  // About to expire: factory stock close to its date (expiry is set relative to today when stocked)
  { id: "biscuit", name: "Sesame biscuit packs", category: "food", origins: ["EG"], unitCost: 0.9, retail: 1.6, wasPrice: 3.2, color: "#C99A5B", offer: "expiring", description: "Factory surplus from a Sixth of October plant, 6 packs of 80 g." },
  { id: "mango", name: "Mango juice cartons", category: "drinks", origins: ["EG"], unitCost: 0.7, retail: 1.2, wasPrice: 2.4, color: "#E9A23B", offer: "expiring", description: "Ismailia mango nectar, 6 × 200 ml. Short-dated run." },
  { id: "feta", name: "White cheese tins", category: "food", origins: ["EG"], unitCost: 1.8, retail: 2.9, wasPrice: 5.5, color: "#E8E1D0", offer: "expiring", description: "Dairy factory overrun, 500 g tins, keep cool after opening." },
  // About to fly: local souvenirs from domestic makers
  { id: "nazar", name: "Nazar glass charm", category: "craft", origins: ["TR"], unitCost: 1.6, retail: 6.5, color: "#2F5E9E", offer: "flying", description: "Hand-blown blue glass eye on a cotton cord.", story: "The nazar has guarded Anatolian homes for centuries; this one is blown in a family workshop in Görece, near İzmir." },
  { id: "cezve", name: "Mini copper cezve", category: "craft", origins: ["TR"], unitCost: 5.4, retail: 15.9, color: "#B5652E", offer: "flying", description: "Hammered copper coffee pot, one-cup size.", story: "Turkish coffee is on UNESCO's intangible heritage list; coppersmiths in Gaziantep still hammer each cezve by hand." },
  { id: "azulejo", name: "Azulejo tile magnet", category: "craft", origins: ["PT"], unitCost: 2.2, retail: 7.9, color: "#2C7DA0", offer: "flying", description: "Hand-painted tin-glaze tile, 5 × 5 cm.", story: "Blue-and-white azulejos cover Lisbon's façades; this pattern is copied from a house in Graça and painted in Sacavém." },
  { id: "galo", name: "Barcelos rooster", category: "craft", origins: ["PT"], unitCost: 3.1, retail: 9.5, color: "#C8412E", offer: "flying", description: "Painted clay rooster, 9 cm.", story: "The rooster of Barcelos is Portugal's folk symbol of luck and justice, shaped and painted by potters in the Minho." },
  { id: "cream", name: "Lab-tested face cream", category: "beauty", origins: ["DE", "CA", "JP", "AE"], unitCost: 5.5, retail: 16, color: "#E6C6B8", tags: ["animal-test"] },
];

export const SHELF_CAPACITY = 40; // legacy default units per shelf (illustrative)

export const SWATCHES = ["#B5834A", "#5E8FA8", "#C8412E", "#2F5E9E", "#D9799A", "#2C7DA0", "#8A5A3C", "#A9825A", "#9DB79A", "#E9A23B"];

export const SHELF_TYPES: { id: import("./types").ShelfType; label: string; hint: string }[] = [
  { id: "eye-level", label: "Eye-level", hint: "At the shopper's eye line on a main aisle" },
  { id: "endcap", label: "Endcap", hint: "End of an aisle, seen from two directions" },
  { id: "checkout", label: "By the till", hint: "Next to the checkout counter" },
  { id: "fridge", label: "Fridge", hint: "Chilled cabinet space" },
  { id: "window", label: "Window display", hint: "Street-facing window" },
];
export const shelfTypeLabel = (id: string) => SHELF_TYPES.find((t) => t.id === id)?.label ?? id;

export const FEATURES = [
  { id: "chilled", label: "Chilled storage" },
  { id: "cctv", label: "CCTV" },
  { id: "restock", label: "Shop restocks for you" },
  { id: "pos", label: "Sales logged at the till" },
];
export const featureLabel = (id: string) => FEATURES.find((f) => f.id === id)?.label ?? id;

export const PRICING_LABEL = { fixed: "Fixed rent", share: "Share of sales", hybrid: "Rent + share of sales" } as const;

export const CANCELLATION = {
  flexible: { label: "Flexible", text: "Free to cancel any time before the contract is signed, then 30 days' notice." },
  moderate: { label: "Moderate", text: "Free to cancel before signing. After that, 60 days' notice." },
  strict: { label: "Strict", text: "Free to cancel before signing. After that, the rental runs to the end of the term." },
} as const;

/** Rough city centres for the schematic map. Unknown cities fall back to the country. */
export const CITY_GEO: Record<string, [number, number]> = {
  Cairo: [30.05, 31.24], Alexandria: [31.2, 29.92], Lisbon: [38.72, -9.14], Porto: [41.15, -8.61],
  Budapest: [47.5, 19.04], Istanbul: [41.01, 28.98], Ankara: [39.93, 32.86], Dubai: [25.2, 55.27], "Abu Dhabi": [24.45, 54.38],
};
export const COUNTRY_GEO: Record<string, [number, number]> = {
  EG: [28.5, 30.8], PT: [39.5, -8], HU: [47.2, 19.5], TR: [39, 34], AE: [24.4, 54.4],
  KE: [-1.3, 36.8], JP: [35, 135.7], MX: [17, -96.7], DE: [52.5, 13.4], IN: [22, 78], CA: [45.4, -75.7],
};

/** Illustrative stand-ins for a real currency/token layer. */
export const PREMIUM_TOKEN_NOTE = "Premium shelves need a Gold-tier token. Token tiers are illustrative in this demo.";
