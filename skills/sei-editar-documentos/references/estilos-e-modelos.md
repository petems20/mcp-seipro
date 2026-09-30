# Classes CSS do SEI e modelos por tipo de documento

Fonte: catálogo do mcp-seipro (`sei_styles.py`, 39 classes) + convenções
aprovadas em uso real (Ofício na Funai; Despacho e Nota Técnica na ANTAQ).
Quando o documento aberto já trouxer um modelo, **o modelo do documento
prevalece** sobre esta lista.

## Intenção → classe

| Intenção | Classe |
|---|---|
| parágrafo comum | `Texto_Justificado` |
| parágrafo com recuo, sem número (vocativo, fecho) | `Texto_Justificado_Recuo_Primeira_Linha` |
| corpo numerado 1. 2. 3. | `Paragrafo_Numerado_Nivel1` (Nivel2 → 1.1, Nivel3 → 1.1.1) |
| título de seção ≈ H1/H2/H3/H4 (Nota Técnica, Parecer) | `Item_Nivel1` … `Item_Nivel4` (autonumeram 1. / 1.1.) |
| alínea a) b) c) | `Item_Alinea_Letra` |
| inciso I – II – III – | `Item_Inciso_Romano` (`_Recuo`, `_Esquerda_Recuo_Justif`) |
| citação de norma/trecho | `Citacao` |
| destinatário | `Texto_Alinhado_Esquerda` (Funai: `…_Espacamento_Simples`) |
| local e data | `Texto_Alinhado_Direita` |
| título centralizado | `Texto_Centralizado_Maiusculas_Negrito` |
| faixa cinza de seção | `Texto_Fundo_Cinza_Negrito` / `Texto_Fundo_Cinza_Maiusculas_Negrito` |
| nome do signatário / cargo | `Texto_Centralizado_Maiusculas` / `Texto_Centralizado` |
| célula de tabela | `Tabela_Texto_Justificado`, `_Centralizado`, `_Alinhado_Esquerda`, `_Alinhado_Direita` |
| legenda pequena | `Tabela_Fonte_9_Centralizado`, `Tabela_Texto_8(_Centralizado)` |
| monoespaçado | `Texto_Mono_Espacado` |
| tachado | `Tachado` |

**Nunca** escreva no texto o número, a letra ou o romano que a classe gera.

## Âncoras

```html
<!-- link para documento ou processo: texto = protocoloFormatado do id -->
<span contenteditable="false" style="text-indent:0;"><a class="ancoraSei" id="lnkSei3242105" style="text-indent:0;">2953648</a></span>

<!-- destinatário vinculado à unidade (Despacho): sugere a unidade ao tramitar -->
<p class="Texto_Alinhado_Esquerda">À <span contenteditable="false" style="text-indent:0px;" class="ancoraSei interessadoSeiPro" data-id="110000061">SFC - Superintendência de Fiscalização</span></p>
```

`data-id` é o id da unidade (API: `sei_pesquisar_unidades`).

## Tabelas

Padrão observado na Funai (cores já em `rgb()`, ver nota abaixo):

```html
<table border="1" cellpadding="4" style="border-collapse: collapse; border-color: rgb(100,100,100); margin-left: 1.18in; margin-right: auto; width: auto;">
  <thead>
    <tr style="background-color: rgb(221,221,221);">
      <th style="font-weight: normal; font-size: 16px;"><p class="Tabela_Texto_Centralizado"><strong>Coluna</strong></p></th>…
    </tr>
  </thead>
  <tbody>
    <tr><td><p class="Tabela_Texto_Alinhado_Esquerda">…</p></td>…</tr>
    <tr style="background-color: rgb(221,221,221);">…</tr>   <!-- zebra: linhas pares do tbody -->
  </tbody>
</table>
```

- 1ª coluna `Tabela_Texto_Alinhado_Esquerda`; centralizados
  `Tabela_Texto_Centralizado`. Colunas de sigla com `white-space: nowrap`
  (`CR-CEPIRN` quebra no hífen).
- **Cores em `rgb()`, não `#hex`.** Na ANTAQ, `#` dentro de `style` fez o
  Cloudflare barrar o salvamento. Na Funai não há Cloudflare, então lá é só
  precaução sem custo. Se o editor reconverter para hex ao salvar, não é
  problema onde não há WAF.
- Editar tabela existente (ex. anexo de Ofício, com `<span>` aninhados
  carregando fonte, cor e negrito): **clone uma linha de dados** como modelo e
  troque só o texto do elemento mais interno de cada célula. Ajuste
  `style.backgroundColor` para as cores alternadas por grupo. Coluna nova:
  clone a última célula do cabeçalho e das linhas.

**Bloco de tabela numa Nota Técnica** (irmãos diretos de `body`):
`TABELA N` (rótulo, `Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples`) →
legenda em `<strong>` → `<table>` → `<em>Fonte: …</em>` → parágrafo em branco.
Para achar a tabela N: rótulo por texto exato, depois `nextElementSibling`
até o `TABLE`.

**Bloco de figura:** `FIGURA N` → título em negrito → subtítulo opcional →
`<img>` base64 (a NT final leva as figuras embutidas). Em edição de texto,
**nunca toque nas imagens** e confira a contagem de `<img>` antes e depois.
Versão só-texto: `FIGURA N` + título em negrito + subtítulo, sem `<img>`.

## Ofício (Funai — formato aprovado pelo usuário)

Seções próprias, somente leitura: códigos de barras, timbre, número, rodapé
("Referência: Caso responda este Ofício…"). Data em seção própria
(`Texto_Alinhado_Direita`, "Brasília, *data da assinatura eletrônica*.") — não
mexer. Corpo (instância editável com `Assunto:`):

```html
<p class="Texto_Alinhado_Esquerda_Espacamento_Simples">Aos Coordenadores Regionais da Fundação Nacional dos Povos Indígenas</p>
<p class="Texto_Justificado" contenteditable="false">&nbsp;</p>                    <!-- fixo -->
<p class="Texto_Alinhado_Esquerda_Espacamento_Simples"><strong>Assunto:</strong> …</p>
<p class="Texto_Justificado_Recuo_Primeira_Linha">Prezados(as) …,</p>              <!-- vocativo -->
<p class="Paragrafo_Numerado_Nivel1">…</p>                                           <!-- N parágrafos -->
<p class="Texto_Justificado_Recuo_Primeira_Linha" contenteditable="false">&nbsp;</p> <!-- fixo -->
<p class="Texto_Justificado_Recuo_Primeira_Linha">Atenciosamente,</p>
<p class="Texto_Justificado_Recuo_Primeira_Linha">&nbsp;</p>
<p class="Tabela_Texto_Centralizado"><em>(Assinado Eletronicamente)</em><br />NOME EM MAIÚSCULAS<br />Cargo</p>
```

- Destinatário é tudo antes do espaçador fixo que precede o Assunto; coletivo
  numa linha só. Preencha a linha `Assunto:` existente.
- Fecho (Manual de Redação da Presidência): "Atenciosamente," (mesma hierarquia
  ou inferior); "Respeitosamente," (autoridade superior).
- Signatário: se não for informado, pergunte. Num script, deixe
  `SIGNATARIO_NOME`/`SIGNATARIO_CARGO` como constantes no topo e diga qual
  valor foi presumido. **Placeholders do modelo ("NOME DO ASSINANTE") não
  podem ficar.** Ex.: ARTUR NOBRE MENDES — Coordenador-Geral de Gestão
  Estratégica.
- Fecho sempre **com vírgula**.
- Links externos com a URL visível ("disponível em: <a href=URL>URL</a>"),
  porque o Ofício é lido impresso/PDF. **Leia os `href` do próprio documento**
  em vez de redigitá-los no script.
- Tabela de anexos no corpo (ex. "Grupos de CRs"): ver "Editar tabela
  existente" acima. Ela fica depois do signatário.
- Coerência: aponte em uma linha divergências (ex. "planilha" que é um
  formulário Google; proposta "definitiva" que ainda depende de aprovação).
  Corrija só o inequívoco.

## Despacho (ANTAQ — convenção do mcp-seipro)

```html
<p class="Texto_Alinhado_Esquerda">À <span … class="ancoraSei interessadoSeiPro" data-id="ID_UNIDADE">SIGLA - Nome</span></p>
<p class="Texto_Justificado"><strong>Assunto:</strong> …</p>
<p class="Paragrafo_Numerado_Nivel1">…</p>                         <!-- corpo -->
<p class="Texto_Justificado_Recuo_Primeira_Linha">Atenciosamente,</p>
<p class="Texto_Centralizado_Maiusculas">nome do signatário</p>
<p class="Texto_Centralizado">Cargo</p>
```

## Nota Técnica / Parecer

**Funai:** títulos de seção em `Texto_Fundo_Cinza_Maiusculas_Negrito` (sem
autonumeração), corpo em `Paragrafo_Numerado_Nivel1`, tabelas e figuras nos
blocos descritos em "Tabelas"; seções `Assunto:` → Sumário Executivo → … →
encaminhamentos → tabela de assinaturas → referências.

**ANTAQ / padrão mcp-seipro:** títulos autonumerados `Item_Nivel*`:

```html
<p class="Item_Nivel1">Introdução</p>              <!-- vira "1. INTRODUÇÃO" -->
<p class="Paragrafo_Numerado_Nivel1">…</p>
<p class="Item_Nivel2">Do objeto</p>               <!-- "1.1. Do objeto" -->
<p class="Item_Alinea_Letra">…;</p>
<p class="Item_Inciso_Romano">…;</p>
<p class="Citacao">"Art. 1º …" (Lei nº …)</p>
```

Markdown → SEI: `#`→`Item_Nivel1`, `##`→`Item_Nivel2`, `###`→`Item_Nivel3`,
parágrafo→`Paragrafo_Numerado_Nivel1`, lista ordenada por letra→`Item_Alinea_Letra`,
`>`→`Citacao`.

## Conteúdo vindo de .qmd (Quarto) ou de PDF assinado

Ver `qmd-e-pdf.md` (nos dois sentidos).
