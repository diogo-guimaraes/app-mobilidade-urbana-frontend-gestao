<template>
  <q-btn
    v-if="auth.pode('financeiro.conciliar')"
    outline
    dense
    color="primary"
    icon="add"
    label="Registrar custo"
    @click="abrir"
  />
  <q-dialog v-model="dialogo" :persistent="salvando"
    ><q-card class="dialogo-custo"
      ><q-form @submit="salvar">
        <q-card-section class="text-h6">Registrar custo avulso da plataforma</q-card-section>
        <q-card-section class="q-pt-none">
          <q-banner class="bg-blue-1 q-mb-md"
            >Use para despesas já pagas e conferidas, que não estejam incluídas em outra corrida ou
            campanha. O registro não executa pagamento.</q-banner
          >
          <q-input
            v-model="form.descricao"
            label="Campanha / descrição do custo"
            outlined
            :disable="salvando"
            maxlength="255"
            :rules="[
              (v) => v?.trim().length >= 5 || 'Informe uma descrição com pelo menos 5 caracteres.',
            ]"
          />
          <q-select
            v-model="form.tipo_operacao"
            :options="tipos"
            emit-value
            map-options
            label="Natureza do custo"
            outlined
            :disable="salvando"
            class="q-mb-md"
          />
          <div class="row q-col-gutter-sm q-mb-md">
            <q-select
              v-model="form.tipo_servico"
              :options="servicos"
              emit-value
              map-options
              label="Serviço"
              outlined
              :disable="salvando"
              class="col-6"
            /><q-select
              v-model="form.origem_pagamento"
              :options="metodos"
              emit-value
              map-options
              label="Pagamento da despesa"
              outlined
              :disable="salvando"
              class="col-6"
            />
          </div>
          <q-input
            v-model="form.valor"
            type="number"
            min="0.01"
            step="0.01"
            label="Valor pago"
            prefix="R$"
            outlined
            :disable="salvando"
            :rules="[(v) => Number(v) > 0 || 'Informe um valor positivo.']"
          />
          <q-input
            v-model="form.pago_em"
            type="datetime-local"
            label="Data e hora do pagamento"
            stack-label
            outlined
            :disable="salvando"
            :rules="[(v) => !!v || 'Informe a data.']"
          />
          <q-input
            v-model="form.referencia"
            label="Identificador único do comprovante"
            hint="Um comprovante não pode ser cadastrado duas vezes."
            outlined
            :disable="salvando"
            maxlength="255"
            :rules="[(v) => v?.trim().length >= 3 || 'Informe a referência.']"
          />
          <q-input
            v-model="form.motivo"
            type="textarea"
            autogrow
            label="Descrição da conferência"
            outlined
            :disable="salvando"
            maxlength="1000"
            :rules="[
              (v) =>
                v?.trim().length >= 10 || 'Descreva a conferência com pelo menos 10 caracteres.',
            ]"
          />
          <q-checkbox
            v-model="form.nao_alocado"
            label="Conferi o pagamento e este custo não está incluído em outra apuração"
            :disable="salvando"
          />
          <q-banner v-if="erro" class="bg-red-1 text-negative q-mt-md" role="alert">{{
            erro
          }}</q-banner>
        </q-card-section>
        <q-card-actions align="right"
          ><q-btn v-close-popup flat label="Cancelar" :disable="salvando" /><q-btn
            type="submit"
            unelevated
            color="primary"
            label="Registrar custo conferido"
            :loading="salvando"
        /></q-card-actions> </q-form></q-card
  ></q-dialog>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { api } from 'boot/axios'
import { useAuthStore } from 'src/stores/auth'
const emit = defineEmits(['registrado'])
const auth = useAuthStore()
const dialogo = ref(false),
  salvando = ref(false),
  erro = ref(''),
  form = ref({})
let ativo = true,
  ultimoPayload = '',
  requestId = ''
const tipos = [
  { label: 'Subsídio / desconto', value: 'subsidio_tarifa' },
  { label: 'Bônus / recompensa', value: 'recompensa_bonus' },
  { label: 'Compensação / reembolso', value: 'compensacao_reembolso' },
]
const servicos = [
  { label: 'Corridas', value: 'corrida' },
  { label: 'Entregas', value: 'entrega' },
  { label: 'Corporativo / geral', value: 'outro' },
]
const metodos = [
  { label: 'PIX', value: 'online_pix' },
  { label: 'Cartão', value: 'online_cartao' },
  { label: 'Outro comprovado', value: 'nao_identificada' },
]
function abrir() {
  const agora = new Date()
  form.value = {
    descricao: '',
    tipo_operacao: 'recompensa_bonus',
    tipo_servico: 'outro',
    origem_pagamento: 'online_pix',
    valor: '',
    pago_em: new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
    referencia: '',
    motivo: '',
    nao_alocado: false,
  }
  erro.value = ''
  ultimoPayload = ''
  requestId = ''
  dialogo.value = true
}
async function salvar() {
  if (salvando.value) return
  erro.value = ''
  if (!form.value.nao_alocado) {
    erro.value = 'Confirme que este custo foi pago e não está alocado em outra operação.'
    return
  }
  const quando = new Date(form.value.pago_em)
  if (Number.isNaN(quando.getTime())) {
    erro.value = 'Informe uma data válida.'
    return
  }
  const dados = {
    ...form.value,
    pago_em: quando.toISOString(),
    descricao: form.value.descricao.trim(),
    referencia: form.value.referencia.trim(),
    motivo: form.value.motivo.trim(),
  }
  const assinatura = JSON.stringify(dados)
  if (assinatura !== ultimoPayload) {
    requestId = crypto.randomUUID()
    ultimoPayload = assinatura
  }
  dados.client_request_id = requestId
  salvando.value = true
  try {
    await api.post('/plataforma-lucros/custos-avulsos', dados)
    if (ativo) {
      dialogo.value = false
      emit('registrado')
    }
  } catch (e) {
    if (ativo)
      erro.value =
        Object.values(e.response?.data?.errors || {})
          .flat()
          .join(' ') ||
        e.response?.data?.message ||
        'Não foi possível registrar o custo.'
  } finally {
    if (ativo) salvando.value = false
  }
}
onBeforeUnmount(() => {
  ativo = false
})
</script>

<style scoped>
.dialogo-custo {
  width: 620px;
  max-width: 95vw;
}
</style>
