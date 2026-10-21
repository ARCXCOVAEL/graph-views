// SPDX-License-Identifier: MPL-2.0
// Bounded local map/settings storage with atomic recovery and change guards.
// No note contents, shared policy, native index or network are accessed.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{normalize:validate}=require('./config.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),identity=st=>String(st.dev)+':'+String(st.ino),noFollow=fs.constants.O_NOFOLLOW||0;
class SettingsStore{
 constructor(directory,name='data.json',validator=validate){if(name!=='data.json')throw Error('Unknown local state file');this.validate=validator;this.directory=path.resolve(directory);this.file=path.join(this.directory,name);this.prior=this.file+'.previous';this.lock=this.file+'.lock';this.expected=undefined;this.anchor=null;}
 // Repeat ancestor/type/confinement checks at each IO boundary, including saves
 // after loading. Retain the loaded directory identity; never follow a swap.
 storage(){for(let p=this.directory;;p=path.dirname(p)){const st=fs.lstatSync(p);if(st.isSymbolicLink())throw Error('Linked graph-views storage refused');if(!st.isDirectory())throw Error('Graph preferences storage is not a directory');if(path.dirname(p)===p)break;}const real=fs.realpathSync(this.directory),same=process.platform==='win32'?real.toLowerCase()===this.directory.toLowerCase():real===this.directory;if(!same)throw Error('Redirected graph-views storage refused');const key=identity(fs.lstatSync(this.directory));if(this.anchor!==null&&this.anchor!==key)throw Error('Graph preferences storage directory changed; close and inspect it');this.anchor=key;}
 // Check exact fixed targets without following links. Missing is explicit, not
 // a catch-all for a missing parent or another storage error.
 target(file,missing=false){try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>2000000)throw Error('Graph preferences size/type refused');return st;}catch(e){if(missing&&e.code==='ENOENT')return null;throw e;}}
 // No-follow when supported, plus fd/type/identity and repeated directory
 // checks before reading bytes. Windows lacks full descriptor-relative IO.
 bytes(file,missing=false){this.storage();const before=this.target(file,missing);if(!before)return null;const fd=fs.openSync(file,fs.constants.O_RDONLY|noFollow);try{this.storage();const after=fs.fstatSync(fd);if(!after.isFile()||after.size>2000000||identity(after)!==identity(before))throw Error('Graph preferences target changed during read');return fs.readFileSync(fd);}finally{fs.closeSync(fd);}}
 // Unknown/malformed user state is exposed rather than repaired or replaced.
 read(){const b=this.bytes(this.file,true);if(b===null){this.expected=null;return null;}const s=this.validate(JSON.parse(b));this.expected=hash(b);return s;}
 // Fresh unpredictable temporary files are exclusive and no-follow. The
 // caller checks the destination again immediately before atomic replacement.
 temporary(file,bytes,owned){this.storage();const name=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(name,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|noFollow,0o600);owned.add(name);try{this.storage();fs.writeFileSync(fd,bytes);}finally{fs.closeSync(fd);}return name;}
 // Cleanup never traverses a changed directory or removes a replacement lock.
 // A refused directory swap leaves recovery/lock evidence for inspection.
 cleanup(owned,lockKey){try{this.storage();}catch{return;}for(const file of owned){try{const st=fs.lstatSync(file);if(st.isFile()&&!st.isSymbolicLink())fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')console.error('Graph Views temporary cleanup',e.message);}}try{const st=fs.lstatSync(this.lock);if(st.isFile()&&!st.isSymbolicLink()&&identity(st)===lockKey)fs.unlinkSync(this.lock);}catch(e){if(e.code!=='ENOENT')console.error('Graph Views lock cleanup',e.message);}}
 // Cooperative lock and loaded-byte comparison refuse competing changes.
 // This observes/refuses path swaps; it is not a malicious-process sandbox.
 save(s){this.validate(s);const bytes=Buffer.from(JSON.stringify(s,null,2)+'\n');if(bytes.length>2000000)throw Error('Graph preferences exceeds storage bound');this.storage();this.target(this.file,true);this.target(this.prior,true);const fd=fs.openSync(this.lock,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|noFollow,0o600),lockKey=identity(fs.fstatSync(fd)),owned=new Set();try{const old=this.bytes(this.file,true);if((old===null?null:hash(old))!==this.expected)throw Error('Graph preferences changed outside this window; reload Graph Views before editing');if(old!==null){const backup=this.temporary(this.prior,old,owned);this.storage();this.target(this.prior,true);fs.renameSync(backup,this.prior);owned.delete(backup);}const temp=this.temporary(this.file,bytes,owned);this.storage();this.target(this.file,true);const latest=this.bytes(this.file,true);if((latest===null?null:hash(latest))!==this.expected)throw Error('Graph preferences changed outside this window; reload Graph Views before editing');fs.renameSync(temp,this.file);owned.delete(temp);this.expected=hash(bytes);}finally{fs.closeSync(fd);this.cleanup(owned,lockKey);}}
}
module.exports={SettingsStore};
