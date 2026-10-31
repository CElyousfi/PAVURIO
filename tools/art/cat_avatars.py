"""Cat v2 (the Gemini cat, owner-approved 31 Oct): reference masters + in-app avatars.
Usage (repo root): python3 tools/art/cat_avatars.py
Writes docs/art/gpt-cat/source/v2/master_<coat>.png (transparent, for ChatGPT as the reference)
and assets/pets/cat/avatar_<coat>.webp, cut from a frame of docs/art/gpt-cat/videos/idle.mp4
with the same key and recolor as the clips (tools/art/clips.py)."""
import numpy as np, subprocess, os, sys
from PIL import Image
src=open('tools/art/clips.py').read()
os.environ['SPECIES']='cat'; sys.argv=['x','/tmp/cat_avatars']
exec(src[:src.index('manifest={}')])
FLOOR=653
subprocess.run(['ffmpeg','-v','error','-y','-ss','0.5','-i','docs/art/gpt-cat/videos/idle.mp4','-frames:v','1','/tmp/cat_avatar_src.png'],check=True)
f=np.array(Image.open('/tmp/cat_avatar_src.png').convert('RGB')); a=key_cat(f)
os.makedirs('docs/art/gpt-cat/source/v2',exist_ok=True)
ys,xs=np.where(a>10); y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max()
for pal in ['tabby','ginger','tuxedo','cream']:
    im=Image.fromarray(np.dstack([cat_recolor(f,pal),a])).crop((x0-20,y0-20,x1+20,y1+20))
    im.save(f'docs/art/gpt-cat/source/v2/master_{pal}.png')
    al=np.array(im)[:,:,3]; ys2,_=np.where(al>100); top=ys2.min(); H=ys2.max()-top
    hh=int(H*0.56); cx=int(np.median(np.where(al[top+int(hh*0.5)]>100)[0])); side=int(hh*1.32)
    im.crop((cx-side//2,top-14,cx-side//2+side,top-14+side)).resize((360,360),Image.LANCZOS).save(f'assets/pets/cat/avatar_{pal}.webp','WEBP',quality=90)
print('ok')
