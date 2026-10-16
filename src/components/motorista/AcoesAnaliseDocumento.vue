<template>
  <div v-if="documento?.id && pode('documentos.analisar')" class="row q-gutter-sm">
    <q-btn
      v-if="['em_analise', 'aprovado'].includes(documento.status)"
      flat
      color="negative"
      icon="close"
      label="Reprovar"
      :disable="disable || loading"
      @click="reprovar = true"
    />
    <q-btn
      v-if="['em_analise', 'reprovado'].includes(documento.status)"
      flat
      color="positive"
      icon="check"
      label="Aprovar"
      :disable="disable || loading"
      :loading="loading"
      @click="confirmar = true"
    />
  </div>
  <JanelaConfirmacao v-model="confirmar" @confirm="aprovar">
    Deseja realmente aprovar o documento?
  </JanelaConfirmacao>
  <ReprovarDocumento v-model="reprovar" :documento="documento" @updated="emit('updated')" />
</template>

<script setup>
import { useAuthStore } from 'src/stores/auth'
const { pode } = useAuthStore()
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import JanelaConfirmacao from 'src/components/JanelaConfirmacao.vue'
import ReprovarDocumento from 'src/components/motorista/ReprovarDocumento.vue'

const props = defineProps({ documento: Object, disable: Boolean, loading: Boolean })
const emit = defineEmits(['updated', 'update:loading'])
const $q = useQuasar()
const confirmar = ref(false)
const reprovar = ref(false)

async function aprovar() {
  if (props.disable || props.loading || !props.documento?.id) return
  emit('update:loading', true)
  try {
    const response = await api.put(`/mudar-status-documento/${props.documento.id}`, {
      status: 'aprovado',
    })
    $q.notify({ type: 'positive', message: response.data.message })
    emit('updated')
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível aprovar o documento.',
    })
  } finally {
    emit('update:loading', false)
  }
}
</script>
