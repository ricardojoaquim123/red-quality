<template>
  <div class="historico-view">
    
    <header class="sub-page-header">
      <button @click="router.back()" class="btn-voltar">
        <span class="icon">&larr;</span> Voltar para o Dashboard de Score
      </button>
      <div class="header-title-container">
        <h1>Histórico de Desempenho: <span class="fornecedor-nome">{{ fornecedorNome }}</span></h1>
        <p>Análise detalhada do Score e histórico de lançamentos mensais.</p>
      </div>
    </header>

    <div v-if="loading" class="loading-state card">
      <p>Carregando histórico e detalhes do fornecedor...</p>
    </div>
    <div v-else-if="error" class="error-message card">
      <p>Erro ao carregar dados: {{ error }}</p>
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
// O SCRIPT SETUP INTEIRO PERMANECE IDÊNTICO AO ANTERIOR
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const fornecedorId = route.params.id; 

const fornecedorNome = ref('Carregando...');
const loading = ref(true);
const error = ref(null);
const historicoAnual = ref([]);
const historicoMensal = ref([]);

function getScoreColor(score) {
    if (score === undefined || score === null) return '#888';
    if (score >= 90) return '#16a34a'; // Verde
    if (score >= 70) return '#fbbf24'; // Amarelo
    return '#dc2626'; // Vermelho
}

function formatarMes(data) {
    const [ano, mes, dia] = data.split('-');
    const dataAjustada = new Date(ano, mes - 1, Number(dia) + 1);
    return dataAjustada.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
}

async function fetchHistorico() {
    loading.value = true;
    error.value = null;

    try {
        const { data: fornData, error: fornError } = await supabase
            .from('fornecedores')
            .select('nome')
            .eq('id', fornecedorId)
            .single();

        if (fornError) throw fornError;
        fornecedorNome.value = fornData.nome;

        const { data: scoreData, error: scoreError } = await supabase
            .from('fornecedor_score_historico')
            .select('*')
            .eq('fornecedor_id', fornecedorId)
            .eq('tipo_periodo', 'anual')
            .order('data_referencia', { ascending: false });

        if (scoreError) throw scoreError;
        historicoAnual.value = scoreData;

        const umAnoAtras = new Date();
        umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
        const dataInicial = umAnoAtras.toISOString().split('T')[0];
        
        const { data: qualidadeData, error: qualError } = await supabase
            .from('monitoramento_qualidade')
            .select('mes_referencia, total_ncs, nao_conformidades_graves, notificacoes_nc')
            .eq('fornecedor_id', fornecedorId)
            .gte('mes_referencia', dataInicial);

        if (qualError) throw qualError;

        const { data: comprasData, error: compError } = await supabase
            .from('monitoramento_compras')
            .select('mes_referencia, total_entregas, entregas_atraso')
            .eq('fornecedor_id', fornecedorId)
            .gte('mes_referencia', dataInicial);

        if (compError) throw compError;
        
        const comprasMap = new Map(comprasData.map(item => [item.mes_referencia, item]));
        const qualidadeMap = new Map(qualidadeData.map(item => [item.mes_referencia, item]));

        const allMeses = new Set([
            ...comprasData.map(c => c.mes_referencia),
            ...qualidadeData.map(q => q.mes_referencia)
        ]);

        const combinedData = Array.from(allMeses).map(mesKey => {
            const compras = comprasMap.get(mesKey) || {}; 
            const qualidade = qualidadeMap.get(mesKey) || {}; 
            
            return {
                mes_referencia: mesKey,
                total_ncs: qualidade.total_ncs,
                nao_conformidades_graves: qualidade.nao_conformidades_graves,
                notificacoes_nc: qualidade.notificacoes_nc,
                total_entregas: compras.total_entregas,
                entregas_atraso: compras.entregas_atraso,
            };
        });
        
        historicoMensal.value = combinedData.sort((a, b) => new Date(b.mes_referencia) - new Date(a.mes_referencia));

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
/* ESTILOS DE LAYOUT ATUALIZADOS */
.historico-view { max-width: 1400px; margin: 2rem auto; font-family: Arial, sans-serif; }

/* NOVO Estilo de Cabeçalho de Sub-Página */
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
.btn-voltar .icon {
  font-weight: bold;
}
.header-title-container {
  margin-top: 0.5rem;
}
.header-title-container h1 {
  margin: 0;
  color: #c50d42; /* Cor primária */
}
.header-title-container p {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  color: #555;
}
.fornecedor-nome { color: #007bff; }
/* Fim dos novos estilos de cabeçalho */

/* Estilos de Card e Tabela (sem mudança) */
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