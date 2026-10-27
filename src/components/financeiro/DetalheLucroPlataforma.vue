<template>
  <div class="q-pa-lg">
    <q-banner v-if="operacao.demonstracao" rounded class="bg-amber-1 text-brown-9 q-mb-md"
      >Cenário fictício. Os recebimentos e custos deste registro são apenas
      demonstrativos.</q-banner
    >
    <div class="row items-center q-gutter-sm q-mb-lg">
      <q-badge :color="operacao.status_custos === 'consolidado' ? 'positive' : 'orange-8'">{{
        operacao.status_custos === 'consolidado'
          ? 'Lucro Consolidado'
          : 'Lucro Estimado (Custos Pendentes)'
      }}</q-badge>
      <q-badge outline color="grey-7">{{ origemPlataforma(operacao.origem_pagamento) }}</q-badge>
      <span class="text-caption text-grey-7">{{ horarioSaldo(operacao.ocorrido_em) }}</span>
    </div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="text-subtitle1 text-weight-medium">DRE operacional</q-card-section>
      <q-list>
        <q-item
          ><q-item-section>(+) Valor pago pelo passageiro · GMV</q-item-section
          ><q-item-section side>{{
            moedaSaldo(operacao.valor_bruto_passageiro)
          }}</q-item-section></q-item
        >
        <q-item
          ><q-item-section>(−) Repasse líquido do motorista</q-item-section
          ><q-item-section side>{{
            moedaSaldo(operacao.repasse_motorista)
          }}</q-item-section></q-item
        >
        <q-item v-if="incluidos > 0"
          ><q-item-section
            >(+) Reclassificação de custos já incluídos no repasse<q-item-label caption
              >Estes valores aparecem nas deduções abaixo e são descontados uma única
              vez.</q-item-label
            ></q-item-section
          ><q-item-section side>{{ moedaSaldo(incluidos) }}</q-item-section></q-item
        >
        <q-separator inset />
        <q-item class="text-weight-medium"
          ><q-item-section>(=) Margem bruta retida</q-item-section
          ><q-item-section side>{{
            moedaSaldo(operacao.margem_bruta_retida)
          }}</q-item-section></q-item
        >
        <q-item v-for="custo in custosPlataforma" :key="custo.campo">
          <q-item-section
            >(−) {{ custo.label
            }}<q-item-label caption
              >{{
                operacao.custos_confirmados?.includes(custo.campo) && operacao[custo.campo] !== null
                  ? 'Conferido'
                  : 'Aguardando conciliação'
              }}{{
                operacao.custos_incluidos_repasse?.includes(custo.campo)
                  ? ' · incluído no repasse'
                  : ''
              }}</q-item-label
            ></q-item-section
          >
          <q-item-section side>{{ moedaSaldo(operacao[custo.campo]) }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item class="q-py-lg"
          ><q-item-section
            ><strong>{{
              operacao.status_custos === 'consolidado'
                ? 'Resultado líquido da operação'
                : 'Resultado estimado · custos ainda incompletos'
            }}</strong></q-item-section
          ><q-item-section side
            ><strong
              class="text-h5"
              :class="Number(operacao.lucro_liquido) < 0 ? 'text-negative' : 'text-positive'"
              >{{ moedaSaldo(operacao.lucro_liquido) }}</strong
            ></q-item-section
          ></q-item
        >
      </q-list>
    </q-card>
    <q-banner
      v-if="operacao.pendencias_detalhes?.length"
      rounded
      class="bg-orange-1 text-brown-9 q-mb-md"
    >
      <div class="text-weight-medium">Pendências da apuração</div>
      <ul class="q-my-sm q-pl-md">
        <li v-for="pendencia in operacao.pendencias_detalhes" :key="pendencia">
          {{ nomePendencia(pendencia) }}
        </li>
      </ul>
      Os valores ainda não informados não foram considerados custos zero confirmados.
    </q-banner>
    <q-card flat bordered class="q-mb-md"
      ><q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">
          {{
            operacao.tipo_operacao === 'comissao_corrida'
              ? 'Situação do recebimento'
              : 'Pagamento da despesa'
          }}
        </div>
        <div class="text-weight-medium">
          {{ caixaPlataforma(operacao.status_caixa, operacao.tipo_operacao) }}
        </div>
        <p v-if="operacao.status_caixa === 'a_receber_motorista'" class="q-mb-none q-mt-sm">
          Comissão de {{ moedaSaldo(operacao.comissao_prevista) }} com
          {{ operacao.motorista || 'o motorista' }}. A confirmação do pagamento em dinheiro pelo
          passageiro não representa recebimento da plataforma.
        </p>
        <p v-else-if="operacao.status_caixa === 'aguardando_liquidacao'" class="q-mb-none q-mt-sm">
          Aguardando conciliação do depósito ou da retenção efetiva da comissão. O pagamento do
          passageiro no aplicativo, sozinho, não comprova esse recebimento.
        </p>
        <div v-if="operacao.recebido_em" class="q-mt-sm">
          Conferido em {{ horarioSaldo(operacao.recebido_em) }}
          <div class="text-caption text-grey-7">
            Referência: {{ operacao.referencia_liquidacao }}
          </div>
        </div>
        <div class="q-mt-md text-caption text-grey-7">
          Resultado realizado e consolidado desta operação
        </div>
        <strong>{{ moedaSaldo(operacao.lucro_realizado) }}</strong>
      </q-card-section></q-card
    >
    <div class="row q-gutter-sm q-mb-lg">
      <q-btn
        v-if="operacao.corrida"
        outline
        color="primary"
        icon="route"
        label="Auditar corrida original"
        @click="abrirCorrida"
      />
      <q-btn
        v-if="podeConciliar && operacao.status_caixa !== 'estornado'"
        outline
        color="primary"
        icon="fact_check"
        label="Conciliar custos"
        @click="abrirCustos"
      />
      <q-btn
        v-if="
          podeConciliar &&
          ['a_receber_motorista', 'aguardando_liquidacao'].includes(operacao.status_caixa) &&
          Number(operacao.comissao_prevista) > 0
        "
        outline
        color="primary"
        icon="account_balance"
        label="Conferir recebimento"
        @click="abrirRecebimento"
      />
    </div>
    <q-card flat bordered
      ><q-card-section class="text-subtitle2">Histórico de conferências</q-card-section>
      <q-list separator
        ><q-item v-for="registro in operacao.auditoria" :key="registro.id"
          ><q-item-section
            ><q-item-label>{{ acao(registro.acao) }} · versão {{ registro.versao }}</q-item-label
            ><q-item-label caption
              >{{ registro.gestor_nome || 'Sistema' }} ·
              {{ horarioSaldo(registro.created_at + 'Z') }}</q-item-label
            ><q-item-label caption>{{ registro.motivo }}</q-item-label
            ><q-item-label v-if="registro.referencia" caption
              >Referência: {{ registro.referencia }}</q-item-label
            ></q-item-section
          ></q-item
        ></q-list
      >
    </q-card>
    <q-dialog v-model="dialogo" :persistent="salvando">
      <q-card class="dialogo-conciliacao">
        <q-form @submit="salvar">
          <q-card-section class="text-h6">{{
            modo === 'custos' ? 'Conciliar custos da operação' : 'Conferir recebimento da comissão'
          }}</q-card-section>
          <q-card-section class="q-pt-none">
            <q-banner class="bg-blue-1 text-grey-9 q-mb-md">{{
              modo === 'custos'
                ? 'Informe os valores conferidos, inclusive quando forem zero. Identifique custos já incluídos no repasse para evitar desconto duplicado.'
                : 'Registre somente após conferir o recebimento integral da comissão no extrato ou a compensação efetiva na carteira. Este registro não executa cobrança nem transferência.'
            }}</q-banner>
            <template v-if="modo === 'custos'">
              <div v-for="custo in custosPlataforma" :key="custo.campo" class="q-mb-md">
                <q-input
                  v-model="form[custo.campo]"
                  :label="custo.label"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="R$"
                  outlined
                  dense
                  :disable="salvando"
                />
                <q-checkbox
                  v-model="form.custos_confirmados"
                  :val="custo.campo"
                  label="Valor conferido na documentação"
                  dense
                  class="q-mt-sm"
                  :disable="salvando"
                />
                <q-checkbox
                  v-if="custo.campo !== 'custo_gateway'"
                  v-model="form.custos_incluidos_repasse"
                  :val="custo.campo"
                  label="Já incluído no repasse líquido do motorista"
                  dense
                  class="q-mt-xs"
                  :disable="salvando"
                />
              </div>
              <q-checkbox
                v-model="form.composicao_conferida"
                label="Conferi a composição do repasse e os custos desta operação"
                :disable="salvando"
              />
            </template>
            <template v-else>
              <q-input
                :model-value="moedaSaldo(operacao.comissao_prevista)"
                label="Comissão integral a conferir"
                outlined
                readonly
                class="q-mb-md"
              />
              <q-input
                v-model="form.recebido_em"
                type="datetime-local"
                label="Data e hora do recebimento"
                stack-label
                outlined
                :disable="salvando"
                :rules="[obrigatorio]"
              />
              <q-checkbox
                v-model="form.comprovado"
                label="Conferi o recebimento integral na documentação indicada abaixo"
                :disable="salvando"
              />
            </template>
            <q-input
              v-model="form.referencia"
              label="Referência do extrato / comprovante"
              outlined
              :disable="salvando"
              maxlength="255"
              class="q-mt-md"
              :rules="[
                (v) =>
                  v?.trim().length >= 3 || 'Informe uma referência com pelo menos 3 caracteres.',
              ]"
            />
            <q-input
              v-model="form.motivo"
              label="Descrição da conferência"
              type="textarea"
              autogrow
              outlined
              :disable="salvando"
              maxlength="1000"
              :rules="[
                (v) =>
                  v?.trim().length >= 10 || 'Descreva a conferência com pelo menos 10 caracteres.',
              ]"
            />
            <q-banner v-if="erroForm" class="bg-red-1 text-negative" role="alert">{{
              erroForm
            }}</q-banner>
          </q-card-section>
          <q-card-actions align="right"
            ><q-btn v-close-popup flat label="Cancelar" :disable="salvando" /><q-btn
              type="submit"
              unelevated
              color="primary"
              label="Salvar conferência"
              :loading="salvando"
          /></q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
    <q-dialog v-model="dialogoCorrida"
      ><q-card class="dialogo-conciliacao">
        <q-card-section class="row items-center"
          ><span class="text-h6">Corrida original</span><q-space /><q-btn
            v-close-popup
            flat
            round
            dense
            icon="close"
            aria-label="Fechar corrida"
        /></q-card-section>
        <q-card-section v-if="carregandoCorrida" class="text-center"
          ><q-spinner color="primary"
        /></q-card-section>
        <q-card-section v-else-if="erroCorrida"
          ><q-banner class="bg-red-1 text-negative" role="alert">{{
            erroCorrida
          }}</q-banner></q-card-section
        >
        <q-card-section v-else-if="corrida">
          <div class="text-h6">{{ corrida.codigo_corrida }}</div>
          <p>{{ corrida.produto?.nome }} · {{ corrida.status_corrida }}</p>
          <p>
            Motorista: {{ corrida.motorista?.user?.name || operacao.motorista || 'Não informado' }}
          </p>
          <p>Pagamento: {{ corrida.metodo_pagamento }} · {{ corrida.status_pagamento }}</p>
          <q-list separator
            ><q-item v-for="ponto in corrida.corrida_destinos" :key="ponto.id"
              ><q-item-section>{{ ponto.tipo }} · {{ ponto.endereco }}</q-item-section></q-item
            ></q-list
          >
          <p class="q-mt-md">
            Valor pago: {{ moedaSaldo(corrida.corrida_financeiro?.valor_pago_passageiro) }}
          </p>
          <p>
            Comissão registrada: {{ moedaSaldo(corrida.corrida_financeiro?.taxa_plataforma_valor) }}
          </p>
          <p>
            Repasse líquido: {{ moedaSaldo(corrida.corrida_financeiro?.valor_liquido_motorista) }}
          </p>
          <div class="text-caption text-grey-7">
            Dados atuais da corrida. A apuração preserva seu retrato de origem e suas conferências.
          </div>
        </q-card-section>
      </q-card></q-dialog
    >
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { api } from 'boot/axios'
import { useAuthStore } from 'src/stores/auth'
import { moedaSaldo, horarioSaldo } from 'src/utils/saldoMotoristas'
import { custosPlataforma, origemPlataforma, caixaPlataforma } from 'src/utils/lucrosPlataforma'

const props = defineProps({ operacao: { type: Object, required: true } })
const emit = defineEmits(['atualizado'])
const auth = useAuthStore()
const podeConciliar = computed(() => auth.pode('financeiro.conciliar'))
const incluidos = computed(() =>
  (props.operacao.custos_incluidos_repasse || []).reduce(
    (soma, campo) => soma + Number(props.operacao[campo] || 0),
    0,
  ),
)
const dialogo = ref(false),
  modo = ref('custos'),
  form = ref({}),
  salvando = ref(false),
  erroForm = ref('')
const dialogoCorrida = ref(false),
  corrida = ref(null),
  erroCorrida = ref(''),
  carregandoCorrida = ref(false)
let ativo = true,
  ultimoPayload = '',
  requestId = '',
  corridaController
const obrigatorio = (v) => !!v || 'Informe a data do recebimento.'
const acao = (valor) =>
  ({
    sincronizacao: 'Origem sincronizada',
    custos_conciliados: 'Custos conferidos',
    recebimento_conferido: 'Recebimento conferido',
    demonstracao: 'Exemplo de demonstração',
    custo_avulso_conferido: 'Custo avulso conferido',
  })[valor] || valor
const nomePendencia = (valor) => custosPlataforma.find((c) => c.campo === valor)?.label || valor
function iniciar(modoNovo) {
  modo.value = modoNovo
  erroForm.value = ''
  ultimoPayload = ''
  requestId = ''
  form.value = { referencia: '', motivo: '' }
  dialogo.value = true
}
function abrirCustos() {
  iniciar('custos')
  form.value = {
    ...form.value,
    ...Object.fromEntries(custosPlataforma.map((c) => [c.campo, props.operacao[c.campo] ?? ''])),
    custos_confirmados: [...(props.operacao.custos_confirmados || [])],
    custos_incluidos_repasse: [...(props.operacao.custos_incluidos_repasse || [])],
    composicao_conferida: props.operacao.composicao_conferida,
  }
}
function abrirRecebimento() {
  iniciar('recebimento')
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
  form.value = { ...form.value, recebido_em: local, comprovado: false }
}
async function salvar() {
  if (salvando.value) return
  erroForm.value = ''
  if (modo.value === 'recebimento' && !form.value.comprovado) {
    erroForm.value = 'Confirme que o recebimento integral foi conferido.'
    return
  }
  const corpo = {
    versao: props.operacao.versao,
    referencia: form.value.referencia.trim(),
    motivo: form.value.motivo.trim(),
  }
  if (modo.value === 'custos')
    Object.assign(
      corpo,
      Object.fromEntries(
        custosPlataforma.map((c) => [
          c.campo,
          form.value[c.campo] === '' ? null : form.value[c.campo],
        ]),
      ),
      {
        custos_confirmados: form.value.custos_confirmados,
        custos_incluidos_repasse: form.value.custos_incluidos_repasse,
        composicao_conferida: form.value.composicao_conferida,
      },
    )
  else {
    const recebido = new Date(form.value.recebido_em)
    if (Number.isNaN(recebido.getTime())) {
      erroForm.value = 'Informe uma data válida.'
      return
    }
    Object.assign(corpo, {
      valor: props.operacao.comissao_prevista,
      recebido_em: recebido.toISOString(),
    })
  }
  const chave = JSON.stringify(corpo)
  if (chave !== ultimoPayload) {
    requestId = crypto.randomUUID()
    ultimoPayload = chave
  }
  corpo.client_request_id = requestId
  salvando.value = true
  try {
    const url = `/plataforma-lucros/${props.operacao.id}/${modo.value === 'custos' ? 'custos' : 'recebimento'}`
    await api.request({ method: modo.value === 'custos' ? 'PATCH' : 'POST', url, data: corpo })
    if (!ativo) return
    dialogo.value = false
    emit('atualizado')
  } catch (e) {
    if (ativo)
      erroForm.value =
        Object.values(e.response?.data?.errors || {})
          .flat()
          .join(' ') ||
        e.response?.data?.message ||
        'Não foi possível salvar a conferência. Tente novamente.'
  } finally {
    if (ativo) salvando.value = false
  }
}
async function abrirCorrida() {
  dialogoCorrida.value = true
  corrida.value = null
  erroCorrida.value = ''
  carregandoCorrida.value = true
  corridaController?.abort()
  corridaController = new AbortController()
  try {
    const { data } = await api.get(`/corridas/${props.operacao.corrida.id}`, {
      signal: corridaController.signal,
    })
    if (ativo) corrida.value = data
  } catch (e) {
    if (ativo && e.code !== 'ERR_CANCELED')
      erroCorrida.value = 'Não foi possível consultar a corrida original.'
  } finally {
    if (ativo) carregandoCorrida.value = false
  }
}
onBeforeUnmount(() => {
  ativo = false
  corridaController?.abort()
})
</script>

<style scoped>
.dialogo-conciliacao {
  width: 620px;
  max-width: 95vw;
}
.q-item__section--side {
  color: inherit;
}
.q-item {
  min-height: 52px;
}
@media (max-width: 599px) {
  .q-pa-lg {
    padding: 16px;
  }
  .text-h5 {
    font-size: 20px;
  }
}
</style>
