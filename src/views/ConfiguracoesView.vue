<script setup>
// Importamos 'computed' para criar as listas dinâmicas
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/supabase'

// --- ESTADO PARA "GRUPOS DE FORNECEDOR" ---
const grupos = ref([])
const novoGrupoNome = ref('')
const loadingGrupos = ref(false)

// --- ESTADO PARA "TIPOS de DOCUMENTO" ---
const tiposDocumento = ref([])
const novoTipoDocNome = ref('')
const novoTipoDocValidade = ref(true)
const loadingTiposDoc = ref(false)

// --- ESTADO PARA A "MATRIZ" ---
const selectedGrupo = ref(null) // Guarda o grupo que o usuário clicou
const requisitosDoGrupo = ref([]) // Guarda os IDs dos docs requeridos
const loadingRequisitos = ref(false)

// --- FUNÇÕES "GRUPOS DE FORNECEDOR" ---
async function fetchGrupos() { /* (igual a antes) */
  loadingGrupos.value = true
  try {
    const { data, error } = await supabase.from('grupos_fornecedor').select('*').order('nome_grupo')
    if (error) throw error
    grupos.value = data
  } catch (err) { alert('Erro ao buscar grupos: ' + err.message) } 
  finally { loadingGrupos.value = false }
}
async function handleNovoGrupo() { /* (igual a antes) */
  if (novoGrupoNome.value.trim().length < 3) return alert('O nome do grupo deve ter pelo menos 3 caracteres.')
  try {
    const { data, error } = await supabase.from('grupos_fornecedor').insert({ nome_grupo: novoGrupoNome.value.trim() }).select()
    if (error) throw error
    grupos.value.push(data[0]) 
    novoGrupoNome.value = ''
  } catch (err) { alert('Erro ao salvar grupo: ' + err.message) }
}
async function deleteGrupo(id) {
  if (!window.confirm("Tem certeza? Deletar um grupo irá removê-lo de todos os fornecedores.")) return
  try {
    const { error } = await supabase.from('grupos_fornecedor').delete().eq('id', id)
    if (error) throw error
    // Remove da lista na tela
    grupos.value = grupos.value.filter(g => g.id !== id)
    // Se o grupo deletado era o selecionado, limpa a matriz
    if (selectedGrupo.value?.id === id) {
      selectedGrupo.value = null
    }
  } catch (err) {
    alert('Erro ao deletar grupo: ' + err.message)
  }
}


// --- FUNÇÕES "TIPOS DE DOCUMENTO" ---
async function fetchTiposDocumento() { /* (igual a antes) */
  loadingTiposDoc.value = true
  try {
    const { data, error } = await supabase.from('tipos_documento').select('*').order('nome_documento')
    if (error) throw error
    tiposDocumento.value = data
  } catch (err) { alert('Erro ao buscar tipos de documento: ' + err.message) }
  finally { loadingTiposDoc.value = false }
}
async function handleNovoTipoDocumento() { /* (igual a antes) */
  if (novoTipoDocNome.value.trim().length < 3) return alert('O nome do documento deve ter pelo menos 3 caracteres.')
  try {
    const { data, error } = await supabase.from('tipos_documento').insert({ nome_documento: novoTipoDocNome.value.trim(), requer_data_validade: novoTipoDocValidade.value }).select()
    if (error) throw error
    tiposDocumento.value.push(data[0])
    novoTipoDocNome.value = ''
    novoTipoDocValidade.value = true
  } catch (err) { alert('Erro ao salvar tipo de documento: ' + err.message) }
}
async function deleteTipoDocumento(id) {
  if (!window.confirm("Tem certeza? Deletar um tipo de documento irá removê-lo de todas as matrizes de requisitos.")) return
  try {
    const { error } = await supabase.from('tipos_documento').delete().eq('id', id)
    if (error) throw error
    tiposDocumento.value = tiposDocumento.value.filter(d => d.id !== id)
  } catch (err) {
    alert('Erro ao deletar tipo de documento: ' + err.message)
  }
}

// --- FUNÇÕES DA "MATRIZ" (NOVAS) ---
// 1. Busca os requisitos quando um grupo é selecionado
async function fetchRequisitos() {
  if (!selectedGrupo.value) return
  loadingRequisitos.value = true
  requisitosDoGrupo.value = []
  try {
    const { data, error } = await supabase
      .from('requisitos_grupo')
      .select('tipo_documento_id') // Só precisamos do ID do doc
      .eq('grupo_id', selectedGrupo.value.id) // Para o grupo selecionado
    if (error) throw error
    // Salva a lista de IDs (ex: ['id_iso9001', 'id_alvara'])
    requisitosDoGrupo.value = data.map(r => r.tipo_documento_id)
  } catch (err) {
    alert('Erro ao buscar requisitos: ' + err.message)
  } finally {
    loadingRequisitos.value = false
  }
}

// 2. É chamada quando o usuário clica em um grupo na lista
function selectGrupo(grupo) {
  selectedGrupo.value = grupo
  fetchRequisitos() // Dispara a busca de requisitos
}

// 3. Adiciona um documento na matriz
async function addRequisito(tipoDocumentoId) {
  try {
    const { error } = await supabase
      .from('requisitos_grupo')
      .insert({
        grupo_id: selectedGrupo.value.id,
        tipo_documento_id: tipoDocumentoId
      })
    if (error) throw error
    // Adiciona o ID na nossa lista local para a tela atualizar
    requisitosDoGrupo.value.push(tipoDocumentoId)
  } catch (err) {
    alert('Erro ao adicionar requisito: ' + err.message)
  }
}

// 4. Remove um documento da matriz
async function removeRequisito(tipoDocumentoId) {
  try {
    const { error } = await supabase
      .from('requisitos_grupo')
      .delete()
      .eq('grupo_id', selectedGrupo.value.id)
      .eq('tipo_documento_id', tipoDocumentoId)
    if (error) throw error
    // Remove o ID da nossa lista local
    requisitosDoGrupo.value = requisitosDoGrupo.value.filter(id => id !== tipoDocumentoId)
  } catch (err) {
    alert('Erro ao remover requisito: ' + err.message)
  }
}

// --- Listas Dinâmicas (NOVAS) ---
// 'computed' cria uma lista que se atualiza sozinha
const documentosRequeridos = computed(() => {
  // Filtra a lista mestre de documentos
  return tiposDocumento.value.filter(doc => 
    requisitosDoGrupo.value.includes(doc.id) // Onde o ID está na lista de requisitos
  )
})

const documentosDisponiveis = computed(() => {
  // Filtra a lista mestre de documentos
  return tiposDocumento.value.filter(doc => 
    !requisitosDoGrupo.value.includes(doc.id) // Onde o ID NÃO está na lista de requisitos
  )
})


// Roda as duas funções de busca quando a página carrega
onMounted(() => {
  fetchGrupos()
  fetchTiposDocumento()
})
</script>

<template>
  <div>
    <h2>Configurações da Matriz de Documentos</h2>
    
    <div class="container-split">
      <section class="config-section">
        <h3>Etapa 1: Criar Grupos</h3>
        <p>Ex: Matéria-Prima, Serviços, Transportadoras.</p>
        <form @submit.prevent="handleNovoGrupo" class="form-inline">
          <input type="text" v-model="novoGrupoNome" placeholder="Nome do novo grupo" required />
          <button type="submit">Salvar Grupo</button>
        </form>
        
        <div class="loading" v-if="loadingGrupos">Carregando grupos...</div>
        <ul v-else class="item-list clickable">
          <li 
            v-for="grupo in grupos" 
            :key="grupo.id"
            @click="selectGrupo(grupo)"
            :class="{ 'selected': selectedGrupo?.id === grupo.id }"
          >
            <span>{{ grupo.nome_grupo }}</span>
            <button @click.stop="deleteGrupo(grupo.id)" class="button-delete-tiny">X</button>
          </li>
        </ul>
        <p v-if="!loadingGrupos" class="hint">Clique em um grupo para definir os requisitos.</p>
      </section>
      
      <section class="config-section">
        <h3>Etapa 2: Criar Tipos de Documento</h3>
        <p>Catálogo mestre de todos os documentos que sua empresa solicita.</p>
        <form @submit.prevent="handleNovoTipoDocumento" class="form-inline-stacked">
          <input type="text" v-model="novoTipoDocNome" placeholder="Nome do novo documento (ex: ISO 9001)" required />
          <label class="checkbox-label">
            <input type="checkbox" v-model="novoTipoDocValidade" />
            Este documento possui data de validade?
          </label>
          <button type="submit">Salvar Documento</button>
        </form>
        
        <div class="loading" v-if="loadingTiposDoc">Carregando documentos...</div>
        <ul v-else class="item-list">
          <li v-for="doc in tiposDocumento" :key="doc.id">
            <span>{{ doc.nome_documento }}</span>
            <div>
              <span class="badge">{{ doc.requer_data_validade ? 'Requer Validade' : 'Não Requer' }}</span>
              <button @click="deleteTipoDocumento(doc.id)" class="button-delete-tiny" style="margin-left: 8px;">X</button>
            </div>
          </li>
        </ul>
      </section>
    </div>
    
    <section v-if="selectedGrupo" class="matriz-section">
      <h3>Etapa 3: Definir Requisitos para o Grupo: <span class="grupo-selecionado">{{ selectedGrupo.nome_grupo }}</span></h3>
      
      <div v-if="loadingRequisitos" class="loading">Carregando requisitos...</div>
      
      <div v-else class="container-split">
        <div class="matriz-coluna">
          <h4>Documentos Requeridos ({{ documentosRequeridos.length }})</h4>
          <ul class="item-list">
            <li v-for="doc in documentosRequeridos" :key="doc.id" class="matriz-item">
              <span>{{ doc.nome_documento }}</span>
              <button @click="removeRequisito(doc.id)" class="button-action button-remove">Remover</button>
            </li>
            <li v-if="documentosRequeridos.length === 0" class="empty-list">Nenhum documento requerido.</li>
          </ul>
        </div>
        
        <div class="matriz-coluna">
          <h4>Documentos Disponíveis ({{ documentosDisponiveis.length }})</h4>
          <ul class="item-list">
            <li v-for="doc in documentosDisponiveis" :key="doc.id" class="matriz-item">
              <span>{{ doc.nome_documento }}</span>
              <button @click="addRequisito(doc.id)" class="button-action button-add">Adicionar</button>
            </li>
            <li v-if="documentosDisponiveis.length === 0" class="empty-list">Nenhum documento disponível.</li>
          </ul>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
h2 {
  margin-top: 0;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
}

.container-split {
  display: grid;
  grid-template-columns: 1fr; /* Padrão Móvel */
  gap: 2rem;
}

@media (min-width: 1024px) {
  .container-split {
    grid-template-columns: 1fr 1fr; /* PC Lado-a-Lado */
  }
}

.config-section {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.config-section h3 { margin-top: 0; }
.config-section p { font-size: 0.9rem; color: #555; margin-bottom: 1.5rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 1rem; }
.hint { font-size: 0.8rem; color: #007bff; text-align: center; margin-top: 1rem; padding: 0 !important; border: none !important; }

/* Formulários */
.form-inline, .form-inline-stacked { display: flex; margin-bottom: 1.5rem; }
.form-inline { flex-wrap: wrap; gap: 0.5rem; }
.form-inline-stacked { flex-direction: column; gap: 1rem; }
.form-inline input[type="text"] {
  flex-grow: 1;
  min-width: 150px; /* Evita quebra de layout */
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}
.form-inline button, .form-inline-stacked button {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #333; }

/* Lista de Itens */
.loading { text-align: center; padding: 1rem; color: #777; }
.empty-list { color: #777; font-style: italic; padding: 0.75rem 0.5rem; }
.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}
.item-list.clickable li {
  cursor: pointer;
  transition: background-color 0.2s;
}
.item-list.clickable li:hover {
  background-color: #f8f9fa;
}
.item-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}
.item-list li:last-child { border-bottom: none; }
.item-list li.selected {
  background-color: #007bff;
  color: white;
  font-weight: 600;
}
.badge { font-size: 0.8rem; background-color: #eee; color: #555; padding: 0.2rem 0.5rem; border-radius: 10px; }

/* Botão Deletar Pequeno */
.button-delete-tiny {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-weight: 600;
  line-height: 20px;
}
.item-list li.selected .button-delete-tiny {
  background-color: white;
  color: #dc3545;
}

/* --- Seção da Matriz --- */
.matriz-section {
  margin-top: 2rem;
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.matriz-section h3 { margin-top: 0; }
.grupo-selecionado {
  color: #007bff;
}
.matriz-coluna h4 {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}
.matriz-item span {
  flex-grow: 1;
}
.button-action {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
}
.button-add {
  background-color: #28a745; /* Verde */
}
.button-remove {
  background-color: #fd7e14; /* Laranja */
}
</style>