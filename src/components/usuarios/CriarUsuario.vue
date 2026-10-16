<template>
  <q-dialog v-model="model" :persistent="salvando" @before-show="limparForm" @hide="limparForm">
    <q-card class="cadastro-usuario">
      <q-toolbar>
        <q-avatar rounded color="primary" text-color="white" icon="person_add_alt" />
        <q-toolbar-title class="text-weight-bold">{{ configuracao?.titulo }}</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar cadastro"
          :disable="salvando"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />
      <q-form @submit="cadastrarUsuario">
        <q-card-section class="campos-cadastro">
          <template v-if="possuiConta">
            <q-card-section class="flex justify-center">
              <q-avatar v-if="imagemProfile" size="12rem">
                <q-img :ratio="1" :src="imagemProfile" alt="Foto de perfil">
                  <div class="flex caption absolute-full text-h5 flex-center">
                    <span class="btn fileinput-button">
                      <q-icon name="photo_camera" color="white" />
                      <br />Alterar<br />imagem
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        aria-label="Alterar imagem"
                        :disabled="salvando"
                        @change="imageSelected"
                      />
                    </span>
                  </div>
                </q-img>
              </q-avatar>
              <q-avatar v-else color="primary" size="12rem">
                <div class="flex absolute-full text-h5 flex-center">
                  <span class="btn fileinput-button">
                    <q-icon name="add_photo_alternate" size="40px" color="white" />
                    <br />Adicionar<br />imagem
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      aria-label="Adicionar imagem"
                      :disabled="salvando"
                      @change="imageSelected"
                    />
                  </span>
                </div>
              </q-avatar>
            </q-card-section>
            <div class="flex justify-center q-mb-md">
              <q-btn
                v-if="imagemProfile"
                flat
                dense
                label="Remover imagem"
                color="primary"
                icon="close"
                :disable="salvando"
                @click="image = null"
              />
            </div>
            <div v-if="erros.image" class="text-negative text-caption text-center q-mb-md">
              {{ erros.image }}
            </div>
          </template>
          <div class="row q-col-gutter-md">
            <q-input
              v-model="usuario.name"
              class="col-12"
              dense
              outlined
              label="Nome completo *"
              maxlength="255"
              :disable="salvando"
              :rules="[(val) => val?.trim().length >= 3 || 'Informe o nome completo']"
              :error="!!erros.name"
              :error-message="erros.name"
            />
            <q-input
              v-model="usuario.cpf"
              class="col-12 col-sm-6"
              dense
              outlined
              label="CPF *"
              mask="###.###.###-##"
              unmasked-value
              :disable="salvando"
              :rules="[(val) => /^\d{11}$/.test(val || '') || 'Informe os 11 dígitos do CPF']"
              :error="!!erros.cpf"
              :error-message="erros.cpf"
            />
            <q-input
              v-model="usuario.data_nascimento"
              class="col-12 col-sm-6"
              dense
              outlined
              label="Data de nascimento *"
              type="date"
              stack-label
              :disable="salvando"
              :max="hoje"
              :rules="[(val) => !!val || 'Informe a data de nascimento']"
              :error="!!erros.data_nascimento"
              :error-message="erros.data_nascimento"
            />
            <template v-if="possuiConta">
              <q-input
                v-model="usuario.telefone"
                class="col-12 col-sm-6"
                dense
                outlined
                label="Telefone"
                mask="(##) #####-####"
                unmasked-value
                :disable="salvando"
                :rules="[(val) => !val || /^\d{10,11}$/.test(val) || 'Informe um telefone com DDD']"
                :error="!!erros.telefone"
                :error-message="erros.telefone"
              />
              <q-input
                v-model="usuario.email"
                class="col-12 col-sm-6"
                dense
                outlined
                label="E-mail *"
                type="email"
                :disable="salvando"
                maxlength="255"
                :rules="[(val) => !!val?.trim() || 'Informe o e-mail']"
                :error="!!erros.email"
                :error-message="erros.email"
              />
              <q-input
                v-model="usuario.password"
                class="col-12 col-sm-6"
                dense
                outlined
                label="Senha *"
                type="password"
                autocomplete="new-password"
                maxlength="255"
                :disable="salvando"
                :rules="[(val) => val?.length >= 8 || 'A senha deve ter pelo menos 8 caracteres']"
                :error="!!erros.password"
                :error-message="erros.password"
              />
              <q-input
                v-model="usuario.password_confirmation"
                class="col-12 col-sm-6"
                dense
                outlined
                label="Confirmar senha *"
                type="password"
                autocomplete="new-password"
                :disable="salvando"
                :rules="[(val) => (!!val && val === usuario.password) || 'As senhas não conferem']"
              />
            </template>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" :disable="salvando" v-close-popup />
          <q-btn
            type="submit"
            color="primary"
            icon-right="save"
            label="Salvar"
            :loading="salvando"
          />
          <q-btn
            v-if="desenvolvimento"
            color="green"
            icon-right="edit"
            label="Preencher dados"
            :disable="salvando"
            @click="preencherDados"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const props = defineProps({
  modelValue: Boolean,
  tipoUsuario: {
    type: String,
    default: 'usuario',
    validator: (val) => ['usuario', 'gestor', 'motorista', 'passageiro'].includes(val),
  },
})
const emit = defineEmits(['update:modelValue', 'created'])
const $q = useQuasar()
const tipos = {
  usuario: { titulo: 'Criar usuário', rota: 'users', conta: false },
  gestor: { titulo: 'Criar gestor', rota: 'gestores', conta: true },
  motorista: { titulo: 'Criar motorista', rota: 'motoristas', conta: true },
  passageiro: { titulo: 'Criar passageiro', rota: 'passageiros', conta: true },
}
const configuracao = computed(() => tipos[props.tipoUsuario])
const possuiConta = computed(() => !!configuracao.value?.conta)
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
const usuario = reactive({
  name: '',
  cpf: '',
  data_nascimento: '',
  telefone: '',
  email: '',
  password: '',
  password_confirmation: '',
})
const image = ref(null)
const imagemProfile = ref('')
const salvando = ref(false)
const erros = ref({})
const desenvolvimento = process.env.DEV
const dataAtual = new Date()
const hoje = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${String(dataAtual.getDate()).padStart(2, '0')}`

function limparPreview() {
  if (imagemProfile.value) URL.revokeObjectURL(imagemProfile.value)
  imagemProfile.value = ''
}
watch(image, (arquivo) => {
  limparPreview()
  if (arquivo) imagemProfile.value = URL.createObjectURL(arquivo)
})
onBeforeUnmount(limparPreview)
watch(
  () => props.tipoUsuario,
  () => {
    if (model.value && !salvando.value) limparForm()
  },
)
function limparForm() {
  image.value = null
  limparPreview()
  erros.value = {}
  Object.assign(usuario, {
    name: '',
    cpf: '',
    data_nascimento: '',
    telefone: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
}
function fotoRejeitada() {
  $q.notify({ type: 'warning', message: 'Selecione uma foto JPG, PNG ou WEBP de até 5 MB.' })
}
function imageSelected(event) {
  const arquivo = event.target.files?.[0]
  event.target.value = ''
  if (!arquivo || salvando.value) return
  const tipoValido =
    ['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) ||
    (!arquivo.type && /\.(jpe?g|png|webp)$/i.test(arquivo.name))
  if (!tipoValido || arquivo.size > 5 * 1024 * 1024) {
    fotoRejeitada()
    return
  }
  delete erros.value.image
  image.value = arquivo
}
function preencherDados() {
  const identificador = Date.now()
  Object.assign(usuario, {
    name: 'Usuário de teste',
    cpf: String(identificador).slice(-11),
    data_nascimento: '1992-11-21',
    telefone: `699${String(identificador).slice(-8)}`,
    email: `${props.tipoUsuario}.${identificador}@example.com`,
    password: 'password',
    password_confirmation: 'password',
  })
}
async function cadastrarUsuario() {
  if (salvando.value) return
  if (!configuracao.value) {
    $q.notify({ type: 'negative', message: 'Tipo de cadastro inválido.' })
    return
  }
  salvando.value = true
  erros.value = {}
  const payload = new FormData()
  for (const campo of ['name', 'cpf', 'data_nascimento'])
    payload.append(campo, usuario[campo].trim())
  if (possuiConta.value) {
    for (const campo of ['email', 'telefone']) payload.append(campo, usuario[campo]?.trim() || '')
    for (const campo of ['password', 'password_confirmation']) payload.append(campo, usuario[campo])
    if (image.value) payload.append('image', image.value)
  }
  try {
    const { data } = await api.post(configuracao.value.rota, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    $q.notify({ type: 'positive', message: data.message || 'Cadastro realizado com sucesso.' })
    emit('created', data.gestor || data.data || data.user)
    model.value = false
  } catch (erro) {
    erros.value = Object.fromEntries(
      Object.entries(erro.response?.data?.errors || {}).map(([campo, mensagens]) => [
        campo,
        mensagens[0],
      ]),
    )
    $q.notify({
      type: 'negative',
      message: erro.response?.data?.message || 'Não foi possível realizar o cadastro.',
    })
  } finally {
    salvando.value = false
  }
}
</script>

<style scoped>
.cadastro-usuario {
  width: 700px;
  max-width: 95vw;
}
.campos-cadastro {
  max-height: 70vh;
  overflow-y: auto;
}
.caption {
  opacity: 0;
  transition: linear 1s;
}
.caption:hover {
  opacity: 1;
}
.btn {
  display: inline-block;
  padding: 6px 12px;
  margin-bottom: 0;
  font-size: 25px;
  font-weight: normal;
  line-height: 1.42857143;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  border-radius: 4px;
}
.fileinput-button {
  position: relative;
  overflow: hidden;
}
.fileinput-button input {
  position: absolute;
  top: 0;
  right: 0;
  margin: 0;
  opacity: 0;
  font-size: 200px;
  cursor: pointer;
}
</style>
