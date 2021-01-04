/*  
A Rabin Signature JavaScript module adapted
from: https://github.com/scrypt-sv/rabin/blob/master/rabin.py
*/
const { toBigIntLE } = require('bigint-buffer');
const { checkIfValidHexString,
    hexStringToBigInt,
    bigIntAbsoluteValue } = require('./utils');
let crypto;
try {
    crypto = require('crypto');
} catch (err) {
    throw('Error: crypto support is disabled!');
}
    
function greatestCommonDivisor(a, b) {
    if ((typeof a !== 'bigint') || (typeof b !== 'bigint'))
        throw "Error: Incorrect argument(s) to greatestCommonDivisor()";

    a = bigIntAbsoluteValue(a);
    b = bigIntAbsoluteValue(b);
    if (b > a) {
        let t = a;
        a = b;
        b = t;
    }
    while (b > 0) {
        let t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// Calculates: base^exponent % modulus
function powerMod(base, exponent, modulus) {
    if (modulus === 1n) return 0n;
    let result = 1n;
    base = base % modulus;
    while (exponent > 0n) {
        if (exponent % 2n === 1n) //odd number
            result = (result * base) % modulus;
        exponent = exponent >> 1n; //divide by 2
        base = (base * base) % modulus;
    }
    return result;
}

function rabinHashBytes(bytes) {
    hBytes = crypto.createHash('sha256').update(bytes).digest();
    let idx = hBytes.byteLength / 2;
    let hl = crypto.createHash('sha256').update(hBytes.slice(0, idx)).digest();
    let hr = crypto.createHash('sha256').update(hBytes.slice(idx, hBytes.byteLength)).digest();
    return toBigIntLE(Buffer.concat([hl, hr]));
}

function calculateNextPrime(p) {
    smallPrimesProduct = 3n * 5n * 7n * 11n * 13n * 17n * 19n * 23n * 29n;
    while (greatestCommonDivisor(p, smallPrimesProduct) != 1) {
        p = p + 4n;
    }
    if (powerMod(2n, p - 1n, p) != 1n) {
        return calculateNextPrime(p + 4n);
    }
    if (powerMod(3n, p - 1n, p) != 1n) {
        return calculateNextPrime(p + 4n);
    }
    if (powerMod(5n, p - 1n, p) != 1n) {
        return calculateNextPrime(p + 4n);
    }
    if (powerMod(17n, p - 1n, p) != 1n) {
        return calculateNextPrime(p + 4n);
    }
    return p;
}

function getPrimeNumber(p) {
    while (p % 4n != 3n) {
        p = p + 1n;
    }
    return calculateNextPrime(p);
}

const paddingBuffer = Buffer.from('00', 'hex');

function root(dataBuffer, p, q, nRabin) {
    let sig, x, paddingByteCount = 0;
    while (true) {
        x = rabinHashBytes(dataBuffer) % nRabin;
        sig = powerMod(p, q - 2n, q) * p * powerMod(x, (q + 1n) / 4n, q);
        sig = (powerMod(q, p - 2n, p) * q * powerMod(x, (p + 1n) / 4n, p) + sig) % (nRabin);
        if (((sig * sig) % nRabin) === x) {
            break;
        }
        dataBuffer = Buffer.concat([dataBuffer, paddingBuffer]);
        paddingByteCount++;
    }
    return {
        "signature": sig,
        "paddingByteCount": paddingByteCount
    };
}

/**
 * Calculates Key nRabin (public key) from private key parts p & q
 * @param {BigInt} p Key private key 'p' part
 * @param {BigInt} q Key private key 'q' part
 * @returns {BigInt} Key nRabin (public key) = p * q
 */
function privKeyToPubKey(p,q){
    if(typeof(p) !== 'bigint' || typeof(q) !== 'bigint')
        throw("Error: Key parts (p,q) should be BigInts (denoted by trailing 'n').")
    return p * q;
}

/**
 * Generates Private Key p & q parts from a PRNG seed
 * @returns {JSON} {'p': BigInt,'q': BigInt}
 */
function generatePrivKey() {
    // Get a seed value from a random buffer and convert it to a BigInt
    let seed = crypto.randomBytes(2048);
    return generatePrivKeyFromSeed(seed);
}

/**
 * Generates Private Key p & q parts from Seed
 * @param {Buffer} seed
 * @returns {JSON} {'p': BigInt,'q': BigInt}
 */
function generatePrivKeyFromSeed(seed) {
  let p = getPrimeNumber(rabinHashBytes(Buffer.from(seed, 'hex')) % ((2n ** 501n) + 1n));
  let q = getPrimeNumber(rabinHashBytes(Buffer.from(seed + '00', 'hex')) % ((2n ** 501n) + 1n));
  return {
      "p": p,
      "q": q
  };
}

/**
 * Creates a Rabin signature of hexadecimal data with a given key's values
 * @param {String} dataHex Hexadecimal data string value
 * @param {BigInt} p Key 'p' value
 * @param {BigInt} q Key 'q' value
 * @param {BigInt} nRabin Key nRabin value
 * @returns {JSON} {"signature": BigInt, "paddingByteCount": Number} Signature and padding count
 */
function sign(dataHex, p, q, nRabin) {
    // Check if data is valid hex
    if (!checkIfValidHexString(dataHex))
        throw ("Error: dataHex %s should be a hexadecimal String with or without '0x' at the beginning.", dataHex);
    // Remove 0x from data if necessary
    dataHex = dataHex.replace('0x', '');
    // Check key parts are correct values
    if(typeof(p) !== 'bigint' || typeof(q) !== 'bigint' || typeof(nRabin) !== 'bigint')
        throw("Error: Key parts (p,q) should be BigInts (denoted by trailing 'n').")
    return root(Buffer.from(dataHex, 'hex'), p, q, nRabin);
}

/**
 * Verifies a Rabin signature of hexadecimal data with given padding count, signature and key nRabin value
 * @param {String} dataHex Hexadecimal data string value
 * @param {Number} paddingByteCount Padding byte count
 * @param {BigInt} signature Rabin signature value
 * @param {BigInt} nRabin Public Key nRabin value
 * @returns {Boolean} If signature is valid or not
 */
function verify(dataHex, paddingByteCount, signature, nRabin) {
    // Check if data is valid hex
    if (!checkIfValidHexString(dataHex))
        throw ("Error: Data %s should be a hexadecimal String with or without '0x' at the beginning.", dataHex);
    // Remove 0x from data if necessary
    dataHex = dataHex.replace('0x', '');
    // Ensure padding count is a number
    if(typeof paddingByteCount !== 'number')
        throw ("Error: paddingByteCount should be a number");
    // Check if signature is a BigInt
    if(typeof(signature) !== 'bigint')
    throw("Error: Signature should be a BigInt (denoted by trailing 'n').");
    // Check if nRabin is a BigInt
    if(typeof(nRabin) !== 'bigint')
        throw("Error: Public Key nRabin should be a BigInt (denoted by trailing 'n').");

    let dataBuffer = Buffer.from(dataHex, 'hex');
    let paddingBuffer = Buffer.from('00'.repeat(paddingByteCount), 'hex');
    let paddedDataBuffer = Buffer.concat([dataBuffer, paddingBuffer]);
    let dataHash = rabinHashBytes(paddedDataBuffer);
    let hashMod = dataHash % nRabin;
    return hashMod === (signature ** 2n % nRabin);
}

module.exports = {
    generatePrivKey,
    generatePrivKeyFromSeed,
    privKeyToPubKey,
    sign,
    verify,
}
