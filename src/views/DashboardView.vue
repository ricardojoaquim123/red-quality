<template>
  <div class="dashboard-view">
    <header class="page-header">
      <h1>👋 Bem-vindo(a), {{ authStore.userName }}!</h1>
      <p>Visão geral de controle de qualidade e homologação de fornecedores do **Red-Quality**.</p>
    </header>

    <div class="dashboard-grid">
      
      <div class="card card-status">
        <h2>Desempenho Geral (Último Período)</h2>
        <p v-if="loadingMetrics" class="loading-state">Carregando métricas...</p>
        <p v-else-if="errorMetrics" class="error-message">{{ errorMetrics }}</p>
        <div v-else class="status-summary">
          <div class="metric-box">
            <span class="metric-label">Fornecedores em Monitoramento</span>
            <span class="metric-value">{{ metrics.totalFornecedores }}</span>
          </div>
          <div class="metric-box">
            <span class="metric-label">Média Global de Score</span>
            <span class="metric-value" :style="{ color: getScoreColor(metrics.scoreMedio) }">
              {{ metrics.scoreMedio ? metrics.scoreMedio.toFixed(2) : 'N/A' }}
            </span>
          </div>
        </div>
      </div>

      <div class="card card-risco">
        <h2>Status de Homologação (RLS)</h2>
        <p v-if="loadingMetrics" class="loading-state">Carregando...</p>
        <div v-else class="status-list">
          <div v-for="(count, status) in metrics.statusCounts" :key="status" class="status-item">
            <span :class="['status-tag', status.toLowerCase().replace(/ /g, '-').replace('á', 'a').replace('ç', 'c')]">
              {{ status }}
            </span>
            <span class="status-count">{{ count }}</span>
          </div>
        </div>
      </div>

      <div class="card card-pendencias">
        <h2>Lançamentos Pendentes ({{ nomeMesAnterior }})</h2>
        <p v-if="loadingPendencias" class="loading-state">Checando pendências...</p>
        <p v-else-if="pendenciasError" class="error-message">{{ pendenciasError }}</p>
        <div v-else>
          <p class="pendencia-total">
            Total de Fornecedores com Pendência: 
            <strong>{{ pendencias.totalPendentes }}</strong>
          </p>
          <ul class="pendencia-detail">
            <li>Pendentes Compras: <strong>{{ pendencias.pendentesCompras }}</strong></li>
            <li>Pendentes Qualidade: <strong>{{ pendencias.pendentesQualidade }}</strong></li>
          </ul>
          <RouterLink to="/metricas" class="btn-acesso">
            Acessar Cronograma Completo
          </RouterLink>
        </div>
      </div>
      
      <div class="card card-vencidos">
        <h2>⚠️ Documentos Vencidos ({{ documentosVencidos.length }})</h2>
        <p v-if="loadingVencidos" class="loading-state">Carregando documentos...</p>
        <p v-else-if="vencidosError" class="error-message">{{ vencidosError }}</p>
        <div v-else>
            <ul class="documentos-vencidos-list">
                <li v-for="doc in documentosVencidos.slice(0, 5)" :key="doc.documento_id" class="doc-item">
                    <RouterLink :to="`/fornecedores/${doc.fornecedor_id}/documentos`">
                        <strong>{{ doc.fornecedor_nome }}</strong> - {{ doc.tipo_documento_nome }}
                        <span class="doc-data">Vencido em: {{ formatarDataCurta(doc.validade) }}</span>
                    </RouterLink>
                </li>
                <li v-if="documentosVencidos.length === 0" class="doc-item-vazio">
                    Nenhum documento crítico vencido.
                </li>
                <li v-else-if="documentosVencidos.length > 5" class="doc-item-vazio">
                    ...e mais {{ documentosVencidos.length - 5 }} documentos pendentes.
                </li>
            </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/supabase'
import { useAuthStore } from '@/stores/authStore'
import { RouterLink } from 'vue-router'

const authStore = useAuthStore()

const loadingMetrics = ref(true)
const errorMetrics = ref(null)
const metrics = ref({
  totalFornecedores: 0,
  scoreMedio: null,
  statusCounts: {}
})

const loadingPendencias = ref(true)
const pendenciasError = ref(null)
const pendencias = ref({
    totalPendentes: 0,
    pendentesCompras: 0,
    pendentesQualidade: 0
})

const loadingVencidos = ref(true);
const vencidosError = ref(null);
const documentosVencidos = ref([]);


const nomeMesAnterior = computed(() => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1);
    return prevMonth.toLocaleString('pt-BR', { month: 'long' });
});

/**
 * Funções auxiliares
 */
function getScoreColor(score) {
    if (score === undefined || score === null) return '#888';
    if (score >= 90) return '#16a34a'; // Verde
    if (score >= 70) return '#fbbf24'; // Amarelo
    return '#dc2626'; // Vermelho
}

function formatarDataCurta(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * 1. Busca Métricas Gerais (Score Médio e Contagem de Status)
 */
async function fetchMetrics() {
    loadingMetrics.value = true;
    errorMetrics.value = null;
    try {
        const { data: fornecedoresData, error: fornError } = await supabase
            .from('fornecedores')
            .select('id, status_homologacao')
            
        if (fornError) throw fornError;

        metrics.value.totalFornecedores = fornecedoresData.length;
        
        const statusCounts = fornecedoresData.reduce((acc, curr) => {
            const status = curr.status_homologacao || 'N/A';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        metrics.value.statusCounts = statusCounts;

        const { data: scoreData, error: scoreError } = await supabase
            .from('fornecedor_score_historico')
            .select('score_final')
            .eq('tipo_periodo', 'anual');

        if (scoreError) throw scoreError;

        if (scoreData.length > 0) {
            const totalScore = scoreData.reduce((sum, item) => sum + item.score_final, 0);
            metrics.value.scoreMedio = totalScore / scoreData.length;
        } else {
            metrics.value.scoreMedio = null;
        }

    } catch (error) {
        console.error('Erro ao carregar métricas:', error);
        errorMetrics.value = `Falha ao carregar métricas: ${error.message}`;
    } finally {
        loadingMetrics.value = false;
    }
}

/**
 * 2. Checa as Pendências do Mês Anterior (Lançamentos)
 */
async function fetchPendencias() {
    loadingPendencias.value = true;
    pendenciasError.value = null;

    try {
        const today = new Date();
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const refDate = prevMonthDate.toISOString().split('T')[0];
        
        const { data: fornecedoresIds, error: fornIdsError } = await supabase
            .from('fornecedores')
            .select('id');
        if (fornIdsError) throw fornIdsError;
        
        const fornecedoresTotal = fornecedoresIds.map(f => f.id);

        const { data: comprasData } = await supabase
            .from('monitoramento_compras')
            .select('fornecedor_id')
            .eq('mes_referencia', refDate);
        const comprasFeitas = new Set(comprasData.map(d => d.fornecedor_id));

        const { data: qualidadeData } = await supabase
            .from('monitoramento_qualidade')
            .select('fornecedor_id')
            .eq('mes_referencia', refDate);
        const qualidadeFeitas = new Set(qualidadeData.map(d => d.fornecedor_id));

        let pendentesCompras = 0;
        let pendentesQualidade = 0;

        const fornecedoresComPendencia = fornecedoresTotal.filter(id => {
            const pendenteCompras = !comprasFeitas.has(id);
            const pendenteQualidade = !qualidadeFeitas.has(id);
            
            if (pendenteCompras) pendentesCompras++;
            if (pendenteQualidade) pendentesQualidade++;
            
            return pendenteCompras || pendenteQualidade;
        });
        
        pendencias.value.pendentesCompras = pendentesCompras;
        pendencias.value.pendentesQualidade = pendentesQualidade;
        pendencias.value.totalPendentes = fornecedoresComPendencia.length;

    } catch (error) {
        console.error('Erro ao buscar pendências:', error);
        pendenciasError.value = `Falha ao checar pendências: ${error.message}`;
    } finally {
        loadingPendencias.value = false;
    }
}

/**
 * 3. Busca Documentos Vencidos (Solução RPC)
 */
async function fetchDocumentosVencidos() {
    loadingVencidos.value = true;
    vencidosError.value = null;
    try {
        // 💥 CHAMA A FUNÇÃO SQL (RPC) PARA FAZER O JOIN COMPLEXO NO BANCO DE DADOS
        const { data, error } = await supabase.rpc('get_documentos_vencidos');

        if (error) {
             console.error('Erro RPC ao buscar documentos vencidos:', error);
             // Se o erro for PGRST202 (função não encontrada), ele deve ser pego aqui.
             throw error;
        }
        
        // Os dados vêm no formato da função SQL (fornecedor_nome, tipo_documento_nome)
        documentosVencidos.value = data; 

    } catch (error) {
        // TRATAMENTO FINAL: A consulta falhou no RPC
        console.error('Erro ao buscar documentos vencidos:', error);
        vencidosError.value = `Falha ao carregar documentos: Erro no Servidor (RPC/Função SQL). Por favor, rode a função SQL do Passo 38 novamente.`;
    } finally {
        loadingVencidos.value = false;
    }
}


onMounted(() => {
  fetchMetrics();
  fetchPendencias();
  fetchDocumentosVencidos();
})
</script>

<style scoped>
/* Estilos (Mesmos da última vez) */
.dashboard-view { max-width: 1400px; margin: 0 auto; font-family: Arial, sans-serif; }
.page-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #c50d42; }
.dashboard-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
@media (max-width: 1400px) { .dashboard-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.card h2 { font-size: 1.2em; color: #333; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; margin-top: 0; margin-bottom: 15px; }
.status-summary { display: flex; justify-content: space-around; gap: 15px; }
.metric-box { text-align: center; padding: 10px; background-color: #f7f7f7; border-radius: 6px; flex: 1; }
.metric-label { display: block; font-size: 0.85em; color: #666; margin-bottom: 5px; }
.metric-value { display: block; font-size: 1.8em; font-weight: 900; color: #333; }
.status-list { display: flex; flex-direction: column; gap: 8px; }
.status-item { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dotted #eee; padding-bottom: 5px; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 700; text-transform: uppercase; }
.aprovado-com-restricoes { background-color: #fff3cd; color: #856404; }
.aprovado { background-color: #d4edda; color: #155724; }
.em-avaliacao { background-color: #cce5ff; color: #004085; }
.reprovado, .inativo { background-color: #f8d7da; color: #721c24; }
.status-count { font-weight: bold; font-size: 1.2em; }
.pendencia-total { font-size: 1.1em; font-weight: 600; margin-bottom: 10px; }
.pendencia-detail { list-style: none; padding: 0; margin-bottom: 15px; }
.pendencia-detail li { padding: 5px 0; font-size: 0.95em; border-left: 3px solid #f99; padding-left: 10px; margin-bottom: 5px; }
.btn-acesso { display: block; width: 100%; text-align: center; background-color: #007bff; padding: 10px; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: background-color 0.2s; }
.btn-acesso:hover { background-color: #0056b3; }
.card-vencidos { grid-column: span 2; }
.card-vencidos h2 { color: #dc3545; }
.documentos-vencidos-list { list-style: none; padding: 0; margin: 0; }
.doc-item { padding: 8px 0; border-bottom: 1px dotted #ffc107; font-size: 0.95em; }
.doc-item a { text-decoration: none; color: #333; display: block; }
.doc-item a:hover { color: #c50d42; text-decoration: underline; }
.doc-data { display: block; color: #dc3545; font-size: 0.8em; font-weight: 600; }
.doc-item-vazio { padding: 10px 0; color: #888; font-style: italic; text-align: center; }
.loading-state, .error-message { text-align: center; padding: 1rem 0; color: #888; }
.error-message { color: #dc3545; }
</style>