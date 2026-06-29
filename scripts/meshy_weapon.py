#!/usr/bin/env python3
"""Generate a tactical rifle prop to mount on the BULL character's back.
text-to-3d (preview + refine, low-ish poly for a back prop)."""
import requests, time, os, sys, json

def load_key():
    if os.path.exists(".env"):
        for line in open(".env"):
            if line.strip().startswith("MESHY_API_KEY="):
                return line.split("=",1)[1].strip().strip('"').strip("'")
    return os.environ.get("MESHY_API_KEY","").strip()

API_KEY = load_key()
BASE = "https://api.meshy.ai"
H = {"Authorization": f"Bearer {API_KEY}"}
S = requests.Session(); S.trust_env = False
OUT = os.path.join("meshy_output", "weapon")
os.makedirs(OUT, exist_ok=True)
STATE = os.path.join(OUT, "state.json")
state = json.load(open(STATE)) if os.path.exists(STATE) else {}

PROMPT = ("a black tactical assault rifle, modern M4 carbine military firearm with "
          "collapsible stock, picatinny rail and red dot sight, matte black metal and polymer, "
          "clean game-ready prop asset, single object, side profile")

def create(ep, payload):
    r = S.post(f"{BASE}{ep}", headers=H, json=payload, timeout=60)
    if r.status_code >= 400:
        sys.exit(f"ERROR {r.status_code}: {r.text[:300]}")
    return r.json()["result"]

def poll(ep, tid, timeout=600):
    el, d = 0, 5
    while el < timeout:
        t = S.get(f"{BASE}{ep}/{tid}", headers=H, timeout=60).json()
        st, pr = t["status"], t.get("progress",0)
        print(f"    {pr}% {st} ({el}s)", flush=True)
        if st == "SUCCEEDED": return t
        if st in ("FAILED","CANCELED"): sys.exit(f"{st}: {t.get('task_error',{}).get('message','?')}")
        cur = 15 if pr>=95 else d
        time.sleep(cur); el += cur
        if pr<95: d = min(d*1.5,30)
    sys.exit("TIMEOUT")

def dl(url, path):
    r = S.get(url, timeout=600, stream=True); r.raise_for_status()
    with open(path,"wb") as f:
        for c in r.iter_content(8192): f.write(c)
    print(f"    saved {path} ({os.path.getsize(path)/1e6:.1f} MB)", flush=True)

if "preview_id" not in state:
    print("[weapon 1] text-to-3d preview", flush=True)
    state["preview_id"] = create("/openapi/v2/text-to-3d", {
        "mode":"preview","prompt":PROMPT,"ai_model":"latest",
        "topology":"triangle","target_polycount":8000,"target_formats":["glb"],
    }); json.dump(state, open(STATE,"w"), indent=2)
if not state.get("preview_done"):
    t = poll("/openapi/v2/text-to-3d", state["preview_id"])
    dl(t["model_urls"]["glb"], os.path.join(OUT,"rifle_preview.glb"))
    if t.get("thumbnail_url"):
        try: dl(t["thumbnail_url"], os.path.join(OUT,"rifle_preview_thumb.png"))
        except Exception: pass
    state["preview_done"]=True; json.dump(state, open(STATE,"w"), indent=2)

if "refine_id" not in state:
    print("[weapon 2] text-to-3d refine (texture)", flush=True)
    state["refine_id"] = create("/openapi/v2/text-to-3d", {
        "mode":"refine","preview_task_id":state["preview_id"],
        "enable_pbr":True,"ai_model":"latest",
    }); json.dump(state, open(STATE,"w"), indent=2)
if not state.get("refine_done"):
    t = poll("/openapi/v2/text-to-3d", state["refine_id"])
    dl(t["model_urls"]["glb"], os.path.join(OUT,"rifle.glb"))
    if t.get("thumbnail_url"):
        try: dl(t["thumbnail_url"], os.path.join(OUT,"rifle_thumb.png"))
        except Exception: pass
    state["refine_done"]=True; json.dump(state, open(STATE,"w"), indent=2)

print("\n=== WEAPON COMPLETE ===", flush=True)
bal = S.get(f"{BASE}/openapi/v1/balance", headers=H, timeout=30).json()
print("balance:", bal, flush=True)
