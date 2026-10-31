"""Cat v2 scene cards from ChatGPT's individual redraws (docs/art/cat-v2/scenes/*.png).
Scenes are shown by <Scene> (rounded white card, resizeMode cover): the page around each card is
made white (some came on black) and the image is cropped to the card.
duo.png is a transparent cut-out (onboarding reminders hero): only trimmed.
Writes assets/art/scenes/<name>.webp, longest side 1024.  Usage: python3 tools/art/cat_v2_scenes.py [name ...]"""
import numpy as np, sys, os, cv2
from PIL import Image
SRC='docs/art/cat-v2/scenes'; OUT='assets/art/scenes'
names=sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
for n in names:
    im=Image.open(f'{SRC}/{n}.png').convert('RGBA'); a=np.array(im)
    if (a[:,:,3]<10).mean()>0.05:
        ys,xs=np.where(a[:,:,3]>8); box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1); out=im.crop(box)
    else:
        rgb=a[:,:,:3].astype(np.int16); page=np.median(np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]]),0)
        # the page around the card becomes white, like the card it is shown in (black pages too)
        near=(np.abs(rgb-page).max(2)<=12).astype(np.uint8)
        k,lab=cv2.connectedComponents(near,connectivity=4)
        border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        pg=cv2.dilate(np.isin(lab,list(border)).astype(np.uint8),np.ones((3,3),np.uint8))>0
        rgb=rgb.copy(); rgb[pg]=255
        art=~pg
        rows=np.where(art.mean(1)>0.3)[0]; cols=np.where(art.mean(0)>0.3)[0]
        y0,y1,x0,x1=rows.min(),rows.max()+1,cols.min(),cols.max()+1
        out=Image.fromarray(rgb.astype(np.uint8)).crop((x0,y0,x1,y1))
    s=1024/max(out.size)
    if s<1: out=out.resize((round(out.width*s),round(out.height*s)),Image.LANCZOS)
    out.save(f'{OUT}/{n}.webp','WEBP',quality=88,method=6); print(n,out.size)
