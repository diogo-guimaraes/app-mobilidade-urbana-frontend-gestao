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
        path: 'plataforma-ganhos',
        component: () => import('src/pages/financeiro/PaginaGanhosPlataforma.vue'),
        meta: { permissao: 'financeiro.consultar' },
      },
      {
        path: 'motoristas-ganhos',
        component: () => import('src/pages/financeiro/PaginaGanhosMotoristas.vue'),
        meta: { permissao: 'financeiro.consultar' },
      },
      {
        path: 'motoristas-saldo',
        component: () => import('src/pages/financeiro/PaginaMotoristasSaldo.vue'),
        meta: { permissao: 'financeiro.consultar' },
      },
      {
        path: 'central-ajuda',
        component: () => import('src/pages/ajuda/PaginaCentralAjuda.vue'),
        meta: { permissao: 'ajuda.gerenciar' },
      },
      {
        path: 'dashboard',
        component: () => import('pages/IndexPage.vue'),
      },

      {
        path: 'administracao/regras',
        component: () => import('src/pages/administracao/PaginaRegras.vue'),
        meta: { permissao: 'regras.gerenciar' },
      },
      {
        path: 'sem-acesso',
        component: () => import('src/pages/SemAcesso.vue'),
      },
      {
        path: 'usuarios',
        meta: { permissao: 'usuarios.consultar' },
        component: () => import('src/pages/usuarios/PaginaUsuarios.vue'),
      },

      {
        path: 'gestores',
        meta: { permissao: 'gestores.gerenciar' },
        component: () => import('src/pages/usuarios/PaginaGestores.vue'),
      },

      {
        path: 'motoristas',
        meta: { permissao: 'usuarios.consultar' },
        component: () => import('src/pages/usuarios/PaginaMotoristas.vue'),
      },

      {
        path: 'passageiros',
        meta: { permissao: 'usuarios.consultar' },
        component: () => import('src/pages/usuarios/PaginaPassageiros.vue'),
      },

      {
        path: 'corridas',
        meta: { permissao: 'corridas.consultar' },
        component: () => import('src/pages/PaginaCorridas.vue'),
      },

      {
        path: 'veiculos',
        meta: { permissao: 'veiculos.consultar' },
        component: () => import('src/pages/PaginaVeiculos.vue'),
      },

      {
        path: 'tarifas',
        meta: { permissao: 'configuracoes.gerenciar' },
        component: () => import('src/pages/PaginaTarifas.vue'),
      },

      {
        path: 'produtos-corridas',
        meta: { permissao: 'configuracoes.gerenciar' },
        component: () => import('src/pages/PaginaProdutosCorridas.vue'),
      },

      {
        path: 'produto-categorias',
        meta: { permissao: 'configuracoes.gerenciar' },
        component: () => import('src/pages/PaginaProdutoCategorias.vue'),
      },
      {
        path: 'publicidades',
        meta: { permissao: 'configuracoes.gerenciar' },
        component: () => import('src/pages/midias/PaginaMidias.vue'),
      },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
