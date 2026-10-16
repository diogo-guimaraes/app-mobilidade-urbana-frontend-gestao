<template>
  <q-item>
    <q-item-section top avatar>
      <q-avatar color="primary" text-color="white">
        <img v-if="gestor.foto" :src="gestor.foto" :alt="`Foto de ${gestor.name}`" />
        <span v-else>{{ gestor.name?.charAt(0) }}</span>
      </q-avatar>
      <q-badge class="q-mt-xs" :color="gestor.deleted_at ? 'grey' : 'green'">
        {{ gestor.deleted_at ? 'arquivado' : 'ativo' }}
      </q-badge>
    </q-item-section>
    <q-item-section>
      <q-item-label class="text-bold">{{ gestor.name }}</q-item-label>
      <q-item-label class="dados-gestor">
        {{ gestor.email }}
        <div>CPF: {{ formatarCpf(gestor.cpf) }}</div>
        <div v-if="gestor.telefone">TEL: {{ gestor.telefone }}</div>
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup>
defineProps({ gestor: { type: Object, required: true } })
const formatarCpf = (cpf) => (cpf || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
</script>

<style scoped>
.dados-gestor {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
