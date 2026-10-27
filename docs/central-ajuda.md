# Central de ajuda: tickets e chat

A gestão atende em `/central-ajuda`, com a identidade visual do aplicativo: cartões claros, azul principal e conversa ao lado da fila de tickets. Atendimento, Suporte técnico, Gestão e Admin acessam o módulo pela permissão `ajuda.gerenciar`, respeitando a visibilidade de cada perfil.

## Modelo de dados

Mantivemos `chamados_ajuda`, que já representava os pedidos de ajuda do app. A migration `2026_10_14_130000_adiciona_chat_aos_chamados_ajuda.php` estende essa tabela e transforma a descrição de cada chamado antigo na primeira mensagem, conservando ID, autor e data. Não é necessário recriar o banco.

| Tabela                    | Campos principais                                                                                                                                           | Relações e índices                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `chamados_ajuda`          | `id` bigint, `motivo` varchar(80), `descricao` text, `solicitante_tipo` varchar(20), `status` varchar(20), datas de última mensagem, resolução e fechamento | Solicitante → `users`; corrida opcional → `corridas`; responsável opcional → `gestores`; índices por status/data e responsável/status |
| `chamado_mensagens`       | `id` bigint, `autor_tipo` varchar(20), `autor_nome` varchar(255), `conteudo` text, `client_message_id` UUID opcional, timestamps                            | Ticket com exclusão em cascata; usuário/gestor opcionais com `nullOnDelete`; índice `(chamado_id,id)`; UUID único por ticket          |
| `ticket_transfers`        | Ticket, operador que transferiu, responsável anterior/destinatário, nomes da época, tipo, observação e data                                                 | IDs de operadores referenciam `gestores`; auditoria preserva os nomes                                                                 |
| `ticket_leituras`         | Ticket, gestor e ID da última mensagem lida                                                                                                                 | Leitura individual por operador; cursor não retrocede                                                                                 |
| `chamado_mensagem_anexos` | Mensagem, disco/caminho privado, nome, MIME, tamanho, dimensões e hash                                                                                      | Metadados das imagens do atendimento; arquivo servido pela API autenticada                                                            |
| `corrida_mensagens`       | Corrida, usuário, perfil/nome do autor, texto, UUID e datas                                                                                                 | Conversa motorista/passageiro; UUID único por corrida                                                                                 |

Migrations complementares do módulo, em ordem:

- `2026_10_15_140000_create_ticket_transfers_table.php`: auditoria de transferências.
- `2026_10_15_160000_adiciona_fila_de_atendimento_aos_tickets.php`: posição e entrada na fila.
- `2026_10_15_170000_identifica_mensagem_de_fila_dos_tickets.php`: identifica o aviso de sistema que é atualizado no chat.
- `2026_10_15_180000_create_ticket_leituras_table.php`: leitura individual por operador.
- `2026_10_15_190000_create_chamado_mensagem_anexos_table.php`: imagens no atendimento.
- `2026_10_15_200000_create_corrida_mensagens_table.php`: conversa motorista/passageiro.
- `2026_10_16_120000_simplifica_status_dos_tickets.php`: converte tickets antigos em `pending` para `waiting` quando têm responsável ou `open` quando não têm; converte `closed` para `resolved`, preservando o histórico.

Os detalhes financeiros e o mapa usam as tabelas existentes `corridas`, `corrida_financeiros`, `corrida_destinos`, `produtos_corridas` e `veiculos`; essa parte não acrescenta migration.

As situações são definidas no enum PHP `StatusTicket` e validadas na API: `open` (Aberto), `waiting` (Aguardando atendimento), `in_progress` (Em atendimento) e `resolved` (Finalizado). A coluna é string para permitir evolução sem alterações de um enum nativo do MySQL. “Aguardando resposta” e “Fechado” foram removidos do fluxo e do filtro; `resolved` mantém seu valor na API, com o novo nome “Finalizado” na interface e nas novas mensagens de sistema.

Ao atualizar o backend, execute `php artisan migrate` para converter os registros antigos. A migração preserva mensagens e auditoria existentes, sem reescrever os textos das mensagens antigas. Requisições com `pending` ou `closed` passam a retornar 422.

O solicitante é Passageiro ou Motorista. A mesma conta pode ter os dois perfis, mas cada ticket registra qual perfil originou o atendimento. Uma corrida só pode ser vinculada quando pertence ao perfil indicado. O chat de atendimento pertence ao solicitante do ticket. A conversa entre motorista e passageiro pertence à corrida e tem acesso próprio, descrito adiante.

O Sistema registra mudanças de status e responsável. Não é uma conta que precisa existir em `users`. Gestores continuam em sua tabela e guard atuais; não acrescentamos credenciais à tabela de usuários.

## Regras do atendimento

As contas de desenvolvimento do painel usam a senha `password`:

| Perfil          | E-mail                        |
| --------------- | ----------------------------- |
| Admin           | `admin@example.com`           |
| Gestão          | `gestao@example.com`          |
| Atendimento     | `atendimento@example.com`     |
| Suporte técnico | `suporte.tecnico@example.com` |

Para atualizar somente os e-mails antigos das contas de demonstração, execute no backend `php artisan db:seed --class=GestoresSeeder`. O seeder preserva IDs, senhas, perfis e vínculos existentes; não é necessário recriar o banco. Para contas novas, a senha inicial continua sendo `password`.

- Novos tickets entram sem responsável, em `open`. Atendimento vê essa entrada e os próprios tickets; Suporte técnico vê apenas os designados para ele. Gestão/Admin têm visão global.
- Designar ou transferir coloca o ticket em `waiting`. O botão **Iniciar o atendimento** chama a rota `/assumir`; o início é manual e usa transação com bloqueio da linha. É permitido manter mais de um ticket em atendimento por operador.
- A interface não possui menu Alterar status. **Iniciar o atendimento** muda para `in_progress` e libera o campo de texto e as imagens somente para o responsável. **Finalizar o atendimento** envia `PATCH /api/gestao/ajuda/tickets/{ticket}/status` com `{"status":"resolved"}`; o formulário fica oculto novamente. O status exibido acompanha o retorno da API e os eventos em tempo real.
- A finalização é definitiva: tickets em `resolved` ficam somente para consulta. A API bloqueia reabertura, transferência, reinício e novas mensagens; para continuar o assunto, o solicitante deve abrir outro ticket. Repetir o UUID e o conteúdo de uma mensagem já salva apenas devolve o registro existente.
- Antes do início, em atendimentos de outro operador ou após a finalização, o chat mantém o histórico e mostra um aviso informativo em cinza. O aviso “Inicie o atendimento antes de responder este ticket” não é apresentado como erro. Falhas reais de requisição continuam sendo informadas separadamente.
- Só o responsável envia respostas. Gestão/Admin podem assumir um atendimento de outro operador antes de responder ou transferi-lo; a ação fica registrada no histórico.
- Transferências atualizam o responsável, a auditoria em `ticket_transfers` e as mensagens de sistema na mesma transação. A aba Histórico de transferências é exclusiva de Gestão/Admin.
- Finalizar um ticket retira-o da fila de Atendimento/Suporte técnico e do filtro `meus`. A listagem global de Gestão/Admin conserva o histórico. Finalizar não inicia o próximo atendimento automaticamente.
- O aviso de fila é atualizado na mesma mensagem de sistema. Ao iniciar, o texto passa para “Chegou sua vez! Seu atendimento foi iniciado.” A interface não exibe timer nem o antigo banner de espera.
- A rota `/status` permanece para integrações e para a ação Finalizar o atendimento, com `{"status":"resolved"}`. Tickets finalizados não podem voltar a um estado ativo. Não existe mais uma etapa separada de fechamento.
- Cada tentativa de envio mantém um UUID. Repetir a mesma requisição devolve a mensagem já salva; alterar conteúdo ou autor com o mesmo UUID retorna 409.
- O servidor determina a identidade do autor. Campos de autor enviados pelo cliente são recusados.

A lista mostra um badge com as mensagens do solicitante ainda não lidas por aquele operador. A leitura é registrada ao visualizar Mensagens com a página em foco; consultar Histórico da corrida não marca o chat de atendimento como lido. No cabeçalho, a identificação da conta substitui o botão Novo ticket para facilitar os testes.

## Fluxo e tempo real

1. O frontend envia a mensagem por HTTP com JWT, texto e UUID.
2. `TicketsController` valida acesso e dados; `TicketsAjudaService` bloqueia o ticket, salva a mensagem e atualiza o contexto em transação.
3. Após o commit, `TicketMensagemEnviada` entra na fila `broadcasts` e o worker publica pelo Reverb.
4. O solicitante recebe `.ticket.mensagem` com a mensagem no canal privado do cliente. A gestão recebe avisos `.ticket.atualizado` e `.ticket.transferido`, sem o texto da conversa, e consulta novamente a API para revalidar seu acesso. O frontend deduplica pelo ID.

Os eventos implementam `ShouldBroadcast` e `ShouldDispatchAfterCommit`: o chat só anuncia mensagens persistidas. Isso segue a [documentação de broadcasting do Laravel 13](https://laravel.com/docs/13.x/broadcasting).

| Canal privado               | Autorização                                     | Conteúdo                                                        |
| --------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `ajuda.ticket.{id}.cliente` | Guard `jwt`, usuário dono do ticket             | Mensagens e alterações do seu ticket                            |
| `ajuda.ticket.{id}.suporte` | Guard `gestores`, operador com acesso ao ticket | Avisos de atualização/transferência, sem conteúdo das mensagens |
| `ajuda.suporte`             | Guard `gestores`, Gestão/Admin                  | Avisos para atualizar a listagem global                         |
| `ajuda.entrada`             | Guard `gestores`, Atendimento e Gestão/Admin    | Avisos da fila sem responsável                                  |
| `ajuda.operador.{id}`       | Guard `gestores`, somente o próprio operador    | Avisos da fila pessoal e `.ticket.lido`                         |

O navegador da gestão autoriza em `/api/gestao/broadcasting/auth`; os aplicativos de passageiros/motoristas usam `/api/broadcasting/auth`. Os guards são separados, evitando colisões entre IDs de `users` e `gestores`.

No frontend, `src/services/echo.js` usa o cliente Axios do app para autorização, mantendo a renovação de JWT. A sessão encerra a conexão no logout. `useChatTicket.js` cancela requisições antigas ao trocar de conversa, recupera histórico por cursor e sincroniza após reconexão. Lista e chat suspendem as consultas periódicas quando o socket está conectado e o respectivo canal está autorizado. Se a conexão cair ou o canal não puder ser autorizado, consultam a cada 15 segundos como recuperação. Atualizações automáticas da lista acontecem em segundo plano, sem bloquear a interface com o carregamento.

`ChatTicket.vue` usa [QChatMessage do Quasar](https://quasar.dev/vue-components/chat/) com texto puro; HTML recebido em mensagens nunca é executado.

## Rotas do backend e contratos de integração

O componente **Histórico da corrida** também é reutilizado em **Motoristas saldo**, com detalhes e mapa à esquerda e conversa somente para consulta à direita. Nesse contexto, consulta GET /api/gestao/motoristas-saldo/{movimentacao}/corrida/mensagens e assina o canal privado corrida.{id}.chat.financeiro, com permissão financeiro.consultar e vínculo ao lançamento. A Central de ajuda mantém suas próprias rotas e regras de acesso aos tickets. Consulte [motoristas-saldo.md](motoristas-saldo.md) para o contrato financeiro.

Os caminhos abaixo já incluem `/api`. Em desenvolvimento, acrescente `http://localhost` antes da rota. Envie `Authorization: Bearer <token>` e `Accept: application/json`; nos POSTs/PATCHs com JSON, também `Content-Type: application/json`. Para anexos, use multipart com boundary definido pelo cliente HTTP.

Use JWT de `Gestor` nas rotas `/api/gestao/...` e JWT de `User` nas rotas dos aplicativos. A gestão continua usando `POST /api/gestao/auth/login` com `{email, password}` para autenticar. `{ticket}` é o ID numérico do atendimento; `{corrida}` é o ID numérico da corrida. Nas tabelas abaixo, `?` indica campo opcional, não faz parte do nome enviado no JSON.

### Tickets na gestão

| Método | Rota completa                                                            | O que faz / dados enviados                                                                                                |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/gestao/ajuda/tickets`                                              | Lista a fila paginada conforme o perfil. Filtros descritos abaixo.                                                        |
| POST   | `/api/gestao/ajuda/tickets`                                              | Abre para um solicitante: `{user_id, solicitante_tipo, motivo, descricao, corrida_id?}`. `user_id` pertence a `users`.    |
| GET    | `/api/gestao/ajuda/tickets/{ticket}`                                     | Retorna protocolo, solicitante, responsável, status, corrida vinculada, leitura e dados de fila.                          |
| GET    | `/api/gestao/ajuda/solicitantes`                                         | Busca usuários por `search` (nome/CPF) e `page`; retorna os perfis disponíveis.                                           |
| GET    | `/api/gestao/ajuda/operadores`                                           | Busca responsáveis para designar/transferir. Aceita `search`, `page`, `exclude_user_id`.                                  |
| POST   | `/api/gestao/ajuda/tickets/{ticket}/assumir`                             | Inicia o atendimento ou permite assunção por Gestão/Admin. Não exige corpo.                                               |
| POST   | `/api/gestao/ajuda/tickets/{ticket}/transfer`                            | Designa/transfere: `{to_user_id, note?}`. `to_user_id` é o ID de `gestores`; observação opcional de até 1.000 caracteres. |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/transferencias`                      | Auditoria paginada, da mais recente para a mais antiga; aceita `page`. Exclusivo de Gestão/Admin.                         |
| PATCH  | `/api/gestao/ajuda/tickets/{ticket}/status`                              | Altera `{status}`. `waiting` é gerenciado pela fila, não por alteração manual.                                            |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/mensagens`                           | Histórico do chat de atendimento, com cursores.                                                                           |
| POST   | `/api/gestao/ajuda/tickets/{ticket}/mensagens`                           | Envia texto/imagens como responsável; requer atendimento iniciado. Contrato de mensagens abaixo.                          |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/mensagens/{mensagem}/anexos/{anexo}` | Retorna o arquivo binário privado, após validar o acesso e o vínculo dos IDs.                                             |
| POST   | `/api/gestao/ajuda/tickets/{ticket}/leitura`                             | Marca leitura do operador: `{ultima_mensagem_id}`. O cursor só avança e a mensagem deve pertencer ao ticket.              |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/corrida/mensagens`                   | Retorna a conversa motorista/passageiro e os detalhes da corrida para a aba Histórico da corrida. Somente consulta.       |

Filtros da lista: `fila=todos|entrada|meus`, `status`, `solicitante_tipo=passageiro|motorista`, `search` (nome, CPF, motivo, ID ou protocolo), `page` e `per_page` (1 a 50, padrão 20). `todos` respeita o acesso do perfil; não concede visão global ao Suporte técnico.

### Tickets nos aplicativos de passageiro/motorista

| Método | Rota completa                                                     | O que faz / dados enviados                                                                                            |
| ------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/ajuda/tickets`                                              | Lista somente tickets do usuário autenticado; aceita os filtros de status, perfil, busca e paginação.                 |
| POST   | `/api/ajuda/tickets`                                              | Abre um ticket: `{solicitante_tipo?, motivo, descricao, corrida_id?}`. O solicitante vem do JWT; não envie `user_id`. |
| GET    | `/api/ajuda/tickets/{ticket}`                                     | Consulta um ticket próprio, incluindo o código da corrida vinculada.                                                  |
| GET    | `/api/ajuda/tickets/{ticket}/mensagens`                           | Consulta as mensagens do atendimento com cursores.                                                                    |
| POST   | `/api/ajuda/tickets/{ticket}/mensagens`                           | Envia texto/imagens para o atendimento próprio.                                                                       |
| GET    | `/api/ajuda/tickets/{ticket}/mensagens/{mensagem}/anexos/{anexo}` | Baixa/visualiza um anexo privado do próprio ticket.                                                                   |

Motivos aceitos: `corrida_com_problema`, `tarifa_incorreta`, `objeto_esquecido`, `motorista_ou_passageiro`, `outro`. A descrição inicial deve ter de 10 a 1.000 caracteres. `solicitante_tipo` aceita `passageiro` ou `motorista`; informe o perfil explicitamente quando a conta tiver ambos.

### Mensagens, retorno e erros

- Texto no chat de atendimento: `{conteudo, client_message_id}`, com até 4.000 caracteres e UUID obrigatório. Para imagens, utilize `imagens[]` em multipart, com o mesmo UUID e texto opcional; os limites estão na seção Imagens na conversa.
- Histórico de mensagens: sem cursor, últimas 50; `before_id` para anteriores ou `after_id` para novas, nunca ambos. `limit` vai de 1 a 100. O retorno contém `data`, `has_more`, `next_before_id` e `next_after_id`. No chat de atendimento, `atualizadas` recupera edições do aviso de fila sem mudar seu ID.
- Criação e envio retornam HTTP 201 com o registro em `data`. Consulta de ticket retorna o registro em `data`; a lista de tickets retorna `data`, `links` e `meta` de paginação. GET de anexo retorna binário, não JSON.
- Erros usuais: 401 (autenticação), 403 (permissão), 404 (registro/vínculo sem acesso), 409 (estado incompatível ou UUID reutilizado com conteúdo diferente), 422 (validação) e 429 (limite de requisições).

### Conversa da corrida, autorização do WebSocket e compatibilidade

| Método | Rota completa                       | O que faz / dados enviados                                                                      |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/corridas/{corrida}/mensagens` | Retorna a conversa do motorista e passageiro vinculados, com cursores; não é o chat de suporte. |
| POST   | `/api/corridas/{corrida}/mensagens` | Envia `{conteudo, client_message_id}` como participante, nas situações permitidas da corrida.   |
| POST   | `/api/broadcasting/auth`            | Autoriza canal privado com JWT de `User`: `{socket_id, channel_name}`.                          |
| POST   | `/api/gestao/broadcasting/auth`     | Autoriza canal privado com JWT de `Gestor`: `{socket_id, channel_name}`.                        |
| GET    | `/api/ajuda/chamados`               | Compatibilidade: últimos 50 chamados próprios com nomes antigos de status em português.         |
| POST   | `/api/ajuda/chamados`               | Compatibilidade de criação: `{motivo, descricao, corrida_id?, solicitante_tipo?}`.              |

As regras do chat da corrida, canais e campos extras para a gestão estão detalhadas na seção Conversa entre motorista e passageiro. Arquivos que registram essas rotas no backend: `routes/api/gestao.php`, `routes/api/ajuda.php`, `routes/api/corrida.php` e `routes/api.php`; a autorização dos canais fica em `routes/channels.php`.

### Abrir ticket com corrida vinculada

Para abrir um ticket vinculado a uma corrida, envie `POST /api/ajuda/tickets` com o JWT do solicitante e este JSON:

```json
{
  "solicitante_tipo": "passageiro",
  "motivo": "tarifa_incorreta",
  "descricao": "A corrida mostrava R$ 20, mas fui cobrado em R$ 30.",
  "corrida_id": 1
}
```

`corrida_id` é o ID da tabela `corridas`, e não o código nem o ID do ticket. A corrida deve pertencer ao solicitante no perfil informado; caso contrário, a API retorna 404. O vínculo continua opcional para assuntos sem corrida.

O código exibido vem de `corridas.codigo_corrida`. Por exemplo, `"corrida_id": 1` identifica a corrida `TESTE-CORRIDA-0001` criada pelo seeder de testes. Corridas fictícias usam o mesmo relacionamento das demais corridas. Criar corridas no banco não vincula tickets antigos automaticamente; tickets com `corrida_id: null` não exibem um código.

Na criação, listagem e consulta do ticket, `data.corrida` contém `id`, `codigo_corrida` e `status` (na listagem, dentro de cada item de `data`). Sem vínculo, `corrida` retorna `null`. A gestão mostra o código no cabeçalho do ticket e em Dados do cliente. A aba **Histórico da corrida** exibe a conversa entre motorista e passageiro, somente para consulta.

Exemplo para o aplicativo do solicitante:

```js
// apiCliente aponta para /api e envia o JWT de User, não o JWT de Gestor.
const { data } = await apiCliente.post(`/ajuda/tickets/${ticketId}/mensagens`, {
  conteudo: 'Preciso revisar o valor desta corrida.',
  client_message_id: crypto.randomUUID(), // Guarde este UUID para repetir uma tentativa.
})
echo
  .private(`ajuda.ticket.${ticketId}.cliente`)
  .listen('.ticket.mensagem', ({ mensagem }) => adicionarSemDuplicar(mensagem))
```

## Configuração local

Reverb já estava instalado no backend. O servidor utiliza `REVERB_SERVER_HOST/PORT`; a publicação HTTP usa `REVERB_HOST/PORT/SCHEME`. São funções distintas, como explica a [documentação do Reverb](https://laravel.com/docs/13.x/reverb).

Backend `.env`, preservando as credenciais existentes:

```dotenv
BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
# Configure REVERB_APP_ID, REVERB_APP_KEY e um REVERB_APP_SECRET forte somente no backend.
# Em produção, restrinja aos hosts dos seus aplicativos, sem protocolo:
REVERB_ALLOWED_ORIGINS=localhost,127.0.0.1
```

Frontend `.env`, com a mesma chave PÚBLICA do backend:

```dotenv
API_URL="http://localhost/api/"
REVERB_APP_KEY="mesma-chave-publica-do-backend"
REVERB_HOST="localhost"
REVERB_PORT="8080"
REVERB_SCHEME="http"
```

O segredo nunca deve ser colocado no frontend. Para testes por IP da rede, use o IP acessível pelos navegadores e inclua seus hosts em `REVERB_ALLOWED_ORIGINS`. Em produção, utilize HTTPS/WSS.

No terminal do backend aberto no container:

```powershell
php artisan migrate
php artisan optimize:clear
```

O Supervisor inclui o processo Reverb e um worker dedicado `queue:work --queue=broadcasts`. Como seu arquivo é copiado na construção da imagem, reconstrua-a para manter o worker automático após reiniciar:

```powershell
docker compose build laravel.test
docker compose up -d --no-deps --force-recreate laravel.test
```

Se executar fora do Docker, mantenha estes processos separados:

```shell
php artisan reverb:start
php artisan queue:work --queue=broadcasts --sleep=1 --tries=3 --timeout=60
```

No frontend, `npm install` instala Echo/Pusher. Reinicie `npm run dev` depois de ajustar o `.env`.

## Validação e escopo

Testes locais ficam em `.local-tests` e não entram no commit. Cobrem isolamento de conversas, guards JWT distintos, concorrência de atendimento, autoria, UUID, status, paginação e compatibilidade das rotas antigas. O teste de Reverb utiliza servidor/credenciais temporários e somente o banco `testing`.

Esta entrega contempla tickets, mensagens textuais e imagens, leitura por operador e gestão do atendimento. A interface do chat nos aplicativos de Passageiro/Motorista deve consumir os endpoints acima; este repositório contém a interface de gestão.

## Conversa entre motorista e passageiro

As mensagens dessa conversa pertencem à corrida, independentemente dos tickets abertos sobre ela. Elas ficam em `corrida_mensagens`, criada pela migration `2026_10_15_200000_create_corrida_mensagens_table.php`. A tabela guarda `corrida_id`, `user_id`, o perfil e nome do autor, texto, UUID da tentativa e datas. A exclusão da corrida remove suas mensagens; a exclusão física do usuário preserva o nome e o texto registrados.

| Método | Rota                                                   | Quem pode usar                                          |
| ------ | ------------------------------------------------------ | ------------------------------------------------------- |
| GET    | `/api/corridas/{corrida}/mensagens`                    | Passageiro solicitante e motorista vinculados à corrida |
| POST   | `/api/corridas/{corrida}/mensagens`                    | Os mesmos participantes, do aceite até o fim da corrida |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/corrida/mensagens` | Operador com acesso atual ao ticket vinculado           |

O envio utiliza o JWT de `User`, com JSON:

```json
{
  "conteudo": "Estou na entrada principal.",
  "client_message_id": "fba0b272-5c7d-47f8-a383-4a54f8c242fa"
}
```

Use um UUID novo para cada mensagem e repita o mesmo UUID e texto em novas tentativas da mesma mensagem. O servidor identifica o autor pelo token; não envie `user_id`, `autor_tipo` ou `autor_nome`. Esta conversa aceita texto com até 4.000 caracteres. Os anexos do chat de atendimento continuam na API de tickets.

O POST exige corrida em `aceita`, `motorista_chegou` ou `em_andamento`, com motorista designado. Em `finalizada` ou `cancelada`, o histórico permanece disponível, mas novas mensagens retornam 409. Corridas aguardando pagamento, solicitadas ou em busca também não permitem envio. Repetir uma mensagem já salva com o mesmo UUID e texto continua devolvendo seu registro mesmo depois do encerramento.

Os GETs retornam `data` (mensagens), `corrida` (código, status e nomes dos participantes), `pode_enviar`, `has_more`, `next_before_id` e `next_after_id`. Sem cursor, vêm as últimas 50 mensagens, em ordem cronológica. Use `before_id` para anteriores ou `after_id` para novas, com `limit` de até 100. A consulta da gestão sempre retorna `pode_enviar: false`; não existe rota de envio para gestores nessa conversa.

O evento `.corrida.mensagem` é publicado após o commit nos canais privados `corrida.{id}.chat` (JWT dos participantes) e `corrida.{id}.chat.suporte` (JWT de operador autorizado). Seu payload contém apenas `corrida_id` e `mensagem_id`. Ao receber o aviso, o consumidor consulta a API com seu cursor e revalida o acesso. Assim, assinaturas antigas não recebem conteúdo após a troca de motorista ou transferência do ticket.

Na gestão, a assinatura só existe enquanto a aba Histórico da corrida está aberta. A conversa atualiza sem F5 e sem consultas periódicas quando o canal está autorizado e conectado. Reconexão recupera o intervalo perdido; a consulta a cada 15 segundos só funciona como recuperação quando o tempo real está indisponível. Trocar de ticket ou de aba cancela as consultas antigas e encerra essa assinatura.

Na mesma aba, os detalhes ficam à esquerda e a conversa à direita. Em telas estreitas, os painéis ficam um abaixo do outro. A consulta da gestão também retorna em `corrida` o produto, veículo, horários, duração em segundos, distância, situação do pagamento, financeiro e destinos ordenados com coordenadas. Esses dados extras não são enviados na consulta dos participantes. Campos ausentes aparecem como não informados; o histórico não altera valores nem cria cobranças.

### Campos dos detalhes da corrida

| Informação na interface          | Campo retornado pela consulta da gestão                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Código e situação da corrida     | `corrida.codigo_corrida`, `corrida.status`                                                                              |
| Produto, veículo e participantes | `corrida.produto`, `corrida.veiculo`, `corrida.motorista.nome`, `corrida.passageiro.nome`                               |
| Duração e distância              | `corrida.duracao_segundos`, `corrida.distancia_km`; duração calculada entre início e fim registrados                    |
| Datas                            | `corrida.solicitada_em`, `corrida.iniciada_em`, `corrida.finalizada_em`                                                 |
| Método e situação do pagamento   | `corrida.metodo_pagamento`, `corrida.status_pagamento`                                                                  |
| Ganho do motorista               | `corrida.financeiro.valor_liquido_motorista`                                                                            |
| Valor do passageiro e crédito    | `corrida.financeiro.valor_pago_passageiro`, `corrida.financeiro.credito_aplicado`                                       |
| Valor bruto e adicionais         | `corrida.financeiro.valor_bruto`, `valor_dinamico_aplicado`, `taxa_espera`, `valor_ajuste_negociado`, `valor_descontos` |
| Plataforma                       | `corrida.financeiro.taxa_plataforma_valor`, `taxa_plataforma_percentual`, `subsidiado_plataforma`                       |
| Outras cobranças                 | `corrida.financeiro.taxa_cancelamento`, referente à própria corrida                                                     |
| Trajeto e mapa                   | `corrida.destinos[]`: `tipo`, `ordem`, `endereco`, `nome_local`, `latitude`, `longitude`, `concluida_em`                |

O título “Pago pelo passageiro” e a indicação “Dinheiro recebido” dependem do status `pago`; nos demais casos, a interface informa cobrança ou recebimento não confirmado. O complemento da plataforma vem de `subsidiado_plataforma`. A coluna `valor_repassado_plataforma` não é apresentada como dinheiro recebido pelo motorista. A composição exibe os valores gravados; o frontend não soma novamente os adicionais para recalcular o ganho.

Componentes do frontend: `ChatTicket.vue` organiza as abas; `HistoricoChatCorrida.vue` divide os painéis; `DetalhesCorrida.vue` exibe o resumo; `MapaCorrida.vue` renderiza o mapa; `useHistoricoChatCorrida.js` controla consultas, paginação e assinatura. No backend, `ChatCorridaController::historicoTicket` revalida o acesso e acrescenta os campos de `DetalhesCorridaResource` ao retorno do chat.

O mapa usa [Leaflet](https://leafletjs.com/reference.html) e o fundo do [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), com atribuição visível. Mostra origem, paradas e destino. A linha tracejada apenas liga os pontos registrados; o banco atual não contém um percurso de GPS gravado. O mapa carrega no navegador e não faz chamadas de roteamento na consulta do histórico.

Para criar o exemplo completo em desenvolvimento, sem apagar registros existentes:

```shell
php artisan db:seed --class=HistoricoCorridaDemonstracaoSeeder
```

O seeder exige as contas de `CadastroDesenvolvimentoSeeder`, cria a corrida `DEMO-HISTORICO-001`, três pontos de trajeto, valores financeiros, seis mensagens fictícias e um ticket vinculado. A saída informa o protocolo do ticket. Pode ser repetido sem duplicar os dados e não sobrescreve edições existentes.

Na base local em que o exemplo foi criado, o resultado foi **ticket `AJ-000006`**, ligado à **corrida ID `31`, código `DEMO-HISTORICO-001`**. Para consultar, entre com Gestão/Admin, abra Central de ajuda, pesquise `AJ-000006` e selecione Histórico da corrida. Esses IDs podem mudar após recriar o banco; use o protocolo informado pelo seeder. O exemplo tem duração de **15m 56s**, distância de **5,6 km**, ganho do motorista de **R$ 16,20** e valor pago pelo passageiro de **R$ 15,23**.

O catálogo de corridas fictícias anterior é separado: `php artisan db:seed --class=CorridasTesteSeeder` cria até 30 corridas (`TESTE-CORRIDA-0001` a `TESTE-CORRIDA-0030`), com 20 finalizadas, 10 canceladas, 84 pontos de trajeto e 30 financeiros. Reaproveita os produtos Normal, Negocia e Expresso e exige um passageiro, motorista vinculado a carro e Porto Velho cadastrados. Não cria tickets automaticamente nem sobrescreve as corridas de teste existentes. Ambos os seeders são exclusivos de `local`/`testing`.

Nos aplicativos de motorista/passageiro, a interface de envio deve consumir as rotas acima e assinar `corrida.{id}.chat` com o JWT do participante. Este repositório implementa a tela de consulta da gestão; as interfaces desses aplicativos ficam nos respectivos projetos.

## Imagens na conversa

No chat, use o botão de imagem ou cole um print com `Ctrl + V`. É possível enviar apenas a imagem ou acrescentar texto. Clique na miniatura para ampliar e baixar. `Enter` envia a mensagem e `Shift + Enter` quebra a linha.

- Até 3 imagens por mensagem, com até 5 MB cada, nos formatos JPG, PNG ou WebP.
- A API também valida o conteúdo do arquivo, as dimensões (até 12.000 pixels por lado) e o limite de 40 megapixels.
- A migration `2026_10_15_190000_create_chamado_mensagem_anexos_table.php` cria os metadados em `chamado_mensagem_anexos`. Os arquivos ficam no disco privado `ticket_anexos`, em `storage/app/private/ticket_anexos`; não precisam de `storage:link`.
- O envio mantém o endpoint `POST /ajuda/tickets/{id}/mensagens`. Para imagens, utilize `multipart/form-data` com `client_message_id`, `conteudo` opcional e `imagens[]`. Deixe o cliente HTTP definir o boundary.
- Repita o mesmo UUID, texto e arquivos em caso de falha para evitar duplicação. Alterar o conteúdo ou as imagens com um UUID já usado retorna 409.

Exemplo para o aplicativo do solicitante (base `/api`):

```js
const formulario = new FormData()
formulario.append('client_message_id', crypto.randomUUID())
formulario.append('conteudo', 'Segue o print do problema.')
formulario.append('imagens[]', arquivo)
const { data } = await apiCliente.post(`/ajuda/tickets/${ticketId}/mensagens`, formulario)
```

As mensagens retornam `anexos`, contendo `id`, `nome`, `mime_type`, `tamanho`, `largura`, `altura` e `url`. A URL é relativa à base da API do perfil autenticado:

| Método | Rota                                                                     | Autorização                                |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------ |
| GET    | `/api/ajuda/tickets/{ticket}/mensagens/{mensagem}/anexos/{anexo}`        | JWT do solicitante dono do ticket          |
| GET    | `/api/gestao/ajuda/tickets/{ticket}/mensagens/{mensagem}/anexos/{anexo}` | JWT do operador com acesso atual ao ticket |

O GET retorna o arquivo binário. No navegador, busque com Axios autenticado e `responseType: 'blob'`, depois gere uma URL com `URL.createObjectURL`. Não coloque o JWT na URL. Um operador que perde acesso ao ticket também perde acesso aos seus anexos na API. A resposta e o evento de mensagem incluem os metadados dos anexos; o evento só é disparado após a persistência da mensagem e das imagens.
