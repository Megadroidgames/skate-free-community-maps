# Skate Free — Mapas da Comunidade

Catálogo estático em HTML5, CSS3 e JavaScript Vanilla. Sem build, dependências, fontes externas ou backend. Todo o conteúdo vem de `catalog.json`, que também pode ser consumido pelo jogo Unity.

## Publicar no GitHub Pages

1. Extraia este ZIP e envie o conteúdo da pasta para a raiz de um repositório no GitHub. `index.html` deve ficar na raiz publicada.
2. Em **Settings → Pages**, selecione **Deploy from a branch**, branch `main` e pasta `/(root)`. Salve.
3. Abra a URL indicada pelo GitHub após a publicação. Em um repositório de projeto ela normalmente terá a forma `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.
4. Para a WebView, abra essa mesma URL com `?ingame=1`. Esse modo esconde o cabeçalho e o rodapé, e compacta o catálogo.

Não é necessário executar npm, compilar ou configurar rotas. Todos os caminhos são relativos ao diretório da página. O código transforma `previewUrl` e `downloadUrl` em URLs absolutas com `new URL(url, window.location.href).href`, inclusive em subpastas do GitHub Pages.

## University: inclua os arquivos reais

O cadastro University foi incluído exatamente com os dados fornecidos. **O arquivo University.skt e a imagem preview.png não foram fornecidos e não estão neste pacote.** Antes de disponibilizar o mapa aos jogadores, coloque os arquivos reais nestes caminhos:

- `maps/University/University.skt`
- `maps/University/preview.png`

A imagem ausente recebe um fallback visual automático. O site não inventa nem gera um arquivo de mapa. Enquanto o `.skt` não for adicionado, o link de download retornará 404.

## Adicionar outro mapa

1. Crie `maps/MeuMapa/`.
2. Inclua `MeuMapa.skt` e `preview.png` (recomendado 1280 × 720, proporção 16:9).
3. Adicione um objeto ao array `maps` de `catalog.json`, preservando a estrutura abaixo. Separe os objetos por vírgula, sem vírgula depois do último.
4. Atualize `updatedAt` no formato `AAAA-MM-DD`. `version` na raiz é a versão do formato do catálogo; mantenha `1`. `version` dentro do mapa representa a versão do próprio mapa.
5. Envie os arquivos e o JSON ao GitHub. IDs devem ser únicos e estáveis; maiúsculas e minúsculas nos caminhos precisam coincidir.

```json
{
  "id": "MeuMapa",
  "name": "Meu Novo Mapa",
  "author": "Nome do criador",
  "description": "Descrição do mapa e seus principais spots.",
  "category": "Skate Park",
  "tags": ["Park", "Bowl"],
  "sizeMB": 12.5,
  "version": "1.0",
  "previewUrl": "maps/MeuMapa/preview.png",
  "downloadUrl": "maps/MeuMapa/MeuMapa.skt",
  "spawn": [0, 1, 0],
  "heading": 0
}
```

Categorias dos filtros: `Mundo Aberto`, `Street`, `Skate Park`, `Mega Ramp`. O filtro também considera tags com o mesmo nome. A busca ignora acentos e pesquisa nome, autor, categoria e tags. Clicar em uma tag a coloca na busca. O nome do mapa abre um modal de detalhes, com versão e posição de spawn.

`spawn` tem três números na ordem x, y, z. Mantenha `heading` na convenção usada pelo seu importador Unity; o site apenas preserva o número, sem converter unidades.

## Integração Android / Unity

O site prepara a solicitação; **o jogo precisa implementar a bridge ou registrar/interceptar o deep link**, baixar e validar o `.skt` e executar o importador existente. Colocar este site online, por si só, não adiciona essa capacidade ao APK.

O botão **Adicionar no Jogo** usa esta ordem de fallback:

1. Se existir `window.SkateFreeBridge.installMap`, chama `installMap(absoluteDownloadUrl, map.id, map.name)`. Retorno `undefined`, `true` ou qualquer valor diferente de `false` indica que a solicitação foi entregue. A bridge também pode retornar uma Promise. Retorno `false` ou exceção leva ao próximo caminho.
2. Se a bridge estiver ausente ou falhar, navega para:

```text
skatefree://install-map?url=URL_ENCODED&id=ID_ENCODED&name=NAME_ENCODED
```

3. No caminho de deep link, o modal manual é aberto antes da navegação, com link selecionável, botão de copiar e download direto. Assim, se o navegador não conseguir abrir o jogo, a alternativa já estará disponível. Navegadores não oferecem detecção confiável de um app instalado; o site não declara uma instalação concluída.

A bridge e o scheme são alternativas: após uma entrega válida à bridge, não é disparado um segundo pedido de instalação. Isso evita baixar ou instalar o mesmo mapa duas vezes. `?ingame=1` muda o layout; ele não cria uma bridge.

Exemplo do contrato JavaScript exposto pelo aplicativo:

```js
window.SkateFreeBridge.installMap(absoluteDownloadUrl, mapId, mapName);
```

Em Android, exponha o método na WebView com a interface JavaScript apropriada ou intercepte a URL `skatefree://` na navegação da WebView. Para abrir pelo navegador externo, o APK precisa registrar um intent filter para scheme `skatefree` e host `install-map`, processando também novos intents quando o aplicativo já está aberto. A implementação nativa não faz parte deste pacote HTML.

A bridge recebe URL, ID e nome. Se o importador precisar de `spawn` e `heading`, leia o `catalog.json` e localize o registro pelo ID. URLs relativas devem ser resolvidas tomando como base o endereço do catálogo. O JSON tem campos públicos simples e pode ser lido por um DTO serializável no Unity.

Recomendações para a integração: permita apenas HTTPS e origens confiáveis; restrinja a bridge ao catálogo confiável; valide tipo, tamanho e conteúdo do mapa no jogo; sanitize IDs e caminhos ao gravar arquivos; não execute código vindo dos mapas. O site não executa conteúdo do `.skt`.

## Copiar e baixar

**Copiar Link** usa `navigator.clipboard.writeText`. Se a WebView ou navegador bloquear essa API, o modal seleciona o endereço para cópia manual. A mensagem de sucesso só aparece depois de a cópia ser confirmada.

**Baixar .skt** é um link direto com atributo `download`. No mesmo domínio, o navegador normalmente oferece o download. Se usar hospedagem externa, o servidor pode controlar esse comportamento; use uma URL pública que entregue o arquivo, não uma página de visualização ou login. Uma WebView precisa tratar downloads no aplicativo hospedeiro.

Mapas e imagens podem usar URLs HTTPS externas; isso preserva a estrutura do JSON e evita guardar arquivos grandes no repositório do site. Verifique os limites de tamanho do GitHub e Pages antes de subir mapas grandes. Links Git LFS que entreguem apenas o arquivo ponteiro não servem como download do mapa.

## Executar localmente

Não abra `index.html` por duplo clique: navegadores podem bloquear o `fetch` do JSON em `file://`.

Com Python instalado, abra um terminal na pasta do site e execute:

```sh
python -m http.server 8000
```

Abra `http://localhost:8000/`. Teste também `http://localhost:8000/?ingame=1`.

## Checklist antes de divulgar

- Abra o catálogo publicado e o modo in-game no celular.
- Verifique busca, tags, filtros, ordenação e modal com teclado.
- Adicione os arquivos reais de University e confira o download: ele deve entregar o `.skt`, sem HTML ou arquivo ponteiro.
- Confira que o link copiado é absoluto e inclui a subpasta do repositório.
- Teste bridge, deep link e importação com seu APK. Sem o aplicativo disponível, só é possível validar a solicitação JavaScript e o fallback.
- Teste um mapa real no Unity e revise spawn, heading, compatibilidade e tamanho antes de publicá-lo.

## Arquivos

- `index.html`: estrutura, modal acessível, busca e modo in-game.
- `styles.css`: paleta oficial, layout responsivo, preview de fallback e notificações.
- `assets/skate-free-logo.png`: logo do Skate Free com fundo transparente; mantenha a pasta `assets` junto aos demais arquivos.
- `app.js`: catálogo, validação, filtros, ordenação, cópia e integração.
- `catalog.json`: fonte compartilhada com o jogo.
- `maps/University/`: pasta reservada para os arquivos reais do mapa.

O site não possui upload público ou painel administrativo. Novos mapas são adicionados editando o repositório e o catálogo.

## Visual atualizado

A página abre diretamente no catálogo. Foram removidos a apresentação grande, a arte decorativa, o selo Android / .skt e os textos extras marcados. O cabeçalho usa a logo enviada, com o fundo removido. Busca, filtros, detalhes e integração com o jogo continuam disponíveis.
