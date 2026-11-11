import bpy,math,json,tempfile
from pathlib import Path
from mathutils import Vector,Matrix
OUT=Path(__file__).resolve().parent;SRC=Path(r'C:\Users\macab\Desktop\7. RUBY')
(OUT/'temp').mkdir(exist_ok=True);tempfile.tempdir=str(OUT/'temp')
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30
bpy.ops.import_scene.fbx(filepath=str(SRC/'idle.fbx'));rig=next(o for o in s.objects if o.type=='ARMATURE');mesh=next(o for o in s.objects if o.type=='MESH');base=rig.matrix_world.copy();bones={b.name:b.matrix_local.copy() for b in rig.data.bones};actions={}
for name in ['idle','move','attack_melee','attack_special','summon','death','spawn']:
 if name=='idle':other=rig; imported=[]
 else:
  before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(SRC/(name+'.fbx')));imported=list(set(bpy.data.objects)-before);other=next(o for o in imported if o.type=='ARMATURE')
 assert set(other.data.bones.keys())==set(bones)
 assert max(abs(bones[b.name][i][j]-b.matrix_local[i][j]) for b in other.data.bones for i in range(4) for j in range(4))<.0001
 a=other.animation_data.action;start,end=a.frame_range
 count={'idle':60,'move':36,'attack_melee':30,'attack_special':45,'summon':45,'death':75,'spawn':60}[name];samples=[]
 for f in range(count+1):
  u=min(f/65,1) if name=='death' else f/count
  # Use one complete supplied cycle, resampled to the delivery timing.
  frame=start+(end-start)*u;s.frame_set(int(frame),subframe=frame-int(frame))
  samples.append({p.name:(p.location.copy(),p.rotation_quaternion.copy() if p.rotation_mode=='QUATERNION' else p.rotation_euler.to_quaternion(),p.scale.copy()) for p in other.pose.bones})
 actions[name]=samples
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data_clear();rig.matrix_world=base
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(deps);verts=[ev.matrix_world@v.co for v in ev.data.vertices];height=max(v.z for v in verts)-min(v.z for v in verts);factor=7/height;rig.scale*=factor
bpy.context.view_layer.update();rig.name='RubyRig';mesh.name='RubyBody'
# Rebuild supplied PBR material and embed all maps.
mat=bpy.data.materials.new('Ruby_PBR');mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
for suffix,ext,socket in [('basecolor','jpg','Base Color'),('metallic','png','Metallic'),('roughness','png','Roughness'),('normal','png','Normal')]:
 tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(SRC/'ruby'/('ruby_'+suffix+'.'+ext)))
 if suffix!='basecolor':tex.image.colorspace_settings.name='Non-Color'
 tex.image.pack()
 if suffix=='normal':
  normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs[socket])
 else:links.new(tex.outputs['Color'],shader.inputs[socket])
mesh.data.materials.clear();mesh.data.materials.append(mat)
# Match the four skin influences used by the GLB runtime before grounding poses.
for v in mesh.data.vertices:
 weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda x:x[1],reverse=True);total=sum(w for _,w in weights[:4])
 for i,w in weights[4:]:mesh.vertex_groups[i].remove([v.index])
 for i,w in weights[:4]:mesh.vertex_groups[i].add([v.index],w/total if total else 0,'REPLACE')
# Rest pose is the supplied bind pose, without animation offsets.
rest={p.name:(Vector((0,0,0)),Matrix.Identity(3).to_quaternion(),Vector((1,1,1))) for p in rig.pose.bones};actions['reference_pose']=[rest,rest]
root=rig.pose.bones['mixamorig:Hips'];origin=rig.matrix_world@root.bone.head_local
world_to_location=(rig.matrix_world.to_3x3()@root.bone.matrix_local.to_3x3()).inverted();report=[]
for name,samples in actions.items():
 rig.animation_data_clear()
 for f,pose in enumerate(samples):
  s.frame_set(f)
  blend=max(0,(f/(len(samples)-1)-.8)/.2) if name in ['idle','move'] else 0
  blend=blend*blend*(3-2*blend)
  for p in rig.pose.bones:
   loc,q,scale=pose[p.name];p.rotation_mode='QUATERNION'
   p.location=loc.lerp(samples[0][p.name][0],blend);p.rotation_quaternion=q.slerp(samples[0][p.name][1],blend);p.scale=scale
  rest_world=rig.matrix_world.to_quaternion()@root.bone.matrix_local.to_quaternion();delta=rest_world@root.rotation_quaternion@rest_world.inverted();swing,_=delta.to_swing_twist('Z');root.rotation_quaternion=rest_world.inverted()@swing@rest_world
  bpy.context.view_layer.update();pos=rig.matrix_world@root.head
  root.location+=world_to_location@Vector((origin.x-pos.x,origin.y-pos.y,0));bpy.context.view_layer.update()
  ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());bottom=min((ev.matrix_world@v.co).z for v in ev.data.vertices)
  root.location+=world_to_location@Vector((0,0,-bottom));bpy.context.view_layer.update()
  for p in rig.pose.bones:
   p.keyframe_insert('location',frame=f,group=p.name);p.keyframe_insert('rotation_quaternion',frame=f,group=p.name);p.keyframe_insert('scale',frame=f,group=p.name)
 a=rig.animation_data.action;a.name=name;a.use_fake_user=True
 report.append({**({'eventFrame':18,'eventTime':.6,'event':'contact'} if name=='attack_melee' else {'eventFrame':30,'eventTime':1,'event':'release' if name=='attack_special' else 'call'} if name in ['attack_special','summon'] else {}),'name':name,'duration':(len(samples)-1)/30,'frames':len(samples)-1,'loop':name in ['idle','move']})
rig.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);bpy.context.view_layer.update();chest=rig.pose.bones['mixamorig:Spine1'];sockets=[]
for name,offset in [('core_socket',(0,-.85,.1)),('muzzle_socket',(0,-1.1,.1))]:
 socket=bpy.data.objects.new(name,None);s.collection.objects.link(socket);socket.parent=rig;socket.parent_type='BONE';socket.parent_bone=chest.name;socket.empty_display_type='ARROWS';socket.empty_display_size=.15
 target=Matrix.Translation(rig.matrix_world@chest.head+Vector(offset))@Vector((0,-1,0)).to_track_quat('Z','Y').to_matrix().to_4x4()
 socket.matrix_basis=(rig.matrix_world@chest.matrix@Matrix.Translation((0,chest.bone.length,0))).inverted()@target;sockets.append(socket)
rig.animation_data_clear();rig.animation_data_create()
for entry in report:
 name=entry['name'];track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,bpy.data.actions[name]);track.mute=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
for socket in sockets:socket.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ruby.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_anim_slide_to_zero=True)
(OUT/'animations.json').write_text(json.dumps({'fps':30,'height':7,'source_scale_multiplier':factor,'clips':report},indent=2))
center=Vector((0,0,3.5));bpy.ops.object.camera_add(location=(12,-18,10));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=11;s.camera=cam
for loc,power in [((6,-12,15),6000),((-9,-3,9),4500)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=4
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1);s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=650;s.render.resolution_y=650;s.render.resolution_percentage=100
for name,frames in [('reference_pose',[0]),('idle',[0]),('move',[9]),('attack_melee',[0,10,15,20,30]),('attack_special',[0,15,24,30,45]),('summon',[0,15,24,30,45]),('spawn',[0,30,60]),('death',[75])]:
 rig.animation_data.action=bpy.data.actions[name]
 for f in frames:s.frame_set(f);s.render.filepath=str(OUT/(name+'-'+str(f)+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);s.frame_start=0;s.frame_end=75;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ruby.blend'));print('COMPLETE',report)
