<template>
  <div class="imagem-mensagem q-mt-xs">
    <q-btn
      v-if="erro"
      flat
      no-caps
      color="negative"
      icon="broken_image"
      label="Não foi possível abrir a imagem. Tentar novamente"
      @click="carregar"
    />
    <button
      v-else
      type="button"
      class="imagem-botao"
      :disabled="!url"
      :aria-label="`Ampliar imagem ${anexo.nome}`"
      @click="aberta = true"
    >
      <q-img v-if="url" :src="url" fit="contain" class="miniatura" :alt="anexo.nome">
        <template #error
          ><div class="absolute-full flex flex-center bg-grey-3 text-grey-8">
            Imagem indisponível
          </div></template
        >
      </q-img>
      <div v-else class="miniatura flex flex-center bg-grey-3">
        <q-spinner color="primary" size="28px" />
      </div>
    </button>
    <div class="nome-imagem text-caption text-grey-7 ellipsis" :title="anexo.nome">
      {{ anexo.nome }}
    </div>
    <q-dialog v-model="aberta" maximized>
      <q-card class="visualizador-imagem bg-grey-10 text-white column no-wrap">
        <q-toolbar>
          <q-toolbar-title class="text-subtitle2 ellipsis">{{ anexo.nome }}</q-toolbar-title>
          <q-btn
            flat
            round
            icon="download"
            :href="url"
            :download="anexo.nome"
            aria-label="Baixar imagem"
          />
          <q-btn flat round icon="close" v-close-popup aria-label="Fechar imagem" />
        </q-toolbar>
        <div class="col flex flex-center imagem-ampliada"><img :src="url" :alt="anexo.nome" /></div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ anexo: { type: Object, required: true } })
const url = ref('')
const erro = ref(false)
const aberta = ref(false)
let controller
let version = 0
function limpar() {
  controller?.abort()
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  aberta.value = false
}
async function carregar() {
  const epoch = ++version
  limpar()
  erro.value = false
  controller = new AbortController()
  try {
    const { data } = await api.get(props.anexo.url, {
      responseType: 'blob',
      signal: controller.signal,
    })
    if (epoch !== version) return
    url.value = URL.createObjectURL(data)
  } catch (error) {
    if (epoch === version && error.code !== 'ERR_CANCELED') erro.value = true
  }
}
watch(() => props.anexo.id, carregar, { immediate: true })
onBeforeUnmount(() => {
  version++
  limpar()
})
</script>

<style scoped>
.imagem-mensagem {
  max-width: 240px;
}
.imagem-botao {
  display: block;
  max-width: 100%;
  border: 0;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: zoom-in;
  background: transparent;
}
.imagem-botao:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
.miniatura {
  width: min(240px, 55vw);
  height: 160px;
}
.nome-imagem {
  max-width: min(240px, 55vw);
}
.imagem-ampliada {
  min-height: 0;
  padding: 16px;
}
.imagem-ampliada img {
  max-width: 100%;
  max-height: calc(100dvh - 82px);
  object-fit: contain;
}
</style>
