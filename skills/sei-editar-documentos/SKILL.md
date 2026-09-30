---
name: "sei-editar-documentos"
description: "Use when reading, drafting or editing documents in SEI (Sistema Eletrônico de Informações) — Ofício, Despacho, Nota Técnica, Parecer — or when the user mentions 'SEI nº', a número de processo NNNNN.NNNNNN/AAAA-NN or the SEI editor. Covers three routes: the mcp-seipro tools (sei_*), Claude in Chrome, and console scripts the user pastes when the extension can't connect; plus a plain-text fallback."
---

# Editando documentos no SEI

O documento do SEI é HTML dividido em **seções** (cabeçalho com brasão, título,
data, corpo, rodapé...). Só algumas são editáveis; as demais o próprio SEI gera.
O conteúdo usa **classes CSS padronizadas** — é isso que dá numeração
automática, recuos e uniformidade. Esta skill descreve como ler, gerar e gravar
esse conteúdo por quatro rotas e as regras que valem para todas.

## 0. Escolher a rota (nesta ordem)

1. **API (mcp-seipro)** — se houver ferramentas `sei_*` (ex. `sei_listar_secoes`,
   `sei_editar_secao`) carregadas ou descobríveis via `ToolSearch` (query `sei_`).
   É a rota mais robusta: não depende de janela, aba, CKEditor nem de colar
   scripts. → `references/rota-api.md`.
2. **Claude in Chrome** — ferramentas `mcp__claude-in-chrome__*` (carregar numa
   única chamada de `ToolSearch`, query `claude-in-chrome`; se existir
   `enable__mcp__claude-in-chrome`, use-a). → `references/rota-navegador.md`.
3. **Console** — sem as anteriores, ou o usuário pede "comandos/script": o Claude
   escreve JS e o usuário cola no console do editor. →
   `references/rota-navegador.md` §Console e `scripts/sei-console-kit.js`.
4. **Texto puro** — o usuário só quer o texto: entregue pronto para colar
   (§5 abaixo), dizendo em uma frase o que faltou para as rotas 1–3.

Ver a aba do SEI no contexto (`availableTabs`) não prova acesso a ela. Se o
usuário disser "tente de novo", refaça a descoberta de ferramentas antes de
responder — a extensão ou o conector podem ter sido ligados nesse meio-tempo.
Falhas de conexão, 403 e erros do servidor: `references/diagnostico.md`.

## 1. Identidade do documento (vale para todas as rotas)

- O **número SEI** que o usuário vê (`protocoloFormatado`, ex. `2953648`) é
  **diferente** do **id interno** (ex. `3242105`). Ambos são inteiros de tamanho
  parecido: trocar um pelo outro abre **outro documento, silenciosamente**.
- Antes de gravar, confira o **nome** do documento resolvido (ex.
  "Despacho 2949729") — na API ele vem em `_documento_resolvido.nome`; no
  navegador, no título da janela/árvore. Se não bater com o que o usuário pediu,
  pare e pergunte.
- Documento **restrito/sigiloso**: não leia nem copie conteúdo para fora do SEI
  sem autorização expressa do usuário na conversa (na API, o parâmetro
  `confirmar_acesso_restrito` só vai `true` depois disso).

## 2. Regras de conteúdo (HTML do SEI)

1. **Numeração é da classe, nunca do texto.** `Paragrafo_Numerado_Nivel1..4`,
   `Item_Nivel1..4`, `Item_Alinea_Letra`, `Item_Inciso_Romano*` autonumeram.
   Nunca escreva "1.", "1.1", "a)", "I –" no início do texto.
2. **Use classes, não estilo inline** para alinhamento, recuo, fonte.
   Catálogo e modelos por tipo de documento: `references/estilos-e-modelos.md`.
3. **Sem cor hexadecimal em `style`.** Escreva `rgb(221,221,221)`, nunca
   `#dddddd`. Motivo medido em produção (ANTAQ): o WAF do Cloudflare lê o `#`
   como comentário SQL e barra o salvamento inteiro com 403. Custa zero evitar.
4. **Sem entidades desnecessárias.** Escreva `ç`, `º`, `–` literais, não
   `&ccedil;`, `&ordm;`. Mantenha só `&lt; &gt; &amp; &quot;`. Entidades se
   acumulam a cada ciclo ler→regravar, incham o corpo e disparam o filtro
   `[BLOCKED: Cookie/query string data]` do Claude in Chrome.
5. **Link para documento/processo SEI (âncora):**
   `<a class="ancoraSei" id="lnkSei{ID_INTERNO}">{NUMERO_SEI}</a>`
   (envolto em `<span contenteditable="false">`). O **texto do link tem que ser
   exatamente o `protocoloFormatado` do id** — senão o SEI descarta a tag ao
   salvar e sobra texto solto. Vale para processo também:
   `<a … id="lnkSei{ID_DO_PROCESSO}">50300.004460/2024-86</a>`.
   Na API, `sei_gerar_referencia` monta isso; no navegador, o id interno está
   na URL do documento na árvore (`id_documento=…`), ou use o botão de link SEI
   do editor.
6. **Preserve elementos `contenteditable="false"`** (espaçadores e âncoras do
   modelo). Substitua **faixas entre âncoras de texto** (ex. entre `Assunto:` e
   `Atenciosamente`), de forma idempotente; âncora não encontrada → não altere
   nada e devolva diagnóstico.
7. **Não mexa em seções geradas pelo SEI** (brasão, número, data, rodapé). Na
   API elas vão vazias e o SEI as reconstrói; no navegador são as instâncias
   `readOnly`.
8. **Sem imagens base64 no corpo** (pesam e travam o salvamento). Figura vira
   "FIGURA N" + título em negrito.

Antes de gravar HTML gerado por você, rode o validador:
`python3 scripts/validar_html_sei.py corpo.html --corrigir saida.html`
(numeração manual, cor hex, entidades, âncora suspeita, classe desconhecida,
base64, caracteres fora do ISO-8859-1). Em rota console/Chrome, o kit JS faz a
mesma limpeza no navegador (`SEI.limpar`).

## 3. Fluxo de edição

1. **Ler antes de escrever** — estrutura das seções e o modelo já preenchido.
2. **Montar** o HTML só da seção/faixa a mudar, com as classes do §2.
3. **Prévia** — API: `dry_run=true`; navegador: `SEI.substituirFaixa(...)` ou
   `SEI.aplicar(...)` (ambos em `dryRun` por padrão). Confira bytes, seções
   tocadas e avisos.
4. **Gravar** e **reler**: API relê e reporta; navegador: `checkDirty()` após
   Salvar e reabrir o documento.
5. **Nunca assinar** — nem `sei_assinar_documento`, nem o botão "Assinar" —
   sem pedido explícito e separado do usuário. Idem para enviar/tramitar,
   concluir ou incluir em bloco de assinatura.

## 4. Tipos de documento

Estruturas aprovadas (Ofício Funai, Despacho, Nota Técnica/Parecer) e o
catálogo de classes: `references/estilos-e-modelos.md`. Quando o órgão tiver
convenção própria diferente da do modelo, siga o **modelo já presente no
documento** e registre a variação aprendida nesse arquivo.

## 5. Fallback de texto puro

- Siga a estrutura do tipo de documento (§4), mas **sem** números/letras que o
  modelo gera sozinho — avise o usuário para não digitá-los ao colar.
- Marque os pontos que no SEI seriam links (`[link SEI nº 1234567]`) para o
  usuário inserir pelo botão do editor.
