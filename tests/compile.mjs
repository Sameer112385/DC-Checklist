import fs from 'node:fs';
import ts from 'typescript';
export async function compileModules(group,files){
 const root='.test-output/'+group;fs.mkdirSync(root,{recursive:true});
 for(const file of files){let result=ts.transpileModule(fs.readFileSync('lib/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const dependency of files)result=result.replaceAll("'./"+dependency+"'","'./"+dependency+".mjs'");
  fs.writeFileSync(root+'/'+file+'.mjs',result);
 }
 return import('../'+root+'/'+files.at(-1)+'.mjs');
}
