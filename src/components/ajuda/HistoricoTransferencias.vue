<template>
  <section class="q-pa-md historico-transferencias" aria-label="Histórico de transferências">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-subtitle1 text-weight-medium">Histórico de transferências</div>
        <div class="text-caption text-grey-7">Da alteração mais recente para a mais antiga.</div>
      </div>
      <q-btn
        flat
        round
        dense
        icon="refresh"
        aria-label="Atualizar histórico"
        :loading="carregando"
        @click="carregar"
      />
    </div>
    <q-banner v-if="erro" rounded class="bg-red-1 text-negative" role="alert"
      >{{ erro
      }}<template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template
    ></q-banner>
    <div v-if="carregando && !registros.length" class="text-center q-pa-lg">
      <q-spinner color="primary" size="32px" />
    </div>
    <q-timeline v-else-if="registros.length" color="primary" layout="dense">
      <q-timeline-entry
        v-for="item in registros"
        :key="item.id"
        :title="tipos[item.type] || 'Alteração de responsável'"
        :subtitle="horarioTicket(item.created_at)"
        :icon="item.type === 'takeover_by_manager' ? 'supervisor_account' : 'swap_horiz'"
      >
        <div class="transferencia-registro bg-grey-1 rounded-borders q-pa-md">
          <div class="text-body2">
            <span class="text-grey-7">Realizada por:</span> {{ item.transferred_by.name }}
          </div>
          <div class="row items-center q-gutter-xs q-mt-xs">
            <q-badge color="grey-3" text-color="grey-9">{{
              item.from_user?.name || 'Fila de entrada'
            }}</q-badge
            ><q-icon name="arrow_forward" color="grey-6" /><q-badge
              color="blue-1"
              text-color="primary"
              >{{ item.to_user?.name || 'Fila de entrada' }}</q-badge
            >
          </div>
          <div v-if="item.note" class="observacao text-body2 q-mt-sm">{{ item.note }}</div>
        </div>
      </q-timeline-entry>
    </q-timeline>
    <div v-else-if="!erro" class="text-center text-grey-7 q-pa-lg">
      Nenhuma transferência registrada neste atendimento.
    </div>
    <div v-if="ultimaPagina > 1" class="flex flex-center q-mt-md">
      <q-pagination
        v-model="pagina"
        :max="ultimaPagina"
        :max-pages="5"
        direction-links
        :disable="carregando"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { api } from 'boot/axios'
import { horarioTicket, erroTicket } from 'src/utils/tickets'
const props = defineProps({
  ticketId: { type: Number, required: true },
  atualizacao: { type: Number, default: 0 },
})
const tipos = {
  manual_transfer: 'Transferência de atendimento',
  takeover_by_manager: 'Atendimento assumido pela gestão',
  queue_distribution: 'Atribuição de atendimento',
  queue_return: 'Retorno à fila de entrada',
}
const registros = ref([])
const pagina = ref(1)
const ultimaPagina = ref(1)
const carregando = ref(false)
const erro = ref('')
let controller = null
let versao = 0
async function carregar() {
  controller?.abort()
  controller = new AbortController()
  const epoch = ++versao
  carregando.value = true
  erro.value = ''
  try {
    const { data } = await api.get(`/ajuda/tickets/${props.ticketId}/transferencias`, {
      params: { page: pagina.value },
      signal: controller.signal,
    })
    if (epoch !== versao) return
    registros.value = data.data
    ultimaPagina.value = data.meta.last_page
  } catch (e) {
    if (epoch === versao && e.code !== 'ERR_CANCELED') {
      registros.value = []
      erro.value = erroTicket(e)
    }
  } finally {
    if (epoch === versao) carregando.value = false
  }
}
watch(
  () => [props.ticketId, props.atualizacao],
  () => {
    registros.value = []
    if (pagina.value !== 1) pagina.value = 1
    else void carregar()
  },
  { immediate: true },
)
watch(pagina, () => {
  void carregar()
})
onBeforeUnmount(() => {
  versao++
  controller?.abort()
})
</script>

<style scoped>
.observacao {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.transferencia-registro .q-badge {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
