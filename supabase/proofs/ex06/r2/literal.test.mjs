import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from './build.mjs';
test('SQL dollar quotes are inserted literally, never as JavaScript replacement patterns',()=>{
 const value="$tag$'x' $& $` $'";
 assert.equal(once('before ANCHOR after','ANCHOR',value),'before '+value+' after');
});
