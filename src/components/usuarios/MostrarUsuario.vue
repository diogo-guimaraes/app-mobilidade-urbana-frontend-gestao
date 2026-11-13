<template>
  <VisualizarRegistro
    v-model="model"
    :tipo="tipoUsuario"
    :registro-id="usuarioId"
    :registro="registro"
    @updated="emit('updated', $event)"
  />
</template>

<script setup>
import { computed } from 'vue'
import VisualizarRegistro from 'src/components/VisualizarRegistro.vue'

const props = defineProps({
  modelValue: Boolean,
  usuarioId: [String, Number],
  tipoUsuario: {
    type: String,
    required: true,
    validator: (valor) => ['motorista', 'passageiro', 'gestor'].includes(valor),
  },
  registro: Object,
})
const emit = defineEmits(['update:modelValue', 'updated'])
const model = computed({
  get: () => props.modelValue,
  set: (valor) => emit('update:modelValue', valor),
})
</script>
