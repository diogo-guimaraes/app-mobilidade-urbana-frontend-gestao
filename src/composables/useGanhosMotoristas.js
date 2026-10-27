import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from 'boot/axios'

export function useGanhosMotoristas() {
  const hoje = new Date()
  const data = ref(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
  )
  const motorista = ref(null)
  const motoristas = ref([])
  const buscandoMotoristas = ref(false)
  const periodo = ref('semanal')
  const tipoServico = ref('todos')
  const resumo = ref(null)
  const carregando = ref(false)
  const erro = ref('')
  const visao = ref('produtividade')
  const itens = ref([])
  const pagina = ref(1)
  const ultimaPagina = ref(1)
  const total = ref(0)
  const carregandoDetalhes = ref(false)
  const erroDetalhes = ref('')
  let buscaController, resumoController, detalhesController
  let buscaVersao = 0,
    resumoVersao = 0,
    detalhesVersao = 0
  const parametros = computed(() => ({
    motorista_id: motorista.value?.id,
    data: data.value,
    periodo: periodo.value,
    tipo_servico: tipoServico.value,
  }))
  const mensagemErro = (e) =>
    e.response?.data?.message || 'Não foi possível consultar os ganhos. Tente novamente.'

  async function buscarMotoristas(termo = '', atualizar) {
    const versao = ++buscaVersao
    buscaController?.abort()
    buscaController = new AbortController()
    buscandoMotoristas.value = true
    try {
      const { data: resposta } = await api.get('/motoristas-ganhos/motoristas', {
        params: { search: termo || undefined },
        signal: buscaController.signal,
      })
      if (versao !== buscaVersao) return
      const aplicar = () => {
        motoristas.value = resposta.data
      }
      if (atualizar) atualizar(aplicar)
      else aplicar()
    } catch (e) {
      if (versao === buscaVersao && e.code !== 'ERR_CANCELED') {
        erro.value = mensagemErro(e)
        if (atualizar)
          atualizar(() => {
            motoristas.value = []
          })
      }
    } finally {
      if (versao === buscaVersao) buscandoMotoristas.value = false
    }
  }

  async function atualizar() {
    const versao = ++resumoVersao
    resumoController?.abort()
    detalhesController?.abort()
    detalhesVersao++
    resumo.value = null
    visao.value = 'produtividade'
    itens.value = []
    ultimaPagina.value = 1
    erro.value = ''
    erroDetalhes.value = ''
    carregando.value = false
    carregandoDetalhes.value = false
    pagina.value = 1
    if (!motorista.value?.id || !data.value) return
    resumoController = new AbortController()
    carregando.value = true
    try {
      const { data: resposta } = await api.get('/motoristas-ganhos/resumo', {
        params: parametros.value,
        signal: resumoController.signal,
      })
      if (versao === resumoVersao) resumo.value = resposta.data
    } catch (e) {
      if (versao === resumoVersao && e.code !== 'ERR_CANCELED') erro.value = mensagemErro(e)
    } finally {
      if (versao === resumoVersao) carregando.value = false
    }
  }

  async function carregarDetalhes() {
    const versao = ++detalhesVersao
    detalhesController?.abort()
    itens.value = []
    total.value = 0
    erroDetalhes.value = ''
    carregandoDetalhes.value = false
    if (!resumo.value || visao.value === 'produtividade' || periodo.value === 'anual') return
    detalhesController = new AbortController()
    carregandoDetalhes.value = true
    try {
      const { data: resposta } = await api.get('/motoristas-ganhos/detalhes', {
        params: { ...parametros.value, visao: visao.value, page: pagina.value, per_page: 20 },
        signal: detalhesController.signal,
      })
      if (versao !== detalhesVersao) return
      itens.value = resposta.data
      total.value = resposta.meta.total
      ultimaPagina.value = resposta.meta.last_page
    } catch (e) {
      if (versao === detalhesVersao && e.code !== 'ERR_CANCELED')
        erroDetalhes.value = mensagemErro(e)
    } finally {
      if (versao === detalhesVersao) carregandoDetalhes.value = false
    }
  }

  function abrirVisao(valor) {
    if (periodo.value === 'anual' && valor !== 'produtividade') return
    if (visao.value !== valor) ultimaPagina.value = 1
    visao.value = valor
    pagina.value = 1
  }
  function navegar(direcao) {
    const referencia = new Date(data.value + 'T12:00:00')
    if (Number.isNaN(referencia.getTime())) return
    if (periodo.value === 'anual') {
      referencia.setMonth(0, 1)
      referencia.setFullYear(referencia.getFullYear() + direcao)
    } else if (periodo.value === 'mensal') {
      referencia.setDate(1)
      referencia.setMonth(referencia.getMonth() + direcao)
    } else
      referencia.setDate(referencia.getDate() + direcao * (periodo.value === 'semanal' ? 7 : 1))
    data.value = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}-${String(referencia.getDate()).padStart(2, '0')}`
  }
  watch([() => motorista.value?.id, data, periodo, tipoServico], atualizar)
  watch([visao, pagina], carregarDetalhes)
  onMounted(() => buscarMotoristas())
  onBeforeUnmount(() => {
    buscaVersao++
    resumoVersao++
    detalhesVersao++
    buscaController?.abort()
    resumoController?.abort()
    detalhesController?.abort()
  })
  return {
    data,
    motorista,
    motoristas,
    buscandoMotoristas,
    periodo,
    tipoServico,
    resumo,
    carregando,
    erro,
    visao,
    itens,
    pagina,
    ultimaPagina,
    total,
    carregandoDetalhes,
    erroDetalhes,
    buscarMotoristas,
    atualizar,
    carregarDetalhes,
    abrirVisao,
    navegar,
  }
}
