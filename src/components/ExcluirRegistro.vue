<template>
  <section>
    <q-dialog v-model="model" @before-show="beforeShow">
      <q-card style="width: 400px; max-width: 50vw">
        <!-- HEADER -->
        <q-toolbar>
          <q-avatar rounded size="md" :icon="icon" :color="color" text-color="white" />

          <q-toolbar-title>
            <span class="text-weight-bold">
              {{ acaoFormatada }}
            </span>
          </q-toolbar-title>

          <q-btn flat round dense icon="close" v-close-popup />
        </q-toolbar>

        <q-separator />

        <!-- TITULO -->
        <q-card-section class="row items-center q-pb-none">
          <span v-if="data" class="text-h6">{{ titulo }}</span>
        </q-card-section>

        <!-- LISTA -->
        <q-card-section
          v-if="data && data.length"
          style="max-height: 10vh"
          class="scroll q-pt-none"
        >
          <div v-for="(item, index) in data" :key="index">
            <span>{{ item.id }} - {{ item.name }}</span>
          </div>
        </q-card-section>

        <!-- ACTION -->
        <q-card-actions align="right" class="text-primary">
          <q-btn
            class="full-width"
            :label="acao"
            :color="color"
            :loading="btnLoading"
            :icon-right="icon"
            @click="actionDelet"
          >
            <template #loading>
              <q-spinner-hourglass class="on-left" />
              Processando...
            </template>
          </q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

// Opções da operação de arquivar, restaurar ou excluir.
const props = defineProps({
  modelValue: Boolean,
  data: Array,
  acao: String,
})

// EMITS
const emit = defineEmits(['update:modelValue', 'deleted'])

// QUASAR
const $q = useQuasar()

// MODEL
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// STATE
const btnLoading = ref(false)

// COMPUTED
const acaoFormatada = computed(() => {
  if (!props.acao) return ''
  return props.acao.charAt(0).toUpperCase() + props.acao.slice(1)
})

const titulo = computed(() => {
  if (!props.data) return ''
  return props.data.length === 1
    ? `${props.acao} o seguinte registro?`
    : `${props.acao} os seguintes registros?`
})

const icon = computed(() => {
  if (props.acao === 'arquivar') return 'delete'
  if (props.acao === 'restaurar') return 'restore_from_trash'
  if (props.acao === 'deletar') return 'delete_forever'
  return 'help'
})

const color = computed(() => {
  if (props.acao === 'arquivar') return 'orange'
  if (props.acao === 'restaurar') return 'blue'
  if (props.acao === 'deletar') return 'red'
  return 'grey'
})

// LIFECYCLE
function beforeShow() {
  btnLoading.value = false
}

// ACTION
function actionDelet() {
  btnLoading.value = true

  if (props.acao === 'arquivar') return arquivar()
  if (props.acao === 'restaurar') return restaurar()
  if (props.acao === 'deletar') return deletar()
}

// REQUESTS
function arquivar() {
  request('usuario-arquivar')
}

function deletar() {
  request('usuario-deletar')
}

function restaurar() {
  request('usuario-restaurar')
}

function request(payload) {
  api
    .post(payload, {
      usuarios: props.data,
    })
    .then((response) => {
      btnLoading.value = false
      model.value = false

      $q.notify({
        type: 'positive',
        message: response.data.message,
      })

      emit('deleted')
    })
    .catch((error) => {
      btnLoading.value = false

      $q.notify({
        type: 'warning',
        message: error.response?.data?.message || 'Erro na operação',
      })
    })
}
</script>
