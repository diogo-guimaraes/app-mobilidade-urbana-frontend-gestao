<template>
  <q-page class="q-pa-md pagina-saldos">
    <div
      v-show="!$q.screen.lt.md || !selecionado"
      class="row items-center justify-between q-gutter-sm q-mb-md"
    >
      <div class="row items-center no-wrap">
        <q-avatar
          color="blue-1"
          text-color="primary"
          icon="account_balance_wallet"
          class="q-mr-md"
        />
        <div>
          <h1 class="text-h5 text-weight-medium q-ma-none">Motoristas saldo</h1>
          <div class="text-caption text-grey-7">
            Acompanhe entradas, saídas e o histórico da carteira.
          </div>
        </div>
      </div>
      <q-badge outline color="primary" class="q-pa-sm"
        ><q-icon name="visibility" class="q-mr-xs" />Consulta financeira</q-badge
      >
    </div>
    <div class="paineis-saldo" :class="{ 'detalhe-aberto': selecionado }">
      <q-card
        v-show="!$q.screen.lt.md || !selecionado"
        flat
        bordered
        class="lista-saldos column no-wrap"
        aria-label="Movimentações financeiras"
      >
        <q-card-section class="q-pa-md">
          <div class="row items-center justify-between q-mb-md">
            <span class="text-subtitle1 text-weight-medium">Movimentações</span>
            <q-badge color="blue-1" text-color="primary"
              >{{ total }} {{ total === 1 ? 'registro' : 'registros' }}</q-badge
            >
            <q-btn
              flat
              round
              dense
              icon="refresh"
              aria-label="Atualizar movimentações"
              :loading="carregando"
              @click="atualizar"
            />
          </div>
          <q-input
            v-model="search"
            outlined
            dense
            debounce="350"
            clearable
            placeholder="Nome ou CPF do motorista"
            aria-label="Buscar motorista"
            ><template #prepend><q-icon name="search" /></template
          ></q-input>
          <div class="row q-col-gutter-sm q-mt-sm">
            <q-input
              v-model="dataInicio"
              type="date"
              label="De"
              aria-label="Data inicial"
              stack-label
              outlined
              dense
              clearable
              class="col-6"
            />
            <q-input
              v-model="dataFim"
              type="date"
              label="Até"
              aria-label="Data final"
              stack-label
              outlined
              dense
              clearable
              class="col-6"
              :min="dataInicio || undefined"
            />
          </div>
          <div class="row q-col-gutter-sm q-mt-sm">
            <q-select
              v-model="tipo"
              :options="tiposMovimentacao"
              label="Tipo"
              emit-value
              map-options
              outlined
              dense
              clearable
              class="col-6"
            />
            <q-select
              v-model="status"
              :options="statusMovimentacao"
              label="Status"
              emit-value
              map-options
              outlined
              dense
              clearable
              class="col-6"
            />
          </div>
          <q-select
            v-model="categoria"
            :options="categoriasMovimentacao"
            label="Categoria"
            emit-value
            map-options
            outlined
            dense
            clearable
            class="q-mt-md"
          />
          <div
            v-if="search || tipo || categoria || status || dataInicio || dataFim"
            class="text-right q-mt-xs"
          >
            <q-btn flat dense no-caps label="Limpar filtros" color="primary" @click="limpar" />
          </div>
        </q-card-section>
        <q-separator />
        <q-banner v-if="erro" dense class="bg-red-1 text-negative" role="alert">{{
          erro
        }}</q-banner>
        <div class="col lista-scroll relative-position">
          <q-list separator>
            <q-item
              v-for="item in movimentos"
              :key="item.id"
              clickable
              :active="selecionado === item.id"
              active-class="movimento-ativo"
              class="q-py-md"
              :aria-label="'Ver movimentação ' + item.id"
              @click="abrir(item.id)"
            >
              <q-item-section avatar top
                ><q-avatar
                  size="34px"
                  :color="item.tipo === 'entrada' ? 'green-1' : 'red-1'"
                  :text-color="item.tipo === 'entrada' ? 'positive' : 'negative'"
                  :icon="item.tipo === 'entrada' ? 'south_west' : 'north_east'"
              /></q-item-section>
              <q-item-section style="min-width: 0">
                <div class="row items-start justify-between q-gutter-xs">
                  <span class="text-weight-medium descricao-movimento">{{
                    tituloMovimentacao(item)
                  }}</span>
                  <q-badge
                    class="valor-lista"
                    :color="item.tipo === 'entrada' ? 'green-1' : 'red-1'"
                    :text-color="item.tipo === 'entrada' ? 'positive' : 'negative'"
                    :label="valorMovimentacao(item)"
                  />
                </div>
                <q-item-label caption class="q-mt-xs">{{ item.motorista.nome }}</q-item-label>
                <q-item-label caption>{{ horarioSaldo(item.created_at) }}</q-item-label>
                <div class="row items-center justify-between q-gutter-xs q-mt-sm">
                  <span class="text-caption text-grey-7">{{
                    pagamentoSaldo(item.metodo_pagamento)
                  }}</span
                  ><q-badge
                    outline
                    :color="situacaoMovimentacao(item.status).color"
                    :label="situacaoMovimentacao(item.status).label"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div
            v-if="!carregando && !movimentos.length && !erro"
            class="q-pa-xl text-center text-grey-7"
            role="status"
          >
            <q-icon name="receipt_long" size="40px" />
            <div class="text-subtitle2 q-mt-md">Nenhuma movimentação encontrada</div>
            <p class="text-caption q-mt-xs">
              Os lançamentos aparecerão aqui quando forem registrados.
            </p>
          </div>
          <q-inner-loading :showing="carregando" />
        </div>
        <q-separator />
        <div class="flex flex-center q-pa-sm">
          <q-pagination
            v-model="page"
            :max="ultimaPagina"
            :max-pages="5"
            direction-links
            boundary-numbers
            :disable="carregando"
          />
        </div>
      </q-card>
      <DetalheSaldoMotorista
        v-show="!$q.screen.lt.md || selecionado"
        :movimento="registro"
        :carregando="carregandoDetalhe"
        :erro="erroDetalhe"
        @voltar="voltar"
        @repetir="abrir(selecionado)"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useSaldoMotoristas } from 'src/composables/useSaldoMotoristas'
import {
  tiposMovimentacao,
  categoriasMovimentacao,
  statusMovimentacao,
  situacaoMovimentacao,
  valorMovimentacao,
  tituloMovimentacao,
  pagamentoSaldo,
  horarioSaldo,
} from 'src/utils/saldoMotoristas'
import DetalheSaldoMotorista from 'src/components/financeiro/DetalheSaldoMotorista.vue'
const {
  movimentos,
  selecionado,
  detalhe,
  search,
  tipo,
  categoria,
  status,
  dataInicio,
  dataFim,
  page,
  total,
  ultimaPagina,
  carregando,
  carregandoDetalhe,
  erro,
  erroDetalhe,
  abrir,
  voltar,
  atualizar,
  limpar,
} = useSaldoMotoristas()
const registro = computed(
  () => detalhe.value || movimentos.value.find((item) => item.id === selecionado.value) || null,
)
</script>

<style scoped>
.paineis-saldo {
  display: grid;
  grid-template-columns: minmax(320px, 37%) minmax(0, 1fr);
  gap: 16px;
  height: calc(100dvh - 157px);
  min-height: 480px;
}
.lista-saldos {
  height: 100%;
  overflow: hidden;
}
.lista-scroll {
  overflow-y: auto;
  min-height: 0;
}
.movimento-ativo {
  background: #e8f3ff;
  box-shadow: inset 3px 0 #1976d2;
}
.descricao-movimento {
  flex: 1 1 130px;
  overflow-wrap: anywhere;
}
.valor-lista {
  white-space: nowrap;
  font-weight: 600;
  padding: 5px 7px;
}
@media (max-width: 1023px) {
  .paineis-saldo {
    grid-template-columns: minmax(0, 1fr);
  }
  .paineis-saldo.detalhe-aberto {
    height: calc(100dvh - 90px);
    min-height: 400px;
  }
}
@media (max-width: 599px) {
  .pagina-saldos {
    padding: 12px;
  }
  .paineis-saldo {
    height: calc(100dvh - 190px);
  }
}
</style>
