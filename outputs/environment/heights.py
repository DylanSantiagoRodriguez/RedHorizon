import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=Path.cwd()/'src/data/worldHeights.json';result=[]
for i in range(1,4):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path.cwd()/f'public/models/environment/world_{i}.glb'))
 verts=[];faces=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  offset=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([tuple(offset+j for j in p.vertices) for p in o.data.polygons])
 tree=BVHTree.FromPolygons(verts,faces);heights=[]
 for z in range(241):
  for x in range(241):
   hit=tree.ray_cast(Vector(((x-120)/240,-(z-120)/240,2)),Vector((0,0,-1)))[0];heights.append(round(hit.z if hit else 0,6))
 result.append(heights)
out.write_text(json.dumps(result,separators=(',',':')))
