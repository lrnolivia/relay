import {reviewBatch} from '../../../packages/runner/src/work-review.mjs';
import {workerSource} from '../../../packages/shared-ui/work-view-model.js';
export function reviewFixture(resolve){
 const values=new Map();let sequence=0;
 const bucket={async get(key){const entry=values.get(key);return entry?{etag:entry.etag,json:async()=>JSON.parse(entry.body)}:null;},async put(key,body,options){const entry=values.get(key);if(options.onlyIf.etagMatches&&entry?.etag!==options.onlyIf.etagMatches||options.onlyIf.etagDoesNotMatch==='*'&&entry)return null;const etag=String(++sequence);values.set(key,{etag,body});return {etag};}};
 return {values,async handle(req){let text='';for await(const chunk of req)text+=chunk;return reviewBatch(bucket,JSON.parse(text),resolve);},async body(input){return reviewBatch(bucket,input,resolve);}};
}
export {workerSource};
