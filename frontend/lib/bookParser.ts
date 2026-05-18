import ePub from "epubjs"
import type { Book as EpubBook } from "epubjs"

export interface BookMetadata {
  title: string
  author: string
  cover: string | null
}

const metadataCache = new Map<string, BookMetadata>()
let hasConfiguredPdfWorker = false

const EMPTY_METADATA: BookMetadata = {
  title: "",
  author: "",
  cover: null,
}

const getFileExtension = (fileName: string): string => {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

const getCacheKey = (file: File): string => {
  return [file.name, file.size, file.lastModified, file.type].join("::")
}

const toDataUrl = async (source: string): Promise<string | null> => {
  try {
    const response = await fetch(source)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const normalizeCoverUrl = async (coverUrl: string | null): Promise<string | null> => {
  if (!coverUrl) return null
  if (coverUrl.startsWith("data:")) return coverUrl

  const asDataUrl = await toDataUrl(coverUrl)
  if (coverUrl.startsWith("blob:")) {
    URL.revokeObjectURL(coverUrl)
  }

  return asDataUrl || coverUrl
}

const extractFromEpub = async (arrayBuffer: ArrayBuffer): Promise<BookMetadata> => {
  const book = ePub(arrayBuffer) as EpubBook & {
    metadata?: { title?: string; creator?: string }
    coverUrl?: () => Promise<string | null>
    loaded?: {
      metadata?: Promise<{ title?: string; creator?: string }>
    }
  }

  const metadata = book.metadata ?? (await book.loaded?.metadata) ?? {}
  const rawCover = typeof book.coverUrl === "function" ? await book.coverUrl() : null
  const cover = await normalizeCoverUrl(rawCover)

  return {
    title: metadata.title ?? "",
    author: metadata.creator ?? "",
    cover: cover ?? null,
  }
}

const extractFromPdf = async (arrayBuffer: ArrayBuffer): Promise<BookMetadata> => {
  if (typeof document === "undefined") {
    return EMPTY_METADATA
  }

  const pdfjsLib = await import("pdfjs-dist")

  if (!hasConfiguredPdfWorker) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    hasConfiguredPdfWorker = true
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  const metadataResult = await pdf.getMetadata()
  const info = metadataResult.info as { Title?: string; Author?: string } | undefined

  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.5 })
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    return {
      title: info?.Title ?? "",
      author: info?.Author ?? "",
      cover: null,
    }
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  try {
    await page.render({ canvas, canvasContext: context, viewport }).promise
  } catch {
    return {
      title: info?.Title ?? "",
      author: info?.Author ?? "",
      cover: null,
    }
  }

  const cover = canvas.toDataURL("image/jpeg", 0.8)

  return {
    title: info?.Title ?? "",
    author: info?.Author ?? "",
    cover,
  }
}

export const extractBookMetadata = async (file: File): Promise<BookMetadata> => {
  const cacheKey = getCacheKey(file)
  const cached = metadataCache.get(cacheKey)
  if (cached) {
    return { ...cached }
  }

  const extension = getFileExtension(file.name)

  try {
    const arrayBuffer = await file.arrayBuffer()

    if (extension === "epub") {
      const metadata = await extractFromEpub(arrayBuffer)
      metadataCache.set(cacheKey, metadata)
      return { ...metadata }
    }

    if (extension === "pdf") {
      const metadata = await extractFromPdf(arrayBuffer)
      metadataCache.set(cacheKey, metadata)
      return { ...metadata }
    }
  } catch (error) {
    console.error("Ошибка при извлечении метаданных книги:", error)
  }

  return { ...EMPTY_METADATA }
}
