<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar rounded size="52px" color="green-1" text-color="green-8" icon="sensors" />
        <div class="col">
          <div class="text-caption text-grey-7">Motoristas</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Motoristas online</h1>
          <div class="text-grey-7 q-mt-xs">
            Quem está com o app aberto e mandando a posição agora (sinal de menos de
            {{ prazoSinal }} segundos). <b>Disponível</b> aparece no mapa do passageiro e recebe
            chamadas; <b>em corrida</b> está atendendo e não recebe novas.
          </div>
        </div>
        <div class="text-right text-caption text-grey-7">
          <div>
            <q-icon name="update" /> Atualiza a cada 10 s
            <template v-if="atualizadoEm"> · {{ atualizadoEm }}</template>
          </div>
          <q-btn
            flat
            dense
            no-caps
            icon="refresh"
            label="Atualizar agora"
            :loading="carregando"
            @click="carregar()"
          />
        </div>
      </q-card-section>
    </q-card>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section class="row items-center no-wrap">
            <q-avatar color="green-1" text-color="green-8" icon="check_circle" size="40px" />
            <div class="q-ml-md">
              <div class="text-h5 text-weight-bold">{{ resumo.disponiveis }}</div>
              <div class="text-caption text-grey-7">Disponíveis</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section class="row items-center no-wrap">
            <q-avatar color="orange-1" text-color="orange-9" icon="directions_car" size="40px" />
            <div class="q-ml-md">
              <div class="text-h5 text-weight-bold">{{ resumo.em_corrida }}</div>
              <div class="text-caption text-grey-7">Em corrida</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section class="row items-center no-wrap">
            <q-avatar color="blue-1" text-color="blue-8" icon="sensors" size="40px" />
            <div class="q-ml-md">
              <div class="text-h5 text-weight-bold">
                {{ resumo.disponiveis + resumo.em_corrida }}
              </div>
              <div class="text-caption text-grey-7">Online no total</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card>
      <q-table
        v-model:pagination="paginacao"
        :rows="linhas"
        :columns="colunas"
        row-key="id"
        :loading="carregando"
        :rows-per-page-options="[10, 25, 50]"
        binary-state-sort
        @request="aoPaginar"
      >
        <template #top>
          <q-btn-toggle
            v-model="situacao"
            class="q-mr-md"
            toggle-color="primary"
            no-caps
            :options="[
              { label: 'Disponíveis', value: 'disponiveis' },
              { label: 'Em corrida', value: 'em_corrida' },
              { label: 'Todos', value: 'todos' },
            ]"
            @update:model-value="recomecar"
          />
          <q-space />
          <q-input
            v-model="busca"
            filled
            dense
            debounce="300"
            placeholder="Nome, telefone, placa ou código"
            style="min-width: 280px"
            @update:model-value="recomecar"
          >
            <template v-if="busca" #append>
              <q-icon name="close" class="cursor-pointer" @click="limparBusca" />
            </template>
          </q-input>
        </template>

        <template #body-cell-situacao="props">
          <q-td :props="props">
            <q-badge
              :color="props.row.situacao === 'em_corrida' ? 'orange-8' : 'green-7'"
              :label="props.row.situacao === 'em_corrida' ? 'Em corrida' : 'Disponível'"
            />
          </q-td>
        </template>

        <template #body-cell-motorista="props">
          <q-td :props="props">
            <div class="text-weight-bold">{{ props.row.nome }}</div>
            <div class="text-caption text-grey-7">
              #{{ props.row.id
              }}<template v-if="props.row.telefone"> · {{ props.row.telefone }}</template>
            </div>
          </q-td>
        </template>

        <template #body-cell-veiculo="props">
          <q-td :props="props">
            <template v-if="props.row.veiculo">
              <div>{{ props.row.veiculo.descricao }}</div>
              <div class="text-caption text-grey-7">
                {{ props.row.veiculo.placa }} · {{ props.row.veiculo.categoria }}
              </div>
            </template>
            <span v-else class="text-grey-6">Sem veículo</span>
          </q-td>
        </template>

        <template #body-cell-posicao="props">
          <q-td :props="props">
            <template v-if="props.row.latitude !== null">
              <a
                :href="`https://www.google.com/maps?q=${props.row.latitude},${props.row.longitude}`"
                target="_blank"
                rel="noopener"
              >
                {{ props.row.latitude.toFixed(5) }}, {{ props.row.longitude.toFixed(5) }}
              </a>
            </template>
            <span v-else class="text-grey-6">—</span>
          </q-td>
        </template>

        <template #body-cell-sinal="props">
          <q-td :props="props">{{ haQuanto(props.row.visto_em) }}</q-td>
        </template>

        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            Nenhum motorista online neste filtro.
          </div>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'

const colunas = [
  { name: 'situacao', label: 'Situação', align: 'left' },
  { name: 'motorista', label: 'Motorista', align: 'left' },
  { name: 'veiculo', label: 'Veículo', align: 'left' },
  { name: 'cidade', label: 'Cidade', field: 'cidade', align: 'left' },
  { name: 'posicao', label: 'Posição', align: 'left' },
  { name: 'sinal', label: 'Último sinal', align: 'left' },
]

const linhas = ref([])
const carregando = ref(false)
const situacao = ref('disponiveis')
const busca = ref('')
const resumo = ref({ disponiveis: 0, em_corrida: 0 })
const prazoSinal = ref(90)
const atualizadoEm = ref('')
const agora = ref(Date.now())
const paginacao = ref({ page: 1, rowsPerPage: 25, rowsNumber: 0 })

let versao = 0
let controlador
let relogio

function haQuanto(iso) {
  if (!iso) return '—'
  const segundos = Math.max(0, Math.round((agora.value - new Date(iso).getTime()) / 1000))
  if (segundos < 60) return `há ${segundos} s`
  return `há ${Math.floor(segundos / 60)} min`
}

async function carregar({ silencioso = false } = {}) {
  const minha = ++versao
  controlador?.abort()
  controlador = new AbortController()
  if (!silencioso) carregando.value = true

  try {
    const { data } = await api.get('/motoristas-online', {
      signal: controlador.signal,
      params: {
        situacao: situacao.value,
        search: busca.value || undefined,
        page: paginacao.value.page,
        per_page: paginacao.value.rowsPerPage,
      },
    })
    if (minha !== versao) return
    linhas.value = data.data
    resumo.value = data.resumo
    prazoSinal.value = data.prazo_sinal_segundos
    paginacao.value = { ...paginacao.value, rowsNumber: data.total, page: data.page }
    agora.value = Date.now()
    atualizadoEm.value = new Date().toLocaleTimeString('pt-BR')
  } catch (erro) {
    if (erro.code === 'ERR_CANCELED') return
    // numa falha de rede a lista anterior continua na tela até a próxima tentativa
  } finally {
    if (minha === versao) carregando.value = false
  }
}

function aoPaginar({ pagination }) {
  paginacao.value = { ...paginacao.value, ...pagination }
  carregar()
}

function recomecar() {
  paginacao.value = { ...paginacao.value, page: 1 }
  carregar()
}

function limparBusca() {
  busca.value = ''
  recomecar()
}

let timer
onMounted(() => {
  carregar()
  timer = setInterval(() => carregar({ silencioso: true }), 10_000)
  relogio = setInterval(() => (agora.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearInterval(relogio)
  controlador?.abort()
})
</script>
