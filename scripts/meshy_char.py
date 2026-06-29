#!/usr/bin/env python3
"""
Ansem 'BULL' character pipeline (user's preferred flow):
  image-to-3d (standard mesh, NO texture, a-pose)  -> 20 cr
  remesh -> 30k triangles                          ->  5 cr
  retexture (style = reference image, PBR + HD)     -> 10 cr
  rigging (auto-rig + free walk/run anims)          ->  5 cr
Resumable via state.json. Run: python3 -u scripts/meshy_char.py
"""
import requests, time, os, sys, json, base64
from datetime import datetime

# ---- key ----
def load_key():
    k = os.environ.get("MESHY_API_KEY", "").strip()
    if k:
        return k
    if os.path.exists(".env"):
        for line in open(".env"):
            line = line.strip()
            if line.startswith("MESHY_API_KEY=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

API_KEY = load_key()
if not API_KEY:
    sys.exit("ERROR: no MESHY_API_KEY")
print(f"key {API_KEY[:8]}...", flush=True)

BASE = "https://api.meshy.ai"
H = {"Authorization": f"Bearer {API_KEY}"}
S = requests.Session(); S.trust_env = False

OUT = os.path.join("meshy_output", "ansem_bull")
os.makedirs(OUT, exist_ok=True)
STATE_FILE = os.path.join(OUT, "state.json")
state = json.load(open(STATE_FILE)) if os.path.exists(STATE_FILE) else {}

def save_state():
    json.dump(state, open(STATE_FILE, "w"), indent=2)

REF_PNG = "public/ansemPrevieMeshy_ref.png"
with open(REF_PNG, "rb") as f:
    IMG_DATA_URI = "data:image/png;base64," + base64.b64encode(f.read()).decode()
print(f"ref image {len(IMG_DATA_URI)//1024} KB data-uri", flush=True)

def create(endpoint, payload):
    r = S.post(f"{BASE}{endpoint}", headers=H, json=payload, timeout=60)
    if r.status_code == 402:
        sys.exit("ERROR 402 insufficient credits")
    if r.status_code >= 400:
        sys.exit(f"ERROR {r.status_code} on {endpoint}: {r.text[:400]}")
    tid = r.json()["result"]
    print(f"  -> task {tid}", flush=True)
    return tid

def poll(endpoint, tid, timeout=600):
    el, d = 0, 5
    while el < timeout:
        r = S.get(f"{BASE}{endpoint}/{tid}", headers=H, timeout=60)
        r.raise_for_status()
        t = r.json()
        st, pr = t["status"], t.get("progress", 0)
        print(f"    [{('#'*int(pr/5)).ljust(20)}] {pr}% {st} ({el}s)", flush=True)
        if st == "SUCCEEDED":
            return t
        if st in ("FAILED", "CANCELED"):
            sys.exit(f"TASK {st}: {t.get('task_error',{}).get('message','?')}")
        cur = 15 if pr >= 95 else d
        time.sleep(cur); el += cur
        if pr < 95:
            d = min(d*1.5, 30)
    sys.exit(f"TIMEOUT {tid}")

def dl(url, path):
    r = S.get(url, timeout=600, stream=True); r.raise_for_status()
    with open(path, "wb") as f:
        for c in r.iter_content(8192):
            f.write(c)
    print(f"    saved {path} ({os.path.getsize(path)/1e6:.1f} MB)", flush=True)

# ---------- 1. image-to-3d (no texture, a-pose, standard) ----------
if "img3d_id" not in state:
    print("[1] image-to-3d (standard mesh, no texture, a-pose)", flush=True)
    state["img3d_id"] = create("/openapi/v1/image-to-3d", {
        "image_url": IMG_DATA_URI,
        "model_type": "standard",
        "should_texture": False,
        "should_remesh": False,
        "pose_mode": "a-pose",
        "ai_model": "latest",
        "topology": "triangle",
    }); save_state()
if not state.get("img3d_done"):
    t = poll("/openapi/v1/image-to-3d", state["img3d_id"])
    dl(t["model_urls"]["glb"], os.path.join(OUT, "1_base_mesh.glb"))
    if t.get("thumbnail_url"):
        try: dl(t["thumbnail_url"], os.path.join(OUT, "1_base_thumb.png"))
        except Exception: pass
    state["img3d_done"] = True; state["img3d_glb"] = t["model_urls"]["glb"]
    print(f"    faces: {t.get('face_count','?')}  credits: {t.get('consumed_credits','?')}", flush=True)
    save_state()

# ---------- 2. remesh -> 30k triangles ----------
if "remesh_id" not in state:
    print("[2] remesh -> 30k triangles", flush=True)
    state["remesh_id"] = create("/openapi/v1/remesh", {
        "input_task_id": state["img3d_id"],
        "target_formats": ["glb"],
        "topology": "triangle",
        "target_polycount": 30000,
    }); save_state()
if not state.get("remesh_done"):
    t = poll("/openapi/v1/remesh", state["remesh_id"])
    state["remesh_glb"] = t["model_urls"]["glb"]
    dl(state["remesh_glb"], os.path.join(OUT, "2_remesh_30k.glb"))
    state["remesh_done"] = True
    print(f"    credits: {t.get('consumed_credits','?')}", flush=True)
    save_state()

# ---------- 3. retexture (style = reference image, PBR + HD) ----------
if "retex_id" not in state:
    print("[3] retexture (image style, PBR, HD)", flush=True)
    state["retex_id"] = create("/openapi/v1/retexture", {
        "model_url": state["remesh_glb"],
        "image_style_url": IMG_DATA_URI,
        "enable_pbr": True,
        "hd_texture": True,
        "ai_model": "latest",
    }); save_state()
if not state.get("retex_done"):
    t = poll("/openapi/v1/retexture", state["retex_id"])
    state["retex_glb"] = t["model_urls"]["glb"]
    dl(state["retex_glb"], os.path.join(OUT, "3_textured.glb"))
    state["retex_done"] = True
    print(f"    credits: {t.get('consumed_credits','?')}", flush=True)
    save_state()

# ---------- 4. rigging (+ free walk / run) ----------
if "rig_id" not in state:
    print("[4] rigging (auto-rig, includes walk + run)", flush=True)
    try:
        state["rig_id"] = create("/openapi/v1/rigging", {
            "input_task_id": state["retex_id"],
            "height_meters": 1.7,
        })
    except SystemExit:
        print("    retry rig via model_url", flush=True)
        state["rig_id"] = create("/openapi/v1/rigging", {
            "model_url": state["retex_glb"],
            "height_meters": 1.7,
        })
    save_state()
if not state.get("rig_done"):
    t = poll("/openapi/v1/rigging", state["rig_id"])
    res = t["result"]
    dl(res["rigged_character_glb_url"], os.path.join(OUT, "4_rigged.glb"))
    ba = res.get("basic_animations", {})
    if ba.get("walking_glb_url"):
        dl(ba["walking_glb_url"], os.path.join(OUT, "5_walking.glb"))
    if ba.get("running_glb_url"):
        dl(ba["running_glb_url"], os.path.join(OUT, "6_running.glb"))
    state["rig_done"] = True
    state["rig_result"] = res
    print(f"    credits: {t.get('consumed_credits','?')}", flush=True)
    save_state()

print("\n=== CHARACTER PIPELINE COMPLETE ===", flush=True)
print(json.dumps({k: state[k] for k in state if k.endswith('_id') or k.endswith('_done')}, indent=2), flush=True)
bal = S.get(f"{BASE}/openapi/v1/balance", headers=H, timeout=30).json()
print(f"balance: {bal}", flush=True)
