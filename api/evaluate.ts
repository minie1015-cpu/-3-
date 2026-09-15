import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, studentText, studentInfo } = req.body;

    if (!imageBase64 && !studentText) {
      return res.status(400).json({
        error: '답안지 이미지/PDF 또는 텍스트 입력이 필요합니다.',
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

3. 언어형식 (명사 수식 분사 표현 + 접속사 because, 기본 4점 및 문법 오류 감점제, 1~4점):
   * 기본 점수 산출: 명사수식 분사(2점) + because(2점) = 기본 4점 (하나만 사용 시 2점, 둘 다 미사용 시 1점)
   * 오류 감점: 0~2개 감점 없음, 3~5개 1점 감점, 6개 이상 2점 감점
   * 최종 점수 = Math.max(1, 기본 점수 - 감점)

4. 글의 구성 (단어 수 기준, 1~4점):
   - 80단어 이상: 4점 / 60~79단어: 3점 / 59단어 이하: 2점 / 백지: 1점

[보안 지침]
- 학생용 피드백에는 점수 수치나 감점 내역을 절대 노출하지 말 것. 별점(★)과 다정한 칭찬 및 교정 제안으로 구성할 것.`;

    const contents: any[] = [];

    if (imageBase64 && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      });
    }

    let userPrompt = `다음 학생의 답안을 분석하고 16점 객관적 루브릭에 맞춰 채점해 줘.\n`;
    if (studentText) {
      userPrompt += `[학생 답안 텍스트]:\n"""\n${studentText}\n"""\n`;
    }
    if (studentInfo) {
      userPrompt += `[제공된 학생 정보]: 학년: ${studentInfo.grade || '3'}, 반: ${studentInfo.classNum || ''}, 번호: ${studentInfo.studentNum || ''}, 이름: ${studentInfo.name || ''}\n`;
    }
    userPrompt += `스캔본 이미지가 있다면 상단의 학년, 반, 번호, 이름 및 학생이 손으로 쓴 본문 텍스트를 정확하게 OCR하여 전사해 줘.`;

    contents.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
                    },
                    required: ['text', 'errorType', 'correction'],
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

    const parsed = JSON.parse(response.text || '{}');

    // 점수 재검증 로직
    const scores = parsed.scores || {};
    const b1 = parsed.sentenceCounts?.body1SentenceCount ?? 3;
    scores.body1Score = b1 >= 3 ? 4 : b1 === 2 ? 3 : b1 === 1 ? 2 : 1;

    const b2 = parsed.sentenceCounts?.body2SentenceCount ?? 3;
    scores.body2Score = b2 >= 3 ? 4 : b2 === 2 ? 3 : b2 === 1 ? 2 : 1;

    const wc = parsed.wordCount ?? 80;
    scores.wordCountScore = wc >= 80 ? 4 : wc >= 60 ? 3 : wc >= 1 ? 2 : 1;

    const errorCount = parsed.languageAnalysis?.errors?.length ?? 0;
    const deduction = errorCount >= 6 ? 2 : errorCount >= 3 ? 1 : 0;
    const baseScore = parsed.languageAnalysis?.baseScore || 4;
    scores.languageScore = Math.max(1, Math.min(4, baseScore - deduction));

    scores.totalScore =
      scores.body1Score + scores.body2Score + scores.languageScore + scores.wordCountScore;
    parsed.scores = scores;

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message || '평가 처리 오류' });
  }
}
