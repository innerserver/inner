const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
module.exports = function createGoogleLogin(deps) {
  const env=deps.env||process.env, flows=new Map();
  const clientId=env.INNER_GOOGLE_CLIENT_ID||'',clientSecret=env.INNER_GOOGLE_CLIENT_SECRET||'',redirectUri=env.INNER_GOOGLE_REDIRECT_URI||'';
  let validRedirect=false;
  try { const url=new URL(redirectUri);validRedirect=url.pathname==='/api/auth/google/callback' && !url.username && !url.password && !url.search && !url.hash && (url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))); } catch {}
  const enabled=Boolean(clientId&&clientSecret&&validRedirect);
  const client=enabled?(deps.client||new OAuth2Client({clientId,clientSecret,redirectUri,transporterOptions:{timeout:10000}})):null;
  const cookieName='connectifi_google_flow';
  const cookie=(req,value,maxAge)=>`${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=${maxAge}${deps.isHttps(req)?'; Secure':''}`;
  const finish=(res,code)=>{res.writeHead(303,{Location:code?'/?google_error='+code:'/', 'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
  return async function handle(req,res,url){
    if(!url.pathname.startsWith('/api/auth/google'))return false;
    if(req.method!=='GET'){deps.json(res,405,{error:'Method not allowed'});return true;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(url.pathname==='/api/auth/google/status'){deps.json(res,200,{enabled});return true;}
    if(!enabled){deps.json(res,503,{error:'Google sign-in is not configured'});return true;}
    if(url.pathname==='/api/auth/google/start'){
      if(!deps.rate('google:'+deps.ip(req),20,60000)){deps.json(res,429,{error:'Please wait before trying Google sign-in again'});return true;}
      const now=Date.now();for(const[id,entry]of flows)if(entry.expires<=now)flows.delete(id);
      if(flows.size>=500){deps.json(res,503,{error:'Sign-in is busy. Try again shortly.'});return true;}
      const previous=deps.cookie(req,cookieName);if(previous)flows.delete(previous);
      const state=crypto.randomBytes(32).toString('base64url'),nonce=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url');
      flows.set(state,{nonce,verifier,expires:now+600000});
      res.setHeader('Set-Cookie',cookie(req,state,600));
      const location=client.generateAuthUrl({scope:['openid','email'],state,nonce,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
      res.writeHead(302,{Location:location});res.end();return true;
    }
    if(url.pathname!=='/api/auth/google/callback'){deps.json(res,404,{error:'Not found'});return true;}
    const state=url.searchParams.get('state')||'',flow=flows.get(state),browserState=deps.cookie(req,cookieName);
    res.setHeader('Set-Cookie',cookie(req,'',0));
    if(!state||!flow||browserState!==state||flow.expires<=Date.now()){finish(res,'expired');return true;}
    flows.delete(state);
    if(url.searchParams.has('error')){finish(res,'cancelled');return true;}
    const code=url.searchParams.get('code');if(!code||code.length>4096){finish(res,'failed');return true;}
    try{
      const {tokens}=await client.getToken({code,codeVerifier:flow.verifier,redirect_uri:redirectUri});
      if(!tokens.id_token)throw new Error('No Google identity');
      const ticket=await client.verifyIdToken({idToken:tokens.id_token,audience:clientId}),payload=ticket.getPayload();
      if(!payload || payload.nonce!==flow.nonce || payload.email_verified!==true || !payload.sub || !payload.email)throw new Error('Invalid Google identity');
      // Gmail and Workspace accounts are authoritative for their verified email.
      if(!payload.hd && !payload.email.toLowerCase().endsWith('@gmail.com')){finish(res,'email');return true;}
      const users=await deps.users(),matches=users.filter(user=>String(user.email||'').trim().toLowerCase()===payload.email.toLowerCase());
      if(matches.length!==1){finish(res,'account');return true;}
      await deps.login(users,matches[0],req,res,'google',true);
    }catch{if(!res.headersSent)finish(res,'failed');}
    return true;
  };
};
