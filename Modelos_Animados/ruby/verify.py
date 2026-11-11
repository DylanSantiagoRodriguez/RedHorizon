import bpy,json,math
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(OUT/'ruby.glb'))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');m=next(o for o in bpy.context.scene.objects if o.type=='MESH');report=[]
assert bpy.data.objects.get('core_socket') is not None;assert bpy.data.objects.get('muzzle_socket') is not None
tracks=list(r.animation_data.nla_tracks)
for t in tracks:t.mute=True
for track in tracks:
 a=track.strips[0].action;r.animation_data.action=a;end=round(a.frame_range[1]);poses=[];lowest=999;positions=[]
 for f in range(end+1):
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();ev=m.evaluated_get(bpy.context.evaluated_depsgraph_get());lowest=min(lowest,min((ev.matrix_world@v.co).z for v in ev.data.vertices));p=r.pose.bones['mixamorig:Hips'];pos=r.matrix_world@p.head;positions.append([pos.x,pos.y]);poses.append([v for b in r.pose.bones for row in b.matrix for v in row])
 drift=max(math.dist(p,positions[0]) for p in positions);loop=max(abs(x-y) for x,y in zip(poses[0],poses[-1]));stable=max(abs(x-y) for x,y in zip(poses[-2],poses[-1]));assert lowest>-.002,(a.name,lowest);assert drift<.0001,(a.name,drift)
 if track.name in ['idle','move']:assert loop<.0001,(a.name,loop)
 if track.name=='death':assert stable<.0001
 report.append({'clip':track.name,'ground_min':lowest,'horizontal_drift':drift,'loop_error':loop,'last_frame_delta':stable})
assert len(report)==8;assert len(r.data.bones)==33
(OUT/'verification.json').write_text(json.dumps({'passed':True,'bones':33,'clips':report},indent=2));print('VERIFIED',report)
