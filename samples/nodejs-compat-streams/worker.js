import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';

export default {
  async fetch(request) {
    let res;
    const promise = new Promise((r) => res = r);

    const readable = new Readable({
      encoding: 'utf8',
      read(size) {
        queueMicrotask(() => this.push(Buffer.from("hello ")));
        queueMicrotask(() => this.push(Buffer.from("from ")));
        queueMicrotask(() => this.push(Buffer.from("the ")));
        queueMicrotask(() => this.push(Buffer.from("wonderful ")));
        queueMicrotask(() => this.push(Buffer.from("world ")));
        queueMicrotask(() => this.push(Buffer.from("of ")));
        queueMicrotask(() => this.push(Buffer.from("node.js ")));
        queueMicrotask(() => this.push(Buffer.from("streams!")));
        queueMicrotask(() => this.push(null));
      }
    });

    let ret = '';
    readable.on('data', (chunk) => ret += chunk);
    readable.on('end', () => {
      res(new Response(ret));
    });

    return promise;
  }
};
