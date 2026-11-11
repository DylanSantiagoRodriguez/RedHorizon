import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).resolve().parent/'ruby.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for name in ['mixamorig:Hips','mixamorig:Spine1','mixamorig:Spine2']:print(name,list(r.matrix_world@r.pose.bones[name].head))
