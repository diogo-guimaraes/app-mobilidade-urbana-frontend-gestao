<template>
  <q-page class="q-pa-md">
    <VisualizarRegistro v-model="dialog.mostrar" tipo="corrida" :registro="registroVisualizado" />
    <ExcluirRegistro
      :acao="openPress"
      :data="usuarioSelecionado"
      @deleted="onRequest"
      v-model="dialog.excluir"
    />
    <q-card>
      <q-table
        :rows="data"
        :columns="columns"
        row-key="id"
        :pagination="pagination"
        :grid="grid"
        :loading="loading"
        @request="onRequest"
      >
        <!-- TOPO -->
        <template #top>
          <q-space />

          <q-input
            class="full-width"
            filled
            dense
            debounce="300"
            v-model="search"
            placeholder="Pesquisar"
            @keyup.enter="buscarDados"
          >
            <template v-if="search" #append>
              <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
            </template>
          </q-input>
        </template>

        <template #body="props">
          <q-tr :props="props">
            <q-td key="id">{{ props.row.id }}</q-td>

            <q-td key="corrida">
              <q-item>
                <q-item-section>
                  <q-item-label v-if="props.row.motorista?.user?.name">
                    <span class="text-bold">Motorista:</span>
                    {{ props.row.motorista.user.name }}</q-item-label
                  >
                  <q-item-label v-if="props.row.passageiro?.user?.name">
                    <span class="text-bold"> Passageiro: </span>
                    {{ props.row.passageiro.user.name }}
                  </q-item-label>
                  <q-item-label v-if="props.row.veiculo?.placa">
                    <span class="text-bold"> Veículo: </span>
                    {{ props.row.veiculo.placa }}
                  </q-item-label>
                  <div v-if="props.row.status_corrida">
                    <span class="text-bold"> Status: </span>
                    <q-badge :color="badgeColor(props.row.status_corrida)">
                      {{ formatarStatus(props.row.status_corrida) }}
                    </q-badge>
                  </div>
                </q-item-section>
              </q-item>
            </q-td>

            <q-td class="coluna-delimitada" :props="props" key="destinos">
              <div v-for="(corrida, index) in props.row.corrida_destinos" :key="index">
                <q-icon
                  :color="corInconeDestino(corrida.tipo)"
                  size="20px"
                  :name="iconesDestino(corrida.tipo)"
                />
                {{ limitarTexto(corrida.endereco, 20) }}
              </div>
            </q-td>

            <q-td :props="props" key="valores">
              <q-item>
                <q-item-section>
                  <q-item-label v-for="campo in dadosFinanceiros(props.row)" :key="campo.chave">
                    <span class="text-bold">{{ campo.label }}: </span>{{ campo.valor }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-td>

            <q-td key="acoes" align="center">
              <q-btn
                @click="openVisualizar(props.row)"
                dense
                flat
                icon="visibility"
                aria-label="Visualizar registro"
              >
                <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                  visualizar
                </q-tooltip>
                <template v-slot:loading>
                  <q-spinner-hourglass />
                </template>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from 'boot/axios'
import VisualizarRegistro from 'src/components/VisualizarRegistro.vue'
import ExcluirRegistro from 'src/components/ExcluirRegistro.vue'
import { camposDetalhes } from 'src/utils/detalhesRegistro'
import { formatarStatus } from 'src/utils/status'

// STATES
const data = ref([])

// const dominio = ref('users')
const usuarioSelecionado = ref(null)
const openPress = ref(null)
const loading = ref(false)
const search = ref('')
const grid = ref(false)

const dialog = reactive({
  editar: false,
  criar: false,
  mostrar: false,
  excluir: false,
})

const registroVisualizado = ref(null)

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'corrida', label: 'Corrida', align: 'left' },
  { name: 'destinos', label: 'Destinos', align: 'left' },
  { name: 'valores', label: 'Valores', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

const dadosFinanceiros = (corrida) =>
  camposDetalhes('corrida', corrida).filter((campo) =>
    campo.chave.startsWith('corrida_financeiro.'),
  )

const badgeColor = (status) => {
  if (status === 'solicitada') return 'orange'
  if (status === 'aceita') return 'primary'
  if (status === 'em_andamento') return 'secondary'
  if (status === 'finalizada') return 'green'
  if (status === 'cancelada') return 'red'
}

const iconesDestino = (tipo) => {
  console.log(tipo, 'tipo')
  if (tipo === 'origem') return 'arrow_circle_up'
  if (tipo === 'parada') return 'stop_circle'
  if (tipo === 'destino') return 'arrow_circle_down'
}

const corInconeDestino = (tipo) => {
  if (tipo === 'origem') return 'green'
  if (tipo === 'destino') return 'red'
}

function limitarTexto(texto, limite) {
  if (!texto) return ''
  return texto.length > limite ? texto.slice(0, limite) + '...' : texto
}

const clearSearch = () => {
  search.value = ''
  pagination.value.page = 1
  buscarDados()
}

const openVisualizar = (registro) => {
  registroVisualizado.value = registro
  dialog.mostrar = true
}

const buscarDados = async (props) => {
  loading.value = true
  const { page, rowsPerPage } = props?.pagination || pagination.value
  try {
    const response = await api.get('/corridas', {
      params: {
        search: search.value || '',
        page: page,
        rowsPerPage: rowsPerPage,
      },
    })

    const paginate = response.data

    data.value = response.data.data
    pagination.value.rowsNumber = paginate.total
    pagination.value.page = paginate.current_page
    pagination.value.rowsPerPage = paginate.per_page === paginate.total ? 0 : paginate.per_page
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}
const onRequest = async (props) => {
  console.log(props, 'props')
  await buscarDados(props)
}

// LIFECYCLE
onMounted(() => {
  buscarDados()
})
</script>

<style scoped>
.coluna-delimitada {
  max-width: 200px;
  white-space: normal;
  margin-top: 4px;
}

.cursor-pointer {
  cursor: pointer;
}
</style>