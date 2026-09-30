# Diagnóstico — quando a integração não funciona

Primeiro, **qual metade falhou**: a ponte até o navegador, o SEI (servidor), ou
a borda (Cloudflare) no meio. Cada uma pede ação diferente.

## Claude in Chrome

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Sem ferramentas `mcp__claude-in-chrome__*`, ou aviso "failed to connect" | extensão desligada/deslogada/sem permissão | dizer em uma frase: ativar a extensão, logar, permitir o domínio do SEI; recarregar extensão e aba. Enquanto isso → rota Console |
| Conecta, mas não enxerga o editor | editor abriu em **popup** fora do grupo de abas | abrir a URL `acao=editor_montar` numa aba do grupo (`navigate`) |
| `CKEDITOR is not defined` | aba/frame errado (árvore ou visualização) | ir à janela do editor; no Console, trocar o contexto "top" pelo frame do editor |
| `[BLOCKED: Cookie/query string data]` | HTML com muitas entidades `&…;` | devolver `SEI.ler(nome)` (normalizado) ou `SEI.blocos(nome)` |
| Resultado cortado em ~1500 caracteres | limite do `javascript_tool` | ler em fatias ou por blocos |
| `CKEDITOR.version` não começa com `4.` | editor novo | não escrever; inspecionar a API do editor antes |
| Arquivo do usuário com acentos como `Ã§` e `<title>SEI/… - <nº>` | é a página "Visualizar documento" (iso-8859-1 declarado, UTF-8 real), não o editor | ler o texto dali; para escrever, pedir `SEI.inspecionar()` |
| Script de console responde "NADA FOI ALTERADO: … não encontrado" depois de já aplicado | a própria troca mudou a âncora (ex. grafia) | esperado; o script não precisa mais ser usado |
| "a contagem de imagens mudaria" | a edição tocaria em figura | estreitar a âncora ou usar troca pontual; nunca forçar |

## API (mcp-seipro)

| Sintoma | Origem | O que fazer |
|---|---|---|
| `Class 'MdWsSeiRest' not found` (HTTP 500, "Slim Application Error") | mod-wssei copiado para o servidor mas **não registrado** no SEI | pedido à TI do órgão: incluir `'MdWsSeiRest' => 'wssei'` no array `Modulos` do `ConfiguracaoSEI.php` (e seguir o `INSTALACAO.md` do módulo). Não há contorno do lado do Claude |
| `Class "ConfiguracaoMdWSSEI" not found` no `/autenticar` | arquivo de config do módulo ausente | TI: copiar `ConfiguracaoMdWSSEI.exemplo.php` → `ConfiguracaoMdWSSEI.php` |
| 403 + "Just a moment…" / `cf-mitigated: challenge` | **desafio** do Cloudflare na borda | `SEI_TRANSPORT=auto` (padrão) escala para Chromium sozinho se o Playwright estiver instalado; senão, regra de bypass no WAF para `/sei/modulos/wssei/` |
| 403 "Attention Required" ao **gravar** (`erro_origem: cloudflare_waf`) | **regra de WAF** casou o conteúdo | a tool já tenta `rgb()` e aponta o trecho; simplifique-o. Outra senha/transporte não resolve |
| 403/401 JSON do wssei (`erro_origem: sei_acesso`) | o SEI recusou | `sei_trocar_unidade` para a unidade geradora; checar permissão |
| "Conteúdo do documento incompleto" | POST sem todas as seções | usar `sei_editar_secao` (monta tudo); não montar o POST à mão |
| Documento "errado" editado/lido | nº SEI tratado como id interno | conferir `_documento_resolvido.nome` antes de gravar |

Sinal de que o órgão tem a API: QR Code do app SEI no fim do menu lateral
(o link contém `.../modulos/wssei/controlador_ws.php/api/v2;siglaorgao:…;orgao:N`).

Login **SSO (Microsoft/gov.br)** no site não impede a API: o `/autenticar` do
wssei usa usuário/senha locais do SIP, caminho separado. Se o usuário **não
tiver** senha local (só SSO), a API não serve para ele.

## Estado observado (30/09/2026, sem credenciais)

- **Funai** (`sei.funai.gov.br`): sem Cloudflare (nginx). Login com usuário/senha
  + opção Microsoft. `/api/v2/versao` → 500 `Class 'MdWsSeiRest' not found`:
  **API indisponível até a TI registrar o módulo**. Rotas viáveis hoje: Chrome e
  Console.
- **ANTAQ** (`sei.antaq.gov.br`): Cloudflare Managed Challenge em todo o
  domínio; API funciona via mcp-seipro com transporte `auto`/browser; site só
  com SSO Microsoft.
