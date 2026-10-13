// Verification reads can be retried after a transport reset. Writes cannot.
const transientStatuses = new Set([408,425,429,500,502,503,504]);
const transportCodes = new Set(['ECONNRESET','ETIMEDOUT','EPIPE','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);
const transientError = error => error?.name === 'TimeoutError' || transportCodes.has(error?.code) || transportCodes.has(error?.cause?.code);

export async function readback(url, options = {}, { fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve,ms)), attempts = 3, timeout = 45000 } = {}) {
  if (options.method && options.method !== 'GET') throw Error('Readback accepts GET only');
  if (options.body != null) throw Error('Readback does not accept a request body');
  if (!['json','bytes','text'].includes(options.parse || 'json')) throw Error('Unsupported readback parser');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw Error('Readback attempts must be between one and three');
  for (let attempt=0; attempt<attempts; attempt++) {
    try {
      const response = await fetcher(url,{method:'GET',headers:options.headers,signal:AbortSignal.timeout(timeout)});
      if (!response.ok) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter == null ? 500*(attempt+1) : /^\d+$/.test(retryAfter) ? Number(retryAfter)*1000 : Math.max(0,Date.parse(retryAfter)-Date.now());
        if (transientStatuses.has(response.status) && attempt+1<attempts && Number.isFinite(delay) && delay<=5000) {
          await response.body?.cancel();
          await wait(delay);
          continue;
        }
        return {response,value:null};
      }
      // Consume inside the retry boundary: a response header can arrive before
      // the socket resets while reading the image/JSON body.
      const value = options.parse === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : options.parse === 'text' ? await response.text() : await response.json();
      return {response,value};
    } catch (error) {
      if (!transientError(error) || attempt+1>=attempts) throw error;
      await wait(500*(attempt+1));
    }
  }
  throw Error('Readback attempt budget exhausted');
}
