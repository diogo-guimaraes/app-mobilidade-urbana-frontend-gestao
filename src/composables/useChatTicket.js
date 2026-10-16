import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { api } from 'boot/axios'
import { useAuthStore } from 'src/stores/auth'
import { getEcho } from 'src/services/echo'
import { erroTicket, identificadorMensagem, podeAcessarResponsavelTicket } from 'src/utils/tickets'
import { useAtualizacaoSemConexao } from 'src/composables/useAtualizacaoSemConexao'

export function useChatTicket(
  ticketId,
  atualizado,
  perdeuAcesso = () => {},
  aoLer = () => {},
  leituraHabilitada = ref(true),
) {
  const auth = useAuthStore()
  const ticket = ref(null)
  const mensagens = ref([])
  const carregando = ref(false)
  const enviando = ref(false)
  const historico = ref(false)
  const maisAntigas = ref(false)
  const erro = ref('')
  const texto = ref('')
  const imagens = ref([])
  const operando = ref(false)
  const podeResponder = computed(
    () =>
      !!auth.user?.id &&
      ticket.value?.status === 'in_progress' &&
      ticket.value.gestor_responsavel?.id === auth.user.id,
  )
  const autenticadoCanal = ref(false)
  const acessoNegado = ref(false)
  const revisaoTransferencias = ref(0)
  const atualizacaoHabilitada = computed(
    () => !!ticketId.value && !carregando.value && !acessoNegado.value,
  )
  let version = 0
  let controller = null
  let channelName = null
  let syncPromise = null
  let sincronizacaoPendente = false
  let pending = null
  let subscription = null
  let lidaAte = 0
  let lendo = false
  const paginaAtiva = ref(false)

  function limparImagens() {
    imagens.value.forEach((imagem) => URL.revokeObjectURL(imagem.url))
    imagens.value = []
  }

  function adicionarImagens(arquivos) {
    if (!podeResponder.value || enviando.value || operando.value) return
    erro.value = ''
    for (const arquivo of arquivos) {
      if (imagens.value.length >= 3) {
        erro.value = 'Envie no máximo 3 imagens por mensagem.'
        break
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
        erro.value = 'Selecione imagens JPG, PNG ou WebP.'
        continue
      }
      if (arquivo.size > 5 * 1024 * 1024) {
        erro.value = 'Cada imagem deve ter no máximo 5 MB.'
        continue
      }
      imagens.value.push({ arquivo, url: URL.createObjectURL(arquivo) })
    }
  }

  function removerImagem(indice) {
    if (enviando.value) return
    const [imagem] = imagens.value.splice(indice, 1)
    if (imagem) URL.revokeObjectURL(imagem.url)
  }

  function atualizarFoco() {
    paginaAtiva.value = document.visibilityState === 'visible' && document.hasFocus()
  }

  async function marcarLidas() {
    const ultima = mensagens.value.at(-1)?.id || 0
    if (
      !ticketId.value ||
      !leituraHabilitada.value ||
      !paginaAtiva.value ||
      acessoNegado.value ||
      lendo ||
      ultima <= lidaAte
    )
      return
    const epoch = version
    lendo = true
    let sucesso = false
    try {
      const { data } = await api.post(
        `/ajuda/tickets/${ticketId.value}/leitura`,
        { ultima_mensagem_id: ultima },
        { signal: controller.signal },
      )
      if (epoch !== version) return
      lidaAte = Math.max(lidaAte, ultima)
      sucesso = true
      if (data.data?.ticket_id) aoLer(data.data)
    } catch (error) {
      if (epoch === version && [403, 404].includes(error.response?.status)) negarAcesso()
    } finally {
      if (epoch === version) {
        lendo = false
        if (sucesso && (mensagens.value.at(-1)?.id || 0) > lidaAte) void marcarLidas()
      }
    }
  }

  watch([() => mensagens.value.at(-1)?.id, leituraHabilitada, paginaAtiva], marcarLidas)
  onMounted(() => {
    atualizarFoco()
    window.addEventListener('focus', atualizarFoco)
    window.addEventListener('blur', atualizarFoco)
    document.addEventListener('visibilitychange', atualizarFoco)
  })

  useAtualizacaoSemConexao(autenticadoCanal, atualizacaoHabilitada, sincronizar)

  function mesclar(items) {
    const byId = new Map(mensagens.value.map((message) => [message.id, message]))
    items.forEach((message) => byId.set(message.id, message))
    mensagens.value = [...byId.values()].sort((a, b) => a.id - b.id)
  }

  function mesclarAtualizacoes(items = []) {
    // Uma edição fora da página carregada não deve alterar o cursor do histórico.
    const carregadas = new Set(mensagens.value.map((message) => message.id))
    mesclar(items.filter((message) => carregadas.has(message.id)))
  }

  async function detalhes(id, epoch) {
    const { data } = await api.get(`/ajuda/tickets/${id}`, { signal: controller.signal })
    if (epoch === version) ticket.value = data.data
  }

  function sincronizar() {
    if (!ticketId.value) return
    if (syncPromise) {
      sincronizacaoPendente = true
      return syncPromise
    }
    const epoch = version
    const id = ticketId.value
    const signal = controller.signal
    const task = (async () => {
      await detalhes(id, epoch)
      let cursor = mensagens.value.at(-1)?.id || 0
      let more = true
      while (more && epoch === version) {
        const { data } = await api.get(`/ajuda/tickets/${id}/mensagens`, {
          params: { after_id: cursor },
          signal,
        })
        if (epoch !== version) return
        mesclar(data.data)
        mesclarAtualizacoes(data.atualizadas)
        more = data.has_more
        cursor = data.next_after_id || cursor
      }
    })()
      .catch((error) => {
        if (epoch === version && error.code !== 'ERR_CANCELED') {
          erro.value = erroTicket(error)
          if ([403, 404].includes(error.response?.status)) {
            negarAcesso()
          }
        }
      })
      .finally(() => {
        if (syncPromise !== task) return
        syncPromise = null
        if (sincronizacaoPendente && epoch === version) {
          sincronizacaoPendente = false
          void sincronizar()
        }
      })
    syncPromise = task
    return task
  }

  function limpar() {
    version++
    controller?.abort()
    if (channelName) subscription?.leave(channelName)
    channelName = null
    syncPromise = null
    sincronizacaoPendente = false
    autenticadoCanal.value = false
    lidaAte = 0
    lendo = false
    limparImagens()
  }

  function negarAcesso() {
    limpar()
    acessoNegado.value = true
    ticket.value = null
    mensagens.value = []
    texto.value = ''
    pending = null
    carregando.value = false
    enviando.value = false
    operando.value = false
    perdeuAcesso()
    atualizado()
  }

  async function abrir(id) {
    limpar()
    const epoch = version
    ticket.value = null
    mensagens.value = []
    texto.value = ''
    pending = null
    erro.value = ''
    acessoNegado.value = false
    enviando.value = false
    operando.value = false
    historico.value = false
    maisAntigas.value = false
    revisaoTransferencias.value = 0
    if (!id) return
    controller = new AbortController()
    carregando.value = true
    subscription = getEcho()
    if (subscription) {
      channelName = `ajuda.ticket.${id}.suporte`
      subscription
        .private(channelName)
        .listen('.ticket.mensagem', (event) => {
          if (epoch === version && event.ticket_id === id) {
            // Busca o intervalo para recuperar mensagens eventualmente perdidas ou fora de ordem.
            void sincronizar()
          }
        })
        .listen('.ticket.atualizado', () => {
          if (epoch === version) {
            void sincronizar()
            atualizado()
          }
        })
        .listen('.ticket.transferido', (event) => {
          if (epoch !== version || event.ticket_id !== id) return
          if (!podeAcessarResponsavelTicket(auth.user, event.to_user_id)) {
            negarAcesso()
            return
          }
          revisaoTransferencias.value++
          void sincronizar()
          atualizado()
        })
        .subscribed(() => {
          if (epoch === version) {
            autenticadoCanal.value = true
            revisaoTransferencias.value++
            if (!carregando.value) void sincronizar()
          }
        })
        .error(() => {
          if (epoch === version) autenticadoCanal.value = false
        })
    }
    try {
      await detalhes(id, epoch)
      const { data } = await api.get(`/ajuda/tickets/${id}/mensagens`, {
        signal: controller.signal,
      })
      if (epoch !== version) return
      mesclar(data.data)
      mesclarAtualizacoes(data.atualizadas)
      maisAntigas.value = data.has_more
      // Também cobre alterações entre a assinatura e a resposta HTTP inicial.
      await sincronizar()
    } catch (error) {
      if (epoch === version && error.code !== 'ERR_CANCELED') {
        erro.value = erroTicket(error)
        if ([403, 404].includes(error.response?.status)) negarAcesso()
      }
    } finally {
      if (epoch === version) carregando.value = false
    }
  }

  async function antigas() {
    if (historico.value || !maisAntigas.value) return
    historico.value = true
    const epoch = version
    try {
      const { data } = await api.get(`/ajuda/tickets/${ticketId.value}/mensagens`, {
        params: { before_id: mensagens.value[0]?.id },
        signal: controller.signal,
      })
      if (epoch !== version) return
      mesclar(data.data)
      mesclarAtualizacoes(data.atualizadas)
      maisAntigas.value = data.has_more
    } catch (error) {
      if (epoch === version && error.code !== 'ERR_CANCELED') {
        erro.value = erroTicket(error)
        if ([403, 404].includes(error.response?.status)) negarAcesso()
      }
    } finally {
      if (epoch === version) historico.value = false
    }
  }

  async function enviar() {
    if (
      (!texto.value.trim() && !imagens.value.length) ||
      enviando.value ||
      !podeResponder.value ||
      operando.value
    )
      return
    const epoch = version
    const id = ticketId.value
    const conteudo = texto.value.trim()
    const arquivos = imagens.value.map((imagem) => imagem.arquivo)
    if (
      !pending ||
      pending.conteudo !== conteudo ||
      pending.imagens.length !== arquivos.length ||
      pending.imagens.some((arquivo, indice) => arquivo !== arquivos[indice])
    ) {
      pending = { conteudo, client_message_id: identificadorMensagem(), imagens: arquivos }
    }
    enviando.value = true
    erro.value = ''
    try {
      let payload = { conteudo: pending.conteudo, client_message_id: pending.client_message_id }
      if (pending.imagens.length) {
        payload = new FormData()
        payload.append('conteudo', pending.conteudo)
        payload.append('client_message_id', pending.client_message_id)
        pending.imagens.forEach((arquivo) => payload.append('imagens[]', arquivo, arquivo.name))
      }
      const { data } = await api.post(`/ajuda/tickets/${id}/mensagens`, payload, {
        signal: controller.signal,
        ...(pending.imagens.length ? { headers: { 'Content-Type': undefined } } : {}),
      })
      if (epoch !== version) return
      mesclar([data.data])
      texto.value = ''
      limparImagens()
      pending = null
      await sincronizar()
      atualizado()
    } catch (error) {
      if (epoch === version && error.code !== 'ERR_CANCELED') {
        erro.value = erroTicket(error)
        if ([403, 404].includes(error.response?.status)) negarAcesso()
      }
    } finally {
      if (epoch === version) enviando.value = false
    }
  }

  async function acao(tipo, status) {
    if (operando.value) return
    operando.value = true
    const epoch = version
    erro.value = ''
    try {
      const path = `/ajuda/tickets/${ticketId.value}/${tipo}`
      const response =
        tipo === 'status'
          ? await api.patch(path, { status }, { signal: controller.signal })
          : await api.post(path, {}, { signal: controller.signal })
      if (epoch !== version) return
      ticket.value = response.data.data
      await sincronizar()
      atualizado()
    } catch (error) {
      if (epoch === version && error.code !== 'ERR_CANCELED') {
        erro.value = erroTicket(error)
        void sincronizar()
      }
    } finally {
      if (epoch === version) operando.value = false
    }
  }

  watch(ticketId, abrir, { immediate: true })
  onBeforeUnmount(() => {
    limpar()
    window.removeEventListener('focus', atualizarFoco)
    window.removeEventListener('blur', atualizarFoco)
    document.removeEventListener('visibilitychange', atualizarFoco)
  })
  return {
    ticket,
    mensagens,
    carregando,
    enviando,
    historico,
    maisAntigas,
    erro,
    texto,
    imagens,
    adicionarImagens,
    removerImagem,
    operando,
    podeResponder,
    autenticadoCanal,
    abrir,
    antigas,
    enviar,
    acao,
    sincronizar,
    revisaoTransferencias,
  }
}
