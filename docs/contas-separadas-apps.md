# Contas separadas de motorista e passageiro

Motorista e passageiro têm contas próprias, cada um com login, senha e token na sua tabela, como os gestores. A tabela `users` não existe mais.

Até 13/10 o projeto já teve contas separadas, e o commit `0b2e1dc` juntou tudo em `users`. A decisão de separar de novo foi tomada sabendo disso.

## Dados de cada conta

| Tabela | Colunas da conta (antes dos timestamps) |
|---|---|
| `motoristas` | `name`, `telefone`, `email`, `email_verified_at`, `password`, `remember_token`, além de `cpf`, `data_nascimento` e `foto` que já existiam, e `cidade_id` (a cidade onde roda) |
| `passageiros` | `name`, `telefone`, `cpf`, `data_nascimento`, `email`, `email_verified_at`, `password`, `remember_token`, `foto` |

- Telefone, e-mail e CPF são únicos **dentro de cada tabela**. A mesma pessoa pode ter cadastro de motorista e de passageiro, inclusive com o mesmo e-mail, e cada um tem a sua senha.
- O passageiro tem CPF porque a cobrança Pix e cartão na AbacatePay manda o CPF dele.
- O motorista tem um nome só, em `name`: o da CNH, ou o do cadastro enquanto a CNH não é lida. As respostas da API também trazem `nome`, com o mesmo valor.
- Os dados de quem já estava cadastrado foram copiados de `users` para o perfil antes de a tabela sair. Quem tinha os dois perfis ficou com as credenciais nos dois, e a mesma senha vale nos dois até ser trocada.

## Login de cada app

| Rota | O que faz |
|---|---|
| `POST /api/{app}/auth/login` | E-mail e senha, procurados só na tabela do app |
| `POST /api/{app}/auth/enviar-codigo` | Código por SMS |
| `POST /api/{app}/auth/verificar-codigo` | Entra pelo código. Sem cadastro naquele app, responde 401 e o app segue para o cadastro |
| `GET /api/{app}/auth/verifica-se-conta-existe` | `contaExiste` naquele app, pelo telefone |
| `POST /api/{app}/auth/valida-email-cadastro` | Avisa já na tela do e-mail se ele está em uso naquele app |
| `POST /api/{app}/auth/register` | Cadastro direto na tabela do app |
| `POST /api/{app}/auth/refresh` | Renova o token |
| `POST /api/{app}/auth/logout` | Encerra a sessão |

`{app}` é `motorista` ou `passageiro`. Cada um tem o próprio guard JWT (`motoristas` e `passageiros`), e **o token de um app não vale no outro**. As rotas antigas `/api/auth/*` e o header `X-Perfil` saíram: quem está logado é sempre o perfil do token.

O resto da API dos apps aceita os dois tokens. Cada rota pega o perfil que precisa; com o token do outro app, responde como antes respondia para quem não tinha aquele perfil.

Cadastro de veículos, tarifas, produtos e categorias, publicidade e cidades, motoristas e análise de documentos ficam **só** em `/api/gestao/...`, com token de gestor. Antes essas rotas também estavam no grupo dos apps e qualquer motorista ou passageiro logado as alcançava. Por exemplo, dava para listar todos os motoristas com e-mail, telefone e CPF. Nenhum app usava essas rotas. Dos apps, só `GET /api/banners` continua, para mostrar os banners da cidade, e `GET /api/motorista/cidades`, que só lista as cidades para o motorista escolher a sua.

O `id` do usuário nas respostas é o **id do perfil**. `/api/usuario-logado` e as rotas de foto continuam com o mesmo caminho.

Perfil arquivado, bloqueado ou inativo não entra (403). Depois da mudança, quem estava logado precisa entrar de novo nos apps.

## Perfil no app do motorista

Na tela **Perfil** (menu, foto do motorista, Configurações) o motorista troca a foto, o telefone, o e-mail e a cidade.

| Rota | O que faz |
|---|---|
| `PUT /api/usuario-alterar-foto-perfil/{id}` | Foto da galeria ou da câmera (`image`, até 5 MB) |
| `POST /api/usuario-alterar-contato/codigo` | `campo` (`telefone` ou `email`) e `valor`: confere se está livre e manda um código de 4 dígitos |
| `PUT /api/usuario-alterar-contato` | `campo`, `valor` e `codigo`: troca só com o código certo |
| `GET /api/motorista/cidades` | Os 5.570 municípios (`id`, `nome`, `uf`), cerca de 250 KB. O app baixa uma vez por sessão |
| `PUT /api/motorista/me/cidade` | `cidade_id`, uma das cidades da lista |

- A troca de contato vale para os dois apps, mas por enquanto só o app do motorista a usa.
- O telefone é gravado só com os números, como no cadastro, e o e-mail em minúsculas.
- O telefone e o e-mail têm que estar livres naquele app. O código vale 30 minutos e só para o valor para o qual foi pedido.
- O SMS e o e-mail ainda são simulados, como no login: em desenvolvimento o código volta na resposta, e o app mostra **Preencher código**.
- Na tela, o motorista busca a cidade pelo nome, sem acento nem maiúscula, a partir da 2ª letra. Cada resultado mostra a UF. O estado vem da cidade escolhida (`cidades.uf_id`). Sem busca, aparece só a cidade atual.
- A cidade escolhida volta em `cidade` (`id`, `nome`, `uf`, `uf_id`) no login e em `/api/usuario-logado`. No passageiro, `cidade` vem sempre `null`.

## Estados e cidades

A tabela `cidades` tem todos os 5.570 municípios do IBGE, e a tabela `estados`, os 27 estados. Os dois são carregados pela migration `2026_11_16_110000_create_estados_e_carrega_cidades`, a partir de `database/data/municipios.php`.

- **`estados`:** `id` (o código do estado no IBGE, 11 = Rondônia), `nome` e `sigla`.
- **`cidades`:** ganhou `uf_id`, que aponta para `estados`. O `ibge` passou a ser único.
- **Cidades que já existiam:** mantiveram o `id`, porque tarifas, banners e corridas apontam para elas.
- **Coluna `uf`:** a sigla continua em `cidades.uf`. Ao criar ou editar uma cidade pela sigla, o `uf_id` é preenchido sozinho.
- **Seeder:** as cidades saíram do `DemonstracaoCompletaSeeder`.
- **Origem dos dados:** o dump `brasil.sql`, tabelas `municipio` e `uf`.
  - Nele, as palavras que começam com "d" estavam em minúscula ("São domingos", "dom Eliseu"). O mesmo valia para "D'oeste", "Pio Xii" e " E ".
  - 187 nomes foram corrigidos.
  - "da", "de", "do", "das", "dos" e "del" continuam em minúscula ("São João del Rei").
- **Rollback:** desfazer a migration apaga `estados` e `uf_id`, mas mantém as cidades, porque outras tabelas podem apontar para elas.

## O que passou a apontar para o perfil

| Tabela | Antes | Agora |
|---|---|---|
| `cotacoes_corrida`, `locais_salvos`, `sugestoes_locais` | `user_id` | `passageiro_id` |
| `chamados_ajuda` | `user_id` | `solicitante_id`, com o `solicitante_tipo` que já existia |
| `notificacoes`, `dispositivos_push` | `user_id` | `perfil_id`, com o `perfil` que já existia |
| `avaliacoes_corridas` | `usuario_id` | `avaliador_id`, com o `tipo_usuario` que já existia |
| `chamado_mensagens`, `corrida_mensagens` | `user_id` | saiu: o autor vem do tipo (cliente do chamado, ou passageiro e motorista da corrida) |
| `corrida_negociacoes` | `usuario_id` | saiu: quem propõe já está em `motorista_id` |

As transferências de chamado (`ticket_transfers`) continuam com `from_user_id` e `to_user_id`, que sempre foram ids de gestores.

**Motorista não atende a própria corrida:** a regra agora compara o CPF do motorista com o do passageiro. Motorista que ainda não informou o CPF (antes da CNH) não é barrado.

A migration `2026_11_13_120000_perfis_no_lugar_de_users` não tem volta: o rollback não recria `users`.

## Na gestão

- A seção **Usuários** saiu. Motoristas e passageiros são criados e editados nas próprias telas, com os dados de acesso de cada um. Criar motorista não pede mais um usuário.
- O botão **Editar** nas listas de motoristas e passageiros altera nome, e-mail, telefone, CPF, nascimento e foto do próprio cadastro.
- O botão **Arquivar** das listas de motoristas e passageiros saiu: ele arquivava a conta em `users`. Para impedir o acesso, use o status do perfil (bloqueado ou inativo).
- Na Central de Ajuda, ao abrir um chamado pela gestão, a busca mostra cada motorista e cada passageiro em uma linha, com o tipo.
- A senha e o token de lembrar não saem em nenhuma resposta.
