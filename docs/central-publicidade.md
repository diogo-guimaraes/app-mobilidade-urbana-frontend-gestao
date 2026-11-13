# Central de Publicidade: banners no app do motorista

A gestão cadastra os anúncios em `/publicidades` (Central de Publicidade). O acesso exige a permissão `configuracoes.gerenciar`. Cada banner pertence a uma cidade e aparece no app do motorista que está nela.

## Cadastro

**Criar anúncio** pede três campos:

- **Título**: de 3 a 120 caracteres. É também o texto lido pelo leitor de tela no app.
- **Cidade**: escolhida entre os municípios do IBGE, buscando pelo nome no próprio campo. Sem ela, o banner não aparece para ninguém.
- **Imagem**: JPG, PNG ou WEBP de até 5 MB (`PUBLICIDADE_TAMANHO_MAXIMO_KB`).

O app exibe a imagem na proporção 2,4 : 1 (por exemplo, 1200 × 500) e corta o que passar dela. O nome do arquivo é gerado pelo servidor, e a imagem fica no disco `publicidade.disco`.

## Ativos e arquivados

**Arquivar** pede confirmação, tira o banner do app e o leva para a aba **Arquivados** (exclusão reversível, `DELETE /api/gestao/publicidades/{id}`). Em **Arquivados**, o botão **Restaurar** devolve o banner ao app (`POST /api/gestao/publicidades/{id}/restaurar`). A aba lista os banners com `GET /api/gestao/publicidades-arquivados`.

O botão de arquivar só mexe no banner. Antes, ele chamava a rota de usuários com o id do banner e arquivava o usuário que tivesse o mesmo id.

Uma cidade que tem banner, mesmo arquivado, não pode ser excluída (409).

## No app do motorista

Os banners ficam na folha inferior da home, logo abaixo da alça, num carrossel que troca sozinho a cada 5 segundos. O mais novo aparece primeiro.

A cidade vem do GPS do aparelho e é consultada uma vez ao abrir a home, com `GET /api/banners?cidade={nome}`. Sem permissão de localização, ou numa cidade sem cadastro, o app não mostra banner.

Enquanto houver qualquer item em **Ações necessárias**, os banners não aparecem. Eles voltam quando a lista fica vazia.

## Ambiente de desenvolvimento

As imagens ficam no RustFS do Sail. No `.env` do backend:

```
AWS_BUCKET=publicidade
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_ENDPOINT=http://rustfs:9000
AWS_URL=http://<IP do computador na rede>:9000/publicidade
```

`AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` são as credenciais do RustFS do Sail. Depois de mudar o `.env`, rode `php artisan config:clear`.

O bucket `publicidade` precisa existir e ter leitura pública (`s3:GetObject`), para o celular abrir as imagens sem login.

Em desenvolvimento, o app troca o host da URL da imagem pelo IP do computador que roda o Metro, como já faz com a API. Assim os banners continuam aparecendo quando o IP da rede muda, desde que a porta 9000 esteja acessível.
