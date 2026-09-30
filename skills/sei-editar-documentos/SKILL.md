---
name: "sei-editar-documentos"
description: "Use when reading, drafting, revising or editing documents in SEI (Sistema Eletrônico de Informações) — Ofício, Despacho, Nota Técnica, Parecer — or when the user mentions 'SEI nº', a número de processo NNNNN.NNNNNN/AAAA-NN or the SEI editor. Covers three routes: the mcp-seipro tools (sei_*), Claude in Chrome, and console scripts the user pastes when the extension can't connect; plus a plain-text fallback, point edits in long documents with images, and consistency checks between documents of the same process."
---

# Editando documentos no SEI

O documento do SEI é HTML dividido em **seções**: códigos de barras, timbre,
número, data, corpo, rodapé. No editor web, cada seção é uma instância
CKEditor 4, e várias são somente leitura porque o próprio SEI as gera. O
conteúdo usa **classes CSS padronizadas**, que dão numeração automática,
recuos e uniformidade. Esta skill descreve como ler, gerar e gravar esse
conteúdo por quatro rotas e as regras que valem para todas.

## 0. Escolher a rota (nesta ordem)

1. **API (mcp-seipro)**: se houver ferramentas `sei_*` (ex. `sei_listar_secoes`,
   `sei_editar_secao`) carregadas ou descobríveis via `ToolSearch` (query
   `sei_`). É a rota mais robusta: não depende de janela, CKEditor nem de colar
   scripts. → `references/rota-api.md`.
2. **Claude in Chrome**: ferramentas `mcp__claude-in-chrome__*`, carregadas numa
   única chamada de `ToolSearch` (query `claude-in-chrome`); se existir
   `enable__mcp__claude-in-chrome`, use-a. → `references/rota-navegador.md`.
3. **Console**: sem as anteriores, ou o usuário pede "comandos/script". O
   Claude escreve JS e o usuário cola no console do editor. Funcionou bem na
   prática e é o fallback preferido quando o usuário quer o conteúdo aplicado.
   → `references/rota-navegador.md` e `scripts/`.
4. **Texto puro**: o usuário só quer o texto (§6), e você diz em uma frase o
   que faltou para as rotas 1–3.

Ver a aba do SEI no contexto (`availableTabs`) não prova acesso a ela. Aviso de
que o MCP `claude-in-chrome` falhou ao conectar é **falha de conexão**, não
falta de permissão: diga isso em uma frase (extensão ativa, logada, com
permissão para o domínio do SEI; recarregar extensão e aba costuma resolver).
Se o usuário disser "tente de novo", refaça a descoberta de ferramentas antes
de responder. Outras falhas (403, erro do servidor, API ausente):
`references/diagnostico.md`.

## 1. Identidade do documento (vale para todas as rotas)

- O **número SEI** que o usuário vê (`protocoloFormatado`, ex. `2953648`) é
  **diferente** do **id interno** (ex. `3242105`). São inteiros de tamanho
  parecido: trocar um pelo outro abre **outro documento, silenciosamente**.
- Antes de gravar, confira o **nome** do documento resolvido (ex.
  "Despacho 2949729"). Na API ele vem em `_documento_resolvido.nome`; no
  navegador, no título da janela e na árvore. Se não bater, pare e pergunte.
- Documento **restrito/sigiloso**: não leia nem copie conteúdo para fora do SEI
  sem autorização expressa do usuário na conversa (na API,
  `confirmar_acesso_restrito` só vai `true` depois disso).
- A página "Visualizar documento" salva como .html **não é** o conteúdo do
  editor: não tem as seções nem os espaçadores fixos. Serve para ler; para
  escrever, peça a inspeção do editor.

## 2. Regras de conteúdo (HTML do SEI)

1. **Numeração é da classe, nunca do texto.** `Paragrafo_Numerado_Nivel1..4`,
   `Item_Nivel1..4`, `Item_Alinea_Letra`, `Item_Inciso_Romano*` autonumeram.
   Nunca escreva "1.", "1.1", "a)", "I –" no início do texto. Inserir um
   parágrafo numerado **renumera os seguintes**: avise quando o texto cita
   itens pelo número.
2. **Use classes, não estilo inline**, para alinhamento, recuo e fonte.
   Catálogo, tabelas, figuras e modelos por tipo de documento:
   `references/estilos-e-modelos.md`.
3. **Sem cor hexadecimal em `style`.** Escreva `rgb(221,221,221)`, nunca
   `#dddddd`. Na ANTAQ, o WAF do Cloudflare lê o `#` como comentário SQL e barra
   o salvamento inteiro com 403. Onde não há WAF, evitar não custa nada.
4. **Sem entidades desnecessárias**: `ç`, `º`, `–` literais, não `&ccedil;`,
   `&ordm;`. Mantenha só `&lt; &gt; &amp; &quot;` **e `&nbsp;`**. Nunca escreva
   um NBSP invisível no código: ele some ao copiar/colar (em JS, ` `).
5. **Link para documento/processo SEI (âncora):**
   `<a class="ancoraSei" id="lnkSei{ID_INTERNO}">{NUMERO_SEI}</a>`, envolto em
   `<span contenteditable="false">`. O **texto do link tem que ser exatamente o
   `protocoloFormatado` do id**; senão o SEI descarta a tag ao salvar e sobra
   texto solto. Vale para processo também (`id` do processo, texto
   `NNNNN.NNNNNN/AAAA-NN`). Na API, `sei_gerar_referencia` monta isso. No
   navegador, o id interno está na URL do documento na árvore
   (`id_documento=…`), ou use o botão de link SEI do editor.
6. **Preserve elementos `contenteditable="false"`** (espaçadores e âncoras do
   modelo). Altere **faixas entre âncoras de texto** ou faça **troca pontual**.
   Tudo idempotente. Âncora ausente ou ambígua → não altere nada e devolva
   diagnóstico.
7. **Não mexa em seções geradas pelo SEI** (códigos de barras, timbre, data,
   rodapé). Na API elas vão vazias e o SEI as reconstrói; no navegador são as
   instâncias `readOnly`.
8. **Imagens existentes são intocáveis.** Documento longo e pronto (Nota
   Técnica com figuras base64) recebe **edição pontual**, nunca reescrita do
   corpo. Confira a contagem de `<img>` antes e depois. Figura nova só
   embutida se o documento já segue esse padrão; senão, "FIGURA N" + título.
9. **Não invente** o que não dá para verificar (ex. cidade-sede de uma unidade
   nova). Use só o certo e avise. Placeholders do modelo ("NOME DO ASSINANTE")
   não podem ficar.

Antes de gravar HTML gerado por você, rode o validador:
`python3 scripts/validar_html_sei.py corpo.html --corrigir saida.html`
(numeração manual, cor hex, entidades, âncora suspeita, placeholder, classe
desconhecida, convenções de redação). No navegador, `SEI.limpar` e
`SEI.avisos` do kit fazem o mesmo.

## 3. Fluxo de edição

Ciclo testado (Nota Técnica de ~190 mil caracteres, 28 imagens):

1. **Ler antes de escrever.** API: `sei_listar_secoes`. Navegador: inspeção em
   arquivo (`SEI.inspecionar()`). Se vier `dirty=true`, há alterações não
   salvas do usuário: avise antes de aplicar.
2. **Montar** só a faixa ou as trocas pontuais, com as classes do §2
   (`scripts/modelo-edicao-pontual.js` para documento longo).
3. **Testar antes de entregar.** API: `dry_run=true`. Console:
   `scripts/testar_no_chromium.mjs` sobre o HTML real, que roda duas vezes e
   deve dar `OK` e depois `Nada a fazer`, com as imagens idênticas. Mostre ao
   usuário, em resumo, o que muda.
4. **Gravar.** API: `sei_editar_secao`. Navegador: o usuário (ou o Claude no
   Chrome) aplica e **o usuário clica em Salvar**.
5. **Conferir a versão salva.** API: `sei_ler_documento`. Navegador: nova
   inspeção com `dirty=false` em tudo, e o mesmo script sobre ela deve dar
   "Nada a fazer". Diferença = edição manual do usuário: não reverta, avalie o
   impacto e proponha só o ajuste decorrente.
6. **Nunca assinar** (`sei_assinar_documento` ou o botão "Assinar") sem pedido
   explícito e separado do usuário. Idem enviar/tramitar, concluir ou incluir
   em bloco de assinatura.

## 4. Tipos de documento, redação e consistência

- Estruturas aprovadas (Ofício e Nota Técnica da Funai; Despacho e Nota
  Técnica no padrão do mcp-seipro), tabelas, figuras e classes:
  `references/estilos-e-modelos.md`. O **modelo já presente no documento**
  prevalece; registre ali a variação aprendida.
- Convenções de redação do usuário (siglas, decimais, travessão, horário) e
  **consistência entre Nota Técnica e Ofício** do mesmo processo:
  `references/revisao-e-consistencia.md`.
- Conteúdo que vem de `.qmd`/Quarto, ou `.qmd` que precisa acompanhar o SEI/PDF
  assinado: `references/qmd-e-pdf.md`.

## 5. Scripts (`scripts/`)

| Arquivo | Uso |
|---|---|
| `sei-console-kit.js` | cole uma vez; `SEI.inspecionar/ler/blocos/limpar/avisos/aplicar/substituirFaixa` (prévia por padrão) |
| `modelo-edicao-pontual.js` | molde autônomo em duas fases: trocas de texto, células, grafia global |
| `testar_no_chromium.mjs` | testa um script contra o HTML real, 2×, em Chromium headless |
| `validar_html_sei.py` | lint e `--corrigir` do HTML antes de gravar |

Scripts para o usuário: entregar no chat **e** como arquivo `.js`.

## 6. Fallback de texto puro

- Siga a estrutura do tipo de documento (§4), **sem** os números e letras que o
  modelo gera sozinho, e avise para não digitá-los ao colar.
- Marque os pontos que no SEI seriam links (`[link SEI nº 1234567]`) para o
  usuário inserir pelo botão do editor.
- Correções numa nota longa: por item, com **Trocar:** / **Por:** e o texto
  exato, separando o inequívoco do que depende de decisão (opções A/B).
