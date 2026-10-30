import sys, glob, os, numpy as np
from PIL import Image
# split wide multi-character crops at vertical gaps in alpha
def split(path):
    im = Image.open(path); a = np.array(im); h, w = a.shape[:2]
    if w < 1.35*h: return [path]
    col = (a[:,:,3] > 60).sum(axis=0).astype(float)
    sm = np.convolve(col, np.ones(9)/9, mode='same')
    thresh = max(2, sm.max()*0.06)
    low = sm < thresh
    cuts=[]; i=0
    while i < w:
        if low[i]:
            j=i
            while j<w and low[j]: j+=1
            if i>15 and j<w-15: cuts.append((i+j)//2)
            i=j
        else: i+=1
    if not cuts: return [path]
    edges=[0]+cuts+[w]; outs=[]
    base=path[:-4]
    for k in range(len(edges)-1):
        x0,x1=edges[k],edges[k+1]
        piece=a[:,x0:x1]
        ys,xs=np.where(piece[:,:,3]>30)
        if len(xs)<500: continue
        piece=piece[ys.min():ys.max()+1, xs.min():xs.max()+1]
        p=f'{base}_{k}.png'; Image.fromarray(piece).save(p); outs.append(p)
    if len(outs)>1: os.remove(path)
    return outs
n=0
for f in sorted(glob.glob(sys.argv[1]+'/sheet_*.png')):
    n+=len(split(f))
print(n)
