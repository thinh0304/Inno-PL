// Chạy một Code step như bộ chạy của AgentFlow (skill agentflow-app-authoring, workflows.md "Test `main` offline").
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Đọc một input mà step không khai báo thì ném lỗi, như trên AgentFlow.
const strict = (data: Record<string, unknown>) =>
  new Proxy(data, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol' || ['then', 'toJSON', 'constructor'].includes(prop) || Object.hasOwn(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }
      throw new Error(`no input named '${prop}'. Declared inputs on this step: ${Object.keys(target).join(', ')}`);
    },
  });

export async function runCode(file: string, inputs: Record<string, unknown>, context: Record<string, unknown> = {}) {
  const source = fs.readFileSync(path.join(import.meta.dirname, '../../config/code', file), 'utf8');
  const realm = vm.createContext({
    console, process, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, URL, TextEncoder, TextDecoder,
  });
  vm.runInContext(source, realm, { filename: file });
  const main = vm.runInContext("typeof main === 'function' ? main : undefined", realm);
  const answer = await main(strict(JSON.parse(JSON.stringify(inputs))), strict(context));
  return JSON.parse(JSON.stringify(answer));
}
