<template>
  <q-page class="q-pa-md">
    <CompartilharVeiculo
      v-model="listaMotoristas"
      :veiculo="veiculoSelecionado"
      somente-vinculados
    />
    <q-card>
      <q-banner v-if="erro" class="bg-red-1 text-negative" role="alert">
        Não foi possível carregar os veículos.
        <template #action>
          <q-btn flat label="Tentar novamente" @click="carregar()" />
        </template>
      </q-banner>
      <q-table
        :rows="veiculos"
        :columns="columns"
        row-key="id"
        v-model:pagination="pagination"
        :rows-per-page-options="[5, 10, 15, 25, 50]"
        :loading="loading"
        loading-label="Carregando veículos…"
        no-data-label="Nenhum veículo encontrado."
        @request="carregar"
      >
        <template #top>
          <q-input
            v-model="search"
            class="full-width"
            filled
            dense
            debounce="300"
            placeholder="Pesquisar"
            @update:model-value="pesquisar"
          >
            <template v-if="search" #append>
              <q-icon name="close" class="cursor-pointer" @click="limparPesquisa" />
            </template>
          </q-input>
        </template>
        <template #body-cell-veiculo="props">
          <q-td :props="props">
            <q-item>
              <q-item-section avatar>
                <q-avatar rounded color="primary" text-color="white" icon="directions_car" />
                <q-badge
                  v-if="props.row.marca"
                  class="q-mt-sm"
                  :label="props.row.marca"
                  color="grey-7"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ props.row.modelo }}</q-item-label>
                <q-item-label class="estilo-coluna">
                  <div v-if="props.row.renavam">{{ props.row.renavam }}</div>
                  <div v-if="props.row.placa">PLACA: {{ props.row.placa }}</div>
                  <div v-if="props.row.cor">COR: {{ props.row.cor }}</div>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-td>
        </template>
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="coresStatus[props.row.status] || 'grey'">
              {{ formatarStatus(props.row.status) }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-acoes="props">
          <q-td :props="props">
            <q-btn
              flat
              dense
              icon="groups_2"
              aria-label="Motoristas vinculados ao veículo"
              @click="abrirMotoristas(props.row)"
            >
              <q-tooltip>Motoristas vinculados</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import { formatarStatus } from 'src/utils/status'
import CompartilharVeiculo from 'src/components/motorista/CompartilharVeiculo.vue'

const veiculos = ref([])
const search = ref('')
const loading = ref(false)
const erro = ref(false)
const listaMotoristas = ref(false)
const veiculoSelecionado = ref(null)
const pagination = ref({ page: 1, rowsPerPage: 15, rowsNumber: 0 })
const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'veiculo', label: 'Veículo', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]
const coresStatus = {
  em_analise: 'orange',
  aprovado: 'green',
  reprovado: 'red',
  ativo: 'green',
  inativo: 'orange',
  pendente: 'warning',
  bloqueado: 'red',
}
let consulta = null

function abrirMotoristas(veiculo) {
  veiculoSelecionado.value = veiculo
  listaMotoristas.value = true
}

async function carregar(evento) {
  consulta?.abort()
  const atual = new AbortController()
  consulta = atual
  loading.value = true
  erro.value = false
  const { page, rowsPerPage } = evento?.pagination || pagination.value
  try {
    const { data } = await api.get('/veiculos', {
      params: { search: search.value, page, rowsPerPage },
      signal: atual.signal,
    })
    if (atual.signal.aborted) return
    veiculos.value = data.data
    pagination.value = {
      page: data.current_page,
      rowsPerPage: data.per_page,
      rowsNumber: data.total,
    }
  } catch {
    if (atual.signal.aborted) return
    veiculos.value = []
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

onMounted(() => carregar())
onBeforeUnmount(() => consulta?.abort())
</script>

<style scoped>
.estilo-coluna {
  max-width: 200px;
  white-space: normal;
  margin-top: 4px;
}
</style>
