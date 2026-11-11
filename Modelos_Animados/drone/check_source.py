import bpy
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(out/'drone.blend'));s=bpy.context.scene
for o in list(s.objects):
 if o.type in ['MESH','ARMATURE']:bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\macab\Downloads\DRONE\drone.glb');m=next(o for o in s.objects if o.type=='MESH');print('SOURCE',len(m.data.vertices),m.matrix_world)
pts=[m.matrix_world@v.co for v in m.data.vertices];center=sum(pts,Vector())/len(pts);s.camera.location=center+Vector((1.6,-2.2,1));s.camera.rotation_euler=(center-s.camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/'source-check.png');bpy.ops.render.render(write_still=True)
