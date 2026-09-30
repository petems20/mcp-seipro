/* SEI console kit — cole UMA vez no console da JANELA DO EDITOR do SEI
 * (URL com acao=editor_montar). Expõe window.SEI. Não salva, não assina,
 * não navega: só lê, faz prévia e aplica setData na instância indicada.
 *
 *   SEI.instancias()                     lista instâncias (readOnly, dirty, início)
 *   SEI.corpo(/Assunto\s*:/i)            nome da ÚNICA instância editável que casa
 *   SEI.ler(nome)                        HTML sem base64 e sem entidades supérfluas
 *   SEI.blocos(nome)                     um resumo por bloco (índice, tag, classe, texto)
 *   SEI.inspecionar()                    copia todas as instâncias p/ a área de transferência
 *   SEI.limpar(html)                     cores hex → rgb() em style; entidades → UTF-8
 *   SEI.avisos(html)                     numeração manual, âncora suspeita, base64
 *   SEI.aplicar(nome, html, {dryRun})    substitui a instância inteira
 *   SEI.substituirFaixa(nome, reIni, reFim, html, {dryRun, incluirInicio, incluirFim})
 *                                        troca só os blocos entre duas âncoras de texto
 * dryRun é true por padrão: nada muda até você passar {dryRun: false}.
 */
(() => {
  if (typeof CKEDITOR === 'undefined') {
    return 'SEM CKEDITOR nesta janela/frame (' + location.href + '). Abra o editor ' +
      'ou escolha o frame do editor no seletor de contexto do console.';
  }

  const ESTRUTURAIS = new Set(['lt', 'gt', 'amp', 'quot', 'apos',
    '#60', '#62', '#38', '#34', '#39', '#x3c', '#x3e', '#x26', '#x22', '#x27']);
  const NUMERADAS = /^(Paragrafo_Numerado_Nivel\d|Item_Nivel\d|Item_Alinea_Letra|Item_Inciso_Romano\w*)$/;
  const PREFIXO_MANUAL = /^\s*(\d{1,3}(\.\d{1,3})+\.?|\d{1,3}[.)]|[a-z]\)|[IVXLCDM]+\s*[-–—.)])\s+/;
  const TEXTO_ANCORA_OK = /^(\d{5,}|\d{4,6}\.\d{6}\/\d{4}-\d{2})$/;
  const ta = document.createElement('textarea');

  const ed = (nome) => {
    const e = CKEDITOR.instances[nome];
    if (!e) throw new Error('instância não existe: ' + nome + ' | há: ' +
      Object.keys(CKEDITOR.instances).join(', '));
    return e;
  };
  const semBase64 = (html) =>
    html.replace(/(src=["']data:image\/[a-z+]+;base64,)[^"']*(["'])/gi, '$1…$2');
  const parse = (html) =>
    new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
  const bytes = (s) => new Blob([s]).size;

  function normalizarEntidades(html) {
    return html.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,31});/gi, (m, c) => {
      if (ESTRUTURAIS.has(c.toLowerCase())) return m;
      ta.innerHTML = m;
      return ta.value === m ? m : ta.value;
    });
  }

  function texto(html) {
    return normalizarEntidades(html.replace(/<img[^>]*>/gi, '[img]').replace(/<[^>]+>/g, ' '))
      .replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hexParaRgb(html) {
    let n = 0;
    const out = html.replace(/(style\s*=\s*)(["'])([\s\S]*?)\2/gi, (m, a, q, v) =>
      a + q + v.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (_, h) => {
        n++;
        if (h.length === 3) h = h.split('').map((c) => c + c).join('');
        return 'rgb(' + [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(',') + ')';
      }) + q);
    return [out, n];
  }

  function limpar(html) {
    return hexParaRgb(normalizarEntidades(html))[0];
  }

  function avisos(html) {
    const body = parse(html);
    const av = [];
    body.querySelectorAll('[class]').forEach((el) => {
      if ([...el.classList].some((c) => NUMERADAS.test(c)) &&
          PREFIXO_MANUAL.test(el.textContent)) {
        av.push('numeração manual numa classe que já numera: "' +
          el.textContent.trim().slice(0, 50) + '"');
      }
    });
    body.querySelectorAll('a[id^="lnkSei"]').forEach((a) => {
      const t = a.textContent.replace(/ /g, ' ').trim();
      if (!TEXTO_ANCORA_OK.test(t)) {
        av.push(a.id + ': texto "' + t + '" não é nº SEI nem nº de processo — o SEI descarta a âncora');
      } else if (a.id === 'lnkSei' + t) {
        av.push(a.id + ': id igual ao texto — provavelmente usou o nº SEI no lugar do id interno');
      }
    });
    if (/data:image\//i.test(html)) av.push('imagem base64 no conteúdo (pesada para o SEI)');
    if (hexParaRgb(html)[1]) av.push('cor hexadecimal em style (use SEI.limpar)');
    return av;
  }

  function instancias() {
    return Object.keys(CKEDITOR.instances).map((n) => {
      const e = CKEDITOR.instances[n];
      return n + (e.readOnly ? ' (somente leitura)' : '') + ' | dirty=' + e.checkDirty() +
        ' | ' + texto(e.getData()).slice(0, 80);
    }).join('\n');
  }

  function corpo(re) {
    const hits = Object.keys(CKEDITOR.instances).filter((n) =>
      !CKEDITOR.instances[n].readOnly && re.test(texto(CKEDITOR.instances[n].getData())));
    if (hits.length === 1) return hits[0];
    throw new Error((hits.length ? 'mais de uma' : 'nenhuma') +
      ' instância editável casa ' + re + '\n' + instancias());
  }

  const ler = (nome) => normalizarEntidades(semBase64(ed(nome).getData()));

  function blocos(nome) {
    return [...parse(ed(nome).getData()).children].map((el, i) =>
      i + ' <' + el.tagName.toLowerCase() + (el.className ? ' .' + el.className : '') +
      (el.getAttribute('contenteditable') === 'false' ? ' FIXO' : '') + '> ' +
      el.textContent.trim().slice(0, 80)).join('\n');
  }

  function inspecionar() {
    const out = Object.keys(CKEDITOR.instances).map((n) => {
      const e = CKEDITOR.instances[n];
      return '=== ' + n + (e.readOnly ? ' (somente leitura)' : '') +
        ' | dirty=' + e.checkDirty() + ' ===\n' + ler(n);
    }).join('\n\n');
    if (typeof copy === 'function') {
      copy(out);
      return 'Copiado: ' + out.length + ' caracteres. Cole no chat.';
    }
    return out;
  }

  function relatorio(nome, antes, depois, extra, dryRun) {
    return JSON.stringify(Object.assign({
      instancia: nome,
      dryRun: dryRun,
      bytes_antes: bytes(antes),
      bytes_depois: bytes(depois),
      avisos: avisos(depois),
    }, extra), null, 1);
  }

  function aplicar(nome, html, opts) {
    const dryRun = !(opts && opts.dryRun === false);
    const e = ed(nome);
    if (e.readOnly) throw new Error(nome + ' é somente leitura — seção gerada pelo SEI');
    const antes = e.getData();
    const novo = limpar(html);
    if (!dryRun) e.setData(novo);
    return relatorio(nome, antes, novo, {}, dryRun);
  }

  function substituirFaixa(nome, reIni, reFim, html, opts) {
    const o = Object.assign({ dryRun: true, incluirInicio: false, incluirFim: false }, opts);
    const e = ed(nome);
    if (e.readOnly) throw new Error(nome + ' é somente leitura — seção gerada pelo SEI');
    const antes = e.getData();
    const body = parse(antes);
    const filhos = [...body.children];
    const iIni = filhos.findIndex((el) => reIni.test(el.textContent));
    const iFim = filhos.findIndex((el, i) => i > iIni && reFim.test(el.textContent));
    if (iIni < 0 || iFim < 0) {
      return 'NADA ALTERADO: âncora ' + (iIni < 0 ? 'inicial ' + reIni : 'final ' + reFim) +
        ' não encontrada.\n' + blocos(nome);
    }
    const de = o.incluirInicio ? iIni : iIni + 1;
    const ate = o.incluirFim ? iFim : iFim - 1;
    const faixa = filhos.slice(de, ate + 1);
    const fixos = faixa.filter((el) => el.getAttribute('contenteditable') === 'false');
    const removidos = faixa.filter((el) => !fixos.includes(el));
    // ponto de inserção: onde estava o 1º bloco removido (ou logo após a âncora inicial)
    const ref = removidos.length ? removidos[0] : filhos[iIni].nextSibling;
    const novos = [...parse(limpar(html)).childNodes];
    novos.forEach((n) => body.insertBefore(n, ref));
    removidos.forEach((el) => el.remove());
    const depois = body.innerHTML.replace(/&nbsp;/g, ' ');
    if (!o.dryRun) e.setData(depois);
    return relatorio(nome, antes, depois, {
      blocos_removidos: removidos.length,
      blocos_fixos_preservados: fixos.length,
      blocos_inseridos: novos.filter((n) => n.nodeType === 1).length,
    }, o.dryRun);
  }

  window.SEI = { instancias, corpo, ler, blocos, inspecionar, limpar, avisos,
    aplicar, substituirFaixa, _normalizarEntidades: normalizarEntidades, _hexParaRgb: hexParaRgb };
  return 'SEI kit carregado — CKEditor ' + CKEDITOR.version + ', ' +
    Object.keys(CKEDITOR.instances).length + ' instâncias:\n' + instancias();
})();
