/* src/interpreter.js — Amit++ Interpreter core */
// Exposes window.AMIT_EXAMPLES and window.AmitppInterpreter.run(code)

window.AMIT_EXAMPLES = {
  "01_basic_math.aim": `// 01_basic_math.aim
// ভেরিয়েবল এবং গণিত অপারেশন
let a=10
let b=20
let sum=a+b
show "যোগফল='sum'"
show 'a*b'`,
  "02_loops.aim": `// 02_loops.aim
for i=1 to 5
  show "For লুপ i='i'"
end

let c=1
while c<=3
  show "While লুপ c='c'"
  let c=c+1
end`,
  "03_conditions.aim": `// 03_conditions.aim
let x=8
let y=5
if x>y
  show "x বড়"
else
  show "y বড়"
end`,
  "04_functions.aim": `// 04_functions.aim
def greet
  show "হ্যালো from function"
end
call greet`,
  "05_arrays.aim": `// 05_arrays.aim
let arr=[1,2,3,4]
show "arr[0]='arr[0]'"
let arr[2]=99
show "arr[2]='arr[2]'"`,
  "06_math_module.aim": `// 06_math_module.aim
import math
let r=5
show 'math.pi * r * r'`
};

(function(){
  function createRuntime() { return { vars:{}, files:{}, funcs:{}, output:[], error:null }; }

  function evalExpr(expr, runtime) {
    const vars = runtime.vars;
    const replacer = (match) => {
      if (/^\d+(\.\d+)?$/.test(match) || match === 'true' || match === 'false') return match;
      if (match.includes('.')) {
        const parts = match.split('.');
        const base = parts[0];
        if (!vars.hasOwnProperty(base)) return 'undefined';
        try {
          let val = vars[base];
          for (let p of parts.slice(1)) { val = val[p]; if (val === undefined) break; }
          if (typeof val === 'string') return JSON.stringify(val);
          return (val === undefined) ? 'undefined' : String(val);
        } catch { return 'undefined'; }
      }
      if (vars.hasOwnProperty(match)) {
        const v = vars[match];
        if (typeof v === 'string') return JSON.stringify(v);
        if (v === null || v === undefined) return 'undefined';
        return String(v);
      }
      return match;
    };

    const safe = expr.replace(/\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g, replacer);
    try { return Function('"use strict"; return (' + safe + ')')(); } 
    catch (e) { throw new Error('Invalid expression: ' + expr + ' — ' + e.message); }
  }

  function evaluateShowContent(raw, runtime) {
    raw = raw.trim();
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith("`") && raw.endsWith("`"))) {
      const expr = raw.slice(1, -1).trim();
      return String(evalExpr(expr, runtime));
    }
    if (raw.startsWith('"') && raw.endsWith('"')) {
      let inner = raw.slice(1, -1);
      inner = inner.replace(/'([^']+)'/g, (m, expr) => {
        try { return String(evalExpr(expr, runtime)); } catch { return 'undefined'; }
      });
      return inner;
    }
    try { return String(evalExpr(raw, runtime)); } catch { return raw; }
  }

  function getBlock(lines, startIndex) {
    const block = [];
    let depth = 0;
    for (let j = startIndex; j < lines.length; j++) {
      const L = lines[j].trim();
      if (/^(if |repeat |while |for |def )/.test(L)) depth++;
      if (L === 'end') {
        if (depth === 0) return {block, endIndex: j};
        depth--;
      } else {
        block.push(L);
      }
    }
    throw new Error("Missing 'end' for block starting at line " + (startIndex+1));
  }

  function runLines(lines, runtime) {
    let i = 0;
    while (i < lines.length) {
      let raw = lines[i];
      const lineNumber = i + 1;
      const line = raw.trim();
      if (!line || line.startsWith('//')) { i++; continue; }

      try {
        if (line.startsWith('let ')) {
          const rest = line.substring(4).trim();
          const eq = rest.indexOf('=');
          if (eq === -1) throw new Error('Invalid let, missing =');
          const lhs = rest.substring(0, eq).trim();
          const rhs = rest.substring(eq+1).trim();
          if (lhs.includes('[') && lhs.includes(']')) {
            const arrName = lhs.substring(0, lhs.indexOf('['));
            const idx = parseInt(lhs.match(/\[(\d+)\]/)[1], 10);
            if (!runtime.vars[arrName]) runtime.vars[arrName] = [];
            runtime.vars[arrName][idx] = evalExpr(rhs, runtime);
          } else if (rhs.startsWith('[') && rhs.endsWith(']')) {
            const json = rhs.replace(/'/g, '"');
            runtime.vars[lhs] = JSON.parse(json);
          } else {
            runtime.vars[lhs] = evalExpr(rhs, runtime);
          }
          i++; continue;
        }

        if (line.startsWith('get ')) {
          const varName = line.substring(4).trim();
          const val = prompt('Enter value for ' + varName + ':');
          runtime.vars[varName] = val === null ? '' : (isNaN(val) ? val : Number(val));
          i++; continue;
        }

        if (line.startsWith('show ')) {
          const rawContent = line.substring(5).trim();
          const val = evaluateShowContent(rawContent, runtime);
          runtime.output.push(String(val));
          i++; continue;
        }

        if (line.startsWith('file ')) {
          const rest = line.substring(5).trim();
          const [varName, fileExpr] = rest.split('=').map(s=>s.trim());
          const fname = fileExpr.replace(/"/g, '').replace(/'/g, '');
          runtime.vars[varName] = { filename: fname };
          if (!runtime.files[fname]) runtime.files[fname] = [];
          i++; continue;
        }

        if (line.startsWith('write ')) {
          const rest = line.substring(6).trim();
          const parts = rest.split(/\s+/);
          const fvar = parts[0];
          const startIndex = rest.indexOf(parts[1]);
          let text = rest.substring(startIndex).trim();
          text = text.replace(/^"|"$/g,'').replace(/^'|'$/g,'');
          const fname = runtime.vars[fvar] && runtime.vars[fvar].filename;
          if (!fname) throw new Error('File not open: ' + fvar);
          runtime.files[fname].push(text);
          i++; continue;
        }

        if (line.startsWith('read ')) {
          const fvar = line.substring(5).trim();
          const fname = runtime.vars[fvar] && runtime.vars[fvar].filename;
          if (!fname) throw new Error('File not open: ' + fvar);
          for (const l of runtime.files[fname]) runtime.output.push(String(l));
          i++; continue;
        }

        if (line.startsWith('close ')) {
          const fvar = line.substring(6).trim();
          delete runtime.vars[fvar];
          i++; continue;
        }

        if (line.startsWith('import ')) {
          const mod = line.substring(7).trim();
          if (mod === 'math') runtime.vars['math'] = Math;
          else throw new Error('No such module: ' + mod);
          i++; continue;
        }

        if (line.startsWith('if ')) {
          const condExpr = line.substring(3).trim();
          const {block, endIndex} = getBlock(lines, i+1);
          const elseIdx = block.findIndex(l => l === 'else');
          const thenBlock = elseIdx === -1 ? block : block.slice(0, elseIdx);
          const elseBlock = elseIdx === -1 ? [] : block.slice(elseIdx+1);
          const cond = !!evalExpr(condExpr, runtime);
          if (cond) runLines(thenBlock, runtime);
          else if (elseBlock.length) runLines(elseBlock, runtime);
          i = endIndex + 1;
          continue;
        }

        if (line.startsWith('repeat ')) {
          const times = parseInt(line.substring(7).trim(), 10);
          const {block, endIndex} = getBlock(lines, i+1);
          for (let k=0;k<times;k++) runLines(block, runtime);
          i = endIndex + 1; continue;
        }

        if (line.startsWith('while ')) {
          const condExpr = line.substring(6).trim();
          const {block, endIndex} = getBlock(lines, i+1);
          let safety = 100000;
          while (evalExpr(condExpr, runtime)) {
            runLines(block, runtime);
            if (--safety <= 0) throw new Error('Infinite loop suspected');
          }
          i = endIndex + 1; continue;
        }

        if (line.startsWith('for ')) {
          const body = line.substring(4).trim();
          if (/^\w+\=\s*\d+\s+to\s+\d+$/.test(body.replace(/\s+/g,' '))) {
            const parts = body.replace(/\s+/g,' ').split(/=| to /).map(s=>s.trim());
            const varName = parts[0];
            const start = Number(parts[1]);
            const endVal = Number(parts[2]);
            const {block, endIndex} = getBlock(lines, i+1);
            for (let k = start; k <= endVal; k++) { runtime.vars[varName] = k; runLines(block, runtime); }
            i = endIndex + 1; continue;
          } else {
            const parts = body.split(';').map(s=>s.trim());
            if (parts.length !== 3) throw new Error('Invalid for syntax');
            runLines([parts[0]], runtime);
            const {block, endIndex} = getBlock(lines, i+1);
            let safety = 100000;
            while (evalExpr(parts[1], runtime)) {
              runLines(block, runtime);
              runLines([parts[2]], runtime);
              if (--safety<=0) throw new Error('Infinite for-loop suspected');
            }
            i = endIndex + 1; continue;
          }
        }

        if (line.startsWith('def ')) {
          const fname = line.substring(4).trim();
          const {block, endIndex} = getBlock(lines, i+1);
          runtime.funcs[fname] = block.slice();
          i = endIndex + 1; continue;
        }

        if (line.startsWith('call ')) {
          const fname = line.substring(5).trim();
          const fn = runtime.funcs[fname];
          if (!fn) throw new Error('Function not defined: ' + fname);
          runLines(fn.slice(), runtime);
          i++; continue;
        }

        throw new Error('Unknown command: ' + line);
      } catch (err) {
        runtime.error = { message: err.message || String(err), line: lineNumber, text: line };
        return;
      }
    }
  }

  window.AmitppInterpreter = {
    run: function(codeText) {
      const lines = codeText.split(/\r?\n/);
      const runtime = createRuntime();
      runLines(lines, runtime);
      return { output: runtime.output, error: runtime.error };
    }
  };
})();