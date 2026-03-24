/**
 * Shared domain constants — must stay in sync with backend utils/constants.js
 */

export const CLASS_LEVELS = ['1ere', '2eme', '3eme', '4eme', '5eme', '6eme'] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = {
  '1ere': '1ère année',
  '2eme': '2ème année',
  '3eme': '3ème année',
  '4eme': '4ème année',
  '5eme': '5ème année',
  '6eme': '6ème année',
};

export const SUBJECTS = [
  'الرياضيات',
  'الإيقاظ العلمي',
  'الفرنسية',
  'الإنجليزية',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_META: Record<Subject, { en: string; color: string; emoji: string }> = {
  'الرياضيات':      { en: 'Mathematics', color: 'amber',  emoji: '📐' },
  'الإيقاظ العلمي': { en: 'Science',     color: 'teal',   emoji: '🔬' },
  'الفرنسية':       { en: 'French',      color: 'sky',    emoji: '🇫🇷' },
  'الإنجليزية':     { en: 'English',     color: 'indigo', emoji: '🇬🇧' },
};