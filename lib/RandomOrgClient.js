'use strict';

const {
    RandomOrgBadHTTPResponseError,
    RandomOrgInsufficientBitsError,
    RandomOrgInsufficientRequestsError,
    RandomOrgJSONRPCError,
    RandomOrgKeyNotRunningError,
    RandomOrgRANDOMORGError,
    RandomOrgSendTimeoutError
} = require('./RandomOrgErrors.js');
const RandomOrgCache = require('./RandomOrgCache.js');
/* node-import */
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
/* end-node-import */

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
module.exports = class RandomOrgClient {
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
            throw new RandomOrgRANDOMORGError('Error: URL exceeds maximum length'
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
                throw new RandomOrgInsufficientRequestsError(this.#backoffError);
            // Time is up, clear back-off.
            } else {
                this.#backoff = -1;
                this.#backoffError = null;
            }
        }

        let wait = this.#advisoryDelay - (Date.now() - this.#lastResponseReceivedTime);

        if (this.#blockingTimeout != -1 && wait > this.#blockingTimeout) {
            throw new RandomOrgSendTimeoutError('The server advisory delay of ' 
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
                throw new RandomOrgSendTimeoutError('The maximum '
                    + 'allowed blocking time of ' + httpTimeout + 'millis has '
                    + 'been exceeded while waiting for the server to respond.');
            };
            xhr.onload = function() {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.responseText);
                } else {
                    throw new RandomOrgBadHTTPResponseError('Error: '
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
                    throw new RandomOrgKeyNotRunningError('Error '
                        + code + ': ' + message);
                } else if (code == 402) {
                    let midnightUTC = new Date().setUTCHours(0,0,0,0);
                    this.#backoff = +midnightUTC;
                    this.#backoffError = 'Error ' + code + ': ' + message;

                    this.#requestsLeft = data[1];

                    throw new RandomOrgInsufficientRequestsError(this.#backoffError);
                } else if (code == 403) {
                    this.#bitsLeft = data[1];
                    throw new RandomOrgInsufficientBitsError('Error'
                        + code + ': ' + message, this.#bitsLeft);
                } else if (RandomOrgClient.#ERROR_CODES.includes(code)) {
                    // RandomOrgRANDOMORGError from RANDOM.ORG Errors: 
                    // https://api.random.org/json-rpc/4/error-codes
                    throw new RandomOrgRANDOMORGError('Error '
                        + code + ': ' + message, code);
                } else {
                    // RandomOrgJSONRPCError from JSON-RPC Errors: 
                    // https://api.random.org/json-rpc/4/error-codes
                    throw new RandomOrgJSONRPCError('Error '
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
        }

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
}