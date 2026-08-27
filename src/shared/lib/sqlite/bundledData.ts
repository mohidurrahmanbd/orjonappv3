import { CategoryItem, SubcategoryItem, Question } from '../../types';
import { INITIAL_QUESTIONS } from '../../data';

export const BUNDLED_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: 'বিষয়ভিত্তিক প্রস্তুতি', subHeading: 'বাংলা, ইংরেজি, গণিত ও সাধারণ জ্ঞান' },
  { id: 'cat-2', name: 'জব সলিউশন পরীক্ষা', subHeading: 'বিসিএস ও অন্যান্য সরকারি চাকরির বিগত প্রশ্ন' },
  { id: 'cat-3', name: 'সাল ভিত্তিক জব সলিউশন', subHeading: 'সাল অনুযায়ী সমাধানকৃত পরীক্ষার প্রশ্নব্যাংক' },
  { id: 'cat-4', name: 'সাম্প্রতিক বিষয়াবলী', subHeading: 'সাম্প্রতিক দেশীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ ঘটনাবলি' }
];

export const BUNDLED_SUBCATEGORIES: SubcategoryItem[] = [
  // Job Solutions / BCS / Exams
  { id: 'sub_bcs_52', name: '৫২তম বিসিএস', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2026-08-10' },
  { id: 'sub_bcs_46', name: '৪৬তম বিসিএস', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2026-06-15' },
  { id: 'sub_bcs_45', name: '৪৫তম বিসিএস', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2023-05-19' },
  { id: 'sub_bcs_44', name: '৪৪তম বিসিএস', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2022-05-27' },
  { id: 'sub_bcs_38', name: '৩৮তম বিসিএস', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2017-12-29' },
  { id: 'sub_primary_2023', name: 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2023-12-08' },
  { id: 'sub_bank_2024', name: 'ব্যাংক রিক্রুটমেন্ট ২০২৪', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2024-03-01' },
  { id: 'sub_bb_2026', name: 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ২০২৬', parentCategory: 'জব সলিউশন পরীক্ষা', parentCategoryId: 'cat-2', date: '2026-07-20' },
  // Subject Preparation
  { id: 'sub_bangla', name: 'বাংলা', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_english', name: 'ইংরেজি', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_gk', name: 'সাধারণ জ্ঞান', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_math', name: 'গণিত', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_science', name: 'সাধারণ বিজ্ঞান', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_ict', name: 'কম্পিউটার ও তথ্যপ্রযুক্তি', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_geo', name: 'ভূগোল ও পরিবেশ', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_mental', name: 'মানসিক দক্ষতা', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  { id: 'sub_ethics', name: 'নৈতিকতা ও মূল্যবোধ', parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি', parentCategoryId: 'cat-1' },
  // Recent Affairs
  { id: 'sub_ca_18aug', name: '১৮ আগস্ট ২০২৬', parentCategory: 'সাম্প্রতিক বিষয়াবলী', parentCategoryId: 'cat-4', date: '2026-08-18' },
  { id: 'sub_ca_15aug', name: '১৫ আগস্ট ২০২৬', parentCategory: 'সাম্প্রতিক বিষয়াবলী', parentCategoryId: 'cat-4', date: '2026-08-15' }
];

export const BUNDLED_QUESTIONS: Question[] = INITIAL_QUESTIONS;
