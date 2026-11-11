import bpy,json
from pathlib import Path
from mathutils import Vector
out=Path.cwd()/'outputs/aurora'
for i in range(1,2):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(Path.cwd()/'public/models/spaceship_aurora.glb'))
 s=bpy.context.scene;verts=[o.matrix_world@Vector(v) for o in s.objects if o.type=='MESH' for v in o.bound_box];lo=Vector([min(v[k] for v in verts) for k in range(3)]);hi=Vector([max(v[k] for v in verts) for k in range(3)]);center=(lo+hi)/2;size=(hi-lo).length
 print('WORLD',i,list(lo),list(hi))
 bpy.ops.object.camera_add(location=center+Vector((1,-1,1))*size);cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size;s.camera=cam
 bpy.ops.object.light_add(type='SUN');bpy.context.object.data.energy=3
 s.render.engine='CYCLES';s.cycles.samples=8;s.render.resolution_x=600;s.render.resolution_y=500;s.render.resolution_percentage=100;s.render.filepath=str(out/f'world_{i}.png');bpy.ops.render.render(write_still=True)

