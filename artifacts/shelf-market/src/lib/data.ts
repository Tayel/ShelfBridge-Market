import {
  Coffee, ShoppingBasket, Pill, BookOpen, Shirt, Flower2, Croissant, Wrench,
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
  { id: "cream", name: "Lab-tested face cream", category: "beauty", origins: ["DE", "CA", "JP", "AE"], unitCost: 5.5, retail: 16, color: "#E6C6B8", tags: ["animal-test"] },
];

export const SHELF_CAPACITY = 40; // legacy default units per shelf (illustrative)

export const SWATCHES = ["#B5834A", "#5E8FA8", "#C8412E", "#2F5E9E", "#D9799A", "#2C7DA0", "#8A5A3C", "#A9825A", "#9DB79A", "#E9A23B"];
