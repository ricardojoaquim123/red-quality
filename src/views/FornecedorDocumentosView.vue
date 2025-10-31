<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { supabase } from '@/supabase'

// --- Inicialização ---
const route = useRoute()
const fornecedorId = route.params.id
const fornecedor = ref(null)
const loading = ref(true)

// --- ESTADO DA CHECKLIST (ARQUITETURA ATUALIZADA) ---
// Em vez de uma 'requisitos', agora temos duas listas separadas
const requisitosGlobais = ref([])
const requisitosPorMaterial = ref([]) // Estrutura: [{ materialNome: 'Resina', documentos: [...] }, ...]
const documentosEnviados = ref([])

// --- Estado do Upload (Sem mudanças) ---
const fileToUpload = ref(null)
const dataEmissao = ref(null)
const dataValidade = ref(null)
const uploading = ref(false)
const uploadError = ref(null)
const selectedRequisito = ref(null) 


// --- 1. FUNÇÃO PRINCIPAL (Busca tudo - LÓGICA ATUALIZADA) ---
async function fetchData() {
  loading.value = true
  
  try {
    // 1. Buscar dados do Fornecedor
    const { data: fornecedorData, error: fornecedorError } = await supabase
      .from('fornecedores')
      .select('*, grupos_fornecedor(nome_grupo)') 
      .eq('id', fornecedorId)
      .single()
    if (fornecedorError) throw fornecedorError 
    fornecedor.value = fornecedorData

    // 2. Buscar Documentos já Enviados (Sem mudança)
    const { data: enviadosData, error: enviadosError } = await supabase
      .from('documentos_fornecedor')
      .select('*')
      .eq('fornecedor_id', fornecedorId)
    if (enviadosError) throw enviadosError
    documentosEnviados.value = enviadosData

    // 3. Buscar Requisitos GLOBAIS (Baseados no Grupo)
    if (fornecedorData.grupo_fornecedor_id) {
      const { data: reqGlobaisData, error: reqGlobaisError } = await supabase
        .from('requisitos_grupo')
        .select('tipos_documento(*)')
        .eq('grupo_id', fornecedorData.grupo_fornecedor_id)
      if (reqGlobaisError) throw reqGlobaisError
      // Define a ref 'requisitosGlobais'
      requisitosGlobais.value = reqGlobaisData.map(r => r.tipos_documento).filter(Boolean)
    }
    
    // 4. Buscar Requisitos ESPECÍFICOS (Agrupados por Material)
    // 4a. Achar os materiais que o fornecedor fornece (com join para pegar o NOME do material)
    const { data: materiaisFornecidos, error: matError } = await supabase
      .from('fornecedor_materiais')
      .select('materias_primas(id, nome)') // JOIN para pegar o nome e id da materia_prima
      .eq('fornecedor_id', fornecedorId)
    if (matError) throw matError
    
    // Filtra nulos e cria lista de IDs e um Map de Nomes
    const materiais = materiaisFornecidos.map(m => m.materias_primas).filter(Boolean)
    const materialIds = materiais.map(m => m.id)

    // 4b. Achar os documentos exigidos por esses materiais
    if (materialIds.length > 0) {
      const { data: reqEspecificosData, error: reqEspecificosError } = await supabase
        .from('requisitos_material')
        .select('materia_prima_id, tipos_documento(*)') // Pega o doc E o ID do material ao qual pertence
        .in('materia_prima_id', materialIds) 
      if (reqEspecificosError) throw reqEspecificosError

      // 4c. Agrupar os documentos por material (a "magica" da organização)
      const groupedByMaterial = new Map()
      // Primeiro, popula o Map com todos os materiais que o fornecedor fornece
      materiais.forEach(m => groupedByMaterial.set(m.id, { materialNome: m.nome, documentos: [] }))

      // Segundo, distribui os requisitos encontrados nos seus respectivos materiais
      reqEspecificosData.forEach(req => {
        if (req.tipos_documento) {
          groupedByMaterial.get(req.materia_prima_id)?.documentos.push(req.tipos_documento)
        }
      })
      
      // Define a ref 'requisitosPorMaterial' com os dados agrupados
      // Filtramos materiais que não têm nenhum requisito
      requisitosPorMaterial.value = Array.from(groupedByMaterial.values())
                                        .filter(group => group.documentos.length > 0)
    }

    // 5. NÃO COMBINAMOS MAIS. As refs estão prontas para o template.

  } catch (err) {
    console.error('Erro ao buscar dados:', err)
    alert('Erro ao carregar a página: ' + err.message)
  } finally {
    loading.value = false
  }
}

// --- 2. A "CHECKLIST" (COMPUTED - ATUALIZADO) ---

// Criamos uma função HELPER, pois vamos usar essa lógica de status duas vezes
function processRequisitosList(requisitosList) {
  if (!requisitosList) return []
  return requisitosList.map(req => {
    // Busca o documento enviado correspondente
    const docEnviado = documentosEnviados.value.find(
      enviado => enviado.tipo_documento_id === req.id
    )
    
    // Lógica de Status (idêntica à anterior)
    let status = 'Pendente'
    if (docEnviado) {
      status = docEnviado.status
      if (status === 'Aprovado' && req.requer_data_validade && docEnviado.data_validade) {
        if (new Date(docEnviado.data_validade) < new Date(new Date().setHours(0,0,0,0))) {
          status = 'Vencido'
        }
      }
    }
    return { ...req, docEnviado: docEnviado, status: status }
  })
}

// Computed para a Lista Global
const checklistGlobal = computed(() => processRequisitosList(requisitosGlobais.value))

// Computed para a Lista Agrupada por Material
const checklistPorMaterial = computed(() => {
  return requisitosPorMaterial.value.map(materialGroup => {
    return {
      materialNome: materialGroup.materialNome,
      // Usamos a mesma função helper para processar os documentos internos
      documentos: processRequisitosList(materialGroup.documentos)
    }
  })
})

// --- 3. FUNÇÕES DE UPLOAD / MODAL ---
// Nenhuma mudança necessária.
function onFileSelected(event) {
  fileToUpload.value = event.target.files[0]
  uploadError.value = null
}
function openUploadModal(requisito) {
  selectedRequisito.value = requisito
  fileToUpload.value = null
  dataEmissao.value = new Date().toISOString().split('T')[0]; 
  dataValidade.value = null
  uploadError.value = null
  if (requisito.docEnviado) {
    dataEmissao.value = requisito.docEnviado.data_emissao
    dataValidade.value = requisito.docEnviado.data_validade
  }
}
function closeUploadModal() {
  selectedRequisito.value = null
}
async function handleUpload() {
  if (!fileToUpload.value && !selectedRequisito.value.docEnviado) {
    return uploadError.value = 'Por favor, selecione um arquivo.'
  }
  uploading.value = true
  uploadError.value = null
  let filePath = null
  let fileName = null
  try {
    if (fileToUpload.value) {
      const file = fileToUpload.value
      fileName = file.name
      filePath = `${fornecedorId}/${selectedRequisito.value.id}/${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('documentos-fornecedores')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError
    }
    const docMetadata = {
      fornecedor_id: fornecedorId,
      tipo_documento_id: selectedRequisito.value.id,
      data_emissao: dataEmissao.value,
      data_validade: dataValidade.value,
      status: 'Em Análise',
      ...(filePath && { 
        arquivo_url: filePath,
        nome_arquivo: fileName 
      })
    }
    const { error: dbError } = await supabase
      .from('documentos_fornecedor')
      .upsert(docMetadata, { 
        onConflict: 'fornecedor_id, tipo_documento_id'
      })
    if (dbError) throw dbError
    uploading.value = false
    closeUploadModal()
    alert('Documento salvo com sucesso! Status: Em Análise.')
    await fetchData()
  } catch (err) {
    console.error('Erro no upload:', err)
    if (err.message && err.message.includes('security policy')) {
      uploadError.value = 'Erro: Você não tem permissão para enviar documentos.'
    } else {
      uploadError.value = 'Erro: ' + err.message
    }
    uploading.value = false
  }
}

// --- 4. FUNÇÕES DE ARQUIVO (DOWNLOAD E VISUALIZAR) ---
// Nenhuma mudança necessária.
async function visualizarFile(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('documentos-fornecedores')
      .createSignedUrl(filePath, 60, { 
        download: false
      })
    if (error) throw error
    window.open(data.signedUrl, '_blank')
  } catch (err) {
    alert('Erro ao visualizar arquivo: ' + err.message)
  }
}

async function downloadFile(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('documentos-fornecedores')
      .createSignedUrl(filePath, 60, {
        download: true
      })
    if (error) throw error
    window.open(data.signedUrl, '_blank')
  } catch (err) {
    alert('Erro ao baixar arquivo: ' + err.message)
  }
}

async function deleteFile(docEnviado) {
  if (!window.confirm(`Tem certeza que deseja excluir o documento "${docEnviado.nome_arquivo}"?`)) return
  try {
    if (docEnviado.arquivo_url) {
      const { error: storageError } = await supabase.storage
        .from('documentos-fornecedores')
        .remove([docEnviado.arquivo_url])
      if (storageError) console.warn("Erro ao deletar do Storage:", storageError.message)
    }
    const { error: dbError } = await supabase
      .from('documentos_fornecedor')
      .delete()
      .eq('id', docEnviado.id)
    if (dbError) throw dbError
    alert('Documento excluído com sucesso.')
    await fetchData()
  } catch (err) {
    if (err.message && err.message.includes('security policy')) {
      alert('Erro: Você não tem permissão para excluir documentos.')
    } else {
      alert('Erro ao excluir: ' + err.message)
    }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <RouterLink to="/fornecedores" class="link-voltar">&larr; Voltar para Fornecedores</RouterLink>
        
        <div v-if="fornecedor">
          <h2>{{ fornecedor.nome }}</h2>
          <h3>Checklist de Documentos de Homologação</h3>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading">Carregando checklist...</div>
    
    <div v-else-if="checklistGlobal.length === 0 && checklistPorMaterial.length === 0" class="empty-list">
      <p>Este fornecedor não possui nenhum documento requerido (nem por Grupo, nem por Material).</p>
      <p>
        Vá até <RouterLink to="/configuracoes">Configurações</RouterLink> (para requisitos de grupo) ou 
        <RouterLink to="/admin/materiais">Admin de Materiais</RouterLink> (para requisitos de material)
        para definir os requisitos.
      </p>
    </div>

    <div v-else>
      
      <section class="list-section" v-if="checklistGlobal.length > 0">
        <h2 class="section-title">
          Requisitos Globais (Grupo: <strong>{{ fornecedor.grupos_fornecedor?.nome_grupo || 'N/A' }}</strong>)
        </h2>
        <ul class="item-list">
          <li class="item-checklist header-list">
            <span>Documento Requerido</span>
            <span>Status</span>
            <span>Validade</span>
            <span class="actions">Ações</span>
          </li>
          <li v-for="item in checklistGlobal" :key="item.id" class="item-checklist">
            <span>
              <strong>{{ item.nome_documento }}</strong>
              <small v-if="item.docEnviado">{{ item.docEnviado.nome_arquivo }}</small>
            </span>
            <span>
              <strong :class="`status-${item.status.toLowerCase().split(' ')[0]}`">
                {{ item.status }}
              </strong>
            </span>
            <span>{{ item.docEnviado?.data_validade || '--' }}</span>
            <span class="actions">
              <button @click="openUploadModal(item)" class="button-action button-upload">
                {{ item.docEnviado ? 'Atualizar' : 'Enviar' }}
              </button>
              <button v-if="item.docEnviado" @click="visualizarFile(item.docEnviado.arquivo_url)" class="button-action button-visualizar">
                Visualizar
              </button>
              <button v-if="item.docEnviado" @click="downloadFile(item.docEnviado.arquivo_url)" class="button-action button-download">
                Baixar
              </button>
            </span>
          </li>
        </ul>
      </section>

      <section 
        class="list-section" 
        v-for="material in checklistPorMaterial" 
        :key="material.materialNome" 
        style="margin-top: 2rem;"
      >
        <h2 class="section-title">
          Requisitos Específicos (Material: <strong>{{ material.materialNome }}</strong>)
        </h2>
        <ul class="item-list">
          <li class="item-checklist header-list">
            <span>Documento Requerido</span>
            <span>Status</span>
            <span>Validade</span>
            <span class="actions">Ações</span>
          </li>
          <li v-for="item in material.documentos" :key="item.id" class="item-checklist">
            <span>
              <strong>{{ item.nome_documento }}</strong>
              <small v-if="item.docEnviado">{{ item.docEnviado.nome_arquivo }}</small>
            </span>
            <span>
              <strong :class="`status-${item.status.toLowerCase().split(' ')[0]}`">
                {{ item.status }}
              </strong>
            </span>
            <span>{{ item.docEnviado?.data_validade || '--' }}</span>
            <span class="actions">
              <button @click="openUploadModal(item)" class="button-action button-upload">
                {{ item.docEnviado ? 'Atualizar' : 'Enviar' }}
              </button>
              <button v-if="item.docEnviado" @click="visualizarFile(item.docEnviado.arquivo_url)" class="button-action button-visualizar">
                Visualizar
              </button>
              <button v-if="item.docEnviado" @click="downloadFile(item.docEnviado.arquivo_url)" class="button-action button-download">
                Baixar
              </button>
            </span>
          </li>
        </ul>
      </section>

    </div>
    
    <div v-if="selectedRequisito" class="modal-overlay" @click.self="closeUploadModal">
      <div class="modal-content">
        <h3>{{ selectedRequisito.docEnviado ? 'Atualizar' : 'Enviar' }} Documento</h3>
        <h4>{{ selectedRequisito.nome_documento }}</h4>
        
        <form @submit.prevent="handleUpload" class="upload-form">
          <div class="input-group">
            <label for="file">Arquivo (PDF, PNG, JPG...)</label>
            <input 
              type="file" 
              id="file" 
              @change="onFileSelected"
              :required="!selectedRequisito.docEnviado"
            >
            <div v-if="selectedRequisito.docEnviado && !fileToUpload" class="file-info">
              Arquivo atual: 
              <a href="#" @click.prevent="visualizarFile(selectedRequisito.docEnviado.arquivo_url)">
                {{ selectedRequisito.docEnviado.nome_arquivo }}
              </a>
              <button 
                @click.prevent="deleteFile(selectedRequisito.docEnviado)" 
                class="button-delete-tiny"
              >X</button>
            </div>
          </div>
          
          <div class="input-group-split">
            <div class="input-group">
              <label for="data_emissao">Data de Emissão</label>
              <input type="date" id="data_emissao" v-model="dataEmissao">
            </div>
            <div class="input-group" v-if="selectedRequisito.requer_data_validade">
              <label for="data_validade">Data de Validade</label>
              <input 
                type="date" 
                id="data_validade" 
                v-model="dataValidade"
                :required="selectedRequisito.requer_data_validade"
              >
            </div>
          </div>
          
          <p v-if="uploadError" class="error-message">{{ uploadError }}</p>

          <div class="action-buttons">
            <button type="submit" class="button-salvar" :disabled="uploading">
              {{ uploading ? 'Enviando...' : 'Salvar' }}
            </button>
            <button type="button" class="button-cancelar" @click="closeUploadModal">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
    
  </div>
</template>

<style scoped>
/* Adicionando um estilo para o novo título da seção */
.section-title {
  font-size: 1.4rem;
  color: #333;
  background-color: #f8f9fa; /* Um fundo leve para destacar o título da seção */
  padding: 1rem 1.5rem;
  margin: 0;
  border-bottom: 2px solid #ddd;
}
.section-title strong {
  color: #007bff; /* Destaca o nome do grupo/material */
}

/* (Estilos da página, do modal e da checklist) */
h2 { margin-top: 0; }
h3 { margin-top: 0; }
.page-header {
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 2rem;
}
.link-voltar {
  font-size: 0.9rem;
  color: #555;
  text-decoration: none;
  margin-bottom: 0.5rem;
  display: inline-block;
}
.link-voltar:hover { text-decoration: underline; }

.list-section {
  background: #fff;
  padding: 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}
.loading, .empty-list {
  text-align: center;
  padding: 3rem;
  font-style: italic;
  color: #777;
  background-color: #fff;
  border-radius: 8px;
}
.empty-list a { font-weight: 600; }
.item-list { list-style: none; padding: 0; margin: 0; }
.item-checklist {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}
.item-checklist:last-child { border-bottom: none; }
.item-checklist.header-list {
  font-weight: 700;
  color: #333;
  background-color: #f8f9fa;
  border-bottom: 2px solid #ddd;
}
.item-checklist strong { color: #333; }
.item-checklist small {
  display: block;
  font-size: 0.8rem;
  color: #777;
  margin-top: 0.2rem;
}
/* Status com Cores */
.status-aprovado { color: #28a745; }
.status-rejeitado { color: #dc3545; }
.status-vencido { color: #dc3545; font-weight: 700; }
.status-em { color: #fd7e14; } /* Em Análise */
.status-pendente { color: #6c757d; }

.actions { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
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
.button-upload { background-color: #007bff; }
.button-visualizar { background-color: #17a2b8; }
.button-download { background-color: #6c757d; }

/* --- Estilos do Modal --- */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  width: 100%;
  max-width: 600px;
}
.upload-form { display: flex; flex-direction: column; gap: 1.2rem; margin-top: 1.5rem; }
.input-group { display: flex; flex-direction: column; }
.input-group label { margin-bottom: 0.5rem; font-weight: 600; color: #444; }
.input-group input, .input-group select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}
.input-group input[type="file"] {
  padding: 0.5rem;
  background-color: #fdfdfd;
}
.input-group-split { display: flex; gap: 1rem; }
.input-group-split > .input-group { flex: 1; }
.file-info {
  font-size: 0.9rem;
  color: #555;
  background: #f4f4f4;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}
.file-info a {
  font-weight: 600;
  color: #007bff;
}
.button-delete-tiny {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  margin-left: 10px;
}
.action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
.button-salvar {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: #28a745;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.button-salvar:disabled { background-color: #ccc; }
.button-cancelar {
  padding: 0.75rem 1.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
  color: #555;
  font-size: 1rem;
  cursor: pointer;
}
.error-message {
  color: #dc3545;
  font-weight: 600;
  margin-bottom: 0;
}

/* Responsividade da Checklist */
@media (max-width: 768px) {
  .item-checklist {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding-bottom: 1.5rem;
  }
  .item-checklist.header-list { display: none; }
  .item-checklist span:nth-of-type(2)::before { content: 'Status: '; font-weight: 600; }
  .item-checklist span:nth-of-type(3)::before { content: 'Validade: '; font-weight: 600; }
  .actions { justify-content: flex-start; }
  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }
  .input-group-split { flex-direction: column; gap: 1.2rem; }
}
</style>