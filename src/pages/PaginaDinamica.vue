<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="cabecalho q-mb-lg">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar
          rounded
          size="52px"
          color="orange-1"
          text-color="deep-orange"
          icon="local_fire_department"
        />
        <div class="col">
          <div class="text-caption text-grey-7">Configurações</div>
          <h1 class="text-h5 text-weight-bold q-ma-none">Preço dinâmico</h1>
          <div class="text-grey-7 q-mt-xs">
            Onde há mais pedidos do que motoristas livres, a região esquenta no mapa do motorista e
            a corrida pedida ali custa mais. A regra é por cidade: cada uma liga, escolhe o modo de
            cobrança e os limites.
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="cabecalho q-mb-lg">
      <q-card-section>
        <div class="row items-center q-gutter-sm">
          <q-icon name="science" size="24px" color="deep-orange" />
          <div class="text-h6">Simulação de chamadas (Porto Velho)</div>
          <q-badge v-if="simulacao.rodando" color="green" class="q-ml-sm">
            rodando · rodada {{ simulacao.rodadas }}
          </q-badge>
        </div>
        <div class="text-grey-7 q-mt-xs">
          Passageiros da massa de simulação pedem corridas em Porto Velho. A cada rodada, uma ou
          mais regiões ganham demanda em bairros sorteados entre todos os 90 da cidade (centros
          reais, do OpenStreetMap): a demanda sobe, segura o pico e desce, e depois surgem outras. O
          dinâmico acompanha, de 1,1x para cima, em mais de um bairro ao mesmo tempo. A frota online
          é repartida pelos bairros: com poucos motoristas por bairro a demanda passa da oferta e
          esquenta. Liga o preço dinâmico na cidade. O mapa do motorista passa a mostrar a demanda e
          as tarifas reais, e a lista abaixo mostra os valores que tocam para o motorista em foco.
        </div>

        <div class="q-mt-md">
          <div class="text-subtitle2">Demanda no mapa do motorista</div>
          <div class="text-caption text-grey-7 q-mb-xs">
            Escolha o nível e o mapa do motorista passa a mostrar manchas dele. Se a simulação não
            estiver rodando, ela é iniciada; se estiver, é reiniciada com o nível escolhido. O
            dinâmico surge sozinho quando a demanda passa do limite crítico (acima da metade do
            teto).
          </div>
          <q-btn-group spread>
            <q-btn
              v-for="n in niveisDeDemanda"
              :key="n.chave"
              :color="simulacao.nivelDemanda === n.chave ? 'deep-orange' : undefined"
              :outline="simulacao.nivelDemanda !== n.chave"
              :icon="n.icone"
              :label="n.rotulo"
              :loading="simulacao.iniciando && simulacao.nivelDemanda === n.chave"
              :disable="simulacao.iniciando"
              no-caps
              @click="escolherNivelDeDemanda(n)"
            >
              <q-tooltip>{{ n.descricao }}</q-tooltip>
            </q-btn>
            <q-btn
              :color="dinamicoPesadoLigado ? 'deep-orange' : undefined"
              :outline="!dinamicoPesadoLigado"
              icon="my_location"
              label="Dinâmico pesado na região"
              :loading="gerandoPesado"
              :disable="gerandoPesado || (!dinamicoPesadoLigado && !simulacao.foco)"
              no-caps
              @click="alternarDinamicoPesado"
            >
              <q-tooltip>
                {{
                  dinamicoPesadoLigado
                    ? 'Ligado em volta do motorista em foco. Clique para desligar.'
                    : simulacao.foco
                      ? 'Esquenta os hexágonos em volta do motorista em foco, por 1 hora.'
                      : 'Escolha antes um motorista online em "Motorista em foco".'
                }}
              </q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>

        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12">
            <q-select
              v-model="simulacao.cenario"
              outlined
              dense
              clearable
              emit-value
              map-options
              label="Cenário de despacho (opcional)"
              :options="cenarios"
              option-value="chave"
              option-label="nome"
              :disable="simulacao.rodando"
              @update:model-value="aplicarCenario"
            />
            <div v-if="cenarioEscolhido" class="text-caption text-grey-7 q-mt-xs">
              {{ cenarioEscolhido.descricao }} · {{ cenarioEscolhido.concorrentes }} concorrentes
              por perto, {{ cenarioEscolhido.aceitacao_concorrentes }}% aceitam a chamada que
              recebem. As regras da fila (tempo, descanso, pesos) ficam em
              <router-link to="/despacho">Despacho de chamadas</router-link>.
            </div>
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model.number="simulacao.quantidade"
              type="number"
              outlined
              dense
              label="Pedidos por rodada"
              :disable="simulacao.rodando"
              :rules="[intervalo(1, 300)]"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model.number="simulacao.intervalo"
              type="number"
              outlined
              dense
              label="Intervalo"
              suffix="s"
              :disable="simulacao.rodando"
              :rules="[intervalo(5, 120)]"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model.number="simulacao.motoristasOnline"
              type="number"
              outlined
              dense
              label="Motoristas online (massa)"
              :disable="simulacao.rodando"
              :rules="[intervalo(0, 4000)]"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model.number="simulacao.vidaPedido"
              type="number"
              outlined
              dense
              label="Vida do pedido"
              suffix="min"
              hint="Depois disso o passageiro desiste"
              :rules="[intervalo(1, 30)]"
            />
          </div>
          <div class="col-6 col-md-2">
            <q-input
              v-model.number="simulacao.focoPercentual"
              type="number"
              outlined
              dense
              label="Pedidos perto do foco"
              suffix="%"
              :rules="[intervalo(0, 100)]"
            />
          </div>
          <div class="col-12 col-md-4">
            <q-select
              v-model="simulacao.foco"
              outlined
              dense
              use-input
              input-debounce="300"
              clearable
              label="Motorista em foco (os valores que tocam para ele)"
              :options="simulacao.opcoesDeFoco"
              option-label="rotulo"
              option-value="id"
              @filter="filtrarMotoristas"
            />
          </div>
        </div>

        <div class="q-mt-md">
          <q-toggle
            v-model="simuladosConcorrem"
            :disable="salvandoConcorrencia"
            color="deep-orange"
            label="Motoristas simulados disputam os pedidos de passageiros reais"
            @update:model-value="salvarConcorrencia"
          />
          <div class="text-caption text-grey-7">
            Desligado (padrão): os pedidos feitos pelo app do passageiro só chegam a motoristas de
            verdade e ficam abertos até um deles aceitar. Ligado: os simulados também aceitam e o
            pedido some em poucos segundos.
          </div>
        </div>

        <div class="row q-gutter-sm q-mt-sm">
          <q-btn
            color="deep-orange"
            icon="play_arrow"
            label="Iniciar simulação"
            :disable="simulacao.rodando"
            :loading="simulacao.iniciando"
            @click="iniciarSimulacao"
          />
          <q-btn
            outline
            color="negative"
            icon="stop"
            label="Parar e cancelar pedidos"
            :disable="!simulacao.rodando && !simulacao.situacao"
            @click="pararSimulacao"
          />
        </div>

        <q-banner
          v-if="!simulacao.rodando && simulacao.situacao?.pedidos_abertos > 0"
          rounded
          class="bg-orange-1 text-deep-orange-9 q-mt-md"
        >
          Sobraram {{ simulacao.situacao.pedidos_abertos }} pedidos de uma simulação anterior, que
          não está mais rodando. Eles continuam sendo oferecidos aos motoristas. Use "Parar e
          cancelar pedidos" para limpar.
        </q-banner>

        <q-banner v-if="simulacao.erro" rounded class="bg-red-1 text-negative q-mt-md">
          {{ simulacao.erro }}
        </q-banner>

        <div v-if="simulacao.situacao" class="q-mt-md">
          <div class="row q-gutter-md q-mb-md">
            <q-chip icon="call" color="orange-2">
              {{ simulacao.situacao.pedidos_abertos }} pedidos abertos
            </q-chip>
            <q-chip icon="directions_car" color="blue-2">
              {{ simulacao.situacao.motoristas_online }} motoristas online
            </q-chip>
            <q-chip icon="local_fire_department" color="red-2">
              {{ simulacao.situacao.dinamica.regioes.length }} regiões com dinâmico
            </q-chip>
            <q-chip
              v-for="e in simulacao.situacao.eventos"
              :key="e.bairro"
              icon="local_fire_department"
              color="deep-orange-2"
            >
              {{ e.bairro }} · {{ e.restam }} rodadas
            </q-chip>
            <q-chip icon="location_city" color="green-2">
              {{ simulacao.situacao.bairros_com_dinamico }}/{{
                simulacao.situacao.bairros_total
              }}
              bairros com dinâmico · rodada {{ simulacao.situacao.rodada }}
            </q-chip>
            <q-chip v-if="simulacao.criadas" icon="add_circle" color="grey-3">
              {{ simulacao.criadas }} pedidos criados nesta simulação
            </q-chip>
          </div>

          <q-banner dense rounded class="bg-blue-1 text-grey-9 q-mb-md">
            <b>Pedidos abertos por bairro</b> é só uma fotografia, atualizada a cada 3 s: lista as
            corridas <i>solicitadas</i> ou <i>em busca</i> que ainda não têm motorista, agrupadas
            pelo bairro mais próximo do embarque. Ela não escolhe quem recebe a chamada; isso é a
            fila de prioridade em <router-link to="/despacho">Despacho de chamadas</router-link>. O
            pedido some daqui quando um motorista aceita, o passageiro cancela ou ele expira.
          </q-banner>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <div class="text-subtitle2 q-mb-xs">Pedidos abertos por bairro</div>
              <q-list bordered separator dense class="rounded-borders">
                <q-expansion-item
                  v-for="b in simulacao.situacao.por_bairro"
                  :key="b.bairro"
                  dense
                  dense-toggle
                  expand-icon-toggle
                  group="pedidos-por-bairro"
                >
                  <template #header>
                    <q-item-section>
                      {{ b.bairro }}
                      <q-item-label v-if="b.reais" caption class="text-deep-orange">
                        {{ b.reais }} de passageiro real
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side class="text-weight-bold text-black">
                      {{ b.pedidos }}
                    </q-item-section>
                  </template>
                  <q-list dense separator class="bg-grey-1">
                    <q-item v-for="p in b.lista" :key="p.corrida_id" class="q-py-sm">
                      <q-item-section>
                        <q-item-label caption class="text-grey-8">
                          {{ dataEHoraDoPedido(p.solicitada_em) }} · {{ p.codigo }}
                          <q-badge v-if="p.real" color="deep-orange" class="q-ml-xs">
                            passageiro real
                          </q-badge>
                        </q-item-label>
                        <q-item-label
                          v-for="(ponto, i) in p.itinerario"
                          :key="i"
                          class="row no-wrap items-start q-mt-xs"
                        >
                          <q-icon
                            :name="
                              ponto.tipo === 'origem'
                                ? 'trip_origin'
                                : ponto.tipo === 'destino'
                                  ? 'place'
                                  : 'more_vert'
                            "
                            :color="ponto.tipo === 'destino' ? 'deep-orange' : 'teal'"
                            size="16px"
                            class="q-mr-xs q-mt-xs"
                          />
                          <span>{{ ponto.endereco || 'Endereço não informado' }}</span>
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item v-if="b.pedidos > b.lista.length">
                      <q-item-section class="text-caption text-grey-7">
                        Mostrando os {{ b.lista.length }} mais recentes de {{ b.pedidos }}.
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-expansion-item>
                <q-item v-if="!simulacao.situacao.por_bairro.length">
                  <q-item-section class="text-grey-6">Nenhum pedido aberto</q-item-section>
                </q-item>
              </q-list>
            </div>

            <div class="col-12 col-md-3">
              <div class="text-subtitle2 q-mb-xs">Regiões com dinâmico</div>
              <q-markup-table flat dense bordered>
                <tbody>
                  <tr v-for="r in simulacao.situacao.dinamica.regioes" :key="r.celula">
                    <td>
                      <q-badge :style="{ background: corDaIntensidade(r.intensidade) }">
                        {{ r.rotulo }}
                      </q-badge>
                    </td>
                    <td>{{ r.bairro }}</td>
                  </tr>
                  <tr v-if="!simulacao.situacao.dinamica.regioes.length">
                    <td colspan="2" class="text-grey-6">Nenhuma região esquentou ainda</td>
                  </tr>
                </tbody>
              </q-markup-table>
            </div>

            <div class="col-12 col-md-5">
              <div class="text-subtitle2 q-mb-xs">
                Tocando para o motorista em foco
                <span v-if="simulacao.situacao.foco" class="text-grey-7">
                  ({{ simulacao.situacao.foco.dentro_do_raio }} no raio,
                  {{ simulacao.situacao.foco.com_dinamico }} com dinâmico)
                </span>
              </div>
              <q-banner
                v-if="simulacao.situacao.foco && !simulacao.situacao.foco.online"
                dense
                rounded
                class="bg-orange-1 q-mb-sm"
              >
                O motorista em foco está offline no app: conecte para as chamadas tocarem.
              </q-banner>
              <q-markup-table flat dense bordered>
                <thead>
                  <tr>
                    <th class="text-left">Origem</th>
                    <th class="text-right">Dist.</th>
                    <th class="text-right">Recebe</th>
                    <th class="text-right">Dinâmico</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in simulacao.situacao.foco?.chamadas ?? []" :key="c.corrida_id">
                    <td>{{ c.origem }}</td>
                    <td class="text-right">{{ c.distancia_ate_origem_km }} km</td>
                    <td class="text-right text-weight-bold">{{ emReais(c.valor_motorista) }}</td>
                    <td class="text-right">
                      <q-badge v-if="c.multiplicador" color="deep-orange">
                        {{ c.multiplicador }}x · {{ emReais(c.valor_dinamico) }}
                      </q-badge>
                      <span v-else class="text-grey-6">—</span>
                    </td>
                  </tr>
                  <tr v-if="!simulacao.foco">
                    <td colspan="4" class="text-grey-6">Escolha um motorista em foco</td>
                  </tr>
                </tbody>
              </q-markup-table>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <div v-if="carregando" class="text-center q-pa-xl" role="status">
      <q-spinner color="primary" size="36px" />
      <div class="q-mt-sm">Carregando...</div>
    </div>
    <q-banner v-else-if="erro" rounded class="bg-red-1 text-negative">
      {{ erro }}
      <template #action><q-btn flat label="Tentar novamente" @click="carregar" /></template>
    </q-banner>

    <div v-else class="row q-col-gutter-lg">
      <div class="col-12 col-lg-8">
        <q-card flat bordered class="cartao">
          <q-card-section class="row items-center">
            <div class="col text-h6 text-weight-bold">Cidades</div>
            <q-btn
              color="primary"
              no-caps
              icon="add_location_alt"
              label="Adicionar cidade"
              @click="abrirFormulario()"
            />
          </q-card-section>
          <q-table
            flat
            :rows="cidades"
            :columns="colunas"
            row-key="cidade_id"
            hide-pagination
            :rows-per-page-options="[0]"
            no-data-label="Nenhuma cidade configurada. Adicione a primeira."
          >
            <template #body-cell-ativo="props">
              <q-td :props="props">
                <q-toggle
                  :model-value="props.row.ativo"
                  :disable="salvando"
                  @update:model-value="(valor) => alternar(props.row, valor)"
                />
              </q-td>
            </template>
            <template #body-cell-modo="props">
              <q-td :props="props">{{ rotuloDoModo(props.row.modo) }}</q-td>
            </template>
            <template #body-cell-regioes="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.regioes_ativas > 0 ? 'deep-orange' : 'grey-5'"
                  :label="props.row.regioes_ativas"
                />
              </q-td>
            </template>
            <template #body-cell-acoes="props">
              <q-td :props="props" class="text-right">
                <q-btn
                  flat
                  dense
                  no-caps
                  icon="hexagon"
                  label="Regiões"
                  @click="abrirRegioes(props.row)"
                />
                <q-btn flat dense round icon="edit" @click="abrirFormulario(props.row)">
                  <q-tooltip>Editar regras</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card>

        <q-card v-if="selecionada" flat bordered class="cartao q-mt-lg">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="col">
              <div class="text-h6 text-weight-bold">
                Regiões quentes: {{ selecionada.nome }}/{{ selecionada.uf }}
              </div>
              <div class="text-caption text-grey-7">
                Hexágonos esquentados agora. As calculadas pela demanda se refazem a cada minuto.
              </div>
            </div>
            <q-btn
              flat
              no-caps
              icon="refresh"
              label="Recalcular"
              :loading="recalculando"
              @click="recalcular"
            />
            <q-btn
              color="deep-orange"
              no-caps
              icon="add"
              label="Forçar região"
              @click="abrirForcar"
            />
          </q-card-section>
          <q-table
            flat
            :rows="regioes"
            :columns="colunasRegioes"
            row-key="id"
            :loading="carregandoRegioes"
            hide-pagination
            :rows-per-page-options="[0]"
            no-data-label="Nenhuma região quente agora."
          >
            <template #body-cell-rotulo="props">
              <q-td :props="props">
                <q-badge
                  :style="{ background: corDaIntensidade(props.row.intensidade) }"
                  class="text-weight-bold"
                >
                  {{ props.row.rotulo }}
                </q-badge>
              </q-td>
            </template>
            <template #body-cell-origem="props">
              <q-td :props="props">
                <q-chip
                  dense
                  :color="props.row.manual ? 'blue-1' : 'grey-3'"
                  :text-color="props.row.manual ? 'primary' : 'grey-8'"
                >
                  {{ props.row.manual ? 'Forçada' : 'Calculada' }}
                </q-chip>
              </q-td>
            </template>
            <template #body-cell-expira="props">
              <q-td :props="props">{{
                props.row.expira_em ? hora(props.row.expira_em) : 'Sem prazo'
              }}</q-td>
            </template>
            <template #body-cell-acoes="props">
              <q-td :props="props" class="text-right">
                <q-btn
                  flat
                  dense
                  round
                  color="negative"
                  icon="delete"
                  @click="removerRegiao(props.row)"
                >
                  <q-tooltip>Remover</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat bordered class="cartao q-mb-lg">
          <q-card-section>
            <div class="text-h6 text-weight-bold q-mb-xs">Grade de regiões</div>
            <div class="text-grey-7 q-mb-md">
              O mapa é dividido em hexágonos. Quanto menor o hexágono, mais fina a região. Mudar o
              tamanho apaga as regiões atuais, que são refeitas em seguida.
            </div>
            <q-input
              v-model.number="tamanho"
              type="number"
              outlined
              label="Raio do hexágono"
              suffix="m"
              min="300"
              max="5000"
              step="100"
              :rules="[(v) => (v >= 300 && v <= 5000) || 'De 300 a 5000 m']"
            />
            <q-btn
              color="primary"
              no-caps
              label="Salvar tamanho"
              :loading="salvandoTamanho"
              :disable="tamanho === tamanhoSalvo || !(tamanho >= 300 && tamanho <= 5000)"
              @click="salvarTamanho"
            />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="cartao">
          <q-card-section>
            <div class="text-h6 text-weight-bold">Como funciona</div>
            <ul class="text-grey-7 q-pl-md q-mb-none">
              <li>
                Todo minuto contamos os pedidos sem motorista (janela configurável) e os motoristas
                livres em cada hexágono e nos vizinhos.
              </li>
              <li>
                Acima da <b>razão mínima</b> (pedidos por motorista livre) a região esquenta; na
                <b>razão máxima</b> chega ao teto.
              </li>
              <li>
                <b>Multiplicador</b>: a corrida custa 1,5x, por exemplo. <b>Valor fixo</b>: soma R$
                2,25 à corrida. O teto de cada modo é seu.
              </li>
              <li>
                O preço vale pela origem da corrida e fica fixo depois de pedida, mesmo que a região
                esfrie.
              </li>
              <li>
                A taxa da plataforma continua a mesma: ela incide sobre o valor já com a dinâmica.
              </li>
              <li>
                O motorista só vê o mapa quente da própria cidade, e só com a cidade ligada aqui.
              </li>
            </ul>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="formulario.aberto" persistent>
      <q-card style="width: 640px; max-width: 95vw">
        <q-form @submit.prevent="salvarCidade">
          <q-card-section class="text-h6">
            {{ formulario.cidade_id && jaConfigurada ? 'Editar regras' : 'Adicionar cidade' }}
          </q-card-section>
          <q-card-section class="q-gutter-md">
            <q-select
              v-model="formulario.cidade"
              :options="opcoesDeCidade"
              option-label="rotulo"
              option-value="id"
              label="Cidade"
              outlined
              use-input
              input-debounce="150"
              :disable="jaConfigurada"
              :rules="[(v) => !!v || 'Escolha a cidade']"
              @filter="filtrarCidades"
            >
              <template #no-option
                ><q-item
                  ><q-item-section>Nenhuma cidade encontrada</q-item-section></q-item
                ></template
              >
            </q-select>

            <q-toggle v-model="formulario.ativo" label="Preço dinâmico ligado nesta cidade" />

            <div>
              <div class="text-subtitle2 q-mb-xs">Como cobrar</div>
              <q-btn-toggle
                v-model="formulario.modo"
                no-caps
                unelevated
                toggle-color="primary"
                :options="[
                  { label: 'Multiplicador (1,5x)', value: 'multiplicador' },
                  { label: 'Valor fixo (+R$)', value: 'valor_fixo' },
                ]"
              />
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="formulario.multiplicador_maximo"
                  type="number"
                  outlined
                  label="Multiplicador máximo"
                  suffix="x"
                  step="0.1"
                  clearable
                  hint="Teto no modo multiplicador. Vazio = sem teto (flutua livremente)"
                  :rules="[(v) => v === null || v === '' || intervalo(1.1, 10)(v)]"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="formulario.valor_maximo"
                  type="number"
                  outlined
                  label="Valor adicional máximo"
                  prefix="R$"
                  step="0.5"
                  hint="Teto no modo valor fixo"
                  :rules="[intervalo(0.5, 500)]"
                />
              </div>
            </div>

            <div class="text-subtitle2">Área atendida</div>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="formulario.centro_latitude"
                  type="number"
                  outlined
                  label="Latitude do centro"
                  step="any"
                  :rules="[intervalo(-90, 90, true)]"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="formulario.centro_longitude"
                  type="number"
                  outlined
                  label="Longitude do centro"
                  step="any"
                  :rules="[intervalo(-180, 180, true)]"
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="formulario.raio_km"
                  type="number"
                  outlined
                  label="Raio"
                  suffix="km"
                  :rules="[intervalo(1, 200)]"
                />
              </div>
            </div>
            <div class="text-caption text-grey-7" style="margin-top: -8px">
              Só pedidos e motoristas dentro deste raio contam. O centro é obrigatório para ligar.
            </div>

            <div class="text-subtitle2">Quando esquenta</div>
            <div class="row q-col-gutter-md">
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="formulario.razao_minima"
                  type="number"
                  outlined
                  label="Razão mínima"
                  step="0.1"
                  :rules="[intervalo(0.5, 20)]"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="formulario.razao_maxima"
                  type="number"
                  outlined
                  label="Razão máxima"
                  step="0.1"
                  :rules="[intervalo(0.6, 50), maiorQueMinima]"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="formulario.pedidos_minimos"
                  type="number"
                  outlined
                  label="Pedidos mín."
                  :rules="[intervalo(1, 200)]"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="formulario.janela_minutos"
                  type="number"
                  outlined
                  label="Janela"
                  suffix="min"
                  :rules="[intervalo(1, 120)]"
                />
              </div>
            </div>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="formulario.validade_minutos"
                  type="number"
                  outlined
                  label="Validade da região"
                  suffix="min"
                  hint="Quanto tempo a região fica quente sem novo cálculo"
                  :rules="[intervalo(1, 120)]"
                />
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              no-caps
              label="Cancelar"
              :disable="salvando"
              @click="formulario.aberto = false"
            />
            <q-btn type="submit" color="primary" no-caps label="Salvar" :loading="salvando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <q-dialog v-model="forcar.aberto" persistent>
      <q-card style="width: 480px; max-width: 95vw">
        <q-form @submit.prevent="salvarForcada">
          <q-card-section class="text-h6">Forçar região quente</q-card-section>
          <q-card-section class="q-gutter-md">
            <div class="text-grey-7">
              Esquenta o hexágono que contém este ponto, no modo da cidade ({{
                rotuloDoModo(selecionada?.modo)
              }}). Os valores respeitam o teto da cidade.
            </div>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model.number="forcar.latitude"
                  type="number"
                  outlined
                  label="Latitude"
                  step="any"
                  :rules="[intervalo(-90, 90, true)]"
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="forcar.longitude"
                  type="number"
                  outlined
                  label="Longitude"
                  step="any"
                  :rules="[intervalo(-180, 180, true)]"
                />
              </div>
            </div>
            <q-input
              v-if="selecionada?.modo === 'multiplicador'"
              v-model.number="forcar.multiplicador"
              type="number"
              outlined
              label="Multiplicador"
              suffix="x"
              step="0.1"
              :rules="[intervalo(1.1, 10)]"
            />
            <q-input
              v-else
              v-model.number="forcar.valor_adicional"
              type="number"
              outlined
              label="Valor adicional"
              prefix="R$"
              step="0.5"
              :rules="[intervalo(0.5, 500)]"
            />
            <q-input
              v-model.number="forcar.minutos"
              type="number"
              outlined
              label="Duração"
              suffix="min"
              hint="Vazio: fica até você remover"
              clearable
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              no-caps
              label="Cancelar"
              :disable="salvando"
              @click="forcar.aberto = false"
            />
            <q-btn type="submit" color="deep-orange" no-caps label="Forçar" :loading="salvando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const carregando = ref(false)
const erro = ref('')
const salvando = ref(false)

const cidades = ref([])
const tamanho = ref(600)
const tamanhoSalvo = ref(600)
const salvandoTamanho = ref(false)

const colunas = [
  {
    name: 'cidade',
    label: 'Cidade',
    align: 'left',
    field: (l) => `${l.nome}/${l.uf}`,
    sortable: true,
  },
  { name: 'ativo', label: 'Ligado', align: 'left', field: 'ativo' },
  { name: 'modo', label: 'Cobrança', align: 'left', field: 'modo' },
  { name: 'regioes', label: 'Regiões quentes', align: 'left', field: 'regioes_ativas' },
  { name: 'acoes', label: '', align: 'right' },
]

const colunasRegioes = [
  { name: 'rotulo', label: 'Valor', align: 'left', field: 'rotulo' },
  { name: 'celula', label: 'Hexágono', align: 'left', field: 'celula' },
  {
    name: 'centro',
    label: 'Centro',
    align: 'left',
    field: (r) => `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`,
  },
  { name: 'pedidos', label: 'Pedidos', align: 'right', field: 'pedidos' },
  { name: 'motoristas', label: 'Motoristas', align: 'right', field: 'motoristas' },
  { name: 'origem', label: 'Origem', align: 'left', field: 'manual' },
  { name: 'expira', label: 'Vale até', align: 'left', field: 'expira_em' },
  { name: 'acoes', label: '', align: 'right' },
]

const rotuloDoModo = (modo) => (modo === 'valor_fixo' ? 'Valor fixo (+R$)' : 'Multiplicador (1,5x)')

const hora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// de amarelo a vermelho, como o mapa do motorista
const corDaIntensidade = (i) => {
  const h = Math.round(50 - 50 * Math.min(Math.max(i, 0), 1))
  return `hsl(${h}, 90%, 45%)`
}

const intervalo =
  (min, max, permiteNegativo = false) =>
  (v) => {
    if (v === '' || v === null || Number.isNaN(Number(v))) return 'Informe um valor'
    const n = Number(v)
    if (n < min || n > max) return permiteNegativo ? `De ${min} a ${max}` : `De ${min} a ${max}`
    return true
  }

const maiorQueMinima = (v) =>
  Number(v) > Number(formulario.razao_minima) || 'Precisa ser maior que a razão mínima'

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/dinamica')
    cidades.value = data.cidades
    tamanho.value = tamanhoSalvo.value = data.tamanho_celula_metros
    if (selecionada.value) {
      selecionada.value =
        data.cidades.find((c) => c.cidade_id === selecionada.value.cidade_id) ?? null
    }
  } catch (e) {
    erro.value = e.response?.data?.message || 'Não foi possível carregar o preço dinâmico.'
  } finally {
    carregando.value = false
  }
}

async function salvarTamanho() {
  salvandoTamanho.value = true
  try {
    await api.put('/dinamica/geral', { tamanho_celula_metros: tamanho.value })
    $q.notify({ type: 'positive', message: 'Tamanho do hexágono salvo.' })
    await carregar()
    if (selecionada.value) await carregarRegioes()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível salvar.',
    })
  } finally {
    salvandoTamanho.value = false
  }
}

async function alternar(linha, valor) {
  salvando.value = true
  try {
    await api.put(`/dinamica/cidades/${linha.cidade_id}`, { ativo: valor })
    $q.notify({
      type: 'positive',
      message: valor
        ? `Preço dinâmico ligado em ${linha.nome}.`
        : `Preço dinâmico desligado em ${linha.nome}.`,
    })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível alterar.',
    })
  } finally {
    salvando.value = false
    await carregar()
  }
}

// ---- formulário da cidade
const todasAsCidades = ref([])
const opcoesDeCidade = ref([])
const formulario = reactive({
  aberto: false,
  cidade: null,
  cidade_id: null,
  ativo: false,
  modo: 'multiplicador',
  centro_latitude: null,
  centro_longitude: null,
  raio_km: 25,
  multiplicador_maximo: 2.5,
  valor_maximo: 12,
  razao_minima: 1.5,
  razao_maxima: 3,
  pedidos_minimos: 2,
  janela_minutos: 10,
  validade_minutos: 5,
})
// só as regras (o que a API aceita no PUT), sem nome, UF nem contagens
const CAMPOS_DAS_REGRAS = [
  'ativo',
  'modo',
  'centro_latitude',
  'centro_longitude',
  'raio_km',
  'multiplicador_maximo',
  'valor_maximo',
  'razao_minima',
  'razao_maxima',
  'pedidos_minimos',
  'janela_minutos',
  'validade_minutos',
]
// campo numérico apagado vira null (teto do multiplicador vazio = sem teto)
const soAsRegras = (origem) =>
  Object.fromEntries(
    CAMPOS_DAS_REGRAS.map((c) => [
      c,
      c === 'multiplicador_maximo' && origem[c] === '' ? null : origem[c],
    ]),
  )

const jaConfigurada = computed(() =>
  cidades.value.some((c) => c.cidade_id === formulario.cidade_id),
)

async function garantirCidades() {
  if (todasAsCidades.value.length) return
  const { data } = await api.get('/cidades')
  todasAsCidades.value = data.map((c) => ({ id: c.id, rotulo: `${c.nome}/${c.uf}` }))
}

function filtrarCidades(texto, atualizar) {
  garantirCidades()
    .then(() => {
      atualizar(() => {
        const busca = texto.trim().toLowerCase()
        opcoesDeCidade.value = busca
          ? todasAsCidades.value.filter((c) => c.rotulo.toLowerCase().includes(busca)).slice(0, 50)
          : todasAsCidades.value.slice(0, 50)
      })
    })
    .catch(() => atualizar(() => (opcoesDeCidade.value = [])))
}

async function abrirFormulario(linha) {
  if (linha) {
    await garantirCidades()
    Object.assign(formulario, soAsRegras(linha), {
      cidade_id: linha.cidade_id,
      cidade: { id: linha.cidade_id, rotulo: `${linha.nome}/${linha.uf}` },
    })
    opcoesDeCidade.value = [formulario.cidade]
  } else {
    Object.assign(formulario, {
      cidade: null,
      cidade_id: null,
      ativo: false,
      modo: 'multiplicador',
      centro_latitude: null,
      centro_longitude: null,
      raio_km: 25,
      multiplicador_maximo: 2.5,
      valor_maximo: 12,
      razao_minima: 1.5,
      razao_maxima: 3,
      pedidos_minimos: 2,
      janela_minutos: 10,
      validade_minutos: 5,
    })
  }
  formulario.aberto = true
}

async function salvarCidade() {
  const id = formulario.cidade?.id ?? formulario.cidade_id
  if (!id) return
  if (
    formulario.ativo &&
    (formulario.centro_latitude === null || formulario.centro_longitude === null)
  ) {
    $q.notify({ type: 'warning', message: 'Informe o centro da cidade antes de ligar.' })
    return
  }
  salvando.value = true
  try {
    await api.put(`/dinamica/cidades/${id}`, soAsRegras(formulario))
    $q.notify({ type: 'positive', message: 'Regras salvas.' })
    formulario.aberto = false
    await carregar()
  } catch (e) {
    const erros = e.response?.data?.errors
    $q.notify({
      type: 'negative',
      message:
        (erros && Object.values(erros)[0]?.[0]) ||
        e.response?.data?.message ||
        'Não foi possível salvar.',
    })
  } finally {
    salvando.value = false
  }
}

// ---- regiões quentes da cidade escolhida
const selecionada = ref(null)
const regioes = ref([])
const carregandoRegioes = ref(false)
const recalculando = ref(false)

async function carregarRegioes() {
  carregandoRegioes.value = true
  try {
    const { data } = await api.get(`/dinamica/cidades/${selecionada.value.cidade_id}/regioes`)
    regioes.value = data.data
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível carregar as regiões.',
    })
  } finally {
    carregandoRegioes.value = false
  }
}

function abrirRegioes(linha) {
  selecionada.value = linha
  regioes.value = []
  carregarRegioes()
}

async function recalcular() {
  recalculando.value = true
  try {
    const { data } = await api.post(`/dinamica/cidades/${selecionada.value.cidade_id}/recalcular`)
    regioes.value = data.data
    await carregar()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível recalcular.',
    })
  } finally {
    recalculando.value = false
  }
}

const forcar = reactive({
  aberto: false,
  latitude: null,
  longitude: null,
  multiplicador: 1.5,
  valor_adicional: 2,
  minutos: 30,
})

function abrirForcar() {
  Object.assign(forcar, {
    aberto: true,
    latitude: selecionada.value.centro_latitude,
    longitude: selecionada.value.centro_longitude,
    multiplicador: 1.5,
    valor_adicional: 2,
    minutos: 30,
  })
}

async function salvarForcada() {
  salvando.value = true
  try {
    const corpo = {
      latitude: forcar.latitude,
      longitude: forcar.longitude,
      minutos: forcar.minutos || null,
    }
    if (selecionada.value.modo === 'multiplicador') corpo.multiplicador = forcar.multiplicador
    else corpo.valor_adicional = forcar.valor_adicional
    await api.post(`/dinamica/cidades/${selecionada.value.cidade_id}/regioes`, corpo)
    $q.notify({ type: 'positive', message: 'Região forçada.' })
    forcar.aberto = false
    await carregarRegioes()
    await carregar()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível forçar.',
    })
  } finally {
    salvando.value = false
  }
}

function removerRegiao(regiao) {
  $q.dialog({
    title: 'Remover região',
    message: `Remover o hexágono ${regiao.celula} (${regiao.rotulo})? Se a demanda continuar alta, ele volta no próximo cálculo.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Remover', color: 'negative', noCaps: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/dinamica/cidades/${selecionada.value.cidade_id}/regioes/${regiao.id}`)
      await carregarRegioes()
      await carregar()
    } catch (e) {
      $q.notify({
        type: 'negative',
        message: e.response?.data?.message || 'Não foi possível remover.',
      })
    }
  })
}

// ---- simulação de chamadas (gatilho de teste)
const emReais = (valor) =>
  Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dataEHoraDoPedido = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Sem data'

const simulacao = reactive({
  quantidade: 60,
  intervalo: 8,
  motoristasOnline: 400,
  focoPercentual: 35,
  vidaPedido: 2,
  cenario: null,
  nivelDemanda: null,
  foco: null,
  opcoesDeFoco: [],
  rodando: false,
  iniciando: false,
  rodadas: 0,
  criadas: 0,
  situacao: null,
  erro: '',
})
let temporizadorDaSimulacao = null

// cenários de despacho: preenchem o ritmo da simulação e definem a concorrência do foco
const cenarios = ref([])
const cenarioEscolhido = computed(() => cenarios.value.find((c) => c.chave === simulacao.cenario))

function aplicarCenario(chave) {
  const cenario = cenarios.value.find((c) => c.chave === chave)
  if (!cenario) return
  simulacao.quantidade = cenario.quantidade
  simulacao.focoPercentual = cenario.foco_percentual
  simulacao.vidaPedido = cenario.vida_pedido_min
}

// níveis de demanda do mapa: o ritmo de cada um já vem junto (pedidos por rodada e frota online)
const niveisDeDemanda = [
  {
    chave: 'limpo',
    rotulo: 'Mapa limpo',
    icone: 'blur_off',
    descricao: 'Demanda muito baixa ou normal: sem mancha no mapa.',
    quantidade: 20,
    motoristas: 400,
  },
  {
    chave: 'concentracao',
    rotulo: 'Início de concentração',
    icone: 'blur_on',
    descricao: 'Manchas amarelas: movimento moderado, chance razoável de tocar corrida.',
    quantidade: 150,
    motoristas: 150,
  },
  {
    chave: 'pesada',
    rotulo: 'Demanda pesada',
    icone: 'whatshot',
    descricao: 'Manchas grandes em amarelo e âmbar, com bonequinhos: muitas solicitações juntas.',
    quantidade: 300,
    motoristas: 150,
  },
]

async function escolherNivelDeDemanda(nivel) {
  simulacao.nivelDemanda = nivel.chave
  simulacao.quantidade = nivel.quantidade
  simulacao.motoristasOnline = nivel.motoristas
  simulacao.vidaPedido = 3

  if (!simulacao.rodando) {
    await iniciarSimulacao()
    return
  }

  // já rodando: prepara de novo com o nível novo, e o laço de rodadas segue
  simulacao.iniciando = true
  simulacao.erro = ''
  try {
    await api.post('/dinamica/simulacao/iniciar', {
      motoristas_online: simulacao.motoristasOnline,
      motorista_foco_id: simulacao.foco?.id ?? null,
      cenario: simulacao.cenario ?? null,
      nivel_demanda: nivel.chave,
    })
  } catch (e) {
    simulacao.erro = mensagemDoErro(e)
  } finally {
    simulacao.iniciando = false
  }
}

api
  .get('/dinamica/simulacao/cenarios')
  .then(({ data }) => (cenarios.value = data))
  .catch(() => (cenarios.value = []))

function filtrarMotoristas(texto, atualizar) {
  api
    .get('/motoristas', { params: { search: texto, rowsPerPage: 10 } })
    .then(({ data }) => {
      atualizar(() => {
        simulacao.opcoesDeFoco = data.data.map((m) => ({
          id: m.id,
          rotulo: `#${m.id} ${m.name ?? m.nome ?? ''}`.trim(),
        }))
      })
    })
    .catch(() => atualizar(() => (simulacao.opcoesDeFoco = [])))
}

const mensagemDoErro = (e) => e.response?.data?.message ?? 'Não foi possível falar com o servidor.'

async function rodadaDaSimulacao() {
  try {
    const { data } = await api.post('/dinamica/simulacao/rodada', {
      quantidade: simulacao.quantidade,
      foco_percentual: simulacao.focoPercentual,
      vida_pedido_min: simulacao.vidaPedido,
      motorista_foco_id: simulacao.foco?.id ?? null,
    })
    simulacao.rodadas += 1
    simulacao.criadas += data.criadas
    simulacao.situacao = data.situacao
    simulacao.erro = ''
  } catch (e) {
    simulacao.erro = mensagemDoErro(e)
  }
  // a próxima só depois que esta termina: rodada lenta não empilha
  if (simulacao.rodando) {
    temporizadorDaSimulacao = setTimeout(rodadaDaSimulacao, simulacao.intervalo * 1000)
  }
}

async function iniciarSimulacao() {
  simulacao.iniciando = true
  simulacao.erro = ''
  try {
    await api.post('/dinamica/simulacao/iniciar', {
      motoristas_online: simulacao.motoristasOnline,
      motorista_foco_id: simulacao.foco?.id ?? null,
      cenario: simulacao.cenario ?? null,
      nivel_demanda: simulacao.nivelDemanda ?? null,
    })
    simulacao.rodando = true
    simulacao.rodadas = 0
    simulacao.criadas = 0
    await rodadaDaSimulacao()
    await carregar()
  } catch (e) {
    simulacao.erro = mensagemDoErro(e)
  } finally {
    simulacao.iniciando = false
  }
}

// dinâmico pesado em volta do motorista em foco (precisa estar online: a
// posição é a dele, que o servidor já conhece)
const gerandoPesado = ref(false)
const dinamicoPesadoLigado = ref(false)

async function gerarDinamicoPesado() {
  if (!simulacao.foco) return
  const cidade = selecionada.value ?? cidades.value.find((c) => c.ativo) ?? cidades.value[0]
  if (!cidade) {
    $q.notify({ type: 'warning', message: 'Configure o preço dinâmico de uma cidade primeiro.' })
    return
  }

  gerandoPesado.value = true
  try {
    const { data } = await api.post(`/dinamica/cidades/${cidade.cidade_id}/regioes/pesado`, {
      motorista_id: simulacao.foco.id,
      minutos: 60,
    })
    $q.notify({
      type: 'positive',
      message: `${data.regioes} hexágonos esquentados por 1 hora em volta do motorista.`,
    })
    dinamicoPesadoLigado.value = true
    await carregar()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível gerar o dinâmico.',
    })
  } finally {
    gerandoPesado.value = false
  }
}

const alternarDinamicoPesado = () =>
  dinamicoPesadoLigado.value ? desativarDinamicoPesado() : gerarDinamicoPesado()

async function desativarDinamicoPesado() {
  const cidade = selecionada.value ?? cidades.value.find((c) => c.ativo) ?? cidades.value[0]
  if (!cidade) return

  gerandoPesado.value = true
  try {
    const { data } = await api.delete(`/dinamica/cidades/${cidade.cidade_id}/regioes/pesado`)
    $q.notify({
      type: data.removidas > 0 ? 'positive' : 'info',
      message:
        data.removidas > 0
          ? `${data.removidas} hexágonos do dinâmico pesado removidos.`
          : 'Não há dinâmico pesado ligado.',
    })
    dinamicoPesadoLigado.value = false
    await carregar()
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message || 'Não foi possível desativar o dinâmico.',
    })
  } finally {
    gerandoPesado.value = false
  }
}

async function pararSimulacao() {
  simulacao.rodando = false
  // o servidor remove o dinâmico pesado junto com a simulação
  dinamicoPesadoLigado.value = false
  clearTimeout(temporizadorDaSimulacao)
  try {
    const { data } = await api.post('/dinamica/simulacao/parar')
    $q.notify({ type: 'positive', message: `${data.cancelados} pedidos da simulação cancelados.` })
    const { data: situacao } = await api.get('/dinamica/simulacao/situacao', {
      params: { motorista_foco_id: simulacao.foco?.id ?? undefined },
    })
    simulacao.situacao = situacao
    await carregar()
  } catch (e) {
    simulacao.erro = mensagemDoErro(e)
  }
}

// sair da página interrompe só o laço daqui; os pedidos abertos ficam até parar
onBeforeUnmount(() => clearTimeout(temporizadorDaSimulacao))

// ao abrir a página, vê no servidor se sobrou simulação (o estado do laço só existe aqui)
async function verSobrasDaSimulacao() {
  try {
    const { data } = await api.get('/dinamica/simulacao/situacao')
    if (data.pedidos_abertos > 0) simulacao.situacao = data
  } catch {
    // sem a situação, a página segue como estava
  }
}

// os simulados disputam os pedidos de passageiros reais? (padrão: não)
const simuladosConcorrem = ref(false)
const salvandoConcorrencia = ref(false)

async function carregarConcorrencia() {
  try {
    const { data } = await api.get('/dinamica/simulacao/concorrencia')
    simuladosConcorrem.value = data.simulados_concorrem_com_reais
  } catch {
    // sem o ajuste, o padrão (desligado) segue valendo no servidor
  }
}

async function salvarConcorrencia(valor) {
  salvandoConcorrencia.value = true
  try {
    await api.put('/dinamica/simulacao/concorrencia', { simulados_concorrem_com_reais: valor })
  } catch (e) {
    simuladosConcorrem.value = !valor
    $q.notify({ type: 'negative', message: mensagemDoErro(e) })
  } finally {
    salvandoConcorrencia.value = false
  }
}

// a lista de pedidos abertos acompanha o servidor a cada 3 s, com ou sem a
// simulação rodando: um pedido real dura poucos segundos
let temporizadorDaSituacao = null
let atualizandoSituacao = false

async function atualizarSituacao() {
  if (atualizandoSituacao || simulacao.iniciando) return
  atualizandoSituacao = true
  try {
    const { data } = await api.get('/dinamica/simulacao/situacao', {
      params: { motorista_foco_id: simulacao.foco?.id ?? undefined },
    })
    simulacao.situacao = data
  } catch {
    // a próxima volta tenta de novo
  } finally {
    atualizandoSituacao = false
  }
}

onMounted(() => {
  carregar()
  verSobrasDaSimulacao()
  carregarConcorrencia()
  temporizadorDaSituacao = setInterval(atualizarSituacao, 3000)
})

onBeforeUnmount(() => clearInterval(temporizadorDaSituacao))
</script>

<style scoped>
.cabecalho,
.cartao {
  border-radius: 14px;
}
</style>
