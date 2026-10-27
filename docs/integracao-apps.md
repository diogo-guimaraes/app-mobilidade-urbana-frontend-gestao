# Integração com os apps de passageiro e motorista

Este documento resume como os apps (`app-mobilidade-urbana-frontend-passageiro` e `app-mobilidade-urbana-motorista`) consomem o backend nas partes que também aparecem no painel. Complementa `central-ajuda.md`.

## Central de Ajuda nos apps

Os dois apps usam as rotas de tickets descritas em `central-ajuda.md` (`/api/ajuda/tickets...`) com o JWT de `User`:

- **Lista:** `GET /api/ajuda/tickets?per_page=20`. O motorista filtra com `solicitante_tipo=motorista`, porque a mesma conta pode ter os dois perfis.
- **Abertura:** `POST /api/ajuda/tickets` com `{motivo, descricao, corrida_id?}`. O motorista envia também `solicitante_tipo: "motorista"`. Depois de criar, o app abre a conversa do ticket.
- **Conversa:** `GET/POST /api/ajuda/tickets/{id}/mensagens`. Cada mensagem leva um `client_message_id` (UUID v4 gerado no app); repetir o envio com o mesmo UUID não duplica.
- **Imagens:** uma por mensagem, em `multipart/form-data` (`imagens[]`). A miniatura busca o binário pela `url` relativa do anexo, com o cabeçalho `Authorization`.
- **Tempo real:** canal privado `ajuda.ticket.{id}.cliente`, eventos `.ticket.mensagem` (com a mensagem) e `.ticket.atualizado`. Sem socket, o app consulta a cada 6 s com `after_id`.
- **Status mostrado ao usuário:** `open` → "Recebido · aguardando atendimento", `waiting` → "Na fila de atendimento" (com o aviso `fila.mensagem` no topo), `in_progress` → "Em atendimento", `pending` → "Aguardando sua resposta", `resolved` → "Resolvido" (responder reabre), `closed` → "Encerrado" (o campo de mensagem some).
- A rota antiga `/api/ajuda/chamados` não é mais usada pelos apps.

## Conversa da corrida (motorista ↔ passageiro)

- Os dois apps usam `GET/POST /api/corridas/{id}/mensagens` do `ChatCorridaController`, do aceite até o fim da corrida (`pode_enviar`).
- O evento `.corrida.mensagem` no canal `corrida.{id}.chat` traz só os ids. O app busca as mensagens novas com `after_id`.
- O botão de chat da tela da corrida mostra quantas mensagens não foram lidas. O ponto de leitura fica no próprio aparelho (`@chat_corrida_visto:{id}`).
- A aba "Histórico da corrida" do painel mostra essa mesma conversa.

## Push (Firebase Cloud Messaging)

- **Registro do aparelho:** o app manda o token FCM do aparelho com a sessão aberta, em `POST /api/dispositivos-push` `{token, perfil: passageiro|motorista, plataforma}`. Ao sair da conta, envia `DELETE /api/dispositivos-push` `{token}`. Se o mesmo token chegar de outra conta, ele passa para essa conta.
- **Envio:** `NotificarUsuarioService::executar()` grava a notificação (tela Notificações do app) e manda o push depois da resposta HTTP, via `EnviarPushService`, pela API HTTP v1 do FCM. A assinatura usa a conta de serviço; não depende de conta Expo/EAS.
- **Canal Android:** `corridas`. Os dados vêm em `data.corrida_id` e `data.status`.
- **Avisos ao passageiro:** "Motorista a caminho" (aceite), "Seu motorista chegou" (com carro e placa), "Corrida iniciada", "Corrida cancelada" quando o motorista ou o sistema cancela, e "Viagem concluída".
- **Avisos ao motorista:** "Corrida cancelada" quando o passageiro ou o sistema cancela, e "O passageiro escolheu sua proposta", além dos avisos de pagamento.

**Configuração:**

- **Backend:** `FIREBASE_CREDENTIALS` aponta para o JSON da conta de serviço (Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada), guardado fora do git, por exemplo em `storage/app/private/firebase.json`. Sem essa variável o push é ignorado e só a notificação no app é gravada.
- **Apps:** coloque o `google-services.json` na raiz de cada app (ou informe `GOOGLE_SERVICES_FILE`) e gere o build de novo, porque o `expo-notifications` é módulo nativo. O arquivo precisa conter o pacote Android de cada app (`ANDROID_APP_PACKAGE`).

## Despacho e Negocia (regras que o painel pode exibir)

- **Trajeto da oferta:** `GET /api/motorista/corridas-disponiveis` devolve `trajeto` (origem, paradas e destino em ordem), usado para desenhar a rota no mapa enquanto a chamada toca.
- **Propostas ao pegar uma corrida:** quando um motorista pega uma corrida (aceita uma normal ou é escolhido num Negocia), as outras propostas dele que esperavam passageiro passam para `cancelada` em `corrida_negociacoes`.
- **Validade da proposta:** `minha_proposta.validade_segundos` informa ao app a validade (padrão 20 s, `NEGOCIA_PROPOSTA_VALIDADE_SEGUNDOS`).
- **Valores sugeridos ao motorista:** oferta do passageiro + R$ 1, + R$ 2,50 e + R$ 4. O teto do backend continua sendo o dobro da oferta.

## Publicidade

- O app do motorista mostra os banners da cidade do usuário com `GET /api/banners?cidade={nome}&uf={UF}`. A cidade vem do GPS do aparelho.
- A imagem é servida pela URL do disco `publicidade.disco`. Em desenvolvimento, `AWS_URL` precisa apontar para o IP da máquina na rede.
