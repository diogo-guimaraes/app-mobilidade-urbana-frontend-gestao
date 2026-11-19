<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar rounded size="52px" color="amber-2" text-color="amber-9" icon="local_taxi" />
        <div class="col">
          <div class="text-caption text-grey-7">Configurações</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Produtos de corrida</h1>
          <div class="text-grey-7 q-mt-xs">
            Os produtos são as modalidades que oferecemos. Os <b>ativos</b> aparecem em
            <i>Escolha uma ou mais categorias</i> no app do passageiro. A lista pode ser definida
            por <b>estado</b> ou por <b>cidade</b>: se a cidade tem lista própria, só ela vale; se
            não, vale a do estado; se também não, valem todos os ativos. Cada produto precisa de uma
            <b>tarifa</b> (página Tarifas) para aparecer com preço.
          </div>
        </div>
        <q-btn
          color="primary"
          no-caps
          icon="add"
          label="Novo produto"
          @click="abrirFormulario(null)"
        />
      </q-card-section>
    </q-card>

    <q-card class="q-mb-md">
      <q-table
        :rows="produtos"
        :columns="colunas"
        row-key="id"
        :loading="carregando"
        :rows-per-page-options="[0]"
        hide-pagination
        flat
      >
        <template #body="props">
          <q-tr :props="props" :class="{ 'text-grey-6': !props.row.ativo }">
            <q-td key="icone" style="width: 64px">
              <div class="icone-caixa">
                <span v-if="props.row.icone?.tipo === 'emoji'" class="icone-emoji">{{
                  props.row.icone.valor
                }}</span>
                <img v-else-if="props.row.icone" :src="props.row.icone.valor" class="icone-img" />
                <q-icon v-else name="image_not_supported" color="grey-5" size="22px" />
              </div>
            </q-td>
            <q-td key="produto">
              <div class="text-weight-bold">{{ props.row.nome }}</div>
              <div class="text-caption text-grey-7">
                <q-badge outline color="grey-8" class="q-mr-xs">{{ props.row.codigo }}</q-badge>
                {{ props.row.descricao }}
              </div>
            </q-td>
            <q-td key="tipo">
              <div>
                {{
                  ESTRATEGIAS[props.row.estrategia_precificacao] ??
                  props.row.estrategia_precificacao
                }}
              </div>
              <div class="text-caption text-grey-7">
                {{ props.row.tipo_veiculo ? VEICULOS[props.row.tipo_veiculo] : 'Qualquer veículo' }}
                <template v-if="props.row.requisito_veiculo">
                  · exige {{ props.row.requisito_veiculo }}</template
                >
                <template v-if="props.row.prioritario"> · prioritário</template>
              </div>
            </q-td>
            <q-td key="ordem" class="text-center">{{ props.row.ordem }}</q-td>
            <q-td key="tarifas" class="text-center">
              <q-badge
                v-if="props.row.tarifas === 0 && props.row.codigo !== 'compartilhada'"
                color="orange-8"
                label="sem tarifa"
              />
              <template v-else>{{ props.row.tarifas || '—' }}</template>
            </q-td>
            <q-td key="regioes">
              <span
                v-if="!props.row.regioes.estados && !props.row.regioes.cidades"
                class="text-grey-6"
                >—</span
              >
              <span v-else class="text-caption">
                {{ props.row.regioes.estados }} estado(s) · {{ props.row.regioes.cidades }}
                cidade(s)
              </span>
            </q-td>
            <q-td key="ativo" class="text-center">
              <q-toggle
                dense
                :model-value="props.row.ativo"
                :label="props.row.ativo ? 'Ativo' : 'Desativado'"
                @update:model-value="(v) => alternar(props.row, v)"
              />
            </q-td>
            <q-td key="acoes" class="text-center">
              <q-btn
                flat
                round
                dense
                icon="edit"
                aria-label="Editar produto"
                @click="abrirFormulario(props.row)"
              >
                <q-tooltip>Editar</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                color="negative"
                icon="delete"
                aria-label="Excluir produto"
                @click="excluir(props.row)"
              >
                <q-tooltip>Excluir</q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">Nenhum produto cadastrado.</div>
        </template>
      </q-table>
    </q-card>

    <!-- lista por região -->
    <q-card>
      <q-card-section>
        <div class="text-h6">Lista por estado ou cidade</div>
        <div class="text-grey-7">
          Escolha onde definir a lista. Sem lista própria a região herda: a cidade usa a do estado e
          o estado usa todos os produtos ativos.
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="row q-col-gutter-md items-center">
        <div class="col-12 col-sm-auto">
          <q-btn-toggle
            v-model="regiao.tipo"
            no-caps
            toggle-color="primary"
            :options="[
              { label: 'Estado', value: 'estado' },
              { label: 'Cidade', value: 'cidade' },
            ]"
            @update:model-value="trocarTipoDeRegiao"
          />
        </div>
        <div class="col-12 col-sm">
          <q-select
            v-if="regiao.tipo === 'estado'"
            v-model="regiao.id"
            outlined
            dense
            emit-value
            map-options
            label="Estado"
            :options="estadosOpcoes"
            option-value="id"
            option-label="rotulo"
            @update:model-value="carregarRegiao"
          />
          <q-select
            v-else
            v-model="regiao.id"
            outlined
            dense
            use-input
            emit-value
            map-options
            label="Cidade"
            :options="cidadesFiltradas"
            option-value="id"
            option-label="rotulo"
            @filter="filtrarCidades"
            @update:model-value="carregarRegiao"
          />
        </div>
      </q-card-section>

      <template v-if="regiao.id">
        <q-separator />
        <q-card-section v-if="regiao.carregando" class="text-center"
          ><q-spinner size="28px"
        /></q-card-section>
        <q-card-section v-else>
          <q-banner rounded class="bg-blue-1 text-grey-9 q-mb-md">
            <template v-if="regiao.propria">
              Esta {{ regiao.tipo }} tem <b>lista própria</b>: só os produtos marcados abaixo
              aparecem para o passageiro dela.
            </template>
            <template v-else>
              Esta {{ regiao.tipo }} <b>não tem lista própria</b>. Hoje vale
              <b>{{ ROTULO_ORIGEM[regiao.origemEfetiva] }}</b
              >. Ative a lista própria para escolher.
            </template>
          </q-banner>

          <q-toggle
            v-model="regiao.propria"
            :label="`Usar lista própria desta ${regiao.tipo}`"
            class="q-mb-sm"
            @update:model-value="aoAlternarListaPropria"
          />

          <div class="row q-col-gutter-sm">
            <div
              v-for="produto in produtosAtivos"
              :key="produto.id"
              class="col-12 col-sm-6 col-md-4"
            >
              <q-checkbox
                v-model="regiao.selecionados"
                :val="produto.id"
                :disable="!regiao.propria"
                :label="produto.nome"
              />
            </div>
          </div>
          <div v-if="produtos.some((p) => !p.ativo)" class="text-caption text-grey-7 q-mt-sm">
            Produtos desativados não aparecem em lugar nenhum, mesmo marcados.
          </div>

          <div class="q-mt-md">
            <q-btn
              color="primary"
              no-caps
              icon="save"
              label="Salvar lista"
              :loading="regiao.salvando"
              @click="salvarRegiao"
            />
          </div>
        </q-card-section>
      </template>
    </q-card>

    <!-- formulário -->
    <q-dialog v-model="formulario.aberto" persistent>
      <q-card style="width: 720px; max-width: 95vw">
        <q-form @submit.prevent="salvar">
          <q-card-section class="row items-center">
            <div class="text-h6">{{ formulario.id ? 'Editar produto' : 'Novo produto' }}</div>
            <q-space />
            <q-btn v-close-popup flat round dense icon="close" />
          </q-card-section>

          <q-card-section class="q-pt-none scroll" style="max-height: 70vh">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-7">
                <q-input
                  v-model="formulario.nome"
                  outlined
                  dense
                  label="Nome (como o passageiro vê)"
                  maxlength="60"
                  :rules="[(v) => !!(v || '').trim() || 'Informe o nome']"
                />
              </div>
              <div class="col-12 col-sm-5">
                <q-input
                  v-model="formulario.codigo"
                  outlined
                  dense
                  label="Código"
                  hint="Não muda depois de criado"
                  :disable="!!formulario.id"
                  :rules="[(v) => /^[a-z0-9_]{2,40}$/.test(v || '') || 'Minúsculas, números e _']"
                  @update:model-value="(v) => (formulario.codigo = (v || '').toLowerCase())"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="formulario.descricao"
                  outlined
                  dense
                  label="Descrição (linha de apoio no app)"
                  maxlength="120"
                  clearable
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-select
                  v-model="formulario.estrategia_precificacao"
                  outlined
                  dense
                  emit-value
                  map-options
                  label="Como o preço funciona"
                  :options="estrategiasOpcoes"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-select
                  v-model="formulario.tipo_veiculo"
                  outlined
                  dense
                  emit-value
                  map-options
                  clearable
                  label="Veículo"
                  :options="[
                    { label: 'Carro', value: 'carro' },
                    { label: 'Moto', value: 'moto' },
                  ]"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-select
                  v-model="formulario.requisito_veiculo"
                  outlined
                  dense
                  emit-value
                  map-options
                  clearable
                  label="Exige"
                  :options="[
                    { label: 'Táxi', value: 'taxi' },
                    { label: 'Elétrico', value: 'eletrico' },
                  ]"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model="formulario.grupo"
                  outlined
                  dense
                  label="Grupo"
                  hint="Agrupa produtos parecidos"
                  clearable
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="formulario.ordem"
                  type="number"
                  outlined
                  dense
                  label="Ordem"
                  :rules="[(v) => (v >= 0 && v <= 999) || '0 a 999']"
                />
              </div>
              <div class="col-12 col-sm-5 row items-center q-gutter-md">
                <q-toggle v-model="formulario.prioritario" label="Prioritário" />
                <q-toggle v-model="formulario.ativo" label="Ativo" />
              </div>
            </div>

            <div class="text-subtitle2 q-mt-md q-mb-sm">Ícone</div>
            <q-btn-toggle
              v-model="formulario.icone_tipo"
              spread
              no-caps
              toggle-color="primary"
              class="q-mb-md"
              :options="[
                { label: 'Nenhum', value: null },
                { label: 'Emoji', value: 'emoji' },
                { label: 'URL', value: 'url' },
                { label: 'Imagem', value: 'imagem' },
              ]"
            />
            <div class="row q-col-gutter-md items-center">
              <div class="col">
                <q-input
                  v-if="formulario.icone_tipo === 'emoji'"
                  v-model="formulario.icone_valor"
                  outlined
                  dense
                  label="Emoji"
                  hint="Ex.: 🚗 🏍️ 📦"
                  maxlength="16"
                  :rules="[(v) => !!(v || '').trim() || 'Informe um emoji']"
                />
                <q-input
                  v-else-if="formulario.icone_tipo === 'url'"
                  v-model="formulario.icone_valor"
                  outlined
                  dense
                  label="URL da imagem"
                  hint="Começa com https://"
                  :rules="[(v) => /^https?:\/\/\S+$/i.test(v || '') || 'URL inválida']"
                />
                <q-file
                  v-else-if="formulario.icone_tipo === 'imagem'"
                  v-model="formulario.arquivo"
                  outlined
                  dense
                  accept=".png,.jpg,.jpeg,.webp"
                  max-file-size="2097152"
                  label="Enviar imagem (PNG, JPG ou WebP, até 2 MB)"
                  :rules="[(v) => !!v || !!formulario.imagem_atual || 'Envie a imagem']"
                  @rejected="aoRejeitarArquivo"
                >
                  <template #prepend><q-icon name="attach_file" /></template>
                </q-file>
                <div v-else class="text-grey-7">
                  Sem ícone, o app usa a arte padrão da categoria.
                </div>
              </div>
              <div class="col-auto">
                <div class="icone-previa">
                  <span v-if="previa?.tipo === 'emoji'" class="icone-emoji">{{
                    previa.valor
                  }}</span>
                  <img v-else-if="previa" :src="previa.valor" class="icone-img" />
                  <q-icon v-else name="image" color="grey-5" size="28px" />
                </div>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right" class="q-pa-md">
            <q-btn v-close-popup flat no-caps label="Cancelar" />
            <q-btn
              type="submit"
              color="primary"
              no-caps
              label="Salvar"
              :loading="formulario.salvando"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()

const ESTRATEGIAS = {
  normal: 'Normal',
  negociada: 'Negocia (passageiro propõe)',
  taxi: 'Táxi',
  eletrico: 'Elétrico',
  entrega: 'Entrega',
}
const VEICULOS = { carro: 'Carro', moto: 'Moto' }
const ROTULO_ORIGEM = {
  cidade: 'a lista da cidade',
  estado: 'a lista do estado',
  geral: 'todos os produtos ativos',
}
const estrategiasOpcoes = Object.entries(ESTRATEGIAS).map(([value, label]) => ({ value, label }))

const colunas = [
  { name: 'icone', label: '', align: 'left' },
  { name: 'produto', label: 'Produto', align: 'left' },
  { name: 'tipo', label: 'Tipo', align: 'left' },
  { name: 'ordem', label: 'Ordem', align: 'center' },
  { name: 'tarifas', label: 'Tarifas', align: 'center' },
  { name: 'regioes', label: 'Listas por região', align: 'left' },
  { name: 'ativo', label: 'Situação', align: 'center' },
  { name: 'acoes', label: 'Ações', align: 'center' },
]

function mensagemDoErro(e, padrao) {
  const erros = e.response?.data?.errors
  return (erros && Object.values(erros)[0]?.[0]) || e.response?.data?.message || padrao
}

// ---- produtos
const produtos = ref([])
const carregando = ref(false)
const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo))

async function carregar() {
  carregando.value = true
  try {
    const { data } = await api.get('/produtos-corridas')
    produtos.value = data.data
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: mensagemDoErro(e, 'Não foi possível carregar os produtos.'),
    })
  } finally {
    carregando.value = false
  }
}

async function alternar(produto, ativo) {
  try {
    await api.put(`/produtos-corridas/${produto.id}`, { ativo })
    produto.ativo = ativo
    if (regiao.id) await carregarRegiao()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: mensagemDoErro(e, 'Não foi possível alterar o produto.'),
    })
  }
}

function excluir(produto) {
  $q.dialog({
    title: 'Excluir produto',
    message: `Excluir "${produto.nome}" e as tarifas dele? Se já houve corridas com ele, desative em vez de excluir.`,
    cancel: true,
    persistent: true,
    ok: { label: 'Excluir', color: 'negative' },
  }).onOk(async () => {
    try {
      await api.delete(`/produtos-corridas/${produto.id}`)
      $q.notify({ type: 'positive', message: 'Produto excluído.' })
      await carregar()
      if (regiao.id) await carregarRegiao()
    } catch (e) {
      $q.notify({
        type: 'negative',
        message: mensagemDoErro(e, 'Não foi possível excluir o produto.'),
      })
    }
  })
}

// ---- formulário
const formulario = reactive({
  aberto: false,
  salvando: false,
  id: null,
  nome: '',
  codigo: '',
  descricao: '',
  estrategia_precificacao: 'normal',
  tipo_veiculo: null,
  requisito_veiculo: null,
  grupo: '',
  ordem: 0,
  prioritario: false,
  ativo: true,
  icone_tipo: null,
  icone_valor: '',
  imagem_atual: null,
  arquivo: null,
})

// pré-visualização do arquivo escolhido (liberada quando troca ou fecha)
const urlDoArquivo = ref(null)
function liberarPrevia() {
  if (urlDoArquivo.value) URL.revokeObjectURL(urlDoArquivo.value)
  urlDoArquivo.value = null
}
watch(
  () => formulario.arquivo,
  (arquivo) => {
    liberarPrevia()
    if (arquivo) urlDoArquivo.value = URL.createObjectURL(arquivo)
  },
)

// o ícone que está sendo montado, como o passageiro vai ver
const previa = computed(() => {
  if (formulario.icone_tipo === 'emoji') {
    return formulario.icone_valor?.trim()
      ? { tipo: 'emoji', valor: formulario.icone_valor.trim() }
      : null
  }
  if (formulario.icone_tipo === 'url') {
    return /^https?:\/\/\S+$/i.test(formulario.icone_valor || '')
      ? { tipo: 'url', valor: formulario.icone_valor.trim() }
      : null
  }
  if (formulario.icone_tipo === 'imagem') {
    const origem = urlDoArquivo.value || formulario.imagem_atual
    return origem ? { tipo: 'imagem', valor: origem } : null
  }
  return null
})

function abrirFormulario(produto) {
  Object.assign(formulario, {
    aberto: true,
    salvando: false,
    id: produto?.id ?? null,
    nome: produto?.nome ?? '',
    codigo: produto?.codigo ?? '',
    descricao: produto?.descricao ?? '',
    estrategia_precificacao: produto?.estrategia_precificacao ?? 'normal',
    tipo_veiculo: produto?.tipo_veiculo ?? null,
    requisito_veiculo: produto?.requisito_veiculo ?? null,
    grupo: produto?.grupo ?? '',
    ordem: produto?.ordem ?? produtos.value.reduce((m, p) => Math.max(m, p.ordem ?? 0), 0) + 1,
    prioritario: produto?.prioritario ?? false,
    ativo: produto?.ativo ?? true,
    icone_tipo: produto?.icone_tipo ?? null,
    icone_valor: produto?.icone_valor ?? '',
    imagem_atual: produto?.icone_tipo === 'imagem' ? produto.icone?.valor : null,
    arquivo: null,
  })
}

function aoRejeitarArquivo(rejeitados) {
  $q.notify({
    type: 'negative',
    message:
      rejeitados[0]?.failedPropValidation === 'max-file-size'
        ? 'A imagem passa de 2 MB.'
        : 'Use uma imagem PNG, JPG ou WebP.',
  })
}

async function salvar() {
  formulario.salvando = true
  try {
    // multipart: leva o arquivo junto; editar é POST com _method=PUT
    const corpo = new FormData()
    const campo = (nome, valor) => corpo.append(nome, valor ?? '')
    campo('nome', formulario.nome.trim())
    if (!formulario.id) campo('codigo', formulario.codigo.trim())
    campo('descricao', formulario.descricao?.trim())
    campo('estrategia_precificacao', formulario.estrategia_precificacao)
    campo('tipo_veiculo', formulario.tipo_veiculo)
    campo('requisito_veiculo', formulario.requisito_veiculo)
    campo('grupo', formulario.grupo?.trim())
    campo('ordem', String(formulario.ordem ?? 0))
    campo('prioritario', formulario.prioritario ? '1' : '0')
    campo('ativo', formulario.ativo ? '1' : '0')
    campo('icone_tipo', formulario.icone_tipo)
    if (formulario.icone_tipo === 'emoji' || formulario.icone_tipo === 'url') {
      campo('icone_valor', formulario.icone_valor.trim())
    }
    if (formulario.icone_tipo === 'imagem' && formulario.arquivo) {
      corpo.append('imagem', formulario.arquivo)
    }

    if (formulario.id) {
      corpo.append('_method', 'PUT')
      await api.post(`/produtos-corridas/${formulario.id}`, corpo)
    } else {
      await api.post('/produtos-corridas', corpo)
    }
    formulario.aberto = false
    $q.notify({ type: 'positive', message: 'Produto salvo.' })
    await carregar()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: mensagemDoErro(e, 'Não foi possível salvar o produto.'),
    })
  } finally {
    formulario.salvando = false
  }
}

// ---- lista por região
const estados = ref([])
const cidades = ref([])
const filtroCidade = ref('')
const estadosOpcoes = computed(() =>
  estados.value.map((e) => ({ id: e.id, rotulo: `${e.nome} (${e.sigla})` })),
)
const cidadesFiltradas = computed(() => {
  const termo = filtroCidade.value.trim().toLowerCase()
  return cidades.value
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo))
    .slice(0, 80)
    .map((c) => ({ id: c.id, rotulo: `${c.nome} - ${c.uf}` }))
})
function filtrarCidades(texto, atualizar) {
  atualizar(() => (filtroCidade.value = texto))
}

const regiao = reactive({
  tipo: 'estado',
  id: null,
  carregando: false,
  salvando: false,
  propria: false,
  origemEfetiva: 'geral',
  selecionados: [],
})

function trocarTipoDeRegiao() {
  regiao.id = null
}

function parametrosDaRegiao() {
  return regiao.tipo === 'cidade' ? { cidade_id: regiao.id } : { estado_id: regiao.id }
}

async function carregarRegiao() {
  if (!regiao.id) return
  regiao.carregando = true
  try {
    const { data } = await api.get('/produtos-corridas/lista', { params: parametrosDaRegiao() })
    regiao.propria = data.tem_lista_propria
    regiao.origemEfetiva = data.origem_efetiva
    regiao.selecionados = data.tem_lista_propria
      ? data.produto_ids_proprios
      : data.produto_ids_efetivos
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: mensagemDoErro(e, 'Não foi possível carregar a lista.'),
    })
  } finally {
    regiao.carregando = false
  }
}

function aoAlternarListaPropria(ligada) {
  // ao ligar, a lista começa pela que vale hoje, para ajustar
  if (ligada && regiao.selecionados.length === 0) {
    regiao.selecionados = produtosAtivos.value.map((p) => p.id)
  }
}

async function salvarRegiao() {
  if (regiao.propria && regiao.selecionados.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Marque ao menos um produto, ou desligue a lista própria.',
    })
    return
  }
  regiao.salvando = true
  try {
    await api.put('/produtos-corridas/lista', {
      ...parametrosDaRegiao(),
      produto_ids: regiao.propria ? regiao.selecionados : null,
    })
    $q.notify({ type: 'positive', message: 'Lista salva.' })
    await Promise.all([carregarRegiao(), carregar()])
  } catch (e) {
    $q.notify({ type: 'negative', message: mensagemDoErro(e, 'Não foi possível salvar a lista.') })
  } finally {
    regiao.salvando = false
  }
}

async function carregarRegioes() {
  try {
    const { data } = await api.get('/produtos-corridas/regioes')
    estados.value = data.estados
    cidades.value = data.cidades
  } catch {
    // sem as regiões, só a lista de produtos funciona
  }
}

onMounted(() => {
  carregar()
  carregarRegioes()
})
onBeforeUnmount(liberarPrevia)
</script>

<style scoped>
.icone-caixa {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.12);
}
.icone-previa {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px dashed rgba(127, 127, 127, 0.5);
}
.icone-emoji {
  font-size: 26px;
  line-height: 1;
}
.icone-previa .icone-emoji {
  font-size: 36px;
}
.icone-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
