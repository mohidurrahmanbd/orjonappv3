import React, { useState, useMemo } from 'react';
import { Course, Coupon, CourseEnrollment, User } from '../types';
import { 
  X, CheckCircle2, Tag, Percent, Sparkles, ShieldCheck, 
  AlertCircle, GraduationCap, ArrowRight, Wallet, Check, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CourseEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  user: User;
  coupons?: Coupon[];
  onEnrollSuccess: (enrollmentData: Omit<CourseEnrollment, 'id' | 'enrolledAt'>) => void;
}

export default function CourseEnrollmentModal({
  isOpen,
  onClose,
  course,
  user,
  coupons = [],
  onEnrollSuccess
}: CourseEnrollmentModalProps) {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  
  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'free'>('bkash');
  const [senderPhone, setSenderPhone] = useState(user.phone || '');
  const [trxId, setTrxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price calculations
  const rawPrice = course.price ?? 0;
  const originalPrice = course.originalPrice && course.originalPrice > rawPrice ? course.originalPrice : rawPrice;

  // Filter applicable active coupons for this course
  const availableCoupons = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return coupons.filter(c => {
      if (!c.isActive) return false;
      if (c.expiryDate && c.expiryDate < today) return false;
      if (c.courseId && c.courseId !== course.id) return false;
      return true;
    });
  }, [coupons, course.id]);

  const discountPercent = appliedCoupon ? Math.min(100, Math.max(1, appliedCoupon.discountPercent)) : 0;
  const discountAmount = Math.round((rawPrice * discountPercent) / 100);
  const finalPrice = Math.max(0, rawPrice - discountAmount);
  const isFree = finalPrice === 0;

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim().toUpperCase();
    setCouponError(null);
    setCouponSuccess(null);

    if (!code) {
      setCouponError('অনুগ্রহ করে একটি কুপন কোড লিখুন!');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const found = coupons.find(c => c.code.trim().toUpperCase() === code);

    if (!found) {
      setCouponError(`"${code}" কুপন কোডটি সঠিক নয়!`);
      return;
    }

    if (!found.isActive) {
      setCouponError(`"${code}" কুপন কোডটি বর্তমানে নিষ্ক্রিয় রয়েছে!`);
      return;
    }

    if (found.expiryDate && found.expiryDate < today) {
      setCouponError(`"${code}" কুপন কোডের মেয়াদ শেষ হয়ে গেছে!`);
      return;
    }

    if (found.courseId && found.courseId !== course.id) {
      setCouponError(`"${code}" কুপন কোডটি শুধুমাত্র "${found.courseTitle || 'নির্দিষ্ট কোর্স'}'-এর জন্য প্রযোজ্য!`);
      return;
    }

    setAppliedCoupon(found);
    setCouponInput(found.code);
    setCouponSuccess(`🎉 "${found.code}" কুপন সক্রিয় হয়েছে! আপনি ${found.discountPercent}% ছাড় পেয়েছেন (৳${Math.round((rawPrice * found.discountPercent) / 100)} সাশ্রয়)!`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    setCouponSuccess(null);
  };

  const handleConfirmEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const enrollmentData: Omit<CourseEnrollment, 'id' | 'enrolledAt'> = {
      courseId: course.id,
      courseTitle: course.title,
      userPhone: senderPhone || user.phone || 'N/A',
      userName: user.name,
      userEmail: user.email,
      userId: user.userId,
      originalPrice: rawPrice,
      discountPercent,
      discountAmount,
      finalPrice,
      couponCode: appliedCoupon?.code,
      paymentMethod: isFree ? 'free' : paymentMethod,
      trxId: isFree ? undefined : trxId.trim(),
      paymentStatus: isFree ? 'free' : 'paid'
    };

    setTimeout(() => {
      onEnrollSuccess(enrollmentData);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto text-left"
        >
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-5 sm:p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-wider mb-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
              <span>কোর্স এনরোলমেন্ট ও ডিসকাউন্ট</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white leading-snug">
              {course.title}
            </h2>
            {course.category && (
              <span className="inline-block mt-2 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                🏷️ {course.category}
              </span>
            )}
          </div>

          <form onSubmit={handleConfirmEnrollment} className="p-5 sm:p-6 space-y-5">
            {/* Pricing Summary Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>মূল কোর্স ফি:</span>
                <div className="flex items-center gap-2">
                  {originalPrice > rawPrice && (
                    <span className="line-through text-slate-400">৳{originalPrice}</span>
                  )}
                  <span className="text-slate-900 font-extrabold text-sm">৳{rawPrice}</span>
                </div>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    কুপন ছাড় ({appliedCoupon.code} - {discountPercent}%):
                  </span>
                  <span className="font-extrabold">-৳{discountAmount}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">মোট প্রদেয় ফি:</span>
                  {isFree && (
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">১০০% ফ্রি স্কলারশিপ</span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xl font-black ${isFree ? 'text-emerald-600' : 'text-indigo-950'}`}>
                    {isFree ? '৳০ (Free)' : `৳${finalPrice}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Discount Coupon Section */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-indigo-600" />
                <span>ডিসকাউন্ট কুপন কোড (Discount Coupon):</span>
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    disabled={!!appliedCoupon}
                    placeholder="যেমন: WELCOME50, FREE100"
                    className="w-full pl-3 pr-8 py-2.5 text-xs font-bold uppercase tracking-wider border rounded-xl bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 text-slate-800"
                  />
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-700 p-1 text-xs font-bold"
                      title="কুপন মুছুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold px-3 py-2.5 rounded-xl border border-rose-200 transition shrink-0"
                  >
                    বাতিল করুন
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-xs transition shrink-0 flex items-center gap-1"
                  >
                    <span>প্রয়োগ করুন</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Coupon Success / Error Feedback */}
              {couponSuccess && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{couponSuccess}</span>
                </p>
              )}
              {couponError && (
                <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{couponError}</span>
                </p>
              )}

              {/* Available Coupons Suggestions */}
              {availableCoupons.length > 0 && !appliedCoupon && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1.5">উপলব্ধ স্পেশাল কুপনসমূহ (ক্লিক করে সরাসরি প্রয়োগ করুন):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleApplyCoupon(c.code)}
                        className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10.5px] font-black px-2.5 py-1 rounded-lg border border-indigo-200/80 transition"
                      >
                        <Tag className="w-3 h-3 text-indigo-600" />
                        <span>{c.code}</span>
                        <span className="bg-indigo-600 text-white text-[9px] px-1 py-0.2 rounded font-bold">{c.discountPercent}% OFF</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method / Verification (if final price > 0) */}
            {!isFree ? (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>পেমেন্ট পদ্ধতি ও ট্রানজেকশন বিবরণ:</span>
                </label>

                {/* Method selector */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bkash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'bkash'
                        ? 'border-pink-500 bg-pink-50 text-pink-700 ring-2 ring-pink-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>বিকাশ (bKash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('nagad')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'nagad'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-nagad-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>নগদ (Nagad)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('rocket')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'rocket'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>রকেট (Rocket)</span>
                  </button>
                </div>

                {/* Instruction Box */}
                <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1 text-amber-950">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    পেমেন্ট নির্দেশনা ({paymentMethod.toUpperCase()} Personal/Merchant):
                  </p>
                  <p>
                    মোট <strong>৳{finalPrice}</strong> টাকা <strong>০১৭১১-২২৩৩৪৪</strong> নম্বরে Send Money/Payment করুন এবং নিচের বক্সে TrxID লিখুন।
                  </p>
                </div>

                {/* Sender Phone & TrxID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">প্রেরকের ফোন নম্বর:</label>
                    <input
                      type="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="017xxxxxxxx"
                      required
                      className="w-full px-3 py-2 text-xs font-bold border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Transaction ID (TrxID):</label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      placeholder="যেমন: 9K3LM7PQ8"
                      className="w-full px-3 py-2 text-xs font-bold uppercase border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-emerald-900">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-black text-emerald-950">সম্পূর্ণ ফ্রি এনরোলমেন্ট!</p>
                  <p className="text-[11px] font-medium text-emerald-800">কোনো ফি পরিশোধের প্রয়োজন নেই। নিচের বাটনে ক্লিক করে সাথে সাথে কোর্স আনলক করুন।</p>
                </div>
              </div>
            )}

            {/* Action Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-black py-3 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>প্রসেসিং হচ্ছে...</span>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4" />
                    <span>{isFree ? 'বিনামূল্যে এনরোল সম্পন্ন করুন 🎉' : `৳${finalPrice} পরিশোধ ও এনরোল নিশ্চিত করুন`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
