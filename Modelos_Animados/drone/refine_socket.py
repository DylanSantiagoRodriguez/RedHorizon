import bpy,tempfile
from pathlib import Path
from mathutils import Vector,Matrix
out=Path(__file__).resolve().parent;tempfile.tempdir=str(out/'temp');bpy.ops.wm.open_mainfile(filepath=str(out/'drone.blend'));s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE');m=next(o for o in s.objects if o.type=='MESH');r.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);bpy.context.view_layer.update();h=r.pose.bones['head'];socket=bpy.data.objects['muzzle_socket'];target=Matrix.Translation(Vector((.0075,-.47,.20)))@Vector((0,-1,0)).to_track_quat('Z','Y').to_matrix().to_4x4();socket.matrix_basis=(r.matrix_world@h.matrix@Matrix.Translation((0,h.bone.length,0))).inverted()@target
r.animation_data.action=None;bpy.ops.object.select_all(action='DESELECT')
for o in [r,m,socket]:o.select_set(True)
bpy.context.view_layer.objects.active=r;bpy.ops.export_scene.gltf(filepath=str(out/'drone.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_anim_slide_to_zero=True)
r.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=str(out/'drone.blend'))
