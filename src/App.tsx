import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadEvaluateView } from './components/UploadEvaluateView';
import { TeacherSheetView } from './components/TeacherSheetView';
import { StudentPrintView } from './components/StudentPrintView';
import { AppsScriptGuideView } from './components/AppsScriptGuideView';
import { RubricInfoModal } from './components/RubricInfoModal';
import { EvaluationRecord } from './types';
import { SAMPLE_EVALUATIONS } from './data/sampleStudents';
import { sanitizeEvaluationRecord } from './utils/sanitize';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'teacher' | 'student' | 'gas'>('upload');
  const [records, setRecords] = useState<EvaluationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('english_eval_records_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(sanitizeEvaluationRecord);
        }
      }
    } catch (e) {
      console.warn('Failed to load records from localStorage', e);
    }
    return SAMPLE_EVALUATIONS.map(sanitizeEvaluationRecord);
  });

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    records[0]?.id || SAMPLE_EVALUATIONS[0]?.id || null
  );
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);

  // Sync records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('english_eval_records_v1', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to persist records to localStorage', e);
    }
  }, [records]);

  // Add new evaluation record
  // Add or update single evaluation record
  const handleAddEvaluation = (newRecord: EvaluationRecord) => {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === newRecord.id);
      if (idx >= 0) {
        // Update existing record
        return prev.map((r) => (r.id === newRecord.id ? newRecord : r));
      }
      return [newRecord, ...prev];
    });
    setSelectedStudentId(newRecord.id);
  };

  // Add multiple batch evaluation records (up to 50 students)
  const handleBatchAddEvaluations = (newRecords: EvaluationRecord[]) => {
    setRecords((prev) => {
      const newMap = new Map(newRecords.map((r) => [r.id, r]));
      // Update existing matches and keep non-conflicting old ones
      const updatedExisting = prev.map((r) => (newMap.has(r.id) ? newMap.get(r.id)! : r));
      const existingIdSet = new Set(prev.map((r) => r.id));
      const trulyNew = newRecords.filter((r) => !existingIdSet.has(r.id));
      return [...trulyNew, ...updatedExisting];
    });
    if (newRecords.length > 0) {
      setSelectedStudentId(newRecords[0].id);
    }
  };

  // Update existing record
  const handleUpdateRecord = (updatedRecord: EvaluationRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
  };

  // Delete record
  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (selectedStudentId === id) {
      const remaining = records.filter((r) => r.id !== id);
      setSelectedStudentId(remaining[0]?.id || null);
    }
  };

  // Stats
  const totalCount = records.length;
  const avgScore =
    totalCount > 0
      ? Number(
          (records.reduce((sum, r) => sum + r.scores.totalScore, 0) / totalCount).toFixed(1)
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openRubricModal={() => setIsRubricModalOpen(true)}
        totalCount={totalCount}
        avgScore={avgScore}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* Keep UploadEvaluateView mounted in DOM so uploaded file queue is preserved until user clicks delete */}
        <div className={activeTab === 'upload' ? 'block' : 'hidden'}>
          <UploadEvaluateView
            onAddEvaluation={handleAddEvaluation}
            onAddBatchEvaluations={handleBatchAddEvaluations}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onSelectStudentForPrint={(id) => setSelectedStudentId(id)}
          />
        </div>

        {activeTab === 'teacher' && (
          <TeacherSheetView
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
            onSelectStudentForPrint={(id) => setSelectedStudentId(id)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'student' && (
          <StudentPrintView
            records={records}
            selectedId={selectedStudentId}
            onSelectStudent={(id) => setSelectedStudentId(id)}
            onUpdateRecord={handleUpdateRecord}
          />
        )}

        {activeTab === 'gas' && <AppsScriptGuideView />}
      </main>

      {/* Rubric Info Modal */}
      <RubricInfoModal
        isOpen={isRubricModalOpen}
        onClose={() => setIsRubricModalOpen(false)}
      />

      {/* Footer (Hidden during printing) */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>2026학년도 2학기 중학교 3학년 영어 쓰기 수행평가 채점 & 피드백 시스템</span>
          <span>Google Gemini 3.8-flash OCR & Rubric Intelligence Engine</span>
        </div>
      </footer>
    </div>
  );
}
