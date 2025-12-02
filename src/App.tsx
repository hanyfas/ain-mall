import React, { useEffect, useMemo, useState, useRef } from "react";
import { getMapData, show3dMap, MapView, TShow3DMapOptions } from '@mappedin/mappedin-js';
import '@mappedin/mappedin-js/lib/esm/index.css';
import theme from "./theme";
import { applyThemeStyling } from "./themeApplicator";
// @ts-ignore - JavaScript file with SVG icon strings
import svgIcons from "./assets/svgicons.js";
import arabicFontUrl from "./assets/Fonts/alfont_com_AlFont_com_URW-DIN-Arabic-1.ttf?url";
// Import amenity icons so Vite rewrites URLs for production
import iconRestroom from "./assets/aminities/restroom.png";
import iconParking from "./assets/aminities/parking.png";
import iconElevator from "./assets/aminities/elevator.png";
import iconMalePrayer from "./assets/aminities/male_prayer.png";
import iconFemalePrayer from "./assets/aminities/female_prayer.png";
import iconChangingRoom from "./assets/aminities/changing_room.png";
import iconLostFound from "./assets/aminities/lost_found.png";
import iconCustomerService from "./assets/aminities/customer_service.png";
import iconAtm from "./assets/aminities/atm.png";
import logoImage from "./assets/images/AinMall_Logo.png";
import {
    Search,
    MapPin,
    Store,
    Utensils,
    Shirt,
    Smartphone,
    ShoppingCart,
    Baby,
    Footprints,
    Info,
    Clock,





    Languages,
    LayoutGrid,
    List as ListIcon,
    Keyboard as KeyboardIcon,
    Plus,
    Minus,
    RotateCcw,
    RotateCw,
    ChevronUp,
    ChevronDown,
} from "lucide-react";

/**
 * Single-file React app (TSX) for Al Ain Mall Wayfinding
 * Fixes: The previous canvas bundled multiple files (package.json, vite config, etc.)
 * into one TSX document, which caused `Missing semicolon (3:8)` while parsing JSON
 * as TypeScript. This file is a valid standalone component for the playground/Cursor.
 *
 * Notes:
 * - Responsive, glass cards, gradient background (constant orientation: white → purple)
 * - Dual language (EN/AR), RTL text only (no column mirroring)
 * - Browse box = Search → Chips (multi-row) → Results (grid/list)
 * - On-screen keyboard under search (numbers, backspace, clear) and togglable
 * - GitHub loader: categories & store logos from /categories/* in your repo
 * - Local SVG fallbacks for Restroom/Elevator icons (lucide sometimes 404s)
 * - Self-tests (TestBadge) for sanity checks
 */

// ---------- Constants & Types ----------
// LOGO_URL removed - using imported logoImage instead

// MappedIn Configuration - matching reference project
const MAPPEDIN_OPTIONS = {
    key: 'mik_7e6tcm2wtODeksRHr54e207b6',
    secret: 'mis_5yBUdX4rFxFAkJgWzXqenV4Lasx4wK4QhOMarlQQuRk939a10d2',
    mapId: '68d783a6dbd109000b017234'
};

// Ensure assets resolve correctly under different base paths (Vercel vs GitHub Pages)
function withBase(path: string): string {
    // Simple join that preserves non-root BASE_URL like '/ain-mall/'
    const base = (import.meta as any).env.BASE_URL || '/';
    const baseNorm = base.endsWith('/') ? base : base + '/';
    const p = path.startsWith('/') ? path.slice(1) : path;
    return baseNorm + p;
}
function encodeSegments(p: string): string {
    const leading = p.startsWith('/') ? '/' : '';
    const parts = p.replace(/^\/+/, '').split('/');
    return leading + parts.map((s) => encodeURIComponent(s)).join('/');
}
function toSrc(path?: string): string | undefined {
    if (!path) return undefined;
    // If Vite already provided an emitted asset (e.g., imported icon), keep as-is
    if (path.startsWith('/') && path.includes('/assets/')) return path;
    if (/^https?:\/\//i.test(path)) return path;
    // For public files like /icons/... encode segments and prefix base
    const encoded = encodeSegments(path);
    return withBase(encoded);
}

// Removed old computeFallbackUrl; we now generate explicit candidate lists

function slugifyName(name: string): string {
    const noDiacritics = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = noDiacritics.replace(/[’']/g, '').replace(/\.+/g, ' ').replace(/&/g, 'and');
    return cleaned.trim().replace(/\s+/g, ' ');
}

function buildStoreLogoCandidates(store: StoreRec): string[] {
    const candidates: string[] = [];
    if (store.iconUrl) candidates.push(store.iconUrl);
    const baseNames = [store.name_en, store.name_en.toLowerCase()];
    const variants = new Set<string>();
    for (const n of baseNames) {
        const v = slugifyName(n);
        variants.add(v);
        variants.add(v.replace(/\s+/g, '-'));
        variants.add(v.replace(/\s+/g, ''));
    }
    for (const v of variants) {
        candidates.push(`/stores/${v}.png`);
        candidates.push(`/stores/${v}.jpg`);
        // Also try category icon folder when applicable (handles cafe names with accents)
        candidates.push(`/icons/categories/${encodeSegments(store.category)}/${v}.png`);
        candidates.push(`/icons/categories/${encodeSegments(store.category)}/${v}.jpg`);
    }
    // Hard map for specific tricky cases
    if (store.name_en === 'Caffè Nero') {
        candidates.unshift('/icons/categories/food & cafe/Caffe Nero.png', '/stores/Caffe Nero.png');
    }
    if (store.name_en === "P.F. Chang's") {
        candidates.unshift('/icons/categories/food & cafe/P F Changs.png', '/stores/PF Changs.png');
    }
    if (store.name_en === 'Paul Café') {
        candidates.unshift('/icons/categories/food & cafe/Paul Café.png', '/stores/Paul Cafe.png');
    }
    return candidates.map((p) => toSrc(p) || p);
}

type Lang = "en" | "ar";

type StoreRec = {
    id: number;
    name_en: string;
    name_ar: string;
    category: string;
    level: string;
    x: number; // 0..100 map coords
    y: number; // 0..100 map coords
    iconUrl?: string; // optional remote logo from GitHub
    description_en?: string;
    description_ar?: string;
};

type CategoryRec = {
    key: string;
    en: string;
    ar: string;
    icon: React.ReactNode;
};

type KbdKey = { label: string; value?: string; span?: number; kind?: "char" | "space" | "backspace" | "clear" };

// ---------- i18n ----------
const STR: Record<Lang, Record<string, string>> = {
    en: {
        searchPlaceholder: "Search stores, categories, amenities…",
        categories: "Categories",
        amenities: "Amenities",
        results: "Results",
        all: "All",
        level: "Level",
        directions: "Directions",
        close: "Close",
        viewOnMap: "View on map",
        grid: "Grid",
        list: "List",
        showKeyboard: "Show on-screen keyboard",
        hideKeyboard: "Hide on-screen keyboard",
        clear: "Clear",
    },
    ar: {
        searchPlaceholder: "ابحث عن المتاجر أو الفئات أو الخدمات…",
        categories: "الفئات",
        amenities: "الخدمات",
        results: "النتائج",
        all: "الكل",
        level: "الطابق",
        directions: "الاتجاهات",
        close: "إغلاق",
        viewOnMap: "عرض على الخريطة",
        grid: "جدول",
        list: "قائمة",
        showKeyboard: "إظهار لوحة المفاتيح",
        hideKeyboard: "إخفاء لوحة المفاتيح",
        clear: "مسح",
    },
};

// ---------- Local samples as fallback ----------
const CATEGORIES: CategoryRec[] = [
    { key: "fashion", en: "Fashion", ar: "موضة", icon: <Shirt className="w-6 h-6" /> },
    { key: "electronics", en: "Electronics", ar: "إلكترونيات", icon: <Smartphone className="w-6 h-6" /> },
    { key: "food & cafe", en: "Food & Cafe", ar: "مطاعم ومقاهي", icon: <Utensils className="w-6 h-6" /> },
    { key: "supermarket", en: "Supermarket", ar: "سوبرماركت", icon: <ShoppingCart className="w-6 h-6" /> },
    { key: "kids", en: "Kids", ar: "أطفال", icon: <Baby className="w-6 h-6" /> },
    { key: "sports", en: "Sports", ar: "رياضة", icon: <Footprints className="w-6 h-6" /> },
    { key: "Banks", en: "Banks", ar: "بنوك", icon: <Info className="w-6 h-6" /> },
];

const STORES: StoreRec[] = [
    // Fashion stores
    {
        id: 1,
        name_en: "Zara",
        name_ar: "زارا",
        category: "fashion",
        level: "L1",
        x: 28,
        y: 48,
        iconUrl: "/icons/categories/fashion/Zara.png",
        description_en: "Spanish multinational clothing retailer known for fast fashion and trendy designs.",
        description_ar: "متجر أزياء إسباني متعدد الجنسيات معروف بالموضة السريعة والتصاميم العصرية."
    },
    {
        id: 2,
        name_en: "American Eagle Outfitters",
        name_ar: "أمريكان إيجل أوت فيترز",
        category: "fashion",
        level: "L1",
        x: 52,
        y: 44,
        iconUrl: "/icons/categories/fashion/American%20Eagle%20Outfitters.png",
        description_en: "American lifestyle and clothing retailer offering casual wear and accessories.",
        description_ar: "متجر أزياء ونمط حياة أمريكي يقدم الملابس العادية والإكسسوارات."
    },
    {
        id: 3,
        name_en: "Armani Exchange",
        name_ar: "أرماني إكس تشينج",
        category: "fashion",
        level: "L1",
        x: 35,
        y: 40,
        iconUrl: "/icons/categories/fashion/Armani%20Exchange.png",
        description_en: "Contemporary fashion brand offering modern, sophisticated clothing and accessories.",
        description_ar: "علامة أزياء معاصرة تقدم ملابس وإكسسوارات عصرية وأنيقة."
    },
    {
        id: 4,
        name_en: "Debenhams",
        name_ar: "ديبنهامز",
        category: "fashion",
        level: "L2",
        x: 45,
        y: 35,
        iconUrl: "/icons/categories/fashion/Debenhams.png",
        description_en: "British department store offering fashion, beauty, and home products.",
        description_ar: "متجر بريطاني متعدد الأقسام يقدم الأزياء ومستحضرات التجميل والمنتجات المنزلية."
    },
    {
        id: 5,
        name_en: "La Senza",
        name_ar: "لا سينزا",
        category: "fashion",
        level: "L1",
        x: 60,
        y: 50,
        iconUrl: "/icons/categories/fashion/La%20Senza.png",
        description_en: "Intimate apparel and lingerie retailer offering comfortable and stylish undergarments.",
        description_ar: "متجر ملابس داخلية وحمالات صدر يقدم ملابس داخلية مريحة وأنيقة."
    },
    {
        id: 6,
        name_en: "West Elm",
        name_ar: "ويست إلم",
        category: "fashion",
        level: "L2",
        x: 20,
        y: 50,
        iconUrl: "/icons/categories/fashion/West%20Elm.png",
        description_en: "Modern home furnishings and decor retailer offering contemporary design solutions.",
        description_ar: "متجر أثاث منزلي وديكورات حديثة يقدم حلول تصميم معاصرة."
    },
    {
        id: 7,
        name_en: "Women'secret",
        name_ar: "وومن سيكريت",
        category: "fashion",
        level: "L1",
        x: 40,
        y: 55,
        iconUrl: "/icons/categories/fashion/Women'secret.png",
        description_en: "Spanish intimate apparel brand offering trendy and comfortable lingerie.",
        description_ar: "علامة ملابس داخلية إسبانية تقدم ملابس داخلية عصرية ومريحة."
    },

    // Electronics stores
    {
        id: 8,
        name_en: "Dyson",
        name_ar: "دايسون",
        category: "electronics",
        level: "L2",
        x: 32,
        y: 30,
        iconUrl: "/icons/categories/electronics/Dyson.png",
        description_en: "British technology company specializing in vacuum cleaners and air purifiers.",
        description_ar: "شركة تكنولوجيا بريطانية متخصصة في المكانس الكهربائية وأجهزة تنقية الهواء."
    },
    {
        id: 9,
        name_en: "Jumbo",
        name_ar: "جومبو",
        category: "electronics",
        level: "L2",
        x: 50,
        y: 25,
        iconUrl: "/icons/categories/electronics/Jumbo.png",
        description_en: "Electronics retailer offering a wide range of gadgets, accessories, and tech products.",
        description_ar: "متجر إلكترونيات يقدم مجموعة واسعة من الأجهزة والإكسسوارات والمنتجات التقنية."
    },

    // Food & Cafe stores
    {
        id: 10,
        name_en: "Starbucks",
        name_ar: "ستاربكس",
        category: "food & cafe",
        level: "G",
        x: 62,
        y: 68,
        iconUrl: "/icons/categories/food%20&%20cafe/Starbucks.png",
        description_en: "American multinational coffeehouse chain serving premium coffee and beverages.",
        description_ar: "سلسلة مقاهي أمريكية متعددة الجنسيات تقدم القهوة المميزة والمشروبات."
    },
    {
        id: 11,
        name_en: "Caffè Nero",
        name_ar: "كافيه نيرو",
        category: "food & cafe",
        level: "G",
        x: 70,
        y: 60,
        iconUrl: "/icons/categories/food%20&%20cafe/Caffe%20Nero.png",
        description_en: "Italian-inspired coffeehouse chain offering authentic espresso and pastries.",
        description_ar: "سلسلة مقاهي مستوحاة من الطراز الإيطالي تقدم الإسبريسو الأصلي والمعجنات."
    },
    {
        id: 12,
        name_en: "Paul Café",
        name_ar: "بول كافيه",
        category: "food & cafe",
        level: "G",
        x: 55,
        y: 65,
        iconUrl: "/icons/categories/food & cafe/Paul Cafe.png",
        description_en: "French bakery and café chain offering fresh bread, pastries, and light meals.",
        description_ar: "سلسلة مخابز ومقاهي فرنسية تقدم الخبز الطازج والمعجنات والوجبات الخفيفة."
    },
    {
        id: 13,
        name_en: "Shake Shack",
        name_ar: "شيك شاك",
        category: "food & cafe",
        level: "G",
        x: 45,
        y: 70,
        iconUrl: "/icons/categories/food%20&%20cafe/Shake%20Shack.png",
        description_en: "American fast-casual restaurant chain known for burgers, hot dogs, and milkshakes.",
        description_ar: "سلسلة مطاعم أمريكية سريعة معروفة بالبرغر والنقانق ومشروبات الحليب المخفوق."
    },
    {
        id: 14,
        name_en: "Texas Roadhouse",
        name_ar: "تكساس رودهاوس",
        category: "food & cafe",
        level: "G",
        x: 30,
        y: 75,
        iconUrl: "/icons/categories/food%20&%20cafe/Texas%20Roadhouse.png",
        description_en: "American steakhouse chain offering grilled steaks, ribs, and Southern-style cuisine.",
        description_ar: "سلسلة مطاعم أمريكية متخصصة في اللحوم المشوية والأضلاع والمأكولات الجنوبية."
    },
    {
        id: 15,
        name_en: "The Cheesecake Factory",
        name_ar: "ذا تشيز كيك فاكتوري",
        category: "food & cafe",
        level: "G",
        x: 25,
        y: 80,
        iconUrl: "/icons/categories/food%20&%20cafe/The%20Cheesecake%20Factory.png",
        description_en: "American restaurant chain known for its extensive menu and signature cheesecakes.",
        description_ar: "سلسلة مطاعم أمريكية معروفة بقائمة الطعام الواسعة وكعكات الجبن المميزة."
    },
    {
        id: 16,
        name_en: "P.F. Chang's",
        name_ar: "بي إف تشانغز",
        category: "food & cafe",
        level: "G",
        x: 35,
        y: 85,
        iconUrl: "/categories/food & cafe/PF Changs.png",
        description_en: "American restaurant chain specializing in Asian-inspired cuisine and contemporary dining.",
        description_ar: "سلسلة مطاعم أمريكية متخصصة في المأكولات المستوحاة من آسيا والمأكولات المعاصرة."
    },

    // Supermarket stores
    {
        id: 17,
        name_en: "Waitrose",
        name_ar: "ويتروز",
        category: "supermarket",
        level: "G",
        x: 76,
        y: 58,
        iconUrl: "/icons/categories/supermarket/Waitrose.png",
        description_en: "British supermarket chain offering high-quality groceries and household items.",
        description_ar: "سلسلة سوبرماركت بريطانية تقدم بقالة عالية الجودة وأدوات منزلية."
    },
    {
        id: 18,
        name_en: "Watson's",
        name_ar: "واتسونز",
        category: "supermarket",
        level: "G",
        x: 80,
        y: 50,
        iconUrl: "/icons/categories/supermarket/Watson's.png",
        description_en: "Health and beauty retailer offering pharmacy services, cosmetics, and wellness products.",
        description_ar: "متجر صحة وجمال يقدم خدمات الصيدلية ومستحضرات التجميل ومنتجات العافية."
    },

    // Kids stores
    {
        id: 19,
        name_en: "Abercrombie Kids",
        name_ar: "أبيركرومبي كيدز",
        category: "kids",
        level: "L1",
        x: 15,
        y: 60,
        iconUrl: "/icons/categories/kids/Abercrombie%20Kids.jpg",
        description_en: "Children's clothing retailer offering casual and trendy apparel for kids.",
        description_ar: "متجر ملابس أطفال يقدم ملابس عادية وعصرية للأطفال."
    },
    {
        id: 20,
        name_en: "Mothercare",
        name_ar: "ماذركير",
        category: "kids",
        level: "L1",
        x: 25,
        y: 65,
        iconUrl: "/icons/categories/kids/Mothercare.png",
        description_en: "British retailer specializing in products for babies, toddlers, and expectant mothers.",
        description_ar: "متجر بريطاني متخصص في منتجات الرضع والأطفال الصغار والأمهات الحوامل."
    },
    {
        id: 21,
        name_en: "Pottery Barn Kids",
        name_ar: "بوتري بارن كيدز",
        category: "kids",
        level: "L2",
        x: 65,
        y: 40,
        iconUrl: "/icons/categories/kids/Pottery%20Barn%20Kids.png",
        description_en: "Children's furniture and home decor retailer offering stylish and functional pieces.",
        description_ar: "متجر أثاث أطفال وديكورات منزلية يقدم قطع أنيقة وعملية."
    },
    {
        id: 22,
        name_en: "Toys 'R' Us",
        name_ar: "تويز آر أس",
        category: "kids",
        level: "L2",
        x: 75,
        y: 45,
        iconUrl: "/icons/categories/kids/Toys R Us.png",
        description_en: "Toy retailer offering a wide selection of toys, games, and children's entertainment.",
        description_ar: "متجر ألعاب يقدم مجموعة واسعة من الألعاب والألعاب الترفيهية للأطفال."
    },

    // Sports stores
    {
        id: 23,
        name_en: "Geox",
        name_ar: "جيوكس",
        category: "sports",
        level: "L1",
        x: 85,
        y: 35,
        iconUrl: "/icons/categories/sports/Geox.png",
        description_en: "Italian footwear brand specializing in breathable and comfortable shoes.",
        description_ar: "علامة أحذية إيطالية متخصصة في الأحذية القابلة للتنفس والمريحة."
    },

    // Banks
    {
        id: 24,
        name_en: "Abu Dhabi Commercial Bank",
        name_ar: "بنك أبوظبي التجاري",
        category: "Banks",
        level: "G",
        x: 15,
        y: 25,
        iconUrl: "/icons/categories/Banks/Abu%20Dhabi%20Commercial%20Bank%20ADCB.png",
        description_en: "Leading UAE bank providing comprehensive financial services and digital banking solutions.",
        description_ar: "بنك رائد في دولة الإمارات يقدم خدمات مالية شاملة وحلول مصرفية رقمية."
    },
    {
        id: 25,
        name_en: "Al Ansari Exchange",
        name_ar: "صرافة الأنصاري",
        category: "Banks",
        level: "G",
        x: 25,
        y: 30,
        iconUrl: "/icons/categories/Banks/Al%20Ansari%20Exchange.png",
        description_en: "Premier money exchange and financial services provider in the UAE.",
        description_ar: "مقدم خدمات صرف العملات والخدمات المالية الرائد في دولة الإمارات."
    },
];

// ---------- GitHub categories & logos loader ----------
// const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
//     fashion: <Shirt className="w-6 h-6" />,
//     electronics: <Smartphone className="w-6 h-6" />,
//     "food & cafe": <Utensils className="w-6 h-6" />,
//     supermarket: <ShoppingCart className="w-6 h-6" />,
//     kids: <Baby className="w-6 h-6" />,
//     sports: <Footprints className="w-6 h-6" />,
//     Banks: <Info className="w-6 h-6" />,
// };

// function toDisplayName(fileName: string): string {
//     const dot = fileName.lastIndexOf(".");
//     const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
//     const spaced = base.replaceAll("_", " ").replaceAll("-", " ");
//     return spaced
//         .split(" ")
//         .filter(Boolean)
//         .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//         .join(" ");
// }

async function fetchLocalCategories(): Promise<{ categories: CategoryRec[]; stores: StoreRec[] }> {
    // For now, return empty arrays since we're using local static data
    // In a real implementation, you could fetch from a local API or static files
    return { categories: [], stores: [] };
}

// ---------- Utilities ----------
const toggleLang = (l: Lang): Lang => (l === "en" ? "ar" : "en");

function filterStores(stores: StoreRec[], query: string, activeCategory: string): StoreRec[] {
    const base = activeCategory === "all" ? stores : stores.filter((s) => s.category === activeCategory);
    const q = (query || "").trim().toLowerCase();
    if (!q) return base;
    return base.filter(
        (s) =>
            s.name_en.toLowerCase().includes(q) ||
            s.name_ar.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
    );
}

function getKeyboardLayout(lang: Lang): KbdKey[][] {
    if (lang === "ar") {
        const nums = "١٢٣٤٥٦٧٨٩٠".split("").map((c) => ({ label: c, value: c, kind: "char" as const }));
        const r1 = "ض ص ث ق ف غ ع ه خ ح ج".split(" ").map((c) => ({ label: c, value: c, kind: "char" as const }));
        const r2 = "ش س ي ب ل ا ت ن م ك ط".split(" ").map((c) => ({ label: c, value: c, kind: "char" as const }));
        const r3 = "ئ ء ؤ ر لا ى ة و ز ظ".split(" ").map((c) => ({ label: c, value: c, kind: "char" as const }));
        const row0 = [...nums, { label: "⌫", kind: "backspace" as const, span: 2 }];
        const last = [...r3, { label: "Space", kind: "space" as const, span: 3 }, { label: "Clear", kind: "clear" as const, span: 2 }];
        return [row0, r1, r2, last];
    }
    const num = "1234567890".split("").map((c) => ({ label: c, value: c, kind: "char" as const }));
    const r1 = "QWERTYUIOP".split("").map((c) => ({ label: c, value: c, kind: "char" as const }));
    const r2 = "ASDFGHJKL".split("").map((c) => ({ label: c, value: c, kind: "char" as const }));
    const r3 = "ZXCVBNM".split("").map((c) => ({ label: c, value: c, kind: "char" as const }));
    const row0 = [...num, { label: "⌫", kind: "backspace" as const, span: 2 }];
    const last = [...r3, { label: "Space", kind: "space" as const, span: 3 }, { label: "Clear", kind: "clear" as const, span: 2 }];
    return [row0, r1, r2, last];
}

// ---------- Small UI atoms ----------
// LanguageToggle removed - using inline language toggle in Header component

// Header component matching the design image
function Header({
    lang,
    onLangChange,
    onWhatsNewClick,
    onFeaturesClick,
    onEventsClick
}: {
    lang: Lang;
    onLangChange: (l: Lang) => void;
    onWhatsNewClick?: () => void;
    onFeaturesClick?: () => void;
    onEventsClick?: () => void;
}) {
    return (
        <div className="w-full bg-white shadow-sm">
            {/* Top utility bar */}
            <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
                {/* Left: Utility links */}
                <div className="flex items-center gap-5">
                    {/* OPEN TODAY */}
                    <div className="flex items-center gap-2 text-[var(--brand-black)]">
                        <Clock className="w-4 h-4 text-[var(--brand-black)]/70" />
                        <span className="text-sm font-semibold">
                            {lang === "en" ? "OPEN TODAY" : "مفتوح اليوم"}
                        </span>
                        <span className="text-sm font-normal">10 AM - 12 MN</span>
                    </div>

                    {/* Separator */}
                    <div className="w-px h-6 bg-gray-300" />

                    {/* Language selector */}
                    <button
                        onClick={() => onLangChange(toggleLang(lang))}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-black)] hover:text-[var(--brand-purple)] transition-colors"
                    >
                        <Languages className="w-4 h-4" />
                        <span>{lang === "en" ? "العربية" : "English"}</span>
                    </button>
                </div>

                {/* Right: Logo */}
                <div className="flex items-center">
                    <img
                        src={logoImage}
                        alt="Mall of Al Ain Logo"
                        className="h-[28.8px] md:h-[38.4px] object-contain"
                    />
                </div>
            </div>

            {/* Purple navigation bar */}
            <div className="w-full bg-[var(--brand-purple)] px-4 md:px-8 py-3.5">
                <nav className="flex items-center gap-10 md:gap-12 flex-wrap">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onWhatsNewClick?.();
                        }}
                        className="text-white font-normal text-lg hover:text-white/90 transition-colors whitespace-nowrap cursor-pointer"
                    >
                        {lang === "en" ? "WHAT'S NEW" : "ما الجديد"}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onEventsClick?.();
                        }}
                        className="text-white font-normal text-lg hover:text-white/90 transition-colors whitespace-nowrap cursor-pointer"
                    >
                        {lang === "en" ? "EVENTS" : "الفعاليات"}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onFeaturesClick?.();
                        }}
                        className="text-white font-normal text-lg hover:text-white/90 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span>{lang === "en" ? "FEATURES" : "المميزات"}</span>
                    </button>
                </nav>
            </div>
        </div>
    );
}

function Pill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 rounded-xl border transition text-sm whitespace-nowrap shadow-sm ${active
                ? "bg-[var(--brand-purple)] text-white border-transparent shadow-md"
                : "bg-white/80 hover:bg-white text-[var(--brand-black)] border-black/20 backdrop-blur shadow-sm"
                }`}
        >
            {children}
        </button>
    );
}

function ChipsRow({ items, activeKey, onSelect, lang }: { items: CategoryRec[]; activeKey: string; onSelect: (k: string) => void; lang: Lang }) {
    return (
        <div className="flex flex-wrap items-center gap-2 py-1 -mx-1 px-1">
            <Pill active={activeKey === "all"} onClick={() => onSelect("all")}>
                {STR[lang].all}
            </Pill>
            {items.map((c) => (
                <Pill key={c.key} active={activeKey === c.key} onClick={() => onSelect(c.key)}>
                    <span className="inline-flex items-center gap-2">
                        {c.icon}
                        <span>{lang === "en" ? c.en : c.ar}</span>
                    </span>
                </Pill>
            ))}
        </div>
    );
}

// function IconTile({ label, iconUrl, onClick }: { label: string; iconUrl?: string; onClick?: () => void }) {
//     return (
//         <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-2 rounded-2xl bg-white/80 hover:bg-white/90 border border-black/20 shadow-md backdrop-blur transition-all duration-200" data-grid-tile>
//             <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--brand-purple)]/10 overflow-hidden" data-grid-thumb data-icon-scale="up">
//                 {iconUrl ? (
//                     <img
//                         src={iconUrl}
//                         alt={label}
//                         className="w-8 h-8 object-contain"
//                         onError={(e) => {
//                             const target = e.target as HTMLImageElement;
//                             target.style.display = 'none';
//                             const parent = target.parentElement;
//                             if (parent) {
//                                 parent.innerHTML = '<div class="w-8 h-8 bg-[var(--brand-purple)]/20 rounded-lg flex items-center justify-center"><svg class="w-5 h-5 text-[var(--brand-purple)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>';
//                             }
//                         }}
//                     />
//                 ) : (
//                     <div className="w-8 h-8 bg-[var(--brand-purple)]/20 rounded-lg flex items-center justify-center" data-icon-scale="up">
//                         <svg className="w-5 h-5 text-[var(--brand-purple)]" fill="currentColor" viewBox="0 0 24 24">
//                             <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
//                         </svg>
//                     </div>
//                 )}
//             </div>
//             <div className="text-sm font-medium text-[var(--brand-black)]" data-text-scale="up">{label}</div>
//         </button>
//     );
// }

function AmenitiesBar({ lang, activeAmenity, onToggle }: { lang: Lang; activeAmenity?: string; onToggle: (key: string) => void }) {
    return (
        <div className={"px-4 md:px-6 pb-4"}>
            <div className="w-full rounded-2xl border border-black/20 bg-white/60 backdrop-blur shadow-md" data-glass>
                <div className="px-3 py-3 overflow-x-auto" data-tight-pad="md">
                    <div className="flex items-stretch justify-center gap-3 min-w-0 w-full" data-tight-gap="lg">
                        {AMENITIES.map((a) => (
                            <button
                                key={a.key}
                                onClick={() => onToggle(a.key)}
                                className={`shrink-0 inline-flex items-center gap-3 px-4 py-3 rounded-2xl border transition shadow-sm ${activeAmenity === a.key
                                    ? "bg-[var(--brand-purple)] text-white border-transparent"
                                    : "bg-white/90 hover:bg-white text-[var(--brand-black)] border-black/20 backdrop-blur"
                                    }`}
                            >
                                {a.iconUrl ? (
                                    <img src={a.iconUrl} alt={lang === 'en' ? a.en : a.ar} className="w-7 h-7 object-contain" data-icon-scale="up" />
                                ) : null}
                                <span className="text-base whitespace-nowrap" data-text-scale="up">{lang === 'en' ? a.en : a.ar}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ResultsList({ lang, items, onSelect }: { lang: Lang; items: StoreRec[]; onSelect: (id: number) => void }) {
    return (
        <div className="h-full flex flex-col bg-white/80 backdrop-blur rounded-2xl border border-black/20 overflow-hidden shadow-md">
            <div className="px-4 py-3 font-semibold text-[var(--brand-black)] bg-white/60 shrink-0">
                {STR[lang].results} ({items.length})
            </div>
            <div className="flex-1 overflow-auto divide-y divide-white/40">
                {items.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className="w-full text-left px-4 py-3 hover:bg-white/50 transition grid grid-cols-[40px_1fr_auto] gap-3 items-center"
                        data-list-item
                    >
                        <div className="w-8 h-8 rounded-lg bg-[var(--brand-purple)]/10 flex items-center justify-center overflow-hidden border border-black/20" data-list-thumb data-icon-scale="up">
                            {s.iconUrl ? (
                                <img
                                    src={toSrc(s.iconUrl) || ''}
                                    alt="Store logo"
                                    className="w-6 h-6 object-contain rounded-md"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const attempt = Number(target.dataset.a || '0');
                                        const storeId = Number(target.getAttribute('data-store-id'));
                                        const store = STORES.find((x) => x.id === storeId);
                                        if (store) {
                                            const list = buildStoreLogoCandidates(store);
                                            if (attempt < list.length) {
                                                target.dataset.a = String(attempt + 1);
                                                target.src = list[attempt];
                                                return;
                                            }
                                        }
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                            parent.innerHTML = '<svg class="w-5 h-5 text-[var(--brand-purple)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
                                        }
                                    }}
                                    data-store-id={s.id}
                                />
                            ) : (
                                <Store className="w-5 h-5 text-[var(--brand-purple)]" />
                            )}
                        </div>
                        <div>
                            <div className="font-medium text-[var(--brand-black)]" data-text-scale="up">{lang === "en" ? s.name_en : s.name_ar}</div>
                            <div className="text-xs text-black/60">
                                {STR[lang].level}: {s.level}
                            </div>
                        </div>
                        <MapPin className="w-5 h-5 text-[var(--brand-black)]/60" />
                    </button>
                ))}
            </div>
        </div>
    );
}

function ResultsGrid({ lang, items, onSelect }: { lang: Lang; items: StoreRec[]; onSelect: (id: number) => void }) {
    return (
        <div className="h-full bg-white/80 backdrop-blur rounded-2xl border border-black/20 shadow-md overflow-auto p-3">
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3" data-tight-grid-gap>
                {items.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onSelect(s.id)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-black/20 hover:bg-white/80 transition backdrop-blur shadow-sm"
                        data-grid-tile
                        style={{ backgroundColor: '#c9d1d952' }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-[var(--brand-purple)]/10 text-[var(--brand-purple)] grid place-items-center overflow-hidden border border-black/20" data-grid-thumb data-icon-scale="up">
                            {s.iconUrl ? (
                                <img src={toSrc(s.iconUrl) || ''} alt="logo" className="w-10 h-10 object-contain rounded-lg" data-store-id={s.id} onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    const attempt = Number(target.dataset.a || '0');
                                    const storeId = Number(target.getAttribute('data-store-id'));
                                    const store = STORES.find((x) => x.id === storeId);
                                    if (store) {
                                        const list = buildStoreLogoCandidates(store);
                                        if (attempt < list.length) {
                                            target.dataset.a = String(attempt + 1);
                                            target.src = list[attempt];
                                            return;
                                        }
                                    }
                                    target.style.display = 'none';
                                }} />
                            ) : (
                                <Store className="w-6 h-6" />
                            )}
                        </div>
                        <div className="text-sm font-medium text-center text-[var(--brand-black)] truncate w-full" data-text-scale="up">
                            {lang === "en" ? s.name_en : s.name_ar}
                        </div>
                        <div className="text-[10px] text-black/60">
                            {STR[lang].level}: {s.level}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function OnScreenKeyboard({ lang, onKey }: { lang: Lang; onKey: (key: KbdKey) => void }) {
    const rows = getKeyboardLayout(lang);
    return (
        <div className="w-full p-3 border border-black/20 bg-white/70 backdrop-blur rounded-xl" data-tight-pad="lg">
            {rows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-12 gap-1 mb-1 last:mb-0 select-none" data-tight-gap="sm">
                    {row.map((k, i) => (
                        <button
                            key={i}
                            data-test-id={k.kind === "backspace" ? "kbd-backspace" : undefined}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onKey(k);
                            }}
                            className={`py-2 rounded font-medium ${k.kind === "backspace"
                                ? "bg-[var(--brand-purple)] text-white"
                                : "bg-[var(--brand-purple)]/10 text-[var(--brand-black)]"
                                }`}
                            style={{ gridColumn: `span ${k.span ?? 1} / span ${k.span ?? 1}` }}
                        >
                            {k.label}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}

// Lucide fallbacks
// const BaseSvg: React.FC<React.SVGProps<SVGSVGElement>> = ({ className, children, ...rest }) => (
//     <svg
//         className={className}
//         viewBox="0 0 24 24"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth={2}
//         strokeLinecap="round"
//         strokeLinejoin="round"
//         aria-hidden="true"
//         {...rest}
//     >
//         {children}
//     </svg>
// );
// const RestroomIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
//     <BaseSvg {...props}>
//         <path d="M12 3v18" />
//         <circle cx="7" cy="5.5" r="1.5" />
//         <path d="M4.5 20v-6l2-3 2 3v6" />
//         <circle cx="17" cy="5.5" r="1.5" />
//         <path d="M18.5 20v-6h-3V20" />
//     </BaseSvg>
// );
// const ElevatorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
//     <BaseSvg {...props}>
//         <rect x="3" y="3" width="18" height="18" rx="2" />
//         <rect x="7" y="7" width="10" height="10" rx="1" />
//         <path d="M12 15l2-2h-4l2 2z" />
//         <path d="M12 9l-2 2h4l-2-2z" />
//     </BaseSvg>
// );

const AMENITIES = [
    { key: "restrooms", en: "Restrooms", ar: "الحمامات", iconUrl: iconRestroom },
    { key: "parking", en: "Parking", ar: "المواقف", iconUrl: iconParking },
    { key: "elevator", en: "Elevator", ar: "المصاعد", iconUrl: iconElevator },
    { key: "male_prayer", en: "Male Prayer Room", ar: "غرفة الصلاة للرجال", iconUrl: iconMalePrayer },
    { key: "female_prayer", en: "Female Prayer Room", ar: "غرفة الصلاة للسيدات", iconUrl: iconFemalePrayer },
    { key: "baby_changing", en: "Baby Changing Room", ar: "غرفة التغيير للأطفال", iconUrl: iconChangingRoom },
    { key: "lost_found", en: "Lost & Found", ar: "المفقودات", iconUrl: iconLostFound },
    { key: "customer_service", en: "Customer Service", ar: "خدمة العملاء", iconUrl: iconCustomerService },
    { key: "atm", en: "ATM", ar: "الصراف الآلي", iconUrl: iconAtm },
];

function BrowseBox({
    lang,
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    items,
    onSelect,
    categories,
}: {
    lang: Lang;
    query: string;
    setQuery: (v: string) => void;
    activeCategory: string;
    setActiveCategory: (k: string) => void;
    items: StoreRec[];
    onSelect: (id: number) => void;
    categories: CategoryRec[];
}) {
    const [view, setView] = useState<"grid" | "list">("grid");
    const [showKeyboard, setShowKeyboard] = useState(false);

    const handleKeyPress = (key: KbdKey) => {
        if (key.kind === "space") {
            setQuery(query + " ");
            return;
        }
        if (key.kind === "backspace") {
            setQuery(query.slice(0, -1));
            return;
        }
        if (key.kind === "clear") {
            setQuery("");
            return;
        }
        const val = key.value ?? key.label;
        setQuery(query + val);
    };

    return (
        <div
            data-test-id="glass-browse"
            className="backdrop-blur-xl bg-white/40 rounded-2xl border border-black/20 shadow-lg h-[98%] mt-[10px] mb-[30px] min-h-0 flex flex-col"
            data-glass
        >
            {/* Search header */}
            <div className="p-4  border-b border-white/40 min-w-0 flex-shrink-0" data-tight-pad="lg">
                <div className="flex flex-col gap-3" data-tight-gap="md">
                    {/* Search box */}
                    <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3 shadow-sm border border-black/20 backdrop-blur" data-tight-pad="md">
                        <Search className="w-5 h-5 text-[var(--brand-black)]/70" />
                        <input
                            className="w-full outline-none text-[var(--brand-black)] placeholder-black/50 bg-transparent"
                            placeholder={STR[lang].searchPlaceholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setShowKeyboard(true)}
                        />
                        <button
                            type="button"
                            aria-label={showKeyboard ? STR[lang].hideKeyboard : STR[lang].showKeyboard}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setShowKeyboard((v) => !v);
                            }}
                            className={`shrink-0 p-2 rounded-lg border ${showKeyboard ? "bg-[var(--brand-purple)] text-white border-transparent" : "bg-white/70 border-black/20"
                                }`}
                        >
                            <KeyboardIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* On-screen keyboard directly under search */}
                    {showKeyboard && <OnScreenKeyboard lang={lang} onKey={handleKeyPress} />}

                    {/* Chips row */}
                    <ChipsRow items={categories} activeKey={activeCategory} onSelect={setActiveCategory} lang={lang} />

                    {/* Divider before toolbar */}
                    <hr className="border-white/40" />

                    <div className="flex items-center justify-between">
                        <div className="text-sm text-black/70">
                            {STR[lang].results}: {items.length}
                        </div>
                        <div className="flex items-center gap-2" data-tight-gap="sm">
                            <button
                                className={`px-3 py-2 rounded-lg border ${view === "grid"
                                    ? "bg-[var(--brand-purple)] text-white border-transparent"
                                    : "bg-white/70 border-black/20 backdrop-blur"
                                    }`}
                                onClick={() => setView("grid")}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4" />
                                    {STR[lang].grid}
                                </span>
                            </button>
                            <button
                                className={`px-3 py-2 rounded-lg border ${view === "list"
                                    ? "bg-[var(--brand-purple)] text-white border-transparent"
                                    : "bg-white/70 border-black/20 backdrop-blur"
                                    }`}
                                onClick={() => setView("list")}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <ListIcon className="w-4 h-4" />
                                    {STR[lang].list}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results area */}
            <div className="flex-1 min-h-0 p-3 overflow-hidden" data-tight-pad="md">
                {view === "grid" ? (
                    <ResultsGrid lang={lang} items={items} onSelect={onSelect} />
                ) : (
                    <ResultsList lang={lang} items={items} onSelect={onSelect} />
                )}
            </div>
        </div>
    );
}

function MapCanvas({ lang }: { lang: Lang; activeId?: number; stores?: StoreRec[]; activeAmenity?: string }) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapViewRef = useRef<MapView | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [currentFloor, setCurrentFloor] = useState(0);
    const [floorsList, setFloorsList] = useState<any[]>([]); // Store floors in state to trigger re-renders
    const [zoom, setZoom] = useState(1);
    const [tilt, setTilt] = useState(0);
    const [mapError, setMapError] = useState<string | null>(null);
    const [retryMessage, setRetryMessage] = useState<string | null>(null);
    const retryCountRef = useRef(0); // Use useRef for persistent retryCount
    // Initialize MappedIn MapView
    useEffect(() => {
        let isMounted = true;
        const maxRetries = 3;
        const retryDelay = 2000; // Start with 2 seconds

        async function initMap() {
            if (!mapContainerRef.current || mapViewRef.current) return;

            // Ensure container has dimensions
            const container = mapContainerRef.current;
            if (container.offsetWidth === 0 || container.offsetHeight === 0) {
                // Wait for container to have dimensions
                setTimeout(initMap, 100);
                return;
            }

            try {
                console.log('Loading map with options:', MAPPEDIN_OPTIONS);
                const mapData = await getMapData(MAPPEDIN_OPTIONS);
                console.log('Map data loaded:', mapData);
                console.log('Map ID from data:', (mapData as any).id || (mapData as any).mapId);

                const MapOptions: TShow3DMapOptions = {
                    //initialFloor: initialFloor,
                    outdoorView: {
                        enabled: false,
                    },
                    style: {
                        //backgroundAlpha: number,
                        backgroundColor: '#87867b',
                        outlines: true,
                        shading: true,
                        //wallTopColor: '#ff00ff',
                    },
                };

                const mapView = await show3dMap(mapContainerRef.current, mapData, MapOptions);

                if (!isMounted) return;

                // Store mapView and mapData first
                mapViewRef.current = mapView;
                (mapViewRef.current as any).__mapData = mapData;

                // Get all floors from the API - matching reference exactly
                const floors = mapData.getByType('floor');
                // Sort floors by elevation (lowest first) for our UI controls
                floors.sort((a: any, b: any) => (a.elevation || 0) - (b.elevation || 0));
                (mapViewRef.current as any).__floors = floors;

                // Store floors in state BEFORE setting up event listeners
                setFloorsList(floors);

                // Set up floor-change event listener BEFORE any operations that might trigger it
                mapView.on('floor-change', (event: any) => {
                    if (!isMounted) return;
                    console.log('Floor change event:', event);

                    const floorsFromRef = (mapViewRef.current as any).__floors;
                    if (!floorsFromRef || floorsFromRef.length === 0) {
                        console.log('No floors in ref');
                        return;
                    }

                    // Match reference: event.floor.id
                    const newFloorId = event?.floor?.id || event?.floorId;
                    console.log('New floor ID:', newFloorId);
                    if (newFloorId) {
                        const floorIndex = floorsFromRef.findIndex((f: any) => f.id === newFloorId);
                        console.log('Found floor index:', floorIndex);
                        if (floorIndex !== -1) {
                            setCurrentFloor(floorIndex);
                        }
                    }
                });

                // Set initial floor index based on currentFloor (after listener is set up)
                try {
                    const currentFloorObj = mapView.currentFloor;
                    if (currentFloorObj && floors.length > 0) {
                        const floorIndex = floors.findIndex((f: any) => f.id === currentFloorObj.id);
                        if (floorIndex !== -1) {
                            setCurrentFloor(floorIndex);
                        } else {
                            setCurrentFloor(0);
                        }
                    } else {
                        setCurrentFloor(0);
                    }
                } catch (e) {
                    setCurrentFloor(0);
                }

                // Label all spaces - matching reference exactly (with error handling)
                try {
                    mapView.Text3D.labelAll();
                } catch (e) {
                    // Enterprise mode not enabled - this is expected with demo keys
                    console.log('Text3D.labelAll() skipped (Enterprise mode not enabled)');
                }

                // Apply space styling and labels - matching reference exactly
                let labelIcon = '';
                mapData.getByType("space").forEach((space: any) => {
                    if (space.type == 'hallway') {
                        mapView.updateState(space, {
                            color: "#848379", // Set height for the space
                        });
                    }
                    else if (space.type == 'room' && space.name && space.name.trim() != '') {
                        if (space.name.toLowerCase().includes("prayer")) {
                            labelIcon = svgIcons.prayer_room_mf;
                        }
                        else if (space.name.toLowerCase().includes("toilet")) {
                            labelIcon = svgIcons.toilet_mf;
                        }
                        else {
                            labelIcon = '';
                        }
                        mapView.Labels.add(space, space.name, {
                            appearance: {
                                //pinColor: color,
                                //pinColorInactive: color,
                                icon: labelIcon,
                                iconSize: 30,
                                color: "#101010",
                                textSize: 15,
                            },
                            // Ensure label sticks to map coordinates
                            rank: 'medium',
                        });
                    }
                });

                // Add labels for connections (elevators and escalators) - matching reference exactly
                mapData.getByType("connection").forEach((connection: any) => {
                    const connectionType = connection.type;
                    if (connectionType == 'elevator') {
                        connection.coordinates.forEach((c: any) => {
                            mapView.Labels.add(c, '', {
                                appearance: {
                                    pinColor: '#FFFFFF',
                                    pinColorInactive: '#FFFFFF',
                                    icon: svgIcons.elevators,
                                    iconSize: 30,
                                    color: "#101010",
                                    textSize: 15,
                                },
                                rank: 'medium',
                            });
                        });
                    }
                    else {
                        connection.coordinates.forEach((c: any) => {
                            mapView.Labels.add(c, '', {
                                appearance: {
                                    pinColor: '#FFFFFF',
                                    pinColorInactive: '#FFFFFF',
                                    icon: svgIcons.escalator,
                                    iconSize: 30,
                                    color: "#101010",
                                    textSize: 15,
                                },
                                rank: 'medium',
                            });
                        });
                    }
                });

                // Apply theme styling - matching reference exactly
                applyThemeStyling(mapView, mapData, theme);

                // Set up camera event listeners and initial state
                // Listen to camera changes - update zoom and tilt when camera changes
                let cameraUpdateTimeout: ReturnType<typeof setTimeout>;
                const updateCameraState = () => {
                    if (mapViewRef.current && mapViewRef.current.Camera) {
                        try {
                            setZoom(mapViewRef.current.Camera.zoomLevel);
                            setTilt(mapViewRef.current.Camera.pitch);
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                };

                // Throttle camera updates - event name is 'camera-change'
                mapView.on('camera-change', () => {
                    clearTimeout(cameraUpdateTimeout);
                    cameraUpdateTimeout = setTimeout(updateCameraState, 100);
                });

                // Ensure pan, zoom, and tilt interactions are enabled
                if (mapView.Camera && mapView.Camera.interactions) {
                    // Enable all interactions (zoom, pan)
                    mapView.Camera.interactions.set({
                        zoom: true,
                        pan: true,
                    });
                    mapView.Camera.interactions.enable();
                }

                // Also ensure the map container allows pointer events
                if (mapContainerRef.current) {
                    mapContainerRef.current.style.pointerEvents = 'auto';
                    // Ensure no CSS is blocking interactions
                    const canvas = mapContainerRef.current.querySelector('canvas');
                    if (canvas) {
                        canvas.style.touchAction = 'pan-x pan-y pinch-zoom';
                        canvas.style.pointerEvents = 'auto';
                    }
                }

                // Set initial camera position using Camera properties (after listener is set up)
                try {
                    if (mapView.Camera) {
                        setZoom(mapView.Camera.zoomLevel || 1);
                        setTilt(mapView.Camera.pitch || 0);
                    }
                } catch (e) {
                    console.log('Camera state not available yet:', e);
                }

                // Mark map as loaded ONLY after everything is set up
                setIsMapLoaded(true);
            } catch (error: any) {
                console.error('Failed to initialize MappedIn map:', error);

                // Handle rate limit errors (429) with retry
                if (error?.message?.includes('429') || error?.statusCode === 429 || error?.error === 'Too Many Requests') {
                    if (retryCountRef.current < maxRetries && isMounted) {
                        retryCountRef.current++;
                        const delay = retryDelay * retryCountRef.current; // Exponential backoff: 2s, 4s, 6s
                        const message = `Rate limit exceeded. Retrying in ${delay / 1000} seconds... (Attempt ${retryCountRef.current}/${maxRetries})`;
                        console.log(message);
                        setRetryMessage(message);
                        setMapError(null);

                        setTimeout(() => {
                            if (isMounted) {
                                setRetryMessage(null);
                                initMap();
                            }
                        }, delay);
                    } else {
                        const errorMsg = 'Max retries reached. Please wait a moment and refresh the page.';
                        console.error(errorMsg);
                        setMapError(errorMsg);
                        setRetryMessage(null);
                        setIsMapLoaded(false);
                    }
                } else {
                    // For other errors, don't retry
                    setMapError(error?.message || 'Failed to load map. Please refresh the page.');
                    setRetryMessage(null);
                    setIsMapLoaded(false);
                }
            }
        }

        initMap();

        return () => {
            isMounted = false;
            if (mapViewRef.current) {
                mapViewRef.current.destroy();
                mapViewRef.current = null;
            }
        };
    }, []);

    // Get floors from state (which triggers re-renders when updated)
    const floors = floorsList.length > 0
        ? floorsList.map((f: any) => f.shortName || f.name || f.id || 'G')
        : ['G', 'L1', 'L2', 'L3', 'L4', 'L5'];
    const currentFloorName = floors[currentFloor] || 'G';

    const handleFloorUp = () => {
        if (!mapViewRef.current || !isMapLoaded || !floorsList || floorsList.length === 0) {
            console.log('Floor up blocked:', { mapView: !!mapViewRef.current, isMapLoaded, floorsList: floorsList?.length });
            return;
        }
        if (currentFloor >= floorsList.length - 1) {
            console.log('Already at top floor');
            return;
        }

        const nextFloor = floorsList[currentFloor + 1];
        if (!nextFloor) {
            console.log('Next floor not found');
            return;
        }

        console.log('Changing floor up to:', nextFloor.id, nextFloor.name || nextFloor.shortName);
        // Try using Floor object first, fallback to ID
        try {
            mapViewRef.current.setFloor(nextFloor);
        } catch (e) {
            try {
                mapViewRef.current.setFloor(nextFloor.id);
            } catch (e2) {
                console.error('Error setting floor:', e2);
            }
        }
    };

    const handleFloorDown = () => {
        if (!mapViewRef.current || !isMapLoaded || !floorsList || floorsList.length === 0) {
            console.log('Floor down blocked:', { mapView: !!mapViewRef.current, isMapLoaded, floorsList: floorsList?.length });
            return;
        }
        if (currentFloor <= 0) {
            console.log('Already at bottom floor');
            return;
        }

        const prevFloor = floorsList[currentFloor - 1];
        if (!prevFloor) {
            console.log('Previous floor not found');
            return;
        }

        console.log('Changing floor down to:', prevFloor.id, prevFloor.name || prevFloor.shortName);
        // Try using Floor object first, fallback to ID
        try {
            mapViewRef.current.setFloor(prevFloor);
        } catch (e) {
            try {
                mapViewRef.current.setFloor(prevFloor.id);
            } catch (e2) {
                console.error('Error setting floor:', e2);
            }
        }
    };

    const handleZoomIn = () => {
        if (mapViewRef.current && mapViewRef.current.Camera) {
            try {
                const currentZoom = mapViewRef.current.Camera.zoomLevel;
                const maxZoom = mapViewRef.current.Camera.maxZoomLevel || 22;
                const newZoom = Math.min(currentZoom + 0.5, maxZoom);
                mapViewRef.current.Camera.set({ zoomLevel: newZoom });
            } catch (e) {
                console.error('Error zooming in:', e);
            }
        }
    };

    const handleZoomOut = () => {
        if (mapViewRef.current && mapViewRef.current.Camera) {
            try {
                const currentZoom = mapViewRef.current.Camera.zoomLevel;
                const minZoom = mapViewRef.current.Camera.minZoomLevel || 1;
                const newZoom = Math.max(currentZoom - 0.5, minZoom);
                mapViewRef.current.Camera.set({ zoomLevel: newZoom });
            } catch (e) {
                console.error('Error zooming out:', e);
            }
        }
    };

    const handleTiltLeft = () => {
        if (mapViewRef.current && mapViewRef.current.Camera) {
            try {
                const currentPitch = mapViewRef.current.Camera.pitch;
                const minPitch = mapViewRef.current.Camera.minPitch || -45;
                const newPitch = Math.max(currentPitch - 15, minPitch);
                mapViewRef.current.Camera.set({ pitch: newPitch });
            } catch (e) {
                console.error('Error tilting left:', e);
            }
        }
    };

    const handleTiltRight = () => {
        if (mapViewRef.current && mapViewRef.current.Camera) {
            try {
                const currentPitch = mapViewRef.current.Camera.pitch;
                const maxPitch = mapViewRef.current.Camera.maxPitch || 45;
                const newPitch = Math.min(currentPitch + 15, maxPitch);
                mapViewRef.current.Camera.set({ pitch: newPitch });
            } catch (e) {
                console.error('Error tilting right:', e);
            }
        }
    };

    const resetView = () => {
        if (mapViewRef.current && mapViewRef.current.Camera) {
            try {
                // Reset to default view - keep current center, reset zoom and pitch
                const center = mapViewRef.current.Camera.center;
                const defaultZoom = mapViewRef.current.Camera.minZoomLevel || 1;
                mapViewRef.current.Camera.set({
                    center: center,
                    zoomLevel: defaultZoom,
                    pitch: 0
                });
            } catch (e) {
                console.error('Error resetting view:', e);
            }
        }
    };


    return (
        <div
            ref={mapContainerRef}
            id="mappedin-map"
            className="relative w-full h-full"
            style={{
                backgroundColor: '#444444',
                position: 'relative',
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
                touchAction: 'pan-x pan-y pinch-zoom',
            }}
        >
            {/* MappedIn MapView will be rendered here */}
            {!isMapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#444444]">
                    <div className="text-center">
                        {retryMessage ? (
                            <div className="text-white">
                                <div className="mb-2">{retryMessage}</div>
                                <div className="text-sm text-white/70">Please wait...</div>
                            </div>
                        ) : mapError ? (
                            <div className="text-white">
                                <div className="mb-2 text-red-300">{mapError}</div>
                                <button
                                    onClick={() => {
                                        setMapError(null);
                                        setRetryMessage(null);
                                        setIsMapLoaded(false);
                                        if (mapViewRef.current) {
                                            mapViewRef.current.destroy();
                                            mapViewRef.current = null;
                                        }
                                        // Trigger re-initialization
                                        window.location.reload();
                                    }}
                                    className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="text-white">Loading map...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Store labels and amenity indicators will be handled by MappedIn */}

            {/* Floor Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
                <div className="backdrop-blur-md bg-white/80 rounded-xl border border-black/20 p-2 shadow-lg">
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={handleFloorUp}
                            disabled={!isMapLoaded || !floorsList || floorsList.length === 0 || currentFloor >= floorsList.length - 1}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title={isMapLoaded && floorsList && currentFloor < floorsList.length - 1 ? `Go to ${floors[currentFloor + 1] || 'next floor'}` : 'Cannot go up'}
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                        <div className="text-center text-sm font-medium text-[var(--brand-black)] py-1">
                            {currentFloorName}
                        </div>
                        <button
                            onClick={handleFloorDown}
                            disabled={!isMapLoaded || !floorsList || floorsList.length === 0 || currentFloor <= 0}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title={isMapLoaded && floorsList && currentFloor > 0 ? `Go to ${floors[currentFloor - 1] || 'previous floor'}` : 'Cannot go down'}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="backdrop-blur-md bg-white/80 rounded-xl border border-black/20 p-2 shadow-lg">
                    <div className="text-center text-xs font-medium text-[var(--brand-black)] mb-2">
                        {isMapLoaded && mapViewRef.current?.Camera
                            ? `${Math.round(zoom)}x`
                            : '1x'}
                    </div>
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={handleZoomIn}
                            disabled={!isMapLoaded || !mapViewRef.current?.Camera}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            disabled={!isMapLoaded || !mapViewRef.current?.Camera}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tilt Controls */}
            <div className="absolute bottom-16 left-4 flex gap-2">
                <div className="backdrop-blur-md bg-white/80 rounded-xl border border-black/20 p-2 shadow-lg">
                    <div className="text-center text-xs font-medium text-[var(--brand-black)] mb-2">
                        {tilt}°
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={handleTiltLeft}
                            disabled={!isMapLoaded || !mapViewRef.current?.Camera}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleTiltRight}
                            disabled={!isMapLoaded || !mapViewRef.current?.Camera}
                            className="p-1 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <RotateCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Reset View Button */}
                <button
                    onClick={resetView}
                    disabled={!isMapLoaded}
                    className="backdrop-blur-md bg-white/80 rounded-xl border border-black/20 p-2 shadow-lg hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={lang === "en" ? "Reset View" : "إعادة تعيين العرض"}
                >
                    <div className="text-xs font-medium text-[var(--brand-black)]">Reset</div>
                </button>
            </div>

            {/* Legend ribbon removed per request */}
        </div>
    );
}

function DetailsModal({ lang, store, onClose }: { lang: Lang; store: StoreRec | null; onClose: () => void }) {
    if (!store) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl w-[540px] max-w-[92vw] overflow-hidden shadow-xl border border-black/20">
                <div className="flex items-center justify-between px-6 py-4 bg-white/60">
                    <div className="flex items-center gap-3">
                        {store.iconUrl && (
                            <img
                                src={store.iconUrl}
                                alt="Store logo"
                                className="w-8 h-8 object-contain rounded-lg border border-black/20"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        )}
                        <div className="font-semibold text-lg text-[var(--brand-black)]">
                            {lang === "en" ? store.name_en : store.name_ar}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/70">
                        ✕
                    </button>
                </div>
                <div className="p-6 grid gap-4">
                    <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4" /> {STR[lang].level}: {store.level}
                    </div>

                    {/* Store Description */}
                    <div className="rounded-2xl border border-white/40 p-4 bg-white/60">
                        <div className="text-sm text-black/70 mb-2">
                            {lang === "en" ? "Description" : "الوصف"}
                        </div>
                        <div className="text-sm text-[var(--brand-black)]">
                            {lang === "en" ? store.description_en : store.description_ar}
                        </div>
                    </div>

                    {/* Store Image Placeholder */}
                    <div className="rounded-2xl border border-white/40 p-4 bg-white/60">
                        <div className="text-sm text-black/70 mb-2">
                            {lang === "en" ? "Store Preview" : "معاينة المتجر"}
                        </div>
                        <div className="h-40 rounded-xl overflow-hidden">
                            <img
                                src={withBase('/images/ShopHolder.png')}
                                alt="Store placeholder"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%236b7280'%3EStore Image%3C/text%3E%3C/svg%3E";
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="flex-1 px-4 py-3 rounded-xl bg-[var(--brand-purple)] text-white font-medium">
                            {STR[lang].directions}
                        </button>
                        <button className="px-4 py-3 rounded-xl border border-black/20 bg-white font-medium" onClick={onClose}>
                            {STR[lang].close}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------- Self-tests ----------
function runSelfTests(): { name: string; pass: boolean }[] {
    const tests: { name: string; pass: boolean }[] = [];
    tests.push({ name: "STR defined", pass: !!STR && !!STR.en && !!STR.ar });
    tests.push({ name: "CATEGORIES non-empty", pass: Array.isArray(CATEGORIES) && CATEGORIES.length > 0 });
    tests.push({ name: "STORES non-empty", pass: Array.isArray(STORES) && STORES.length > 0 });
    tests.push({ name: "toggleLang(en)->ar", pass: toggleLang("en") === "ar" });
    tests.push({ name: "toggleLang(ar)->en", pass: toggleLang("ar") === "en" });
    const en = getKeyboardLayout("en");
    const ar = getKeyboardLayout("ar");
    tests.push({ name: "EN has digit 1", pass: en.flat().some((k) => k.label === "1") });
    tests.push({ name: "EN has backspace", pass: en.flat().some((k) => k.kind === "backspace") });
    tests.push({ name: "AR has digit ١", pass: ar.flat().some((k) => k.label === "١") });
    tests.push({ name: "AR has clear", pass: ar.flat().some((k) => k.kind === "clear") });
    const f1 = filterStores(STORES, "zara", "all");
    tests.push({ name: "filter zara -> 1", pass: f1.length === 1 && f1[0].name_en === "Zara" });
    const f2 = filterStores(STORES, "", "fashion");
    tests.push({ name: "filter fashion subset", pass: f2.every((s) => s.category === "fashion") && f2.length >= 2 });
    return tests;
}

function TestBadge() {
    const [visible, setVisible] = useState(true);
    const tests = useMemo(runSelfTests, []);
    const passed = tests.filter((t) => t.pass).length;
    const failed = tests.length - passed;
    useEffect(() => {
        const id = setTimeout(() => setVisible(false), 4000);
        return () => clearTimeout(id);
    }, []);
    if (!visible) return null;
    return (
        <div
            className="fixed bottom-4 left-4 z-50 px-3 py-2 rounded-xl text-sm shadow-md border"
            style={{ background: failed ? "#FFE8E8" : "#EAFBE7", borderColor: failed ? "#E99" : "#9ED69E" }}
        >
            <div className="flex items-center gap-3">
                <span>
                    Tests: {passed}/{tests.length} passed{failed ? `, ${failed} failed` : ""}
                </span>
                <button className="opacity-60 hover:opacity-100" onClick={() => setVisible(false)}>
                    ×
                </button>
            </div>
        </div>
    );
}

export default function WayfindingApp() {
    // Inject Tailwind (for playgrounds / Cursor single-file environment)
    useEffect(() => {
        const existing = document.getElementById("tw-play-cdn");
        if (!existing) {
            const s = document.createElement("script");
            s.id = "tw-play-cdn";
            s.src = "https://cdn.tailwindcss.com";
            document.head.appendChild(s);
        }
    }, []);

    // Language & RTL
    const [lang, setLang] = useState<Lang>(() => {
        try {
            const saved = typeof window !== "undefined" ? window.localStorage.getItem("aam_lang") : null;
            return saved === "ar" || saved === "en" ? (saved as Lang) : "en";
        } catch {
            return "en";
        }
    });
    // Keep UI layout fixed; do not flip when switching language
    const dir: 'ltr' = 'ltr';

    // UI density variant (flat/dense)
    const [dense] = useState<boolean>(false);

    // Browse state
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [activeStoreId, setActiveStoreId] = useState<number | undefined>();
    const [activeAmenity, setActiveAmenity] = useState<string | undefined>(undefined);
    const [activePageUrl, setActivePageUrl] = useState<string | null>(null);

    // Remote data (GitHub) with local fallbacks
    const [remoteCats, setRemoteCats] = useState<CategoryRec[] | null>(null);
    const [remoteStores, setRemoteStores] = useState<StoreRec[] | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const { categories, stores } = await fetchLocalCategories();
                if (categories.length) setRemoteCats(categories);
                if (stores.length) setRemoteStores(stores);
            } catch {
                // silent fallback to local static data
            }
        })();
    }, []);

    const categoriesData = remoteCats ?? CATEGORIES;
    const storesData = remoteStores ?? STORES;
    const filtered = useMemo(() => filterStores(storesData, query, activeCategory), [activeCategory, query, storesData]);
    const selectedStore = storesData.find((s) => s.id === activeStoreId) || null;

    return (
        <div
            className="w-full relative overflow-hidden"
            data-ui-variant={dense ? "dense" : "default"}
            dir={dir}
            style={{
                ["--brand-purple" as any]: "#7642c7",
                ["--brand-black" as any]: "#212424",
                ["--brand-white" as any]: "#ffffff",
                ["--brand-gray" as any]: "#f8f9fa",
                height: "100vh",
                fontFamily: lang === 'ar' ? '"URW DIN Arabic", Poppins, ui-sans-serif, system-ui' : 'Poppins, ui-sans-serif, system-ui',
                background: "#ffffff"
            }}
        >
            {/* Font setup */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap');
        @font-face { font-family: 'URW DIN Arabic'; src: url(${arabicFontUrl}) format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
        :root { 
            --brand-purple: #7642c7; 
            --brand-black: #1a1a1a; 
            --brand-white: #ffffff;
            --brand-gray: #f8f9fa;
            --brand-dark-gray: #6b7280;
        }
        /* Body font is set on the root container via inline style */
        
        @keyframes gradient {
            0% { 
                background: linear-gradient(135deg, #ffffff 0%, #c9aaf0 50%, #7642c7 100%);
            }
            20% { 
                background: linear-gradient(135deg, #f5f5f5 0%, #c0a8e8 50%, #7642c7 100%);
            }
            40% { 
                background: linear-gradient(135deg, #e8e8e8 0%, #b098d8 50%, #7642c7 100%);
            }
            60% { 
                background: linear-gradient(135deg, #d8d8d8 0%, #a088c8 50%, #7642c7 100%);
            }
            80% { 
                background: linear-gradient(135deg, #c8c8c8 0%, #9078b8 50%, #7642c7 100%);
            }
            100% { 
                background: linear-gradient(135deg, #ffffff 0%, #c9aaf0 50%, #7642c7 100%);
            }
        }
        
        @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes float {
            0% { transform: translateX(-100px) translateY(0px); }
            25% { transform: translateX(25vw) translateY(-10px); }
            50% { transform: translateX(50vw) translateY(5px); }
            75% { transform: translateX(75vw) translateY(-5px); }
            100% { transform: translateX(calc(100vw + 100px)) translateY(0px); }
        }
        
        .animate-twinkle {
            animation: twinkle 2s ease-in-out infinite;
        }
        
        @keyframes amenity-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .animate-amenity-pulse {
            animation: amenity-pulse 2s ease-in-out infinite;
        }
        
        .animate-float {
            animation: float 25s linear infinite;
        }
        
        .animate-gradient {
            background-size: 200% 200%;
            animation: gradient 8s ease-in-out infinite alternate;
        }
        
        /* Dense (flat) variant overrides */
        [data-ui-variant="dense"] * { border-radius: 0 !important; }
        [data-ui-variant="dense"] [data-glass] { background: rgba(255,255,255,0.9) !important; }
        [data-ui-variant="dense"] [data-tight-pad="lg"] { padding: 8px !important; }
        [data-ui-variant="dense"] [data-tight-pad="md"] { padding: 6px !important; }
        [data-ui-variant="dense"] [data-tight-pad="sm"] { padding: 4px !important; }
        [data-ui-variant="dense"] [data-tight-gap="lg"] { gap: 4px !important; }
        [data-ui-variant="dense"] [data-tight-gap="md"] { gap: 3px !important; }
        [data-ui-variant="dense"] [data-tight-gap="sm"] { gap: 2px !important; }
        [data-ui-variant="dense"] [data-tight-grid-gap] { gap: 4px !important; }
        [data-ui-variant="dense"] [data-icon-scale="up"] svg,
        [data-ui-variant="dense"] [data-icon-scale="up"] img { width: 2.75rem !important; height: 2.75rem !important; }
        [data-ui-variant="dense"] [data-text-scale="up"] { font-size: 1.05rem !important; }
        [data-ui-variant="dense"] [data-list-item] { padding: 8px 10px !important; }
        [data-ui-variant="dense"] [data-list-thumb] { width: 3rem !important; height: 3rem !important; }
        [data-ui-variant="dense"] [data-grid-tile] { padding: 8px !important; }
        [data-ui-variant="dense"] [data-grid-thumb] { width: 4rem !important; height: 4rem !important; }
        
        `}</style>

            <div data-test-id="app-root" className="relative mx-auto w-full max-w-[1920px] h-full flex flex-col">
                {/* Header with top utility bar and purple navigation */}
                <Header
                    lang={lang}
                    onLangChange={setLang}
                    onWhatsNewClick={() => setActivePageUrl(activePageUrl === "https://makanimallofalain.com/whats-new" ? null : "https://makanimallofalain.com/whats-new")}
                    onFeaturesClick={() => setActivePageUrl(activePageUrl === "https://makanimallofalain.com/amenities" ? null : "https://makanimallofalain.com/amenities")}
                    onEventsClick={() => setActivePageUrl(activePageUrl === "https://makanimallofalain.com/events" ? null : "https://makanimallofalain.com/events")}
                />

                {/* Main layout – responsive grid (stacks on small screens, 2 cols on xl+) */}
                <main data-test-id="main-grid" className={`flex-1 min-h-0 px-4 md:px-6 pb-2 grid ${dense ? "gap-0" : "gap-4 md:gap-6"} items-stretch grid-cols-1 xl:[grid-template-columns:560px_1fr] overflow-hidden`}>
                    {/* Left: Browse/search or iframe view (fixed left on xl+) */}
                    <section className="min-h-0 min-w-0 xl:col-start-1 xl:col-end-2 xl:row-start-1 overflow-hidden">
                        {activePageUrl ? (
                            <div className="backdrop-blur-xl bg-white/40 rounded-2xl border border-black/20 shadow-lg h-full min-h-0 flex flex-col">
                                <div className="flex items-center justify-between p-4 border-b border-white/40">
                                    <h2 className="text-lg font-semibold text-[var(--brand-black)]">
                                        {activePageUrl.includes("whats-new") ? (lang === "en" ? "WHAT'S NEW" : "ما الجديد") :
                                            activePageUrl.includes("amenities") ? (lang === "en" ? "FEATURES" : "المميزات") :
                                                activePageUrl.includes("events") ? (lang === "en" ? "EVENTS" : "الفعاليات") : ""}
                                    </h2>
                                    <button
                                        onClick={() => setActivePageUrl(null)}
                                        className="px-3 py-1 rounded-lg bg-[var(--brand-purple)] text-white text-sm font-medium hover:bg-[var(--brand-purple)]/90 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                                <iframe
                                    src={activePageUrl}
                                    className="w-full flex-1 border-0 rounded-b-2xl"
                                    title={activePageUrl.includes("whats-new") ? "What's New" :
                                        activePageUrl.includes("amenities") ? "Features" :
                                            activePageUrl.includes("events") ? "Events" : ""}
                                    allow="fullscreen"
                                />
                            </div>
                        ) : (
                            <BrowseBox
                                lang={lang}
                                query={query}
                                setQuery={setQuery}
                                activeCategory={activeCategory}
                                setActiveCategory={setActiveCategory}
                                items={filtered}
                                onSelect={(id) => setActiveStoreId(id)}
                                categories={categoriesData}
                            />
                        )}
                    </section>

                    {/* Right: Map (fixed right on xl+) */}
                    <section className="h-[360px] md:h-[520px] xl:h-full min-h-0 flex flex-col xl:col-start-2 xl:col-end-3 xl:row-start-1">
                        <div className="flex-1 min-h-0">
                            <MapCanvas lang={lang} activeId={activeStoreId} stores={storesData} activeAmenity={activeAmenity} />
                        </div>
                    </section>

                </main>

                {/* Full-width Amenities Bar */}
                <AmenitiesBar lang={lang} activeAmenity={activeAmenity} onToggle={(key) => setActiveAmenity(activeAmenity === key ? undefined : key)} />

                {/* Footer removed per request */}
            </div>

            {/* Modal */}
            <DetailsModal lang={lang} store={selectedStore} onClose={() => setActiveStoreId(undefined)} />

            {/* Tests */}
            <TestBadge />
        </div>
    );
}
