export async function criarPreparadorCnh(signal, onProgress = () => {}) {
  signal.throwIfAborted()
  onProgress('Carregando o tratamento das fotos da CNH…')
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href)
  const worker = new Worker(new URL('preparar-cnh.worker.js', base))
  let pendente
  const falhar = (erro) => pendente?.reject(erro)
  const cancelar = () => {
    worker.terminate()
    falhar(signal.reason)
  }
  signal.addEventListener('abort', cancelar, { once: true })
  worker.onerror = () => falhar(new Error('OPENCV_LOAD_FAILED'))
  worker.onmessage = ({ data }) => {
    if (data.tipo === 'erro') falhar(new Error(data.message))
    else pendente?.resolve(data)
  }
  function solicitar(data, transfer = []) {
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate()
        falhar(new Error('OPENCV_TIMEOUT'))
      }, 45000)
      pendente = {
        resolve: (value) => {
          clearTimeout(timer)
          pendente = null
          resolve(value)
        },
        reject: (erro) => {
          clearTimeout(timer)
          pendente = null
          reject(erro)
        },
      }
      try {
        worker.postMessage(data, transfer)
      } catch (erro) {
        falhar(erro)
      }
    })
  }
  function terminar() {
    signal.removeEventListener('abort', cancelar)
    worker.terminate()
  }
  try {
    await solicitar({ tipo: 'iniciar', url: new URL('opencv.js?v=4.12.0', base).href })
  } catch (erro) {
    terminar()
    throw erro
  }
  return {
    async preparar(arquivo) {
      signal.throwIfAborted()
      const bitmap = await createImageBitmap(arquivo)
      try {
        signal.throwIfAborted()
        return await solicitar({ tipo: 'preparar', bitmap }, [bitmap])
      } finally {
        bitmap.close()
      }
    },
    terminar,
  }
}
