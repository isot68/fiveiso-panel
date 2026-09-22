-- Isolated adapter tests. No FXServer or real SQL connection is used here.
local kind=arg[1] or 'qb'
local agentPath=arg[2] or '../fiveiso/'
local now=100;os.time=function()return now end
local players={};local updateCount=1
local lastQuery,lastParams;local mode='search'
function GetConvar(_,fallback)return fallback end
function GetPlayers()return players end
function GetResourceState()return 'started' end
function GetAllVehicles()return {} end
function CreateThread(fn)fn()end
local record={firstname='Ada',lastname='Test',other='keep'}
json={decode=function(s)
 if s=='character' then return {firstname=record.firstname,lastname=record.lastname,other=record.other} end
 if s=='money' then return {cash=100,bank=200,money=100,crypto=8} end
 error('invalid json')
end,encode=function(v)return 'encoded' end}
MySQL={ready={await=function()end},query={await=function(q,p)
 lastQuery=q;lastParams=p
 if q:find('INFORMATION_SCHEMA',1,true) then
 local out={};for _,name in ipairs({'identifier','firstname','lastname','accounts','citizenid','charinfo','money','owner','plate','parking','garage','vehicle'})do out[#out+1]={COLUMN_NAME=name}end;return out end
 if q:find('AS garage FROM',1,true)then return {{garage='old'}}end
 if q:find(' AS owner',1,true)then return {{owner='abc',plate='TEST',garage='old',model='character'}}end
 return {{citizenid='abc',identifier='abc',charinfo='character',firstname='Ada',lastname='Test',money='money',accounts='money'}}
end},single={await=function(q,p)
 lastQuery=q;lastParams=p
 if q:find('AS value',1,true)then return {value='money'}end
 return {charinfo='character',firstname='Ada',lastname='Test'}
end},update={await=function(q,p)
 lastQuery=q;lastParams=p
 local n=0;for _ in q:gmatch('%?')do n=n+1 end
 assert(n==#p,'SQL placeholder/parameter mismatch')
 return updateCount
end}}
dofile(agentPath..'database-config.lua');FiveISODatabaseConfig.framework=kind
dofile(agentPath..'database.lua')
local D=FiveISODatabase
local r=D.execute({type='dbCharacters',params={query="' OR 1=1 --",page=0}})
assert(r.rows[1].firstname=='Ada' and #r.rows==1)
assert(not lastQuery:find("' OR 1=1",1,true) and lastParams[1]=="' OR 1=1 --")
r=D.execute({type='dbBalances',params={query='',page=0}});assert(r.rows[1].bank==200 and r.rows[1].cash==100)
local c={type='dbSetBalance',target='abc',value='reason',params={account='bank',expected=200,amount=250}}
r=D.execute(c);assert(r.before==200 and r.after==250)
c.params.expected=199;assert(not pcall(D.execute,c),'stale balance must fail');c.params.expected=200
updateCount=0;assert(not pcall(D.execute,c),'CAS conflict must fail');updateCount=1
r=D.execute({type='dbSetCharacter',target='abc',value='reason',params={firstname='New',lastname='Name',expected='Ada|Test'}});assert(r.after=='New|Name')
r=D.execute({type='dbSetGarage',target='TEST',value='reason',params={garage='new',expected='old'}});assert(r.after=='new')
for _,f in ipairs({'fxmanifest.lua','database-config.lua','database.lua','bridge.lua','server.lua','client.lua'})do assert(loadfile(agentPath..f))end
print(kind..': adapter search, live writes, balance, name, garage, CAS and Lua syntax passed')
