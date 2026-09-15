import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface RubricInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RubricInfoModal: React.FC<RubricInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                2026학년도 2학기 영어 쓰기 수행평가 채점 기준표 (총 16점 만점)
              </h3>
              <p className="text-xs text-rose-600 font-medium flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
                교사 전용 비공개 루브릭 (초안 점수 제외 · 학생 피드백지에는 점수 미노출)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-700">
          {/* Security Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="font-semibold block mb-0.5">채점 기준 및 보안 지침:</strong>
              초안 점수는 평가 항목에서 제외되었으며, <strong>본문1, 본문2, 언어형식, 단어수 (각 4점, 총 16점 만점)</strong> 4개 영역으로 자동 채점됩니다. 본 루브릭의 점수 수치는 <strong>교사용 시트(NEIS 입력용)</strong>에만 기록되며, <strong>학생용 피드백지</strong>에는 점수 대신 <strong>영역별 성취 별점, Good Points, Better Expressions, Next Step</strong>으로 격려형 피드백만 출력됩니다.
            </div>
          </div>

          {/* Rubric Items */}
          <div className="space-y-4">
            {/* 1. 본문 1 */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                <span className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                  <span>본문 1: 하는 일 및 특징 소개 (3문장 기준)</span>
                </span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                  배점: 4점 (기본점수 1점)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-indigo-700">4점 (충족)</div>
                  <div className="text-slate-500 mt-1">특징 및 하는 일을 3문장으로 구체적 설명</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">3점 (보통)</div>
                  <div className="text-slate-500 mt-1">특징 소개했으나 내용 일부 부족/근거 미흡</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">2점 (미흡)</div>
                  <div className="text-slate-500 mt-1">소개가 제한적이며 문장 수 부족 (1~2문장)</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-rose-600">1점 (기본)</div>
                  <div className="text-slate-500 mt-1">기본 내용만 소개 또는 백지 제출</div>
                </div>
              </div>
            </div>

            {/* 2. 본문 2 */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                <span className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                  <span>본문 2: 선정이유 및 배운 점 (3문장 기준)</span>
                </span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                  배점: 4점 (기본점수 1점)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-indigo-700">4점 (충족)</div>
                  <div className="text-slate-500 mt-1">이유/배운점을 3문장 정도로 구체적 제시</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">3점 (보통)</div>
                  <div className="text-slate-500 mt-1">대략적으로 제시, 근거 다소 단순</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">2점 (미흡)</div>
                  <div className="text-slate-500 mt-1">일부 누락되거나 내용이 제한적임</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-rose-600">1점 (기본)</div>
                  <div className="text-slate-500 mt-1">거의 제시하지 못함 또는 백지 제출</div>
                </div>
              </div>
            </div>

            {/* 3. 언어 형식 */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                <span className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                  <span>언어형식: 명사수식 분사(~ing/p.p.) & 접속사 because</span>
                </span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                  배점: 4점 (기본점수 1점)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-indigo-700">4점 (우수)</div>
                  <div className="text-slate-500 mt-1">명사수식 분사표현과 because 둘 다 바르게 사용</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">3점 (보통)</div>
                  <div className="text-slate-500 mt-1">분사 또는 because 중 하나만 바르게 사용</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">2점 (오류)</div>
                  <div className="text-slate-500 mt-1">쓰긴 썼으나 잘못 씀 (명사수식 아니거나 어법 오류)</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-rose-600">1점 (기본)</div>
                  <div className="text-slate-500 mt-1">둘 다 쓰지 않았거나 백지 제출</div>
                </div>
              </div>
            </div>

            {/* 4. 글의 구성 (단어 수) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                <span className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">4</span>
                  <span>글의 구성: 총 단어 수 기준</span>
                </span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                  배점: 4점 (분량 기준)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-indigo-700">4점 (완전 충족)</div>
                  <div className="text-slate-500 mt-1">80단어 이상 작성</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">3점 (근접)</div>
                  <div className="text-slate-500 mt-1">60~79단어 작성</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">2점 (미달)</div>
                  <div className="text-slate-500 mt-1">59단어 이하 작성</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="font-bold text-rose-600">1점 (백지)</div>
                  <div className="text-slate-500 mt-1">백지 제출</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
          >
            확인 완료
          </button>
        </div>
      </div>
    </div>
  );
};
