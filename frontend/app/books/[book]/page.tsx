"use client"

import { supabase } from "@/lib/supabase"
import { useEffect, useState, use } from "react"
import Image from "next/image"
import SharedReader from "@/app/components/SharedReader/SharedReader"
import type { Highlight } from "@/app/components/SharedReader/lib/types"
import styles from "./page.module.scss"

interface Book {
  title: string
  file_url: string
  cover_url?: string | null
}

const isDirectUrl = (value: string) => /^(https?:|blob:|data:)/i.test(value)
const STORAGE_PUBLIC_PREFIX = /^\/?storage\/v1\/object\/public\/book-files\//

const resolveBookUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return fileUrl
  }

  if (isDirectUrl(fileUrl)) {
    return fileUrl
  }

  const supabaseBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")

  if (supabaseBaseUrl && STORAGE_PUBLIC_PREFIX.test(fileUrl)) {
    const storagePath = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`
    return `${supabaseBaseUrl}${storagePath}`
  }

  const normalizedPath = fileUrl
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/book-files\//, "")
    .replace(STORAGE_PUBLIC_PREFIX, "")
    .replace(/^book-files\//, "")
    .replace(/^\/+/, "")

  const {
    data: { publicUrl },
  } = supabase.storage.from("book-files").getPublicUrl(normalizedPath)

  if (isDirectUrl(publicUrl)) {
    return publicUrl
  }

  if (typeof window !== "undefined") {
    return new URL(publicUrl || normalizedPath, window.location.origin).toString()
  }

  return publicUrl || normalizedPath
}

export default function BookReaderPage({ params: paramsPromise }: { params: Promise<{ book: string }> }) {
  const params = use(paramsPromise)
  const [book, setBook] = useState<Book | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [isReaderReady, setIsReaderReady] = useState(false)

  useEffect(() => {
    const fetchBook = async () => {
      const numericBookId = Number(params.book)

      const { data } = await supabase.from("books").select("*").eq("id", params.book).single()
      if (data) {
        setIsReaderReady(false)
        setBook(data)
      }

      if (Number.isInteger(numericBookId) && numericBookId > 0) {
        const { data: annotations } = await supabase
          .from("annotations")
          .select("cfi_range, color")
          .eq("book_id", numericBookId)

        const mappedHighlights = (annotations ?? []).map((item) => ({
          cfiRange: item.cfi_range,
          color: item.color || "rgba(0, 242, 255, 0.35)",
        }))

        setHighlights(mappedHighlights)
      }

      setLoading(false)
    }

    void fetchBook()
  }, [params.book])

  if (loading) {
    return <div>Загрузка...</div>
  }

  if (!book) {
    return <div>Книга не найдена</div>
  }

  return (
    <div className={styles.readerRoot}>
      <div className={`${styles.coverFallback} ${isReaderReady ? styles.hidden : ""}`} aria-hidden={isReaderReady}>
        <div className={styles.coverCard}>
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Обложка книги ${book.title}`}
              className={styles.coverImage}
              width={300}
              height={420}
              unoptimized={book.cover_url.startsWith("data:")}
            />
          ) : (
            <div className={styles.placeholderBook} />
          )}
        </div>
      </div>

      <SharedReader
        key={book.file_url}
        bookUrl={resolveBookUrl(book.file_url)}
        bookTitle={book.title}
        highlights={highlights}
        onContentReady={() => setIsReaderReady(true)}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
