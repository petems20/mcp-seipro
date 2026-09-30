# Rotas navegador — Claude in Chrome e Console

O editor do SEI é um **CKEditor 4** com **uma instância por seção** (várias
`readOnly`). O JS é o mesmo nas duas rotas: no Chrome o Claude executa via
`javascript_tool`; no Console o usuário cola e devolve o resultado.

Ferramentas prontas (`scripts/`):
- `sei-console-kit.js` — cole uma vez; expõe `SEI.*` (inspecionar, ler,
  blocos, limpar, avisos, aplicar, substituirFaixa), com `dryRun` por padrão.
- `modelo-edicao-pontual.js` — script autônomo, em duas fases, para corrigir
  números, frases, células e grafias num documento longo sem reescrevê-lo.
- `testar_no_chromium.mjs` — roda um script contra o HTML real, duas vezes,
  num Chromium headless com `CKEDITOR` simulado.

**Ciclo que funcionou** (Nota Técnica de ~190 mil caracteres, 28 imagens):
ler (arquivo) → script de edição pontual → testar offline → usuário aplica e
salva → usuário reenvia a leitura → conferir (§6–§9).

## 1. Chegar à janela certa

- "Editar conteúdo" abre o editor numa **janela/popup separada**
  (URL com `acao=editor_montar`). Uma janela aberta pelo site pode ficar **fora
  do grupo de abas** que o Claude in Chrome controla. O sintoma é a extensão
  conectada mas sem enxergar o editor. Contorno: abrir a URL do popup numa aba
  do grupo (`navigate`); o `infra_hash` da URL vale para a sessão.
  *(Hipótese ainda não confirmada em uso.)*
- Confirme a janela:
  ```js
  typeof CKEDITOR === 'undefined' ? 'SEM CKEDITOR: ' + location.href
    : 'CKEditor ' + CKEDITOR.version + ' | ' + Object.keys(CKEDITOR.instances).length + ' instâncias'
  ```
  Sem `CKEDITOR` = árvore ou visualização, não o editor. Versão fora de `4.x`
  → inspecionar antes de escrever.
- Abas `file://` não funcionam no Claude in Chrome ("Can't interact with
  browser-internal or unparseable URLs"). É restrição rígida.

## 2. Estrutura das instâncias (Funai)

Nomes `txaEditor_<id>` variam por documento.

**Ofício**

| Seção | Editável | Conteúdo |
|---|---|---|
| Códigos de barras | não | 2 `<img>` base64 + linha `<nº SEI> <nº processo>` |
| Timbre | não | brasão + MINISTÉRIO / FUNAI / unidade, em `<div align="center">` |
| Número | não | `Ofício Nº 4/2026/Coplan/CGGE/Dages/FUNAI` (`Texto_Alinhado_Esquerda_Espacamento_Simples_Maiusc`) |
| Data | sim | `<p class="Texto_Alinhado_Direita">Brasília, <em>data da assinatura eletrônica.</em></p>` — não mexer |
| **Corpo** | sim | destinatário → Assunto → vocativo → parágrafos → fecho → signatário (→ tabela de anexos, quando houver) |
| Rodapé | não | `<hr>` + tabela "Referência: Caso responda este Ofício…" + endereço |

**Nota Técnica** (7 instâncias)

| Seção | Editável | Conteúdo |
|---|---|---|
| Códigos de barras | não | imagens + nº SEI / processo |
| Timbre | não | brasão + MINISTÉRIO / FUNAI |
| Número | sim | `Nota Técnica nº 1/2026/Coplan/CGGE/Dages-FUNAI` |
| Data | sim | `Na data da assinatura eletrônica.` — não mexer |
| Destinatário | sim | `À Senhor(a) Diretora de …` |
| **Corpo** | sim | `Assunto:` → seções (`Texto_Fundo_Cinza_Maiusculas_Negrito`) → parágrafos numerados, tabelas e figuras (`<img>` base64) → encaminhamentos → tabela de assinaturas → referências |
| Rodapé | não | referência ao processo |

## 3. Encontrar a instância editável

**Nunca use o índice `[0]` para escrever.** Localize pelo conteúdo: no Ofício,
a que contém `Assunto:`; na Nota Técnica, `TABELA 1` ou `Sumário Executivo`.

```js
SEI.corpo(/Assunto\s*:/i)   // kit: nome da ÚNICA instância editável que casa, ou erro com a lista
```

`getData()` devolve **entidades** (`&aacute;`, `&ccedil;`, `&nbsp;`), então
uma regex com acento sobre o HTML cru falha. Para achar texto, parseie
(`DOMParser`) e use `textContent`. O kit já faz isso. Em script autônomo, o
teste rápido de instância deve usar âncora **sem acento** (`TABELA 1`,
`Assunto`). Sem acerto, liste todas (`SEI.instancias()`) e decida.

## 4. Ler

Limitações do `javascript_tool` no Chrome:
- **`[BLOCKED: Cookie/query string data]`**, disparado por HTML com muitas
  entidades. `SEI.ler(nome)` tira base64 e converte entidades em UTF-8, o que
  resolve a maioria dos casos.
- **Truncamento ~1500 caracteres**: leia por blocos (`SEI.blocos(nome)`) ou em
  fatias (`SEI.ler(nome).slice(0, 1400)`…).
- Documento grande: **baixe como arquivo**. `SEI.inspecionar()` baixa
  `sei_conteudo.html` (todas as seções, sem base64, com `dirty` e tamanho) e
  também copia. No Chrome, traga o arquivo pela ponte remote-devices
  (`device_list_dir` em Downloads, `device_stage_files`). No Console, o usuário
  **anexa o arquivo** no chat: é mais seguro que colar ~200 mil caracteres.
- Para analisar o arquivo: separar pelos cabeçalhos `=== txaEditor_… ===` e
  listar os filhos diretos do corpo (índice, tag, classe, 100 primeiros
  caracteres) com BeautifulSoup.
- Remova base64 sempre: `/(src="data:image\/[a-z+]+;base64,)[^"]*"/gi` (o `+`
  cobre `image/svg+xml`).

**Cuidado com o que o usuário manda.** A página "Visualizar documento" salva
como .html (`<title>SEI/FUNAI - <nº> - …`, `charset=iso-8859-1` com conteúdo
UTF-8, acentos saindo como `Ã§`) **não é o conteúdo do editor**. Ela não tem
as divisões por instância nem os espaçadores `contenteditable="false"`. Serve
para ler texto e estrutura aproximada. Para escrever com segurança, peça a
inspeção. Se precisar seguir sem ela, use guardas fortes e diga qual suposição
está sendo feita (ex. "a tabela de anexos está no corpo").

**`dirty=true` na leitura inicial** = alterações do usuário ainda não salvas.
Avise antes de aplicar: o script parte do que está no editor e elas entram
junto. Se não forem intencionais, fechar sem salvar e reabrir.

## 5. Escrever

**Faixa entre âncoras** (trecho curto, texto novo):

```js
SEI.substituirFaixa(nome, /Assunto\s*:/i, /Atenciosamente/i, novoHtml)            // prévia
SEI.substituirFaixa(nome, /Assunto\s*:/i, /Atenciosamente/i, novoHtml, {dryRun: false})
```

Âncoras são filhos diretos de `body` achados por texto. Âncora ausente ou
ambígua → nada muda. Preserva `contenteditable="false"`, recusa remover
imagens (salvo `{permitirImagens: true}`), passa o HTML por `SEI.limpar`.
Reaproveite a classe dos parágrafos substituídos.

**Edição pontual** (documento longo e já pronto, como uma Nota Técnica com
figuras): **não reescreva o corpo**. Use `modelo-edicao-pontual.js`. O parse +
`body.innerHTML` preserva as imagens base64 intactas.

Armadilhas que o modelo já evita:
- Checagem "já aplicado" com `includes(novo) && !includes(antigo)` falha
  quando o novo contém o antigo (frase acrescentada ao fim). Use só
  `includes(novo)`.
- Duas trocas no mesmo nó de texto: a tarefa lê o valor **na aplicação**, não
  na busca, senão a segunda sobrescreve a primeira.
- Célula de tabela: localizar a linha pelo texto das células, normalizando
  células já expandidas (`…(CR-PE)` → `CR-PE`) para seguir idempotente, e
  trocar o texto do elemento mais interno.
- Troca global de grafia (`CR-MSOL` → `CR-MSol`): `split/join` em todos os nós
  de texto. É idempotente e conta ocorrências, **desde que o novo não contenha
  o antigo**.
- Renumerar figuras/tabelas não é idempotente por natureza. Ponha uma guarda
  pelo estado (ex. "existe `FIGURA 12` e não existe `FIGURA 24`" = já feito).
  Troque em todos os nós de texto com
  `/\b(FIGURA|Figuras?)(\s+)(\d+)(\s+a\s+)?(\d+)?/g` (cobre "Figuras 21 a 24").
  Antes do `setData`, confira que os rótulos formam 1..N.
- Inserir bloco (parágrafo, tabela): guarda por texto distintivo do bloco novo
  ("já existe?") e inserção antes de uma âncora estável.
- Inserir um `Paragrafo_Numerado_Nivel1` **renumera todos os seguintes**.
  Avise o usuário quando o texto cita itens pelo número.

**Documento inteiro** (curto, sem imagens): `SEI.aplicar(nome, html)`.
HTML muito grande no Chrome: gere em arquivo e transforme num literal JS
escapando `\`, `` ` `` e `${`:

```python
html = open('new_body.html', encoding='utf-8').read()
esc = html.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
open('inject.js', 'w', encoding='utf-8').write(
    'window.__newBody = `' + esc + '`;\n"payload set, length=" + window.__newBody.length;')
```

Leia `inject.js` com `Read` em partes e reproduza-o **literalmente** no
`javascript_tool` (não resuma). Confira o `length` e depois aplique
`SEI.aplicar(nome, window.__newBody, {dryRun: false})`.

## 6. Regras para scripts de console

- IIFE `(() => { … })();` que retorna string de status: `OK (<instância>): …`,
  `NADA FOI ALTERADO: …` com diagnóstico, ou `Nada a fazer`. Uma linha de log
  por alteração ("já aplicado" quando for o caso).
- Localizar a instância por conteúdo, nunca por índice.
- **Duas fases**: localizar e validar tudo (âncoras únicas, trechos presentes).
  Só sem nenhum erro, aplicar e chamar `setData`.
- Preservar `contenteditable="false"` e as imagens: comparar a contagem de
  `<img>` antes e depois e abortar se mudar.
- Idempotente. Ao acrescentar algo (ex. signatário), entregar o script completo
  que refaz tudo. Operações não idempotentes precisam de guarda explícita (§5).
- Constantes no topo (`ASSUNTO`, URLs, destinatário, signatário, flags
  `INCLUIR_X = true`); corpo em template literal com `${CONST}`; o texto não
  pode conter `` ` `` nem `${`.
- **Sem caracteres invisíveis literais no código.** Um NBSP (U+00A0) some ou
  vira espaço ao copiar/colar: escreva ` ` em JS e `&nbsp;` em HTML.
- Não salvar, não assinar, não navegar.
- Estrutura desconhecida → pedir a inspeção **antes** do primeiro script de
  escrita.
- Entregar o script no chat (bloco de código) **e** como arquivo `.js`.

**Instruções ao usuário (curtas, na primeira vez):**
1. Abrir o documento para edição (janela do editor).
2. F12 → **Console**. Se o Chrome bloquear colagem: digitar `allow pasting` + Enter.
3. Colar o script + Enter; ler a mensagem devolvida.
4. Se `CKEDITOR` não existir, escolher o frame do editor no seletor de contexto
   do console (onde aparece "top").
5. Conferir e clicar em **Salvar** (o script nunca salva nem assina).
6. Desfazer: fechar sem salvar ou Ctrl+Z no editor.

## 7. Testar o script antes de entregar

Com a inspeção do usuário em mãos:

1. Extraia o HTML da instância do corpo (entre `=== txaEditor_<corpo> ===` e o
   cabeçalho seguinte) para `corpo.html`.
2. `node scripts/testar_no_chromium.mjs corpo.html script.js saida.html`. A 1ª
   execução deve dar `OK` e a 2ª `Nada a fazer`, com "idempotente: true" e
   "mesmas imagens, mesma ordem: true".
3. Compare antes × depois por blocos de texto (BeautifulSoup + `difflib`) e
   mostre ao usuário, em resumo, o que muda.
4. Tabela refeita: `--screenshot saida.png` para conferir quebra de linha,
   cores e larguras.

No ambiente remoto do Claude Code, Playwright e Chromium já existem
(`/opt/node22/lib/node_modules/playwright`, `/opt/pw-browsers`). Não rode
`playwright install`.

## 8. Verificar e salvar (Chrome)

- Após aplicar: screenshot e rolagem (numeração, tabelas, âncoras); conferir
  o `length`.
- Após **Salvar**: `SEI.instancias()` → `dirty=false` em todas.
- **Nunca clique em "Assinar"**.

## 9. Conferir a versão salva

Quando o usuário aplicar, salvar e reenviar a inspeção:
- `dirty=false` em todas as instâncias.
- Rode o próprio script de novo sobre o arquivo novo (§7). Deve dar
  "Nada a fazer", o que prova que tudo foi aplicado e salvo.
- Diferença entre o esperado e o salvo = edição manual do usuário (ex. uma CR
  acrescentada numa tabela). **Não reverta**: avalie o impacto (sigla nova sem
  citação por extenso, lista que agora diverge do Ofício, constante do pipeline
  a atualizar) e proponha só o ajuste decorrente.
- Script antigo que agora acusa "âncora não encontrada" por uma troca que ele
  mesmo fez (ex. grafia alterada depois) é esperado. Diga que ele não precisa
  mais ser usado.
