<template>
  <q-dialog v-model="aberto" persistent>
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="row items-center bg-primary text-white"
        ><q-icon name="add_comment" size="28px" class="q-mr-sm" />
        <div class="text-h6">Novo ticket</div>
        <q-space /><q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar"
          :disable="salvando"
          @click="aberto = false"
      /></q-card-section>
      <q-form @submit="salvar">
        <q-card-section class="q-gutter-md">
          <div class="text-grey-7">Abra um atendimento para um passageiro ou motorista.</div>
          <q-select
            v-model="solicitante"
            outlined
            use-input
            fill-input
            hide-selected
            input-debounce="350"
            :options="usuarios"
            option-label="name"
            label="Solicitante"
            :loading="buscando"
            :rules="[(v) => !!v || 'Selecione o solicitante']"
            @filter="buscar"
            @update:model-value="selecionar"
          >
            <template #option="scope"
              ><q-item v-bind="scope.itemProps"
                ><q-item-section avatar
                  ><q-avatar color="blue-1" text-color="primary" icon="person" /></q-item-section
                ><q-item-section
                  ><q-item-label>{{ scope.opt.name }}</q-item-label
                  ><q-item-label caption
                    >{{ scope.opt.cpf }} ·
                    {{
                      scope.opt.perfis
                        .map((p) => (p === 'motorista' ? 'Motorista' : 'Passageiro'))
                        .join(' / ')
                    }}</q-item-label
                  ></q-item-section
                ></q-item
              ></template
            >
            <template #no-option
              ><q-item
                ><q-item-section class="text-grey"
                  >Nenhum usuário encontrado. Pesquise pelo nome ou CPF.</q-item-section
                ></q-item
              ></template
            >
          </q-select>
          <q-select
            v-model="tipo"
            outlined
            emit-value
            map-options
            :options="perfis"
            label="Perfil do atendimento"
            :disable="!solicitante"
            :rules="[(v) => !!v || 'Selecione o perfil']"
          />
          <q-select
            v-model="motivo"
            outlined
            emit-value
            map-options
            :options="motivosTickets"
            label="Assunto"
            :rules="[(v) => !!v || 'Selecione o assunto']"
          />
          <q-input
            v-model="corrida"
            outlined
            label="ID da corrida (opcional)"
            inputmode="numeric"
            hint="A corrida deve pertencer ao solicitante e ao perfil escolhido."
            :rules="[(v) => !v || /^[1-9]\d*$/.test(v) || 'Informe um ID válido']"
          />
          <q-input
            v-model="descricao"
            outlined
            type="textarea"
            label="Descrição do atendimento"
            maxlength="1000"
            counter
            :rules="[
              (v) => v.trim().length >= 10 || 'Descreva o problema com pelo menos 10 caracteres',
            ]"
          />
          <q-banner v-if="erro" dense rounded class="bg-red-1 text-negative" role="alert">{{
            erro
          }}</q-banner>
        </q-card-section>
        <q-separator /><q-card-actions align="right" class="q-pa-md"
          ><q-btn flat label="Cancelar" :disable="salvando" @click="aberto = false" /><q-btn
            color="primary"
            label="Abrir ticket"
            type="submit"
            :loading="salvando"
        /></q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { api } from 'boot/axios'
import { motivosTickets, erroTicket } from 'src/utils/tickets'

const aberto = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['criado'])
const solicitante = ref(null)
const tipo = ref(null)
const motivo = ref(null)
const corrida = ref('')
const descricao = ref('')
const usuarios = ref([])
const buscando = ref(false)
const salvando = ref(false)
const erro = ref('')
let searchController = null
let searchVersion = 0
const perfis = computed(() =>
  (solicitante.value?.perfis || []).map((value) => ({
    value,
    label: value === 'motorista' ? 'Motorista' : 'Passageiro',
  })),
)
function selecionar(value) {
  tipo.value = value?.perfis?.length === 1 ? value.perfis[0] : null
  corrida.value = ''
}
watch(aberto, (value) => {
  if (!value) return
  solicitante.value = null
  tipo.value = null
  motivo.value = null
  corrida.value = ''
  descricao.value = ''
  erro.value = ''
})
async function buscar(search, update, abort) {
  searchController?.abort()
  searchController = new AbortController()
  const epoch = ++searchVersion
  buscando.value = true
  try {
    const { data } = await api.get('/ajuda/solicitantes', {
      params: { search },
      signal: searchController.signal,
    })
    if (epoch === searchVersion)
      update(() => {
        usuarios.value = data.data
      })
  } catch (error) {
    if (epoch === searchVersion) {
      abort()
      if (error.code !== 'ERR_CANCELED') erro.value = erroTicket(error)
    }
  } finally {
    if (epoch === searchVersion) buscando.value = false
  }
}
async function salvar() {
  if (salvando.value) return
  salvando.value = true
  erro.value = ''
  try {
    const { data } = await api.post('/ajuda/tickets', {
      user_id: solicitante.value.id,
      solicitante_tipo: tipo.value,
      motivo: motivo.value,
      descricao: descricao.value.trim(),
      corrida_id: corrida.value ? Number(corrida.value) : null,
    })
    aberto.value = false
    emit('criado', data.data)
  } catch (error) {
    erro.value = erroTicket(error)
  } finally {
    salvando.value = false
  }
}
onBeforeUnmount(() => searchController?.abort())
</script>
