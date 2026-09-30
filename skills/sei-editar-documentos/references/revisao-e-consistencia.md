# Redação, revisão e consistência entre documentos

## Convenções de redação (adotadas pelo usuário — Funai/CGGE)

- **Siglas:** nome completo na primeira citação e só a sigla depois (ex.
  "Coordenação Regional Médio Solimões (CR-MSol)"). Se a primeira citação é
  numa tabela, o nome por extenso vai na célula ("Coordenação Regional de
  Manaus (CR-MAO)"). O usuário preferiu isso a um quadro de siglas.
- **Uma grafia por sigla** no documento inteiro, a do SIORG (`CR-MSol`, não
  misturar com `CR-MSOL`).
- Vírgula decimal em percentuais (`78,2%`, `75,0%`); travessão `–` (nunca
  `--`); legendas terminadas em ponto; `Centro-Oeste`.
- Figuras e tabelas numeradas **sem saltos**. Ao renumerar, atualizar também
  as citações no texto ("Figuras 20 a 23", "(Figura 12)").
- Horário: `9h30`, `14h30 (horário de Brasília)`, não `9:30h`.

`scripts/validar_html_sei.py` sinaliza (como informativo) `--`, `78.2%`,
`9:30h` e, como erro, placeholders ("NOME DO ASSINANTE", `[inserir …]`).

## Consistência entre documentos do mesmo processo (Nota Técnica × Ofício)

Antes de escrever o Ofício que acompanha uma Nota Técnica, ou ao revisar os
dois, confira e liste o que diverge:

- **Listas e grupos** (ex. CRs por encontro): mesmos membros, mesma contagem,
  mesma ordem. Itens presentes num e ausentes no outro são o achado mais grave.
- **Siglas e nomes:** mesma grafia e nome oficial (SIORG) nos dois. O Ofício
  não deve usar denominações antigas (ex. "Nordeste I" × `CR-ALSE`).
- **Primeira citação por extenso** também no Ofício ("Diretoria Colegiada
  (DIRCOL)" na 1ª vez, "DIRCOL" depois).
- **Referência cruzada:** o Ofício cita a Nota Técnica pelo número e nº SEI
  (âncora SEI quando possível — ver `estilos-e-modelos.md`).
- **Etapas e compromissos:** sequência de reuniões/encontros, materiais
  prometidos, papel de terceiros (ex. organizações indígenas) e caráter da
  proposta ("definitivas" × "consolidadas e submetidas à aprovação") iguais
  nos dois.
- **Datas:** confira o dia da semana (`sexta-feira, 02/10`) e se o número de
  horários comporta o número de grupos.
- **Pendências de modelo:** signatário placeholder, fecho sem vírgula, links
  sem URL visível.

Informação que não dá para verificar (ex. cidade-sede de uma unidade nova):
**não invente**. Use só o que é certo (ex. a UF) e avise o usuário.

## Lista de correções (quando o usuário vai aplicar à mão)

Para uma nota longa, organize por item (número do parágrafo no PDF), com
**Trocar:** … / **Por:** … e o texto exato. Separe o que é inequívoco do que
depende de decisão do usuário (opções A/B).
