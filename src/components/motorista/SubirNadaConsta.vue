<template>
  <q-dialog v-model="model" persistent @before-show="iniciar" @hide="fechar">
    <q-card class="nada-consta-dialog">
      <q-toolbar>
        <q-toolbar-title class="text-weight-bold">{{
          documento?.status === 'reprovado' ? 'Reenviar Nada Consta' : 'Nada Consta'
        }}</q-toolbar-title>
        <q-btn flat round dense icon="close" aria-label="Fechar" :disable="ocupado" v-close-popup />
      </q-toolbar>
      <q-separator />
      <q-form @submit.prevent="enviar">
        <div class="row">
          <section class="col-12 col-md-5 q-pa-lg dados-certidao">
            <div class="text-h6">Dados da certidão</div>
            <p class="text-grey-7 q-mt-xs">
              Confira os dados e o resultado com o documento ao lado antes de enviar. Os campos são
              preenchidos pelo arquivo e não podem ser alterados.
            </p>
            <q-file
              v-model="arquivo"
              outlined
              clearable
              :label="anexoSalvoAtivo ? 'Arquivo atual' : 'Selecione o Nada Consta'"
              :readonly="anexoSalvoAtivo"
              :stack-label="anexoSalvoAtivo"
              :display-value="anexoSalvoAtivo ? nomeSalvo : undefined"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              :max-file-size="2097152"
              :disable="lendo || ocupado || !pode('documentos.analisar')"
              :rules="anexoSalvoAtivo ? undefined : [(v) => !!v || 'Selecione um arquivo']"
              :error="!!errors.arquivo"
              :error-message="errors.arquivo?.[0]"
              :hint="
                anexoSalvoAtivo
                  ? 'Remova o documento atual para selecionar um novo arquivo.'
                  : 'PDF, JPG ou PNG de até 2 MB'
              "
              @rejected="arquivoRejeitado"
            >
              <template #prepend><q-icon name="upload_file" /></template>
              <template v-if="anexoSalvoAtivo" #append>
                <q-btn
                  flat
                  dense
                  round
                  color="grey-6"
                  icon="cancel"
                  aria-label="Remover documento atual"
                  :disable="lendo || ocupado || !pode('documentos.analisar')"
                  @click.stop.prevent="removerAnexo"
                >
                  <q-tooltip>Remover documento atual</q-tooltip>
                </q-btn>
              </template>
            </q-file>
            <q-banner
              v-if="resultado && !lendo"
              role="status"
              rounded
              class="q-mt-md"
              :class="resultado.invalido ? 'bg-amber-1' : 'bg-blue-1 text-primary'"
              >{{ resultado.mensagem }}</q-banner
            >
            <div
              role="group"
              aria-label="Campos do Nada Consta"
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
                    :model-value="dados[campo.name]"
                    outlined
                    readonly
                    :label="campo.label"
                    :type="campo.type || 'text'"
                    :stack-label="['date', 'time'].includes(campo.type)"
                    :autogrow="campo.type === 'textarea'"
                    :maxlength="campo.maxlength"
                    :disable="lendo || ocupado || !pode('documentos.analisar')"
                    :rules="campo.rules"
                    :hint="campo.hint"
                    :mask="campo.mask"
                    :unmasked-value="!!campo.mask"
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
              <q-inner-loading v-if="lendo" showing>
                <div class="column items-center text-primary q-pa-md">
                  <q-spinner size="40px" />
                  <div class="q-mt-sm text-center" role="status">{{ progresso }}</div>
                </div>
              </q-inner-loading>
            </div>
            <q-banner v-if="vencida" rounded class="bg-amber-1 q-mt-md"
              >A data de validade informada já passou. Confira a certidão antes de enviar.</q-banner
            >
            <q-banner rounded class="bg-blue-1 q-mt-lg">
              <div class="text-subtitle2">Conferência na Polícia Federal</div>
              <div class="q-mt-xs">
                Para certidões da Polícia Federal, copie o número e confira a autenticidade no site
                oficial. A leitura dos campos não confirma a autenticidade. O documento será enviado
                para análise.
              </div>
              <div class="row q-gutter-sm q-mt-sm">
                <q-btn
                  flat
                  dense
                  no-caps
                  icon="content_copy"
                  label="Copiar número"
                  :disable="!dados.numero_certidao || lendo || ocupado"
                  @click="copiarNumero"
                />
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="open_in_new"
                  label="Validar na Polícia Federal"
                  :href="URL_VALIDACAO_PF"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </div>
            </q-banner>
          </section>
          <section class="col-12 col-md-7 q-pa-md bg-grey-2 previa-certidao">
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle1 text-weight-medium">Prévia do documento</div>
              <q-space />
              <q-btn
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
              title="Prévia do Nada Consta"
              class="certidao-preview"
            />
            <div v-else-if="previewUrl" class="certidao-preview flex flex-center">
              <img :src="previewUrl" alt="Prévia do Nada Consta" />
            </div>
            <div v-else class="certidao-preview column flex-center text-grey-7">
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
            :disable="ocupado || lendo || removido || !!arquivo"
            @updated="onAnaliseUpdated"
          />
          <q-space />
          <q-btn flat label="Cancelar" :disable="ocupado" v-close-popup />
          <q-btn
            color="primary"
            type="submit"
            label="Enviar"
            v-if="pode('documentos.analisar')"
            :loading="enviando"
            :disable="ocupado || !podeEnviar"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { computed, onUnmounted, ref, watch } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { extrairNadaConsta } from 'src/utils/extrairNadaConsta'
import { URL_VALIDACAO_PF } from 'src/utils/nadaConsta'
import AcoesAnaliseDocumento from 'src/components/motorista/AcoesAnaliseDocumento.vue'

const props = defineProps({ modelValue: Boolean, motoristaId: [String, Number], documento: Object })
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const dados = ref({}),
  arquivo = ref(null),
  removido = ref(false),
  lendo = ref(false),
  enviando = ref(false),
  resultado = ref(null),
  errors = ref({}),
  progresso = ref('Lendo a certidão…'),
  urlLocal = ref('')
const analisando = ref(false)
const ocupado = computed(() => enviando.value || analisando.value)
let controller
const anexoSalvoAtivo = computed(() => !removido.value && !!props.documento?.url)
const previewUrl = computed(
  () => urlLocal.value || (anexoSalvoAtivo.value ? props.documento.url : ''),
)
const pdf = computed(() =>
  arquivo.value
    ? arquivo.value.type === 'application/pdf' || /\.pdf$/i.test(arquivo.value.name)
    : anexoSalvoAtivo.value &&
      (props.documento.mime_type === 'application/pdf' ||
        props.documento.type === 'pdf' ||
        /\.pdf(?:[?#]|$)/i.test(props.documento.url)),
)
const nomeSalvo = computed(() => props.documento?.name || 'Nada Consta salvo')
const vencida = computed(
  () =>
    !!dados.value.data_validade &&
    dados.value.data_validade < new Date().toLocaleDateString('sv-SE'),
)
const obrigatorio = (value) => !!String(value || '').trim() || 'Campo obrigatório'
const campos = [
  { name: 'numero_certidao', label: 'Número da certidão', maxlength: 100, rules: [obrigatorio] },
  { name: 'orgao_emissor', label: 'Órgão emissor', maxlength: 255, rules: [obrigatorio] },
  {
    name: 'nome',
    label: 'Nome na certidão',
    class: 'col-12',
    maxlength: 255,
    rules: [obrigatorio],
  },
  { name: 'nome_pai', label: 'Nome do pai', class: 'col-12', maxlength: 255 },
  { name: 'nome_mae', label: 'Nome da mãe', class: 'col-12', maxlength: 255 },
  {
    name: 'cpf',
    label: 'CPF na certidão',
    mask: '###.###.###-##',
    rules: [
      obrigatorio,
      (v) => /^\d{11}$/.test(String(v).replace(/\D/g, '')) || 'Informe os 11 dígitos do CPF',
    ],
  },
  { name: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
  { name: 'data_emissao', label: 'Data de emissão', type: 'date', rules: [obrigatorio] },
  {
    name: 'hora_emissao',
    label: 'Horário de emissão',
    type: 'time',
    hint: 'Horário impresso na certidão.',
  },
  {
    name: 'data_validade',
    label: 'Data de validade',
    type: 'date',
    rules: [obrigatorio],
    hint: 'Na certidão da PF, calculada a partir da emissão: 90 dias.',
  },
  {
    name: 'resultado',
    label: 'Resultado declarado na certidão',
    type: 'textarea',
    class: 'col-12',
    maxlength: 5000,
    rules: [obrigatorio],
  },
]
const dadosCompletos = computed(
  () =>
    campos
      .filter((campo) => campo.rules?.includes(obrigatorio))
      .every((campo) => !!String(dados.value[campo.name] || '').trim()) &&
    /^\d{11}$/.test(dados.value.cpf || ''),
)
const podeEnviar = computed(
  () => !!arquivo.value && !lendo.value && dadosCompletos.value && !resultado.value?.invalido,
)
function limparDados() {
  dados.value = Object.fromEntries(campos.map((campo) => [campo.name, '']))
}
function cancelar() {
  controller?.abort()
  controller = null
  lendo.value = false
}
function limparUrl() {
  if (urlLocal.value) URL.revokeObjectURL(urlLocal.value)
  urlLocal.value = ''
}
function iniciar() {
  cancelar()
  limparUrl()
  arquivo.value = null
  removido.value = false
  errors.value = {}
  resultado.value = null
  dados.value = Object.fromEntries(
    campos.map((c) => [c.name, props.documento?.informacoes_complementares?.[c.name] ?? '']),
  )
}
function fechar() {
  cancelar()
  limparUrl()
  arquivo.value = null
}
function removerAnexo() {
  if (lendo.value || ocupado.value) return
  removido.value = true
  errors.value = {}
  resultado.value = null
  limparDados()
}
watch(arquivo, async (file) => {
  cancelar()
  limparUrl()
  resultado.value = null
  errors.value = {}
  if (!file) {
    if (!anexoSalvoAtivo.value) limparDados()
    return
  }
  removido.value = true
  limparDados()
  urlLocal.value = URL.createObjectURL(file)
  const current = new AbortController()
  controller = current
  lendo.value = true
  try {
    const leitura = await extrairNadaConsta(file, current.signal, (message) => {
      if (controller === current) progresso.value = message
    })
    if (controller !== current || current.signal.aborted) return
    let preenchidos = 0
    for (const [name, value] of Object.entries(leitura.dados)) {
      if (!campos.some((c) => c.name === name)) continue
      dados.value[name] = value
      preenchidos++
    }
    const reconhecidos = Object.keys(leitura.dados).length
    resultado.value = {
      reconhecidos,
      invalido: !!leitura.conflitos?.length || !dadosCompletos.value,
      mensagem: leitura.conflitos?.length
        ? 'A leitura encontrou informações divergentes. Selecione um arquivo com uma única certidão legível.'
        : !dadosCompletos.value
          ? 'Não foi possível reconhecer todos os campos obrigatórios. Selecione o PDF original ou uma imagem mais legível.'
          : preenchidos
            ? `${preenchidos} campos preenchidos a partir ${leitura.usouOcr ? 'da leitura da imagem' : 'do PDF'}. Confira os dados antes de enviar.`
            : 'Não foi possível reconhecer os campos. Selecione o PDF original ou uma imagem mais legível.',
    }
  } catch {
    if (controller === current && !current.signal.aborted)
      resultado.value = {
        reconhecidos: 0,
        invalido: true,
        mensagem:
          'Não foi possível ler a certidão. Selecione o PDF original ou uma imagem mais legível.',
      }
  } finally {
    if (controller === current) {
      controller = null
      lendo.value = false
    }
  }
})
onUnmounted(fechar)
function arquivoRejeitado() {
  $q.notify({ type: 'negative', message: 'Selecione PDF, JPG ou PNG de até 2 MB.' })
}
async function copiarNumero() {
  try {
    await copyToClipboard(dados.value.numero_certidao)
    $q.notify({ type: 'positive', message: 'Número da certidão copiado.' })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Não foi possível copiar. Selecione e copie o número no campo.',
    })
  }
}
async function enviar() {
  if (!podeEnviar.value || ocupado.value) return
  enviando.value = true
  errors.value = {}
  const form = new FormData()
  form.append('arquivo', arquivo.value)
  form.append('motorista_id', props.motoristaId)
  form.append('tipo_documento', 'nada_consta')
  for (const campo of campos)
    form.append(`informacoes_complementares[${campo.name}]`, dados.value[campo.name] ?? '')
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
      message: error.response?.data?.message || 'Não foi possível enviar a certidão.',
    })
  } finally {
    enviando.value = false
  }
}

function onAnaliseUpdated() {
  emit('updated')
  model.value = false
}
</script>

<style scoped>
.nada-consta-dialog {
  width: 1280px;
  max-width: 95vw;
}
.dados-certidao {
  max-height: 75vh;
  overflow-y: auto;
}
.previa-certidao {
  border-left: 1px solid #ddd;
}
.certidao-preview {
  width: 100%;
  height: 66vh;
  min-height: 380px;
  border: 0;
  overflow: auto;
}
.certidao-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
@media (max-width: 1023px) {
  .dados-certidao {
    max-height: none;
  }
  .previa-certidao {
    border-left: 0;
    border-top: 1px solid #ddd;
  }
  .certidao-preview {
    height: 55vh;
    min-height: 300px;
  }
}
</style>
