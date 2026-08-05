"use client"

import { useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import styles from "./BookSearch.module.scss"
import { t } from "@/lib/i18n"

interface SearchedBook {
  id: string
  title: string
  authors: string[]
  coverUrl: string | null
  downloadUrl: string | null
}

export default function BookSearch({ onBookAdded }: { onBookAdded: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchedBook[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(false)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error(t("Сбой при поиске"))

      const data = await response.json()
      setResults(data)
      setSearched(true)
    } catch (err) {
      console.error(t("Ошибка поиска:"), err)
      setResults([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBook = async (book: SearchedBook) => {
    if (!book.downloadUrl) {
      alert(t("Для этой книги недоступен файл скачивания."))
      return
    }

    setAddingId(book.id)
    try {
      // 1. Проверяем, авторизован ли пользователь в Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return alert(t("Нужно авторизоваться, чтобы добавить книгу"))

      // 2. Скачиваем файл .epub через наш прокси-роут, чтобы обойти CORS
      const fileResponse = await fetch(`/api/search?download=${encodeURIComponent(book.downloadUrl)}`)
      if (!fileResponse.ok) throw new Error(t("Не удалось скачать файл книги"))
      const fileBlob = await fileResponse.blob()

      // 3. Генерируем уникальное имя для файла в хранилище Supabase
      const fileName = `${user.id}-${Date.now()}.epub`

      // 4. Загружаем скачанный Blob напрямую в твой бакет book-files
      const { error: uploadError } = await supabase.storage.from("book-files").upload(fileName, fileBlob, {
        contentType: "application/epub+zip",
        cacheControl: "3600",
      })

      if (uploadError) throw uploadError

      // 5. Получаем рабочую публичную ссылку на сохраненный файл
      const {
        data: { publicUrl },
      } = supabase.storage.from("book-files").getPublicUrl(fileName)

      const formattedAuthor = book.authors.join(", ")

      // 6. Создаем полноценную запись в таблице books с file_url (больше никакого null!)
      const { error: insertError } = await supabase.from("books").insert([
        {
          title: book.title,
          author: formattedAuthor,
          cover_url: book.coverUrl,
          user_id: user.id, // Связываем с юзером, как настроено в Foreign Keys
          file_url: publicUrl, // Прямая ссылка для SharedReader
        },
      ])

      if (insertError) throw insertError

      // Очищаем форму поиска и обновляем Bento-сетку библиотеки
      setResults([])
      setQuery("")
      setSearched(false)
      onBookAdded()

      alert(t("Книга \"{title}\" добавлена и готова к чтению!", { title: book.title }))
    } catch (err: any) {
      console.error("Ошибка при добавлении книги:", err)
      alert(`Ошибка добавления: ${err.message || "Неизвестный сбой"}`)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className={styles.searchSection}>
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          placeholder="Найти книгу по названию или автору..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchBtn} disabled={loading}>
          {loading ? "..." : "ПОИСК"}
        </button>
      </form>

      {(results.length > 0 || (searched && results.length === 0)) && (
        <div className={styles.resultsGrid}>
          {results.length === 0 && <div className={styles.noResults}>{t("Книг с файлами не найдено")}</div>}

          {results.map((book) => (
            <div key={book.id} className={styles.bookCard}>
              <div className={styles.coverWrapper}>
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    width={90}
                    height={130}
                    className={styles.cover}
                    unoptimized
                  />
                ) : (
                  <div className={styles.noCover}>{t("Нет обложки")}</div>
                )}
              </div>
              <div className={styles.bookInfo}>
                <h4 className={styles.bookTitle}>{book.title}</h4>
                <p className={styles.bookAuthor}>{book.authors.join(", ")}</p>
                <button
                  onClick={() => handleAddBook(book)}
                  disabled={addingId === book.id || !book.downloadUrl}
                  className={styles.addBtn}
                >
                  {addingId === book.id ? t("Скачивание...") : t("+ Читать сразу")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
