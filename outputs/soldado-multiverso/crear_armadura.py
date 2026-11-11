import bpy, math
from mathutils import Vector
from pathlib import Path
OUT=Path(__file__).resolve().parent
if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
rig=bpy.data.objects['Armature']
def mat(name,color,metal=0,rough=.4,emit=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 if emit: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emit
 return m
pink=mat('01 • Cerámica rosa',(.65,.035,.22),.65,.29)
dark=mat('02 • Grafito flexible',(.018,.025,.045),.25,.48)
white=mat('03 • Titanio blanco',(.65,.75,.85),.65,.26)
cyan=mat('04 • Energía dimensional',(.015,.65,1),.35,.2,3)
visor=mat('05 • Visor iridiscente',(.015,.3,.42),.85,.16)
for o in list(bpy.data.objects):
 if o.type=='MESH':
  if o.name.endswith('.002'): o.hide_render=True; o.hide_viewport=True
  else:
   o.data.materials.clear(); o.data.materials.append(pink if o.name.startswith('Head') else dark)
def plate(name,loc,size,material,bone=None,bevel=.08):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 b=o.modifiers.new('Bordes mecanizados','BEVEL'); b.width=bevel; b.segments=2
 o.modifiers.new('Normales','WEIGHTED_NORMAL')
 if bone:
  v=o.vertex_groups.new(name=bone); v.add(list(range(len(o.data.vertices))),1,'REPLACE'); a=o.modifiers.new('Sigue el esqueleto','ARMATURE'); a.object=rig
 return o
# Helmet layered face, brow, jaw and side comms.
plate('Visor • marco',(0,-1.02,6.13),(1.55,.25,.82),dark,'Head',.18)
plate('Visor • cristal',(0,-1.18,6.16),(1.34,.16,.55),visor,'Head',.15)
plate('Frente • corona',(0,-.76,6.65),(1.48,.38,.25),pink,'Head')
plate('Barbilla',(0,-.81,5.57),(1.15,.35,.26),pink,'Head')
for s in [-1,1]:
 plate('Casco • mandíbula',(s*.66,-.82,5.78),(.25,.34,.52),pink,'Head')
 plate('Casco • sensor',(s*.88,-.15,6.12),(.25,.65,.66),dark,'Head')
 plate('Casco • luz',(s*.91,-.49,6.14),(.13,.1,.28),cyan,'Head',.03)
 plate('Pectoral',(s*.47,-.72,4.45),(.85,.45,.8),pink,'Column3',.12)
 plate('Pectoral • marca',(s*.48,-.96,4.65),(.5,.035,.1),white,'Column3',.02)
 side='L' if s>0 else 'R'
 plate('Hombrera '+side,(s*1.28,-.1,4.88),(.82,.94,.8),pink,'Arm.'+side,.16)
 plate('Hombrera • insignia '+side,(s*1.28,-.59,4.95),(.44,.05,.24),white,'Arm.'+side,.03)
 plate('Bíceps '+side,(s*1.82,-.1,4.73),(.43,.68,.67),pink,'Arm.'+side)
 plate('Antebrazo '+side,(s*2.92,-.1,4.73),(1.05,.76,.76),pink,'Forearm.'+side,.12)
 plate('Antebrazo • panel '+side,(s*2.9,-.5,4.77),(.68,.08,.29),dark,'Forearm.'+side,.04)
 plate('Antebrazo • luz '+side,(s*2.9,-.55,4.8),(.44,.03,.055),cyan,'Forearm.'+side,.015)
 plate('Muslo '+side,(s*.53,-.43,2.07),(.65,.83,.85),pink,'Thigh.'+side,.12)
 plate('Rodilla '+side,(s*.5,-.73,1.35),(.62,.35,.4),white,'Leg.'+side)
 plate('Espinilla '+side,(s*.5,-.37,.76),(.62,.76,.79),pink,'Leg.'+side,.1)
 plate('Espinilla • luz '+side,(s*.5,-.77,.8),(.09,.045,.48),cyan,'Leg.'+side,.02)
 plate('Bota '+side,(s*.5,-.51,.16),(.69,1.15,.35),dark,'Foot.'+side)
for z,w in [(3.9,1.35),(3.58,1.2),(3.28,1.1)]: plate('Abdomen • segmento',(0,-1.06,z),(w,.26,.24),pink,'Column1',.06)
plate('Núcleo • soporte',(0,-.99,4.25),(.36,.16,.42),dark,'Column3',.07)
plate('Núcleo • portal',(0,-1.08,4.25),(.19,.05,.25),cyan,'Column3',.04)
plate('Cinturón',(0,-.2,2.87),(1.8,1.9,.23),dark,'Hip')
plate('Hebilla',(0,-1.19,2.87),(.34,.1,.2),white,'Hip',.03)
plate('Mochila • reactor',(0,.83,4.15),(1.3,.65,1.5),dark,'Column3',.14)
for s in [-1,1]: plate('Mochila • celda',(s*.4,1.18,4.18),(.3,.14,.95),pink,'Column3')
# Studio is isolated from the character for clean exports.
studio=bpy.data.collections.new('ESTUDIO • solo presentación'); bpy.context.scene.collection.children.link(studio)
def studio_obj(o):
 for c in list(o.users_collection): c.objects.unlink(o)
 studio.objects.link(o)
floor=plate('Suelo',(0,0,-.17),(200,200,.1),mat('Suelo',(.025,.035,.06),.15,.5)); studio_obj(floor)
def aim(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(10,-22,12)); cam=bpy.context.object; aim(cam,(0,0,3.5)); cam.data.type='ORTHO'; cam.data.ortho_scale=12; studio_obj(cam)
scene=bpy.context.scene; scene.camera=cam
for name,loc,power,color,size in [('Principal',(1,-9,12),2200,(.8,.9,1),7),('Rosa',(-7,2,8),1800,(1,.15,.4),6),('Borde',(6,4,10),2600,(.15,.65,1),5)]:
 bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.color=color; o.data.shape='DISK'; o.data.size=size; aim(o,(0,0,3)); studio_obj(o)
scene.world.color=(.17,.17,.17); scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.resolution_x=1400; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'vista_previa.png')
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D': area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Player_Multiverso_Rosa.blend'))
bpy.ops.render.render(write_still=True)


