// ============================================================
//  سياسات المحل — Store policies (TEMPLATES)
//
//  ⚠️ دي نماذج. كل حاجة بين [ ] لازم صاحب المحل يكتبها بنفسه.
//     بعد المراجعة غيّر approved لـ true عشان تختفي علامة "نموذج".
//  ⚠️ Templates. Everything in [brackets] must be decided and written by the owner.
//     After review, set approved: true to remove the "template" banner.
//
//  The privacy policy describes what this website's code really collects.
//  Update it if the site changes (e.g. analytics are added).
// ============================================================

export const policiesApproved = false

export const policies = {
  returns: {
    title: { ar: 'سياسة الاستبدال والاسترجاع', en: 'Returns and exchanges' },
    body: {
      ar: [
        ['الاستبدال', 'يمكن استبدال المنتج خلال [عدد الأيام] يوم من استلامه، بشرط أن يكون بحالته الأصلية وغير مستخدم وبالتيكت.'],
        ['الاسترجاع', '[هل يتم استرجاع المبلغ؟ في أي حالات؟ خلال كم يوم؟]'],
        ['منتجات لا تُستبدل', '[مثلاً: الملابس الداخلية، المنتجات المخفضة — يحددها صاحب المحل]'],
        ['تكلفة الشحن عند الاستبدال', '[من يتحمل تكلفة التوصيل في حالة الاستبدال أو الاسترجاع؟]'],
        ['المدفوعات بالبطاقة', 'في حالة الموافقة على استرجاع مبلغ مدفوع بالبطاقة، يتم رده على نفس البطاقة عن طريق شركة الدفع خلال [المدة] حسب البنك.'],
        ['كيف تطلب', 'تواصل معنا على واتساب أو تليفون المحل مع رقم الطلب (مثل YS-10001).'],
      ],
      en: [
        ['Exchanges', 'Items can be exchanged within [number of days] days of delivery, unused, in original condition and with tags.'],
        ['Refunds', '[Are refunds offered? In which cases? Within how many days?]'],
        ['Non-exchangeable items', '[e.g. underwear, final-sale items — decided by the owner]'],
        ['Shipping for exchanges', '[Who pays delivery for an exchange or return?]'],
        ['Card payments', 'If a refund of a card payment is approved, it goes back to the same card through the payment provider within [period], depending on the bank.'],
        ['How to request', 'Contact us on WhatsApp or by phone with your order number (e.g. YS-10001).'],
      ],
    },
  },
  delivery: {
    title: { ar: 'سياسة التوصيل', en: 'Delivery' },
    showZones: true,
    body: {
      ar: [
        ['مناطق وأسعار التوصيل', 'سعر التوصيل حسب المحافظة (الجدول تحت) ويظهر قبل تأكيد الطلب.'],
        ['مدة التوصيل', '[مثلاً: الإسكندرية خلال … أيام عمل، باقي المحافظات خلال … أيام عمل]'],
        ['تأكيد الطلب', 'في حالة الدفع عند الاستلام، ممكن نتصل بيك لتأكيد العنوان قبل الشحن.'],
        ['الدفع عند الاستلام', 'بتدفع المبلغ كاش للمندوب عند الاستلام. [هل يمكن معاينة المنتج قبل الدفع؟]'],
        ['متابعة الطلب', 'بعد الطلب بيظهرلك لينك متابعة خاص بيك تعرف منه حالة طلبك.'],
      ],
      en: [
        ['Areas and fees', 'Delivery is priced by governorate (table below) and shown before you confirm.'],
        ['Delivery time', '[e.g. Alexandria within … working days, other governorates within … working days]'],
        ['Confirmation', 'For cash on delivery we may call you to confirm the address before shipping.'],
        ['Cash on delivery', 'You pay the courier in cash on delivery. [Can customers inspect items before paying?]'],
        ['Tracking', 'After ordering you get a private tracking link showing your order’s status.'],
      ],
    },
  },
  privacy: {
    title: { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
    body: {
      ar: [
        ['البيانات اللي بنجمعها', 'عند الطلب: الاسم، رقم الموبايل، الإيميل (اختياري)، المحافظة والمنطقة والعنوان، والملاحظات. بنحفظ كمان المنتجات والمقاسات والأسعار ووقت الطلب.'],
        ['ليه بنستخدمها', 'لتجهيز وتوصيل طلبك، والتواصل معاك بخصوصه فقط.'],
        ['الحماية من الإساءة', 'بنحفظ بصمة مشفّرة (hash) من عنوان الإنترنت بتاعك — مش العنوان نفسه — عشان نمنع الطلبات الوهمية الكتير.'],
        ['الدفع بالبطاقة', 'الدفع بيتم على صفحة شركة الدفع Paymob. إحنا مش بنشوف ولا بنحفظ بيانات بطاقتك؛ بيوصلنا بس تأكيد الدفع وآخر ٤ أرقام ونوع البطاقة.'],
        ['على جهازك', 'الموقع بيحفظ على جهازك السلة واللغة ولينكات متابعة طلباتك (عشان صفحة «طلباتي»). تقدر تمسحها بمسح بيانات الموقع من المتصفح.'],
        ['خدمات خارجية', 'الخطوط من Google Fonts، والخريطة من Google Maps (لما تظهر)، وروابط واتساب بتفتح تطبيق واتساب. البيانات محفوظة على Supabase.'],
        ['مين يقدر يشوف بياناتك', 'صاحب المحل بس من لوحة التحكم. مش بنبيع أو نشارك بياناتك.'],
        ['مدة الحفظ', '[كم مدة الاحتفاظ ببيانات الطلبات؟]'],
        ['حقوقك', 'تقدر تطلب نسخة من بياناتك أو مسحها بالتواصل معنا على [الإيميل أو الرقم].'],
      ],
      en: [
        ['What we collect', 'When you order: name, mobile number, email (optional), governorate, area and address, and notes. We also store the items, sizes, prices and order time.'],
        ['Why', 'Only to prepare and deliver your order and to contact you about it.'],
        ['Abuse prevention', 'We store an encrypted fingerprint (hash) of your internet address — not the address itself — to stop floods of fake orders.'],
        ['Card payments', 'Card payments happen on Paymob’s payment page. We never see or store your card details; we only receive the payment confirmation, the last 4 digits and the card type.'],
        ['On your device', 'The site stores your cart, language and your order tracking links (for “My orders”) on your device. Clear the site’s data in your browser to remove them.'],
        ['Third parties', 'Fonts from Google Fonts, the map from Google Maps (when shown), and WhatsApp links open WhatsApp. Data is stored with Supabase.'],
        ['Who can see your data', 'Only the store owner, from the admin panel. We don’t sell or share your data.'],
        ['Retention', '[How long are order records kept?]'],
        ['Your rights', 'Ask for a copy of your data or its deletion by contacting [email or number].'],
      ],
    },
  },
  terms: {
    title: { ar: 'الشروط والأحكام', en: 'Terms and conditions' },
    body: {
      ar: [
        ['البائع', 'يحيى استوك — [الاسم القانوني ورقم السجل التجاري]، [العنوان المؤكد].'],
        ['الأسعار', 'كل الأسعار بالجنيه المصري. السعر النهائي هو اللي بيظهر في صفحة تأكيد الطلب ومحسوب من المحل.'],
        ['التوفر', 'المنتجات استوك وكمياتها محدودة؛ بيتحجز المنتج لما الطلب يتأكد على الموقع.'],
        ['الدفع', 'الدفع عند الاستلام، أو بالبطاقة عن طريق Paymob (لما يكون متاح). الطلب المدفوع بالبطاقة بيتأكد بعد تأكيد شركة الدفع فقط، والمنتجات بتتحجز لمدة ٣٠ دقيقة لحد ما الدفع يكمل.'],
        ['إلغاء الطلب', '[حتى إمتى يقدر العميل يلغي الطلب؟]'],
        ['التواصل', 'لأي استفسار: واتساب أو تليفونات المحل الموجودة في الموقع.'],
      ],
      en: [
        ['Seller', 'Yahya Stock — [legal name and commercial registry number], [confirmed address].'],
        ['Prices', 'All prices are in Egyptian pounds. The final price is the one shown on the order confirmation, calculated by the store.'],
        ['Availability', 'Stock items are limited; an item is reserved once the order is confirmed on the site.'],
        ['Payment', 'Cash on delivery, or card through Paymob (when available). A card order is confirmed only after the payment provider confirms payment; items are reserved for 30 minutes meanwhile.'],
        ['Cancellation', '[Until when can a customer cancel?]'],
        ['Contact', 'For any question: WhatsApp or the store phone numbers on this site.'],
      ],
    },
  },
}

export const POLICY_KEYS = ['returns', 'delivery', 'privacy', 'terms']
