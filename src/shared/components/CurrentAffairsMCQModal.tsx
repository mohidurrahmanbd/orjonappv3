import React, { useState } from 'react';
import { SubcategoryItem, Question } from '../types';
import { X, CheckCircle2, AlertCircle, Bookmark, BookmarkCheck, ArrowRight, RotateCcw, Lightbulb, Sparkles, BookOpen } from 'lucide-react';

interface CurrentAffairsMCQModalProps {
  subcat: SubcategoryItem;
  questions: Question[];
  bookmarkedIds?: string[];
  onToggleBookmark?: (questionId: string) => void;
  onStartExamWithQuestions?: (questions: Question[], title: string) => void;
  onClose: () => void;
}

export default function CurrentAffairsMCQModal({
  subcat,
  questions,
  bookmarkedIds = [],
  onToggleBookmark,
  onStartExamWithQuestions,
  onClose
}: CurrentAffairsMCQModalProps) {
  // Local state for user answers to test knowledge interactively
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const toggleExplanation = (questionId: string) => {
    setShowExplanations(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const resetAll = () => {
    setSelectedAnswers({});
    setShowExplanations({});
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 via-indigo-800 to-purple-900 text-white flex justify-between items-start sm:items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0 backdrop-blur-md">
              🌍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                  সাম্প্রতিক প্রশ্ন
                </span>
                <span className="text-xs text-teal-200">দৈনিক কুইজ</span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5 text-white">
                {subcat.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">মোট প্রশ্ন:</span>
            <span className="bg-teal-100 text-teal-900 px-2 py-0.5 rounded-md font-bold">
              {questions.length.toLocaleString('bn-BD')} টি
            </span>
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(selectedAnswers).length > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                উত্তর ক্লিয়ার করুন
              </button>
            )}

            {onStartExamWithQuestions && questions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onStartExamWithQuestions(questions, `সাম্প্রতিক বিষয়াবলী (${subcat.name})`);
                  onClose();
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-extrabold shadow-2xs transition flex items-center gap-1 cursor-pointer"
              >
                <span>⏱️</span>
                <span>মক টেস্ট দিন</span>
              </button>
            )}
          </div>
        </div>

        {/* Questions list */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-3">
              <span className="text-4xl">📝</span>
              <p className="text-sm font-bold text-slate-700">
                এই তারিখের জন্য কোনো সাম্প্রতিক প্রশ্ন পাওয়া যায়নি।
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                এডমিন এখনও এই তারিখের প্রশ্ন আপলোড করেননি অথবা শীঘ্রই নতুন প্রশ্ন যোগ করা হবে।
              </p>
            </div>
          ) : (
            questions.map((q, qIndex) => {
              const optKeys: ('Option A' | 'Option B' | 'Option C' | 'Option D')[] = ['Option A', 'Option B', 'Option C', 'Option D'];
              const options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);
              const selectedOpt = selectedAnswers[q.id];
              const isAnswered = selectedOpt !== undefined;
              const correctIndex = optKeys.indexOf(q.correct);
              const isCorrect = isAnswered && selectedOpt === correctIndex;
              const isBookmarked = bookmarkedIds.includes(q.id);
              const showExpl = showExplanations[q.id];

              return (
                <div
                  key={q.id}
                  className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs hover:border-slate-200 transition flex flex-col gap-3"
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">
                      <span className="text-teal-700 font-extrabold mr-1.5">
                        {(qIndex + 1).toLocaleString('bn-BD')}.
                      </span>
                      {q.text}
                    </h4>

                    {onToggleBookmark && (
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(q.id)}
                        className={`p-1.5 rounded-lg transition shrink-0 ${
                          isBookmarked ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title={isBookmarked ? 'বুকমার্ক সরানো' : 'বুকমার্ক করুন'}
                      >
                        {isBookmarked ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {options.map((opt, optIdx) => {
                      const isThisSelected = selectedOpt === optIdx;
                      const isThisCorrect = correctIndex === optIdx;
                      
                      let btnStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
                      if (isAnswered) {
                        if (isThisCorrect) {
                          btnStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                        } else if (isThisSelected && !isThisCorrect) {
                          btnStyle = 'bg-rose-100 border-rose-400 text-rose-950 font-bold';
                        } else {
                          btnStyle = 'bg-slate-50/50 border-slate-100 text-slate-400';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer ${btnStyle}`}
                        >
                          <span className="font-bold text-slate-500 shrink-0">
                            {['ক', 'খ', 'গ', 'ঘ'][optIdx] || optIdx + 1})
                          </span>
                          <span className="flex-1 leading-snug">{opt}</span>
                          {isAnswered && isThisCorrect && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          )}
                          {isAnswered && isThisSelected && !isThisCorrect && (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Bar & Explanation Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-50 text-[11px]">
                    <div>
                      {isAnswered && (
                        <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isCorrect ? '✓ সঠিক উত্তর!' : `✗ ভুল উত্তর! (সঠিক: ${['ক', 'খ', 'গ', 'ঘ'][correctIndex] || q.correct})`}
                        </span>
                      )}
                    </div>

                    {q.explanation && (
                      <button
                        type="button"
                        onClick={() => toggleExplanation(q.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>{showExpl ? 'ব্যাখ্যা লুকান' : 'ব্যাখ্যা দেখুন'}</span>
                      </button>
                    )}
                  </div>

                  {/* Explanation text box */}
                  {showExpl && q.explanation && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 text-xs leading-relaxed animate-fade-in">
                      <span className="font-bold block mb-0.5">💡 ব্যাখ্যা:</span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
          <p className="text-[11px] text-slate-500">
            প্রতিটি অপশনে ক্লিক করে তাৎক্ষণিক সঠিক উত্তর যাচাই করুন।
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
