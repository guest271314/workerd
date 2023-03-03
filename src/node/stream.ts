// Copyright (c) 2017-2022 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0
//

/* eslint-disable */

import { pipeline } from 'node-internal:streams_pipeline';
import {
  destroy,
  finished,
  isErrored,
  isDisturbed,
  isReadable,
  addAbortSignal,
} from 'node-internal:streams_util';
import {
  compose,
} from 'node-internal:streams_compose';
import { Stream } from 'node-internal:streams_legacy';
import { Writable } from 'node-internal:streams_writable';
import { Readable } from 'node-internal:streams_readable';
import { Duplex } from 'node-internal:streams_duplex';
import { Transform, PassThrough } from 'node-internal:streams_transform';
import { promises } from 'node-internal:streams_promises';

export const _isUint8Array = Stream._isUint8Array;
export const _uint8ArrayToBuffer = Stream._uint8ArrayToBuffer;

export {
  addAbortSignal,
  compose,
  destroy,
  finished,
  isErrored,
  isDisturbed,
  isReadable,
  pipeline,
  Stream,
  Writable,
  Readable,
  Duplex,
  Transform,
  PassThrough,
  promises,
};

(Stream as any).addAbortSignal = addAbortSignal;
(Stream as any).compose = compose;
(Stream as any).destroy = destroy;
(Stream as any).finished = finished;
(Stream as any).isReadable = isReadable;
(Stream as any).isErrored = isErrored;
(Stream as any).isErrored = isDisturbed;
(Stream as any).pipeline = pipeline;
(Stream as any).Stream = Stream;
(Stream as any).Writable = Writable;
(Stream as any).Readable = Readable;
(Stream as any).Duplex = Duplex;
(Stream as any).Transform = Transform;
(Stream as any).PassThrough = PassThrough;
(Stream as any).promises = promises;

export default Stream;
