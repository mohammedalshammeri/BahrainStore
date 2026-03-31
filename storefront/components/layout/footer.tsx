import Link from "next/link";
import { Store } from "lucide-react";
import type { StorePublic } from "@/lib/types";

interface FooterProps {
  store: StorePublic;
}

export function Footer({ store }: FooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-6 h-6 text-white" />
            <span className="text-white font-bold text-lg">{store.nameAr || store.name}</span>
          </div>
          {store.descriptionAr && (
            <p className="text-sm leading-relaxed">{store.descriptionAr}</p>
          )}
        </div>

        {/* Links */}
        <div>
          <h3 className="text-white font-semibold mb-3">روابط سريعة</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={`/${store.subdomain}`} className="hover:text-white transition">الرئيسية</Link></li>
            <li><Link href={`/${store.subdomain}/products`} className="hover:text-white transition">جميع المنتجات</Link></li>
            <li><Link href={`/${store.subdomain}/cart`} className="hover:text-white transition">سلة التسوق</Link></li>
            <li><Link href={`/${store.subdomain}/account`} className="hover:text-white transition">حسابي وطلباتي</Link></li>
          </ul>
        </div>

        {/* Info */}
        <div>
          <h3 className="text-white font-semibold mb-3">معلومات</h3>
          <ul className="space-y-2 text-sm">
            <li>البحرين 🇧🇭</li>
            <li>العملة: {store.currency || "BHD"}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {store.nameAr || store.name} — مدعوم بواسطة{" "}
        <span className="text-white font-semibold">بزار</span>
      </div>
    </footer>
  );
}
