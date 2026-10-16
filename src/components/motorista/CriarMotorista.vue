<template>
  <div>
    <q-dialog v-model="model" @before-show="onBeforeShow">
      <q-card style="width: 700px; max-width: 90vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">Criar motorista</div>
          <q-space />
          <q-btn flat round dense icon="close" aria-label="Fechar" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pb-none">
          Selecione o usuário que deseja registrar como motorista.
        </q-card-section>

        <q-table
          flat
          :rows="usuarios"
          :columns="columns"
          row-key="id"
          :pagination="pagination"
          :loading="loading"
          @request="buscarDados"
        >
          <template #top>
            <q-input
              class="full-width"
              filled
              dense
              debounce="300"
              v-model="search"
              placeholder="Pesquisar"
              @keyup.enter="pesquisarUsuarios"
            >
              <template v-if="search" #append>
                <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
              </template>
            </q-input>
          </template>

          <template #body="props">
            <q-tr :props="props">
              <q-td key="id" :props="props">{{ props.row.id }}</q-td>
              <q-td key="usuario" :props="props">
                <CardPerfilUsuario :usuario="props.row" />
              </q-td>
              <q-td key="acoes" :props="props">
                <q-btn
                  label="Registrar"
                  color="primary"
                  unelevated
                  no-caps
                  @click="selectRow(props.row)"
                />
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmacao" :persistent="registrando">
      <q-card style="width: 500px; max-width: 90vw">
        <q-card-section class="row items-center bg-primary text-white">
          <div class="text-h6">Confirmar registro</div>
          <q-space />
          <q-btn
            flat
            round
            dense
            icon="close"
            aria-label="Fechar"
            :disable="registrando"
            v-close-popup
          />
        </q-card-section>

        <q-form @submit="criarMotorista">
          <q-card-section>
            <p>Deseja registrar este usuário como motorista?</p>
            <CardPerfilUsuario v-if="usuario" :usuario="usuario" />
            <div class="text-grey-7 q-mt-md q-mb-sm">Informe os dados de acesso do motorista.</div>
            <q-input
              v-model="cadastro.email"
              outlined
              dense
              type="email"
              label="E-mail do motorista *"
              :disable="registrando"
              :rules="[(val) => !!val?.trim() || 'Informe o e-mail do motorista']"
              :error="!!erros.email"
              :error-message="erros.email"
              maxlength="255"
            />
            <q-input
              v-model="cadastro.telefone"
              outlined
              dense
              label="Telefone"
              mask="(##) #####-####"
              unmasked-value
              :disable="registrando"
              :rules="[(val) => !val || /^\d{10,11}$/.test(val) || 'Informe um telefone com DDD']"
              :error="!!erros.telefone"
              :error-message="erros.telefone"
            />
            <q-input
              v-model="cadastro.password"
              outlined
              dense
              label="Senha *"
              type="password"
              autocomplete="new-password"
              :disable="registrando"
              :rules="[(val) => val?.length >= 8 || 'A senha deve ter pelo menos 8 caracteres']"
              :error="!!erros.password"
              :error-message="erros.password"
              maxlength="255"
            />
            <q-input
              v-model="cadastro.password_confirmation"
              outlined
              dense
              label="Confirmar senha *"
              type="password"
              autocomplete="new-password"
              :disable="registrando"
              :rules="[(val) => (!!val && val === cadastro.password) || 'As senhas não conferem']"
            />
          </q-card-section>

          <q-card-actions align="right" class="q-pa-md">
            <q-btn
              flat
              no-caps
              label="Cancelar"
              color="primary"
              :disable="registrando"
              v-close-popup
            />
            <q-btn
              no-caps
              label="Confirmar registro"
              color="primary"
              unelevated
              :loading="registrando"
              type="submit"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import CardPerfilUsuario from 'src/components/usuarios/CardPerfilUsuario.vue'
import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue', 'created'])
const $q = useQuasar()

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const confirmacao = ref(false)
const registrando = ref(false)
const usuarios = ref([])
const usuario = ref(null)
const loading = ref(false)
const search = ref('')
const cadastro = reactive({ email: '', telefone: '', password: '', password_confirmation: '' })
const erros = ref({})

const pagination = ref({
  page: 1,
  rowsPerPage: 5,
  rowsNumber: 0,
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' },
  { name: 'usuario', label: 'Nome', field: 'name', align: 'left' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

function selectRow(row) {
  usuario.value = row
  Object.assign(cadastro, { email: '', telefone: '', password: '', password_confirmation: '' })
  erros.value = {}
  confirmacao.value = true
}

function onBeforeShow() {
  confirmacao.value = false
  usuario.value = null
  search.value = ''
  pagination.value.page = 1
  usuarios.value = []
  buscarDados()
}

async function criarMotorista() {
  if (registrando.value || !usuario.value?.id) return

  registrando.value = true
  erros.value = {}
  try {
    const response = await api.post('/motoristas', {
      user_id: usuario.value.id,
      email: cadastro.email.trim(),
      telefone: cadastro.telefone || null,
      password: cadastro.password,
      password_confirmation: cadastro.password_confirmation,
    })
    $q.notify({ type: 'positive', message: response.data.message })
    confirmacao.value = false
    model.value = false
    emit('created')
  } catch (error) {
    erros.value = Object.fromEntries(
      Object.entries(error.response?.data?.errors || {}).map(([campo, mensagens]) => [
        campo,
        mensagens[0],
      ]),
    )
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível registrar o motorista.',
    })
  } finally {
    registrando.value = false
  }
}

function pesquisarUsuarios() {
  pagination.value.page = 1
  buscarDados()
}

function clearSearch() {
  search.value = ''
  pesquisarUsuarios()
}

async function buscarDados(payload) {
  loading.value = true
  const { page, rowsPerPage } = payload?.pagination ?? pagination.value
  try {
    const response = await api.get('/users', {
      params: {
        search: search.value || '',
        page,
        rowsPerPage,
      },
    })

    const data = response.data
    usuarios.value = data.data
    pagination.value.rowsNumber = data.total
    pagination.value.page = data.current_page
    pagination.value.rowsPerPage = data.per_page === data.total ? 0 : data.per_page
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.message || 'Não foi possível carregar os usuários.',
    })
  } finally {
    loading.value = false
  }
}
</script>
