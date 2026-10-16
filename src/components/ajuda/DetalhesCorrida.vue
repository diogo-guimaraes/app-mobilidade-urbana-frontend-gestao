<template>
  <div class="detalhes-corrida q-pa-md">
    <div class="resumo-ganhos q-pa-md rounded-borders q-mb-md">
      <div class="row items-center justify-between q-gutter-xs">
        <span class="text-caption text-weight-medium">{{ corrida.codigo_corrida }}</span>
        <q-badge color="white" text-color="primary">{{ rotuloStatus(corrida.status) }}</q-badge>
      </div>
      <div class="text-caption q-mt-md">
        {{ corrida.status === 'finalizada' ? 'Ganho do motorista' : 'Valor do motorista' }}
      </div>
      <div class="valor-destaque text-weight-bold">
        {{ moeda(financeiro?.valor_liquido_motorista) }}
      </div>
      <div class="row q-col-gutter-sm q-mt-sm">
        <div class="col-6">
          <div class="text-caption">Duração</div>
          <div class="text-subtitle1 text-weight-medium">{{ duracao }}</div>
        </div>
        <div class="col-6">
          <div class="text-caption">Distância</div>
          <div class="text-subtitle1 text-weight-medium">{{ distancia }}</div>
        </div>
      </div>
    </div>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-sm">Resumo da corrida</div>
        <div class="linha">
          <span>Tipo de corrida</span
          ><strong>{{ corrida.produto?.nome || 'Não informado' }}</strong>
        </div>
        <div class="linha">
          <span>Pagamento</span
          ><strong>{{
            pagamentos[corrida.metodo_pagamento] || corrida.metodo_pagamento || 'Não informado'
          }}</strong>
        </div>
        <div class="linha">
          <span>Situação</span
          ><strong>{{ rotuloStatus(corrida.status_pagamento) || 'Não informada' }}</strong>
        </div>
        <div v-if="corrida.metodo_pagamento === 'dinheiro'" class="linha">
          <span>Dinheiro recebido</span
          ><strong>{{
            corrida.status_pagamento === 'pago'
              ? moeda(financeiro?.valor_pago_passageiro)
              : 'Não confirmado'
          }}</strong>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-sm">Valores da corrida</div>
        <template v-if="financeiro">
          <div v-for="item in valores" :key="item.campo" class="linha">
            <span>{{ item.label }}</span
            ><strong>{{ moeda(financeiro[item.campo]) }}</strong>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            Adicionais informativos da composição registrada.
          </div>
          <q-separator class="q-my-sm" />
          <div class="linha total">
            <span>Total do motorista</span
            ><strong>{{ moeda(financeiro.valor_liquido_motorista) }}</strong>
          </div>
        </template>
        <div v-else class="text-caption text-grey-7">
          Valores financeiros ainda não registrados.
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-sm">
          {{
            corrida.status_pagamento === 'pago' ? 'Pago pelo passageiro' : 'Cobrado do passageiro'
          }}
        </div>
        <div class="linha total">
          <span>Total</span><strong>{{ moeda(financeiro?.valor_pago_passageiro) }}</strong>
        </div>
        <div v-if="financeiro?.credito_aplicado != null" class="linha">
          <span>Crédito aplicado</span><strong>{{ moeda(financeiro.credito_aplicado) }}</strong>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-sm">Plataforma</div>
        <div class="linha">
          <span
            >Taxa da plataforma<template v-if="financeiro?.taxa_plataforma_percentual != null">
              ({{ percentual(financeiro.taxa_plataforma_percentual) }}%)</template
            ></span
          ><strong>{{ moeda(financeiro?.taxa_plataforma_valor) }}</strong>
        </div>
        <div class="linha">
          <span>Complemento registrado</span
          ><strong>{{ moeda(financeiro?.subsidiado_plataforma) }}</strong>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-sm">Outras cobranças</div>
        <div v-if="Number(financeiro?.taxa_cancelamento) > 0" class="linha">
          <span>Taxa de cancelamento desta corrida</span
          ><strong>{{ moeda(financeiro.taxa_cancelamento) }}</strong>
        </div>
        <div v-else class="text-caption text-grey-7">
          {{
            financeiro
              ? 'Nenhuma taxa adicional registrada.'
              : 'Informações de cobranças ainda não registradas.'
          }}
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cartao-detalhe q-mb-md">
      <q-card-section class="q-pa-md">
        <div class="text-subtitle2 q-mb-md">Detalhes e trajeto</div>
        <div class="participante">
          <q-avatar size="32px" color="blue-1" text-color="primary" icon="person" />
          <div>
            <div class="text-caption text-grey-7">Passageiro</div>
            {{ corrida.passageiro?.nome || 'Não informado' }}
          </div>
        </div>
        <div class="participante q-mt-sm">
          <q-avatar size="32px" color="grey-2" text-color="grey-8" icon="directions_car" />
          <div>
            <div class="text-caption text-grey-7">Motorista</div>
            {{ corrida.motorista?.nome || 'Não informado' }}
          </div>
        </div>
        <div v-if="corrida.veiculo" class="text-caption text-grey-7 q-mt-sm">
          {{ corrida.veiculo.marca }} {{ corrida.veiculo.modelo }} · {{ corrida.veiculo.placa }}
        </div>
        <div v-if="corrida.convidado_nome" class="text-caption q-mt-sm">
          Convidado: {{ corrida.convidado_nome }}
        </div>
        <q-separator class="q-my-md" />
        <div class="text-caption text-grey-7">
          Solicitada em {{ horarioTicket(corrida.solicitada_em) || 'Não informado' }}
        </div>
        <div v-if="corrida.iniciada_em" class="text-caption text-grey-7 q-mt-xs">
          Iniciada em {{ horarioTicket(corrida.iniciada_em) }}
        </div>
        <div v-if="corrida.finalizada_em" class="text-caption text-grey-7 q-mt-xs">
          Finalizada em {{ horarioTicket(corrida.finalizada_em) }}
        </div>
        <div v-if="corrida.motivo_cancelamento" class="text-caption text-orange-9 q-mt-sm">
          {{ corrida.motivo_cancelamento }}
        </div>
        <div class="trajeto q-mt-md">
          <div
            v-for="(destino, index) in corrida.destinos || []"
            :key="destino.id"
            class="ponto-trajeto"
          >
            <span class="marcador" :class="destino.tipo" />
            <div>
              <div class="text-caption text-grey-7">
                {{
                  destino.tipo === 'origem'
                    ? 'Origem'
                    : destino.tipo === 'destino'
                      ? 'Destino'
                      : `Parada ${index}`
                }}
              </div>
              <div>{{ destino.endereco || destino.nome_local }}</div>
            </div>
          </div>
          <div v-if="!corrida.destinos?.length" class="text-caption text-grey-7">
            Endereços ainda não registrados.
          </div>
        </div>
      </q-card-section>
    </q-card>
    <q-card flat bordered class="cartao-detalhe"
      ><q-card-section class="q-pa-md"
        ><MapaCorrida :destinos="corrida.destinos || []" /></q-card-section
    ></q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MapaCorrida from 'src/components/ajuda/MapaCorrida.vue'
import { horarioTicket } from 'src/utils/tickets'
const props = defineProps({ corrida: { type: Object, required: true } })
const financeiro = computed(() => props.corrida.financeiro)
const situacoes = {
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  aceita: 'Aceita',
  motorista_chegou: 'Motorista chegou',
  em_andamento: 'Em andamento',
  solicitada: 'Solicitada',
  em_busca: 'Em busca',
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  pendente: 'Pendente',
  em_aberto: 'Em aberto',
  estornado: 'Estornado',
  estorno_pendente: 'Estorno pendente',
  sem_cobranca: 'Sem cobrança',
  falhou: 'Falhou',
}
const rotuloStatus = (valor) => situacoes[valor] || valor
const pagamentos = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  carteira: 'Carteira',
  saldo_app: 'Saldo no aplicativo',
}
const valores = [
  { campo: 'valor_bruto', label: 'Valor bruto da corrida' },
  { campo: 'valor_dinamico_aplicado', label: 'Preço dinâmico' },
  { campo: 'taxa_espera', label: 'Adicional de espera' },
  { campo: 'valor_ajuste_negociado', label: 'Ajuste negociado' },
  { campo: 'valor_descontos', label: 'Descontos ao passageiro' },
]
const moeda = (valor) =>
  valor == null || valor === '' || !Number.isFinite(Number(valor))
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))
const percentual = (valor) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(valor))
const distancia = computed(() =>
  props.corrida.distancia_km == null
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(props.corrida.distancia_km)} km`,
)
const duracao = computed(() => {
  const valor = props.corrida.duracao_segundos
  if (valor == null) return '—'
  const segundos = Math.max(0, Math.floor(valor))
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  return `${horas ? `${horas}h ` : ''}${minutos}m ${String(segundos % 60).padStart(2, '0')}s`
})
</script>

<style scoped>
.detalhes-corrida {
  min-width: 0;
}
.resumo-ganhos {
  background: linear-gradient(125deg, #e3f2fd, #f3f8ff);
  color: #145a9b;
  border: 1px solid #d9eafa;
}
.valor-destaque {
  font-size: 32px;
  line-height: 1.35;
}
.cartao-detalhe {
  border-radius: 10px;
}
.linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}
.linha > span {
  color: #64748b;
}
.linha > strong {
  text-align: right;
  font-weight: 500;
}
.total {
  font-size: 15px;
}
.total > span,
.total > strong {
  color: #172b4d;
  font-weight: 600;
}
.participante {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.ponto-trajeto {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 18px;
  font-size: 13px;
}
.ponto-trajeto:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 18px;
  bottom: 0;
  width: 1px;
  background: #e0e6ec;
}
.marcador {
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-top: 5px;
  background: #f59e0b;
}
.marcador.origem {
  background: #21ba45;
}
.marcador.destino {
  background: #f44336;
}
</style>
