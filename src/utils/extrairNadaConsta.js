import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extrairCamposNadaConsta } from './nadaConsta.js'
import { criarPreparadorCnh } from './prepararCnhImagem.js'
import { aguardarLeitura } from './ocrCrlv.js'

export async function extrairNadaConsta(file, signal, onProgress = () => {}) {
  let task, renderTask, worker, preparador
  const cancelar = () => {
    renderTask?.cancel()
    task?.destroy().catch(() => {})
    worker?.terminate().catch(() => {})
  }
  signal.addEventListener('abort', cancelar, { once: true })
  let imagem
  const pages = []
  let dados = {}
  const conflitos = new Set()
  try {
    signal.throwIfAborted()
    const pdfFile = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    let pdf
    if (pdfFile) {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/build/pdf.mjs')
      GlobalWorkerOptions.workerSrc = workerUrl
      const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href
      task = getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        standardFontDataUrl: `${assets}standard_fonts/`,
        cMapUrl: `${assets}cmaps/`,
        wasmUrl: `${assets}wasm/`,
      })
      pdf = await task.promise
      if (pdf.numPages > 10) throw new Error('PDF_PAGE_LIMIT')
      for (let n = 1; n <= pdf.numPages; n++) {
        signal.throwIfAborted()
        const page = await pdf.getPage(n)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        pages.push(
          content.items
            .filter((i) => i.str?.trim())
            .map((i) => {
              const [x, y] = viewport.convertToViewportPoint(i.transform[4], i.transform[5])
              return { text: i.str, x, y, width: i.width, height: i.height }
            }),
        )
        page.cleanup()
      }
      dados = extrairCamposNadaConsta(pages, conflitos)
      if (conflitos.size || Object.keys(dados).length >= 3)
        return { dados, usouOcr: false, conflitos: [...conflitos] }
    }
    signal.throwIfAborted()
    onProgress('Preparando a leitura da imagem da certidão…')
    const { createWorker, PSM } = await import('tesseract.js')
    const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
    const pending = createWorker('por', 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base.replace(/\/$/, ''),
      errorHandler: () => {},
      logger: (m) => {
        if (!signal.aborted && m.status === 'recognizing text')
          onProgress(`Lendo a certidão: ${Math.round(m.progress * 100)}%`)
      },
    })
    pending.then(
      (w) => {
        if (signal.aborted) w.terminate().catch(() => {})
      },
      () => {},
    )
    worker = await aguardarLeitura(pending, signal)
    signal.throwIfAborted()
    let preparada
    if (!pdfFile) {
      try {
        preparador = await criarPreparadorCnh(signal, () => {}, { documento: 'CRLV' })
        onProgress('Corrigindo a iluminação e a perspectiva da foto da certidão…')
        preparada = (await preparador.preparar(file)).imagens[0]
      } catch {
        signal.throwIfAborted()
        // OCR still works on the original if image preparation is unavailable.
        onProgress('Lendo a foto original da certidão…')
      } finally {
        preparador?.terminar()
        preparador = null
      }
      if (!preparada) imagem = await createImageBitmap(file)
    }
    for (let n = 1; n <= (pdf ? Math.min(pdf.numPages, 3) : 1); n++) {
      signal.throwIfAborted()
      const canvas = document.createElement('canvas')
      let page
      try {
        if (pdf) {
          page = await pdf.getPage(n)
          const original = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({
            scale: Math.min(4, 2400 / Math.max(original.width, original.height)),
          })
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
          await renderTask.promise
        } else if (preparada) {
          canvas.width = preparada.width
          canvas.height = preparada.height
          canvas
            .getContext('2d')
            .putImageData(
              new ImageData(
                new Uint8ClampedArray(preparada.pixels),
                preparada.width,
                preparada.height,
              ),
              0,
              0,
            )
        } else {
          const scale = Math.min(1, 2400 / Math.max(imagem.width, imagem.height))
          canvas.width = Math.round(imagem.width * scale)
          canvas.height = Math.round(imagem.height * scale)
          canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height)
        }
        const { data } = await aguardarLeitura(
          worker.recognize(
            canvas,
            { tessedit_pageseg_mode: PSM.AUTO },
            { blocks: true, text: true },
          ),
          signal,
        )
        const items = (data.blocks || [])
          .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
          .filter((w) => w.text.trim() && w.confidence >= 60)
          .map((w) => ({
            text: w.text,
            x: w.bbox.x0,
            y: w.bbox.y0,
            width: w.bbox.x1 - w.bbox.x0,
            height: w.bbox.y1 - w.bbox.y0,
          }))
        const divergencias = new Set()
        const leitura = {
          dados: extrairCamposNadaConsta([items], divergencias),
          conflitos: [...divergencias],
        }
        signal.throwIfAborted()
        for (const [name, value] of Object.entries(leitura.dados)) {
          if (dados[name] && dados[name] !== value) conflitos.add(name)
          else dados[name] = value
        }
        leitura.conflitos.forEach((name) => conflitos.add(name))
      } finally {
        renderTask = null
        canvas.width = canvas.height = 0
        page?.cleanup()
      }
    }
    conflitos.forEach((name) => delete dados[name])
    return { dados, usouOcr: true, conflitos: [...conflitos] }
  } finally {
    signal.removeEventListener('abort', cancelar)
    imagem?.close()
    preparador?.terminar()
    await worker?.terminate().catch(() => {})
    await task?.destroy().catch(() => {})
  }
}
