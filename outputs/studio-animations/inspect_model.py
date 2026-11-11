import bpy,json,math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\macab\Downloads\studio-model.glb')
for o in bpy.context.scene.objects:
 if o.type=='ARMATURE':
  print('BONES',json.dumps([{'name':b.name,'head':list(o.matrix_world@b.head_local),'tail':list(o.matrix_world@b.tail_local),'parent':b.parent.name if b.parent else None} for b in o.data.bones]))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
pts=[mesh.matrix_world@Vector(c) for c in mesh.bound_box]; center=sum(pts,Vector())/8; size=max(max(p[i] for p in pts)-min(p[i] for p in pts) for i in range(3)); print('BOUNDS', [list(p) for p in pts])
bpy.ops.object.camera_add(location=center+Vector((1.5,-2,1))*size); cam=bpy.context.object; cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=size*1.4; bpy.context.scene.camera=cam
for delta,power in [((1,-2,3),450),((-2,-1,1),250)]:
 bpy.ops.object.light_add(type='AREA',location=center+Vector(delta)*size); bpy.context.object.data.energy=power; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=size*2
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.world=bpy.data.worlds.new('World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.15,.15,1);s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath=r'C:\Users\macab\Desktop\MULTIMEDIA-JUEGO\outputs\studio-animations\inspection.png';bpy.ops.render.render(write_still=True)
