export async function api(path,options={}) {
  const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json','X-Childcare-Client':'local-pilot',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok){const e=new Error(data.error||'Please try again.');e.status=response.status;throw e;}return data;
}
