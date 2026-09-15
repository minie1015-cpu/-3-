export interface StudentInfo {
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
}

export interface RubricScores {
  body1Score: number;       // 본문 1: 하는 일/특징 3문장 (1~4점)
  body2Score: number;       // 본문 2: 이유, 배운점 3문장 (1~4점)
  languageScore: number;    // 언어형식: 명사수식분사 + because (1~4점)
  wordCountScore: number;   // 글의 구성: 단어 수 (1~4점)
  totalScore: number;       // 총점 (4~16점, 초안 점수 완전 제외)
}

export interface BetterExpression {
  original: string;
  improved: string;
  reason?: string;
}

export interface StudentFeedback {
  achievementLevels: {
    contentRating: number;      // 1~5 (별점)
    contentStars: string;       // e.g. "★★★★☆"
    languageRating: number;     // 1~5
    languageStars: string;
    volumeRating: number;       // 1~5
    volumeStars: string;
    wordCountNote: string;      // e.g. "총 75단어"
  };
  goodPoints: string;
  betterExpressions: BetterExpression[];
  nextStep: string;
}

export interface GrammarErrorInfo {
  text: string;
  errorType: string;
  correction: string;
  isDeducted?: boolean;        // 감점 대상 여부 (대소문자 오류 등은 감점 제외: false)
}

export interface LanguageAnalysisInfo {
  participleUsed: boolean;
  becauseUsed: boolean;
  baseScore: number;           // 기본 점수 (분사 2점 + because 2점 = 4점)
  errorCount: number;          // 검출된 문법/어휘 오류 개수 (대소문자 제외)
  deduction: number;           // 감점 (0~2개: 0점, 3~5개: 1점, 6개 이상: 2점)
  finalLanguageScore: number;  // 1~4점
  errors: GrammarErrorInfo[];
}

export interface SentenceCountsInfo {
  body1SentenceCount: number;  // 하는 일 문장 수 (3문장=4점, 2문장=3점, 1문장=2점, 0문장=1점)
  body2SentenceCount: number;  // 이유/배운점 문장 수 (3문장=4점, 2문장=3점, 1문장=2점, 0문장=1점)
}

export interface EvaluationRecord {
  id: string;
  studentInfo: StudentInfo;
  scores: RubricScores;
  extractedText: string;
  wordCount: number;
  sentenceCounts?: SentenceCountsInfo;
  languageAnalysis?: LanguageAnalysisInfo;
  rubricNotes: {
    body1Note: string;
    body2Note: string;
    languageNote: string;
    wordCountNote: string;
  };
  teacherMemo: string;          // 교사용 단문 메모
  neisNote: string;             // 나이스(NEIS) 세특/평가용 문구
  studentFeedback: StudentFeedback;
  analyzedAt: string;
  sourceType: 'image' | 'pdf' | 'text' | 'sample';
  imagePreviewUrl?: string;
}

export interface EvaluationRequest {
  imageBase64?: string;
  mimeType?: string;
  studentText?: string;
  studentInfo?: Partial<StudentInfo>;
}

export interface BatchFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  file?: File;
  fileBase64?: string;
  fileMimeType: string;
  previewUrl?: string;
  studentInfo?: Partial<StudentInfo>;
  studentText?: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  result?: EvaluationRecord;
  isPdfPage?: boolean;
  pageIndex?: number;
  totalPdfPages?: number;
  originalPdfName?: string;
}
