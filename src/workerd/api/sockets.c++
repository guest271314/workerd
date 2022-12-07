// Copyright (c) 2017-2022 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

#include "sockets.h"
#include "system-streams.h"


namespace workerd::api {


jsg::Ref<Socket> connectImplNoOutputLock(
    jsg::Lock& js, jsg::Ref<Fetcher> fetcher, kj::String address) {
  auto& ioContext = IoContext::current();

  auto jsRequest = Request::constructor(js, kj::str(address), nullptr);
  kj::Own<WorkerInterface> client = fetcher->getClient(
      ioContext, jsRequest->serializeCfBlobJson(js), "connect"_kj);

  // TODO: Validate `address` is well formed. Do I need to use `parseAddress` here or is there
  // a better way?

  // Set up the connection.
  auto headers = kj::heap<kj::HttpHeaders>(ioContext.getHeaderTable());
  auto httpClient = kj::newHttpClient(*client);
  auto request = httpClient->connect(address, *headers);
  auto revocable = kj::heap<RevocableIoStream>(*request.connection);

  auto promise = request.status.then([&revocable](auto status) {
    if (status.statusCode < 200 || status.statusCode >= 300) {
      // The connection request failed!
      // TODO(later): The status may include an errorBody that we currently do nothing with.

      // TODO(later): It would likely be better to report a more meaningful error here like
      // "connection refused" or "DNS lookup failed" but doing so requires more knowledge
      // about what error codes the proxy returns.

      // TODO(sockets): Will the underlying stream already throw an exception in this case?
      // If so, does this exception end up racing that one? Need to evaluate if we even
      // need RevocableIoStream in this case.
      revocable->revoke(KJ_EXCEPTION(FAILED, "jsg.Error: Unable to establish a TCP Socket"));
    }
  }).eagerlyEvaluate(nullptr);

  return jsg::alloc<Socket>(revocable.attach(kj::mv(promise), kj::mv(request.connection)));
}

jsg::Ref<Socket> connectImpl(
    jsg::Lock& js, kj::Maybe<jsg::Ref<Fetcher>> fetcher, kj::String address,
    CompatibilityFlags::Reader featureFlags) {
  if (!featureFlags.getTcpSocketsSupport()) {
    JSG_FAIL_REQUIRE(TypeError, "TCP Sockets API not enabled.");
  }
  jsg::Ref<Fetcher> actualFetcher = nullptr;
  KJ_IF_MAYBE(f, fetcher) {
    actualFetcher = kj::mv(*f);
  } else {
    actualFetcher = jsg::alloc<Fetcher>(
        IoContext::NULL_CLIENT_CHANNEL, Fetcher::RequiresHostAndProtocol::YES);
  }
  return connectImplNoOutputLock(js, kj::mv(actualFetcher), kj::mv(address));
}

InitData initialiseSocket(kj::Promise<kj::Own<RevocableIoStream>> connectionPromise) {
  auto& context = IoContext::current();

  // Initialise the readable/writable streams with a custom AsyncIoStream that waits for the
  // completion of `connectionPromise` before performing reads/writes.
  auto stream = kj::refcounted<PipelinedAsyncIoStream>(kj::mv(connectionPromise));
  auto sysStreams = newSystemMultiStream(kj::addRef(*stream), StreamEncoding::IDENTITY, context);

  return {
    .readable = jsg::alloc<ReadableStream>(context, kj::mv(sysStreams.readable)),
    .writable = jsg::alloc<WritableStream>(context, kj::mv(sysStreams.writable)),
    .closeFulfiller = IoContext::current().addObject(
        kj::heap<kj::PromiseFulfillerPair<void>>(kj::newPromiseAndFulfiller<void>()))
  };
}

Socket::Socket(kj::Promise<kj::Own<RevocableIoStream>> connectionPromise) :
    Socket(initialiseSocket(kj::mv(connectionPromise))) {};

jsg::Promise<void> Socket::close(jsg::Lock& js) {
  if (!closeFulfiller->fulfiller->isWaiting()) {
    return js.resolvedPromise();
  }

  auto result = js.resolvedPromise();
  result = readable->cancel(js, nullptr);
  result = writable->abort(js, nullptr);
  closeFulfiller->fulfiller->fulfill();
  return result;
}

PipelinedAsyncIoStream::PipelinedAsyncIoStream(kj::Promise<kj::Own<RevocableIoStream>> inner) :
    inner(kj::mv(inner)) {};

void PipelinedAsyncIoStream::shutdownWrite() {
  thenOrRunNow<void>([](kj::Own<RevocableIoStream>* stream) {
    (*stream)->shutdownWrite();
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

void PipelinedAsyncIoStream::abortRead() {
  thenOrRunNow<void>([](kj::Own<RevocableIoStream>* stream) {
    (*stream)->abortRead();
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

void PipelinedAsyncIoStream::getsockopt(int level, int option, void* value, uint* length) {
  thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    (*stream)->getsockopt(level, option, value, length);
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

void PipelinedAsyncIoStream::setsockopt(int level, int option, const void* value, uint length) {
  thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    (*stream)->setsockopt(level, option, value, length);
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

void PipelinedAsyncIoStream::getsockname(struct sockaddr* addr, uint* length) {
  thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    (*stream)->getsockname(addr, length);
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

void PipelinedAsyncIoStream::getpeername(struct sockaddr* addr, uint* length) {
  thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    (*stream)->getpeername(addr, length);
    return kj::READY_NOW;
  }).detach([this](kj::Exception&& exception) mutable {
    error = kj::mv(exception);
  });
}

kj::Promise<size_t> PipelinedAsyncIoStream::read(void* buffer, size_t minBytes, size_t maxBytes) {
  return thenOrRunNow<size_t>([=](kj::Own<RevocableIoStream>* stream) {
    return (*stream)->read(buffer, minBytes, maxBytes);
  });
}

kj::Promise<size_t> PipelinedAsyncIoStream::tryRead(void* buffer, size_t minBytes, size_t maxBytes) {
  return thenOrRunNow<size_t>([=](kj::Own<RevocableIoStream>* stream) {
    return (*stream)->tryRead(buffer, minBytes, maxBytes);
  });
}

kj::Promise<void> PipelinedAsyncIoStream::write(const void* buffer, size_t size) {
  return thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    return (*stream)->write(buffer, size);
  });
}

kj::Promise<void> PipelinedAsyncIoStream::write(kj::ArrayPtr<const kj::ArrayPtr<const byte>> pieces) {
  return thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    return (*stream)->write(pieces);
  });
}

kj::Promise<void> PipelinedAsyncIoStream::whenWriteDisconnected() {
  return thenOrRunNow<void>([=](kj::Own<RevocableIoStream>* stream) {
    return (*stream)->whenWriteDisconnected();
  });
}

}  // namespace workerd::api