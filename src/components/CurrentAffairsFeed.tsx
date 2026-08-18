import React, { useState, useMemo } from 'react';
import { SubcategoryItem, Question } from '../types';
import { isCurrentAffairVariation } from '../App';
import CurrentAffairsMCQModal from './CurrentAffairsMCQModal';
import { Globe, Calendar, BookOpen, ChevronRight, Search, Sparkles, HelpCircle, FileText } from 'lucide-react';

interface CurrentAffairsFeedProps {
  subcategories: SubcategoryItem[];
  questions: Question[];
  bookmarkedIds?: string[];
  onToggleBookmark?: (questionId: string) => void;
  onStartExamWithQuestions?: (questions: Question[], title: string) => void;
  compact?: boolean;
}

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

  // Filter and sort latest date on top
  const sortedCurrentAffairs = useMemo(() => {
    const list = (subcategories || []).filter(s => 
      s.parentCategory === 'সাম্প্রতিক বিষয়াবলী' || isCurrentAffairVariation(s.parentCategory)
    );
    return [...list].sort((a, b) => {
      const dateA = a.date || a.createdAt || a.name || '';
      const dateB = b.date || b.createdAt || b.name || '';
      return dateB.localeCompare(dateA);
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
                তারিখ অনুযায়ী বুলেট পয়েন্ট তথ্য ও সংশ্লিষ্ট সাম্প্রতিক প্রশ্নসমূহ
              </p>
            </div>
          </div>

          <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-2.5 py-1 rounded-lg border border-teal-200/60">
            সর্বশেষ তারিখ সবার উপরে
          </span>
        </div>
      )}

      {/* Feed list */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
            <span className="text-3xl">🌍</span>
            <p className="text-xs font-bold text-slate-600">কোনো সাম্প্রতিক বিষয়াবলী পাওয়া যায়নি।</p>
            <p className="text-[11px] text-slate-400">খুব শীঘ্রই এডমিন কর্তৃক নতুন তথ্য যোগ করা হবে।</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const itemQuestions = getQuestionsForSubcat(item);
            const bullets = (item.text || item.details || '').split('\n').filter(l => l.trim());

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-100 hover:border-teal-200 p-4 shadow-2xs hover:shadow-xs transition duration-200 flex flex-col gap-3"
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
                    {itemQuestions.length > 0 ? `${itemQuestions.length.toLocaleString('bn-BD')} টি প্রশ্ন সংযুক্ত` : 'প্রশ্ন প্রস্তুতি চলছে'}
                  </span>
                </div>

                {/* Bullet Points Body */}
                {bullets.length > 0 ? (
                  <ul className="space-y-1.5 pl-1">
                    {bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 leading-relaxed font-medium">
                        <span className="text-teal-600 font-bold text-sm shrink-0 leading-none mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">এই তারিখের কোনো সাধারণ বিবরণ নেই। প্রশ্নসমূহ দেখতে নিচের বাটনে ক্লিক করুন।</p>
                )}

                {/* Button below every text: "সাম্প্রতিক প্রশ্ন" */}
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between gap-2 flex-wrap bg-slate-50/60 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <span>💡</span>
                    <span>এই তারিখের উপর ভিত্তিকৃত প্রশ্ন:</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedSubcatForMCQ(item)}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>📝</span>
                    <span>সাম্প্রতিক প্রশ্ন ({itemQuestions.length.toLocaleString('bn-BD')} টি)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
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
