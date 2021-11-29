var RandomOrgCore = (function (exports) {
    'use strict';

    var RandomOrgErrors = {};

    /**
     * Error thrown by the RandomOrgClient class when the connection doesn't return
     * a HTTP 200 OK response.
     */
    RandomOrgErrors.RandomOrgBadHTTPResponseError = class RandomOrgBadHTTPResponseError extends Error
    {
        /**
         * Constructs a new exception with the specified detail message.
         * @param {string} message The detail message.
         */
        constructor(message) {
            super(message);
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when its API key's request has
     * exceeded its remaining server bits allowance.
     * 
     * If the client is currently issuing large requests it may be possible succeed
     * with smaller requests. Use the getBitsLeft() call in this class to help
     * determine if an alternative request size is appropriate.
     */
     RandomOrgErrors.RandomOrgInsufficientBitsError = class RandomOrgInsufficientBitsError extends Error
    {
        // Stores the number of bits remaining
        #bits = -1;
        
        /**
         * Constructs a new exception with the specified detail message.
         * @constructor
         * @param {string} message The detail message.
         * @param {number} bits Bits remaining just before the error was thrown.
         */
        constructor(message, bits) {
            super(message);
            this.#bits = bits;
        }

        /**
         * Gets the number of bits remaining.
         * @returns {number} The number of bits left.
         */
        getBitsLeft() {
            return this.#bits;
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when its API key's server requests
     * allowance has been exceeded.
     * 
     * This indicates that a back-off until midnight UTC is in effect, before which
     * no requests will be sent by the client as no meaningful server responses will
     * be returned.
     */
    RandomOrgErrors.RandomOrgInsufficientRequestsError = class RandomOrgInsufficientRequestsError extends Error
    {
        /**
         * Constructs a new exception with the specified detail message.
         * @constructor
         * @param {string} message The detail message.
         */
        constructor(message) {
            super(message);
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when the server returns a JSON-RPC
     * Error. See https://api.random.org/json-rpc/4/error-codes
     */
    RandomOrgErrors.RandomOrgJSONRPCError = class RandomOrgJSONRPCError extends Error
    {
        /**
         * Constructs a new exception with the specified detail message.
         * @constructor
         * @param {string} message The detail message.
         */
        constructor(message) {
            super(message);
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when its API key has been stopped.
     * Requests will not complete while API key is in the stopped state.
     */
    RandomOrgErrors.RandomOrgKeyNotRunningError = class RandomOrgKeyNotRunningError extends Error
    {
        /**
         * Error thrown by the RandomOrgClient class when its API key has been stopped.
         * Requests will not complete while API key is in the stopped state.
         * @constructor
         * @param {string} message The detail message.
         */
        constructor(message) {
            super(message);
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when the server returns a
     * RANDOM.ORG Error. See https://api.random.org/json-rpc/4/error-codes
     */
    RandomOrgErrors.RandomOrgRANDOMORGError = class RandomOrgRANDOMORGError extends Error
    {
        // Stores the code of the RANDOM.ORG error
        #code = -1;

        /**
         * Error thrown by the RandomOrgClient class when the server returns a
         * RANDOM.ORG Error. See https://api.random.org/json-rpc/4/error-codes
         * @constructor
         * @param {string} message The detail message.
         * @param {number=} [code=-1] The error code.
         */
        constructor(message, code = -1) {
            super(message);    
            this.#code = code;
        }

        /**
         * Gets the RANDOM.ORG error code, see
         * https://api.random.org/json-rpc/4/error-codes
         * @returns {number} The error code.
         */
        getCode() {
            return this.#code;
        }
    };

    /**
     * Error thrown by the RandomOrgClient class when its set blocking timeout is
     * exceeded before the request can be sent.
     */
    RandomOrgErrors.RandomOrgSendTimeoutError = class RandomOrgSendTimeoutError extends Error
    {
        /**
         * Error thrown by the RandomOrgClient class when its set blocking timeout is
         * exceeded before the request can be sent.
         * @constructor
         * @param {string} message The detail message.
         */
        constructor(message) {
            super(message);
        }
    };

    /**
     * Error thrown when data retrieval from an emtpy RandomOrgCache is attempted.
     */
    RandomOrgErrors.RandomOrgCacheEmptyError = class RandomOrgCacheEmptyError extends Error
    {
        #paused = false;

        /**
         * Error thrown when data retrieval from an emtpy RandomOrgCache is attempted.
         * @constructor
         * @param {string} message The detail message.
         * @param {boolean} paused Reflects whether the RandomOrgCache instance was
         *     paused when this error was thrown.
         */
        constructor(message, paused = false) {
            super(message);
            this.#paused = paused;
        }

        /**
         * Returns whether the cache was paused at the time when the
         * error was thrown.
         * @returns {boolean} True if paused, false otherwise.
         */
        wasPaused() {
            return this.#paused;
        }
    };

    const {
        RandomOrgInsufficientBitsError: RandomOrgInsufficientBitsError$2,
        RandomOrgCacheEmptyError: RandomOrgCacheEmptyError$1
    } = RandomOrgErrors;
    /**
     * Precache class for frequently used requests.
     */
    var RandomOrgCache_1 = class RandomOrgCache {
        // function used to send a request
        #requestFunction = null;

        // request to be sent
        #request = null;

        // n for bulk requests
        #bulkRequestNumber = 0;
        // n for a single request
        #requestNumber = 0;
        // size of a single request in bits
        #requestSize = -1;

        // stores cached arrays of values
        #stack = [];
        // number of arrays to try to maintain in #stack
        #cacheSize = 10;

        // status of the cache
        #paused = false;
        // bits used by this cache
        #bitsUsed = 0;
        // requests used by this cache
        #requestsUsed = 0;
        // ensures #populate() does not issue parallel requests
        #currentlyPopulating = false;

        // an error which will be thrown on the next call to get() or getOrWait()
        #error = null;

        /**
         * Initialize class and start stack population
         * 
         * ** WARNING** Should only be called by RandomOrgClient's createCache()
         * methods.
         * @param {function(Object) : Object} requestFunction Function used to send
         *     supplied request to server.
         * @param {Object} request Request to send to server via requestFunction.
         * @param {number} cacheSize Number of request responses to try maintain.
         * @param {number} bulkRequestNumber If request is set to be issued in bulk,
         *     number of result sets in a bulk request, else 0.
         * @param {number} requestNumber If request is set to be issued in bulk,
         *     number of results in a single request, else 0.
         * @param {number} singleRequestSize Size of a single request in bits for
         *     adjusting bulk requests if bits are in short supply on the server.
         */
        constructor(requestFunction, request, cacheSize, bulkRequestNumber, requestNumber, singleRequestSize) {
            this.#requestFunction = requestFunction;

            this.#request = request;
            
            this.#cacheSize = cacheSize;

            this.#bulkRequestNumber = bulkRequestNumber;
            this.#requestNumber = requestNumber;
            this.#requestSize = singleRequestSize;

            this.#populate();
        }

        /**
         * Function to continue issuing requests until the stack is full.
         * 
         * Keep issuing requests to server until stack is full. When stack is full
         * if requests are being issued in bulk, wait until stack has enough space
         * to accommodate all of a bulk request before issuing a new request, otherwise
         * issue a new request every time an item in the stack has been consumed. Note
         * that requests are blocking ('await' is used when calling the requestFunction),
         * i.e., only one request will be issued by the cache at any given time.
         */
        #populate = async () => {
            if (!this.#currentlyPopulating && !this.#paused) {
                this.#currentlyPopulating = true;

                let response = null;

                while (true) {
                    if (this.#error != null) {
                        break;
                    }
                    if (this.#bulkRequestNumber > 0) {
                        // Is there space for a bulk response in the stack?
                        if (this.#stack.length <= (this.#cacheSize - this.#bulkRequestNumber)) {
                            try {
                                response = await this.#requestFunction(this.#request);
                                this.#addResponse(response, true);
                            } catch (e) {
                                // not enough bits remaining for a bulk request
                                if (e instanceof RandomOrgInsufficientBitsError$2) {
                                    let bitsLeft = e.getBitsLeft();
                                    if (bitsLeft > this.#requestSize) {
                                        // if possible, adjust request for the largest possible size
                                        let adjustedBulk = Math.floor(bitsLeft/this.#requestSize);
                                        this.#request.params.n = adjustedBulk * this.#requestNumber;

                                        response = await this.#requestFunction(this.#request);
                                        this.#addResponse(response, true);

                                        // reset to original bulk request size
                                        this.#request.params.n = this.#bulkRequestNumber * this.#requestNumber;
                                    } else {
                                        // request size cannot be adjusted
                                        this.#error = e;
                                    }                                
                                } else {
                                    // Any other error thrown during in the request function
                                    this.#error = e;
                                }
                            }
                        } else {
                            // no space for a bulk request
                            break;
                        }
                    } else if (this.#stack.length < this.#cacheSize) {
                        // individual requests
                        try {
                            response = await this.#requestFunction(this.#request);
                            this.#addResponse(response, false);
                        } catch(e) {
                            this.#error = e;
                        }
                    } else {
                        // the stack is full
                        break;
                    }
                }               

                this.#currentlyPopulating = false;
            }
        }

        /**
         * The cache will no longer continue to populate itself.
         */
        stop() {
            this.#paused = true;
        }

        /**
         * The cache will resume populating itself if stopped.
         */
        resume() {
            this.#paused = false;

            // check if it needs to be repopulated
            this.#refresh();
        }

        /**
         * Checks if the cache is currently not re-populating itself.
         * 
         * Values currently cached may still be retrieved with get() but no new
         * values are being fetched from the server. This state can be changed with
         * stop() and resume().
         * @returns {boolean} True if cache is currently not re-populating itself,
         *     false otherwise.
         */
        isPaused() {
            return this.#paused;
        }

        /**
         * Gets the next response.
         * Note that if the cache is empty, if was constructed with unsuitable parameter
         * values or if the daily allowance of bits/requests has been reached, the appropriate
         * error will be thrown.
         * @returns {any[]} The next appropriate response for the request this RandomOrgCache
         *     represents or, if stack is empty throws an error.
         * @throws RandomOrgCacheEmptyError if the cache is empty.
         */
        get() {
            if (this.#error != null) {
                throw this.#error;
            }
            if (this.#stack && this.#stack.length == 0) {
                if (this.#paused) {
                    throw new RandomOrgCacheEmptyError$1('The RandomOrgCache stack '
                        + 'is empty and the cache is paused. Please call resume() to '
                        + 'restart populating the cache.', true);            
                } else {
                    throw new RandomOrgCacheEmptyError$1('The RandomOrgCache stack '
                        + 'is empty, please wait for it to repopulate itself.');
                }
            } else {
                let data = this.#stack.pop();

                // check if it needs to be repopulated
                this.#refresh();

                return data;
            }
        }

        /**
         * Get next response or wait until the next value is available. This method
         * will block until a value is available. Note: this method will throw an error
         * if the cache is empty and has been paused, i.e. is not being populated. If
         * the cache was constructed with unsuitable parameter values or the daily allowance
         * of bits/requests has been reached, the appropriate error will also be thrown.
         * @returns {Promise<any[]>} The next appropriate response for the request this
         * RandomOrgCache represents.
         * @throws RandomOrgCacheEmptyError if the cache is empty and is paused.
         */
        async getOrWait() {
            try {
                let values = this.get();
                return values;
            } catch (e) {
                if (e instanceof RandomOrgCacheEmptyError$1) {
                    if (this.#paused) {
                        // The cache is paused and will not return any values
                        throw e;
                    }
                    let cachedValues = await this.#populate();
                    if (cachedValues == 0) {
                        // The cache has not yet repopulated.
                        await new Promise(r => setTimeout(r, 50));
                    }
                    return this.getOrWait();
                }
            }
        }

        /**
         * Gets the number of result sets remaining in the cache.
         * 
         * This essentially returns how often get() may be called without
         * a cache refill.
         * @returns {number} Current number of cached results.
         */
        getCachedValues() {
            return this.#stack.length;
        }

        /**
         * Gets the number of bits used by this cache.
         * @returns {number} Number of bits used.
         */
        getBitsUsed() {
            return this.#bitsUsed;
        }

        /**
         * Gets number of requests used by this cache.
         * @returns {number} Number of requests used.
         */
        getRequestsUsed() {
            return this.#requestsUsed;
        }

        /**
         * Helper function to check if the cache needs to be repopulated.
         */
        #refresh = () => {
            if (this.#bulkRequestNumber > 0 && this.#stack.length <= (this.#cacheSize - this.#bulkRequestNumber)) {
                // bulk requests
                this.#populate();
            }
            else if (this.#bulkRequestNumber <= 0 && this.#stack.length < this.#cacheSize) {
                // individual requests
                this.#populate();
            }
        }

        /**
         * Helper function to add a response to the stack.
         * @param {any[]} response The response received from the server.
         * @param {boolean} bulk True if the cache issues bulk requests, false otherwise.
         */
        #addResponse = (response, bulk) => {
            this.#requestsUsed++;
            this.#bitsUsed += response.result.bitsUsed;

            if (bulk) {
                let data = response.result.random.data;
                for (let i = 0; i < data.length; i += this.#requestNumber) {
                    this.#stack.push(data.slice(i, i + this.#requestNumber));
                }
            } else {
                this.#stack.push(response.result.random.data);
            }
        }
    };

    const {
        RandomOrgBadHTTPResponseError: RandomOrgBadHTTPResponseError$1,
        RandomOrgInsufficientBitsError: RandomOrgInsufficientBitsError$1,
        RandomOrgInsufficientRequestsError: RandomOrgInsufficientRequestsError$1,
        RandomOrgJSONRPCError: RandomOrgJSONRPCError$1,
        RandomOrgKeyNotRunningError: RandomOrgKeyNotRunningError$1,
        RandomOrgRANDOMORGError: RandomOrgRANDOMORGError$1,
        RandomOrgSendTimeoutError: RandomOrgSendTimeoutError$1
    } = RandomOrgErrors;
    const RandomOrgCache = RandomOrgCache_1;


    /**
     * RandomOrgClient main class through which API functions are accessed.
     * 
     * This class provides access to both the signed and unsigned methods of the
     * RANDOM.ORG API.
     * 
     * The class also provides access to the creation of a convenience class, RandomOrgCache,
     * for precaching API responses when the request is known in advance.
     * 
     * This class will only allow the creation of one instance per API key. If an
     * instance of this class already exists for a given key, that instance will be
     * returned instead of a new instance.
     * 
     * This class obeys most of the guidelines set forth in https://api.random.org/json-rpc/4
     * All requests respect the server's advisoryDelay returned in any responses, or use
     * DEFAULT_DELAY if no advisoryDelay is returned. If the supplied API key is paused, i.e.,
     * has exceeded its daily bit/request allowance, this implementation will back off until
     * midnight UTC.
     */
    var RandomOrgClient_1 = class RandomOrgClient {
        // Basic API
        static #INTEGER_METHOD = 'generateIntegers';
        static #INTEGER_SEQUENCE_METHOD = 'generateIntegerSequences';
        static #DECIMAL_FRACTION_METHOD = 'generateDecimalFractions';
        static #GAUSSIAN_METHOD = 'generateGaussians';
        static #STRING_METHOD = 'generateStrings';
        static #UUID_METHOD = 'generateUUIDs';
        static #BLOB_METHOD = 'generateBlobs';
        static #GET_USAGE_METHOD = 'getUsage';

        // Signed API
        static #SIGNED_INTEGER_METHOD = 'generateSignedIntegers';
        static #SIGNED_INTEGER_SEQUENCE_METHOD = 'generateSignedIntegerSequences';
        static #SIGNED_DECIMAL_FRACTION_METHOD = 'generateSignedDecimalFractions';
        static #SIGNED_GAUSSIAN_METHOD = 'generateSignedGaussians';
        static #SIGNED_STRING_METHOD = 'generateSignedStrings';
        static #SIGNED_UUID_METHOD = 'generateSignedUUIDs';
        static #SIGNED_BLOB_METHOD = 'generateSignedBlobs';
        static #GET_RESULT_METHOD = 'getResult';
        static #CREATE_TICKET_METHOD = 'createTickets';
        static #LIST_TICKET_METHOD = 'listTickets';
        static #GET_TICKET_METHOD = 'getTicket';
        static #VERIFY_SIGNATURE_METHOD = 'verifySignature';

        // Blob format literals
        /** Blob format literal, base64 encoding (default). */
        static BLOB_FORMAT_BASE64 = 'base64';
        /** Blob format literal, hex encoding. */
        static BLOB_FORMAT_HEX = 'hex';

        // Default values
        /** Default value for the replacement parameter (true). */
        static DEFAULT_REPLACEMENT = true;
        /** Default value for the base parameter (10). */
        static DEFAULT_BASE = 10;
        /** Default value for the userData parameter (null). */
        static DEFAULT_USER_DATA = null;
        /** Default value for the ticketId parameter (null). */
        static DEFAULT_TICKET_ID = null;
        /** Default value for the pregeneratedRandomization parameter (null). */
        static DEFAULT_PREGENERATED_RANDOMIZATION = null;
        /** Default value for the licenseData parameter (null). */
        static DEFAULT_LICENSE_DATA = null;

        /** Size of a single UUID in bits. */
        static UUID_SIZE = 122;
        /** Default value for the blockingTimeout parameter (1 day). */
        static DEFAULT_BLOCKING_TIMEOUT = 24 * 60 * 60 * 1000;
        /** Default value for the httpTimeout parameter (2 minutes). */
        static DEFAULT_HTTP_TIMEOUT = 120 * 1000;
        /** Maximum number of characters allowed in a signature verficiation URL. */
        static MAX_URL_LENGTH = 2046;

        // Default back-off to use if no advisoryDelay back-off supplied by server (1 second)
        static #DEFAULT_DELAY = 1*1000;

        // On request fetch fresh allowance state if current state data is older than
        // this value (1 hour).
        static #ALLOWANCE_STATE_REFRESH_SECONDS = 3600 * 1000;

        // Maintains usage statistics from server.
        #bitsLeft = -1;
        #requestsLeft = -1;

        // Back-off info for when the API key is detected as not running, probably
        // because the key has exceeded its daily usage limit. Back-off runs until
        // midnight UTC.
        #backoff = -1;
        #backoffError = '';

        #apiKey = '';
        #blockingTimeout = RandomOrgClient.DEFAULT_BLOCKING_TIMEOUT;
        #httpTimeout = RandomOrgClient.DEFAULT_HTTP_TIMEOUT;

        // Maintain info to obey server advisory delay
        #advisoryDelay = 0;
        #lastResponseReceivedTime = 0;

        // Maintains a dictionary of API keys and their instances.
        static #keyIndexedInstances = {};

        static #ERROR_CODES = [ 100, 101, 200, 201, 202, 203, 204, 300,
            301, 302, 303, 304, 305, 306, 307, 400, 401, 402, 403, 404,
            405, 420, 421, 422, 423, 424, 425, 500, 32000 ];

        /**
         * Constructor. Ensures only one instance of RandomOrgClient exists per API
         * key. Creates a new instance if the supplied key isn't already known,
         * otherwise returns the previously instantiated one.
         * @constructor
         * @param {string} apiKey API key of instance to create/find, obtained from
         *     RANDOM.ORG, see https://api.random.org/api-keys
         * @param {{blockingTimeout?: number, httpTimeout?: number}} options An object
         *     which may contains any of the following optional parameters:
         * @param {number} [options.blockingTimeout = 24 * 60 * 60 * 1000] Maximum
         *     time in milliseconds to wait before being allowed to send a request.
         *     Note this is a hint not a guarantee. The advisory delay from server
         *     must always be obeyed. Supply a value of -1 to allow blocking forever
         *     (default 24 * 60 * 60 * 1000, i.e., 1 day).
         * @param {number} [options.httpTimeout = 120 * 1000] Maximum time in
         *     milliseconds to wait for the server response to a request (default
         *     120*1000).
         */
        constructor(apiKey, options = {}) {
            if (RandomOrgClient.#keyIndexedInstances && RandomOrgClient.#keyIndexedInstances[apiKey]) {
                return RandomOrgClient.#keyIndexedInstances[apiKey];
            } else {
                this.#apiKey = apiKey;
                this.#blockingTimeout = options.blockingTimeout || 24 * 60 * 60 * 1000;
                this.#httpTimeout = options.httpTimeout || 120 * 1000;

                RandomOrgClient.#keyIndexedInstances[apiKey] = this;
            }
        }

        // Basic API

        /**
         * Requests and returns an array of true random integers within a user-defined
         * range from the server.
         * 
         * See: https://api.random.org/json-rpc/4/basic#generateIntegers
         * @param {number} n The number of random integers you need. Must be within
         *     the [1,1e4] range.
         * @param {number} min The lower boundary for the range from which the random
         *     numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {number} max The upper boundary for the range from which the random
         *     numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {{replacement?: boolean, base?: number, pregeneratedRandomization?:
         *     Object}} options An object which may contains any of the following
         *     optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {number} [options.base=10] The base that will be used to display
         *     the numbers. Values allowed are 2, 8, 10 and 16 (default 10).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {(Promise<number[]>|Promise<string[]>)} A Promise which, if
         *     resolved successfully, represents an array of true random integers.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         * */
        async generateIntegers(n, min, max, options = {}) {
            let request = this.#integerRequest(n, min, max, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns an array of true random integer sequences within a
         * user-defined range from the server.
         * 
         * See: https://api.random.org/json-rpc/4/basic#generateIntegerSequences
         * @param {number} n How many arrays of random integers you need. Must be
         *     within the [1,1e3] range.
         * @param {(number|number[])} length The length of each array of random
         *     integers requested. For uniform sequences, length must be an integer
         *     in the [1, 1e4] range. For multiform sequences, length can be an array
         *     with n integers, each specifying the length of the sequence identified
         *     by its index. In this case, each value in length must be within the
         *     [1, 1e4] range and the total sum of all the lengths must be in the
         *     [1, 1e4] range.
         * @param {(number|number[])} min The lower boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, min must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, min can
         *     be an array with n integers, each specifying the lower boundary of the
         *     sequence identified by its index. In this case, each value in min must
         *     be within the [-1e9, 1e9] range.
         * @param {(number|number[])} max The upper boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, max must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, max can
         *     be an array with n integers, each specifying the upper boundary of the
         *     sequence identified by its index. In this case, each value in max must
         *     be within the [-1e9, 1e9] range.
         * @param {{replacement?: boolean|boolean[], base?: number|number[],
         *     pregeneratedRandomization?: Object}} options An object which may contains
         *     any of the following optional parameters:
         * @param {(boolean|boolean[])} [options.replacement=true] Specifies whether
         *     the random numbers should be picked with replacement. If true, the
         *     resulting numbers may contain duplicate values, otherwise the numbers
         *     will all be unique. For multiform sequences, replacement can be an array
         *     with n boolean values, each specifying whether the sequence identified
         *     by its index will be created with (true) or without (false) replacement
         *     (default true).
         * @param {(number|number[])} [options.base=10] The base that will be used
         *     to display the numbers. Values allowed are 2, 8, 10 and 16. For multiform
         *     sequences, base can be an array with n integer values taken from the
         *     same set, each specifying the base that will be used to display the
         *     sequence identified by its index (default 10).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {(Promise<number[][]>|Promise<string[][]>)} A Promise which, if
         *     resolved successfully, represents an array of true random integer
         *     sequences.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateIntegerSequences(n, length, min, max, options = {}) {
            let request = this.#integerSequenceRequest(n, length, min, max, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns a list (size n) of true random decimal fractions,
         * from a uniform distribution across the [0,1] interval with a user-defined
         * number of decimal places from the server.
         * 
         * See: https://api.random.org/json-rpc/4/basic#generateDecimalFractions
         * @param {number} n How many random decimal fractions you need. Must be
         *     within the [1,1e4] range.
         * @param {number} decimalPlaces The number of decimal places to use. Must be
         *     within the [1,20] range.
         * @param {{replacement?: boolean, pregeneratedRandomization?: Object}} options
         *     An object which may contains any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {Promise<number[]>} A Promise which, if resolved successfully,
         *     represents an array of true random decimal fractions.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateDecimalFractions(n, decimalPlaces, options = {}) {
            let request = this.#decimalFractionRequest(n, decimalPlaces, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns a list (size n) of true random numbers from a
         * Gaussian distribution (also known as a normal distribution).
         * 
         * The form uses a Box-Muller Transform to generate the Gaussian distribution
         * from uniformly distributed numbers.
         * See: https://api.random.org/json-rpc/4/basic#generateGaussians
         * @param {number} n How many random numbers you need. Must be within the
         *     [1,1e4] range.
         * @param {number} mean The distribution's mean. Must be within the
         *     [-1e6,1e6] range.
         * @param {number} standardDeviation The distribution's standard deviation.
         *     Must be within the [-1e6,1e6] range.
         * @param {number} significantDigits The number of significant digits to use.
         *     Must be within the [2,20] range.
         * @param {{pregeneratedRandomization?: Object}} options An object which may
         *     contains any of the following optional parameters:
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {Promise<number[]>} A Promise which, if resolved successfully,
         *     represents an array of true random numbers from a Gaussian distribution.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateGaussians(n, mean, standardDeviation, significantDigits, options = {}) {
            let request = this.#gaussianRequest(n, mean, standardDeviation,
                significantDigits, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns a list (size n) of true random unicode strings from
         * the server. See: https://api.random.org/json-rpc/4/basic#generateStrings
         * @param {number} n How many random strings you need. Must be within the
         *     [1,1e4] range.
         * @param {number} length The length of each string. Must be within the
         *     [1,20] range. All strings will be of the same length.
         * @param {string} characters A string that contains the set of characters
         *     that are allowed to occur in the random strings. The maximum number
         *     of characters is 80.
         * @param {{replacement?: boolean, pregeneratedRandomization?: Object}} options
         *     An object which may contains any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     strings should be picked with replacement. If true, the resulting list
         *     of strings may contain duplicates, otherwise the strings will all be
         *     unique (default true).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {Promise<string[]>} A Promise which, if resolved successfully,
         *     represents an array of true random strings.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateStrings(n, length, characters, options = {}) {
            let request = this.#stringRequest(n, length, characters, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns a list (size n) of version 4 true random Universally
         * Unique IDentifiers (UUIDs) in accordance with section 4.4 of RFC 4122,
         * from the server.
         * 
         * See: https://api.random.org/json-rpc/4/basic#generateUUIDs
         * @param {number} n How many random UUIDs you need. Must be within the
         *     [1,1e3] range.
         * @param {{pregeneratedRandomization?: Object}} options An object which may
         *     contains any of the following optional parameters:
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {Promise<string[]>} A Promise which, if resolved successfully,
         *     represents an array of true random UUIDs.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateUUIDs(n, options = {}) {
            let request = this.#UUIDRequest(n, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        /**
         * Requests and returns a list (size n) of Binary Large OBjects (BLOBs)
         * as unicode strings containing true random data from the server.
         * 
         * See: https://api.random.org/json-rpc/4/basic#generateBlobs
         * @param {number} n How many random blobs you need. Must be within the
         *     [1,100] range.
         * @param {number} size The size of each blob, measured in bits. Must be
         *     within the [1,1048576] range and must be divisible by 8.
         * @param {{format?: string, pregeneratedRandomization?: Object}} options
         *     An object which may contains any of the following optional parameters:
         * @param {string} [options.format='base64'] Specifies the format in which
         *     the blobs will be returned. Values allowed are 'base64' and 'hex'
         *     (default 'base64').
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @returns {Promise<number[]>} A Promise which, if resolved successfully,
         *     represents an array of true random blobs as strings.
         * @see {@link RandomOrgClient#BLOB_FORMAT_BASE64} for 'base64' (default).
         * @see {@link RandomOrgClient#BLOB_FORMAT_HEX} for 'hex'.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateBlobs(n, size, options = {}) {
            let request = this.#blobRequest(n, size, options);
            return this.#extractBasic(this.#sendRequest(request));
        }

        // SIGNED API

        /**
         * Requests a list (size n) of true random integers within a user-defined
         * range from the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed integer list mapped to 'data', the original response mapped
         * to 'random', and the response's signature mapped to 'signature'.
         * See: https://api.random.org/json-rpc/4/signed#generateSignedIntegers
         * @param {number} n How many random integers you need. Must be within the
         *     [1,1e4] range.
         * @param {number} min The lower boundary for the range from which the
         *     random numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {number} max The upper boundary for the range from which the
         *     random numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {{replacement?: boolean, base?: number, pregeneratedRandomization?:
         *     Object, licenseData?: Object, userData?: Object|number|string, ticketId?:
         *     string}} options An object which may contains any of the following
         *     optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {number} [options.base=10] The base that will be used to display
         *     the numbers. Values allowed are 2, 8, 10 and 16 (default 10).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (string) form is
         *     1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier obtained
         *     via the {@link RandomOrgClient#createTickets} method. Specifying a value
         *     for ticketId will cause RANDOM.ORG to record that the ticket was used
         *     to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: number[]|string[], random: Object, signature: string}>}
         *     A Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random integers
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedIntegers(n, min, max, options = {}) {
            let request = this.#integerRequest(n, min, max, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Requests and returns uniform or multiform sequences of true random integers
         * within user-defined ranges from the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed array of integer sequences mapped to 'data', the original
         * response mapped to 'random', and the response's signature mapped to
         * 'signature'.
         * See: https://api.random.org/json-rpc/4/signed#generateIntegerSequences
         * @param {number} n How many arrays of random integers you need. Must be
         *     within the [1,1e3] range.
         * @param {(number|number[])} length The length of each array of random
         *     integers requested. For uniform sequences, length must be an integer
         *     in the [1, 1e4] range. For multiform sequences, length can be an array
         *     with n integers, each specifying the length of the sequence identified
         *     by its index. In this case, each value in length must be within the
         *     [1, 1e4] range and the total sum of all the lengths must be in the
         *     [1, 1e4] range.
         * @param {(number|number[])} min The lower boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, min must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, min can
         *     be an array with n integers, each specifying the lower boundary of the
         *     sequence identified by its index. In this case, each value in min must
         *     be within the [-1e9, 1e9] range.
         * @param {(number|number[])} max The upper boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, max must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, max can
         *     be an array with n integers, each specifying the upper boundary of the
         *     sequence identified by its index. In this case, each value in max must
         *     be within the [-1e9, 1e9] range.
         * @param {{replacement?: boolean|boolean[], base?: number|number[],
         *     pregeneratedRandomization?: Object, licenseData?: Object, userData?:
         *     Object|number|string, ticketId?: string}} options An object which may
         *     contains any of the following optional parameters:
         * @param {(boolean|boolean[])} [options.replacement=true] Specifies whether
         *     the random numbers should be picked with replacement. If true, the
         *     resulting numbers may contain duplicate values, otherwise the numbers
         *     will all be unique. For multiform sequences, replacement can be an array
         *     with n boolean values, each specifying whether the sequence identified by
         *     its index will be created with (true) or without (false) replacement
         *     (default true).
         * @param {(number|number[])} [options.base=10] The base that will be used to
         *     display the numbers. Values allowed are 2, 8, 10 and 16. For multiform
         *     sequences, base can be an array with n integer values taken from the same
         *     set, each specifying the base that will be used to display the sequence
         *     identified by its index (default 10).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form
         *     is 1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: number[][]|string[][], random: Object, signature: string}>}
         *     A Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random integer sequences
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedIntegerSequences(n, length, min, max, options = {}) {
            let request = this.#integerSequenceRequest(n, length, min, max, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Request a list (size n) of true random decimal fractions, from a uniform
         * distribution across the [0,1] interval with a user-defined number of
         * decimal places from the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed decimal fractions mapped to 'data', the original response
         * mapped to 'random', and the response's signature mapped to 'signature'. See:
         * https://api.random.org/json-rpc/4/signed#generateSignedDecimalFractions
         * @param {number} n How many random decimal fractions you need. Must be
         *     within the [1,1e4] range.
         * @param {number} decimalPlaces The number of decimal places to use. Must
         *     be within the [1,20] range.
         * @param {{replacement?: boolean, pregeneratedRandomization?: Object, licenseData?:
         *     Object, userData?: Object|number|string, ticketId?: string}} options An
         *     object which may contains any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form
         *     is 1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: number[], random: Object, signature: string}>} A
         *     Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random decimal fractions
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedDecimalFractions(n, decimalPlaces, options = {}) {
            let request = this.#decimalFractionRequest(n, decimalPlaces, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Request a list (size n) of true random numbers from a Gaussian distribution
         * (also known as a normal distribution).
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed numbers mapped to 'data', the original response mapped to
         * 'random', and the response's signature mapped to 'signature'. See:
         * https://api.random.org/json-rpc/4/signed#generateSignedGaussians
         * @param {number} n How many random numbers you need. Must be within the
         *     [1,1e4] range.
         * @param {number} mean The distribution's mean. Must be within the [-1e6,1e6]
         *     range.
         * @param {number} standardDeviation The distribution's standard deviation.
         *     Must be within the [-1e6,1e6] range.
         * @param {number} significantDigits The number of significant digits to use.
         *     Must be within the [2,20] range.
         * @param {{pregeneratedRandomization?: Object, licenseData?: Object, userData?:
         *     Object|number|string, ticketId?: string}} options An object which may
         *     contains any of the following optional parameters:
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form
         *     is 1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: number[], random: Object, signature: string}>} A
         *     Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random numbers from a Gaussian distribution
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedGaussians(n, mean, standardDeviation, significantDigits, options = {}) {
            let request = this.#gaussianRequest(n, mean, standardDeviation, significantDigits,
                options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Request a list (size n) of true random strings from the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed strings mapped to 'data', the original response mapped to
         * 'random', and the response's signature mapped to 'signature'. See:
         * https://api.random.org/json-rpc/4/signed#generateSignedStrings
         * @param {number} n How many random strings you need. Must be within the
         *     [1,1e4] range.
         * @param {number} length The length of each string. Must be within the [1,20]
         *     range. All strings will be of the same length.
         * @param {string} characters A string that contains the set of characters
         *     that are allowed to occur in the random strings. The maximum number
         *     of characters is 80.
         * @param {{replacement?: boolean, pregeneratedRandomization?: Object, licenseData?:
         *     Object, userData?: Object|number|string, ticketId?: string}} options An
         *     object which may contains any of the following optional parameters:
         * @param {boolean} [options.replacement=null] Specifies whether the random
         *     strings should be picked with replacement. If true, the resulting list
         *     of strings may contain duplicates, otherwise the strings will all be
         *     unique (default true).
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form
         *     is 1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: string[], random: Object, signature: string}>} A
         *     Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random strings
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedStrings(n, length, characters, options = {}) {
            let request = this.#stringRequest(n, length, characters, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Request a list (size n) of version 4 true random Universally Unique
         * IDentifiers (UUIDs) in accordance with section 4.4 of RFC 4122, from
         * the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed UUIDs mapped to 'data', the original response mapped to
         * 'random', and the response's signature mapped to 'signature'. See:
         * https://api.random.org/json-rpc/4/signed#generateSignedUUIDs
         * @param {number} n How many random UUIDs you need. Must be within the
         *     [1,1e3] range.
         * @param {{pregeneratedRandomization?: Object, licenseData?: Object, userData?:
         *     Object|string|number, ticketId?: string}} options An object which may
         *     contain any of the following optional parameters:
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form
         *     is 1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: string[], random: Object, signature: string}>} A
         *     Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random UUIDs
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedUUIDs(n, options = {}) {
            let request = this.#UUIDRequest(n, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * Request a list (size n) of Binary Large OBjects (BLOBs) containing true
         * random data from the server.
         * 
         * Returns a Promise which, if resolved successfully, respresents an object
         * with the parsed BLOBs mapped to 'data', the original response mapped to
         * 'random', and the response's signature mapped to 'signature'. See:
         * https://api.random.org/json-rpc/4/signed#generateSignedBlobs
         * @param {number} n How many random blobs you need. Must be within the
         *     [1,100] range.
         * @param {number} size The size of each blob, measured in bits. Must be
         *     within the [1,1048576] range and must be divisible by 8.
         * @param {{format?: string, pregeneratedRandomization?: Object, licenseData?:
         *     Object, userData?: Object|number|string, ticketId?: string}} options An
         *     object which may contain any of the following optional parameters:
         * @param {string} [options.format='base64'] Specifies the format in which the
         *     blobs will be returned. Values allowed are 'base64' and 'hex' (default
         *     'base64').
         * @param {Object} [options.pregeneratedRandomization=null] A dictionary object
         *     which allows the client to specify that the random values should be
         *     generated from a pregenerated, historical randomization instead of a
         *     one-time on-the-fly randomization. There are three possible cases:
         * * **null**: The standard way of calling for random values, i.e.true
         *       randomness is generated and discarded afterwards.
         * * **date**: RANDOM.ORG uses historical true randomness generated on the
         *       corresponding date (past or present, format: { 'date', 'YYYY-MM-DD' }).
         * * **id**: RANDOM.ORG uses historical true randomness derived from the
         *       corresponding identifier in a deterministic manner. Format: { 'id',
         *       'PERSISTENT-IDENTIFIER' } where 'PERSISTENT-IDENTIFIER' is a string
         *       with length in the [1, 64] range.
         * @param {Object} [options.licenseData=null] A dictionary object which allows
         *     the caller to include data of relevance to the license that is associated
         *     with the API Key. This is mandatory for API Keys with the license type
         *     'Flexible Gambling' and follows the format { 'maxPayout': { 'currency':
         *     'XTS', 'amount': 0.0 }}. This information is used in licensing
         *     requested random values and in billing. The currently supported
         *     currencies are: 'USD', 'EUR', 'GBP', 'BTC', 'ETH'. The most up-to-date
         *     information on the currencies can be found in the Signed API
         *     documentation, here: https://api.random.org/json-rpc/4/signed
         * @param {(string|number|Object)} [options.userData=null] Object that will be
         *     included in unmodified form. Its maximum size in encoded (String) form is
         *     1,000 characters (default null).
         * @param {string} [options.ticketId=null] A string with ticket identifier
         *     obtained via the {@link RandomOrgClient#createTickets} method. Specifying
         *     a value for ticketId will cause RANDOM.ORG to record that the ticket was
         *     used to generate the requested random values. Each ticket can only be used
         *     once (default null).
         * @returns {Promise<{data: string[], random: Object, signature: string}>} A
         *     Promise which, if resolved successfully, represents an object with the
         *     following structure:
         * * **data**: array of true random blobs as strings
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @see {@link RandomOrgClient#BLOB_FORMAT_BASE64} for 'base64' (default).
         * @see {@link RandomOrgClient#BLOB_FORMAT_HEX} for 'hex'.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async generateSignedBlobs(n, size, options = {}) {
            let request = this.#blobRequest(n, size, options, true);
            return this.#extractSigned(this.#sendRequest(request));
        }

        // OTHER METHODS

        /**
         * Verifies the signature of a response previously received from one of the
         * methods in the Signed API with the server.
         * 
         * This is used to examine the authenticity of numbers. Returns True on
         * verification success. See:
         * https://api.random.org/json-rpc/4/signed#verifySignature
         * @param {Object} random The random field from a response returned by RANDOM.ORG
         *     through one of the Signed API methods.
         * @param {string} signature The signature field from the same response that
         *     the random field originates from.
         * @returns {Promise<boolean>} A Promise which, if resolved successfully,
         *     represents whether the result could be verified (true) or not (false).
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async verifySignature(random, signature) {
            let params = {
                random: random,
                signature: signature
            };
            let request = this.#generateRequest(RandomOrgClient.#VERIFY_SIGNATURE_METHOD, params);
            return this.#extractVerification(this.#sendRequest(request));
        }

        /**
         * Returns the (estimated) number of remaining true random bits available to
         * the client. If cached usage info is older than an hour, fresh info is
         * obtained from the server.
         * @returns {Promise<number>} A Promise which, if resolved successfully,
         *     represents the number of bits remaining.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async getBitsLeft() {
            let update = Date.now() > (this.#lastResponseReceivedTime + RandomOrgClient.#ALLOWANCE_STATE_REFRESH_SECONDS);
            if (this.#bitsLeft < 0 || update) {
                await this.#getUsage();
            }
            return this.#bitsLeft;
        }

        /**
         * Returns the (estimated) number of remaining API requests available to the
         * client. If cached usage info is older than an hour, fresh info is
         * obtained from the server.
         * @returns {Promise<number>} A Promise which, if resolved successfully,
         *     represents the number of requests remaining.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async getRequestsLeft() {
            let update = Date.now() > (this.#lastResponseReceivedTime + RandomOrgClient.#ALLOWANCE_STATE_REFRESH_SECONDS);
            if (this.#requestsLeft < 0 || update) {
                await this.#getUsage();
            }
            return this.#requestsLeft;
        }

        /**
         * Retrieves signed random values generated within the last 24h, using a
         * serial number.
         * 
         * If the historical response was found, the response will contain the same
         * values that were returned by the method that was used to generate the values
         * initially. See: https://api.random.org/json-rpc/4/signed#getResult
         * @param {number} serialNumber An integer containing the serial number
         *     associated with the response you wish to retrieve.
         * @returns {Promise<Object>} A Promise which, if resolved successfully,
         *     represents an object with the following structure, identical to that
         *     returned by the original request:
         * * **data**: array of true random values
         * * **random**: random field as returned from the server
         * * **signature**: signature string
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async getResult(serialNumber) {
            let params = {
                serialNumber: serialNumber
            };
            let request = this.#generateKeyedRequest(RandomOrgClient.#GET_RESULT_METHOD, params);
            return this.#extractSigned(this.#sendRequest(request));
        }

        /**
         * @typedef {Object} NewTicket A ticket as it is returned by the createTickets() method.
         * @property {string} ticketId A string value that uniquely identifies the ticket.
         * @property {string} creationTime A string containing the timestamp in ISO 8601
         *     format at which the ticket was created.
         * @property {string} previousTicketId The previous ticket in the chain to which this
         *     ticket belongs. Since a new chain only contains one ticket, previousTicketId will
         *     be null.
         * @property {string} nextTicketId A string value that identifies the next ticket in
         *     the chain. Since a new chain only contains one ticket, nextTicketId will be null.
         */

        /**
         * @typedef {Object} Ticket A ticket as it is returned by the listTickets() and
         *     getTicket() methods.
         * @property {string} ticketId A string value that uniquely identifies the ticket.
         * @property {string} hashedApiKey The hashed API key for which the ticket is valid.
         * @property {boolean} showResult If false, getTicket() will return only the basic
         *     ticket information. If true, the full random and signature objects from the
         *     response that was used to satisfy the ticket is returned. For more information,
         *     please see the documentation for getTicket.
         * @property {string} creationTime The timestamp in ISO 8601 format at which the ticket
         *     was created.
         * @property {string} usedTime The timestamp in ISO 8601 format at which the ticket was
         *     used. If the ticket has not been used yet, this value is null.
         * @property {number} serialNumber A numeric value indicating which serial number
         *     (within the API key used to serve the ticket) was used for the ticket. If the
         *     caller has the unhashed API key, they can use the serialNumber returned to obtain
         *     the full result via the getResult method. If the ticket has not been used yet,
         *     this value is null.
         * @property {string} expirationTime The timestamp in ISO 8601 format at which the ticket
         *     expires. If the ticket has not been used yet, this value is null.
         * @property {string} previousTicketId The previous ticket in the chain to which this
         *     ticket belongs. If the ticket is the first in its chain, then previousTicketId is
         *     null.
         * @property {string} nextTicketId A string value that identifies the next
         *     ticket in the chain.
         * @property {Object} [result] The same object that was returned by the method that was
         *     originally used to generate the values.
         */

        /**
         * Creates n tickets to be used in signed value-generating methods.
         *  
         * See: https://api.random.org/json-rpc/4/signed#createTickets
         * @param {number} n The number of tickets requested. This must be a number
         *     in the [1, 50] range.
         * @param {boolean} showResult A boolean value that determines how much
         *     information calls to {@link getTicket} will return.
         * * **false**: getTicket will return only the basic ticket information.
         * * **true**: the full random and signature objects from the response that
         *     was used to satisfy the ticket is returned. 
         * @returns {Promise<NewTicket[]>} A Promise which, if resolved successfully,
         *     represents an array of ticket objects with the following structure:
         * * **ticketId**: A string value that uniquely identifies the ticket.
         * * **creationTime**: The time when the ticket was created (ISO 8601 format).
         * * **nextTicketId**: A string pointing to the next ticket in the chain.
         *     This will be null, as the tickets returned from this method are the
         *     first in their respective chains.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async createTickets(n, showResult) {
            let params = {
                n: n,
                showResult: showResult
            };
            let request = this.#generateKeyedRequest(RandomOrgClient.#CREATE_TICKET_METHOD, params);
            return this.#extractResult(this.#sendRequest(request));
        }

        /**
         * Obtains information about tickets linked with your API key.
         * 
         * The maximum number of tickets that can be returned by this method is 2000.
         * See: https://api.random.org/json-rpc/4/signed#listTickets
         * @param {string} ticketType A string describing the type of tickets you want
         *     to obtain information about. Possible values are 'singleton', 'head'
         *     and 'tail'.
         * * **'singleton'** returns tickets that have no previous or next tickets.
         * * **'head'** returns tickets hat do not have a previous ticket but that do
         *     have a next ticket.
         * * **'tail'** returns tickets that have a previous ticket but do not have a
         *       next ticket.
         * @returns {Promise<Ticket[]>} A Promise which, if resolved successfully,
         *     represents an array of ticket objects, as returned from the server.
         *     **NOTE:** The objects returned from this method do not contain "result"
         *     fields, even if tickets were created with "showResult" set to true.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async listTickets(ticketType) {
            let params = {
                ticketType: ticketType
            };
            let request = this.#generateKeyedRequest(RandomOrgClient.#LIST_TICKET_METHOD, params);
            return this.#extractResult(this.#sendRequest(request));
        }

        /**
         * Obtains information about a single ticket using the ticketId associated
         * with it.
         *  
         * If the ticket has showResult set to true and has been used, this method
         * will return the values generated.
         * See: https://api.random.org/json-rpc/4/signed#getTicket
         * @param {string} ticketId A string containing a ticket identifier returned
         *     by a prior call to the {@link createTickets} method. 
         * @returns {Promise<Ticket>} A Promise which, if resolved successfully,
         *     represents an object containing the following information:
         * * **ticketId**: A string value that uniquely identifies the ticket.
         * * **hashedApiKey**: The hashed API key for which the ticket is valid.
         * * **showResult**: If false, getTicket() will return only the basic
         *     ticket information. If true, the full random and signature objects
         *     from the response that was used to satisfy the ticket is returned.
         *     For more information, please see the documentation for getTicket.
         * * **creationTime**: The timestamp in ISO 8601 format at which the ticket
         *     was created.
         * * **usedTime** The timestamp in ISO 8601 format at which the ticket was
         *     used. If the ticket has not been used yet, this value is null.
         * * **serialNumber**: A numeric value indicating which serial number (within
         *     the API key used to serve the ticket) was used for the ticket. If the
         *     caller has the unhashed API key, they can use the serialNumber returned
         *     to obtain the full result via the getResult method. If the ticket has
         *     not been used yet, this value is null.
         * * **expirationTime**: The timestamp in ISO 8601 format at which the ticket
         *     expires. If the ticket has not been used yet, this value is null.
         * * **previousTicketId**: The previous ticket in the chain to which this ticket
         *     belongs. If the ticket is the first in its chain, then previousTicketId is
         *     null.
         * * **nextTicketId** A string value that identifies the next
         *     ticket in the chain.
         * 
         *     If showResult was set to true when the ticket was created,
         *     the following field will also be added:
         * * **result** The same object that was returned by the method that was originally
         *     used to generate the values. This includes the random field which contains the
         *     data property, and a signature field, required to verify the result.
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        async getTicket(ticketId) {
            let params = {
                ticketId: ticketId
            };
            let request = this.#generateRequest(RandomOrgClient.#GET_TICKET_METHOD, params);
            return this.#extractResult(this.#sendRequest(request));
        }

        /**
         * Create the URL for the signature verification page of a response previously
         * received from one of the methods in the Signed API with the server. The
         * web-page accessible from this URL will contain the details of the response
         * used in this method, provided that the signature can be verified. This
         * URL is also shown under "Show Technical Details" when the online Signature
         * Verification Form is used to validate a signature. See:
         * https://api.random.org/signatures/form
         * @param {Object} random The random field from a response returned by
         *     RANDOM.ORG through one of the Signed API methods.
         * @param {string} signature The signature field from the same response
         *     that the random field originates from.
         * @returns {string} A string containing the signature verification URL.
         * @throws RandomOrgRANDOMORGError when the URL is too long (max. 2,046
         *     characters).
         */
        createUrl(random, signature) {
            let formattedRandom = this.#formatUrl(JSON.stringify(random));
            let formattedSignature = this.#formatUrl(signature);
            
            let url = 'https://api.random.org/signatures/form?format=json';    
            url += '&random=' + formattedRandom;
            url += '&signature=' + formattedSignature;
            
            if (url.length > RandomOrgClient.MAX_URL_LENGTH) {
                throw new RandomOrgRANDOMORGError$1('Error: URL exceeds maximum length'
                    + '(' + RandomOrgClient.MAX_URL_LENGTH + ' characters).');
            }
            
            return url;
        }

        /**
         * Create the HTML form for the signature verification page of a response
         * previously received from one of the methods in the Signed API with the
         * server. The web-page accessible from the "Validate" button created will
         * contain the details of the response used in this method, provided that
         * the signature can be verified. The same HTML form is also shown under
         * "Show Technical Details" when the online Signature Verification Form is
         * used to validate a signature. See: https://api.random.org/signatures/form
         * @param {Object} random The random field from a response returned by
         *     RANDOM.ORG through one of the Signed API methods.
         * @param {string} signature The signature field from the same response
         *     that the random field originates from.
         * @returns {string} A string containing the code for the HTML form.
         */
        createHtml(random, signature) {
            let s = '<form action=\'https://api.random.org/signatures/form\' method=\'post\'>\n';
            s += '  ' + this.#inputHTML('hidden', 'format', 'json') + '\n';
            s += '  ' + this.#inputHTML('hidden', 'random', JSON.stringify(random)) + '\n';
            s += '  ' + this.#inputHTML('hidden', 'signature', signature) + '\n';
            s += '  <input type=\'submit\' value=\'Validate\' />\n</form>';
            return s;
        }

        // CREATING CACHES

        /**
         * Gets a RandomOrgCache to obtain random integers.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random integers you need. Must be within the
         *     [1,1e4] range.
         * @param {number} min The lower boundary for the range from which the random
         *     numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {number} max The upper boundary for the range from which the random
         *     numbers will be picked. Must be within the [-1e9,1e9] range.
         * @param {{replacement?: boolean, base?: number, cacheSize?: number}} options
         *     An object which may contain any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {number} [options.base=10] The base that will be used to display the
         *     numbers. Values allowed are 2, 8, 10 and 16 (default 10).
         * @param {number} [options.cacheSize=20] The number of result-sets for the
         *     cache to try to maintain at any given time (default 20, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random integers.
         */
        createIntegerCache(n, min, max, options = {}) {
            let cacheSize = options.cacheSize || 20;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            let request = this.#integerRequest(n, min, max, options);

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = Math.ceil(Math.log(max - min + 1) / Math.log(2) * n);
            let bulkN = 0;
            
            // If possible, make requests more efficient by bulk-ordering from the
            // server. Initially set at cacheSize/2, but cache will auto-shrink bulk
            // request size if requests can't be fulfilled.
            if (!('replacement' in options) || options.replacement === true) {
                bulkN = cacheSize / 2;
                request.params.n = n * bulkN;
            }

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize,
                bulkN, n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain random integer sequences.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random integer sequences you need. Must be within
         *     the [1,1e4] range.
         * @param {(number|number[])} length The length of each array of random
         *     integers requested. For uniform sequences, length must be an integer
         *     in the [1, 1e4] range. For multiform sequences, length can be an array
         *     with n integers, each specifying the length of the sequence identified
         *     by its index. In this case, each value in length must be within the
         *     [1, 1e4] range and the total sum of all the lengths must be in the
         *     [1, 1e4] range.
         * @param {(number|number[])} min The lower boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, min must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, min can
         *     be an array with n integers, each specifying the lower boundary of the
         *     sequence identified by its index. In this case, each value in min must
         *     be within the [-1e9, 1e9] range.
         * @param {(number|number[])} max The upper boundary for the range from which
         *     the random numbers will be picked. For uniform sequences, max must be
         *     an integer in the [-1e9, 1e9] range. For multiform sequences, max can
         *     be an array with n integers, each specifying the upper boundary of the
         *     sequence identified by its index. In this case, each value in max must
         *     be within the [-1e9, 1e9] range.
         * @param {{replacement?: boolean|boolean[], base?: number|number[],
         *     cacheSize?: number}} options An object which may contain any of the
         *     following optional parameters:
         * @param {boolean|boolean[]} replacement Specifies whether the random numbers
         *     should be picked with replacement. If true, the resulting numbers may
         *     contain duplicate values, otherwise the numbers will all be unique. For
         *     multiform sequences, replacement can be an array with n boolean values,
         *     each specifying whether the sequence identified by its index will be
         *     created with (true) or without (false) replacement (default true).
         * @param {number|number[]} base The base that will be used to display the numbers.
         *     Values allowed are 2, 8, 10 and 16. For multiform sequences, base can
         *     be an array with n integer values taken from the same set, each
         *     specifying the base that will be used to display the sequence identified
         *     by its index (default 10).
         * @param {number} cacheSize The number of result-sets for the cache to try
         *     to maintain at any given time (default 20, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random integer sequences.
         */
        createIntegerSequenceCache(n, length, min, max, options = {}) {
            let cacheSize = options.cacheSize || 20;
            if (cacheSize < 2) {
                cacheSize = 2;
            }
            
            let maxRequestSize = Math.ceil(Math.log(this.#maxValue(max) - this.#minValue(min), + 1)
                / Math.log(2) * n * this.#maxValue(length));

            // If possible, make requests more efficient by bulk-ordering from the
            // server. Initially set at cacheSize/2, but cache will auto-shrink bulk
            // request size if requests can't be fulfilled.
            let bulkN = 0;

            // if replacement is an array, check if all values are set to true
            let repl;
            if (options.replacement && Array.isArray(options.replacement)) {
                repl = options.replacement.every(x => x === true);
            } else {
                repl = options.replacement || true;
            }

            // if bulk requests can be used, make adjustments to array-type parameters
            if (repl) {
                bulkN = cacheSize / 2;
                
                if (Array.isArray(length)) {
                    length = this.#adjust(length, bulkN);
                }

                if (Array.isArray(min)) {
                    min = this.#adjust(min, bulkN);
                }

                if (Array.isArray(max)) {
                    max = this.#adjust(max, bulkN);
                }

                if (options.replacement && Array.isArray(options.replacement)) {
                    options.replacement = this.#adjust(options.replacement, bulkN);
                }

                if (options.base && Array.isArray(options.base)) {
                    options.base = this.#adjust(options.base, bulkN);
                }
            }

            let request = this.#integerSequenceRequest(n, length, min, max,
                options);

            if (repl) {
                request.params.n = bulkN * n;
            }

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN, n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain random decimal fractions.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random decimal fractions you need. Must be
         *     within the [1,1e4] range.
         * @param {number} decimalPlaces The number of decimal places to use. Must
         *     be within the [1,20] range.
         * @param {{replacement?: boolean, cacheSize?: number}} options An object which
         *     may contain any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     numbers should be picked with replacement. If true, the resulting numbers
         *     may contain duplicate values, otherwise the numbers will all be unique
         *     (default true).
         * @param {number} [options.cacheSize=20] The number of result-sets for the cache
         *     to try to maintain at any given time (default 20, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random decimal fractions.
         */
        createDecimalFractionCache(n, decimalPlaces, options = {}) {
            let cacheSize = options.cacheSize || 20;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            let request = this.#decimalFractionRequest(n, decimalPlaces, options);

            let bulkN = 0;
            
            // If possible, make requests more efficient by bulk-ordering from the
            // server. Initially set at cacheSize/2, but cache will auto-shrink bulk
            // request size if requests can't be fulfilled.
            if (!('replacement' in options) || options.replacement === true) {
                bulkN = cacheSize / 2;
                request.params.n = n * bulkN;
            }

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = Math.ceil(Math.log(10) / Math.log(2) * decimalPlaces * n);

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN,
                n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain random numbers from a Gaussian distribution.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random numbers you need. Must be within the
         *     [1,1e4] range.
         * @param {number} mean The distribution's mean. Must be within the
         *     [-1e6,1e6] range.
         * @param {number} standardDeviation The distribution's standard deviation.
         *     Must be within the [-1e6,1e6] range.
         * @param {number} significantDigits The number of significant digits to use.
         *     Must be within the [2,20] range.
         * @param {{cacheSize?: number}} options An object which may contain the following
         *     optional parameter:
         * @param {number} [options.cacheSize=20] The number of result-sets for the cache
         *     to try to maintain at any given time (default 20, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random numbers from a Gaussian
         *     distribution.
         */
        createGaussianCache(n, mean, standardDeviation, significantDigits, options = {}) {
            let cacheSize = options.cacheSize || 20;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = Math.ceil(Math.log(Math.pow(10, significantDigits)) / Math.log(2) * n);

            // make requests more efficient by bulk-ordering from the server.
            // Initially set at cacheSize/2, but cache will auto-shrink bulk request
            // size if requests can't be fulfilled.
            let bulkN = cacheSize / 2;
            let request = this.#gaussianRequest(n * bulkN, mean, standardDeviation,
                significantDigits);

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN,
                n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain random strings.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random strings you need. Must be within the
         *     [1,1e4] range.
         * @param {number} length The length of each string. Must be within the [1,20]
         *     range. All strings will be of the same length.
         * @param {string} characters A string that contains the set of characters
         *     that are allowed to occur in the random strings. The maximum number
         *     of characters is 80.
         * @param {{replacement?: boolean, cacheSize?: number}} options An object which
         *     may contain any of the following optional parameters:
         * @param {boolean} [options.replacement=true] Specifies whether the random
         *     strings should be picked with replacement. If true, the resulting list
         *     of strings may contain duplicates, otherwise the strings will all be
         *     unique (default true).
         * @param {number} [options.cacheSize=20] The number of result-sets for the
         *     cache to try to maintain at any given time (default 20, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random strings.
         */
        createStringCache(n, length, characters, options = {}) {
            let cacheSize = options.cacheSize || 20;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            let request = this.#stringRequest(n, length, characters, options);

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = Math.ceil(Math.log(characters.length) / Math.log(2) * length * n);
            
            // If possible, make requests more efficient by bulk-ordering from the
            // server. Initially set at cache_size/2, but cache will auto-shrink bulk
            // request size if requests can't be fulfilled.
            let bulkN = 0;
            if (!('replacement' in options) || options.replacement === true) {
                bulkN = cacheSize / 2;
                request.params.n = n * bulkN;
            }
            
            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN,
                n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain UUIDs.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random UUIDs you need. Must be within the
         *     [1,1e3] range.
         * @param {{cacheSize?: number}} options An object which may contain the following
         *     optional parameter:
         * @param {number} [options.cacheSize=10] The number of result-sets for the cache
         *     to try to maintain at any given time (default 10, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random UUIDs.
         */
        createUUIDCache(n, options = {}) {
            let cacheSize = options.cacheSize || 10;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = n * RandomOrgClient.UUID_SIZE;

            // make requests more efficient by bulk-ordering from the server. Initially
            // set at cacheSize/2, but cache will auto-shrink bulk request size if
            // requests can't be fulfilled.
            let bulkN = cacheSize / 2;
            let request = this.#UUIDRequest(n * bulkN);

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN,
                n, maxRequestSize);
        }

        /**
         * Gets a RandomOrgCache to obtain random blobs.
         * 
         * The RandomOrgCache can be polled for new results conforming to the output
         * format of the input request.
         * @param {number} n How many random blobs you need. n*(cacheSize/2) must be
         *     within the [1,100] range.
         * @param {number} size The size of each blob, measured in bits. Must be
         *     within the [1,1048576] range and must be divisible by 8.
         * @param {{format?: string, cacheSize?: number}} options An object which may
         *     contain any of the following optional parameters:
         * @param {string} [options.format=base64] Specifies the format in which the
         *     blobs will be returned. Values allowed are 'base64' and 'hex' (default
         *     'base64').
         * @param {number} [options.cacheSize=10] The number of result-sets for the cache
         *     to try to maintain at any given time (default 10, minimum 2).
         * @returns {RandomOrgCache} An instance of the RandomOrgCache class which
         *     can be polled for arrays of true random blobs as strings.
         * @see {@link RandomOrgClient#BLOB_FORMAT_BASE64} for 'base64' (default).
         * @see {@link RandomOrgClient#BLOB_FORMAT_HEX} for 'hex'.
         */
        createBlobCache(n, size, options = {}) {
            let cacheSize = options.cacheSize || 10;
            if (cacheSize < 2) {
                cacheSize = 2;
            }

            // max single request size, in bits, for adjusting bulk requests later
            let maxRequestSize = n * size;

            // make requests more efficient by bulk-ordering from the server. Initially
            // set at cacheSize/2, but cache will auto-shrink bulk request size if
            // requests can't be fulfilled.
            let bulkN = cacheSize / 2;
            let request = this.#blobRequest(n * bulkN, size, options);

            return new RandomOrgCache(this.#sendRequest.bind(this), request, cacheSize, bulkN,
                n, maxRequestSize);
        }

        /**
         * Core send request function.
         * @param {Object} request Request object to send.
         * @returns {Promise<Object>} A Promise which, if resolved successfully,
         *     represents the response provided by the server. Else, it may be rejected
         *     with one of the following errors:
         * @throws {RandomOrgSendTimeoutError} Thrown when blocking timeout is exceeded
         *     before the request can be sent.
         * @throws {RandomOrgKeyNotRunningError} Thrown when the API key has been
         *     stopped.
         * @throws {RandomOrgInsufficientRequestsError} Thrown when the API key's server
         *     requests allowance has been exceeded.
         * @throws {RandomOrgInsufficientBitsError} Thrown when the API key's server
         *     bits allowance has been exceeded.
         * @throws {RandomOrgBadHTTPResponseError} Thrown when a HTTP 200 OK response
         *     is not received.
         * @throws {RandomOrgRANDOMORGError} Thrown when the server returns a RANDOM.ORG
         *     Error.
         * @throws {RandomOrgJSONRPCError} Thrown when the server returns a JSON-RPC Error.
         */
        #sendRequest = async function (request) {
            // If a back-off is set, no more requests can be issued until the required 
            // back-off time is up.
            if (this.#backoff != -1) {            
                // Time not yet up, throw error.
                if (Date.now() < this.#backoff) {
                    throw new RandomOrgInsufficientRequestsError$1(this.#backoffError);
                // Time is up, clear back-off.
                } else {
                    this.#backoff = -1;
                    this.#backoffError = null;
                }
            }

            let wait = this.#advisoryDelay - (Date.now() - this.#lastResponseReceivedTime);

            if (this.#blockingTimeout != -1 && wait > this.#blockingTimeout) {
                throw new RandomOrgSendTimeoutError$1('The server advisory delay of ' 
                    + wait + 'millis is greater than the defined maximum allowed '
                    + 'blocking time of ' + this.#blockingTimeout + 'millis.');
            }

            if (wait > 0) { await new Promise(r => setTimeout(r, wait)); }

            let httpTimeout = this.#httpTimeout;

            return new Promise(function(resolve) {
                let xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://api.random.org/json-rpc/4/invoke');
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.ontimeout = function() {
                    throw new RandomOrgSendTimeoutError$1('The maximum '
                        + 'allowed blocking time of ' + httpTimeout + 'millis has '
                        + 'been exceeded while waiting for the server to respond.');
                };
                xhr.onload = function() {
                    if (this.status >= 200 && this.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        throw new RandomOrgBadHTTPResponseError$1('Error: '
                            + xhr.status);
                   }
                };
                xhr.onerror = function(e) {
                    // undocumented error.
                    if (e instanceof Error) {
                        throw e;
                    } else {
                        console.info('** An error occurred during the transaction.');
                        throw new Error(xhr.responseText);
                    }
                };
                xhr.timeout = httpTimeout;
                xhr.send(JSON.stringify(request));
            })
            .then(response => {
                // parse response to get an object
                response = JSON.parse(response);

                // check for errors
                if (response.error) {
                    let code = response.error.code;
                    let message = response.error.message;
                    let data = response.error.data;

                    if (code == 401) {
                        throw new RandomOrgKeyNotRunningError$1('Error '
                            + code + ': ' + message);
                    } else if (code == 402) {
                        let midnightUTC = new Date().setUTCHours(0,0,0,0);
                        this.#backoff = +midnightUTC;
                        this.#backoffError = 'Error ' + code + ': ' + message;

                        this.#requestsLeft = data[1];

                        throw new RandomOrgInsufficientRequestsError$1(this.#backoffError);
                    } else if (code == 403) {
                        this.#bitsLeft = data[1];
                        throw new RandomOrgInsufficientBitsError$1('Error'
                            + code + ': ' + message, this.#bitsLeft);
                    } else if (RandomOrgClient.#ERROR_CODES.includes(code)) {
                        // RandomOrgRANDOMORGError from RANDOM.ORG Errors: 
                        // https://api.random.org/json-rpc/4/error-codes
                        throw new RandomOrgRANDOMORGError$1('Error '
                            + code + ': ' + message, code);
                    } else {
                        // RandomOrgJSONRPCError from JSON-RPC Errors: 
                        // https://api.random.org/json-rpc/4/error-codes
                        throw new RandomOrgJSONRPCError$1('Error '
                            + code + ': ' + message);
                    }
                }

                // Methods which do not update fields such as requestsLeft, bitsLeft or
                // advisoryDelay.
                let independent_methods = [
                    RandomOrgClient.#VERIFY_SIGNATURE_METHOD,
                    RandomOrgClient.#GET_RESULT_METHOD,
                    RandomOrgClient.#CREATE_TICKET_METHOD,
                    RandomOrgClient.#LIST_TICKET_METHOD,
                    RandomOrgClient.#GET_TICKET_METHOD
                ];

                // Update information
                if (!independent_methods.includes(request.method)) {
                    this.#requestsLeft = response.result.requestsLeft;
                    this.#bitsLeft = response.result.bitsLeft;
                    if (response.result.advisoryDelay) {
                        this.#advisoryDelay = response.result.advisoryDelay;
                    } else {
                        // Use default if none from server.
                        this.#advisoryDelay = RandomOrgClient.#DEFAULT_DELAY;
                    }
                } else {
                    // Use default advisoryDelay.
                    this.#advisoryDelay = RandomOrgClient.#DEFAULT_DELAY;
                }
                this.#lastResponseReceivedTime = Date.now();
                 
                return response;
            });
        }

        /**
         * Issues a getUsage request and returns the information on the usage
         * of the API key associated with this client, as it is returned by the
         * server. Can also be used to update bits and requests left.
         * @returns {Promise} A Promise, which if resolved successfully, represents
         *     the result field as returned by the server.
         */
        #getUsage = async () => {
            let request = this.#generateKeyedRequest(RandomOrgClient.#GET_USAGE_METHOD, {});
            return this.#extractResult(this.#sendRequest(request));
        }

        /**
         * Adds generic request parameters to custom request.
         * @param {string} method Method to send request to.
         * @param {Object} params Custom parameters to generate request around.
         * @returns {Object} Fleshed out request object.
         */
        #generateRequest = (method, params) => {
            let id = this.#uuidv4();
            let request = {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: id
            };

            return request;
        }

        /**
         * Adds generic request parameters and API key to custom request.
         * @param {string} method Method to send request to.
         * @param {Object} params Custom parameters to generate request around.
         * @returns {Object} Fleshed out request object.
         */
        #generateKeyedRequest = (method, params) => {
            params['apiKey'] = this.#apiKey;
            return this.#generateRequest(method, params);
        }

        /**
         * Extracts basic data from response object.
         * @param {Object} response Object from which to extract data.
         * @returns {any[]} Extracted data as an array.
         */
        #extractBasic = async response => {
            return response.then(data => {
                return data.result.random.data;
            });
        }

        /**
         * Gets data, random field and signature from response and returns these as
         * a new object.
         * @param {Object} response Object from which to extract the information.
         * @returns {Promise<{data: number[]|number[][]|string[]|string[][], random: Object,
         *     signature: string}>} The response split into data, random and signature fields.
         */
        #extractSigned = async response => {
            return response.then(data => {
                return {
                    data: data.result.random.data,
                    random: data.result.random,
                    signature: data.result.signature
                };
            });
        }

        /**
         * Gets verification response as separate from response object.
         * @param {Object} response Response object from which to extract
         *     verification response.
         * @returns {Promise<boolean>} Verification success.
         */
        #extractVerification = async response => {
            return response.then(data => {
                return data.result.authenticity;
            });
        }

        /**
         * Extracts the information returned under the 'result' field.
         * @param {Object} response Response object returned from the server.
         * @returns {Promise<Object>} All data contained in the 'result' field.
         */
        #extractResult = async response => {
            return response.then(data => {
                return data.result;
            });
        }

        /**
         * Helper function to generate requests for integers.
         */
        #integerRequest = (n, min, max, { replacement = true, base = 10, pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n,
                min: min,
                max: max,
                replacement: replacement,
                base: base
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_INTEGER_METHOD : RandomOrgClient.#INTEGER_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for integer sequences.
         */
        #integerSequenceRequest = (n, length, min, max, { replacement = true, base = 10, pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n,
                length: length,
                min: min,
                max: max,
                replacement: replacement,
                base: base
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_INTEGER_SEQUENCE_METHOD : RandomOrgClient.#INTEGER_SEQUENCE_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for decimal fractions.
         */
        #decimalFractionRequest = (n, decimalPlaces, { replacement = true, pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n,
                decimalPlaces: decimalPlaces,
                replacement: replacement
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);
            
            let method = signed ? RandomOrgClient.#SIGNED_DECIMAL_FRACTION_METHOD : RandomOrgClient.#DECIMAL_FRACTION_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for Gaussians.
         */
        #gaussianRequest = (n, mean, standardDeviation, significantDigits, { pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n,
                mean: mean,
                standardDeviation: standardDeviation,
                significantDigits: significantDigits
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_GAUSSIAN_METHOD : RandomOrgClient.#GAUSSIAN_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for strings.
         */
        #stringRequest = (n, length, characters, { replacement = true, pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n,
                length: length,
                characters: characters,
                replacement: replacement
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_STRING_METHOD : RandomOrgClient.#STRING_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for UUIDs.
         */
        #UUIDRequest = (n, { pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null } = {}, signed = false) => {
            let params = {
                n: n
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_UUID_METHOD : RandomOrgClient.#UUID_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to generate requests for blobs.
         */
        #blobRequest = (n, size, { format = this.BASE64, pregeneratedRandomization = null, licenseData = null, userData = null, ticketId = null }, signed = false) => {
            let params = {
                n: n,
                size: size,
                format: format
            };

            params = this.#addOptionalParams(params, pregeneratedRandomization,
                licenseData, userData, ticketId, signed);

            let method = signed ? RandomOrgClient.#SIGNED_BLOB_METHOD : RandomOrgClient.#BLOB_METHOD;

            return this.#generateKeyedRequest(method, params);
        }

        /**
         * Helper function to add optional parameters which are common across
         * value-generating methods.
         */
        #addOptionalParams = (params, pregeneratedRandomization, licenseData, userData, ticketId, signed = false) => {
            // available for both Basic and Signed API methods
            params.pregeneratedRandomization = pregeneratedRandomization;

            // optional parameters used exclusively for Signed API methods
            if (signed) {
                params.licenseData = licenseData;
                params.userData = userData;
                params.ticketId = ticketId;
            }
            
            return params;
        }

        /**
         * Helper function for creating an integer sequence cache. 
         * @param {any[]} original The array to be repeated.
         * @param {number} n The number of times the original array is to be
         *     repeated.
         * @returns {any[]} A new array which contains the original array repeated
         *     n times.
         */
        #adjust = (original, n) => {
            return Array.from({ length: n }, () => original).flat();
        }

        /**
         * Helper function for creating an integer sequence cache.
         * @param {(number|number[])} a An array of integers (or a single value).
         * @returns {number} Largest value in the array (or a, unchanged, if it
         *     is not an array).
         */
        #maxValue = a => {
            if (Array.isArray(a)) {
                return a.reduce(function(x, y) {
                    return Math.max(x, y);
                });
            } else {
                return a;
            }
        }

        /**
         * Helper function for creating an integer sequence cache.
         * @param {(number|number[])} a An array of integers (or a single value).
         * @returns {number} Smallest value in the array (or a, unchanged, if it
         *     is not an array).
         */
        #minValue = a => {
            if (Array.isArray(a)) {
                return a.reduce(function(x, y) {
                    return Math.min(x, y);
                });
            } else {
                return a;
            }
        }

        /** Helper function to make a string URL-safe (base64 and percent-encoding) */
        #formatUrl = s => {
            let pattern = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
            let isBase64 = pattern.test(s);

            if (!isBase64) {
                try {
                    if (window) {
                        // browser
                        s = btoa(s);
                    }
                } catch(e) {
                    if (e instanceof ReferenceError) {
                        // NodeJS
                        s = Buffer.from(s).toString('base64');
                    }
                }
            }

            // Percent-Encoding as described in RFC 3986 for PHP
            s = s.replace(/=/g, '%3D');
            s = s.replace(/\+/g, '%2B');
            s = s.replace(/\//g, '%2F');

            return s
        }

        /** Helper function to create a HTML input tag */
        #inputHTML = (type, name, value) => {
            return '<input type=\'' + type + '\' name=\'' + name + '\' value=\'' + value + '\' />';
        }

        /** Helper function to generate UUIDs to be used as "id" in requests to the server. */
        #uuidv4 = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16 | 0;
                return (c == 'x' ? r : (r&0x3|0x8)).toString(16);
            });
        }
    };

    /** 
     * ES Module wrapper, allowing this library to be imported using
     * ES6+ syntax. The RandomOrgClient class is both the default and
     * a named export. All error classes, are available only as named
     * exports.
     * */

    let RandomOrgRANDOMORGError = RandomOrgErrors.RandomOrgRANDOMORGError;
    let RandomOrgBadHTTPResponseError = RandomOrgErrors.RandomOrgBadHTTPResponseError;
    let RandomOrgInsufficientBitsError = RandomOrgErrors.RandomOrgInsufficientBitsError;
    let RandomOrgInsufficientRequestsError = RandomOrgErrors.RandomOrgInsufficientRequestsError;
    let RandomOrgJSONRPCError = RandomOrgErrors.RandomOrgJSONRPCError;
    let RandomOrgKeyNotRunningError = RandomOrgErrors.RandomOrgKeyNotRunningError;
    let RandomOrgSendTimeoutError = RandomOrgErrors.RandomOrgSendTimeoutError;
    let RandomOrgCacheEmptyError = RandomOrgErrors.RandomOrgCacheEmptyError;

    exports.RandomOrgBadHTTPResponseError = RandomOrgBadHTTPResponseError;
    exports.RandomOrgCache = RandomOrgCache_1;
    exports.RandomOrgCacheEmptyError = RandomOrgCacheEmptyError;
    exports.RandomOrgClient = RandomOrgClient_1;
    exports.RandomOrgInsufficientBitsError = RandomOrgInsufficientBitsError;
    exports.RandomOrgInsufficientRequestsError = RandomOrgInsufficientRequestsError;
    exports.RandomOrgJSONRPCError = RandomOrgJSONRPCError;
    exports.RandomOrgKeyNotRunningError = RandomOrgKeyNotRunningError;
    exports.RandomOrgRANDOMORGError = RandomOrgRANDOMORGError;
    exports.RandomOrgSendTimeoutError = RandomOrgSendTimeoutError;
    exports['default'] = RandomOrgClient_1;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRvY29yZS5paWZlLmpzIiwic291cmNlcyI6WyIuLi9SYW5kb21PcmdFcnJvcnMuanMiLCIuLi9SYW5kb21PcmdDYWNoZS5qcyIsIi4uL1JhbmRvbU9yZ0NsaWVudC5qcyIsIi4uL2VzbS9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XHJcblxyXG4vKipcclxuICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiB0aGUgY29ubmVjdGlvbiBkb2Vzbid0IHJldHVyblxyXG4gKiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlLlxyXG4gKi9cclxuZXhwb3J0cy5SYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3RzIGEgbmV3IGV4Y2VwdGlvbiB3aXRoIHRoZSBzcGVjaWZpZWQgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gaXRzIEFQSSBrZXkncyByZXF1ZXN0IGhhc1xyXG4gKiBleGNlZWRlZCBpdHMgcmVtYWluaW5nIHNlcnZlciBiaXRzIGFsbG93YW5jZS5cclxuICogXHJcbiAqIElmIHRoZSBjbGllbnQgaXMgY3VycmVudGx5IGlzc3VpbmcgbGFyZ2UgcmVxdWVzdHMgaXQgbWF5IGJlIHBvc3NpYmxlIHN1Y2NlZWRcclxuICogd2l0aCBzbWFsbGVyIHJlcXVlc3RzLiBVc2UgdGhlIGdldEJpdHNMZWZ0KCkgY2FsbCBpbiB0aGlzIGNsYXNzIHRvIGhlbHBcclxuICogZGV0ZXJtaW5lIGlmIGFuIGFsdGVybmF0aXZlIHJlcXVlc3Qgc2l6ZSBpcyBhcHByb3ByaWF0ZS5cclxuICovXHJcbiBleHBvcnRzLlJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8vIFN0b3JlcyB0aGUgbnVtYmVyIG9mIGJpdHMgcmVtYWluaW5nXHJcbiAgICAjYml0cyA9IC0xO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdHMgYSBuZXcgZXhjZXB0aW9uIHdpdGggdGhlIHNwZWNpZmllZCBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJpdHMgQml0cyByZW1haW5pbmcganVzdCBiZWZvcmUgdGhlIGVycm9yIHdhcyB0aHJvd24uXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGJpdHMpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgICAgICB0aGlzLiNiaXRzID0gYml0cztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIG51bWJlciBvZiBiaXRzIHJlbWFpbmluZy5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgYml0cyBsZWZ0LlxyXG4gICAgICovXHJcbiAgICBnZXRCaXRzTGVmdCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4jYml0cztcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gaXRzIEFQSSBrZXkncyBzZXJ2ZXIgcmVxdWVzdHNcclxuICogYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gKiBcclxuICogVGhpcyBpbmRpY2F0ZXMgdGhhdCBhIGJhY2stb2ZmIHVudGlsIG1pZG5pZ2h0IFVUQyBpcyBpbiBlZmZlY3QsIGJlZm9yZSB3aGljaFxyXG4gKiBubyByZXF1ZXN0cyB3aWxsIGJlIHNlbnQgYnkgdGhlIGNsaWVudCBhcyBubyBtZWFuaW5nZnVsIHNlcnZlciByZXNwb25zZXMgd2lsbFxyXG4gKiBiZSByZXR1cm5lZC5cclxuICovXHJcbmV4cG9ydHMuUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3IgZXh0ZW5kcyBFcnJvclxyXG57XHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdHMgYSBuZXcgZXhjZXB0aW9uIHdpdGggdGhlIHNwZWNpZmllZCBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDXHJcbiAqIEVycm9yLiBTZWUgaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Vycm9yLWNvZGVzXHJcbiAqL1xyXG5leHBvcnRzLlJhbmRvbU9yZ0pTT05SUENFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ0pTT05SUENFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0cyBhIG5ldyBleGNlcHRpb24gd2l0aCB0aGUgc3BlY2lmaWVkIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gaXRzIEFQSSBrZXkgaGFzIGJlZW4gc3RvcHBlZC5cclxuICogUmVxdWVzdHMgd2lsbCBub3QgY29tcGxldGUgd2hpbGUgQVBJIGtleSBpcyBpbiB0aGUgc3RvcHBlZCBzdGF0ZS5cclxuICovXHJcbmV4cG9ydHMuUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yID0gY2xhc3MgUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgLyoqXHJcbiAgICAgKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBBUEkga2V5IGhhcyBiZWVuIHN0b3BwZWQuXHJcbiAgICAgKiBSZXF1ZXN0cyB3aWxsIG5vdCBjb21wbGV0ZSB3aGlsZSBBUEkga2V5IGlzIGluIHRoZSBzdG9wcGVkIHN0YXRlLlxyXG4gICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGFcclxuICogUkFORE9NLk9SRyBFcnJvci4gU2VlIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9lcnJvci1jb2Rlc1xyXG4gKi9cclxuZXhwb3J0cy5SYW5kb21PcmdSQU5ET01PUkdFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgLy8gU3RvcmVzIHRoZSBjb2RlIG9mIHRoZSBSQU5ET00uT1JHIGVycm9yXHJcbiAgICAjY29kZSA9IC0xO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYVxyXG4gICAgICogUkFORE9NLk9SRyBFcnJvci4gU2VlIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9lcnJvci1jb2Rlc1xyXG4gICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcj19IFtjb2RlPS0xXSBUaGUgZXJyb3IgY29kZS5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobWVzc2FnZSwgY29kZSA9IC0xKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7ICAgIFxyXG4gICAgICAgIHRoaXMuI2NvZGUgPSBjb2RlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgUkFORE9NLk9SRyBlcnJvciBjb2RlLCBzZWVcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9lcnJvci1jb2Rlc1xyXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGVycm9yIGNvZGUuXHJcbiAgICAgKi9cclxuICAgIGdldENvZGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2NvZGU7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBzZXQgYmxvY2tpbmcgdGltZW91dCBpc1xyXG4gKiBleGNlZWRlZCBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAqL1xyXG5leHBvcnRzLlJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3IgPSBjbGFzcyBSYW5kb21PcmdTZW5kVGltZW91dEVycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgLyoqXHJcbiAgICAgKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBzZXQgYmxvY2tpbmcgdGltZW91dCBpc1xyXG4gICAgICogZXhjZWVkZWQgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biB3aGVuIGRhdGEgcmV0cmlldmFsIGZyb20gYW4gZW10cHkgUmFuZG9tT3JnQ2FjaGUgaXMgYXR0ZW1wdGVkLlxyXG4gKi9cclxuZXhwb3J0cy5SYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IgPSBjbGFzcyBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IgZXh0ZW5kcyBFcnJvclxyXG57XHJcbiAgICAjcGF1c2VkID0gZmFsc2U7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFcnJvciB0aHJvd24gd2hlbiBkYXRhIHJldHJpZXZhbCBmcm9tIGFuIGVtdHB5IFJhbmRvbU9yZ0NhY2hlIGlzIGF0dGVtcHRlZC5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwYXVzZWQgUmVmbGVjdHMgd2hldGhlciB0aGUgUmFuZG9tT3JnQ2FjaGUgaW5zdGFuY2Ugd2FzXHJcbiAgICAgKiAgICAgcGF1c2VkIHdoZW4gdGhpcyBlcnJvciB3YXMgdGhyb3duLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBwYXVzZWQgPSBmYWxzZSkge1xyXG4gICAgICAgIHN1cGVyKG1lc3NhZ2UpO1xyXG4gICAgICAgIHRoaXMuI3BhdXNlZCA9IHBhdXNlZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgd2hldGhlciB0aGUgY2FjaGUgd2FzIHBhdXNlZCBhdCB0aGUgdGltZSB3aGVuIHRoZVxyXG4gICAgICogZXJyb3Igd2FzIHRocm93bi5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHBhdXNlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gICAgICovXHJcbiAgICB3YXNQYXVzZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI3BhdXNlZDtcclxuICAgIH1cclxufSIsIid1c2Ugc3RyaWN0JztcclxuY29uc3Qge1xyXG4gICAgUmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yXHJcbn0gPSByZXF1aXJlKCcuL1JhbmRvbU9yZ0Vycm9ycy5qcycpO1xyXG4vKipcclxuICogUHJlY2FjaGUgY2xhc3MgZm9yIGZyZXF1ZW50bHkgdXNlZCByZXF1ZXN0cy5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgUmFuZG9tT3JnQ2FjaGUge1xyXG4gICAgLy8gZnVuY3Rpb24gdXNlZCB0byBzZW5kIGEgcmVxdWVzdFxyXG4gICAgI3JlcXVlc3RGdW5jdGlvbiA9IG51bGw7XHJcblxyXG4gICAgLy8gcmVxdWVzdCB0byBiZSBzZW50XHJcbiAgICAjcmVxdWVzdCA9IG51bGw7XHJcblxyXG4gICAgLy8gbiBmb3IgYnVsayByZXF1ZXN0c1xyXG4gICAgI2J1bGtSZXF1ZXN0TnVtYmVyID0gMDtcclxuICAgIC8vIG4gZm9yIGEgc2luZ2xlIHJlcXVlc3RcclxuICAgICNyZXF1ZXN0TnVtYmVyID0gMDtcclxuICAgIC8vIHNpemUgb2YgYSBzaW5nbGUgcmVxdWVzdCBpbiBiaXRzXHJcbiAgICAjcmVxdWVzdFNpemUgPSAtMTtcclxuXHJcbiAgICAvLyBzdG9yZXMgY2FjaGVkIGFycmF5cyBvZiB2YWx1ZXNcclxuICAgICNzdGFjayA9IFtdO1xyXG4gICAgLy8gbnVtYmVyIG9mIGFycmF5cyB0byB0cnkgdG8gbWFpbnRhaW4gaW4gI3N0YWNrXHJcbiAgICAjY2FjaGVTaXplID0gMTA7XHJcblxyXG4gICAgLy8gc3RhdHVzIG9mIHRoZSBjYWNoZVxyXG4gICAgI3BhdXNlZCA9IGZhbHNlO1xyXG4gICAgLy8gYml0cyB1c2VkIGJ5IHRoaXMgY2FjaGVcclxuICAgICNiaXRzVXNlZCA9IDA7XHJcbiAgICAvLyByZXF1ZXN0cyB1c2VkIGJ5IHRoaXMgY2FjaGVcclxuICAgICNyZXF1ZXN0c1VzZWQgPSAwO1xyXG4gICAgLy8gZW5zdXJlcyAjcG9wdWxhdGUoKSBkb2VzIG5vdCBpc3N1ZSBwYXJhbGxlbCByZXF1ZXN0c1xyXG4gICAgI2N1cnJlbnRseVBvcHVsYXRpbmcgPSBmYWxzZTtcclxuXHJcbiAgICAvLyBhbiBlcnJvciB3aGljaCB3aWxsIGJlIHRocm93biBvbiB0aGUgbmV4dCBjYWxsIHRvIGdldCgpIG9yIGdldE9yV2FpdCgpXHJcbiAgICAjZXJyb3IgPSBudWxsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbGl6ZSBjbGFzcyBhbmQgc3RhcnQgc3RhY2sgcG9wdWxhdGlvblxyXG4gICAgICogXHJcbiAgICAgKiAqKiBXQVJOSU5HKiogU2hvdWxkIG9ubHkgYmUgY2FsbGVkIGJ5IFJhbmRvbU9yZ0NsaWVudCdzIGNyZWF0ZUNhY2hlKClcclxuICAgICAqIG1ldGhvZHMuXHJcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCkgOiBPYmplY3R9IHJlcXVlc3RGdW5jdGlvbiBGdW5jdGlvbiB1c2VkIHRvIHNlbmRcclxuICAgICAqICAgICBzdXBwbGllZCByZXF1ZXN0IHRvIHNlcnZlci5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0IFJlcXVlc3QgdG8gc2VuZCB0byBzZXJ2ZXIgdmlhIHJlcXVlc3RGdW5jdGlvbi5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjYWNoZVNpemUgTnVtYmVyIG9mIHJlcXVlc3QgcmVzcG9uc2VzIHRvIHRyeSBtYWludGFpbi5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidWxrUmVxdWVzdE51bWJlciBJZiByZXF1ZXN0IGlzIHNldCB0byBiZSBpc3N1ZWQgaW4gYnVsayxcclxuICAgICAqICAgICBudW1iZXIgb2YgcmVzdWx0IHNldHMgaW4gYSBidWxrIHJlcXVlc3QsIGVsc2UgMC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZXF1ZXN0TnVtYmVyIElmIHJlcXVlc3QgaXMgc2V0IHRvIGJlIGlzc3VlZCBpbiBidWxrLFxyXG4gICAgICogICAgIG51bWJlciBvZiByZXN1bHRzIGluIGEgc2luZ2xlIHJlcXVlc3QsIGVsc2UgMC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaW5nbGVSZXF1ZXN0U2l6ZSBTaXplIG9mIGEgc2luZ2xlIHJlcXVlc3QgaW4gYml0cyBmb3JcclxuICAgICAqICAgICBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBpZiBiaXRzIGFyZSBpbiBzaG9ydCBzdXBwbHkgb24gdGhlIHNlcnZlci5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IocmVxdWVzdEZ1bmN0aW9uLCByZXF1ZXN0LCBjYWNoZVNpemUsIGJ1bGtSZXF1ZXN0TnVtYmVyLCByZXF1ZXN0TnVtYmVyLCBzaW5nbGVSZXF1ZXN0U2l6ZSkge1xyXG4gICAgICAgIHRoaXMuI3JlcXVlc3RGdW5jdGlvbiA9IHJlcXVlc3RGdW5jdGlvbjtcclxuXHJcbiAgICAgICAgdGhpcy4jcmVxdWVzdCA9IHJlcXVlc3Q7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy4jY2FjaGVTaXplID0gY2FjaGVTaXplO1xyXG5cclxuICAgICAgICB0aGlzLiNidWxrUmVxdWVzdE51bWJlciA9IGJ1bGtSZXF1ZXN0TnVtYmVyO1xyXG4gICAgICAgIHRoaXMuI3JlcXVlc3ROdW1iZXIgPSByZXF1ZXN0TnVtYmVyO1xyXG4gICAgICAgIHRoaXMuI3JlcXVlc3RTaXplID0gc2luZ2xlUmVxdWVzdFNpemU7XHJcblxyXG4gICAgICAgIHRoaXMuI3BvcHVsYXRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGdW5jdGlvbiB0byBjb250aW51ZSBpc3N1aW5nIHJlcXVlc3RzIHVudGlsIHRoZSBzdGFjayBpcyBmdWxsLlxyXG4gICAgICogXHJcbiAgICAgKiBLZWVwIGlzc3VpbmcgcmVxdWVzdHMgdG8gc2VydmVyIHVudGlsIHN0YWNrIGlzIGZ1bGwuIFdoZW4gc3RhY2sgaXMgZnVsbFxyXG4gICAgICogaWYgcmVxdWVzdHMgYXJlIGJlaW5nIGlzc3VlZCBpbiBidWxrLCB3YWl0IHVudGlsIHN0YWNrIGhhcyBlbm91Z2ggc3BhY2VcclxuICAgICAqIHRvIGFjY29tbW9kYXRlIGFsbCBvZiBhIGJ1bGsgcmVxdWVzdCBiZWZvcmUgaXNzdWluZyBhIG5ldyByZXF1ZXN0LCBvdGhlcndpc2VcclxuICAgICAqIGlzc3VlIGEgbmV3IHJlcXVlc3QgZXZlcnkgdGltZSBhbiBpdGVtIGluIHRoZSBzdGFjayBoYXMgYmVlbiBjb25zdW1lZC4gTm90ZVxyXG4gICAgICogdGhhdCByZXF1ZXN0cyBhcmUgYmxvY2tpbmcgKCdhd2FpdCcgaXMgdXNlZCB3aGVuIGNhbGxpbmcgdGhlIHJlcXVlc3RGdW5jdGlvbiksXHJcbiAgICAgKiBpLmUuLCBvbmx5IG9uZSByZXF1ZXN0IHdpbGwgYmUgaXNzdWVkIGJ5IHRoZSBjYWNoZSBhdCBhbnkgZ2l2ZW4gdGltZS5cclxuICAgICAqL1xyXG4gICAgI3BvcHVsYXRlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGlmICghdGhpcy4jY3VycmVudGx5UG9wdWxhdGluZyAmJiAhdGhpcy4jcGF1c2VkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuI2N1cnJlbnRseVBvcHVsYXRpbmcgPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gbnVsbDtcclxuXHJcbiAgICAgICAgICAgIHdoaWxlICh0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy4jZXJyb3IgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuI2J1bGtSZXF1ZXN0TnVtYmVyID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIElzIHRoZXJlIHNwYWNlIGZvciBhIGJ1bGsgcmVzcG9uc2UgaW4gdGhlIHN0YWNrP1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLiNzdGFjay5sZW5ndGggPD0gKHRoaXMuI2NhY2hlU2l6ZSAtIHRoaXMuI2J1bGtSZXF1ZXN0TnVtYmVyKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLiNyZXF1ZXN0RnVuY3Rpb24odGhpcy4jcmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLiNhZGRSZXNwb25zZShyZXNwb25zZSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vdCBlbm91Z2ggYml0cyByZW1haW5pbmcgZm9yIGEgYnVsayByZXF1ZXN0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBiaXRzTGVmdCA9IGUuZ2V0Qml0c0xlZnQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYml0c0xlZnQgPiB0aGlzLiNyZXF1ZXN0U2l6ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBwb3NzaWJsZSwgYWRqdXN0IHJlcXVlc3QgZm9yIHRoZSBsYXJnZXN0IHBvc3NpYmxlIHNpemVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFkanVzdGVkQnVsayA9IE1hdGguZmxvb3IoYml0c0xlZnQvdGhpcy4jcmVxdWVzdFNpemUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLiNyZXF1ZXN0LnBhcmFtcy5uID0gYWRqdXN0ZWRCdWxrICogdGhpcy4jcmVxdWVzdE51bWJlcjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gYXdhaXQgdGhpcy4jcmVxdWVzdEZ1bmN0aW9uKHRoaXMuI3JlcXVlc3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLiNhZGRSZXNwb25zZShyZXNwb25zZSwgdHJ1ZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXNldCB0byBvcmlnaW5hbCBidWxrIHJlcXVlc3Qgc2l6ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLiNyZXF1ZXN0LnBhcmFtcy5uID0gdGhpcy4jYnVsa1JlcXVlc3ROdW1iZXIgKiB0aGlzLiNyZXF1ZXN0TnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlcXVlc3Qgc2l6ZSBjYW5ub3QgYmUgYWRqdXN0ZWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jZXJyb3IgPSBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbnkgb3RoZXIgZXJyb3IgdGhyb3duIGR1cmluZyBpbiB0aGUgcmVxdWVzdCBmdW5jdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuI2Vycm9yID0gZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vIHNwYWNlIGZvciBhIGJ1bGsgcmVxdWVzdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuI3N0YWNrLmxlbmd0aCA8IHRoaXMuI2NhY2hlU2l6ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGluZGl2aWR1YWwgcmVxdWVzdHNcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IHRoaXMuI3JlcXVlc3RGdW5jdGlvbih0aGlzLiNyZXF1ZXN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jYWRkUmVzcG9uc2UocmVzcG9uc2UsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jZXJyb3IgPSBlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN0YWNrIGlzIGZ1bGxcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSAgICAgICAgICAgICAgIFxyXG5cclxuICAgICAgICAgICAgdGhpcy4jY3VycmVudGx5UG9wdWxhdGluZyA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBjYWNoZSB3aWxsIG5vIGxvbmdlciBjb250aW51ZSB0byBwb3B1bGF0ZSBpdHNlbGYuXHJcbiAgICAgKi9cclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgdGhpcy4jcGF1c2VkID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBjYWNoZSB3aWxsIHJlc3VtZSBwb3B1bGF0aW5nIGl0c2VsZiBpZiBzdG9wcGVkLlxyXG4gICAgICovXHJcbiAgICByZXN1bWUoKSB7XHJcbiAgICAgICAgdGhpcy4jcGF1c2VkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIC8vIGNoZWNrIGlmIGl0IG5lZWRzIHRvIGJlIHJlcG9wdWxhdGVkXHJcbiAgICAgICAgdGhpcy4jcmVmcmVzaCgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIHRoZSBjYWNoZSBpcyBjdXJyZW50bHkgbm90IHJlLXBvcHVsYXRpbmcgaXRzZWxmLlxyXG4gICAgICogXHJcbiAgICAgKiBWYWx1ZXMgY3VycmVudGx5IGNhY2hlZCBtYXkgc3RpbGwgYmUgcmV0cmlldmVkIHdpdGggZ2V0KCkgYnV0IG5vIG5ld1xyXG4gICAgICogdmFsdWVzIGFyZSBiZWluZyBmZXRjaGVkIGZyb20gdGhlIHNlcnZlci4gVGhpcyBzdGF0ZSBjYW4gYmUgY2hhbmdlZCB3aXRoXHJcbiAgICAgKiBzdG9wKCkgYW5kIHJlc3VtZSgpLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgY2FjaGUgaXMgY3VycmVudGx5IG5vdCByZS1wb3B1bGF0aW5nIGl0c2VsZixcclxuICAgICAqICAgICBmYWxzZSBvdGhlcndpc2UuXHJcbiAgICAgKi9cclxuICAgIGlzUGF1c2VkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNwYXVzZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSBuZXh0IHJlc3BvbnNlLlxyXG4gICAgICogTm90ZSB0aGF0IGlmIHRoZSBjYWNoZSBpcyBlbXB0eSwgaWYgd2FzIGNvbnN0cnVjdGVkIHdpdGggdW5zdWl0YWJsZSBwYXJhbWV0ZXJcclxuICAgICAqIHZhbHVlcyBvciBpZiB0aGUgZGFpbHkgYWxsb3dhbmNlIG9mIGJpdHMvcmVxdWVzdHMgaGFzIGJlZW4gcmVhY2hlZCwgdGhlIGFwcHJvcHJpYXRlXHJcbiAgICAgKiBlcnJvciB3aWxsIGJlIHRocm93bi5cclxuICAgICAqIEByZXR1cm5zIHthbnlbXX0gVGhlIG5leHQgYXBwcm9wcmlhdGUgcmVzcG9uc2UgZm9yIHRoZSByZXF1ZXN0IHRoaXMgUmFuZG9tT3JnQ2FjaGVcclxuICAgICAqICAgICByZXByZXNlbnRzIG9yLCBpZiBzdGFjayBpcyBlbXB0eSB0aHJvd3MgYW4gZXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIFJhbmRvbU9yZ0NhY2hlRW1wdHlFcnJvciBpZiB0aGUgY2FjaGUgaXMgZW1wdHkuXHJcbiAgICAgKi9cclxuICAgIGdldCgpIHtcclxuICAgICAgICBpZiAodGhpcy4jZXJyb3IgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLiNlcnJvcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuI3N0YWNrICYmIHRoaXMuI3N0YWNrLmxlbmd0aCA9PSAwKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLiNwYXVzZWQpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IoJ1RoZSBSYW5kb21PcmdDYWNoZSBzdGFjayAnXHJcbiAgICAgICAgICAgICAgICAgICAgKyAnaXMgZW1wdHkgYW5kIHRoZSBjYWNoZSBpcyBwYXVzZWQuIFBsZWFzZSBjYWxsIHJlc3VtZSgpIHRvICdcclxuICAgICAgICAgICAgICAgICAgICArICdyZXN0YXJ0IHBvcHVsYXRpbmcgdGhlIGNhY2hlLicsIHRydWUpOyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ0NhY2hlRW1wdHlFcnJvcignVGhlIFJhbmRvbU9yZ0NhY2hlIHN0YWNrICdcclxuICAgICAgICAgICAgICAgICAgICArICdpcyBlbXB0eSwgcGxlYXNlIHdhaXQgZm9yIGl0IHRvIHJlcG9wdWxhdGUgaXRzZWxmLicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbGV0IGRhdGEgPSB0aGlzLiNzdGFjay5wb3AoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGl0IG5lZWRzIHRvIGJlIHJlcG9wdWxhdGVkXHJcbiAgICAgICAgICAgIHRoaXMuI3JlZnJlc2goKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBuZXh0IHJlc3BvbnNlIG9yIHdhaXQgdW50aWwgdGhlIG5leHQgdmFsdWUgaXMgYXZhaWxhYmxlLiBUaGlzIG1ldGhvZFxyXG4gICAgICogd2lsbCBibG9jayB1bnRpbCBhIHZhbHVlIGlzIGF2YWlsYWJsZS4gTm90ZTogdGhpcyBtZXRob2Qgd2lsbCB0aHJvdyBhbiBlcnJvclxyXG4gICAgICogaWYgdGhlIGNhY2hlIGlzIGVtcHR5IGFuZCBoYXMgYmVlbiBwYXVzZWQsIGkuZS4gaXMgbm90IGJlaW5nIHBvcHVsYXRlZC4gSWZcclxuICAgICAqIHRoZSBjYWNoZSB3YXMgY29uc3RydWN0ZWQgd2l0aCB1bnN1aXRhYmxlIHBhcmFtZXRlciB2YWx1ZXMgb3IgdGhlIGRhaWx5IGFsbG93YW5jZVxyXG4gICAgICogb2YgYml0cy9yZXF1ZXN0cyBoYXMgYmVlbiByZWFjaGVkLCB0aGUgYXBwcm9wcmlhdGUgZXJyb3Igd2lsbCBhbHNvIGJlIHRocm93bi5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGFueVtdPn0gVGhlIG5leHQgYXBwcm9wcmlhdGUgcmVzcG9uc2UgZm9yIHRoZSByZXF1ZXN0IHRoaXNcclxuICAgICAqIFJhbmRvbU9yZ0NhY2hlIHJlcHJlc2VudHMuXHJcbiAgICAgKiBAdGhyb3dzIFJhbmRvbU9yZ0NhY2hlRW1wdHlFcnJvciBpZiB0aGUgY2FjaGUgaXMgZW1wdHkgYW5kIGlzIHBhdXNlZC5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0T3JXYWl0KCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxldCB2YWx1ZXMgPSB0aGlzLmdldCgpO1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWVzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLiNwYXVzZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBUaGUgY2FjaGUgaXMgcGF1c2VkIGFuZCB3aWxsIG5vdCByZXR1cm4gYW55IHZhbHVlc1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBsZXQgY2FjaGVkVmFsdWVzID0gYXdhaXQgdGhpcy4jcG9wdWxhdGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChjYWNoZWRWYWx1ZXMgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBjYWNoZSBoYXMgbm90IHlldCByZXBvcHVsYXRlZC5cclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgNTApKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldE9yV2FpdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgbnVtYmVyIG9mIHJlc3VsdCBzZXRzIHJlbWFpbmluZyBpbiB0aGUgY2FjaGUuXHJcbiAgICAgKiBcclxuICAgICAqIFRoaXMgZXNzZW50aWFsbHkgcmV0dXJucyBob3cgb2Z0ZW4gZ2V0KCkgbWF5IGJlIGNhbGxlZCB3aXRob3V0XHJcbiAgICAgKiBhIGNhY2hlIHJlZmlsbC5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEN1cnJlbnQgbnVtYmVyIG9mIGNhY2hlZCByZXN1bHRzLlxyXG4gICAgICovXHJcbiAgICBnZXRDYWNoZWRWYWx1ZXMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI3N0YWNrLmxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIG51bWJlciBvZiBiaXRzIHVzZWQgYnkgdGhpcyBjYWNoZS5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IE51bWJlciBvZiBiaXRzIHVzZWQuXHJcbiAgICAgKi9cclxuICAgIGdldEJpdHNVc2VkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNiaXRzVXNlZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgbnVtYmVyIG9mIHJlcXVlc3RzIHVzZWQgYnkgdGhpcyBjYWNoZS5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IE51bWJlciBvZiByZXF1ZXN0cyB1c2VkLlxyXG4gICAgICovXHJcbiAgICBnZXRSZXF1ZXN0c1VzZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI3JlcXVlc3RzVXNlZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBpZiB0aGUgY2FjaGUgbmVlZHMgdG8gYmUgcmVwb3B1bGF0ZWQuXHJcbiAgICAgKi9cclxuICAgICNyZWZyZXNoID0gKCkgPT4ge1xyXG4gICAgICAgIGlmICh0aGlzLiNidWxrUmVxdWVzdE51bWJlciA+IDAgJiYgdGhpcy4jc3RhY2subGVuZ3RoIDw9ICh0aGlzLiNjYWNoZVNpemUgLSB0aGlzLiNidWxrUmVxdWVzdE51bWJlcikpIHtcclxuICAgICAgICAgICAgLy8gYnVsayByZXF1ZXN0c1xyXG4gICAgICAgICAgICB0aGlzLiNwb3B1bGF0ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLiNidWxrUmVxdWVzdE51bWJlciA8PSAwICYmIHRoaXMuI3N0YWNrLmxlbmd0aCA8IHRoaXMuI2NhY2hlU2l6ZSkge1xyXG4gICAgICAgICAgICAvLyBpbmRpdmlkdWFsIHJlcXVlc3RzXHJcbiAgICAgICAgICAgIHRoaXMuI3BvcHVsYXRlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGFkZCBhIHJlc3BvbnNlIHRvIHRoZSBzdGFjay5cclxuICAgICAqIEBwYXJhbSB7YW55W119IHJlc3BvbnNlIFRoZSByZXNwb25zZSByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGJ1bGsgVHJ1ZSBpZiB0aGUgY2FjaGUgaXNzdWVzIGJ1bGsgcmVxdWVzdHMsIGZhbHNlIG90aGVyd2lzZS5cclxuICAgICAqL1xyXG4gICAgI2FkZFJlc3BvbnNlID0gKHJlc3BvbnNlLCBidWxrKSA9PiB7XHJcbiAgICAgICAgdGhpcy4jcmVxdWVzdHNVc2VkKys7XHJcbiAgICAgICAgdGhpcy4jYml0c1VzZWQgKz0gcmVzcG9uc2UucmVzdWx0LmJpdHNVc2VkO1xyXG5cclxuICAgICAgICBpZiAoYnVsaykge1xyXG4gICAgICAgICAgICBsZXQgZGF0YSA9IHJlc3BvbnNlLnJlc3VsdC5yYW5kb20uZGF0YTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSArPSB0aGlzLiNyZXF1ZXN0TnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLiNzdGFjay5wdXNoKGRhdGEuc2xpY2UoaSwgaSArIHRoaXMuI3JlcXVlc3ROdW1iZXIpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuI3N0YWNrLnB1c2gocmVzcG9uc2UucmVzdWx0LnJhbmRvbS5kYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCIndXNlIHN0cmljdCc7XHJcblxyXG5jb25zdCB7XHJcbiAgICBSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcixcclxuICAgIFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcixcclxuICAgIFJhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3IsXHJcbiAgICBSYW5kb21PcmdKU09OUlBDRXJyb3IsXHJcbiAgICBSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3IsXHJcbiAgICBSYW5kb21PcmdSQU5ET01PUkdFcnJvcixcclxuICAgIFJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3JcclxufSA9IHJlcXVpcmUoJy4vUmFuZG9tT3JnRXJyb3JzLmpzJyk7XHJcbmNvbnN0IFJhbmRvbU9yZ0NhY2hlID0gcmVxdWlyZSgnLi9SYW5kb21PcmdDYWNoZS5qcycpO1xyXG4vKiBub2RlLWltcG9ydCAqL1xyXG5jb25zdCBYTUxIdHRwUmVxdWVzdCA9IHJlcXVpcmUoJ3htbGh0dHByZXF1ZXN0JykuWE1MSHR0cFJlcXVlc3Q7XHJcbi8qIGVuZC1ub2RlLWltcG9ydCAqL1xyXG5cclxuLyoqXHJcbiAqIFJhbmRvbU9yZ0NsaWVudCBtYWluIGNsYXNzIHRocm91Z2ggd2hpY2ggQVBJIGZ1bmN0aW9ucyBhcmUgYWNjZXNzZWQuXHJcbiAqIFxyXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIGFjY2VzcyB0byBib3RoIHRoZSBzaWduZWQgYW5kIHVuc2lnbmVkIG1ldGhvZHMgb2YgdGhlXHJcbiAqIFJBTkRPTS5PUkcgQVBJLlxyXG4gKiBcclxuICogVGhlIGNsYXNzIGFsc28gcHJvdmlkZXMgYWNjZXNzIHRvIHRoZSBjcmVhdGlvbiBvZiBhIGNvbnZlbmllbmNlIGNsYXNzLCBSYW5kb21PcmdDYWNoZSxcclxuICogZm9yIHByZWNhY2hpbmcgQVBJIHJlc3BvbnNlcyB3aGVuIHRoZSByZXF1ZXN0IGlzIGtub3duIGluIGFkdmFuY2UuXHJcbiAqIFxyXG4gKiBUaGlzIGNsYXNzIHdpbGwgb25seSBhbGxvdyB0aGUgY3JlYXRpb24gb2Ygb25lIGluc3RhbmNlIHBlciBBUEkga2V5LiBJZiBhblxyXG4gKiBpbnN0YW5jZSBvZiB0aGlzIGNsYXNzIGFscmVhZHkgZXhpc3RzIGZvciBhIGdpdmVuIGtleSwgdGhhdCBpbnN0YW5jZSB3aWxsIGJlXHJcbiAqIHJldHVybmVkIGluc3RlYWQgb2YgYSBuZXcgaW5zdGFuY2UuXHJcbiAqIFxyXG4gKiBUaGlzIGNsYXNzIG9iZXlzIG1vc3Qgb2YgdGhlIGd1aWRlbGluZXMgc2V0IGZvcnRoIGluIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNFxyXG4gKiBBbGwgcmVxdWVzdHMgcmVzcGVjdCB0aGUgc2VydmVyJ3MgYWR2aXNvcnlEZWxheSByZXR1cm5lZCBpbiBhbnkgcmVzcG9uc2VzLCBvciB1c2VcclxuICogREVGQVVMVF9ERUxBWSBpZiBubyBhZHZpc29yeURlbGF5IGlzIHJldHVybmVkLiBJZiB0aGUgc3VwcGxpZWQgQVBJIGtleSBpcyBwYXVzZWQsIGkuZS4sXHJcbiAqIGhhcyBleGNlZWRlZCBpdHMgZGFpbHkgYml0L3JlcXVlc3QgYWxsb3dhbmNlLCB0aGlzIGltcGxlbWVudGF0aW9uIHdpbGwgYmFjayBvZmYgdW50aWxcclxuICogbWlkbmlnaHQgVVRDLlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBjbGFzcyBSYW5kb21PcmdDbGllbnQge1xyXG4gICAgLy8gQmFzaWMgQVBJXHJcbiAgICBzdGF0aWMgI0lOVEVHRVJfTUVUSE9EID0gJ2dlbmVyYXRlSW50ZWdlcnMnO1xyXG4gICAgc3RhdGljICNJTlRFR0VSX1NFUVVFTkNFX01FVEhPRCA9ICdnZW5lcmF0ZUludGVnZXJTZXF1ZW5jZXMnO1xyXG4gICAgc3RhdGljICNERUNJTUFMX0ZSQUNUSU9OX01FVEhPRCA9ICdnZW5lcmF0ZURlY2ltYWxGcmFjdGlvbnMnO1xyXG4gICAgc3RhdGljICNHQVVTU0lBTl9NRVRIT0QgPSAnZ2VuZXJhdGVHYXVzc2lhbnMnO1xyXG4gICAgc3RhdGljICNTVFJJTkdfTUVUSE9EID0gJ2dlbmVyYXRlU3RyaW5ncyc7XHJcbiAgICBzdGF0aWMgI1VVSURfTUVUSE9EID0gJ2dlbmVyYXRlVVVJRHMnO1xyXG4gICAgc3RhdGljICNCTE9CX01FVEhPRCA9ICdnZW5lcmF0ZUJsb2JzJztcclxuICAgIHN0YXRpYyAjR0VUX1VTQUdFX01FVEhPRCA9ICdnZXRVc2FnZSc7XHJcblxyXG4gICAgLy8gU2lnbmVkIEFQSVxyXG4gICAgc3RhdGljICNTSUdORURfSU5URUdFUl9NRVRIT0QgPSAnZ2VuZXJhdGVTaWduZWRJbnRlZ2Vycyc7XHJcbiAgICBzdGF0aWMgI1NJR05FRF9JTlRFR0VSX1NFUVVFTkNFX01FVEhPRCA9ICdnZW5lcmF0ZVNpZ25lZEludGVnZXJTZXF1ZW5jZXMnO1xyXG4gICAgc3RhdGljICNTSUdORURfREVDSU1BTF9GUkFDVElPTl9NRVRIT0QgPSAnZ2VuZXJhdGVTaWduZWREZWNpbWFsRnJhY3Rpb25zJztcclxuICAgIHN0YXRpYyAjU0lHTkVEX0dBVVNTSUFOX01FVEhPRCA9ICdnZW5lcmF0ZVNpZ25lZEdhdXNzaWFucyc7XHJcbiAgICBzdGF0aWMgI1NJR05FRF9TVFJJTkdfTUVUSE9EID0gJ2dlbmVyYXRlU2lnbmVkU3RyaW5ncyc7XHJcbiAgICBzdGF0aWMgI1NJR05FRF9VVUlEX01FVEhPRCA9ICdnZW5lcmF0ZVNpZ25lZFVVSURzJztcclxuICAgIHN0YXRpYyAjU0lHTkVEX0JMT0JfTUVUSE9EID0gJ2dlbmVyYXRlU2lnbmVkQmxvYnMnO1xyXG4gICAgc3RhdGljICNHRVRfUkVTVUxUX01FVEhPRCA9ICdnZXRSZXN1bHQnO1xyXG4gICAgc3RhdGljICNDUkVBVEVfVElDS0VUX01FVEhPRCA9ICdjcmVhdGVUaWNrZXRzJztcclxuICAgIHN0YXRpYyAjTElTVF9USUNLRVRfTUVUSE9EID0gJ2xpc3RUaWNrZXRzJztcclxuICAgIHN0YXRpYyAjR0VUX1RJQ0tFVF9NRVRIT0QgPSAnZ2V0VGlja2V0JztcclxuICAgIHN0YXRpYyAjVkVSSUZZX1NJR05BVFVSRV9NRVRIT0QgPSAndmVyaWZ5U2lnbmF0dXJlJztcclxuXHJcbiAgICAvLyBCbG9iIGZvcm1hdCBsaXRlcmFsc1xyXG4gICAgLyoqIEJsb2IgZm9ybWF0IGxpdGVyYWwsIGJhc2U2NCBlbmNvZGluZyAoZGVmYXVsdCkuICovXHJcbiAgICBzdGF0aWMgQkxPQl9GT1JNQVRfQkFTRTY0ID0gJ2Jhc2U2NCc7XHJcbiAgICAvKiogQmxvYiBmb3JtYXQgbGl0ZXJhbCwgaGV4IGVuY29kaW5nLiAqL1xyXG4gICAgc3RhdGljIEJMT0JfRk9STUFUX0hFWCA9ICdoZXgnO1xyXG5cclxuICAgIC8vIERlZmF1bHQgdmFsdWVzXHJcbiAgICAvKiogRGVmYXVsdCB2YWx1ZSBmb3IgdGhlIHJlcGxhY2VtZW50IHBhcmFtZXRlciAodHJ1ZSkuICovXHJcbiAgICBzdGF0aWMgREVGQVVMVF9SRVBMQUNFTUVOVCA9IHRydWU7XHJcbiAgICAvKiogRGVmYXVsdCB2YWx1ZSBmb3IgdGhlIGJhc2UgcGFyYW1ldGVyICgxMCkuICovXHJcbiAgICBzdGF0aWMgREVGQVVMVF9CQVNFID0gMTA7XHJcbiAgICAvKiogRGVmYXVsdCB2YWx1ZSBmb3IgdGhlIHVzZXJEYXRhIHBhcmFtZXRlciAobnVsbCkuICovXHJcbiAgICBzdGF0aWMgREVGQVVMVF9VU0VSX0RBVEEgPSBudWxsO1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSB0aWNrZXRJZCBwYXJhbWV0ZXIgKG51bGwpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfVElDS0VUX0lEID0gbnVsbDtcclxuICAgIC8qKiBEZWZhdWx0IHZhbHVlIGZvciB0aGUgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiBwYXJhbWV0ZXIgKG51bGwpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfUFJFR0VORVJBVEVEX1JBTkRPTUlaQVRJT04gPSBudWxsO1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSBsaWNlbnNlRGF0YSBwYXJhbWV0ZXIgKG51bGwpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfTElDRU5TRV9EQVRBID0gbnVsbDtcclxuXHJcbiAgICAvKiogU2l6ZSBvZiBhIHNpbmdsZSBVVUlEIGluIGJpdHMuICovXHJcbiAgICBzdGF0aWMgVVVJRF9TSVpFID0gMTIyO1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSBibG9ja2luZ1RpbWVvdXQgcGFyYW1ldGVyICgxIGRheSkuICovXHJcbiAgICBzdGF0aWMgREVGQVVMVF9CTE9DS0lOR19USU1FT1VUID0gMjQgKiA2MCAqIDYwICogMTAwMDtcclxuICAgIC8qKiBEZWZhdWx0IHZhbHVlIGZvciB0aGUgaHR0cFRpbWVvdXQgcGFyYW1ldGVyICgyIG1pbnV0ZXMpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfSFRUUF9USU1FT1VUID0gMTIwICogMTAwMDtcclxuICAgIC8qKiBNYXhpbXVtIG51bWJlciBvZiBjaGFyYWN0ZXJzIGFsbG93ZWQgaW4gYSBzaWduYXR1cmUgdmVyZmljaWF0aW9uIFVSTC4gKi9cclxuICAgIHN0YXRpYyBNQVhfVVJMX0xFTkdUSCA9IDIwNDY7XHJcblxyXG4gICAgLy8gRGVmYXVsdCBiYWNrLW9mZiB0byB1c2UgaWYgbm8gYWR2aXNvcnlEZWxheSBiYWNrLW9mZiBzdXBwbGllZCBieSBzZXJ2ZXIgKDEgc2Vjb25kKVxyXG4gICAgc3RhdGljICNERUZBVUxUX0RFTEFZID0gMSoxMDAwO1xyXG5cclxuICAgIC8vIE9uIHJlcXVlc3QgZmV0Y2ggZnJlc2ggYWxsb3dhbmNlIHN0YXRlIGlmIGN1cnJlbnQgc3RhdGUgZGF0YSBpcyBvbGRlciB0aGFuXHJcbiAgICAvLyB0aGlzIHZhbHVlICgxIGhvdXIpLlxyXG4gICAgc3RhdGljICNBTExPV0FOQ0VfU1RBVEVfUkVGUkVTSF9TRUNPTkRTID0gMzYwMCAqIDEwMDA7XHJcblxyXG4gICAgLy8gTWFpbnRhaW5zIHVzYWdlIHN0YXRpc3RpY3MgZnJvbSBzZXJ2ZXIuXHJcbiAgICAjYml0c0xlZnQgPSAtMTtcclxuICAgICNyZXF1ZXN0c0xlZnQgPSAtMTtcclxuXHJcbiAgICAvLyBCYWNrLW9mZiBpbmZvIGZvciB3aGVuIHRoZSBBUEkga2V5IGlzIGRldGVjdGVkIGFzIG5vdCBydW5uaW5nLCBwcm9iYWJseVxyXG4gICAgLy8gYmVjYXVzZSB0aGUga2V5IGhhcyBleGNlZWRlZCBpdHMgZGFpbHkgdXNhZ2UgbGltaXQuIEJhY2stb2ZmIHJ1bnMgdW50aWxcclxuICAgIC8vIG1pZG5pZ2h0IFVUQy5cclxuICAgICNiYWNrb2ZmID0gLTE7XHJcbiAgICAjYmFja29mZkVycm9yID0gJyc7XHJcblxyXG4gICAgI2FwaUtleSA9ICcnO1xyXG4gICAgI2Jsb2NraW5nVGltZW91dCA9IFJhbmRvbU9yZ0NsaWVudC5ERUZBVUxUX0JMT0NLSU5HX1RJTUVPVVQ7XHJcbiAgICAjaHR0cFRpbWVvdXQgPSBSYW5kb21PcmdDbGllbnQuREVGQVVMVF9IVFRQX1RJTUVPVVQ7XHJcblxyXG4gICAgLy8gTWFpbnRhaW4gaW5mbyB0byBvYmV5IHNlcnZlciBhZHZpc29yeSBkZWxheVxyXG4gICAgI2Fkdmlzb3J5RGVsYXkgPSAwO1xyXG4gICAgI2xhc3RSZXNwb25zZVJlY2VpdmVkVGltZSA9IDA7XHJcblxyXG4gICAgLy8gTWFpbnRhaW5zIGEgZGljdGlvbmFyeSBvZiBBUEkga2V5cyBhbmQgdGhlaXIgaW5zdGFuY2VzLlxyXG4gICAgc3RhdGljICNrZXlJbmRleGVkSW5zdGFuY2VzID0ge307XHJcblxyXG4gICAgc3RhdGljICNFUlJPUl9DT0RFUyA9IFsgMTAwLCAxMDEsIDIwMCwgMjAxLCAyMDIsIDIwMywgMjA0LCAzMDAsXHJcbiAgICAgICAgMzAxLCAzMDIsIDMwMywgMzA0LCAzMDUsIDMwNiwgMzA3LCA0MDAsIDQwMSwgNDAyLCA0MDMsIDQwNCxcclxuICAgICAgICA0MDUsIDQyMCwgNDIxLCA0MjIsIDQyMywgNDI0LCA0MjUsIDUwMCwgMzIwMDAgXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdG9yLiBFbnN1cmVzIG9ubHkgb25lIGluc3RhbmNlIG9mIFJhbmRvbU9yZ0NsaWVudCBleGlzdHMgcGVyIEFQSVxyXG4gICAgICoga2V5LiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIGlmIHRoZSBzdXBwbGllZCBrZXkgaXNuJ3QgYWxyZWFkeSBrbm93bixcclxuICAgICAqIG90aGVyd2lzZSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IGluc3RhbnRpYXRlZCBvbmUuXHJcbiAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBhcGlLZXkgQVBJIGtleSBvZiBpbnN0YW5jZSB0byBjcmVhdGUvZmluZCwgb2J0YWluZWQgZnJvbVxyXG4gICAgICogICAgIFJBTkRPTS5PUkcsIHNlZSBodHRwczovL2FwaS5yYW5kb20ub3JnL2FwaS1rZXlzXHJcbiAgICAgKiBAcGFyYW0ge3tibG9ja2luZ1RpbWVvdXQ/OiBudW1iZXIsIGh0dHBUaW1lb3V0PzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5ibG9ja2luZ1RpbWVvdXQgPSAyNCAqIDYwICogNjAgKiAxMDAwXSBNYXhpbXVtXHJcbiAgICAgKiAgICAgdGltZSBpbiBtaWxsaXNlY29uZHMgdG8gd2FpdCBiZWZvcmUgYmVpbmcgYWxsb3dlZCB0byBzZW5kIGEgcmVxdWVzdC5cclxuICAgICAqICAgICBOb3RlIHRoaXMgaXMgYSBoaW50IG5vdCBhIGd1YXJhbnRlZS4gVGhlIGFkdmlzb3J5IGRlbGF5IGZyb20gc2VydmVyXHJcbiAgICAgKiAgICAgbXVzdCBhbHdheXMgYmUgb2JleWVkLiBTdXBwbHkgYSB2YWx1ZSBvZiAtMSB0byBhbGxvdyBibG9ja2luZyBmb3JldmVyXHJcbiAgICAgKiAgICAgKGRlZmF1bHQgMjQgKiA2MCAqIDYwICogMTAwMCwgaS5lLiwgMSBkYXkpLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmh0dHBUaW1lb3V0ID0gMTIwICogMTAwMF0gTWF4aW11bSB0aW1lIGluXHJcbiAgICAgKiAgICAgbWlsbGlzZWNvbmRzIHRvIHdhaXQgZm9yIHRoZSBzZXJ2ZXIgcmVzcG9uc2UgdG8gYSByZXF1ZXN0IChkZWZhdWx0XHJcbiAgICAgKiAgICAgMTIwKjEwMDApLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihhcGlLZXksIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGlmIChSYW5kb21PcmdDbGllbnQuI2tleUluZGV4ZWRJbnN0YW5jZXMgJiYgUmFuZG9tT3JnQ2xpZW50LiNrZXlJbmRleGVkSW5zdGFuY2VzW2FwaUtleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIFJhbmRvbU9yZ0NsaWVudC4ja2V5SW5kZXhlZEluc3RhbmNlc1thcGlLZXldO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuI2FwaUtleSA9IGFwaUtleTtcclxuICAgICAgICAgICAgdGhpcy4jYmxvY2tpbmdUaW1lb3V0ID0gb3B0aW9ucy5ibG9ja2luZ1RpbWVvdXQgfHwgMjQgKiA2MCAqIDYwICogMTAwMDtcclxuICAgICAgICAgICAgdGhpcy4jaHR0cFRpbWVvdXQgPSBvcHRpb25zLmh0dHBUaW1lb3V0IHx8IDEyMCAqIDEwMDA7XHJcblxyXG4gICAgICAgICAgICBSYW5kb21PcmdDbGllbnQuI2tleUluZGV4ZWRJbnN0YW5jZXNbYXBpS2V5XSA9IHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIEJhc2ljIEFQSVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnMgd2l0aGluIGEgdXNlci1kZWZpbmVkXHJcbiAgICAgKiByYW5nZSBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Jhc2ljI2dlbmVyYXRlSW50ZWdlcnNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgcmFuZG9tIGludGVnZXJzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpblxyXG4gICAgICogICAgIHRoZSBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1pbiBUaGUgbG93ZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBNdXN0IGJlIHdpdGhpbiB0aGUgWy0xZTksMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggVGhlIHVwcGVyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaCB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU5LDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIGJhc2U/OiBudW1iZXIsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OlxyXG4gICAgICogICAgIE9iamVjdH19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWlucyBhbnkgb2YgdGhlIGZvbGxvd2luZ1xyXG4gICAgICogICAgIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBudW1iZXJzXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzIHdpbGwgYWxsIGJlIHVuaXF1ZVxyXG4gICAgICogICAgIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmJhc2U9MTBdIFRoZSBiYXNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGRpc3BsYXlcclxuICAgICAqICAgICB0aGUgbnVtYmVycy4gVmFsdWVzIGFsbG93ZWQgYXJlIDIsIDgsIDEwIGFuZCAxNiAoZGVmYXVsdCAxMCkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7KFByb21pc2U8bnVtYmVyW10+fFByb21pc2U8c3RyaW5nW10+KX0gQSBQcm9taXNlIHdoaWNoLCBpZlxyXG4gICAgICogICAgIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBpbnRlZ2Vycy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZUludGVnZXJzKG4sIG1pbiwgbWF4LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2ludGVnZXJSZXF1ZXN0KG4sIG1pbiwgbWF4LCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRydWUgcmFuZG9tIGludGVnZXIgc2VxdWVuY2VzIHdpdGhpbiBhXHJcbiAgICAgKiB1c2VyLWRlZmluZWQgcmFuZ2UgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9iYXNpYyNnZW5lcmF0ZUludGVnZXJTZXF1ZW5jZXNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IGFycmF5cyBvZiByYW5kb20gaW50ZWdlcnMgeW91IG5lZWQuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDFlM10gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIGFycmF5IG9mIHJhbmRvbVxyXG4gICAgICogICAgIGludGVnZXJzIHJlcXVlc3RlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBsZW5ndGggbXVzdCBiZSBhbiBpbnRlZ2VyXHJcbiAgICAgKiAgICAgaW4gdGhlIFsxLCAxZTRdIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbGVuZ3RoIGNhbiBiZSBhbiBhcnJheVxyXG4gICAgICogICAgIHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsZW5ndGggb2YgdGhlIHNlcXVlbmNlIGlkZW50aWZpZWRcclxuICAgICAqICAgICBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBsZW5ndGggbXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UgYW5kIHRoZSB0b3RhbCBzdW0gb2YgYWxsIHRoZSBsZW5ndGhzIG11c3QgYmUgaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaFxyXG4gICAgICogICAgIHRoZSByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBtaW4gbXVzdCBiZVxyXG4gICAgICogICAgIGFuIGludGVnZXIgaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbWluIGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIG1pbiBtdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IG1heCBUaGUgdXBwZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBGb3IgdW5pZm9ybSBzZXF1ZW5jZXMsIG1heCBtdXN0IGJlXHJcbiAgICAgKiAgICAgYW4gaW50ZWdlciBpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBtYXggY2FuXHJcbiAgICAgKiAgICAgYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXJzLCBlYWNoIHNwZWNpZnlpbmcgdGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZVxyXG4gICAgICogICAgIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbWF4IG11c3RcclxuICAgICAqICAgICBiZSB3aXRoaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFufGJvb2xlYW5bXSwgYmFzZT86IG51bWJlcnxudW1iZXJbXSxcclxuICAgICAqICAgICBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zXHJcbiAgICAgKiAgICAgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7KGJvb2xlYW58Ym9vbGVhbltdKX0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXJcclxuICAgICAqICAgICB0aGUgcmFuZG9tIG51bWJlcnMgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGVcclxuICAgICAqICAgICByZXN1bHRpbmcgbnVtYmVycyBtYXkgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnNcclxuICAgICAqICAgICB3aWxsIGFsbCBiZSB1bmlxdWUuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCByZXBsYWNlbWVudCBjYW4gYmUgYW4gYXJyYXlcclxuICAgICAqICAgICB3aXRoIG4gYm9vbGVhbiB2YWx1ZXMsIGVhY2ggc3BlY2lmeWluZyB3aGV0aGVyIHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkXHJcbiAgICAgKiAgICAgYnkgaXRzIGluZGV4IHdpbGwgYmUgY3JlYXRlZCB3aXRoICh0cnVlKSBvciB3aXRob3V0IChmYWxzZSkgcmVwbGFjZW1lbnRcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IFtvcHRpb25zLmJhc2U9MTBdIFRoZSBiYXNlIHRoYXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgICAgdG8gZGlzcGxheSB0aGUgbnVtYmVycy4gVmFsdWVzIGFsbG93ZWQgYXJlIDIsIDgsIDEwIGFuZCAxNi4gRm9yIG11bHRpZm9ybVxyXG4gICAgICogICAgIHNlcXVlbmNlcywgYmFzZSBjYW4gYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXIgdmFsdWVzIHRha2VuIGZyb20gdGhlXHJcbiAgICAgKiAgICAgc2FtZSBzZXQsIGVhY2ggc3BlY2lmeWluZyB0aGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5IHRoZVxyXG4gICAgICogICAgIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4IChkZWZhdWx0IDEwKS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEByZXR1cm5zIHsoUHJvbWlzZTxudW1iZXJbXVtdPnxQcm9taXNlPHN0cmluZ1tdW10+KX0gQSBQcm9taXNlIHdoaWNoLCBpZlxyXG4gICAgICogICAgIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBpbnRlZ2VyXHJcbiAgICAgKiAgICAgc2VxdWVuY2VzLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZUludGVnZXJTZXF1ZW5jZXMobiwgbGVuZ3RoLCBtaW4sIG1heCwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNpbnRlZ2VyU2VxdWVuY2VSZXF1ZXN0KG4sIGxlbmd0aCwgbWluLCBtYXgsIG9wdGlvbnMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0QmFzaWModGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYW5kIHJldHVybnMgYSBsaXN0IChzaXplIG4pIG9mIHRydWUgcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zLFxyXG4gICAgICogZnJvbSBhIHVuaWZvcm0gZGlzdHJpYnV0aW9uIGFjcm9zcyB0aGUgWzAsMV0gaW50ZXJ2YWwgd2l0aCBhIHVzZXItZGVmaW5lZFxyXG4gICAgICogbnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvYmFzaWMjZ2VuZXJhdGVEZWNpbWFsRnJhY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMgeW91IG5lZWQuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVjaW1hbFBsYWNlcyBUaGUgbnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzIHRvIHVzZS4gTXVzdCBiZVxyXG4gICAgICogICAgIHdpdGhpbiB0aGUgWzEsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9uc1xyXG4gICAgICogICAgIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIG51bWJlcnNcclxuICAgICAqICAgICBtYXkgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnMgd2lsbCBhbGwgYmUgdW5pcXVlXHJcbiAgICAgKiAgICAgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXJbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlRGVjaW1hbEZyYWN0aW9ucyhuLCBkZWNpbWFsUGxhY2VzLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2RlY2ltYWxGcmFjdGlvblJlcXVlc3QobiwgZGVjaW1hbFBsYWNlcywgb3B0aW9ucyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RCYXNpYyh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0cyBhbmQgcmV0dXJucyBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gbnVtYmVycyBmcm9tIGFcclxuICAgICAqIEdhdXNzaWFuIGRpc3RyaWJ1dGlvbiAoYWxzbyBrbm93biBhcyBhIG5vcm1hbCBkaXN0cmlidXRpb24pLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgZm9ybSB1c2VzIGEgQm94LU11bGxlciBUcmFuc2Zvcm0gdG8gZ2VuZXJhdGUgdGhlIEdhdXNzaWFuIGRpc3RyaWJ1dGlvblxyXG4gICAgICogZnJvbSB1bmlmb3JtbHkgZGlzdHJpYnV0ZWQgbnVtYmVycy5cclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Jhc2ljI2dlbmVyYXRlR2F1c3NpYW5zXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gbnVtYmVycyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtZWFuIFRoZSBkaXN0cmlidXRpb24ncyBtZWFuLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbLTFlNiwxZTZdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0YW5kYXJkRGV2aWF0aW9uIFRoZSBkaXN0cmlidXRpb24ncyBzdGFuZGFyZCBkZXZpYXRpb24uXHJcbiAgICAgKiAgICAgTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU2LDFlNl0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2lnbmlmaWNhbnREaWdpdHMgVGhlIG51bWJlciBvZiBzaWduaWZpY2FudCBkaWdpdHMgdG8gdXNlLlxyXG4gICAgICogICAgIE11c3QgYmUgd2l0aGluIHRoZSBbMiwyMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3twcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5XHJcbiAgICAgKiAgICAgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcltdPn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBudW1iZXJzIGZyb20gYSBHYXVzc2lhbiBkaXN0cmlidXRpb24uXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlR2F1c3NpYW5zKG4sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLCBzaWduaWZpY2FudERpZ2l0cywgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnYXVzc2lhblJlcXVlc3QobiwgbWVhbiwgc3RhbmRhcmREZXZpYXRpb24sXHJcbiAgICAgICAgICAgIHNpZ25pZmljYW50RGlnaXRzLCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGEgbGlzdCAoc2l6ZSBuKSBvZiB0cnVlIHJhbmRvbSB1bmljb2RlIHN0cmluZ3MgZnJvbVxyXG4gICAgICogdGhlIHNlcnZlci4gU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvYmFzaWMjZ2VuZXJhdGVTdHJpbmdzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gc3RyaW5ncyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIHN0cmluZy4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMjBdIHJhbmdlLiBBbGwgc3RyaW5ncyB3aWxsIGJlIG9mIHRoZSBzYW1lIGxlbmd0aC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJzIEEgc3RyaW5nIHRoYXQgY29udGFpbnMgdGhlIHNldCBvZiBjaGFyYWN0ZXJzXHJcbiAgICAgKiAgICAgdGhhdCBhcmUgYWxsb3dlZCB0byBvY2N1ciBpbiB0aGUgcmFuZG9tIHN0cmluZ3MuIFRoZSBtYXhpbXVtIG51bWJlclxyXG4gICAgICogICAgIG9mIGNoYXJhY3RlcnMgaXMgODAuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OiBPYmplY3R9fSBvcHRpb25zXHJcbiAgICAgKiAgICAgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWlucyBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXBsYWNlbWVudD10cnVlXSBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgc3RyaW5ncyBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbGlzdFxyXG4gICAgICogICAgIG9mIHN0cmluZ3MgbWF5IGNvbnRhaW4gZHVwbGljYXRlcywgb3RoZXJ3aXNlIHRoZSBzdHJpbmdzIHdpbGwgYWxsIGJlXHJcbiAgICAgKiAgICAgdW5pcXVlIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nW10+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIGFycmF5IG9mIHRydWUgcmFuZG9tIHN0cmluZ3MuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU3RyaW5ncyhuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jc3RyaW5nUmVxdWVzdChuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIG9wdGlvbnMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0QmFzaWModGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYW5kIHJldHVybnMgYSBsaXN0IChzaXplIG4pIG9mIHZlcnNpb24gNCB0cnVlIHJhbmRvbSBVbml2ZXJzYWxseVxyXG4gICAgICogVW5pcXVlIElEZW50aWZpZXJzIChVVUlEcykgaW4gYWNjb3JkYW5jZSB3aXRoIHNlY3Rpb24gNC40IG9mIFJGQyA0MTIyLFxyXG4gICAgICogZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9iYXNpYyNnZW5lcmF0ZVVVSURzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gVVVJRHMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlM10gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3twcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5XHJcbiAgICAgKiAgICAgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZ1tdPn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBVVUlEcy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVVVUlEcyhuLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI1VVSURSZXF1ZXN0KG4sIG9wdGlvbnMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0QmFzaWModGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYW5kIHJldHVybnMgYSBsaXN0IChzaXplIG4pIG9mIEJpbmFyeSBMYXJnZSBPQmplY3RzIChCTE9CcylcclxuICAgICAqIGFzIHVuaWNvZGUgc3RyaW5ncyBjb250YWluaW5nIHRydWUgcmFuZG9tIGRhdGEgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9iYXNpYyNnZW5lcmF0ZUJsb2JzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gYmxvYnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDEwMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSBUaGUgc2l6ZSBvZiBlYWNoIGJsb2IsIG1lYXN1cmVkIGluIGJpdHMuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDEwNDg1NzZdIHJhbmdlIGFuZCBtdXN0IGJlIGRpdmlzaWJsZSBieSA4LlxyXG4gICAgICogQHBhcmFtIHt7Zm9ybWF0Pzogc3RyaW5nLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9uc1xyXG4gICAgICogICAgIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb3JtYXQ9J2Jhc2U2NCddIFNwZWNpZmllcyB0aGUgZm9ybWF0IGluIHdoaWNoXHJcbiAgICAgKiAgICAgdGhlIGJsb2JzIHdpbGwgYmUgcmV0dXJuZWQuIFZhbHVlcyBhbGxvd2VkIGFyZSAnYmFzZTY0JyBhbmQgJ2hleCdcclxuICAgICAqICAgICAoZGVmYXVsdCAnYmFzZTY0JykuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXJbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gYmxvYnMgYXMgc3RyaW5ncy5cclxuICAgICAqIEBzZWUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNCTE9CX0ZPUk1BVF9CQVNFNjR9IGZvciAnYmFzZTY0JyAoZGVmYXVsdCkuXHJcbiAgICAgKiBAc2VlIHtAbGluayBSYW5kb21PcmdDbGllbnQjQkxPQl9GT1JNQVRfSEVYfSBmb3IgJ2hleCcuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlQmxvYnMobiwgc2l6ZSwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNibG9iUmVxdWVzdChuLCBzaXplLCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTSUdORUQgQVBJXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0cyBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnMgd2l0aGluIGEgdXNlci1kZWZpbmVkXHJcbiAgICAgKiByYW5nZSBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFJldHVybnMgYSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlc3ByZXNlbnRzIGFuIG9iamVjdFxyXG4gICAgICogd2l0aCB0aGUgcGFyc2VkIGludGVnZXIgbGlzdCBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWwgcmVzcG9uc2UgbWFwcGVkXHJcbiAgICAgKiB0byAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG8gJ3NpZ25hdHVyZScuXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2VuZXJhdGVTaWduZWRJbnRlZ2Vyc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGludGVnZXJzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1pbiBUaGUgbG93ZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoIHRoZVxyXG4gICAgICogICAgIHJhbmRvbSBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBNdXN0IGJlIHdpdGhpbiB0aGUgWy0xZTksMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggVGhlIHVwcGVyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaCB0aGVcclxuICAgICAqICAgICByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU5LDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIGJhc2U/OiBudW1iZXIsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OlxyXG4gICAgICogICAgIE9iamVjdCwgbGljZW5zZURhdGE/OiBPYmplY3QsIHVzZXJEYXRhPzogT2JqZWN0fG51bWJlcnxzdHJpbmcsIHRpY2tldElkPzpcclxuICAgICAqICAgICBzdHJpbmd9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmdcclxuICAgICAqICAgICBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXBsYWNlbWVudD10cnVlXSBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbnVtYmVyc1xyXG4gICAgICogICAgIG1heSBjb250YWluIGR1cGxpY2F0ZSB2YWx1ZXMsIG90aGVyd2lzZSB0aGUgbnVtYmVycyB3aWxsIGFsbCBiZSB1bmlxdWVcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5iYXNlPTEwXSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5XHJcbiAgICAgKiAgICAgdGhlIG51bWJlcnMuIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYgKGRlZmF1bHQgMTApLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmxpY2Vuc2VEYXRhPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3Qgd2hpY2ggYWxsb3dzXHJcbiAgICAgKiAgICAgdGhlIGNhbGxlciB0byBpbmNsdWRlIGRhdGEgb2YgcmVsZXZhbmNlIHRvIHRoZSBsaWNlbnNlIHRoYXQgaXMgYXNzb2NpYXRlZFxyXG4gICAgICogICAgIHdpdGggdGhlIEFQSSBLZXkuIFRoaXMgaXMgbWFuZGF0b3J5IGZvciBBUEkgS2V5cyB3aXRoIHRoZSBsaWNlbnNlIHR5cGVcclxuICAgICAqICAgICAnRmxleGlibGUgR2FtYmxpbmcnIGFuZCBmb2xsb3dzIHRoZSBmb3JtYXQgeyAnbWF4UGF5b3V0JzogeyAnY3VycmVuY3knOlxyXG4gICAgICogICAgICdYVFMnLCAnYW1vdW50JzogMC4wIH19LiBUaGlzIGluZm9ybWF0aW9uIGlzIHVzZWQgaW4gbGljZW5zaW5nXHJcbiAgICAgKiAgICAgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMgYW5kIGluIGJpbGxpbmcuIFRoZSBjdXJyZW50bHkgc3VwcG9ydGVkXHJcbiAgICAgKiAgICAgY3VycmVuY2llcyBhcmU6ICdVU0QnLCAnRVVSJywgJ0dCUCcsICdCVEMnLCAnRVRIJy4gVGhlIG1vc3QgdXAtdG8tZGF0ZVxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIG9uIHRoZSBjdXJyZW5jaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGUgU2lnbmVkIEFQSVxyXG4gICAgICogICAgIGRvY3VtZW50YXRpb24sIGhlcmU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWRcclxuICAgICAqIEBwYXJhbSB7KHN0cmluZ3xudW1iZXJ8T2JqZWN0KX0gW29wdGlvbnMudXNlckRhdGE9bnVsbF0gT2JqZWN0IHRoYXQgd2lsbCBiZVxyXG4gICAgICogICAgIGluY2x1ZGVkIGluIHVubW9kaWZpZWQgZm9ybS4gSXRzIG1heGltdW0gc2l6ZSBpbiBlbmNvZGVkIChzdHJpbmcpIGZvcm0gaXNcclxuICAgICAqICAgICAxLDAwMCBjaGFyYWN0ZXJzIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnRpY2tldElkPW51bGxdIEEgc3RyaW5nIHdpdGggdGlja2V0IGlkZW50aWZpZXIgb2J0YWluZWRcclxuICAgICAqICAgICB2aWEgdGhlIHtAbGluayBSYW5kb21PcmdDbGllbnQjY3JlYXRlVGlja2V0c30gbWV0aG9kLiBTcGVjaWZ5aW5nIGEgdmFsdWVcclxuICAgICAqICAgICBmb3IgdGlja2V0SWQgd2lsbCBjYXVzZSBSQU5ET00uT1JHIHRvIHJlY29yZCB0aGF0IHRoZSB0aWNrZXQgd2FzIHVzZWRcclxuICAgICAqICAgICB0byBnZW5lcmF0ZSB0aGUgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMuIEVhY2ggdGlja2V0IGNhbiBvbmx5IGJlIHVzZWRcclxuICAgICAqICAgICBvbmNlIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8e2RhdGE6IG51bWJlcltdfHN0cmluZ1tdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn1cclxuICAgICAqICAgICBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnNcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkSW50ZWdlcnMobiwgbWluLCBtYXgsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jaW50ZWdlclJlcXVlc3QobiwgbWluLCBtYXgsIG9wdGlvbnMsIHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0U2lnbmVkKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIHVuaWZvcm0gb3IgbXVsdGlmb3JtIHNlcXVlbmNlcyBvZiB0cnVlIHJhbmRvbSBpbnRlZ2Vyc1xyXG4gICAgICogd2l0aGluIHVzZXItZGVmaW5lZCByYW5nZXMgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBhcnJheSBvZiBpbnRlZ2VyIHNlcXVlbmNlcyBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWxcclxuICAgICAqIHJlc3BvbnNlIG1hcHBlZCB0byAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG9cclxuICAgICAqICdzaWduYXR1cmUnLlxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dlbmVyYXRlSW50ZWdlclNlcXVlbmNlc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgYXJyYXlzIG9mIHJhbmRvbSBpbnRlZ2VycyB5b3UgbmVlZC4gTXVzdCBiZVxyXG4gICAgICogICAgIHdpdGhpbiB0aGUgWzEsMWUzXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IGxlbmd0aCBUaGUgbGVuZ3RoIG9mIGVhY2ggYXJyYXkgb2YgcmFuZG9tXHJcbiAgICAgKiAgICAgaW50ZWdlcnMgcmVxdWVzdGVkLiBGb3IgdW5pZm9ybSBzZXF1ZW5jZXMsIGxlbmd0aCBtdXN0IGJlIGFuIGludGVnZXJcclxuICAgICAqICAgICBpbiB0aGUgWzEsIDFlNF0gcmFuZ2UuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBsZW5ndGggY2FuIGJlIGFuIGFycmF5XHJcbiAgICAgKiAgICAgd2l0aCBuIGludGVnZXJzLCBlYWNoIHNwZWNpZnlpbmcgdGhlIGxlbmd0aCBvZiB0aGUgc2VxdWVuY2UgaWRlbnRpZmllZFxyXG4gICAgICogICAgIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIGxlbmd0aCBtdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwgMWU0XSByYW5nZSBhbmQgdGhlIHRvdGFsIHN1bSBvZiBhbGwgdGhlIGxlbmd0aHMgbXVzdCBiZSBpbiB0aGVcclxuICAgICAqICAgICBbMSwgMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IG1pbiBUaGUgbG93ZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBGb3IgdW5pZm9ybSBzZXF1ZW5jZXMsIG1pbiBtdXN0IGJlXHJcbiAgICAgKiAgICAgYW4gaW50ZWdlciBpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBtaW4gY2FuXHJcbiAgICAgKiAgICAgYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXJzLCBlYWNoIHNwZWNpZnlpbmcgdGhlIGxvd2VyIGJvdW5kYXJ5IG9mIHRoZVxyXG4gICAgICogICAgIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbWluIG11c3RcclxuICAgICAqICAgICBiZSB3aXRoaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gbWF4IFRoZSB1cHBlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2hcclxuICAgICAqICAgICB0aGUgcmFuZG9tIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIEZvciB1bmlmb3JtIHNlcXVlbmNlcywgbWF4IG11c3QgYmVcclxuICAgICAqICAgICBhbiBpbnRlZ2VyIGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIG1heCBjYW5cclxuICAgICAqICAgICBiZSBhbiBhcnJheSB3aXRoIG4gaW50ZWdlcnMsIGVhY2ggc3BlY2lmeWluZyB0aGUgdXBwZXIgYm91bmRhcnkgb2YgdGhlXHJcbiAgICAgKiAgICAgc2VxdWVuY2UgaWRlbnRpZmllZCBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBtYXggbXVzdFxyXG4gICAgICogICAgIGJlIHdpdGhpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW58Ym9vbGVhbltdLCBiYXNlPzogbnVtYmVyfG51bWJlcltdLFxyXG4gICAgICogICAgIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OiBPYmplY3QsIGxpY2Vuc2VEYXRhPzogT2JqZWN0LCB1c2VyRGF0YT86XHJcbiAgICAgKiAgICAgT2JqZWN0fG51bWJlcnxzdHJpbmcsIHRpY2tldElkPzogc3RyaW5nfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5XHJcbiAgICAgKiAgICAgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7KGJvb2xlYW58Ym9vbGVhbltdKX0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXJcclxuICAgICAqICAgICB0aGUgcmFuZG9tIG51bWJlcnMgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGVcclxuICAgICAqICAgICByZXN1bHRpbmcgbnVtYmVycyBtYXkgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnNcclxuICAgICAqICAgICB3aWxsIGFsbCBiZSB1bmlxdWUuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCByZXBsYWNlbWVudCBjYW4gYmUgYW4gYXJyYXlcclxuICAgICAqICAgICB3aXRoIG4gYm9vbGVhbiB2YWx1ZXMsIGVhY2ggc3BlY2lmeWluZyB3aGV0aGVyIHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5XHJcbiAgICAgKiAgICAgaXRzIGluZGV4IHdpbGwgYmUgY3JlYXRlZCB3aXRoICh0cnVlKSBvciB3aXRob3V0IChmYWxzZSkgcmVwbGFjZW1lbnRcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IFtvcHRpb25zLmJhc2U9MTBdIFRoZSBiYXNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvXHJcbiAgICAgKiAgICAgZGlzcGxheSB0aGUgbnVtYmVycy4gVmFsdWVzIGFsbG93ZWQgYXJlIDIsIDgsIDEwIGFuZCAxNi4gRm9yIG11bHRpZm9ybVxyXG4gICAgICogICAgIHNlcXVlbmNlcywgYmFzZSBjYW4gYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXIgdmFsdWVzIHRha2VuIGZyb20gdGhlIHNhbWVcclxuICAgICAqICAgICBzZXQsIGVhY2ggc3BlY2lmeWluZyB0aGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5IHRoZSBzZXF1ZW5jZVxyXG4gICAgICogICAgIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4IChkZWZhdWx0IDEwKS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5saWNlbnNlRGF0YT1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0IHdoaWNoIGFsbG93c1xyXG4gICAgICogICAgIHRoZSBjYWxsZXIgdG8gaW5jbHVkZSBkYXRhIG9mIHJlbGV2YW5jZSB0byB0aGUgbGljZW5zZSB0aGF0IGlzIGFzc29jaWF0ZWRcclxuICAgICAqICAgICB3aXRoIHRoZSBBUEkgS2V5LiBUaGlzIGlzIG1hbmRhdG9yeSBmb3IgQVBJIEtleXMgd2l0aCB0aGUgbGljZW5zZSB0eXBlXHJcbiAgICAgKiAgICAgJ0ZsZXhpYmxlIEdhbWJsaW5nJyBhbmQgZm9sbG93cyB0aGUgZm9ybWF0IHsgJ21heFBheW91dCc6IHsgJ2N1cnJlbmN5JzpcclxuICAgICAqICAgICAnWFRTJywgJ2Ftb3VudCc6IDAuMCB9fS4gVGhpcyBpbmZvcm1hdGlvbiBpcyB1c2VkIGluIGxpY2Vuc2luZ1xyXG4gICAgICogICAgIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzIGFuZCBpbiBiaWxsaW5nLiBUaGUgY3VycmVudGx5IHN1cHBvcnRlZFxyXG4gICAgICogICAgIGN1cnJlbmNpZXMgYXJlOiAnVVNEJywgJ0VVUicsICdHQlAnLCAnQlRDJywgJ0VUSCcuIFRoZSBtb3N0IHVwLXRvLWRhdGVcclxuICAgICAqICAgICBpbmZvcm1hdGlvbiBvbiB0aGUgY3VycmVuY2llcyBjYW4gYmUgZm91bmQgaW4gdGhlIFNpZ25lZCBBUElcclxuICAgICAqICAgICBkb2N1bWVudGF0aW9uLCBoZXJlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkXHJcbiAgICAgKiBAcGFyYW0geyhzdHJpbmd8bnVtYmVyfE9iamVjdCl9IFtvcHRpb25zLnVzZXJEYXRhPW51bGxdIE9iamVjdCB0aGF0IHdpbGwgYmVcclxuICAgICAqICAgICBpbmNsdWRlZCBpbiB1bm1vZGlmaWVkIGZvcm0uIEl0cyBtYXhpbXVtIHNpemUgaW4gZW5jb2RlZCAoU3RyaW5nKSBmb3JtXHJcbiAgICAgKiAgICAgaXMgMSwwMDAgY2hhcmFjdGVycyAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50aWNrZXRJZD1udWxsXSBBIHN0cmluZyB3aXRoIHRpY2tldCBpZGVudGlmaWVyXHJcbiAgICAgKiAgICAgb2J0YWluZWQgdmlhIHRoZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I2NyZWF0ZVRpY2tldHN9IG1ldGhvZC4gU3BlY2lmeWluZ1xyXG4gICAgICogICAgIGEgdmFsdWUgZm9yIHRpY2tldElkIHdpbGwgY2F1c2UgUkFORE9NLk9SRyB0byByZWNvcmQgdGhhdCB0aGUgdGlja2V0IHdhc1xyXG4gICAgICogICAgIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzLiBFYWNoIHRpY2tldCBjYW4gb25seSBiZSB1c2VkXHJcbiAgICAgKiAgICAgb25jZSAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHtkYXRhOiBudW1iZXJbXVtdfHN0cmluZ1tdW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fVxyXG4gICAgICogICAgIEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBpbnRlZ2VyIHNlcXVlbmNlc1xyXG4gICAgICogKiAqKnJhbmRvbSoqOiByYW5kb20gZmllbGQgYXMgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyXHJcbiAgICAgKiAqICoqc2lnbmF0dXJlKio6IHNpZ25hdHVyZSBzdHJpbmdcclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVTaWduZWRJbnRlZ2VyU2VxdWVuY2VzKG4sIGxlbmd0aCwgbWluLCBtYXgsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jaW50ZWdlclNlcXVlbmNlUmVxdWVzdChuLCBsZW5ndGgsIG1pbiwgbWF4LCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0IGEgbGlzdCAoc2l6ZSBuKSBvZiB0cnVlIHJhbmRvbSBkZWNpbWFsIGZyYWN0aW9ucywgZnJvbSBhIHVuaWZvcm1cclxuICAgICAqIGRpc3RyaWJ1dGlvbiBhY3Jvc3MgdGhlIFswLDFdIGludGVydmFsIHdpdGggYSB1c2VyLWRlZmluZWQgbnVtYmVyIG9mXHJcbiAgICAgKiBkZWNpbWFsIHBsYWNlcyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFJldHVybnMgYSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlc3ByZXNlbnRzIGFuIG9iamVjdFxyXG4gICAgICogd2l0aCB0aGUgcGFyc2VkIGRlY2ltYWwgZnJhY3Rpb25zIG1hcHBlZCB0byAnZGF0YScsIHRoZSBvcmlnaW5hbCByZXNwb25zZVxyXG4gICAgICogbWFwcGVkIHRvICdyYW5kb20nLCBhbmQgdGhlIHJlc3BvbnNlJ3Mgc2lnbmF0dXJlIG1hcHBlZCB0byAnc2lnbmF0dXJlJy4gU2VlOlxyXG4gICAgICogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZW5lcmF0ZVNpZ25lZERlY2ltYWxGcmFjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBkZWNpbWFsIGZyYWN0aW9ucyB5b3UgbmVlZC4gTXVzdCBiZVxyXG4gICAgICogICAgIHdpdGhpbiB0aGUgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWNpbWFsUGxhY2VzIFRoZSBudW1iZXIgb2YgZGVjaW1hbCBwbGFjZXMgdG8gdXNlLiBNdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbMSwyMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OiBPYmplY3QsIGxpY2Vuc2VEYXRhPzpcclxuICAgICAqICAgICBPYmplY3QsIHVzZXJEYXRhPzogT2JqZWN0fG51bWJlcnxzdHJpbmcsIHRpY2tldElkPzogc3RyaW5nfX0gb3B0aW9ucyBBblxyXG4gICAgICogICAgIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIG51bWJlcnNcclxuICAgICAqICAgICBtYXkgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnMgd2lsbCBhbGwgYmUgdW5pcXVlXHJcbiAgICAgKiAgICAgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybVxyXG4gICAgICogICAgIGlzIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogbnVtYmVyW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fSBBXHJcbiAgICAgKiAgICAgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBkZWNpbWFsIGZyYWN0aW9uc1xyXG4gICAgICogKiAqKnJhbmRvbSoqOiByYW5kb20gZmllbGQgYXMgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyXHJcbiAgICAgKiAqICoqc2lnbmF0dXJlKio6IHNpZ25hdHVyZSBzdHJpbmdcclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVTaWduZWREZWNpbWFsRnJhY3Rpb25zKG4sIGRlY2ltYWxQbGFjZXMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZGVjaW1hbEZyYWN0aW9uUmVxdWVzdChuLCBkZWNpbWFsUGxhY2VzLCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0IGEgbGlzdCAoc2l6ZSBuKSBvZiB0cnVlIHJhbmRvbSBudW1iZXJzIGZyb20gYSBHYXVzc2lhbiBkaXN0cmlidXRpb25cclxuICAgICAqIChhbHNvIGtub3duIGFzIGEgbm9ybWFsIGRpc3RyaWJ1dGlvbikuXHJcbiAgICAgKiBcclxuICAgICAqIFJldHVybnMgYSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlc3ByZXNlbnRzIGFuIG9iamVjdFxyXG4gICAgICogd2l0aCB0aGUgcGFyc2VkIG51bWJlcnMgbWFwcGVkIHRvICdkYXRhJywgdGhlIG9yaWdpbmFsIHJlc3BvbnNlIG1hcHBlZCB0b1xyXG4gICAgICogJ3JhbmRvbScsIGFuZCB0aGUgcmVzcG9uc2UncyBzaWduYXR1cmUgbWFwcGVkIHRvICdzaWduYXR1cmUnLiBTZWU6XHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dlbmVyYXRlU2lnbmVkR2F1c3NpYW5zXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gbnVtYmVycyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtZWFuIFRoZSBkaXN0cmlidXRpb24ncyBtZWFuLiBNdXN0IGJlIHdpdGhpbiB0aGUgWy0xZTYsMWU2XVxyXG4gICAgICogICAgIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0YW5kYXJkRGV2aWF0aW9uIFRoZSBkaXN0cmlidXRpb24ncyBzdGFuZGFyZCBkZXZpYXRpb24uXHJcbiAgICAgKiAgICAgTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU2LDFlNl0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2lnbmlmaWNhbnREaWdpdHMgVGhlIG51bWJlciBvZiBzaWduaWZpY2FudCBkaWdpdHMgdG8gdXNlLlxyXG4gICAgICogICAgIE11c3QgYmUgd2l0aGluIHRoZSBbMiwyMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge3twcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0LCBsaWNlbnNlRGF0YT86IE9iamVjdCwgdXNlckRhdGE/OlxyXG4gICAgICogICAgIE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86IHN0cmluZ319IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heVxyXG4gICAgICogICAgIGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybVxyXG4gICAgICogICAgIGlzIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogbnVtYmVyW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fSBBXHJcbiAgICAgKiAgICAgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBudW1iZXJzIGZyb20gYSBHYXVzc2lhbiBkaXN0cmlidXRpb25cclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkR2F1c3NpYW5zKG4sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLCBzaWduaWZpY2FudERpZ2l0cywgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnYXVzc2lhblJlcXVlc3QobiwgbWVhbiwgc3RhbmRhcmREZXZpYXRpb24sIHNpZ25pZmljYW50RGlnaXRzLFxyXG4gICAgICAgICAgICBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0IGEgbGlzdCAoc2l6ZSBuKSBvZiB0cnVlIHJhbmRvbSBzdHJpbmdzIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogUmV0dXJucyBhIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVzcHJlc2VudHMgYW4gb2JqZWN0XHJcbiAgICAgKiB3aXRoIHRoZSBwYXJzZWQgc3RyaW5ncyBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWwgcmVzcG9uc2UgbWFwcGVkIHRvXHJcbiAgICAgKiAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG8gJ3NpZ25hdHVyZScuIFNlZTpcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2VuZXJhdGVTaWduZWRTdHJpbmdzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gc3RyaW5ncyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIHN0cmluZy4gTXVzdCBiZSB3aXRoaW4gdGhlIFsxLDIwXVxyXG4gICAgICogICAgIHJhbmdlLiBBbGwgc3RyaW5ncyB3aWxsIGJlIG9mIHRoZSBzYW1lIGxlbmd0aC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJzIEEgc3RyaW5nIHRoYXQgY29udGFpbnMgdGhlIHNldCBvZiBjaGFyYWN0ZXJzXHJcbiAgICAgKiAgICAgdGhhdCBhcmUgYWxsb3dlZCB0byBvY2N1ciBpbiB0aGUgcmFuZG9tIHN0cmluZ3MuIFRoZSBtYXhpbXVtIG51bWJlclxyXG4gICAgICogICAgIG9mIGNoYXJhY3RlcnMgaXMgODAuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OiBPYmplY3QsIGxpY2Vuc2VEYXRhPzpcclxuICAgICAqICAgICBPYmplY3QsIHVzZXJEYXRhPzogT2JqZWN0fG51bWJlcnxzdHJpbmcsIHRpY2tldElkPzogc3RyaW5nfX0gb3B0aW9ucyBBblxyXG4gICAgICogICAgIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9bnVsbF0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIHN0cmluZ3Mgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIGxpc3RcclxuICAgICAqICAgICBvZiBzdHJpbmdzIG1heSBjb250YWluIGR1cGxpY2F0ZXMsIG90aGVyd2lzZSB0aGUgc3RyaW5ncyB3aWxsIGFsbCBiZVxyXG4gICAgICogICAgIHVuaXF1ZSAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5saWNlbnNlRGF0YT1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0IHdoaWNoIGFsbG93c1xyXG4gICAgICogICAgIHRoZSBjYWxsZXIgdG8gaW5jbHVkZSBkYXRhIG9mIHJlbGV2YW5jZSB0byB0aGUgbGljZW5zZSB0aGF0IGlzIGFzc29jaWF0ZWRcclxuICAgICAqICAgICB3aXRoIHRoZSBBUEkgS2V5LiBUaGlzIGlzIG1hbmRhdG9yeSBmb3IgQVBJIEtleXMgd2l0aCB0aGUgbGljZW5zZSB0eXBlXHJcbiAgICAgKiAgICAgJ0ZsZXhpYmxlIEdhbWJsaW5nJyBhbmQgZm9sbG93cyB0aGUgZm9ybWF0IHsgJ21heFBheW91dCc6IHsgJ2N1cnJlbmN5JzpcclxuICAgICAqICAgICAnWFRTJywgJ2Ftb3VudCc6IDAuMCB9fS4gVGhpcyBpbmZvcm1hdGlvbiBpcyB1c2VkIGluIGxpY2Vuc2luZ1xyXG4gICAgICogICAgIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzIGFuZCBpbiBiaWxsaW5nLiBUaGUgY3VycmVudGx5IHN1cHBvcnRlZFxyXG4gICAgICogICAgIGN1cnJlbmNpZXMgYXJlOiAnVVNEJywgJ0VVUicsICdHQlAnLCAnQlRDJywgJ0VUSCcuIFRoZSBtb3N0IHVwLXRvLWRhdGVcclxuICAgICAqICAgICBpbmZvcm1hdGlvbiBvbiB0aGUgY3VycmVuY2llcyBjYW4gYmUgZm91bmQgaW4gdGhlIFNpZ25lZCBBUElcclxuICAgICAqICAgICBkb2N1bWVudGF0aW9uLCBoZXJlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkXHJcbiAgICAgKiBAcGFyYW0geyhzdHJpbmd8bnVtYmVyfE9iamVjdCl9IFtvcHRpb25zLnVzZXJEYXRhPW51bGxdIE9iamVjdCB0aGF0IHdpbGwgYmVcclxuICAgICAqICAgICBpbmNsdWRlZCBpbiB1bm1vZGlmaWVkIGZvcm0uIEl0cyBtYXhpbXVtIHNpemUgaW4gZW5jb2RlZCAoU3RyaW5nKSBmb3JtXHJcbiAgICAgKiAgICAgaXMgMSwwMDAgY2hhcmFjdGVycyAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50aWNrZXRJZD1udWxsXSBBIHN0cmluZyB3aXRoIHRpY2tldCBpZGVudGlmaWVyXHJcbiAgICAgKiAgICAgb2J0YWluZWQgdmlhIHRoZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I2NyZWF0ZVRpY2tldHN9IG1ldGhvZC4gU3BlY2lmeWluZ1xyXG4gICAgICogICAgIGEgdmFsdWUgZm9yIHRpY2tldElkIHdpbGwgY2F1c2UgUkFORE9NLk9SRyB0byByZWNvcmQgdGhhdCB0aGUgdGlja2V0IHdhc1xyXG4gICAgICogICAgIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzLiBFYWNoIHRpY2tldCBjYW4gb25seSBiZSB1c2VkXHJcbiAgICAgKiAgICAgb25jZSAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHtkYXRhOiBzdHJpbmdbXSwgcmFuZG9tOiBPYmplY3QsIHNpZ25hdHVyZTogc3RyaW5nfT59IEFcclxuICAgICAqICAgICBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlcHJlc2VudHMgYW4gb2JqZWN0IHdpdGggdGhlXHJcbiAgICAgKiAgICAgZm9sbG93aW5nIHN0cnVjdHVyZTpcclxuICAgICAqICogKipkYXRhKio6IGFycmF5IG9mIHRydWUgcmFuZG9tIHN0cmluZ3NcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkU3RyaW5ncyhuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jc3RyaW5nUmVxdWVzdChuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIG9wdGlvbnMsIHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0U2lnbmVkKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3QgYSBsaXN0IChzaXplIG4pIG9mIHZlcnNpb24gNCB0cnVlIHJhbmRvbSBVbml2ZXJzYWxseSBVbmlxdWVcclxuICAgICAqIElEZW50aWZpZXJzIChVVUlEcykgaW4gYWNjb3JkYW5jZSB3aXRoIHNlY3Rpb24gNC40IG9mIFJGQyA0MTIyLCBmcm9tXHJcbiAgICAgKiB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBVVUlEcyBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWwgcmVzcG9uc2UgbWFwcGVkIHRvXHJcbiAgICAgKiAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG8gJ3NpZ25hdHVyZScuIFNlZTpcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2VuZXJhdGVTaWduZWRVVUlEc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIFVVSURzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxZTNdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdCwgbGljZW5zZURhdGE/OiBPYmplY3QsIHVzZXJEYXRhPzpcclxuICAgICAqICAgICBPYmplY3R8c3RyaW5nfG51bWJlciwgdGlja2V0SWQ/OiBzdHJpbmd9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXlcclxuICAgICAqICAgICBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybVxyXG4gICAgICogICAgIGlzIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogc3RyaW5nW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fSBBXHJcbiAgICAgKiAgICAgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBVVUlEc1xyXG4gICAgICogKiAqKnJhbmRvbSoqOiByYW5kb20gZmllbGQgYXMgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyXHJcbiAgICAgKiAqICoqc2lnbmF0dXJlKio6IHNpZ25hdHVyZSBzdHJpbmdcclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVTaWduZWRVVUlEcyhuLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI1VVSURSZXF1ZXN0KG4sIG9wdGlvbnMsIHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0U2lnbmVkKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3QgYSBsaXN0IChzaXplIG4pIG9mIEJpbmFyeSBMYXJnZSBPQmplY3RzIChCTE9CcykgY29udGFpbmluZyB0cnVlXHJcbiAgICAgKiByYW5kb20gZGF0YSBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFJldHVybnMgYSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlc3ByZXNlbnRzIGFuIG9iamVjdFxyXG4gICAgICogd2l0aCB0aGUgcGFyc2VkIEJMT0JzIG1hcHBlZCB0byAnZGF0YScsIHRoZSBvcmlnaW5hbCByZXNwb25zZSBtYXBwZWQgdG9cclxuICAgICAqICdyYW5kb20nLCBhbmQgdGhlIHJlc3BvbnNlJ3Mgc2lnbmF0dXJlIG1hcHBlZCB0byAnc2lnbmF0dXJlJy4gU2VlOlxyXG4gICAgICogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZW5lcmF0ZVNpZ25lZEJsb2JzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gYmxvYnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDEwMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSBUaGUgc2l6ZSBvZiBlYWNoIGJsb2IsIG1lYXN1cmVkIGluIGJpdHMuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDEwNDg1NzZdIHJhbmdlIGFuZCBtdXN0IGJlIGRpdmlzaWJsZSBieSA4LlxyXG4gICAgICogQHBhcmFtIHt7Zm9ybWF0Pzogc3RyaW5nLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0LCBsaWNlbnNlRGF0YT86XHJcbiAgICAgKiAgICAgT2JqZWN0LCB1c2VyRGF0YT86IE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86IHN0cmluZ319IG9wdGlvbnMgQW5cclxuICAgICAqICAgICBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW4gYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5mb3JtYXQ9J2Jhc2U2NCddIFNwZWNpZmllcyB0aGUgZm9ybWF0IGluIHdoaWNoIHRoZVxyXG4gICAgICogICAgIGJsb2JzIHdpbGwgYmUgcmV0dXJuZWQuIFZhbHVlcyBhbGxvd2VkIGFyZSAnYmFzZTY0JyBhbmQgJ2hleCcgKGRlZmF1bHRcclxuICAgICAqICAgICAnYmFzZTY0JykuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybSBpc1xyXG4gICAgICogICAgIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogc3RyaW5nW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fSBBXHJcbiAgICAgKiAgICAgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBibG9icyBhcyBzdHJpbmdzXHJcbiAgICAgKiAqICoqcmFuZG9tKio6IHJhbmRvbSBmaWVsZCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAqICogKipzaWduYXR1cmUqKjogc2lnbmF0dXJlIHN0cmluZ1xyXG4gICAgICogQHNlZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I0JMT0JfRk9STUFUX0JBU0U2NH0gZm9yICdiYXNlNjQnIChkZWZhdWx0KS5cclxuICAgICAqIEBzZWUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNCTE9CX0ZPUk1BVF9IRVh9IGZvciAnaGV4Jy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVTaWduZWRCbG9icyhuLCBzaXplLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2Jsb2JSZXF1ZXN0KG4sIHNpemUsIG9wdGlvbnMsIHRydWUpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0U2lnbmVkKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBPVEhFUiBNRVRIT0RTXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBWZXJpZmllcyB0aGUgc2lnbmF0dXJlIG9mIGEgcmVzcG9uc2UgcHJldmlvdXNseSByZWNlaXZlZCBmcm9tIG9uZSBvZiB0aGVcclxuICAgICAqIG1ldGhvZHMgaW4gdGhlIFNpZ25lZCBBUEkgd2l0aCB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGlzIGlzIHVzZWQgdG8gZXhhbWluZSB0aGUgYXV0aGVudGljaXR5IG9mIG51bWJlcnMuIFJldHVybnMgVHJ1ZSBvblxyXG4gICAgICogdmVyaWZpY2F0aW9uIHN1Y2Nlc3MuIFNlZTpcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjdmVyaWZ5U2lnbmF0dXJlXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmFuZG9tIFRoZSByYW5kb20gZmllbGQgZnJvbSBhIHJlc3BvbnNlIHJldHVybmVkIGJ5IFJBTkRPTS5PUkdcclxuICAgICAqICAgICB0aHJvdWdoIG9uZSBvZiB0aGUgU2lnbmVkIEFQSSBtZXRob2RzLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNpZ25hdHVyZSBUaGUgc2lnbmF0dXJlIGZpZWxkIGZyb20gdGhlIHNhbWUgcmVzcG9uc2UgdGhhdFxyXG4gICAgICogICAgIHRoZSByYW5kb20gZmllbGQgb3JpZ2luYXRlcyBmcm9tLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgd2hldGhlciB0aGUgcmVzdWx0IGNvdWxkIGJlIHZlcmlmaWVkICh0cnVlKSBvciBub3QgKGZhbHNlKS5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgdmVyaWZ5U2lnbmF0dXJlKHJhbmRvbSwgc2lnbmF0dXJlKSB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgcmFuZG9tOiByYW5kb20sXHJcbiAgICAgICAgICAgIHNpZ25hdHVyZTogc2lnbmF0dXJlXHJcbiAgICAgICAgfTtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2dlbmVyYXRlUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI1ZFUklGWV9TSUdOQVRVUkVfTUVUSE9ELCBwYXJhbXMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0VmVyaWZpY2F0aW9uKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIChlc3RpbWF0ZWQpIG51bWJlciBvZiByZW1haW5pbmcgdHJ1ZSByYW5kb20gYml0cyBhdmFpbGFibGUgdG9cclxuICAgICAqIHRoZSBjbGllbnQuIElmIGNhY2hlZCB1c2FnZSBpbmZvIGlzIG9sZGVyIHRoYW4gYW4gaG91ciwgZnJlc2ggaW5mbyBpc1xyXG4gICAgICogb2J0YWluZWQgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyB0aGUgbnVtYmVyIG9mIGJpdHMgcmVtYWluaW5nLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRCaXRzTGVmdCgpIHtcclxuICAgICAgICBsZXQgdXBkYXRlID0gRGF0ZS5ub3coKSA+ICh0aGlzLiNsYXN0UmVzcG9uc2VSZWNlaXZlZFRpbWUgKyBSYW5kb21PcmdDbGllbnQuI0FMTE9XQU5DRV9TVEFURV9SRUZSRVNIX1NFQ09ORFMpO1xyXG4gICAgICAgIGlmICh0aGlzLiNiaXRzTGVmdCA8IDAgfHwgdXBkYXRlKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuI2dldFVzYWdlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLiNiaXRzTGVmdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIChlc3RpbWF0ZWQpIG51bWJlciBvZiByZW1haW5pbmcgQVBJIHJlcXVlc3RzIGF2YWlsYWJsZSB0byB0aGVcclxuICAgICAqIGNsaWVudC4gSWYgY2FjaGVkIHVzYWdlIGluZm8gaXMgb2xkZXIgdGhhbiBhbiBob3VyLCBmcmVzaCBpbmZvIGlzXHJcbiAgICAgKiBvYnRhaW5lZCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIHRoZSBudW1iZXIgb2YgcmVxdWVzdHMgcmVtYWluaW5nLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRSZXF1ZXN0c0xlZnQoKSB7XHJcbiAgICAgICAgbGV0IHVwZGF0ZSA9IERhdGUubm93KCkgPiAodGhpcy4jbGFzdFJlc3BvbnNlUmVjZWl2ZWRUaW1lICsgUmFuZG9tT3JnQ2xpZW50LiNBTExPV0FOQ0VfU1RBVEVfUkVGUkVTSF9TRUNPTkRTKTtcclxuICAgICAgICBpZiAodGhpcy4jcmVxdWVzdHNMZWZ0IDwgMCB8fCB1cGRhdGUpIHtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy4jZ2V0VXNhZ2UoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI3JlcXVlc3RzTGVmdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyBzaWduZWQgcmFuZG9tIHZhbHVlcyBnZW5lcmF0ZWQgd2l0aGluIHRoZSBsYXN0IDI0aCwgdXNpbmcgYVxyXG4gICAgICogc2VyaWFsIG51bWJlci5cclxuICAgICAqIFxyXG4gICAgICogSWYgdGhlIGhpc3RvcmljYWwgcmVzcG9uc2Ugd2FzIGZvdW5kLCB0aGUgcmVzcG9uc2Ugd2lsbCBjb250YWluIHRoZSBzYW1lXHJcbiAgICAgKiB2YWx1ZXMgdGhhdCB3ZXJlIHJldHVybmVkIGJ5IHRoZSBtZXRob2QgdGhhdCB3YXMgdXNlZCB0byBnZW5lcmF0ZSB0aGUgdmFsdWVzXHJcbiAgICAgKiBpbml0aWFsbHkuIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZXRSZXN1bHRcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXJpYWxOdW1iZXIgQW4gaW50ZWdlciBjb250YWluaW5nIHRoZSBzZXJpYWwgbnVtYmVyXHJcbiAgICAgKiAgICAgYXNzb2NpYXRlZCB3aXRoIHRoZSByZXNwb25zZSB5b3Ugd2lzaCB0byByZXRyaWV2ZS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmUsIGlkZW50aWNhbCB0byB0aGF0XHJcbiAgICAgKiAgICAgcmV0dXJuZWQgYnkgdGhlIG9yaWdpbmFsIHJlcXVlc3Q6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSB2YWx1ZXNcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldFJlc3VsdChzZXJpYWxOdW1iZXIpIHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBzZXJpYWxOdW1iZXI6IHNlcmlhbE51bWJlclxyXG4gICAgICAgIH07XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI0dFVF9SRVNVTFRfTUVUSE9ELCBwYXJhbXMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0U2lnbmVkKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEB0eXBlZGVmIHtPYmplY3R9IE5ld1RpY2tldCBBIHRpY2tldCBhcyBpdCBpcyByZXR1cm5lZCBieSB0aGUgY3JlYXRlVGlja2V0cygpIG1ldGhvZC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0aWNrZXRJZCBBIHN0cmluZyB2YWx1ZSB0aGF0IHVuaXF1ZWx5IGlkZW50aWZpZXMgdGhlIHRpY2tldC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjcmVhdGlvblRpbWUgQSBzdHJpbmcgY29udGFpbmluZyB0aGUgdGltZXN0YW1wIGluIElTTyA4NjAxXHJcbiAgICAgKiAgICAgZm9ybWF0IGF0IHdoaWNoIHRoZSB0aWNrZXQgd2FzIGNyZWF0ZWQuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gcHJldmlvdXNUaWNrZXRJZCBUaGUgcHJldmlvdXMgdGlja2V0IGluIHRoZSBjaGFpbiB0byB3aGljaCB0aGlzXHJcbiAgICAgKiAgICAgdGlja2V0IGJlbG9uZ3MuIFNpbmNlIGEgbmV3IGNoYWluIG9ubHkgY29udGFpbnMgb25lIHRpY2tldCwgcHJldmlvdXNUaWNrZXRJZCB3aWxsXHJcbiAgICAgKiAgICAgYmUgbnVsbC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBuZXh0VGlja2V0SWQgQSBzdHJpbmcgdmFsdWUgdGhhdCBpZGVudGlmaWVzIHRoZSBuZXh0IHRpY2tldCBpblxyXG4gICAgICogICAgIHRoZSBjaGFpbi4gU2luY2UgYSBuZXcgY2hhaW4gb25seSBjb250YWlucyBvbmUgdGlja2V0LCBuZXh0VGlja2V0SWQgd2lsbCBiZSBudWxsLlxyXG4gICAgICovXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBUaWNrZXQgQSB0aWNrZXQgYXMgaXQgaXMgcmV0dXJuZWQgYnkgdGhlIGxpc3RUaWNrZXRzKCkgYW5kXHJcbiAgICAgKiAgICAgZ2V0VGlja2V0KCkgbWV0aG9kcy5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB0aWNrZXRJZCBBIHN0cmluZyB2YWx1ZSB0aGF0IHVuaXF1ZWx5IGlkZW50aWZpZXMgdGhlIHRpY2tldC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBoYXNoZWRBcGlLZXkgVGhlIGhhc2hlZCBBUEkga2V5IGZvciB3aGljaCB0aGUgdGlja2V0IGlzIHZhbGlkLlxyXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSBzaG93UmVzdWx0IElmIGZhbHNlLCBnZXRUaWNrZXQoKSB3aWxsIHJldHVybiBvbmx5IHRoZSBiYXNpY1xyXG4gICAgICogICAgIHRpY2tldCBpbmZvcm1hdGlvbi4gSWYgdHJ1ZSwgdGhlIGZ1bGwgcmFuZG9tIGFuZCBzaWduYXR1cmUgb2JqZWN0cyBmcm9tIHRoZVxyXG4gICAgICogICAgIHJlc3BvbnNlIHRoYXQgd2FzIHVzZWQgdG8gc2F0aXNmeSB0aGUgdGlja2V0IGlzIHJldHVybmVkLiBGb3IgbW9yZSBpbmZvcm1hdGlvbixcclxuICAgICAqICAgICBwbGVhc2Ugc2VlIHRoZSBkb2N1bWVudGF0aW9uIGZvciBnZXRUaWNrZXQuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gY3JlYXRpb25UaW1lIFRoZSB0aW1lc3RhbXAgaW4gSVNPIDg2MDEgZm9ybWF0IGF0IHdoaWNoIHRoZSB0aWNrZXRcclxuICAgICAqICAgICB3YXMgY3JlYXRlZC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSB1c2VkVGltZSBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0IHdhc1xyXG4gICAgICogICAgIHVzZWQuIElmIHRoZSB0aWNrZXQgaGFzIG5vdCBiZWVuIHVzZWQgeWV0LCB0aGlzIHZhbHVlIGlzIG51bGwuXHJcbiAgICAgKiBAcHJvcGVydHkge251bWJlcn0gc2VyaWFsTnVtYmVyIEEgbnVtZXJpYyB2YWx1ZSBpbmRpY2F0aW5nIHdoaWNoIHNlcmlhbCBudW1iZXJcclxuICAgICAqICAgICAod2l0aGluIHRoZSBBUEkga2V5IHVzZWQgdG8gc2VydmUgdGhlIHRpY2tldCkgd2FzIHVzZWQgZm9yIHRoZSB0aWNrZXQuIElmIHRoZVxyXG4gICAgICogICAgIGNhbGxlciBoYXMgdGhlIHVuaGFzaGVkIEFQSSBrZXksIHRoZXkgY2FuIHVzZSB0aGUgc2VyaWFsTnVtYmVyIHJldHVybmVkIHRvIG9idGFpblxyXG4gICAgICogICAgIHRoZSBmdWxsIHJlc3VsdCB2aWEgdGhlIGdldFJlc3VsdCBtZXRob2QuIElmIHRoZSB0aWNrZXQgaGFzIG5vdCBiZWVuIHVzZWQgeWV0LFxyXG4gICAgICogICAgIHRoaXMgdmFsdWUgaXMgbnVsbC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBleHBpcmF0aW9uVGltZSBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0XHJcbiAgICAgKiAgICAgZXhwaXJlcy4gSWYgdGhlIHRpY2tldCBoYXMgbm90IGJlZW4gdXNlZCB5ZXQsIHRoaXMgdmFsdWUgaXMgbnVsbC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBwcmV2aW91c1RpY2tldElkIFRoZSBwcmV2aW91cyB0aWNrZXQgaW4gdGhlIGNoYWluIHRvIHdoaWNoIHRoaXNcclxuICAgICAqICAgICB0aWNrZXQgYmVsb25ncy4gSWYgdGhlIHRpY2tldCBpcyB0aGUgZmlyc3QgaW4gaXRzIGNoYWluLCB0aGVuIHByZXZpb3VzVGlja2V0SWQgaXNcclxuICAgICAqICAgICBudWxsLlxyXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IG5leHRUaWNrZXRJZCBBIHN0cmluZyB2YWx1ZSB0aGF0IGlkZW50aWZpZXMgdGhlIG5leHRcclxuICAgICAqICAgICB0aWNrZXQgaW4gdGhlIGNoYWluLlxyXG4gICAgICogQHByb3BlcnR5IHtPYmplY3R9IFtyZXN1bHRdIFRoZSBzYW1lIG9iamVjdCB0aGF0IHdhcyByZXR1cm5lZCBieSB0aGUgbWV0aG9kIHRoYXQgd2FzXHJcbiAgICAgKiAgICAgb3JpZ2luYWxseSB1c2VkIHRvIGdlbmVyYXRlIHRoZSB2YWx1ZXMuXHJcbiAgICAgKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgbiB0aWNrZXRzIHRvIGJlIHVzZWQgaW4gc2lnbmVkIHZhbHVlLWdlbmVyYXRpbmcgbWV0aG9kcy5cclxuICAgICAqICBcclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNjcmVhdGVUaWNrZXRzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpY2tldHMgcmVxdWVzdGVkLiBUaGlzIG11c3QgYmUgYSBudW1iZXJcclxuICAgICAqICAgICBpbiB0aGUgWzEsIDUwXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2hvd1Jlc3VsdCBBIGJvb2xlYW4gdmFsdWUgdGhhdCBkZXRlcm1pbmVzIGhvdyBtdWNoXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gY2FsbHMgdG8ge0BsaW5rIGdldFRpY2tldH0gd2lsbCByZXR1cm4uXHJcbiAgICAgKiAqICoqZmFsc2UqKjogZ2V0VGlja2V0IHdpbGwgcmV0dXJuIG9ubHkgdGhlIGJhc2ljIHRpY2tldCBpbmZvcm1hdGlvbi5cclxuICAgICAqICogKip0cnVlKio6IHRoZSBmdWxsIHJhbmRvbSBhbmQgc2lnbmF0dXJlIG9iamVjdHMgZnJvbSB0aGUgcmVzcG9uc2UgdGhhdFxyXG4gICAgICogICAgIHdhcyB1c2VkIHRvIHNhdGlzZnkgdGhlIHRpY2tldCBpcyByZXR1cm5lZC4gXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxOZXdUaWNrZXRbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdGlja2V0IG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIHN0cnVjdHVyZTpcclxuICAgICAqICogKip0aWNrZXRJZCoqOiBBIHN0cmluZyB2YWx1ZSB0aGF0IHVuaXF1ZWx5IGlkZW50aWZpZXMgdGhlIHRpY2tldC5cclxuICAgICAqICogKipjcmVhdGlvblRpbWUqKjogVGhlIHRpbWUgd2hlbiB0aGUgdGlja2V0IHdhcyBjcmVhdGVkIChJU08gODYwMSBmb3JtYXQpLlxyXG4gICAgICogKiAqKm5leHRUaWNrZXRJZCoqOiBBIHN0cmluZyBwb2ludGluZyB0byB0aGUgbmV4dCB0aWNrZXQgaW4gdGhlIGNoYWluLlxyXG4gICAgICogICAgIFRoaXMgd2lsbCBiZSBudWxsLCBhcyB0aGUgdGlja2V0cyByZXR1cm5lZCBmcm9tIHRoaXMgbWV0aG9kIGFyZSB0aGVcclxuICAgICAqICAgICBmaXJzdCBpbiB0aGVpciByZXNwZWN0aXZlIGNoYWlucy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgY3JlYXRlVGlja2V0cyhuLCBzaG93UmVzdWx0KSB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbjogbixcclxuICAgICAgICAgICAgc2hvd1Jlc3VsdDogc2hvd1Jlc3VsdFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI0NSRUFURV9USUNLRVRfTUVUSE9ELCBwYXJhbXMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0UmVzdWx0KHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIE9idGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgdGlja2V0cyBsaW5rZWQgd2l0aCB5b3VyIEFQSSBrZXkuXHJcbiAgICAgKiBcclxuICAgICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiB0aWNrZXRzIHRoYXQgY2FuIGJlIHJldHVybmVkIGJ5IHRoaXMgbWV0aG9kIGlzIDIwMDAuXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjbGlzdFRpY2tldHNcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0aWNrZXRUeXBlIEEgc3RyaW5nIGRlc2NyaWJpbmcgdGhlIHR5cGUgb2YgdGlja2V0cyB5b3Ugd2FudFxyXG4gICAgICogICAgIHRvIG9idGFpbiBpbmZvcm1hdGlvbiBhYm91dC4gUG9zc2libGUgdmFsdWVzIGFyZSAnc2luZ2xldG9uJywgJ2hlYWQnXHJcbiAgICAgKiAgICAgYW5kICd0YWlsJy5cclxuICAgICAqICogKionc2luZ2xldG9uJyoqIHJldHVybnMgdGlja2V0cyB0aGF0IGhhdmUgbm8gcHJldmlvdXMgb3IgbmV4dCB0aWNrZXRzLlxyXG4gICAgICogKiAqKidoZWFkJyoqIHJldHVybnMgdGlja2V0cyBoYXQgZG8gbm90IGhhdmUgYSBwcmV2aW91cyB0aWNrZXQgYnV0IHRoYXQgZG9cclxuICAgICAqICAgICBoYXZlIGEgbmV4dCB0aWNrZXQuXHJcbiAgICAgKiAqICoqJ3RhaWwnKiogcmV0dXJucyB0aWNrZXRzIHRoYXQgaGF2ZSBhIHByZXZpb3VzIHRpY2tldCBidXQgZG8gbm90IGhhdmUgYVxyXG4gICAgICogICAgICAgbmV4dCB0aWNrZXQuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxUaWNrZXRbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdGlja2V0IG9iamVjdHMsIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqICAgICAqKk5PVEU6KiogVGhlIG9iamVjdHMgcmV0dXJuZWQgZnJvbSB0aGlzIG1ldGhvZCBkbyBub3QgY29udGFpbiBcInJlc3VsdFwiXHJcbiAgICAgKiAgICAgZmllbGRzLCBldmVuIGlmIHRpY2tldHMgd2VyZSBjcmVhdGVkIHdpdGggXCJzaG93UmVzdWx0XCIgc2V0IHRvIHRydWUuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGxpc3RUaWNrZXRzKHRpY2tldFR5cGUpIHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICB0aWNrZXRUeXBlOiB0aWNrZXRUeXBlXHJcbiAgICAgICAgfTtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0KFJhbmRvbU9yZ0NsaWVudC4jTElTVF9USUNLRVRfTUVUSE9ELCBwYXJhbXMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0UmVzdWx0KHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIE9idGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgYSBzaW5nbGUgdGlja2V0IHVzaW5nIHRoZSB0aWNrZXRJZCBhc3NvY2lhdGVkXHJcbiAgICAgKiB3aXRoIGl0LlxyXG4gICAgICogIFxyXG4gICAgICogSWYgdGhlIHRpY2tldCBoYXMgc2hvd1Jlc3VsdCBzZXQgdG8gdHJ1ZSBhbmQgaGFzIGJlZW4gdXNlZCwgdGhpcyBtZXRob2RcclxuICAgICAqIHdpbGwgcmV0dXJuIHRoZSB2YWx1ZXMgZ2VuZXJhdGVkLlxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dldFRpY2tldFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpY2tldElkIEEgc3RyaW5nIGNvbnRhaW5pbmcgYSB0aWNrZXQgaWRlbnRpZmllciByZXR1cm5lZFxyXG4gICAgICogICAgIGJ5IGEgcHJpb3IgY2FsbCB0byB0aGUge0BsaW5rIGNyZWF0ZVRpY2tldHN9IG1ldGhvZC4gXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxUaWNrZXQ+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBmb2xsb3dpbmcgaW5mb3JtYXRpb246XHJcbiAgICAgKiAqICoqdGlja2V0SWQqKjogQSBzdHJpbmcgdmFsdWUgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSB0aWNrZXQuXHJcbiAgICAgKiAqICoqaGFzaGVkQXBpS2V5Kio6IFRoZSBoYXNoZWQgQVBJIGtleSBmb3Igd2hpY2ggdGhlIHRpY2tldCBpcyB2YWxpZC5cclxuICAgICAqICogKipzaG93UmVzdWx0Kio6IElmIGZhbHNlLCBnZXRUaWNrZXQoKSB3aWxsIHJldHVybiBvbmx5IHRoZSBiYXNpY1xyXG4gICAgICogICAgIHRpY2tldCBpbmZvcm1hdGlvbi4gSWYgdHJ1ZSwgdGhlIGZ1bGwgcmFuZG9tIGFuZCBzaWduYXR1cmUgb2JqZWN0c1xyXG4gICAgICogICAgIGZyb20gdGhlIHJlc3BvbnNlIHRoYXQgd2FzIHVzZWQgdG8gc2F0aXNmeSB0aGUgdGlja2V0IGlzIHJldHVybmVkLlxyXG4gICAgICogICAgIEZvciBtb3JlIGluZm9ybWF0aW9uLCBwbGVhc2Ugc2VlIHRoZSBkb2N1bWVudGF0aW9uIGZvciBnZXRUaWNrZXQuXHJcbiAgICAgKiAqICoqY3JlYXRpb25UaW1lKio6IFRoZSB0aW1lc3RhbXAgaW4gSVNPIDg2MDEgZm9ybWF0IGF0IHdoaWNoIHRoZSB0aWNrZXRcclxuICAgICAqICAgICB3YXMgY3JlYXRlZC5cclxuICAgICAqICogKip1c2VkVGltZSoqIFRoZSB0aW1lc3RhbXAgaW4gSVNPIDg2MDEgZm9ybWF0IGF0IHdoaWNoIHRoZSB0aWNrZXQgd2FzXHJcbiAgICAgKiAgICAgdXNlZC4gSWYgdGhlIHRpY2tldCBoYXMgbm90IGJlZW4gdXNlZCB5ZXQsIHRoaXMgdmFsdWUgaXMgbnVsbC5cclxuICAgICAqICogKipzZXJpYWxOdW1iZXIqKjogQSBudW1lcmljIHZhbHVlIGluZGljYXRpbmcgd2hpY2ggc2VyaWFsIG51bWJlciAod2l0aGluXHJcbiAgICAgKiAgICAgdGhlIEFQSSBrZXkgdXNlZCB0byBzZXJ2ZSB0aGUgdGlja2V0KSB3YXMgdXNlZCBmb3IgdGhlIHRpY2tldC4gSWYgdGhlXHJcbiAgICAgKiAgICAgY2FsbGVyIGhhcyB0aGUgdW5oYXNoZWQgQVBJIGtleSwgdGhleSBjYW4gdXNlIHRoZSBzZXJpYWxOdW1iZXIgcmV0dXJuZWRcclxuICAgICAqICAgICB0byBvYnRhaW4gdGhlIGZ1bGwgcmVzdWx0IHZpYSB0aGUgZ2V0UmVzdWx0IG1ldGhvZC4gSWYgdGhlIHRpY2tldCBoYXNcclxuICAgICAqICAgICBub3QgYmVlbiB1c2VkIHlldCwgdGhpcyB2YWx1ZSBpcyBudWxsLlxyXG4gICAgICogKiAqKmV4cGlyYXRpb25UaW1lKio6IFRoZSB0aW1lc3RhbXAgaW4gSVNPIDg2MDEgZm9ybWF0IGF0IHdoaWNoIHRoZSB0aWNrZXRcclxuICAgICAqICAgICBleHBpcmVzLiBJZiB0aGUgdGlja2V0IGhhcyBub3QgYmVlbiB1c2VkIHlldCwgdGhpcyB2YWx1ZSBpcyBudWxsLlxyXG4gICAgICogKiAqKnByZXZpb3VzVGlja2V0SWQqKjogVGhlIHByZXZpb3VzIHRpY2tldCBpbiB0aGUgY2hhaW4gdG8gd2hpY2ggdGhpcyB0aWNrZXRcclxuICAgICAqICAgICBiZWxvbmdzLiBJZiB0aGUgdGlja2V0IGlzIHRoZSBmaXJzdCBpbiBpdHMgY2hhaW4sIHRoZW4gcHJldmlvdXNUaWNrZXRJZCBpc1xyXG4gICAgICogICAgIG51bGwuXHJcbiAgICAgKiAqICoqbmV4dFRpY2tldElkKiogQSBzdHJpbmcgdmFsdWUgdGhhdCBpZGVudGlmaWVzIHRoZSBuZXh0XHJcbiAgICAgKiAgICAgdGlja2V0IGluIHRoZSBjaGFpbi5cclxuICAgICAqIFxyXG4gICAgICogICAgIElmIHNob3dSZXN1bHQgd2FzIHNldCB0byB0cnVlIHdoZW4gdGhlIHRpY2tldCB3YXMgY3JlYXRlZCxcclxuICAgICAqICAgICB0aGUgZm9sbG93aW5nIGZpZWxkIHdpbGwgYWxzbyBiZSBhZGRlZDpcclxuICAgICAqICogKipyZXN1bHQqKiBUaGUgc2FtZSBvYmplY3QgdGhhdCB3YXMgcmV0dXJuZWQgYnkgdGhlIG1ldGhvZCB0aGF0IHdhcyBvcmlnaW5hbGx5XHJcbiAgICAgKiAgICAgdXNlZCB0byBnZW5lcmF0ZSB0aGUgdmFsdWVzLiBUaGlzIGluY2x1ZGVzIHRoZSByYW5kb20gZmllbGQgd2hpY2ggY29udGFpbnMgdGhlXHJcbiAgICAgKiAgICAgZGF0YSBwcm9wZXJ0eSwgYW5kIGEgc2lnbmF0dXJlIGZpZWxkLCByZXF1aXJlZCB0byB2ZXJpZnkgdGhlIHJlc3VsdC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0VGlja2V0KHRpY2tldElkKSB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgdGlja2V0SWQ6IHRpY2tldElkXHJcbiAgICAgICAgfTtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2dlbmVyYXRlUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI0dFVF9USUNLRVRfTUVUSE9ELCBwYXJhbXMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0UmVzdWx0KHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSB0aGUgVVJMIGZvciB0aGUgc2lnbmF0dXJlIHZlcmlmaWNhdGlvbiBwYWdlIG9mIGEgcmVzcG9uc2UgcHJldmlvdXNseVxyXG4gICAgICogcmVjZWl2ZWQgZnJvbSBvbmUgb2YgdGhlIG1ldGhvZHMgaW4gdGhlIFNpZ25lZCBBUEkgd2l0aCB0aGUgc2VydmVyLiBUaGVcclxuICAgICAqIHdlYi1wYWdlIGFjY2Vzc2libGUgZnJvbSB0aGlzIFVSTCB3aWxsIGNvbnRhaW4gdGhlIGRldGFpbHMgb2YgdGhlIHJlc3BvbnNlXHJcbiAgICAgKiB1c2VkIGluIHRoaXMgbWV0aG9kLCBwcm92aWRlZCB0aGF0IHRoZSBzaWduYXR1cmUgY2FuIGJlIHZlcmlmaWVkLiBUaGlzXHJcbiAgICAgKiBVUkwgaXMgYWxzbyBzaG93biB1bmRlciBcIlNob3cgVGVjaG5pY2FsIERldGFpbHNcIiB3aGVuIHRoZSBvbmxpbmUgU2lnbmF0dXJlXHJcbiAgICAgKiBWZXJpZmljYXRpb24gRm9ybSBpcyB1c2VkIHRvIHZhbGlkYXRlIGEgc2lnbmF0dXJlLiBTZWU6XHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL3NpZ25hdHVyZXMvZm9ybVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJhbmRvbSBUaGUgcmFuZG9tIGZpZWxkIGZyb20gYSByZXNwb25zZSByZXR1cm5lZCBieVxyXG4gICAgICogICAgIFJBTkRPTS5PUkcgdGhyb3VnaCBvbmUgb2YgdGhlIFNpZ25lZCBBUEkgbWV0aG9kcy5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaWduYXR1cmUgVGhlIHNpZ25hdHVyZSBmaWVsZCBmcm9tIHRoZSBzYW1lIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgdGhhdCB0aGUgcmFuZG9tIGZpZWxkIG9yaWdpbmF0ZXMgZnJvbS5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IEEgc3RyaW5nIGNvbnRhaW5pbmcgdGhlIHNpZ25hdHVyZSB2ZXJpZmljYXRpb24gVVJMLlxyXG4gICAgICogQHRocm93cyBSYW5kb21PcmdSQU5ET01PUkdFcnJvciB3aGVuIHRoZSBVUkwgaXMgdG9vIGxvbmcgKG1heC4gMiwwNDZcclxuICAgICAqICAgICBjaGFyYWN0ZXJzKS5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlVXJsKHJhbmRvbSwgc2lnbmF0dXJlKSB7XHJcbiAgICAgICAgbGV0IGZvcm1hdHRlZFJhbmRvbSA9IHRoaXMuI2Zvcm1hdFVybChKU09OLnN0cmluZ2lmeShyYW5kb20pKTtcclxuICAgICAgICBsZXQgZm9ybWF0dGVkU2lnbmF0dXJlID0gdGhpcy4jZm9ybWF0VXJsKHNpZ25hdHVyZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IHVybCA9ICdodHRwczovL2FwaS5yYW5kb20ub3JnL3NpZ25hdHVyZXMvZm9ybT9mb3JtYXQ9anNvbic7ICAgIFxyXG4gICAgICAgIHVybCArPSAnJnJhbmRvbT0nICsgZm9ybWF0dGVkUmFuZG9tO1xyXG4gICAgICAgIHVybCArPSAnJnNpZ25hdHVyZT0nICsgZm9ybWF0dGVkU2lnbmF0dXJlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh1cmwubGVuZ3RoID4gUmFuZG9tT3JnQ2xpZW50Lk1BWF9VUkxfTEVOR1RIKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdSQU5ET01PUkdFcnJvcignRXJyb3I6IFVSTCBleGNlZWRzIG1heGltdW0gbGVuZ3RoJ1xyXG4gICAgICAgICAgICAgICAgKyAnKCcgKyBSYW5kb21PcmdDbGllbnQuTUFYX1VSTF9MRU5HVEggKyAnIGNoYXJhY3RlcnMpLicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdXJsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIHRoZSBIVE1MIGZvcm0gZm9yIHRoZSBzaWduYXR1cmUgdmVyaWZpY2F0aW9uIHBhZ2Ugb2YgYSByZXNwb25zZVxyXG4gICAgICogcHJldmlvdXNseSByZWNlaXZlZCBmcm9tIG9uZSBvZiB0aGUgbWV0aG9kcyBpbiB0aGUgU2lnbmVkIEFQSSB3aXRoIHRoZVxyXG4gICAgICogc2VydmVyLiBUaGUgd2ViLXBhZ2UgYWNjZXNzaWJsZSBmcm9tIHRoZSBcIlZhbGlkYXRlXCIgYnV0dG9uIGNyZWF0ZWQgd2lsbFxyXG4gICAgICogY29udGFpbiB0aGUgZGV0YWlscyBvZiB0aGUgcmVzcG9uc2UgdXNlZCBpbiB0aGlzIG1ldGhvZCwgcHJvdmlkZWQgdGhhdFxyXG4gICAgICogdGhlIHNpZ25hdHVyZSBjYW4gYmUgdmVyaWZpZWQuIFRoZSBzYW1lIEhUTUwgZm9ybSBpcyBhbHNvIHNob3duIHVuZGVyXHJcbiAgICAgKiBcIlNob3cgVGVjaG5pY2FsIERldGFpbHNcIiB3aGVuIHRoZSBvbmxpbmUgU2lnbmF0dXJlIFZlcmlmaWNhdGlvbiBGb3JtIGlzXHJcbiAgICAgKiB1c2VkIHRvIHZhbGlkYXRlIGEgc2lnbmF0dXJlLiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvc2lnbmF0dXJlcy9mb3JtXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmFuZG9tIFRoZSByYW5kb20gZmllbGQgZnJvbSBhIHJlc3BvbnNlIHJldHVybmVkIGJ5XHJcbiAgICAgKiAgICAgUkFORE9NLk9SRyB0aHJvdWdoIG9uZSBvZiB0aGUgU2lnbmVkIEFQSSBtZXRob2RzLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNpZ25hdHVyZSBUaGUgc2lnbmF0dXJlIGZpZWxkIGZyb20gdGhlIHNhbWUgcmVzcG9uc2VcclxuICAgICAqICAgICB0aGF0IHRoZSByYW5kb20gZmllbGQgb3JpZ2luYXRlcyBmcm9tLlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gQSBzdHJpbmcgY29udGFpbmluZyB0aGUgY29kZSBmb3IgdGhlIEhUTUwgZm9ybS5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlSHRtbChyYW5kb20sIHNpZ25hdHVyZSkge1xyXG4gICAgICAgIGxldCBzID0gJzxmb3JtIGFjdGlvbj1cXCdodHRwczovL2FwaS5yYW5kb20ub3JnL3NpZ25hdHVyZXMvZm9ybVxcJyBtZXRob2Q9XFwncG9zdFxcJz5cXG4nO1xyXG4gICAgICAgIHMgKz0gJyAgJyArIHRoaXMuI2lucHV0SFRNTCgnaGlkZGVuJywgJ2Zvcm1hdCcsICdqc29uJykgKyAnXFxuJztcclxuICAgICAgICBzICs9ICcgICcgKyB0aGlzLiNpbnB1dEhUTUwoJ2hpZGRlbicsICdyYW5kb20nLCBKU09OLnN0cmluZ2lmeShyYW5kb20pKSArICdcXG4nO1xyXG4gICAgICAgIHMgKz0gJyAgJyArIHRoaXMuI2lucHV0SFRNTCgnaGlkZGVuJywgJ3NpZ25hdHVyZScsIHNpZ25hdHVyZSkgKyAnXFxuJztcclxuICAgICAgICBzICs9ICcgIDxpbnB1dCB0eXBlPVxcJ3N1Ym1pdFxcJyB2YWx1ZT1cXCdWYWxpZGF0ZVxcJyAvPlxcbjwvZm9ybT4nO1xyXG4gICAgICAgIHJldHVybiBzO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENSRUFUSU5HIENBQ0hFU1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhIFJhbmRvbU9yZ0NhY2hlIHRvIG9idGFpbiByYW5kb20gaW50ZWdlcnMuXHJcbiAgICAgKiBcclxuICAgICAqIFRoZSBSYW5kb21PcmdDYWNoZSBjYW4gYmUgcG9sbGVkIGZvciBuZXcgcmVzdWx0cyBjb25mb3JtaW5nIHRvIHRoZSBvdXRwdXRcclxuICAgICAqIGZvcm1hdCBvZiB0aGUgaW5wdXQgcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBpbnRlZ2VycyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaCB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU5LDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IFRoZSB1cHBlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2ggdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlOSwxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBiYXNlPzogbnVtYmVyLCBjYWNoZVNpemU/OiBudW1iZXJ9fSBvcHRpb25zXHJcbiAgICAgKiAgICAgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBudW1iZXJzXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzIHdpbGwgYWxsIGJlIHVuaXF1ZVxyXG4gICAgICogICAgIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmJhc2U9MTBdIFRoZSBiYXNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGRpc3BsYXkgdGhlXHJcbiAgICAgKiAgICAgbnVtYmVycy4gVmFsdWVzIGFsbG93ZWQgYXJlIDIsIDgsIDEwIGFuZCAxNiAoZGVmYXVsdCAxMCkuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY2FjaGVTaXplPTIwXSBUaGUgbnVtYmVyIG9mIHJlc3VsdC1zZXRzIGZvciB0aGVcclxuICAgICAqICAgICBjYWNoZSB0byB0cnkgdG8gbWFpbnRhaW4gYXQgYW55IGdpdmVuIHRpbWUgKGRlZmF1bHQgMjAsIG1pbmltdW0gMikuXHJcbiAgICAgKiBAcmV0dXJucyB7UmFuZG9tT3JnQ2FjaGV9IEFuIGluc3RhbmNlIG9mIHRoZSBSYW5kb21PcmdDYWNoZSBjbGFzcyB3aGljaFxyXG4gICAgICogICAgIGNhbiBiZSBwb2xsZWQgZm9yIGFycmF5cyBvZiB0cnVlIHJhbmRvbSBpbnRlZ2Vycy5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlSW50ZWdlckNhY2hlKG4sIG1pbiwgbWF4LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgY2FjaGVTaXplID0gb3B0aW9ucy5jYWNoZVNpemUgfHwgMjA7XHJcbiAgICAgICAgaWYgKGNhY2hlU2l6ZSA8IDIpIHtcclxuICAgICAgICAgICAgY2FjaGVTaXplID0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jaW50ZWdlclJlcXVlc3QobiwgbWluLCBtYXgsIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICAvLyBtYXggc2luZ2xlIHJlcXVlc3Qgc2l6ZSwgaW4gYml0cywgZm9yIGFkanVzdGluZyBidWxrIHJlcXVlc3RzIGxhdGVyXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gTWF0aC5jZWlsKE1hdGgubG9nKG1heCAtIG1pbiArIDEpIC8gTWF0aC5sb2coMikgKiBuKTtcclxuICAgICAgICBsZXQgYnVsa04gPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIElmIHBvc3NpYmxlLCBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGVcclxuICAgICAgICAvLyBzZXJ2ZXIuIEluaXRpYWxseSBzZXQgYXQgY2FjaGVTaXplLzIsIGJ1dCBjYWNoZSB3aWxsIGF1dG8tc2hyaW5rIGJ1bGtcclxuICAgICAgICAvLyByZXF1ZXN0IHNpemUgaWYgcmVxdWVzdHMgY2FuJ3QgYmUgZnVsZmlsbGVkLlxyXG4gICAgICAgIGlmICghKCdyZXBsYWNlbWVudCcgaW4gb3B0aW9ucykgfHwgb3B0aW9ucy5yZXBsYWNlbWVudCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgICAgIHJlcXVlc3QucGFyYW1zLm4gPSBuICogYnVsa047XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSxcclxuICAgICAgICAgICAgYnVsa04sIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gcmFuZG9tIGludGVnZXIgc2VxdWVuY2VzLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgUmFuZG9tT3JnQ2FjaGUgY2FuIGJlIHBvbGxlZCBmb3IgbmV3IHJlc3VsdHMgY29uZm9ybWluZyB0byB0aGUgb3V0cHV0XHJcbiAgICAgKiBmb3JtYXQgb2YgdGhlIGlucHV0IHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gaW50ZWdlciBzZXF1ZW5jZXMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluXHJcbiAgICAgKiAgICAgdGhlIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIGFycmF5IG9mIHJhbmRvbVxyXG4gICAgICogICAgIGludGVnZXJzIHJlcXVlc3RlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBsZW5ndGggbXVzdCBiZSBhbiBpbnRlZ2VyXHJcbiAgICAgKiAgICAgaW4gdGhlIFsxLCAxZTRdIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbGVuZ3RoIGNhbiBiZSBhbiBhcnJheVxyXG4gICAgICogICAgIHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsZW5ndGggb2YgdGhlIHNlcXVlbmNlIGlkZW50aWZpZWRcclxuICAgICAqICAgICBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBsZW5ndGggbXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UgYW5kIHRoZSB0b3RhbCBzdW0gb2YgYWxsIHRoZSBsZW5ndGhzIG11c3QgYmUgaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaFxyXG4gICAgICogICAgIHRoZSByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBtaW4gbXVzdCBiZVxyXG4gICAgICogICAgIGFuIGludGVnZXIgaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbWluIGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIG1pbiBtdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IG1heCBUaGUgdXBwZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBGb3IgdW5pZm9ybSBzZXF1ZW5jZXMsIG1heCBtdXN0IGJlXHJcbiAgICAgKiAgICAgYW4gaW50ZWdlciBpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBtYXggY2FuXHJcbiAgICAgKiAgICAgYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXJzLCBlYWNoIHNwZWNpZnlpbmcgdGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZVxyXG4gICAgICogICAgIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbWF4IG11c3RcclxuICAgICAqICAgICBiZSB3aXRoaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFufGJvb2xlYW5bXSwgYmFzZT86IG51bWJlcnxudW1iZXJbXSxcclxuICAgICAqICAgICBjYWNoZVNpemU/OiBudW1iZXJ9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbiBhbnkgb2YgdGhlXHJcbiAgICAgKiAgICAgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW58Ym9vbGVhbltdfSByZXBsYWNlbWVudCBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tIG51bWJlcnNcclxuICAgICAqICAgICBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbnVtYmVycyBtYXlcclxuICAgICAqICAgICBjb250YWluIGR1cGxpY2F0ZSB2YWx1ZXMsIG90aGVyd2lzZSB0aGUgbnVtYmVycyB3aWxsIGFsbCBiZSB1bmlxdWUuIEZvclxyXG4gICAgICogICAgIG11bHRpZm9ybSBzZXF1ZW5jZXMsIHJlcGxhY2VtZW50IGNhbiBiZSBhbiBhcnJheSB3aXRoIG4gYm9vbGVhbiB2YWx1ZXMsXHJcbiAgICAgKiAgICAgZWFjaCBzcGVjaWZ5aW5nIHdoZXRoZXIgdGhlIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4IHdpbGwgYmVcclxuICAgICAqICAgICBjcmVhdGVkIHdpdGggKHRydWUpIG9yIHdpdGhvdXQgKGZhbHNlKSByZXBsYWNlbWVudCAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBiYXNlIFRoZSBiYXNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGRpc3BsYXkgdGhlIG51bWJlcnMuXHJcbiAgICAgKiAgICAgVmFsdWVzIGFsbG93ZWQgYXJlIDIsIDgsIDEwIGFuZCAxNi4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIGJhc2UgY2FuXHJcbiAgICAgKiAgICAgYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXIgdmFsdWVzIHRha2VuIGZyb20gdGhlIHNhbWUgc2V0LCBlYWNoXHJcbiAgICAgKiAgICAgc3BlY2lmeWluZyB0aGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5IHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkXHJcbiAgICAgKiAgICAgYnkgaXRzIGluZGV4IChkZWZhdWx0IDEwKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjYWNoZVNpemUgVGhlIG51bWJlciBvZiByZXN1bHQtc2V0cyBmb3IgdGhlIGNhY2hlIHRvIHRyeVxyXG4gICAgICogICAgIHRvIG1haW50YWluIGF0IGFueSBnaXZlbiB0aW1lIChkZWZhdWx0IDIwLCBtaW5pbXVtIDIpLlxyXG4gICAgICogQHJldHVybnMge1JhbmRvbU9yZ0NhY2hlfSBBbiBpbnN0YW5jZSBvZiB0aGUgUmFuZG9tT3JnQ2FjaGUgY2xhc3Mgd2hpY2hcclxuICAgICAqICAgICBjYW4gYmUgcG9sbGVkIGZvciBhcnJheXMgb2YgdHJ1ZSByYW5kb20gaW50ZWdlciBzZXF1ZW5jZXMuXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZUludGVnZXJTZXF1ZW5jZUNhY2hlKG4sIGxlbmd0aCwgbWluLCBtYXgsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAyMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsZXQgbWF4UmVxdWVzdFNpemUgPSBNYXRoLmNlaWwoTWF0aC5sb2codGhpcy4jbWF4VmFsdWUobWF4KSAtIHRoaXMuI21pblZhbHVlKG1pbiksICsgMSlcclxuICAgICAgICAgICAgLyBNYXRoLmxvZygyKSAqIG4gKiB0aGlzLiNtYXhWYWx1ZShsZW5ndGgpKTtcclxuXHJcbiAgICAgICAgLy8gSWYgcG9zc2libGUsIG1ha2UgcmVxdWVzdHMgbW9yZSBlZmZpY2llbnQgYnkgYnVsay1vcmRlcmluZyBmcm9tIHRoZVxyXG4gICAgICAgIC8vIHNlcnZlci4gSW5pdGlhbGx5IHNldCBhdCBjYWNoZVNpemUvMiwgYnV0IGNhY2hlIHdpbGwgYXV0by1zaHJpbmsgYnVsa1xyXG4gICAgICAgIC8vIHJlcXVlc3Qgc2l6ZSBpZiByZXF1ZXN0cyBjYW4ndCBiZSBmdWxmaWxsZWQuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gMDtcclxuXHJcbiAgICAgICAgLy8gaWYgcmVwbGFjZW1lbnQgaXMgYW4gYXJyYXksIGNoZWNrIGlmIGFsbCB2YWx1ZXMgYXJlIHNldCB0byB0cnVlXHJcbiAgICAgICAgbGV0IHJlcGw7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMucmVwbGFjZW1lbnQgJiYgQXJyYXkuaXNBcnJheShvcHRpb25zLnJlcGxhY2VtZW50KSkge1xyXG4gICAgICAgICAgICByZXBsID0gb3B0aW9ucy5yZXBsYWNlbWVudC5ldmVyeSh4ID0+IHggPT09IHRydWUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlcGwgPSBvcHRpb25zLnJlcGxhY2VtZW50IHx8IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpZiBidWxrIHJlcXVlc3RzIGNhbiBiZSB1c2VkLCBtYWtlIGFkanVzdG1lbnRzIHRvIGFycmF5LXR5cGUgcGFyYW1ldGVyc1xyXG4gICAgICAgIGlmIChyZXBsKSB7XHJcbiAgICAgICAgICAgIGJ1bGtOID0gY2FjaGVTaXplIC8gMjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGxlbmd0aCkpIHtcclxuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHRoaXMuI2FkanVzdChsZW5ndGgsIGJ1bGtOKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWluKSkge1xyXG4gICAgICAgICAgICAgICAgbWluID0gdGhpcy4jYWRqdXN0KG1pbiwgYnVsa04pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXgpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXggPSB0aGlzLiNhZGp1c3QobWF4LCBidWxrTik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlcGxhY2VtZW50ICYmIEFycmF5LmlzQXJyYXkob3B0aW9ucy5yZXBsYWNlbWVudCkpIHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMucmVwbGFjZW1lbnQgPSB0aGlzLiNhZGp1c3Qob3B0aW9ucy5yZXBsYWNlbWVudCwgYnVsa04pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5iYXNlICYmIEFycmF5LmlzQXJyYXkob3B0aW9ucy5iYXNlKSkge1xyXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5iYXNlID0gdGhpcy4jYWRqdXN0KG9wdGlvbnMuYmFzZSwgYnVsa04pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2ludGVnZXJTZXF1ZW5jZVJlcXVlc3QobiwgbGVuZ3RoLCBtaW4sIG1heCxcclxuICAgICAgICAgICAgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIGlmIChyZXBsKSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3QucGFyYW1zLm4gPSBidWxrTiAqIG47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSwgYnVsa04sIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgUmFuZG9tT3JnQ2FjaGUgY2FuIGJlIHBvbGxlZCBmb3IgbmV3IHJlc3VsdHMgY29uZm9ybWluZyB0byB0aGUgb3V0cHV0XHJcbiAgICAgKiBmb3JtYXQgb2YgdGhlIGlucHV0IHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMgeW91IG5lZWQuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVjaW1hbFBsYWNlcyBUaGUgbnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzIHRvIHVzZS4gTXVzdFxyXG4gICAgICogICAgIGJlIHdpdGhpbiB0aGUgWzEsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBjYWNoZVNpemU/OiBudW1iZXJ9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaFxyXG4gICAgICogICAgIG1heSBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBudW1iZXJzXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzIHdpbGwgYWxsIGJlIHVuaXF1ZVxyXG4gICAgICogICAgIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNhY2hlU2l6ZT0yMF0gVGhlIG51bWJlciBvZiByZXN1bHQtc2V0cyBmb3IgdGhlIGNhY2hlXHJcbiAgICAgKiAgICAgdG8gdHJ5IHRvIG1haW50YWluIGF0IGFueSBnaXZlbiB0aW1lIChkZWZhdWx0IDIwLCBtaW5pbXVtIDIpLlxyXG4gICAgICogQHJldHVybnMge1JhbmRvbU9yZ0NhY2hlfSBBbiBpbnN0YW5jZSBvZiB0aGUgUmFuZG9tT3JnQ2FjaGUgY2xhc3Mgd2hpY2hcclxuICAgICAqICAgICBjYW4gYmUgcG9sbGVkIGZvciBhcnJheXMgb2YgdHJ1ZSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMuXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZURlY2ltYWxGcmFjdGlvbkNhY2hlKG4sIGRlY2ltYWxQbGFjZXMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAyMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNkZWNpbWFsRnJhY3Rpb25SZXF1ZXN0KG4sIGRlY2ltYWxQbGFjZXMsIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICBsZXQgYnVsa04gPSAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIElmIHBvc3NpYmxlLCBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGVcclxuICAgICAgICAvLyBzZXJ2ZXIuIEluaXRpYWxseSBzZXQgYXQgY2FjaGVTaXplLzIsIGJ1dCBjYWNoZSB3aWxsIGF1dG8tc2hyaW5rIGJ1bGtcclxuICAgICAgICAvLyByZXF1ZXN0IHNpemUgaWYgcmVxdWVzdHMgY2FuJ3QgYmUgZnVsZmlsbGVkLlxyXG4gICAgICAgIGlmICghKCdyZXBsYWNlbWVudCcgaW4gb3B0aW9ucykgfHwgb3B0aW9ucy5yZXBsYWNlbWVudCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgICAgIHJlcXVlc3QucGFyYW1zLm4gPSBuICogYnVsa047XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBtYXggc2luZ2xlIHJlcXVlc3Qgc2l6ZSwgaW4gYml0cywgZm9yIGFkanVzdGluZyBidWxrIHJlcXVlc3RzIGxhdGVyXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gTWF0aC5jZWlsKE1hdGgubG9nKDEwKSAvIE1hdGgubG9nKDIpICogZGVjaW1hbFBsYWNlcyAqIG4pO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSwgYnVsa04sXHJcbiAgICAgICAgICAgIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gcmFuZG9tIG51bWJlcnMgZnJvbSBhIEdhdXNzaWFuIGRpc3RyaWJ1dGlvbi5cclxuICAgICAqIFxyXG4gICAgICogVGhlIFJhbmRvbU9yZ0NhY2hlIGNhbiBiZSBwb2xsZWQgZm9yIG5ldyByZXN1bHRzIGNvbmZvcm1pbmcgdG8gdGhlIG91dHB1dFxyXG4gICAgICogZm9ybWF0IG9mIHRoZSBpbnB1dCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIG51bWJlcnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWVhbiBUaGUgZGlzdHJpYnV0aW9uJ3MgbWVhbi4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWy0xZTYsMWU2XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFuZGFyZERldmlhdGlvbiBUaGUgZGlzdHJpYnV0aW9uJ3Mgc3RhbmRhcmQgZGV2aWF0aW9uLlxyXG4gICAgICogICAgIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlNiwxZTZdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpZ25pZmljYW50RGlnaXRzIFRoZSBudW1iZXIgb2Ygc2lnbmlmaWNhbnQgZGlnaXRzIHRvIHVzZS5cclxuICAgICAqICAgICBNdXN0IGJlIHdpdGhpbiB0aGUgWzIsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7Y2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW4gdGhlIGZvbGxvd2luZ1xyXG4gICAgICogICAgIG9wdGlvbmFsIHBhcmFtZXRlcjpcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jYWNoZVNpemU9MjBdIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZSBjYWNoZVxyXG4gICAgICogICAgIHRvIHRyeSB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAyMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIG51bWJlcnMgZnJvbSBhIEdhdXNzaWFuXHJcbiAgICAgKiAgICAgZGlzdHJpYnV0aW9uLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVHYXVzc2lhbkNhY2hlKG4sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLCBzaWduaWZpY2FudERpZ2l0cywgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IGNhY2hlU2l6ZSA9IG9wdGlvbnMuY2FjaGVTaXplIHx8IDIwO1xyXG4gICAgICAgIGlmIChjYWNoZVNpemUgPCAyKSB7XHJcbiAgICAgICAgICAgIGNhY2hlU2l6ZSA9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBtYXggc2luZ2xlIHJlcXVlc3Qgc2l6ZSwgaW4gYml0cywgZm9yIGFkanVzdGluZyBidWxrIHJlcXVlc3RzIGxhdGVyXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gTWF0aC5jZWlsKE1hdGgubG9nKE1hdGgucG93KDEwLCBzaWduaWZpY2FudERpZ2l0cykpIC8gTWF0aC5sb2coMikgKiBuKTtcclxuXHJcbiAgICAgICAgLy8gbWFrZSByZXF1ZXN0cyBtb3JlIGVmZmljaWVudCBieSBidWxrLW9yZGVyaW5nIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAgICAvLyBJbml0aWFsbHkgc2V0IGF0IGNhY2hlU2l6ZS8yLCBidXQgY2FjaGUgd2lsbCBhdXRvLXNocmluayBidWxrIHJlcXVlc3RcclxuICAgICAgICAvLyBzaXplIGlmIHJlcXVlc3RzIGNhbid0IGJlIGZ1bGZpbGxlZC5cclxuICAgICAgICBsZXQgYnVsa04gPSBjYWNoZVNpemUgLyAyO1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2F1c3NpYW5SZXF1ZXN0KG4gKiBidWxrTiwgbWVhbiwgc3RhbmRhcmREZXZpYXRpb24sXHJcbiAgICAgICAgICAgIHNpZ25pZmljYW50RGlnaXRzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBSYW5kb21PcmdDYWNoZSh0aGlzLiNzZW5kUmVxdWVzdC5iaW5kKHRoaXMpLCByZXF1ZXN0LCBjYWNoZVNpemUsIGJ1bGtOLFxyXG4gICAgICAgICAgICBuLCBtYXhSZXF1ZXN0U2l6ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGEgUmFuZG9tT3JnQ2FjaGUgdG8gb2J0YWluIHJhbmRvbSBzdHJpbmdzLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgUmFuZG9tT3JnQ2FjaGUgY2FuIGJlIHBvbGxlZCBmb3IgbmV3IHJlc3VsdHMgY29uZm9ybWluZyB0byB0aGUgb3V0cHV0XHJcbiAgICAgKiBmb3JtYXQgb2YgdGhlIGlucHV0IHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gc3RyaW5ncyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIHN0cmluZy4gTXVzdCBiZSB3aXRoaW4gdGhlIFsxLDIwXVxyXG4gICAgICogICAgIHJhbmdlLiBBbGwgc3RyaW5ncyB3aWxsIGJlIG9mIHRoZSBzYW1lIGxlbmd0aC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJzIEEgc3RyaW5nIHRoYXQgY29udGFpbnMgdGhlIHNldCBvZiBjaGFyYWN0ZXJzXHJcbiAgICAgKiAgICAgdGhhdCBhcmUgYWxsb3dlZCB0byBvY2N1ciBpbiB0aGUgcmFuZG9tIHN0cmluZ3MuIFRoZSBtYXhpbXVtIG51bWJlclxyXG4gICAgICogICAgIG9mIGNoYXJhY3RlcnMgaXMgODAuXHJcbiAgICAgKiBAcGFyYW0ge3tyZXBsYWNlbWVudD86IGJvb2xlYW4sIGNhY2hlU2l6ZT86IG51bWJlcn19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIHN0cmluZ3Mgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIGxpc3RcclxuICAgICAqICAgICBvZiBzdHJpbmdzIG1heSBjb250YWluIGR1cGxpY2F0ZXMsIG90aGVyd2lzZSB0aGUgc3RyaW5ncyB3aWxsIGFsbCBiZVxyXG4gICAgICogICAgIHVuaXF1ZSAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jYWNoZVNpemU9MjBdIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZVxyXG4gICAgICogICAgIGNhY2hlIHRvIHRyeSB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAyMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIHN0cmluZ3MuXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZVN0cmluZ0NhY2hlKG4sIGxlbmd0aCwgY2hhcmFjdGVycywgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IGNhY2hlU2l6ZSA9IG9wdGlvbnMuY2FjaGVTaXplIHx8IDIwO1xyXG4gICAgICAgIGlmIChjYWNoZVNpemUgPCAyKSB7XHJcbiAgICAgICAgICAgIGNhY2hlU2l6ZSA9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI3N0cmluZ1JlcXVlc3QobiwgbGVuZ3RoLCBjaGFyYWN0ZXJzLCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IE1hdGguY2VpbChNYXRoLmxvZyhjaGFyYWN0ZXJzLmxlbmd0aCkgLyBNYXRoLmxvZygyKSAqIGxlbmd0aCAqIG4pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIElmIHBvc3NpYmxlLCBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGVcclxuICAgICAgICAvLyBzZXJ2ZXIuIEluaXRpYWxseSBzZXQgYXQgY2FjaGVfc2l6ZS8yLCBidXQgY2FjaGUgd2lsbCBhdXRvLXNocmluayBidWxrXHJcbiAgICAgICAgLy8gcmVxdWVzdCBzaXplIGlmIHJlcXVlc3RzIGNhbid0IGJlIGZ1bGZpbGxlZC5cclxuICAgICAgICBsZXQgYnVsa04gPSAwO1xyXG4gICAgICAgIGlmICghKCdyZXBsYWNlbWVudCcgaW4gb3B0aW9ucykgfHwgb3B0aW9ucy5yZXBsYWNlbWVudCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgICAgIHJlcXVlc3QucGFyYW1zLm4gPSBuICogYnVsa047XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgUmFuZG9tT3JnQ2FjaGUodGhpcy4jc2VuZFJlcXVlc3QuYmluZCh0aGlzKSwgcmVxdWVzdCwgY2FjaGVTaXplLCBidWxrTixcclxuICAgICAgICAgICAgbiwgbWF4UmVxdWVzdFNpemUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhIFJhbmRvbU9yZ0NhY2hlIHRvIG9idGFpbiBVVUlEcy5cclxuICAgICAqIFxyXG4gICAgICogVGhlIFJhbmRvbU9yZ0NhY2hlIGNhbiBiZSBwb2xsZWQgZm9yIG5ldyByZXN1bHRzIGNvbmZvcm1pbmcgdG8gdGhlIG91dHB1dFxyXG4gICAgICogZm9ybWF0IG9mIHRoZSBpbnB1dCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIFVVSURzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxZTNdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7Y2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW4gdGhlIGZvbGxvd2luZ1xyXG4gICAgICogICAgIG9wdGlvbmFsIHBhcmFtZXRlcjpcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jYWNoZVNpemU9MTBdIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZSBjYWNoZVxyXG4gICAgICogICAgIHRvIHRyeSB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAxMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIFVVSURzLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVVVUlEQ2FjaGUobiwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IGNhY2hlU2l6ZSA9IG9wdGlvbnMuY2FjaGVTaXplIHx8IDEwO1xyXG4gICAgICAgIGlmIChjYWNoZVNpemUgPCAyKSB7XHJcbiAgICAgICAgICAgIGNhY2hlU2l6ZSA9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBtYXggc2luZ2xlIHJlcXVlc3Qgc2l6ZSwgaW4gYml0cywgZm9yIGFkanVzdGluZyBidWxrIHJlcXVlc3RzIGxhdGVyXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gbiAqIFJhbmRvbU9yZ0NsaWVudC5VVUlEX1NJWkU7XHJcblxyXG4gICAgICAgIC8vIG1ha2UgcmVxdWVzdHMgbW9yZSBlZmZpY2llbnQgYnkgYnVsay1vcmRlcmluZyBmcm9tIHRoZSBzZXJ2ZXIuIEluaXRpYWxseVxyXG4gICAgICAgIC8vIHNldCBhdCBjYWNoZVNpemUvMiwgYnV0IGNhY2hlIHdpbGwgYXV0by1zaHJpbmsgYnVsayByZXF1ZXN0IHNpemUgaWZcclxuICAgICAgICAvLyByZXF1ZXN0cyBjYW4ndCBiZSBmdWxmaWxsZWQuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gY2FjaGVTaXplIC8gMjtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI1VVSURSZXF1ZXN0KG4gKiBidWxrTik7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUmFuZG9tT3JnQ2FjaGUodGhpcy4jc2VuZFJlcXVlc3QuYmluZCh0aGlzKSwgcmVxdWVzdCwgY2FjaGVTaXplLCBidWxrTixcclxuICAgICAgICAgICAgbiwgbWF4UmVxdWVzdFNpemUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhIFJhbmRvbU9yZ0NhY2hlIHRvIG9idGFpbiByYW5kb20gYmxvYnMuXHJcbiAgICAgKiBcclxuICAgICAqIFRoZSBSYW5kb21PcmdDYWNoZSBjYW4gYmUgcG9sbGVkIGZvciBuZXcgcmVzdWx0cyBjb25mb3JtaW5nIHRvIHRoZSBvdXRwdXRcclxuICAgICAqIGZvcm1hdCBvZiB0aGUgaW5wdXQgcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBibG9icyB5b3UgbmVlZC4gbiooY2FjaGVTaXplLzIpIG11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDEwMF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSBUaGUgc2l6ZSBvZiBlYWNoIGJsb2IsIG1lYXN1cmVkIGluIGJpdHMuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDEwNDg1NzZdIHJhbmdlIGFuZCBtdXN0IGJlIGRpdmlzaWJsZSBieSA4LlxyXG4gICAgICogQHBhcmFtIHt7Zm9ybWF0Pzogc3RyaW5nLCBjYWNoZVNpemU/OiBudW1iZXJ9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXlcclxuICAgICAqICAgICBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZm9ybWF0PWJhc2U2NF0gU3BlY2lmaWVzIHRoZSBmb3JtYXQgaW4gd2hpY2ggdGhlXHJcbiAgICAgKiAgICAgYmxvYnMgd2lsbCBiZSByZXR1cm5lZC4gVmFsdWVzIGFsbG93ZWQgYXJlICdiYXNlNjQnIGFuZCAnaGV4JyAoZGVmYXVsdFxyXG4gICAgICogICAgICdiYXNlNjQnKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jYWNoZVNpemU9MTBdIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZSBjYWNoZVxyXG4gICAgICogICAgIHRvIHRyeSB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAxMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIGJsb2JzIGFzIHN0cmluZ3MuXHJcbiAgICAgKiBAc2VlIHtAbGluayBSYW5kb21PcmdDbGllbnQjQkxPQl9GT1JNQVRfQkFTRTY0fSBmb3IgJ2Jhc2U2NCcgKGRlZmF1bHQpLlxyXG4gICAgICogQHNlZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I0JMT0JfRk9STUFUX0hFWH0gZm9yICdoZXgnLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVCbG9iQ2FjaGUobiwgc2l6ZSwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IGNhY2hlU2l6ZSA9IG9wdGlvbnMuY2FjaGVTaXplIHx8IDEwO1xyXG4gICAgICAgIGlmIChjYWNoZVNpemUgPCAyKSB7XHJcbiAgICAgICAgICAgIGNhY2hlU2l6ZSA9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBtYXggc2luZ2xlIHJlcXVlc3Qgc2l6ZSwgaW4gYml0cywgZm9yIGFkanVzdGluZyBidWxrIHJlcXVlc3RzIGxhdGVyXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gbiAqIHNpemU7XHJcblxyXG4gICAgICAgIC8vIG1ha2UgcmVxdWVzdHMgbW9yZSBlZmZpY2llbnQgYnkgYnVsay1vcmRlcmluZyBmcm9tIHRoZSBzZXJ2ZXIuIEluaXRpYWxseVxyXG4gICAgICAgIC8vIHNldCBhdCBjYWNoZVNpemUvMiwgYnV0IGNhY2hlIHdpbGwgYXV0by1zaHJpbmsgYnVsayByZXF1ZXN0IHNpemUgaWZcclxuICAgICAgICAvLyByZXF1ZXN0cyBjYW4ndCBiZSBmdWxmaWxsZWQuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gY2FjaGVTaXplIC8gMjtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2Jsb2JSZXF1ZXN0KG4gKiBidWxrTiwgc2l6ZSwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUmFuZG9tT3JnQ2FjaGUodGhpcy4jc2VuZFJlcXVlc3QuYmluZCh0aGlzKSwgcmVxdWVzdCwgY2FjaGVTaXplLCBidWxrTixcclxuICAgICAgICAgICAgbiwgbWF4UmVxdWVzdFNpemUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29yZSBzZW5kIHJlcXVlc3QgZnVuY3Rpb24uXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdCBSZXF1ZXN0IG9iamVjdCB0byBzZW5kLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyB0aGUgcmVzcG9uc2UgcHJvdmlkZWQgYnkgdGhlIHNlcnZlci4gRWxzZSwgaXQgbWF5IGJlIHJlamVjdGVkXHJcbiAgICAgKiAgICAgd2l0aCBvbmUgb2YgdGhlIGZvbGxvd2luZyBlcnJvcnM6XHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgICNzZW5kUmVxdWVzdCA9IGFzeW5jIGZ1bmN0aW9uIChyZXF1ZXN0KSB7XHJcbiAgICAgICAgLy8gSWYgYSBiYWNrLW9mZiBpcyBzZXQsIG5vIG1vcmUgcmVxdWVzdHMgY2FuIGJlIGlzc3VlZCB1bnRpbCB0aGUgcmVxdWlyZWQgXHJcbiAgICAgICAgLy8gYmFjay1vZmYgdGltZSBpcyB1cC5cclxuICAgICAgICBpZiAodGhpcy4jYmFja29mZiAhPSAtMSkgeyAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBUaW1lIG5vdCB5ZXQgdXAsIHRocm93IGVycm9yLlxyXG4gICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSA8IHRoaXMuI2JhY2tvZmYpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yKHRoaXMuI2JhY2tvZmZFcnJvcik7XHJcbiAgICAgICAgICAgIC8vIFRpbWUgaXMgdXAsIGNsZWFyIGJhY2stb2ZmLlxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy4jYmFja29mZiA9IC0xO1xyXG4gICAgICAgICAgICAgICAgdGhpcy4jYmFja29mZkVycm9yID0gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHdhaXQgPSB0aGlzLiNhZHZpc29yeURlbGF5IC0gKERhdGUubm93KCkgLSB0aGlzLiNsYXN0UmVzcG9uc2VSZWNlaXZlZFRpbWUpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy4jYmxvY2tpbmdUaW1lb3V0ICE9IC0xICYmIHdhaXQgPiB0aGlzLiNibG9ja2luZ1RpbWVvdXQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3IoJ1RoZSBzZXJ2ZXIgYWR2aXNvcnkgZGVsYXkgb2YgJyBcclxuICAgICAgICAgICAgICAgICsgd2FpdCArICdtaWxsaXMgaXMgZ3JlYXRlciB0aGFuIHRoZSBkZWZpbmVkIG1heGltdW0gYWxsb3dlZCAnXHJcbiAgICAgICAgICAgICAgICArICdibG9ja2luZyB0aW1lIG9mICcgKyB0aGlzLiNibG9ja2luZ1RpbWVvdXQgKyAnbWlsbGlzLicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHdhaXQgPiAwKSB7IGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCB3YWl0KSk7IH1cclxuXHJcbiAgICAgICAgbGV0IGh0dHBUaW1lb3V0ID0gdGhpcy4jaHR0cFRpbWVvdXQ7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XHJcbiAgICAgICAgICAgIGxldCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgICAgICAgICAgeGhyLm9wZW4oJ1BPU1QnLCAnaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2ludm9rZScpO1xyXG4gICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3IoJ1RoZSBtYXhpbXVtICdcclxuICAgICAgICAgICAgICAgICAgICArICdhbGxvd2VkIGJsb2NraW5nIHRpbWUgb2YgJyArIGh0dHBUaW1lb3V0ICsgJ21pbGxpcyBoYXMgJ1xyXG4gICAgICAgICAgICAgICAgICAgICsgJ2JlZW4gZXhjZWVkZWQgd2hpbGUgd2FpdGluZyBmb3IgdGhlIHNlcnZlciB0byByZXNwb25kLicpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh4aHIucmVzcG9uc2VUZXh0KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yKCdFcnJvcjogJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArIHhoci5zdGF0dXMpO1xyXG4gICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gdW5kb2N1bWVudGVkIGVycm9yLlxyXG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbygnKiogQW4gZXJyb3Igb2NjdXJyZWQgZHVyaW5nIHRoZSB0cmFuc2FjdGlvbi4nKTtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoeGhyLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHhoci50aW1lb3V0ID0gaHR0cFRpbWVvdXQ7XHJcbiAgICAgICAgICAgIHhoci5zZW5kKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpKTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcclxuICAgICAgICAgICAgLy8gcGFyc2UgcmVzcG9uc2UgdG8gZ2V0IGFuIG9iamVjdFxyXG4gICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UocmVzcG9uc2UpO1xyXG5cclxuICAgICAgICAgICAgLy8gY2hlY2sgZm9yIGVycm9yc1xyXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UuZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGxldCBjb2RlID0gcmVzcG9uc2UuZXJyb3IuY29kZTtcclxuICAgICAgICAgICAgICAgIGxldCBtZXNzYWdlID0gcmVzcG9uc2UuZXJyb3IubWVzc2FnZTtcclxuICAgICAgICAgICAgICAgIGxldCBkYXRhID0gcmVzcG9uc2UuZXJyb3IuZGF0YTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoY29kZSA9PSA0MDEpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yKCdFcnJvciAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsgY29kZSArICc6ICcgKyBtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY29kZSA9PSA0MDIpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgbWlkbmlnaHRVVEMgPSBuZXcgRGF0ZSgpLnNldFVUQ0hvdXJzKDAsMCwwLDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuI2JhY2tvZmYgPSArbWlkbmlnaHRVVEM7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy4jYmFja29mZkVycm9yID0gJ0Vycm9yICcgKyBjb2RlICsgJzogJyArIG1lc3NhZ2U7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuI3JlcXVlc3RzTGVmdCA9IGRhdGFbMV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yKHRoaXMuI2JhY2tvZmZFcnJvcik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUgPT0gNDAzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy4jYml0c0xlZnQgPSBkYXRhWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IoJ0Vycm9yJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArIGNvZGUgKyAnOiAnICsgbWVzc2FnZSwgdGhpcy4jYml0c0xlZnQpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChSYW5kb21PcmdDbGllbnQuI0VSUk9SX0NPREVTLmluY2x1ZGVzKGNvZGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IgZnJvbSBSQU5ET00uT1JHIEVycm9yczogXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Vycm9yLWNvZGVzXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yKCdFcnJvciAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsgY29kZSArICc6ICcgKyBtZXNzYWdlLCBjb2RlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gUmFuZG9tT3JnSlNPTlJQQ0Vycm9yIGZyb20gSlNPTi1SUEMgRXJyb3JzOiBcclxuICAgICAgICAgICAgICAgICAgICAvLyBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvZXJyb3ItY29kZXNcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnSlNPTlJQQ0Vycm9yKCdFcnJvciAnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsgY29kZSArICc6ICcgKyBtZXNzYWdlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gTWV0aG9kcyB3aGljaCBkbyBub3QgdXBkYXRlIGZpZWxkcyBzdWNoIGFzIHJlcXVlc3RzTGVmdCwgYml0c0xlZnQgb3JcclxuICAgICAgICAgICAgLy8gYWR2aXNvcnlEZWxheS5cclxuICAgICAgICAgICAgbGV0IGluZGVwZW5kZW50X21ldGhvZHMgPSBbXHJcbiAgICAgICAgICAgICAgICBSYW5kb21PcmdDbGllbnQuI1ZFUklGWV9TSUdOQVRVUkVfTUVUSE9ELFxyXG4gICAgICAgICAgICAgICAgUmFuZG9tT3JnQ2xpZW50LiNHRVRfUkVTVUxUX01FVEhPRCxcclxuICAgICAgICAgICAgICAgIFJhbmRvbU9yZ0NsaWVudC4jQ1JFQVRFX1RJQ0tFVF9NRVRIT0QsXHJcbiAgICAgICAgICAgICAgICBSYW5kb21PcmdDbGllbnQuI0xJU1RfVElDS0VUX01FVEhPRCxcclxuICAgICAgICAgICAgICAgIFJhbmRvbU9yZ0NsaWVudC4jR0VUX1RJQ0tFVF9NRVRIT0RcclxuICAgICAgICAgICAgXTtcclxuXHJcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBpbmZvcm1hdGlvblxyXG4gICAgICAgICAgICBpZiAoIWluZGVwZW5kZW50X21ldGhvZHMuaW5jbHVkZXMocmVxdWVzdC5tZXRob2QpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLiNyZXF1ZXN0c0xlZnQgPSByZXNwb25zZS5yZXN1bHQucmVxdWVzdHNMZWZ0O1xyXG4gICAgICAgICAgICAgICAgdGhpcy4jYml0c0xlZnQgPSByZXNwb25zZS5yZXN1bHQuYml0c0xlZnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UucmVzdWx0LmFkdmlzb3J5RGVsYXkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLiNhZHZpc29yeURlbGF5ID0gcmVzcG9uc2UucmVzdWx0LmFkdmlzb3J5RGVsYXk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZSBkZWZhdWx0IGlmIG5vbmUgZnJvbSBzZXJ2ZXIuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy4jYWR2aXNvcnlEZWxheSA9IFJhbmRvbU9yZ0NsaWVudC4jREVGQVVMVF9ERUxBWTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFVzZSBkZWZhdWx0IGFkdmlzb3J5RGVsYXkuXHJcbiAgICAgICAgICAgICAgICB0aGlzLiNhZHZpc29yeURlbGF5ID0gUmFuZG9tT3JnQ2xpZW50LiNERUZBVUxUX0RFTEFZO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuI2xhc3RSZXNwb25zZVJlY2VpdmVkVGltZSA9IERhdGUubm93KCk7XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXNzdWVzIGEgZ2V0VXNhZ2UgcmVxdWVzdCBhbmQgcmV0dXJucyB0aGUgaW5mb3JtYXRpb24gb24gdGhlIHVzYWdlXHJcbiAgICAgKiBvZiB0aGUgQVBJIGtleSBhc3NvY2lhdGVkIHdpdGggdGhpcyBjbGllbnQsIGFzIGl0IGlzIHJldHVybmVkIGJ5IHRoZVxyXG4gICAgICogc2VydmVyLiBDYW4gYWxzbyBiZSB1c2VkIHRvIHVwZGF0ZSBiaXRzIGFuZCByZXF1ZXN0cyBsZWZ0LlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2V9IEEgUHJvbWlzZSwgd2hpY2ggaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzXHJcbiAgICAgKiAgICAgdGhlIHJlc3VsdCBmaWVsZCBhcyByZXR1cm5lZCBieSB0aGUgc2VydmVyLlxyXG4gICAgICovXHJcbiAgICAjZ2V0VXNhZ2UgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI0dFVF9VU0FHRV9NRVRIT0QsIHt9KTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFJlc3VsdCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGdlbmVyaWMgcmVxdWVzdCBwYXJhbWV0ZXJzIHRvIGN1c3RvbSByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1ldGhvZCBNZXRob2QgdG8gc2VuZCByZXF1ZXN0IHRvLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBDdXN0b20gcGFyYW1ldGVycyB0byBnZW5lcmF0ZSByZXF1ZXN0IGFyb3VuZC5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEZsZXNoZWQgb3V0IHJlcXVlc3Qgb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICAjZ2VuZXJhdGVSZXF1ZXN0ID0gKG1ldGhvZCwgcGFyYW1zKSA9PiB7XHJcbiAgICAgICAgbGV0IGlkID0gdGhpcy4jdXVpZHY0KCk7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB7XHJcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxyXG4gICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcclxuICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXHJcbiAgICAgICAgICAgIGlkOiBpZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGdlbmVyaWMgcmVxdWVzdCBwYXJhbWV0ZXJzIGFuZCBBUEkga2V5IHRvIGN1c3RvbSByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1ldGhvZCBNZXRob2QgdG8gc2VuZCByZXF1ZXN0IHRvLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBDdXN0b20gcGFyYW1ldGVycyB0byBnZW5lcmF0ZSByZXF1ZXN0IGFyb3VuZC5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEZsZXNoZWQgb3V0IHJlcXVlc3Qgb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICAjZ2VuZXJhdGVLZXllZFJlcXVlc3QgPSAobWV0aG9kLCBwYXJhbXMpID0+IHtcclxuICAgICAgICBwYXJhbXNbJ2FwaUtleSddID0gdGhpcy4jYXBpS2V5O1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZVJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXh0cmFjdHMgYmFzaWMgZGF0YSBmcm9tIHJlc3BvbnNlIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBPYmplY3QgZnJvbSB3aGljaCB0byBleHRyYWN0IGRhdGEuXHJcbiAgICAgKiBAcmV0dXJucyB7YW55W119IEV4dHJhY3RlZCBkYXRhIGFzIGFuIGFycmF5LlxyXG4gICAgICovXHJcbiAgICAjZXh0cmFjdEJhc2ljID0gYXN5bmMgcmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gZGF0YS5yZXN1bHQucmFuZG9tLmRhdGE7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGRhdGEsIHJhbmRvbSBmaWVsZCBhbmQgc2lnbmF0dXJlIGZyb20gcmVzcG9uc2UgYW5kIHJldHVybnMgdGhlc2UgYXNcclxuICAgICAqIGEgbmV3IG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBPYmplY3QgZnJvbSB3aGljaCB0byBleHRyYWN0IHRoZSBpbmZvcm1hdGlvbi5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHtkYXRhOiBudW1iZXJbXXxudW1iZXJbXVtdfHN0cmluZ1tdfHN0cmluZ1tdW10sIHJhbmRvbTogT2JqZWN0LFxyXG4gICAgICogICAgIHNpZ25hdHVyZTogc3RyaW5nfT59IFRoZSByZXNwb25zZSBzcGxpdCBpbnRvIGRhdGEsIHJhbmRvbSBhbmQgc2lnbmF0dXJlIGZpZWxkcy5cclxuICAgICAqL1xyXG4gICAgI2V4dHJhY3RTaWduZWQgPSBhc3luYyByZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLnJlc3VsdC5yYW5kb20uZGF0YSxcclxuICAgICAgICAgICAgICAgIHJhbmRvbTogZGF0YS5yZXN1bHQucmFuZG9tLFxyXG4gICAgICAgICAgICAgICAgc2lnbmF0dXJlOiBkYXRhLnJlc3VsdC5zaWduYXR1cmVcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdmVyaWZpY2F0aW9uIHJlc3BvbnNlIGFzIHNlcGFyYXRlIGZyb20gcmVzcG9uc2Ugb2JqZWN0LlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIFJlc3BvbnNlIG9iamVjdCBmcm9tIHdoaWNoIHRvIGV4dHJhY3RcclxuICAgICAqICAgICB2ZXJpZmljYXRpb24gcmVzcG9uc2UuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVmVyaWZpY2F0aW9uIHN1Y2Nlc3MuXHJcbiAgICAgKi9cclxuICAgICNleHRyYWN0VmVyaWZpY2F0aW9uID0gYXN5bmMgcmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gZGF0YS5yZXN1bHQuYXV0aGVudGljaXR5O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXh0cmFjdHMgdGhlIGluZm9ybWF0aW9uIHJldHVybmVkIHVuZGVyIHRoZSAncmVzdWx0JyBmaWVsZC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gQWxsIGRhdGEgY29udGFpbmVkIGluIHRoZSAncmVzdWx0JyBmaWVsZC5cclxuICAgICAqL1xyXG4gICAgI2V4dHJhY3RSZXN1bHQgPSBhc3luYyByZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnJlc3VsdDtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBnZW5lcmF0ZSByZXF1ZXN0cyBmb3IgaW50ZWdlcnMuXHJcbiAgICAgKi9cclxuICAgICNpbnRlZ2VyUmVxdWVzdCA9IChuLCBtaW4sIG1heCwgeyByZXBsYWNlbWVudCA9IHRydWUsIGJhc2UgPSAxMCwgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiA9IG51bGwsIGxpY2Vuc2VEYXRhID0gbnVsbCwgdXNlckRhdGEgPSBudWxsLCB0aWNrZXRJZCA9IG51bGwgfSA9IHt9LCBzaWduZWQgPSBmYWxzZSkgPT4ge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIG1pbjogbWluLFxyXG4gICAgICAgICAgICBtYXg6IG1heCxcclxuICAgICAgICAgICAgcmVwbGFjZW1lbnQ6IHJlcGxhY2VtZW50LFxyXG4gICAgICAgICAgICBiYXNlOiBiYXNlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG5cclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfSU5URUdFUl9NRVRIT0QgOiBSYW5kb21PcmdDbGllbnQuI0lOVEVHRVJfTUVUSE9EO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHJlcXVlc3RzIGZvciBpbnRlZ2VyIHNlcXVlbmNlcy5cclxuICAgICAqL1xyXG4gICAgI2ludGVnZXJTZXF1ZW5jZVJlcXVlc3QgPSAobiwgbGVuZ3RoLCBtaW4sIG1heCwgeyByZXBsYWNlbWVudCA9IHRydWUsIGJhc2UgPSAxMCwgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiA9IG51bGwsIGxpY2Vuc2VEYXRhID0gbnVsbCwgdXNlckRhdGEgPSBudWxsLCB0aWNrZXRJZCA9IG51bGwgfSA9IHt9LCBzaWduZWQgPSBmYWxzZSkgPT4ge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIGxlbmd0aDogbGVuZ3RoLFxyXG4gICAgICAgICAgICBtaW46IG1pbixcclxuICAgICAgICAgICAgbWF4OiBtYXgsXHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50OiByZXBsYWNlbWVudCxcclxuICAgICAgICAgICAgYmFzZTogYmFzZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuXHJcbiAgICAgICAgbGV0IG1ldGhvZCA9IHNpZ25lZCA/IFJhbmRvbU9yZ0NsaWVudC4jU0lHTkVEX0lOVEVHRVJfU0VRVUVOQ0VfTUVUSE9EIDogUmFuZG9tT3JnQ2xpZW50LiNJTlRFR0VSX1NFUVVFTkNFX01FVEhPRDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0KG1ldGhvZCwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBnZW5lcmF0ZSByZXF1ZXN0cyBmb3IgZGVjaW1hbCBmcmFjdGlvbnMuXHJcbiAgICAgKi9cclxuICAgICNkZWNpbWFsRnJhY3Rpb25SZXF1ZXN0ID0gKG4sIGRlY2ltYWxQbGFjZXMsIHsgcmVwbGFjZW1lbnQgPSB0cnVlLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uID0gbnVsbCwgbGljZW5zZURhdGEgPSBudWxsLCB1c2VyRGF0YSA9IG51bGwsIHRpY2tldElkID0gbnVsbCB9ID0ge30sIHNpZ25lZCA9IGZhbHNlKSA9PiB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbjogbixcclxuICAgICAgICAgICAgZGVjaW1hbFBsYWNlczogZGVjaW1hbFBsYWNlcyxcclxuICAgICAgICAgICAgcmVwbGFjZW1lbnQ6IHJlcGxhY2VtZW50XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBtZXRob2QgPSBzaWduZWQgPyBSYW5kb21PcmdDbGllbnQuI1NJR05FRF9ERUNJTUFMX0ZSQUNUSU9OX01FVEhPRCA6IFJhbmRvbU9yZ0NsaWVudC4jREVDSU1BTF9GUkFDVElPTl9NRVRIT0Q7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChtZXRob2QsIHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgcmVxdWVzdHMgZm9yIEdhdXNzaWFucy5cclxuICAgICAqL1xyXG4gICAgI2dhdXNzaWFuUmVxdWVzdCA9IChuLCBtZWFuLCBzdGFuZGFyZERldmlhdGlvbiwgc2lnbmlmaWNhbnREaWdpdHMsIHsgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiA9IG51bGwsIGxpY2Vuc2VEYXRhID0gbnVsbCwgdXNlckRhdGEgPSBudWxsLCB0aWNrZXRJZCA9IG51bGwgfSA9IHt9LCBzaWduZWQgPSBmYWxzZSkgPT4ge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIG1lYW46IG1lYW4sXHJcbiAgICAgICAgICAgIHN0YW5kYXJkRGV2aWF0aW9uOiBzdGFuZGFyZERldmlhdGlvbixcclxuICAgICAgICAgICAgc2lnbmlmaWNhbnREaWdpdHM6IHNpZ25pZmljYW50RGlnaXRzXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG5cclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfR0FVU1NJQU5fTUVUSE9EIDogUmFuZG9tT3JnQ2xpZW50LiNHQVVTU0lBTl9NRVRIT0Q7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChtZXRob2QsIHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgcmVxdWVzdHMgZm9yIHN0cmluZ3MuXHJcbiAgICAgKi9cclxuICAgICNzdHJpbmdSZXF1ZXN0ID0gKG4sIGxlbmd0aCwgY2hhcmFjdGVycywgeyByZXBsYWNlbWVudCA9IHRydWUsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0gPSB7fSwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBuOiBuLFxyXG4gICAgICAgICAgICBsZW5ndGg6IGxlbmd0aCxcclxuICAgICAgICAgICAgY2hhcmFjdGVyczogY2hhcmFjdGVycyxcclxuICAgICAgICAgICAgcmVwbGFjZW1lbnQ6IHJlcGxhY2VtZW50XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG5cclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfU1RSSU5HX01FVEhPRCA6IFJhbmRvbU9yZ0NsaWVudC4jU1RSSU5HX01FVEhPRDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0KG1ldGhvZCwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBnZW5lcmF0ZSByZXF1ZXN0cyBmb3IgVVVJRHMuXHJcbiAgICAgKi9cclxuICAgICNVVUlEUmVxdWVzdCA9IChuLCB7IHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0gPSB7fSwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBuOiBuXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG5cclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfVVVJRF9NRVRIT0QgOiBSYW5kb21PcmdDbGllbnQuI1VVSURfTUVUSE9EO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHJlcXVlc3RzIGZvciBibG9icy5cclxuICAgICAqL1xyXG4gICAgI2Jsb2JSZXF1ZXN0ID0gKG4sIHNpemUsIHsgZm9ybWF0ID0gdGhpcy5CQVNFNjQsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0sIHNpZ25lZCA9IGZhbHNlKSA9PiB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbjogbixcclxuICAgICAgICAgICAgc2l6ZTogc2l6ZSxcclxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBwYXJhbXMgPSB0aGlzLiNhZGRPcHRpb25hbFBhcmFtcyhwYXJhbXMsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24sXHJcbiAgICAgICAgICAgIGxpY2Vuc2VEYXRhLCB1c2VyRGF0YSwgdGlja2V0SWQsIHNpZ25lZCk7XHJcblxyXG4gICAgICAgIGxldCBtZXRob2QgPSBzaWduZWQgPyBSYW5kb21PcmdDbGllbnQuI1NJR05FRF9CTE9CX01FVEhPRCA6IFJhbmRvbU9yZ0NsaWVudC4jQkxPQl9NRVRIT0Q7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChtZXRob2QsIHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gYWRkIG9wdGlvbmFsIHBhcmFtZXRlcnMgd2hpY2ggYXJlIGNvbW1vbiBhY3Jvc3NcclxuICAgICAqIHZhbHVlLWdlbmVyYXRpbmcgbWV0aG9kcy5cclxuICAgICAqL1xyXG4gICAgI2FkZE9wdGlvbmFsUGFyYW1zID0gKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiwgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICAvLyBhdmFpbGFibGUgZm9yIGJvdGggQmFzaWMgYW5kIFNpZ25lZCBBUEkgbWV0aG9kc1xyXG4gICAgICAgIHBhcmFtcy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uID0gcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbjtcclxuXHJcbiAgICAgICAgLy8gb3B0aW9uYWwgcGFyYW1ldGVycyB1c2VkIGV4Y2x1c2l2ZWx5IGZvciBTaWduZWQgQVBJIG1ldGhvZHNcclxuICAgICAgICBpZiAoc2lnbmVkKSB7XHJcbiAgICAgICAgICAgIHBhcmFtcy5saWNlbnNlRGF0YSA9IGxpY2Vuc2VEYXRhO1xyXG4gICAgICAgICAgICBwYXJhbXMudXNlckRhdGEgPSB1c2VyRGF0YTtcclxuICAgICAgICAgICAgcGFyYW1zLnRpY2tldElkID0gdGlja2V0SWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwYXJhbXM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGFuIGludGVnZXIgc2VxdWVuY2UgY2FjaGUuIFxyXG4gICAgICogQHBhcmFtIHthbnlbXX0gb3JpZ2luYWwgVGhlIGFycmF5IHRvIGJlIHJlcGVhdGVkLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgb3JpZ2luYWwgYXJyYXkgaXMgdG8gYmVcclxuICAgICAqICAgICByZXBlYXRlZC5cclxuICAgICAqIEByZXR1cm5zIHthbnlbXX0gQSBuZXcgYXJyYXkgd2hpY2ggY29udGFpbnMgdGhlIG9yaWdpbmFsIGFycmF5IHJlcGVhdGVkXHJcbiAgICAgKiAgICAgbiB0aW1lcy5cclxuICAgICAqL1xyXG4gICAgI2FkanVzdCA9IChvcmlnaW5hbCwgbikgPT4ge1xyXG4gICAgICAgIHJldHVybiBBcnJheS5mcm9tKHsgbGVuZ3RoOiBuIH0sICgpID0+IG9yaWdpbmFsKS5mbGF0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGFuIGludGVnZXIgc2VxdWVuY2UgY2FjaGUuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBhIEFuIGFycmF5IG9mIGludGVnZXJzIChvciBhIHNpbmdsZSB2YWx1ZSkuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBMYXJnZXN0IHZhbHVlIGluIHRoZSBhcnJheSAob3IgYSwgdW5jaGFuZ2VkLCBpZiBpdFxyXG4gICAgICogICAgIGlzIG5vdCBhbiBhcnJheSkuXHJcbiAgICAgKi9cclxuICAgICNtYXhWYWx1ZSA9IGEgPT4ge1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhLnJlZHVjZShmdW5jdGlvbih4LCB5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoeCwgeSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYW4gaW50ZWdlciBzZXF1ZW5jZSBjYWNoZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IGEgQW4gYXJyYXkgb2YgaW50ZWdlcnMgKG9yIGEgc2luZ2xlIHZhbHVlKS5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFNtYWxsZXN0IHZhbHVlIGluIHRoZSBhcnJheSAob3IgYSwgdW5jaGFuZ2VkLCBpZiBpdFxyXG4gICAgICogICAgIGlzIG5vdCBhbiBhcnJheSkuXHJcbiAgICAgKi9cclxuICAgICNtaW5WYWx1ZSA9IGEgPT4ge1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGEpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhLnJlZHVjZShmdW5jdGlvbih4LCB5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5taW4oeCwgeSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKiogSGVscGVyIGZ1bmN0aW9uIHRvIG1ha2UgYSBzdHJpbmcgVVJMLXNhZmUgKGJhc2U2NCBhbmQgcGVyY2VudC1lbmNvZGluZykgKi9cclxuICAgICNmb3JtYXRVcmwgPSBzID0+IHtcclxuICAgICAgICBsZXQgcGF0dGVybiA9IC9eKFswLTlhLXpBLVorL117NH0pKigoWzAtOWEtekEtWisvXXsyfT09KXwoWzAtOWEtekEtWisvXXszfT0pKT8kLztcclxuICAgICAgICBsZXQgaXNCYXNlNjQgPSBwYXR0ZXJuLnRlc3Qocyk7XHJcblxyXG4gICAgICAgIGlmICghaXNCYXNlNjQpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBicm93c2VyXHJcbiAgICAgICAgICAgICAgICAgICAgcyA9IGJ0b2Eocyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBSZWZlcmVuY2VFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIE5vZGVKU1xyXG4gICAgICAgICAgICAgICAgICAgIHMgPSBCdWZmZXIuZnJvbShzKS50b1N0cmluZygnYmFzZTY0Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFBlcmNlbnQtRW5jb2RpbmcgYXMgZGVzY3JpYmVkIGluIFJGQyAzOTg2IGZvciBQSFBcclxuICAgICAgICBzID0gcy5yZXBsYWNlKC89L2csICclM0QnKTtcclxuICAgICAgICBzID0gcy5yZXBsYWNlKC9cXCsvZywgJyUyQicpO1xyXG4gICAgICAgIHMgPSBzLnJlcGxhY2UoL1xcLy9nLCAnJTJGJyk7XHJcblxyXG4gICAgICAgIHJldHVybiBzXHJcbiAgICB9XHJcblxyXG4gICAgLyoqIEhlbHBlciBmdW5jdGlvbiB0byBjcmVhdGUgYSBIVE1MIGlucHV0IHRhZyAqL1xyXG4gICAgI2lucHV0SFRNTCA9ICh0eXBlLCBuYW1lLCB2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHJldHVybiAnPGlucHV0IHR5cGU9XFwnJyArIHR5cGUgKyAnXFwnIG5hbWU9XFwnJyArIG5hbWUgKyAnXFwnIHZhbHVlPVxcJycgKyB2YWx1ZSArICdcXCcgLz4nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgVVVJRHMgdG8gYmUgdXNlZCBhcyBcImlkXCIgaW4gcmVxdWVzdHMgdG8gdGhlIHNlcnZlci4gKi9cclxuICAgICN1dWlkdjQgPSAoKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24oYykge1xyXG4gICAgICAgICAgICB2YXIgciA9IE1hdGgucmFuZG9tKCkqMTYgfCAwO1xyXG4gICAgICAgICAgICByZXR1cm4gKGMgPT0gJ3gnID8gciA6IChyJjB4M3wweDgpKS50b1N0cmluZygxNik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0iLCIvKiogXHJcbiAqIEVTIE1vZHVsZSB3cmFwcGVyLCBhbGxvd2luZyB0aGlzIGxpYnJhcnkgdG8gYmUgaW1wb3J0ZWQgdXNpbmdcclxuICogRVM2KyBzeW50YXguIFRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3MgaXMgYm90aCB0aGUgZGVmYXVsdCBhbmRcclxuICogYSBuYW1lZCBleHBvcnQuIEFsbCBlcnJvciBjbGFzc2VzLCBhcmUgYXZhaWxhYmxlIG9ubHkgYXMgbmFtZWRcclxuICogZXhwb3J0cy5cclxuICogKi9cclxuaW1wb3J0IFJhbmRvbU9yZ0NsaWVudCBmcm9tICcuLi9SYW5kb21PcmdDbGllbnQuanMnO1xyXG5pbXBvcnQgUmFuZG9tT3JnQ2FjaGUgZnJvbSAnLi4vUmFuZG9tT3JnQ2FjaGUuanMnO1xyXG5pbXBvcnQgKiBhcyBFcnJvcnMgZnJvbSAnLi4vUmFuZG9tT3JnRXJyb3JzLmpzJztcclxuXHJcbmxldCBSYW5kb21PcmdSQU5ET01PUkdFcnJvciA9IEVycm9ycy5kZWZhdWx0LlJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yO1xyXG5sZXQgUmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcjtcclxubGV0IFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvciA9IEVycm9ycy5kZWZhdWx0LlJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcjtcclxubGV0IFJhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yO1xyXG5sZXQgUmFuZG9tT3JnSlNPTlJQQ0Vycm9yID0gRXJyb3JzLmRlZmF1bHQuUmFuZG9tT3JnSlNPTlJQQ0Vycm9yO1xyXG5sZXQgUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yID0gRXJyb3JzLmRlZmF1bHQuUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yO1xyXG5sZXQgUmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvciA9IEVycm9ycy5kZWZhdWx0LlJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3I7XHJcbmxldCBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdDYWNoZUVtcHR5RXJyb3I7XHJcblxyXG5leHBvcnQge1xyXG4gICAgUmFuZG9tT3JnQ2xpZW50IGFzIGRlZmF1bHQsXHJcbiAgICBSYW5kb21PcmdDbGllbnQsXHJcbiAgICBSYW5kb21PcmdDYWNoZSxcclxuICAgIFJhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yLFxyXG4gICAgUmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcixcclxuICAgIFJhbmRvbU9yZ0pTT05SUENFcnJvcixcclxuICAgIFJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcixcclxuICAgIFJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcixcclxuICAgIFJhbmRvbU9yZ0NhY2hlRW1wdHlFcnJvclxyXG59OyJdLCJuYW1lcyI6WyJSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IiLCJSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IiLCJyZXF1aXJlJCQwIiwiUmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3IiLCJSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yIiwiUmFuZG9tT3JnSlNPTlJQQ0Vycm9yIiwiUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yIiwiUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IiLCJSYW5kb21PcmdTZW5kVGltZW91dEVycm9yIiwicmVxdWlyZSQkMSIsIkVycm9ycy5kZWZhdWx0Il0sIm1hcHBpbmdzIjoiOzs7OztJQUVBO0lBQ0E7SUFDQTtJQUNBO2lEQUNxQyxHQUFHLE1BQU0sNkJBQTZCLFNBQVMsS0FBSztJQUN6RjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFO0lBQ3pCLFFBQVEsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lB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LENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDOUQsS0FBSztBQUNMO0lBQ0E7QUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLHNCQUFzQixDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE9BQU8sR0FBRyxFQUFFLEVBQUU7SUFDNUQsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN2RSxRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDL0QsS0FBSztBQUNMO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksTUFBTSw4QkFBOEIsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRTtJQUM1RSxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZGLFFBQVEsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvRCxLQUFLO0FBQ0w7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLE1BQU0sOEJBQThCLENBQUMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxPQUFPLEdBQUcsRUFBRSxFQUFFO0lBQ3pFLFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3BGLFFBQVEsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvRCxLQUFLO0FBQ0w7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLHVCQUF1QixDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRTtJQUMvRixRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQjtJQUN6RixZQUFZLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMzQixRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDL0QsS0FBSztBQUNMO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLE1BQU0scUJBQXFCLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRTtJQUNyRSxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2hGLFFBQVEsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvRCxLQUFLO0FBQ0w7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFD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
