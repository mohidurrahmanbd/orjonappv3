import { Question, LiveExam, Notice, Routine, User, Course, Coupon } from './types';

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q_bcs52_1',
    text: '৫২তম বিসিএস প্রিলিমিনারি: "ইউনেস্কো" কর্তৃক ঘোষিত বাংলাদেশের সর্বশেষ বিশ্ব ঐতিহ্য বা ইনট্যাঞ্জিবল কালচারাল হেরিটেজ কোনটি?',
    optionA: 'সুন্দরবন',
    optionB: 'শীতলপাটি বুনন',
    optionC: 'ঢাকার রিকশা ও রিকশাচিত্র',
    optionD: 'বাউল গান',
    correct: 'Option C',
    explanation: '২০২৩ সালের ডিসেম্বরে ইউনেস্কোর ইনট্যাঞ্জিবল কালচারাল হেরিটেজ হিসেবে "ঢাকার রিকশা ও রিকশাচিত্র" তালিকাভুক্ত হয়।',
    category: 'সাধারণ জ্ঞান',
    subcategory: '৫২তম বিসিএস',
    date: '2026-08-10'
  },
  {
    id: 'q_bcs52_2',
    text: '৫২তম বিসিএস: Choose the correct preposition: "He has a great passion ___ classical literature."',
    optionA: 'for',
    optionB: 'in',
    optionC: 'with',
    optionD: 'to',
    correct: 'Option A',
    explanation: '"Passion for" একটি উপযুক্ত prepositional phrase যার অর্থ কোনো কিছুর প্রতি প্রবল অনুরাগ বা আকর্ষণ।',
    category: 'ইংরেজি',
    subcategory: '৫২তম বিসিএস',
    date: '2026-08-10'
  },
  {
    id: 'q_bb2026_1',
    text: 'বাংলাদেশ ব্যাংক এডি ২০২৬: বাংলাদেশের কেন্দ্রীয় ব্যাংকের বৈদেশিক মুদ্রার রিজার্ভ সুরক্ষায় ব্যবহৃত বর্তমান হিসাব পদ্ধতির নাম কী?',
    optionA: 'Gross Reserves',
    optionB: 'BPM6 (Balance of Payments and International Investment Position Manual 6th edition)',
    optionC: 'IMF SDR Method',
    optionD: 'Forex Net Assets',
    correct: 'Option B',
    explanation: 'আইএমএফ (IMF)-এর নীতিমালা অনুযায়ী বাংলাদেশ ব্যাংক BPM6 হিসাব পদ্ধতি অনুসরণ করে প্রকৃত বা নিট বৈদেশিক মুদ্রার রিজার্ভ প্রকাশ করে।',
    category: 'সাধারণ জ্ঞান',
    subcategory: 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ২০২৬',
    date: '2026-07-20'
  },
  {
    id: 'q_bcs46_1',
    text: '৪৬তম বিসিএস: চর্যাপদের কোন কবি সর্বাধিক পদ রচনা করেছেন?',
    optionA: 'লুইপা',
    optionB: 'ভুসুকুপা',
    optionC: 'কাহ্নপা',
    optionD: 'শবরপা',
    correct: 'Option C',
    explanation: 'চর্যাপদের পদকর্তাদের মধ্যে কাহ্নপা সর্বাধিক ১৩টি পদ (মতান্তরে ১২টি) রচনা করেছেন। ভুসুকুপা রচনা করেন ৮টি পদ।',
    category: 'বাংলা',
    subcategory: '৪৬তম বিসিএস',
    date: '2026-06-15'
  },
  {
    id: 'q1',
    text: 'বাংলাদেশের স্বাধীনতা সুবর্ণজয়ন্তী বা ৫০ বছর পূর্তি কোন বছর পালিত হয়?',
    optionA: '২০২০',
    optionB: '২০২১',
    optionC: '২০২২',
    optionD: '২০২৩',
    correct: 'Option B',
    explanation: 'বাংলাদেশ ১৯৭১ সালের ২৬শে মার্চ স্বাধীনতা ঘোষণা করে। এর সুবর্ণজয়ন্তী ৫০ বছর পূর্তি ২০২১ সালে উদযাপন করা হয়।',
    category: 'সাধারণ জ্ঞান',
    subcategory: '৪৫তম বিসিএস'
  },
  {
    id: 'q2',
    text: 'Which is the correct spelling?',
    optionA: 'Lieutenant',
    optionB: 'Lieutanent',
    optionC: 'Leiutenant',
    optionD: 'Lieutennant',
    correct: 'Option A',
    explanation: 'সঠিক বানান হল Lieutenant (লেফটেন্যান্ট)। এটি ফরাসি ভাষা থেকে আগত একটি শব্দ যার অর্থ প্রতিনিধি বা সহকারী।',
    category: 'ইংরেজি',
    subcategory: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩'
  },
  {
    id: 'q3',
    text: 'বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস কোনটি?',
    optionA: 'পদ্মরাগ',
    optionB: 'কপালকুণ্ডলা',
    optionC: 'দুর্গেশনন্দিনী',
    optionD: 'বিষবৃক্ষ',
    correct: 'Option C',
    explanation: 'বঙ্কিমচন্দ্র চট্টোপাধ্যায় রচিত "দুর্গেশনন্দিনী" (১৮৬৫) বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস হিসেবে স্বীকৃত।',
    category: 'বাংলা',
    subcategory: '৪৪তম বিসিএস'
  },
  {
    id: 'q4',
    text: 'পদ্মা সেতুর দৈর্ঘ্য কত কিলোমিটার?',
    optionA: '৬.১৫ কিলোমিটার',
    optionB: '৫.১৫ কিলোমিটার',
    optionC: '৭.১৫ কিলোমিটার',
    optionD: '৬.৫০ কিলোমিটার',
    correct: 'Option A',
    explanation: 'পদ্মা বহুমুখী সেতুর মোট দৈর্ঘ্য ৬.১৫ কিলোমিটার (৬,১৫০ মিটার)। এটি মুন্সীগঞ্জের লৌহজংয়ের সাথে শরীয়তপুর ও মাদারীপুরকে সংযুক্ত করেছে।',
    category: 'সাধারণ জ্ঞান',
    subcategory: 'ব্যাংক রিক্রুটমেন্ট ২০২৪'
  },
  {
    id: 'q5',
    text: 'Change the voice: "Who is calling me?"',
    optionA: 'By whom am I called?',
    optionB: 'By whom was I called?',
    optionC: 'By whom am I being called?',
    optionD: 'By whom are you called?',
    correct: 'Option C',
    explanation: 'Present continuous tense-এর "Who" যুক্ত Active voice-কে Passive করতে হলে: By whom + auxiliary verb (am) + object-এর subject (I) + being + verb-এর past participle (called) + ?',
    category: 'ইংরেজি',
    subcategory: '৪৫তম বিসিএস'
  },
  {
    id: 'q6',
    text: 'বাংলা বর্ণমালায় অর্ধমাত্রার বর্ণ কয়টি?',
    optionA: '৩২টি',
    optionB: '৮টি',
    optionC: '১০টি',
    optionD: '৬টি',
    correct: 'Option B',
    explanation: 'বাংলা বর্ণমালায় মোট অর্ধমাত্রার বর্ণ ৮টি (ঋ, খ, গ, ণ, থ, ধ, প, শ)। পূর্ণমাত্রার বর্ণ ৩২টি এবং মাত্রাহীন বর্ণ ১০টি।',
    category: 'বাংলা',
    subcategory: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩'
  },
  {
    id: 'q7',
    text: 'একনেক (ECNEC) এর সভাপতি কে?',
    optionA: 'অর্থন্ত্রী',
    optionB: 'পরিকল্পনামন্ত্রী',
    optionC: 'প্রধানমন্ত্রী',
    optionD: 'রাষ্ট্রপতি',
    correct: 'Option C',
    explanation: 'জাতীয় অর্থনৈতিক পরিষদের নির্বাহী কমিটি (ECNEC)-এর সভাপতি হলেন গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের মাননীয় প্রধানমন্ত্রী।',
    category: 'সাধারণ জ্ঞান',
    subcategory: '৪৪তম বিসিএস'
  },
  {
    id: 'q8',
    text: 'What is the synonym of "Adjourn"?',
    optionA: 'Postpone',
    optionB: 'Continue',
    optionC: 'Begin',
    optionD: 'Accelerate',
    correct: 'Option A',
    explanation: 'Adjourn অর্থ মূলত স্থগিত রাখা বা মুলতুবি করা। এর সঠিক সমার্থক শব্দ হলো Postpone (স্থগিত করা)।',
    category: 'ইংরেজি',
    subcategory: 'ব্যাংক রিক্রুটমেন্ট ২০২৪'
  },
  {
    id: 'q9',
    text: '"গীতাঞ্জলি" কাব্যের জন্য রবীন্দ্রনাথ ঠাকুর কত সালে নোবেল পুরস্কার লাভ করেন?',
    optionA: '১৯১১',
    optionB: '১৯১২',
    optionC: '১৯১৩',
    optionD: '১৯১৪',
    correct: 'Option C',
    explanation: 'রবীন্দ্রনাথ ঠাকুর ১৯১৩ সালে সাহিত্য নোবেল পুরস্কার লাভ করেন। তিনি এশীয়দের মধ্যে প্রথম এই গৌরব অর্জন করেন।',
    category: 'বাংলা',
    subcategory: '৩৮তম বিসিএস'
  },
  {
    id: 'q10',
    text: 'বাংলাদেশের একমাত্র প্রবাল দ্বীপ কোনটি?',
    optionA: 'সন্দ্বীপ',
    optionB: 'হাতিয়া',
    optionC: 'সেন্টমার্টিন',
    optionD: 'কুতুবদিয়া',
    correct: 'Option C',
    explanation: 'সেন্টমার্টিন দ্বীপ বাংলাদেশের একমাত্র সামুদ্রিক প্রবাল দ্বীপ (Coral Island)। এটি টেকনাফ উপজেলার অন্তর্গত বঙ্গোপসাগরের বুকে অবস্থিত।',
    category: 'সাধারণ জ্ঞান',
    subcategory: '৩৮তম বিসিএস',
    date: '2026-07-28'
  },
  {
    id: 'q11',
    text: 'Identify the noun of the word "Beautiful":',
    optionA: 'Beautify',
    optionB: 'Beauty',
    optionC: 'Beautifully',
    optionD: 'Beauties',
    correct: 'Option B',
    explanation: 'Beautiful হল Adjective, এর Noun ফর্ম হল Beauty। Beautify হল Verb এবং Beautifully হল Adverb।',
    category: 'ইংরেজি',
    subcategory: '৪৪তম বিসিএস'
  },
  {
    id: 'q12',
    text: 'কবর নাটকটি কার রচনা?',
    optionA: 'জসীমউদ্দীন',
    optionB: 'মুনীর চৌধুরী',
    optionC: 'রবীন্দ্রনাথ ঠাকুর',
    optionD: 'নজরুল ইসলাম',
    correct: 'Option B',
    explanation: 'ভাষা আন্দোলনের পটভূমিতে মুনীর চৌধুরী ১৯৫৩ সালে ঢাকা কেন্দ্রীয় কারাগারে বন্দি অবস্থায় "কবর" নাটকটি রচনা করেন। উল্লেখ্য, কবর কবিতাটি রচনা করেন জসীমউদ্দীন।',
    category: 'বাংলা',
    subcategory: '৪৫তম বিসিএস'
  },
  {
    id: 'ca_q1',
    text: 'সাম্প্রতিক সময়ে বাংলাদেশ ব্যাংকের নীতি অনুযায়ী নতুন রেপো রেট কত শতাংশ নির্ধারণ করা হয়েছে?',
    optionA: '৮.৫০%',
    optionB: '৯.০০%',
    optionC: '১০.০০%',
    optionD: '৭.৫০%',
    correct: 'Option C',
    explanation: 'মুদ্রাস্ফীতি নিয়ন্ত্রণ ও ঋণ প্রবাহ স্থিতিশীল করতে বাংলাদেশ ব্যাংক সাম্প্রতিক মুদ্রানীতিতে পলিসি রেট বা রেপো হার ১০ শতাংশে উন্নীত করেছে।',
    category: 'সাম্প্রতিক বিষয়াবলী',
    subcategory: '১৮ আগস্ট ২০২৬',
    date: '2026-08-18'
  },
  {
    id: 'ca_q2',
    text: 'আন্তর্জাতিক সৌর জোট (International Solar Alliance - ISA)-এর সদর দপ্তর কোন দেশে অবস্থিত?',
    optionA: 'ফ্রান্স',
    optionB: 'ভারত (গুরুগ্রাম)',
    optionC: 'সুইজারল্যান্ড',
    optionD: 'যুক্তরাষ্ট্র',
    correct: 'Option B',
    explanation: 'আন্তর্জাতিক সৌর জোট (ISA)-এর সদর দপ্তর ভারতের হরিয়ানা রাজ্যের গুরুগ্রামে (Gurugram) অবস্থিত। এটি বাংলাদেশসহ বিশ্বব্যাপী নবায়নযোগ্য সৌর শক্তি সম্প্রসারণে কাজ করছে।',
    category: 'সাম্প্রতিক বিষয়াবলী',
    subcategory: '১৮ আগস্ট ২০২৬',
    date: '2026-08-18'
  },
  {
    id: 'ca_q3',
    text: 'বঙ্গবন্ধু শেখ মুজিবুর রহমান টানেল কোন নদীর তলদেশে নির্মিত হয়েছে?',
    optionA: 'মেঘনা নদী',
    optionB: 'পদ্মা নদী',
    optionC: 'কর্ণফুলী নদী',
    optionD: 'যমুনা নদী',
    correct: 'Option C',
    explanation: 'বঙ্গবন্ধু টানেল চট্টগ্রামের কর্ণফুলী নদীর তলদেশে নির্মিত দক্ষিণ এশিয়ার প্রথম আন্ডারওয়াটার রোড টানেল।',
    category: 'সাম্প্রতিক বিষয়াবলী',
    subcategory: '১৫ আগস্ট ২০২৬',
    date: '2026-08-15'
  }
];

export const INITIAL_NOTICES: Notice[] = [
  {
    id: 'n1',
    text: '📢 শুভেচ্ছা নিন! অর্জন কুইজ অ্যাপে আপনাদের স্বাগতম। আগামী ২০শে জুলাই রাত ৮:০০ টায় "৪৫তম বিসিএস মডেল টেস্ট-০২" অনুষ্ঠিত হবে। সবাই প্রস্তুতি নিন।',
    createdAt: '2026-07-17T18:00:00Z'
  },
  {
    id: 'n2',
    text: '📅 প্রাথমিক শিক্ষক নিয়োগ পরীক্ষার চূড়ান্ত মডেল টেস্টের নতুন রুটিন প্রকাশিত হয়েছে। রুটিন সেকশন থেকে ডাউনলোড অথবা ভিউ করে নিন।',
    createdAt: '2026-07-18T01:30:00Z'
  }
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course_bcs_46',
    title: '৪৬তম বিসিএস প্রিলিমিনারি স্পেশাল ক্র্যাশ কোর্স',
    description: 'সম্পূর্ণ সিলেবাস ভিত্তিক বিষয়ভিত্তিক লাইভ পরীক্ষা, রিডার মোড অনুশীলন ও এক্সক্লুসিভ স্টাডি প্ল্যান।',
    status: 'active',
    category: 'বিসিএস প্রস্তুতি',
    startDate: '২০২৪-০১-১০',
    endDate: '২০২৪-০৬-৩০',
    price: 500,
    originalPrice: 1000,
    createdAt: '2026-07-17T12:00:00Z',
    updatedAt: '2026-07-17T12:00:00Z'
  },
  {
    id: 'course_primary_2024',
    title: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩ স্পেশাল কোর্স',
    description: 'বিগত বছরের প্রশ্ন সমাধান, বিষয়ভিত্তিক কুইজ ও নিয়মিত মডেল টেস্ট।',
    status: 'active',
    category: 'জব সলিউশন পরীক্ষা',
    startDate: '২০২৪-০২-০১',
    endDate: '২০২৪-০৭-১৫',
    price: 350,
    originalPrice: 700,
    createdAt: '2026-07-17T14:00:00Z',
    updatedAt: '2026-07-17T14:00:00Z'
  }
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'coupon_welcome50',
    code: 'WELCOME50',
    discountPercent: 50,
    description: 'সকল কোর্সে ৫০% স্পেশাল ছাড় কুপন',
    isActive: true,
    createdAt: '2026-07-17T12:00:00Z',
    usageCount: 15
  },
  {
    id: 'coupon_free100',
    code: 'FREE100',
    discountPercent: 100,
    description: '১০০% স্কলারশিপ ফ্রি কুপন (১০০% ছাড়)',
    isActive: true,
    createdAt: '2026-07-17T12:00:00Z',
    usageCount: 7
  },
  {
    id: 'coupon_bcs30',
    code: 'BCS30',
    discountPercent: 30,
    courseId: 'course_bcs_46',
    courseTitle: '৪৬তম বিসিএস প্রিলিমিনারি স্পেশাল ক্র্যাশ কোর্স',
    description: 'বিসিএস কোর্সে ৩০% স্পেশাল ছাড়',
    isActive: true,
    createdAt: '2026-07-17T12:00:00Z',
    usageCount: 10
  }
];

export const INITIAL_ROUTINES: Routine[] = [
  {
    id: 'r1',
    title: 'বিসিএস প্রিলিমিনারি ফাইনাল ক্র্যাশ কোর্স রুটিন',
    details: `৩রা আগস্ট - বাংলা ব্যাকরণ ও সাহিত্য পরীক্ষা
৫ই আগস্ট - ইংরেজি ভাষা ও সাহিত্য পরীক্ষা
৮ই আগস্ট - বাংলাদেশ বিষয়াবলী চূড়ান্ত পরীক্ষা
১০ই আগস্ট - সাধারণ বিজ্ঞান ও আইসিটি মডেল টেস্ট`,
    createdAt: '2026-07-18T02:00:00Z',
    updatedAt: '2026-07-18T02:00:00Z',
    courseId: 'course_bcs_46',
    courseName: '৪৬তম বিসিএস প্রিলিমিনারি স্পেশাল ক্র্যাশ কোর্স'
  },
  {
    id: 'r2',
    title: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩ স্পেশাল রুটিন',
    details: `১৫ই আগস্ট - গাণিতিক যুক্তি ও মানসিক দক্ষতা
১৭ই আগস্ট - বাংলা ও ইংরেজি রিভিশন পরীক্ষা
২০শে আগস্ট - ১০০ মার্কের পূর্ণাঙ্গ লাইভ মডেল টেস্ট`,
    createdAt: '2026-07-18T03:00:00Z',
    updatedAt: '2026-07-18T03:00:00Z',
    courseId: 'course_primary_2024',
    courseName: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩ স্পেশাল কোর্স'
  }
];

export const INITIAL_LIVE_EXAMS: LiveExam[] = [
  {
    id: 'le1',
    title: 'BCS প্রিলিমিনারি মডেল টেস্ট - ০১',
    qLimit: 10,
    timeLimit: 5,
    category: 'ALL',
    startTime: '2026-07-18T00:00:00Z',
    expiryTime: '2026-07-22T23:59:59Z',
    createdAt: '2026-07-18T04:00:00Z',
    updatedAt: '2026-07-18T04:00:00Z'
  },
  {
    id: 'le2',
    title: 'সাধারণ জ্ঞান মেগা লাইভ এক্সাম',
    qLimit: 5,
    timeLimit: 3,
    category: 'সাধারণ জ্ঞান',
    startTime: '2026-07-18T06:00:00Z',
    expiryTime: '2026-07-25T23:59:59Z',
    createdAt: '2026-07-18T04:30:00Z',
    updatedAt: '2026-07-18T04:30:00Z'
  }
];

export const INITIAL_USERS: User[] = [
  {
    userId: 'ORJ-1029A',
    email: 'mumtahina@orjon.edu.bd',
    emailVerified: true,
    phone: '01711223344',
    name: 'মুমতাহিনা রহমান',
    gender: 'নারী',
    education: 'এমএসসি (রসায়ন)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=01711223344',
    lifetimeAnswered: 45,
    lifetimeCorrect: 35,
    lifetimeWrong: 10,
    createdAt: '2026-07-15T10:00:00Z'
  },
  {
    userId: 'ORJ-2038B',
    email: 'tanveer@orjon.edu.bd',
    emailVerified: true,
    phone: '01899887766',
    name: 'মোঃ তানভীর হাসান',
    gender: 'পুরুষ',
    education: 'বিবিএ (ফাইন্যান্স)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=01899887766',
    lifetimeAnswered: 30,
    lifetimeCorrect: 22,
    lifetimeWrong: 8,
    createdAt: '2026-07-16T12:30:00Z'
  }
];
