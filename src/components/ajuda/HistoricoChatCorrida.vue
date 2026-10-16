<template>
  <section
    class="historico-chat-corrida col column no-wrap"
    role="tabpanel"
    aria-label="Histórico da corrida"
  >
    <div v-if="!corridaId" class="col flex flex-center q-pa-lg text-grey-7">
      <div class="text-center">
        <q-icon name="route" size="48px" color="blue-2" />
        <p class="q-mt-sm">Este ticket não possui uma corrida vinculada.</p>
      </div>
    </div>
    <template v-else>
      <q-banner v-if="erro" dense rounded class="bg-red-1 text-negative q-ma-sm" role="alert">
        {{ erro }}
        <template #action><q-btn flat label="Tentar novamente" @click="atualizar" /></template>
      </q-banner>
      <div v-if="carregando" class="col flex flex-center">
        <q-spinner color="primary" size="32px" />
      </div>
      <div v-else class="col historico-grade">
        <aside class="painel-detalhes bg-grey-1" aria-label="Detalhes da corrida">
          <DetalhesCorrida v-if="corrida" :corrida="corrida" />
          <div v-else class="text-caption text-grey-7 q-pa-md">
            Não foi possível carregar os detalhes da corrida.
          </div>
        </aside>
        <div
          class="painel-conversa column no-wrap"
          aria-label="Conversa entre motorista e passageiro"
        >
          <div class="row items-center justify-between q-pa-md q-gutter-sm">
            <div class="col">
              <div class="text-subtitle1 text-weight-medium">Conversa da corrida</div>
              <div class="text-caption text-grey-7">
                Mensagens entre motorista e passageiro · Somente leitura
              </div>
              <div v-if="corrida" class="text-caption text-grey-7 q-mt-xs">
                {{ corrida.motorista.nome }} · {{ corrida.passageiro.nome }}
              </div>
            </div>
            <q-btn
              flat
              round
              dense
              icon="refresh"
              aria-label="Atualizar conversa da corrida"
              :loading="carregando"
              @click="atualizar"
            />
          </div>
          <q-separator />
          <div ref="mensagensEl" class="col mensagens-corrida q-pa-md" aria-live="polite">
            <div v-if="maisAntigas" class="text-center q-mb-md">
              <q-btn
                flat
                color="primary"
                label="Mensagens anteriores"
                :loading="anteriores"
                @click="carregarAntigas"
              />
            </div>
            <q-chat-message
              v-for="mensagem in mensagens"
              :key="mensagem.id"
              :name="
                mensagem.autor_nome +
                ' · ' +
                (mensagem.autor_tipo === 'motorista' ? 'Motorista' : 'Passageiro')
              "
              :text="[mensagem.conteudo]"
              :stamp="horarioTicket(mensagem.created_at)"
              :sent="mensagem.autor_tipo === 'motorista'"
              :bg-color="mensagem.autor_tipo === 'motorista' ? 'blue-1' : 'grey-2'"
              text-color="grey-10"
            />
            <div v-if="!mensagens.length && !erro" class="text-center text-grey-7 q-pa-lg">
              <q-icon name="forum" size="48px" color="blue-2" />
              <p class="q-mt-sm">
                Nenhuma mensagem registrada entre motorista e passageiro nesta corrida.
              </p>
            </div>
          </div>
          <div class="text-caption text-grey-6 q-px-md q-pb-sm text-right">
            {{ tempoReal ? 'Em tempo real' : 'Atualização periódica' }}
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { toRef } from 'vue'
import DetalhesCorrida from 'src/components/ajuda/DetalhesCorrida.vue'
import { useHistoricoChatCorrida } from 'src/composables/useHistoricoChatCorrida'
import { horarioTicket } from 'src/utils/tickets'
const props = defineProps({
  ticketId: { type: Number, required: true },
  corridaId: { type: Number, default: null },
})
const emit = defineEmits(['acesso-perdido'])
const {
  mensagens,
  corrida,
  carregando,
  anteriores,
  maisAntigas,
  erro,
  mensagensEl,
  tempoReal,
  carregarAntigas,
  atualizar,
} = useHistoricoChatCorrida(toRef(props, 'ticketId'), toRef(props, 'corridaId'), () =>
  emit('acesso-perdido'),
)
</script>

<style scoped>
.historico-chat-corrida {
  min-height: 0;
  min-width: 0;
  container-type: inline-size;
  container-name: historico-corrida;
}
.historico-grade {
  display: grid;
  grid-template-columns: minmax(0, 44%) minmax(0, 56%);
  min-height: 0;
}
.painel-detalhes {
  overflow-y: auto;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #e5eaf0;
}
.painel-conversa {
  min-width: 0;
  min-height: 0;
}
.mensagens-corrida {
  overflow-y: auto;
  overscroll-behavior: contain;
}
.mensagens-corrida :deep(.q-message-text-content) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@container historico-corrida (max-width: 660px) {
  .historico-grade {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .painel-detalhes {
    flex: 0 0 auto;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid #e5eaf0;
  }
  .painel-conversa {
    flex: 0 0 480px;
  }
}
</style>
