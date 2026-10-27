<template>
  <q-page class="q-pa-md">
    <CriarUsuario tipoUsuario="motorista" @created="onRequest" v-model="dialog.cadastrar" />
    <MostrarUsuario
      v-model="dialog.visualizar"
      :usuario-id="usuarioId"
      tipoUsuario="motorista"
      :registro="registroVisualizado"
      @updated="onRequest"
    />
    <DocumentosUsuario
      :usuario="usuario"
      :motorista-id="motoristaId"
      v-model="dialog.documentos"
      @updated="onRequest"
    />
    <MotoristaVeiculos
      :usuario="usuario"
      :motorista-id="motoristaId"
      v-model="dialog.veiculos"
      @updated="onRequest"
    />
    <ExcluirUsuario
      :acao="openPress"
      :data="usuarioSelecionado"
      @deleted="onRequest"
      v-model="dialog.excluir"
    />
    <q-card>
      <!-- <div class="row wrap justify-between items-start content-start">
        <div>
          <q-btn icon="person_add_alt" color="primary" @click="dialog.cadastrar = true" />
        </div>
        <div class="q-pa-md">
          <q-btn icon="person_add_alt" color="primary" @click="dialog.cadastrar = true" />
        </div>
      </div> -->
      <q-table
        :rows="usuarios.data"
        :columns="columns"
        row-key="id"
        v-model:pagination="pagination"
        :rows-per-page-options="[10, 25, 50]"
        :grid="grid"
        :loading="loading"
        @request="onRequest"
      >
        <template #top>
          <q-space />
          <q-input
            class="full-width"
            filled
            dense
            debounce="300"
            v-model="search"
            placeholder="Pesquisar"
            @keyup.enter="aplicarFiltros"
          >
            <template #before>
              <q-btn
                class="q-mr-sm"
                icon="person_add_alt"
                label="CRIAR MOTORISTA"
                v-if="pode('usuarios.gerenciar')"
                color="primary"
                @click="dialog.cadastrar = true"
              />

              <q-btn-toggle
                class="q-mr-sm"
                @update:model-value="
                  (val) => {
                    dominio = val
                    aplicarFiltros()
                  }
                "
                v-model="dominio"
                toggle-color="primary"
                :options="[
                  { label: 'Ativos', value: 'motoristas' },
                  { label: 'Arquivados', value: 'motoristas-arquivados' },
                ]"
              />
            </template>

            <template v-if="search" #append>
              <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
            </template>
          </q-input>
        </template>

        <template #body="props">
          <q-tr :props="props">
            <q-td key="id">{{ props.row.id }}</q-td>

            <q-td key="motorista">
              <q-item>
                <q-item-section top avatar>
                  <q-avatar v-if="props.row.foto">
                    <img :src="props.row.foto" />
                  </q-avatar>
                  <q-avatar v-else color="primary" text-color="white">
                    {{ props.row.user?.name?.charAt(0) }}
                  </q-avatar>
                  <q-badge class="q-mt-sm" :color="badgeColor(props.row.status)">
                    {{ props.row.status === 'ativo' ? 'Ativo' : 'Pendente' }}
                  </q-badge>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-bold"> {{ props.row.user.name }}</q-item-label>
                  <q-item-label class="estilo-coluna">
                    <div v-if="props.row.email">{{ props.row.email }}</div>
                    <div>CPF: {{ props.row.user.cpf }}</div>
                    <div v-if="props.row.telefone">TEL: {{ props.row.telefone }}</div>
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
                <template v-slot:loading>
                  <q-spinner-hourglass />
                </template>
              </q-btn>

              <q-btn
                @click="
                  () => {
                    dialog.documentos = true
                    usuario = props.row.user
                    motoristaId = props.row.id
                  }
                "
                flat
                dense
                icon="list_alt"
              >
                <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                  Documentos
                </q-tooltip>
              </q-btn>
              <q-btn
                @click="
                  () => {
                    dialog.veiculos = true
                    usuario = props.row.user
                    motoristaId = props.row.id
                  }
                "
                dense
                flat
                icon="directions_car"
              >
                <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                  Veículos
                </q-tooltip>
              </q-btn>

              <q-btn
                v-if="pode('usuarios.gerenciar')"
                @click="openExcluir(props.row)"
                dense
                flat
                icon="delete"
              >
                <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                  arquivar
                </q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { ref, reactive, onMounted } from 'vue'
import { api } from 'boot/axios'
import CriarUsuario from 'src/components/usuarios/CriarUsuario.vue'
import MostrarUsuario from 'src/components/usuarios/MostrarUsuario.vue'
import ExcluirUsuario from 'src/components/usuarios/ExcluirUsuario.vue'
import DocumentosUsuario from 'src/components/usuarios/DocumentosUsuario.vue'
import MotoristaVeiculos from 'src/components/motorista/MotoristaVeiculos.vue'

// STATES
const usuarios = ref({
  success: true,
  data: [],
})

const dominio = ref('motoristas')
const usuarioSelecionado = ref(null)
const openPress = ref(null)
const loading = ref(false)
const search = ref('')
const grid = ref(false)

const dialog = reactive({
  editar: false,
  cadastrar: false,
  visualizar: false,
  excluir: false,
  veiculos: false,
  documentos: false,
})

const usuarioId = ref(null)
const registroVisualizado = ref(null)
const usuario = ref({})
const motoristaId = ref(null)

const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'motorista', label: 'Motorista', field: 'name', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

const badgeColor = (status) => {
  return status === 'ativo' ? 'green' : 'warning'
}

// const toggleGrid = () => {
//   grid.value = !grid.value
// }

const clearSearch = () => {
  search.value = ''
  aplicarFiltros()
}

const aplicarFiltros = () => {
  pagination.value.page = 1
  buscarDados()
}

const openVisualizar = (registro) => {
  usuarioId.value = registro.id
  registroVisualizado.value = registro
  dialog.visualizar = true
}

const openExcluir = (usuario) => {
  usuarioSelecionado.value = [usuario]
  openPress.value = 'arquivar'
  dialog.excluir = true
}

const buscarDados = async (props) => {
  loading.value = true
  const { page, rowsPerPage } = props?.pagination || pagination.value
  try {
    const response = await api.get(`${dominio.value}`, {
      params: {
        search: search.value || '',
        page: page,
        rowsPerPage: rowsPerPage,
      },
    })

    const data = response.data

    usuarios.value = {
      success: true,
      data: data.data, // array de usuários
    }

    pagination.value.rowsNumber = data.total
    pagination.value.page = data.current_page
    pagination.value.rowsPerPage = data.per_page
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
