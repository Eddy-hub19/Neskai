import { NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const downloadUrl = searchParams.get("download")

  // РЕЖИМ 1: CORS-прокси для скачивания файла книги в Supabase Storage
  if (downloadUrl) {
    try {
      const fileResponse = await fetch(downloadUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })

      if (!fileResponse.ok) throw new Error("Не удалось скачать файл книги с внешнего сервера")

      const arrayBuffer = await fileResponse.arrayBuffer()
      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": `attachment; filename="book.epub"`,
        },
      })
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // РЕЖИМ 2: Поиск книг
  if (!query) {
    return NextResponse.json({ error: "Параметр поиска 'q' обязателен" }, { status: 400 })
  }

  try {
    // Используем зеркало базы Gutenberg/OPDS, которое работает без VPN, капч и блокировок хостингов
    const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`)

    if (!response.ok) {
      throw new Error("Внешний каталог книг недоступен")
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json([])
    }

    // Маппим результаты под наш фронтенд
    const formattedBooks = data.results
      .slice(0, 8)
      .map((item: any) => {
        // Ищем рабочую ссылку на epub файл и обложку в объекте formats
        const epubUrl = item.formats["application/epub+zip"] || null
        const coverUrl = item.formats["image/jpeg"] || null

        // Чистим имена авторов (каталог хранит их как "Достоевский, Фёдор")
        const authorsList = item.authors?.map((a: any) => {
          if (a.name.includes(",")) {
            const parts = a.name.split(",").map((p: string) => p.trim())
            return `${parts[1]} ${parts[0]}`
          }
          return a.name
        }) || ["Неизвестный автор"]

        return {
          id: `gt-${item.id}`,
          title: item.title || "Без названия",
          authors: authorsList,
          coverUrl: coverUrl,
          downloadUrl: epubUrl, // Прямая ссылка на файл для скачивания
        }
      })
      .filter((book: any) => book.downloadUrl) // Показываем только книги, где 100% прикрепился файл

    return NextResponse.json(formattedBooks)
  } catch (error: any) {
    console.error("Ошибка API поиска:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
