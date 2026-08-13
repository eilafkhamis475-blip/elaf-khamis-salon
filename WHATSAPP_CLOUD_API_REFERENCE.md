# مرجع تشغيل إشعارات WhatsApp Business

يستدعي Google Apps Script واجهة **WhatsApp Business Cloud API** مباشرة عبر مسار `/{PHONE_NUMBER_ID}/messages`. ولأن الإشعار يُرسل تلقائياً عند إنشاء حجز وقد يكون خارج نافذة خدمة العملاء لمدة 24 ساعة، يعتمد التنفيذ على **قالب Utility معتمد مسبقاً** بدلاً من رسالة حرة.[1] [2]

يجب أن يكون المستلم قد وافق على تلقي رسائل واتساب من رقم الإرسال. كما يجب أن يكون رقم المستلم مختلفاً عن رقم الأعمال المعيّن للإرسال في Cloud API؛ لا يوفّر واتساب مساراً موثوقاً لإرسال رسالة من الحساب إلى الرقم نفسه.

| عنصر الإعداد | الغرض |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | رمز وصول ميتا الذي يصرّح باستدعاء Messages API. |
| `WHATSAPP_PHONE_NUMBER_ID` | معرّف رقم الأعمال المُرسِل داخل إعدادات تطبيق ميتا. |
| `WHATSAPP_OWNER_PHONE` | رقم زوجة مالكة الصالون، من دون `+` أو `00`: `218922119292`. |
| `WHATSAPP_TEMPLATE_NAME` | اسم قالب Utility المُعتمد في WhatsApp Manager. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | لغة القالب كما تُعرّفها ميتا، مثل `ar`. |

## المراجع

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Meta for Developers — Template fundamentals"
[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta for Developers — Service messages"
