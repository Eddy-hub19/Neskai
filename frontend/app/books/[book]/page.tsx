"use client"

import { supabase } from "@/lib/supabase"
import { useEffect, useState, use } from "react"
import SharedReader from "@/app/components/SharedReader/SharedReader"
import type { Highlight } from "@/app/components/SharedReader/lib/types"

interface Book {
  title: string
  file_url: string
}

const resolveBookUrl = (fileUrl: string) => {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl
  }

  const normalizedPath = fileUrl.replace(/^book-files\//, "")
  const {
    data: { publicUrl },
  } = supabase.storage.from("book-files").getPublicUrl(normalizedPath)

  return publicUrl
}

export default function BookReaderPage({ params: paramsPromise }: { params: Promise<{ book: string }> }) {
  const params = use(paramsPromise)
  const [book, setBook] = useState<Book | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBook = async () => {
      const numericBookId = Number(params.book)

      const { data } = await supabase.from("books").select("*").eq("id", params.book).single()
      if (data) {
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
    fetchBook()
  }, [params.book])

  if (loading) {
    return <main>Загрузка...</main>
  }

  if (!book) {
    return <main>Книга не найдена</main>
  }

  return (
    <div style={{ height: "100vh" }}>
      <SharedReader
        bookUrl={resolveBookUrl(book.file_url)}
        bookTitle={book.title}
        highlights={highlights}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
