
const STORAGE_KEY = "bprod_data_v1";
function todayKey(ts = Date.now()){ return new Date(ts).toISOString().slice(0,10); }
function getAllData(){ return new Promise(res => chrome.storage.local.get([STORAGE_KEY], d => res(d[STORAGE_KEY] || {}))); }
function setAllData(obj){ const payload={}; payload[STORAGE_KEY]=obj; return new Promise(res => chrome.storage.local.set(payload, ()=>res())); }
