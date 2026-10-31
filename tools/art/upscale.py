import cv2, numpy as np, sys, os
# 4x upscaler for flat art. Model: EDSR_x4.pb from https://github.com/Saafke/EDSR_Tensorflow (set EDSR_MODEL).
# Needs opencv-contrib-python-headless.
from PIL import Image
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(os.environ.get('EDSR_MODEL','EDSR_x4.pb')); sr.setModel('edsr',4)
def up4(path_in, path_out, pad=8):
    im=np.array(Image.open(path_in).convert('RGBA'))
    im=np.pad(im,((pad,pad),(pad,pad),(0,0)))
    rgb=im[:,:,:3].copy(); a=im[:,:,3]
    known=(a>200).astype(np.uint8)
    # bleed edge colours outward so the upscaler never sees black/transparent fringes
    bleed=cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),(1-known),5,cv2.INPAINT_TELEA)
    big=sr.upsample(bleed)
    big=cv2.cvtColor(big,cv2.COLOR_BGR2RGB)
    A=cv2.resize(a,(a.shape[1]*4,a.shape[0]*4),interpolation=cv2.INTER_CUBIC).astype(np.float32)
    A=np.clip((A-40)*255/(215-40),0,255)   # crisp, anti-aliased edge
    A=cv2.GaussianBlur(A,(0,0),0.7)
    out=np.dstack([big,A.astype(np.uint8)])
    Image.fromarray(out).save(path_out)
    return out.shape
if __name__=='__main__':
    print(up4(sys.argv[1],sys.argv[2]))
