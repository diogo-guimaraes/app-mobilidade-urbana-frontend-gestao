<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="cabecalho q-mb-lg">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar rounded size="52px" color="indigo-1" text-color="indigo" icon="alt_route" />
        <div class="col">
          <div class="text-caption text-grey-7">Configurações</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Despacho de chamadas</h1>
          <div class="text-grey-7 q-mt-xs">
            Define quem recebe o cartão de chamada. Cada corrida monta uma fila de motoristas
            próximos, ordenada por pontuação, e a chamada toca para um de cada vez.
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-expansion-item
      class="cartao q-mb-lg"
      header-class="text-weight-bold"
      icon="help_outline"
      label="Como a chamada chega ao motorista"
      default-opened
    >
      <q-card flat bordered>
        <q-card-section class="text-body2">
          <ol class="q-my-none q-pl-md">
            <li>
              <b>O pedido nasce:</b> o passageiro pede e a corrida fica como <i>solicitada</i>, sem
              motorista. Ela já aparece em
              <router-link to="/dinamica">Pedidos abertos por bairro</router-link>
              (só acompanhamento, não escolhe motorista).
            </li>
            <li>
              <b>Os candidatos:</b> motoristas online (vistos nos últimos 90 s), dentro do raio,
              livres (sem corrida, sem outra chamada tocando e fora do descanso após recusa) e acima
              dos mínimos de nota, aceitação e finalização definidos aqui.
            </li>
            <li>
              <b>A pontuação:</b> cada candidato ganha pontos por proximidade, nota, aceitação,
              finalização e região quente, com os pesos desta página. Entram os
              {{ form.maximo_candidatos }} melhores.
            </li>
            <li>
              <b>A chamada:</b> o cartão toca só para o primeiro do ranking, pelo tempo do cartão.
              Se ele recusa ou o tempo acaba, passa para o próximo; esgotada a rodada, a fila
              recomeça.
            </li>
            <li>
              <b>Tela Solicitações:</b> os demais motoristas habilitados veem o pedido na lista, sem
              tocar. Quem aceitar primeiro leva; para os outros o card mostra
              <i>Pedido expirado</i> e some.
            </li>
            <li>
              <b>Exceções:</b> Negocia (o passageiro escolhe entre propostas) e viagem compartilhada
              não usam a fila. Com a fila desligada, todos do raio recebem ao mesmo tempo.
            </li>
          </ol>
          <div class="text-caption text-grey-7 q-mt-sm">
            A fila avança quando algum app de motorista consulta as corridas disponíveis. Na
            simulação, motoristas simulados só disputam pedidos simulados, a menos que o interruptor
            da página Dinâmica permita disputar os reais.
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>

    <div v-if="carregando" class="text-center q-pa-xl" role="status">
      <q-spinner color="primary" size="36px" />
      <div class="q-mt-sm">Carregando regras...</div>
    </div>
    <q-banner v-else-if="erro" rounded class="bg-red-1 text-negative">
      {{ erro }}
      <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
    </q-banner>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-7">
        <q-card flat bordered class="cartao q-mb-lg">
          <q-card-section>
            <q-toggle
              v-model="form.fila_ativa"
              :disable="salvando"
              label="Fila de prioridade ligada"
            />
            <div class="text-caption text-grey-7 q-mb-md">
              Desligada, toda corrida aparece para todos os motoristas do raio, um cartão atrás do
              outro (como era antes). Negociação e viagem compartilhada nunca usam a fila.
            </div>

            <div class="text-subtitle1 text-weight-bold q-mb-sm">Tempos</div>
            <div class="row q-col-gutter-md">
              <div v-for="campo in TEMPOS" :key="campo.chave" class="col-12 col-sm-6">
                <q-input
                  v-model.number="form[campo.chave]"
                  type="number"
                  outlined
                  dense
                  :label="campo.rotulo"
                  suffix="s"
                  :hint="campo.ajuda"
                  :min="limites[campo.chave]?.minimo"
                  :max="limites[campo.chave]?.maximo"
                  :rules="[regraDe(campo.chave)]"
                  :disable="salvando"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.maximo_candidatos"
                  type="number"
                  outlined
                  dense
                  label="Motoristas por rodada"
                  hint="Quantos são chamados antes da fila recomeçar"
                  :rules="[regraDe('maximo_candidatos')]"
                  :disable="salvando"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="cartao q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-xs">Quem pode entrar na fila</div>
            <div class="text-grey-7 q-mb-md">
              Motorista abaixo de qualquer mínimo não recebe a chamada. Use 0 para não exigir.
            </div>
            <div class="row q-col-gutter-md">
              <div v-for="campo in FILTROS" :key="campo.chave" class="col-12 col-sm-4">
                <q-input
                  v-model.number="form[campo.chave]"
                  type="number"
                  outlined
                  dense
                  :label="campo.rotulo"
                  :suffix="campo.sufixo"
                  :step="campo.passo"
                  :hint="campo.ajuda"
                  :rules="[regraDe(campo.chave)]"
                  :disable="salvando"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="cartao">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-xs">Peso de cada critério</div>
            <div class="text-grey-7 q-mb-md">
              A pontuação é a média ponderada dos critérios. Os pesos valem só uns em relação aos
              outros: o que importa é a participação de cada um.
            </div>
            <div v-for="peso in PESOS" :key="peso.chave" class="q-mb-md">
              <div class="row items-center">
                <div class="col text-weight-medium">{{ peso.rotulo }}</div>
                <q-badge color="indigo-1" text-color="indigo" class="q-px-sm">
                  {{ participacao(peso.chave) }}%
                </q-badge>
              </div>
              <q-slider
                v-model="form[peso.chave]"
                :min="0"
                :max="100"
                :step="5"
                color="indigo"
                :disable="salvando"
              />
              <div class="text-caption text-grey-7">{{ peso.ajuda }}</div>
            </div>
            <q-banner v-if="somaDosPesos === 0" rounded class="bg-orange-1 text-orange-9">
              Com todos os pesos em 0, a ordem da fila passa a ser só pela distância.
            </q-banner>

            <div class="row q-gutter-sm q-mt-md">
              <q-btn
                color="primary"
                no-caps
                label="Salvar regras"
                :loading="salvando"
                :disable="!alterado || !tudoValido"
                @click="salvar"
              />
              <q-btn
                flat
                no-caps
                label="Restaurar padrão"
                :disable="salvando"
                @click="form = { ...padroes }"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-5">
        <q-card flat bordered class="cartao q-mb-lg">
          <q-card-section>
            <div class="text-h6 text-weight-bold">Como a chamada é decidida</div>
            <ol class="text-grey-7 q-pl-md q-mb-none">
              <li>
                Entram na fila motoristas online dentro do raio de busca, livres (sem corrida nem
                outra chamada tocando) e acima dos mínimos.
              </li>
              <li>
                Ordenados pela pontuação: proximidade do embarque, nota, taxa de aceitação, taxa de
                finalização e demanda da região onde o motorista está.
              </li>
              <li>O cartão toca só para o primeiro, pelo tempo configurado.</li>
              <li>
                Se ele recusar (X) ou deixar passar, a chamada vai para o próximo; ele descansa
                antes de receber outra.
              </li>
              <li>
                Passou por todos sem aceite? A fila recomeça depois da espera e o raio de busca
                continua crescendo.
              </li>
            </ol>
            <div class="text-caption text-grey-7 q-mt-md">
              Ainda não usados: sentido do deslocamento, demanda no destino, risco da corrida e
              regras por categoria (alvará de táxi etc.).
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="cartao">
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6 text-weight-bold col">Ao vivo</div>
              <q-chip
                v-for="(total, resultado) in painel.ultima_hora"
                :key="resultado"
                dense
                :color="corDoResultado(resultado)"
                text-color="white"
              >
                {{ rotuloDoResultado(resultado) }}: {{ total }}
              </q-chip>
            </div>
            <div class="text-caption text-grey-7 q-mb-sm">Última hora · atualiza a cada 4 s</div>

            <div class="text-subtitle2 q-mb-xs">Tocando agora</div>
            <q-markup-table flat dense separator="horizontal" class="q-mb-md">
              <thead>
                <tr>
                  <th class="text-left">Corrida</th>
                  <th class="text-left">Motorista</th>
                  <th>Posição</th>
                  <th>Pontos</th>
                  <th>Resta</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in painel.tocando" :key="c.id">
                  <td>{{ c.corrida }}</td>
                  <td>
                    {{ c.motorista }}
                    <q-badge v-if="!c.simulado" color="primary" label="real" />
                  </td>
                  <td class="text-center">{{ c.posicao }}º</td>
                  <td class="text-center">{{ c.pontuacao }}</td>
                  <td class="text-center">{{ c.segundos_restantes }}s</td>
                </tr>
                <tr v-if="!painel.tocando.length">
                  <td colspan="5" class="text-grey-7">Nenhuma chamada tocando.</td>
                </tr>
              </tbody>
            </q-markup-table>

            <div class="text-subtitle2 q-mb-xs">Últimas respostas</div>
            <q-markup-table flat dense separator="horizontal">
              <thead>
                <tr>
                  <th class="text-left">Corrida</th>
                  <th class="text-left">Motorista</th>
                  <th>Posição</th>
                  <th class="text-left">Resultado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in painel.recentes" :key="c.id">
                  <td>{{ c.corrida }}</td>
                  <td>
                    {{ c.motorista }}
                    <q-badge v-if="!c.simulado" color="primary" label="real" />
                  </td>
                  <td class="text-center">{{ c.posicao }}º</td>
                  <td>
                    <q-badge
                      :color="corDoResultado(c.resultado)"
                      :label="rotuloDoResultado(c.resultado)"
                    />
                  </td>
                </tr>
                <tr v-if="!painel.recentes.length">
                  <td colspan="4" class="text-grey-7">Sem chamadas ainda.</td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const carregando = ref(false)
const salvando = ref(false)
const erro = ref('')

const TEMPOS = [
  {
    chave: 'tempo_cartao_segundos',
    rotulo: 'Tempo do cartão',
    ajuda: 'Quanto a chamada toca para um motorista',
  },
  {
    chave: 'pausa_apos_recusa_segundos',
    rotulo: 'Descanso após recusar',
    ajuda: 'Sem nova chamada depois de recusar ou deixar passar',
  },
  {
    chave: 'espera_nova_rodada_segundos',
    rotulo: 'Espera para recomeçar a fila',
    ajuda: 'Depois que todos foram chamados',
  },
]

const FILTROS = [
  { chave: 'nota_minima', rotulo: 'Nota mínima', sufixo: '★', passo: 0.1, ajuda: '0 a 5' },
  { chave: 'taxa_aceitacao_minima', rotulo: 'Aceitação mínima', sufixo: '%', passo: 5, ajuda: '' },
  {
    chave: 'taxa_finalizacao_minima',
    rotulo: 'Finalização mínima',
    sufixo: '%',
    passo: 5,
    ajuda: '',
  },
]

const PESOS = [
  {
    chave: 'peso_proximidade',
    rotulo: 'Proximidade do embarque',
    ajuda: 'Quem está mais perto do passageiro sobe na fila.',
  },
  {
    chave: 'peso_nota',
    rotulo: 'Nota do motorista',
    ajuda: 'De 3 a 5 estrelas: quanto mais alta, mais pontos.',
  },
  {
    chave: 'peso_aceitacao',
    rotulo: 'Taxa de aceitação',
    ajuda: 'Quem recusa muito perde prioridade.',
  },
  {
    chave: 'peso_finalizacao',
    rotulo: 'Taxa de finalização',
    ajuda: 'Cancelar depois de aceitar derruba a posição.',
  },
  {
    chave: 'peso_demanda',
    rotulo: 'Demanda da região',
    ajuda: 'Motorista dentro de uma região com preço dinâmico ganha pontos.',
  },
]

const form = ref({})
const padroes = ref({})
const salva = ref({})
const limites = ref({})

const painel = reactive({ tocando: [], recentes: [], ultima_hora: {} })
let temporizador = null

const iguais = (a, b) => Object.keys(a).every((k) => Number(a[k]) === Number(b[k]))
const alterado = computed(() => !iguais(form.value, salva.value))

const somaDosPesos = computed(() =>
  PESOS.reduce((total, peso) => total + Number(form.value[peso.chave] || 0), 0),
)

const participacao = (chave) =>
  somaDosPesos.value === 0 ? 0 : Math.round((Number(form.value[chave]) / somaDosPesos.value) * 100)

function regraDe(chave) {
  return (valor) => {
    const { minimo, maximo } = limites.value[chave] ?? { minimo: 0, maximo: 100 }
    const numero = Number(valor)
    if (valor === '' || valor === null || Number.isNaN(numero)) return 'Informe um valor'
    return numero >= minimo && numero <= maximo ? true : `De ${minimo} a ${maximo}`
  }
}

const tudoValido = computed(() =>
  [...TEMPOS, ...FILTROS, { chave: 'maximo_candidatos' }].every(
    (campo) => regraDe(campo.chave)(form.value[campo.chave]) === true,
  ),
)

const ROTULOS = {
  tocando: 'Tocando',
  aceita: 'Aceita',
  recusada: 'Recusada',
  ignorada: 'Sem resposta',
  descartada: 'Descartada',
  atendida_por_outro: 'Outro aceitou',
}
const CORES = {
  tocando: 'primary',
  aceita: 'positive',
  recusada: 'negative',
  ignorada: 'orange',
  descartada: 'grey',
  atendida_por_outro: 'blue-grey',
}
const rotuloDoResultado = (resultado) => ROTULOS[resultado] ?? resultado
const corDoResultado = (resultado) => CORES[resultado] ?? 'grey'

function aplicar(dados) {
  const regras = { ...dados.regras, fila_ativa: Boolean(dados.regras.fila_ativa) }
  form.value = { ...regras }
  salva.value = { ...regras }
  padroes.value = { ...dados.padroes, fila_ativa: Boolean(dados.padroes.fila_ativa) }
  limites.value = dados.limites
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    aplicar((await api.get('/despacho/regras')).data)
    await atualizarPainel()
  } catch (e) {
    erro.value = e.response?.data?.message || 'Não foi possível carregar as regras.'
  } finally {
    carregando.value = false
  }
}

async function salvar() {
  if (!tudoValido.value) return
  salvando.value = true
  try {
    const { data } = await api.put('/despacho/regras', {
      ...form.value,
      fila_ativa: form.value.fila_ativa ? 1 : 0,
    })
    aplicar(data)
    $q.notify({ type: 'positive', message: 'Regras de despacho salvas.' })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível salvar.',
    })
  } finally {
    salvando.value = false
  }
}

async function atualizarPainel() {
  try {
    Object.assign(painel, (await api.get('/despacho/painel')).data)
  } catch {
    // o painel é só acompanhamento: sem ele a tela continua
  }
}

onMounted(() => {
  carregar()
  temporizador = setInterval(atualizarPainel, 4000)
})

onBeforeUnmount(() => clearInterval(temporizador))
</script>

<style scoped>
.cabecalho,
.cartao {
  border-radius: 14px;
}
</style>
