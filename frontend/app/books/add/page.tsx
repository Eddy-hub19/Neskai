"use client"

import { supabase } from "@/lib/supabase"
import { extractBookMetadata } from "@/lib/bookParser"
import { formatFileSizeMb, isOverBookUploadLimit, prepareBookUploadFile } from "@/lib/bookUploadCompression"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./add.module.scss"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"

const uploadCoverToStorage = async (cover: string): Promise<string | null> => {
  try {
    const response = await fetch(cover)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const extension = blob.type.includes("png") ? "png" : "jpg"
    const fileName = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`

    const { error } = await supabase.storage.from("book-files").upload(fileName, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: blob.type || "image/jpeg",
    })

    if (error) {
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("book-files").getPublicUrl(fileName)

    return publicUrl || null
  } catch {
    return null
  }
}

const normalizeCoverFallback = (cover: string | null): string | null => {
  if (!cover) return null
  if (cover.startsWith("data:")) return cover
  if (cover.startsWith("http://") || cover.startsWith("https://")) return cover
  return null
}

export default function AddBookPage() {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewCover, setPreviewCover] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState<number | null>(null)

  const router = useRouter()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null
    setFile(selectedFile)

    if (!selectedFile) {
      setPreviewCover(null)
      return
    }

    const { title: parsedTitle, author: parsedAuthor, cover } = await extractBookMetadata(selectedFile)

    if (!title && parsedTitle) {
      setTitle(parsedTitle)
    }

    if (!author && parsedAuthor) {
      setAuthor(parsedAuthor)
    }

    setPreviewCover(cover)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      alert("Пожалуйста, выберите файл для загрузки.")
      return
    }

    setIsSubmitting(true)
    setUploadStatus(null)
    setCompressionProgress(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("Вы не авторизованы. Пожалуйста, войдите снова.")
      }

      const shouldCompress = isOverBookUploadLimit(file.size)

      setUploadStatus(shouldCompress ? "Сжимаем файл до 50 MB перед загрузкой..." : "Готовим файл к загрузке...")
      if (shouldCompress) {
        setCompressionProgress(0)
      }

      const uploadFile = await prepareBookUploadFile(file, {
        onCompressionProgress: (percent) => setCompressionProgress(percent),
      })

      setUploadStatus(`Загружаем файл (${formatFileSizeMb(uploadFile.size)})...`)
      setCompressionProgress(null)

      const fileExt = uploadFile.name.split(".").pop()?.toLowerCase() ?? ""
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: fileError } = await supabase.storage.from("book-files").upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
      })

      if (fileError) throw fileError

      const {
        data: { publicUrl },
      } = supabase.storage.from("book-files").getPublicUrl(fileName)

      setUploadStatus("Сохраняем карточку книги...")
      const uploadedCoverUrl = previewCover ? await uploadCoverToStorage(previewCover) : null
      const resolvedCoverUrl = uploadedCoverUrl ?? normalizeCoverFallback(previewCover)

      const { error: dbError } = await supabase.from("books").insert([
        {
          title,
          author,
          file_url: publicUrl,
          cover_url: resolvedCoverUrl,
          content: `File: ${uploadFile.name}`,
        },
      ])

      if (dbError) throw dbError

      setUploadStatus("Готово")
      router.push("/books")
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Во время загрузки произошла ошибка."
      console.error("Подробная ошибка:", error)
      alert(`Ошибка: ${message}`)
    } finally {
      setIsSubmitting(false)
      setUploadStatus(null)
      setCompressionProgress(null)
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Добавить свою книгу</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <DesktopTopActions backHref="/" className={styles.desktopActions} />
        <div className={styles.inputGroup}>
          <label>Название книги</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Граф Монте-Кристо"
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Автор</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Например: Александр Дюма"
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Файл книги</label>
          <div className={styles.fileInputWrapper}>
            <input type="file" accept=".pdf,.epub" onChange={handleFileSelect} className={styles.fileInput} required />
            <p className={styles.hint}>
              Поддерживаемые форматы: PDF, EPUB (если размер больше 50 MB, файл будет автоматически сжат)
            </p>
          </div>
        </div>

        {previewCover && (
          <div className={styles.coverPreviewWrap}>
            <p className={styles.coverPreviewLabel}>Распознанная обложка</p>
            <Image
              src={previewCover}
              alt="Превью обложки книги"
              className={styles.coverPreviewImage}
              width={170}
              height={240}
              unoptimized
            />
          </div>
        )}

        {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}

        {compressionProgress !== null && (
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${compressionProgress}%` }} />
            </div>
            <p className={styles.progressText}>Сжатие: {compressionProgress}%</p>
          </div>
        )}

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? "Загружаем на сервер..." : "Добавить на полку →"}
        </button>
      </form>
    </div>
  )
}
