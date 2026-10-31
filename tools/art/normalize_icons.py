"""(Reference) Trim ChatGPT's care/UI icons to their content and re-centre them on a square canvas with a small margin,
so they read at icon size (wide flat bowls otherwise shrink to a sliver)."""
import glob, numpy as np
from PIL import Image
MARGIN=0.06
for f in sorted(glob.glob('assets/art/care/*.png'))+['assets/art/ui/welcome_badge.png']:
    im=Image.open(f).convert('RGBA'); a=np.array(im)[:,:,3]; ys,xs=np.where(a>8)
    c=im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    side=int(max(c.size)/(1-2*MARGIN)); S=im.width
    canvas=Image.new('RGBA',(side,side),(0,0,0,0)); canvas.alpha_composite(c,((side-c.width)//2,(side-c.height)//2))
    canvas.resize((S,S),Image.LANCZOS).save(f,optimize=True)
    print(f, c.size)
