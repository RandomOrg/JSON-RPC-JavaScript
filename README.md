# JSON-RPC-JavaScript
This is the official JavaScript implementation of the RANDOM.ORG JSON-RPC API (Release 4), which supports all current LTS versions of NodeJS (i.e. v12+, CommonJS and ES module syntax) and can also be used in modern browsers.

It provides access to both the signed and unsigned methods of the API through the RandomOrgClient class. It also provides a convenience class through the RandomOrgClient class, the RandomOrgCache, for precaching requests.

## Installation
The library and its required dependencies can be installed via [npm](https://www.npmjs.com/package/@randomorg/core):
```
npm install @randomorg/core
```
Alternatively, browser-compatible bundles are available on [unpkg.com](https://unpkg.com/browse/@randomorg/core@1.0.3/). The default option when using the URL as in the example below is a minified IIFE file and all classes can be accessed through *RandomOrgCore*.
```html
<script src="https://unpkg.com/@randomorg/core"></script>
<script>
  let roc = new RandomOrgCore.RandomOrgClient('YOUR_API_KEY_HERE');
</script>
```

## DEPENDENCIES
### NodeJS
The library requires [xmlhttprequest](https://www.npmjs.com/package/xmlhttprequest) for normal usage. 
### Browsers
When using the bundled versions, no dependencies are required for normal usage.

## Usage
### NodeJS
1. The library can be used with the following CommonJS syntax:
```javascript
const rdo = require('@randomorg/core');

let rdo1 = new rdo.RandomOrgClient('YOUR_API_KEY_HERE');
```
Or via named import of the individual classes you require, e.g. the RandomOrgClient class only:
```javascript
const RandomOrgClient = require('@randomorg/core').RandomOrgClient;

let rdo1 = new RandomOrgClient('YOUR_API_KEY_HERE');
```
2. Inside a ES module type setting (i.e. *.mjs* files or where the closest *package.json* file specifies "type": "module) where the package was installed via npm. More info on this: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import

The RandomOrgClient class is the default export of the '@randomorg/core' package, as well as a named export. This class is also available as a named export, alongside the error classes mentioned above.

The RandomOrgCache class is not exported directly, as its constructor should not be used directly but rather is called via one of the RandomOrgClient 'create*Cache' methods.
```javascript
import RandomOrgClient, { RandomOrgRANDOMORGError } from '@randomorg/core';
// Alternative:
// import { RandomOrgClient,  RandomOrgRANDOMORGError } from '@randomorg/core';

let roc = new RandomOrgClient('YOUR_API_KEY_HERE');
```
or
```javascript
import * as rdo from '@randomorg/core';

let roc = new rdo.RandomOrgClient('YOUR_API_KEY_HERE');
```

### Browser
For use in the browser without bundling, certain pre-bundled files are provided. These can either be downloaded and added to a project directly or accessed via the [unpkg.com](https://unpkg.com/) CDN. The default version is a minified IIFE script, which can be used in the following manner:
```html
<script src="FILE_OR_UNPKG_URL"></script>
...
<script>
  // The IIFE is accessed via the 'RandomOrgCore' name
  let roc = new RandomOrgCore.RandomOrgClient('YOUR_API_KEY_HERE');
  roc.generateIntegers(5, 0, 10)
  .then(console.log);
</script>

```
If the files are added directly, or the unpkg URL is adjusted to use one of the ES module-type scripts, the library may be used as described above for ES modules in NodeJS.

### Typescript
The library contains type definition files to make it compatible with TypeScript. Please use the following (ES module) syntax when importing classes.
1. Selective named imports, e.g.
```javascript
import { RandomOrgClient } from '@randomorg/core';

let roc = new RandomOrg.RandomOrgClient('YOUR_API_KEY_HERE');
```
2. Import all classes, e.g.
```javascript
import * as RandomOrg from '@randomorg/core';

let roc = new RandomOrg.RandomOrgClient('YOUR_API_KEY_HERE');
```
### General
The default setup is best for non-time-critical requests, e.g., batch clients:
```javascript
let roc = new RandomOrgClient('YOUR_API_KEY_HERE');

roc.generateIntegers(5, 0, 10)
.then(console.log);
// Example output: [ 2, 4, 8, 4, 6 ]
```
...or for more time sensitive applications, e.g., real-time draws, adjust the parameters when constructing the client and use signed methods:
```javascript
let roc = new RandomOrgClient('YOUR_API_KEY_HERE', { blockingTimeout: 2000, httpTimeout: 10000 });

roc.generateSignedIntegers(5, 0, 10, { replacement: false })
.then(console.log);
/* Example output:
{
  data: [ 5, 1, 9, 4, 7 ],
  random: {
    method: 'generateSignedIntegers',
    hashedApiKey: 'JXj/0wE0YQoFXIiNy0/rDD8cirF5AYx0eenV/qaqVgzEZ7Pv4dH6QZEFJOA+JRHluht8gU9cb5E6voIkgI/kSw==',
    n: 5,
    min: 0,
    max: 10,
    replacement: false,
    base: 10,
    pregeneratedRandomization: null,
    data: [ 5, 1, 9, 4, 7 ],
    license: {
      type: 'developer',
      text: 'Random values licensed strictly for development and testing only',
      infoUrl: null
    },
    licenseData: null,
    userData: null,
    ticketData: null,
    completionTime: '2021-08-04 16:31:12Z',
    serialNumber: 16675
  },
  signature: '2ACLu2aMC3gP30ixYrCcRj7WLDjsLY9S061FIuxWW/nX0thyYFQsUdrDyziJ3ymVa7SIIjRwdYf08MAEQcErogZKL37aGUwIMBggxm1EeyMaKGozumJEFShbDgUu5H0+jVju1PJwNK2hDP3FoFXzm6DReq+gScOgMfBrpD8Inh5RUgPF8rIlMSeQeTgA95pZ0SbAfy1hUMbDuO+uMmHqvgTbo4uugZQIQwzAsRMXbj+aj1n7FTOy4/YsC9RJI5AlC/9VZyK5Ves4XB8FSBnWBbaErYqfavSxNJ/sFFvoIZ2SiqnPZefBQg/VXq20y4PKzDQDUBLPlv/A4tJtZyxuOSGJMZ1qESKgvtkC5IPbFzurdF35dhXYlz+W01i8qPbhSbRjdJDCZ20XhP8ztpUIhciCX8axL8Xa9uWkcqT2m8ypy5j5YEK0aFWI3mW7hD0KpBFfDR+86oJ3GapDw6IU6MKgrNnNK94NbU/lkn5dUZhekJgw5DRAEsnRimvZhXd9+Bzf6q97MEXhMmQhKwe49FgBlSGMHeOlcpNj7vNqJUwrVrTf/Jx4Tv9XhpuujoHi0v39JVjFsl3A8TJFMdZcnv9ZJWAuoej6XODNKTS7E9M8jy+6QoA1XnKLXbnGD6Da9BK18zhg/Ize1lVazvUKkm87EXsljV5wMPhT+khoecI='
}
*/
```
In order to execute requests in a serialized manner where the sequence of requests matches the sequence of responses, the requests may be issued back to back in a [promise chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises#chaining)...
```javascript
let roc = new RandomOrgClient('YOUR_API_KEY_HERE');
let serialNumbers = [];

roc.generateSignedIntegers(5, 0, 10)
.then(response => {
  serialNumbers.push(response.random.serialNumber);
  return roc.generateSignedIntegers(5, 0, 10);
})
.then(response => {
  serialNumbers.push(response.random.serialNumber);
  return roc.generateSignedIntegers(5, 0, 10);
})
.then(response => {
  serialNumbers.push(response.random.serialNumber);
  console.log(serialNumbers);
});
// Example output: [ 20180, 20181, 20182 ]
```
...or by adding the [await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) keyword to each request. Please note that the use of *await* is restricted to certain circumstances, as documented [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await).
```javascript
let roc = new RandomOrgClient('YOUR_API_KEY_HERE');
let serialNumbers = [];

for (let i = 0; i < 3; i++) {
    let response = await roc.generateSignedIntegers(5, 0, 10);
    serialNumbers.push(response.random.serialNumber);
}

console.log(serialNumbers);
// Example output: [ 20183, 20184, 20185 ]
```

### Caching
If obtaining some kind of response instantly is important, a cache should be used. A cache will populate itself as quickly and efficiently as possible allowing pre-obtained randomness to be supplied instantly. If randomness is not available - e.g., the cache is empty - the cache will throw a RandomOrgCacheEmptyError allowing the lack of randomness to be handled without delay.

Note that caches don't support signed responses as it is assumed that clients using the signing features want full control over the serial numbering of responses.

#### Setup
RandomOrgCache instances must be initialised using the appropriate method of a RandomOrgClient instance - e.g. via *createIntegerCache*, *createGaussianCache*, etc - as they require an instantiated RandomOrgClient to function.
```javascript
let RandomOrgClient = require('@randomorg/core').RandomOrgClient;
let RandomOrgCacheEmptyError = require('@randomorg/core').RandomOrgCacheEmptyError;
// Or, using the library as an ES module
// import { RandomOrgClient, RandomOrgCacheEmptyError } from '@randomorg/core';

let roc = new RandomOrgClient('YOUR_API_KEY_HERE');
let cache = roc.createIntegerCache(5, 0, 10, { base: 2, cacheSize: 4 });
```

#### get()
The cache can be queried for results using the synchronous *get()* method.
```javascript
let roc = new RandomOrgClient('YOUR_API_KEY_HERE');
let cache = roc.createIntegerCache(5, 0, 10, { base: 2, cacheSize: 4 });

try {
  let values = cache.get();  // Query the cache for a result-set of integers
  console.log(values);
} catch (e) {
  if (e instanceof RandomOrgCacheEmptyError) {
    // Handle the lack of true random integers here, e.g. by using PRNG
  }
}
```
The above example will likely result in a RandomOrgCacheEmpty being thrown, as the cache will not have had sufficient time to populate itself.

If a loop is used to query the cache until a result is available (without delay between requests), the loop will block other background activities required to populate the cache. This is an example of a loop which will **not** work:
```javascript
let values = null;
while (values == null) {
  try {
    console.log('Attempting to retrieve values...');
    values = cache.get();
    break;
  } catch (e) {
    // Do nothing
  }
}
// Unreachable code, the constant loop will block the cache from populating itself
console.log(values);
```
Output:
```
Attempting to retrieve values...
Attempting to retrieve values...
Attempting to retrieve values...
...
```

The following example demonstrates the use of the *get()* method within a loop, where a short delay between each iteration allows for the asynchronous population of the cache to continue (ES module, Node v14.8.0+).
```javascript
let values = null;
while (values == null) {
    try {
      values = cache.get();  // Query the cache for a result-set of integers
      console.log(values);
    } catch (e) {
      if (e instanceof RandomOrgCacheEmptyError) {
        // Wait for a short time before checking for results again
        await new Promise(r => setTimeout(r, 50));
      }
    }
}
```

#### getOrWait()
Alternatively, the asynchronous *getOrWait()* method is also available, which returns a Promise containing the next available result. The Promise will be rejected if the queue is empty and the cache has been paused or if a different error has occurred, e.g. insufficient requests remain or incorrect parameters were provided.
```javascript
// Using the await keyword, e.g. within in async function or an ES module
try {
  let values = await cache.getOrWait();
  console.log(values);
} catch (e) {
  // Handle any errors here
  console.log('An error was thrown');
}

// Using the native Promise syntax
cache.getOrWait()
.then(console.log)
.catch(e => {
  // Handle any errors here
  console.log('An error was thrown');
})
```
### Signature Verification
There are two additional methods to generate signature verification URLs and HTML forms (*createUrl* and *createHtml*) using the random object and signature returned from any of the signed (value generating) methods. The generated URLs and HTML forms link to the same web page that is also shown when a result is verified using the online [Signature Verification Form](https://api.random.org/signatures/form).

## Documentation

For a full list of available randomness generation functions and other features see the library documentation and https://api.random.org/json-rpc/4


## Tests
### Setup
Please note that test files are not included in the package when it is published on npm.
To run these tests, this repository (or the test suite, at the very minimum) should be downloaded and the development dependencies installed.

Running the full test suite will use approximately 137 requests / 9200 bits.
### NodeJS
Add a valid API key in the **apiKey** field in the *test/test.js* file. If you want the output, e.g., integer arrays generated, from each test case to be logged to the console, the **logResponses** field can be set to true. Run 'npm run test' from a terminal. (Note: The tests work with ES modules and the package.json file in the *test* directory contains a "type": "module" field to overwrite the default "commonjs" format.)
### Browser
1. To avoid recompiling, simply search for 'YOUR_API_KEY_HERE' in the *test.es.js* file and replace this with your API key.
2. Alternatively, ensure that [rollup](https://www.npmjs.com/package/rollup) and the following plugins are installed: [@rollup/plugin-commonjs](https://www.npmjs.com/package/@rollup/plugin-commonjs), [rollup-plugin-ignore](https://www.npmjs.com/package/rollup-plugin-ignore), [rollup-plugin-terser](https://www.npmjs.com/package/rollup-plugin-terser) and [rollup-plugin-strip-code](https://www.npmjs.com/package/rollup-plugin-strip-code). Then, after adding your API key as described above, run 'npm run build-test' from a terminal (within the project directory). This recompiles the browser-compatible version of the test with your API key. Then, open the *test.html* file in a browser.
