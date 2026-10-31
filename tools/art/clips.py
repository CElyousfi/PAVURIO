"""Turn generated pet videos into app clips.
Usage (from repo root): python3 tools/art/clips.py assets/pets/dog/clips
                        SPECIES=cat python3 tools/art/clips.py assets/pets/cat/clips
Also regenerates src/animation/{dog,cat}Clips.ts."""
import cv2, numpy as np, json, os, sys, math, subprocess
from PIL import Image
OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
FPS=12
# Source videos and the time ranges (seconds) to keep. Celebrate skips 3.25–7.45 s where the
# generated video morphs the ears into bunny ears.
V='docs/art/gpt-dog/videos'
CLIPS={
 'idle':(f'{V}/celebrate.mp4',[(8.7,9.95)]),
 'celebrate':(f'{V}/celebrate.mp4',[(1.2,3.25),(7.45,8.75)]),
 'eat':(f'{V}/eat.mp4',[(1.3,8.6)]),
 'drink':(f'{V}/drink.mp4',[(1.3,8.3)]),
 'walk':(f'{V}/walk.mp4',[(0.3,5.2)]),
 'play':(f'{V}/play.mp4',[(1.0,9.0)]),
 'groom':(f'{V}/groom.mp4',[(1.5,8.6)]),
 # batch 2 (31 Oct): wave hello at app open, night-time doze (bubble breathes in/out), idle variety
 'hello':(f'{V}/hello.mp4',[(1.4,8.3)]),
 'sleep':(f'{V}/sleep.mp4',[(0.0,1.4)]),  # before the snot bubble (its translucent inside keys out as a hole)
 'idle2':(f'{V}/idle2.mp4',[(0.0,2.2)]),
}
LOOPS={'idle','sleep'}
SPECIES=os.environ.get('SPECIES','dog')
if SPECIES=='cat':
    V='docs/art/gpt-cat/videos'
    # Gemini cat batch 1 (31 Oct). Each video frames the cat at its own size, so every clip carries
    # its own sitting reference (first frame) instead of one shared anchor.
    CLIPS={
     'idle':(f'{V}/idle.mp4',[(3.4,6.0)]),       # tail sway, eyes open (3.0 s has a flattened-ear frame)
     'celebrate':(f'{V}/celebrate.mp4',[(0.25,9.6)]),
     'eat':(f'{V}/eat.mp4',[(0.0,9.9)]),
    }
def frames(path,segs):
    out=[]
    for a,b in segs:
        tmp='/tmp/clipfr'; os.system(f'rm -rf {tmp}; mkdir -p {tmp}')
        subprocess.run(['ffmpeg','-v','error','-ss',str(a),'-to',str(b),'-i',path,'-vf',f'fps={FPS}',f'{tmp}/%04d.png'],check=True)
        out+=[np.array(Image.open(f'{tmp}/{f}').convert('RGB')) for f in sorted(os.listdir(tmp))]
    return out
def key(rgb):
    r=rgb.astype(int); mx=r.max(2); mn=r.min(2)
    bgc=((mx-mn)<20)&(mn>175)
    n,lab=cv2.connectedComponents(bgc.astype(np.uint8),connectivity=4)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    fg=(~bg).astype(np.uint8)
    # drop speckles, keep big blobs (dog + prop)
    n,lab,st,_=cv2.connectedComponentsWithStats(fg,8)
    keep=np.zeros_like(fg)
    sat=(mx-mn)
    for i in range(1,n):
        if st[i,4]>1500: keep[lab==i]=1
        elif st[i,4]>25:
            m=lab==i
            if sat[m].mean()>40: keep[m]=1
    keep=cv2.morphologyEx(keep,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    # thin gray ground line / shadow
    gray=((mx-mn)<24)&(mx<236)&(mx>70)
    line=cv2.morphologyEx(gray.astype(np.uint8),cv2.MORPH_OPEN,np.ones((1,45),np.uint8))
    if SPECIES=='cat':
        # the cat's fur is gray too: only thin runs count as the ground line, never thick gray areas
        thick=cv2.morphologyEx(gray.astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
        line[cv2.dilate(thick,np.ones((7,7),np.uint8))>0]=0
    line=cv2.dilate(line,np.ones((5,3),np.uint8))
    keep[line>0]=0
    # enclosed checkerboard patches painted inside the character
    n2,lab2,st2,_=cv2.connectedComponentsWithStats(bgc.astype(np.uint8),connectivity=4)
    V=mx.astype(np.float32)
    for i in range(1,n2):
        if i in border or st2[i,4]<120: continue
        m=lab2==i
        if V[m].std()>2.5 and V[m].mean()<244: keep[m]=0
    keep=cv2.morphologyEx(keep,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    a=cv2.GaussianBlur(keep.astype(np.float32),(0,0),0.8)
    a=np.clip((a-0.25)/0.6,0,1)
    return (a*255).astype(np.uint8)
def drop_checker(fg,bgc,L):
    """Remove enclosed light regions that are real checkerboard (both tones, in solid blocks)."""
    n2,lab2,st2,_=cv2.connectedComponentsWithStats(bgc.astype(np.uint8)&fg,connectivity=4)
    for i in range(1,n2):
        if st2[i,4]<150: continue
        m=lab2==i; v=L[m]
        if not (((v>226)&(v<243)).mean()>0.2 and (v>=246).mean()>0.2): continue
        x,y,w,h,_=st2[i]; sub=m[y:y+h,x:x+w]; Ls=L[y:y+h,x:x+w]
        dark=cv2.morphologyEx((sub&(Ls>226)&(Ls<243)).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
        if dark.sum()>0.15*sub.sum(): fg[m]=0
FLOOR=None  # ground-line row of the current video (set per clip)
def key_cat(rgb):
    """The cat has white fur on a white/light-gray checkerboard, so color alone can't separate them.
    Its drawn outline does: thicken the outline to close small gaps, flood the background in from the
    border, then give back the thin band of background the thickening claimed."""
    r=rgb.astype(int); mx=r.max(2); mn=r.min(2); L=(0.3*r[:,:,0]+0.59*r[:,:,1]+0.11*r[:,:,2])
    bgc=((mx-mn)<20)&(mn>222)
    bgl=((mx-mn)<22)&(mn>210)  # looser: compression noise around fast-moving edges
    K=3
    walls=cv2.dilate((~bgc).astype(np.uint8),np.ones((2*K+1,2*K+1),np.uint8))
    n,lab=cv2.connectedComponents((1-walls).astype(np.uint8),connectivity=4)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    reach=np.isin(lab,list(border)).astype(np.uint8)
    # grow the reached background back over light pixels only (stops at the outline)
    for _ in range(K+2):
        reach=(cv2.dilate(reach,np.ones((3,3),np.uint8))&bgl.astype(np.uint8))|reach
    fg=(1-reach).astype(np.uint8)
    drop_checker(fg,bgc,L)
    # soft floor shadow: light gray patches lying on the ground line
    sh=(((mx-mn)<16)&(L>=158)&(L<=233)).astype(np.uint8)
    sh=cv2.morphologyEx(sh,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    if FLOOR is not None:
        n3,lab3,st3,_=cv2.connectedComponentsWithStats(sh,8)
        for i in range(1,n3):
            x,y,w,h,ar=st3[i]
            if ar>250 and y+h>=FLOOR-6 and y>=FLOOR-40 and w>2*h: fg[lab3==i]=0
    # drop the ground line and soft floor shadow (thin gray runs, never thick fur)
    gray=((mx-mn)<24)&(mx<236)&(mx>70)
    line=cv2.morphologyEx(gray.astype(np.uint8),cv2.MORPH_OPEN,np.ones((1,45),np.uint8))
    thick=cv2.morphologyEx(gray.astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
    line[cv2.dilate(thick,np.ones((5,5),np.uint8))>0]=0
    fg[cv2.dilate(line,np.ones((5,3),np.uint8))>0]=0
    if FLOOR is not None:
        # nothing of the cat lies below the drawn floor line: drop the line and the shadow under it
        # (only light gray: a tail can hang below the line, its fur is darker)
        low=((mx-mn)<24)&(L>168)&(L<238)
        fur=cv2.morphologyEx((gray&(L<190)).astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
        band=gray&~cv2.dilate(fur,np.ones((3,3),np.uint8)).astype(bool)
        fg[FLOOR-2:FLOOR+5][band[FLOOR-2:FLOOR+5]]=0
        fg[FLOOR+3:][low[FLOOR+3:]]=0
    if FLOOR is not None:
        # checkerboard dimmed by the floor shadow between the legs: two tones in solid blocks
        z0=max(0,FLOOR-70); lowsat=((mx-mn)<18)&(mn>180)
        cand=(lowsat[z0:FLOOR+3]&(fg[z0:FLOOR+3]>0)).astype(np.uint8)
        n4,lab4,st4,_=cv2.connectedComponentsWithStats(cand,connectivity=4)
        Lz=L[z0:FLOOR+3]
        for i in range(1,n4):
            if st4[i,4]<300: continue
            x,y,w,h,_=st4[i]; sub=lab4[y:y+h,x:x+w]==i; Ls=Lz[y:y+h,x:x+w]
            med=np.median(Ls[sub])
            dk=cv2.morphologyEx((sub&(Ls<med-7)).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8)).sum()
            lt=cv2.morphologyEx((sub&(Ls>med+3)).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8)).sum()
            if dk>0.15*sub.sum() and lt>0.15*sub.sum():
                reg=np.zeros_like(fg); reg[z0+y:z0+y+h,x:x+w]=sub; fg[reg>0]=0
    drop_checker(fg,bgc,L)  # again: background trapped between legs and the (now removed) floor line
    n,lab,st,_=cv2.connectedComponentsWithStats(fg,8)
    keep=np.zeros_like(fg)
    for i in range(1,n):
        if st[i,4]>1500: keep[lab==i]=1
    keep=cv2.morphologyEx(keep,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    a=cv2.GaussianBlur(keep.astype(np.float32),(0,0),0.8)
    a=np.clip((a-0.25)/0.6,0,1)
    return (a*255).astype(np.uint8)
def smooth(x,a,b): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def recolor(rgb,pal):
    if pal=='honey': return rgb
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(np.float32); h,s,v=hsv[:,:,0],hsv[:,:,1]/255,hsv[:,:,2]/255
    warm=(h>=8)&(h<=32); w=smooth(s,0.12,0.6)
    if pal=='cocoa': nh,ns,nv=np.full_like(h,10),s*0.95,v*(1-0.45*w)-0.03*(1-w)
    if pal=='snow': nh,ns,nv=np.full_like(h,18),s*0.30,v*(1-0.10*w)
    if pal=='midnight': nh,ns,nv=np.full_like(h,112),s*0.22,v*(1-0.64*w)
    o=np.stack([np.where(warm,nh,h),np.where(warm,np.clip(ns,0,1)*255,s*255),np.where(warm,np.clip(nv,0,1)*255,v*255)],-1).astype(np.uint8)
    return cv2.cvtColor(o,cv2.COLOR_HSV2RGB)
CAT_COATS={'ginger':('#F6A55E','#DD7A2C'),'tuxedo':('#4A4A53','#2A2A30'),'cream':('#ECD7BE','#C9AA8A')}
def hexrgb(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],np.float32)
def cat_recolor(rgb,pal):
    if pal=='tabby': return rgb
    r=rgb.astype(np.float32); mx=r.max(2); mn=r.min(2)
    L=0.3*r[:,:,0]+0.59*r[:,:,1]+0.11*r[:,:,2]
    coat,patch=(hexrgb(c) for c in CAT_COATS[pal])
    # gray fur: coat ~147, stripes ~100; outlines (<70) and white fur (>205) stay as drawn
    t=((L-100)/47)[:,:,None]
    o=patch+(coat-patch)*t
    w=(smooth(L,58,78)*(1-smooth(L,190,215))*(1-smooth(mx-mn,18,34)))[:,:,None]
    return np.clip(r*(1-w)+o*w,0,255).astype(np.uint8)
def collar_overlay(rgb,alpha,t):
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(np.float32)
    red=((hsv[:,:,0]<=9)|(hsv[:,:,0]>=170))&(hsv[:,:,1]>135)&(hsv[:,:,2]>90)
    th,sm,vm=t
    hsv[:,:,0]=th; hsv[:,:,1]=np.clip(hsv[:,:,1]*sm,0,255); hsv[:,:,2]=np.clip(hsv[:,:,2]*vm*1.12,0,255)
    o=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB)
    m=cv2.GaussianBlur(red.astype(np.float32),(0,0),0.7)
    return o, (np.minimum(m,alpha/255)*255).astype(np.uint8)
CAT_COLLARS={'teal':(88,1.0,0.95),'leaf':(48,1.0,0.95),'sun':(22,1.1,1.1),'berry':(136,0.85,1.0)}
def sketch(rgb):
    r=rgb.astype(np.float32); L=0.3*r[:,:,0]+0.59*r[:,:,1]+0.11*r[:,:,2]
    g=np.clip(226+(L-190)*0.16,214,246); g=np.where(L<115,72+L*0.25,g)
    return np.stack([g,g,np.clip(g+3,0,255)],-1).astype(np.uint8)
BAND={'coral':(176,0.82,1.12),'leaf':(48,1.0,0.95),'sun':(22,1.15,1.15),'berry':(136,0.8,1.0)}
def band_overlay(rgb,alpha,t):
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(np.float32)
    teal=(hsv[:,:,0]>78)&(hsv[:,:,0]<97)&(hsv[:,:,1]>115)&(hsv[:,:,2]>70)
    th,sm,vm=t
    hsv[:,:,0]=th; hsv[:,:,1]=np.clip(hsv[:,:,1]*sm,0,255); hsv[:,:,2]=np.clip(hsv[:,:,2]*vm,0,255)
    o=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB)
    m=cv2.GaussianBlur(teal.astype(np.float32),(0,0),0.7)
    return o, (np.minimum(m,alpha/255)*255).astype(np.uint8)
manifest={}
# ONLY=name1,name2 re-renders just those clips and keeps the others from the existing manifest
ONLY=set(filter(None,os.environ.get('ONLY','').split(',')))
if ONLY:
    old=json.load(open(f'{OUT}/clips.json'))
for name,(path,segs) in CLIPS.items():
    if ONLY and name not in ONLY:
        manifest[name]=old[name]; continue
    fr=frames(path,segs)
    if SPECIES=='cat':
        g0=fr[0].astype(int); gl=((g0.max(2)-g0.min(2))<24)&(g0.max(2)<200)&(g0.max(2)>70)
        thin=cv2.morphologyEx(gl.astype(np.uint8),cv2.MORPH_OPEN,np.ones((1,45),np.uint8))
        thin[cv2.dilate(cv2.morphologyEx(gl.astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8)),np.ones((5,5),np.uint8))>0]=0
        rowsum=thin.sum(1)
        FLOOR=int(rowsum.argmax()) if rowsum.max()>60 else None  # the longest thin gray line
        print(name,'floor',FLOOR,flush=True)
    al=[(key_cat if SPECIES=='cat' else key)(f) for f in fr]
    U=np.zeros_like(al[0],bool)
    for a in al: U|=a>10
    ys,xs=np.where(U); Hh,Ww=U.shape; x0,x1,y0,y1=max(0,xs.min()-6),min(Ww,xs.max()+7),max(0,ys.min()-6),min(Hh,ys.max()+7)
    fw,fh=x1-x0,y1-y0
    # sitting reference = first frame: paws baseline, height, centre of the dog (ignore props by using top 85% width profile)
    a0=al[0][y0:y1,x0:x1]>10; r0,c0=np.where(a0)
    ref={'bottom':int(r0.max()),'top':int(r0.min())}
    # dog centre: column centroid of rows in upper half (head), robust to bowls
    upper=a0[ref['top']:ref['top']+int((ref['bottom']-ref['top'])*0.45)]
    cc=np.where(upper)[1]; ref['cx']=float(cc.mean())
    med=np.median(np.stack(fr[::3]),0).astype(np.int16)
    medA=np.median(np.stack(al[::3]),0)>128
    # props (bowls): strongly saturated orange near the floor in the first frame (+ kibble above)
    m0=al[0]>10; hsv0=cv2.cvtColor(fr[0],cv2.COLOR_RGB2HSV)
    rows=np.where(m0.any(1))[0]; floor_from=int(rows.min()+0.6*(rows.max()-rows.min()))
    core=(hsv0[:,:,0]>=6)&(hsv0[:,:,0]<=17)&(hsv0[:,:,1]>140)&(hsv0[:,:,2]>175)&m0
    core[:floor_from]=False
    core=cv2.morphologyEx(core.astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    n1,lab1,st1,_=cv2.connectedComponentsWithStats(core,8)
    propbox=np.zeros(m0.shape,bool)
    cands=[i for i in range(1,n1) if st1[i,4]>1500 and st1[i,2]>1.8*st1[i,3] and st1[i,4]>0.5*st1[i,2]*st1[i,3]]
    if cands:
        i=max(cands,key=lambda j:st1[j,4]); x,y,w,h,ar=st1[i]
        propbox[max(0,y-80):y+h+10, max(0,x-10):x+w+10]=True
    if name!='eat': propbox[:]=False
    print(name,'props',int(propbox.sum()),flush=True)
    def is_prop(frame):
        d=np.abs(frame.astype(np.int16)-med).sum(2)
        return propbox & medA & (d<40)
    PROPS=[is_prop(f) for f in fr]
    n=len(fr); PER=12; COLS=4; ROWS=3
    sc=min(1.0, 2000/(COLS*fw), 1500/(ROWS*fh))
    tw,th=int(fw*sc),int(fh*sc)
    ref={k:(v*sc) for k,v in ref.items()}
    chunks=math.ceil(n/PER); sizes={}
    def sheet(fn, tag, alpha_fn=None):
        for ci in range(chunks):
            idx=list(range(ci*PER,min(n,(ci+1)*PER)))
            rws=math.ceil(len(idx)/COLS)
            S=np.zeros((rws*th,COLS*tw,4),np.uint8)
            for j,i in enumerate(idx):
                f,a=fr[i],al[i]; P=PROPS[i][y0:y1,x0:x1]
                orig=f[y0:y1,x0:x1]
                rgb=np.where(P[:,:,None],orig,fn(orig)); A=a[y0:y1,x0:x1]
                if alpha_fn:
                    rgb,A=alpha_fn(orig,A); A=np.where(P,0,A).astype(np.uint8)
                rgba=cv2.resize(np.dstack([rgb,A]),(tw,th),interpolation=cv2.INTER_AREA)
                r,c=divmod(j,COLS); S[r*th:(r+1)*th,c*tw:(c+1)*tw]=rgba
            p=f'{OUT}/{name}_{tag}_{ci}.webp'; Image.fromarray(S).save(p,'WEBP',quality=78,method=4)
            sizes[tag]=sizes.get(tag,0)+os.path.getsize(p)//1024
    if SPECIES=='cat':
        for pal in ['tabby',*CAT_COATS]: sheet(lambda x,p=pal: cat_recolor(x,p), pal)
        sheet(sketch,'sketch')
        for col,t in CAT_COLLARS.items(): sheet(lambda x:x, f'collar_{col}', lambda rgb,A,t=t: collar_overlay(rgb,A,t))
    else:
        for pal in ['honey','cocoa','snow','midnight']: sheet(lambda x,p=pal: recolor(x,p), pal)
        sheet(sketch,'sketch')
        for bnd,t in BAND.items(): sheet(lambda x:x, f'band_{bnd}', lambda rgb,A,t=t: band_overlay(rgb,A,t))
    manifest[name]={'origin':[int(x0),int(y0)],'sc':float(sc),'native':{'cx':float(x0+ref['cx']/sc),'bottom':float(y0+ref['bottom']/sc),'height':float((ref['bottom']-ref['top'])/sc)},'loop':name in LOOPS,'pingpong':name in LOOPS,'frames':n,'fps':FPS,'per':PER,'cols':COLS,'chunks':chunks,'fw':tw,'fh':th,'ref':ref}
    print(name,n,'frames',tw,'x',th,'chunks',chunks,sizes,flush=True)
# all videos share Gemini's framing (bandana width 221–229 px in each), so one anchor fits all:
# the sitting idle dog defines where the paws and the head centre are and how tall the dog is.
manifest['_anchor']=manifest['idle']['native']
if SPECIES=='cat':
    for k,c in manifest.items():
        if not k.startswith('_'): c['anchor']=c['native']
json.dump(manifest,open(f'{OUT}/clips.json','w'),indent=1)

# --- regenerate the TypeScript asset map
if SPECIES=='cat':
    tags=['tabby',*CAT_COATS,'sketch',*[f'collar_{c}' for c in CAT_COLLARS]]
    L=["/* Generated from tools/art/clips.py output (assets/pets/cat/clips). Do not edit by hand. */","import clips from '../../assets/pets/cat/clips/clips.json';","","export const CAT_CLIPS = clips;","export type CatClipName = Exclude<keyof typeof clips, '_anchor'>;","export type CatClipSheets = Record<string, number[]>;","","export const CAT_CLIP_IMG: Record<CatClipName, CatClipSheets> = {"]
else:
    tags=['honey','cocoa','snow','midnight','sketch','band_coral','band_leaf','band_sun','band_berry']
    L=["/* Generated from tools/art/clips.py output (assets/pets/dog/clips). Do not edit by hand. */","import clips from '../../assets/pets/dog/clips/clips.json';","","export const DOG_CLIPS = clips;","export type DogClipName = Exclude<keyof typeof clips, '_anchor'>;","export const DOG_ANCHOR = clips._anchor;","export type DogClipSheets = Record<string, number[]>;","","export const DOG_CLIP_IMG: Record<DogClipName, DogClipSheets> = {"]
for name,c in manifest.items():
    if name.startswith('_'): continue
    L.append(f"  {name}: {{")
    for t in tags:
        L.append(f"    {t}: [" + ', '.join(f"require('../../assets/pets/{SPECIES}/clips/{name}_{t}_{i}.webp')" for i in range(c['chunks'])) + "],")
    L.append("  },")
L.append("};\n")
open(f'src/animation/{SPECIES}Clips.ts','w').write('\n'.join(L))
