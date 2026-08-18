"""
Renovar MSAL_TOKEN_CACHE no GitHub Actions para boxer-portal-bmax.
Usa device code flow - abre browser para login Microsoft.
Depois seta o secret no GitHub via gh CLI.
"""
import sys, subprocess, json

try:
    import msal
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "msal", "-q"])
    import msal

CLIENT_ID = "d1fb2af8-a56b-41a0-8401-e87591360016"
TENANT_ID = "c0bbec8e-9949-4dcf-80b3-bd21689c33e4"
SCOPE     = ["https://graph.microsoft.com/Sites.Read.All"]
REPO      = "Tekweld/boxer-portal-bmax"

print()
print("=" * 55)
print("  Portal BMax - Renovar token MSAL para GitHub CI")
print("=" * 55)
print()

cache = msal.SerializableTokenCache()
app = msal.PublicClientApplication(
    CLIENT_ID,
    authority=f"https://login.microsoftonline.com/{TENANT_ID}",
    token_cache=cache,
)

flow = app.initiate_device_flow(scopes=SCOPE)
if "user_code" not in flow:
    print(f"ERRO: {flow.get('error_description', 'falha no device flow')}")
    sys.exit(1)

print(flow["message"])
print()

result = app.acquire_token_by_device_flow(flow)
if "access_token" not in result:
    print(f"ERRO: {result.get('error_description', 'login falhou')}")
    sys.exit(1)

print("Token obtido com sucesso!")

cache_json = cache.serialize()
print(f"Cache MSAL: {len(cache_json)} chars")

print(f"Setando secret MSAL_TOKEN_CACHE no repo {REPO}...")
proc = subprocess.run(
    ["gh", "secret", "set", "MSAL_TOKEN_CACHE", "-R", REPO],
    input=cache_json,
    capture_output=True, text=True
)
if proc.returncode == 0:
    print(f"Secret MSAL_TOKEN_CACHE configurado com sucesso!")
else:
    print(f"ERRO: {proc.stderr}")
    sys.exit(1)

print()
print("=" * 55)
print("  CONCLUIDO! O workflow vai funcionar.")
print("=" * 55)
