<template>
  <div class="fornecedor-form-view">
    
    <header class="sub-page-header">
      <button @click="router.push({ name: 'fornecedores-lista' })" class="btn-voltar">
        <span class="icon">&larr;</span> Voltar para Lista
      </button>
      <div class="header-title-container">
        <h1>{{ isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor' }}</h1>
        <p>Preencha os dados fundamentais e os materiais fornecidos.</p>
      </div>
    </header>

    <p v-if="loadingForm || loadingMateriais || loadingCategorias" class="loading-state">Carregando dados...</p>
    <p v-else-if="fetchError" class="error-message card">{{ fetchError }}</p>

    <form v-else @submit.prevent="handleSave" class="card form-container">
      
      <div class="config-tabs">
        <button 
          type="button"
          :class="['tab-button', { active: activeTab === 'dados' }]"
          @click="activeTab = 'dados'"
        >
          Dados Fundamentais
        </button>
        <button 
          type="button"
          :class="['tab-button', { active: activeTab === 'materiais' }]"
          @click="activeTab = 'materiais'"
        >
          Materiais/Serviços Fornecidos
        </button>
      </div>

      <div class="tab-content">
        
        <section v-if="activeTab === 'dados'" class="section-group">
          <h2>Dados Fundamentais</h2>
          <div class="form-grid">
            <div class="form-group">
              <label for="nome">Nome/Razão Social</label>
              <input type="text" id="nome" v-model="form.nome" required>
            </div>
            <div class="form-group">
              <label for="cnpj">CNPJ/ID Fiscal</label>
              <input type="text" id="cnpj" v-model="form.cnpj_id_fiscal" required>
            </div>
            <div class="form-group">
              <label for="contato">Contato Principal</label>
              <input type="text" id="contato" v-model="form.contato">
            </div>
            <div class="form-group">
              <label for="grupo">Grupo de Fornecedor</label>
              <select id="grupo" v-model="form.grupo_fornecedor_id" required>
                <option value="" disabled>Selecione o Grupo</option>
                <option v-for="grupo in grupos" :key="grupo.id" :value="grupo.id">{{ grupo.nome_grupo }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="escopo">Escopo de Fornecimento</label>
              <input type="text" id="escopo" v-model="form.escopo_fornecimento">
            </div>
            <div class="form-group">
              <label for="status_homologacao">Status de Homologação</label>
              <select id="status_homologacao" v-model="form.status_homologacao" required>
                <option value="Em Avaliação">Em Avaliação</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Aprovado com Restrições">Aprovado com Restrições</option>
                <option value="Reprovado">Reprovado</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>
        </section>
        
        <section v-if="activeTab === 'materiais'" class="section-group">
          <h2>Materiais/Serviços Fornecidos</h2>
          <p class="instrucao">Selecione todos os materiais ou serviços que este fornecedor pode fornecer. Isso definirá os requisitos de documentação específicos.</p>
          
          <div class="form-group-filter">
            <label for="filtroBuscaMat">Buscar Material</label>
            <input 
              type="search" 
              id="filtroBuscaMat" 
              v-model="filtroBusca" 
              placeholder="Filtrar por nome ou código..."
            >
          </div>

          <p v-if="materiais.length === 0" class="empty-state">Nenhum material cadastrado. Cadastre em "Gerenciar Materiais" primeiro.</p>

          <div v-else class="material-grouped-list">
            <div 
              v-for="grupo in materiaisAgrupados" 
              :key="grupo.categoriaId" 
              class="material-group"
            >
              <h3 class="classificacao-header">
                {{ grupo.categoriaNome }}
                <span class="count">({{ grupo.materiais.length }})</span>
              </h3>
              <div class="material-checkboxes">
                <p v-if="grupo.materiais.length === 0" class="material-item-empty">
                  Nenhum material encontrado.
                </p>
                <div v-for="material in grupo.materiais" :key="material.id" class="checkbox-item">
                  <input type="checkbox" :id="material.id" :value="material.id" v-model="materiaisSelecionados">
                  <label :for="material.id">{{ material.nome }} ({{ material.classificacao }})</label>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="form-actions">
        <button type="submit" :disabled="loadingSave" class="btn-submit">
          {{ loadingSave ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Criar Fornecedor') }}
        </button>
      </div>
      <p v-if="saveError" class="error-message">{{ saveError }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'

const route = useRoute()
const router = useRouter()
const fornecedorId = route.params.id

// --- NOVO ESTADO DE UI ---
const activeTab = ref('dados') // Começa na aba 'dados'

// --- ESTADOS GERAIS ---
const form = ref({
  id: null,
  nome: '',
  cnpj_id_fiscal: '', 
  contato: '',
  escopo_fornecimento: '',
  grupo_fornecedor_id: '',
  status_homologacao: 'Em Avaliação',
})
const grupos = ref([]) 
const materiais = ref([]) 
const materiaisSelecionados = ref([]) 
const filtroBusca = ref('')
const categorias = ref([])
const loadingCategorias = ref(true)

const loadingForm = ref(true)
const loadingMateriais = ref(true)
const loadingSave = ref(false)
const fetchError = ref(null)
const saveError = ref(null)

const isEditing = computed(() => !!fornecedorId)

// --- COMPUTED PROPS ---

// Lógica de Agrupamento por Categoria (Fase 4)
const materiaisAgrupados = computed(() => {
  const termo = filtroBusca.value.toLowerCase().trim()
  
  const materiaisFiltrados = materiais.value.filter(material => {
    if (!termo) return true 
    const nomeMatch = material.nome.toLowerCase().includes(termo)
    const codigoMatch = material.codigo_interno ? material.codigo_interno.toLowerCase().includes(termo) : false
    return nomeMatch || codigoMatch
  })

  const categoriaMap = new Map()
  categorias.value.forEach(cat => {
    categoriaMap.set(cat.id, { categoriaId: cat.id, categoriaNome: cat.nome, materiais: [] })
  })
  const semCategoriaId = 'sem-categoria'
  categoriaMap.set(semCategoriaId, { categoriaId: semCategoriaId, categoriaNome: 'Sem Categoria', materiais: [] })

  materiaisFiltrados.forEach(material => {
    const idCategoria = material.categoria_id 
    if (categoriaMap.has(idCategoria)) {
      categoriaMap.get(idCategoria).materiais.push(material)
    } else {
      categoriaMap.get(semCategoriaId).materiais.push(material) 
    }
  })

  return Array.from(categoriaMap.values())
              .filter(g => g.materiais.length > 0 || !termo) 
})


// --- FUNÇÕES DE CARREGAMENTO (Lógica da Fase 4) ---

async function fetchMateriais() {
    loadingMateriais.value = true
    try {
        const { data, error } = await supabase
            .from('materias_primas')
            .select('id, nome, classificacao, codigo_interno, categoria_id') 
            .order('nome', { ascending: true })
        
        if (error) throw error
        materiais.value = data

    } catch (error) {
        console.error('Erro ao carregar materiais:', error)
        fetchError.value = 'Falha ao carregar lista de materiais. ' + error.message
    } finally {
        loadingMateriais.value = false
    }
}

async function fetchCategorias() {
  loadingCategorias.value = true
  try {
    const { data, error } = await supabase.from('categorias_materiais').select('id, nome').order('nome')
    if (error) throw error
    categorias.value = data
  } catch (err) { 
    console.error('Erro ao buscar categorias:', err.message)
    fetchError.value = 'Falha ao carregar categorias. ' + err.message
  }
  finally { loadingCategorias.value = false }
}

async function fetchMateriaisFornecidos() {
    if (!fornecedorId) return
    try {
        const { data, error } = await supabase
            .from('fornecedor_materiais')
            .select('materia_prima_id')
            .eq('fornecedor_id', fornecedorId)

        if (error) throw error
        materiaisSelecionados.value = data.map(item => item.materia_prima_id)

    } catch (error) {
        console.error('Erro ao carregar materiais fornecidos:', error)
        fetchError.value = 'Falha ao carregar materiais fornecidos. ' + error.message
    }
}

async function fetchFormData() {
    loadingForm.value = true
    fetchError.value = null

    try {
        const { data: gruposData, error: gruposError } = await supabase
            .from('grupos_fornecedor')
            .select('id, nome_grupo')
            
        if (gruposError) throw gruposError
        grupos.value = gruposData

        if (isEditing.value) {
            const { data: fornecedorData, error: fornError } = await supabase
                .from('fornecedores')
                .select('*') 
                .eq('id', fornecedorId)
                .single()
                
            if (fornError) throw fornError
            
            form.value = { 
                id: fornecedorData.id,
                nome: fornecedorData.nome,
                cnpj_id_fiscal: fornecedorData.cnpj_id_fiscal,
                contato: fornecedorData.contato,
                escopo_fornecimento: fornecedorData.escopo_fornecimento,
                grupo_fornecedor_id: fornecedorData.grupo_fornecedor_id,
                status_homologacao: fornecedorData.status_homologacao, 
            }
        }

    } catch (error)
    {
        console.error('Erro ao carregar dados do formulário:', error)
        fetchError.value = 'Falha ao carregar dados: ' + error.message
    } finally {
        loadingForm.value = false
    }
}

// --- FUNÇÕES DE SALVAMENTO (Sem mudanças) ---

async function handleSave() {
    loadingSave.value = true
    saveError.value = null

    const payload = {
        nome: form.value.nome,
        cnpj_id_fiscal: form.value.cnpj_id_fiscal,
        contato: form.value.contato,
        escopo_fornecimento: form.value.escopo_fornecimento,
        grupo_fornecedor_id: form.value.grupo_fornecedor_id,
        status_homologacao: form.value.status_homologacao, 
    }

    try {
        let fornecedorRecemCriadoId = fornecedorId
        
        if (isEditing.value) {
            const { error } = await supabase
                .from('fornecedores')
                .update(payload) 
                .eq('id', fornecedorId)
                
            if (error) throw error
        } else {
            const { data, error } = await supabase
                .from('fornecedores')
                .insert(payload) 
                .select('id')
                .single()
            
            if (error) throw error
            fornecedorRecemCriadoId = data.id
        }

        await syncMateriais(fornecedorRecemCriadoId)

        alert(`Fornecedor ${form.value.nome} salvo com sucesso!`)
        router.push({ name: 'fornecedores-lista' })

    } catch (error) {
        console.error('Erro ao salvar:', error)
        saveError.value = `Falha ao salvar fornecedor: ${error.message}`
    } finally {
        loadingSave.value = false
    }
}

async function syncMateriais(id) {
    const { data: materiaisAtuais, error: fetchError } = await supabase
        .from('fornecedor_materiais')
        .select('materia_prima_id')
        .eq('fornecedor_id', id)
        
    if (fetchError) throw fetchError
    const idsAtuais = new Set(materiaisAtuais.map(item => item.materia_prima_id))

    const idsParaDeletar = [...idsAtuais].filter(
        idAtual => !materiaisSelecionados.value.includes(idAtual)
    )
    const idsParaInserir = materiaisSelecionados.value.filter(
        idSelecionado => !idsAtuais.has(idSelecionado)
    )

    if (idsParaDeletar.length > 0) {
        const { error: deleteError } = await supabase
            .from('fornecedor_materiais')
            .delete()
            .eq('fornecedor_id', id)
            .in('materia_prima_id', idsParaDeletar)
        if (deleteError) throw deleteError
    }

    if (idsParaInserir.length > 0) {
        const registrosParaInserir = idsParaInserir.map(material_id => ({
            fornecedor_id: id,
            materia_prima_id: material_id
        }))
        
        const { error: insertError } = await supabase
            .from('fornecedor_materiais') 
            .insert(registrosParaInserir)
        if (insertError) throw insertError
    }
}

// --- CICLO DE VIDA (ATUALIZADO) ---
onMounted(async () => {
    await Promise.all([
      fetchFormData(),
      fetchMateriais(),
      fetchCategorias() 
    ])
    
    if (isEditing.value) {
        await fetchMateriaisFornecidos()
    } 

    if (fetchError.value) {
        loadingForm.value = false
        loadingMateriais.value = false
    }
})
</script>

<style scoped>
/* ESTILOS ATUALIZADOS */
.fornecedor-form-view { max-width: 1200px; margin: 2rem auto; font-family: Arial, sans-serif; }

/* Cabeçalho de Sub-Página (sem mudança) */
.sub-page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}
.btn-voltar {
  background: #f4f4f4;
  color: #333;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  align-self: flex-start;
}
.btn-voltar .icon { font-weight: bold; }
.header-title-container { margin-top: 0.5rem; }
.header-title-container h1 { margin: 0; color: #c50d42; }
.header-title-container p { margin: 0.25rem 0 0; font-size: 1rem; color: #555; }

/* Card e Formulário Básico (sem mudança) */
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.loading-state, .empty-state, .error-message { text-align: center; padding: 1rem 0; color: #888; }
.error-message { color: #dc3545; font-weight: bold; }
.section-group { 
  /* Removemos a borda de baixo para que as abas controlem o layout */
  margin-bottom: 0; 
  padding-bottom: 0; 
  border-bottom: none; 
}
.section-group h2 { color: #007bff; margin-top: 0; margin-bottom: 15px; }
.instrucao { font-style: italic; color: #666; margin-bottom: 15px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.form-group { display: flex; flex-direction: column; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #333; }
.form-group input, .form-group select { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }


/* --- NOVA ARQUITETURA DE ABAS (TABS) --- */
.config-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #eee;
}
.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background-color: transparent;
  font-size: 1rem;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}
.tab-button:hover {
  background-color: #f8f9fa;
  color: #000;
}
.tab-button.active {
  color: #007bff;
  border-bottom-color: #007bff;
}
.tab-content {
  padding-top: 1rem; /* Espaço entre a aba e o conteúdo */
}
/* --- FIM DA ARQUITETURA DE ABAS --- */


/* --- ESTILOS PARA FILTRO E GRUPOS DE CATEGORIA --- */
.form-group-filter {
  margin-bottom: 1rem;
}
.form-group-filter label {
  font-weight: 600;
  margin-bottom: 5px;
  color: #333;
  display: block;
}
.form-group-filter input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  max-width: 400px;
}

.material-grouped-list {
  /* Contêiner para todos os grupos */
}

.material-group {
  margin-bottom: 1.5rem;
}
.classificacao-header {
  color: #007bff;
  margin: 0 0 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #007bff;
}
.classificacao-header .count {
  font-weight: 400;
  color: #555;
  font-size: 0.9em;
}
.material-item-empty {
  font-style: italic;
  color: #888;
  padding: 10px 0;
}
/* --- FIM DOS NOVOS ESTILOS --- */


/* Estilos de Checkbox (sem mudança) */
.material-checkboxes { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px; 
}
.checkbox-item { 
  display: flex; 
  align-items: center; 
  background-color: #f7f7f7; 
  padding: 10px; 
  border-radius: 4px; 
  cursor: pointer; 
  transition: background-color 0.2s; 
}
.checkbox-item:hover { background-color: #eee; }
.checkbox-item input[type="checkbox"] { margin-right: 10px; transform: scale(1.2); }
.checkbox-item label { font-weight: normal; cursor: pointer; word-break: break-word; }

/* Botões de Ação (sem mudança) */
.form-actions { 
  margin-top: 20px; 
  padding-top: 20px;
  border-top: 1px dashed #ddd; /* Separador visual */
  display: flex; 
  justify-content: flex-end; 
  gap: 15px; 
}
.btn-submit { background-color: #c50d42; color: white; padding: 12px 25px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #a30b37; }
.btn-submit:disabled { background-color: #ccc; cursor: not-allowed; }
</style>