export const MOSAIC_KEYS = ['progress','needs','motion','activity'];
export function normalizeOrder(value) {
 const kept=Array.isArray(value)?[...new Set(value.filter(key=>MOSAIC_KEYS.includes(key)))]:[];
 return [...kept,...MOSAIC_KEYS.filter(key=>!kept.includes(key))];
}
export function moveCard(order,key,target) {
 const next=normalizeOrder(order),from=next.indexOf(key),to=next.indexOf(target);
 if(from<0||to<0||from===to)return next;
 next.splice(from,1);next.splice(to,0,key);return next;
}
