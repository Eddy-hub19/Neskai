export const downloadBook = async (fileUrl: string, fileName: string) => {
  try {
    const response = await fetch(fileUrl, {
      method: "GET",
      mode: "cors",
    })

    if (!response.ok) {
      throw new Error(`Ошибка загрузки файла: ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)

    const extension = fileUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "epub"
    const safeName = fileName.trim() || "book"
    const normalizedName = safeName.endsWith(`.${extension}`) ? safeName : `${safeName}.${extension}`

    const link = document.createElement("a")
    link.href = objectUrl
    link.download = normalizedName
    link.style.display = "none"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.URL.revokeObjectURL(objectUrl)
  } catch (error) {
    console.error("Не удалось скачать книгу:", error)
    alert("Ошибка при скачивании. Проверьте доступ к файлу в хранилище.")
  }
}
