import bpy,json
from pathlib import Path
src=Path(r'C:\Users\macab\Desktop\5. SPITTER')
for name in ['idle','move_forward','move_backward','attack_ranged','death']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(src/(name+'.fbx')))
 print('INSPECT',name,json.dumps([{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None,'dimensions':list(o.dimensions),'bones':[b.name for b in o.data.bones] if o.type=='ARMATURE' else None,'action':list(o.animation_data.action.frame_range) if o.animation_data and o.animation_data.action else None} for o in bpy.context.scene.objects]))
