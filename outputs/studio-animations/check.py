import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'C:\Users\macab\Desktop\MULTIMEDIA-JUEGO\outputs\studio-animations\studio-model-animated.blend')
for o in bpy.context.scene.objects:
 if o.type in ['CAMERA','MESH','ARMATURE']:
  print(o.name,o.type,'parent',o.parent,'matrix',o.matrix_world)
  if o.type=='MESH':
   m=o.evaluated_get(bpy.context.evaluated_depsgraph_get());ps=[m.matrix_world@v.co for v in m.data.vertices];print('RANGE',[(min(p[i] for p in ps),max(p[i] for p in ps)) for i in range(3)])
