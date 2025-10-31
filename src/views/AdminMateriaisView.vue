<template>
  <div class="admin-materiais-view">
    
    <header class="page-header">
      <h1>⚙️ Administração de Materiais e Requisitos Específicos</h1>
      <p>Gerencie a lista mestra de Matérias-Primas/Serviços e os documentos exigidos para cada item.</p>
    </header>

    <div class="admin-grid">
      
      <section class="card form-section">
        <h2>{{ isEditing ? 'Editar Material' : 'Cadastrar Novo Material' }}</h2>
        <form @submit.prevent="handleMaterialSubmit">
          
          <div class="form-group">
            <label for="categoria">Categoria (Obrigatório)</label>
            <select id="categoria" v-model="materialForm.categoria_id" required :disabled="loadingMaterial || loadingCategorias">
              <option :value="null" disabled>Selecione a Categoria</option>
              <option v-for="cat in categorias" :key="cat.id" :value="cat.id">{{ cat.nome }}</option>
            </select>
            <small v-if="loadingCategorias">Carregando categorias...</small>
          </div>

          <div class="form-group">
            <label for="nome">Nome do Material/Serviço</label>
            <input type="text" id="nome" v-model="materialForm.nome" required :disabled="loadingMaterial">
          </div>
          <div class="form-group">
            <label for="codigo">Código Interno/SKU (Opcional)</label>
            <input type="text" id="codigo" v-model="materialForm.codigo_interno" :disabled="loadingMaterial">
          </div>
          <div class="form-group">
            <label for="classificacao">Classificação (Produtivo/Serviço...)</label>
            <select id="classificacao" v-model="materialForm.classificacao" required :disabled="loadingMaterial">
              <option value="" disabled>Selecione a Classificação</option>
              <option value="Produtivo">Produtivo</option>
              <option value="Improdutivo">Improdutivo</option>
              <option value="Serviço">Serviço</option>
            </select>
          </div>
          
          <div class="form-actions">
            <button type="submit" :disabled="loadingMaterial" class="btn-submit">
              {{ loadingMaterial ? 'Salvando...' : (isEditing ? 'Salvar Edição' : 'Cadastrar Material') }}
            </button>
            <button type="button" v-if="isEditing" @click="resetForm" class="btn-cancel">
              Cancelar
            </button>
          </div>
          <p v-if="materialError" class="error-message">{{ materialError }}</p>
        </form>
      </section>

      <section class="card list-section">
        
        <div class="list-header">
          <h2>Materiais Cadastrados ({{ materiais.length }})</h2>
          <div class="form-group-filter">
            <label for="filtroBusca">Buscar</label>
            <input 
              type="search" 
              id="filtroBusca" 
              v-model="filtroBusca" 
              placeholder="Filtrar por nome ou código..."
            >
          </div>
        </div>

        <p v-if="loadingList || loadingCategorias" class="loading-state">Carregando lista...</p>
        <p v-else-if="listError" class="error-message">{{ listError }}</p>
        
        <div v-else>
          <div 
            v-for="grupo in materiaisAgrupados" 
            :key="grupo.categoriaId" 
            class="material-group"
          >
            <h3 class="classificacao-header">
              {{ grupo.categoriaNome }}
              <span class="count">({{ grupo.materiais.length }})</span>
            </h3>
            
            <ul class="material-list">
              <li v-if="grupo.materiais.length === 0" class="material-item-empty">
                Nenhum material encontrado.
              </li>
              
              <li v-for="material in grupo.materiais" :key="material.id" class="material-item">
                <div class="material-info">
                  <strong>{{ material.nome }}</strong> ({{ material.classificacao }})
                  <small v-if="material.codigo_interno">Cód: {{ material.codigo_interno }}</small>
                </div>
                <div class="material-actions">
                    <button @click="handleEdit(material)" class="btn-action btn-edit">Editar</button>
                    <button @click="openRequisitosModal(material)" class="btn-action btn-requisitos">
                        Requisitos ({{ getReqCount(material.id) }})
                    </button>
                    <button @click="handleDeleteMaterial(material)" class="btn-action btn-delete">
                        Excluir
                    </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

      </section>
    </div>
    
    <div v-if="modalRequisitosAberto" class="modal-overlay" @click.self="closeRequisitosModal">
        <div class="modal-content">
            <h3>Requisitos de Documentação para: <span class="material-highlight">{{ materialSelecionado.nome }}</span></h3>
            
            <p v-if="loadingRequisitos || loadingTipos" class="loading-state">Carregando requisitos e tipos de documento...</p>
            <p v-else-if="requisitosError" class="error-message">{{ requisitosError }}</p>

            <div v-else class="requisitos-manager">
                <div class="form-group-inline add-req">
                    <select v-model="tipoDocumentoSelecionado" class="select-req" required>
                        <option value="" disabled>Selecione o Tipo de Documento</option>
                        <option v-for="tipo in tiposDocumentoDisponiveis" :key="tipo.id" :value="tipo.id">
                            {{ tipo.nome_documento }}
                        </option>
                    </select>
                    <button @click="handleAddRequisito" :disabled="!tipoDocumentoSelecionado" class="btn-submit btn-add">
                        Adicionar
                    </button>
                </div>

                <ul class="requisito-list">
                    <li v-for="req in requisitosAtuais" :key="req.id" class="requisito-item">
                        <span>{{ getDocumentoNome(req.tipo_documento_id) }}</span>
                        <button @click="handleDeleteRequisito(req.id)" class="btn-action btn-delete">
                            Remover
                        </button>
                    </li>
                </ul>
            </div>

            <div class="modal-actions">
                <button @click="closeRequisitosModal" class="btn-submit btn-fechar">Fechar</button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/supabase'

// --- ESTADO GERAL ---
const materiais = ref([])
const tiposDocumento = ref([]) 
const loadingList = ref(true)
const loadingMaterial = ref(false)
const listError = ref(null)
const materialError = ref(null)
const filtroBusca = ref('')

// NOVO ESTADO: Categorias
const categorias = ref([])
const loadingCategorias = ref(true)

// --- ESTADO FORMULÁRIO DE MATERIAL (ATUALIZADO) ---
const materialForm = ref({ 
  id: null, 
  nome: '', 
  codigo_interno: '', 
  classificacao: '', 
  categoria_id: null // <-- ADICIONADO
})
const isEditing = computed(() => !!materialForm.value.id)

// --- ESTADO MODAL DE REQUISITOS (Sem mudança) ---
const modalRequisitosAberto = ref(false)
const materialSelecionado = ref(null)
const requisitosAtuais = ref([]) 
const tipoDocumentoSelecionado = ref('')
const loadingRequisitos = ref(true)
const loadingTipos = ref(true)
const requisitosError = ref(null)

// --- COMPUTED PROPS ---
const requisitosMap = ref({})
const getReqCount = (materialId) => requisitosMap.value[materialId] || 0

const tiposDocumentoDisponiveis = computed(() => {
    const idsAtuais = new Set(requisitosAtuais.value.map(req => req.tipo_documento_id))
    return tiposDocumento.value.filter(tipo => !idsAtuais.has(tipo.id))
})
const getDocumentoNome = (tipoId) => {
    const tipo = tiposDocumento.value.find(t => t.id === tipoId)
    return tipo ? tipo.nome_documento : 'Documento Desconhecido'
}

// COMPUTED ATUALIZADA: Agrupa pela nova Categoria
const materiaisAgrupados = computed(() => {
  const termo = filtroBusca.value.toLowerCase().trim()
  
  // 1. Filtra a lista
  const materiaisFiltrados = materiais.value.filter(material => {
    if (!termo) return true 
    const nomeMatch = material.nome.toLowerCase().includes(termo)
    const codigoMatch = material.codigo_interno ? material.codigo_interno.toLowerCase().includes(termo) : false
    return nomeMatch || codigoMatch
  })

  // 2. Cria um Map de categorias para agrupar (ID -> Nome)
  const categoriaMap = new Map()
  categorias.value.forEach(cat => {
    categoriaMap.set(cat.id, { categoriaNome: cat.nome, materiais: [] })
  })
  // Adiciona um grupo "Sem Categoria"
  const semCategoriaId = 'sem-categoria'
  categoriaMap.set(semCategoriaId, { categoriaNome: 'Sem Categoria', materiais: [] })

  // 3. Agrupa os materiais filtrados
  materiaisFiltrados.forEach(material => {
    const idCategoria = material.categoria_id
    if (categoriaMap.has(idCategoria)) {
      categoriaMap.get(idCategoria).materiais.push(material)
    } else {
      categoriaMap.get(semCategoriaId).materiais.push(material) // Se a categoria for nula ou não encontrada
    }
  })

  // 4. Formata para o v-for do template
  // Filtra grupos que não têm itens (a menos que o filtro esteja limpo)
  return Array.from(categoriaMap.values())
              .filter(g => g.materiais.length > 0 || !termo) 
})


// --- FUNÇÕES DE CARREGAMENTO ---

async function fetchMateriais() {
  loadingList.value = true
  listError.value = null
  try {
    const { data, error } = await supabase
      .from('materias_primas')
      .select('*') // Puxa tudo, incluindo a nova 'categoria_id'
      .order('nome', { ascending: true })

    if (error) throw error
    materiais.value = data
  } catch (error) {
    console.error('Erro ao carregar materiais:', error)
    listError.value = `Falha ao carregar lista de materiais: ${error.message}`
  } finally {
    loadingList.value = false
  }
}

async function fetchTiposDocumento() {
    loadingTipos.value = true
    try {
        const { data, error } = await supabase
            .from('tipos_documento')
            .select('id, nome_documento') 

        if (error) throw error
        tiposDocumento.value = data
    } catch (error) {
        console.error('Erro ao carregar tipos de documento:', error)
        listError.value = `Falha ao carregar Tipos de Documento: ${error.message}`
    } finally {
        loadingTipos.value = false
    }
}

async function fetchRequisitosECount() {
    try {
        const { data: todosReq, error: reqError } = await supabase
            .from('requisitos_material')
            .select('materia_prima_id')

        if (reqError) throw reqError
        
        const countMap = todosReq.reduce((acc, curr) => {
            acc[curr.materia_prima_id] = (acc[curr.materia_prima_id] || 0) + 1
            return acc
        }, {})
        requisitosMap.value = countMap

    } catch (error) {
        console.error('Erro ao carregar contagem de requisitos:', error)
    }
}

// NOVA FUNÇÃO: Buscar as categorias para o dropdown
async function fetchCategorias() {
  loadingCategorias.value = true
  try {
    const { data, error } = await supabase.from('categorias_materiais').select('id, nome').order('nome')
    if (error) throw error
    categorias.value = data
  } catch (err) { 
    console.error('Erro ao buscar categorias:', err.message)
    materialError.value = 'Falha ao carregar categorias. ' + err.message
  }
  finally { loadingCategorias.value = false }
}


// --- FUNÇÕES DE CRUD DO MATERIAL (ATUALIZADAS) ---

function resetForm() {
    materialForm.value = { 
      id: null, 
      nome: '', 
      codigo_interno: '', 
      classificacao: '', 
      categoria_id: null // <-- ADICIONADO
    }
    materialError.value = null
}

function handleEdit(material) {
    materialForm.value = { ...material } // O spread operator já inclui a 'categoria_id'
    materialError.value = null
}

async function handleMaterialSubmit() {
    loadingMaterial.value = true
    materialError.value = null
    const isUpdate = isEditing.value

    try {
        // ATUALIZADO: Payload inclui 'categoria_id'
        const payload = { 
            nome: materialForm.value.nome,
            codigo_interno: materialForm.value.codigo_interno,
            classificacao: materialForm.value.classificacao,
            categoria_id: materialForm.value.categoria_id // <-- ADICIONADO
        }

        if (isUpdate) {
            const { error } = await supabase
                .from('materias_primas')
                .update(payload)
                .eq('id', materialForm.value.id)
                
            if (error) throw error
        } else {
            const { data, error } = await supabase
                .from('materias_primas')
                .insert(payload)
                .select('id')
                .single()
                
            if (error) throw error
        }

        alert(`Material ${isUpdate ? 'atualizado' : 'cadastrado'} com sucesso!`)
        resetForm()
        await fetchMateriais() 
        
    } catch (error) {
        console.error('Erro ao salvar material:', error)
        materialError.value = `Erro ao salvar: ${error.message}`
    } finally {
        loadingMaterial.value = false
    }
}

async function handleDeleteMaterial(material) {
  if (!confirm(`TEM CERTEZA que deseja excluir o material "${material.nome}"?\n\nEsta ação é irreversível e removerá TODOS os requisitos e associações deste material com fornecedores.`)) {
    return;
  }
  loadingMaterial.value = true;
  materialError.value = null;
  try {
    const { error: reqError } = await supabase
      .from('requisitos_material')
      .delete()
      .eq('materia_prima_id', material.id);
    if (reqError) throw new Error(`Falha ao excluir requisitos: ${reqError.message}`);

    const { error: fornError } = await supabase
      .from('fornecedor_materiais')
      .delete()
      .eq('materia_prima_id', material.id);
    if (fornError) throw new Error(`Falha ao excluir associações: ${fornError.message}`);

    const { error: matError } = await supabase
      .from('materias_primas')
      .delete()
      .eq('id', material.id);
    if (matError) throw new Error(`Falha ao excluir material: ${matError.message}`);

    alert(`Material "${material.nome}" excluído com sucesso.`);
    
    await fetchMateriais(); 
    await fetchRequisitosECount(); 
    
    if (isEditing.value && materialForm.value.id === material.id) {
      resetForm();
    }
  } catch (error) {
    console.error('Erro ao excluir material:', error);
    materialError.value = `Erro ao excluir: ${error.message}`;
  } finally {
    loadingMaterial.value = false;
  }
}


// --- FUNÇÕES DE GESTÃO DE REQUISITOS (Modal) (Sem mudanças) ---
// (Funções fetchRequisitosAtuais, openRequisitosModal, closeRequisitosModal, 
// handleAddRequisito, handleDeleteRequisito permanecem idênticas)

async function fetchRequisitosAtuais() {
    if (!materialSelecionado.value) return
    loadingRequisitos.value = true
    requisitosError.value = null
    try {
        const { data, error } = await supabase
            .from('requisitos_material')
            .select('*')
            .eq('materia_prima_id', materialSelecionado.value.id)
        if (error) throw error
        requisitosAtuais.value = data
    } catch (error) {
        console.error('Erro ao carregar requisitos atuais:', error)
        requisitosError.value = 'Falha ao carregar requisitos.'
    } finally {
        loadingRequisitos.value = false
    }
}
function openRequisitosModal(material) {
    materialSelecionado.value = material
    tipoDocumentoSelecionado.value = ''
    fetchRequisitosAtuais()
    modalRequisitosAberto.value = true
}
function closeRequisitosModal() {
    modalRequisitosAberto.value = false
    materialSelecionado.value = null
    requisitosAtuais.value = []
    fetchRequisitosECount() 
}
async function handleAddRequisito() {
    if (!materialSelecionado.value || !tipoDocumentoSelecionado.value) return
    try {
        const { error } = await supabase
            .from('requisitos_material')
            .insert({
                materia_prima_id: materialSelecionado.value.id,
                tipo_documento_id: tipoDocumentoSelecionado.value,
            })
        if (error) throw error
        tipoDocumentoSelecionado.value = ''
        await fetchRequisitosAtuais() 
    } catch (error) {
        console.error('Erro ao adicionar requisito:', error)
        requisitosError.value = `Erro ao adicionar: ${error.message}. (Documento já pode ser um requisito)`
    }
}
async function handleDeleteRequisito(requisitoId) {
    if (!confirm('Confirmar a remoção deste requisito de documentação?')) return
    try {
        const { error } = await supabase
            .from('requisitos_material')
            .delete()
            .eq('id', requisitoId)
        if (error) throw error
        await fetchRequisitosAtuais() 
    } catch (error) {
        console.error('Erro ao deletar requisito:', error)
        requisitosError.value = `Erro ao remover requisito: ${error.message}`
    }
}


// --- CICLO DE VIDA (ATUALIZADO) ---
onMounted(() => {
    fetchCategorias() // <- Adicionado
    fetchMateriais()
    fetchTiposDocumento()
    fetchRequisitosECount()
})
</script>

<style scoped>
/* ESTILOS ATUALIZADOS */
.admin-materiais-view { max-width: 1400px; margin: 2rem auto; font-family: Arial, sans-serif; }

/* CABEÇALHO PADRÃO DE PÁGINA PRINCIPAL */
.page-header { 
  margin-bottom: 2rem; 
  padding-bottom: 1rem; 
  border-bottom: 1px solid #c50d42; 
}
.page-header h1 {
  font-size: 2rem;
  margin: 0 0 0.25rem 0;
}
.page-header p {
  font-size: 1.1rem;
  color: #555;
  margin: 0;
}

.admin-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }

.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }

/* Seção de Cadastro */
.form-group { display: flex; flex-direction: column; margin-bottom: 15px; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #333; }
.form-group input, .form-group select { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
.form-group small { font-size: 0.8rem; color: #007bff; margin-top: 0.25rem; }
.form-actions { display: flex; gap: 10px; }
.btn-submit { background-color: #c50d42; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #a30b37; }
.btn-cancel { background-color: #6c757d; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
.error-message { color: #dc3545; margin-top: 10px; font-weight: bold; }

/* --- SEÇÃO DA LISTA ATUALIZADA (Agrupada por Categoria) --- */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}
.list-header h2 {
  margin: 0;
}
.form-group-filter {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-grow: 1;
  max-width: 300px;
}
.form-group-filter label {
  font-weight: 600;
  font-size: 0.9em;
}
.form-group-filter input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
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
.material-list { 
  list-style: none; 
  padding: 0; 
}
.material-item { 
  display: flex; 
  gap: 1rem;
  align-items: center; 
  padding: 10px 0; 
  border-bottom: 1px dotted #eee; 
}
.material-item-empty {
  font-style: italic;
  color: #888;
  padding: 10px 0;
}
.material-info { 
  flex-grow: 1; 
  flex-shrink: 1;
  min-width: 0; 
}
.material-info strong {
  word-break: break-word; 
}
.material-info small { 
  display: block; 
  color: #666; 
}
.material-actions { 
  display: flex; 
  gap: 8px; 
  flex-shrink: 0; 
  justify-content: flex-end; 
}
.btn-action { 
  padding: 6px 12px; 
  border-radius: 4px; 
  cursor: pointer; 
  font-size: 0.9em; 
  border: 1px solid transparent; 
  white-space: nowrap; 
}
.btn-edit { background-color: #ffc107; color: #333; }
.btn-requisitos { background-color: #007bff; color: white; }
.btn-delete { background-color: #dc3545; color: white; }

/* --- RESPONSIVIDADE --- */
@media (max-width: 900px) { 
  .admin-grid { grid-template-columns: 1fr; } 
  .list-section { order: -1; } 
}
@media (max-width: 768px) {
    .material-item {
        flex-direction: column; 
        align-items: flex-start; 
    }
    .material-actions {
        flex-wrap: wrap; 
        justify-content: flex-start; 
        width: 100%; 
        margin-top: 0.5rem; 
    }
}

/* Modal (sem mudança) */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 30px; border-radius: 8px; width: 90%; max-width: 650px; max-height: 90vh; overflow-y: auto; }
.material-highlight { color: #007bff; }
.requisitos-manager { margin-top: 20px; }
.add-req { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
.requisito-list { list-style: none; padding: 0; max-height: 250px; overflow-y: auto; }
.requisito-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dotted #f0f0f0; }
.btn-add { width: 100%; }
.btn-fechar { background-color: #6c757d; }
</style>