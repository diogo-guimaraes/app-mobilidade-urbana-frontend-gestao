<template>
  <q-card flat bordered class="chat-ticket column no-wrap">
    <div v-if="carregando" class="col flex flex-center">
      <q-spinner color="primary" size="40px" />
    </div>
    <template v-else-if="ticket">
      <q-card-section class="q-pb-sm">
        <div class="row items-center q-gutter-sm">
          <q-btn
            v-if="$q.screen.lt.md"
            flat
            round
            icon="arrow_back"
            aria-label="Voltar aos tickets"
            @click="$emit('voltar')"
          />
          <div class="col">
            <div class="text-overline text-primary">{{ ticket.protocolo }}</div>
            <div class="text-h6">{{ motivoTicket(ticket.motivo) }}</div>
          </div>
          <q-badge
            :color="statusTicket(ticket.status).color"
            :label="statusTicket(ticket.status).label"
          />
        </div>
        <div class="row items-center q-gutter-sm q-mt-sm text-grey-8">
          <q-icon :name="ticket.solicitante_tipo === 'motorista' ? 'directions_car' : 'person'" />
          <span
            >{{ ticket.solicitante?.name }} ·
            {{ ticket.solicitante_tipo === 'motorista' ? 'Motorista' : 'Passageiro' }}</span
          >
        </div>
        <div v-if="ticket.corrida" class="text-caption q-mt-xs">
          Código da corrida: {{ ticket.corrida.codigo_corrida || ticket.corrida.id }} ·
          {{ ticket.corrida.status }}
        </div>
        <div class="row items-center justify-between q-mt-md q-gutter-sm">
          <span class="text-caption text-grey-7">{{
            ticket.gestor_responsavel
              ? `Atendimento: ${ticket.gestor_responsavel.name}`
              : 'Aguardando um atendente'
          }}</span>
          <div class="row q-gutter-sm">
            <q-btn
              v-if="podeIniciar"
              outline
              dense
              color="primary"
              label="Iniciar o atendimento"
              :loading="operando"
              @click="acao('assumir')"
            />
            <q-btn
              v-if="!finalizado"
              outline
              dense
              color="primary"
              icon="assignment_ind"
              :label="ticket.gestor_responsavel ? 'Transferir' : 'Designar'"
              :disable="operando"
              @click="transferenciaAberta = true"
            />
            <q-btn
              v-if="podeResponder"
              outline
              dense
              color="positive"
              icon="task_alt"
              label="Finalizar o atendimento"
              :loading="operando"
              :disable="enviando"
              @click="acao('status', 'resolved')"
            />
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-tabs
        v-model="aba"
        dense
        align="left"
        active-color="primary"
        indicator-color="primary"
        narrow-indicator
        class="text-grey-7"
      >
        <q-tab name="mensagens" label="Mensagens" no-caps />
        <q-tab v-if="global" name="transferencias" label="Histórico de transferências" no-caps />
        <q-tab name="cliente" label="Dados do cliente" no-caps />
        <q-tab name="corrida" label="Histórico da corrida" no-caps />
      </q-tabs>
      <q-separator />
      <div
        v-show="aba === 'mensagens'"
        ref="mensagensEl"
        class="col mensagens q-pa-md"
        aria-live="polite"
      >
        <div v-if="maisAntigas" class="text-center q-mb-md">
          <q-btn
            flat
            color="primary"
            label="Mensagens anteriores"
            :loading="historico"
            @click="carregarAntigas"
          />
        </div>
        <template v-for="message in mensagens" :key="message.id">
          <div
            v-if="message.autor_tipo === 'sistema'"
            class="text-center text-caption text-grey-7 q-my-md"
          >
            {{ message.conteudo }}
            <span class="block">{{ horarioTicket(message.updated_at || message.created_at) }}</span>
          </div>
          <q-chat-message
            v-else
            :name="message.autor_nome"
            :stamp="horarioTicket(message.created_at)"
            :sent="message.autor_tipo === 'gestor' && message.gestor_id === auth.user?.id"
            :bg-color="message.autor_tipo === 'gestor' ? 'blue-1' : 'grey-2'"
            text-color="grey-10"
          >
            <div class="conteudo-mensagem">
              <div v-if="message.conteudo">{{ message.conteudo }}</div>
              <ImagemMensagem
                v-for="anexo in message.anexos || []"
                :key="anexo.id"
                :anexo="anexo"
              />
            </div>
          </q-chat-message>
        </template>
      </div>
      <div v-if="aba === 'transferencias' && global" class="col conteudo-aba">
        <HistoricoTransferencias :ticket-id="ticket.id" :atualizacao="revisaoTransferencias" />
      </div>
      <HistoricoChatCorrida
        v-if="aba === 'corrida'"
        :key="ticket.id"
        :ticket-id="ticket.id"
        :corrida-id="ticket.corrida?.id || null"
        @acesso-perdido="$emit('acesso-perdido')"
      />
      <q-card-section v-if="aba === 'cliente'" class="col conteudo-aba q-gutter-md">
        <div>
          <div class="text-caption text-grey-7">Solicitante</div>
          <div class="text-subtitle1">{{ ticket.solicitante?.name }}</div>
        </div>
        <div v-if="ticket.solicitante?.cpf">
          <div class="text-caption text-grey-7">CPF</div>
          <div>{{ ticket.solicitante.cpf }}</div>
        </div>
        <div>
          <div class="text-caption text-grey-7">Perfil</div>
          <div>{{ ticket.solicitante_tipo === 'motorista' ? 'Motorista' : 'Passageiro' }}</div>
        </div>
        <div v-if="ticket.corrida">
          <div class="text-caption text-grey-7">Código da corrida</div>
          <div>{{ ticket.corrida.codigo_corrida || ticket.corrida.id }}</div>
        </div>
        <div>
          <div class="text-caption text-grey-7">Abertura</div>
          <div>{{ horarioTicket(ticket.created_at) }}</div>
        </div>
        <div>
          <div class="text-caption text-grey-7">Descrição inicial</div>
          <div class="descricao-ticket">{{ ticket.descricao }}</div>
        </div>
      </q-card-section>
      <q-separator v-if="aba === 'mensagens'" />
      <q-card-section v-if="aba === 'mensagens'" class="q-pa-sm">
        <q-banner
          v-if="erro && erro !== avisoAtendimento"
          dense
          rounded
          class="bg-red-1 text-negative q-mb-sm"
          role="alert"
          >{{ erro }}</q-banner
        >
        <q-banner
          v-if="!podeResponder"
          dense
          rounded
          class="bg-grey-2 text-grey-8"
          role="status"
          aria-label="Situação do atendimento"
        >
          <template #avatar><q-icon name="info_outline" color="grey-6" /></template>
          {{ avisoAtendimento }}
        </q-banner>
        <template v-else>
          <div v-if="imagens.length" class="row q-gutter-sm q-mb-sm imagens-selecionadas">
            <div
              v-for="(imagem, indice) in imagens"
              :key="imagem.url"
              class="previa-imagem relative-position"
            >
              <q-img
                :src="imagem.url"
                :alt="imagem.arquivo.name"
                fit="cover"
                class="rounded-borders"
                style="width: 80px; height: 64px"
              />
              <q-btn
                round
                dense
                size="xs"
                color="negative"
                icon="close"
                class="absolute-top-right"
                :aria-label="`Remover imagem ${imagem.arquivo.name}`"
                :disable="enviando"
                @click="removerImagem(indice)"
              />
              <q-tooltip>{{ imagem.arquivo.name }}</q-tooltip>
            </div>
          </div>
          <q-form class="row items-end no-wrap q-gutter-sm" @submit="enviar">
            <input
              ref="seletorImagens"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              class="hidden"
              @change="selecionarImagens"
            />
            <q-btn
              flat
              round
              color="primary"
              icon="add_photo_alternate"
              aria-label="Adicionar imagens"
              :disable="enviando || operando || imagens.length >= 3"
              @click="seletorImagens?.click()"
            >
              <q-tooltip>Adicionar imagens ou colar um print com Ctrl + V</q-tooltip>
            </q-btn>
            <q-input
              v-model="texto"
              class="col"
              outlined
              autogrow
              dense
              label="Escreva sua mensagem"
              :maxlength="4000"
              :disable="enviando || operando"
              @keydown.enter="teclaMensagem"
              @paste="colarImagem"
            />
            <q-btn
              color="primary"
              round
              icon="send"
              type="submit"
              aria-label="Enviar mensagem"
              :loading="enviando"
              :disable="operando || (!texto.trim() && !imagens.length)"
            />
          </q-form>
        </template>
        <div class="row justify-between text-caption text-grey-6 q-mt-xs">
          <span v-if="podeResponder" :class="{ invisible: $q.screen.lt.sm }"
            >Enter para enviar · Shift + Enter para quebrar a linha</span
          ><span class="q-ml-auto">{{
            conectadoChat && autenticadoCanal ? 'Em tempo real' : 'Atualização periódica'
          }}</span>
        </div>
      </q-card-section>
      <TransferirTicket
        v-model="transferenciaAberta"
        :ticket="ticket"
        @transferido="confirmarTransferencia"
      />
    </template>
    <div v-else class="col flex flex-center q-pa-lg text-grey-7">
      <div class="text-center">
        <q-icon name="forum" size="64px" color="blue-2" />
        <p class="q-mt-md">{{ erro || 'Selecione um ticket para iniciar o atendimento.' }}</p>
        <q-btn v-if="erro" flat color="primary" label="Tentar novamente" @click="abrir(ticketId)" />
      </div>
    </div>
  </q-card>
</template>

<script setup>
import { computed, ref, toRef, watch, nextTick } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useChatTicket } from 'src/composables/useChatTicket'
import { conectadoChat } from 'src/services/echo'
import { statusTicket, motivoTicket, horarioTicket, gestaoGlobalTickets } from 'src/utils/tickets'
import TransferirTicket from 'src/components/ajuda/TransferirTicket.vue'
import HistoricoTransferencias from 'src/components/ajuda/HistoricoTransferencias.vue'
import ImagemMensagem from 'src/components/ajuda/ImagemMensagem.vue'
import HistoricoChatCorrida from 'src/components/ajuda/HistoricoChatCorrida.vue'

const props = defineProps({ ticketId: { type: Number, default: null } })
const emit = defineEmits([
  'atualizado',
  'voltar',
  'transferido',
  'acesso-perdido',
  'finalizado',
  'lido',
])
const auth = useAuthStore()
const aba = ref('mensagens')
const {
  ticket,
  mensagens,
  carregando,
  enviando,
  historico,
  maisAntigas,
  erro,
  texto,
  imagens,
  adicionarImagens,
  removerImagem,
  operando,
  podeResponder,
  autenticadoCanal,
  abrir,
  antigas,
  enviar,
  acao,
  sincronizar,
  revisaoTransferencias,
} = useChatTicket(
  toRef(props, 'ticketId'),
  () => emit('atualizado'),
  () => emit('acesso-perdido'),
  (leitura) => emit('lido', leitura),
  computed(() => aba.value === 'mensagens'),
)
const mensagensEl = ref(null)
const seletorImagens = ref(null)
function teclaMensagem(evento) {
  if (evento.isComposing || evento.keyCode === 229) return
  if (evento.shiftKey) return
  evento.preventDefault()
  if (!evento.repeat && !evento.ctrlKey && !evento.altKey && !evento.metaKey) enviar()
}
function selecionarImagens(evento) {
  adicionarImagens(Array.from(evento.target.files || []))
  evento.target.value = ''
}
function colarImagem(evento) {
  if (!podeResponder.value || operando.value || enviando.value) return
  const arquivos = Array.from(evento.clipboardData?.files || []).filter((arquivo) =>
    arquivo.type.startsWith('image/'),
  )
  if (!arquivos.length) return
  evento.preventDefault()
  adicionarImagens(arquivos)
}
const transferenciaAberta = ref(false)
const global = computed(() => gestaoGlobalTickets(auth.user))
const finalizado = computed(() => statusTicket(ticket.value?.status).value === 'resolved')
const podeIniciar = computed(
  () =>
    !finalizado.value &&
    (!ticket.value?.gestor_responsavel ||
      (ticket.value.status !== 'in_progress' &&
        ticket.value.gestor_responsavel.id === auth.user?.id) ||
      (global.value && ticket.value.gestor_responsavel.id !== auth.user?.id)),
)
const avisoAtendimento = computed(() => {
  if (finalizado.value)
    return 'Atendimento finalizado. O histórico continua disponível para consulta.'
  if (ticket.value?.gestor_responsavel && ticket.value.gestor_responsavel.id !== auth.user?.id)
    return `Este atendimento está com ${ticket.value.gestor_responsavel.name}. Você pode consultar o histórico.`
  return 'Inicie o atendimento antes de responder este ticket.'
})
watch(
  () => props.ticketId,
  () => {
    aba.value = 'mensagens'
    transferenciaAberta.value = false
  },
)
watch(global, (value) => {
  if (!value && aba.value === 'transferencias') aba.value = 'mensagens'
})
watch(
  () => ticket.value?.status,
  (status) => {
    if (statusTicket(status).value === 'resolved') emit('finalizado', ticket.value)
  },
)
async function confirmarTransferencia(registro) {
  emit('transferido', registro)
  revisaoTransferencias.value++
  await sincronizar()
}
watch(
  () => mensagens.value.at(-1)?.id,
  async () => {
    await nextTick()
    if (mensagensEl.value) mensagensEl.value.scrollTop = mensagensEl.value.scrollHeight
  },
)
async function carregarAntigas() {
  const previous = mensagensEl.value?.scrollHeight || 0
  const top = mensagensEl.value?.scrollTop || 0
  await antigas()
  await nextTick()
  if (mensagensEl.value)
    mensagensEl.value.scrollTop = top + mensagensEl.value.scrollHeight - previous
}
</script>

<style scoped>
.chat-ticket {
  height: calc(100dvh - 174px);
  min-height: 420px;
}
.mensagens {
  overflow-y: auto;
  overscroll-behavior: contain;
}
.conteudo-aba {
  overflow-y: auto;
}
.descricao-ticket {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mensagens :deep(.q-message-text-content) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 1023px) {
  .chat-ticket {
    height: calc(100dvh - 90px);
    min-height: 0;
  }
}
</style>
