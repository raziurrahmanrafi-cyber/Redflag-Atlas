# RedFlag Atlas

Netlify-এ প্রকাশের জন্য তিনটি পেজের HTML, CSS ও JavaScript সোর্স। সাইটের জন্য বিল্ড কমান্ড লাগে না। রিপোর্ট গ্রহণের Netlify Function-এর dependencies Netlify স্বয়ংক্রিয়ভাবে ইনস্টল করে।

| ফাইল | কাজ |
| --- | --- |
| `public/index.html` | হোমপেজ, সর্বশেষ রিপোর্ট, প্রকাশিত রিপোর্টের হিসাব ও রিপোর্টিং নির্দেশিকা |
| `public/report.html` | গেস্ট রিপোর্ট ফর্ম ও রেফারেন্স নম্বরসহ সাবমিশন নিশ্চিতকরণ |
| `public/explore.html` | প্রকাশিত রিপোর্টের সার্চ, দেশ, ক্যাটাগরি ও প্ল্যাটফর্ম ফিল্টার |
| `public/styles.css` | তিনটি পেজের ডিজাইন ও মোবাইল লেআউট |
| `public/app.js` | ফর্ম যাচাই, রিপোর্ট সাবমিশন ও পাবলিক ফিড |
| `public/assets/reports.json` | কেবল প্রকাশের জন্য অনুমোদিত রিপোর্ট |
| `public/assets/countries.json` | দেশের কোড ও নাম |
| `public/_headers` | Netlify-এ ব্রাউজারের সুরক্ষা-সংক্রান্ত HTTP হেডার |
| `netlify/functions/submit-report.mjs` | রিপোর্ট ও সংযুক্তি Netlify Blobs-এ ব্যক্তিগতভাবে সংরক্ষণ |
| `netlify.toml` | Netlify-এর publish directory |

## GitHub থেকে Netlify-এ প্রকাশ

1. Netlify-এ GitHub repository ও production branch `main` সংযুক্ত রাখুন। Publish directory `public` এবং Functions directory `netlify/functions`। Build command খালি রাখুন।
2. Production deploy প্রকাশিত হলে `report.html`-এ কাল্পনিক তথ্য এবং একটি নমুনা ফাইল দিয়ে রিপোর্ট পাঠান।
3. Netlify-এ **Data & Storage → Blobs → private-incident-reports** থেকে সাবমিশন রেফারেন্সের নামে ZIP ডাউনলোড করুন। ZIP-এর `report.json`-এ রিপোর্ট ও WhatsApp নম্বর এবং পাশে প্রমাণের ফাইল থাকবে।

[Netlify Blobs নির্দেশিকা](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

## লোকাল প্রিভিউ

repository-র root থেকে চালান:

```bash
python3 -m http.server 8000 --directory public
```

ব্রাউজারে `http://localhost:8000/` খুলুন। লোকাল প্রিভিউতে ফর্ম যাচাই করা যায়। প্রকৃত সাবমিশনের জন্য Netlify production deploy ব্যবহার করুন।

## রিপোর্ট রিভিউ ও প্রকাশ

নতুন রিপোর্ট Netlify Blobs-এ পর্যালোচনা করুন। আগের সাবমিশনগুলো Netlify Forms-এ দেখুন। প্রকাশযোগ্য ভাষায় নতুন সারাংশ লিখুন এবং ব্যক্তিগত তথ্য বাদ দিন। তারপর `public/assets/reports.json`-এর array-তে নিচের কাঠামো অনুযায়ী একটি object যোগ করে GitHub-এ commit করুন। Netlify নতুন deploy করলে রিপোর্টটি Explore ফিডে দেখা যাবে। রিপোর্ট সরাতে সংশ্লিষ্ট object সরিয়ে আবার deploy করুন।

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
