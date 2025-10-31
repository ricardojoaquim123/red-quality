import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/supabase'

export const useAuthStore = defineStore('authStore', () => {
  
  const session = ref(null)
  const isLoggedIn = ref(false)
  
  // A flag "pronto" começa como 'false'.
  const authReady = ref(false) 
  
  const userProfile = ref(null) 
  const accessLevel = ref(null) 

  const isAdmin = computed(() => accessLevel.value === 'Administrador')
  const userName = computed(() => userProfile.value?.nome_completo || 'Usuário')

  // setSession é 'async'
  async function setSession(newSession) {
    // 1. Limpa os dados antigos, exceto 'authReady'
    session.value = newSession
    isLoggedIn.value = !!newSession
    userProfile.value = null
    accessLevel.value = null

    try {
      if (newSession) {
        // 2. Se for um login, busca o perfil
        const { data, error } = await supabase
          .from('profiles')
          .select('nome_completo, nivel_acesso')
          .eq('id', newSession.user.id)
          .single()
        
        if (error) throw error // Joga para o catch

        // 3. Sucesso! Define o perfil
        userProfile.value = data
        accessLevel.value = data.nivel_acesso
      }
    } catch (error) {
      console.error('Erro ao buscar perfil (ou perfil não existe):', error.message)
      // Não desloga aqui, pois pode causar o loop.
      // Apenas não teremos 'accessLevel'.
      // O usuário ficará logado, mas não será 'isAdmin'.
    } finally {
      // 4. (O MAIS IMPORTANTE)
      //    Não importa se sucesso ou falha, AGORA
      //    o cérebro está "pronto" e pode liberar o "Guarda".
      authReady.value = true
    }
  }

  // clearSession (usado pelo Logout)
  function clearSession() {
    session.value = null
    isLoggedIn.value = false
    userProfile.value = null
    accessLevel.value = null
  }

  return {
    session,
    isLoggedIn,
    authReady, // A flag que o "Guarda" espera
    userProfile,
    accessLevel,
    isAdmin, // O atalho que usaremos na UI
    userName,
    setSession,
    clearSession
  }
})