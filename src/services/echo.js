import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { ref } from 'vue'
import { api } from 'boot/axios'

let echo = null
export const conectadoChat = ref(false)

export function getEcho() {
  if (echo) return echo
  if (!process.env.REVERB_APP_KEY) return null
  const secure = process.env.REVERB_SCHEME === 'https'
  echo = new Echo({
    broadcaster: 'reverb',
    Pusher,
    key: process.env.REVERB_APP_KEY,
    wsHost: process.env.REVERB_HOST || window.location.hostname,
    wsPort: Number(process.env.REVERB_PORT || 8080),
    wssPort: Number(process.env.REVERB_PORT || 443),
    forceTLS: secure,
    enabledTransports: secure ? ['wss'] : ['ws', 'wss'],
    // O interceptor usa o JWT atual e renova a sessão quando necessário.
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        api
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then(({ data }) => callback(null, data))
          .catch((error) => callback(error, null))
      },
    }),
  })
  echo.connector.pusher.connection.bind('state_change', ({ current }) => {
    conectadoChat.value = current === 'connected'
  })
  return echo
}

export function disconnectEcho() {
  echo?.disconnect()
  echo = null
  conectadoChat.value = false
}
