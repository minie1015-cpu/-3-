import React, { useState } from 'react';
import {
  Table,
  Download,
  Copy,
  Check,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Printer,
  Sparkles,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { EvaluationRecord } from '../types';

interface TeacherSheetViewProps {
  records: EvaluationRecord[];
  onUpdateRecord: (updated: EvaluationRecord) => void;
  onDeleteRecord: (id: string) => void;
  onSelectStudentForPrint: (id: string) => void;
  onNavigateToTab: (tab: 'student' | 'upload' | 'gas') => void;
}

export const TeacherSheetView: React.FC<TeacherSheetViewProps> = ({
  records,
  onUpdateRecord,
  onDeleteRecord,
  onSelectStudentForPrint,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScores, setEditScores] = useState<{
    body1: number;
    body2: number;
    language: number;
    wordCount: number;
  }>({ body1: 4, body2: 4, language: 4, wordCount: 4 });
  const [editMemo, setEditMemo] = useState('');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<EvaluationRecord | null>(null);

  // Filtered records
  const filtered = records.filter(
    (r) =>
      r.studentInfo.name.includes(searchTerm) ||
      `${r.studentInfo.grade}-${r.studentInfo.classNum}-${r.studentInfo.studentNum}`.includes(
        searchTerm
      ) ||
      r.teacherMemo.includes(searchTerm)
  );

  // Statistics
  const totalStudents = records.length;
  const avgTotalScore =
    totalStudents > 0
      ? (records.reduce((sum, r) => sum + r.scores.totalScore, 0) / totalStudents).toFixed(1)
      : '0.0';
  const perfectScoreCount = records.filter((r) => r.scores.totalScore === 16).length;

  // Copy table to clipboard in Tab-Separated format (perfect for Google Sheets paste)
  const handleCopyForGoogleSheets = () => {
    const headers = [
      '학년',
      '반',
      '번호',
      '이름',
      '본문1-하는일/특징(4점)',
      '본문2-이유/배운점(4점)',
      '언어형식-분사/because(4점)',
      '단어수(4점)',
      '총점(16점)',
      '총단어수',
      '핵심메모(교사용)',
      '나이스(NEIS)세특서술문',
    ];

    const rows = records.map((r) => [
      r.studentInfo.grade,
      r.studentInfo.classNum,
      r.studentInfo.studentNum,
      r.studentInfo.name,
      r.scores.body1Score,
      r.scores.body2Score,
      r.scores.languageScore,
      r.scores.wordCountScore,
      r.scores.totalScore,
      r.wordCount,
      r.teacherMemo,
      `"${r.neisNote.replace(/"/g, '""')}"`,
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');

    navigator.clipboard.writeText(tsvContent);
    setCopiedType('sheets');
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Copy NEIS Notes
  const handleCopyNeisNotes = () => {
    const text = records
      .map(
        (r) =>
          `[${r.studentInfo.grade}-${r.studentInfo.classNum}-${r.studentInfo.studentNum} ${r.studentInfo.name}]\n${r.neisNote}\n`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedType('neis');
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const headers = [
      '학년,반,번호,이름,본문1_특징,본문2_이유,언어형식,단어수점수,총점,단어수,단문메모,나이스_세특',
    ];

    const rows = records.map((r) =>
      [
        r.studentInfo.grade,
        r.studentInfo.classNum,
        r.studentInfo.studentNum,
        `"${r.studentInfo.name}"`,
        r.scores.body1Score,
        r.scores.body2Score,
        r.scores.languageScore,
        r.scores.wordCountScore,
        r.scores.totalScore,
        r.wordCount,
        `"${r.teacherMemo.replace(/"/g, '""')}"`,
        `"${r.neisNote.replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `2026_중3_영어수행평가_성적기록부_16점만점.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Start inline editing
  const handleStartEdit = (record: EvaluationRecord) => {
    setEditingId(record.id);
    setEditScores({
      body1: record.scores.body1Score,
      body2: record.scores.body2Score,
      language: record.scores.languageScore,
      wordCount: record.scores.wordCountScore,
    });
    setEditMemo(record.teacherMemo);
  };

  // Save inline edit
  const handleSaveEdit = (record: EvaluationRecord) => {
    const newTotal =
      editScores.body1 +
      editScores.body2 +
      editScores.language +
      editScores.wordCount;

    const updated: EvaluationRecord = {
      ...record,
      scores: {
        body1Score: editScores.body1,
        body2Score: editScores.body2,
        languageScore: editScores.language,
        wordCountScore: editScores.wordCount,
        totalScore: newTotal,
      },
      teacherMemo: editMemo,
    };

    onUpdateRecord(updated);
    setEditingId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 mb-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>교사용 관리 / 기록 트랙</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            교사용 수행평가 성적 관리 시트
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            20점 만점 세부 루브릭 점수 산출 결과, 교사용 단문 메모 및 나이스(NEIS) 세특용 서술문 일람표입니다.
          </p>
        </div>

        {/* Action Buttons: Sheets Copy & CSV */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyForGoogleSheets}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            title="구글 스프레드시트에 바로 붙여넣을 수 있도록 탭 구분 텍스트(TSV)로 복사"
          >
            {copiedType === 'sheets' ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>시트 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Google 시트로 복사 (Ctrl+V)</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyNeisNotes}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            title="나이스(NEIS) 학교생활기록부용 세특 서술문 일괄 복사"
          >
            {copiedType === 'neis' ? (
              <>
                <Check className="w-4 h-4 text-indigo-200" />
                <span>NEIS 세특 복사됨!</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                <span>NEIS 세특 일괄 복사</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span>CSV 다운로드</span>
          </button>
        </div>
      </div>

      {/* Quick Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">평가 완료 학생</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalStudents}
            <span className="text-xs font-normal text-slate-500 ml-1">명</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">학급 평균 점수</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {avgTotalScore}
            <span className="text-xs font-normal text-slate-400 ml-1">/16점</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">16점 만점자</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {perfectScoreCount}
            <span className="text-xs font-normal text-slate-500 ml-1">명</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Google Apps Script</div>
          <button
            onClick={() => onNavigateToTab('gas')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold mt-2 inline-flex items-center space-x-1"
          >
            <span>자동화 파이프라인 코드 보기</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="학생 이름 또는 학번, 메모로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-slate-500">
          총 <strong>{filtered.length}</strong>건 표시 중
        </div>
      </div>

      {/* Google Sheets-Style Grade Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="py-3 px-3">학번</th>
                <th className="py-3 px-3">이름</th>
                <th className="py-3 px-2 text-center bg-indigo-50/50">본문1(4)</th>
                <th className="py-3 px-2 text-center bg-indigo-50/50">본문2(4)</th>
                <th className="py-3 px-2 text-center bg-indigo-50/50">언어형식(4)</th>
                <th className="py-3 px-2 text-center bg-indigo-50/50">단어수(4)</th>
                <th className="py-3 px-3 text-center font-bold text-indigo-700 bg-indigo-100/60">
                  총점(16)
                </th>
                <th className="py-3 px-3">단어수</th>
                <th className="py-3 px-4 min-w-[200px]">단문 메모 (교사용)</th>
                <th className="py-3 px-4 min-w-[280px]">나이스(NEIS) 세특 서술문</th>
                <th className="py-3 px-3 text-center">피드백지</th>
                <th className="py-3 px-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    채점된 학생 데이터가 없습니다. 상단 '답안 채점 & 분석' 탭에서 학생 답안을 채점해 보세요.
                  </td>
                </tr>
              ) : (
                filtered.map((record) => {
                  const isEditing = editingId === record.id;
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">
                        {record.studentInfo.grade}-{record.studentInfo.classNum}-{record.studentInfo.studentNum}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {record.studentInfo.name}
                      </td>

                      {/* Scores cells (editable when in edit mode) */}
                      {isEditing ? (
                        <>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min={1}
                              max={4}
                              value={editScores.body1}
                              onChange={(e) =>
                                setEditScores({ ...editScores, body1: Number(e.target.value) })
                              }
                              className="w-10 text-center text-xs p-1 border border-indigo-400 rounded"
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min={1}
                              max={4}
                              value={editScores.body2}
                              onChange={(e) =>
                                setEditScores({ ...editScores, body2: Number(e.target.value) })
                              }
                              className="w-10 text-center text-xs p-1 border border-indigo-400 rounded"
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min={1}
                              max={4}
                              value={editScores.language}
                              onChange={(e) =>
                                setEditScores({ ...editScores, language: Number(e.target.value) })
                              }
                              className="w-10 text-center text-xs p-1 border border-indigo-400 rounded"
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            <input
                              type="number"
                              min={1}
                              max={4}
                              value={editScores.wordCount}
                              onChange={(e) =>
                                setEditScores({ ...editScores, wordCount: Number(e.target.value) })
                              }
                              className="w-10 text-center text-xs p-1 border border-indigo-400 rounded"
                            />
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-indigo-700 bg-indigo-50">
                            {editScores.body1 +
                              editScores.body2 +
                              editScores.language +
                              editScores.wordCount}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-2 text-center text-slate-800 font-medium">
                            {record.scores.body1Score}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-800 font-medium">
                            {record.scores.body2Score}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-800 font-medium">
                            {record.scores.languageScore}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-800 font-medium">
                            {record.scores.wordCountScore}
                          </td>
                          <td className="py-3 px-3 text-center font-black text-indigo-700 bg-indigo-50/70 text-sm">
                            {record.scores.totalScore}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono">
                        {record.wordCount}단어
                      </td>

                      {/* Memo cell */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMemo}
                            onChange={(e) => setEditMemo(e.target.value)}
                            className="w-full text-xs p-1.5 border border-indigo-400 rounded"
                          />
                        ) : (
                          <div
                            className="truncate max-w-[240px] text-slate-600 cursor-pointer hover:text-slate-900"
                            title={record.teacherMemo}
                            onClick={() => setSelectedRecordForDetail(record)}
                          >
                            {record.teacherMemo}
                          </div>
                        )}
                      </td>

                      {/* NEIS cell */}
                      <td className="py-3 px-4">
                        <div
                          className="line-clamp-2 text-slate-600 text-[11px] leading-relaxed cursor-pointer hover:text-slate-900"
                          title="클릭하여 전체 세특 내용 확인"
                          onClick={() => setSelectedRecordForDetail(record)}
                        >
                          {record.neisNote}
                        </div>
                      </td>

                      {/* Print link */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            onSelectStudentForPrint(record.id);
                            onNavigateToTab('student');
                          }}
                          className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center space-x-1 mx-auto"
                          title="학생 피드백지 보기 및 출력"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>출력지</span>
                        </button>
                      </td>

                      {/* Action cell */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleSaveEdit(record)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="저장"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="취소"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1 text-slate-400">
                            <button
                              onClick={() => handleStartEdit(record)}
                              className="p-1 hover:text-indigo-600 hover:bg-slate-100 rounded"
                              title="점수/메모 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`${record.studentInfo.name} 학생의 채점 기록을 삭제하시겠습니까?`)) {
                                  onDeleteRecord(record.id);
                                }
                              }}
                              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {selectedRecordForDetail.studentInfo.grade}학년{' '}
                {selectedRecordForDetail.studentInfo.classNum}반{' '}
                {selectedRecordForDetail.studentInfo.studentNum}번{' '}
                {selectedRecordForDetail.studentInfo.name} 학생 세부 기록
              </h3>
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <span className="text-xs font-bold text-indigo-900 block mb-1">
                전사된 학생 영문 답안 ({selectedRecordForDetail.wordCount}단어):
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {selectedRecordForDetail.extractedText}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-indigo-900 block mb-1">
                나이스(NEIS) 세부능력 및 특기사항 문구:
              </span>
              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs text-slate-800 leading-relaxed">
                {selectedRecordForDetail.neisNote}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-900 block mb-1">교사용 핵심 메모:</span>
              <p className="text-xs text-slate-600">{selectedRecordForDetail.teacherMemo}</p>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedRecordForDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  onSelectStudentForPrint(selectedRecordForDetail.id);
                  onNavigateToTab('student');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                학생 피드백지 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
