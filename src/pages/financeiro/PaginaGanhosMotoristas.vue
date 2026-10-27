<template>
  <q-page class="q-pa-md pagina-ganhos">
    <div class="row items-center q-mb-md">
      <q-avatar icon="payments" color="blue-1" text-color="primary" class="q-mr-md" />
      <div>
        <h1 class="text-h5 text-weight-medium q-ma-none">Ganhos dos motoristas</h1>
        <div class="text-caption text-grey-7">
          Acompanhe a composição dos ganhos e as solicitações do período.
        </div>
      </div>
    </div>
    <div class="paineis-ganhos">
      <q-card flat bordered class="painel-resumo column no-wrap">
        <q-card-section>
          <q-select
            v-model="motorista"
            :options="motoristas"
            option-label="nome"
            option-value="id"
            use-input
            hide-selected
            fill-input
            input-debounce="300"
            label="Buscar motorista por nome ou CPF"
            outlined
            dense
            clearable
            :loading="buscandoMotoristas"
            @filter="buscarMotoristas"
            ><template #no-option
              ><q-item
                ><q-item-section>Nenhum motorista encontrado.</q-item-section></q-item
              ></template
            ></q-select
          >
          <q-tabs
            v-model="tipoServico"
            dense
            no-caps
            active-color="primary"
            indicator-color="primary"
            class="q-mt-md"
            aria-label="Tipo de serviço"
            ><q-tab name="todos" label="Tudo" /><q-tab name="corrida" label="Corridas" /><q-tab
              name="entrega"
              label="Entregas"
          /></q-tabs>
          <q-btn-toggle
            v-model="periodo"
            no-caps
            spread
            unelevated
            toggle-color="primary"
            color="grey-2"
            text-color="grey-8"
            class="q-mt-md"
            :options="periodos"
            aria-label="Agrupar ganhos por período"
          />
          <div class="row items-center no-wrap q-gutter-xs q-mt-md">
            <q-btn
              flat
              round
              dense
              icon="chevron_left"
              aria-label="Período anterior"
              @click="navegar(-1)"
            /><q-input
              v-model="data"
              type="date"
              stack-label
              label="Data de referência"
              outlined
              dense
              class="col"
            /><q-btn
              flat
              round
              dense
              icon="chevron_right"
              aria-label="Próximo período"
              @click="navegar(1)"
            /><q-btn
              flat
              round
              dense
              icon="refresh"
              aria-label="Atualizar ganhos"
              :loading="carregando"
              @click="atualizar"
            />
          </div>
          <div v-if="resumo" class="text-caption text-grey-7 q-mt-sm text-center">
            {{ periodoLegivel }}
          </div>
        </q-card-section>
        <q-separator />
        <div class="resumo-scroll col q-pa-md">
          <q-banner v-if="erro" rounded class="bg-red-1 text-negative q-mb-md" role="alert"
            >{{ erro
            }}<template #action><q-btn flat label="Tentar novamente" @click="atualizar" /></template
          ></q-banner>
          <div v-if="carregando" class="q-pa-xl text-center">
            <q-spinner color="primary" size="32px" />
            <p class="text-grey-7">Consultando ganhos…</p>
          </div>
          <template v-else-if="resumo">
            <q-card flat bordered class="q-mb-md"
              ><q-card-section>
                <div class="text-caption text-grey-7">Ganho total do período</div>
                <div class="text-h4 text-weight-bold q-my-sm" aria-label="Ganho total">
                  {{ moedaSaldo(resumo.totais.total_ganhos) }}
                </div>
                <div class="row q-col-gutter-md q-mt-sm">
                  <div class="col-6">
                    <div class="text-subtitle1 text-weight-medium">
                      {{ moedaSaldo(resumo.totais.total_dinheiro) }}
                    </div>
                    <div class="text-caption text-grey-7">Ganhos pagos em dinheiro</div>
                  </div>
                  <div class="col-6">
                    <div class="text-subtitle1 text-weight-medium">
                      {{ moedaSaldo(resumo.totais.total_online) }}
                    </div>
                    <div class="text-caption text-grey-7">Ganhos pagos no app</div>
                  </div>
                </div>
                <div
                  v-if="Number(resumo.totais.total_nao_identificado) !== 0"
                  class="text-caption text-orange-9 q-mt-sm"
                >
                  Pagamento não informado: {{ moedaSaldo(resumo.totais.total_nao_identificado) }}
                </div>
                <GraficoGanhos
                  class="q-mt-md"
                  :dados="resumo.grafico"
                  :diario="periodo === 'diario'"
                  :anual="periodo === 'anual'"
                /> </q-card-section
            ></q-card>
            <q-card flat bordered class="q-mb-md"
              ><q-card-section class="q-pb-xs text-subtitle1 text-weight-medium"
                >Detalhamento de ganhos</q-card-section
              ><q-list>
                <q-item
                  v-for="componente in componentes"
                  :key="componente.value"
                  :clickable="periodo !== 'anual'"
                  :active="periodo !== 'anual' && visao === componente.value"
                  active-class="bg-blue-1 text-primary"
                  @click="abrirVisao(componente.value)"
                  ><q-item-section>{{ componente.label }}</q-item-section
                  ><q-item-section side class="text-weight-medium text-grey-9">{{
                    moedaSaldo(resumo.totais[componente.value])
                  }}</q-item-section
                  ><q-item-section v-if="periodo !== 'anual'" side
                    ><q-icon name="chevron_right"
                  /></q-item-section>
                </q-item> </q-list
            ></q-card>
            <q-btn
              v-if="periodo !== 'anual'"
              outline
              no-caps
              color="primary"
              label="Histórico de solicitações"
              icon="route"
              class="full-width q-mb-sm"
              @click="abrirVisao('solicitacoes')"
            />
            <q-btn
              v-if="periodo !== 'anual'"
              outline
              no-caps
              color="primary"
              label="Demonstrativo de ganhos"
              icon="receipt_long"
              class="full-width"
              @click="abrirVisao('demonstrativo')"
            />
            <div class="text-caption text-grey-7 q-mt-md">
              Valores líquidos de solicitações concluídas e pagas, com adicionais confirmados.
              Saques e transferências não compõem os ganhos.
            </div>
            <q-banner
              v-if="resumo.avisos.length"
              dense
              rounded
              class="bg-orange-1 text-grey-9 q-mt-md"
              ><div v-for="aviso in resumo.avisos" :key="aviso">{{ aviso }}</div></q-banner
            >
          </template>
          <p v-else-if="!erro" class="text-grey-7 text-center q-pa-md">
            Selecione um motorista para consultar os ganhos.
          </p>
        </div>
      </q-card>
      <q-card
        flat
        bordered
        class="painel-detalhe column no-wrap"
        aria-label="Detalhamento de ganhos do motorista"
      >
        <q-card-section class="row items-center justify-between q-gutter-sm"
          ><div>
            <div class="text-subtitle1 text-weight-medium">{{ tituloDetalhe }}</div>
            <div v-if="resumo" class="text-caption text-grey-7">
              {{ resumo.motorista.nome }} · {{ periodoLegivel }}
            </div>
          </div>
          <q-btn
            v-if="visao !== 'produtividade'"
            flat
            no-caps
            color="primary"
            label="Produtividade"
            icon="bar_chart"
            @click="abrirVisao('produtividade')"
        /></q-card-section>
        <q-separator />
        <div v-if="!resumo" class="col flex flex-center q-pa-xl text-grey-7 text-center">
          {{
            carregando
              ? 'Consultando o período selecionado…'
              : 'Selecione um motorista ao lado para visualizar o demonstrativo.'
          }}
        </div>
        <div v-else-if="visao === 'produtividade'" class="col detalhe-scroll q-pa-lg">
          <div class="text-h6 q-mb-lg">Produtividade do período</div>
          <div class="row q-col-gutter-md">
            <div v-for="kpi in kpis" :key="kpi.label" class="col-12 col-sm-6">
              <q-card flat bordered
                ><q-card-section
                  ><q-icon :name="kpi.icon" color="primary" size="26px" />
                  <div class="text-h5 q-mt-md">{{ kpi.valor }}</div>
                  <div class="text-caption text-grey-7">{{ kpi.label }}</div></q-card-section
                ></q-card
              >
            </div>
          </div>
          <p v-if="!resumo.totais.quantidade_solicitacoes" class="q-mt-lg text-grey-7">
            Nenhuma solicitação concluída e paga neste período.
          </p>
        </div>
        <template v-else>
          <q-banner v-if="erroDetalhes" dense class="bg-red-1 text-negative" role="alert"
            >{{ erroDetalhes
            }}<template #action
              ><q-btn flat label="Tentar novamente" @click="carregarDetalhes" /></template
          ></q-banner>
          <div class="col detalhe-scroll relative-position">
            <q-list v-if="visao === 'solicitacoes'" separator>
              <q-expansion-item
                v-for="item in itens"
                :key="item.id"
                group="solicitacoes"
                :aria-label="'Detalhes da solicitação ' + item.codigo_corrida"
              >
                <template #header
                  ><q-item-section
                    ><q-item-label class="text-weight-medium"
                      >{{ item.codigo_corrida }} · {{ item.passageiro }}</q-item-label
                    ><q-item-label caption
                      >{{ horarioSaldo(item.data) }} ·
                      {{ pagamentoSaldo(item.metodo_pagamento) }}</q-item-label
                    ><q-item-label caption class="trajeto">{{
                      item.trajeto.join(' → ') || 'Trajeto não informado'
                    }}</q-item-label></q-item-section
                  ><q-item-section side class="text-weight-medium text-primary">{{
                    moedaSaldo(item.valor_liquido)
                  }}</q-item-section></template
                >
                <q-card-section class="bg-grey-1 q-pa-lg"
                  ><div v-for="campo in camposSolicitacao" :key="campo.value" class="linha-valor">
                    <span>{{ campo.label }}</span
                    ><strong>{{ moedaSaldo(item[campo.value]) }}</strong>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-sm">
                    {{ item.produto || 'Produto não informado' }} ·
                    {{
                      item.km_rodados == null ? 'Distância não informada' : item.km_rodados + ' km'
                    }}
                  </div></q-card-section
                >
              </q-expansion-item>
            </q-list>
            <q-list v-else separator
              ><q-item v-for="item in itens" :key="item.id" class="q-py-md"
                ><q-item-section
                  ><q-item-label class="text-weight-medium">{{
                    nomeComponente(item.categoria)
                  }}</q-item-label
                  ><q-item-label>{{ item.descricao }}</q-item-label
                  ><q-item-label v-if="item.categoria === 'recompensas'" caption>{{
                    item.campanha || 'Campanha ou meta não informada'
                  }}</q-item-label
                  ><q-item-label caption
                    >{{ horarioSaldo(item.data) }} ·
                    {{ pagamentoSaldo(item.metodo_pagamento) }}</q-item-label
                  ></q-item-section
                ><q-item-section
                  side
                  :class="Number(item.valor) < 0 ? 'text-negative' : 'text-positive'"
                  >{{ moedaSaldo(item.valor) }}</q-item-section
                ></q-item
              ></q-list
            >
            <div
              v-if="!carregandoDetalhes && !itens.length && !erroDetalhes"
              class="q-pa-xl text-center text-grey-7"
              role="status"
            >
              Nenhum registro encontrado para esta seleção.
            </div>
            <q-inner-loading :showing="carregandoDetalhes" />
          </div>
          <q-separator />
          <div class="row items-center justify-between q-pa-sm">
            <span class="text-caption text-grey-7">{{ total }} registros</span
            ><q-pagination
              v-model="pagina"
              :max="ultimaPagina"
              :max-pages="4"
              direction-links
              :disable="carregandoDetalhes"
            />
          </div>
        </template>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useGanhosMotoristas } from 'src/composables/useGanhosMotoristas'
import { moedaSaldo, horarioSaldo, pagamentoSaldo } from 'src/utils/saldoMotoristas'
import GraficoGanhos from 'src/components/financeiro/GraficoGanhos.vue'
const {
  data,
  motorista,
  motoristas,
  buscandoMotoristas,
  periodo,
  tipoServico,
  resumo,
  carregando,
  erro,
  visao,
  itens,
  pagina,
  ultimaPagina,
  total,
  carregandoDetalhes,
  erroDetalhes,
  buscarMotoristas,
  atualizar,
  carregarDetalhes,
  abrirVisao,
  navegar,
} = useGanhosMotoristas()
const periodos = [
  { label: 'Diários', value: 'diario' },
  { label: 'Semanais', value: 'semanal' },
  { label: 'Mensais', value: 'mensal' },
  { label: 'Anuais', value: 'anual' },
]
const componentes = [
  { label: 'Valor da solicitação', value: 'valor_solicitacoes' },
  { label: 'Recompensa', value: 'recompensas' },
  { label: 'Gorjeta', value: 'gorjetas' },
  { label: 'Compensação', value: 'compensacoes' },
  { label: 'Outro', value: 'outros' },
]
const nomeComponente = (valor) => componentes.find((item) => item.value === valor)?.label || valor
const camposSolicitacao = [
  { label: 'Pago pelo passageiro', value: 'valor_pago_passageiro' },
  { label: 'Comissão da plataforma', value: 'taxa_plataforma' },
  { label: 'Complemento da plataforma', value: 'subsidio' },
  { label: 'Valor líquido do motorista', value: 'valor_liquido' },
  { label: 'Tarifa base', value: 'tarifa_base' },
  { label: 'Preço dinâmico', value: 'dinamico' },
  { label: 'Tempo de espera', value: 'espera' },
]
const tituloDetalhe = computed(
  () =>
    ({
      produtividade: 'Painel de ganhos',
      solicitacoes: 'Histórico de solicitações',
      demonstrativo: 'Demonstrativo de ganhos',
    })[visao.value] || nomeComponente(visao.value),
)
const formatarDia = (valor) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(valor + 'T12:00:00'))
const periodoLegivel = computed(() =>
  resumo.value
    ? formatarDia(resumo.value.periodo.inicio) + ' a ' + formatarDia(resumo.value.periodo.fim)
    : '',
)
const kpis = computed(() =>
  resumo.value
    ? [
        {
          label: 'Ganho por solicitação',
          valor: moedaSaldo(resumo.value.produtividade.ganho_por_solicitacao),
          icon: 'payments',
        },
        {
          label: 'Ganho por quilômetro',
          valor: moedaSaldo(resumo.value.produtividade.ganho_por_km),
          icon: 'speed',
        },
        {
          label: 'Solicitações finalizadas e pagas',
          valor: resumo.value.totais.quantidade_solicitacoes,
          icon: 'task_alt',
        },
        {
          label: 'Quilômetros registrados',
          valor:
            new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
              resumo.value.totais.km_rodados,
            ) + ' km',
          icon: 'route',
        },
      ]
    : [],
)
</script>

<style scoped>
.paineis-ganhos {
  display: grid;
  grid-template-columns: minmax(340px, 39%) minmax(0, 1fr);
  gap: 16px;
  height: calc(100dvh - 155px);
  min-height: 560px;
}
.painel-resumo,
.painel-detalhe {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.resumo-scroll,
.detalhe-scroll {
  min-height: 0;
  overflow-y: auto;
}
.trajeto {
  white-space: normal;
  overflow-wrap: anywhere;
}
.linha-valor {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  font-size: 13px;
}
.linha-valor span {
  color: #64748b;
}
.linha-valor strong {
  text-align: right;
}
@media (max-width: 1023px) {
  .paineis-ganhos {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .resumo-scroll,
  .detalhe-scroll {
    overflow: visible;
  }
  .painel-detalhe {
    min-height: 350px;
  }
}
@media (max-width: 599px) {
  .pagina-ganhos {
    padding: 12px;
  }
}
</style>
