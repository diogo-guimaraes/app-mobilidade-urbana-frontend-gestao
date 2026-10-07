import { resolverCamposCnh } from './cnh.js'
import { criarPreparadorCnh } from './prepararCnhImagem.js'

export function combinarLeiturasCnh(leituras) {
  const candidatos = new Map()
  for (const dados of leituras) {
    for (const [campo, valor] of Object.entries(dados)) {
      if (!candidatos.has(campo)) candidatos.set(campo, new Set())
      candidatos.get(campo).add(valor)
    }
  }
  const dados = resolverCamposCnh(candidatos)
  const conflitos = [...candidatos]
    .filter(([, valores]) => valores.size > 1)
    .map(([campo]) => campo)
  return { dados, conflitos }
}

export async function extrairCnhImagens(arquivos, signal, onProgress = () => {}, { cache } = {}) {
  signal.throwIfAborted()
  const lados = ['frente', 'verso']
  let ladoAtual = lados[0]
  let preparador
  let leitor
  const leituras = []
  try {
    for (const [index, arquivo] of arquivos.entries()) {
      signal.throwIfAborted()
      ladoAtual = lados[index]
      if (cache?.has(arquivo)) {
        leituras.push(...cache.get(arquivo))
        continue
      }
      if (!preparador) preparador = await criarPreparadorCnh(signal, onProgress)
      if (!leitor) {
        const { criarLeitorCnh } = await import('./ocrCnh.js')
        leitor = await criarLeitorCnh(signal, (mensagem) =>
          onProgress(`${ladoAtual === 'frente' ? 'Frente' : 'Verso'}: ${mensagem}`),
        )
      }
      onProgress(
        `Preparando a foto do ${ladoAtual === 'frente' ? 'lado da frente' : 'verso'} da CNH…`,
      )
      const { imagens } = await preparador.preparar(arquivo)
      const canvas = document.createElement('canvas')
      const preenchidosLado = new Set()
      const leiturasLado = []
      try {
        for (const imagem of imagens) {
          signal.throwIfAborted()
          canvas.width = imagem.width
          canvas.height = imagem.height
          canvas
            .getContext('2d')
            .putImageData(
              new ImageData(new Uint8ClampedArray(imagem.pixels), imagem.width, imagem.height),
              0,
              0,
            )
          const campos = [
            ...imagem.campos,
            ...imagem.completar.filter((campo) => !preenchidosLado.has(campo)),
          ]
          const leitura = await leitor.ler(canvas, { foto: true, campos })
          Object.keys(leitura).forEach((campo) => preenchidosLado.add(campo))
          leiturasLado.push(leitura)
          // Avoid extra processing when a clean side already contains all fields.
          if (Object.keys(leitura).length >= 10) break
        }
      } finally {
        canvas.width = canvas.height = 0
      }
      signal.throwIfAborted()
      cache?.set(arquivo, leiturasLado)
      leituras.push(...leiturasLado)
    }
    signal.throwIfAborted()
    return { ...combinarLeiturasCnh(leituras), temTexto: false, usouOcr: true }
  } finally {
    preparador?.terminar()
    await leitor?.terminar().catch(() => {})
  }
}
