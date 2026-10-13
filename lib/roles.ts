export const roles=['inspector','supervisor','admin'] as const;
export type Role=typeof roles[number];
export type Profile={user_id:string;email:string;full_name:string;role:Role;active:boolean};
export function isRole(value:unknown):value is Role{return roles.includes(value as Role)}
export function canInspect(role:Role){return role==='inspector'||role==='admin'}
export function canReview(role:Role){return role==='supervisor'||role==='admin'}
export function canOpenTab(role:Role,tab:string){
  if(tab==='Admin users'||tab==='Manage checklists')return role==='admin';
  if(tab==='Fill checklist')return canInspect(role);
  if(tab==='Supervisor view'||tab==='Completion history')return canReview(role);
  return true;
}
