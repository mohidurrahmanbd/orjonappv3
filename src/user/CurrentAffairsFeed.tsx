import React, { useState, useMemo } from 'react';
import { SubcategoryItem, Question } from '../shared/types';
import { isCurrentAffairVariation } from '../shared/lib/routineUtils';
import CurrentAffairsMCQModal from '../shared/components/CurrentAffairsMCQModal';
import { 
  Globe, Calendar, ChevronRight, ChevronDown, ChevronUp, 
  Search, Folder, FolderOpen 
} from 'lucide-react';

interface CurrentAffairsFeedProps {
  subcategories: SubcategoryItem[];
  questions: Question[];
  bookmarkedIds?: string[];
  onToggleBookmark?: (questionId: string) => void;
  onStartExamWithQuestions?: (questions: Question[], title: string) => void;
  compact?: boolean;
}

const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const BENGALI_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];

const toBnDigits = (num: number | string): string => {
  return num.toString().replace(/\d/g, d => BENGALI_DIGITS[parseInt(d, 10)] || d);
};

const bnToEnDigits = (str: string): string => {
  return str.replace(/[০-৯]/g, d => {
    const idx = BENGALI_DIGITS.indexOf(d);
    return idx !== -1 ? idx.toString() : d;
  });
};

const parseItemDateInfo = (item: SubcategoryItem) => {
  // 1. Try item.date first (e.g. "2026-08-18" or ISO string)
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      return {
        year,
        month,
        day,
        monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
        monthLabelBn: `${BENGALI_MONTHS[month]} ${toBnDigits(year)}`,
        sortTimestamp: d.getTime()
      };
    }
  }

  // 2. Try parsing from item.name (e.g. "২৩ জুলাই ২০২৬" or "23 July 2026")
  const nameEn = bnToEnDigits(item.name || '');
  const monthMap: Record<string, number> = {
    'জানুয়ারি': 0, 'জানুয়ারি': 0, 'january': 0, 'jan': 0,
    'ফেব্রুয়ারি': 1, 'ফেব্রুয়ারি': 1, 'february': 1, 'feb': 1,
    'মার্চ': 2, 'march': 2, 'mar': 2,
    'এপ্রিল': 3, 'april': 3, 'apr': 3,
    'মে': 4, 'may': 4,
    'জুন': 5, 'june': 5, 'jun': 5,
    'জুলাই': 6, 'july': 6, 'jul': 6,
    'আগস্ট': 7, 'august': 7, 'aug': 7,
    'সেপ্টেম্বর': 8, 'september': 8, 'sep': 8, 'sept': 8,
    'অক্টোবর': 9, 'october': 9, 'oct': 9,
    'নভেম্বর': 10, 'november': 10, 'nov': 10,
    'ডিসেম্বর': 11, 'december': 11, 'dec': 11
  };

  let foundMonth = -1;
  for (const [mName, mIdx] of Object.entries(monthMap)) {
    if (item.name?.toLowerCase().includes(mName)) {
      foundMonth = mIdx;
      break;
    }
  }

  const yearMatch = nameEn.match(/\b(20\d\d)\b/);
  const dayMatch = nameEn.match(/\b([1-3]?[0-9])\b/);

  if (foundMonth !== -1) {
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
    const d = new Date(year, foundMonth, day);
    return {
      year,
      month: foundMonth,
      day,
      monthKey: `${year}-${String(foundMonth + 1).padStart(2, '0')}`,
      monthLabelBn: `${BENGALI_MONTHS[foundMonth]} ${toBnDigits(year)}`,
      sortTimestamp: d.getTime()
    };
  }

  // 3. Try item.createdAt
  if (item.createdAt) {
    const d = new Date(item.createdAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      return {
        year,
        month,
        day,
        monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
        monthLabelBn: `${BENGALI_MONTHS[month]} ${toBnDigits(year)}`,
        sortTimestamp: d.getTime()
      };
    }
  }

  // Fallback to current date
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    year,
    month,
    day: now.getDate(),
    monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    monthLabelBn: `${BENGALI_MONTHS[month]} ${toBnDigits(year)}`,
    sortTimestamp: 0
  };
};

export default function CurrentAffairsFeed({
  subcategories,
  questions,
  bookmarkedIds = [],
  onToggleBookmark,
  onStartExamWithQuestions,
  compact = false
}: CurrentAffairsFeedProps) {
  const [selectedSubcatForMCQ, setSelectedSubcatForMCQ] = useState<SubcategoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [openMonthFolders, setOpenMonthFolders] = useState<Record<string, boolean>>({});

  // Filter and sort latest date on top
  const sortedCurrentAffairs = useMemo(() => {
    const list = (subcategories || []).filter(s => 
      s.parentCategory === 'সাম্প্রতিক বিষয়াবলী' || isCurrentAffairVariation(s.parentCategory)
    );
    return [...list].sort((a, b) => {
      const infoA = parseItemDateInfo(a);
      const infoB = parseItemDateInfo(b);
      return infoB.sortTimestamp - infoA.sortTimestamp;
    });
  }, [subcategories]);

  // Questions for a subcat
  const getQuestionsForSubcat = (subcat: SubcategoryItem) => {
    return (questions || []).filter(q => 
      (q.category === 'সাম্প্রতিক বিষয়াবলী' || isCurrentAffairVariation(q.category)) &&
      (q.subcategory === subcat.name || q.date === subcat.date || (q.subcategories && q.subcategories.includes(subcat.name)))
    );
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return sortedCurrentAffairs;
    const q = searchQuery.toLowerCase();
    return sortedCurrentAffairs.filter(item => 
      item.name.toLowerCase().includes(q) || (item.text && item.text.toLowerCase().includes(q))
    );
  }, [sortedCurrentAffairs, searchQuery]);

  // Running Month vs Previous Months Grouping
  const { runningMonthKey, runningMonthLabel, runningMonthItems, pastMonthGroups } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentRunningKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const currentRunningLabel = `${BENGALI_MONTHS[currentMonth]} ${toBnDigits(currentYear)}`;

    const runningItems: SubcategoryItem[] = [];
    const pastGroupsMap: Record<string, { monthKey: string; monthLabel: string; items: SubcategoryItem[]; totalQuestions: number }> = {};

    filteredItems.forEach(item => {
      const info = parseItemDateInfo(item);
      if (info.monthKey === currentRunningKey) {
        runningItems.push(item);
      } else {
        if (!pastGroupsMap[info.monthKey]) {
          pastGroupsMap[info.monthKey] = {
            monthKey: info.monthKey,
            monthLabel: info.monthLabelBn,
            items: [],
            totalQuestions: 0
          };
        }
        pastGroupsMap[info.monthKey].items.push(item);
        pastGroupsMap[info.monthKey].totalQuestions += getQuestionsForSubcat(item).length;
      }
    });

    // Sort past groups descending by monthKey (e.g. 2026-07 before 2026-06)
    const sortedPastGroups = Object.values(pastGroupsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return {
      runningMonthKey: currentRunningKey,
      runningMonthLabel: currentRunningLabel,
      runningMonthItems: runningItems,
      pastMonthGroups: sortedPastGroups
    };
  }, [filteredItems, questions]);

  const toggleExpandCard = (id: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleMonthFolder = (monthKey: string) => {
    setOpenMonthFolders(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // Render Single Date Card
  const renderDateCard = (item: SubcategoryItem, isInsideFolder = false) => {
    const itemQuestions = getQuestionsForSubcat(item);
    const bullets = (item.text || item.details || '').split('\n').filter(l => l.trim());
    const isExpanded = expandedCardIds[item.id] || false;
    const displayedBullets = isExpanded || bullets.length <= 2 ? bullets : bullets.slice(0, 2);

    return (
      <div
        key={item.id}
        className={`bg-white rounded-2xl border transition duration-200 flex flex-col gap-3 p-4 ${
          isInsideFolder 
            ? 'border-slate-200/90 shadow-2xs hover:border-teal-300' 
            : 'border-slate-100 hover:border-teal-200 shadow-2xs hover:shadow-xs'
        }`}
      >
        {/* Date & Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-900 font-extrabold text-xs rounded-xl border border-teal-200 flex items-center gap-1.5 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              {item.name}
            </span>
            {item.subHeading && (
              <span className="text-[11px] text-slate-500 font-semibold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                {item.subHeading}
              </span>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-medium">
            {itemQuestions.length > 0 ? `${toBnDigits(itemQuestions.length)} টি প্রশ্ন সংযুক্ত` : 'প্রশ্ন প্রস্তুতি চলছে'}
          </span>
        </div>

        {/* Bullet Points Body (Max 2 bullets initially, see more button if > 2) */}
        {bullets.length > 0 ? (
          <div className="space-y-1.5 pl-1">
            <ul className="space-y-1.5">
              {displayedBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 leading-relaxed font-medium">
                  <span className="text-teal-600 font-bold text-sm shrink-0 leading-none mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            {bullets.length > 2 && (
              <button
                type="button"
                onClick={() => toggleExpandCard(item.id)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-teal-600" />
                    <span>See less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
                    <span>See more</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">এই তারিখের কোনো সাধারণ বিবরণ নেই। প্রশ্নসমূহ দেখতে নিচের বাটনে ক্লিক করুন।</p>
        )}

        {/* Button below every text: "এই তারিখের উপর ভিত্তিকৃত প্রশ্ন" */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setSelectedSubcatForMCQ(item)}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📝</span>
            <span>এই তারিখের উপর ভিত্তিকৃত প্রশ্ন ({toBnDigits(itemQuestions.length)} টি)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="current-affairs-feed-section" className="flex flex-col gap-3.5 animate-fade-in text-slate-800">
      {/* Header Card if full view */}
      {!compact && (
        <div className="bg-gradient-to-r from-teal-700 via-emerald-800 to-indigo-900 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/20 uppercase">
                দৈনিক সাম্প্রতিক বিষয়াবলী
              </span>
              <span className="text-xs text-teal-200">সার্বক্ষণিক আপডেট</span>
            </div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2 text-white">
              <Globe className="w-6 h-6 text-teal-300 animate-pulse" />
              সাম্প্রতিক বিষয়াবলী ও প্রশ্ন ব্যাংক
            </h2>
            <p className="text-xs text-teal-100/90 mt-1 max-w-xl leading-relaxed">
              প্রতিদিনের জাতীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ তথ্য বুলেট পয়েন্ট আকারে পড়ুন এবং প্রতিটি তারিখের সাম্প্রতিক MCQ প্রশ্ন অনুশীলন করুন।
            </p>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-white/60 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="তারিখ বা তথ্য খুঁজুন..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
        </div>
      )}

      {/* If compact view inside dashboard */}
      {compact && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
                সাম্প্রতিক বিষয়াবলী (Daily Current Affairs)
              </h3>
              <p className="text-[10px] text-slate-500">
                চলমান মাসের তারিখসমূহ সরাসরি এবং পূর্ববর্তী মাসের তথ্য ফোল্ডার আকারে সাজানো
              </p>
            </div>
          </div>

          <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-2.5 py-1 rounded-lg border border-teal-200/60">
            চলমান মাস: {runningMonthLabel}
          </span>
        </div>
      )}

      {/* Feed List Container */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
            <span className="text-3xl">🌍</span>
            <p className="text-xs font-bold text-slate-600">কোনো সাম্প্রতিক বিষয়াবলী পাওয়া যায়নি।</p>
            <p className="text-[11px] text-slate-400">খুব শীঘ্রই এডমিন কর্তৃক নতুন তথ্য যোগ করা হবে।</p>
          </div>
        ) : (
          <>
            {/* SECTION 1: RUNNING MONTH (Shown directly by date) */}
            {runningMonthItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      চলমান মাস ({runningMonthLabel})
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-md">
                    {toBnDigits(runningMonthItems.length)}টি তারিখের আপডেট
                  </span>
                </div>

                <div className="space-y-3">
                  {runningMonthItems.map(item => renderDateCard(item, false))}
                </div>
              </div>
            )}

            {/* SECTION 2: PREVIOUS MONTHS FOLDERS */}
            {pastMonthGroups.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-amber-500" />
                    পূর্ববর্তী মাসের ফোল্ডারসমূহ
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {toBnDigits(pastMonthGroups.length)}টি মাস সংরক্ষিত
                  </span>
                </div>

                <div className="space-y-3">
                  {pastMonthGroups.map(group => {
                    // Auto-open if user is searching and matches are present
                    const isSearchActive = !!searchQuery.trim();
                    const isOpen = isSearchActive || (openMonthFolders[group.monthKey] ?? false);

                    return (
                      <div
                        key={group.monthKey}
                        className="bg-slate-50/70 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs transition"
                      >
                        {/* Folder Header */}
                        <button
                          type="button"
                          onClick={() => toggleMonthFolder(group.monthKey)}
                          className="w-full p-3.5 sm:p-4 bg-gradient-to-r from-amber-50/80 via-white to-slate-50 hover:bg-amber-100/40 transition flex items-center justify-between gap-3 text-left cursor-pointer border-b border-transparent data-[open=true]:border-slate-200"
                          data-open={isOpen}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-200/90 flex items-center justify-center text-amber-800 shrink-0">
                              {isOpen ? (
                                <FolderOpen className="w-5 h-5 text-amber-600" />
                              ) : (
                                <Folder className="w-5 h-5 text-amber-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                                {group.monthLabel} ফোল্ডার
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400">
                            <span className="text-[11px] font-bold text-amber-800 hidden sm:inline">
                              {isOpen ? 'বন্ধ করুন' : 'ফোল্ডার খুলুন'}
                            </span>
                            <div className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-amber-700" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Date Cards inside Folder */}
                        {isOpen && (
                          <div className="p-3 sm:p-4 bg-slate-100/50 space-y-3 border-t border-slate-200/70 animate-fade-in">
                            {group.items.map(item => renderDateCard(item, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Interactive MCQ Modal */}
      {selectedSubcatForMCQ && (
        <CurrentAffairsMCQModal
          subcat={selectedSubcatForMCQ}
          questions={getQuestionsForSubcat(selectedSubcatForMCQ)}
          bookmarkedIds={bookmarkedIds}
          onToggleBookmark={onToggleBookmark}
          onStartExamWithQuestions={onStartExamWithQuestions}
          onClose={() => setSelectedSubcatForMCQ(null)}
        />
      )}
    </div>
  );
}

