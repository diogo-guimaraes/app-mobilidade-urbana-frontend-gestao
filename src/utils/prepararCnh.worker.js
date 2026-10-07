// This classic worker is copied into public/ocr by prepare-ocr.mjs.
let carregamentoCv

function carregarCv(url) {
  carregamentoCv ||= new Promise((resolve, reject) => {
    self.Module = { onAbort: () => reject(new Error('OPENCV_LOAD_FAILED')) }
    self.importScripts(url)
    const modulo = self.cv
    // OpenCV 4.x exposes a thenable object: wrap it to avoid promise assimilation.
    if (modulo.Mat) resolve({ cv: modulo })
    else if (modulo instanceof Promise) modulo.then((cv) => resolve({ cv }), reject)
    else modulo.onRuntimeInitialized = () => resolve({ cv: modulo })
  })
  return carregamentoCv
}

function ordenarCantos(pontos) {
  const centro = pontos.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), {
    x: 0,
    y: 0,
  })
  const ordenados = [...pontos].sort(
    (a, b) =>
      Math.atan2(a.y - centro.y, a.x - centro.x) - Math.atan2(b.y - centro.y, b.x - centro.x),
  )
  const primeiro = ordenados.reduce(
    (indice, p, i) => (p.x + p.y < ordenados[indice].x + ordenados[indice].y ? i : indice),
    0,
  )
  return [...ordenados.slice(primeiro), ...ordenados.slice(0, primeiro)]
}

function encontrarDocumento(cv, cinza) {
  const temporarios = []
  const novo = (value) => {
    temporarios.push(value)
    return value
  }
  const borrada = novo(new cv.Mat())
  const bordas = novo(new cv.Mat())
  const mascara = novo(new cv.Mat())
  const kernel = novo(cv.Mat.ones(5, 5, cv.CV_8U))
  let melhor
  const areaImagem = cinza.cols * cinza.rows
  try {
    cv.GaussianBlur(cinza, borrada, new cv.Size(5, 5), 0)
    cv.Canny(borrada, bordas, 40, 120)
    cv.morphologyEx(bordas, bordas, cv.MORPH_CLOSE, kernel)
    cv.threshold(borrada, mascara, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    for (const entrada of [bordas, mascara]) {
      const contornos = new cv.MatVector()
      const hierarquia = new cv.Mat()
      try {
        cv.findContours(entrada, contornos, hierarquia, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
        for (let i = 0; i < contornos.size(); i++) {
          const contorno = contornos.get(i)
          const poligono = new cv.Mat()
          try {
            const area = cv.contourArea(contorno)
            if (area < areaImagem * 0.3 || area > areaImagem * 0.97) continue
            cv.approxPolyDP(contorno, poligono, cv.arcLength(contorno, true) * 0.025, true)
            if (poligono.rows !== 4 || !cv.isContourConvex(poligono)) continue
            const pontos = ordenarCantos(
              Array.from({ length: 4 }, (_, index) => ({
                x: poligono.data32S[index * 2],
                y: poligono.data32S[index * 2 + 1],
              })),
            )
            const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
            const largura = Math.max(
              distancia(pontos[0], pontos[1]),
              distancia(pontos[2], pontos[3]),
            )
            const altura = Math.max(
              distancia(pontos[0], pontos[3]),
              distancia(pontos[1], pontos[2]),
            )
            const proporcao = largura / altura
            if (
              proporcao < 0.4 ||
              proporcao > 2.5 ||
              Math.min(largura, altura) < Math.min(cinza.cols, cinza.rows) * 0.35
            )
              continue
            if (!melhor || area > melhor.area) melhor = { pontos, largura, altura, area }
          } finally {
            contorno.delete()
            poligono.delete()
          }
        }
      } finally {
        contornos.delete()
        hierarquia.delete()
      }
    }
    return melhor
  } finally {
    temporarios.forEach((mat) => mat.delete())
  }
}

function preparar(cv, bitmap) {
  const canvas = new OffscreenCanvas(1, 1)
  const escala = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const temporarios = []
  const novo = (value) => {
    temporarios.push(value)
    return value
  }
  try {
    const rgba = novo(cv.matFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)))
    const cinza = novo(new cv.Mat())
    cv.cvtColor(rgba, cinza, cv.COLOR_RGBA2GRAY)
    let geometria = novo(cinza.clone())
    // Registration, category and expiration may be printed in red. Grayscale
    // alone lightens that ink until strokes disappear during thresholding.
    const pixelsRgba = rgba.data
    const pixelsCinza = cinza.data
    for (let i = 0, offset = 0; i < pixelsCinza.length; i++, offset += 4) {
      const r = pixelsRgba[offset]
      const g = pixelsRgba[offset + 1]
      const b = pixelsRgba[offset + 2]
      if (r - g > 50 && r - b > 20) pixelsCinza[i] = Math.min(g, b)
    }
    const documento = encontrarDocumento(cv, geometria)
    let recorte = cinza
    if (documento) {
      const { pontos, largura, altura } = documento
      const origem = novo(
        cv.matFromArray(
          4,
          1,
          cv.CV_32FC2,
          pontos.flatMap((p) => [p.x, p.y]),
        ),
      )
      const destino = novo(
        cv.matFromArray(4, 1, cv.CV_32FC2, [
          0,
          0,
          largura - 1,
          0,
          largura - 1,
          altura - 1,
          0,
          altura - 1,
        ]),
      )
      const transformacao = novo(cv.getPerspectiveTransform(origem, destino))
      recorte = novo(new cv.Mat())
      cv.warpPerspective(
        cinza,
        recorte,
        transformacao,
        new cv.Size(Math.round(largura), Math.round(altura)),
        cv.INTER_CUBIC,
        cv.BORDER_REPLICATE,
      )
      const geometriaRecortada = novo(new cv.Mat())
      cv.warpPerspective(
        geometria,
        geometriaRecortada,
        transformacao,
        recorte.size(),
        cv.INTER_CUBIC,
        cv.BORDER_REPLICATE,
      )
      geometria = geometriaRecortada
      // Polygon approximation can leave a thin dark rim from the background.
      // Keep it from joining nearby printed labels during OCR.
      for (const mat of [recorte, geometria]) {
        const margem = Math.min(8, Math.floor(Math.min(mat.cols, mat.rows) * 0.01))
        for (const rect of [
          new cv.Rect(0, 0, mat.cols, margem),
          new cv.Rect(0, mat.rows - margem, mat.cols, margem),
          new cv.Rect(0, 0, margem, mat.rows),
          new cv.Rect(mat.cols - margem, 0, margem, mat.rows),
        ]) {
          const borda = mat.roi(rect)
          try {
            borda.setTo(new cv.Scalar(255))
          } finally {
            borda.delete()
          }
        }
      }
    }
    // Increase small print after removing the background; bound memory per side.
    const ampliada = novo(new cv.Mat())
    const fator = Math.min(2, 2200 / Math.max(recorte.cols, recorte.rows))
    cv.resize(
      recorte,
      ampliada,
      new cv.Size(Math.round(recorte.cols * fator), Math.round(recorte.rows * fator)),
      0,
      0,
      fator > 1 ? cv.INTER_CUBIC : cv.INTER_AREA,
    )
    const fundo = novo(new cv.Mat())
    const normalizada = novo(new cv.Mat())
    cv.GaussianBlur(ampliada, fundo, new cv.Size(0, 0), 15)
    cv.divide(ampliada, fundo, normalizada, 255)
    const semCor = novo(new cv.Mat())
    cv.resize(geometria, semCor, ampliada.size(), 0, 0, fator > 1 ? cv.INTER_CUBIC : cv.INTER_AREA)
    const fundoCinza = novo(new cv.Mat())
    const normalizadaCinza = novo(new cv.Mat())
    const adaptativaCinza = novo(new cv.Mat())
    cv.GaussianBlur(semCor, fundoCinza, new cv.Size(0, 0), 15)
    cv.divide(semCor, fundoCinza, normalizadaCinza, 255)
    cv.adaptiveThreshold(
      normalizadaCinza,
      adaptativaCinza,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,
      30,
    )
    const contrastada = novo(new cv.Mat())
    cv.threshold(normalizada, contrastada, 180, 255, cv.THRESH_BINARY)
    const camposPretos = [
      'nome',
      'cpf',
      'data_nascimento',
      'primeira_habilitacao',
      'data_emissao',
      'observacao',
      'ear',
    ]
    const camposColoridos = ['numero_registro', 'cnh_categoria', 'cnh_expiracao']
    const imagens = [
      [adaptativaCinza, camposPretos],
      [contrastada, camposColoridos],
    ].map(([mat, campos], index) => {
      // Remove long box borders without erasing individual character strokes.
      const tinta = novo(new cv.Mat())
      const horizontais = novo(new cv.Mat())
      const verticais = novo(new cv.Mat())
      const horizontal = novo(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(70, 1)))
      const vertical = novo(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 70)))
      const margem = novo(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)))
      cv.bitwise_not(mat, tinta)
      cv.morphologyEx(tinta, horizontais, cv.MORPH_OPEN, horizontal)
      cv.morphologyEx(tinta, verticais, cv.MORPH_OPEN, vertical)
      cv.bitwise_or(horizontais, verticais, horizontais)
      cv.dilate(horizontais, horizontais, margem)
      mat.setTo(new cv.Scalar(255), horizontais)
      const pixels = mat.data
      const saida = new Uint8ClampedArray(pixels.length * 4)
      for (let i = 0, offset = 0; i < pixels.length; i++, offset += 4) {
        const tom = pixels[i]
        saida[offset] = saida[offset + 1] = saida[offset + 2] = tom
        saida[offset + 3] = 255
      }
      return {
        width: mat.cols,
        height: mat.rows,
        pixels: saida.buffer,
        campos,
        completar: index === 1 ? camposPretos : [],
      }
    })
    return { imagens, recortada: !!documento }
  } finally {
    temporarios.forEach((mat) => mat.delete())
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.tipo === 'iniciar') {
      await carregarCv(data.url)
      self.postMessage({ tipo: 'pronto' })
    } else {
      const { cv } = await carregamentoCv
      const resultado = preparar(cv, data.bitmap)
      self.postMessage(
        { tipo: 'resultado', ...resultado },
        resultado.imagens.map((imagem) => imagem.pixels),
      )
    }
  } catch {
    self.postMessage({ tipo: 'erro', message: 'OPENCV_PROCESS_FAILED' })
  } finally {
    data.bitmap?.close()
  }
}
