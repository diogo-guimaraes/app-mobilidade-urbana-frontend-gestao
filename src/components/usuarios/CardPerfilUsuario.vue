<template>
  <q-list :bordered="bordered">
    <q-item>
      <q-item-section top avatar>
        <q-avatar v-if="props.usuario?.foto_thumbnail">
          <img :src="props.usuario?.foto" />
        </q-avatar>
        <q-avatar v-else color="primary" text-color="white">
          {{ props.usuario?.name?.charAt(0) }}
        </q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label class="text-bold"> {{ props.usuario?.name }}</q-item-label>
        <q-item-label class="estilo-coluna">
          <div>CPF: {{ props.usuario?.cpf }}</div>
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
const props = defineProps({
  usuario: [Object],
  bordered: {
    type: Boolean,
    default: false,
  },
})
</script>
