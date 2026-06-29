#!/usr/bin/env python3
"""Generate extra Meshy animations for the rigged BULL character.
Walk + run came free with rigging; here we add idle, jump and dances.
Each returns a GLB = full rigged mesh + that one clip. Run after meshy_char.py."""
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
OUT = os.path.join("meshy_output", "ansem_bull")
STATE = os.path.join(OUT, "state.json")
state = json.load(open(STATE))
RIG_ID = state["rig_id"]
state.setdefault("anims", {})

# (action_id, slug)  -- action ids verified from Meshy animation library
ANIMS = [
    (0,   "idle"),
    (466, "jump"),
    (591, "dance_hiphop"),
    (74,  "dance_gangnam"),
    (395, "dance_breakdance"),
]

def create(ep, payload):
    r = S.post(f"{BASE}{ep}", headers=H, json=payload, timeout=60)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:300]}", flush=True); return None
    return r.json()["result"]

def poll(ep, tid, timeout=600):
    el, d = 0, 5
    while el < timeout:
        t = S.get(f"{BASE}{ep}/{tid}", headers=H, timeout=60).json()
        st, pr = t["status"], t.get("progress",0)
        print(f"    {pr}% {st} ({el}s)", flush=True)
        if st == "SUCCEEDED": return t
        if st in ("FAILED","CANCELED"):
            print(f"    {st}: {t.get('task_error',{}).get('message','?')}", flush=True); return None
        cur = 15 if pr>=95 else d
        time.sleep(cur); el += cur
        if pr<95: d = min(d*1.5,30)
    return None

def dl(url, path):
    r = S.get(url, timeout=600, stream=True); r.raise_for_status()
    with open(path,"wb") as f:
        for c in r.iter_content(8192): f.write(c)
    print(f"    saved {path} ({os.path.getsize(path)/1e6:.1f} MB)", flush=True)

for action_id, slug in ANIMS:
    if state["anims"].get(slug, {}).get("done"):
        print(f"[skip] {slug}", flush=True); continue
    print(f"[anim] {slug} (action_id={action_id})", flush=True)
    tid = state["anims"].get(slug, {}).get("id")
    if not tid:
        tid = create("/openapi/v1/animations", {"rig_task_id": RIG_ID, "action_id": action_id})
        if not tid: continue
        state["anims"][slug] = {"id": tid, "action_id": action_id}
        json.dump(state, open(STATE,"w"), indent=2)
    t = poll("/openapi/v1/animations", tid)
    if not t: continue
    url = t["result"].get("animation_glb_url")
    if url:
        dl(url, os.path.join(OUT, f"anim_{slug}.glb"))
        state["anims"][slug]["done"] = True
        state["anims"][slug]["credits"] = t.get("consumed_credits")
        json.dump(state, open(STATE,"w"), indent=2)

print("\n=== ANIMS COMPLETE ===", flush=True)
print(json.dumps(state["anims"], indent=2), flush=True)
bal = S.get(f"{BASE}/openapi/v1/balance", headers=H, timeout=30).json()
print("balance:", bal, flush=True)
