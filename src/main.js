import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { supabase } from './supabase' 
import { useAuthStore } from './stores/authStore' 

const app = createApp(App)

// 1. Usa o Pinia (cérebro)
app.use(createPinia())

// 2. Pega o authStore (cérebro do login)
const authStore = useAuthStore()

// 3. Configura o "Ouvinte" do Supabase
//    (Esta função NÃO é 'async' e NÃO tem 'await')
supabase.auth.onAuthStateChange((event, session) => {
  // Apenas "chama" o cérebro (fire-and-forget).
  // O 'authStore' (Passo 1) vai se encarregar
  // de buscar o perfil e ligar o 'authReady'.
  authStore.setSession(session)
  
  console.log('onAuthStateChange (main.js) disparado:', event)
})

// 4. USA O ROTEADOR (O "Guarda")
app.use(router)

// 5. MONTA O PWA IMEDIATAMENTE
app.mount('#app')