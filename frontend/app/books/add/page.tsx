"use client"

import { supabase } from "@/lib/supabase"
import { formatFileSizeMb, isOverBookUploadLimit, prepareBookUploadFile } from "@/lib/bookUploadCompression"
import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "./add.module.scss"

export default function AddBookPage() {
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState<number | null>(null)

  const router = useRouter()

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

      const { error: dbError } = await supabase.from("books").insert([
        {
          title,
          author,
          file_url: publicUrl,
          content: `File: ${uploadFile.name}`,
        },
      ])

      if (dbError) throw dbError

      setUploadStatus("Готово")
      router.push("/books")
      router.refresh()
    } catch (error: any) {
      console.error("Подробная ошибка:", error)
      alert(`Ошибка: ${error.message || "Во время загрузки произошла ошибка."}`)
    } finally {
      setIsSubmitting(false)
      setUploadStatus(null)
      setCompressionProgress(null)
    }
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Добавить в Neskai</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
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
            <input
              type="file"
              accept=".pdf,.epub"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className={styles.fileInput}
              required
            />
            <p className={styles.hint}>Поддерживаемые форматы: PDF, EPUB (если размер больше 50 MB, файл будет автоматически сжат)</p>
          </div>
        </div>

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
    </main>
  )
}
