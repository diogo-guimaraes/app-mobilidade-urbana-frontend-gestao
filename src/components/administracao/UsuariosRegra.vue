<template>
  <q-dialog v-model="aberto" :persistent="salvando" @before-show="iniciar" @hide="cancelarConsulta">
    <q-card class="usuarios-regra">
      <q-toolbar class="q-pa-md">
        <q-avatar rounded color="blue-1" text-color="primary" icon="group" />
        <q-toolbar-title>
          <div class="text-h6 text-weight-bold">{{ regra?.nome }}</div>
          <div class="text-caption text-grey-7">
            {{
              adicionar
                ? 'Escolha os gestores que receberão este perfil'
                : 'Usuários deste perfil de acesso'
            }}
          </div>
        </q-toolbar-title>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Fechar usuários da regra"
          :disable="salvando"
          v-close-popup
        />
      </q-toolbar>
      <q-separator />
      <q-card-section>
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-btn
            v-if="!adicionar"
            color="primary"
            icon="person_add_alt"
            label="Adicionar usuários"
            no-caps
            @click="trocarModo(true)"
          />
          <q-btn
            v-else
            flat
            color="primary"
            icon="arrow_back"
            label="Usuários vinculados"
            no-caps
            :disable="salvando"
            @click="trocarModo(false)"
          />
          <q-space /><q-badge v-if="adicionar && selecionados.length" color="primary"
            >{{ selecionados.length }} selecionados</q-badge
          >
        </div>
        <q-banner v-if="adicionar" rounded class="bg-blue-1 text-primary q-mb-md">
          Os selecionados passarão a ter o perfil {{ regra?.nome }}. O perfil anterior será
          substituído.
        </q-banner>
        <q-input
          v-model="busca"
          outlined
          dense
          clearable
          debounce="300"
          label="Pesquisar por nome, e-mail ou CPF"
          :disable="salvando"
          @update:model-value="pesquisar"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </q-card-section>
      <q-banner v-if="erro" class="bg-red-1 text-negative q-mx-md q-mb-md" rounded>
        {{ erro
        }}<template #action><q-btn flat label="Tentar novamente" @click="carregar()" /></template>
      </q-banner>
      <q-table
        flat
        :rows="gestores"
        :columns="colunas"
        row-key="id"
        :loading="carregando"
        :selection="adicionar ? 'multiple' : 'none'"
        v-model:selected="selecionados"
        v-model:pagination="paginacao"
        :rows-per-page-options="[8, 15, 30]"
        rows-per-page-label="Registros por página"
        :no-data-label="
          adicionar ? 'Nenhum outro gestor encontrado.' : 'Nenhum usuário neste perfil.'
        "
        @request="carregar"
      >
        <template #body-cell-usuario="slot">
          <q-td :props="slot"><CardPerfilGestor :gestor="slot.row" /></q-td>
        </template>
        <template #body-cell-perfil="slot">
          <q-td :props="slot"
            ><q-badge color="blue-1" text-color="primary" :label="slot.row.perfil_acesso_nome"
          /></q-td>
        </template>
      </q-table>
      <q-separator />
      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          flat
          :label="adicionar ? 'Cancelar' : 'Fechar'"
          :disable="salvando"
          @click="adicionar ? trocarModo(false) : (aberto = false)"
        />
        <q-btn
          v-if="adicionar"
          color="primary"
          icon="save"
          label="Aplicar perfil"
          no-caps
          :loading="salvando"
          :disable="!selecionados.length || carregando || !!erro || salvando"
          @click="salvar"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useAuthStore } from 'src/stores/auth'
import CardPerfilGestor from 'src/components/gestores/CardPerfilGestor.vue'
const props = defineProps({ modelValue: Boolean, regra: Object })
const emit = defineEmits(['update:modelValue', 'updated'])
const aberto = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const $q = useQuasar(),
  auth = useAuthStore(),
  router = useRouter()
const gestores = ref([]),
  selecionados = ref([]),
  adicionar = ref(false),
  busca = ref(''),
  carregando = ref(false),
  salvando = ref(false),
  erro = ref('')
const paginacao = ref({ page: 1, rowsPerPage: 8, rowsNumber: 0 })
const colunas = [
  { name: 'usuario', label: 'Usuário', align: 'left' },
  { name: 'perfil', label: 'Perfil atual', align: 'left' },
]
let versao = 0,
  controller
function cancelarConsulta() {
  versao++
  controller?.abort()
  carregando.value = false
}
onUnmounted(cancelarConsulta)
function iniciar() {
  trocarModo(false)
}
function trocarModo(valor) {
  adicionar.value = valor
  selecionados.value = []
  busca.value = ''
  paginacao.value.page = 1
  carregar()
}
function pesquisar() {
  paginacao.value.page = 1
  carregar()
}
async function carregar(payload) {
  controller?.abort()
  controller = new AbortController()
  const atual = ++versao,
    pagina = payload?.pagination || paginacao.value
  carregando.value = true
  erro.value = ''
  try {
    const { data } = await api.get(`/administracao/regras/${props.regra.codigo}/gestores`, {
      params: {
        adicionar: adicionar.value ? 1 : 0,
        search: busca.value || '',
        page: pagina.page,
        rowsPerPage: pagina.rowsPerPage,
      },
      signal: controller.signal,
    })
    if (atual !== versao) return
    gestores.value = data.data
    paginacao.value = {
      page: data.current_page,
      rowsPerPage: data.per_page,
      rowsNumber: data.total,
    }
  } catch (e) {
    if (atual === versao && e.code !== 'ERR_CANCELED') {
      gestores.value = []
      erro.value = e.response?.data?.message || 'Não foi possível carregar os gestores.'
    }
  } finally {
    if (atual === versao) carregando.value = false
  }
}
async function salvar() {
  if (salvando.value || !selecionados.value.length) return
  salvando.value = true
  try {
    const { data } = await api.put(`/administracao/regras/${props.regra.codigo}/gestores`, {
      gestores: selecionados.value.map((g) => g.id),
    })
    await auth.fetchUser()
    $q.notify({ type: 'positive', message: data.message })
    if (!auth.pode('regras.gerenciar')) {
      aberto.value = false
      await router.replace('/dashboard')
      return
    }
    emit('updated')
    trocarModo(false)
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível aplicar o perfil.',
    })
  } finally {
    salvando.value = false
  }
}
</script>

<style scoped>
.usuarios-regra {
  width: 800px;
  max-width: 95vw;
  border-radius: 14px;
}
</style>
