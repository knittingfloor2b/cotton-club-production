/**
 * COTTON CLUB BD LIMITED — Extended Part
 * Google Apps Script backend. Keep the GitHub repository PRIVATE.
 * Run setupSystem() once from the Apps Script editor.
 */

const APP = {
  title: 'COTTON CLUB BD LIMITED',
  version: '2.0.0',
  sessionSeconds: 21600,
  sheets: {
    users: 'Users',
    machines: 'Machines',
    rolls: 'Rolls'
  }
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP.title + ' — Extended Part')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Run once. Creates the database and a first Admin account. */
function setupSystem() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('DB_SPREADSHEET_ID');
  let ss;
  if (ssId) {
    ss = SpreadsheetApp.openById(ssId);
  } else {
    ss = SpreadsheetApp.create('Cotton Club Extended Part Database');
    props.setProperty('DB_SPREADSHEET_ID', ss.getId());
  }

  ensureSheet_(ss, APP.sheets.users, [
    'Username','Salt','PasswordHash','Status','Role','CanViewOthers',
    'Permission','AssignedShift','CreatedAt'
  ]);
  ensureSheet_(ss, APP.sheets.machines, ['MachineNo','Status','CreatedAt']);
  ensureSheet_(ss, APP.sheets.rolls, [
    'ID','Date','MachineNo','Shift','ProgramNo','RollNo','WeightKg',
    'Condition','EnteredBy','CreatedAt','UpdatedAt'
  ]);

  const users = getSheet_(APP.sheets.users);
  const rows = users.getDataRange().getValues();
  const adminExists = rows.slice(1).some(r => String(r[0]).toLowerCase() === 'admin');
  let initialPassword = '';
  if (!adminExists) {
    // Only the salted hash is stored in source; the initial password is provided separately.
    const salt = 'fa38027d995d7bfcb04eff1d7d6fdd82';
    const passwordHash = 'fa9e05975df2189e6a7a3eb101054f426619fe734174d03b3ccd2186cc451bed';
    users.appendRow([
      'admin', salt, passwordHash, 'Active', 'Admin',
      'TRUE', 'FullAccess', 'All', new Date()
    ]);
  }

  return {
    message: 'Setup completed.',
    spreadsheetUrl: ss.getUrl(),
    adminUsername: 'admin',
    initialAdminPassword: adminExists ? 'Admin already exists — use your existing password.' : 'Use the initial password provided in the project handover.',
    note: 'Change the initial password immediately after first login.'
  };
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
  }
  return sh;
}
function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID');
  if (!id) throw new Error('Database not initialized. Run setupSystem() first.');
  return SpreadsheetApp.openById(id);
}
function getSheet_(name) {
  const sh = getDb_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name + '. Run setupSystem().');
  return sh;
}
function makeInitialPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';
  let out = '';
  for (let i=0; i<22; i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, salt + String(password), Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function userRecord_(username) {
  const sh = getSheet_(APP.sheets.users);
  const data = sh.getDataRange().getValues();
  for (let i=1; i<data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { row:i+1, username:String(data[i][0]), salt:String(data[i][1]),
        hash:String(data[i][2]), status:String(data[i][3]), role:String(data[i][4]),
        canViewOthers:String(data[i][5]) === 'TRUE', permission:String(data[i][6]),
        assignedShift:String(data[i][7]) };
    }
  }
  return null;
}
function createSession_(user) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({
    username:user.username, role:user.role
  }), APP.sessionSeconds);
  return token;
}
function requireUser_(token) {
  if (!token) throw new Error('Session expired. Please log in again.');
  const raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Session expired. Please log in again.');
  const session = JSON.parse(raw);
  const user = userRecord_(session.username);
  if (!user || user.status !== 'Active') throw new Error('Account is not active.');
  return user;
}
function requireAdmin_(token) {
  const user = requireUser_(token);
  if (user.role !== 'Admin') throw new Error('Admin access required.');
  return user;
}

function login(username, password) {
  const user = userRecord_(String(username || '').trim());
  if (!user || user.status !== 'Active' ||
      hashPassword_(String(password || ''), user.salt) !== user.hash) {
    return { success:false, message:'Username or password is incorrect, or account is inactive.' };
  }
  return {
    success:true, token:createSession_(user),
    user:{username:user.username, role:user.role, canViewOthers:user.canViewOthers,
      permission:user.permission, assignedShift:user.assignedShift}
  };
}
function logout(token) {
  if (token) CacheService.getScriptCache().remove('sess_' + token);
  return {success:true};
}
function registerUser(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return 'Username: 3–30 letters/numbers/._- only.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (userRecord_(username)) return 'Username already exists.';
  const salt = Utilities.getUuid().replace(/-/g, '');
  getSheet_(APP.sheets.users).appendRow([
    username, salt, hashPassword_(password, salt), 'Pending', 'Staff',
    'FALSE', 'ViewOnly', 'A', new Date()
  ]);
  return 'OK';
}
function getBootstrap(token) {
  const user = requireUser_(token);
  const machines = getSheet_(APP.sheets.machines).getDataRange().getValues()
    .slice(1).filter(r => String(r[1]) === 'Active').map(r => String(r[0]));
  return {user:{username:user.username,role:user.role,canViewOthers:user.canViewOthers,
    permission:user.permission,assignedShift:user.assignedShift}, machines:machines,
    version:APP.version};
}

function addMachine(machineNo, token) {
  requireAdmin_(token);
  machineNo = String(machineNo || '').trim();
  if (!machineNo) throw new Error('Enter a machine number.');
  const sh = getSheet_(APP.sheets.machines);
  const values = sh.getDataRange().getValues();
  if (values.slice(1).some(r => String(r[0]).toLowerCase() === machineNo.toLowerCase()))
    throw new Error('Machine already exists.');
  sh.appendRow([machineNo,'Active',new Date()]);
  return {success:true};
}
function getMachines(token) {
  requireAdmin_(token);
  return getSheet_(APP.sheets.machines).getDataRange().getValues().slice(1)
    .map(r => ({machineNo:String(r[0]),status:String(r[1])}));
}
function setMachineStatus(machineNo, status, token) {
  requireAdmin_(token);
  const sh = getSheet_(APP.sheets.machines);
  const values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++) if (String(values[i][0]) === String(machineNo)) {
    sh.getRange(i+1,2).setValue(status === 'Active' ? 'Active' : 'Inactive');
    return {success:true};
  }
  throw new Error('Machine not found.');
}

function dateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0,10);
}
function allRolls_() {
  const v = getSheet_(APP.sheets.rolls).getDataRange().getValues();
  return v.slice(1).map((r,i) => ({
    row:i+2,id:String(r[0]),date:dateKey_(r[1]),machineNo:String(r[2]),
    shift:String(r[3]),programNo:String(r[4]),rollNo:String(r[5]),
    weight:Number(r[6])||0,condition:String(r[7]),enteredBy:String(r[8])
  }));
}
function canSeeRoll_(roll, user) {
  return user.role === 'Admin' || user.canViewOthers || roll.enteredBy === user.username;
}
function checkShift_(shift, user) {
  if (user.role !== 'Admin' && user.assignedShift !== 'All' && shift !== user.assignedShift)
    throw new Error('You are not allowed to use this shift.');
}
function getMachineData(machine, date, shift, token) {
  const user = requireUser_(token); checkShift_(shift,user);
  const list = allRolls_().filter(r => r.date===date && r.machineNo===String(machine) &&
    r.shift===String(shift) && canSeeRoll_(r,user));
  const today = allRolls_().filter(r => r.date===date && canSeeRoll_(r,user));
  const nums = list.map(r => parseInt(r.rollNo.replace('R',''),10)).filter(n=>n>0);
  const next = nums.length ? Math.max.apply(null,nums)+1 : 1;
  const programs = {};
  list.forEach(r => { if(!programs[r.programNo]) programs[r.programNo]=[]; programs[r.programNo].push(r.weight); });
  return {nextRoll:next<=10?'R'+next:'Full',
    todayTotal:today.reduce((a,r)=>a+r.weight,0).toFixed(2),
    totalWeight:list.reduce((a,r)=>a+r.weight,0).toFixed(2),
    enteredBy:list.length ? list[list.length-1].enteredBy : user.username,
    lastProgram:list.length ? list[list.length-1].programNo : '',
    programBreakdown:Object.keys(programs).map(k=>({program:k,weights:programs[k],total:programs[k].reduce((a,b)=>a+b,0).toFixed(2)}))};
}
function saveData(data, token) {
  const user = requireUser_(token);
  if (user.permission === 'ViewOnly') throw new Error('Your account is view-only.');
  checkShift_(String(data.shift),user);
  const date=String(data.date||''), machine=String(data.machineNo||'').trim(),
    shift=String(data.shift||''), program=String(data.programNo||'').trim(),
    weight=Number(data.weight);
  if (!date || !machine || !['A','B','C'].includes(shift) || !program || !(weight>0))
    throw new Error('Please enter all required fields correctly.');
  const existing=allRolls_().filter(r=>r.date===date && r.machineNo===machine && r.shift===shift);
  if (existing.length>=10) throw new Error('All 10 roll slots are already filled for this machine/shift/date.');
  const used=existing.map(r=>r.rollNo);
  let n=1; while(used.includes('R'+n) && n<=10)n++;
  if(n>10) throw new Error('No roll slot available.');
  const now=new Date(), id=Utilities.getUuid();
  getSheet_(APP.sheets.rolls).appendRow([id,date,machine,shift,program,'R'+n,weight,
    String(data.condition||'OK'),user.username,now,now]);
  return 'OK — saved as R'+n;
}
function getRollsForUpdate(date,machine,shift,token) {
  const user=requireUser_(token); checkShift_(shift,user);
  const rows=allRolls_().filter(r=>r.date===date && r.machineNo===String(machine) &&
    r.shift===String(shift) && canSeeRoll_(r,user));
  return {rolls:rows.map(r=>({rollId:r.id,rollNo:r.rollNo,weight:r.weight,condition:r.condition,programNo:r.programNo})),
    program:rows.length?rows[rows.length-1].programNo:''};
}
function updateRollData(data,token) {
  const user=requireUser_(token);
  if(user.permission==='ViewOnly') throw new Error('Your account is view-only.');
  checkShift_(data.shift,user);
  const sh=getSheet_(APP.sheets.rolls), rows=allRolls_();
  const target=rows.find(r=>r.id===String(data.rollId));
  if(!target || !canSeeRoll_(target,user)) throw new Error('Roll not found or access denied.');
  const w=Number(data.weight); if(!(w>0)) throw new Error('Weight must be greater than zero.');
  sh.getRange(target.row,5).setValue(String(data.programNo||target.programNo));
  sh.getRange(target.row,7).setValue(w);
  sh.getRange(target.row,8).setValue(String(data.condition||'OK'));
  sh.getRange(target.row,11).setValue(new Date());
  return 'OK — updated';
}
function deleteRoll(data,token) {
  const user=requireUser_(token);
  if(user.role!=='Admin' && user.permission!=='FullAccess') throw new Error('Delete permission denied.');
  checkShift_(data.shift,user);
  const sh=getSheet_(APP.sheets.rolls), target=allRolls_().find(r=>r.id===String(data.rollId));
  if(!target || !canSeeRoll_(target,user)) throw new Error('Roll not found or access denied.');
  sh.deleteRow(target.row);
  return 'OK — deleted';
}
function searchVlookupData(date,machine,shift,token) {
  const user=requireUser_(token); checkShift_(shift,user);
  const rows=allRolls_().filter(r=>r.date===date && r.machineNo===String(machine) &&
    r.shift===String(shift) && canSeeRoll_(r,user));
  if(!rows.length) return {found:false};
  const byRoll={}; rows.forEach(r=>byRoll[r.rollNo]=r);
  const rolls=[]; for(let i=1;i<=10;i++){
    const r=byRoll['R'+i]; rolls.push(r?{val:r.weight,bg:r.condition==='Reject'?'#ffdddd':r.condition==='Hold up'?'#fff0cc':'#e8f5e9',color:'#222',strike:r.condition==='Reject'?'line-through':'none'}:{val:'-',bg:'#fff',color:'#999',strike:'none'});
  }
  return {found:true,program:rows[rows.length-1].programNo,rolls:rolls,
    total:rows.reduce((a,r)=>a+r.weight,0).toFixed(2),enteredBy:rows[rows.length-1].enteredBy,shift:shift};
}
function getDailyReportData(date,shift,token) {
  const user=requireUser_(token);
  const rows=allRolls_().filter(r=>r.date===date && (shift==='All'||r.shift===shift) && canSeeRoll_(r,user));
  const groups={};
  rows.forEach(r=>{
    const key=[r.machineNo,r.shift,r.programNo].join('|');
    if(!groups[key])groups[key]={machine:r.machineNo,shift:r.shift,program:r.programNo,rolls:Array(10).fill(null),total:0,enteredBy:r.enteredBy};
    const n=parseInt(r.rollNo.replace('R',''),10)-1;
    if(n>=0&&n<10)groups[key].rolls[n]={val:r.weight,bg:r.condition==='Reject'?'#ffdddd':r.condition==='Hold up'?'#fff0cc':'#e8f5e9',color:'#222',strike:r.condition==='Reject'?'line-through':'none'};
    groups[key].total+=r.weight;
  });
  return Object.keys(groups).map(k=>{const g=groups[k];g.rolls=g.rolls.map(x=>x||{val:'-',bg:'#fff',color:'#999',strike:'none'});g.total=g.total.toFixed(2);return g;});
}
function getAllUsers(token) {
  requireAdmin_(token);
  return getSheet_(APP.sheets.users).getDataRange().getValues().slice(1).map(r=>({
    username:String(r[0]),status:String(r[3]),role:String(r[4]),
    canViewOthers:String(r[5])==='TRUE',permission:String(r[6]),assignedShift:String(r[7])
  }));
}
function saveUser(data,token) {
  requireAdmin_(token);
  const username=String(data.username||'').trim(), password=String(data.password||'');
  if(!username)throw new Error('Username required.');
  let user=userRecord_(username), sh=getSheet_(APP.sheets.users);
  if(!user && password.length<8)throw new Error('New user password must be at least 8 characters.');
  if(user){
    sh.getRange(user.row,4).setValue(data.status==='Active'?'Active':data.status==='Inactive'?'Inactive':'Pending');
    sh.getRange(user.row,5).setValue(data.role==='Admin'?'Admin':'Staff');
    sh.getRange(user.row,6).setValue(data.canViewOthers?'TRUE':'FALSE');
    sh.getRange(user.row,7).setValue(data.permission==='FullAccess'?'FullAccess':'ViewOnly');
    sh.getRange(user.row,8).setValue(['A','B','C','All'].includes(data.assignedShift)?data.assignedShift:'A');
    if(password){const salt=Utilities.getUuid().replace(/-/g,'');sh.getRange(user.row,2).setValue(salt);sh.getRange(user.row,3).setValue(hashPassword_(password,salt));}
  } else {
    const salt=Utilities.getUuid().replace(/-/g,'');
    sh.appendRow([username,salt,hashPassword_(password,salt),data.status==='Active'?'Active':'Pending',
      data.role==='Admin'?'Admin':'Staff',data.canViewOthers?'TRUE':'FALSE',
      data.permission==='FullAccess'?'FullAccess':'ViewOnly',
      ['A','B','C','All'].includes(data.assignedShift)?data.assignedShift:'A',new Date()]);
  }
  return 'User saved. Passwords are never displayed.';
}
function deleteUser(username,token) {
  requireAdmin_(token);
  if(String(username).toLowerCase()==='admin')throw new Error('The primary admin cannot be deleted.');
  const user=userRecord_(username); if(!user)throw new Error('User not found.');
  getSheet_(APP.sheets.users).deleteRow(user.row);
  return 'User deleted.';
}
