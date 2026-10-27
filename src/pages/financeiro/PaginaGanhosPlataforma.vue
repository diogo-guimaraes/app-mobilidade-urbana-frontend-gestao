<template>
  <q-page class="q-pa-md pagina-plataforma">
    <div class="cabecalho-plataforma row items-center q-mb-md">
      <q-avatar color="blue-1" text-color="primary" icon="account_balance" class="q-mr-md" />
      <div class="col cabecalho-titulo">
        <h1 class="text-h5 text-weight-medium q-ma-none">Ganhos da plataforma</h1>
        <div class="text-caption text-grey-7">
          Acompanhe o resultado das operações, os recebimentos e os custos.
        </div>
      </div>
      <RegistrarCustoPlataforma @registrado="atualizar(false)" />
    </div>
    <div class="paineis-plataforma">
      <q-card
        v-show="!$q.screen.lt.md || !selecionado"
        flat
        bordered
        class="painel-master column no-wrap"
        aria-label="Resumo e operações da plataforma"
      >
        <q-card-section>
          <div class="row justify-between items-center q-mb-sm">
            <span class="text-subtitle1 text-weight-medium">Resumo executivo</span>
            <q-btn
              flat
              round
              dense
              icon="refresh"
              aria-label="Atualizar ganhos da plataforma"
              :loading="carregando"
              @click="atualizar()"
            />
          </div>
          <q-btn-toggle
            v-model="periodo"
            :options="periodos"
            no-caps
            spread
            unelevated
            color="grey-2"
            text-color="grey-8"
            toggle-color="primary"
            class="full-width"
          />
          <div
            v-if="periodo !== 'personalizado'"
            class="row no-wrap items-center q-gutter-xs q-mt-md"
          >
            <q-btn
              flat
              round
              dense
              icon="chevron_left"
              aria-label="Período anterior"
              @click="navegar(-1)"
            />
            <q-input
              v-model="data"
              type="date"
              label="Data de referência"
              stack-label
              outlined
              dense
              class="col"
            />
            <q-btn
              flat
              round
              dense
              icon="chevron_right"
              aria-label="Próximo período"
              @click="navegar(1)"
            />
          </div>
          <div v-else class="row q-col-gutter-sm q-mt-sm">
            <q-input
              v-model="inicio"
              type="date"
              label="De"
              stack-label
              outlined
              dense
              class="col-6"
            />
            <q-input
              v-model="fim"
              type="date"
              label="Até"
              :min="inicio"
              stack-label
              outlined
              dense
              class="col-6"
            />
          </div>
          <div class="row q-col-gutter-sm q-mt-sm">
            <q-select
              v-model="servico"
              :options="servicos"
              emit-value
              map-options
              outlined
              dense
              label="Serviço"
              class="col-6"
            />
            <q-select
              v-model="status"
              :options="statusOpcoes"
              emit-value
              map-options
              outlined
              dense
              label="Apuração"
              class="col-6"
            />
          </div>
          <q-select
            v-model="resultado"
            :options="resultadosPlataforma"
            emit-value
            map-options
            outlined
            dense
            label="Resultado"
            class="q-mt-md"
          />
          <q-toggle v-model="demonstracao" dense label="Mostrar demonstração" class="q-mt-md" />
          <div v-if="resposta" class="text-caption text-grey-7 text-center q-mt-sm">
            {{ dia(resposta.periodo.inicio) }} a {{ dia(resposta.periodo.fim) }}
          </div>
        </q-card-section>
        <q-separator />
        <div class="master-scroll col">
          <q-banner v-if="erro" class="bg-red-1 text-negative q-ma-md" role="alert"
            >{{ erro
            }}<template #action
              ><q-btn flat label="Tentar novamente" @click="atualizar()" /></template
          ></q-banner>
          <div v-if="carregando" class="q-pa-xl text-center">
            <q-spinner color="primary" size="32px" />
            <p>Consultando operações…</p>
          </div>
          <template v-else-if="resposta">
            <q-card-section class="q-pt-md">
              <q-banner
                v-if="demonstracao"
                rounded
                class="bg-amber-1 text-brown-9 q-mb-md"
                role="status"
                >Demonstração incluída: os valores fictícios não representam movimentações bancárias
                reais.</q-banner
              >
              <q-card flat bordered class="q-mb-sm"
                ><q-card-section>
                  <div class="text-caption text-grey-7">
                    {{ tituloResultadoPlataforma(resultado) }}
                  </div>
                  <div
                    class="text-h4 text-weight-bold q-my-sm"
                    :class="
                      Number(resposta.resumo.lucro_realizado) < 0
                        ? 'text-negative'
                        : 'text-positive'
                    "
                    aria-label="Lucro realizado"
                  >
                    {{ moedaSaldo(resposta.resumo.lucro_realizado) }}
                  </div>
                  <div class="text-caption text-grey-7">
                    Recebimentos e despesas conciliados no período, com todos os custos conferidos.
                  </div>
                </q-card-section></q-card
              >
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <q-card flat bordered class="full-height"
                    ><q-card-section
                      ><div class="text-caption text-grey-7">Comissões a receber · dinheiro</div>
                      <strong class="text-subtitle1">{{
                        moedaSaldo(resposta.resumo.comissoes_a_receber)
                      }}</strong></q-card-section
                    ></q-card
                  >
                </div>
                <div class="col-6">
                  <q-card flat bordered class="full-height"
                    ><q-card-section
                      ><div class="text-caption text-grey-7">Take rate efetivo</div>
                      <strong class="text-subtitle1">{{
                        resposta.resumo.take_rate === null
                          ? '—'
                          : resposta.resumo.take_rate.replace('.', ',') + '%'
                      }}</strong>
                      <div class="text-caption text-grey-7">
                        Resultado consolidado / GMV das mesmas operações
                      </div></q-card-section
                    ></q-card
                  >
                </div>
              </div>
              <div class="text-caption text-grey-7 q-mt-md">
                Online aguardando recebimento:
                <strong>{{ moedaSaldo(resposta.resumo.online_aguardando_liquidacao) }}</strong>
              </div>
              <div class="text-caption text-grey-7">
                {{ resposta.resumo.custos_pendentes }} operação(ões) com custos pendentes.
                Estimativa recebida: {{ moedaSaldo(resposta.resumo.lucro_estimado_recebido) }}.
              </div>
              <GraficoLucrosPlataforma
                v-if="$q.screen.lt.md"
                class="q-mt-lg"
                :dados="resposta.grafico"
                :total="resposta.resumo.lucro_realizado"
                :intervalo="resposta.periodo"
                :diario="resposta.grafico_granularidade === 'hora'"
                :demonstracao="demonstracao"
                :resultado="resultado"
              />
            </q-card-section>
            <q-separator />
            <div class="q-pa-md text-subtitle2">
              Operações · {{ resposta.meta.total }} registro(s)
            </div>
            <q-list v-if="resposta.data.length" separator aria-label="Operações financeiras">
              <q-item
                v-for="item in resposta.data"
                :key="item.id"
                clickable
                :active="selecionado === item.id"
                active-class="operacao-ativa"
                :aria-label="item.descricao"
                @click="selecionar(item.id)"
              >
                <q-item-section avatar
                  ><q-avatar
                    :color="Number(item.lucro_liquido) < 0 ? 'red-1' : 'blue-1'"
                    :text-color="Number(item.lucro_liquido) < 0 ? 'negative' : 'primary'"
                    :icon="iconePlataforma(item.tipo_operacao)"
                    size="36px"
                /></q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{
                    item.corrida?.codigo_corrida || item.descricao
                  }}</q-item-label>
                  <q-item-label v-if="item.demonstracao && item.corrida" caption>{{
                    item.descricao
                  }}</q-item-label>
                  <q-item-label caption
                    >{{ naturezaPlataforma(item.tipo_operacao) }} ·
                    {{ horarioSaldo(item.ocorrido_em) }}</q-item-label
                  >
                  <q-item-label caption>{{ origemPlataforma(item.origem_pagamento) }}</q-item-label>
                  <q-item-label caption>{{
                    caixaPlataforma(item.status_caixa, item.tipo_operacao)
                  }}</q-item-label>
                  <q-item-label v-if="item.demonstracao" caption class="text-orange-9"
                    >Demonstração</q-item-label
                  >
                </q-item-section>
                <q-item-section side top>
                  <strong
                    :class="Number(item.lucro_liquido) < 0 ? 'text-negative' : 'text-positive'"
                    >{{ moedaSaldo(item.lucro_liquido) }}</strong
                  >
                  <q-badge
                    class="q-mt-sm"
                    :color="item.status_custos === 'consolidado' ? 'green-1' : 'orange-1'"
                    :text-color="item.status_custos === 'consolidado' ? 'positive' : 'orange-9'"
                    >{{
                      item.status_custos === 'consolidado' ? 'Consolidado' : 'Custos pendentes'
                    }}</q-badge
                  >
                  <span
                    v-if="item.status_caixa !== 'realizado_em_conta'"
                    class="text-caption text-grey-7 q-mt-xs"
                    >Fora do caixa</span
                  >
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="q-pa-lg text-center text-grey-7" role="status">
              Nenhuma operação encontrada neste período. Ajuste os filtros ou ative a demonstração.
            </div>
          </template>
        </div>
        <q-card-actions v-if="resposta && resposta.meta.last_page > 1" align="center"
          ><q-pagination
            v-model="pagina"
            :max="resposta.meta.last_page"
            :max-pages="5"
            direction-links
        /></q-card-actions>
      </q-card>
      <q-card
        v-show="!$q.screen.lt.md || selecionado"
        flat
        bordered
        class="painel-detail column no-wrap"
        aria-label="Auditoria da operação da plataforma"
      >
        <q-card-section class="row items-center q-gutter-sm">
          <q-btn
            v-if="$q.screen.lt.md && selecionado"
            flat
            round
            dense
            icon="arrow_back"
            aria-label="Voltar às operações"
            @click="limparSelecao"
          />
          <span class="text-subtitle1 text-weight-medium">{{
            selecionado ? detalhe?.descricao || 'Demonstrativo da operação' : 'Evolução dos ganhos'
          }}</span>
          <q-space />
          <q-btn
            v-if="selecionado && !$q.screen.lt.md"
            flat
            dense
            no-caps
            color="primary"
            icon="bar_chart"
            label="Ver gráfico"
            @click="limparSelecao"
          />
        </q-card-section>
        <q-separator />
        <div class="detail-scroll col">
          <div v-if="carregandoDetalhe || (!selecionado && carregando)" class="q-pa-xl text-center">
            <q-spinner color="primary" size="32px" />
          </div>
          <q-banner v-else-if="erroDetalhe" class="bg-red-1 text-negative q-ma-md" role="alert"
            >{{ erroDetalhe
            }}<template #action
              ><q-btn flat label="Tentar novamente" @click="selecionar(selecionado)" /></template
          ></q-banner>
          <DetalheLucroPlataforma
            v-else-if="detalhe"
            :key="detalhe.id + ':' + detalhe.versao"
            :operacao="detalhe"
            @atualizado="atualizar(false, true)"
          />
          <div v-else-if="resposta && !$q.screen.lt.md" class="q-pa-lg">
            <GraficoLucrosPlataforma
              :dados="resposta.grafico"
              :total="resposta.resumo.lucro_realizado"
              :intervalo="resposta.periodo"
              :diario="resposta.grafico_granularidade === 'hora'"
              :demonstracao="demonstracao"
              :resultado="resultado"
            />
            <div class="text-caption text-grey-7 text-center q-mt-lg">
              Selecione uma operação ao lado para consultar a composição e a auditoria.
            </div>
          </div>
          <div v-else-if="!$q.screen.lt.md" class="estado-vazio text-grey-7">
            <q-icon name="bar_chart" size="48px" color="blue-2" />
            <p>{{ erro || 'Selecione um período válido para consultar o gráfico.' }}</p>
          </div>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { useLucrosPlataforma } from 'src/composables/useLucrosPlataforma'
import { moedaSaldo, horarioSaldo } from 'src/utils/saldoMotoristas'
import {
  origemPlataforma,
  naturezaPlataforma,
  caixaPlataforma,
  iconePlataforma,
  resultadosPlataforma,
  tituloResultadoPlataforma,
} from 'src/utils/lucrosPlataforma'
import GraficoLucrosPlataforma from 'src/components/financeiro/GraficoLucrosPlataforma.vue'
import DetalheLucroPlataforma from 'src/components/financeiro/DetalheLucroPlataforma.vue'
import RegistrarCustoPlataforma from 'src/components/financeiro/RegistrarCustoPlataforma.vue'

const {
  periodo,
  data,
  inicio,
  fim,
  servico,
  status,
  resultado,
  demonstracao,
  pagina,
  resposta,
  detalhe,
  selecionado,
  carregando,
  carregandoDetalhe,
  erro,
  erroDetalhe,
  atualizar,
  selecionar,
  limparSelecao,
  navegar,
} = useLucrosPlataforma()
const periodos = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Personalizado', value: 'personalizado' },
]
const servicos = [
  { label: 'Todos', value: 'todos' },
  { label: 'Corridas', value: 'corrida' },
  { label: 'Entregas', value: 'entrega' },
]
const statusOpcoes = [
  { label: 'Todos', value: null },
  { label: 'Consolidado', value: 'consolidado' },
  { label: 'Estimado (pendente)', value: 'custos_pendentes' },
]
const dia = (valor) => new Intl.DateTimeFormat('pt-BR').format(new Date(valor + 'T12:00:00'))
</script>

<style scoped>
.paineis-plataforma {
  display: grid;
  grid-template-columns: minmax(390px, 0.85fr) minmax(0, 1.35fr);
  gap: 16px;
  height: calc(100vh - 155px);
  min-height: 600px;
}
.painel-master,
.painel-detail {
  min-width: 0;
  overflow: hidden;
}
.master-scroll,
.detail-scroll {
  overflow: auto;
  min-height: 0;
}
.operacao-ativa {
  background: #e3f2fd;
  box-shadow: inset 3px 0 #1976d2;
}
.estado-vazio {
  min-height: 450px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;
  text-align: center;
}
@media (max-width: 1023px) {
  .paineis-plataforma {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    min-height: 0;
  }
  .master-scroll,
  .detail-scroll {
    overflow: visible;
  }
  .painel-master,
  .painel-detail {
    min-height: 70vh;
  }
}
@media (max-width: 599px) {
  .cabecalho-plataforma {
    row-gap: 12px;
  }
  .cabecalho-titulo {
    flex: 1 0 calc(100% - 64px);
  }
  .cabecalho-plataforma > .q-btn {
    margin-left: 64px;
  }
}
</style>
