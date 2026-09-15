import React from 'react';
import {
  FileText,
  Table,
  Printer,
  Code,
  HelpCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'upload' | 'teacher' | 'student' | 'gas';
  setActiveTab: (tab: 'upload' | 'teacher' | 'student' | 'gas') => void;
  openRubricModal: () => void;
  totalCount: number;
  avgScore: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  openRubricModal,
  totalCount,
  avgScore,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Subject Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  중3 영어 수행평가 채점 & 피드백 시스템
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  2026학년도 2학기
                </span>
              </div>
              <p className="text-xs text-slate-500">
                주제: 숨은 영웅 소개하기 (My Hidden Hero) · 16점 루브릭 · 최대 30명 일괄 채점
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="nav-upload-tab"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>답안 채점 & 분석</span>
            </button>

            <button
              id="nav-teacher-tab"
              onClick={() => setActiveTab('teacher')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>교사용 성적 시트</span>
              {totalCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-xs ${
                  activeTab === 'teacher' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {totalCount}
                </span>
              )}
            </button>

            <button
              id="nav-student-tab"
              onClick={() => setActiveTab('student')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'student'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>학생 피드백지 인쇄</span>
              <span className="hidden md:inline-block text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-normal">
                A4 1장 전면
              </span>
            </button>

            <button
              id="nav-gas-tab"
              onClick={() => setActiveTab('gas')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'gas'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">Google Apps Script</span>
              <span className="sm:hidden">GAS</span>
            </button>
          </nav>

          {/* Right helper buttons */}
          <div className="flex items-center space-x-2">
            <button
              id="open-rubric-modal-btn"
              onClick={openRubricModal}
              className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-300 font-medium"
              title="비공개 루브릭 채점기준표 확인"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">루브릭 기준표</span>
              <span className="md:hidden">기준표</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
