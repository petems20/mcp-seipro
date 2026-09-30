# .qmd (Quarto) ↔ SEI

## .qmd → SEI

Se o `.qmd` usa `targets::tar_read()`, use o `.html` renderizado pelo Quarto
como fonte (prosa final, citações resolvidas, tabelas computadas). Tire base64
antes do parsing:

```python
import re
html = re.sub(r'(src="data:image/[a-zA-Z+]+;base64,)[^"]*(")', r'\1\2', html)
```

Parseie `#quarto-document-content` e converta cada bloco pelas classes de
`estilos-e-modelos.md`. Antes de gravar, rode
`scripts/validar_html_sei.py --corrigir`.

## SEI → .qmd (o SEI virou a versão de referência)

Quando o usuário editou no SEI ou mandou o PDF assinado, o `.qmd` precisa
acompanhar:

1. Extraia o texto do PDF com **PyMuPDF** (`pip install pymupdf`); `pdftotext`
   e `pdfplumber` podem não estar disponíveis ou funcionar mal. Remova os
   cabeçalhos de página (`Nota Técnica 1 (…) / pg. N`).
2. Separe os parágrafos pelos marcadores de numeração (`\n\d{1,3}\.\n`).
3. Compare **nos dois sentidos**: cada parágrafo do `.qmd` contra o mais
   parecido do PDF (`difflib`), e cada frase do PDF procurada no `.qmd`. Assim
   aparecem tanto trechos alterados quanto frases removidas ou novas.
4. Normalize antes de comparar: citações (`[@chave]` × `(Autor 2020)`),
   `` `r …` `` inline (valores calculados), `--` × `–`, aspas retas × curvas.
5. Confira à parte: legendas de figura (`fig-cap`), legenda e fonte das
   tabelas, e o conteúdo das tabelas fixas (definidas no `.qmd` ou em
   constantes do pipeline). Tabelas geradas pelo pipeline só mudam re-rodando-o.
6. Texto que o usuário mudou à mão numa tabela gerada pelo pipeline (ex. nome
   por extenso numa célula, região de um encontro) deve ir para o **código**
   (constante em `R/config.R` ou transformação no chunk do `.qmd`), não só para
   o SEI. Senão a próxima renderização desfaz.
