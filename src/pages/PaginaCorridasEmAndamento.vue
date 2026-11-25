<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar rounded size="52px" color="blue-1" text-color="primary" icon="directions_car" />
        <div class="col">
          <div class="text-caption text-grey-7">Corridas</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Corridas em andamento</h1>
          <div class="text-grey-7 q-mt-xs">
            Corridas ativas agora, do aceite até o fim da viagem, com a posição do motorista.
            Atualiza a cada 5 segundos.
          </div>
        </div>
        <q-btn
          outline
          color="primary"
          icon="view_list"
          label="Ver em lista"
          to="/corridas-em-andamento/lista"
        />
        <div class="row q-gutter-sm">
          <q-chip
            v-for="e in ETAPAS"
            :key="e.status"
            :color="e.cor"
            text-color="white"
            :label="`${e.rotulo}: ${contagem[e.status] || 0}`"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="erro" rounded class="bg-red-1 text-negative q-mb-md">
      {{ erro }}
      <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
    </q-banner>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-8">
        <q-card flat bordered>
          <div ref="elementoMapa" class="mapa" role="region" aria-label="Mapa das corridas" />
          <div v-if="falhaMapa" class="text-caption text-orange-9 q-pa-sm">
            O mapa de fundo está indisponível. Os pontos continuam visíveis.
          </div>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat bordered>
          <q-inner-loading :showing="carregando && !corridas.length" />
          <q-list separator>
            <q-item v-if="!corridas.length && !carregando">
              <q-item-section class="text-grey-7"
                >Nenhuma corrida em andamento agora.</q-item-section
              >
            </q-item>
            <q-item
              v-for="c in corridas"
              :key="c.id"
              clickable
              :active="selecionada === c.id"
              active-class="bg-blue-1"
              @click="selecionar(c)"
            >
              <q-item-section>
                <q-item-label class="row items-center q-gutter-xs">
                  <span class="text-weight-bold">#{{ c.id }}</span>
                  <q-badge :color="etapa(c.status_corrida).cor">
                    {{ etapa(c.status_corrida).rotulo }}
                  </q-badge>
                  <q-badge v-if="semSinal(c)" color="grey-7">sem sinal</q-badge>
                </q-item-label>
                <q-item-label>
                  <span class="text-bold">Motorista:</span> {{ c.motorista?.name || '—' }}
                </q-item-label>
                <q-item-label>
                  <span class="text-bold">Passageiro:</span> {{ c.passageiro?.name || '—' }}
                </q-item-label>
                <q-item-label caption lines="2">
                  {{ enderecoDe(c, 'origem') }} → {{ enderecoDe(c, 'destino') }}
                </q-item-label>
                <q-item-label v-if="c.veiculo?.placa" caption>
                  {{ c.veiculo.modelo }} · {{ c.veiculo.placa }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from 'boot/axios'

const ETAPAS = [
  { status: 'aguardando_pagamento', rotulo: 'Aguardando pagamento', cor: 'grey-7' },
  { status: 'aceita', rotulo: 'A caminho', cor: 'primary' },
  { status: 'motorista_chegou', rotulo: 'Motorista no local', cor: 'orange' },
  { status: 'em_andamento', rotulo: 'Em viagem', cor: 'green' },
]
const SINAL_PERDIDO_MS = 90_000

const corridas = ref([])
const carregando = ref(true)
const erro = ref('')
const selecionada = ref(null)
const falhaMapa = ref(false)
const elementoMapa = ref(null)

const contagem = computed(() =>
  corridas.value.reduce((acc, c) => {
    acc[c.status_corrida] = (acc[c.status_corrida] || 0) + 1
    return acc
  }, {}),
)

const etapa = (status) => ETAPAS.find((e) => e.status === status) || { rotulo: status, cor: 'grey' }

const enderecoDe = (corrida, tipo) =>
  corrida.corrida_destinos?.find((d) => d.tipo === tipo)?.endereco || '—'

const semSinal = (corrida) => {
  const visto = corrida.posicao_motorista?.visto_em
  return !visto || Date.now() - new Date(visto.replace(' ', 'T')).getTime() > SINAL_PERDIDO_MS
}

const coordenadaValida = (lat, lng) =>
  lat != null &&
  lng != null &&
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180

let mapa
let camada
let observador
let temporizador
let primeiroEnquadre = true

function iniciarMapa() {
  if (mapa || !elementoMapa.value) return
  mapa = L.map(elementoMapa.value, { scrollWheelZoom: true }).setView([-15.78, -47.93], 5)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  })
    .on('tileerror', () => {
      falhaMapa.value = true
    })
    .addTo(mapa)
  camada = L.layerGroup().addTo(mapa)
  observador = new ResizeObserver(() => mapa?.invalidateSize({ pan: false }))
  observador.observe(elementoMapa.value)
}

function marcador(lat, lng, cor, texto, raio = 8) {
  const nome = document.createElement('span')
  nome.textContent = texto
  return L.circleMarker([Number(lat), Number(lng)], {
    radius: raio,
    color: '#ffffff',
    weight: 3,
    fillOpacity: 1,
    fillColor: cor,
  }).bindTooltip(nome)
}

function desenhar(enquadrar = false) {
  if (!mapa) return
  camada.clearLayers()
  const pontos = []
  corridas.value.forEach((c) => {
    const destaque = selecionada.value === c.id
    const trajeto = (c.corrida_destinos || [])
      .filter((d) => coordenadaValida(d.latitude, d.longitude))
      .sort((a, b) => a.ordem - b.ordem)
    if (trajeto.length > 1) {
      L.polyline(
        trajeto.map((d) => [Number(d.latitude), Number(d.longitude)]),
        {
          color: '#1976d2',
          weight: destaque ? 4 : 2,
          dashArray: '6 8',
          opacity: destaque ? 0.9 : 0.5,
        },
      ).addTo(camada)
    }
    trajeto.forEach((d) => {
      const cor = d.tipo === 'origem' ? '#21ba45' : d.tipo === 'destino' ? '#f44336' : '#f59e0b'
      marcador(d.latitude, d.longitude, cor, `#${c.id} ${d.tipo}: ${d.endereco || ''}`, 6).addTo(
        camada,
      )
      pontos.push([Number(d.latitude), Number(d.longitude)])
    })
    const p = c.posicao_motorista
    if (p && coordenadaValida(p.latitude, p.longitude)) {
      marcador(
        p.latitude,
        p.longitude,
        semSinal(c) ? '#9e9e9e' : '#1976d2',
        `#${c.id} ${c.motorista?.name || 'Motorista'} · ${etapa(c.status_corrida).rotulo}`,
        destaque ? 12 : 9,
      ).addTo(camada)
      pontos.push([Number(p.latitude), Number(p.longitude)])
    }
  })
  if (enquadrar && pontos.length) {
    mapa.fitBounds(pontos, { padding: [32, 32], maxZoom: 15, animate: false })
  }
}

function selecionar(corrida) {
  selecionada.value = corrida.id
  const p = corrida.posicao_motorista
  if (mapa && p && coordenadaValida(p.latitude, p.longitude)) {
    mapa.setView([Number(p.latitude), Number(p.longitude)], 15)
  }
}

async function carregar() {
  try {
    const { data } = await api.get('/corridas/em-andamento')
    corridas.value = data.corridas
    erro.value = ''
    if (selecionada.value && !corridas.value.some((c) => c.id === selecionada.value)) {
      selecionada.value = null
    }
  } catch (e) {
    erro.value = e.response?.data?.message || 'Não foi possível carregar as corridas.'
  } finally {
    carregando.value = false
  }
}

watch([corridas, selecionada], () => {
  desenhar(primeiroEnquadre && corridas.value.length > 0)
  if (corridas.value.length) primeiroEnquadre = false
})

onMounted(async () => {
  await nextTick()
  iniciarMapa()
  await carregar()
  temporizador = setInterval(carregar, 5000)
})

onBeforeUnmount(() => {
  clearInterval(temporizador)
  observador?.disconnect()
  mapa?.remove()
  mapa = null
})
</script>

<style scoped>
.mapa {
  height: 70vh;
  min-height: 380px;
  width: 100%;
  z-index: 0;
}
</style>
