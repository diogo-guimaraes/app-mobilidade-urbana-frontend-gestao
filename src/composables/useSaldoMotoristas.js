import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from 'boot/axios'

export function useSaldoMotoristas() {
  const movimentos = ref([])
  const selecionado = ref(null)
  const detalhe = ref(null)
  const search = ref('')
  const tipo = ref(null)
  const categoria = ref(null)
  const status = ref(null)
  const dataInicio = ref('')
  const dataFim = ref('')
  const page = ref(1)
  const total = ref(0)
  const ultimaPagina = ref(1)
  const carregando = ref(false)
  const carregandoDetalhe = ref(false)
  const erro = ref('')
  const erroDetalhe = ref('')
  let listaController, detalheController
  let versaoLista = 0,
    versaoDetalhe = 0
  const mensagemErro = (e) =>
    e.response?.data?.message || 'Não foi possível carregar as movimentações. Tente novamente.'

  function voltar() {
    versaoDetalhe++
    detalheController?.abort()
    selecionado.value = null
    detalhe.value = null
    erroDetalhe.value = ''
    carregandoDetalhe.value = false
  }

  async function abrir(id) {
    const versao = ++versaoDetalhe
    detalheController?.abort()
    detalheController = new AbortController()
    selecionado.value = id
    detalhe.value = null
    erroDetalhe.value = ''
    carregandoDetalhe.value = true
    try {
      const { data } = await api.get('/motoristas-saldo/' + id, {
        signal: detalheController.signal,
      })
      if (versao === versaoDetalhe) detalhe.value = data.data
    } catch (e) {
      if (versao === versaoDetalhe && e.code !== 'ERR_CANCELED') erroDetalhe.value = mensagemErro(e)
    } finally {
      if (versao === versaoDetalhe) carregandoDetalhe.value = false
    }
  }

  async function carregar() {
    const versao = ++versaoLista
    listaController?.abort()
    listaController = new AbortController()
    carregando.value = true
    erro.value = ''
    try {
      const { data } = await api.get('/motoristas-saldo', {
        params: {
          search: search.value || undefined,
          tipo: tipo.value || undefined,
          categoria: categoria.value || undefined,
          status: status.value || undefined,
          data_inicio: dataInicio.value || undefined,
          data_fim: dataFim.value || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          page: page.value,
          per_page: 20,
        },
        signal: listaController.signal,
      })
      if (versao !== versaoLista) return
      movimentos.value = data.data
      total.value = data.meta.total
      ultimaPagina.value = Math.max(1, data.meta.last_page)
      if (selecionado.value && !movimentos.value.some((m) => m.id === selecionado.value)) voltar()
      if (page.value > ultimaPagina.value) page.value = ultimaPagina.value
    } catch (e) {
      if (versao === versaoLista && e.code !== 'ERR_CANCELED') erro.value = mensagemErro(e)
    } finally {
      if (versao === versaoLista) carregando.value = false
    }
  }

  function limpar() {
    search.value = ''
    tipo.value = null
    categoria.value = null
    status.value = null
    dataInicio.value = ''
    dataFim.value = ''
  }
  async function atualizar() {
    const id = selecionado.value
    await carregar()
    if (id && selecionado.value === id) await abrir(id)
  }
  watch([search, tipo, categoria, status, dataInicio, dataFim], () => {
    voltar()
    if (page.value !== 1) page.value = 1
    else void carregar()
  })
  watch(page, () => {
    void carregar()
  })
  onMounted(carregar)
  onBeforeUnmount(() => {
    versaoLista++
    versaoDetalhe++
    listaController?.abort()
    detalheController?.abort()
  })
  return {
    movimentos,
    selecionado,
    detalhe,
    search,
    tipo,
    categoria,
    status,
    dataInicio,
    dataFim,
    page,
    total,
    ultimaPagina,
    carregando,
    carregandoDetalhe,
    erro,
    erroDetalhe,
    abrir,
    voltar,
    carregar,
    atualizar,
    limpar,
  }
}
