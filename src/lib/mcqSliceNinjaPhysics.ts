export interface SlicePoint { x: number; y: number }
export interface SliceTargetMotion { id:string;questionKey:string|number;optionIndex:number;previousX:number;previousY:number;x:number;y:number;radius:number;active:boolean;sliced:boolean }
export interface SwipeHit<T extends SliceTargetMotion>{target:T;t:number}
const finite=(p:SlicePoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
export function segmentCircleIntersectionT(a:SlicePoint,b:SlicePoint,c:SlicePoint,r:number):number|null{
 if(!finite(a)||!finite(b)||!finite(c)||!Number.isFinite(r)||r<0)return null;
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-c.x,fy=a.y-c.y,q=fx*fx+fy*fy-r*r;if(q<=0)return 0;
 const aa=dx*dx+dy*dy;if(aa<=1e-9)return null;const bb=2*(fx*dx+fy*dy),disc=bb*bb-4*aa*q;if(disc<0)return null;
 const t=(-bb-Math.sqrt(Math.max(0,disc)))/(2*aa);return t>=-1e-9&&t<=1+1e-9?Math.max(0,Math.min(1,t)):null;
}
export function sweptSegmentMovingCircleIntersectionT(a:SlicePoint,b:SlicePoint,c:SlicePoint,d:SlicePoint,r:number):number|null{
 if(!finite(a)||!finite(b)||!finite(c)||!finite(d))return null;
 return segmentCircleIntersectionT({x:a.x-c.x,y:a.y-c.y},{x:b.x-d.x,y:b.y-d.y},{x:0,y:0},r);
}
export function findFirstSwipeHit<T extends SliceTargetMotion>(a:SlicePoint,b:SlicePoint,targets:readonly T[],key:string|number,padding=0):SwipeHit<T>|null{
 if(!Number.isFinite(padding)||padding<0)return null;let best:SwipeHit<T>|null=null;const q=String(key);
 for(const t of targets){if(!t.active||t.sliced||String(t.questionKey)!==q||!Number.isFinite(t.radius)||t.radius<=0)continue;
  const hit=sweptSegmentMovingCircleIntersectionT(a,b,{x:t.previousX,y:t.previousY},{x:t.x,y:t.y},t.radius+padding);if(hit===null)continue;
  if(!best||hit<best.t-1e-9||(Math.abs(hit-best.t)<=1e-9&&t.id.localeCompare(best.target.id)<0))best={target:t,t:hit}}
 return best;
}
