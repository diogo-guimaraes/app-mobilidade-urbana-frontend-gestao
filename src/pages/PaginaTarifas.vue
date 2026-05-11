<template>
  <q-page class="q-pa-md">
    <!-- <CriarVeiculo @onRequest="onRequest" v-model="dialog.criar" /> -->
    <EditarVeiculo @updated="onRequest" v-model="dialog.editar" :veiculoId="veiculoId" />
    <MostrarVeiculo v-model="dialog.mostrar" />
    <ExcluirVeiculo
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
            <template #before>
              <!-- <q-btn
                icon="add_box"
                label="CRIAR VEÍCULO"
                color="primary"
                @click="dialog.criar = true"
              /> -->
            </template>

            <template v-if="search" #append>
              <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
            </template>
          </q-input>
        </template>

        <template #body="props">
          <q-tr :props="props">
            <q-td key="id">{{ props.row.id }}</q-td>

            <q-td key="tarifa">
              <q-item>
                <q-item-section>
                  <q-item-label class="text-bold"> {{ props.row.produto.nome }}</q-item-label>
                  <q-item-label class="estilo-coluna">
                    <div>Tafia base: {{ props.row.tarifa_base }}</div>
                    <div>Valor por km: {{ props.row.valor_por_km }}</div>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-td>

            <q-td key="status">
              <q-badge color="green"> ativo </q-badge>
            </q-td>

            <q-td key="acoes" align="center">
              <q-btn @click="openEditar(props.row.id)" dense flat icon="visibility">
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
// import CriarVeiculo from 'src/components/veiculos/CriarVeiculo.vue'
import MostrarVeiculo from 'src/components/veiculos/MostrarVeiculo.vue'
import EditarVeiculo from 'src/components/veiculos/EditarVeiculo.vue'
import ExcluirVeiculo from 'src/components/veiculos/ExcluirVeiculo.vue'

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

const veiculoId = ref(null)

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'tarifa', label: 'Tarifas', align: 'left' },
  // { name: 'modelo', label: 'modelo', field: 'status', align: 'left' },
  // { name: 'ano_fabricacao', label: 'ano_fabricacao', align: 'center' },
  // { name: 'ano_modelo', label: 'ano_modelo', field: 'status', align: 'left' },
  // { name: 'cor', label: 'cor', field: 'status', align: 'left' },
  // { name: 'placa', label: 'placa', field: 'status', align: 'left' },
  // { name: 'renavam', label: 'renavam', field: 'status', align: 'left' },
  // { name: 'categoria', label: 'categoria', field: 'status', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

// const badgeColor = (status) => {
//   if (status === 'ativo') return 'green'
//   if (status === 'inativo') return 'orange'
//   if (status === 'pendente') return 'warning'
//   if (status === 'bloqueado') return 'red'
// }

// const toggleGrid = () => {
//   grid.value = !grid.value
// }

const clearSearch = () => {
  search.value = ''
  pagination.value.page = 1
  buscarDados()
}

const openEditar = (id) => {
  veiculoId.value = id
  dialog.editar = true
}

const buscarDados = async (props) => {
  loading.value = true
  const { page, rowsPerPage } = props ? props.pagination : pagination
  try {
    const response = await api.get('/tarifas', {
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
.estilo-coluna {
  max-width: 200px;
  white-space: normal;
  margin-top: 4px;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
