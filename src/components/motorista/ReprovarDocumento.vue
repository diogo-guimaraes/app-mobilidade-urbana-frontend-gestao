<template>
  <q-dialog v-model="model" :persistent="enviando" @before-show="beforeShow" @hide="onHide">
    <q-card class="reprovar-documento-dialog" style="width: 560px; max-width: 95vw">
      <q-toolbar>
        <q-toolbar-title>Reprovar documento</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar"
          :disable="enviando"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />
      <q-form @submit.prevent="request">
        <q-card-section>
          <CardPerfilDocumento :documento="documento" />
          <p class="q-mt-md">Deseja realmente reprovar o documento? Informe o motivo.</p>
          <q-banner v-if="erroCarregamento" class="bg-red-1 text-negative q-mb-md" rounded>
            Não foi possível carregar os motivos de reprovação.
            <template #action>
              <q-btn flat label="Tentar novamente" @click="carregarMotivos" />
            </template>
          </q-banner>
          <q-select
            v-model="motivo"
            @update:model-value="onMotivoChanged"
            outlined
            label="Motivo da reprovação"
            :options="motivos"
            emit-value
            map-options
            :loading="carregando"
            :disable="carregando || enviando || erroCarregamento"
            :rules="[(val) => !!val || 'Selecione o motivo da reprovação']"
            :error="!!errors.motivo_reprovacao"
            :error-message="errors.motivo_reprovacao?.[0]"
          />
          <q-input
            v-if="exigeDescricao"
            v-model="descricao"
            class="q-mt-md"
            outlined
            type="textarea"
            autogrow
            label="Descreva o motivo da reprovação"
            maxlength="2000"
            counter
            :disable="enviando"
            :rules="[(val) => !!val?.trim() || 'Descreva o motivo da reprovação']"
            :error="!!errors.descricao_reprovacao"
            :error-message="errors.descricao_reprovacao?.[0]"
          />
        </q-card-section>
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" :disable="enviando" v-close-popup />
          <q-btn
            type="submit"
            color="negative"
            label="Reprovar documento"
            :loading="enviando"
            :disable="carregando || erroCarregamento || !motivos.length"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import CardPerfilDocumento from 'src/components/motorista/CardPerfilDocumento.vue'

const props = defineProps({ modelValue: Boolean, documento: Object })
const emit = defineEmits(['update:modelValue', 'updated'])
const $q = useQuasar()
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})
const motivos = ref([])
const motivo = ref(null)
const descricao = ref('')
const errors = ref({})
const carregando = ref(false)
const erroCarregamento = ref(false)
const enviando = ref(false)
const exigeDescricao = computed(
  () => motivos.value.find((item) => item.value === motivo.value)?.exige_descricao === true,
)
let loadVersion = 0

function beforeShow() {
  motivo.value = null
  descricao.value = ''
  errors.value = {}
  motivos.value = []
  carregarMotivos()
}

function onHide() {
  loadVersion++
  carregando.value = false
}
onUnmounted(onHide)

function onMotivoChanged() {
  descricao.value = ''
  errors.value = {}
}

async function carregarMotivos() {
  const version = ++loadVersion
  carregando.value = true
  erroCarregamento.value = false
  try {
    const response = await api.get('/motorista-documentos/motivos-reprovacao', { timeout: 15000 })
    if (version === loadVersion) motivos.value = response.data.data
  } catch {
    if (version === loadVersion) erroCarregamento.value = true
  } finally {
    if (version === loadVersion) carregando.value = false
  }
}

async function request() {
  if (
    enviando.value ||
    carregando.value ||
    erroCarregamento.value ||
    !props.documento?.id ||
    !motivo.value
  )
    return
  enviando.value = true
  errors.value = {}
  try {
    const response = await api.put(`/mudar-status-documento/${props.documento.id}`, {
      status: 'reprovado',
      motivo_reprovacao: motivo.value,
      ...(exigeDescricao.value ? { descricao_reprovacao: descricao.value.trim() } : {}),
    })
    $q.notify({ type: 'positive', position: 'top-right', message: response.data.message })
    emit('updated')
    model.value = false
  } catch (err) {
    errors.value = err.response?.data?.errors || {}
    $q.notify({
      type: 'negative',
      message: err.response?.data?.message || 'Não foi possível reprovar o documento.',
    })
  } finally {
    enviando.value = false
  }
}
</script>
