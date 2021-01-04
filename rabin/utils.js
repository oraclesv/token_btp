// Helper functions
function checkIfValidHexString(hexString) {
    if(typeof hexString !== 'string')
        return false;
    let re = new RegExp('^(0x|0X)?[a-fA-F0-9]+$');
    return re.test(hexString);
}

function decimalToHexString(number) {
    if(typeof(number) !== 'bigint' && isNaN(number))
        throw ("Error: Argument %s should be a Number or BigInt", number);

    if (number < 0) {
        number = 0xFFFFFFFF + number + 1;
    }
    return '0x'+number.toString(16);
}

function hexStringToDecimal(hexString) {
    if (!checkIfValidHexString(hexString))
        throw ("Error: Hex %s should be hexadecimal with or without '0x' at the beginning.", hexString);
    // Remove 0x from string if necessary
    hexString = hexString.replace('0x', '');

    var i, j, digits = [0],
        carry;
    for (i = 0; i < hexString.length; i += 1) {
        carry = parseInt(hexString.charAt(i), 16);
        for (j = 0; j < digits.length; j += 1) {
            digits[j] = digits[j] * 16 + carry;
            carry = digits[j] / 10 | 0;
            digits[j] %= 10;
        }
        while (carry > 0) {
            digits.push(carry % 10);
            carry = carry / 10 | 0;
        }
    }
    return digits.reverse().join('');
}

function hexStringToBigInt(hexString){
    return BigInt(hexStringToDecimal(hexString));
}
// Test functions
/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random hex string generator
function getRandomHex(len) {
    let output = '';
    for (let i = 0; i < len; ++i) {
        output += (Math.floor(Math.random() * 16)).toString(16);
    }
    return output;
}

function sign(value) {
    if (value > 0n) {
        return 1n;
    }
    if (value < 0n) {
        return -1n;
    }
    return 0n;
}

function bigIntAbsoluteValue(value) {
    if (sign(value) === -1n) {
        return -value;
    }
    else return value;
}

module.exports = {
    checkIfValidHexString,
    decimalToHexString,
    hexStringToDecimal,
    hexStringToBigInt,
    bigIntAbsoluteValue,
    getRandomInt,
    getRandomHex
}
