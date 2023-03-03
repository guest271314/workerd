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
  EventEmitter,
} from 'node-internal:events';

import {
  Stream
} from 'node-internal:streams_legacy';

import {
  Buffer,
} from 'node-internal:internal_buffer';

import {
  Duplex,
  DestroyCallback,
  AfterWriteTickInfo,
  NodeStream,
  Writable,
  WritableOptions,
  WritableState,
  WriteCallback,
  nop,
  kOnFinished,
  getHighWaterMark,
  getDefaultHighWaterMark,
  addAbortSignal,
  construct,
  destroy,
  undestroy,
  errorOrDestroy,
} from 'node-internal:streams_util';

import {
  ERR_INVALID_ARG_TYPE,
  ERR_METHOD_NOT_IMPLEMENTED,
  ERR_MULTIPLE_CALLBACK,
  ERR_STREAM_CANNOT_PIPE,
  ERR_STREAM_DESTROYED,
  ERR_STREAM_ALREADY_FINISHED,
  ERR_STREAM_NULL_VALUES,
  ERR_STREAM_WRITE_AFTER_END,
  ERR_UNKNOWN_ENCODING
} from 'node-internal:internal_errors';

import { isDuplexInstance } from 'node-internal:streams_duplex';

// ======================================================================================
// WritableState

function WritableState(this: WritableState,
                       options: WritableOptions|undefined|null,
                       stream: Writable,
                       isDuplex: boolean) {
  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream,
  // e.g. options.readableObjectMode vs. options.writableObjectMode, etc.
  if (typeof isDuplex !== 'boolean') isDuplex = isDuplexInstance(stream);

  // Object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!(options?.objectMode);
  if (isDuplex) this.objectMode = this.objectMode || !!(options?.writableObjectMode);

  // The point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write().
  this.highWaterMark = options
    ? getHighWaterMark(this, options, 'writableHighWaterMark', isDuplex)
    : getDefaultHighWaterMark(false);

  // if _final has been called.
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // At the start of calling end()
  this.ending = false;
  // When end() has been called, and returned.
  this.ended = false;
  // When 'finish' is emitted.
  this.finished = false;

  // Has it been destroyed
  this.destroyed = false;

  // Should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  const noDecode = !!(options?.decodeStrings === false);
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = (options?.defaultEncoding) || 'utf8';

  // Not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // A flag to see when we're in the middle of a write.
  this.writing = false;

  // When true all writes will be buffered until .uncork() call.
  this.corked = 0;

  // A flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // A flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // The callback that's passed to _write(chunk, cb).
  this.onwrite = (err?: any) => onwrite.call(undefined, stream, err);

  // The callback that the user supplies to write(chunk, encoding, cb).
  this.writecb = null;

  // The amount that is being written when _write is called.
  this.writelen = 0;

  // Storage for data passed to the afterWrite() callback in case of
  // synchronous _write() completion.
  this.afterWriteTickInfo = null;
  resetBuffer(this);

  // Number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted.
  this.pendingcb = 0;

  // Stream is still being constructed and cannot be
  // destroyed until construction finished or failed.
  // Async construction is opt in, therefore we start as
  // constructed.
  this.constructed = true;

  // Emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams.
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again.
  this.errorEmitted = false;

  // Should close be emitted on destroy. Defaults to true.
  this.emitClose = !options || options.emitClose !== false;

  // Should .destroy() be called after 'finish' (and potentially 'end').
  this.autoDestroy = !options || options.autoDestroy !== false;

  // Indicates whether the stream has errored. When true all write() calls
  // should return false. This is needed since when autoDestroy
  // is disabled we need a way to tell whether the stream has failed.
  this.errored = null;

  // Indicates whether the stream has finished destroying.
  this.closed = false;

  // True if close has been emitted or would have been emitted
  // depending on emitClose.
  this.closeEmitted = false;
  this[kOnFinished] = [];
}

function resetBuffer(state: WritableState) {
  state.buffered = [];
  state.bufferedIndex = 0;
  state.allBuffers = true;
  state.allNoop = true;
}

WritableState.prototype.getBuffer = function getBuffer() {
  return this.buffered.slice(this.bufferedIndex);
}

Object.defineProperty(WritableState.prototype, 'bufferedRequestCount', {
  get(this: WritableState) {
    return this.buffered.length - this.bufferedIndex;
  }
});

// ======================================================================================
// Writable

(Writable as any).WritableState = WritableState;

Object.setPrototypeOf(Writable.prototype, Stream.prototype);
Object.setPrototypeOf(Writable, Stream);

export function Writable(this: Writable, options?: WritableOptions|null) {
  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.

  // Checking for a Stream.Duplex instance is faster here instead of inside
  // the WritableState constructor, at least with V8 6.5.
  const isDuplex = isDuplexInstance(this);
  if (!isDuplex && !Writable[Symbol.hasInstance](this)) return new (Writable as any)(options);
  this._writableState = new (WritableState as any)(options, this, isDuplex)
  if (options) {
    if (typeof options.write === 'function') this._write = options.write;
    if (typeof options.writev === 'function') this._writev = options.writev;
    if (typeof options.destroy === 'function') this._destroy = options.destroy;
    if (typeof options.final === 'function') this._final = options.final;
    if (typeof options.construct === 'function') this._construct = options.construct;
    if (options.signal) addAbortSignal(options.signal, this);
  }
  Stream.call(this, options);
  construct(this, () => {
    const state = this._writableState;
    if (!state.writing) {
      clearBuffer(this, state);
    }
    finishMaybe(this, state);
  })
}

Object.defineProperty(Writable, Symbol.hasInstance, {
  value: function (object: any) {
    if (this[Symbol.hasInstance](object)) return true;
    if (this !== Writable) return false;
    return object?._writableState instanceof WritableState;
  }
})

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function (this: Writable, _1: NodeStream, _2?: { end: boolean }) {
  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
}

function _write(stream: Writable,
                chunk: any,
                encoding?: string|WriteCallback|null,
                cb?: WriteCallback|null) {
  const state = stream._writableState;
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = state.defaultEncoding;
  } else {
    if (!encoding) encoding = state.defaultEncoding;
    else if (encoding !== 'buffer' && !Buffer.isEncoding(encoding)) {
      throw new ERR_UNKNOWN_ENCODING(encoding);
    }
    if (typeof cb !== 'function') cb = nop;
  }
  if (chunk === null) {
    throw new ERR_STREAM_NULL_VALUES();
  } else if (!state.objectMode) {
    if (typeof chunk === 'string') {
      if (state.decodeStrings !== false) {
        chunk = Buffer.from(chunk, encoding);
        encoding = 'buffer';
      }
    } else if (chunk instanceof Buffer) {
      encoding = 'buffer';
    } else if ((Stream as any)._isUint8Array(chunk)) {
      chunk = (Stream as any)._uint8ArrayToBuffer(chunk);
      encoding = 'buffer';
    } else {
      throw new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer', 'Uint8Array'], chunk);
    }
  }
  let err: any;
  if (state.ending) {
    err = new ERR_STREAM_WRITE_AFTER_END();
  } else if (state.destroyed) {
    err = new ERR_STREAM_DESTROYED('write');
  }
  if (err) {
    queueMicrotask(() => cb!(err));
    errorOrDestroy(stream, err, true);
    return err;
  }
  state.pendingcb++;
  return writeOrBuffer(stream, state, chunk, encoding, cb);
}

function write(this: Writable,
               chunk: any,
               encoding?: string|WriteCallback|null,
               cb?: WriteCallback|null) : boolean {
  return _write(this, chunk, encoding, cb) === true;
}

Writable.prototype.write = write;

Writable.prototype.cork = function (this: Writable) {
  this._writableState.corked++;
}

Writable.prototype.uncork = function (this: Writable) {
  const state = this._writableState;
  if (state.corked) {
    state.corked--;
    if (!state.writing) clearBuffer(this, state);
  }
}

function setDefaultEncoding(this: Writable, encoding: string) {
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!Buffer.isEncoding(encoding)) throw new ERR_UNKNOWN_ENCODING(encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
}

Writable.prototype.setDefaultEncoding = setDefaultEncoding;

// If we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream: Writable,
                       state: WritableState,
                       chunk: any,
                       encoding: string,
                       callback: WriteCallback) {
  const len = state.objectMode ? 1 : chunk.length;
  state.length += len;

  // stream._write resets state.length
  const ret = state.length < state.highWaterMark;
  // We must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;
  if (state.writing || state.corked || state.errored || !state.constructed) {
    state.buffered.push({
      chunk,
      encoding,
      callback,
    });
    if (state.allBuffers && encoding !== 'buffer') {
      state.allBuffers = false;
    }
    if (state.allNoop && callback !== nop) {
      state.allNoop = false;
    }
  } else {
    state.writelen = len;
    state.writecb = callback;
    state.writing = true;
    state.sync = true;
    (stream as any)._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }

  // Return false if errored or destroyed in order to break
  // any synchronous while(stream.write(data)) loops.
  return ret && !state.errored && !state.destroyed;
}

function doWrite(stream: Writable,
                 state: WritableState,
                 writev: boolean,
                 len: number,
                 chunk: any,
                 encoding: string,
                 cb: WriteCallback) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED('write'));
  else if (writev) (stream as any)._writev(chunk, state.onwrite);
  else (stream as any)._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream: Writable,
                      state: WritableState,
                      er: any,
                      cb: WriteCallback) {
  --state.pendingcb;
  cb(er);
  // Ensure callbacks are invoked even when autoDestroy is
  // not enabled. Passing `er` here doesn't make sense since
  // it's related to one specific write, not to the buffered
  // writes.
  errorBuffer(state);
  // This can emit error, but error must always follow cb.
  errorOrDestroy(stream, er);
}

function onwrite(stream: Writable, er?: any) {
  const state = stream._writableState;
  const sync = state.sync;
  const cb = state.writecb;
  if (typeof cb !== 'function') {
    errorOrDestroy(stream, new ERR_MULTIPLE_CALLBACK());
    return;
  }
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
  if (er) {
    // Avoid V8 leak, https://github.com/nodejs/node/pull/34103#issuecomment-652002364
    er.stack; // eslint-disable-line no-unused-expressions

    if (!state.errored) {
      state.errored = er;
    }

    // In case of duplex streams we need to notify the readable side of the
    // error.
    if ((stream as Duplex)._readableState && !(stream as Duplex)._readableState.errored) {
      (stream as Duplex)._readableState.errored = er;
    }
    if (sync) {
      queueMicrotask(() => onwriteError(stream, state, er, cb));
    } else {
      onwriteError(stream, state, er, cb);
    }
  } else {
    if (state.buffered.length > state.bufferedIndex) {
      clearBuffer(stream, state);
    }
    if (sync) {
      // It is a common case that the callback passed to .write() is always
      // the same. In that case, we do not schedule a new nextTick(), but
      // rather just increase a counter, to improve performance and avoid
      // memory allocations.
      if (state.afterWriteTickInfo !== null && state.afterWriteTickInfo.cb === cb) {
        state.afterWriteTickInfo.count++;
      } else {
        state.afterWriteTickInfo = {
          count: 1,
          cb,
          stream,
          state
        };
        queueMicrotask(() => afterWriteTick(state.afterWriteTickInfo!));
      }
    } else {
      afterWrite(stream, state, 1, cb);
    }
  }
}

function afterWriteTick({ stream, state, count, cb } : AfterWriteTickInfo) {
  state.afterWriteTickInfo = null;
  return afterWrite(stream, state, count, cb);
}

function afterWrite(stream: Writable,
                    state: WritableState,
                    count: number,
                    cb: WriteCallback) {
  const needDrain = !state.ending && !stream.destroyed && state.length === 0 && state.needDrain;
  if (needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
  while (count-- > 0) {
    state.pendingcb--;
    cb();
  }
  if (state.destroyed) {
    errorBuffer(state);
  }
  finishMaybe(stream, state);
}

// If there's something in the buffer waiting, then invoke callbacks.
function errorBuffer(state: WritableState) {
  if (state.writing) {
    return;
  }
  for (let n = state.bufferedIndex; n < state.buffered.length; ++n) {
    let _state$errored;
    const { chunk, callback } = state.buffered[n];
    const len = state.objectMode ? 1 : chunk.length;
    state.length -= len;
    callback(
      (_state$errored = state.errored) !== null && _state$errored !== undefined
        ? _state$errored
        : new ERR_STREAM_DESTROYED('write'));
  }
  const onfinishCallbacks = state[kOnFinished].splice(0);
  for (let i = 0; i < onfinishCallbacks.length; i++) {
    let _state$errored2;
    onfinishCallbacks[i]!(
      (_state$errored2 = state.errored) !== null && _state$errored2 !== undefined
        ? _state$errored2
        : new ERR_STREAM_DESTROYED('end'));
  }
  resetBuffer(state);
}

// If there's something in the buffer waiting, then process it.
function clearBuffer(stream: Writable, state: WritableState) {
  if (state.corked || state.bufferProcessing || state.destroyed || !state.constructed) {
    return;
  }
  const { buffered, bufferedIndex, objectMode } = state;
  const bufferedLength = buffered.length - bufferedIndex;
  if (!bufferedLength) {
    return;
  }
  let i = bufferedIndex;
  state.bufferProcessing = true;
  if (bufferedLength > 1 && (stream as any)._writev) {
    state.pendingcb -= bufferedLength - 1;
    const callback = state.allNoop
      ? nop
      : (err: any) => {
          for (let n = i; n < buffered.length; ++n) {
            buffered[n].callback(err)
          }
        };
    // Make a copy of `buffered` if it's going to be used by `callback` above,
    // since `doWrite` will mutate the array.
    const chunks = state.allNoop && i === 0 ? buffered : buffered.slice(i);
    (chunks as any).allBuffers = state.allBuffers;
    doWrite(stream, state, true, state.length, chunks, '', callback);
    resetBuffer(state);
  } else {
    do {
      const { chunk, encoding, callback } = buffered[i];
      buffered[i++] = null;
      const len = objectMode ? 1 : chunk.length;
      doWrite(stream, state, false, len, chunk, encoding, callback);
    } while (i < buffered.length && !state.writing)
    if (i === buffered.length) {
      resetBuffer(state);
    } else if (i > 256) {
      buffered.splice(0, i);
      state.bufferedIndex = 0;
    } else {
      state.bufferedIndex = i;
    }
  }
  state.bufferProcessing = false;
}

Writable.prototype._write = function (this: Writable,
                                      chunk: any,
                                      encoding: string|undefined|null,
                                      cb: WriteCallback) {
  if ((this as any)._writev) {
    this._writev(
      [
        {
          chunk,
          encoding
        }
      ],
      cb,
    );
  } else {
    throw new ERR_METHOD_NOT_IMPLEMENTED('_write()');
  }
}

Writable.prototype._writev = null;

function end(this: Writable,
             chunk?: any,
             encoding?: string|WriteCallback|null,
             cb?: WriteCallback|null) {
  const state = this._writableState;
  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  let err: any;
  if (chunk !== null && chunk !== undefined) {
    const ret = _write(this, chunk, encoding!);
    if (ret instanceof Error) {
      err = ret;
    }
  }

  // .end() fully uncorks.
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }
  if (err) {
    // Do nothing...
  } else if (!state.errored && !state.ending) {
    // This is forgiving in terms of unnecessary calls to end() and can hide
    // logic errors. However, usually such errors are harmless and causing a
    // hard error can be disproportionately destructive. It is not always
    // trivial for the user to determine whether end() needs to be called
    // or not.

    state.ending = true;
    finishMaybe(this, state, true);
    state.ended = true;
  } else if (state.finished) {
    err = new ERR_STREAM_ALREADY_FINISHED('end');
  } else if (state.destroyed) {
    err = new ERR_STREAM_DESTROYED('end');
  }
  if (typeof cb === 'function') {
    if (err || state.finished) {
      queueMicrotask(() => cb!(err));
    } else {
      state[kOnFinished].push(cb);
    }
  }
  return this;
}

Writable.prototype.end = end;

function needFinish(state: WritableState) {
  return (
    state.ending &&
    !state.destroyed &&
    state.constructed &&
    state.length === 0 &&
    !state.errored &&
    state.buffered.length === 0 &&
    !state.finished &&
    !state.writing &&
    !state.errorEmitted &&
    !state.closeEmitted
  );
}

function callFinal(stream: Writable, state: WritableState) {
  let called = false;
  function onFinish(err: any) {
    if (called) {
      errorOrDestroy(stream, err || new ERR_MULTIPLE_CALLBACK());
      return;
    }
    called = true;
    state.pendingcb--;
    if (err) {
      const onfinishCallbacks = state[kOnFinished].splice(0);
      for (let i = 0; i < onfinishCallbacks.length; i++) {
        onfinishCallbacks[i]!(err);
      }
      errorOrDestroy(stream, err, state.sync);
    } else if (needFinish(state)) {
      state.prefinished = true;
      stream.emit('prefinish');
      // Backwards compat. Don't check state.sync here.
      // Some streams assume 'finish' will be emitted
      // asynchronously relative to _final callback.
      state.pendingcb++;
      queueMicrotask(() => finish(stream, state));
    }
  }
  state.sync = true;
  state.pendingcb++;
  try {
    stream._final!(onFinish);
  } catch (err) {
    onFinish(err);
  }
  state.sync = false;
}

function prefinish(stream: Writable, state: WritableState) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function' && !state.destroyed) {
      state.finalCalled = true;
      callFinal(stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream: Writable, state: WritableState, sync = false) {
  if (needFinish(state)) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      if (sync) {
        state.pendingcb++;
        queueMicrotask(() => {
          ((stream: Writable, state: WritableState) => {
            if (needFinish(state)) {
              finish(stream, state);
            } else {
              state.pendingcb--;
            }
          })(stream, state);
        });
      } else if (needFinish(state)) {
        state.pendingcb++;
        finish(stream, state);
      }
    }
  }
}

function finish(stream: Writable, state: WritableState) {
  state.pendingcb--;
  state.finished = true;
  const onfinishCallbacks = state[kOnFinished].splice(0);
  for (let i = 0; i < onfinishCallbacks.length; i++) {
    onfinishCallbacks[i]!();
  }
  stream.emit('finish');
  if (state.autoDestroy) {
    // In case of duplex streams we need a way to detect
    // if the readable side is ready for autoDestroy as well.
    const rState = (stream as Duplex)._readableState;
    const autoDestroy =
      !rState ||
      (rState.autoDestroy &&
        // We don't expect the readable to ever 'end'
        // if readable is explicitly set to false.
        (rState.endEmitted || rState.readable === false));
    if (autoDestroy) {
      stream.destroy();
    }
  }
}

Object.defineProperties(Writable.prototype, {
  closed: {
    get(this: Writable) {
      return !!(this._writableState?.closed);
    }
  },
  destroyed: {
    get(this: Writable) {
      return !!(this._writableState?.destroyed);
    },
    set(this: Writable, value: boolean) {
      // Backward compatibility, the user is explicitly managing destroyed.
      if (this._writableState) {
        this._writableState.destroyed = value
      }
    }
  },
  errored: {
    enumerable: false,
    get(this: Writable) {
      return this._writableState?.errored || null;
    }
  },
  writable: {
    get(this: Writable) {
      const w = this._writableState
      // w.writable === false means that this is part of a Duplex stream
      // where the writable side was disabled upon construction.
      // Compat. The user might manually disable writable side through
      // deprecated setter.
      return !!w && w.writable !== false && !w.destroyed && !w.errored && !w.ending && !w.ended;
    },
    set(this: Writable, val: boolean) {
      // Backwards compatible.
      if (this._writableState) {
        this._writableState.writable = !!val;
      }
    }
  },
  writableFinished: {
    get(this: Writable) {
      return !!(this._writableState?.finished);
    }
  },
  writableObjectMode: {
    get(this: Writable) {
      return !!(this._writableState?.objectMode);
    }
  },
  writableBuffer: {
    get(this: Writable) {
      return this._writableState?.getBuffer();
    }
  },
  writableEnded: {
    get(this: Writable) {
      return !!(this._writableState?.ending);
    }
  },
  writableNeedDrain: {
    get(this: Writable) {
      const wState = this._writableState;
      if (!wState) return false;
      return !wState.destroyed && !wState.ending && wState.needDrain;
    }
  },
  writableHighWaterMark: {
    get(this: Writable) {
      return this._writableState?.highWaterMark;
    }
  },
  writableCorked: {
    get(this: Writable) {
      return this._writableState?.corked | 0;
    }
  },
  writableLength: {
    get(this: Writable) {
      return this._writableState?.length;
    }
  },
  writableAborted: {
    enumerable: false,
    get: function (this: Writable) {
      return !!(
        this._writableState.writable !== false &&
        (this._writableState.destroyed || this._writableState.errored) &&
        !this._writableState.finished
      )
    }
  }
});

Writable.prototype.destroy = function (this: Writable, err: any, cb?: DestroyCallback|null) {
  const state = this._writableState;

  // Invoke pending callbacks.
  if (!state.destroyed && (state.bufferedIndex < state.buffered.length || state[kOnFinished].length)) {
    queueMicrotask(() => errorBuffer(state));
  }
  destroy.call(this, err, cb);
  return this;
}

Writable.prototype._undestroy = undestroy

Writable.prototype._destroy = function (err: any, cb: DestroyCallback|null|undefined) {
  if (cb) cb(err);
}
Writable.prototype[EventEmitter.captureRejectionSymbol] = function (err: any) {
  this.destroy(err);
}

// let webStreamsAdapters

// // Lazy to avoid circular references
// function lazyWebStreams() {
//   if (webStreamsAdapters === undefined) webStreamsAdapters = {}
//   return webStreamsAdapters
// }
// Writable.fromWeb = function (writableStream, options) {
//   return lazyWebStreams().newStreamWritableFromWritableStream(writableStream, options)
// }
// Writable.toWeb = function (streamWritable) {
//   return lazyWebStreams().newWritableStreamFromStreamWritable(streamWritable)
// }
