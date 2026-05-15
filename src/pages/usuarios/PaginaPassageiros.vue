<template>
  <q-page class="q-pa-md">
    <CriarMotorista @created="onRequest" v-model="dialog.cadastrar" />
    <EditarUsuario @updated="onRequest" v-model="dialog.editar" :usuarioId="usuarioId" />
    <MostrarUsuario v-model="dialog.visualizar" />
    <DocumentosUsuario :usuario="usuario" v-model="dialog.documentos" />
    <MotoristaVeiculos :usuario="usuario" v-model="dialog.veiculos" />
    <ExcluirUsuario
      :acao="openPress"
      :data="usuarioSelecionado"
      @deleted="onRequest"
      v-model="dialog.excluir"
    />
    <q-card>
      <q-table
        :rows="usuarios.data"
        :columns="columns"
        row-key="id"
        :pagination="pagination"
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
            @keyup.enter="buscarDados"
          >
            <template #before>
              <q-btn
                class="q-mr-sm"
                icon="person_add_alt"
                label="CRIAR PASSGEIRO"
                color="primary"
                @click="dialog.cadastrar = true"
              />

              <q-btn-toggle
                class="q-mr-sm"
                @update:model-value="
                  (val) => {
                    dominio = val
                    buscarDados()
                  }
                "
                v-model="dominio"
                toggle-color="primary"
                :options="[
                  { label: 'Ativos', value: 'passageiros' },
                  { label: 'Arquivados', value: 'passageiros-arquivados' },
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

            <q-td key="passageiro">
              <q-item>
                <q-item-section top avatar>
                  <q-avatar v-if="props.row.user.foto_thumbnail">
                    <img :src="props.row.user.foto" />
                  </q-avatar>
                  <q-avatar v-else color="primary" text-color="white">
                    {{ props.row.user.name.substr(0, 1) }}
                  </q-avatar>
                  <q-badge class="q-mt-sm" :color="badgeColor(props.row.user.status)">
                    {{ props.row.user.status }}
                  </q-badge>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-bold"> {{ props.row.user.name }}</q-item-label>
                  <q-item-label class="estilo-coluna">
                    {{ props.row.user.email }}
                    <div>CPF: {{ props.row.user.cpf }}</div>
                    <div>TEL: {{ props.row.user.telefone }}</div>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-td>

            <q-td key="acoes" align="center">
              <q-btn @click="openEditar(props.row.user.id)" dense flat icon="visibility">
                <template v-slot:loading>
                  <q-spinner-hourglass />
                </template>
              </q-btn>

              <q-btn @click="openExcluir(props.row)" dense flat icon="delete">
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
import { ref, reactive, onMounted } from 'vue'
import { api } from 'boot/axios'
import CriarMotorista from 'src/components/motorista/CriarMotorista.vue'
import MostrarUsuario from 'src/components/usuarios/MostrarUsuario.vue'
import EditarUsuario from 'src/components/usuarios/EditarUsuario.vue'
import ExcluirUsuario from 'src/components/usuarios/ExcluirUsuario.vue'
import DocumentosUsuario from 'src/components/usuarios/DocumentosUsuario.vue'
import MotoristaVeiculos from 'src/components/motorista/MotoristaVeiculos.vue'

// STATES
const usuarios = ref({
  success: true,
  data: [],
})

const dominio = ref('passageiros')
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
})

const usuarioId = ref(null)
const usuario = ref({})

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'passageiro', label: 'Passageiros', field: 'name', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

const badgeColor = (status) => {
  if (status === 'aprovado') return 'green'
  if (status === 'suspenso') return 'orange'
  if (status === 'banido') return 'red'
}

// const toggleGrid = () => {
//   grid.value = !grid.value
// }

const clearSearch = () => {
  search.value = ''
  pagination.value.page = 1
  buscarDados()
}

const openEditar = (id) => {
  usuarioId.value = id
  dialog.editar = true
}

const openExcluir = (usuario) => {
  usuarioSelecionado.value = [usuario]
  openPress.value = 'arquivar'
  dialog.excluir = true
}

const buscarDados = async (props) => {
  loading.value = true
  const { page, rowsPerPage } = props ? props.pagination : pagination
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
    pagination.value.rowsPerPage = data.per_page === data.total ? 0 : data.per_page
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
