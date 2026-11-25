<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar rounded size="52px" color="blue-1" text-color="primary" icon="view_list" />
        <div class="col">
          <div class="text-caption text-grey-7">Corridas</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Corridas em andamento (lista)</h1>
          <div class="text-grey-7 q-mt-xs">
            Todas as informações de cada corrida ativa: itinerário, valores, horários e pagamento.
            Atualiza a cada 5 segundos.
          </div>
        </div>
        <q-btn
          outline
          color="primary"
          icon="map"
          label="Ver com mapa"
          to="/corridas-em-andamento"
        />
      </q-card-section>
      <q-card-section class="q-pt-none row q-gutter-sm items-center">
        <q-chip
          v-for="e in ETAPAS"
          :key="e.status"
          clickable
          :outline="filtro !== e.status"
          :color="e.cor"
          :text-color="filtro === e.status ? 'white' : e.cor"
          :label="`${e.rotulo}: ${contagem[e.status] || 0}`"
          @click="filtro = filtro === e.status ? null : e.status"
        />
        <q-input
          v-model="busca"
          dense
          filled
          debounce="200"
          placeholder="Buscar por código, motorista, passageiro ou placa"
          class="col-12 col-md-4"
        >
          <template #append><q-icon name="search" /></template>
        </q-input>
      </q-card-section>
    </q-card>

    <q-banner v-if="erro" rounded class="bg-red-1 text-negative q-mb-md">
      {{ erro }}
      <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
    </q-banner>

    <div v-if="carregando && !corridas.length" class="text-center q-pa-xl" role="status">
      <q-spinner color="primary" size="36px" />
    </div>
    <div v-else-if="!visiveis.length" class="text-grey-7 text-center q-pa-xl">
      Nenhuma corrida em andamento{{ filtro || busca ? ' com esse filtro' : ' agora' }}.
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="c in visiveis" :key="c.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="full-height">
          <q-card-section class="row items-center no-wrap">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">
                #{{ c.id }}
                <span v-if="c.codigo_corrida" class="text-grey-7 text-caption">
                  · {{ c.codigo_corrida }}
                </span>
              </div>
              <div v-if="c.produto?.nome" class="text-caption text-grey-7">
                {{ c.produto.nome }}
              </div>
            </div>
            <q-badge :color="etapa(c.status_corrida).cor" class="q-pa-xs">
              {{ etapa(c.status_corrida).rotulo }}
            </q-badge>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-py-sm">
            <div class="secao">Pessoas</div>
            <div><span class="text-bold">Motorista:</span> {{ c.motorista?.name || '—' }}</div>
            <div>
              <span class="text-bold">Passageiro:</span>
              {{ c.passageiro?.name || c.convidado_nome || '—' }}
              <span v-if="c.convidado_telefone" class="text-grey-7">
                ({{ c.convidado_telefone }})
              </span>
            </div>
            <div v-if="c.veiculo">
              <span class="text-bold">Veículo:</span>
              {{ [c.veiculo.modelo, c.veiculo.cor, c.veiculo.placa].filter(Boolean).join(' · ') }}
            </div>
            <div v-if="semSinal(c)" class="text-caption text-orange-9">
              Motorista sem sinal de localização há mais de 90 s.
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-py-sm">
            <div class="secao">Itinerário</div>
            <q-timeline dense color="primary" class="q-pl-xs q-my-none">
              <q-timeline-entry
                v-for="d in trajeto(c)"
                :key="d.id"
                :icon="iconeDe(d.tipo)"
                :color="corDe(d.tipo)"
                :subtitle="rotuloDe(d.tipo)"
              >
                {{ d.endereco || 'Endereço não informado' }}
              </q-timeline-entry>
            </q-timeline>
            <div v-if="!trajeto(c).length" class="text-grey-7">Sem itinerário registrado.</div>
            <div v-if="c.distancia_total != null" class="text-caption text-grey-7">
              Distância total: {{ c.distancia_total }} km
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-py-sm">
            <div class="secao">Valores e pagamento</div>
            <div v-for="campo in valoresDe(c)" :key="campo.chave" class="row justify-between">
              <span class="text-grey-8">{{ campo.label }}</span>
              <span :class="destaque(campo.chave) ? 'text-weight-bold' : ''">{{
                campo.valor
              }}</span>
            </div>
            <div v-if="!valoresDe(c).length" class="text-grey-7">Sem valores registrados.</div>
            <div v-if="c.multiplicador_dinamico && Number(c.multiplicador_dinamico) !== 1">
              <q-badge color="deep-orange">Dinâmico ×{{ c.multiplicador_dinamico }}</q-badge>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-py-sm">
            <div class="secao">Horários</div>
            <div v-for="campo in horariosDe(c)" :key="campo.chave" class="row justify-between">
              <span class="text-grey-8">{{ campo.label }}</span>
              <span>{{ campo.valor }}</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { camposDetalhes } from 'src/utils/detalhesRegistro'

const ETAPAS = [
  { status: 'aguardando_pagamento', rotulo: 'Aguardando pagamento', cor: 'grey-7' },
  { status: 'aceita', rotulo: 'A caminho', cor: 'primary' },
  { status: 'motorista_chegou', rotulo: 'Motorista no local', cor: 'orange' },
  { status: 'em_andamento', rotulo: 'Em viagem', cor: 'green' },
]
const SINAL_PERDIDO_MS = 90_000
const DESTACADOS = ['valor_pago_passageiro', 'valor_estimado_inicial', 'valor_negociado_final']

const corridas = ref([])
const carregando = ref(true)
const erro = ref('')
const filtro = ref(null)
const busca = ref('')
let temporizador

const etapa = (status) => ETAPAS.find((e) => e.status === status) || { rotulo: status, cor: 'grey' }

const contagem = computed(() =>
  corridas.value.reduce((acc, c) => {
    acc[c.status_corrida] = (acc[c.status_corrida] || 0) + 1
    return acc
  }, {}),
)

const visiveis = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  return corridas.value.filter((c) => {
    if (filtro.value && c.status_corrida !== filtro.value) return false
    if (!termo) return true
    return [c.id, c.codigo_corrida, c.motorista?.name, c.passageiro?.name, c.veiculo?.placa]
      .filter((v) => v != null)
      .some((v) => String(v).toLowerCase().includes(termo))
  })
})

const trajeto = (c) => [...(c.corrida_destinos || [])].sort((a, b) => a.ordem - b.ordem)
const rotuloDe = (tipo) => ({ origem: 'Embarque', destino: 'Destino' })[tipo] || 'Parada'
const iconeDe = (tipo) =>
  ({ origem: 'arrow_circle_up', destino: 'arrow_circle_down' })[tipo] || 'stop_circle'
const corDe = (tipo) => ({ origem: 'green', destino: 'red' })[tipo] || 'orange'

const semSinal = (c) => {
  const visto = c.posicao_motorista?.visto_em
  return !visto || Date.now() - new Date(visto.replace(' ', 'T')).getTime() > SINAL_PERDIDO_MS
}

const todosCampos = (c) => camposDetalhes('corrida', c)
const valoresDe = (c) =>
  todosCampos(c).filter(
    (campo) =>
      campo.chave.startsWith('corrida_financeiro.') ||
      campo.chave.startsWith('valor_') ||
      ['metodo_pagamento', 'status_pagamento'].includes(campo.chave),
  )
const horariosDe = (c) => todosCampos(c).filter((campo) => campo.chave.startsWith('tempo_'))
const destaque = (chave) => DESTACADOS.some((nome) => chave.endsWith(nome))

async function carregar() {
  try {
    const { data } = await api.get('/corridas/em-andamento')
    corridas.value = data.corridas
    erro.value = ''
  } catch (e) {
    erro.value = e.response?.data?.message || 'Não foi possível carregar as corridas.'
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  await carregar()
  temporizador = setInterval(carregar, 5000)
})
onBeforeUnmount(() => clearInterval(temporizador))
</script>

<style scoped>
.secao {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 4px;
}
</style>
