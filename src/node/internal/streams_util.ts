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

export const kDestroyed = Symbol('kDestroyed');
export const kIsErrored = Symbol('kIsErrored');
export const kIsReadable = Symbol('kIsReadable');
export const kIsDisturbed = Symbol('kIsDisturbed');
export const kPaused = Symbol('kPaused');
export const kOnFinished = Symbol('kOnFinished');
export const kDestroy = Symbol('kDestroy');
export const kConstruct = Symbol('kConstruct');

import {
  EventEmitter,
  EventEmitterOptions,
} from 'node-internal:events';

import {
  AbortError,
  ERR_INVALID_ARG_TYPE,
  ERR_INVALID_ARG_VALUE,
  ERR_STREAM_PREMATURE_CLOSE,
  ERR_MULTIPLE_CALLBACK,
  aggregateTwoErrors,
} from 'node-internal:internal_errors';

import { Buffer } from 'node-internal:internal_buffer';
import { StringDecoder } from 'node-internal:internal_stringdecoder';

import {
  validateAbortSignal,
  validateFunction,
  validateObject,
} from 'node-internal:validators';

export interface NodeStreamState {
  autoDestroy: boolean;
  closed: boolean;
  constructed: boolean;
  closeEmitted: boolean;
  defaultEncoding: string;
  destroyed: boolean;
  emitClose: boolean;
  encoding: string|null;
  ended: boolean;
  errored: boolean|null;
  errorEmitted: boolean;
  highWaterMark: number;
  length: number;
  objectMode: boolean;
  sync: boolean;
};

export interface ReadableState extends NodeStreamState {
  readonly pipesCount: number;
  paused: boolean;
  awaitDrainWriters: null|Writable|Set<Writable>;
  buffer: BufferList;
  dataEmitted: boolean;
  decoder: StringDecoder|null;
  endEmitted: boolean;
  flowing: boolean|null;
  pipes: NodeStream[];
  readable: boolean;
  reading: boolean;
  multiAwaitDrain: boolean;
  needReadable: boolean;
  emittedReadable: boolean;
  readingMore: boolean;
  readableListening: boolean;
  resumeScheduled: boolean;
  [kPaused]: boolean|null;
  new (options: ReadableOptions|null|undefined,
       stream: Readable,
       isDuplex: boolean) : ReadableState;
};

export type AfterWriteTickInfo = {
  stream: Writable,
  state: WritableState,
  count: number,
  cb: WriteCallback
};

export interface WritableState extends NodeStreamState {
  readonly bufferedRequestCount: number;
  getBuffer() : any[];
  decodeStrings: boolean;
  ending: boolean;
  finalCalled: boolean;
  finished: boolean;
  prefinished: boolean;
  needDrain: boolean;
  writable: boolean;
  writing: boolean;
  corked: number;
  bufferProcessing: boolean;
  onwrite: (err?: any) => void;
  writecb: ((this: Writable, chunk: any, encoding?: string, cb?: (err?: any) => void) => void) | null;
  writelen: number;
  afterWriteTickInfo: AfterWriteTickInfo | null;
  pendingcb: number;
  buffered: any[];
  bufferedIndex: number;
  allBuffers: boolean;
  allNoop: boolean;
  [kOnFinished]: ((...args: unknown[]) => unknown)[];
  new (options: WritableOptions,
       stream: Writable,
       isDuplex: boolean) : WritableState;
};

export type DestroyCallback = (err?: any) => unknown;

export type PipeOptions = {
  end?: boolean;
  signal?: AbortSignal;
};

export interface NodeStream extends EventEmitter {
  readonly closed: boolean;
  destroyed: boolean;
  readonly errored: boolean;
  [kDestroyed]: boolean;
  [kIsErrored]: boolean;
  _destroy(err?: any, cb?: DestroyCallback|null): void;
  destroy(err?: any, cb?: DestroyCallback|null): this;
  pipe(dest: NodeStream, options?: PipeOptions|null) : NodeStream;
  _undestroy(): void;
  _construct(cb?: (...args: unknown[]) => any): void;
};

export interface ReadableOptions extends HighWaterMarkOptions, EventEmitterOptions {
  autoDestroy?: boolean;
  defaultEncoding?: string;
  emitClose?: boolean;
  encoding?: string;
  objectMode?: boolean;
  readableObjectMode?: boolean;
  signal?: AbortSignal;
  construct?: (cb?: (...args: unknown[]) => unknown) => void;
  destroy?: (err?: any) => void;
  read?: (size?: number) => void;
};

export type ComposableType = NodeStream | Iterable<any> | AsyncIterable<any> | Function;

export type OperatorOptions = {
  concurrency?: number;
  signal?: AbortSignal;
};

export type NonConcurrentOperatorOptions = {
  signal?: AbortSignal;
};

export type MapFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type SomeFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type EveryFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type FindFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type ForEachFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type FilterFunction = (data: any, options: { signal?: AbortSignal }) => unknown;
export type ReducerFunction = (previous: any, data: any, options: { signal?: AbortSignal }) => unknown;
export type FlatMapFunction = (data: any, options: { signal?: AbortSignal }) => unknown;

export interface Readable extends NodeStream, AsyncIterable<any> {
  _readableState: ReadableState;
  readonly objectMode: boolean;
  readable: boolean;
  readonly readableAborted: boolean;
  readonly readableBuffer?: BufferList;
  readonly readableDidRead: boolean;
  readonly readableEncoding: string|null;
  readonly readableEnded: boolean;
  readonly readableErrored: boolean;
  readableFlowing: boolean;
  readonly readableHighWaterMark?: number;
  readonly readableLength: number;
  readonly readableObjectMode: boolean;
  readonly [kIsDisturbed]: boolean;
  readonly [kIsReadable]: boolean;
  isPaused(): boolean;
  setEncoding(enc: string): this;
  pause() : void;
  push(chunk: any): boolean;
  push(chunk: string, encoding?: string|null): boolean;
  unshift(chunk: any): boolean;
  unshift(chunk: string, encoding?: string|null): boolean;
  read(n?: number|null): any;
  resume() : void;
  unpipe(dest: Writable): this;
  wrap(stream: Readable): Readable;
  _read(n?: number): any;
  compose(...streams: ComposableType[]): Duplex;
  map(fn: MapFunction, options?: OperatorOptions): Readable;
  filter(fn: FilterFunction, options?: OperatorOptions): Readable;
  forEach(fn: ForEachFunction, options?: OperatorOptions): Promise<any>;
  toArray(options?: NonConcurrentOperatorOptions): Promise<any[]>;
  some(fn: SomeFunction, options?: OperatorOptions): Promise<boolean>;
  find(fn: FindFunction, options?: OperatorOptions): Promise<any>;
  every(fn: EveryFunction, options?: OperatorOptions): Promise<boolean>;
  flatMap(fn: FlatMapFunction, options?: OperatorOptions): Readable;
  drop(number: number, options?: NonConcurrentOperatorOptions): Readable;
  take(number: number, options?: NonConcurrentOperatorOptions): Readable;
  asIndexedPairs(options?: OperatorOptions): Readable;
  reduce(fn: ReducerFunction, initial: any, options?: NonConcurrentOperatorOptions): Promise<any>;
  new (options?: ReadableOptions) : Readable;
};

export interface HighWaterMarkOptions {
  highWaterMark?: number|null;
};

export interface WritableOptions extends HighWaterMarkOptions, EventEmitterOptions {
  emitClose?: boolean;
  autoDestroy?: boolean;
  decodeStrings?: boolean;
  defaultEncoding?: string;
  encoding?: string;
  objectMode?: boolean;
  writableObjectMode?: boolean;
  signal?: AbortSignal;
  write?: (chunk: any, encoding: string|undefined|null, cb: WriteCallback) => void;
  writev?: (chunk: any[], cb: WriteCallback) => void;
  destroy?: (err?: any) => void;
  final?: (cb?: (err?: any) => void) => void;
  construct?: (this: Writable, cb?: (...args: unknown[]) => unknown) => void;
};

export type WriteCallback = (err?: any) => void;

export interface Writable extends NodeStream {
  _writableState: WritableState;
  writable: boolean;
  readonly writableAborted: boolean;
  readonly writableBuffer?: any[];
  readonly writableCorked: number;
  readonly writableEnded: boolean;
  readonly writableErrored: boolean;
  readonly writableFinished: boolean;
  readonly writableHighWaterMark?: number;
  readonly writableLength?: number;
  readonly writableNeedDrain: boolean;
  readonly writableObjectMode: boolean;
  [Symbol.hasInstance](obj: any): boolean;
  setDefaultEncoding(encoding: string|null): this;
  cork(): void;
  uncork(): void;
  end(chunk?: any, cb?: WriteCallback|null) : void;
  write(chunk: any, cb?: WriteCallback|null) : boolean;
  write(chunk: string, encoding?: string|null, cb?: WriteCallback|null): boolean;
  _write(chunk: any, encoding: string|undefined|null, cb: WriteCallback): void;
  _writev(chunk: any[], cb: WriteCallback): void;
  _final?: (cb?: (err?: any) => void) => void;
  new (options?: WritableOptions) : Writable;
};

export interface DuplexOptions extends WritableOptions, ReadableOptions {
  allowHalfOpen?: boolean;
  readable?: boolean;
  writable?: boolean;
  readableHighWaterMark?: number;
  writableHighWaterMark?: number;
};

export interface Duplex extends Readable, Writable {
  allowHalfOpen: boolean;
  readonly readableObjectMode: boolean;
  readonly writableObjectMode: boolean;
  new (options?: DuplexOptions): Duplex;
};

export function isReadableNodeStream(obj: unknown, strict = false) {
  let _obj$_readableState;
  return !!(
    (
      obj &&
      typeof (obj as NodeStream).pipe === 'function' &&
      typeof (obj as EventEmitter).on === 'function' &&
      (!strict || (typeof (obj as Readable).pause === 'function' &&
                   typeof (obj as Readable).resume === 'function')) &&
      (!(obj as Duplex)._writableState ||
        ((_obj$_readableState = (obj as Readable)._readableState) === null ||
          _obj$_readableState === undefined ? undefined
            : _obj$_readableState.readable) !== false) &&
      // Duplex
      (!(obj as Duplex)._writableState || (obj as Readable)._readableState)
    ) // Writable has .pipe.
  );
}

export function isWritableNodeStream(obj: unknown) {
  let _obj$_writableState;
  return !!(
    (
      obj &&
      typeof (obj as Writable).write === 'function' &&
      typeof (obj as EventEmitter).on === 'function' &&
      (!(obj as Duplex)._readableState ||
        ((_obj$_writableState = (obj as Writable)._writableState) === null ||
          _obj$_writableState === undefined ? undefined
            : _obj$_writableState.writable) !== false)
    ) // Duplex
  );
}

export function isDuplexNodeStream(obj: unknown) {
  return !!(
    obj &&
    typeof (obj as NodeStream).pipe === 'function' &&
    (obj as Duplex)._readableState &&
    typeof (obj as EventEmitter).on === 'function' &&
    typeof (obj as Writable).write === 'function'
  );
}

export function isNodeStream(obj: unknown) {
  return (
    obj &&
    ((obj as Readable)._readableState ||
      (obj as Writable)._writableState ||
      (typeof (obj as Writable).write === 'function' &&
       typeof (obj as EventEmitter).on === 'function') ||
      (typeof (obj as NodeStream).pipe === 'function' &&
       typeof (obj as EventEmitter).on === 'function'))
  );
}

export function isIterable(obj: any, isAsync = false) {
  if (obj == null) return false;
  if (isAsync === true) return typeof obj[Symbol.asyncIterator] === 'function';
  if (isAsync === false) return typeof obj[Symbol.iterator] === 'function';
  return typeof obj[Symbol.asyncIterator] === 'function' ||
         typeof obj[Symbol.iterator] === 'function';
}

export function isDestroyed(stream: NodeStream) {
  if (!isNodeStream(stream)) return null;
  const wState = (stream as Writable)._writableState;
  const rState = (stream as Readable)._readableState;
  const state = wState || rState;
  return !!(stream.destroyed || stream[kDestroyed] || (state !== null && state !== undefined && state.destroyed));
}

export function isWritableEnded(stream: Writable) {
  if (!isWritableNodeStream(stream)) return null;
  if (stream.writableEnded === true) return true;
  const wState = stream._writableState;
  if (wState !== null && wState !== undefined && wState.errored) return false;
  if (typeof (wState === null || wState === undefined ? undefined : wState.ended) !== 'boolean') return null;
  return wState.ended;
}

export function isWritableFinished(stream: Writable, strict = false) {
  if (!isWritableNodeStream(stream)) return null;
  if (stream.writableFinished === true) return true;
  const wState = stream._writableState;
  if (wState !== null && wState !== undefined && wState.errored) return false;
  if (typeof (wState === null || wState === undefined ? undefined : wState.finished) !== 'boolean') return null;
  return !!(wState.finished || (strict === false && wState.ended === true && wState.length === 0));
}

export function isReadableEnded(stream: Readable) {
  if (!isReadableNodeStream(stream)) return null;
  if (stream.readableEnded === true) return true;
  const rState = stream._readableState;
  if (!rState || rState.errored) return false;
  if (typeof (rState === null || rState === undefined ? undefined : rState.ended) !== 'boolean') return null;
  return rState.ended;
}

export function isReadableFinished(stream: Readable, strict = false) {
  if (!isReadableNodeStream(stream)) return null;
  const rState = stream._readableState;
  if (rState !== null && rState !== undefined && rState.errored) return false;
  if (typeof (rState === null || rState === undefined ? undefined : rState.endEmitted) !== 'boolean') return null;
  return !!(rState.endEmitted || (strict === false && rState.ended === true && rState.length === 0));
}

export function isReadable(stream: Readable) {
  if (stream && stream[kIsReadable] != null) return stream[kIsReadable];
  if (typeof (stream === null || stream === undefined ? undefined : stream.readable) !== 'boolean') return null;
  if (isDestroyed(stream)) return false;
  return isReadableNodeStream(stream) && stream.readable && !isReadableFinished(stream);
}

export function isWritable(stream: Writable) {
  if (typeof (stream === null || stream === undefined ? undefined : stream.writable) !== 'boolean') return null;
  if (isDestroyed(stream)) return false;
  return isWritableNodeStream(stream) && stream.writable && !isWritableEnded(stream);
}

export function isFinished(stream: NodeStream, opts: { readable?: boolean, writable?: boolean } = {}) {
  if (!isNodeStream(stream)) {
    return null;
  }
  if (isDestroyed(stream)) {
    return true;
  }
  if ((opts === null || opts === undefined ? undefined : opts.readable) !== false &&
       isReadable(stream as Readable)) {
    return false;
  }
  if ((opts === null || opts === undefined ? undefined : opts.writable) !== false &&
       isWritable(stream as Writable)) {
    return false;
  }
  return true;
}

export function isWritableErrored(stream: Writable) {
  let _stream$_writableStat, _stream$_writableStat2;
  if (!isNodeStream(stream)) {
    return null;
  }
  if (stream.writableErrored) {
    return stream.writableErrored;
  }
  return (_stream$_writableStat =
    (_stream$_writableStat2 = stream._writableState) === null || _stream$_writableStat2 === undefined
      ? undefined
      : _stream$_writableStat2.errored) !== null && _stream$_writableStat !== undefined
    ? _stream$_writableStat
    : null;
}

export function isReadableErrored(stream: Readable) {
  let _stream$_readableStat, _stream$_readableStat2;
  if (!isNodeStream(stream)) {
    return null;
  }
  if (stream.readableErrored) {
    return stream.readableErrored;
  }
  return (_stream$_readableStat =
    (_stream$_readableStat2 = stream._readableState) === null || _stream$_readableStat2 === undefined
      ? undefined
      : _stream$_readableStat2.errored) !== null && _stream$_readableStat !== undefined
    ? _stream$_readableStat
    : null;
}

export function isClosed(stream: NodeStream) {
  if (!isNodeStream(stream)) {
    return null
  }
  if (typeof stream.closed === 'boolean') {
    return stream.closed
  }
  const wState = (stream as Writable)._writableState
  const rState = (stream as Readable)._readableState
  if (
    typeof (wState === null || wState === undefined ? undefined : wState.closed) === 'boolean' ||
    typeof (rState === null || rState === undefined ? undefined : rState.closed) === 'boolean'
  ) {
    return (
      (wState === null || wState === undefined ? undefined : wState.closed) ||
      (rState === null || rState === undefined ? undefined : rState.closed)
    )
  }
  if (typeof (stream as any)._closed === 'boolean' && isOutgoingMessage(stream)) {
    return (stream as any)._closed
  }
  return null
}

// TODO(later): We do not actually support OutgoingMessage yet. Might not ever?
// Keeping this here tho just to keep things simple.
export function isOutgoingMessage(stream : any) {
  return (
    typeof stream._closed === 'boolean' &&
    typeof stream._defaultKeepAlive === 'boolean' &&
    typeof stream._removedConnection === 'boolean' &&
    typeof stream._removedContLen === 'boolean'
  );
}

// TODO(later): We do not actually support Server Response yet. Might not ever?
// Keeping this here tho just to keep things simple.
export function isServerResponse(stream: any) {
  return typeof stream._sent100 === 'boolean' && isOutgoingMessage(stream);
}

// TODO(later): We do not actually support Server Request yet. Might not ever?
// Keeping this here tho just to keep things simple.
export function isServerRequest(stream: any) {
  let _stream$req;
  return (
    typeof stream._consuming === 'boolean' &&
    typeof stream._dumped === 'boolean' &&
    ((_stream$req = stream.req) === null || _stream$req === undefined ? undefined : _stream$req.upgradeOrConnect) ===
      undefined
  );
}

export function willEmitClose(stream: NodeStream) {
  if (!isNodeStream(stream)) return null;
  const wState = (stream as Writable)._writableState;
  const rState = (stream as Readable)._readableState;
  const state = wState || rState;
  return (
    (!state && isServerResponse(stream)) || !!(state && state.autoDestroy && state.emitClose && state.closed === false)
  );
}

export function isDisturbed(stream: Readable) {
  let _stream$kIsDisturbed;
  return !!(
    stream &&
    ((_stream$kIsDisturbed = stream[kIsDisturbed]) !== null && _stream$kIsDisturbed !== undefined
      ? _stream$kIsDisturbed
      : stream.readableDidRead || stream.readableAborted)
  );
}

export function isErrored(stream: NodeStream) {
  var _ref,
    _ref2,
    _ref3,
    _ref4,
    _ref5,
    _stream$kIsErrored,
    _stream$_readableStat3,
    _stream$_writableStat3,
    _stream$_readableStat4,
    _stream$_writableStat4
  return !!(
    stream &&
    ((_ref =
      (_ref2 =
        (_ref3 =
          (_ref4 =
            (_ref5 =
              (_stream$kIsErrored = stream[kIsErrored]) !== null && _stream$kIsErrored !== undefined
                ? _stream$kIsErrored
                : (stream as Readable).readableErrored) !== null && _ref5 !== undefined
              ? _ref5
              : (stream as Writable).writableErrored) !== null && _ref4 !== undefined
            ? _ref4
            : (_stream$_readableStat3 = (stream as Readable)._readableState) === null || _stream$_readableStat3 === undefined
            ? undefined
            : _stream$_readableStat3.errorEmitted) !== null && _ref3 !== undefined
          ? _ref3
          : (_stream$_writableStat3 = (stream as Writable)._writableState) === null || _stream$_writableStat3 === undefined
          ? undefined
          : _stream$_writableStat3.errorEmitted) !== null && _ref2 !== undefined
        ? _ref2
        : (_stream$_readableStat4 = (stream as Readable)._readableState) === null || _stream$_readableStat4 === undefined
        ? undefined
        : _stream$_readableStat4.errored) !== null && _ref !== undefined
      ? _ref
      : (_stream$_writableStat4 = (stream as Writable)._writableState) === null || _stream$_writableStat4 === undefined
      ? undefined
      : _stream$_writableStat4.errored)
  )
}

export const nop = () => {};

export function once(this: unknown, callback: (...args: unknown[]) => any) {
  let called = false
  return function (this: unknown, ...args: unknown[]) {
    if (called) {
      return
    }
    called = true
    callback.apply(this, args)
  }
}

// ======================================================================================
// highWaterMark handling

export function highWaterMarkFrom(options: HighWaterMarkOptions, isDuplex: boolean, duplexKey: string) {
  return options.highWaterMark != null ? options.highWaterMark :
      isDuplex ? (options as any)[duplexKey] : null
}

export function getDefaultHighWaterMark(objectMode = false) {
  return objectMode ? 16 : 16 * 1024
}

export function getHighWaterMark(state: NodeStreamState,
                                 options: HighWaterMarkOptions,
                                 duplexKey: string,
                                 isDuplex: boolean) {
  const hwm = highWaterMarkFrom(options, isDuplex, duplexKey)
  if (hwm != null) {
    if (!Number.isInteger(hwm) || hwm < 0) {
      const name = isDuplex ? `options.${duplexKey}` : 'options.highWaterMark';
      throw new ERR_INVALID_ARG_VALUE(name, hwm, name);
    }
    return Math.floor(hwm);
  }

  // Default value
  return getDefaultHighWaterMark(state.objectMode)
}

// ======================================================================================
// addAbortSignal

export function addAbortSignal(signal: AbortSignal, stream: NodeStream) {
  validateAbortSignal(signal, 'signal');
  if (!isNodeStream(stream)) {
    throw new ERR_INVALID_ARG_TYPE('stream', 'stream.Stream', stream);
  }
  const onAbort = () => {
    stream.destroy(
      new AbortError(undefined, {
        cause: signal.reason
      })
    );
  }
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener('abort', onAbort);
    eos(stream, () => signal.removeEventListener('abort', onAbort));
  }
  return stream;
}

// ======================================================================================
// BufferList

interface Entry {
  data: any;
  next: Entry|null;
};

export class BufferList {
  head: Entry|null = null;
  tail: Entry|null = null;
  length: number = 0;

  push(v: any) {
    const entry : Entry = {
      data: v,
      next: null,
    }
    if (this.length > 0) this.tail!.next = entry;
    else this.head = entry;
    this.tail = entry;
    ++this.length;
  }
  unshift(v: any) {
    const entry : Entry = {
      data: v,
      next: this.head,
    }
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  }
  shift() : Buffer|undefined {
    if (this.length === 0) return;
    const ret = this.head!.data;
    if (this.length === 1) this.head = this.tail = null;
    else this.head = this.head!.next;
    --this.length;
    return ret;
  }

  clear() {
    this.head = this.tail = null;
    this.length = 0;
  }

  join(s: string) {
    if (this.length === 0) return '';
    let p = this.head;
    let ret = '' + p!.data;
    while ((p = p!.next) !== null) ret += s + p!.data;
    return ret;
  }

  concat(n: number) {
    if (this.length === 0) return Buffer.alloc(0);
    const ret = Buffer.allocUnsafe(n >>> 0);
    let p = this.head;
    let i = 0;
    while (p) {
      ret.set(p.data, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  }

  consume(n: number, hasStrings = false) {
    const data = this.head!.data;
    if (n < data.length) {
      // `slice` is the same for buffers and strings.
      const slice = data.slice(0, n);
      this.head!.data = data.slice(n) as Buffer;
      return slice as Buffer;
    }
    if (n === data.length) {
      // First chunk is a perfect match.
      return this.shift();
    }
    // Result spans more than one buffer.
    return hasStrings ? this._getString(n) : this._getBuffer(n);
  }

  first() {
    return this.head!.data;
  }

  *[Symbol.iterator]() {
    for (let p = this.head; p; p = p.next) {
      yield p.data;
    }
  }

  _getString(n: number) {
    let ret = '';
    let p = this.head;
    let c = 0;
    do {
      const str = p!.data;
      if (n > str.length) {
        ret += str;
        n -= str.length;
      } else {
        if (n === str.length) {
          ret += str
          ++c
          if (p!.next) this.head = p!.next;
          else this.head = this.tail = null;
        } else {
          ret += str.slice(0, n);
          this.head = p;
          p!.data = str.slice(n) as Buffer;
        }
        break;
      }
      ++c;
    } while ((p = p!.next) !== null);
    this.length -= c;
    return ret;
  }

  _getBuffer(n: number) {
    const ret = Buffer.allocUnsafe(n);
    const retLen = n;
    let p = this.head;
    let c = 0;
    do {
      const buf = p!.data;
      if (n > buf.length) {
        ret.set(buf, retLen - n);
        n -= buf.length;
      } else {
        if (n === buf.length) {
          ret.set(buf, retLen - n);
          ++c;
          if (p!.next) this.head = p!.next;
          else this.head = this.tail = null;
        } else {
          ret.set(new Uint8Array(buf.buffer, buf.byteOffset, n), retLen - n);
          this.head = p;
          p!.data = buf.slice(n) as Buffer;
        }
        break;
      }
      ++c
    } while ((p = p!.next) !== null);
    this.length -= c;
    return ret;
  }
}

// ======================================================================================

export type EosOptions = {
  error?: boolean;
  readable?: boolean;
  writable?: boolean;
  signal?: AbortSignal;
};

export type EosCallback = (this: NodeStream, err?: any) => void;

// TODO(later): We do not current implement Node.js' Request object. Might never?
function isRequest(stream: any) {
  return stream && stream.setHeader && typeof stream.abort === 'function'
}

export function eos(stream: NodeStream,
                    options?: EosOptions|EosCallback,
                    callback?: EosCallback) {
  let _options$readable, _options$writable;
  if (arguments.length === 2) {
    callback = options as EosCallback;
    options = {};
  } else if (options == null) {
    options = {};
  } else {
    validateObject(options, 'options', options as any);
  }
  validateFunction(callback, 'callback');
  validateAbortSignal((options as EosOptions).signal, 'options.signal');
  callback = once(callback!);
  const readable =
    (_options$readable = (options as EosOptions).readable) !== null && _options$readable !== undefined
      ? _options$readable
      : isReadableNodeStream(stream);
  const writable =
    (_options$writable = (options as EosOptions).writable) !== null && _options$writable !== undefined
      ? _options$writable
      : isWritableNodeStream(stream);
  if (!isNodeStream(stream)) {
    // TODO: Webstreams.
    throw new ERR_INVALID_ARG_TYPE('stream', 'Stream', stream);
  }
  const wState = (stream as Writable)._writableState;
  const rState = (stream as Readable)._readableState;
  const onlegacyfinish = () => {
    if (!(stream as Writable).writable) {
      onfinish();
    }
  };

  // TODO (ronag): Improve soft detection to include core modules and
  // common ecosystem modules that do properly emit 'close' but fail
  // this generic check.
  let _willEmitClose =
    willEmitClose(stream) && isReadableNodeStream(stream) === readable && isWritableNodeStream(stream) === writable;
  let writableFinished = isWritableFinished((stream as Writable), false);
  const onfinish = () => {
    writableFinished = true;
    // Stream should not be destroyed here. If it is that
    // means that user space is doing something differently and
    // we cannot trust willEmitClose.
    if (stream.destroyed) {
      _willEmitClose = false;
    }
    if (_willEmitClose && (!(stream as Readable).readable || readable)) {
      return;
    }
    if (!readable || readableFinished) {
      callback!.call(stream);
    }
  };
  let readableFinished = isReadableFinished(stream as Readable, false);
  const onend = () => {
    readableFinished = true;
    // Stream should not be destroyed here. If it is that
    // means that user space is doing something differently and
    // we cannot trust willEmitClose.
    if (stream.destroyed) {
      _willEmitClose = false;
    }
    if (_willEmitClose && (!(stream as Writable).writable || writable)) {
      return;
    }
    if (!writable || writableFinished) {
      callback!.call(stream);
    }
  };
  const onerror = (err: unknown) => {
    callback!.call(stream, err);
  };
  let closed = isClosed(stream);
  const onclose = () => {
    closed = true;
    const errored = isWritableErrored(stream as Writable) || isReadableErrored(stream as Readable)
    if (errored && typeof errored !== 'boolean') {
      return callback!.call(stream, errored);
    }
    if (readable && !readableFinished && isReadableNodeStream(stream, true)) {
      if (!isReadableFinished(stream as Readable, false)) return callback!.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
    }
    if (writable && !writableFinished) {
      if (!isWritableFinished(stream as Writable, false)) return callback!.call(stream, new ERR_STREAM_PREMATURE_CLOSE());
    }
    callback!.call(stream);
  };
  const onrequest = () => {
    (stream as any).req.on('finish', onfinish);
  };
  if (isRequest(stream)) {
    stream.on('complete', onfinish);
    if (!_willEmitClose) {
      stream.on('abort', onclose);
    }
    if ((stream as any).req) {
      onrequest();
    } else {
      stream.on('request', onrequest);
    }
  } else if (writable && !wState) {
    // legacy streams
    stream.on('end', onlegacyfinish);
    stream.on('close', onlegacyfinish);
  }

  // Not all streams will emit 'close' after 'aborted'.
  if (!_willEmitClose && typeof (stream as any).aborted === 'boolean') {
    stream.on('aborted', onclose);
  }
  stream.on('end', onend);
  stream.on('finish', onfinish);
  if ((options as EosOptions).error !== false) {
    stream.on('error', onerror);
  }
  stream.on('close', onclose);
  if (closed) {
    queueMicrotask(onclose);
  } else if (
    (wState !== null && wState !== undefined && wState.errorEmitted) ||
    (rState !== null && rState !== undefined && rState.errorEmitted)
  ) {
    if (!_willEmitClose) {
      queueMicrotask(onclose);
    }
  } else if (
    !readable &&
    (!_willEmitClose || isReadable(stream as Readable)) &&
    (writableFinished || isWritable(stream as Writable) === false)
  ) {
    queueMicrotask(onclose);
  } else if (
    !writable &&
    (!_willEmitClose || isWritable(stream as Writable)) &&
    (readableFinished || isReadable(stream as Readable) === false)
  ) {
    queueMicrotask(onclose);
  } else if (rState && (stream as any).req && (stream as any).aborted) {
    queueMicrotask(onclose);
  }
  const cleanup = () => {
    callback = nop;
    stream.removeListener('aborted', onclose);
    stream.removeListener('complete', onfinish);
    stream.removeListener('abort', onclose);
    stream.removeListener('request', onrequest);
    if ((stream as any).req) (stream as any).req.removeListener('finish', onfinish);
    stream.removeListener('end', onlegacyfinish);
    stream.removeListener('close', onlegacyfinish);
    stream.removeListener('finish', onfinish);
    stream.removeListener('end', onend);
    stream.removeListener('error', onerror);
    stream.removeListener('close', onclose);
  }
  if ((options as EosOptions).signal && !closed) {
    const abort = () => {
      // Keep it because cleanup removes it.
      const endCallback = callback
      cleanup()
      endCallback!.call(
        stream,
        new AbortError(undefined, {
          cause: (options as EosOptions).signal?.reason
        })
      )
    }
    if ((options as EosOptions).signal!.aborted) {
      queueMicrotask(abort);
    } else {
      const originalCallback = callback;
      callback = once((...args) => {
        (options as EosOptions).signal!.removeEventListener('abort', abort)
        originalCallback.apply(stream, args as any);
      });
      (options as EosOptions).signal!.addEventListener('abort', abort);
    }
  }
  return cleanup;
}

export function finished(stream: NodeStream, opts?: EosOptions) : Promise<void> {
  return new Promise((resolve, reject) => {
    eos(stream, opts, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    })
  });
}

eos.finished = finished;

// ======================================================================================
// Destroy

function checkError(err: any, w: WritableState, r: ReadableState) {
  if (err) {
    // Avoid V8 leak, https://github.com/nodejs/node/pull/34103#issuecomment-652002364
    err.stack; // eslint-disable-line no-unused-expressions

    if (w && !w.errored) {
      w.errored = err;
    }
    if (r && !r.errored) {
      r.errored = err;
    }
  }
}

export function destroy(this: NodeStream, err: any, cb: DestroyCallback|null|undefined) {
  const r = (this as Readable)._readableState;
  const w = (this as Writable)._writableState;
  // With duplex streams we use the writable side for state.
  const s = w || r;
  if ((w && w.destroyed) || (r && r.destroyed)) {
    if (typeof cb === 'function') {
      cb();
    }
    return this;
  }

  // We set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks
  checkError(err, w, r);
  if (w) {
    w.destroyed = true;
  }
  if (r) {
    r.destroyed = true;
  }

  // If still constructing then defer calling _destroy.
  if (!s.constructed) {
    this.once(kDestroy, function (this: NodeStream, er) {
      _destroy(this, aggregateTwoErrors(er, err), cb);
    });
  } else {
    _destroy(this, err, cb);
  }
  return this;
}

function _destroy(self: NodeStream, err: any, cb: DestroyCallback|null|undefined) {
  let called = false;
  function onDestroy(err: any) {
    if (called) {
      return;
    }
    called = true;
    const r = (self as Readable)._readableState;
    const w = (self as Writable)._writableState;
    checkError(err, w, r);
    if (w) {
      w.closed = true;
    }
    if (r) {
      r.closed = true;
    }
    if (typeof cb === 'function') {
      cb(err);
    }
    if (err) {
      queueMicrotask(() => emitErrorCloseNT(self, err));
    } else {
      queueMicrotask(() => emitCloseNT(self));
    }
  }
  try {
    self._destroy(err || null, onDestroy);
  } catch (err) {
    onDestroy(err);
  }
}

function emitErrorCloseNT(self: NodeStream, err: any) {
  emitErrorNT(self, err);
  emitCloseNT(self);
}

function emitCloseNT(self: NodeStream) {
  const r = (self as Readable)._readableState;
  const w = (self as Writable)._writableState;
  if (w) {
    w.closeEmitted = true;
  }
  if (r) {
    r.closeEmitted = true;
  }
  if ((w && w.emitClose) || (r && r.emitClose)) {
    self.emit('close');
  }
}

function emitErrorNT(self: NodeStream, err: any) {
  const r = (self as Readable)._readableState;
  const w = (self as Writable)._writableState;
  if ((w && w.errorEmitted) || (r && r.errorEmitted)) {
    return;
  }
  if (w) {
    w.errorEmitted = true;
  }
  if (r) {
    r.errorEmitted = true;
  }
  self.emit('error', err);
}

export function undestroy(this: NodeStream) {
  const r = (this as Readable)._readableState;
  const w = (this as Writable)._writableState;
  if (r) {
    r.constructed = true;
    r.closed = false;
    r.closeEmitted = false;
    r.destroyed = false;
    r.errored = null;
    r.errorEmitted = false;
    r.reading = false;
    r.ended = r.readable === false;
    r.endEmitted = r.readable === false;
  }
  if (w) {
    w.constructed = true;
    w.destroyed = false;
    w.closed = false;
    w.closeEmitted = false;
    w.errored = null;
    w.errorEmitted = false;
    w.finalCalled = false;
    w.prefinished = false;
    w.ended = w.writable === false;
    w.ending = w.writable === false;
    w.finished = w.writable === false;
  }
}

export function errorOrDestroy(stream: NodeStream, err: any, sync = false) {
  // We have tests that rely on errors being emitted
  // in the same tick, so changing this is semver major.
  // For now when you opt-in to autoDestroy we allow
  // the error to be emitted nextTick. In a future
  // semver major update we should change the default to this.

  const r = (stream as Readable)._readableState;
  const w = (stream as Writable)._writableState;
  if ((w && w.destroyed) || (r && r.destroyed)) {
    return;
  }
  if ((r && r.autoDestroy) || (w && w.autoDestroy)) stream.destroy(err);
  else if (err) {
    // Avoid V8 leak, https://github.com/nodejs/node/pull/34103#issuecomment-652002364
    err.stack; // eslint-disable-line no-unused-expressions

    if (w && !w.errored) {
      w.errored = err;
    }
    if (r && !r.errored) {
      r.errored = err;
    }
    if (sync) {
      queueMicrotask(() => emitErrorNT(stream, err));
    } else {
      emitErrorNT(stream, err)
    }
  }
}

export function construct(stream: NodeStream, cb: (err?: any) => unknown) {
  if (typeof stream._construct !== 'function') {
    return;
  }
  const r = (stream as Readable)._readableState;
  const w = (stream as Writable)._writableState;
  if (r) {
    r.constructed = false;
  }
  if (w) {
    w.constructed = false;
  }
  stream.once(kConstruct, cb)
  if (stream.listenerCount(kConstruct) > 1) {
    // Duplex
    return;
  }
  queueMicrotask(() => constructNT(stream));
}

function constructNT(stream: NodeStream) {
  let called = false;
  function onConstruct(err: any) {
    if (called) {
      errorOrDestroy(stream, err !== null && err !== undefined ? err : new ERR_MULTIPLE_CALLBACK());
      return;
    }
    called = true;
    const r = (stream as Readable)._readableState;
    const w = (stream as Writable)._writableState;
    const s = w || r;
    if (r) {
      r.constructed = true;
    }
    if (w) {
      w.constructed = true;
    }
    if (s.destroyed) {
      stream.emit(kDestroy, err);
    } else if (err) {
      errorOrDestroy(stream, err, true);
    } else {
      queueMicrotask(() => emitConstructNT(stream));
    }
  }
  try {
    stream._construct(onConstruct);
  } catch (err) {
    onConstruct(err);
  }
}

function emitConstructNT(stream: NodeStream) {
  stream.emit(kConstruct);
}

function emitCloseLegacy(stream: NodeStream) {
  stream.emit('close');
}

function emitErrorCloseLegacy(stream: NodeStream, err: any) {
  stream.emit('error', err);
  queueMicrotask(() => emitCloseLegacy(stream));
}

// Normalize destroy for legacy.
export function destroyer(stream: NodeStream, err: any) {
  if (!stream || isDestroyed(stream)) {
    return;
  }
  if (!err && !isFinished(stream)) {
    err = new AbortError();
  }

  // TODO: Remove isRequest branches.
  if (isServerRequest(stream)) {
    (stream as any).socket = null;
    stream.destroy(err);
  } else if (isRequest(stream)) {
    (stream as any).abort();
  } else if (isRequest((stream as any).req)) {
    (stream as any).req.abort();
  } else if (typeof stream.destroy === 'function') {
    stream.destroy(err);
  } else if (typeof (stream as any).close === 'function') {
    // TODO: Don't lose err?
    (stream as any).close();
  } else if (err) {
    queueMicrotask(() => emitErrorCloseLegacy(stream, err));
  } else {
    queueMicrotask(() => emitCloseLegacy(stream));
  }
  if (!stream.destroyed) {
    stream[kDestroyed] = true;
  }
}

