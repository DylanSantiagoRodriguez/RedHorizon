import bpy,json,math
from pathlib import Path
from mathutils import Vector
ratios=[]
for i in range(1,6):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path.cwd()/f'public/models/environment/rock_{i}.glb'))
 v=[o.matrix_world@Vector(p) for o in bpy.context.scene.objects if o.type=='MESH' for p in o.bound_box];size=[max(p[k] for p in v)-min(p[k] for p in v) for k in range(3)];ratios.append(size[2]/math.hypot(size[0],size[1]))
(Path.cwd()/'src/data/rockRatios.json').write_text(json.dumps(ratios))
