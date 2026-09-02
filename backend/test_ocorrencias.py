"""Quick smoke test for the ocorrencias package and router."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ocorrencias import mapper
from routers.ocorrencias_router import router

print("OK: imports work")

cfg = mapper.load_config()
tmap = mapper.load_template_map()

print(f"Config keys: {list(cfg.keys())}")
print(f"Template map fields: {list(tmap['fields'].keys())}")
print(f"Router routes: {[r.path for r in router.routes]}")
print("ALL TESTS PASSED")
