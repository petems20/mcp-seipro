"""Testa o texto que o servidor mostra ao modelo: descreve, não comanda.

O checklist do diretório da Anthropic rejeita descrição que diz ao Claude como
se comportar e proíbe mexer na memória dele. As tools de assinatura mandavam
"salvar o cargo na memória da conversa" e "reutilizar sem perguntar
novamente"; as instruções do servidor mandavam "NUNCA peça login ou senha".
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
os.environ.setdefault("SEI_URL", "https://exemplo.gov.br/api/v2")

import mcp_seipro.server as srv  # noqa: E402

_PROIBIDOS = ("memória", "sem perguntar", "grave o cargo", "nunca peça")

_CARGOS = [{"id": "1", "nome": "Agente Público"}, {"id": "2", "nome": "Gerente"}]


class _Ctx:
    def __init__(self, cli):
        self.request_context = type("R", (), {"lifespan_context": {"sei": cli}})()


class _Resp:
    def json(self):
        return {"data": _CARGOS}


class _FakeClient:
    _usuario = "fulano"
    _senha = "segredo"

    def __init__(self):
        self.chamadas = []

    async def _request(self, metodo, rota, **kwargs):
        self.chamadas.append((metodo, rota))
        return _Resp()


def _sem_comando(texto):
    baixo = (texto or "").lower()
    return [p for p in _PROIBIDOS if p in baixo]


def test_instrucoes_do_servidor_nao_comandam_o_modelo():
    assert not _sem_comando(srv.mcp.instructions)


def test_descricoes_das_tools_nao_comandam_o_modelo():
    achados = {n: _sem_comando(t.description)
               for n, t in srv.mcp._tool_manager._tools.items()}
    achados = {n: v for n, v in achados.items() if v}
    assert not achados, achados


def test_assinar_sem_cargo_lista_cargos_sem_mandar_memorizar():
    chamadas = (
        (srv.sei_assinar_documento, {"id_documento": "123"}),
        (srv.sei_assinar_bloco, {"id_bloco": "45"}),
        (srv.sei_assinar_documentos_bloco, {"documentos": "123,124"}),
    )
    for tool, kwargs in chamadas:
        cli = _FakeClient()
        resp = json.loads(asyncio.run(tool(ctx=_Ctx(cli), **kwargs)))
        assert resp["cargos_disponiveis"] == _CARGOS, tool.__name__
        assert ("GET", "/assinante/listar") in cli.chamadas, tool.__name__
        assert not _sem_comando(json.dumps(resp, ensure_ascii=False)), tool.__name__


if __name__ == "__main__":
    import traceback
    mod = sys.modules[__name__]
    testes = [getattr(mod, n) for n in dir(mod) if n.startswith("test_")]
    ok = 0
    for t in testes:
        try:
            t(); print(f"  ✅ {t.__name__}"); ok += 1
        except Exception:
            print(f"  ❌ {t.__name__}"); traceback.print_exc()
    print(f"\n{ok}/{len(testes)} passaram")
    sys.exit(0 if ok == len(testes) else 1)
