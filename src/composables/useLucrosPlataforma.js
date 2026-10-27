import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from 'boot/axios'

const dataLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function useLucrosPlataforma() {
  const periodo = ref('semanal')
  const data = ref(dataLocal())
  const inicio = ref(dataLocal())
  const fim = ref(dataLocal())
  const servico = ref('todos')
  const status = ref(null)
  const resultado = ref('todos')
  const demonstracao = ref(false)
  const pagina = ref(1)
  const resposta = ref(null)
  const detalhe = ref(null)
  const selecionado = ref(null)
  const carregando = ref(false)
  const carregandoDetalhe = ref(false)
  const erro = ref('')
  const erroDetalhe = ref('')
  let listaController, detalheController
  let listaVersao = 0
  let detalheVersao = 0
  let encerrado = false
  const parametros = computed(() => ({
    periodo: periodo.value,
    data: data.value,
    ...(periodo.value === 'personalizado'
      ? { data_inicio: inicio.value, data_fim: fim.value }
      : {}),
    tipo_servico: servico.value,
    status_custos: status.value || undefined,
    resultado: resultado.value,
    incluir_demonstracao: demonstracao.value ? 1 : 0,
    page: pagina.value,
  }))
  const mensagemErro = (e) => {
    const erros = e.response?.data?.errors
    return (
      (erros && Object.values(erros).flat().join(' ')) ||
      e.response?.data?.message ||
      'Não foi possível consultar os ganhos da plataforma.'
    )
  }
  function limparSelecao() {
    detalheVersao++
    detalheController?.abort()
    selecionado.value = null
    detalhe.value = null
    erroDetalhe.value = ''
    carregandoDetalhe.value = false
  }
  async function selecionar(id) {
    const versao = ++detalheVersao
    detalheController?.abort()
    selecionado.value = id
    detalhe.value = null
    erroDetalhe.value = ''
    carregandoDetalhe.value = true
    detalheController = new AbortController()
    try {
      const { data } = await api.get(`/plataforma-lucros/${id}`, {
        signal: detalheController.signal,
      })
      if (versao === detalheVersao && !encerrado) detalhe.value = data.data
    } catch (e) {
      if (versao === detalheVersao && e.code !== 'ERR_CANCELED') erroDetalhe.value = mensagemErro(e)
    } finally {
      if (versao === detalheVersao) carregandoDetalhe.value = false
    }
  }
  async function atualizar(sincronizar = true, preservar = false) {
    const versao = ++listaVersao
    listaController?.abort()
    const id = preservar ? selecionado.value : null
    limparSelecao()
    resposta.value = null
    erro.value = ''
    carregando.value = true
    listaController = new AbortController()
    if (
      !data.value ||
      (periodo.value === 'personalizado' &&
        (!inicio.value || !fim.value || fim.value < inicio.value))
    ) {
      erro.value = 'Informe um intervalo válido, com início e fim.'
      carregando.value = false
      return
    }
    const config = { signal: listaController.signal }
    try {
      if (sincronizar) await api.post('/plataforma-lucros/sincronizar', parametros.value, config)
      if (versao !== listaVersao || encerrado) return
      const { data } = await api.get('/plataforma-lucros', { ...config, params: parametros.value })
      if (versao !== listaVersao || encerrado) return
      resposta.value = data
      if (id && data.data.some((item) => item.id === id)) void selecionar(id)
    } catch (e) {
      if (versao === listaVersao && e.code !== 'ERR_CANCELED') erro.value = mensagemErro(e)
    } finally {
      if (versao === listaVersao) carregando.value = false
    }
  }
  function navegar(direcao) {
    const d = new Date(data.value + 'T12:00:00')
    if (Number.isNaN(d.getTime())) return
    if (periodo.value === 'mensal') {
      d.setDate(1)
      d.setMonth(d.getMonth() + direcao)
    } else d.setDate(d.getDate() + direcao * (periodo.value === 'semanal' ? 7 : 1))
    data.value = dataLocal(d)
  }
  watch([periodo, data, inicio, fim, servico, status, resultado, demonstracao], () => {
    if (pagina.value !== 1) pagina.value = 1
    else void atualizar()
  })
  watch(pagina, () => void atualizar(false))
  onMounted(() => void atualizar())
  onBeforeUnmount(() => {
    encerrado = true
    listaVersao++
    detalheVersao++
    listaController?.abort()
    detalheController?.abort()
  })
  return {
    periodo,
    data,
    inicio,
    fim,
    servico,
    status,
    resultado,
    demonstracao,
    pagina,
    resposta,
    detalhe,
    selecionado,
    carregando,
    carregandoDetalhe,
    erro,
    erroDetalhe,
    atualizar,
    selecionar,
    limparSelecao,
    navegar,
  }
}
