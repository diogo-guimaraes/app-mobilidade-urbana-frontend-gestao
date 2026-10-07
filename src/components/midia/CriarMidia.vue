<template>
  <section>
    <q-dialog v-model="model" :persistent="enviando" @before-hide="beforeHide">
      <q-card style="width: 700px; max-width: 80vw">
        <!-- HEADER -->
        <q-toolbar>
          <!--
          <q-avatar
            rounded
            size="lg"
            icon="file_present"
            color="primary"
            text-color="white"
          />
          -->

          <q-toolbar-title>
            <span class="text-weight-bold">Criar anúncio</span>
          </q-toolbar-title>

          <q-btn flat round dense icon="close" :disable="enviando" v-close-popup />
        </q-toolbar>

        <q-separator />

        <q-form class="q-pa-md" @submit="request">
          <q-card-section>
            <div class="row">
              <!-- INPUTS -->
              <div class="col-md-6 col-12">
                <q-item>
                  <q-input
                    class="full-width"
                    v-model="banner.titulo"
                    label="Título"
                    outlined
                    dense
                    maxlength="255"
                    :disable="enviando"
                    :rules="[(val) => (val && val.length >= 3) || 'Campo obrigatório']"
                  />
                </q-item>
              </div>
            </div>

            <q-file
              class="q-mt-lg"
              filled
              bottom-slots
              v-model="file"
              label="Selecione o arquivo"
              counter
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              :max-files="1"
              :max-file-size="12337152"
              :disable="enviando"
              :rules="[(val) => !!val || 'Selecione uma imagem']"
              hint="JPG ou PNG de até 12048 KB"
              @rejected="arquivoRejeitado"
            >
              <template v-slot:before>
                <q-icon name="upload_file" />
              </template>

              <template v-slot:append>
                <q-btn round dense flat icon="add" @click.stop.prevent />
              </template>
            </q-file>

            <div class="q-mt-md" align="center">
              <q-btn
                v-if="file"
                type="submit"
                label="Enviar"
                color="primary"
                class="q-mt-md"
                :loading="enviando"
              />
            </div>
          </q-card-section>
        </q-form>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { reactive, computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

// PROPS
const props = defineProps({
  modelValue: Boolean,
})

// EMITS
const emit = defineEmits(['update:modelValue', 'updated'])

// QUASAR
const $q = useQuasar()

// MODEL
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// STATE
const file = ref(null)
const enviando = ref(false)

const banner = reactive({
  titulo: '',
})

// LIFECYCLE
async function beforeHide() {
  file.value = null
  Object.assign(banner, {
    titulo: '',
  })
}

// ACTION
function arquivoRejeitado() {
  $q.notify({ type: 'negative', message: 'Selecione uma imagem JPG ou PNG de até 12048 KB.' })
}

async function request() {
  if (enviando.value || !file.value) return

  enviando.value = true
  const data = new FormData()
  data.append('arquivo', file.value)
  data.append('titulo', banner.titulo)

  try {
    const res = await api.post('/publicidades', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    $q.notify({
      type: 'positive',
      message: res.data.message,
    })

    emit('updated')
    model.value = false
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.message || 'Erro ao criar anúncio.',
    })
  } finally {
    enviando.value = false
  }
}
</script>
