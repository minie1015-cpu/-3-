import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Users,
  Award,
  ChevronRight,
  Check,
  Eye,
  Trash2,
  Play,
  Layers,
  FileCheck,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  FileStack,
  Loader2,
} from 'lucide-react';
import { EvaluationRecord, StudentInfo, BatchFileItem } from '../types';
import {
  SAMPLE_EVALUATIONS,
  generate28StudentBatchRecords,
} from '../data/sampleStudents';
import { splitPdfIntoPages, isPdfFile } from '../utils/pdfSplitter';

interface UploadEvaluateViewProps {
  onAddEvaluation: (record: EvaluationRecord) => void;
  onAddBatchEvaluations?: (records: EvaluationRecord[]) => void;
  onNavigateToTab: (tab: 'teacher' | 'student') => void;
  onSelectStudentForPrint: (id: string) => void;
}

export const UploadEvaluateView: React.FC<UploadEvaluateViewProps> = ({
  onAddEvaluation,
  onAddBatchEvaluations,
  onNavigateToTab,
  onSelectStudentForPrint,
}) => {
  // Mode selection: 'batch' (up to 30 students bundle) vs 'single'
  const [activeMode, setActiveMode] = useState<'batch' | 'single'>('batch');

  // ==========================================
  // BATCH MODE STATES (Up to 50 students)
  // ==========================================
  const [batchQueue, setBatchQueue] = useState<BatchFileItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);
  const [batchStatusMessage, setBatchStatusMessage] = useState<string>('');
  const [batchSummaryRecordList, setBatchSummaryRecordList] = useState<EvaluationRecord[]>([]);

  // Reactive derived counts for queue items
  const completedBatchCount = batchQueue.filter((i) => i.status === 'success').length;
  const pendingBatchCount = batchQueue.filter((i) => i.status === 'idle').length;
  const errorBatchCount = batchQueue.filter((i) => i.status === 'error').length;
  const unEvaluatedBatchCount = batchQueue.filter((i) => i.status !== 'success').length;

  // Multi-page PDF splitting progress states
  const [isSplittingPdf, setIsSplittingPdf] = useState<boolean>(false);
  const [pdfSplitProgressText, setPdfSplitProgressText] = useState<string>('');

  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const abortBatchRef = useRef<boolean>(false);

  // ==========================================
  // SINGLE MODE STATES
  // ==========================================
  const [singleStudentInfo, setSingleStudentInfo] = useState<StudentInfo>({
    grade: '3',
    classNum: '1',
    studentNum: '3',
    name: '최지훈',
  });
  const [singleStudentText, setSingleStudentText] = useState<string>('');
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleFileBase64, setSingleFileBase64] = useState<string | null>(null);
  const [singleFileMimeType, setSingleFileMimeType] = useState<string>('');
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [isSingleLoading, setIsSingleLoading] = useState<boolean>(false);
  const [singleLoadingStep, setSingleLoadingStep] = useState<string>('');
  const [singleErrorMessage, setSingleErrorMessage] = useState<string | null>(null);
  const [lastSingleResult, setLastSingleResult] = useState<EvaluationRecord | null>(null);

  // Multi-page PDF detection in single mode
  const [multiPagePdfInSingle, setMultiPagePdfInSingle] = useState<{
    file: File;
    totalPages: number;
  } | null>(null);

  const singleFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse student info from filename (e.g., "3-1-02_김철수.jpg", "3_1_15_이영희.pdf")
  const parseInfoFromFileName = (fileName: string): Partial<StudentInfo> => {
    const clean = fileName.replace(/\.[^/.]+$/, '');
    const match = clean.match(/(\d)[-_](\d)[-_](\d+)[-_ ]*(.*)/);
    if (match) {
      return {
        grade: match[1],
        classNum: match[2],
        studentNum: match[3],
        name: match[4]?.trim() || '',
      };
    }
    return {};
  };

  // ==========================================
  // BATCH FILE HANDLING (Supports Multi-page PDF Auto Splitting)
  // ==========================================
  const handleBatchFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newItems: BatchFileItem[] = [];
    let splitCount = 0;

    setIsSplittingPdf(true);
    setPdfSplitProgressText('답안지 파일 형식 검사 및 다중 페이지 PDF 분할 확인 중...');

    try {
      for (let fIdx = 0; fIdx < fileArray.length; fIdx++) {
        const file = fileArray[fIdx];

        if (isPdfFile(file)) {
          setPdfSplitProgressText(`[${fIdx + 1}/${fileArray.length}] PDF 파일 페이지 수 분석 중... (${file.name})`);
          try {
            const pages = await splitPdfIntoPages(file, (curr, tot) => {
              setPdfSplitProgressText(`[${file.name}] ${tot}페이지 중 ${curr}번째 학생 답안지 추출 중...`);
            });

            if (pages.length > 1) {
              splitCount += pages.length;
              // Add each page as an individual student queue item
              const parsedInfo = parseInfoFromFileName(file.name);
              pages.forEach((page) => {
                newItems.push({
                  id: `batch-item-${Date.now()}-${fIdx}-p${page.pageNumber}`,
                  fileName: `${file.name.replace(/\.pdf$/i, '')} (p.${page.pageNumber}/${page.totalPages})`,
                  fileSize: page.file.size,
                  file: page.file,
                  fileBase64: page.base64,
                  fileMimeType: 'application/pdf',
                  studentInfo: {
                    grade: parsedInfo.grade || '3',
                    classNum: parsedInfo.classNum || '',
                    studentNum: parsedInfo.studentNum || String(page.pageNumber),
                    name: parsedInfo.name ? `${parsedInfo.name} (p.${page.pageNumber})` : '',
                  },
                  status: 'idle',
                  isPdfPage: true,
                  pageIndex: page.pageNumber,
                  totalPdfPages: page.totalPages,
                  originalPdfName: file.name,
                });
              });
              continue;
            } else if (pages.length === 1) {
              // 1 page PDF
              const page = pages[0];
              const parsedInfo = parseInfoFromFileName(file.name);
              newItems.push({
                id: `batch-item-${Date.now()}-${fIdx}`,
                fileName: file.name,
                fileSize: file.size,
                file: page.file,
                fileBase64: page.base64,
                fileMimeType: 'application/pdf',
                studentInfo: parsedInfo,
                status: 'idle',
                isPdfPage: false,
              });
              continue;
            }
          } catch (pdfErr) {
            console.warn('PDF splitting error, falling back to raw file:', pdfErr);
          }
        }

        // Standard image or fallback file
        const parsedInfo = parseInfoFromFileName(file.name);
        newItems.push({
          id: `batch-item-${Date.now()}-${fIdx}`,
          fileName: file.name,
          fileSize: file.size,
          file,
          fileMimeType: file.type || 'image/jpeg',
          studentInfo: parsedInfo,
          status: 'idle',
        });
      }

      setBatchQueue((prev) => {
        const combined = [...prev, ...newItems];
        return combined.slice(0, 50); // Supports up to 50 students
      });

      if (splitCount > 0) {
        setBatchStatusMessage(
          `✓ 다중 페이지 PDF에서 총 ${splitCount}명의 학생 답안지가 개별 페이지로 완벽하게 자동 분할되어 일괄 채점 대기열에 등록되었습니다!`
        );
      }
    } catch (err: any) {
      console.error('Batch file selection error:', err);
      setBatchStatusMessage('파일 등록 중 일부 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsSplittingPdf(false);
      setPdfSplitProgressText('');
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    if (isBatchProcessing) return;
    setBatchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearBatchQueue = () => {
    if (isBatchProcessing) return;
    setBatchQueue([]);
    setBatchSummaryRecordList([]);
    setBatchStatusMessage('');
  };

  // Convert File to base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Run Batch Evaluation (By default evaluates only pending/error items to support time-lagged uploads)
  const handleStartBatchEvaluation = async (options?: { reevaluateAll?: boolean }) => {
    if (batchQueue.length === 0) return;

    const reevaluateAll = options?.reevaluateAll ?? false;
    const targetItems = reevaluateAll
      ? batchQueue
      : batchQueue.filter((item) => item.status !== 'success');

    if (targetItems.length === 0) {
      setBatchStatusMessage('채점 대기 중인 답안지가 없습니다. (모든 답안지가 이미 채점 완료되었습니다)');
      return;
    }

    setIsBatchProcessing(true);
    abortBatchRef.current = false;
    setCurrentBatchIndex(0);
    setBatchStatusMessage(
      reevaluateAll
        ? `대기열의 모든 답안지(${targetItems.length}명) 전체 재채점 준비 중...`
        : `미채점 답안지 ${targetItems.length}명 일괄 채점 시작... (이미 채점 완료된 답안지는 보존)`
    );

    const evaluatedRecords: EvaluationRecord[] = [];

    for (let i = 0; i < targetItems.length; i++) {
      if (abortBatchRef.current) {
        setBatchStatusMessage('교사에 의해 일괄 채점이 중단되었습니다.');
        break;
      }

      setCurrentBatchIndex(i + 1);
      const currentItem = targetItems[i];

      // Update item state to 'processing'
      setBatchQueue((prev) =>
        prev.map((item) =>
          item.id === currentItem.id ? { ...item, status: 'processing', errorMessage: undefined } : item
        )
      );

      const studentNameDisplay = currentItem.studentInfo?.name || currentItem.fileName;
      setBatchStatusMessage(
        `[${i + 1}/${targetItems.length}] ${studentNameDisplay} 학생 답안지 분석 및 16점 루브릭 채점 중...`
      );

      try {
        let base64 = currentItem.fileBase64;
        if (!base64 && currentItem.file) {
          base64 = await readFileAsBase64(currentItem.file);
        }

        // Call server evaluation API
        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: currentItem.fileMimeType || 'image/jpeg',
            studentText: currentItem.studentText,
            studentInfo: currentItem.studentInfo,
          }),
        });

        const json = await response.json();

        if (!response.ok || !json.success) {
          const errMsg =
            typeof json.error === 'object'
              ? json.error.message || JSON.stringify(json.error)
              : json.error || '채점 평가 오류';
          throw new Error(errMsg);
        }

        const resData = json.data;
        const newRecord: EvaluationRecord = {
          id: currentItem.result?.id || `eval-${currentItem.id}`,
          studentInfo: resData.studentInfo || {
            grade: currentItem.studentInfo?.grade || '3',
            classNum: currentItem.studentInfo?.classNum || '1',
            studentNum: currentItem.studentInfo?.studentNum || String(i + 1),
            name: currentItem.studentInfo?.name || `학생 ${i + 1}`,
          },
          scores: resData.scores,
          extractedText: resData.extractedText || '',
          wordCount: resData.wordCount || 0,
          sentenceCounts: resData.sentenceCounts,
          languageAnalysis: resData.languageAnalysis,
          rubricNotes: resData.rubricNotes || {
            body1Note: '',
            body2Note: '',
            languageNote: '',
            wordCountNote: '',
          },
          teacherMemo: resData.teacherMemo || '',
          neisNote: resData.neisNote || '',
          studentFeedback: resData.studentFeedback,
          analyzedAt: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sourceType: 'image',
        };

        evaluatedRecords.push(newRecord);

        // Update item state to 'success'
        setBatchQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: 'success',
                  result: newRecord,
                  studentInfo: newRecord.studentInfo,
                }
              : item
          )
        );

        // Immediate reflection in global records
        onAddEvaluation(newRecord);

        setBatchSummaryRecordList((prev) => {
          const idx = prev.findIndex((r) => r.id === newRecord.id);
          if (idx >= 0) return prev.map((r) => (r.id === newRecord.id ? newRecord : r));
          return [...prev, newRecord];
        });

        // Add small pause between requests to prevent API rate limit issues
        await new Promise((r) => setTimeout(r, 600));
      } catch (err: any) {
        console.error(`Batch item ${currentItem.id} failed:`, err);
        setBatchQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err?.message || '채점 실패',
                }
              : item
          )
        );
      }
    }

    setIsBatchProcessing(false);
    if (evaluatedRecords.length > 0) {
      if (onAddBatchEvaluations) {
        onAddBatchEvaluations(evaluatedRecords);
      }
      setBatchStatusMessage(
        `✓ 채점 완료! 총 ${evaluatedRecords.length}명의 답안지 채점이 완료되어 교사용 성적 시트에 반영되었습니다.`
      );
    }
  };

  // Evaluate a Single Item Independently
  const handleEvaluateSingleItem = async (itemId: string) => {
    const targetItem = batchQueue.find((it) => it.id === itemId);
    if (!targetItem || isBatchProcessing || targetItem.status === 'processing') return;

    // Mark as processing
    setBatchQueue((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'processing', errorMessage: undefined } : it))
    );

    const studentNameDisplay = targetItem.studentInfo?.name || targetItem.fileName;
    setBatchStatusMessage(`[개별 채점] ${studentNameDisplay} 학생 답안지 AI 16점 루브릭 채점 중...`);

    try {
      let base64 = targetItem.fileBase64;
      if (!base64 && targetItem.file) {
        base64 = await readFileAsBase64(targetItem.file);
      }

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: targetItem.fileMimeType || 'image/jpeg',
          studentText: targetItem.studentText,
          studentInfo: targetItem.studentInfo,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        const errMsg =
          typeof json.error === 'object'
            ? json.error.message || JSON.stringify(json.error)
            : json.error || '채점 평가 오류';
        throw new Error(errMsg);
      }

      const resData = json.data;
      const newRecord: EvaluationRecord = {
        id: targetItem.result?.id || `eval-${targetItem.id}`,
        studentInfo: resData.studentInfo || {
          grade: targetItem.studentInfo?.grade || '3',
          classNum: targetItem.studentInfo?.classNum || '1',
          studentNum: targetItem.studentInfo?.studentNum || '1',
          name: targetItem.studentInfo?.name || targetItem.fileName,
        },
        scores: resData.scores,
        extractedText: resData.extractedText || '',
        wordCount: resData.wordCount || 0,
        sentenceCounts: resData.sentenceCounts,
        languageAnalysis: resData.languageAnalysis,
        rubricNotes: resData.rubricNotes || {
          body1Note: '',
          body2Note: '',
          languageNote: '',
          wordCountNote: '',
        },
        teacherMemo: resData.teacherMemo || '',
        neisNote: resData.neisNote || '',
        studentFeedback: resData.studentFeedback,
        analyzedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        sourceType: 'image',
      };

      setBatchQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: 'success',
                result: newRecord,
                studentInfo: newRecord.studentInfo,
              }
            : it
        )
      );

      // Save to global list in App.tsx
      onAddEvaluation(newRecord);

      setBatchSummaryRecordList((prev) => {
        const idx = prev.findIndex((r) => r.id === newRecord.id);
        if (idx >= 0) return prev.map((r) => (r.id === newRecord.id ? newRecord : r));
        return [...prev, newRecord];
      });

      setBatchStatusMessage(
        `✓ [${newRecord.studentInfo.name}] 학생 답안지 개별 채점 완료! (총점: ${newRecord.scores.totalScore}점)`
      );
    } catch (err: any) {
      console.error(`Single evaluation failed for ${itemId}:`, err);
      setBatchQueue((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status: 'error',
                errorMessage: err?.message || '개별 채점 실패',
              }
            : it
        )
      );
      setBatchStatusMessage(`✕ [${studentNameDisplay}] 개별 채점 실패: ${err?.message || '오류'}`);
    }
  };

  // Quick simulation: Load test bundle of 28 students
  const handleLoadSampleBatch = () => {
    if (isBatchProcessing) return;

    const sampleRecords = generate28StudentBatchRecords();

    // Map into batchQueue items
    const sampleQueueItems: BatchFileItem[] = sampleRecords.map((rec, idx) => ({
      id: `sample-batch-${idx + 1}`,
      fileName: `3-1-${String(rec.studentInfo.studentNum).padStart(2, '0')}_${rec.studentInfo.name}_답안지.jpg`,
      fileSize: 180000 + idx * 12000,
      fileMimeType: 'image/jpeg',
      studentInfo: rec.studentInfo,
      studentText: rec.extractedText,
      status: 'idle',
      result: rec,
    }));

    setBatchQueue(sampleQueueItems);
    setBatchSummaryRecordList([]);
    setBatchStatusMessage(
      `학급 28명 스캔본 묶음 데이터가 대기열에 등록되었습니다. '미채점 일괄 채점'을 누르거나 학생별 '개별 채점'을 누르세요.`
    );
  };

  // Instant simulate execution of the 28-student batch
  const handleInstantSimulateBatch = async (options?: { reevaluateAll?: boolean }) => {
    if (isBatchProcessing || batchQueue.length === 0) return;

    const reevaluateAll = options?.reevaluateAll ?? false;
    const targetItems = reevaluateAll
      ? batchQueue
      : batchQueue.filter((it) => it.status !== 'success');

    if (targetItems.length === 0) {
      setBatchStatusMessage('채점 대기 중인 답안지가 없습니다.');
      return;
    }

    setIsBatchProcessing(true);
    abortBatchRef.current = false;
    setCurrentBatchIndex(0);

    const evaluatedRecords: EvaluationRecord[] = [];

    for (let i = 0; i < targetItems.length; i++) {
      if (abortBatchRef.current) break;

      setCurrentBatchIndex(i + 1);
      const item = targetItems[i];

      setBatchQueue((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'processing' } : it))
      );
      setBatchStatusMessage(
        `[${i + 1}/${targetItems.length}] ${item.studentInfo?.name || item.fileName} 학생 답안 채점 분석 중...`
      );

      // Simulation delay per item for realistic visual feedback
      await new Promise((r) => setTimeout(r, 100));

      const record: EvaluationRecord = item.result || {
        id: `eval-${item.id}`,
        studentInfo: {
          grade: item.studentInfo?.grade || '3',
          classNum: item.studentInfo?.classNum || '1',
          studentNum: item.studentInfo?.studentNum || String(i + 1),
          name: item.studentInfo?.name || `학생 ${i + 1}`,
        },
        scores: {
          body1Score: 4,
          body2Score: 4,
          languageScore: 4,
          wordCountScore: 4,
          totalScore: 16,
        },
        extractedText: item.studentText || 'My hidden hero...',
        wordCount: 80,
        rubricNotes: {
          body1Note: '특징 구체적 3문장 작성 (4점)',
          body2Note: '이유/배운점 3문장 작성 (4점)',
          languageNote: '분사수식 및 because 완벽 사용 (4점)',
          wordCountNote: '80단어 이상 충족 (4점)',
        },
        teacherMemo: '16점 만점 모범 답안',
        neisNote: '성실하고 창의적인 서술 능력 발휘.',
        studentFeedback: {
          achievementLevels: {
            contentRating: 5,
            contentStars: '★★★★★',
            languageRating: 5,
            languageStars: '★★★★★',
            volumeRating: 5,
            volumeStars: '★★★★★',
            wordCountNote: '총 80단어',
          },
          goodPoints: '우수한 문장 구성 능력',
          betterExpressions: [],
          nextStep: '지금처럼 훌륭한 문장력을 유지하세요!',
        },
        analyzedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        sourceType: 'sample',
      };

      evaluatedRecords.push(record);

      setBatchQueue((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'success', result: record, studentInfo: record.studentInfo } : it
        )
      );
      setBatchSummaryRecordList((prev) => {
        const idx = prev.findIndex((r) => r.id === record.id);
        if (idx >= 0) return prev.map((r) => (r.id === record.id ? record : r));
        return [...prev, record];
      });
      onAddEvaluation(record);
    }

    setIsBatchProcessing(false);
    if (evaluatedRecords.length > 0) {
      if (onAddBatchEvaluations) {
        onAddBatchEvaluations(evaluatedRecords);
      }
      setBatchStatusMessage(
        `✓ 총 ${evaluatedRecords.length}명 채점 완료! 교사용 성적 시트와 학생 피드백지에서 확인 가능합니다.`
      );
    }
  };

  // ==========================================
  // SINGLE MODE HANDLING
  // ==========================================
  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSingleFile(file);
  };

  const processSingleFile = async (file: File) => {
    setSingleFile(file);
    setSingleErrorMessage(null);
    setMultiPagePdfInSingle(null);

    const parsed = parseInfoFromFileName(file.name);
    if (parsed.name) {
      setSingleStudentInfo((prev) => ({ ...prev, ...parsed }));
    }

    // Check if uploaded file is a multi-page PDF
    if (isPdfFile(file)) {
      try {
        const pages = await splitPdfIntoPages(file);
        if (pages.length > 1) {
          setMultiPagePdfInSingle({
            file,
            totalPages: pages.length,
          });
        }
      } catch (pdfErr) {
        console.warn('PDF inspection in single mode:', pdfErr);
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setSingleFileBase64(base64Data);
      setSingleFileMimeType(file.type || 'image/jpeg');

      if (file.type.startsWith('image/')) {
        setSinglePreviewUrl(result);
      } else {
        setSinglePreviewUrl(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTransferMultiPageToBatch = () => {
    if (!multiPagePdfInSingle) return;
    const targetFile = multiPagePdfInSingle.file;
    setActiveMode('batch');
    const dt = new DataTransfer();
    dt.items.add(targetFile);
    handleBatchFileSelection(dt.files);
    setMultiPagePdfInSingle(null);
  };

  const handleSingleEvaluate = async () => {
    if (!singleFileBase64 && !singleStudentText.trim()) {
      setSingleErrorMessage(
        '학생 답안지 스캔 파일(이미지/PDF)을 업로드하거나 영문 답안 텍스트를 입력해 주세요.'
      );
      return;
    }

    setIsSingleLoading(true);
    setSingleErrorMessage(null);
    setSingleLoadingStep('학생 답안 텍스트 OCR 인식 및 구조 분석 중...');

    try {
      setTimeout(() => {
        setSingleLoadingStep('16점 만점 루브릭(본문1·2/언어형식/단어수) 정밀 채점 중...');
      }, 1500);

      setTimeout(() => {
        setSingleLoadingStep('Better Expression 교정 및 맞춤형 성장 피드백 생성 중...');
      }, 3000);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: singleFileBase64 || undefined,
          mimeType: singleFileMimeType || undefined,
          studentText: singleStudentText.trim() || undefined,
          studentInfo: singleStudentInfo,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || '채점 평가 요청이 실패했습니다.');
      }

      const resultData = json.data;
      const newRecord: EvaluationRecord = {
        id: `eval-${Date.now()}`,
        studentInfo: resultData.studentInfo || singleStudentInfo,
        scores: resultData.scores,
        extractedText: resultData.extractedText || singleStudentText,
        wordCount: resultData.wordCount || 0,
        sentenceCounts: resultData.sentenceCounts,
        languageAnalysis: resultData.languageAnalysis,
        rubricNotes: resultData.rubricNotes || {
          body1Note: '',
          body2Note: '',
          languageNote: '',
          wordCountNote: '',
        },
        teacherMemo: resultData.teacherMemo || '',
        neisNote: resultData.neisNote || '',
        studentFeedback: resultData.studentFeedback,
        analyzedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        sourceType: singleFileBase64 ? 'image' : 'text',
        imagePreviewUrl: singlePreviewUrl || undefined,
      };

      setLastSingleResult(newRecord);
      onAddEvaluation(newRecord);
    } catch (err: any) {
      console.error(err);
      setSingleErrorMessage(
        err.message || '채점 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setIsSingleLoading(false);
      setSingleLoadingStep('');
    }
  };

  const handleLoadSingleSample = (sampleIndex: number) => {
    const sample = SAMPLE_EVALUATIONS[sampleIndex];
    if (!sample) return;

    setSingleStudentInfo(sample.studentInfo);
    setSingleStudentText(sample.extractedText);
    setSingleFile(null);
    setSingleFileBase64(null);
    setSinglePreviewUrl(null);
    setLastSingleResult(sample);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-700/60 border border-indigo-400/30 text-xs font-medium text-indigo-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI 자동 채점 & 피드백 시스템 · 초안 점수 제외 16점 루브릭</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            중3 영어 쓰기 수행평가 일괄 채점기
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            최대 30명 학급 스캔본 묶음(이미지/PDF)을 한꺼번에 업로드하여 OCR 추출과 <strong>16점 비공개 루브릭</strong>(본문1 4점, 본문2 4점, 언어형식 4점, 단어수 4점) 자동 채점을 즉시 수행합니다.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-indigo-200">
            <span className="bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-700/50 font-medium">
              ✓ 최대 30명 스캔본 묶음 일괄 채점
            </span>
            <span className="bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-700/50">
              ✓ 학생에게는 감점 기준표 비노출 (A4 1장 전면 피드백)
            </span>
            <span className="bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-700/50">
              ✓ 분사 명사수식(~ing/p.p.) & because 검증
            </span>
            <span className="bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-700/50">
              ✓ 나이스(NEIS) 세특 자동 기재
            </span>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            id="batch-mode-tab-btn"
            onClick={() => setActiveMode('batch')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeMode === 'batch'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>학급 일괄 채점 (최대 30명 스캔본 묶음)</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeMode === 'batch' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
            }`}>
              {batchQueue.length}명
            </span>
          </button>

          <button
            id="single-mode-tab-btn"
            onClick={() => setActiveMode('single')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeMode === 'single'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>단일 학생 개별 채점 & 수정</span>
          </button>
        </div>

        {activeMode === 'batch' && (
          <button
            onClick={handleLoadSampleBatch}
            className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition font-medium flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>테스트용 28명 학급 데이터 불러오기</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. BATCH MODE (Up to 30 students bundle)                                 */}
      {/* ========================================================================= */}
      {activeMode === 'batch' && (
        <div className="space-y-6">
          {/* Batch Upload Area */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UploadCloud className="w-5 h-5 text-indigo-600" />
                  <span>스캔본 파일 업로드 (다중 페이지 PDF 자동 분할 채점 지원)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  평판 스캐너로 한 번에 스캔한 <strong>다중 페이지 PDF(한 파일에 여러 학생)</strong>도 지원됩니다. 학생별로 1장씩 자동 분할되어 대기열에 순서대로 등록됩니다.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-slate-600">등록된 답안지:</span>
                <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {batchQueue.length} / 50명
                </span>
              </div>
            </div>

            {/* Multi-page PDF Splitting Loading Banner */}
            {isSplittingPdf && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center space-x-3 text-xs text-indigo-900">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold flex items-center space-x-1.5">
                    <FileStack className="w-4 h-4 text-indigo-600" />
                    <span>다중 페이지 PDF를 학생별 개별 답안지로 자동 분할 처리 중입니다...</span>
                  </p>
                  <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">{pdfSplitProgressText}</p>
                </div>
              </div>
            )}

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleBatchFileSelection(e.dataTransfer.files);
              }}
              onClick={() => batchFileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-2xl p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={batchFileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => handleBatchFileSelection(e.target.files)}
                className="hidden"
              />
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    <span className="text-indigo-600 underline">스캔 파일 여러 개 또는 다중 페이지 PDF 선택하기</span> 또는 여기로 드래그 앤 드롭
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    한 파일에 30페이지가 묶인 스캔 PDF나 개별 이미지 파일(JPG, PNG, PDF) 모두 완벽 지원합니다.
                  </p>
                </div>
                <div className="inline-flex items-center space-x-2 text-[11px] text-indigo-600 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-200">
                  <FileStack className="w-3.5 h-3.5" />
                  <span>스캐너에서 한 번에 스캔된 다중 페이지 PDF 1개 파일만 업로드하셔도 각 학생별로 자동 분리 채점됩니다!</span>
                </div>
              </div>
            </div>

            {/* Batch Progress Bar (Visible during or after processing) */}
            {(isBatchProcessing || completedBatchCount > 0) && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                    {isBatchProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                    <span>일괄 채점 진행 현황</span>
                  </span>
                  <span className="font-mono text-indigo-700 font-bold">
                    {completedBatchCount} / {batchQueue.length}명 완료 ({batchQueue.length > 0 ? Math.round((completedBatchCount / batchQueue.length) * 100) : 0}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${batchQueue.length > 0 ? (completedBatchCount / batchQueue.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                {batchStatusMessage && (
                  <p className="text-xs text-slate-600 font-medium pt-1">
                    {batchStatusMessage}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons Bar */}
            {batchQueue.length > 0 && (
              <div className="space-y-3 pt-2">
                {/* Time-lagged Upload & Selective Grading Guidance Banner */}
                <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100 rounded-xl p-3.5 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start space-x-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900">시차 채점 및 학생별 개별 채점 지원</p>
                      <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                        답안지를 시차를 두고 순차 업로드하셔도 <strong>이미 채점된 학생은 보존</strong>되며, 새로 들어온 파일만 <strong>[미채점 일괄 채점]</strong>하거나 각 행의 <strong>[개별 채점]</strong> 버튼으로 즉시 채점할 수 있습니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 self-start sm:self-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100/70 text-emerald-800 border border-emerald-300">
                      완료 {completedBatchCount}명
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100/70 text-indigo-800 border border-indigo-300">
                      대기 {pendingBatchCount}명
                    </span>
                    {errorBatchCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100/70 text-rose-800 border border-rose-300">
                        오류 {errorBatchCount}명
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleClearBatchQueue}
                      disabled={isBatchProcessing}
                      className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      대기열 전체 비우기
                    </button>
                    {isBatchProcessing && (
                      <button
                        onClick={() => {
                          abortBatchRef.current = true;
                        }}
                        className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                      >
                        채점 중단
                      </button>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
                    {/* If sample files loaded, offer fast simulation */}
                    {batchQueue.some((i) => i.id.startsWith('sample-batch')) && (
                      <button
                        id="run-fast-simulate-batch-btn"
                        disabled={isBatchProcessing}
                        onClick={() => handleInstantSimulateBatch({ reevaluateAll: false })}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>테스트 학급 고속 일괄 채점</span>
                      </button>
                    )}

                    {/* Re-evaluate all option if some were already completed */}
                    {completedBatchCount > 0 && (
                      <button
                        disabled={isBatchProcessing}
                        onClick={() => {
                          handleStartBatchEvaluation({ reevaluateAll: true });
                        }}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                        title="이미 완료된 답안지를 포함해 대기열 전체를 다시 채점합니다"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>전체 재채점 ({batchQueue.length}명)</span>
                      </button>
                    )}

                    {/* Primary Batch Evaluation Button: Only evaluates un-evaluated items */}
                    {unEvaluatedBatchCount > 0 ? (
                      <button
                        id="run-batch-evaluation-btn"
                        disabled={isBatchProcessing}
                        onClick={() => handleStartBatchEvaluation({ reevaluateAll: false })}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isBatchProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>채점 진행 중 ({currentBatchIndex}/{unEvaluatedBatchCount})...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-white" />
                            <span>미채점 답안지 일괄 채점 ({unEvaluatedBatchCount}명)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>대기열 전원 채점 완료 ({batchQueue.length}명)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Batch File Queue Table */}
          {batchQueue.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  <span>업로드 대기열 및 채점 상태 ({batchQueue.length}명)</span>
                </h3>
                <span className="text-xs text-slate-500">
                  완료: <strong className="text-emerald-600">{completedBatchCount}</strong>건 / 오류: <strong className="text-rose-600">{errorBatchCount}</strong>건 / 대기: <strong className="text-indigo-600">{pendingBatchCount}</strong>건
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">No</th>
                      <th className="py-2.5 px-4">파일명</th>
                      <th className="py-2.5 px-4">추출된 학생 정보</th>
                      <th className="py-2.5 px-4">채점 상태</th>
                      <th className="py-2.5 px-4 text-center">총점 (16점 만점)</th>
                      <th className="py-2.5 px-4 text-center">단어 수</th>
                      <th className="py-2.5 px-4 text-center w-56">채점 실행 / 관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {batchQueue.map((item, idx) => {
                      const isSuccess = item.status === 'success';
                      const isError = item.status === 'error';
                      const isProcessing = item.status === 'processing';

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isProcessing ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 max-w-[220px]">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="truncate">{item.fileName}</span>
                              {item.isPdfPage && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                  <FileStack className="w-3 h-3 text-amber-700" />
                                  <span>p.{item.pageIndex}/{item.totalPdfPages}</span>
                                </span>
                              )}
                            </div>
                            <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                              {(item.fileSize / 1024).toFixed(1)} KB {item.originalPdfName ? `(원본: ${item.originalPdfName})` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {item.studentInfo?.name ? (
                              <span className="font-semibold text-slate-900">
                                {item.studentInfo.grade || '3'}-{item.studentInfo.classNum || '1'}-
                                {item.studentInfo.studentNum || String(idx + 1)}{' '}
                                {item.studentInfo.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">OCR 인식 대기 중</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isProcessing && (
                              <span className="inline-flex items-center space-x-1 text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>채점 분석 중...</span>
                              </span>
                            )}
                            {isSuccess && (
                              <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>채점 완료</span>
                              </span>
                            )}
                            {isError && (
                              <span className="inline-flex items-center space-x-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>오류: {item.errorMessage}</span>
                              </span>
                            )}
                            {item.status === 'idle' && (
                              <span className="inline-flex items-center space-x-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-medium">
                                <span>채점 대기</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.result ? (
                              <span className="font-bold text-indigo-700 bg-indigo-50/70 px-2 py-1 rounded text-xs">
                                {item.result.scores.totalScore} / 16점
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">
                            {item.result ? `${item.result.wordCount}단어` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isProcessing ? (
                              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>채점 중...</span>
                              </div>
                            ) : isSuccess ? (
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => {
                                    onSelectStudentForPrint(item.result!.id);
                                    onNavigateToTab('student');
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                                  title="학생 피드백지 보기"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>피드백지</span>
                                </button>
                                <button
                                  onClick={() => handleEvaluateSingleItem(item.id)}
                                  disabled={isBatchProcessing}
                                  className="px-2 py-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                                  title="이 답안지만 다시 채점"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>재채점</span>
                                </button>
                                <button
                                  onClick={() => handleRemoveFromQueue(item.id)}
                                  disabled={isBatchProcessing}
                                  className="text-slate-300 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                                  title="대기열에서 제거"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : isError ? (
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleEvaluateSingleItem(item.id)}
                                  disabled={isBatchProcessing}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                                  title="채점 재시도"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>재시도</span>
                                </button>
                                <button
                                  onClick={() => handleRemoveFromQueue(item.id)}
                                  disabled={isBatchProcessing}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                                  title="대기열에서 제거"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              /* status === 'idle' (채점 대기 상태) */
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleEvaluateSingleItem(item.id)}
                                  disabled={isBatchProcessing}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                                  title="이 답안지만 즉시 개별 채점"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>개별 채점</span>
                                </button>
                                <button
                                  onClick={() => handleRemoveFromQueue(item.id)}
                                  disabled={isBatchProcessing}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                                  title="대기열에서 제거"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Quick Links when batch has results */}
              {batchSummaryRecordList.length > 0 && (
                <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-indigo-900 font-medium">
                    ✓ 총 <strong>{batchSummaryRecordList.length}명</strong>의 학생이 성공적으로 채점되어 데이터베이스에 기록되었습니다.
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onNavigateToTab('teacher')}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>교사용 성적 시트 바로가기</span>
                    </button>
                    <button
                      onClick={() => onNavigateToTab('student')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>학생 피드백지 일괄 인쇄 (A4)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Layers className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">일괄 채점 대기열이 비어 있습니다</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  상단의 업로드 영역에 학생들의 답안 스캔본(최대 30명)을 업로드하거나, 상단 우측의 
                  <strong> "테스트용 28명 학급 데이터 불러오기"</strong> 버튼을 눌러 즉시 일괄 채점 시스템을 시뮬레이션해 보세요.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SINGLE MODE (Individual detailed grading & text editing)               */}
      {/* ========================================================================= */}
      {activeMode === 'single' && (
        <div>
          {/* Quick Sample Answers Test Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>개별 샘플 학생 답안 불러오기 (원클릭 테스트):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleLoadSingleSample(0)}
                  className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition font-medium"
                >
                  예시 1: 김철수 (16점 만점 모범 답안)
                </button>
                <button
                  onClick={() => handleLoadSingleSample(1)}
                  className="text-xs px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition font-medium"
                >
                  예시 2: 이영희 (13점, 분사/분량 보완)
                </button>
                <button
                  onClick={() => handleLoadSingleSample(2)}
                  className="text-xs px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg transition font-medium"
                >
                  예시 3: 박민수 (9점, because 미사용/38단어)
                </button>
              </div>
            </div>
          </div>

          {/* Main Two-Column Input & Scoring Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Upload & Input Form (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span>개별 학생 답안 입력 및 스캔본 업로드</span>
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">16점 루브릭</span>
                </div>

                {/* Student Metadata Inputs */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    학생 기본 정보 (답안지 상단)
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">학년</span>
                      <input
                        type="text"
                        value={singleStudentInfo.grade}
                        onChange={(e) =>
                          setSingleStudentInfo({ ...singleStudentInfo, grade: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">반</span>
                      <input
                        type="text"
                        value={singleStudentInfo.classNum}
                        onChange={(e) =>
                          setSingleStudentInfo({ ...singleStudentInfo, classNum: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">번호</span>
                      <input
                        type="text"
                        value={singleStudentInfo.studentNum}
                        onChange={(e) =>
                          setSingleStudentInfo({ ...singleStudentInfo, studentNum: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">이름</span>
                      <input
                        type="text"
                        value={singleStudentInfo.name}
                        onChange={(e) =>
                          setSingleStudentInfo({ ...singleStudentInfo, name: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                        placeholder="김철수"
                      />
                    </div>
                  </div>
                </div>

                {/* Scan/File Upload Zone */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      답안지 스캔본 파일 (선택)
                    </label>
                    {singleFile && (
                      <button
                        onClick={() => {
                          setSingleFile(null);
                          setSingleFileBase64(null);
                          setSinglePreviewUrl(null);
                        }}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        파일 제거
                      </button>
                    )}
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) processSingleFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => singleFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      singleFile
                        ? 'border-indigo-400 bg-indigo-50/30'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={singleFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSingleFileChange}
                      className="hidden"
                    />

                    {singleFile ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800">{singleFile.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {(singleFile.size / 1024).toFixed(1)} KB · 파일 준비 완료
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold text-indigo-600 hover:underline">
                            스캔본 파일 선택
                          </span>
                          하거나 여기로 드래그 앤 드롭
                        </div>
                        <p className="text-[11px] text-slate-400">
                          지원 포맷: JPG, PNG, PDF (스마트폰 사진 및 평판 스캔본)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Multi-page PDF detected notice in Single Mode */}
                  {multiPagePdfInSingle && (
                    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start space-x-2.5">
                        <FileStack className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-900">
                            다중 페이지 PDF 감지 (총 {multiPagePdfInSingle.totalPages}페이지)
                          </p>
                          <p className="text-amber-700 text-[11px] mt-0.5">
                            업로드하신 PDF는 학생 여러 명의 답안지가 한 파일에 묶여 있는 스캔본입니다.
                            학급 일괄 채점으로 전환하시면 전원 1장씩 자동 분할되어 한 번에 채점할 수 있습니다!
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleTransferMultiPageToBatch}
                        className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-xs flex items-center space-x-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>학급 일괄 채점으로 전환하여 {multiPagePdfInSingle.totalPages}명 전체 자동 분할하기</span>
                      </button>
                    </div>
                  )}

                  {singlePreviewUrl && (
                    <div className="mt-3 p-2 bg-slate-100 rounded-lg flex items-center space-x-3">
                      <img
                        src={singlePreviewUrl}
                        alt="답안지 미리보기"
                        className="w-14 h-14 object-cover rounded border border-slate-200"
                      />
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">이미지 미리보기</span>
                        <p className="text-[11px] text-slate-500">답안지 OCR 텍스트 자동 추출 예정</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Text Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>답안 텍스트 (직접 입력 또는 전사 확인/수정)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      단어 수: {singleStudentText.trim() ? singleStudentText.trim().split(/\s+/).length : 0}단어
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={singleStudentText}
                    onChange={(e) => setSingleStudentText(e.target.value)}
                    placeholder="학생이 최종문(Final Writing)에 작성한 영어 답안을 입력하거나, 상단에서 스캔본을 업로드하면 자동으로 OCR 인식됩니다.&#10;예: My hidden hero is Mr. Kang, a dedicated firefighter..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono leading-relaxed resize-y"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * 80단어 이상(4점) / 60~79단어(3점) / 59단어 이하(2점) / 백지(1점)
                  </p>
                </div>

                {/* Error message */}
                {singleErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{singleErrorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="start-single-ai-evaluation-btn"
                  type="button"
                  disabled={isSingleLoading}
                  onClick={handleSingleEvaluate}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-sm flex items-center justify-center space-x-2 transition-all ${
                    isSingleLoading
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
                  }`}
                >
                  {isSingleLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>{singleLoadingStep || 'AI 채점 진행 중...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>AI 채점 & 피드백 생성 실행 (16점 루브릭)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Instant Result Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {lastSingleResult ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        채점 완료
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {lastSingleResult.studentInfo.grade}학년 {lastSingleResult.studentInfo.classNum}반 {lastSingleResult.studentInfo.studentNum}번 {lastSingleResult.studentInfo.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">총점 (교사용)</div>
                      <div className="text-2xl font-black text-indigo-600">
                        {lastSingleResult.scores.totalScore}
                        <span className="text-sm font-normal text-slate-400">/16점</span>
                      </div>
                    </div>
                  </div>

                  {/* Rubric Score Breakdown (Teacher Only, 4 items) */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                      <span>교사용 4대 채점 항목 점수</span>
                      <span className="text-[10px] text-rose-600 font-normal">
                        * 학생 피드백지에는 비노출
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">본문1(특징)</div>
                        <div className="font-bold text-indigo-700">{lastSingleResult.scores.body1Score}/4</div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">본문2(이유)</div>
                        <div className="font-bold text-indigo-700">{lastSingleResult.scores.body2Score}/4</div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">언어형식</div>
                        <div className="font-bold text-indigo-700">{lastSingleResult.scores.languageScore}/4</div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">단어수</div>
                        <div className="font-bold text-indigo-700">{lastSingleResult.scores.wordCountScore}/4</div>
                      </div>
                    </div>
                    {/* Teacher Memo */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                      <strong className="text-indigo-900">단문 메모:</strong> {lastSingleResult.teacherMemo}
                    </div>
                  </div>

                  {/* Student Feedback Preview */}
                  <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 space-y-3">
                    <div className="text-xs font-bold text-indigo-950 flex items-center justify-between">
                      <span>학생용 피드백 미리보기 ({lastSingleResult.studentInfo.grade}학년 {lastSingleResult.studentInfo.classNum}반 {lastSingleResult.studentInfo.studentNum}번 · 이름 비공개)</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-medium">
                        반·번호 표기
                      </span>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-indigo-100 text-xs space-y-2">
                      <div className="font-bold text-slate-800 text-[11px] text-indigo-700">
                        ■ 영역별 성취 수준
                      </div>
                      <div className="space-y-1 text-slate-600 pl-1 text-[11px]">
                        <div>
                          • 내용 구성 (영웅 특징 및 이유):{' '}
                          <span className="text-amber-500 font-bold">
                            {lastSingleResult.studentFeedback.achievementLevels.contentStars}
                          </span>
                        </div>
                        <div>
                          • 언어 형식 (분사 표현, 접속사 because):{' '}
                          <span className="text-amber-500 font-bold">
                            {lastSingleResult.studentFeedback.achievementLevels.languageStars}
                          </span>
                        </div>
                        <div>
                          • 분량 및 어휘:{' '}
                          <span className="text-amber-500 font-bold">
                            {lastSingleResult.studentFeedback.achievementLevels.volumeStars}
                          </span>{' '}
                          ({lastSingleResult.studentFeedback.achievementLevels.wordCountNote})
                        </div>
                      </div>

                      {/* Language Analysis & Errors */}
                      <div className="pt-1">
                        <div className="font-bold text-[11px] text-amber-900 flex items-center justify-between">
                          <span>■ 언어형식 평가 및 오류 감점 안내</span>
                          {lastSingleResult.languageAnalysis && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              {lastSingleResult.languageAnalysis.deduction > 0
                                ? `감점 오류 ${lastSingleResult.languageAnalysis.errorCount}개 (-${lastSingleResult.languageAnalysis.deduction}점 감점)`
                                : '감점 없음 (대소문자 감점제외)'}
                            </span>
                          )}
                        </div>
                        {lastSingleResult.languageAnalysis?.errors && lastSingleResult.languageAnalysis.errors.length > 0 ? (
                          <div className="mt-1 space-y-1 pl-1">
                            {lastSingleResult.languageAnalysis.errors.slice(0, 3).map((err, idx) => {
                              const isCap =
                                err.isDeducted === false ||
                                (err.errorType && (err.errorType.includes('대소문자') || err.errorType.includes('capital')));
                              return (
                                <div
                                  key={idx}
                                  className={`p-1.5 rounded border text-[11px] flex items-center justify-between ${
                                    isCap
                                      ? 'bg-sky-50/70 border-sky-200'
                                      : 'bg-amber-50/50 border-amber-200'
                                  }`}
                                >
                                  <div>
                                    <span className="line-through text-rose-700 mr-1">{err.text}</span>
                                    <span className="text-indigo-900 font-bold">→ {err.correction}</span>
                                  </div>
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                                      isCap
                                        ? 'bg-sky-100 text-sky-800 border-sky-300 font-semibold'
                                        : 'bg-amber-100/70 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    {isCap ? '대소문자 (감점제외 안내)' : err.errorType}
                                  </span>
                                </div>
                              );
                            })}
                            {lastSingleResult.languageAnalysis.errors.length > 3 && (
                              <div className="text-[10px] text-slate-500 italic">
                                * 외 {lastSingleResult.languageAnalysis.errors.length - 3}개 오류/교정 포함 (피드백지 전문에서 확인)
                              </div>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const isBlank =
                              lastSingleResult.wordCount === 0 ||
                              lastSingleResult.scores.totalScore === 4 ||
                              (lastSingleResult.extractedText && lastSingleResult.extractedText.includes('백지'));
                            if (isBlank) {
                              return (
                                <p className="text-[11px] text-slate-600 pl-1 mt-0.5">
                                  ※ 본문 미작성(백지 제출)으로 분석된 어법 문장이 없습니다. (기본점 1점)
                                </p>
                              );
                            }
                            return (
                              <p className="text-[11px] text-slate-600 pl-1 mt-0.5">
                                ✓ 주요 문법/어휘 오류 2개 이하로 감점 없이 기본 점수를 획득하였습니다. (대소문자는 감점 대상 제외)
                              </p>
                            );
                          })()
                        )}
                      </div>

                      <div className="pt-1 font-bold text-[11px] text-emerald-800">
                        ■ 잘한 점 (Good Points)
                      </div>
                      <p className="text-slate-700 text-[11px] pl-1 leading-relaxed">
                        {lastSingleResult.studentFeedback.goodPoints}
                      </p>

                      <div className="pt-1 font-bold text-[11px] text-blue-800">
                        ■ 더 나은 표현으로 다듬기 (Better Expressions)
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {lastSingleResult.studentFeedback.betterExpressions.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                            <div className="text-slate-500">[원문] {item.original}</div>
                            <div className="text-indigo-700 font-semibold mt-0.5">
                              → [수정] {item.improved}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => onNavigateToTab('teacher')}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 border border-slate-300"
                    >
                      <span>교사용 시트 확인</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        onSelectStudentForPrint(lastSingleResult.id);
                        onNavigateToTab('student');
                      }}
                      className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 shadow-xs"
                    >
                      <span>피드백지 인쇄 (A4 1장)</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">채점 대기 중</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      좌측에서 학생 답안 스캔본을 업로드하거나 영문 텍스트를 입력한 후 채점을 실행해 보세요.
                      즉시 교사용 16점 데이터와 학생용 인쇄물이 생성됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
