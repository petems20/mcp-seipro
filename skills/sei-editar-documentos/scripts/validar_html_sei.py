#!/usr/bin/env python3
"""Valida (e opcionalmente corrige) HTML destinado a uma seção de documento do SEI.

Só biblioteca padrão. Porta para a skill as regras que o mcp-seipro aplica antes
de gravar (html_utils.normalizar_entidades_html, server._converter_cores_hex,
server._validar_ancoras_sei) e as convenções de sei_styles.py.

Uso:
    python3 validar_html_sei.py corpo.html                 # relatório JSON
    python3 validar_html_sei.py corpo.html --corrigir out.html
    cat corpo.html | python3 validar_html_sei.py -

Código de saída: 0 sem problemas, 1 com problemas (avisos "info" não contam).
"""

from __future__ import annotations

import argparse
import html as html_module
import json
import re
import sys

# Classes do catálogo do SEI (mcp-seipro/sei_styles.py) + variações vistas em
# modelos de órgãos (Funai). Classe fora daqui não é erro — é aviso "info".
CLASSES_CONHECIDAS = {
    "Texto_Justificado", "Texto_Justificado_Recuo_Primeira_Linha",
    "Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples", "Texto_Justificado_Maiusculas",
    "Texto_Alinhado_Esquerda", "Texto_Alinhado_Esquerda_Espacamento_Simples",
    "Texto_Alinhado_Esquerda_Espacamento_Simples_Maiusc", "Texto_Alinhado_Esquerda_Maiusc",
    "Texto_Alinhado_Esquerda_Maiusc_Negrito", "Texto_Alinhado_Direita",
    "Texto_Alinhado_Direita_Maiusc", "Texto_Centralizado", "Texto_Centralizado_Maiusculas",
    "Texto_Centralizado_Maiusculas_Negrito", "Texto_Fundo_Cinza_Negrito",
    "Texto_Fundo_Cinza_Maiusculas_Negrito", "Texto_Espaco_Duplo_Recuo_Primeira_Linha",
    "Citacao", "Tachado", "Texto_Mono_Espacado",
    "Paragrafo_Numerado_Nivel1", "Paragrafo_Numerado_Nivel2", "Paragrafo_Numerado_Nivel3",
    "Paragrafo_Numerado_Nivel4", "Item_Nivel1", "Item_Nivel2", "Item_Nivel3", "Item_Nivel4",
    "Item_Alinea_Letra", "Item_Inciso_Romano", "Item_Inciso_Romano_Recuo",
    "Item_Inciso_Romano_Esquerda_Recuo_Justif",
    "Tabela_Texto_Justificado", "Tabela_Texto_Centralizado", "Tabela_Texto_Alinhado_Esquerda",
    "Tabela_Texto_Alinhado_Direita", "Tabela_Texto_8", "Tabela_Texto_8_Centralizado",
    "Tabela_Fonte_9_Centralizado", "Tabela_Justificado_Recuo_Primeira_Linha",
    # não são de parágrafo, mas aparecem legitimamente
    "ancoraSei", "interessadoSeiPro",
}

_CLASSES_NUMERADAS = (
    r"Paragrafo_Numerado_Nivel\d|Item_Nivel\d|Item_Alinea_Letra|Item_Inciso_Romano\w*"
)
# "1." "2.1" "2.1." "3)" "a)" "IV -" — mas não "1990 foi" (número sem pontuação)
_PREFIXO_MANUAL = (r"(?:\d{1,3}(?:\.\d{1,3})+\.?|\d{1,3}[.)]|[a-z]\)|[IVXLCDM]+\s*[-–—.)])\s+")
_RE_NUMERACAO_MANUAL = re.compile(
    r"(<(?:p|li|div)\b[^>]*\bclass\s*=\s*[\"'][^\"']*\b(?:" + _CLASSES_NUMERADAS + r")\b"
    r"[^\"']*[\"'][^>]*>(?:\s*<(?:strong|b|em|i|u|span)\b[^>]*>)*\s*)(" + _PREFIXO_MANUAL + ")",
    re.IGNORECASE,
)

_ENTIDADES_ESTRUTURAIS = {"lt", "gt", "amp", "quot", "apos",
                          "#60", "#62", "#38", "#34", "#39",
                          "#x3c", "#x3e", "#x26", "#x22", "#x27"}
_RE_ENTIDADE = re.compile(r"&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]{1,31});")
_RE_STYLE_ATTR = re.compile(r"""(style\s*=\s*)(["'])(.*?)\2""", re.IGNORECASE | re.DOTALL)
_RE_COR_HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
_RE_ANCORA = re.compile(
    r"""<a\b[^>]*\bid\s*=\s*["']lnkSei(\d+)["'][^>]*>(.*?)</a\s*>""", re.IGNORECASE | re.DOTALL)
_RE_TEXTO_ANCORA_OK = re.compile(r"^(\d{5,}|\d{4,6}\.\d{6}/\d{4}-\d{2})$")
_RE_CLASS = re.compile(r"""\bclass\s*=\s*["']([^"']*)["']""", re.IGNORECASE)
_RE_TAGS = re.compile(r"<[^>]+>")
_RE_BASE64 = re.compile(r"data:image/[a-z+]+;base64,", re.IGNORECASE)
_RE_PLACEHOLDER = re.compile(
    r"NOME DO ASSINANTE|NOME DO SIGNAT[ÁA]RIO|\bX{3,}\b|\[(?:inserir|preencher)[^\]]*\]|\bTODO\b",
    re.IGNORECASE)
# Convenções de redação (Funai/CGGE) — informativas: o órgão pode adotar outras.
_REDACAO = [
    ("travessao", re.compile(r"\s--\s"), "use travessão – em vez de --"),
    ("decimal_percentual", re.compile(r"\b\d+\.\d+\s?%"), "vírgula decimal em percentual (78,2%)"),
    ("horario", re.compile(r"\b\d{1,2}:\d{2}\s?h\b"), "horário no formato 9h30, não 9:30h"),
]
_RE_STYLE_LAYOUT = re.compile(r"\b(text-align|text-indent|font-size|font-family|margin-left)\s*:",
                              re.IGNORECASE)


def normalizar_entidades(texto: str) -> tuple[str, int]:
    """Entidades → UTF-8 literal, preservando as estruturais (&lt; &gt; &amp; …)."""
    n = 0

    def _sub(m: re.Match) -> str:
        nonlocal n
        if m.group(1).lower() in _ENTIDADES_ESTRUTURAIS:
            return m.group(0)
        dec = html_module.unescape(m.group(0))
        if dec != m.group(0):
            n += 1
            return dec
        return m.group(0)

    return _RE_ENTIDADE.sub(_sub, texto), n


def cores_hex_para_rgb(texto: str) -> tuple[str, int]:
    """#rrggbb/#rgb → rgb(r,g,b), SÓ dentro de atributos style (não toca &#233;)."""
    n = 0

    def _rgb(m: re.Match) -> str:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return "rgb({},{},{})".format(*(int(h[i:i + 2], 16) for i in (0, 2, 4)))

    def _style(m: re.Match) -> str:
        nonlocal n
        valor, k = _RE_COR_HEX.subn(_rgb, m.group(3))
        n += k
        return f"{m.group(1)}{m.group(2)}{valor}{m.group(2)}"

    return _RE_STYLE_ATTR.sub(_style, texto), n


def validar(conteudo: str) -> list[dict]:
    achados: list[dict] = []

    def add(nivel: str, regra: str, detalhe: str, **extra) -> None:
        achados.append({"nivel": nivel, "regra": regra, "detalhe": detalhe, **extra})

    for m in _RE_NUMERACAO_MANUAL.finditer(conteudo):
        trecho = _RE_TAGS.sub("", conteudo[m.start(2):m.start(2) + 60])
        add("erro", "numeracao_manual",
            "a classe já numera; tire o número/letra do texto", trecho=trecho.strip())

    _, n_hex = cores_hex_para_rgb(conteudo)
    if n_hex:
        add("erro", "cor_hexadecimal",
            f"{n_hex} cor(es) #hex em style — o WAF do Cloudflare pode barrar o salvamento; "
            "use rgb()")

    _, n_ent = normalizar_entidades(conteudo)
    if n_ent:
        add("aviso", "entidades", f"{n_ent} entidade(s) desnecessária(s) (&ccedil;, &nbsp;…) "
            "— escreva o caractere literal")

    for id_ancora, texto in _RE_ANCORA.findall(conteudo):
        t = html_module.unescape(_RE_TAGS.sub("", texto)).replace("\xa0", " ").strip()
        if not _RE_TEXTO_ANCORA_OK.match(t):
            add("erro", "ancora_texto",
                f'lnkSei{id_ancora}: texto "{t}" não é nº SEI nem nº de processo — o SEI '
                "descarta a âncora ao salvar")
        elif t == id_ancora:
            add("aviso", "ancora_id",
                f"lnkSei{id_ancora}: id igual ao texto — o id deve ser o INTERNO, não o nº SEI; "
                "confirme (sei_gerar_referencia ou URL id_documento= da árvore)")

    n_b64 = len(_RE_BASE64.findall(conteudo))
    if n_b64:
        add("info", "imagem_base64",
            f"{n_b64} imagem(ns) base64 — em edição de texto, a contagem antes/depois tem que "
            "bater; ao inserir figura nova, confirme que o documento deve levá-la embutida")

    texto_puro = html_module.unescape(_RE_TAGS.sub(" ", conteudo))
    placeholders = sorted({m.group(0) for m in _RE_PLACEHOLDER.finditer(texto_puro)})
    if placeholders:
        add("erro", "placeholder", "texto de modelo que não pode ficar no documento",
            ocorrencias=placeholders)
    for regra, rx, detalhe in _REDACAO:
        achados_rx = sorted({m.group(0) for m in rx.finditer(texto_puro)})
        if achados_rx:
            add("info", regra, detalhe, ocorrencias=achados_rx[:10])

    desconhecidas = sorted({c for grupo in _RE_CLASS.findall(conteudo)
                            for c in grupo.split() if c not in CLASSES_CONHECIDAS})
    if desconhecidas:
        add("info", "classe_desconhecida",
            "fora do catálogo — confira se existe no modelo do órgão", classes=desconhecidas)

    layout = sorted({m.group(1).lower() for s in _RE_STYLE_ATTR.finditer(conteudo)
                     for m in _RE_STYLE_LAYOUT.finditer(s.group(3))})
    if layout:
        add("info", "estilo_inline",
            "alinhamento/fonte/recuo inline — prefira a classe do SEI equivalente",
            propriedades=layout)

    fora = sorted({ch for ch in _RE_TAGS.sub("", conteudo) if ord(ch) > 0xFF})
    if fora:
        add("info", "fora_iso_8859_1",
            "o wssei converte em entidade numérica; no editor web não há problema",
            caracteres="".join(fora[:40]))
    return achados


def corrigir(conteudo: str) -> str:
    conteudo, _ = normalizar_entidades(conteudo)
    conteudo, _ = cores_hex_para_rgb(conteudo)
    conteudo = _RE_NUMERACAO_MANUAL.sub(lambda m: m.group(1), conteudo)
    # "<strong>2.1 </strong>Texto" deixa um <strong></strong> vazio para trás
    return re.sub(r"<(strong|b|em|i|u)>\s*</\1>", "", conteudo)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("arquivo", help="arquivo HTML ou '-' para stdin")
    ap.add_argument("--corrigir", metavar="SAIDA",
                    help="grava versão corrigida (entidades, cores, numeração manual)")
    args = ap.parse_args()

    conteudo = sys.stdin.read() if args.arquivo == "-" else open(args.arquivo, encoding="utf-8").read()
    achados = validar(conteudo)
    saida = {"bytes": len(conteudo.encode("utf-8")), "achados": achados}
    if args.corrigir:
        corrigido = corrigir(conteudo)
        with open(args.corrigir, "w", encoding="utf-8") as f:
            f.write(corrigido)
        saida["corrigido"] = {"arquivo": args.corrigir,
                              "achados_restantes": [a for a in validar(corrigido)
                                                    if a["nivel"] != "info"]}
    print(json.dumps(saida, ensure_ascii=False, indent=1))
    return 1 if any(a["nivel"] != "info" for a in achados) else 0


if __name__ == "__main__":
    sys.exit(main())
