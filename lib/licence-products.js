// lib/licence-products.js - Product lines used to count licences on the dashboard
//
// grouped: one licence per customer covers every device of the line
//          (3 Adisyon terminals = 1 licence; Yemek Sepeti + Trendyol for one customer = 1 licence).
// Not grouped: every device (service) is its own licence.
// Several categories are listed per line because the service forms save different names for the same product.

// Categories created by connected systems (/api/integration). The POS proxy saves the POS provider as the category.
export const MAMENU_CATEGORY = 'MaMenu';
export const POS_PROVIDERS = [
    { key: 'inpos-tsm', category: 'inPOS TSM' },
    { key: 'inpos-gmp3', category: 'inPOS GMP3' },
    { key: 'beko', category: 'Beko POS' },
    { key: 'pavo', category: 'Pavo POS' },
    { key: 'worldline', category: 'Worldline' },
    { key: 'odeal', category: 'Odeal' },
    { key: 'hugin-fpu', category: 'Hugin FPU' },
    { key: 'propay-p1000', category: 'Propay P1000' },
];

const PRODUCT_LINES = [
    { key: 'adisyon', label: 'Adisyon Programı', grouped: true, categories: ['Adisyon Programı'] },
    {
        key: 'food-platforms',
        label: 'Online Yemek Platformları',
        grouped: true,
        categories: ['Yemek Sepeti', 'Trendyol Yemek', 'Getir Yemek', 'Migros Yemek', 'Yemek Uygulamaları'],
    },
    {
        key: 'pos',
        label: 'Yazarkasa POS Entegrasyonu',
        grouped: false,
        categories: ['Yazarkasa Pos Entegrasyonu', ...POS_PROVIDERS.map((provider) => provider.category)],
    },
    { key: 'mamenu', label: 'MaMenu', grouped: false, categories: [MAMENU_CATEGORY] },
    { key: 'patron', label: 'Patron Uygulaması', grouped: false, categories: ['Patron Uygulaması', 'Patron Takip Uygulaması'] },
    { key: 'menu', label: 'Dijital Menü', grouped: false, categories: ['Digital Menü', 'QR Menu'] },
    { key: 'courier', label: 'Kurye Uygulaması', grouped: false, categories: ['Kurye Uygulaması', 'Kurye Sipariş Uygulaması'] },
];

const LINE_BY_CATEGORY = new Map(PRODUCT_LINES.flatMap((line) => line.categories.map((category) => [category, line])));

export const GROUPED_CATEGORIES = PRODUCT_LINES.filter((line) => line.grouped).flatMap((line) => line.categories);

// Categories not listed above become their own per-device line
export function getProductLine(category) {
    return LINE_BY_CATEGORY.get(category) || { key: `category:${category}`, label: category, grouped: false };
}
