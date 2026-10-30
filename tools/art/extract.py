import sys, cv2, numpy as np
from PIL import Image, ImageDraw
src, outdir, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
dil = int(sys.argv[4]) if len(sys.argv)>4 else 9
im = Image.open(src).convert('RGBA'); a = np.array(im)
alpha = a[:,:,3]
# treat near-white opaque pixels as background too (sheets have white panels)
rgb = a[:,:,:3].astype(int)
white = (rgb.min(axis=2) > 246)
fg = ((alpha > 200) & ~white).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dil, dil))
merged = cv2.dilate(fg, k)
n, lab, stats, _ = cv2.connectedComponentsWithStats(merged, 8)
items = []
for i in range(1, n):
    x,y,w,h,area = stats[i]
    if area < 600: continue
    items.append((y//60, x, i, x,y,w,h))
items.sort()
bgc = Image.new('RGBA', im.size, (210,225,240,255)); bgc.alpha_composite(im); preview = bgc.convert('RGB'); d = ImageDraw.Draw(preview)
for idx,(_,_,i,x,y,w,h) in enumerate(items):
    m = (lab[y:y+h, x:x+w] == i) & (fg[y:y+h, x:x+w] > 0)
    m = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    crop = a[y:y+h, x:x+w].copy()
    crop[:,:,3] = np.where(m>0, crop[:,:,3], 0)
    # clean white halo: make near-white pixels transparent
    rgbc = crop[:,:,:3].astype(int); wh = rgbc.min(axis=2) > 246
    crop[:,:,3] = np.where(wh | (crop[:,:,3] < 30), 0, crop[:,:,3])
    Image.fromarray(crop).save(f'{outdir}/{prefix}_{idx:02d}.png')
    d.rectangle([x,y,x+w,y+h], outline=(255,0,0), width=2); d.text((x+3,y+3), str(idx), fill=(255,0,0))
preview.save(f'{outdir}/_{prefix}_index.png')
print(prefix, len(items))
