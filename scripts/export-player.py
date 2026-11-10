import bpy
from pathlib import Path
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE' or (obj.type == 'MESH' and any(m.type == 'ARMATURE' for m in obj.modifiers)):
        obj.select_set(True)
output = Path(__file__).resolve().parents[1] / 'public' / 'models' / 'player.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, export_animations=False)
