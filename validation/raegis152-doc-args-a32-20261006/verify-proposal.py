import json, hashlib, difflib, re, sys
from pathlib import Path
root=Path("/workspace/scratch/ea8baa184658/raegis152-two-row-proposal-20261006")
meta=json.loads((root/'source-pin-manifest.json').read_text())
def git(kind,b):return hashlib.sha1((kind+' '+str(len(b))+'\0').encode()+b).hexdigest()
def maketree(entries):
 d={}
 for e in entries:
  cur=d
  bits=e['path'].split('/')
  for bit in bits[:-1]:cur=cur.setdefault(bit,{})
  assert bits[-1] not in cur
  cur[bits[-1]]=(e['mode'],e['sha'])
 def rec(node):
  out=b''
  for name,item in sorted(node.items(),key=lambda x:x[0]+('/' if isinstance(x[1],dict) else '')):
   mode,sha=('40000',rec(item)) if isinstance(item,dict) else item
   out+=(mode+' '+name+'\0').encode()+bytes.fromhex(sha)
  return git('tree',out)
 return rec(d)
assert maketree(meta['source_files'])==meta['source_tree']
assert maketree(meta['base_files'])==meta['upstream_base_tree']
before=(root/'original/docs/public-api-compatibility.md').read_bytes()
after=(root/'candidate/docs/public-api-compatibility.md').read_bytes()
asset=(root/'proof/src/asset.ts').read_bytes()
readme=(root/'candidate/README.md').read_bytes()
assert git('blob',before)=='ea59bd3865e2a5155e9a910f8654fb720c5c646c'
assert git('blob',asset)=='0b5922dc115fbdc30ccb66b411e4b6a6b07b9187'
assert git('blob',readme)=='5e77bd3c0f8d6db4574a73b68f71f51ad8a2cd6e'
old=before.decode();new=after.decode();src=asset.decode();tick=chr(96)
for name in ('mint','transfer'):
 assert re.search(r'public async '+name+r'\(to: string, amount: number\)',src)
for name in ('mint_asset','transfer'):
 call=re.search(r"const call = contract.call\(\s*'"+name+r"',(.*?)\n\s*\);",src,re.S)
 assert call
 args=re.findall(r'nativeToScVal\(([^,]+),\s*\{ type: (\x27[^\x27]+\x27) \}\)',call.group(1))
 assert args==[('signer.publicKey()',"'address'"),('to',"'address'"),('amount',"'i128'")],args
 assert old.count(tick+name+'(to, amount)'+tick)==1
 old=old.replace(tick+name+'(to, amount)'+tick,tick+name+'(signer_public_key, to, amount)'+tick)
assert old==new
diff=list(difflib.unified_diff(before.decode().splitlines(True),new.splitlines(True),fromfile='a/docs/public-api-compatibility.md',tofile='b/docs/public-api-compatibility.md'))
changed=[x for x in diff if x.startswith(('+','-')) and not x.startswith(('+++','---'))]
assert len(changed)==4
patch=''.join(diff).encode()
patchpath=root/'two-contract-rows.patch'
if patchpath.exists(): assert patchpath.read_bytes()==patch
else: patchpath.write_bytes(patch)
projection=[dict(e,sha=git('blob',after)) if e['path']=='docs/public-api-compatibility.md' else e for e in meta['source_files']]
projected=maketree(projection)
locks=[]
for p in [root/'original/docs/public-api-compatibility.md',root/'candidate/docs/public-api-compatibility.md',root/'candidate/README.md',root/'proof/src/asset.ts',root/'source-pin-manifest.json',patchpath,root/'verify-proposal.py']:
 b=p.read_bytes();locks.append(dict(path=str(p.relative_to(root)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),git_blob=git('blob',b)))
receipt=dict(schema_version=1,status='LOCAL_PROPOSAL_HELD_OUTSIDE_PUBLISHER_TAKE',source_commit=meta['source_commit'],source_tree=meta['source_tree'],proposed_child_sole_parent=meta['source_commit'],upstream_base=meta['upstream_base'],upstream_base_tree=meta['upstream_base_tree'],projected_candidate_tree=projected,candidate_blob=git('blob',after),delta=dict(files_changed=1,rows_changed=2,added_lines=2,removed_lines=2,unchanged_source_blobs=99),argument_proof=dict(native_asset_git_blob=git('blob',asset),sdk_methods=['mint(to: string, amount: number)','transfer(to: string, amount: number)'],contract_calls=dict(mint_asset=['signer.publicKey() address','to address','amount i128'],transfer=['signer.publicKey() address','to address','amount i128'])),static_audit=meta['audit'],execution=dict(python=sys.version.split()[0],sdk_unit_tests_executed=False,sdk_build_lint_format_check_executed=False,live_dashboard_or_contract_execution=False,remote_source_or_pr_mutations=False),custody=dict(take_url='https://tokenjunkielabs.slack.com/archives/C0BU51F1PL3/p1791245931353449',owner='Sol-Raegis152-2020',publication_requires_owner_coordination_or_release=True),file_locks=locks)
p=root/'proposal-receipt.json';p.write_text(json.dumps(receipt,indent=2)+'\n')
rb=p.read_bytes()
print(json.dumps(dict(projected_tree=projected,candidate_blob=git('blob',after),rows_changed=2,source_args_verified=True,locks=locks,receipt_bytes=len(rb),receipt_sha256=hashlib.sha256(rb).hexdigest())))
