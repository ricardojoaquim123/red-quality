<template>
  <div class="score-view">
    <header class="page-header">
      <h1>⭐ Score de Desempenho de Fornecedores</h1>
      <p>Visualização do desempenho mais recente e do histórico de avaliação.</p>
    </header>

    <div class="score-dashboard card">
      <div class="score-header">
        <h2>Status Atual (Última Avaliação Anual)</h2>
        
        <div class="header-actions">
          <button @click="exportToCSV" :disabled="scoreList.length === 0" class="btn-detalhes btn-exportar">
            Exportar CSV
          </button>
          
          <button @click="modalRegrasAberto = true" class="btn-detalhes btn-regras">
            Regras de Auditoria
          </button>

          <button 
            v-if="authStore.isAdmin"
            @click="handleRecalcularScore" 
            :disabled="loadingRecalculo" 
            class="btn-recalcular"
          >
            {{ loadingRecalculo ? 'Calculando...' : 'Recalcular Score Anual (Todos)' }}
          </button>
        </div>
      </div>
      
      <p v-if="loadingScores" class="loading-state">Carregando scores e fornecedores...</p>
      <p v-else-if="error" class="error-message">Erro ao carregar o dashboard: {{ error }}</p>
      <p v-else-if="scoreList.length === 0" class="empty-state">Nenhum fornecedor ou score encontrado.</p>

      <table v-else class="score-table">
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Score Final</th>
            <th>Qualidade</th>
            <th>Entrega</th>
            <th>Status</th>
            <th>Última Avaliação</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in scoreList" :key="item.id">
            <td class="fornecedor-nome">{{ item.nome }}</td>
            <td class="score-final" :style="{ color: getScoreColor(item.score_final) }">
              {{ item.score_final ? item.score_final.toFixed(2) : 'N/A' }}
            </td>
            <td>{{ item.score_qualidade ? item.score_qualidade.toFixed(2) : 'N/A' }}</td>
            <td>{{ item.score_entrega ? item.score_entrega.toFixed(2) : 'N/A' }}</td>
            <td>
              <span 
                :class="['status-tag', (item.status_monitoramento || 'Em Avaliacao').toLowerCase().replace(/ /g, '-')]">
                {{ item.status_monitoramento || 'Em Avaliação' }}
              </span>
            </td>
            <td>{{ item.data_referencia ? formatarData(item.data_referencia) : 'Sem Dados' }}</td>
            <td>
              <button @click="viewHistorico(item.id)" class="btn-detalhes">
                Ver Histórico
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div v-if="modalRegrasAberto" class="modal-overlay" @click.self="modalRegrasAberto = false">
        <div class="modal-content">
            <h3>📝 Sistemática de Cálculo de Score (Auditoria)</h3>
            <p class="modal-intro">O score é calculado com base nos dados lançados nos **12 meses anteriores** à data de referência e usa a seguinte ponderação:</p>

            <div class="regras-section">
                <h4>1. Score de Entrega (Peso 50%)</h4>
                <p>Mede a pontualidade. Um Score 100 significa 0% de atraso.</p>
                <div class="formula">
                    SCORE ENTREGA = <span class="formula-text">100 * (1 - (Entregas_Atraso / Total_Entregas))</span>
                </div>
                <p class="nota-regra">**Nota:** Se o Total de Entregas for zero no período, o Score de Entrega é considerado 100.</p>
            </div>

            <div class="regras-section">
                <h4>2. Score de Qualidade (Peso 50%)</h4>
                <p>Mede a conformidade e severidade das ocorrências.</p>
                <div class="formula">
                    SCORE QUALIDADE = <span class="formula-text">100 - (NC_Leve * 5) - (NC_Grave * 15)</span>
                </div>
                <ul class="lista-penalidades">
                    <li>**Penalidade Leve (Notificação de NC):** Subtrai **5.0** pontos por ocorrência.</li>
                    <li>**Penalidade Grave (Não Conformidade):** Subtrai **15.0** pontos por ocorrência.</li>
                </ul>
                <p class="nota-regra">**Nota:** O Score de Qualidade não pode ser inferior a 0 (zero).</p>
            </div>
            
            <div class="regras-section">
                <h4>3. Score Final e Status</h4>
                <div class="formula">
                    SCORE FINAL = <span class="formula-text">(Score Qualidade + Score Entrega) / 2</span>
                </div>
                <ul class="lista-status">
                    <li>**APROVADO:** Score Final ≥ 90.0</li>
                    <li>**APROVADO COM RESTRIÇÕES:** Score Final ≥ 70.0 e < 90.0</li>
                    <li>**REPROVADO:** Score Final < 70.0</li>
                </ul>
            </div>
            
            <div class="modal-actions">
                <button @click="modalRegrasAberto = false" class="btn-detalhes btn-fechar">Fechar</button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore' 

const router = useRouter()
const authStore = useAuthStore()
const scoreList = ref([])
const loadingScores = ref(true)
const loadingRecalculo = ref(false)
const error = ref(null)
const modalRegrasAberto = ref(false) 

/**
 * CORREÇÃO: fetchScores agora usa a RPC para performance (1 consulta em vez de N+1)
 */
async function fetchScores() {
  loadingScores.value = true
  error.value = null
  try {
    // 1. CHAMA A NOVA FUNÇÃO RPC
    const { data, error: rpcError } = await supabase.rpc('get_latest_annual_scores_all_suppliers');
    
    if (rpcError) throw rpcError;

    // 2. Os dados já vêm prontos do banco
    scoreList.value = data;

  } catch (err) {
    console.error('Erro geral ao carregar scores:', err)
    error.value = `Falha ao carregar scores: ${err.message}. (Verifique se a função RPC 'get_latest_annual_scores_all_suppliers' foi criada.)`;
  } finally {
    loadingScores.value = false
  }
}

async function handleRecalcularScore() {
  if (!confirm("Confirmar: Isso irá calcular o Score Anual para TODOS os fornecedores e atualizar o Painel. Continuar?")) { return; }
  loadingRecalculo.value = true;
  error.value = null;
  try {
    const today = new Date();
    const dataReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Pega a lista de IDs de fornecedores da lista já carregada
    const fornecedorIds = scoreList.value.map(f => f.id);

    for (const fornecedorId of fornecedorIds) {
      const { data, error: rpcError } = await supabase.rpc('calcular_e_salvar_score', {
        p_fornecedor_id: fornecedorId,
        p_tipo_periodo: 'anual',
        p_data_referencia: dataReferencia
      });
      if (rpcError) { console.error(`Erro ao calcular score para ID ${fornecedorId}:`, rpcError); }
    }
    alert("Recálculo concluído. Atualizando painel...");
    await fetchScores(); // Recarrega os dados com a RPC
  } catch (err) {
    error.value = "Erro fatal durante o processo de recálculo: " + err.message;
  } finally {
    loadingRecalculo.value = false;
  }
}

/**
 * Função para Exportar a Tabela de Score para CSV
 * (Permanece a mesma, mas agora usa os dados da RPC)
 */
function exportToCSV() {
  if (scoreList.value.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  const headers = [
    "ID", "Fornecedor", "Score Final", "Score Qualidade", "Score Entrega", 
    "Status Monitoramento", "Data Avaliacao"
  ];

  const csvData = scoreList.value.map(item => [
    `"${item.id}"`, 
    `"${item.nome}"`,
    (item.score_final || 0).toFixed(2).replace('.', ','), 
    (item.score_qualidade || 0).toFixed(2).replace('.', ','),
    (item.score_entrega || 0).toFixed(2).replace('.', ','),
    `"${item.status_monitoramento || 'Em Avaliação'}"`,
    `"${item.data_referencia ? formatarData(item.data_referencia) : 'N/A'}"`
  ].join(';')); 

  const csvContent = [
    headers.join(';'),
    ...csvData
  ].join('\n');

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Red-Quality_Score_Fornecedores_${new Date().toISOString().substring(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// --- Funções Auxiliares (Visuais) ---

function formatarData(data) {
  // Adiciona verificação, pois data_referencia pode ser nula
  if (!data) return 'N/A';
  return new Date(data).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
}

function getScoreColor(score) {
    if (score === undefined || score === null) return '#888';
    if (score >= 90) return '#16a34a'; // Verde
    if (score >= 70) return '#fbbf24'; // Amarelo
    return '#dc2626'; // Vermelho
}

function viewHistorico(fornecedorId) {
    router.push({ name: 'score-historico', params: { id: fornecedorId } });
}


onMounted(() => {
  fetchScores()
})
</script>

<style scoped>
/* Os estilos permanecem os mesmos */
.score-view { max-width: 1400px; margin: 2rem auto; font-family: Arial, sans-serif; }
.page-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #c50d42; }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.header-actions { display: flex; gap: 10px; }
.btn-recalcular { background-color: #007bff; color: white; padding: 8px 15px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
.btn-recalcular:hover:not(:disabled) { background-color: #0056b3; }
.btn-recalcular:disabled { background-color: #ccc; cursor: not-allowed; }
.btn-detalhes { background-color: #c50d42; color: white; padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.9em; cursor: pointer; }
.btn-regras { background-color: #6c757d; }
.btn-regras:hover { background-color: #5a6268; }
.btn-exportar { background-color: #1a73e8; }
.btn-exportar:hover { background-color: #1764cc; }
.score-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-top: 1rem; }
.score-table th, .score-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
.score-table th { background-color: #f9f9f9; font-weight: bold; }
.score-table tbody tr { background-color: #fff; transition: background-color 0.2s; }
.score-table tbody tr:hover { background-color: #f5f5f5; }
.fornecedor-nome { font-weight: 600; }
.score-final { font-weight: 900; font-size: 1.2em; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 700; text-transform: uppercase; }
.aprovado-com-restricoes { background-color: #fff3cd; color: #856404; }
.aprovado { background-color: #d4edda; color: #155724; }
.em-avaliacao { background-color: #cce5ff; color: #004085; }
.reprovado, .inativo { background-color: #f8d7da; color: #721c24; }
.btn-detalhes:hover { background-color: #a30b37; }
.loading-state, .empty-state { text-align: center; padding: 2rem 0; color: #888; }
.error-message { color: #d93025; font-weight: bold; padding: 1rem 0; }
/* Estilos do MODAL (Mesmos da última vez) */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 30px; border-radius: 10px; width: 90%; max-width: 600px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); max-height: 90vh; overflow-y: auto; }
.modal-content h3 { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 0; color: #c50d42; }
.modal-intro { font-weight: 500; margin-bottom: 15px; }
.regras-section { background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #007bff; }
.regras-section h4 { margin-top: 0; color: #004085; }
.formula { background-color: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
.formula-text { font-weight: bold; color: #dc3545; }
.lista-penalidades, .lista-status { padding-left: 20px; margin-top: 10px; }
.nota-regra { font-size: 0.9em; color: #6c757d; font-style: italic; }
.btn-fechar { background-color: #6c757d; }
.btn-fechar:hover { background-color: #5a6268; }
.modal-actions { text-align: right; margin-top: 20px; }
</style>