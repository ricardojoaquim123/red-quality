<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { RouterLink } from 'vue-router'
// --- MUDANÇA AQUI ---
// 1. Importamos o "cérebro" do login
import { useAuthStore } from '@/stores/authStore'

// --- MUDANÇA AQUI ---
// 2. Criamos uma instância dele para usar no template
const authStore = useAuthStore()

const listaFornecedores = ref([])
const loadingList = ref(true)

async function fetchFornecedores() {
  loadingList.value = true
  listaFornecedores.value = []
  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select(`
        id,
        nome,
        cnpj_id_fiscal,
        status_homologacao,
        grupos_fornecedor ( nome_grupo )
      `)
      .order('nome', { ascending: true })

    if (error) throw error
    listaFornecedores.value = data
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error.message)
    alert('Erro ao buscar fornecedores. Veja o console.')
  } finally {
    loadingList.value = false
  }
}

async function deleteFornecedor(id, nome) {
  // A própria função já é segura (o RLS do Supabase bloqueia)
  // mas o botão que a chama agora estará escondido.
  if (!window.confirm(`Tem certeza que deseja excluir o fornecedor "${nome}"?`)) {
    return
  }
  try {
    const { error } = await supabase
      .from('fornecedores')
      .delete()
      .eq('id', id)
    if (error) throw error
    alert('Fornecedor excluído com sucesso!')
    await fetchFornecedores() // Recarrega a lista
  } catch (error) {
    console.error('Erro ao deletar:', error.message)
    // --- MELHORIA DE ERRO ---
    // Se um usuário comum (não-admin) tentar deletar (ex: burlando o HTML),
    // o RLS do Supabase vai dar um erro de "new row violates row-level security policy".
    // Mostramos uma mensagem amigável.
    if (error.message.includes('security policy')) {
      alert('Erro: Você não tem permissão para excluir fornecedores.')
    } else {
      alert('Erro ao deletar fornecedor.')
    }
  }
}

// Roda a busca quando o componente carregar
onMounted(() => {
  fetchFornecedores()
})
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Gestão de Fornecedores</h2>
      <RouterLink 
        v-if="authStore.isAdmin" 
        to="/fornecedores/novo" 
        class="button-novo"
      >
        + Novo Fornecedor
      </RouterLink>
    </div>
    
    <section class="list-section">
      <h3>Fornecedores Cadastrados</h3>
      
      <div v-if="loadingList" class="loading">
        Carregando lista...
      </div>
      
      <ul 
        v-else-if="listaFornecedores.length > 0" 
        class="fornecedor-list"
        :class="authStore.isAdmin ? 'is-admin' : 'is-user'"
      >
        <li class="fornecedor-item header-list">
          <strong>Nome</strong>
          <span>Grupo</span>
          <span>CNPJ</span>
          <span>Status</span>
          <span v-if="authStore.isAdmin" class="actions">Ações</span>
        </li>
        
        <li v-for="fornecedor in listaFornecedores" :key="fornecedor.id" class="fornecedor-item">
          <strong>{{ fornecedor.nome }}</strong>
          
          <span>{{ fornecedor.grupos_fornecedor?.nome_grupo || 'N/A' }}</span>
          
          <span>{{ fornecedor.cnpj_id_fiscal }}</span>
          <span>
            <strong :class="`status-${fornecedor.status_homologacao?.toLowerCase().split(' ')[0]}`">
              {{ fornecedor.status_homologacao || 'N/A' }}
            </strong>
          </span>

          <span v-if="authStore.isAdmin" class="actions">
            
            <RouterLink 
              :to="`/fornecedores/${fornecedor.id}/documentos`" 
              class="button-action button-docs"
            >
              Documentos
            </RouterLink>

            <RouterLink 
              :to="`/fornecedores/editar/${fornecedor.id}`" 
              class="button-action button-edit"
            >
              Editar
            </RouterLink>
            
            <button 
              @click="deleteFornecedor(fornecedor.id, fornecedor.nome)" 
              class="button-action button-delete"
            >
              Excluir
            </button>
          </span>

          <span v-else class="actions">
            <RouterLink 
              :to="`/fornecedores/${fornecedor.id}/documentos`" 
              class="button-action button-docs"
            >
              Ver Documentos
            </RouterLink>
          </span>

        </li>
      </ul>
      
      <div v-else class="empty-list">
        Nenhum fornecedor cadastrado ainda.
        </div>
    </section>
  </div>
</template>

<style scoped>
/* (O CSS deste arquivo está correto) */
h2 { margin-top: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
}
.button-novo {
  background-color: #007bff;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 5px;
  text-decoration: none;
  font-weight: 600;
}
.button-novo:hover { background-color: #0056b3; }
.list-section {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.loading, .empty-list {
  color: #777;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}
.fornecedor-list { list-style: none; padding: 0; margin: 0; }


/* --- MUDANÇA NO CSS ---
     Ajustamos o grid dinamicamente se o usuário é admin ou não */

/* Grid padrão para USUÁRIO COMUM (4 colunas + Ação de Ver) */
.fornecedor-list.is-user .fornecedor-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

/* Grid para ADMIN (4 colunas + Ações de Admin) */
.fornecedor-list.is-admin .fornecedor-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
/* (O grid-template-columns é o mesmo, mas a classe
   'is-user' e 'is-admin' nos permite mudar no futuro se quisermos) */


.fornecedor-item:last-child { border-bottom: none; }
.fornecedor-item.header-list {
  font-weight: 700;
  color: #333;
  border-bottom: 2px solid #ddd;
}
.fornecedor-item strong { color: #333; }
.status-aprovado { color: #28a745; }
.status-reprovado { color: #dc3545; }
.status-em { color: #fd7e14; }
.status-inativo { color: #6c757d; }
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}
.button-action {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 4px;
  text-decoration: none;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}
.button-docs {
  background-color: #28a745; /* Verde */
}
.button-edit {
  background-color: #17a2b8; /* Ciano */
}
.button-delete {
  background-color: #dc3545; /* Vermelho */
}

/* --- MUDANÇA NO CSS (Responsivo) ---
     Ajustamos os labels para 5 colunas */
@media (max-width: 900px) {
  .fornecedor-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding-bottom: 1.5rem;
  }
  .fornecedor-item.header-list { display: none; }
  .fornecedor-item span:nth-of-type(1)::before { content: 'Grupo: '; font-weight: 600; }
  .fornecedor-item span:nth-of-type(2)::before { content: 'CNPJ: '; font-weight: 600; }
  .fornecedor-item span:nth-of-type(3)::before { content: 'Status: '; font-weight: 600; }
  .actions { justify-content: flex-start; margin-top: 0.5rem; }
}
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .button-novo { width: 100%; text-align: center; }
}
</style>