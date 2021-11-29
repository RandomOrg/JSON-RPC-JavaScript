'use strict';

/**
 * Error thrown by the RandomOrgClient class when the connection doesn't return
 * a HTTP 200 OK response.
 */
exports.RandomOrgBadHTTPResponseError = class RandomOrgBadHTTPResponseError extends Error
{
    /**
     * Constructs a new exception with the specified detail message.
     * @param {string} message The detail message.
     */
    constructor(message) {
        super(message);
    }
}

/**
 * Error thrown by the RandomOrgClient class when its API key's request has
 * exceeded its remaining server bits allowance.
 * 
 * If the client is currently issuing large requests it may be possible succeed
 * with smaller requests. Use the getBitsLeft() call in this class to help
 * determine if an alternative request size is appropriate.
 */
 exports.RandomOrgInsufficientBitsError = class RandomOrgInsufficientBitsError extends Error
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
}

/**
 * Error thrown by the RandomOrgClient class when its API key's server requests
 * allowance has been exceeded.
 * 
 * This indicates that a back-off until midnight UTC is in effect, before which
 * no requests will be sent by the client as no meaningful server responses will
 * be returned.
 */
exports.RandomOrgInsufficientRequestsError = class RandomOrgInsufficientRequestsError extends Error
{
    /**
     * Constructs a new exception with the specified detail message.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message) {
        super(message);
    }
}

/**
 * Error thrown by the RandomOrgClient class when the server returns a JSON-RPC
 * Error. See https://api.random.org/json-rpc/4/error-codes
 */
exports.RandomOrgJSONRPCError = class RandomOrgJSONRPCError extends Error
{
    /**
     * Constructs a new exception with the specified detail message.
     * @constructor
     * @param {string} message The detail message.
     */
    constructor(message) {
        super(message);
    }
}

/**
 * Error thrown by the RandomOrgClient class when its API key has been stopped.
 * Requests will not complete while API key is in the stopped state.
 */
exports.RandomOrgKeyNotRunningError = class RandomOrgKeyNotRunningError extends Error
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
}

/**
 * Error thrown by the RandomOrgClient class when the server returns a
 * RANDOM.ORG Error. See https://api.random.org/json-rpc/4/error-codes
 */
exports.RandomOrgRANDOMORGError = class RandomOrgRANDOMORGError extends Error
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
}

/**
 * Error thrown by the RandomOrgClient class when its set blocking timeout is
 * exceeded before the request can be sent.
 */
exports.RandomOrgSendTimeoutError = class RandomOrgSendTimeoutError extends Error
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
}

/**
 * Error thrown when data retrieval from an emtpy RandomOrgCache is attempted.
 */
exports.RandomOrgCacheEmptyError = class RandomOrgCacheEmptyError extends Error
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
}