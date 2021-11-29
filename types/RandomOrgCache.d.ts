export = RandomOrgCache;
declare class RandomOrgCache {
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
    constructor(requestFunction: (arg0: any) => any, request: any, cacheSize: number, bulkRequestNumber: number, requestNumber: number, singleRequestSize: number);
    /**
     * The cache will no longer continue to populate itself.
     */
    stop(): void;
    /**
     * The cache will resume populating itself if stopped.
     */
    resume(): void;
    /**
     * Checks if the cache is currently not re-populating itself.
     *
     * Values currently cached may still be retrieved with get() but no new
     * values are being fetched from the server. This state can be changed with
     * stop() and resume().
     * @returns {boolean} True if cache is currently not re-populating itself,
     *     false otherwise.
     */
    isPaused(): boolean;
    /**
     * Gets the next response.
     * Note that if the cache is empty, if was constructed with unsuitable parameter
     * values or if the daily allowance of bits/requests has been reached, the appropriate
     * error will be thrown.
     * @returns {any[]} The next appropriate response for the request this RandomOrgCache
     *     represents or, if stack is empty throws an error.
     * @throws RandomOrgCacheEmptyError if the cache is empty.
     */
    get(): any[];
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
    getOrWait(): Promise<any[]>;
    /**
     * Gets the number of result sets remaining in the cache.
     *
     * This essentially returns how often get() may be called without
     * a cache refill.
     * @returns {number} Current number of cached results.
     */
    getCachedValues(): number;
    /**
     * Gets the number of bits used by this cache.
     * @returns {number} Number of bits used.
     */
    getBitsUsed(): number;
    /**
     * Gets number of requests used by this cache.
     * @returns {number} Number of requests used.
     */
    getRequestsUsed(): number;
    #private;
}
