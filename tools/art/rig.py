import cv2, numpy as np, json, os
from PIL import Image
import sys; SRC=sys.argv[1] if len(sys.argv)>1 else 'docs/art/gpt-dog/source/master_b.png'; OUT=sys.argv[2] if len(sys.argv)>2 else '/tmp/pavurio-rig'; os.makedirs(OUT, exist_ok=True)
I=np.array(Image.open(SRC).convert('RGBA')); H0,W0=I.shape[:2]
PAD=70
I=np.concatenate([I, np.zeros((PAD,W0,4),np.uint8)],0); H,W=I.shape[:2]
A=(I[:,:,3]>8)
def poly(pts):
    m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(pts,np.int32)],1); return m.astype(bool)
def ell(cx,cy,rx,ry):
    m=np.zeros((H,W),np.uint8); cv2.ellipse(m,(cx,cy),(rx,ry),0,0,360,1,-1); return m.astype(bool)
hsv=cv2.cvtColor(I[:,:,:3],cv2.COLOR_RGB2HSV)
# --- bandana: teal pixels + enclosed paw print
teal=(hsv[:,:,0]>75)&(hsv[:,:,0]<100)&(hsv[:,:,1]>70)&A
teal=cv2.morphologyEx(teal.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((25,25),np.uint8))
cnts,_=cv2.findContours(teal,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
B=np.zeros((H,W),np.uint8); big=max(cnts,key=cv2.contourArea); cv2.drawContours(B,[big],-1,1,-1); B=B.astype(bool)&A
# --- regions
TAIL=poly([(20,740),(300,740),(305,860),(290,905),(282,1000),(285,1080),(305,1150),(20,1180)])
TAIL_EX=poly([(20,740),(300,740),(300,860),(272,905),(262,1000),(265,1080),(295,1150),(20,1180)])
EL=poly([(525,190),(400,178),(290,255),(200,420),(138,560),(145,705),(230,775),(335,778),(398,705),(398,560),(383,420),(392,330),(470,272),(525,245)])
ER=poly([(842,125),(960,145),(1052,235),(1150,335),(1245,415),(1258,525),(1225,610),(1120,665),(1035,645),(1022,560),(1045,470),(1000,335),(958,252),(900,212),(842,182)])
HE=ell(712,425,348,332)|poly([(440,5),(760,5),(770,170),(560,250),(400,262),(400,150)])
HEAD=HE&A&~EL&~ER&~B
# --- eyes from dark blobs near expected centres
dark=(hsv[:,:,2]<95)&A
def eye(cx,cy):
    m=dark&ell(cx,cy,85,85); ys,xs=np.where(m)
    x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
    c=((x0+x1)//2,(y0+y1)//2); r=((x1-x0)//2+5,(y1-y0)//2+5)
    core=cv2.dilate((dark&ell(c[0],c[1],r[0],r[1])).astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)
    cv2.floodFill  # noop
    filled=core.copy().astype(np.uint8); cnts,_=cv2.findContours(filled,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    m=np.zeros((H,W),np.uint8); cv2.drawContours(m,cnts,-1,1,-1)
    return m.astype(bool), c, r
EYL,cL,rL=eye(527,455); EYR,cR,rR=eye(872,405)
BODY=A&~(TAIL_EX&~EL)&~HEAD&~EL&~ER&~B
def feather(m,k=3): return cv2.GaussianBlur(m.astype(np.float32),(0,0),k*0.5)
def layer(mask, fill=None, rad=12):
    L=I.copy().astype(np.float32)
    a=I[:,:,3].astype(np.float32)/255*np.clip(feather(mask,2.2)*1.0,0,1)
    if fill is not None and fill.any():
        bgr=cv2.cvtColor(I[:,:,:3],cv2.COLOR_RGB2BGR)
        known=mask & (I[:,:,3]>230)
        # 1) coarse extrapolation of the layer's own colours everywhere (no black bleed)
        sm=cv2.resize(bgr,(W//6,H//6),interpolation=cv2.INTER_AREA)
        ks=cv2.resize(known.astype(np.uint8),(W//6,H//6),interpolation=cv2.INTER_NEAREST)
        ks=cv2.erode(ks,np.ones((3,3),np.uint8))
        coarse=cv2.inpaint(sm,(1-ks).astype(np.uint8),9,cv2.INPAINT_TELEA)
        coarse=cv2.resize(coarse,(W,H),interpolation=cv2.INTER_CUBIC)
        tmp=np.where(known[:,:,None],bgr,coarse)
        # 2) fine inpaint inside the hole using real neighbours
        inp=cv2.inpaint(tmp,fill.astype(np.uint8),rad,cv2.INPAINT_TELEA)
        rgb=cv2.cvtColor(inp,cv2.COLOR_BGR2RGB).astype(np.float32)
        L[:,:,:3]=np.where(fill[:,:,None],rgb,L[:,:,:3])
        u=np.clip(feather(mask|fill,2.2),0,1)
        a=u*np.where(fill,1.0,I[:,:,3].astype(np.float32)/255)
    L[:,:,3]=np.clip(a,0,1)*255
    return L.astype(np.uint8)
hullpts=cv2.convexHull(np.column_stack(np.where(BODY|B))[:,::-1].astype(np.int32))
hull=np.zeros((H,W),np.uint8); cv2.fillPoly(hull,[hullpts],1); hull=hull.astype(bool)
body_fill=(B|(HE&(np.arange(H)[:,None]>560)))&hull&~TAIL_EX
head_fill=((EL|ER)&ell(712,425,330,318))|cv2.dilate((EYL|EYR).astype(np.uint8),np.ones((15,15),np.uint8)).astype(bool)
head_fill&=HE
L={
 'tail':layer(TAIL&A&~EL),
 'body':layer(BODY,body_fill,15),
 'bandana':layer(B),
 'earL':layer(EL&A),
 'earR':layer(ER&A),
 'head':layer(HEAD,head_fill,9),
 'eyeL':layer(EYL&A),
 'eyeR':layer(EYR&A),
}
for k in ['eyeL','eyeR']:
    e=L[k]; hs=cv2.cvtColor(e[:,:,:3],cv2.COLOR_RGB2HSV)
    tinted=(hs[:,:,1]>50)&(hs[:,:,2]>70)
    e[:,:,:3]=np.where(tinted[:,:,None],np.array([34,28,40],np.uint8),e[:,:,:3])
np.save('/tmp/rigmeta.npy',np.array([cL[0],cL[1],rL[0],rL[1],cR[0],cR[1],rR[0],rR[1],W,H]))
for k,v in L.items(): Image.fromarray(v).save(f'{OUT}/full_{k}.png')
# debug composite
order=['tail','body','bandana','earL','earR','head','eyeL','eyeR']
comp=Image.new('RGBA',(W,H),(200,230,255,255))
for k in ['tail','body','bandana','head','earL','earR','eyeL','eyeR']: comp.alpha_composite(Image.open(f'{OUT}/full_{k}.png'))
comp.convert('RGB').save(f'{OUT}/_composite.png')
print('eyes',cL,rL,cR,rR,'size',W,H)
