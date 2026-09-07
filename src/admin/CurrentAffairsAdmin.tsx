import React, { useState, useMemo } from 'react';
import { SubcategoryItem, Question, CategoryItem } from '../shared/types';
import { isCurrentAffairVariation } from '../shared/lib/routineUtils';
import { Globe, Plus, Trash2, Edit3, CheckCircle2, HelpCircle, FileText, Calendar, BookOpen, AlertCircle, Sparkles, Search, ChevronRight, X, ArrowLeft } from 'lucide-react';

interface CurrentAffairsAdminProps {
  subcategories: SubcategoryItem[];
  questions: Question[];
  categories: CategoryItem[];
  onAddSubcategory: (name: string, parentCategory: string, date?: string, subHeading?: string, text?: string) => void;
  onUpdateSubcategory: (id: string, newName: string, newParent: string, date?: string, subHeading?: string, text?: string) => void;
  onDeleteSubcategory: (id: string) => void;
  onAddQuestion: (question: Question) => void;
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
}

const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

const toBanglaNumber = (num: number | string): string => {
  return String(num).replace(/\d/g, d => banglaDigits[Number(d)] || d);
};

const formatBanglaDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('জানুয়ারি') || dateStr.includes('আগস্ট') || dateStr.includes('ফেব্রুয়ারি') || dateStr.includes('ডিসেম্বর')) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = toBanglaNumber(d.getDate());
  const month = banglaMonths[d.getMonth()];
  const year = toBanglaNumber(d.getFullYear());
  return `${day} ${month} ${year}`;
};

export default function CurrentAffairsAdmin({
  subcategories,
  questions,
  categories,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion
}: CurrentAffairsAdminProps) {
  // Form State
  const [editingSubcatId, setEditingSubcatId] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [titleInput, setTitleInput] = useState<string>('');
  const [subHeadingInput, setSubHeadingInput] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');

  // Active subcategory question management modal
  const [managingQuestionsForSubcat, setManagingQuestionsForSubcat] = useState<SubcategoryItem | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // New Question Form state for currently managed subcat
  const [newQText, setNewQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  // Filter current affairs subcategories sorted latest date on top
  const currentAffairsList = useMemo(() => {
    const list = (subcategories || []).filter(s => 
      s.parentCategory === 'সাম্প্রতিক বিষয়াবলী' || isCurrentAffairVariation(s.parentCategory)
    );
    return [...list].sort((a, b) => {
      const dateA = a.date || a.createdAt || a.name || '';
      const dateB = b.date || b.createdAt || b.name || '';
      return dateB.localeCompare(dateA);
    });
  }, [subcategories]);

  // Questions for current affairs
  const getQuestionsForSubcat = (subcat: SubcategoryItem) => {
    return (questions || []).filter(q => 
      (q.category === 'সাম্প্রতিক বিষয়াবলী' || isCurrentAffairVariation(q.category)) &&
      (q.subcategory === subcat.name || q.date === subcat.date || (q.subcategories && q.subcategories.includes(subcat.name)))
    );
  };

  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveDate = dateInput.trim();
    const autoBanglaTitle = formatBanglaDate(effectiveDate);
    const postTitle = titleInput.trim() || autoBanglaTitle || 'সাম্প্রতিক বিষয়াবলী';

    if (!postTitle) {
      alert('দয়া করে তারিখ বা শিরোনাম প্রদান করুন!');
      return;
    }

    if (editingSubcatId) {
      onUpdateSubcategory(
        editingSubcatId,
        postTitle,
        'সাম্প্রতিক বিষয়াবলী',
        effectiveDate,
        subHeadingInput.trim() || undefined,
        textInput.trim() || undefined
      );
      setEditingSubcatId(null);
    } else {
      onAddSubcategory(
        postTitle,
        'সাম্প্রতিক বিষয়াবলী',
        effectiveDate,
        subHeadingInput.trim() || undefined,
        textInput.trim() || undefined
      );
    }

    // Reset Form
    setTitleInput('');
    setSubHeadingInput('');
    setTextInput('');
  };

  const startEditPost = (sub: SubcategoryItem) => {
    setEditingSubcatId(sub.id);
    setTitleInput(sub.name);
    setDateInput(sub.date || (sub.createdAt ? sub.createdAt.split('T')[0] : ''));
    setSubHeadingInput(sub.subHeading || '');
    setTextInput(sub.text || sub.details || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateQuestionForDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingQuestionsForSubcat) return;
    if (!newQText.trim() || !optA.trim() || !optB.trim()) {
      alert('দয়া করে প্রশ্নের বিষয় এবং অন্তত ২টি অপশন প্রদান করুন!');
      return;
    }

    const correctMap: ('Option A' | 'Option B' | 'Option C' | 'Option D')[] = ['Option A', 'Option B', 'Option C', 'Option D'];

    const newQuestion: Question = {
      id: `ca_q_${Date.now()}`,
      text: newQText.trim(),
      optionA: optA.trim(),
      optionB: optB.trim(),
      optionC: optC.trim() || 'N/A',
      optionD: optD.trim() || 'N/A',
      correct: correctMap[correctOpt] || 'Option A',
      explanation: explanation.trim() || '',
      category: 'সাম্প্রতিক বিষয়াবলী',
      subcategory: managingQuestionsForSubcat.name,
      subcategories: ['সাম্প্রতিক বিষয়াবলী', managingQuestionsForSubcat.name],
      date: managingQuestionsForSubcat.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    onAddQuestion(newQuestion);
    setNewQText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setExplanation('');
    setCorrectOpt(0);
    alert('🎯 সাম্প্রতিক প্রশ্ন সফলভাবে যুক্ত করা হয়েছে!');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-slate-800">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-indigo-800 to-purple-800 p-5 rounded-3xl text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-white/20">
              CURRENT AFFAIRS STUDIO
            </span>
            <span className="text-xs text-teal-200">অর্জন সাম্প্রতিক তথ্য ও প্রশ্ন ব্যাংক</span>
          </div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-teal-300 animate-pulse" />
            সাম্প্রতিক বিষয়াবলী ও দৈনিক প্রশ্ন ম্যানেজমেন্ট
          </h2>
          <p className="text-xs text-teal-100/90 mt-1 max-w-2xl leading-relaxed">
            এখানে তারিখ অনুযায়ী সাম্প্রতিক তথ্য বুলেট পয়েন্ট আকারে পোস্ট করুন এবং উক্ত তারিখের জন্য প্রাসঙ্গিক MCQ প্রশ্ন আপলোড বা ম্যানেজ করুন। ইউজার ড্যাশবোর্ডে সাম্প্রতিক বিষয়াবলী স্বয়ংক্রিয়ভাবে তারিখ অনুযায়ী প্রদর্শিত হবে।
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="block text-[10px] text-teal-200 uppercase font-bold">মোট পোস্ট</span>
            <span className="text-lg font-black text-white">{currentAffairsList.length.toLocaleString('bn-BD')} টি তারিখ</span>
          </div>
          <span className="text-2xl">🌍</span>
        </div>
      </div>

      {/* Main Grid: Left is Form, Right is Feed / List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Date Post Creation / Edit Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              {editingSubcatId ? (
                <>
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  পোস্ট সম্পাদন করুন (Edit Post)
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-teal-600" />
                  নতুন তারিখ ভিত্তিক পোস্ট যুক্ত করুন
                </>
              )}
            </h3>
            {editingSubcatId && (
              <button
                type="button"
                onClick={() => {
                  setEditingSubcatId(null);
                  setTitleInput('');
                  setSubHeadingInput('');
                  setTextInput('');
                }}
                className="text-xs text-slate-500 hover:text-rose-600 underline font-bold"
              >
                বাতিল করুন
              </button>
            )}
          </div>

          <form onSubmit={handleSavePost} className="flex flex-col gap-4 text-xs">
            {/* Date Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                তারিখ নির্বাচন করুন (Date):
              </label>
              <input
                type="date"
                required
                value={dateInput}
                onChange={e => {
                  setDateInput(e.target.value);
                  if (!editingSubcatId) {
                    setTitleInput(formatBanglaDate(e.target.value));
                  }
                }}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-semibold text-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                স্বয়ংক্রিয় বাংলা তারিখ: <strong className="text-teal-700">{formatBanglaDate(dateInput)}</strong>
              </p>
            </div>

            {/* Title / Subcategory Name */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                পোস্ট শিরোনাম / সাব-ক্যাটাগরির নাম (Title):
              </label>
              <input
                type="text"
                required
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                placeholder="যেমন: ১৮ আগস্ট ২০২৬ অথবা দৈনিক কারেন্ট অ্যাফেয়ার্স"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium text-slate-800"
              />
            </div>

            {/* Sub-heading */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                উপ-শিরোনাম বা ট্যাগ (ঐচ্ছিক):
              </label>
              <input
                type="text"
                value={subHeadingInput}
                onChange={e => setSubHeadingInput(e.target.value)}
                placeholder="যেমন: জাতীয় ও আন্তর্জাতিক সমসাময়িক ঘটনা"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              />
            </div>

            {/* Bullet Points Text Multiline */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-700 font-bold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  তথ্য ও নোটসমূহ (প্রতি লাইনে একটি বুলেট পয়েন্ট):
                </label>
                <span className="text-[10px] text-slate-400">১ লাইন = ১ বুলেট</span>
              </div>
              <textarea
                rows={6}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="জাতীয় সংসদ ভবনে গুরুত্বপূর্ণ বাজেট অধিবেশন সম্পন্ন হয়েছে।&#10;বাংলাদেশ ব্যাংক মুদ্রাস্ফীতি নিয়ন্ত্রণে নতুন পলিসি রেপো রেট ঘোষণা করেছে।&#10;আন্তর্জাতিক সৌর জোটে নতুন সদস্য হিসেবে যুক্ত হয়েছে একাধিক দেশ।"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium text-slate-800 leading-relaxed font-sans"
              />
              <p className="text-[10px] text-slate-500 mt-1 italic">
                * প্রতিটি নতুন লাইনে ইন্টার চাপলে ইউজার ড্যাশবোর্ডে তা আলাদা বুলেট পয়েন্ট (•) হিসেবে প্রদর্শিত হবে।
              </p>
            </div>

            {/* Live Bullet Preview */}
            {textInput.trim() && (
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                <span className="text-[10px] font-bold text-teal-900 block mb-1.5 uppercase">
                  লাইভ বুলেট প্রিভিউ (Live Preview):
                </span>
                <ul className="space-y-1.5 pl-1">
                  {textInput.split('\n').filter(line => line.trim()).map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px] text-teal-950 font-medium leading-relaxed">
                      <span className="text-teal-600 font-bold mt-0.5">•</span>
                      <span>{bullet.trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingSubcatId ? 'পোস্ট আপডেট করুন' : '💾 পোস্ট সংরক্ষণ করুন'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Published Feed List (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <span>📅</span>
                প্রকাশিত সাম্প্রতিক বিষয়াবলী ({currentAffairsList.length}টি)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                সর্বশেষ তারিখ সবার উপরে (Latest on top) সাজানো রয়েছে।
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="তারিখ বা তথ্য খুঁজুন..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* List items */}
          <div className="space-y-3.5">
            {currentAffairsList.filter(item => {
              if (!searchFilter) return true;
              const q = searchFilter.toLowerCase();
              return item.name.toLowerCase().includes(q) || (item.text && item.text.toLowerCase().includes(q));
            }).length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
                <span className="text-3xl">📭</span>
                <p className="text-xs font-bold text-slate-600">কোনো সাম্প্রতিক বিষয়াবলী পাওয়া যায়নি।</p>
                <p className="text-[11px] text-slate-400">বাম পাশের ফর্ম ব্যবহার করে নতুন তারিখের তথ্য পোস্ট করুন।</p>
              </div>
            ) : (
              currentAffairsList
                .filter(item => {
                  if (!searchFilter) return true;
                  const q = searchFilter.toLowerCase();
                  return item.name.toLowerCase().includes(q) || (item.text && item.text.toLowerCase().includes(q));
                })
                .map((item) => {
                  const itemQuestions = getQuestionsForSubcat(item);
                  const bullets = (item.text || item.details || '').split('\n').filter(l => l.trim());

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4.5 rounded-2xl border border-slate-100 hover:border-teal-200 shadow-xs hover:shadow-md transition duration-200 flex flex-col gap-3"
                    >
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-800 font-extrabold text-xs rounded-xl border border-teal-200/80 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                            {item.name}
                          </span>
                          {item.subHeading && (
                            <span className="text-[11px] text-slate-500 font-semibold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                              {item.subHeading}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditPost(item)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="সম্পাদন করুন"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`আপনি কি "${item.name}" পোস্ট এবং এর সকল তথ্য মুছে ফেলতে চান?`)) {
                                onDeleteSubcategory(item.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Card Body: Bullet Points */}
                      {bullets.length > 0 ? (
                        <ul className="space-y-1.5 pl-1">
                          {bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                              <span className="text-teal-600 font-bold text-sm shrink-0 mt-0.5">•</span>
                              <span className="font-normal">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400 italic">কোনো বিবরণ বা বুলেট পয়েন্ট প্রদান করা হয়নি।</p>
                      )}

                      {/* Card Footer: Attached MCQs & Question Manager Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-50 bg-slate-50/50 p-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            প্রশ্ন সংখ্যা:
                          </span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                            itemQuestions.length > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {itemQuestions.length.toLocaleString('bn-BD')} টি MCQ
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setManagingQuestionsForSubcat(item)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>📝</span>
                          <span>সাম্প্রতিক প্রশ্ন ম্যানেজ ও যোগ করুন ({itemQuestions.length})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Question Manager for a Specific Current Affairs Date */}
      {managingQuestionsForSubcat && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-700 to-purple-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    সাম্প্রতিক প্রশ্ন ম্যানেজমেন্ট: {managingQuestionsForSubcat.name}
                  </h3>
                  <p className="text-[10px] text-indigo-200 font-medium">
                    এই নির্দিষ্ট তারিখের জন্য কুইজ ও MCQ প্রশ্ন তৈরি ও ম্যানেজ করুন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManagingQuestionsForSubcat(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800">
              
              {/* Question Creation Form */}
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <h4 className="font-extrabold text-xs text-indigo-950 mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  নতুন সাম্প্রতিক প্রশ্ন যোগ করুন:
                </h4>

                <form onSubmit={handleCreateQuestionForDate} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">প্রশ্ন (Question Title):</label>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: বাংলাদেশ ব্যাংক সম্প্রতি মুদ্রাস্ফীতি নিয়ন্ত্রণে পলিসি রেপো রেট কত নির্ধারণ করেছে?"
                      value={newQText}
                      onChange={e => setNewQText(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">অপশন ১ (ক):</label>
                      <input
                        type="text"
                        required
                        placeholder="অপশন ক"
                        value={optA}
                        onChange={e => setOptA(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">অপশন ২ (খ):</label>
                      <input
                        type="text"
                        required
                        placeholder="অপশন খ"
                        value={optB}
                        onChange={e => setOptB(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">অপশন ৩ (গ):</label>
                      <input
                        type="text"
                        placeholder="অপশন গ (ঐচ্ছিক)"
                        value={optC}
                        onChange={e => setOptC(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">অপশন ৪ (ঘ):</label>
                      <input
                        type="text"
                        placeholder="অপশন ঘ (ঐচ্ছিক)"
                        value={optD}
                        onChange={e => setOptD(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">সঠিক উত্তর নির্বাচন করুন:</label>
                      <select
                        value={correctOpt}
                        onChange={e => setCorrectOpt(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={0}>অপশন ১ (ক)</option>
                        <option value={1}>অপশন ২ (খ)</option>
                        <option value={2}>অপশন ৩ (গ)</option>
                        <option value={3}>অপশন ৪ (ঘ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">ব্যাখ্যা (Explanation - ঐচ্ছিক):</label>
                      <input
                        type="text"
                        placeholder="ব্যাখ্যা বা অতিরিক্ত তথ্য"
                        value={explanation}
                        onChange={e => setExplanation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    প্রশ্নটি ডাটাবেজে সংরক্ষণ করুন
                  </button>
                </form>
              </div>

              {/* Existing Questions List for this Subcategory */}
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 mb-3 flex items-center justify-between">
                  <span>সংযুক্ত প্রশ্ন তালিকা ({getQuestionsForSubcat(managingQuestionsForSubcat).length}টি):</span>
                </h4>

                {getQuestionsForSubcat(managingQuestionsForSubcat).length === 0 ? (
                  <p className="text-slate-400 italic text-center py-6">
                    এই তারিখের জন্য এখনও কোনো প্রশ্ন আপলোড করা হয়নি।
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {getQuestionsForSubcat(managingQuestionsForSubcat).map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition flex flex-col gap-2 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-800 text-xs leading-snug">
                            {idx + 1}. {q.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('আপনি কি এই প্রশ্নটি মুছে ফেলতে চান?')) {
                                onDeleteQuestion(q.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {[q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean).map((opt, oIdx) => {
                            const optKeys = ['Option A', 'Option B', 'Option C', 'Option D'];
                            const isCorrect = q.correct === optKeys[oIdx];
                            return (
                              <div
                                key={oIdx}
                                className={`px-2 py-1 rounded-lg border font-medium ${
                                  isCorrect
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                                }`}
                              >
                                {['ক', 'খ', 'গ', 'ঘ'][oIdx] || oIdx + 1}) {opt}
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            💡 <strong>ব্যাখ্যা:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setManagingQuestionsForSubcat(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
