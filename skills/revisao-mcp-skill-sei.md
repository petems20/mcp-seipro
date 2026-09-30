# Revisão: mcp-seipro × skill `sei-editar-documentos`

Data: 30/09/2026. Escopo: (1) revisão geral do MCP; (2) o que dele serve para
aprimorar a skill de edição; (3) caminhos para a integração Claude ↔ SEI que
deixou de funcionar via Claude in Chrome; (4) proposta de skill.

## 1. Resumo

- O MCP é hoje o repositório mais completo de **conhecimento operacional**
  sobre como o SEI grava documentos: identidade nº SEI × id interno, seções
  dinâmicas, âncoras, entidades, WAF do Cloudflare, catálogo de 39 classes CSS.
  Quase tudo isso vale também para quem edita pelo navegador, e a skill atual
  não tem nada disso.
- A skill atual é boa na **mecânica do CKEditor** (achar a instância, faixas
  entre âncoras, preservar `contenteditable="false"`, modo console) e no
  **formato do Ofício da Funai**. O MCP não tem nada disso. As duas se
  complementam, não se sobrepõem.
- **Integração:** o MCP elimina o navegador do caminho (API REST do mod-wssei),
  mas **na Funai a API não está ativa**: `GET /api/v2/versao` devolve
  `Class 'MdWsSeiRest' not found` (módulo copiado, não registrado no
  `ConfiguracaoSEI.php`). Até a TI corrigir, a rota viável na Funai continua
  sendo o navegador (Chrome ou console). Na ANTAQ a API funciona.
- **Proposta:** não criar uma segunda skill. Evoluir `sei-editar-documentos`
  para uma v2 com escolha de rota (API → Chrome → Console → texto), regras de
  conteúdo comuns vindas do MCP, e dois utilitários testados: um validador de
  HTML (Python) e um kit JS de console. Rascunho em
  `skills/sei-editar-documentos/`.

## 2. Revisão geral do MCP

**O que é.** Servidor MCP em Python (FastMCP) com 116 tools sobre a API REST
mod-wssei v2 (a mesma do app móvel do SEI) e um scraper opcional do site.
Roda local (stdio: Claude Desktop `.mcpb`, Claude Code, pip) ou remoto
(Streamable HTTP + OAuth no Railway, conectável ao Claude.ai).

**Pontos fortes para edição de documentos** (`src/mcp_seipro/server.py`):

| Mecanismo | Onde | Por que importa |
|---|---|---|
| Resolução nº SEI → id interno sem Solr | `_resolver_documento` | evita abrir/gravar **outro** documento (colisão de namespace) |
| Eco `_documento_resolvido` | `_identidade_documento` | o agente confere o nome antes de gravar |
| Seções dinâmicas vão vazias | `_secao_regenerada_pelo_sei` | o SEI as reconstrói; reenviá-las só engordava o POST e trazia o gatilho do WAF |
| Normalização de entidades | `html_utils.normalizar_entidades_html` | evita acúmulo a cada ciclo ler→gravar |
| Cor hex → `rgb()` no 403 | `_converter_cores_hex` | gatilho do WAF medido em produção (`#333`, `#000000`) |
| Sonda de WAF sem gravar | `_waf_localizar_gatilho` | `versao` inválida faz o SEI recusar antes de escrever → bissecção segura |
| Validação de âncora pelo texto | `_validar_ancoras_sei` | o SEI descarta âncora cujo texto ≠ nº do id |
| `dry_run` | `sei_editar_secao` | prévia exata do payload |
| Erro classificado | `_classificar_erro` | 403 do WAF × 403 de acesso pedem ações opostas |
| Gate de documento restrito | `access_control.py` | consentimento explícito (LGPD/LAI) |

**Limitações relevantes** (documentadas no `CLAUDE.md`): não há excluir
documento nem cancelar assinatura na API; o scraper web está inoperante na
ANTAQ (SSO Microsoft) e é opt-in.

**Achado lateral de portabilidade:** o login do scraper envia
`sbmLogin=Acessar` (`sei_web_client.py:188`). O formulário da Funai usa
`hdnAcao` + `acaoLogin(2)` e o botão `sbmAcessar` — o scraper provavelmente
falharia em silêncio lá. Irrelevante enquanto o scraper for opt-in, mas vale
um ajuste se ele for reativado para outro órgão.

## 3. Por que o Claude in Chrome falha, e o que muda

A skill atual já trata "extensão não conecta" → console. Causas adicionais
prováveis, com o tratamento incorporado na v2:

1. **Editor em popup.** "Editar conteúdo" abre `acao=editor_montar` numa
   janela separada, que pode ficar fora do grupo de abas controlado pela
   extensão. Contorno: abrir essa URL numa aba do grupo. *(Hipótese a
   confirmar no uso — não testei com sessão real.)*
2. **`[BLOCKED: Cookie/query string data]`.** Disparado por HTML cheio de
   entidades. A normalização do MCP, portada para JS (`SEI.ler`), resolve a
   maioria dos casos sem o desvio via download de Blob.
3. **Truncamento em ~1500 caracteres.** Leitura por blocos (`SEI.blocos`).
4. **Cloudflare não é problema no Chrome.** O navegador real resolve o
   desafio. Aliás, é por isso que o MCP tem o transporte "browser". Mas a
   regra de **WAF por conteúdo** (cor hex em `style`) pode valer também para o
   salvamento pelo site em órgãos com Cloudflare. Por isso a v2 manda escrever
   `rgb()` sempre. A skill atual recomendava `#dddddd` nas tabelas.

### Caminhos de integração

| Rota | Funai hoje | ANTAQ hoje | Requisito |
|---|---|---|---|
| **API (mcp-seipro)** | ✗ módulo não registrado | ✓ (transporte `auto`) | mod-wssei ativo + senha local do SIP |
| **Claude in Chrome** | ✓ se a extensão conectar | ✓ | extensão ativa, editor numa aba do grupo |
| **Console** | ✓ | ✓ | usuário cola scripts |
| **Texto puro** | ✓ | ✓ | — |

Para a Funai, o pedido à TI é pequeno e objetivo: registrar
`'MdWsSeiRest' => 'wssei'` no array `Modulos` do `ConfiguracaoSEI.php`
(e conferir o `ConfiguracaoMdWSSEI.php`). Isso também habilita o app móvel
oficial do SEI, o que ajuda a justificar o pedido. Evidência (sem credenciais):
`curl https://sei.funai.gov.br/sei/modulos/wssei/controlador_ws.php/api/v2/versao`
→ HTTP 500, Slim Application Error, `Class 'MdWsSeiRest' not found`.

Com a API ativa, o MCP pode ser usado como **extensão do Claude Desktop**
(`.mcpb`, credenciais locais) ou como **conector remoto** no Claude.ai
(deploy com OAuth). Nos dois casos a edição dispensa o navegador.

## 4. O que incorporar na skill (e o que não)

**Incorporar** (feito na proposta):

| Do MCP | Vira na skill |
|---|---|
| nº SEI ≠ id interno; eco do nome | §1 "Identidade do documento": conferir o nome antes de gravar |
| numeração só por classe | regra 1 + detecção automática (validador e kit) |
| catálogo de 39 classes + atalhos | `references/estilos-e-modelos.md` |
| convenções de Despacho e Nota Técnica | modelos ao lado do Ofício da Funai |
| âncora: texto = nº do id; vale p/ processo | regra 5 + checagem no validador/kit |
| destinatário `interessadoSeiPro data-id` | modelo de Despacho |
| cor hex → rgb | regra 3; `SEI.limpar` e `--corrigir` convertem |
| entidades → UTF-8 | regra 4; resolve parte do `[BLOCKED…]` |
| seções dinâmicas não se editam | regra 7 |
| `dry_run` | `dryRun:true` padrão no kit; `dry_run` na rota API |
| erros classificados | tabela em `diagnostico.md` |
| gate de restrito | §1: não copiar conteúdo restrito sem autorização |
| limites (sem excluir doc) | "não crie documentos de teste" |

**Não incorporar:** OAuth/deploy, shaping de listagem, blocos de assinatura,
marcadores, credenciamento. São do MCP, não da edição. A skill só aponta para
as tools quando elas existem.

**Caminho inverso** (a skill ensina ao MCP; backlog sugerido):
- `sei_editar_secao` com modo **faixa entre âncoras** e preservação de
  `contenteditable="false"`. Hoje o modelo reescreve a seção inteira e pode
  apagar os espaçadores fixos do modelo.
- Expor o validador como tool (`sei_validar_html`), rodado também dentro do
  `dry_run`.
- Registrar as classes da Funai (`…_Esp_Simples`, `…_Espacamento_Simples_Maiusc`)
  em `sei_styles.py`.

## 5. Proposta de skill (v2 de `sei-editar-documentos`)

**Por que v2, não skill nova:** o gatilho é o mesmo ("editar documento no
SEI"). Duas skills disputariam o acionamento e duplicariam regras. A v2 escolhe
a rota e mantém as regras num lugar só.

```
skills/sei-editar-documentos/
├── SKILL.md                        rotas, identidade, 9 regras de conteúdo, ciclo testado
├── references/
│   ├── rota-api.md                 fluxo com as tools sei_*, leitura de erros, limites
│   ├── rota-navegador.md           Chrome + Console: instâncias, leitura, faixa/pontual, teste, conferência
│   ├── estilos-e-modelos.md        classes, âncoras, tabelas/figuras, Ofício/Despacho/NT
│   ├── revisao-e-consistencia.md   convenções de redação, consistência NT × Ofício
│   ├── qmd-e-pdf.md                .qmd → SEI e SEI/PDF → .qmd
│   └── diagnostico.md              sintomas → causa → ação (Chrome, API, Cloudflare)
└── scripts/
    ├── validar_html_sei.py         lint + --corrigir (stdlib)
    ├── sei-console-kit.js          window.SEI (prévia por padrão, guardas de âncora e imagem)
    ├── modelo-edicao-pontual.js    molde em duas fases para documento longo
    └── testar_no_chromium.mjs      testa um script 2× contra o HTML real
```

**Diferenças para a v1:**
- Descrição cobre a rota API e os gatilhos "SEI nº", nº de processo, tipos de
  documento.
- SKILL.md fica curto (roteamento e regras); o detalhe mecânico foi para
  `references/`, carregado só na rota em uso.
- O `#dddddd` das tabelas virou `rgb(221,221,221)`.
- Os scripts de console deixam de ser escritos do zero a cada vez: o kit dá
  `dryRun` por padrão, idempotência e diagnóstico quando a âncora não existe.
- Removida a referência fixa a `sei.funai.gov.br` no passo de permissão (vale
  para qualquer órgão). O formato do Ofício da Funai foi mantido integralmente.

**Testes feitos:** validador em HTML com problemas conhecidos (numeração
manual em 3 classes, hex, entidades, âncoras erradas, base64, falso positivo
"1990 foi…" corrigido). Kit JS em Chromium headless com CKEDITOR simulado:
carga, `corpo` único/ambíguo, `ler` sem base64/entidades, `limpar`, `avisos`,
`substituirFaixa` em dry-run (não altera), aplicação, idempotência, âncora
ausente (não altera), recusa de instância readOnly.
**Não testado:** SEI real com sessão (nem pela API nem pelo editor). A versão
do CKEditor no SEI 5 não foi verificada; o kit informa `CKEDITOR.version` ao
carregar.

## 6. Incorporação da evolução da v1 (outra sessão)

A outra sessão evoluiu a v1 a partir de uso real: uma Nota Técnica de ~190 mil
caracteres com 28 imagens, mais o Ofício que a acompanha. O que entrou na v2:

| Da outra sessão | Onde ficou |
|---|---|
| ciclo ler (arquivo) → script pontual → testar offline → aplicar/salvar → reler → conferir | `SKILL.md` §3 |
| estrutura de instâncias do Ofício e da Nota Técnica (Funai) | `rota-navegador.md` §2 |
| entidades em `getData()`: achar texto por `textContent`, âncora sem acento | `rota-navegador.md` §3 (o kit já normaliza) |
| inspeção que **baixa arquivo** + `copy()`, com tamanho e `dirty` | `SEI.inspecionar()` no kit |
| "Visualizar documento" ≠ conteúdo do editor | `SKILL.md` §1, `rota-navegador.md` §4, `diagnostico.md` |
| `dirty=true` na leitura inicial | `SKILL.md` §3, kit (`dirty_antes`) |
| edição pontual em duas fases, idempotente, com guarda de imagens | `scripts/modelo-edicao-pontual.js` (+ `trocaGlobal` e `linha` de tabela, e flag `APLICAR`) |
| armadilhas (já aplicado, duas trocas no mesmo nó, renumeração, inserção) | `rota-navegador.md` §5 |
| NBSP literal proibido no código | `SKILL.md` regra 4; o próprio kit tinha um NBSP literal, corrigido |
| teste em Chromium headless (2 execuções, imagens idênticas, screenshot) | `scripts/testar_no_chromium.mjs` |
| conferência da versão salva; não reverter edição manual | `rota-navegador.md` §9, `SKILL.md` §3 |
| tabelas com `thead`/`th`, zebra no `tbody`, blocos TABELA/FIGURA, clonar linha | `estilos-e-modelos.md` |
| Ofício: placeholder, fecho com vírgula, `href` lidos do documento, tabela de anexos | `estilos-e-modelos.md` |
| convenções de redação Funai/CGGE e consistência NT × Ofício | `revisao-e-consistencia.md` (+ checagens informativas no validador) |
| `.qmd` ← PDF assinado (PyMuPDF, comparação nos dois sentidos) | `qmd-e-pdf.md` |
| lista Trocar/Por no fallback de texto | `SKILL.md` §6 |

**Onde a v2 diverge da proposta:**
- Tabelas continuam com `rgb()` em vez de `#646464`/`#dddddd`. É neutro na
  Funai (sem Cloudflare) e evita o 403 em órgão com WAF.
- "Sem imagem base64" virou "imagens existentes são intocáveis": a NT final
  leva figuras embutidas, então a regra antiga estava errada. No validador,
  imagem passou de aviso a informativo.
- O `substituirFaixa` do kit ganhou as guardas da proposta: âncora ambígua →
  nada muda; recusa remover imagem sem `{permitirImagens: true}`.
- O teste de instância do modelo pontual procura no HTML cru (âncora sem
  acento), como na proposta. O kit procura no texto normalizado, então aceita
  âncora com acento.

**Testado:** o modelo pontual no harness sobre um corpo com imagens, tabela,
NBSP e grafia divergente. A 1ª execução aplicou 3 alterações, a 2ª deu "Nada a
fazer", com HTML idêntico entre as duas e as mesmas imagens na mesma ordem.
Kit: novos casos (faixa com imagem recusada, `aplicar` com imagem recusado,
âncora ambígua recusada, inspeção com aviso de `dirty`). Validador: placeholder
como erro; `--`, `78.2%` e `9:30h` como informativos.

**Para publicar:** substituir o conteúdo da skill atual (sincronizada da
organização no Claude.ai) pela pasta `skills/sei-editar-documentos/` (zipar a
pasta e reenviar em Configurações → Skills, mantendo o mesmo `name`).
