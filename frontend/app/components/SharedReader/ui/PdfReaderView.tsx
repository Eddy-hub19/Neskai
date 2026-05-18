import styles from "../SharedReader.module.scss"

type PdfReaderViewProps = {
  fontSize: number
  normalizedUrl: string
  onContentScroll: (scrollTop: number) => void
  onContentPointerDown: () => void
  onContentDoubleClick: () => void
  onLoad: () => void
}

export default function PdfReaderView({
  fontSize,
  normalizedUrl,
  onContentScroll,
  onContentPointerDown,
  onContentDoubleClick,
  onLoad,
}: PdfReaderViewProps) {
  return (
    <div
      className={styles.pdfScroll}
      onScroll={(event) => {
        onContentScroll(event.currentTarget.scrollTop)
      }}
      onPointerDown={onContentPointerDown}
      onDoubleClick={onContentDoubleClick}
    >
      <div className={styles.pdfSizer} style={{ width: `${fontSize}%` }}>
        <iframe src={`${normalizedUrl}#toolbar=0&view=FitH`} className={styles.pdfFrame} onLoad={onLoad} />
      </div>
    </div>
  )
}
