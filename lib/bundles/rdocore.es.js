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

export { RandomOrgBadHTTPResponseError, RandomOrgCache_1 as RandomOrgCache, RandomOrgCacheEmptyError, RandomOrgClient_1 as RandomOrgClient, RandomOrgInsufficientBitsError, RandomOrgInsufficientRequestsError, RandomOrgJSONRPCError, RandomOrgKeyNotRunningError, RandomOrgRANDOMORGError, RandomOrgSendTimeoutError, RandomOrgClient_1 as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRvY29yZS5lcy5qcyIsInNvdXJjZXMiOlsiLi4vUmFuZG9tT3JnRXJyb3JzLmpzIiwiLi4vUmFuZG9tT3JnQ2FjaGUuanMiLCIuLi9SYW5kb21PcmdDbGllbnQuanMiLCIuLi9lc20vaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gdGhlIGNvbm5lY3Rpb24gZG9lc24ndCByZXR1cm5cclxuICogYSBIVFRQIDIwMCBPSyByZXNwb25zZS5cclxuICovXHJcbmV4cG9ydHMuUmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3IgPSBjbGFzcyBSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0cyBhIG5ldyBleGNlcHRpb24gd2l0aCB0aGUgc3BlY2lmaWVkIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBBUEkga2V5J3MgcmVxdWVzdCBoYXNcclxuICogZXhjZWVkZWQgaXRzIHJlbWFpbmluZyBzZXJ2ZXIgYml0cyBhbGxvd2FuY2UuXHJcbiAqIFxyXG4gKiBJZiB0aGUgY2xpZW50IGlzIGN1cnJlbnRseSBpc3N1aW5nIGxhcmdlIHJlcXVlc3RzIGl0IG1heSBiZSBwb3NzaWJsZSBzdWNjZWVkXHJcbiAqIHdpdGggc21hbGxlciByZXF1ZXN0cy4gVXNlIHRoZSBnZXRCaXRzTGVmdCgpIGNhbGwgaW4gdGhpcyBjbGFzcyB0byBoZWxwXHJcbiAqIGRldGVybWluZSBpZiBhbiBhbHRlcm5hdGl2ZSByZXF1ZXN0IHNpemUgaXMgYXBwcm9wcmlhdGUuXHJcbiAqL1xyXG4gZXhwb3J0cy5SYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IgPSBjbGFzcyBSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IgZXh0ZW5kcyBFcnJvclxyXG57XHJcbiAgICAvLyBTdG9yZXMgdGhlIG51bWJlciBvZiBiaXRzIHJlbWFpbmluZ1xyXG4gICAgI2JpdHMgPSAtMTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3RzIGEgbmV3IGV4Y2VwdGlvbiB3aXRoIHRoZSBzcGVjaWZpZWQgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFRoZSBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiaXRzIEJpdHMgcmVtYWluaW5nIGp1c3QgYmVmb3JlIHRoZSBlcnJvciB3YXMgdGhyb3duLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBiaXRzKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICAgICAgdGhpcy4jYml0cyA9IGJpdHM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSBudW1iZXIgb2YgYml0cyByZW1haW5pbmcuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGJpdHMgbGVmdC5cclxuICAgICAqL1xyXG4gICAgZ2V0Qml0c0xlZnQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2JpdHM7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBBUEkga2V5J3Mgc2VydmVyIHJlcXVlc3RzXHJcbiAqIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICogXHJcbiAqIFRoaXMgaW5kaWNhdGVzIHRoYXQgYSBiYWNrLW9mZiB1bnRpbCBtaWRuaWdodCBVVEMgaXMgaW4gZWZmZWN0LCBiZWZvcmUgd2hpY2hcclxuICogbm8gcmVxdWVzdHMgd2lsbCBiZSBzZW50IGJ5IHRoZSBjbGllbnQgYXMgbm8gbWVhbmluZ2Z1bCBzZXJ2ZXIgcmVzcG9uc2VzIHdpbGxcclxuICogYmUgcmV0dXJuZWQuXHJcbiAqL1xyXG5leHBvcnRzLlJhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3IgPSBjbGFzcyBSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3RzIGEgbmV3IGV4Y2VwdGlvbiB3aXRoIHRoZSBzcGVjaWZpZWQgZGV0YWlsIG1lc3NhZ2UuXHJcbiAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFRoZSBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobWVzc2FnZSkge1xyXG4gICAgICAgIHN1cGVyKG1lc3NhZ2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQ1xyXG4gKiBFcnJvci4gU2VlIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9lcnJvci1jb2Rlc1xyXG4gKi9cclxuZXhwb3J0cy5SYW5kb21PcmdKU09OUlBDRXJyb3IgPSBjbGFzcyBSYW5kb21PcmdKU09OUlBDRXJyb3IgZXh0ZW5kcyBFcnJvclxyXG57XHJcbiAgICAvKipcclxuICAgICAqIENvbnN0cnVjdHMgYSBuZXcgZXhjZXB0aW9uIHdpdGggdGhlIHNwZWNpZmllZCBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIGl0cyBBUEkga2V5IGhhcyBiZWVuIHN0b3BwZWQuXHJcbiAqIFJlcXVlc3RzIHdpbGwgbm90IGNvbXBsZXRlIHdoaWxlIEFQSSBrZXkgaXMgaW4gdGhlIHN0b3BwZWQgc3RhdGUuXHJcbiAqL1xyXG5leHBvcnRzLlJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvciA9IGNsYXNzIFJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8qKlxyXG4gICAgICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiBpdHMgQVBJIGtleSBoYXMgYmVlbiBzdG9wcGVkLlxyXG4gICAgICogUmVxdWVzdHMgd2lsbCBub3QgY29tcGxldGUgd2hpbGUgQVBJIGtleSBpcyBpbiB0aGUgc3RvcHBlZCBzdGF0ZS5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gYnkgdGhlIFJhbmRvbU9yZ0NsaWVudCBjbGFzcyB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhXHJcbiAqIFJBTkRPTS5PUkcgRXJyb3IuIFNlZSBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvZXJyb3ItY29kZXNcclxuICovXHJcbmV4cG9ydHMuUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IgPSBjbGFzcyBSYW5kb21PcmdSQU5ET01PUkdFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8vIFN0b3JlcyB0aGUgY29kZSBvZiB0aGUgUkFORE9NLk9SRyBlcnJvclxyXG4gICAgI2NvZGUgPSAtMTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEVycm9yIHRocm93biBieSB0aGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGFcclxuICAgICAqIFJBTkRPTS5PUkcgRXJyb3IuIFNlZSBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvZXJyb3ItY29kZXNcclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXI9fSBbY29kZT0tMV0gVGhlIGVycm9yIGNvZGUuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUgPSAtMSkge1xyXG4gICAgICAgIHN1cGVyKG1lc3NhZ2UpOyAgICBcclxuICAgICAgICB0aGlzLiNjb2RlID0gY29kZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIFJBTkRPTS5PUkcgZXJyb3IgY29kZSwgc2VlXHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvZXJyb3ItY29kZXNcclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBlcnJvciBjb2RlLlxyXG4gICAgICovXHJcbiAgICBnZXRDb2RlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNjb2RlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiBpdHMgc2V0IGJsb2NraW5nIHRpbWVvdXQgaXNcclxuICogZXhjZWVkZWQgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gKi9cclxuZXhwb3J0cy5SYW5kb21PcmdTZW5kVGltZW91dEVycm9yID0gY2xhc3MgUmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvciBleHRlbmRzIEVycm9yXHJcbntcclxuICAgIC8qKlxyXG4gICAgICogRXJyb3IgdGhyb3duIGJ5IHRoZSBSYW5kb21PcmdDbGllbnQgY2xhc3Mgd2hlbiBpdHMgc2V0IGJsb2NraW5nIHRpbWVvdXQgaXNcclxuICAgICAqIGV4Y2VlZGVkIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGRldGFpbCBtZXNzYWdlLlxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XHJcbiAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFcnJvciB0aHJvd24gd2hlbiBkYXRhIHJldHJpZXZhbCBmcm9tIGFuIGVtdHB5IFJhbmRvbU9yZ0NhY2hlIGlzIGF0dGVtcHRlZC5cclxuICovXHJcbmV4cG9ydHMuUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yID0gY2xhc3MgUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yIGV4dGVuZHMgRXJyb3Jcclxue1xyXG4gICAgI3BhdXNlZCA9IGZhbHNlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXJyb3IgdGhyb3duIHdoZW4gZGF0YSByZXRyaWV2YWwgZnJvbSBhbiBlbXRweSBSYW5kb21PcmdDYWNoZSBpcyBhdHRlbXB0ZWQuXHJcbiAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFRoZSBkZXRhaWwgbWVzc2FnZS5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcGF1c2VkIFJlZmxlY3RzIHdoZXRoZXIgdGhlIFJhbmRvbU9yZ0NhY2hlIGluc3RhbmNlIHdhc1xyXG4gICAgICogICAgIHBhdXNlZCB3aGVuIHRoaXMgZXJyb3Igd2FzIHRocm93bi5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobWVzc2FnZSwgcGF1c2VkID0gZmFsc2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgICAgICB0aGlzLiNwYXVzZWQgPSBwYXVzZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIGNhY2hlIHdhcyBwYXVzZWQgYXQgdGhlIHRpbWUgd2hlbiB0aGVcclxuICAgICAqIGVycm9yIHdhcyB0aHJvd24uXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBwYXVzZWQsIGZhbHNlIG90aGVyd2lzZS5cclxuICAgICAqL1xyXG4gICAgd2FzUGF1c2VkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNwYXVzZWQ7XHJcbiAgICB9XHJcbn0iLCIndXNlIHN0cmljdCc7XHJcbmNvbnN0IHtcclxuICAgIFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcixcclxuICAgIFJhbmRvbU9yZ0NhY2hlRW1wdHlFcnJvclxyXG59ID0gcmVxdWlyZSgnLi9SYW5kb21PcmdFcnJvcnMuanMnKTtcclxuLyoqXHJcbiAqIFByZWNhY2hlIGNsYXNzIGZvciBmcmVxdWVudGx5IHVzZWQgcmVxdWVzdHMuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGNsYXNzIFJhbmRvbU9yZ0NhY2hlIHtcclxuICAgIC8vIGZ1bmN0aW9uIHVzZWQgdG8gc2VuZCBhIHJlcXVlc3RcclxuICAgICNyZXF1ZXN0RnVuY3Rpb24gPSBudWxsO1xyXG5cclxuICAgIC8vIHJlcXVlc3QgdG8gYmUgc2VudFxyXG4gICAgI3JlcXVlc3QgPSBudWxsO1xyXG5cclxuICAgIC8vIG4gZm9yIGJ1bGsgcmVxdWVzdHNcclxuICAgICNidWxrUmVxdWVzdE51bWJlciA9IDA7XHJcbiAgICAvLyBuIGZvciBhIHNpbmdsZSByZXF1ZXN0XHJcbiAgICAjcmVxdWVzdE51bWJlciA9IDA7XHJcbiAgICAvLyBzaXplIG9mIGEgc2luZ2xlIHJlcXVlc3QgaW4gYml0c1xyXG4gICAgI3JlcXVlc3RTaXplID0gLTE7XHJcblxyXG4gICAgLy8gc3RvcmVzIGNhY2hlZCBhcnJheXMgb2YgdmFsdWVzXHJcbiAgICAjc3RhY2sgPSBbXTtcclxuICAgIC8vIG51bWJlciBvZiBhcnJheXMgdG8gdHJ5IHRvIG1haW50YWluIGluICNzdGFja1xyXG4gICAgI2NhY2hlU2l6ZSA9IDEwO1xyXG5cclxuICAgIC8vIHN0YXR1cyBvZiB0aGUgY2FjaGVcclxuICAgICNwYXVzZWQgPSBmYWxzZTtcclxuICAgIC8vIGJpdHMgdXNlZCBieSB0aGlzIGNhY2hlXHJcbiAgICAjYml0c1VzZWQgPSAwO1xyXG4gICAgLy8gcmVxdWVzdHMgdXNlZCBieSB0aGlzIGNhY2hlXHJcbiAgICAjcmVxdWVzdHNVc2VkID0gMDtcclxuICAgIC8vIGVuc3VyZXMgI3BvcHVsYXRlKCkgZG9lcyBub3QgaXNzdWUgcGFyYWxsZWwgcmVxdWVzdHNcclxuICAgICNjdXJyZW50bHlQb3B1bGF0aW5nID0gZmFsc2U7XHJcblxyXG4gICAgLy8gYW4gZXJyb3Igd2hpY2ggd2lsbCBiZSB0aHJvd24gb24gdGhlIG5leHQgY2FsbCB0byBnZXQoKSBvciBnZXRPcldhaXQoKVxyXG4gICAgI2Vycm9yID0gbnVsbDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemUgY2xhc3MgYW5kIHN0YXJ0IHN0YWNrIHBvcHVsYXRpb25cclxuICAgICAqIFxyXG4gICAgICogKiogV0FSTklORyoqIFNob3VsZCBvbmx5IGJlIGNhbGxlZCBieSBSYW5kb21PcmdDbGllbnQncyBjcmVhdGVDYWNoZSgpXHJcbiAgICAgKiBtZXRob2RzLlxyXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpIDogT2JqZWN0fSByZXF1ZXN0RnVuY3Rpb24gRnVuY3Rpb24gdXNlZCB0byBzZW5kXHJcbiAgICAgKiAgICAgc3VwcGxpZWQgcmVxdWVzdCB0byBzZXJ2ZXIuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdCBSZXF1ZXN0IHRvIHNlbmQgdG8gc2VydmVyIHZpYSByZXF1ZXN0RnVuY3Rpb24uXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2FjaGVTaXplIE51bWJlciBvZiByZXF1ZXN0IHJlc3BvbnNlcyB0byB0cnkgbWFpbnRhaW4uXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYnVsa1JlcXVlc3ROdW1iZXIgSWYgcmVxdWVzdCBpcyBzZXQgdG8gYmUgaXNzdWVkIGluIGJ1bGssXHJcbiAgICAgKiAgICAgbnVtYmVyIG9mIHJlc3VsdCBzZXRzIGluIGEgYnVsayByZXF1ZXN0LCBlbHNlIDAuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVxdWVzdE51bWJlciBJZiByZXF1ZXN0IGlzIHNldCB0byBiZSBpc3N1ZWQgaW4gYnVsayxcclxuICAgICAqICAgICBudW1iZXIgb2YgcmVzdWx0cyBpbiBhIHNpbmdsZSByZXF1ZXN0LCBlbHNlIDAuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2luZ2xlUmVxdWVzdFNpemUgU2l6ZSBvZiBhIHNpbmdsZSByZXF1ZXN0IGluIGJpdHMgZm9yXHJcbiAgICAgKiAgICAgYWRqdXN0aW5nIGJ1bGsgcmVxdWVzdHMgaWYgYml0cyBhcmUgaW4gc2hvcnQgc3VwcGx5IG9uIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHJlcXVlc3RGdW5jdGlvbiwgcmVxdWVzdCwgY2FjaGVTaXplLCBidWxrUmVxdWVzdE51bWJlciwgcmVxdWVzdE51bWJlciwgc2luZ2xlUmVxdWVzdFNpemUpIHtcclxuICAgICAgICB0aGlzLiNyZXF1ZXN0RnVuY3Rpb24gPSByZXF1ZXN0RnVuY3Rpb247XHJcblxyXG4gICAgICAgIHRoaXMuI3JlcXVlc3QgPSByZXF1ZXN0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuI2NhY2hlU2l6ZSA9IGNhY2hlU2l6ZTtcclxuXHJcbiAgICAgICAgdGhpcy4jYnVsa1JlcXVlc3ROdW1iZXIgPSBidWxrUmVxdWVzdE51bWJlcjtcclxuICAgICAgICB0aGlzLiNyZXF1ZXN0TnVtYmVyID0gcmVxdWVzdE51bWJlcjtcclxuICAgICAgICB0aGlzLiNyZXF1ZXN0U2l6ZSA9IHNpbmdsZVJlcXVlc3RTaXplO1xyXG5cclxuICAgICAgICB0aGlzLiNwb3B1bGF0ZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRnVuY3Rpb24gdG8gY29udGludWUgaXNzdWluZyByZXF1ZXN0cyB1bnRpbCB0aGUgc3RhY2sgaXMgZnVsbC5cclxuICAgICAqIFxyXG4gICAgICogS2VlcCBpc3N1aW5nIHJlcXVlc3RzIHRvIHNlcnZlciB1bnRpbCBzdGFjayBpcyBmdWxsLiBXaGVuIHN0YWNrIGlzIGZ1bGxcclxuICAgICAqIGlmIHJlcXVlc3RzIGFyZSBiZWluZyBpc3N1ZWQgaW4gYnVsaywgd2FpdCB1bnRpbCBzdGFjayBoYXMgZW5vdWdoIHNwYWNlXHJcbiAgICAgKiB0byBhY2NvbW1vZGF0ZSBhbGwgb2YgYSBidWxrIHJlcXVlc3QgYmVmb3JlIGlzc3VpbmcgYSBuZXcgcmVxdWVzdCwgb3RoZXJ3aXNlXHJcbiAgICAgKiBpc3N1ZSBhIG5ldyByZXF1ZXN0IGV2ZXJ5IHRpbWUgYW4gaXRlbSBpbiB0aGUgc3RhY2sgaGFzIGJlZW4gY29uc3VtZWQuIE5vdGVcclxuICAgICAqIHRoYXQgcmVxdWVzdHMgYXJlIGJsb2NraW5nICgnYXdhaXQnIGlzIHVzZWQgd2hlbiBjYWxsaW5nIHRoZSByZXF1ZXN0RnVuY3Rpb24pLFxyXG4gICAgICogaS5lLiwgb25seSBvbmUgcmVxdWVzdCB3aWxsIGJlIGlzc3VlZCBieSB0aGUgY2FjaGUgYXQgYW55IGdpdmVuIHRpbWUuXHJcbiAgICAgKi9cclxuICAgICNwb3B1bGF0ZSA9IGFzeW5jICgpID0+IHtcclxuICAgICAgICBpZiAoIXRoaXMuI2N1cnJlbnRseVBvcHVsYXRpbmcgJiYgIXRoaXMuI3BhdXNlZCkge1xyXG4gICAgICAgICAgICB0aGlzLiNjdXJyZW50bHlQb3B1bGF0aW5nID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgIGxldCByZXNwb25zZSA9IG51bGw7XHJcblxyXG4gICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuI2Vycm9yICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLiNidWxrUmVxdWVzdE51bWJlciA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBJcyB0aGVyZSBzcGFjZSBmb3IgYSBidWxrIHJlc3BvbnNlIGluIHRoZSBzdGFjaz9cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy4jc3RhY2subGVuZ3RoIDw9ICh0aGlzLiNjYWNoZVNpemUgLSB0aGlzLiNidWxrUmVxdWVzdE51bWJlcikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gYXdhaXQgdGhpcy4jcmVxdWVzdEZ1bmN0aW9uKHRoaXMuI3JlcXVlc3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jYWRkUmVzcG9uc2UocmVzcG9uc2UsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3QgZW5vdWdoIGJpdHMgcmVtYWluaW5nIGZvciBhIGJ1bGsgcmVxdWVzdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYml0c0xlZnQgPSBlLmdldEJpdHNMZWZ0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJpdHNMZWZ0ID4gdGhpcy4jcmVxdWVzdFNpemUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgcG9zc2libGUsIGFkanVzdCByZXF1ZXN0IGZvciB0aGUgbGFyZ2VzdCBwb3NzaWJsZSBzaXplXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhZGp1c3RlZEJ1bGsgPSBNYXRoLmZsb29yKGJpdHNMZWZ0L3RoaXMuI3JlcXVlc3RTaXplKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jcmVxdWVzdC5wYXJhbXMubiA9IGFkanVzdGVkQnVsayAqIHRoaXMuI3JlcXVlc3ROdW1iZXI7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IHRoaXMuI3JlcXVlc3RGdW5jdGlvbih0aGlzLiNyZXF1ZXN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jYWRkUmVzcG9uc2UocmVzcG9uc2UsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVzZXQgdG8gb3JpZ2luYWwgYnVsayByZXF1ZXN0IHNpemVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy4jcmVxdWVzdC5wYXJhbXMubiA9IHRoaXMuI2J1bGtSZXF1ZXN0TnVtYmVyICogdGhpcy4jcmVxdWVzdE51bWJlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXF1ZXN0IHNpemUgY2Fubm90IGJlIGFkanVzdGVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuI2Vycm9yID0gZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQW55IG90aGVyIGVycm9yIHRocm93biBkdXJpbmcgaW4gdGhlIHJlcXVlc3QgZnVuY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLiNlcnJvciA9IGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBzcGFjZSBmb3IgYSBidWxrIHJlcXVlc3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLiNzdGFjay5sZW5ndGggPCB0aGlzLiNjYWNoZVNpemUpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbmRpdmlkdWFsIHJlcXVlc3RzXHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLiNyZXF1ZXN0RnVuY3Rpb24odGhpcy4jcmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuI2FkZFJlc3BvbnNlKHJlc3BvbnNlLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuI2Vycm9yID0gZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdGFjayBpcyBmdWxsXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gICAgICAgICAgICAgICBcclxuXHJcbiAgICAgICAgICAgIHRoaXMuI2N1cnJlbnRseVBvcHVsYXRpbmcgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgY2FjaGUgd2lsbCBubyBsb25nZXIgY29udGludWUgdG8gcG9wdWxhdGUgaXRzZWxmLlxyXG4gICAgICovXHJcbiAgICBzdG9wKCkge1xyXG4gICAgICAgIHRoaXMuI3BhdXNlZCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgY2FjaGUgd2lsbCByZXN1bWUgcG9wdWxhdGluZyBpdHNlbGYgaWYgc3RvcHBlZC5cclxuICAgICAqL1xyXG4gICAgcmVzdW1lKCkge1xyXG4gICAgICAgIHRoaXMuI3BhdXNlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICAvLyBjaGVjayBpZiBpdCBuZWVkcyB0byBiZSByZXBvcHVsYXRlZFxyXG4gICAgICAgIHRoaXMuI3JlZnJlc2goKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiB0aGUgY2FjaGUgaXMgY3VycmVudGx5IG5vdCByZS1wb3B1bGF0aW5nIGl0c2VsZi5cclxuICAgICAqIFxyXG4gICAgICogVmFsdWVzIGN1cnJlbnRseSBjYWNoZWQgbWF5IHN0aWxsIGJlIHJldHJpZXZlZCB3aXRoIGdldCgpIGJ1dCBubyBuZXdcclxuICAgICAqIHZhbHVlcyBhcmUgYmVpbmcgZmV0Y2hlZCBmcm9tIHRoZSBzZXJ2ZXIuIFRoaXMgc3RhdGUgY2FuIGJlIGNoYW5nZWQgd2l0aFxyXG4gICAgICogc3RvcCgpIGFuZCByZXN1bWUoKS5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGNhY2hlIGlzIGN1cnJlbnRseSBub3QgcmUtcG9wdWxhdGluZyBpdHNlbGYsXHJcbiAgICAgKiAgICAgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gICAgICovXHJcbiAgICBpc1BhdXNlZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4jcGF1c2VkO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgbmV4dCByZXNwb25zZS5cclxuICAgICAqIE5vdGUgdGhhdCBpZiB0aGUgY2FjaGUgaXMgZW1wdHksIGlmIHdhcyBjb25zdHJ1Y3RlZCB3aXRoIHVuc3VpdGFibGUgcGFyYW1ldGVyXHJcbiAgICAgKiB2YWx1ZXMgb3IgaWYgdGhlIGRhaWx5IGFsbG93YW5jZSBvZiBiaXRzL3JlcXVlc3RzIGhhcyBiZWVuIHJlYWNoZWQsIHRoZSBhcHByb3ByaWF0ZVxyXG4gICAgICogZXJyb3Igd2lsbCBiZSB0aHJvd24uXHJcbiAgICAgKiBAcmV0dXJucyB7YW55W119IFRoZSBuZXh0IGFwcHJvcHJpYXRlIHJlc3BvbnNlIGZvciB0aGUgcmVxdWVzdCB0aGlzIFJhbmRvbU9yZ0NhY2hlXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyBvciwgaWYgc3RhY2sgaXMgZW1wdHkgdGhyb3dzIGFuIGVycm9yLlxyXG4gICAgICogQHRocm93cyBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IgaWYgdGhlIGNhY2hlIGlzIGVtcHR5LlxyXG4gICAgICovXHJcbiAgICBnZXQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuI2Vycm9yICE9IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgdGhpcy4jZXJyb3I7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLiNzdGFjayAmJiB0aGlzLiNzdGFjay5sZW5ndGggPT0gMCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy4jcGF1c2VkKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yKCdUaGUgUmFuZG9tT3JnQ2FjaGUgc3RhY2sgJ1xyXG4gICAgICAgICAgICAgICAgICAgICsgJ2lzIGVtcHR5IGFuZCB0aGUgY2FjaGUgaXMgcGF1c2VkLiBQbGVhc2UgY2FsbCByZXN1bWUoKSB0byAnXHJcbiAgICAgICAgICAgICAgICAgICAgKyAncmVzdGFydCBwb3B1bGF0aW5nIHRoZSBjYWNoZS4nLCB0cnVlKTsgICAgICAgICAgICBcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IoJ1RoZSBSYW5kb21PcmdDYWNoZSBzdGFjayAnXHJcbiAgICAgICAgICAgICAgICAgICAgKyAnaXMgZW1wdHksIHBsZWFzZSB3YWl0IGZvciBpdCB0byByZXBvcHVsYXRlIGl0c2VsZi4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxldCBkYXRhID0gdGhpcy4jc3RhY2sucG9wKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpdCBuZWVkcyB0byBiZSByZXBvcHVsYXRlZFxyXG4gICAgICAgICAgICB0aGlzLiNyZWZyZXNoKCk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgbmV4dCByZXNwb25zZSBvciB3YWl0IHVudGlsIHRoZSBuZXh0IHZhbHVlIGlzIGF2YWlsYWJsZS4gVGhpcyBtZXRob2RcclxuICAgICAqIHdpbGwgYmxvY2sgdW50aWwgYSB2YWx1ZSBpcyBhdmFpbGFibGUuIE5vdGU6IHRoaXMgbWV0aG9kIHdpbGwgdGhyb3cgYW4gZXJyb3JcclxuICAgICAqIGlmIHRoZSBjYWNoZSBpcyBlbXB0eSBhbmQgaGFzIGJlZW4gcGF1c2VkLCBpLmUuIGlzIG5vdCBiZWluZyBwb3B1bGF0ZWQuIElmXHJcbiAgICAgKiB0aGUgY2FjaGUgd2FzIGNvbnN0cnVjdGVkIHdpdGggdW5zdWl0YWJsZSBwYXJhbWV0ZXIgdmFsdWVzIG9yIHRoZSBkYWlseSBhbGxvd2FuY2VcclxuICAgICAqIG9mIGJpdHMvcmVxdWVzdHMgaGFzIGJlZW4gcmVhY2hlZCwgdGhlIGFwcHJvcHJpYXRlIGVycm9yIHdpbGwgYWxzbyBiZSB0aHJvd24uXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxhbnlbXT59IFRoZSBuZXh0IGFwcHJvcHJpYXRlIHJlc3BvbnNlIGZvciB0aGUgcmVxdWVzdCB0aGlzXHJcbiAgICAgKiBSYW5kb21PcmdDYWNoZSByZXByZXNlbnRzLlxyXG4gICAgICogQHRocm93cyBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3IgaWYgdGhlIGNhY2hlIGlzIGVtcHR5IGFuZCBpcyBwYXVzZWQuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldE9yV2FpdCgpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsZXQgdmFsdWVzID0gdGhpcy5nZXQoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlcztcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy4jcGF1c2VkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGNhY2hlIGlzIHBhdXNlZCBhbmQgd2lsbCBub3QgcmV0dXJuIGFueSB2YWx1ZXNcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGV0IGNhY2hlZFZhbHVlcyA9IGF3YWl0IHRoaXMuI3BvcHVsYXRlKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FjaGVkVmFsdWVzID09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBUaGUgY2FjaGUgaGFzIG5vdCB5ZXQgcmVwb3B1bGF0ZWQuXHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDUwKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRPcldhaXQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIG51bWJlciBvZiByZXN1bHQgc2V0cyByZW1haW5pbmcgaW4gdGhlIGNhY2hlLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGlzIGVzc2VudGlhbGx5IHJldHVybnMgaG93IG9mdGVuIGdldCgpIG1heSBiZSBjYWxsZWQgd2l0aG91dFxyXG4gICAgICogYSBjYWNoZSByZWZpbGwuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBDdXJyZW50IG51bWJlciBvZiBjYWNoZWQgcmVzdWx0cy5cclxuICAgICAqL1xyXG4gICAgZ2V0Q2FjaGVkVmFsdWVzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNzdGFjay5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSBudW1iZXIgb2YgYml0cyB1c2VkIGJ5IHRoaXMgY2FjaGUuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBOdW1iZXIgb2YgYml0cyB1c2VkLlxyXG4gICAgICovXHJcbiAgICBnZXRCaXRzVXNlZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4jYml0c1VzZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIG51bWJlciBvZiByZXF1ZXN0cyB1c2VkIGJ5IHRoaXMgY2FjaGUuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBOdW1iZXIgb2YgcmVxdWVzdHMgdXNlZC5cclxuICAgICAqL1xyXG4gICAgZ2V0UmVxdWVzdHNVc2VkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0c1VzZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gY2hlY2sgaWYgdGhlIGNhY2hlIG5lZWRzIHRvIGJlIHJlcG9wdWxhdGVkLlxyXG4gICAgICovXHJcbiAgICAjcmVmcmVzaCA9ICgpID0+IHtcclxuICAgICAgICBpZiAodGhpcy4jYnVsa1JlcXVlc3ROdW1iZXIgPiAwICYmIHRoaXMuI3N0YWNrLmxlbmd0aCA8PSAodGhpcy4jY2FjaGVTaXplIC0gdGhpcy4jYnVsa1JlcXVlc3ROdW1iZXIpKSB7XHJcbiAgICAgICAgICAgIC8vIGJ1bGsgcmVxdWVzdHNcclxuICAgICAgICAgICAgdGhpcy4jcG9wdWxhdGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy4jYnVsa1JlcXVlc3ROdW1iZXIgPD0gMCAmJiB0aGlzLiNzdGFjay5sZW5ndGggPCB0aGlzLiNjYWNoZVNpemUpIHtcclxuICAgICAgICAgICAgLy8gaW5kaXZpZHVhbCByZXF1ZXN0c1xyXG4gICAgICAgICAgICB0aGlzLiNwb3B1bGF0ZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBhZGQgYSByZXNwb25zZSB0byB0aGUgc3RhY2suXHJcbiAgICAgKiBAcGFyYW0ge2FueVtdfSByZXNwb25zZSBUaGUgcmVzcG9uc2UgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBidWxrIFRydWUgaWYgdGhlIGNhY2hlIGlzc3VlcyBidWxrIHJlcXVlc3RzLCBmYWxzZSBvdGhlcndpc2UuXHJcbiAgICAgKi9cclxuICAgICNhZGRSZXNwb25zZSA9IChyZXNwb25zZSwgYnVsaykgPT4ge1xyXG4gICAgICAgIHRoaXMuI3JlcXVlc3RzVXNlZCsrO1xyXG4gICAgICAgIHRoaXMuI2JpdHNVc2VkICs9IHJlc3BvbnNlLnJlc3VsdC5iaXRzVXNlZDtcclxuXHJcbiAgICAgICAgaWYgKGJ1bGspIHtcclxuICAgICAgICAgICAgbGV0IGRhdGEgPSByZXNwb25zZS5yZXN1bHQucmFuZG9tLmRhdGE7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkgKz0gdGhpcy4jcmVxdWVzdE51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy4jc3RhY2sucHVzaChkYXRhLnNsaWNlKGksIGkgKyB0aGlzLiNyZXF1ZXN0TnVtYmVyKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLiNzdGFjay5wdXNoKHJlc3BvbnNlLnJlc3VsdC5yYW5kb20uZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3Qge1xyXG4gICAgUmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3IsXHJcbiAgICBSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IsXHJcbiAgICBSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnSlNPTlJQQ0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yLFxyXG4gICAgUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IsXHJcbiAgICBSYW5kb21PcmdTZW5kVGltZW91dEVycm9yXHJcbn0gPSByZXF1aXJlKCcuL1JhbmRvbU9yZ0Vycm9ycy5qcycpO1xyXG5jb25zdCBSYW5kb21PcmdDYWNoZSA9IHJlcXVpcmUoJy4vUmFuZG9tT3JnQ2FjaGUuanMnKTtcclxuLyogbm9kZS1pbXBvcnQgKi9cclxuY29uc3QgWE1MSHR0cFJlcXVlc3QgPSByZXF1aXJlKCd4bWxodHRwcmVxdWVzdCcpLlhNTEh0dHBSZXF1ZXN0O1xyXG4vKiBlbmQtbm9kZS1pbXBvcnQgKi9cclxuXHJcbi8qKlxyXG4gKiBSYW5kb21PcmdDbGllbnQgbWFpbiBjbGFzcyB0aHJvdWdoIHdoaWNoIEFQSSBmdW5jdGlvbnMgYXJlIGFjY2Vzc2VkLlxyXG4gKiBcclxuICogVGhpcyBjbGFzcyBwcm92aWRlcyBhY2Nlc3MgdG8gYm90aCB0aGUgc2lnbmVkIGFuZCB1bnNpZ25lZCBtZXRob2RzIG9mIHRoZVxyXG4gKiBSQU5ET00uT1JHIEFQSS5cclxuICogXHJcbiAqIFRoZSBjbGFzcyBhbHNvIHByb3ZpZGVzIGFjY2VzcyB0byB0aGUgY3JlYXRpb24gb2YgYSBjb252ZW5pZW5jZSBjbGFzcywgUmFuZG9tT3JnQ2FjaGUsXHJcbiAqIGZvciBwcmVjYWNoaW5nIEFQSSByZXNwb25zZXMgd2hlbiB0aGUgcmVxdWVzdCBpcyBrbm93biBpbiBhZHZhbmNlLlxyXG4gKiBcclxuICogVGhpcyBjbGFzcyB3aWxsIG9ubHkgYWxsb3cgdGhlIGNyZWF0aW9uIG9mIG9uZSBpbnN0YW5jZSBwZXIgQVBJIGtleS4gSWYgYW5cclxuICogaW5zdGFuY2Ugb2YgdGhpcyBjbGFzcyBhbHJlYWR5IGV4aXN0cyBmb3IgYSBnaXZlbiBrZXksIHRoYXQgaW5zdGFuY2Ugd2lsbCBiZVxyXG4gKiByZXR1cm5lZCBpbnN0ZWFkIG9mIGEgbmV3IGluc3RhbmNlLlxyXG4gKiBcclxuICogVGhpcyBjbGFzcyBvYmV5cyBtb3N0IG9mIHRoZSBndWlkZWxpbmVzIHNldCBmb3J0aCBpbiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzRcclxuICogQWxsIHJlcXVlc3RzIHJlc3BlY3QgdGhlIHNlcnZlcidzIGFkdmlzb3J5RGVsYXkgcmV0dXJuZWQgaW4gYW55IHJlc3BvbnNlcywgb3IgdXNlXHJcbiAqIERFRkFVTFRfREVMQVkgaWYgbm8gYWR2aXNvcnlEZWxheSBpcyByZXR1cm5lZC4gSWYgdGhlIHN1cHBsaWVkIEFQSSBrZXkgaXMgcGF1c2VkLCBpLmUuLFxyXG4gKiBoYXMgZXhjZWVkZWQgaXRzIGRhaWx5IGJpdC9yZXF1ZXN0IGFsbG93YW5jZSwgdGhpcyBpbXBsZW1lbnRhdGlvbiB3aWxsIGJhY2sgb2ZmIHVudGlsXHJcbiAqIG1pZG5pZ2h0IFVUQy5cclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gY2xhc3MgUmFuZG9tT3JnQ2xpZW50IHtcclxuICAgIC8vIEJhc2ljIEFQSVxyXG4gICAgc3RhdGljICNJTlRFR0VSX01FVEhPRCA9ICdnZW5lcmF0ZUludGVnZXJzJztcclxuICAgIHN0YXRpYyAjSU5URUdFUl9TRVFVRU5DRV9NRVRIT0QgPSAnZ2VuZXJhdGVJbnRlZ2VyU2VxdWVuY2VzJztcclxuICAgIHN0YXRpYyAjREVDSU1BTF9GUkFDVElPTl9NRVRIT0QgPSAnZ2VuZXJhdGVEZWNpbWFsRnJhY3Rpb25zJztcclxuICAgIHN0YXRpYyAjR0FVU1NJQU5fTUVUSE9EID0gJ2dlbmVyYXRlR2F1c3NpYW5zJztcclxuICAgIHN0YXRpYyAjU1RSSU5HX01FVEhPRCA9ICdnZW5lcmF0ZVN0cmluZ3MnO1xyXG4gICAgc3RhdGljICNVVUlEX01FVEhPRCA9ICdnZW5lcmF0ZVVVSURzJztcclxuICAgIHN0YXRpYyAjQkxPQl9NRVRIT0QgPSAnZ2VuZXJhdGVCbG9icyc7XHJcbiAgICBzdGF0aWMgI0dFVF9VU0FHRV9NRVRIT0QgPSAnZ2V0VXNhZ2UnO1xyXG5cclxuICAgIC8vIFNpZ25lZCBBUElcclxuICAgIHN0YXRpYyAjU0lHTkVEX0lOVEVHRVJfTUVUSE9EID0gJ2dlbmVyYXRlU2lnbmVkSW50ZWdlcnMnO1xyXG4gICAgc3RhdGljICNTSUdORURfSU5URUdFUl9TRVFVRU5DRV9NRVRIT0QgPSAnZ2VuZXJhdGVTaWduZWRJbnRlZ2VyU2VxdWVuY2VzJztcclxuICAgIHN0YXRpYyAjU0lHTkVEX0RFQ0lNQUxfRlJBQ1RJT05fTUVUSE9EID0gJ2dlbmVyYXRlU2lnbmVkRGVjaW1hbEZyYWN0aW9ucyc7XHJcbiAgICBzdGF0aWMgI1NJR05FRF9HQVVTU0lBTl9NRVRIT0QgPSAnZ2VuZXJhdGVTaWduZWRHYXVzc2lhbnMnO1xyXG4gICAgc3RhdGljICNTSUdORURfU1RSSU5HX01FVEhPRCA9ICdnZW5lcmF0ZVNpZ25lZFN0cmluZ3MnO1xyXG4gICAgc3RhdGljICNTSUdORURfVVVJRF9NRVRIT0QgPSAnZ2VuZXJhdGVTaWduZWRVVUlEcyc7XHJcbiAgICBzdGF0aWMgI1NJR05FRF9CTE9CX01FVEhPRCA9ICdnZW5lcmF0ZVNpZ25lZEJsb2JzJztcclxuICAgIHN0YXRpYyAjR0VUX1JFU1VMVF9NRVRIT0QgPSAnZ2V0UmVzdWx0JztcclxuICAgIHN0YXRpYyAjQ1JFQVRFX1RJQ0tFVF9NRVRIT0QgPSAnY3JlYXRlVGlja2V0cyc7XHJcbiAgICBzdGF0aWMgI0xJU1RfVElDS0VUX01FVEhPRCA9ICdsaXN0VGlja2V0cyc7XHJcbiAgICBzdGF0aWMgI0dFVF9USUNLRVRfTUVUSE9EID0gJ2dldFRpY2tldCc7XHJcbiAgICBzdGF0aWMgI1ZFUklGWV9TSUdOQVRVUkVfTUVUSE9EID0gJ3ZlcmlmeVNpZ25hdHVyZSc7XHJcblxyXG4gICAgLy8gQmxvYiBmb3JtYXQgbGl0ZXJhbHNcclxuICAgIC8qKiBCbG9iIGZvcm1hdCBsaXRlcmFsLCBiYXNlNjQgZW5jb2RpbmcgKGRlZmF1bHQpLiAqL1xyXG4gICAgc3RhdGljIEJMT0JfRk9STUFUX0JBU0U2NCA9ICdiYXNlNjQnO1xyXG4gICAgLyoqIEJsb2IgZm9ybWF0IGxpdGVyYWwsIGhleCBlbmNvZGluZy4gKi9cclxuICAgIHN0YXRpYyBCTE9CX0ZPUk1BVF9IRVggPSAnaGV4JztcclxuXHJcbiAgICAvLyBEZWZhdWx0IHZhbHVlc1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSByZXBsYWNlbWVudCBwYXJhbWV0ZXIgKHRydWUpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfUkVQTEFDRU1FTlQgPSB0cnVlO1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSBiYXNlIHBhcmFtZXRlciAoMTApLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfQkFTRSA9IDEwO1xyXG4gICAgLyoqIERlZmF1bHQgdmFsdWUgZm9yIHRoZSB1c2VyRGF0YSBwYXJhbWV0ZXIgKG51bGwpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfVVNFUl9EQVRBID0gbnVsbDtcclxuICAgIC8qKiBEZWZhdWx0IHZhbHVlIGZvciB0aGUgdGlja2V0SWQgcGFyYW1ldGVyIChudWxsKS4gKi9cclxuICAgIHN0YXRpYyBERUZBVUxUX1RJQ0tFVF9JRCA9IG51bGw7XHJcbiAgICAvKiogRGVmYXVsdCB2YWx1ZSBmb3IgdGhlIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gcGFyYW1ldGVyIChudWxsKS4gKi9cclxuICAgIHN0YXRpYyBERUZBVUxUX1BSRUdFTkVSQVRFRF9SQU5ET01JWkFUSU9OID0gbnVsbDtcclxuICAgIC8qKiBEZWZhdWx0IHZhbHVlIGZvciB0aGUgbGljZW5zZURhdGEgcGFyYW1ldGVyIChudWxsKS4gKi9cclxuICAgIHN0YXRpYyBERUZBVUxUX0xJQ0VOU0VfREFUQSA9IG51bGw7XHJcblxyXG4gICAgLyoqIFNpemUgb2YgYSBzaW5nbGUgVVVJRCBpbiBiaXRzLiAqL1xyXG4gICAgc3RhdGljIFVVSURfU0laRSA9IDEyMjtcclxuICAgIC8qKiBEZWZhdWx0IHZhbHVlIGZvciB0aGUgYmxvY2tpbmdUaW1lb3V0IHBhcmFtZXRlciAoMSBkYXkpLiAqL1xyXG4gICAgc3RhdGljIERFRkFVTFRfQkxPQ0tJTkdfVElNRU9VVCA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcbiAgICAvKiogRGVmYXVsdCB2YWx1ZSBmb3IgdGhlIGh0dHBUaW1lb3V0IHBhcmFtZXRlciAoMiBtaW51dGVzKS4gKi9cclxuICAgIHN0YXRpYyBERUZBVUxUX0hUVFBfVElNRU9VVCA9IDEyMCAqIDEwMDA7XHJcbiAgICAvKiogTWF4aW11bSBudW1iZXIgb2YgY2hhcmFjdGVycyBhbGxvd2VkIGluIGEgc2lnbmF0dXJlIHZlcmZpY2lhdGlvbiBVUkwuICovXHJcbiAgICBzdGF0aWMgTUFYX1VSTF9MRU5HVEggPSAyMDQ2O1xyXG5cclxuICAgIC8vIERlZmF1bHQgYmFjay1vZmYgdG8gdXNlIGlmIG5vIGFkdmlzb3J5RGVsYXkgYmFjay1vZmYgc3VwcGxpZWQgYnkgc2VydmVyICgxIHNlY29uZClcclxuICAgIHN0YXRpYyAjREVGQVVMVF9ERUxBWSA9IDEqMTAwMDtcclxuXHJcbiAgICAvLyBPbiByZXF1ZXN0IGZldGNoIGZyZXNoIGFsbG93YW5jZSBzdGF0ZSBpZiBjdXJyZW50IHN0YXRlIGRhdGEgaXMgb2xkZXIgdGhhblxyXG4gICAgLy8gdGhpcyB2YWx1ZSAoMSBob3VyKS5cclxuICAgIHN0YXRpYyAjQUxMT1dBTkNFX1NUQVRFX1JFRlJFU0hfU0VDT05EUyA9IDM2MDAgKiAxMDAwO1xyXG5cclxuICAgIC8vIE1haW50YWlucyB1c2FnZSBzdGF0aXN0aWNzIGZyb20gc2VydmVyLlxyXG4gICAgI2JpdHNMZWZ0ID0gLTE7XHJcbiAgICAjcmVxdWVzdHNMZWZ0ID0gLTE7XHJcblxyXG4gICAgLy8gQmFjay1vZmYgaW5mbyBmb3Igd2hlbiB0aGUgQVBJIGtleSBpcyBkZXRlY3RlZCBhcyBub3QgcnVubmluZywgcHJvYmFibHlcclxuICAgIC8vIGJlY2F1c2UgdGhlIGtleSBoYXMgZXhjZWVkZWQgaXRzIGRhaWx5IHVzYWdlIGxpbWl0LiBCYWNrLW9mZiBydW5zIHVudGlsXHJcbiAgICAvLyBtaWRuaWdodCBVVEMuXHJcbiAgICAjYmFja29mZiA9IC0xO1xyXG4gICAgI2JhY2tvZmZFcnJvciA9ICcnO1xyXG5cclxuICAgICNhcGlLZXkgPSAnJztcclxuICAgICNibG9ja2luZ1RpbWVvdXQgPSBSYW5kb21PcmdDbGllbnQuREVGQVVMVF9CTE9DS0lOR19USU1FT1VUO1xyXG4gICAgI2h0dHBUaW1lb3V0ID0gUmFuZG9tT3JnQ2xpZW50LkRFRkFVTFRfSFRUUF9USU1FT1VUO1xyXG5cclxuICAgIC8vIE1haW50YWluIGluZm8gdG8gb2JleSBzZXJ2ZXIgYWR2aXNvcnkgZGVsYXlcclxuICAgICNhZHZpc29yeURlbGF5ID0gMDtcclxuICAgICNsYXN0UmVzcG9uc2VSZWNlaXZlZFRpbWUgPSAwO1xyXG5cclxuICAgIC8vIE1haW50YWlucyBhIGRpY3Rpb25hcnkgb2YgQVBJIGtleXMgYW5kIHRoZWlyIGluc3RhbmNlcy5cclxuICAgIHN0YXRpYyAja2V5SW5kZXhlZEluc3RhbmNlcyA9IHt9O1xyXG5cclxuICAgIHN0YXRpYyAjRVJST1JfQ09ERVMgPSBbIDEwMCwgMTAxLCAyMDAsIDIwMSwgMjAyLCAyMDMsIDIwNCwgMzAwLFxyXG4gICAgICAgIDMwMSwgMzAyLCAzMDMsIDMwNCwgMzA1LCAzMDYsIDMwNywgNDAwLCA0MDEsIDQwMiwgNDAzLCA0MDQsXHJcbiAgICAgICAgNDA1LCA0MjAsIDQyMSwgNDIyLCA0MjMsIDQyNCwgNDI1LCA1MDAsIDMyMDAwIF07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3Rvci4gRW5zdXJlcyBvbmx5IG9uZSBpbnN0YW5jZSBvZiBSYW5kb21PcmdDbGllbnQgZXhpc3RzIHBlciBBUElcclxuICAgICAqIGtleS4gQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBpZiB0aGUgc3VwcGxpZWQga2V5IGlzbid0IGFscmVhZHkga25vd24sXHJcbiAgICAgKiBvdGhlcndpc2UgcmV0dXJucyB0aGUgcHJldmlvdXNseSBpbnN0YW50aWF0ZWQgb25lLlxyXG4gICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYXBpS2V5IEFQSSBrZXkgb2YgaW5zdGFuY2UgdG8gY3JlYXRlL2ZpbmQsIG9idGFpbmVkIGZyb21cclxuICAgICAqICAgICBSQU5ET00uT1JHLCBzZWUgaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9hcGkta2V5c1xyXG4gICAgICogQHBhcmFtIHt7YmxvY2tpbmdUaW1lb3V0PzogbnVtYmVyLCBodHRwVGltZW91dD86IG51bWJlcn19IG9wdGlvbnMgQW4gb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYmxvY2tpbmdUaW1lb3V0ID0gMjQgKiA2MCAqIDYwICogMTAwMF0gTWF4aW11bVxyXG4gICAgICogICAgIHRpbWUgaW4gbWlsbGlzZWNvbmRzIHRvIHdhaXQgYmVmb3JlIGJlaW5nIGFsbG93ZWQgdG8gc2VuZCBhIHJlcXVlc3QuXHJcbiAgICAgKiAgICAgTm90ZSB0aGlzIGlzIGEgaGludCBub3QgYSBndWFyYW50ZWUuIFRoZSBhZHZpc29yeSBkZWxheSBmcm9tIHNlcnZlclxyXG4gICAgICogICAgIG11c3QgYWx3YXlzIGJlIG9iZXllZC4gU3VwcGx5IGEgdmFsdWUgb2YgLTEgdG8gYWxsb3cgYmxvY2tpbmcgZm9yZXZlclxyXG4gICAgICogICAgIChkZWZhdWx0IDI0ICogNjAgKiA2MCAqIDEwMDAsIGkuZS4sIDEgZGF5KS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5odHRwVGltZW91dCA9IDEyMCAqIDEwMDBdIE1heGltdW0gdGltZSBpblxyXG4gICAgICogICAgIG1pbGxpc2Vjb25kcyB0byB3YWl0IGZvciB0aGUgc2VydmVyIHJlc3BvbnNlIHRvIGEgcmVxdWVzdCAoZGVmYXVsdFxyXG4gICAgICogICAgIDEyMCoxMDAwKS5cclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IoYXBpS2V5LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBpZiAoUmFuZG9tT3JnQ2xpZW50LiNrZXlJbmRleGVkSW5zdGFuY2VzICYmIFJhbmRvbU9yZ0NsaWVudC4ja2V5SW5kZXhlZEluc3RhbmNlc1thcGlLZXldKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBSYW5kb21PcmdDbGllbnQuI2tleUluZGV4ZWRJbnN0YW5jZXNbYXBpS2V5XTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLiNhcGlLZXkgPSBhcGlLZXk7XHJcbiAgICAgICAgICAgIHRoaXMuI2Jsb2NraW5nVGltZW91dCA9IG9wdGlvbnMuYmxvY2tpbmdUaW1lb3V0IHx8IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcbiAgICAgICAgICAgIHRoaXMuI2h0dHBUaW1lb3V0ID0gb3B0aW9ucy5odHRwVGltZW91dCB8fCAxMjAgKiAxMDAwO1xyXG5cclxuICAgICAgICAgICAgUmFuZG9tT3JnQ2xpZW50LiNrZXlJbmRleGVkSW5zdGFuY2VzW2FwaUtleV0gPSB0aGlzO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBCYXNpYyBBUElcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRydWUgcmFuZG9tIGludGVnZXJzIHdpdGhpbiBhIHVzZXItZGVmaW5lZFxyXG4gICAgICogcmFuZ2UgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9iYXNpYyNnZW5lcmF0ZUludGVnZXJzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHJhbmRvbSBpbnRlZ2VycyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW5cclxuICAgICAqICAgICB0aGUgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaCB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU5LDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IFRoZSB1cHBlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2ggdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlOSwxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBiYXNlPzogbnVtYmVyLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzpcclxuICAgICAqICAgICBPYmplY3R9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmdcclxuICAgICAqICAgICBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXBsYWNlbWVudD10cnVlXSBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbnVtYmVyc1xyXG4gICAgICogICAgIG1heSBjb250YWluIGR1cGxpY2F0ZSB2YWx1ZXMsIG90aGVyd2lzZSB0aGUgbnVtYmVycyB3aWxsIGFsbCBiZSB1bmlxdWVcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5iYXNlPTEwXSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5XHJcbiAgICAgKiAgICAgdGhlIG51bWJlcnMuIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYgKGRlZmF1bHQgMTApLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHJldHVybnMgeyhQcm9taXNlPG51bWJlcltdPnxQcm9taXNlPHN0cmluZ1tdPil9IEEgUHJvbWlzZSB3aGljaCwgaWZcclxuICAgICAqICAgICByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnMuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKiAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVJbnRlZ2VycyhuLCBtaW4sIG1heCwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNpbnRlZ2VyUmVxdWVzdChuLCBtaW4sIG1heCwgb3B0aW9ucyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RCYXNpYyh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0cyBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBpbnRlZ2VyIHNlcXVlbmNlcyB3aXRoaW4gYVxyXG4gICAgICogdXNlci1kZWZpbmVkIHJhbmdlIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvYmFzaWMjZ2VuZXJhdGVJbnRlZ2VyU2VxdWVuY2VzXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSBhcnJheXMgb2YgcmFuZG9tIGludGVnZXJzIHlvdSBuZWVkLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxZTNdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gbGVuZ3RoIFRoZSBsZW5ndGggb2YgZWFjaCBhcnJheSBvZiByYW5kb21cclxuICAgICAqICAgICBpbnRlZ2VycyByZXF1ZXN0ZWQuIEZvciB1bmlmb3JtIHNlcXVlbmNlcywgbGVuZ3RoIG11c3QgYmUgYW4gaW50ZWdlclxyXG4gICAgICogICAgIGluIHRoZSBbMSwgMWU0XSByYW5nZS4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIGxlbmd0aCBjYW4gYmUgYW4gYXJyYXlcclxuICAgICAqICAgICB3aXRoIG4gaW50ZWdlcnMsIGVhY2ggc3BlY2lmeWluZyB0aGUgbGVuZ3RoIG9mIHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkXHJcbiAgICAgKiAgICAgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbGVuZ3RoIG11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLCAxZTRdIHJhbmdlIGFuZCB0aGUgdG90YWwgc3VtIG9mIGFsbCB0aGUgbGVuZ3RocyBtdXN0IGJlIGluIHRoZVxyXG4gICAgICogICAgIFsxLCAxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gbWluIFRoZSBsb3dlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2hcclxuICAgICAqICAgICB0aGUgcmFuZG9tIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIEZvciB1bmlmb3JtIHNlcXVlbmNlcywgbWluIG11c3QgYmVcclxuICAgICAqICAgICBhbiBpbnRlZ2VyIGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIG1pbiBjYW5cclxuICAgICAqICAgICBiZSBhbiBhcnJheSB3aXRoIG4gaW50ZWdlcnMsIGVhY2ggc3BlY2lmeWluZyB0aGUgbG93ZXIgYm91bmRhcnkgb2YgdGhlXHJcbiAgICAgKiAgICAgc2VxdWVuY2UgaWRlbnRpZmllZCBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBtaW4gbXVzdFxyXG4gICAgICogICAgIGJlIHdpdGhpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBtYXggVGhlIHVwcGVyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaFxyXG4gICAgICogICAgIHRoZSByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBtYXggbXVzdCBiZVxyXG4gICAgICogICAgIGFuIGludGVnZXIgaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbWF4IGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSB1cHBlciBib3VuZGFyeSBvZiB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIG1heCBtdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3JlcGxhY2VtZW50PzogYm9vbGVhbnxib29sZWFuW10sIGJhc2U/OiBudW1iZXJ8bnVtYmVyW10sXHJcbiAgICAgKiAgICAgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdH19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWluc1xyXG4gICAgICogICAgIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0geyhib29sZWFufGJvb2xlYW5bXSl9IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlXHJcbiAgICAgKiAgICAgcmVzdWx0aW5nIG51bWJlcnMgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzXHJcbiAgICAgKiAgICAgd2lsbCBhbGwgYmUgdW5pcXVlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgcmVwbGFjZW1lbnQgY2FuIGJlIGFuIGFycmF5XHJcbiAgICAgKiAgICAgd2l0aCBuIGJvb2xlYW4gdmFsdWVzLCBlYWNoIHNwZWNpZnlpbmcgd2hldGhlciB0aGUgc2VxdWVuY2UgaWRlbnRpZmllZFxyXG4gICAgICogICAgIGJ5IGl0cyBpbmRleCB3aWxsIGJlIGNyZWF0ZWQgd2l0aCAodHJ1ZSkgb3Igd2l0aG91dCAoZmFsc2UpIHJlcGxhY2VtZW50XHJcbiAgICAgKiAgICAgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBbb3B0aW9ucy5iYXNlPTEwXSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZFxyXG4gICAgICogICAgIHRvIGRpc3BsYXkgdGhlIG51bWJlcnMuIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYuIEZvciBtdWx0aWZvcm1cclxuICAgICAqICAgICBzZXF1ZW5jZXMsIGJhc2UgY2FuIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VyIHZhbHVlcyB0YWtlbiBmcm9tIHRoZVxyXG4gICAgICogICAgIHNhbWUgc2V0LCBlYWNoIHNwZWNpZnlpbmcgdGhlIGJhc2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gZGlzcGxheSB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleCAoZGVmYXVsdCAxMCkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7KFByb21pc2U8bnVtYmVyW11bXT58UHJvbWlzZTxzdHJpbmdbXVtdPil9IEEgUHJvbWlzZSB3aGljaCwgaWZcclxuICAgICAqICAgICByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gaW50ZWdlclxyXG4gICAgICogICAgIHNlcXVlbmNlcy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2VuZXJhdGVJbnRlZ2VyU2VxdWVuY2VzKG4sIGxlbmd0aCwgbWluLCBtYXgsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jaW50ZWdlclNlcXVlbmNlUmVxdWVzdChuLCBsZW5ndGgsIG1pbiwgbWF4LCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGEgbGlzdCAoc2l6ZSBuKSBvZiB0cnVlIHJhbmRvbSBkZWNpbWFsIGZyYWN0aW9ucyxcclxuICAgICAqIGZyb20gYSB1bmlmb3JtIGRpc3RyaWJ1dGlvbiBhY3Jvc3MgdGhlIFswLDFdIGludGVydmFsIHdpdGggYSB1c2VyLWRlZmluZWRcclxuICAgICAqIG51bWJlciBvZiBkZWNpbWFsIHBsYWNlcyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Jhc2ljI2dlbmVyYXRlRGVjaW1hbEZyYWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zIHlvdSBuZWVkLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlY2ltYWxQbGFjZXMgVGhlIG51bWJlciBvZiBkZWNpbWFsIHBsYWNlcyB0byB1c2UuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDIwXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3JlcGxhY2VtZW50PzogYm9vbGVhbiwgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdH19IG9wdGlvbnNcclxuICAgICAqICAgICBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBudW1iZXJzXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzIHdpbGwgYWxsIGJlIHVuaXF1ZVxyXG4gICAgICogICAgIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyW10+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIGFycmF5IG9mIHRydWUgcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZURlY2ltYWxGcmFjdGlvbnMobiwgZGVjaW1hbFBsYWNlcywgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNkZWNpbWFsRnJhY3Rpb25SZXF1ZXN0KG4sIGRlY2ltYWxQbGFjZXMsIG9wdGlvbnMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLiNleHRyYWN0QmFzaWModGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYW5kIHJldHVybnMgYSBsaXN0IChzaXplIG4pIG9mIHRydWUgcmFuZG9tIG51bWJlcnMgZnJvbSBhXHJcbiAgICAgKiBHYXVzc2lhbiBkaXN0cmlidXRpb24gKGFsc28ga25vd24gYXMgYSBub3JtYWwgZGlzdHJpYnV0aW9uKS5cclxuICAgICAqIFxyXG4gICAgICogVGhlIGZvcm0gdXNlcyBhIEJveC1NdWxsZXIgVHJhbnNmb3JtIHRvIGdlbmVyYXRlIHRoZSBHYXVzc2lhbiBkaXN0cmlidXRpb25cclxuICAgICAqIGZyb20gdW5pZm9ybWx5IGRpc3RyaWJ1dGVkIG51bWJlcnMuXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9iYXNpYyNnZW5lcmF0ZUdhdXNzaWFuc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIG51bWJlcnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWVhbiBUaGUgZGlzdHJpYnV0aW9uJ3MgbWVhbi4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWy0xZTYsMWU2XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFuZGFyZERldmlhdGlvbiBUaGUgZGlzdHJpYnV0aW9uJ3Mgc3RhbmRhcmQgZGV2aWF0aW9uLlxyXG4gICAgICogICAgIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlNiwxZTZdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpZ25pZmljYW50RGlnaXRzIFRoZSBudW1iZXIgb2Ygc2lnbmlmaWNhbnQgZGlnaXRzIHRvIHVzZS5cclxuICAgICAqICAgICBNdXN0IGJlIHdpdGhpbiB0aGUgWzIsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdH19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heVxyXG4gICAgICogICAgIGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXJbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gbnVtYmVycyBmcm9tIGEgR2F1c3NpYW4gZGlzdHJpYnV0aW9uLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZUdhdXNzaWFucyhuLCBtZWFuLCBzdGFuZGFyZERldmlhdGlvbiwgc2lnbmlmaWNhbnREaWdpdHMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2F1c3NpYW5SZXF1ZXN0KG4sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLFxyXG4gICAgICAgICAgICBzaWduaWZpY2FudERpZ2l0cywgb3B0aW9ucyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RCYXNpYyh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0cyBhbmQgcmV0dXJucyBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gdW5pY29kZSBzdHJpbmdzIGZyb21cclxuICAgICAqIHRoZSBzZXJ2ZXIuIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Jhc2ljI2dlbmVyYXRlU3RyaW5nc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIHN0cmluZ3MgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVuZ3RoIFRoZSBsZW5ndGggb2YgZWFjaCBzdHJpbmcuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDIwXSByYW5nZS4gQWxsIHN0cmluZ3Mgd2lsbCBiZSBvZiB0aGUgc2FtZSBsZW5ndGguXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVycyBBIHN0cmluZyB0aGF0IGNvbnRhaW5zIHRoZSBzZXQgb2YgY2hhcmFjdGVyc1xyXG4gICAgICogICAgIHRoYXQgYXJlIGFsbG93ZWQgdG8gb2NjdXIgaW4gdGhlIHJhbmRvbSBzdHJpbmdzLiBUaGUgbWF4aW11bSBudW1iZXJcclxuICAgICAqICAgICBvZiBjaGFyYWN0ZXJzIGlzIDgwLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0fX0gb3B0aW9uc1xyXG4gICAgICogICAgIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbnMgYW55IG9mIHRoZSBmb2xsb3dpbmcgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIHN0cmluZ3Mgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIGxpc3RcclxuICAgICAqICAgICBvZiBzdHJpbmdzIG1heSBjb250YWluIGR1cGxpY2F0ZXMsIG90aGVyd2lzZSB0aGUgc3RyaW5ncyB3aWxsIGFsbCBiZVxyXG4gICAgICogICAgIHVuaXF1ZSAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZ1tdPn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyBhbiBhcnJheSBvZiB0cnVlIHJhbmRvbSBzdHJpbmdzLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZVN0cmluZ3MobiwgbGVuZ3RoLCBjaGFyYWN0ZXJzLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI3N0cmluZ1JlcXVlc3QobiwgbGVuZ3RoLCBjaGFyYWN0ZXJzLCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGEgbGlzdCAoc2l6ZSBuKSBvZiB2ZXJzaW9uIDQgdHJ1ZSByYW5kb20gVW5pdmVyc2FsbHlcclxuICAgICAqIFVuaXF1ZSBJRGVudGlmaWVycyAoVVVJRHMpIGluIGFjY29yZGFuY2Ugd2l0aCBzZWN0aW9uIDQuNCBvZiBSRkMgNDEyMixcclxuICAgICAqIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvYmFzaWMjZ2VuZXJhdGVVVUlEc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIFVVSURzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxZTNdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdH19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heVxyXG4gICAgICogICAgIGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmdbXT59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgYW4gYXJyYXkgb2YgdHJ1ZSByYW5kb20gVVVJRHMuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlVVVJRHMobiwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNVVUlEUmVxdWVzdChuLCBvcHRpb25zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdEJhc2ljKHRoaXMuI3NlbmRSZXF1ZXN0KHJlcXVlc3QpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlcXVlc3RzIGFuZCByZXR1cm5zIGEgbGlzdCAoc2l6ZSBuKSBvZiBCaW5hcnkgTGFyZ2UgT0JqZWN0cyAoQkxPQnMpXHJcbiAgICAgKiBhcyB1bmljb2RlIHN0cmluZ3MgY29udGFpbmluZyB0cnVlIHJhbmRvbSBkYXRhIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvYmFzaWMjZ2VuZXJhdGVCbG9ic1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGJsb2JzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxMDBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgVGhlIHNpemUgb2YgZWFjaCBibG9iLCBtZWFzdXJlZCBpbiBiaXRzLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxMDQ4NTc2XSByYW5nZSBhbmQgbXVzdCBiZSBkaXZpc2libGUgYnkgOC5cclxuICAgICAqIEBwYXJhbSB7e2Zvcm1hdD86IHN0cmluZywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdH19IG9wdGlvbnNcclxuICAgICAqICAgICBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZm9ybWF0PSdiYXNlNjQnXSBTcGVjaWZpZXMgdGhlIGZvcm1hdCBpbiB3aGljaFxyXG4gICAgICogICAgIHRoZSBibG9icyB3aWxsIGJlIHJldHVybmVkLiBWYWx1ZXMgYWxsb3dlZCBhcmUgJ2Jhc2U2NCcgYW5kICdoZXgnXHJcbiAgICAgKiAgICAgKGRlZmF1bHQgJ2Jhc2U2NCcpLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyW10+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIGFycmF5IG9mIHRydWUgcmFuZG9tIGJsb2JzIGFzIHN0cmluZ3MuXHJcbiAgICAgKiBAc2VlIHtAbGluayBSYW5kb21PcmdDbGllbnQjQkxPQl9GT1JNQVRfQkFTRTY0fSBmb3IgJ2Jhc2U2NCcgKGRlZmF1bHQpLlxyXG4gICAgICogQHNlZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I0JMT0JfRk9STUFUX0hFWH0gZm9yICdoZXgnLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZUJsb2JzKG4sIHNpemUsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jYmxvYlJlcXVlc3Qobiwgc2l6ZSwgb3B0aW9ucyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RCYXNpYyh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU0lHTkVEIEFQSVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdHMgYSBsaXN0IChzaXplIG4pIG9mIHRydWUgcmFuZG9tIGludGVnZXJzIHdpdGhpbiBhIHVzZXItZGVmaW5lZFxyXG4gICAgICogcmFuZ2UgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBpbnRlZ2VyIGxpc3QgbWFwcGVkIHRvICdkYXRhJywgdGhlIG9yaWdpbmFsIHJlc3BvbnNlIG1hcHBlZFxyXG4gICAgICogdG8gJ3JhbmRvbScsIGFuZCB0aGUgcmVzcG9uc2UncyBzaWduYXR1cmUgbWFwcGVkIHRvICdzaWduYXR1cmUnLlxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dlbmVyYXRlU2lnbmVkSW50ZWdlcnNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBpbnRlZ2VycyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWU0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaCB0aGVcclxuICAgICAqICAgICByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU5LDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IFRoZSB1cHBlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2ggdGhlXHJcbiAgICAgKiAgICAgcmFuZG9tIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlOSwxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBiYXNlPzogbnVtYmVyLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzpcclxuICAgICAqICAgICBPYmplY3QsIGxpY2Vuc2VEYXRhPzogT2JqZWN0LCB1c2VyRGF0YT86IE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86XHJcbiAgICAgKiAgICAgc3RyaW5nfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nXHJcbiAgICAgKiAgICAgb3B0aW9uYWwgcGFyYW1ldGVyczpcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVwbGFjZW1lbnQ9dHJ1ZV0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIG51bWJlcnNcclxuICAgICAqICAgICBtYXkgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnMgd2lsbCBhbGwgYmUgdW5pcXVlXHJcbiAgICAgKiAgICAgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYmFzZT0xMF0gVGhlIGJhc2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gZGlzcGxheVxyXG4gICAgICogICAgIHRoZSBudW1iZXJzLiBWYWx1ZXMgYWxsb3dlZCBhcmUgMiwgOCwgMTAgYW5kIDE2IChkZWZhdWx0IDEwKS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5wcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3RcclxuICAgICAqICAgICB3aGljaCBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IHRoYXQgdGhlIHJhbmRvbSB2YWx1ZXMgc2hvdWxkIGJlXHJcbiAgICAgKiAgICAgZ2VuZXJhdGVkIGZyb20gYSBwcmVnZW5lcmF0ZWQsIGhpc3RvcmljYWwgcmFuZG9taXphdGlvbiBpbnN0ZWFkIG9mIGFcclxuICAgICAqICAgICBvbmUtdGltZSBvbi10aGUtZmx5IHJhbmRvbWl6YXRpb24uIFRoZXJlIGFyZSB0aHJlZSBwb3NzaWJsZSBjYXNlczpcclxuICAgICAqICogKipudWxsKio6IFRoZSBzdGFuZGFyZCB3YXkgb2YgY2FsbGluZyBmb3IgcmFuZG9tIHZhbHVlcywgaS5lLnRydWVcclxuICAgICAqICAgICAgIHJhbmRvbW5lc3MgaXMgZ2VuZXJhdGVkIGFuZCBkaXNjYXJkZWQgYWZ0ZXJ3YXJkcy5cclxuICAgICAqICogKipkYXRlKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBnZW5lcmF0ZWQgb24gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGRhdGUgKHBhc3Qgb3IgcHJlc2VudCwgZm9ybWF0OiB7ICdkYXRlJywgJ1lZWVktTU0tREQnIH0pLlxyXG4gICAgICogKiAqKmlkKio6IFJBTkRPTS5PUkcgdXNlcyBoaXN0b3JpY2FsIHRydWUgcmFuZG9tbmVzcyBkZXJpdmVkIGZyb20gdGhlXHJcbiAgICAgKiAgICAgICBjb3JyZXNwb25kaW5nIGlkZW50aWZpZXIgaW4gYSBkZXRlcm1pbmlzdGljIG1hbm5lci4gRm9ybWF0OiB7ICdpZCcsXHJcbiAgICAgKiAgICAgICAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyB9IHdoZXJlICdQRVJTSVNURU5ULUlERU5USUZJRVInIGlzIGEgc3RyaW5nXHJcbiAgICAgKiAgICAgICB3aXRoIGxlbmd0aCBpbiB0aGUgWzEsIDY0XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5saWNlbnNlRGF0YT1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0IHdoaWNoIGFsbG93c1xyXG4gICAgICogICAgIHRoZSBjYWxsZXIgdG8gaW5jbHVkZSBkYXRhIG9mIHJlbGV2YW5jZSB0byB0aGUgbGljZW5zZSB0aGF0IGlzIGFzc29jaWF0ZWRcclxuICAgICAqICAgICB3aXRoIHRoZSBBUEkgS2V5LiBUaGlzIGlzIG1hbmRhdG9yeSBmb3IgQVBJIEtleXMgd2l0aCB0aGUgbGljZW5zZSB0eXBlXHJcbiAgICAgKiAgICAgJ0ZsZXhpYmxlIEdhbWJsaW5nJyBhbmQgZm9sbG93cyB0aGUgZm9ybWF0IHsgJ21heFBheW91dCc6IHsgJ2N1cnJlbmN5JzpcclxuICAgICAqICAgICAnWFRTJywgJ2Ftb3VudCc6IDAuMCB9fS4gVGhpcyBpbmZvcm1hdGlvbiBpcyB1c2VkIGluIGxpY2Vuc2luZ1xyXG4gICAgICogICAgIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzIGFuZCBpbiBiaWxsaW5nLiBUaGUgY3VycmVudGx5IHN1cHBvcnRlZFxyXG4gICAgICogICAgIGN1cnJlbmNpZXMgYXJlOiAnVVNEJywgJ0VVUicsICdHQlAnLCAnQlRDJywgJ0VUSCcuIFRoZSBtb3N0IHVwLXRvLWRhdGVcclxuICAgICAqICAgICBpbmZvcm1hdGlvbiBvbiB0aGUgY3VycmVuY2llcyBjYW4gYmUgZm91bmQgaW4gdGhlIFNpZ25lZCBBUElcclxuICAgICAqICAgICBkb2N1bWVudGF0aW9uLCBoZXJlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkXHJcbiAgICAgKiBAcGFyYW0geyhzdHJpbmd8bnVtYmVyfE9iamVjdCl9IFtvcHRpb25zLnVzZXJEYXRhPW51bGxdIE9iamVjdCB0aGF0IHdpbGwgYmVcclxuICAgICAqICAgICBpbmNsdWRlZCBpbiB1bm1vZGlmaWVkIGZvcm0uIEl0cyBtYXhpbXVtIHNpemUgaW4gZW5jb2RlZCAoc3RyaW5nKSBmb3JtIGlzXHJcbiAgICAgKiAgICAgMSwwMDAgY2hhcmFjdGVycyAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50aWNrZXRJZD1udWxsXSBBIHN0cmluZyB3aXRoIHRpY2tldCBpZGVudGlmaWVyIG9idGFpbmVkXHJcbiAgICAgKiAgICAgdmlhIHRoZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I2NyZWF0ZVRpY2tldHN9IG1ldGhvZC4gU3BlY2lmeWluZyBhIHZhbHVlXHJcbiAgICAgKiAgICAgZm9yIHRpY2tldElkIHdpbGwgY2F1c2UgUkFORE9NLk9SRyB0byByZWNvcmQgdGhhdCB0aGUgdGlja2V0IHdhcyB1c2VkXHJcbiAgICAgKiAgICAgdG8gZ2VuZXJhdGUgdGhlIHJlcXVlc3RlZCByYW5kb20gdmFsdWVzLiBFYWNoIHRpY2tldCBjYW4gb25seSBiZSB1c2VkXHJcbiAgICAgKiAgICAgb25jZSAoZGVmYXVsdCBudWxsKS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHtkYXRhOiBudW1iZXJbXXxzdHJpbmdbXSwgcmFuZG9tOiBPYmplY3QsIHNpZ25hdHVyZTogc3RyaW5nfT59XHJcbiAgICAgKiAgICAgQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlcHJlc2VudHMgYW4gb2JqZWN0IHdpdGggdGhlXHJcbiAgICAgKiAgICAgZm9sbG93aW5nIHN0cnVjdHVyZTpcclxuICAgICAqICogKipkYXRhKio6IGFycmF5IG9mIHRydWUgcmFuZG9tIGludGVnZXJzXHJcbiAgICAgKiAqICoqcmFuZG9tKio6IHJhbmRvbSBmaWVsZCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAqICogKipzaWduYXR1cmUqKjogc2lnbmF0dXJlIHN0cmluZ1xyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZVNpZ25lZEludGVnZXJzKG4sIG1pbiwgbWF4LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2ludGVnZXJSZXF1ZXN0KG4sIG1pbiwgbWF4LCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0cyBhbmQgcmV0dXJucyB1bmlmb3JtIG9yIG11bHRpZm9ybSBzZXF1ZW5jZXMgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnNcclxuICAgICAqIHdpdGhpbiB1c2VyLWRlZmluZWQgcmFuZ2VzIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogUmV0dXJucyBhIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVzcHJlc2VudHMgYW4gb2JqZWN0XHJcbiAgICAgKiB3aXRoIHRoZSBwYXJzZWQgYXJyYXkgb2YgaW50ZWdlciBzZXF1ZW5jZXMgbWFwcGVkIHRvICdkYXRhJywgdGhlIG9yaWdpbmFsXHJcbiAgICAgKiByZXNwb25zZSBtYXBwZWQgdG8gJ3JhbmRvbScsIGFuZCB0aGUgcmVzcG9uc2UncyBzaWduYXR1cmUgbWFwcGVkIHRvXHJcbiAgICAgKiAnc2lnbmF0dXJlJy5cclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZW5lcmF0ZUludGVnZXJTZXF1ZW5jZXNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IGFycmF5cyBvZiByYW5kb20gaW50ZWdlcnMgeW91IG5lZWQuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDFlM10gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBsZW5ndGggVGhlIGxlbmd0aCBvZiBlYWNoIGFycmF5IG9mIHJhbmRvbVxyXG4gICAgICogICAgIGludGVnZXJzIHJlcXVlc3RlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBsZW5ndGggbXVzdCBiZSBhbiBpbnRlZ2VyXHJcbiAgICAgKiAgICAgaW4gdGhlIFsxLCAxZTRdIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbGVuZ3RoIGNhbiBiZSBhbiBhcnJheVxyXG4gICAgICogICAgIHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsZW5ndGggb2YgdGhlIHNlcXVlbmNlIGlkZW50aWZpZWRcclxuICAgICAqICAgICBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBsZW5ndGggbXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UgYW5kIHRoZSB0b3RhbCBzdW0gb2YgYWxsIHRoZSBsZW5ndGhzIG11c3QgYmUgaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsIDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBtaW4gVGhlIGxvd2VyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaFxyXG4gICAgICogICAgIHRoZSByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBtaW4gbXVzdCBiZVxyXG4gICAgICogICAgIGFuIGludGVnZXIgaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbWluIGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSBsb3dlciBib3VuZGFyeSBvZiB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIG1pbiBtdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7KG51bWJlcnxudW1iZXJbXSl9IG1heCBUaGUgdXBwZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBGb3IgdW5pZm9ybSBzZXF1ZW5jZXMsIG1heCBtdXN0IGJlXHJcbiAgICAgKiAgICAgYW4gaW50ZWdlciBpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBtYXggY2FuXHJcbiAgICAgKiAgICAgYmUgYW4gYXJyYXkgd2l0aCBuIGludGVnZXJzLCBlYWNoIHNwZWNpZnlpbmcgdGhlIHVwcGVyIGJvdW5kYXJ5IG9mIHRoZVxyXG4gICAgICogICAgIHNlcXVlbmNlIGlkZW50aWZpZWQgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbWF4IG11c3RcclxuICAgICAqICAgICBiZSB3aXRoaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFufGJvb2xlYW5bXSwgYmFzZT86IG51bWJlcnxudW1iZXJbXSxcclxuICAgICAqICAgICBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0LCBsaWNlbnNlRGF0YT86IE9iamVjdCwgdXNlckRhdGE/OlxyXG4gICAgICogICAgIE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86IHN0cmluZ319IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heVxyXG4gICAgICogICAgIGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0geyhib29sZWFufGJvb2xlYW5bXSl9IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyXHJcbiAgICAgKiAgICAgdGhlIHJhbmRvbSBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlXHJcbiAgICAgKiAgICAgcmVzdWx0aW5nIG51bWJlcnMgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzXHJcbiAgICAgKiAgICAgd2lsbCBhbGwgYmUgdW5pcXVlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgcmVwbGFjZW1lbnQgY2FuIGJlIGFuIGFycmF5XHJcbiAgICAgKiAgICAgd2l0aCBuIGJvb2xlYW4gdmFsdWVzLCBlYWNoIHNwZWNpZnlpbmcgd2hldGhlciB0aGUgc2VxdWVuY2UgaWRlbnRpZmllZCBieVxyXG4gICAgICogICAgIGl0cyBpbmRleCB3aWxsIGJlIGNyZWF0ZWQgd2l0aCAodHJ1ZSkgb3Igd2l0aG91dCAoZmFsc2UpIHJlcGxhY2VtZW50XHJcbiAgICAgKiAgICAgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBbb3B0aW9ucy5iYXNlPTEwXSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0b1xyXG4gICAgICogICAgIGRpc3BsYXkgdGhlIG51bWJlcnMuIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYuIEZvciBtdWx0aWZvcm1cclxuICAgICAqICAgICBzZXF1ZW5jZXMsIGJhc2UgY2FuIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VyIHZhbHVlcyB0YWtlbiBmcm9tIHRoZSBzYW1lXHJcbiAgICAgKiAgICAgc2V0LCBlYWNoIHNwZWNpZnlpbmcgdGhlIGJhc2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gZGlzcGxheSB0aGUgc2VxdWVuY2VcclxuICAgICAqICAgICBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleCAoZGVmYXVsdCAxMCkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybVxyXG4gICAgICogICAgIGlzIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogbnVtYmVyW11bXXxzdHJpbmdbXVtdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn1cclxuICAgICAqICAgICBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gaW50ZWdlciBzZXF1ZW5jZXNcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkSW50ZWdlclNlcXVlbmNlcyhuLCBsZW5ndGgsIG1pbiwgbWF4LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2ludGVnZXJTZXF1ZW5jZVJlcXVlc3QobiwgbGVuZ3RoLCBtaW4sIG1heCwgb3B0aW9ucywgdHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RTaWduZWQodGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdCBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMsIGZyb20gYSB1bmlmb3JtXHJcbiAgICAgKiBkaXN0cmlidXRpb24gYWNyb3NzIHRoZSBbMCwxXSBpbnRlcnZhbCB3aXRoIGEgdXNlci1kZWZpbmVkIG51bWJlciBvZlxyXG4gICAgICogZGVjaW1hbCBwbGFjZXMgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBkZWNpbWFsIGZyYWN0aW9ucyBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWwgcmVzcG9uc2VcclxuICAgICAqIG1hcHBlZCB0byAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG8gJ3NpZ25hdHVyZScuIFNlZTpcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2VuZXJhdGVTaWduZWREZWNpbWFsRnJhY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnMgeW91IG5lZWQuIE11c3QgYmVcclxuICAgICAqICAgICB3aXRoaW4gdGhlIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVjaW1hbFBsYWNlcyBUaGUgbnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzIHRvIHVzZS4gTXVzdFxyXG4gICAgICogICAgIGJlIHdpdGhpbiB0aGUgWzEsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0LCBsaWNlbnNlRGF0YT86XHJcbiAgICAgKiAgICAgT2JqZWN0LCB1c2VyRGF0YT86IE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86IHN0cmluZ319IG9wdGlvbnMgQW5cclxuICAgICAqICAgICBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBudW1iZXJzXHJcbiAgICAgKiAgICAgbWF5IGNvbnRhaW4gZHVwbGljYXRlIHZhbHVlcywgb3RoZXJ3aXNlIHRoZSBudW1iZXJzIHdpbGwgYWxsIGJlIHVuaXF1ZVxyXG4gICAgICogICAgIChkZWZhdWx0IHRydWUpLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmxpY2Vuc2VEYXRhPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3Qgd2hpY2ggYWxsb3dzXHJcbiAgICAgKiAgICAgdGhlIGNhbGxlciB0byBpbmNsdWRlIGRhdGEgb2YgcmVsZXZhbmNlIHRvIHRoZSBsaWNlbnNlIHRoYXQgaXMgYXNzb2NpYXRlZFxyXG4gICAgICogICAgIHdpdGggdGhlIEFQSSBLZXkuIFRoaXMgaXMgbWFuZGF0b3J5IGZvciBBUEkgS2V5cyB3aXRoIHRoZSBsaWNlbnNlIHR5cGVcclxuICAgICAqICAgICAnRmxleGlibGUgR2FtYmxpbmcnIGFuZCBmb2xsb3dzIHRoZSBmb3JtYXQgeyAnbWF4UGF5b3V0JzogeyAnY3VycmVuY3knOlxyXG4gICAgICogICAgICdYVFMnLCAnYW1vdW50JzogMC4wIH19LiBUaGlzIGluZm9ybWF0aW9uIGlzIHVzZWQgaW4gbGljZW5zaW5nXHJcbiAgICAgKiAgICAgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMgYW5kIGluIGJpbGxpbmcuIFRoZSBjdXJyZW50bHkgc3VwcG9ydGVkXHJcbiAgICAgKiAgICAgY3VycmVuY2llcyBhcmU6ICdVU0QnLCAnRVVSJywgJ0dCUCcsICdCVEMnLCAnRVRIJy4gVGhlIG1vc3QgdXAtdG8tZGF0ZVxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIG9uIHRoZSBjdXJyZW5jaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGUgU2lnbmVkIEFQSVxyXG4gICAgICogICAgIGRvY3VtZW50YXRpb24sIGhlcmU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWRcclxuICAgICAqIEBwYXJhbSB7KHN0cmluZ3xudW1iZXJ8T2JqZWN0KX0gW29wdGlvbnMudXNlckRhdGE9bnVsbF0gT2JqZWN0IHRoYXQgd2lsbCBiZVxyXG4gICAgICogICAgIGluY2x1ZGVkIGluIHVubW9kaWZpZWQgZm9ybS4gSXRzIG1heGltdW0gc2l6ZSBpbiBlbmNvZGVkIChTdHJpbmcpIGZvcm1cclxuICAgICAqICAgICBpcyAxLDAwMCBjaGFyYWN0ZXJzIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnRpY2tldElkPW51bGxdIEEgc3RyaW5nIHdpdGggdGlja2V0IGlkZW50aWZpZXJcclxuICAgICAqICAgICBvYnRhaW5lZCB2aWEgdGhlIHtAbGluayBSYW5kb21PcmdDbGllbnQjY3JlYXRlVGlja2V0c30gbWV0aG9kLiBTcGVjaWZ5aW5nXHJcbiAgICAgKiAgICAgYSB2YWx1ZSBmb3IgdGlja2V0SWQgd2lsbCBjYXVzZSBSQU5ET00uT1JHIHRvIHJlY29yZCB0aGF0IHRoZSB0aWNrZXQgd2FzXHJcbiAgICAgKiAgICAgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMuIEVhY2ggdGlja2V0IGNhbiBvbmx5IGJlIHVzZWRcclxuICAgICAqICAgICBvbmNlIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8e2RhdGE6IG51bWJlcltdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn0gQVxyXG4gICAgICogICAgIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gZGVjaW1hbCBmcmFjdGlvbnNcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkRGVjaW1hbEZyYWN0aW9ucyhuLCBkZWNpbWFsUGxhY2VzLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2RlY2ltYWxGcmFjdGlvblJlcXVlc3QobiwgZGVjaW1hbFBsYWNlcywgb3B0aW9ucywgdHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RTaWduZWQodGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdCBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gbnVtYmVycyBmcm9tIGEgR2F1c3NpYW4gZGlzdHJpYnV0aW9uXHJcbiAgICAgKiAoYWxzbyBrbm93biBhcyBhIG5vcm1hbCBkaXN0cmlidXRpb24pLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBudW1iZXJzIG1hcHBlZCB0byAnZGF0YScsIHRoZSBvcmlnaW5hbCByZXNwb25zZSBtYXBwZWQgdG9cclxuICAgICAqICdyYW5kb20nLCBhbmQgdGhlIHJlc3BvbnNlJ3Mgc2lnbmF0dXJlIG1hcHBlZCB0byAnc2lnbmF0dXJlJy4gU2VlOlxyXG4gICAgICogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZW5lcmF0ZVNpZ25lZEdhdXNzaWFuc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIG51bWJlcnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWVhbiBUaGUgZGlzdHJpYnV0aW9uJ3MgbWVhbi4gTXVzdCBiZSB3aXRoaW4gdGhlIFstMWU2LDFlNl1cclxuICAgICAqICAgICByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFuZGFyZERldmlhdGlvbiBUaGUgZGlzdHJpYnV0aW9uJ3Mgc3RhbmRhcmQgZGV2aWF0aW9uLlxyXG4gICAgICogICAgIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlNiwxZTZdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpZ25pZmljYW50RGlnaXRzIFRoZSBudW1iZXIgb2Ygc2lnbmlmaWNhbnQgZGlnaXRzIHRvIHVzZS5cclxuICAgICAqICAgICBNdXN0IGJlIHdpdGhpbiB0aGUgWzIsMjBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHt7cHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdCwgbGljZW5zZURhdGE/OiBPYmplY3QsIHVzZXJEYXRhPzpcclxuICAgICAqICAgICBPYmplY3R8bnVtYmVyfHN0cmluZywgdGlja2V0SWQ/OiBzdHJpbmd9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaCBtYXlcclxuICAgICAqICAgICBjb250YWlucyBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmxpY2Vuc2VEYXRhPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3Qgd2hpY2ggYWxsb3dzXHJcbiAgICAgKiAgICAgdGhlIGNhbGxlciB0byBpbmNsdWRlIGRhdGEgb2YgcmVsZXZhbmNlIHRvIHRoZSBsaWNlbnNlIHRoYXQgaXMgYXNzb2NpYXRlZFxyXG4gICAgICogICAgIHdpdGggdGhlIEFQSSBLZXkuIFRoaXMgaXMgbWFuZGF0b3J5IGZvciBBUEkgS2V5cyB3aXRoIHRoZSBsaWNlbnNlIHR5cGVcclxuICAgICAqICAgICAnRmxleGlibGUgR2FtYmxpbmcnIGFuZCBmb2xsb3dzIHRoZSBmb3JtYXQgeyAnbWF4UGF5b3V0JzogeyAnY3VycmVuY3knOlxyXG4gICAgICogICAgICdYVFMnLCAnYW1vdW50JzogMC4wIH19LiBUaGlzIGluZm9ybWF0aW9uIGlzIHVzZWQgaW4gbGljZW5zaW5nXHJcbiAgICAgKiAgICAgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMgYW5kIGluIGJpbGxpbmcuIFRoZSBjdXJyZW50bHkgc3VwcG9ydGVkXHJcbiAgICAgKiAgICAgY3VycmVuY2llcyBhcmU6ICdVU0QnLCAnRVVSJywgJ0dCUCcsICdCVEMnLCAnRVRIJy4gVGhlIG1vc3QgdXAtdG8tZGF0ZVxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIG9uIHRoZSBjdXJyZW5jaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGUgU2lnbmVkIEFQSVxyXG4gICAgICogICAgIGRvY3VtZW50YXRpb24sIGhlcmU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWRcclxuICAgICAqIEBwYXJhbSB7KHN0cmluZ3xudW1iZXJ8T2JqZWN0KX0gW29wdGlvbnMudXNlckRhdGE9bnVsbF0gT2JqZWN0IHRoYXQgd2lsbCBiZVxyXG4gICAgICogICAgIGluY2x1ZGVkIGluIHVubW9kaWZpZWQgZm9ybS4gSXRzIG1heGltdW0gc2l6ZSBpbiBlbmNvZGVkIChTdHJpbmcpIGZvcm1cclxuICAgICAqICAgICBpcyAxLDAwMCBjaGFyYWN0ZXJzIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnRpY2tldElkPW51bGxdIEEgc3RyaW5nIHdpdGggdGlja2V0IGlkZW50aWZpZXJcclxuICAgICAqICAgICBvYnRhaW5lZCB2aWEgdGhlIHtAbGluayBSYW5kb21PcmdDbGllbnQjY3JlYXRlVGlja2V0c30gbWV0aG9kLiBTcGVjaWZ5aW5nXHJcbiAgICAgKiAgICAgYSB2YWx1ZSBmb3IgdGlja2V0SWQgd2lsbCBjYXVzZSBSQU5ET00uT1JHIHRvIHJlY29yZCB0aGF0IHRoZSB0aWNrZXQgd2FzXHJcbiAgICAgKiAgICAgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMuIEVhY2ggdGlja2V0IGNhbiBvbmx5IGJlIHVzZWRcclxuICAgICAqICAgICBvbmNlIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8e2RhdGE6IG51bWJlcltdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn0gQVxyXG4gICAgICogICAgIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gbnVtYmVycyBmcm9tIGEgR2F1c3NpYW4gZGlzdHJpYnV0aW9uXHJcbiAgICAgKiAqICoqcmFuZG9tKio6IHJhbmRvbSBmaWVsZCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAqICogKipzaWduYXR1cmUqKjogc2lnbmF0dXJlIHN0cmluZ1xyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZVNpZ25lZEdhdXNzaWFucyhuLCBtZWFuLCBzdGFuZGFyZERldmlhdGlvbiwgc2lnbmlmaWNhbnREaWdpdHMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2F1c3NpYW5SZXF1ZXN0KG4sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLCBzaWduaWZpY2FudERpZ2l0cyxcclxuICAgICAgICAgICAgb3B0aW9ucywgdHJ1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RTaWduZWQodGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVxdWVzdCBhIGxpc3QgKHNpemUgbikgb2YgdHJ1ZSByYW5kb20gc3RyaW5ncyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiBcclxuICAgICAqIFJldHVybnMgYSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksIHJlc3ByZXNlbnRzIGFuIG9iamVjdFxyXG4gICAgICogd2l0aCB0aGUgcGFyc2VkIHN0cmluZ3MgbWFwcGVkIHRvICdkYXRhJywgdGhlIG9yaWdpbmFsIHJlc3BvbnNlIG1hcHBlZCB0b1xyXG4gICAgICogJ3JhbmRvbScsIGFuZCB0aGUgcmVzcG9uc2UncyBzaWduYXR1cmUgbWFwcGVkIHRvICdzaWduYXR1cmUnLiBTZWU6XHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dlbmVyYXRlU2lnbmVkU3RyaW5nc1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIHN0cmluZ3MgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVuZ3RoIFRoZSBsZW5ndGggb2YgZWFjaCBzdHJpbmcuIE11c3QgYmUgd2l0aGluIHRoZSBbMSwyMF1cclxuICAgICAqICAgICByYW5nZS4gQWxsIHN0cmluZ3Mgd2lsbCBiZSBvZiB0aGUgc2FtZSBsZW5ndGguXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVycyBBIHN0cmluZyB0aGF0IGNvbnRhaW5zIHRoZSBzZXQgb2YgY2hhcmFjdGVyc1xyXG4gICAgICogICAgIHRoYXQgYXJlIGFsbG93ZWQgdG8gb2NjdXIgaW4gdGhlIHJhbmRvbSBzdHJpbmdzLiBUaGUgbWF4aW11bSBudW1iZXJcclxuICAgICAqICAgICBvZiBjaGFyYWN0ZXJzIGlzIDgwLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uPzogT2JqZWN0LCBsaWNlbnNlRGF0YT86XHJcbiAgICAgKiAgICAgT2JqZWN0LCB1c2VyRGF0YT86IE9iamVjdHxudW1iZXJ8c3RyaW5nLCB0aWNrZXRJZD86IHN0cmluZ319IG9wdGlvbnMgQW5cclxuICAgICAqICAgICBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW5zIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PW51bGxdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBzdHJpbmdzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBsaXN0XHJcbiAgICAgKiAgICAgb2Ygc3RyaW5ncyBtYXkgY29udGFpbiBkdXBsaWNhdGVzLCBvdGhlcndpc2UgdGhlIHN0cmluZ3Mgd2lsbCBhbGwgYmVcclxuICAgICAqICAgICB1bmlxdWUgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj1udWxsXSBBIGRpY3Rpb25hcnkgb2JqZWN0XHJcbiAgICAgKiAgICAgd2hpY2ggYWxsb3dzIHRoZSBjbGllbnQgdG8gc3BlY2lmeSB0aGF0IHRoZSByYW5kb20gdmFsdWVzIHNob3VsZCBiZVxyXG4gICAgICogICAgIGdlbmVyYXRlZCBmcm9tIGEgcHJlZ2VuZXJhdGVkLCBoaXN0b3JpY2FsIHJhbmRvbWl6YXRpb24gaW5zdGVhZCBvZiBhXHJcbiAgICAgKiAgICAgb25lLXRpbWUgb24tdGhlLWZseSByYW5kb21pemF0aW9uLiBUaGVyZSBhcmUgdGhyZWUgcG9zc2libGUgY2FzZXM6XHJcbiAgICAgKiAqICoqbnVsbCoqOiBUaGUgc3RhbmRhcmQgd2F5IG9mIGNhbGxpbmcgZm9yIHJhbmRvbSB2YWx1ZXMsIGkuZS50cnVlXHJcbiAgICAgKiAgICAgICByYW5kb21uZXNzIGlzIGdlbmVyYXRlZCBhbmQgZGlzY2FyZGVkIGFmdGVyd2FyZHMuXHJcbiAgICAgKiAqICoqZGF0ZSoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZ2VuZXJhdGVkIG9uIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBkYXRlIChwYXN0IG9yIHByZXNlbnQsIGZvcm1hdDogeyAnZGF0ZScsICdZWVlZLU1NLUREJyB9KS5cclxuICAgICAqICogKippZCoqOiBSQU5ET00uT1JHIHVzZXMgaGlzdG9yaWNhbCB0cnVlIHJhbmRvbW5lc3MgZGVyaXZlZCBmcm9tIHRoZVxyXG4gICAgICogICAgICAgY29ycmVzcG9uZGluZyBpZGVudGlmaWVyIGluIGEgZGV0ZXJtaW5pc3RpYyBtYW5uZXIuIEZvcm1hdDogeyAnaWQnLFxyXG4gICAgICogICAgICAgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgfSB3aGVyZSAnUEVSU0lTVEVOVC1JREVOVElGSUVSJyBpcyBhIHN0cmluZ1xyXG4gICAgICogICAgICAgd2l0aCBsZW5ndGggaW4gdGhlIFsxLCA2NF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMubGljZW5zZURhdGE9bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdCB3aGljaCBhbGxvd3NcclxuICAgICAqICAgICB0aGUgY2FsbGVyIHRvIGluY2x1ZGUgZGF0YSBvZiByZWxldmFuY2UgdG8gdGhlIGxpY2Vuc2UgdGhhdCBpcyBhc3NvY2lhdGVkXHJcbiAgICAgKiAgICAgd2l0aCB0aGUgQVBJIEtleS4gVGhpcyBpcyBtYW5kYXRvcnkgZm9yIEFQSSBLZXlzIHdpdGggdGhlIGxpY2Vuc2UgdHlwZVxyXG4gICAgICogICAgICdGbGV4aWJsZSBHYW1ibGluZycgYW5kIGZvbGxvd3MgdGhlIGZvcm1hdCB7ICdtYXhQYXlvdXQnOiB7ICdjdXJyZW5jeSc6XHJcbiAgICAgKiAgICAgJ1hUUycsICdhbW91bnQnOiAwLjAgfX0uIFRoaXMgaW5mb3JtYXRpb24gaXMgdXNlZCBpbiBsaWNlbnNpbmdcclxuICAgICAqICAgICByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcyBhbmQgaW4gYmlsbGluZy4gVGhlIGN1cnJlbnRseSBzdXBwb3J0ZWRcclxuICAgICAqICAgICBjdXJyZW5jaWVzIGFyZTogJ1VTRCcsICdFVVInLCAnR0JQJywgJ0JUQycsICdFVEgnLiBUaGUgbW9zdCB1cC10by1kYXRlXHJcbiAgICAgKiAgICAgaW5mb3JtYXRpb24gb24gdGhlIGN1cnJlbmNpZXMgY2FuIGJlIGZvdW5kIGluIHRoZSBTaWduZWQgQVBJXHJcbiAgICAgKiAgICAgZG9jdW1lbnRhdGlvbiwgaGVyZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZFxyXG4gICAgICogQHBhcmFtIHsoc3RyaW5nfG51bWJlcnxPYmplY3QpfSBbb3B0aW9ucy51c2VyRGF0YT1udWxsXSBPYmplY3QgdGhhdCB3aWxsIGJlXHJcbiAgICAgKiAgICAgaW5jbHVkZWQgaW4gdW5tb2RpZmllZCBmb3JtLiBJdHMgbWF4aW11bSBzaXplIGluIGVuY29kZWQgKFN0cmluZykgZm9ybVxyXG4gICAgICogICAgIGlzIDEsMDAwIGNoYXJhY3RlcnMgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudGlja2V0SWQ9bnVsbF0gQSBzdHJpbmcgd2l0aCB0aWNrZXQgaWRlbnRpZmllclxyXG4gICAgICogICAgIG9idGFpbmVkIHZpYSB0aGUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFNwZWNpZnlpbmdcclxuICAgICAqICAgICBhIHZhbHVlIGZvciB0aWNrZXRJZCB3aWxsIGNhdXNlIFJBTkRPTS5PUkcgdG8gcmVjb3JkIHRoYXQgdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkIHRvIGdlbmVyYXRlIHRoZSByZXF1ZXN0ZWQgcmFuZG9tIHZhbHVlcy4gRWFjaCB0aWNrZXQgY2FuIG9ubHkgYmUgdXNlZFxyXG4gICAgICogICAgIG9uY2UgKGRlZmF1bHQgbnVsbCkuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogc3RyaW5nW10sIHJhbmRvbTogT2JqZWN0LCBzaWduYXR1cmU6IHN0cmluZ30+fSBBXHJcbiAgICAgKiAgICAgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqZGF0YSoqOiBhcnJheSBvZiB0cnVlIHJhbmRvbSBzdHJpbmdzXHJcbiAgICAgKiAqICoqcmFuZG9tKio6IHJhbmRvbSBmaWVsZCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAqICogKipzaWduYXR1cmUqKjogc2lnbmF0dXJlIHN0cmluZ1xyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZW5lcmF0ZVNpZ25lZFN0cmluZ3MobiwgbGVuZ3RoLCBjaGFyYWN0ZXJzLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI3N0cmluZ1JlcXVlc3QobiwgbGVuZ3RoLCBjaGFyYWN0ZXJzLCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0IGEgbGlzdCAoc2l6ZSBuKSBvZiB2ZXJzaW9uIDQgdHJ1ZSByYW5kb20gVW5pdmVyc2FsbHkgVW5pcXVlXHJcbiAgICAgKiBJRGVudGlmaWVycyAoVVVJRHMpIGluIGFjY29yZGFuY2Ugd2l0aCBzZWN0aW9uIDQuNCBvZiBSRkMgNDEyMiwgZnJvbVxyXG4gICAgICogdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogUmV0dXJucyBhIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVzcHJlc2VudHMgYW4gb2JqZWN0XHJcbiAgICAgKiB3aXRoIHRoZSBwYXJzZWQgVVVJRHMgbWFwcGVkIHRvICdkYXRhJywgdGhlIG9yaWdpbmFsIHJlc3BvbnNlIG1hcHBlZCB0b1xyXG4gICAgICogJ3JhbmRvbScsIGFuZCB0aGUgcmVzcG9uc2UncyBzaWduYXR1cmUgbWFwcGVkIHRvICdzaWduYXR1cmUnLiBTZWU6XHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2dlbmVyYXRlU2lnbmVkVVVJRHNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBVVUlEcyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWUzXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3ByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24/OiBPYmplY3QsIGxpY2Vuc2VEYXRhPzogT2JqZWN0LCB1c2VyRGF0YT86XHJcbiAgICAgKiAgICAgT2JqZWN0fHN0cmluZ3xudW1iZXIsIHRpY2tldElkPzogc3RyaW5nfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5XHJcbiAgICAgKiAgICAgY29udGFpbiBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmxpY2Vuc2VEYXRhPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3Qgd2hpY2ggYWxsb3dzXHJcbiAgICAgKiAgICAgdGhlIGNhbGxlciB0byBpbmNsdWRlIGRhdGEgb2YgcmVsZXZhbmNlIHRvIHRoZSBsaWNlbnNlIHRoYXQgaXMgYXNzb2NpYXRlZFxyXG4gICAgICogICAgIHdpdGggdGhlIEFQSSBLZXkuIFRoaXMgaXMgbWFuZGF0b3J5IGZvciBBUEkgS2V5cyB3aXRoIHRoZSBsaWNlbnNlIHR5cGVcclxuICAgICAqICAgICAnRmxleGlibGUgR2FtYmxpbmcnIGFuZCBmb2xsb3dzIHRoZSBmb3JtYXQgeyAnbWF4UGF5b3V0JzogeyAnY3VycmVuY3knOlxyXG4gICAgICogICAgICdYVFMnLCAnYW1vdW50JzogMC4wIH19LiBUaGlzIGluZm9ybWF0aW9uIGlzIHVzZWQgaW4gbGljZW5zaW5nXHJcbiAgICAgKiAgICAgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMgYW5kIGluIGJpbGxpbmcuIFRoZSBjdXJyZW50bHkgc3VwcG9ydGVkXHJcbiAgICAgKiAgICAgY3VycmVuY2llcyBhcmU6ICdVU0QnLCAnRVVSJywgJ0dCUCcsICdCVEMnLCAnRVRIJy4gVGhlIG1vc3QgdXAtdG8tZGF0ZVxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIG9uIHRoZSBjdXJyZW5jaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGUgU2lnbmVkIEFQSVxyXG4gICAgICogICAgIGRvY3VtZW50YXRpb24sIGhlcmU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWRcclxuICAgICAqIEBwYXJhbSB7KHN0cmluZ3xudW1iZXJ8T2JqZWN0KX0gW29wdGlvbnMudXNlckRhdGE9bnVsbF0gT2JqZWN0IHRoYXQgd2lsbCBiZVxyXG4gICAgICogICAgIGluY2x1ZGVkIGluIHVubW9kaWZpZWQgZm9ybS4gSXRzIG1heGltdW0gc2l6ZSBpbiBlbmNvZGVkIChTdHJpbmcpIGZvcm1cclxuICAgICAqICAgICBpcyAxLDAwMCBjaGFyYWN0ZXJzIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnRpY2tldElkPW51bGxdIEEgc3RyaW5nIHdpdGggdGlja2V0IGlkZW50aWZpZXJcclxuICAgICAqICAgICBvYnRhaW5lZCB2aWEgdGhlIHtAbGluayBSYW5kb21PcmdDbGllbnQjY3JlYXRlVGlja2V0c30gbWV0aG9kLiBTcGVjaWZ5aW5nXHJcbiAgICAgKiAgICAgYSB2YWx1ZSBmb3IgdGlja2V0SWQgd2lsbCBjYXVzZSBSQU5ET00uT1JHIHRvIHJlY29yZCB0aGF0IHRoZSB0aWNrZXQgd2FzXHJcbiAgICAgKiAgICAgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMuIEVhY2ggdGlja2V0IGNhbiBvbmx5IGJlIHVzZWRcclxuICAgICAqICAgICBvbmNlIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8e2RhdGE6IHN0cmluZ1tdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn0gQVxyXG4gICAgICogICAgIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gVVVJRHNcclxuICAgICAqICogKipyYW5kb20qKjogcmFuZG9tIGZpZWxkIGFzIHJldHVybmVkIGZyb20gdGhlIHNlcnZlclxyXG4gICAgICogKiAqKnNpZ25hdHVyZSoqOiBzaWduYXR1cmUgc3RyaW5nXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkVVVJRHMobiwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNVVUlEUmVxdWVzdChuLCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXF1ZXN0IGEgbGlzdCAoc2l6ZSBuKSBvZiBCaW5hcnkgTGFyZ2UgT0JqZWN0cyAoQkxPQnMpIGNvbnRhaW5pbmcgdHJ1ZVxyXG4gICAgICogcmFuZG9tIGRhdGEgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogXHJcbiAgICAgKiBSZXR1cm5zIGEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LCByZXNwcmVzZW50cyBhbiBvYmplY3RcclxuICAgICAqIHdpdGggdGhlIHBhcnNlZCBCTE9CcyBtYXBwZWQgdG8gJ2RhdGEnLCB0aGUgb3JpZ2luYWwgcmVzcG9uc2UgbWFwcGVkIHRvXHJcbiAgICAgKiAncmFuZG9tJywgYW5kIHRoZSByZXNwb25zZSdzIHNpZ25hdHVyZSBtYXBwZWQgdG8gJ3NpZ25hdHVyZScuIFNlZTpcclxuICAgICAqIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2VuZXJhdGVTaWduZWRCbG9ic1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGJsb2JzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxMDBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgVGhlIHNpemUgb2YgZWFjaCBibG9iLCBtZWFzdXJlZCBpbiBiaXRzLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxMDQ4NTc2XSByYW5nZSBhbmQgbXVzdCBiZSBkaXZpc2libGUgYnkgOC5cclxuICAgICAqIEBwYXJhbSB7e2Zvcm1hdD86IHN0cmluZywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbj86IE9iamVjdCwgbGljZW5zZURhdGE/OlxyXG4gICAgICogICAgIE9iamVjdCwgdXNlckRhdGE/OiBPYmplY3R8bnVtYmVyfHN0cmluZywgdGlja2V0SWQ/OiBzdHJpbmd9fSBvcHRpb25zIEFuXHJcbiAgICAgKiAgICAgb2JqZWN0IHdoaWNoIG1heSBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZm9ybWF0PSdiYXNlNjQnXSBTcGVjaWZpZXMgdGhlIGZvcm1hdCBpbiB3aGljaCB0aGVcclxuICAgICAqICAgICBibG9icyB3aWxsIGJlIHJldHVybmVkLiBWYWx1ZXMgYWxsb3dlZCBhcmUgJ2Jhc2U2NCcgYW5kICdoZXgnIChkZWZhdWx0XHJcbiAgICAgKiAgICAgJ2Jhc2U2NCcpLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLnByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb249bnVsbF0gQSBkaWN0aW9uYXJ5IG9iamVjdFxyXG4gICAgICogICAgIHdoaWNoIGFsbG93cyB0aGUgY2xpZW50IHRvIHNwZWNpZnkgdGhhdCB0aGUgcmFuZG9tIHZhbHVlcyBzaG91bGQgYmVcclxuICAgICAqICAgICBnZW5lcmF0ZWQgZnJvbSBhIHByZWdlbmVyYXRlZCwgaGlzdG9yaWNhbCByYW5kb21pemF0aW9uIGluc3RlYWQgb2YgYVxyXG4gICAgICogICAgIG9uZS10aW1lIG9uLXRoZS1mbHkgcmFuZG9taXphdGlvbi4gVGhlcmUgYXJlIHRocmVlIHBvc3NpYmxlIGNhc2VzOlxyXG4gICAgICogKiAqKm51bGwqKjogVGhlIHN0YW5kYXJkIHdheSBvZiBjYWxsaW5nIGZvciByYW5kb20gdmFsdWVzLCBpLmUudHJ1ZVxyXG4gICAgICogICAgICAgcmFuZG9tbmVzcyBpcyBnZW5lcmF0ZWQgYW5kIGRpc2NhcmRlZCBhZnRlcndhcmRzLlxyXG4gICAgICogKiAqKmRhdGUqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGdlbmVyYXRlZCBvbiB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgZGF0ZSAocGFzdCBvciBwcmVzZW50LCBmb3JtYXQ6IHsgJ2RhdGUnLCAnWVlZWS1NTS1ERCcgfSkuXHJcbiAgICAgKiAqICoqaWQqKjogUkFORE9NLk9SRyB1c2VzIGhpc3RvcmljYWwgdHJ1ZSByYW5kb21uZXNzIGRlcml2ZWQgZnJvbSB0aGVcclxuICAgICAqICAgICAgIGNvcnJlc3BvbmRpbmcgaWRlbnRpZmllciBpbiBhIGRldGVybWluaXN0aWMgbWFubmVyLiBGb3JtYXQ6IHsgJ2lkJyxcclxuICAgICAqICAgICAgICdQRVJTSVNURU5ULUlERU5USUZJRVInIH0gd2hlcmUgJ1BFUlNJU1RFTlQtSURFTlRJRklFUicgaXMgYSBzdHJpbmdcclxuICAgICAqICAgICAgIHdpdGggbGVuZ3RoIGluIHRoZSBbMSwgNjRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmxpY2Vuc2VEYXRhPW51bGxdIEEgZGljdGlvbmFyeSBvYmplY3Qgd2hpY2ggYWxsb3dzXHJcbiAgICAgKiAgICAgdGhlIGNhbGxlciB0byBpbmNsdWRlIGRhdGEgb2YgcmVsZXZhbmNlIHRvIHRoZSBsaWNlbnNlIHRoYXQgaXMgYXNzb2NpYXRlZFxyXG4gICAgICogICAgIHdpdGggdGhlIEFQSSBLZXkuIFRoaXMgaXMgbWFuZGF0b3J5IGZvciBBUEkgS2V5cyB3aXRoIHRoZSBsaWNlbnNlIHR5cGVcclxuICAgICAqICAgICAnRmxleGlibGUgR2FtYmxpbmcnIGFuZCBmb2xsb3dzIHRoZSBmb3JtYXQgeyAnbWF4UGF5b3V0JzogeyAnY3VycmVuY3knOlxyXG4gICAgICogICAgICdYVFMnLCAnYW1vdW50JzogMC4wIH19LiBUaGlzIGluZm9ybWF0aW9uIGlzIHVzZWQgaW4gbGljZW5zaW5nXHJcbiAgICAgKiAgICAgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMgYW5kIGluIGJpbGxpbmcuIFRoZSBjdXJyZW50bHkgc3VwcG9ydGVkXHJcbiAgICAgKiAgICAgY3VycmVuY2llcyBhcmU6ICdVU0QnLCAnRVVSJywgJ0dCUCcsICdCVEMnLCAnRVRIJy4gVGhlIG1vc3QgdXAtdG8tZGF0ZVxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIG9uIHRoZSBjdXJyZW5jaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGUgU2lnbmVkIEFQSVxyXG4gICAgICogICAgIGRvY3VtZW50YXRpb24sIGhlcmU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWRcclxuICAgICAqIEBwYXJhbSB7KHN0cmluZ3xudW1iZXJ8T2JqZWN0KX0gW29wdGlvbnMudXNlckRhdGE9bnVsbF0gT2JqZWN0IHRoYXQgd2lsbCBiZVxyXG4gICAgICogICAgIGluY2x1ZGVkIGluIHVubW9kaWZpZWQgZm9ybS4gSXRzIG1heGltdW0gc2l6ZSBpbiBlbmNvZGVkIChTdHJpbmcpIGZvcm0gaXNcclxuICAgICAqICAgICAxLDAwMCBjaGFyYWN0ZXJzIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnRpY2tldElkPW51bGxdIEEgc3RyaW5nIHdpdGggdGlja2V0IGlkZW50aWZpZXJcclxuICAgICAqICAgICBvYnRhaW5lZCB2aWEgdGhlIHtAbGluayBSYW5kb21PcmdDbGllbnQjY3JlYXRlVGlja2V0c30gbWV0aG9kLiBTcGVjaWZ5aW5nXHJcbiAgICAgKiAgICAgYSB2YWx1ZSBmb3IgdGlja2V0SWQgd2lsbCBjYXVzZSBSQU5ET00uT1JHIHRvIHJlY29yZCB0aGF0IHRoZSB0aWNrZXQgd2FzXHJcbiAgICAgKiAgICAgdXNlZCB0byBnZW5lcmF0ZSB0aGUgcmVxdWVzdGVkIHJhbmRvbSB2YWx1ZXMuIEVhY2ggdGlja2V0IGNhbiBvbmx5IGJlIHVzZWRcclxuICAgICAqICAgICBvbmNlIChkZWZhdWx0IG51bGwpLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8e2RhdGE6IHN0cmluZ1tdLCByYW5kb206IE9iamVjdCwgc2lnbmF0dXJlOiBzdHJpbmd9Pn0gQVxyXG4gICAgICogICAgIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50cyBhbiBvYmplY3Qgd2l0aCB0aGVcclxuICAgICAqICAgICBmb2xsb3dpbmcgc3RydWN0dXJlOlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gYmxvYnMgYXMgc3RyaW5nc1xyXG4gICAgICogKiAqKnJhbmRvbSoqOiByYW5kb20gZmllbGQgYXMgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyXHJcbiAgICAgKiAqICoqc2lnbmF0dXJlKio6IHNpZ25hdHVyZSBzdHJpbmdcclxuICAgICAqIEBzZWUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNCTE9CX0ZPUk1BVF9CQVNFNjR9IGZvciAnYmFzZTY0JyAoZGVmYXVsdCkuXHJcbiAgICAgKiBAc2VlIHtAbGluayBSYW5kb21PcmdDbGllbnQjQkxPQl9GT1JNQVRfSEVYfSBmb3IgJ2hleCcuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdlbmVyYXRlU2lnbmVkQmxvYnMobiwgc2l6ZSwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNibG9iUmVxdWVzdChuLCBzaXplLCBvcHRpb25zLCB0cnVlKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT1RIRVIgTUVUSE9EU1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVmVyaWZpZXMgdGhlIHNpZ25hdHVyZSBvZiBhIHJlc3BvbnNlIHByZXZpb3VzbHkgcmVjZWl2ZWQgZnJvbSBvbmUgb2YgdGhlXHJcbiAgICAgKiBtZXRob2RzIGluIHRoZSBTaWduZWQgQVBJIHdpdGggdGhlIHNlcnZlci5cclxuICAgICAqIFxyXG4gICAgICogVGhpcyBpcyB1c2VkIHRvIGV4YW1pbmUgdGhlIGF1dGhlbnRpY2l0eSBvZiBudW1iZXJzLiBSZXR1cm5zIFRydWUgb25cclxuICAgICAqIHZlcmlmaWNhdGlvbiBzdWNjZXNzLiBTZWU6XHJcbiAgICAgKiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI3ZlcmlmeVNpZ25hdHVyZVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJhbmRvbSBUaGUgcmFuZG9tIGZpZWxkIGZyb20gYSByZXNwb25zZSByZXR1cm5lZCBieSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgdGhyb3VnaCBvbmUgb2YgdGhlIFNpZ25lZCBBUEkgbWV0aG9kcy5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaWduYXR1cmUgVGhlIHNpZ25hdHVyZSBmaWVsZCBmcm9tIHRoZSBzYW1lIHJlc3BvbnNlIHRoYXRcclxuICAgICAqICAgICB0aGUgcmFuZG9tIGZpZWxkIG9yaWdpbmF0ZXMgZnJvbS5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIHdoZXRoZXIgdGhlIHJlc3VsdCBjb3VsZCBiZSB2ZXJpZmllZCAodHJ1ZSkgb3Igbm90IChmYWxzZSkuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIHZlcmlmeVNpZ25hdHVyZShyYW5kb20sIHNpZ25hdHVyZSkge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIHJhbmRvbTogcmFuZG9tLFxyXG4gICAgICAgICAgICBzaWduYXR1cmU6IHNpZ25hdHVyZVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZVJlcXVlc3QoUmFuZG9tT3JnQ2xpZW50LiNWRVJJRllfU0lHTkFUVVJFX01FVEhPRCwgcGFyYW1zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFZlcmlmaWNhdGlvbih0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSAoZXN0aW1hdGVkKSBudW1iZXIgb2YgcmVtYWluaW5nIHRydWUgcmFuZG9tIGJpdHMgYXZhaWxhYmxlIHRvXHJcbiAgICAgKiB0aGUgY2xpZW50LiBJZiBjYWNoZWQgdXNhZ2UgaW5mbyBpcyBvbGRlciB0aGFuIGFuIGhvdXIsIGZyZXNoIGluZm8gaXNcclxuICAgICAqIG9idGFpbmVkIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgdGhlIG51bWJlciBvZiBiaXRzIHJlbWFpbmluZy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0Qml0c0xlZnQoKSB7XHJcbiAgICAgICAgbGV0IHVwZGF0ZSA9IERhdGUubm93KCkgPiAodGhpcy4jbGFzdFJlc3BvbnNlUmVjZWl2ZWRUaW1lICsgUmFuZG9tT3JnQ2xpZW50LiNBTExPV0FOQ0VfU1RBVEVfUkVGUkVTSF9TRUNPTkRTKTtcclxuICAgICAgICBpZiAodGhpcy4jYml0c0xlZnQgPCAwIHx8IHVwZGF0ZSkge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLiNnZXRVc2FnZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy4jYml0c0xlZnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSAoZXN0aW1hdGVkKSBudW1iZXIgb2YgcmVtYWluaW5nIEFQSSByZXF1ZXN0cyBhdmFpbGFibGUgdG8gdGhlXHJcbiAgICAgKiBjbGllbnQuIElmIGNhY2hlZCB1c2FnZSBpbmZvIGlzIG9sZGVyIHRoYW4gYW4gaG91ciwgZnJlc2ggaW5mbyBpc1xyXG4gICAgICogb2J0YWluZWQgZnJvbSB0aGUgc2VydmVyLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyB0aGUgbnVtYmVyIG9mIHJlcXVlc3RzIHJlbWFpbmluZy5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3J9IFRocm93biB3aGVuIGJsb2NraW5nIHRpbWVvdXQgaXMgZXhjZWVkZWRcclxuICAgICAqICAgICBiZWZvcmUgdGhlIHJlcXVlc3QgY2FuIGJlIHNlbnQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5IGhhcyBiZWVuXHJcbiAgICAgKiAgICAgc3RvcHBlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgcmVxdWVzdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIGJpdHMgYWxsb3dhbmNlIGhhcyBiZWVuIGV4Y2VlZGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3J9IFRocm93biB3aGVuIGEgSFRUUCAyMDAgT0sgcmVzcG9uc2VcclxuICAgICAqICAgICBpcyBub3QgcmVjZWl2ZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdSQU5ET01PUkdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgUkFORE9NLk9SR1xyXG4gICAgICogICAgIEVycm9yLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSlNPTlJQQ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBKU09OLVJQQyBFcnJvci5cclxuICAgICAqL1xyXG4gICAgYXN5bmMgZ2V0UmVxdWVzdHNMZWZ0KCkge1xyXG4gICAgICAgIGxldCB1cGRhdGUgPSBEYXRlLm5vdygpID4gKHRoaXMuI2xhc3RSZXNwb25zZVJlY2VpdmVkVGltZSArIFJhbmRvbU9yZ0NsaWVudC4jQUxMT1dBTkNFX1NUQVRFX1JFRlJFU0hfU0VDT05EUyk7XHJcbiAgICAgICAgaWYgKHRoaXMuI3JlcXVlc3RzTGVmdCA8IDAgfHwgdXBkYXRlKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuI2dldFVzYWdlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0c0xlZnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgc2lnbmVkIHJhbmRvbSB2YWx1ZXMgZ2VuZXJhdGVkIHdpdGhpbiB0aGUgbGFzdCAyNGgsIHVzaW5nIGFcclxuICAgICAqIHNlcmlhbCBudW1iZXIuXHJcbiAgICAgKiBcclxuICAgICAqIElmIHRoZSBoaXN0b3JpY2FsIHJlc3BvbnNlIHdhcyBmb3VuZCwgdGhlIHJlc3BvbnNlIHdpbGwgY29udGFpbiB0aGUgc2FtZVxyXG4gICAgICogdmFsdWVzIHRoYXQgd2VyZSByZXR1cm5lZCBieSB0aGUgbWV0aG9kIHRoYXQgd2FzIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHZhbHVlc1xyXG4gICAgICogaW5pdGlhbGx5LiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjZ2V0UmVzdWx0XHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2VyaWFsTnVtYmVyIEFuIGludGVnZXIgY29udGFpbmluZyB0aGUgc2VyaWFsIG51bWJlclxyXG4gICAgICogICAgIGFzc29jaWF0ZWQgd2l0aCB0aGUgcmVzcG9uc2UgeW91IHdpc2ggdG8gcmV0cmlldmUuXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgc3RydWN0dXJlLCBpZGVudGljYWwgdG8gdGhhdFxyXG4gICAgICogICAgIHJldHVybmVkIGJ5IHRoZSBvcmlnaW5hbCByZXF1ZXN0OlxyXG4gICAgICogKiAqKmRhdGEqKjogYXJyYXkgb2YgdHJ1ZSByYW5kb20gdmFsdWVzXHJcbiAgICAgKiAqICoqcmFuZG9tKio6IHJhbmRvbSBmaWVsZCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgICAqICogKipzaWduYXR1cmUqKjogc2lnbmF0dXJlIHN0cmluZ1xyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBnZXRSZXN1bHQoc2VyaWFsTnVtYmVyKSB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgc2VyaWFsTnVtYmVyOiBzZXJpYWxOdW1iZXJcclxuICAgICAgICB9O1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QoUmFuZG9tT3JnQ2xpZW50LiNHRVRfUkVTVUxUX01FVEhPRCwgcGFyYW1zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFNpZ25lZCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZWRlZiB7T2JqZWN0fSBOZXdUaWNrZXQgQSB0aWNrZXQgYXMgaXQgaXMgcmV0dXJuZWQgYnkgdGhlIGNyZWF0ZVRpY2tldHMoKSBtZXRob2QuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdGlja2V0SWQgQSBzdHJpbmcgdmFsdWUgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSB0aWNrZXQuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gY3JlYXRpb25UaW1lIEEgc3RyaW5nIGNvbnRhaW5pbmcgdGhlIHRpbWVzdGFtcCBpbiBJU08gODYwMVxyXG4gICAgICogICAgIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0IHdhcyBjcmVhdGVkLlxyXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IHByZXZpb3VzVGlja2V0SWQgVGhlIHByZXZpb3VzIHRpY2tldCBpbiB0aGUgY2hhaW4gdG8gd2hpY2ggdGhpc1xyXG4gICAgICogICAgIHRpY2tldCBiZWxvbmdzLiBTaW5jZSBhIG5ldyBjaGFpbiBvbmx5IGNvbnRhaW5zIG9uZSB0aWNrZXQsIHByZXZpb3VzVGlja2V0SWQgd2lsbFxyXG4gICAgICogICAgIGJlIG51bGwuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gbmV4dFRpY2tldElkIEEgc3RyaW5nIHZhbHVlIHRoYXQgaWRlbnRpZmllcyB0aGUgbmV4dCB0aWNrZXQgaW5cclxuICAgICAqICAgICB0aGUgY2hhaW4uIFNpbmNlIGEgbmV3IGNoYWluIG9ubHkgY29udGFpbnMgb25lIHRpY2tldCwgbmV4dFRpY2tldElkIHdpbGwgYmUgbnVsbC5cclxuICAgICAqL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGVkZWYge09iamVjdH0gVGlja2V0IEEgdGlja2V0IGFzIGl0IGlzIHJldHVybmVkIGJ5IHRoZSBsaXN0VGlja2V0cygpIGFuZFxyXG4gICAgICogICAgIGdldFRpY2tldCgpIG1ldGhvZHMuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdGlja2V0SWQgQSBzdHJpbmcgdmFsdWUgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSB0aWNrZXQuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gaGFzaGVkQXBpS2V5IFRoZSBoYXNoZWQgQVBJIGtleSBmb3Igd2hpY2ggdGhlIHRpY2tldCBpcyB2YWxpZC5cclxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hvd1Jlc3VsdCBJZiBmYWxzZSwgZ2V0VGlja2V0KCkgd2lsbCByZXR1cm4gb25seSB0aGUgYmFzaWNcclxuICAgICAqICAgICB0aWNrZXQgaW5mb3JtYXRpb24uIElmIHRydWUsIHRoZSBmdWxsIHJhbmRvbSBhbmQgc2lnbmF0dXJlIG9iamVjdHMgZnJvbSB0aGVcclxuICAgICAqICAgICByZXNwb25zZSB0aGF0IHdhcyB1c2VkIHRvIHNhdGlzZnkgdGhlIHRpY2tldCBpcyByZXR1cm5lZC4gRm9yIG1vcmUgaW5mb3JtYXRpb24sXHJcbiAgICAgKiAgICAgcGxlYXNlIHNlZSB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgZ2V0VGlja2V0LlxyXG4gICAgICogQHByb3BlcnR5IHtzdHJpbmd9IGNyZWF0aW9uVGltZSBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0XHJcbiAgICAgKiAgICAgd2FzIGNyZWF0ZWQuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gdXNlZFRpbWUgVGhlIHRpbWVzdGFtcCBpbiBJU08gODYwMSBmb3JtYXQgYXQgd2hpY2ggdGhlIHRpY2tldCB3YXNcclxuICAgICAqICAgICB1c2VkLiBJZiB0aGUgdGlja2V0IGhhcyBub3QgYmVlbiB1c2VkIHlldCwgdGhpcyB2YWx1ZSBpcyBudWxsLlxyXG4gICAgICogQHByb3BlcnR5IHtudW1iZXJ9IHNlcmlhbE51bWJlciBBIG51bWVyaWMgdmFsdWUgaW5kaWNhdGluZyB3aGljaCBzZXJpYWwgbnVtYmVyXHJcbiAgICAgKiAgICAgKHdpdGhpbiB0aGUgQVBJIGtleSB1c2VkIHRvIHNlcnZlIHRoZSB0aWNrZXQpIHdhcyB1c2VkIGZvciB0aGUgdGlja2V0LiBJZiB0aGVcclxuICAgICAqICAgICBjYWxsZXIgaGFzIHRoZSB1bmhhc2hlZCBBUEkga2V5LCB0aGV5IGNhbiB1c2UgdGhlIHNlcmlhbE51bWJlciByZXR1cm5lZCB0byBvYnRhaW5cclxuICAgICAqICAgICB0aGUgZnVsbCByZXN1bHQgdmlhIHRoZSBnZXRSZXN1bHQgbWV0aG9kLiBJZiB0aGUgdGlja2V0IGhhcyBub3QgYmVlbiB1c2VkIHlldCxcclxuICAgICAqICAgICB0aGlzIHZhbHVlIGlzIG51bGwuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gZXhwaXJhdGlvblRpbWUgVGhlIHRpbWVzdGFtcCBpbiBJU08gODYwMSBmb3JtYXQgYXQgd2hpY2ggdGhlIHRpY2tldFxyXG4gICAgICogICAgIGV4cGlyZXMuIElmIHRoZSB0aWNrZXQgaGFzIG5vdCBiZWVuIHVzZWQgeWV0LCB0aGlzIHZhbHVlIGlzIG51bGwuXHJcbiAgICAgKiBAcHJvcGVydHkge3N0cmluZ30gcHJldmlvdXNUaWNrZXRJZCBUaGUgcHJldmlvdXMgdGlja2V0IGluIHRoZSBjaGFpbiB0byB3aGljaCB0aGlzXHJcbiAgICAgKiAgICAgdGlja2V0IGJlbG9uZ3MuIElmIHRoZSB0aWNrZXQgaXMgdGhlIGZpcnN0IGluIGl0cyBjaGFpbiwgdGhlbiBwcmV2aW91c1RpY2tldElkIGlzXHJcbiAgICAgKiAgICAgbnVsbC5cclxuICAgICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBuZXh0VGlja2V0SWQgQSBzdHJpbmcgdmFsdWUgdGhhdCBpZGVudGlmaWVzIHRoZSBuZXh0XHJcbiAgICAgKiAgICAgdGlja2V0IGluIHRoZSBjaGFpbi5cclxuICAgICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBbcmVzdWx0XSBUaGUgc2FtZSBvYmplY3QgdGhhdCB3YXMgcmV0dXJuZWQgYnkgdGhlIG1ldGhvZCB0aGF0IHdhc1xyXG4gICAgICogICAgIG9yaWdpbmFsbHkgdXNlZCB0byBnZW5lcmF0ZSB0aGUgdmFsdWVzLlxyXG4gICAgICovXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIG4gdGlja2V0cyB0byBiZSB1c2VkIGluIHNpZ25lZCB2YWx1ZS1nZW5lcmF0aW5nIG1ldGhvZHMuXHJcbiAgICAgKiAgXHJcbiAgICAgKiBTZWU6IGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9zaWduZWQjY3JlYXRlVGlja2V0c1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aWNrZXRzIHJlcXVlc3RlZC4gVGhpcyBtdXN0IGJlIGEgbnVtYmVyXHJcbiAgICAgKiAgICAgaW4gdGhlIFsxLCA1MF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3dSZXN1bHQgQSBib29sZWFuIHZhbHVlIHRoYXQgZGV0ZXJtaW5lcyBob3cgbXVjaFxyXG4gICAgICogICAgIGluZm9ybWF0aW9uIGNhbGxzIHRvIHtAbGluayBnZXRUaWNrZXR9IHdpbGwgcmV0dXJuLlxyXG4gICAgICogKiAqKmZhbHNlKio6IGdldFRpY2tldCB3aWxsIHJldHVybiBvbmx5IHRoZSBiYXNpYyB0aWNrZXQgaW5mb3JtYXRpb24uXHJcbiAgICAgKiAqICoqdHJ1ZSoqOiB0aGUgZnVsbCByYW5kb20gYW5kIHNpZ25hdHVyZSBvYmplY3RzIGZyb20gdGhlIHJlc3BvbnNlIHRoYXRcclxuICAgICAqICAgICB3YXMgdXNlZCB0byBzYXRpc2Z5IHRoZSB0aWNrZXQgaXMgcmV0dXJuZWQuIFxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8TmV3VGlja2V0W10+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIGFycmF5IG9mIHRpY2tldCBvYmplY3RzIHdpdGggdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XHJcbiAgICAgKiAqICoqdGlja2V0SWQqKjogQSBzdHJpbmcgdmFsdWUgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSB0aWNrZXQuXHJcbiAgICAgKiAqICoqY3JlYXRpb25UaW1lKio6IFRoZSB0aW1lIHdoZW4gdGhlIHRpY2tldCB3YXMgY3JlYXRlZCAoSVNPIDg2MDEgZm9ybWF0KS5cclxuICAgICAqICogKipuZXh0VGlja2V0SWQqKjogQSBzdHJpbmcgcG9pbnRpbmcgdG8gdGhlIG5leHQgdGlja2V0IGluIHRoZSBjaGFpbi5cclxuICAgICAqICAgICBUaGlzIHdpbGwgYmUgbnVsbCwgYXMgdGhlIHRpY2tldHMgcmV0dXJuZWQgZnJvbSB0aGlzIG1ldGhvZCBhcmUgdGhlXHJcbiAgICAgKiAgICAgZmlyc3QgaW4gdGhlaXIgcmVzcGVjdGl2ZSBjaGFpbnMuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGNyZWF0ZVRpY2tldHMobiwgc2hvd1Jlc3VsdCkge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIHNob3dSZXN1bHQ6IHNob3dSZXN1bHRcclxuICAgICAgICB9O1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QoUmFuZG9tT3JnQ2xpZW50LiNDUkVBVEVfVElDS0VUX01FVEhPRCwgcGFyYW1zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFJlc3VsdCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPYnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IHRpY2tldHMgbGlua2VkIHdpdGggeW91ciBBUEkga2V5LlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgbWF4aW11bSBudW1iZXIgb2YgdGlja2V0cyB0aGF0IGNhbiBiZSByZXR1cm5lZCBieSB0aGlzIG1ldGhvZCBpcyAyMDAwLlxyXG4gICAgICogU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL2pzb24tcnBjLzQvc2lnbmVkI2xpc3RUaWNrZXRzXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGlja2V0VHlwZSBBIHN0cmluZyBkZXNjcmliaW5nIHRoZSB0eXBlIG9mIHRpY2tldHMgeW91IHdhbnRcclxuICAgICAqICAgICB0byBvYnRhaW4gaW5mb3JtYXRpb24gYWJvdXQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgJ3NpbmdsZXRvbicsICdoZWFkJ1xyXG4gICAgICogICAgIGFuZCAndGFpbCcuXHJcbiAgICAgKiAqICoqJ3NpbmdsZXRvbicqKiByZXR1cm5zIHRpY2tldHMgdGhhdCBoYXZlIG5vIHByZXZpb3VzIG9yIG5leHQgdGlja2V0cy5cclxuICAgICAqICogKionaGVhZCcqKiByZXR1cm5zIHRpY2tldHMgaGF0IGRvIG5vdCBoYXZlIGEgcHJldmlvdXMgdGlja2V0IGJ1dCB0aGF0IGRvXHJcbiAgICAgKiAgICAgaGF2ZSBhIG5leHQgdGlja2V0LlxyXG4gICAgICogKiAqKid0YWlsJyoqIHJldHVybnMgdGlja2V0cyB0aGF0IGhhdmUgYSBwcmV2aW91cyB0aWNrZXQgYnV0IGRvIG5vdCBoYXZlIGFcclxuICAgICAqICAgICAgIG5leHQgdGlja2V0LlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8VGlja2V0W10+fSBBIFByb21pc2Ugd2hpY2gsIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSxcclxuICAgICAqICAgICByZXByZXNlbnRzIGFuIGFycmF5IG9mIHRpY2tldCBvYmplY3RzLCBhcyByZXR1cm5lZCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgKiAgICAgKipOT1RFOioqIFRoZSBvYmplY3RzIHJldHVybmVkIGZyb20gdGhpcyBtZXRob2QgZG8gbm90IGNvbnRhaW4gXCJyZXN1bHRcIlxyXG4gICAgICogICAgIGZpZWxkcywgZXZlbiBpZiB0aWNrZXRzIHdlcmUgY3JlYXRlZCB3aXRoIFwic2hvd1Jlc3VsdFwiIHNldCB0byB0cnVlLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICBhc3luYyBsaXN0VGlja2V0cyh0aWNrZXRUeXBlKSB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgdGlja2V0VHlwZTogdGlja2V0VHlwZVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChSYW5kb21PcmdDbGllbnQuI0xJU1RfVElDS0VUX01FVEhPRCwgcGFyYW1zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFJlc3VsdCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBPYnRhaW5zIGluZm9ybWF0aW9uIGFib3V0IGEgc2luZ2xlIHRpY2tldCB1c2luZyB0aGUgdGlja2V0SWQgYXNzb2NpYXRlZFxyXG4gICAgICogd2l0aCBpdC5cclxuICAgICAqICBcclxuICAgICAqIElmIHRoZSB0aWNrZXQgaGFzIHNob3dSZXN1bHQgc2V0IHRvIHRydWUgYW5kIGhhcyBiZWVuIHVzZWQsIHRoaXMgbWV0aG9kXHJcbiAgICAgKiB3aWxsIHJldHVybiB0aGUgdmFsdWVzIGdlbmVyYXRlZC5cclxuICAgICAqIFNlZTogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L3NpZ25lZCNnZXRUaWNrZXRcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0aWNrZXRJZCBBIHN0cmluZyBjb250YWluaW5nIGEgdGlja2V0IGlkZW50aWZpZXIgcmV0dXJuZWRcclxuICAgICAqICAgICBieSBhIHByaW9yIGNhbGwgdG8gdGhlIHtAbGluayBjcmVhdGVUaWNrZXRzfSBtZXRob2QuIFxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8VGlja2V0Pn0gQSBQcm9taXNlIHdoaWNoLCBpZiByZXNvbHZlZCBzdWNjZXNzZnVsbHksXHJcbiAgICAgKiAgICAgcmVwcmVzZW50cyBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIGluZm9ybWF0aW9uOlxyXG4gICAgICogKiAqKnRpY2tldElkKio6IEEgc3RyaW5nIHZhbHVlIHRoYXQgdW5pcXVlbHkgaWRlbnRpZmllcyB0aGUgdGlja2V0LlxyXG4gICAgICogKiAqKmhhc2hlZEFwaUtleSoqOiBUaGUgaGFzaGVkIEFQSSBrZXkgZm9yIHdoaWNoIHRoZSB0aWNrZXQgaXMgdmFsaWQuXHJcbiAgICAgKiAqICoqc2hvd1Jlc3VsdCoqOiBJZiBmYWxzZSwgZ2V0VGlja2V0KCkgd2lsbCByZXR1cm4gb25seSB0aGUgYmFzaWNcclxuICAgICAqICAgICB0aWNrZXQgaW5mb3JtYXRpb24uIElmIHRydWUsIHRoZSBmdWxsIHJhbmRvbSBhbmQgc2lnbmF0dXJlIG9iamVjdHNcclxuICAgICAqICAgICBmcm9tIHRoZSByZXNwb25zZSB0aGF0IHdhcyB1c2VkIHRvIHNhdGlzZnkgdGhlIHRpY2tldCBpcyByZXR1cm5lZC5cclxuICAgICAqICAgICBGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHNlZSB0aGUgZG9jdW1lbnRhdGlvbiBmb3IgZ2V0VGlja2V0LlxyXG4gICAgICogKiAqKmNyZWF0aW9uVGltZSoqOiBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0XHJcbiAgICAgKiAgICAgd2FzIGNyZWF0ZWQuXHJcbiAgICAgKiAqICoqdXNlZFRpbWUqKiBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0IHdhc1xyXG4gICAgICogICAgIHVzZWQuIElmIHRoZSB0aWNrZXQgaGFzIG5vdCBiZWVuIHVzZWQgeWV0LCB0aGlzIHZhbHVlIGlzIG51bGwuXHJcbiAgICAgKiAqICoqc2VyaWFsTnVtYmVyKio6IEEgbnVtZXJpYyB2YWx1ZSBpbmRpY2F0aW5nIHdoaWNoIHNlcmlhbCBudW1iZXIgKHdpdGhpblxyXG4gICAgICogICAgIHRoZSBBUEkga2V5IHVzZWQgdG8gc2VydmUgdGhlIHRpY2tldCkgd2FzIHVzZWQgZm9yIHRoZSB0aWNrZXQuIElmIHRoZVxyXG4gICAgICogICAgIGNhbGxlciBoYXMgdGhlIHVuaGFzaGVkIEFQSSBrZXksIHRoZXkgY2FuIHVzZSB0aGUgc2VyaWFsTnVtYmVyIHJldHVybmVkXHJcbiAgICAgKiAgICAgdG8gb2J0YWluIHRoZSBmdWxsIHJlc3VsdCB2aWEgdGhlIGdldFJlc3VsdCBtZXRob2QuIElmIHRoZSB0aWNrZXQgaGFzXHJcbiAgICAgKiAgICAgbm90IGJlZW4gdXNlZCB5ZXQsIHRoaXMgdmFsdWUgaXMgbnVsbC5cclxuICAgICAqICogKipleHBpcmF0aW9uVGltZSoqOiBUaGUgdGltZXN0YW1wIGluIElTTyA4NjAxIGZvcm1hdCBhdCB3aGljaCB0aGUgdGlja2V0XHJcbiAgICAgKiAgICAgZXhwaXJlcy4gSWYgdGhlIHRpY2tldCBoYXMgbm90IGJlZW4gdXNlZCB5ZXQsIHRoaXMgdmFsdWUgaXMgbnVsbC5cclxuICAgICAqICogKipwcmV2aW91c1RpY2tldElkKio6IFRoZSBwcmV2aW91cyB0aWNrZXQgaW4gdGhlIGNoYWluIHRvIHdoaWNoIHRoaXMgdGlja2V0XHJcbiAgICAgKiAgICAgYmVsb25ncy4gSWYgdGhlIHRpY2tldCBpcyB0aGUgZmlyc3QgaW4gaXRzIGNoYWluLCB0aGVuIHByZXZpb3VzVGlja2V0SWQgaXNcclxuICAgICAqICAgICBudWxsLlxyXG4gICAgICogKiAqKm5leHRUaWNrZXRJZCoqIEEgc3RyaW5nIHZhbHVlIHRoYXQgaWRlbnRpZmllcyB0aGUgbmV4dFxyXG4gICAgICogICAgIHRpY2tldCBpbiB0aGUgY2hhaW4uXHJcbiAgICAgKiBcclxuICAgICAqICAgICBJZiBzaG93UmVzdWx0IHdhcyBzZXQgdG8gdHJ1ZSB3aGVuIHRoZSB0aWNrZXQgd2FzIGNyZWF0ZWQsXHJcbiAgICAgKiAgICAgdGhlIGZvbGxvd2luZyBmaWVsZCB3aWxsIGFsc28gYmUgYWRkZWQ6XHJcbiAgICAgKiAqICoqcmVzdWx0KiogVGhlIHNhbWUgb2JqZWN0IHRoYXQgd2FzIHJldHVybmVkIGJ5IHRoZSBtZXRob2QgdGhhdCB3YXMgb3JpZ2luYWxseVxyXG4gICAgICogICAgIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHZhbHVlcy4gVGhpcyBpbmNsdWRlcyB0aGUgcmFuZG9tIGZpZWxkIHdoaWNoIGNvbnRhaW5zIHRoZVxyXG4gICAgICogICAgIGRhdGEgcHJvcGVydHksIGFuZCBhIHNpZ25hdHVyZSBmaWVsZCwgcmVxdWlyZWQgdG8gdmVyaWZ5IHRoZSByZXN1bHQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdTZW5kVGltZW91dEVycm9yfSBUaHJvd24gd2hlbiBibG9ja2luZyB0aW1lb3V0IGlzIGV4Y2VlZGVkXHJcbiAgICAgKiAgICAgYmVmb3JlIHRoZSByZXF1ZXN0IGNhbiBiZSBzZW50LlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnS2V5Tm90UnVubmluZ0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSBoYXMgYmVlblxyXG4gICAgICogICAgIHN0b3BwZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgQVBJIGtleSdzIHNlcnZlclxyXG4gICAgICogICAgIHJlcXVlc3RzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICBiaXRzIGFsbG93YW5jZSBoYXMgYmVlbiBleGNlZWRlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yfSBUaHJvd24gd2hlbiBhIEhUVFAgMjAwIE9LIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgaXMgbm90IHJlY2VpdmVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnUkFORE9NT1JHRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIFJBTkRPTS5PUkdcclxuICAgICAqICAgICBFcnJvci5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0pTT05SUENFcnJvcn0gVGhyb3duIHdoZW4gdGhlIHNlcnZlciByZXR1cm5zIGEgSlNPTi1SUEMgRXJyb3IuXHJcbiAgICAgKi9cclxuICAgIGFzeW5jIGdldFRpY2tldCh0aWNrZXRJZCkge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIHRpY2tldElkOiB0aWNrZXRJZFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNnZW5lcmF0ZVJlcXVlc3QoUmFuZG9tT3JnQ2xpZW50LiNHRVRfVElDS0VUX01FVEhPRCwgcGFyYW1zKTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZXh0cmFjdFJlc3VsdCh0aGlzLiNzZW5kUmVxdWVzdChyZXF1ZXN0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgdGhlIFVSTCBmb3IgdGhlIHNpZ25hdHVyZSB2ZXJpZmljYXRpb24gcGFnZSBvZiBhIHJlc3BvbnNlIHByZXZpb3VzbHlcclxuICAgICAqIHJlY2VpdmVkIGZyb20gb25lIG9mIHRoZSBtZXRob2RzIGluIHRoZSBTaWduZWQgQVBJIHdpdGggdGhlIHNlcnZlci4gVGhlXHJcbiAgICAgKiB3ZWItcGFnZSBhY2Nlc3NpYmxlIGZyb20gdGhpcyBVUkwgd2lsbCBjb250YWluIHRoZSBkZXRhaWxzIG9mIHRoZSByZXNwb25zZVxyXG4gICAgICogdXNlZCBpbiB0aGlzIG1ldGhvZCwgcHJvdmlkZWQgdGhhdCB0aGUgc2lnbmF0dXJlIGNhbiBiZSB2ZXJpZmllZC4gVGhpc1xyXG4gICAgICogVVJMIGlzIGFsc28gc2hvd24gdW5kZXIgXCJTaG93IFRlY2huaWNhbCBEZXRhaWxzXCIgd2hlbiB0aGUgb25saW5lIFNpZ25hdHVyZVxyXG4gICAgICogVmVyaWZpY2F0aW9uIEZvcm0gaXMgdXNlZCB0byB2YWxpZGF0ZSBhIHNpZ25hdHVyZS4gU2VlOlxyXG4gICAgICogaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9zaWduYXR1cmVzL2Zvcm1cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByYW5kb20gVGhlIHJhbmRvbSBmaWVsZCBmcm9tIGEgcmVzcG9uc2UgcmV0dXJuZWQgYnlcclxuICAgICAqICAgICBSQU5ET00uT1JHIHRocm91Z2ggb25lIG9mIHRoZSBTaWduZWQgQVBJIG1ldGhvZHMuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2lnbmF0dXJlIFRoZSBzaWduYXR1cmUgZmllbGQgZnJvbSB0aGUgc2FtZSByZXNwb25zZVxyXG4gICAgICogICAgIHRoYXQgdGhlIHJhbmRvbSBmaWVsZCBvcmlnaW5hdGVzIGZyb20uXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBBIHN0cmluZyBjb250YWluaW5nIHRoZSBzaWduYXR1cmUgdmVyaWZpY2F0aW9uIFVSTC5cclxuICAgICAqIEB0aHJvd3MgUmFuZG9tT3JnUkFORE9NT1JHRXJyb3Igd2hlbiB0aGUgVVJMIGlzIHRvbyBsb25nIChtYXguIDIsMDQ2XHJcbiAgICAgKiAgICAgY2hhcmFjdGVycykuXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZVVybChyYW5kb20sIHNpZ25hdHVyZSkge1xyXG4gICAgICAgIGxldCBmb3JtYXR0ZWRSYW5kb20gPSB0aGlzLiNmb3JtYXRVcmwoSlNPTi5zdHJpbmdpZnkocmFuZG9tKSk7XHJcbiAgICAgICAgbGV0IGZvcm1hdHRlZFNpZ25hdHVyZSA9IHRoaXMuI2Zvcm1hdFVybChzaWduYXR1cmUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCB1cmwgPSAnaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9zaWduYXR1cmVzL2Zvcm0/Zm9ybWF0PWpzb24nOyAgICBcclxuICAgICAgICB1cmwgKz0gJyZyYW5kb209JyArIGZvcm1hdHRlZFJhbmRvbTtcclxuICAgICAgICB1cmwgKz0gJyZzaWduYXR1cmU9JyArIGZvcm1hdHRlZFNpZ25hdHVyZTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodXJsLmxlbmd0aCA+IFJhbmRvbU9yZ0NsaWVudC5NQVhfVVJMX0xFTkdUSCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IoJ0Vycm9yOiBVUkwgZXhjZWVkcyBtYXhpbXVtIGxlbmd0aCdcclxuICAgICAgICAgICAgICAgICsgJygnICsgUmFuZG9tT3JnQ2xpZW50Lk1BWF9VUkxfTEVOR1RIICsgJyBjaGFyYWN0ZXJzKS4nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHVybDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSB0aGUgSFRNTCBmb3JtIGZvciB0aGUgc2lnbmF0dXJlIHZlcmlmaWNhdGlvbiBwYWdlIG9mIGEgcmVzcG9uc2VcclxuICAgICAqIHByZXZpb3VzbHkgcmVjZWl2ZWQgZnJvbSBvbmUgb2YgdGhlIG1ldGhvZHMgaW4gdGhlIFNpZ25lZCBBUEkgd2l0aCB0aGVcclxuICAgICAqIHNlcnZlci4gVGhlIHdlYi1wYWdlIGFjY2Vzc2libGUgZnJvbSB0aGUgXCJWYWxpZGF0ZVwiIGJ1dHRvbiBjcmVhdGVkIHdpbGxcclxuICAgICAqIGNvbnRhaW4gdGhlIGRldGFpbHMgb2YgdGhlIHJlc3BvbnNlIHVzZWQgaW4gdGhpcyBtZXRob2QsIHByb3ZpZGVkIHRoYXRcclxuICAgICAqIHRoZSBzaWduYXR1cmUgY2FuIGJlIHZlcmlmaWVkLiBUaGUgc2FtZSBIVE1MIGZvcm0gaXMgYWxzbyBzaG93biB1bmRlclxyXG4gICAgICogXCJTaG93IFRlY2huaWNhbCBEZXRhaWxzXCIgd2hlbiB0aGUgb25saW5lIFNpZ25hdHVyZSBWZXJpZmljYXRpb24gRm9ybSBpc1xyXG4gICAgICogdXNlZCB0byB2YWxpZGF0ZSBhIHNpZ25hdHVyZS4gU2VlOiBodHRwczovL2FwaS5yYW5kb20ub3JnL3NpZ25hdHVyZXMvZm9ybVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJhbmRvbSBUaGUgcmFuZG9tIGZpZWxkIGZyb20gYSByZXNwb25zZSByZXR1cm5lZCBieVxyXG4gICAgICogICAgIFJBTkRPTS5PUkcgdGhyb3VnaCBvbmUgb2YgdGhlIFNpZ25lZCBBUEkgbWV0aG9kcy5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaWduYXR1cmUgVGhlIHNpZ25hdHVyZSBmaWVsZCBmcm9tIHRoZSBzYW1lIHJlc3BvbnNlXHJcbiAgICAgKiAgICAgdGhhdCB0aGUgcmFuZG9tIGZpZWxkIG9yaWdpbmF0ZXMgZnJvbS5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IEEgc3RyaW5nIGNvbnRhaW5pbmcgdGhlIGNvZGUgZm9yIHRoZSBIVE1MIGZvcm0uXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZUh0bWwocmFuZG9tLCBzaWduYXR1cmUpIHtcclxuICAgICAgICBsZXQgcyA9ICc8Zm9ybSBhY3Rpb249XFwnaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9zaWduYXR1cmVzL2Zvcm1cXCcgbWV0aG9kPVxcJ3Bvc3RcXCc+XFxuJztcclxuICAgICAgICBzICs9ICcgICcgKyB0aGlzLiNpbnB1dEhUTUwoJ2hpZGRlbicsICdmb3JtYXQnLCAnanNvbicpICsgJ1xcbic7XHJcbiAgICAgICAgcyArPSAnICAnICsgdGhpcy4jaW5wdXRIVE1MKCdoaWRkZW4nLCAncmFuZG9tJywgSlNPTi5zdHJpbmdpZnkocmFuZG9tKSkgKyAnXFxuJztcclxuICAgICAgICBzICs9ICcgICcgKyB0aGlzLiNpbnB1dEhUTUwoJ2hpZGRlbicsICdzaWduYXR1cmUnLCBzaWduYXR1cmUpICsgJ1xcbic7XHJcbiAgICAgICAgcyArPSAnICA8aW5wdXQgdHlwZT1cXCdzdWJtaXRcXCcgdmFsdWU9XFwnVmFsaWRhdGVcXCcgLz5cXG48L2Zvcm0+JztcclxuICAgICAgICByZXR1cm4gcztcclxuICAgIH1cclxuXHJcbiAgICAvLyBDUkVBVElORyBDQUNIRVNcclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gcmFuZG9tIGludGVnZXJzLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgUmFuZG9tT3JnQ2FjaGUgY2FuIGJlIHBvbGxlZCBmb3IgbmV3IHJlc3VsdHMgY29uZm9ybWluZyB0byB0aGUgb3V0cHV0XHJcbiAgICAgKiBmb3JtYXQgb2YgdGhlIGlucHV0IHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gaW50ZWdlcnMgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIFRoZSBsb3dlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2ggdGhlIHJhbmRvbVxyXG4gICAgICogICAgIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIE11c3QgYmUgd2l0aGluIHRoZSBbLTFlOSwxZTldIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCBUaGUgdXBwZXIgYm91bmRhcnkgZm9yIHRoZSByYW5nZSBmcm9tIHdoaWNoIHRoZSByYW5kb21cclxuICAgICAqICAgICBudW1iZXJzIHdpbGwgYmUgcGlja2VkLiBNdXN0IGJlIHdpdGhpbiB0aGUgWy0xZTksMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3JlcGxhY2VtZW50PzogYm9vbGVhbiwgYmFzZT86IG51bWJlciwgY2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9uc1xyXG4gICAgICogICAgIEFuIG9iamVjdCB3aGljaCBtYXkgY29udGFpbiBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXBsYWNlbWVudD10cnVlXSBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbnVtYmVyc1xyXG4gICAgICogICAgIG1heSBjb250YWluIGR1cGxpY2F0ZSB2YWx1ZXMsIG90aGVyd2lzZSB0aGUgbnVtYmVycyB3aWxsIGFsbCBiZSB1bmlxdWVcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5iYXNlPTEwXSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5IHRoZVxyXG4gICAgICogICAgIG51bWJlcnMuIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYgKGRlZmF1bHQgMTApLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNhY2hlU2l6ZT0yMF0gVGhlIG51bWJlciBvZiByZXN1bHQtc2V0cyBmb3IgdGhlXHJcbiAgICAgKiAgICAgY2FjaGUgdG8gdHJ5IHRvIG1haW50YWluIGF0IGFueSBnaXZlbiB0aW1lIChkZWZhdWx0IDIwLCBtaW5pbXVtIDIpLlxyXG4gICAgICogQHJldHVybnMge1JhbmRvbU9yZ0NhY2hlfSBBbiBpbnN0YW5jZSBvZiB0aGUgUmFuZG9tT3JnQ2FjaGUgY2xhc3Mgd2hpY2hcclxuICAgICAqICAgICBjYW4gYmUgcG9sbGVkIGZvciBhcnJheXMgb2YgdHJ1ZSByYW5kb20gaW50ZWdlcnMuXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZUludGVnZXJDYWNoZShuLCBtaW4sIG1heCwgb3B0aW9ucyA9IHt9KSB7XHJcbiAgICAgICAgbGV0IGNhY2hlU2l6ZSA9IG9wdGlvbnMuY2FjaGVTaXplIHx8IDIwO1xyXG4gICAgICAgIGlmIChjYWNoZVNpemUgPCAyKSB7XHJcbiAgICAgICAgICAgIGNhY2hlU2l6ZSA9IDI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2ludGVnZXJSZXF1ZXN0KG4sIG1pbiwgbWF4LCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IE1hdGguY2VpbChNYXRoLmxvZyhtYXggLSBtaW4gKyAxKSAvIE1hdGgubG9nKDIpICogbik7XHJcbiAgICAgICAgbGV0IGJ1bGtOID0gMDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiBwb3NzaWJsZSwgbWFrZSByZXF1ZXN0cyBtb3JlIGVmZmljaWVudCBieSBidWxrLW9yZGVyaW5nIGZyb20gdGhlXHJcbiAgICAgICAgLy8gc2VydmVyLiBJbml0aWFsbHkgc2V0IGF0IGNhY2hlU2l6ZS8yLCBidXQgY2FjaGUgd2lsbCBhdXRvLXNocmluayBidWxrXHJcbiAgICAgICAgLy8gcmVxdWVzdCBzaXplIGlmIHJlcXVlc3RzIGNhbid0IGJlIGZ1bGZpbGxlZC5cclxuICAgICAgICBpZiAoISgncmVwbGFjZW1lbnQnIGluIG9wdGlvbnMpIHx8IG9wdGlvbnMucmVwbGFjZW1lbnQgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgYnVsa04gPSBjYWNoZVNpemUgLyAyO1xyXG4gICAgICAgICAgICByZXF1ZXN0LnBhcmFtcy5uID0gbiAqIGJ1bGtOO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBSYW5kb21PcmdDYWNoZSh0aGlzLiNzZW5kUmVxdWVzdC5iaW5kKHRoaXMpLCByZXF1ZXN0LCBjYWNoZVNpemUsXHJcbiAgICAgICAgICAgIGJ1bGtOLCBuLCBtYXhSZXF1ZXN0U2l6ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGEgUmFuZG9tT3JnQ2FjaGUgdG8gb2J0YWluIHJhbmRvbSBpbnRlZ2VyIHNlcXVlbmNlcy5cclxuICAgICAqIFxyXG4gICAgICogVGhlIFJhbmRvbU9yZ0NhY2hlIGNhbiBiZSBwb2xsZWQgZm9yIG5ldyByZXN1bHRzIGNvbmZvcm1pbmcgdG8gdGhlIG91dHB1dFxyXG4gICAgICogZm9ybWF0IG9mIHRoZSBpbnB1dCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGludGVnZXIgc2VxdWVuY2VzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpblxyXG4gICAgICogICAgIHRoZSBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gbGVuZ3RoIFRoZSBsZW5ndGggb2YgZWFjaCBhcnJheSBvZiByYW5kb21cclxuICAgICAqICAgICBpbnRlZ2VycyByZXF1ZXN0ZWQuIEZvciB1bmlmb3JtIHNlcXVlbmNlcywgbGVuZ3RoIG11c3QgYmUgYW4gaW50ZWdlclxyXG4gICAgICogICAgIGluIHRoZSBbMSwgMWU0XSByYW5nZS4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIGxlbmd0aCBjYW4gYmUgYW4gYXJyYXlcclxuICAgICAqICAgICB3aXRoIG4gaW50ZWdlcnMsIGVhY2ggc3BlY2lmeWluZyB0aGUgbGVuZ3RoIG9mIHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkXHJcbiAgICAgKiAgICAgYnkgaXRzIGluZGV4LiBJbiB0aGlzIGNhc2UsIGVhY2ggdmFsdWUgaW4gbGVuZ3RoIG11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLCAxZTRdIHJhbmdlIGFuZCB0aGUgdG90YWwgc3VtIG9mIGFsbCB0aGUgbGVuZ3RocyBtdXN0IGJlIGluIHRoZVxyXG4gICAgICogICAgIFsxLCAxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gbWluIFRoZSBsb3dlciBib3VuZGFyeSBmb3IgdGhlIHJhbmdlIGZyb20gd2hpY2hcclxuICAgICAqICAgICB0aGUgcmFuZG9tIG51bWJlcnMgd2lsbCBiZSBwaWNrZWQuIEZvciB1bmlmb3JtIHNlcXVlbmNlcywgbWluIG11c3QgYmVcclxuICAgICAqICAgICBhbiBpbnRlZ2VyIGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS4gRm9yIG11bHRpZm9ybSBzZXF1ZW5jZXMsIG1pbiBjYW5cclxuICAgICAqICAgICBiZSBhbiBhcnJheSB3aXRoIG4gaW50ZWdlcnMsIGVhY2ggc3BlY2lmeWluZyB0aGUgbG93ZXIgYm91bmRhcnkgb2YgdGhlXHJcbiAgICAgKiAgICAgc2VxdWVuY2UgaWRlbnRpZmllZCBieSBpdHMgaW5kZXguIEluIHRoaXMgY2FzZSwgZWFjaCB2YWx1ZSBpbiBtaW4gbXVzdFxyXG4gICAgICogICAgIGJlIHdpdGhpbiB0aGUgWy0xZTksIDFlOV0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBtYXggVGhlIHVwcGVyIGJvdW5kYXJ5IGZvciB0aGUgcmFuZ2UgZnJvbSB3aGljaFxyXG4gICAgICogICAgIHRoZSByYW5kb20gbnVtYmVycyB3aWxsIGJlIHBpY2tlZC4gRm9yIHVuaWZvcm0gc2VxdWVuY2VzLCBtYXggbXVzdCBiZVxyXG4gICAgICogICAgIGFuIGludGVnZXIgaW4gdGhlIFstMWU5LCAxZTldIHJhbmdlLiBGb3IgbXVsdGlmb3JtIHNlcXVlbmNlcywgbWF4IGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VycywgZWFjaCBzcGVjaWZ5aW5nIHRoZSB1cHBlciBib3VuZGFyeSBvZiB0aGVcclxuICAgICAqICAgICBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleC4gSW4gdGhpcyBjYXNlLCBlYWNoIHZhbHVlIGluIG1heCBtdXN0XHJcbiAgICAgKiAgICAgYmUgd2l0aGluIHRoZSBbLTFlOSwgMWU5XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3JlcGxhY2VtZW50PzogYm9vbGVhbnxib29sZWFuW10sIGJhc2U/OiBudW1iZXJ8bnVtYmVyW10sXHJcbiAgICAgKiAgICAgY2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5IGNvbnRhaW4gYW55IG9mIHRoZVxyXG4gICAgICogICAgIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufGJvb2xlYW5bXX0gcmVwbGFjZW1lbnQgU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHJhbmRvbSBudW1iZXJzXHJcbiAgICAgKiAgICAgc2hvdWxkIGJlIHBpY2tlZCB3aXRoIHJlcGxhY2VtZW50LiBJZiB0cnVlLCB0aGUgcmVzdWx0aW5nIG51bWJlcnMgbWF5XHJcbiAgICAgKiAgICAgY29udGFpbiBkdXBsaWNhdGUgdmFsdWVzLCBvdGhlcndpc2UgdGhlIG51bWJlcnMgd2lsbCBhbGwgYmUgdW5pcXVlLiBGb3JcclxuICAgICAqICAgICBtdWx0aWZvcm0gc2VxdWVuY2VzLCByZXBsYWNlbWVudCBjYW4gYmUgYW4gYXJyYXkgd2l0aCBuIGJvb2xlYW4gdmFsdWVzLFxyXG4gICAgICogICAgIGVhY2ggc3BlY2lmeWluZyB3aGV0aGVyIHRoZSBzZXF1ZW5jZSBpZGVudGlmaWVkIGJ5IGl0cyBpbmRleCB3aWxsIGJlXHJcbiAgICAgKiAgICAgY3JlYXRlZCB3aXRoICh0cnVlKSBvciB3aXRob3V0IChmYWxzZSkgcmVwbGFjZW1lbnQgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXX0gYmFzZSBUaGUgYmFzZSB0aGF0IHdpbGwgYmUgdXNlZCB0byBkaXNwbGF5IHRoZSBudW1iZXJzLlxyXG4gICAgICogICAgIFZhbHVlcyBhbGxvd2VkIGFyZSAyLCA4LCAxMCBhbmQgMTYuIEZvciBtdWx0aWZvcm0gc2VxdWVuY2VzLCBiYXNlIGNhblxyXG4gICAgICogICAgIGJlIGFuIGFycmF5IHdpdGggbiBpbnRlZ2VyIHZhbHVlcyB0YWtlbiBmcm9tIHRoZSBzYW1lIHNldCwgZWFjaFxyXG4gICAgICogICAgIHNwZWNpZnlpbmcgdGhlIGJhc2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gZGlzcGxheSB0aGUgc2VxdWVuY2UgaWRlbnRpZmllZFxyXG4gICAgICogICAgIGJ5IGl0cyBpbmRleCAoZGVmYXVsdCAxMCkuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2FjaGVTaXplIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZSBjYWNoZSB0byB0cnlcclxuICAgICAqICAgICB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAyMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIGludGVnZXIgc2VxdWVuY2VzLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVJbnRlZ2VyU2VxdWVuY2VDYWNoZShuLCBsZW5ndGgsIG1pbiwgbWF4LCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgY2FjaGVTaXplID0gb3B0aW9ucy5jYWNoZVNpemUgfHwgMjA7XHJcbiAgICAgICAgaWYgKGNhY2hlU2l6ZSA8IDIpIHtcclxuICAgICAgICAgICAgY2FjaGVTaXplID0gMjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IG1heFJlcXVlc3RTaXplID0gTWF0aC5jZWlsKE1hdGgubG9nKHRoaXMuI21heFZhbHVlKG1heCkgLSB0aGlzLiNtaW5WYWx1ZShtaW4pLCArIDEpXHJcbiAgICAgICAgICAgIC8gTWF0aC5sb2coMikgKiBuICogdGhpcy4jbWF4VmFsdWUobGVuZ3RoKSk7XHJcblxyXG4gICAgICAgIC8vIElmIHBvc3NpYmxlLCBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGVcclxuICAgICAgICAvLyBzZXJ2ZXIuIEluaXRpYWxseSBzZXQgYXQgY2FjaGVTaXplLzIsIGJ1dCBjYWNoZSB3aWxsIGF1dG8tc2hyaW5rIGJ1bGtcclxuICAgICAgICAvLyByZXF1ZXN0IHNpemUgaWYgcmVxdWVzdHMgY2FuJ3QgYmUgZnVsZmlsbGVkLlxyXG4gICAgICAgIGxldCBidWxrTiA9IDA7XHJcblxyXG4gICAgICAgIC8vIGlmIHJlcGxhY2VtZW50IGlzIGFuIGFycmF5LCBjaGVjayBpZiBhbGwgdmFsdWVzIGFyZSBzZXQgdG8gdHJ1ZVxyXG4gICAgICAgIGxldCByZXBsO1xyXG4gICAgICAgIGlmIChvcHRpb25zLnJlcGxhY2VtZW50ICYmIEFycmF5LmlzQXJyYXkob3B0aW9ucy5yZXBsYWNlbWVudCkpIHtcclxuICAgICAgICAgICAgcmVwbCA9IG9wdGlvbnMucmVwbGFjZW1lbnQuZXZlcnkoeCA9PiB4ID09PSB0cnVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXBsID0gb3B0aW9ucy5yZXBsYWNlbWVudCB8fCB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gaWYgYnVsayByZXF1ZXN0cyBjYW4gYmUgdXNlZCwgbWFrZSBhZGp1c3RtZW50cyB0byBhcnJheS10eXBlIHBhcmFtZXRlcnNcclxuICAgICAgICBpZiAocmVwbCkge1xyXG4gICAgICAgICAgICBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShsZW5ndGgpKSB7XHJcbiAgICAgICAgICAgICAgICBsZW5ndGggPSB0aGlzLiNhZGp1c3QobGVuZ3RoLCBidWxrTik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KG1pbikpIHtcclxuICAgICAgICAgICAgICAgIG1pbiA9IHRoaXMuI2FkanVzdChtaW4sIGJ1bGtOKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF4KSkge1xyXG4gICAgICAgICAgICAgICAgbWF4ID0gdGhpcy4jYWRqdXN0KG1heCwgYnVsa04pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZXBsYWNlbWVudCAmJiBBcnJheS5pc0FycmF5KG9wdGlvbnMucmVwbGFjZW1lbnQpKSB7XHJcbiAgICAgICAgICAgICAgICBvcHRpb25zLnJlcGxhY2VtZW50ID0gdGhpcy4jYWRqdXN0KG9wdGlvbnMucmVwbGFjZW1lbnQsIGJ1bGtOKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYmFzZSAmJiBBcnJheS5pc0FycmF5KG9wdGlvbnMuYmFzZSkpIHtcclxuICAgICAgICAgICAgICAgIG9wdGlvbnMuYmFzZSA9IHRoaXMuI2FkanVzdChvcHRpb25zLmJhc2UsIGJ1bGtOKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNpbnRlZ2VyU2VxdWVuY2VSZXF1ZXN0KG4sIGxlbmd0aCwgbWluLCBtYXgsXHJcbiAgICAgICAgICAgIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICBpZiAocmVwbCkge1xyXG4gICAgICAgICAgICByZXF1ZXN0LnBhcmFtcy5uID0gYnVsa04gKiBuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBSYW5kb21PcmdDYWNoZSh0aGlzLiNzZW5kUmVxdWVzdC5iaW5kKHRoaXMpLCByZXF1ZXN0LCBjYWNoZVNpemUsIGJ1bGtOLCBuLCBtYXhSZXF1ZXN0U2l6ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGEgUmFuZG9tT3JnQ2FjaGUgdG8gb2J0YWluIHJhbmRvbSBkZWNpbWFsIGZyYWN0aW9ucy5cclxuICAgICAqIFxyXG4gICAgICogVGhlIFJhbmRvbU9yZ0NhY2hlIGNhbiBiZSBwb2xsZWQgZm9yIG5ldyByZXN1bHRzIGNvbmZvcm1pbmcgdG8gdGhlIG91dHB1dFxyXG4gICAgICogZm9ybWF0IG9mIHRoZSBpbnB1dCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zIHlvdSBuZWVkLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlY2ltYWxQbGFjZXMgVGhlIG51bWJlciBvZiBkZWNpbWFsIHBsYWNlcyB0byB1c2UuIE11c3RcclxuICAgICAqICAgICBiZSB3aXRoaW4gdGhlIFsxLDIwXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e3JlcGxhY2VtZW50PzogYm9vbGVhbiwgY2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2hcclxuICAgICAqICAgICBtYXkgY29udGFpbiBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXBsYWNlbWVudD10cnVlXSBTcGVjaWZpZXMgd2hldGhlciB0aGUgcmFuZG9tXHJcbiAgICAgKiAgICAgbnVtYmVycyBzaG91bGQgYmUgcGlja2VkIHdpdGggcmVwbGFjZW1lbnQuIElmIHRydWUsIHRoZSByZXN1bHRpbmcgbnVtYmVyc1xyXG4gICAgICogICAgIG1heSBjb250YWluIGR1cGxpY2F0ZSB2YWx1ZXMsIG90aGVyd2lzZSB0aGUgbnVtYmVycyB3aWxsIGFsbCBiZSB1bmlxdWVcclxuICAgICAqICAgICAoZGVmYXVsdCB0cnVlKS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jYWNoZVNpemU9MjBdIFRoZSBudW1iZXIgb2YgcmVzdWx0LXNldHMgZm9yIHRoZSBjYWNoZVxyXG4gICAgICogICAgIHRvIHRyeSB0byBtYWludGFpbiBhdCBhbnkgZ2l2ZW4gdGltZSAoZGVmYXVsdCAyMCwgbWluaW11bSAyKS5cclxuICAgICAqIEByZXR1cm5zIHtSYW5kb21PcmdDYWNoZX0gQW4gaW5zdGFuY2Ugb2YgdGhlIFJhbmRvbU9yZ0NhY2hlIGNsYXNzIHdoaWNoXHJcbiAgICAgKiAgICAgY2FuIGJlIHBvbGxlZCBmb3IgYXJyYXlzIG9mIHRydWUgcmFuZG9tIGRlY2ltYWwgZnJhY3Rpb25zLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVEZWNpbWFsRnJhY3Rpb25DYWNoZShuLCBkZWNpbWFsUGxhY2VzLCBvcHRpb25zID0ge30pIHtcclxuICAgICAgICBsZXQgY2FjaGVTaXplID0gb3B0aW9ucy5jYWNoZVNpemUgfHwgMjA7XHJcbiAgICAgICAgaWYgKGNhY2hlU2l6ZSA8IDIpIHtcclxuICAgICAgICAgICAgY2FjaGVTaXplID0gMjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZGVjaW1hbEZyYWN0aW9uUmVxdWVzdChuLCBkZWNpbWFsUGxhY2VzLCBvcHRpb25zKTtcclxuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gMDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiBwb3NzaWJsZSwgbWFrZSByZXF1ZXN0cyBtb3JlIGVmZmljaWVudCBieSBidWxrLW9yZGVyaW5nIGZyb20gdGhlXHJcbiAgICAgICAgLy8gc2VydmVyLiBJbml0aWFsbHkgc2V0IGF0IGNhY2hlU2l6ZS8yLCBidXQgY2FjaGUgd2lsbCBhdXRvLXNocmluayBidWxrXHJcbiAgICAgICAgLy8gcmVxdWVzdCBzaXplIGlmIHJlcXVlc3RzIGNhbid0IGJlIGZ1bGZpbGxlZC5cclxuICAgICAgICBpZiAoISgncmVwbGFjZW1lbnQnIGluIG9wdGlvbnMpIHx8IG9wdGlvbnMucmVwbGFjZW1lbnQgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgYnVsa04gPSBjYWNoZVNpemUgLyAyO1xyXG4gICAgICAgICAgICByZXF1ZXN0LnBhcmFtcy5uID0gbiAqIGJ1bGtOO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IE1hdGguY2VpbChNYXRoLmxvZygxMCkgLyBNYXRoLmxvZygyKSAqIGRlY2ltYWxQbGFjZXMgKiBuKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBSYW5kb21PcmdDYWNoZSh0aGlzLiNzZW5kUmVxdWVzdC5iaW5kKHRoaXMpLCByZXF1ZXN0LCBjYWNoZVNpemUsIGJ1bGtOLFxyXG4gICAgICAgICAgICBuLCBtYXhSZXF1ZXN0U2l6ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIGEgUmFuZG9tT3JnQ2FjaGUgdG8gb2J0YWluIHJhbmRvbSBudW1iZXJzIGZyb20gYSBHYXVzc2lhbiBkaXN0cmlidXRpb24uXHJcbiAgICAgKiBcclxuICAgICAqIFRoZSBSYW5kb21PcmdDYWNoZSBjYW4gYmUgcG9sbGVkIGZvciBuZXcgcmVzdWx0cyBjb25mb3JtaW5nIHRvIHRoZSBvdXRwdXRcclxuICAgICAqIGZvcm1hdCBvZiB0aGUgaW5wdXQgcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBudW1iZXJzIHlvdSBuZWVkLiBNdXN0IGJlIHdpdGhpbiB0aGVcclxuICAgICAqICAgICBbMSwxZTRdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1lYW4gVGhlIGRpc3RyaWJ1dGlvbidzIG1lYW4uIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFstMWU2LDFlNl0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc3RhbmRhcmREZXZpYXRpb24gVGhlIGRpc3RyaWJ1dGlvbidzIHN0YW5kYXJkIGRldmlhdGlvbi5cclxuICAgICAqICAgICBNdXN0IGJlIHdpdGhpbiB0aGUgWy0xZTYsMWU2XSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaWduaWZpY2FudERpZ2l0cyBUaGUgbnVtYmVyIG9mIHNpZ25pZmljYW50IGRpZ2l0cyB0byB1c2UuXHJcbiAgICAgKiAgICAgTXVzdCBiZSB3aXRoaW4gdGhlIFsyLDIwXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e2NhY2hlU2l6ZT86IG51bWJlcn19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWluIHRoZSBmb2xsb3dpbmdcclxuICAgICAqICAgICBvcHRpb25hbCBwYXJhbWV0ZXI6XHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY2FjaGVTaXplPTIwXSBUaGUgbnVtYmVyIG9mIHJlc3VsdC1zZXRzIGZvciB0aGUgY2FjaGVcclxuICAgICAqICAgICB0byB0cnkgdG8gbWFpbnRhaW4gYXQgYW55IGdpdmVuIHRpbWUgKGRlZmF1bHQgMjAsIG1pbmltdW0gMikuXHJcbiAgICAgKiBAcmV0dXJucyB7UmFuZG9tT3JnQ2FjaGV9IEFuIGluc3RhbmNlIG9mIHRoZSBSYW5kb21PcmdDYWNoZSBjbGFzcyB3aGljaFxyXG4gICAgICogICAgIGNhbiBiZSBwb2xsZWQgZm9yIGFycmF5cyBvZiB0cnVlIHJhbmRvbSBudW1iZXJzIGZyb20gYSBHYXVzc2lhblxyXG4gICAgICogICAgIGRpc3RyaWJ1dGlvbi5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlR2F1c3NpYW5DYWNoZShuLCBtZWFuLCBzdGFuZGFyZERldmlhdGlvbiwgc2lnbmlmaWNhbnREaWdpdHMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAyMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IE1hdGguY2VpbChNYXRoLmxvZyhNYXRoLnBvdygxMCwgc2lnbmlmaWNhbnREaWdpdHMpKSAvIE1hdGgubG9nKDIpICogbik7XHJcblxyXG4gICAgICAgIC8vIG1ha2UgcmVxdWVzdHMgbW9yZSBlZmZpY2llbnQgYnkgYnVsay1vcmRlcmluZyBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICAgICAgLy8gSW5pdGlhbGx5IHNldCBhdCBjYWNoZVNpemUvMiwgYnV0IGNhY2hlIHdpbGwgYXV0by1zaHJpbmsgYnVsayByZXF1ZXN0XHJcbiAgICAgICAgLy8gc2l6ZSBpZiByZXF1ZXN0cyBjYW4ndCBiZSBmdWxmaWxsZWQuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gY2FjaGVTaXplIC8gMjtcclxuICAgICAgICBsZXQgcmVxdWVzdCA9IHRoaXMuI2dhdXNzaWFuUmVxdWVzdChuICogYnVsa04sIG1lYW4sIHN0YW5kYXJkRGV2aWF0aW9uLFxyXG4gICAgICAgICAgICBzaWduaWZpY2FudERpZ2l0cyk7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgUmFuZG9tT3JnQ2FjaGUodGhpcy4jc2VuZFJlcXVlc3QuYmluZCh0aGlzKSwgcmVxdWVzdCwgY2FjaGVTaXplLCBidWxrTixcclxuICAgICAgICAgICAgbiwgbWF4UmVxdWVzdFNpemUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBhIFJhbmRvbU9yZ0NhY2hlIHRvIG9idGFpbiByYW5kb20gc3RyaW5ncy5cclxuICAgICAqIFxyXG4gICAgICogVGhlIFJhbmRvbU9yZ0NhY2hlIGNhbiBiZSBwb2xsZWQgZm9yIG5ldyByZXN1bHRzIGNvbmZvcm1pbmcgdG8gdGhlIG91dHB1dFxyXG4gICAgICogZm9ybWF0IG9mIHRoZSBpbnB1dCByZXF1ZXN0LlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gSG93IG1hbnkgcmFuZG9tIHN0cmluZ3MgeW91IG5lZWQuIE11c3QgYmUgd2l0aGluIHRoZVxyXG4gICAgICogICAgIFsxLDFlNF0gcmFuZ2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVuZ3RoIFRoZSBsZW5ndGggb2YgZWFjaCBzdHJpbmcuIE11c3QgYmUgd2l0aGluIHRoZSBbMSwyMF1cclxuICAgICAqICAgICByYW5nZS4gQWxsIHN0cmluZ3Mgd2lsbCBiZSBvZiB0aGUgc2FtZSBsZW5ndGguXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVycyBBIHN0cmluZyB0aGF0IGNvbnRhaW5zIHRoZSBzZXQgb2YgY2hhcmFjdGVyc1xyXG4gICAgICogICAgIHRoYXQgYXJlIGFsbG93ZWQgdG8gb2NjdXIgaW4gdGhlIHJhbmRvbSBzdHJpbmdzLiBUaGUgbWF4aW11bSBudW1iZXJcclxuICAgICAqICAgICBvZiBjaGFyYWN0ZXJzIGlzIDgwLlxyXG4gICAgICogQHBhcmFtIHt7cmVwbGFjZW1lbnQ/OiBib29sZWFuLCBjYWNoZVNpemU/OiBudW1iZXJ9fSBvcHRpb25zIEFuIG9iamVjdCB3aGljaFxyXG4gICAgICogICAgIG1heSBjb250YWluIGFueSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbmFsIHBhcmFtZXRlcnM6XHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlcGxhY2VtZW50PXRydWVdIFNwZWNpZmllcyB3aGV0aGVyIHRoZSByYW5kb21cclxuICAgICAqICAgICBzdHJpbmdzIHNob3VsZCBiZSBwaWNrZWQgd2l0aCByZXBsYWNlbWVudC4gSWYgdHJ1ZSwgdGhlIHJlc3VsdGluZyBsaXN0XHJcbiAgICAgKiAgICAgb2Ygc3RyaW5ncyBtYXkgY29udGFpbiBkdXBsaWNhdGVzLCBvdGhlcndpc2UgdGhlIHN0cmluZ3Mgd2lsbCBhbGwgYmVcclxuICAgICAqICAgICB1bmlxdWUgKGRlZmF1bHQgdHJ1ZSkuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY2FjaGVTaXplPTIwXSBUaGUgbnVtYmVyIG9mIHJlc3VsdC1zZXRzIGZvciB0aGVcclxuICAgICAqICAgICBjYWNoZSB0byB0cnkgdG8gbWFpbnRhaW4gYXQgYW55IGdpdmVuIHRpbWUgKGRlZmF1bHQgMjAsIG1pbmltdW0gMikuXHJcbiAgICAgKiBAcmV0dXJucyB7UmFuZG9tT3JnQ2FjaGV9IEFuIGluc3RhbmNlIG9mIHRoZSBSYW5kb21PcmdDYWNoZSBjbGFzcyB3aGljaFxyXG4gICAgICogICAgIGNhbiBiZSBwb2xsZWQgZm9yIGFycmF5cyBvZiB0cnVlIHJhbmRvbSBzdHJpbmdzLlxyXG4gICAgICovXHJcbiAgICBjcmVhdGVTdHJpbmdDYWNoZShuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAyMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNzdHJpbmdSZXF1ZXN0KG4sIGxlbmd0aCwgY2hhcmFjdGVycywgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIC8vIG1heCBzaW5nbGUgcmVxdWVzdCBzaXplLCBpbiBiaXRzLCBmb3IgYWRqdXN0aW5nIGJ1bGsgcmVxdWVzdHMgbGF0ZXJcclxuICAgICAgICBsZXQgbWF4UmVxdWVzdFNpemUgPSBNYXRoLmNlaWwoTWF0aC5sb2coY2hhcmFjdGVycy5sZW5ndGgpIC8gTWF0aC5sb2coMikgKiBsZW5ndGggKiBuKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiBwb3NzaWJsZSwgbWFrZSByZXF1ZXN0cyBtb3JlIGVmZmljaWVudCBieSBidWxrLW9yZGVyaW5nIGZyb20gdGhlXHJcbiAgICAgICAgLy8gc2VydmVyLiBJbml0aWFsbHkgc2V0IGF0IGNhY2hlX3NpemUvMiwgYnV0IGNhY2hlIHdpbGwgYXV0by1zaHJpbmsgYnVsa1xyXG4gICAgICAgIC8vIHJlcXVlc3Qgc2l6ZSBpZiByZXF1ZXN0cyBjYW4ndCBiZSBmdWxmaWxsZWQuXHJcbiAgICAgICAgbGV0IGJ1bGtOID0gMDtcclxuICAgICAgICBpZiAoISgncmVwbGFjZW1lbnQnIGluIG9wdGlvbnMpIHx8IG9wdGlvbnMucmVwbGFjZW1lbnQgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgYnVsa04gPSBjYWNoZVNpemUgLyAyO1xyXG4gICAgICAgICAgICByZXF1ZXN0LnBhcmFtcy5uID0gbiAqIGJ1bGtOO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSwgYnVsa04sXHJcbiAgICAgICAgICAgIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gVVVJRHMuXHJcbiAgICAgKiBcclxuICAgICAqIFRoZSBSYW5kb21PcmdDYWNoZSBjYW4gYmUgcG9sbGVkIGZvciBuZXcgcmVzdWx0cyBjb25mb3JtaW5nIHRvIHRoZSBvdXRwdXRcclxuICAgICAqIGZvcm1hdCBvZiB0aGUgaW5wdXQgcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIEhvdyBtYW55IHJhbmRvbSBVVUlEcyB5b3UgbmVlZC4gTXVzdCBiZSB3aXRoaW4gdGhlXHJcbiAgICAgKiAgICAgWzEsMWUzXSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7e2NhY2hlU2l6ZT86IG51bWJlcn19IG9wdGlvbnMgQW4gb2JqZWN0IHdoaWNoIG1heSBjb250YWluIHRoZSBmb2xsb3dpbmdcclxuICAgICAqICAgICBvcHRpb25hbCBwYXJhbWV0ZXI6XHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY2FjaGVTaXplPTEwXSBUaGUgbnVtYmVyIG9mIHJlc3VsdC1zZXRzIGZvciB0aGUgY2FjaGVcclxuICAgICAqICAgICB0byB0cnkgdG8gbWFpbnRhaW4gYXQgYW55IGdpdmVuIHRpbWUgKGRlZmF1bHQgMTAsIG1pbmltdW0gMikuXHJcbiAgICAgKiBAcmV0dXJucyB7UmFuZG9tT3JnQ2FjaGV9IEFuIGluc3RhbmNlIG9mIHRoZSBSYW5kb21PcmdDYWNoZSBjbGFzcyB3aGljaFxyXG4gICAgICogICAgIGNhbiBiZSBwb2xsZWQgZm9yIGFycmF5cyBvZiB0cnVlIHJhbmRvbSBVVUlEcy5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlVVVJRENhY2hlKG4sIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAxMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IG4gKiBSYW5kb21PcmdDbGllbnQuVVVJRF9TSVpFO1xyXG5cclxuICAgICAgICAvLyBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGUgc2VydmVyLiBJbml0aWFsbHlcclxuICAgICAgICAvLyBzZXQgYXQgY2FjaGVTaXplLzIsIGJ1dCBjYWNoZSB3aWxsIGF1dG8tc2hyaW5rIGJ1bGsgcmVxdWVzdCBzaXplIGlmXHJcbiAgICAgICAgLy8gcmVxdWVzdHMgY2FuJ3QgYmUgZnVsZmlsbGVkLlxyXG4gICAgICAgIGxldCBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNVVUlEUmVxdWVzdChuICogYnVsa04pO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSwgYnVsa04sXHJcbiAgICAgICAgICAgIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYSBSYW5kb21PcmdDYWNoZSB0byBvYnRhaW4gcmFuZG9tIGJsb2JzLlxyXG4gICAgICogXHJcbiAgICAgKiBUaGUgUmFuZG9tT3JnQ2FjaGUgY2FuIGJlIHBvbGxlZCBmb3IgbmV3IHJlc3VsdHMgY29uZm9ybWluZyB0byB0aGUgb3V0cHV0XHJcbiAgICAgKiBmb3JtYXQgb2YgdGhlIGlucHV0IHJlcXVlc3QuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbiBIb3cgbWFueSByYW5kb20gYmxvYnMgeW91IG5lZWQuIG4qKGNhY2hlU2l6ZS8yKSBtdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxMDBdIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgVGhlIHNpemUgb2YgZWFjaCBibG9iLCBtZWFzdXJlZCBpbiBiaXRzLiBNdXN0IGJlXHJcbiAgICAgKiAgICAgd2l0aGluIHRoZSBbMSwxMDQ4NTc2XSByYW5nZSBhbmQgbXVzdCBiZSBkaXZpc2libGUgYnkgOC5cclxuICAgICAqIEBwYXJhbSB7e2Zvcm1hdD86IHN0cmluZywgY2FjaGVTaXplPzogbnVtYmVyfX0gb3B0aW9ucyBBbiBvYmplY3Qgd2hpY2ggbWF5XHJcbiAgICAgKiAgICAgY29udGFpbiBhbnkgb2YgdGhlIGZvbGxvd2luZyBvcHRpb25hbCBwYXJhbWV0ZXJzOlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmZvcm1hdD1iYXNlNjRdIFNwZWNpZmllcyB0aGUgZm9ybWF0IGluIHdoaWNoIHRoZVxyXG4gICAgICogICAgIGJsb2JzIHdpbGwgYmUgcmV0dXJuZWQuIFZhbHVlcyBhbGxvd2VkIGFyZSAnYmFzZTY0JyBhbmQgJ2hleCcgKGRlZmF1bHRcclxuICAgICAqICAgICAnYmFzZTY0JykuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY2FjaGVTaXplPTEwXSBUaGUgbnVtYmVyIG9mIHJlc3VsdC1zZXRzIGZvciB0aGUgY2FjaGVcclxuICAgICAqICAgICB0byB0cnkgdG8gbWFpbnRhaW4gYXQgYW55IGdpdmVuIHRpbWUgKGRlZmF1bHQgMTAsIG1pbmltdW0gMikuXHJcbiAgICAgKiBAcmV0dXJucyB7UmFuZG9tT3JnQ2FjaGV9IEFuIGluc3RhbmNlIG9mIHRoZSBSYW5kb21PcmdDYWNoZSBjbGFzcyB3aGljaFxyXG4gICAgICogICAgIGNhbiBiZSBwb2xsZWQgZm9yIGFycmF5cyBvZiB0cnVlIHJhbmRvbSBibG9icyBhcyBzdHJpbmdzLlxyXG4gICAgICogQHNlZSB7QGxpbmsgUmFuZG9tT3JnQ2xpZW50I0JMT0JfRk9STUFUX0JBU0U2NH0gZm9yICdiYXNlNjQnIChkZWZhdWx0KS5cclxuICAgICAqIEBzZWUge0BsaW5rIFJhbmRvbU9yZ0NsaWVudCNCTE9CX0ZPUk1BVF9IRVh9IGZvciAnaGV4Jy5cclxuICAgICAqL1xyXG4gICAgY3JlYXRlQmxvYkNhY2hlKG4sIHNpemUsIG9wdGlvbnMgPSB7fSkge1xyXG4gICAgICAgIGxldCBjYWNoZVNpemUgPSBvcHRpb25zLmNhY2hlU2l6ZSB8fCAxMDtcclxuICAgICAgICBpZiAoY2FjaGVTaXplIDwgMikge1xyXG4gICAgICAgICAgICBjYWNoZVNpemUgPSAyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gbWF4IHNpbmdsZSByZXF1ZXN0IHNpemUsIGluIGJpdHMsIGZvciBhZGp1c3RpbmcgYnVsayByZXF1ZXN0cyBsYXRlclxyXG4gICAgICAgIGxldCBtYXhSZXF1ZXN0U2l6ZSA9IG4gKiBzaXplO1xyXG5cclxuICAgICAgICAvLyBtYWtlIHJlcXVlc3RzIG1vcmUgZWZmaWNpZW50IGJ5IGJ1bGstb3JkZXJpbmcgZnJvbSB0aGUgc2VydmVyLiBJbml0aWFsbHlcclxuICAgICAgICAvLyBzZXQgYXQgY2FjaGVTaXplLzIsIGJ1dCBjYWNoZSB3aWxsIGF1dG8tc2hyaW5rIGJ1bGsgcmVxdWVzdCBzaXplIGlmXHJcbiAgICAgICAgLy8gcmVxdWVzdHMgY2FuJ3QgYmUgZnVsZmlsbGVkLlxyXG4gICAgICAgIGxldCBidWxrTiA9IGNhY2hlU2l6ZSAvIDI7XHJcbiAgICAgICAgbGV0IHJlcXVlc3QgPSB0aGlzLiNibG9iUmVxdWVzdChuICogYnVsa04sIHNpemUsIG9wdGlvbnMpO1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFJhbmRvbU9yZ0NhY2hlKHRoaXMuI3NlbmRSZXF1ZXN0LmJpbmQodGhpcyksIHJlcXVlc3QsIGNhY2hlU2l6ZSwgYnVsa04sXHJcbiAgICAgICAgICAgIG4sIG1heFJlcXVlc3RTaXplKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvcmUgc2VuZCByZXF1ZXN0IGZ1bmN0aW9uLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgUmVxdWVzdCBvYmplY3QgdG8gc2VuZC5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IEEgUHJvbWlzZSB3aGljaCwgaWYgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5LFxyXG4gICAgICogICAgIHJlcHJlc2VudHMgdGhlIHJlc3BvbnNlIHByb3ZpZGVkIGJ5IHRoZSBzZXJ2ZXIuIEVsc2UsIGl0IG1heSBiZSByZWplY3RlZFxyXG4gICAgICogICAgIHdpdGggb25lIG9mIHRoZSBmb2xsb3dpbmcgZXJyb3JzOlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvcn0gVGhyb3duIHdoZW4gYmxvY2tpbmcgdGltZW91dCBpcyBleGNlZWRlZFxyXG4gICAgICogICAgIGJlZm9yZSB0aGUgcmVxdWVzdCBjYW4gYmUgc2VudC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkgaGFzIGJlZW5cclxuICAgICAqICAgICBzdG9wcGVkLlxyXG4gICAgICogQHRocm93cyB7UmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcn0gVGhyb3duIHdoZW4gdGhlIEFQSSBrZXkncyBzZXJ2ZXJcclxuICAgICAqICAgICByZXF1ZXN0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3J9IFRocm93biB3aGVuIHRoZSBBUEkga2V5J3Mgc2VydmVyXHJcbiAgICAgKiAgICAgYml0cyBhbGxvd2FuY2UgaGFzIGJlZW4gZXhjZWVkZWQuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcn0gVGhyb3duIHdoZW4gYSBIVFRQIDIwMCBPSyByZXNwb25zZVxyXG4gICAgICogICAgIGlzIG5vdCByZWNlaXZlZC5cclxuICAgICAqIEB0aHJvd3Mge1JhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yfSBUaHJvd24gd2hlbiB0aGUgc2VydmVyIHJldHVybnMgYSBSQU5ET00uT1JHXHJcbiAgICAgKiAgICAgRXJyb3IuXHJcbiAgICAgKiBAdGhyb3dzIHtSYW5kb21PcmdKU09OUlBDRXJyb3J9IFRocm93biB3aGVuIHRoZSBzZXJ2ZXIgcmV0dXJucyBhIEpTT04tUlBDIEVycm9yLlxyXG4gICAgICovXHJcbiAgICAjc2VuZFJlcXVlc3QgPSBhc3luYyBmdW5jdGlvbiAocmVxdWVzdCkge1xyXG4gICAgICAgIC8vIElmIGEgYmFjay1vZmYgaXMgc2V0LCBubyBtb3JlIHJlcXVlc3RzIGNhbiBiZSBpc3N1ZWQgdW50aWwgdGhlIHJlcXVpcmVkIFxyXG4gICAgICAgIC8vIGJhY2stb2ZmIHRpbWUgaXMgdXAuXHJcbiAgICAgICAgaWYgKHRoaXMuI2JhY2tvZmYgIT0gLTEpIHsgICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVGltZSBub3QgeWV0IHVwLCB0aHJvdyBlcnJvci5cclxuICAgICAgICAgICAgaWYgKERhdGUubm93KCkgPCB0aGlzLiNiYWNrb2ZmKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcih0aGlzLiNiYWNrb2ZmRXJyb3IpO1xyXG4gICAgICAgICAgICAvLyBUaW1lIGlzIHVwLCBjbGVhciBiYWNrLW9mZi5cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuI2JhY2tvZmYgPSAtMTtcclxuICAgICAgICAgICAgICAgIHRoaXMuI2JhY2tvZmZFcnJvciA9IG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCB3YWl0ID0gdGhpcy4jYWR2aXNvcnlEZWxheSAtIChEYXRlLm5vdygpIC0gdGhpcy4jbGFzdFJlc3BvbnNlUmVjZWl2ZWRUaW1lKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuI2Jsb2NraW5nVGltZW91dCAhPSAtMSAmJiB3YWl0ID4gdGhpcy4jYmxvY2tpbmdUaW1lb3V0KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdTZW5kVGltZW91dEVycm9yKCdUaGUgc2VydmVyIGFkdmlzb3J5IGRlbGF5IG9mICcgXHJcbiAgICAgICAgICAgICAgICArIHdhaXQgKyAnbWlsbGlzIGlzIGdyZWF0ZXIgdGhhbiB0aGUgZGVmaW5lZCBtYXhpbXVtIGFsbG93ZWQgJ1xyXG4gICAgICAgICAgICAgICAgKyAnYmxvY2tpbmcgdGltZSBvZiAnICsgdGhpcy4jYmxvY2tpbmdUaW1lb3V0ICsgJ21pbGxpcy4nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh3YWl0ID4gMCkgeyBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgd2FpdCkpOyB9XHJcblxyXG4gICAgICAgIGxldCBodHRwVGltZW91dCA9IHRoaXMuI2h0dHBUaW1lb3V0O1xyXG5cclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xyXG4gICAgICAgICAgICBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgICAgIHhoci5vcGVuKCdQT1NUJywgJ2h0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9pbnZva2UnKTtcclxuICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgICAgICAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdTZW5kVGltZW91dEVycm9yKCdUaGUgbWF4aW11bSAnXHJcbiAgICAgICAgICAgICAgICAgICAgKyAnYWxsb3dlZCBibG9ja2luZyB0aW1lIG9mICcgKyBodHRwVGltZW91dCArICdtaWxsaXMgaGFzICdcclxuICAgICAgICAgICAgICAgICAgICArICdiZWVuIGV4Y2VlZGVkIHdoaWxlIHdhaXRpbmcgZm9yIHRoZSBzZXJ2ZXIgdG8gcmVzcG9uZC4nKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDMwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeGhyLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcignRXJyb3I6ICdcclxuICAgICAgICAgICAgICAgICAgICAgICAgKyB4aHIuc3RhdHVzKTtcclxuICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgICAgIC8vIHVuZG9jdW1lbnRlZCBlcnJvci5cclxuICAgICAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmluZm8oJyoqIEFuIGVycm9yIG9jY3VycmVkIGR1cmluZyB0aGUgdHJhbnNhY3Rpb24uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHhoci5yZXNwb25zZVRleHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB4aHIudGltZW91dCA9IGh0dHBUaW1lb3V0O1xyXG4gICAgICAgICAgICB4aHIuc2VuZChKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgICAgIC8vIHBhcnNlIHJlc3BvbnNlIHRvIGdldCBhbiBvYmplY3RcclxuICAgICAgICAgICAgcmVzcG9uc2UgPSBKU09OLnBhcnNlKHJlc3BvbnNlKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGZvciBlcnJvcnNcclxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgY29kZSA9IHJlc3BvbnNlLmVycm9yLmNvZGU7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWVzc2FnZSA9IHJlc3BvbnNlLmVycm9yLm1lc3NhZ2U7XHJcbiAgICAgICAgICAgICAgICBsZXQgZGF0YSA9IHJlc3BvbnNlLmVycm9yLmRhdGE7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGNvZGUgPT0gNDAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcignRXJyb3IgJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArIGNvZGUgKyAnOiAnICsgbWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvZGUgPT0gNDAyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IG1pZG5pZ2h0VVRDID0gbmV3IERhdGUoKS5zZXRVVENIb3VycygwLDAsMCwwKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLiNiYWNrb2ZmID0gK21pZG5pZ2h0VVRDO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuI2JhY2tvZmZFcnJvciA9ICdFcnJvciAnICsgY29kZSArICc6ICcgKyBtZXNzYWdlO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLiNyZXF1ZXN0c0xlZnQgPSBkYXRhWzFdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcih0aGlzLiNiYWNrb2ZmRXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb2RlID09IDQwMykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuI2JpdHNMZWZ0ID0gZGF0YVsxXTtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yKCdFcnJvcidcclxuICAgICAgICAgICAgICAgICAgICAgICAgKyBjb2RlICsgJzogJyArIG1lc3NhZ2UsIHRoaXMuI2JpdHNMZWZ0KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoUmFuZG9tT3JnQ2xpZW50LiNFUlJPUl9DT0RFUy5pbmNsdWRlcyhjb2RlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yIGZyb20gUkFORE9NLk9SRyBFcnJvcnM6IFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vYXBpLnJhbmRvbS5vcmcvanNvbi1ycGMvNC9lcnJvci1jb2Rlc1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5kb21PcmdSQU5ET01PUkdFcnJvcignRXJyb3IgJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArIGNvZGUgKyAnOiAnICsgbWVzc2FnZSwgY29kZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFJhbmRvbU9yZ0pTT05SUENFcnJvciBmcm9tIEpTT04tUlBDIEVycm9yczogXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9hcGkucmFuZG9tLm9yZy9qc29uLXJwYy80L2Vycm9yLWNvZGVzXHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmRvbU9yZ0pTT05SUENFcnJvcignRXJyb3IgJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArIGNvZGUgKyAnOiAnICsgbWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIE1ldGhvZHMgd2hpY2ggZG8gbm90IHVwZGF0ZSBmaWVsZHMgc3VjaCBhcyByZXF1ZXN0c0xlZnQsIGJpdHNMZWZ0IG9yXHJcbiAgICAgICAgICAgIC8vIGFkdmlzb3J5RGVsYXkuXHJcbiAgICAgICAgICAgIGxldCBpbmRlcGVuZGVudF9tZXRob2RzID0gW1xyXG4gICAgICAgICAgICAgICAgUmFuZG9tT3JnQ2xpZW50LiNWRVJJRllfU0lHTkFUVVJFX01FVEhPRCxcclxuICAgICAgICAgICAgICAgIFJhbmRvbU9yZ0NsaWVudC4jR0VUX1JFU1VMVF9NRVRIT0QsXHJcbiAgICAgICAgICAgICAgICBSYW5kb21PcmdDbGllbnQuI0NSRUFURV9USUNLRVRfTUVUSE9ELFxyXG4gICAgICAgICAgICAgICAgUmFuZG9tT3JnQ2xpZW50LiNMSVNUX1RJQ0tFVF9NRVRIT0QsXHJcbiAgICAgICAgICAgICAgICBSYW5kb21PcmdDbGllbnQuI0dFVF9USUNLRVRfTUVUSE9EXHJcbiAgICAgICAgICAgIF07XHJcblxyXG4gICAgICAgICAgICAvLyBVcGRhdGUgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgaWYgKCFpbmRlcGVuZGVudF9tZXRob2RzLmluY2x1ZGVzKHJlcXVlc3QubWV0aG9kKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy4jcmVxdWVzdHNMZWZ0ID0gcmVzcG9uc2UucmVzdWx0LnJlcXVlc3RzTGVmdDtcclxuICAgICAgICAgICAgICAgIHRoaXMuI2JpdHNMZWZ0ID0gcmVzcG9uc2UucmVzdWx0LmJpdHNMZWZ0O1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnJlc3VsdC5hZHZpc29yeURlbGF5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy4jYWR2aXNvcnlEZWxheSA9IHJlc3BvbnNlLnJlc3VsdC5hZHZpc29yeURlbGF5O1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBVc2UgZGVmYXVsdCBpZiBub25lIGZyb20gc2VydmVyLlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuI2Fkdmlzb3J5RGVsYXkgPSBSYW5kb21PcmdDbGllbnQuI0RFRkFVTFRfREVMQVk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBVc2UgZGVmYXVsdCBhZHZpc29yeURlbGF5LlxyXG4gICAgICAgICAgICAgICAgdGhpcy4jYWR2aXNvcnlEZWxheSA9IFJhbmRvbU9yZ0NsaWVudC4jREVGQVVMVF9ERUxBWTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLiNsYXN0UmVzcG9uc2VSZWNlaXZlZFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIElzc3VlcyBhIGdldFVzYWdlIHJlcXVlc3QgYW5kIHJldHVybnMgdGhlIGluZm9ybWF0aW9uIG9uIHRoZSB1c2FnZVxyXG4gICAgICogb2YgdGhlIEFQSSBrZXkgYXNzb2NpYXRlZCB3aXRoIHRoaXMgY2xpZW50LCBhcyBpdCBpcyByZXR1cm5lZCBieSB0aGVcclxuICAgICAqIHNlcnZlci4gQ2FuIGFsc28gYmUgdXNlZCB0byB1cGRhdGUgYml0cyBhbmQgcmVxdWVzdHMgbGVmdC5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSBBIFByb21pc2UsIHdoaWNoIGlmIHJlc29sdmVkIHN1Y2Nlc3NmdWxseSwgcmVwcmVzZW50c1xyXG4gICAgICogICAgIHRoZSByZXN1bHQgZmllbGQgYXMgcmV0dXJuZWQgYnkgdGhlIHNlcnZlci5cclxuICAgICAqL1xyXG4gICAgI2dldFVzYWdlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QoUmFuZG9tT3JnQ2xpZW50LiNHRVRfVVNBR0VfTUVUSE9ELCB7fSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2V4dHJhY3RSZXN1bHQodGhpcy4jc2VuZFJlcXVlc3QocmVxdWVzdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBnZW5lcmljIHJlcXVlc3QgcGFyYW1ldGVycyB0byBjdXN0b20gcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgTWV0aG9kIHRvIHNlbmQgcmVxdWVzdCB0by5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgQ3VzdG9tIHBhcmFtZXRlcnMgdG8gZ2VuZXJhdGUgcmVxdWVzdCBhcm91bmQuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBGbGVzaGVkIG91dCByZXF1ZXN0IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgI2dlbmVyYXRlUmVxdWVzdCA9IChtZXRob2QsIHBhcmFtcykgPT4ge1xyXG4gICAgICAgIGxldCBpZCA9IHRoaXMuI3V1aWR2NCgpO1xyXG4gICAgICAgIGxldCByZXF1ZXN0ID0ge1xyXG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcclxuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXHJcbiAgICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxyXG4gICAgICAgICAgICBpZDogaWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiByZXF1ZXN0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBnZW5lcmljIHJlcXVlc3QgcGFyYW1ldGVycyBhbmQgQVBJIGtleSB0byBjdXN0b20gcmVxdWVzdC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgTWV0aG9kIHRvIHNlbmQgcmVxdWVzdCB0by5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgQ3VzdG9tIHBhcmFtZXRlcnMgdG8gZ2VuZXJhdGUgcmVxdWVzdCBhcm91bmQuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBGbGVzaGVkIG91dCByZXF1ZXN0IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0ID0gKG1ldGhvZCwgcGFyYW1zKSA9PiB7XHJcbiAgICAgICAgcGFyYW1zWydhcGlLZXknXSA9IHRoaXMuI2FwaUtleTtcclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVSZXF1ZXN0KG1ldGhvZCwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEV4dHJhY3RzIGJhc2ljIGRhdGEgZnJvbSByZXNwb25zZSBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgT2JqZWN0IGZyb20gd2hpY2ggdG8gZXh0cmFjdCBkYXRhLlxyXG4gICAgICogQHJldHVybnMge2FueVtdfSBFeHRyYWN0ZWQgZGF0YSBhcyBhbiBhcnJheS5cclxuICAgICAqL1xyXG4gICAgI2V4dHJhY3RCYXNpYyA9IGFzeW5jIHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGRhdGEucmVzdWx0LnJhbmRvbS5kYXRhO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyBkYXRhLCByYW5kb20gZmllbGQgYW5kIHNpZ25hdHVyZSBmcm9tIHJlc3BvbnNlIGFuZCByZXR1cm5zIHRoZXNlIGFzXHJcbiAgICAgKiBhIG5ldyBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgT2JqZWN0IGZyb20gd2hpY2ggdG8gZXh0cmFjdCB0aGUgaW5mb3JtYXRpb24uXHJcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7ZGF0YTogbnVtYmVyW118bnVtYmVyW11bXXxzdHJpbmdbXXxzdHJpbmdbXVtdLCByYW5kb206IE9iamVjdCxcclxuICAgICAqICAgICBzaWduYXR1cmU6IHN0cmluZ30+fSBUaGUgcmVzcG9uc2Ugc3BsaXQgaW50byBkYXRhLCByYW5kb20gYW5kIHNpZ25hdHVyZSBmaWVsZHMuXHJcbiAgICAgKi9cclxuICAgICNleHRyYWN0U2lnbmVkID0gYXN5bmMgcmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YS5yZXN1bHQucmFuZG9tLmRhdGEsXHJcbiAgICAgICAgICAgICAgICByYW5kb206IGRhdGEucmVzdWx0LnJhbmRvbSxcclxuICAgICAgICAgICAgICAgIHNpZ25hdHVyZTogZGF0YS5yZXN1bHQuc2lnbmF0dXJlXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHZlcmlmaWNhdGlvbiByZXNwb25zZSBhcyBzZXBhcmF0ZSBmcm9tIHJlc3BvbnNlIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBSZXNwb25zZSBvYmplY3QgZnJvbSB3aGljaCB0byBleHRyYWN0XHJcbiAgICAgKiAgICAgdmVyaWZpY2F0aW9uIHJlc3BvbnNlLlxyXG4gICAgICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFZlcmlmaWNhdGlvbiBzdWNjZXNzLlxyXG4gICAgICovXHJcbiAgICAjZXh0cmFjdFZlcmlmaWNhdGlvbiA9IGFzeW5jIHJlc3BvbnNlID0+IHtcclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGRhdGEucmVzdWx0LmF1dGhlbnRpY2l0eTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEV4dHJhY3RzIHRoZSBpbmZvcm1hdGlvbiByZXR1cm5lZCB1bmRlciB0aGUgJ3Jlc3VsdCcgZmllbGQuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGZyb20gdGhlIHNlcnZlci5cclxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IEFsbCBkYXRhIGNvbnRhaW5lZCBpbiB0aGUgJ3Jlc3VsdCcgZmllbGQuXHJcbiAgICAgKi9cclxuICAgICNleHRyYWN0UmVzdWx0ID0gYXN5bmMgcmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gZGF0YS5yZXN1bHQ7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgcmVxdWVzdHMgZm9yIGludGVnZXJzLlxyXG4gICAgICovXHJcbiAgICAjaW50ZWdlclJlcXVlc3QgPSAobiwgbWluLCBtYXgsIHsgcmVwbGFjZW1lbnQgPSB0cnVlLCBiYXNlID0gMTAsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0gPSB7fSwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBuOiBuLFxyXG4gICAgICAgICAgICBtaW46IG1pbixcclxuICAgICAgICAgICAgbWF4OiBtYXgsXHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50OiByZXBsYWNlbWVudCxcclxuICAgICAgICAgICAgYmFzZTogYmFzZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuXHJcbiAgICAgICAgbGV0IG1ldGhvZCA9IHNpZ25lZCA/IFJhbmRvbU9yZ0NsaWVudC4jU0lHTkVEX0lOVEVHRVJfTUVUSE9EIDogUmFuZG9tT3JnQ2xpZW50LiNJTlRFR0VSX01FVEhPRDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0KG1ldGhvZCwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBnZW5lcmF0ZSByZXF1ZXN0cyBmb3IgaW50ZWdlciBzZXF1ZW5jZXMuXHJcbiAgICAgKi9cclxuICAgICNpbnRlZ2VyU2VxdWVuY2VSZXF1ZXN0ID0gKG4sIGxlbmd0aCwgbWluLCBtYXgsIHsgcmVwbGFjZW1lbnQgPSB0cnVlLCBiYXNlID0gMTAsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0gPSB7fSwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBuOiBuLFxyXG4gICAgICAgICAgICBsZW5ndGg6IGxlbmd0aCxcclxuICAgICAgICAgICAgbWluOiBtaW4sXHJcbiAgICAgICAgICAgIG1heDogbWF4LFxyXG4gICAgICAgICAgICByZXBsYWNlbWVudDogcmVwbGFjZW1lbnQsXHJcbiAgICAgICAgICAgIGJhc2U6IGJhc2VcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBwYXJhbXMgPSB0aGlzLiNhZGRPcHRpb25hbFBhcmFtcyhwYXJhbXMsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24sXHJcbiAgICAgICAgICAgIGxpY2Vuc2VEYXRhLCB1c2VyRGF0YSwgdGlja2V0SWQsIHNpZ25lZCk7XHJcblxyXG4gICAgICAgIGxldCBtZXRob2QgPSBzaWduZWQgPyBSYW5kb21PcmdDbGllbnQuI1NJR05FRF9JTlRFR0VSX1NFUVVFTkNFX01FVEhPRCA6IFJhbmRvbU9yZ0NsaWVudC4jSU5URUdFUl9TRVFVRU5DRV9NRVRIT0Q7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChtZXRob2QsIHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgcmVxdWVzdHMgZm9yIGRlY2ltYWwgZnJhY3Rpb25zLlxyXG4gICAgICovXHJcbiAgICAjZGVjaW1hbEZyYWN0aW9uUmVxdWVzdCA9IChuLCBkZWNpbWFsUGxhY2VzLCB7IHJlcGxhY2VtZW50ID0gdHJ1ZSwgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiA9IG51bGwsIGxpY2Vuc2VEYXRhID0gbnVsbCwgdXNlckRhdGEgPSBudWxsLCB0aWNrZXRJZCA9IG51bGwgfSA9IHt9LCBzaWduZWQgPSBmYWxzZSkgPT4ge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIGRlY2ltYWxQbGFjZXM6IGRlY2ltYWxQbGFjZXMsXHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50OiByZXBsYWNlbWVudFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuICAgICAgICBcclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfREVDSU1BTF9GUkFDVElPTl9NRVRIT0QgOiBSYW5kb21PcmdDbGllbnQuI0RFQ0lNQUxfRlJBQ1RJT05fTUVUSE9EO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHJlcXVlc3RzIGZvciBHYXVzc2lhbnMuXHJcbiAgICAgKi9cclxuICAgICNnYXVzc2lhblJlcXVlc3QgPSAobiwgbWVhbiwgc3RhbmRhcmREZXZpYXRpb24sIHNpZ25pZmljYW50RGlnaXRzLCB7IHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24gPSBudWxsLCBsaWNlbnNlRGF0YSA9IG51bGwsIHVzZXJEYXRhID0gbnVsbCwgdGlja2V0SWQgPSBudWxsIH0gPSB7fSwgc2lnbmVkID0gZmFsc2UpID0+IHtcclxuICAgICAgICBsZXQgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBuOiBuLFxyXG4gICAgICAgICAgICBtZWFuOiBtZWFuLFxyXG4gICAgICAgICAgICBzdGFuZGFyZERldmlhdGlvbjogc3RhbmRhcmREZXZpYXRpb24sXHJcbiAgICAgICAgICAgIHNpZ25pZmljYW50RGlnaXRzOiBzaWduaWZpY2FudERpZ2l0c1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuXHJcbiAgICAgICAgbGV0IG1ldGhvZCA9IHNpZ25lZCA/IFJhbmRvbU9yZ0NsaWVudC4jU0lHTkVEX0dBVVNTSUFOX01FVEhPRCA6IFJhbmRvbU9yZ0NsaWVudC4jR0FVU1NJQU5fTUVUSE9EO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHJlcXVlc3RzIGZvciBzdHJpbmdzLlxyXG4gICAgICovXHJcbiAgICAjc3RyaW5nUmVxdWVzdCA9IChuLCBsZW5ndGgsIGNoYXJhY3RlcnMsIHsgcmVwbGFjZW1lbnQgPSB0cnVlLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uID0gbnVsbCwgbGljZW5zZURhdGEgPSBudWxsLCB1c2VyRGF0YSA9IG51bGwsIHRpY2tldElkID0gbnVsbCB9ID0ge30sIHNpZ25lZCA9IGZhbHNlKSA9PiB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbjogbixcclxuICAgICAgICAgICAgbGVuZ3RoOiBsZW5ndGgsXHJcbiAgICAgICAgICAgIGNoYXJhY3RlcnM6IGNoYXJhY3RlcnMsXHJcbiAgICAgICAgICAgIHJlcGxhY2VtZW50OiByZXBsYWNlbWVudFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuXHJcbiAgICAgICAgbGV0IG1ldGhvZCA9IHNpZ25lZCA/IFJhbmRvbU9yZ0NsaWVudC4jU0lHTkVEX1NUUklOR19NRVRIT0QgOiBSYW5kb21PcmdDbGllbnQuI1NUUklOR19NRVRIT0Q7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLiNnZW5lcmF0ZUtleWVkUmVxdWVzdChtZXRob2QsIHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgcmVxdWVzdHMgZm9yIFVVSURzLlxyXG4gICAgICovXHJcbiAgICAjVVVJRFJlcXVlc3QgPSAobiwgeyBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uID0gbnVsbCwgbGljZW5zZURhdGEgPSBudWxsLCB1c2VyRGF0YSA9IG51bGwsIHRpY2tldElkID0gbnVsbCB9ID0ge30sIHNpZ25lZCA9IGZhbHNlKSA9PiB7XHJcbiAgICAgICAgbGV0IHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbjogblxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHBhcmFtcyA9IHRoaXMuI2FkZE9wdGlvbmFsUGFyYW1zKHBhcmFtcywgcHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbixcclxuICAgICAgICAgICAgbGljZW5zZURhdGEsIHVzZXJEYXRhLCB0aWNrZXRJZCwgc2lnbmVkKTtcclxuXHJcbiAgICAgICAgbGV0IG1ldGhvZCA9IHNpZ25lZCA/IFJhbmRvbU9yZ0NsaWVudC4jU0lHTkVEX1VVSURfTUVUSE9EIDogUmFuZG9tT3JnQ2xpZW50LiNVVUlEX01FVEhPRDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuI2dlbmVyYXRlS2V5ZWRSZXF1ZXN0KG1ldGhvZCwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byBnZW5lcmF0ZSByZXF1ZXN0cyBmb3IgYmxvYnMuXHJcbiAgICAgKi9cclxuICAgICNibG9iUmVxdWVzdCA9IChuLCBzaXplLCB7IGZvcm1hdCA9IHRoaXMuQkFTRTY0LCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uID0gbnVsbCwgbGljZW5zZURhdGEgPSBudWxsLCB1c2VyRGF0YSA9IG51bGwsIHRpY2tldElkID0gbnVsbCB9LCBzaWduZWQgPSBmYWxzZSkgPT4ge1xyXG4gICAgICAgIGxldCBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG46IG4sXHJcbiAgICAgICAgICAgIHNpemU6IHNpemUsXHJcbiAgICAgICAgICAgIGZvcm1hdDogZm9ybWF0XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcGFyYW1zID0gdGhpcy4jYWRkT3B0aW9uYWxQYXJhbXMocGFyYW1zLCBwcmVnZW5lcmF0ZWRSYW5kb21pemF0aW9uLFxyXG4gICAgICAgICAgICBsaWNlbnNlRGF0YSwgdXNlckRhdGEsIHRpY2tldElkLCBzaWduZWQpO1xyXG5cclxuICAgICAgICBsZXQgbWV0aG9kID0gc2lnbmVkID8gUmFuZG9tT3JnQ2xpZW50LiNTSUdORURfQkxPQl9NRVRIT0QgOiBSYW5kb21PcmdDbGllbnQuI0JMT0JfTUVUSE9EO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy4jZ2VuZXJhdGVLZXllZFJlcXVlc3QobWV0aG9kLCBwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGFkZCBvcHRpb25hbCBwYXJhbWV0ZXJzIHdoaWNoIGFyZSBjb21tb24gYWNyb3NzXHJcbiAgICAgKiB2YWx1ZS1nZW5lcmF0aW5nIG1ldGhvZHMuXHJcbiAgICAgKi9cclxuICAgICNhZGRPcHRpb25hbFBhcmFtcyA9IChwYXJhbXMsIHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb24sIGxpY2Vuc2VEYXRhLCB1c2VyRGF0YSwgdGlja2V0SWQsIHNpZ25lZCA9IGZhbHNlKSA9PiB7XHJcbiAgICAgICAgLy8gYXZhaWxhYmxlIGZvciBib3RoIEJhc2ljIGFuZCBTaWduZWQgQVBJIG1ldGhvZHNcclxuICAgICAgICBwYXJhbXMucHJlZ2VuZXJhdGVkUmFuZG9taXphdGlvbiA9IHByZWdlbmVyYXRlZFJhbmRvbWl6YXRpb247XHJcblxyXG4gICAgICAgIC8vIG9wdGlvbmFsIHBhcmFtZXRlcnMgdXNlZCBleGNsdXNpdmVseSBmb3IgU2lnbmVkIEFQSSBtZXRob2RzXHJcbiAgICAgICAgaWYgKHNpZ25lZCkge1xyXG4gICAgICAgICAgICBwYXJhbXMubGljZW5zZURhdGEgPSBsaWNlbnNlRGF0YTtcclxuICAgICAgICAgICAgcGFyYW1zLnVzZXJEYXRhID0gdXNlckRhdGE7XHJcbiAgICAgICAgICAgIHBhcmFtcy50aWNrZXRJZCA9IHRpY2tldElkO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcGFyYW1zO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIGZvciBjcmVhdGluZyBhbiBpbnRlZ2VyIHNlcXVlbmNlIGNhY2hlLiBcclxuICAgICAqIEBwYXJhbSB7YW55W119IG9yaWdpbmFsIFRoZSBhcnJheSB0byBiZSByZXBlYXRlZC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgdGltZXMgdGhlIG9yaWdpbmFsIGFycmF5IGlzIHRvIGJlXHJcbiAgICAgKiAgICAgcmVwZWF0ZWQuXHJcbiAgICAgKiBAcmV0dXJucyB7YW55W119IEEgbmV3IGFycmF5IHdoaWNoIGNvbnRhaW5zIHRoZSBvcmlnaW5hbCBhcnJheSByZXBlYXRlZFxyXG4gICAgICogICAgIG4gdGltZXMuXHJcbiAgICAgKi9cclxuICAgICNhZGp1c3QgPSAob3JpZ2luYWwsIG4pID0+IHtcclxuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbSh7IGxlbmd0aDogbiB9LCAoKSA9PiBvcmlnaW5hbCkuZmxhdCgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIGZvciBjcmVhdGluZyBhbiBpbnRlZ2VyIHNlcXVlbmNlIGNhY2hlLlxyXG4gICAgICogQHBhcmFtIHsobnVtYmVyfG51bWJlcltdKX0gYSBBbiBhcnJheSBvZiBpbnRlZ2VycyAob3IgYSBzaW5nbGUgdmFsdWUpLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gTGFyZ2VzdCB2YWx1ZSBpbiB0aGUgYXJyYXkgKG9yIGEsIHVuY2hhbmdlZCwgaWYgaXRcclxuICAgICAqICAgICBpcyBub3QgYW4gYXJyYXkpLlxyXG4gICAgICovXHJcbiAgICAjbWF4VmFsdWUgPSBhID0+IHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYS5yZWR1Y2UoZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KHgsIHkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gYTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGFuIGludGVnZXIgc2VxdWVuY2UgY2FjaGUuXHJcbiAgICAgKiBAcGFyYW0geyhudW1iZXJ8bnVtYmVyW10pfSBhIEFuIGFycmF5IG9mIGludGVnZXJzIChvciBhIHNpbmdsZSB2YWx1ZSkuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBTbWFsbGVzdCB2YWx1ZSBpbiB0aGUgYXJyYXkgKG9yIGEsIHVuY2hhbmdlZCwgaWYgaXRcclxuICAgICAqICAgICBpcyBub3QgYW4gYXJyYXkpLlxyXG4gICAgICovXHJcbiAgICAjbWluVmFsdWUgPSBhID0+IHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYS5yZWR1Y2UoZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGgubWluKHgsIHkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gYTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIEhlbHBlciBmdW5jdGlvbiB0byBtYWtlIGEgc3RyaW5nIFVSTC1zYWZlIChiYXNlNjQgYW5kIHBlcmNlbnQtZW5jb2RpbmcpICovXHJcbiAgICAjZm9ybWF0VXJsID0gcyA9PiB7XHJcbiAgICAgICAgbGV0IHBhdHRlcm4gPSAvXihbMC05YS16QS1aKy9dezR9KSooKFswLTlhLXpBLVorL117Mn09PSl8KFswLTlhLXpBLVorL117M309KSk/JC87XHJcbiAgICAgICAgbGV0IGlzQmFzZTY0ID0gcGF0dGVybi50ZXN0KHMpO1xyXG5cclxuICAgICAgICBpZiAoIWlzQmFzZTY0KSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAod2luZG93KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYnJvd3NlclxyXG4gICAgICAgICAgICAgICAgICAgIHMgPSBidG9hKHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgUmVmZXJlbmNlRXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBOb2RlSlNcclxuICAgICAgICAgICAgICAgICAgICBzID0gQnVmZmVyLmZyb20ocykudG9TdHJpbmcoJ2Jhc2U2NCcpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQZXJjZW50LUVuY29kaW5nIGFzIGRlc2NyaWJlZCBpbiBSRkMgMzk4NiBmb3IgUEhQXHJcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvPS9nLCAnJTNEJyk7XHJcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvXFwrL2csICclMkInKTtcclxuICAgICAgICBzID0gcy5yZXBsYWNlKC9cXC8vZywgJyUyRicpO1xyXG5cclxuICAgICAgICByZXR1cm4gc1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiBIZWxwZXIgZnVuY3Rpb24gdG8gY3JlYXRlIGEgSFRNTCBpbnB1dCB0YWcgKi9cclxuICAgICNpbnB1dEhUTUwgPSAodHlwZSwgbmFtZSwgdmFsdWUpID0+IHtcclxuICAgICAgICByZXR1cm4gJzxpbnB1dCB0eXBlPVxcJycgKyB0eXBlICsgJ1xcJyBuYW1lPVxcJycgKyBuYW1lICsgJ1xcJyB2YWx1ZT1cXCcnICsgdmFsdWUgKyAnXFwnIC8+JztcclxuICAgIH1cclxuXHJcbiAgICAvKiogSGVscGVyIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIFVVSURzIHRvIGJlIHVzZWQgYXMgXCJpZFwiIGluIHJlcXVlc3RzIHRvIHRoZSBzZXJ2ZXIuICovXHJcbiAgICAjdXVpZHY0ID0gKCkgPT4ge1xyXG4gICAgICAgIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uKGMpIHtcclxuICAgICAgICAgICAgdmFyIHIgPSBNYXRoLnJhbmRvbSgpKjE2IHwgMDtcclxuICAgICAgICAgICAgcmV0dXJuIChjID09ICd4JyA/IHIgOiAociYweDN8MHg4KSkudG9TdHJpbmcoMTYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59IiwiLyoqIFxyXG4gKiBFUyBNb2R1bGUgd3JhcHBlciwgYWxsb3dpbmcgdGhpcyBsaWJyYXJ5IHRvIGJlIGltcG9ydGVkIHVzaW5nXHJcbiAqIEVTNisgc3ludGF4LiBUaGUgUmFuZG9tT3JnQ2xpZW50IGNsYXNzIGlzIGJvdGggdGhlIGRlZmF1bHQgYW5kXHJcbiAqIGEgbmFtZWQgZXhwb3J0LiBBbGwgZXJyb3IgY2xhc3NlcywgYXJlIGF2YWlsYWJsZSBvbmx5IGFzIG5hbWVkXHJcbiAqIGV4cG9ydHMuXHJcbiAqICovXHJcbmltcG9ydCBSYW5kb21PcmdDbGllbnQgZnJvbSAnLi4vUmFuZG9tT3JnQ2xpZW50LmpzJztcclxuaW1wb3J0IFJhbmRvbU9yZ0NhY2hlIGZyb20gJy4uL1JhbmRvbU9yZ0NhY2hlLmpzJztcclxuaW1wb3J0ICogYXMgRXJyb3JzIGZyb20gJy4uL1JhbmRvbU9yZ0Vycm9ycy5qcyc7XHJcblxyXG5sZXQgUmFuZG9tT3JnUkFORE9NT1JHRXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdSQU5ET01PUkdFcnJvcjtcclxubGV0IFJhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yID0gRXJyb3JzLmRlZmF1bHQuUmFuZG9tT3JnQmFkSFRUUFJlc3BvbnNlRXJyb3I7XHJcbmxldCBSYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdJbnN1ZmZpY2llbnRCaXRzRXJyb3I7XHJcbmxldCBSYW5kb21PcmdJbnN1ZmZpY2llbnRSZXF1ZXN0c0Vycm9yID0gRXJyb3JzLmRlZmF1bHQuUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvcjtcclxubGV0IFJhbmRvbU9yZ0pTT05SUENFcnJvciA9IEVycm9ycy5kZWZhdWx0LlJhbmRvbU9yZ0pTT05SUENFcnJvcjtcclxubGV0IFJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvciA9IEVycm9ycy5kZWZhdWx0LlJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvcjtcclxubGV0IFJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3IgPSBFcnJvcnMuZGVmYXVsdC5SYW5kb21PcmdTZW5kVGltZW91dEVycm9yO1xyXG5sZXQgUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yID0gRXJyb3JzLmRlZmF1bHQuUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yO1xyXG5cclxuZXhwb3J0IHtcclxuICAgIFJhbmRvbU9yZ0NsaWVudCBhcyBkZWZhdWx0LFxyXG4gICAgUmFuZG9tT3JnQ2xpZW50LFxyXG4gICAgUmFuZG9tT3JnQ2FjaGUsXHJcbiAgICBSYW5kb21PcmdCYWRIVFRQUmVzcG9uc2VFcnJvcixcclxuICAgIFJhbmRvbU9yZ0luc3VmZmljaWVudEJpdHNFcnJvcixcclxuICAgIFJhbmRvbU9yZ0luc3VmZmljaWVudFJlcXVlc3RzRXJyb3IsXHJcbiAgICBSYW5kb21PcmdKU09OUlBDRXJyb3IsXHJcbiAgICBSYW5kb21PcmdLZXlOb3RSdW5uaW5nRXJyb3IsXHJcbiAgICBSYW5kb21PcmdSQU5ET01PUkdFcnJvcixcclxuICAgIFJhbmRvbU9yZ1NlbmRUaW1lb3V0RXJyb3IsXHJcbiAgICBSYW5kb21PcmdDYWNoZUVtcHR5RXJyb3JcclxufTsiXSwibmFtZXMiOlsiUmFuZG9tT3JnSW5zdWZmaWNpZW50Qml0c0Vycm9yIiwiUmFuZG9tT3JnQ2FjaGVFbXB0eUVycm9yIiwicmVxdWlyZSQkMCIsIlJhbmRvbU9yZ0JhZEhUVFBSZXNwb25zZUVycm9yIiwiUmFuZG9tT3JnSW5zdWZmaWNpZW50UmVxdWVzdHNFcnJvciIsIlJhbmRvbU9yZ0pTT05SUENFcnJvciIsIlJhbmRvbU9yZ0tleU5vdFJ1bm5pbmdFcnJvciIsIlJhbmRvbU9yZ1JBTkRPTU9SR0Vycm9yIiwiUmFuZG9tT3JnU2VuZFRpbWVvdXRFcnJvciIsInJlcXVpcmUkJDEiLCJFcnJvcnMuZGVmYXVsdCJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs2Q0FDcUMsR0FBRyxNQUFNLDZCQUE2QixTQUFTLEtBQUs7QUFDekY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRTtBQUN6QixRQUFRLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN2QixL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T0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUM5RCxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxNQUFNLGFBQWEsQ0FBQyxDQUFDLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUN6QyxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3BELFFBQVEsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUM5RCxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxNQUFNLGFBQWEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFDL0MsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDMUQsUUFBUSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQzlELEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksTUFBTSxzQkFBc0IsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxPQUFPLEdBQUcsRUFBRSxFQUFFO0FBQzVELFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdkUsUUFBUSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQy9ELEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLE1BQU0sOEJBQThCLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFDNUUsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN2RixRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDL0QsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxNQUFNLDhCQUE4QixDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUN6RSxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNwRixRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDL0QsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksTUFBTSx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFDL0YsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUI7QUFDekYsWUFBWSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsUUFBUSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQy9ELEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxNQUFNLHFCQUFxQixDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sR0FBRyxFQUFFLEVBQUU7QUFDckUsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNoRixRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDL0QsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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
