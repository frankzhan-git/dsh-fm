// 轻量语法高亮：按语言将代码切分为带 CSS 类名的 token 序列
// （正则分词，30+ 语言；构建期无依赖，纯字符串处理）
import { HL_LIMIT } from './constants.js'

export { HL_LIMIT }

const RE_LINE_SLASH = /\/\/[^\n]*/
const RE_LINE_HASH = /#[^\n]*/
const RE_LINE_DASH = /--[^\n]*/
const RE_BLOCK_C = /\/\*[\s\S]*?\*\//
const RE_BLOCK_HTML = /<!--[\s\S]*?-->/
const RE_STR = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/
const RE_NUM = /\b(?:\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?:px|%|em|rem|vh|vw|vmin|vmax|s|ms|deg|rad|fr|pt|ex|ch)?)\b/
const RE_FN = /[A-Za-z_$][\w$]*(?=\s*\()/
const RE_TAG = /<\/?[a-zA-Z][\w-]*/
const RE_ATTR = /[\w:-]+(?==)/

const JS_KW = ['const','let','var','function','return','if','else','for','while','do','switch','case','default','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','async','await','yield','import','export','from','try','catch','finally','throw','delete','void','null','undefined','true','false','static','get','set','interface','type','enum','implements','private','public','protected','readonly','abstract','namespace','declare','as','keyof','never','unknown','any','number','string','boolean','symbol','bigint','object','using','globalThis','NaN','Infinity']
const TS_EXTRA = ['as','type','interface','enum','implements','private','public','protected','readonly','abstract','namespace','declare','keyof','never','unknown','any','number','string','boolean','symbol','bigint','object','is','satisfies']
const C_KW = ['public','private','protected','static','final','class','interface','extends','implements','return','if','else','for','while','do','switch','case','default','break','continue','new','try','catch','finally','throw','throws','void','int','long','double','float','boolean','char','byte','short','this','super','package','import','abstract','native','synchronized','volatile','transient','instanceof','enum','const','sizeof','struct','union','typedef','extern','register','auto','true','false','null','namespace','using','template','typename','operator','virtual','override','constexpr','string','bool','unsigned','signed','goto','inline','restrict']
const GO_KW = ['func','package','import','var','const','type','struct','interface','map','chan','go','defer','return','if','else','for','range','switch','case','default','break','continue','fallthrough','select','new','make','len','cap','append','true','false','nil','error','panic','recover','goto','uint','int','int8','int16','int32','int64','uint8','uint16','uint32','uint64','float32','float64','string','bool','byte','rune','complex64','complex128']
const RS_KW = ['fn','let','mut','const','struct','enum','impl','trait','mod','use','pub','crate','self','Self','match','if','else','for','while','loop','return','break','continue','async','await','move','ref','type','where','dyn','static','unsafe','true','false','None','Some','Ok','Err','in','as','Box','Vec','String','Option','Result','i32','i64','u32','u64','f32','f64','usize','isize','bool','char','str']
const PY_KW = ['def','return','if','elif','else','for','while','import','from','class','try','except','finally','with','as','lambda','pass','break','continue','global','nonlocal','yield','assert','raise','in','is','not','and','or','None','True','False','async','await','del','self','print','len','range','dict','list','set','tuple','str','int','float','bool','object','type','super','match','case']
const RB_KW = ['def','end','if','elsif','else','unless','while','until','for','do','return','class','module','require','include','extend','begin','rescue','ensure','yield','true','false','nil','self','lambda','proc','case','when','then','new','super','break','next','redo','retry']
const PHP_KW = ['function','return','if','else','elseif','for','foreach','while','do','switch','case','default','break','continue','class','interface','extends','implements','namespace','use','public','private','protected','static','new','try','catch','finally','throw','echo','print','true','false','null','array','string','int','float','bool','isset','empty','require','include','abstract','final','global','const','var','list','unset']
const SH_KW = ['if','then','else','elif','fi','for','while','until','do','done','case','esac','function','return','local','export','source','alias','read','echo','exit','shift','test','true','false','set','unset','trap','exec','eval','select','in']
const SQL_KW = ['select','from','where','insert','into','values','update','set','delete','create','table','database','index','view','drop','alter','add','column','primary','key','foreign','references','join','inner','left','right','full','outer','on','group','by','order','having','limit','offset','union','all','distinct','as','and','or','not','null','is','in','like','between','exists','count','sum','avg','min','max','asc','desc','with','case','when','then','else','end','begin','commit','rollback','grant','revoke','procedure','function','trigger','constraint','default','unique','check','int','varchar','char','text','date','time','timestamp','boolean','bigint','smallint','decimal','float','double','numeric','coalesce','cast']
const PS_KW = ['function','param','return','if','else','elseif','foreach','for','while','switch','case','default','break','continue','try','catch','finally','throw','class','new','import','export','using','namespace','filter','begin','process','end','where','null','true','false','Get-Item','Get-ChildItem','Write-Host','Write-Output','Set-Content','Get-Content','Remove-Item','New-Item','Test-Path','Select-Object','Where-Object','ForEach-Object','Sort-Object','Get-Process','Start-Process','Stop-Process','Invoke-Command','Invoke-WebRequest','ConvertTo-Json','ConvertFrom-Json','Join-Path','Split-Path','Resolve-Path','Push-Location','Pop-Location','Set-Location','Get-Location','Out-File','Export-Csv','Import-Csv']

const LANG = {
  js: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: JS_KW },
  ts: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: JS_KW.concat(TS_EXTRA) },
  py: { cm: [RE_LINE_HASH], kw: PY_KW },
  c: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: C_KW },
  cs: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: C_KW.concat(['namespace','using','class','this','base','string','bool','int','double','float','decimal','var','as','is','null','true','false','new','return','if','else','foreach','in','public','private','protected','internal','static','void','readonly','sealed','abstract','override','virtual','async','await','event','delegate','interface','enum','struct','get','set','value','out','ref','params','lock','checked','unsafe','fixed']) },
  go: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: GO_KW },
  rs: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: RS_KW },
  rb: { cm: [RE_LINE_HASH], kw: RB_KW },
  php: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: PHP_KW },
  sh: { cm: [RE_LINE_HASH], kw: SH_KW },
  ps1: { cm: [RE_LINE_HASH], kw: PS_KW },
  sql: { cm: [RE_LINE_DASH], kw: SQL_KW },
  lua: { cm: [RE_LINE_DASH], kw: [] },
  r: { cm: [RE_LINE_HASH], kw: [] },
  html: { cm: [RE_BLOCK_HTML], kw: [], tags: true },
  css: { cm: [RE_BLOCK_C], kw: [] },
  json: { cm: [], kw: ['true','false','null'] },
  yaml: { cm: [RE_LINE_HASH], kw: ['true','false','null','yes','no','on','off'] },
  toml: { cm: [RE_LINE_HASH], kw: ['true','false'] },
  ini: { cm: [RE_LINE_HASH], kw: [] },
  gql: { cm: [], kw: ['query','mutation','subscription','fragment','on','type','interface','enum','scalar','input','implements','directive','schema','true','false','null','int','float','string','boolean','ID'] },
  text: { cm: [], kw: [] },
}

const EXT_LANG = {
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', tsx: 'ts',
  py: 'py', java: 'c', c: 'c', h: 'c', cpp: 'c', cc: 'c', cxx: 'c', hpp: 'c', cs: 'cs',
  go: 'go', rs: 'rs', rb: 'rb', php: 'php', sh: 'sh', bash: 'sh', zsh: 'sh', ps1: 'ps1',
  bat: 'text', cmd: 'text',
  html: 'html', htm: 'html', xml: 'html', vue: 'html', svelte: 'html',
  css: 'css', scss: 'css', less: 'css',
  json: 'json', jsonl: 'json', ndjson: 'json',
  yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'ini', properties: 'ini',
  sql: 'sql', graphql: 'gql',
  swift: 'c', kt: 'c', kts: 'c', kotlin: 'c', dart: 'c', zig: 'c', nim: 'c',
  scala: 'c', groovy: 'js', gradle: 'js', proto: 'c', cmake: 'r', ninja: 'r',
  lua: 'lua', r: 'r', pl: 'r', pm: 'r', ex: 'r', exs: 'r', clj: 'lua', hs: 'lua', erl: 'r',
  md: 'text', markdown: 'text', txt: 'text', log: 'text', lock: 'text', gitignore: 'text',
  csv: 'text', tsv: 'text', diff: 'text', patch: 'text', wasm: 'text',
  tex: 'text', rst: 'text', adoc: 'text', org: 'text',
}

const reCache = {}
const kwRe = (list) => '\\b(?:' + list.join('|') + ')\\b'

function buildRe(conf) {
  const alts = []
  for (const r of conf.cm || []) alts.push('(?<cm>' + r.source + ')')
  alts.push('(?<st>' + RE_STR.source + ')')
  if (conf.kw && conf.kw.length) alts.push('(?<kw>' + kwRe(conf.kw) + ')')
  alts.push('(?<nm>' + RE_NUM.source + ')')
  alts.push('(?<fn>' + RE_FN.source + ')')
  if (conf.tags) {
    alts.push('(?<tg>' + RE_TAG.source + ')')
    alts.push('(?<at>' + RE_ATTR.source + ')')
  }
  return new RegExp(alts.join('|'), 'g')
}

export function langFor(ext) { return LANG[EXT_LANG[ext] || 'text'] || LANG.text }

// 将代码切为 { t: 文本, c: 高亮类名（'' 表示普通文本）} 列表
export function tokenize(code, conf) {
  let re = reCache[conf]
  if (!re) { re = buildRe(conf); reCache[conf] = re }
  const out = []
  re.lastIndex = 0
  let last = 0
  let m
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ t: code.slice(last, m.index), c: '' })
    const g = m.groups || {}
    const cls = g.cm ? 'cm' : g.st ? 'st' : g.kw ? 'kw' : g.nm ? 'nm' : g.fn ? 'fn' : g.tg ? 'tg' : g.at ? 'at' : ''
    out.push({ t: m[0], c: cls })
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < code.length) out.push({ t: code.slice(last), c: '' })
  return out
}
