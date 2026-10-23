import{describe,expect,it}from"vitest";
import{findFirstSwipeHit,segmentCircleIntersectionT,sweptSegmentMovingCircleIntersectionT,type SliceTargetMotion}from"@/lib/mcqSliceNinjaPhysics";
const target=(x:number,o:Partial<SliceTargetMotion>={}):SliceTargetMotion=>({id:String(x),questionKey:"q",optionIndex:0,previousX:x,previousY:50,x,y:50,radius:15,active:true,sliced:false,...o});
describe("Math Slice Ninja swipe geometry",()=>{
 it("detects a fast sweep through a circle",()=>expect(segmentCircleIntersectionT({x:0,y:50},{x:100,y:50},{x:50,y:50},12)).toBeCloseTo(.38,5));
 it("rejects near misses and stationary off-target taps",()=>{expect(segmentCircleIntersectionT({x:0,y:0},{x:100,y:0},{x:50,y:21},20)).toBeNull();expect(segmentCircleIntersectionT({x:10,y:10},{x:10,y:10},{x:50,y:50},15)).toBeNull()});
 it("includes a moving target in continuous collision",()=>{expect(sweptSegmentMovingCircleIntersectionT({x:0,y:0},{x:100,y:0},{x:70,y:20},{x:30,y:20},21)).not.toBeNull();expect(sweptSegmentMovingCircleIntersectionT({x:0,y:0},{x:100,y:0},{x:70,y:20},{x:30,y:20},19)).toBeNull()});
 it("ignores stale, inactive, and already-sliced targets",()=>{const h=findFirstSwipeHit({x:0,y:50},{x:100,y:50},[target(20,{id:"old",questionKey:"old"}),target(30,{id:"inactive",active:false}),target(40,{id:"used",sliced:true}),target(70,{id:"live"})],"q");expect(h?.target.id).toBe("live")});
 it("selects only the earliest intersection",()=>{const h=findFirstSwipeHit({x:0,y:50},{x:100,y:50},[target(75,{id:"later"}),target(25,{id:"first"})],"q");expect(h?.target.id).toBe("first")});
});
