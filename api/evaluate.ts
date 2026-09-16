import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, studentText, studentInfo } = req.body;

    if (!imageBase64 && typeof studentText !== 'string') {
      return res.status(400).json({
        error: '답안지 이미지/PDF 또는 텍스트 입력이 필요합니다.',
      });
    }

    // Direct instant return if purely empty/blank text is submitted
    if (!imageBase64 && (!studentText || !studentText.trim())) {
      const blankData = {
        studentInfo: {
          grade: studentInfo?.grade || '3',
          classNum: studentInfo?.classNum || '1',
          studentNum: studentInfo?.studentNum || '1',
          name: studentInfo?.name || '학생',
        },
        extractedText: '(본문 미작성 - 백지 제출)',
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
          body1Note: '본문1 미작성 (0문장 / 백지 1점)',
          body2Note: '본문2 미작성 (0문장 / 백지 1점)',
          languageNote: '본문 미작성으로 명사 수식 분사 및 because 미활용 (기본 1점)',
          wordCountNote: '0단어 (백지 제출: 1점)',
        },
        teacherMemo: '백지 제출 (본문1 0문장, 본문2 0문장, 필수 어법 미활용, 0단어 -> 최저 기본점수 4점 부여)',
        neisNote: '영어 쓰기 과제에 미응시/백지로 제출하여 기본적인 영작문 구성 및 핵심 어법 표현에 대한 추가적인 기초 지도가 요구됨.',
        studentFeedback: {
          achievementLevels: {
            contentRating: 1,
            contentStars: '★☆☆☆☆',
            languageRating: 1,
            languageStars: '★☆☆☆☆',
            volumeRating: 1,
            volumeStars: '★☆☆☆☆',
            wordCountNote: '0단어 (백지 제출)',
          },
          goodPoints: '답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 한 문장이라도 용기를 내어 작성해 보세요.',
          betterExpressions: [
            {
              original: '(본문 미작성)',
              improved: 'A doctor treating sick patients is a hero because she saves lives.',
              reason: '명사를 수식하는 분사(treating sick patients)와 이유의 접속사 because를 결합한 모범 예시입니다.',
            },
          ],
          nextStep: '수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요.',
        },
      };

      return res.status(200).json({
        success: true,
        data: blankData,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `너는 대한민국 중학교 3학년 영어 교사야. 아래 학생의 영어 쓰기 수행평가 답안(수행평가 주제: '숨은 영웅 소개하기', 총점 16점 만점)을 제공된 엄격한 객관적 루브릭에 맞춰 채점하고, 교사용 데이터와 학생용 피드백을 생성해 줘.
**초안 점수는 평가 항목에서 완전히 삭제/제외되었으므로 절대 채점하거나 점수에 포함하지 말 것.**

[채점 기준표 (총 16점 만점, 4개 항목 각 1~4점)]
1. 본문 1: 하는 일/특징 3문장 (1~4점):
   - 3문장 이상 작성: 4점
   - 2문장 작성: 3점
   - 1문장 작성: 2점
   - 0문장 / 미작성: 1점

2. 본문 2: 이유/배운 점 3문장 (1~4점):
   - 3문장 이상 작성: 4점
   - 2문장 작성: 3점
   - 1문장 작성: 2점
   - 0문장 / 미작성: 1점

3. 언어형식 (명사 수식 분사 표현 + 접속사 because, 기본 1~4점 및 어법 감점제):
   * 기본 점수 산출 (교사용 내부 기준):
     - 분사(~ing/p.p.)와 because 2가지를 모두 바르게 활용 시: 기본 4점
     - 둘 중 1가지만 활용 시: 기본 3점
     - 작성 및 시도하였으나 형태가 어색하거나 불완전한 경우: 기본 2점
     - 둘 다 미작성 또는 백지: 기본 1점
   * ★★★ [절대 감점 금지 항목 1: 대소문자 표기 오류 - 점수에 반영 금지!] ★★★
     - **문장 첫 글자 소문자, 고유명사 소문자, 1인칭 I 소문자 등 대소문자(Capitalization) 오류는 절대로 점수에서 감점하지 마(0점 감점)!**
     - 점수에 절대 반영하지 말고, languageAnalysis.errors에 기록하되 errorType: '대소문자 표기 안내', isDeducted: false 로 지정할 것.
   * ★★★ [절대 감점 금지 항목 2: 단어/어휘 선택 - 너무 가혹하므로 감점 금지!] ★★★
     - **어색한 단어 선택(Word Choice / Diction / Collocation)은 절대로 점수에서 감점하지 마(0점 감점, isDeducted: false)!**
     - 학생의 기를 꺾지 않도록 점수에는 일체 반영하지 말고, 대신 **[더 나은 표현으로 다듬기(Better Expressions)]**에 친절한 제안으로 추가해 줄 것! (예: hear music → listen to music, make happy → bring joy 등)
   * 감점 대상 오류(대소문자 및 단어선택 제외한 중대한 문법/구문 구조 오류에 한함):
     - 감점 대상 어법 오류 0~2개: 감점 없음 (0점 감점)
     - 감점 대상 어법 오류 3~5개: 1점 감점 (-1점 차감)
     - 감점 대상 오류 6개 이상: 2점 감점 (-2점 차감)
   * 최종 점수 = Math.max(1, 기본 점수 - 감점)

4. 글의 구성 (단어 수 기준, 1~4점):
   - 80단어 이상: 4점 / 60~79단어: 3점 / 59단어 이하: 2점 / 백지: 1점

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
- 굳이 밝힐 필요가 없으므로 학생용 피드백에는 오직 학생의 성장을 돕는 다정하고 격려하는 피드백(영역별 별점, 칭찬, Better Expressions, Next Step)만 제공할 것.`;

    const contents: any[] = [];

    if (imageBase64 && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      });
    }

    let userPrompt = `다음 학생의 답안을 분석하고 16점 객관적 루브릭에 맞춰 채점해 줘.

★★★ [초중요 OCR 판독 지침: 인쇄된 시험지 양식 문구와 학생의 손글씨 답안 엄격 구분] ★★★
1. 시험지/학습지 양식에 미리 인쇄된 컴퓨터 활자체(폰트) 문구는 절대 학생이 쓴 답안이 아닙니다!
   - 예: 'Example:', 'street cleaner', 'My Hidden Hero', 'Title:', 'firefighter', 'nurse', 문제 안내문, 보기 단어 상자 등
   - 인쇄된 문제지 텍스트는 학생의 본문 텍스트(extractedText)에 절대 포함해서는 안 됩니다!
2. **오직 학생이 필기구(연필, 샤프, 볼펜)로 직접 손글씨(Handwriting)로 작성한 영문 문장만 인식**하여 추출(OCR)해 줘.
3. **학생의 손글씨 작성란(줄공책 라인, 네모 본문 작성 칸)에 학생이 직접 쓴 손글씨가 없거나 비어 있는 경우:**
   - **이것은 100% '백지 제출'입니다!** 인쇄된 예시 단어(예: 'street cleaner')를 학생이 쓴 것으로 착각하여 단어 수나 문장으로 카운트하거나 피드백을 주면 치명적인 오류입니다.
   - 백지 제출 시에는:
     * extractedText: "(본문 미작성 - 백지 제출)"
     * wordCount: 0
     * sentenceCounts: { body1SentenceCount: 0, body2SentenceCount: 0 }
     * scores: { body1Score: 1, body2Score: 1, languageScore: 1, wordCountScore: 1, totalScore: 4 } (최저 기본점수 정확히 4점!)
     * languageAnalysis: { participleUsed: false, becauseUsed: false, baseScore: 1, errorCount: 0, deduction: 0, finalLanguageScore: 1, errors: [] }
     * studentFeedback:
       - achievementLevels: { contentRating: 1, contentStars: "★☆☆☆☆", languageRating: 1, languageStars: "★☆☆☆☆", volumeRating: 1, volumeStars: "★☆☆☆☆", wordCountNote: "0단어 (백지 제출)" }
       - goodPoints: "답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 활용하여 한 문장이라도 용기를 내어 작성해 보세요."
       - betterExpressions: [{ original: "(본문 미작성)", improved: "A doctor treating sick patients is a hero because she saves lives.", reason: "명사를 수식하는 분사와 접속사 because를 결합한 모범 예문입니다." }]
       - nextStep: "수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요."

- 작성된 학생 답안이 있는 경우 채점 기준:
  * 본문 1 & 본문 2: 작성된 문장 수 기준 (3문장: 4점 / 2문장: 3점 / 1문장: 2점 / 0문장: 1점)
  * 언어형식: 분사 표현과 because 둘 다 바르게 쓰면 기본 4점, 둘 중 하나만 쓰면 기본 3점, 시도하였으나 어색하면 2점, 미작성 1점
  * [필수] 대소문자 표기 오류는 점수 감점 대상에서 완전히 제외(0점 감점, 점수에 반영 금지)!
  * [필수] 단어/어휘 선택(Word Choice)은 점수 감점 대상에서 완전히 제외(0점 감점, Better Expressions로 제안)!
  * 중대한 문법 오류 0~2개 0점 감점, 3~5개 1점 감점, 6개 이상 2점 감점
  * 글의 구성: 80단어 이상 4점, 60~79단어 3점, 59단어 이하 2점, 백지 1점
- 학생용 피드백에는 [채점 기준], 점수, 감점 산정 공식, 2점/4점 기준 등을 절대 노출하지 말 것.\n`;
    if (studentText) {
      userPrompt += `[학생 답안 텍스트]:\n"""\n${studentText}\n"""\n`;
    }
    if (studentInfo) {
      userPrompt += `[제공된 학생 정보]: 학년: ${studentInfo.grade || '3'}, 반: ${studentInfo.classNum || ''}, 번호: ${studentInfo.studentNum || ''}, 이름: ${studentInfo.name || ''}\n`;
    }
    userPrompt += `스캔본 이미지가 있다면 상단의 학년, 반, 번호, 이름 및 학생이 손으로 쓴 본문 텍스트를 정확하게 OCR하여 전사해 줘.`;

    contents.push({ text: userPrompt });

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash'];
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
        responseMimeType: 'application/json',
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
              required: ['grade', 'classNum', 'studentNum', 'name'],
            },
            extractedText: { type: Type.STRING },
            wordCount: { type: Type.INTEGER },
            sentenceCounts: {
              type: Type.OBJECT,
              properties: {
                body1SentenceCount: { type: Type.INTEGER },
                body2SentenceCount: { type: Type.INTEGER },
              },
              required: ['body1SentenceCount', 'body2SentenceCount'],
            },
            languageAnalysis: {
              type: Type.OBJECT,
              properties: {
                participleUsed: { type: Type.BOOLEAN },
                becauseUsed: { type: Type.BOOLEAN },
                baseScore: { type: Type.INTEGER },
                errorCount: { type: Type.INTEGER },
                deduction: { type: Type.INTEGER },
                finalLanguageScore: { type: Type.INTEGER },
                errors: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      errorType: { type: Type.STRING },
                      correction: { type: Type.STRING },
                      isDeducted: { type: Type.BOOLEAN },
                    },
                    required: ['text', 'errorType', 'correction', 'isDeducted'],
                  },
                },
              },
              required: [
                'participleUsed',
                'becauseUsed',
                'baseScore',
                'errorCount',
                'deduction',
                'finalLanguageScore',
                'errors',
              ],
            },
            scores: {
              type: Type.OBJECT,
              properties: {
                body1Score: { type: Type.INTEGER },
                body2Score: { type: Type.INTEGER },
                languageScore: { type: Type.INTEGER },
                wordCountScore: { type: Type.INTEGER },
                totalScore: { type: Type.INTEGER },
              },
              required: [
                'body1Score',
                'body2Score',
                'languageScore',
                'wordCountScore',
                'totalScore',
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
              required: ['body1Note', 'body2Note', 'languageNote', 'wordCountNote'],
            },
            teacherMemo: { type: Type.STRING },
            neisNote: { type: Type.STRING },
            studentFeedback: {
              type: Type.OBJECT,
              properties: {
                achievementLevels: {
                  type: Type.OBJECT,
                  properties: {
                    contentRating: { type: Type.INTEGER },
                    contentStars: { type: Type.STRING },
                    languageRating: { type: Type.INTEGER },
                    languageStars: { type: Type.STRING },
                    volumeRating: { type: Type.INTEGER },
                    volumeStars: { type: Type.STRING },
                    wordCountNote: { type: Type.STRING },
                  },
                  required: [
                    'contentRating',
                    'contentStars',
                    'languageRating',
                    'languageStars',
                    'volumeRating',
                    'volumeStars',
                    'wordCountNote',
                  ],
                },
                goodPoints: { type: Type.STRING },
                betterExpressions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      original: { type: Type.STRING },
                      improved: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['original', 'improved'],
                  },
                },
                nextStep: { type: Type.STRING },
              },
              required: ['achievementLevels', 'goodPoints', 'betterExpressions', 'nextStep'],
            },
          },
          required: [
            'studentInfo',
            'extractedText',
            'wordCount',
            'scores',
            'rubricNotes',
            'teacherMemo',
            'neisNote',
            'studentFeedback',
          ],
        },
      },
    });

          if (response && response.text) break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`Attempt ${attempt} with ${model} failed:`, err?.message || err);
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      if (response && response.text) break;
    }

    if (!response || !response.text) {
      throw lastErr || new Error('Gemini API 호출에 실패했습니다. 다시 시도해 주세요.');
    }

    const parsed = JSON.parse(response.text || '{}');

    // Check if the student's submission is blank / unwritten / only contains printed template noise
    const rawText = (parsed.extractedText || studentText || '').trim();
    const lowerRaw = rawText.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const englishWords = rawText.match(/[a-zA-Z]{2,}/g) || [];

    // Common printed worksheet headers, topics, or example phrases:
    const templateFragments = [
      'street cleaner',
      'a street cleaner',
      'my hidden hero',
      'hidden hero',
      'example',
      'firefighter',
      'cleaner',
      'nurse',
    ];

    const isTemplateOnly =
      templateFragments.some((tf) => lowerRaw === tf || lowerRaw === `a ${tf}`) ||
      (englishWords.length <= 8 && templateFragments.some((tf) => lowerRaw.includes(tf)));

    // Sentence count check: If 0 sentences in both body 1 and body 2, student wrote no essay
    const sCounts = parsed.sentenceCounts || { body1SentenceCount: 0, body2SentenceCount: 0 };
    const totalSentences = (sCounts.body1SentenceCount || 0) + (sCounts.body2SentenceCount || 0);

    const isExplicitBlank =
      !rawText ||
      rawText === '(본문 미작성)' ||
      rawText.includes('백지 제출') ||
      rawText.includes('본문 미작성') ||
      (typeof parsed.wordCount === 'number' && parsed.wordCount === 0) ||
      englishWords.length <= 6 ||
      isTemplateOnly ||
      totalSentences === 0;

    if (isExplicitBlank) {
      parsed.extractedText = '(본문 미작성 - 백지 제출)';
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
        body1Note: '본문1 미작성 (0문장 / 백지 1점)',
        body2Note: '본문2 미작성 (0문장 / 백지 1점)',
        languageNote: '본문 미작성으로 명사 수식 분사 및 because 미활용 (기본 1점)',
        wordCountNote: '0단어 (백지 제출: 1점)',
      };
      parsed.teacherMemo = '백지 제출 (본문1 0문장, 본문2 0문장, 필수 어법 미활용, 0단어 -> 최저 기본점수 4점 부여)';
      parsed.neisNote = '영어 쓰기 과제에 미응시/백지로 제출하여 기본적인 영작문 구성 및 핵심 어법 표현에 대한 추가적인 기초 지도가 요구됨.';
      parsed.studentFeedback = {
        achievementLevels: {
          contentRating: 1,
          contentStars: '★☆☆☆☆',
          languageRating: 1,
          languageStars: '★☆☆☆☆',
          volumeRating: 1,
          volumeStars: '★☆☆☆☆',
          wordCountNote: '0단어 (백지 제출)',
        },
        goodPoints: '답안지에 작성된 본문 내용이 없습니다 (백지 제출). 다음 수행평가에서는 배운 핵심 표현을 한 문장이라도 용기를 내어 작성해 보세요.',
        betterExpressions: [
          {
            original: '(본문 미작성)',
            improved: 'A doctor treating sick patients is a hero because she saves lives.',
            reason: '명사를 수식하는 분사(treating sick patients)와 이유의 접속사 because를 결합한 모범 예시입니다.',
          },
        ],
        nextStep: '수업 시간에 배운 명사 수식 분사(~ing) 표현과 이유의 접속사 because를 활용하여 기본 문장 쓰기 연습부터 차근차근 시작해 보세요.',
      };
    } else {
      // 점수 재검증 로직
      const scores = parsed.scores || {
        body1Score: 4,
        body2Score: 4,
        languageScore: 4,
        wordCountScore: 4,
        totalScore: 16,
      };

      // 언어형식 검증: 대소문자 및 단어 선택은 감점 대상에서 완전히 제외하고 피드백으로만 제공
      if (parsed.languageAnalysis) {
        const allErrors = Array.isArray(parsed.languageAnalysis.errors)
          ? parsed.languageAnalysis.errors
          : [];

        let deductionErrorCount = 0;
        allErrors.forEach((err: any) => {
          const errorTypeStr = String(err.errorType || '').toLowerCase();
          const reasonStr = String(err.reason || '').toLowerCase();
          const textStr = String(err.text || '').trim();
          const corrStr = String(err.correction || '').trim();

          // 1. 대소문자 오류 판별 (점수에 반영 금지, 감점 절대 제외)
          const isCapitalization =
            err.isDeducted === false ||
            errorTypeStr.includes('대소문자') ||
            errorTypeStr.includes('capital') ||
            errorTypeStr.includes('case') ||
            errorTypeStr.includes('대문자') ||
            errorTypeStr.includes('소문자') ||
            reasonStr.includes('대소문자') ||
            reasonStr.includes('대문자') ||
            reasonStr.includes('소문자') ||
            reasonStr.includes('첫 글자') ||
            reasonStr.includes('첫글자') ||
            reasonStr.includes('capital') ||
            (textStr.toLowerCase() === corrStr.toLowerCase() && textStr !== corrStr);

          // 2. 단어/어휘 선택 판별 (너무 가혹하므로 감점 금지, Better Expressions로 제안)
          const isWordChoice =
            errorTypeStr.includes('단어') ||
            errorTypeStr.includes('어휘') ||
            errorTypeStr.includes('word') ||
            errorTypeStr.includes('diction') ||
            errorTypeStr.includes('collocation') ||
            errorTypeStr.includes('표현') ||
            errorTypeStr.includes('선택') ||
            reasonStr.includes('단어 선택') ||
            reasonStr.includes('어휘') ||
            reasonStr.includes('단어선택') ||
            reasonStr.includes('어색') ||
            reasonStr.includes('더 자연스러운') ||
            reasonStr.includes('표현 제안') ||
            reasonStr.includes('word choice') ||
            reasonStr.includes('collocation');

          if (isCapitalization) {
            err.isDeducted = false;
            err.errorType = '대소문자 표기 안내';
          } else if (isWordChoice) {
            err.isDeducted = false;
            err.errorType = '단어/어휘 선택 제안';
            // Better Expressions에 추가
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
                  reason: err.reason || '보다 자연스러운 단어 및 표현 선택 제안 (감점 없음)',
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

        // Base score: 2개 다 쓰면 4점, 1개 쓰면 3점, 썼으나 이상하게 썼으면 2점, 미작성 1점
        const participleUsed = Boolean(parsed.languageAnalysis.participleUsed);
        const becauseUsed = Boolean(parsed.languageAnalysis.becauseUsed);
        let baseScore = 1;
        if (participleUsed && becauseUsed) {
          baseScore = 4;
        } else if (participleUsed || becauseUsed) {
          baseScore = 3;
        } else {
          const hasAttempt = rawText.length > 20 && !rawText.includes('백지 제출');
          baseScore = hasAttempt ? 2 : 1;
        }
        parsed.languageAnalysis.baseScore = baseScore;

        scores.languageScore = Math.max(1, Math.min(4, baseScore - deduction));
        parsed.languageAnalysis.finalLanguageScore = scores.languageScore;

        // Clean any leaked rubric criteria text from student feedback
        if (parsed.studentFeedback) {
          const cleanText = (str: string) => {
            if (!str) return str;
            return str
              .replace(/\[채점\s*기준\][^\n.]*/g, '')
              .replace(/\(2점\)/g, '')
              .replace(/\(4점\)/g, '')
              .replace(/\(기본\s*\d점\)/g, '')
              .replace(/\d점\s*감점/g, '')
              .replace(/문장의 첫 글자 대소문자나 더 자연스러운 단어 선택[^.]*점수에 반영되지 않습니다\.?/g, '')
              .replace(/학생의 기를 살리고 배움을 돕기 위한 추천 제안이며 점수에 반영되지 않습니다\.?/g, '')
              .replace(/💡?\s*어법 및 단어 배움 팁:?[^\n.]*/g, '')
              .trim();
          };
          if (parsed.studentFeedback.goodPoints) {
            parsed.studentFeedback.goodPoints = cleanText(parsed.studentFeedback.goodPoints);
          }
          if (parsed.studentFeedback.nextStep) {
            parsed.studentFeedback.nextStep = cleanText(parsed.studentFeedback.nextStep);
          }
          if (Array.isArray(parsed.studentFeedback.betterExpressions)) {
            parsed.studentFeedback.betterExpressions.forEach((be: any) => {
              if (be.reason) be.reason = cleanText(be.reason);
            });
          }
        }
      } else {
        scores.languageScore = 1;
      }

      if (parsed.sentenceCounts) {
        const b1 = parsed.sentenceCounts.body1SentenceCount;
        if (typeof b1 === 'number') {
          scores.body1Score = b1 >= 3 ? 4 : b1 === 2 ? 3 : b1 === 1 ? 2 : 1;
        }
        const b2 = parsed.sentenceCounts.body2SentenceCount;
        if (typeof b2 === 'number') {
          scores.body2Score = b2 >= 3 ? 4 : b2 === 2 ? 3 : b2 === 1 ? 2 : 1;
        }
      }

      if (typeof parsed.wordCount === 'number') {
        const wc = parsed.wordCount;
        scores.wordCountScore = wc >= 80 ? 4 : wc >= 60 ? 3 : wc >= 1 ? 2 : 1;
      }

      scores.totalScore =
        (scores.body1Score || 1) +
        (scores.body2Score || 1) +
        (scores.languageScore || 1) +
        (scores.wordCountScore || 1);
      parsed.scores = scores;
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message || '평가 처리 오류' });
  }
}
