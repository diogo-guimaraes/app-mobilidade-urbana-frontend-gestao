# Motoristas saldo

Página de consulta em /motoristas-saldo, com lista à esquerda e detalhe à direita. Gestão e Admin acessam pela permissão financeiro.consultar; Atendimento e Suporte técnico não têm acesso. No celular, o botão Movimentações retorna à lista.

Esta etapa é somente leitura. Não possui botão de resgatar, cadastro de ajustes, registro automático de corridas/saques, edição ou exclusão. Os serviços e as rotas atuais de carteira e saque continuam independentes.

O detalhe possui as abas **Movimentação** e **Histórico da corrida**. A segunda reutiliza o componente da Central de ajuda: detalhes, valores e mapa à esquerda, conversa entre motorista e passageiro à direita. Em espaços estreitos, os painéis ficam um abaixo do outro. A consulta é vinculada ao lançamento financeiro e não precisa de um ticket.

## Banco de dados

Migration: **2026_10_16_140000_create_saldo_motoristas_table.php**.

| Campo                           | Tipo / finalidade                                            |
| ------------------------------- | ------------------------------------------------------------ |
| id                              | bigint, chave primária                                       |
| motorista_id                    | FK de motoristas, exclusão física em cascata                 |
| corrida_id                      | FK opcional de corridas, fica nula se a corrida for excluída |
| tipo                            | entrada ou saida                                             |
| categoria                       | varchar(80), classificação da operação, opcional e indexada  |
| valor                           | decimal(10,2), magnitude da movimentação                     |
| descricao                       | varchar(255), título                                         |
| metodo_pagamento                | dinheiro, pix, cartao_online, saldo_carteira ou nulo         |
| saldo_anterior, saldo_posterior | decimal(10,2), valores registrados na origem                 |
| detalhes                        | JSON opcional, composição e metadados                        |
| created_at, updated_at          | timestamps                                                   |

Índices: motorista/data, tipo e data/ID. Valores monetários do registro retornam como strings com duas casas. A API não corrige os saldos gravados. O campo auditoria.consistente verifica em centavos se saldo anterior ± valor corresponde ao posterior.

O filtro de status usa detalhes.status: confirmado, processando, falhou ou cancelado. A ausência desse metadado representa confirmado. A estrutura solicitada não precisa de coluna adicional.

Execute no terminal do backend aberto no container:

```shell
php artisan migrate
```

A tabela inicia vazia. A interface consulta apenas registros existentes, sem gerar dados fictícios ou converter corridas antigas automaticamente.

### Exemplo para visualizar a tela

O seeder manual **SaldoMotoristasDemonstracaoSeeder** cria uma conta separada chamada **Motorista financeiro de teste**, com e-mail motorista.financeiro@example.com. Inclui quatro corridas fictícias, dois resgates simulados e seis lançamentos: três entradas (PIX/cartão) e três saídas (taxa em dinheiro e resgates), com saldo final de **R$ 54,37**.

```shell
php artisan db:seed --class=SaldoMotoristasDemonstracaoSeeder
```

Entre no painel com Gestão/Admin, abra Motoristas saldo e busque “Motorista financeiro”. Clique na movimentação de corrida identificada com “Inclui bônus” para ver a composição, o bônus e a auditoria. Os resgates mostram o detalhe sem corrida e permitem testar o filtro Em processamento.

O seeder funciona somente em local/testing e pode ser repetido sem duplicar lançamentos. As observações identificam os dados como demonstração. Não chama gateways, não executa transferência bancária e não altera a carteira das contas existentes. Não faz parte do DatabaseSeeder.

## Rotas do backend

Todas usam JWT de Gestor: Authorization: Bearer <token> e Accept: application/json.

| Método | Caminho completo                            | Função                                                          |
| ------ | ------------------------------------------- | --------------------------------------------------------------- |
| GET    | /api/gestao/motoristas-saldo                | Lista paginada, ordenada por created_at e ID decrescentes       |
| GET    | /api/gestao/motoristas-saldo/{movimentacao} | Detalhe, motorista, saldo atual, corrida/composição e auditoria |

### Histórico da corrida

GET /api/gestao/motoristas-saldo/{movimentacao}/corrida/mensagens — consulta detalhes, trajeto e conversa da corrida.

A rota GET /api/gestao/motoristas-saldo/{movimentacao}/corrida/mensagens retorna o histórico da corrida: detalhes, financeiro, trajeto e conversa somente para leitura. Aceita before_id ou after_id (exclusivos entre si) e limit de 1 a 100, com padrão 50. Retorna data, corrida, pode_enviar: false, has_more e os cursores, no mesmo contrato da Central de ajuda.

Sem corrida vinculada, a aba Histórico da corrida fica oculta e essa rota não é consultada; acessá-la diretamente retorna 404. A autorização exige financeiro.consultar. O canal privado corrida.{corridaId}.chat.financeiro exige essa permissão e uma movimentação vinculada à corrida.

O evento corrida.mensagem informa apenas os IDs. A tela consulta as novas mensagens e revalida o acesso. A assinatura permanece somente enquanto a aba está aberta. Com conexão e canal autorizados, não há consultas periódicas; a recuperação a cada 15 segundos funciona quando a conexão falha. Após atualizar o backend, reinicie os workers existentes com php artisan queue:restart para carregar o novo canal de transmissão. Esta aba não exige nova migration.

O seeder de demonstração também inclui três pontos de trajeto e quatro mensagens fictícias por corrida. Pode ser repetido para completar o histórico do exemplo existente, preservando mensagens editadas e os saldos. Abra uma movimentação com corrida vinculada e selecione Histórico da corrida para conferir.

### Filtros da listagem

- search: nome, CPF ou ID do motorista.
- motorista_id: ID exato de motoristas, não o ID de users.
- tipo: entrada ou saida.
- categoria: valor_corrida, recompensa, gorjeta, compensacao, ganhos_integrais, outro, transferencia, descontos_taxas ou ajustes_estornos. Sem valor (Todos), retorna todas as categorias, inclusive registros antigos sem classificação. O filtro acontece no backend, antes da paginação, e combina com os demais filtros.
- status: os quatro valores de detalhes.status descritos acima.
- data_inicio, data_fim: YYYY-MM-DD, opcionais e inclusivos no fuso informado por timezone. A interface envia o fuso do navegador; na ausência, a API usa o configurado no app.
- page e per_page: paginação, padrão 20 e máximo 50 por página.

Lista retorna data, links e meta. Detalhe retorna data; o ID da rota é o lançamento em saldo_motoristas. Não existem rotas POST, PUT, PATCH ou DELETE neste módulo.

Erros: 401 sem autenticação, 403 sem permissão, 404 para lançamento inexistente e 422 para filtros inválidos.

## Valores e auditoria

### Títulos das movimentações

A lista e o detalhe usam o campo titulo da resposta. A descricao original permanece disponível na API. A identificação vem da coluna categoria de saldo_motoristas, com compatibilidade para detalhes.categoria nos registros ainda sem a coluna preenchida, sem analisar palavras da descrição. Registros sem categoria reconhecida mantêm a descrição original. A migration 2026_10_16_150000_add_categoria_to_saldo_motoristas.php copia as classificações existentes e preserva valores, saldos e datas. Veja [ganhos-motoristas.md](ganhos-motoristas.md) para o demonstrativo e os contratos do novo módulo Ganhos.

O filtro Categoria contém somente opções selecionáveis: Todos, Valor da corrida, Recompensa, Gorjeta, Compensação, 100% dos ganhos, Transferência / Resgate, Descontos e taxas, Ajustes e estornos e Outro. Todos ou Limpar filtros remove a restrição de categoria.

Recompensa inclui a categoria antiga bonus. Valor da corrida inclui ganho_corrida. Descontos e taxas reúne desconto e taxa_plataforma; Ajustes e estornos reúne ajuste e estorno. Esses agrupamentos são exclusivos da consulta: os lançamentos mantêm suas categorias e títulos específicos. A API também aceita as categorias antigas e os quatro valores individuais agrupados.

| categoria                      | Título exibido                                             |
| ------------------------------ | ---------------------------------------------------------- |
| valor_corrida ou ganho_corrida | Valor da corrida · nome real do produto                    |
| recompensa ou bonus            | Recompensa                                                 |
| gorjeta                        | Gorjeta                                                    |
| compensacao                    | Compensação                                                |
| ganhos_integrais               | 100% dos ganhos                                            |
| outro                          | Outro · descrição original                                 |
| transferencia                  | Transferência para conta bancária                          |
| taxa_plataforma                | Taxa da plataforma · Corrida em dinheiro, quando aplicável |
| desconto                       | Desconto na carteira                                       |
| ajuste                         | Ajuste de saldo                                            |
| estorno                        | Estorno de movimentação                                    |

Valores de corrida com detalhes.financeiro.bonus_incentivo maior que zero recebem o complemento “Inclui bônus”. O total permanece como ganho da corrida: não se cria outro crédito ou se classifica todo o ganho como recompensa. Recompensa identifica um lançamento exclusivo desse incentivo. O nome do produto é consultado em produtos_corridas; não é fixado como Pop. O status permanece no selo, separado do título. A categoria ganhos_integrais apenas identifica uma operação registrada: não recalcula os valores ou isenta taxas automaticamente. Outro exige classificação explícita; categorias ausentes ou desconhecidas não são presumidas como Outro.

O seeder SaldoMotoristasDemonstracaoSeeder preenche as categorias das suas seis movimentações. Ao ser repetido, completa somente categorias ausentes dos registros de demonstração, preservando descrições, valores, saldos e categorias já informadas. A migration da coluna categoria deve estar aplicada; não é necessário recriar o banco ou repetir o seeder para classificar registros antigos.

### Saldos e composição

O campo data.motorista.saldo_atual vem de CarteiraMotoristaService: corridas finalizadas em PIX/cartão só creditam após pagamento confirmado; corridas em dinheiro descontam a taxa da plataforma; saques processando/concluídos descontam e saques com falha não descontam. Esse saldo pode diferir do saldo posterior de um lançamento histórico.

O campo data.auditoria contém os saldos persistidos. A tela avisa se os números não conferirem, sem modificá-los.

A composição usa o snapshot de detalhes.financeiro quando presente; campos ausentes nesse snapshot ficam nulos. Sem snapshot, consulta os valores atuais de corrida_financeiros. A resposta distingue origem: registro de origem: corrida_atual. A tela mostra “—” para valores ausentes. Os componentes são informativos: tarifa base, dinâmico e outros valores não são somados novamente para inventar um ganho.

Exemplo de metadados para o sistema que já grava os lançamentos:

```json
{
  "status": "confirmado",
  "categoria": "valor_corrida",
  "status_pagamento": "pago",
  "metodo_pagamento_passageiro": "pix",
  "financeiro": {
    "valor_base_calculado": "11.90",
    "tarifa_base": "2.00",
    "valor_dinamico_aplicado": "1.50",
    "taxa_espera": "2.80",
    "bonus_incentivo": null,
    "valor_liquido_motorista": "16.20",
    "valor_pago_passageiro": "15.23",
    "taxa_plataforma_valor": "1.03",
    "subsidiado_plataforma": "2.00",
    "taxa_cancelamento_terceiro": null
  },
  "observacao": "Referência do lançamento na origem."
}
```

A taxa_cancelamento_terceiro só terá valor quando for informada explicitamente. A taxa da própria corrida é separada; não se presume que represente dívida anterior. O vínculo a uma corrida não significa que todo dinheiro recebido em mãos entrou na carteira.

Frontend: PaginaMotoristasSaldo.vue, DetalheSaldoMotorista.vue, useSaldoMotoristas.js e saldoMotoristas.js. Backend: SaldoMotoristasController, SaldoMotoristaResource e SaldoMotorista.
