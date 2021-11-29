const RandomOrgClient = require('./RandomOrgClient');
const RandomOrgCache = require('./RandomOrgCache');
const {
    RandomOrgBadHTTPResponseError,
    RandomOrgInsufficientBitsError,
    RandomOrgInsufficientRequestsError,
    RandomOrgJSONRPCError,
    RandomOrgKeyNotRunningError,
    RandomOrgRANDOMORGError,
    RandomOrgSendTimeoutError,
    RandomOrgCacheEmptyError
} = require('./RandomOrgErrors');

module.exports = {
    //default: RandomOrgClient,
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