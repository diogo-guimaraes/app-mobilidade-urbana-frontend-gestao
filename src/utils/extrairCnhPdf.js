import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extrairCamposCnh } from './cnh.js'

function pageItems(content, viewport) {
  return content.items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => {
      const [a, b, c, d, x, y] = item.transform
      const baseline = Math.hypot(a, b) || 1
      const normal = Math.hypot(c, d) || 1
      const dx = (a / baseline) * item.width
      const dy = (b / baseline) * item.width
      const hx = (c / normal) * item.height
      const hy = (d / normal) * item.height
      const points = [
        [x, y],
        [x + dx, y + dy],
        [x + hx, y + hy],
        [x + dx + hx, y + dy + hy],
      ].map(([px, py]) => viewport.convertToViewportPoint(px, py))
      const xs = points.map(([px]) => px)
      const ys = points.map(([, py]) => py)
      return {
        text: item.str,
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
    })
}

export async function extrairCnhPdf(file, signal, onProgress = () => {}) {
  let task
  let leitor
  let renderTask
  const cancel = () => {
    renderTask?.cancel()
    task?.destroy().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const { getDocument, GlobalWorkerOptions, OPS } = await import('pdfjs-dist/build/pdf.mjs')
    signal.throwIfAborted()
    GlobalWorkerOptions.workerSrc = workerUrl
    const data = new Uint8Array(await file.arrayBuffer())
    signal.throwIfAborted()
    const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href
    task = getDocument({
      data,
      stopAtErrors: true,
      standardFontDataUrl: `${assets}standard_fonts/`,
      cMapUrl: `${assets}cmaps/`,
      wasmUrl: `${assets}wasm/`,
    })
    const pdf = await task.promise
    if (pdf.numPages > 10) throw new Error('PDF_PAGE_LIMIT')
    const pages = []
    const imagens = []
    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted()
      const page = await pdf.getPage(number)
      const content = await page.getTextContent()
      pages.push(pageItems(content, page.getViewport({ scale: 1 })))
      const operators = await page.getOperatorList()
      if (
        operators.fnArray.some((operator) =>
          [
            OPS.paintImageXObject,
            OPS.paintInlineImageXObject,
            OPS.paintImageXObjectRepeat,
          ].includes(operator),
        )
      )
        imagens.push(number)
      page.cleanup()
    }
    signal.throwIfAborted()
    const dadosTexto = extrairCamposCnh(pages)
    const camposPrincipais = [
      'nome',
      'cpf',
      'numero_registro',
      'data_nascimento',
      'data_emissao',
      'cnh_expiracao',
      'primeira_habilitacao',
      'cnh_categoria',
      'observacao',
    ]
    const precisaOcr = camposPrincipais.some((field) => dadosTexto[field] == null)
    let dadosOcr = {}
    let usouOcr = false
    if (precisaOcr && imagens.length) {
      onProgress('Preparando a leitura da imagem da CNH…')
      const { criarLeitorCnh } = await import('./ocrCnh.js')
      leitor = await criarLeitorCnh(signal, onProgress)
      for (const number of imagens.slice(0, 3)) {
        signal.throwIfAborted()
        const page = await pdf.getPage(number)
        const original = page.getViewport({ scale: 1 })
        const scale = Math.min(8, Math.sqrt(48000000 / (original.width * original.height)))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        try {
          // Four tiles keep fine print legible without allocating a full high-resolution page.
          const width = Math.ceil(viewport.width / 2)
          const height = Math.ceil(viewport.height / 2)
          for (const [left, top] of [
            [0, 0],
            [0, height],
            [width, 0],
            [width, height],
          ]) {
            signal.throwIfAborted()
            canvas.width = Math.min(width, Math.ceil(viewport.width) - left)
            canvas.height = Math.min(height, Math.ceil(viewport.height) - top)
            renderTask = page.render({
              canvasContext: canvas.getContext('2d'),
              viewport,
              transform: [1, 0, 0, 1, -left, -top],
            })
            await renderTask.promise
            signal.throwIfAborted()
            const fields = await leitor.ler(canvas)
            usouOcr = true
            dadosOcr = { ...fields, ...dadosOcr }
            if (camposPrincipais.every((field) => ({ ...dadosOcr, ...dadosTexto })[field] != null))
              break
          }
        } finally {
          renderTask = null
          canvas.width = 0
          canvas.height = 0
          page.cleanup()
        }
      }
    }
    signal.throwIfAborted()
    return {
      dados: { ...dadosOcr, ...dadosTexto },
      temTexto: pages.some((items) => items.length > 0),
      usouOcr,
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    await leitor?.terminar().catch(() => {})
    await task?.destroy().catch(() => {})
  }
}
