<template>
  <figure class="q-ma-none" aria-label="Distribuição dos ganhos no período">
    <svg
      viewBox="0 0 700 190"
      role="img"
      :aria-label="anual ? 'Gráfico dos ganhos por mês' : 'Gráfico dos ganhos por horário ou dia'"
    >
      <line x1="8" y1="116" x2="692" y2="116" stroke="#cbd5e1" />
      <g v-for="(ponto, indice) in dados" :key="ponto.data">
        <title>{{ ponto.data }}: {{ moedaSaldo(ponto.valor) }}</title>
        <rect
          :x="12 + indice * largura"
          :y="Number(ponto.valor) < 0 ? 116 : 116 - altura(ponto.valor)"
          :width="Math.max(2, largura - 8)"
          :height="altura(ponto.valor)"
          rx="4"
          :fill="Number(ponto.valor) < 0 ? '#c0393c' : '#1976d2'"
        />
        <text
          v-if="mostrarRotulo(indice)"
          :x="12 + indice * largura + (largura - 8) / 2"
          y="174"
          text-anchor="middle"
          fill="#64748b"
          font-size="15"
        >
          {{ rotulo(ponto.data) }}
        </text>
      </g>
    </svg>
    <figcaption class="text-caption text-grey-7 text-center">
      {{ anual ? 'Ganhos por mês' : diario ? 'Ganhos por hora' : 'Ganhos por dia' }}
    </figcaption>
  </figure>
</template>

<script setup>
import { computed } from 'vue'
import { moedaSaldo } from 'src/utils/saldoMotoristas'
const props = defineProps({
  dados: { type: Array, default: () => [] },
  diario: Boolean,
  anual: Boolean,
})
const largura = computed(() => 680 / Math.max(1, props.dados.length))
const maximo = computed(() => Math.max(1, ...props.dados.map((p) => Math.abs(Number(p.valor)))))
const altura = (valor) => (Math.abs(Number(valor)) / maximo.value) * (Number(valor) < 0 ? 35 : 100)
const mostrarRotulo = (indice) =>
  props.anual || props.dados.length <= 7 || indice % (props.diario ? 4 : 5) === 0
const rotulo = (valor) =>
  props.diario
    ? valor
    : new Intl.DateTimeFormat(
        'pt-BR',
        props.anual
          ? { month: 'short' }
          : props.dados.length <= 7
            ? { weekday: 'short' }
            : { day: '2-digit' },
      ).format(new Date(valor + 'T12:00:00'))
</script>

<style scoped>
svg {
  display: block;
  width: 100%;
  height: auto;
}
</style>
