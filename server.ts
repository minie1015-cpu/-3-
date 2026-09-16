import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { PDFDocument } from "pdf-lib";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for base64 image/PDF uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    geminiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Server-side PDF splitting endpoint (splits multi-page PDF into 1-page PDF base64 list)
app.post("/api/split-pdf", async (req, res) => {
  try {
    const { pdfBase64, fileName } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "pdfBase64 is required" });
    }

    const buffer = Buffer.from(pdfBase64, "base64");
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    const baseName = (fileName || "document.pdf").replace(/\.pdf$/i, "");
    const pages: Array<{ pageNumber: number; totalPages: number; pageBase64: string; fileName: string }> = [];

    for (let i = 0; i < totalPages; i++) {
      const subDoc = await PDFDocument.create();
      const [copiedPage] = await subDoc.copyPages(srcDoc, [i]);
      subDoc.addPage(copiedPage);
      const pdfBytes = await subDoc.save();
      const pageBase64 = Buffer.from(pdfBytes).toString("base64");
      pages.push({
        pageNumber: i + 1,
        totalPages,
        pageBase64,
        fileName: `${baseName}_p${String(i + 1).padStart(2, "0")}.pdf`,
      });
    }

    return res.json({
      success: true,
      totalPages,
      pages,
    });
  } catch (err: any) {
    console.error("PDF split error:", err);
    return res.status(500).json({ error: err?.message || "PDF 분할 처리 실패" });
  }
});

// Evaluate endpoint
app.post("/api/evaluate", async (req, res) => {
  try {
    const { imageBase64, mimeType, studentText, studentInfo } = req.body;

    if (!imageBase64 && typeof studentText !== "string") {
      return res.status(400).json({
        error: "답안지 이미지/PDF 또는 텍스트 입력이 필요합니다.",
      });
    }

    // Direct instant return if purely empty/blank text is submitted
    if (!imageBase64 && (!studentText || !studentText.trim())) {
      const blankData = {
        studentInfo: {
          grade: studentInfo?.grade || "3",
          classNum: studentInfo?.classNum || "1",
          studentNum: studentInfo?.studentNum || "1",
          name: studentInfo?.name || "학생",
        },
        extractedText: "(본문 미작성 - 백지 제출)",
        wordCount: 0,
        sentenceCounts: { body1SentenceCount: 0, body2SentenceCount: 0 },
        scores: {
          body1Score: 1,
          body2Score: 1,
          languageScore: 1,
          wordCountScore: 1,
          totalScore: 4,
        },
        languageAnalysis: {
          participleUsed: false,
          becauseUsed: false,
          baseScore: 1,
          errorCount: 0,
          deduction: 0,
          finalLanguageScore: 1,
          errors: [],
        },
        rubricNotes: {
          body1Note: "본문1 미작성 (0문장 / 백지 1점)",
          body2Note: "본문2 미작성 (0문장 / 백지 1점)",
          languageNote: "본문 미작성으로 명사 수식 분사 및 because 미활용 (기본 1점)",
          wordCountNote: "0단어 (백지 제출: 1점)",
        },
        teacherMemo: "백지 제출 (본문1 0문장, 본문2 0문장, 필수 어법 미활용, 0단어 -> 최저 기본점수 4점 부여)",
        neisNote: "영어 쓰기 과제에 미응시/백지로 제출하여 기본적인 영작문 구성 및 핵심 어법 표현에 대한 추가적인 기초 지도가 요구됨.",
        studentFeedback: {
          achievementLevels: {
            contentRating: 1,
            contentStars: "★☆☆☆☆",
            languageRating: 1,
            languageStars: "★☆☆☆☆",
            volumeRating: 1,
            volumeStars: "★☆☆☆☆",
            wordCountNote: "0단어 (백지 제출)",
          },
          goodPoints: "답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 한 문장이라도 용기를 내어 작성해 보세요.",
          betterExpressions: [
            {
              original: "(본문 미작성)",
              improved: "A doctor treating sick patients is a hero because she saves lives.",
              reason: "명사를 수식하는 분사(treating sick patients)와 이유의 접속사 because를 결합한 모범 예시입니다.",
            },
          ],
          nextStep: "수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요.",
        },
      };

      return res.json({
        success: true,
        data: blankData,
      });
    }

    const ai = getGeminiClient();

    const systemInstruction = `너는 대한민국 중학교 3학년 영어 교사야. 아래 학생의 영어 쓰기 수행평가 답안(수행평가 주제: '숨은 영웅 소개하기', 총점 16점 만점)을 제공된 엄격한 객관적 루브릭에 맞춰 채점하고, 교사용 데이터와 학생용 피드백을 생성해 줘.
**초안 점수는 평가 항목에서 완전히 삭제/제외되었으므로 절대 채점하거나 점수에 포함하지 말 것.**

[채점 기준표 (총 16점 만점, 4개 항목 각 1~4점)]
1. 본문 1: 하는 일/특징 3문장 (1~4점):
   * 문장 수 중심의 객관적 기준에 따라, 문법 요소는 독립 항목(언어형식)에서 별도로 평가하고 내용 영역은 작성된 문장 수에 맞추어 점수를 부여:
     - 3문장 이상 작성: 4점
     - 2문장 작성: 3점
     - 1문장 작성: 2점
     - 0문장 / 미작성: 1점 (기본점수 1점)

2. 본문 2: 이유/배운 점 3문장 (1~4점):
   * 문장 수 중심의 객관적 기준에 따라, 문법 요소는 독립 항목(언어형식)에서 별도로 평가하고 내용 영역은 작성된 문장 수에 맞추어 점수를 부여:
     - 3문장 이상 작성: 4점
     - 2문장 작성: 3점
     - 1문장 작성: 2점
     - 0문장 / 미작성: 1점 (기본점수 1점)

3. 언어형식 (명사 수식 분사 표현 + 접속사 because, 기본 1~4점 및 어법 감점제):
   * 기본 점수 산출 (교사용 내부 기준):
     - 분사 표현(~ing, p.p.)과 이유의 접속사 because 2가지를 모두 바르게 활용 시: 기본 4점
     - 둘 중 1가지만 활용 시: 기본 3점
     - 작성 및 시도하였으나 불완전하거나 형태가 이상한 경우: 기본 2점
     - 둘 다 미작성 또는 백지 제출: 기본 1점
   * ★★★ [절대 감점 금지 항목 1: 대소문자 표기 오류 - 점수에 반영 금지!] ★★★
     - **문장 첫 글자 소문자, 고유명사 소문자, 1인칭 I 소문자 등 대소문자(Capitalization) 오류는 절대로 점수에서 감점하지 마(0점 감점)!**
     - 점수에 절대 반영하지 말 것. languageAnalysis.errors에 기록하되 errorType: '대소문자 표기 안내', isDeducted: false 로 지정할 것.
   * ★★★ [절대 감점 금지 항목 2: 단어/어휘 선택 - 너무 가혹하므로 감점 금지!] ★★★
     - **어색한 단어 선택(Word Choice / Diction / Collocation)은 절대로 점수에서 감점하지 마(0점 감점, isDeducted: false)!**
     - 학생의 기를 꺾지 않도록 점수에는 일체 반영하지 말고, 대신 **[더 나은 표현으로 다듬기(Better Expressions)]**에 모범 표현으로 친절하게 제안해 줄 것! (예: hear music → listen to music, make happy → bring joy 등)
   * 감점 대상 오류 기준 (대소문자 제외 및 단어선택 제외한 중대한 문법/구문 구조 오류에 한함):
     - 감점 대상 어법 오류 0~2개: 감점 없음 (0점 감점)
     - 감점 대상 어법 오류 3~5개: 1점 감점 (-1점 차감)
     - 감점 대상 어법 오류 6개 이상: 2점 감점 (-2점 차감)
   * 최종 언어형식 점수 = Math.max(1, 기본 점수 - 감점)

4. 글의 구성 (단어 수 기준, 1~4점):
   - 80단어 이상: 4점
   - 60~79단어: 3점
   - 59단어 이하: 2점
   - 백지 제출: 1점

★ [중요: 백지 제출 및 미작성 답안 특별 판정 기준]
만약 답안지가 백지이거나, 본문이 작성되지 않았거나, 학생이 쓴 영문 텍스트가 사실상 없는 경우(영단어 3개 이하 또는 빈 양식):
- 절대 "잘 썼다", "감점 없음", "4점 만점"으로 채점하거나 칭찬하지 말 것!
- extractedText: "(본문 미작성 - 백지 제출)"
- wordCount: 0
- sentenceCounts: { body1SentenceCount: 0, body2SentenceCount: 0 }
- languageAnalysis: participleUsed: false, becauseUsed: false, baseScore: 1, errorCount: 0, deduction: 0, finalLanguageScore: 1, errors: []
- scores: body1Score: 1, body2Score: 1, languageScore: 1, wordCountScore: 1, totalScore: 4 (최저 기본점 4점)
- rubricNotes: body1Note: "본문1 미작성 (0문장 / 백지 1점)", body2Note: "본문2 미작성 (0문장 / 백지 1점)", languageNote: "본문 미작성으로 분사 및 because 미활용 (기본 1점)", wordCountNote: "0단어 (백지 제출: 1점)"
- teacherMemo: "백지 제출 (본문1 0문장, 본문2 0문장, 필수 문법 미사용, 0단어 -> 최저 기본점수 4점 부여)"
- neisNote: "영어 쓰기 과제에 미응시/백지로 제출하여 기본적인 영작문 구성 및 핵심 어법 표현에 대한 추가적인 기초 지도가 요구됨."
- studentFeedback:
  * contentRating: 1 (★☆☆☆☆), languageRating: 1 (★☆☆☆☆), volumeRating: 1 (★☆☆☆☆), wordCountNote: "0단어 (백지 제출)"
  * goodPoints: "답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 한 문장이라도 용기를 내어 작성해 보세요."
  * betterExpressions: [{ original: "(본문 미작성)", improved: "A firefighter helping people is a hero because he is brave.", reason: "명사를 수식하는 분사(helping people)와 이유의 접속사 because를 결합한 모범 예문입니다." }]
  * nextStep: "수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요."

[중요 보안/가림 지침 - 학생용 피드백 노출 절대 금지]
- **학생들에게는 [채점 기준], 점수(1~4점 등), 감점 산정 공식(-1점 차감 등), 기본 4점 기준('2개 다 쓰면 4점, 1개 쓰면 3점, 이상하게 쓰면 2점' 등)을 절대로 노출하거나 언급하지 말 것!**
- 굳이 밝힐 필요가 없으므로 학생용 피드백에는 오직 학생의 성장을 돕는 다정하고 격려하는 피드백만 제공할 것.
- 학생용 피드백에는:
  1) 영역별 성취 수준:
     - 내용 구성 (영웅 특징 및 이유): 별점 1~5점 (예: ★★★★☆)
     - 언어 형식 (분사 표현, 접속사 because): 별점 1~5점
     - 분량 및 어휘: 별점 1~5점, 단어 수 표기 (예: ★★★★☆ (총 75단어))
  2) 잘한 점 (Good Points): 학생이 잘 쓴 문장이나 참신한 표현, 진정성 있는 태도 칭찬 (단, 백지 제출 시에는 백지 안내 제공)
  3) 더 나은 표현으로 다듬기 (Better Expressions): 단어 선택이나 어색한 표현 2~4개를 골라 [원문] → [더 자연스러운 표현] (예: hear music → listen to music) 및 친절한 교정 이유 제시
  4) 쓰기 발전 방향 (Next Step): 중3 수준에 맞는 앞으로의 글쓰기 팁 (분사구문 활용, 접속사 다양화, 수일치 주의 등)

[교사용 데이터 지침]
- 학생 기본 정보(학년, 반, 번호, 이름) 추출(스캔본 상단에 있으면 추출, 없으면 입력값 사용)
- 항목별 점수 수치(본문1 1~4, 본문2 1~4, 언어형식 1~4, 단어수 1~4, 총점 4~16)
- sentenceCounts: 본문1 문장 수, 본문2 문장 수
- languageAnalysis: participleUsed, becauseUsed, baseScore, errorCount, deduction, finalLanguageScore, errors
- 단문 메모: 교사가 성적 확인 시 한눈에 파악할 수 있는 요약 (예: "하는일 2문장(3점), 이유 1문장(2점), 핵심요소 2개(4점, 감점없음), 65단어(3점) -> 총점 12점")
- NEIS(나이스) 세특 문구: 학교생활기록부 과목별 세부능력 및 특기사항에 바로 붙여넣을 수 있는 교육부 양식의 격조 높은 1~2문장 서술형 평가 문구.`;

    const contents: any[] = [];

    // Add multimodal part if base64 provided
    if (imageBase64 && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      });
    }

    // Add prompt text
    let userPrompt = `다음 학생의 답안을 분석하고 16점 객관적 루브릭에 맞춰 채점해 줘.
- 내용 영역(본문1, 본문2)은 문법 요소를 별도로 분리하고 문장 수 중심의 객관적 기준(3문장: 4점 / 2문장: 3점 / 1문장: 2점 / 0문장: 1점)에 따라 점수를 부여해 줘.
- 언어형식(4점 만점):
  * 분사(2점)와 because(2점) 사용 시 기본 4점(하나만 사용 시 2점, 둘 다 미사용 시 1점).
  * [중요] 대소문자 표기 오류(문장 첫 글자 소문자, 고유명사 소문자 등)는 감점 대상에서 완전히 제외(0점 감점)! 다만 학생 피드백(Better Expressions 및 errors 목록)에는 교정 안내를 꼭 제공하고 isDeducted: false 로 표시할 것.
  * 감점 대상 문법/철자 오류(대소문자 제외) 개수를 세어 0~2개 0점 감점, 3~5개 1점 감점, 6개 이상 2점 감점하여 최종 언어형식 점수를 산출해 줘.
- 글의 구성은 80단어 이상 4점, 60~79단어 3점, 59단어 이하 2점, 백지 1점으로 부여해 줘.
- 학생용 피드백에는 점수나 감점 기준표를 절대 노출하지 말 것.\n`;

    if (studentText) {
      userPrompt += `[학생 답안 텍스트]:\n"""\n${studentText}\n"""\n`;
    }

    if (studentInfo) {
      userPrompt += `[제공된 학생 정보]: 학년: ${studentInfo.grade || "3"}, 반: ${studentInfo.classNum || ""}, 번호: ${studentInfo.studentNum || ""}, 이름: ${studentInfo.name || ""}\n`;
    }

    userPrompt += `(주의: 초안 점수는 평가 대상이 아니므로 완전히 제외함)\n`;
    userPrompt += `스캔본 이미지가 있다면 상단의 학년, 반, 번호, 이름 및 학생이 손으로 쓴 본문 텍스트를 정확하게 OCR하여 전사(transcribe)해 줘.`;

    contents.push({ text: userPrompt });

    // Try primary and fallback models with retries (Google API recommends gemini-3.6-flash as successor to 1.5/2.0/2.5 flash)
    const candidateModels = [
      "gemini-3.6-flash",
      "gemini-3.8-flash",
    ];

    let response: any = null;
    let lastErr: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
              systemInstruction,
              temperature: 0.2,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  studentInfo: {
                    type: Type.OBJECT,
                    properties: {
                      grade: { type: Type.STRING },
                      classNum: { type: Type.STRING },
                      studentNum: { type: Type.STRING },
                      name: { type: Type.STRING },
                    },
                    required: ["grade", "classNum", "studentNum", "name"],
                  },
                  extractedText: {
                    type: Type.STRING,
                    description: "학생이 작성한 영문 답안 전체 전사 텍스트",
                  },
                  wordCount: {
                    type: Type.INTEGER,
                    description: "영단어 수 (공백 구분)",
                  },
                  sentenceCounts: {
                    type: Type.OBJECT,
                    properties: {
                      body1SentenceCount: { type: Type.INTEGER, description: "본문1 작성 문장 수" },
                      body2SentenceCount: { type: Type.INTEGER, description: "본문2 작성 문장 수" },
                    },
                    required: ["body1SentenceCount", "body2SentenceCount"],
                  },
                  languageAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      participleUsed: { type: Type.BOOLEAN, description: "명사수식 분사 사용 여부" },
                      becauseUsed: { type: Type.BOOLEAN, description: "접속사 because 사용 여부" },
                      baseScore: { type: Type.INTEGER, description: "기본 점수 (최대 4점)" },
                      errorCount: { type: Type.INTEGER, description: "발견된 문법/어휘 오류 개수" },
                      deduction: { type: Type.INTEGER, description: "감점 (0, 1, or 2)" },
                      finalLanguageScore: { type: Type.INTEGER, description: "최종 언어형식 점수 1~4점" },
                      errors: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            text: { type: Type.STRING, description: "오류 어구" },
                            errorType: { type: Type.STRING, description: "오류 유형 (대소문자, 철자, 전치사, 수일치, 동사누락 등)" },
                            correction: { type: Type.STRING, description: "올바른 수정 제안" },
                            isDeducted: { type: Type.BOOLEAN, description: "감점 대상 여부 (대소문자 오류는 반드시 false, 그 외 문법/철자 오류는 true)" },
                          },
                          required: ["text", "errorType", "correction", "isDeducted"],
                        },
                      },
                    },
                    required: [
                      "participleUsed",
                      "becauseUsed",
                      "baseScore",
                      "errorCount",
                      "deduction",
                      "finalLanguageScore",
                      "errors",
                    ],
                  },
                  scores: {
                    type: Type.OBJECT,
                    properties: {
                      body1Score: { type: Type.INTEGER, description: "1~4점 (3문장:4, 2문장:3, 1문장:2, 0문장:1)" },
                      body2Score: { type: Type.INTEGER, description: "1~4점 (3문장:4, 2문장:3, 1문장:2, 0문장:1)" },
                      languageScore: { type: Type.INTEGER, description: "1~4점 (기본4점 - 오류감점)" },
                      wordCountScore: { type: Type.INTEGER, description: "1~4점 (80단어이상:4, 60~79:3, 59이하:2, 백지:1)" },
                      totalScore: { type: Type.INTEGER, description: "4~16점 총점" },
                    },
                    required: [
                      "body1Score",
                      "body2Score",
                      "languageScore",
                      "wordCountScore",
                      "totalScore",
                    ],
                  },
                  rubricNotes: {
                    type: Type.OBJECT,
                    properties: {
                      body1Note: { type: Type.STRING },
                      body2Note: { type: Type.STRING },
                      languageNote: { type: Type.STRING },
                      wordCountNote: { type: Type.STRING },
                    },
                    required: ["body1Note", "body2Note", "languageNote", "wordCountNote"],
                  },
                  teacherMemo: {
                    type: Type.STRING,
                    description: "교사용 단문 메모 (예: because 미사용, 단어수 65, 분사 수식 good)",
                  },
                  neisNote: {
                    type: Type.STRING,
                    description: "나이스(NEIS) 학교생활기록부 세특 입력용 1~2문장 서술문",
                  },
                  studentFeedback: {
                    type: Type.OBJECT,
                    properties: {
                      achievementLevels: {
                        type: Type.OBJECT,
                        properties: {
                          contentRating: { type: Type.INTEGER, description: "1~5" },
                          contentStars: { type: Type.STRING, description: "예: ★★★★☆" },
                          languageRating: { type: Type.INTEGER, description: "1~5" },
                          languageStars: { type: Type.STRING, description: "예: ★★★☆☆" },
                          volumeRating: { type: Type.INTEGER, description: "1~5" },
                          volumeStars: { type: Type.STRING, description: "예: ★★★★☆" },
                          wordCountNote: { type: Type.STRING, description: "예: 총 75단어" },
                        },
                        required: [
                          "contentRating",
                          "contentStars",
                          "languageRating",
                          "languageStars",
                          "volumeRating",
                          "volumeStars",
                          "wordCountNote",
                        ],
                      },
                      goodPoints: {
                        type: Type.STRING,
                        description: "잘한 점 (Good Points) - 칭찬 및 강점",
                      },
                      betterExpressions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            original: { type: Type.STRING, description: "학생 원문" },
                            improved: { type: Type.STRING, description: "교정된 더 나은 표현" },
                            reason: { type: Type.STRING, description: "수정 이유/설명" },
                          },
                          required: ["original", "improved"],
                        },
                        description: "더 나은 표현으로 다듬기 2~3문장",
                      },
                      nextStep: {
                        type: Type.STRING,
                        description: "쓰기 발전 방향 (Next Step) 가이드",
                      },
                    },
                    required: ["achievementLevels", "goodPoints", "betterExpressions", "nextStep"],
                  },
                },
                required: [
                  "studentInfo",
                  "extractedText",
                  "wordCount",
                  "scores",
                  "rubricNotes",
                  "teacherMemo",
                  "neisNote",
                  "studentFeedback",
                ],
              },
            },
          });

          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`Model ${model} attempt ${attempt} failed, retrying...`, err?.message || err);
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      if (response && response.text) break;
    }

    if (!response || !response.text) {
      throw lastErr || new Error("Gemini API 호출에 실패했습니다. 다시 시도해 주세요.");
    }

    const parsed = JSON.parse(response.text || "{}");

    // Ensure studentInfo defaults if missing
    parsed.studentInfo = {
      grade: parsed.studentInfo?.grade || studentInfo?.grade || "3",
      classNum: parsed.studentInfo?.classNum || studentInfo?.classNum || "1",
      studentNum: parsed.studentInfo?.studentNum || studentInfo?.studentNum || "1",
      name: parsed.studentInfo?.name || studentInfo?.name || "학생",
    };

    // Check if the student's submission is blank / unwritten
    const rawText = (parsed.extractedText || studentText || "").trim();
    const englishWords = rawText.match(/[a-zA-Z]{2,}/g) || [];
    const isExplicitBlank =
      !rawText ||
      rawText === "(본문 미작성)" ||
      rawText.includes("백지 제출") ||
      rawText.includes("본문 미작성") ||
      (typeof parsed.wordCount === "number" && parsed.wordCount === 0) ||
      englishWords.length <= 3;

    if (isExplicitBlank) {
      parsed.extractedText = "(본문 미작성 - 백지 제출)";
      parsed.wordCount = 0;
      parsed.sentenceCounts = { body1SentenceCount: 0, body2SentenceCount: 0 };
      parsed.scores = {
        body1Score: 1,
        body2Score: 1,
        languageScore: 1,
        wordCountScore: 1,
        totalScore: 4,
      };
      parsed.languageAnalysis = {
        participleUsed: false,
        becauseUsed: false,
        baseScore: 1,
        errorCount: 0,
        deduction: 0,
        finalLanguageScore: 1,
        errors: [],
      };
      parsed.rubricNotes = {
        body1Note: "본문1 미작성 (0문장 / 백지 1점)",
        body2Note: "본문2 미작성 (0문장 / 백지 1점)",
        languageNote: "본문 미작성으로 명사 수식 분사 및 because 미활용 (기본 1점)",
        wordCountNote: "0단어 (백지 제출: 1점)",
      };
      parsed.teacherMemo = "백지 제출 (본문1 0문장, 본문2 0문장, 필수 어법 미활용, 0단어 -> 최저 기본점수 4점 부여)";
      parsed.neisNote = "영어 쓰기 과제에 미응시/백지로 제출하여 기본적인 영작문 구성 및 핵심 어법 표현에 대한 추가적인 기초 지도가 요구됨.";
      parsed.studentFeedback = {
        achievementLevels: {
          contentRating: 1,
          contentStars: "★☆☆☆☆",
          languageRating: 1,
          languageStars: "★☆☆☆☆",
          volumeRating: 1,
          volumeStars: "★☆☆☆☆",
          wordCountNote: "0단어 (백지 제출)",
        },
        goodPoints: "답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 한 문장이라도 용기를 내어 작성해 보세요.",
        betterExpressions: [
          {
            original: "(본문 미작성)",
            improved: "A doctor treating sick patients is a hero because she saves lives.",
            reason: "명사를 수식하는 분사(treating sick patients)와 이유의 접속사 because를 결합한 모범 예시입니다.",
          },
        ],
        nextStep: "수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요.",
      };
    } else {
      // Calculate/validate scores strictly according to the 16-point rubric rules
      const scores = parsed.scores || {
        body1Score: 4,
        body2Score: 4,
        languageScore: 4,
        wordCountScore: 4,
        totalScore: 16,
      };

      // 1. Language score validation with error deduction logic (대소문자는 감점 제외, 피드백으로만 안내)
      if (parsed.languageAnalysis) {
        const allErrors = Array.isArray(parsed.languageAnalysis.errors)
          ? parsed.languageAnalysis.errors
          : [];

        let deductionErrorCount = 0;
        allErrors.forEach((err: any) => {
          const errorTypeStr = String(err.errorType || "").toLowerCase();
          const reasonStr = String(err.reason || "").toLowerCase();
          const textStr = String(err.text || "").trim();
          const corrStr = String(err.correction || "").trim();

          // 1. 대소문자 오류 여부 판별 (점수에 반영 금지, 감점 절대 제외)
          const isCapitalization =
            err.isDeducted === false ||
            errorTypeStr.includes("대소문자") ||
            errorTypeStr.includes("capital") ||
            errorTypeStr.includes("case") ||
            errorTypeStr.includes("대문자") ||
            errorTypeStr.includes("소문자") ||
            reasonStr.includes("대소문자") ||
            reasonStr.includes("대문자") ||
            reasonStr.includes("소문자") ||
            reasonStr.includes("첫 글자") ||
            reasonStr.includes("첫글자") ||
            reasonStr.includes("capital") ||
            (textStr.toLowerCase() === corrStr.toLowerCase() && textStr !== corrStr);

          // 2. 단어/어휘 선택 여부 판별 (너무 가혹하므로 점수 감점 금지, Better Expressions로 제안)
          const isWordChoice =
            errorTypeStr.includes("단어") ||
            errorTypeStr.includes("어휘") ||
            errorTypeStr.includes("word") ||
            errorTypeStr.includes("diction") ||
            errorTypeStr.includes("collocation") ||
            errorTypeStr.includes("표현") ||
            errorTypeStr.includes("선택") ||
            reasonStr.includes("단어 선택") ||
            reasonStr.includes("어휘") ||
            reasonStr.includes("단어선택") ||
            reasonStr.includes("어색") ||
            reasonStr.includes("더 자연스러운") ||
            reasonStr.includes("표현 제안") ||
            reasonStr.includes("word choice") ||
            reasonStr.includes("collocation");

          if (isCapitalization) {
            err.isDeducted = false;
            err.errorType = "대소문자 표기 안내";
          } else if (isWordChoice) {
            err.isDeducted = false;
            err.errorType = "단어/어휘 선택 제안";
            // Ensure studentFeedback.betterExpressions includes this helpful recommendation
            if (parsed.studentFeedback && Array.isArray(parsed.studentFeedback.betterExpressions)) {
              const alreadyExists = parsed.studentFeedback.betterExpressions.some(
                (b: any) =>
                  (b.original && textStr && (b.original.includes(textStr) || textStr.includes(b.original))) ||
                  (b.improved && corrStr && b.improved.includes(corrStr))
              );
              if (!alreadyExists && textStr && corrStr) {
                parsed.studentFeedback.betterExpressions.push({
                  original: textStr,
                  improved: corrStr,
                  reason: err.reason || "보다 자연스러운 단어 및 표현 선택 제안 (감점 없음)",
                });
              }
            }
          } else {
            // 중대한 문법/구문 오류만 감점 카운트에 포함
            err.isDeducted = true;
            deductionErrorCount++;
          }
        });

        parsed.languageAnalysis.errors = allErrors;
        parsed.languageAnalysis.errorCount = deductionErrorCount;

        let deduction = 0;
        if (deductionErrorCount >= 6) {
          deduction = 2;
        } else if (deductionErrorCount >= 3) {
          deduction = 1;
        } else {
          deduction = 0;
        }
        parsed.languageAnalysis.deduction = deduction;

        // Base score determined by teacher's scale:
        // 2개 다 쓰면 4점, 둘 중 1개 쓰면 3점, 썼으나 이상하게 썼으면 2점, 미작성 1점
        const participleUsed = Boolean(parsed.languageAnalysis.participleUsed);
        const becauseUsed = Boolean(parsed.languageAnalysis.becauseUsed);
        let baseScore = 1;
        if (participleUsed && becauseUsed) {
          baseScore = 4;
        } else if (participleUsed || becauseUsed) {
          baseScore = 3;
        } else {
          // 본문을 썼으나 문법 형태가 어색/불완전하게 시도된 경우 2점, 완전 미작성은 1점
          const hasAttempt = rawText.length > 20 && !rawText.includes("백지 제출");
          baseScore = hasAttempt ? 2 : 1;
        }
        parsed.languageAnalysis.baseScore = baseScore;

        const finalLangScore = Math.max(1, Math.min(4, baseScore - deduction));
        parsed.languageAnalysis.finalLanguageScore = finalLangScore;
        scores.languageScore = finalLangScore;

        // Sanitize student feedback to ensure NO internal scoring text leaks to students
        if (parsed.studentFeedback) {
          const cleanText = (str: string) => {
            if (!str) return str;
            return str
              .replace(/\[채점\s*기준\][^\n.]*/g, "")
              .replace(/\(2점\)/g, "")
              .replace(/\(4점\)/g, "")
              .replace(/\(기본\s*\d점\)/g, "")
              .replace(/\d점\s*감점/g, "")
              .trim();
          };
          if (parsed.studentFeedback.goodPoints) {
            parsed.studentFeedback.goodPoints = cleanText(parsed.studentFeedback.goodPoints);
          }
          if (parsed.studentFeedback.nextStep) {
            parsed.studentFeedback.nextStep = cleanText(parsed.studentFeedback.nextStep);
          }
        }
      }

      // 2. Sentence count based objective scoring for body1 & body2 if counts provided
      if (parsed.sentenceCounts) {
        const b1 = parsed.sentenceCounts.body1SentenceCount;
        if (typeof b1 === "number") {
          scores.body1Score = b1 >= 3 ? 4 : b1 === 2 ? 3 : b1 === 1 ? 2 : 1;
        }
        const b2 = parsed.sentenceCounts.body2SentenceCount;
        if (typeof b2 === "number") {
          scores.body2Score = b2 >= 3 ? 4 : b2 === 2 ? 3 : b2 === 1 ? 2 : 1;
        }
      }

      // 3. Word count score
      if (typeof parsed.wordCount === "number") {
        const wc = parsed.wordCount;
        scores.wordCountScore = wc >= 80 ? 4 : wc >= 60 ? 3 : wc >= 1 ? 2 : 1;
      }

      // 4. Calculate total score correctly (16 points max, 4 points min)
      const computedTotal =
        (scores.body1Score || 1) +
        (scores.body2Score || 1) +
        (scores.languageScore || 1) +
        (scores.wordCountScore || 1);
      scores.totalScore = computedTotal;
      parsed.scores = scores;
    }

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error("Evaluation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "평가 처리 중 오류가 발생했습니다.",
    });
  }
});

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 로컬 개발 환경에서만 직접 listen 실행
  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

if (process.env.NODE_ENV !== "production") {
  setupVite().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;
