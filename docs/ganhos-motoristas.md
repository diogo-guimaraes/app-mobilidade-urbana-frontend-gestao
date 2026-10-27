# Ganhos dos motoristas

A página **Ganhos** fica em /motoristas-ganhos e requer financeiro.consultar (Gestão/Admin). O painel esquerdo apresenta filtros, total, dinheiro/app, gráfico e composição. O direito inicia com produtividade e permite consultar histórico de solicitações, demonstrativo ou uma categoria. Não possui operações de saque, transferência ou alteração de valores.

## Categoria das movimentações

A migration **2026_10_16_150000_add_categoria_to_saldo_motoristas.php** acrescenta categoria (varchar de 80 caracteres, opcional e indexada) na tabela existente **saldo_motoristas**. Copia as categorias do JSON, normalizando ganho_corrida para valor_corrida e bonus para recompensa. Mantém valores, saldos, descrições, JSON e datas anteriores. Não cria outra tabela de movimentações.

A coluna é a fonte principal. Enquanto existirem registros sem a coluna preenchida, a leitura mantém compatibilidade com detalhes.categoria. O model normaliza e preenche a coluna ao salvar registros pelo Eloquent. Escritas diretas no banco devem preencher categoria explicitamente. Os filtros de Motoristas saldo utilizam a coluna e mantêm os agrupamentos anteriores. A API passa a retornar categoria junto de titulo e descricao.

Categorias incluídas no demonstrativo:

| Origem                                                                        | Uso em Ganhos                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Corridas finalizadas e pagas                                                  | Valor líquido registrado em corrida_financeiros                                    |
| recompensa ou bonus                                                           | Recompensas confirmadas                                                            |
| gorjeta                                                                       | Gorjetas confirmadas, sem novo desconto de comissão                                |
| compensacao                                                                   | Compensações confirmadas                                                           |
| outro                                                                         | Outros ganhos explicitamente classificados                                         |
| ganhos_integrais                                                              | Complemento de incentivo em Recompensas; não significa isenção automática de taxas |
| valor_corrida ou ganho_corrida em saldo_motoristas                            | Apenas composição da corrida; o crédito não é somado novamente                     |
| transferencia, taxa_plataforma, desconto, ajuste, estorno e sem classificação | Fora dos ganhos; permanecem no extrato da carteira                                 |

Os lançamentos adicionais usam valor positivo para entrada e negativo para saída. Uma reversão de recompensa/gorjeta deve manter sua categoria de ganho. Ajustes genéricos de carteira não são presumidos como ganhos ou reversões de corridas.

## Cálculo e origem

Ganho total = Valor das solicitações + Recompensas + Gorjetas + Compensações + Outros.

Valor das solicitações representa a parcela líquida do motorista. A corrida fornece valor_liquido_motorista, já considerando sua composição e taxas. Não se somam tarifa base, dinâmico e espera novamente. O snapshot financeiro do crédito da corrida pode discriminar bonus_incentivo, gorjeta, compensacao e outros_ganhos já incluídos no líquido; essas parcelas são retiradas de Valor das solicitações e exibidas nas respectivas categorias, preservando o total. Composição maior que o líquido gera aviso e mantém o líquido em Valor das solicitações.

Créditos específicos adicionais podem informar detalhes.incluido_no_valor_corrida: true quando apenas representam uma parcela já incluída no líquido. Nesse caso, não geram outro ganho. Uma recompensa independente pode informar detalhes.campanha com a missão/meta de origem; na ausência, a interface não inventa uma campanha.

O pagamento é classificado pelo método registrado: dinheiro ou app (PIX, cartão e carteira). Método ausente aparece separadamente como pagamento não informado. Esses totais são ganhos classificados pelo método, não comprovantes de liquidação bancária ou saldo disponível para resgate.

Corridas sem pagamento confirmado, canceladas ou sem valor líquido não entram nos totais. Valores financeiros ausentes não são estimados. Distâncias ausentes impedem o cálculo de ganho por quilômetro. Sem solicitações ou quilômetros, as médias ficam indisponíveis e a tela mostra “—”.

Entregas são identificadas por produtos_corridas.estrategia_precificacao = entrega. Os demais produtos são corridas; solicitações sem produto identificado aparecem somente em Tudo. Adicionais sem corrida podem informar detalhes.tipo_servico como corrida ou entrega. Quando não houver essa informação, aparecem somente em Tudo, sem atribuição inventada a um serviço.

## Períodos e resumo persistido

A migration **2026_10_16_151000_create_ganhos_motoristas_resumo_table.php** cria ganhos_motoristas_resumo, com as colunas do demonstrativo e chave única motorista/data/serviço. Inclui total_nao_identificado para preservar valores cujo método de pagamento não foi informado.

Os resumos diários são reconstruídos a partir das fontes do período consultado e gravados com upsert, inclusive dias sem movimento. A repetição não duplica totais. Mudanças de pagamento ou valores na origem são refletidas na próxima consulta, sem modificar corridas ou carteiras. Os registros todos são consultados independentemente dos de corrida/entrega e nunca somados a eles novamente. A tabela é derivada, não a fonte de auditoria financeira.

O fuso de fechamento é definido no backend em config/ganhos.php, por GANHOS_TIMEZONE, padrão America/Porto_Velho. O período semanal começa na segunda-feira; o mensal cobre o mês civil e o anual cobre janeiro a dezembro, incluindo 29 de fevereiro em anos bissextos. O início é inclusivo e o próximo dia/semana/mês/ano é exclusivo. O gráfico diário usa o horário original dos registros; semanal e mensal usam os dias; o anual soma os ganhos em 12 meses, incluindo meses sem movimento. Em Anuais, as setas navegam entre anos. Não exige nova migration.

O anual apresenta somente resumo, composição consolidada, gráfico mensal e produtividade. Não exibe os botões de Histórico de solicitações ou Demonstrativo de ganhos; as linhas de categorias ficam informativas, sem abrir listagens. A API de resumo não carrega passageiros ou trajetos nesse período. O endpoint detalhes rejeita periodo=anual com 422. Listas e decomposição individual permanecem disponíveis nos períodos diário, semanal e mensal.

## Rotas do backend

Todas usam JWT de Gestor e financeiro.consultar. As respostas não incluem o chat, documentos, saldo de carteira ou dados completos de usuário.

| Método | Rota                                     | Contrato                                                                                                                                                                                                 |
| ------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /api/gestao/motoristas-ganhos/motoristas | Seleção paginada de motoristas, inclusive arquivados para consulta histórica. search por nome/CPF e page; retorna id, nome e foto.                                                                       |
| GET    | /api/gestao/motoristas-ganhos/resumo     | Recebe motorista_id, data (YYYY-MM-DD), periodo (diario, semanal, mensal, anual) e tipo_servico (todos, corrida, entrega). Retorna data com motorista, período, totais, produtividade, gráfico e avisos. |
| GET    | /api/gestao/motoristas-ganhos/detalhes   | Mesmos filtros, mais visao (solicitacoes, demonstrativo, valor_solicitacoes, recompensas, gorjetas, compensacoes, outros), page e per_page (1 a 50). Retorna data e meta de paginação.                   |

O resumo não retorna a listagem detalhada. Ela é carregada somente ao escolher uma ação. O histórico de solicitações traz passageiro, trajeto, pagamento e composição, em ordem de conclusão decrescente. As consultas antigas são canceladas ao trocar de motorista ou período.

## Atualização e teste

Execute no terminal do backend dentro do container:

```shell
php artisan migrate
```

Não é necessário migrate:fresh. As migrations não dependem de seeder para classificar registros existentes. Para um exemplo de desenvolvimento, use os dados de SaldoMotoristasDemonstracaoSeeder e selecione **Motorista financeiro de teste** em Ganhos. No período das quatro corridas do exemplo original, o ganho é R$ 97,37 (R$ 16,97 em dinheiro e R$ 80,40 no app), sendo R$ 5,00 de recompensa incluída. A carteira de R$ 54,37 permanece independente, pois também considera taxas e resgates.

Para que gorjetas, compensações e missões apareçam, precisam existir lançamentos confirmados correspondentes. A tela não cria essas movimentações automaticamente.
