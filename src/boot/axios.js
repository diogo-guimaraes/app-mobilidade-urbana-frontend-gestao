// src/boot/axios.js
import { boot } from 'quasar/wrappers'
import axios from 'axios'
import { useAuthStore } from 'src/stores/auth'

const apiBaseUrl = (process.env.API_URL || '/api').replace(/\/+$/, '')
const api = axios.create({
  baseURL: apiBaseUrl.endsWith('/gestao') ? apiBaseUrl : `${apiBaseUrl}/gestao`,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export default boot(({ app, router }) => {
  api.interceptors.request.use(
    (config) => {
      // Busca o token do LocalStorage
      const token = localStorage.getItem('token')

      // Se o token existir, injeta ele no cabeçalho Authorization do Axios
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      return config
    },
    (error) => {
      return Promise.reject(error)
    },
  )

  api.interceptors.response.use(
    (response) => {
      // Se deu 200/201 (Sucesso), apenas deixa a resposta passar
      return response
    },
    async (error) => {
      // Se o Laravel retornar erro 401 (Não Autorizado / Token Expirado)
      if (error.response && error.response.status === 401) {
        // Instanciamos o Pinia AQUI dentro para evitar erro de inicialização
        const authStore = useAuthStore()

        const request = error.config
        const authRequest = /^\/?auth\/(login|refresh|logout)(?:\?|$)/.test(request?.url || '')
        if (request && !request._retry && !authRequest && authStore.token) {
          request._retry = true
          try {
            const token = await authStore.refreshToken()
            request.headers.Authorization = `Bearer ${token}`
            return api(request)
          } catch {
            // A sessão será encerrada quando a renovação falhar.
          }
        }

        // Limpa os dados do usuário e remove o token inválido
        authStore.clearSession()

        // Empurra o usuário de volta para a tela de login
        router.push('/login')
      }

      // Devolve o erro adiante para o componente Vue (para mostrar o Toast/Notify vermelho)
      return Promise.reject(error)
    },
  )
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})

export { api }
