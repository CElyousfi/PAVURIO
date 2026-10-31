"""LEGACY (v1 Tabby, replaced 31 Oct by the Gemini cat — see cat_avatars.py and clips.py SPECIES=cat).
Build the in-app cat from GPT's cat sheet (docs/art/gpt-cat/source/coat_*.png, upscaled 4x with EDSR).
Writes assets/pets/cat/: coat images on one shared canvas, gray sketch versions, collar color overlays, avatars."""
import cv2, numpy as np, json, os
from PIL import Image
SRC='docs/art/gpt-cat/source'; OUT='assets/pets/cat'; os.makedirs(OUT,exist_ok=True)
CW,CH=900,1000; CAT_H=880; PAWS=965
COATS=['tabby','ginger','tuxedo','cream']
COLLARS={'teal':(88,1.0,0.95),'leaf':(48,1.0,0.95),'sun':(22,1.1,1.1),'berry':(136,0.85,1.0)}
def place(img):
    a=img[:,:,3]; ys,xs=np.where(a>100)
    top,bot=ys.min(),ys.max(); s=CAT_H/(bot-top)
    head=a[top:top+int((bot-top)*0.45)]>100; hx=np.where(head)[1].mean()
    small=cv2.resize(img,(int(img.shape[1]*s),int(img.shape[0]*s)),interpolation=cv2.INTER_AREA)
    canvas=np.zeros((CH,CW,4),np.uint8)
    ox=int(CW/2-hx*s); oy=int(PAWS-bot*s)
    x0,y0=max(0,ox),max(0,oy); x1,y1=min(CW,ox+small.shape[1]),min(CH,oy+small.shape[0])
    canvas[y0:y1,x0:x1]=small[y0-oy:y1-oy,x0-ox:x1-ox]
    return canvas
def sketch(img):
    r=img[:,:,:3].astype(np.float32); L=0.3*r[:,:,0]+0.59*r[:,:,1]+0.11*r[:,:,2]
    g=np.clip(226+(L-190)*0.16,214,246); g=np.where(L<95,72+L*0.25,g)
    o=img.copy(); o[:,:,0]=g; o[:,:,1]=g; o[:,:,2]=np.clip(g+3,0,255); return o
def collar_mask(img):
    hsv=cv2.cvtColor(img[:,:,:3],cv2.COLOR_RGB2HSV)
    red=(((hsv[:,:,0]<=8)|(hsv[:,:,0]>=172))&(hsv[:,:,1]>130)&(hsv[:,:,2]>150)&(img[:,:,3]>100)).astype(np.uint8)
    n,lab,st,_=cv2.connectedComponentsWithStats(red,8)
    i=max(range(1,n),key=lambda j:st[j,2])  # widest red shape = one side of the collar
    cy=st[i,1]+st[i,3]/2
    # the bell splits the collar in two: take every sizeable red piece on the same band
    keep=[j for j in range(1,n) if st[j,4]>150 and abs(st[j,1]+st[j,3]/2-cy)<45 and st[j,2]>st[j,3]]
    m=np.isin(lab,keep).astype(np.float32)
    return cv2.GaussianBlur(cv2.dilate(m,np.ones((3,3),np.uint8)),(0,0),0.8)
def save(img,name,q=90):
    Image.fromarray(img).save(f'{OUT}/{name}.webp','WEBP',quality=q,method=6)
meta={'canvas':{'w':CW,'h':CH},'paws':PAWS,'catH':CAT_H}
for c in COATS:
    img=place(np.array(Image.open(f'{SRC}/coat_{c}.png').convert('RGBA')))
    save(img,f'{c}'); save(sketch(img),f'{c}_sketch')
    m=collar_mask(img)
    for name,(h,sm,vm) in COLLARS.items():
        hsv=cv2.cvtColor(img[:,:,:3],cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[:,:,0]=h; hsv[:,:,1]=np.clip(hsv[:,:,1]*sm,0,255); hsv[:,:,2]=np.clip(hsv[:,:,2]*vm,0,255)
        rgb=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB)
        ov=np.dstack([rgb,(m*img[:,:,3]).astype(np.uint8)]); save(ov,f'{c}_collar_{name}',85)
    # avatar: square around the head
    a=img[:,:,3]; ys,xs=np.where(a>100); top=ys.min(); hh=int(CAT_H*0.62)
    head=a[top:top+hh]>100; hx0,hx1=np.where(head.any(0))[0][[0,-1]]
    cx=(hx0+hx1)//2; side=max(hh,hx1-hx0)+30
    sq=Image.fromarray(img).crop((cx-side//2,top-15,cx+side//2,top-15+side)).resize((360,360),Image.LANCZOS)
    sq.save(f'{OUT}/avatar_{c}.webp','WEBP',quality=90)
json.dump(meta,open(f'{OUT}/cat.json','w'),indent=1)
print('ok', sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT))//1024,'KB')
