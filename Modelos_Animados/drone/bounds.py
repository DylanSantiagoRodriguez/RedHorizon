import bpy
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
for kind in ['fbx','gltf']:
 if kind=='fbx':bpy.ops.import_scene.fbx(filepath=r'C:\Users\macab\Downloads\DRONE\drone-rig.fbx')
 else:bpy.ops.import_scene.gltf(filepath=r'C:\Users\macab\Downloads\DRONE\drone.glb')
 m=[o for o in bpy.context.selected_objects if o.type=='MESH'][0];p=[m.matrix_world@v.co for v in m.data.vertices];print(kind,len(p),[(min(v[i] for v in p),max(v[i] for v in p)) for i in range(3)])
