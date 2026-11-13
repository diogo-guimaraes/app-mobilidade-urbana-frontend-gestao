<template>
  <q-dialog v-model="model" :persistent="salvando || salvandoFoto" @before-show="carregar">
    <q-card style="width: 700px; max-width: 95vw">
      <q-toolbar>
        <q-avatar rounded icon="edit" color="primary" text-color="white" />
        <q-toolbar-title class="text-weight-bold">Editar {{ tipoUsuario }}</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar edição"
          :disable="salvando || salvandoFoto"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />

      <q-card-section v-if="carregando" class="column items-center q-pa-lg" role="status">
        <q-spinner color="primary" size="36px" />
        <span class="q-mt-sm">Carregando informações…</span>
      </q-card-section>
      <q-card-section v-else-if="falhaCarregamento">
        <q-banner rounded class="bg-red-1 text-negative">
          {{ falhaCarregamento }}
          <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
        </q-banner>
      </q-card-section>

      <q-form v-else @submit="salvar">
        <q-card-section style="max-height: 70vh; overflow-y: auto">
          <FotoPerfil
            :src="foto || ''"
            :loading="salvandoFoto"
            :disable="salvando"
            @selected="salvarFoto"
            @remove="salvarFoto(null)"
          />
          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.name"
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
              v-model="formulario.cpf"
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
              v-model="formulario.data_nascimento"
              class="col-12 col-sm-6"
              dense
              outlined
              label="Data de nascimento *"
              type="date"
              stack-label
              :disable="salvando"
              :rules="[(val) => !!val || 'Informe a data de nascimento']"
              :error="!!erros.data_nascimento"
              :error-message="erros.data_nascimento"
            />
            <q-input
              v-model="formulario.telefone"
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
              v-model="formulario.email"
              class="col-12 col-sm-6"
              dense
              outlined
              label="E-mail *"
              type="email"
              maxlength="255"
              :disable="salvando"
              :rules="[(val) => !!val?.trim() || 'Informe o e-mail']"
              :error="!!erros.email"
              :error-message="erros.email"
            />
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" :disable="salvando || salvandoFoto" v-close-popup />
          <q-btn
            type="submit"
            color="primary"
            icon-right="save"
            label="Salvar"
            :loading="salvando"
            :disable="salvandoFoto"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import FotoPerfil from 'src/components/usuarios/FotoPerfil.vue'

const props = defineProps({
  modelValue: Boolean,
  usuarioId: [String, Number],
  tipoUsuario: {
    type: String,
    required: true,
    validator: (valor) => ['motorista', 'passageiro'].includes(valor),
  },
})
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({
  get: () => props.modelValue,
  set: (valor) => emit('update:modelValue', valor),
})

// motorista e passageiro têm conta própria: os dados pessoais ficam no cadastro do app
// (PUT motoristas/{id} ou passageiros/{id}) e a foto vai pelo endpoint de foto do perfil
const endpoint = computed(() => `${props.tipoUsuario}s/${props.usuarioId}`)
const campos = ['name', 'cpf', 'data_nascimento', 'telefone', 'email']
const formulario = reactive(Object.fromEntries(campos.map((campo) => [campo, ''])))
const foto = ref(null)
const carregando = ref(false)
const falhaCarregamento = ref('')
const salvando = ref(false)
const salvandoFoto = ref(false)
const erros = ref({})
let consulta = 0

const mensagensErro = (erro) =>
  Object.fromEntries(
    Object.entries(erro.response?.data?.errors || {}).map(([campo, mensagens]) => [
      campo,
      mensagens[0],
    ]),
  )

async function carregar() {
  const atual = ++consulta
  erros.value = {}
  falhaCarregamento.value = ''
  carregando.value = true
  try {
    const { data } = await api.get(endpoint.value)
    if (atual !== consulta) return
    for (const campo of campos) formulario[campo] = String(data[campo] || '')
    formulario.data_nascimento = formulario.data_nascimento.slice(0, 10)
    foto.value = data.foto
  } catch (erro) {
    if (atual === consulta)
      falhaCarregamento.value =
        erro.response?.data?.message || 'Não foi possível carregar o cadastro.'
  } finally {
    if (atual === consulta) carregando.value = false
  }
}

async function salvar() {
  if (salvando.value) return
  salvando.value = true
  erros.value = {}
  try {
    const { data } = await api.put(
      endpoint.value,
      Object.fromEntries(campos.map((campo) => [campo, formulario[campo].trim() || null])),
    )
    $q.notify({ type: 'positive', message: data.message })
    emit('updated', data.data)
    model.value = false
  } catch (erro) {
    erros.value = mensagensErro(erro)
    $q.notify({
      type: 'negative',
      message: erro.response?.data?.message || 'Não foi possível salvar as alterações.',
    })
  } finally {
    salvando.value = false
  }
}

async function salvarFoto(arquivo) {
  if (salvandoFoto.value) return
  if (
    arquivo &&
    (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) ||
      arquivo.size > 5 * 1024 * 1024)
  ) {
    $q.notify({ type: 'negative', message: 'Selecione JPG, PNG ou WebP de até 5 MB.' })
    return
  }
  const form = new FormData()
  if (arquivo) form.append('image', arquivo)
  else form.append('remover_foto', '1')
  salvandoFoto.value = true
  try {
    const { data } = await api.post(`${endpoint.value}/foto`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    foto.value = data.data.foto
    emit('updated', data.data)
    $q.notify({ type: 'positive', message: data.message })
  } catch (erro) {
    $q.notify({
      type: 'negative',
      message:
        mensagensErro(erro).image ||
        erro.response?.data?.message ||
        'Não foi possível atualizar a foto.',
    })
  } finally {
    salvandoFoto.value = false
  }
}
</script>
