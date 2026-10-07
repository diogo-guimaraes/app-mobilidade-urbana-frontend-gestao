import { extrairCamposCnh, regioesCnh, resolverCamposCnh } from './cnh.js'

function abortable(operation, signal) {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason)
    signal.addEventListener('abort', cancel, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel))
  })
}

export async function criarLeitorCnh(signal, onProgress) {
  const { createWorker, PSM } = await import('tesseract.js')
  signal.throwIfAborted()
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
  const pending = createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    errorHandler: () => {},
    logger: (message) => {
      if (signal.aborted) return
      if (message.status === 'recognizing text')
        onProgress(`Lendo a imagem da CNH: ${Math.round(message.progress * 100)}%`)
      else onProgress('Preparando a leitura da imagem da CNH…')
    },
  })
  pending.then(
    (worker) => {
      if (signal.aborted) worker.terminate()
    },
    () => {},
  )
  const worker = await abortable(pending, signal)
  const cancel = () => worker.terminate()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await abortable(worker.setParameters({ preserve_interword_spaces: '1' }), signal)
  } catch (error) {
    signal.removeEventListener('abort', cancel)
    await worker.terminate()
    throw error
  }
  return {
    async ler(canvas, { foto = false, campos } = {}) {
      const original = document.createElement('canvas')
      original.width = canvas.width
      original.height = canvas.height
      original.getContext('2d').drawImage(canvas, 0, 0)
      try {
        if (!foto) prepararImagem(canvas)
        const { data } = await abortable(
          worker.recognize(
            canvas,
            { tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' },
            { blocks: true, text: true },
          ),
          signal,
        )
        const items = (data.blocks || [])
          .flatMap((block) =>
            block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)),
          )
          .filter((word) => word.text.trim())
          .map((word) => ({
            text: word.text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
            confidence: word.confidence,
          }))
        const candidates = new Map()
        if (foto) {
          const leitura = extrairCamposCnh(
            [
              items.filter(
                (item) =>
                  item.confidence >= 70 &&
                  item.height <= Math.max(40, Math.max(canvas.width, canvas.height) * 0.03),
              ),
            ],
            { foto },
          )
          for (const [name, value] of Object.entries(leitura)) {
            if (campos && !campos.includes(name)) continue
            if (['nome', 'observacao', 'ear'].includes(name)) continue
            if (name === 'numero_registro' && !/^\d{11}$/.test(value)) continue
            candidates.set(name, new Set([value]))
          }
        }
        for (const region of regioesCnh(items, canvas.width, canvas.height, { foto })) {
          if (campos && !campos.includes(region.name)) continue
          signal.throwIfAborted()
          const cropped = recortarValor(original, region)
          let value
          try {
            for (const factor of [1, 1.5, 2]) {
              // Separate narrow consecutive digits if the first reading is incomplete.
              const resized = document.createElement('canvas')
              resized.width = Math.ceil(cropped.width * factor)
              resized.height = cropped.height
              resized.getContext('2d').drawImage(cropped, 0, 0, resized.width, resized.height)
              try {
                const recognition = await abortable(
                  worker.recognize(
                    resized,
                    {
                      tessedit_pageseg_mode:
                        region.name === 'observacao' ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE,
                      tessedit_char_whitelist: caracteresCampo(region.name),
                    },
                    { text: true, blocks: foto },
                  ),
                  signal,
                )
                let text = recognition.data.text.trim()
                if (foto && ['nome', 'observacao'].includes(region.name)) {
                  const words = (recognition.data.blocks || []).flatMap((block) =>
                    block.paragraphs.flatMap((paragraph) =>
                      paragraph.lines.flatMap((line) => line.words),
                    ),
                  )
                  text = words
                    .filter(
                      (word) =>
                        word.confidence >= 70 &&
                        (region.name !== 'observacao' || /^[A-Z,.;/-]+$/.test(word.text)),
                    )
                    .map((word) => word.text)
                    .join(' ')
                  if (
                    region.name === 'nome' &&
                    words.some((word) => /\p{L}/u.test(word.text) && word.confidence < 70)
                  )
                    text = ''
                } else if (foto && recognition.data.confidence < 70) text = ''
                value = region.parse(text)
                if (foto && region.name === 'numero_registro' && !/^\d{11}$/.test(value || ''))
                  value = undefined
                if (value !== undefined) break
              } finally {
                resized.width = resized.height = 0
              }
            }
          } finally {
            cropped.width = cropped.height = 0
          }
          if (value !== undefined) {
            if (!candidates.has(region.name)) candidates.set(region.name, new Set())
            candidates.get(region.name).add(value)
          }
        }
        return resolverCamposCnh(candidates)
      } finally {
        original.width = original.height = 0
      }
    },
    async terminar() {
      signal.removeEventListener('abort', cancel)
      await worker.terminate()
    },
  }
}
function caracteresCampo(name) {
  if (['data_nascimento', 'data_emissao', 'cnh_expiracao', 'primeira_habilitacao'].includes(name))
    return '0123456789/'
  if (name === 'cpf') return '0123456789.-'
  if (name === 'numero_registro') return '0123456789'
  return ''
}
function recortarValor(original, region) {
  const image = original
    .getContext('2d', { willReadFrequently: true })
    .getImageData(region.left, region.top, region.width, region.height)
  const { data, width, height } = image
  const borders = []
  for (let x = 0; x < width; x++) {
    let longest = 0
    let run = 0
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      run = (data[i] + data[i + 1] + data[i + 2]) / 3 < 205 ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    if (longest >= height * 0.75) borders.push(x)
  }
  const leftBorder = borders.filter((x) => x <= region.labelLeft - region.left).at(-1)
  const rightBorder = borders.find((x) => x > region.labelRight - region.left)
  const left = leftBorder === undefined ? 0 : leftBorder + 10
  const right = rightBorder === undefined ? width : rightBorder - 10
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, right - left) + 40
  canvas.height = height + 30
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (right > left)
    context.drawImage(
      original,
      region.left + left,
      region.top,
      right - left,
      height,
      20,
      15,
      right - left,
      height,
    )
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
  }
  for (let y = 0; y < canvas.height; y++) {
    let start = 0
    for (let x = 0; x <= canvas.width; x++) {
      if (x === canvas.width || pixels.data[(y * canvas.width + x) * 4] >= 205) {
        if (x - start > 60) {
          for (let column = start; column < x; column++) {
            const offset = (y * canvas.width + column) * 4
            pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = 255
          }
        }
        start = x + 1
      }
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

function prepararImagem(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = image.data
  const { width, height } = canvas
  for (let i = 0; i < pixels.length; i += 4) {
    const color = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 205 ? 0 : 255
    pixels[i] = pixels[i + 1] = pixels[i + 2] = color
  }
  const erase = (start, length, step) => {
    for (let i = 0; i < length; i++) {
      const offset = (start + i * step) * 4
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255
    }
  }
  for (let y = 0; y < height; y++) {
    let start = 0
    for (let x = 0; x <= width; x++) {
      if (x === width || pixels[(y * width + x) * 4] !== 0) {
        if (x - start > 60) erase(y * width + start, x - start, 1)
        start = x + 1
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let start = 0
    for (let y = 0; y <= height; y++) {
      if (y === height || pixels[(y * width + x) * 4] !== 0) {
        if (y - start > 40) erase(start * width + x, y - start, width)
        start = y + 1
      }
    }
  }
  context.putImageData(image, 0, 0)
}
