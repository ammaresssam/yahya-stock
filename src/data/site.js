// ============================================================
//  بيانات المحل — Store information
//  عدّل القيم هنا فقط، وسيتحدث الموقع كله تلقائياً.
//  All of this is UNVERIFIED until the owner confirms it.
// ============================================================

export const site = {
  name: { ar: 'يحيى استوك', en: 'Yahya Stock' },

  // اجعلها true بعد أن يؤكد صاحب المحل البيانات والمنتجات الحقيقية
  // Set to true once the owner has confirmed real data — hides the demo banners.
  isLive: false,

  address: {
    ar: '٩٤ شارع فاروق عبد الوهاب، ميامي، الإسكندرية',
    en: '94 Farouk Abd El Wahab St., Miami, Alexandria',
  },
  area: { ar: 'ميامي – سيدي بشر، الإسكندرية', en: 'Miami – Sidi Bishr, Alexandria' },

  // Text used for the Google Maps search / directions link
  mapsQuery: '94 Farouk Abd El Wahab Street, Miami, Alexandria, Egypt',

  // أرقام الموبايل — Mobile numbers (tel = international format)
  phones: [
    { display: '0111 120 2723', tel: '+201111202723' },
    { display: '0106 761 7502', tel: '+201067617502' },
  ],
  landline: { display: '03 557 2378', tel: '+2035572378' },

  // رقم الواتساب بدون + أو أصفار في البداية — WhatsApp number, digits only
  whatsapp: '201111202723',

  // مواعيد العمل — اتركها null حتى يتم تأكيدها
  // Opening hours — leave null until confirmed. Example:
  // hours: [{ days: { ar: 'يومياً', en: 'Daily' }, time: { ar: '١١ ص – ١١ م', en: '11 AM – 11 PM' } }]
  hours: null,

  // روابط التواصل — اترك الرابط فارغاً '' لإخفائه
  // Social links — leave '' to hide
  social: {
    telegram: 'https://t.me/+xL07kf9zlr05ZDA0',
    facebook: '',
    instagram: '',
    tiktok: '',
  },
}
