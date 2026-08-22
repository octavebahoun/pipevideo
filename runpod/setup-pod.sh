#!/bin/bash
# ---------------------------------------------------------------------------
# Setup d'un pod RunPod pour la génération vidéo : ComfyUI + Wan 2.2 I2V
# + LoRA Lightning 4-steps + Flux schnell.
#
# Mesuré à ~2,5 min sur un datacenter au réseau sain (EU-RO-1).
# Idempotent : relançable sans tout retélécharger.
# ---------------------------------------------------------------------------
export PIP_BREAK_SYSTEM_PACKAGES=1   # l'image RunPod est en environnement Python "managed" (PEP 668)
export HF_XET_HIGH_PERFORMANCE=1     # transferts HuggingFace rapides (~440 Mo/s constatés)

LOG() { echo "### $1 $(date +%s)"; }

LOG "GPU"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

LOG "CLONE"
cd /workspace
[ -d ComfyUI ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git

LOG "PIP"
pip install --break-system-packages -q -r /workspace/ComfyUI/requirements.txt 2>&1 | tail -2
# imageio-ffmpeg embarque un binaire ffmpeg : évite apt-get, peu fiable sur ces images.
pip install --break-system-packages -q huggingface_hub imageio-ffmpeg 2>&1 | tail -2

M=/workspace/ComfyUI/models
mkdir -p $M/diffusion_models $M/text_encoders $M/vae $M/loras $M/checkpoints /workspace/ComfyUI/input

# --- Modèles Wan 2.2 I2V 14B (fp8_scaled : 14 Go chacun au lieu de 28) --------
LOG "DL_WAN"
WR=Comfy-Org/Wan_2.2_ComfyUI_Repackaged
for N in high low; do
  [ -f $M/diffusion_models/wan22_i2v_${N}_fp8.safetensors ] && continue
  hf download $WR "split_files/diffusion_models/wan2.2_i2v_${N}_noise_14B_fp8_scaled.safetensors" --local-dir /workspace/hf > /dev/null 2>&1
  mv /workspace/hf/split_files/diffusion_models/wan2.2_i2v_${N}_noise_14B_fp8_scaled.safetensors $M/diffusion_models/wan22_i2v_${N}_fp8.safetensors
done

[ -f $M/text_encoders/umt5_xxl_fp8.safetensors ] || {
  hf download $WR "split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" --local-dir /workspace/hf > /dev/null 2>&1
  mv /workspace/hf/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors $M/text_encoders/umt5_xxl_fp8.safetensors
}

[ -f $M/vae/wan_2.1_vae.safetensors ] || {
  hf download $WR "split_files/vae/wan_2.1_vae.safetensors" --local-dir /workspace/hf > /dev/null 2>&1
  mv /workspace/hf/split_files/vae/wan_2.1_vae.safetensors $M/vae/wan_2.1_vae.safetensors
}

# --- LoRA Lightning : 4 steps au lieu de 20 ----------------------------------
# SANS ce LoRA, un clip de 5 s prend ~50 min et coûte PLUS cher qu'un endpoint
# public. Avec, il tombe à 38 s sur RTX 5090. C'est la pièce maîtresse.
LOG "DL_LORA"
LR=lightx2v/Wan2.2-Lightning
LP=Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1
for N in high low; do
  [ -f $M/loras/lightning_i2v_${N}.safetensors ] && continue
  hf download $LR "$LP/${N}_noise_model.safetensors" --local-dir /workspace/lora > /dev/null 2>&1
  mv /workspace/lora/$LP/${N}_noise_model.safetensors $M/loras/lightning_i2v_${N}.safetensors
done

# --- Flux schnell : les images de départ de l'image-to-video ----------------
# Générées ici plutôt que via Cloudflare Workers AI : ~2 s par image au lieu de
# ~8 s, sans appel réseau et surtout SANS rate limit — un 429 Cloudflare tuait
# le run en pleine génération, GPU allumé. Coûte ~17 Go de téléchargement au
# setup (~1 min), soit ~$0.02, largement compensé.
LOG "DL_FLUX"
FR=Comfy-Org/flux1-schnell
[ -f $M/checkpoints/flux1_schnell_fp8.safetensors ] || {
  hf download $FR "flux1-schnell-fp8.safetensors" --local-dir /workspace/flux > /dev/null 2>&1
  mv /workspace/flux/flux1-schnell-fp8.safetensors $M/checkpoints/flux1_schnell_fp8.safetensors
}

# --- Conversion WEBP animé -> MP4 -------------------------------------------
# ComfyUI sort du WEBP animé, que ffmpeg ne sait pas décoder en entrée.
# PIL extrait les frames, ffmpeg les réencode en H.264.
LOG "SCRIPT_MP4"
cat > /workspace/to_mp4.py << 'PYEOF'
import sys, os, subprocess, shutil
from PIL import Image
import imageio_ffmpeg

OUT = '/workspace/ComfyUI/output'
name = sys.argv[1]
src = os.path.join(OUT, name)
dst = os.path.join(OUT, os.path.splitext(name)[0] + '.mp4')
tmp = '/tmp/frames_' + os.path.splitext(name)[0]

os.makedirs(tmp, exist_ok=True)
im = Image.open(src)
n = 0
try:
    while True:
        im.seek(n)
        im.convert('RGB').save(f'{tmp}/{n:04d}.png')
        n += 1
except EOFError:
    pass

subprocess.run([
    imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error',
    '-framerate', '16', '-i', f'{tmp}/%04d.png',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    '-movflags', '+faststart', dst,
], check=True)

shutil.rmtree(tmp, ignore_errors=True)
print(f'MP4_OK {n} frames -> {os.path.basename(dst)}')
PYEOF

LOG "FICHIERS"
du -sh $M/diffusion_models/*.safetensors $M/loras/*.safetensors $M/checkpoints/*.safetensors 2>/dev/null

# --- Démarrage de ComfyUI ---------------------------------------------------
LOG "START_COMFY"
# `setsid` + fermeture de stdin/stdout/stderr : sans ça, ComfyUI hérite du tuyau
# de sortie du script et le maintient ouvert — le SSH appelant ne rend alors
# JAMAIS la main, même une fois le setup terminé.
if ! curl -s -m 3 http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
  cd /workspace/ComfyUI
  setsid nohup python main.py --listen 0.0.0.0 --port 8188 \
    > /workspace/comfy.log 2>&1 < /dev/null &
  disown
  for i in $(seq 1 60); do
    sleep 3
    curl -s -m 3 http://127.0.0.1:8188/system_stats > /dev/null 2>&1 && break
  done
fi

curl -s -m 10 http://127.0.0.1:8188/system_stats | head -c 120
echo
LOG "SETUP_DONE"
