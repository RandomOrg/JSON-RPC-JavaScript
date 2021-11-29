export class RandomOrgBadHTTPResponseError extends Error {
    /**
     * Constructs a new exception with the specified detail message.
     * @param {string} message The detail message.
     */
    constructor(message: string);
}
export class RandomOrgInsufficientBitsError extends Error {
    /**
     * Constructs a new exception with the specified detail message.
     * @constructor
     * @param {string} message The detail message.
     * @param {number} bits Bits remaining just before the error was thrown.
     */
    constructor(message: string, bits: number);
    /**
     * Gets the number of bits remaining.
     * @returns {number} The number of bits left.
     */
    getBitsLeft(): number;
    #private;
}
export class RandomOrgInsufficientRequestsError extends Error {
    /**
     * Constructs a new exception with the specified detail message.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message: string);
}
export class RandomOrgJSONRPCError extends Error {
    /**
     * Constructs a new exception with the specified detail message.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message: string);
}
export class RandomOrgKeyNotRunningError extends Error {
    /**
     * Error thrown by the RandomOrgClient class when its API key has been stopped.
     * Requests will not complete while API key is in the stopped state.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message: string);
}
export class RandomOrgRANDOMORGError extends Error {
    /**
     * Error thrown by the RandomOrgClient class when the server returns a
     * RANDOM.ORG Error. See https://api.random.org/json-rpc/4/error-codes
     * @constructor
     * @param {string} message The detail message.
     * @param {number=} [code=-1] The error code.
     */
    constructor(message: string, code?: number | undefined);
    /**
     * Gets the RANDOM.ORG error code, see
     * https://api.random.org/json-rpc/4/error-codes
     * @returns {number} The error code.
     */
    getCode(): number;
    #private;
}
export class RandomOrgSendTimeoutError extends Error {
    /**
     * Error thrown by the RandomOrgClient class when its set blocking timeout is
     * exceeded before the request can be sent.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message: string);
}
export class RandomOrgCacheEmptyError extends Error {
    /**
     * Error thrown when data retrieval from an emtpy RandomOrgCache is attempted.
     * @constructor
     * @param {string} message The detail message.
     * @param {boolean} paused Reflects whether the RandomOrgCache instance was
     *     paused when this error was thrown.
     */
    constructor(message: string, paused?: boolean);
    /**
     * Returns whether the cache was paused at the time when the
     * error was thrown.
     * @returns {boolean} True if paused, false otherwise.
     */
    wasPaused(): boolean;
    #private;
}
