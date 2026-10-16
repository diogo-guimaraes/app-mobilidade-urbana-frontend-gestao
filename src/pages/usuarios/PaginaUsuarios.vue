<template>
  <q-page class="q-pa-md">
    <CriarUsuario tipoUsuario="usuario" @created="onRequest" v-model="dialog.cadastrar" />
    <MostrarUsuario
      v-model="dialog.visualizar"
      :usuario-id="usuarioId"
      tipoUsuario="usuario"
      :registro="registroVisualizado"
    />
    <DocumentosUsuario :usuarioId="usuarioId" v-model="dialog.documentos" />
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
        :rows="data"
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
            @keyup.enter="request"
          >
            <template #before>
              <!-- <q-btn
                icon="person_add_alt"
                color="primary"
                @click="dialog.cadastrar = true"
                label="CRIAR USUÁRIO"
                v-if="pode('usuarios.gerenciar')"
                class="q-mr-sm"
              /> -->
              <q-btn-toggle
                class="q-mr-sm"
                @update:model-value="
                  (val) => {
                    dominio = val
                    request()
                  }
                "
                v-model="dominio"
                toggle-color="primary"
                :options="[
                  { label: 'Ativos', value: 'users' },
                  { label: 'Arquivados', value: 'usuarios-arquivados' },
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

            <q-td key="nome">
              <CardPerfilUsuario class="q-mt-sm" :usuario="props.row" />
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
              <!--
              <q-btn
                @click=";(dialog.documentos = true), (usuarioId = props.row.id)"
                flat
                dense
                icon="list_alt"
              >
                <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                  Documentos
                </q-tooltip>
              </q-btn> -->

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

        <!-- GRID -->
        <template #item="props">
          <div class="q-pa-xs col-xs-12 col-sm-6 col-md-3">
            <q-card>
              <q-item clickable @click="openVisualizar(props.row)">
                <q-item-section avatar>
                  <q-avatar size="70px">
                    <img v-if="props.row.foto" :src="props.row.foto" />
                    <span v-else>
                      {{ props.row.name?.charAt(0) }}
                    </span>
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <q-item-label>{{ props.row.name }}</q-item-label>
                  <q-item-label caption> CPF: {{ props.row.cpf }} </q-item-label>
                </q-item-section>
              </q-item>
            </q-card>
          </div>
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
import CardPerfilUsuario from 'src/components/usuarios/CardPerfilUsuario.vue'

// STATES
const data = ref([])
const dominio = ref('users')
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
})

const usuarioId = ref(null)
const registroVisualizado = ref(null)

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'nome', label: 'Nome', field: 'name', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

const clearSearch = () => {
  search.value = ''
  pagination.value.page = 1
  request()
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

const request = async (props) => {
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

    data.value = response.data.data

    const paginate = response.data
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
  await request(props)
}

// LIFECYCLE
onMounted(() => {
  request()
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
