import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  FileSpreadsheet,
  FolderOpen,
  FileText,
  Printer,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const AppsScriptGuideView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  const appsScriptCode = `/**
 * ==============================================================================
 * [중학교 3학년 영어 쓰기 수행평가 자동 채점 & 피드백 시스템]
 * Google Apps Script 자동화 파이프라인 (Code.gs)
 * ==============================================================================
 * 
 * 기능:
 * 1. Google Drive의 '수행평가_스캔본' 폴더에서 학생 답안 이미지/PDF(최대 30명 묶음) 일괄 로드
 * 2. Gemini 3.8-flash API를 호출하여 16점 루브릭(초안점수 제외, 본문1 4점, 본문2 4점, 언어형식 4점, 단어수 4점) 정밀 채점
 * 3. 교사용 구글 스프레드시트에 학번, 16점 루브릭 점수, 단문 메모, 나이스(NEIS) 세특 자동 기재
 * 4. 학생용 개별 피드백지(A4 1장 이내 규격) Google Docs/PDF 자동 생성 (기준표 점수 비노출)
 */

// 1. 사용자 설정값 (선생님의 구글 드라이브 ID 및 API 키 입력)
const CONFIG = {
  GEMINI_API_KEY: '여기에_선생님의_GEMINI_API_KEY_입력',
  MODEL_NAME: 'gemini-3.8-flash',
  SCAN_FOLDER_ID: '여기에_스캔본_저장_구글드라이브_폴더_ID_입력',
  OUTPUT_FEEDBACK_FOLDER_ID: '여기에_학생용PDF_저장_구글드라이브_폴더_ID_입력',
  SHEET_NAME: '성적관리시트'
};

/**
 * 스프레드시트 열릴 때 커스텀 메뉴 추가
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤖 [수행평가 AI 채점]')
    .addItem('1. 스캔 답안지 일괄 자동 채점 실행 (최대 30명)', 'runBatchEvaluation')
    .addItem('2. 학생 피드백지 PDF 일괄 생성 (A4 1장)', 'generateAllStudentPdfs')
    .addToUi();
}

/**
 * 2. 메인 파이프라인: 스캔 답안지 일괄 채점
 */
function runBatchEvaluation() {
  const folder = DriveApp.getFolderById(CONFIG.SCAN_FOLDER_ID);
  const files = folder.getFiles();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // 교사용 시트 헤더 생성 (초안 점수 제외 16점 만점)
    sheet.appendRow([
      '파일명', '학년', '반', '번호', '이름',
      '본문1(4점)', '본문2(4점)', '언어형식(4점)', '단어수(4점)',
      '총점(16점)', '단어수', '핵심메모(교사용)', '나이스(NEIS)세특서술문', '채점시간'
    ]);
    sheet.getRange(1, 1, 1, 14).setBackground('#e0e7ff').setFontWeight('bold');
  }

  let count = 0;
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    // 이미 채점된 파일인지 검사
    const existing = sheet.getDataRange().getValues().map(row => row[0]);
    if (existing.includes(fileName)) {
      continue;
    }

    try {
      const mimeType = file.getMimeType();
      const base64Data = Utilities.base64Encode(file.getBlob().getBytes());
      
      // Gemini API 호출 및 16점 루브릭 채점 (초안 제외)
      const evalResult = callGeminiGrading(base64Data, mimeType, fileName);
      
      if (evalResult) {
        sheet.appendRow([
          fileName,
          evalResult.studentInfo.grade,
          evalResult.studentInfo.classNum,
          evalResult.studentInfo.studentNum,
          evalResult.studentInfo.name,
          evalResult.scores.body1Score,
          evalResult.scores.body2Score,
          evalResult.scores.languageScore,
          evalResult.scores.wordCountScore,
          evalResult.scores.totalScore,
          evalResult.wordCount,
          evalResult.teacherMemo,
          evalResult.neisNote,
          new Date()
        ]);
        count++;
      }
    } catch (err) {
      Logger.log('파일 채점 오류: ' + fileName + ' - ' + err.toString());
    }
  }

  SpreadsheetApp.getUi().alert('총 ' + count + '명의 답안지 채점이 완료되어 시트에 기록되었습니다.');
}

/**
 * 3. Gemini 3.8-flash API 호출 함수
 */
function callGeminiGrading(base64Data, mimeType, fileName) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.MODEL_NAME + ':generateContent?key=' + CONFIG.GEMINI_API_KEY;
  
  const systemInstruction = "너는 대한민국 중학교 3학년 영어 교사야. 제공된 16점 루브릭(초안점수는 제외, 본문1:하는일 4점, 본문2:이유/배운점 4점, 언어형식:명사수식분사 및 because 4점, 단어수 80단어이상4/60~79단어3/59이하2/백지1)에 맞춰 엄격히 채점해. 학생 피드백에는 절대 점수/감점 기준표가 노출되지 않아야 해.";

  const prompt = "답안지 이미지에서 학생 정보(학년, 반, 번호, 이름)와 영문 본문 텍스트를 OCR로 추출하고, 16점 만점 기준에 맞춰 교사용 점수와 학생용 피드백을 JSON으로 반환해 줘.";

  const payload = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.candidates && json.candidates[0].content.parts[0].text) {
    return JSON.parse(json.candidates[0].content.parts[0].text);
  }
  return null;
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Title */}
      <div>
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 mb-2">
          <Code className="w-3.5 h-3.5" />
          <span>선생님을 위한 클라우드 자동화 연동</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Google Apps Script (GAS) 자동화 파이프라인 가이드
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
          구글 드라이브에 학생들의 스캔 답안지를 넣기만 하면, <strong>Gemini API</strong>가 자동으로 OCR 판독 및 20점 루브릭 채점을 거쳐
          <strong>구글 시트(성적/NEIS)</strong>와 <strong>학생용 개별 피드백 문서</strong>를 자동 생성하는 엔드-투-엔드(End-to-End) 연동 체계입니다.
        </p>
      </div>

      {/* 3-Step Pipeline Architecture Graphic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs mb-3">
              1단계
            </div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <FolderOpen className="w-4 h-4 text-amber-600" />
              <span>구글 드라이브 스캔 폴더</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              복합기나 스마트폰으로 스캔한 학생들의 답안지(JPG/PDF)를 드라이브 폴더에 일괄 업로드합니다.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
            Drive Folder ➔ Trigger
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-xs flex flex-col justify-between bg-indigo-50/20">
          <div>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mb-3">
              2단계
            </div>
            <h3 className="font-bold text-sm text-indigo-950 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Gemini 3.8-flash 루브릭 채점</span>
            </h3>
            <p className="text-xs text-indigo-900/80 mt-2 leading-relaxed">
              Google Apps Script가 이미지를 전송하여 손글씨 OCR, 5대 세부 항목(초안4, 본문1 4, 본문2 4, 분사/because 4, 단어수 4)을 자동 채점합니다.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100 text-[11px] text-indigo-600 font-mono">
            Gemini Multimodal OCR
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs mb-3">
              3단계
            </div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>시트 기록 & 피드백지 출력</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              교사에게는 <strong>구글 시트(NEIS 세특)</strong>로 전송되고, 학생에게는 <strong>A4 1장 이내 개별 피드백지</strong>가 자동 인쇄됩니다.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-600 font-mono">
            Sheets + Docs Auto Merge
          </div>
        </div>
      </div>

      {/* Full Google Apps Script Code Block with Copy Button */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <span className="text-xs font-mono text-slate-300 ml-2">
              Google Apps Script: Code.gs (복사해서 붙여넣기)
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-indigo-200" />
                <span>코드 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>전체 코드 복사</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-5 text-xs font-mono text-slate-800 bg-slate-50 overflow-x-auto max-h-96 leading-relaxed">
          {appsScriptCode}
        </pre>
      </div>

      {/* 5-Minute Setup Manual Accordion */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span>학교 현장 5분 설정 가이드 (How-to-Setup)</span>
        </h3>

        <div className="space-y-3 text-xs text-slate-700">
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
            <div className="font-bold text-slate-900 mb-1">
              1. 구글 스프레드시트 생성 및 확장 프로그램 열기
            </div>
            <p className="text-slate-600">
              구글 드라이브에서 새 스프레드시트를 생성한 후, 상단 메뉴에서 <strong>[확장 프로그램] ➔ [Apps Script]</strong>를 클릭합니다.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
            <div className="font-bold text-slate-900 mb-1">
              2. 위의 Code.gs 복사 & CONFIG 설정
            </div>
            <p className="text-slate-600">
              위의 '전체 코드 복사' 버튼을 눌러 스크립트 편집기에 붙여넣고, 상단 <code className="bg-slate-200 px-1 py-0.5 rounded">CONFIG</code> 항목에 선생님의 
              <strong> GEMINI_API_KEY</strong>와 스캔 파일이 들어있는 <strong>구글 드라이브 폴더 ID</strong>를 입력합니다.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
            <div className="font-bold text-slate-900 mb-1">
              3. 스프레드시트 새로고침 및 원클릭 채점 실행
            </div>
            <p className="text-slate-600">
              스프레드시트를 새로고침하면 상단 메뉴바에 <strong>🤖 [수행평가 AI 채점]</strong> 메뉴가 자동으로 생성됩니다. 
              <strong>'1. 스캔 답안지 일괄 자동 채점 실행'</strong>을 클릭하면 모든 답안지가 20점 루브릭으로 자동 채점되어 표에 채워집니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
