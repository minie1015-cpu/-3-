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
  // Student privacy: hide name on feedback sheet, show only grade/class/studentNum
  const [hideNameOnSheet, setHideNameOnSheet] = useState(true);
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

          {/* Student Name Privacy Toggle (Teacher requested: student feedback shows only grade/class/studentNum) */}
          <button
            onClick={() => setHideNameOnSheet(!hideNameOnSheet)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center space-x-1.5 ${
              hideNameOnSheet
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="학생 피드백지에 이름을 숨기고 반/번호만 표시할지 여부"
          >
            <span>{hideNameOnSheet ? '🔒 피드백지 이름 비공개(반·번호만)' : '🔓 이름 표시 중'}</span>
          </button>

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
                ? `전체 학급 일괄 인쇄 (${records.length}명 · 반번호 표기)`
                : `${currentRecord.studentInfo.grade}-${currentRecord.studentInfo.classNum}-${currentRecord.studentInfo.studentNum} 피드백지 인쇄 (${currentRecord.studentInfo.name})`}
            </span>
          </button>
        </div>
      </div>

      {/* Security & Privacy Banner */}
      <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 text-xs flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>학생 개인정보 보호 및 성장 중심 피드백:</strong> 교사는 상단에서 학생 이름을 확인하여 관리할 수 있으며, 학생용 개별 피드백지에는 이름이 나오지 않고 <strong>반·번호({currentRecord.studentInfo.grade}학년 {currentRecord.studentInfo.classNum}반 {currentRecord.studentInfo.studentNum}번)만 표기</strong>됩니다. 또한 배움 중심 피드백을 위해 <strong>점수/감점 기준 대신 따뜻한 어법·어휘 추천 가이드</strong>가 제공됩니다.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
          {hideNameOnSheet ? '이름 비공개 (반·번호 표기)' : '이름 노출 모드'}
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
            <div className="border-b-2 border-slate-800 pb-3 mb-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  [2026학년도 2학기 영어 쓰기 수행평가 개별 피드백지]
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 border border-slate-800 rounded bg-slate-50">
                  성장 중심 평가
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded font-black text-xs sm:text-sm tracking-wide">
                    {student.studentInfo.grade}학년 {student.studentInfo.classNum}반 {student.studentInfo.studentNum}번
                  </span>
                  {!hideNameOnSheet ? (
                    <span className="text-indigo-900 text-xs sm:text-sm font-black border-b-2 border-indigo-900 pb-0.5 ml-1">
                      이름: {student.studentInfo.name}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-normal">
                      (개별 피드백지)
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  과제: 숨은 영웅 소개하기 (My Hidden Hero)
                </div>
              </div>
            </div>

            {/* 2. 영역별 성취 수준 (별점 / qualitative stars) */}
            <div className="mb-3.5">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>영역별 성취 수준</span>
              </div>
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm space-y-1.5 text-slate-800">
                <div className="flex items-center justify-between">
                  <span>• 내용 구성 (영웅 특징 3문장 및 선정 이유 3문장):</span>
                  <span className="font-mono text-amber-500 font-bold tracking-wider text-sm">
                    {student.studentFeedback.achievementLevels.contentStars}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>• 언어 형식 (분사 표현, 접속사 because, 어법 정확도):</span>
                  <span className="font-mono text-amber-500 font-bold tracking-wider text-sm">
                    {student.studentFeedback.achievementLevels.languageStars}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>• 글의 분량 및 어휘 구성:</span>
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

            {/* 3. 언어형식 맞춤 배움 가이드 (학생 친화적 피드백 제공) */}
            <div className="mb-3.5">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-800">■</span>
                  <span>언어형식 맞춤 배움 가이드</span>
                </div>
                <div className="text-[11px] font-bold text-slate-600">
                  {(() => {
                    const isBlank =
                      student.wordCount === 0 ||
                      student.scores.totalScore === 4 ||
                      (student.extractedText && student.extractedText.includes('백지'));

                    if (isBlank) {
                      return (
                        <span className="text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-bold">
                          본문 미작성 (백지 제출)
                        </span>
                      );
                    }

                    return (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                        성장 중심 피드백 (대소문자·단어선택 감점 없음)
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3 text-xs space-y-2 text-slate-800">
                {/* Helpful guidance banner */}
                <div className="text-[11px] text-indigo-900 bg-indigo-50/70 border border-indigo-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                  <span>
                    💡 <strong>어법 및 단어 배움 팁:</strong> 문장의 첫 글자 대소문자나 더 자연스러운 단어 선택(예: hear music → listen to music)은 학생의 기를 살리고 배움을 돕기 위한 <strong>추천 제안</strong>이며 점수에 반영되지 않습니다.
                  </span>
                </div>

                {/* Errors list */}
                {student.languageAnalysis?.errors && student.languageAnalysis.errors.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                      <span className="text-slate-800 font-bold">📝 확인된 맞춤 어법 및 단어 교정 목록:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {student.languageAnalysis.errors.map((err, errIdx) => {
                        const errTypeStr = String(err.errorType || '').toLowerCase();
                        const isCap =
                          errTypeStr.includes('대소문자') ||
                          errTypeStr.includes('capital') ||
                          errTypeStr.includes('case');
                        const isWordChoice =
                          errTypeStr.includes('단어') ||
                          errTypeStr.includes('어휘') ||
                          errTypeStr.includes('선택') ||
                          errTypeStr.includes('word') ||
                          errTypeStr.includes('diction') ||
                          errTypeStr.includes('collocation');

                        return (
                          <div
                            key={errIdx}
                            className={`p-2 rounded-lg border text-[11px] space-y-0.5 shadow-2xs ${
                              isCap
                                ? 'bg-sky-50/70 border-sky-200'
                                : isWordChoice
                                ? 'bg-emerald-50/70 border-emerald-200'
                                : 'bg-white border-amber-200/90'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-700 line-through">
                                {err.text}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                                  isCap
                                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                                    : isWordChoice
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100/70 text-amber-800 border-amber-200'
                                }`}
                              >
                                {isCap
                                  ? '대소문자 표기 안내'
                                  : isWordChoice
                                  ? '단어/어휘 선택 제안'
                                  : '어법 교정 안내'}
                              </span>
                            </div>
                            <div className="text-indigo-900 font-bold">
                              → {err.correction}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  (() => {
                    const isBlank =
                      student.wordCount === 0 ||
                      student.scores.totalScore === 4 ||
                      (student.extractedText && student.extractedText.includes('백지'));

                    if (isBlank) {
                      return (
                        <div className="text-slate-700 font-medium text-[11px] py-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5">
                          ※ <strong>본문 미작성 (백지 제출):</strong> 작성된 본문이 없습니다. 다음 수행평가에서는 배운 표현을 한 문장이라도 꼭 작성해 보세요.
                        </div>
                      );
                    }

                    const bScore = student.languageAnalysis?.baseScore ?? 4;
                    if (bScore >= 4) {
                      return (
                        <div className="text-emerald-800 font-medium text-[11px] py-0.5">
                          ✓ 명사 수식 분사 표현과 접속사 because를 어법에 맞게 훌륭하게 활용하였습니다.
                        </div>
                      );
                    } else if (bScore === 3) {
                      return (
                        <div className="text-blue-800 font-medium text-[11px] py-0.5">
                          ✓ 배운 핵심 어법 요소를 활용하여 성실하게 영작문을 완성하였습니다.
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-amber-800 font-medium text-[11px] py-0.5">
                          ※ 명사 수식 분사 표현과 접속사 because를 한 번 더 복습하고 다음 글쓰기에 적용해 보세요.
                        </div>
                      );
                    }
                  })()
                )}
              </div>
            </div>

            {/* 4. 잘한 점 (Good Points) */}
            <div className="mb-3.5">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>잘한 점 (Good Points)</span>
              </div>
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 leading-relaxed">
                {student.studentFeedback.goodPoints}
              </div>
            </div>

            {/* 5. 더 나은 표현으로 다듬기 (Better Expressions) */}
            <div className="mb-3.5">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>더 나은 표현으로 다듬기 (Better Expressions)</span>
              </div>
              <div className="space-y-1.5">
                {student.studentFeedback.betterExpressions.map((item, bIdx) => (
                  <div
                    key={bIdx}
                    className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm space-y-1"
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

            {/* 6. 쓰기 발전 방향 (Next Step) */}
            <div className="mb-3.5">
              <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5 flex items-center space-x-1.5">
                <span className="text-slate-800">■</span>
                <span>쓰기 발전 방향 (Next Step)</span>
              </div>
              <div className="bg-sky-50/40 border border-sky-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 leading-relaxed">
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
