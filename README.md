# RedFlag Atlas

Netlify-এ প্রকাশের জন্য তিনটি পেজের HTML, CSS ও JavaScript সোর্স। কোনো ফ্রেমওয়ার্ক, npm ইনস্টল বা বিল্ড কমান্ড লাগবে না।

| ফাইল | কাজ |
| --- | --- |
| `public/index.html` | হোমপেজ, সর্বশেষ রিপোর্ট, প্রকাশিত রিপোর্টের হিসাব ও রিপোর্টিং নির্দেশিকা |
| `public/report.html` | গেস্ট রিপোর্ট ফর্ম ও রেফারেন্স নম্বরসহ সাবমিশন নিশ্চিতকরণ |
| `public/explore.html` | প্রকাশিত রিপোর্টের সার্চ, দেশ, ক্যাটাগরি ও প্ল্যাটফর্ম ফিল্টার |
| `public/styles.css` | তিনটি পেজের ডিজাইন ও মোবাইল লেআউট |
| `public/app.js` | ফর্ম যাচাই, Netlify Forms-এ সাবমিশন ও পাবলিক ফিড |
| `public/assets/reports.json` | কেবল প্রকাশের জন্য অনুমোদিত রিপোর্ট |
| `public/assets/countries.json` | দেশের কোড ও নাম |
| `public/_headers` | Netlify-এ ব্রাউজারের সুরক্ষা-সংক্রান্ত HTTP হেডার |
| `netlify.toml` | Netlify-এর publish directory |

## GitHub থেকে Netlify-এ প্রকাশ

1. ZIP খুলে `public/`, `netlify.toml` ও `README.md` একই স্তরে রেখে GitHub repository-তে আপলোড করুন। পুরো `public/assets/` ফোল্ডারটিও রাখুন।
2. Netlify-এ **Add new project → Import an existing project → GitHub** থেকে repository এবং production branch নির্বাচন করুন।
3. **Base directory** ও **Build command** খালি রাখুন। **Publish directory** হবে `public`। `netlify.toml`-এ এটি আগে থেকেই লেখা আছে। **Deploy** করুন।
4. Netlify প্রজেক্টের **Forms** থেকে **Enable form detection** চালু করুন। এরপর **Deploys → Trigger deploy → Deploy site** দিয়ে আবার deploy করুন।
5. Netlify-এর দেওয়া `.netlify.app` ঠিকানায় সাইট খুলুন। `report.html`-এ কাল্পনিক টেস্ট তথ্য দিয়ে একটি রিপোর্ট পাঠান। সাইটে দেখানো রেফারেন্স নম্বরটি **Forms → redflag-incident**-এ জমা পড়া রেকর্ডের সঙ্গে মিলিয়ে নিন। ফর্ম না এলে সঠিক production deploy এবং form detection দেখুন। টেস্টটি spam তালিকায়ও থাকতে পারে।
6. নিশ্চিত করুন যে Explore ফিডে ওই সাবমিশন নিজে থেকে আসেনি। টেস্ট শেষ হলে ড্যাশবোর্ড থেকে টেস্ট রেকর্ড সরাতে পারেন।

[GitHub থেকে deploy করার নির্দেশিকা](https://docs.netlify.com/manage/projects/add-new-project/) · [Netlify Forms সেটআপ](https://docs.netlify.com/manage/forms/setup/) · [Free প্ল্যান ও ক্রেডিট](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)

## লোকাল প্রিভিউ

repository-র root থেকে চালান:

```bash
python3 -m http.server 8000 --directory public
```

ব্রাউজারে `http://localhost:8000/` খুলুন। লোকাল প্রিভিউতে ফর্ম যাচাই করা যায়। প্রকৃত সাবমিশনের জন্য Netlify-এ ফর্ম শনাক্ত হওয়ার পরের deploy ব্যবহার করুন।

## রিপোর্ট রিভিউ ও প্রকাশ

Netlify Forms-এ রিপোর্ট পর্যালোচনা করুন। প্রকাশযোগ্য ভাষায় নতুন সারাংশ লিখুন এবং ব্যক্তিগত তথ্য বাদ দিন। তারপর `public/assets/reports.json`-এর array-তে নিচের কাঠামো অনুযায়ী একটি object যোগ করে GitHub-এ commit করুন। Netlify নতুন deploy করলে রিপোর্টটি Explore ফিডে দেখা যাবে। রিপোর্ট সরাতে সংশ্লিষ্ট object সরিয়ে আবার deploy করুন।

```json
[
  {
    "title": "Unexpected request to send money",
    "summary": "A community member described an unexpected transfer request.",
    "country": "BD",
    "category": "Financial fraud",
    "platform": "Instagram",
    "publishedOn": "2026-11-14",
    "description": "Optional reviewed account for the expanded report card."
  }
]
```

উপরেরটি কাঠামো বোঝানোর কাল্পনিক উদাহরণ। দেওয়া JSON ফিড খালি। `country`-এর কোড `countries.json` থেকে নিন। ফর্মের ক্যাটাগরি ও প্ল্যাটফর্মের মান হুবহু ব্যবহার করুন। চাইলে প্রকাশের জন্য যাচাই করা alias বা handle সার্চযোগ্য করতে `publicAlias` বা `publicHandle` যোগ করুন। JSON-এর সব ফিল্ডই পাবলিক।

রিপোর্টারের ইমেইল, WhatsApp নম্বর, সাবমিশন রেফারেন্স, মূল রিপোর্ট, CSV export বা স্ক্রিনশট GitHub-এ রাখবেন না। প্রকাশের আগে শিরোনাম, সারাংশ ও বর্ণনা থেকেও ব্যক্তিগত তথ্য বাদ দিন। Netlify-এ যাঁদের রিপোর্ট দেখা প্রয়োজন, শুধু তাঁদেরই অ্যাক্সেস দিন। প্রকাশের আগে হোমপেজের Reporting Privacy অংশে আপনার যোগাযোগের ঠিকানা ও ডেটা কত দিন রাখবেন তা লিখুন।

এই সংস্করণে টেক্সট রিপোর্ট গ্রহণ করা হয়। প্রাইভেট স্ক্রিনশট স্টোরেজ, আলাদা অ্যাডমিন প্যানেল ও স্বয়ংক্রিয় প্রকাশের ব্যবস্থা এই তিন পেজের প্যাকেজের বাইরে। ফর্মে honeypot এবং ব্রাউজারে ইনপুট যাচাই আছে। Netlify Forms ড্যাশবোর্ড থেকেই জমা হওয়া রিপোর্ট রিভিউ করতে হবে।
