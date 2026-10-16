<template>
  <q-page class="q-pa-md pagina-regras">
    <UsuariosRegra v-model="dialog" :regra="selecionada" @updated="carregar" />
    <q-card flat bordered class="regras-cabecalho q-mb-lg">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar
          rounded
          size="52px"
          color="blue-1"
          text-color="primary"
          icon="admin_panel_settings"
        />
        <div class="col">
          <div class="text-caption text-grey-7">Administração</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Regras de acesso</h1>
          <div class="text-grey-7 q-mt-xs">
            Defina o que cada gestor pode acessar e fazer no painel.
          </div>
        </div>
        <div class="col-12 col-sm-auto">
          <q-badge color="blue-1" text-color="primary" class="q-pa-sm"
            >{{ totalGestores }} gestores ativos</q-badge
          >
        </div>
      </q-card-section>
    </q-card>
    <div class="row items-center q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6">
        <q-input v-model="busca" outlined dense clearable label="Pesquisar regra">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-12 col-sm-6 text-grey-7">Cada gestor pertence a um perfil de acesso.</div>
    </div>
    <div v-if="carregando" class="text-center q-pa-xl" role="status">
      <q-spinner color="primary" size="36px" />
      <div class="q-mt-sm">Carregando regras...</div>
    </div>
    <q-banner v-else-if="erro" rounded class="bg-red-1 text-negative">
      {{ erro
      }}<template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
    </q-banner>
    <div v-else class="row q-col-gutter-lg">
      <div v-for="regra in filtradas" :key="regra.codigo" class="col-12 col-sm-6 col-lg-3">
        <q-card flat bordered class="regra-card full-height column">
          <q-card-section>
            <div class="row items-center justify-between q-mb-lg">
              <q-avatar
                rounded
                size="48px"
                :color="`${cores[regra.codigo]}-1`"
                :text-color="cores[regra.codigo]"
                :icon="icones[regra.codigo]"
              />
              <q-badge
                :color="`${cores[regra.codigo]}-1`"
                :text-color="cores[regra.codigo]"
                class="q-pa-sm"
                >{{ regra.total_gestores }}
                {{ regra.total_gestores === 1 ? 'usuário' : 'usuários' }}</q-badge
              >
            </div>
            <h2 class="text-h6 text-weight-bold q-ma-none">{{ regra.nome }}</h2>
            <p class="text-grey-7 q-mt-sm q-mb-none regra-descricao">{{ regra.descricao }}</p>
          </q-card-section>
          <q-separator />
          <q-expansion-item label="Permissões deste perfil" icon="checklist" class="q-px-sm">
            <q-list dense class="q-pb-md">
              <q-item v-for="permissao in regra.permissoes" :key="permissao.codigo">
                <q-item-section avatar style="min-width: 32px"
                  ><q-icon name="check" color="positive" size="18px"
                /></q-item-section>
                <q-item-section>{{ permissao.nome }}</q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
          <q-space />
          <q-card-actions class="q-pa-md">
            <q-btn
              outline
              color="primary"
              icon="group"
              label="Gerenciar usuários"
              no-caps
              class="full-width"
              :aria-label="`Gerenciar usuários de ${regra.nome}`"
              @click="abrir(regra)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!filtradas.length" class="col-12 text-center text-grey-7 q-pa-lg">
        Nenhuma regra encontrada.
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import UsuariosRegra from 'src/components/administracao/UsuariosRegra.vue'
const regras = ref([]),
  busca = ref(''),
  carregando = ref(false),
  erro = ref(''),
  dialog = ref(false),
  selecionada = ref(null)
const cores = {
  atendimento: 'blue',
  suporte_tecnico: 'deep-purple',
  gestao: 'teal',
  admin: 'indigo',
}
const icones = {
  atendimento: 'support_agent',
  suporte_tecnico: 'engineering',
  gestao: 'assignment_ind',
  admin: 'admin_panel_settings',
}
const totalGestores = computed(() =>
  regras.value.reduce((total, regra) => total + regra.total_gestores, 0),
)
const filtradas = computed(() =>
  regras.value.filter((regra) =>
    `${regra.nome} ${regra.descricao}`
      .toLocaleLowerCase('pt-BR')
      .includes((busca.value || '').toLocaleLowerCase('pt-BR')),
  ),
)
function abrir(regra) {
  selecionada.value = regra
  dialog.value = true
}
async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    regras.value = (await api.get('/administracao/regras')).data.data
  } catch (e) {
    erro.value = e.response?.data?.message || 'Não foi possível carregar as regras.'
  } finally {
    carregando.value = false
  }
}
onMounted(carregar)
</script>

<style scoped>
.regras-cabecalho,
.regra-card {
  border-radius: 14px;
}
.regra-descricao {
  min-height: 48px;
}
.regra-card {
  transition: box-shadow 0.2s;
}
.regra-card:hover {
  box-shadow: 0 6px 20px #0000000a;
}
</style>
