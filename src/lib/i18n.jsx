import { useContext, useEffect, useMemo, useState } from 'react'
import { LangContext } from './contexts'

const strings = {
  ar: {
    demoBar: 'نسخة تجريبية — المنتجات والأسعار المعروضة عينات للعرض فقط',
    navHome: 'الرئيسية',
    navShop: 'المتجر',
    navNew: 'وصل حديثاً',
    navAbout: 'من نحن',
    navContact: 'تواصل معنا',
    whatsapp: 'واتساب',
    orderWhatsapp: 'اطلب على واتساب',
    menu: 'القائمة',
    closeMenu: 'إغلاق القائمة',
    cart: 'السلة',
    switchLang: 'English',
    switchLangLabel: 'Switch to English',

    heroKicker: 'ميامي – الإسكندرية',
    // عناوين الهيرو — تتبدل تلقائياً. كل عنوان = سطرين [أبيض، أحمر]. زوّد أو امسح براحتك.
    heroTitles: [
      ['البس براندات', 'بسعر الاستوك'],
      ['تشكيلة جديدة', 'كل أسبوع'],
      ['شياكة مش لازم', 'تكلفك كتير'],
      ['زورنا في ميامي', 'وشوف بنفسك'],
      ['اختار مقاسك', 'واطلب واتساب'],
      ['رجالي وحريمي وأطفال', 'في مكان واحد'],
    ],
    heroText: 'تشكيلة ملابس استوك رجالي وحريمي بأسعار مناسبة. تصفح المنتجات، اختار مقاسك، واطلب مباشرة على واتساب أو زورنا في المحل.',
    heroCta: 'تصفح المنتجات',
    heroCta2: 'زور المحل',

    marquee: ['ملابس استوك', 'أسعار مناسبة', 'رجالي', 'حريمي', 'ميامي – الإسكندرية', 'اطلب على واتساب'],

    catKicker: 'الأقسام',
    catTitle: 'تسوق حسب القسم',
    catAll: 'كل المنتجات',
    catNew: 'وصل حديثاً',
    shopNow: 'تسوق الآن',
    itemsCount: (n) => `${n} منتج`,

    shopKicker: 'المتجر',
    shopTitle: 'تسوق التشكيلة',
    off: (n) => `خصم ${n}٪`,
    filterAll: 'الكل',
    sortLabel: 'ترتيب حسب',
    sortFeatured: 'المميز أولاً',
    sortLow: 'السعر: من الأقل',
    sortHigh: 'السعر: من الأعلى',
    noProducts: 'لا توجد منتجات في هذا القسم حالياً.',
    loadError: 'تعذر تحميل المنتجات. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.',
    retry: 'إعادة المحاولة',

    newKicker: 'جديد',
    newTitle: 'وصل حديثاً',
    newText: 'أحدث القطع اللي نزلت المحل — اسأل على المقاس المتاح قبل ما يخلص.',

    sample: 'عينة',
    newBadge: 'جديد',
    inStock: 'متاح',
    lowStock: 'كمية محدودة',
    outStock: 'نفدت الكمية',
    sizes: 'المقاسات',
    chooseSize: 'اختار المقاس',
    pickSizeFirst: 'اختار المقاس الأول',
    addToCart: 'أضف للسلة',
    added: 'تمت الإضافة ✓',
    askWhatsapp: 'اسأل عن المنتج على واتساب',
    askMsg: (name, size) => `مرحباً يحيى استوك، أريد الاستفسار عن: ${name}${size ? ` — مقاس ${size}` : ''}`,
    illustration: 'صورة توضيحية',

    whyKicker: 'ليه يحيى استوك؟',
    whyTitle: 'موضة بسعر يناسبك',
    why: [
      { t: 'أسعار الاستوك', d: 'قطع استوك وأوت لت بأسعار مناسبة.' },
      { t: 'تشكيلة متنوعة', d: 'قطع رجالي وحريمي بمقاسات وألوان مختلفة.' },
      { t: 'اطلب بسهولة', d: 'اختار من الموقع وابعت طلبك على واتساب في ثواني.' },
      { t: 'زورنا في ميامي', d: 'شوف البضاعة وقيسها بنفسك في المحل.' },
    ],

    visitKicker: 'زورنا',
    visitTitle: 'مكاننا في ميامي',
    address: 'العنوان',
    hours: 'مواعيد العمل',
    hoursPending: 'سيتم إضافة المواعيد قريباً — اتصل بنا للتأكد.',
    phones: 'أرقام التليفون',
    landline: 'تليفون أرضي',
    directions: 'الاتجاهات على خرائط جوجل',
    callNow: 'اتصل الآن',
    mapTitle: 'خريطة موقع محل يحيى استوك',

    contactKicker: 'تواصل معنا',
    contactTitle: 'عندك سؤال؟ كلمنا',
    contactText: 'ابعتلنا رسالتك على واتساب أو اتصل بينا مباشرة.',
    callMobile: 'موبايل',
    msgFormTitle: 'ابعت رسالة سريعة',
    formName: 'الاسم',
    formNamePh: 'اسمك',
    formMsg: 'رسالتك',
    formMsgPh: 'مثلاً: عندكم مقاس XL من القميص الكلاسيك؟',
    formSend: 'إرسال على واتساب',
    formNote: 'هيفتح واتساب برسالتك جاهزة — مش هيتبعت حاجة غير لما تدوس إرسال.',
    followUs: 'تابعنا',
    telegram: 'تيليجرام',
    facebook: 'فيسبوك',
    instagram: 'إنستجرام',
    tiktok: 'تيك توك',

    footerText: 'ملابس استوك رجالي وحريمي بأسعار مناسبة في ميامي، الإسكندرية.',
    footerLinks: 'روابط',
    footerVisit: 'العنوان',
    footerContact: 'تواصل',
    rights: 'جميع الحقوق محفوظة',
    demoNote: 'موقع تجريبي — البيانات قيد التأكيد من صاحب المحل.',

    cartTitle: 'سلة الطلب',
    cartEmpty: 'السلة فاضية. اختار مقاس وأضف منتجات من المتجر.',
    size: 'مقاس',
    qty: 'الكمية',
    increase: 'زيادة الكمية',
    decrease: 'تقليل الكمية',
    remove: 'حذف',
    subtotal: 'الإجمالي التقريبي',
    cartNote: 'الأسعار النهائية والتوفر يتم تأكيدهم من المحل على واتساب. لا يوجد دفع إلكتروني.',
    yourName: 'الاسم (اختياري)',
    yourArea: 'المنطقة / العنوان (اختياري)',
    sendOrder: 'ابعت الطلب على واتساب',
    clearCart: 'تفريغ السلة',
    closeCart: 'إغلاق السلة',
    orderIntro: 'مرحباً يحيى استوك، أريد طلب المنتجات التالية:',
    orderTotal: 'الإجمالي التقريبي',
    orderName: 'الاسم',
    orderArea: 'المنطقة',
    orderFooter: '(طلب من الموقع)',
    contactMsg: (name, msg) => `مرحباً يحيى استوك${name ? `، معك ${name}` : ''}.\n${msg}`,
  },

  en: {
    demoBar: 'Demo version — products and prices shown are samples only',
    navHome: 'Home',
    navShop: 'Shop',
    navNew: 'New Arrivals',
    navAbout: 'About',
    navContact: 'Contact',
    whatsapp: 'WhatsApp',
    orderWhatsapp: 'Order on WhatsApp',
    menu: 'Menu',
    closeMenu: 'Close menu',
    cart: 'Cart',
    switchLang: 'عربي',
    switchLangLabel: 'التبديل إلى العربية',

    heroKicker: 'Miami – Alexandria',
    // Hero headlines rotate automatically. Each = two lines [white, red].
    heroTitles: [
      ['Wear brands', 'at stock prices'],
      ['Fresh pieces', 'every week'],
      ['Looking sharp', 'shouldn’t cost much'],
      ['Visit us in Miami', 'and see for yourself'],
      ['Pick your size', 'order on WhatsApp'],
      ['Men, women & kids', 'under one roof'],
    ],
    heroText: 'Men’s and women’s stock clothing at affordable prices. Browse, pick your size, and order straight on WhatsApp — or visit the store.',
    heroCta: 'Browse products',
    heroCta2: 'Visit the store',

    marquee: ['Stock clothing', 'Affordable prices', 'Men', 'Women', 'Miami – Alexandria', 'Order on WhatsApp'],

    catKicker: 'Categories',
    catTitle: 'Shop by category',
    catAll: 'All products',
    catNew: 'New arrivals',
    shopNow: 'Shop now',
    itemsCount: (n) => `${n} item${n === 1 ? '' : 's'}`,

    shopKicker: 'Shop',
    shopTitle: 'Shop the collection',
    off: (n) => `-${n}%`,
    filterAll: 'All',
    sortLabel: 'Sort by',
    sortFeatured: 'Featured first',
    sortLow: 'Price: low to high',
    sortHigh: 'Price: high to low',
    noProducts: 'No products in this category right now.',
    loadError: 'Couldn’t load the products. Check your connection and try again.',
    retry: 'Try again',

    newKicker: 'Just in',
    newTitle: 'New arrivals',
    newText: 'The latest pieces in store — ask about your size on WhatsApp.',

    sample: 'Sample',
    newBadge: 'New',
    inStock: 'In stock',
    lowStock: 'Low stock',
    outStock: 'Sold out',
    sizes: 'Sizes',
    chooseSize: 'Choose size',
    pickSizeFirst: 'Pick a size first',
    addToCart: 'Add to cart',
    added: 'Added ✓',
    askWhatsapp: 'Ask about this product on WhatsApp',
    askMsg: (name, size) => `Hello Yahya Stock, I’d like to ask about: ${name}${size ? ` — size ${size}` : ''}`,
    illustration: 'Illustration',

    whyKicker: 'Why Yahya Stock?',
    whyTitle: 'Fashion at a price that fits',
    why: [
      { t: 'Stock prices', d: 'Stock and outlet pieces at affordable prices.' },
      { t: 'Wide variety', d: 'Men’s and women’s pieces in different sizes and colours.' },
      { t: 'Easy ordering', d: 'Pick on the site and send your order on WhatsApp in seconds.' },
      { t: 'Visit us in Miami', d: 'See and try the clothes yourself in store.' },
    ],

    visitKicker: 'Visit',
    visitTitle: 'Find us in Miami',
    address: 'Address',
    hours: 'Opening hours',
    hoursPending: 'Hours coming soon — please call to confirm.',
    phones: 'Phone numbers',
    landline: 'Landline',
    directions: 'Directions on Google Maps',
    callNow: 'Call now',
    mapTitle: 'Map showing the Yahya Stock store location',

    contactKicker: 'Contact',
    contactTitle: 'Got a question? Talk to us',
    contactText: 'Message us on WhatsApp or give us a call.',
    callMobile: 'Mobile',
    msgFormTitle: 'Send a quick message',
    formName: 'Name',
    formNamePh: 'Your name',
    formMsg: 'Message',
    formMsgPh: 'e.g. Do you have the classic shirt in XL?',
    formSend: 'Send on WhatsApp',
    formNote: 'Opens WhatsApp with your message ready — nothing is sent until you press send.',
    followUs: 'Follow us',
    telegram: 'Telegram',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',

    footerText: 'Men’s and women’s stock clothing at affordable prices in Miami, Alexandria.',
    footerLinks: 'Links',
    footerVisit: 'Address',
    footerContact: 'Contact',
    rights: 'All rights reserved',
    demoNote: 'Demo website — details pending owner confirmation.',

    cartTitle: 'Your order',
    cartEmpty: 'Your cart is empty. Pick a size and add products from the shop.',
    size: 'Size',
    qty: 'Qty',
    increase: 'Increase quantity',
    decrease: 'Decrease quantity',
    remove: 'Remove',
    subtotal: 'Estimated total',
    cartNote: 'Final prices and availability are confirmed by the store on WhatsApp. No online payment.',
    yourName: 'Name (optional)',
    yourArea: 'Area / address (optional)',
    sendOrder: 'Send order on WhatsApp',
    clearCart: 'Clear cart',
    closeCart: 'Close cart',
    orderIntro: 'Hello Yahya Stock, I’d like to order:',
    orderTotal: 'Estimated total',
    orderName: 'Name',
    orderArea: 'Area',
    orderFooter: '(Order from the website)',
    contactMsg: (name, msg) => `Hello Yahya Stock${name ? `, this is ${name}` : ''}.\n${msg}`,
  },
}


function initialLang() {
  try {
    const saved = localStorage.getItem('ys-lang')
    if (saved === 'ar' || saved === 'en') return saved
  } catch {}
  return 'ar'
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang)

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title =
      lang === 'ar'
        ? 'يحيى استوك | ملابس استوك بأسعار مناسبة – ميامي، الإسكندرية'
        : 'Yahya Stock | Affordable Stock Clothing – Miami, Alexandria'
    try { localStorage.setItem('ys-lang', lang) } catch {}
  }, [lang])

  const value = useMemo(() => {
    const dict = strings[lang]
    const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG')
    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t: (key) => dict[key],
      pick: (obj) => (obj && typeof obj === 'object' ? obj[lang] ?? obj.ar : obj),
      price: (n) => (lang === 'ar' ? `${nf.format(n)} ج.م` : `EGP ${nf.format(n)}`),
      num: (n) => nf.format(n),
      toggle: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')),
    }
  }, [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
