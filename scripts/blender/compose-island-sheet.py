import sys,os
from PIL import Image, ImageDraw, ImageFont
d,out,title=sys.argv[1],sys.argv[2],sys.argv[3]
views=[v.split('=') for v in sys.argv[4:]]
W=720
font=ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc",26)
rows=[]
for v,label in views:
    ims=[]
    for st in ("before","after"):
        im=Image.open(os.path.join(d,f"{st}-{v}.png")).convert("RGBA")
        bg=Image.new("RGBA",im.size,(245,239,226,255));bg.alpha_composite(im)
        ims.append(bg.convert("RGB").resize((W,int(im.height*W/im.width))))
    rows.append((label,ims))
H=80+sum(r[1][0].height+50 for r in rows)
sheet=Image.new("RGB",(W*2+60,H),(245,239,226));dr=ImageDraw.Draw(sheet)
dr.text((20,20),title,fill=(59,47,42),font=font)
y=80
for label,(a,b) in rows:
    dr.text((20,y),label,fill=(107,90,80),font=font);y+=40
    sheet.paste(a,(20,y));sheet.paste(b,(40+W,y));y+=a.height+10
sheet.save(out,optimize=True)
