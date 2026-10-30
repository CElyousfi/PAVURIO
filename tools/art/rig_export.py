import cv2, numpy as np, json, os
from PIL import Image
R='/tmp/pavurio-rig'; OUT='assets/pets/dog'; os.makedirs(OUT,exist_ok=True)
meta=np.load('/tmp/rigmeta.npy'); cLx,cLy,rLx,rLy,cRx,cRy,rRx,rRy,W,H=[int(v) for v in meta]
TW=900; f=TW/W; TH=round(H*f)
def load(k): return np.array(Image.open(f'{R}/full_{k}.png'))
def smooth(x,a,b): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def recolor(img, pal):
    if pal=='honey': return img
    rgb=img[:,:,:3]; hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(np.float32)
    h,s,v=hsv[:,:,0],hsv[:,:,1]/255,hsv[:,:,2]/255
    warm=((h>=8)&(h<=32)).astype(np.float32)
    w=smooth(s,0.12,0.6)
    if pal=='cocoa': nh,ns,nv=np.full_like(h,10),s*0.95,v*(1-0.45*w)-0.03*(1-w)
    if pal=='snow':  nh,ns,nv=np.full_like(h,18),s*0.30,v*(1-0.10*w)
    if pal=='midnight': nh,ns,nv=np.full_like(h,112),s*0.22,v*(1-0.64*w)
    out=np.stack([np.where(warm>0,nh,h),np.where(warm>0,np.clip(ns,0,1)*255,s*255),np.where(warm>0,np.clip(nv,0,1)*255,v*255)],-1).astype(np.uint8)
    o=img.copy(); o[:,:,:3]=cv2.cvtColor(out,cv2.COLOR_HSV2RGB); return o
def sketch(img):
    rgb=img[:,:,:3].astype(np.float32); L=0.3*rgb[:,:,0]+0.59*rgb[:,:,1]+0.11*rgb[:,:,2]
    g=np.clip(226+(L-190)*0.16,214,246)
    dark=L<115
    g=np.where(dark, 72+L*0.25, g)
    o=img.copy(); o[:,:,0]=g; o[:,:,1]=g; o[:,:,2]=np.clip(g+3,0,255); return o
def bandana(img,target):
    if target is None: return img
    hsv=cv2.cvtColor(img[:,:,:3],cv2.COLOR_RGB2HSV).astype(np.float32)
    col=hsv[:,:,1]>60
    th,sm,vm=target
    hsv[:,:,0]=np.where(col,th,hsv[:,:,0]); hsv[:,:,1]=np.where(col,np.clip(hsv[:,:,1]*sm,0,255),hsv[:,:,1]); hsv[:,:,2]=np.where(col,np.clip(hsv[:,:,2]*vm,0,255),hsv[:,:,2])
    o=img.copy(); o[:,:,:3]=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); return o
manifest={'canvas':{'w':TW,'h':TH},'layers':{},'pivots':{}}
def save(img,name,key):
    a=img[:,:,3]; ys,xs=np.where(a>3); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    crop=Image.fromarray(img[y0:y1,x0:x1])
    sx,sy=round(x0*f),round(y0*f); sw,sh=max(1,round((x1-x0)*f)),max(1,round((y1-y0)*f))
    crop.resize((sw,sh),Image.LANCZOS).save(f'{OUT}/{name}.webp','WEBP',quality=88,method=6)
    manifest['layers'][key]={'x':sx,'y':sy,'w':sw,'h':sh}
coat=['tail','body','earL','earR','head']
layers={k:load(k) for k in coat+['bandana','eyeL','eyeR']}
for pal in ['honey','cocoa','snow','midnight']:
    for k in coat: save(recolor(layers[k],pal),f'{k}_{pal}',k)
for k in coat: save(sketch(layers[k]),f'{k}_sketch',k)
for name,t in {'teal':None,'coral':(176,0.82,1.12),'leaf':(48,1.0,0.95),'sun':(22,1.15,1.15),'berry':(136,0.8,1.0)}.items():
    save(bandana(layers['bandana'],t),f'bandana_{name}','bandana')
save(layers['eyeL'],'eyeL','eyeL'); save(layers['eyeR'],'eyeR','eyeR')
P={'tail':(275,1000),'neck':(712,730),'earL':(470,240),'earR':(905,185),'body':(650,1200),'eyeL':(cLx,cLy),'eyeR':(cRx,cRy),'mouth':(722,640)}
manifest['pivots']={k:[round(x*f,1),round(y*f,1)] for k,(x,y) in P.items()}
manifest['eyes']={'L':{'cx':round(cLx*f,1),'cy':round(cLy*f,1),'rx':round(rLx*f,1),'ry':round(rLy*f,1)},'R':{'cx':round(cRx*f,1),'cy':round(cRy*f,1),'rx':round(rRx*f,1),'ry':round(rRy*f,1)}}
manifest['art']={'top':round(15*f),'bottom':round(1205*f),'paws':round(1200*f)}
json.dump(manifest,open(f'{OUT}/manifest.json','w'),indent=1)
# avatars + icon
for pal in ['honey','cocoa','snow','midnight']:
    comp=Image.new('RGBA',(W,H),(0,0,0,0))
    for k in ['tail','body']: comp.alpha_composite(Image.fromarray(recolor(layers[k],pal)))
    comp.alpha_composite(Image.fromarray(layers['bandana']))
    for k in ['head','earL','earR']: comp.alpha_composite(Image.fromarray(recolor(layers[k],pal)))
    for k in ['eyeL','eyeR']: comp.alpha_composite(Image.fromarray(layers[k]))
    sq=comp.crop((130,0,1265,1135)); sq.resize((360,360),Image.LANCZOS).save(f'{OUT}/avatar_{pal}.webp','WEBP',quality=90)
    if pal=='honey':
        comp.save('/tmp/pavurio-rig/composite_honey.png')
        icon=Image.new('RGBA',(1024,1024),(255,246,230,255))
        from PIL import ImageDraw
        d=ImageDraw.Draw(icon); d.ellipse((132,180,892,940),fill=(34,193,195,255))
        head=comp.crop((130,0,1265,1000)); head.thumbnail((900,900),Image.LANCZOS)
        icon.alpha_composite(head,((1024-head.width)//2,70))
        icon.convert('RGB').save('assets/icon.png')
        fg=Image.new('RGBA',(1024,1024),(0,0,0,0)); h2=comp.crop((130,0,1265,1000)); h2.thumbnail((620,620),Image.LANCZOS)
        fg.alpha_composite(h2,((1024-h2.width)//2,(1024-h2.height)//2)); fg.save('assets/android-icon-foreground.png')
        sp=Image.new('RGBA',(1024,1024),(0,0,0,0)); h3=comp.copy(); h3.thumbnail((900,900),Image.LANCZOS); sp.alpha_composite(h3,((1024-h3.width)//2,(1024-h3.height)//2)); sp.save('assets/splash-icon.png')
print(json.dumps(manifest['pivots'])); print(sum(os.path.getsize(f'{OUT}/{x}') for x in os.listdir(OUT))//1024,'KB')
