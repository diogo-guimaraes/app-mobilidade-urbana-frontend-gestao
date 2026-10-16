import { computed, watch, onBeforeUnmount } from 'vue'
import { conectadoChat } from 'src/services/echo'

// A conexão só substitui as consultas periódicas depois de autorizar o canal.
export function useAtualizacaoSemConexao(canalAutorizado, habilitado, atualizar) {
  const tempoReal = computed(() => conectadoChat.value && canalAutorizado.value)
  let timer = null

  function parar() {
    clearInterval(timer)
    timer = null
  }

  watch(conectadoChat, (conectado) => {
    if (!conectado) canalAutorizado.value = false
  })
  watch(
    [tempoReal, habilitado],
    () => {
      parar()
      if (habilitado.value && !tempoReal.value) {
        timer = setInterval(() => {
          if (habilitado.value && !tempoReal.value) void atualizar()
        }, 15000)
      }
    },
    { immediate: true },
  )
  onBeforeUnmount(parar)
}
