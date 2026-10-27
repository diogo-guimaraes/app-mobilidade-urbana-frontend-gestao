# Cadastro de veículo pelo aplicativo

**Meus veículos** destaca o veículo selecionado, com ano, marca/modelo, placa,
cor/UF e categorias de viagem retornadas em `categorias_servico` pela API. A
lista **Outros veículos** permanece abaixo para troca e exclui o selecionado;
ao trocar, o anterior volta à lista. As categorias começam recolhidas e são
expandidas ao tocar no título. O botão **Adicionar veículo** fica no rodapé,
sem conteúdo promocional. O destaque muda somente após confirmação da troca
pelo servidor. Como ainda não há foto própria no cadastro, a imagem é ilustrativa.
As categorias usam `ProdutosCorrida::atendidosPor`, como no despacho, sem
inventar modalidades ou liberar categorias especiais pendentes.

O componente de cadastro preserva o fluxo de seleção de Moto/Carro,
tipo de solicitação, documentos, CRLV físico/PDF e orientações de envio. As
ilustrações foram extraídas do vídeo de referência fornecido. Câmera, galeria,
permissões e arquivos usam os seletores nativos de Android/iOS.

Após o envio de foto ou PDF, o cadastro fecha e retorna a **Meus veículos**.
A lista inclui veículos vinculados em análise e solicitações de cadastro ainda
sem veículo criado, identificadas como **Em análise**. Os dados reconhecidos do
CRLV aparecem no cartão; dados ausentes não são inventados. Esses cartões não
são identificados como veículos em uso. Solicitações aprovadas deixam de ser
mostradas como pendentes e passam a aparecer como veículos cadastrados na
próxima consulta.

Os cards de veículos aprovados permitem escolher o veículo em uso somente com
o motorista desconectado e sem corrida ativa. A seleção é gravada no mesmo
`status_buscas.veiculo_id` usado pelo despacho, refletida no menu e mantida ao
reabrir o app. A listagem informa `veiculo_ativo_id`, `pode_trocar_veiculo` e
`pode_selecionar` em cada veículo. Cards em análise permanecem bloqueados.
O motorista continua offline ao selecionar, e sua posição não é alterada.

O envio do CRLV extrai os campos no backend e os salva junto com a solicitação
em análise. PDF digital usa a camada de texto; fotos e PDFs digitalizados usam
OCR local. A leitura não aprova o documento. Não altera o CRLV do veículo atual
nem o status do motorista. Campos ilegíveis ou divergentes exigem correção.
Fotos são orientadas, ampliadas e tratadas para contraste; os rótulos são
localizados antes de filtrar a confiança dos valores. Campos faltantes são
relidos em recortes individuais e, se necessário, na imagem original. O número
do CRV mascarado com `***` permanece vazio.

Antes de salvar o envio, o backend compara o tipo reconhecido em **Espécie/Tipo**
do CRLV com a opção Carro/Moto escolhida no aplicativo. Moto enviada como carro
e carro enviado como moto retornam HTTP 422, sem armazenar arquivo ou solicitação.
Se não conseguir identificar o tipo, pede um PDF legível ou uma foto nítida; não
assume a categoria escolhida. A validação vale para PDF, PDF digitalizado e foto.
O tipo é validado antes da duplicidade: mesmo que o arquivo já esteja em análise,
uma escolha Carro/Moto incompatível mostra primeiro a mensagem de tipo incorreto.
O campo **Categoria** do CRLV (por exemplo, PARTICULAR) não define Carro/Moto.

A identificação é salva em `solicitacao_veiculo.categoria_identificada`, gerada
somente pelo servidor. Conferência e aprovação também verificam essa identificação.
Para solicitações antigas sem esse campo, o arquivo original é relido; uma
divergência impede a aprovação, mesmo que o campo editável tenha sido alterado.

## Conferência na gestão

1. Abra **Motoristas → Documentos** do motorista que enviou o arquivo.
2. Localize **Novo veículo enviado pelo app**. Cada envio aparece separadamente.
3. Expanda o documento. Os campos salvos são exibidos. Envios antigos ou
   incompletos são lidos e salvos automaticamente, preservando dados conferidos.
4. Confira a prévia e complete manualmente o que não for reconhecido.
5. Clique em **Aprovar**. Eventuais correções são validadas e salvas antes da
   aprovação; uma falha nessa gravação impede aprovar. Não há botão separado de
   salvar conferência. Somente na aprovação o veículo é cadastrado, vinculado ao
   motorista e disponibilizado em Meus veículos.

A reprovação permanece vinculada ao documento enviado. Um novo envio conserva
o histórico anterior. Cadastro de veículo já existente deve seguir o fluxo de
compartilhamento/renovação, sem substituir o CRLV atual por essa solicitação.

## Backend compartilhado

Antes de usar em outra máquina, execute `php artisan migrate` no backend. A nova
migration adiciona somente `solicitacao_veiculo` (JSON, nullable) em
`motorista_documentos_anexos`. A migration já foi aplicada no ambiente local.

A imagem Docker `docker/8.5-nginx` inclui `poppler-utils`, `tesseract-ocr` e
`tesseract-ocr-por`. Em outra máquina, reconstrua a imagem com
`docker compose build laravel.test` e recrie o serviço com
`docker compose up -d laravel.test`. Fora do Docker, instale os mesmos pacotes
no servidor. Não há dependência de serviço externo para ler os documentos.
O tratamento das fotos usa a extensão PHP Imagick, já incluída nessa imagem.
O OCR tem limite total de 20 segundos; falhas preservam o arquivo em análise
para preenchimento manual, sem bloquear o envio nem aprovar dados incompletos.

- `GET /api/motorista/me/solicitacoes-veiculo`: solicitações da conta autenticada.
- `GET /api/motorista/me/veiculos?incluir_em_analise=true`: veículos vinculados
  visíveis para a listagem. Sem esse parâmetro, a consulta mantém apenas os
  liberados, preservando o comportamento da seleção para corridas.
- `PUT /api/motorista/me/veiculo-ativo`: recebe `{ "veiculo_id": ID }`, exige
  veículo vinculado e aprovado (inclusive o CRLV, quando existente) e motorista
  offline sem corrida ativa. Trocas por `/motorista/disponibilidade` também
  seguem esse bloqueio, impedindo contornar a regra pela API.
- `POST /api/motorista/me/solicitacoes-veiculo`: categoria, tipo_solicitacao,
  formato, id_envio e arquivo multipart. Fotos ou PDF até 10 MB; digital exige PDF.
- `PUT /api/gestao/motorista-documentos/{id}`: salva os dados conferidos da
  solicitação, com permissão `documentos.analisar`. Com
  `{ "leitura_automatica": true }`, preenche e persiste os campos faltantes a partir
  do arquivo já enviado. Dados completos não são lidos novamente.
- `PUT /api/gestao/mudar-status-documento/{id}`: aprove/reprove pelo fluxo existente.

O identificador `id_envio` evita documentos/arquivos duplicados ao repetir uma
requisição após timeout. O motorista não escolhe IDs de terceiros nem aprova
a própria solicitação. A CNH com EAR mostra o estado real retornado pelo backend.

## CRLVs repetidos e validações

No fluxo de **Adicionar veículo**, repetir o mesmo `id_envio` continua retornando
o envio existente, sem criar outro registro. Um novo ID não permite repetir um
CRLV que esteja em análise ou aprovado para o mesmo motorista:

- O SHA-256 do conteúdo detecta o mesmo arquivo mesmo quando renomeado.
- Exercício e placa, RENAVAM ou chassi detectam o mesmo CRLV em arquivos diferentes.
- Envios antigos sem SHA-256 são comparados com o conteúdo já armazenado.
- A verificação final ocorre com bloqueio do motorista na transação; um arquivo
  recusado é removido sem afetar o documento anterior.

O app recebe erro de validação com a orientação para consultar o envio existente.
Arquivos reprovados podem ser reenviados. Outro exercício não é confundido com
o CRLV anterior; isso não dispensa as regras do fluxo de renovação. Os registros
repetidos existentes são preservados como histórico.

As validações de correspondência de placa/RENAVAM/chassi, substituição de CRLV
do exercício atual, exigência de exercício atual na renovação e impedimento de
autoaprovação foram reativadas. A identificação do motorista considera o tipo
do usuário autenticado, evitando confundir IDs iguais nas tabelas de gestores
e usuários do aplicativo.

## Validação

Testes de integração do backend usam exclusivamente o banco `testing`. Os novos
cenários estão em `tests/Feature/SolicitacoesVeiculoAppTest.php`; a configuração
atual do repositório mantém testes locais fora do Git.

Também foram verificados TypeScript, lint e bundles Android/iOS do motorista,
além do lint e build da gestão. Câmera, permissões e comparação visual final
precisam de conferência no aparelho físico.

## Detalhes e remoção do veículo no app

Em **Meus veículos**, cada card de **Outros veículos** abre a tela **Detalhes do
veículo** (status, placa, dados cadastrados e tipos de serviço disponíveis). A
bolinha ao lado do status continua escolhendo o veículo em uso, e a mesma ação
existe como **Usar este veículo** na tela de detalhes.

**Remover este veículo** chama `DELETE /api/motorista/me/veiculos/{veiculo}`.
Só o vínculo do motorista com o veículo é desfeito: o veículo e os documentos
(CRLV) permanecem para a gestão e para outros motoristas que o usam. A situação
do motorista é recalculada, então ficar sem veículo aprovado o volta para
pendente. A API recusa (HTTP 409) quando o motorista está online ou em corrida, e
responde 404 para veículo que não é dele. O veículo em uso também pode ser
removido; sem ele, o motorista volta a usar o próximo veículo cadastrado.
