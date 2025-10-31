<script setup>
import { useRouter, RouterLink, RouterView } from 'vue-router'
import { supabase } from '@/supabase'
import { useAuthStore } from '@/stores/authStore' 

const router = useRouter()
const authStore = useAuthStore() 

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('Erro ao sair:', error.message)
  } finally {
    authStore.clearSession()
    router.push('/login')
  }
}
</script>

<template>
  <div class="app-layout">
    <header class="header">
      <h1 class="logo">Red-Quality</h1>
      
      <nav class="nav-links">
        <RouterLink to="/" class="nav-link">Dashboard</RouterLink>
        <RouterLink to="/fornecedores" class="nav-link">Fornecedores</RouterLink>
        
        <RouterLink to="/metricas" class="nav-link">Monitoramento de Serviços</RouterLink>
        
        <RouterLink to="/score" class="nav-link">Score Fornecedores</RouterLink>

        <template v-if="authStore.isAdmin">
          <RouterLink to="/configuracoes" class="nav-link">Configurações</RouterLink>
        </template>
      </nav>
      
      <div class="user-info">
        Olá, <strong>{{ authStore.userName }}</strong>
        <span class="user-level" v-if="authStore.isAdmin">(Admin)</span>
      </div>

      <button @click="handleLogout" class="logout-button">Sair</button>
    </header>
    
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* (Os estilos permanecem os mesmos da última vez) */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  padding: 1rem 2rem;
  background-color: #ffffff;
  border-bottom: 1px solid #eaeaea;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  flex-wrap: wrap; 
  gap: 1rem; 
}
.logo {
  font-size: 1.5rem;
  color: #333;
  margin-right: 2rem;
}
.nav-links {
  display: flex;
  gap: 1.5rem;
  flex-grow: 1; 
  justify-content: flex-start;
}
.nav-link {
  text-decoration: none;
  color: #555;
  font-weight: 600;
  padding: 0.5rem;
  border-radius: 4px;
}
.nav-link:hover { background-color: #f0f0f0; }
.nav-link.router-link-exact-active { 
  color: #007bff; 
  background-color: #f0f0f0;
}
.user-info {
  margin-left: auto;
  color: #333;
  font-size: 0.9rem;
}
.user-level {
  font-size: 0.8rem;
  color: #dc3545;
  margin-left: 0.25rem;
}
.logout-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.main-content {
  flex-grow: 1; 
  width: 100%;
  max-width: 1400px;
  padding: 2rem;
  margin: 0 auto;
}
@media (max-width: 768px) {
  .header { flex-direction: column; align-items: flex-start; }
  .nav-links { flex-direction: column; width: 100%; gap: 0.5rem; }
  .user-info { margin-left: 0; order: 1; padding: 0.5rem 0; }
  .logout-button { width: 100%; margin-left: 0; order: 2; }
  .main-content { padding: 1rem; }
}
</style>