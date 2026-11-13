<template>
  <section>
    <q-dialog
      v-model="model"
      :persistent="enviando"
      @before-show="carregarCidades"
      @before-hide="beforeHide"
    >
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
                    maxlength="120"
                    :disable="enviando"
                    :rules="[(val) => (val && val.length >= 3) || 'Campo obrigatório']"
                  />
                </q-item>
              </div>

              <!-- o app mostra o banner só para quem está nesta cidade -->
              <div class="col-md-6 col-12">
                <q-item>
                  <q-select
                    class="full-width"
                    v-model="banner.cidade_id"
                    :options="cidadesFiltradas"
                    label="Cidade"
                    outlined
                    dense
                    emit-value
                    map-options
                    use-input
                    input-debounce="0"
                    @filter="filtrarCidades"
                    :loading="carregandoCidades"
                    :disable="enviando"
                    :rules="[(val) => !!val || 'Selecione a cidade']"
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
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              :max-files="1"
              :max-file-size="TAMANHO_MAXIMO"
              :disable="enviando"
              :rules="[(val) => !!val || 'Selecione uma imagem']"
              hint="JPG, PNG ou WEBP de até 5 MB, no formato 2,4 : 1 (ex.: 1200 × 500)"
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

// o mesmo limite do backend (PUBLICIDADE_TAMANHO_MAXIMO_KB)
const TAMANHO_MAXIMO = 5 * 1024 * 1024

// STATE
const file = ref(null)
const enviando = ref(false)
const cidades = ref([])
// são todos os municípios do IBGE: a lista só mostra os que combinam com o que foi digitado
const cidadesFiltradas = ref([])
const carregandoCidades = ref(false)

const semAcento = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function filtrarCidades(busca, update) {
  const termo = semAcento(busca.trim())
  update(() => {
    cidadesFiltradas.value = termo
      ? cidades.value.filter((cidade) => semAcento(cidade.label).includes(termo))
      : cidades.value
  })
}

const banner = reactive({
  titulo: '',
  cidade_id: null,
})

// LIFECYCLE
async function beforeHide() {
  file.value = null
  Object.assign(banner, {
    titulo: '',
    cidade_id: null,
  })
}

async function carregarCidades() {
  carregandoCidades.value = true
  try {
    const { data } = await api.get('/cidades')
    cidades.value = data.map((cidade) => ({
      label: `${cidade.nome}/${cidade.uf}`,
      value: cidade.id,
    }))
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.message || 'Não foi possível carregar as cidades.',
    })
  } finally {
    carregandoCidades.value = false
  }
}

// ACTION
function arquivoRejeitado() {
  $q.notify({ type: 'negative', message: 'Selecione uma imagem JPG, PNG ou WEBP de até 5 MB.' })
}

async function request() {
  if (enviando.value || !file.value) return

  enviando.value = true
  const data = new FormData()
  data.append('arquivo', file.value)
  data.append('titulo', banner.titulo)
  data.append('cidade_id', banner.cidade_id)

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
