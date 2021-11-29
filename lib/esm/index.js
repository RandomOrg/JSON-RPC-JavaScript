/** 
 * ES Module wrapper, allowing this library to be imported using
 * ES6+ syntax. The RandomOrgClient class is both the default and
 * a named export. All error classes, are available only as named
 * exports.
 * */
import RandomOrgClient from '../RandomOrgClient.js';
import RandomOrgCache from '../RandomOrgCache.js';
import * as Errors from '../RandomOrgErrors.js';

let RandomOrgRANDOMORGError = Errors.default.RandomOrgRANDOMORGError;
let RandomOrgBadHTTPResponseError = Errors.default.RandomOrgBadHTTPResponseError;
let RandomOrgInsufficientBitsError = Errors.default.RandomOrgInsufficientBitsError;
let RandomOrgInsufficientRequestsError = Errors.default.RandomOrgInsufficientRequestsError;
let RandomOrgJSONRPCError = Errors.default.RandomOrgJSONRPCError;
let RandomOrgKeyNotRunningError = Errors.default.RandomOrgKeyNotRunningError;
let RandomOrgSendTimeoutError = Errors.default.RandomOrgSendTimeoutError;
let RandomOrgCacheEmptyError = Errors.default.RandomOrgCacheEmptyError;

export {
    RandomOrgClient as default,
    RandomOrgClient,
    RandomOrgCache,
    RandomOrgBadHTTPResponseError,
    RandomOrgInsufficientBitsError,
    RandomOrgInsufficientRequestsError,
    RandomOrgJSONRPCError,
    RandomOrgKeyNotRunningError,
    RandomOrgRANDOMORGError,
    RandomOrgSendTimeoutError,
    RandomOrgCacheEmptyError
};