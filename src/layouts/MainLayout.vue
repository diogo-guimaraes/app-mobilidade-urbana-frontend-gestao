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
          <q-btn round flat>
            <q-avatar v-if="user?.foto_thumbnail" size="26px">
              <img :src="user?.foto_thumbnail" />
            </q-avatar>
            <q-avatar v-else color="primary" text-color="white">
              {{ user.name.substr(0, 1) }}
            </q-avatar>
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

          <q-expansion-item label="Menu Levels">
            <template #header>
              <q-item-section class="q-pl-md" thumbnail>
                <q-icon name="settings" :color="$q.dark.isActive ? 'white' : 'grey'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="q-pl-md">Gestão</q-item-label>
              </q-item-section>
            </template>

            <q-item class="q-ml-xl" active-class="q-item-no-link-highlighting">
              <q-item-section class="q-pl-md" thumbnail>
                <q-icon name="apps" :color="$q.dark.isActive ? 'white' : 'grey'" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Produtos</q-item-label>
              </q-item-section>
            </q-item>

            <q-item class="q-ml-xl" active-class="q-item-no-link-highlighting">
              <q-item-section class="q-pl-md" thumbnail>
                <q-icon name="category" :color="$q.dark.isActive ? 'white' : 'grey'" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Produtos categorias</q-item-label>
              </q-item-section>
            </q-item>

            <q-item
              clickable
              @click="$router.push('/tarifas')"
              class="q-ml-xl"
              active-class="q-item-no-link-highlighting"
            >
              <q-item-section class="q-pl-md" thumbnail>
                <q-icon name="attach_money" :color="$q.dark.isActive ? 'white' : 'grey'" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Tarifas</q-item-label>
              </q-item-section>
            </q-item>

            <!-- <q-expansion-item :header-inset-level="0.85" label="Level 2">
              <q-item
                class="q-ml-xl"
                style="margin-left: 55px !important"
                active-class="q-item-no-link-highlighting"
              >
                <q-item-section>
                  <q-item-label>Level 2.1</q-item-label>
                </q-item-section>
              </q-item>
              <q-expansion-item :header-inset-level="1" label="Level 2.2">
                <q-item
                  style="margin-left: 65px !important"
                  active-class="q-item-no-link-highlighting"
                >
                  <q-item-section>
                    <q-item-label>Level 2.2.1</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item
                  style="margin-left: 65px !important"
                  active-class="q-item-no-link-highlighting"
                >
                  <q-item-section>
                    <q-item-label>Level 2.2.2</q-item-label>
                  </q-item-section>
                </q-item>
              </q-expansion-item>
            </q-expansion-item> -->
          </q-expansion-item>

          <q-separator class="q-my-md" />

          <q-item v-ripple clickable>
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

    return {
      user,
      fabYoutube,
      leftDrawerOpen,
      search,
      toggleLeftDrawer,

      links1: [
        { icon: 'groups_2', text: 'Usuarios', to: '/usuarios' },
        { icon: 'directions_car', text: 'Veículos', to: '/veiculos' },
        { icon: 'group', text: 'Motoristas', to: '/motoristas' },
        { icon: 'groups_2', text: 'Passageiros', to: '/passageiros' },
        { icon: 'no_crash', text: 'Corridas', to: '/corridas' },
        { icon: 'help_center', text: 'Central de ajuda', to: '/usuarios1' },
      ],
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