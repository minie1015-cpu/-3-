import React, { useState } from 'react';
import {
  Printer,
  Check,
  Edit2,
  Users,
  ShieldCheck,
  FileCheck2,
  Download,
} from 'lucide-react';
import { EvaluationRecord } from '../types';

interface StudentPrintViewProps {
  records: EvaluationRecord[];
  selectedId: string | null;
  onSelectStudent: (id: string) => void;
  onUpdateRecord: (record: EvaluationRecord) => void;
}

export const StudentPrintView: React.FC<StudentPrintViewProps> = ({
  records,
  selectedId,
  onSelectStudent,
  onUpdateRecord,
}) => {
  // 'single' = print only selected student, 'all' = batch print all students
  const [printScope, setPrintScope] = useState<'single' | 'all'>('single');
  // Edit mode for personalizing feedback before print
  const [isEditing, setIsEditing] = useState(false);

  const currentRecord =
    records.find((r) => r.id === selectedId) || records[0] || null;

  // Editable local state
  const [goodPoints, setGoodPoints] = useState(currentRecord?.studentFeedback.goodPoints || '');
  const [nextStep, setNextStep] = useState(currentRecord?.studentFeedback.nextStep || '');

  // Synchronize when currentRecord changes
  React.useEffect(() => {
    if (currentRecord) {
      setGoodPoints(currentRecord.studentFeedback.goodPoints);
      setNextStep(currentRecord.studentFeedback.nextStep);
    }
  }, [currentRecord?.id]);

  const handleSaveFeedbackEdits = () => {
    if (!currentRecord) return;
    const updated: EvaluationRecord = {
      ...currentRecord,
      studentFeedback: {
        ...currentRecord.studentFeedback,
        goodPoints,
        nextStep,
      },
    };
    onUpdateRecord(updated);
    setIsEditing(false);
  };

  const handleTriggerBrowserPrint = () => {
    window.print();
  };

  if (!currentRecord) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-slate-500">
        채점된 학생 데이터가 없습니다. 먼저 학생 답안을 채점해 주세요.
      </div>
    );
  }

  // Determine students to render for printing
  const studentsToRender = printScope === 'all' ? records : [currentRecord];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Toolbar (Hidden during print) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {/* Left: Student Selector */}
        <div className="flex items-center space-x-3">
          <div className="text-xs font-semibold text-slate-700">대상 학생:</div>
          <select
            value={currentRecord.id}
            onChange={(e) => onSelectStudent(e.target.value)}
            className="text-xs font-bold py-1.5 px-3 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.studentInfo.grade}학년 {r.studentInfo.classNum}반 {r.studentInfo.studentNum}번{' '}
                {r.studentInfo.name} ({r.wordCount}단어)
              </option>
            ))}
          </select>
        </div>

        {/* Center: Print Scope Controls & Format Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            A4 1장 전면 출력 규격 (1학생 1페이지 완결)
          </span>

          {/* Print Scope */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setPrintScope('single')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                printScope === 'single'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              현재 학생만
            </button>
            <button
              onClick={() => setPrintScope('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                printScope === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 학급 일괄 ({records.length}명)
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 border ${
              isEditing
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? '수정 취소' : '피드백 문구 편집'}</span>
          </button>

          <button
            id="print-feedback-btn"
            onClick={handleTriggerBrowserPrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm active:scale-[0.99]"
          >
            <Printer className="w-4 h-4" />
            <span>
              {printScope === 'all'
                ? `전체 학급 일괄 인쇄 (${records.length}명)`
                : `${currentRecord.studentInfo.name} 피드백지 인쇄`}
            </span>
          </button>
        </div>
      </div>

      {/* Security Banner: Confirms student privacy */}
      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>보안 필터 작동 중:</strong> 채점 기준표(감점 요인, 1~4점 수치)가 학생용 출력지에는 전혀 노출되지 않으며, 친절한 별점 성취도와 구체적인 교정 문장으로만 구성되어 <strong>A4 1장 이내</strong>로 깔끔하게 인쇄됩니다.
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
          루브릭 수치 비노출 보장
        </span>
      </div>

      {/* Inline Feedback Edit Box (Teacher can fine-tune text before printing) */}
      {isEditing && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3 print:hidden animate-fadeIn">
          <h4 className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
            <Edit2 className="w-3.5 h-3.5" />
            <span>{currentRecord.studentInfo.name} 학생 피드백지 맞춤 편집</span>
          </h4>
          <div>
            <label className="block text-[11px] font-bold text-indigo-950 mb-1">
              ■ 잘한 점 (Good Points):
            </label>
            <textarea
              rows={2}
              value={goodPoints}
              onChange={(e) => setGoodPoints(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-950 mb-1">
              ■ 쓰기 발전 방향 (Next Step):
            </label>
            <textarea
              rows={2}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleSaveFeedbackEdits}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>적용 및 저장</span>
            </button>
          </div>
        </div>
      )}

      {/* Printable Sheet Container - Exactly 1 A4 Page per Student */}
      <div id="printable-area" className="space-y-8 print:space-y-0">
        {studentsToRender.map((student) => (
          <div
            key={student.id}
            className="a4-feedback-sheet bg-white border-2 border-slate-800 rounded-2xl shadow-xs print:shadow-none print:border-2 print:border-black p-6 sm:p-7 transition-all max-w-3xl mx-auto print:max-w-none print:w-full print:rounded-none print:p-6 print:break-after-page"
          >
            {/* 1. Header Box */}
            <div className="border-b-2 border-slate-800 pb-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  [2026학년도 2학기 영어 쓰기 수행평가 개별 피드백지]
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 border border-slate-800 rounded">
                  성장 중심 평가
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800">
                <div className="space-x-3">
                  <span>{student.studentInfo.grade}학년</span>
                  <span>{student.studentInfo.classNum}반</span>
                  <span>{student.studentInfo.studentNum}번</span>
                  <span className="text-indigo-900 text-sm font-black border-b-2 border-indigo-900 pb-0.5">
                    이름: {student.studentInfo.name}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  과제: 숨은 영웅 소개하기 (My Hidden Hero)
                </div>
              </div>
            </div>

            {/* 2. 영역별 성취 수준 (별점 / qualitative stars) */}
            <div className="mb-4">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>영역별 성취 수준</span>
              </div>
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm space-y-2 text-slate-800">
                <div className="flex items-center justify-between">
                  <span>• 내용 구성 (영웅 특징 및 선정 이유):</span>
                  <span className="font-mono text-amber-500 font-bold tracking-wider text-sm">
                    {student.studentFeedback.achievementLevels.contentStars}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>• 언어 형식 (분사 표현, 접속사 because):</span>
                  <span className="font-mono text-amber-500 font-bold tracking-wider text-sm">
                    {student.studentFeedback.achievementLevels.languageStars}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>• 분량 및 어휘:</span>
                  <div className="space-x-2">
                    <span className="font-mono text-amber-500 font-bold tracking-wider text-sm">
                      {student.studentFeedback.achievementLevels.volumeStars}
                    </span>
                    <span className="text-slate-600 text-xs font-semibold">
                      ({student.studentFeedback.achievementLevels.wordCountNote})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 잘한 점 (Good Points) */}
            <div className="mb-4">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>잘한 점 (Good Points)</span>
              </div>
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
                {student.studentFeedback.goodPoints}
              </div>
            </div>

            {/* 4. 더 나은 표현으로 다듬기 (Better Expressions) */}
            <div className="mb-4">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>더 나은 표현으로 다듬기 (Better Expressions)</span>
              </div>
              <div className="space-y-2">
                {student.studentFeedback.betterExpressions.map((item, bIdx) => (
                  <div
                    key={bIdx}
                    className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm space-y-1"
                  >
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-700">[원문]</span> {item.original}
                    </div>
                    <div className="text-indigo-900 font-bold">
                      <span className="font-black text-indigo-700">→ [수정]</span> {item.improved}
                    </div>
                    {item.reason && (
                      <div className="text-[11px] text-slate-500 pt-0.5">
                        💡 {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 5. 쓰기 발전 방향 (Next Step) */}
            <div className="mb-4">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>쓰기 발전 방향 (Next Step)</span>
              </div>
              <div className="bg-sky-50/40 border border-sky-200 rounded-xl p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
                {student.studentFeedback.nextStep}
              </div>
            </div>

            {/* Footer Teacher Stamp Note */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span>중학교 3학년 영어과 평가 전용</span>
              <span>지도교사 확인: ___________________ (인)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
