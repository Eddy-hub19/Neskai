"use client"

import { supabase } from "@/lib/supabase"
import { useCallback, useEffect, useState } from "react"
import styles from "@/app/books/books.module.scss"
import Link from "next/link"
import { Plus } from "lucide-react"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import BookList from "@/app/components/BookList/BookList"
import BookSearch from "../components/BookSearch/BookSearch"

interface Book {
  id: number
  title: string
  author: string
  cover_url?: string
  file_url?: string
  onDelete?: (id: number) => void
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBooks = useCallback(async () => {
    const { data, error } = await supabase.from("books").select("*").order("id", { ascending: false })

    if (error) {
      console.error(
        "Error fetching books:",
        error.message ?? error,
        error.details ? `details=${error.details}` : "",
        error.hint ? `hint=${error.hint}` : "",
      )
    } else {
      setBooks(data as Book[])
    }

    setIsLoading(false)
  }, [])

  const deleteBook = async (id: number) => {
    const { error } = await supabase.from("books").delete().eq("id", id)

    if (error) {
      console.error("Ошибка при удалении:", error)
    }
  }

  useEffect(() => {
    let disposed = false
    const scheduleFetch = () => {
      queueMicrotask(() => {
        if (!disposed) {
          void fetchBooks()
        }
      })
    }

    scheduleFetch()

    const channel = supabase
      .channel("library-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "books",
        },
        () => {
          scheduleFetch()
        },
      )
      .subscribe()

    return () => {
      disposed = true
      supabase.removeChannel(channel)
    }
  }, [fetchBooks])

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <DesktopTopActions backHref="/" className={styles.desktopActions} />

          <div className={styles.headerTop}>
            <div className={styles.titleGroup}>
              <h1 className={styles.title}>Neskai</h1>
              <p className={styles.subtitle}>Библиотека</p>
            </div>

            <Link href="/books/add" className={styles.addBookBtn}>
              <Plus size={14} aria-hidden="true" />
              <span>Добавить книгу</span>
            </Link>
          </div>
        </header>

        <div className={styles.contentSearch}>
          <BookSearch onBookAdded={fetchBooks} />
        </div>

        <section className={styles.content}>
          <BookList books={books} onDelete={deleteBook} isLoading={isLoading} />
        </section>
      </div>
    </div>
  )
}
