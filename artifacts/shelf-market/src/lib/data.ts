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

export const COUNTRIES = [
  { code: "PT", name: "Portugal" },
  { code: "KE", name: "Kenya" },
  { code: "JP", name: "Japan" },
  { code: "MX", name: "Mexico" },
  { code: "DE", name: "Germany" },
  { code: "IN", name: "India" },
  { code: "AE", name: "UAE" },
  { code: "CA", name: "Canada" },
];
export const countryName = (c: string) => COUNTRIES.find((x) => x.code === c)?.name ?? c;
export const businessOf = (c: string) => BUSINESSES.find((b) => b.code === c) ?? BUSINESSES[0];

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
}

export const PRODUCTS: Product[] = [
  { id: "honey", name: "Wildflower honey", category: "food", origins: ["KE", "PT", "MX", "IN"], unitCost: 4.2, retail: 9.5, color: "#E9A23B", expiry: "2027-08-01", tags: ["fair-trade"] },
  { id: "coffee", name: "Single-origin beans", category: "food", origins: ["KE", "MX", "IN"], unitCost: 6.8, retail: 14.9, color: "#7A4A2E", expiry: "2026-11-15", tags: ["fair-trade"] },
  { id: "soap", name: "Olive oil soap", category: "beauty", origins: ["PT", "IN", "MX"], unitCost: 2.1, retail: 6.4, color: "#9DB79A", tags: ["fair-trade"] },
  { id: "bowl", name: "Glazed tea bowl", category: "craft", origins: ["JP", "MX", "PT"], unitCost: 11.5, retail: 27, color: "#5E7FA6" },
  { id: "scarf", name: "Handwoven scarf", category: "textile", origins: ["IN", "KE", "MX"], unitCost: 9.4, retail: 24, color: "#C5523B", tags: ["fair-trade"] },
  { id: "tea", name: "Hibiscus tea", category: "drinks", origins: ["KE", "MX", "IN"], unitCost: 3.3, retail: 7.8, color: "#B03A5B", expiry: "2027-03-01" },
  { id: "mezcal", name: "Small-batch mezcal", category: "alcohol", origins: ["MX"], unitCost: 18, retail: 42, color: "#C9B47A", blockedIn: ["AE"] },
  { id: "chili", name: "Chili paste (old batch)", category: "food", origins: ["MX", "IN", "KE"], unitCost: 1.9, retail: 5.5, color: "#D8462F", expiry: "2024-12-01" },
  { id: "wipes", name: "Plastic wet wipes", category: "beauty", origins: ["DE", "IN", "CA"], unitCost: 0.9, retail: 3.2, color: "#A8C3D6", tags: ["plastic"] },
  { id: "cream", name: "Lab-tested face cream", category: "beauty", origins: ["DE", "CA", "JP"], unitCost: 5.5, retail: 16, color: "#E6C6B8", tags: ["animal-test"] },
];

export const SHELF_CAPACITY = 40; // units per shelf (illustrative)
