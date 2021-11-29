'use strict';
import RandomOrgClient, * as errors from '../lib/esm/index.js';
/* node-import */
import { assert } from 'chai';
/* end-node-import */

// Add the API key to be used for testing here:
const apiKey = 'YOUR_API_KEY_HERE';
const roc = new RandomOrgClient(apiKey);

// If this is set to true, output from each test will be logged
// to the console, e.g. the data returned by the server or the
// message of an error that was thrown.
const logResponses = true;

// Parameter values which are used across multiple tests
const length = [ 3, 4, 5, 6 ];
const min = [ 0, 10, 20, 30 ];
const max = [ 40, 50, 60, 70 ];
const replacement = [ false, true, false, true ];
const base = [ 2, 8, 10, 16 ];
const characters = 'abcdefghijklmnopqrstuvwxyz';
const date = { 'date': '2010-12-31'};
const id = { 'id': 'foo'};
const userData = { 'foo': 'bar'};
const base64 = RandomOrgClient.BLOB_FORMAT_BASE64;
const hex = RandomOrgClient.BLOB_FORMAT_HEX;
const cacheSize = 4;

// Monitor requests/bits used by the tests
let requests = 0;
let bits = 0;

(async function() {
    requests = await roc.getRequestsLeft();
    bits = await roc.getBitsLeft();
})();

// 'mocha' test suites: Errors, General, Basic, Signed and Cache
describe('Errors', function() {
    it('RandomOrgRANDOMORGError 202: parameter out of range', async function() {
        try {
            let response = await roc.generateIntegers(100000, 0, 10);
            assert.fail('Should have thrown RandomOrgRANDOMORGError 202.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 202, 'Should have thrown RandomOrgRANDOMORGError '
                + '202, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 203: parameter is too long', async function() {
        try {
            let response = await roc.generateIntegerSequences(3, length, min, max);
            assert.fail('Should have thrown RandomOrgRANDOMORGError 203.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 203, 'Should have thrown RandomOrgRANDOMORGError '
                + '203, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 204: parameter is too short', async function() {
        try {
            let response = await roc.generateIntegerSequences(4, [1], min, max);
            assert.fail('Should have thrown RandomOrgRANDOMORGError 204.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 204, 'Should have thrown RandomOrgRANDOMORGError '
                + '204, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 300: parameter must be less than another', async function() {
        try {
            let response = await roc.generateIntegers(10, 10, 0);
            assert.fail('Should have thrown RandomOrgRANDOMORGError 300.');

        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 300, 'Should have thrown RandomOrgRANDOMORGError '
                + '300, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 301: replacement/domain error', async function() {
        try {
            let response = await roc.generateIntegers(20, 0, 9, {replacement: false});
            assert.fail('Should have thrown RandomOrgRANDOMORGError 301.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 301, 'Should have thrown RandomOrgRANDOMORGError '
                + '301, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 400: API key does not exist', async function() {
        let roc2 = new RandomOrgClient('ffffffff-ffff-ffff-ffff-ffffffffffff');

        try {
            let response = await roc2.generateIntegers(5, 0, 10);
            assert.fail('Should have thrown RandomOrgRANDOMORGError 400.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 400, 'Should have thrown RandomOrgRANDOMORGError '
                + '400, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 420: ticket does not exist', async function() {
        try {
            let response = await roc.generateSignedUUIDs(1, { ticketId: 'ffffffffffffffff' });
            assert.fail('Should have thrown RandomOrgRANDOMORGError 420.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 420, 'Should have thrown RandomOrgRANDOMORGError '
                + '420, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 421: ticket exists, but not for specified API key', async function() {
        try {
            let response = await roc.generateSignedUUIDs(1, { ticketId: 'd5b8f6d03f99a134' });
            assert.fail('Should have thrown RandomOrgRANDOMORGError 421.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 421, 'Should have thrown RandomOrgRANDOMORGError '
                + '421, instead threw ' + e.message);
        }
    });

    it('RandomOrgRANDOMORGError 422: ticket has already been used', async function() {
        try {
            let tickets = await roc.createTickets(1, true);
            let ticketId = tickets[0].ticketId;
            if (logResponses) {
                console.log('ticket id: ' + ticketId);
            }
            // use ticket and then attempt to reuse it
            let response = await roc.generateSignedUUIDs(1, { ticketId: ticketId });
            let response2 = await roc.generateSignedUUIDs(1, { ticketId: ticketId });

            assert.fail('Should have thrown RandomOrgRANDOMORGError 422.');
        } catch(e) {
            if (logResponses) {
                console.log(e.message);
            }
            assert(e instanceof errors.RandomOrgRANDOMORGError
                && e.getCode() == 422);
        }
    });
});

describe('General', function() {
    it('reusing an API key returns a previously created instance', function() {
        let roc2 = new RandomOrgClient(apiKey);
        assert(roc == roc2, 'Error: did not return the same instance.');
    });

    it('a different API key returns a new instance', function() {
        let roc2 = new RandomOrgClient('ffffffff-ffff-ffff-ffff-ffffffffffff');
        assert(roc != roc2, 'Error: returned the same instance.');
    });

    it('getRequestsLeft()', async function() {
        let response = await roc.getRequestsLeft();
        assert(response >= 0, 'Error: should have returned a number '
            + ' >= 0, instead retuned ' + response);
        if (logResponses) {
            console.log('requests remaining: ' + response);
        }
    });

    it('getBitsLeft()', async function() {
        let response = await roc.getBitsLeft();
        assert(response >= 0, 'Error: should have returned a number '
            + ' >= 0, instead retuned ' + response);
        if (logResponses) {
            console.log('bits remaining: ' + response);
        }
    });
})

describe('Basic', function() {
    describe('Integers', function() {
        it('decimal integers', async function() {
            let response = await roc.generateIntegers(5, 0, 10);

            assert(response.every(val => {
                return typeof val === 'number';
            }), 'Error: should have returned an array of numbers.');

            if (logResponses) {
                console.log('decimal integers: ' + response);
            }
        });

        it('pregenerated decimal integers (date)', async function() {
            let response = await roc.generateIntegers(5, 0, 10, { pregeneratedRandomization: date })
            let response2 = await roc.generateIntegers(5, 0, 10, { pregeneratedRandomization: date });
            
            assert.deepEqual(response, response2);
            
            if (logResponses) {
                console.log('pregenerated decimal integers (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated decimal integers (id)', async function() {
            let response = await roc.generateIntegers(5, 0, 10, { pregeneratedRandomization: id });
            let response2 = await roc.generateIntegers(5, 0, 10, { pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated decimal integers (id): ' + response
                    + ' / ' + response2);
            }
        });

        it('non-decimal integers', async function() {
            let response = await roc.generateIntegers(5, 0, 10, { replacement: false, base: 2 });

            assert(response.every(val => {
                return typeof val === 'string';
            }), 'Error: should have returned an array of strings.');

            if (logResponses) {
                console.log('non-decimal integers: ' + response);
            }
        });

        it('pregenerated non-decimal integers (date)', async function() {
            let response = await roc.generateIntegers(5, 0, 10, { replacement: false, base: 2, pregeneratedRandomization: date });
            let response2 = await roc.generateIntegers(5, 0, 10, { replacement: false, base: 2, pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated non-decimal integers (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated non-decimal integers (id)', async function() {
            let response = await roc.generateIntegers(5, 0, 10, { replacement: false, base: 2, pregeneratedRandomization: id });
            let response2 = await roc.generateIntegers(5, 0, 10, { replacement: false, base: 2, pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated non-decimal integers (id): '
                    + response + ' / ' + response2);
            }
        });
    });

    describe('Integer Sequences', function() {
        it('uniform decimal integer sequences', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10);

            assert(response.every(sequence => {
                return sequence.every(int => {
                    return typeof int === 'number';
                });
            }), 'Error: should have returned a 2D array of numbers.');

            if (logResponses) {
                console.log('uniform decimal integer sequences: ');
                console.table(response);
            }
        });

        it('uniform pregenerated decimal integer sequences (date)', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: date });
            let response2 = await roc.generateIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('uniform pregenerated decimal integers sequences (date): ');
                console.table(response);
                console.table(response2)
            }
        });

        it('uniform pregenerated decimal integer sequences (id)', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: id });
            let response2 = await roc.generateIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('uniform pregenerated decimal integers sequences (id): ');
                console.table(response);
                console.table(response2)
            }
        });

        it('uniform non-decimal integers', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10, { base: 2 });

            assert(response.every(sequence => {
                return sequence.every(int => {
                    return typeof int === 'string';
                });
            }), 'Error: should have returned a 2D array of strings.');

            if (logResponses) {
                console.log('uniform non-decimal integer sequences: ');
                console.table(response);
            }
        });

        it('uniform pregenerated non-decimal integer sequences (date)', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: date });
            let response2 = await roc.generateIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('uniform pregenerated non-decimal integers sequences (date): ');
                console.table(response);
                console.table(response2)
            }
        });

        it('uniform pregenerated non-decimal integer sequences (id)', async function() {
            let response = await roc.generateIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: id });
            let response2 = await roc.generateIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('uniform pregenerated non-decimal integers sequences (id): ');
                console.table(response);
                console.table(response2)
            }
        });

        it('multiform integer sequences', async function() {
            let response = await roc.generateIntegerSequences(4, length, min, max, { replacement: replacement, base: base });

            assert(response.every((sequence, index) => {
                return sequence.every(val => {
                    let type = base[index] == 10 ? 'number' : 'string';
                    return typeof val === type;
                });
            }), 'Error: the type of the values in the 2D array was not as expected.');

            if (logResponses) {
                console.log('multiform integer sequences: ');
                console.table(response);
            }
        });

        it('multiform pregenerated integer sequences (date)', async function() {
            let response = await roc.generateIntegerSequences(4, length, min, max, { replacement: replacement, base: base, pregeneratedRandomization: date });
            let response2 = await roc.generateIntegerSequences(4, length, min, max, { replacement: replacement, base: base, pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('multiform pregenerated integers sequences (date): ');
                console.table(response);
                console.table(response2)
            }
        });

        it('multiform pregenerated integer sequences (id)', async function() {
            let response = await roc.generateIntegerSequences(4, length, min, max, { replacement: replacement, base: base, pregeneratedRandomization: id });
            let response2 = await roc.generateIntegerSequences(4, length, min, max, { replacement: replacement, base: base, pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('multiform pregenerated integers sequences (id): ');
                console.table(response);
                console.table(response2)
            }
        });
    });

    describe('Decimal Fractions', function() {
        it('decimal fractions', async function() {
            let response = await roc.generateDecimalFractions(5, 4, { replacement: false });

            assert(response.every(val => {
                return typeof val === 'number';
            }), 'Error: should have returned an array of numbers.');

            if (logResponses) {
                console.log('decimal fractions: ' + response);
            }
        });

        it('pregenerated decimal fractions (date)', async function() {
            let response = await roc.generateDecimalFractions(5, 4, { pregeneratedRandomization: date });
            let response2 = await roc.generateDecimalFractions(5, 4, { pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated decimal fractions (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated decimal fractions (id)', async function() {
            let response = await roc.generateDecimalFractions(5, 4, { pregeneratedRandomization: id });
            let response2 = await roc.generateDecimalFractions(5, 4, { pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated decimal fractions (id): '
                    + response + ' / ' + response2);
            }
        });
    });

    describe('Gaussians', function() {
        it('gaussians', async function() {
            let response = await roc.generateGaussians(5, 3.41, 2.1, 4);

            assert(response.every(val => {
                return typeof val === 'number';
            }), 'Error: should have returned an array of numbers.');

            if (logResponses) {
                console.log('gaussians: ' + response);
            }
        });

        it('pregenerated gaussians (date)', async function() {
            let response = await roc.generateGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: date });
            let response2 = await roc.generateGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated gaussians (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated gaussians (id)', async function() {
            let response = await roc.generateGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: id });
            let response2 = await roc.generateGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated gaussians (id): '
                    + response + ' / ' + response2);
            }
        });
    });

    describe('Strings', function() {
        it('strings, lowercase English alphabet', async function() {
            let response = await roc.generateStrings(3, 5, characters);

            assert(response.every(val => {
                return typeof val === 'string';
            }), 'Error: should have returned an array of strings.');

            if (logResponses) {
                console.log('strings, lowercase English alphabet: ' + response);
            }
        });

        it('pregenerated strings, lowercase English alphabet (date)', async function() {
            let response = await roc.generateStrings(3, 5, characters, { replacement: false, pregeneratedRandomization: date });
            let response2 = await roc.generateStrings(3, 5, characters, { replacement: false, pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated strings, lowercase English alphabet (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated strings, lowercase English alphabet (id)', async function() {
            let response = await roc.generateStrings(3, 5, characters, { replacement: false, pregeneratedRandomization: id });
            let response2 = await roc.generateStrings(3, 5, characters, { replacement: false, pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated strings, lowercase English alphabet (id): '
                    + response + ' / ' + response2);
            }
        });
    });

    describe('UUIDs', function() {
        it('UUIDs', async function() {
            let response = await roc.generateUUIDs(3);

            assert(response.every(val => {
                return isUUID(val);
            }), 'Error: should have returned an array of UUIDs.');

            if (logResponses) {
                console.log('UUIDs: ' + response);
            }
        });

        it('pregenerated UUIDs (date)', async function() {
            let response = await roc.generateUUIDs(3, { pregeneratedRandomization: date });
            let response2 = await roc.generateUUIDs(3, { pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated UUIDs (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated UUIDs (id)', async function() {
            let response = await roc.generateUUIDs(3, { pregeneratedRandomization: id });
            let response2 = await roc.generateUUIDs(3, { pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            if (logResponses) {
                console.log('pregenerated UUIDs (id): '
                    + response + ' / ' + response2);
            }
        });
    });

    describe('BLOBs', function() {
        it('BLOBs, 128-bit, base64', async function() {
            let response = await roc.generateBlobs(3, 128);

            assert(response.every(val => {
                return isBase64(val);
            }), 'Error: should have returned an array of base64 BLOBs.');

            if (logResponses) {
                console.log('BLOBs, 128-bit, base64: ' + response);
            }
        });

        it('BLOBs, 128-bit, hex', async function() {
            let response = await roc.generateBlobs(3, 128, { format: hex });

            assert(response.every(val => {
                return isHex(val, 128);
            }), 'Error: should have returned an array of hex BLOBs.');

            if (logResponses) {
                console.log('BLOBs, 128-bit, hex: ' + response);
            }
        });

        it('pregenerated BLOBs (date)', async function() {
            let response = await roc.generateBlobs(3, 64, { format: hex, pregeneratedRandomization: date });
            let response2 = await roc.generateBlobs(3, 64, { format: hex, pregeneratedRandomization: date });

            assert.deepEqual(response, response2);

            assert(response.every(val => {
                return isHex(val, 64);
            }), 'Error: should have returned an array of hex BLOBs.');

            if (logResponses) {
                console.log('pregenerated BLOBs (date): '
                    + response + ' / ' + response2);
            }
        });

        it('pregenerated BLOBs (id)', async function() {
            let response = await roc.generateBlobs(3, 64, { format: hex, pregeneratedRandomization: id });
            let response2 = await roc.generateBlobs(3, 64, { format: hex, pregeneratedRandomization: id });

            assert.deepEqual(response, response2);

            assert(response.every(val => {
                return isHex(val, 64);
            }), 'Error: should have returned an array of hex BLOBs.');

            if (logResponses) {
                console.log('pregenerated BLOBs (id): ' + response
                    + ' / ' + response2);
            }
        });
    });
});

describe('Signed', function() {
    describe('Integers', function() {
        it('decimal integers', async function() {
            let response  = await roc.generateSignedIntegers(5, 0, 10, { userData: userData });

            return signedTestHelper(response, 'number', true, 'decimal integers');
        });

        it('pregenerated decimal integers (date)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10, { pregeneratedRandomization: date });
            let response2 = await roc.generateSignedIntegers(5, 0, 10, { pregeneratedRandomization: date });
            
            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated decimal integers (date): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated decimal integers (id)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10, { pregeneratedRandomization: id });
            let response2 = await roc.generateSignedIntegers(5, 0, 10, { pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated decimal integers (id): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('non-decimal integers', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10, { base: 2, userData: userData });

            return signedTestHelper(response, 'string', true, 'non-decimal integers');
        });

        it('pregenerated non-decimal integers (date)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10, { base: 2, pregeneratedRandomization: date });
            let response2 = await roc.generateSignedIntegers(5, 0, 10, { base: 2, pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated non-decimal integers (date): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated non-decimal integers (id)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10, { base: 2, pregeneratedRandomization: id });
            let response2 = await roc.generateSignedIntegers(5, 0, 10, { base: 2, pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated non-decimal integers (id): '
                    + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('Integer Sequences', function() {
        it('uniform decimal integer sequences', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { userData: userData });
            
            return signedTestHelper(response, Array(3).fill('number'), true,
                'uniform decimal integer sequences');
        });

        it('uniform pregenerated decimal integer sequences (date)', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: date });
            let response2 = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('uniform pregenerated decimal integer sequences (date): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });

        it('uniform pregenerated decimal integer sequences (id)', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: id });
            let response2 = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('uniform pregenerated decimal integer sequences (id): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });

        it('uniform non-decimal integer sequences', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { base: 2, userData: userData });
            
            return signedTestHelper(response, Array(3).fill('string'), true,
                    'uniform non-decimal integer sequences');
        });

        it('uniform pregenerated non-decimal integer sequences (date)', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: date });
            let response2 = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('uniform pregenerated non-decimal integer sequences (date): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });

        it('uniform pregenerated non-decimal integer sequences (id)', async function() {
            let response = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: id });
            let response2 = await roc.generateSignedIntegerSequences(3, 5, 0, 10, { base: 2, pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('uniform pregenerated non-decimal integer sequences (id): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });

        it('multiform integer sequences', async function() {
            let response = await roc.generateSignedIntegerSequences(4, length, min, max,
                { replacement: replacement, base: base, userData: userData });
            
            let types = [];
            base.every(val => types.push(val == 10 ? 'number' : 'string'));

            return signedTestHelper(response, types, true, 'multiform integer sequences');
        });

        it('multiform pregenerated integer sequences (date)', async function() {
            let response = await roc.generateSignedIntegerSequences(4, length, min, max,
                { replacement: replacement, base: base, pregeneratedRandomization: date });
            let response2 = await roc.generateSignedIntegerSequences(4, length, min, max,
                { replacement: replacement, base: base, pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('multiform pregenerated integer sequences (date): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });

        it('multiform pregenerated integer sequences (id)', async function() {
            let response = await roc.generateSignedIntegerSequences(4, length, min, max,
                { replacement: replacement, base: base, pregeneratedRandomization: id });
            let response2 = await roc.generateSignedIntegerSequences(4, length, min, max,
                { replacement: replacement, base: base, pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('multiform pregenerated integer sequences (id): ');
                console.table(response.data);
                console.table(response2.data);
            }
        });
    });

    describe('Decimal Fractions', function() {
        it('decimal fractions', async function() {
            let response = await roc.generateSignedDecimalFractions(5, 4, { replacement: false,
                userData: userData });
           
            return signedTestHelper(response, 'number', true, 'decimal fractions');
        });

        it('pregenerated decimal fractions (date)', async function() {
            let response = await roc.generateSignedDecimalFractions(5, 4, { replacement: false,
                pregeneratedRandomization: date });
            let response2 = await roc.generateSignedDecimalFractions(5, 4, { replacement: false,
                pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated decimal fractions (date): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated decimal fractions (id)', async function() {
            let response = await roc.generateSignedDecimalFractions(5, 4, { replacement: false,
                pregeneratedRandomization: id });
            let response2 = await roc.generateSignedDecimalFractions(5, 4, { replacement: false,
                pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated decimal fractions (id): '
                    + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('Gaussians', function() {
        it('gaussians', async function() {
            let response = await roc.generateSignedGaussians(5, 3.41, 2.1, 4,
                { userData: userData });
            
            return signedTestHelper(response, 'number', true, 'gaussians');
        });

        it('pregenerated gaussians (date)', async function() {
            let response = await roc.generateSignedGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: date });
            let response2 = await roc.generateSignedGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated gaussians (date): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated gaussians (id)', async function() {
            let response = await roc.generateSignedGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: id });
            let response2 = await roc.generateSignedGaussians(5, 3.41, 2.1, 4, { pregeneratedRandomization: id });
            
            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated gaussians (id): '
                    + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('Strings', function() {
        it('strings, lowercase English alphabet', async function() {
            let response = await roc.generateSignedStrings(3, 5, characters, { userData: userData });
            
            return signedTestHelper(response, 'string', true,
                'strings, lowercase English alphabet');
        });

        it('pregenerated strings, lowercase English alphabet (date)', async function() {
            let response = await roc.generateSignedStrings(3, 5, characters, { pregeneratedRandomization: date });
            let response2 = await roc.generateSignedStrings(3, 5, characters, { pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated strings, lowercase English alphabet '
                    + '(date): ' + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated strings, lowercase English alphabet (id)', async function() {
            let response = await roc.generateSignedStrings(3, 5, characters, { pregeneratedRandomization: id });
            let response2 = await roc.generateSignedStrings(3, 5, characters, { pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated strings, lowercase English alphabet '
                    + '(id): ' + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('UUIDs', function() {
        it('UUIDs', async function() {
            let response = await roc.generateSignedUUIDs(3, { userData: userData });
            
            return signedTestHelper(response, 'UUID', true, 'UUIDs');
        });

        it('pregenerated UUIDs (date)', async function() {
            let response = await roc.generateSignedUUIDs(3, { pregeneratedRandomization: date });
            let response2 = await roc.generateSignedUUIDs(3, { pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);
            
            if (logResponses) {
                console.log('pregenerated UUIDs (date): '
                    + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated UUIDs (id)', async function() {
            let response = await roc.generateSignedUUIDs(3, { pregeneratedRandomization: id });
            let response2 = await roc.generateSignedUUIDs(3, { pregeneratedRandomization: id });

            assert.deepEqual(response.data, response2.data);

            if (logResponses) {
                console.log('pregenerated UUIDs (id): '
                    + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('BLOBs', function() {
        it('BLOBs, 128-bit, base64', async function() {
            let response = await roc.generateSignedBlobs(3, 128, { format: base64, userData: userData });
            
            return signedTestHelper(response, 'base64', true, 'BLOBs, 128-bit, base64');
        });

        it('BLOBs, 128-bit, hex', async function() {
            let response = await roc.generateSignedBlobs(3, 128, { format: hex, userData: userData });
            
            return signedTestHelper(response, '128-hex', true, 'BLOBs, 128-bit, hex');
        });

        it('pregenerated BLOBs (date)', async function() {
            let response = await roc.generateSignedBlobs(3, 64, { format: base64, pregeneratedRandomization: date });
            let response2 = await roc.generateSignedBlobs(3, 64, { format: base64, pregeneratedRandomization: date });

            assert.deepEqual(response.data, response2.data);

            assert(response.data.every(val => {
                return isBase64(val);
            }), 'Error: should have returned an array of base64 BLOBs.');

            if (logResponses) {
                console.log('pregenerated BLOBs (date): ' + response.data + ' / ' + response2.data);
            }
        });

        it('pregenerated BLOBs (id)', async function() {
            let response = await roc.generateSignedBlobs(3, 64, { format: base64, pregeneratedRandomization: id });
            let response2 = await roc.generateSignedBlobs(3, 64, { format: base64, pregeneratedRandomization: id });
            
            assert.deepEqual(response.data, response2.data);

            assert(response.data.every(val => {
                return isBase64(val);
            }), 'Error: should have returned an array of base64 BLOBs.');

            if (logResponses) {
                console.log('pregenerated BLOBs (id): ' + response.data + ' / ' + response2.data);
            }
        });
    });

    describe('Tickets', function() {
        it('create a single ticket', async function() {
            let response = await roc.createTickets(1, true);
            let ticket = response[0].ticketId;

            assert(typeof ticket  === 'string', 'Error: should have '
                + 'returned a string, instead returned ' + ticket);

            if (logResponses) {
                console.log('ticket id: ' + ticket);
            }
        });

        it('listTickets(), singleton', async function() {
            let response = await roc.listTickets('singleton');

            if (Array.isArray(response)) {
                assert(response.every(val => {
                    return (val.nextTicketId == null && val.previousTicketId == null);
                }), 'Error: tickets returned were not of the correct type.');
                if (logResponses) {
                    console.log('first ticket, singleton: ' + JSON.stringify(response[0]));
                }
            }
        });

        it('listTickets(), head', async function() {
            let response = await roc.listTickets('head');

            if (Array.isArray(response)) {
                assert(response.every(val => {
                    return (val.nextTicketId != null && val.previousTicketId == null);
                }), 'Error: tickets returned were not of the correct type.');
                if (logResponses) {
                    console.log('first ticket, head: ' + JSON.stringify(response[0]));
                }
            }
        });

        it('listTickets(), tail', async function() {
            let response = await roc.listTickets('tail');

            if (Array.isArray(response)) {
                assert(response.every(val => {
                    return (val.nextTicketId == null && val.previousTicketId != null);
                }), 'Error: tickets returned were not of the correct type.');
                if (logResponses) {
                    console.log('first ticket, tail: ' + JSON.stringify(response[0]));
                }
            }
        });

        it('getTicket()', async function() {
            let tickets = await roc.createTickets(1, true);
            let ticketId = tickets[0].ticketId;

            let response = await roc.generateSignedUUIDs(1, { ticketId: ticketId });
            let response2 = await roc.getTicket(ticketId);

            assert.deepEqual(response.data, response2.result.random.data);
            if (logResponses) {
                console.log('original: ' + response.data + ' getTicket: '
                    + response2.result.data + ' ticketId: ' + ticketId);
            }
        });
    });

    describe('Other', function() {
        it('verifySignature(random, signature)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10);

            let verification = await roc.verifySignature(response.random, response.signature);
            assert(verification, 'Error: should have been verified successfully.');
            
            verification = await roc.verifySignature(response.random, modifySignature(response.signature));
            assert(!verification, 'Error: should not have been verified successfully.');
        });

        it('getResult(serialNumber)', async function() {
            let response = await roc.generateSignedIntegers(5, 0, 10);
            let serialNumber = response.random.serialNumber;

            let response2 = await roc.getResult(serialNumber);

            assert.deepEqual(response.data, response2.random.data,
                'Error: the responses should have been the same.');
            
            if (logResponses) {
                console.log('original: ' + response.data + ' getResult: '
                    + response2.data + ' serialNumber: ' + serialNumber);
            }
        });
    });
});

describe('Caches', function() {
    it('decimal integers without replacement (individual requests)', async function() {
        let cache = roc.createIntegerCache(5, 0, 10, { replacement: false, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError, 'Should have thrown '
                + 'RandomOrgCacheEmptyError, instead threw ' + e.message);
        }

        assert(cache.isPaused(), 'Error: cache should have been paused.');

        let got = null;

        // Testing RandomOrgCacheEmptyError.isPaused() function
        try {
            got = cache.get();
        } catch (e) {
            if (e instanceof errors.RandomOrgCacheEmptyError) {
                assert(e.wasPaused() === true, 'Should have been paused.');
            } else {
                assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                + ', instead threw ' + e.message);
            }
        }

        cache.resume();

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    assert(e.wasPaused() === false, 'Should not have been paused.');
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return typeof val === 'number';
        }), 'Error: should have returned an array of integers.');

        if (logResponses) {
            console.log('decimal integer cache, get(): ' + got);
        }

        // General functions
        let size = cache.getCachedValues();
        assert(size >= 0);

        let bitsUsed = cache.getBitsUsed();
        assert(bitsUsed >= 0);

        let requestsUsed = cache.getRequestsUsed();
        assert(requestsUsed >= 0);

        if (logResponses) {
            console.log('size of cache: ' + size + ' bits used: ' + bitsUsed
                + ' requests used: ' + requestsUsed);
        }
    });

    it('non-decimal integer with replacement (bulk requests)', async function() {
        let cache = roc.createIntegerCache(5, 0, 10, { base: 16, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return typeof val === 'string';
        }), 'Error: should have returned an array of strings.');

        if (logResponses) {
            console.log('non-decimal integer cache, get(): ' + got);
        }
    });

    it('uniform decimal integer sequences with replacement (bulk requests)', async function() {
        let cache = roc.createIntegerSequenceCache(3, 5, 0, 10, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(sequence => {
            return sequence.every(val => {
                return typeof val === 'number';
            });            
        }), 'Error: should have returned a 2D array of integers.');

        if (logResponses) {
            console.log('uniform decimal integer sequence cache, get(): ');
            console.table(got);
        }
    });

    it('uniform non-decimal integer sequences with replacement (bulk requests)', async function() {
        let cache = roc.createIntegerSequenceCache(3, 5, 0, 10, { base: 16, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(sequence => {
            return sequence.every(val => {
                return typeof val === 'string';
            });            
        }), 'Error: should have returned a 2D array of strings.');

        if (logResponses) {
            console.log('uniform non-decimal integer sequence cache, get(): ');
            console.table(got);
        }
    });

    it('multiform decimal integer sequences with replacement (bulk requests)', async function() {
        let cache = roc.createIntegerSequenceCache(4, length, min, max, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(sequence => {
            return sequence.every(val => {
                return typeof val === 'number';
            });            
        }), 'Error: should have returned a 2D array of integers.');

        if (logResponses) {
            console.log('multiform decimal integer sequence cache, get(): ');
            console.table(got);
        }
    });

    it('multiform mixed-base integer sequences with replacement (bulk requests)', async function() {
        let cache = roc.createIntegerSequenceCache(4, length, min, max, { base: base, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every((sequence, index) => {
            return sequence.every(val => {
                let type = base[index] == 10 ? 'number' : 'string';
                return typeof val === type;
            });
        }), 'Error: the type of the values in the 2D array was not as expected.');

        if (logResponses) {
            console.log('multiform mixed-base integer sequence cache, get(): ');
            console.table(got);
        }
    });

    it('decimal fractions without replacement (individual requests)', async function() {
        let cache = roc.createDecimalFractionCache(5, 4, { replacement: false, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }
        
        assert(got.every(val => {
            return typeof val === 'number';
        }), 'Error: should have returned an array of numbers.');

        if (logResponses) {
            console.log('decimal fraction cache, get(): ' + got);
        }
    });

    it('decimal fractions with replacement (bulk requests)', async function() {
        let cache = roc.createDecimalFractionCache(5, 4, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return typeof val === 'number';
        }), 'Error: should have returned an array of numbers.');

        if (logResponses) {
            console.log('decimal fraction cache, get(): ' + got);
        }
    });

    it('gaussians (bulk requests as gaussians are always chosen with replacement)', async function() {
        let cache = roc.createGaussianCache(10, 3.41, 2.1, 4, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return typeof val === 'number';
        }), 'Error: should have returned an array of numbers.');

        if (logResponses) {
            console.log('gaussian cache, get(): ' + got);
        }
    });

    it('strings with replacement (bulk requests)', async function() {
        let cache = roc.createStringCache(5, 5, characters, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return typeof val === 'string';
        }), 'Error: should have returned an array of strings.');

        if (logResponses) {
            console.log('string cache, get(): ' + got);
        }
    });

    it('UUIDs (bulk requests, always)', async function() {
        let cache = roc.createUUIDCache(1, { cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return isUUID(val);
        }), 'Error: should have returned an array of UUIDs.');

        if (logResponses) {
            console.log('UUID cache, get(): ' + got);
        }
    });

    it('BLOBs, 128-bit, base64 (bulk requests, always)', async function() {
        let cache = roc.createBlobCache(3, 128, { format: base64, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return isBase64(val);
        }), 'Error: should have returned an array of base64 BLOBs.');

        if (logResponses) {
            console.log('base64-encoded blob cache, get(): ' + got);
        }
    });

    it('BLOBs, 128-bit, hex (bulk requests, always)', async function() {
        let cache = roc.createBlobCache(3, 128, { format: hex, cacheSize: cacheSize });
        cache.stop();

        try {
            cache.get();
            assert.fail('Should have thrown RandomOrgCacheEmptyError.');
        } catch (e) {
            assert(e instanceof errors.RandomOrgCacheEmptyError);
        }

        assert(cache.isPaused());
        cache.resume();

        let got = null;

        // Testing RandomOrgCache function get()
        while (got == null) {
            try {
                got = cache.get();
            } catch (e) {
                if (e instanceof errors.RandomOrgCacheEmptyError) {
                    await new Promise(r => setTimeout(r, 50));
                } else {
                    assert.fail('Should have thrown RandomOrgCacheEmptyError, '
                    + ', instead threw ' + e.message);
                }
            }
        }

        assert(got.every(val => {
            return isHex(val, 128);
        }), 'Error: should have returned an array of hex BLOBs.');

        if (logResponses) {
            console.log('hex-encoded blob cache, get(): ' + got);
        }
    });
});

describe('Final Usage', function() {
    it('requests used', async function() {
        let updatedRequests = await roc.getRequestsLeft();
        console.log(requests - updatedRequests);
    });

    it('bits used', async function() {
        let updatedBits = await roc.getBitsLeft();
        console.log(bits - updatedBits);
    });
});



let signedTestHelper = async function(response, type, hasUserData = false, message = null) {
    let verified = await roc.verifySignature(response.random, response.signature);

    // check that the result can be verified
    assert(verified);

    if (logResponses) {
        console.log(message + ': ' + response.data);
    }

    // check that the data returned is of the correct type
    if (Array.isArray(type)) {
        // multiform integer sequences with mixed values for the base parameter
        for(let i = 0; i < response.data.length; i++) {
            assert(response.data[i].every(val => {
                return typeof val == type[i];
            }));
        }
    } else if (type === 'UUID') {
        assert(response.data.every(val => {
            return isUUID(val);
        }));
    } else if (type === 'base64') {
        assert(response.data.every(val => {
            return isBase64(val);
        }));
    } else if (type === '128-hex') {
        let size = response.random.size;
        assert(response.data.every(val => {
            return isHex(val, size);
        }))
    } else {
        // any other method
        assert(response.data.every(val => {
            return typeof val === type;
        }));
    }

    // check userData is returned correctly
    if (hasUserData) {
        assert.deepEqual(response.random.userData, userData);
    }
};

/**
 * Helper function to determine whether a string is a valid UUID.
 * @param {string} val The string to be tested.
 * @returns True, if it is a UUID, false otherwise.
 */
let isUUID = function(val) {
    let pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return pattern.test(val);
}

/**
 * Helper function to determine whether a string is base64-encoded.
 * @param {string} val The string to be tested.
 * @returns True, if it is base64 encoded, false otherwise.
 */
let isBase64 = function(val) {
    let pattern = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    return pattern.test(val);
}

/**
 * Helper function to determine whether a BLOB is hex-encoded.
 * @param {string} val The BLOB to be tested (as a string).
 * @param {number} size The size of the BLOB.
 * @returns True, if it is hex encoded, false otherwise.
 */
let isHex = function(val, size) {
    let length = size / 4;
    let pattern = new RegExp('^([0-9a-f]{' + length + '})?$');
    return pattern.test(val);
}

/**
 * Modifies the signature by swapping the first two non-identical characters.
 * @param {string} signature Signature returned by one of the Signed methods.
 * @returns The modified signature.
 */
let modifySignature = function(signature) {
    let s = signature.split('');
    for (let i = 1; i < s.length; i++) {
        if (s[i] != s[i-1]) {
            let temp = s[i];
            s[i] = s[i-1];
            s[i-1] = temp;
            break;
        }
    }
    return s.join('');
}