/* Edição pontual em documento longo do SEI (padrão testado numa Nota Técnica de
 * ~190 mil caracteres com 28 imagens). Autônomo: não depende do kit.
 *
 * Duas fases: (1) localizar e validar TUDO; (2) só sem nenhum erro, aplicar e
 * chamar setData. Idempotente: rodar de novo devolve "Nada a fazer".
 * Não salva, não assina, não navega. Testar antes: scripts/testar_no_chromium.mjs.
 *
 * Copie, ajuste INSTANCIA_RE e o bloco "alterações", e entregue ao usuário
 * no chat e como arquivo .js.
 */
(() => {
  // --- configuração -------------------------------------------------------
  const INSTANCIA_RE = /TABELA 1/;   // âncora SEM acento para achar o corpo (getData tem entidades)
  const APLICAR = true;              // false = só valida e lista o que faria

  if (typeof CKEDITOR === 'undefined') {
    return 'CKEDITOR não encontrado: selecione o frame do editor no seletor de contexto do console (onde aparece "top") e rode de novo.';
  }
  const nome = Object.keys(CKEDITOR.instances).find((n) =>
    !CKEDITOR.instances[n].readOnly && INSTANCIA_RE.test(CKEDITOR.instances[n].getData()));
  if (!nome) return 'NADA FOI ALTERADO: instância do corpo não encontrada. Instâncias: ' +
    Object.keys(CKEDITOR.instances).join(', ');
  const ed = CKEDITOR.instances[nome];
  const doc = new DOMParser().parseFromString('<body>' + ed.getData() + '</body>', 'text/html');
  const body = doc.body;
  const blocos = [...body.children];
  const NBSP = / /g;            // escrito como escape: NBSP literal some ao copiar/colar
  const txt = (el) => el.textContent.replace(NBSP, ' ').replace(/\s+/g, ' ').trim();
  const imgsAntes = body.querySelectorAll('img').length;
  const log = [], erros = [], tarefas = [];

  // Bloco único (filho direto de body) cujo texto casa com a regex.
  const acha = (re, rotulo) => {
    const r = blocos.filter((b) => re.test(txt(b)));
    if (r.length !== 1) { erros.push(rotulo + ': ' + r.length + ' blocos (esperado 1)'); return null; }
    return r[0];
  };

  // Troca um trecho dentro de UM nó de texto do elemento (preserva negrito, links, imagens).
  const trocaTexto = (el, antigo, novo, rotulo) => {
    if (!el) return;
    // só includes(novo): `novo` pode conter `antigo` (ex. frase acrescentada ao fim)
    if (txt(el).includes(novo)) { log.push(rotulo + ': já aplicado'); return; }
    const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeValue.replace(NBSP, ' ').includes(antigo)) {
        const no = n;
        // lê o valor NA HORA de aplicar: duas trocas no mesmo nó não se sobrescrevem
        tarefas.push(() => {
          const v = no.nodeValue.includes(antigo) ? no.nodeValue : no.nodeValue.replace(NBSP, ' ');
          no.nodeValue = v.replace(antigo, novo);
        });
        log.push(rotulo + ': ok');
        return;
      }
    }
    erros.push(rotulo + ': trecho não encontrado -> "' + antigo + '"');
  };

  // Troca global de grafia em todos os nós de texto (split/join: idempotente, conta ocorrências).
  const trocaGlobal = (antigo, novo, rotulo) => {
    const w = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nos = [];
    let n, total = 0;
    while ((n = w.nextNode())) {
      const k = n.nodeValue.split(antigo).length - 1;
      if (k) { nos.push(n); total += k; }
    }
    if (!total) { log.push(rotulo + ': já aplicado (0 ocorrências)'); return; }
    tarefas.push(() => nos.forEach((no) => { no.nodeValue = no.nodeValue.split(antigo).join(novo); }));
    log.push(rotulo + ': ' + total + ' ocorrência(s)');
  };

  // Tabela que segue um rótulo "TABELA N" (irmãos diretos de body).
  const tabelaApos = (rot) => {
    let el = rot;
    while (el && el.tagName !== 'TABLE') el = el.nextElementSibling;
    return el;
  };

  // Linha de tabela cujas células (texto normalizado) casam com o teste.
  const linha = (tabela, teste, rotulo) => {
    if (!tabela) return null;
    const r = [...tabela.querySelectorAll('tr')].filter((tr) =>
      teste([...tr.cells].map((c) => txt(c))));
    if (r.length !== 1) { erros.push(rotulo + ': ' + r.length + ' linhas (esperado 1)'); return null; }
    return r[0];
  };

  // --- alterações (exemplos; substitua) -----------------------------------
  const p74 = acha(/^Essa supressão tem efeitos diferentes/, 'Item 74');
  trocaTexto(p74, 'fica 7,2% abaixo', 'fica 7,3% abaixo', 'Item 74');

  const t7 = tabelaApos(acha(/^TABELA 7$/, 'Rótulo da Tabela 7'));
  // normalizar célula já expandida, ex. "Coordenação Regional … (CR-PE)" → "CR-PE", mantém idempotência
  const l7 = linha(t7, (cs) => cs[0].replace(/^.*\((CR-[\w-]+)\)$/, '$1') === 'CR-PE', 'Tabela 7, CR-PE');
  if (l7) trocaTexto(l7.cells[2], '75.0%', '75,0%', 'Tabela 7, CR-PE, col. 3');

  trocaGlobal('CR-MSOL', 'CR-MSol', 'Grafia CR-MSol');

  // --- fase 2 --------------------------------------------------------------
  if (erros.length) {
    return 'NADA FOI ALTERADO (' + nome + '):\n- ' + erros.join('\n- ') +
      '\n\nVerificações:\n- ' + log.join('\n- ');
  }
  if (!tarefas.length) return 'Nada a fazer (' + nome + '): tudo já estava aplicado.\n- ' + log.join('\n- ');
  if (!APLICAR) return 'PRÉVIA (' + nome + '): ' + tarefas.length + ' alterações seriam feitas.\n- ' + log.join('\n- ');
  tarefas.forEach((f) => f());
  if (body.querySelectorAll('img').length !== imgsAntes) {
    return 'NADA FOI ALTERADO: a contagem de imagens mudaria (' + imgsAntes + ').';
  }
  ed.setData(body.innerHTML);
  return 'OK (' + nome + '): ' + tarefas.length + ' alterações; imagens preservadas (' + imgsAntes +
    '). Confira e clique em Salvar.\n- ' + log.join('\n- ');
})();
