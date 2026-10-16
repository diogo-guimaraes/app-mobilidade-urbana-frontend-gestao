import { route } from 'quasar/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'src/stores/auth'

export default route(function () {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    const token = localStorage.getItem('token')
    if (token) {
      try {
        await authStore.ensureUser()
      } catch {
        if (!authStore.user) authStore.clearSession()
      }
    }

    const isAuthenticated = authStore.isAuthenticated

    // REGRA 1: Se NÃO está autenticado e tenta acessar rota protegida
    if (to.meta.requiresAuth && !isAuthenticated) {
      return '/login'
    }
    if (to.meta.permissao && !authStore.pode(to.meta.permissao)) {
      return '/sem-acesso'
    }

    // REGRA 2: Se ESTÁ autenticado e tenta acessar /login
    if (to.path === '/login' && isAuthenticated) {
      return '/dashboard'
    }

    // REGRA 3: Se ESTÁ autenticado e tenta acessar a raiz (/)
    if (to.path === '/' && isAuthenticated) {
      return '/dashboard'
    }

    // REGRA 4: Se NÃO está autenticado e tenta acessar a raiz (/)
    if (to.path === '/' && !isAuthenticated) {
      return '/login'
    }

    // REGRA 5: Caso contrário, permite a navegação
    return true
  })

  return Router
})
