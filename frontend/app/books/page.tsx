"use client"

import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"
import styles from "@/app/books/books.module.scss"
import Link from "next/link"
import { Plus } from "lucide-react"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import BookList from "@/app/components/BookList/BookList"

interface Book {
  id: number
  title: string
  author: string
  cover_url?: string
  onDelete?: (id: number) => void
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBooks = async () => {
    const { data, error } = await supabase.from("books").select("*").order("id", { ascending: false })

    if (error) {
      console.error("Error fetching books:", error)
    } else {
      setBooks(data as Book[])
    }

    setIsLoading(false)
  }

  const deleteBook = async (id: number) => {
    const { error } = await supabase.from("books").delete().eq("id", id)

    if (error) {
      console.error("Ошибка при удалении:", error)
    }
  }

  useEffect(() => {
    fetchBooks()

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
          fetchBooks()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <main className={styles.main}>
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

        <section className={styles.content}>
          <BookList books={books} onDelete={deleteBook} isLoading={isLoading} />
        </section>
      </div>
    </main>
  )
}
