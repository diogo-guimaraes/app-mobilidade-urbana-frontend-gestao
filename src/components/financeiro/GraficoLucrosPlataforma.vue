<template>
  <section class="grafico-lucros" aria-label="Gráfico detalhado dos ganhos da plataforma">
    <div class="resumo-grafico">
      <div class="text-caption text-grey-7">{{ tituloResultadoPlataforma(resultado) }}</div>
      <div
        class="total-grafico text-weight-bold"
        :class="Number(total) < 0 ? 'text-negative' : 'text-positive'"
        aria-label="Total do gráfico"
      >
        {{ moedaSaldo(total) }}
      </div>
      <div class="periodo-grafico text-weight-medium">{{ periodoFormatado }}</div>
      <div class="text-caption text-grey-7 q-mt-xs">
        {{ diario ? 'Distribuição por hora do dia' : 'Distribuição por dia' }} ·
        {{ intervalo.timezone || 'America/Porto_Velho' }}
      </div>
      <q-badge v-if="resultado !== 'todos'" outline color="primary" class="q-mt-sm">
        {{ resultado === 'positivo' ? 'Somente ganhos positivos' : 'Somente saídas negativas' }}
      </q-badge>
      <q-badge v-if="demonstracao" color="amber-1" text-color="brown-9" class="q-mt-sm">
        Inclui dados de demonstração
      </q-badge>
    </div>

    <figure class="q-ma-none" aria-label="Distribuição do lucro realizado">
      <div class="cabecalho-barras">
        <div>
          <div class="text-subtitle2">
            {{ resultado === 'negativo' ? 'Saídas' : 'Ganhos' }} por {{ diario ? 'hora' : 'dia' }}
          </div>
          <div class="text-caption text-grey-7">
            Valores em R$ · toque em uma barra para detalhar
          </div>
        </div>
        <div class="row no-wrap">
          <q-btn
            flat
            round
            dense
            icon="chevron_left"
            aria-label="Ver intervalos anteriores"
            :disable="!podeVoltar"
            @click="rolar(-1)"
          />
          <q-btn
            flat
            round
            dense
            icon="chevron_right"
            aria-label="Ver próximos intervalos"
            :disable="!podeAvancar"
            @click="rolar(1)"
          />
        </div>
      </div>
      <div class="area-grafico">
        <svg class="escala-grafico" width="88" :height="altura" aria-hidden="true">
          <text
            v-for="marca in marcas"
            :key="marca"
            x="78"
            :y="y(marca) + 4"
            text-anchor="end"
            fill="#64748b"
            font-size="11"
          >
            {{ numero(marca / 100) }}
          </text>
        </svg>
        <div
          ref="janela"
          class="rolagem-grafico"
          tabindex="0"
          aria-label="Área rolável do gráfico"
          @scroll="atualizarRolagem"
        >
          <svg
            :width="largura"
            :height="altura"
            :viewBox="`0 0 ${largura} ${altura}`"
            role="group"
            :aria-label="diario ? 'Resultado das 00:00 às 23:59' : 'Resultado diário do período'"
          >
            <g aria-hidden="true">
              <line
                v-for="marca in marcas"
                :key="marca"
                x1="0"
                :y1="y(marca)"
                :x2="largura"
                :y2="y(marca)"
                :stroke="marca === 0 ? '#94a3b8' : '#e2e8f0'"
                :stroke-dasharray="marca === 0 ? undefined : '4 4'"
              />
            </g>
            <g
              v-for="(ponto, indice) in dados"
              :key="ponto.data"
              class="ponto-grafico"
              role="button"
              tabindex="0"
              :aria-label="descricao(ponto)"
              :aria-pressed="indice === ativo"
              @click="ativo = indice"
              @focus="ativo = indice"
              @keydown.enter.prevent="ativo = indice"
              @keydown.space.prevent="ativo = indice"
            >
              <title>{{ descricao(ponto) }}</title>
              <rect
                :x="indice * passo + 2"
                y="12"
                :width="passo - 4"
                :height="altura - 18"
                rx="8"
                :fill="ativo === indice ? '#eff6ff' : 'transparent'"
              />
              <rect
                :x="indice * passo + passo * 0.22"
                :y="Math.min(y(centavos(ponto.valor)), y(0))"
                :width="passo * 0.56"
                :height="
                  Math.max(
                    centavos(ponto.valor) === 0 ? 2 : 3,
                    Math.abs(y(centavos(ponto.valor)) - y(0)),
                  )
                "
                rx="5"
                :fill="
                  centavos(ponto.valor) < 0
                    ? '#c0393c'
                    : centavos(ponto.valor) > 0
                      ? '#1976d2'
                      : '#cbd5e1'
                "
              />
              <text
                :x="indice * passo + passo / 2"
                :y="
                  centavos(ponto.valor) < 0
                    ? y(centavos(ponto.valor)) + 20
                    : y(centavos(ponto.valor)) - 12
                "
                text-anchor="middle"
                :fill="centavos(ponto.valor) < 0 ? '#b4232c' : '#1e293b'"
                font-size="12"
                font-weight="600"
              >
                {{ numero(Number(ponto.valor)) }}
              </text>
              <text
                :x="indice * passo + passo / 2"
                y="292"
                text-anchor="middle"
                fill="#334155"
                font-size="12"
                font-weight="500"
              >
                {{ diario ? ponto.data : dataCurta(ponto.data) }}
              </text>
              <text
                v-if="!diario"
                :x="indice * passo + passo / 2"
                y="311"
                text-anchor="middle"
                fill="#64748b"
                font-size="11"
              >
                {{ diaSemana(ponto.data) }}
              </text>
            </g>
          </svg>
        </div>
      </div>
      <figcaption class="legenda-grafico">
        <span><i class="positivo" />Resultado positivo</span>
        <span><i class="negativo" />Resultado negativo</span>
        <span><i class="zero" />Resultado zero</span>
      </figcaption>
    </figure>

    <div class="indicadores-grafico">
      <div>
        <span>{{ diario ? 'Melhor horário' : 'Melhor dia' }}</span>
        <strong>{{ melhor ? moedaSaldo(melhor.valor) : '—' }}</strong>
        <small>{{ melhor ? rotuloCompleto(melhor.data) : 'Sem movimentos' }}</small>
      </div>
      <div>
        <span>{{ diario ? 'Média por hora' : 'Média por dia' }}</span>
        <strong>{{ moedaSaldo(media) }}</strong>
        <small>Considera todos os {{ dados.length }} {{ diario ? 'horários' : 'dias' }}</small>
      </div>
      <div v-if="temContagem">
        <span>Operações conciliadas</span>
        <strong>{{ quantidade }}</strong>
        <small>Recebidas e com custos conferidos</small>
      </div>
    </div>

    <div v-if="pontoAtivo" class="detalhe-intervalo" aria-live="polite">
      <div>
        <div class="text-weight-medium">{{ rotuloCompleto(pontoAtivo.data) }}</div>
        <div class="text-caption text-grey-7">
          {{ diario ? dataLonga(intervalo.inicio) + ' · ' : '' }}
          {{
            pontoAtivo.quantidade == null
              ? 'Lucro realizado neste intervalo'
              : pontoAtivo.quantidade + ' operação(ões) conciliada(s)'
          }}
        </div>
      </div>
      <strong :class="Number(pontoAtivo.valor) < 0 ? 'text-negative' : 'text-primary'">{{
        moedaSaldo(pontoAtivo.valor)
      }}</strong>
    </div>
    <div v-if="!temMovimentos" class="text-grey-7 text-center q-pa-md" role="status">
      Nenhuma operação recebida e consolidada neste período.
    </div>
    <p class="explicacao-grafico text-caption text-grey-7 q-mb-none">
      Apuração pela data de recebimento.
      <template v-if="resultado === 'todos'"
        >Inclui despesas conciliadas, que podem reduzir o resultado.</template
      >
      <template v-else
        >Exibe somente operações com resultado {{ resultado }}, antes de somar os
        intervalos.</template
      >
      Comissões a receber e operações com custos pendentes ficam fora deste gráfico.
    </p>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { moedaSaldo } from 'src/utils/saldoMotoristas'
import { tituloResultadoPlataforma } from 'src/utils/lucrosPlataforma'

const props = defineProps({
  dados: { type: Array, default: () => [] },
  total: { type: [String, Number], default: '0.00' },
  intervalo: { type: Object, required: true },
  diario: Boolean,
  demonstracao: Boolean,
  resultado: { type: String, default: 'todos' },
})
const janela = ref(null)
const larguraDisponivel = ref(600)
const podeVoltar = ref(false)
const podeAvancar = ref(false)
const ativo = ref(0)
const altura = 330
let observador
const centavos = (valor) => {
  const partes = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(valor ?? 0))
  return partes
    ? (partes[1] ? -1 : 1) * (Number(partes[2]) * 100 + Number((partes[3] || '').padEnd(2, '0')))
    : 0
}
const numero = (valor) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    valor,
  )
const dataLonga = (data) =>
  data
    ? new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(data + 'T12:00:00'))
    : ''
const dataCurta = (data) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(data + 'T12:00:00'),
  )
const diaSemana = (data) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(data + 'T12:00:00'))
const periodoFormatado = computed(() =>
  props.intervalo.inicio === props.intervalo.fim
    ? dataLonga(props.intervalo.inicio)
    : `${dataCurta(props.intervalo.inicio)}/${props.intervalo.inicio?.slice(0, 4)} a ${dataCurta(props.intervalo.fim)}/${props.intervalo.fim?.slice(0, 4)}`,
)
const rotuloCompleto = (data) =>
  props.diario ? `${data} às ${data.slice(0, 2)}:59` : dataLonga(data)
const descricao = (ponto) =>
  `${rotuloCompleto(ponto.data)}: ${moedaSaldo(ponto.valor)}${ponto.quantidade == null ? '' : `, ${ponto.quantidade} operação(ões) conciliada(s)`}`
const valores = computed(() => props.dados.map((p) => centavos(p.valor)))
const movimentos = computed(() =>
  props.dados.filter((p) => centavos(p.valor) !== 0 || Number(p.quantidade) > 0),
)
const temMovimentos = computed(() => movimentos.value.length > 0)
const melhor = computed(() =>
  movimentos.value.reduce(
    (melhor, p) => (!melhor || centavos(p.valor) > centavos(melhor.valor) ? p : melhor),
    null,
  ),
)
const media = computed(() => {
  const soma = valores.value.reduce((soma, v) => soma + v, 0)
  return props.dados.length
    ? (Math.sign(soma) * Math.round(Math.abs(soma) / props.dados.length)) / 100
    : 0
})
const temContagem = computed(() => props.dados.some((p) => p.quantidade != null))
const quantidade = computed(() =>
  props.dados.reduce((soma, p) => soma + Number(p.quantidade || 0), 0),
)
const pontoAtivo = computed(() => props.dados[ativo.value])
const largura = computed(() => Math.max(larguraDisponivel.value, props.dados.length * 84))
const passo = computed(() => largura.value / Math.max(1, props.dados.length))
const limites = computed(() => {
  const minimo = Math.min(0, ...valores.value)
  const maximo = Math.max(0, ...valores.value)
  const bruto = Math.max(100, (maximo - minimo) / 4)
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const salto = [1, 2, 5, 10].find((n) => n * potencia >= bruto) * potencia
  return {
    minimo: Math.floor(minimo / salto) * salto,
    maximo: Math.max(salto, Math.ceil(maximo / salto) * salto),
    salto,
  }
})
const marcas = computed(() => {
  const { minimo, maximo, salto } = limites.value
  return Array.from(
    { length: Math.round((maximo - minimo) / salto) + 1 },
    (_, i) => minimo + i * salto,
  )
})
const y = (valor) =>
  46 + ((limites.value.maximo - valor) / (limites.value.maximo - limites.value.minimo)) * 200
function atualizarRolagem() {
  if (!janela.value) return
  podeVoltar.value = janela.value.scrollLeft > 1
  podeAvancar.value =
    janela.value.scrollLeft + janela.value.clientWidth < janela.value.scrollWidth - 1
}
function rolar(direcao) {
  janela.value?.scrollBy({ left: direcao * janela.value.clientWidth * 0.8, behavior: 'smooth' })
}
async function posicionar() {
  ativo.value = Math.max(0, props.dados.indexOf(melhor.value))
  await nextTick()
  janela.value?.scrollTo({
    left: Math.max(0, (ativo.value - 1) * passo.value),
  })
  atualizarRolagem()
}
watch(() => props.dados, posicionar, { flush: 'post' })
onMounted(() => {
  observador = new ResizeObserver(() => {
    larguraDisponivel.value = janela.value?.clientWidth || 600
    void nextTick(atualizarRolagem)
  })
  observador.observe(janela.value)
  void posicionar()
})
onBeforeUnmount(() => observador?.disconnect())
</script>

<style scoped>
.grafico-lucros {
  min-width: 0;
}
.resumo-grafico {
  text-align: center;
  padding: 6px 0 24px;
}
.total-grafico {
  font-size: clamp(30px, 3.2vw, 44px);
  line-height: 1.3;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.periodo-grafico {
  font-size: 16px;
  color: #334155;
}
.indicadores-grafico {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.indicadores-grafico > div {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  min-width: 0;
}
.indicadores-grafico span,
.indicadores-grafico small {
  display: block;
  color: #64748b;
  font-size: 12px;
}
.indicadores-grafico strong {
  display: block;
  color: #1e293b;
  font-size: 20px;
  margin: 5px 0;
  overflow-wrap: anywhere;
}
.cabecalho-barras {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px;
}
figure {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.area-grafico {
  display: flex;
  min-width: 0;
  padding-right: 12px;
}
.escala-grafico {
  flex: 0 0 88px;
}
.rolagem-grafico {
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 6px;
}
.rolagem-grafico svg {
  display: block;
}
.ponto-grafico {
  cursor: pointer;
  outline: none;
}
.ponto-grafico:focus-visible > rect:first-of-type {
  stroke: #1976d2;
  stroke-width: 2;
}
.legenda-grafico {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  color: #64748b;
  font-size: 12px;
  border-top: 1px solid #f1f5f9;
}
.legenda-grafico span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legenda-grafico i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.positivo {
  background: #1976d2;
}
.negativo {
  background: #c0393c;
}
.zero {
  background: #cbd5e1;
}
.detalhe-intervalo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 16px;
  padding: 16px;
}
.detalhe-intervalo strong {
  font-size: 22px;
}
.explicacao-grafico {
  margin-top: 16px;
}
@media (max-width: 599px) {
  .indicadores-grafico {
    grid-template-columns: 1fr;
  }
  .cabecalho-barras {
    padding: 12px;
  }
  .escala-grafico {
    flex-basis: 72px;
    width: 72px;
  }
  .escala-grafico text {
    transform: translateX(-16px);
    font-size: 10px;
  }
}
</style>
