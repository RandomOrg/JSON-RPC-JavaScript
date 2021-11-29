'use strict';
const {
    RandomOrgInsufficientBitsError,
    RandomOrgCacheEmptyError
} = require('./RandomOrgErrors.js');
/**
 * Precache class for frequently used requests.
 */
module.exports = class RandomOrgCache {
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
                            if (e instanceof RandomOrgInsufficientBitsError) {
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
                throw new RandomOrgCacheEmptyError('The RandomOrgCache stack '
                    + 'is empty and the cache is paused. Please call resume() to '
                    + 'restart populating the cache.', true);            
            } else {
                throw new RandomOrgCacheEmptyError('The RandomOrgCache stack '
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
            if (e instanceof RandomOrgCacheEmptyError) {
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
}