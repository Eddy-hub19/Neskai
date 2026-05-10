"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import styles from "./BookList.module.scss"

interface Book {
  id: number
  title: string
  author: string
  cover_url?: string
}

interface BookListProps {
  books: Book[]
  onDelete?: (id: number) => void
  isLoading?: boolean
}

const hashString = (value: string) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

const getCoverVars = (book: Book) => {
  const seed = hashString(`${book.id}-${book.title}-${book.author}`)
  const hueA = seed % 360
  const hueB = (hueA + 42) % 360
  const textureShift = (seed % 12) + 8

  return {
    "--cover-hue-a": `${hueA}`,
    "--cover-hue-b": `${hueB}`,
    "--cover-shift": `${textureShift}px`,
  } as CSSProperties
}

const getReadingProgress = (bookId: number) => {
  return 8 + ((bookId * 17) % 71)
}

export default function BookList({ books, onDelete, isLoading = false }: BookListProps) {
  if (isLoading) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`skeleton-${index}`} className={styles.skeletonItem}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonLine} ${styles.shortLine}`} />
          </div>
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyContent}>
          <h3 className={styles.emptyTitle}>В библиотеке пока пусто</h3>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {books.map((book) => {
        const readingProgress = getReadingProgress(book.id)

        return (
          <Link href={`/books/${book.id}`} key={book.id} className={styles.bookItem}>
            <div className={styles.bookCard}>
              <div className={styles.spine} />

              <button
                className={styles.deleteBtn}
                aria-label={`Удалить книгу ${book.title}`}
                onClick={(e) => {
                  e.preventDefault()
                  if (confirm("Удалить эту книгу?")) {
                    onDelete?.(book.id)
                  }
                }}
              >
                ✕
              </button>

              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className={styles.cover} />
              ) : (
                <div className={styles.placeholder} style={getCoverVars(book)}>
                  <span className={styles.embossedTitle}>{book.title}</span>
                  <span className={styles.placeholderAuthor}>{book.author}</span>
                </div>
              )}

              <div className={styles.overlay} />
            </div>

            <div className={styles.info}>
              <h3 className={styles.title}>{book.title}</h3>
              <p className={styles.author}>{book.author}</p>

              <div className={styles.progressRow}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${readingProgress}%` }} />
                </div>
                <div className={styles.progressMeta}>
                  <span className={styles.percentage}>{readingProgress}%</span>
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
