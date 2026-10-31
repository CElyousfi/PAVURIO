"""Gemini start frames for the cat videos: 1280x720, solid white, the cat at the same place and size as the
dog in the dog videos (head centre x≈628, paws y≈705, ≈565 px tall), with the prop for each clip."""
import numpy as np
from PIL import Image
OUT='docs/art/gpt-cat/start-frames'
cat=Image.open('docs/art/gpt-cat/source/coat_tabby.png').convert('RGBA')
a=np.array(cat)[:,:,3]; ys,xs=np.where(a>100); top,bot=ys.min(),ys.max()
s=565/(bot-top); cat=cat.resize((int(cat.width*s),int(cat.height*s)),Image.LANCZOS)
a=np.array(cat)[:,:,3]; ys,xs=np.where(a>100); top,bot=ys.min(),ys.max()
hx=np.where(a[top:top+int((bot-top)*0.45)]>100)[1].mean()
ox,oy=int(628-hx),int(705-bot)
def prop(path,width,cx,bottom):
    p=Image.open(path).convert('RGBA'); pa=np.array(p)[:,:,3]; py,px=np.where(pa>20)
    p=p.crop((px.min(),py.min(),px.max()+1,py.max()+1)); p=p.resize((width,int(p.height*width/p.width)),Image.LANCZOS)
    return p,(int(cx-width/2),int(bottom-p.height))
PROPS={'idle':None,'eat':('assets/art/care/meal_full.png',190),'drink':('assets/art/care/water_full.png',200),
       'play':('assets/art/care/play.png',95),'litter':('assets/art/care/litter.png',260)}
for name,pr in PROPS.items():
    f=Image.new('RGBA',(1280,720),(255,255,255,255))
    f.alpha_composite(cat,(ox,oy))
    if pr:
        p,pos=prop(pr[0],pr[1],cx=ox+int(hx)-300 if name!='litter' else ox+int(hx)-340,bottom=712)
        f.alpha_composite(p,pos)
    f.convert('RGB').save(f'{OUT}/{name}.png')
print('ok')
