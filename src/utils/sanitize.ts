import { EvaluationRecord } from '../types';

/**
 * Strips any unwanted scoring disclaimers, score mentions, or rubric leakage phrases
 * from feedback texts, memos, and reasons.
 */
export function cleanFeedbackText(str?: string): string {
  if (!str || typeof str !== 'string') return '';
  let res = str;

  // 1. Remove tip prefix
  res = res.replace(/💡?\s*어법\s*및\s*단어\s*배움\s*팁[:\s]*/gi, '');

  // 2. Remove sentences mentioning hear music or listen to music
  res = res.replace(/[^.!?\n]*listen to music[^.!?\n]*[.!?]?/gi, '');
  res = res.replace(/[^.!?\n]*hear music[^.!?\n]*[.!?]?/gi, '');

  // 3. Remove sentences mentioning 기를 살리고 or 기를 꺾지
  res = res.replace(/[^.!?\n]*기를\s*(?:살리고|꺾지)[^.!?\n]*[.!?]?/gi, '');

  // 4. Remove sentences mentioning 대소문자나 더 자연스러운 단어 선택
  res = res.replace(/[^.!?\n]*대소문자나\s*더\s*자연스러운\s*단어\s*선택[^.!?\n]*[.!?]?/gi, '');

  // 5. Remove sentences mentioning 점수에 반영되지 않습니다 or 추천 제안이며
  res = res.replace(/[^.!?\n]*(?:점수에\s*반영되지\s*않습니다|추천\s*제안이며)[^.!?\n]*[.!?]?/gi, '');

  // 6. Remove remaining score leakages
  res = res.replace(/\(4점\)/g, '');
  res = res.replace(/\(기본\s*\d점\)/g, '');
  res = res.replace(/\d점\s*감점/g, '');

  return res.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Thoroughly sanitizes an EvaluationRecord in place to guarantee
 * no disclaimers remain in any field (local storage, AI results, etc.).
 */
export function sanitizeEvaluationRecord(record: EvaluationRecord): EvaluationRecord {
  if (!record) return record;

  const cleaned = { ...record };

  if (cleaned.studentFeedback) {
    cleaned.studentFeedback = {
      ...cleaned.studentFeedback,
      goodPoints: cleanFeedbackText(cleaned.studentFeedback.goodPoints),
      nextStep: cleanFeedbackText(cleaned.studentFeedback.nextStep),
      betterExpressions: Array.isArray(cleaned.studentFeedback.betterExpressions)
        ? cleaned.studentFeedback.betterExpressions
            .map((be) => ({
              ...be,
              original: cleanFeedbackText(be.original),
              improved: cleanFeedbackText(be.improved),
              reason: be.reason ? cleanFeedbackText(be.reason) : undefined,
            }))
            .filter((be) => be.original && be.improved)
        : [],
    };
  }

  if (cleaned.teacherMemo) {
    cleaned.teacherMemo = cleanFeedbackText(cleaned.teacherMemo);
  }

  if (cleaned.neisNote) {
    cleaned.neisNote = cleanFeedbackText(cleaned.neisNote);
  }

  return cleaned;
}
