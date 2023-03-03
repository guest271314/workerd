// Copyright (c) 2017-2022 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
//
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

/* todo: the following is adopted code, enabling linting one day */
/* eslint-disable */

import {
  Readable,
  from,
} from 'node-internal:streams_readable';

import {
  Writable,
} from 'node-internal:streams_writable';

import {
  createDeferredPromise,
} from 'node-internal:internal_utils';

import {
  Duplex,
  DuplexOptions,
  WriteCallback,
  destroyer,
  eos,
  isReadable,
  isWritable,
  isIterable,
  isNodeStream,
  isReadableNodeStream,
  isWritableNodeStream,
  isDuplexNodeStream,
  DestroyCallback,
} from 'node-internal:streams_util';

import {
  AbortError,
  ERR_INVALID_ARG_TYPE,
  ERR_INVALID_RETURN_VALUE,
} from 'node-internal:internal_errors';

Object.setPrototypeOf(Duplex.prototype, Readable.prototype);
Object.setPrototypeOf(Duplex, Readable);
{
  const keys = Object.keys(Writable.prototype);
  // Allow the keys array to be GC'ed.
  for (let i = 0; i < keys.length; i++) {
    const method = keys[i]!;
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

export function isDuplexInstance(obj: unknown) {
  return obj instanceof Duplex;
}

export function Duplex(this: Duplex, options?: DuplexOptions) {
  if (!(this instanceof Duplex)) return new (Duplex as any)(options);
  Readable.call(this, options);
  Writable.call(this, options);
  if (options) {
    this.allowHalfOpen = options.allowHalfOpen !== false;
    if (options.readable === false) {
      this._readableState.readable = false;
      this._readableState.ended = true;
      this._readableState.endEmitted = true;
    }
    if (options.writable === false) {
      this._writableState.writable = false;
      this._writableState.ending = true;
      this._writableState.ended = true;
      this._writableState.finished = true;
    }
  } else {
    this.allowHalfOpen = true;
  }
}
Object.defineProperties(Duplex.prototype, {
  writable: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writable')
  },
  writableHighWaterMark: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableHighWaterMark')
  },
  writableObjectMode: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableObjectMode')
  },
  writableBuffer: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableBuffer')
  },
  writableLength: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableLength')
  },
  writableFinished: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableFinished')
  },
  writableCorked: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableCorked')
  },
  writableEnded: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableEnded')
  },
  writableNeedDrain: {
    ...Object.getOwnPropertyDescriptor(Writable.prototype, 'writableNeedDrain')
  },
  destroyed: {
    get(this: Duplex) {
      if (this._readableState === undefined || this._writableState === undefined) {
        return false
      }
      return this._readableState.destroyed && this._writableState.destroyed
    },
    set(this: Duplex, value: boolean) {
      // Backward compatibility, the user is explicitly
      // managing destroyed.
      if (this._readableState && this._writableState) {
        this._readableState.destroyed = value
        this._writableState.destroyed = value
      }
    }
  }
});

// let webStreamsAdapters

// // Lazy to avoid circular references
// function lazyWebStreams() {
//   if (webStreamsAdapters === undefined) webStreamsAdapters = {}
//   return webStreamsAdapters
// }
// Duplex.fromWeb = function (pair, options) {
//   return lazyWebStreams().newStreamDuplexFromReadableWritablePair(pair, options)
// }
// Duplex.toWeb = function (duplex) {
//   return lazyWebStreams().newReadableWritablePairFromDuplex(duplex)
// }

// ======================================================================================

Duplex.from = function (body: unknown) {
  return duplexify(body, 'body')
}

function isBlob(b: unknown) {
  return b instanceof Blob;
}

// This is needed for pre node 17.
class Duplexify extends (Duplex as any) {
  constructor(options: DuplexOptions) {
    super(options);
    // https://github.com/nodejs/node/pull/34385

    if ((options === null || options === undefined ? undefined : options.readable) === false) {
      this['_readableState'].readable = false;
      this['_readableState'].ended = true;
      this['_readableState'].endEmitted = true;
    }
    if ((options === null || options === undefined ? undefined : options.writable) === false) {
      this['_readableState'].writable = false;
      this['_readableState'].ending = true;
      this['_readableState'].ended = true;
      this['_readableState'].finished = true;
    }
  }
}

function duplexify(body: any, name: string) : Duplex {
  if (isDuplexNodeStream(body)) {
    return body;
  }
  if (isReadableNodeStream(body)) {
    return _duplexify({
      readable: body
    }) as Duplex;
  }
  if (isWritableNodeStream(body)) {
    return _duplexify({
      writable: body
    }) as Duplex;
  }
  if (isNodeStream(body)) {
    return _duplexify({
      writable: false,
      readable: false
    }) as Duplex;
  }

  // TODO: Webstreams
  // if (isReadableStream(body)) {
  //   return _duplexify({ readable: Readable.fromWeb(body) });
  // }

  // TODO: Webstreams
  // if (isWritableStream(body)) {
  //   return _duplexify({ writable: Writable.fromWeb(body) });
  // }

  if (typeof body === 'function') {
    const { value, write, final, destroy } = fromAsyncGen(body)
    if (isIterable(value)) {
      return from(Duplexify, value, {
        // TODO (ronag): highWaterMark?
        objectMode: true,
        write,
        final,
        destroy
      } as DuplexOptions);
    }
    const then = (value as any)?.then;
    if (typeof then === 'function') {
      let d: any;
      const promise = Reflect.apply(then, value, [
        (val: any) => {
          if (val != null) {
            throw new ERR_INVALID_RETURN_VALUE('nully', 'body', val)
          }
        },
        (err: any) => {
          destroyer(d, err)
        }
      ]);

      return (d = new Duplexify({
        // TODO (ronag): highWaterMark?
        objectMode: true,
        readable: false,
        write,
        final(cb) {
          final(async () => {
            try {
              await promise
              queueMicrotask(() => cb!(null));
            } catch (err) {
              queueMicrotask(() => cb!(err));
            }
          })
        },
        destroy
      } as DuplexOptions)) as Duplex;
    }
    throw new ERR_INVALID_RETURN_VALUE('Iterable, AsyncIterable or AsyncFunction', name, value)
  }
  if (isBlob(body)) {
    return duplexify(body.arrayBuffer(), name);
  }
  if (isIterable(body)) {
    return from(Duplexify, body, {
      // TODO (ronag): highWaterMark?
      objectMode: true,
      writable: false
    } as DuplexOptions)
  }

  // TODO: Webstreams.
  // if (
  //   isReadableStream(body?.readable) &&
  //   isWritableStream(body?.writable)
  // ) {
  //   return Duplexify.fromWeb(body);
  // }

  if (
    typeof (body === null || body === undefined ? undefined : body.writable) === 'object' ||
    typeof (body === null || body === undefined ? undefined : body.readable) === 'object'
  ) {
    const readable =
      body !== null && body !== undefined && body.readable
        ? isReadableNodeStream(body === null || body === undefined ? undefined : body.readable)
          ? body === null || body === undefined
            ? undefined
            : body.readable
          : duplexify(body.readable, name)
        : undefined;
    const writable =
      body !== null && body !== undefined && body.writable
        ? isWritableNodeStream(body === null || body === undefined ? undefined : body.writable)
          ? body === null || body === undefined
            ? undefined
            : body.writable
          : duplexify(body.writable, name)
        : undefined;
    return _duplexify({
      readable,
      writable
    }) as Duplex;
  }
  const then = body?.then
  if (typeof then === 'function') {
    let d: any;
    Reflect.apply(then, body, [
      (val: any) => {
        if (val != null) {
          d.push(val);
        }
        d.push(null);
      },
      (err: any) => {
        destroyer(d, err);
      }
    ]);

    return (d = new Duplexify({
      objectMode: true,
      writable: false,
      read() {}
    })) as Duplex;
  }
  throw new ERR_INVALID_ARG_TYPE(
    name,
    [
      'Blob',
      'ReadableStream',
      'WritableStream',
      'Stream',
      'Iterable',
      'AsyncIterable',
      'Function',
      '{ readable, writable } pair',
      'Promise'
    ],
    body
  )
}

function fromAsyncGen(fn: (...args: unknown[]) => unknown) {
  let { promise, resolve } = createDeferredPromise()
  const ac = new AbortController()
  const signal = ac.signal
  const value = fn(
    (async function* () {
      while (true) {
        const _promise = promise;
        promise = null!;
        const { chunk, done, cb } = (await _promise) as any
        queueMicrotask(cb);
        if (done) return;
        if (signal.aborted)
          throw new AbortError(undefined, {
            cause: signal.reason
          });
        ({ promise, resolve } = createDeferredPromise());
        yield chunk;
      }
    })(),
    {
      signal
    }
  );
  return {
    value,
    write(chunk: any, _encoding: string|null, cb: WriteCallback) {
      const _resolve = resolve;
      resolve = null!;
      (_resolve as any)({
        chunk,
        done: false,
        cb
      })
    },
    final(cb: (err?: any) => unknown) {
      const _resolve = resolve;
      resolve = null!;
      (_resolve as any)({
        done: true,
        cb
      });
    },
    destroy(err: any, cb?: DestroyCallback) {
      ac.abort();
      cb!(err);
    }
  }
}

function _duplexify(pair: any) {
  const r = pair.readable && typeof pair.readable.read !== 'function' ? (Readable as any).wrap(pair.readable) : pair.readable;
  const w = pair.writable;
  let readable = !!isReadable(r);
  let writable = !!isWritable(w);
  let ondrain: any;
  let onfinish: any;
  let onreadable: any;
  let onclose: any;
  let d: any
  function onfinished(err: any) {
    const cb = onclose
    onclose = null
    if (cb) {
      cb(err)
    } else if (err) {
      d.destroy(err)
    } else if (!readable && !writable) {
      d.destroy()
    }
  }

  // TODO(ronag): Avoid double buffering.
  // Implement Writable/Readable/Duplex traits.
  // See, https://github.com/nodejs/node/pull/33515.
  d = new Duplexify({
    // TODO (ronag): highWaterMark?
    readableObjectMode: !!(r !== null && r !== undefined && r.readableObjectMode),
    writableObjectMode: !!(w !== null && w !== undefined && w.writableObjectMode),
    readable,
    writable
  });
  if (writable) {
    eos(w, (err) => {
      writable = false;
      if (err) {
        destroyer(r, err);
      }
      onfinished(err);
    });
    d._write = function (chunk: any, encoding: string|undefined|null, callback: WriteCallback) {
      if (w.write(chunk, encoding)) {
        callback();
      } else {
        ondrain = callback;
      }
    };
    d._final = function (callback: (err?: any) => unknown) {
      w.end();
      onfinish = callback;
    };
    w.on('drain', function () {
      if (ondrain) {
        const cb = ondrain;
        ondrain = null;
        cb();
      }
    });
    w.on('finish', function () {
      if (onfinish) {
        const cb = onfinish;
        onfinish = null;
        cb();
      }
    });
  }
  if (readable) {
    eos(r, (err) => {
      readable = false;
      if (err) {
        destroyer(r, err);
      }
      onfinished(err);
    });
    r.on('readable', function () {
      if (onreadable) {
        const cb = onreadable;
        onreadable = null;
        cb();
      }
    });
    r.on('end', function () {
      d.push(null);
    });
    d._read = function () {
      while (true) {
        const buf = r.read();
        if (buf === null) {
          onreadable = d._read;
          return;
        }
        if (!d.push(buf)) {
          return;
        }
      }
    };
  }
  d._destroy = function (err?: any, callback?: DestroyCallback) {
    if (!err && onclose !== null) {
      err = new AbortError();
    }
    onreadable = null;
    ondrain = null;
    onfinish = null;
    if (onclose === null) {
      callback!(err);
    } else {
      onclose = callback;
      destroyer(w, err);
      destroyer(r, err);
    }
  }
  return d;
}
