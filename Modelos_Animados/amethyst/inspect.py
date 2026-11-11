import bpy,json
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=r'C:\Users\macab\Downloads\amethyst-rigged.fbx')
for o in bpy.context.scene.objects:
 print('OBJECT',o.name,o.type,list(o.dimensions),list(o.scale))
 if o.type=='ARMATURE': print('BONES',json.dumps([{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(o.matrix_world@b.head_local),'tail':list(o.matrix_world@b.tail_local)} for b in o.data.bones]))
print('IMAGES',[(i.name,i.filepath) for i in bpy.data.images])
