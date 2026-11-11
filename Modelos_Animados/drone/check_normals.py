import bpy
from pathlib import Path
out=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(out/'drone.blend'));s=bpy.context.scene;s.camera.data.ortho_scale=1.9
m=next(o for o in s.objects if o.type=='MESH');m.data.normals_split_custom_set([(0,0,0)]*len(m.data.loops))
shader=m.data.materials[0].node_tree.nodes.get('Principled BSDF')
for l in list(shader.inputs['Normal'].links):m.data.materials[0].node_tree.links.remove(l)
s.render.filepath=str(out/'normal-check.png');bpy.ops.render.render(write_still=True)
