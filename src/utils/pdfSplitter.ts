import { PDFDocument } from 'pdf-lib';

export interface SplitPdfPage {
  file: File;
  pageNumber: number;
  totalPages: number;
  base64: string;
  originalFileName: string;
}

/**
 * Convert Blob to base64 string using native browser FileReader
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = (reader.result as string) || '';
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Inspect a PDF file and split it into individual 1-page PDF files if multi-page.
 */
export async function splitPdfIntoPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<SplitPdfPage[]> {
  if (!isPdfFile(file)) {
    return [];
  }

  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (totalPages <= 0) {
    return [];
  }

  const results: SplitPdfPage[] = [];
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let i = 0; i < totalPages; i++) {
    if (onProgress) {
      onProgress(i + 1, totalPages);
    }

    const subDoc = await PDFDocument.create();
    const [copiedPage] = await subDoc.copyPages(srcDoc, [i]);
    subDoc.addPage(copiedPage);

    const pdfBytes = await subDoc.save();
    const pageFileName = `${baseName}_p${String(i + 1).padStart(2, '0')}.pdf`;
    
    // Create new File object
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pageFile = new File([blob], pageFileName, { type: 'application/pdf' });
    const base64 = await blobToBase64(blob);

    results.push({
      file: pageFile,
      pageNumber: i + 1,
      totalPages,
      base64,
      originalFileName: file.name,
    });
  }

  return results;
}
