// ============================================================
//  المنتجات — Products
//  ⚠️ كل المنتجات والأسعار هنا "عينات للعرض" وليست بضاعة حقيقية.
//  ⚠️ All products and prices below are DEMO SAMPLES, not real stock.
//
//  لإضافة منتج: انسخ أي منتج والصقه، وغيّر الـ id (لازم يكون مختلف).
//  To add a product: copy one block, paste it, and give it a new unique id.
//
//  الحقول — Fields:
//   id        رقم/اسم مميز لا يتكرر
//   name      اسم المنتج بالعربي والإنجليزي
//   category  قسم المنتج (لازم يكون من الأقسام اللي تحت: men / women)
//   price     السعر بالجنيه
//   oldPrice  السعر قبل الخصم (اختياري — امسحه لو مفيش خصم)
//   sizes     المقاسات المتاحة (كلها بنفس السعر)
//   stock     'in' = متاح  |  'low' = كمية محدودة  |  'out' = نفدت الكمية
//   variants  (بدل price/sizes/stock) لو كل مقاس ليه سعر وكمية: [{ size, price, compareAt?, stock }]
//   ⚠️ لما الداتابيز تتوصل، المنتجات بتتعدل من لوحة التحكم مش من الملف ده
//   isNew     true = يظهر في "وصل حديثاً"
//   featured  true = يظهر في أول القائمة
//   image     مسار صورة حقيقية داخل مجلد public مثل '/products/shirt-1.jpg'
//             (لو مفيش صورة، الموقع يرسم رسمة توضيحية بدلها من حقل art)
//   art       الرسمة التوضيحية: type = tee | shirt | hoodie | jacket | pants | dress | skirt
// ============================================================

export const categories = [
  { id: 'men', name: { ar: 'رجالي', en: 'Men' }, art: { type: 'shirt', color: '#2b2a2f', bg: '#e9e7e3' } },
  { id: 'women', name: { ar: 'حريمي', en: 'Women' }, art: { type: 'dress', color: '#e3262d', bg: '#f6e4e2' } },
  { id: 'kids', name: { ar: 'أطفال', en: 'Kids' }, art: { type: 'tee', color: '#f2b705', bg: '#fbf1cf' } },
]

export const products = [
  {
    id: 'm-01',
    name: { ar: 'قميص قطن كلاسيك', en: 'Classic Cotton Shirt' },
    category: 'men',
    price: 350,
    oldPrice: 550,
    sizes: ['M', 'L', 'XL', 'XXL'],
    stock: 'in',
    isNew: true,
    featured: true,
    art: { type: 'shirt', color: '#f3f1ec', bg: '#2b2a2f' },
  },
  {
    id: 'm-02',
    name: { ar: 'تيشيرت بيسك', en: 'Basic T-Shirt' },
    category: 'men',
    price: 180,
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 'in',
    isNew: false,
    featured: true,
    art: { type: 'tee', color: '#e3262d', bg: '#f6e4e2' },
  },
  {
    id: 'm-03',
    name: { ar: 'هودي شتوي', en: 'Winter Hoodie' },
    category: 'men',
    price: 450,
    oldPrice: 700,
    sizes: ['L', 'XL', 'XXL'],
    stock: 'low',
    isNew: true,
    featured: true,
    art: { type: 'hoodie', color: '#55535a', bg: '#e9e7e3' },
  },
  {
    id: 'm-04',
    name: { ar: 'بنطلون جينز', en: 'Denim Jeans' },
    category: 'men',
    // مثال: كل مقاس بسعر وكمية مختلفة — Example: each size with its own price and quantity
    variants: [
      { size: '30', price: 380, stock: 4 },
      { size: '32', price: 400, stock: 2 },
      { size: '34', price: 400, stock: 0 },
      { size: '36', price: 420, compareAt: 550, stock: 6 },
      { size: '38', price: 450, stock: 1 },
    ],
    isNew: false,
    featured: false,
    art: { type: 'pants', color: '#3d5a80', bg: '#e4e8ee' },
  },
  {
    id: 'm-05',
    name: { ar: 'جاكيت خفيف', en: 'Light Jacket' },
    category: 'men',
    price: 600,
    oldPrice: 900,
    sizes: ['M', 'L', 'XL'],
    stock: 'out',
    isNew: false,
    featured: false,
    art: { type: 'jacket', color: '#6b7b5e', bg: '#e8eae2' },
  },
  {
    id: 'm-06',
    name: { ar: 'تيشيرت بولو', en: 'Polo T-Shirt' },
    category: 'men',
    price: 250,
    sizes: ['M', 'L', 'XL'],
    stock: 'in',
    isNew: true,
    featured: false,
    art: { type: 'tee', color: '#ffffff', bg: '#e3262d' },
  },
  {
    id: 'w-01',
    name: { ar: 'فستان صيفي', en: 'Summer Dress' },
    category: 'women',
    price: 420,
    oldPrice: 650,
    sizes: ['S', 'M', 'L'],
    stock: 'in',
    isNew: true,
    featured: true,
    art: { type: 'dress', color: '#e3262d', bg: '#f6e4e2' },
  },
  {
    id: 'w-02',
    name: { ar: 'بلوزة كاجوال', en: 'Casual Blouse' },
    category: 'women',
    price: 220,
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 'in',
    isNew: false,
    featured: true,
    art: { type: 'tee', color: '#c9b8a6', bg: '#f1ece6' },
  },
  {
    id: 'w-03',
    name: { ar: 'جيبة ميدي', en: 'Midi Skirt' },
    category: 'women',
    price: 280,
    sizes: ['S', 'M', 'L'],
    stock: 'low',
    isNew: true,
    featured: false,
    art: { type: 'skirt', color: '#2b2a2f', bg: '#e9e7e3' },
  },
  {
    id: 'w-04',
    name: { ar: 'هودي واسع', en: 'Oversized Hoodie' },
    category: 'women',
    price: 390,
    oldPrice: 520,
    sizes: ['M', 'L', 'XL'],
    stock: 'in',
    isNew: false,
    featured: false,
    art: { type: 'hoodie', color: '#e8a5a0', bg: '#f8ebe9' },
  },
  {
    id: 'w-05',
    name: { ar: 'بنطلون واسع', en: 'Wide-Leg Trousers' },
    category: 'women',
    price: 340,
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 'in',
    isNew: true,
    featured: false,
    art: { type: 'pants', color: '#8a7a6a', bg: '#eeeae4' },
  },
  {
    id: 'w-06',
    name: { ar: 'جاكيت جينز', en: 'Denim Jacket' },
    category: 'women',
    price: 550,
    sizes: ['S', 'M', 'L'],
    stock: 'out',
    isNew: false,
    featured: false,
    art: { type: 'jacket', color: '#5b7aa6', bg: '#e4e8ee' },
  },
  {
    id: 'k-01',
    name: { ar: 'تيشيرت أطفال', en: 'Kids T-Shirt' },
    category: 'kids',
    price: 140,
    sizes: ['4', '6', '8', '10'],
    stock: 'in',
    isNew: true,
    featured: false,
    art: { type: 'tee', color: '#f2b705', bg: '#fbf1cf' },
  },
  {
    id: 'k-02',
    name: { ar: 'هودي أطفال', en: 'Kids Hoodie' },
    category: 'kids',
    price: 260,
    oldPrice: 340,
    sizes: ['6', '8', '10', '12'],
    stock: 'low',
    isNew: false,
    featured: false,
    art: { type: 'hoodie', color: '#3d5a80', bg: '#e4e8ee' },
  },
]
