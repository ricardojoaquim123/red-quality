<script setup>
import { ref } from 'vue'
// Importa o "controle remoto" do roteador
import { useRouter } from 'vue-router'
// Importa nossa conexão do Supabase
import { supabase } from '@/supabase'
// Importa o "cérebro" do frontend
import { useAuthStore } from '@/stores/authStore'

// Inicializa as ferramentas
const router = useRouter()
const authStore = useAuthStore()

// Nossas variáveis reativas
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref(null) // Para mostrar erros de login

// Esta é a nossa LÓGICA DE LOGIN
async function handleLogin() {
  loading.value = true
  errorMessage.value = null
  
  try {
    // Pega o nome de usuário que a pessoa digitou
    let loginEmail = username.value
    
    // === A "TRAPAÇA" INTELIGENTE ===
    // Se o que foi digitado NÃO contiver um "@",
    // nós assumimos que é um nome de usuário e adicionamos nosso domínio falso.
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@redquality.system`
    }
    // ================================

    // Tenta fazer o login no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password.value,
    })

    if (error) {
      // Se o Supabase der um erro...
      console.error('Erro no login:', error.message)
      errorMessage.value = 'Usuário ou senha inválidos.'
      throw error // Pára a execução
    }

    // SUCESSO!
    console.log('Login bem-sucedido!', data.session)
    // 1. Avisa o "cérebro" (Pinia) que estamos logados
    authStore.setSession(data.session)
    // 2. Manda o usuário para a página principal (Dashboard)
    router.push('/')

  } catch (error) {
    // Apenas para garantir que o loading pare se der erro
  } finally {
    // Aconteça o que acontecer (sucesso ou erro),
    // o botão de login é liberado.
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <h1>Red-Quality</h1>
      <p class="subtitle">Gestão de Fornecedores</p>
      
      <form class="login-form" @submit.prevent="handleLogin">
        
        <div class="input-group">
          <label for="username">Usuário</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            placeholder="ex: ricardo.lucena"
            required 
          />
        </div>
        
        <div class="input-group">
          <label for="password">Senha</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            placeholder="••••••••"
            required 
          />
        </div>

        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>
        
        <button type="submit" class="login-button" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* (O CSS da <style scoped> permanece exatamente o mesmo de antes) */
/* ... (vou omitir para ser breve, mas não apague o seu!) ... */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  font-family: Arial, sans-serif;
}
.login-box {
  background: #ffffff;
  padding: 2.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 400px;
  text-align: center;
}
h1 {
  color: #333;
  margin-bottom: 0.5rem;
}
.subtitle {
  color: #555;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}
.login-form {
  text-align: left;
}
.input-group {
  margin-bottom: 1.5rem;
}
.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #444;
}
.input-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 1rem;
}
.login-button {
  width: 100%;
  padding: 0.85rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}
.login-button:hover {
  background-color: #0056b3;
}
.login-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
/* Adicionamos este estilo para a mensagem de erro */
.error-message {
  color: #dc3545; /* Vermelho */
  text-align: center;
  margin-bottom: 1rem;
}
</style>