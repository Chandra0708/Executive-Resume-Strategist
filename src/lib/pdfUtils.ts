import * as pdfjs from 'pdfjs-dist';

// @ts-ignore - pdfjs-dist/build/pdf.worker.min.mjs?url is a Vite-specific import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    if (!fullText.trim()) {
      throw new Error('No text content found in PDF');
    }

    return fullText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
}
