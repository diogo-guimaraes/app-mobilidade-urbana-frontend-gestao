<template>
  <div class="mapa-corrida">
    <template v-if="pontos.length">
      <div class="row items-center justify-between q-mb-sm">
        <span class="text-subtitle2">Mapa da corrida</span>
        <q-btn
          flat
          round
          dense
          icon="center_focus_strong"
          aria-label="Centralizar mapa da corrida"
          @click="centralizar"
        />
      </div>
      <div ref="elemento" class="mapa" role="region" aria-label="Mapa dos pontos da corrida" />
      <div v-if="falhaMapa" class="text-caption text-orange-9 q-mt-xs">
        O mapa de fundo está indisponível. Os pontos cadastrados continuam visíveis.
      </div>
      <div class="text-caption text-grey-7 q-mt-sm">
        Ligação ilustrativa entre os pontos cadastrados.
      </div>
    </template>
    <div v-else class="text-caption text-grey-7 q-pa-sm">
      Esta corrida não possui coordenadas registradas para o mapa.
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({ destinos: { type: Array, default: () => [] } })
const elemento = ref(null)
const falhaMapa = ref(false)
const pontos = computed(() =>
  props.destinos.filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      p.latitude !== '' &&
      p.longitude !== '' &&
      Number.isFinite(Number(p.latitude)) &&
      Number.isFinite(Number(p.longitude)) &&
      Math.abs(Number(p.latitude)) <= 90 &&
      Math.abs(Number(p.longitude)) <= 180,
  ),
)
let mapa
let camada
let observador
let versao = 0

function centralizar() {
  if (!mapa || !pontos.value.length) return
  mapa.fitBounds(
    pontos.value.map((p) => [Number(p.latitude), Number(p.longitude)]),
    { padding: [28, 28], maxZoom: 15, animate: false },
  )
}
function limpar() {
  observador?.disconnect()
  mapa?.remove()
  mapa = null
  camada = null
}
async function desenhar() {
  const epoch = ++versao
  await nextTick()
  if (epoch !== versao) return
  if (!pontos.value.length || !elemento.value) {
    limpar()
    return
  }
  if (!mapa) {
    falhaMapa.value = false
    mapa = L.map(elemento.value, { scrollWheelZoom: false, zoomControl: false })
    L.control.zoom({ zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(mapa)
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
    observador.observe(elemento.value)
  }
  camada.clearLayers()
  L.polyline(
    pontos.value.map((p) => [Number(p.latitude), Number(p.longitude)]),
    {
      color: '#1976d2',
      weight: 3,
      dashArray: '6 8',
      opacity: 0.7,
    },
  ).addTo(camada)
  pontos.value.forEach((p, indice) => {
    const tipo = p.tipo === 'origem' ? 'Origem' : p.tipo === 'destino' ? 'Destino' : 'Parada'
    const nome = document.createElement('span')
    nome.textContent = `${tipo}: ${p.endereco || p.nome_local || `Ponto ${indice + 1}`}`
    L.circleMarker([Number(p.latitude), Number(p.longitude)], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillOpacity: 1,
      fillColor: p.tipo === 'origem' ? '#21ba45' : p.tipo === 'destino' ? '#f44336' : '#f59e0b',
    })
      .bindTooltip(nome)
      .addTo(camada)
  })
  centralizar()
}
watch(
  () => JSON.stringify(pontos.value.map((p) => [p.tipo, p.endereco, p.latitude, p.longitude])),
  desenhar,
  { immediate: true },
)
onBeforeUnmount(() => {
  versao++
  limpar()
})
</script>

<style scoped>
.mapa {
  height: 250px;
  width: 100%;
  border-radius: 10px;
  z-index: 0;
}
.mapa-corrida {
  min-width: 0;
}
</style>
