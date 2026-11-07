"""3D náhľad vygenerovaného terénu (len na kontrolu, výška je prehnaná 1.6x).

Spustenie: python3 nastroje/nahlad_3d.py   (potrebuje matplotlib)
"""
import numpy as np, matplotlib
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent.parent); matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from PIL import Image
h=np.asarray(Image.open('mapa/unreal/heightmap.png')).astype(float)/65535
c=np.asarray(Image.open('mapa/nahlad/nahlad_3d.png').convert('RGB')).astype(float)/255
st=4; h=h[::st,::st]; c=c[::st,::st]
z=(np.maximum(h,0.48)-0.5)*512  # meters at Z=100
z=z*1.0
y,x=np.mgrid[0:h.shape[0],0:h.shape[1]]*st*2.0  # XY scale 200 -> 2 m per px
fig=plt.figure(figsize=(16,9),dpi=120); ax=fig.add_subplot(111,projection='3d')
ax.plot_surface(x,-y,z*1.6,facecolors=c,rstride=1,cstride=1,linewidth=0,antialiased=False,shade=False)
ax.set_box_aspect((4034,2270,420)); ax.view_init(elev=32,azim=-70); ax.set_facecolor("#0f2a33"); ax.set_axis_off()
plt.subplots_adjust(-0.35,-0.45,1.35,1.45); fig.patch.set_facecolor('#0f2a33')
plt.savefig('mapa/nahlad/nahlad_perspektiva.png',facecolor=fig.get_facecolor())
