const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },

  {
    path: '/login',
    component: () => import('src/pages/LoginUsuario.vue'),
  },

  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        component: () => import('pages/IndexPage.vue'),
      },

      {
        path: 'usuarios',
        component: () =>
          import('src/pages/usuarios/PaginaUsuarios.vue'),
      },

      {
        path: 'motoristas',
        component: () =>
          import('src/pages/usuarios/PaginaMotoristas.vue'),
      },

      {
        path: 'passageiros',
        component: () =>
          import('src/pages/usuarios/PaginaPassageiros.vue'),
      },

      {
        path: 'veiculos',
        component: () =>
          import('src/pages/PaginaVeiculos.vue'),
      },

      {
        path: 'corridas',
        component: () =>
          import('src/pages/PaginaCorridas.vue'),
      },

      {
        path: 'tarifas',
        component: () =>
          import('src/pages/PaginaTarifas.vue'),
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes