<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { supabase } from '@/supabase'

// --- Inicialização ---
const route = useRoute()
const router = useRouter()
const fornecedorId = route.params.id
const isEditing = ref(!!fornecedorId)

// --- Variáveis de Estado ---
const formData = ref({
  nome: '',
  cnpj_id_fiscal: '',
  contato_nome: '',
  contato_email: '',
  contato_telefone: '',
  endereco: '',
  escopo_fornecimento: '',
  tipo_material: 'Produtivo',
  categoria_risco: 'Baixo',
  status_homologacao: 'Em Avaliação',
  data_homologacao: null,
  data_ultima_avaliacao: null,
  grupo_fornecedor_id: null,
})
const loading = ref(false)
const pageTitle = ref('Cadastrar Novo Fornecedor')
const listaDeGrupos = ref([])

// --- NOVA VARIÁVEL DE ESTADO PARA O ERRO ---
const errorMsg = ref(null)

// --- Funções ---

async function fetchGrupos() {
  try {
    const { data, error } = await supabase.from('grupos_fornecedor').select('id, nome_grupo')
    if (error) throw error
    listaDeGrupos.value = data
  } catch (err) {
    console.error('Erro ao buscar grupos:', err.message)
  }
}

async function fetchFornecedorData() {
  if (!isEditing.value) {
    fetchGrupos()
    return
  }

  pageTitle.value = 'Editar Fornecedor'
  loading.value = true
  try {
    const [fornecedorRes, gruposRes] = await Promise.all([
      supabase.from('fornecedores').select('*').eq('id', fornecedorId).single(),
      supabase.from('grupos_fornecedor').select('id, nome_grupo')
    ])
    
    if (fornecedorRes.error) throw fornecedorRes.error
    if (gruposRes.error) throw gruposRes.error
    
    formData.value = fornecedorRes.data
    listaDeGrupos.value = gruposRes.data

  } catch (error) {
    console.error('Erro ao buscar dados para edição:', error.message)
    // --- MUDANÇA AQUI ---
    // Usando a nova variável de erro em vez de alert
    errorMsg.value = 'Não foi possível carregar os dados do fornecedor.'
  } finally {
    loading.value = false
  }
}

// 2. Função "Salvar" (Inteligente) - (Permanece a mesma)
async function handleSubmit() {
  loading.value = true
  // --- MUDANÇA AQUI ---
  // Limpa erros antigos antes de tentar salvar
  errorMsg.value = null
  
  if (formData.value.grupo_fornecedor_id === '') {
    formData.value.grupo_fornecedor_id = null
  }
  
  try {
    let error;
    if (isEditing.value) {
      // MODO EDIÇÃO (UPDATE)
      const { error: updateError } = await supabase
        .from('fornecedores')
        .update(formData.value)
        .eq('id', fornecedorId)
      error = updateError
    } else {
      // MODO CADASTRO (INSERT)
      const { error: insertError } = await supabase
        .from('fornecedores')
        .insert([formData.value])
      error = insertError
    }
    if (error) throw error
    
    alert(`Fornecedor ${isEditing.value ? 'atualizado' : 'cadastrado'} com sucesso!`)
    router.push('/fornecedores')

  } catch (error) {
    console.error('Erro ao salvar:', error.message)
    
    // --- MUDANÇA PRINCIPAL AQUI (LÓGICA DE ERRO) ---
    // Removemos o alert() e adicionamos uma lógica inteligente
    if (error.message && error.message.includes('fornecedores_cnpj_id_fiscal_key')) {
      errorMsg.value = 'Erro: Este CNPJ/ID Fiscal já está cadastrado no sistema.'
    } else {
      errorMsg.value = `Ocorreu um erro inesperado ao salvar: ${error.message}`
    }

  } finally {
    loading.value = false
  }
}

// 3. 'onMounted' (Roda quando a página carrega)
onMounted(() => {
  fetchFornecedorData()
})
</script>

<template>
  <div>
    <h2>{{ pageTitle }}</h2>

    <section class="form-section">
      <div v-if="!loading && errorMsg && !isEditing" class="error-message">
        {{ errorMsg }}
      </div>
      
      <div v-if="loading && isEditing" class="loading">
        Carregando dados...
      </div>
      
      <form v-else @submit.prevent="handleSubmit" class="cadastro-form">
        
        <div class="input-group">
          <label for="nome">Nome</label>
          <input type="text" id="nome" v-model="formData.nome" required>
        </div>
        
        <div class="input-group">
          <label for="cnpj">CNPJ / ID Fiscal</label>
          <input type="text" id="cnpj" v-model="formData.cnpj_id_fiscal" required>
        </div>
        
        <div class="input-group">
          <label for="escopo">Escopo de Fornecimento</label>
          <input type="text" id="escopo" v-model="formData.escopo_fornecimento">
        </div>

        <div class="input-group-split">
          <div class="input-group">
            <label for="tipo_material">Tipo de Material</label>
            <select id="tipo_material" v-model="formData.tipo_material">
              <option>Produtivo</option>
              <option>Improdutivo</option>
            </select>
          </div>
          <div class="input-group">
            <label for="categoria_risco">Categoria de Risco</label>
            <select id="categoria_risco" v-model="formData.categoria_risco">
              <option>Baixo</option>
              <option>Médio</option>
              <option>Alto</option>
            </select>
          </div>
        </div>

        <div class="input-group">
          <label for="grupo_fornecedor">Grupo de Fornecedor</label>
          <select id="grupo_fornecedor" v-model="formData.grupo_fornecedor_id">
            <option :value="null">Nenhum / Não Aplicável</option>
            <option 
              v-for="grupo in listaDeGrupos" 
              :key="grupo.id" 
              :value="grupo.id"
            >
              {{ grupo.nome_grupo }}
            </option>
          </select>
        </div>
        <div class="input-group-split" v-if="isEditing">
          <div class="input-group">
            <label for="status_homologacao">Status de Homologação</label>
            <select id="status_homologacao" v-model="formData.status_homologacao">
              <option>Em Avaliação</option>
              <option>Aprovado</option>
              <option>Aprovado com Restrições</option>
              <option>Reprovado</option>
              <option>Inativo</option>
            </select>
          </div>
          <div class="input-group">
            <label for="data_homologacao">Data da Homologação</label>
            <input type="date" id="data_homologacao" v-model="formData.data_homologacao">
          </div>
        </div>

        <hr class="divider">
        
        <h4>Informações de Contato</h4>
        
        <div class="input-group">
          <label for="contato_nome">Nome do Contato</label>
          <input type="text" id="contato_nome" v-model="formData.contato_nome">
        </div>
        <div class="input-group-split">
          <div class="input-group">
            <label for="contato_email">Email</label>
            <input type="email" id="contato_email" v-model="formData.contato_email">
          </div>
          <div class="input-group">
            <label for="contato_telefone">Telefone</label>
            <input type="tel" id="contato_telefone" v-model="formData.contato_telefone">
          </div>
        </div>
        <div class="input-group">
          <label for="endereco">Endereço</label>
          <textarea id="endereco" rows="3" v-model="formData.endereco"></textarea>
        </div>

        <p v-if="errorMsg" class="error-message">
          {{ errorMsg }}
        </p>

        <div class="action-buttons">
          <button type="submit" class="button-salvar" :disabled="loading">
            {{ loading ? 'Salvando...' : 'Salvar' }}
          </button>
          <RouterLink to="/fornecedores" class="button-cancelar">
            Cancelar
          </RouterLink>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
/* (O CSS é o mesmo do Passo 11.4, está correto) */
h2 {
  margin-top: 0;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
}
.form-section {
  background: #fff;
  padding: 2.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  max-width: 800px; 
  margin: 0 auto; 
}
.loading {
  text-align: center;
  padding: 3rem;
  font-style: italic;
  color: #777;
}
.cadastro-form { display: flex; flex-direction: column; gap: 1.2rem; }
.input-group { display: flex; flex-direction: column; }
.input-group label { margin-bottom: 0.5rem; font-weight: 600; color: #444; }
.input-group input, .input-group select, .input-group textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box; 
  font-size: 1rem;
  font-family: inherit;
  background-color: #fdfdfd;
}
.input-group-split { display: flex; gap: 1rem; }
.input-group-split > .input-group { flex: 1; }
.divider { border: none; border-top: 1px solid #eee; margin: 0.5rem 0; }
.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}
.button-salvar {
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: #28a745;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
}
.button-salvar:disabled { background-color: #ccc; }
.button-cancelar {
  padding: 0.85rem 1.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: #555;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
.button-cancelar:hover { background-color: #f8f8f8; }

/* --- NOVO ESTILO PARA A MENSAGEM DE ERRO --- */
.error-message {
  color: #dc3545; /* Vermelho */
  background-color: #f8d7da; /* Fundo vermelho claro */
  border: 1px solid #f5c6cb; /* Borda vermelha */
  padding: 1rem;
  border-radius: 4px;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 1.5rem; /* Espaço antes dos botões */
  text-align: center;
}

@media (max-width: 768px) {
  .input-group-split {
    flex-direction: column; 
    gap: 1.2rem;
  }
  .form-section {
    padding: 1.5rem;
  }
}
</style>