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
            <label for="nome">Nome do Material/Serviço</label>
            <input type="text" id="nome" v-model="materialForm.nome" required :disabled="loadingMaterial">
          </div>
          <div class="form-group">
            <label for="codigo">Código Interno/SKU (Opcional)</label>
            <input type="text" id="codigo" v-model="materialForm.codigo_interno" :disabled="loadingMaterial">
          </div>
          <div class="form-group">
            <label for="classificacao">Classificação</label>
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
        <h2>Materiais Cadastrados ({{ materiais.length }})</h2>
        <p v-if="loadingList" class="loading-state">Carregando lista...</p>
        <p v-else-if="listError" class="error-message">{{ listError }}</p>
        
        <ul v-else class="material-list">
          <li v-for="material in materiais" :key="material.id" class="material-item">
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

// --- ESTADO FORMULÁRIO DE MATERIAL ---
const materialForm = ref({ id: null, nome: '', codigo_interno: '', classificacao: '' })
const isEditing = computed(() => !!materialForm.value.id)

// --- ESTADO MODAL DE REQUISITOS ---
const modalRequisitosAberto = ref(false)
const materialSelecionado = ref(null)
const requisitosAtuais = ref([]) 
const tipoDocumentoSelecionado = ref('')
const loadingRequisitos = ref(true)
const loadingTipos = ref(true)
const requisitosError = ref(null)

// --- COMPUTED PROPS DE REQUISITOS ---
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


// --- FUNÇÕES DE CARREGAMENTO ---

async function fetchMateriais() {
  loadingList.value = true
  listError.value = null
  try {
    const { data, error } = await supabase
      .from('materias_primas')
      .select('*')
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


// --- FUNÇÕES DE CRUD DO MATERIAL ---

function resetForm() {
    materialForm.value = { id: null, nome: '', codigo_interno: '', classificacao: '' }
    materialError.value = null
}

function handleEdit(material) {
    materialForm.value = { ...material }
    materialError.value = null
}

async function handleMaterialSubmit() {
    loadingMaterial.value = true
    materialError.value = null
    const isUpdate = isEditing.value

    try {
        const payload = { 
            nome: materialForm.value.nome,
            codigo_interno: materialForm.value.codigo_interno,
            classificacao: materialForm.value.classificacao
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

/**
 * NOVA FUNÇÃO: Excluir um material e todas as suas dependências.
 */
async function handleDeleteMaterial(material) {
  if (!confirm(`TEM CERTEZA que deseja excluir o material "${material.nome}"?\n\nEsta ação é irreversível e removerá TODOS os requisitos e associações deste material com fornecedores.`)) {
    return;
  }

  loadingMaterial.value = true;
  materialError.value = null;

  try {
    // Etapa 1: Excluir dependências em 'requisitos_material'
    const { error: reqError } = await supabase
      .from('requisitos_material')
      .delete()
      .eq('materia_prima_id', material.id);
    if (reqError) throw new Error(`Falha ao excluir requisitos: ${reqError.message}`);

    // Etapa 2: Excluir dependências em 'fornecedor_materiais'
    const { error: fornError } = await supabase
      .from('fornecedor_materiais')
      .delete()
      .eq('materia_prima_id', material.id);
    if (fornError) throw new Error(`Falha ao excluir associações: ${fornError.message}`);

    // Etapa 3: Excluir o material principal
    const { error: matError } = await supabase
      .from('materias_primas')
      .delete()
      .eq('id', material.id);
    if (matError) throw new Error(`Falha ao excluir material: ${matError.message}`);

    alert(`Material "${material.nome}" excluído com sucesso.`);
    
    // Etapa 4: Atualizar a UI
    await fetchMateriais(); // Recarrega a lista
    await fetchRequisitosECount(); // Recarrega a contagem de requisitos
    
    // Se o material excluído era o que estava em edição, limpa o formulário
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


// --- FUNÇÕES DE GESTÃO DE REQUISITOS (Modal) ---

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


// --- CICLO DE VIDA ---
onMounted(() => {
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
/* FIM CABEÇALHO PADRÃO */

.admin-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
@media (max-width: 900px) { .admin-grid { grid-template-columns: 1fr; } .list-section { order: -1; } }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.form-group { display: flex; flex-direction: column; margin-bottom: 15px; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #333; }
.form-group input, .form-group select { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
.form-actions { display: flex; gap: 10px; }
.btn-submit { background-color: #c50d42; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #a30b37; }
.btn-cancel { background-color: #6c757d; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
.error-message { color: #dc3545; margin-top: 10px; font-weight: bold; }
.material-list { list-style: none; padding: 0; }
.material-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dotted #eee; }
.material-info small { display: block; color: #666; }
.material-actions { display: flex; gap: 8px; flex-wrap: wrap; /* Permite que os botões quebrem a linha em telas menores */ }
.btn-action { padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em; border: 1px solid transparent; }
.btn-edit { background-color: #ffc107; color: #333; }
.btn-requisitos { background-color: #007bff; color: white; }
.btn-delete { background-color: #dc3545; color: white; }
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