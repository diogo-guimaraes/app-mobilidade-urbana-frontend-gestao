<template>
  <q-dialog v-model="model" :persistent="salvando">
    <q-card class="compartilhar-veiculo-dialog" style="width: 700px; max-width: 95vw">
      <q-toolbar>
        <q-toolbar-title>
          <div class="text-subtitle1 text-weight-bold">
            {{ somenteVinculados ? 'Motoristas do veículo' : 'Compartilhar veículo' }}
          </div>
          <div class="text-caption text-grey-7">{{ veiculo?.placa }} — {{ veiculo?.modelo }}</div>
        </q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar lista de motoristas"
          :disable="salvando"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />
      <q-card-section>
        <q-banner v-if="!somenteVinculados" class="bg-blue-1 q-mb-md" rounded>
          {{ totalVinculados }} de {{ limiteMotoristas }} motoristas vinculados. Apenas um motorista
          pode trabalhar com este veículo por vez.
        </q-banner>
        <q-banner v-if="erro" rounded class="bg-red-1 text-negative q-mb-md" role="alert">
          Não foi possível carregar os motoristas.
          <template #action>
            <q-btn flat label="Tentar novamente" @click="carregar()" />
          </template>
        </q-banner>
        <q-table
          :rows="usuarios"
          :columns="columns"
          row-key="id"
          v-model:pagination="pagination"
          v-model:selected="selecionados"
          :selection="somenteVinculados ? 'none' : 'single'"
          :selected-rows-label="() => 'Motorista selecionado'"
          :rows-per-page-options="[5, 10, 15, 25]"
          :loading="loading || salvando"
          loading-label="Carregando motoristas…"
          :no-data-label="
            somenteVinculados
              ? 'Nenhum motorista vinculado a este veículo.'
              : 'Nenhum motorista encontrado.'
          "
          @request="carregar"
        >
          <template #top>
            <q-input
              v-model="search"
              class="full-width"
              filled
              dense
              debounce="300"
              :disable="salvando"
              placeholder="Pesquisar por nome ou CPF"
              @update:model-value="pesquisar"
            >
              <template v-if="search" #append>
                <q-icon name="close" class="cursor-pointer" @click="limparPesquisa" />
              </template>
            </q-input>
          </template>
          <template #body-selection="props">
            <q-checkbox
              v-model="props.selected"
              :disable="!!props.row.vinculado || lotado || loading || salvando"
              :aria-label="`Selecionar ${props.row.user.name}`"
            />
          </template>
          <template #body-cell-usuario="props">
            <q-td :props="props">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-avatar v-if="props.row.foto"><img :src="props.row.foto" /></q-avatar>
                  <q-avatar v-else color="primary" text-color="white">
                    {{ props.row.user.name?.charAt(0) }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ props.row.user.name }}</q-item-label>
                  <q-item-label caption>CPF: {{ formatarCpf(props.row.user.cpf) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-td>
          </template>
          <template #body-cell-vinculo="props">
            <q-td :props="props">
              <q-badge v-if="props.row.vinculado" color="green" label="Vinculado" />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn
          flat
          :label="somenteVinculados ? 'Fechar' : 'Cancelar'"
          :disable="salvando"
          v-close-popup
        />
        <q-btn
          v-if="!somenteVinculados"
          color="primary"
          label="Vincular motorista"
          :loading="salvando"
          :disable="loading || lotado || !selecionados.length || !!selecionados[0]?.vinculado"
          @click="vincular"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'

const props = defineProps({ modelValue: Boolean, veiculo: Object, somenteVinculados: Boolean })
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({
  get: () => props.modelValue,
  set: (valor) => emit('update:modelValue', valor),
})
const usuarios = ref([])
const selecionados = ref([])
const salvando = ref(false)
const search = ref('')
const loading = ref(false)
const erro = ref(false)
const totalVinculados = ref(0)
const limiteMotoristas = ref(3)
const lotado = computed(() => totalVinculados.value >= limiteMotoristas.value)
const pagination = ref({ page: 1, rowsPerPage: 15, rowsNumber: 0 })
const columns = computed(() =>
  props.somenteVinculados
    ? [{ name: 'usuario', label: 'Motorista', align: 'left' }]
    : [
        { name: 'usuario', label: 'Motorista', align: 'left' },
        { name: 'vinculo', label: 'Vínculo com este veículo', align: 'center' },
      ],
)
let consulta = null

const formatarCpf = (cpf) =>
  String(cpf || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')

async function carregar(evento) {
  consulta?.abort()
  if (!model.value || !props.veiculo?.id) return
  const atual = new AbortController()
  consulta = atual
  loading.value = true
  erro.value = false
  selecionados.value = []
  const { page, rowsPerPage } = evento?.pagination || pagination.value
  try {
    const { data } = await api.get(`/veiculos/${props.veiculo.id}/usuarios`, {
      params: {
        search: search.value,
        page,
        rowsPerPage,
        somente_vinculados: props.somenteVinculados ? 1 : undefined,
      },
      signal: atual.signal,
    })
    if (atual.signal.aborted) return
    usuarios.value = data.data
    totalVinculados.value = data.total_vinculados
    limiteMotoristas.value = data.limite_motoristas
    pagination.value = {
      page: data.current_page,
      rowsPerPage: data.per_page,
      rowsNumber: data.total,
    }
  } catch {
    if (atual.signal.aborted) return
    usuarios.value = []
    pagination.value.rowsNumber = 0
    erro.value = true
  } finally {
    if (consulta === atual && !atual.signal.aborted) loading.value = false
  }
}

function pesquisar() {
  pagination.value.page = 1
  carregar()
}

function limparPesquisa() {
  search.value = ''
  pesquisar()
}

async function vincular() {
  if (props.somenteVinculados) return
  const motorista = selecionados.value[0]
  if (!motorista || motorista.vinculado || lotado.value || salvando.value || loading.value) return
  salvando.value = true
  try {
    await api.post('/adicionar-veiculo-ao-motorista', {
      motorista_id: motorista.id,
      veiculo_id: props.veiculo.id,
    })
    $q.notify({ type: 'positive', message: 'Motorista vinculado ao veículo.' })
    emit('updated')
    await carregar()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível vincular o motorista.',
    })
  } finally {
    salvando.value = false
  }
}

watch([model, () => props.veiculo?.id, () => props.somenteVinculados], () => {
  consulta?.abort()
  usuarios.value = []
  totalVinculados.value = 0
  limiteMotoristas.value = 3
  selecionados.value = []
  search.value = ''
  erro.value = false
  loading.value = false
  pagination.value = { page: 1, rowsPerPage: 15, rowsNumber: 0 }
  if (model.value) carregar()
})
onBeforeUnmount(() => consulta?.abort())
</script>
