import bpy,math,json,tempfile,bmesh
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
OUT=Path(__file__).resolve().parent;SRC=Path(r'C:\Users\macab\Downloads\DRONE');(OUT/'temp').mkdir(exist_ok=True);tempfile.tempdir=str(OUT/'temp')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(SRC/'drone-rig.fbx'));s=bpy.context.scene;s.render.fps=30
rig=next(o for o in s.objects if o.type=='ARMATURE');mesh=next(o for o in s.objects if o.type=='MESH');rig.animation_data_clear();rig.name='DroneRig'
for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
# Restore UVs from the original matching triangulated surface (FBX duplicated triangle vertices).
from mathutils.kdtree import KDTree
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(SRC/'drone.glb'));imported=set(bpy.data.objects)-before;source=next(o for o in imported if o.type=='MESH')
source.data.calc_loop_triangles();triangles=list(source.data.loop_triangles)
choices=[]
for angle in [math.pi/2,-math.pi/2]:
 rotation=Matrix.Rotation(angle,4,'Z');kd=KDTree(len(triangles))
 for i,tri in enumerate(triangles):kd.insert(sum((rotation@source.matrix_world@source.data.vertices[k].co for k in tri.vertices),Vector())/3,i)
 kd.balance();error=sum(kd.find(mesh.matrix_world@p.center)[2] for p in mesh.data.polygons)/len(mesh.data.polygons);choices.append((error,rotation,kd))
error,rotation,kd=min(choices,key=lambda x:x[0]);assert error<.0001,error
for face in mesh.data.polygons:
 _,i,d=kd.find(mesh.matrix_world@face.center);assert d<.0001
 tri=triangles[i]
 for li in face.loop_indices:
  point=mesh.matrix_world@mesh.data.vertices[mesh.data.loops[li].vertex_index].co
  sl=min(tri.loops,key=lambda k:(rotation@source.matrix_world@source.data.vertices[source.data.loops[k].vertex_index].co-point).length)
  mesh.data.uv_layers.active.data[li].uv=source.data.uv_layers.active.data[sl].uv
for o in imported:bpy.data.objects.remove(o,do_unlink=True)

mat=bpy.data.materials.new('Drone_PBR');mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
for suffix,ext,socket in [('basecolor','jpg','Base Color'),('metallic','png','Metallic'),('roughness','png','Roughness'),('normal','png','Normal')]:
 tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(SRC/('drone_'+suffix+'.'+ext)))
 if suffix!='basecolor':tex.image.colorspace_settings.name='Non-Color'
 tex.image.pack()
 if suffix=='normal':
  n=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],shader.inputs[socket])
 else:links.new(tex.outputs['Color'],shader.inputs[socket])
mesh.data.materials.clear();mesh.data.materials.append(mat)
bm=bmesh.new();bm.from_mesh(mesh.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(mesh.data);bm.free()
mesh.data.normals_split_custom_set([(0,0,0)]*len(mesh.data.loops))
for face in mesh.data.polygons:face.use_smooth=True
for v in mesh.data.vertices:
 weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda x:x[1],reverse=True);total=sum(w for _,w in weights[:4])
 for i,w in weights[4:]:mesh.vertex_groups[i].remove([v.index])
 for i,w in weights[:4]:mesh.vertex_groups[i].add([v.index],w/total if total else 0,'REPLACE')
def turn(name,axis,angle):
 p=rig.pose.bones[name];a=(rig.matrix_world.to_3x3()@p.bone.matrix_local.to_3x3()).inverted()@Vector(axis);p.rotation_quaternion=Quaternion(a.normalized(),angle)
def smooth(a,b,t):
 u=max(0,min(1,(t-a)/(b-a)));return u*u*(3-2*u)
clips=[('hover',60,True),('move_forward',30,True),('move_backward',36,True),('attack_ranged',30,False),('death',66,False),('reference_pose',1,False)];report=[]
for name,end,loop in clips:
 rig.animation_data_clear()
 for f in range(end+1):
  s.frame_set(f);u=f/end;t=f/30;wave=math.tau*u
  for p in rig.pose.bones:p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
  if name in ['hover','move_forward','move_backward']:
   power=.025 if name=='hover' else .06;pitch=0 if name=='hover' else (.10 if name=='move_forward' else -.09)
   turn('pelvis',(1,0,0),pitch+.012*math.sin(wave))
   for i in range(1,9):turn('tail_'+str(i),(0,0,1),power*math.sin(wave-i*.45))
   for side,sign in [('l',1),('r',-1)]:
    for part in ['front','back']:
     turn(part+'_fin_0_'+side,(0,1,0),sign*(.09 if name=='hover' else .16)*math.sin(wave))
     turn(part+'_fin_1_'+side,(0,0,1),sign*.035*math.sin(wave+.6))
  elif name=='attack_ranged':
   opening=smooth(0,.3,t)*(1-smooth(.55,1,t));recoil=smooth(.4,.47,t)*(1-smooth(.47,.75,t))
   turn('mouth_base',(1,0,0),.22*opening);turn('mouth_1',(1,0,0),.12*opening)
   turn('head',(1,0,0),-.06*opening-.08*recoil);turn('neck',(1,0,0),-.045*recoil)
   for side,sign in [('l',1),('r',-1)]:turn('front_fin_0_'+side,(0,1,0),sign*.18*opening)
   for i in range(1,9):turn('tail_'+str(i),(0,0,1),.015*math.sin(i*.4)*recoil)
  elif name=='death':
   fall=smooth(.05,1.7,t)
   turn('pelvis',(0,1,0),.48*fall);turn('neck',(1,0,0),.18*fall);turn('head',(1,0,0),.12*fall)
   turn('mouth_base',(1,0,0),-.12*fall)
   for i in range(1,9):turn('tail_'+str(i),(1,0,0),.055*fall)
   for side,sign in [('l',1),('r',-1)]:
    for part in ['front','back']:turn(part+'_fin_0_'+side,(0,1,0),sign*.4*fall);turn(part+'_fin_1_'+side,(0,1,0),sign*.16*fall)
  for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=f,group=p.name);p.keyframe_insert('location',frame=f,group=p.name)
 a=rig.animation_data.action;a.name=name;a.use_fake_user=True;report.append({'name':name,'frames':end,'duration':end/30,'loop':loop,**({'eventFrame':12,'eventTime':.4,'event':'release'} if name=='attack_ranged' else {})})
rig.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);bpy.context.view_layer.update();head=rig.pose.bones['head'];socket=bpy.data.objects.new('muzzle_socket',None);s.collection.objects.link(socket);socket.parent=rig;socket.parent_type='BONE';socket.parent_bone='head';socket.empty_display_type='ARROWS';socket.empty_display_size=.05
point=Vector((.0075,-.47,.20));target=Matrix.Translation(point)@Vector((0,-1,0)).to_track_quat('Z','Y').to_matrix().to_4x4();socket.matrix_basis=(rig.matrix_world@head.matrix@Matrix.Translation((0,head.bone.length,0))).inverted()@target
rig.animation_data_clear();rig.animation_data_create()
for name,end,loop in clips:
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,bpy.data.actions[name]);track.mute=True
bpy.ops.object.select_all(action='DESELECT')
for o in [rig,mesh,socket]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'drone.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_anim_slide_to_zero=True)
(OUT/'animations.json').write_text(json.dumps({'fps':30,'source':str(SRC/'drone-rig.fbx'),'scale':'original','clips':report},indent=2))
center=Vector((0,-.12,.16));bpy.ops.object.camera_add(location=(1.6,-2.2,1));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.9;s.camera=cam
for loc,power in [((1,-2,3),250),((-2,1,2),220)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=3
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1);s.render.engine='CYCLES';s.cycles.samples=24;s.render.resolution_x=800;s.render.resolution_y=650;s.render.resolution_percentage=100
for name,frame in [('reference_pose',0),('hover',15),('move_forward',8),('move_backward',9),('attack_ranged',12),('death',66)]:
 rig.animation_data.action=bpy.data.actions[name];s.frame_set(frame);s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['reference_pose'];s.frame_set(0);s.frame_start=0;s.frame_end=66;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'drone.blend'));print('COMPLETE',report)
