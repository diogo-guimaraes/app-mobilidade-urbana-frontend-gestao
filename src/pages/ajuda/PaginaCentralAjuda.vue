<template>
  <q-page class="q-pa-md central-ajuda">
    <div
      v-show="!$q.screen.lt.md || !selecionado"
      class="row items-center justify-between q-mb-md q-gutter-sm"
    >
      <div class="row items-center no-wrap">
        <q-avatar color="blue-1" text-color="primary" icon="support_agent" class="q-mr-md" />
        <div>
          <div class="text-h5 text-weight-medium">Central de ajuda</div>
          <div class="text-caption text-grey-7">
            Acompanhe os tickets e converse com passageiros e motoristas.
          </div>
        </div>
      </div>
      <q-card flat bordered class="conta-teste q-pa-sm" aria-label="Conta logada">
        <div class="row items-center no-wrap q-gutter-sm">
          <q-avatar color="blue-1" text-color="primary" icon="account_circle" size="38px" />
          <div>
            <div class="text-weight-medium">{{ auth.user?.name }}</div>
            <div class="text-caption text-grey-7">{{ auth.user?.email }}</div>
            <q-badge color="blue-1" text-color="primary" :label="auth.user?.perfil_acesso_nome" />
          </div>
        </div>
      </q-card>
    </div>
    <div class="row q-col-gutter-md">
      <div v-show="!$q.screen.lt.md || !selecionado" class="col-12 col-md-4 col-lg-3">
        <q-card flat bordered class="lista-tickets column no-wrap">
          <q-card-section class="q-pa-md">
            <div class="row items-center justify-between q-mb-sm">
              <span class="text-subtitle1 text-weight-medium">Atendimentos</span
              ><q-badge color="blue-1" text-color="primary"
                >{{ total }} {{ total === 1 ? 'ticket' : 'tickets' }}</q-badge
              ><q-btn
                flat
                round
                dense
                icon="refresh"
                aria-label="Atualizar tickets"
                :loading="carregando"
                @click="carregar()"
              />
            </div>
            <q-input
              v-model="search"
              outlined
              dense
              debounce="350"
              placeholder="Nome, CPF ou protocolo"
              clearable
              ><template #prepend><q-icon name="search" /></template
            ></q-input>
            <q-select
              v-model="fila"
              outlined
              dense
              emit-value
              map-options
              :options="filas"
              label="Fila de atendimento"
              class="q-mt-sm"
            />
            <div class="row q-col-gutter-sm q-mt-sm">
              <q-select
                v-model="status"
                class="col-7"
                outlined
                dense
                emit-value
                map-options
                clearable
                :options="statusTickets"
                label="Status"
              />
              <q-select
                v-model="persona"
                class="col-5"
                outlined
                dense
                emit-value
                map-options
                clearable
                :options="personas"
                label="Perfil"
              />
            </div>
          </q-card-section>
          <q-separator />
          <q-banner v-if="erro" dense class="bg-red-1 text-negative" role="alert">{{
            erro
          }}</q-banner>
          <q-list separator class="col lista-scroll">
            <q-item
              v-for="item in tickets"
              :key="item.id"
              clickable
              :active="selecionado === item.id"
              active-class="bg-blue-1"
              class="q-py-md"
              @click="selecionado = item.id"
            >
              <q-item-section>
                <div class="row justify-between items-center q-mb-xs">
                  <div class="row items-center no-wrap q-gutter-xs">
                    <span class="text-caption text-primary text-weight-bold">{{
                      item.protocolo
                    }}</span>
                    <q-badge
                      v-if="item.mensagens_nao_lidas > 0"
                      rounded
                      color="negative"
                      :label="item.mensagens_nao_lidas > 99 ? '99+' : item.mensagens_nao_lidas"
                      :aria-label="`${item.mensagens_nao_lidas} mensagens não lidas`"
                    />
                  </div>
                  <q-badge
                    :color="statusTicket(item.status).color"
                    :label="statusTicket(item.status).label"
                  />
                </div>
                <q-item-label class="text-weight-medium">{{
                  item.solicitante?.name || 'Usuário'
                }}</q-item-label>
                <q-item-label caption
                  >{{ item.solicitante_tipo === 'motorista' ? 'Motorista' : 'Passageiro' }} ·
                  {{ motivoTicket(item.motivo) }}</q-item-label
                >
                <q-item-label caption class="q-mt-sm">{{
                  horarioTicket(item.ultima_mensagem_em || item.created_at)
                }}</q-item-label>
                <q-item-label caption class="q-mt-xs"
                  ><q-icon
                    :name="item.gestor_responsavel ? 'person_outline' : 'move_to_inbox'"
                    class="q-mr-xs"
                  />{{ item.gestor_responsavel?.name || 'Fila de entrada' }}</q-item-label
                >
                <q-item-label
                  v-if="item.status === 'waiting' && item.fila"
                  caption
                  class="text-orange-9 q-mt-xs"
                >
                  <template>Próximo da fila · aguardando início</template>
                </q-item-label>
              </q-item-section>
            </q-item>
            <div
              v-if="!carregando && !tickets.length && !erro"
              class="q-pa-xl text-center text-grey-7"
            >
              <q-icon name="inbox" size="40px" />
              <p class="q-mt-sm">Nenhum ticket encontrado.</p>
            </div>
          </q-list>
          <q-separator />
          <div class="flex flex-center q-pa-sm">
            <q-pagination
              v-model="page"
              :max="ultimaPagina"
              :max-pages="5"
              direction-links
              boundary-numbers
              :disable="carregando"
            />
          </div>
          <q-inner-loading :showing="carregando" />
        </q-card>
      </div>
      <div v-show="!$q.screen.lt.md || selecionado" class="col-12 col-md-8 col-lg-9">
        <ChatTicket
          :ticket-id="selecionado"
          @atualizado="agendarAtualizacao"
          @voltar="selecionado = null"
          @transferido="transferido"
          @acesso-perdido="acessoPerdido"
          @finalizado="finalizado"
          @lido="aplicarLeitura"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { getEcho, conectadoChat } from 'src/services/echo'
import { useAtualizacaoSemConexao } from 'src/composables/useAtualizacaoSemConexao'
import ChatTicket from 'src/components/ajuda/ChatTicket.vue'
import {
  statusTickets,
  statusTicket,
  motivoTicket,
  horarioTicket,
  erroTicket,
  gestaoGlobalTickets,
  visualizaEntradaTickets,
  podeAcessarResponsavelTicket,
} from 'src/utils/tickets'

const personas = [
  { value: 'passageiro', label: 'Passageiro' },
  { value: 'motorista', label: 'Motorista' },
]
const tickets = ref([])
const auth = useAuthStore()
const $q = useQuasar()
const global = computed(() => gestaoGlobalTickets(auth.user))
const entrada = computed(() => visualizaEntradaTickets(auth.user))
const fila = ref('todos')
const filas = computed(() => [
  {
    value: 'todos',
    label: global.value
      ? 'Todos os atendimentos'
      : entrada.value
        ? 'Entrada e meus atendimentos'
        : 'Meus atendimentos',
  },
  ...(entrada.value ? [{ value: 'entrada', label: 'Aguardando distribuição' }] : []),
  { value: 'meus', label: 'Atribuídos a mim' },
])
const selecionado = ref(null)
const search = ref('')
const status = ref(null)
const persona = ref(null)
const page = ref(1)
const total = ref(0)
const ultimaPagina = ref(1)
const carregando = ref(false)
const erro = ref('')
const canalAutorizado = ref(false)
const atualizacaoHabilitada = ref(false)
let controller = null
let version = 0
let reloadTimer = null
let echo = null
let emRequisicao = false
let atualizacaoPendente = false
let canais = []
const autorizados = new Set()
const leituras = new Map()

useAtualizacaoSemConexao(canalAutorizado, atualizacaoHabilitada, agendarAtualizacao)

async function carregar(silencioso = false) {
  if (silencioso && emRequisicao) {
    atualizacaoPendente = true
    return
  }
  controller?.abort()
  controller = new AbortController()
  const epoch = ++version
  emRequisicao = true
  carregando.value = !silencioso
  erro.value = ''
  try {
    const { data } = await api.get('/ajuda/tickets', {
      params: {
        search: search.value || undefined,
        status: status.value || undefined,
        solicitante_tipo: persona.value || undefined,
        page: page.value,
        fila: fila.value,
      },
      signal: controller.signal,
    })
    if (epoch !== version) return
    tickets.value = data.data
    tickets.value.forEach((ticket) => {
      if ((leituras.get(ticket.id) || 0) >= (ticket.ultima_mensagem_cliente_id || 0))
        ticket.mensagens_nao_lidas = 0
    })
    total.value = data.meta.total
    ultimaPagina.value = Math.max(1, data.meta.last_page)
    if (page.value > ultimaPagina.value) page.value = ultimaPagina.value
  } catch (error) {
    if (epoch === version && error.code !== 'ERR_CANCELED') {
      erro.value = erroTicket(error)
      if (error.response?.status === 403) atualizacaoHabilitada.value = false
    }
  } finally {
    if (epoch === version) {
      carregando.value = false
      emRequisicao = false
      if (atualizacaoPendente) {
        atualizacaoPendente = false
        agendarAtualizacao()
      }
    }
  }
}
function agendarAtualizacao() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    void carregar(true)
  }, 250)
}
function finalizado(ticket) {
  if (!global.value || fila.value === 'meus') retirar(ticket.id)
  agendarAtualizacao()
}
function aplicarLeitura(evento) {
  leituras.set(
    evento.ticket_id,
    Math.max(leituras.get(evento.ticket_id) || 0, evento.ultima_mensagem_id),
  )
  const item = tickets.value.find((ticket) => ticket.id === evento.ticket_id)
  if (!item) return
  if ((item.ultima_mensagem_cliente_id || 0) <= evento.ultima_mensagem_id)
    item.mensagens_nao_lidas = 0
  else agendarAtualizacao()
}
function retirar(id) {
  const tinha = tickets.value.some((ticket) => ticket.id === id)
  tickets.value = tickets.value.filter((ticket) => ticket.id !== id)
  if (tinha) total.value = Math.max(0, total.value - 1)
  if (selecionado.value === id) selecionado.value = null
}
function transferido(ticket) {
  if (!podeAcessarResponsavelTicket(auth.user, ticket.gestor_responsavel?.id)) retirar(ticket.id)
  agendarAtualizacao()
}
function acessoPerdido() {
  if (selecionado.value !== null) {
    retirar(selecionado.value)
    $q.notify({ type: 'info', message: 'O atendimento não está mais disponível na sua fila.' })
  }
  agendarAtualizacao()
}
function aoTransferir(evento) {
  if (!podeAcessarResponsavelTicket(auth.user, evento.to_user_id)) {
    const aberto = selecionado.value === evento.ticket_id
    retirar(evento.ticket_id)
    if (aberto)
      $q.notify({ type: 'info', message: 'O atendimento foi encaminhado para outro operador.' })
  }
  agendarAtualizacao()
}
function assinarCanais() {
  canais.forEach((nome) => echo?.leave(nome))
  autorizados.clear()
  canalAutorizado.value = false
  echo = getEcho()
  canais = global.value
    ? ['ajuda.suporte', `ajuda.operador.${auth.user?.id}`]
    : [...(entrada.value ? ['ajuda.entrada'] : []), `ajuda.operador.${auth.user?.id}`]
  for (const nome of canais) {
    echo
      ?.private(nome)
      .listen('.ticket.atualizado', agendarAtualizacao)
      .listen('.ticket.transferido', aoTransferir)
      .listen('.ticket.lido', aplicarLeitura)
      .subscribed(() => {
        autorizados.add(nome)
        canalAutorizado.value = autorizados.size === canais.length
        agendarAtualizacao()
      })
      .error(() => {
        autorizados.delete(nome)
        canalAutorizado.value = false
      })
  }
}
watch(conectadoChat, (conectado) => {
  if (!conectado) autorizados.clear()
})
watch(
  () => [auth.user?.id, global.value, entrada.value],
  () => {
    if (!entrada.value && fila.value === 'entrada') fila.value = 'todos'
    assinarCanais()
    agendarAtualizacao()
  },
)
watch([search, status, persona, fila], () => {
  if (page.value !== 1) page.value = 1
  else void carregar()
})
watch(page, () => {
  void carregar()
})
onMounted(() => {
  atualizacaoHabilitada.value = true
  void carregar()
  assinarCanais()
})
onBeforeUnmount(() => {
  version++
  controller?.abort()
  clearTimeout(reloadTimer)
  canais.forEach((nome) => echo?.leave(nome))
})
</script>

<style scoped>
.lista-tickets {
  height: calc(100dvh - 174px);
  min-height: 420px;
}
.lista-scroll {
  overflow-y: auto;
}
@media (max-width: 599px) {
  .central-ajuda {
    padding: 12px;
  }
  .lista-tickets {
    height: calc(100dvh - 230px);
  }
}
</style>
