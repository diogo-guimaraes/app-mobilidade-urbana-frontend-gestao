<template>
  <q-card flat bordered class="detalhe-saldo column no-wrap" aria-label="Detalhes da movimentação">
    <div v-if="!movimento" class="estado-vazio col flex flex-center q-pa-xl text-center">
      <div>
        <q-avatar size="72px" color="blue-1" text-color="primary" icon="account_balance_wallet" />
        <div class="text-h6 q-mt-md">Consulte cada movimentação</div>
        <p class="text-grey-7 q-mt-sm">
          Selecione uma transação ao lado para ver o extrato detalhado.
        </p>
      </div>
    </div>
    <template v-else>
      <div class="q-px-md q-pt-sm" v-if="$q.screen.lt.md">
        <q-btn
          flat
          dense
          icon="arrow_back"
          label="Movimentações"
          aria-label="Voltar às movimentações"
          color="primary"
          @click="$emit('voltar')"
        />
      </div>
      <q-card-section class="q-pa-lg">
        <div class="row items-center no-wrap q-gutter-md">
          <q-avatar
            size="48px"
            color="blue-1"
            text-color="primary"
            :icon="movimento.motorista.foto ? undefined : 'person_outline'"
          >
            <img
              v-if="movimento.motorista.foto"
              :src="movimento.motorista.foto"
              alt="Foto do motorista"
            />
          </q-avatar>
          <div class="col" style="min-width: 0">
            <div class="text-subtitle1 text-weight-medium motorista-nome">
              {{ movimento.motorista.nome }}
            </div>
            <div class="text-caption text-grey-7">Motorista #{{ movimento.motorista.id }}</div>
          </div>
          <div class="saldo-atual text-right">
            <div class="text-caption text-grey-7">Saldo atual da carteira</div>
            <div class="text-h6 text-weight-medium">
              {{ moedaSaldo(movimento.motorista.saldo_atual) }}
            </div>
          </div>
        </div>
      </q-card-section>
      <q-tabs
        v-model="aba"
        dense
        no-caps
        align="left"
        active-color="primary"
        indicator-color="primary"
        class="text-grey-7"
        aria-label="Informações da movimentação"
      >
        <q-tab name="movimentacao" label="Movimentação" />
        <q-tab v-if="movimento.corrida?.id" name="corrida" label="Histórico da corrida" />
      </q-tabs>
      <q-separator />
      <q-linear-progress
        v-if="carregando"
        indeterminate
        color="primary"
        aria-label="Carregando detalhes"
      />
      <HistoricoChatCorrida
        v-if="aba === 'corrida' && movimento.corrida?.id"
        :key="movimento.id"
        :movimentacao-id="movimento.id"
        :corrida-id="movimento.corrida?.id || null"
      />
      <div v-else class="col detalhe-scroll q-pa-lg" role="tabpanel" aria-label="Movimentação">
        <q-banner v-if="erro" rounded class="bg-red-1 text-negative q-mb-md" role="alert">
          {{ erro }}
          <template #action
            ><q-btn flat label="Tentar novamente" @click="$emit('repetir')"
          /></template>
        </q-banner>
        <div
          class="resumo-movimento rounded-borders q-pa-lg q-mb-lg"
          :class="entrada ? 'entrada' : 'saida'"
        >
          <div class="row items-center justify-between q-gutter-sm">
            <div class="row items-center q-gutter-sm">
              <q-icon :name="entrada ? 'south_west' : 'north_east'" size="20px" />
              <span class="text-weight-medium">{{ entrada ? 'Entrada' : 'Saída' }}</span>
            </div>
            <q-badge color="white" :text-color="situacao.color" :label="situacao.label" />
          </div>
          <div class="valor-principal text-weight-bold q-mt-md">
            {{ valorMovimentacao(movimento) }}
          </div>
          <div class="text-subtitle1 q-mt-xs">{{ tituloMovimentacao(movimento) }}</div>
          <div class="text-caption q-mt-sm">{{ horarioSaldo(movimento.created_at) }}</div>
          <div class="text-caption q-mt-xs">
            {{ pagamentoSaldo(movimento.metodo_pagamento) }} · Movimentação #{{ movimento.id }}
          </div>
        </div>
        <template v-if="carregando && !movimento.auditoria">
          <q-skeleton height="180px" class="q-mb-md" />
          <q-skeleton height="120px" />
        </template>
        <template v-else-if="movimento.auditoria">
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="titulo-secao">
                <q-icon name="fact_check" color="primary" size="20px" />Auditoria da carteira
              </div>
              <div class="auditoria-grid q-mt-md">
                <div>
                  <div class="text-caption text-grey-7">Saldo anterior</div>
                  <strong>{{ moedaSaldo(movimento.auditoria.saldo_anterior) }}</strong>
                </div>
                <q-icon :name="entrada ? 'add' : 'remove'" color="grey-6" size="18px" />
                <div>
                  <div class="text-caption text-grey-7">Movimentação</div>
                  <strong :class="entrada ? 'text-positive' : 'text-negative'">{{
                    moedaSaldo(movimento.valor)
                  }}</strong>
                </div>
                <q-icon name="drag_handle" color="grey-6" size="18px" />
                <div>
                  <div class="text-caption text-grey-7">Saldo posterior</div>
                  <strong>{{ moedaSaldo(movimento.auditoria.saldo_posterior) }}</strong>
                </div>
              </div>
              <q-banner
                v-if="movimento.auditoria.consistente === false"
                dense
                rounded
                class="bg-orange-1 text-orange-10 q-mt-md"
                role="alert"
                >Os saldos registrados não correspondem ao valor desta movimentação. Confira o
                lançamento de origem.</q-banner
              >
              <div class="text-caption text-grey-7 q-mt-md">
                Saldos registrados no momento da transação. O saldo atual considera as movimentações
                posteriores.
              </div>
            </q-card-section>
          </q-card>
          <q-card v-if="movimento.corrida" flat bordered class="q-mb-md">
            <q-card-section>
              <div class="titulo-secao">
                <q-icon name="directions_car" color="primary" size="20px" />Corrida vinculada
              </div>
              <div class="linha q-mt-sm">
                <span>Código da corrida</span
                ><strong>{{ movimento.corrida.codigo_corrida }}</strong>
              </div>
              <div class="linha">
                <span>Produto</span
                ><strong>{{ movimento.corrida.produto || 'Não informado' }}</strong>
              </div>
            </q-card-section>
          </q-card>
          <template v-if="movimento.composicao">
            <div class="text-caption text-grey-7 q-mb-sm">
              {{
                movimento.composicao.origem === 'registro'
                  ? 'Composição registrada na movimentação'
                  : 'Composição disponível na corrida vinculada'
              }}
            </div>
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="titulo-secao q-mb-md">
                  <q-icon name="payments" color="primary" size="20px" />Ganhos do motorista
                </div>
                <div v-for="item in ganhos" :key="item.campo" class="linha">
                  <span>{{ item.label }}</span
                  ><strong>{{ moedaSaldo(movimento.composicao.ganhos[item.campo]) }}</strong>
                </div>
                <q-separator class="q-my-sm" />
                <div class="linha text-weight-medium">
                  <span>Ganho líquido registrado</span
                  ><strong>{{
                    moedaSaldo(movimento.composicao.ganhos.valor_liquido_motorista)
                  }}</strong>
                </div>
                <div class="text-caption text-grey-7 q-mt-sm">
                  Componentes informativos, sem recalcular o ganho registrado.
                </div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="titulo-secao q-mb-md">
                  <q-icon name="person_outline" color="primary" size="20px" />{{
                    movimento.composicao.status_pagamento === 'pago'
                      ? 'Pago pelo passageiro'
                      : 'Valor do passageiro'
                  }}
                </div>
                <div class="linha">
                  <span>Valor</span
                  ><strong>{{ moedaSaldo(movimento.composicao.valor_pago_passageiro) }}</strong>
                </div>
                <div class="linha">
                  <span>Forma de pagamento</span
                  ><strong>{{ pagamentoSaldo(movimento.composicao.metodo_pagamento) }}</strong>
                </div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="titulo-secao q-mb-md">
                  <q-icon name="tune" color="primary" size="20px" />Taxas, complementos e ajustes
                </div>
                <div v-for="item in ajustes" :key="item.campo" class="linha">
                  <span>{{ item.label }}</span
                  ><strong>{{ moedaSaldo(movimento.composicao.ajustes[item.campo]) }}</strong>
                </div>
              </q-card-section>
            </q-card>
          </template>
          <q-card v-if="movimento.observacao" flat bordered
            ><q-card-section
              ><div class="titulo-secao q-mb-sm">Observações</div>
              <div class="observacao">{{ movimento.observacao }}</div></q-card-section
            ></q-card
          >
        </template>
      </div>
    </template>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import HistoricoChatCorrida from 'src/components/ajuda/HistoricoChatCorrida.vue'
import {
  moedaSaldo,
  valorMovimentacao,
  tituloMovimentacao,
  pagamentoSaldo,
  horarioSaldo,
  situacaoMovimentacao,
} from 'src/utils/saldoMotoristas'
const props = defineProps({
  movimento: { type: Object, default: null },
  carregando: Boolean,
  erro: { type: String, default: '' },
})
defineEmits(['voltar', 'repetir'])
const aba = ref('movimentacao')
watch([() => props.movimento?.id, () => props.movimento?.corrida?.id], () => {
  aba.value = 'movimentacao'
})
const entrada = computed(() => props.movimento?.tipo === 'entrada')
const situacao = computed(() => situacaoMovimentacao(props.movimento?.status))
const ganhos = [
  { campo: 'valor_base_calculado', label: 'Valor base da corrida' },
  { campo: 'tarifa_base', label: 'Tarifa base' },
  { campo: 'valor_dinamico_aplicado', label: 'Preço dinâmico' },
  { campo: 'taxa_espera', label: 'Tempo de espera' },
  { campo: 'bonus_incentivo', label: 'Bônus de incentivo' },
]
const ajustes = [
  { campo: 'taxa_plataforma_valor', label: 'Taxa da plataforma' },
  { campo: 'subsidiado_plataforma', label: 'Complemento do app' },
  { campo: 'valor_ajuste_negociado', label: 'Ajuste negociado' },
  { campo: 'valor_descontos', label: 'Desconto ao passageiro' },
  { campo: 'taxa_cancelamento', label: 'Cancelamento desta corrida' },
  { campo: 'taxa_cancelamento_terceiro', label: 'Cancelamento anterior / terceiros' },
]
</script>

<style scoped>
.detalhe-saldo {
  height: 100%;
  overflow: hidden;
}
.estado-vazio {
  min-height: 400px;
}
.estado-vazio p {
  max-width: 340px;
}
.detalhe-scroll {
  overflow-y: auto;
  min-height: 0;
}
.motorista-nome,
.observacao {
  overflow-wrap: anywhere;
}
.saldo-atual {
  flex-shrink: 0;
}
.resumo-movimento.entrada {
  background: #edf8f3;
  color: #176849;
}
.resumo-movimento.saida {
  background: #fff1f0;
  color: #ad3535;
}
.valor-principal {
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.2;
}
.titulo-secao {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.linha {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
}
.linha span {
  color: #657383;
}
.linha strong {
  text-align: right;
  white-space: nowrap;
  font-weight: 500;
}
.auditoria-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}
.auditoria-grid strong {
  font-size: 16px;
  overflow-wrap: anywhere;
}
@media (max-width: 599px) {
  .saldo-atual {
    max-width: 130px;
  }
  .saldo-atual .text-h6 {
    font-size: 17px;
  }
  .q-pa-lg {
    padding: 16px;
  }
  .auditoria-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .auditoria-grid > .q-icon {
    display: none;
  }
  .auditoria-grid > div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .linha {
    font-size: 13px;
    gap: 8px;
  }
}
</style>
