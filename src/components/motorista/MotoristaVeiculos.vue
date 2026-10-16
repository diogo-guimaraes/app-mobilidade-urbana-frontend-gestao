<template>
  <section>
    <CompartilharVeiculo
      v-model="compartilhar"
      :veiculo="veiculoCompartilhado"
      @updated="atualizarAposCadastro"
    />
    <SubirCrlv
      :motorista-id="motoristaId"
      :documento="documentoSelecionado"
      :veiculos="veiculosCrlv"
      origem="veiculos"
      @updated="atualizarAposCadastro"
      v-model="dialog"
    />
    <JanelaConfirmacao v-model="confirmarAprovacao" @confirm="aprovarCrlv">
      Deseja realmente aprovar o CRLV deste veículo?
    </JanelaConfirmacao>
    <ReprovarDocumento
      v-model="reprovarDocumento"
      :documento="documentoSelecionado"
      @updated="atualizarAposCadastro"
    />
    <q-dialog v-model="model" @before-show="beforeShow" @before-hide="onBeforeHide">
      <q-card class="motorista-veiculos-dialog" style="width: 800px; max-width: 95vw">
        <q-toolbar class="items-start q-pa-md">
          <q-toolbar-title class="motorista-veiculos-titulo q-pa-none">
            <div class="text-subtitle1 text-weight-bold">Veículos do motorista</div>
            <div class="text-caption text-weight-medium text-grey-7 q-mt-xs">
              {{ usuario?.name }}
            </div>
            <div class="text-caption text-weight-medium text-grey-7">CPF: {{ usuario?.cpf }}</div>
          </q-toolbar-title>

          <q-btn flat round dense icon="close" aria-label="Fechar" v-close-popup />
        </q-toolbar>

        <q-separator />
        <q-card-section
          v-if="loading && !data.length"
          class="column items-center justify-center q-py-xl text-primary"
          role="status"
          aria-live="polite"
        >
          <q-spinner size="40px" />
          <span class="q-mt-md">Carregando veículos…</span>
        </q-card-section>
        <q-card-section v-else-if="erroCarregamento" class="text-center q-py-lg">
          <div class="text-negative" role="alert">Não foi possível carregar os veículos.</div>
          <q-btn
            class="q-mt-md"
            flat
            color="primary"
            label="Tentar novamente"
            @click="onRequest()"
          />
        </q-card-section>
        <q-card-section v-else-if="!data.length" class="text-center q-py-lg">
          <div class="text-grey-7">Nenhum veículo encontrado.</div>
          <div v-if="!possuiVeiculoCadastrado" class="text-grey-7 q-mt-sm">
            Cadastre o primeiro veículo na área de Documentos.
          </div>
        </q-card-section>

        <q-card-section v-else>
          <div class="q-pa-xs">
            <q-table
              :rows="data"
              :columns="columns"
              row-key="id"
              v-model:pagination="pagination"
              :loading="loading"
              @request="onRequest"
            >
              <template #top>
                <div class="row items-center q-col-gutter-sm full-width">
                  <div class="col-12 col-sm-auto">
                    <q-btn
                      icon="add_box"
                      label="ADICIONAR VEÍCULO"
                      v-if="pode('veiculos.gerenciar')"
                      color="primary"
                      :disable="
                        !motoristaId ||
                        loading ||
                        alterandoStatus ||
                        erroCarregamento ||
                        !possuiVeiculoCadastrado
                      "
                      @click="abrirAdicionarVeiculo()"
                    />
                  </div>
                  <div class="col-12 col-sm">
                    <q-input
                      filled
                      dense
                      debounce="300"
                      v-model="search"
                      placeholder="Pesquisar"
                      @keyup.enter="onRequest()"
                    >
                      <template v-if="search" #append>
                        <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
                      </template>
                    </q-input>
                  </div>
                </div>
              </template>

              <template #body="props">
                <q-tr :props="props">
                  <q-td key="id">{{ props.row.id }}</q-td>

                  <q-td key="veiculo">
                    <q-item>
                      <q-item-section top avatar>
                        <q-avatar rounded color="primary" text-color="white" icon="directions_car">
                        </q-avatar>
                        <q-badge class="q-mt-sm" :label="props.row.veiculo.marca" color="grey-7" />
                      </q-item-section>

                      <q-item-section>
                        <q-item-label class="text-bold">
                          {{ props.row.veiculo.modelo }}</q-item-label
                        >
                        <q-item-label class="estilo-coluna">
                          {{ props.row.veiculo.renavam }}
                          <div>PLACA: {{ props.row.veiculo.placa }}</div>
                          <div>COR: {{ props.row.veiculo.cor }}</div>
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-td>

                  <q-td key="status">
                    <q-badge :color="badgeColor(props.row.veiculo.status)">
                      {{ formatarStatus(props.row.veiculo.status) }}
                    </q-badge>
                  </q-td>

                  <q-td key="acoes" align="center">
                    <q-btn
                      v-if="
                        pode('documentos.analisar') &&
                        props.row.veiculo.ultimo_crlv &&
                        ['em_analise', 'aprovado'].includes(props.row.veiculo.status)
                      "
                      dense
                      flat
                      icon="close"
                      color="negative"
                      aria-label="Reprovar CRLV"
                      :disable="loading || alterandoStatus"
                      @click="abrirReprovacao(props.row)"
                      ><q-tooltip>Reprovar CRLV</q-tooltip></q-btn
                    >
                    <q-btn
                      v-if="
                        pode('documentos.analisar') &&
                        props.row.veiculo.ultimo_crlv &&
                        ['em_analise', 'reprovado'].includes(props.row.veiculo.status)
                      "
                      dense
                      flat
                      icon="done"
                      color="positive"
                      aria-label="Aprovar CRLV"
                      :disable="loading || alterandoStatus"
                      @click="abrirConfirmacaoAprovacao(props.row)"
                      ><q-tooltip>Aprovar CRLV</q-tooltip></q-btn
                    >
                    <q-btn
                      dense
                      flat
                      icon="visibility"
                      aria-label="Visualizar CRLV"
                      :disable="loading || alterandoStatus"
                      @click="abrirDocumento(props.row)"
                    >
                      <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                        visualizar
                      </q-tooltip>
                      <template v-slot:loading>
                        <q-spinner-hourglass />
                      </template>
                    </q-btn>
                    <q-btn
                      dense
                      flat
                      icon="groups_2"
                      aria-label="Compartilhar veículo"
                      v-if="pode('veiculos.gerenciar')"
                      :disable="loading || alterandoStatus"
                      @click="abrirCompartilhamento(props.row.veiculo)"
                    >
                      <q-tooltip>Compartilhar veículo</q-tooltip>
                    </q-btn>
                    <q-btn v-if="pode('veiculos.gerenciar')" dense flat icon="delete">
                      <template v-slot:loading>
                        <q-spinner-hourglass />
                      </template>
                    </q-btn>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { computed, ref } from 'vue'
import SubirCrlv from 'src/components/motorista/SubirCrlv.vue'
import CompartilharVeiculo from 'src/components/motorista/CompartilharVeiculo.vue'
import JanelaConfirmacao from 'src/components/JanelaConfirmacao.vue'
import ReprovarDocumento from 'src/components/motorista/ReprovarDocumento.vue'
import { useQuasar } from 'quasar'

// import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { formatarStatus } from 'src/utils/status'

// PROPS
const props = defineProps({
  modelValue: Boolean,
  usuario: [Object],
  motoristaId: [String, Number],
})

// EMITS
const emit = defineEmits(['update:modelValue', 'updated'])

// const $q = useQuasar()

// MODEL
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// STATE
const loading = ref(false)
const erroCarregamento = ref(false)
const possuiVeiculoCadastrado = ref(false)
const documentoSelecionado = ref(null)
const confirmarAprovacao = ref(false)
const reprovarDocumento = ref(false)
const alterandoStatus = ref(false)
const $q = useQuasar()
let requestVersion = 0
const search = ref('')
const dialog = ref(false)
const compartilhar = ref(false)
const veiculoCompartilhado = ref(null)
function abrirCompartilhamento(veiculo) {
  veiculoCompartilhado.value = veiculo
  compartilhar.value = true
}
const data = ref([])
const veiculosCrlv = ref([])

const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
})

const columns = [
  {
    name: 'id',
    required: true,
    label: '',
    align: 'left',
    field: (row) => row.name,
    format: (val) => `${val}`,
  },
  {
    name: 'veiculo',
    required: true,
    label: 'Documentos',
    align: 'left',
    field: (row) => row.name,
    format: (val) => `${val}`,
  },
  {
    name: 'status',
    label: 'Status',
    align: 'left',
  },
  {
    name: 'acoes',
    label: 'Ações',
    align: 'center',
  },
]

// LIFECYCLE
function beforeShow() {
  data.value = []
  veiculosCrlv.value = []
  possuiVeiculoCadastrado.value = false
  search.value = ''
  pagination.value.page = 1
  request()
}

function onBeforeHide() {
  requestVersion++
  loading.value = false
  erroCarregamento.value = false
  data.value = []
}

function abrirAdicionarVeiculo() {
  if (!props.motoristaId || loading.value || !possuiVeiculoCadastrado.value) return
  documentoSelecionado.value = null
  dialog.value = true
}

function selecionarDocumento(row) {
  documentoSelecionado.value = {
    ...row.veiculo.ultimo_crlv,
    tipo_documento: 'crlv',
    titulo: 'VEÍCULO - CRLV',
    veiculo_id: row.veiculo.id,
    veiculo: row.veiculo,
  }
}

function abrirReprovacao(row) {
  selecionarDocumento(row)
  reprovarDocumento.value = true
}

function abrirConfirmacaoAprovacao(row) {
  selecionarDocumento(row)
  confirmarAprovacao.value = true
}

function abrirDocumento(row) {
  selecionarDocumento(row)
  dialog.value = true
}

async function aprovarCrlv() {
  if (!documentoSelecionado.value?.id || alterandoStatus.value) return
  alterandoStatus.value = true
  try {
    const response = await api.put(`/mudar-status-documento/${documentoSelecionado.value.id}`, {
      status: 'aprovado',
    })
    $q.notify({ type: 'positive', message: response.data.message })
    await atualizarAposCadastro()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível aprovar o CRLV.',
    })
  } finally {
    alterandoStatus.value = false
  }
}

async function atualizarAposCadastro() {
  search.value = ''
  pagination.value.page = 1
  emit('updated')
  await request()
}

const badgeColor = (status) => {
  if (status === 'em_analise') return 'orange'
  if (status === 'aprovado') return 'green'
  if (status === 'reprovado') return 'red'
  if (status === 'ativo') return 'green'
  if (status === 'inativo') return 'orange'
  if (status === 'pendente') return 'warning'
  if (status === 'bloqueado') return 'red'
}

const onRequest = async (props) => {
  await request(props)
}

function clearSearch() {
  search.value = ''
  pagination.value.page = 1
  request()
}

const request = async (payload) => {
  if (!props.motoristaId) return
  const version = ++requestVersion
  loading.value = true
  erroCarregamento.value = false
  const { page, rowsPerPage } = payload?.pagination || pagination.value
  try {
    const response = await api.get(`/motorista-veiculos/${props.motoristaId}`, {
      params: {
        search: search.value || '',
        page: page,
        rowsPerPage: rowsPerPage,
      },
      timeout: 15000,
    })

    if (version !== requestVersion) return
    data.value = response.data.data
    veiculosCrlv.value = response.data.veiculos || data.value.map((row) => row.veiculo)
    possuiVeiculoCadastrado.value =
      response.data.possui_veiculo_cadastrado ?? response.data.total > 0

    const paginate = response.data
    pagination.value.rowsNumber = paginate.total
    pagination.value.page = paginate.current_page
    pagination.value.rowsPerPage = paginate.per_page === paginate.total ? 0 : paginate.per_page
  } catch (error) {
    if (version === requestVersion) {
      erroCarregamento.value = true
      console.error(error)
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
</script>
<style scoped>
.motorista-veiculos-titulo {
  white-space: normal;
}
.estilo-coluna {
  max-width: 200px;
  white-space: normal;
  margin-top: 4px;
}
</style>
