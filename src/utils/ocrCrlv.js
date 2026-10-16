import { extrairCamposCrlv, regioesCrlv } from './crlv.js'

const identificadores = ['placa', 'renavam', 'chassi', 'cpf_cnpj_proprietario', 'codigo_seguranca']

export function aguardarLeitura(operation, signal) {
  return new Promise((resolve, reject) => {
    const cancelar = () => reject(signal.reason)
    if (signal.aborted) cancelar()
    else signal.addEventListener('abort', cancelar, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancelar))
  })
}

export async function lerImagemCrlv(canvas, worker, signal, { foto = false } = {}) {
  const { PSM } = await import('tesseract.js')
  signal.throwIfAborted()
  const result = await aguardarLeitura(
    worker.recognize(
      canvas,
      { tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' },
      { blocks: true, text: true },
    ),
    signal,
  )
  signal.throwIfAborted()
  const items = (result.data.blocks || [])
    .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    .filter((w) => w.text.trim())
    .map((w) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      confidence: w.confidence,
    }))
  const conflitos = new Set()
  const dados = extrairCamposCrlv([items], conflitos)
  if (!foto) return { dados, conflitos: [...conflitos] }

  for (const region of regioesCrlv(items)) {
    signal.throwIfAborted()
    if (conflitos.has(region.name)) continue
    if (dados[region.name] && !identificadores.includes(region.name)) continue
    // A masked CRV (***), common in printed CRLVs, must remain blank.
    if (
      region.name === 'numero_crv' &&
      !items.some(
        (i) =>
          i.x >= region.left &&
          i.x < region.left + region.width &&
          i.y >= region.top &&
          i.y < region.top + region.height &&
          /\d/.test(i.text),
      )
    )
      continue
    const cropped = document.createElement('canvas')
    const width = Math.min(region.width, canvas.width - region.left)
    const height = Math.min(region.height, canvas.height - region.top)
    if (width <= 0 || height <= 0) continue
    const scale = Math.min(3, 1200 / width)
    cropped.width = Math.ceil(width * scale) + 32
    cropped.height = Math.ceil(height * scale) + 24
    const context = cropped.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, cropped.width, cropped.height)
    context.drawImage(
      canvas,
      region.left,
      region.top,
      width,
      height,
      16,
      12,
      width * scale,
      height * scale,
    )
    try {
      const numerico = [
        'renavam',
        'numero_crv',
        'codigo_seguranca',
        'cpf_cnpj_proprietario',
        'exercicio',
        'ano_fabricacao',
        'ano_modelo',
        'data_emissao',
      ].includes(region.name)
      const { data } = await aguardarLeitura(
        worker.recognize(
          cropped,
          {
            tessedit_pageseg_mode:
              region.name === 'observacao' ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE,
            tessedit_char_whitelist: numerico ? '0123456789./-' : '',
          },
          { text: true },
        ),
        signal,
      )
      signal.throwIfAborted()
      const value = data.confidence >= 70 ? region.parse(data.text.trim()) : undefined
      if (value === undefined) continue
      if (dados[region.name] && dados[region.name] !== value) {
        delete dados[region.name]
        conflitos.add(region.name)
      } else dados[region.name] = value
    } finally {
      cropped.width = cropped.height = 0
    }
  }
  return { dados, conflitos: [...conflitos] }
}
