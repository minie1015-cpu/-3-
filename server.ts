import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Evaluate endpoint
app.post("/api/evaluate", async (req, res) => {
  try {
    const { imageBase64, mimeType, studentText, studentInfo } = req.body;

    if (!imageBase64 && !studentText) {
      return res.status(400).json({
        error: "답안지 이미지/PDF 또는 텍스트 입력이 필요합니다.",
      });
    }

    const ai = getGeminiClient();

    const systemInstruction = `너는 대한민국 중학교 3학년 영어 교사야. 
아래 학생의 영어 쓰기 수행평가 답안(수행평가 주제: '숨은 영웅 소개하기', 총점 16점 만점)을 제공된 엄격한 객관적 루브릭에 맞춰 채점하고, 교사용 데이터와 학생용 피드백을 생성해 줘.
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

3. 언어형식 (명사 수식 분사 표현 + 접속사 because, 기본 4점 및 문법 오류 감점제, 1~4점):
   * 기본 점수 산출:
     - 명사를 수식하는 분사 표현(~ing, p.p. 형태) 사용 (2점)
     - 접속사 because 사용 (2점)
     - 분사(2점)와 because(2점) 사용 시 기본 4점을 부여함 (하나만 사용 시 기본 2점, 둘 다 미사용 시 기본 1점)
   * 어법/문법 오류 감점 기준 (대소문자 제외, 철자 오류, 전치사 누락/오용, 수일치 불일치, 동사 누락, 품사 오용 등):
     - 오류 0~2개: 감점 없음 (4점 유지)
     - 오류 3~5개: 1점 감점 (1점 차감)
     - 오류 6개 이상: 2점 감점 (2점 차감)
   * 최종 언어형식 점수 = Math.max(1, 기본 점수 - 감점)
   * 반드시 본문에서 발견된 모든 문법/어휘 오류의 목록(오류 어구, 오류 종류, 올바른 교정)을 languageAnalysis.errors에 상세히 기재하고 오류 개수(errorCount)를 셀 것!

4. 글의 구성 (단어 수 기준, 1~4점):
   - 80단어 이상: 4점
   - 60~79단어: 3점
   - 59단어 이하: 2점
   - 백지 제출: 1점

[중요 보안/가림 지침]
- **학생들에게는 이 채점 기준표(감점 요인, 1점~4점 점수 수치, 어법 오류 감점 내역)가 절대 보여지면 안 됨!**
- 학생용 피드백은 학생의 자존감을 높이고 자기주도적 성장을 이끌 수 있도록 다정하고 친절한 어조로 작성할 것.
- 학생용 피드백에는:
  1) 영역별 성취 수준:
     - 내용 구성 (영웅 특징 및 이유): 별점 1~5점 (예: ★★★★☆)
     - 언어 형식 (분사 표현, 접속사 because): 별점 1~5점
     - 분량 및 어휘: 별점 1~5점, 단어 수 표기 (예: ★★★★☆ (총 75단어))
  2) 잘한 점 (Good Points): 학생이 잘 쓴 문장이나 참신한 표현, 진정성 있는 태도 칭찬
  3) 더 나은 표현으로 다듬기 (Better Expressions): 어색한 문장 2~4개를 골라 [원문] → [수정] 및 친절한 교정 이유 제시
  4) 쓰기 발전 방향 (Next Step): 중3 수준에 맞는 앞으로의 글쓰기 팁 (분사구문 활용, 접속사 다양화, 수일치 주의 등)

[교사용 데이터 지침]
- 학생 기본 정보(학년, 반, 번호, 이름) 추출(스캔본 상단에 있으면 추출, 없으면 입력값 사용)
- 항목별 점수 수치(본문1 1~4, 본문2 1~4, 언어형식 1~4, 단어수 1~4, 총점 4~16)
- sentenceCounts: 본문1 문장 수, 본문2 문장 수
- languageAnalysis: participleUsed, becauseUsed, baseScore, errorCount, deduction, finalLanguageScore, errors
- 단문 메모: 교사가 성적 확인 시 한눈에 파악할 수 있는 요약 (예: "하는일 2문장(3점), 이유 1문장(2점), 오류 8개 검출 2점감점(2점), 47단어(2점) -> 총점 9점")
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
- 언어형식(4점 만점)은 분사(2점)와 because(2점) 사용 시 기본 4점을 부여하되, 본문의 문법 오류(전치사 누락, 수일치 불일치, 동사 누락, 철자 오류 등 대소문자 제외) 개수를 세어 3~5개는 1점 감점, 6개 이상은 2점을 감점하여 최종 언어형식 점수를 산출해 줘. (오류 항목들을 languageAnalysis.errors에 상세히 나열할 것)
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

    // Try primary and fallback models with retries
    const candidateModels = [
      "gemini-3.5-flash-lite",
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
                            errorType: { type: Type.STRING, description: "오류 유형 (철자, 전치사, 수일치, 동사누락 등)" },
                            correction: { type: Type.STRING, description: "올바른 수정 제안" },
                          },
                          required: ["text", "errorType", "correction"],
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

    // Calculate/validate scores strictly according to the 16-point rubric rules
    const scores = parsed.scores || {
      body1Score: 4,
      body2Score: 4,
      languageScore: 4,
      wordCountScore: 4,
      totalScore: 16,
    };

    // 1. Language score validation with error deduction logic
    if (parsed.languageAnalysis) {
      const errorCount =
        parsed.languageAnalysis.errors?.length ??
        parsed.languageAnalysis.errorCount ??
        0;
      parsed.languageAnalysis.errorCount = errorCount;

      let deduction = 0;
      if (errorCount >= 6) {
        deduction = 2;
      } else if (errorCount >= 3) {
        deduction = 1;
      } else {
        deduction = 0;
      }
      parsed.languageAnalysis.deduction = deduction;

      const baseScore = parsed.languageAnalysis.baseScore || 4;
      const finalLangScore = Math.max(1, Math.min(4, baseScore - deduction));
      parsed.languageAnalysis.finalLanguageScore = finalLangScore;
      scores.languageScore = finalLangScore;
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
app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 로컬 개발 환경에서만 직접 listen 실행
  if (process.env.NODE_ENV !== "production") {
    const PORT = process.env.PORT || 3000;
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
