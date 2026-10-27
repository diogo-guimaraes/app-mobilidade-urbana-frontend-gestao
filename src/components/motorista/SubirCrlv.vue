<template>
  <q-dialog v-model="model" persistent @before-show="iniciar" @hide="fechar">
    <q-card class="crlv-dialog">
      <q-toolbar>
        <q-toolbar-title class="text-weight-bold">{{
          documento?.status === 'reprovado' ? 'Reenviar CRLV' : 'CRLV do veículo'
        }}</q-toolbar-title>
        <q-btn flat round dense icon="close" aria-label="Fechar" :disable="ocupado" v-close-popup />
      </q-toolbar>
      <q-separator />
      <q-form ref="formulario" @submit.prevent="enviar">
        <div class="row">
          <section class="col-12 col-md-5 q-pa-lg dados-crlv">
            <div>
              <div
                v-if="documentosCrlv.length"
                class="crlv-controles row items-center no-wrap"
                aria-label="Navegação dos CRLVs"
              >
                <q-btn
                  outline
                  dense
                  no-caps
                  icon="chevron_left"
                  label="Voltar"
                  aria-label="Voltar CRLV"
                  class="crlv-navegacao-botao"
                  :disable="ocupado || lendo || indiceDocumento <= 0"
                  @click="navegarCrlv(documentosCrlv[indiceDocumento - 1]?.veiculo_id)"
                />
                <q-select
                  borderless
                  :model-value="veiculoId === null ? null : String(veiculoId)"
                  :options="opcoesPlacas"
                  label="Placa"
                  dense
                  emit-value
                  map-options
                  class="crlv-seletor-placa"
                  :disable="ocupado || lendo"
                  @update:model-value="navegarCrlv"
                >
                  <template #selected-item="{ opt }">
                    <span class="row items-center no-wrap">
                      <span>{{ opt.label }}</span>
                      <span
                        class="crlv-status-ponto q-ml-xs"
                        :class="`bg-${opt.color}`"
                        role="img"
                        :aria-label="opt.statusLabel"
                      >
                        <q-tooltip>{{ opt.statusLabel }}</q-tooltip>
                      </span>
                    </span>
                  </template>
                  <template #option="{ opt, itemProps }">
                    <q-item v-bind="itemProps">
                      <q-item-section>
                        <q-item-label>{{ opt.label }}</q-item-label>
                        <q-item-label caption>
                          <q-badge :color="opt.color" :label="opt.statusLabel" />
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <q-btn
                  outline
                  dense
                  no-caps
                  icon-right="chevron_right"
                  label="Próximo"
                  aria-label="Próximo CRLV"
                  class="crlv-navegacao-botao"
                  :disable="
                    ocupado ||
                    lendo ||
                    indiceDocumento < 0 ||
                    indiceDocumento === documentosCrlv.length - 1
                  "
                  @click="navegarCrlv(documentosCrlv[indiceDocumento + 1]?.veiculo_id)"
                />
                <q-btn
                  color="primary"
                  dense
                  icon="add_box"
                  label="Novo veículo"
                  v-if="pode('veiculos.gerenciar')"
                  class="crlv-navegacao-botao crlv-novo-veiculo q-ml-auto"
                  :disable="ocupado || lendo || novoVeiculo"
                  @click="iniciarNovoVeiculo"
                />
              </div>
            </div>
            <p class="text-grey-7 q-mt-xs">
              Confira os dados com o documento ao lado antes de enviar.
            </p>
            <q-banner v-if="veiculo" class="bg-blue-1 q-mb-md" rounded>
              <strong>{{ veiculo.placa }} — {{ veiculo.marca }} {{ veiculo.modelo }}</strong>
              <div class="text-caption">
                RENAVAM: {{ veiculo.renavam }}<br />Chassi: {{ veiculo.chassi || 'Não cadastrado' }}
              </div>
            </q-banner>
            <q-banner v-else-if="!solicitacaoPendente" class="bg-blue-1 q-mb-md" rounded>
              Ao enviar o CRLV, o veículo será salvo e vinculado ao motorista. Ele aparecerá na
              lista de veículos com o status em análise até a aprovação do documento.
            </q-banner>
            <q-banner v-if="!substituicaoPermitida" class="bg-amber-1 q-mb-md" rounded>
              Pela regra do sistema, o CRLV só pode ser substituído quando seu exercício for
              anterior a {{ anoAtual }}. O documento atual está disponível para consulta.
            </q-banner>
            <q-file
              v-model="arquivo"
              outlined
              clearable
              :label="anexoSalvoAtivo ? 'Arquivo atual' : 'Selecione o CRLV'"
              :readonly="anexoSalvoAtivo || solicitacaoPendente"
              :stack-label="anexoSalvoAtivo"
              :display-value="anexoSalvoAtivo ? nomeSalvo : undefined"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              :max-file-size="2097152"
              :disable="lendo || ocupado || !substituicaoPermitida || !pode('documentos.analisar')"
              :rules="anexoSalvoAtivo ? undefined : [(v) => !!v || 'Selecione um arquivo']"
              :error="!!errors.arquivo"
              :error-message="errors.arquivo?.[0]"
              :hint="
                solicitacaoPendente
                  ? 'Arquivo enviado pelo aplicativo'
                  : anexoSalvoAtivo
                    ? 'Remova o documento atual para selecionar um novo arquivo.'
                    : 'PDF, JPG ou PNG de até 2 MB'
              "
              @rejected="arquivoRejeitado"
            >
              <template #prepend><q-icon name="upload_file" /></template>
              <template v-if="anexoSalvoAtivo && !solicitacaoPendente" #append
                ><q-btn
                  flat
                  dense
                  round
                  color="grey-6"
                  icon="cancel"
                  aria-label="Remover documento atual"
                  :disable="
                    lendo || ocupado || !substituicaoPermitida || !pode('documentos.analisar')
                  "
                  @click.stop.prevent="removerAnexo"
                  ><q-tooltip>Remover documento atual</q-tooltip></q-btn
                ></template
              >
            </q-file>
            <div v-if="!anexoSalvoAtivo" class="text-caption text-grey-7 q-mt-sm">
              Para fotos, enquadre o documento inteiro, de frente, com boa iluminação e sem
              reflexos. Os textos e o QR Code devem estar legíveis.
            </div>
            <q-banner
              v-if="resultado && !lendo"
              role="status"
              rounded
              class="q-mt-md"
              :class="resultado.reconhecidos ? 'bg-blue-1 text-primary' : 'bg-amber-1'"
              >{{ resultado.mensagem }}</q-banner
            >
            <div
              role="group"
              aria-label="Campos do CRLV"
              :aria-busy="lendo"
              class="relative-position q-mt-md"
            >
              <div class="row q-col-gutter-md">
                <div
                  v-for="campo in campos"
                  :key="campo.name"
                  :class="campo.class || 'col-12 col-sm-6'"
                >
                  <q-input
                    v-model="dados[campo.name]"
                    @update:model-value="editados.add(campo.name)"
                    outlined
                    :label="campo.label"
                    :type="campo.type || 'text'"
                    :stack-label="campo.type === 'date'"
                    :autogrow="campo.type === 'textarea'"
                    :maxlength="campo.maxlength"
                    :disable="lendo || ocupado"
                    :readonly="!substituicaoPermitida || !pode('documentos.analisar')"
                    :rules="campo.rules"
                    :hint="campo.hint"
                    :error="!!errors[`informacoes_complementares.${campo.name}`]"
                    :error-message="errors[`informacoes_complementares.${campo.name}`]?.[0]"
                    hide-bottom-space
                  />
                </div>
                <div v-if="documento?.status === 'reprovado'" class="col-12">
                  <q-input
                    outlined
                    readonly
                    type="textarea"
                    autogrow
                    label="Motivo da reprovação"
                    :model-value="documento.motivo_reprovacao_texto || 'Motivo não informado.'"
                  />
                </div>
              </div>
              <q-inner-loading v-if="lendo" showing
                ><div class="column items-center text-primary q-pa-md">
                  <q-spinner size="40px" />
                  <div class="q-mt-sm text-center" role="status">{{ progresso }}</div>
                </div></q-inner-loading
              >
            </div>
            <q-banner
              v-if="foto && !lendo"
              rounded
              class="bg-amber-1 q-mt-md"
              aria-label="Conferência da foto do CRLV"
            >
              <div class="text-subtitle2">Autenticidade não confirmada</div>
              <div class="q-mt-xs">
                A leitura da foto preenche os campos, mas não comprova a origem do documento. O CRLV
                será enviado para análise e precisa de conferência manual antes da aprovação.
              </div>
              <div v-for="item in verificacoes" :key="item.campo" class="q-mt-sm">
                <q-icon
                  :name="item.confere ? 'check_circle' : 'warning'"
                  :color="item.confere ? 'positive' : 'warning'"
                />
                {{ item.label }}: {{ item.mensagem }}
              </div>
            </q-banner>
            <div v-if="veiculo" class="q-mt-lg" aria-label="Conferência do veículo">
              <div class="text-subtitle2 q-mb-sm">Conferência com o cadastro</div>
              <div v-for="item in conferencia" :key="item.name" class="q-mb-sm">
                <q-icon
                  :name="
                    item.status === 'confere'
                      ? 'check_circle'
                      : item.status === 'divergente'
                        ? 'error'
                        : 'info'
                  "
                  :color="
                    item.status === 'confere'
                      ? 'positive'
                      : item.status === 'divergente'
                        ? 'negative'
                        : 'grey'
                  "
                />
                {{ item.name.toUpperCase() }}: {{ textosConferencia[item.status] }}
                <div v-if="item.status === 'divergente'" class="text-caption text-negative">
                  Cadastro: {{ item.cadastro }} · Documento: {{ item.documento }}
                </div>
              </div>
              <div class="text-caption text-grey-7">
                Confira a prévia antes de aprovar. A correspondência dos dados não confirma a
                autenticidade do documento.
              </div>
            </div>
          </section>
          <section class="col-12 col-md-7 q-pa-md bg-grey-2 previa-crlv">
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle1 text-weight-medium">Prévia do documento</div>
              <q-space /><q-btn
                v-if="previewUrl"
                flat
                dense
                no-caps
                icon="open_in_new"
                label="Abrir arquivo"
                :href="previewUrl"
                target="_blank"
                rel="noopener noreferrer"
              />
            </div>
            <iframe
              v-if="previewUrl && pdf"
              :src="previewUrl"
              title="Prévia do CRLV"
              class="crlv-preview"
            />
            <div v-else-if="previewUrl" class="crlv-preview flex flex-center">
              <img :src="previewUrl" alt="Prévia do CRLV" />
            </div>
            <div v-else class="crlv-preview column flex-center text-grey-7">
              <q-icon name="picture_as_pdf" size="64px" class="q-mb-md" /><span
                >Selecione um arquivo para visualizar a prévia.</span
              >
            </div>
          </section>
        </div>
        <q-separator />
        <q-card-actions align="right" class="q-pa-md">
          <AcoesAnaliseDocumento
            :documento="documento"
            v-model:loading="analisando"
            :disable="
              ocupado ||
              lendo ||
              removido ||
              !!arquivo ||
              (!solicitacaoPendente && (editados.size > 0 || dadosAlterados))
            "
            :before-approve="solicitacaoPendente ? prepararAprovacao : undefined"
            @updated="onAnaliseUpdated"
          />
          <q-space />
          <q-btn flat label="Cancelar" :disable="ocupado" v-close-popup />
          <q-btn
            color="primary"
            type="submit"
            label="Enviar"
            v-if="pode('documentos.analisar') && !solicitacaoPendente"
            :loading="enviando"
            :disable="
              ocupado ||
              (!arquivo && !solicitacaoPendente) ||
              !motoristaId ||
              lendo ||
              conferenciaInvalida ||
              !substituicaoPermitida
            "
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { extrairCrlv } from 'src/utils/extrairCrlv'
import { compararCrlv, conferirDadosCrlv } from 'src/utils/crlv'
import AcoesAnaliseDocumento from 'src/components/motorista/AcoesAnaliseDocumento.vue'
const props = defineProps({
  modelValue: Boolean,
  motoristaId: [String, Number],
  origem: { type: String, default: 'documentos' },
  documento: Object,
  veiculos: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const documentoNavegado = ref(null)
const novoVeiculo = ref(false)
const documento = computed(() =>
  novoVeiculo.value ? null : documentoNavegado.value || props.documento,
)
const solicitacaoPendente = computed(
  () => !!documento.value?.solicitacao_veiculo && !documento.value?.veiculo_id,
)
const formulario = ref(null)
const dadosOriginais = ref({})
const dados = ref({}),
  arquivo = ref(null),
  veiculoId = ref(null),
  removido = ref(false),
  lendo = ref(false),
  enviando = ref(false),
  resultado = ref(null),
  errors = ref({}),
  progresso = ref('Lendo o CRLV…'),
  urlLocal = ref('')
const analisando = ref(false)
const ocupado = computed(() => enviando.value || analisando.value)
const documentosCrlv = computed(() =>
  (solicitacaoPendente.value ? [] : props.veiculos)
    .map((veiculo) => {
      const atual =
        String(props.documento?.veiculo_id) === String(veiculo.id)
          ? props.documento
          : veiculo.ultimo_crlv
      return atual?.id
        ? { ...atual, tipo_documento: 'crlv', veiculo_id: veiculo.id, veiculo }
        : null
    })
    .filter(Boolean),
)
const indiceDocumento = computed(() =>
  documentosCrlv.value.findIndex((doc) => String(doc.veiculo_id) === String(veiculoId.value)),
)
const opcoesPlacas = computed(() =>
  documentosCrlv.value.map((doc) => {
    const status = doc.veiculo.status || doc.status
    const situacao = {
      aprovado: { color: 'green', statusLabel: 'Aprovado' },
      reprovado: { color: 'red', statusLabel: 'Reprovado' },
      em_analise: { color: 'orange', statusLabel: 'Em análise' },
    }[status] || { color: 'grey', statusLabel: 'Não enviado' }
    return { label: doc.veiculo.placa, value: String(doc.veiculo_id), ...situacao }
  }),
)
const editados = reactive(new Set())
const extraidos = new Map()
let controller
const anoAtual = new Date().getFullYear()
const substituicaoPermitida = computed(() => {
  if (!documento.value?.id || !documento.value.veiculo_id || documento.value.status === 'reprovado')
    return true
  const exercicio = Number(
    documento.value.informacoes_complementares?.exercicio ?? documento.value.veiculo?.exercicio,
  )
  return exercicio >= 1900 && exercicio < anoAtual
})
const veiculo = computed(
  () =>
    props.veiculos.find((v) => v.id === veiculoId.value) ||
    (documento.value?.veiculo?.id === veiculoId.value ? documento.value.veiculo : null),
)
const anexoSalvoAtivo = computed(() => !removido.value && !!documento.value?.url)
const previewUrl = computed(
  () => urlLocal.value || (anexoSalvoAtivo.value ? documento.value.url : ''),
)
const pdf = computed(() =>
  arquivo.value
    ? arquivo.value.type === 'application/pdf' || /\.pdf$/i.test(arquivo.value.name)
    : anexoSalvoAtivo.value &&
      (documento.value.mime_type === 'application/pdf' ||
        documento.value.type === 'pdf' ||
        /\.pdf(?:[?#]|$)/i.test(documento.value.url)),
)
const nomeSalvo = computed(() => {
  if (documento.value?.name) return documento.value.name
  try {
    return (
      decodeURIComponent(new URL(documento.value.url).pathname.split('/').pop()) || 'CRLV salvo'
    )
  } catch {
    return 'CRLV salvo'
  }
})
const foto = computed(() => !!previewUrl.value && !pdf.value)
const verificacoes = computed(() => conferirDadosCrlv(dados.value))
const conferencia = computed(() => compararCrlv(veiculo.value, dados.value))
const conferenciaInvalida = computed(
  () =>
    !!veiculo.value &&
    conferencia.value.some((item) => ['divergente', 'nao_informado'].includes(item.status)),
)
const textosConferencia = {
  confere: 'Confere',
  divergente: 'Divergente',
  nao_cadastrado: 'Não cadastrado no veículo',
  nao_informado: 'Não informado no documento',
}
const obrigatorio = (v) => !!String(v || '').trim() || 'Campo obrigatório'
const obrigatorioCadastro = (v) => !!veiculoId.value || obrigatorio(v)
const campos = [
  { name: 'placa', label: 'Placa no CRLV', maxlength: 8, rules: [obrigatorio] },
  { name: 'renavam', label: 'RENAVAM no CRLV', maxlength: 11, rules: [obrigatorio] },
  { name: 'chassi', label: 'Chassi no CRLV', maxlength: 17, class: 'col-12', rules: [obrigatorio] },
  { name: 'numero_crv', label: 'Número do CRV', maxlength: 20 },
  { name: 'codigo_seguranca', label: 'Código de segurança do CLA', maxlength: 20 },
  { name: 'exercicio', label: 'Exercício do licenciamento', type: 'number', rules: [obrigatorio] },
  { name: 'data_emissao', label: 'Data de emissão', type: 'date' },
  { name: 'nome_proprietario', label: 'Nome do proprietário', class: 'col-12', maxlength: 255 },
  {
    name: 'cpf_cnpj_proprietario',
    label: 'CPF/CNPJ do proprietário',
    rules: [
      obrigatorio,
      (v) =>
        /^(?:\d{11}|\d{14})$/.test(String(v || '').replace(/\D/g, '')) ||
        'Informe um CPF ou CNPJ válido.',
    ],
    hint: 'Informe o CPF ou CNPJ do proprietário impresso no CRLV. O proprietário pode ser outra pessoa ou empresa.',
    maxlength: 18,
    class: 'col-12',
  },
  {
    name: 'marca_modelo',
    label: 'Marca/modelo/versão no CRLV',
    class: 'col-12',
    maxlength: 255,
    rules: [obrigatorioCadastro],
    hint: 'Ex.: HYUNDAI/HB20 COMFORT',
  },
  {
    name: 'categoria_veiculo',
    label: 'Tipo do veículo',
    maxlength: 20,
    hint: 'carro, moto ou bicicleta',
    rules: [obrigatorioCadastro],
  },
  {
    name: 'ano_fabricacao',
    label: 'Ano de fabricação',
    type: 'number',
    rules: [obrigatorioCadastro],
  },
  { name: 'ano_modelo', label: 'Ano do modelo', type: 'number', rules: [obrigatorioCadastro] },
  { name: 'cor', label: 'Cor no CRLV', maxlength: 40, rules: [obrigatorioCadastro] },
  { name: 'categoria', label: 'Categoria no CRLV', maxlength: 60 },
  { name: 'uf', label: 'UF', maxlength: 2, rules: [obrigatorioCadastro] },
  {
    name: 'observacao',
    label: 'Observações do CRLV',
    type: 'textarea',
    class: 'col-12',
    maxlength: 5000,
  },
]
function cancelar() {
  controller?.abort()
  controller = null
  lendo.value = false
}
function limparUrl() {
  if (urlLocal.value) URL.revokeObjectURL(urlLocal.value)
  urlLocal.value = ''
}
const dadosAlterados = computed(() =>
  campos.some(
    (campo) =>
      String(dados.value[campo.name] ?? '') !== String(dadosOriginais.value[campo.name] ?? ''),
  ),
)

function iniciar() {
  novoVeiculo.value = false
  documentoNavegado.value = null
  carregarDocumento()
}
function carregarDocumento() {
  cancelar()
  arquivo.value = null
  limparUrl()
  removido.value = false
  errors.value = {}
  resultado.value = null
  editados.clear()
  extraidos.clear()
  veiculoId.value = documento.value?.veiculo_id || null
  dados.value = Object.fromEntries(
    campos.map((c) => [
      c.name,
      (Object.hasOwn(documento.value?.informacoes_complementares || {}, c.name)
        ? documento.value.informacoes_complementares[c.name]
        : documento.value?.veiculo?.[
            c.name === 'categoria'
              ? 'categoria_crlv'
              : c.name === 'categoria_veiculo'
                ? 'categoria'
                : c.name
          ]) ?? '',
    ]),
  )
  dadosOriginais.value = { ...dados.value }
  const documentoId = documento.value?.id
  nextTick(() => {
    formulario.value?.resetValidation()
    if (model.value && solicitacaoPendente.value && documentoId === documento.value?.id) {
      void lerArquivoSolicitacao()
    }
  })
}
function navegarCrlv(id) {
  if (ocupado.value || lendo.value || String(id) === String(veiculoId.value)) return
  const destino = documentosCrlv.value.find((doc) => String(doc.veiculo_id) === String(id))
  if (!destino) return
  trocarDocumento(destino)
}
function iniciarNovoVeiculo() {
  if (ocupado.value || lendo.value || novoVeiculo.value) return
  trocarDocumento(null, true)
}
function trocarDocumento(destino, cadastrarNovo = false) {
  const trocar = () => {
    novoVeiculo.value = cadastrarNovo
    documentoNavegado.value = destino
    carregarDocumento()
  }
  const alterado =
    arquivo.value ||
    removido.value ||
    campos.some(
      (campo) =>
        String(dados.value[campo.name] ?? '') !== String(dadosOriginais.value[campo.name] ?? ''),
    )
  if (alterado) {
    $q.dialog({
      title: 'Trocar CRLV',
      message: cadastrarNovo
        ? 'Há alterações não enviadas. Deseja descartá-las para cadastrar outro veículo?'
        : 'Há alterações não enviadas. Deseja descartá-las para abrir outro CRLV?',
      cancel: { label: 'Continuar editando', flat: true },
      ok: { label: 'Descartar alterações', color: 'primary' },
      persistent: true,
    }).onOk(trocar)
  } else {
    trocar()
  }
}
function fechar() {
  cancelar()
  limparUrl()
  arquivo.value = null
}
function removerAnexo() {
  if (lendo.value || ocupado.value || !substituicaoPermitida.value) return
  removido.value = true
  errors.value = {}
}
function restaurarExtraidos() {
  for (const [name, { anterior, valor }] of extraidos) {
    if (!editados.has(name) && dados.value[name] === valor) dados.value[name] = anterior
  }
  extraidos.clear()
}
async function analisarArquivo(file, current) {
  const anteriores = { ...dados.value }
  try {
    const leitura = await extrairCrlv(file, current.signal, (message) => {
      if (controller === current) progresso.value = message
    })
    if (controller !== current || current.signal.aborted) return
    let preenchidos = 0
    for (const [name, value] of Object.entries(leitura.dados)) {
      const atual = dados.value[name] ?? ''
      const anterior = anteriores[name] ?? ''
      // Clearing a field must let the replacement file fill it again.
      // Keep nonempty manual corrections when the document is replaced.
      if ((!editados.has(name) || !String(atual).trim()) && atual === anterior) {
        extraidos.set(name, { anterior: anteriores[name], valor: value })
        editados.delete(name)
        dados.value[name] = value
        preenchidos++
      }
    }
    for (const name of leitura.conflitos || []) {
      if (!editados.has(name)) {
        extraidos.set(name, { anterior: anteriores[name], valor: '' })
        dados.value[name] = ''
      }
    }
    const reconhecidos = Object.keys(leitura.dados).length
    resultado.value = {
      preenchidos,
      reconhecidos,
      mensagem: leitura.conflitos?.length
        ? 'A leitura encontrou informações divergentes. Confira a prévia e preencha os campos em branco.'
        : preenchidos
          ? `${preenchidos} campos preenchidos a partir do ${leitura.usouOcr ? 'documento por leitura da imagem' : 'PDF'}. Confira os dados antes de enviar.`
          : reconhecidos
            ? `${reconhecidos} campos reconhecidos. Os dados que você editou foram mantidos. Confira os campos antes de enviar.`
            : 'Não foi possível reconhecer os campos. Confira o documento e preencha os dados manualmente.',
    }
  } catch {
    if (controller === current && !current.signal.aborted)
      resultado.value = {
        preenchidos: 0,
        reconhecidos: 0,
        mensagem: 'Não foi possível ler o CRLV. Confira a prévia e preencha os campos manualmente.',
      }
  } finally {
    if (controller === current) {
      controller = null
      lendo.value = false
    }
  }
}
watch(arquivo, async (file) => {
  cancelar()
  limparUrl()
  restaurarExtraidos()
  resultado.value = null
  errors.value = {}
  if (!file) return
  removido.value = true
  urlLocal.value = URL.createObjectURL(file)
  const current = new AbortController()
  controller = current
  lendo.value = true
  progresso.value = 'Lendo o CRLV…'
  await analisarArquivo(file, current)
})
onUnmounted(fechar)
function arquivoRejeitado(rejections) {
  $q.notify({
    type: 'negative',
    message: rejections.some(
      (r) => r.failedPropValidation === 'max-file-size' || r.failedPropValidation === 'maxFileSize',
    )
      ? 'O arquivo ultrapassa o limite de 2 MB.'
      : 'Selecione PDF, JPG ou PNG de até 2 MB.',
  })
}
async function enviar() {
  if (solicitacaoPendente.value) return
  if (
    !arquivo.value ||
    !props.motoristaId ||
    lendo.value ||
    ocupado.value ||
    conferenciaInvalida.value ||
    !substituicaoPermitida.value
  )
    return
  enviando.value = true
  errors.value = {}
  const form = new FormData()
  form.append('arquivo', arquivo.value)
  form.append('motorista_id', props.motoristaId)
  form.append('tipo_documento', documento.value?.tipo_documento || 'crlv')
  form.append('origem', novoVeiculo.value ? 'veiculos' : props.origem)
  if (veiculoId.value) form.append('veiculo_id', veiculoId.value)
  for (const [name, value] of Object.entries(dados.value))
    form.append(`informacoes_complementares[${name}]`, value ?? '')
  try {
    const response = await api.post('/motorista-documentos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    $q.notify({ type: 'positive', message: response.data.message })
    emit('updated')
    model.value = false
  } catch (error) {
    errors.value = error.response?.data?.errors || {}
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível enviar o CRLV.',
    })
  } finally {
    enviando.value = false
  }
}

async function lerArquivoSolicitacao() {
  if (!solicitacaoPendente.value || !documento.value?.url || lendo.value || ocupado.value) return
  const registro = documento.value
  const current = new AbortController()
  controller = current
  lendo.value = true
  progresso.value = 'Carregando o CRLV…'
  try {
    const response = await api.put(
      `/motorista-documentos/${registro.id}`,
      { leitura_automatica: true },
      { signal: current.signal, timeout: 120000 },
    )
    if (
      controller !== current ||
      current.signal.aborted ||
      !model.value ||
      documento.value?.id !== registro.id
    )
      return
    const salvos = response.data.data.informacoes_complementares || {}
    for (const campo of campos) {
      if (Object.hasOwn(salvos, campo.name)) dados.value[campo.name] = salvos[campo.name] ?? ''
    }
    dadosOriginais.value = { ...dados.value }
    editados.clear()
  } catch {
    if (controller === current && !current.signal.aborted) {
      resultado.value = {
        reconhecidos: 0,
        preenchidos: 0,
        mensagem:
          'Não foi possível carregar os dados do CRLV. Confira a prévia e complete os campos antes de aprovar.',
      }
    }
  } finally {
    if (controller === current) {
      controller = null
      lendo.value = false
    }
  }
}

async function prepararAprovacao() {
  if (lendo.value || !(await formulario.value?.validate())) return false
  errors.value = {}
  // A aprovação usa o que está visível no formulário; correções são salvas antes dela.
  if (dadosAlterados.value) {
    try {
      await api.put(`/motorista-documentos/${documento.value.id}`, {
        informacoes_complementares: dados.value,
      })
      dadosOriginais.value = { ...dados.value }
      editados.clear()
    } catch (error) {
      errors.value = error.response?.data?.errors || {}
      $q.notify({
        type: 'negative',
        message:
          error.response?.data?.message || 'Não foi possível salvar os dados para aprovação.',
      })
      return false
    }
  }
  return true
}

function onAnaliseUpdated() {
  emit('updated')
  model.value = false
}
</script>

<style scoped>
.crlv-dialog {
  width: 1280px;
  max-width: 95vw;
}
.dados-crlv {
  max-height: 75vh;
  overflow-y: auto;
}
.crlv-seletor-placa {
  width: 112px;
  min-width: 92px;
  flex: 1 1 112px;
}
.crlv-seletor-placa :deep(.q-field__append) {
  padding-left: 0;
}
.crlv-controles {
  gap: 8px;
}
.crlv-navegacao-botao {
  width: 112px;
  height: 36px;
  padding: 4px;
  font-size: 12px;
  flex-shrink: 0;
}
.crlv-navegacao-botao :deep(.q-btn__content) {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.crlv-navegacao-botao :deep(.q-icon) {
  font-size: 18px;
}
.crlv-navegacao-botao :deep(.on-left) {
  margin-right: 4px;
}
.crlv-status-ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.previa-crlv {
  border-left: 1px solid #ddd;
}
.crlv-preview {
  width: 100%;
  height: 66vh;
  min-height: 380px;
  border: 0;
  overflow: auto;
}
.crlv-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
@media (max-width: 1279px) {
  .dados-crlv {
    width: 100%;
    max-height: none;
  }
  .previa-crlv {
    width: 100%;
    border-left: 0;
    border-top: 1px solid #ddd;
  }
  .crlv-preview {
    height: 55vh;
    min-height: 300px;
  }
}
@media (max-width: 520px) {
  .crlv-controles {
    display: grid;
    grid-template-columns: 112px minmax(112px, 1fr);
  }
  .crlv-seletor-placa {
    width: 100%;
  }
  .crlv-novo-veiculo {
    justify-self: end;
  }
}
</style>
