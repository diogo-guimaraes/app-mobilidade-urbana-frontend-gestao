<template>
  <q-dialog v-model="aberto" :persistent="salvando" @before-show="carregar" @hide="limparFoto">
    <q-card class="formulario-gestor">
      <q-toolbar>
        <q-avatar rounded icon="manage_accounts" color="primary" text-color="white" />
        <q-toolbar-title class="text-weight-bold">{{ titulo }}</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar formulário do gestor"
          :disable="salvando"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />

      <q-card-section v-if="carregando" class="text-center q-pa-xl">
        <q-spinner color="primary" size="40px" />
        <div class="q-mt-sm">Carregando gestor...</div>
      </q-card-section>
      <q-card-section v-else-if="falhaCarregamento">
        <q-banner class="bg-red-1 text-negative">
          {{ falhaCarregamento }}
          <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
        </q-banner>
      </q-card-section>

      <q-form v-else @submit="salvar">
        <q-card-section class="conteudo-formulario">
          <div class="row justify-center q-mb-md">
            <q-avatar size="110px" color="primary" text-color="white">
              <img v-if="fotoPreview" :src="fotoPreview" alt="Foto do gestor" />
              <span v-else>{{ formulario.name?.charAt(0) || 'G' }}</span>
            </q-avatar>
          </div>
          <div v-if="!somenteLeitura" class="q-mb-md">
            <q-file
              v-model="imagem"
              dense
              outlined
              clearable
              label="Foto de perfil"
              accept=".jpg,.jpeg,.png,.webp"
              :max-file-size="5 * 1024 * 1024"
              :disable="salvando"
              :error="!!erros.image"
              :error-message="erros.image"
              @rejected="fotoRejeitada"
            >
              <template #prepend><q-icon name="photo_camera" /></template>
            </q-file>
            <q-btn
              v-if="fotoPreview"
              flat
              dense
              color="primary"
              label="Remover foto"
              class="q-mt-xs"
              :disable="salvando"
              @click="removerFoto"
            />
          </div>

          <div class="row q-col-gutter-md">
            <q-input
              class="col-12 col-sm-6"
              v-model="formulario.name"
              dense
              outlined
              label="Nome completo *"
              :readonly="somenteLeitura"
              :disable="salvando"
              maxlength="255"
              :rules="[(val) => val?.trim().length >= 3 || 'Informe o nome completo']"
              :error="!!erros.name"
              :error-message="erros.name"
            />
            <q-input
              class="col-12 col-sm-6"
              v-model="formulario.telefone"
              dense
              outlined
              label="Telefone"
              mask="(##) #####-####"
              unmasked-value
              :readonly="somenteLeitura"
              :disable="salvando"
              :rules="[(val) => !val || /^\d{10,11}$/.test(val) || 'Informe um telefone com DDD']"
              :error="!!erros.telefone"
              :error-message="erros.telefone"
            />
            <q-input
              class="col-12 col-sm-6"
              v-model="formulario.cpf"
              dense
              outlined
              label="CPF *"
              mask="###.###.###-##"
              unmasked-value
              :readonly="somenteLeitura"
              :disable="salvando"
              :rules="[(val) => /^\d{11}$/.test(val || '') || 'Informe os 11 dígitos do CPF']"
              :error="!!erros.cpf"
              :error-message="erros.cpf"
            />
            <q-input
              class="col-12 col-sm-6"
              v-model="formulario.data_nascimento"
              dense
              outlined
              label="Data de nascimento *"
              type="date"
              stack-label
              :readonly="somenteLeitura"
              :disable="salvando"
              :rules="[(val) => !!val || 'Informe a data de nascimento']"
              :error="!!erros.data_nascimento"
              :error-message="erros.data_nascimento"
            />
            <q-input
              class="col-12"
              v-model="formulario.email"
              dense
              outlined
              label="E-mail *"
              type="email"
              :readonly="somenteLeitura"
              :disable="salvando"
              maxlength="255"
              :rules="[(val) => !!val?.trim() || 'Informe o e-mail']"
              :error="!!erros.email"
              :error-message="erros.email"
            />
            <template v-if="!somenteLeitura">
              <q-input
                class="col-12 col-sm-6"
                v-model="formulario.password"
                dense
                outlined
                :label="gestorId ? 'Nova senha' : 'Senha *'"
                type="password"
                autocomplete="new-password"
                :hint="
                  gestorId
                    ? 'Deixe em branco para manter a senha atual.'
                    : 'Pelo menos 8 caracteres.'
                "
                :disable="salvando"
                :rules="[validarSenha]"
                maxlength="255"
                :error="!!erros.password"
                :error-message="erros.password"
              />
              <q-input
                class="col-12 col-sm-6"
                v-model="formulario.password_confirmation"
                dense
                outlined
                label="Confirmar senha"
                type="password"
                autocomplete="new-password"
                :disable="salvando"
                :rules="[
                  (val) =>
                    !formulario.password || val === formulario.password || 'As senhas não conferem',
                ]"
              />
            </template>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            :label="somenteLeitura ? 'Fechar' : 'Cancelar'"
            :disable="salvando"
            v-close-popup
          />
          <q-btn
            v-if="somenteLeitura && !arquivado"
            color="primary"
            icon="edit"
            label="Editar gestor"
            @click="somenteLeitura = false"
          />
          <q-btn
            v-if="!somenteLeitura"
            color="primary"
            icon="save"
            :label="gestorId ? 'Salvar alterações' : 'Criar gestor'"
            type="submit"
            :loading="salvando"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const props = defineProps({
  modelValue: Boolean,
  gestorId: { type: [Number, String], default: null },
  visualizar: Boolean,
})
const emit = defineEmits(['update:modelValue', 'saved'])
const $q = useQuasar()
const aberto = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
const formulario = reactive({
  name: '',
  telefone: '',
  cpf: '',
  data_nascimento: '',
  email: '',
  password: '',
  password_confirmation: '',
  foto: null,
})
const imagem = ref(null)
const fotoLocal = ref(null)
const removerImagem = ref(false)
const arquivado = ref(false)
const somenteLeitura = ref(false)
const carregando = ref(false)
const salvando = ref(false)
const erros = ref({})
const falhaCarregamento = ref('')
const titulo = computed(() =>
  !props.gestorId ? 'Criar gestor' : somenteLeitura.value ? 'Dados do gestor' : 'Editar gestor',
)
const fotoPreview = computed(
  () => fotoLocal.value || (!removerImagem.value && formulario.foto) || null,
)
let consulta = 0

watch(aberto, (valor) => {
  if (!valor) {
    consulta++
    carregando.value = false
  }
})

function limparFoto() {
  if (fotoLocal.value) URL.revokeObjectURL(fotoLocal.value)
  fotoLocal.value = null
}
watch(imagem, (arquivo) => {
  limparFoto()
  if (arquivo) {
    fotoLocal.value = URL.createObjectURL(arquivo)
    removerImagem.value = false
  }
})
onBeforeUnmount(limparFoto)

function removerFoto() {
  imagem.value = null
  removerImagem.value = true
}
function fotoRejeitada() {
  $q.notify({ type: 'warning', message: 'Selecione uma foto JPG, PNG ou WEBP de até 5 MB.' })
}
function validarSenha(val) {
  if (!val && props.gestorId) return true
  return val?.length >= 8 || 'Informe uma senha com pelo menos 8 caracteres'
}

async function carregar() {
  const atual = ++consulta
  somenteLeitura.value = props.visualizar
  imagem.value = null
  limparFoto()
  removerImagem.value = false
  arquivado.value = false
  erros.value = {}
  falhaCarregamento.value = ''
  carregando.value = false
  Object.assign(formulario, {
    name: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    email: '',
    password: '',
    password_confirmation: '',
    foto: null,
  })
  if (!props.gestorId) return
  carregando.value = true
  try {
    const { data } = await api.get(`gestores/${props.gestorId}`)
    if (atual !== consulta || !aberto.value) return
    for (const campo of ['name', 'telefone', 'cpf', 'data_nascimento', 'email', 'foto']) {
      formulario[campo] = data[campo] || ''
    }
    arquivado.value = !!data.deleted_at
  } catch (erro) {
    if (atual === consulta)
      falhaCarregamento.value =
        erro.response?.data?.message || 'Não foi possível carregar o gestor.'
  } finally {
    if (atual === consulta) carregando.value = false
  }
}

async function salvar() {
  if (salvando.value || somenteLeitura.value) return
  salvando.value = true
  erros.value = {}
  const dados = new FormData()
  for (const campo of ['name', 'telefone', 'cpf', 'data_nascimento', 'email']) {
    dados.append(campo, formulario[campo]?.trim() || '')
  }
  if (formulario.password) {
    dados.append('password', formulario.password)
    dados.append('password_confirmation', formulario.password_confirmation)
  }
  if (imagem.value) dados.append('image', imagem.value)
  dados.append('remover_foto', removerImagem.value ? '1' : '0')
  if (props.gestorId) dados.append('_method', 'PUT')
  try {
    const { data } = await api.post(
      props.gestorId ? `gestores/${props.gestorId}` : 'gestores',
      dados,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    )
    $q.notify({ type: 'positive', message: data.message })
    emit('saved', data.gestor)
    aberto.value = false
  } catch (erro) {
    const validacao = erro.response?.data?.errors || {}
    erros.value = Object.fromEntries(
      Object.entries(validacao).map(([campo, mensagens]) => [campo, mensagens[0]]),
    )
    $q.notify({
      type: 'negative',
      message: erro.response?.data?.message || 'Não foi possível salvar o gestor.',
    })
  } finally {
    salvando.value = false
  }
}
</script>

<style scoped>
.formulario-gestor {
  width: 700px;
  max-width: 95vw;
}
.conteudo-formulario {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
