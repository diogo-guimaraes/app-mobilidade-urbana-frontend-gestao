import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from 'boot/axios'
import { disconnectEcho } from 'src/services/echo'

const USER_REFRESH_INTERVAL = 60_000

export const useAuthStore = defineStore('auth', () => {
  // --- STATE ---
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)
  let refreshPromise = null
  let userRequest = null
  let userFetchedAt = 0
  let sessionVersion = 0

  // --- GETTERS ---
  const isAuthenticated = computed(() => !!token.value)
  const getUser = computed(() => user.value)
  const permissoes = computed(() => user.value?.permissoes || [])
  function pode(permissao) {
    return permissoes.value.includes(permissao)
  }

  // --- ACTIONS ---

  // Função para buscar dados do usuário logado
  function fetchUser() {
    if (userRequest) return userRequest
    const version = sessionVersion
    const request = api
      .get('/usuario-logado')
      .then((response) => {
        if (version === sessionVersion) {
          user.value = response.data
          userFetchedAt = Date.now()
        }
        return response
      })
      .catch((error) => {
        if (version === sessionVersion && error.response?.status === 401) clearSession()
        throw error
      })
      .finally(() => {
        if (userRequest === request) userRequest = null
      })
    userRequest = request
    return request
  }

  function ensureUser() {
    // A primeira navegação aguarda as permissões; as seguintes usam a sessão carregada.
    if (!user.value) return fetchUser()
    if (Date.now() - userFetchedAt >= USER_REFRESH_INTERVAL) {
      // Revalida durante a navegação sem bloquear a abertura da página.
      void fetchUser().catch(() => {})
    }
  }

  // Função de login
  async function login(credentials) {
    disconnectEcho()
    const response = await api.post('auth/login', credentials)
    const newToken = response.data.token

    // Guarda o token
    sessionVersion++
    userRequest = null
    userFetchedAt = 0
    user.value = null
    setToken(newToken)

    // Busca dados do usuário
    await fetchUser()

    return response
  }

  // Logout
  function clearSession() {
    disconnectEcho()
    sessionVersion++
    userRequest = null
    userFetchedAt = 0
    user.value = null
    setToken(null)
  }

  async function logout() {
    try {
      if (token.value) await api.post('auth/logout')
    } finally {
      clearSession()
    }
  }

  function refreshToken() {
    if (!refreshPromise) {
      refreshPromise = api
        .post('auth/refresh')
        .then(({ data }) => {
          setToken(data.token)
          return data.token
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  // Define ou remove o token
  function setToken(newToken) {
    token.value = newToken

    if (newToken) {
      localStorage.setItem('token', newToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    } else {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    getUser,
    permissoes,
    pode,
    login,
    logout,
    clearSession,
    refreshToken,
    fetchUser,
    ensureUser,
  }
})
