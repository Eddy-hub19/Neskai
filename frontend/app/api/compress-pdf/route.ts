import { spawn } from "node:child_process"
import { once } from "node:events"
import { promises as fs } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

const GS_PROFILES = ["/screen", "/ebook", "/printer"] as const

const runGhostscriptCompress = async (
  inputPath: string,
  outputPath: string,
  profile: (typeof GS_PROFILES)[number],
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-dPDFSETTINGS=${profile}`,
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]

  const process = spawn("gs", args, { stdio: ["ignore", "pipe", "pipe"] })
  let stdout = ""
  let stderr = ""

  process.stdout.on("data", (chunk) => {
    stdout += String(chunk)
  })

  process.stderr.on("data", (chunk) => {
    stderr += String(chunk)
  })

  const [exitCode] = (await once(process, "close")) as [number | null]

  return {
    stdout,
    stderr,
    exitCode: exitCode ?? -1,
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 })
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  if (!isPdf) {
    return NextResponse.json({ error: "Поддерживается только PDF." }, { status: 400 })
  }

  const workDir = path.join(tmpdir(), `pdf-compress-${randomUUID()}`)
  const inputPath = path.join(workDir, "input.pdf")
  const outputPath = path.join(workDir, "output.pdf")

  try {
    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

    let bestOutputBuffer: Buffer | null = null

    for (const profile of GS_PROFILES) {
      const result = await runGhostscriptCompress(inputPath, outputPath, profile)

      if (result.exitCode !== 0) {
        if (result.stderr.includes("not found") || result.stderr.includes("No such file")) {
          return NextResponse.json(
            {
              error:
                "Ghostscript не установлен на сервере. Установите его (например, `brew install ghostscript`) и повторите.",
            },
            { status: 500 },
          )
        }

        continue
      }

      const outputStat = await fs.stat(outputPath)
      const outputBuffer = await fs.readFile(outputPath)

      if (!bestOutputBuffer || outputBuffer.length < bestOutputBuffer.length) {
        bestOutputBuffer = outputBuffer
      }

      if (outputStat.size <= MAX_FILE_SIZE_BYTES) {
        return new NextResponse(outputBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${file.name}"`,
            "X-Compressed-Size": String(outputStat.size),
          },
        })
      }
    }

    if (!bestOutputBuffer) {
      return NextResponse.json(
        { error: "Не удалось сжать PDF. Проверьте, установлен ли Ghostscript и корректен ли файл." },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        error: `Не удалось сжать файл до 50 MB. Минимальный полученный размер: ${(bestOutputBuffer.length / (1024 * 1024)).toFixed(2)} MB.`,
      },
      { status: 422 },
    )
  } catch (error) {
    console.error("PDF compress route error:", error)
    return NextResponse.json({ error: "Ошибка обработки PDF на сервере." }, { status: 500 })
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}
