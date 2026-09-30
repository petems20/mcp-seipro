# Rota API — mcp-seipro (ferramentas `sei_*`)

Usa a API REST do módulo **mod-wssei** do SEI (o mesmo que o app móvel do SEI
usa). Não depende de navegador: nada de janela do editor, CKEditor, filtro de
cookie, truncamento em 1500 caracteres ou colar script.

**Pré-requisito:** o órgão precisa ter o mod-wssei **instalado e ativado**.
Sinal rápido: o QR Code do app SEI no rodapé do menu lateral. Se a API
responder "Class 'MdWsSeiRest' not found", o módulo está no servidor mas não
foi registrado — ver `diagnostico.md`.

## Fluxo para editar um documento existente

```
sei_listar_secoes(id_documento="<nº SEI ou id>")
  → confira _documento_resolvido.nome  (é o documento certo?)
  → identifique a seção do corpo: idSecaoModelo cuja DinamicaSecaoDocumento="N"
    e que não é somenteLeitura
sei_editar_secao(id_documento, secoes=[{idSecaoModelo, conteudo}], dry_run=true)
  → confira resumo (bytes, alterada_por_voce) e _avisos
sei_editar_secao(... mesmo payload, dry_run=false)
sei_ler_documento(id_documento, formato="markdown")   # conferência final
```

## Fluxo para criar

```
sei_pesquisar_tipos_documento(filtro="Despacho")        → id_serie
sei_criar_documento(processo="NNNNN.NNNNNN/AAAA-NN", id_serie, descricao)
sei_listar_secoes(<id retornado>)  → sei_editar_secao(...)
```

## O que `sei_editar_secao` já faz por você

- Resolve nº SEI → id interno e ecoa `_documento_resolvido`.
- Envia **todas** as seções (o SEI recusa lista parcial com "Conteúdo do
  documento incompleto"); você só informa as que mudam.
- Seções dinâmicas (brasão, título, rodapé) vão **vazias** — o SEI as
  reconstrói do banco. Pedir alteração nelas gera aviso: não são graváveis.
- Normaliza entidades e converte o que estiver fora do ISO-8859-1.
- Valida âncoras `lnkSei` (texto × id) e avisa em `_avisos` — nunca bloqueia.
- 403 do WAF: tenta de novo com cores hex → `rgb()`; se ainda barrar, localiza a
  seção e o trecho culpado com sondas que **não gravam nada**.
- Relê após gravar e falha alto se cabeçalho/rodapé não foram regenerados.
- `idSecaoModelo` inexistente → erro (antes virava "sucesso" sem alterar nada).

## Ferramentas úteis ao redigir

| Ferramenta | Para quê |
|---|---|
| `sei_gerar_referencia(numero_sei)` | HTML da âncora com o id interno certo |
| `sei_pesquisar_unidades` | `data-id` da unidade para destinatário de Despacho |
| `sei_estilos(categoria)` | catálogo de classes (atalhos, texto, lista, tabela) |
| `sei_pesquisar_textos_padrao` | textos padrão da unidade |
| `sei_listar_modelos` | modelos de documento disponíveis |
| `sei_arvore_processo` | documentos do processo (nº SEI, tipo, assinado) |
| `sei_consultar_documento_interno` | metadados, `dataElaboracao` |

## Lendo erros

As respostas de erro trazem `erro_origem` e `erro_acao`. Os dois 403 pedem
ações **opostas**:

| `erro_origem` | Significa | Faça |
|---|---|---|
| `cloudflare_waf` | o **conteúdo** casou uma regra da borda | simplifique o trecho apontado; `dry_run` para inspecionar; nada foi gravado |
| `cloudflare_borda` | a requisição nem chegou ao SEI | problema de infraestrutura (transporte); outra senha não resolve |
| `sei_acesso` | o SEI recusou | `sei_trocar_unidade` para a unidade geradora; verifique permissão |

## Limites da API (não tente contornar)

- **Não existe excluir/cancelar documento** pela API — minuta indesejada só sai
  pela interface web. Não crie documentos "de teste".
- **Não existe cancelar assinatura** pela API.
- Documento **já assinado** não deve ser editado sem pedido explícito: a
  alteração pode invalidar as assinaturas existentes.
