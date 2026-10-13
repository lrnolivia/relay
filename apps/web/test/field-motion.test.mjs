import test from 'node:test';
import assert from 'node:assert/strict';
import {springStep} from '../../../packages/shared-ui/field-springs.js';
import {fieldMotion,fieldGlyphVariants} from '../../../packages/shared-ui/field-motion.js';
import {fieldIconShapes} from '../../../packages/shared-ui/field-icons.js';
import {glyph} from '../../../packages/shared-ui/glyphs.js';
test('Field glyph shapes and semantic spring profiles remain canonical',()=>{
 assert.deepEqual(fieldMotion.glyph,{type:'spring',stiffness:500,damping:22,mass:.44});
 assert.deepEqual(fieldGlyphVariants.gear.hover,{rotate:18,scale:1.06});
 assert.deepEqual(fieldGlyphVariants.eye.tap,{scaleX:.9,scaleY:.62});
 assert.match(glyph('refresh'),/viewBox="0 0 16 16"/);assert.ok(glyph('refresh').includes(fieldIconShapes.Reload));
 assert.match(glyph('settings'),/data-loew-glyph="gear"/);assert.match(glyph('review'),/data-loew-glyph="eye"/);
});
test('analytic springs preserve continuous position and velocity when interrupted and settle at 60/120Hz',()=>{
 for(const dt of [1/60,1/120]){
  let p={value:0,velocity:0};for(let t=0;t<.1;t+=dt)p=springStep(p.value,p.velocity,1,dt,fieldMotion.glyph);
  const interrupted=springStep(p.value,p.velocity,0,0,fieldMotion.glyph);assert.ok(Math.abs(interrupted.value-p.value)<1e-10);assert.ok(Math.abs(interrupted.velocity-p.velocity)<1e-10);
  for(let t=0;t<2;t+=dt)p=springStep(p.value,p.velocity,0,dt,fieldMotion.glyph);assert.ok(Math.abs(p.value)<1e-8);assert.ok(Math.abs(p.velocity)<1e-8);
 }
 let p={value:-100,velocity:0};for(let i=0;i<120;i++){p=springStep(p.value,p.velocity,0,1/120,{stiffness:520,damping:42.3,mass:.86});assert.ok(p.value<=1e-4,'structural slabs do not overshoot their edge');}
});
