"""Quick smoke test for the ocorrencias package."""
from ocorrencias import formalizer, mapper

print("OK: imports work")

cfg = mapper.load_config()
tmap = mapper.load_template_map()

print(f"Config keys: {list(cfg.keys())}")
print(f"Template map fields: {list(tmap['fields'].keys())}")
print("ALL TESTS PASSED")
