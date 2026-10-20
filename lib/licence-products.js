// lib/licence-products.js - Product lines used to count licences on the dashboard
//
// grouped: one licence per customer covers every device of the line
//          (3 Adisyon terminals = 1 licence; Yemek Sepeti + Trendyol for one customer = 1 licence).
// Not grouped: every device (service) is its own licence.
// Several categories are listed per line because the service forms save different names for the same product.
const PRODUCT_LINES = [
    { key: 'adisyon', label: 'Adisyon Programı', grouped: true, categories: ['Adisyon Programı'] },
    {
        key: 'food-platforms',
        label: 'Online Yemek Platformları',
        grouped: true,
        categories: ['Yemek Sepeti', 'Trendyol Yemek', 'Getir Yemek', 'Migros Yemek', 'Yemek Uygulamaları'],
    },
    { key: 'pos', label: 'Yazarkasa POS Entegrasyonu', grouped: false, categories: ['Yazarkasa Pos Entegrasyonu'] },
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
