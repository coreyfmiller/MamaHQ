'use client'

// OCR capability seam. Photo is just another way to produce the raw text the
// extractor consumes, so text-recognition lives behind a swappable provider —
// exactly like Transcriber and Extractor. Today: Tesseract.js, fully in the
// browser (no backend). Later: a server OCR provider (or a vision model) can
// implement the same interface with no change to the Photo screen.

export interface OcrResult {
  text: string
  /** 0–100 average confidence, when the provider reports it. */
  confidence: number
}

export interface Ocr {
  isSupported: () => boolean
  /**
   * Recognize text in an image (data URL or Blob/File). `onProgress` streams
   * 0–1 progress so the UI can show a bar during the (slow) first-run load.
   */
  recognize: (image: string | Blob, onProgress?: (p: number) => void) => Promise<OcrResult>
}

// Tesseract.js loads its worker + core + language data on demand. We keep a
// single worker alive across calls so only the first recognize pays the load cost.
type TesseractWorker = {
  recognize: (img: string | Blob) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<unknown>
}

let workerPromise: Promise<TesseractWorker> | null = null

async function getWorker(onProgress?: (p: number) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Dynamic import so the ~heavy OCR bundle only loads when a photo is captured.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', undefined, {
        logger: (m: { status?: string; progress?: number }) => {
          if (onProgress && typeof m.progress === 'number') onProgress(m.progress)
        },
      })
      return worker as unknown as TesseractWorker
    })()
  }
  return workerPromise
}

export const tesseractOcr: Ocr = {
  isSupported: () => typeof window !== 'undefined',

  async recognize(image, onProgress) {
    const worker = await getWorker(onProgress)
    const { data } = await worker.recognize(image)
    return { text: (data.text ?? '').trim(), confidence: data.confidence ?? 0 }
  },
}

// Active OCR provider. Swapping to a server/vision provider later is a one-line
// change here — the Photo screen never needs to know.
export const ocr: Ocr = tesseractOcr
