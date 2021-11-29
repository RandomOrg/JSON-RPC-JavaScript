export = RandomOrgClient;
declare class RandomOrgClient {
    static "__#5@#INTEGER_METHOD": string;
    static "__#5@#INTEGER_SEQUENCE_METHOD": string;
    static "__#5@#DECIMAL_FRACTION_METHOD": string;
    static "__#5@#GAUSSIAN_METHOD": string;
    static "__#5@#STRING_METHOD": string;
    static "__#5@#UUID_METHOD": string;
    static "__#5@#BLOB_METHOD": string;
    static "__#5@#GET_USAGE_METHOD": string;
    static "__#5@#SIGNED_INTEGER_METHOD": string;
    static "__#5@#SIGNED_INTEGER_SEQUENCE_METHOD": string;
    static "__#5@#SIGNED_DECIMAL_FRACTION_METHOD": string;
    static "__#5@#SIGNED_GAUSSIAN_METHOD": string;
    static "__#5@#SIGNED_STRING_METHOD": string;
    static "__#5@#SIGNED_UUID_METHOD": string;
    static "__#5@#SIGNED_BLOB_METHOD": string;
    static "__#5@#GET_RESULT_METHOD": string;
    static "__#5@#CREATE_TICKET_METHOD": string;
    static "__#5@#LIST_TICKET_METHOD": string;
    static "__#5@#GET_TICKET_METHOD": string;
    static "__#5@#VERIFY_SIGNATURE_METHOD": string;
    /** Blob format literal, base64 encoding (default). */
    static BLOB_FORMAT_BASE64: string;
    /** Blob format literal, hex encoding. */
    static BLOB_FORMAT_HEX: string;
    /** Default value for the replacement parameter (true). */
    static DEFAULT_REPLACEMENT: boolean;
    /** Default value for the base parameter (10). */
    static DEFAULT_BASE: number;
    /** Default value for the userData parameter (null). */
    static DEFAULT_USER_DATA: any;
    /** Default value for the ticketId parameter (null). */
    static DEFAULT_TICKET_ID: any;
    /** Default value for the pregeneratedRandomization parameter (null). */
    static DEFAULT_PREGENERATED_RANDOMIZATION: any;
    /** Default value for the licenseData parameter (null). */
    static DEFAULT_LICENSE_DATA: any;
    /** Size of a single UUID in bits. */
    static UUID_SIZE: number;
    /** Default value for the blockingTimeout parameter (1 day). */
    static DEFAULT_BLOCKING_TIMEOUT: number;
    /** Default value for the httpTimeout parameter (2 minutes). */
    static DEFAULT_HTTP_TIMEOUT: number;
    /** Maximum number of characters allowed in a signature verficiation URL. */
    static MAX_URL_LENGTH: number;
    static "__#5@#DEFAULT_DELAY": number;
    static "__#5@#ALLOWANCE_STATE_REFRESH_SECONDS": number;
    static "__#5@#keyIndexedInstances": {};
    static "__#5@#ERROR_CODES": number[];
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
    constructor(apiKey: string, options?: {
        blockingTimeout?: number;
        httpTimeout?: number;
    });
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
    generateIntegers(n: number, min: number, max: number, options?: {
        replacement?: boolean;
        base?: number;
        pregeneratedRandomization?: any;
    }): (Promise<number[]> | Promise<string[]>);
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
    generateIntegerSequences(n: number, length: (number | number[]), min: (number | number[]), max: (number | number[]), options?: {
        replacement?: boolean | boolean[];
        base?: number | number[];
        pregeneratedRandomization?: any;
    }): (Promise<number[][]> | Promise<string[][]>);
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
    generateDecimalFractions(n: number, decimalPlaces: number, options?: {
        replacement?: boolean;
        pregeneratedRandomization?: any;
    }): Promise<number[]>;
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
    generateGaussians(n: number, mean: number, standardDeviation: number, significantDigits: number, options?: {
        pregeneratedRandomization?: any;
    }): Promise<number[]>;
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
    generateStrings(n: number, length: number, characters: string, options?: {
        replacement?: boolean;
        pregeneratedRandomization?: any;
    }): Promise<string[]>;
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
    generateUUIDs(n: number, options?: {
        pregeneratedRandomization?: any;
    }): Promise<string[]>;
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
    generateBlobs(n: number, size: number, options?: {
        format?: string;
        pregeneratedRandomization?: any;
    }): Promise<number[]>;
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
    generateSignedIntegers(n: number, min: number, max: number, options?: {
        replacement?: boolean;
        base?: number;
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: number[] | string[];
        random: any;
        signature: string;
    }>;
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
    generateSignedIntegerSequences(n: number, length: (number | number[]), min: (number | number[]), max: (number | number[]), options?: {
        replacement?: boolean | boolean[];
        base?: number | number[];
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: number[][] | string[][];
        random: any;
        signature: string;
    }>;
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
    generateSignedDecimalFractions(n: number, decimalPlaces: number, options?: {
        replacement?: boolean;
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: number[];
        random: any;
        signature: string;
    }>;
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
    generateSignedGaussians(n: number, mean: number, standardDeviation: number, significantDigits: number, options?: {
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: number[];
        random: any;
        signature: string;
    }>;
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
    generateSignedStrings(n: number, length: number, characters: string, options?: {
        replacement?: boolean;
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: string[];
        random: any;
        signature: string;
    }>;
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
    generateSignedUUIDs(n: number, options?: {
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | string | number;
        ticketId?: string;
    }): Promise<{
        data: string[];
        random: any;
        signature: string;
    }>;
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
    generateSignedBlobs(n: number, size: number, options?: {
        format?: string;
        pregeneratedRandomization?: any;
        licenseData?: any;
        userData?: any | number | string;
        ticketId?: string;
    }): Promise<{
        data: string[];
        random: any;
        signature: string;
    }>;
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
    verifySignature(random: any, signature: string): Promise<boolean>;
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
    getBitsLeft(): Promise<number>;
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
    getRequestsLeft(): Promise<number>;
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
    getResult(serialNumber: number): Promise<any>;
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
    createTickets(n: number, showResult: boolean): Promise<{
        /**
         * A string value that uniquely identifies the ticket.
         */
        ticketId: string;
        /**
         * A string containing the timestamp in ISO 8601
         * format at which the ticket was created.
         */
        creationTime: string;
        /**
         * The previous ticket in the chain to which this
         * ticket belongs. Since a new chain only contains one ticket, previousTicketId will
         * be null.
         */
        previousTicketId: string;
        /**
         * A string value that identifies the next ticket in
         * the chain. Since a new chain only contains one ticket, nextTicketId will be null.
         */
        nextTicketId: string;
    }[]>;
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
    listTickets(ticketType: string): Promise<{
        /**
         * A string value that uniquely identifies the ticket.
         */
        ticketId: string;
        /**
         * The hashed API key for which the ticket is valid.
         */
        hashedApiKey: string;
        /**
         * If false, getTicket() will return only the basic
         * ticket information. If true, the full random and signature objects from the
         * response that was used to satisfy the ticket is returned. For more information,
         * please see the documentation for getTicket.
         */
        showResult: boolean;
        /**
         * The timestamp in ISO 8601 format at which the ticket
         * was created.
         */
        creationTime: string;
        /**
         * The timestamp in ISO 8601 format at which the ticket was
         * used. If the ticket has not been used yet, this value is null.
         */
        usedTime: string;
        /**
         * A numeric value indicating which serial number
         * (within the API key used to serve the ticket) was used for the ticket. If the
         * caller has the unhashed API key, they can use the serialNumber returned to obtain
         * the full result via the getResult method. If the ticket has not been used yet,
         * this value is null.
         */
        serialNumber: number;
        /**
         * The timestamp in ISO 8601 format at which the ticket
         * expires. If the ticket has not been used yet, this value is null.
         */
        expirationTime: string;
        /**
         * The previous ticket in the chain to which this
         * ticket belongs. If the ticket is the first in its chain, then previousTicketId is
         * null.
         */
        previousTicketId: string;
        /**
         * A string value that identifies the next
         * ticket in the chain.
         */
        nextTicketId: string;
        /**
         * The same object that was returned by the method that was
         * originally used to generate the values.
         */
        result?: any;
    }[]>;
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
    getTicket(ticketId: string): Promise<{
        /**
         * A string value that uniquely identifies the ticket.
         */
        ticketId: string;
        /**
         * The hashed API key for which the ticket is valid.
         */
        hashedApiKey: string;
        /**
         * If false, getTicket() will return only the basic
         * ticket information. If true, the full random and signature objects from the
         * response that was used to satisfy the ticket is returned. For more information,
         * please see the documentation for getTicket.
         */
        showResult: boolean;
        /**
         * The timestamp in ISO 8601 format at which the ticket
         * was created.
         */
        creationTime: string;
        /**
         * The timestamp in ISO 8601 format at which the ticket was
         * used. If the ticket has not been used yet, this value is null.
         */
        usedTime: string;
        /**
         * A numeric value indicating which serial number
         * (within the API key used to serve the ticket) was used for the ticket. If the
         * caller has the unhashed API key, they can use the serialNumber returned to obtain
         * the full result via the getResult method. If the ticket has not been used yet,
         * this value is null.
         */
        serialNumber: number;
        /**
         * The timestamp in ISO 8601 format at which the ticket
         * expires. If the ticket has not been used yet, this value is null.
         */
        expirationTime: string;
        /**
         * The previous ticket in the chain to which this
         * ticket belongs. If the ticket is the first in its chain, then previousTicketId is
         * null.
         */
        previousTicketId: string;
        /**
         * A string value that identifies the next
         * ticket in the chain.
         */
        nextTicketId: string;
        /**
         * The same object that was returned by the method that was
         * originally used to generate the values.
         */
        result?: any;
    }>;
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
    createUrl(random: any, signature: string): string;
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
    createHtml(random: any, signature: string): string;
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
    createIntegerCache(n: number, min: number, max: number, options?: {
        replacement?: boolean;
        base?: number;
        cacheSize?: number;
    }): RandomOrgCache;
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
    createIntegerSequenceCache(n: number, length: (number | number[]), min: (number | number[]), max: (number | number[]), options?: {
        replacement?: boolean | boolean[];
        base?: number | number[];
        cacheSize?: number;
    }): RandomOrgCache;
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
    createDecimalFractionCache(n: number, decimalPlaces: number, options?: {
        replacement?: boolean;
        cacheSize?: number;
    }): RandomOrgCache;
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
    createGaussianCache(n: number, mean: number, standardDeviation: number, significantDigits: number, options?: {
        cacheSize?: number;
    }): RandomOrgCache;
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
    createStringCache(n: number, length: number, characters: string, options?: {
        replacement?: boolean;
        cacheSize?: number;
    }): RandomOrgCache;
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
    createUUIDCache(n: number, options?: {
        cacheSize?: number;
    }): RandomOrgCache;
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
    createBlobCache(n: number, size: number, options?: {
        format?: string;
        cacheSize?: number;
    }): RandomOrgCache;
    #private;
}
import RandomOrgCache = require("./RandomOrgCache.js");
