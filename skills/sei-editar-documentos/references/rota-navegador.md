# Rotas navegador — Claude in Chrome e Console

O editor do SEI é um **CKEditor 4** com **uma instância por seção** (várias
`readOnly`). O JS é o mesmo nas duas rotas: no Chrome o Claude executa via
`javascript_tool`; no Console o usuário cola e devolve o resultado.
Funções prontas: `scripts/sei-console-kit.js` (cole uma vez; expõe `SEI.*`).

## 1. Chegar à janela certa

- "Editar conteúdo" abre o editor numa **janela/popup separada**
  (URL com `acao=editor_montar`). Uma janela aberta pelo site pode ficar **fora
  do grupo de abas** que o Claude in Chrome controla — sintoma: a extensão está
  conectada, mas não "vê" o editor. Contorno: pegue a URL do popup e abra-a
  numa aba do grupo (`navigate`). A URL carrega `infra_hash` válido para a
  sessão, então funciona na mesma sessão do SEI.
- Confirme que está na janela certa antes de qualquer coisa:
  ```js
  typeof CKEDITOR === 'undefined' ? 'SEM CKEDITOR: ' + location.href
    : 'CKEditor ' + CKEDITOR.version + ' | ' + Object.keys(CKEDITOR.instances).length + ' instâncias'
  ```
  Se `CKEDITOR` não existir, você está na árvore/visualização, não no editor.
  Se a versão não começar por `4.`, as APIs abaixo podem não se aplicar —
  pare e inspecione antes de escrever.

## 2. Encontrar a instância editável

Nomes `txaEditor_<id>` variam por documento. **Nunca use o índice `[0]` para
escrever.** Localize pelo conteúdo — num Ofício, a instância não-readOnly que
contém `Assunto:`; num Despacho, a que contém o destinatário/"Ao"/"À"; numa
Nota Técnica, a que contém o primeiro `Item_Nivel1`.

```js
SEI.corpo(/Assunto\s*:/i)          // kit; devolve o nome ou lança com diagnóstico
```

Sem acerto, liste todas (`SEI.instancias()`: nome, readOnly, dirty, início do
texto) e decida a partir disso.

## 3. Ler

Limitações do `javascript_tool` no Chrome:
- **`[BLOCKED: Cookie/query string data]`** — filtro heurístico dispara com HTML
  cheio de entidades `&...;`. **Normalize antes de devolver**: `SEI.ler(nome)`
  já tira base64 e converte entidades em UTF-8 (fica só `&lt; &gt; &amp;`).
  Isso resolve a maioria dos casos sem precisar de arquivo.
- **Truncamento ~1500 caracteres** — leia por blocos (`SEI.blocos(nome)`: um
  resumo por parágrafo) ou em fatias (`SEI.ler(nome).slice(0,1400)`, depois
  `slice(1400,2800)`...).
- Para **só o texto** do documento (sem editar), a página de visualização
  (`acao=documento_visualizar`) lida com `get_page_text` é mais barata.
- Último recurso: baixar via Blob e trazer pelo `device_*` (remote-devices).

## 4. Escrever

Padrão: parsear, trocar a **faixa entre âncoras**, regravar — idempotente.

```js
SEI.substituirFaixa(nome, /Assunto\s*:/i, /Atenciosamente/i, novoHtml, {dryRun: true})
// → prévia: quantos blocos saem/entram, bytes, avisos. Depois dryRun:false.
```

- Preserva elementos `contenteditable="false"` dentro da faixa.
- Passa o HTML novo por `SEI.limpar` (cores hex → `rgb()`, entidades → UTF-8).
- Âncora não encontrada → não altera nada, devolve diagnóstico.
- Para inserir tudo: `CKEDITOR.instances[nome].setData(html)`.

HTML muito grande (100k+) no Chrome: gere em arquivo, transforme num literal JS
escapando `\`, `` ` `` e `${`, e injete em partes em `window.__novo`
(`window.__novo += \`...\``), conferindo `length` a cada chamada. É transcrição
literal — não resuma. Abas `file://` não são acessíveis ao Claude in Chrome.

## 5. Verificar e salvar

- Screenshot e rolagem para conferir numeração, tabelas, âncoras.
- `SEI.instancias()` após **Salvar** → `dirty=false` em todas.
- Reabra o documento (ou a visualização) para confirmar que as âncoras
  sobreviveram — o SEI descarta âncora cujo texto não é o nº do id.
- **Nunca clique em "Assinar"**.

## Console (o usuário executa)

**Instruções ao usuário (curtas, na primeira vez):**
1. Abrir o documento para edição (janela do editor).
2. F12 → **Console**. Se o Chrome bloquear colagem: digitar `allow pasting` + Enter.
3. Se `CKEDITOR` não existir, escolher o frame do editor no seletor de contexto
   do console (onde aparece "top").
4. Colar o kit (`sei-console-kit.js`) uma vez; depois, os comandos que eu mandar.
5. Conferir e clicar em **Salvar** (os scripts nunca salvam nem assinam).
   Desfazer: fechar sem salvar ou Ctrl+Z no editor.

**Regras para os scripts:**
- IIFE que **retorna string de status** ("OK (<instância>): ..." ou diagnóstico).
- Constantes no topo (`ASSUNTO`, destinatário, signatário, URLs) e corpo em
  template literal com `${CONST}`; o texto não pode conter `` ` `` nem `${`.
- Idempotente: ao acrescentar algo, reenviar o script completo que refaz tudo.
- Não salvar, não assinar, não navegar.
- Modelo desconhecido → pedir a inspeção (`SEI.inspecionar()`, que copia tudo
  para a área de transferência via `copy()`) antes do primeiro script de escrita.

**Fluxo típico:** inspeção → script com guardas e `dryRun:true` → aplicação →
usuário salva → inspeção final (numeração duplicada, espaçadores, classes,
links, `dirty=false`). Incorporar ao `estilos-e-modelos.md` o formato final que
o usuário adotou.
