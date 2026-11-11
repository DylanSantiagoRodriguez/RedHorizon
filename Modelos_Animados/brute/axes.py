import bpy
bpy.ops.import_scene.fbx(filepath=r'C:\Users\macab\Desktop\3. BRUTE\idle.fbx')
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');r.animation_data_clear()
print('RIG',r.matrix_world)
for n in ['Hips','Head','LeftFoot','RightFoot']:print(n,r.matrix_world@r.data.bones['mixamorig:'+n].head_local)
