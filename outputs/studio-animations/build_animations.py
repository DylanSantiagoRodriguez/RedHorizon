"""Generate four base clips. Run with Blender --background --python this_file.py."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Quaternion
OUT=Path(__file__).resolve().parent
SOURCE=Path(r'C:\Users\macab\Downloads\studio-model.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
s=bpy.context.scene;s.render.fps=30
rig=next(o for o in s.objects if o.type=='ARMATURE'); meshes=[o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
rig.name='StudioCreatureRig'
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
def turn(name, axis, angle):
 p=rig.pose.bones[name]; local=p.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
 p.rotation_quaternion=Quaternion(local,angle)
def smooth(a,b,t):
 v=max(0,min(1,(t-a)/(b-a)));return v*v*(3-2*v)
def pulse(a,b,c,t):return smooth(a,b,t)*(1-smooth(b,c,t))
clips=[('idle',60,True),('move',24,True),('attack_melee',36,False),('death',72,False)]
report=[]
for name,end,loop in clips:
 rig.animation_data_clear()
 for f in range(end+1):
  s.frame_set(f);t=f/30;u=f/end;w=math.tau*u
  for p in rig.pose.bones:p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
  pelvis=rig.pose.bones['pelvis']
  if name=='idle':
   pelvis.location.z=.0025*math.sin(w)
   turn('bone_1',(0,1,0),.018*math.sin(w))
   for b,sign in [('bone_15',1),('bone_25',-1)]:turn(b,(0,0,1),sign*.025*math.sin(w))
   for b,sign in [('bone_16',1),('bone_26',-1)]:turn(b,(0,0,1),sign*.035*math.sin(w+.5))
  if name=='move':
   pelvis.location.z=.004*(1-math.cos(2*w));turn('pelvis',(1,0,0),.025*math.sin(w))
   for i,(upper,lower) in enumerate([('bone_10','bone_11'),('bone_19','bone_20'),('bone_4','bone_5'),('bone_7','bone_8')]):
    phase=w+(i%2)*math.pi+(i//2)*math.pi
    turn(upper,(0,0,1),.13*math.sin(phase));turn(lower,(1,0,0),(.10 if i%2 else -.10)*math.sin(phase))
   for b,sign in [('bone_15',1),('bone_25',-1)]:turn(b,(0,0,1),sign*(.07+.025*math.sin(w)))
   turn('bone_1',(0,1,0),.025*math.sin(2*w))
  if name=='attack_melee':
   wind=pulse(0,.24,.52,t);hit=pulse(.24,.46,.85,t)
   pelvis.location.x=-.025*wind+.055*hit;pelvis.location.z=.012*wind-.015*hit
   turn('pelvis',(0,1,0),-.05*wind+.10*hit)
   for a,b,sign in [('bone_15','bone_16',1),('bone_25','bone_26',-1)]:
    turn(a,(0,0,1),sign*(.24*wind-.23*hit));turn(b,(0,0,1),sign*(.13*wind-.27*hit))
   turn('bone_1',(0,1,0),-.06*wind+.08*hit)
  if name=='death':
   fall=smooth(.12,1.25,t);settle=pulse(1.1,1.35,1.7,t)
   pelvis.location.z=-.105*fall+.009*settle
   turn('pelvis',(1,0,0),1.40*fall+.04*settle);turn('bone_1',(0,1,0),-.12*fall)
   for a,b,sign in [('bone_15','bone_16',1),('bone_25','bone_26',-1)]:
    turn(a,(0,0,1),sign*.28*fall);turn(b,(0,1,0),.28*fall)
   for a,sign in [('bone_10',1),('bone_19',-1),('bone_4',1),('bone_7',-1)]:turn(a,(1,0,0),sign*.28*fall)
  pelvis.location=pelvis.bone.matrix_local.to_3x3().inverted() @ pelvis.location
  # Keep the evaluated surface above its original ground plane.
  bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  bottom=min((m.matrix_world@v.co).z for obj in meshes for m in [obj.evaluated_get(deps)] for v in m.data.vertices)
  if bottom<0:rig.pose.bones['root'].location=rig.pose.bones['root'].bone.matrix_local.to_3x3().inverted() @ Vector((0,0,-bottom))
  for p in rig.pose.bones:
   p.keyframe_insert('location',frame=f,group=p.name);p.keyframe_insert('rotation_quaternion',frame=f,group=p.name)
 action=rig.animation_data.action;action.name=name;action.use_fake_user=True
 report.append({'name':name,'duration':end/30,'loop':loop,'frames':[0,end],**({'hit_time':.46} if name=='attack_melee' else {}),**({'hold_final_pose':True} if name=='death' else {})})
rig.animation_data_clear();rig.animation_data_create()
for name,end,loop in clips:
 a=bpy.data.actions[name];track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,a);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'studio-model-animated.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_anim_slide_to_zero=True)
(OUT/'animations.json').write_text(json.dumps({'fps':30,'source':str(SOURCE),'forward_axis':'+X','clips':report},indent=2))
# Presentation scene, excluded from game export.
center=Vector((0,0,.18));bpy.ops.object.camera_add(location=(1.25,-1.65,1.0));cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.4;s.camera=cam
for loc,power in [((1,-2,3),350),((-2,-1,2),220)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=3
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.08,.08,1)
s.render.engine='CYCLES';s.cycles.samples=24;s.render.resolution_x=800;s.render.resolution_y=650;s.render.resolution_percentage=100
for name,frame in [('idle',15),('move',6),('attack_melee',14),('death',72)]:
 rig.animation_data.action=bpy.data.actions[name];s.frame_set(frame);s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['idle'];s.frame_start=0;s.frame_end=60;s.frame_set(0)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'studio-model-animated.blend'))
print('COMPLETE',json.dumps(report))
