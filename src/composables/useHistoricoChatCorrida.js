import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { api } from 'boot/axios'
import { getEcho, conectadoChat } from 'src/services/echo'
import { useAtualizacaoSemConexao } from 'src/composables/useAtualizacaoSemConexao'
import { erroTicket } from 'src/utils/tickets'

export function useHistoricoChatCorrida(ticketId, corridaId, perdeuAcesso) {
  const mensagens = ref([])
  const corrida = ref(null)
  const carregando = ref(false)
  const anteriores = ref(false)
  const maisAntigas = ref(false)
  const erro = ref('')
  const autorizado = ref(false)
  const acessoNegado = ref(false)
  const mensagensEl = ref(null)
  const habilitado = computed(
    () => !!ticketId.value && !!corridaId.value && !carregando.value && !acessoNegado.value,
  )
  let versao = 0
  let controller
  let echo
  let canal
  let sincronizando = null
  let pendente = false

  function limpar() {
    versao++
    controller?.abort()
    if (canal) echo?.leave(canal)
    canal = null
    autorizado.value = false
    sincronizando = null
    pendente = false
  }

  function falha(error, epoch) {
    if (epoch !== versao || error.code === 'ERR_CANCELED') return
    erro.value = erroTicket(error)
    if ([403, 404].includes(error.response?.status)) {
      limpar()
      mensagens.value = []
      corrida.value = null
      carregando.value = false
      anteriores.value = false
      acessoNegado.value = true
      perdeuAcesso()
    }
  }

  async function buscar(params, epoch, id = ticketId.value, signal = controller.signal) {
    const { data } = await api.get(`/ajuda/tickets/${id}/corrida/mensagens`, { params, signal })
    if (epoch !== versao) return null
    corrida.value = data.corrida
    const unicas = new Map(mensagens.value.map((item) => [item.id, item]))
    data.data.forEach((item) => unicas.set(item.id, item))
    mensagens.value = [...unicas.values()].sort((a, b) => a.id - b.id)
    erro.value = ''
    return data
  }

  async function rolarFim() {
    await nextTick()
    if (mensagensEl.value) mensagensEl.value.scrollTop = mensagensEl.value.scrollHeight
  }

  function assinar(epoch) {
    if (epoch !== versao || canal) return
    echo = getEcho()
    if (!echo) return
    canal = `corrida.${corridaId.value}.chat.suporte`
    echo
      .private(canal)
      .listen('.corrida.mensagem', (event) => {
        if (epoch === versao && event.corrida_id === corridaId.value) void sincronizar()
      })
      .subscribed(() => {
        if (epoch !== versao) return
        autorizado.value = true
        // Recupera o intervalo entre a consulta e a assinatura ou reconexão.
        void sincronizar()
      })
      .error(() => {
        if (epoch === versao) autorizado.value = false
      })
  }

  function sincronizar() {
    if (!habilitado.value) return
    if (!corrida.value) return abrir()
    if (sincronizando) {
      pendente = true
      return sincronizando
    }
    const epoch = versao
    const id = ticketId.value
    const signal = controller.signal
    const proximoDoFim =
      !mensagensEl.value ||
      mensagensEl.value.scrollHeight -
        mensagensEl.value.scrollTop -
        mensagensEl.value.clientHeight <
        100
    const tarefa = (async () => {
      let cursor = mensagens.value.at(-1)?.id || 0
      let mais = true
      while (mais && epoch === versao) {
        const data = await buscar({ after_id: cursor }, epoch, id, signal)
        if (!data) return
        mais = data.has_more
        cursor = data.next_after_id || cursor
      }
      if (epoch === versao && proximoDoFim) await rolarFim()
    })()
      .catch((error) => falha(error, epoch))
      .finally(() => {
        if (sincronizando !== tarefa) return
        sincronizando = null
        if (pendente && epoch === versao) {
          pendente = false
          void sincronizar()
        }
      })
    sincronizando = tarefa
    return tarefa
  }

  async function abrir() {
    limpar()
    mensagens.value = []
    corrida.value = null
    erro.value = ''
    acessoNegado.value = false
    maisAntigas.value = false
    anteriores.value = false
    carregando.value = false
    if (!ticketId.value || !corridaId.value) return
    const epoch = versao
    controller = new AbortController()
    carregando.value = true
    try {
      const data = await buscar({}, epoch)
      if (!data) return
      maisAntigas.value = data.has_more
      carregando.value = false
      await rolarFim()
      assinar(epoch)
    } catch (error) {
      falha(error, epoch)
    } finally {
      if (epoch === versao) carregando.value = false
    }
  }

  async function carregarAntigas() {
    if (anteriores.value || !habilitado.value || !maisAntigas.value) return
    const epoch = versao
    const altura = mensagensEl.value?.scrollHeight || 0
    const topo = mensagensEl.value?.scrollTop || 0
    anteriores.value = true
    try {
      const data = await buscar({ before_id: mensagens.value[0]?.id }, epoch)
      if (!data) return
      maisAntigas.value = data.has_more
      await nextTick()
      if (epoch === versao && mensagensEl.value)
        mensagensEl.value.scrollTop = topo + mensagensEl.value.scrollHeight - altura
    } catch (error) {
      falha(error, epoch)
    } finally {
      if (epoch === versao) anteriores.value = false
    }
  }

  useAtualizacaoSemConexao(autorizado, habilitado, sincronizar)
  watch([ticketId, corridaId], abrir, { immediate: true })
  onBeforeUnmount(limpar)
  return {
    mensagens,
    corrida,
    carregando,
    anteriores,
    maisAntigas,
    erro,
    mensagensEl,
    tempoReal: computed(() => conectadoChat.value && autorizado.value),
    carregarAntigas,
    atualizar: () => (corrida.value ? sincronizar() : abrir()),
  }
}
