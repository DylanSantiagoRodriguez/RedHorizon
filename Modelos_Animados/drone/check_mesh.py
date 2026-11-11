import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).resolve().parent/'drone.blend'))
for o in bpy.context.scene.objects:
 if o.type=='MESH':print('MESH',o.name,len(o.data.vertices),'UV',[(u.name,len(u.data)) for u in o.data.uv_layers], 'smooth',sum(p.use_smooth for p in o.data.polygons))
