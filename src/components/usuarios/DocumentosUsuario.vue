<template>
  <section>
    <SubirArquivo
      @updated="getMotoristaDocumentos()"
      v-model="dialog.envairArquivo"
      :usuarioId="usuario?.id"
      :documento="documentoSelecionado"
    />
    <q-dialog v-model="model" @before-show="beforeShow" @before-hide="onBeforeHide">
      <q-card style="width: 600px; max-width: 50vw">
        <!-- HEADER -->

        <!-- <q-card style="border-style: none"> -->
        <CardPerfilUsuario class="q-mt-md" :usuario="props.usuario" />
        <!-- </q-card> -->

        <q-table
          class="q-mt-sm q-mb-sm"
          bordered
          flat
          :rows="data"
          :columns="columns"
          row-key="tipo_documento"
          hide-bottom
          hide-header
        >
          <!-- <template #top>
            <CardPerfilUsuario :usuario="props.usuario" />
          </template> -->
          <template v-slot:body="props">
            <q-tr :props="props">
              <q-td key="documento" :props="props">
                <q-item>
                  <q-item-section top avatar>
                    <q-avatar icon="attach_file" size="xl" rounded> </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-h6"> {{ props.row.titulo }}</q-item-label>
                    <q-item-label class="estilo-coluna" caption>
                      {{ props.row.descricao }}
                    </q-item-label>
                    <q-item-label caption>
                      <q-badge
                        :color="badgeColor(props.row.status)"
                        :label="props.row.status ? props.row.status : 'Não enviado'"
                      />
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-td>
              <q-td :props="props" key="acoes">
                <q-btn
                  v-if="visibilidadeBotoes(props.row.status, 'acao')"
                  @click="
                    () => {
                      documentoSelecionado = props.row
                      dialog.reprovarDocumento = true
                    }
                  "
                  flat
                  text-color="red"
                  round
                  icon="close"
                >
                  <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                    reprovar documento
                  </q-tooltip>
                </q-btn>
                <q-btn
                  v-if="visibilidadeBotoes(props.row.status, 'acao')"
                  @click="
                    () => {
                      documentoSelecionado = props.row
                      dialog.confirmacao = true
                    }
                  "
                  flat
                  text-color="green"
                  round
                  icon="done"
                >
                  <q-tooltip transition-show="flip-right" transition-hide="flip-left">
                    aprovar documento
                  </q-tooltip>
                </q-btn>
                <q-btn
                  v-if="visibilidadeBotoes(props.row.status, 'menu')"
                  @click.stop.prevent
                  title="Menu"
                  icon="linear_scale"
                  dense
                  flat
                  round
                >
                  <q-menu>
                    <q-list style="min-width: 100px">
                      <q-item clickable v-close-popup>
                        <q-item-section>Reprovar documento</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup>
                        <q-item-section>Excluir documento</q-item-section>
                      </q-item>

                      <q-item clickable v-close-popup>
                        <q-item-section>Baixar documento</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>

                <q-icon
                  v-if="visibilidadeBotoes(props.row.status, 'upload')"
                  @click="
                    () => {
                      documentoSelecionado.value = props.row
                      dialog.envairArquivo = true
                    }
                  "
                  class="q-ml-lg cursor-pointer"
                  color="grey"
                  size="sm"
                  name="upload"
                >
                  <q-tooltip
                    v-if="!props.row.id"
                    transition-show="flip-right"
                    transition-hide="flip-left"
                  >
                    enviar arquivo
                  </q-tooltip>
                </q-icon>

                <!-- <q-icon
                  v-if="visibilidadeBotoes(props.row.status, 'download')"
                  @click="
                    () => {
                      documentoSelecionado.value = props.row
                      dialog.envairArquivo = true
                    }
                  "
                  class="q-ml-lg cursor-pointer"
                  color="grey"
                  size="sm"
                  name="download"
                >
                  <q-tooltip
                    v-if="!props.row.id"
                    transition-show="flip-right"
                    transition-hide="flip-left"
                  >
                    baixar arquivo
                  </q-tooltip>
                </q-icon> -->
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card>
    </q-dialog>
    <q-dialog v-model="dialog.reprovarDocumento">
      <q-card style="width: 700px; max-width: 80vw">
        <q-card-section>
          <CardPerfilDocumento :documento="documentoSelecionado" />
          <q-form @submit.prevent="onSubmit">
            <q-input
              label="Observação"
              dense
              outlined
              autogrow
              class="full-width q-px-md q-mt-md q-mb-md"
              v-model="documentoSelecionado.observacao"
              type="textarea"
              bottom-slots
              counter
              maxlength="2000"
              :rules="[(val) => val.length >= 3 || 'Campo obrigatório']"
            >
              <template v-slot:hint> Caracteres </template>
            </q-input>
            <div class="q-mt-md" align="center">
              <q-btn type="submit" icon="close" color="red" label="REPROVAR DOCUMENTO" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
    <JanelaConfirmacao v-model="dialog.confirmacao" @confirm="mudarStatusDocumento('aprovado')">
      Deseja realmente aprovar o ducmento?
    </JanelaConfirmacao>
    <JanelaConfirmacao
      v-model="dialog.confirmacaoReprovarDocumento"
      @confirm="mudarStatusDocumento('reprovado')"
    >
      Deseja realmente reprovar o ducmento?
    </JanelaConfirmacao>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import CardPerfilUsuario from 'src/components/usuarios/CardPerfilUsuario.vue'
import JanelaConfirmacao from 'src/components/JanelaConfirmacao.vue'
import SubirArquivo from 'src/components/motorista/SubirArquivo.vue'
import CardPerfilDocumento from 'src/components/motorista/CardPerfilDocumento.vue'

// PROPS
const props = defineProps({
  modelValue: Boolean,
  usuario: [Object],
})

// EMITS
const emit = defineEmits(['update:modelValue'])

// QUASAR
const $q = useQuasar()

// MODEL
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// STATE
const pagination = ref({
  page: 1,
  rowsPerPage: 5,
})
const documentoSelecionado = ref({
  observacao: '',
})
const motoristaDocumentos = ref([])
const dialog = ref({
  confirmacao: false,
  envairArquivo: false,
  reprovarDocumento: false,
  confirmacaoReprovarDocumento: false,
})

const data = ref([
  {
    id: '',
    titulo: 'CNH',
    tipo_documento: 'cnh',
    descricao: 'CARTEIRA NACIONAL DE HABILITAÇÃO',
    status: '',
    observacao: '',
  },
  {
    id: '',
    titulo: 'VEÍCULO - CRLV',
    tipo_documento: 'crlv',
    descricao: 'CERTIFICADO DE REGISTRO E LICENCIAMENTE DO VEÍCULO',
    status: '',
    observacao: '',
  },
  {
    id: '',
    titulo: 'NADA CONSTA',
    tipo_documento: 'nada_consta',
    descricao: 'CERTIDÃO NEGATIVA DE ANTECEDENTES CRIMINAIS',
    status: '',
    observacao: '',
  },
  {
    id: '',
    titulo: 'SEGURO',
    tipo_documento: 'seguro_obrigatorio',
    descricao: 'SEGURO OBRIGATÓRIO',
    status: '',
    observacao: '',
  },
])

const columns = [
  {
    name: 'documento',
    label: 'Documentos',
    align: 'left',
  },
  {
    name: 'acoes',
    label: 'Ações',
  },
]

function dataInicial() {
  data.value = [
    {
      id: '',
      titulo: 'CNH',
      tipo_documento: 'cnh',
      descricao: 'CARTEIRA NACIONAL DE HABILITAÇÃO',
      status: '',
      observacao: '',
    },
    {
      id: '',
      titulo: 'VEÍCULO - CRLV',
      tipo_documento: 'crlv',
      descricao: 'CERTIFICADO DE REGISTRO E LICENCIAMENTE DO VEÍCULO',
      status: '',
      observacao: '',
    },
    {
      id: '',
      titulo: 'NADA CONSTA',
      tipo_documento: 'nada_consta',
      descricao: 'CERTIDÃO NEGATIVA DE ANTECEDENTES CRIMINAIS',
      status: '',
      observacao: '',
    },
    {
      id: '',
      titulo: 'SEGURO',
      tipo_documento: 'seguro_obrigatorio',
      descricao: 'SEGURO OBRIGATÓRIO',
      status: '',
      observacao: '',
    },
  ]
}

function onSubmit() {
  dialog.value.confirmacaoReprovarDocumento = true
}

function beforeShow() {
  dataInicial()
  getMotoristaDocumentos()
}

function onBeforeHide() {
  dataInicial()
}

function visibilidadeBotoes(status, tipo) {
  switch (tipo) {
    case 'acao':
      return status === 'em_analise'

    case 'menu':
      return status === 'aprovado' || status === 'reprovado' || status === 'em_analise'

    case 'download':
      return status === 'aprovado' || status === 'reprovado' || status === 'em_analise'

    case 'upload':
      return !status

    default:
      return false
  }
}

const badgeColor = (status) => {
  if (status === 'aprovado') return 'green'
  if (status === 'reprovado') return 'red'
  if (status === 'em_analise') return 'orange'
  return 'grey'
}

async function mudarStatusDocumento(status) {
  try {
    console.log('documentoSelecionado.value', documentoSelecionado.value)
    const response = await api.put(`mudar-status-documento/${documentoSelecionado.value.id}`, {
      observacao: documentoSelecionado.value.observacao,
      status: status,
    })
    console.log(response, 'response')
    dialog.value.reprovarDocumento = false
    documentoSelecionado.value = {}
    getMotoristaDocumentos()
    $q.notify({ type: 'positive', position: 'top-right', message: response.data.message })
  } catch (err) {
    console.log(err, 'err')
    // model.value = false
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    // model.value = false
  }
}

const getMotoristaDocumentos = async (payload) => {
  if (!props?.usuario?.id) return

  const { page, rowsPerPage } = payload ? props.pagination : pagination

  try {
    const response = await api.get(`/motorista-documentos/${props.usuario?.id}`, {
      params: {
        page: page,
        rowsPerPage: rowsPerPage,
      },
    })
    motoristaDocumentos.value = response.data.data
    console.log(data.value, 'data')
    console.log(motoristaDocumentos, 'motoristaDocumentos motoristaDocumentos')

    // 🔥 cria um map para busca rápida por documento
    const documentosMap = new Map(
      motoristaDocumentos.value.map((item) => [item.tipo_documento, item])
    )

    // 🔥 faz o merge mantendo estrutura original do data
    data.value = data.value.map((item) => {
      const doc = documentosMap.get(item.tipo_documento)

      if (doc) {
        return {
          ...item,
          id: doc.id,
          status: doc.status,
        }
      }

      return item
    })

    const paginate = response.data
    pagination.value.rowsNumber = paginate.total
    pagination.value.page = paginate.current_page
    pagination.value.rowsPerPage = paginate.per_page === paginate.total ? 0 : paginate.per_page
  } catch (error) {
    console.error(error)
  }
}
</script>
<style scoped>
.estilo-coluna {
  max-width: 200px;
  white-space: normal;
  margin-top: 4px;
}
</style>
