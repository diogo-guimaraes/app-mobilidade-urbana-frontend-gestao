<template>
  <div class="foto-perfil column items-center q-mb-lg">
    <q-avatar size="12rem" :color="src ? undefined : 'primary'" text-color="white">
      <q-img v-if="src" :ratio="1" :src="src" alt="Foto de perfil">
        <div v-if="!disable" class="caption flex absolute-full flex-center">
          <span class="fileinput-button">
            <q-icon name="photo_camera" color="white" /><br />Alterar<br />imagem
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              aria-label="Alterar imagem"
              :disabled="loading"
              @change="selecionar"
            />
          </span>
        </div>
      </q-img>
      <div v-else class="flex absolute-full flex-center">
        <span class="fileinput-button">
          <q-icon name="add_photo_alternate" size="40px" color="white" /><br />Adicionar<br />imagem
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            aria-label="Adicionar imagem"
            :disabled="loading || disable"
            @change="selecionar"
          />
        </span>
      </div>
      <div
        v-if="loading"
        class="absolute-full flex flex-center bg-primary"
        style="opacity: 0.85"
        role="status"
      >
        <q-spinner color="white" size="40px" aria-label="Salvando imagem" />
      </div>
    </q-avatar>
    <q-btn
      v-if="src && !disable"
      flat
      dense
      icon="close"
      color="primary"
      label="Remover imagem"
      class="q-mt-sm"
      :disable="loading"
      @click="emit('remove')"
    />
  </div>
</template>

<script setup>
defineProps({ src: String, loading: Boolean, disable: Boolean })
const emit = defineEmits(['selected', 'remove'])
function selecionar(event) {
  const arquivo = event.target.files?.[0]
  if (arquivo) emit('selected', arquivo)
  event.target.value = ''
}
</script>

<style scoped>
.caption {
  opacity: 0;
  transition: linear 1s;
}
.caption:hover,
.caption:focus-within {
  opacity: 1;
}
.fileinput-button {
  display: inline-block;
  padding: 6px 12px;
  position: relative;
  overflow: hidden;
  text-align: center;
  font-size: 25px;
  line-height: 1.42857143;
  cursor: pointer;
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
