<template>
  <div class="metricas-view">
    <header class="page-header">
      <h1>📊 Monitoramento de Fornecedores e Prestadores de Serviço</h1>
      <p>Registre os dados mensais de Entregas (Compras) e Não Conformidades (Qualidade) e monitore o cronograma de lançamentos.</p>
    </header>

    <div class="input-selecao card">
      <div class="form-group-inline">
        <div class="form-group">
          <label for="mesRef">Mês de Referência (Obrigatório)</label>
          <input type="month" id="mesRef" v-model="mesReferenciaInput" required>
          <small>Selecione o mês ao qual as métricas se referem.</small>
        </div>
      </div>
    </div>
    
    <div class="tabs-container">
      <div class="tabs">
        <button 
          :class="['tab-button', { active: activeTab === 'lancamento' }]" 
          @click="activeTab = 'lancamento'"
          :disabled="!mesReferencia"
        >
          Lançamento de Dados
        </button>
        <button 
          :class="['tab-button', { active: activeTab === 'acompanhamento' }]" 
          @click="activeTab = 'acompanhamento'"
          :disabled="!mesReferencia"
        >
          Cronograma / Acompanhamento
        </button>
      </div>
      
      <div v-if="!mesReferenciaInput" class="card tab-content error-message">
        <p>⚠️ Por favor, selecione o **Mês de Referência** para começar o lançamento ou acompanhamento.</p>
      </div>

      <div v-if="activeTab === 'lancamento' && mesReferencia" class="tab-content card">
        <div class="form-group-input">
          <label for="fornecedorSelect">Fornecedor</label>
          <select id="fornecedorSelect" v-model="fornecedorSelecionadoId" required :disabled="loadingFornecedores">
            <option value="" disabled>-- Selecione um Fornecedor --</option>
            <option v-for="f in fornecedores" :key="f.id" :value="f.id">{{ f.nome }}</option>
          </select>
          <p v-if="loadingFornecedores">Carregando fornecedores...</p>
          <p v-else-if="fornecedoresError" class="error-message">{{ fornecedoresError }}</p>
        </div>
        
        <div v-if="loadingDadosExistentes" class="loading-state">
            <p>Carregando dados existentes para edição...</p>
        </div>

        <div class="sub-tabs" v-if="fornecedorSelecionadoId && !loadingDadosExistentes">
            <button 
              :class="['sub-tab-button', { active: subActiveTab === 'compras' }]" 
              @click="subActiveTab = 'compras'"
            >
              Compras
            </button>
            <button 
              :class="['sub-tab-button', { active: subActiveTab === 'qualidade' }]" 
              @click="subActiveTab = 'qualidade'"
            >
              Qualidade
            </button>
        </div>
        
        <p v-if="fornecedorSelecionadoId && !loadingDadosExistentes" class="fornecedor-info">Lançando métricas de **{{ nomeMesReferencia }}** para **{{ nomeFornecedorSelecionado }}**</p>


        <form v-if="fornecedorSelecionadoId && subActiveTab === 'compras' && !loadingDadosExistentes" @submit.prevent="handleLancarMetrica('compras')">
          <div class="form-grid">
            <div class="form-group">
              <label for="totalEntregas">Total de Entregas Realizadas</label>
              <input type="number" id="totalEntregas" v-model.number="comprasForm.total_entregas" min="0" required>
            </div>
            <div class="form-group">
              <label for="entregasAtraso">Entregas com Atraso</label>
              <input type="number" id="entregasAtraso" v-model.number="comprasForm.entregas_atraso" min="0" required :max="comprasForm.total_entregas">
              <small v-if="comprasForm.entregas_atraso > comprasForm.total_entregas" class="error-message">O atraso não pode ser maior que o total.</small>
            </div>
          </div>
          <button type="submit" :disabled="loadingLancamento || comprasForm.entregas_atraso > comprasForm.total_entregas" class="btn-submit">
            {{ loadingLancamento ? 'Salvando...' : 'Salvar/Corrigir Dados de Compras' }}
          </button>
          <p v-if="lancamentoError" class="error-message">{{ lancamentoError }}</p>
        </form>

        <form v-else-if="fornecedorSelecionadoId && subActiveTab === 'qualidade' && !loadingDadosExistentes" @submit.prevent="handleLancarMetrica('qualidade')">
          <div class="form-grid">
            <div class="form-group">
              <label for="ncsLeves">Notificações de Não Conformidade (Leve)</label>
              <input type="number" id="ncsLeves" v-model.number="qualidadeForm.notificacoes_nc" min="0" required>
            </div>
            <div class="form-group">
              <label for="ncsGraves">Não Conformidades (Crítica)</label>
              <input type="number" id="ncsGraves" v-model.number="qualidadeForm.nao_conformidades_graves" min="0" required>
            </div>
            <div class="form-group">
              <label>Total de NCs</label>
              <input type="text" :value="totalNCs" disabled>
              <small>Calculado automaticamente: Notificações + Graves.</small>
            </div>
          </div>
          
          <button type="submit" :disabled="loadingLancamento" class="btn-submit">
            {{ loadingLancamento ? 'Salvando...' : 'Salvar/Corrigir Dados de Qualidade' }}
          </button>
          <p v-if="lancamentoError" class="error-message">{{ lancamentoError }}</p>
        </form>
      </div>

      <div v-else-if="activeTab === 'acompanhamento' && mesReferencia" class="tab-content card">
        <h3>Cronograma de Lançamento: {{ nomeMesReferencia }}</h3>
        
        <p v-if="loadingAcompanhamento" class="loading-state">Carregando status de acompanhamento...</p>
        <p v-else-if="acompanhamentoError" class="error-message">{{ acompanhamentoError }}</p>
        <p v-else-if="acompanhamentoList.length === 0">Nenhum fornecedor cadastrado.</p>

        <table v-else class="status-table">
            <thead>
                <tr>
                    <th>Fornecedor</th>
                    <th>Status Compras</th>
                    <th>Status Qualidade</th>
                    <th>Ação</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="item in acompanhamentoList" :key="item.id">
                    <td>{{ item.nome }}</td>
                    <td>
                        <span :class="['status-badge', item.comprasCompleto ? 'completo' : 'pendente']">
                            {{ item.comprasCompleto ? '✅ Completo' : '❌ Pendente' }}
                        </span>
                    </td>
                    <td>
                        <span :class="['status-badge', item.qualidadeCompleto ? 'completo' : 'pendente']">
                            {{ item.qualidadeCompleto ? '✅ Completo' : '❌ Pendente' }}
                        </span>
                    </td>
                    <td>
                        <button @click="abrirParaLancamento(item.id, !item.comprasCompleto ? 'compras' : 'qualidade')" class="btn-pequeno">
                            Lançar/Corrigir
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '@/supabase'
import { useAuthStore } from '@/stores/authStore' 

const authStore = useAuthStore()

// --- ESTADOS REATIVOS ---
const activeTab = ref('lancamento') 
const subActiveTab = ref('compras') 

const fornecedores = ref([])
const loadingFornecedores = ref(true)
const fornecedoresError = ref(null)

// Seleção
const mesReferenciaInput = ref('') 
const fornecedorSelecionadoId = ref('')

// Formulários
const comprasForm = ref({ total_entregas: 0, entregas_atraso: 0 })
const qualidadeForm = ref({ notificacoes_nc: 0, nao_conformidades_graves: 0 }) 
const loadingLancamento = ref(false)
const lancamentoError = ref(null)
const loadingDadosExistentes = ref(false) // NOVO ESTADO

// Acompanhamento
const acompanhamentoList = ref([]) 
const loadingAcompanhamento = ref(false)
const acompanhamentoError = ref(null)

// --- COMPUTED PROPERTIES ---

const mesReferencia = computed(() => {
  if (mesReferenciaInput.value) {
    return `${mesReferenciaInput.value}-01`
  }
  return null
})

const totalNCs = computed(() => {
  return qualidadeForm.value.notificacoes_nc + qualidadeForm.value.nao_conformidades_graves
})

const nomeFornecedorSelecionado = computed(() => {
  const fornecedor = fornecedores.value.find(f => f.id === fornecedorSelecionadoId.value)
  return fornecedor ? fornecedor.nome : 'N/A'
})

const nomeMesReferencia = computed(() => {
  if (!mesReferenciaInput.value) return 'N/A'
  const [ano, mes] = mesReferenciaInput.value.split('-')
  const data = new Date(ano, mes - 1)
  return data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
})

// --- FUNÇÕES DE LÓGICA ---

async function fetchFornecedores() {
  loadingFornecedores.value = true
  fornecedoresError.value = null
  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('id, nome')
      .order('nome', { ascending: true })

    if (error) throw error
    fornecedores.value = data
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error)
    fornecedoresError.value = `Falha ao carregar lista de fornecedores: ${error.message}`
  } finally {
    loadingFornecedores.value = false
  }
}

/**
 * NOVO: Busca dados existentes para preencher o formulário (Permite Correção)
 */
async function fetchDadosExistentes() {
    lancamentoError.value = null;
    if (!fornecedorSelecionadoId.value || !mesReferencia.value) {
        // Limpa os formulários se a seleção estiver incompleta
        comprasForm.value = { total_entregas: 0, entregas_atraso: 0 };
        qualidadeForm.value = { notificacoes_nc: 0, nao_conformidades_graves: 0 };
        return;
    }

    loadingDadosExistentes.value = true;

    try {
        // Busca de Compras
        const { data: compraData } = await supabase
            .from('monitoramento_compras')
            .select('total_entregas, entregas_atraso')
            .eq('fornecedor_id', fornecedorSelecionadoId.value)
            .eq('mes_referencia', mesReferencia.value)
            .maybeSingle();

        // Busca de Qualidade
        const { data: qualidadeData } = await supabase
            .from('monitoramento_qualidade')
            .select('notificacoes_nc, nao_conformidades_graves')
            .eq('fornecedor_id', fornecedorSelecionadoId.value)
            .eq('mes_referencia', mesReferencia.value)
            .maybeSingle();

        // Preenche o formulário de Compras
        comprasForm.value = compraData 
            ? { total_entregas: compraData.total_entregas, entregas_atraso: compraData.entregas_atraso }
            : { total_entregas: 0, entregas_atraso: 0 };
        
        // Preenche o formulário de Qualidade
        qualidadeForm.value = qualidadeData 
            ? { notificacoes_nc: qualidadeData.notificacoes_nc, nao_conformidades_graves: qualidadeData.nao_conformidades_graves }
            : { notificacoes_nc: 0, nao_conformidades_graves: 0 };

    } catch (error) {
        console.error('Erro ao carregar dados existentes:', error);
    } finally {
        loadingDadosExistentes.value = false;
    }
}


/**
 * Lança os dados (UPSERT - insere ou SOBRESCREVE/corrige)
 */
async function handleLancarMetrica(tipo) {
  if (!fornecedorSelecionadoId.value || !mesReferencia.value) {
    alert('Selecione o Fornecedor e o Mês de Referência.')
    return
  }

  loadingLancamento.value = true
  lancamentoError.value = null
  const isCompras = tipo === 'compras'
  const tabela = isCompras ? 'monitoramento_compras' : 'monitoramento_qualidade'
  let payload = {}

  // Lógica de Payload (Sem mudanças)
  if (isCompras) {
    payload = {
      total_entregas: comprasForm.value.total_entregas,
      entregas_atraso: comprasForm.value.entregas_atraso,
    }
    if (payload.entregas_atraso > payload.total_entregas) {
        lancamentoError.value = "Entregas em atraso não podem ser maiores que o total."
        loadingLancamento.value = false
        return
    }
  } else {
    payload = {
      total_ncs: totalNCs.value,
      notificacoes_nc: qualidadeForm.value.notificacoes_nc,
      nao_conformidades_graves: qualidadeForm.value.nao_conformidades_graves,
    }
  }
  
  const userData = authStore.session.user
  const record = {
    fornecedor_id: fornecedorSelecionadoId.value,
    mes_referencia: mesReferencia.value,
    lancado_por: userData.id,
    ...payload
  }

  try {
    // UPSERT: Se o registro existir, ele será substituído (Corrigido)
    const { error } = await supabase
      .from(tabela)
      .upsert(record, { onConflict: 'fornecedor_id, mes_referencia' }) 
      .select()

    if (error) throw error

    alert(`Dados de ${tipo.toUpperCase()} SALVOS/CORRIGIDOS com sucesso para ${nomeFornecedorSelecionado.value} em ${nomeMesReferencia.value}!`)
    
    // NãO limpamos o formulário. Manteremos os dados na tela para o usuário ver o que corrigiu.
    
    if (activeTab.value === 'acompanhamento') {
        fetchStatusAcompanhamento();
    }

  } catch (error) {
    console.error(`Erro ao lançar métricas de ${tipo}:`, error)
    lancamentoError.value = `Erro ao salvar: ${error.message}.`
  } finally {
    loadingLancamento.value = false
  }
}

async function fetchStatusAcompanhamento() {
    // ... (lógica de acompanhamento permanece a mesma) ...
    if (!mesReferencia.value) return;

    loadingAcompanhamento.value = true;
    acompanhamentoError.value = null;

    try {
        const refDate = mesReferencia.value;

        // 1. Busca de Compras
        const { data: comprasData, error: comprasError } = await supabase
            .from('monitoramento_compras')
            .select('fornecedor_id')
            .eq('mes_referencia', refDate);
        if (comprasError) throw comprasError;
        const comprasFeitas = new Set(comprasData.map(d => d.fornecedor_id));

        // 2. Busca de Qualidade
        const { data: qualidadeData, error: qualidadeError } = await supabase
            .from('monitoramento_qualidade')
            .select('fornecedor_id')
            .eq('mes_referencia', refDate);
        if (qualidadeError) throw qualidadeError;
        const qualidadeFeitas = new Set(qualidadeData.map(d => d.fornecedor_id));

        // 3. Montar a lista de status
        acompanhamentoList.value = fornecedores.value.map(f => ({
            id: f.id,
            nome: f.nome,
            comprasCompleto: comprasFeitas.has(f.id),
            qualidadeCompleto: qualidadeFeitas.has(f.id),
        }));

    } catch (error) {
        console.error('Erro ao buscar status de acompanhamento:', error);
        acompanhamentoError.value = `Falha ao carregar status: ${error.message}`;
    } finally {
        loadingAcompanhamento.value = false;
    }
}

function abrirParaLancamento(fornecedorId, tab) {
    fornecedorSelecionadoId.value = fornecedorId;
    subActiveTab.value = tab;
    activeTab.value = 'lancamento';
}

// --- LIFE CYCLE E WATCHERS ---

onMounted(() => {
  fetchFornecedores()
  const today = new Date();
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1);
  const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
  const year = prevMonth.getFullYear();
  mesReferenciaInput.value = `${year}-${month}`;
})

// NOVO WATCHER: Aciona a busca de dados existentes e a atualização de status
watch([fornecedorSelecionadoId, mesReferenciaInput], () => {
    fetchDadosExistentes(); // Tenta carregar dados sempre que Fornecedor ou Mês muda
    lancamentoError.value = null;
    if (activeTab.value === 'acompanhamento') {
        fetchStatusAcompanhamento();
    }
});
watch(activeTab, (newTab) => {
    if (newTab === 'acompanhamento') {
        fetchStatusAcompanhamento();
    }
})

</script>

<style scoped>
/* Os estilos permanecem os mesmos */
.metricas-view { max-width: 1200px; margin: 2rem auto; font-family: Arial, sans-serif; }
.page-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #c50d42; }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
.input-selecao { padding-bottom: 0.5rem; }
.form-group-inline { display: flex; gap: 2rem; }
.form-group-input { display: flex; flex-direction: column; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed #eee; }
.form-group { display: flex; flex-direction: column; margin-bottom: 1rem; }
.form-group label { font-weight: bold; margin-bottom: 0.25rem; color: #333; }
.form-group input:not([type="checkbox"]), .form-group select { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
.form-group small { font-size: 0.8rem; color: #666; margin-top: 0.25rem; }
.error-message { color: #d93025; font-weight: bold; margin-top: 0.5rem; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
.tabs { display: flex; margin-bottom: -1px; }
.tab-button { padding: 0.75rem 1.5rem; border: 1px solid #ddd; border-bottom: none; background-color: #f4f4f4; cursor: pointer; font-weight: bold; transition: background-color 0.2s, border-color 0.2s; border-top-left-radius: 8px; border-top-right-radius: 8px; }
.tab-button.active { background-color: #fff; border-color: #eee; border-bottom: 1px solid white; }
.tab-button:disabled { cursor: not-allowed; opacity: 0.6; }
.tab-content { border-top-left-radius: 0; }
.sub-tabs { display: flex; margin-bottom: 1rem; border-bottom: 1px solid #eee; }
.sub-tab-button { padding: 0.5rem 1rem; border: none; background: transparent; cursor: pointer; font-weight: normal; transition: all 0.2s; border-bottom: 2px solid #ddd; }
.sub-tab-button.active { font-weight: bold; color: #c50d42; border-bottom: 2px solid #c50d42; }
.fornecedor-info { font-size: 1.1em; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.btn-submit { background-color: #c50d42; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #a30b37; }
.btn-submit:disabled { background-color: #ccc; cursor: not-allowed; }
.status-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
.status-table th, .status-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
.status-table th { background-color: #f9f9f9; font-weight: bold; }
.status-badge { padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.9em; }
.status-badge.completo { background-color: #e6ffe6; color: #16a34a; }
.status-badge.pendente { background-color: #ffeaea; color: #dc2626; }
.btn-pequeno { background-color: #007bff; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
</style>