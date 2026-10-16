<template>
  <q-page class="flex flex-center q-pa-lg">
    <q-card flat bordered class="q-pa-xl text-center" style="max-width: 480px; border-radius: 16px">
      <q-avatar size="72px" color="blue-1" text-color="primary" icon="lock_outline" />
      <div class="text-h5 text-weight-bold q-mt-lg">Acesso restrito</div>
      <p class="text-grey-7 q-mt-sm">
        Seu perfil não tem permissão para acessar esta página. Fale com um administrador se precisar
        desse acesso.
      </p>
      <q-btn color="primary" label="Voltar ao início" to="/dashboard" no-caps />
    </q-card>
  </q-page>
</template>
