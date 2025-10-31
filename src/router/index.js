// Código COMPLETO e FINAL para: src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import AppLayout from '../layouts/AppLayout.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true }, // Protege todas as rotas filhas
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
        { path: '/fornecedores', name: 'fornecedores-lista', component: () => import('../views/FornecedoresView.vue') },
        { path: '/fornecedores/novo', name: 'fornecedores-novo', component: () => import('../views/FornecedorFormView.vue') },
        { path: '/fornecedores/editar/:id', name: 'fornecedores-editar', component: () => import('../views/FornecedorFormView.vue') },
        { path: '/configuracoes', name: 'configuracoes', component: () => import('../views/ConfiguracoesView.vue') },
        { path: '/fornecedores/:id/documentos', name: 'fornecedor-documentos', component: () => import('../views/FornecedorDocumentosView.vue') },
        { path: '/metricas', name: 'monitoramento', component: () => import('../views/MetricasView.vue') },
        { path: '/score', name: 'score-dashboard', component: () => import('../views/ScoreView.vue') },
        
        { path: '/score/historico/:id', name: 'score-historico', component: () => import('../views/ScoreHistoricoView.vue') },
      ]
    }
  ]
})

// --- O "GUARDA" PACIENTE (LIMPO) ---
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  while (!authStore.authReady) {
    await new Promise(res => setTimeout(res, 50)) 
  }

  const isLoggedIn = authStore.isLoggedIn
  const requiresAuth = to.meta.requiresAuth
  const isAdmin = authStore.isAdmin 

  if (to.name === 'configuracoes' && !isAdmin) {
    console.log('Guarda: Acesso de Admin (Configurações) negado. Indo para /dashboard.')
    next({ name: 'dashboard' }) 
  }
  else if (requiresAuth && !isLoggedIn) {
    console.log('Guarda: Acesso negado. Indo para /login.')
    next({ name: 'login' })
  } 
  else if (to.name === 'login' && isLoggedIn) {
    console.log('Guarda: Usuário já logado. Indo para /dashboard.')
    next({ name: 'dashboard' })
  } 
  else {
    console.log('Guarda: Acesso permitido.')
    next()
  }
})

export default router