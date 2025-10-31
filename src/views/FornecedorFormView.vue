<template>
  <div class="fornecedor-form-view">
    <header class="page-header">
      <button @click="router.push({ name: 'fornecedores-lista' })" class="btn-voltar">← Voltar para Lista</button>
      <h1>{{ isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor' }}</h1>
    </header>

    <p v-if="loadingForm || loadingMateriais" class="loading-state">Carregando dados...</p>
    <p v-else-if="fetchError" class="error-message card">{{ fetchError }}</p>

    <form v-else @submit.prevent="handleSave" class="card form-container">
      
      <section class="section-group">
        <h2>Dados Fundamentais</h2>
        <div class="form-grid">
          <div class="form-group">
            <label for="nome">Nome/Razão Social</label>
            <input type="text" id="nome" v-model="form.nome" required>
          </div>
          <div class="form-group">
            <label for="cnpj">CNPJ/ID Fiscal</label>
            <input type="text" id="cnpj" v-model="form.cnpj">
          </div>
          <div class="form-group">
            <label for="contato">Contato Principal</label>
            <input type="text" id="contato" v-model="form.contato">
          </div>
          <div class="form-group">
            <label for="grupo">Grupo de Fornecedor</label>
            <select id="grupo" v-model="form.grupo_fornecedor_id" required>
              <option value="" disabled>Selecione o Grupo</option>
              <option v-for="grupo in grupos" :key="grupo.id" :value="grupo.id">{{ grupo.descricao }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="escopo">Escopo de Fornecimento</label>
            <input type="text" id="escopo" v-model="form.escopo_fornecimento">
          </div>
        </div>
      </section>
      
      <section class="section-group">
        <h2>Materiais/Serviços Fornecidos</h2>
        <p class="instrucao">Selecione todos os materiais ou serviços que este fornecedor pode fornecer. Isso definirá os requisitos de documentação específicos.</p>
        
        <p v-if="materiais.length === 0" class="empty-state">Nenhum material cadastrado. Cadastre em "Gerenciar Materiais" primeiro.</p>

        <div v-else class="material-checkboxes">
            <div v-for="material in materiais" :key="material.id" class="checkbox-item">
                <input type="checkbox" :id="material.id" :value="material.id" v-model="materiaisSelecionados">
                <label :for="material.id">{{ material.nome }} ({{ material.classificacao }})</label>
            </div>
        </div>
      </section>

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
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'

const route = useRoute()
const router = useRouter()
const fornecedorId = route.params.id

// --- ESTADOS GERAIS ---
const form = ref({
  id: null,
  nome: '',
  cnpj: '',
  contato: '',
  escopo_fornecimento: '',
  grupo_fornecedor_id: '',
})
const grupos = ref([]) // Lista de grupos para o dropdown
const materiais = ref([]) // Lista mestra de materiais disponíveis
const materiaisSelecionados = ref([]) // IDs dos materiais que o fornecedor JÁ fornece

const loadingForm = ref(true)
const loadingMateriais = ref(true)
const loadingSave = ref(false)
const fetchError = ref(null)
const saveError = ref(null)

const isEditing = computed(() => !!fornecedorId)

// --- FUNÇÕES DE CARREGAMENTO ---

/**
 * Carrega a lista de materiais cadastrados (tabela materias_primas)
 */
async function fetchMateriais() {
    loadingMateriais.value = true
    try {
        const { data, error } = await supabase
            .from('materias_primas')
            .select('id, nome, classificacao')
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

/**
 * Carrega os materiais que o fornecedor JÁ fornece (tabela fornecedor_materiais)
 */
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

/**
 * Carrega dados do formulário (Grupos e Fornecedor, se for edição)
 */
async function fetchFormData() {
    loadingForm.value = true
    fetchError.value = null

    try {
        // 1. Carregar Grupos
        // MUDANÇA CRÍTICA: Busca 'descricao' no lugar de 'nome'
        const { data: gruposData, error: gruposError } = await supabase
            .from('grupos_fornecedor')
            .select('id, descricao') // <--- AQUI ESTÁ A CORREÇÃO DE SCHEMA
            
        if (gruposError) throw gruposError
        grupos.value = gruposData

        // 2. Carregar Dados do Fornecedor (Apenas se for edição)
        if (isEditing.value) {
            const { data: fornecedorData, error: fornError } = await supabase
                .from('fornecedores')
                .select('*')
                .eq('id', fornecedorId)
                .single()
                
            if (fornError) throw fornError
            form.value = { ...fornecedorData, id: fornecedorId }
        }

    } catch (error) {
        console.error('Erro ao carregar dados do formulário:', error)
        fetchError.value = 'Falha ao carregar dados: ' + error.message
    } finally {
        loadingForm.value = false
    }
}

// --- FUNÇÕES DE SALVAMENTO ---

/**
 * Salva o registro na tabela fornecedores e gerencia a tabela pivô.
 */
async function handleSave() {
    // ... (a lógica de salvamento permanece a mesma) ...
    loadingSave.value = true
    saveError.value = null

    try {
        let fornecedorRecemCriadoId = fornecedorId
        
        // 1. Salvar o Fornecedor (INSERT/UPDATE)
        if (isEditing.value) {
            // UPDATE
            const { error } = await supabase
                .from('fornecedores')
                .update({ ...form.value })
                .eq('id', fornecedorId)
                
            if (error) throw error
        } else {
            // INSERT
            const { data, error } = await supabase
                .from('fornecedores')
                .insert({ ...form.value })
                .select('id')
                .single()
            
            if (error) throw error
            fornecedorRecemCriadoId = data.id
        }

        // 2. Gerenciar a Tabela Pivô (fornecedor_materiais)
        await syncMateriais(fornecedorRecemCriadoId)

        alert(`Fornecedor ${form.value.nome} salvo com sucesso!`)
        // Redireciona para a lista após o sucesso
        router.push({ name: 'fornecedores-lista' })

    } catch (error) {
        console.error('Erro ao salvar:', error)
        saveError.value = `Falha ao salvar fornecedor: ${error.message}`
    } finally {
        loadingSave.value = false
    }
}

/**
 * Sincroniza a lista de materiais fornecidos pelo fornecedor.
 */
async function syncMateriais(id) {
    // ... (a lógica de sync permanece a mesma) ...
    // 1. Obter a lista atual de materiais no banco
    const { data: materiaisAtuais, error: fetchError } = await supabase
        .from('fornecedor_materiais')
        .select('materia_prima_id')
        .eq('fornecedor_id', id)
        
    if (fetchError) throw fetchError
    const idsAtuais = new Set(materiaisAtuais.map(item => item.materia_prima_id))

    // 2. Determinar o que deletar e o que inserir
    const idsParaDeletar = [...idsAtuais].filter(
        idAtual => !materiaisSelecionados.value.includes(idAtual)
    )
    const idsParaInserir = materiaisSelecionados.value.filter(
        idSelecionado => !idsAtuais.has(idSelecionado)
    )

    // 3. Executar Deletes
    if (idsParaDeletar.length > 0) {
        const { error: deleteError } = await supabase
            .from('fornecedor_materiais')
            .delete()
            .eq('fornecedor_id', id)
            .in('materia_prima_id', idsParaDeletar)
        if (deleteError) throw deleteError
    }

    // 4. Executar Inserts
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


// --- CICLO DE VIDA ---
onMounted(async () => {
    // Ordem das chamadas
    await fetchFormData() 
    await fetchMateriais()
    await fetchMateriaisFornecidos() 

    // Se houver erro de carregamento (ex: RLS), ele será exibido
    if (fetchError.value) {
        loadingForm.value = false
        loadingMateriais.value = false
    }
})

</script>

<style scoped>
/* Estilos (Mesmos da última vez) */
.fornecedor-form-view { max-width: 1200px; margin: 2rem auto; font-family: Arial, sans-serif; }
.page-header { display: flex; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #c50d42; }
.page-header h1 { margin-left: 20px; }
.btn-voltar { background: #f4f4f4; color: #333; padding: 8px 15px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.loading-state, .empty-state, .error-message { text-align: center; padding: 1rem 0; color: #888; }
.error-message { color: #dc3545; font-weight: bold; }
.section-group { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px dashed #ddd; }
.section-group h2 { color: #007bff; margin-top: 0; margin-bottom: 15px; }
.instrucao { font-style: italic; color: #666; margin-bottom: 15px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.form-group { display: flex; flex-direction: column; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #333; }
.form-group input, .form-group select { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
.material-checkboxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
.checkbox-item { display: flex; align-items: center; background-color: #f7f7f7; padding: 10px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.checkbox-item:hover { background-color: #eee; }
.checkbox-item input[type="checkbox"] { margin-right: 10px; transform: scale(1.2); }
.checkbox-item label { font-weight: normal; cursor: pointer; }
.form-actions { margin-top: 20px; display: flex; justify-content: flex-end; gap: 15px; }
.btn-submit { background-color: #c50d42; color: white; padding: 12px 25px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #a30b37; }
.btn-submit:disabled { background-color: #ccc; cursor: not-allowed; }
</style>