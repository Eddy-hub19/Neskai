const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const toMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

const getFileExtension = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""

type PrepareBookUploadOptions = {
  onCompressionProgress?: (percent: number) => void
}

const clampPercent = (percent: number) => Math.max(0, Math.min(100, Math.round(percent)))

const compressEpubToLimit = async (sourceFile: File, onCompressionProgress?: (percent: number) => void): Promise<File> => {
  const JSZip = (await import("jszip")).default
  onCompressionProgress?.(5)
  const zip = await JSZip.loadAsync(await sourceFile.arrayBuffer())
  onCompressionProgress?.(15)

  const compressedBuffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  }, (metadata) => {
    const progress = 15 + metadata.percent * 0.8
    onCompressionProgress?.(clampPercent(progress))
  })

  onCompressionProgress?.(100)

  return new File([compressedBuffer], sourceFile.name, {
    type: sourceFile.type || "application/epub+zip",
    lastModified: Date.now(),
  })
}

const compressPdfToLimit = async (sourceFile: File, onCompressionProgress?: (percent: number) => void): Promise<File> => {
  onCompressionProgress?.(3)

  let currentProgress = 3
  const progressTimer = setInterval(() => {
    currentProgress = Math.min(currentProgress + 3, 92)
    onCompressionProgress?.(currentProgress)
  }, 550)

  const formData = new FormData()
  formData.append("file", sourceFile)

  try {
    const response = await fetch("/api/compress-pdf", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error || "Не удалось сжать PDF на сервере.")
    }

    onCompressionProgress?.(96)
    const compressedArrayBuffer = await response.arrayBuffer()
    onCompressionProgress?.(100)

    return new File([compressedArrayBuffer], sourceFile.name, {
      type: "application/pdf",
      lastModified: Date.now(),
    })
  } finally {
    clearInterval(progressTimer)
  }
}

export const isOverBookUploadLimit = (size: number) => size > MAX_FILE_SIZE_BYTES

export const formatFileSizeMb = (size: number) => toMb(size)

export const prepareBookUploadFile = async (sourceFile: File, options?: PrepareBookUploadOptions): Promise<File> => {
  if (!isOverBookUploadLimit(sourceFile.size)) {
    return sourceFile
  }

  const ext = getFileExtension(sourceFile.name)
  const compressedFile =
    ext === "epub"
      ? await compressEpubToLimit(sourceFile, options?.onCompressionProgress)
      : await compressPdfToLimit(sourceFile, options?.onCompressionProgress)

  if (isOverBookUploadLimit(compressedFile.size)) {
    throw new Error(
      `Не удалось сжать файл до 50 MB. Текущий размер после сжатия: ${toMb(compressedFile.size)}. Попробуйте файл меньшего размера.`,
    )
  }

  options?.onCompressionProgress?.(100)

  return compressedFile
}
