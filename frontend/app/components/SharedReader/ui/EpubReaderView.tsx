import type { RefObject } from "react"
import styles from "../SharedReader.module.scss"
import type { ViewMode } from "../lib/types"

type EpubReaderViewProps = {
  scrollHostRef: RefObject<HTMLDivElement | null>
  viewerRef: RefObject<HTMLDivElement | null>
  epubClassName: string
  viewMode: ViewMode
  onContentScroll: (scrollTop: number) => void
  onContentPointerDown: () => void
  onContentDoubleClick: () => void
  onPrevPage: () => void
  onNextPage: () => void
}

export default function EpubReaderView({
  scrollHostRef,
  viewerRef,
  epubClassName,
  viewMode,
  onContentScroll,
  onContentPointerDown,
  onContentDoubleClick,
  onPrevPage,
  onNextPage,
}: EpubReaderViewProps) {
  return (
    <div
      ref={scrollHostRef}
      className={epubClassName}
      onScroll={(event) => {
        onContentScroll(event.currentTarget.scrollTop)
      }}
      onPointerDown={onContentPointerDown}
      onDoubleClick={onContentDoubleClick}
    >
      <div className={styles.sideNav}>
        {viewMode === "paginated" || viewMode === "scrolled" ? <button onClick={onPrevPage}>‹</button> : null}
      </div>
      <div ref={viewerRef} className={styles.readerCanvas} />
      <div className={styles.sideNav}>
        {viewMode === "paginated" || viewMode === "scrolled" ? <button onClick={onNextPage}>›</button> : null}
      </div>
    </div>
  )
}
