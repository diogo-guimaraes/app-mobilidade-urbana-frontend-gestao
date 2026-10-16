<template>
  <q-page class="q-pa-md">
    <CriarUsuario v-model="dialogCadastrar" tipoUsuario="gestor" @created="gestorSalvo" />
    <FormularioGestor v-model="dialogFormulario" :gestor-id="gestorId" @saved="gestorSalvo" />
    <MostrarUsuario
      v-model="dialogVisualizar"
      tipoUsuario="gestor"
      :usuario-id="gestorId"
      :registro="registroVisualizado"
      @updated="gestorSalvo"
    />
    <q-dialog v-model="dialogConfirmacao" :persistent="processando">
      <q-card style="width: 400px; max-width: 95vw">
        <q-toolbar>
          <q-toolbar-title class="text-weight-bold">{{
            arquivados ? 'Restaurar gestor' : 'Arquivar gestor'
          }}</q-toolbar-title>
          <q-btn
            flat
            round
            dense
            icon="close"
            aria-label="Fechar confirmação"
            :disable="processando"
            v-close-popup
          />
        </q-toolbar>
        <q-separator />
        <q-card-section>
          <div>{{ arquivados ? 'Restaurar' : 'Arquivar' }} o gestor {{ selecionado?.name }}?</div>
          <div v-if="!arquivados" class="text-grey-7 q-mt-sm">
            O gestor ficará sem acesso ao painel enquanto estiver arquivado.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" :disable="processando" v-close-popup />
          <q-btn
            :label="arquivados ? 'Restaurar' : 'Arquivar'"
            :color="arquivados ? 'primary' : 'negative'"
            :loading="processando"
            @click="confirmarAcao"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-card>
      <q-table
        :rows="gestores"
        :columns="columns"
        row-key="id"
        v-model:pagination="pagination"
        :loading="carregando"
        :rows-per-page-options="[5, 15, 30, 50]"
        @request="buscar"
        no-data-label="Nenhum gestor encontrado"
        rows-per-page-label="Registros por página"
      >
        <template #top>
          <div class="row items-center q-gutter-sm full-width">
            <q-btn
              icon="person_add_alt"
              color="primary"
              label="CRIAR GESTOR"
              @click="abrirFormulario()"
            />
            <q-btn-toggle
              v-model="arquivados"
              toggle-color="primary"
              :disable="processando"
              :options="[
                { label: 'Ativos', value: false },
                { label: 'Arquivados', value: true },
              ]"
              @update:model-value="pesquisar"
            />
            <q-input
              v-model="search"
              filled
              dense
              debounce="300"
              placeholder="Pesquisar"
              aria-label="Pesquisar gestores"
              class="col campo-pesquisa"
              clearable
              @update:model-value="pesquisar"
              @keyup.enter="pesquisar"
            />
          </div>
        </template>
        <template #body="props">
          <q-tr :props="props">
            <q-td key="id" :props="props">{{ props.row.id }}</q-td>
            <q-td key="nome" :props="props"><CardPerfilGestor :gestor="props.row" /></q-td>
            <q-td key="acoes" :props="props">
              <q-btn
                flat
                dense
                icon="visibility"
                :aria-label="`Visualizar ${props.row.name}`"
                @click="abrirFormulario(props.row, true)"
                ><q-tooltip>Visualizar</q-tooltip></q-btn
              >
              <q-btn
                v-if="!arquivados"
                flat
                dense
                icon="edit"
                :aria-label="`Editar ${props.row.name}`"
                @click="abrirFormulario(props.row)"
                ><q-tooltip>Editar</q-tooltip></q-btn
              >
              <q-btn
                flat
                dense
                :icon="arquivados ? 'restore_from_trash' : 'delete'"
                :aria-label="`${arquivados ? 'Restaurar' : 'Arquivar'} ${props.row.name}`"
                :disable="!arquivados && props.row.id === authStore.user?.id"
                @click="abrirConfirmacao(props.row)"
              >
                <q-tooltip>{{
                  props.row.id === authStore.user?.id && !arquivados
                    ? 'Seu gestor está utilizando o painel'
                    : arquivados
                      ? 'Restaurar'
                      : 'Arquivar'
                }}</q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
        <template #no-data>
          <div class="row items-center q-gutter-sm q-pa-md">
            <q-icon :name="erroLista ? 'error_outline' : 'search'" size="24px" />
            <span>{{ erroLista || 'Nenhum gestor encontrado.' }}</span>
            <q-btn
              v-if="erroLista"
              flat
              color="primary"
              label="Tentar novamente"
              @click="buscar()"
            />
          </div>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { useAuthStore } from 'src/stores/auth'
import CardPerfilGestor from 'src/components/gestores/CardPerfilGestor.vue'
import FormularioGestor from 'src/components/gestores/FormularioGestor.vue'
import CriarUsuario from 'src/components/usuarios/CriarUsuario.vue'
import MostrarUsuario from 'src/components/usuarios/MostrarUsuario.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const gestores = ref([])
const arquivados = ref(false)
const search = ref('')
const carregando = ref(false)
const erroLista = ref('')
const dialogFormulario = ref(false)
const dialogCadastrar = ref(false)
const gestorId = ref(null)
const dialogVisualizar = ref(false)
const registroVisualizado = ref(null)
const dialogConfirmacao = ref(false)
const selecionado = ref(null)
const processando = ref(false)
const pagination = ref({ page: 1, rowsPerPage: 5, rowsNumber: 0 })
const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'nome', label: 'Nome', field: 'name', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]
let ultimaConsulta = 0

function abrirFormulario(gestor = null, leitura = false) {
  if (!gestor) {
    dialogCadastrar.value = true
    return
  }
  gestorId.value = gestor?.id || null
  registroVisualizado.value = gestor
  if (leitura) dialogVisualizar.value = true
  else dialogFormulario.value = true
}
function abrirConfirmacao(gestor) {
  selecionado.value = gestor
  dialogConfirmacao.value = true
}
function pesquisar() {
  pagination.value.page = 1
  buscar()
}
async function buscar(props) {
  const consulta = ++ultimaConsulta
  const paginacao = props?.pagination || pagination.value
  carregando.value = true
  erroLista.value = ''
  try {
    const { data } = await api.get(arquivados.value ? 'gestores/arquivados' : 'gestores', {
      params: {
        search: search.value || '',
        page: paginacao.page,
        rowsPerPage: paginacao.rowsPerPage,
      },
    })
    if (consulta !== ultimaConsulta) return
    if (!data.data.length && data.current_page > 1) {
      pagination.value.page = Math.max(1, data.last_page)
      return buscar()
    }
    gestores.value = data.data
    pagination.value = {
      page: data.current_page,
      rowsPerPage: data.per_page,
      rowsNumber: data.total,
    }
  } catch (erro) {
    if (consulta !== ultimaConsulta) return
    gestores.value = []
    erroLista.value = erro.response?.data?.message || 'Não foi possível carregar os gestores.'
  } finally {
    if (consulta === ultimaConsulta) carregando.value = false
  }
}
function gestorSalvo(gestor) {
  if (gestor.id === authStore.user?.id) authStore.user = gestor
  pesquisar()
}
async function confirmarAcao() {
  if (processando.value || !selecionado.value) return
  processando.value = true
  try {
    const { data } = arquivados.value
      ? await api.post(`gestores/${selecionado.value.id}/restaurar`)
      : await api.delete(`gestores/${selecionado.value.id}`)
    $q.notify({ type: 'positive', message: data.message })
    dialogConfirmacao.value = false
    await buscar()
  } catch (erro) {
    $q.notify({
      type: 'negative',
      message: erro.response?.data?.message || 'Não foi possível concluir a operação.',
    })
  } finally {
    processando.value = false
  }
}
onMounted(() => buscar())
</script>

<style scoped>
.campo-pesquisa {
  min-width: 180px;
}
</style>
