<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex bg-image flex-center">
        <q-card v-bind:style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }">
          <q-card-section>
            <q-avatar size="103px" class="absolute-center shadow-10">
              <img src="profile.svg" />
            </q-avatar>
          </q-card-section>
          <q-card-section>
            <div class="text-center q-pt-lg">
              <div class="col text-h6 ellipsis">Acesso à gestão</div>
            </div>
          </q-card-section>
          <q-card-section>
            <q-form @submit="onSubmit" class="q-gutter-md">
              <q-input
                filled
                type="email"
                label="E-mail"
                autocomplete="username"
                lazy-rules
                :rules="[(val) => !!val?.trim() || 'Informe o e-mail']"
                v-model="form.email"
              />

              <q-input
                type="password"
                filled
                v-model="form.password"
                label="Senha"
                autocomplete="current-password"
                lazy-rules
                :rules="[(val) => !!val || 'Informe a senha']"
              />

              <div>
                <q-btn :loading="isLoading" label="Entrar" type="submit" color="primary" />
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth' // Importa a store que criamos
import { customNotify } from 'src/boot/notify'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore() // Inicializa a store

// Agrupando os dados do formulário
const form = reactive({
  email: '', // Ideal deixar vazio em produção
  password: '',
  remember: false, // Alterado para 'remember' para bater com o padrão do Laravel
})

const isLoading = ref(false)

const onSubmit = async () => {
  isLoading.value = true

  try {
    // Dispara a ação de login lá na Store
    await authStore.login(form)

    // Se deu certo, mostra mensagem de sucesso
    customNotify({
      type: 'positive',
      message: 'Login realizado com sucesso!',
      position: 'top-right',
    })

    // Redireciona para o painel administrativo
    router.push('/dashboard') // Mude para o nome correto da sua rota inicial logada
  } catch (error) {
    // Tenta pegar a mensagem de erro retornada pelo Laravel (ex: 422 Unprocessable Entity ou 401 Unauthorized)
    let errorMessage = 'Falha ao realizar login. Verifique o servidor.'

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    }
    customNotify({
      type: 'negative',
      message: errorMessage,
      position: 'top-right',
      timeout: 3000,
    })
  } finally {
    // Desliga o spinner do botão independentemente de sucesso ou erro
    isLoading.value = false
  }
}
</script>

<style>
.bg-image {
  background-image: linear-gradient(135deg, #7028e4 0%, #e5b2ca 100%);
}
</style>
