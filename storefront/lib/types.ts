// ─── Store ──────────────────────────────────────
export interface StorePublic {
  id: string;
  name: string;
  nameAr: string | null;
  subdomain: string;
  description: string | null;
  descriptionAr: string | null;
  logo: string | null;
  currency: string;
  language: string;
  vatRate: number;
  settings?: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    theme: string;
  };
}

// ─── Category ───────────────────────────────────
export interface Category {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  image: string | null;
  children?: Category[];
  _count?: { products: number };
}

// ─── Product ────────────────────────────────────
export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}

export interface OptionValue {
  id: string;
  value: string;
  valueAr: string;
  color: string | null;
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  name: string;
  nameAr: string;
  sortOrder: number;
  values: OptionValue[];
}

export interface VariantOptionValue {
  optionValue: OptionValue & { option?: { id: string; name: string; nameAr: string } };
}

export interface ProductVariant {
  id: string;
  name: string;
  nameAr: string;
  sku: string | null;
  price: number;
  comparePrice?: number | null;
  stock: number;
  image: string | null;
  isActive: boolean;
  optionValues?: VariantOptionValue[];
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  comparePrice: number | null;
  stock: number;
  trackInventory: boolean;
  isActive: boolean;
  isFeatured: boolean;
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  category: Category | null;
  isPreOrder?: boolean;
  preOrderMessageAr?: string | null;
  preOrderDeliveryDays?: number | null;
}

// ─── Cart ────────────────────────────────────────
export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  nameAr: string;
  price: number;
  quantity: number;
  image: string | null;
  variantName?: string;
  stock: number;
}
