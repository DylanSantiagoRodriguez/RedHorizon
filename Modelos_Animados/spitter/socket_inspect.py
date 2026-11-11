import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).resolve().parent/'spitter.blend'))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');m=next(o for o in bpy.context.scene.objects if o.type=='MESH')
print('HEAD',r.matrix_world@r.pose.bones['mixamorig:Head'].head)
g=m.vertex_groups['mixamorig:Head'].index;points=[m.matrix_world@v.co for v in m.data.vertices if any(a.group==g and a.weight>.5 for a in v.groups)]
print('HEAD_BOUNDS',[(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)])
print('FRONT',sorted([list(p) for p in points],key=lambda p:p[1])[:12])
