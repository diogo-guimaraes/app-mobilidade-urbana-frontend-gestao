<template>
  <q-layout view="hHh lpR fFf" class="bg-grey-1">
    <q-header elevated class="bg-white text-grey-8 q-py-xs" height-hint="58">
      <q-toolbar>
        <q-btn flat dense round @click="toggleLeftDrawer" aria-label="Menu" icon="menu" />

        <q-avatar class="cursor-pointer q-ml-xs">
          <img src="https://cdn.quasar.dev/logo-v2/svg/logo.svg" />
        </q-avatar>

        <q-space />

        <div class="q-gutter-sm row items-center no-wrap">
          <q-btn round dense flat color="grey-8" icon="video_call" v-if="$q.screen.gt.sm">
            <q-tooltip>Create a video or post</q-tooltip>
          </q-btn>
          <q-btn round dense flat color="grey-8" icon="apps" v-if="$q.screen.gt.sm">
            <q-tooltip>Apps</q-tooltip>
          </q-btn>
          <q-btn round dense flat color="grey-8" icon="message" v-if="$q.screen.gt.sm">
            <q-tooltip>Messages</q-tooltip>
          </q-btn>
          <q-btn round dense flat color="grey-8" icon="notifications">
            <q-badge color="red" text-color="white" floating> 2 </q-badge>
            <q-tooltip>Notifications</q-tooltip>
          </q-btn>
          <q-btn round flat aria-label="Conta do gestor">
            <q-avatar v-if="user?.foto" size="26px">
              <img :src="user.foto" />
            </q-avatar>
            <q-avatar v-else color="primary" text-color="white">
              {{ user?.name?.charAt(0) }}
            </q-avatar>
            <q-menu>
              <q-list style="min-width: 200px">
                <q-item>
                  <q-item-section>
                    <q-item-label class="text-weight-bold">{{ user?.name }}</q-item-label>
                    <q-item-label caption>{{ user?.email }}</q-item-label>
                    <q-item-label caption>{{ user?.perfil_acesso_nome }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable role="button" :disable="saindo" @click="logout" v-close-popup>
                  <q-item-section avatar><q-icon name="logout" /></q-item-section>
                  <q-item-section>Sair</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered class="bg-grey-2" :width="240">
      <q-scroll-area class="fit">
        <q-list padding>
          <q-item v-for="link in links1" :key="link.text" v-ripple clickable :to="link.to">
            <q-item-section avatar>
              <q-icon color="grey" :name="link.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ link.text }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-expansion-item
            v-if="pode('configuracoes.gerenciar')"
            icon="settings"
            label="Configurações"
          >
            <q-item clickable to="/produtos-corridas" class="q-pl-xl"
              ><q-item-section avatar><q-icon name="apps" /></q-item-section
              ><q-item-section>Produtos</q-item-section></q-item
            >
            <q-item clickable to="/produto-categorias" class="q-pl-xl"
              ><q-item-section avatar><q-icon name="category" /></q-item-section
              ><q-item-section>Categorias</q-item-section></q-item
            >
            <q-item clickable to="/tarifas" class="q-pl-xl"
              ><q-item-section avatar><q-icon name="attach_money" /></q-item-section
              ><q-item-section>Tarifas</q-item-section></q-item
            >
          </q-expansion-item>
          <q-expansion-item
            v-if="pode('regras.gerenciar')"
            icon="admin_panel_settings"
            label="Administração"
          >
            <q-item clickable to="/administracao/regras" class="q-pl-xl"
              ><q-item-section avatar><q-icon name="rule" /></q-item-section
              ><q-item-section>Regras</q-item-section></q-item
            >
          </q-expansion-item>
          <q-separator class="q-my-md" />

          <q-item v-ripple clickable :disable="saindo" @click="logout">
            <q-item-section avatar>
              <q-icon color="grey" name="exit_to_app" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Sair</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { fabYoutube } from '@quasar/extras/fontawesome-v6'
import { useAuthStore } from 'src/stores/auth'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
export default {
  name: 'MyLayout',

  setup() {
    const leftDrawerOpen = ref(false)
    const search = ref('')

    function toggleLeftDrawer() {
      leftDrawerOpen.value = !leftDrawerOpen.value
    }

    const authStore = useAuthStore()
    const user = computed(() => authStore.user)
    const router = useRouter()
    const saindo = ref(false)

    async function logout() {
      if (saindo.value) return
      saindo.value = true
      try {
        await authStore.logout()
      } catch {
        // O estado local é limpo mesmo se o servidor estiver indisponível.
      } finally {
        saindo.value = false
        await router.replace('/login')
      }
    }

    return {
      user,
      pode: authStore.pode,
      saindo,
      logout,
      fabYoutube,
      leftDrawerOpen,
      search,
      toggleLeftDrawer,

      links1: computed(() =>
        [
          { icon: 'groups_2', text: 'Usuários', to: '/usuarios', permissao: 'usuarios.consultar' },
          {
            icon: 'manage_accounts',
            text: 'Gestores',
            to: '/gestores',
            permissao: 'gestores.gerenciar',
          },
          {
            icon: 'directions_car',
            text: 'Veículos',
            to: '/veiculos',
            permissao: 'veiculos.consultar',
          },
          { icon: 'group', text: 'Motoristas', to: '/motoristas', permissao: 'usuarios.consultar' },
          {
            icon: 'account_balance_wallet',
            text: 'Motoristas saldo',
            to: '/motoristas-saldo',
            permissao: 'financeiro.consultar',
          },
          {
            icon: 'payments',
            text: 'Ganhos',
            to: '/motoristas-ganhos',
            permissao: 'financeiro.consultar',
          },
          {
            icon: 'account_balance',
            text: 'Ganhos da plataforma',
            to: '/plataforma-ganhos',
            permissao: 'financeiro.consultar',
          },
          {
            icon: 'groups_2',
            text: 'Passageiros',
            to: '/passageiros',
            permissao: 'usuarios.consultar',
          },
          { icon: 'no_crash', text: 'Corridas', to: '/corridas', permissao: 'corridas.consultar' },
          {
            icon: 'help_center',
            text: 'Central de ajuda',
            to: '/central-ajuda',
            permissao: 'ajuda.gerenciar',
          },
          {
            icon: 'photo',
            text: 'Central de publicidade',
            to: '/publicidades',
            permissao: 'configuracoes.gerenciar',
          },
        ].filter((link) => authStore.pode(link.permissao)),
      ),
      links2: [
        { icon: 'folder', text: 'Library' },
        { icon: 'restore', text: 'History' },
        { icon: 'watch_later', text: 'Watch later' },
        { icon: 'thumb_up_alt', text: 'Liked videos' },
      ],
      links3: [
        { icon: fabYoutube, text: 'YouTube Premium' },
        { icon: 'local_movies', text: 'Movies & Shows' },
        { icon: 'videogame_asset', text: 'Gaming' },
        { icon: 'live_tv', text: 'Live' },
      ],
      links4: [
        { icon: 'settings', text: 'Settings' },
        { icon: 'flag', text: 'Report history' },
        { icon: 'help', text: 'Help' },
        { icon: 'feedback', text: 'Send feedback' },
      ],
      buttons1: [
        { text: 'About' },
        { text: 'Press' },
        { text: 'Copyright' },
        { text: 'Contact us' },
        { text: 'Creators' },
        { text: 'Advertise' },
        { text: 'Developers' },
      ],
      buttons2: [
        { text: 'Terms' },
        { text: 'Privacy' },
        { text: 'Policy & Safety' },
        { text: 'Test new features' },
      ],
    }
  },
}
</script>

<style lang="sass">
.YL

  &__toolbar-input-container
    min-width: 100px
    width: 55%

  &__toolbar-input-btn
    border-radius: 0
    border-style: solid
    border-width: 1px 1px 1px 0
    border-color: rgba(0,0,0,.24)
    max-width: 60px
    width: 100%

  &__drawer-footer-link
    color: inherit
    text-decoration: none
    font-weight: 500
    font-size: .75rem

    &:hover
      color: #000
</style>
