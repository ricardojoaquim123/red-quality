<template>
  <div class="historico-view">
    <header class="page-header">
      <button @click="router.back()" class="btn-voltar">← Voltar para o Dashboard de Score</button>
      <h1>Histórico de Desempenho: <span class="fornecedor-nome">{{ fornecedorNome }}</span></h1>
      <p>Análise detalhada do Score (Qualidade e Entrega) e o histórico de lançamentos mensais.</p>
    </header>

    <div v-if="loading" class="loading-state card">
      <p>Carregando histórico e detalhes do fornecedor...</p>
    </div>
    <div v-else-if="error" class="error-message card">
      <p>Erro ao carregar dados: {{ error }}</p>
      <p v-if="error.includes('400')">Sugestão: Verifique se a RLS permite a leitura das tabelas de monitoramento.</p>
    </div>
    <div v-else class="historico-grid">
        
        <div class="card card-anual">
            <h2>Scores Anuais (Histórico)</h2>
            <table class="historico-tabela">
                <thead>
                    <tr>
                        <th>Ano</th>
                        <th>Score Final</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="score in historicoAnual" :key="score.data_referencia">
                        <td>{{ score.data_referencia.substring(0, 4) }}</td>
                        <td :style="{ color: getScoreColor(score.score_final) }">
                            <strong>{{ score.score_final.toFixed(2) }}</strong>
                        </td>
                        <td>
                            <span :class="['status-tag', score.status_monitoramento.toLowerCase().replace(/ /g, '-')]">
                                {{ score.status_monitoramento }}
                            </span>
                        </td>
                    </tr>
                    <tr v-if="historicoAnual.length === 0">
                        <td colspan="3" class="empty-row">Nenhum score anual finalizado.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="card card-mensal">
            <h2>Lançamentos Mensais (Últimos 12 Meses)</h2>
            <table class="historico-tabela">
                <thead>
                    <tr>
                        <th>Mês</th>
                        <th>Total Entregas</th>
                        <th>Atrasos</th>
                        <th>NC Graves</th>
                        <th>NC Leves</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="mes in historicoMensal" :key="mes.mes_referencia">
                        <td>{{ formatarMes(mes.mes_referencia) }}</td>
                        <td>{{ mes.total_entregas || 0 }}</td>
                        <td><span :class="{ 'alerta-atraso': mes.entregas_atraso > 0 }">{{ mes.entregas_atraso || 0 }}</span></td>
                        <td><span :class="{ 'alerta-grave': mes.nao_conformidades_graves > 0 }">{{ mes.nao_conformidades_graves || 0 }}</span></td>
                        <td>{{ mes.notificacoes_nc || 0 }}</td>
                    </tr>
                    <tr v-if="historicoMensal.length === 0">
                        <td colspan="5" class="empty-row">Nenhum lançamento de métrica nos últimos 12 meses.</td>
                    </tr>
                </tbody>
            </table>
        </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const fornecedorId = route.params.id; // ID do fornecedor vem da URL

const fornecedorNome = ref('Carregando...');
const loading = ref(true);
const error = ref(null);
const historicoAnual = ref([]);
const historicoMensal = ref([]);

/**
 * Funções auxiliares
 */
function getScoreColor(score) {
    if (score === undefined || score === null) return '#888';
    if (score >= 90) return '#16a34a'; // Verde
    if (score >= 70) return '#fbbf24'; // Amarelo
    return '#dc2626'; // Vermelho
}

function formatarMes(data) {
    return new Date(data).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
}

/**
 * Função principal para buscar todos os dados de histórico do fornecedor.
 */
async function fetchHistorico() {
    loading.value = true;
    error.value = null;

    try {
        // 1. Busca o nome do fornecedor
        const { data: fornData, error: fornError } = await supabase
            .from('fornecedores')
            .select('nome')
            .eq('id', fornecedorId)
            .single();

        if (fornError) throw fornError;
        fornecedorNome.value = fornData.nome;

        // 2. Busca o Histórico de Scores Anuais (score_historico)
        const { data: scoreData, error: scoreError } = await supabase
            .from('fornecedor_score_historico')
            .select('*')
            .eq('fornecedor_id', fornecedorId)
            .eq('tipo_periodo', 'anual')
            .order('data_referencia', { ascending: false });

        if (scoreError) throw scoreError;
        historicoAnual.value = scoreData;

        // 3. Preparação: Calcular data de início (12 meses atrás)
        const umAnoAtras = new Date();
        umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
        const dataInicial = umAnoAtras.toISOString().split('T')[0];
        
        // 4. CORREÇÃO: Buscar monitoramento de Qualidade (possui os campos de NC)
        const { data: qualidadeData, error: qualError } = await supabase
            .from('monitoramento_qualidade')
            .select('mes_referencia, total_ncs, nao_conformidades_graves, notificacoes_nc')
            .eq('fornecedor_id', fornecedorId)
            .gte('mes_referencia', dataInicial)
            .order('mes_referencia', { ascending: false });

        if (qualError) throw qualError;

        // 5. CORREÇÃO: Buscar monitoramento de Compras separadamente
        const { data: comprasData, error: compError } = await supabase
            .from('monitoramento_compras')
            .select('mes_referencia, total_entregas, entregas_atraso')
            .eq('fornecedor_id', fornecedorId)
            .gte('mes_referencia', dataInicial)
            .order('mes_referencia', { ascending: false });

        if (compError) throw compError;
        
        // 6. Juntar os dados no Frontend (garantindo que todas as chaves são strings de data para o Map)
        const comprasMap = new Map(comprasData.map(item => [item.mes_referencia, item]));

        historicoMensal.value = qualidadeData.map(qualidade => {
            const mesKey = qualidade.mes_referencia;
            const compras = comprasMap.get(mesKey) || {}; // Pega os dados de compras, se existirem
            
            return {
                mes_referencia: mesKey,
                // Dados de Qualidade
                total_ncs: qualidade.total_ncs,
                nao_conformidades_graves: qualidade.nao_conformidades_graves,
                notificacoes_nc: qualidade.notificacoes_nc,
                // Dados de Compras
                total_entregas: compras.total_entregas,
                entregas_atraso: compras.entregas_atraso,
            };
        });


    } catch (err) {
        console.error('Erro fatal ao carregar histórico:', err)
        error.value = err.message
        fornecedorNome.value = 'ERRO'
    } finally {
        loading.value = false
    }
}


onMounted(() => {
  if (fornecedorId) {
    fetchHistorico()
  } else {
    error.value = "ID do fornecedor não encontrado na URL."
    loading.value = false
  }
})
</script>

<style scoped>
/* Estilos (Mesmos da última vez) */
.historico-view { max-width: 1400px; margin: 0 auto; font-family: Arial, sans-serif; }
.page-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #c50d42; }
.fornecedor-nome { color: #007bff; font-weight: 700; }
.btn-voltar { background: #f4f4f4; color: #333; padding: 8px 15px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-bottom: 15px; }
.card { background-color: #fff; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
.historico-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
@media (max-width: 900px) { .historico-grid { grid-template-columns: 1fr; } }
.historico-tabela { width: 100%; border-collapse: collapse; margin-top: 15px; }
.historico-tabela th, .historico-tabela td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
.historico-tabela th { background-color: #f9f9f9; }
.status-tag { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 700; text-transform: uppercase; }
.aprovado-com-restricoes { background-color: #fff3cd; color: #856404; }
.aprovado { background-color: #d4edda; color: #155724; }
.em-avaliacao { background-color: #cce5ff; color: #004085; }
.reprovado, .inativo { background-color: #f8d7da; color: #721c24; }
.alerta-atraso { color: #dc3545; font-weight: bold; }
.alerta-grave { color: #856404; font-weight: bold; }
.empty-row { text-align: center; color: #888; font-style: italic; }
.loading-state, .error-message { text-align: center; padding: 1rem 0; color: #888; }
.error-message { color: #dc3545; }
</style>