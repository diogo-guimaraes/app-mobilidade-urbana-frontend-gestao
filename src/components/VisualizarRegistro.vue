<template>
  <q-dialog v-model="model" :persistent="salvandoFoto">
    <q-card class="visualizar-registro" style="width: 700px; max-width: 95vw">
      <q-toolbar>
        <q-toolbar-title class="text-weight-bold">{{ configuracao.titulo }}</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar visualização"
          :disable="salvandoFoto"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />
      <q-card-section v-if="carregando" class="column items-center q-pa-lg" role="status">
        <q-spinner color="primary" size="36px" />
        <span class="q-mt-sm">Carregando informações…</span>
      </q-card-section>
      <q-card-section v-else-if="erro">
        <q-banner rounded class="bg-red-1 text-negative">
          {{ erro }}
          <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
        </q-banner>
      </q-card-section>
      <q-card-section v-else>
        <FotoPerfil
          v-if="possuiFotoPerfil"
          :src="imagem || ''"
          :loading="salvandoFoto"
          :disable="
            !!dados?.deleted_at ||
            !pode(tipo === 'gestor' ? 'gestores.gerenciar' : 'usuarios.gerenciar')
          "
          @selected="salvarFoto"
          @remove="salvarFoto(null)"
        />
        <div v-else-if="imagem" class="flex justify-center q-mb-lg">
          <q-img
            v-if="tipo === 'midia'"
            :src="imagem"
            fit="contain"
            style="max-height: 300px"
            alt="Imagem da mídia"
          />
          <q-avatar v-else size="120px"><img :src="imagem" alt="Foto de perfil" /></q-avatar>
        </div>
        <div v-if="campos.length" class="row q-col-gutter-md">
          <div v-for="campo in campos" :key="campo.chave" class="col-12 col-sm-6">
            <q-input
              outlined
              dense
              readonly
              :label="campo.label"
              :model-value="campo.valor"
              :type="campo.valor.includes('\n') ? 'textarea' : 'text'"
              autogrow
              hide-bottom-space
            />
          </div>
        </div>
        <div v-else class="text-grey-7">Nenhuma informação disponível.</div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Fechar" color="primary" :disable="salvandoFoto" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { computed, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { camposDetalhes, configuracoesDetalhes, lerCampo } from 'src/utils/detalhesRegistro'
import FotoPerfil from 'src/components/usuarios/FotoPerfil.vue'

const props = defineProps({
  modelValue: Boolean,
  tipo: {
    type: String,
    required: true,
    validator: (valor) => Object.hasOwn(configuracoesDetalhes, valor),
  },
  registroId: [Number, String],
  registro: Object,
})
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({
  get: () => props.modelValue,
  set: (valor) => emit('update:modelValue', valor),
})
const configuracao = computed(() => configuracoesDetalhes[props.tipo] || {})
const dados = ref(null)
const carregando = ref(false)
const erro = ref('')
const salvandoFoto = ref(false)
const possuiFotoPerfil = computed(() => ['motorista', 'passageiro', 'gestor'].includes(props.tipo))
const campos = computed(() => camposDetalhes(props.tipo, dados.value))
const imagem = computed(() =>
  configuracao.value.imagem ? lerCampo(dados.value, configuracao.value.imagem) : null,
)
let controller

async function salvarFoto(arquivo) {
  if (salvandoFoto.value || !possuiFotoPerfil.value || !dados.value?.id || dados.value.deleted_at)
    return
  if (
    arquivo &&
    (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) ||
      arquivo.size > 5 * 1024 * 1024)
  ) {
    $q.notify({ type: 'negative', message: 'Selecione JPG, PNG ou WebP de até 5 MB.' })
    return
  }
  const registroId = dados.value.id
  const form = new FormData()
  if (arquivo) form.append('image', arquivo)
  else form.append('remover_foto', '1')
  salvandoFoto.value = true
  try {
    const response = await api.post(`/${configuracao.value.endpoint}/${registroId}/foto`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    dados.value = { ...dados.value, foto: response.data.data.foto }
    emit('updated', response.data.data)
    $q.notify({ type: 'positive', message: response.data.message })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message:
        error.response?.data?.errors?.image?.[0] ||
        error.response?.data?.message ||
        'Não foi possível atualizar a foto.',
    })
  } finally {
    salvandoFoto.value = false
  }
}

async function carregar() {
  controller?.abort()
  const atual = new AbortController()
  controller = atual
  dados.value = null
  erro.value = ''
  carregando.value = true
  try {
    if (configuracao.value.endpoint && props.registroId && !props.registro?.deleted_at) {
      const response = await api.get(`/${configuracao.value.endpoint}/${props.registroId}`, {
        signal: atual.signal,
        timeout: 15000,
      })
      if (controller !== atual || atual.signal.aborted) return
      const registro = response.data?.data ?? response.data
      if (!registro || typeof registro !== 'object' || Array.isArray(registro))
        throw new Error('Resposta inválida')
      dados.value = registro
    } else {
      dados.value = props.registro || null
    }
  } catch (error) {
    if (controller !== atual || atual.signal.aborted) return
    erro.value = error.response?.data?.message || 'Não foi possível carregar as informações.'
  } finally {
    if (controller === atual) carregando.value = false
  }
}

watch(
  () => [props.modelValue, props.tipo, props.registroId, props.registro],
  () => {
    if (props.modelValue) carregar()
    else {
      controller?.abort()
      dados.value = null
      erro.value = ''
      carregando.value = false
    }
  },
  { immediate: true },
)
onUnmounted(() => controller?.abort())
</script>
