import bpy
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent;bpy.ops.wm.open_mainfile(filepath=str(out/'spitter.blend'));s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');r.animation_data.action=bpy.data.actions['attack_ranged'];s.frame_set(15);bpy.context.view_layer.update();socket=bpy.data.objects['muzzle_socket'];point=socket.matrix_world.translation.copy();print('SOCKET',list(point));bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.035,location=point);marker=bpy.context.object;mat=bpy.data.materials.new('Socket_marker');mat.diffuse_color=(.1,1,.1,1);marker.data.materials.append(mat);s.render.filepath=str(out/'muzzle-socket.png');bpy.ops.render.render(write_still=True)
