<template>
  <q-dialog v-model="aberto" :persistent="salvando">
    <q-card class="transferir-ticket">
      <q-card-section class="row items-center q-gutter-sm">
        <q-avatar color="blue-1" text-color="primary" icon="assignment_ind" />
        <div class="col">
          <div class="text-h6">
            {{ ticket.gestor_responsavel ? 'Transferir atendimento' : 'Designar atendimento' }}
          </div>
          <div class="text-caption text-grey-7">{{ ticket.protocolo }}</div>
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar transferência"
          :disable="salvando"
          @click="aberto = false"
        />
      </q-card-section>
      <q-separator />
      <q-form @submit="salvar">
        <q-card-section class="q-gutter-md">
          <div class="text-body2 text-grey-8">
            Selecione o operador adequado para continuar este atendimento.
          </div>
          <q-select
            v-model="destino"
            outlined
            use-input
            input-debounce="300"
            :options="operadores"
            option-label="name"
            label="Novo responsável"
            :loading="buscando"
            :disable="salvando"
            :rules="[(v) => !!v || 'Selecione um operador']"
            @filter="buscar"
            @virtual-scroll="rolar"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar
                  ><q-avatar color="blue-1" text-color="primary">{{
                    scope.opt.name.charAt(0)
                  }}</q-avatar></q-item-section
                >
                <q-item-section
                  ><q-item-label>{{ scope.opt.name }}</q-item-label
                  ><q-item-label caption>{{
                    scope.opt.perfil_acesso_nome
                  }}</q-item-label></q-item-section
                >
              </q-item>
            </template>
            <template #no-option
              ><q-item
                ><q-item-section class="text-grey"
                  >Nenhum operador encontrado.</q-item-section
                ></q-item
              ></template
            >
          </q-select>
          <q-input
            v-model="nota"
            outlined
            type="textarea"
            label="Observação (opcional)"
            hint="Disponível no histórico para Gestão e Admin."
            maxlength="1000"
            counter
            :disable="salvando"
          />
          <q-banner v-if="erro" rounded dense class="bg-red-1 text-negative" role="alert">{{
            erro
          }}</q-banner>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-pa-md q-gutter-sm">
          <q-btn flat label="Cancelar" :disable="salvando" @click="aberto = false" />
          <q-btn
            color="primary"
            icon="assignment_ind"
            :label="ticket.gestor_responsavel ? 'Confirmar transferência' : 'Designar operador'"
            type="submit"
            :loading="salvando"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { erroTicket } from 'src/utils/tickets'

const aberto = defineModel({ type: Boolean, default: false })
const props = defineProps({ ticket: { type: Object, required: true } })
const emit = defineEmits(['transferido'])
const $q = useQuasar()
const destino = ref(null)
const nota = ref('')
const erro = ref('')
const operadores = ref([])
const buscando = ref(false)
const salvando = ref(false)
let controller = null
let envio = null
let versao = 0
let busca = ''
let pagina = 0
let ultima = 1

function cancelar() {
  versao++
  controller?.abort()
  envio?.abort()
  buscando.value = false
}
watch([aberto, () => props.ticket.id], () => {
  cancelar()
  destino.value = null
  nota.value = ''
  erro.value = ''
  operadores.value = []
  pagina = 0
  ultima = 1
})
async function carregar(texto, proxima, update = (fn) => fn(), abort = () => {}) {
  controller?.abort()
  controller = new AbortController()
  const epoch = ++versao
  buscando.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/ajuda/operadores', {
      params: {
        search: texto,
        page: proxima,
        exclude_user_id: props.ticket.gestor_responsavel?.id,
      },
      signal: controller.signal,
    })
    if (epoch !== versao) return
    update(() => {
      operadores.value = proxima === 1 ? data.data : [...operadores.value, ...data.data]
      busca = texto
      pagina = data.current_page
      ultima = data.last_page
    })
  } catch (e) {
    if (epoch === versao) {
      abort()
      if (e.code !== 'ERR_CANCELED') erro.value = erroTicket(e)
    }
  } finally {
    if (epoch === versao) buscando.value = false
  }
}
function buscar(texto, update, abort) {
  void carregar(texto, 1, update, abort)
}
function rolar({ to }) {
  if (!buscando.value && to >= operadores.value.length - 1 && pagina < ultima)
    void carregar(busca, pagina + 1)
}
async function salvar() {
  if (salvando.value || !destino.value) return
  const id = props.ticket.id
  salvando.value = true
  erro.value = ''
  envio = new AbortController()
  try {
    const { data } = await api.post(
      `/ajuda/tickets/${id}/transfer`,
      { to_user_id: destino.value.id, note: nota.value.trim() || null },
      { signal: envio.signal },
    )
    if (props.ticket.id !== id || !aberto.value) return
    $q.notify({ type: 'positive', message: `Atendimento designado para ${destino.value.name}.` })
    aberto.value = false
    emit('transferido', data.data)
  } catch (e) {
    if (e.code !== 'ERR_CANCELED') erro.value = erroTicket(e)
  } finally {
    salvando.value = false
  }
}
onBeforeUnmount(cancelar)
</script>

<style scoped>
.transferir-ticket {
  width: 560px;
  max-width: 95vw;
}
</style>
