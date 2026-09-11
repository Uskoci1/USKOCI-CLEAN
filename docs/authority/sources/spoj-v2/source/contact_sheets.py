from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
R=Path(__file__).resolve().parents[1];cat=json.loads((R/'contracts/SCREEN_CATALOG_66.json').read_text())
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
for start in range(0,len(cat),16):
 rows=math.ceil(min(16,len(cat)-start)/4);im=Image.new('RGB',(1020,rows*576),(238,242,239));d=ImageDraw.Draw(im)
 for j,m in enumerate(cat[start:start+16]):
  i=start+j;file=R/f'renders/after/{i+1:02d}_{m["key"]}.png';src=Image.open(file).convert('RGB');src.thumbnail((238,526))
  x=(j%4)*255+8;y=(j//4)*576+32;im.paste(src,(x,y));d.text((x,y-25),f'{i+1:02d} · {m["key"]}',font=f,fill=(20,61,53))
 im.save(R/f'renders/CONTACT_{start//16+1}.jpg',quality=86)
