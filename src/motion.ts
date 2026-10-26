import { Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';
@Directive({selector:'[motionSurface]',standalone:true})
export class MotionSurfaceDirective implements OnDestroy {
 private readonly abort = new AbortController();
 private frame = 0;
 constructor(element:ElementRef<HTMLElement>,zone:NgZone) {
  const el=element.nativeElement;
  zone.runOutsideAngular(()=>{
   el.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch' || !matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches || el.closest('.motion-off'))return;
    cancelAnimationFrame(this.frame);
    this.frame=requestAnimationFrame(()=>{const r=el.getBoundingClientRect();const x=(event.clientX-r.left)/r.width;const y=(event.clientY-r.top)/r.height;el.style.setProperty('--rx',`${(0.5-y)*5}deg`);el.style.setProperty('--ry',`${(x-0.5)*5}deg`);el.style.setProperty('--mx',`${x*100}%`);el.style.setProperty('--my',`${y*100}%`);el.style.setProperty('--glow','1');});
   },{signal:this.abort.signal});
   el.addEventListener('pointerleave',()=>{cancelAnimationFrame(this.frame);el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');el.style.setProperty('--glow','0');},{signal:this.abort.signal});
  });
 }
 ngOnDestroy(){this.abort.abort();cancelAnimationFrame(this.frame);}
}
